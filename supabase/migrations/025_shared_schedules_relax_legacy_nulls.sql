-- 025_shared_schedules_relax_legacy_nulls.sql
-- Migration 024 introduced scope='planner' and scope='camp' variants where
-- the legacy columns (child_id, date_from, date_to) no longer apply. Drop
-- their NOT NULL constraints so planner/camp-scoped inserts succeed.

alter table shared_schedules alter column child_id drop not null;
alter table shared_schedules alter column date_from drop not null;
alter table shared_schedules alter column date_to drop not null;
