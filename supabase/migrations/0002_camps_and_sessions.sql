-- ============================================================================
-- Camps master list + session-based activity logging.
--
-- Problem this fixes: if each staff member who worked the same field
-- activity files their own row with their own beneficiary count, the
-- dashboard/reports sum double- or triple-counts the same people.
--
-- Fix: a field activity is now ONE "session" row with ONE beneficiary count,
-- and every staff member who worked it is tagged as a participant via a
-- join table. The count only ever exists once per real event, so there is
-- nothing to de-duplicate later — aggregation just sums session rows.
--
-- Run this after 0001_init.sql (SQL Editor -> New query -> paste -> Run).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Camps master list
-- ----------------------------------------------------------------------------
create table if not exists public.camps (
  id            uuid primary key default gen_random_uuid(),
  name           text not null,
  latitude        numeric(9,6),
  longitude        numeric(9,6),
  notes             text,
  is_verified        boolean not null default false,  -- true = confirmed on the official master list
  created_by          uuid references public.profiles(id),
  created_at            timestamptz not null default now()
);

create unique index if not exists idx_camps_name_unique on public.camps (lower(name));

alter table public.camps enable row level security;

drop policy if exists camps_read_all on public.camps;
create policy camps_read_all on public.camps
  for select using (auth.uid() is not null);

-- Anyone can quick-add a camp missing from the list (lands as unverified);
-- only management can edit/verify/delete it afterwards.
drop policy if exists camps_insert_any on public.camps;
create policy camps_insert_any on public.camps
  for insert with check (auth.uid() is not null);

drop policy if exists camps_manage on public.camps;
create policy camps_manage on public.camps
  for update using (public.is_management()) with check (public.is_management());

drop policy if exists camps_delete on public.camps;
create policy camps_delete on public.camps
  for delete using (public.is_management());

-- ----------------------------------------------------------------------------
-- 2. Broaden profile visibility: the co-worker picker (and camp/participant
--    display) needs every signed-in user to see a basic staff directory.
--    Only self (or an admin) can still UPDATE a profile.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 3. Session-based activity logging (replaces public.daily_activities)
-- ----------------------------------------------------------------------------
drop policy if exists activities_own on public.daily_activities;
drop policy if exists activities_management_read on public.daily_activities;
drop table if exists public.daily_activities;

create table public.activity_sessions (
  id                  uuid primary key default gen_random_uuid(),
  activity_date         date not null default current_date,
  camp_id                 uuid references public.camps(id),
  project_name              text not null,
  activity_type               text not null,
  beneficiaries_male            int not null default 0,
  beneficiaries_female            int not null default 0,
  beneficiaries_children            int not null default 0,
  beneficiaries_adults                int not null default 0,
  total_beneficiaries                   int generated always as
    (beneficiaries_male + beneficiaries_female) stored,
  description                             text,
  challenges                                 text,
  attachments                                  jsonb not null default '[]'::jsonb,
  created_by                                     uuid not null references public.profiles(id),
  created_at                                       timestamptz not null default now(),
  updated_at                                         timestamptz not null default now()
);

create index if not exists idx_activity_sessions_date on public.activity_sessions(activity_date);
create index if not exists idx_activity_sessions_camp on public.activity_sessions(camp_id);
create index if not exists idx_activity_sessions_created_by on public.activity_sessions(created_by);

create table public.activity_session_participants (
  session_id     uuid not null references public.activity_sessions(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index if not exists idx_session_participants_profile on public.activity_session_participants(profile_id);

alter table public.activity_sessions enable row level security;
alter table public.activity_session_participants enable row level security;

-- A session is visible to whoever filed it, whoever participated in it, or management.
drop policy if exists sessions_select on public.activity_sessions;
create policy sessions_select on public.activity_sessions
  for select using (
    created_by = auth.uid()
    or public.is_management()
    or exists (
      select 1 from public.activity_session_participants p
      where p.session_id = id and p.profile_id = auth.uid()
    )
  );

drop policy if exists sessions_insert on public.activity_sessions;
create policy sessions_insert on public.activity_sessions
  for insert with check (created_by = auth.uid());

drop policy if exists sessions_update on public.activity_sessions;
create policy sessions_update on public.activity_sessions
  for update using (created_by = auth.uid() or public.is_management());

-- Participants are visible to the session's creator/participants/management,
-- and can only be added by the session's own creator (or management).
drop policy if exists session_participants_select on public.activity_session_participants;
create policy session_participants_select on public.activity_session_participants
  for select using (
    profile_id = auth.uid()
    or public.is_management()
    or exists (
      select 1 from public.activity_sessions s
      where s.id = session_id and s.created_by = auth.uid()
    )
  );

drop policy if exists session_participants_insert on public.activity_session_participants;
create policy session_participants_insert on public.activity_session_participants
  for insert with check (
    public.is_management()
    or exists (
      select 1 from public.activity_sessions s
      where s.id = session_id and s.created_by = auth.uid()
    )
  );

drop policy if exists session_participants_delete on public.activity_session_participants;
create policy session_participants_delete on public.activity_session_participants
  for delete using (
    public.is_management()
    or exists (
      select 1 from public.activity_sessions s
      where s.id = session_id and s.created_by = auth.uid()
    )
  );
