import PrintButton from "./PrintButton";
import { BENEFICIARY_CATEGORIES } from "@/lib/activity";

interface AggregatedData {
  period: { from: string; to: string };
  who: { project: string; beneficiaries: number }[];
  what: { type: string; count: number; beneficiaries: number }[];
  where: { location: string; beneficiaries: number }[];
  forWhom: {
    male: number;
    female: number;
    children: number;
    adults: number;
    total: number;
    withDisability?: number;
    categories?: Record<string, number>;
  };
  gbv?: { activitiesWithCases: number; cases: number; referredCases: number };
  activitiesCount: number;
}

export default function ReportView({
  title,
  data,
}: {
  title: string;
  data: AggregatedData;
}) {
  return (
    <div className="card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-xs text-gray-500">
            الفترة: {data.period.from} إلى {data.period.to} · {data.activitiesCount} نشاط مسجّل
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-500">إجمالي المستفيدين</p>
          <p className="text-2xl font-bold text-brand-700">{data.forWhom.total}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-500">ذكور / إناث</p>
          <p className="text-lg font-bold">{data.forWhom.male} / {data.forWhom.female}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-500">أطفال / بالغون</p>
          <p className="text-lg font-bold">{data.forWhom.children} / {data.forWhom.adults}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-500">عدد الأنشطة</p>
          <p className="text-2xl font-bold text-brand-700">{data.activitiesCount}</p>
        </div>
      </div>

      {data.forWhom.categories && (
        <div>
          <p className="mb-2 text-sm font-bold">فئات المستفيدين</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BENEFICIARY_CATEGORIES.map((c) => (
              <div key={c.column} className="rounded-xl border border-black/5 p-3 text-center">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-lg font-bold">{data.forWhom.categories?.[c.column] ?? 0}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            إجمالي الأشخاص ذوي الإعاقة: <span className="font-semibold">{data.forWhom.withDisability ?? 0}</span>
          </p>
        </div>
      )}

      {data.gbv && (
        <div className="rounded-xl border border-black/5 p-4">
          <p className="mb-2 text-sm font-bold">العنف المبني على النوع الاجتماعي والاستغلال/الانتهاك الجنسي</p>
          {data.gbv.cases === 0 ? (
            <p className="text-sm text-gray-600">لم تُسجَّل حالات ضمن المستفيدين في هذه الفترة.</p>
          ) : (
            <p className="text-sm text-gray-700">
              سُجّلت <span className="font-bold">{data.gbv.cases}</span> حالة في{" "}
              <span className="font-bold">{data.gbv.activitiesWithCases}</span> نشاط، أُحيل منها{" "}
              <span className="font-bold">{data.gbv.referredCases}</span> عبر مسار الإحالة. (أعداد فقط، دون بيانات تعريفية)
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-bold">من (المشاريع المنفّذة)</p>
          <ul className="space-y-1 text-sm text-gray-600">
            {data.who.map((w) => (
              <li key={w.project} className="flex justify-between border-b border-black/5 py-1">
                <span>{w.project}</span>
                <span className="font-semibold">{w.beneficiaries}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">ماذا (أنواع الأنشطة)</p>
          <ul className="space-y-1 text-sm text-gray-600">
            {data.what.map((w) => (
              <li key={w.type} className="flex justify-between border-b border-black/5 py-1">
                <span>{w.type} ({w.count})</span>
                <span className="font-semibold">{w.beneficiaries}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold">أين (المواقع)</p>
          <ul className="space-y-1 text-sm text-gray-600">
            {data.where.map((w) => (
              <li key={w.location} className="flex justify-between border-b border-black/5 py-1">
                <span>{w.location}</span>
                <span className="font-semibold">{w.beneficiaries}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
