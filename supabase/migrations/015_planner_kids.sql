-- 015_planner_kids.sql
-- Per-planner membership for children. Each planner has a subset of the user's kids.

create table planner_kids (
  planner_id uuid not null references planners(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (planner_id, child_id)
);

create index idx_planner_kids_planner on planner_kids(planner_id);

alter table planner_kids enable row level security;

create policy "Users read own planner_kids"
  on planner_kids for select using (
    exists (select 1 from planners p where p.id = planner_id and p.user_id = auth.uid())
  );
create policy "Users insert own planner_kids"
  on planner_kids for insert with check (
    exists (select 1 from planners p where p.id = planner_id and p.user_id = auth.uid())
  );
create policy "Users update own planner_kids"
  on planner_kids for update using (
    exists (select 1 from planners p where p.id = planner_id and p.user_id = auth.uid())
  );
create policy "Users delete own planner_kids"
  on planner_kids for delete using (
    exists (select 1 from planners p where p.id = planner_id and p.user_id = auth.uid())
  );

-- Backfill: for every existing planner, include every child belonging to the planner's user
insert into planner_kids (planner_id, child_id, sort_order)
select p.id, c.id, coalesce(c.sort_order, 0)
from planners p
join children c on c.user_id = p.user_id
on conflict do nothing;
