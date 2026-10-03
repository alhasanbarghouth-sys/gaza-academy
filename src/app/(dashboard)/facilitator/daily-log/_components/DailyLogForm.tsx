"use client";

import { useRef, useState } from "react";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/rbac";
import { BENEFICIARY_CATEGORIES, OTHER_PROJECT, PROJECTS } from "@/lib/activity";
import PeoplePicker, { type Person } from "@/components/PeoplePicker";
import SubmitButton from "@/components/SubmitButton";
import type { Camp } from "@/types/database";
import CampPicker from "./CampPicker";
import GbvQuestion from "./GbvQuestion";
import { createActivitySession } from "../actions";

const MAX_BLOCKS = 6;
const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];

type Block = { key: number; project: string };

/**
 * One report per project. A facilitator who worked on several projects in the
 * same day adds a block per project and answers every question for each one;
 * each block is saved as its own activity.
 */
export default function DailyLogForm({ camps, people, today }: { camps: Camp[]; people: Person[]; today: string }) {
  const nextKey = useRef(1);
  const [blocks, setBlocks] = useState<Block[]>([{ key: 0, project: "" }]);

  const setProject = (key: number, project: string) =>
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, project } : b)));
  const add = () => {
    const key = nextKey.current++;
    setBlocks((bs) => [...bs, { key, project: "" }]);
  };
  const remove = (key: number) => setBlocks((bs) => bs.filter((b) => b.key !== key));

  return (
    <form action={createActivitySession} className="space-y-5">
      <div className="card">
        <div className="max-w-xs">
          <label className="label" htmlFor="activity_date">التاريخ</label>
          <input id="activity_date" name="activity_date" type="date" required defaultValue={today} className="input" />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          التقرير الواحد يخص مشروعاً واحداً. إذا عملت اليوم على أكثر من مشروع، اضغط «عملت على مشروع آخر في نفس اليوم»
          وأجب على الأسئلة نفسها لكل مشروع على حدة.
        </p>
      </div>

      {blocks.map((b, i) => {
        const p = `b${b.key}_`;
        const takenElsewhere = new Set(blocks.filter((o) => o.key !== b.key).map((o) => o.project));
        return (
          <section key={b.key} className="card space-y-5" aria-label={`تقرير المشروع ${ORDINALS[i]}`}>
            <input type="hidden" name="block" value={b.key} />
            {blocks.length > 1 && (
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <h2 className="font-bold text-brand-700">المشروع {ORDINALS[i]}</h2>
                {i > 0 && (
                  <button type="button" onClick={() => remove(b.key)} className="text-xs text-gray-500 hover:text-red-600">
                    حذف هذا المشروع
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`${p}project`}>المشروع</label>
                <select
                  id={`${p}project`}
                  name={`${p}project`}
                  required
                  className="input"
                  value={b.project}
                  onChange={(e) => setProject(b.key, e.target.value)}
                >
                  <option value="" disabled>
                    اختر المشروع...
                  </option>
                  {PROJECTS.map((name) => (
                    <option key={name} value={name} disabled={takenElsewhere.has(name)}>
                      {name}
                    </option>
                  ))}
                  <option value={OTHER_PROJECT}>مشروع آخر</option>
                </select>
                {b.project === OTHER_PROJECT && (
                  <input name={`${p}project_other`} required placeholder="اكتب اسم المشروع" className="input mt-2" />
                )}
              </div>
              <div>
                <label className="label" htmlFor={`${p}activity_type`}>نوع النشاط</label>
                <select id={`${p}activity_type`} name={`${p}activity_type`} required className="input">
                  {ACTIVITY_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <CampPicker camps={camps} prefix={p} />

            <div>
              <p className="label">اشتغلت مع (اختر كل من شاركك هذا النشاط)</p>
              <p className="mb-2 text-xs text-gray-400">
                مهم: أدخل عدد المستفيدين الفعلي والإجمالي لهذا النشاط مرة واحدة فقط — سواء اشتغلتم عليه شخص واحد أو عدة
                أشخاص، حتى لا يتكرر احتساب نفس المستفيدين لكل شخص من الطاقم.
              </p>
              <PeoplePicker people={people} name={`${p}participants`} />
            </div>

            <div>
              <p className="label">عدد المستفيدين الفعلي لهذا النشاط (رقم واحد، غير مكرر لكل مشارك من الطاقم)</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {BENEFICIARY_CATEGORIES.map((c) => (
                  <div key={c.column}>
                    <label className="mb-1 block text-xs text-gray-500" htmlFor={`${p}${c.column}`}>{c.label}</label>
                    <input id={`${p}${c.column}`} name={`${p}${c.column}`} type="number" min={0} defaultValue={0} className="input" />
                  </div>
                ))}
              </div>
            </div>

            <GbvQuestion prefix={p} />

            <div>
              <label className="label" htmlFor={`${p}description`}>وصف النشاط</label>
              <textarea id={`${p}description`} name={`${p}description`} rows={3} className="input" />
            </div>
            <div>
              <label className="label" htmlFor={`${p}challenges`}>تحديات واجهتها (اختياري)</label>
              <textarea id={`${p}challenges`} name={`${p}challenges`} rows={2} className="input" />
            </div>
          </section>
        );
      })}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {blocks.length < MAX_BLOCKS ? (
          <button type="button" onClick={add} className="btn-secondary">
            + عملت على مشروع آخر في نفس اليوم
          </button>
        ) : (
          <span />
        )}
        <SubmitButton pendingLabel="جارٍ الحفظ...">
          {blocks.length > 1 ? `حفظ ${blocks.length} تقارير (تقرير لكل مشروع)` : "حفظ النشاط"}
        </SubmitButton>
      </div>
    </form>
  );
}
