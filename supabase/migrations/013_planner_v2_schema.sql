-- 013_planner_v2_schema.sql
-- Planner v2: add planners table, per-entry schedule/price/extras, camp color.

-- 1. Create planners table
create table planners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'My planner',
  start_date date not null,
  end_date date not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_planners_user on planners(user_id);
create unique index idx_planners_one_default_per_user
  on planners(user_id) where is_default = true;

alter table planners enable row level security;
create policy "Users read own planners"
  on planners for select using (auth.uid() = user_id);
create policy "Users insert own planners"
  on planners for insert with check (auth.uid() = user_id);
create policy "Users update own planners"
  on planners for update using (auth.uid() = user_id);
create policy "Users delete own planners"
  on planners for delete using (auth.uid() = user_id);

-- 2. Backfill one default planner per existing user
insert into planners (user_id, name, start_date, end_date, is_default)
select id, 'My planner', current_date, current_date + interval '90 days', true
from profiles
where id not in (select user_id from planners where is_default = true);

-- 3. Trigger: auto-create default planner on new profile
create or replace function public.handle_new_profile_planner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planners (user_id, name, start_date, end_date, is_default)
  values (new.id, 'My planner', current_date, current_date + interval '90 days', true);
  return new;
end;
$$;

grant execute on function public.handle_new_profile_planner() to supabase_auth_admin;

drop trigger if exists on_profile_created_planner on public.profiles;
create trigger on_profile_created_planner
  after insert on public.profiles
  for each row execute function public.handle_new_profile_planner();

-- 4. Extend planner_entries
alter table planner_entries
  add column planner_id uuid references planners(id) on delete cascade,
  add column price_cents int,
  add column price_unit text check (price_unit in ('per_week', 'per_day')),
  add column extras jsonb not null default '[]'::jsonb,
  add column session_part text not null default 'full'
    check (session_part in ('full', 'am', 'pm')),
  add column days_of_week jsonb not null default '["mon","tue","wed","thu","fri"]'::jsonb;

-- Backfill planner_id for existing rows
update planner_entries pe
set planner_id = p.id
from planners p
where p.user_id = pe.user_id and p.is_default = true and pe.planner_id is null;

alter table planner_entries
  alter column planner_id set not null;

create index idx_planner_entries_planner on planner_entries(planner_id);

-- 5. Extend user_camps with color
alter table user_camps
  add column color text not null default '#f4b76f';

-- 6. Extend planner_blocks with planner_id
alter table planner_blocks
  add column planner_id uuid references planners(id) on delete cascade;

update planner_blocks pb
set planner_id = p.id
from planners p
where p.user_id = pb.user_id and p.is_default = true and pb.planner_id is null;

alter table planner_blocks
  alter column planner_id set not null;

create index idx_planner_blocks_planner on planner_blocks(planner_id);
