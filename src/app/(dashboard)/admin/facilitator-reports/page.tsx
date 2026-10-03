import Link from "next/link";
import { redirect } from "next/navigation";
import { format, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole, ROLE_LABELS_AR } from "@/lib/rbac";
import { BENEFICIARY_CATEGORIES, GBV_TYPE_LABELS, OTHER_PROJECT, PROJECTS, type SessionCounts } from "@/lib/activity";
import PeoplePicker, { type Person } from "@/components/PeoplePicker";
import type { UserRole } from "@/types/database";

type GbvReport = { violence_types: string[]; details: string | null };

type Row = SessionCounts & {
  id: string;
  activity_date: string;
  created_at: string;
  project_name: string;
  activity_type: string;
  description: string | null;
  challenges: string | null;
  total_beneficiaries: number;
  gbv_encountered: boolean;
  gbv_cases_count: number;
  gbv_referred: boolean;
  created_by: string;
  camps: { name: string } | null;
  creator: { full_name: string } | null;
  activity_gbv_reports: GbvReport | GbvReport[] | null;
  activity_session_participants: { profile_id: string; profiles: { full_name: string } | null }[];
};

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "Asia/Gaza";
const FIELD_ROLES: UserRole[] = ["facilitator", "volunteer"];
const EXCLUDED_ROLES: UserRole[] = ["donor", "auditor"];

// Offset of Gaza time on a given day ("+03:00" in summer, "+02:00" in winter).
function gazaOffset(day: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? "00"}` : "+02:00";
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

const gbvOf = (r: Row): GbvReport | null =>
  Array.isArray(r.activity_gbv_reports) ? (r.activity_gbv_reports[0] ?? null) : r.activity_gbv_reports;

export default async function FacilitatorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string | string[]; from?: string; to?: string; by?: string; p?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/dashboard");

  const selected = (Array.isArray(sp.f) ? sp.f : sp.f ? [sp.f] : []).filter((id) => UUID.test(id));
  const today = format(new Date(), "yyyy-MM-dd");
  const to = DATE.test(sp.to ?? "") ? sp.to! : today;
  const from = DATE.test(sp.from ?? "") ? sp.from! : format(subDays(new Date(), 30), "yyyy-MM-dd");
  const by: "submitted" | "activity" = sp.by === "activity" ? "activity" : "submitted";
  const project = sp.p === OTHER_PROJECT || (PROJECTS as readonly string[]).includes(sp.p ?? "") ? sp.p! : "";

  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .order("full_name");
  const people: Person[] = ((staff ?? []) as { id: string; full_name: string; role: UserRole }[])
    .filter((p) => !EXCLUDED_ROLES.includes(p.role))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      roleLabel: ROLE_LABELS_AR[p.role],
      group: FIELD_ROLES.includes(p.role) ? "الميسرون والمتطوعون" : "باقي الطاقم",
    }))
    .sort((a, b) =>
      a.group === b.group ? a.full_name.localeCompare(b.full_name, "ar") : a.group === "الميسرون والمتطوعون" ? -1 : 1
    );
  const nameOf = new Map(people.map((p) => [p.id, p.full_name]));

  let sessionIds: string[] | null = null;
  if (selected.length) {
    const { data } = await supabase.from("activity_session_participants").select("session_id").in("profile_id", selected);
    sessionIds = Array.from(new Set((data ?? []).map((r) => r.session_id as string)));
  }

  const BASE = "*, camps(name), creator:profiles!activity_sessions_created_by_fkey(full_name), activity_session_participants(profile_id, profiles(full_name))";
  const query = (select: string) => {
    let q = supabase.from("activity_sessions").select(select).limit(500);
    q =
      by === "activity"
        ? q.gte("activity_date", from).lte("activity_date", to).order("activity_date", { ascending: false })
        : q
            .gte("created_at", `${from}T00:00:00${gazaOffset(from)}`)
            .lte("created_at", `${to}T23:59:59.999${gazaOffset(to)}`)
            .order("created_at", { ascending: false });
    if (project === OTHER_PROJECT) q = q.not("project_name", "in", `(${PROJECTS.map((n) => `"${n}"`).join(",")})`);
    else if (project) q = q.eq("project_name", project);
    return sessionIds ? q.in("id", sessionIds) : q;
  };

  let rows: Row[] = [];
  if (sessionIds === null || sessionIds.length > 0) {
    let res = await query(`${BASE}, activity_gbv_reports(violence_types, details)`);
    // Until 0010 is run the GBV details table does not exist; still show the reports.
    if (res.error) res = await query(BASE);
    rows = (res.data ?? []) as unknown as Row[];
  }

  // Per-facilitator summary: an activity counts for every facilitator who took part in it.
  const summary = new Map<string, { activities: number; beneficiaries: number; gbv: number }>();
  for (const r of rows) {
    for (const p of r.activity_session_participants) {
      if (selected.length && !selected.includes(p.profile_id)) continue;
      const s = summary.get(p.profile_id) ?? { activities: 0, beneficiaries: 0, gbv: 0 };
      s.activities += 1;
      s.beneficiaries += r.total_beneficiaries;
      s.gbv += r.gbv_encountered ? r.gbv_cases_count : 0;
      summary.set(p.profile_id, s);
    }
  }
  const totalBeneficiaries = rows.reduce((s, r) => s + r.total_beneficiaries, 0);
  const gbvCases = rows.reduce((s, r) => s + (r.gbv_encountered ? r.gbv_cases_count : 0), 0);

  const now = new Date();
  const presets = [
    { label: "اليوم", from: today, to: today },
    { label: "آخر 7 أيام", from: format(subDays(now, 6), "yyyy-MM-dd"), to: today },
    { label: "هذا الشهر", from: format(startOfMonth(now), "yyyy-MM-dd"), to: today },
    {
      label: "الشهر الماضي",
      from: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
      to: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
    },
  ];
  const presetHref = (p: { from: string; to: string }) => {
    const qs = new URLSearchParams({ from: p.from, to: p.to, by });
    if (project) qs.set("p", project);
    selected.forEach((id) => qs.append("f", id));
    return `/admin/facilitator-reports?${qs}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تقارير الميسرين</h1>
        <p className="mt-1 text-sm text-gray-500">
          كل ما يُسجَّل في «سجل النشاط اليومي». اختر ميسراً أو أكثر (أو اتركها فارغة لعرض الجميع)، وحدّد الفترة.
        </p>
      </div>

      <form method="get" className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="label">الميسرون</p>
            <PeoplePicker people={people} name="f" initial={selected} placeholder="كل الميسرين" />
          </div>
          <div>
            <label className="label" htmlFor="p">المشروع</label>
            <select id="p" name="p" defaultValue={project} className="input">
              <option value="">كل المشاريع</option>
              {PROJECTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={OTHER_PROJECT}>مشاريع أخرى</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="by">التصفية حسب</label>
            <select id="by" name="by" defaultValue={by} className="input">
              <option value="submitted">تاريخ تقديم التقرير</option>
              <option value="activity">تاريخ تنفيذ النشاط</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="from">من</label>
            <input id="from" name="from" type="date" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">إلى</label>
            <input id="to" name="to" type="date" defaultValue={to} className="input" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary">عرض التقارير</button>
          <span className="mx-1 text-xs text-gray-400">فترات سريعة:</span>
          {presets.map((p) => (
            <Link key={p.label} href={presetHref(p)} className="btn-secondary !px-3 !py-1.5 text-xs">
              {p.label}
            </Link>
          ))}
        </div>
      </form>

      <div className="grid grid-cols-3 gap-4">
        <div className="card !p-4">
          <p className="text-xs text-gray-500">التقارير</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{rows.length}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500">المستفيدون</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{totalBeneficiaries}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500">حالات العنف المبني على النوع الاجتماعي</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">{gbvCases}</p>
        </div>
      </div>

      {summary.size > 0 && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-black/5 bg-gray-50 text-right text-xs text-gray-500">
                <th className="p-3 font-medium">الميسر</th>
                <th className="p-3 font-medium">عدد التقارير</th>
                <th className="p-3 font-medium">المستفيدون</th>
                <th className="p-3 font-medium">حالات العنف</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(summary)
                .sort((a, b) => b[1].activities - a[1].activities)
                .map(([id, s]) => (
                  <tr key={id} className="border-b border-black/5 last:border-0">
                    <td className="p-3 font-medium">{nameOf.get(id) ?? "—"}</td>
                    <td className="p-3">{s.activities}</td>
                    <td className="p-3">{s.beneficiaries}</td>
                    <td className="p-3">{s.gbv}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card text-sm text-gray-400">لا توجد تقارير في هذه الفترة.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const team = r.activity_session_participants.map((p) => p.profiles?.full_name).filter((n): n is string => !!n);
            const gbv = gbvOf(r);
            return (
              <details key={r.id} className="card !p-0">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <span className="font-bold">{r.project_name}</span>
                  <span className="text-xs text-gray-500">{r.activity_type}</span>
                  <span className="text-xs text-gray-500">{r.camps?.name ?? "—"}</span>
                  <span className="text-xs text-gray-500">الميسر: {r.creator?.full_name ?? "—"}</span>
                  <span className="text-xs text-gray-500">تاريخ النشاط: {r.activity_date}</span>
                  <span className="text-xs text-gray-400">أُرسل: {stamp(r.created_at)}</span>
                  <span className="mr-auto text-sm font-bold text-brand-700">{r.total_beneficiaries} مستفيد</span>
                  {r.gbv_encountered && (
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                      GBV: {r.gbv_cases_count}
                    </span>
                  )}
                </summary>
                <div className="space-y-4 border-t border-black/5 p-4 text-sm">
                  <p className="text-xs text-gray-500">فريق النشاط: {team.join("، ") || "—"}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BENEFICIARY_CATEGORIES.map((c) => (
                      <div key={c.column} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                        <p className="text-[11px] text-gray-500">{c.label}</p>
                        <p className="font-bold">{r[c.column] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  {r.total_beneficiaries > 0 && BENEFICIARY_CATEGORIES.every((c) => !r[c.column]) && (
                    <p className="text-xs text-gray-500">
                      سجل قديم قبل تقسيم الفئات: ذكور {r.beneficiaries_male} · إناث {r.beneficiaries_female} · أطفال{" "}
                      {r.beneficiaries_children} · بالغون {r.beneficiaries_adults}
                    </p>
                  )}
                  {r.gbv_encountered && (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3">
                      <p className="font-semibold text-red-900">العنف المبني على النوع الاجتماعي</p>
                      <p className="text-xs text-red-900">
                        عدد الحالات: {r.gbv_cases_count} · النوع:{" "}
                        {gbv?.violence_types?.length ? gbv.violence_types.map((t) => GBV_TYPE_LABELS[t] ?? t).join("، ") : "—"} ·{" "}
                        {r.gbv_referred ? "أُحيلت عبر مسار الإحالة" : "لم تُحَل بعد — تحتاج متابعة"}
                      </p>
                      {gbv?.details && <p className="whitespace-pre-wrap text-gray-800">{gbv.details}</p>}
                    </div>
                  )}
                  {r.description && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">وصف النشاط</p>
                      <p className="whitespace-pre-wrap">{r.description}</p>
                    </div>
                  )}
                  {r.challenges && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500">التحديات</p>
                      <p className="whitespace-pre-wrap">{r.challenges}</p>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
