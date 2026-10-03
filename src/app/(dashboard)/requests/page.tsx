import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  REQUEST_PRIORITY_LABELS_AR,
  REQUEST_STATUS_LABELS_AR,
  REQUEST_TYPE_LABELS_AR,
  ROLE_LABELS_AR,
  isManagementRole,
} from "@/lib/rbac";
import RequestActions from "./_components/RequestActions";
import { addRequestMessage } from "./actions";
import type { OrgRequest, UserRole } from "@/types/database";

type Person = { full_name: string; role: UserRole } | null;
type Message = { id: string; body: string; created_at: string; author: Person };
type Row = OrgRequest & {
  requester: Person;
  recipient: Person;
  responder: Person;
  request_messages?: Message[];
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  in_review: "bg-sky-50 text-sky-800 ring-sky-600/20",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-800 ring-red-600/20",
  completed: "bg-gray-100 text-gray-700 ring-gray-500/20",
};
const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-700",
  high: "text-orange-700",
  normal: "text-gray-500",
  low: "text-gray-400",
};

function stamp(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", {
    timeZone: "Asia/Gaza",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const who = (p: Person) => (p ? `${p.full_name} (${ROLE_LABELS_AR[p.role]})` : "—");

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; open?: string; created?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const tab: "inbox" | "sent" = sp.tab === "sent" ? "sent" : "inbox";
  const status = sp.status && sp.status in REQUEST_STATUS_LABELS_AR ? sp.status : "";
  const profile = await requireProfile();
  const supabase = await createClient();

  const PEOPLE =
    "*, requester:profiles!requests_requester_id_fkey(full_name, role), recipient:profiles!requests_recipient_id_fkey(full_name, role), responder:profiles!requests_responded_by_fkey(full_name, role)";
  const build = (select: string) => {
    let q = supabase.from("requests").select(select).order("updated_at", { ascending: false }).limit(200);
    q = tab === "sent" ? q.eq("requester_id", profile.id) : q.neq("requester_id", profile.id);
    return status ? q.eq("status", status) : q;
  };
  let res = await build(`${PEOPLE}, request_messages(id, body, created_at, author:profiles(full_name, role))`);
  // Until 0010 is run there is no reply table; still show the requests.
  if (res.error) res = await build(PEOPLE);
  const rows = (res.data ?? []) as unknown as Row[];

  const [{ count: inboxPending }, { count: sentOpen }] = await Promise.all([
    supabase.from("requests").select("id", { count: "exact", head: true }).neq("requester_id", profile.id).eq("status", "pending"),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", profile.id)
      .in("status", ["pending", "in_review"]),
  ]);

  const canRespond = tab === "inbox";
  const tabHref = (t: string, s = "") => `/requests?tab=${t}${s ? `&status=${s}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الطلبات والمراسلات</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isManagementRole(profile.role)
              ? "الطلبات الموجّهة إليك وإلى دورك، وطلباتك المرسلة. اضغط على أي طلب لعرض تفاصيله والرد عليه."
              : "طلباتك المرسلة وما يصلك من طلبات. اضغط على أي طلب لعرض تفاصيله والرد عليه."}
          </p>
        </div>
        <Link href="/requests/new" className="btn-primary">طلب جديد</Link>
      </div>

      {sp.created && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          أُرسل طلبك، وتجده في «المرسَل» مع حالته.
        </div>
      )}
      {sp.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5">
        <div className="flex gap-1">
          {[
            { key: "inbox", label: "الوارد", count: inboxPending ?? 0 },
            { key: "sent", label: "المرسَل", count: sentOpen ?? 0 },
          ].map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold ${
                tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">{t.count}</span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 pb-2 text-xs">
          <Link
            href={tabHref(tab)}
            className={`rounded-lg px-2.5 py-1 ${!status ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            الكل
          </Link>
          {Object.entries(REQUEST_STATUS_LABELS_AR).map(([k, v]) => (
            <Link
              key={k}
              href={tabHref(tab, k)}
              className={`rounded-lg px-2.5 py-1 ${status === k ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card text-sm text-gray-400">
          {tab === "inbox" ? "لا توجد طلبات واردة." : "لم ترسل أي طلبات بعد."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white">
          <div className="hidden grid-cols-[7rem_1fr_12rem_9rem_8rem] gap-3 border-b border-black/5 bg-gray-50 px-4 py-2.5 text-xs font-medium text-gray-500 md:grid">
            <span>النوع</span>
            <span>العنوان</span>
            <span>{tab === "inbox" ? "المرسل" : "موجّه إلى"}</span>
            <span>التاريخ</span>
            <span>الحالة</span>
          </div>
          {rows.map((r) => {
            const messages = (r.request_messages ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
            const target = r.recipient ? who(r.recipient) : ROLE_LABELS_AR[r.recipient_role as UserRole] ?? "—";
            return (
              <details key={r.id} id={`r-${r.id}`} open={sp.open === r.id} className="group border-b border-black/5 last:border-0">
                <summary className="grid cursor-pointer list-none grid-cols-1 gap-1 px-4 py-3 hover:bg-gray-50 md:grid-cols-[7rem_1fr_12rem_9rem_8rem] md:items-center md:gap-3">
                  <span className="text-xs font-semibold text-gray-600">{REQUEST_TYPE_LABELS_AR[r.request_type]}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{r.title}</span>
                    <span className={`text-[11px] ${PRIORITY_STYLES[r.priority]}`}>
                      أولوية {REQUEST_PRIORITY_LABELS_AR[r.priority]}
                      {messages.length > 0 && <span className="mr-2 text-gray-400">· {messages.length} رد</span>}
                    </span>
                  </span>
                  <span className="truncate text-xs text-gray-700">{tab === "inbox" ? who(r.requester) : target}</span>
                  <span className="text-xs text-gray-500">{stamp(r.created_at)}</span>
                  <span>
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLES[r.status]}`}>
                      {REQUEST_STATUS_LABELS_AR[r.status]}
                    </span>
                  </span>
                </summary>

                <div className="space-y-4 bg-gray-50/60 px-4 pb-4 pt-2">
                  <dl className="grid gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-2">
                    <div><dt className="inline font-semibold">المرسل: </dt><dd className="inline">{who(r.requester)}</dd></div>
                    <div><dt className="inline font-semibold">موجّه إلى: </dt><dd className="inline">{target}</dd></div>
                    <div><dt className="inline font-semibold">أُرسل: </dt><dd className="inline">{stamp(r.created_at)}</dd></div>
                    {r.responded_at && (
                      <div>
                        <dt className="inline font-semibold">آخر قرار: </dt>
                        <dd className="inline">{who(r.responder)} — {stamp(r.responded_at)}</dd>
                      </div>
                    )}
                  </dl>

                  <p className="whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-gray-800 ring-1 ring-black/5">{r.message}</p>

                  {r.response_note && (
                    <p className="rounded-xl bg-white p-3 text-sm text-gray-700 ring-1 ring-black/5">
                      <span className="font-semibold">ملاحظة القرار:</span> {r.response_note}
                    </p>
                  )}

                  {messages.length > 0 && (
                    <ul className="space-y-2">
                      {messages.map((m) => (
                        <li key={m.id} className="rounded-xl bg-white p-3 text-sm ring-1 ring-black/5">
                          <p className="mb-1 text-[11px] text-gray-500">{who(m.author)} · {stamp(m.created_at)}</p>
                          <p className="whitespace-pre-wrap text-gray-800">{m.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={addRequestMessage} className="flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="request_id" value={r.id} />
                    <input type="hidden" name="tab" value={tab} />
                    <textarea name="body" rows={2} required placeholder="اكتب رداً أو استفساراً…" className="input text-sm" />
                    <button className="btn-secondary shrink-0 sm:self-end">إرسال الرد</button>
                  </form>

                  {canRespond && <RequestActions id={r.id} />}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
