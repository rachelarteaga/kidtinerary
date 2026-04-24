-- 030_planner_updated_at.sql
-- Give `planners` a single source-of-truth `updated_at` column so the
-- "Last edited" marker on the My Planners screen reflects every relevant
-- user action (name edits, kid-column reorders, block add/edit/delete,
-- and entry deletes — not just entry updates as before).
--
-- Strategy:
--   1. Add planners.updated_at and planner_blocks.updated_at (the latter for
--      symmetry and future client needs).
--   2. Self-updating triggers on both (mirrors the existing planner_entries
--      pattern).
--   3. Cross-table triggers that touch parent planners.updated_at on any
--      INSERT/UPDATE/DELETE to planner_entries, planner_blocks, or planner_kids.
--   4. Backfill planners.updated_at from the current MAX so existing rows
--      don't all reset to now().

-- 1. Columns ---------------------------------------------------------------

alter table planners
  add column updated_at timestamptz not null default now();

alter table planner_blocks
  add column updated_at timestamptz not null default now();

-- 2. Backfill --------------------------------------------------------------

-- Planners: MAX across the planner row itself, its entries, and its blocks.
update planners p set updated_at = coalesce((
  select max(ts) from (
    select p.created_at as ts
    union all select pe.updated_at from planner_entries pe where pe.planner_id = p.id
    union all select pb.created_at from planner_blocks pb where pb.planner_id = p.id
  ) s
), p.created_at);

-- Blocks: seed updated_at from created_at (they're new columns, so otherwise
-- every block would read as "edited just now").
update planner_blocks set updated_at = created_at;

-- 3. Self-updating triggers (reuse update_updated_at() from migration 002) --

create trigger update_planners_updated_at
  before update on planners
  for each row execute function update_updated_at();

create trigger update_planner_blocks_updated_at
  before update on planner_blocks
  for each row execute function update_updated_at();

-- 4. Cross-table "touch parent planner" trigger -----------------------------

create or replace function touch_planner_updated_at()
returns trigger as $$
declare
  target_planner_id uuid;
begin
  if tg_op = 'DELETE' then
    target_planner_id := old.planner_id;
  else
    target_planner_id := new.planner_id;
  end if;

  if target_planner_id is not null then
    update planners set updated_at = now() where id = target_planner_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer;

-- Attach to each child table. AFTER so the row write lands first.
create trigger touch_planner_from_entries
  after insert or update or delete on planner_entries
  for each row execute function touch_planner_updated_at();

create trigger touch_planner_from_blocks
  after insert or update or delete on planner_blocks
  for each row execute function touch_planner_updated_at();

create trigger touch_planner_from_kids
  after insert or update or delete on planner_kids
  for each row execute function touch_planner_updated_at();
