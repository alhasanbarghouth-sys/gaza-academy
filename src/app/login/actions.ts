"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { phoneToAuthEmail } from "@/lib/phone";

export async function signIn(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!phone || !password) {
    redirect(`/login?error=${encodeURIComponent("الرجاء إدخال رقم الجوال وكلمة المرور")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(phone),
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("رقم الجوال أو كلمة المرور غير صحيحة")}`);
  }

  redirect(next || "/dashboard");
}
