-- Marketplace redesign: organization profile + event content + event lifecycle.
-- Additive only. RLS/grants unchanged (existing table grants cover new columns;
-- 'cancelled' is <> 'draft' so events_read_published already exposes it).

alter type event_status add value if not exists 'cancelled';

alter table organizations
  add column if not exists banner_url text,
  add column if not exists description text;

alter table events
  add column if not exists description text,
  add column if not exists gallery text[] not null default '{}',
  add column if not exists original_date date,   -- set on reschedule; present => "Rescheduled"
  add column if not exists status_note text;      -- optional org message for the banner
