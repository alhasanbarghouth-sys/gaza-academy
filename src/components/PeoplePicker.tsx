"use client";

import { useEffect, useRef, useState } from "react";

export type Person = { id: string; full_name: string; roleLabel: string; group: string };

/** Dropdown with search and checkboxes; submits one hidden `name` input per selected person. */
export default function PeoplePicker({
  people,
  name,
  initial = [],
  placeholder = "اختر من القائمة (يمكن اختيار أكثر من شخص)",
}: {
  people: Person[];
  name: string;
  initial?: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>(initial);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const filtered = people.filter((p) => p.full_name.includes(q.trim()));
  const groups = Array.from(new Set(filtered.map((p) => p.group)));
  const byId = new Map(people.map((p) => [p.id, p]));

  return (
    <div ref={box} className="relative">
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex min-h-[2.75rem] flex-wrap items-center gap-1.5 text-right"
        aria-expanded={open}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          selected.map((id) => (
            <span key={id} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800">
              {byId.get(id)?.full_name}
            </span>
          ))
        )}
        <svg className="mr-auto h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم"
            className="input mb-2 py-2"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto">
            {groups.map((g) => (
              <div key={g}>
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold text-gray-400">{g}</p>
                {filtered
                  .filter((p) => p.group === g)
                  .map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                      <span className="flex-1">{p.full_name}</span>
                      <span className="text-[11px] text-gray-400">{p.roleLabel}</span>
                    </label>
                  ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="px-2 py-3 text-xs text-gray-400">لا نتائج.</p>}
          </div>
          {selected.length > 0 && (
            <button type="button" onClick={() => setSelected([])} className="mt-2 text-xs text-gray-500 hover:text-red-600">
              مسح الاختيار
            </button>
          )}
        </div>
      )}
    </div>
  );
}
