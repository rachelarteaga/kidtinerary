-- 027_shared_schedules_one_per_planner.sql
-- Enforce binary sharing: at most one active share row per (user, planner) for
-- planner-scoped shares. Supports the "My planners" catalog upsert behavior —
-- toggling share on re-uses or replaces the single row; toggling off deletes it.
-- Camp-scoped shares are unaffected.

-- Clean up any duplicate planner shares that already exist so the partial
-- unique index can be created. Keep the most recently created row per
-- (user_id, planner_id) and remove the rest.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, planner_id
      order by created_at desc, id desc
    ) as rn
  from shared_schedules
  where scope = 'planner'
)
delete from shared_schedules
where id in (select id from ranked where rn > 1);

create unique index if not exists shared_schedules_one_per_planner_idx
  on shared_schedules (user_id, planner_id)
  where scope = 'planner';
