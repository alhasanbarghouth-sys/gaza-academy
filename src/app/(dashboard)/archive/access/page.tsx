import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/archive/data";
import { DESIGNATIONS, GRANT_PRESETS, MATRIX_ROLE_LABELS, SENSITIVITY, archiveRole, formatDateTime } from "@/lib/archive/constants";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import type { ArchiveAccessLogEntry, ArchiveGrant, ArchiveRoleMatrixRow } from "@/types/database";
import { createGrants, revokeGrant } from "../actions";

const ACTION_AR: Record<string, string> = { view: "اطلاع", download: "تنزيل", export: "تصدير", public_download: "تنزيل عام" };

function levelText(n: number) {
  return n < 0 ? "—" : n === 0 ? "S0" : `S0–S${n}`;
}

export default async function ArchiveAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; doc?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const role = archiveRole(profile.role);
  const isEd = role === "executive_director";
  const supabase = await createClient();
  const { categories, axes } = await getTaxonomy();

  const [{ data: grantRows }, { data: matrixRows }, { data: profiles }, { data: myCats }, { data: logAllowed }] =
    await Promise.all([
      supabase.from("archive_grants").select("*").order("created_at", { ascending: false }),
      supabase.from("archive_role_matrix").select("*"),
      supabase.from("profiles").select("id, full_name, role, is_active").order("full_name"),
      supabase.rpc("archive_my_insert_categories"),
      supabase.rpc("archive_can_read_access_log"),
    ]);
  const grants = (grantRows ?? []) as ArchiveGrant[];
  const matrix = (matrixRows ?? []) as ArchiveRoleMatrixRow[];
  const names = new Map(((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const now = Date.now();
  const isActive = (g: ArchiveGrant) => !g.revoked_at && (!g.valid_until || new Date(g.valid_until).getTime() > now);

  let log: (ArchiveAccessLogEntry & { archive_number?: string })[] = [];
  if (logAllowed) {
    let q = supabase.from("archive_access_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (sp.doc) {
      const { data: d } = await supabase.from("archive_documents").select("id").eq("archive_number", sp.doc.trim()).maybeSingle();
      q = q.eq("document_id", d?.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { data } = await q;
    log = (data ?? []) as ArchiveAccessLogEntry[];
    const docIds = Array.from(new Set(log.map((e) => e.document_id)));
    if (docIds.length) {
      const { data: docs } = await supabase.from("archive_documents").select("id, archive_number").in("id", docIds);
      const num = new Map(((docs ?? []) as { id: string; archive_number: string }[]).map((d) => [d.id, d.archive_number]));
      log = log.map((e) => ({ ...e, archive_number: num.get(e.document_id) }));
    }
  }

  const matrixRoles = Object.keys(MATRIX_ROLE_LABELS);
  const extraScopes = (r: string) => matrix.filter((m) => m.role === r && !axes.some((a) => a.code === m.scope_code));
  const cell = (r: string, axis: string) => {
    const m = matrix.find((x) => x.role === r && x.scope_code === axis);
    if (!m) return "—";
    const parts: string[] = [];
    if (m.read_max >= 0) parts.push(`قراءة ${levelText(m.read_max)}`);
    if (m.read_max_in_scope > m.read_max) parts.push(`نطاقه ${levelText(m.read_max_in_scope)}`);
    if (m.can_insert) parts.push(m.insert_own_scope_only ? "إدراج في نطاقه" : "إدراج");
    return parts.length ? parts.join("، ") : "—";
  };
  const myGrants = grants.filter((g) => g.profile_id === profile.id);

  return (
    <div className="space-y-6">
      {sp.saved && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم الحفظ.</div>}
      {sp.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>}

      <div className="card">
        <h2 className="font-bold">صلاحياتي</h2>
        <p className="mt-1 text-sm text-gray-600">
          دورك: {ROLE_LABELS_AR[profile.role]} — يُطبَّق عليه صف «{MATRIX_ROLE_LABELS[role] ?? role}» في مصفوفة الأدوار.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          تُدرج في:{" "}
          {(myCats ?? []).length === 0 ? (
            <span className="text-gray-400">لا شيء</span>
          ) : (
            <span dir="ltr" className="font-mono text-xs">
              {((myCats ?? []) as { code: string; own_scope_only: boolean }[])
                .map((c) => c.code + (c.own_scope_only ? "*" : ""))
                .join(" ")}
            </span>
          )}
          {(myCats ?? []).some((c: { own_scope_only: boolean }) => c.own_scope_only) && (
            <span className="block text-xs text-gray-400">* في نطاق مشاريعك فقط</span>
          )}
        </p>
        {myGrants.filter(isActive).length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
            {myGrants.filter(isActive).map((g) => (
              <li key={g.id}>
                {DESIGNATIONS[g.designation]}: {g.category_prefix ?? (g.document_id ? "مستند محدد" : "كل التصنيفات")} حتى S
                {g.max_sensitivity}
                {g.valid_until && ` — حتى ${g.valid_until.slice(0, 10)}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isEd && (
        <form action={createGrants} className="card grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-bold">منح تفويض مسمّى أو مؤقت</h2>
            <p className="mt-1 text-xs text-gray-500">
              مواد S3 لا تُفتح لأحد إلا بتفويض صريح مسجل. لا يمنح أحد نفسه تفويضاً، وكل تفويض وإلغاؤه يُسجَّل ولا يُحذف.
            </p>
          </div>
          <select name="profile_id" required className="input" defaultValue="">
            <option value="" disabled>الشخص</option>
            {((profiles ?? []) as { id: string; full_name: string; role: keyof typeof ROLE_LABELS_AR; is_active: boolean }[])
              .filter((p) => p.is_active && p.id !== profile.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} — {ROLE_LABELS_AR[p.role]}</option>
              ))}
          </select>
          <select name="designation" className="input" defaultValue="protection_coordinator">
            {Object.entries(DESIGNATIONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm sm:col-span-2">
            <input type="checkbox" name="use_preset" defaultChecked className="mt-1" />
            <span>
              استخدم الحزمة الجاهزة للصفة كما في المخطط:
              <span className="mt-1 block text-xs text-gray-500">
                {Object.entries(GRANT_PRESETS).map(([k, list]) => (
                  <span key={k} className="block">
                    {DESIGNATIONS[k]}: {list.map((g) => `${g.prefix} حتى S${g.max}${g.insert ? " + إدراج" : ""}`).join("، ")}
                  </span>
                ))}
              </span>
            </span>
          </label>
          <p className="text-xs font-semibold text-gray-500 sm:col-span-2">أو حدّد النطاق يدوياً (عند إلغاء الحزمة الجاهزة):</p>
          <select name="category_prefix" className="input" defaultValue="">
            <option value="">كل التصنيفات</option>
            {categories
              .filter((c) => c.level <= 2)
              .map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name_ar}</option>
              ))}
          </select>
          <input name="archive_number" className="input" dir="ltr" placeholder="أو رقم أرشفة مستند واحد" />
          <select name="max_sensitivity" className="input" defaultValue="3">
            {SENSITIVITY.map((s) => (
              <option key={s.level} value={s.level}>حتى {s.code} — {s.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="can_insert" /> يسمح بالإدراج أيضاً
          </label>
          <label className="text-xs text-gray-500">
            ينتهي في (اختياري — إلزامي عملياً للمدقق الخارجي)
            <input type="date" name="valid_until" className="input mt-1" />
          </label>
          <input name="reason" required className="input" placeholder="سبب التفويض (إلزامي)" />
          <button className="btn-primary sm:col-span-2 sm:justify-self-start">منح التفويض</button>
        </form>
      )}

      {(isEd || role === "archivist") && (
        <div className="card">
          <h2 className="mb-3 font-bold">التفويضات</h2>
          {grants.length === 0 ? (
            <p className="text-sm text-gray-400">لا تفويضات.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm">
              {grants.map((g) => (
                <li key={g.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${isActive(g) ? "" : "opacity-50"}`}>
                  <span className="font-semibold">{names.get(g.profile_id) ?? "—"}</span>
                  <span className="text-gray-600">{DESIGNATIONS[g.designation]}</span>
                  <span dir="ltr" className="font-mono text-xs">{g.category_prefix ?? (g.document_id ? "doc" : "*")}</span>
                  <span className="text-xs">حتى S{g.max_sensitivity}{g.can_insert ? " + إدراج" : ""}</span>
                  <span className="text-xs text-gray-400">
                    {g.reason} · منحه {names.get(g.granted_by) ?? "—"} {g.created_at.slice(0, 10)}
                    {g.valid_until && ` · ينتهي ${g.valid_until.slice(0, 10)}`}
                    {g.revoked_at && ` · أُلغي ${g.revoked_at.slice(0, 10)}`}
                  </span>
                  {isEd && isActive(g) && (
                    <form action={revokeGrant} className="mr-auto">
                      <input type="hidden" name="id" value={g.id} />
                      <button className="text-xs text-red-600 hover:underline">إلغاء</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="font-bold">مصفوفة الأدوار والمحاور (المطبَّقة فعلياً في قاعدة البيانات)</h2>
        <p className="mt-1 text-xs text-gray-500">
          «نطاقه» = مستندات مشاريعه وأنشطته (عضوية المشروع). مواد S3 مستثناة من كل خانة إلا ما يُسمّى صراحة أو بتفويض. يقرأ كل
          شخص ملفه الشخصي في 05، ويقرأ كل مُدخِل ما أدرجه. مسؤول قاعدة البيانات المؤسسية يرى البيانات الوصفية لكل المستندات (لإدارة التصنيف
          والروابط) دون فتح محتوى ما تُظهر الخانات أنه خارج صلاحيته.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-xs">
            <thead>
              <tr className="border-b border-black/5 text-right text-gray-500">
                <th className="p-2 font-medium">الدور</th>
                {axes.map((a) => (
                  <th key={a.code} className="p-2 font-medium">{a.letter}: {a.name_ar}</th>
                ))}
                <th className="p-2 font-medium">استثناءات بالتصنيف</th>
              </tr>
            </thead>
            <tbody>
              {matrixRoles.map((r) => (
                <tr key={r} className={`border-b border-black/5 align-top ${r === role ? "bg-brand-50/50" : ""}`}>
                  <td className="p-2 font-semibold">{MATRIX_ROLE_LABELS[r]}</td>
                  {axes.map((a) => (
                    <td key={a.code} className="p-2 text-gray-700">{cell(r, a.code)}</td>
                  ))}
                  <td className="p-2 text-gray-700">
                    {extraScopes(r).map((m) => (
                      <span key={m.scope_code} className="block">
                        <span dir="ltr" className="font-mono">{m.scope_code}</span>: {cell(r, m.scope_code)}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logAllowed && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">سجل الوصول (16.02)</h2>
            <form className="flex gap-2">
              <input name="doc" defaultValue={sp.doc ?? ""} className="input py-1.5" dir="ltr" placeholder="BSCA-…" />
              <button className="btn-secondary !py-1.5">تصفية</button>
            </form>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-gray-600">
            {log.length === 0 && <li className="text-gray-400">لا سجلات.</li>}
            {log.map((e) => (
              <li key={e.id}>
                {formatDateTime(e.created_at)} — {ACTION_AR[e.action]} —{" "}
                <Link href={`/archive/doc/${e.document_id}`} prefetch={false} dir="ltr" className="font-mono hover:underline">
                  {e.archive_number ?? e.document_id.slice(0, 8)}
                </Link>{" "}
                — {e.actor_id ? (names.get(e.actor_id) ?? e.actor_id.slice(0, 8)) : "زائر"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
