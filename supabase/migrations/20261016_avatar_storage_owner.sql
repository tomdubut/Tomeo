-- Avatars: each user may only write their own file (named after their user id).
-- Before: any signed-in user could overwrite or delete anyone's avatar, and upload any
-- file type or size straight through the storage API (the 1 MB / image checks were app-side only).

drop policy if exists avatar_insert on storage.objects;
drop policy if exists avatar_update on storage.objects;
drop policy if exists avatar_delete on storage.objects;

create policy avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text);

create policy avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text);

create policy avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text);

update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';
