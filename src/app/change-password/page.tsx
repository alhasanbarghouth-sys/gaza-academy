import { changePassword } from "./actions";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">تغيير كلمة المرور</h1>
          <p className="mt-2 text-sm text-gray-500">
            كلمة المرور المؤقتة (رقم الهوية) معروفة للجميع تقريبًا — الرجاء تعيين كلمة مرور جديدة وخاصة بك قبل
            المتابعة.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
        )}

        <form action={changePassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="new_password">كلمة المرور الجديدة</label>
            <input id="new_password" name="new_password" type="password" required minLength={8} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="confirm_password">تأكيد كلمة المرور</label>
            <input id="confirm_password" name="confirm_password" type="password" required minLength={8} className="input" dir="ltr" />
          </div>
          <button type="submit" className="btn-primary w-full">حفظ وتسجيل الدخول</button>
        </form>
      </div>
    </main>
  );
}
