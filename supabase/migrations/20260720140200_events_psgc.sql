-- Event PSGC address + venue. Legacy place/region kept (nullable, unused for display).
alter table events
  add column if not exists city_psgc_code text references psgc_cities(code),
  add column if not exists region_name text,
  add column if not exists province_name text,
  add column if not exists city_name text,
  add column if not exists venue text;
