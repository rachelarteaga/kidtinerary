-- The catalog row management UI updates user_camps directly (e.g. tagging
-- a kid manually, or changing color). The original migration 010 only
-- created select/insert/delete policies; add the missing update policy
-- restricted to the row owner.

create policy "Users update own shortlist"
  on user_camps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
