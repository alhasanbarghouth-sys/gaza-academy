import { Megaphone, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { getPublicImpactStats } from "@/lib/public/stats";

// No cookies/searchParams on this page to signal per-request rendering on
// their own, so Next.js would otherwise bake these stats in once at build
// time and never update them again.
export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <p className="text-3xl font-bold text-brand-700">{value.toLocaleString("ar-EG")}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

export default async function PublicHomePage() {
  const stats = await getPublicImpactStats();

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">جمعية بسمة للثقافة والفنون</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
          نعمل في المخيمات والمواقع المتضررة لتقديم أنشطة ثقافية وفنية ودعم نفسي اجتماعي للأطفال والعائلات.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="مستفيدون هذا الشهر" value={stats.beneficiariesThisMonth} />
        <Stat label="مواقع نُفّذت فيها أنشطة هذا الشهر" value={stats.campsServedThisMonth} />
        <Stat label="إجمالي المستفيدين" value={stats.totalBeneficiariesAllTime} />
        <Stat label="إجمالي الأنشطة المنفّذة" value={stats.totalActivitiesAllTime} />
        <Stat label="مواقع وصلتها الجمعية" value={stats.campsServedAllTime} />
        <Stat label="أنواع الأنشطة المقدَّمة" value={stats.activityTypesCount} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/public/appeal" className="card block text-center transition hover:shadow-md">
          <Megaphone aria-hidden className="mx-auto mb-2 h-6 w-6 text-brand-700" strokeWidth={1.75} />
          <p className="text-base font-bold">تقديم مناشدة</p>
          <p className="mt-1 text-sm text-gray-500">هل تحتاج مساعدة؟ أرسل مناشدتك وسيتواصل معك فريقنا.</p>
        </Link>
        <Link href="/public/report" className="card block text-center transition hover:shadow-md">
          <ShieldAlert aria-hidden className="mx-auto mb-2 h-6 w-6 text-brand-700" strokeWidth={1.75} />
          <p className="text-base font-bold">الإبلاغ عن إساءة</p>
          <p className="mt-1 text-sm text-gray-500">بلاغ سري يصل مباشرة للإدارة العليا فقط. يمكن إرساله دون ذكر اسمك.</p>
        </Link>
        <Link href="/public/ai" className="card block text-center transition hover:shadow-md">
          <Sparkles aria-hidden className="mx-auto mb-2 h-6 w-6 text-brand-700" strokeWidth={1.75} />
          <p className="text-base font-bold">المساعد الذكي</p>
          <p className="mt-1 text-sm text-gray-500">اسأل عن عمل الجمعية وأنشطتها.</p>
        </Link>
      </div>
    </div>
  );
}
