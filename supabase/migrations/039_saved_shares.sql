-- 039_saved_shares.sql
-- Stores read-only "pointers" from a user to a planner-scope share they want
-- to revisit. The table holds NO planner data — listing always joins live
-- shared_schedules/planners so updates from the owner appear automatically.
--
-- planner_name_at_save is a tombstone snapshot used to label the row in
-- "Planners Shared with Me" if the underlying share is later revoked. We
-- intentionally do NOT FK share_id to shared_schedules, so deleting a share
-- leaves the saved row in place to render as a tombstone.

create table saved_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  share_id uuid not null,
  planner_name_at_save text not null,
  saved_at timestamptz not null default now()
);

create unique index saved_shares_user_share_idx
  on saved_shares (user_id, share_id);

create index saved_shares_share_id_idx
  on saved_shares (share_id);

alter table saved_shares enable row level security;

-- Owner of the saved_shares row (the recipient who saved) can read/insert/delete.
create policy "saved_shares owner select"
  on saved_shares for select using (auth.uid() = user_id);

create policy "saved_shares owner insert"
  on saved_shares for insert with check (auth.uid() = user_id);

create policy "saved_shares owner delete"
  on saved_shares for delete using (auth.uid() = user_id);

-- SECURITY DEFINER counter so the share's *owner* (NOT the saved_shares row
-- owner) can read total save counts for their own shares. RLS on saved_shares
-- would otherwise block that read.
create or replace function get_save_counts_for_share_owner(p_user_id uuid)
returns table (share_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select ss.id as share_id,
         coalesce(count(sv.id), 0) as save_count
  from shared_schedules ss
  left join saved_shares sv on sv.share_id = ss.id
  where ss.user_id = p_user_id
    and ss.scope = 'planner'
  group by ss.id
$$;

revoke execute on function get_save_counts_for_share_owner(uuid) from public;
grant execute on function get_save_counts_for_share_owner(uuid) to authenticated;

comment on function get_save_counts_for_share_owner(uuid) is
  'Returns per-share save counts for shares owned by p_user_id. SECURITY '
  'DEFINER bypasses recipient-owner RLS on saved_shares so the share owner '
  'can see "N saved" on their My Planners cards.';
