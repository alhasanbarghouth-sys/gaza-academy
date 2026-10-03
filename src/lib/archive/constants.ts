import type { ArchiveCategory, EntityType, LinkType, RecordStatus, DocLanguage, UserRole } from "@/types/database";

export const SENSITIVITY = [
  {
    level: 0,
    code: "S0",
    name: "عام",
    who: "أي زائر للأداة دون تسجيل دخول",
    examples: "الرؤية والرسالة، البيانات الرسمية المنشورة، الإصدارات، الجوائز",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
  {
    level: 1,
    code: "S1",
    name: "داخلي وشركاء",
    who: "مستخدم مسجل بحسب دوره ونطاقه",
    examples: "الخطط، تقارير الإنجاز، المراسلات العامة، بطاقات الشركاء",
    className: "bg-sky-50 text-sky-700 ring-sky-600/20",
  },
  {
    level: 2,
    code: "S2",
    name: "مقيّد",
    who: "أدوار محددة ضمن نطاق مشروعها أو اختصاصها",
    examples: "السندات والعقود، المحاضر، تقارير التدقيق، الأزمات",
    className: "bg-amber-50 text-amber-800 ring-amber-600/20",
  },
  {
    level: 3,
    code: "S3",
    name: "سري",
    who: "أفراد مسمّون فقط. يُسجَّل كل اطلاع، ولا يظهر في نتائج البحث لغيرهم حتى كعنوان",
    examples: "ملفات الموظفين، قوائم المستفيدين وموافقاتهم، الشكاوى، الإحالات، تضارب المصالح، كشوف البنك",
    className: "bg-red-50 text-red-700 ring-red-600/20",
  },
] as const;

export const LINK_TYPES: Record<LinkType, { ar: string; meaning: string; example: string }> = {
  belongs_to: { ar: "يخص", meaning: "المستند ينتمي إلى كيان", example: "سند الصرف يخص المشروع P-001" },
  proves: { ar: "يُثبت", meaning: "المستند دليل على واقعة أو مستند آخر", example: "كشف الحضور يثبت إقامة النشاط A-0012" },
  based_on: {
    ar: "يستند إلى",
    meaning: "المستند يقوم على مستند أو قرار سابق",
    example: "سند الصرف يستند إلى موافقة الصرف وإلى عرض الأسعار الفائز",
  },
  results_from: { ar: "ينتج عن", meaning: "المستند نتيجة لمستند أو قرار", example: "السياسة الجديدة تنتج عن القرار R-014" },
  supersedes: {
    ar: "يحل محل",
    meaning: "إصدار جديد يلغي إصداراً قديماً دون إتلافه",
    example: "النظام الأساسي (2019) يحل محل (2012)",
  },
  responds_to: { ar: "يرد على", meaning: "المستند رد على مراسلة أو شكوى", example: "الرد المرسل يرد على الشكوى رقم 031" },
  published_in: {
    ar: "يُنشر في",
    meaning: "المستند الأصلي ظهر علناً في منشور",
    example: "الصورة المؤرخة تنشر في منشور فيسبوك المؤرشف",
  },
  requires_consent: {
    ar: "يتطلب موافقة",
    meaning: "لا يجوز استخدام المستند إلا مع موافقة مسجلة",
    example: "الصورة تتطلب موافقة مسجلة في 08.03",
  },
};

export const ENTITY_TYPES: Record<EntityType, { ar: string; pattern: string; meaning: string; example: string }> = {
  program: { ar: "برنامج", pattern: "PG-n", meaning: "أحد البرامج الأربعة الكبرى", example: "الدعم النفسي الاجتماعي" },
  project: { ar: "مشروع", pattern: "P-nnn", meaning: "مشروع بميزانية وفترة ومانح", example: "P-001" },
  donor: { ar: "مانح / جهة تمويل", pattern: "D-nn", meaning: "جهة تمول مشروعاً أو تبرعاً", example: "Diakonia، Enabel" },
  organization: {
    ar: "شريك / جهة",
    pattern: "O-nn",
    meaning: "جهة تتعاون أو تتعامل مع الجمعية",
    example: "مديرية التربية، مركز القطان",
  },
  person: { ar: "شخص", pattern: "E-nnn", meaning: "موظف أو متطوع أو عضو هيئة أو مستشار", example: "—" },
  beneficiary: { ar: "مستفيد (مجهَّل)", pattern: "B-nnnn", meaning: "رمز لا يكشف الاسم", example: "—" },
  activity: { ar: "نشاط", pattern: "A-nnnn", meaning: "ورشة أو عرض أو تدريب أو فعالية", example: "تدريب صناعة الدمى" },
  event: { ar: "حدث / أزمة", pattern: "X-nnn", meaning: "حادثة أو أزمة أو واقعة هامة", example: "—" },
  period: { ar: "فترة", pattern: "T-yyyy", meaning: "سنة مالية", example: "T-2026" },
  decision: { ar: "قرار", pattern: "R-nnn", meaning: "قرار في سجل القرارات", example: "R-014" },
  procurement_case: {
    ar: "ملف حالة (عروض)",
    pattern: "C-nnn",
    meaning: "يجمع العروض المتنافسة على الحالة الواحدة لتكون قابلة للمقارنة",
    example: "عطاء تركيب شبكة الإنترنت",
  },
};

export const ENTITY_TYPE_ORDER: EntityType[] = [
  "program",
  "project",
  "activity",
  "donor",
  "organization",
  "period",
  "decision",
  "event",
  "procurement_case",
  "person",
  "beneficiary",
];

// facilitator and coordinator use the «موظف» row of the matrix (as in the database).
export function archiveRole(role: UserRole): string {
  return role === "facilitator" || role === "coordinator" ? "staff" : role;
}

// Mirrors archive_create_entity() so the UI only offers what will be accepted.
export const ENTITY_CREATORS: Record<EntityType, string[]> = {
  program: ["executive_director", "archivist"],
  project: ["executive_director", "project_manager", "archivist"],
  donor: ["executive_director", "project_manager", "accountant", "archivist"],
  organization: ["executive_director", "project_manager", "accountant", "archivist"],
  person: ["executive_director", "archivist"],
  beneficiary: ["executive_director", "project_manager", "staff", "volunteer", "archivist"],
  activity: ["executive_director", "project_manager", "staff", "volunteer", "archivist"],
  event: ["executive_director", "project_manager", "staff", "archivist"],
  period: ["executive_director", "accountant", "archivist"],
  decision: ["executive_director", "archivist"],
  procurement_case: ["executive_director", "project_manager", "accountant", "archivist"],
};

export const ENTITY_PARENT_TYPE: Partial<Record<EntityType, EntityType>> = {
  project: "program",
  activity: "project",
  procurement_case: "project",
  event: "project",
};

export const MATRIX_ROLE_LABELS: Record<string, string> = {
  donor: "شريك / مانح",
  volunteer: "متطوع",
  staff: "موظف (والميسر والمنسق)",
  project_manager: "مدير مشروع",
  accountant: "المدير المالي",
  executive_director: "المدير التنفيذي",
  board_member: "مجلس الإدارة",
  archivist: "مسؤول قاعدة البيانات المؤسسية",
  system_admin: "مدير النظام التقني",
  auditor: "مدقق خارجي (مؤقت)",
};

export const RECORD_STATUS_AR: Record<RecordStatus, string> = {
  original: "أصل",
  modified_copy: "نسخة معدلة",
  draft: "مسودة",
  final: "نهائي",
};

export const LANGUAGE_AR: Record<DocLanguage, string> = {
  ar: "العربية",
  en: "الإنجليزية",
  ar_en: "العربية والإنجليزية",
};

export const OFFER_PROVIDER_AR = {
  individual: "فرد",
  organization: "منظمة / شركة",
  group: "مجموعة",
} as const;

export const MEMBER_ROLE_AR = {
  manager: "مدير المشروع",
  member: "عضو الفريق",
  donor: "المانح (اطلاع)",
} as const;

export const DESIGNATIONS: Record<string, string> = {
  protection_coordinator: "منسق الحماية والشكاوى",
  external_auditor: "مدقق خارجي",
  hr_officer: "مسؤول الموارد البشرية",
  communications_officer: "مسؤول الاتصال",
  named_access: "تفويض مسمّى",
};

// One click creates the set of grants the matrix describes for a named role.
export const GRANT_PRESETS: Record<string, { prefix: string; max: number; insert: boolean }[]> = {
  protection_coordinator: [
    { prefix: "08.06", max: 3, insert: true },
    { prefix: "09", max: 3, insert: true },
    { prefix: "14", max: 2, insert: false },
  ],
  external_auditor: [
    { prefix: "04", max: 3, insert: false },
    { prefix: "03", max: 3, insert: false },
    { prefix: "16.02", max: 3, insert: false },
  ],
  hr_officer: [{ prefix: "05", max: 3, insert: true }],
  communications_officer: [{ prefix: "11", max: 2, insert: true }],
};

export const PROJECT_FILE_SLOTS = [
  { key: "a", title: "أ. التصميم", codes: ["07.01"], note: "أصل المشروع" },
  { key: "b", title: "ب. العقد والتمويل", codes: ["03.01", "04.03", "10.07"], note: "يُنشأ عند توقيع العقد" },
  { key: "c", title: "ج. السجل المالي", codes: ["04.04", "04.05", "04.08"], note: "تظهر السندات هنا بالرابط لا بالنسخ" },
  { key: "d", title: "د. التنفيذ", codes: ["07.09", "07.06", "03.07"], note: "" },
  { key: "e", title: "هـ. الرصد والنتائج", codes: ["07.02", "07.03", "07.04", "15.03"], note: "" },
  { key: "f", title: "و. الإثبات والوسائط", codes: ["07.07", "08.03", "11.09"], note: "لا يُنشر وسيط بلا رابط إلى موافقته" },
  { key: "g", title: "ز. الأفراد", codes: ["05", "10"], note: "مواد S3 مخفية لغير المخوَّلين" },
  { key: "h", title: "ح. الشكاوى والأزمات", codes: ["09", "14"], note: "" },
  { key: "i", title: "ط. التعلم والتواصل", codes: ["07.05", "11", "12"], note: "" },
] as const;

export type PackItem = { codes: string[]; mode: "docs" | "count"; note?: string };

export const EVIDENCE_PACKS: {
  key: string;
  title: string;
  extractedBy: string;
  roles: string[];
  designations: string[];
  items: PackItem[];
}[] = [
  {
    key: "finance",
    title: "حزمة المالية",
    extractedBy: "المدير المالي والمدير التنفيذي",
    roles: ["accountant", "executive_director"],
    designations: ["external_auditor"],
    items: [
      { codes: ["04.01", "04.02", "04.03"], mode: "docs" },
      { codes: ["04.04"], mode: "docs", note: "عينات السندات" },
      { codes: ["04.05", "04.07", "02.05", "03.06"], mode: "docs" },
      { codes: ["16.03"], mode: "docs", note: "سجلات الإصدارات" },
    ],
  },
  {
    key: "protection",
    title: "حزمة الحماية",
    extractedBy: "منسق الحماية والمدير التنفيذي",
    roles: ["executive_director"],
    designations: ["protection_coordinator"],
    items: [
      { codes: ["02.03"], mode: "docs", note: "سياسة الحماية" },
      { codes: ["05.04", "05.05", "03.06"], mode: "docs", note: "الإقرارات والتدريب والتزامات المانحين" },
      { codes: ["09", "08.06"], mode: "count", note: "بيانات وصفية: العدد فقط" },
      { codes: ["14"], mode: "docs" },
    ],
  },
  {
    key: "recruitment",
    title: "حزمة التوظيف",
    extractedBy: "مدير الموارد البشرية",
    roles: ["executive_director"],
    designations: ["hr_officer"],
    items: [
      { codes: ["05.02"], mode: "docs" },
      { codes: ["05.01"], mode: "docs", note: "مختارات" },
      { codes: ["05.03", "05.08"], mode: "docs" },
      { codes: ["02.03"], mode: "docs", note: "سياسة التوظيف" },
      { codes: ["02.04"], mode: "docs" },
    ],
  },
  {
    key: "beneficiaries",
    title: "حزمة المستفيدين",
    extractedBy: "مدير البرامج",
    roles: ["project_manager", "executive_director"],
    designations: [],
    items: [
      { codes: ["08.01"], mode: "docs" },
      { codes: ["08.03"], mode: "count", note: "إحصاء لا أسماء" },
      { codes: ["08.04", "08.05"], mode: "docs" },
      { codes: ["07.06"], mode: "count", note: "مجمّع" },
      { codes: ["15.03"], mode: "docs" },
    ],
  },
  {
    key: "reputation",
    title: "حزمة السمعة والإعلام",
    extractedBy: "مسؤول الاتصال والمدير التنفيذي",
    roles: ["executive_director", "archivist"],
    designations: ["communications_officer"],
    items: [
      { codes: ["11.01", "11.02", "11.03", "11.07", "11.08"], mode: "docs" },
      { codes: ["12"], mode: "docs" },
      { codes: ["14.03", "14.07"], mode: "docs" },
    ],
  },
];

export const WEBSITE_MAP = [
  { section: "تعرف علينا: الرسالة، الرؤية، الأهداف", codes: "01.03 و01.06", note: "تُحفظ بنسخة مؤرخة ويُربط بها المحضر المعتمد إن وُجد" },
  { section: "طاقم بسمة: مجلس الإدارة، الجمعية العمومية، الهيئة الإدارية", codes: "02.06 و01.04", note: "قوائم الأعضاء حسب الدورة" },
  { section: "طاقم بسمة: المتطوعون والمستشارون", codes: "05.09 و05.01", note: "S2–S3 حسب الصفة" },
  { section: "أخبار بسمة: أخبار الجمعية", codes: "07.09 + 11.03", note: "يُنشأ سجل نشاط لكل خبر، ويُؤرشف الخبر كما نُشر" },
  { section: "أخبار بسمة: ظهورها الإعلامي", codes: "11.02", note: "" },
  { section: "البرامج (الأربعة)", codes: "07 (PG-1 إلى PG-4)", note: "يُدقق المسار الفعلي للصفحة، فقد أعاد /basmaprograms/ خطأ 404" },
  { section: "التقارير: مالية", codes: "04.01 و04.02", note: "S2، ولا تُنشر المنشورة منها إلا بقرار" },
  { section: "التقارير: إدارية", codes: "02.01 و11.05", note: "" },
  { section: "التقارير: المشاريع", codes: "07.02", note: "يُدقق المسار الفعلي، فقد أعاد /basmareports/ خطأ 404" },
  { section: "المطبوعات: منشورات دعائية", codes: "11.05", note: "" },
  { section: "المطبوعات: المواثيق الدولية والمحلية", codes: "03.05 أو 02.03", note: "بحسب كونها اعتمادات أو سياسات" },
  { section: "المطبوعات: اللوائح", codes: "02.03", note: "مع تواريخ السريان" },
  { section: "المطبوعات: النشرة الشهرية", codes: "11.05", note: "" },
  { section: "الاستديو: الصور والفيديو", codes: "11.09 + 07.07", note: "لا يُنشر ما لا موافقة له (08.03)" },
  { section: "طلب التطوع", codes: "05.09", note: "S2" },
  { section: "اقتراحات وشكاوى", codes: "09.01 و09.05", note: "كل رسالة ترد تُسجَّل بقناتها وتاريخها" },
];

export const SOURCE_SUGGESTIONS = [
  "داخلي",
  "الموقع الإلكتروني (basmaorg.org)",
  "الموقع: أخبار بسمة",
  "الموقع: المطبوعات",
  "الموقع: الاستديو",
  "فيسبوك",
  "إنستغرام",
  "إكس",
  "يوتيوب",
  "مراسلة واردة",
  "جهة مانحة",
  "جهة رسمية",
  "بريد إلكتروني",
];

export const PRINCIPLES = [
  { title: "موضع أصلي واحد وروابط متعددة", body: "يُحفظ كل مستند مرة واحدة فقط، والظهور في الأماكن الأخرى يتم بالربط لا بالنسخ." },
  { title: "الكيان هو محور الربط", body: "المشروع والمانح والنشاط والفترة والقرار والحدث كيانات لها بطاقات تتجمع حولها المستندات." },
  { title: "الفئة تُحدد بطبيعة المستند لا بسياقه", body: "السند مالي ولو خُصص لمشروع، والسياق محفوظ في الروابط." },
  { title: "الحساسية خاصية للمستند لا للفئة", body: "للفئة درجة افتراضية، ويمكن رفعها لكل مستند ولا يمكن خفضها." },
  { title: "المستفيد لا يظهر باسمه إلا في موضع واحد", body: "يُرمَّز المستفيد برمز مجهَّل (B-xxxx)، ولا يُكشف الاسم إلا في 08.02 لمن له صلاحية صريحة." },
  {
    title: "فصل المهام",
    body: "مسؤول قاعدة البيانات المؤسسية يدير التصنيف والبيانات الوصفية ولا يقرأ محتوى المواد السرية، ومدير النظام التقني لا يقرأ المحتوى. ولا يستطيع أحد أن يمحو أثر اطلاعه.",
  },
];

export function sensitivityCode(level: number) {
  return `S${level}`;
}

export function categoryMatches(code: string, prefix: string) {
  return prefix === "*" || code === prefix || code.startsWith(prefix + ".");
}

export function isLeaf(code: string, categories: ArchiveCategory[]) {
  return !categories.some((c) => c.parent_code === code);
}

export function categoryPath(code: string, categories: ArchiveCategory[]): ArchiveCategory[] {
  const byCode = new Map(categories.map((c) => [c.code, c]));
  const path: ArchiveCategory[] = [];
  let cur = byCode.get(code);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_code ? byCode.get(cur.parent_code) : undefined;
  }
  return path;
}

const BASIS_EVENT_AR: Record<string, string> = {
  project_end: "إغلاق المشروع أو السنة المالية",
  contract_end: "انتهاء العقد",
  service_end: "انتهاء الخدمة",
  closure: "الإغلاق",
};

function addYears(date: string, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** «مدة الاحتفاظ وتاريخ الانتهاء — آلي من جدول 16.01 بحسب التصنيف». */
export function retentionFor(
  category: Pick<ArchiveCategory, "retention_basis" | "retention_years" | "retention_note_ar">,
  documentDate: string,
  linkedEndDate: string | null
): { label: string; until: string | null } {
  const years = category.retention_years ?? 0;
  switch (category.retention_basis) {
    case "permanent":
      return { label: "دائم", until: null };
    case "document_date":
      return { label: `${years} سنوات من تاريخ المستند`, until: addYears(documentDate, years) };
    case "project_end":
    case "service_end":
      return {
        label: `${years} سنوات بعد ${BASIS_EVENT_AR[category.retention_basis]}`,
        until: linkedEndDate ? addYears(linkedEndDate, years) : null,
      };
    case "contract_end":
      return { label: `${years} سنوات بعد ${BASIS_EVENT_AR.contract_end}`, until: null };
    case "closure":
      return { label: `${years} سنوات بعد ${BASIS_EVENT_AR.closure}`, until: null };
    default:
      return { label: category.retention_note_ar ?? "—", until: null };
  }
}

// Archive numbers and dates use Latin digits throughout so they read and sort the same everywhere.
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_ARCHIVE_FILE_BYTES = 50 * 1024 * 1024;

// PostgREST filter strings are comma/parenthesis-delimited; strip those from user text.
export function sanitizeSearch(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim().slice(0, 100);
}
