-- 010_planner_hero_schema.sql
-- Planner hero redesign: new tables, enum rename, drop favorites.

-- 1. Drop favorites (no production users).
drop table if exists favorites cascade;

-- 2. Rename planner_entries status enum.
-- Create new enum, cast existing rows, drop old.
create type planner_entry_status_new as enum ('considering', 'waitlisted', 'registered');

alter table planner_entries
  alter column status drop default;

alter table planner_entries
  alter column status type planner_entry_status_new
  using (case status::text
    when 'penciled_in' then 'considering'::planner_entry_status_new
    when 'locked_in' then 'registered'::planner_entry_status_new
    when 'cancelled' then null  -- 'cancelled' rows are deleted below
  end);

-- Drop rows that were 'cancelled' (status is now null after cast).
delete from planner_entries where status is null;

alter table planner_entries
  alter column status set not null,
  alter column status set default 'considering'::planner_entry_status_new;

drop type planner_status;
alter type planner_entry_status_new rename to planner_entry_status;

-- 3. Children: add color, sort_order, avatar_url.
alter table children
  add column if not exists color text not null default '#f4b76f',
  add column if not exists sort_order int not null default 0,
  add column if not exists avatar_url text;

-- 4. Profiles: add share_camps_default.
alter table profiles
  add column if not exists share_camps_default boolean not null default true;

-- 5. Activities: add verified flag.
alter table activities
  add column if not exists verified boolean not null default false,
  add column if not exists verified_at timestamptz;

-- 6. user_camps: family-level shortlist.
create table user_camps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

alter table user_camps enable row level security;

create policy "Users read own shortlist"
  on user_camps for select using (auth.uid() = user_id);
create policy "Users insert own shortlist"
  on user_camps for insert with check (auth.uid() = user_id);
create policy "Users delete own shortlist"
  on user_camps for delete using (auth.uid() = user_id);

-- 7. planner_blocks: non-camp blocks.
create type planner_block_type as enum ('school', 'travel', 'at_home', 'other');

create table planner_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type planner_block_type not null,
  title text not null,
  emoji text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table planner_blocks enable row level security;

create policy "Users read own blocks"
  on planner_blocks for select using (auth.uid() = user_id);
create policy "Users insert own blocks"
  on planner_blocks for insert with check (auth.uid() = user_id);
create policy "Users update own blocks"
  on planner_blocks for update using (auth.uid() = user_id);
create policy "Users delete own blocks"
  on planner_blocks for delete using (auth.uid() = user_id);

-- 8. planner_block_kids: which kids a block applies to.
create table planner_block_kids (
  block_id uuid not null references planner_blocks(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  primary key (block_id, child_id)
);

alter table planner_block_kids enable row level security;

create policy "Users read own block-kid joins"
  on planner_block_kids for select using (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );
create policy "Users insert own block-kid joins"
  on planner_block_kids for insert with check (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );
create policy "Users delete own block-kid joins"
  on planner_block_kids for delete using (
    exists (select 1 from planner_blocks b where b.id = block_id and b.user_id = auth.uid())
  );

-- 9. scrape_jobs: async scrape queue.
create type scrape_job_status as enum ('queued', 'running', 'resolved', 'failed');
create type scrape_confidence as enum ('high', 'partial', 'ambiguous', 'none');

create table scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  input text not null,
  context jsonb not null default '{}'::jsonb,
  status scrape_job_status not null default 'queued',
  activity_id uuid references activities(id) on delete set null,
  confidence scrape_confidence,
  candidates jsonb,
  consent_share boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table scrape_jobs enable row level security;

create policy "Users read own scrape jobs"
  on scrape_jobs for select using (auth.uid() = user_id);
create policy "Users insert own scrape jobs"
  on scrape_jobs for insert with check (auth.uid() = user_id);

-- Indexes.
create index if not exists idx_user_camps_user on user_camps(user_id);
create index if not exists idx_planner_blocks_user_dates on planner_blocks(user_id, start_date, end_date);
create index if not exists idx_scrape_jobs_user_status on scrape_jobs(user_id, status);
