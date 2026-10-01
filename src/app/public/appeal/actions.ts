"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitAppeal(formData: FormData) {
  // Honeypot: a field real visitors never see or fill; bots that auto-fill
  // every input will, so silently drop the submission without erroring.
  if (String(formData.get("website") ?? "").trim()) {
    redirect("/public/appeal?sent=1");
  }

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const message = String(formData.get("message") ?? "").trim();

  if (!full_name || !message) {
    redirect(`/public/appeal?error=${encodeURIComponent("الرجاء إدخال الاسم ونص المناشدة")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("public_appeals").insert({ full_name, phone, location, message });

  if (error) {
    redirect(`/public/appeal?error=${encodeURIComponent("تعذّر إرسال المناشدة، حاول مرة أخرى")}`);
  }

  redirect("/public/appeal?sent=1");
}
