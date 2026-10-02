import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy, entityLabel } from "@/lib/archive/data";
import {
  ENTITY_CREATORS,
  ENTITY_TYPES,
  EVIDENCE_PACKS,
  LANGUAGE_AR,
  LINK_TYPES,
  OFFER_PROVIDER_AR,
  RECORD_STATUS_AR,
  SENSITIVITY,
  archiveRole,
  categoryMatches,
  categoryPath,
  formatBytes,
  formatDateTime,
  retentionFor,
} from "@/lib/archive/constants";
import type {
  ArchiveAccessLogEntry,
  ArchiveDocument,
  ArchiveDocumentVersion,
  ArchiveEntity,
  ArchiveLink,
  EntityType,
} from "@/types/database";
import { updateDocument, removeLink } from "../../actions";
import { LinkStatusBadge, SensitivityBadge, StatusBadge } from "../../_components/badges";
import LinkEditor from "./_components/LinkEditor";
import AddVersionForm from "./_components/AddVersionForm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-black/5 py-2.5 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  );
}

const ACTION_AR: Record<string, string> = { view: "اطلاع", download: "تنزيل", export: "تصدير", public_download: "تنزيل عام" };
const AUDIT_AR: Record<string, string> = {
  "archive.document.create": "إدراج",
  "archive.document.update": "تعديل البيانات الوصفية",
  "archive.document.version": "إصدار جديد",
  "archive.link.add": "إضافة رابط",
  "archive.link.remove": "إزالة رابط",
};

export default async function ArchiveDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const { created, saved, error } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { categories, docTypes, rules } = await getTaxonomy();

  const { data: docRow } = await supabase.from("archive_documents").select("*").eq("id", id).maybeSingle();
  if (!docRow) notFound();
  const doc = docRow as ArchiveDocument;

  const [, canReadRes, versionsRes, outRes, inRes, logAllowedRes, insertableRes] = await Promise.all([
    supabase.rpc("archive_log_access", { p_document_id: id, p_version_no: null, p_action: "view" }),
    supabase.rpc("archive_can_read_doc", { p_doc_id: id }),
    supabase.from("archive_document_versions").select("*").eq("document_id", id).order("version_no", { ascending: false }),
    supabase.from("archive_links").select("*").eq("document_id", id),
    supabase.from("archive_links").select("*").eq("target_document_id", id),
    supabase.rpc("archive_can_read_access_log"),
    supabase.rpc("archive_my_insert_categories"),
  ]);
  const canRead = canReadRes.data === true;
  const versions = (versionsRes.data ?? []) as ArchiveDocumentVersion[];
  const outLinks = (outRes.data ?? []) as ArchiveLink[];
  const inLinks = (inRes.data ?? []) as ArchiveLink[];

  const entityIds = outLinks.map((l) => l.target_entity_id).filter(Boolean) as string[];
  const docIds = [
    ...outLinks.map((l) => l.target_document_id).filter(Boolean),
    ...inLinks.map((l) => l.document_id),
  ] as string[];
  const peopleIds = Array.from(new Set([doc.created_by, ...versions.map((v) => v.uploaded_by)]));

  const [entitiesRes, docsRes, peopleRes, logRes, auditRes] = await Promise.all([
    entityIds.length ? supabase.from("archive_entities").select("*").in("id", entityIds) : Promise.resolve({ data: [] }),
    docIds.length
      ? supabase.from("archive_documents").select("id, archive_number, title, category_code").in("id", docIds)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("id, full_name").in("id", peopleIds),
    logAllowedRes.data
      ? supabase.from("archive_access_log").select("*").eq("document_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    logAllowedRes.data
      ? supabase.from("archive_audit").select("id, actor_id, action, created_at").eq("object_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ]);
  const audit = (auditRes.data ?? []) as { id: number; actor_id: string | null; action: string; created_at: string }[];
  const entities = new Map(((entitiesRes.data ?? []) as ArchiveEntity[]).map((e) => [e.id, e]));
  const linkedDocs = new Map(
    ((docsRes.data ?? []) as { id: string; archive_number: string; title: string; category_code: string }[]).map((d) => [d.id, d])
  );
  const people = new Map(((peopleRes.data ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const log = (logRes.data ?? []) as ArchiveAccessLogEntry[];
  const actorIds = Array.from(
    new Set([...log.map((e) => e.actor_id), ...audit.map((a) => a.actor_id)].filter((x): x is string => !!x && !people.has(x)))
  );
  if (actorIds.length) {
    const { data: more } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    for (const p of (more ?? []) as { id: string; full_name: string }[]) people.set(p.id, p.full_name);
  }

  // Parents of linked entities (activity -> project -> program) also show this document.
  const parentIds = Array.from(entities.values()).map((e) => e.parent_id).filter((x): x is string => !!x && !entities.has(x));
  const parents = parentIds.length
    ? (((await supabase.from("archive_entities").select("*").in("id", parentIds)).data ?? []) as ArchiveEntity[])
    : [];

  const category = categories.find((c) => c.code === doc.category_code)!;
  const path = categoryPath(doc.category_code, categories);
  const type = docTypes.find((t) => t.code === doc.doc_type);
  const missingKeys = new Set(doc.missing_links.map((m) => m.key));
  const missingRules = rules.filter((r) => r.doc_type === doc.doc_type && missingKeys.has(r.req_key));

  const linkedEnd =
    category.retention_basis === "service_end"
      ? Array.from(entities.values()).find((e) => e.entity_type === "person")?.end_date ?? null
      : Array.from(entities.values()).find((e) => e.entity_type === "project")?.end_date ?? null;
  const retention = retentionFor(category, doc.document_date, linkedEnd);

  const role = archiveRole(profile.role);
  const insertable = new Set(((insertableRes.data ?? []) as { code: string }[]).map((c) => c.code));
  const canEdit = doc.created_by === profile.id || role === "archivist" || (canRead && insertable.has(doc.category_code));
  const creatable = (Object.keys(ENTITY_CREATORS) as EntityType[]).filter((t) => ENTITY_CREATORS[t].includes(role));
  const packs = EVIDENCE_PACKS.filter((p) => p.items.some((i) => i.codes.some((c) => categoryMatches(doc.category_code, c))));
  const sens = SENSITIVITY[doc.sensitivity];

  return (
    <div className="space-y-6">
      {created && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          أُدرج المستند برقم الأرشفة {doc.archive_number}.
        </div>
      )}
      {saved && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم الحفظ.</div>}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span dir="ltr" className="font-mono text-sm font-semibold text-brand-700">
            {doc.archive_number}
          </span>
          <SensitivityBadge level={doc.sensitivity} withName />
          <StatusBadge status={doc.record_status} />
          <LinkStatusBadge status={doc.link_status} />
        </div>
        <h2 className="mt-2 text-xl font-bold leading-snug">{doc.title}</h2>
        {doc.title_en && (
          <p dir="ltr" className="mt-1 text-right text-sm text-gray-500">
            {doc.title_en}
          </p>
        )}
        {versions[0] &&
          (canRead ? (
            <a href={`/api/archive/file/${versions[0].id}`} className="btn-primary mt-4">
              فتح الملف (الإصدار {versions[0].version_no})
            </a>
          ) : (
            <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              ترى البيانات الوصفية فقط؛ فتح المحتوى غير متاح لدورك (فصل المهام).
            </p>
          ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-2 font-bold">بطاقة المستند</h3>
            <dl>
              <Row label="الموضع الأصلي">
                {path.map((c, i) => (
                  <span key={c.code}>
                    {i > 0 && <span className="mx-1 text-gray-400">←</span>}
                    <Link href={`/archive/category/${c.code}`} className="hover:text-brand-700 hover:underline">
                      {c.name_ar}
                    </Link>
                  </span>
                ))}{" "}
                <span dir="ltr" className="font-mono text-xs text-gray-400">({doc.category_code})</span>
              </Row>
              <Row label="نوع المستند">{type?.name_ar ?? doc.doc_type}</Row>
              <Row label="تاريخ المستند / الإدخال">
                {doc.document_date} / {doc.created_at.slice(0, 10)} — أدخله {people.get(doc.created_by) ?? "—"}
              </Row>
              <Row label="المصدر">{doc.source}</Row>
              <Row label="المسؤول عن المستند">{doc.responsible}</Row>
              <Row label="الحالة">{RECORD_STATUS_AR[doc.record_status]}</Row>
              <Row label="اللغة">{LANGUAGE_AR[doc.language]}</Row>
              {doc.budget_line && <Row label="بند الموازنة">{doc.budget_line}</Row>}
              {doc.offer_provider_type && <Row label="مقدِّم العرض">{OFFER_PROVIDER_AR[doc.offer_provider_type]}</Row>}
              {doc.is_unpublished && <Row label="النشر">غير منشور</Row>}
              {doc.keywords && <Row label="كلمات مفتاحية">{doc.keywords}</Row>}
              <Row label="الإصدار والبصمة">
                الإصدار {doc.current_version}
                {versions[0] && (
                  <span dir="ltr" className="mt-1 block break-all font-mono text-[11px] text-gray-500">
                    SHA-256 {versions[0].sha256}
                  </span>
                )}
              </Row>
              <Row label="الحساسية والوصول">
                {sens.code} {sens.name}: {sens.who}
              </Row>
              <Row label="الاحتفاظ">
                {category.retention_note_ar}
                <span className="block text-xs text-gray-500">
                  {retention.until
                    ? `ينتهي الاحتفاظ في ${retention.until}`
                    : category.retention_basis === "project_end"
                      ? "يُحتسب تاريخ الانتهاء آلياً عند تسجيل تاريخ إغلاق المشروع في بطاقته"
                      : category.retention_basis === "service_end"
                        ? "يُحتسب تاريخ الانتهاء آلياً عند تسجيل انتهاء الخدمة في بطاقة الشخص"
                        : null}
                </span>
                <span className="block text-[11px] text-gray-400">جدول الاحتفاظ 16.01 (مقترح، يحتاج مراجعة قانونية)</span>
              </Row>
            </dl>
          </div>

          <div className="card">
            <h3 className="mb-3 font-bold">الروابط</h3>
            {outLinks.length === 0 && inLinks.length === 0 && <p className="text-sm text-gray-400">لا روابط بعد.</p>}
            <ul className="space-y-2">
              {outLinks.map((l) => {
                const e = l.target_entity_id ? entities.get(l.target_entity_id) : undefined;
                const d = l.target_document_id ? linkedDocs.get(l.target_document_id) : undefined;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800">
                      {LINK_TYPES[l.link_type].ar}
                    </span>
                    {e && (
                      <Link href={`/archive/entities/${e.id}`} className="hover:text-brand-700 hover:underline">
                        {entityLabel(e)} <span className="text-[11px] text-gray-400">({ENTITY_TYPES[e.entity_type].ar})</span>
                      </Link>
                    )}
                    {d && (
                      <Link href={`/archive/doc/${d.id}`} prefetch={false} className="hover:text-brand-700 hover:underline">
                        <span dir="ltr" className="font-mono text-xs">{d.archive_number}</span> {d.title}
                      </Link>
                    )}
                    {(l.created_by === profile.id || role === "archivist") && (
                      <form action={removeLink} className="mr-auto">
                        <input type="hidden" name="link_id" value={l.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        <button className="text-[11px] text-gray-400 hover:text-red-600">إزالة</button>
                      </form>
                    )}
                  </li>
                );
              })}
              {inLinks.map((l) => {
                const d = linkedDocs.get(l.document_id);
                if (!d) return null;
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">
                      يُشار إليه ({LINK_TYPES[l.link_type].ar})
                    </span>
                    <Link href={`/archive/doc/${d.id}`} prefetch={false} className="hover:text-brand-700 hover:underline">
                      <span dir="ltr" className="font-mono text-xs">{d.archive_number}</span> {d.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {canEdit && (
              <div className="mt-4 border-t border-black/5 pt-4">
                <LinkEditor documentId={doc.id} missing={missingRules} creatable={creatable} />
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-3 font-bold">سجل الإصدارات (16.03)</h3>
            <ul className="divide-y divide-black/5">
              {versions.map((v) => (
                <li key={v.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">الإصدار {v.version_no}</span>
                    {v.version_no === 1 && <span className="text-xs text-gray-500">(الأصل غير المعدَّل)</span>}
                    {canRead && (
                      <a href={`/api/archive/file/${v.id}`} className="mr-auto text-xs font-semibold text-brand-700 hover:underline">
                        تنزيل
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {v.file_name} · {formatBytes(v.file_size)} · {people.get(v.uploaded_by) ?? "—"} ·{" "}
                    {formatDateTime(v.uploaded_at)}
                  </p>
                  {v.change_reason && <p className="mt-1 text-xs text-gray-700">سبب التعديل: {v.change_reason}</p>}
                  <p dir="ltr" className="mt-1 break-all text-left font-mono text-[10px] text-gray-400">
                    {v.sha256}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {logAllowedRes.data && (
            <div className="card">
              <h3 className="mb-3 font-bold">سجل الوصول (16.02)</h3>
              {log.length === 0 ? (
                <p className="text-sm text-gray-400">لا سجلات.</p>
              ) : (
                <ul className="space-y-1 text-xs text-gray-600">
                  {log.map((e) => (
                    <li key={e.id}>
                      {formatDateTime(e.created_at)} — {ACTION_AR[e.action]}
                      {e.version_no ? ` (الإصدار ${e.version_no})` : ""} — {e.actor_id ? (people.get(e.actor_id) ?? e.actor_id.slice(0, 8)) : "زائر"}
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="mb-2 mt-5 font-bold">سجل التعديلات</h3>
              <ul className="space-y-1 text-xs text-gray-600">
                {audit.map((a) => (
                  <li key={a.id}>
                    {formatDateTime(a.created_at)} — {AUDIT_AR[a.action] ?? a.action} —{" "}
                    {a.actor_id ? (people.get(a.actor_id) ?? a.actor_id.slice(0, 8)) : "—"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card">
            <h3 className="mb-2 font-bold">أين يظهر دون نسخ؟</h3>
            <ul className="space-y-1.5 text-sm">
              {[...Array.from(entities.values()), ...parents].map((e) => (
                <li key={e.id}>
                  <Link href={`/archive/entities/${e.id}`} className="hover:text-brand-700 hover:underline">
                    {e.entity_type === "project" ? "ملف المشروع" : `بطاقة ${ENTITY_TYPES[e.entity_type].ar}`} {entityLabel(e)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/archive/category/${doc.category_code}`} className="hover:text-brand-700 hover:underline">
                  موضعه الأصلي {doc.category_code}
                </Link>
              </li>
              {packs.map((p) => (
                <li key={p.key}>
                  <Link href={`/archive/packs/${p.key}`} className="hover:text-brand-700 hover:underline">
                    {p.title} (16.06)
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {doc.link_status === "incomplete" && !canEdit && (
            <div className="card border-orange-200">
              <h3 className="mb-2 font-bold text-orange-800">روابط إلزامية ناقصة</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                {doc.missing_links.map((m) => (
                  <li key={m.key}>{m.label}</li>
                ))}
              </ul>
            </div>
          )}

          {canEdit && canRead && (
            <div className="card">
              <h3 className="mb-3 font-bold">إصدار جديد</h3>
              <AddVersionForm documentId={doc.id} />
            </div>
          )}

          {canEdit && (
            <details className="card">
              <summary className="cursor-pointer font-bold">تعديل البيانات الوصفية</summary>
              <form action={updateDocument} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={doc.id} />
                <input name="title" defaultValue={doc.title} className="input" placeholder="العنوان" />
                <input name="title_en" defaultValue={doc.title_en ?? ""} className="input" dir="ltr" placeholder="English title" />
                <input name="source" defaultValue={doc.source} className="input" placeholder="المصدر" />
                <input name="responsible" defaultValue={doc.responsible} className="input" placeholder="المسؤول" />
                <input name="keywords" defaultValue={doc.keywords ?? ""} className="input" placeholder="كلمات مفتاحية" />
                {doc.doc_type === "payment_voucher" && (
                  <input name="budget_line" defaultValue={doc.budget_line ?? ""} className="input" placeholder="بند الموازنة" />
                )}
                <select name="record_status" defaultValue={doc.record_status} className="input">
                  {Object.entries(RECORD_STATUS_AR).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select name="sensitivity" defaultValue={doc.sensitivity} className="input">
                  {SENSITIVITY.filter((s) => s.level >= doc.sensitivity).map((s) => (
                    <option key={s.level} value={s.level}>{s.code} — {s.name}</option>
                  ))}
                </select>
                {doc.doc_type === "activity_media" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="hidden" name="is_unpublished_present" value="1" />
                    <input type="checkbox" name="is_unpublished" defaultChecked={doc.is_unpublished} /> غير منشور
                  </label>
                )}
                <button className="btn-secondary w-full">حفظ</button>
                <p className="text-[11px] text-gray-400">
                  رقم الأرشفة والتصنيف ونوع المستند ثابتة. كل تعديل يُسجَّل في سجل التدقيق.
                </p>
              </form>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
