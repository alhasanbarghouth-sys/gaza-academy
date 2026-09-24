import PrintButton from "./PrintButton";

interface AggregatedData {
  period: { from: string; to: string };
  who: { project: string; beneficiaries: number }[];
  what: { type: string; count: number; beneficiaries: number }[];
  where: { location: string; beneficiaries: number }[];
  forWhom: { male: number; female: number; children: number; adults: number; total: number };
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
          <p className="text-2xl font-black text-brand-700">{data.forWhom.total}</p>
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
          <p className="text-2xl font-black text-brand-700">{data.activitiesCount}</p>
        </div>
      </div>

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
