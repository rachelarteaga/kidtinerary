-- Geographic indexes for radius queries
create index idx_activity_locations_geo on activity_locations using gist (location);
create index idx_profiles_geo on profiles using gist (location);

-- Activity search and filtering
create index idx_activities_categories on activities using gin (categories);
create index idx_activities_age on activities (age_min, age_max) where is_active = true;
create index idx_activities_slug on activities (slug);
create index idx_activities_org on activities (organization_id);
create index idx_activities_active on activities (is_active) where is_active = true;

-- Trigram index for fuzzy name matching (deduplication)
create index idx_activities_name_trgm on activities using gin (name gin_trgm_ops);
create index idx_organizations_name_trgm on organizations using gin (name gin_trgm_ops);

-- Session queries
create index idx_sessions_activity on sessions (activity_id);
create index idx_sessions_dates on sessions (starts_at, ends_at);
create index idx_sessions_enrollment_group on sessions (enrollment_group_id) where enrollment_group_id is not null;

-- Price lookups
create index idx_price_options_activity on price_options (activity_id);

-- User data queries
create index idx_children_user on children (user_id);
create index idx_favorites_user on favorites (user_id);
create index idx_favorites_activity on favorites (activity_id);
create index idx_planner_entries_user_child on planner_entries (user_id, child_id);
create index idx_planner_entries_session on planner_entries (session_id);

-- Reminder processing
create index idx_reminders_pending on reminders (remind_at) where sent_at is null;

-- Scrape scheduling
create index idx_scrape_sources_active on scrape_sources (scrape_frequency, last_scraped_at) where is_paused = false;

-- Shared schedule token lookup
create index idx_shared_schedules_token on shared_schedules (token);
