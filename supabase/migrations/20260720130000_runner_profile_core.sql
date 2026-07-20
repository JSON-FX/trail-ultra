-- Runner passport: date_of_birth + blood_type. gender/shirt_size/emergency_contact
-- already exist on profiles (20260718182546_init_orgs_profiles.sql).
alter table profiles
  add column if not exists date_of_birth date,
  add column if not exists blood_type text;
