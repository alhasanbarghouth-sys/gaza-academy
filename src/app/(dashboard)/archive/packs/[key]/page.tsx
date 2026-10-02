import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getTaxonomy } from "@/lib/archive/data";
import { loadPack, packAccess } from "@/lib/archive/packs";
import DocList from "../../_components/DocList";

export default async function PackPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const profile = await requireProfile();
  if (!(await packAccess(profile))(key)) redirect("/archive/packs");
  const loaded = await loadPack(key);
  if (!loaded) notFound();
  const { categories } = await getTaxonomy();
  const names = new Map(categories.map((c) => [c.code, c.name_ar]));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{loaded.pack.title}</h2>
          <p className="text-xs text-gray-500">يستخرجها: {loaded.pack.extractedBy}</p>
        </div>
        <a href={`/api/archive/packs/${key}`} className="btn-secondary">تصدير الفهرس (CSV)</a>
      </div>
      {loaded.items.map((item, i) => (
        <div key={i} className="card">
          <h3 className="font-bold">
            {item.codes.map((c) => `${c} ${names.get(c) ?? ""}`).join(" · ")}
            {item.note && <span className="mr-2 text-xs font-normal text-gray-500">({item.note})</span>}
          </h3>
          {item.mode === "count" ? (
            <p className="mt-2 text-sm text-gray-700">
              {item.count === null ? "غير متاح لدورك" : `${item.count} سجل`}{" "}
              <span className="text-xs text-gray-400">— إحصاء فقط، دون عناوين أو أسماء</span>
            </p>
          ) : (
            <DocList docs={item.docs} categories={categories} empty="لا مواد ضمن صلاحياتك." />
          )}
        </div>
      ))}
    </div>
  );
}
