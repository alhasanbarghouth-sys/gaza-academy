import { SENSITIVITY, RECORD_STATUS_AR } from "@/lib/archive/constants";
import type { RecordStatus } from "@/types/database";

export function SensitivityBadge({ level, withName = false }: { level: number; withName?: boolean }) {
  const s = SENSITIVITY[level] ?? SENSITIVITY[3];
  return (
    <span
      title={`${s.code} — ${s.name}: ${s.who}`}
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${s.className}`}
    >
      {s.code}
      {withName && <span className="mr-1 font-medium">{s.name}</span>}
    </span>
  );
}

export function LinkStatusBadge({ status }: { status: "complete" | "incomplete" }) {
  return status === "complete" ? (
    <span className="inline-flex items-center rounded-md bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-500/10">
      الروابط مكتملة
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20">
      روابط ناقصة
    </span>
  );
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span className="inline-flex items-center rounded-md bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
      {RECORD_STATUS_AR[status]}
    </span>
  );
}
