-- ============================================================================
-- 1. Fix "infinite recursion detected in policy for relation activity_sessions"
--
-- sessions_select looked into activity_session_participants, whose policies
-- look back into activity_sessions — Postgres re-applies row security inside
-- those sub-queries, so every insert/select on a session looped forever.
-- The two checks now run inside SECURITY DEFINER functions, which read the
-- tables without re-entering the policies. Who can see/do what is unchanged.
-- ============================================================================
create or replace function public.is_session_creator(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_sessions s
    where s.id = p_session and s.created_by = auth.uid()
  );
$$;

create or replace function public.is_session_participant(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity_session_participants p
    where p.session_id = p_session and p.profile_id = auth.uid()
  );
$$;

drop policy if exists sessions_select on public.activity_sessions;
create policy sessions_select on public.activity_sessions
  for select using (
    created_by = auth.uid()
    or public.is_management()
    or public.is_session_participant(id)
  );

drop policy if exists session_participants_select on public.activity_session_participants;
create policy session_participants_select on public.activity_session_participants
  for select using (
    profile_id = auth.uid()
    or public.is_management()
    or public.is_session_creator(session_id)
  );

drop policy if exists session_participants_insert on public.activity_session_participants;
create policy session_participants_insert on public.activity_session_participants
  for insert with check (
    public.is_management()
    or public.is_session_creator(session_id)
  );

drop policy if exists session_participants_delete on public.activity_session_participants;
create policy session_participants_delete on public.activity_session_participants
  for delete using (
    public.is_management()
    or public.is_session_creator(session_id)
  );

-- ============================================================================
-- 2. Eight beneficiary categories (replaces male / female / children / adults
--    on new entries; the old columns stay so past reports keep their numbers).
-- ============================================================================
alter table public.activity_sessions
  add column if not exists ben_men                int not null default 0 check (ben_men >= 0),
  add column if not exists ben_women              int not null default 0 check (ben_women >= 0),
  add column if not exists ben_men_disability     int not null default 0 check (ben_men_disability >= 0),
  add column if not exists ben_women_disability   int not null default 0 check (ben_women_disability >= 0),
  add column if not exists ben_boys               int not null default 0 check (ben_boys >= 0),
  add column if not exists ben_boys_disability    int not null default 0 check (ben_boys_disability >= 0),
  add column if not exists ben_girls              int not null default 0 check (ben_girls >= 0),
  add column if not exists ben_girls_disability   int not null default 0 check (ben_girls_disability >= 0);

-- Total = the eight categories when used; otherwise the legacy male + female
-- (so entries made before this change keep their totals).
alter table public.activity_sessions drop column if exists total_beneficiaries;
alter table public.activity_sessions
  add column total_beneficiaries int generated always as (
    case
      when ben_men + ben_women + ben_men_disability + ben_women_disability
         + ben_boys + ben_boys_disability + ben_girls + ben_girls_disability > 0
        then ben_men + ben_women + ben_men_disability + ben_women_disability
           + ben_boys + ben_boys_disability + ben_girls + ben_girls_disability
      else beneficiaries_male + beneficiaries_female
    end
  ) stored;

-- ============================================================================
-- 3. GBV / sexual exploitation and abuse: "did you encounter such cases among
--    the beneficiaries?" Counts only — no names or details are collected here;
--    cases are referred through the protection coordinator's channel.
-- ============================================================================
alter table public.activity_sessions
  add column if not exists gbv_encountered  boolean not null default false,
  add column if not exists gbv_cases_count  int not null default 0 check (gbv_cases_count >= 0),
  add column if not exists gbv_referred     boolean not null default false,
  add constraint activity_sessions_gbv_consistent
    check (gbv_encountered or (gbv_cases_count = 0 and not gbv_referred));
