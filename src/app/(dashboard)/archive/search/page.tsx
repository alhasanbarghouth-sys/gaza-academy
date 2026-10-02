import { createClient } from "@/lib/supabase/server";
import { DOC_LIST_COLUMNS, getTaxonomy, type DocListRow } from "@/lib/archive/data";
import { SENSITIVITY, sanitizeSearch } from "@/lib/archive/constants";
import DocList from "../_components/DocList";

export default async function ArchiveSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; entities?: string; type?: string; year?: string; sens?: string }>;
}) {
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q ?? "");
  const category = /^\d{2}(\.\d{2}){0,2}$/.test((sp.category ?? "").trim()) ? (sp.category ?? "").trim() : "";
  const codes = (sp.entities ?? "")
    .split(/[\s,،]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  const year = /^\d{4}$/.test(sp.year ?? "") ? Number(sp.year) : null;
  const sens = sp.sens !== undefined && sp.sens !== "" ? Number(sp.sens) : null;
  const hasFilter = !!(q || category || codes.length || sp.type || year || sens !== null);

  const supabase = await createClient();
  const { categories, docTypes } = await getTaxonomy();

  let results: DocListRow[] = [];
  let unknownCodes: string[] = [];

  if (hasFilter) {
    let restrictIds: string[] | null = null;
    if (codes.length) {
      const { data: ents } = await supabase.from("archive_entities").select("id, code").in("code", codes);
      const found = new Map((ents ?? []).map((e) => [e.code as string, e.id as string]));
      unknownCodes = codes.filter((c) => !found.has(c));
      // AND across entities: the document must be linked to every one of them.
      for (const entityId of Array.from(found.values())) {
        const { data: links } = await supabase.from("archive_links").select("document_id").eq("target_entity_id", entityId);
        const ids = new Set((links ?? []).map((l) => l.document_id as string));
        restrictIds = restrictIds === null ? Array.from(ids) : restrictIds.filter((id) => ids.has(id));
      }
      if (unknownCodes.length) restrictIds = [];
    }

    if (restrictIds === null || restrictIds.length > 0) {
      let query = supabase.from("archive_documents").select(DOC_LIST_COLUMNS).order("document_date", { ascending: false }).limit(200);
      if (restrictIds) query = query.in("id", restrictIds);
      if (q) query = query.ilike("search_text", `%${q}%`);
      if (category) query = query.or(`category_code.eq.${category},category_code.like.${category}.%`);
      if (sp.type) query = query.eq("doc_type", sp.type);
      if (year) query = query.gte("document_date", `${year}-01-01`).lte("document_date", `${year}-12-31`);
      if (sens !== null) query = query.eq("sensitivity", sens);
      const { data } = await query;
      results = (data ?? []) as DocListRow[];
    }
  }

  return (
    <div className="space-y-6">
      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="q">نص البحث</label>
          <input id="q" name="q" defaultValue={sp.q ?? ""} className="input" placeholder="رقم أرشفة، عنوان، كلمة مفتاحية، مصدر…" />
        </div>
        <div>
          <label className="label" htmlFor="entities">الكيانات (كلها معاً)</label>
          <input id="entities" name="entities" defaultValue={sp.entities ?? ""} className="input" dir="ltr" placeholder="P-001 D-03 T-2026" />
        </div>
        <div>
          <label className="label" htmlFor="category">التصنيف</label>
          <select id="category" name="category" defaultValue={category} className="input">
            <option value="">الكل</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {" ".repeat((c.level - 1) * 3)}
                {c.code} — {c.name_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="type">نوع المستند</label>
          <select id="type" name="type" defaultValue={sp.type ?? ""} className="input">
            <option value="">الكل</option>
            {docTypes.map((t) => (
              <option key={t.code} value={t.code}>{t.name_ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="year">سنة المستند</label>
          <input id="year" name="year" defaultValue={sp.year ?? ""} className="input" dir="ltr" placeholder="2026" />
        </div>
        <div>
          <label className="label" htmlFor="sens">الحساسية</label>
          <select id="sens" name="sens" defaultValue={sp.sens ?? ""} className="input">
            <option value="">الكل</option>
            {SENSITIVITY.map((s) => (
              <option key={s.level} value={s.level}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">بحث</button>
        </div>
      </form>

      {hasFilter && (
        <div className="card">
          <h2 className="mb-2 font-bold">النتائج ({results.length})</h2>
          {unknownCodes.length > 0 && (
            <p className="mb-2 text-sm text-red-600">رموز غير موجودة أو لا تملك صلاحية رؤيتها: {unknownCodes.join("، ")}</p>
          )}
          <DocList docs={results} categories={categories} empty="لا نتائج ضمن صلاحياتك." />
        </div>
      )}
      {!hasFilter && (
        <p className="text-sm text-gray-500">
          مثال: كل المقبوضات المالية للمشروع P-001 من المانح D-03 في 2026 ← الكيانات «P-001 D-03 T-2026» والتصنيف «04.04.02».
          تجيب الأداة من الروابط مباشرة، والنتائج مقصورة على ما تملك صلاحية رؤيته.
        </p>
      )}
    </div>
  );
}
