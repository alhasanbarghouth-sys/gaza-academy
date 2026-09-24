"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isManagementRole } from "@/lib/rbac";

export async function addCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const latitude = String(formData.get("latitude") ?? "").trim();
  const longitude = String(formData.get("longitude") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    redirect(`/admin/camps?error=${encodeURIComponent("الرجاء إدخال اسم المخيم")}`);
  }

  const { error } = await supabase.from("camps").insert({
    name,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    notes,
    is_verified: true,
    created_by: profile.id,
  });

  if (error) {
    redirect(`/admin/camps?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
  redirect("/admin/camps?saved=1");
}

export async function verifyCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const latitude = String(formData.get("latitude") ?? "").trim();
  const longitude = String(formData.get("longitude") ?? "").trim();
  if (!id) return;

  await supabase
    .from("camps")
    .update({
      is_verified: true,
      ...(latitude ? { latitude: Number(latitude) } : {}),
      ...(longitude ? { longitude: Number(longitude) } : {}),
    })
    .eq("id", id);

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
}

export async function deleteCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("camps").delete().eq("id", id);

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
}
