-- 019_add_camp_flow_overhaul.sql
-- Reset activities/orgs data and add source + shared columns for user-submitted funnel.

-- 1. Wipe activity-side data (pre-launch; CASCADE handles sessions → planner_entries → user_camps → scrape_jobs).
TRUNCATE activities, organizations, sessions, planner_entries, user_camps, scrape_jobs
  RESTART IDENTITY CASCADE;

-- 2. Provenance enum.
CREATE TYPE entity_source AS ENUM ('user', 'curated');

-- 3. activities: source + shared; organization_id becomes nullable for URL-only submissions.
ALTER TABLE activities
  ADD COLUMN source entity_source NOT NULL DEFAULT 'user',
  ADD COLUMN shared boolean NOT NULL DEFAULT false;
ALTER TABLE activities ALTER COLUMN organization_id DROP NOT NULL;

-- 4. organizations: source column.
ALTER TABLE organizations
  ADD COLUMN source entity_source NOT NULL DEFAULT 'user';

-- 5. Case-insensitive dedup for user-submitted orgs.
CREATE UNIQUE INDEX organizations_user_name_ci
  ON organizations (LOWER(name))
  WHERE source = 'user';
