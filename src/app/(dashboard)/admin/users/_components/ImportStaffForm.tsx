"use client";

import { useState } from "react";
import type { ImportResult } from "../actions";

export default function ImportStaffForm() {
  const [rows, setRows] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rows.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("rows", rows);
      const res = await fetch("/api/admin/import-staff", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ");
        return;
      }
      setResult(data as ImportResult);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-bold">إضافة مجموعة موظفين دفعة واحدة</h2>
        <p className="mt-1 text-sm text-gray-500">
          الصق سطرًا لكل شخص: الاسم، رقم الجوال، رقم الهوية، الدور، الوظيفة (اختياري). يمكن فصل الخانات بـ Tab (نسخ من
          Excel/Word) أو فاصلة. الدور بالعربي مثل: الميسر، منسق، المحاسب، مدير المشاريع، المدير التنفيذي.
        </p>
      </div>
      <textarea
        value={rows}
        onChange={(e) => setRows(e.target.value)}
        required
        rows={8}
        dir="rtl"
        className="input font-mono text-xs"
        placeholder={"أحمد محمد\t0599000000\t400000000\tالميسر\tمدرب دراما"}
      />
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "جارٍ إنشاء الحسابات..." : "إنشاء الحسابات"}
      </button>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

      {result && (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 font-medium text-emerald-700">
            أُنشئ {result.created.length} حساب{result.created.length ? `: ${result.created.join("، ")}` : ""}
          </p>
          {result.skipped.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800">
              <p className="mb-1 font-medium">لم يُنشأ ({result.skipped.length}):</p>
              <ul className="list-inside list-disc space-y-0.5">
                {result.skipped.map((s, i) => (
                  <li key={i}>
                    {s.line} — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
