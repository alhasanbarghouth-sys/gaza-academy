"use client";

import { useState } from "react";
import type { Camp } from "@/types/database";

export default function CampPicker({ camps }: { camps: Camp[] }) {
  const [isNew, setIsNew] = useState(false);

  return (
    <div>
      <label className="label" htmlFor="camp_id">المخيم / الموقع</label>
      <select
        id="camp_id"
        name="camp_id"
        required
        className="input"
        defaultValue=""
        onChange={(e) => setIsNew(e.target.value === "__new__")}
      >
        <option value="" disabled>
          اختر المخيم...
        </option>
        {camps.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {!c.is_verified ? " (بانتظار التأكيد)" : ""}
          </option>
        ))}
        <option value="__new__">＋ مخيم غير موجود بالقائمة</option>
      </select>

      {isNew && (
        <input
          name="new_camp_name"
          required
          placeholder="اكتب اسم المخيم الجديد"
          className="input mt-2"
        />
      )}
    </div>
  );
}
