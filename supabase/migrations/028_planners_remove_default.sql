-- 028_planners_remove_default.sql
-- Drop the is_default concept. Multi-planner users pick from the My Planners
-- catalog; /planner with no ?id smart-redirects (opens the sole planner when
-- there's only one, otherwise lands on the catalog). Signup still seeds a
-- starter planner — just without a default flag.

drop index if exists idx_planners_one_default_per_user;

alter table planners drop column if exists is_default;

create or replace function public.handle_new_profile_planner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planners (user_id, name, start_date, end_date)
  values (new.id, 'My planner', current_date, current_date + interval '90 days');
  return new;
end;
$$;
