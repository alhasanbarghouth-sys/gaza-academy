-- ============================================================================
-- 0011: "Delete for me" on requests and their replies.
--
-- Deleting a request or a reply only hides it from the person who deleted it:
-- the sender still sees what the recipient deleted and vice versa, and the
-- record itself is kept for the institution's audit trail.
-- A new reply from someone else brings a hidden request back into view so a
-- conversation cannot be lost by mistake.
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.request_hidden (
  request_id  uuid not null references public.requests(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (request_id, profile_id)
);

create table if not exists public.request_message_hidden (
  message_id  uuid not null references public.request_messages(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (message_id, profile_id)
);

alter table public.request_hidden enable row level security;
alter table public.request_message_hidden enable row level security;

-- Everyone sees and manages only their own deletions.
drop policy if exists request_hidden_select on public.request_hidden;
create policy request_hidden_select on public.request_hidden
  for select using (profile_id = auth.uid());

drop policy if exists request_hidden_insert on public.request_hidden;
create policy request_hidden_insert on public.request_hidden
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_id)
  );

drop policy if exists request_hidden_delete on public.request_hidden;
create policy request_hidden_delete on public.request_hidden
  for delete using (profile_id = auth.uid());

drop policy if exists request_message_hidden_select on public.request_message_hidden;
create policy request_message_hidden_select on public.request_message_hidden
  for select using (profile_id = auth.uid());

drop policy if exists request_message_hidden_insert on public.request_message_hidden;
create policy request_message_hidden_insert on public.request_message_hidden
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.request_messages m where m.id = message_id)
  );

drop policy if exists request_message_hidden_delete on public.request_message_hidden;
create policy request_message_hidden_delete on public.request_message_hidden
  for delete using (profile_id = auth.uid());

grant select, insert, delete on public.request_hidden, public.request_message_hidden to authenticated;

-- A reply moves the request to the top of both inboxes and shows it again to
-- anyone (other than its author) who had deleted it.
create or replace function public.touch_request_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.requests set updated_at = now() where id = new.request_id;
  delete from public.request_hidden where request_id = new.request_id and profile_id <> new.author_id;
  return new;
end;
$$;

notify pgrst, 'reload schema';
