import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">
            ب
          </div>
          <h1 className="text-xl font-bold text-gray-900">جمعية بسمة للثقافة والفنون</h1>
          <p className="mt-1 text-sm text-gray-500">النظام المعلوماتي الموحّد</p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div>
            <label className="label" htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              placeholder="name@basma.org"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input"
              dir="ltr"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            تسجيل الدخول
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          لا يوجد إنشاء حساب ذاتي — يقوم مسؤول النظام بإنشاء الحسابات وتحديد الصلاحيات.
        </p>
      </div>
    </main>
  );
}
