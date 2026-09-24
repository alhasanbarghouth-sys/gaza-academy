"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function createDailyActivity(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const project_name = String(formData.get("project_name") ?? "").trim();
  const activity_type = String(formData.get("activity_type") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const activity_date = String(formData.get("activity_date") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const challenges = String(formData.get("challenges") ?? "").trim() || null;

  const beneficiaries_male = Number(formData.get("beneficiaries_male") ?? 0) || 0;
  const beneficiaries_female = Number(formData.get("beneficiaries_female") ?? 0) || 0;
  const beneficiaries_children = Number(formData.get("beneficiaries_children") ?? 0) || 0;
  const beneficiaries_adults = Number(formData.get("beneficiaries_adults") ?? 0) || 0;

  if (!project_name || !activity_type || !location || !activity_date) {
    redirect(`/facilitator/daily-log?error=${encodeURIComponent("الرجاء تعبئة كل الحقول المطلوبة")}`);
  }

  const { error } = await supabase.from("daily_activities").insert({
    facilitator_id: profile.id,
    project_name,
    activity_type,
    location,
    activity_date,
    description,
    challenges,
    beneficiaries_male,
    beneficiaries_female,
    beneficiaries_children,
    beneficiaries_adults,
  });

  if (error) {
    redirect(`/facilitator/daily-log?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/facilitator/daily-log");
  redirect("/facilitator/daily-log?saved=1");
}
