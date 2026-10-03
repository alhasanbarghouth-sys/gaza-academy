import JSZip from "jszip";
import { GoogleGenAI } from "@google/genai";
import type { ArchiveCategory, ArchiveDocType, ArchiveEntity, ArchiveLinkRule, LinkType } from "@/types/database";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Gemini accepts inline files up to ~20 MB per request; larger files are classified from their name.
const MAX_INLINE_BYTES = 18 * 1024 * 1024;
const MAX_TEXT_CHARS = 40_000;
const LINK_TYPES: LinkType[] = [
  "belongs_to", "proves", "based_on", "results_from", "supersedes", "responds_to", "published_in", "requires_consent",
];

export type SuggestedLink = { entity_id: string; code: string; name: string | null; entity_type: string; link_type: LinkType };

export type Suggestion = {
  doc_type: string;
  category_code: string;
  title: string;
  title_en: string;
  document_date: string;
  source: string;
  sensitivity: number;
  language: "ar" | "en" | "ar_en";
  record_status: "original" | "modified_copy" | "draft" | "final";
  keywords: string;
  budget_line: string;
  links: SuggestedLink[];
  /** Names the AI found in the file that match nothing registered yet (a donor, project…). */
  unmatched: string[];
  summary: string;
  confidence: "high" | "medium" | "low";
  read_content: boolean;
};

export type ClassifyContext = {
  categories: ArchiveCategory[];
  insertable: string[];
  docTypes: ArchiveDocType[];
  rules: ArchiveLinkRule[];
  entities: ArchiveEntity[];
  today: string;
};

const strip = (xml: string) =>
  xml
    .replace(/<\/(w:p|a:p|si|row)>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

/** Turns the file into something Gemini can read: the file itself (PDF, image) or its text (Office, text). */
async function fileParts(buf: Buffer, name: string, mime: string): Promise<{ parts: object[]; readContent: boolean }> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const nameOnly = { parts: [], readContent: false };

  if (mime === "application/pdf" || ext === "pdf" || /^image\/(png|jpe?g|webp|heic|heif)$/.test(mime)) {
    if (buf.length > MAX_INLINE_BYTES) return nameOnly;
    const type = mime || (ext === "pdf" ? "application/pdf" : "image/jpeg");
    return { parts: [{ inlineData: { mimeType: type, data: buf.toString("base64") } }], readContent: true };
  }

  try {
    if (["docx", "xlsx", "pptx"].includes(ext)) {
      const zip = await JSZip.loadAsync(buf);
      const files =
        ext === "docx"
          ? ["word/document.xml"]
          : ext === "xlsx"
            ? ["xl/sharedStrings.xml"]
            : Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
      let text = "";
      for (const f of files) text += strip((await zip.file(f)?.async("string")) ?? "") + "\n";
      text = text.trim().slice(0, MAX_TEXT_CHARS);
      return text ? { parts: [{ text: `محتوى الملف (نص مستخرج):\n${text}` }], readContent: true } : nameOnly;
    }
    if (mime.startsWith("text/") || ["txt", "csv", "md", "json"].includes(ext)) {
      const text = buf.toString("utf8").slice(0, MAX_TEXT_CHARS);
      return { parts: [{ text: `محتوى الملف:\n${text}` }], readContent: true };
    }
  } catch {
    return nameOnly;
  }
  return nameOnly;
}

function instructions(ctx: ClassifyContext, fileName: string, readContent: boolean) {
  const byCode = new Map(ctx.categories.map((c) => [c.code, c]));
  const leaves = ctx.insertable
    .map((code) => byCode.get(code))
    .filter((c): c is ArchiveCategory => !!c)
    .map((c) => `${c.code} | ${c.name_ar} | ${c.materials_ar ?? ""} | S${c.default_sensitivity ?? 1}${c.exclusive_doc_type ? ` | خاص بالنوع ${c.exclusive_doc_type}` : ""}`)
    .join("\n");
  const types = ctx.docTypes
    .map((t) => `${t.code} | ${t.name_ar}${t.fixed_category ? ` | موضعه الإلزامي ${t.fixed_category}` : ""}`)
    .join("\n");
  const required = ctx.rules
    .filter((r) => r.stage === "intake" && !r.is_optional && r.entity_types.length)
    .map((r) => `${r.doc_type}: ${r.label_ar} (${r.entity_types.join("/")}) — ${r.default_link_type}`)
    .join("\n");
  const entities = ctx.entities.map((e) => `${e.code} | ${e.entity_type} | ${e.name ?? ""}`).join("\n");

  return `أنت موظف أرشفة في «جمعية بسمة للثقافة والفنون» (غزة). صنّف الملف المرفق وفق خطة التصنيف أدناه، واقترح بيانات وصفه.
اسم الملف: ${fileName}
${readContent ? "" : "تنبيه: لم يُقرأ محتوى الملف (نوعه أو حجمه لا يسمح)، فاعتمد على اسمه فقط وخفّض الثقة.\n"}
التصنيفات المتاحة (الرمز | الاسم | ما يحفظ فيه | الحساسية الدنيا):
${leaves}

أنواع المستندات (الرمز | الاسم | الموضع الإلزامي إن وُجد):
${types}

الروابط الإلزامية عند الإدراج لكل نوع:
${required}

الكيانات المسجلة (الرمز | النوع | الاسم):
${entities}

القواعد:
- category_code من القائمة أعلاه فقط. إن كان للنوع موضع إلزامي فاستخدمه.
- استخدم نوعاً محدداً (مثل invoice، payment_voucher، contract) حين ينطبق؛ وإلا نوعاً عاماً (report، letter، photo…).
- sensitivity رقم 0-3، لا يقل عن حساسية التصنيف. ارفعها إن احتوى الملف أسماء مستفيدين أو بيانات شخصية أو مالية حساسة.
- title: عنوان عربي وصفي ثابت الصيغة (ما هو + الجهة/المشروع + الفترة)، لا اسم الملف.
- document_date: تاريخ المستند نفسه بصيغة YYYY-MM-DD، لا يتجاوز ${ctx.today}. إن لم يظهر فاترك "".
- source: الجهة التي أصدرت المستند.
- links: رموز كيانات من القائمة أعلاه فقط، مع نوع الرابط (${LINK_TYPES.join("، ")}). أدرج الروابط الإلزامية للنوع متى عرفتها.
- unmatched: أسماء مشاريع أو مانحين أو جهات ظهرت في الملف وليست في القائمة.
- summary: سطر أو سطران بالعربية عمّا يحويه الملف.
- confidence: high أو medium أو low.

أجب بكائن JSON واحد فقط بهذه الحقول:
{"doc_type":"","category_code":"","title":"","title_en":"","document_date":"","source":"","sensitivity":1,"language":"ar|en|ar_en","record_status":"original|modified_copy|draft|final","keywords":"","budget_line":"","links":[{"code":"","link_type":""}],"unmatched":[],"summary":"","confidence":"medium"}`;
}

/** Keeps the AI's answer inside the scheme: real codes only, the right category for fixed types, a sensitivity floor. */
function normalize(raw: Record<string, unknown>, ctx: ClassifyContext, readContent: boolean): Suggestion {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const byCode = new Map(ctx.categories.map((c) => [c.code, c]));
  const insertable = new Set(ctx.insertable);

  let docType = ctx.docTypes.find((t) => t.code === str(raw.doc_type));
  let category = str(raw.category_code);
  if (docType?.fixed_category) category = docType.fixed_category;
  if (!insertable.has(category)) category = "";
  const cat = byCode.get(category);
  if (cat?.exclusive_doc_type) docType = ctx.docTypes.find((t) => t.code === cat.exclusive_doc_type);
  if (docType?.fixed_category && docType.fixed_category !== category) docType = undefined;

  const floor = cat?.default_sensitivity ?? 1;
  const sens = Math.min(3, Math.max(floor, Math.round(Number(raw.sensitivity) || floor)));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(raw.document_date)) && str(raw.document_date) <= ctx.today ? str(raw.document_date) : "";

  const entityByCode = new Map(ctx.entities.map((e) => [e.code.toUpperCase(), e]));
  const seen = new Set<string>();
  const links: SuggestedLink[] = [];
  for (const l of Array.isArray(raw.links) ? raw.links : []) {
    const e = entityByCode.get(str((l as Record<string, unknown>)?.code).toUpperCase());
    if (!e) continue;
    const rule = ctx.rules.find((r) => r.doc_type === docType?.code && r.entity_types.includes(e.entity_type));
    const asked = str((l as Record<string, unknown>)?.link_type) as LinkType;
    const link_type = rule?.default_link_type ?? (LINK_TYPES.includes(asked) ? asked : "belongs_to");
    const key = `${e.id}:${link_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ entity_id: e.id, code: e.code, name: e.name, entity_type: e.entity_type, link_type });
  }

  const lang = str(raw.language);
  const status = str(raw.record_status);
  const conf = str(raw.confidence);
  return {
    doc_type: docType?.code ?? "",
    category_code: category,
    title: str(raw.title).slice(0, 300),
    title_en: str(raw.title_en).slice(0, 300),
    document_date: date,
    source: str(raw.source).slice(0, 200),
    sensitivity: sens,
    language: (["ar", "en", "ar_en"].includes(lang) ? lang : "ar") as Suggestion["language"],
    record_status: (["original", "modified_copy", "draft", "final"].includes(status) ? status : "original") as Suggestion["record_status"],
    keywords: str(raw.keywords).slice(0, 300),
    budget_line: str(raw.budget_line).slice(0, 100),
    links,
    unmatched: (Array.isArray(raw.unmatched) ? raw.unmatched : []).map(str).filter(Boolean).slice(0, 8),
    summary: str(raw.summary).slice(0, 600),
    confidence: (["high", "medium", "low"].includes(conf) ? conf : "low") as Suggestion["confidence"],
    read_content: readContent,
  };
}

export async function classifyFile(
  buf: Buffer,
  fileName: string,
  mime: string,
  ctx: ClassifyContext
): Promise<{ suggestion: Suggestion; tokens: number }> {
  if (!process.env.GEMINI_API_KEY) throw new Error("لم يتم إعداد مفتاح Gemini بعد (GEMINI_API_KEY في إعدادات Vercel)");
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
  });
  const { parts, readContent } = await fileParts(buf, fileName, mime);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [...parts, { text: instructions(ctx, fileName, readContent) }] }],
    config: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 4096 },
  });

  const text = response.text?.trim() ?? "";
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("لم يُرجع الذكاء الاصطناعي تصنيفاً مفهوماً، أعد المحاولة");
  }
  return { suggestion: normalize(raw, ctx, readContent), tokens: response.usageMetadata?.totalTokenCount ?? 0 };
}
