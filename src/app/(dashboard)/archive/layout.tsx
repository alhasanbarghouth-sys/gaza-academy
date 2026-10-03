import { getTaxonomy } from "@/lib/archive/data";
import { requireProfile } from "@/lib/auth";
import ArchiveNav from "./_components/ArchiveNav";

export default async function ArchiveLayout({ children }: { children: React.ReactNode }) {
  const [{ ready }, profile] = await Promise.all([getTaxonomy(), requireProfile()]);
  const canSetUp = profile.role === "system_admin" || profile.role === "executive_director";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">قاعدة البيانات المؤسسية</h1>
        <p className="mt-1 text-sm text-gray-500">
          مستندات بسمة الحية والتاريخية في مكان واحد: كل مستند يُحفظ مرة واحدة في موضعه، ويظهر في ملفات المشاريع والجهات
          والأنشطة والفترات عبر الروابط.
        </p>
      </div>
      {ready ? (
        <>
          <ArchiveNav />
          {children}
        </>
      ) : (
        <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-bold">قاعدة البيانات المؤسسية قيد التجهيز.</p>
          {canSetUp ? (
            <p className="mt-2">
              يلزم تشغيل ثلاثة ملفات مرة واحدة في Supabase ← SQL Editor، كلٌّ منها وحده وبالترتيب:{" "}
              <code dir="ltr">0007_archive_roles.sql</code> ثم <code dir="ltr">0008_archive.sql</code> ثم{" "}
              <code dir="ltr">0012_activity_attachments.sql</code> (من مجلد <code dir="ltr">supabase/migrations</code>).
            </p>
          ) : (
            <p className="mt-2">ستكون متاحة قريباً. تواصل مع إدارة النظام إن احتجت مستنداً الآن.</p>
          )}
        </div>
      )}
    </div>
  );
}
