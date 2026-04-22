# Add Camp Flow Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-input add-camp form with explicit organization + camp-name fields (or URL path), reset the `activities`/`organizations` tables with a `source` enum, let users edit name/org/URL inline in the camp details drawer, and wire autocomplete to filter on user-submitted + shared + verified submissions.

**Architecture:** Database migration clears existing activity/org data and introduces `source` and `shared` columns. The `submitCamp` server action is rewritten to take a structured input (`{orgName?, campName?, url?, shared, activityId?}`) and to create activities/orgs without the `"User-submitted"` placeholder pattern. A new `updateActivityFields` action powers inline edits in the drawer. Autocomplete endpoints filter to `source='user' AND shared=true AND verified=true` (empty on day 1 until verification ships). The `/planner` client passes `activityId`, `registrationUrl`, and `orgId` into the drawer so inline edits can persist to the right rows.

**Tech Stack:** Next.js App Router (modified fork — always check `node_modules/next/dist/docs/` before touching framework APIs), Supabase, TypeScript, Tailwind, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-21-add-camp-flow-design.md](../specs/2026-04-21-add-camp-flow-design.md)

---

## File Map

**Create:**
- `supabase/migrations/019_add_camp_flow_overhaul.sql` — truncate + schema changes
- `src/app/api/organizations/search/route.ts` — org autocomplete endpoint
- `tests/lib/submit-camp-validation.test.ts` — unit tests for the input-validation helper

**Modify:**
- `src/lib/actions.ts` — rewrite `submitCamp`, add `updateActivityFields`, extract `validateSubmitCampInput` helper
- `src/app/api/activities/search/route.ts` — add `source='user' AND shared=true AND verified=true` filter
- `src/components/planner/add-camp-modal.tsx` — replace single input with org + camp-name + URL fields
- `src/components/planner/add-entry-modal.tsx` — update call signature passed to `AddCampModal`
- `src/lib/queries.ts` — pull `registration_url` into `fetchUserCamps`
- `src/app/planner/client.tsx` — pass `activityId`, `activityUrl`, `orgId` into drawer entry
- `src/components/planner/camp-detail-drawer.tsx` — inline-editable name / org / URL
- `src/lib/supabase/types.ts` — add `source` and `shared` types if exported

The codebase does not unit-test server actions or React components (see `tests/` — scraper and `lib/` helpers only). This plan follows that convention. Pure helpers get vitest tests; everything else is verified via type check + manual dev-server QA.

**Package manager:** `npm` (repo has `package-lock.json`).

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/019_add_camp_flow_overhaul.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/019_add_camp_flow_overhaul.sql`:

```sql
-- 019_add_camp_flow_overhaul.sql
-- Reset activities/orgs data and add source + shared columns for user-submitted funnel.

-- 1. Wipe activity-side data (pre-launch; CASCADE handles sessions → planner_entries → user_camps → scrape_jobs).
TRUNCATE activities, organizations, sessions, planner_entries, user_camps, scrape_jobs
  RESTART IDENTITY CASCADE;

-- 2. Provenance enum.
CREATE TYPE entity_source AS ENUM ('user', 'curated');

-- 3. activities: source + shared; organization_id becomes nullable for URL-only submissions.
ALTER TABLE activities
  ADD COLUMN source entity_source NOT NULL DEFAULT 'user',
  ADD COLUMN shared boolean NOT NULL DEFAULT false;
ALTER TABLE activities ALTER COLUMN organization_id DROP NOT NULL;

-- 4. organizations: source column.
ALTER TABLE organizations
  ADD COLUMN source entity_source NOT NULL DEFAULT 'user';

-- 5. Case-insensitive dedup for user-submitted orgs.
CREATE UNIQUE INDEX organizations_user_name_ci
  ON organizations (LOWER(name))
  WHERE source = 'user';
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `npx supabase db reset` (full local reset — safest for pre-launch).
Expected: migrations run in order, 019 applies cleanly, no errors.

If the repo uses `supabase db push` against a remote dev DB instead, run that. Confirm with the user before running against any shared DB.

- [ ] **Step 3: Verify schema**

Run (against the local Supabase psql):
```
\d activities
\d organizations
\dT entity_source
```

Expected: `activities` has `source entity_source NOT NULL DEFAULT 'user'`, `shared boolean NOT NULL DEFAULT false`, `organization_id uuid` (no NOT NULL). `organizations` has `source entity_source NOT NULL DEFAULT 'user'`. `entity_source` enum exists with values `user, curated`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_add_camp_flow_overhaul.sql
git commit -m "feat(db): reset activities/orgs and add source + shared columns"
```

---

## Task 2: Extract and test `validateSubmitCampInput` helper

**Files:**
- Modify: `src/lib/actions.ts` (add new exported helper at the top of the file, after existing imports)
- Create: `tests/lib/submit-camp-validation.test.ts`

Rationale: pulling validation out of the server action gives us a pure function to unit-test, and keeps the action body focused on DB calls.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/submit-camp-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateSubmitCampInput } from "@/lib/actions";

describe("validateSubmitCampInput", () => {
  it("accepts org + camp name", () => {
    const r = validateSubmitCampInput({ orgName: "YMCA", campName: "Camp Kanata", shared: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Camp Kanata");
      expect(r.value.url).toBeUndefined();
    }
  });

  it("accepts URL only", () => {
    const r = validateSubmitCampInput({ url: "https://sciencecamp.com", shared: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.url).toBe("https://sciencecamp.com");
  });

  it("accepts activityId (autocomplete hit)", () => {
    const r = validateSubmitCampInput({ activityId: "00000000-0000-0000-0000-000000000001", shared: false });
    expect(r.ok).toBe(true);
  });

  it("trims whitespace from fields", () => {
    const r = validateSubmitCampInput({ orgName: "  YMCA  ", campName: "  Kanata  ", shared: false });
    if (r.ok) {
      expect(r.value.orgName).toBe("YMCA");
      expect(r.value.campName).toBe("Kanata");
    }
  });

  it("rejects empty input", () => {
    const r = validateSubmitCampInput({ shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects org without camp name", () => {
    const r = validateSubmitCampInput({ orgName: "YMCA", shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects camp name without org", () => {
    const r = validateSubmitCampInput({ campName: "Kanata", shared: false });
    expect(r.ok).toBe(false);
  });

  it("rejects URL that does not parse", () => {
    const r = validateSubmitCampInput({ url: "not a url", shared: false });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- submit-camp-validation`
Expected: FAIL — `validateSubmitCampInput is not exported` or similar.

- [ ] **Step 3: Implement the helper**

In `src/lib/actions.ts`, add near the top (after imports, before other exports):

```ts
export type SubmitCampRawInput = {
  orgName?: string;
  campName?: string;
  url?: string;
  shared: boolean;
  activityId?: string;
};

export type SubmitCampValidated =
  | { ok: true; value: {
      orgName?: string;
      campName?: string;
      url?: string;
      shared: boolean;
      activityId?: string;
    } }
  | { ok: false; error: string };

export function validateSubmitCampInput(raw: SubmitCampRawInput): SubmitCampValidated {
  const orgName = raw.orgName?.trim() || undefined;
  const campName = raw.campName?.trim() || undefined;
  const url = raw.url?.trim() || undefined;
  const activityId = raw.activityId?.trim() || undefined;

  if (activityId) {
    return { ok: true, value: { activityId, shared: raw.shared } };
  }

  if (url) {
    try {
      new URL(url);
    } catch {
      return { ok: false, error: "That doesn't look like a valid URL." };
    }
    return { ok: true, value: { orgName, campName, url, shared: raw.shared } };
  }

  if (orgName && campName) {
    return { ok: true, value: { orgName, campName, shared: raw.shared } };
  }

  return { ok: false, error: "Enter an organization and camp name, or paste a URL." };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- submit-camp-validation`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/submit-camp-validation.test.ts src/lib/actions.ts
git commit -m "feat(actions): extract + test submitCamp input validation"
```

---

## Task 3: Rewrite `submitCamp` server action

**Files:**
- Modify: `src/lib/actions.ts` (lines 574–803 — replace the `submitCamp` function body and the `SubmitCampContext` interface)

- [ ] **Step 1: Update the `submitCamp` signature and body**

Replace lines ~574–803 in `src/lib/actions.ts` with:

```ts
// Planner Hero Redesign actions

interface SubmitCampContext {
  childId?: string;
  weekStart?: string; // YYYY-MM-DD Monday
  initialStatus?: "considering" | "waitlisted" | "registered";
}

export async function submitCamp(
  raw: SubmitCampRawInput,
  context: SubmitCampContext,
): Promise<{
  error?: string;
  jobId?: string;
  userCampId?: string;
  plannerEntryId?: string | null;
  activityId?: string;
}> {
  const validated = validateSubmitCampInput(raw);
  if (!validated.ok) return { error: validated.error };
  const input = validated.value;

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: defaultPlanner } = await supabase
    .from("planners")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  if (!defaultPlanner) return { error: "No planner found — refresh and retry" };

  let activityId: string | null = null;

  if (input.activityId) {
    // Autocomplete hit — user picked an existing shared+verified activity.
    activityId = input.activityId;
  } else {
    // New submission — resolve org + name, insert activity.
    let orgId: string | null = null;
    let activityName: string;

    if (input.orgName && input.campName) {
      // Upsert org by case-insensitive name within source='user'.
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", input.orgName)
        .eq("source", "user")
        .maybeSingle();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgErr } = await supabase
          .from("organizations")
          .insert({ name: input.orgName, source: "user" })
          .select("id")
          .single();
        if (orgErr || !newOrg) {
          console.error("submitCamp org insert error:", orgErr);
          return { error: "Failed to create organization" };
        }
        orgId = newOrg.id;
      }
      activityName = input.campName;
    } else {
      // URL-only path — placeholder name.
      activityName = "New camp";
    }

    const slug =
      activityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
      + "-" + Date.now().toString(36);

    const { data: stub, error: stubErr } = await supabase
      .from("activities")
      .insert({
        organization_id: orgId,
        name: activityName,
        slug,
        is_active: true,
        verified: false,
        source: "user",
        shared: input.shared,
        registration_url: input.url ?? null,
        categories: [],
      })
      .select("id")
      .single();

    if (stubErr || !stub) {
      console.error("submitCamp activity insert error:", stubErr);
      return { error: "Failed to create camp entry" };
    }
    activityId = stub.id;
  }

  // Upsert user_camps with next palette color.
  const { count } = await supabase
    .from("user_camps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const color = paletteColorForCampIndex(count ?? 0);

  const { error: ucUpsertErr } = await supabase
    .from("user_camps")
    .upsert(
      { user_id: user.id, activity_id: activityId, color },
      { onConflict: "user_id,activity_id", ignoreDuplicates: true }
    );
  if (ucUpsertErr) {
    console.error("submitCamp user_camps upsert error:", ucUpsertErr);
    return { error: "Failed to save camp to shortlist" };
  }

  const { data: userCamp } = await supabase
    .from("user_camps")
    .select("id, color")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .single();
  if (!userCamp) return { error: "Failed to retrieve user camp" };

  // Optionally create a planner entry if scoped to week + kid.
  let plannerEntryId: string | null = null;
  if (context.childId && context.weekStart) {
    const weekEnd = new Date(context.weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { data: matchedSession } = await supabase
      .from("sessions")
      .select("id")
      .eq("activity_id", activityId)
      .gte("starts_at", context.weekStart)
      .lte("starts_at", weekEnd.toISOString().split("T")[0])
      .limit(1)
      .maybeSingle();

    let sessionId = matchedSession?.id;

    if (!sessionId) {
      const locationId = await ensureActivityLocation(supabase, activityId);
      if (!locationId) return { error: "Could not set up camp location" };

      const { data: newSession, error: sessErr } = await supabase
        .from("sessions")
        .insert({
          activity_id: activityId,
          activity_location_id: locationId,
          starts_at: context.weekStart,
          ends_at: weekEnd.toISOString().split("T")[0],
          time_slot: "full_day",
          is_sold_out: false,
        })
        .select("id")
        .single();
      if (sessErr || !newSession) {
        console.error("submitCamp placeholder session error:", sessErr);
        return { error: "Failed to create session for week" };
      }
      sessionId = newSession.id;
    }

    const { data: entry, error: entryErr } = await supabase
      .from("planner_entries")
      .insert({
        user_id: user.id,
        planner_id: defaultPlanner.id,
        child_id: context.childId,
        session_id: sessionId,
        status: context.initialStatus ?? "considering",
        sort_order: 0,
        session_part: "full",
        days_of_week: ["mon", "tue", "wed", "thu", "fri"],
      })
      .select("id")
      .single();

    if (entryErr || !entry) {
      console.error("submitCamp planner entry insert error:", entryErr);
      return { error: "Saved camp to shortlist, but couldn't place it in that week" };
    }
    plannerEntryId = entry.id;
  }

  // Enqueue scrape job only if a URL was provided.
  let jobId: string | undefined;
  if (input.url) {
    const { data: job } = await supabase
      .from("scrape_jobs")
      .insert({
        user_id: user.id,
        input: input.url,
        context: {
          child_id: context.childId ?? null,
          week_start: context.weekStart ?? null,
          activity_id: activityId,
        },
        consent_share: input.shared,
        status: "queued",
      })
      .select("id")
      .single();
    jobId = job?.id;
  }

  revalidatePath("/planner");

  return {
    jobId,
    userCampId: userCamp.id,
    plannerEntryId,
    activityId: activityId ?? undefined,
  };
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors caused by this change. (Callers will break until Task 6 updates `AddCampModal`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(actions): rewrite submitCamp for structured input + placeholder URL path"
```

---

## Task 4: Add `updateActivityFields` server action

**Files:**
- Modify: `src/lib/actions.ts` (append after `submitCamp`)

- [ ] **Step 1: Add the action**

Append to `src/lib/actions.ts`:

```ts
export async function updateActivityFields(params: {
  activityId: string;
  name?: string;
  orgName?: string;
  url?: string | null;
}): Promise<{ error?: string; orgId?: string | null }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Auth guard: caller must own a user_camps row for this activity.
  const { data: ownership } = await supabase
    .from("user_camps")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", params.activityId)
    .maybeSingle();
  if (!ownership) return { error: "Not your camp" };

  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed) return { error: "Name can't be blank" };
    patch.name = trimmed;
  }

  if (params.url !== undefined) {
    if (params.url === null || params.url.trim() === "") {
      patch.registration_url = null;
    } else {
      const trimmed = params.url.trim();
      try {
        new URL(trimmed);
      } catch {
        return { error: "That doesn't look like a valid URL." };
      }
      patch.registration_url = trimmed;
    }
  }

  let resolvedOrgId: string | null | undefined = undefined;

  if (params.orgName !== undefined) {
    const trimmed = params.orgName.trim();
    if (!trimmed) {
      patch.organization_id = null;
      resolvedOrgId = null;
    } else {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .ilike("name", trimmed)
        .eq("source", "user")
        .maybeSingle();
      if (existingOrg) {
        patch.organization_id = existingOrg.id;
        resolvedOrgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgErr } = await supabase
          .from("organizations")
          .insert({ name: trimmed, source: "user" })
          .select("id")
          .single();
        if (orgErr || !newOrg) {
          console.error("updateActivityFields org insert error:", orgErr);
          return { error: "Failed to save organization" };
        }
        patch.organization_id = newOrg.id;
        resolvedOrgId = newOrg.id;
      }
    }
  }

  if (Object.keys(patch).length === 0) return {};

  const { error: updErr } = await supabase
    .from("activities")
    .update(patch)
    .eq("id", params.activityId);

  if (updErr) {
    console.error("updateActivityFields update error:", updErr);
    return { error: "Failed to save changes" };
  }

  revalidatePath("/planner");
  return { orgId: resolvedOrgId };
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(actions): updateActivityFields for inline camp edits"
```

---

## Task 5: Update search endpoints (autocomplete)

**Files:**
- Modify: `src/app/api/activities/search/route.ts`
- Create: `src/app/api/organizations/search/route.ts`

- [ ] **Step 1: Update activities search filter**

Replace the entire contents of `src/app/api/activities/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data } = await supabase
    .from("activities")
    .select("id, name, slug, verified, organization:organizations(id, name), activity_locations(address)")
    .ilike("name", `%${q}%`)
    .eq("is_active", true)
    .eq("source", "user")
    .eq("shared", true)
    .eq("verified", true)
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
```

- [ ] **Step 2: Create organizations search endpoint**

Create `src/app/api/organizations/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Orgs that have at least one shared+verified activity attached.
  const { data } = await supabase
    .from("organizations")
    .select("id, name, activities!inner(id)")
    .eq("source", "user")
    .eq("activities.shared", true)
    .eq("activities.verified", true)
    .ilike("name", `%${q}%`)
    .limit(8);

  const results = (data ?? []).map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }));
  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Type check and hit the endpoints**

Run: `npx tsc --noEmit`. Expected: no errors.

Start dev server (`npm run dev`) and verify:
```
curl 'http://localhost:3000/api/activities/search?q=ymca'
curl 'http://localhost:3000/api/organizations/search?q=ymca'
```
Expected: both return `{"results":[]}` (DB is empty post-truncate, no verified data yet).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/activities/search/route.ts src/app/api/organizations/search/route.ts
git commit -m "feat(api): filter autocomplete to user+shared+verified and add org search"
```

---

## Task 6: Rewrite add-camp form UI

**Files:**
- Modify: `src/components/planner/add-camp-modal.tsx` (complete rewrite)
- Modify: `src/components/planner/add-entry-modal.tsx` (no signature change — the embedded `AddCampModal` props stay the same from the outside; verify no breakage)

- [ ] **Step 1: Replace `add-camp-modal.tsx`**

Rewrite the entire file:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitCamp } from "@/lib/actions";

interface ActivityHit {
  id: string;
  name: string;
  verified: boolean;
  organization: { name: string } | null;
}

interface OrgHit {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  onSubmitted: (result: {
    jobId?: string;
    userCampId?: string;
    plannerEntryId?: string | null;
    url?: string;
  }) => void;
  embedded?: boolean;
}

export function AddCampModal({ open, onClose, scope, shareCampsDefault, onSubmitted, embedded = false }: Props) {
  const [orgName, setOrgName] = useState("");
  const [campName, setCampName] = useState("");
  const [url, setUrl] = useState("");
  const [consent, setConsent] = useState(shareCampsDefault);
  const [orgHits, setOrgHits] = useState<OrgHit[]>([]);
  const [campHits, setCampHits] = useState<ActivityHit[]>([]);
  const [pickedActivityId, setPickedActivityId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const orgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOrgName("");
      setCampName("");
      setUrl("");
      setConsent(shareCampsDefault);
      setOrgHits([]);
      setCampHits([]);
      setPickedActivityId(undefined);
      setError(null);
      setTimeout(() => orgRef.current?.focus(), 50);
    }
  }, [open, shareCampsDefault]);

  // Org autocomplete (empty until verified data exists).
  useEffect(() => {
    if (orgName.trim().length < 2) { setOrgHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(orgName.trim())}`, { cache: "no-store" });
      if (res.ok) setOrgHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [orgName]);

  // Camp-name autocomplete.
  useEffect(() => {
    if (campName.trim().length < 2) { setCampHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/activities/search?q=${encodeURIComponent(campName.trim())}`, { cache: "no-store" });
      if (res.ok) setCampHits((await res.json()).results ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [campName]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      activityId: pickedActivityId,
      orgName: orgName.trim() || undefined,
      campName: campName.trim() || undefined,
      url: url.trim() || undefined,
      shared: consent,
    };
    startTransition(async () => {
      const result = await submitCamp(payload, {
        childId: scope.childId ?? undefined,
        weekStart: scope.weekStart ?? undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.jobId) {
        fetch("/api/scrape-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: result.jobId }),
        }).catch(() => {});
      }
      onSubmitted({ ...result, url: payload.url });
      onClose();
    });
  }

  function handlePickCamp(hit: ActivityHit) {
    setCampName(hit.name);
    if (hit.organization) setOrgName(hit.organization.name);
    setPickedActivityId(hit.id);
    setCampHits([]);
  }

  function handlePickOrg(hit: OrgHit) {
    setOrgName(hit.name);
    setOrgHits([]);
  }

  const canSubmit =
    !!pickedActivityId ||
    !!url.trim() ||
    (!!orgName.trim() && !!campName.trim());

  const body = (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-1">Add a camp</h2>
      <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-4">
        Tell us who&apos;s hosting and what it&apos;s called — or drop a URL
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Organization</label>
          <input
            ref={orgRef}
            value={orgName}
            onChange={(e) => { setOrgName(e.target.value); setPickedActivityId(undefined); }}
            placeholder="YMCA of the Triangle"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          {orgHits.length > 0 && (
            <div className="mt-1 border border-ink-3 rounded-lg bg-surface overflow-hidden">
              {orgHits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handlePickOrg(h)}
                  className="w-full text-left px-3 py-2 hover:bg-ink-3/10 border-b border-ink-3/20 last:border-b-0 text-sm"
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">Camp name</label>
          <input
            value={campName}
            onChange={(e) => { setCampName(e.target.value); setPickedActivityId(undefined); }}
            placeholder="Camp Kanata"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          {campHits.length > 0 && (
            <div className="mt-1 border border-ink-3 rounded-lg bg-surface overflow-hidden">
              {campHits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handlePickCamp(h)}
                  className="w-full text-left px-3 py-2 hover:bg-ink-3/10 border-b border-ink-3/20 last:border-b-0"
                >
                  <div className="font-medium text-sm text-ink">
                    {h.name} {h.verified && <span className="font-sans text-[9px] text-[#5fc39c] uppercase tracking-wide ml-1">verified</span>}
                  </div>
                  {h.organization && (
                    <div className="font-sans text-[10px] uppercase tracking-wide text-ink-2">{h.organization.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-ink-3" />
          <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">OR</span>
          <div className="flex-1 border-t border-ink-3" />
        </div>

        <div>
          <label className="font-sans text-[10px] uppercase tracking-widest text-ink-2 block mb-1">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://sciencecamp.com/summer"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink"
            autoComplete="off"
          />
          <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-1.5">
            We&apos;ll populate the rest of the details for you.
          </p>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-ink">
            Share this camp with Kidtinerary&apos;s directory so other parents can find it. We&apos;ll verify the details before publishing.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 text-ink-2 hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="font-sans text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse hover:bg-ink/90 disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add camp"}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) return body;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative bg-base rounded-2xl shadow-xl w-full max-w-md p-6">
        {body}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify `add-entry-modal.tsx` still compiles**

The props API of `AddCampModal` is unchanged (`open/onClose/scope/shareCampsDefault/onSubmitted/embedded`). No changes needed.

Run: `npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 3: Manual dev-server verification**

Start dev server (`npm run dev`). In the planner:
1. Click any "+ Add" button — modal opens with Camp/Block tabs.
2. Switch to Camp tab. Verify three fields are visible (Organization, Camp name, URL), an OR separator between name and URL, and the consent checkbox at the bottom.
3. Try submit with nothing filled — button disabled.
4. Fill only Organization "YMCA" — button still disabled.
5. Fill Organization + Camp name → submit → camp appears in rail; card says "Camp Kanata" (or whatever you typed).
6. Open modal again, fill only URL "https://example.com" → submit → camp appears in rail labeled "New camp".
7. Verify the camp placeholder visually reads as distinct (italic/muted once Task 7 renders it; for now it'll just show "New camp").

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/add-camp-modal.tsx
git commit -m "feat(planner): split add-camp into org + name + URL fields"
```

---

## Task 7: Expose `activityId`, `activityUrl`, `orgId` to drawer + inline edit UI

**Files:**
- Modify: `src/lib/queries.ts` (fetchUserCamps — add `registration_url` + `organization_id` to the select)
- Modify: `src/app/planner/client.tsx` (drawerEntry memo — pass `activityId`, `activityUrl`, `orgId`)
- Modify: `src/components/planner/camp-detail-drawer.tsx` (add `activityId`, `orgId` to `DrawerEntry`; replace read-only header with inline-editable inputs)

- [ ] **Step 1: Update `fetchUserCamps` to include `registration_url` + `organization_id`**

In `src/lib/queries.ts`, around line 589, change:

```ts
activity:activities!inner(
  id, name, slug, verified, categories,
  organization:organizations(id, name),
  ...
)
```

to:

```ts
activity:activities!inner(
  id, name, slug, verified, categories, registration_url, organization_id,
  organization:organizations(id, name),
  ...
)
```

Also update the corresponding `UserCampWithActivity` type near the top of `queries.ts` — find the activity shape and add:
```ts
registration_url: string | null;
organization_id: string | null;
```

- [ ] **Step 2: Pass the new fields through `drawerEntry` in `client.tsx`**

In `src/app/planner/client.tsx`, update the `drawerEntry` memo (around lines 284–308). Change:

```ts
activityUrl: null as string | null,
activityDescription: null as string | null,
orgName: uc?.activity.organization?.name ?? null,
```

to:

```ts
activityId: e.session.activity.id,
orgId: uc?.activity.organization_id ?? null,
activityUrl: uc?.activity.registration_url ?? null,
activityDescription: null as string | null,
orgName: uc?.activity.organization?.name ?? null,
```

- [ ] **Step 3: Extend the `DrawerEntry` interface**

In `src/components/planner/camp-detail-drawer.tsx`, add to the `DrawerEntry` interface (around lines 35–53):

```ts
activityId: string;
orgId: string | null;
```

(Place them near `userCampId` / `activityName` / `orgName` for readability.)

- [ ] **Step 4: Add inline-editable header + URL row to the drawer**

In `src/components/planner/camp-detail-drawer.tsx`, import the new action at the top:

```ts
import {
  updateEntrySchedule,
  updateEntryPrice,
  updateEntryExtras,
  updateEntryNotes,
  updatePlannerEntryStatus,
  removePlannerEntry,
  assignCampToWeek,
  updateActivityFields,
} from "@/lib/actions";
```

Also update the existing document-level Escape listener (around lines 71–78) so pressing Escape while editing cancels the edit instead of closing the whole drawer. Change the effect's dependency array and guard:

```tsx
useEffect(() => {
  if (!open) return;
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape" && !editingField) onClose();
  }
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [open, onClose, editingField]);
```

Add editing state (above the existing persist helpers):

```ts
const [editingField, setEditingField] = useState<"name" | "org" | "url" | null>(null);
const [draftName, setDraftName] = useState("");
const [draftOrg, setDraftOrg] = useState("");
const [draftUrl, setDraftUrl] = useState("");

function startEdit(field: "name" | "org" | "url") {
  if (!local) return;
  setDraftName(local.activityName);
  setDraftOrg(local.orgName ?? "");
  setDraftUrl(local.activityUrl ?? "");
  setEditingField(field);
}

async function commitEdit() {
  if (!local || !editingField) return;
  const field = editingField;
  setEditingField(null);
  const patch: { name?: string; orgName?: string; url?: string | null } = {};
  if (field === "name" && draftName !== local.activityName) {
    patch.name = draftName;
    setLocal({ ...local, activityName: draftName });
  }
  if (field === "org" && draftOrg !== (local.orgName ?? "")) {
    patch.orgName = draftOrg;
    setLocal({ ...local, orgName: draftOrg || null });
  }
  if (field === "url" && draftUrl !== (local.activityUrl ?? "")) {
    patch.url = draftUrl || null;
    setLocal({ ...local, activityUrl: draftUrl || null });
  }
  if (Object.keys(patch).length === 0) return;
  startTransition(async () => {
    const r = await updateActivityFields({ activityId: local.activityId, ...patch });
    if (r.error) {
      alert(r.error);
    }
    onChanged();
  });
}

function cancelEdit() {
  setEditingField(null);
}
```

Then replace the `<header>` block (currently lines ~169–185) with:

```tsx
<header className="bg-surface px-5 py-4 border-b border-ink-3">
  <div className="flex items-start justify-between gap-3">
    <div className="flex-1 min-w-0">
      <div className="font-sans text-[11px] font-bold uppercase tracking-widest text-ink-2 mb-0.5">
        {kidName} · {formatWeekRange(local.weekStart)}
      </div>

      {editingField === "name" ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          className="font-display font-extrabold text-2xl text-ink leading-tight w-full bg-transparent border-b border-ink focus:outline-none"
        />
      ) : (
        <h2
          onClick={() => startEdit("name")}
          className={`font-display font-extrabold text-2xl leading-tight cursor-text ${
            local.activityName === "New camp" ? "italic text-ink-2" : "text-ink"
          }`}
        >
          {local.activityName}
        </h2>
      )}

      {local.activityName === "New camp" && (
        <div className="font-sans text-[10px] uppercase tracking-widest text-ink-2 mt-0.5">
          We&apos;re fetching details…
        </div>
      )}

      {editingField === "org" ? (
        <input
          autoFocus
          value={draftOrg}
          onChange={(e) => setDraftOrg(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          placeholder="Organization"
          className="font-sans text-[10px] uppercase tracking-wide text-ink mt-1 w-full bg-transparent border-b border-ink focus:outline-none"
        />
      ) : (
        <div
          onClick={() => startEdit("org")}
          className="font-sans text-[10px] uppercase tracking-wide text-ink-2 mt-1 cursor-text"
        >
          {local.orgName ?? "Add organization"}
          {local.verified && <span className="text-[#5fc39c]"> · verified ✓</span>}
        </div>
      )}

      {editingField === "url" ? (
        <input
          autoFocus
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          placeholder="https://…"
          className="font-sans text-xs text-ink mt-1 w-full bg-transparent border-b border-ink focus:outline-none"
        />
      ) : local.activityUrl ? (
        <div className="flex items-center gap-2 mt-1">
          <a
            href={local.activityUrl}
            target="_blank"
            rel="noreferrer"
            className="font-sans text-xs text-ink underline truncate"
          >
            {local.activityUrl}
          </a>
          <button
            type="button"
            onClick={() => startEdit("url")}
            className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink"
          >
            Edit
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => startEdit("url")}
          className="font-sans text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink mt-1"
        >
          Add a URL
        </button>
      )}
    </div>
    <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink text-lg">✕</button>
  </div>
  <div className="mt-3">
    <StatusDropdown status={local.status} onChange={persistStatus} />
  </div>
</header>
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual dev-server verification**

Start dev server. In the planner:
1. Add a camp via URL only — card shows "New camp" in italic/muted, helper text "We're fetching details…" appears.
2. Click the camp in a cell — drawer opens. Click the name ("New camp") → input appears. Type a real name, press Enter → saves, reloads with new name.
3. Click the org row → input appears. Type "YMCA" → blur → saves. Reopen drawer to confirm persistence.
4. Click "Add a URL" / existing URL → edit → blur → saves.
5. Refresh page → verify all edits persisted.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queries.ts src/app/planner/client.tsx src/components/planner/camp-detail-drawer.tsx
git commit -m "feat(planner): inline-editable camp name, org, and URL in detail drawer"
```

---

## Task 8: Final verification + push

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: all existing tests pass, plus the 8 new tests from Task 2.

- [ ] **Step 3: Push branch**

```bash
git push origin add-camp-flow-overhaul
```

Expected: branch pushed, Vercel preview deploys.

- [ ] **Step 4: Smoke test the preview**

Visit the Vercel preview URL. Run through the manual verification checklist from Tasks 6 and 7 against the deployed build. Confirm:
- Add-camp form renders all three fields + OR + consent
- Both paths submit successfully (org+name, URL-only)
- URL-only submission shows "New camp" placeholder with muted italic style
- Drawer allows editing name, org, URL and persists across refresh

- [ ] **Step 5: Open PR when satisfied** (user will drive this, not automated)

---

## Known follow-ups (not in this plan)

- Verification pipeline — without this, autocomplete stays empty by design.
- Fuzzy org/camp-name matching across submissions ("YMCA" vs "YMCA of the Triangle" vs "The Y").
- Per-user overrides for activity fields, once cross-user matching makes shared edits risky.
- Explore feature overhaul to render the new user-submitted → verified funnel.
