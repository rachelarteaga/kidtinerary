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
