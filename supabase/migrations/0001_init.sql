-- ============================================================================
-- Basma Association — Organization Information System
-- Initial schema: roles, profiles, activities, requests, reports, files,
-- AI conversations, notifications, audit log — with Row Level Security (RLS).
--
-- Run this once against a fresh Supabase project (SQL Editor -> New query ->
-- paste this whole file -> Run). It is safe to re-run (uses IF NOT EXISTS /
-- CREATE OR REPLACE where possible) but is meant to run exactly once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "pg_trgm";      -- fuzzy / partial text search

-- ----------------------------------------------------------------------------
-- 1. Roles
-- ----------------------------------------------------------------------------
-- system_admin        : full technical access (IT / super admin)
-- executive_director   : المدير التنفيذي — sees everything, approves top requests
-- project_manager       : مدير المشاريع — oversees projects & facilitators
-- coordinator            : منسق — field coordination, approves logistics
-- accountant              : المحاسب — financial reports, budget requests
-- donor                    : الممول — read-only visibility into reports/impact
-- facilitator               : الميسر — field staff, submits daily activity logs
-- staff                     : موظف — general employee, can submit requests/reports

do $$ begin
  create type public.user_role as enum (
    'system_admin',
    'executive_director',
    'project_manager',
    'coordinator',
    'accountant',
    'donor',
    'facilitator',
    'staff'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum (
    'pending', 'in_review', 'approved', 'rejected', 'completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_type as enum (
    'financial', 'logistical', 'administrative', 'hr', 'technical', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone        text,
  role         public.user_role not null default 'staff',
  department   text,
  area         text,               -- منطقة عمل الميسر الميدانية
  avatar_url   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per user, mirrors auth.users, carries the role used by every RLS policy.';

-- Helper: current user's role, bypasses RLS to avoid recursive lookups.
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_like()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_role() in ('system_admin', 'executive_director');
$$;

create or replace function public.is_management()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_role() in
    ('system_admin', 'executive_director', 'project_manager', 'coordinator');
$$;

-- Auto-create a profile row when a new auth user is created.
-- Role defaults to 'staff'; a system_admin must promote the user afterwards.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Daily activity log (facilitator field reports)
-- ----------------------------------------------------------------------------
create table if not exists public.daily_activities (
  id                  uuid primary key default gen_random_uuid(),
  facilitator_id      uuid not null references public.profiles(id) on delete cascade,
  activity_date       date not null default current_date,
  project_name        text not null,
  activity_type       text not null,   -- dropdown on the client: نشاط ثقافي / دعم نفسي / ورشة فنية ...
  location             text not null,
  beneficiaries_male    int not null default 0,
  beneficiaries_female  int not null default 0,
  beneficiaries_children int not null default 0,
  beneficiaries_adults   int not null default 0,
  total_beneficiaries   int generated always as
    (beneficiaries_male + beneficiaries_female) stored,
  description           text,
  challenges             text,
  attachments             jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_daily_activities_facilitator on public.daily_activities(facilitator_id);
create index if not exists idx_daily_activities_date on public.daily_activities(activity_date);

-- ----------------------------------------------------------------------------
-- 4. Requests (internal staff <-> management requests)
-- ----------------------------------------------------------------------------
create table if not exists public.requests (
  id                uuid primary key default gen_random_uuid(),
  requester_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_role      public.user_role,          -- e.g. 'accountant', 'executive_director'
  recipient_id         uuid references public.profiles(id),  -- optional: a specific person
  request_type          public.request_type not null,
  title                   text not null,
  message                  text not null,
  status                    public.request_status not null default 'pending',
  priority                   public.request_priority not null default 'normal',
  attachments                jsonb not null default '[]'::jsonb,
  response_note                text,
  responded_by                  uuid references public.profiles(id),
  responded_at                   timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists idx_requests_requester on public.requests(requester_id);
create index if not exists idx_requests_recipient_role on public.requests(recipient_role);
create index if not exists idx_requests_status on public.requests(status);

-- ----------------------------------------------------------------------------
-- 5. Reports: 5W (UNICEF monthly) and OCHA weekly — generated from activities
-- ----------------------------------------------------------------------------
create table if not exists public.reports_5w (
  id             uuid primary key default gen_random_uuid(),
  report_month    date not null,   -- first day of the covered month
  generated_by     uuid not null references public.profiles(id),
  data               jsonb not null,  -- {who:[...], what:[...], where:[...], when:{}, forWhom:{}}
  status              text not null default 'draft',
  created_at            timestamptz not null default now(),
  unique (report_month)
);

create table if not exists public.reports_ocha_weekly (
  id            uuid primary key default gen_random_uuid(),
  week_start     date not null,
  week_end        date not null,
  generated_by     uuid not null references public.profiles(id),
  data               jsonb not null,
  status              text not null default 'draft',
  created_at            timestamptz not null default now(),
  unique (week_start)
);

-- ----------------------------------------------------------------------------
-- 6. Financial reports (accountant uploads)
-- ----------------------------------------------------------------------------
create table if not exists public.financial_reports (
  id             uuid primary key default gen_random_uuid(),
  uploaded_by     uuid not null references public.profiles(id),
  title            text not null,
  period            text not null,     -- e.g. '2026-09'
  amount             numeric(14,2),
  currency             text not null default 'USD',
  file_url              text,
  notes                  text,
  created_at              timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. General file / document center
-- ----------------------------------------------------------------------------
create table if not exists public.files (
  id                 uuid primary key default gen_random_uuid(),
  uploaded_by         uuid not null references public.profiles(id),
  category              text not null,   -- عقود / سياسات / نماذج / صور / تقارير ...
  file_name              text not null,
  file_url                 text not null,
  file_size                  bigint,
  related_entity_type          text,
  related_entity_id              uuid,
  created_at                      timestamptz not null default now()
);

create index if not exists idx_files_category on public.files(category);

-- ----------------------------------------------------------------------------
-- 8. AI assistant conversations
-- ----------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null default 'محادثة جديدة',
  created_at       timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.ai_conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant')),
  content                 text not null,
  created_at                timestamptz not null default now()
);

create index if not exists idx_ai_messages_conversation on public.ai_messages(conversation_id);

-- ----------------------------------------------------------------------------
-- 9. Notifications
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  body              text,
  link                text,
  is_read              boolean not null default false,
  created_at              timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- 10. Audit log
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id),
  action          text not null,
  entity_type       text not null,
  entity_id           uuid,
  metadata              jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.daily_activities enable row level security;
alter table public.requests enable row level security;
alter table public.reports_5w enable row level security;
alter table public.reports_ocha_weekly enable row level security;
alter table public.financial_reports enable row level security;
alter table public.files enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

-- ---- profiles ---------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or public.is_management() or public.current_user_role() = 'accountant'
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin_like())
  with check (public.is_admin_like());

-- ---- daily_activities ---------------------------------------------------------
drop policy if exists activities_own on public.daily_activities;
create policy activities_own on public.daily_activities
  for all using (facilitator_id = auth.uid())
  with check (facilitator_id = auth.uid());

drop policy if exists activities_management_read on public.daily_activities;
create policy activities_management_read on public.daily_activities
  for select using (public.is_management());

-- ---- requests -------------------------------------------------------------------
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

-- ---- reports_5w / reports_ocha_weekly --------------------------------------------
drop policy if exists reports5w_write on public.reports_5w;
create policy reports5w_write on public.reports_5w
  for all using (public.is_management())
  with check (public.is_management());

drop policy if exists reports5w_read on public.reports_5w;
create policy reports5w_read on public.reports_5w
  for select using (
    public.is_management() or public.current_user_role() in ('donor', 'accountant')
  );

drop policy if exists ocha_write on public.reports_ocha_weekly;
create policy ocha_write on public.reports_ocha_weekly
  for all using (public.is_management())
  with check (public.is_management());

drop policy if exists ocha_read on public.reports_ocha_weekly;
create policy ocha_read on public.reports_ocha_weekly
  for select using (
    public.is_management() or public.current_user_role() in ('donor', 'accountant')
  );

-- ---- financial_reports ------------------------------------------------------------
drop policy if exists financial_write on public.financial_reports;
create policy financial_write on public.financial_reports
  for all using (public.current_user_role() in ('accountant', 'system_admin'))
  with check (public.current_user_role() in ('accountant', 'system_admin'));

drop policy if exists financial_read on public.financial_reports;
create policy financial_read on public.financial_reports
  for select using (
    public.is_management() or public.current_user_role() in ('accountant', 'donor')
  );

-- ---- files -----------------------------------------------------------------------
drop policy if exists files_read_all on public.files;
create policy files_read_all on public.files
  for select using (auth.uid() is not null);

drop policy if exists files_insert_own on public.files;
create policy files_insert_own on public.files
  for insert with check (uploaded_by = auth.uid());

drop policy if exists files_delete_own_or_admin on public.files;
create policy files_delete_own_or_admin on public.files
  for delete using (uploaded_by = auth.uid() or public.is_admin_like());

-- ---- ai_conversations / ai_messages -----------------------------------------------
drop policy if exists ai_conv_own on public.ai_conversations;
create policy ai_conv_own on public.ai_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_msg_own on public.ai_messages;
create policy ai_msg_own on public.ai_messages
  for all using (
    exists (select 1 from public.ai_conversations c
            where c.id = conversation_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.ai_conversations c
            where c.id = conversation_id and c.user_id = auth.uid())
  );

-- ---- notifications ------------------------------------------------------------------
drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- audit_log: admin only, insert via server (service role) only -------------------
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select using (public.is_admin_like());

-- ============================================================================
-- Storage buckets (files & financial docs). Run once; ignored if they exist.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('org-files', 'org-files', false)
on conflict (id) do nothing;

drop policy if exists "org-files read (authenticated)" on storage.objects;
create policy "org-files read (authenticated)" on storage.objects
  for select using (bucket_id = 'org-files' and auth.uid() is not null);

drop policy if exists "org-files insert (authenticated)" on storage.objects;
create policy "org-files insert (authenticated)" on storage.objects
  for insert with check (bucket_id = 'org-files' and auth.uid() is not null);

drop policy if exists "org-files delete own" on storage.objects;
create policy "org-files delete own" on storage.objects
  for delete using (bucket_id = 'org-files' and owner = auth.uid());
