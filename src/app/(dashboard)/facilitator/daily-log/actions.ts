"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BENEFICIARY_CATEGORIES, GBV_TYPES, OTHER_PROJECT, PROJECTS } from "@/lib/activity";
import { createDocument } from "@/app/(dashboard)/archive/actions";

const MAX_BLOCKS = 6;
const MAX_FILES_PER_PROJECT = 30;

type Attachment = { path: string; name: string; type: string };

type Block = {
  project_name: string;
  activity_type: string;
  camp_id: string;
  new_camp_name: string;
  description: string | null;
  challenges: string | null;
  counts: Record<string, number>;
  gbv_encountered: boolean;
  gbv_cases_count: number;
  gbv_referred: boolean;
  gbv_types: string[];
  gbv_details: string;
  coworkers: string[];
  files: Attachment[];
};

function fail(message: string): never {
  redirect(`/facilitator/daily-log?error=${encodeURIComponent(message)}`);
}

/** Reads and validates one project's answers; `label` names the project in error messages. */
function readBlock(formData: FormData, p: string, label: string): Block {
  const get = (k: string) => String(formData.get(`${p}${k}`) ?? "").trim();

  const choice = get("project");
  const other = get("project_other");
  const known = PROJECTS.find((name) => name.toLowerCase() === (choice === OTHER_PROJECT ? other : choice).toLowerCase());
  const project_name = known ?? (choice === OTHER_PROJECT ? other : "");
  if (!choice) fail(`${label}: اختر المشروع`);
  if (!project_name) fail(choice === OTHER_PROJECT ? `${label}: اكتب اسم المشروع` : `${label}: المشروع غير معروف`);

  const activity_type = get("activity_type");
  if (!activity_type) fail(`${label}: اختر نوع النشاط`);

  const counts: Record<string, number> = {};
  for (const c of BENEFICIARY_CATEGORIES) {
    counts[c.column] = Math.max(0, Math.floor(Number(formData.get(`${p}${c.column}`) ?? 0) || 0));
  }

  const gbv_encountered = get("gbv_encountered") === "yes";
  const gbv_cases_count = gbv_encountered ? Math.max(0, Math.floor(Number(get("gbv_cases_count")) || 0)) : 0;
  const allowedTypes: string[] = GBV_TYPES.map((t) => t.value);
  const gbv_types = formData.getAll(`${p}gbv_types`).map(String).filter((t) => allowedTypes.includes(t));
  const gbv_details = get("gbv_details");
  if (gbv_encountered) {
    if (gbv_cases_count < 1) fail(`${label}: أدخل عدد حالات العنف المبني على النوع الاجتماعي`);
    if (gbv_types.length === 0) fail(`${label}: اختر نوع العنف: جنسي أو جسدي أو نفسي`);
    if (!gbv_details) fail(`${label}: اكتب تفاصيل الحالة`);
  }

  const camp_id = get("camp_id");
  const new_camp_name = get("new_camp_name");
  if (!camp_id) fail(`${label}: اختر المخيم`);
  if (camp_id === "__new__" && !new_camp_name) fail(`${label}: اكتب اسم المخيم الجديد`);

  return {
    project_name,
    activity_type,
    camp_id,
    new_camp_name,
    description: get("description") || null,
    challenges: get("challenges") || null,
    counts,
    gbv_encountered,
    gbv_cases_count,
    gbv_referred: gbv_encountered && get("gbv_referred") === "on",
    gbv_types,
    gbv_details,
    coworkers: formData.getAll(`${p}participants`).map(String).filter(Boolean),
    files: formData
      .getAll(`${p}files`)
      .flatMap((v) => {
        try {
          const f = JSON.parse(String(v));
          return typeof f?.path === "string" && typeof f?.name === "string"
            ? [{ path: f.path, name: f.name.slice(0, 200), type: typeof f.type === "string" ? f.type : "" }]
            : [];
        } catch {
          return [];
        }
      })
      .slice(0, MAX_FILES_PER_PROJECT),
  };
}

/**
 * Saves the day's report. Each project block becomes its own activity (with its
 * own team and GBV details), so work on two projects in one day is two reports.
 */
export async function createActivitySession(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const activity_date = String(formData.get("activity_date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activity_date)) fail("الرجاء اختيار التاريخ");

  const keys = Array.from(new Set(formData.getAll("block").map(String).filter((k) => /^\d+$/.test(k))));
  if (keys.length === 0) fail("الرجاء تعبئة كل الحقول المطلوبة");
  if (keys.length > MAX_BLOCKS) fail("عدد المشاريع في التقرير الواحد أكبر من المسموح");

  // Validate every project before saving any of them.
  const blocks = keys.map((k, i) => readBlock(formData, `b${k}_`, keys.length > 1 ? `المشروع رقم ${i + 1}` : "التقرير"));
  const names = blocks.map((b) => b.project_name.toLowerCase());
  if (new Set(names).size !== names.length) fail("لا يمكن اختيار المشروع نفسه مرتين في اليوم نفسه — اجمع نشاطه في تقرير واحد");

  // Resolve "camp not in the list" entries (once per name).
  const newCamps = new Map<string, string>();
  for (const b of blocks) {
    if (b.camp_id !== "__new__") continue;
    const key = b.new_camp_name.toLowerCase();
    if (!newCamps.has(key)) {
      const { data: existing } = await supabase.from("camps").select("id").ilike("name", b.new_camp_name).maybeSingle();
      if (existing) {
        newCamps.set(key, existing.id);
      } else {
        const { data: created, error } = await supabase
          .from("camps")
          .insert({ name: b.new_camp_name, created_by: profile.id, is_verified: false })
          .select("id")
          .single();
        if (error || !created) fail(error?.message ?? "تعذّرت إضافة المخيم");
        newCamps.set(key, created.id);
      }
    }
    b.camp_id = newCamps.get(key)!;
  }

  // One statement, so either every project's report is saved or none is.
  const { data: sessions, error } = await supabase
    .from("activity_sessions")
    .insert(
      blocks.map((b) => ({
        created_by: profile.id,
        camp_id: b.camp_id,
        project_name: b.project_name,
        activity_type: b.activity_type,
        activity_date,
        description: b.description,
        challenges: b.challenges,
        ...b.counts,
        gbv_encountered: b.gbv_encountered,
        gbv_cases_count: b.gbv_cases_count,
        gbv_referred: b.gbv_referred,
      }))
    )
    .select("id, project_name");
  if (error || !sessions || sessions.length !== blocks.length) fail(error?.message ?? "تعذّر حفظ النشاط");

  const idOf = new Map(sessions.map((s) => [String(s.project_name).toLowerCase(), s.id as string]));
  const withIds = blocks.map((b) => ({ ...b, session_id: idOf.get(b.project_name.toLowerCase())! }));

  await supabase.from("activity_session_participants").insert(
    withIds.flatMap((b) =>
      Array.from(new Set([profile.id, ...b.coworkers])).map((profile_id) => ({ session_id: b.session_id, profile_id }))
    )
  );

  const gbvRows = withIds
    .filter((b) => b.gbv_encountered)
    .map((b) => ({ session_id: b.session_id, violence_types: b.gbv_types, details: b.gbv_details, created_by: profile.id }));
  if (gbvRows.length) {
    const { error: gbvError } = await supabase.from("activity_gbv_reports").insert(gbvRows);
    if (gbvError) fail(`حُفظ النشاط لكن تعذّر حفظ تفاصيل حالة العنف: ${gbvError.message}`);
  }

  const { attached, problems } = await fileAttachments(withIds, activity_date, profile);

  revalidatePath("/facilitator/daily-log");
  const qs = new URLSearchParams({ saved: String(blocks.length) });
  if (attached) qs.set("files", String(attached));
  if (problems.length) qs.set("warn", `حُفظ التقرير، لكن تعذّر حفظ بعض المرفقات: ${problems.join(" | ")}`);
  redirect(`/facilitator/daily-log?${qs}`);
}

/**
 * Files each project's photos and documents in the institutional database,
 * inside that report's activity folder (one per day and project). The report
 * itself is already saved; a failed attachment is reported, never fatal.
 */
async function fileAttachments(
  blocks: (Block & { session_id: string })[],
  activity_date: string,
  profile: { id: string; full_name: string }
) {
  let attached = 0;
  const problems: string[] = [];
  const withFiles = blocks.filter((b) => b.files.length);
  if (!withFiles.length) return { attached, problems };

  const supabase = await createClient();
  const { data: camps } = await supabase.from("camps").select("id, name").in("id", withFiles.map((b) => b.camp_id));
  const campName = new Map((camps ?? []).map((c) => [c.id as string, c.name as string]));

  for (const b of withFiles) {
    const { data: folder, error } = await supabase.rpc("activity_archive_folder", { p_session_id: b.session_id });
    if (error || !folder) {
      problems.push(`${b.project_name}: ${error?.message ?? "تعذّر تجهيز مجلد النشاط"}`);
      continue;
    }
    const { activity_id, project_id } = folder as { activity_id: string; project_id: string };
    const camp = campName.get(b.camp_id) ?? "";
    const files = b.files.filter((f) => f.path.startsWith(`${profile.id}/`));

    for (const [i, f] of files.entries()) {
      const media = /^(image|video)\//.test(f.type);
      const kind = f.type.startsWith("video/") ? "فيديو" : media ? "صورة" : "مرفق";
      const res = await createDocument({
        doc_type: media ? "activity_media" : "activity_attachment",
        category_code: media ? "07.07" : "07.09",
        title: `${kind} — ${b.activity_type} — ${b.project_name} — ${camp} — ${activity_date}${files.length > 1 ? ` (${i + 1} من ${files.length})` : ""}`,
        document_date: activity_date,
        source: `سجل النشاط اليومي — ${profile.full_name}`,
        responsible: profile.full_name,
        record_status: "original",
        sensitivity: media ? 2 : 1,
        language: "ar",
        keywords: [b.project_name, camp, b.activity_type, "سجل النشاط اليومي"].filter(Boolean).join("، "),
        storage_path: f.path,
        file_name: f.name,
        mime_type: f.type || undefined,
        links: [
          { link_type: "proves", target_entity_id: activity_id },
          { link_type: "belongs_to", target_entity_id: project_id },
        ],
      });
      if ("error" in res && res.error) problems.push(`${f.name}: ${res.error}`);
      else attached++;
    }
  }
  return { attached, problems };
}
