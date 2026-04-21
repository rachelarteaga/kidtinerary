-- 016_avatars_storage_policies.sql
-- Allow authenticated users to upload their own kid avatars.
-- Files are stored at avatars/{user_id}/{child_id}.{ext}, so the first path segment
-- uniquely identifies the user.

create policy "Users upload own avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');
