"use server";

import { requireProfile } from "@/lib/auth";
import { registerUpload, type Attachment } from "@/lib/attachments";

/** Called after a conversation attachment reaches storage: dedupes it against the institutional database. */
export async function registerAttachment(
  input: { path: string; name: string; type: string; size: number },
  source: "ai_chat" | "request"
): Promise<Attachment | { error: string }> {
  const profile = await requireProfile();
  const res = await registerUpload(profile.id, input, source === "request" ? "request" : "ai_chat");
  if ("error" in res) return res;
  const { queue_id: _q, ...attachment } = res as Attachment & { queue_id?: string };
  return attachment;
}
