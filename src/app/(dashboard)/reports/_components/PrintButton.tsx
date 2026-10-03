"use client";

import { Printer } from "lucide-react";
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-secondary text-xs print:hidden">
      <Printer aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      طباعة / تصدير PDF
    </button>
  );
}
