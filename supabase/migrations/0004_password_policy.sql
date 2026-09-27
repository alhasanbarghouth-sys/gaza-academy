-- ============================================================================
-- Password policy flag.
--
-- Staff accounts are seeded with username = phone number and password =
-- national ID number (see scripts/seed-staff.mjs). An ID number is not a
-- secret — coworkers and family can often guess or know it — so every
-- seeded account is marked must_change_password = true and the app forces
-- a password change on first login before anything else is reachable.
-- ============================================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
