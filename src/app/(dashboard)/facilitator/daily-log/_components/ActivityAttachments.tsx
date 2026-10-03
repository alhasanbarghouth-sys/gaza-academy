"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import DropZone from "@/components/DropZone";
import { uploadToArchive } from "@/app/(dashboard)/archive/_components/upload";

const MAX_BYTES = 50 * 1024 * 1024;

type Item = {
  id: number;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "done" | "error";
  path?: string;
  error?: string;
};

/**
 * Photos and files for one project's report. Each file goes straight from the
 * phone to private storage while the form is being filled; on save they are
 * filed in the institutional database under this day's activity folder.
 */
export default function ActivityAttachments({ prefix }: { prefix: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(0);
  const guard = useRef<HTMLInputElement>(null);
  const uploading = items.some((i) => i.status === "uploading");

  // Block saving the report while a file is still on its way.
  useEffect(() => {
    guard.current?.setCustomValidity(uploading ? "انتظر حتى يكتمل رفع المرفقات" : "");
  }, [uploading]);

  const patch = (id: number, p: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function add(files: File[]) {
    for (const file of files) {
      const id = nextId.current++;
      if (file.size > MAX_BYTES) {
        setItems((l) => [...l, { id, name: file.name, size: file.size, type: file.type, status: "error", error: "أكبر من 50 ميغابايت" }]);
        continue;
      }
      setItems((l) => [...l, { id, name: file.name, size: file.size, type: file.type, status: "uploading" }]);
      uploadToArchive(file)
        .then((res) => ("error" in res ? patch(id, { status: "error", error: res.error }) : patch(id, { status: "done", path: res.path })))
        .catch(() => patch(id, { status: "error", error: "تعذّر الرفع، تحقق من الاتصال" }));
    }
  }

  return (
    <div>
      <p className="label">صور وملفات النشاط (اختياري)</p>
      <p className="mb-2 text-xs text-gray-500">
        تُحفظ في قاعدة البيانات المؤسسية داخل مجلد خاص بهذا اليوم وهذا المشروع. صوّر بعد أخذ موافقة من يظهر في الصورة.
      </p>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <label className="btn-secondary flex cursor-pointer items-center justify-center gap-2 sm:h-full sm:flex-col sm:px-6">
          <Camera className="h-5 w-5" aria-hidden />
          <span>التقاط صورة</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        <DropZone multiple clearAfterPick onFiles={add} label="اسحب الصور أو الملفات وأفلتها هنا" hint="صور، فيديو، PDF، Word، Excel — حتى 50 ميغابايت للملف" />
      </div>

      <input ref={guard} tabIndex={-1} aria-hidden className="sr-only" defaultValue="" />

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
              {i.status === "uploading" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" aria-hidden />}
              {i.status === "done" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
              {i.status === "error" && <X className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
              <span className="min-w-0 flex-1 truncate" dir="auto">{i.name}</span>
              <span className={i.status === "error" ? "text-red-700" : "text-gray-500"}>
                {i.status === "uploading" ? "جارٍ الرفع…" : i.status === "done" ? "جاهز" : i.error}
              </span>
              {i.status !== "uploading" && (
                <button
                  type="button"
                  onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="إزالة"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {i.status === "done" && (
                <input type="hidden" name={`${prefix}files`} value={JSON.stringify({ path: i.path, name: i.name, type: i.type })} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
