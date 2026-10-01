-- ============================================================================
-- Public portal: anyone (no login) can view aggregate impact numbers, submit
-- an appeal for help, report misconduct by staff, or ask the public AI
-- assistant — and nothing else. No request, file, financial, or staff data
-- is reachable from here; that stays behind the normal login + roles.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Appeals (مناشدات) — submitted by the public, triaged by management.
-- ----------------------------------------------------------------------------
create table public.public_appeals (
  id              uuid primary key default gen_random_uuid(),
  full_name        text not null,
  phone             text,
  location            text,          -- free text, typed by the submitter
  message              text not null,
  status                text not null default 'pending',  -- pending | in_review | resolved
  reviewed_by            uuid references public.profiles(id),
  review_note              text,
  created_at                timestamptz not null default now()
);

alter table public.public_appeals enable row level security;

drop policy if exists public_appeals_insert on public.public_appeals;
create policy public_appeals_insert on public.public_appeals
  for insert with check (true);

drop policy if exists public_appeals_select on public.public_appeals;
create policy public_appeals_select on public.public_appeals
  for select using (public.is_management());

drop policy if exists public_appeals_update on public.public_appeals;
create policy public_appeals_update on public.public_appeals
  for update using (public.is_management());

-- ----------------------------------------------------------------------------
-- 2. Misconduct reports (تبليغ عن إساءة) — anonymous-friendly; only the
--    executive director / system admin can see these, never the broader
--    management group, since a project manager or coordinator could be the
--    person being reported on.
-- ----------------------------------------------------------------------------
create table public.misconduct_reports (
  id                       uuid primary key default gen_random_uuid(),
  reporter_name             text,              -- optional: reporting can be anonymous
  reporter_contact            text,
  accused_name                  text,
  incident_description            text not null,
  incident_location                  text,
  status                               text not null default 'pending',  -- pending | investigating | closed
  reviewed_by                            uuid references public.profiles(id),
  review_note                              text,
  created_at                                timestamptz not null default now()
);

alter table public.misconduct_reports enable row level security;

drop policy if exists misconduct_insert on public.misconduct_reports;
create policy misconduct_insert on public.misconduct_reports
  for insert with check (true);

drop policy if exists misconduct_select on public.misconduct_reports;
create policy misconduct_select on public.misconduct_reports
  for select using (public.current_user_role() in ('system_admin', 'executive_director'));

drop policy if exists misconduct_update on public.misconduct_reports;
create policy misconduct_update on public.misconduct_reports
  for update using (public.current_user_role() in ('system_admin', 'executive_director'));

-- ----------------------------------------------------------------------------
-- 3. Public AI assistant — simple per-IP rate limit log.
--    RLS is enabled with NO policies at all, so neither anon nor a logged-in
--    user can read or write this table through the normal client — only the
--    server's service-role (admin) client can, which is exactly what the
--    rate-limit check needs and nothing more.
-- ----------------------------------------------------------------------------
create table public.public_ai_requests (
  id           bigint generated always as identity primary key,
  ip            text not null,
  created_at      timestamptz not null default now()
);

create index idx_public_ai_requests_ip_time on public.public_ai_requests (ip, created_at);

alter table public.public_ai_requests enable row level security;
