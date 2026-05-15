-- 041_save_shared_planner_rpc.sql
-- Insert-or-update wrapper that lets a recipient save a share by share_id
-- without granting them direct SELECT on shared_schedules. SECURITY DEFINER so
-- it can read the owner of the share for the self-save check; it still only
-- inserts rows for auth.uid(), so RLS-equivalent ownership of saved_shares is
-- preserved.

create or replace function save_shared_planner(
  p_share_id uuid,
  p_planner_name_at_save text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into v_owner from shared_schedules
    where id = p_share_id and scope = 'planner' limit 1;

  if v_owner is null then
    raise exception 'Share not found';
  end if;

  -- A share owner doesn't need to save their own share. No-op rather than
  -- error so the drain action can be called blindly over a list of tokens.
  if v_owner = auth.uid() then
    return;
  end if;

  insert into saved_shares (user_id, share_id, planner_name_at_save)
    values (auth.uid(), p_share_id, p_planner_name_at_save)
    on conflict (user_id, share_id) do update
      set planner_name_at_save = excluded.planner_name_at_save;
end;
$$;

revoke execute on function save_shared_planner(uuid, text) from public;
grant execute on function save_shared_planner(uuid, text) to authenticated;

comment on function save_shared_planner(uuid, text) is
  'Insert-or-update the calling user''s saved_shares row for the given share. '
  'Idempotent; silent no-op if the caller owns the share. SECURITY DEFINER so '
  'it can read shared_schedules.user_id (owner-only RLS) to perform the '
  'self-save check without granting the recipient SELECT on shared_schedules.';
