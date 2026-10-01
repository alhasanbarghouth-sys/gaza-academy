"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

function assertTopManagement(role: string) {
  if (!["system_admin", "executive_director"].includes(role)) throw new Error("غير مصرح");
}

export async function updateMisconductStatus(formData: FormData) {
  const profile = await requireProfile();
  assertTopManagement(profile.role);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const review_note = String(formData.get("review_note") ?? "").trim() || null;
  if (!id || !status) return;

  const supabase = await createClient();
  await supabase
    .from("misconduct_reports")
    .update({ status, review_note, reviewed_by: profile.id })
    .eq("id", id);

  revalidatePath("/admin/misconduct");
}
