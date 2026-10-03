import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "archive";

/** A file attached to an AI or request conversation. */
export type Attachment = {
  name: string;
  type: string;
  size: number;
  path: string;
  sha256: string;
  action: "saved" | "duplicate";
  archive_number?: string | null;
  document_id?: string | null;
  note: string;
};

export type QueueSource = "bulk" | "ai_chat" | "request";

type Registered = Attachment & { queue_id?: string };

/**
 * Fingerprints a freshly uploaded file and compares it with the institutional
 * database. A file that already exists (filed, or waiting in anyone's intake
 * queue) is not kept twice: the new upload is removed and the existing copy is
 * referenced. A new file is kept and queued for AI classification and review.
 */
export async function registerUpload(
  uid: string,
  input: { path: string; name: string; type: string; size: number },
  source: QueueSource
): Promise<Registered | { error: string }> {
  if (!input.path.startsWith(`${uid}/`)) return { error: "مسار الملف غير صالح" };
  const admin = createAdminClient();
  const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(input.path);
  if (dlError || !blob) return { error: "لم يصل الملف إلى المخزن، أعد المحاولة" };
  const buf = Buffer.from(await blob.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const base = { name: input.name.slice(0, 250), type: input.type || "", size: buf.length, sha256 };

  const supabase = await createClient();

  // 1. Already filed in the institutional database?
  const { data: version } = await admin
    .from("archive_document_versions")
    .select("document_id, storage_path, archive_documents(archive_number, title)")
    .eq("sha256", sha256)
    .order("uploaded_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (version) {
    await admin.storage.from(BUCKET).remove([input.path]);
    const { data: visible } = await supabase.rpc("archive_can_see_doc", { p_doc_id: version.document_id });
    const doc = (Array.isArray(version.archive_documents) ? version.archive_documents[0] : version.archive_documents) as
      | { archive_number: string; title: string }
      | null;
    return {
      ...base,
      path: version.storage_path,
      action: "duplicate",
      document_id: visible ? version.document_id : null,
      archive_number: visible ? doc?.archive_number ?? null : null,
      note: visible && doc
        ? `الملف موجود مسبقاً في قاعدة البيانات المؤسسية (${doc.archive_number} — ${doc.title})، فلم يُحفظ مرة أخرى.`
        : "الملف موجود مسبقاً في قاعدة البيانات المؤسسية (سجل مقيّد)، فلم يُحفظ مرة أخرى.",
    };
  }

  // 2. Already waiting for review in an intake queue?
  const { data: queued } = await admin
    .from("archive_intake_queue")
    .select("id, storage_path, created_by")
    .eq("sha256", sha256)
    .neq("status", "discarded")
    .limit(1)
    .maybeSingle();
  if (queued) {
    await admin.storage.from(BUCKET).remove([input.path]);
    return {
      ...base,
      path: queued.storage_path,
      action: "duplicate",
      note:
        queued.created_by === uid
          ? "الملف موجود مسبقاً في قائمة «الإدراج الذكي» لديك بانتظار المراجعة، فلم يُحفظ مرة أخرى."
          : "رفع زميلٌ هذا الملف مسبقاً وهو بانتظار المراجعة، فلم يُحفظ مرة أخرى.",
    };
  }

  // 3. New: keep it and queue it for classification.
  const row = {
    created_by: uid,
    storage_path: input.path,
    file_name: base.name,
    mime_type: base.type || null,
    file_size: base.size,
    sha256,
    source,
  };
  let { data: q, error } = await supabase.from("archive_intake_queue").insert(row).select("id").single();
  if (error && /sha256|source/.test(error.message)) {
    // 0014 not run yet: queue without the fingerprint columns.
    const { sha256: _s, source: _src, ...legacy } = row;
    ({ data: q, error } = await supabase.from("archive_intake_queue").insert(legacy).select("id").single());
  }
  if (error || !q) return { error: error?.message ?? "تعذّر حفظ الملف" };
  return {
    ...base,
    path: input.path,
    action: "saved",
    queue_id: q.id,
    note:
      source === "bulk"
        ? "ملف جديد: حُفظ وسيُصنَّف."
        : "ملف جديد: حُفظ في قاعدة البيانات المؤسسية وأُضيف إلى «الإدراج الذكي» ليُصنَّف ويُعتمد.",
  };
}

/**
 * Keeps only attachments the sender may reference: their own upload, or an
 * existing copy whose fingerprint they hold (they uploaded the same bytes).
 */
export async function validateAttachments(raw: unknown, uid: string): Promise<Attachment[]> {
  const list = (Array.isArray(raw) ? raw : []).slice(0, 10);
  const admin = createAdminClient();
  const out: Attachment[] = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    const path = typeof x.path === "string" ? x.path : "";
    const sha = typeof x.sha256 === "string" && /^[0-9a-f]{64}$/.test(x.sha256) ? x.sha256 : "";
    if (!path || !sha) continue;
    let ok = path.startsWith(`${uid}/`);
    if (!ok) {
      const [{ data: v }, { data: q }] = await Promise.all([
        admin.from("archive_document_versions").select("id").eq("storage_path", path).eq("sha256", sha).maybeSingle(),
        admin.from("archive_intake_queue").select("id").eq("storage_path", path).eq("sha256", sha).maybeSingle(),
      ]);
      ok = !!(v || q);
    }
    if (!ok) continue;
    out.push({
      name: String(x.name ?? "ملف").slice(0, 250),
      type: String(x.type ?? ""),
      size: Number(x.size) || 0,
      path,
      sha256: sha,
      action: x.action === "duplicate" ? "duplicate" : "saved",
      archive_number: typeof x.archive_number === "string" ? x.archive_number : null,
      document_id: typeof x.document_id === "string" ? x.document_id : null,
      note: String(x.note ?? "").slice(0, 400),
    });
  }
  return out;
}

export async function downloadAttachment(path: string): Promise<Buffer | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function signedAttachmentUrl(path: string, name: string): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 300, { download: name });
  return data?.signedUrl ?? null;
}
