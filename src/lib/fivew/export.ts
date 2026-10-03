import { endOfMonth, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { CPAOR, findSite, reportingCycle } from "./data";
import type { TrackerRow } from "./workbook";

type Session = {
  id: string;
  activity_date: string;
  activity_type: string;
  project_name: string;
  challenges: string | null;
  camp_id: string | null;
  ben_men: number;
  ben_men_disability: number;
  ben_women: number;
  ben_women_disability: number;
  ben_boys: number;
  ben_boys_disability: number;
  ben_girls: number;
  ben_girls_disability: number;
  beneficiaries_male: number;
  beneficiaries_female: number;
  camps: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    cccm_governorate: string | null;
    cccm_site_type: string | null;
    cccm_site: string | null;
    cccm_community: string | null;
  } | null;
};

export type ExportOptions = {
  month: string; // yyyy-MM
  focalName: string;
  focalEmail: string;
  focalMobile: string;
  status: string;
  // activity type -> [pillar index, indicator index] or null
  indicators: Record<string, [number, number] | null>;
};

/**
 * One tracker row per camp and activity type for the month, which is how the
 * 5Ws is reported: totals per site and intervention, start/end dates spanning
 * the sessions. Template columns: AA Girls (incl. disability), AB of which with
 * disability, AC Boys, AD, AF Women, AG, AH Men, AI.
 */
export async function buildTrackerRows(opts: ExportOptions) {
  const supabase = await createClient();
  const from = `${opts.month}-01`;
  const to = format(endOfMonth(new Date(`${from}T00:00:00`)), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("activity_sessions")
    .select(
      "id, activity_date, activity_type, project_name, challenges, camp_id, ben_men, ben_men_disability, ben_women, ben_women_disability, ben_boys, ben_boys_disability, ben_girls, ben_girls_disability, beneficiaries_male, beneficiaries_female, camps(name, latitude, longitude, cccm_governorate, cccm_site_type, cccm_site, cccm_community)"
    )
    .gte("activity_date", from)
    .lte("activity_date", to)
    .order("activity_date");
  if (error) throw new Error(error.message);
  const sessions = (data ?? []) as unknown as Session[];

  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = `${s.camp_id ?? "none"}|${s.activity_type}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const unlinkedCamps = new Set<string>();
  const rows: TrackerRow[] = [];
  for (const list of groups.values()) {
    const first = list[0];
    const camp = first.camps;
    const sum = (k: keyof Session) => list.reduce((t, s) => t + ((s[k] as number) ?? 0), 0);
    const site = camp ? findSite(camp.cccm_governorate, camp.cccm_site_type, camp.cccm_site) : undefined;
    if (camp && !site) unlinkedCamps.add(camp.name);

    const ind = opts.indicators[first.activity_type];
    const pillar = ind ? CPAOR.pillars[ind[0]] : undefined;
    const legacy = sum("beneficiaries_male") + sum("beneficiaries_female");
    const categorised =
      sum("ben_men") + sum("ben_men_disability") + sum("ben_women") + sum("ben_women_disability") +
      sum("ben_boys") + sum("ben_boys_disability") + sum("ben_girls") + sum("ben_girls_disability");
    const projects = Array.from(new Set(list.map((s) => s.project_name))).join("، ");
    const comments = [
      `${first.activity_type} — ${list.length} نشاط`,
      projects && `المشروع: ${projects}`,
      categorised === 0 && legacy > 0 ? `أعداد قديمة غير مصنفة: ${legacy}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const challenges = Array.from(new Set(list.map((s) => s.challenges?.trim()).filter(Boolean))).join(" | ");

    rows.push({
      A: reportingCycle(opts.month),
      B: CPAOR.partner,
      E: opts.focalName,
      F: opts.focalEmail,
      G: opts.focalMobile,
      J: CPAOR.region,
      K: site?.gov,
      L: site ? camp?.cccm_community : undefined,
      M: site?.type,
      N: site?.value,
      O: site ? undefined : camp?.name ?? "غير محدد",
      P: camp?.latitude ?? site?.lat ?? undefined,
      Q: camp?.longitude ?? site?.lng ?? undefined,
      R: pillar?.label,
      S: ind && pillar ? pillar.indicators[ind[1]] : undefined,
      V: opts.status,
      W: { date: list[0].activity_date },
      X: { date: list[list.length - 1].activity_date },
      AA: sum("ben_girls") + sum("ben_girls_disability"),
      AB: sum("ben_girls_disability"),
      AC: sum("ben_boys") + sum("ben_boys_disability"),
      AD: sum("ben_boys_disability"),
      AF: sum("ben_women") + sum("ben_women_disability"),
      AG: sum("ben_women_disability"),
      AH: sum("ben_men") + sum("ben_men_disability"),
      AI: sum("ben_men_disability"),
      AK: comments,
      AL: challenges.slice(0, 2000),
    });
  }

  // Linked sites by governorate and name; camps not yet linked to the official list last.
  rows.sort(
    (a, b) =>
      Number(!a.K) - Number(!b.K) ||
      String(a.K ?? "").localeCompare(String(b.K ?? "")) ||
      String(a.N ?? a.O).localeCompare(String(b.N ?? b.O))
  );
  return { rows, sessions: sessions.length, unlinkedCamps: Array.from(unlinkedCamps) };
}
