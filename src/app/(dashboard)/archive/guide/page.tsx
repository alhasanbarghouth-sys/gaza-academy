import Link from "next/link";
import { getTaxonomy } from "@/lib/archive/data";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_ORDER,
  EVIDENCE_PACKS,
  LINK_TYPES,
  PRINCIPLES,
  SENSITIVITY,
  WEBSITE_MAP,
} from "@/lib/archive/constants";
import { SensitivityBadge } from "../_components/badges";

const NOTES = [
  "الروابط الإلزامية نوعان: «عند الإدراج» (كيانات موجودة مسبقاً كالمشروع والمانح والفترة) تمنع الحفظ حتى تُملأ؛ و«لاكتمال الملف» (مستندات تصدر عادة بعده) يُقبل المستند معها ويظهر في «نواقص الربط» حتى تُربط. السبب: بعض القواعد متبادلة، فالفاتورة تشترط سند الصرف الذي سددها والسند يشترط الفاتورة، وكشف البنك يصدر آخر الشهر.",
  "الرابط بين مستندين يُحتسب للطرفين، فربطة واحدة بين الفاتورة والسند تكمل الاثنين.",
  "روابط شرطية بطبيعتها جُعلت «إن وُجد»: التصاريح للعقد، السياسات الناتجة عن المحضر، التفاعلات مع البيان، الإشاعات في الأزمة، إضافة إلى ما نص عليه المخطط (ملف المشتريات للفاتورة، تضارب المصالح للعرض، الحدث للشكوى).",
  "أُضيف كيان «ملف حالة» (C-nnn) ليجمع العروض المتنافسة على الحالة الواحدة كما في 04.04.04.",
  "ملف الموظف يُربط إلزامياً ببطاقة الشخص (E-nnn)، وبها يقرأ الموظف ملفه الشخصي في 05 كما تنص المصفوفة.",
  "تصنيفات 04.04.01–04.04.04 و07.06 و07.07 و09.01 تقبل نوعها فقط، حتى لا يُتجاوز قواعد ربطها باختيار نوع عام.",
  "المصفوفة لم تُسند الإدراج في 05 و06 لأي دور؛ أُسند للمدير التنفيذي، ويمكن منح مسؤول الموارد البشرية تفويضاً بإدراج 05.",
  "دليل المستخدم 16.07 مقروء لكل الأدوار الداخلية. الميسر والمنسق يتبعان صف «موظف».",
  "مستند S0 لا يظهر للزائر وهو «مسودة». ولا يمكن خفض الحساسية بعد الإدراج، ولا تغيير رقم الأرشفة أو التصنيف أو النوع.",
  "سجل تعديلات الأرشيف منفصل عن سجل النظام العام، لأن لقطاته تحمل عناوين مواد مقيّدة لا يجوز أن يقرأها مدير النظام التقني.",
  "مدد الاحتفاظ لـ 06 و10 و16 لم ترد في الجدول المقترح فبقيت «بانتظار القرار». والجدول كله مقترح ويحتاج مراجعة قانونية.",
  "المصادقة الثنائية (شرط الانتقال للمرحلة 2) لم تُفعّل بعد.",
];

export default async function ArchiveGuidePage() {
  const { axes, categories, docTypes, rules } = await getTaxonomy();
  const sections = categories.filter((c) => c.level === 1);
  const typeName = new Map(docTypes.map((t) => [t.code, t]));
  const ruleTypes = Array.from(new Set(rules.map((r) => r.doc_type)));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        مرجع «المخطط التصنيفي ونموذج الربط» كما هو مطبَّق في النظام (16.07 دليل المستخدم والأدوار). المحاور والتصنيفات وقواعد
        الربط أدناه تُقرأ مباشرة من قاعدة البيانات.
      </p>

      <details className="card" open>
        <summary className="cursor-pointer font-bold">المبادئ المعمارية</summary>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-gray-700">
          {PRINCIPLES.map((p) => (
            <li key={p.title}>
              <span className="font-semibold">{p.title}.</span> {p.body}
            </li>
          ))}
        </ol>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">المحاور الخمسة والبنود الستة عشر</summary>
        <div className="mt-3 space-y-3">
          {axes.map((a) => (
            <div key={a.code}>
              <p className="text-sm font-bold text-brand-700">{a.letter}. {a.name_ar}</p>
              <ul className="mt-1 space-y-1 text-sm">
                {sections.filter((s) => s.axis_code === a.code).map((s) => (
                  <li key={s.code}>
                    <Link href={`/archive/category/${s.code}`} className="font-semibold hover:underline">
                      {s.code} {s.name_ar}
                    </Link>{" "}
                    <span className="text-xs text-gray-500">
                      (رقمه في التعريف {s.original_item_no}) — {s.placement_note_ar}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">الشجرة التفصيلية ({categories.filter((c) => c.level > 1).length} تصنيفاً فرعياً)</summary>
        <div className="mt-3 space-y-5">
          {sections.map((s) => (
            <div key={s.code}>
              <p className="font-bold">{s.code} — {s.name_ar}</p>
              <p className="text-xs text-gray-500">{s.materials_ar}</p>
              <ul className="mt-2 divide-y divide-black/5">
                {categories.filter((c) => c.code.startsWith(s.code + ".")).map((c) => (
                  <li key={c.code} className={`py-2 text-sm ${c.level === 3 ? "pr-6" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="font-mono text-xs text-gray-400">{c.code}</span>
                      <span className="font-semibold">{c.name_ar}</span>
                      {c.default_sensitivity !== null && <SensitivityBadge level={c.default_sensitivity} />}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">{c.materials_ar}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {c.related_ar && `الروابط: ${c.related_ar} · `}الاحتفاظ: {c.retention_note_ar}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">سجل الكيانات وأنواع الروابط</summary>
        <ul className="mt-3 space-y-1 text-sm">
          {ENTITY_TYPE_ORDER.map((t) => (
            <li key={t}>
              <span className="font-semibold">{ENTITY_TYPES[t].ar}</span>{" "}
              <span dir="ltr" className="font-mono text-xs text-gray-400">{ENTITY_TYPES[t].pattern}</span> —{" "}
              {ENTITY_TYPES[t].meaning}
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1 border-t border-black/5 pt-3 text-sm">
          {Object.values(LINK_TYPES).map((l) => (
            <li key={l.ar}>
              <span className="font-semibold">{l.ar}</span>: {l.meaning}. <span className="text-xs text-gray-500">مثال: {l.example}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">قواعد الربط الإلزامية</summary>
        <ul className="mt-3 divide-y divide-black/5">
          {ruleTypes.map((code) => (
            <li key={code} className="py-2.5 text-sm">
              <p className="font-semibold">
                {typeName.get(code)?.name_ar}{" "}
                <span dir="ltr" className="font-mono text-xs text-gray-400">{typeName.get(code)?.fixed_category}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {rules.filter((r) => r.doc_type === code).map((r) => (
                  <span
                    key={r.req_key}
                    className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                      r.is_optional ? "bg-gray-100 text-gray-500" : r.stage === "intake" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                    }`}
                  >
                    {r.label_ar}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          <span className="text-red-700">أحمر</span>: عند الإدراج · <span className="text-orange-700">برتقالي</span>: لاكتمال الملف ·
          رمادي: إن وُجد
        </p>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">درجات الحساسية</summary>
        <ul className="mt-3 space-y-2 text-sm">
          {SENSITIVITY.map((s) => (
            <li key={s.code}>
              <SensitivityBadge level={s.level} withName /> {s.who}. <span className="text-xs text-gray-500">أمثلة: {s.examples}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          المصفوفة الكاملة للأدوار في <Link href="/archive/access" className="underline">الصلاحيات والسجلات</Link>.
        </p>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">خريطة مطابقة الموقع الإلكتروني بالتصنيف</summary>
        <ul className="mt-3 divide-y divide-black/5 text-sm">
          {WEBSITE_MAP.map((w) => (
            <li key={w.section} className="py-2">
              <span className="font-semibold">{w.section}</span> ← <span dir="ltr" className="font-mono text-xs">{w.codes}</span>
              {w.note && <span className="block text-xs text-gray-500">{w.note}</span>}
            </li>
          ))}
        </ul>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">حزم الأدلة الجاهزة</summary>
        <ul className="mt-3 space-y-1 text-sm">
          {EVIDENCE_PACKS.map((p) => (
            <li key={p.key}>
              <span className="font-semibold">{p.title}</span>:{" "}
              <span dir="ltr" className="font-mono text-xs">{p.items.map((i) => i.codes.join(" ")).join(" · ")}</span>{" "}
              <span className="text-xs text-gray-500">— {p.extractedBy}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="card">
        <summary className="cursor-pointer font-bold">ملاحظات التطبيق (حيث احتاج المخطط إلى تفسير)</summary>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-gray-700">
          {NOTES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
