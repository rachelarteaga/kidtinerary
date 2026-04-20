-- 011_enable_rls_on_internal_tables.sql
-- Enable RLS on tables flagged by the Supabase security linter.
-- scrape_logs and scrape_sources are internal scraper-only tables.
-- Enable RLS with no policies → anon and authenticated users have no access.
-- Service role bypasses RLS and continues to work for the scraper.

alter table scrape_logs enable row level security;
alter table scrape_sources enable row level security;

-- Note: spatial_ref_sys (PostGIS reference data) is also flagged by the linter
-- but is owned by the postgis extension and cannot be altered via the SQL editor.
-- It must be handled via the Supabase dashboard: enable RLS on the table and
-- add a "public read" policy there (runs as superuser). The data is well-known
-- coordinate-system reference material and is safe to expose as public-read.
