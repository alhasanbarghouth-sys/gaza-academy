import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { EVIDENCE_PACKS, archiveRole } from "./constants";
import { DOC_LIST_COLUMNS, type DocListRow } from "./data";

export async function packAccess(profile: Profile) {
  const supabase = await createClient();
  const { data: grants } = await supabase
    .from("archive_grants")
    .select("designation, valid_until")
    .eq("profile_id", profile.id)
    .is("revoked_at", null);
  const now = Date.now();
  const designations = new Set(
    ((grants ?? []) as { designation: string; valid_until: string | null }[])
      .filter((g) => !g.valid_until || new Date(g.valid_until).getTime() > now)
      .map((g) => g.designation)
  );
  const role = archiveRole(profile.role);
  return (key: string) => {
    const pack = EVIDENCE_PACKS.find((p) => p.key === key);
    return !!pack && (pack.roles.includes(role) || pack.designations.some((d) => designations.has(d)));
  };
}

/** A pack is a saved query: it is recomputed on every view, so new filings appear automatically. */
export async function loadPack(key: string) {
  const pack = EVIDENCE_PACKS.find((p) => p.key === key);
  if (!pack) return null;
  const supabase = await createClient();
  const items = await Promise.all(
    pack.items.map(async (item) => {
      if (item.mode === "count") {
        const { data } = await supabase.rpc("archive_count_documents", { p_prefixes: item.codes });
        return { ...item, docs: [] as DocListRow[], count: (data as number | null) ?? null };
      }
      const filter = item.codes.map((c) => `category_code.eq.${c},category_code.like.${c}.%`).join(",");
      const { data } = await supabase
        .from("archive_documents")
        .select(DOC_LIST_COLUMNS)
        .or(filter)
        .order("document_date", { ascending: false })
        .limit(500);
      const docs = (data ?? []) as DocListRow[];
      return { ...item, docs, count: docs.length };
    })
  );
  return { pack, items };
}
