import Link from "next/link";
import { format } from "date-fns";
import { CPAOR, DEFAULT_INDICATOR } from "@/lib/fivew/data";

const STATUS_AR: Record<string, string> = {
  Ongoing: "مستمر (Ongoing)",
  Completed: "مكتمل (Completed)",
};

export default function FiveWExport({
  focalName,
  focalMobile,
  unlinkedCamps,
}: {
  focalName: string;
  focalMobile: string;
  unlinkedCamps: number;
}) {
  return (
    <form action="/api/reports/5w-excel" method="post" className="card space-y-5">
      <div>
        <h3 className="text-lg font-bold">تصدير ملف 5Ws (Excel) بقالب قطاع حماية الطفل</h3>
        <p className="mt-1 text-sm text-gray-500">
          يُعبَّأ القالب الرسمي (CP AoR 5Ws Tracker) تلقائياً من سجل النشاط اليومي: صف لكل مخيم ونوع نشاط في الشهر، مع
          المحافظة واسم الموقع الرسمي والمنطقة والإحداثيات وأعداد الفئات الثماني والتواريخ. يحافظ الملف على القوائم المنسدلة
          والمعادلات كما هي.
        </p>
        {unlinkedCamps > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {unlinkedCamps} مخيماً مستخدماً في الأنشطة غير مربوط بالقائمة الرسمية؛ سيُكتب اسمه في عمود «Only if not listed»
            وتبقى خانات المحافظة والموقع فارغة.{" "}
            <Link href="/admin/camps" className="font-semibold underline">اربطها من إدارة المخيمات</Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="x_month">الشهر</label>
          <input id="x_month" name="month" type="month" required defaultValue={format(new Date(), "yyyy-MM")} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="x_status">حالة النشاط (Status)</label>
          <select id="x_status" name="status" defaultValue="Completed" className="input">
            {CPAOR.status.map((s) => (
              <option key={s} value={s}>{STATUS_AR[s] ?? s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="x_fn">مسؤول التواصل (Focal Person)</label>
          <input id="x_fn" name="focal_name" defaultValue={focalName} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="x_fe">البريد</label>
            <input id="x_fe" name="focal_email" type="email" className="input" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="x_fm">الجوال</label>
            <input id="x_fm" name="focal_mobile" defaultValue={focalMobile} className="input" dir="ltr" />
          </div>
        </div>
      </div>

      <div>
        <p className="label">مؤشر القطاع لكل نوع نشاط (Response Pillar / CP AoR Indicator)</p>
        <div className="divide-y divide-black/5 rounded-xl border border-black/5">
          {Object.entries(DEFAULT_INDICATOR).map(([type, def]) => (
            <div key={type} className="grid gap-2 p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
              <span className="text-sm font-medium">{type}</span>
              <select name={`ind:${type}`} defaultValue={def ? `${def.pillar}:${def.indicator}` : ""} className="input py-2 text-xs" dir="ltr">
                <option value="">— leave blank (fill in Excel) —</option>
                {CPAOR.pillars.map((p, pi) => (
                  <optgroup key={pi} label={p.label}>
                    {p.indicators.map((ind, ii) => (
                      <option key={ii} value={`${pi}:${ii}`}>{ind}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary">تنزيل ملف 5Ws (.xlsm)</button>
    </form>
  );
}
