"use client";

import { useState } from "react";
import { GBV_TYPES } from "@/lib/activity";

export default function GbvQuestion() {
  const [yes, setYes] = useState(false);

  return (
    <fieldset className="rounded-xl border border-black/10 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-800">العنف المبني على النوع الاجتماعي (GBV)</legend>
      <p className="text-sm text-gray-700">هل واجهتك حالات عنف مبني على النوع الاجتماعي ضمن المستفيدين في هذا النشاط؟</p>
      <div className="mt-2 flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="gbv_encountered" value="no" defaultChecked onChange={() => setYes(false)} /> لا
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="gbv_encountered" value="yes" onChange={() => setYes(true)} /> نعم
        </label>
      </div>

      {yes && (
        <div className="mt-4 space-y-4">
          <div className="max-w-xs">
            <label className="label" htmlFor="gbv_cases_count">عدد الحالات</label>
            <input id="gbv_cases_count" name="gbv_cases_count" type="number" min={1} defaultValue={1} required className="input" />
          </div>

          <div>
            <p className="label">نوع العنف (يمكن اختيار أكثر من نوع)</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {GBV_TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2">
                  <input type="checkbox" name="gbv_types" value={t.value} /> {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="gbv_details">تفاصيل الحالة</label>
            <textarea id="gbv_details" name="gbv_details" rows={4} required className="input" />
            <p className="mt-1 text-xs text-gray-500">
              تصل هذه التفاصيل إلى إدارة النظام فقط، ولا يراها زملاؤك في النشاط. يُفضَّل وصف ما حدث دون الاسم الكامل
              للناجي/الناجية.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="gbv_referred" /> أُحيلت الحالة عبر مسار الإحالة (منسق الحماية)
          </label>
        </div>
      )}
    </fieldset>
  );
}
