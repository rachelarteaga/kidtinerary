-- Catalog: extend activities with registration window dates and an
-- origin column distinguishing how the activity row itself was created.
--   * registration_end_date drives the "Registration deadline" sort
--     and the row's "Reg closes <date>" footer badge.
--   * registration_start_date is paired so we don't need a follow-up
--     migration when registration-open alerts ship.
--   * origin is distinct from user_activities.source — it describes the
--     activity row's provenance (manual entry, scrape, LLM, submit form),
--     not how this user came to have it.

alter table activities
  add column registration_end_date date,
  add column registration_start_date date,
  add column origin text not null default 'manual'
    check (origin in ('manual', 'scrape', 'llm', 'submit'));

comment on column activities.origin is
  'How the activity row itself was created. Distinct from user_activities.source.';
