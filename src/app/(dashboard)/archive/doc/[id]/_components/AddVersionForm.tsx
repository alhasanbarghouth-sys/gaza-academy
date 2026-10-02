"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RECORD_STATUS_AR } from "@/lib/archive/constants";
import { uploadToArchive } from "../../../_components/upload";
import { addVersion } from "../../../actions";

export default function AddVersionForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("modified_copy");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setBusy("جارٍ الرفع…");
    const up = await uploadToArchive(file, documentId);
    if ("error" in up) {
      setBusy(null);
      return setError(up.error);
    }
    setBusy("جارٍ التسجيل…");
    const res = await addVersion({
      document_id: documentId,
      storage_path: up.path,
      file_name: file.name,
      mime_type: file.type,
      change_reason: reason,
      record_status: status,
    });
    setBusy(null);
    if ("error" in res && res.error) return setError(res.error);
    setFile(null);
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input" required />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="input"
        required
        placeholder="سبب التعديل (إلزامي)"
      />
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
        {Object.entries(RECORD_STATUS_AR).map(([k, v]) => (
          <option key={k} value={k}>الحالة بعد الإصدار: {v}</option>
        ))}
      </select>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-secondary w-full" disabled={!!busy}>
        {busy ?? "إضافة إصدار جديد"}
      </button>
      <p className="text-[11px] leading-relaxed text-gray-400">
        الإصدار السابق يبقى محفوظاً كما هو ببصمته، ولا يُحذف ولا يُستبدل.
      </p>
    </form>
  );
}
