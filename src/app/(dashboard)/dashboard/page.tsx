import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole, REQUEST_STATUS_LABELS_AR, ROLE_LABELS_AR } from "@/lib/rbac";
import { format, startOfMonth } from "date-fns";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-700">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const isManagement = isManagementRole(profile.role);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthStartStr = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [pendingRequests, myRequests, activitiesToday, activitiesThisMonth, recentActivities] =
    await Promise.all([
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("requester_id", profile.id),
      supabase
        .from("daily_activities")
        .select("id, total_beneficiaries", { count: "exact" })
        .eq("activity_date", todayStr),
      supabase
        .from("daily_activities")
        .select("total_beneficiaries")
        .gte("activity_date", monthStartStr),
      supabase
        .from("daily_activities")
        .select("id, project_name, activity_type, location, total_beneficiaries, activity_date, facilitator_id, profiles:facilitator_id(full_name)")
        .order("activity_date", { ascending: false })
        .limit(8),
    ]);

  const monthBeneficiaries = (activitiesThisMonth.data ?? []).reduce(
    (sum, a) => sum + (a.total_beneficiaries ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          أهلاً {profile.full_name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {ROLE_LABELS_AR[profile.role]} · {format(new Date(), "EEEE d MMMM yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="طلبات قيد الانتظار" value={pendingRequests.count ?? 0} hint="بحاجة لمتابعة" />
        <StatCard label="طلباتي" value={myRequests.count ?? 0} />
        <StatCard label="أنشطة اليوم" value={activitiesToday.count ?? 0} />
        <StatCard label="مستفيدون هذا الشهر" value={monthBeneficiaries} hint={`منذ ${monthStartStr}`} />
      </div>

      {isManagement && (
        <div className="card">
          <h2 className="mb-4 text-lg font-bold">آخر الأنشطة الميدانية</h2>
          {recentActivities.data && recentActivities.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-right text-gray-500">
                    <th className="pb-2 font-medium">الميسر</th>
                    <th className="pb-2 font-medium">المشروع</th>
                    <th className="pb-2 font-medium">النوع</th>
                    <th className="pb-2 font-medium">الموقع</th>
                    <th className="pb-2 font-medium">المستفيدون</th>
                    <th className="pb-2 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.data.map((a) => (
                    <tr key={a.id} className="border-b border-black/5 last:border-0">
                      <td className="py-2.5">{(a as any).profiles?.full_name ?? "—"}</td>
                      <td className="py-2.5">{a.project_name}</td>
                      <td className="py-2.5">{a.activity_type}</td>
                      <td className="py-2.5">{a.location}</td>
                      <td className="py-2.5">{a.total_beneficiaries}</td>
                      <td className="py-2.5 text-gray-500">{a.activity_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">لا توجد أنشطة مسجّلة بعد.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <a href="/requests/new" className="card block transition hover:shadow-md">
          <p className="text-lg font-bold">📨 إنشاء طلب جديد</p>
          <p className="mt-1 text-sm text-gray-500">أرسل طلبًا ماليًا أو لوجستيًا أو إداريًا للإدارة.</p>
        </a>
        <a href="/ai" className="card block transition hover:shadow-md">
          <p className="text-lg font-bold">🤖 اسأل المساعد الذكي</p>
          <p className="mt-1 text-sm text-gray-500">استفسر عن أي بيانات أو تقرير موجود في النظام.</p>
        </a>
      </div>

      <p className="text-xs text-gray-400">حالات الطلبات المتاحة: {Object.values(REQUEST_STATUS_LABELS_AR).join(" · ")}</p>
    </div>
  );
}
