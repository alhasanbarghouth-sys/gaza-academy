import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { uploadFile } from "./actions";

const CATEGORIES = ["عقود", "سياسات", "نماذج", "صور", "تقارير", "أخرى"];

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  await requireProfile();
  const supabase = await createClient();

  const { data: files } = await supabase.from("files").select("*").order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data } = await supabase.storage.from("org-files").createSignedUrl(f.file_url, 3600);
      return { ...f, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">مركز الملفات</h1>
        <p className="mt-1 text-sm text-gray-500">جميع المستندات والملفات المهمة للجمعية في مكان واحد.</p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">تم رفع الملف بنجاح.</div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form action={uploadFile} className="card flex flex-wrap items-end gap-4" encType="multipart/form-data">
        <div>
          <label className="label" htmlFor="category">التصنيف</label>
          <select id="category" name="category" className="input">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="file">الملف</label>
          <input id="file" name="file" type="file" required className="input" />
        </div>
        <button type="submit" className="btn-primary">رفع الملف</button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withUrls.length > 0 ? (
          withUrls.map((f) => (
            <a
              key={f.id}
              href={f.signedUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="card block transition hover:shadow-md"
            >
              <p className="badge mb-2 bg-brand-50 text-brand-700">{f.category}</p>
              <p className="truncate font-semibold">{f.file_name}</p>
              <p className="mt-1 text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString("ar-EG")}</p>
            </a>
          ))
        ) : (
          <p className="text-sm text-gray-400">لا توجد ملفات بعد.</p>
        )}
      </div>
    </div>
  );
}
