"use client";

import { useEffect, useState } from "react";
import { linkCampSite, searchOfficialSites } from "../actions";

export type SiteOption = { gov: string; type: string; value: string; nb: string; guess: string | null };

export default function SiteLinker({
  campId,
  suggestions,
  communities,
  govLabels,
  typeLabels,
}: {
  campId: string;
  suggestions: SiteOption[];
  communities: Record<string, string[]>;
  govLabels: Record<string, string>;
  typeLabels: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SiteOption[]>([]);
  const [chosen, setChosen] = useState<SiteOption | null>(suggestions[0] ?? null);
  const key = (s: SiteOption) => `${s.gov}||${s.type}||${s.value}`;

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => searchOfficialSites(q).then(setResults), 250);
    return () => clearTimeout(t);
  }, [q]);

  const options = [...suggestions, ...results.filter((r) => !suggestions.some((s) => key(s) === key(r)))];

  return (
    <form action={linkCampSite} className="space-y-2">
      <input type="hidden" name="id" value={campId} />
      <input type="hidden" name="site" value={chosen ? key(chosen) : ""} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث في القائمة الرسمية (عربي أو إنجليزي)"
        className="input py-1.5 text-xs"
      />
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {options.length === 0 && <p className="text-xs text-gray-400">لا مقترحات — ابحث بالاسم.</p>}
        {options.map((s) => (
          <label key={key(s)} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-xs hover:bg-gray-50">
            <input type="radio" checked={chosen ? key(chosen) === key(s) : false} onChange={() => setChosen(s)} className="mt-0.5" />
            <span>
              <span className="font-medium text-gray-900">{s.value}</span>
              <span className="block text-gray-500">
                {govLabels[s.gov]} · {typeLabels[s.type]}
                {s.nb && ` · ${s.nb}`}
              </span>
            </span>
          </label>
        ))}
      </div>
      {chosen && (
        <select key={key(chosen)} name="community" defaultValue={chosen.guess ?? ""} className="input py-1.5 text-xs">
          <option value="">المنطقة (Admin 3) — اختر</option>
          {(communities[chosen.gov] ?? []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}
      <button className="btn-primary !px-3 !py-1.5 text-xs" disabled={!chosen}>
        ربط بالموقع الرسمي
      </button>
    </form>
  );
}
