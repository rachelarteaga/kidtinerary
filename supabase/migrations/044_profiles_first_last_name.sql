-- 044_profiles_first_last_name.sql
-- Replace the single optional display_name with required first_name / last_name.
-- display_name becomes a generated column derived from first_name + last_name so
-- every downstream reader (share RPCs, saved-share live RPC, viewer header) keeps
-- working unchanged. Best-effort backfill from auth.users metadata (Google's
-- given_name / family_name) first, then from the existing display_name split on
-- the first space.

-- 1. Add the new columns. Nullable for now so the backfill can run; the app layer
--    will enforce non-empty on every write. (Hard NOT NULL would require an
--    immediate backfill to succeed for every legacy row, which we cannot
--    guarantee without surveying real data first.)
alter table profiles add column first_name text;
alter table profiles add column last_name text;

-- 2. Backfill. Prefer Google's structured fields; fall back to splitting the
--    legacy display_name on the first space.
update profiles p
   set first_name = coalesce(
         nullif(trim(au.raw_user_meta_data ->> 'given_name'), ''),
         nullif(split_part(p.display_name, ' ', 1), '')
       ),
       last_name = coalesce(
         nullif(trim(au.raw_user_meta_data ->> 'family_name'), ''),
         nullif(
           trim(
             case
               when position(' ' in p.display_name) > 0
                 then substring(p.display_name from position(' ' in p.display_name) + 1)
               else ''
             end
           ),
           ''
         )
       )
  from auth.users au
 where p.id = au.id;

-- 3. Drop the SECURITY DEFINER function so we can drop the column it depends on.
drop function if exists get_profile_display_name(uuid);

-- 4. Replace display_name with a generated column. The expression trims and
--    handles the three valid states. Whitespace-only first/last counts as null.
alter table profiles drop column display_name;
alter table profiles add column display_name text
  generated always as (
    case
      when nullif(trim(coalesce(first_name, '')), '') is not null
        and nullif(trim(coalesce(last_name, '')), '') is not null
        then trim(first_name) || ' ' || trim(last_name)
      when nullif(trim(coalesce(first_name, '')), '') is not null
        then trim(first_name)
      else null
    end
  ) stored;

-- 5. Re-create the public resolver function from migration 026. Same body,
--    same grants — display_name now flows through the generated column.
create or replace function get_profile_display_name(target_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select display_name from profiles where id = target_user_id;
$$;

grant execute on function get_profile_display_name(uuid) to anon, authenticated;
