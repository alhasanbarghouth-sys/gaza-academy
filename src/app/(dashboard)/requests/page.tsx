import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  REQUEST_PRIORITY_LABELS_AR,
  REQUEST_STATUS_LABELS_AR,
  REQUEST_TYPE_LABELS_AR,
} from "@/lib/rbac";
import RequestActions from "./_components/RequestActions";
import type { OrgRequest } from "@/types/database";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  completed: "bg-gray-200 text-gray-700",
};

function RequestCard({ req, canRespond }: { req: OrgRequest; canRespond: boolean }) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{req.title}</p>
          <p className="mt-1 text-xs text-gray-500">
            {REQUEST_TYPE_LABELS_AR[req.request_type]} · أولوية {REQUEST_PRIORITY_LABELS_AR[req.priority]} ·{" "}
            {new Date(req.created_at).toLocaleDateString("ar-EG")}
          </p>
        </div>
        <span className={`badge ${STATUS_STYLES[req.status]}`}>{REQUEST_STATUS_LABELS_AR[req.status]}</span>
      </div>
      <p className="mt-3 text-sm text-gray-700">{req.message}</p>
      {req.response_note && (
        <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
          <span className="font-semibold">الرد:</span> {req.response_note}
        </p>
      )}
      {canRespond && req.status === "pending" && <RequestActions id={req.id} />}
    </div>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [myRequests, incoming] = await Promise.all([
    supabase
      .from("requests")
      .select("*")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requests")
      .select("*")
      .neq("requester_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="mt-1 text-sm text-gray-500">تابع طلباتك والطلبات الموجّهة إليك.</p>
        </div>
        <Link href="/requests/new" className="btn-primary">
          + طلب جديد
        </Link>
      </div>

      {created && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          تم إرسال طلبك بنجاح.
        </div>
      )}

      {incoming.data && incoming.data.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">الطلبات الموجّهة إليّ</h2>
          <div className="space-y-3">
            {incoming.data.map((req) => (
              <RequestCard key={req.id} req={req as OrgRequest} canRespond />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">طلباتي</h2>
        {myRequests.data && myRequests.data.length > 0 ? (
          <div className="space-y-3">
            {myRequests.data.map((req) => (
              <RequestCard key={req.id} req={req as OrgRequest} canRespond={false} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">لم تقم بإرسال أي طلبات بعد.</p>
        )}
      </section>
    </div>
  );
}
