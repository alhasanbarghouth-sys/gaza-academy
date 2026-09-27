"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginToAuthEmail } from "@/lib/phone";

export async function signIn(formData: FormData) {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!phone || !password) {
    redirect(`/login?error=${encodeURIComponent("الرجاء إدخال رقم الجوال وكلمة المرور")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToAuthEmail(phone),
    password,
  });

  if (error) {
    console.error("sign-in failed", { status: error.status, code: error.code, message: error.message });
    const message =
      error.code === "invalid_credentials"
        ? "رقم الجوال أو كلمة المرور غير صحيحة"
        : error.code === "email_not_confirmed"
          ? "الحساب غير مفعّل بعد — يجب تأكيده من لوحة Supabase"
          : `تعذّر تسجيل الدخول: ${error.message}`;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect(next || "/dashboard");
}
