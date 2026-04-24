-- 029_get_shared_planner_by_token.sql
-- Public resolver for /schedule/[token]. Returns the full planner payload
-- visible to a share token, or null if the token is not found.
--
-- Why: every read in fetchSharedPlannerByToken (shared_schedules, planners,
-- planner_kids, children, planner_entries, planner_blocks, planner_block_kids,
-- user_camps) is RLS-locked to `auth.uid() = user_id`. For an anonymous
-- viewer, every one of those returns zero rows, so the page rendered 404 for
-- everyone except the share owner. Rather than open seven separate scoped
-- read policies (each a chance to leak more than the share intends), one
-- SECURITY DEFINER function returns exactly the payload the share authorizes.
--
-- Filtering matches the prior application-layer behavior:
--   * kids / entries scoped to share.kid_ids ∩ planner_kids
--   * blocks included only if any block_kid overlaps share.kid_ids
--   * color_by_activity_id covers only activities present in the entries

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
  v_payload jsonb;
begin
  select s.token, s.scope, s.user_id, s.planner_id, s.camp_id, s.kid_ids,
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
  'owner-only RLS on planners/kids/entries/blocks/user_camps.';
