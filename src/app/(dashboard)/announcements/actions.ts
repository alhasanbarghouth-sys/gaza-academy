"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validateAttachments } from "@/lib/attachments";
import { ROLE_LABELS_AR, isManagementRole, type UserRole } from "@/lib/rbac";

const PRIORITIES = ["normal", "important", "urgent"];

export async function createAnnouncement(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) redirect("/announcements");
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");
  const everyone = formData.get("audience_all") === "on";
  const roles = formData.getAll("audience").map(String).filter((r) => r in ROLE_LABELS_AR);
  const expiresDays = Number(formData.get("expires_days") ?? 0);
  const attachments = await validateAttachments(
    formData.getAll("attachments").flatMap((v) => {
      try {
        return [JSON.parse(String(v))];
      } catch {
        return [];
      }
    }),
    profile.id
  );

  const fail = (m: string) => redirect(`/announcements?error=${encodeURIComponent(m)}`);
  if (!title || !body) fail("العنوان والنص مطلوبان");
  if (!everyone && roles.length === 0) fail("اختر الجهات الموجّه إليها التعميم، أو «الجميع»");

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    priority: PRIORITIES.includes(priority) ? priority : "normal",
    audience: everyone ? null : roles,
    attachments,
    created_by: profile.id,
    sender_name: profile.full_name,
    sender_role: ROLE_LABELS_AR[profile.role as UserRole],
    expires_at: expiresDays > 0 ? new Date(Date.now() + expiresDays * 86400000).toISOString() : null,
  });
  if (error) fail(error.message);

  revalidatePath("/", "layout");
  redirect("/announcements?created=1");
}

/** "I have read this announcement" — recorded once per person. */
export async function markAnnouncementRead(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: id, profile_id: profile.id }, { onConflict: "announcement_id,profile_id", ignoreDuplicates: true });
  revalidatePath("/", "layout");
  return error ? { error: error.message } : {};
}

export async function setAnnouncementActive(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  await supabase.from("announcements").update({ is_active: active }).eq("id", id);
  revalidatePath("/", "layout");
  redirect("/announcements");
}
