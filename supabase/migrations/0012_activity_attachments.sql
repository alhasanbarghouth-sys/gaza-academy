-- ============================================================================
-- 0012: Photos and files attached to a daily activity report, filed in the
--       institutional database (requires 0008 and 0009).
--
-- Each daily report (one project, one day) gets its own folder in the
-- institutional database: an «activity» card (A-xxxx) named in Arabic after
-- the date, project, camp and activity type, under the project's card
-- (P-xxx). Photos and videos are filed as «صورة أو فيديو لنشاط» (07.07),
-- other files as «مرفق نشاط» (07.09), each linked to both cards, so they show
-- in the activity's folder, the project's file, search, and the assistant.
-- Safe to run more than once.
-- ============================================================================

alter table public.activity_sessions
  add column if not exists archive_entity_id uuid references public.archive_entities(id) on delete set null;

insert into public.archive_doc_types (code, name_ar, fixed_category, sort) values
  ('activity_attachment', 'مرفق نشاط (ملف أو مستند)', '07.09', 16)
on conflict (code) do nothing;

insert into public.archive_link_rules
  (doc_type, req_key, label_ar, entity_types, categories, stage, is_optional, alt_flag, default_link_type, sort) values
  ('activity_attachment', 'activity', 'النشاط', '{activity}', '{}', 'intake', false, null, 'proves', 1),
  ('activity_attachment', 'project', 'المشروع', '{project}', '{}', 'intake', false, null, 'belongs_to', 2)
on conflict (doc_type, req_key) do nothing;

/**
 * Returns the institutional-database folder of a daily report the caller took
 * part in, creating it on first use: the project's card (matched by name), the
 * caller's membership of that project (they work on it, so their uploads are
 * in their scope), and the activity's card.
 */
create or replace function public.activity_archive_folder(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_session  public.activity_sessions;
  v_camp     text;
  v_project  uuid;
  v_activity uuid;
  v_code     text;
begin
  perform public.archive_require_role(array['staff', 'volunteer', 'project_manager', 'executive_director', 'archivist']);

  select * into v_session from public.activity_sessions where id = p_session_id for update;
  if not found or not (v_session.created_by = v_uid or public.is_session_participant(p_session_id)) then
    raise exception 'لا تملك صلاحية الإرفاق بهذا النشاط';
  end if;

  if v_session.archive_entity_id is not null then
    select parent_id into v_project from public.archive_entities where id = v_session.archive_entity_id;
    v_activity := v_session.archive_entity_id;
  else
    select id into v_project from public.archive_entities
    where entity_type = 'project' and lower(btrim(name)) = lower(btrim(v_session.project_name))
    order by created_at limit 1;

    if v_project is null then
      v_code := 'P-' || public.archive_pad(public.archive_next_seq('entity:project', 0), 3);
      insert into public.archive_entities (entity_type, code, name, description, created_by)
      values ('project', v_code, btrim(v_session.project_name), 'أُنشئ تلقائياً من سجل النشاط اليومي', v_uid)
      returning id into v_project;
      perform public.archive_audit('archive.entity.create', 'archive_entity', v_project,
        jsonb_build_object('code', v_code, 'type', 'project', 'via', 'daily_log'));
    end if;

    select name into v_camp from public.camps where id = v_session.camp_id;
    v_code := 'A-' || public.archive_pad(public.archive_next_seq('entity:activity', 0), 4);
    insert into public.archive_entities
      (entity_type, code, name, description, parent_id, start_date, end_date, created_by)
    values (
      'activity', v_code,
      'نشاط ' || v_session.activity_date || ' — ' || btrim(v_session.project_name) || ' — '
        || coalesce(v_camp, 'بدون مخيم') || ' — ' || v_session.activity_type,
      'مجلد مرفقات تقرير النشاط اليومي',
      v_project, v_session.activity_date, v_session.activity_date, v_uid
    )
    returning id into v_activity;
    perform public.archive_audit('archive.entity.create', 'archive_entity', v_activity,
      jsonb_build_object('code', v_code, 'type', 'activity', 'via', 'daily_log', 'session_id', p_session_id));

    update public.activity_sessions set archive_entity_id = v_activity where id = p_session_id;
  end if;

  insert into public.archive_project_members (project_id, profile_id, member_role, added_by)
  values (v_project, v_uid, 'member', v_uid)
  on conflict (project_id, profile_id) do nothing;

  return jsonb_build_object('activity_id', v_activity, 'project_id', v_project);
end
$$;

revoke all on function public.activity_archive_folder(uuid) from public;
grant execute on function public.activity_archive_folder(uuid) to authenticated;

notify pgrst, 'reload schema';
