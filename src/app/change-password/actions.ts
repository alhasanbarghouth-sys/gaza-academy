"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function changePassword(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 8) {
    redirect(`/change-password?error=${encodeURIComponent("كلمة المرور يجب أن تكون 8 أحرف/أرقام على الأقل")}`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`/change-password?error=${encodeURIComponent("كلمتا المرور غير متطابقتين")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    redirect(`/change-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile.id);

  redirect("/dashboard");
}
