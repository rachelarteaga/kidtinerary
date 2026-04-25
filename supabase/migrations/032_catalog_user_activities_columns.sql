-- Catalog: extend user_activities so it can serve as the master library row.
--   * source distinguishes manual / friend-shared / LLM-found
--   * shared_by_name + shared_by_user_id pin the friend who shared
--   * kid_tags is the multi-kid attribution shown on catalog rows
--   * discovery_query keeps the original Help-me-find prompt for context

alter table user_activities
  add column source text not null default 'self'
    check (source in ('self', 'friend', 'llm')),
  add column shared_by_name text,
  add column shared_by_user_id uuid references auth.users(id) on delete set null,
  add column kid_tags uuid[] not null default '{}',
  add column discovery_query text;

comment on column user_activities.source is
  'How this user came to have this in their catalog: self (manually), friend (shared with them), llm (saved from Help-me-find).';
comment on column user_activities.kid_tags is
  'Multi-kid attribution. Auto-populated by trigger on planner_entries insert (see migration 035).';
