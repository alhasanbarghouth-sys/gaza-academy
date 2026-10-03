"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Drop-a-file-to-upload area around a native file input. Dropped files are
 * placed on the input itself, so it works both inside plain server-action
 * forms (`name`) and with a client handler (`onFiles`).
 */
export default function DropZone({
  id,
  name,
  required,
  multiple = false,
  accept,
  onFiles,
  clearAfterPick = false,
  label = "اسحب الملف وأفلته هنا",
  hint,
}: {
  id?: string;
  name?: string;
  required?: boolean;
  multiple?: boolean;
  accept?: string;
  onFiles?: (files: File[]) => void;
  /** Empty the input after handing the files to onFiles (when the caller uploads them itself). */
  clearAfterPick?: boolean;
  label?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [picked, setPicked] = useState<File[]>([]);

  function take(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!clearAfterPick) setPicked(files);
    onFiles?.(files);
    if (clearAfterPick && input.current) input.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length || !input.current) return;
    const dt = new DataTransfer();
    (multiple ? dropped : dropped.slice(0, 1)).forEach((f) => dt.items.add(f));
    input.current.files = dt.files;
    take(dt.files);
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
        over ? "border-brand-500 bg-brand-50/60" : "border-black/15 bg-gray-50/60 hover:border-brand-300 hover:bg-brand-50/30"
      }`}
    >
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        required={required}
        multiple={multiple}
        accept={accept}
        onChange={(e) => take(e.target.files)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <UploadCloud className={`h-7 w-7 ${over ? "text-brand-600" : "text-gray-400"}`} aria-hidden />
      <span className="text-sm font-semibold text-gray-700">{over ? "أفلت هنا" : label}</span>
      <span className="text-xs text-gray-500">أو اضغط لاختيار {multiple ? "ملفات" : "ملف"} من جهازك</span>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      {picked.length > 0 && (
        <span className="mt-1 text-xs font-medium text-brand-800">
          {picked.map((f) => `${f.name} (${formatBytes(f.size)})`).join("، ")}
        </span>
      )}
    </label>
  );
}
