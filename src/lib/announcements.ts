import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS_AR, type UserRole } from "@/lib/rbac";
import type { Attachment } from "@/lib/attachments";

export type Announcement = {
  id: string;
  number: number;
  title: string;
  body: string;
  priority: "normal" | "important" | "urgent";
  audience: string[] | null;
  attachments: Attachment[];
  sender_name: string;
  sender_role: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
};

export const PRIORITY_AR: Record<Announcement["priority"], { label: string; cls: string }> = {
  urgent: { label: "عاجل", cls: "bg-red-600 text-white" },
  important: { label: "مهم", cls: "bg-amber-500 text-white" },
  normal: { label: "للعلم", cls: "bg-gray-200 text-gray-700" },
};

export function audienceLabel(audience: string[] | null) {
  return audience?.length ? audience.map((r) => ROLE_LABELS_AR[r as UserRole] ?? r).join("، ") : "جميع العاملين في الجمعية";
}

export const isLive = (a: Pick<Announcement, "is_active" | "expires_at">) =>
  a.is_active && (!a.expires_at || Date.parse(a.expires_at) > Date.now());

/** Active announcements addressed to this user that they have not confirmed reading, oldest first. */
export async function unreadAnnouncements(profile: { id: string; role: string }): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*, announcement_reads(profile_id)")
    .eq("is_active", true)
    .eq("announcement_reads.profile_id", profile.id)
    .neq("created_by", profile.id)
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) return []; // before 0015 is run
  return ((data ?? []) as (Announcement & { announcement_reads: unknown[] })[])
    .filter((a) => !a.announcement_reads?.length && isLive(a) && (!a.audience?.length || a.audience.includes(profile.role)))
    .map(({ announcement_reads: _r, ...a }) => a);
}
