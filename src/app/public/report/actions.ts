"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitMisconductReport(formData: FormData) {
  if (String(formData.get("website") ?? "").trim()) {
    redirect("/public/report?sent=1");
  }

  const reporter_name = String(formData.get("reporter_name") ?? "").trim() || null;
  const reporter_contact = String(formData.get("reporter_contact") ?? "").trim() || null;
  const accused_name = String(formData.get("accused_name") ?? "").trim() || null;
  const incident_description = String(formData.get("incident_description") ?? "").trim();
  const incident_location = String(formData.get("incident_location") ?? "").trim() || null;

  if (!incident_description) {
    redirect(`/public/report?error=${encodeURIComponent("الرجاء وصف ما حدث")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("misconduct_reports").insert({
    reporter_name,
    reporter_contact,
    accused_name,
    incident_description,
    incident_location,
  });

  if (error) {
    redirect(`/public/report?error=${encodeURIComponent("تعذّر إرسال البلاغ، حاول مرة أخرى")}`);
  }

  redirect("/public/report?sent=1");
}
