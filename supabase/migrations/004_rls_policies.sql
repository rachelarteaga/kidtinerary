-- Enable RLS on all tables
alter table profiles enable row level security;
alter table children enable row level security;
alter table favorites enable row level security;
alter table planner_entries enable row level security;
alter table reminders enable row level security;
alter table activity_reports enable row level security;
alter table shared_schedules enable row level security;

-- Public read access for activity data (needed for SEO, sharing)
alter table organizations enable row level security;
alter table activities enable row level security;
alter table activity_locations enable row level security;
alter table sessions enable row level security;
alter table price_options enable row level security;

create policy "Activities are publicly readable"
  on activities for select using (true);

create policy "Organizations are publicly readable"
  on organizations for select using (true);

create policy "Activity locations are publicly readable"
  on activity_locations for select using (true);

create policy "Sessions are publicly readable"
  on sessions for select using (true);

create policy "Price options are publicly readable"
  on price_options for select using (true);

-- User data: only own data
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can read own children"
  on children for select using (auth.uid() = user_id);

create policy "Users can insert own children"
  on children for insert with check (auth.uid() = user_id);

create policy "Users can update own children"
  on children for update using (auth.uid() = user_id);

create policy "Users can delete own children"
  on children for delete using (auth.uid() = user_id);

create policy "Users can read own favorites"
  on favorites for select using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on favorites for insert with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on favorites for delete using (auth.uid() = user_id);

create policy "Users can read own planner entries"
  on planner_entries for select using (auth.uid() = user_id);

create policy "Users can insert own planner entries"
  on planner_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own planner entries"
  on planner_entries for update using (auth.uid() = user_id);

create policy "Users can delete own planner entries"
  on planner_entries for delete using (auth.uid() = user_id);

create policy "Users can read own reminders"
  on reminders for select using (auth.uid() = user_id);

create policy "Users can insert own reminders"
  on reminders for insert with check (auth.uid() = user_id);

create policy "Users can delete own reminders"
  on reminders for delete using (auth.uid() = user_id);

create policy "Users can insert activity reports"
  on activity_reports for insert with check (auth.uid() = user_id);

create policy "Users can read own activity reports"
  on activity_reports for select using (auth.uid() = user_id);

create policy "Users can read own shared schedules"
  on shared_schedules for select using (auth.uid() = user_id);

create policy "Users can insert own shared schedules"
  on shared_schedules for insert with check (auth.uid() = user_id);

create policy "Users can delete own shared schedules"
  on shared_schedules for delete using (auth.uid() = user_id);
