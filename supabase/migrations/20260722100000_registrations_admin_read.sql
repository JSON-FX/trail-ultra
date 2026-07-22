-- Plan 13: org-admin READ across the registration graph + a slot-release RPC.
-- Additive; the runner *_read_own policies remain (RLS policies are OR'd).
-- Reuses the Plan 09 security-definer helper auth_can_admin_org(uuid).

create policy "registrations_read_org_admin" on registrations for select
  using (auth_can_admin_org(org_id));

create policy "payments_read_org_admin" on payments for select
  using (auth_can_admin_org(org_id));

create policy "registration_addons_read_org_admin" on registration_addons for select
  using (exists (select 1 from registrations r
                 where r.id = registration_addons.registration_id
                   and auth_can_admin_org(r.org_id)));

-- An admin reads the profile (name/bib) of anyone who registered in their org — and only them.
create policy "profiles_read_org_admin" on profiles for select
  using (exists (select 1 from registrations r
                 where r.user_id = profiles.id
                   and auth_can_admin_org(r.org_id)));

-- Slot release on refund — mirror of increment_slot; floored at 0 (defensive).
create or replace function decrement_slot(p_category_id uuid)
returns void language sql as $$
  update categories set slots_taken = greatest(slots_taken - 1, 0) where id = p_category_id;
$$;
grant execute on function decrement_slot(uuid) to service_role;
