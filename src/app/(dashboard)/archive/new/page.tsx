import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/archive/data";
import { ENTITY_CREATORS, archiveRole } from "@/lib/archive/constants";
import type { EntityType } from "@/types/database";
import IntakeForm from "./_components/IntakeForm";

export default async function NewArchiveDocumentPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { categories, docTypes, rules } = await getTaxonomy();
  const { data: insertable } = await supabase.rpc("archive_my_insert_categories");

  const role = archiveRole(profile.role);
  const creatable = (Object.keys(ENTITY_CREATORS) as EntityType[]).filter((t) => ENTITY_CREATORS[t].includes(role));

  return (
    <IntakeForm
      categories={categories}
      insertable={(insertable ?? []) as { code: string; own_scope_only: boolean }[]}
      docTypes={docTypes}
      rules={rules}
      creatable={creatable}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
