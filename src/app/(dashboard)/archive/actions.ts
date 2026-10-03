"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { safeStorageKey } from "@/lib/storage";
import { GRANT_PRESETS, MAX_ARCHIVE_FILE_BYTES, sanitizeSearch } from "@/lib/archive/constants";
import type { ArchiveEntity, EntityType } from "@/types/database";

type Result<T = object> = ({ error?: undefined } & T) | { error: string };

const BUCKET = "archive";

// ---- lookups used by the client-side pickers ----------------------------------------

export async function searchEntities(q: string, types: EntityType[]): Promise<ArchiveEntity[]> {
  await requireProfile();
  const supabase = await createClient();
  let query = supabase.from("archive_entities").select("*").eq("is_active", true).order("code").limit(25);
  if (types.length) query = query.in("entity_type", types);
  const term = sanitizeSearch(q);
  if (term) query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
  const { data } = await query;
  return (data ?? []) as ArchiveEntity[];
}

export async function searchDocuments(
  q: string,
  categories: string[]
): Promise<{ id: string; archive_number: string; title: string; category_code: string }[]> {
  await requireProfile();
  const supabase = await createClient();
  let query = supabase
    .from("archive_documents")
    .select("id, archive_number, title, category_code")
    .order("created_at", { ascending: false })
    .limit(25);
  const prefixes = categories.filter((c) => c !== "*" && /^\d{2}(\.\d{2}){0,2}$/.test(c));
  if (prefixes.length && !categories.includes("*")) {
    query = query.or(prefixes.map((c) => `category_code.eq.${c},category_code.like.${c}.%`).join(","));
  }
  const term = sanitizeSearch(q);
  if (term) query = query.ilike("search_text", `%${term}%`);
  const { data } = await query;
  return data ?? [];
}

export async function createEntity(input: {
  entity_type: EntityType;
  name?: string;
  description?: string;
  parent_id?: string;
  profile_id?: string;
  start_date?: string;
  end_date?: string;
  year?: number;
}): Promise<Result<{ id: string; code: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_create_entity", { p: input });
  if (error) return { error: error.message };
  revalidatePath("/archive/entities");
  return data as { id: string; code: string };
}

// ---- uploads: browser -> storage directly (signed URL), then the server
//      re-reads the stored file to compute the fingerprint itself ----------------------

export async function prepareUpload(input: {
  fileName: string;
  size: number;
  documentId?: string;
}): Promise<Result<{ path: string; token: string }>> {
  const profile = await requireProfile();
  if (!input.size || input.size > MAX_ARCHIVE_FILE_BYTES) {
    return { error: "حجم الملف يجب ألا يتجاوز 50 ميغابايت" };
  }
  const supabase = await createClient();
  if (input.documentId) {
    const { data: canRead } = await supabase.rpc("archive_can_read_doc", { p_doc_id: input.documentId });
    if (!canRead) return { error: "لا تملك صلاحية إضافة إصدار لهذا المستند" };
  } else {
    const { data: cats } = await supabase.rpc("archive_my_insert_categories");
    if (!cats || (cats as unknown[]).length === 0) return { error: "لا تملك صلاحية الإدراج في أي تصنيف" };
  }

  const path = safeStorageKey(input.fileName, profile.id);
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "تعذّر تجهيز الرفع" };
  return { path: data.path, token: data.token };
}

async function fingerprint(path: string): Promise<{ sha256: string; size: number } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
}

// Only ever removes an orphan upload: a path already registered to a record
// (e.g. a replayed request) is an archived original and must never be deleted.
async function discardUpload(path: string) {
  const admin = createAdminClient();
  const { data: owner } = await admin.from("archive_document_versions").select("id").eq("storage_path", path).maybeSingle();
  if (owner) return;
  await admin.storage.from(BUCKET).remove([path]);
}

export type NewDocumentInput = {
  doc_type: string;
  category_code: string;
  title: string;
  title_en?: string;
  document_date: string;
  source: string;
  responsible: string;
  record_status: string;
  sensitivity: number;
  language: string;
  keywords?: string;
  budget_line?: string;
  offer_provider_type?: string;
  is_unpublished?: boolean;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  links: { link_type: string; target_entity_id?: string; target_document_id?: string }[];
};

export async function createDocument(input: NewDocumentInput): Promise<Result<{ id: string; archive_number: string }>> {
  return fileDocument(input, false);
}

// keepUpload: the AI intake queue keeps the uploaded file when filing fails, so
// the reviewer can fix the description and try again.
async function fileDocument(input: NewDocumentInput, keepUpload: boolean): Promise<Result<{ id: string; archive_number: string }>> {
  const profile = await requireProfile();
  if (!input.storage_path.startsWith(`${profile.id}/`)) return { error: "مسار الملف غير صالح" };

  const fp = await fingerprint(input.storage_path);
  if (!fp) return { error: "لم يصل الملف إلى المخزن، أعد المحاولة" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_create_document", {
    p: { ...input, sha256: fp.sha256, file_size: fp.size },
  });
  if (error) {
    if (!keepUpload) await discardUpload(input.storage_path);
    return { error: error.message };
  }
  revalidatePath("/archive");
  return data as { id: string; archive_number: string };
}

export async function addVersion(input: {
  document_id: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  change_reason: string;
  record_status?: string;
}): Promise<Result<{ version_no: number }>> {
  const profile = await requireProfile();
  if (!input.storage_path.startsWith(`${profile.id}/`)) return { error: "مسار الملف غير صالح" };

  const fp = await fingerprint(input.storage_path);
  if (!fp) return { error: "لم يصل الملف إلى المخزن، أعد المحاولة" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_add_version", {
    p: { ...input, sha256: fp.sha256, file_size: fp.size },
  });
  if (error) {
    await discardUpload(input.storage_path);
    return { error: error.message };
  }
  revalidatePath(`/archive/doc/${input.document_id}`);
  return data as { version_no: number };
}

// ---- document metadata & links -------------------------------------------------------

export async function addLink(input: {
  document_id: string;
  link_type: string;
  target_entity_id?: string;
  target_document_id?: string;
  note?: string;
}): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_add_link", { p: input });
  if (error) return { error: error.message };
  revalidatePath(`/archive/doc/${input.document_id}`);
  if (input.target_document_id) revalidatePath(`/archive/doc/${input.target_document_id}`);
  return {};
}

export async function removeLink(formData: FormData) {
  await requireProfile();
  const linkId = String(formData.get("link_id") ?? "");
  const docId = String(formData.get("document_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_remove_link", { p_link_id: linkId });
  const q = error ? `?error=${encodeURIComponent(error.message)}` : "";
  revalidatePath(`/archive/doc/${docId}`);
  redirect(`/archive/doc/${docId}${q}`);
}

export async function updateDocument(formData: FormData) {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  const p: Record<string, unknown> = {};
  for (const key of ["title", "title_en", "source", "responsible", "record_status", "language", "keywords", "budget_line"]) {
    if (formData.has(key)) p[key] = String(formData.get(key) ?? "");
  }
  if (formData.has("sensitivity")) p.sensitivity = Number(formData.get("sensitivity"));
  if (formData.has("is_unpublished_present")) p.is_unpublished = formData.get("is_unpublished") === "on";

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_update_document", { p_id: id, p });
  revalidatePath(`/archive/doc/${id}`);
  redirect(`/archive/doc/${id}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

// ---- entities ------------------------------------------------------------------------

export async function createEntityForm(formData: FormData) {
  const type = String(formData.get("entity_type") ?? "") as EntityType;
  const res = await createEntity({
    entity_type: type,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    parent_id: String(formData.get("parent_id") ?? "") || undefined,
    profile_id: String(formData.get("profile_id") ?? "") || undefined,
    start_date: String(formData.get("start_date") ?? "") || undefined,
    end_date: String(formData.get("end_date") ?? "") || undefined,
    year: formData.get("year") ? Number(formData.get("year")) : undefined,
  });
  if ("error" in res && res.error) redirect(`/archive/entities?type=${type}&error=${encodeURIComponent(res.error)}`);
  redirect(`/archive/entities/${(res as { id: string }).id}?created=1`);
}

export async function updateEntity(formData: FormData) {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  const p: Record<string, unknown> = {};
  for (const key of ["name", "description", "start_date", "end_date"]) {
    if (formData.has(key)) p[key] = String(formData.get(key) ?? "");
  }
  if (formData.has("is_active")) p.is_active = formData.get("is_active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_update_entity", { p_id: id, p });
  revalidatePath(`/archive/entities/${id}`);
  redirect(`/archive/entities/${id}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

export async function setProjectMember(formData: FormData) {
  await requireProfile();
  const projectId = String(formData.get("project_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_set_project_member", {
    p_project_id: projectId,
    p_profile_id: String(formData.get("profile_id") ?? ""),
    p_member_role: String(formData.get("member_role") ?? "member"),
  });
  revalidatePath(`/archive/entities/${projectId}`);
  redirect(`/archive/entities/${projectId}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

export async function removeProjectMember(formData: FormData) {
  await requireProfile();
  const projectId = String(formData.get("project_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_remove_project_member", {
    p_project_id: projectId,
    p_profile_id: String(formData.get("profile_id") ?? ""),
  });
  revalidatePath(`/archive/entities/${projectId}`);
  redirect(`/archive/entities/${projectId}?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

// ---- grants (executive director) -----------------------------------------------------

export async function createGrants(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const designation = String(formData.get("designation") ?? "named_access");
  const usePreset = formData.get("use_preset") === "on" && GRANT_PRESETS[designation];
  const validUntil = String(formData.get("valid_until") ?? "");
  const common = {
    profile_id: String(formData.get("profile_id") ?? ""),
    designation,
    reason: String(formData.get("reason") ?? ""),
    valid_until: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : "",
  };

  const requests = usePreset
    ? GRANT_PRESETS[designation].map((g) => ({
        ...common,
        category_prefix: g.prefix,
        max_sensitivity: g.max,
        can_insert: g.insert,
      }))
    : [
        {
          ...common,
          category_prefix: String(formData.get("category_prefix") ?? ""),
          max_sensitivity: Number(formData.get("max_sensitivity") ?? 1),
          can_insert: formData.get("can_insert") === "on",
        },
      ];

  const docNumber = String(formData.get("archive_number") ?? "").trim();
  if (!usePreset && docNumber) {
    const { data: doc } = await supabase.from("archive_documents").select("id").eq("archive_number", docNumber).maybeSingle();
    if (!doc) redirect(`/archive/access?error=${encodeURIComponent("رقم الأرشفة غير موجود")}`);
    Object.assign(requests[0], { category_prefix: "", document_id: doc!.id });
  }

  for (const p of requests) {
    const { error } = await supabase.rpc("archive_create_grant", { p });
    if (error) redirect(`/archive/access?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/archive/access");
  redirect("/archive/access?saved=1");
}

export async function revokeGrant(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_revoke_grant", { p_id: String(formData.get("id") ?? "") });
  revalidatePath("/archive/access");
  redirect(`/archive/access?${error ? `error=${encodeURIComponent(error.message)}` : "saved=1"}`);
}

// ---- AI-assisted bulk intake: files wait in the uploader's own queue with the
//      AI's proposal until a person approves them ------------------------------------

export async function queueBulkUpload(input: {
  path: string;
  name: string;
  type: string;
  size: number;
}): Promise<Result<{ id: string }>> {
  const profile = await requireProfile();
  if (!input.path.startsWith(`${profile.id}/`)) return { error: "مسار الملف غير صالح" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("archive_intake_queue")
    .insert({
      created_by: profile.id,
      storage_path: input.path,
      file_name: input.name.slice(0, 250),
      mime_type: input.type || null,
      file_size: Math.max(0, Math.floor(input.size)),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "تعذّر تسجيل الملف في قائمة المراجعة" };
  return { id: data.id };
}

export async function fileQueuedDocument(
  id: string,
  input: Omit<NewDocumentInput, "storage_path" | "file_name" | "mime_type">
): Promise<Result<{ id: string; archive_number: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: item } = await supabase.from("archive_intake_queue").select("*").eq("id", id).maybeSingle();
  if (!item) return { error: "الملف غير موجود في قائمة المراجعة" };
  if (item.status === "filed") return { error: "حُفظ هذا الملف مسبقاً" };

  const res = await fileDocument(
    { ...input, storage_path: item.storage_path, file_name: item.file_name, mime_type: item.mime_type ?? undefined },
    true
  );
  if ("error" in res && res.error) return res;
  const doc = res as { id: string; archive_number: string };
  await supabase
    .from("archive_intake_queue")
    .update({ status: "filed", document_id: doc.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/archive/bulk");
  return doc;
}

export async function discardQueued(id: string): Promise<Result> {
  await requireProfile();
  const supabase = await createClient();
  const { data: item } = await supabase.from("archive_intake_queue").select("id, status, storage_path").eq("id", id).maybeSingle();
  if (!item) return { error: "الملف غير موجود في قائمة المراجعة" };
  if (item.status === "filed") return { error: "حُفظ هذا الملف في قاعدة البيانات ولا يُحذف من هنا" };
  await discardUpload(item.storage_path);
  await supabase.from("archive_intake_queue").delete().eq("id", id);
  revalidatePath("/archive/bulk");
  return {};
}

export async function previewQueued(id: string): Promise<Result<{ url: string }>> {
  await requireProfile();
  const supabase = await createClient();
  const { data: item } = await supabase.from("archive_intake_queue").select("storage_path, status").eq("id", id).maybeSingle();
  if (!item || item.status === "filed") return { error: "الملف غير موجود" };
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(item.storage_path, 300);
  if (error || !data) return { error: error?.message ?? "تعذّرت المعاينة" };
  return { url: data.signedUrl };
}
