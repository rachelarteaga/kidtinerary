-- 021_activities_update_rls_user_only.sql
-- Tighten the UPDATE policy on activities so only user-created rows can be
-- edited by the owner — curated rows remain immutable from the app.
--
-- Migration 020 added a policy that allowed updates whenever the caller had
-- a user_camps row for the activity. But once curated content starts to
-- appear, a user who shortlists a curated camp shouldn't be able to mutate
-- the canonical record via their user_camps link. Scope to source='user'.

DROP POLICY IF EXISTS "Users can update activities they own via user_camps" ON activities;

CREATE POLICY "Users can update activities they own via user_camps"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    activities.source = 'user'
    AND EXISTS (
      SELECT 1 FROM user_camps
      WHERE user_camps.activity_id = activities.id
        AND user_camps.user_id = auth.uid()
    )
  )
  WITH CHECK (
    activities.source = 'user'
    AND EXISTS (
      SELECT 1 FROM user_camps
      WHERE user_camps.activity_id = activities.id
        AND user_camps.user_id = auth.uid()
    )
  );
