-- Add "overnight" to the allowed session_part values on planner_entries.
-- Overnight camps run 24/7 for their assigned days, so they fill both AM and
-- PM slots in the timeline grid and can't coexist with an AM-only or PM-only
-- entry on the same day/kid.

alter table planner_entries
  drop constraint if exists planner_entries_session_part_check;

alter table planner_entries
  add constraint planner_entries_session_part_check
    check (session_part in ('full', 'am', 'pm', 'overnight'));
