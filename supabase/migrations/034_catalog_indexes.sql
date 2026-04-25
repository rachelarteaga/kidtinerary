-- Catalog: indexes for the new filter and sort dimensions.

create index idx_user_activities_kid_tags on user_activities using gin (kid_tags);
create index idx_user_activities_source on user_activities (source);
create index idx_user_activities_created_at on user_activities (created_at desc);
create index idx_activities_registration_end on activities (registration_end_date)
  where registration_end_date is not null;
