-- The storage key for an uploaded financial report file is now a random id
-- (see safeStorageKey in the app) rather than the original filename, so the
-- original name needs to be kept separately to show it in the UI and use it
-- as the downloaded file's name.
alter table public.financial_reports
  add column if not exists file_name text;
