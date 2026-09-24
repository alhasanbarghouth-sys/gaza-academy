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

  const [requests, activities, reports5w, ochaReports, financial] = await Promise.all([
    supabase
      .from("requests")
      .select("title, request_type, status, priority, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("daily_activities")
      .select("project_name, activity_type, location, total_beneficiaries, activity_date")
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
  };
}
