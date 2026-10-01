import Image from "next/image";
import { signIn } from "./actions";
import SubmitButton from "@/components/SubmitButton";

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
          <Image src="/logo.webp" alt="جمعية بسمة للثقافة والفنون" width={2000} height={667} priority className="mx-auto h-16 w-auto" />
          <p className="mt-3 text-sm text-gray-500">النظام المعلوماتي الموحّد</p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div>
            <label className="label" htmlFor="phone">رقم الجوال</label>
            <input
              id="phone"
              name="phone"
              type="text"
              autoComplete="username"
              required
              className="input"
              placeholder="05XXXXXXXX"
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
          <SubmitButton className="btn-primary w-full" pendingLabel="جارٍ تسجيل الدخول...">
            تسجيل الدخول
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          لا يوجد إنشاء حساب ذاتي — يقوم مسؤول النظام بإنشاء الحسابات. كلمة المرور المؤقتة هي رقم الهوية، وسيُطلب
          تغييرها عند أول تسجيل دخول.
        </p>
      </div>
    </main>
  );
}
