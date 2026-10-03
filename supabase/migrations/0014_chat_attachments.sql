-- ============================================================================
-- 0014: Files in conversations (AI assistant and requests), checked against the
--       institutional database (requires 0008 and 0013).
--
-- Every file attached in a conversation is fingerprinted (SHA-256). If the
-- same file already exists in the institutional database or waits in an
-- intake queue, it is not stored again: the conversation points to the copy
-- that exists. A new file is kept and queued for AI classification and review
-- («إدراج ذكي»). Saved AI conversations get a last-activity time for listing.
-- Safe to run more than once.
-- ============================================================================

alter table public.archive_intake_queue
  add column if not exists sha256 text,
  add column if not exists source text not null default 'bulk';

do $$ begin
  alter table public.archive_intake_queue
    add constraint archive_intake_queue_source_check check (source in ('bulk', 'ai_chat', 'request'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_archive_intake_queue_sha on public.archive_intake_queue(sha256);
create index if not exists idx_archive_document_versions_sha on public.archive_document_versions(sha256);

alter table public.ai_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.request_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.requests add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.ai_conversations add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_ai_conversations_user on public.ai_conversations(user_id, updated_at desc);

notify pgrst, 'reload schema';
