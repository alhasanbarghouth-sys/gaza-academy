import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isManagementRole } from "@/lib/rbac";
import { addCamp, verifyCamp, deleteCamp } from "./actions";

export default async function CampsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: camps } = await supabase.from("camps").select("*").order("is_verified").order("name");

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

      <form action={addCamp} className="card grid gap-4 sm:grid-cols-5">
        <input name="name" required placeholder="اسم المخيم" className="input sm:col-span-2" />
        <input name="latitude" type="number" step="any" placeholder="خط العرض (Latitude)" className="input" dir="ltr" />
        <input name="longitude" type="number" step="any" placeholder="خط الطول (Longitude)" className="input" dir="ltr" />
        <button type="submit" className="btn-primary">إضافة مخيم</button>
        <input name="notes" placeholder="ملاحظات (اختياري)" className="input sm:col-span-5" />
      </form>

      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-gray-50 text-right text-gray-500">
              <th className="p-3 font-medium">الاسم</th>
              <th className="p-3 font-medium">الإحداثيات</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(camps ?? []).map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-xs text-gray-500" dir="ltr">
                  {c.latitude != null && c.longitude != null ? `${c.latitude}, ${c.longitude}` : "—"}
                </td>
                <td className="p-3">
                  <span className={`badge ${c.is_verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {c.is_verified ? "مؤكد" : "بانتظار التأكيد"}
                  </span>
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
