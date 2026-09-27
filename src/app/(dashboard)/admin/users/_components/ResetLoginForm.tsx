"use client";

import { useState } from "react";
import { resetLogin } from "../actions";

export default function ResetLoginForm({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
        تعديل الدخول
      </button>
    );
  }

  return (
    <form action={resetLogin} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <input name="phone" placeholder="رقم جوال جديد (اختياري)" className="input py-1 text-xs" dir="ltr" />
      <input name="password" placeholder="كلمة مرور جديدة (اختياري)" className="input py-1 text-xs" dir="ltr" />
      <button className="btn-primary text-xs">حفظ</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs">
        إلغاء
      </button>
    </form>
  );
}
