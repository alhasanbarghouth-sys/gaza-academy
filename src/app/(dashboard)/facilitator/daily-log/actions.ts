"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function createActivitySession(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const project_name = String(formData.get("project_name") ?? "").trim();
  const activity_type = String(formData.get("activity_type") ?? "").trim();
  const activity_date = String(formData.get("activity_date") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const challenges = String(formData.get("challenges") ?? "").trim() || null;

  const beneficiaries_male = Number(formData.get("beneficiaries_male") ?? 0) || 0;
  const beneficiaries_female = Number(formData.get("beneficiaries_female") ?? 0) || 0;
  const beneficiaries_children = Number(formData.get("beneficiaries_children") ?? 0) || 0;
  const beneficiaries_adults = Number(formData.get("beneficiaries_adults") ?? 0) || 0;

  let camp_id = String(formData.get("camp_id") ?? "");
  const newCampName = String(formData.get("new_camp_name") ?? "").trim();

  if (!project_name || !activity_type || !activity_date) {
    redirect(`/facilitator/daily-log?error=${encodeURIComponent("الرجاء تعبئة كل الحقول المطلوبة")}`);
  }

  if (camp_id === "__new__") {
    if (!newCampName) {
      redirect(`/facilitator/daily-log?error=${encodeURIComponent("الرجاء كتابة اسم المخيم الجديد")}`);
    }
    const { data: existing } = await supabase
      .from("camps")
      .select("id")
      .ilike("name", newCampName)
      .maybeSingle();

    if (existing) {
      camp_id = existing.id;
    } else {
      const { data: newCamp, error: campError } = await supabase
        .from("camps")
        .insert({ name: newCampName, created_by: profile.id, is_verified: false })
        .select("id")
        .single();
      if (campError || !newCamp) {
        redirect(`/facilitator/daily-log?error=${encodeURIComponent(campError?.message ?? "تعذّرت إضافة المخيم")}`);
      }
      camp_id = newCamp!.id;
    }
  }

  if (!camp_id) {
    redirect(`/facilitator/daily-log?error=${encodeURIComponent("الرجاء اختيار المخيم")}`);
  }

  const { data: session, error } = await supabase
    .from("activity_sessions")
    .insert({
      created_by: profile.id,
      camp_id,
      project_name,
      activity_type,
      activity_date,
      description,
      challenges,
      beneficiaries_male,
      beneficiaries_female,
      beneficiaries_children,
      beneficiaries_adults,
    })
    .select("id")
    .single();

  if (error || !session) {
    redirect(`/facilitator/daily-log?error=${encodeURIComponent(error?.message ?? "تعذّر حفظ النشاط")}`);
  }

  const coworkerIds = formData.getAll("participants").map(String).filter(Boolean);
  const participantIds = Array.from(new Set([profile.id, ...coworkerIds]));

  await supabase
    .from("activity_session_participants")
    .insert(participantIds.map((profile_id) => ({ session_id: session!.id, profile_id })));

  revalidatePath("/facilitator/daily-log");
  redirect("/facilitator/daily-log?saved=1");
}
