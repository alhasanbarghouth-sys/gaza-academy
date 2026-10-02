import { getTaxonomy } from "@/lib/archive/data";
import ArchiveNav from "./_components/ArchiveNav";

export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const { ready } = await getTaxonomy();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأرشيف المؤسسي</h1>
        <p className="mt-1 text-sm text-gray-500">
          مخزن معلومات بسمة: كل مستند يُحفظ مرة واحدة في موضعه الأصلي، ويظهر في ملفات المشاريع والجهات والفترات عبر الروابط.
        </p>
      </div>
      <ArchiveNav />
      {ready ? (
        children
      ) : (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-bold">الأرشيف غير مفعّل في قاعدة البيانات بعد.</p>
          <p className="mt-2">
            شغّل الملفين <code dir="ltr">0007_archive_roles.sql</code> ثم <code dir="ltr">0008_archive.sql</code> من
            مجلد <code dir="ltr">supabase/migrations</code> في Supabase ← SQL Editor، كلٌّ منهما وحده وبالترتيب.
          </p>
        </div>
      )}
    </div>
  );
}
