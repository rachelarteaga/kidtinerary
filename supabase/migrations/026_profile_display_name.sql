-- 026_profile_display_name.sql
-- Adds a publicly-resolvable display_name to profiles so the shared-planner
-- view can greet recipients with the owner's name ("Rachel's planner")
-- without exposing any other profile fields.

alter table profiles add column display_name text;

-- One-time backfill from existing auth metadata so legacy users get a name
-- immediately. New users pick up display_name when they first save the
-- Edit Profile form (updateProfile action writes both auth metadata and
-- profiles.display_name going forward).
update profiles p
set display_name = (au.raw_user_meta_data ->> 'full_name')
from auth.users au
where p.id = au.id and p.display_name is null;

-- Public resolver used by the shared-schedule token flow. Returns just the
-- display name for a given user id, nothing else. SECURITY DEFINER lets the
-- anon role call it without a broader profiles RLS policy change.
create or replace function get_profile_display_name(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select display_name from profiles where id = target_user_id;
$$;

grant execute on function get_profile_display_name(uuid) to anon, authenticated;
