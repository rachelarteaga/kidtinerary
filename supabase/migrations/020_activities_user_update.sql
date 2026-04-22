-- 020_activities_user_update.sql
-- Allow authenticated users to UPDATE activities they own via user_camps.
--
-- The activities table had RLS enabled (004) with SELECT (public) and INSERT
-- (authenticated, 014) policies, but no UPDATE policy. Without this, the
-- updateActivityFields server action (used by the camp details drawer for
-- inline edits of name/org/URL) would silently affect 0 rows and the UI would
-- show success without persisting anything.
--
-- Ownership is defined as having a user_camps row linking this user to the
-- activity — matching the app-level guard in updateActivityFields.

create policy "Users can update activities they own via user_camps"
  on activities for update
  to authenticated
  using (
    exists (
      select 1
      from user_camps
      where user_camps.activity_id = activities.id
        and user_camps.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from user_camps
      where user_camps.activity_id = activities.id
        and user_camps.user_id = auth.uid()
    )
  );
