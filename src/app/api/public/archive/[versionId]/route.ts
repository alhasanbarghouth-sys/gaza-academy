import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public download of an S0 record's current version. The service-role client
// is used only after confirming, server-side, that the record is S0 and not a
// draft — nothing else is reachable through this route.
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const admin = createAdminClient();
  const { data: v } = await admin
    .from("archive_document_versions")
    .select("document_id, version_no, storage_path, file_name, archive_documents!inner(sensitivity, record_status, current_version)")
    .eq("id", versionId)
    .maybeSingle();

  const doc = (v as { archive_documents?: { sensitivity: number; record_status: string; current_version: number } } | null)
    ?.archive_documents;
  if (!v || !doc || doc.sensitivity !== 0 || doc.record_status === "draft" || doc.current_version !== v.version_no) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  await admin
    .from("archive_access_log")
    .insert({ document_id: v.document_id, version_no: v.version_no, actor_id: null, action: "public_download" });

  const { data, error } = await admin.storage.from("archive").createSignedUrl(v.storage_path, 60, { download: v.file_name });
  if (error || !data) return NextResponse.json({ error: "تعذّر تجهيز الملف" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
