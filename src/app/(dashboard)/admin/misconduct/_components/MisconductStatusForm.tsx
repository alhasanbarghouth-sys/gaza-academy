"use client";

import { useState } from "react";
import { updateMisconductStatus } from "../actions";
import type { PublicSubmissionStatus } from "@/types/database";

const OPTIONS: { value: PublicSubmissionStatus; label: string }[] = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "investigating", label: "قيد التحقيق" },
  { value: "closed", label: "مغلق" },
];

export default function MisconductStatusForm({ id, reviewNote }: { id: string; reviewNote: string | null }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
        تحديث الحالة
      </button>
    );
  }

  return (
    <form action={updateMisconductStatus} className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
      <input type="hidden" name="id" value={id} />
      <select name="status" className="input text-xs" defaultValue="investigating">
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea name="review_note" rows={2} defaultValue={reviewNote ?? ""} placeholder="ملاحظة (سرية — للإدارة فقط)" className="input text-xs" />
      <button className="btn-primary text-xs">حفظ</button>
    </form>
  );
}
