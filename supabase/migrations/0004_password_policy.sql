-- ============================================================================
-- Password policy flag.
--
-- Staff accounts are created with username = phone number and a temporary
-- password handed out by the admin (e.g. national ID number). An ID number is not a
-- secret — coworkers and family can often guess or know it — so every
-- seeded account is marked must_change_password = true and the app forces
-- a password change on first login before anything else is reachable.
-- ============================================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
