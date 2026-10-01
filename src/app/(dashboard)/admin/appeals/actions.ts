"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isManagementRole } from "@/lib/rbac";

export async function updateAppealStatus(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const review_note = String(formData.get("review_note") ?? "").trim() || null;
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase
    .from("public_appeals")
    .update({ status, review_note, reviewed_by: profile.id })
    .eq("id", id);

  revalidatePath("/admin/appeals");
}
