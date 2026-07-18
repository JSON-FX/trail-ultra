-- Enums used across the schema
create type event_status as enum ('draft','open','almost_full','closed','completed');
create type registration_status as enum ('pending','paid','refunded','cancelled');
create type field_type as enum ('text','number','select','checkbox','date','file');
create type payment_status as enum ('pending','paid','failed','refunded');

-- Organizations (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  brand_color text,
  commission_rate numeric(5,4) not null default 0.10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table organizations enable row level security;
create policy "orgs_read_active" on organizations
  for select using (is_active = true);

-- Profiles (1:1 with auth.users), global identity
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  bib_name text,
  gender text,
  shirt_size text,
  emergency_contact text,
  city text,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "profiles_read_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Data API grants: the current Supabase default does NOT auto-expose new tables
-- to the anon / authenticated / service_role roles, so grant explicitly.
grant select on organizations to anon, authenticated;
grant all on organizations to service_role;

grant select, insert, update on profiles to authenticated;
grant all on profiles to service_role;
