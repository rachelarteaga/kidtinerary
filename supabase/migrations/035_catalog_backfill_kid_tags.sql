-- Backfill user_camps.kid_tags from existing planner_entries.
-- Per-row aggregation: for each user_camps row, collect the distinct
-- child_ids that the same user has placed on the same activity (via
-- any session of that activity).

update user_camps uc
set kid_tags = sub.kids
from (
  select uc.id as user_camp_id, array_agg(distinct pe.child_id) as kids
  from user_camps uc
  join sessions s on s.activity_id = uc.activity_id
  join planner_entries pe
    on pe.session_id = s.id
   and pe.user_id = uc.user_id
  where pe.child_id is not null
  group by uc.id
) sub
where uc.id = sub.user_camp_id;
