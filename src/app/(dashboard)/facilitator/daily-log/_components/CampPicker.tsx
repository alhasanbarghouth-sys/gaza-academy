"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { matchesArabic, normalizeArabic } from "@/lib/arabic";
import type { Camp } from "@/types/database";

const NEW = "__new__";

/** Camp dropdown with search; a camp missing from the list can be added by name. */
export default function CampPicker({ camps, prefix = "" }: { camps: Camp[]; prefix?: string }) {
  const [value, setValue] = useState("");
  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const guard = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // The visible control is a button, so the "required" check sits on a hidden field.
  useEffect(() => {
    guard.current?.setCustomValidity(value ? "" : "اختر المخيم من القائمة");
  }, [value]);

  const filtered = camps.filter((c) => matchesArabic(c.name, q));
  const exact = camps.some((c) => normalizeArabic(c.name) === normalizeArabic(q));
  const selected = camps.find((c) => c.id === value);

  function choose(id: string, name = "") {
    setValue(id);
    if (id === NEW) setNewName(name);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={box} className="relative">
      <label className="label" htmlFor={`${prefix}camp_id`}>المخيم / الموقع</label>
      <input type="hidden" name={`${prefix}camp_id`} value={value} />
      <input ref={guard} tabIndex={-1} aria-hidden className="sr-only" defaultValue="" />
      <button
        id={`${prefix}camp_id`}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="input flex items-center justify-between gap-2 text-right"
      >
        <span className={selected || value === NEW ? "text-gray-900" : "text-gray-400"}>
          {selected ? selected.name : value === NEW ? "مخيم جديد (غير موجود بالقائمة)" : "اختر المخيم..."}
        </span>
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length === 1) choose(filtered[0].id);
              }
            }}
            placeholder="اكتب جزءاً من اسم المخيم للبحث"
            className="input mb-2 py-2"
            autoFocus
          />
          <ul className="max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-right text-sm hover:bg-gray-50 ${c.id === value ? "bg-brand-50 font-semibold text-brand-800" : ""}`}
                >
                  {c.name}
                  {!c.is_verified && <span className="mr-1 text-[11px] text-gray-400">(بانتظار التأكيد)</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-xs text-gray-400">لا يوجد مخيم بهذا الاسم.</li>}
          </ul>
          <button
            type="button"
            onClick={() => choose(NEW, exact ? "" : q.trim())}
            className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-black/5 px-2 pb-1 pt-2 text-right text-sm font-medium text-brand-700 hover:bg-brand-50/50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {q.trim() && !exact ? `إضافة «${q.trim()}» كمخيم جديد` : "مخيم غير موجود بالقائمة"}
          </button>
        </div>
      )}

      {value === NEW && (
        <input
          name={`${prefix}new_camp_name`}
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="اكتب اسم المخيم الجديد"
          className="input mt-2"
        />
      )}
    </div>
  );
}
