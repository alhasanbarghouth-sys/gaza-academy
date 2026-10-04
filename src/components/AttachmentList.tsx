import { FileText } from "lucide-react";
import type { Attachment } from "@/lib/attachments";

/** Files attached to a message or request; each opens through the permission-checked attachments route. */
export default function AttachmentList({ items, src, id }: { items?: Attachment[] | null; src: "ai" | "request" | "reply" | "announcement"; id: string }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((a, i) => (
        <li key={i}>
          <a
            href={`/api/attachments?src=${src}&id=${id}&i=${i}`}
            target="_blank"
            rel="noreferrer"
            title={a.note}
            className="inline-flex max-w-[16rem] items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-800"
          >
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate" dir="auto">{a.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
