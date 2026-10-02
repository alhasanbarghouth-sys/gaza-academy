import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DOC_LIST_COLUMNS, getTaxonomy, type DocListRow } from "@/lib/archive/data";
import { categoryPath } from "@/lib/archive/constants";
import DocList from "../../_components/DocList";
import { SensitivityBadge } from "../../_components/badges";

export default async function ArchiveCategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { categories, axes } = await getTaxonomy();
  const category = categories.find((c) => c.code === code);
  if (!category) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("archive_documents")
    .select(DOC_LIST_COLUMNS)
    .or(`category_code.eq.${code},category_code.like.${code}.%`)
    .order("document_date", { ascending: false })
    .limit(200);

  const children = categories.filter((c) => c.parent_code === code);
  const path = categoryPath(code, categories);
  const axis = axes.find((a) => a.code === category.axis_code);

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-xs text-gray-500">
          {axis && `المحور ${axis.letter}: ${axis.name_ar}`}
          {path.slice(0, -1).map((c) => (
            <span key={c.code}>
              {" ← "}
              <Link href={`/archive/category/${c.code}`} className="hover:underline">{c.name_ar}</Link>
            </span>
          ))}
        </p>
        <h2 className="mt-1 text-xl font-bold">
          <span dir="ltr" className="ml-2 font-mono text-base text-gray-400">{category.code}</span>
          {category.name_ar}
        </h2>
        {category.materials_ar && <p className="mt-2 text-sm text-gray-600">{category.materials_ar}</p>}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          {category.default_sensitivity !== null && (
            <span className="flex items-center gap-1">
              الحساسية الافتراضية <SensitivityBadge level={category.default_sensitivity} />
            </span>
          )}
          {category.related_ar && <span>الروابط: {category.related_ar}</span>}
          {category.retention_note_ar && <span>الاحتفاظ: {category.retention_note_ar}</span>}
          {category.original_item_no && <span>رقمه في تعريف المشروع: {category.original_item_no}</span>}
          {category.placement_note_ar && <span>سبب الموضع: {category.placement_note_ar}</span>}
        </div>
      </div>

      {children.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((c) => (
            <Link
              key={c.code}
              href={`/archive/category/${c.code}`}
              className="flex items-start justify-between gap-2 rounded-xl border border-black/5 bg-white px-3 py-2.5 text-sm transition hover:border-brand-200"
            >
              <span>
                <span dir="ltr" className="ml-1 font-mono text-xs text-gray-400">{c.code}</span> {c.name_ar}
              </span>
              {c.default_sensitivity !== null && <SensitivityBadge level={c.default_sensitivity} />}
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h3 className="mb-2 font-bold">المستندات</h3>
        <DocList docs={(data ?? []) as DocListRow[]} categories={categories} empty="لا توجد مستندات تملك صلاحية رؤيتها هنا." />
      </div>
    </div>
  );
}
