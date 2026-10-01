import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import MisconductStatusForm from "./_components/MisconductStatusForm";

const STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  investigating: "قيد التحقيق",
  closed: "مغلق",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  investigating: "bg-blue-100 text-blue-800",
  closed: "bg-gray-200 text-gray-700",
};

export default async function AdminMisconductPage() {
  const profile = await requireProfile();
  if (!["system_admin", "executive_director"].includes(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("misconduct_reports")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">بلاغات الإساءة</h1>
        <p className="mt-1 text-sm text-gray-500">
          سرّي — هذه الصفحة مقصورة على المدير التنفيذي ومسؤول النظام فقط. البلاغات قد تكون مجهولة المصدر.
        </p>
      </div>

      <div className="space-y-3">
        {reports && reports.length > 0 ? (
          reports.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">
                    {r.accused_name ? `بخصوص: ${r.accused_name}` : "بلاغ (دون تحديد اسم)"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {r.incident_location && <span>{r.incident_location} · </span>}
                    {new Date(r.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
                <span className={`badge ${STATUS_STYLES[r.status]}`}>{STATUS_LABELS_AR[r.status] ?? r.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{r.incident_description}</p>
              <p className="mt-3 text-xs text-gray-500">
                المُبلِّغ: {r.reporter_name || "مجهول"}
                {r.reporter_contact && <span dir="ltr"> — {r.reporter_contact}</span>}
              </p>
              {r.review_note && (
                <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                  <span className="font-semibold">ملاحظة:</span> {r.review_note}
                </p>
              )}
              <MisconductStatusForm id={r.id} reviewNote={r.review_note} />
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">لا توجد بلاغات.</p>
        )}
      </div>
    </div>
  );
}
