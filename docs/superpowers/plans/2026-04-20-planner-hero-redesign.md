# Planner Hero Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the planner as the primary entry point — weeks × kids matrix with family-level "My Camps" shortlist, optimistic-async camp adding by name or URL, non-camp blocks, and per-kid-independent states (considering / waitlisted / registered).

**Architecture:** Next.js App Router with Supabase. New schema (user_camps, planner_blocks, scrape_jobs) + modified (children, planner_entries, activities, profiles). Server actions for mutations, API routes for async polling. Matrix is a client component over SSR data. Scraping runs server-side on demand and is polled from the client. No realtime subscriptions (polling is simpler and bounded).

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (Postgres + Auth + Storage), Tailwind, @dnd-kit (existing), vitest + jsdom, Anthropic Claude (existing scraper LLM).

**Spec:** [2026-04-20-planner-hero-redesign-design.md](../specs/2026-04-20-planner-hero-redesign-design.md)

---

## Phase 1 — Foundation: schema, queries, actions, scraper confidence

### Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/010_planner_hero_schema.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 010_planner_hero_schema.sql
-- Planner hero redesign: new tables, enum rename, drop favorites.

-- 1. Drop favorites (no production users).
drop table if exists favorites cascade;

-- 2. Rename planner_entries status enum.
-- Create new enum, cast existing rows, drop old.
create type planner_entry_status_new as enum ('considering', 'waitlisted', 'registered');

alter table planner_entries
  alter column status drop default;

alter table planner_entries
  alter column status type planner_entry_status_new
  using (case status::text
    when 'penciled_in' then 'considering'::planner_entry_status_new
    when 'locked_in' then 'registered'::planner_entry_status_new
    when 'cancelled' then null  -- 'cancelled' rows are deleted below
  end);

-- Drop rows that were 'cancelled' (status is now null after cast).
delete from planner_entries where status is null;

alter table planner_entries
  alter column status set not null,
  alter column status set default 'considering'::planner_entry_status_new;

drop type planner_entry_status;
alter type planner_entry_status_new rename to planner_entry_status;

-- 3. Children: add color, sort_order, avatar_url.
alter table children
  add column if not exists color text not null default '#f4b76f',
  add column if not exists sort_order int not null default 0,
  add column if not exists avatar_url text;

-- 4. Profiles: add share_camps_default.
alter table profiles
  add column if not exists share_camps_default boolean not null default true;

-- 5. Activities: add verified flag.
alter table activities
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz;

-- 6. user_camps: family-level shortlist.
create table user_camps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

alter table user_camps enable row level security;

create policy "Users read own shortlist"
  on user_camps for select using (auth.uid() = user_id);
create policy "Users insert own shortlist"
  on user_camps for insert with check (auth.uid() = user_id);
create policy "Users delete own shortlist"
  on user_camps for delete using (auth.uid() = user_id);

-- 7. planner_blocks: non-camp blocks.
create type planner_block_type as enum ('school', 'travel', 'at_home', 'other');

create table planner_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type planner_block_type not null,
  title text not null,
  emoji text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table planner_blocks enable row level security;

create policy "Users read own blocks"
  on planner_blocks for select using (auth.uid() = user_id);
create policy "Users insert own blocks"
  on planner_blocks for insert with check (auth.uid() = user_id);
create policy "Users update own blocks"
  on planner_blocks for update using (auth.uid() = user_id);
create policy "Users delete own blocks"
  on planner_blocks for delete using (auth.uid() = user_id);

-- 8. planner_block_kids: which kids a block applies to.
create table planner_block_kids (
  block_id uuid not null references planner_blocks(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  primary key (block_id, child_id)
);

alter table planner_block_kids enable row level security;

create policy "Users read own block-kid joins"
  on planner_block_kids for select using (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );
create policy "Users insert own block-kid joins"
  on planner_block_kids for insert with check (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );
create policy "Users delete own block-kid joins"
  on planner_block_kids for delete using (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );

-- 9. scrape_jobs: async scrape queue.
create type scrape_job_status as enum ('queued', 'running', 'resolved', 'failed');
create type scrape_confidence as enum ('high', 'partial', 'ambiguous', 'none');

create table scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  input text not null,
  context jsonb not null default '{}'::jsonb,
  status scrape_job_status not null default 'queued',
  activity_id uuid references activities(id) on delete set null,
  confidence scrape_confidence,
  candidates jsonb,
  consent_share boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table scrape_jobs enable row level security;

create policy "Users read own scrape jobs"
  on scrape_jobs for select using (auth.uid() = user_id);
create policy "Users insert own scrape jobs"
  on scrape_jobs for insert with check (auth.uid() = user_id);

-- 10. Retire submit_queue (renamed from favorites flow; not relevant now).
-- (Skipped — no submit_queue table existed.)

-- Indexes.
create index if not exists idx_user_camps_user on user_camps(user_id);
create index if not exists idx_planner_blocks_user_dates on planner_blocks(user_id, start_date, end_date);
create index if not exists idx_scrape_jobs_user_status on scrape_jobs(user_id, status);
```

- [ ] **Step 2: Apply migration to local Supabase (if linked) or run in Supabase SQL editor**

For hosted Supabase: paste into dashboard SQL editor and run.

Expected: all statements succeed, no errors. Verify with:
```sql
\dt user_camps planner_blocks planner_block_kids scrape_jobs
select column_name from information_schema.columns where table_name = 'children' and column_name in ('color', 'sort_order', 'avatar_url');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_planner_hero_schema.sql
git commit -m "feat(db): planner hero schema migration

- Add user_camps, planner_blocks, planner_block_kids, scrape_jobs tables
- Rename planner_entries.status enum (penciled_in→considering, locked_in→registered)
- Drop cancelled status; use delete instead
- Add children.color/sort_order/avatar_url
- Add activities.verified flag
- Add profiles.share_camps_default
- Drop favorites table"
```

---

### Task 2: Update Supabase type definitions

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Read existing types**

```bash
head -50 src/lib/supabase/types.ts
```

The file defines Database schema. Since types are hand-maintained (per the existing `(as any)` casts), update or extend them to reflect the new schema.

- [ ] **Step 2: Add new table types**

Append to the Database interface in `src/lib/supabase/types.ts`:

```ts
// Planner Hero Redesign additions
export type PlannerEntryStatus = "considering" | "waitlisted" | "registered";
export type PlannerBlockType = "school" | "travel" | "at_home" | "other";
export type ScrapeJobStatus = "queued" | "running" | "resolved" | "failed";
export type ScrapeConfidence = "high" | "partial" | "ambiguous" | "none";

export interface UserCampRow {
  id: string;
  user_id: string;
  activity_id: string;
  created_at: string;
}

export interface PlannerBlockRow {
  id: string;
  user_id: string;
  type: PlannerBlockType;
  title: string;
  emoji: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface PlannerBlockKidRow {
  block_id: string;
  child_id: string;
}

export interface ScrapeJobRow {
  id: string;
  user_id: string;
  input: string;
  context: Record<string, unknown>;
  status: ScrapeJobStatus;
  activity_id: string | null;
  confidence: ScrapeConfidence | null;
  candidates: Array<{ activity_id: string; name: string; score: number }> | null;
  consent_share: boolean;
  created_at: string;
  resolved_at: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(types): add planner hero types"
```

---

### Task 3: Query helpers for new tables

**Files:**
- Modify: `src/lib/queries.ts` (append to end)

- [ ] **Step 1: Add query for user_camps**

Append to `src/lib/queries.ts`:

```ts
import type { UserCampRow, PlannerBlockRow, ScrapeJobRow } from "@/lib/supabase/types";

export interface UserCampWithActivity {
  id: string;
  created_at: string;
  activity: {
    id: string;
    name: string;
    slug: string;
    verified: boolean;
    categories: string[];
    organization: { id: string; name: string } | null;
    activity_locations: { id: string; address: string; location_name: string | null }[];
    price_options: { id: string; label: string; price_cents: number; price_unit: string }[];
    sessions: {
      id: string;
      starts_at: string;
      ends_at: string;
      time_slot: string;
      hours_start: string | null;
      hours_end: string | null;
    }[];
  };
  plannerEntryCount: number;
}

export async function fetchUserCamps(userId: string): Promise<UserCampWithActivity[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("user_camps")
    .select(`
      id, created_at,
      activity:activities!inner(
        id, name, slug, verified, categories,
        organization:organizations(id, name),
        activity_locations(id, address, location_name),
        price_options(id, label, price_cents, price_unit),
        sessions(id, starts_at, ends_at, time_slot, hours_start, hours_end)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchUserCamps error:", error);
    return [];
  }

  // Get planner entry counts per activity_id for this user
  const activityIds = (data ?? []).map((r: any) => r.activity.id);
  if (activityIds.length === 0) return [];

  const { data: counts } = await supabase
    .from("planner_entries")
    .select("session:sessions(activity_id)", { count: "exact" })
    .eq("user_id", userId)
    .in("session.activity_id", activityIds);

  const countMap: Record<string, number> = {};
  for (const row of (counts ?? []) as any[]) {
    const aid = row.session?.activity_id;
    if (aid) countMap[aid] = (countMap[aid] ?? 0) + 1;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    created_at: row.created_at,
    activity: row.activity,
    plannerEntryCount: countMap[row.activity.id] ?? 0,
  }));
}
```

- [ ] **Step 2: Add query for planner_blocks**

Append:

```ts
export interface PlannerBlockWithKids extends PlannerBlockRow {
  child_ids: string[];
}

export async function fetchPlannerBlocks(userId: string): Promise<PlannerBlockWithKids[]> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("planner_blocks")
    .select(`
      id, user_id, type, title, emoji, start_date, end_date, created_at,
      planner_block_kids(child_id)
    `)
    .eq("user_id", userId)
    .order("start_date", { ascending: true });

  if (error) {
    console.error("fetchPlannerBlocks error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    emoji: row.emoji,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
    child_ids: (row.planner_block_kids ?? []).map((k: any) => k.child_id),
  }));
}
```

- [ ] **Step 3: Add query for scrape_jobs (single job poll)**

Append:

```ts
export async function fetchScrapeJob(jobId: string, userId: string): Promise<ScrapeJobRow | null> {
  const supabase = (await createClient()) as any;

  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("fetchScrapeJob error:", error);
    return null;
  }

  return data as ScrapeJobRow | null;
}
```

- [ ] **Step 4: Update fetchChildren to order by sort_order**

Find `fetchChildren` in `queries.ts`. Update the `.order("created_at"...)` clause:

```ts
.order("sort_order", { ascending: true })
.order("created_at", { ascending: true })
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(queries): add user_camps, planner_blocks, scrape_jobs queries"
```

---

### Task 4: Server actions — camps and shortlist

**Files:**
- Modify: `src/lib/actions.ts` (append)

- [ ] **Step 1: Append `submitCamp` and related actions**

```ts
import type { ScrapeJobRow } from "@/lib/supabase/types";

interface SubmitCampContext {
  childId?: string;
  weekStart?: string; // YYYY-MM-DD Monday
}

export async function submitCamp(
  input: string,
  context: SubmitCampContext,
  consentShare: boolean
): Promise<{
  error?: string;
  jobId?: string;
  userCampId?: string;
  plannerEntryId?: string | null;
  activityId?: string;
}> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a camp name or URL" };

  // Try to match existing activity by exact name or by URL fuzzy match.
  let activityId: string | null = null;

  // Check for URL
  const isURL = /^https?:\/\//i.test(trimmed);

  if (isURL) {
    // Match an existing activity whose registration_url starts with the same origin.
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .ilike("registration_url", `${new URL(trimmed).origin}%`)
      .limit(1)
      .maybeSingle();
    if (existing) activityId = existing.id;
  } else {
    // Fuzzy name match.
    const { data: existing } = await supabase
      .from("activities")
      .select("id")
      .ilike("name", `%${trimmed}%`)
      .limit(1)
      .maybeSingle();
    if (existing) activityId = existing.id;
  }

  // If no match, create a stub activity.
  if (!activityId) {
    // Need a stub org. Create or reuse a "User-submitted" org.
    let orgId: string | null = null;
    const { data: stubOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", "User-submitted")
      .maybeSingle();
    if (stubOrg) {
      orgId = stubOrg.id;
    } else {
      const { data: newOrg } = await supabase
        .from("organizations")
        .insert({ name: "User-submitted", is_active: true })
        .select("id")
        .single();
      orgId = newOrg?.id ?? null;
    }

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) + "-" + Date.now().toString(36);
    const { data: stub, error: stubErr } = await supabase
      .from("activities")
      .insert({
        organization_id: orgId,
        name: isURL ? trimmed : trimmed,
        slug,
        is_active: true,
        verified: false,
        registration_url: isURL ? trimmed : null,
        categories: [],
      })
      .select("id")
      .single();

    if (stubErr || !stub) {
      console.error("submitCamp stub insert error:", stubErr);
      return { error: "Failed to create camp entry" };
    }
    activityId = stub.id;
  }

  // Upsert user_camps (family shortlist).
  const { data: userCamp, error: ucErr } = await supabase
    .from("user_camps")
    .upsert(
      { user_id: user.id, activity_id: activityId },
      { onConflict: "user_id,activity_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (ucErr || !userCamp) {
    console.error("submitCamp user_camps error:", ucErr);
    return { error: "Failed to save camp to shortlist" };
  }

  // Optionally create a planner entry if scoped to week + kid.
  let plannerEntryId: string | null = null;
  if (context.childId && context.weekStart) {
    // Find or create a placeholder session for this activity in that week.
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
      // Create placeholder session for the target week.
      const { data: newSession, error: sessErr } = await supabase
        .from("sessions")
        .insert({
          activity_id: activityId,
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
        child_id: context.childId,
        session_id: sessionId,
        status: "considering",
        sort_order: 0,
      })
      .select("id")
      .single();

    if (!entryErr && entry) plannerEntryId = entry.id;
  }

  // Enqueue scrape job.
  const { data: job } = await supabase
    .from("scrape_jobs")
    .insert({
      user_id: user.id,
      input: trimmed,
      context: {
        child_id: context.childId ?? null,
        week_start: context.weekStart ?? null,
        activity_id: activityId,
      },
      consent_share: consentShare,
      status: "queued",
    })
    .select("id")
    .single();

  revalidatePath("/planner");

  return {
    jobId: job?.id,
    userCampId: userCamp.id,
    plannerEntryId,
    activityId: activityId ?? undefined,
  };
}

export async function assignCampToWeek(
  userCampId: string,
  childId: string,
  weekStart: string
): Promise<{ error?: string; entryId?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: uc } = await supabase
    .from("user_camps")
    .select("activity_id")
    .eq("id", userCampId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!uc) return { error: "Camp not in your shortlist" };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: matchedSession } = await supabase
    .from("sessions")
    .select("id")
    .eq("activity_id", uc.activity_id)
    .gte("starts_at", weekStart)
    .lte("starts_at", weekEnd.toISOString().split("T")[0])
    .limit(1)
    .maybeSingle();

  let sessionId = matchedSession?.id;

  if (!sessionId) {
    const { data: newSession } = await supabase
      .from("sessions")
      .insert({
        activity_id: uc.activity_id,
        starts_at: weekStart,
        ends_at: weekEnd.toISOString().split("T")[0],
        time_slot: "full_day",
        is_sold_out: false,
      })
      .select("id")
      .single();
    sessionId = newSession?.id;
  }

  if (!sessionId) return { error: "Could not create session" };

  const { data: entry, error } = await supabase
    .from("planner_entries")
    .insert({
      user_id: user.id,
      child_id: childId,
      session_id: sessionId,
      status: "considering",
      sort_order: 0,
    })
    .select("id")
    .single();

  if (error || !entry) return { error: "Failed to assign camp" };

  revalidatePath("/planner");
  return { entryId: entry.id };
}

export async function removeCampFromShortlist(userCampId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: uc } = await supabase
    .from("user_camps")
    .select("activity_id")
    .eq("id", userCampId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!uc) return {};

  // Cascade-delete planner entries for this activity for this user.
  await supabase
    .from("planner_entries")
    .delete()
    .eq("user_id", user.id)
    .in("session_id",
      (
        await supabase.from("sessions").select("id").eq("activity_id", uc.activity_id)
      ).data?.map((s: any) => s.id) ?? []
    );

  await supabase.from("user_camps").delete().eq("id", userCampId).eq("user_id", user.id);

  revalidatePath("/planner");
  return {};
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(actions): submitCamp, assignCampToWeek, removeCampFromShortlist"
```

---

### Task 5: Server actions — blocks, state, kid prefs

**Files:**
- Modify: `src/lib/actions.ts` (append)

- [ ] **Step 1: Update the planner entry status action for the new enum**

Find the existing `updatePlannerEntryStatus` in `actions.ts`. Update its type signature:

```ts
export async function updatePlannerEntryStatus(
  entryId: string,
  status: "considering" | "waitlisted" | "registered"
) {
  // body unchanged
}
```

Also delete the old `"penciled_in" | "locked_in" | "cancelled"` signature.

Find the existing `removePlannerEntry` — currently marks `status: "cancelled"`. Replace with hard delete:

```ts
export async function removePlannerEntry(entryId: string) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);

  if (error) {
    console.error("removePlannerEntry error:", error);
    return { error: "Failed to remove" };
  }

  revalidatePath("/planner");
  return { success: true };
}
```

- [ ] **Step 2: Add block actions**

Append:

```ts
export async function addPlannerBlock(data: {
  type: "school" | "travel" | "at_home" | "other";
  title: string;
  emoji?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  childIds: string[];
}): Promise<{ error?: string; blockId?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title required" };
  if (data.childIds.length === 0) return { error: "Pick at least one kid" };
  if (data.startDate > data.endDate) return { error: "End date must be after start" };

  const { data: block, error } = await supabase
    .from("planner_blocks")
    .insert({
      user_id: user.id,
      type: data.type,
      title: data.title.trim(),
      emoji: data.emoji ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
    })
    .select("id")
    .single();

  if (error || !block) {
    console.error("addPlannerBlock error:", error);
    return { error: "Failed to add block" };
  }

  const { error: joinErr } = await supabase
    .from("planner_block_kids")
    .insert(data.childIds.map((cid) => ({ block_id: block.id, child_id: cid })));

  if (joinErr) {
    console.error("addPlannerBlock join error:", joinErr);
    await supabase.from("planner_blocks").delete().eq("id", block.id);
    return { error: "Failed to attach kids" };
  }

  revalidatePath("/planner");
  return { blockId: block.id };
}

export async function removePlannerBlock(blockId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("planner_blocks")
    .delete()
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to remove block" };
  revalidatePath("/planner");
  return {};
}
```

- [ ] **Step 3: Add kid preference actions**

Append:

```ts
export async function reorderKidColumns(
  orderedChildIds: string[]
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates = orderedChildIds.map((childId, idx) =>
    supabase
      .from("children")
      .update({ sort_order: idx })
      .eq("id", childId)
      .eq("user_id", user.id)
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r: any) => r.error);
  if (firstError) return { error: "Failed to save order" };

  revalidatePath("/planner");
  return {};
}

export async function updateChildColor(
  childId: string,
  color: string
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("children")
    .update({ color })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to update color" };
  revalidatePath("/planner");
  revalidatePath("/kids");
  return {};
}

export async function updateShareCampsDefault(
  enabled: boolean
): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ share_camps_default: enabled })
    .eq("id", user.id);

  if (error) return { error: "Failed to update preference" };
  return {};
}
```

- [ ] **Step 4: Avatar upload action**

Append:

```ts
export async function updateChildAvatar(
  childId: string,
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > 2 * 1024 * 1024) return { error: "File must be under 2MB" };
  if (!file.type.startsWith("image/")) return { error: "Must be an image" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${childId}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) return { error: "Upload failed" };

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: dbErr } = await supabase
    .from("children")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", childId)
    .eq("user_id", user.id);

  if (dbErr) return { error: "Failed to save avatar URL" };

  revalidatePath("/planner");
  revalidatePath("/kids");
  return { url: urlData.publicUrl };
}
```

Note: requires an `avatars` bucket in Supabase Storage with public read access. Create it via Supabase dashboard → Storage → New bucket → name: `avatars`, public: true.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(actions): blocks, kid column order, color, avatar upload, status enum update"
```

---

### Task 6: Scraper confidence scoring

**Files:**
- Create: `src/scraper/confidence.ts`
- Create: `tests/scraper/confidence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scraper/confidence.test.ts
import { describe, it, expect } from "vitest";
import { scoreConfidence } from "@/scraper/confidence";

describe("scoreConfidence", () => {
  it("returns 'high' when all key fields are present and single candidate", () => {
    expect(scoreConfidence({
      candidates: [{ name: "Camp Kanata", score: 0.95, fields: { name: true, dates: true, price: true, location: true, ages: true } }],
    })).toBe("high");
  });

  it("returns 'partial' when one candidate but some fields missing", () => {
    expect(scoreConfidence({
      candidates: [{ name: "Camp Kanata", score: 0.9, fields: { name: true, dates: true, price: false, location: true, ages: false } }],
    })).toBe("partial");
  });

  it("returns 'ambiguous' when multiple candidates with close scores", () => {
    expect(scoreConfidence({
      candidates: [
        { name: "Art Camp A", score: 0.7, fields: { name: true, dates: true, price: true, location: true, ages: true } },
        { name: "Art Camp B", score: 0.68, fields: { name: true, dates: true, price: true, location: true, ages: true } },
      ],
    })).toBe("ambiguous");
  });

  it("returns 'none' when no candidates or all scores below threshold", () => {
    expect(scoreConfidence({ candidates: [] })).toBe("none");
    expect(scoreConfidence({ candidates: [{ name: "?", score: 0.3, fields: {} }] })).toBe("none");
  });
});
```

Run: `npx vitest run tests/scraper/confidence.test.ts`
Expected: FAIL (no implementation).

- [ ] **Step 2: Implement confidence scoring**

```ts
// src/scraper/confidence.ts
import type { ScrapeConfidence } from "@/lib/supabase/types";

export interface Candidate {
  name: string;
  score: number; // 0..1
  fields: Partial<{
    name: boolean;
    dates: boolean;
    price: boolean;
    location: boolean;
    ages: boolean;
  }>;
}

export interface ConfidenceInput {
  candidates: Candidate[];
}

const KEY_FIELDS: Array<keyof Candidate["fields"]> = ["name", "dates", "price", "location", "ages"];
const CONFIDENT_SCORE = 0.6;
const AMBIGUOUS_SCORE_GAP = 0.1;

export function scoreConfidence(input: ConfidenceInput): ScrapeConfidence {
  const strong = input.candidates.filter((c) => c.score >= CONFIDENT_SCORE);

  if (strong.length === 0) return "none";

  if (strong.length > 1) {
    const top = strong[0].score;
    const second = strong[1].score;
    if (top - second < AMBIGUOUS_SCORE_GAP) return "ambiguous";
  }

  const top = strong[0];
  const missingCount = KEY_FIELDS.filter((f) => !top.fields[f]).length;
  if (missingCount >= 2) return "partial";

  return "high";
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run tests/scraper/confidence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/scraper/confidence.ts tests/scraper/confidence.test.ts
git commit -m "feat(scraper): confidence scoring for on-demand scrapes"
```

---

### Task 7: On-demand scraper entry point

**Files:**
- Create: `src/scraper/on-demand.ts`

- [ ] **Step 1: Sketch the on-demand scrape pipeline**

```ts
// src/scraper/on-demand.ts
// Runs a single scrape job: pulls the scrape_jobs row, scrapes, scores, writes back.

import { createServiceClient } from "@/scraper/supabase";
import { scoreConfidence, type Candidate } from "@/scraper/confidence";
import { extractWithLLM } from "@/scraper/tier3-llm-extractor";
import { upsertActivity, upsertSession, upsertLocation } from "@/scraper/upsert";

interface RunJobArgs {
  jobId: string;
}

export async function runScrapeJob({ jobId }: RunJobArgs): Promise<void> {
  const supabase = createServiceClient();

  const { data: job } = await supabase.from("scrape_jobs").select("*").eq("id", jobId).single();
  if (!job) return;

  await supabase.from("scrape_jobs").update({ status: "running" }).eq("id", jobId);

  try {
    const input = (job.input as string).trim();
    const isURL = /^https?:\/\//i.test(input);
    let html: string | null = null;
    let sourceUrl: string | null = null;

    if (isURL) {
      sourceUrl = input;
      const res = await fetch(input, { headers: { "User-Agent": "KidtineraryBot/1.0" } });
      html = await res.text();
    } else {
      // Search via Bing (existing pattern).
      const { searchWeb } = await import("@/scraper/search");
      const results = await searchWeb(input, job.context?.location_hint);
      if (results.length === 0) {
        await supabase.from("scrape_jobs").update({
          status: "resolved",
          confidence: "none",
          resolved_at: new Date().toISOString(),
        }).eq("id", jobId);
        return;
      }
      sourceUrl = results[0].url;
      const res = await fetch(sourceUrl, { headers: { "User-Agent": "KidtineraryBot/1.0" } });
      html = await res.text();
    }

    if (!html || !sourceUrl) {
      await supabase.from("scrape_jobs").update({
        status: "failed",
        resolved_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    // Use existing Tier 3 LLM extractor.
    const extracted = await extractWithLLM({ html, sourceUrl });

    // Build candidates. For MVP, one candidate per extracted activity.
    const candidates: Candidate[] = extracted.activities.map((a: any) => ({
      name: a.name,
      score: a._confidence ?? 0.8,
      fields: {
        name: !!a.name,
        dates: (a.sessions?.length ?? 0) > 0,
        price: (a.price_options?.length ?? 0) > 0,
        location: !!a.location?.address,
        ages: a.min_age != null || a.max_age != null,
      },
    }));

    const confidence = scoreConfidence({ candidates });

    let activityId: string | null = job.context?.activity_id ?? null;

    if (confidence === "high" || confidence === "partial") {
      const best = extracted.activities[0];
      const upserted = await upsertActivity(supabase, {
        ...best,
        verified: confidence === "high" && job.consent_share,
        verified_at: confidence === "high" && job.consent_share ? new Date().toISOString() : null,
        stub_id_to_replace: activityId,
      });
      activityId = upserted.id;
      // sessions, prices, locations handled by existing upsert helpers.
    }

    await supabase.from("scrape_jobs").update({
      status: "resolved",
      confidence,
      activity_id: activityId,
      candidates: candidates.slice(0, 3),
      resolved_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (err) {
    console.error("runScrapeJob error:", err);
    await supabase.from("scrape_jobs").update({
      status: "failed",
      resolved_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}
```

Note: this file imports existing scraper primitives. Adjust imports to match actual file names in `src/scraper/` — the exact adapter names may differ.

- [ ] **Step 2: Commit**

```bash
git add src/scraper/on-demand.ts
git commit -m "feat(scraper): on-demand scrape job runner"
```

---

### Task 8: API route to trigger + poll scrape jobs

**Files:**
- Create: `src/app/api/scrape-jobs/route.ts` (POST — trigger run)
- Create: `src/app/api/scrape-jobs/[id]/route.ts` (GET — poll status)

- [ ] **Step 1: Write the POST route**

```ts
// src/app/api/scrape-jobs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runScrapeJob } from "@/scraper/on-demand";

export async function POST(request: NextRequest) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { jobId } = await request.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const { data: job } = await supabase.from("scrape_jobs").select("id").eq("id", jobId).eq("user_id", user.id).maybeSingle();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Fire-and-forget. Don't await.
  runScrapeJob({ jobId }).catch((err) => console.error("runScrapeJob background error:", err));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the GET poll route**

```ts
// src/app/api/scrape-jobs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchScrapeJob } from "@/lib/queries";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const job = await fetchScrapeJob(id, user.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ job });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scrape-jobs/
git commit -m "feat(api): scrape-jobs POST trigger + GET poll endpoints"
```

---

### Task 9: Activities search API route (autocomplete)

**Files:**
- Create: `src/app/api/activities/search/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/activities/search/route.ts
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
    .limit(8);

  return NextResponse.json({ results: data ?? [] });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/activities/search/route.ts
git commit -m "feat(api): activities search endpoint for autocomplete"
```

---

### Task 10: Retire old routes — favorites/submit delete, explore stub

**Files:**
- Delete: `src/app/favorites/page.tsx`
- Replace: `src/app/submit/page.tsx`
- Replace: `src/app/explore/page.tsx`
- Modify: `src/components/layout/nav.tsx`

- [ ] **Step 1: Delete favorites**

```bash
rm -r src/app/favorites
```

- [ ] **Step 2: Replace submit page with a redirect**

```tsx
// src/app/submit/page.tsx
import { redirect } from "next/navigation";

export default function SubmitPage() {
  redirect("/planner?hint=submit-deprecated");
}
```

- [ ] **Step 3: Replace explore page with coming-soon stub**

```tsx
// src/app/explore/page.tsx
export const dynamic = "force-dynamic";

export default function ExplorePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="font-serif text-4xl mb-4">Explore — coming soon</h1>
      <p className="text-stone text-lg mb-2">
        We&apos;re building a verified camp directory.
      </p>
      <p className="text-stone">
        In the meantime, add camps directly from your{" "}
        <a href="/planner" className="text-sunset hover:underline">planner</a>.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Update nav**

Open `src/components/layout/nav.tsx`. Remove the "Favorites" entry. Keep "Explore" (it now points to the stub). Make sure "Planner" is the primary link.

```ts
const NAV_LINKS = [
  { href: "/planner", label: "Planner" },
  { href: "/explore", label: "Explore" },
  { href: "/kids", label: "My Kids" },
] as const;
```

- [ ] **Step 5: Commit**

```bash
git add -u src/app/favorites src/app/submit src/app/explore src/components/layout/nav.tsx
git commit -m "feat: retire favorites, submit redirect, explore coming-soon stub"
```

---

## Phase 2 — UI shell: matrix, cells, badges

### Task 11: Kid palette helper + KidAvatar component

**Files:**
- Create: `src/lib/kid-palette.ts`
- Create: `src/components/planner/kid-avatar.tsx`

- [ ] **Step 1: Kid palette helper**

```ts
// src/lib/kid-palette.ts
export const KID_PALETTE = [
  "#f4b76f", // orange
  "#7fa06a", // green
  "#8fa4c8", // blue
  "#d4a1c8", // rose
  "#c8a76a", // sand
  "#9fc8b8", // teal
] as const;

/** Pick a palette color based on index; wraps. */
export function paletteColorForIndex(index: number): string {
  return KID_PALETTE[index % KID_PALETTE.length];
}

/** First letter of the name, uppercased. Falls back to "?". */
export function initialFor(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length === 0 ? "?" : trimmed[0].toUpperCase();
}
```

- [ ] **Step 2: KidAvatar component**

```tsx
// src/components/planner/kid-avatar.tsx
import { initialFor } from "@/lib/kid-palette";

interface KidAvatarProps {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}

export function KidAvatar({ name, color, avatarUrl, size = 48 }: KidAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ ...style, background: color }}
      className="rounded-full flex items-center justify-center text-white font-bold select-none"
    >
      {initialFor(name)}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/kid-palette.ts src/components/planner/kid-avatar.tsx
git commit -m "feat(planner): KidAvatar + palette helpers"
```

---

### Task 12: Kid column header (avatar, name, age, reorder)

**Files:**
- Create: `src/components/planner/kid-column-header.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/planner/kid-column-header.tsx
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KidAvatar } from "./kid-avatar";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  child: Child;
  ageYears: number;
}

export function KidColumnHeader({ child, ageYears }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-driftwood/30 rounded-xl p-3 text-center relative"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="absolute top-2 right-2 text-stone/60 hover:text-stone cursor-grab active:cursor-grabbing"
      >
        ⋮⋮
      </button>
      <div className="flex justify-center mb-2">
        <KidAvatar name={child.name} color={child.color} avatarUrl={child.avatar_url} size={48} />
      </div>
      <div className="font-medium text-sm text-bark">{child.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-stone">{ageYears} yrs</div>
      <div className="h-0.5 rounded-full mt-2" style={{ background: child.color }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify @dnd-kit/sortable is installed**

```bash
npm ls @dnd-kit/sortable
```

Expected: installed. If not: `npm install @dnd-kit/sortable`.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/kid-column-header.tsx package.json package-lock.json
git commit -m "feat(planner): KidColumnHeader with drag-to-reorder"
```

---

### Task 13: State badge + shared badge

**Files:**
- Create: `src/components/planner/state-badge.tsx`
- Create: `src/components/planner/shared-badge.tsx`

- [ ] **Step 1: StateBadge**

```tsx
// src/components/planner/state-badge.tsx
"use client";

import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface Props {
  status: PlannerEntryStatus;
  onClick?: () => void;
}

const LABELS: Record<PlannerEntryStatus, string> = {
  considering: "Considering",
  waitlisted: "Waitlisted",
  registered: "Registered",
};

const STYLES: Record<PlannerEntryStatus, string> = {
  considering: "bg-campfire/15 text-campfire hover:bg-campfire/25",
  waitlisted: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  registered: "bg-meadow/20 text-meadow hover:bg-meadow/30",
};

export function StateBadge({ status, onClick }: Props) {
  const base = "font-mono text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full transition-colors";
  const cls = `${base} ${STYLES[status]} ${onClick ? "cursor-pointer" : ""}`;
  if (onClick) return <button onClick={onClick} className={cls}>{LABELS[status]}</button>;
  return <span className={cls}>{LABELS[status]}</span>;
}
```

- [ ] **Step 2: SharedBadge**

```tsx
// src/components/planner/shared-badge.tsx
interface Props {
  sharedWith: string[]; // other kids' names
}

export function SharedBadge({ sharedWith }: Props) {
  if (sharedWith.length === 0) return null;
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest text-meadow mt-1">
      ✦ shared w/ {sharedWith.join(", ")}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/state-badge.tsx src/components/planner/shared-badge.tsx
git commit -m "feat(planner): StateBadge (3 states) + SharedBadge"
```

---

### Task 14: Camp card for a planner cell

**Files:**
- Create: `src/components/planner/camp-card.tsx`

- [ ] **Step 1: Implement (loading and resolved states)**

```tsx
// src/components/planner/camp-card.tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StateBadge } from "./state-badge";
import { SharedBadge } from "./shared-badge";
import { updatePlannerEntryStatus, removePlannerEntry } from "@/lib/actions";
import type { PlannerEntryStatus } from "@/lib/supabase/types";

interface CampCardProps {
  entryId: string;
  activityName: string;
  activitySlug: string;
  status: PlannerEntryStatus;
  timeLabel?: string | null;
  priceLabel?: string | null;
  sharedWith: string[];
  isLoading: boolean;
  onChanged: () => void;
}

const NEXT_STATUS: Record<PlannerEntryStatus, PlannerEntryStatus> = {
  considering: "waitlisted",
  waitlisted: "registered",
  registered: "considering",
};

export function CampCard({
  entryId,
  activityName,
  activitySlug,
  status,
  timeLabel,
  priceLabel,
  sharedWith,
  isLoading,
  onChanged,
}: CampCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await updatePlannerEntryStatus(entryId, NEXT_STATUS[status]);
      onChanged();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removePlannerEntry(entryId);
      onChanged();
    });
  }

  const bg =
    status === "registered" ? "bg-meadow/5 border-meadow/30"
    : sharedWith.length > 0 ? "bg-meadow/5 border-meadow/20"
    : "bg-white border-driftwood/30";

  return (
    <div className={`rounded-lg border p-3 transition-opacity ${bg} ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/activity/${activitySlug}`}
          className="flex-1 font-medium text-sm text-bark hover:text-sunset transition-colors truncate"
        >
          {activityName}
        </Link>
        <button
          onClick={handleRemove}
          aria-label="Remove"
          className="text-driftwood hover:text-red-500 text-xs"
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-1.5">
          <div className="h-2 bg-driftwood/20 rounded w-2/3 animate-pulse"></div>
          <div className="h-2 bg-driftwood/20 rounded w-1/2 animate-pulse"></div>
        </div>
      ) : (
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-stone">
          {[timeLabel, priceLabel].filter(Boolean).join(" · ") || "Details loading…"}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <StateBadge status={status} onClick={handleToggle} />
      </div>

      <SharedBadge sharedWith={sharedWith} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/camp-card.tsx
git commit -m "feat(planner): CampCard with status toggle and loading state"
```

---

### Task 15: Block card

**Files:**
- Create: `src/components/planner/block-card.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/planner/block-card.tsx
"use client";

import { useTransition } from "react";
import { removePlannerBlock } from "@/lib/actions";
import type { PlannerBlockType } from "@/lib/supabase/types";

const TYPE_STYLES: Record<PlannerBlockType, { bg: string; border: string; emoji: string }> = {
  school:  { bg: "bg-amber-50",  border: "border-amber-200",  emoji: "🏫" },
  travel:  { bg: "bg-purple-50", border: "border-purple-200", emoji: "✈" },
  at_home: { bg: "bg-orange-50", border: "border-orange-200", emoji: "🏡" },
  other:   { bg: "bg-stone-50",  border: "border-stone-200",  emoji: "⭐" },
};

interface Props {
  blockId: string;
  type: PlannerBlockType;
  title: string;
  emoji?: string | null;
  subtitle?: string;
  onChanged: () => void;
}

export function BlockCard({ blockId, type, title, emoji, subtitle, onChanged }: Props) {
  const [isPending, startTransition] = useTransition();
  const t = TYPE_STYLES[type];
  const icon = emoji || t.emoji;

  function handleRemove() {
    startTransition(async () => {
      await removePlannerBlock(blockId);
      onChanged();
    });
  }

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${t.bg} ${t.border} ${isPending ? "opacity-60" : ""}`}>
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-bark truncate">{title}</div>
        {subtitle && (
          <div className="font-mono text-[10px] uppercase tracking-wide text-stone mt-0.5">{subtitle}</div>
        )}
      </div>
      <button
        onClick={handleRemove}
        aria-label="Remove block"
        className="text-driftwood hover:text-red-500 text-xs"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/block-card.tsx
git commit -m "feat(planner): BlockCard with type-colored rendering"
```

---

### Task 16: Shared camp detection helper

**Files:**
- Create: `src/lib/planner-matrix.ts`
- Create: `tests/lib/planner-matrix.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/planner-matrix.test.ts
import { describe, it, expect } from "vitest";
import { detectSharedEntries, type EntryForSharing } from "@/lib/planner-matrix";

describe("detectSharedEntries", () => {
  it("returns empty map when no shared entries", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a2", weekKey: "2026-W26" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual([]);
    expect(result.get("e2")).toEqual([]);
  });

  it("identifies shared camp across two kids in same week", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a1", weekKey: "2026-W26" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual(["B"]);
    expect(result.get("e2")).toEqual(["A"]);
  });

  it("does not mark entries in different weeks as shared", () => {
    const entries: EntryForSharing[] = [
      { entryId: "e1", childId: "c1", activityId: "a1", weekKey: "2026-W26" },
      { entryId: "e2", childId: "c2", activityId: "a1", weekKey: "2026-W27" },
    ];
    const result = detectSharedEntries(entries, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }]);
    expect(result.get("e1")).toEqual([]);
    expect(result.get("e2")).toEqual([]);
  });
});
```

Run: `npx vitest run tests/lib/planner-matrix.test.ts` → FAIL (no impl).

- [ ] **Step 2: Implement**

```ts
// src/lib/planner-matrix.ts
export interface EntryForSharing {
  entryId: string;
  childId: string;
  activityId: string;
  weekKey: string;
}

export interface KidRef {
  id: string;
  name: string;
}

/** Map of entryId → list of other kid names sharing the same activityId in the same weekKey. */
export function detectSharedEntries(
  entries: EntryForSharing[],
  kids: KidRef[]
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const nameOf = new Map(kids.map((k) => [k.id, k.name]));

  // Group by (weekKey, activityId)
  const groups = new Map<string, EntryForSharing[]>();
  for (const e of entries) {
    const key = `${e.weekKey}::${e.activityId}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  for (const e of entries) {
    const key = `${e.weekKey}::${e.activityId}`;
    const group = groups.get(key) ?? [];
    const otherNames = group
      .filter((g) => g.childId !== e.childId)
      .map((g) => nameOf.get(g.childId) ?? "?");
    out.set(e.entryId, otherNames);
  }

  return out;
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/lib/planner-matrix.test.ts` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/planner-matrix.ts tests/lib/planner-matrix.test.ts
git commit -m "feat(planner): shared-entry detection helper with tests"
```

---

### Task 17: Planner cell component

**Files:**
- Create: `src/components/planner/planner-cell.tsx`

- [ ] **Step 1: Implement empty + filled cell**

```tsx
// src/components/planner/planner-cell.tsx
"use client";

import type { PlannerEntryStatus } from "@/lib/supabase/types";
import { CampCard } from "./camp-card";

export interface CellEntry {
  kind: "camp";
  entryId: string;
  activityName: string;
  activitySlug: string;
  status: PlannerEntryStatus;
  timeLabel?: string | null;
  priceLabel?: string | null;
  sharedWith: string[];
  isLoading: boolean;
}

interface Props {
  childId: string;
  weekStart: string; // YYYY-MM-DD
  entries: CellEntry[];
  onAddClick: (childId: string, weekStart: string) => void;
  onChanged: () => void;
}

export function PlannerCell({ childId, weekStart, entries, onAddClick, onChanged }: Props) {
  if (entries.length === 0) {
    return (
      <button
        onClick={() => onAddClick(childId, weekStart)}
        className="w-full h-full min-h-[60px] border border-dashed border-driftwood/60 rounded-lg text-stone/70 hover:border-driftwood hover:text-stone hover:bg-driftwood/5 transition-colors font-mono text-[11px] uppercase tracking-wide"
      >
        + Add camp
      </button>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <CampCard
          key={e.entryId}
          entryId={e.entryId}
          activityName={e.activityName}
          activitySlug={e.activitySlug}
          status={e.status}
          timeLabel={e.timeLabel}
          priceLabel={e.priceLabel}
          sharedWith={e.sharedWith}
          isLoading={e.isLoading}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/planner-cell.tsx
git commit -m "feat(planner): PlannerCell (empty + filled) component"
```

---

### Task 18: Matrix shell — reorderable kid columns + week rows

**Files:**
- Create: `src/components/planner/matrix.tsx`

- [ ] **Step 1: Implement the matrix grid**

```tsx
// src/components/planner/matrix.tsx
"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { KidColumnHeader } from "./kid-column-header";
import { PlannerCell, type CellEntry } from "./planner-cell";
import { BlockCard } from "./block-card";
import { reorderKidColumns } from "@/lib/actions";
import { formatWeekRange, getWeekKey } from "@/lib/format";
import type { PlannerBlockWithKids } from "@/lib/queries";

interface Child {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
  sort_order: number;
}

export interface WeekCell {
  childId: string;
  entries: CellEntry[];
}

export interface WeekRow {
  weekStart: Date;
  cells: WeekCell[];
  fullRowBlock: { blockId: string; type: any; title: string; emoji?: string | null; subtitle?: string } | null;
  partialBlocksByChild: Record<string, { blockId: string; type: any; title: string; emoji?: string | null }>;
}

interface Props {
  children: Child[];
  weeks: WeekRow[];
  onAddCampClick: (childId: string | null, weekStart: string | null) => void;
  onAddBlockClick: (childId: string | null, weekStart: string | null) => void;
  onChanged: () => void;
}

function ageYears(birthDate: string): number {
  const ms = Date.now() - new Date(birthDate).getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

export function PlannerMatrix({ children, weeks, onAddCampClick, onAddBlockClick, onChanged }: Props) {
  const [orderedIds, setOrderedIds] = useState(children.map((c) => c.id));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setOrderedIds(children.map((c) => c.id));
  }, [children]);

  const childById = new Map(children.map((c) => [c.id, c]));
  const orderedChildren = orderedIds.map((id) => childById.get(id)!).filter(Boolean);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    void reorderKidColumns(next);
  }

  const cols = orderedChildren.length;
  const gridTemplate = `100px ${"1fr ".repeat(cols).trim()}`;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-3">
        {/* Header row: kids */}
        <div className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
          <div />
          <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
            {orderedChildren.map((c) => (
              <KidColumnHeader key={c.id} child={c} ageYears={ageYears(c.birth_date)} />
            ))}
          </SortableContext>
        </div>

        {/* Week rows */}
        {weeks.map((w) => {
          const weekKey = getWeekKey(w.weekStart);
          const weekStartStr = w.weekStart.toISOString().split("T")[0];

          // Full-row block spans all columns.
          if (w.fullRowBlock) {
            return (
              <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: "100px 1fr" }}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5">
                  {formatWeekRange(w.weekStart)}
                </div>
                <BlockCard
                  blockId={w.fullRowBlock.blockId}
                  type={w.fullRowBlock.type}
                  title={w.fullRowBlock.title}
                  emoji={w.fullRowBlock.emoji}
                  subtitle={w.fullRowBlock.subtitle}
                  onChanged={onChanged}
                />
              </div>
            );
          }

          return (
            <div key={weekKey} className="grid gap-2" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-stone self-center px-1.5">
                {formatWeekRange(w.weekStart)}
              </div>
              {orderedChildren.map((child) => {
                const partial = w.partialBlocksByChild[child.id];
                if (partial) {
                  return (
                    <BlockCard
                      key={`${weekKey}-${child.id}`}
                      blockId={partial.blockId}
                      type={partial.type}
                      title={partial.title}
                      emoji={partial.emoji}
                      onChanged={onChanged}
                    />
                  );
                }
                const cell = w.cells.find((c) => c.childId === child.id);
                return (
                  <PlannerCell
                    key={`${weekKey}-${child.id}`}
                    childId={child.id}
                    weekStart={weekStartStr}
                    entries={cell?.entries ?? []}
                    onAddClick={(cid, ws) => onAddCampClick(cid, ws)}
                    onChanged={onChanged}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/matrix.tsx
git commit -m "feat(planner): matrix with kids × weeks, reorderable columns, block rendering"
```

---

## Phase 3 — Add flows: camp modal, block modal, polling

### Task 19: Add-camp modal

**Files:**
- Create: `src/components/planner/add-camp-modal.tsx`

- [ ] **Step 1: Implement modal with input + autocomplete + consent checkbox**

```tsx
// src/components/planner/add-camp-modal.tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitCamp, assignCampToWeek } from "@/lib/actions";

interface AutocompleteHit {
  id: string;
  name: string;
  verified: boolean;
  organization: { name: string } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scope: { childId: string | null; weekStart: string | null };
  shareCampsDefault: boolean;
  onSubmitted: (result: { jobId?: string; userCampId?: string; plannerEntryId?: string | null }) => void;
}

export function AddCampModal({ open, onClose, scope, shareCampsDefault, onSubmitted }: Props) {
  const [input, setInput] = useState("");
  const [consent, setConsent] = useState(shareCampsDefault);
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput("");
      setConsent(shareCampsDefault);
      setHits([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, shareCampsDefault]);

  useEffect(() => {
    if (input.trim().length < 2) { setHits([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/activities/search?q=${encodeURIComponent(input.trim())}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setHits(data.results ?? []);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [input]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    startTransition(async () => {
      const result = await submitCamp(
        input,
        { childId: scope.childId ?? undefined, weekStart: scope.weekStart ?? undefined },
        consent
      );
      if (result.error) {
        alert(result.error);
        return;
      }
      // Kick off scrape job (fire-and-forget)
      if (result.jobId) {
        fetch("/api/scrape-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: result.jobId }),
        }).catch(() => {});
      }
      onSubmitted(result);
      onClose();
    });
  }

  async function handleHitClick(hit: AutocompleteHit) {
    if (!scope.childId || !scope.weekStart) {
      // Add to shortlist only — call submitCamp with just the hit name; server matches activity.
      startTransition(async () => {
        const result = await submitCamp(hit.name, { childId: undefined, weekStart: undefined }, consent);
        if (!result.error) { onSubmitted(result); onClose(); }
      });
      return;
    }
    // Slot directly.
    startTransition(async () => {
      const result = await submitCamp(
        hit.name,
        { childId: scope.childId ?? undefined, weekStart: scope.weekStart ?? undefined },
        consent
      );
      if (!result.error) { onSubmitted(result); onClose(); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-serif text-2xl mb-1">Add a camp</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-stone mb-4">
          Tell us the camp name or drop a URL
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="YMCA Camp Kanata · sciencecamp.com · Art Studio Summer"
              className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
              autoComplete="off"
            />
            <p className="font-mono text-[10px] uppercase tracking-widest text-stone mt-1.5">
              Got a link handy? Paste it for the best match.
            </p>
          </div>

          {hits.length > 0 && (
            <div className="border border-driftwood/30 rounded-lg bg-white overflow-hidden">
              {hits.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => handleHitClick(h)}
                  className="w-full text-left px-3 py-2 hover:bg-driftwood/10 border-b border-driftwood/20 last:border-b-0"
                >
                  <div className="font-medium text-sm text-bark">
                    {h.name} {h.verified && <span className="font-mono text-[9px] text-meadow uppercase tracking-wide ml-1">verified</span>}
                  </div>
                  {h.organization && (
                    <div className="font-mono text-[10px] uppercase tracking-wide text-stone">{h.organization.name}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-bark">
              Share this camp with Kidtinerary&apos;s directory so other parents can find it. We&apos;ll verify the details before publishing.
            </span>
          </label>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 text-stone hover:text-bark">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !input.trim()}
              className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90 disabled:opacity-50"
            >
              {isPending ? "Adding…" : "Add to planner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/add-camp-modal.tsx
git commit -m "feat(planner): AddCampModal with autocomplete and consent checkbox"
```

---

### Task 20: Add-block modal

**Files:**
- Create: `src/components/planner/add-block-modal.tsx`

- [ ] **Step 1: Implement type picker + details step**

```tsx
// src/components/planner/add-block-modal.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { addPlannerBlock } from "@/lib/actions";
import { KidAvatar } from "./kid-avatar";
import type { PlannerBlockType } from "@/lib/supabase/types";

interface ChildLite {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  children: ChildLite[];
  scope: { childId: string | null; weekStart: string | null };
  onSubmitted: () => void;
}

const TYPES: { id: PlannerBlockType; label: string; sub: string; emoji: string }[] = [
  { id: "school",  label: "School",   sub: "Year-round",      emoji: "🏫" },
  { id: "travel",  label: "Travel",   sub: "Trip, visit",     emoji: "✈" },
  { id: "at_home", label: "At home",  sub: "Parent time, off", emoji: "🏡" },
  { id: "other",   label: "Other",    sub: "Custom",          emoji: "⭐" },
];

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function AddBlockModal({ open, onClose, children, scope, onSubmitted }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<PlannerBlockType>("travel");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setStep(1);
      setType("travel");
      setTitle("");
      setEmoji("");
      const ws = scope.weekStart ?? new Date().toISOString().split("T")[0];
      setStartDate(ws);
      setEndDate(addDays(ws, 4));
      setSelectedKids(scope.childId ? [scope.childId] : children.map((c) => c.id));
    }
  }, [open, scope.childId, scope.weekStart, children]);

  if (!open) return null;

  function toggleKid(id: string) {
    setSelectedKids((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await addPlannerBlock({
        type,
        title,
        emoji: type === "other" ? emoji || null : null,
        startDate,
        endDate,
        childIds: selectedKids,
      });
      if (result.error) { alert(result.error); return; }
      onSubmitted();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-bark/40" onClick={onClose} />
      <div className="relative bg-cream rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-serif text-2xl mb-1">Add a block</h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-stone mb-4">
          Besides a camp
        </p>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setType(t.id); setStep(2); }}
                className="border border-driftwood/30 rounded-xl p-3 bg-white text-left hover:bg-driftwood/5 transition-colors"
              >
                <div className="text-2xl mb-1">{t.emoji}</div>
                <div className="font-medium text-sm text-bark">{t.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-stone mt-0.5">{t.sub}</div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{type === "other" ? (emoji || "⭐") : TYPES.find((t) => t.id === type)?.emoji}</span>
              <button
                onClick={() => setStep(1)}
                className="font-mono text-[10px] uppercase tracking-widest text-stone hover:text-bark"
              >
                {TYPES.find((t) => t.id === type)?.label} · change
              </button>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-driftwood rounded-lg px-3 py-2 text-bark focus:outline-none focus:border-sunset mt-1"
                placeholder={type === "school" ? "School (year-round)" : "Outer Banks trip"}
              />
            </div>

            {type === "other" && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Emoji (optional)</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-full bg-white border border-driftwood rounded-lg px-3 py-2 text-bark focus:outline-none focus:border-sunset mt-1"
                  maxLength={4}
                  placeholder="⭐"
                />
              </div>
            )}

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Dates</label>
              <div className="flex gap-2 mt-1">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 bg-white border border-driftwood rounded-lg px-3 py-2 text-bark" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 bg-white border border-driftwood rounded-lg px-3 py-2 text-bark" />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-stone">Who it applies to</label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {children.map((c) => {
                  const selected = selectedKids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleKid(c.id)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition-colors ${selected ? "bg-white" : "bg-white opacity-50"}`}
                      style={selected ? { borderColor: c.color } : { borderColor: "#d9c9b0" }}
                    >
                      <KidAvatar name={c.name} color={c.color} avatarUrl={c.avatar_url} size={20} />
                      {c.name} {selected && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 text-stone hover:text-bark">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !title.trim() || selectedKids.length === 0}
                className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90 disabled:opacity-50"
              >
                {isPending ? "Adding…" : "Add to planner"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/add-block-modal.tsx
git commit -m "feat(planner): AddBlockModal with type picker and kid multi-select"
```

---

### Task 21: Scrape job polling hook

**Files:**
- Create: `src/lib/use-scrape-job.ts`

- [ ] **Step 1: Implement poll hook**

```ts
// src/lib/use-scrape-job.ts
"use client";

import { useEffect, useState } from "react";
import type { ScrapeJobRow } from "@/lib/supabase/types";

interface UseScrapeJobResult {
  job: ScrapeJobRow | null;
  done: boolean;
}

/** Poll /api/scrape-jobs/[id] every 2s until resolved/failed, max 90s. */
export function useScrapeJob(jobId: string | null): UseScrapeJobResult {
  const [job, setJob] = useState<ScrapeJobRow | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const startedAt = Date.now();
    const MAX_MS = 90_000;
    const INTERVAL_MS = 2_000;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/scrape-jobs/${jobId}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setJob(data.job);
          if (data.job?.status === "resolved" || data.job?.status === "failed") return;
        }
      } catch (err) {
        console.error("useScrapeJob poll error:", err);
      }
      if (Date.now() - startedAt > MAX_MS) return;
      setTimeout(poll, INTERVAL_MS);
    }

    void poll();
    return () => { cancelled = true; };
  }, [jobId]);

  const done = job?.status === "resolved" || job?.status === "failed";
  return { job, done };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/use-scrape-job.ts
git commit -m "feat(planner): useScrapeJob polling hook"
```

---

## Phase 4 — Polish: My Camps row, planner page rewrite, .ics, responsive

### Task 22: My Camps chip row

**Files:**
- Create: `src/components/planner/my-camps-row.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/planner/my-camps-row.tsx
"use client";

import type { UserCampWithActivity } from "@/lib/queries";

interface Props {
  camps: UserCampWithActivity[];
  onChipClick: (camp: UserCampWithActivity) => void;
  onAddClick: () => void;
}

export function MyCampsRow({ camps, onChipClick, onAddClick }: Props) {
  return (
    <section className="mb-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-stone mb-2">My camps</h2>
      <div className="flex gap-2 flex-wrap">
        {camps.map((c) => (
          <button
            key={c.id}
            onClick={() => onChipClick(c)}
            className={`rounded-full px-3 py-1.5 text-sm border flex items-center gap-2 transition-colors ${c.activity.verified ? "bg-white border-meadow/30" : "bg-white border-driftwood/40"} hover:border-bark`}
          >
            <span className="font-medium text-bark">{c.activity.name}</span>
            {c.plannerEntryCount > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wide text-stone">{c.plannerEntryCount}</span>
            )}
            {c.activity.verified && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-meadow">verified</span>
            )}
          </button>
        ))}
        <button
          onClick={onAddClick}
          className="rounded-full px-3 py-1.5 text-sm border border-dashed border-driftwood/60 text-stone hover:border-bark hover:text-bark transition-colors"
        >
          + Add
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/my-camps-row.tsx
git commit -m "feat(planner): MyCampsRow chip list"
```

---

### Task 23: Planner page rewrite — server component

**Files:**
- Modify: `src/app/planner/page.tsx`

- [ ] **Step 1: Replace with new server component**

```tsx
// src/app/planner/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchChildren, fetchPlannerEntries, fetchUserCamps, fetchPlannerBlocks } from "@/lib/queries";
import { PlannerClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const children = await fetchChildren(user.id);
  if (children.length === 0) redirect("/kids");

  const { data: profile } = await supabase
    .from("profiles")
    .select("share_camps_default")
    .eq("id", user.id)
    .maybeSingle();

  const allEntries = (
    await Promise.all(children.map((c) => fetchPlannerEntries(user.id, c.id)))
  ).flat();

  const userCamps = await fetchUserCamps(user.id);
  const blocks = await fetchPlannerBlocks(user.id);

  return (
    <PlannerClient
      kids={children}
      entries={allEntries}
      userCamps={userCamps}
      blocks={blocks}
      shareCampsDefault={profile?.share_camps_default ?? true}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/planner/page.tsx
git commit -m "refactor(planner): page loads all-kids entries, camps, blocks"
```

---

### Task 24: Planner page rewrite — client orchestrator

**Files:**
- Modify: `src/app/planner/client.tsx`

- [ ] **Step 1: Replace client with matrix + modals + polling**

```tsx
// src/app/planner/client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlannerMatrix, type WeekRow, type CellEntry } from "@/components/planner/matrix";
import { MyCampsRow } from "@/components/planner/my-camps-row";
import { AddCampModal } from "@/components/planner/add-camp-modal";
import { AddBlockModal } from "@/components/planner/add-block-modal";
import { useScrapeJob } from "@/lib/use-scrape-job";
import { generateWeeks, getWeekKey, formatTimeSlot, formatPrice, formatPriceUnit } from "@/lib/format";
import { detectSharedEntries } from "@/lib/planner-matrix";
import type { PlannerEntryRow, UserCampWithActivity, PlannerBlockWithKids } from "@/lib/queries";

interface Kid {
  id: string;
  name: string;
  birth_date: string;
  color: string;
  avatar_url: string | null;
  sort_order: number;
  interests: string[];
}

interface Props {
  kids: Kid[];
  entries: PlannerEntryRow[];
  userCamps: UserCampWithActivity[];
  blocks: PlannerBlockWithKids[];
  shareCampsDefault: boolean;
}

export function PlannerClient({ kids, entries, userCamps, blocks, shareCampsDefault }: Props) {
  const router = useRouter();
  const [campModal, setCampModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [blockModal, setBlockModal] = useState<{ childId: string | null; weekStart: string | null } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Poll active scrape job; when done, refresh the page data.
  const { done } = useScrapeJob(activeJobId);
  useMemo(() => {
    if (done && activeJobId) {
      setActiveJobId(null);
      router.refresh();
    }
  }, [done, activeJobId, router]);

  const dateRange = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    return { from, to };
  }, []);

  const weekStarts = useMemo(() => generateWeeks(dateRange.from, dateRange.to), [dateRange]);

  // Sharing detection
  const sharingInput = entries.map((e) => ({
    entryId: e.id,
    childId: e.child_id,
    activityId: e.session.activity.id,
    weekKey: getWeekKey(new Date(e.session.starts_at + "T00:00:00")),
  }));
  const sharedMap = detectSharedEntries(sharingInput, kids.map((k) => ({ id: k.id, name: k.name })));

  // Build week rows
  const weeks: WeekRow[] = weekStarts.map((weekStart) => {
    const weekKey = getWeekKey(weekStart);

    // Collect cells per kid
    const cells = kids.map((kid) => {
      const kidEntries = entries.filter((e) => {
        if (e.child_id !== kid.id) return false;
        const ws = new Date(e.session.starts_at + "T00:00:00");
        return getWeekKey(ws) === weekKey;
      });
      const cellEntries: CellEntry[] = kidEntries.map((e) => {
        const act = e.session.activity;
        const lowest = act.price_options?.[0];
        return {
          kind: "camp" as const,
          entryId: e.id,
          activityName: act.name,
          activitySlug: act.slug,
          status: e.status,
          timeLabel: e.session.time_slot ? formatTimeSlot(e.session.time_slot as any) : null,
          priceLabel: lowest ? `${formatPrice(lowest.price_cents)}${formatPriceUnit(lowest.price_unit as any)}` : null,
          sharedWith: sharedMap.get(e.id) ?? [],
          isLoading: !act.verified && (act.price_options?.length ?? 0) === 0,
        };
      });
      return { childId: kid.id, entries: cellEntries };
    });

    // Full-row blocks: those targeting ALL kids overlapping this week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const overlaps = blocks.filter(
      (b) => new Date(b.start_date) <= weekEnd && new Date(b.end_date) >= weekStart
    );

    let fullRowBlock: WeekRow["fullRowBlock"] = null;
    const partialBlocksByChild: WeekRow["partialBlocksByChild"] = {};
    for (const b of overlaps) {
      const coversAll = kids.every((k) => b.child_ids.includes(k.id));
      if (coversAll) {
        fullRowBlock = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji, subtitle: `${b.child_ids.length} kids` };
      } else {
        for (const cid of b.child_ids) partialBlocksByChild[cid] = { blockId: b.id, type: b.type, title: b.title, emoji: b.emoji };
      }
    }

    return { weekStart, cells, fullRowBlock, partialBlocksByChild };
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl mb-1">Planner</h1>
          <p className="text-stone">{kids.length} kid{kids.length === 1 ? "" : "s"} · {weeks.length} weeks</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCampModal({ childId: null, weekStart: null })}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-bark text-cream hover:bg-bark/90"
          >
            + Add camp
          </button>
          <button
            onClick={() => setBlockModal({ childId: null, weekStart: null })}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-white border border-driftwood text-bark hover:border-bark"
          >
            + Add block
          </button>
        </div>
      </header>

      <MyCampsRow
        camps={userCamps}
        onChipClick={(c) => router.push(`/activity/${c.activity.slug}`)}
        onAddClick={() => setCampModal({ childId: null, weekStart: null })}
      />

      <PlannerMatrix
        children={kids}
        weeks={weeks}
        onAddCampClick={(childId, weekStart) => setCampModal({ childId, weekStart })}
        onAddBlockClick={(childId, weekStart) => setBlockModal({ childId, weekStart })}
        onChanged={() => router.refresh()}
      />

      <AddCampModal
        open={campModal !== null}
        onClose={() => setCampModal(null)}
        scope={campModal ?? { childId: null, weekStart: null }}
        shareCampsDefault={shareCampsDefault}
        onSubmitted={(result) => {
          if (result.jobId) setActiveJobId(result.jobId);
          router.refresh();
        }}
      />
      <AddBlockModal
        open={blockModal !== null}
        onClose={() => setBlockModal(null)}
        children={kids}
        scope={blockModal ?? { childId: null, weekStart: null }}
        onSubmitted={() => router.refresh()}
      />
    </main>
  );
}
```

- [ ] **Step 2: Run type-check**

```bash
npx tsc --noEmit
```

Fix any type mismatches. Expected: existing scraper test errors remain, but no new errors in app code.

- [ ] **Step 3: Commit**

```bash
git add src/app/planner/client.tsx
git commit -m "refactor(planner): full client orchestrator with matrix, modals, and polling"
```

---

### Task 25: Update .ics export to use 3-state semantics

**Files:**
- Modify: `src/lib/ics.ts`
- Create: `tests/lib/ics.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/ics.test.ts
import { describe, it, expect } from "vitest";
import { generateICS } from "@/lib/ics";

function fakeEntry(status: "considering" | "waitlisted" | "registered") {
  return {
    id: "e1",
    user_id: "u1",
    child_id: "c1",
    session_id: "s1",
    status,
    sort_order: 0,
    notes: null,
    created_at: "2026-04-20",
    session: {
      id: "s1",
      starts_at: "2026-06-22",
      ends_at: "2026-06-26",
      time_slot: "full_day",
      hours_start: null,
      hours_end: null,
      is_sold_out: false,
      activity: {
        id: "a1",
        name: "Camp Kanata",
        slug: "camp-kanata",
        categories: [],
        registration_url: null,
        organization: null,
        price_options: [],
        activity_locations: [],
      },
    },
  } as any;
}

describe("generateICS", () => {
  it("skips considering entries", () => {
    const ics = generateICS([fakeEntry("considering")], "Camila");
    expect(ics).not.toContain("Camp Kanata");
  });

  it("exports registered entries as CONFIRMED", () => {
    const ics = generateICS([fakeEntry("registered")], "Camila");
    expect(ics).toContain("Camp Kanata");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("exports waitlisted entries as TENTATIVE", () => {
    const ics = generateICS([fakeEntry("waitlisted")], "Camila");
    expect(ics).toContain("Camp Kanata");
    expect(ics).toContain("STATUS:TENTATIVE");
  });
});
```

Run: `npx vitest run tests/lib/ics.test.ts` → FAIL (current ics only filters by locked_in).

- [ ] **Step 2: Update ics.ts**

Open `src/lib/ics.ts`. Find:
```ts
const lockedEntries = entries.filter((e) => e.status === "locked_in");
```

Replace with:
```ts
const exportable = entries.filter((e) => e.status === "registered" || e.status === "waitlisted");
```

Rename the `lockedEntries` variable references throughout to `exportable`. In the VEVENT block builder, add:
```ts
const icsStatus = entry.status === "registered" ? "CONFIRMED" : "TENTATIVE";
```

Insert `"STATUS:" + icsStatus,` into the VEVENT array just after `"SUMMARY:..."`.

Also: since the status enum renamed from `"locked_in"` → `"registered"`, verify any other references to old status names are updated.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/lib/ics.test.ts` → PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/ics.ts tests/lib/ics.test.ts
git commit -m "feat(ics): export registered as CONFIRMED and waitlisted as TENTATIVE"
```

---

### Task 26: Mobile responsive fallback (single-kid view)

**Files:**
- Modify: `src/components/planner/matrix.tsx`

- [ ] **Step 1: Add a kid selector + narrow-screen branch**

Above the existing return, detect viewport:

```tsx
const [narrow, setNarrow] = useState(false);
useEffect(() => {
  const mq = window.matchMedia("(max-width: 767px)");
  setNarrow(mq.matches);
  const handler = (e: MediaQueryListEvent) => setNarrow(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, []);
const [focusedKidId, setFocusedKidId] = useState(orderedIds[0]);
useEffect(() => { if (!orderedIds.includes(focusedKidId)) setFocusedKidId(orderedIds[0]); }, [orderedIds]);
```

Then, when `narrow && orderedChildren.length > 1`, render a kid-chip selector and pass only the focused kid into the grid:

```tsx
if (narrow && orderedChildren.length > 1) {
  const focused = orderedChildren.find((c) => c.id === focusedKidId) ?? orderedChildren[0];
  const focusedCells = (wc: WeekCell[]) => wc.filter((c) => c.childId === focused.id);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {orderedChildren.map((c) => (
          <button
            key={c.id}
            onClick={() => setFocusedKidId(c.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm flex items-center gap-2 ${c.id === focusedKidId ? "bg-white" : "bg-white opacity-60"}`}
            style={{ borderColor: c.id === focusedKidId ? c.color : "#d9c9b0" }}
          >
            <KidAvatar name={c.name} color={c.color} avatarUrl={c.avatar_url} size={22} />
            {c.name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {weeks.map((w) => {
          const weekKey = getWeekKey(w.weekStart);
          const weekStartStr = w.weekStart.toISOString().split("T")[0];
          if (w.fullRowBlock) {
            return (
              <div key={weekKey}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-stone mb-1">{formatWeekRange(w.weekStart)}</div>
                <BlockCard blockId={w.fullRowBlock.blockId} type={w.fullRowBlock.type} title={w.fullRowBlock.title} emoji={w.fullRowBlock.emoji} subtitle={w.fullRowBlock.subtitle} onChanged={onChanged} />
              </div>
            );
          }
          const partial = w.partialBlocksByChild[focused.id];
          return (
            <div key={weekKey}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-stone mb-1">{formatWeekRange(w.weekStart)}</div>
              {partial ? (
                <BlockCard blockId={partial.blockId} type={partial.type} title={partial.title} emoji={partial.emoji} onChanged={onChanged} />
              ) : (
                <PlannerCell
                  childId={focused.id}
                  weekStart={weekStartStr}
                  entries={focusedCells(w.cells).flatMap((c) => c.entries)}
                  onAddClick={(cid, ws) => onAddCampClick(cid, ws)}
                  onChanged={onChanged}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

(Place this block BEFORE the existing `return <DndContext>...` block so it short-circuits on narrow viewports.)

- [ ] **Step 2: Commit**

```bash
git add src/components/planner/matrix.tsx
git commit -m "feat(planner): mobile single-kid fallback with chip selector"
```

---

### Task 27: Smoke test — run through the full flow locally

- [ ] **Step 1: Create `avatars` bucket in Supabase dashboard**

Open Supabase dashboard → Storage → "New bucket". Name: `avatars`. Public: ON. Save.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual checks**

Navigate to `http://localhost:3000/planner` and verify:
- [ ] Page loads with kids as column headers showing avatars + color stripes
- [ ] Drag a kid column by the ⋮⋮ handle; order persists on refresh
- [ ] Click `+ Add camp` globally → modal opens. Type "Camp Kanata". Autocomplete hits appear within a few seconds (if DB has matching activities).
- [ ] Submit → camp appears in My Camps row. If scoped to a kid × week, also appears in that cell as loading.
- [ ] Scrape completes within ~15–30s; card populates with details.
- [ ] Click state badge — cycles through Considering → Waitlisted → Registered.
- [ ] Click `+ Add block` globally → pick "Travel" → fill title/dates → select all kids → submit. Block spans full row.
- [ ] Do the same with one kid selected — block fills only that column.
- [ ] Shrink browser to <768px — single-kid view takes over with chip selector.
- [ ] Visit `/favorites` → 404. Visit `/submit` → redirects to `/planner`. Visit `/explore` → coming-soon page.

- [ ] **Step 4: No commit (verification only)**

---

## Self-Review Notes

- **Spec coverage**: all major sections of the spec map to tasks above (schema → T1; queries → T3; actions → T4/T5; scraper → T6/T7/T8; autocomplete → T9; retired routes → T10; UI building blocks → T11–T17; matrix → T18; add flows → T19/T20; polling → T21; shortlist → T22; page rewrite → T23/T24; .ics → T25; responsive → T26; verify → T27).
- **Crowd-sourcing consent**: captured in T4 (submitCamp passes `consent_share` flag) and T19 (modal checkbox). Moderation queue is the `scrape_jobs` table itself (queued consent=true rows).
- **Verified activities** flip: T7 sets `verified = true` on high-confidence scrapes with consent.
- **Type consistency**: `PlannerEntryStatus` used throughout; `PlannerBlockType` used in block-related components; `ScrapeJobStatus`/`ScrapeConfidence` used in scrape flow.
- **Known deferred**: the on-demand scraper in T7 references existing scraper helpers (`upsertActivity`, etc.) — the import paths may need adjustment once the engineer reads the actual filenames in `src/scraper/`. Noted inline.

## Execution Handoff

Plan complete and saved to [`docs/superpowers/plans/2026-04-20-planner-hero-redesign.md`](docs/superpowers/plans/2026-04-20-planner-hero-redesign.md). Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
