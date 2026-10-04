"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { markAnnouncementRead } from "../actions";

type Item = { id: string; priority: string };

const LATER_KEY = "announcements-later";

/**
 * Shows unread announcements as soon as the system opens, one at a time, until
 * each is confirmed as read. Non-urgent ones can be put off for this session.
 */
export default function AnnouncementGate({ items, memos }: { items: Item[]; memos: React.ReactNode[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let later: string[] = [];
    try {
      later = JSON.parse(sessionStorage.getItem(LATER_KEY) ?? "[]");
    } catch {}
    setQueue(items.filter((a) => a.priority === "urgent" || !later.includes(a.id)));
  }, [items]);

  const a = queue[0];
  if (!a) return null;

  async function confirm() {
    setBusy(true);
    await markAnnouncementRead(a.id);
    setBusy(false);
    setQueue((q) => q.slice(1));
    if (queue.length === 1) router.refresh();
  }

  function later() {
    try {
      const prev = JSON.parse(sessionStorage.getItem(LATER_KEY) ?? "[]");
      sessionStorage.setItem(LATER_KEY, JSON.stringify([...prev, a.id]));
    } catch {}
    setQueue((q) => q.slice(1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تعميم جديد">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-3">
        <p className="text-center text-sm font-semibold text-white">
          {queue.length > 1 ? `لديك ${queue.length} تعميمات جديدة` : "لديك تعميم جديد"}
        </p>
        <div className="min-h-0 overflow-y-auto rounded-xl shadow-2xl">{memos[items.findIndex((x) => x.id === a.id)]}</div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={confirm} disabled={busy} className="btn-primary !px-6 disabled:opacity-60">
            {busy ? "جارٍ التسجيل…" : "اطّلعت على التعميم"}
          </button>
          {a.priority !== "urgent" && (
            <button type="button" onClick={later} className="rounded-lg px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10">
              ذكّرني لاحقاً
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
