"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ArchiveLinkRule, EntityType, LinkType } from "@/types/database";
import { ENTITY_TYPE_ORDER, LINK_TYPES } from "@/lib/archive/constants";
import { DocPicker, EntityPicker, type PickedTarget } from "../../../_components/Pickers";
import { addLink } from "../../../actions";

export default function LinkEditor({
  documentId,
  missing,
  creatable,
}: {
  documentId: string;
  missing: ArchiveLinkRule[];
  creatable: EntityType[];
}) {
  const router = useRouter();
  const [linkType, setLinkType] = useState<LinkType>("belongs_to");
  const [kind, setKind] = useState<"entity" | "doc">("doc");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function link(type: LinkType, t: PickedTarget) {
    setBusy(true);
    setError("");
    const res = await addLink({
      document_id: documentId,
      link_type: type,
      target_entity_id: t.target_entity_id,
      target_document_id: t.target_document_id,
    });
    setBusy(false);
    if ("error" in res && res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {missing.map((r) => (
        <div key={r.req_key} className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
          <p className="text-sm font-semibold text-orange-900">
            ناقص: {r.label_ar}
            <span className="mr-2 text-[11px] font-normal text-gray-500">({LINK_TYPES[r.default_link_type].ar})</span>
          </p>
          {r.entity_types.length > 0 && (
            <EntityPicker types={r.entity_types} creatable={creatable} onPick={(t) => link(r.default_link_type, t)} />
          )}
          {r.categories.length > 0 && (
            <DocPicker categories={r.categories} excludeId={documentId} onPick={(t) => link(r.default_link_type, t)} />
          )}
        </div>
      ))}

      <div className="space-y-2 rounded-xl border border-dashed border-black/10 p-3">
        <p className="text-sm font-semibold">إضافة رابط</p>
        <div className="grid gap-2 sm:grid-cols-[10rem_8rem_1fr]">
          <select value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)} className="input">
            {Object.entries(LINK_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.ar}</option>
            ))}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value as "entity" | "doc")} className="input">
            <option value="doc">مستند</option>
            <option value="entity">كيان</option>
          </select>
          {kind === "entity" ? (
            <EntityPicker types={ENTITY_TYPE_ORDER} creatable={creatable} onPick={(t) => link(linkType, t)} />
          ) : (
            <DocPicker categories={[]} excludeId={documentId} onPick={(t) => link(linkType, t)} />
          )}
        </div>
      </div>
      {busy && <p className="text-xs text-gray-500">جارٍ الحفظ…</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
