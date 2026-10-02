export const BENEFICIARY_CATEGORIES = [
  { column: "ben_men", label: "رجال" },
  { column: "ben_women", label: "نساء" },
  { column: "ben_men_disability", label: "رجال بإعاقة" },
  { column: "ben_women_disability", label: "نساء بإعاقة" },
  { column: "ben_boys", label: "أولاد" },
  { column: "ben_girls", label: "بنات" },
  { column: "ben_boys_disability", label: "أولاد بإعاقة" },
  { column: "ben_girls_disability", label: "بنات بإعاقة" },
] as const;

export type BeneficiaryColumn = (typeof BENEFICIARY_CATEGORIES)[number]["column"];

export type SessionCounts = Partial<Record<BeneficiaryColumn, number>> & {
  beneficiaries_male?: number;
  beneficiaries_female?: number;
  beneficiaries_children?: number;
  beneficiaries_adults?: number;
};

const n = (v: number | undefined) => v ?? 0;

/** Demographic roll-up for a set of sessions. Entries made before the eight categories existed only carry male/female/children/adults and are folded in as-is. */
export function demographics(rows: SessionCounts[]) {
  const d = {
    men: 0, women: 0, menDis: 0, womenDis: 0, boys: 0, girls: 0, boysDis: 0, girlsDis: 0,
    legacyMale: 0, legacyFemale: 0, legacyChildren: 0, legacyAdults: 0,
  };
  for (const r of rows) {
    d.men += n(r.ben_men);
    d.women += n(r.ben_women);
    d.menDis += n(r.ben_men_disability);
    d.womenDis += n(r.ben_women_disability);
    d.boys += n(r.ben_boys);
    d.girls += n(r.ben_girls);
    d.boysDis += n(r.ben_boys_disability);
    d.girlsDis += n(r.ben_girls_disability);
    d.legacyMale += n(r.beneficiaries_male);
    d.legacyFemale += n(r.beneficiaries_female);
    d.legacyChildren += n(r.beneficiaries_children);
    d.legacyAdults += n(r.beneficiaries_adults);
  }
  return d;
}
