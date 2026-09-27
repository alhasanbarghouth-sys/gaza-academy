"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone";
import type { UserRole } from "@/types/database";

function assertCanManageUsers(role: UserRole) {
  if (!["system_admin", "executive_director"].includes(role)) {
    throw new Error("غير مصرح لك بإدارة المستخدمين");
  }
}

export async function createStaffUser(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const national_id = String(formData.get("national_id") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "staff") as UserRole;

  const phone = normalizePhone(phoneRaw);

  if (!full_name || !phone || !national_id) {
    redirect(`/admin/users?error=${encodeURIComponent("الرجاء إدخال الاسم، رقم الجوال، ورقم الهوية")}`);
  }
  if (national_id.length < 6) {
    redirect(`/admin/users?error=${encodeURIComponent("رقم الهوية (كلمة المرور المؤقتة) قصير جدًا")}`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(phone),
    password: national_id,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (error || !data.user) {
    redirect(`/admin/users?error=${encodeURIComponent(error?.message ?? "تعذّر إنشاء الحساب")}`);
  }

  // The handle_new_user trigger already created the profile row (with role
  // from user_metadata) — fill in the fields it doesn't set.
  await admin
    .from("profiles")
    .update({ phone, department, must_change_password: true })
    .eq("id", data.user!.id);

  revalidatePath("/admin/users");
  redirect(`/admin/users?created=${encodeURIComponent(full_name)}`);
}

export async function updateUserRole(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!id || !role) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", id);

  revalidatePath("/admin/users");
}

export async function toggleActive(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const id = String(formData.get("id") ?? "");
  const is_active = formData.get("is_active") === "true";
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: !is_active }).eq("id", id);

  revalidatePath("/admin/users");
}
