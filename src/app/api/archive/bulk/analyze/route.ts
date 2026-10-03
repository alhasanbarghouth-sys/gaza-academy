import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTaxonomy } from "@/lib/archive/data";
import { classifyFile } from "@/lib/archive/classify";
import type { ArchiveEntity } from "@/types/database";

// Reading a long PDF can take a while.
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

/** Reads one queued file with the AI and stores its proposed classification. Nothing is filed here. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !UUID.test(id)) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  // RLS: only the uploader sees their queue.
  const { data: item } = await supabase.from("archive_intake_queue").select("*").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  if (item.status === "filed" || item.status === "discarded") return NextResponse.json({ status: item.status });

  await supabase.from("archive_intake_queue").update({ status: "analyzing", error: null, updated_at: new Date().toISOString() }).eq("id", id);

  const fail = async (message: string) => {
    await supabase.from("archive_intake_queue").update({ status: "error", error: message, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ status: "error", error: message });
  };

  try {
    const { categories, docTypes, rules } = await getTaxonomy();
    const [{ data: insertable }, { data: entities }] = await Promise.all([
      supabase.rpc("archive_my_insert_categories"),
      supabase
        .from("archive_entities")
        .select("id, code, entity_type, name, parent_id")
        .eq("is_active", true)
        .neq("entity_type", "beneficiary")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);
    const codes = ((insertable ?? []) as { code: string }[]).map((c) => c.code);
    if (!codes.length) return fail("لا تملك صلاحية الإدراج في أي تصنيف");

    const { data: blob, error: dlError } = await createAdminClient().storage.from("archive").download(item.storage_path);
    if (dlError || !blob) return fail("لم يُعثر على الملف في المخزن، ارفعه من جديد");

    const { suggestion, tokens } = await classifyFile(Buffer.from(await blob.arrayBuffer()), item.file_name, item.mime_type ?? "", {
      categories,
      insertable: codes,
      docTypes,
      rules,
      entities: (entities ?? []) as ArchiveEntity[],
      today: new Date().toISOString().slice(0, 10),
    });

    await supabase
      .from("archive_intake_queue")
      .update({ status: "ready", suggestion, tokens, error: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ status: "ready", suggestion, tokens });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(/503|overloaded|UNAVAILABLE/i.test(msg) ? "خدمة الذكاء الاصطناعي مشغولة الآن، أعد المحاولة بعد قليل" : msg.slice(0, 300));
  }
}
