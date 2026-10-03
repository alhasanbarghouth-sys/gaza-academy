import cpaor from "./cpaor.json";

/**
 * Reference lists extracted from the CP AoR 5Ws reporting template
 * (Month_Partner_Name._CPAoR_FA_Reporting_2026_2.xlsm). Values must match the
 * template's dropdowns exactly or Excel flags them as invalid.
 */
export type CpaorSite = {
  gov: string;
  type: string;
  value: string; // the dropdown value: "English name / Arabic name"
  en: string;
  ar: string;
  nb: string;
  lat: number | null;
  lng: number | null;
};

export const CPAOR = cpaor as {
  partner: string;
  region: string;
  cycles: string[];
  status: string[];
  governorates: string[];
  siteTypes: string[];
  communities: Record<string, string[]>;
  pillars: { label: string; indicators: string[] }[];
  sites: CpaorSite[];
};

export const SITE_TYPE_AR: Record<string, string> = {
  "Makeshift Site": "موقع إيواء مؤقت (خيام)",
  "Scattered Site": "موقع متفرق",
  "Collective Center_UNRWA": "مركز إيواء جماعي (أونروا)",
  "Collective Center_Non UNRWA": "مركز إيواء جماعي (غير أونروا)",
};

export const GOVERNORATE_AR: Record<string, string> = {
  "North Gaza": "شمال غزة",
  Gaza: "غزة",
  "Deir al Balah": "دير البلح",
  "Khan Yunis": "خانيونس",
  Rafah: "رفح",
};

const NOISE = /^(مخيم|موقع|مركز|مدرسة|ارض|أرض|مركز ايواء|ايواء|إيواء)\s+/;

export function normalizeAr(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const core = (s: string) => normalizeAr(s).replace(NOISE, "").trim();

function bigrams(s: string) {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/** Best official sites for a camp name (Arabic or English), most likely first. */
export function suggestSites(name: string, limit = 5): (CpaorSite & { score: number })[] {
  const q = core(name);
  if (!q) return [];
  return CPAOR.sites
    .map((s) => {
      const ar = core(s.ar);
      const en = normalizeAr(s.en);
      let score = Math.max(similarity(q, ar), similarity(q, en) * 0.9);
      if (ar && (ar.includes(q) || q.includes(ar))) score = Math.max(score, 0.85);
      return { ...s, score };
    })
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchSites(q: string, limit = 20): CpaorSite[] {
  const n = normalizeAr(q);
  if (!n) return [];
  return CPAOR.sites.filter((s) => normalizeAr(s.value).includes(n) || normalizeAr(s.nb).includes(n)).slice(0, limit);
}

export function findSite(gov: string | null, type: string | null, value: string | null) {
  return CPAOR.sites.find((s) => s.gov === gov && s.type === type && s.value === value);
}

/** The community (Admin 3) the template expects, guessed from the site's neighbourhood when it is unambiguous. */
export function guessCommunity(site: CpaorSite): string | null {
  const list = CPAOR.communities[site.gov] ?? [];
  const nb = normalizeAr(site.nb);
  const exact = list.find((c) => normalizeAr(c) === nb);
  if (exact) return exact;
  const partial = list.filter((c) => nb && (nb.includes(normalizeAr(c)) || normalizeAr(c).includes(nb)));
  return partial.length === 1 ? partial[0] : null;
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10" -> "10. October 2026" (the template's reporting-cycle dropdown value). */
export function reportingCycle(month: string) {
  const [y, m] = month.split("-").map(Number);
  const label = `${String(m).padStart(2, "0")}. ${MONTHS_EN[m - 1]} ${y}`;
  return CPAOR.cycles.find((c) => c === label) ?? label;
}

/** Default indicator per activity type; every row can be changed on the export screen. */
export const DEFAULT_INDICATOR: Record<string, { pillar: number; indicator: number } | null> = {
  "نشاط ثقافي": { pillar: 0, indicator: 0 },
  "ورشة فنية": { pillar: 0, indicator: 0 },
  "جلسة دعم نفسي اجتماعي": { pillar: 0, indicator: 0 },
  "نشاط رياضي": { pillar: 0, indicator: 0 },
  "جلسة توعية": { pillar: 2, indicator: 0 },
  "تدريب / بناء قدرات": { pillar: 3, indicator: 0 },
  "توزيع مساعدات": null,
  "زيارة ميدانية": null,
  "أخرى": null,
};
