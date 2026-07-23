-- Org branding: a public-read org-images bucket with org-admin-scoped writes
-- (objects at {org_id}/{kind}-{uuid}.{ext}; first path segment checked via
-- auth_can_admin_org), plus a column-scoped update on organizations so an
-- editor/admin can repoint their org's avatar/banner (logo_url/banner_url) only.

insert into storage.buckets (id, name, public)
values ('org-images', 'org-images', true)
on conflict (id) do nothing;

create policy "org_images_insert_org_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'org-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid));

create policy "org_images_update_org_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'org-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'org-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid));

create policy "org_images_delete_org_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'org-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid));

grant update (logo_url, banner_url) on organizations to authenticated;

create policy "organizations_update_branding_org_admin" on organizations
  for update using (auth_can_admin_org(id)) with check (auth_can_admin_org(id));
