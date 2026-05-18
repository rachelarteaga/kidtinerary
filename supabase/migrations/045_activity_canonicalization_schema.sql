-- 045_activity_canonicalization_schema.sql
-- Schema foundation for activity canonicalization. Each user keeps their own
-- activities row with their own typed name; rows that refer to the same
-- real-world activity share a canonical_fingerprint that the overlap matcher
-- groups by. See PLAN.md for full context.
--
-- This migration is PURELY ADDITIVE:
--   * New columns on organizations and activities (all nullable, except
--     activities.private which has a default).
--   * Two new tables: canonical_exclusions (per-viewer escape hatch) and
--     canonical_resolution_audit (debug/rollback log).
--   * No drops, no behavior change. Existing queries continue to work; the
--     fingerprint columns stay null until PR 2 starts writing them and PR 6
--     backfills the rest.

-- 1. Organizations get their own canonical fingerprint. Region is part of the
--    org-level fingerprint (so "YMCA" in different cities stays separate at
--    the org layer), then activities key off the canonical org. canonical_label
--    is debug-only — never user-facing.
alter table organizations add column canonical_fingerprint text;
alter table organizations add column region text;
alter table organizations add column canonical_label text;

create index organizations_canonical_fingerprint_idx
  on organizations (canonical_fingerprint);

create index organizations_region_canonical_idx
  on organizations (region, canonical_fingerprint);

-- 2. Activities get a canonical fingerprint, region, and the per-row private
--    opt-out. canonical_resolved_at lets the async LLM resolver detect rows
--    that need re-resolution after the model or normalize pipeline improves.
--    private defaults to false so existing rows and new submissions participate
--    in dedup unless the user explicitly opts out.
alter table activities add column canonical_fingerprint text;
alter table activities add column region text;
alter table activities add column private boolean not null default false;
alter table activities add column canonical_resolved_at timestamptz;

create index activities_canonical_fingerprint_idx
  on activities (canonical_fingerprint);

create index activities_region_canonical_idx
  on activities (region, canonical_fingerprint);

-- 3. canonical_exclusions: when a user dismisses a wrong overlap match
--    ("Lions Park Soccer" and "Lions Park Tennis" both fingerprinted the
--    same), they write a row here. The matcher consults this table per
--    viewer at planner-load time and filters those pairs out of the overlap
--    output. Per-viewer scope: viewer's dismissal never affects anyone else's
--    overlap. activity_a_id < activity_b_id is enforced so a pair is stored
--    once regardless of which side dismissed it.
create table canonical_exclusions (
  viewer_id     uuid not null references profiles(id) on delete cascade,
  activity_a_id uuid not null references activities(id) on delete cascade,
  activity_b_id uuid not null references activities(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (viewer_id, activity_a_id, activity_b_id),
  check (activity_a_id < activity_b_id)
);

create index canonical_exclusions_viewer_idx
  on canonical_exclusions (viewer_id);

alter table canonical_exclusions enable row level security;

create policy "Users read own canonical_exclusions"
  on canonical_exclusions for select using (auth.uid() = viewer_id);

create policy "Users insert own canonical_exclusions"
  on canonical_exclusions for insert with check (auth.uid() = viewer_id);

create policy "Users delete own canonical_exclusions"
  on canonical_exclusions for delete using (auth.uid() = viewer_id);

-- 4. canonical_resolution_audit: every time a fingerprint is written or
--    changed (by deterministic normalize on insert, by the async LLM resolver,
--    by backfill, or by manual admin action), we write one row here. Lets us
--    inspect why two rows ended up in the same canonical group, revert a bad
--    backfill by replaying old fingerprints, and tune confidence thresholds
--    from real resolver decisions over time.
--
--    No RLS by default — this is an admin/debug table. Only the service role
--    (which bypasses RLS) writes to it. Anonymous and authenticated reads are
--    blocked because we enable RLS without any policies.
create table canonical_resolution_audit (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null check (entity_type in ('organization', 'activity')),
  entity_id       uuid not null,
  old_fingerprint text,
  new_fingerprint text,
  resolver        text not null check (resolver in ('deterministic', 'llm', 'backfill', 'manual')),
  confidence      numeric,
  reason          text,
  created_at      timestamptz not null default now()
);

create index canonical_resolution_audit_entity_idx
  on canonical_resolution_audit (entity_id, created_at desc);

alter table canonical_resolution_audit enable row level security;

-- No policies = no access for anon/authenticated. service_role bypasses RLS.

comment on table canonical_exclusions is
  'Per-viewer overrides that prevent two activities from matching as overlapping '
  'in the friend planner view, even if their canonical fingerprints agree. '
  'Used when the canonical resolver produces a false-positive merge.';

comment on table canonical_resolution_audit is
  'Append-only log of every canonical_fingerprint write. Captures resolver source '
  '(deterministic/llm/backfill/manual), old/new values, confidence, and reason. '
  'Used for debugging dedup decisions and rolling back bad backfills.';

comment on column activities.private is
  'When true, this activity is a permanent singleton: skips dedup, skips the '
  'LLM resolver index, skips any future catalog visibility. Use for activities '
  'that contain PII or that the user explicitly wants kept out of any matching.';

comment on column activities.canonical_fingerprint is
  'Server-derived join key that groups activities referring to the same '
  'real-world thing. Computed by src/lib/canonical/. Null on legacy rows until '
  'backfill runs; matcher falls back to activity_id while null.';

comment on column activities.region is
  'Lowercased "{city}, {state}" or "online". Used as input to the org-level '
  'canonical fingerprint. See src/lib/canonical/normalize.ts for normalization '
  'rules.';
