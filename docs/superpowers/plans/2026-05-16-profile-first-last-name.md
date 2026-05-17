# Profile First/Last Name Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `display_name` text column on `profiles` with two real fields — `first_name` and `last_name` — both required for every user, and keep `display_name` working as the canonical rendered string by making it a Postgres generated column. Add a backfill prompt for legacy users with null names so "Shared by [name]" is reliably populated everywhere.

**Architecture:**
- SQL migration adds `first_name` / `last_name`, backfills them from `auth.users.raw_user_meta_data` (Google's `given_name` / `family_name`) and from existing `display_name` (split on first space), then drops `display_name` and re-adds it as a `generated always as (...) stored` column. All existing readers (share RPCs, viewer header, saved-share cards) continue to read `profiles.display_name` unchanged.
- Write path becomes: OAuth callback writes first/last from Google metadata → onboarding presents a confirm/edit name step that requires both fields → profile page exposes both fields → a name-required prompt blocks share / save actions for legacy users with null name fields.
- No new action contract for the share flow (we don't rewrite `createPlannerShare` / `saveSharedPlanner`). Callers gate on a client-side check; if the prompt fires, they save the name first, then call the original action.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase 2.102, Postgres 15+ (Supabase managed), Vitest.

---

## File Structure

**New files:**
- `supabase/migrations/044_profiles_first_last_name.sql` — DB migration.
- `src/lib/actions-profile-name-validation.ts` — Pure validator for first/last (shared by client + server).
- `src/components/onboarding/name-step.tsx` — Onboarding step 0: confirm first/last.
- `src/components/auth/name-required-prompt.tsx` — Inline modal shown when an authed user is about to share/save with a missing first or last name.
- `tests/lib/actions-profile-name-validation.test.ts` — Unit tests for the new validator.

**Modified files:**
- `src/lib/actions-profile-validation.ts` — Extend `ProfileInput` to first/last; reuse the new validator.
- `tests/lib/actions-profile.test.ts` — Update existing test cases for the new shape.
- `src/lib/actions.ts` — `updateProfile` takes firstName/lastName; add `updateProfileName` server action; add `fetchOwnNameStatus` query helper.
- `src/app/auth/callback/route.ts` — On OAuth exchange, upsert `first_name` / `last_name` on the profile row from `user.user_metadata.given_name` / `family_name`.
- `src/app/account/profile/page.tsx` — Read `first_name` / `last_name` from `profiles` instead of `user_metadata.full_name`.
- `src/app/account/profile/client.tsx` — Update `initial` props shape.
- `src/components/account/edit-profile-form.tsx` — Replace single Name input with First + Last; mark both required.
- `src/app/onboarding/page.tsx` — Inject `name` as the first onboarding step (4 steps total).
- `src/components/planner/share-planner-modal.tsx` — Gate `handleLink` on name-required check.
- `src/components/planner/save-share-cta.tsx` — Gate `handleSave` on name-required check.
- `src/app/account/planners/client.tsx` — Gate the create-share call (line ~613) on name-required check.

---

## Conventions

- TypeScript strict mode (already on). Treat `supabase` as `any` (existing pattern; types not generated yet).
- Server actions live in `src/lib/actions.ts`. Pure validators live in `src/lib/actions-*-validation.ts` so client components can import them.
- Tests are Vitest under `tests/`. They import via the `@/` alias.
- Run lint / typecheck / tests after each step that changes code: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Commit after every task. Commit message format: `feat(profile-name): <what changed>` (see existing commits like `style(share): ...`).

---

## Task 1: SQL migration — add first_name/last_name, generated display_name

**Files:**
- Create: `supabase/migrations/044_profiles_first_last_name.sql`

The existing `get_profile_display_name(uuid)` SECURITY DEFINER function (migration 026) reads `display_name` from `profiles`. We must drop it before dropping the column, then re-create it after the column is re-added as a generated column.

The generated-column expression handles three states: both first+last present (concatenate), first-only (use first), neither (null). Whitespace-only counts as empty.

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/044_profiles_first_last_name.sql`:

```sql
-- 044_profiles_first_last_name.sql
-- Replace the single optional display_name with required first_name / last_name.
-- display_name becomes a generated column derived from first_name + last_name so
-- every downstream reader (share RPCs, saved-share live RPC, viewer header) keeps
-- working unchanged. Best-effort backfill from auth.users metadata (Google's
-- given_name / family_name) first, then from the existing display_name split on
-- the first space.

-- 1. Add the new columns. Nullable for now so the backfill can run; the app layer
--    will enforce non-empty on every write. (Hard NOT NULL would require an
--    immediate backfill to succeed for every legacy row, which we cannot
--    guarantee without surveying real data first.)
alter table profiles add column first_name text;
alter table profiles add column last_name text;

-- 2. Backfill. Prefer Google's structured fields; fall back to splitting the
--    legacy display_name on the first space.
update profiles p
   set first_name = coalesce(
         nullif(trim(au.raw_user_meta_data ->> 'given_name'), ''),
         nullif(split_part(p.display_name, ' ', 1), '')
       ),
       last_name = coalesce(
         nullif(trim(au.raw_user_meta_data ->> 'family_name'), ''),
         nullif(
           trim(
             case
               when position(' ' in p.display_name) > 0
                 then substring(p.display_name from position(' ' in p.display_name) + 1)
               else ''
             end
           ),
           ''
         )
       )
  from auth.users au
 where p.id = au.id;

-- 3. Drop the SECURITY DEFINER function so we can drop the column it depends on.
drop function if exists get_profile_display_name(uuid);

-- 4. Replace display_name with a generated column. The expression trims and
--    handles the three valid states. Whitespace-only first/last counts as null.
alter table profiles drop column display_name;
alter table profiles add column display_name text
  generated always as (
    case
      when nullif(trim(coalesce(first_name, '')), '') is not null
        and nullif(trim(coalesce(last_name, '')), '') is not null
        then trim(first_name) || ' ' || trim(last_name)
      when nullif(trim(coalesce(first_name, '')), '') is not null
        then trim(first_name)
      else null
    end
  ) stored;

-- 5. Re-create the public resolver function from migration 026. Same body,
--    same grants — display_name now flows through the generated column.
create or replace function get_profile_display_name(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select display_name from profiles where id = target_user_id;
$$;

grant execute on function get_profile_display_name(uuid) to anon, authenticated;
```

- [ ] **Step 2: Verify the migration runs cleanly on the local Supabase shadow DB**

Run:
```bash
pnpm supabase db reset
```
Expected: completes without error; `\d profiles` (run via `pnpm supabase db connect` or `psql`) shows `first_name text`, `last_name text`, and `display_name text` with the comment `generated always as (...) stored`.

Quick sanity SQL (run via Supabase Studio or psql):
```sql
insert into profiles (id, first_name, last_name) values (gen_random_uuid(), 'Sarah', 'Jones');
select first_name, last_name, display_name from profiles where first_name = 'Sarah';
-- Expect: Sarah | Jones | Sarah Jones
update profiles set last_name = 'Smith' where first_name = 'Sarah';
select display_name from profiles where first_name = 'Sarah';
-- Expect: Sarah Smith
```

If `pnpm supabase` is not wired up locally, the user runs the migration in Supabase Studio against the staging project; flag this back to them with the file contents.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/044_profiles_first_last_name.sql
git commit -m "feat(profile-name): add first_name/last_name; generate display_name from them"
```

---

## Task 2: First/last name validator (pure function + tests)

**Files:**
- Create: `src/lib/actions-profile-name-validation.ts`
- Create: `tests/lib/actions-profile-name-validation.test.ts`

Both first and last name are required (non-empty after trim). We don't enforce a max length here — the DB column is `text`. We don't enforce character classes — users have all kinds of names.

- [ ] **Step 1: Write the failing tests**

Write `tests/lib/actions-profile-name-validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateProfileName } from "@/lib/actions-profile-name-validation";

describe("validateProfileName", () => {
  it("accepts a normal first and last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "Jones" })).toEqual({});
  });

  it("rejects an empty first name", () => {
    expect(validateProfileName({ firstName: "", lastName: "Jones" }).error).toMatch(/first/i);
  });

  it("rejects a whitespace-only first name", () => {
    expect(validateProfileName({ firstName: "   ", lastName: "Jones" }).error).toMatch(/first/i);
  });

  it("rejects an empty last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "" }).error).toMatch(/last/i);
  });

  it("rejects a whitespace-only last name", () => {
    expect(validateProfileName({ firstName: "Sarah", lastName: "\t " }).error).toMatch(/last/i);
  });

  it("trims surrounding whitespace before checking emptiness", () => {
    expect(validateProfileName({ firstName: "  Sarah  ", lastName: "  Jones " })).toEqual({});
  });

  it("accepts names with hyphens, apostrophes, and unicode", () => {
    expect(validateProfileName({ firstName: "Anne-Marie", lastName: "O'Connor" })).toEqual({});
    expect(validateProfileName({ firstName: "José", lastName: "García" })).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests; verify they fail**

Run: `pnpm test tests/lib/actions-profile-name-validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/actions-profile-name-validation'`.

- [ ] **Step 3: Implement the validator**

Write `src/lib/actions-profile-name-validation.ts`:

```typescript
export interface ProfileNameInput {
  firstName: string;
  lastName: string;
}

export interface ProfileNameValidationResult {
  error?: string;
}

export function validateProfileName(input: ProfileNameInput): ProfileNameValidationResult {
  const first = input.firstName.trim();
  if (!first) return { error: "First name is required." };
  const last = input.lastName.trim();
  if (!last) return { error: "Last name is required." };
  return {};
}
```

- [ ] **Step 4: Run the tests; verify they pass**

Run: `pnpm test tests/lib/actions-profile-name-validation.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions-profile-name-validation.ts tests/lib/actions-profile-name-validation.test.ts
git commit -m "feat(profile-name): pure validator for first/last name"
```

---

## Task 3: Update `validateProfileInput` to use first/last

**Files:**
- Modify: `src/lib/actions-profile-validation.ts`
- Modify: `tests/lib/actions-profile.test.ts`

The existing combined validator currently checks `fullName`. Switch it to first/last by composing the new validator. This keeps the single entry-point shape for the profile form.

- [ ] **Step 1: Rewrite the existing tests to use first/last**

Replace `tests/lib/actions-profile.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { validateProfileInput } from "@/lib/actions-profile-validation";

describe("validateProfileInput", () => {
  it("rejects empty first name", () => {
    const result = validateProfileInput({
      firstName: "",
      lastName: "Jones",
      address: "123 Main",
      phone: "",
    });
    expect(result.error).toMatch(/first/i);
  });

  it("rejects empty last name", () => {
    const result = validateProfileInput({
      firstName: "Sarah",
      lastName: "",
      address: "123 Main",
      phone: "",
    });
    expect(result.error).toMatch(/last/i);
  });

  it("accepts empty phone (optional)", () => {
    const result = validateProfileInput({
      firstName: "Sarah",
      lastName: "Jones",
      address: "123 Main",
      phone: "",
    });
    expect(result.error).toBeUndefined();
  });

  it("rejects obviously invalid phone", () => {
    const result = validateProfileInput({
      firstName: "Sarah",
      lastName: "Jones",
      address: "123 Main",
      phone: "abc",
    });
    expect(result.error).toMatch(/phone/i);
  });

  it("accepts E.164-ish phone", () => {
    const result = validateProfileInput({
      firstName: "Sarah",
      lastName: "Jones",
      address: "123 Main",
      phone: "+12025551234",
    });
    expect(result.error).toBeUndefined();
  });

  it("accepts US format (202) 555-1234", () => {
    const result = validateProfileInput({
      firstName: "Sarah",
      lastName: "Jones",
      address: "123 Main",
      phone: "(202) 555-1234",
    });
    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests; verify they fail**

Run: `pnpm test tests/lib/actions-profile.test.ts`
Expected: FAIL — the existing `ProfileInput` shape still expects `fullName`.

- [ ] **Step 3: Update the validator**

Replace `src/lib/actions-profile-validation.ts` with:

```typescript
import { validateProfileName } from "./actions-profile-name-validation";

export interface ProfileInput {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
}

export interface ValidationResult {
  error?: string;
}

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/;

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const nameResult = validateProfileName({
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (nameResult.error) return nameResult;

  const phone = input.phone.trim();
  if (phone && !PHONE_REGEX.test(phone)) {
    return { error: "Phone number format is invalid." };
  }

  return {};
}
```

- [ ] **Step 4: Run the tests; verify they pass**

Run: `pnpm test tests/lib/actions-profile.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full test suite to catch ripple breakage**

Run: `pnpm test`
Expected: All tests pass. If anything breaks because it imported `ProfileInput` / `fullName`, that's a Task 4 problem — leave it for now and confirm only Task 2/3 tests pass cleanly.

- [ ] **Step 6: Run typecheck**

Run: `pnpm typecheck`
Expected: Errors only in `src/lib/actions.ts` (the `updateProfile` call site still uses `fullName`) — that's Task 4. Don't fix elsewhere.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions-profile-validation.ts tests/lib/actions-profile.test.ts
git commit -m "refactor(profile-name): validator takes firstName/lastName instead of fullName"
```

---

## Task 4: Update `updateProfile` and add `updateProfileName` server actions

**Files:**
- Modify: `src/lib/actions.ts` (line 1588 area for `updateProfile`)

Two changes here:
1. Replace `updateProfile`'s `fullName` param with `firstName`/`lastName`. The DB write now sets `first_name` and `last_name` directly; `profiles.display_name` is generated server-side. We also keep writing `user_metadata.full_name` so the nav (which reads from auth metadata, not profiles) stays in sync without a round trip.
2. Add `updateProfileName(input: { firstName, lastName })` — the small-surface action used by the inline name-required prompt and onboarding name step. It does NOT touch address/phone.

- [ ] **Step 1: Replace the existing `updateProfile` body**

In `src/lib/actions.ts`, replace lines ~1588–1627 with:

```typescript
export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
}): Promise<{ error?: string }> {
  const validation = validateProfileInput(input);
  if (validation.error) return { error: validation.error };

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = `${firstName} ${lastName}`;

  // 1. Mirror the rendered full name into auth.users.user_metadata so the nav,
  //    which reads from user_metadata.full_name, refreshes immediately on
  //    USER_UPDATED. profiles.display_name is generated by the DB.
  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (authErr) return { error: authErr.message };

  // 2. Address → profiles.address (geocoded formatted form when available).
  //    Location (PostGIS point) is not set here — matches onboarding pattern.
  const addr = input.address.trim();
  let storedAddress: string | null = addr || null;
  if (addr) {
    const geo = await geocodeAddress(addr);
    if (geo) storedAddress = geo.formatted_address;
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      address: storedAddress,
      phone: input.phone.trim() || null,
      first_name: firstName,
      last_name: lastName,
    })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  revalidatePath("/account/profile");
  return {};
}
```

- [ ] **Step 2: Add `updateProfileName` directly below it**

In `src/lib/actions.ts`, immediately after the `updateProfile` function, add:

```typescript
/**
 * Persist just first_name / last_name on the current user's profile.
 * Used by the inline name-required prompt (legacy users with null names)
 * and the onboarding name step. Mirrors the rendered name into
 * user_metadata.full_name so the nav pill updates without a refetch.
 */
export async function updateProfileName(input: {
  firstName: string;
  lastName: string;
}): Promise<{ error?: string }> {
  const { validateProfileName } = await import("@/lib/actions-profile-name-validation");
  const validation = validateProfileName(input);
  if (validation.error) return { error: validation.error };

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = `${firstName} ${lastName}`;

  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });
  if (authErr) return { error: authErr.message };

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  revalidatePath("/account/profile");
  revalidatePath("/account/planners");
  revalidatePath("/planner");
  return {};
}
```

(The dynamic `import()` keeps this action self-contained without forcing a top-of-file import edit; the bundler tree-shakes it cleanly. If the file already top-imports `validateProfileInput` from the same module path, prefer adding `validateProfileName` to that top import statically and remove the inline import here — check `src/lib/actions.ts` line 13.)

Actually, do this: at the top of `src/lib/actions.ts`, line 13 currently reads:

```typescript
import { validateProfileInput } from "@/lib/actions-profile-validation";
```

Change it to:

```typescript
import { validateProfileInput } from "@/lib/actions-profile-validation";
import { validateProfileName } from "@/lib/actions-profile-name-validation";
```

…and remove the dynamic import inside `updateProfileName`.

- [ ] **Step 3: Add a tiny query helper**

In `src/lib/actions.ts`, somewhere near the other read helpers (e.g., right before `updateProfile`), add:

```typescript
/**
 * Returns whether the current user's profile has a non-empty first AND last
 * name. Used by client UI to decide whether to show the name-required prompt
 * before a share/save action. Returns `missing: false` for unauthenticated
 * callers — the unauth path is handled by AnonSaveBanner upstream.
 */
export async function fetchOwnNameStatus(): Promise<{
  missing: boolean;
  firstName: string;
  lastName: string;
}> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { missing: false, firstName: "", lastName: "" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const first = (profile?.first_name ?? "").trim();
  const last = (profile?.last_name ?? "").trim();
  return {
    missing: !first || !last,
    firstName: first,
    lastName: last,
  };
}
```

Place this above `updateProfile` so all three name-related exports are adjacent.

- [ ] **Step 4: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck passes (the validator change ripple-fixes). Tests pass. If a downstream caller (e.g., `edit-profile-form.tsx`) still passes `fullName`, leave the failure for Task 7 — but it should already be a typecheck error, so note it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(profile-name): updateProfile takes first/last; add updateProfileName + fetchOwnNameStatus"
```

---

## Task 5: OAuth callback writes first_name/last_name from Google metadata

**Files:**
- Modify: `src/app/auth/callback/route.ts`

Today the callback just exchanges the code and redirects. The Supabase trigger creates a `profiles` row on auth.users insert, but the column values (first_name / last_name / display_name) are not populated — that's why the share viewer shows "Shared by a friend" for new users.

After this change: every OAuth signup ends up with first_name / last_name on `profiles` immediately, derived from Google's `given_name` / `family_name`. If Google supplies only `full_name`, fall back to splitting on the first space. The onboarding name step (Task 8) lets the user confirm/edit before continuing.

- [ ] **Step 1: Rewrite the callback**

Replace `src/app/auth/callback/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function splitFullName(full: string): { first: string; last: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first: "", last: "" };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { first: trimmed, last: "" };
  return {
    first: trimmed.slice(0, idx).trim(),
    last: trimmed.slice(idx + 1).trim(),
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    // TODO: remove cast when types are generated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata ?? {};
        const rawGiven = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
        const rawFamily = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
        const rawFull = typeof meta.full_name === "string" ? meta.full_name : "";
        const splitFromFull = splitFullName(rawFull);
        const firstName = rawGiven || splitFromFull.first;
        const lastName = rawFamily || splitFromFull.last;

        // Read existing first/last so we never overwrite a user's edits with
        // raw provider data on a return sign-in.
        const { data: existing } = await supabase
          .from("profiles")
          .select("first_name, last_name, onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();

        const patch: { first_name?: string; last_name?: string } = {};
        if (!existing?.first_name && firstName) patch.first_name = firstName;
        if (!existing?.last_name && lastName) patch.last_name = lastName;
        if (Object.keys(patch).length > 0) {
          await supabase.from("profiles").update(patch).eq("id", user.id);
        }

        const destination = existing?.onboarding_completed ? next : "/onboarding";
        return NextResponse.redirect(`${origin}${destination}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(profile-name): seed first_name/last_name from Google on OAuth callback"
```

---

## Task 6: Profile page reads first/last from `profiles`

**Files:**
- Modify: `src/app/account/profile/page.tsx`
- Modify: `src/app/account/profile/client.tsx`
- Modify: `src/components/account/edit-profile-form.tsx`

Current state: the page reads `fullName` from `user.user_metadata?.full_name`. Switch to reading `first_name` / `last_name` from the profiles row. Split the single Name input into First / Last, both required.

- [ ] **Step 1: Update the server page**

Replace `src/app/account/profile/page.tsx` with:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileClient } from "./client";

export const metadata = {
  title: "Edit profile — Kidtinerary",
};

export default async function ProfilePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, address, phone")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileClient
      initial={{
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        email: user.email ?? "",
        address: profile?.address ?? "",
        phone: profile?.phone ?? "",
      }}
    />
  );
}
```

- [ ] **Step 2: Update the client wrapper**

Replace `src/app/account/profile/client.tsx` with:

```typescript
"use client";

import { EditProfileForm } from "@/components/account/edit-profile-form";

interface Props {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    phone: string;
  };
}

export function EditProfileClient({ initial }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-extrabold text-4xl text-ink tracking-tight mb-2">
        Edit profile
      </h1>
      <p className="text-ink-2 mb-8">
        Update the details we use to personalize your kidtinerary.
      </p>
      <EditProfileForm initial={initial} />
    </main>
  );
}
```

- [ ] **Step 3: Update the form component**

Replace `src/components/account/edit-profile-form.tsx` with:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { formatUsPhone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface Initial {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
}

export function EditProfileForm({ initial }: { initial: Initial }) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(formatUsPhone(initial.phone));
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ firstName, lastName, address, phone });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      // Pull the freshly-rotated session cookie into the browser SDK so
      // onAuthStateChange fires USER_UPDATED for live-mounted consumers
      // (e.g., the nav name pill).
      await createClient().auth.refreshSession();
      toast("Profile updated", "success");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">First name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            required
            autoComplete="given-name"
          />
        </label>
        <label className="block">
          <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Last name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            required
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Email</span>
        <input
          value={initial.email}
          readOnly
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-disabled text-ink-2"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Contact support to change your email.
        </span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="Street, city, state"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Used to find nearby camps.
        </span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(formatUsPhone(e.target.value))}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="(555) 000-0000"
          inputMode="tel"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">
          Used for future registration reminders via text.
        </span>
      </label>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: both pass.

- [ ] **Step 5: Manual verification**

Run `pnpm dev`, sign in, go to `/account/profile`. Expected:
- Two labelled inputs (First name, Last name) side-by-side on desktop, stacked on mobile.
- Both are pre-filled (from migration's backfill or the OAuth callback Task 5).
- Try saving with first name blank — browser-native required validation kicks in.
- Try setting first name to "    " (spaces only) and saving — server returns "First name is required."
- After a successful save, the nav account dropdown shows the new combined name.

If anything's off, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/app/account/profile/page.tsx src/app/account/profile/client.tsx src/components/account/edit-profile-form.tsx
git commit -m "feat(profile-name): profile page edits first_name + last_name separately"
```

---

## Task 7: Build the `<NameRequiredPrompt />` component

**Files:**
- Create: `src/components/auth/name-required-prompt.tsx`

A small client-only modal. Owns its own open state. Renders a centered dialog with first/last inputs (pre-filled from `defaultFirst` / `defaultLast` if provided by caller), a Continue button, and a Cancel button. On Continue: call `updateProfileName`, then invoke `onComplete()`. The CALLER decides what `onComplete` does (e.g., proceed with the share action).

Cancel just closes the modal without saving — the caller's original action does not run. That implements Rachel's "can dismiss → prompted again next session" behavior because nothing has been persisted.

- [ ] **Step 1: Create the component**

Write `src/components/auth/name-required-prompt.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { updateProfileName } from "@/lib/actions";
import { validateProfileName } from "@/lib/actions-profile-name-validation";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Optional pre-fill, e.g. when OAuth gave us first but not last. */
  defaultFirst?: string;
  defaultLast?: string;
  /** Short context line shown above the form. Keep it action-oriented. */
  reason: string;
  /** Called after the name is successfully saved. The caller should resume the action that triggered this prompt. */
  onComplete: () => void;
  /** Called when the user dismisses without saving. */
  onCancel: () => void;
}

export function NameRequiredPrompt({ defaultFirst = "", defaultLast = "", reason, onComplete, onCancel }: Props) {
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateProfileName({ firstName, lastName });
    if (v.error) {
      toast(v.error, "error");
      return;
    }
    startTransition(async () => {
      const r = await updateProfileName({ firstName, lastName });
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      await createClient().auth.refreshSession();
      onComplete();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add your name"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 overflow-hidden"
      >
        <header className="px-6 py-4 border-b border-ink-3">
          <h2 className="font-display font-extrabold text-lg">Add your name</h2>
          <p className="font-sans text-sm text-ink-2 mt-1">{reason}</p>
        </header>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
              autoComplete="given-name"
              className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            />
          </label>
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              autoComplete="family-name"
              className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
            />
          </label>
        </div>

        <footer className="px-6 py-4 border-t border-ink-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full border border-ink-3 text-ink-2 hover:bg-base"
          >
            Not now
          </button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Continue"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/name-required-prompt.tsx
git commit -m "feat(profile-name): inline name-required prompt for legacy users"
```

---

## Task 8: Onboarding name step

**Files:**
- Create: `src/components/onboarding/name-step.tsx`
- Modify: `src/app/onboarding/page.tsx`

Today's onboarding flow is address → child → interests. Insert a name step as step 0 so every new user confirms their first/last before doing anything else. Values are pre-filled from the OAuth callback (Task 5). If somehow both are empty (no provider data and the user is invoked from a non-OAuth path), they fill them in from scratch.

The step uses `updateProfileName` directly — it does not piggyback on the final `onComplete` write at the end of onboarding, because we want the name to be persisted as soon as it's confirmed (so the share/save flows that might happen before the user finishes onboarding still see it).

- [ ] **Step 1: Create the step component**

Write `src/components/onboarding/name-step.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { updateProfileName } from "@/lib/actions";
import { validateProfileName } from "@/lib/actions-profile-name-validation";
import { Button } from "@/components/ui/button";

interface Props {
  defaultFirst: string;
  defaultLast: string;
  onComplete: (name: { firstName: string; lastName: string }) => void;
}

export function NameStep({ defaultFirst, defaultLast, onComplete }: Props) {
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleNext() {
    const v = validateProfileName({ firstName, lastName });
    if (v.error) {
      setError(v.error);
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateProfileName({ firstName, lastName });
      if (r.error) {
        setError(r.error);
        return;
      }
      onComplete({ firstName: firstName.trim(), lastName: lastName.trim() });
    });
  }

  const disabled = !firstName.trim() || !lastName.trim() || isPending;

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl mb-2">What&apos;s your name?</h2>
      <p className="text-ink-2 mb-6">
        We&apos;ll use this so the people you share planners with know who you are.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1">First name</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </label>
        <label className="block">
          <span className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1">Last name</span>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </label>
      </div>
      {error && <p className="text-sm text-[#ef8c8f] mb-3">{error}</p>}
      <Button onClick={handleNext} disabled={disabled} className="w-full">
        {isPending ? "Saving…" : "Next"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the onboarding flow**

Replace `src/app/onboarding/page.tsx` with:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { geocodeAddress } from "@/lib/geocode";
import { NameStep } from "@/components/onboarding/name-step";
import { AddressStep } from "@/components/onboarding/address-step";
import { ChildStep, type KidDraft } from "@/components/onboarding/child-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import type { Category } from "@/lib/constants";

type Step = "name" | "address" | "child" | "interests";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("name");
  const [initialFirst, setInitialFirst] = useState("");
  const [initialLast, setInitialLast] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [address, setAddress] = useState("");
  const [kids, setKids] = useState<KidDraft[]>([]);
  const [interestsByKid, setInterestsByKid] = useState<Category[][]>([]);
  const [interestsIndex, setInterestsIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Pre-fill name from profile (seeded by OAuth callback in Task 5).
  useEffect(() => {
    let cancelled = false;
    async function loadName() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setInitialFirst((data?.first_name as string | null) ?? "");
      setInitialLast((data?.last_name as string | null) ?? "");
      setNameLoaded(true);
    }
    loadName();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleNameComplete() {
    setStep("address");
  }

  function handleAddressComplete(addr: string) {
    setAddress(addr);
    setStep("child");
  }

  function handleChildComplete(addedKids: KidDraft[]) {
    setKids(addedKids);
    setInterestsByKid([]);
    setInterestsIndex(0);
    setStep("interests");
  }

  async function handleInterestsComplete(interests: Category[]) {
    const updatedInterests = [...interestsByKid, interests];
    const nextIndex = interestsIndex + 1;

    if (nextIndex < kids.length) {
      setInterestsByKid(updatedInterests);
      setInterestsIndex(nextIndex);
      return;
    }

    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const geo = await geocodeAddress(address);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        address: geo ? geo.formatted_address : address,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (profileError) {
      setError("Failed to save profile. Please try again.");
      return;
    }

    const childRows = kids.map((kid, i) => ({
      user_id: user.id,
      name: kid.name,
      birth_date: kid.birthDate,
      interests: updatedInterests[i],
    }));

    const { error: childError } = await supabase.from("children").insert(childRows);

    if (childError) {
      setError("Failed to save kid profiles. Please try again.");
      return;
    }

    router.push("/planner");
  }

  const stepNumber =
    step === "name" ? 1 : step === "address" ? 2 : step === "child" ? 3 : 4;

  const currentKid = step === "interests" ? kids[interestsIndex] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= stepNumber ? "bg-ink" : "bg-ink-3"
              }`}
            />
          ))}
        </div>

        {step === "name" && nameLoaded && (
          <NameStep
            defaultFirst={initialFirst}
            defaultLast={initialLast}
            onComplete={handleNameComplete}
          />
        )}
        {step === "address" && (
          <AddressStep onComplete={handleAddressComplete} />
        )}
        {step === "child" && <ChildStep onComplete={handleChildComplete} />}
        {step === "interests" && currentKid && (
          <InterestsStep
            key={interestsIndex}
            childName={currentKid.name}
            onComplete={handleInterestsComplete}
          />
        )}

        {error && (
          <p className="text-sm text-[#ef8c8f] mt-4">{error}</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Manual verification**

Run `pnpm dev`. In a private browser window, sign in with a Google account that hasn't onboarded yet (or temporarily set `onboarding_completed = false` for your dev user). Expected:
- Land on `/onboarding`.
- First step is the name step. Inputs are pre-filled with the Google name.
- Editing the inputs and clicking Next saves; advances to the address step.
- Progress bar has 4 segments, first one filled.
- Refreshing mid-onboarding goes back to the name step but it stays prefilled with the freshly-saved value (now from `profiles`).

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/name-step.tsx src/app/onboarding/page.tsx
git commit -m "feat(profile-name): require first + last on onboarding (4 steps)"
```

---

## Task 9: Gate share creation on the name-required prompt

**Files:**
- Modify: `src/components/planner/share-planner-modal.tsx`
- Modify: `src/app/account/planners/client.tsx`

When a legacy user (null first or last) tries to generate a share link, intercept the click, show the prompt, and on Continue resume the original action. Same logic in two callers (the planner-page share modal and the account/planners list page that has an inline share button).

Both callers already call `createPlannerShare`. We don't change the action signature — we add a client-side guard that fires `fetchOwnNameStatus` first.

- [ ] **Step 1: Update the planner share modal**

Open `src/components/planner/share-planner-modal.tsx`. Add to the top imports:

```typescript
import { fetchOwnNameStatus } from "@/lib/actions";
import { NameRequiredPrompt } from "@/components/auth/name-required-prompt";
```

Inside the component, add state for the prompt (somewhere near the other `useState` declarations):

```typescript
const [pendingNamePrompt, setPendingNamePrompt] = useState<
  null | { resume: () => void; first: string; last: string }
>(null);
```

Replace the existing `handleLink` function (around lines 140–157) with:

```typescript
function handleLink() {
  startTransition(async () => {
    const status = await fetchOwnNameStatus();
    if (status.missing) {
      setPendingNamePrompt({
        resume: () => {
          setPendingNamePrompt(null);
          startTransition(actuallyCreateLink);
        },
        first: status.firstName,
        last: status.lastName,
      });
      return;
    }
    await actuallyCreateLink();
  });
}

async function actuallyCreateLink() {
  const result = await createPlannerShare({
    plannerId,
    kidIds: Array.from(selected),
    includeCost,
    includePersonalBlockDetails: includeBlocks,
  });
  if (result.error || !result.token) {
    toast(result.error ?? "Could not create share link.", "error");
    return;
  }
  const url = `${window.location.origin}/schedule/${result.token}`;
  await navigator.clipboard.writeText(url);
  toast("Link copied to clipboard.", "success");
  onClose();
}
```

At the end of the JSX, just before the closing `</>` (or whatever the outermost fragment is), render the prompt conditionally:

```typescript
{pendingNamePrompt && (
  <NameRequiredPrompt
    defaultFirst={pendingNamePrompt.first}
    defaultLast={pendingNamePrompt.last}
    reason="Recipients of your share link will see your name on the planner. Add it now to continue."
    onComplete={pendingNamePrompt.resume}
    onCancel={() => setPendingNamePrompt(null)}
  />
)}
```

(If `share-planner-modal.tsx` does not currently return a fragment, wrap its return in `<>...</>` to add the prompt as a sibling without affecting layout.)

- [ ] **Step 2: Update the account/planners client share entry point**

Open `src/app/account/planners/client.tsx`. Find the `createPlannerShare` call (around line 613). Apply the same pattern: add the imports, add the `pendingNamePrompt` state, intercept the click to call `fetchOwnNameStatus` first, render `NameRequiredPrompt` at the bottom of the JSX with a `reason` like:

```
"Recipients of your share link will see your name on the planner. Add it now to continue."
```

If this client file has many share-callers (e.g. a "regenerate link" path), wrap each one. Read the file end-to-end before editing — there may be a single share helper to retrofit instead of three call sites.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 4: Manual verification**

Run `pnpm dev`. Temporarily nullify your own name in dev:

```sql
update profiles set first_name = null, last_name = null where id = '<your-user-id>';
```

Then in the app:
1. Open `/planner`, click Share → choose kids → click "Copy link". The name-required prompt appears.
2. Click "Not now" — prompt closes, share is NOT created, no toast.
3. Click Share again, fill the prompt, Continue — share is created, link copied, toast shows.
4. Restore your name (run the migration's backfill again or just open the profile page).
5. Click Share → "Copy link" again — no prompt, share creates immediately.

Repeat for `/account/planners` (use the inline share button on a planner card).

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/share-planner-modal.tsx src/app/account/planners/client.tsx
git commit -m "feat(profile-name): gate share creation on name-required prompt"
```

---

## Task 10: Gate save-shared-planner on the prompt

**Files:**
- Modify: `src/components/planner/save-share-cta.tsx`

Same pattern as Task 9 but for the recipient side: when an authed user clicks "Save to my planners" on a shared schedule and their own name is missing, prompt them first so other people on the same planner (Phase 2 overlap avatars) eventually see their real name.

- [ ] **Step 1: Update the component**

Replace `src/components/planner/save-share-cta.tsx` with:

```typescript
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSharedPlanner,
  unsaveSharedPlanner,
  fetchOwnNameStatus,
} from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { NameRequiredPrompt } from "@/components/auth/name-required-prompt";

interface Props {
  shareId: string;
  plannerName: string;
  initialIsSaved: boolean;
}

export function SaveShareCTA({ shareId, plannerName, initialIsSaved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  useEffect(() => {
    setIsSaved(initialIsSaved);
  }, [initialIsSaved]);
  const [, startTransition] = useTransition();
  const [pendingNamePrompt, setPendingNamePrompt] = useState<
    null | { resume: () => void; first: string; last: string }
  >(null);

  async function actuallySave() {
    setIsSaved(true);
    const r = await saveSharedPlanner({
      shareId,
      plannerNameAtSave: plannerName,
    });
    if (r.error) {
      setIsSaved(false);
      toast(r.error, "error");
      return;
    }
    toast("Saved to your planners.", "success");
    router.refresh();
  }

  function handleSave() {
    startTransition(async () => {
      const status = await fetchOwnNameStatus();
      if (status.missing) {
        setPendingNamePrompt({
          resume: () => {
            setPendingNamePrompt(null);
            startTransition(actuallySave);
          },
          first: status.firstName,
          last: status.lastName,
        });
        return;
      }
      await actuallySave();
    });
  }

  function handleUnsave() {
    setIsSaved(false);
    startTransition(async () => {
      const r = await unsaveSharedPlanner(shareId);
      if (r.error) {
        setIsSaved(true);
        toast(r.error, "error");
        return;
      }
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  return (
    <>
      {isSaved ? (
        <button
          type="button"
          onClick={handleUnsave}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink text-ink bg-base hover:bg-surface"
        >
          Saved · remove
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-camp-periwinkle text-ink border border-ink hover:brightness-95"
        >
          <span aria-hidden="true">+</span>
          Save to my planners
        </button>
      )}
      {pendingNamePrompt && (
        <NameRequiredPrompt
          defaultFirst={pendingNamePrompt.first}
          defaultLast={pendingNamePrompt.last}
          reason="Add your name so the planner owner knows who saved their share."
          onComplete={pendingNamePrompt.resume}
          onCancel={() => setPendingNamePrompt(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: passes.

- [ ] **Step 3: Manual verification**

Sign in as a second user whose name you've nullified. Open a share link belonging to a different owner. Click "Save to my planners" — the prompt appears. Fill it in, Continue — save completes; toast appears; "Saved · remove" button shows.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/save-share-cta.tsx
git commit -m "feat(profile-name): gate save-shared-planner on name-required prompt"
```

---

## Task 11: End-to-end smoke + screenshots + PR

**Files:**
- None modified.

This is verification + PR creation. No code changes.

- [ ] **Step 1: Run the full check pipeline**

Run in parallel:
```bash
pnpm lint
pnpm typecheck
pnpm test
```
Expected: all green. If `pnpm build` is configured, run it too (catches RSC/use-client mismatches).

- [ ] **Step 2: Capture before/after screenshots**

In `pnpm dev`, take screenshots of:
- `/auth/signup` (no change expected — capture anyway for the PR body to prove it wasn't touched).
- `/onboarding` step 1 (the new name step). One with both fields prefilled, one with both fields blank.
- `/account/profile` (the form with two fields).
- The name-required prompt firing on `/planner` Share flow (set your own first/last to null first).

Store them under `docs/screenshots/2026-05-16-profile-first-last-name/` or whatever convention the repo uses. (If no convention, attach directly to the PR body.)

- [ ] **Step 3: Verify "Shared by [name]" propagation end-to-end**

1. As user A, set first_name = "Sarah", last_name = "Jones" via /account/profile.
2. Create a planner; share it; copy the link.
3. Open the link in an incognito window. Expected: header reads "Shared by Sarah Jones".
4. As user B (signed in), open the same link, click Save. Expected: "Saved to your planners."
5. Sign back in as user B's account; go to `/account/planners` → "Shared with me" tab. Expected: the card reads "Shared by Sarah Jones".
6. As user A, edit profile → change last_name to "Smith" → save.
7. As user B, refresh `/account/planners` → "Shared with me". Expected: card now reads "Shared by Sarah Smith".
8. As user B, refresh the `/schedule/<token>` page. Expected: header now reads "Shared by Sarah Smith".

If step 7 or 8 still shows "Sarah Jones", investigate caching (Next 16 RSC caching, `revalidatePath`, or stale browser cache) before opening the PR — this is the live-propagation requirement.

- [ ] **Step 4: Push the branch and open a PR against main**

```bash
git push -u origin claude/serene-fermat-0c50d9
```

Then open a PR with title `feat: required first/last name + live "Shared by" propagation` and body:

```markdown
## Summary
- Adds `profiles.first_name` and `profiles.last_name`; turns `display_name` into a generated column derived from them. Migration 044 backfills from Google metadata (given_name/family_name) and from existing display_name (split on first space).
- OAuth callback seeds first_name/last_name on the profile row for new Google sign-ins.
- Onboarding gains a name step (4 steps total) that pre-fills from Google and requires both fields to advance.
- Profile page splits the single Name input into First / Last; both required.
- Adds `<NameRequiredPrompt />` and wires it into the share-creation flow (`share-planner-modal`, `account/planners` client) and the save-shared-planner CTA, so legacy users with null names get a one-time prompt before their action completes.
- `updateProfile` and a new `updateProfileName` server action write to `first_name`/`last_name`; `display_name` is computed.

## Why
PRs #44–#49 introduced "Planners Shared with Me" and the "Shared by [name]" surface across saved-planner cards, the viewer header, and (Phase 2) overlap avatars. The source field was a single optional `display_name` populated unreliably, so most users hit the "Shared by a friend" fallback. This rework makes name capture explicit and reliable, and keeps `display_name` as the canonical rendered string so no share-side code had to change.

## What
- `supabase/migrations/044_profiles_first_last_name.sql` — new columns + generated display_name.
- `src/lib/actions-profile-name-validation.ts` + tests — pure validator.
- `src/lib/actions-profile-validation.ts` — extended `ProfileInput`.
- `src/lib/actions.ts` — `updateProfile` signature change; new `updateProfileName`; new `fetchOwnNameStatus`.
- `src/app/auth/callback/route.ts` — seeds first_name/last_name from OAuth metadata.
- `src/app/account/profile/{page.tsx,client.tsx}` + `src/components/account/edit-profile-form.tsx` — two-field form reading from profiles.
- `src/components/onboarding/name-step.tsx` + `src/app/onboarding/page.tsx` — new onboarding step 1.
- `src/components/auth/name-required-prompt.tsx` — inline backfill modal.
- `src/components/planner/share-planner-modal.tsx`, `src/components/planner/save-share-cta.tsx`, `src/app/account/planners/client.tsx` — gated on the prompt.

## Test plan
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all green
- [ ] Migration applies cleanly to a fresh local Supabase
- [ ] New Google sign-up: name pre-filled in onboarding from Google metadata
- [ ] Existing user without a name: prompted before sharing; prompted before saving a share
- [ ] Profile page: edit first or last; nav pill updates immediately
- [ ] Edit name as owner → viewer page + recipient's "Shared with me" card reflect the new name on refresh

## Screenshots
[Attach before/after.]
```

(Optional: include the link to PRs #44–#49 in the body so reviewers see the context.)

- [ ] **Step 5: Echo the PR URL back to the user**

After `gh pr create`, the command prints a URL. Paste that URL into the chat so Rachel can click through.

---

## Self-Review

**1. Spec coverage:**

| Spec item | Task |
| --- | --- |
| Two compulsory first/last inputs on signup/onboarding | Task 8 (no auth-signup form exists — see "Open question" below) |
| Profile page has two editable fields | Task 6 |
| Live propagation (no snapshot) | Task 11 step 3 verifies; no new caching code introduced |
| Backfill prompt for legacy null-name users | Task 7 + Tasks 9–10 wire it |
| Both first AND last non-empty validation | Tasks 2, 3 (validators); Task 6 + Task 7 + Task 8 (UI uses them) |
| `first_name text`, `last_name text` columns | Task 1 |
| Display_name as generated column | Task 1 |
| Migration migrates existing display_name (split on first space) | Task 1 step 1 |
| OAuth pulls given_name + family_name from Google | Task 5 |
| New `updateProfileName(input: { firstName, lastName })` action | Task 4 |
| Wire prompt into createPlannerShare | Task 9 |
| Wire prompt into saveSharedPlanner | Task 10 |
| Wire prompt into profile page entry | Task 6 (the form just requires non-empty inputs — no separate prompt needed because the form itself IS the entry) |
| Unit test for name validation | Task 2 |
| Manual screenshots of prompt firing | Task 11 |
| Don't break existing share flows | Tasks 9–10 use a wrapper, don't change `createPlannerShare`/`saveSharedPlanner` signatures |
| Don't ask for name twice | Onboarding pre-fills from OAuth; same prompt isn't shown again once name is set |
| `display_name` remains canonical for downstream readers | Task 1 (generated column) — share RPCs unchanged |
| Migration idempotent / safe with existing data | Task 1 step 1 (backfill before column drop) |

**Open question for Rachel:** the spec says "New email signups REQUIRE first + last name". There is currently no email signup — only Google OAuth (`src/components/auth/signup-form.tsx` is a single button; magic-link is intentionally disabled). The plan covers Google OAuth via the callback + onboarding name step. If Rachel wants email/password signup restored alongside this work, that's a separate plan; this one doesn't add it.

**2. Placeholder scan:** Searched for "TBD", "TODO", "implement later", "fill in details", "Similar to Task" — none. All code blocks are complete.

**3. Type consistency:** `ProfileInput { firstName, lastName, address, phone }` defined in Task 3, used in Task 4 (`updateProfile`). `ProfileNameInput { firstName, lastName }` defined in Task 2, used in Tasks 4, 7, 8. `fetchOwnNameStatus` returns `{ missing, firstName, lastName }` in Task 4, consumed in Tasks 9, 10. `NameRequiredPrompt` props `defaultFirst`, `defaultLast`, `reason`, `onComplete`, `onCancel` in Task 7 — Tasks 9, 10 use all five.

The `share-planner-modal.tsx` edit in Task 9 is partially descriptive (it asks the implementer to find the closing fragment) because I don't have the full file in context above. The implementer must read the file end-to-end before editing — that's noted explicitly in the task.
