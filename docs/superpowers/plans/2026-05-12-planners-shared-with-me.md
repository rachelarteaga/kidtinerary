# Planners Shared With Me — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users save read-only pointers to planners shared with them, and let anonymous viewers do the same after signing up. Saved planners always reflect the owner's current view; the owner sees a save count.

**Architecture:**
- New `saved_shares` table stores `(user_id, share_id, saved_at, planner_name_at_save)` as a *pointer* — no copying of planner data. Listing joins live `shared_schedules`/`planners`; missing → tombstone using the snapshotted name.
- `get_shared_planner_by_token` RPC is extended to also return `share_id`, `owner_id`, and `save_count` so the viewer can decide which CTA to show and the owner can see usage.
- Anonymous "Sign up to save" path stashes the token in `localStorage` and a drain server action runs on the next authenticated `/schedule/[token]` view.
- `/account/planners` becomes two side-by-side modules (desktop) / tabs (mobile): owned planners and saved shares.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS + SECURITY DEFINER RPCs), TypeScript, vitest for unit tests, Tailwind.

---

## File Structure

**New files:**
- `supabase/migrations/039_saved_shares.sql` — table, indexes, RLS, save-count RPC
- `supabase/migrations/040_share_payload_owner_and_save_count.sql` — extends `get_shared_planner_by_token`
- `src/lib/saved-shares-pending.ts` — pure helpers for the anonymous → account localStorage handoff (testable)
- `src/components/planner/save-share-cta.tsx` — logged-in "Save to My Planners" button + save count pill
- `src/components/planner/anon-save-banner.tsx` — anonymous sticky "Sign up to save" banner
- `src/components/planner/drain-pending-saves.tsx` — client component that drains localStorage on mount
- `src/app/account/planners/shared-with-me-card.tsx` — single card (live + tombstone variants)
- `tests/lib/saved-shares-pending.test.ts` — unit tests for localStorage helpers

**Modified files:**
- `src/lib/queries.ts` — extend `SharedByTokenResult`, add `fetchSavedShares`, add `SavedShareSummary`
- `src/lib/queries-share-mapper.ts` — map new RPC fields
- `src/lib/actions.ts` — add `saveSharedPlanner`, `unsaveSharedPlanner`, `drainPendingShareSaves`
- `src/app/schedule/[token]/page.tsx` — pass `shareId`, `ownerId`, `saveCount`, `viewerId`, `isSaved` to view
- `src/components/planner/shared-planner-view.tsx` — accept new props, render CTA/banner/save-count
- `src/app/account/planners/page.tsx` — fetch saved shares, pass to client
- `src/app/account/planners/client.tsx` — two-column / tabbed layout

---

## Task 1: Schema + RLS for `saved_shares`

**Files:**
- Create: `supabase/migrations/039_saved_shares.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 039_saved_shares.sql
-- Stores read-only "pointers" from a user to a planner-scope share they want
-- to revisit. The table holds NO planner data — listing always joins live
-- shared_schedules/planners so updates from the owner appear automatically.
--
-- planner_name_at_save is a tombstone snapshot used to label the row in
-- "Planners Shared with Me" if the underlying share is later revoked. We
-- intentionally do NOT FK share_id to shared_schedules, so deleting a share
-- leaves the saved row in place to render as a tombstone.

create table saved_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  share_id uuid not null,
  planner_name_at_save text not null,
  saved_at timestamptz not null default now()
);

create unique index saved_shares_user_share_idx
  on saved_shares (user_id, share_id);

create index saved_shares_share_id_idx
  on saved_shares (share_id);

alter table saved_shares enable row level security;

-- Owner of the saved_shares row (the recipient who saved) can read/insert/delete.
-- Naming matches the "Users <verb> own <thing>" convention used across the
-- migration history.
create policy "Users read own saved_shares"
  on saved_shares for select using (auth.uid() = user_id);

create policy "Users insert own saved_shares"
  on saved_shares for insert with check (auth.uid() = user_id);

create policy "Users delete own saved_shares"
  on saved_shares for delete using (auth.uid() = user_id);

-- SECURITY DEFINER counter so the share's *owner* (NOT the saved_shares row
-- owner) can read total save counts for their own shares. RLS on saved_shares
-- would otherwise block that read. Uses auth.uid() directly (no parameter)
-- so a signed-in user can only read counts for shares they themselves own —
-- matches the auth pattern from 038_help_me_find_usage.sql.
create or replace function get_save_counts_for_share_owner()
returns table (share_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ss.id as share_id,
         count(sv.id) as save_count
  from shared_schedules ss
  left join saved_shares sv on sv.share_id = ss.id
  where ss.user_id = auth.uid()
    and ss.scope = 'planner'
  group by ss.id
$$;

revoke execute on function get_save_counts_for_share_owner() from public;
grant execute on function get_save_counts_for_share_owner() to authenticated;

comment on function get_save_counts_for_share_owner() is
  'Returns per-share save counts for shares owned by the caller. SECURITY '
  'DEFINER bypasses recipient-owner RLS on saved_shares so the share owner '
  'can see "N saved" on their My Planners cards. Filters by auth.uid() so '
  'callers can only read counts for shares they themselves own.';
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db push` (or `npx supabase migration up` depending on local setup)
Expected: migration `039_saved_shares.sql` reports `Applying ...` then `Finished`.

- [ ] **Step 3: Smoke-check the table exists**

Run: `npx supabase db reset --linked` is too destructive — instead, in the Supabase SQL editor (or `psql`):

```sql
select table_name from information_schema.tables where table_name = 'saved_shares';
select indexname from pg_indexes where tablename = 'saved_shares';
select polname from pg_policies where tablename = 'saved_shares';
```

Expected: 1 row for table, indexes `saved_shares_pkey`, `saved_shares_user_share_idx`, `saved_shares_share_id_idx`, 3 policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/039_saved_shares.sql
git commit -m "feat(shared-with-me): saved_shares table + RLS + save-count RPC"
```

---

## Task 2: Extend `get_shared_planner_by_token` to return `share_id`, `owner_id`, `save_count`

**Files:**
- Create: `supabase/migrations/040_share_payload_owner_and_save_count.sql`

- [ ] **Step 1: Write the migration**

This re-creates the function with three new fields on the planner payload. We keep the existing structure intact — only the top-level `jsonb_build_object` for `'type','planner'` gains `share_id`, `owner_id`, `save_count`.

```sql
-- 040_share_payload_owner_and_save_count.sql
-- Re-declares get_shared_planner_by_token (see 029 for the resolver rationale,
-- RLS-bypass posture, and filtering invariants).
-- Adds share_id, owner_id, and save_count to the planner payload so the viewer
-- can render the right CTA (Save / Saved / "this is your planner") and the
-- owner can see "N saved" on their card.

create or replace function get_shared_planner_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_share record;
  v_kid_ids uuid[];
  v_save_count bigint;
  v_payload jsonb;
begin
  select s.id, s.token, s.scope, s.user_id, s.planner_id, s.camp_id, s.kid_ids,
         s.include_cost, s.include_personal_block_details, s.recommender_note
  into v_share
  from shared_schedules s
  where s.token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  if v_share.scope = 'camp' then
    if v_share.camp_id is null then
      return null;
    end if;
    return jsonb_build_object(
      'type', 'camp',
      'token', v_share.token,
      'camp_id', v_share.camp_id,
      'recommender_note', v_share.recommender_note
    );
  end if;

  if v_share.planner_id is null then
    return null;
  end if;

  v_kid_ids := coalesce(v_share.kid_ids, array[]::uuid[]);

  select count(*) into v_save_count from saved_shares where share_id = v_share.id;

  with
    p as (
      select id, name, start_date, end_date
      from planners
      where id = v_share.planner_id
    ),
    kids as (
      select c.id, c.name, c.birth_date, c.avatar_url, c.color, pk.sort_order
      from planner_kids pk
      join children c on c.id = pk.child_id
      where pk.planner_id = v_share.planner_id
        and c.id = any(v_kid_ids)
    ),
    entry_rows as (
      select
        pe.id, pe.child_id, pe.status, pe.sort_order, pe.notes,
        pe.price_cents, pe.price_unit, pe.session_part, pe.days_of_week,
        ss.id as session_id, ss.starts_at, ss.ends_at, ss.time_slot,
        ss.hours_start, ss.hours_end, ss.is_sold_out,
        a.id as activity_id, a.name as activity_name, a.slug, a.categories,
        a.registration_url, a.description, a.organization_id
      from planner_entries pe
      join sessions ss on ss.id = pe.session_id
      join activities a on a.id = ss.activity_id
      where pe.planner_id = v_share.planner_id
        and pe.child_id = any(v_kid_ids)
    ),
    block_rows as (
      select
        pb.id, pb.type, pb.title, pb.start_date, pb.end_date,
        coalesce(
          (select array_agg(pbk.child_id)
             from planner_block_kids pbk
             where pbk.block_id = pb.id),
          array[]::uuid[]
        ) as block_kid_ids
      from planner_blocks pb
      where pb.planner_id = v_share.planner_id
    ),
    activity_ids as (
      select array_agg(distinct activity_id) as ids from entry_rows
    )
  select jsonb_build_object(
    'type', 'planner',
    'token', v_share.token,
    'share_id', v_share.id,
    'owner_id', v_share.user_id,
    'save_count', v_save_count,
    'planner_id', v_share.planner_id,
    'kid_ids', to_jsonb(v_kid_ids),
    'include_cost', v_share.include_cost,
    'include_personal_block_details', v_share.include_personal_block_details,
    'planner', (select to_jsonb(p) from p),
    'owner_display_name', (
      select display_name from profiles where id = v_share.user_id
    ),
    'kids', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', k.id, 'name', k.name, 'birth_date', k.birth_date,
                'avatar_url', k.avatar_url, 'color', k.color
              ) order by k.sort_order)
         from kids k),
      '[]'::jsonb
    ),
    'entries', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', e.id,
                'child_id', e.child_id,
                'status', e.status,
                'sort_order', e.sort_order,
                'notes', e.notes,
                'price_cents', e.price_cents,
                'price_unit', e.price_unit,
                'session_part', e.session_part,
                'days_of_week', e.days_of_week,
                'session', jsonb_build_object(
                  'id', e.session_id,
                  'starts_at', e.starts_at,
                  'ends_at', e.ends_at,
                  'time_slot', e.time_slot,
                  'hours_start', e.hours_start,
                  'hours_end', e.hours_end,
                  'is_sold_out', e.is_sold_out,
                  'activity', jsonb_build_object(
                    'id', e.activity_id,
                    'name', e.activity_name,
                    'slug', e.slug,
                    'categories', e.categories,
                    'registration_url', e.registration_url,
                    'description', e.description,
                    'organization', (
                      select jsonb_build_object('id', o.id, 'name', o.name)
                      from organizations o where o.id = e.organization_id
                    ),
                    'activity_locations', coalesce(
                      (select jsonb_agg(jsonb_build_object(
                                'id', al.id,
                                'address', al.address,
                                'location_name', al.location_name
                              ))
                         from activity_locations al
                         where al.activity_id = e.activity_id),
                      '[]'::jsonb
                    )
                  )
                )
              ) order by e.sort_order)
         from entry_rows e),
      '[]'::jsonb
    ),
    'blocks', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', b.id,
                'type', b.type,
                'title', b.title,
                'start_date', b.start_date,
                'end_date', b.end_date,
                'kid_ids', to_jsonb(b.block_kid_ids)
              ))
         from block_rows b
         where exists (
           select 1
           from unnest(b.block_kid_ids) as bk(child_id)
           where bk.child_id = any(v_kid_ids)
         )),
      '[]'::jsonb
    ),
    'color_by_activity_id', coalesce(
      (select jsonb_object_agg(uc.activity_id::text, uc.color)
         from user_camps uc, activity_ids ai
         where uc.user_id = v_share.user_id
           and ai.ids is not null
           and uc.activity_id = any(ai.ids)),
      '{}'::jsonb
    )
  )
  into v_payload;

  return v_payload;
end;
$$;

revoke execute on function get_shared_planner_by_token(text) from public;
grant execute on function get_shared_planner_by_token(text) to anon, authenticated;

comment on function get_shared_planner_by_token(text) is
  'Public resolver for /schedule/[token]. Returns the planner payload visible '
  'to the share, or null if the token is not found. SECURITY DEFINER bypasses '
  'owner-only RLS on planners/kids/entries/blocks/user_camps. '
  '040: also returns share_id, owner_id, and save_count for viewer CTA and owner usage.';
```

- [ ] **Step 2: Apply migration locally + smoke check via SQL**

Run: `npx supabase migration up` (or repo equivalent).
Then in SQL editor:

```sql
select get_shared_planner_by_token('<an_existing_token>')->>'share_id' as share_id,
       get_shared_planner_by_token('<an_existing_token>')->>'owner_id' as owner_id,
       get_shared_planner_by_token('<an_existing_token>')->>'save_count' as save_count;
```

Expected: non-null `share_id`, non-null `owner_id`, `save_count = "0"` (string).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/040_share_payload_owner_and_save_count.sql
git commit -m "feat(shared-with-me): include share_id, owner_id, save_count in share payload"
```

---

## Task 3: Update TypeScript types + RPC mapper

**Files:**
- Modify: `src/lib/queries.ts:424-489` (extend `SharedByTokenResult.planner` variant)
- Modify: `src/lib/queries-share-mapper.ts` (read new fields)

- [ ] **Step 1: Extend `SharedByTokenResult` planner variant in `src/lib/queries.ts`**

Find the planner variant in the discriminated union starting at line ~424:

```ts
  | {
      type: "planner";
      token: string;
      plannerId: string;
```

Add three fields right after `plannerId`:

```ts
  | {
      type: "planner";
      token: string;
      shareId: string;
      ownerId: string;
      saveCount: number;
      plannerId: string;
```

- [ ] **Step 2: Map the new fields in `src/lib/queries-share-mapper.ts`**

Inside the `if (data.type !== "planner" ...) ...` block, in the returned object after `token: data.token,` add:

```ts
    shareId: data.share_id,
    ownerId: data.owner_id,
    saveCount: typeof data.save_count === "number"
      ? data.save_count
      : Number(data.save_count ?? 0),
```

(Postgres can return `bigint` as either string or number depending on driver — coerce defensively.)

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: passes. If callers of `SharedByTokenResult` complain, they will — we update them in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries.ts src/lib/queries-share-mapper.ts
git commit -m "feat(shared-with-me): plumb shareId/ownerId/saveCount through share types"
```

---

## Task 4: `save_shared_planner` RPC + server actions

**Files:**
- Create: `supabase/migrations/041_save_shared_planner_rpc.sql`
- Modify: `src/lib/actions.ts` (append three new exported actions)

- [ ] **Step 1: Write the RPC migration**

```sql
-- 041_save_shared_planner_rpc.sql
-- Insert-or-update wrapper that lets a recipient save a share by share_id
-- without granting them direct SELECT on shared_schedules. SECURITY DEFINER so
-- it can read the owner of the share for the self-save check; it still only
-- inserts rows for auth.uid(), so RLS-equivalent ownership of saved_shares is
-- preserved.

create or replace function save_shared_planner(
  p_share_id uuid,
  p_planner_name_at_save text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner from shared_schedules
    where id = p_share_id and scope = 'planner' limit 1;

  if v_owner is null then
    raise exception 'Share not found';
  end if;

  -- A share owner doesn't need to save their own share. No-op rather than
  -- error so the drain action can be called blindly over a list of tokens.
  if v_owner = auth.uid() then
    return;
  end if;

  insert into saved_shares (user_id, share_id, planner_name_at_save)
    values (auth.uid(), p_share_id, p_planner_name_at_save)
    on conflict (user_id, share_id) do update
      set planner_name_at_save = excluded.planner_name_at_save;
end;
$$;

revoke execute on function save_shared_planner(uuid, text) from public;
grant execute on function save_shared_planner(uuid, text) to authenticated;

comment on function save_shared_planner(uuid, text) is
  'Insert-or-update the calling user''s saved_shares row for the given share. '
  'Idempotent; silent no-op if the caller owns the share. SECURITY DEFINER so '
  'it can read shared_schedules.user_id (owner-only RLS) to perform the '
  'self-save check without granting the recipient SELECT on shared_schedules.';
```

- [ ] **Step 2: Apply migration + smoke**

Run: `npx supabase migration up`
Then:

```sql
select proname from pg_proc where proname = 'save_shared_planner';
```

Expected: 1 row.

- [ ] **Step 3: Add the three server actions to `src/lib/actions.ts`**

Append the following near the existing share actions (after `revokeShare` around line ~1770):

```ts
/**
 * Save a planner-scope share to the current user's "Planners Shared with Me"
 * list. Idempotent. share_id is stable across token rotations.
 * plannerNameAtSave is snapshotted onto the row so we can render a tombstone
 * if the owner later revokes the share. The caller (the viewer page) gets
 * both values from the public get_shared_planner_by_token payload.
 */
export async function saveSharedPlanner(input: {
  shareId: string;
  plannerNameAtSave: string;
}): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.rpc("save_shared_planner", {
    p_share_id: input.shareId,
    p_planner_name_at_save: input.plannerNameAtSave,
  });
  if (error) return { error: error.message };

  revalidatePath("/account/planners");
  return {};
}

export async function unsaveSharedPlanner(shareId: string): Promise<{ error?: string }> {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("saved_shares")
    .delete()
    .eq("user_id", user.id)
    .eq("share_id", shareId);

  if (error) return { error: error.message };

  revalidatePath("/account/planners");
  return {};
}

/**
 * Drain pending tokens stashed in localStorage by the anonymous "Sign up to
 * save" banner. Resolves each token via the public RPC and forwards to
 * save_shared_planner. Tokens with no matching share, or that the caller
 * owns, are silently skipped (the RPC is also no-op for self-shares, but we
 * short-circuit here too to avoid a round-trip). Already-saved tokens count
 * toward `saved` (the RPC's `on conflict do update` makes re-saves a normal
 * success); the user-visible effect is just a slightly inflated toast count.
 */
export async function drainPendingShareSaves(tokens: string[]): Promise<{
  saved: number;
  skipped: number;
}> {
  if (!tokens.length) return { saved: 0, skipped: 0 };

  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: 0, skipped: tokens.length };

  let saved = 0;
  let skipped = 0;

  for (const token of tokens) {
    const { data } = await supabase.rpc("get_shared_planner_by_token", { p_token: token });
    if (!data || data.type !== "planner") {
      skipped += 1;
      continue;
    }
    if (data.owner_id === user.id) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.rpc("save_shared_planner", {
      p_share_id: data.share_id,
      p_planner_name_at_save: data.planner?.name ?? "Untitled planner",
    });
    if (error) {
      skipped += 1;
    } else {
      saved += 1;
    }
  }

  if (saved > 0) revalidatePath("/account/planners");
  return { saved, skipped };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/041_save_shared_planner_rpc.sql src/lib/actions.ts
git commit -m "feat(shared-with-me): save/unsave/drain server actions + save_shared_planner RPC"
```

---

## Task 5: Query — `fetchSavedShares(userId)` + `SavedShareSummary` type

**Files:**
- Modify: `src/lib/queries.ts` (append a new exported type and function near `fetchUserPlanners`)

- [ ] **Step 1: Add the type and function**

Append after `fetchUserPlanners` (around line ~855):

```ts
export interface SavedShareSummary {
  /** saved_shares.id (for unsave) */
  savedShareId: string;
  /** shared_schedules.id; null only if the share has been revoked → tombstone */
  shareId: string;
  /** Token to open the live planner; null if revoked */
  token: string | null;
  /** Snapshot at save time; used as display name on tombstones */
  plannerNameAtSave: string;
  /** Live planner name (null when revoked) */
  plannerName: string | null;
  /** Live planner date range (null when revoked) */
  plannerStart: string | null;
  plannerEnd: string | null;
  /** Display name of the share owner (null when revoked or profile missing) */
  ownerDisplayName: string | null;
  /** ISO timestamp the recipient saved the share */
  savedAt: string;
  /** True when the underlying share row no longer exists */
  isTombstone: boolean;
}

/**
 * Returns all saved shares for the given user. Live shares join through to
 * shared_schedules + planners; revoked shares come back as tombstones with
 * the snapshotted planner name and no token.
 */
export async function fetchSavedShares(userId: string): Promise<SavedShareSummary[]> {
  const supabase = (await createClient()) as any;

  const { data: savedRows, error: savedErr } = await supabase
    .from("saved_shares")
    .select("id, share_id, planner_name_at_save, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });

  if (savedErr || !savedRows || savedRows.length === 0) {
    if (savedErr) console.error("fetchSavedShares saved_shares error:", savedErr);
    return [];
  }

  const shareIds = (savedRows as { share_id: string }[]).map((r) => r.share_id);

  // shared_schedules.select RLS is owner-only, so we cannot read directly as
  // the recipient. Resolve via a small SECURITY DEFINER RPC that returns the
  // public-safe fields for the given share ids. See migration 041 below.
  const { data: liveRows, error: liveErr } = await supabase.rpc(
    "get_saved_shares_live",
    { p_share_ids: shareIds },
  );
  if (liveErr) {
    console.error("fetchSavedShares live error:", liveErr);
  }

  const liveByShareId = new Map<string, {
    token: string;
    planner_name: string;
    planner_start: string;
    planner_end: string;
    owner_display_name: string | null;
  }>();
  for (const row of (liveRows ?? []) as any[]) {
    liveByShareId.set(row.share_id, row);
  }

  return (savedRows as {
    id: string;
    share_id: string;
    planner_name_at_save: string;
    saved_at: string;
  }[]).map((row) => {
    const live = liveByShareId.get(row.share_id);
    return {
      savedShareId: row.id,
      shareId: row.share_id,
      token: live?.token ?? null,
      plannerNameAtSave: row.planner_name_at_save,
      plannerName: live?.planner_name ?? null,
      plannerStart: live?.planner_start ?? null,
      plannerEnd: live?.planner_end ?? null,
      ownerDisplayName: live?.owner_display_name ?? null,
      savedAt: row.saved_at,
      isTombstone: !live,
    };
  });
}
```

- [ ] **Step 2: Add the `get_saved_shares_live` RPC — new migration `042_get_saved_shares_live.sql`**

```sql
-- 042_get_saved_shares_live.sql
-- SECURITY DEFINER reader so a recipient can fetch the public-safe live
-- fields for shares they've saved. RLS on shared_schedules is owner-only,
-- so recipients can't read those rows directly.

create or replace function get_saved_shares_live(p_share_ids uuid[])
returns table (
  share_id uuid,
  token text,
  planner_name text,
  planner_start date,
  planner_end date,
  owner_display_name text
)
language sql
stable
security definer
set search_path = public
as $$
  -- Only return rows that the caller has actually saved. This prevents the
  -- function from being used to probe arbitrary share ids.
  select ss.id as share_id,
         ss.token,
         p.name as planner_name,
         p.start_date as planner_start,
         p.end_date as planner_end,
         pr.display_name as owner_display_name
  from shared_schedules ss
  join planners p on p.id = ss.planner_id
  left join profiles pr on pr.id = ss.user_id
  where ss.scope = 'planner'
    and ss.id = any(p_share_ids)
    and exists (
      select 1 from saved_shares sv
      where sv.user_id = auth.uid()
        and sv.share_id = ss.id
    );
$$;

revoke execute on function get_saved_shares_live(uuid[]) from public;
grant execute on function get_saved_shares_live(uuid[]) to authenticated;
```

- [ ] **Step 3: Apply migration + smoke**

```sql
select * from get_saved_shares_live(array[]::uuid[]);  -- returns 0 rows, no error
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts supabase/migrations/042_get_saved_shares_live.sql
git commit -m "feat(shared-with-me): fetchSavedShares + live-fields RPC"
```

---

## Task 6: Plumb new fields through the viewer page

**Files:**
- Modify: `src/app/schedule/[token]/page.tsx` (resolve current viewer, pass new props)
- Modify: `src/components/planner/shared-planner-view.tsx` (accept new props)

- [ ] **Step 1: Update `src/app/schedule/[token]/page.tsx`**

Replace the entire file with:

```tsx
import { notFound, redirect } from "next/navigation";
import { fetchSharedPlannerByToken } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SharedPlannerView } from "@/components/planner/shared-planner-view";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedSchedulePage({ params }: PageProps) {
  const { token } = await params;
  const result = await fetchSharedPlannerByToken(token);

  if (result.type === "notfound") {
    notFound();
  }

  if (result.type === "camp") {
    redirect(`/camps/${result.campId}?share=${result.token}`);
  }

  // Identify the viewer (if any) and whether they've already saved this share.
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  let isSaved = false;
  if (user) {
    const { data } = await supabase
      .from("saved_shares")
      .select("id")
      .eq("user_id", user.id)
      .eq("share_id", result.shareId)
      .maybeSingle();
    isSaved = !!data;
  }

  const isOwner = !!user && user.id === result.ownerId;

  return (
    <SharedPlannerView
      token={result.token}
      shareId={result.shareId}
      plannerName={result.plannerName}
      plannerStart={result.plannerStart}
      plannerEnd={result.plannerEnd}
      ownerDisplayName={result.ownerDisplayName}
      kids={result.kids}
      entries={result.entries}
      blocks={result.blocks}
      filters={{
        kidIds: result.kidIds,
        includeCost: result.includeCost,
        includePersonalBlockDetails: result.includePersonalBlockDetails,
      }}
      colorByActivityId={result.colorByActivityId}
      viewerState={{
        isAuthenticated: !!user,
        isOwner,
        isSaved,
        saveCount: result.saveCount,
      }}
    />
  );
}
```

- [ ] **Step 2: Update the `Props` interface in `src/components/planner/shared-planner-view.tsx`**

Open `src/components/planner/shared-planner-view.tsx`. Add the new prop to the existing `interface Props` (around line 63):

```ts
interface Props {
  token: string;
  shareId: string;
  plannerName: string;
  plannerStart: string;
  plannerEnd: string;
  ownerDisplayName: string | null;
  kids: KidRow[];
  entries: EntryRow[];
  blocks: BlockRow[];
  filters: { kidIds: string[]; includeCost: boolean; includePersonalBlockDetails: boolean };
  colorByActivityId: Record<string, string>;
  forceViewMode?: "detail" | "simple";
  viewerState: {
    isAuthenticated: boolean;
    isOwner: boolean;
    isSaved: boolean;
    saveCount: number;
  };
}
```

Then update the function signature to destructure the new prop:

```ts
export function SharedPlannerView({
  token,
  shareId,
  plannerName,
  // ... existing props
  viewerState,
}: Props) {
```

(The component body integrates the CTA in Task 7. For now we just accept the prop so the page change typechecks.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/schedule/[token]/page.tsx src/components/planner/shared-planner-view.tsx
git commit -m "feat(shared-with-me): pass viewer/share context into SharedPlannerView"
```

---

## Task 7: `<SaveShareCTA>` component + integration in viewer header

**Files:**
- Create: `src/components/planner/save-share-cta.tsx`
- Modify: `src/components/planner/shared-planner-view.tsx` (render CTA in header)

- [ ] **Step 1: Create `src/components/planner/save-share-cta.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSharedPlanner,
  unsaveSharedPlanner,
} from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

interface Props {
  shareId: string;
  plannerName: string;
  initialIsSaved: boolean;
}

export function SaveShareCTA({ shareId, plannerName, initialIsSaved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [, startTransition] = useTransition();

  function handleSave() {
    setIsSaved(true);
    startTransition(async () => {
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

  if (isSaved) {
    return (
      <button
        type="button"
        onClick={handleUnsave}
        className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-ink text-ink bg-base hover:bg-surface"
      >
        Saved · remove
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      className="font-sans font-bold text-[11px] uppercase tracking-widest px-4 py-2 rounded-full bg-ink text-ink-inverse border border-ink hover:bg-[#333]"
    >
      Save to my planners
    </button>
  );
}
```

- [ ] **Step 2: Render the CTA + save-count pill in `SharedPlannerView`**

In `src/components/planner/shared-planner-view.tsx`, find the existing header area (search for `plannerName` + `ownerDisplayName` rendering). Inside that header block, add the CTA. The exact JSX depends on the current header — add as a sibling to the planner title:

```tsx
{viewerState.isAuthenticated && !viewerState.isOwner && (
  <SaveShareCTA
    shareId={shareId}
    plannerName={plannerName}
    initialIsSaved={viewerState.isSaved}
  />
)}
{viewerState.isOwner && viewerState.saveCount > 0 && (
  <span
    className="font-sans text-[11px] uppercase tracking-widest text-ink-2"
    aria-label={`${viewerState.saveCount} people saved this planner`}
  >
    {viewerState.saveCount} saved
  </span>
)}
```

Add the import at the top:

```tsx
import { SaveShareCTA } from "./save-share-cta";
```

- [ ] **Step 3: Manual verification**

1. Start dev server: `npm run dev`
2. As the planner owner, open `/schedule/<your_token>`. **Expected:** no Save CTA. If `save_count > 0`, "N saved" pill appears.
3. Open the same URL in an incognito window while logged in as a *different* user. **Expected:** "Save to my planners" button.
4. Click Save. **Expected:** button turns into "Saved · remove", toast appears, network call succeeds.
5. Re-open `/account/planners` as the owner — pill should reflect the new count after refresh.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/save-share-cta.tsx src/components/planner/shared-planner-view.tsx
git commit -m "feat(shared-with-me): logged-in Save CTA + owner save-count pill"
```

---

## Task 8: Anonymous "Sign up to save" banner + localStorage stash

**Files:**
- Create: `src/lib/saved-shares-pending.ts`
- Create: `tests/lib/saved-shares-pending.test.ts`
- Create: `src/components/planner/anon-save-banner.tsx`
- Modify: `src/components/planner/shared-planner-view.tsx` (render the banner)

- [ ] **Step 1: Write the helpers**

Create `src/lib/saved-shares-pending.ts`:

```ts
const KEY = "kt:pendingSaveTokens";

/** Read pending tokens stashed for post-signup auto-save. Tolerant of malformed storage. */
export function readPendingSaveTokens(storage: Storage): string[] {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/** Push a token onto the pending list; deduplicates. */
export function addPendingSaveToken(storage: Storage, token: string): void {
  const current = readPendingSaveTokens(storage);
  if (current.includes(token)) return;
  current.push(token);
  storage.setItem(KEY, JSON.stringify(current));
}

/** Atomically read + clear the pending list (used during drain). */
export function takePendingSaveTokens(storage: Storage): string[] {
  const tokens = readPendingSaveTokens(storage);
  storage.removeItem(KEY);
  return tokens;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/saved-shares-pending.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  readPendingSaveTokens,
  addPendingSaveToken,
  takePendingSaveTokens,
} from "@/lib/saved-shares-pending";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe("saved-shares-pending", () => {
  let storage: Storage;
  beforeEach(() => { storage = makeStorage(); });

  it("reads empty when nothing stored", () => {
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("addPendingSaveToken stores a token", () => {
    addPendingSaveToken(storage, "abc");
    expect(readPendingSaveTokens(storage)).toEqual(["abc"]);
  });

  it("dedupes tokens", () => {
    addPendingSaveToken(storage, "abc");
    addPendingSaveToken(storage, "abc");
    expect(readPendingSaveTokens(storage)).toEqual(["abc"]);
  });

  it("preserves order across multiple adds", () => {
    addPendingSaveToken(storage, "a");
    addPendingSaveToken(storage, "b");
    addPendingSaveToken(storage, "c");
    expect(readPendingSaveTokens(storage)).toEqual(["a", "b", "c"]);
  });

  it("takePendingSaveTokens drains the list", () => {
    addPendingSaveToken(storage, "a");
    addPendingSaveToken(storage, "b");
    expect(takePendingSaveTokens(storage)).toEqual(["a", "b"]);
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("tolerates corrupted JSON", () => {
    storage.setItem("kt:pendingSaveTokens", "{not json");
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });

  it("tolerates a non-array stored value", () => {
    storage.setItem("kt:pendingSaveTokens", JSON.stringify({ a: 1 }));
    expect(readPendingSaveTokens(storage)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/lib/saved-shares-pending.test.ts`
Expected: 7 passes.

- [ ] **Step 4: Create the banner component**

Create `src/components/planner/anon-save-banner.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { addPendingSaveToken } from "@/lib/saved-shares-pending";

interface Props {
  token: string;
}

/**
 * Sticky banner for anonymous viewers of /schedule/[token]. Stashes the token
 * in localStorage when the viewer clicks the CTA, then routes them to signup.
 * After authentication, the drain component (Task 9) auto-saves the share.
 */
export function AnonSaveBanner({ token }: Props) {
  // Stash the token *before* the user clicks anything, so even returning users
  // who go log in via a different tab still get the auto-save on next visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    addPendingSaveToken(window.localStorage, token);
  }, [token]);

  const next = `/schedule/${encodeURIComponent(token)}`;
  return (
    <div className="sticky top-0 z-30 bg-ink text-ink-inverse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
        <p className="font-sans text-sm">
          Sign up to save this planner — it stays read-only and updates as the owner changes it.
        </p>
        <Link
          href={`/auth/signup?next=${encodeURIComponent(next)}`}
          className="font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-ink-inverse text-ink hover:bg-base flex-shrink-0"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Render the banner in `SharedPlannerView` when anonymous**

In `src/components/planner/shared-planner-view.tsx`, at the top of the returned JSX (before the existing header), add:

```tsx
{!viewerState.isAuthenticated && <AnonSaveBanner token={token} />}
```

Add the import:

```tsx
import { AnonSaveBanner } from "./anon-save-banner";
```

- [ ] **Step 6: Manual verification**

1. Open `/schedule/<token>` in incognito (no session). **Expected:** sticky banner appears.
2. Inspect `localStorage.getItem('kt:pendingSaveTokens')` → returns `["<token>"]`.
3. Click Sign up → routed to `/auth/signup?next=/schedule/<token>`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/saved-shares-pending.ts tests/lib/saved-shares-pending.test.ts \
        src/components/planner/anon-save-banner.tsx \
        src/components/planner/shared-planner-view.tsx
git commit -m "feat(shared-with-me): anonymous Sign-up-to-save banner + localStorage stash"
```

---

## Task 9: Drain pending saves after auth

**Files:**
- Create: `src/components/planner/drain-pending-saves.tsx`
- Modify: `src/components/planner/shared-planner-view.tsx` (mount drainer when authenticated)

- [ ] **Step 1: Create the drain client component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { takePendingSaveTokens } from "@/lib/saved-shares-pending";
import { drainPendingShareSaves } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

/**
 * Runs once on mount for authenticated viewers. Reads any tokens stashed by
 * the anonymous banner and calls the server action to save each. The current
 * token does NOT need special-casing — it lives in the pending list too.
 */
export function DrainPendingSaves() {
  const router = useRouter();
  const { toast } = useToast();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (typeof window === "undefined") return;
    const tokens = takePendingSaveTokens(window.localStorage);
    if (tokens.length === 0) return;
    (async () => {
      const r = await drainPendingShareSaves(tokens);
      if (r.saved > 0) {
        toast(
          r.saved === 1
            ? "Saved to your planners."
            : `Saved ${r.saved} planners to your account.`,
          "success",
        );
        router.refresh();
      }
    })();
  }, [router, toast]);

  return null;
}
```

- [ ] **Step 2: Mount it in `SharedPlannerView`**

Just below the `<AnonSaveBanner>` line, add:

```tsx
{viewerState.isAuthenticated && <DrainPendingSaves />}
```

Add the import:

```tsx
import { DrainPendingSaves } from "./drain-pending-saves";
```

- [ ] **Step 3: Manual verification (full flow)**

1. Incognito → `/schedule/<token>` → click Sign up → complete signup.
2. After onboarding (or directly, depending on `next` plumbing), land back on `/schedule/<token>`.
3. **Expected:** toast "Saved to your planners.", "Save to my planners" button now reads "Saved · remove".
4. Open `/account/planners` → the planner appears in the Shared with Me module (built in Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/drain-pending-saves.tsx \
        src/components/planner/shared-planner-view.tsx
git commit -m "feat(shared-with-me): auto-save pending tokens after authentication"
```

---

## Task 10: My Planners two-module layout (desktop) + tabs (mobile) + tombstone card

**Files:**
- Create: `src/app/account/planners/shared-with-me-card.tsx`
- Modify: `src/app/account/planners/page.tsx`
- Modify: `src/app/account/planners/client.tsx`

- [ ] **Step 1: Update `page.tsx` to fetch saved shares**

Replace contents:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchUserPlanners, fetchSavedShares } from "@/lib/queries";
import { MyPlannersClient } from "./client";

export const metadata = {
  title: "My planners — Kidtinerary",
};

export const dynamic = "force-dynamic";

export default async function MyPlannersPage() {
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [planners, savedShares, kidsRes] = await Promise.all([
    fetchUserPlanners(user.id),
    fetchSavedShares(user.id),
    supabase
      .from("children")
      .select("id, name")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  // Save counts for "N saved" pill on each owned planner card. The RPC
  // filters internally by auth.uid() — no parameter needed.
  const { data: countRows } = await supabase.rpc(
    "get_save_counts_for_share_owner",
  );
  const saveCountByShareId: Record<string, number> = {};
  for (const row of (countRows ?? []) as { share_id: string; save_count: number | string }[]) {
    saveCountByShareId[row.share_id] = Number(row.save_count) || 0;
  }

  return (
    <MyPlannersClient
      initialPlanners={planners}
      initialSavedShares={savedShares}
      saveCountByShareId={saveCountByShareId}
      allKids={(kidsRes.data ?? []) as { id: string; name: string }[]}
    />
  );
}
```

- [ ] **Step 2: Create the shared-with-me card**

`src/app/account/planners/shared-with-me-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { unsaveSharedPlanner } from "@/lib/actions";
import type { SavedShareSummary } from "@/lib/queries";

function formatDateRange(startDate: string, endDate: string): string {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(s, false)} – ${fmt(e, true)}`;
}

interface Props {
  share: SavedShareSummary;
}

export function SharedWithMeCard({ share }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const r = await unsaveSharedPlanner(share.shareId);
      if (r.error) {
        toast(r.error, "error");
        return;
      }
      toast("Removed from your planners.", "success");
      router.refresh();
    });
  }

  if (share.isTombstone) {
    return (
      <div className="rounded-lg border border-dashed border-ink-3 bg-surface p-4 opacity-75">
        <p className="font-display font-extrabold text-lg text-ink-2 line-through">
          {share.plannerNameAtSave}
        </p>
        <p className="font-sans text-xs text-ink-2 mt-1">
          This planner is no longer being shared.
        </p>
        <button
          type="button"
          onClick={handleRemove}
          className="mt-3 font-sans font-bold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
        >
          Remove from list
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-3 bg-surface p-4">
      <Link
        href={`/schedule/${share.token}`}
        className="font-display font-extrabold text-lg text-ink hover:underline"
      >
        {share.plannerName}
      </Link>
      <p className="font-sans text-xs text-ink-2 mt-1">
        {share.plannerStart && share.plannerEnd
          ? formatDateRange(share.plannerStart, share.plannerEnd)
          : null}
        {share.ownerDisplayName ? ` · Shared by ${share.ownerDisplayName}` : null}
      </p>
      <div className="mt-3 pt-3 border-t border-ink-3 flex items-center justify-between gap-2">
        <span className="font-sans text-[11px] uppercase tracking-widest text-ink-2">
          Read-only
        </span>
        <button
          type="button"
          onClick={handleRemove}
          className="font-sans font-bold text-[11px] uppercase tracking-widest text-ink-2 hover:text-ink"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `client.tsx` to render the two-module / tabbed layout**

Open `src/app/account/planners/client.tsx`. Modify:

- Import additions at top:

```tsx
import type { PlannerSummary, SavedShareSummary } from "@/lib/queries";
import { SharedWithMeCard } from "./shared-with-me-card";
```

- Extend `Props`:

```tsx
interface Props {
  initialPlanners: PlannerSummary[];
  initialSavedShares: SavedShareSummary[];
  saveCountByShareId: Record<string, number>;
  allKids: { id: string; name: string }[];
}
```

- Destructure the new props in the component:

```tsx
export function MyPlannersClient({
  initialPlanners,
  initialSavedShares,
  saveCountByShareId,
  allKids,
}: Props) {
```

- Add state + a mobile tab state near the existing `useState` calls:

```tsx
  const [savedShares] = useState(initialSavedShares);
  const [mobileTab, setMobileTab] = useState<"mine" | "shared">("mine");
```

- Replace the existing `<main>` JSX block with a two-column desktop / tabbed mobile layout. Keep the existing planner-list contents (`{planners.length === 0 ? ... : ...}`) — just move them into the left column. Below the page header, replace:

```tsx
{planners.length === 0 ? ( ... ) : ( ... )}
```

with:

```tsx
{/* Mobile tabs */}
<div className="md:hidden mb-4 flex gap-2">
  <button
    type="button"
    onClick={() => setMobileTab("mine")}
    className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
      mobileTab === "mine"
        ? "bg-ink text-ink-inverse border-ink"
        : "bg-transparent text-ink border-ink-3"
    }`}
  >
    My planners
  </button>
  <button
    type="button"
    onClick={() => setMobileTab("shared")}
    className={`flex-1 font-sans font-bold text-[11px] uppercase tracking-widest px-3 py-2 rounded-full border ${
      mobileTab === "shared"
        ? "bg-ink text-ink-inverse border-ink"
        : "bg-transparent text-ink border-ink-3"
    }`}
  >
    Shared with me {savedShares.length > 0 ? `(${savedShares.length})` : null}
  </button>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {/* Owned planners */}
  <section className={mobileTab === "mine" ? "block" : "hidden md:block"}>
    <h2 className="hidden md:block font-display font-extrabold text-lg text-ink mb-3 uppercase tracking-widest">
      My planners
    </h2>
    {planners.length === 0 ? (
      <div className="rounded-lg border border-ink-3 bg-surface p-6">
        <p className="font-sans text-sm text-ink-2">
          You don&apos;t have any planners yet.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {planners.map((p) => (
          <PlannerRow
            key={p.id}
            planner={p}
            saveCount={p.shareId ? saveCountByShareId[p.shareId] ?? 0 : 0}
            onRename={(name) => handleRename(p.id, name)}
            onToggleOn={() => setShareDrawer(p)}
            onToggleOff={() => handleToggleOff(p)}
            onEditSettings={() => setShareDrawer(p)}
            onCopyLink={() => p.shareToken && copyLink(p.shareToken)}
            onDuplicate={() => handleDuplicate(p)}
            onDelete={() => setDeleteConfirm(p)}
          />
        ))}
      </div>
    )}
  </section>

  {/* Shared with me */}
  <section className={mobileTab === "shared" ? "block" : "hidden md:block"}>
    <h2 className="hidden md:block font-display font-extrabold text-lg text-ink mb-3 uppercase tracking-widest">
      Shared with me
    </h2>
    {savedShares.length === 0 ? (
      <div className="rounded-lg border border-ink-3 bg-surface p-6">
        <p className="font-sans text-sm text-ink-2">
          When someone shares a planner with you and you save it, it appears here.
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {savedShares.map((s) => (
          <SharedWithMeCard key={s.savedShareId} share={s} />
        ))}
      </div>
    )}
  </section>
</div>
```

- [ ] **Step 4: Add `saveCount` prop to `PlannerRow` to render "N saved" pill on owner cards**

In the existing `PlannerRow` component (same file), extend the prop type:

```tsx
function PlannerRow({
  planner,
  saveCount,
  ...rest
}: {
  planner: PlannerSummary;
  saveCount: number;
  // ... existing handler props
}) {
```

In the JSX block where existing share controls render (the row near `<ShareStatusBadge />`), append next to the badge:

```tsx
{saveCount > 0 && (
  <span className="font-sans text-[11px] uppercase tracking-widest text-ink-2 ml-2">
    {saveCount} saved
  </span>
)}
```

- [ ] **Step 5: Container width — widen `max-w-3xl` to `max-w-6xl`** so two columns fit

Change `max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12` on the `<main>` element to `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12`.

- [ ] **Step 6: Type-check + manual verify**

Run: `npx tsc --noEmit`
Expected: passes.

Manual:
1. `/account/planners` on desktop. **Expected:** two columns: "My planners" left, "Shared with me" right.
2. Resize to mobile (≤768px). **Expected:** tabs above content, only the selected tab is visible.
3. Save a share from a second account; reload `/account/planners` as the recipient. **Expected:** appears as a card with owner name + date range + Read-only pill.
4. Owner revokes the share. Reload as recipient. **Expected:** card switches to tombstone with strikethrough title.
5. Click Remove on a tombstone. **Expected:** card disappears.

- [ ] **Step 7: Commit**

```bash
git add src/app/account/planners/page.tsx \
        src/app/account/planners/client.tsx \
        src/app/account/planners/shared-with-me-card.tsx
git commit -m "feat(shared-with-me): two-module My Planners layout with mobile tabs"
```

---

## Final verification

- [ ] **End-to-end flow as a fresh user**
  1. Owner (account A) creates a planner, opens share drawer, copies link.
  2. Open link in incognito → banner appears, sign up → onboarding → routed back to `/schedule/<token>` → toast "Saved to your planners."
  3. Navigate to `/account/planners` → planner in "Shared with me" with owner name + date range.
  4. As A, open `/account/planners` → "1 saved" pill on the shared planner row.
  5. As A, revoke the share. As B, reload `/account/planners` → tombstone appears.

- [ ] **Repo hygiene**
  - `npx tsc --noEmit` passes
  - `npx vitest run` passes
  - `npm run lint` (or whatever the project uses) passes
  - All commits pushed to a feature branch
  - PR opened against `main` with summary referencing this plan

---

## Out of scope (intentional, do not build)

- Recipient-addressed shares (owner enters an email; recipient sees it before clicking the link).
- Notifications when an owner changes a saved share.
- Per-recipient view analytics ("who saved this").
- A `/account/sharing` revamp — that page is unchanged.
