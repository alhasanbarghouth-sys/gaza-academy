import { submitMisconductReport } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الإبلاغ عن إساءة</h1>
        <p className="mt-1 text-sm text-gray-500">
          هذا البلاغ يصل مباشرة إلى الإدارة العليا فقط (المدير التنفيذي / مسؤول النظام) — لا يطّلع عليه أي موظف
          آخر. يمكنك تعبئة هذا النموذج دون ذكر اسمك إطلاقًا إن كنت تفضّل ذلك.
        </p>
      </div>

      {sent && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم استلام بلاغك وسيتم التعامل معه بسرية.
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {!sent && (
        <form action={submitMisconductReport} className="card space-y-5">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          <div>
            <label className="label" htmlFor="incident_description">ماذا حدث؟</label>
            <textarea id="incident_description" name="incident_description" required rows={6} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="accused_name">اسم الشخص المعني (إن عرفته، اختياري)</label>
            <input id="accused_name" name="accused_name" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="incident_location">أين حدث ذلك؟ (اختياري)</label>
            <input id="incident_location" name="incident_location" className="input" />
          </div>

          <div className="border-t border-black/5 pt-4">
            <p className="mb-3 text-xs text-gray-400">
              التواصل التالي اختياري بالكامل — اتركه فارغًا إن أردت الإبلاغ دون الكشف عن هويتك.
            </p>
            <div>
              <label className="label" htmlFor="reporter_name">اسمك (اختياري)</label>
              <input id="reporter_name" name="reporter_name" className="input" />
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="reporter_contact">رقم أو بريد للتواصل (اختياري)</label>
              <input id="reporter_contact" name="reporter_contact" className="input" dir="ltr" />
            </div>
          </div>

          <SubmitButton pendingLabel="جارٍ الإرسال...">إرسال البلاغ</SubmitButton>
        </form>
      )}
    </div>
  );
}
