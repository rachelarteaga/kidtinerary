-- 014_activities_user_insert.sql
-- submitCamp creates stub activity rows when a user types a camp name that
-- doesn't match any existing activity. The activities table only had a
-- "publicly readable" SELECT policy — writes from user sessions were blocked
-- by RLS. This adds an insert policy so authenticated users can create stubs.
-- The scraper (service role) bypasses RLS and is unaffected.

create policy "Authenticated users can insert activities"
  on activities for insert
  to authenticated
  with check (true);
