-- Catalog auto-tag rule: when a planner_entry is created or moved into
-- a kid's column, append that kid_id to the parent user_activities row's
-- kid_tags. Historical attribution is durable — moving an entry away
-- from a kid does NOT remove their tag (per the spec).
--
-- planner_entries do not reference user_activities directly. The chain is:
--   planner_entries.session_id → sessions.activity_id → user_activities.activity_id
--   (with user_activities.user_id = planner_entries.user_id)
--
-- Fires on INSERT and on UPDATE of child_id or session_id (which would
-- change the activity attribution). SECURITY DEFINER so the trigger can
-- update user_activities rows from any RLS context.

create or replace function append_kid_tag_on_planner_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
begin
  if new.child_id is null then
    return new;
  end if;

  -- On UPDATE, skip if nothing relevant changed.
  if tg_op = 'UPDATE'
     and new.child_id is not distinct from old.child_id
     and new.session_id is not distinct from old.session_id then
    return new;
  end if;

  select activity_id into v_activity_id
  from sessions
  where id = new.session_id;

  if v_activity_id is null then
    return new;
  end if;

  update user_activities
  set kid_tags = case
    when new.child_id = any(kid_tags) then kid_tags
    else array_append(kid_tags, new.child_id)
  end
  where user_id = new.user_id and activity_id = v_activity_id;

  return new;
end;
$$;

create trigger trg_planner_entries_auto_tag_kid
  after insert or update on planner_entries
  for each row
  execute function append_kid_tag_on_planner_entry();
