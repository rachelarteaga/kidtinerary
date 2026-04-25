-- Backfill user_activities.kid_tags from existing planner_entries.
-- Per-row aggregation: for each user_activities row, collect the distinct
-- child_ids that the same user has placed on the same activity (via
-- any session of that activity).

update user_activities ua
set kid_tags = sub.kids
from (
  select ua.id as user_activity_id, array_agg(distinct pe.child_id) as kids
  from user_activities ua
  join sessions s on s.activity_id = ua.activity_id
  join planner_entries pe
    on pe.session_id = s.id
   and pe.user_id = ua.user_id
  where pe.child_id is not null
  group by ua.id
) sub
where ua.id = sub.user_activity_id;
