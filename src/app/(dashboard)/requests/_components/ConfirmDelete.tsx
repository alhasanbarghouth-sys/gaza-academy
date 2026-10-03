"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";

/** Delete button that asks for confirmation in a modal before submitting `action`. */
export default function ConfirmDelete({
  action,
  fields,
  label,
  title,
  message,
  compact = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  title: string;
  message: string;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={
          compact
            ? "inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600"
            : "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 hover:bg-red-50"
        }
      >
        <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        {label}
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <form action={action} className="space-y-4 p-5 text-right" dir="rtl">
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="font-bold text-gray-900">{title}</h3>
              <p className="mt-1 text-sm text-gray-600">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="btn-secondary !px-4 !py-2 text-sm">
              إلغاء
            </button>
            <button type="submit" className="btn-primary !bg-red-700 !px-4 !py-2 text-sm hover:!bg-red-800">
              نعم، احذف
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
