"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isManagementRole } from "@/lib/rbac";
import { validateAttachments } from "@/lib/attachments";
import type { RequestPriority, RequestStatus, RequestType, UserRole } from "@/types/database";

const UUID = /^[0-9a-f-]{36}$/i;

function attachmentsFrom(formData: FormData) {
  return formData.getAll("attachments").flatMap((v) => {
    try {
      return [JSON.parse(String(v))];
    } catch {
      return [];
    }
  });
}

export async function createRequest(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const toAll = formData.get("recipient_role") === "__all__";
  if (toAll && !isManagementRole(profile.role)) {
    redirect(`/requests/new?error=${encodeURIComponent("الإرسال للجميع متاح للإدارة فقط")}`);
  }
  const recipient_role = (toAll ? "" : String(formData.get("recipient_role") ?? "")) as UserRole;
  const recipientIdRaw = String(formData.get("recipient_id") ?? "");
  const recipient_id = UUID.test(recipientIdRaw) ? recipientIdRaw : null;
  const request_type = String(formData.get("request_type") ?? "other") as RequestType;
  const priority = String(formData.get("priority") ?? "normal") as RequestPriority;
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if ((!recipient_role && !toAll) || !title || !message) {
    redirect(`/requests/new?error=${encodeURIComponent("الرجاء تعبئة كل الحقول المطلوبة")}`);
  }

  const attachments = await validateAttachments(attachmentsFrom(formData), profile.id);
  const row: Record<string, unknown> = toAll
    ? { requester_id: profile.id, recipient_role: null, recipient_id: null, to_all: true, request_type, priority, title, message }
    : { requester_id: profile.id, recipient_role, recipient_id, request_type, priority, title, message };
  let { error } = await supabase.from("requests").insert(attachments.length ? { ...row, attachments } : row);
  // Until 0014 is run there is no attachments column; still send the request.
  if (error && attachments.length && /attachments/.test(error.message)) ({ error } = await supabase.from("requests").insert(row));

  if (error) {
    const msg = toAll && /to_all/.test(error.message) ? "الإرسال للجميع يحتاج تشغيل الملف 0015 في Supabase" : error.message;
    redirect(`/requests/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/requests", "layout");
  redirect("/requests?tab=sent&created=1");
}

export async function respondToRequest(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as RequestStatus;
  const response_note = String(formData.get("response_note") ?? "").trim() || null;
  if (!UUID.test(id) || !status) return;

  const { error } = await supabase
    .from("requests")
    .update({
      status,
      response_note,
      responded_by: profile.id,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/requests", "layout");
  redirect(`/requests?open=${id}${error ? `&error=${encodeURIComponent(error.message)}` : ""}#r-${id}`);
}

export async function addRequestMessage(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const request_id = String(formData.get("request_id") ?? "");
  const attachments = await validateAttachments(attachmentsFrom(formData), profile.id);
  const body = String(formData.get("body") ?? "").trim() || (attachments.length ? "مرفقات" : "");
  const tab = String(formData.get("tab") ?? "inbox") === "sent" ? "sent" : "inbox";
  if (!UUID.test(request_id) || !body) return;

  const row: Record<string, unknown> = { request_id, author_id: profile.id, body };
  let { error } = await supabase.from("request_messages").insert(attachments.length ? { ...row, attachments } : row);
  if (error && attachments.length && /attachments/.test(error.message)) ({ error } = await supabase.from("request_messages").insert(row));

  revalidatePath("/requests", "layout");
  redirect(`/requests?tab=${tab}&open=${request_id}${error ? `&error=${encodeURIComponent(error.message)}` : ""}#r-${request_id}`);
}

/** Deletes a request for the current user only; the other side keeps it. */
export async function hideRequest(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const request_id = String(formData.get("request_id") ?? "");
  const tab = String(formData.get("tab") ?? "inbox") === "sent" ? "sent" : "inbox";
  if (!UUID.test(request_id)) return;

  const { error } = await supabase
    .from("request_hidden")
    .upsert({ request_id, profile_id: profile.id }, { onConflict: "request_id,profile_id", ignoreDuplicates: true });

  revalidatePath("/requests", "layout");
  redirect(`/requests?tab=${tab}&${error ? `error=${encodeURIComponent(error.message)}` : "deleted=1"}`);
}

/** Deletes one reply for the current user only. */
export async function hideRequestMessage(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const message_id = String(formData.get("message_id") ?? "");
  const request_id = String(formData.get("request_id") ?? "");
  const tab = String(formData.get("tab") ?? "inbox") === "sent" ? "sent" : "inbox";
  if (!UUID.test(message_id) || !UUID.test(request_id)) return;

  const { error } = await supabase
    .from("request_message_hidden")
    .upsert({ message_id, profile_id: profile.id }, { onConflict: "message_id,profile_id", ignoreDuplicates: true });

  revalidatePath("/requests", "layout");
  redirect(`/requests?tab=${tab}&open=${request_id}${error ? `&error=${encodeURIComponent(error.message)}` : ""}#r-${request_id}`);
}
