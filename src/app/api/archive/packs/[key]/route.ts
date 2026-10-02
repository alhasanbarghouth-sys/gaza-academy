import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { loadPack, packAccess } from "@/lib/archive/packs";
import { RECORD_STATUS_AR } from "@/lib/archive/constants";

function csvCell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Exports the pack's index (number, title, category, date, sensitivity, fingerprint);
// every listed document is recorded in the access log as exported.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const profile = await requireProfile();
  if (!(await packAccess(profile))(key)) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const loaded = await loadPack(key);
  if (!loaded) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const docs = loaded.items.flatMap((i) => i.docs);
  const supabase = await createClient();
  const ids = docs.map((d) => d.id);
  const { data: versions } = ids.length
    ? await supabase.from("archive_document_versions").select("document_id, version_no, sha256").in("document_id", ids)
    : { data: [] };
  const hash = new Map<string, string>();
  for (const v of (versions ?? []) as { document_id: string; version_no: number; sha256: string }[]) {
    const d = docs.find((x) => x.id === v.document_id);
    if (d && d.current_version === v.version_no) hash.set(v.document_id, v.sha256);
  }
  if (ids.length) await supabase.rpc("archive_log_export", { p_document_ids: ids });

  const header = ["رقم الأرشفة", "العنوان", "التصنيف", "تاريخ المستند", "الحساسية", "الحالة", "الإصدار", "الروابط", "SHA-256"];
  const rows = docs.map((d) => [
    d.archive_number,
    d.title,
    d.category_code,
    d.document_date,
    `S${d.sensitivity}`,
    RECORD_STATUS_AR[d.record_status],
    d.current_version,
    d.link_status === "complete" ? "مكتملة" : "ناقصة",
    hash.get(d.id) ?? "",
  ]);
  for (const item of loaded.items.filter((i) => i.mode === "count")) {
    rows.push([`إحصاء ${item.codes.join(" ")}`, item.note ?? "", "", "", "", "", "", "", String(item.count ?? "")]);
  }
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="basma-pack-${key}-${date}.csv"`,
    },
  });
}
