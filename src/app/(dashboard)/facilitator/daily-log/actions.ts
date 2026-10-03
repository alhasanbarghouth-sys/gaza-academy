"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { BENEFICIARY_CATEGORIES, GBV_TYPES, OTHER_PROJECT, PROJECTS } from "@/lib/activity";

const MAX_BLOCKS = 6;

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

  revalidatePath("/facilitator/daily-log");
  redirect(`/facilitator/daily-log?saved=${blocks.length}`);
}
