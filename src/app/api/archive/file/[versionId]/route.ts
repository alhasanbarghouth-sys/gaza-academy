import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The bucket has no user policies: this route is the only way to a file, and
// it records the download in the access log (16.02) before handing out a
// link that expires in a minute.
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const { data: version } = await supabase
    .from("archive_document_versions")
    .select("document_id, version_no, storage_path, file_name")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const { data: allowed } = await supabase.rpc("archive_log_access", {
    p_document_id: version.document_id,
    p_version_no: version.version_no,
    p_action: "download",
  });
  if (allowed !== true) return NextResponse.json({ error: "لا تملك صلاحية فتح هذا المحتوى" }, { status: 403 });

  const { data, error } = await createAdminClient()
    .storage.from("archive")
    .createSignedUrl(version.storage_path, 60, { download: version.file_name });
  if (error || !data) return NextResponse.json({ error: "تعذّر تجهيز الملف" }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
