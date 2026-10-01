"use client";

import { useState } from "react";
import { updateAppealStatus } from "../actions";
import type { PublicSubmissionStatus } from "@/types/database";

const OPTIONS: { value: PublicSubmissionStatus; label: string }[] = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "in_review", label: "قيد المراجعة" },
  { value: "resolved", label: "تم التعامل معها" },
];

export default function AppealStatusForm({ id, reviewNote }: { id: string; reviewNote: string | null }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
        تحديث الحالة
      </button>
    );
  }

  return (
    <form action={updateAppealStatus} className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
      <input type="hidden" name="id" value={id} />
      <select name="status" className="input text-xs" defaultValue="in_review">
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <textarea name="review_note" rows={2} defaultValue={reviewNote ?? ""} placeholder="ملاحظة (اختياري)" className="input text-xs" />
      <button className="btn-primary text-xs">حفظ</button>
    </form>
  );
}
