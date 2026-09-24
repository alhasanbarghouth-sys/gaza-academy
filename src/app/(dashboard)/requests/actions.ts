"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { RequestPriority, RequestStatus, RequestType, UserRole } from "@/types/database";

export async function createRequest(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const recipient_role = String(formData.get("recipient_role") ?? "") as UserRole;
  const request_type = String(formData.get("request_type") ?? "other") as RequestType;
  const priority = String(formData.get("priority") ?? "normal") as RequestPriority;
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!recipient_role || !title || !message) {
    redirect(`/requests/new?error=${encodeURIComponent("الرجاء تعبئة كل الحقول المطلوبة")}`);
  }

  const { error } = await supabase.from("requests").insert({
    requester_id: profile.id,
    recipient_role,
    request_type,
    priority,
    title,
    message,
  });

  if (error) {
    redirect(`/requests/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/requests");
  redirect("/requests?created=1");
}

export async function respondToRequest(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as RequestStatus;
  const response_note = String(formData.get("response_note") ?? "").trim() || null;

  if (!id || !status) return;

  await supabase
    .from("requests")
    .update({
      status,
      response_note,
      responded_by: profile.id,
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/requests");
}
