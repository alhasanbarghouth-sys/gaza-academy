"use client";

import { useEffect, useRef, useState } from "react";
import type { ArchiveEntity, EntityType } from "@/types/database";
import { ENTITY_TYPES } from "@/lib/archive/constants";
import { createEntity, searchDocuments, searchEntities } from "../actions";

export type PickedTarget = {
  target_entity_id?: string;
  target_document_id?: string;
  display: string;
};

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ResultsBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-black/10 bg-white p-1 shadow-lg">
      {children}
    </div>
  );
}

export function EntityPicker({
  types,
  creatable,
  onPick,
  placeholder,
}: {
  types: EntityType[];
  creatable: EntityType[];
  onPick: (t: PickedTarget) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ArchiveEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<EntityType | "">("");
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState("");
  const debounced = useDebounced(q);
  const box = useRef<HTMLDivElement>(null);
  const typesKey = types.join(",");
  const canCreate = types.filter((t) => creatable.includes(t));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchEntities(debounced, typesKey ? (typesKey.split(",") as EntityType[]) : []).then((r) => {
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, typesKey]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function quickCreate() {
    const t = (newType || canCreate[0]) as EntityType;
    setError("");
    const res = await createEntity({
      entity_type: t,
      name: t === "beneficiary" ? undefined : newName,
      year: t === "period" ? Number(newYear) : undefined,
    });
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    const created = res as { id: string; code: string };
    onPick({ target_entity_id: created.id, display: t === "beneficiary" || !newName ? created.code : `${created.code} — ${newName}` });
    setCreating(false);
    setNewName("");
  }

  const createType = (newType || canCreate[0]) as EntityType | undefined;

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? `ابحث بالرمز أو الاسم (${types.map((t) => ENTITY_TYPES[t].ar).join("، ")})`}
        className="input"
      />
      {open && (
        <ResultsBox>
          {loading && <p className="px-3 py-2 text-xs text-gray-400">جارٍ البحث…</p>}
          {!loading && results.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">لا نتائج.</p>}
          {results.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => {
                onPick({ target_entity_id: e.id, display: e.name ? `${e.code} — ${e.name}` : e.code });
                setOpen(false);
                setQ("");
              }}
              className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-brand-50"
            >
              <span dir="ltr" className="font-mono text-xs text-gray-500">
                {e.code}
              </span>{" "}
              {e.name ?? ""}
              <span className="mr-2 text-[11px] text-gray-400">{ENTITY_TYPES[e.entity_type].ar}</span>
            </button>
          ))}
          {canCreate.length > 0 && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 block w-full rounded-lg border-t border-black/5 px-3 py-2 text-right text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              + إنشاء كيان جديد
            </button>
          )}
          {creating && createType && (
            <div className="mt-1 space-y-2 border-t border-black/5 p-2">
              {canCreate.length > 1 && (
                <select value={createType} onChange={(e) => setNewType(e.target.value as EntityType)} className="input py-1.5">
                  {canCreate.map((t) => (
                    <option key={t} value={t}>
                      {ENTITY_TYPES[t].ar}
                    </option>
                  ))}
                </select>
              )}
              {createType === "period" ? (
                <input value={newYear} onChange={(e) => setNewYear(e.target.value)} className="input py-1.5" dir="ltr" />
              ) : createType === "beneficiary" ? (
                <p className="text-xs text-gray-500">يُنشأ رمز مجهَّل (B-xxxx) دون أي اسم.</p>
              ) : (
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`اسم ${ENTITY_TYPES[createType].ar}`}
                  className="input py-1.5"
                />
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={quickCreate} className="btn-primary !px-3 !py-1.5 text-xs">
                  إنشاء وربط
                </button>
                <button type="button" onClick={() => setCreating(false)} className="btn-secondary !px-3 !py-1.5 text-xs">
                  إلغاء
                </button>
              </div>
            </div>
          )}
        </ResultsBox>
      )}
    </div>
  );
}

export function DocPicker({
  categories,
  onPick,
  excludeId,
}: {
  categories: string[];
  onPick: (t: PickedTarget) => void;
  excludeId?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ id: string; archive_number: string; title: string; category_code: string }[]>([]);
  const debounced = useDebounced(q);
  const box = useRef<HTMLDivElement>(null);
  const catKey = categories.join(",");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchDocuments(debounced, catKey ? catKey.split(",") : []).then((r) => {
      if (!cancelled) {
        setResults(r.filter((d) => d.id !== excludeId));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, open, catKey, excludeId]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scope = categories.filter((c) => c !== "*");

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={scope.length ? `ابحث برقم الأرشفة أو العنوان في ${scope.join("، ")}` : "ابحث برقم الأرشفة أو العنوان"}
        className="input"
      />
      {open && (
        <ResultsBox>
          {loading && <p className="px-3 py-2 text-xs text-gray-400">جارٍ البحث…</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">لا توجد مستندات مطابقة تملك صلاحية رؤيتها. يمكنك ربطها لاحقاً.</p>
          )}
          {results.map((d) => (
            <button
              type="button"
              key={d.id}
              onClick={() => {
                onPick({ target_document_id: d.id, display: `${d.archive_number} — ${d.title}` });
                setOpen(false);
                setQ("");
              }}
              className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-brand-50"
            >
              <span dir="ltr" className="block font-mono text-[11px] text-gray-500">
                {d.archive_number}
              </span>
              {d.title}
            </button>
          ))}
        </ResultsBox>
      )}
    </div>
  );
}

export function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="إزالة" className="text-brand-600 hover:text-red-600">
          ×
        </button>
      )}
    </span>
  );
}
