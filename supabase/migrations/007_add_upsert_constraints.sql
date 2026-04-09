-- Add unique constraints required by the upsert pipeline

-- Organizations: upsert by name
alter table organizations add constraint organizations_name_key unique (name);

-- Activity locations: upsert by activity + address
alter table activity_locations add constraint activity_locations_activity_id_address_key unique (activity_id, address);

-- Sessions: upsert by activity + date range + time slot
alter table sessions add constraint sessions_activity_id_starts_at_ends_at_time_slot_key unique (activity_id, starts_at, ends_at, time_slot);

-- Price options: upsert by activity + session + label
-- session_id can be NULL so we need a partial unique index for each case
create unique index price_options_activity_session_label_key
  on price_options (activity_id, session_id, label)
  where session_id is not null;

create unique index price_options_activity_no_session_label_key
  on price_options (activity_id, label)
  where session_id is null;
