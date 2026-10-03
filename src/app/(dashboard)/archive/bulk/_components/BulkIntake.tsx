"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, Loader2, RotateCcw, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import type { ArchiveCategory, ArchiveDocType, ArchiveLinkRule, EntityType, LinkType } from "@/types/database";
import {
  ENTITY_TYPE_ORDER,
  LANGUAGE_AR,
  LINK_TYPES,
  MAX_ARCHIVE_FILE_BYTES,
  OFFER_PROVIDER_AR,
  RECORD_STATUS_AR,
  SENSITIVITY,
  formatBytes,
} from "@/lib/archive/constants";
import type { Suggestion } from "@/lib/archive/classify";
import DropZone from "@/components/DropZone";
import { Chip, EntityPicker } from "../../_components/Pickers";
import { uploadToArchive } from "../../_components/upload";
import { discardQueued, fileQueuedDocument, previewQueued, queueBulkUpload } from "../../actions";

export type QueueRow = {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  status: "uploaded" | "analyzing" | "ready" | "error";
  suggestion: Suggestion | null;
  error: string | null;
  tokens: number | null;
  updated_at: string;
};

type DraftLink = { key: string; entity_id: string; display: string; entity_type: string; link_type: LinkType; rule?: string };

type Draft = {
  doc_type: string;
  category_code: string;
  title: string;
  title_en: string;
  document_date: string;
  source: string;
  responsible: string;
  sensitivity: number;
  language: string;
  record_status: string;
  keywords: string;
  budget_line: string;
  offer_provider_type: string;
  links: DraftLink[];
};

type Item = {
  key: string;
  id?: string;
  file_name: string;
  file_size: number;
  status: "uploading" | "uploaded" | "analyzing" | "ready" | "error" | "saving" | "filed";
  error?: string | null;
  suggestion?: Suggestion | null;
  tokens?: number | null;
  draft?: Draft;
  documentId?: string;
  archiveNumber?: string;
};

const CONFIDENCE: Record<string, { label: string; cls: string }> = {
  high: { label: "ثقة عالية", cls: "bg-emerald-50 text-emerald-700" },
  medium: { label: "ثقة متوسطة", cls: "bg-amber-50 text-amber-800" },
  low: { label: "ثقة منخفضة — راجِع بعناية", cls: "bg-red-50 text-red-700" },
};
const PARALLEL = 3;

function draftFrom(s: Suggestion | null | undefined, responsible: string): Draft {
  return {
    doc_type: s?.doc_type ?? "",
    category_code: s?.category_code ?? "",
    title: s?.title ?? "",
    title_en: s?.title_en ?? "",
    document_date: s?.document_date ?? "",
    source: s?.source ?? "",
    responsible,
    sensitivity: s?.sensitivity ?? 1,
    language: s?.language ?? "ar",
    record_status: s?.record_status ?? "original",
    keywords: s?.keywords ?? "",
    budget_line: s?.budget_line ?? "",
    offer_provider_type: "",
    links: (s?.links ?? []).map((l) => ({
      key: `${l.entity_id}:${l.link_type}`,
      entity_id: l.entity_id,
      display: l.name ? `${l.code} — ${l.name}` : l.code,
      entity_type: l.entity_type,
      link_type: l.link_type,
    })),
  };
}

export default function BulkIntake({
  categories,
  insertable,
  docTypes,
  rules,
  creatable,
  responsible,
  initial,
  aiEnabled,
}: {
  categories: ArchiveCategory[];
  insertable: string[];
  docTypes: ArchiveDocType[];
  rules: ArchiveLinkRule[];
  creatable: EntityType[];
  responsible: string;
  initial: QueueRow[];
  aiEnabled: boolean;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((r) => ({
      key: r.id,
      id: r.id,
      file_name: r.file_name,
      file_size: r.file_size,
      status: r.status,
      error: r.error,
      suggestion: r.suggestion,
      tokens: r.tokens,
      draft: r.status === "ready" ? draftFrom(r.suggestion, responsible) : undefined,
    }))
  );
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ready" | "problem">("all");
  const [bulkBusy, setBulkBusy] = useState(false);
  const nextKey = useRef(0);

  // A small pool so a large drop does not open hundreds of uploads at once.
  const queue = useRef<(() => Promise<void>)[]>([]);
  const running = useRef(0);
  const pump = useCallback(() => {
    while (running.current < PARALLEL && queue.current.length) {
      const job = queue.current.shift()!;
      running.current++;
      job().finally(() => {
        running.current--;
        pump();
      });
    }
  }, []);
  const schedule = useCallback((job: () => Promise<void>) => {
    queue.current.push(job);
    pump();
  }, [pump]);

  const patch = useCallback(
    (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i))),
    []
  );

  const analyze = useCallback(
    (key: string, id: string) =>
      schedule(async () => {
        patch(key, { status: "analyzing", error: null });
        try {
          const res = await fetch("/api/archive/bulk/analyze", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id }),
          });
          const data = await res.json();
          if (data.status === "ready") {
            patch(key, { status: "ready", suggestion: data.suggestion, tokens: data.tokens, draft: draftFrom(data.suggestion, responsible) });
          } else {
            patch(key, { status: "error", error: data.error ?? "تعذّر التحليل" });
          }
        } catch {
          patch(key, { status: "error", error: "انقطع الاتصال أثناء التحليل، أعد المحاولة" });
        }
      }),
    [patch, responsible, schedule]
  );

  // Files left waiting (page closed mid-way) are picked up again.
  useEffect(() => {
    const stale = Date.now() - 2 * 60 * 1000;
    for (const r of initial) {
      if (aiEnabled && (r.status === "uploaded" || (r.status === "analyzing" && Date.parse(r.updated_at) < stale))) analyze(r.id, r.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(files: File[]) {
    for (const file of files) {
      const key = `new-${nextKey.current++}`;
      if (file.size > MAX_ARCHIVE_FILE_BYTES) {
        setItems((l) => [...l, { key, file_name: file.name, file_size: file.size, status: "error", error: "أكبر من 50 ميغابايت" }]);
        continue;
      }
      setItems((l) => [...l, { key, file_name: file.name, file_size: file.size, status: "uploading" }]);
      schedule(async () => {
        const up = await uploadToArchive(file).catch(() => ({ error: "تعذّر الرفع، تحقق من الاتصال" }));
        if ("error" in up) return patch(key, { status: "error", error: up.error });
        const q = await queueBulkUpload({ path: up.path, name: file.name, type: file.type, size: file.size });
        if ("error" in q && q.error) return patch(key, { status: "error", error: q.error });
        const id = (q as { id: string }).id;
        patch(key, { id, status: "uploaded" });
        if (aiEnabled) analyze(key, id);
        else patch(key, { status: "ready", draft: draftFrom(null, responsible) });
      });
    }
  }

  const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);
  const missingFor = useCallback(
    (d: Draft) =>
      rules
        .filter((r) => r.doc_type === d.doc_type && r.stage === "intake" && !r.is_optional && r.entity_types.length)
        .filter((r) => !d.links.some((l) => l.rule === r.req_key || r.entity_types.includes(l.entity_type as EntityType))),
    [rules]
  );
  const problemOf = useCallback(
    (d?: Draft) => {
      if (!d) return "لم يكتمل التحليل";
      if (!d.doc_type || !d.category_code) return "اختر النوع والتصنيف";
      if (!d.title.trim()) return "العنوان ناقص";
      if (!d.document_date) return "تاريخ المستند ناقص";
      if (!d.source.trim()) return "المصدر ناقص";
      if (!d.responsible.trim()) return "المسؤول ناقص";
      if (d.doc_type === "payment_voucher" && !d.budget_line.trim()) return "بند الموازنة ناقص";
      if (d.doc_type === "offer" && !d.offer_provider_type) return "حدد مقدّم العرض";
      const m = missingFor(d);
      if (m.length) return `روابط إلزامية ناقصة: ${m.map((r) => r.label_ar).join("، ")}`;
      return null;
    },
    [missingFor]
  );

  async function save(item: Item) {
    if (!item.id || !item.draft) return false;
    const d = item.draft;
    const problem = problemOf(d);
    if (problem) {
      patch(item.key, { error: problem });
      return false;
    }
    patch(item.key, { status: "saving", error: null });
    const res = await fileQueuedDocument(item.id, {
      doc_type: d.doc_type,
      category_code: d.category_code,
      title: d.title,
      title_en: d.title_en,
      document_date: d.document_date,
      source: d.source,
      responsible: d.responsible,
      record_status: d.record_status,
      sensitivity: d.sensitivity,
      language: d.language,
      keywords: d.keywords,
      budget_line: d.budget_line,
      offer_provider_type: d.offer_provider_type,
      links: d.links.map((l) => ({ link_type: l.link_type, target_entity_id: l.entity_id })),
    });
    if ("error" in res && res.error) {
      patch(item.key, { status: "ready", error: res.error });
      return false;
    }
    const doc = res as { id: string; archive_number: string };
    patch(item.key, { status: "filed", documentId: doc.id, archiveNumber: doc.archive_number });
    return true;
  }

  async function saveAllReady() {
    setBulkBusy(true);
    for (const i of items) {
      if (i.status === "ready" && !problemOf(i.draft)) await save(i);
    }
    setBulkBusy(false);
  }

  async function discard(item: Item) {
    if (!item.id) return setItems((l) => l.filter((x) => x.key !== item.key));
    if (!confirm(`حذف «${item.file_name}» من قائمة المراجعة؟ لن يُحفظ في قاعدة البيانات.`)) return;
    const res = await discardQueued(item.id);
    if ("error" in res && res.error) return patch(item.key, { error: res.error });
    setItems((l) => l.filter((x) => x.key !== item.key));
  }

  async function preview(item: Item) {
    if (!item.id) return;
    const w = window.open("", "_blank");
    const res = await previewQueued(item.id);
    if ("error" in res && res.error) {
      w?.close();
      return patch(item.key, { error: res.error });
    }
    if (w) w.location.href = (res as { url: string }).url;
  }

  const counts = {
    working: items.filter((i) => ["uploading", "uploaded", "analyzing", "saving"].includes(i.status)).length,
    ready: items.filter((i) => i.status === "ready" && !problemOf(i.draft)).length,
    problem: items.filter((i) => i.status === "error" || (i.status === "ready" && problemOf(i.draft))).length,
    filed: items.filter((i) => i.status === "filed").length,
  };
  const tokens = items.reduce((s, i) => s + (i.tokens ?? 0), 0);
  const visible = items.filter((i) =>
    filter === "ready"
      ? i.status === "ready" && !problemOf(i.draft)
      : filter === "problem"
        ? i.status === "error" || (i.status === "ready" && !!problemOf(i.draft))
        : true
  );

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">الإدراج الذكي للملفات</h2>
            <p className="mt-1 text-sm text-gray-600">
              ارفع أي عدد من الملفات دفعة واحدة. يقرأ الذكاء الاصطناعي كل ملف ويقترح نوعه وتصنيفه وعنوانه وتاريخه
              وحساسيته وروابطه. لا يُحفظ شيء في قاعدة البيانات قبل أن تراجعه وتعتمده.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              يُرسل محتوى الملف إلى Gemini للقراءة فقط. لا ترفع هنا ما لا يجوز اطلاع جهة خارجية عليه.
            </p>
          </div>
        </div>
        {!aiEnabled && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            مفتاح Gemini غير مُعدّ (GEMINI_API_KEY)، لذا ستصنّف الملفات يدوياً.
          </p>
        )}
        <DropZone
          multiple
          clearAfterPick
          onFiles={add}
          label="اسحب الملفات وأفلتها هنا — مهما كان عددها"
          hint="PDF، صور، Word، Excel، PowerPoint، نصوص — حتى 50 ميغابايت للملف"
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { k: "all", label: `الكل (${items.length})` },
            { k: "ready", label: `جاهز للاعتماد (${counts.ready})` },
            { k: "problem", label: `يحتاج تدخلاً (${counts.problem})` },
          ].map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k as typeof filter)}
              className={`rounded-lg px-2.5 py-1 ${filter === f.k ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {f.label}
            </button>
          ))}
          {counts.working > 0 && (
            <span className="flex items-center gap-1 text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> قيد المعالجة: {counts.working}
            </span>
          )}
          {counts.filed > 0 && <span className="text-emerald-700">حُفظ: {counts.filed}</span>}
          {tokens > 0 && <span className="text-gray-400">استهلاك الذكاء الاصطناعي: {tokens.toLocaleString("en")} توكن</span>}
          <button
            type="button"
            onClick={saveAllReady}
            disabled={bulkBusy || counts.ready === 0}
            className="btn-primary mr-auto !px-3 !py-1.5 text-xs disabled:opacity-50"
          >
            {bulkBusy ? "جارٍ الحفظ…" : `اعتماد وحفظ كل الجاهز (${counts.ready})`}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((item) => (
          <ItemCard
            key={item.key}
            item={item}
            open={open === item.key}
            onToggle={() => setOpen((o) => (o === item.key ? null : item.key))}
            problem={item.status === "ready" ? problemOf(item.draft) : null}
            missing={item.draft ? missingFor(item.draft) : []}
            categories={categories}
            byCode={byCode}
            insertable={insertable}
            docTypes={docTypes}
            creatable={creatable}
            onDraft={(d) => patch(item.key, { draft: d, error: null })}
            onSave={() => save(item)}
            onDiscard={() => discard(item)}
            onPreview={() => preview(item)}
            onRetry={() => item.id && analyze(item.key, item.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  open,
  onToggle,
  problem,
  missing,
  categories,
  byCode,
  insertable,
  docTypes,
  creatable,
  onDraft,
  onSave,
  onDiscard,
  onPreview,
  onRetry,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
  problem: string | null;
  missing: ArchiveLinkRule[];
  categories: ArchiveCategory[];
  byCode: Map<string, ArchiveCategory>;
  insertable: string[];
  docTypes: ArchiveDocType[];
  creatable: EntityType[];
  onDraft: (d: Draft) => void;
  onSave: () => void;
  onDiscard: () => void;
  onPreview: () => void;
  onRetry: () => void;
}) {
  const d = item.draft;
  const s = item.suggestion;
  const set = (p: Partial<Draft>) => d && onDraft({ ...d, ...p });

  const type = docTypes.find((t) => t.code === d?.doc_type);
  const cat = d?.category_code ? byCode.get(d.category_code) : undefined;
  const insertableSet = new Set(insertable);
  const typeOptions = docTypes.filter((t) =>
    t.fixed_category ? insertableSet.has(t.fixed_category) : insertable.some((c) => !byCode.get(c)?.exclusive_doc_type)
  );
  const categoryOptions = type?.fixed_category
    ? insertable.filter((c) => c === type.fixed_category)
    : insertable.filter((c) => !byCode.get(c)?.exclusive_doc_type);
  const floor = cat?.default_sensitivity ?? 0;

  function chooseType(code: string) {
    const t = docTypes.find((x) => x.code === code);
    const nextCat = t?.fixed_category ?? (byCode.get(d?.category_code ?? "")?.exclusive_doc_type ? "" : d?.category_code ?? "");
    const c = byCode.get(nextCat);
    set({ doc_type: code, category_code: nextCat, sensitivity: Math.max(d?.sensitivity ?? 1, c?.default_sensitivity ?? 1) });
  }
  function chooseCategory(code: string) {
    const c = byCode.get(code);
    set({ category_code: code, sensitivity: Math.max(d?.sensitivity ?? 1, c?.default_sensitivity ?? 1) });
  }
  function addLink(l: Omit<DraftLink, "key">) {
    if (!d) return;
    const key = `${l.entity_id}:${l.link_type}`;
    if (d.links.some((x) => x.key === key)) return;
    set({ links: [...d.links, { ...l, key }] });
  }

  const status =
    item.status === "uploading" ? (
      <Badge icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} text="جارٍ الرفع" cls="bg-gray-100 text-gray-600" />
    ) : item.status === "uploaded" || item.status === "analyzing" ? (
      <Badge icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} text="يقرأ الذكاء الاصطناعي الملف" cls="bg-brand-50 text-brand-700" />
    ) : item.status === "saving" ? (
      <Badge icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />} text="جارٍ الحفظ" cls="bg-gray-100 text-gray-600" />
    ) : item.status === "filed" ? (
      <Badge icon={<CheckCircle2 className="h-3.5 w-3.5" />} text="حُفظ" cls="bg-emerald-50 text-emerald-700" />
    ) : item.status === "error" ? (
      <Badge icon={<TriangleAlert className="h-3.5 w-3.5" />} text="تعذّر" cls="bg-red-50 text-red-700" />
    ) : problem ? (
      <Badge icon={<TriangleAlert className="h-3.5 w-3.5" />} text="يحتاج استكمالاً" cls="bg-amber-50 text-amber-800" />
    ) : (
      <Badge icon={<CheckCircle2 className="h-3.5 w-3.5" />} text="جاهز للاعتماد" cls="bg-emerald-50 text-emerald-700" />
    );

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white">
      <button
        type="button"
        onClick={onToggle}
        disabled={!d || item.status === "filed"}
        className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-right hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white md:grid-cols-[1fr_auto] md:items-center md:gap-3"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold text-gray-900">
            {item.status === "filed" ? item.draft?.title : d?.title || item.file_name}
          </span>
          <span className="block truncate text-[11px] text-gray-500" dir="auto">
            {item.file_name} · {formatBytes(item.file_size)}
            {d?.category_code && ` · ${d.category_code} ${byCode.get(d.category_code)?.name_ar ?? ""}`}
            {item.archiveNumber && ` · ${item.archiveNumber}`}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {s && item.status === "ready" && (
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE[s.confidence]?.cls}`}>
              {CONFIDENCE[s.confidence]?.label}
            </span>
          )}
          {status}
        </span>
      </button>

      {(item.error || (item.status === "error" && item.id) || item.status === "filed") && (
        <div className="flex flex-wrap items-center gap-3 border-t border-black/5 px-4 py-2 text-xs">
          {item.error && <span className="text-red-700">{item.error}</span>}
          {item.status === "error" && item.id && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              <RotateCcw className="h-3.5 w-3.5" /> إعادة التحليل
            </button>
          )}
          {item.status === "error" && (
            <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
          )}
          {item.status === "filed" && item.documentId && (
            <Link href={`/archive/doc/${item.documentId}`} className="font-semibold text-brand-700 hover:underline">
              فتح السجل
            </Link>
          )}
        </div>
      )}

      {open && d && item.status !== "filed" && (
        <div className="space-y-4 border-t border-black/5 bg-gray-50/60 p-4">
          {s?.summary && (
            <p className="rounded-lg bg-white p-3 text-sm text-gray-700 ring-1 ring-black/5">
              <span className="font-semibold">قراءة الذكاء الاصطناعي: </span>
              {s.summary}
              {!s.read_content && <span className="block text-xs text-amber-700">لم يُقرأ المحتوى (صُنّف من اسم الملف فقط).</span>}
            </p>
          )}
          {!!s?.unmatched?.length && (
            <p className="text-xs text-amber-800">
              ورد في الملف ولم يُعثر عليه في السجلّ: {s.unmatched.join("، ")} — أضفه كياناً إن لزم.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نوع المستند">
              <select value={d.doc_type} onChange={(e) => chooseType(e.target.value)} className="input">
                <option value="">اختر…</option>
                {typeOptions.map((t) => (
                  <option key={t.code} value={t.code}>{t.name_ar}</option>
                ))}
              </select>
            </Field>
            <Field label="التصنيف">
              <select value={d.category_code} onChange={(e) => chooseCategory(e.target.value)} className="input">
                <option value="">اختر…</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c} — {byCode.get(c)?.name_ar}</option>
                ))}
              </select>
            </Field>
            <Field label="العنوان" wide>
              <input value={d.title} onChange={(e) => set({ title: e.target.value })} className="input" />
            </Field>
            <Field label="تاريخ المستند">
              <input type="date" value={d.document_date} onChange={(e) => set({ document_date: e.target.value })} className="input" />
            </Field>
            <Field label="المصدر">
              <input value={d.source} onChange={(e) => set({ source: e.target.value })} className="input" />
            </Field>
            <Field label="المسؤول عن المستند">
              <input value={d.responsible} onChange={(e) => set({ responsible: e.target.value })} className="input" />
            </Field>
            <Field label="الحساسية">
              <select value={d.sensitivity} onChange={(e) => set({ sensitivity: Number(e.target.value) })} className="input">
                {SENSITIVITY.filter((x) => x.level >= floor).map((x) => (
                  <option key={x.level} value={x.level}>{x.code} — {x.name}</option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select value={d.record_status} onChange={(e) => set({ record_status: e.target.value })} className="input">
                {Object.entries(RECORD_STATUS_AR).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="اللغة">
              <select value={d.language} onChange={(e) => set({ language: e.target.value })} className="input">
                {Object.entries(LANGUAGE_AR).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            {d.doc_type === "payment_voucher" && (
              <Field label="بند الموازنة">
                <input value={d.budget_line} onChange={(e) => set({ budget_line: e.target.value })} className="input" />
              </Field>
            )}
            {d.doc_type === "offer" && (
              <Field label="مقدّم العرض">
                <select value={d.offer_provider_type} onChange={(e) => set({ offer_provider_type: e.target.value })} className="input">
                  <option value="">اختر…</option>
                  {Object.entries(OFFER_PROVIDER_AR).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="كلمات مفتاحية" wide>
              <input value={d.keywords} onChange={(e) => set({ keywords: e.target.value })} className="input" />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="label">الروابط</p>
            <div className="flex flex-wrap gap-1.5">
              {d.links.length === 0 && <span className="text-xs text-gray-400">لا روابط بعد.</span>}
              {d.links.map((l) => (
                <Chip
                  key={l.key}
                  label={`${LINK_TYPES[l.link_type]?.ar ?? l.link_type}: ${l.display}`}
                  onRemove={() => set({ links: d.links.filter((x) => x.key !== l.key) })}
                />
              ))}
            </div>
            {missing.map((r) => (
              <div key={r.req_key} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2">
                <p className="mb-1 text-xs font-semibold text-amber-900">مطلوب: {r.label_ar}</p>
                <EntityPicker
                  types={r.entity_types}
                  creatable={creatable}
                  placeholder={`ابحث عن ${r.label_ar}…`}
                  onPick={(t) =>
                    t.target_entity_id &&
                    addLink({ entity_id: t.target_entity_id, display: t.display, entity_type: r.entity_types[0], link_type: r.default_link_type, rule: r.req_key })
                  }
                />
              </div>
            ))}
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500">إضافة رابط آخر</summary>
              <div className="mt-2">
                <EntityPicker
                  types={ENTITY_TYPE_ORDER.filter((t) => t !== "beneficiary")}
                  creatable={creatable}
                  placeholder="مشروع، مانح، فترة، نشاط…"
                  onPick={(t) =>
                    t.target_entity_id && addLink({ entity_id: t.target_entity_id, display: t.display, entity_type: "", link_type: "belongs_to" })
                  }
                />
              </div>
            </details>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onSave} disabled={!!problem} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
              اعتماد وحفظ
            </button>
            <button type="button" onClick={onPreview} className="btn-secondary inline-flex items-center gap-1.5 !px-3 !py-2 text-sm">
              <Eye className="h-4 w-4" /> معاينة الملف
            </button>
            <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1 px-2 text-xs text-gray-500 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> حذف من القائمة
            </button>
            {problem && <span className="text-xs text-amber-800">{problem}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ icon, text, cls }: { icon: React.ReactNode; text: string; cls: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{icon}{text}</span>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
