import { createAdminClient } from "@/lib/supabase/admin";
import { startOfMonth, format } from "date-fns";

/**
 * Aggregate-only impact numbers for the public portal. Never returns a raw
 * row — only sums/counts — even though it reads via the service-role client.
 */
export async function getPublicImpactStats() {
  const admin = createAdminClient();
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [allTime, thisMonth] = await Promise.all([
    admin.from("activity_sessions").select("total_beneficiaries, camp_id, activity_type"),
    admin
      .from("activity_sessions")
      .select("total_beneficiaries, camp_id")
      .gte("activity_date", monthStart),
  ]);

  const sum = (rows: { total_beneficiaries: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + (r.total_beneficiaries ?? 0), 0);

  const distinctCamps = (rows: { camp_id: string | null }[] | null) =>
    new Set((rows ?? []).map((r) => r.camp_id).filter(Boolean)).size;

  const distinctActivityTypes = new Set(
    (allTime.data ?? []).map((r) => r.activity_type).filter(Boolean)
  ).size;

  return {
    totalBeneficiariesAllTime: sum(allTime.data),
    totalActivitiesAllTime: allTime.data?.length ?? 0,
    campsServedAllTime: distinctCamps(allTime.data),
    activityTypesCount: distinctActivityTypes,
    beneficiariesThisMonth: sum(thisMonth.data),
    campsServedThisMonth: distinctCamps(thisMonth.data),
  };
}
