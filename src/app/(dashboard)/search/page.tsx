import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import Link from "next/link";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();

  let requests: any[] = [];
  let activities: any[] = [];
  let files: any[] = [];
  let financial: any[] = [];

  if (query.length >= 2) {
    const like = `%${query}%`;
    const [r, a, f, fin] = await Promise.all([
      supabase.from("requests").select("id, title, message, status").or(`title.ilike.${like},message.ilike.${like}`).limit(10),
      supabase
        .from("daily_activities")
        .select("id, project_name, location, description, activity_date")
        .or(`project_name.ilike.${like},location.ilike.${like},description.ilike.${like}`)
        .limit(10),
      supabase.from("files").select("id, file_name, category").ilike("file_name", like).limit(10),
      supabase.from("financial_reports").select("id, title, period").ilike("title", like).limit(10),
    ]);
    requests = r.data ?? [];
    activities = a.data ?? [];
    files = f.data ?? [];
    financial = fin.data ?? [];
  }

  const noResults =
    query.length >= 2 && !requests.length && !activities.length && !files.length && !financial.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">بحث شامل</h1>
        <p className="mt-1 text-sm text-gray-500">ابحث في الطلبات، الأنشطة، الملفات، والتقارير المالية دفعة واحدة.</p>
      </div>

      <form className="card flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="اكتب كلمة البحث..."
          className="input"
          autoFocus
        />
        <button type="submit" className="btn-primary">بحث</button>
      </form>

      {noResults && <p className="text-sm text-gray-400">لا توجد نتائج مطابقة لـ «{query}».</p>}

      {requests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">الطلبات</h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <Link key={r.id} href="/requests" className="card block text-sm hover:shadow-md">
                <p className="font-semibold">{r.title}</p>
                <p className="text-gray-500">{r.message}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {activities.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">الأنشطة الميدانية</h2>
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="card text-sm">
                <p className="font-semibold">{a.project_name} — {a.location}</p>
                <p className="text-gray-500">{a.description}</p>
                <p className="mt-1 text-xs text-gray-400">{a.activity_date}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">الملفات</h2>
          <div className="space-y-2">
            {files.map((f) => (
              <Link key={f.id} href="/files" className="card block text-sm hover:shadow-md">
                <p className="font-semibold">{f.file_name}</p>
                <p className="text-gray-500">{f.category}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {financial.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">التقارير المالية</h2>
          <div className="space-y-2">
            {financial.map((f) => (
              <Link key={f.id} href="/reports/financial" className="card block text-sm hover:shadow-md">
                <p className="font-semibold">{f.title}</p>
                <p className="text-gray-500">{f.period}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
