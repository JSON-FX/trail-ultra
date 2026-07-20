-- Roles foundation for the admin console (deferred from Plan 1).
create type app_role as enum ('user','marshal','editor','admin','super_admin');

create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        app_role not null,
  org_id      uuid references organizations(id) on delete cascade,   -- null = platform-wide (super_admin)
  event_scope uuid references events(id) on delete cascade,          -- optional per-event narrowing
  created_at  timestamptz not null default now(),
  unique (user_id, role, org_id, event_scope)
);
create index on user_roles(user_id);

alter table user_roles enable row level security;
-- Users read only their own role rows; there are no client write policies (roles are provisioned).
create policy "user_roles_read_own" on user_roles
  for select using (user_id = auth.uid());

-- security definer: these check ONLY the caller's own rows, so they don't need a
-- user_roles select policy to fire inside other tables' policies, and never recurse.
create or replace function auth_is_super_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'super_admin');
$$;

create or replace function auth_can_admin_org(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select auth_is_super_admin()
      or exists (select 1 from user_roles
                 where user_id = auth.uid() and org_id = target and role in ('editor','admin'));
$$;

-- Data API grants: the current Supabase default does NOT auto-expose new tables
-- to the anon / authenticated / service_role roles, so grant explicitly (same
-- pattern as 20260718182546_init_orgs_profiles.sql). RLS via user_roles_read_own
-- still restricts rows to the caller; anon simply matches no rows.
grant select on user_roles to anon, authenticated;
grant all on user_roles to service_role;

-- Additive: org admins/editors (and super_admins) read ALL their org's events +
-- categories, INCLUDING draft. RLS policies are OR'd, so the public
-- events_read_published / categories_read_published still apply for everyone else.
create policy "events_read_org_admin" on events for select
  using (auth_can_admin_org(org_id));

create policy "categories_read_org_admin" on categories for select
  using (auth_can_admin_org((select e.org_id from events e where e.id = categories.event_id)));
