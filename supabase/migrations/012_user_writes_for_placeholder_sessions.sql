-- 012_user_writes_for_placeholder_sessions.sql
-- Allow authenticated users to insert placeholder activity_locations and
-- sessions when adding a user-submitted camp to their planner.
--
-- Context: submitCamp / assignCampToWeek in src/lib/actions.ts need to
-- create a stub session for a week when no scraped session exists. The
-- sessions table has activity_location_id NOT NULL, so we also need to
-- create a placeholder activity_location.
--
-- The scraper (service role) bypasses RLS and is unaffected. These
-- policies let the authenticated role insert rows too. Select/update/
-- delete policies are unchanged; these tables remain publicly readable.

-- activity_locations: allow authenticated inserts
create policy "Authenticated users can insert activity locations"
  on activity_locations for insert
  to authenticated
  with check (true);

-- sessions: allow authenticated inserts
create policy "Authenticated users can insert sessions"
  on sessions for insert
  to authenticated
  with check (true);
