-- Event marketing images: a public-read bucket with org-admin-scoped writes.
-- Objects live at {org_id}/{uuid}.{ext}; the write policies check the first path
-- segment (org_id) against auth_can_admin_org (Plan 09 security-definer helper).

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "event_images_insert_org_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );

create policy "event_images_update_org_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );

create policy "event_images_delete_org_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );
