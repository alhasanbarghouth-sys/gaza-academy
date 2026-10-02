import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/archive/constants";

type PublicDoc = {
  id: string;
  archive_number: string;
  title: string;
  category_code: string;
  document_date: string;
  current_version: number;
  archive_document_versions: { id: string; version_no: number; file_name: string; file_size: number }[];
};

export const metadata = { title: "الأرشيف العام — جمعية بسمة للثقافة والفنون" };

export default async function PublicArchivePage() {
  const supabase = await createClient();
  // Explicit S0 + non-draft filter, so a signed-in staff member browsing this
  // page still sees only what the public sees.
  const [{ data: docs }, { data: cats }] = await Promise.all([
    supabase
      .from("archive_documents")
      .select("id, archive_number, title, category_code, document_date, current_version, archive_document_versions(id, version_no, file_name, file_size)")
      .eq("sensitivity", 0)
      .neq("record_status", "draft")
      .order("document_date", { ascending: false })
      .limit(300),
    supabase.from("archive_categories").select("code, name_ar, level").order("code"),
  ]);
  const list = (docs ?? []) as PublicDoc[];
  const sections = ((cats ?? []) as { code: string; name_ar: string; level: number }[]).filter((c) => c.level === 1);
  const names = new Map(((cats ?? []) as { code: string; name_ar: string }[]).map((c) => [c.code, c.name_ar]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأرشيف العام</h1>
        <p className="mt-1 text-sm text-gray-500">
          المواد المصنفة «عامة» في أرشيف الجمعية: الهوية والتأسيس، الإصدارات، البيانات الرسمية، الجوائز والاعتمادات. لا يظهر هنا أي
          مستند داخلي أو مقيّد.
        </p>
      </div>

      {list.length === 0 && <div className="card text-sm text-gray-400">لا توجد مواد عامة منشورة بعد.</div>}

      {sections.map((s) => {
        const inSection = list.filter((d) => d.category_code === s.code || d.category_code.startsWith(s.code + "."));
        if (!inSection.length) return null;
        return (
          <div key={s.code} className="card">
            <h2 className="font-bold">{s.name_ar}</h2>
            <ul className="mt-2 divide-y divide-black/5">
              {inSection.map((d) => {
                const v = d.archive_document_versions.find((x) => x.version_no === d.current_version);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold">{d.title}</p>
                      <p className="text-xs text-gray-500">
                        {names.get(d.category_code)} · {d.document_date} ·{" "}
                        <span dir="ltr" className="font-mono">{d.archive_number}</span>
                      </p>
                    </div>
                    {v && (
                      <a href={`/api/public/archive/${v.id}`} className="btn-secondary !px-3 !py-1.5 text-xs">
                        تنزيل ({formatBytes(v.file_size)})
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
