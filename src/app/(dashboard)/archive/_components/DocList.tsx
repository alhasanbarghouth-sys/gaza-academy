import Link from "next/link";
import type { ArchiveCategory } from "@/types/database";
import type { DocListRow } from "@/lib/archive/data";
import { LinkStatusBadge, SensitivityBadge, StatusBadge } from "./badges";

export default function DocList({
  docs,
  categories,
  empty = "لا توجد مستندات.",
}: {
  docs: DocListRow[];
  categories: ArchiveCategory[];
  empty?: string;
}) {
  if (docs.length === 0) return <p className="py-3 text-sm text-gray-400">{empty}</p>;
  const names = new Map(categories.map((c) => [c.code, c.name_ar]));

  return (
    <ul className="divide-y divide-black/5">
      {docs.map((d) => (
        <li key={d.id}>
          <Link
            href={`/archive/doc/${d.id}`}
            prefetch={false}
            className="-mx-2 block rounded-lg px-2 py-3 transition hover:bg-gray-50"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span dir="ltr" className="font-mono text-[11px] text-gray-500">
                {d.archive_number}
              </span>
              <SensitivityBadge level={d.sensitivity} />
              <StatusBadge status={d.record_status} />
              {d.link_status === "incomplete" && <LinkStatusBadge status="incomplete" />}
              {d.current_version > 1 && (
                <span className="text-[11px] text-gray-400">الإصدار {d.current_version}</span>
              )}
            </div>
            <p className="mt-1 font-semibold leading-snug text-gray-900">{d.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {d.category_code} {names.get(d.category_code)} · {d.document_date}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
