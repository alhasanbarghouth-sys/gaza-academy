import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole } from "@/lib/rbac";
import AppealStatusForm from "./_components/AppealStatusForm";

const STATUS_LABELS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  in_review: "قيد المراجعة",
  resolved: "تم التعامل معها",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
};

export default async function AdminAppealsPage() {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: appeals } = await supabase
    .from("public_appeals")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">المناشدات الواردة من الموقع العام</h1>
        <p className="mt-1 text-sm text-gray-500">مناشدات أرسلها أفراد من الجمهور عبر الموقع العام دون تسجيل دخول.</p>
      </div>

      <div className="space-y-3">
        {appeals && appeals.length > 0 ? (
          appeals.map((a) => (
            <div key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{a.full_name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.phone && <span dir="ltr">{a.phone} · </span>}
                    {a.location && <span>{a.location} · </span>}
                    {new Date(a.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
                <span className={`badge ${STATUS_STYLES[a.status]}`}>{STATUS_LABELS_AR[a.status] ?? a.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{a.message}</p>
              {a.review_note && (
                <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                  <span className="font-semibold">ملاحظة الإدارة:</span> {a.review_note}
                </p>
              )}
              <AppealStatusForm id={a.id} reviewNote={a.review_note} />
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">لا توجد مناشدات بعد.</p>
        )}
      </div>
    </div>
  );
}
