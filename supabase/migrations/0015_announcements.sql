-- ============================================================================
-- 0015: Official announcements (تعميمات) and requests addressed to everyone.
--
--   1. Management issues announcements to everyone or to chosen roles. Each
--      user sees an unread announcement as a memo the moment they open the
--      system, until they confirm they have read it; the sender sees who read.
--   2. A request can be addressed to every user of the system.
-- Safe to run more than once.
-- ============================================================================

create sequence if not exists public.announcement_seq;

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  number       int not null default nextval('public.announcement_seq'),
  title        text not null check (length(btrim(title)) > 0),
  body         text not null check (length(btrim(body)) > 0),
  priority     text not null default 'normal' check (priority in ('normal', 'important', 'urgent')),
  audience     text[],                 -- null = everyone; otherwise the roles addressed
  attachments  jsonb not null default '[]'::jsonb,
  created_by   uuid not null references public.profiles(id),
  -- who issued it and in what capacity, as at the time of issue (staff cannot
  -- read each other's profiles)
  sender_name  text not null,
  sender_role  text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  is_active    boolean not null default true
);

create index if not exists idx_announcements_created on public.announcements(created_at desc);

create table if not exists public.announcement_reads (
  announcement_id  uuid not null references public.announcements(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  read_at          timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select using (
    created_by = auth.uid()
    or public.is_management()
    or (
      is_active
      and (expires_at is null or expires_at > now())
      and (audience is null or public.current_user_role()::text = any (audience))
    )
  );

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements
  for insert with check (created_by = auth.uid() and public.is_management());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements
  for update using (created_by = auth.uid() or public.is_admin_like());

drop policy if exists announcement_reads_select on public.announcement_reads;
create policy announcement_reads_select on public.announcement_reads
  for select using (profile_id = auth.uid() or public.is_management());

drop policy if exists announcement_reads_insert on public.announcement_reads;
create policy announcement_reads_insert on public.announcement_reads
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );

grant select, insert, update on public.announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;
grant usage on sequence public.announcement_seq to authenticated;

-- Files attached to announcements are checked against the institutional database too.
do $$ begin
  if to_regclass('public.archive_intake_queue') is not null then
    alter table public.archive_intake_queue drop constraint if exists archive_intake_queue_source_check;
    alter table public.archive_intake_queue
      add constraint archive_intake_queue_source_check check (source in ('bulk', 'ai_chat', 'request', 'announcement'));
  end if;
exception when undefined_column then null;
end $$;

-- ---- 2. Requests to everyone -------------------------------------------------------
alter table public.requests add column if not exists to_all boolean not null default false;

drop policy if exists requests_recipient_select on public.requests;
create policy requests_recipient_select on public.requests
  for select using (
    to_all
    or recipient_role = public.current_user_role()
    or recipient_id = auth.uid()
    or public.is_admin_like()
  );

-- A request to everyone is answered in its thread; only its sender and the
-- executive director / system admin set its status.
drop policy if exists requests_recipient_update on public.requests;
create policy requests_recipient_update on public.requests
  for update using (
    (not to_all and (recipient_role = public.current_user_role() or recipient_id = auth.uid()))
    or (to_all and requester_id = auth.uid())
    or public.is_admin_like()
  );

notify pgrst, 'reload schema';
