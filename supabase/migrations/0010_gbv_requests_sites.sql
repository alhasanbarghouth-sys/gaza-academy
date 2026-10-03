-- ============================================================================
-- 0010 — run after 0009. Safe to run more than once.
--   1. GBV case details from the daily activity log (restricted table)
--   2. Internal requests: permissions re-applied + reply thread
--   3. Camps linked to the official CCCM site list (for the 5W Excel export)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GBV details: type(s) of violence and a written description. Kept out of
--    activity_sessions on purpose — co-workers on the same session can read the
--    session, but only management and the facilitator who wrote it can read this.
-- ----------------------------------------------------------------------------
create table if not exists public.activity_gbv_reports (
  session_id      uuid primary key references public.activity_sessions(id) on delete cascade,
  violence_types  text[] not null default '{}'
                  check (violence_types <@ array['sexual', 'physical', 'psychological']::text[]),
  details         text,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

alter table public.activity_gbv_reports enable row level security;

drop policy if exists gbv_reports_select on public.activity_gbv_reports;
create policy gbv_reports_select on public.activity_gbv_reports
  for select using (public.is_management() or created_by = auth.uid());

drop policy if exists gbv_reports_insert on public.activity_gbv_reports;
create policy gbv_reports_insert on public.activity_gbv_reports
  for insert with check (created_by = auth.uid() and public.is_session_creator(session_id));

-- ----------------------------------------------------------------------------
-- 2. Requests. The policies are re-created exactly as intended so that a live
--    database that drifted from 0001 is brought back in line: the requester,
--    the addressed role or person, and the executive director / system admin
--    all see a request.
-- ----------------------------------------------------------------------------
alter table public.requests enable row level security;

drop policy if exists requests_owner on public.requests;
create policy requests_owner on public.requests
  for select using (requester_id = auth.uid());

drop policy if exists requests_owner_insert on public.requests;
create policy requests_owner_insert on public.requests
  for insert with check (requester_id = auth.uid());

drop policy if exists requests_recipient_select on public.requests;
create policy requests_recipient_select on public.requests
  for select using (
    recipient_role = public.current_user_role()
    or recipient_id = auth.uid()
    or public.is_admin_like()
  );

drop policy if exists requests_recipient_update on public.requests;
create policy requests_recipient_update on public.requests
  for update using (
    recipient_role = public.current_user_role()
    or recipient_id = auth.uid()
    or public.is_admin_like()
  );

create table if not exists public.request_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  body        text not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists idx_request_messages_request on public.request_messages(request_id, created_at);

alter table public.request_messages enable row level security;

-- Whoever can see the request can read and add to its thread.
drop policy if exists request_messages_select on public.request_messages;
create policy request_messages_select on public.request_messages
  for select using (exists (select 1 from public.requests r where r.id = request_id));

drop policy if exists request_messages_insert on public.request_messages;
create policy request_messages_insert on public.request_messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_id)
  );

-- ----------------------------------------------------------------------------
-- 3. Official CCCM Site ID for each camp (e.g. GZA4154), used to fill
--    governorate, neighbourhood, site type and site name in the 5Ws tracker.
-- ----------------------------------------------------------------------------
alter table public.camps add column if not exists site_code text;

notify pgrst, 'reload schema';
