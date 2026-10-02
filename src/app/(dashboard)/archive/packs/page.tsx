import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { EVIDENCE_PACKS } from "@/lib/archive/constants";
import { packAccess } from "@/lib/archive/packs";

export default async function PacksPage() {
  const profile = await requireProfile();
  const canOpen = await packAccess(profile);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        حزمة الأدلة استعلام محفوظ يجمع المواد المتصلة بموضوع حساس في مكان واحد جاهز للمراجعة والتصدير، ويتحدّث كلما أُدرجت مادة
        جديدة، فلا يُبحث عنه وقت الأزمة (16.06). يظهر في كل حزمة ما تملك صلاحية رؤيته فقط.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {EVIDENCE_PACKS.map((p) => {
          const allowed = canOpen(p.key);
          const body = (
            <>
              <h2 className="font-bold">{p.title}</h2>
              <p className="mt-1 text-xs text-gray-500">يستخرجها: {p.extractedBy}</p>
              <p dir="ltr" className="mt-2 text-right font-mono text-[11px] text-gray-400">
                {p.items.map((i) => i.codes.join(" ")).join(" · ")}
              </p>
              {!allowed && <p className="mt-2 text-xs font-medium text-gray-400">ليست من اختصاص دورك</p>}
            </>
          );
          return allowed ? (
            <Link key={p.key} href={`/archive/packs/${p.key}`} className="card transition hover:shadow-md">
              {body}
            </Link>
          ) : (
            <div key={p.key} className="card opacity-60">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
