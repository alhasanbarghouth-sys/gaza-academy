import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DOC_LIST_COLUMNS, getTaxonomy, type DocListRow } from "@/lib/archive/data";
import DocList from "./_components/DocList";

export default async function ArchiveOverviewPage() {
  const supabase = await createClient();
  const { axes, categories } = await getTaxonomy();

  const [{ data: visible }, { data: recent }, { count: incomplete }] = await Promise.all([
    supabase.from("archive_documents").select("category_code"),
    supabase.from("archive_documents").select(DOC_LIST_COLUMNS).order("created_at", { ascending: false }).limit(8),
    supabase.from("archive_documents").select("id", { count: "exact", head: true }).eq("link_status", "incomplete"),
  ]);

  const countBySection = new Map<string, number>();
  for (const d of visible ?? []) {
    const s = (d.category_code as string).split(".")[0];
    countBySection.set(s, (countBySection.get(s) ?? 0) + 1);
  }
  const sections = categories.filter((c) => c.level === 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="card !p-4 sm:!p-6">
          <p className="text-xs text-gray-500 sm:text-sm">مستندات تملك صلاحية رؤيتها</p>
          <p className="mt-2 text-3xl font-bold text-brand-700">{(visible ?? []).length}</p>
        </div>
        <Link href="/archive/incomplete" className="card !p-4 transition hover:shadow-md sm:!p-6">
          <p className="text-xs text-gray-500 sm:text-sm">روابطها الإلزامية ناقصة</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{incomplete ?? 0}</p>
        </Link>
        <div className="card col-span-2 flex flex-col justify-between gap-3 lg:col-span-1">
          <form action="/archive/search" className="flex gap-2">
            <input name="q" placeholder="رقم أرشفة، عنوان، كلمة…" className="input" />
            <button className="btn-secondary !px-3">بحث</button>
          </form>
          <Link href="/archive/new" className="btn-primary">+ إدراج مستند</Link>
        </div>
      </div>

      <div className="space-y-4">
        {axes.map((axis) => (
          <div key={axis.code} className="card">
            <h2 className="font-bold">
              <span className="ml-1 text-brand-600">{axis.letter}.</span> {axis.name_ar}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sections
                .filter((s) => s.axis_code === axis.code)
                .map((s) => (
                  <Link
                    key={s.code}
                    href={`/archive/category/${s.code}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2.5 text-sm transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span>
                      <span dir="ltr" className="ml-1 font-mono text-xs text-gray-400">{s.code}</span> {s.name_ar}
                    </span>
                    <span className="text-xs font-semibold text-gray-500">{countBySection.get(s.code) ?? 0}</span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 font-bold">آخر ما أُدرج</h2>
        <DocList docs={(recent ?? []) as DocListRow[]} categories={categories} empty="لم يُدرج أي مستند بعد." />
      </div>
    </div>
  );
}
