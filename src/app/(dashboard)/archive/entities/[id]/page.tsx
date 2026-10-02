import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { documentsLinkedToEntities, entityLabel, getTaxonomy, type DocListRow } from "@/lib/archive/data";
import { ENTITY_TYPES, MEMBER_ROLE_AR, PROJECT_FILE_SLOTS, archiveRole, categoryMatches } from "@/lib/archive/constants";
import type { ArchiveEntity } from "@/types/database";
import DocList from "../../_components/DocList";
import { removeProjectMember, setProjectMember, updateEntity } from "../../actions";

export default async function EntityCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { categories } = await getTaxonomy();

  const { data: row } = await supabase.from("archive_entities").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const entity = row as ArchiveEntity;
  const isProject = entity.entity_type === "project";

  const [{ data: childRows }, { data: parentRow }] = await Promise.all([
    supabase.from("archive_entities").select("*").eq("parent_id", id).order("code"),
    entity.parent_id
      ? supabase.from("archive_entities").select("*").eq("id", entity.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const children = (childRows ?? []) as ArchiveEntity[];
  const parent = parentRow as ArchiveEntity | null;

  // A project's file gathers what is linked to the project or to its activities/cases.
  const docs = await documentsLinkedToEntities(isProject ? [id, ...children.map((c) => c.id)] : [id]);

  let members: { profile_id: string; member_role: keyof typeof MEMBER_ROLE_AR; full_name: string }[] = [];
  let allProfiles: { id: string; full_name: string }[] = [];
  let canManage = false;
  if (isProject) {
    const [{ data: m }, { data: p }, { data: manage }] = await Promise.all([
      supabase.from("archive_project_members").select("profile_id, member_role").eq("project_id", id),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.rpc("archive_can_manage_project", { p_project_id: id }),
    ]);
    allProfiles = (p ?? []) as { id: string; full_name: string }[];
    const names = new Map(allProfiles.map((x) => [x.id, x.full_name]));
    members = ((m ?? []) as { profile_id: string; member_role: keyof typeof MEMBER_ROLE_AR }[]).map((x) => ({
      ...x,
      full_name: names.get(x.profile_id) ?? "—",
    }));
    canManage = manage === true;
  }

  // Other entities that share documents with this one (e.g. the donors of a project).
  const { data: coLinks } = docs.length
    ? await supabase
        .from("archive_links")
        .select("target_entity_id")
        .in("document_id", docs.map((d) => d.id))
        .not("target_entity_id", "is", null)
    : { data: [] };
  const relatedIds = Array.from(
    new Set(((coLinks ?? []) as { target_entity_id: string }[]).map((l) => l.target_entity_id))
  ).filter((x) => x !== id && !children.some((c) => c.id === x));
  const { data: relatedRows } = relatedIds.length
    ? await supabase.from("archive_entities").select("*").in("id", relatedIds).neq("entity_type", "beneficiary")
    : { data: [] };
  const related = (relatedRows ?? []) as ArchiveEntity[];

  const role = archiveRole(profile.role);
  const canEdit = role === "executive_director" || role === "archivist" || entity.created_by === profile.id;

  let grouped: { title: string; note: string; docs: DocListRow[] }[];
  if (isProject) {
    const used = new Set<string>();
    grouped = PROJECT_FILE_SLOTS.map((slot) => {
      const inSlot = docs.filter((d) => !used.has(d.id) && slot.codes.some((c) => categoryMatches(d.category_code, c)));
      inSlot.forEach((d) => used.add(d.id));
      return { title: slot.title, note: slot.note, docs: inSlot };
    });
    const rest = docs.filter((d) => !used.has(d.id));
    if (rest.length) grouped.push({ title: "أخرى", note: "", docs: rest });
  } else {
    const sections = categories.filter((c) => c.level === 1);
    grouped = sections
      .map((s) => ({
        title: `${s.code} — ${s.name_ar}`,
        note: "",
        docs: docs.filter((d) => categoryMatches(d.category_code, s.code)),
      }))
      .filter((g) => g.docs.length > 0);
  }

  return (
    <div className="space-y-6">
      {sp.created && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">أُنشئ الكيان برمز {entity.code}.</div>}
      {sp.saved && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم الحفظ.</div>}
      {sp.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>}

      <div className="card">
        <p className="text-xs text-gray-500">
          <Link href={`/archive/entities?type=${entity.entity_type}`} className="hover:underline">
            {ENTITY_TYPES[entity.entity_type].ar}
          </Link>
          {parent && (
            <>
              {" ← "}
              <Link href={`/archive/entities/${parent.id}`} className="hover:underline">{entityLabel(parent)}</Link>
            </>
          )}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          <span dir="ltr" className="ml-2 font-mono text-brand-700">{entity.code}</span>
          {entity.name ?? "رمز مستفيد مجهَّل"}
        </h2>
        {entity.description && <p className="mt-2 text-sm text-gray-600">{entity.description}</p>}
        <p className="mt-2 text-xs text-gray-500">
          {entity.start_date && `من ${entity.start_date}`} {entity.end_date && `إلى ${entity.end_date}`}
          {!entity.is_active && " · غير نشط"} · {docs.length} مستند مرتبط تملك صلاحية رؤيته
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {isProject && (
            <p className="text-sm text-gray-500">
              ملف المشروع القياسي: الخانات ليست مجلدات، بل عروض تُجمَّع آلياً من التصنيفات بالروابط.
            </p>
          )}
          {grouped.length === 0 && <div className="card text-sm text-gray-400">لا مستندات مرتبطة بعد.</div>}
          {grouped.map((g) => (
            <div key={g.title} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">{g.title}</h3>
                {g.note && <span className="text-xs text-gray-400">{g.note}</span>}
              </div>
              <DocList docs={g.docs} categories={categories} empty="—" />
            </div>
          ))}
        </div>

        <aside className="space-y-6">
          {children.length > 0 && (
            <div className="card">
              <h3 className="mb-2 font-bold">يتفرع عنه</h3>
              <ul className="space-y-1 text-sm">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/archive/entities/${c.id}`} className="hover:text-brand-700 hover:underline">
                      {entityLabel(c)} <span className="text-[11px] text-gray-400">({ENTITY_TYPES[c.entity_type].ar})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {related.length > 0 && (
            <div className="card">
              <h3 className="mb-2 font-bold">كيانات مرتبطة عبر المستندات</h3>
              <ul className="space-y-1 text-sm">
                {related.map((c) => (
                  <li key={c.id}>
                    <Link href={`/archive/entities/${c.id}`} className="hover:text-brand-700 hover:underline">
                      {entityLabel(c)} <span className="text-[11px] text-gray-400">({ENTITY_TYPES[c.entity_type].ar})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isProject && (
            <div className="card">
              <h3 className="mb-1 font-bold">فريق المشروع (النطاق)</h3>
              <p className="mb-3 text-xs text-gray-500">
                الأعضاء يقرؤون مستندات المشروع حتى الدرجة التي تسمح بها أدوارهم، ويُدرجون فيه.
              </p>
              <ul className="space-y-1.5 text-sm">
                {members.length === 0 && <li className="text-gray-400">لا أعضاء بعد.</li>}
                {members.map((m) => (
                  <li key={m.profile_id} className="flex items-center justify-between gap-2">
                    <span>
                      {m.full_name} <span className="text-[11px] text-gray-400">{MEMBER_ROLE_AR[m.member_role]}</span>
                    </span>
                    {canManage && (
                      <form action={removeProjectMember}>
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="profile_id" value={m.profile_id} />
                        <button className="text-[11px] text-gray-400 hover:text-red-600">إزالة</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {canManage && (
                <form action={setProjectMember} className="mt-3 space-y-2 border-t border-black/5 pt-3">
                  <input type="hidden" name="project_id" value={id} />
                  <select name="profile_id" className="input" required defaultValue="">
                    <option value="" disabled>اختر شخصاً</option>
                    {allProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                  <select name="member_role" className="input" defaultValue="member">
                    {Object.entries(MEMBER_ROLE_AR).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <button className="btn-secondary w-full">إضافة / تحديث</button>
                </form>
              )}
            </div>
          )}

          {canEdit && (
            <details className="card">
              <summary className="cursor-pointer font-bold">تعديل البطاقة</summary>
              <form action={updateEntity} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={id} />
                {entity.entity_type !== "beneficiary" && (
                  <input name="name" defaultValue={entity.name ?? ""} className="input" placeholder="الاسم" />
                )}
                <textarea name="description" defaultValue={entity.description ?? ""} rows={2} className="input" placeholder="الوصف" />
                <label className="block text-xs text-gray-500">
                  البدء
                  <input type="date" name="start_date" defaultValue={entity.start_date ?? ""} className="input mt-1" />
                </label>
                <label className="block text-xs text-gray-500">
                  الإغلاق / الانتهاء (تُحتسب منه مدد الاحتفاظ)
                  <input type="date" name="end_date" defaultValue={entity.end_date ?? ""} className="input mt-1" />
                </label>
                <select name="is_active" defaultValue={String(entity.is_active)} className="input">
                  <option value="true">نشط</option>
                  <option value="false">غير نشط</option>
                </select>
                <button className="btn-secondary w-full">حفظ</button>
              </form>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
