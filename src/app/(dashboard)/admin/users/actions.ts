"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, phoneToAuthEmail, toAsciiDigits } from "@/lib/phone";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import type { UserRole } from "@/types/database";

function assertCanManageUsers(role: UserRole) {
  if (!["system_admin", "executive_director"].includes(role)) {
    throw new Error("غير مصرح لك بإدارة المستخدمين");
  }
}

const ROLE_BY_LABEL: Record<string, UserRole> = Object.fromEntries(
  Object.entries(ROLE_LABELS_AR).map(([code, label]) => [label, code as UserRole])
);

function parseRole(raw: string): UserRole | null {
  const value = raw.trim();
  if (value in ROLE_LABELS_AR) return value as UserRole;
  return ROLE_BY_LABEL[value] ?? null;
}

async function createAccount(input: {
  full_name: string;
  phone: string;
  password: string;
  role: UserRole;
  department: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(input.phone),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: input.role },
  });
  if (error || !data.user) {
    return error?.code === "email_exists" || /already/i.test(error?.message ?? "")
      ? "يوجد حساب بهذا الرقم مسبقًا"
      : error?.message ?? "تعذّر إنشاء الحساب";
  }

  // The handle_new_user trigger created the profile row (role from
  // user_metadata); fill in the fields it doesn't set.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ phone: input.phone, department: input.department, must_change_password: true })
    .eq("id", data.user.id);
  return profileError ? `أُنشئ الحساب لكن تعذّر حفظ بياناته: ${profileError.message}` : null;
}

export async function createStaffUser(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = toAsciiDigits(String(formData.get("national_id") ?? "").trim());
  const department = String(formData.get("department") ?? "").trim() || null;
  const role = parseRole(String(formData.get("role") ?? "staff")) ?? "staff";

  if (!full_name || !phone || !password) {
    redirect(`/admin/users?error=${encodeURIComponent("الرجاء إدخال الاسم، رقم الجوال، ورقم الهوية")}`);
  }
  if (password.length < 6) {
    redirect(`/admin/users?error=${encodeURIComponent("رقم الهوية (كلمة المرور المؤقتة) قصير جدًا")}`);
  }

  const failure = await createAccount({ full_name, phone, password, role, department });
  if (failure) redirect(`/admin/users?error=${encodeURIComponent(failure)}`);

  revalidatePath("/admin/users");
  redirect(`/admin/users?created=${encodeURIComponent(full_name)}`);
}

export interface ImportResult {
  created: string[];
  skipped: { line: string; reason: string }[];
}

/**
 * One account per pasted line: name, phone, ID number (temporary password),
 * role (Arabic label or code), optional job title. Columns may be separated by
 * tabs (pasted from Word/Excel), commas, Arabic commas or "|". Called from
 * /api/admin/import-staff, not used directly as a <form action> (this needs
 * to return structured per-row results to a client component, which plain
 * server actions can only do via useFormState — unavailable on this React
 * version).
 */
export async function importStaff(formData: FormData): Promise<ImportResult> {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const lines = String(formData.get("rows") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ImportResult = { created: [], skipped: [] };

  for (const line of lines) {
    const [name = "", phoneRaw = "", idRaw = "", roleRaw = "", department = ""] = line
      .split(/\t|\||,|،/)
      .map((c) => c.trim());
    const phone = normalizePhone(phoneRaw);
    const password = toAsciiDigits(idRaw);
    const role = parseRole(roleRaw);

    let reason: string | null = null;
    if (!name || !phone || !password) reason = "ينقص الاسم أو رقم الجوال أو رقم الهوية";
    else if (!role) reason = `دور غير معروف: «${roleRaw}»`;
    else if (password.length < 6) reason = "رقم الهوية قصير جدًا";
    else reason = await createAccount({ full_name: name, phone, password, role, department: department || null });

    if (reason) result.skipped.push({ line: name || line, reason });
    else result.created.push(name);
  }

  revalidatePath("/admin/users");
  return result;
}

export async function resetLogin(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = toAsciiDigits(String(formData.get("password") ?? "").trim());

  if (!id || (!phone && !password)) {
    redirect(`/admin/users?error=${encodeURIComponent("أدخل رقم جوال جديد أو كلمة مرور جديدة")}`);
  }
  if (password && password.length < 6) {
    redirect(`/admin/users?error=${encodeURIComponent("كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل")}`);
  }

  const admin = createAdminClient();
  const email = phone ? phoneToAuthEmail(phone) : undefined;
  const { error } = await admin.auth.admin.updateUserById(id, {
    ...(email ? { email, email_confirm: true } : {}),
    ...(password ? { password } : {}),
  });
  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);

  // A password someone else set is temporary; one you set for yourself isn't.
  await admin
    .from("profiles")
    .update({
      ...(phone ? { phone, email } : {}),
      ...(password ? { must_change_password: id !== profile.id } : {}),
    })
    .eq("id", id);

  revalidatePath("/admin/users");
  redirect(`/admin/users?updated=${encodeURIComponent(name)}`);
}

export async function updateUserRole(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!id || !role) return;

  // The signed-in admin's own session (RLS: profiles_admin_all), so the
  // role-change audit trigger records who made the change.
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/users");
}

export async function toggleActive(formData: FormData) {
  const profile = await requireProfile();
  assertCanManageUsers(profile.role);

  const id = String(formData.get("id") ?? "");
  const is_active = formData.get("is_active") === "true";
  if (!id) return;
  if (id === profile.id) {
    redirect(`/admin/users?error=${encodeURIComponent("لا يمكنك إيقاف حسابك أنت")}`);
  }

  // is_active alone is only a label; the ban is what actually stops sign-in.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: is_active ? "876000h" : "none",
  });
  if (error) redirect(`/admin/users?error=${encodeURIComponent(error.message)}`);

  await admin.from("profiles").update({ is_active: !is_active }).eq("id", id);

  revalidatePath("/admin/users");
}
