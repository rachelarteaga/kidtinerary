-- 011_enable_rls_on_internal_tables.sql
-- Enable RLS on tables flagged by the Supabase security linter.
-- - scrape_logs and scrape_sources: internal scraper-only tables.
--   Enable RLS with no policies → anon and authenticated users have no access.
--   Service role bypasses RLS and continues to work for the scraper.
-- - spatial_ref_sys: PostGIS reference table with ~8000 coordinate-system rows.
--   Safe to expose as public-read; the data is well-known reference material.

alter table scrape_logs enable row level security;
alter table scrape_sources enable row level security;
alter table spatial_ref_sys enable row level security;

create policy "spatial_ref_sys is publicly readable"
  on spatial_ref_sys for select using (true);
