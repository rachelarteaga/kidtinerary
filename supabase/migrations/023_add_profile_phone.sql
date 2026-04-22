-- 023_add_profile_phone.sql
-- Add optional phone number to profiles for future SMS alerts.

alter table profiles add column phone text;
