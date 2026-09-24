import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { inviteUser, toggleActive } from "./actions";
import RoleSelectForm from "./_components/RoleSelectForm";
import type { UserRole } from "@/types/database";

const ALL_ROLES = Object.keys(ROLE_LABELS_AR) as UserRole[];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { error, invited } = await searchParams;
  const profile = await requireProfile();
  if (!["system_admin", "executive_director"].includes(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: users } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
        <p className="mt-1 text-sm text-gray-500">
          لا يوجد إنشاء حساب ذاتي — أضف المستخدم هنا وسيصله بريد دعوة لتعيين كلمة مرور.
        </p>
      </div>

      {invited && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم إرسال دعوة بنجاح.
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <form action={inviteUser} className="card grid gap-4 sm:grid-cols-4">
        <input name="full_name" required placeholder="الاسم الكامل" className="input" />
        <input name="email" type="email" required placeholder="البريد الإلكتروني" className="input" dir="ltr" />
        <select name="role" className="input" defaultValue="staff">
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS_AR[r]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">دعوة مستخدم</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 bg-gray-50 text-right text-gray-500">
              <th className="p-3 font-medium">الاسم</th>
              <th className="p-3 font-medium">البريد</th>
              <th className="p-3 font-medium">الدور</th>
              <th className="p-3 font-medium">الحالة</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-black/5 last:border-0">
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3 text-gray-500" dir="ltr">{u.email}</td>
                <td className="p-3">
                  <RoleSelectForm userId={u.id} currentRole={u.role} roles={ALL_ROLES} />
                </td>
                <td className="p-3">
                  <span className={`badge ${u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"}`}>
                    {u.is_active ? "نشط" : "موقوف"}
                  </span>
                </td>
                <td className="p-3">
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="is_active" value={String(u.is_active)} />
                    <button className="btn-secondary text-xs">{u.is_active ? "إيقاف" : "تفعيل"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
