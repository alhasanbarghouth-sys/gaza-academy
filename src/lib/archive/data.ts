import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  ArchiveAxis,
  ArchiveCategory,
  ArchiveDocType,
  ArchiveDocument,
  ArchiveEntity,
  ArchiveLinkRule,
} from "@/types/database";

export const DOC_LIST_COLUMNS =
  "id, archive_number, title, category_code, doc_type, document_date, sensitivity, record_status, link_status, current_version, created_at";

export type DocListRow = Pick<
  ArchiveDocument,
  | "id"
  | "archive_number"
  | "title"
  | "category_code"
  | "doc_type"
  | "document_date"
  | "sensitivity"
  | "record_status"
  | "link_status"
  | "current_version"
  | "created_at"
>;

/** The classification scheme is reference data — fetched once per request. */
export const getTaxonomy = cache(async () => {
  const supabase = await createClient();
  const [axes, categories, docTypes, rules] = await Promise.all([
    supabase.from("archive_axes").select("*").order("code"),
    supabase.from("archive_categories").select("*").order("code"),
    supabase.from("archive_doc_types").select("*").order("sort"),
    supabase.from("archive_link_rules").select("*").order("doc_type").order("sort"),
  ]);
  return {
    axes: (axes.data ?? []) as ArchiveAxis[],
    categories: (categories.data ?? []) as ArchiveCategory[],
    docTypes: (docTypes.data ?? []) as ArchiveDocType[],
    rules: (rules.data ?? []) as ArchiveLinkRule[],
    ready: !categories.error && (categories.data ?? []).length > 0,
  };
});

/** Documents linked (by any link type) to any of the given entities, as the viewer is allowed to see them. */
export async function documentsLinkedToEntities(entityIds: string[]): Promise<DocListRow[]> {
  if (entityIds.length === 0) return [];
  const supabase = await createClient();
  const { data: links } = await supabase.from("archive_links").select("document_id").in("target_entity_id", entityIds);
  const ids = Array.from(new Set((links ?? []).map((l) => l.document_id as string)));
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("archive_documents")
    .select(DOC_LIST_COLUMNS)
    .in("id", ids)
    .order("document_date", { ascending: false });
  return (data ?? []) as DocListRow[];
}

export function entityLabel(e: Pick<ArchiveEntity, "code" | "name">) {
  return e.name ? `${e.code} — ${e.name}` : e.code;
}
