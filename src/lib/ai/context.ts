import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { ROLE_LABELS_AR } from "@/lib/rbac";

/**
 * Pulls a compact snapshot of the org's live data for the AI assistant.
 * Uses the caller's own RLS-scoped Supabase client (not the service-role
 * client) so the assistant can only ever see what that user's role is
 * already allowed to see in the rest of the app — no separate permission
 * logic to keep in sync.
 */
export async function gatherAiContext(profile: Profile) {
  const supabase = await createClient();

  const [requests, activities, reports5w, ochaReports, financial, documents] = await Promise.all([
    supabase
      .from("requests")
      .select("title, request_type, status, priority, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("activity_sessions")
      .select("project_name, activity_type, total_beneficiaries, activity_date, archive_entity_id, camps(name)")
      .order("activity_date", { ascending: false })
      .limit(20),
    supabase.from("reports_5w").select("report_month, data").order("report_month", { ascending: false }).limit(2),
    supabase
      .from("reports_ocha_weekly")
      .select("week_start, week_end, data")
      .order("week_start", { ascending: false })
      .limit(2),
    supabase
      .from("financial_reports")
      .select("title, period, amount, currency")
      .order("created_at", { ascending: false })
      .limit(10),
    // Institutional database: what this user may see, newest first — including
    // the photos and files facilitators attach to their daily reports (07.07 / 07.09).
    supabase
      .from("archive_documents")
      .select("id, archive_number, title, document_date, category_code, doc_type, keywords, link_status")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return {
    currentUser: {
      name: profile.full_name,
      role: profile.role,
      roleLabel: ROLE_LABELS_AR[profile.role],
      department: profile.department,
      area: profile.area,
    },
    recentRequests: requests.data ?? [],
    recentActivities: activities.data ?? [],
    latest5wReports: reports5w.data ?? [],
    latestOchaReports: ochaReports.data ?? [],
    recentFinancialReports: financial.data ?? [],
    institutionalDatabaseDocuments: (documents.data ?? []).map((d) => ({
      ...d,
      isActivityAttachment: d.category_code === "07.07" || d.category_code === "07.09",
      link: `/archive/doc/${d.id}`,
    })),
    note:
      "institutionalDatabaseDocuments = سجلات قاعدة البيانات المؤسسية التي يحق للمستخدم رؤيتها. مرفقات تقارير النشاط اليومي (صور/فيديو 07.07، ملفات 07.09) عناوينها تذكر نوع النشاط والمشروع والمخيم والتاريخ؛ ومجلد كل نشاط في /archive/entities/{archive_entity_id}. عند السؤال عنها اذكر رقم الأرشفة والعنوان والرابط.",
  };
}
