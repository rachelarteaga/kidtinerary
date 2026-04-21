-- 018_organizations_user_insert.sql
-- Allow authenticated users to insert into organizations.
--
-- Context: submitCamp in src/lib/actions.ts creates a stub "User-submitted"
-- organization the first time a user adds a camp that isn't already known.
-- The organizations table had RLS enabled (004) with only a SELECT policy,
-- so that insert was silently blocked, orgId came back null, and the
-- downstream activities insert failed its NOT NULL constraint — surfacing
-- as the generic "Failed to create camp entry" in the Add Camp flow.
--
-- Migrations 012 and 014 added equivalent insert policies for sessions,
-- activity_locations, and activities; this closes the same gap for
-- organizations. The scraper (service role) bypasses RLS and is unaffected.

create policy "Authenticated users can insert organizations"
  on organizations for insert
  to authenticated
  with check (true);
