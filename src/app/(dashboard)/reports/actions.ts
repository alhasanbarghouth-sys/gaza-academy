"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { endOfWeek, format, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import type { ActivitySession } from "@/types/database";
import { BENEFICIARY_CATEGORIES, demographics } from "@/lib/activity";

type SessionWithCamp = ActivitySession & { camps: { name: string } | null };

// Each row here is already one real-world session (see 0002 migration) — no
// matter how many staff participated in it, its beneficiary count is only
// entered once, so summing rows can never double-count the same people.
function aggregate(sessions: SessionWithCamp[]) {
  const byActivityType: Record<string, { count: number; beneficiaries: number }> = {};
  const byCamp: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  let gbvSessions = 0,
    gbvCases = 0,
    gbvReferred = 0;

  for (const s of sessions) {
    byActivityType[s.activity_type] ??= { count: 0, beneficiaries: 0 };
    byActivityType[s.activity_type].count += 1;
    byActivityType[s.activity_type].beneficiaries += s.total_beneficiaries;

    const campName = s.camps?.name ?? "غير محدد";
    byCamp[campName] = (byCamp[campName] ?? 0) + s.total_beneficiaries;
    byProject[s.project_name] = (byProject[s.project_name] ?? 0) + s.total_beneficiaries;

    if (s.gbv_encountered) {
      gbvSessions += 1;
      gbvCases += s.gbv_cases_count;
      if (s.gbv_referred) gbvReferred += s.gbv_cases_count;
    }
  }

  const d = demographics(sessions);
  const categories = Object.fromEntries(
    BENEFICIARY_CATEGORIES.map((c) => [
      c.column,
      sessions.reduce((sum, s) => sum + (s[c.column] ?? 0), 0),
    ])
  );
  const male = d.men + d.menDis + d.boys + d.boysDis + d.legacyMale;
  const female = d.women + d.womenDis + d.girls + d.girlsDis + d.legacyFemale;
  const children = d.boys + d.boysDis + d.girls + d.girlsDis + d.legacyChildren;
  const adults = d.men + d.menDis + d.women + d.womenDis + d.legacyAdults;
  const withDisability = d.menDis + d.womenDis + d.boysDis + d.girlsDis;

  return {
    who: Object.keys(byProject).map((project) => ({ project, beneficiaries: byProject[project] })),
    what: Object.entries(byActivityType).map(([type, v]) => ({ type, ...v })),
    where: Object.entries(byCamp).map(([location, beneficiaries]) => ({ location, beneficiaries })),
    forWhom: { male, female, children, adults, total: male + female, withDisability, categories },
    gbv: { activitiesWithCases: gbvSessions, cases: gbvCases, referredCases: gbvReferred },
    activitiesCount: sessions.length,
  };
}

export async function generate5WReport(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const monthInput = String(formData.get("month") ?? format(new Date(), "yyyy-MM"));
  const monthDate = new Date(`${monthInput}-01T00:00:00`);
  const from = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const to = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: sessions } = await supabase
    .from("activity_sessions")
    .select("*, camps(name)")
    .gte("activity_date", from)
    .lte("activity_date", to);

  const data = {
    ...aggregate((sessions ?? []) as SessionWithCamp[]),
    period: { from, to },
  };

  await supabase.from("reports_5w").upsert(
    {
      report_month: from,
      generated_by: profile.id,
      data,
      status: "draft",
    },
    { onConflict: "report_month" }
  );

  revalidatePath("/reports");
}

export async function generateOchaWeeklyReport(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const weekInput = String(formData.get("week_start") ?? format(new Date(), "yyyy-MM-dd"));
  const anchor = new Date(`${weekInput}T00:00:00`);
  const from = format(startOfWeek(anchor, { weekStartsOn: 6 }), "yyyy-MM-dd");
  const to = format(endOfWeek(anchor, { weekStartsOn: 6 }), "yyyy-MM-dd");

  const { data: sessions } = await supabase
    .from("activity_sessions")
    .select("*, camps(name)")
    .gte("activity_date", from)
    .lte("activity_date", to);

  const data = {
    ...aggregate((sessions ?? []) as SessionWithCamp[]),
    period: { from, to },
  };

  await supabase.from("reports_ocha_weekly").upsert(
    {
      week_start: from,
      week_end: to,
      generated_by: profile.id,
      data,
      status: "draft",
    },
    { onConflict: "week_start" }
  );

  revalidatePath("/reports");
}
