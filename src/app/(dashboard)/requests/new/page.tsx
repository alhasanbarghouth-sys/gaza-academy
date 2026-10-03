import { createRequest } from "../actions";
import { REQUEST_PRIORITY_LABELS_AR, REQUEST_TYPE_LABELS_AR, ROLE_LABELS_AR } from "@/lib/rbac";
import type { UserRole } from "@/types/database";
import SubmitButton from "@/components/SubmitButton";
import AttachmentPicker from "@/components/AttachmentPicker";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const RECIPIENT_ROLES: UserRole[] = [
  "executive_director",
  "project_manager",
  "coordinator",
  "accountant",
  "system_admin",
];

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("is_active", true)
    .neq("id", profile.id)
    .in("role", RECIPIENT_ROLES)
    .order("full_name");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">طلب جديد</h1>
        <p className="mt-1 text-sm text-gray-500">أرسل طلبك إلى الجهة المعنية داخل الإدارة.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <form action={createRequest} className="card space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="recipient_role">الطلب موجّه إلى</label>
            <select id="recipient_role" name="recipient_role" required className="input">
              {RECIPIENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_AR[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="request_type">نوع الطلب</label>
            <select id="request_type" name="request_type" required className="input" defaultValue="financial">
              {Object.entries(REQUEST_TYPE_LABELS_AR).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="recipient_id">شخص محدد (اختياري)</label>
          <select id="recipient_id" name="recipient_id" className="input" defaultValue="">
            <option value="">كل من يحمل الدور المختار</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} — {ROLE_LABELS_AR[p.role as UserRole]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            يصل الطلب دائماً إلى المدير التنفيذي ومسؤول النظام أيضاً، وإلى الشخص المحدد إن اخترته.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="priority">الأولوية</label>
          <select id="priority" name="priority" className="input" defaultValue="normal">
            {Object.entries(REQUEST_PRIORITY_LABELS_AR).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="title">عنوان الطلب</label>
          <input id="title" name="title" required className="input" placeholder="مثال: طلب صرف مستلزمات ورشة" />
        </div>

        <div>
          <label className="label" htmlFor="message">تفاصيل الطلب</label>
          <textarea id="message" name="message" required rows={5} className="input" placeholder="اشرح طلبك بالتفصيل..." />
        </div>

        <div>
          <p className="label">مرفقات (اختياري)</p>
          <AttachmentPicker source="request" name="attachments" />
        </div>

        <SubmitButton pendingLabel="جارٍ الإرسال...">إرسال الطلب</SubmitButton>
      </form>
    </div>
  );
}
