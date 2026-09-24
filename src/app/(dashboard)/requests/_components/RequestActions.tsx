"use client";

import { useState } from "react";
import { respondToRequest } from "../actions";

export default function RequestActions({ id }: { id: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
          الرد على الطلب
        </button>
      ) : (
        <form action={respondToRequest} className="space-y-2 rounded-xl bg-gray-50 p-3">
          <input type="hidden" name="id" value={id} />
          <textarea
            name="response_note"
            rows={2}
            placeholder="ملاحظة (اختياري)"
            className="input text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <button name="status" value="approved" className="btn-primary text-xs !bg-emerald-600 hover:!bg-emerald-700">
              موافقة
            </button>
            <button name="status" value="rejected" className="btn-primary text-xs !bg-red-600 hover:!bg-red-700">
              رفض
            </button>
            <button name="status" value="in_review" className="btn-secondary text-xs">
              قيد المراجعة
            </button>
            <button name="status" value="completed" className="btn-secondary text-xs">
              إنهاء كمكتمل
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
