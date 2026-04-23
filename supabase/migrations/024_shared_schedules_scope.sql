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

-- Indexes for scope-filtered lookups
create index if not exists shared_schedules_planner_idx on shared_schedules(planner_id) where scope = 'planner';
create index if not exists shared_schedules_camp_idx on shared_schedules(camp_id) where scope = 'camp';
