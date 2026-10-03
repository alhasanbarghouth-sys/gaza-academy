"use client";

import DropZone from "@/components/DropZone";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ArchiveCategory, ArchiveDocType, ArchiveLinkRule, EntityType, LinkType } from "@/types/database";
import {
  ENTITY_TYPE_ORDER,
  LANGUAGE_AR,
  LINK_TYPES,
  MAX_ARCHIVE_FILE_BYTES,
  OFFER_PROVIDER_AR,
  RECORD_STATUS_AR,
  SENSITIVITY,
  SOURCE_SUGGESTIONS,
  formatBytes,
} from "@/lib/archive/constants";
import { Chip, DocPicker, EntityPicker, type PickedTarget } from "../../_components/Pickers";
import { uploadToArchive } from "../../_components/upload";
import { createDocument } from "../../actions";

type Picked = PickedTarget & { key: string; link_type: LinkType };

export default function IntakeForm({
  categories,
  insertable,
  docTypes,
  rules,
  creatable,
  today,
}: {
  categories: ArchiveCategory[];
  insertable: { code: string; own_scope_only: boolean }[];
  docTypes: ArchiveDocType[];
  rules: ArchiveLinkRule[];
  creatable: EntityType[];
  today: string;
}) {
  const router = useRouter();
  const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);
  const insertableMap = useMemo(() => new Map(insertable.map((i) => [i.code, i.own_scope_only])), [insertable]);

  const [docType, setDocType] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [sensitivity, setSensitivity] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [documentDate, setDocumentDate] = useState(today);
  const [source, setSource] = useState("");
  const [responsible, setResponsible] = useState("");
  const [recordStatus, setRecordStatus] = useState("original");
  const [language, setLanguage] = useState("ar");
  const [keywords, setKeywords] = useState("");
  const [budgetLine, setBudgetLine] = useState("");
  const [offerProvider, setOfferProvider] = useState("");
  const [isUnpublished, setIsUnpublished] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<Picked[]>([]);
  const [extraType, setExtraType] = useState<LinkType>("belongs_to");
  const [extraKind, setExtraKind] = useState<"entity" | "doc">("entity");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const type = docTypes.find((t) => t.code === docType);
  const category = categoryCode ? byCode.get(categoryCode) : undefined;
  const typeRules = rules.filter((r) => r.doc_type === docType);

  const availableTypes = docTypes.filter((t) =>
    t.fixed_category
      ? insertableMap.has(t.fixed_category)
      : insertable.some((i) => !byCode.get(i.code)?.exclusive_doc_type)
  );
  const ruleTypes = availableTypes.filter((t) => t.fixed_category);
  const genericTypes = availableTypes.filter((t) => !t.fixed_category);

  const categoryOptions = type?.fixed_category
    ? insertable.filter((i) => i.code === type.fixed_category)
    : insertable.filter((i) => !byCode.get(i.code)?.exclusive_doc_type);
  const sections = categories.filter((c) => c.level === 1);

  function chooseType(code: string) {
    setDocType(code);
    const t = docTypes.find((x) => x.code === code);
    const nextCat = t?.fixed_category ?? (byCode.get(categoryCode)?.exclusive_doc_type ? "" : categoryCode);
    chooseCategory(nextCat);
    setLinks((prev) => prev.filter((l) => l.key.startsWith("extra")));
  }

  function chooseCategory(code: string) {
    setCategoryCode(code);
    const c = byCode.get(code);
    setSensitivity(c ? c.default_sensitivity ?? 1 : null);
  }

  function addLink(key: string, link_type: LinkType, t: PickedTarget) {
    setError("");
    setLinks((prev) => {
      const id = t.target_entity_id ?? t.target_document_id;
      if (prev.some((l) => (l.target_entity_id ?? l.target_document_id) === id && l.link_type === link_type)) return prev;
      return [...prev, { ...t, key, link_type }];
    });
  }

  const missingIntake = typeRules
    .filter((r) => r.stage === "intake" && !r.is_optional)
    .filter((r) => !links.some((l) => l.key === r.req_key) && !(r.alt_flag === "unpublished" && isUnpublished));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!type || !category) return setError("اختر نوع المستند والتصنيف.");
    if (!file) return setError("اختر الملف.");
    if (file.size > MAX_ARCHIVE_FILE_BYTES) return setError("حجم الملف يتجاوز 50 ميغابايت.");
    if (missingIntake.length) return setError(`روابط إلزامية ناقصة: ${missingIntake.map((r) => r.label_ar).join("، ")}`);

    setBusy("جارٍ رفع الملف…");
    const up = await uploadToArchive(file);
    if ("error" in up) {
      setBusy(null);
      return setError(up.error);
    }
    setBusy("جارٍ التحقق من الملف وتسجيله…");
    const res = await createDocument({
      doc_type: type.code,
      category_code: category.code,
      title,
      title_en: titleEn,
      document_date: documentDate,
      source,
      responsible,
      record_status: recordStatus,
      sensitivity: sensitivity ?? category.default_sensitivity ?? 1,
      language,
      keywords,
      budget_line: budgetLine,
      offer_provider_type: offerProvider,
      is_unpublished: isUnpublished,
      storage_path: up.path,
      file_name: file.name,
      mime_type: file.type,
      links: links.map((l) => ({
        link_type: l.link_type,
        target_entity_id: l.target_entity_id,
        target_document_id: l.target_document_id,
      })),
    });
    if ("error" in res && res.error) {
      setBusy(null);
      return setError(res.error);
    }
    router.push(`/archive/doc/${(res as { id: string }).id}?created=1`);
  }

  if (insertable.length === 0) {
    return (
      <div className="card text-sm text-gray-600">
        <p className="font-bold text-gray-900">لا تملك صلاحية إدراج مستندات في قاعدة البيانات المؤسسية.</p>
        <p className="mt-2">
          الصلاحيات مطبقة حسب مصفوفة الأدوار في المخطط التصنيفي (الباب 8). مدير النظام التقني مثلاً لا يُدرج ولا يقرأ محتوى
          قاعدة البيانات المؤسسية (مبدأ فصل المهام) إلا سجلات النسخ الاحتياطي 16.04. لإضافة صلاحية، يمنح المدير التنفيذي تفويضاً من صفحة
          «الصلاحيات والسجلات».
        </p>
      </div>
    );
  }

  const ownScope = category ? insertableMap.get(category.code) : false;

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">1. الموضع الأصلي</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="doc_type">نوع المستند *</label>
            <select id="doc_type" value={docType} onChange={(e) => chooseType(e.target.value)} className="input" required>
              <option value="">— اختر —</option>
              {ruleTypes.length > 0 && (
                <optgroup label="أنواع لها قواعد ربط إلزامية">
                  {ruleTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name_ar} ({t.fixed_category})
                    </option>
                  ))}
                </optgroup>
              )}
              {genericTypes.length > 0 && (
                <optgroup label="أنواع عامة">
                  {genericTypes.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name_ar}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="category">التصنيف *</label>
            <select
              id="category"
              value={categoryCode}
              onChange={(e) => chooseCategory(e.target.value)}
              className="input"
              required
              disabled={!type || !!type.fixed_category}
            >
              <option value="">— اختر —</option>
              {sections.map((s) => {
                const opts = categoryOptions.filter((i) => i.code.startsWith(s.code + "."));
                if (!opts.length) return null;
                return (
                  <optgroup key={s.code} label={`${s.code} — ${s.name_ar}`}>
                    {opts.map((i) => (
                      <option key={i.code} value={i.code}>
                        {i.code} — {byCode.get(i.code)?.name_ar}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        </div>
        {category && (
          <div className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
            <p>
              <span className="font-semibold text-gray-800">أنواع المواد:</span> {category.materials_ar}
            </p>
            {category.related_ar && (
              <p className="mt-1">
                <span className="font-semibold text-gray-800">يُربط عادة بـ:</span> {category.related_ar}
              </p>
            )}
            <p className="mt-1">
              <span className="font-semibold text-gray-800">الاحتفاظ:</span> {category.retention_note_ar}
            </p>
            {ownScope && (
              <p className="mt-1 font-semibold text-amber-800">
                صلاحيتك هنا في نطاق مشاريعك: اربط المستند بمشروع أنت عضو فيه أو بنشاط تابع له.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">2. الوصف الإلزامي</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">العنوان *</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="input" required placeholder="وصف مختصر ثابت الصيغة" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title_en">العنوان بالإنجليزية (اختياري، لمستندات المانحين)</label>
            <input id="title_en" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="document_date">تاريخ المستند *</label>
            <input id="document_date" type="date" value={documentDate} max={today} onChange={(e) => setDocumentDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="source">المصدر *</label>
            <input id="source" list="sources" value={source} onChange={(e) => setSource(e.target.value)} className="input" required placeholder="من أصدره أو من أين جُلب" />
            <datalist id="sources">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="responsible">المسؤول عن المستند *</label>
            <input id="responsible" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="input" required placeholder="شخص أو وحدة محددة، لا «الإدارة» عموماً" />
          </div>
          <div>
            <label className="label" htmlFor="record_status">الحالة *</label>
            <select id="record_status" value={recordStatus} onChange={(e) => setRecordStatus(e.target.value)} className="input">
              {Object.entries(RECORD_STATUS_AR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sensitivity">درجة الحساسية *</label>
            <select
              id="sensitivity"
              value={sensitivity ?? ""}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="input"
              disabled={!category}
            >
              {SENSITIVITY.filter((s) => s.level >= (category?.default_sensitivity ?? 0)).map((s) => (
                <option key={s.level} value={s.level}>
                  {s.code} — {s.name}
                  {s.level === category?.default_sensitivity ? " (افتراضية التصنيف)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">يمكن رفعها عن درجة التصنيف ولا يمكن خفضها.</p>
          </div>
          <div>
            <label className="label" htmlFor="language">اللغة *</label>
            <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className="input">
              {Object.entries(LANGUAGE_AR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {docType === "payment_voucher" && (
            <div>
              <label className="label" htmlFor="budget_line">بند الموازنة *</label>
              <input id="budget_line" value={budgetLine} onChange={(e) => setBudgetLine(e.target.value)} className="input" required />
            </div>
          )}
          {docType === "offer" && (
            <div>
              <label className="label" htmlFor="offer_provider">مقدِّم العرض *</label>
              <select id="offer_provider" value={offerProvider} onChange={(e) => setOfferProvider(e.target.value)} className="input" required>
                <option value="">— اختر —</option>
                {Object.entries(OFFER_PROVIDER_AR).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="keywords">كلمات مفتاحية (اختياري)</label>
            <input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="input" placeholder="مفصولة بفواصل" />
          </div>
        </div>
        {sensitivity === 0 && (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            S0 = عام: سيظهر هذا المستند في صفحة «الوثائق العامة» لأي زائر دون تسجيل دخول، ما لم تكن حالته «مسودة». ارفع الدرجة إن لم يكن
            منشوراً أصلاً.
          </p>
        )}
      </section>

      {type && (
        <section className="card space-y-4">
          <h2 className="text-lg font-bold">3. الروابط</h2>
          {typeRules.length === 0 && (
            <p className="text-sm text-gray-500">لا توجد روابط إلزامية لهذا النوع، ويمكنك إضافة ما يلزم أدناه.</p>
          )}
          {typeRules.map((r) => (
            <div key={r.req_key} className="space-y-2 rounded-xl border border-black/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{r.label_ar}</p>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    r.is_optional
                      ? "bg-gray-100 text-gray-500"
                      : r.stage === "intake"
                        ? "bg-red-50 text-red-700"
                        : "bg-orange-50 text-orange-700"
                  }`}
                >
                  {r.is_optional ? "إن وُجد" : r.stage === "intake" ? "إلزامي عند الإدراج" : "إلزامي لاكتمال الملف (يمكن لاحقاً)"}
                </span>
                <span className="text-[11px] text-gray-400">نوع الرابط: {LINK_TYPES[r.default_link_type].ar}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {links
                  .filter((l) => l.key === r.req_key)
                  .map((l, i) => (
                    <Chip key={i} label={l.display} onRemove={() => setLinks((prev) => prev.filter((x) => x !== l))} />
                  ))}
              </div>
              {r.entity_types.length > 0 && (
                <EntityPicker types={r.entity_types} creatable={creatable} onPick={(t) => addLink(r.req_key, r.default_link_type, t)} />
              )}
              {r.categories.length > 0 && (
                <DocPicker categories={r.categories} onPick={(t) => addLink(r.req_key, r.default_link_type, t)} />
              )}
              {r.alt_flag === "unpublished" && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={isUnpublished} onChange={(e) => setIsUnpublished(e.target.checked)} />
                  غير منشور
                </label>
              )}
            </div>
          ))}

          <div className="space-y-2 rounded-xl border border-dashed border-black/10 p-3">
            <p className="text-sm font-semibold">روابط إضافية</p>
            <div className="flex flex-wrap gap-1.5">
              {links
                .filter((l) => l.key.startsWith("extra"))
                .map((l, i) => (
                  <Chip
                    key={i}
                    label={`${LINK_TYPES[l.link_type].ar}: ${l.display}`}
                    onRemove={() => setLinks((prev) => prev.filter((x) => x !== l))}
                  />
                ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[10rem_8rem_1fr]">
              <select value={extraType} onChange={(e) => setExtraType(e.target.value as LinkType)} className="input">
                {Object.entries(LINK_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.ar}</option>
                ))}
              </select>
              <select value={extraKind} onChange={(e) => setExtraKind(e.target.value as "entity" | "doc")} className="input">
                <option value="entity">كيان</option>
                <option value="doc">مستند</option>
              </select>
              {extraKind === "entity" ? (
                <EntityPicker types={ENTITY_TYPE_ORDER} creatable={creatable} onPick={(t) => addLink(`extra-${extraType}`, extraType, t)} />
              ) : (
                <DocPicker categories={[]} onPick={(t) => addLink(`extra-${extraType}`, extraType, t)} />
              )}
            </div>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">4. الملف</h2>
        <DropZone required onFiles={(fs) => setFile(fs[0] ?? null)} />
        {file && (
          <p className="text-xs text-gray-500">
            {file.name} · {formatBytes(file.size)} — تُحسب البصمة الرقمية (SHA-256) على الخادم بعد الرفع ولا تتغير.
          </p>
        )}
      </section>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!!busy}>
          {busy ?? "إدراج المستند"}
        </button>
        {missingIntake.length > 0 && type && (
          <p className="text-xs text-red-600">ناقص قبل الإدراج: {missingIntake.map((r) => r.label_ar).join("، ")}</p>
        )}
      </div>
    </form>
  );
}
