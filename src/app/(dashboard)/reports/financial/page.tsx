import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadFinancialReport } from "./actions";
import { redirect } from "next/navigation";

export default async function FinancialReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await requireProfile();

  if (!["system_admin", "executive_director", "accountant", "donor", "project_manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const canUpload = ["system_admin", "accountant"].includes(profile.role);
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("financial_reports")
    .select("*")
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    (reports ?? []).map(async (r) => {
      if (!r.file_url) return { ...r, signedUrl: null as string | null };
      const { data } = await supabase.storage.from("org-files").createSignedUrl(r.file_url, 3600);
      return { ...r, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">التقارير المالية</h1>
        <p className="mt-1 text-sm text-gray-500">تقارير يرفعها المحاسب — إيرادات، مصروفات، وموازنات المشاريع.</p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم رفع التقرير بنجاح.</div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {canUpload && (
        <form action={uploadFinancialReport} className="card space-y-5" encType="multipart/form-data">
          <h2 className="text-lg font-bold">رفع تقرير مالي جديد</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="title">العنوان</label>
              <input id="title" name="title" required className="input" placeholder="مثال: تقرير مصروفات أيلول" />
            </div>
            <div>
              <label className="label" htmlFor="period">الفترة</label>
              <input id="period" name="period" required className="input" placeholder="مثال: 2026-09" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="amount">المبلغ</label>
              <input id="amount" name="amount" type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="currency">العملة</label>
              <select id="currency" name="currency" className="input" defaultValue="USD">
                <option value="USD">دولار أمريكي (USD)</option>
                <option value="ILS">شيكل (ILS)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">ملاحظات</label>
            <textarea id="notes" name="notes" rows={2} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="file">ملف التقرير (PDF / Excel)</label>
            <input id="file" name="file" type="file" className="input" accept=".pdf,.xlsx,.xls,.csv" />
          </div>
          <button type="submit" className="btn-primary">رفع التقرير</button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">التقارير المرفوعة</h2>
        {withUrls.length > 0 ? (
          withUrls.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{r.title}</p>
                <p className="text-xs text-gray-500">
                  الفترة {r.period} {r.amount != null && `· ${r.amount} ${r.currency}`}
                </p>
                {r.notes && <p className="mt-1 text-sm text-gray-600">{r.notes}</p>}
              </div>
              {r.signedUrl && (
                <a href={r.signedUrl} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                  تحميل الملف
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">لا توجد تقارير مالية بعد.</p>
        )}
      </section>
    </div>
  );
}
