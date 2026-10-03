import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole } from "@/lib/rbac";
import { addCamp, verifyCamp, deleteCamp, linkCampSite } from "./actions";
import SiteLinker from "./_components/SiteLinker";
import { CPAOR, GOVERNORATE_AR, SITE_TYPE_AR, guessCommunity, suggestSites } from "@/lib/fivew/data";

export default async function CampsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; linked?: string }>;
}) {
  const { error, saved, linked } = await searchParams;
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: camps } = await supabase.from("camps").select("*").order("is_verified").order("name");
  const linkedCount = (camps ?? []).filter((c) => c.cccm_site).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">إدارة المخيمات</h1>
        <p className="mt-1 text-sm text-gray-500">
          القائمة الرسمية بالمخيمات وإحداثياتها — تظهر في القائمة المنسدلة عند تسجيل النشاط اليومي. المخيمات
          التي أضافها الطاقم من الميدان تظهر هنا "بانتظار التأكيد" حتى يراجعها المسؤول.
        </p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تمت إضافة المخيم.</div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {linked && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم ربط المخيم بالموقع الرسمي.</div>
      )}

      <div className="card text-sm text-gray-600">
        <p className="font-semibold text-gray-900">الربط بالقائمة الرسمية لمواقع الإيواء (لملف 5Ws)</p>
        <p className="mt-1">
          ملف 5Ws الخاص بقطاع حماية الطفل يقبل أسماء المواقع كما في قائمته الرسمية فقط. اربط كل مخيم مرة واحدة بموقعه
          الرسمي — يقترح النظام الأقرب تلقائياً — فتُعبّأ المحافظة ونوع الموقع واسمه والمنطقة في الملف دون تدخل.
        </p>
        <p className="mt-2 font-semibold text-gray-900">
          {linkedCount} من {(camps ?? []).length} مخيماً مربوطة
        </p>
      </div>

      <form action={addCamp} className="card grid gap-4 sm:grid-cols-5">
        <input name="name" required placeholder="اسم المخيم" className="input sm:col-span-2" />
        <input name="latitude" type="number" step="any" placeholder="خط العرض (Latitude)" className="input" dir="ltr" />
        <input name="longitude" type="number" step="any" placeholder="خط الطول (Longitude)" className="input" dir="ltr" />
        <button type="submit" className="btn-primary">إضافة مخيم</button>
        <input name="notes" placeholder="ملاحظات (اختياري)" className="input sm:col-span-5" />
      </form>

      <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-gray-50 text-right text-gray-500">
              <th className="p-3 font-medium">الاسم</th>
              <th className="p-3 font-medium">الإحداثيات</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium">الموقع الرسمي (5Ws)</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(camps ?? []).map((c) => (
              <tr key={c.id} id={`camp-${c.id}`} className="border-b border-black/5 align-top last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-xs text-gray-500" dir="ltr">
                  {c.latitude != null && c.longitude != null ? `${c.latitude}, ${c.longitude}` : "—"}
                </td>
                <td className="p-3">
                  <span className={`badge ${c.is_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {c.is_verified ? "مؤكد" : "بانتظار التأكيد"}
                  </span>
                </td>
                <td className="w-[22rem] p-3">
                  {c.cccm_site ? (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-gray-900">{c.cccm_site}</p>
                      <p className="text-gray-500">
                        {GOVERNORATE_AR[c.cccm_governorate] ?? c.cccm_governorate} · {SITE_TYPE_AR[c.cccm_site_type] ?? c.cccm_site_type}
                        {c.cccm_community ? ` · ${c.cccm_community}` : " · المنطقة غير محددة"}
                      </p>
                      <form action={linkCampSite}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="unlink" value="1" />
                        <button className="text-gray-400 hover:text-red-600">إلغاء الربط</button>
                      </form>
                    </div>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-amber-700">غير مربوط — ربط الآن</summary>
                      <div className="mt-2">
                        <SiteLinker
                          campId={c.id}
                          suggestions={suggestSites(c.name, 3).map((x) => ({
                            gov: x.gov,
                            type: x.type,
                            value: x.value,
                            nb: x.nb,
                            guess: guessCommunity(x),
                          }))}
                          communities={CPAOR.communities}
                          govLabels={GOVERNORATE_AR}
                          typeLabels={SITE_TYPE_AR}
                        />
                      </div>
                    </details>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {!c.is_verified && (
                      <form action={verifyCamp}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-secondary text-xs">تأكيد</button>
                      </form>
                    )}
                    <form action={deleteCamp}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-secondary text-xs text-red-600">حذف</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
