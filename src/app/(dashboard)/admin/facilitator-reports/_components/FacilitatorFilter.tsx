"use client";

import { useRef } from "react";

export default function FacilitatorFilter({
  facilitators,
  selected,
  from,
  to,
}: {
  facilitators: { id: string; full_name: string }[];
  selected: string;
  from: string;
  to: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" className="card grid gap-4 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor="facilitator">الميسر</label>
        <select id="facilitator" name="facilitator" defaultValue={selected} onChange={submit} className="input">
          <option value="">كل الميسرين</option>
          {facilitators.map((f) => (
            <option key={f.id} value={f.id}>
              {f.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="from">من تاريخ</label>
        <input id="from" name="from" type="date" defaultValue={from} onChange={submit} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="to">إلى تاريخ</label>
        <input id="to" name="to" type="date" defaultValue={to} onChange={submit} className="input" />
      </div>
    </form>
  );
}
