import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { ROLE_LABELS_AR, type UserRole } from "@/lib/rbac";
import { BENEFICIARY_CATEGORIES } from "@/lib/activity";

// How far back the assistant sees field activity in detail.
const ACTIVITY_DAYS = 120;
const ACTIVITY_LIMIT = 200;

type Person = { full_name: string } | null;
type SessionRow = {
  id: string;
  activity_date: string;
  created_at: string;
  project_name: string;
  activity_type: string;
  total_beneficiaries: number;
  description: string | null;
  challenges: string | null;
  gbv_encountered?: boolean;
  gbv_cases_count?: number;
  archive_entity_id?: string | null;
  camps: { name: string } | null;
  creator?: Person;
  activity_session_participants?: { profiles: Person }[];
} & Record<string, unknown>;

const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : undefined);

/**
 * Pulls a snapshot of the org's live data for the AI assistant.
 * Uses the caller's own RLS-scoped Supabase client (not the service-role
 * client) so the assistant can only ever see what that user's role is
 * already allowed to see in the rest of the app — no separate permission
 * logic to keep in sync. (Names of other staff, for instance, are only
 * readable by management.)
 */
export async function gatherAiContext(profile: Profile) {
  const supabase = await createClient();
  const since = new Date(Date.now() - ACTIVITY_DAYS * 86400000).toISOString().slice(0, 10);

  const DETAIL =
    "id, activity_date, created_at, project_name, activity_type, total_beneficiaries, description, challenges, gbv_encountered, gbv_cases_count, " +
    BENEFICIARY_CATEGORIES.map((c) => c.column).join(", ") +
    ", camps(name), creator:profiles!activity_sessions_created_by_fkey(full_name), activity_session_participants(profiles(full_name))";
  const sessionsQuery = (select: string) =>
    supabase.from("activity_sessions").select(select).gte("activity_date", since).order("activity_date", { ascending: false }).limit(ACTIVITY_LIMIT);

  const [requests, sessionsFirst, reports5w, ochaReports, financial, documents, staff, announcements] = await Promise.all([
    supabase
      .from("requests")
      .select(
        "title, request_type, status, priority, created_at, recipient_role, requester:profiles!requests_requester_id_fkey(full_name), recipient:profiles!requests_recipient_id_fkey(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    sessionsQuery(`${DETAIL}, archive_entity_id`),
    supabase.from("reports_5w").select("report_month, data").order("report_month", { ascending: false }).limit(2),
    supabase.from("reports_ocha_weekly").select("week_start, week_end, data").order("week_start", { ascending: false }).limit(2),
    supabase.from("financial_reports").select("title, period, amount, currency").order("created_at", { ascending: false }).limit(10),
    // Institutional database: what this user may see, newest first — including
    // the photos and files facilitators attach to their daily reports (07.07 / 07.09).
    supabase
      .from("archive_documents")
      .select("id, archive_number, title, document_date, category_code, doc_type, keywords, link_status")
      .order("created_at", { ascending: false })
      .limit(60),
    // Staff directory — RLS returns everyone to management, only oneself to others.
    supabase.from("profiles").select("full_name, role, department, area, is_active").order("full_name"),
    supabase.from("announcements").select("number, title, priority, sender_name, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  // Before migration 0012 there is no archive_entity_id column.
  const sessions = sessionsFirst.error ? await sessionsQuery(DETAIL) : sessionsFirst;
  const rows = (sessions.data ?? []) as unknown as SessionRow[];

  const teamOf = (s: SessionRow) =>
    Array.from(
      new Set([s.creator?.full_name, ...(s.activity_session_participants ?? []).map((p) => p.profiles?.full_name)].filter(Boolean) as string[])
    );

  const activities = rows.map((s) => {
    const categories = Object.fromEntries(
      BENEFICIARY_CATEGORIES.filter((c) => Number(s[c.column]) > 0).map((c) => [c.label, Number(s[c.column])])
    );
    return {
      التاريخ: s.activity_date,
      المشروع: s.project_name,
      النوع: s.activity_type,
      المخيم: s.camps?.name ?? null,
      الميسر_كاتب_التقرير: s.creator?.full_name ?? null,
      فريق_النشاط: teamOf(s),
      المستفيدون: s.total_beneficiaries,
      ...(Object.keys(categories).length ? { الفئات: categories } : {}),
      ...(s.gbv_encountered ? { حالات_عنف_مبني_على_النوع: s.gbv_cases_count } : {}),
      ...(s.description ? { الوصف: cut(s.description, 220) } : {}),
      ...(s.challenges ? { التحديات: cut(s.challenges, 160) } : {}),
      ...(s.archive_entity_id ? { مجلد_المرفقات: `/archive/entities/${s.archive_entity_id}` } : {}),
    };
  });

  // Totals by project and by person, so «who worked on X» or «how much did Y do» needs no counting.
  const byProject = new Map<string, { أنشطة: number; مستفيدون: number; الفريق: Set<string>; آخر_نشاط: string }>();
  const byPerson = new Map<string, { أنشطة: number; مستفيدون: number; المشاريع: Set<string>; آخر_نشاط: string }>();
  for (const s of rows) {
    const p = byProject.get(s.project_name) ?? { أنشطة: 0, مستفيدون: 0, الفريق: new Set<string>(), آخر_نشاط: s.activity_date };
    p.أنشطة++;
    p.مستفيدون += s.total_beneficiaries;
    for (const n of teamOf(s)) {
      p.الفريق.add(n);
      const f = byPerson.get(n) ?? { أنشطة: 0, مستفيدون: 0, المشاريع: new Set<string>(), آخر_نشاط: s.activity_date };
      f.أنشطة++;
      f.مستفيدون += s.total_beneficiaries;
      f.المشاريع.add(s.project_name);
      byPerson.set(n, f);
    }
    byProject.set(s.project_name, p);
  }

  return {
    currentUser: {
      name: profile.full_name,
      roleLabel: ROLE_LABELS_AR[profile.role],
      department: profile.department,
      area: profile.area,
    },
    activityWindow: `الأنشطة الميدانية منذ ${since} (حتى ${ACTIVITY_LIMIT} نشاطاً، الأحدث أولاً)`,
    activities,
    projectsSummary: Array.from(byProject, ([name, v]) => ({ المشروع: name, ...v, الفريق: Array.from(v.الفريق) })),
    facilitatorsSummary: Array.from(byPerson, ([name, v]) => ({ الاسم: name, ...v, المشاريع: Array.from(v.المشاريع) })),
    staffDirectory: ((staff.data ?? []) as { full_name: string; role: UserRole; department: string | null; area: string | null; is_active: boolean }[]).map(
      (p) => ({ الاسم: p.full_name, الدور: ROLE_LABELS_AR[p.role] ?? p.role, القسم: p.department, المنطقة: p.area, فعال: p.is_active })
    ),
    recentRequests: ((requests.data ?? []) as unknown as {
      title: string;
      request_type: string;
      status: string;
      priority: string;
      created_at: string;
      recipient_role: string | null;
      requester: Person;
      recipient: Person;
    }[]).map((r) => ({
      العنوان: r.title,
      النوع: r.request_type,
      الحالة: r.status,
      الأولوية: r.priority,
      التاريخ: r.created_at.slice(0, 10),
      المرسل: r.requester?.full_name ?? null,
      إلى: r.recipient?.full_name ?? (r.recipient_role ? ROLE_LABELS_AR[r.recipient_role as UserRole] : "الجميع"),
    })),
    announcements: announcements.data ?? [],
    latest5wReports: reports5w.data ?? [],
    latestOchaReports: ochaReports.data ?? [],
    recentFinancialReports: financial.data ?? [],
    institutionalDatabaseDocuments: (documents.data ?? []).map((d) => ({
      ...d,
      isActivityAttachment: d.category_code === "07.07" || d.category_code === "07.09",
      link: `/archive/doc/${d.id}`,
    })),
    notes: [
      "activities: كل نشاط مع الميسر الذي كتب التقرير وفريق النشاط كاملاً. للسؤال عن «من عمل في مشروع X» استخدم projectsSummary ثم activities.",
      "facilitatorsSummary: مجموع أنشطة كل شخص ومستفيديه ومشاريعه في الفترة نفسها.",
      "staffDirectory: موظفو الجمعية (يظهر كاملاً للإدارة فقط). إن ظهر اسم في الأنشطة فهو اسم حقيقي من النظام فاذكره.",
      "institutionalDatabaseDocuments: سجلات قاعدة البيانات المؤسسية المتاحة للمستخدم؛ مرفقات تقارير النشاط عناوينها تذكر النشاط والمشروع والمخيم والتاريخ. اذكر رقم الأرشفة والرابط عند السؤال عنها.",
      "إن لم تظهر أسماء الأشخاص (null) فالمستخدم الحالي ليس من الإدارة وصلاحياته لا تسمح برؤيتها؛ قل ذلك بوضوح.",
    ],
  };
}
