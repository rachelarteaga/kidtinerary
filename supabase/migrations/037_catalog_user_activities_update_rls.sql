-- The catalog row management UI updates user_activities directly (e.g.
-- tagging a kid manually, or changing color). The original migration 010
-- only created select/insert/delete policies on the (then-named user_camps)
-- table; add the missing update policy restricted to the row owner.

create policy "Users update own catalog"
  on user_activities for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
