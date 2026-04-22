-- 022_activity_locations_user_update.sql
-- Allow authenticated users to UPDATE activity_locations for their
-- user-submitted activities. Used when the camp detail drawer's Location
-- editor writes to the activity's primary location row.
--
-- Matches the pattern from migration 021 on activities: scoped to
-- source='user' on the parent activity so curated rows stay immutable
-- from the app.

CREATE POLICY "Users can update activity_locations for their user-submitted activities"
  ON activity_locations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM activities a
      JOIN user_camps uc ON uc.activity_id = a.id
      WHERE a.id = activity_locations.activity_id
        AND a.source = 'user'
        AND uc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM activities a
      JOIN user_camps uc ON uc.activity_id = a.id
      WHERE a.id = activity_locations.activity_id
        AND a.source = 'user'
        AND uc.user_id = auth.uid()
    )
  );
