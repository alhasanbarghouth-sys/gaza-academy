import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/rbac";
import { createDailyActivity } from "./actions";
import { format } from "date-fns";

export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: myActivities } = await supabase
    .from("daily_activities")
    .select("*")
    .eq("facilitator_id", profile.id)
    .order("activity_date", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">سجل النشاط اليومي</h1>
        <p className="mt-1 text-sm text-gray-500">
          سجّل نشاطك الميداني يوميًا — يُستخدم تلقائيًا في تقرير 5W الشهري وتقرير أوتشا الأسبوعي.
        </p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم حفظ النشاط بنجاح.
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <form action={createDailyActivity} className="card space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="activity_date">التاريخ</label>
            <input
              id="activity_date"
              name="activity_date"
              type="date"
              required
              defaultValue={format(new Date(), "yyyy-MM-dd")}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="activity_type">نوع النشاط</label>
            <select id="activity_type" name="activity_type" required className="input">
              {ACTIVITY_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="project_name">اسم المشروع / البرنامج</label>
            <input id="project_name" name="project_name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="location">الموقع</label>
            <input id="location" name="location" required className="input" placeholder="مثال: مركز بسمة - خانيونس" />
          </div>
        </div>

        <div>
          <p className="label">عدد المستفيدين</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="beneficiaries_male">ذكور</label>
              <input id="beneficiaries_male" name="beneficiaries_male" type="number" min={0} defaultValue={0} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="beneficiaries_female">إناث</label>
              <input id="beneficiaries_female" name="beneficiaries_female" type="number" min={0} defaultValue={0} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="beneficiaries_children">أطفال</label>
              <input id="beneficiaries_children" name="beneficiaries_children" type="number" min={0} defaultValue={0} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500" htmlFor="beneficiaries_adults">بالغون</label>
              <input id="beneficiaries_adults" name="beneficiaries_adults" type="number" min={0} defaultValue={0} className="input" />
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">وصف النشاط</label>
          <textarea id="description" name="description" rows={3} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="challenges">تحديات واجهتها (اختياري)</label>
          <textarea id="challenges" name="challenges" rows={2} className="input" />
        </div>

        <button type="submit" className="btn-primary">حفظ النشاط</button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-bold">أنشطتي الأخيرة</h2>
        {myActivities && myActivities.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-gray-50 text-right text-gray-500">
                  <th className="p-3 font-medium">التاريخ</th>
                  <th className="p-3 font-medium">المشروع</th>
                  <th className="p-3 font-medium">النوع</th>
                  <th className="p-3 font-medium">الموقع</th>
                  <th className="p-3 font-medium">المستفيدون</th>
                </tr>
              </thead>
              <tbody>
                {myActivities.map((a) => (
                  <tr key={a.id} className="border-b border-black/5 last:border-0">
                    <td className="p-3">{a.activity_date}</td>
                    <td className="p-3">{a.project_name}</td>
                    <td className="p-3">{a.activity_type}</td>
                    <td className="p-3">{a.location}</td>
                    <td className="p-3">{a.total_beneficiaries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">لا توجد أنشطة مسجّلة بعد.</p>
        )}
      </section>
    </div>
  );
}
