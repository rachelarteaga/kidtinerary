# Account Menu Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Account-menu improvements defined in [docs/superpowers/specs/2026-04-22-account-menu-updates-design.md](docs/superpowers/specs/2026-04-22-account-menu-updates-design.md): My Kids polish, a new Edit User screen, and the Sharing MVP (planner image + live link, per-camp link, shared-indicator pill, active-shares list).

**Architecture:** Three phases that merge independently. Phase 1 and 2 are small CRUD UIs over existing tables. Phase 3 extends `shared_schedules` to support planner-scoped and camp-scoped shares, reuses `PlannerCell` + `KidColumnHeader` for the read-only public view, adds client-side image rendering via `html-to-image`, and fronts everything with a share modal and shared-indicator pill.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase SSR (`@supabase/ssr`), Tailwind CSS v4, Vitest + Testing Library, `react-easy-crop` (existing avatar flow), `html-to-image` (new, image rendering).

**Branch:** `account-menu-updates` (already checked out).

**Note on Next.js:** This repo uses a recent Next.js with breaking changes from older docs. When in doubt about App Router APIs, read `node_modules/next/dist/docs/` before writing code.

**Test philosophy:** Write failing tests first for pure logic and component behavior (share-modal form state, image-rendering helper, public-view filter logic). For server actions that only wrap Supabase calls, rely on manual verification + type safety unless a subtle branch exists. For UI polish with no behavior, verify visually — document the verification step.

---

## Phase 1 — My Kids polish

Removes the deprecated "planner coming soon" copy and wires the existing avatar editor into each kid card.

### Task 1.1: Drop "planner coming soon" stub from the kid card

**Files:**
- Modify: [src/components/kids/child-card.tsx](src/components/kids/child-card.tsx:70-75)

- [ ] **Step 1: Remove the stub block**

Delete lines 70–75 of [src/components/kids/child-card.tsx](src/components/kids/child-card.tsx) (the `<div className="bg-surface/50 ...">` with "Planner coming soon").

- [ ] **Step 2: Verify the file still type-checks**

Run: `pnpm exec tsc --noEmit` (or `npx tsc --noEmit`)
Expected: no errors introduced in `child-card.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/kids/child-card.tsx
git commit -m "chore(kids): remove 'planner coming soon' stub from kid card"
```

### Task 1.2: Extend `ChildCardProps` to accept avatar data

**Files:**
- Modify: [src/components/kids/child-card.tsx](src/components/kids/child-card.tsx:10-18)
- Modify: [src/app/kids/client.tsx](src/app/kids/client.tsx) (wherever it maps children to `<ChildCard />`)

- [ ] **Step 1: Add `avatar_url` and `index` to `ChildCardProps`**

```tsx
interface ChildCardProps {
  child: {
    id: string;
    name: string;
    birth_date: string;
    interests: string[];
    avatar_url: string | null;
  };
  index: number; // for the shape fallback in KidAvatar
  onEdit: (child: { id: string; name: string; birth_date: string; interests: string[] }) => void;
}
```

- [ ] **Step 2: Update the kids client to pass `avatar_url` and `index`**

Open `src/app/kids/client.tsx`, find the `.map` that renders `<ChildCard />`, and ensure `avatar_url` and the zero-based `index` of the kid in the list are passed through.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/kids/child-card.tsx src/app/kids/client.tsx
git commit -m "refactor(kids): thread avatar_url and index through to ChildCard"
```

### Task 1.3: Render editable avatar on the kid card

**Files:**
- Modify: [src/components/kids/child-card.tsx](src/components/kids/child-card.tsx)

- [ ] **Step 1: Add imports and local state**

At the top of `child-card.tsx`, add:

```tsx
import { useRef, useEffect, useState, useTransition } from "react";
import { KidAvatar } from "@/components/planner/kid-avatar";
import { AvatarEditorModal } from "@/components/planner/avatar-editor-modal";
```

Inside the component body (above the existing `return`), add:

```tsx
const fileInputRef = useRef<HTMLInputElement>(null);
const [pickedImageUrl, setPickedImageUrl] = useState<string | null>(null);

useEffect(() => {
  return () => {
    if (pickedImageUrl) URL.revokeObjectURL(pickedImageUrl);
  };
}, [pickedImageUrl]);

function handleAvatarClick(e: React.MouseEvent) {
  e.stopPropagation();
  fileInputRef.current?.click();
}

function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  setPickedImageUrl(url);
  e.target.value = "";
}

function handleCloseEditor() {
  if (pickedImageUrl) URL.revokeObjectURL(pickedImageUrl);
  setPickedImageUrl(null);
}
```

- [ ] **Step 2: Insert the avatar button next to the name/age block**

Replace the existing `<div className="flex items-start justify-between mb-3">` block with:

```tsx
<div className="flex items-start gap-3 mb-3">
  <button
    type="button"
    onClick={handleAvatarClick}
    className="relative group flex-shrink-0"
    aria-label={`Change avatar for ${child.name}`}
  >
    <KidAvatar name={child.name} index={index} avatarUrl={child.avatar_url} size={48} />
    <span className="absolute inset-0 rounded-full bg-ink/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] uppercase tracking-wide font-sans transition-opacity">
      Edit
    </span>
  </button>
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    onChange={handleFileChange}
    className="hidden"
  />
  <div className="flex-1 min-w-0">
    <h3 className="font-display font-extrabold text-xl">{child.name}</h3>
    <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
      Age {age}
    </p>
  </div>
  <div className="flex gap-2">
    <button
      onClick={() => onEdit(child)}
      className="font-sans text-[10px] uppercase tracking-wide text-ink-2 hover:text-ink underline underline-offset-2"
    >
      Edit
    </button>
  </div>
</div>
```

- [ ] **Step 3: Render the modal after the main card div**

Inside the top-level `return`, after the outer `<div ...>...</div>` but before the closing fragment (wrap in a fragment if needed), add:

```tsx
{pickedImageUrl && (
  <AvatarEditorModal
    open={true}
    onClose={handleCloseEditor}
    childId={child.id}
    childName={child.name}
    imageUrl={pickedImageUrl}
  />
)}
```

If the component currently returns a single `<div>`, change it to a fragment:

```tsx
return (
  <>
    <div className="bg-surface rounded-2xl border border-ink-3 p-5">
      ...existing content...
    </div>
    {pickedImageUrl && (
      <AvatarEditorModal ... />
    )}
  </>
);
```

- [ ] **Step 4: Write a test that the avatar button opens the editor**

Create `tests/components/kids/child-card.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildCard } from "@/components/kids/child-card";

vi.mock("@/lib/actions", () => ({
  deleteChild: vi.fn(),
  updateChildAvatar: vi.fn(),
}));

describe("ChildCard", () => {
  const child = {
    id: "kid-1",
    name: "Maya",
    birth_date: "2018-05-01",
    interests: ["art"],
    avatar_url: null,
  };

  it("renders the kid's name and age", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.getByText("Maya")).toBeInTheDocument();
    expect(screen.getByText(/^Age \d+$/)).toBeInTheDocument();
  });

  it("does not render the deprecated 'Planner coming soon' stub", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.queryByText(/planner coming soon/i)).not.toBeInTheDocument();
  });

  it("exposes an accessible avatar button", () => {
    render(<ChildCard child={child} index={0} onEdit={() => {}} />);
    expect(screen.getByRole("button", { name: /change avatar for maya/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test tests/components/kids/child-card.test.tsx`
Expected: all three tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/kids/child-card.tsx tests/components/kids/child-card.test.tsx
git commit -m "feat(kids): editable avatar on kid card"
```

### Task 1.4: Verify manually in the browser

- [ ] **Step 1: Start the dev server and log in**

Run: `pnpm dev`

- [ ] **Step 2: Open `/kids`**

Verify: each kid card shows an avatar (shape + initial if no photo; photo if set); "Planner coming soon" is gone.

- [ ] **Step 3: Click an avatar, upload an image, save**

Verify: the modal opens, the crop editor works, saving updates the card and (after a page refresh) also the planner column header.

- [ ] **Step 4: Commit nothing — this is verification only.**

---

## Phase 2 — Edit User screen

Adds `/account/profile` with name, read-only email, address (re-geocodes), and phone.

### Task 2.1: Migration — add `profiles.phone`

**Files:**
- Create: `supabase/migrations/023_add_profile_phone.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 023_add_profile_phone.sql
-- Add optional phone number to profiles for future SMS alerts.

alter table profiles add column phone text;
```

- [ ] **Step 2: Apply locally**

Run: `npx supabase db reset` (or the project's preferred local migration command).
Expected: migration applies cleanly; the `profiles` table now has a `phone text` column.

- [ ] **Step 3: Regenerate TypeScript types**

Run: the project's type-generation command (check `package.json` or `supabase/`; common forms are `npx supabase gen types typescript --local > src/lib/supabase/types.ts`).
Expected: `Profile` row type gains `phone: string | null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/023_add_profile_phone.sql src/lib/supabase/types.ts
git commit -m "feat(db): add profiles.phone column"
```

### Task 2.2: Server action — `updateProfile`

**Files:**
- Modify: [src/lib/actions.ts](src/lib/actions.ts)
- Test: `tests/lib/actions-profile.test.ts`

- [ ] **Step 1: Write the failing test (input validation)**

Create `tests/lib/actions-profile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateProfileInput } from "@/lib/actions-profile-validation";

describe("validateProfileInput", () => {
  it("rejects empty name", () => {
    const result = validateProfileInput({ fullName: "", address: "123 Main", phone: "" });
    expect(result.error).toMatch(/name/i);
  });

  it("accepts empty phone (optional)", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "" });
    expect(result.error).toBeUndefined();
  });

  it("rejects obviously invalid phone", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "abc" });
    expect(result.error).toMatch(/phone/i);
  });

  it("accepts E.164-ish phone", () => {
    const result = validateProfileInput({ fullName: "Rachel", address: "123 Main", phone: "+12025551234" });
    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test tests/lib/actions-profile.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the validator**

Create `src/lib/actions-profile-validation.ts`:

```ts
export interface ProfileInput {
  fullName: string;
  address: string;
  phone: string;
}

export interface ValidationResult {
  error?: string;
}

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/;

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const name = input.fullName.trim();
  if (!name) return { error: "Name is required." };

  const phone = input.phone.trim();
  if (phone && !PHONE_REGEX.test(phone)) {
    return { error: "Phone number format is invalid." };
  }

  return {};
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test tests/lib/actions-profile.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Add the `updateProfile` server action**

Append to `src/lib/actions.ts`:

```ts
"use server";
// ... existing imports plus:
import { validateProfileInput } from "@/lib/actions-profile-validation";
import { geocodeAddress } from "@/lib/geocode"; // confirm path — same helper onboarding uses

export async function updateProfile(input: {
  fullName: string;
  address: string;
  phone: string;
}): Promise<{ error?: string }> {
  const validation = validateProfileInput(input);
  if (validation.error) return { error: validation.error };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // 1. Name → auth.users.user_metadata
  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: input.fullName.trim() },
  });
  if (authErr) return { error: authErr.message };

  // 2. Address → profiles.address + re-geocode profiles.location
  const addr = input.address.trim();
  const geo = addr ? await geocodeAddress(addr) : null;
  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      address: addr || null,
      location: geo ? `SRID=4326;POINT(${geo.lng} ${geo.lat})` : null,
      phone: input.phone.trim() || null,
    })
    .eq("id", user.id);
  if (profErr) return { error: profErr.message };

  revalidatePath("/account/profile");
  return {};
}
```

If `geocodeAddress` lives elsewhere or has a different signature, follow the onboarding-step call pattern verbatim. Do not invent a new helper.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions.ts src/lib/actions-profile-validation.ts tests/lib/actions-profile.test.ts
git commit -m "feat(profile): updateProfile server action with validation"
```

### Task 2.3: Create `/account/profile` page and form

**Files:**
- Create: `src/app/account/profile/page.tsx` (server component)
- Create: `src/app/account/profile/client.tsx` (form)
- Create: `src/components/account/edit-profile-form.tsx`

- [ ] **Step 1: Write the server component that loads current values**

`src/app/account/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileClient } from "./client";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("address, phone")
    .eq("id", user.id)
    .single();

  return (
    <EditProfileClient
      initial={{
        fullName: (user.user_metadata?.full_name as string | undefined) ?? "",
        email: user.email ?? "",
        address: profile?.address ?? "",
        phone: profile?.phone ?? "",
      }}
    />
  );
}
```

(Confirm the correct Supabase server client import path by grepping for existing examples: `grep -r "createClient" src/app | head`.)

- [ ] **Step 2: Write the client wrapper**

`src/app/account/profile/client.tsx`:

```tsx
"use client";

import { EditProfileForm } from "@/components/account/edit-profile-form";

interface Props {
  initial: {
    fullName: string;
    email: string;
    address: string;
    phone: string;
  };
}

export function EditProfileClient({ initial }: Props) {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="font-display font-extrabold text-3xl mb-6">Edit profile</h1>
      <EditProfileForm initial={initial} />
    </main>
  );
}
```

- [ ] **Step 3: Write the form component**

`src/components/account/edit-profile-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface Initial {
  fullName: string;
  email: string;
  address: string;
  phone: string;
}

export function EditProfileForm({ initial }: { initial: Initial }) {
  const [fullName, setFullName] = useState(initial.fullName);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ fullName, address, phone });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast("Profile updated", "success");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Name</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          required
        />
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Email</span>
        <input
          value={initial.email}
          readOnly
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-disabled text-ink-2"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">Contact support to change your email.</span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="Street, city, state"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">Used to find nearby camps.</span>
      </label>

      <label className="block">
        <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
          placeholder="+1 (555) 000-0000"
          inputMode="tel"
        />
        <span className="mt-1 block font-sans text-[10px] text-ink-2">Used for future registration reminders via text.</span>
      </label>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Write a rendering test**

Create `tests/components/account/edit-profile-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditProfileForm } from "@/components/account/edit-profile-form";

vi.mock("@/lib/actions", () => ({ updateProfile: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("EditProfileForm", () => {
  const initial = {
    fullName: "Rachel",
    email: "rachel@example.com",
    address: "123 Main St",
    phone: "+15555551234",
  };

  it("prefills name, address, and phone; shows email read-only", () => {
    render(<EditProfileForm initial={initial} />);
    expect(screen.getByDisplayValue("Rachel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123 Main St")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+15555551234")).toBeInTheDocument();

    const emailInput = screen.getByDisplayValue("rachel@example.com");
    expect(emailInput).toHaveAttribute("readonly");
  });

  it("renders the 'contact support' hint for email", () => {
    render(<EditProfileForm initial={initial} />);
    expect(screen.getByText(/contact support/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/components/account/edit-profile-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/account/profile src/components/account/edit-profile-form.tsx tests/components/account/edit-profile-form.test.tsx
git commit -m "feat(account): /account/profile edit screen"
```

### Task 2.4: Add "Edit profile" link to the Account menu

**Files:**
- Modify: [src/components/layout/auth-cluster.tsx](src/components/layout/auth-cluster.tsx:40-68)

- [ ] **Step 1: Add the link**

Inside the Account dropdown, above the "My kids" link, insert:

```tsx
<Link href="/account/profile" className="...same classes as My kids...">Edit profile</Link>
```

Use the exact same className pattern as the existing `My kids` link.

- [ ] **Step 2: Verify manually**

Run: `pnpm dev`, open the app, open the Account menu → click "Edit profile" → edit all three fields → save → refresh and confirm values persist.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/auth-cluster.tsx
git commit -m "feat(account): add 'Edit profile' link to account menu"
```

---

## Phase 3 — Sharing MVP

Extends `shared_schedules` to support planner and camp scopes, ships the share modal, recipient view, indicator pill, per-camp share, and active-shares list.

### Task 3.1: Migration — extend `shared_schedules`

**Files:**
- Create: `supabase/migrations/024_shared_schedules_scope.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 024_shared_schedules_scope.sql
-- Extend shared_schedules to support planner-scoped and camp-scoped shares.
-- Existing rows are kid-scoped; backfill to planner scope using the user's default planner.

alter table shared_schedules
  add column scope text not null default 'planner'
    check (scope in ('planner', 'camp'));

alter table shared_schedules
  add column planner_id uuid references planners(id) on delete cascade;

alter table shared_schedules
  add column camp_id uuid; -- references activity_locations(id); not enforced FK while camp identity is finalized

alter table shared_schedules
  add column kid_ids uuid[] not null default '{}';

alter table shared_schedules
  add column include_cost boolean not null default false;

alter table shared_schedules
  add column include_personal_block_details boolean not null default false;

alter table shared_schedules
  add column recommender_note text;

-- Backfill: convert legacy kid-scoped rows to planner-scoped, single-kid, using the owner's default planner.
update shared_schedules s
set
  scope = 'planner',
  planner_id = p.id,
  kid_ids = array[s.child_id]::uuid[]
from planners p
where s.child_id is not null
  and p.user_id = s.user_id
  and p.is_default = true;

-- Guardrails
create index if not exists shared_schedules_planner_idx on shared_schedules(planner_id) where scope = 'planner';
create index if not exists shared_schedules_camp_idx on shared_schedules(camp_id) where scope = 'camp';
```

- [ ] **Step 2: Apply locally**

Run: `npx supabase db reset` (or project's preferred reset command).
Expected: migration applies cleanly; existing shared_schedules rows have `scope='planner'`, populated `planner_id`, `kid_ids`.

- [ ] **Step 3: Regenerate types**

Run the project's type-generation command.
Expected: `SharedSchedule` row type gains the new columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/024_shared_schedules_scope.sql src/lib/supabase/types.ts
git commit -m "feat(db): extend shared_schedules with scope, planner/camp targets, filters"
```

### Task 3.2: Server actions — `createPlannerShare`, `createCampShare`, `revokeShare`

**Files:**
- Modify: [src/lib/actions.ts](src/lib/actions.ts)
- Test: `tests/lib/share-token.test.ts`

- [ ] **Step 1: Write failing test for the token generator**

Create `tests/lib/share-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateShareToken } from "@/lib/share-token";

describe("generateShareToken", () => {
  it("produces a 32-char url-safe token", () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("returns a different token on each call", () => {
    expect(generateShareToken()).not.toEqual(generateShareToken());
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `pnpm test tests/lib/share-token.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

Create `src/lib/share-token.ts`:

```ts
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function generateShareToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHA[bytes[i] % ALPHA.length];
  return out;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Expected: PASS.

- [ ] **Step 5: Add the server actions**

Append to `src/lib/actions.ts`:

```ts
import { generateShareToken } from "@/lib/share-token";

export async function createPlannerShare(input: {
  plannerId: string;
  kidIds: string[];
  includeCost: boolean;
  includePersonalBlockDetails: boolean;
}): Promise<{ token?: string; error?: string }> {
  if (input.kidIds.length === 0) return { error: "Select at least one kid." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const token = generateShareToken();

  const { error } = await supabase.from("shared_schedules").insert({
    user_id: user.id,
    token,
    scope: "planner",
    planner_id: input.plannerId,
    kid_ids: input.kidIds,
    include_cost: input.includeCost,
    include_personal_block_details: input.includePersonalBlockDetails,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/sharing");
  return { token };
}

export async function createCampShare(input: {
  campId: string;
  recommenderNote: string | null;
}): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const token = generateShareToken();
  const { error } = await supabase.from("shared_schedules").insert({
    user_id: user.id,
    token,
    scope: "camp",
    camp_id: input.campId,
    recommender_note: input.recommenderNote,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/sharing");
  return { token };
}

export async function revokeShare(shareId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("shared_schedules").delete().eq("id", shareId);
  if (error) return { error: error.message };
  revalidatePath("/account/sharing");
  return {};
}
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions.ts src/lib/share-token.ts tests/lib/share-token.test.ts
git commit -m "feat(share): createPlannerShare, createCampShare, revokeShare server actions"
```

### Task 3.3: Install `html-to-image` and write the image helper

**Files:**
- Modify: `package.json`
- Create: `src/lib/share/render-image.ts`
- Test: `tests/lib/share/render-image.test.ts`

- [ ] **Step 1: Install the dependency**

Run: `pnpm add html-to-image`

- [ ] **Step 2: Write failing test for filename and content-type**

Create `tests/lib/share/render-image.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildShareFilename } from "@/lib/share/render-image";

describe("buildShareFilename", () => {
  it("produces a planner-friendly png filename", () => {
    const name = buildShareFilename("Summer 2026");
    expect(name).toMatch(/^summer-2026-planner-\d{8}\.png$/);
  });

  it("sanitizes special characters", () => {
    const name = buildShareFilename("Rachel's / Summer!");
    expect(name).toMatch(/^rachel-s-summer-planner-\d{8}\.png$/);
  });
});
```

- [ ] **Step 3: Run — verify FAIL**

Expected: module not found.

- [ ] **Step 4: Implement the helper**

Create `src/lib/share/render-image.ts`:

```ts
import { toBlob } from "html-to-image";

export function buildShareFilename(plannerName: string): string {
  const slug = plannerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${slug}-planner-${date}.png`;
}

export async function sharePlannerImage(opts: {
  element: HTMLElement;
  filename: string;
}): Promise<{ shared: boolean; error?: string }> {
  let blob: Blob | null;
  try {
    blob = await toBlob(opts.element, { cacheBust: true, pixelRatio: 2 });
  } catch (e: unknown) {
    return { shared: false, error: (e as Error).message };
  }
  if (!blob) return { shared: false, error: "Could not render image." };

  const file = new File([blob], opts.filename, { type: "image/png" });

  // Prefer native share sheet when available.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My planner" });
      return { shared: true };
    } catch {
      // Fall through to download on user cancel / unsupported.
    }
  }

  // Desktop / unsupported fallback: download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { shared: true };
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/lib/share/render-image.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/share/render-image.ts tests/lib/share/render-image.test.ts
git commit -m "feat(share): html-to-image helper with Web Share API + download fallback"
```

### Task 3.4: Share planner modal

**Files:**
- Create: `src/components/planner/share-planner-modal.tsx`
- Test: `tests/components/planner/share-planner-modal.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `tests/components/planner/share-planner-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePlannerModal } from "@/components/planner/share-planner-modal";

vi.mock("@/lib/actions", () => ({ createPlannerShare: vi.fn() }));
vi.mock("@/lib/share/render-image", () => ({
  sharePlannerImage: vi.fn(),
  buildShareFilename: (n: string) => `${n}.png`,
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const kids = [
  { id: "k1", name: "Maya", avatar_url: null, index: 0 },
  { id: "k2", name: "Jonah", avatar_url: null, index: 1 },
];

describe("SharePlannerModal", () => {
  it("renders a checkbox per kid and pre-selects all", () => {
    render(
      <SharePlannerModal
        open
        plannerId="p1"
        plannerName="Summer 2026"
        kids={kids}
        onClose={() => {}}
        plannerElementRef={{ current: null }}
      />
    );
    expect(screen.getByLabelText(/maya/i)).toBeChecked();
    expect(screen.getByLabelText(/jonah/i)).toBeChecked();
  });

  it("defaults both Include opt-ins to OFF", () => {
    render(
      <SharePlannerModal
        open
        plannerId="p1"
        plannerName="Summer 2026"
        kids={kids}
        onClose={() => {}}
        plannerElementRef={{ current: null }}
      />
    );
    expect(screen.getByLabelText(/cost paid/i)).not.toBeChecked();
    expect(screen.getByLabelText(/non-activity block details/i)).not.toBeChecked();
  });

  it("disables 'Share a live link' when no kid is selected", () => {
    render(
      <SharePlannerModal
        open
        plannerId="p1"
        plannerName="Summer 2026"
        kids={kids}
        onClose={() => {}}
        plannerElementRef={{ current: null }}
      />
    );
    fireEvent.click(screen.getByLabelText(/maya/i));
    fireEvent.click(screen.getByLabelText(/jonah/i));
    const linkBtn = screen.getByRole("button", { name: /share a live link/i });
    expect(linkBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Expected: module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/planner/share-planner-modal.tsx`:

```tsx
"use client";

import { useState, useTransition, type RefObject } from "react";
import { KidAvatar } from "./kid-avatar";
import { createPlannerShare } from "@/lib/actions";
import { sharePlannerImage, buildShareFilename } from "@/lib/share/render-image";
import { useToast } from "@/components/ui/toast";

interface KidOption {
  id: string;
  name: string;
  avatar_url: string | null;
  index: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plannerId: string;
  plannerName: string;
  kids: KidOption[];
  plannerElementRef: RefObject<HTMLElement | null>;
}

export function SharePlannerModal({
  open, onClose, plannerId, plannerName, kids, plannerElementRef,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(kids.map((k) => k.id)));
  const [includeCost, setIncludeCost] = useState(false);
  const [includeBlocks, setIncludeBlocks] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!open) return null;

  const none = selected.size === 0;

  function toggleKid(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleImage() {
    const el = plannerElementRef.current;
    if (!el) return toast("Planner view not ready.", "error");
    startTransition(async () => {
      const result = await sharePlannerImage({
        element: el,
        filename: buildShareFilename(plannerName),
      });
      if (result.error) toast(result.error, "error");
      else onClose();
    });
  }

  function handleLink() {
    startTransition(async () => {
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
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${plannerName}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-md w-full border border-ink-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-ink-3">
          <h2 className="font-display font-extrabold text-lg">Share &quot;{plannerName}&quot;</h2>
          <p className="font-sans text-xs text-ink-2 mt-1">
            Send an image snapshot or a live link.
          </p>
        </header>

        <section className="px-6 py-4 border-b border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">Which kids?</p>
          <div className="space-y-1">
            {kids.map((k) => (
              <label key={k.id} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(k.id)}
                  onChange={() => toggleKid(k.id)}
                />
                <KidAvatar name={k.name} index={k.index} avatarUrl={k.avatar_url} size={24} />
                <span className="font-sans text-sm">{k.name}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="px-6 py-4 border-b border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mb-2">Include</p>
          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={includeCost} onChange={(e) => setIncludeCost(e.target.checked)} />
            <span className="font-sans text-sm">Cost paid</span>
          </label>
          <label className="flex items-start gap-2 py-1">
            <input
              type="checkbox"
              checked={includeBlocks}
              onChange={(e) => setIncludeBlocks(e.target.checked)}
              className="mt-1"
            />
            <span className="font-sans text-sm">
              Non-activity block details
              <span className="block text-xs text-ink-2">
                Off: shows as &quot;Nothing scheduled.&quot; On: shows titles.
              </span>
            </span>
          </label>
        </section>

        <footer className="px-6 py-4 bg-base/50 space-y-3">
          <div>
            <button
              type="button"
              onClick={handleImage}
              disabled={isPending}
              className="w-full px-4 py-2 rounded-lg border border-ink font-sans font-semibold disabled:opacity-50"
            >
              📷 Share image view
            </button>
            <p className="text-xs text-ink-2 mt-1">Always shows detailed view. Sent via text, email, or AirDrop.</p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleLink}
              disabled={isPending || none}
              className="w-full px-4 py-2 rounded-lg bg-ink text-white font-sans font-semibold disabled:opacity-50"
            >
              🔗 Share a live link
            </button>
            <p className="text-xs text-ink-2 mt-1">Read-only for recipient. Revocable anytime.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/components/planner/share-planner-modal.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/share-planner-modal.tsx tests/components/planner/share-planner-modal.test.tsx
git commit -m "feat(share): SharePlannerModal with kid selection and cost/block opt-ins"
```

### Task 3.5: Swap the planner toolbar to use the new modal

**Files:**
- Modify: wherever `ShareScheduleButton` is currently rendered (find via `grep`)
- Delete: [src/components/planner/share-schedule-button.tsx](src/components/planner/share-schedule-button.tsx)

- [ ] **Step 1: Locate the current usage**

Run: `grep -r "ShareScheduleButton" src`
Expected: one or two hits, likely in a planner toolbar/page.

- [ ] **Step 2: Replace with `<SharePlannerModal />` triggered by a new Share button**

In the file where `ShareScheduleButton` is rendered, add a `useState` for the modal + a button that opens it. Pass the current planner id, name, kids array, and a ref to the planner grid element (add `ref={plannerRef}` on the planner's outer grid container).

Pattern:

```tsx
const [shareOpen, setShareOpen] = useState(false);
const plannerRef = useRef<HTMLDivElement>(null);

// ...

<button onClick={() => setShareOpen(true)}>Share</button>

<SharePlannerModal
  open={shareOpen}
  onClose={() => setShareOpen(false)}
  plannerId={planner.id}
  plannerName={planner.name}
  kids={kids}
  plannerElementRef={plannerRef}
/>
```

- [ ] **Step 3: Delete the old component**

Run: `git rm src/components/planner/share-schedule-button.tsx`

- [ ] **Step 4: Verify types compile and app boots**

Run: `npx tsc --noEmit && pnpm dev`
Expected: no errors; the planner renders.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(planner): replace ShareScheduleButton with SharePlannerModal"
```

### Task 3.6: Read-only support for `KidColumnHeader`

**Files:**
- Modify: [src/components/planner/kid-column-header.tsx](src/components/planner/kid-column-header.tsx)

- [ ] **Step 1: Add a `readOnly` prop and gate the interactive affordances**

```tsx
interface Props {
  child: Child;
  index: number;
  ageYears: number;
  onRemove?: () => void;
  readOnly?: boolean;
}
```

In the render:

- If `readOnly`: do not render the drag handle button, the kebab menu, or the file input. Keep the avatar, but do NOT wrap it in the upload-trigger button — render `<KidAvatar ... />` directly.
- The avatar edit overlay (`<span className="absolute inset-0 rounded-full bg-ink/55 ...">`) must not render when `readOnly`.

- [ ] **Step 2: Verify existing usage still compiles (omitting `readOnly` defaults to false)**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/kid-column-header.tsx
git commit -m "feat(planner): readOnly prop on KidColumnHeader for public view"
```

### Task 3.7: Public shared-planner view (live link resolver)

**Files:**
- Modify: `src/app/schedule/[token]/page.tsx`
- Create: `src/components/planner/shared-planner-view.tsx`
- Create: `src/components/planner/shared-camp-detail-panel.tsx`
- Test: `tests/lib/share/apply-filters.test.ts`
- Create: `src/lib/share/apply-filters.ts`

- [ ] **Step 1: Write failing test for the filter helper**

Create `tests/lib/share/apply-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyShareFilters, type RawPlannerData } from "@/lib/share/apply-filters";

const raw: RawPlannerData = {
  kids: [
    { id: "k1", name: "Maya", avatar_url: null, birth_date: "2018-01-01", color: "#fff" },
    { id: "k2", name: "Jonah", avatar_url: null, birth_date: "2020-01-01", color: "#fff" },
  ],
  entries: [
    { id: "e1", child_id: "k1", activity_name: "Art", price_weekly_cents: 4500 },
    { id: "e2", child_id: "k2", activity_name: "Lego", price_weekly_cents: 3500 },
  ],
  blocks: [
    { id: "b1", child_id: "k1", type: "custom", title: "Family trip" },
  ],
};

describe("applyShareFilters", () => {
  it("filters kids by kid_ids", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.kids.map((k) => k.id)).toEqual(["k1"]);
    expect(out.entries.map((e) => e.id)).toEqual(["e1"]);
    expect(out.blocks.map((b) => b.id)).toEqual(["b1"]);
  });

  it("strips prices when includeCost=false", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1", "k2"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.entries.every((e) => e.price_weekly_cents === null)).toBe(true);
  });

  it("masks personal block titles when includePersonalBlockDetails=false", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: false,
    });
    expect(out.blocks[0].title).toBe("");
  });

  it("preserves personal block titles when includePersonalBlockDetails=true", () => {
    const out = applyShareFilters(raw, {
      kidIds: ["k1"], includeCost: false, includePersonalBlockDetails: true,
    });
    expect(out.blocks[0].title).toBe("Family trip");
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

- [ ] **Step 3: Implement the filter helper**

Create `src/lib/share/apply-filters.ts`:

```ts
export interface RawPlannerData {
  kids: { id: string; name: string; avatar_url: string | null; birth_date: string; color: string }[];
  entries: { id: string; child_id: string; activity_name: string; price_weekly_cents: number | null }[];
  blocks: { id: string; child_id: string; type: string; title: string }[];
}

export interface ShareFilters {
  kidIds: string[];
  includeCost: boolean;
  includePersonalBlockDetails: boolean;
}

export function applyShareFilters(raw: RawPlannerData, f: ShareFilters): RawPlannerData {
  const allowedKids = new Set(f.kidIds);
  return {
    kids: raw.kids.filter((k) => allowedKids.has(k.id)),
    entries: raw.entries
      .filter((e) => allowedKids.has(e.child_id))
      .map((e) => ({ ...e, price_weekly_cents: f.includeCost ? e.price_weekly_cents : null })),
    blocks: raw.blocks
      .filter((b) => allowedKids.has(b.child_id))
      .map((b) => ({ ...b, title: f.includePersonalBlockDetails ? b.title : "" })),
  };
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Write `SharedCampDetailPanel` (5 fields)**

Create `src/components/planner/shared-camp-detail-panel.tsx`:

```tsx
"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  camp: {
    org: string;
    name: string;
    location: string;
    url: string | null;
    about: string;
    weeklyCostCents?: number | null; // only passed when includeCost is true
  };
}

export function SharedCampDetailPanel({ open, onClose, camp }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl max-w-sm w-full border border-ink-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">{camp.org}</p>
          <h3 className="font-display font-extrabold text-lg mt-1">{camp.name}</h3>
          {typeof camp.weeklyCostCents === "number" && (
            <p className="font-sans text-xs text-ink-2 mt-1">${Math.round(camp.weeklyCostCents / 100)} / week</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">Location</p>
          <p className="font-sans text-sm mt-1 whitespace-pre-line">{camp.location}</p>
        </div>
        {camp.url && (
          <div className="px-5 py-3 border-t border-ink-3">
            <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">Link</p>
            <a
              href={camp.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-sm text-[#2a6a9e] hover:underline"
            >
              {camp.url.replace(/^https?:\/\//, "").replace(/\/$/, "")} →
            </a>
          </div>
        )}
        <div className="px-5 py-3 border-t border-ink-3">
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2 font-semibold">About</p>
          <p className="font-sans text-sm mt-1">{camp.about}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `SharedPlannerView` that reuses `PlannerCell` + `KidColumnHeader` in read-only mode**

Create `src/components/planner/shared-planner-view.tsx`. Mirror the layout of the owner's planner grid (week rows × kid columns) but render `<KidColumnHeader ... readOnly />` and `<PlannerCell ... onAddClick={() => {}} onEntryClick={openCampDetail} />`. Persist the Detail/Simple toggle state to `localStorage` under the key `share-view-mode:${token}` (prop `token` passed from the page).

Use `applyShareFilters` on the data before passing it down.

Required structure:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { PlannerCell } from "./planner-cell";
import { KidColumnHeader } from "./kid-column-header";
import { SharedCampDetailPanel } from "./shared-camp-detail-panel";
import { applyShareFilters, type RawPlannerData } from "@/lib/share/apply-filters";

interface Props {
  token: string;
  plannerName: string;
  ownerDisplayName: string;
  raw: RawPlannerData;
  weeks: { weekStart: string; weekStartDate: string }[]; // serialized
  plannerStart: string;
  plannerEnd: string;
  filters: { kidIds: string[]; includeCost: boolean; includePersonalBlockDetails: boolean };
}

export function SharedPlannerView(props: Props) {
  const filtered = useMemo(() => applyShareFilters(props.raw, props.filters), [props.raw, props.filters]);

  const storageKey = `share-view-mode:${props.token}`;
  const [viewMode, setViewMode] = useState<"detail" | "simple">("detail");
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "detail" || saved === "simple") setViewMode(saved);
  }, [storageKey]);

  const [openCampId, setOpenCampId] = useState<string | null>(null);

  // ... derive timelineEntries, legendRows, consideringChips per (child, week) from `filtered.entries`
  // Reuse whatever helpers the owner's planner uses to build those rows — import them, don't duplicate.

  return (
    <main className="max-w-6xl mx-auto p-4">
      <header className="flex items-center justify-between py-3 border-b border-ink-3">
        <div>
          <h1 className="font-display font-extrabold text-xl">
            {props.plannerName} · {props.ownerDisplayName}&apos;s planner
          </h1>
          <p className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Shared · view-only</p>
        </div>
        <div className="inline-flex bg-base border border-ink rounded-full p-0.5 text-xs font-semibold">
          <button
            type="button"
            className={`px-3 py-1 rounded-full ${viewMode === "detail" ? "bg-ink text-white" : "text-ink-2"}`}
            onClick={() => { setViewMode("detail"); window.localStorage.setItem(storageKey, "detail"); }}
          >
            Detailed
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-full ${viewMode === "simple" ? "bg-ink text-white" : "text-ink-2"}`}
            onClick={() => { setViewMode("simple"); window.localStorage.setItem(storageKey, "simple"); }}
          >
            Simple
          </button>
        </div>
      </header>

      {/* Grid: week label | kid columns. Render rows by reusing PlannerCell. */}
      {/* ... */}

      <SharedCampDetailPanel
        open={openCampId !== null}
        onClose={() => setOpenCampId(null)}
        camp={/* lookup by openCampId */ { org: "", name: "", location: "", url: null, about: "" }}
      />
    </main>
  );
}
```

The grid-rendering code depends on helpers from the existing matrix/cell module — the implementer should read [src/components/planner/matrix.tsx](src/components/planner/matrix.tsx) and [src/components/planner/planner-cell.tsx](src/components/planner/planner-cell.tsx) to see how `timelineEntries`, `legendRows`, and `consideringChips` are derived, then call those same helpers with the filtered data.

- [ ] **Step 7: Update `src/app/schedule/[token]/page.tsx` to route based on scope**

Load the `shared_schedules` row by token. Based on `scope`:
- `planner`: load the planner, kids, entries, blocks; render `<SharedPlannerView ... />`.
- `camp`: redirect/render the public camp detail page (Task 3.10).
- Legacy rows (just `child_id` populated, scope missing) were backfilled in Task 3.1. If any unbackfilled row exists, treat as 404.

- [ ] **Step 8: Run the tests**

Run: `pnpm test`
Expected: new tests PASS; existing tests still PASS.

- [ ] **Step 9: Verify manually**

Start `pnpm dev`. From a logged-in user: create a planner share via the new modal (all kids, cost/blocks off), copy the link, open in an incognito window. Verify:
- You see kid columns with avatars
- Camp rows show name + org + status pill + color dot
- Toggle flips between Detailed and Simple
- No "Add" buttons, no drag handles, no kebab menus
- Personal blocks render as "NOTHING SCHEDULED"

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(share): public planner view with recipient-side detail/simple toggle"
```

### Task 3.8: Shared-indicator pill

**Files:**
- Create: `src/components/planner/shared-indicator-pill.tsx`
- Modify: [src/components/planner/planner-title.tsx](src/components/planner/planner-title.tsx)
- Modify: wherever `planner-title` is rendered (pass active-share count)

- [ ] **Step 1: Write failing test**

Create `tests/components/planner/shared-indicator-pill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SharedIndicatorPill } from "@/components/planner/shared-indicator-pill";

describe("SharedIndicatorPill", () => {
  it("renders nothing when count is 0", () => {
    const { container } = render(<SharedIndicatorPill count={0} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Shared' when count >= 1", () => {
    render(<SharedIndicatorPill count={1} onClick={() => {}} />);
    expect(screen.getByText(/shared/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Create `src/components/planner/shared-indicator-pill.tsx`:

```tsx
"use client";

interface Props {
  count: number;
  onClick: () => void;
}

export function SharedIndicatorPill({ count, onClick }: Props) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-[#eef9f0] text-[#147a30] hover:bg-[#dcf2e0]"
      aria-label={`Planner is shared with ${count} active link${count === 1 ? "" : "s"}. Tap to manage.`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#2cb14a]" />
      Shared
    </button>
  );
}
```

- [ ] **Step 4: Wire into `PlannerTitle`**

Modify `src/components/planner/planner-title.tsx` to accept `sharesActiveCount: number` and `onSharesClick: () => void`, and render `<SharedIndicatorPill count={sharesActiveCount} onClick={onSharesClick} />` next to the planner name.

- [ ] **Step 5: Wire active-shares count into the planner page**

In the planner page (server component): count shared_schedules for the current planner — `select count(*) from shared_schedules where planner_id = :id and user_id = auth.uid()`. Pass the number down to `PlannerTitle`. For the click handler, open the `/account/sharing` page for now (bottom-sheet-on-tap is a nice-to-have from the spec; inline drawer is fine for MVP if simpler).

- [ ] **Step 6: Run tests + verify visually**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(planner): always-visible 'Shared' pill next to planner name"
```

### Task 3.9: `ShareCampModal` and per-camp share trigger

**Files:**
- Create: `src/components/planner/share-camp-modal.tsx`
- Modify: [src/components/planner/camp-detail-drawer.tsx](src/components/planner/camp-detail-drawer.tsx) (add a "Share camp" action)

- [ ] **Step 1: Write failing test**

Create `tests/components/planner/share-camp-modal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareCampModal } from "@/components/planner/share-camp-modal";

vi.mock("@/lib/actions", () => ({
  createCampShare: vi.fn(async () => ({ token: "tkn" })),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("ShareCampModal", () => {
  it("renders a note field", () => {
    render(<ShareCampModal open campId="c1" campName="Lego" onClose={() => {}} />);
    expect(screen.getByLabelText(/recommender note/i)).toBeInTheDocument();
  });

  it("enables the copy-link button at mount (no kids to select)", () => {
    render(<ShareCampModal open campId="c1" campName="Lego" onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState, useTransition } from "react";
import { createCampShare } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  campId: string;
  campName: string;
}

export function ShareCampModal({ open, onClose, campId, campName }: Props) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  if (!open) return null;

  function handleCopy() {
    startTransition(async () => {
      const result = await createCampShare({
        campId,
        recommenderNote: note.trim() || null,
      });
      if (result.error || !result.token) {
        toast(result.error ?? "Could not create link.", "error");
        return;
      }
      const url = `${window.location.origin}/schedule/${result.token}`;
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard.", "success");
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-sm w-full border border-ink-3 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-ink-3">
          <h2 className="font-display font-extrabold text-lg">Share &quot;{campName}&quot;</h2>
          <p className="font-sans text-xs text-ink-2 mt-1">The recipient will see the camp&apos;s details page.</p>
        </header>
        <section className="px-5 py-4 border-b border-ink-3">
          <label className="block">
            <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">Recommender note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Great for 5yo artists"
              className="mt-1 w-full rounded-lg border border-ink-3 px-3 py-2 bg-surface"
              rows={2}
              maxLength={280}
            />
          </label>
        </section>
        <footer className="px-5 py-3 bg-base/50">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isPending}
            className="w-full px-4 py-2 rounded-lg bg-ink text-white font-sans font-semibold disabled:opacity-50"
          >
            🔗 Copy link
          </button>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add a "Share camp" button to the camp detail drawer**

In `src/components/planner/camp-detail-drawer.tsx`, add a button that sets a local `shareOpen` state and renders `<ShareCampModal ... />`. Resolve `campId` from whichever identifier the drawer already has (likely `activity_location_id`).

- [ ] **Step 5: Run tests + manual verification**

Log in, open a camp drawer, click "Share camp," add a note, copy link. Paste into an incognito window; verify you land on the camp detail page.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(share): per-camp share modal with optional recommender note"
```

### Task 3.10: Camp detail page — unauthenticated-friendly + recommender note

**Files:**
- Find and modify: the existing camp detail route (`src/app/camps/[id]/...` or equivalent; `grep -r "camp-detail" src/app` to locate)

- [ ] **Step 1: Locate the public camp detail page**

Run: `grep -rl "activity_locations" src/app`
Read the page.tsx to see if it currently requires auth.

- [ ] **Step 2: Remove the auth guard (or skip it) for the camp detail route**

The camp data is already public-readable per existing RLS. If the page currently redirects unauthenticated users, remove/skip the redirect on this route only.

- [ ] **Step 3: Support an optional share-token param**

If the URL is `/camps/[id]?share=<token>`, resolve the `shared_schedules` row with `scope='camp'` and matching `camp_id`, then render the `recommender_note` (if any) as a small quote block at the top of the page:

```tsx
{recommenderNote && (
  <blockquote className="my-4 p-3 rounded-lg bg-base border-l-0 border border-ink-3 font-sans text-sm italic text-ink-2">
    &ldquo;{recommenderNote}&rdquo;
  </blockquote>
)}
```

(Per project memory — no colored side-borders.)

- [ ] **Step 4: Verify manually in an incognito window**

Open the shared-camp link; confirm the recommender note renders, the camp details load, no auth redirect.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(camps): public-friendly camp detail page with recommender note"
```

### Task 3.11: `/account/sharing` — active-shares list

**Files:**
- Modify: `src/app/account/sharing/page.tsx` (replace "coming soon")
- Create: `src/app/account/sharing/client.tsx`
- Create: `src/components/account/active-shares-list.tsx`

- [ ] **Step 1: Server component loads all shares for the user**

```tsx
// src/app/account/sharing/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ActiveSharesClient } from "./client";

export default async function SharingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: shares } = await supabase
    .from("shared_schedules")
    .select("id, token, scope, planner_id, camp_id, kid_ids, recommender_note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Hydrate planner / camp names so the list is readable.
  // ... join or separate fetch, then pass enriched rows to client.

  return <ActiveSharesClient shares={shares ?? []} />;
}
```

- [ ] **Step 2: Client + list component render the two groups**

`src/components/account/active-shares-list.tsx` accepts an array of enriched share rows (each with a friendly title, either planner name or camp name). Groups by `scope`; renders each row with:
- Title
- Created date
- "Copy link" button (copies `window.location.origin + /schedule/ + token`)
- "Stop sharing" button (calls `revokeShare(id)`)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(account): /account/sharing active-shares list with revoke"
```

### Task 3.12: Final verification pass

- [ ] **Step 1: Full test run**

Run: `pnpm test`
Expected: all tests green.

- [ ] **Step 2: Type check and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 3: Manual verification checklist**

Run: `pnpm dev`. Working through the checklist from the spec's verification plan:
- [ ] Edit profile: name round-trips; phone round-trips; address re-geocodes.
- [ ] Kid avatar: edits from `/kids` and the planner column header update the same row; both surfaces re-render.
- [ ] Share planner → live link: recipient sees only selected kids; cost hidden unless opted in; personal blocks masked unless opted in; Detail/Simple toggle works; revoke kills the link.
- [ ] Share planner → image: PNG renders; native share sheet on mobile / download on desktop; always detailed view.
- [ ] Per-camp share: link opens camp detail page unauthenticated; recommender note renders.
- [ ] Shared-indicator pill: appears when ≥1 share active; tap goes to `/account/sharing`; revoke removes the pill.
- [ ] `/account/sharing`: lists planner + camp shares grouped; revoke deletes the row.

- [ ] **Step 4: No commit — verification only.**

### Task 3.13: Push and open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin account-menu-updates
```

- [ ] **Step 2: Open PR**

Use `gh pr create` with a summary referencing the spec. Let CI run before merging.

---

## Self-review notes

**Spec coverage:**
- My Kids avatar editing → Tasks 1.2–1.4.
- Remove "planner coming soon" → Task 1.1.
- `/account/profile` edit screen → Tasks 2.1–2.4.
- `profiles.phone` migration → Task 2.1.
- Name via `auth.users.user_metadata` → Task 2.2.
- Share modal (planner) + image + live link → Tasks 3.2–3.5.
- Public shared view reuses PlannerCell + KidColumnHeader → Tasks 3.6–3.7.
- Detail/Simple recipient toggle → Task 3.7 step 6.
- NOTHING SCHEDULED treatment → covered by `applyShareFilters` + existing `BlockCard` dotted fill when `title === ""`.  *Implementer check:* confirm `BlockCard` (or whatever renders masked blocks in the shared view) shows the "NOTHING SCHEDULED" label treatment from the spec. If it doesn't, add a small prop override or a dedicated "empty" card component in Task 3.7.
- Camp detail panel (5 fields) → Task 3.7 step 5.
- Shared pill → Task 3.8.
- Per-camp share link + recommender note → Tasks 3.9–3.10.
- Active-shares list + revoke → Task 3.11.
- `shared_schedules` schema extension + backfill → Task 3.1.

**Known implementer-decision points (flagged, not placeholder):**
- `camp_id` canonical identifier — the plan assumes `activity_locations.id`; implementer confirms during Task 3.1 by grepping the camp detail route.
- Exact helpers used to derive `timelineEntries` / `legendRows` / `consideringChips` — plan tells the implementer to read the matrix/planner-cell code and reuse helpers; this keeps the public view a thin shell.

---

## Follow-ups (out of scope for this plan)

1. Drop `shared_schedules.child_id` once no callers remain.
2. Drop unused `profiles.share_camps_default` boolean.
3. My Planners screen (separate spec + plan).
4. Bottom-sheet micro-interaction for the "Shared" pill (currently links to `/account/sharing`).
