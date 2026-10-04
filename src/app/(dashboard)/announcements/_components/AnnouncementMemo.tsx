import Image from "next/image";
import AttachmentList from "@/components/AttachmentList";
import { PRIORITY_AR, audienceLabel, type Announcement } from "@/lib/announcements";

function stamp(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Gaza", dateStyle: "full", timeStyle: "short" });
}

/** An announcement laid out as an official memo: letterhead, number, sender and capacity, date, addressees. */
export default function AnnouncementMemo({ a }: { a: Announcement }) {
  const p = PRIORITY_AR[a.priority];
  return (
    <article className="overflow-hidden rounded-xl border border-black/10 bg-white">
      <header className="flex items-center justify-between gap-3 border-b-4 border-brand-600 bg-gray-50 px-5 py-3">
        <Image src="/logo.webp" alt="جمعية بسمة للثقافة والفنون" width={2000} height={667} className="h-9 w-auto" />
        <div className="text-left">
          <p className="text-xs font-bold tracking-wide text-brand-700">تعميم إداري</p>
          <p className="text-[11px] text-gray-500" dir="ltr">No. {String(a.number).padStart(3, "0")}</p>
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-bold leading-snug text-gray-900">{a.title}</h2>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${p.cls}`}>{p.label}</span>
        </div>

        <dl className="grid gap-x-6 gap-y-1.5 rounded-lg bg-gray-50 px-3 py-2.5 text-xs sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold text-gray-500">من: </dt>
            <dd className="inline font-semibold text-gray-900">{a.sender_name}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-500">الصفة: </dt>
            <dd className="inline text-gray-900">{a.sender_role}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-500">التاريخ: </dt>
            <dd className="inline text-gray-900" suppressHydrationWarning>{stamp(a.created_at)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-gray-500">إلى: </dt>
            <dd className="inline text-gray-900">{audienceLabel(a.audience)}</dd>
          </div>
        </dl>

        <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{a.body}</div>
        <AttachmentList items={a.attachments} src="announcement" id={a.id} />
      </div>
    </article>
  );
}
