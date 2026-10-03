import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedAttachmentUrl, type Attachment } from "@/lib/attachments";

const TABLES = { ai: "ai_messages", request: "requests", reply: "request_messages" } as const;
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Opens a conversation attachment. Access follows the conversation: the row is
 * read with the viewer's own permissions, so only people who can see that
 * message (or request) can open its files.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const src = url.searchParams.get("src") as keyof typeof TABLES;
  const id = url.searchParams.get("id") ?? "";
  const i = Number(url.searchParams.get("i"));
  if (!(src in TABLES) || !UUID.test(id) || !Number.isInteger(i) || i < 0) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data: row } = await supabase.from(TABLES[src]).select("attachments").eq("id", id).maybeSingle();
  const att = ((row?.attachments ?? []) as Attachment[])[i];
  if (!att) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });

  const signed = await signedAttachmentUrl(att.path, att.name);
  if (!signed) return NextResponse.json({ error: "تعذّر فتح الملف" }, { status: 404 });
  return NextResponse.redirect(signed);
}
