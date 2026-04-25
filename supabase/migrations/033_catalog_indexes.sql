-- Catalog: indexes for the new filter and sort dimensions.

create index idx_user_camps_kid_tags on user_camps using gin (kid_tags);
create index idx_user_camps_source on user_camps (source);
create index idx_user_camps_created_at on user_camps (created_at desc);
create index idx_activities_registration_end on activities (registration_end_date)
  where registration_end_date is not null;
