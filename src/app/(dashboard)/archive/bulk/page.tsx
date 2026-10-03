import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/archive/data";
import { ENTITY_CREATORS, archiveRole } from "@/lib/archive/constants";
import type { EntityType } from "@/types/database";
import BulkIntake, { type QueueRow } from "./_components/BulkIntake";

export const maxDuration = 60;

export default async function BulkIntakePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { categories, docTypes, rules } = await getTaxonomy();

  const [{ data: insertable }, queue, filed] = await Promise.all([
    supabase.rpc("archive_my_insert_categories"),
    supabase
      .from("archive_intake_queue")
      .select("id, file_name, file_size, mime_type, status, suggestion, error, tokens, updated_at")
      .in("status", ["uploaded", "analyzing", "ready", "error"])
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("archive_intake_queue")
      .select("id, file_name, document_id, tokens, updated_at")
      .eq("status", "filed")
      .order("updated_at", { ascending: false })
      .limit(15),
  ]);

  if (queue.error) {
    return (
      <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
        <p className="font-bold">الإدراج الذكي يحتاج تجهيزاً بسيطاً.</p>
        <p className="mt-2">
          شغّل الملف <code dir="ltr">0013_archive_bulk_intake.sql</code> في Supabase ← SQL Editor.
        </p>
      </div>
    );
  }

  const role = archiveRole(profile.role);
  const creatable = (Object.keys(ENTITY_CREATORS) as EntityType[]).filter((t) => ENTITY_CREATORS[t].includes(role));

  return (
    <div className="space-y-6">
      <BulkIntake
        categories={categories}
        insertable={((insertable ?? []) as { code: string }[]).map((i) => i.code)}
        docTypes={docTypes}
        rules={rules}
        creatable={creatable}
        responsible={profile.full_name}
        initial={(queue.data ?? []) as QueueRow[]}
        aiEnabled={!!process.env.GEMINI_API_KEY}
      />

      {(filed.data ?? []).length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-bold">آخر ما حُفظ من الإدراج الذكي</h2>
          <ul className="space-y-1 text-sm">
            {(filed.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3">
                <span className="truncate" dir="auto">{f.file_name}</span>
                {f.document_id && (
                  <Link href={`/archive/doc/${f.document_id}`} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
                    فتح السجل
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
