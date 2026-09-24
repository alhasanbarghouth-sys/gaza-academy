"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { endOfWeek, format, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import type { DailyActivity } from "@/types/database";

function aggregate(activities: DailyActivity[]) {
  const byActivityType: Record<string, { count: number; beneficiaries: number }> = {};
  const byLocation: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  let male = 0,
    female = 0,
    children = 0,
    adults = 0;

  for (const a of activities) {
    byActivityType[a.activity_type] ??= { count: 0, beneficiaries: 0 };
    byActivityType[a.activity_type].count += 1;
    byActivityType[a.activity_type].beneficiaries += a.total_beneficiaries;

    byLocation[a.location] = (byLocation[a.location] ?? 0) + a.total_beneficiaries;
    byProject[a.project_name] = (byProject[a.project_name] ?? 0) + a.total_beneficiaries;

    male += a.beneficiaries_male;
    female += a.beneficiaries_female;
    children += a.beneficiaries_children;
    adults += a.beneficiaries_adults;
  }

  return {
    who: Object.keys(byProject).map((project) => ({ project, beneficiaries: byProject[project] })),
    what: Object.entries(byActivityType).map(([type, v]) => ({ type, ...v })),
    where: Object.entries(byLocation).map(([location, beneficiaries]) => ({ location, beneficiaries })),
    forWhom: { male, female, children, adults, total: male + female },
    activitiesCount: activities.length,
  };
}

export async function generate5WReport(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const monthInput = String(formData.get("month") ?? format(new Date(), "yyyy-MM"));
  const monthDate = new Date(`${monthInput}-01T00:00:00`);
  const from = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const to = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: activities } = await supabase
    .from("daily_activities")
    .select("*")
    .gte("activity_date", from)
    .lte("activity_date", to);

  const data = {
    ...aggregate((activities ?? []) as DailyActivity[]),
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

  const { data: activities } = await supabase
    .from("daily_activities")
    .select("*")
    .gte("activity_date", from)
    .lte("activity_date", to);

  const data = {
    ...aggregate((activities ?? []) as DailyActivity[]),
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
