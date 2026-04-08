-- Enum types
create type indoor_outdoor as enum ('indoor', 'outdoor', 'both');
create type data_confidence as enum ('high', 'medium', 'low');
create type time_slot as enum ('full_day', 'am_half', 'pm_half');
create type price_unit as enum ('per_week', 'per_day', 'per_session', 'per_block');
create type price_confidence as enum ('verified', 'scraped', 'llm_extracted');
create type planner_status as enum ('penciled_in', 'locked_in', 'cancelled');
create type reminder_type as enum ('registration_opens', 'registration_closes', 'custom');
create type report_reason as enum ('wrong_price', 'cancelled', 'wrong_dates', 'other');
create type report_status as enum ('pending', 'reviewed', 'resolved');
create type adapter_type as enum ('dedicated', 'semi_structured', 'generic_llm');
create type scrape_frequency as enum ('daily', 'weekly');
create type scrape_status as enum ('success', 'partial', 'failed');

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities
create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  categories text[] not null default '{}',
  age_min int,
  age_max int,
  indoor_outdoor indoor_outdoor not null default 'both',
  registration_url text,
  source_url text,
  scraped_at timestamptz,
  last_verified_at timestamptz,
  data_confidence data_confidence not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity locations (one activity can have multiple venues)
create table activity_locations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  address text not null,
  location geography(point, 4326) not null,
  location_name text,
  created_at timestamptz not null default now()
);

-- Sessions (specific date ranges for an activity)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  activity_location_id uuid not null references activity_locations(id) on delete cascade,
  starts_at date not null,
  ends_at date not null,
  time_slot time_slot not null default 'full_day',
  hours_start time,
  hours_end time,
  spots_available int,
  is_sold_out boolean not null default false,
  enrollment_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Price options
create table price_options (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  label text not null,
  price_cents int not null,
  price_unit price_unit not null default 'per_week',
  conditions text,
  valid_from date,
  valid_until date,
  confidence price_confidence not null default 'scraped',
  created_at timestamptz not null default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  address text,
  location geography(point, 4326),
  default_radius_miles int not null default 30,
  notification_preferences jsonb not null default '{"registration_deadline": true, "availability_alert": true, "coverage_gap": true, "new_match": true, "data_change": true, "custom_reminder": true, "digest_frequency": "weekly", "quiet_start": "21:00", "quiet_end": "07:00"}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Children
create table children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  birth_date date not null,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Favorites
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

-- Planner entries
create table planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  status planner_status not null default 'penciled_in',
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reminders
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  type reminder_type not null,
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Activity reports (user-submitted data issues)
create table activity_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  reason report_reason not null,
  details text,
  status report_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Shared schedules
create table shared_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  token text not null unique,
  date_from date not null,
  date_to date not null,
  created_at timestamptz not null default now()
);

-- Scrape sources
create table scrape_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  adapter_type adapter_type not null default 'generic_llm',
  scrape_frequency scrape_frequency not null default 'weekly',
  last_scraped_at timestamptz,
  last_success_at timestamptz,
  error_count int not null default 0,
  is_paused boolean not null default false,
  created_at timestamptz not null default now()
);

-- Scrape logs
create table scrape_logs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references scrape_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status scrape_status,
  records_found int not null default 0,
  errors jsonb,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger update_activities_updated_at before update on activities for each row execute function update_updated_at();
create trigger update_sessions_updated_at before update on sessions for each row execute function update_updated_at();
create trigger update_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger update_children_updated_at before update on children for each row execute function update_updated_at();
create trigger update_planner_entries_updated_at before update on planner_entries for each row execute function update_updated_at();
