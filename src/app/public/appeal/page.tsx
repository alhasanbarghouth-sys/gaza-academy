import { submitAppeal } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default async function AppealPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تقديم مناشدة</h1>
        <p className="mt-1 text-sm text-gray-500">
          اكتب مناشدتك وسنحاول التواصل معك في أقرب وقت ممكن حسب الإمكانيات المتاحة.
        </p>
      </div>

      {sent && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم استلام مناشدتك. شكرًا لتواصلك معنا.
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {!sent && (
        <form action={submitAppeal} className="card space-y-5">
          {/* honeypot — hidden from real visitors via CSS, left empty */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          <div>
            <label className="label" htmlFor="full_name">الاسم الكامل</label>
            <input id="full_name" name="full_name" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">رقم للتواصل (اختياري)</label>
            <input id="phone" name="phone" className="input" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="location">المكان الحالي (اختياري)</label>
            <input id="location" name="location" className="input" placeholder="مثال: مخيم اليرموك، غزة" />
          </div>
          <div>
            <label className="label" htmlFor="message">نص المناشدة</label>
            <textarea id="message" name="message" required rows={6} className="input" />
          </div>
          <SubmitButton pendingLabel="جارٍ الإرسال...">إرسال المناشدة</SubmitButton>
        </form>
      )}
    </div>
  );
}
