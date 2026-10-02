"use client";

import { useState } from "react";

export default function GbvQuestion() {
  const [yes, setYes] = useState(false);

  return (
    <div className="rounded-xl border border-black/10 p-4">
      <p className="label">
        هل واجهتك حالات عنف مبني على النوع الاجتماعي أو استغلال/انتهاك جنسي ضمن المستفيدين في هذا النشاط؟
      </p>
      <div className="mt-2 flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="gbv_encountered" value="no" defaultChecked onChange={() => setYes(false)} /> لا
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="gbv_encountered" value="yes" onChange={() => setYes(true)} /> نعم
        </label>
      </div>
      {yes && (
        <div className="mt-4 space-y-3">
          <div className="max-w-xs">
            <label className="mb-1 block text-xs text-gray-500" htmlFor="gbv_cases_count">عدد الحالات</label>
            <input id="gbv_cases_count" name="gbv_cases_count" type="number" min={1} defaultValue={1} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="gbv_referred" /> أُحيلت الحالات عبر مسار الإحالة (منسق الحماية)
          </label>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            أدخل الأعداد فقط. لا تكتب أسماء أو أي معلومات تُعرّف بالناجين/الناجيات هنا أو في وصف النشاط — تُبلَّغ تفاصيل
            الحالة مباشرة لمنسق الحماية وفق بروتوكول الإحالة.
          </p>
        </div>
      )}
    </div>
  );
}
