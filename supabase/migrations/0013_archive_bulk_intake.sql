-- ============================================================================
-- 0013: AI-assisted bulk intake for the institutional database (requires 0008).
--
-- Files dropped in bulk wait here, each with the classification the AI
-- proposes (type, category, title, date, sensitivity, links). Nothing enters
-- the institutional database until a person reviews and approves it; approval
-- goes through archive_create_document with all of its checks.
-- Each user sees and manages only their own queue. Safe to run more than once.
-- ============================================================================

create table if not exists public.archive_intake_queue (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references public.profiles(id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text,
  file_size     bigint not null default 0,
  status        text not null default 'uploaded'
                  check (status in ('uploaded', 'analyzing', 'ready', 'error', 'filed', 'discarded')),
  suggestion    jsonb,
  error         text,
  tokens        int,
  document_id   uuid references public.archive_documents(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_archive_intake_queue_owner on public.archive_intake_queue(created_by, status, created_at);

alter table public.archive_intake_queue enable row level security;

drop policy if exists archive_intake_queue_select on public.archive_intake_queue;
create policy archive_intake_queue_select on public.archive_intake_queue
  for select using (created_by = auth.uid());

drop policy if exists archive_intake_queue_insert on public.archive_intake_queue;
create policy archive_intake_queue_insert on public.archive_intake_queue
  for insert with check (created_by = auth.uid() and storage_path like auth.uid()::text || '/%');

drop policy if exists archive_intake_queue_update on public.archive_intake_queue;
create policy archive_intake_queue_update on public.archive_intake_queue
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists archive_intake_queue_delete on public.archive_intake_queue;
create policy archive_intake_queue_delete on public.archive_intake_queue
  for delete using (created_by = auth.uid());

grant select, insert, update, delete on public.archive_intake_queue to authenticated;

notify pgrst, 'reload schema';
