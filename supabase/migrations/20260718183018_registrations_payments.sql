create table registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  category_id uuid not null references categories(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status registration_status not null default 'pending',
  total_amount integer not null default 0,
  custom_data jsonb not null default '{}'::jsonb,
  waiver_accepted_at timestamptz,
  ticket_token text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index on registrations(user_id);
create index on registrations(event_id);
alter table registrations enable row level security;
create policy "registrations_read_own" on registrations
  for select using (auth.uid() = user_id);

create table registration_addons (
  registration_id uuid not null references registrations(id) on delete cascade,
  addon_id uuid not null references addons(id),
  price integer not null,
  primary key (registration_id, addon_id)
);
alter table registration_addons enable row level security;
create policy "reg_addons_read_own" on registration_addons
  for select using (exists (
    select 1 from registrations r
    where r.id = registration_addons.registration_id and r.user_id = auth.uid()));

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  registration_id uuid not null references registrations(id) on delete cascade,
  provider text not null default 'fake',
  provider_ref text,
  method text,
  amount integer not null default 0,
  platform_fee integer not null default 0,
  net_to_org integer not null default 0,
  status payment_status not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (registration_id)
);
create index on payments(registration_id);
alter table payments enable row level security;
create policy "payments_read_own" on payments
  for select using (exists (
    select 1 from registrations r
    where r.id = payments.registration_id and r.user_id = auth.uid()));

-- Slot increment (called by the service-role webhook function)
create or replace function increment_slot(p_category_id uuid)
returns void language sql as $$
  update categories set slots_taken = slots_taken + 1 where id = p_category_id;
$$;

-- Data API grants
grant select on registrations, registration_addons, payments to authenticated;
grant all on registrations, registration_addons, payments to service_role;
grant execute on function increment_slot(uuid) to service_role;
