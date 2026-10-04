import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS_AR, isManagementRole, type UserRole } from "@/lib/rbac";
import { PRIORITY_AR, isLive, type Announcement } from "@/lib/announcements";
import AttachmentPicker from "@/components/AttachmentPicker";
import SubmitButton from "@/components/SubmitButton";
import AnnouncementMemo from "./_components/AnnouncementMemo";
import { createAnnouncement, setAnnouncementActive } from "./actions";

function stamp(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Gaza", dateStyle: "medium", timeStyle: "short" });
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const manager = isManagementRole(profile.role);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("announcements")
    .select("*, announcement_reads(profile_id, read_at)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50 text-sm text-amber-900">
        <p className="font-bold">التعميمات تحتاج تجهيزاً بسيطاً.</p>
        <p className="mt-2">
          شغّل الملف <code dir="ltr">0015_announcements.sql</code> في Supabase ← SQL Editor.
        </p>
      </div>
    );
  }

  type Row = Announcement & { announcement_reads: { profile_id: string; read_at: string }[] };
  const rows = ((data ?? []) as Row[]).filter(
    (a) => manager || a.created_by === profile.id || !a.audience?.length || a.audience.includes(profile.role)
  );

  // Who each announcement is addressed to, for the read tracking (management only).
  const staff = manager
    ? (((await supabase.from("profiles").select("id, full_name, role").eq("is_active", true)).data ?? []) as {
        id: string;
        full_name: string;
        role: string;
      }[])
    : [];

  const roles = (Object.keys(ROLE_LABELS_AR) as UserRole[]).filter((r) => r !== "donor" && r !== "auditor");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">التعميمات</h1>
        <p className="mt-1 text-sm text-gray-500">
          التعميمات الإدارية الصادرة عن إدارة الجمعية. يظهر كل تعميم جديد لكل موظف عند فتحه النظام حتى يؤكد اطّلاعه عليه.
        </p>
      </div>

      {sp.created && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          صدر التعميم، وسيظهر لكل المعنيين فور فتحهم النظام.
        </div>
      )}
      {sp.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>}

      {manager && (
        <details className="card" open={rows.length === 0}>
          <summary className="cursor-pointer font-bold text-brand-700">+ إصدار تعميم جديد</summary>
          <form action={createAnnouncement} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="title">عنوان التعميم</label>
              <input id="title" name="title" required className="input" placeholder="مثال: مواعيد تسليم التقارير الشهرية" />
            </div>
            <div>
              <label className="label" htmlFor="body">نص التعميم</label>
              <textarea id="body" name="body" required rows={7} className="input leading-7" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="label">الأهمية</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(["normal", "important", "urgent"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2">
                      <input type="radio" name="priority" value={p} defaultChecked={p === "normal"} /> {PRIORITY_AR[p].label}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">التعميم العاجل لا يمكن تأجيله: يجب تأكيد الاطلاع عليه قبل متابعة العمل.</p>
              </fieldset>
              <div>
                <label className="label" htmlFor="expires_days">مدة الظهور</label>
                <select id="expires_days" name="expires_days" className="input" defaultValue="0">
                  <option value="0">دائم</option>
                  <option value="7">أسبوع</option>
                  <option value="30">شهر</option>
                  <option value="90">ثلاثة أشهر</option>
                </select>
              </div>
            </div>
            <fieldset>
              <legend className="label">موجّه إلى</legend>
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="audience_all" defaultChecked /> جميع العاملين في الجمعية
              </label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-700">
                {roles.map((r) => (
                  <label key={r} className="flex items-center gap-1.5">
                    <input type="checkbox" name="audience" value={r} /> {ROLE_LABELS_AR[r]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">لتوجيهه لفئات محددة: أزل علامة «جميع العاملين» واختر الأدوار.</p>
            </fieldset>
            <div>
              <p className="label">مرفقات (اختياري)</p>
              <AttachmentPicker source="announcement" name="attachments" />
            </div>
            <SubmitButton pendingLabel="جارٍ الإصدار…">إصدار التعميم</SubmitButton>
          </form>
        </details>
      )}

      {rows.length === 0 ? (
        <div className="card text-sm text-gray-400">لا توجد تعميمات.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const mine = a.announcement_reads.find((r) => r.profile_id === profile.id);
            const p = PRIORITY_AR[a.priority];
            const targets = staff.filter((s) => s.id !== a.created_by && (!a.audience?.length || a.audience.includes(s.role)));
            const readIds = new Set(a.announcement_reads.map((r) => r.profile_id));
            const notRead = targets.filter((t) => !readIds.has(t.id));
            const live = isLive(a);
            return (
              <details key={a.id} className={`card !p-0 ${live ? "" : "opacity-60"}`}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 p-4">
                  <span className="font-mono text-xs text-gray-400" dir="ltr">No. {String(a.number).padStart(3, "0")}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${p.cls}`}>{p.label}</span>
                  <span className="font-bold">{a.title}</span>
                  <span className="text-xs text-gray-500">
                    {a.sender_name} — {a.sender_role}
                  </span>
                  <span className="text-xs text-gray-400">{stamp(a.created_at)}</span>
                  <span className="mr-auto text-xs">
                    {!live ? (
                      <span className="text-gray-500">موقوف</span>
                    ) : a.created_by === profile.id ? (
                      <span className="text-gray-500">صادر عنك</span>
                    ) : mine ? (
                      <span className="text-emerald-700">اطّلعتَ عليه</span>
                    ) : (
                      <span className="font-bold text-red-600">جديد</span>
                    )}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-black/5 p-4">
                  <AnnouncementMemo a={a} />
                  {manager && (
                    <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                      <p className="font-semibold">
                        اطّلع عليه {targets.length - notRead.length} من {targets.length}
                      </p>
                      {notRead.length > 0 && (
                        <p className="mt-1 text-gray-500">لم يطّلع بعد: {notRead.map((t) => t.full_name).join("، ")}</p>
                      )}
                    </div>
                  )}
                  {(a.created_by === profile.id || profile.role === "system_admin" || profile.role === "executive_director") && (
                    <form action={setAnnouncementActive}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="active" value={a.is_active ? "0" : "1"} />
                      <button className="btn-secondary !px-3 !py-1.5 text-xs">{a.is_active ? "إيقاف التعميم" : "إعادة تفعيله"}</button>
                    </form>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
