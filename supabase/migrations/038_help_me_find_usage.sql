-- Help-me-find rate limiting: per-user daily counter table.
-- One row per (user_id, day) tracking how many LLM searches the user
-- has run that day. Used by /api/help-me-find to enforce a daily cap
-- (default 50/day) and to cheaply observe usage if/when needed.
--
-- Counter is incremented in the API route AFTER the LLM call returns
-- (success only). RLS lets users read their own row (so the UI can
-- surface remaining quota later) but never write — writes go through
-- the SECURITY DEFINER RPC defined alongside.

create table help_me_find_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table help_me_find_usage enable row level security;

create policy "Users read own help-me-find usage"
  on help_me_find_usage for select
  using (auth.uid() = user_id);

-- Atomic counter increment with cap check. Returns the resulting count
-- after a successful increment, or -1 if the user is already at/above
-- the cap (caller treats -1 as "deny"). SECURITY DEFINER so the API
-- route can write without exposing direct INSERT/UPDATE policies on
-- the table.
--
-- Race-safe: a SELECT FOR UPDATE locks the row before checking the
-- cap, so two simultaneous requests serialize through the lock and
-- the second one sees the incremented count.
create or replace function increment_help_me_find_usage(
  p_user_id uuid,
  p_cap int default 50
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_existing int;
  v_new int;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  select count into v_existing
  from help_me_find_usage
  where user_id = p_user_id and day = v_today
  for update;

  if v_existing is not null and v_existing >= p_cap then
    return -1;
  end if;

  insert into help_me_find_usage (user_id, day, count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, day) do update
    set count = help_me_find_usage.count + 1,
        updated_at = now()
  returning count into v_new;

  return v_new;
end;
$$;

revoke execute on function increment_help_me_find_usage(uuid, int) from public;
grant execute on function increment_help_me_find_usage(uuid, int) to authenticated;
