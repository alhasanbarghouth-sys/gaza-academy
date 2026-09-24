"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

function assertCanManageUsers(role: UserRole) {
  if (!["system_admin", "executive_director"].includes(role)) {
    throw new Error("غير مصرح لك بإدارة المستخدمين");
  }
}

export async function inviteUser(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const email = String(formData.get("email") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "staff") as UserRole;

  if (!email || !full_name) {
    redirect(`/admin/users?error=${encodeURIComponent("الرجاء إدخال البريد والاسم")}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
  });

  if (error) {
    redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?invited=1");
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
