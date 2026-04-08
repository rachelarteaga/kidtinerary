-- Enable PostGIS for geographic queries (radius filtering)
create extension if not exists postgis;

-- Enable pg_trgm for fuzzy text matching (deduplication)
create extension if not exists pg_trgm;
