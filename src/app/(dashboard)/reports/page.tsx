import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { generate5WReport, generateOchaWeeklyReport } from "./actions";
import ReportView from "./_components/ReportView";
import { format } from "date-fns";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const profile = await requireProfile();
  if (!["system_admin", "executive_director", "project_manager", "coordinator", "donor"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const canGenerate = ["system_admin", "executive_director", "project_manager", "coordinator"].includes(
    profile.role
  );

  const [latest5w, latestOcha, history5w, historyOcha] = await Promise.all([
    supabase.from("reports_5w").select("*").order("report_month", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("reports_ocha_weekly")
      .select("*")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("reports_5w").select("id, report_month").order("report_month", { ascending: false }).limit(12),
    supabase
      .from("reports_ocha_weekly")
      .select("id, week_start, week_end")
      .order("week_start", { ascending: false })
      .limit(12),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="mt-1 text-sm text-gray-500">
          تقرير 5W الشهري (بصيغة اليونيسف) وتقرير أوتشا الأسبوعي — يتم توليدهما تلقائيًا من سجل الأنشطة اليومية.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">تقرير 5W الشهري (اليونيسف)</h2>
          {canGenerate && (
            <form action={generate5WReport} className="flex items-center gap-2">
              <input type="month" name="month" defaultValue={format(new Date(), "yyyy-MM")} className="input" />
              <button type="submit" className="btn-primary">توليد التقرير</button>
            </form>
          )}
        </div>
        {latest5w.data ? (
          <ReportView title={`تقرير 5W — ${latest5w.data.report_month}`} data={latest5w.data.data as any} />
        ) : (
          <p className="card text-sm text-gray-400">لا يوجد تقرير 5W بعد. اختر الشهر واضغط توليد.</p>
        )}
        {history5w.data && history5w.data.length > 1 && (
          <p className="text-xs text-gray-400">
            تقارير سابقة: {history5w.data.map((r) => r.report_month).join(" · ")}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">تقرير أوتشا الأسبوعي</h2>
          {canGenerate && (
            <form action={generateOchaWeeklyReport} className="flex items-center gap-2">
              <input type="date" name="week_start" defaultValue={format(new Date(), "yyyy-MM-dd")} className="input" />
              <button type="submit" className="btn-primary">توليد التقرير</button>
            </form>
          )}
        </div>
        {latestOcha.data ? (
          <ReportView
            title={`تقرير أوتشا — ${latestOcha.data.week_start} إلى ${latestOcha.data.week_end}`}
            data={latestOcha.data.data as any}
          />
        ) : (
          <p className="card text-sm text-gray-400">لا يوجد تقرير أوتشا بعد. اختر أي يوم ضمن الأسبوع واضغط توليد.</p>
        )}
        {historyOcha.data && historyOcha.data.length > 1 && (
          <p className="text-xs text-gray-400">
            تقارير سابقة: {historyOcha.data.map((r) => r.week_start).join(" · ")}
          </p>
        )}
      </section>
    </div>
  );
}
