-- Persist the provider checkout URL so a pending registration can be resumed
-- (app relaunch / My Races "Resume") without re-deriving it. Table-level
-- `grant select ... to authenticated` (prior migration) already covers new columns.
alter table payments add column if not exists checkout_url text;
