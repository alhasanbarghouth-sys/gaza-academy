import { redirect } from "next/navigation";
import { format, subDays } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole } from "@/lib/rbac";
import { BENEFICIARY_CATEGORIES, type SessionCounts } from "@/lib/activity";
import FacilitatorFilter from "./_components/FacilitatorFilter";

type Row = SessionCounts & {
  id: string;
  activity_date: string;
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
  activity_session_participants: { profile_id: string; profiles: { full_name: string } | null }[];
};

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function FacilitatorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ facilitator?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/dashboard");

  const facilitator = UUID.test(sp.facilitator ?? "") ? sp.facilitator! : "";
  const to = DATE.test(sp.to ?? "") ? sp.to! : format(new Date(), "yyyy-MM-dd");
  const from = DATE.test(sp.from ?? "") ? sp.from! : format(subDays(new Date(), 30), "yyyy-MM-dd");

  const supabase = await createClient();

  const { data: people } = await supabase
    .from("activity_session_participants")
    .select("profile_id, profiles(full_name)");
  const byId = new Map<string, string>();
  for (const p of (people ?? []) as unknown as { profile_id: string; profiles: { full_name: string } | null }[]) {
    if (p.profiles?.full_name) byId.set(p.profile_id, p.profiles.full_name);
  }
  const facilitators = Array.from(byId, ([id, full_name]) => ({ id, full_name })).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "ar")
  );

  let sessionIds: string[] | null = null;
  if (facilitator) {
    const { data } = await supabase
      .from("activity_session_participants")
      .select("session_id")
      .eq("profile_id", facilitator);
    sessionIds = (data ?? []).map((r) => r.session_id as string);
  }

  let rows: Row[] = [];
  if (sessionIds === null || sessionIds.length > 0) {
    let q = supabase
      .from("activity_sessions")
      .select(
        "*, camps(name), creator:profiles!activity_sessions_created_by_fkey(full_name), activity_session_participants(profile_id, profiles(full_name))"
      )
      .gte("activity_date", from)
      .lte("activity_date", to)
      .order("activity_date", { ascending: false })
      .limit(300);
    if (sessionIds) q = q.in("id", sessionIds);
    const { data } = await q;
    rows = (data ?? []) as unknown as Row[];
  }

  const totalBeneficiaries = rows.reduce((s, r) => s + r.total_beneficiaries, 0);
  const gbvCases = rows.reduce((s, r) => s + (r.gbv_encountered ? r.gbv_cases_count : 0), 0);
  const selectedName = facilitator ? byId.get(facilitator) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تقارير الميسرين</h1>
        <p className="mt-1 text-sm text-gray-500">
          كل ما سجّله الميسرون في «سجل النشاط اليومي»، مع اسم كل ميسر. اختر ميسراً من القائمة لعرض تقاريره وحده.
        </p>
      </div>

      <FacilitatorFilter facilitators={facilitators} selected={facilitator} from={from} to={to} />

      <div className="grid grid-cols-3 gap-4">
        <div className="card !p-4">
          <p className="text-xs text-gray-500">الأنشطة</p>
          <p className="mt-1 text-2xl font-black text-brand-700">{rows.length}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500">المستفيدون</p>
          <p className="mt-1 text-2xl font-black text-brand-700">{totalBeneficiaries}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs text-gray-500">حالات العنف / الانتهاك المبلَّغ عنها</p>
          <p className="mt-1 text-2xl font-black text-brand-700">{gbvCases}</p>
        </div>
      </div>

      {selectedName && <h2 className="text-lg font-bold">تقارير: {selectedName}</h2>}

      {rows.length === 0 ? (
        <div className="card text-sm text-gray-400">لا توجد أنشطة مسجّلة في هذه الفترة.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const team = r.activity_session_participants
              .map((p) => p.profiles?.full_name)
              .filter((n): n is string => !!n);
            return (
              <details key={r.id} className="card !p-0">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <span className="text-sm font-semibold">{r.activity_date}</span>
                  <span className="font-bold">{r.project_name}</span>
                  <span className="text-xs text-gray-500">{r.activity_type}</span>
                  <span className="text-xs text-gray-500">{r.camps?.name ?? "—"}</span>
                  <span className="text-xs text-gray-500">أدخله: {r.creator?.full_name ?? "—"}</span>
                  <span className="mr-auto text-sm font-bold text-brand-700">{r.total_beneficiaries} مستفيد</span>
                  {r.gbv_encountered && (
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                      حالات عنف/انتهاك: {r.gbv_cases_count}
                    </span>
                  )}
                </summary>
                <div className="space-y-3 border-t border-black/5 p-4 text-sm">
                  <p className="text-xs text-gray-500">الفريق: {team.join("، ") || "—"}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {BENEFICIARY_CATEGORIES.map((c) => (
                      <div key={c.column} className="rounded-lg bg-gray-50 px-3 py-2 text-center">
                        <p className="text-[11px] text-gray-500">{c.label}</p>
                        <p className="font-bold">{r[c.column] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                  {r.total_beneficiaries > 0 &&
                    BENEFICIARY_CATEGORIES.every((c) => !r[c.column]) && (
                      <p className="text-xs text-gray-500">
                        سجل قديم قبل تقسيم الفئات: ذكور {r.beneficiaries_male} · إناث {r.beneficiaries_female} · أطفال{" "}
                        {r.beneficiaries_children} · بالغون {r.beneficiaries_adults}
                      </p>
                    )}
                  {r.gbv_encountered && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                      واجه الميسر {r.gbv_cases_count} حالة عنف مبني على النوع الاجتماعي / استغلال أو انتهاك جنسي —{" "}
                      {r.gbv_referred ? "أُحيلت عبر مسار الإحالة" : "لم تُحَل بعد، تحتاج متابعة"}.
                    </p>
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
