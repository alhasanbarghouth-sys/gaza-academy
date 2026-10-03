"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Attachment } from "@/lib/attachments";

export type ConversationSummary = { id: string; title: string; updated_at: string };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; attachments: Attachment[]; created_at: string };

/** The user's saved conversations with the assistant, most recent first (RLS: own only). */
export async function listConversations(): Promise<ConversationSummary[]> {
  await requireProfile();
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    // Before 0014: no updated_at column.
    const res = await supabase.from("ai_conversations").select("id, title, created_at").order("created_at", { ascending: false }).limit(100);
    data = (res.data ?? []).map((c) => ({ id: c.id, title: c.title, updated_at: c.created_at }));
  }
  return (data ?? []) as ConversationSummary[];
}

export async function loadConversation(id: string): Promise<ChatMessage[]> {
  await requireProfile();
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    const res = await supabase.from("ai_messages").select("id, role, content, created_at").eq("conversation_id", id).order("created_at", { ascending: true });
    data = (res.data ?? []).map((m) => ({ ...m, attachments: [] }));
  }
  return ((data ?? []) as ChatMessage[]).map((m) => ({ ...m, attachments: m.attachments ?? [] }));
}

export async function deleteConversation(id: string): Promise<{ error?: string }> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
