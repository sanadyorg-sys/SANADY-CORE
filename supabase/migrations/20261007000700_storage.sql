-- ════════════════════════════════════════════════════════════════════════════
-- SANADY · 0007 · Storage
--
-- course-media  (private) : videos, PDFs, lesson resources.
--                           Path convention: {course_id}/{lesson_id}/{file}
--                           Read access = course access, enforced here, so a
--                           signed URL can only be created by an authorized
--                           learner (or an administrator).
-- course-covers (public)  : course cover images (non-sensitive).
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-media', 'course-media', false, 2147483648,
   array['video/mp4', 'video/webm', 'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'image/png', 'image/jpeg', 'application/zip']),
  ('course-covers', 'course-covers', true, 5242880,
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy course_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-media'
    and (
      private.is_sanady_admin()
      or private.has_course_access(private.try_uuid((storage.foldername(name))[1]))
    )
  );

create policy course_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-media' and private.is_sanady_admin());

create policy course_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-media' and private.is_sanady_admin())
  with check (bucket_id = 'course-media' and private.is_sanady_admin());

create policy course_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-media' and private.is_sanady_admin());

create policy course_covers_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'course-covers' and private.is_sanady_admin());

create policy course_covers_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'course-covers' and private.is_sanady_admin())
  with check (bucket_id = 'course-covers' and private.is_sanady_admin());

create policy course_covers_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'course-covers' and private.is_sanady_admin());
