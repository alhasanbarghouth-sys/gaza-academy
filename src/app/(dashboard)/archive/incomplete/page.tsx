import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/archive/data";
import type { ArchiveDocument } from "@/types/database";
import { SensitivityBadge } from "../_components/badges";

export default async function IncompleteLinksPage() {
  const supabase = await createClient();
  const { categories } = await getTaxonomy();
  const names = new Map(categories.map((c) => [c.code, c.name_ar]));
  const { data } = await supabase
    .from("archive_documents")
    .select("id, archive_number, title, category_code, sensitivity, missing_links, document_date")
    .eq("link_status", "incomplete")
    .order("document_date", { ascending: true })
    .limit(300);
  const docs = (data ?? []) as Pick<
    ArchiveDocument,
    "id" | "archive_number" | "title" | "category_code" | "sensitivity" | "missing_links" | "document_date"
  >[];

  return (
    <div className="card">
      <h2 className="font-bold">نواقص الربط ({docs.length})</h2>
      <p className="mt-1 text-sm text-gray-500">
        مستندات أُدرجت وتنتظر روابط إلزامية تصدر عادة بعدها (كالفاتورة وسند الصرف الذي سددها). الأقدم أولاً.
      </p>
      {docs.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">لا نواقص ضمن صلاحياتك.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/5">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/archive/doc/${d.id}`} prefetch={false} className="-mx-2 block rounded-lg px-2 py-3 hover:bg-gray-50">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span dir="ltr" className="font-mono text-[11px] text-gray-500">{d.archive_number}</span>
                  <SensitivityBadge level={d.sensitivity} />
                  <span className="text-[11px] text-gray-400">{d.category_code} {names.get(d.category_code)}</span>
                </div>
                <p className="mt-1 font-semibold">{d.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.missing_links.map((m) => (
                    <span key={m.key} className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] text-orange-800">
                      {m.label}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
