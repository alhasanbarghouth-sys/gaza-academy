import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABELS_AR } from "@/lib/rbac";
import { format } from "date-fns";
import type { Person } from "@/components/PeoplePicker";
import DailyLogForm from "./_components/DailyLogForm";
import type { UserRole } from "@/types/database";

const FIELD_ROLES: UserRole[] = ["facilitator", "volunteer"];
const EXCLUDED_ROLES: UserRole[] = ["donor", "auditor"];

export default async function DailyLogPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [camps, colleagues, mySessions] = await Promise.all([
    supabase.from("camps").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .neq("id", profile.id)
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("activity_sessions")
      .select(
        "*, camps(name), activity_session_participants(profile_id, profiles(id, full_name))"
      )
      .order("activity_date", { ascending: false })
      .limit(20),
  ]);

  // Only sessions this user actually participates in.
  const myRows = (mySessions.data ?? []).filter((s: any) =>
    s.activity_session_participants.some((p: any) => p.profile_id === profile.id)
  );

  // Every facilitator and volunteer in the system first, then the rest of the staff.
  const people: Person[] = ((colleagues.data ?? []) as { id: string; full_name: string; role: UserRole }[])
    .filter((c) => !EXCLUDED_ROLES.includes(c.role))
    .map((c) => ({
      id: c.id,
      full_name: c.full_name,
      roleLabel: ROLE_LABELS_AR[c.role],
      group: FIELD_ROLES.includes(c.role) ? "الميسرون والمتطوعون" : "باقي الطاقم",
    }))
    .sort((a, b) => (a.group === b.group ? a.full_name.localeCompare(b.full_name, "ar") : a.group === "الميسرون والمتطوعون" ? -1 : 1));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">سجل النشاط اليومي</h1>
        <p className="mt-1 text-sm text-gray-500">
          سجّل نشاطك الميداني — يُستخدم تلقائيًا في تقرير 5W الشهري وتقرير أوتشا الأسبوعي.
        </p>
      </div>

      {saved && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {Number(saved) > 1 ? `تم حفظ ${saved} تقارير بنجاح (تقرير لكل مشروع).` : "تم حفظ النشاط بنجاح."}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <DailyLogForm camps={camps.data ?? []} people={people} today={format(new Date(), "yyyy-MM-dd")} />

      <section>
        <h2 className="mb-3 text-lg font-bold">أنشطتي الأخيرة</h2>
        {myRows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-black/5 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-gray-50 text-right text-gray-500">
                  <th className="p-3 font-medium">التاريخ</th>
                  <th className="p-3 font-medium">المشروع</th>
                  <th className="p-3 font-medium">النوع</th>
                  <th className="p-3 font-medium">المخيم</th>
                  <th className="p-3 font-medium">المستفيدون</th>
                  <th className="p-3 font-medium">شارك معك</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((a: any) => (
                  <tr key={a.id} className="border-b border-black/5 last:border-0">
                    <td className="p-3">{a.activity_date}</td>
                    <td className="p-3">{a.project_name}</td>
                    <td className="p-3">{a.activity_type}</td>
                    <td className="p-3">{a.camps?.name ?? "—"}</td>
                    <td className="p-3">{a.total_beneficiaries}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {a.activity_session_participants
                        .map((p: any) => p.profiles?.full_name)
                        .filter((n: string) => n && n !== profile.full_name)
                        .join("، ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">لا توجد أنشطة مسجّلة بعد.</p>
        )}
      </section>
    </div>
  );
}
