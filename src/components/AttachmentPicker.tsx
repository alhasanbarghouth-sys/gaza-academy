"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, Paperclip, X } from "lucide-react";
import { uploadToArchive } from "@/app/(dashboard)/archive/_components/upload";
import { registerAttachment } from "@/app/(dashboard)/_actions/attachments";
import type { Attachment } from "@/lib/attachments";

const MAX_BYTES = 50 * 1024 * 1024;

type Item = { key: number; name: string; status: "uploading" | "done" | "error"; att?: Attachment; error?: string };

/**
 * Attach files to a conversation by picking or dropping them. Each file goes
 * straight to storage, is checked against the institutional database, and
 * reports what happened (saved as new, or already there and not stored twice).
 * Use `name` inside a form (hidden inputs), or `onChange` in client code.
 */
export default function AttachmentPicker({
  source,
  name,
  onChange,
  onBusy,
  dropTarget,
  resetKey,
}: {
  source: "ai_chat" | "request" | "announcement";
  name?: string;
  onChange?: (atts: Attachment[]) => void;
  onBusy?: (busy: boolean) => void;
  /** A larger element (the whole chat) that also accepts dropped files. */
  dropTarget?: React.RefObject<HTMLElement>;
  resetKey?: unknown;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const nextKey = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const guard = useRef<HTMLInputElement>(null);
  const busy = items.some((i) => i.status === "uploading");

  useEffect(() => setItems([]), [resetKey]);
  useEffect(() => {
    onChange?.(items.filter((i) => i.status === "done" && i.att).map((i) => i.att!));
    onBusy?.(busy);
    guard.current?.setCustomValidity(busy ? "انتظر حتى يكتمل رفع المرفقات" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const add = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const key = nextKey.current++;
        if (file.size > MAX_BYTES) {
          setItems((l) => [...l, { key, name: file.name, status: "error", error: "أكبر من 50 ميغابايت" }]);
          continue;
        }
        setItems((l) => [...l, { key, name: file.name, status: "uploading" }]);
        (async () => {
          const up = await uploadToArchive(file).catch(() => ({ error: "تعذّر الرفع، تحقق من الاتصال" }));
          if ("error" in up) return { error: up.error };
          return registerAttachment({ path: up.path, name: file.name, type: file.type, size: file.size }, source);
        })()
          .then((res) =>
            setItems((l) =>
              l.map((i) =>
                i.key !== key ? i : "error" in res ? { ...i, status: "error", error: res.error } : { ...i, status: "done", att: res }
              )
            )
          )
          .catch(() => setItems((l) => l.map((i) => (i.key === key ? { ...i, status: "error", error: "تعذّر الرفع" } : i))));
      }
    },
    [source]
  );

  useEffect(() => {
    const el = dropTarget?.current;
    if (!el) return;
    const onOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setOver(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!el.contains(e.relatedTarget as Node)) setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setOver(false);
      add(Array.from(e.dataTransfer.files));
    };
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [dropTarget, add]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-2 py-1.5 text-xs transition ${
          over ? "border-brand-500 bg-brand-50 text-brand-800" : "border-black/15 text-gray-500"
        }`}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100"
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden /> إرفاق ملف
        </button>
        <span>{over ? "أفلت الملفات هنا" : "أو اسحب الملفات وأفلتها هنا"}</span>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input ref={guard} tabIndex={-1} aria-hidden className="sr-only" defaultValue="" />
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.key} className="rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                {i.status === "uploading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-600" aria-hidden />}
                {i.status === "done" && i.att?.action === "saved" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />}
                {i.status === "done" && i.att?.action === "duplicate" && <Copy className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />}
                {i.status === "error" && <X className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />}
                <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{i.name}</span>
                {i.status === "uploading" && <span className="text-gray-500">جارٍ الرفع والفحص…</span>}
                {i.status !== "uploading" && (
                  <button type="button" onClick={() => setItems((l) => l.filter((x) => x.key !== i.key))} aria-label="إزالة" className="text-gray-400 hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {i.status === "done" && i.att && (
                <p className={`mt-0.5 ${i.att.action === "saved" ? "text-emerald-700" : "text-gray-600"}`}>{i.att.note}</p>
              )}
              {i.status === "error" && <p className="mt-0.5 text-red-700">{i.error}</p>}
              {name && i.status === "done" && i.att && <input type="hidden" name={name} value={JSON.stringify(i.att)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
