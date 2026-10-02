import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ENTITY_CREATORS, ENTITY_PARENT_TYPE, ENTITY_TYPES, ENTITY_TYPE_ORDER, archiveRole } from "@/lib/archive/constants";
import type { ArchiveEntity, EntityType } from "@/types/database";
import { createEntityForm } from "../actions";

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const type = (ENTITY_TYPE_ORDER.includes(sp.type as EntityType) ? sp.type : "project") as EntityType;
  const profile = await requireProfile();
  const role = archiveRole(profile.role);
  const supabase = await createClient();

  const parentType = ENTITY_PARENT_TYPE[type];
  const [{ data: rows }, { data: parentRows }, { data: profiles }] = await Promise.all([
    supabase.from("archive_entities").select("*").eq("entity_type", type).order("code"),
    parentType
      ? supabase.from("archive_entities").select("id, code, name").eq("entity_type", parentType).order("code")
      : Promise.resolve({ data: [] }),
    type === "person"
      ? supabase.from("profiles").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] }),
  ]);
  const entities = (rows ?? []) as ArchiveEntity[];
  const parents = (parentRows ?? []) as Pick<ArchiveEntity, "id" | "code" | "name">[];
  const parentName = new Map(parents.map((p) => [p.id, p.name ? `${p.code} — ${p.name}` : p.code]));
  const canCreate = ENTITY_CREATORS[type].includes(role);
  const meta = ENTITY_TYPES[type];

  return (
    <div className="space-y-6">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1.5">
          {ENTITY_TYPE_ORDER.map((t) => (
            <Link
              key={t}
              href={`/archive/entities?type=${t}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                t === type ? "bg-brand-600 text-white" : "bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-50"
              }`}
            >
              {ENTITY_TYPES[t].ar}
            </Link>
          ))}
        </div>
      </div>

      {sp.error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</div>}

      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">
            {meta.ar} <span dir="ltr" className="font-mono text-xs text-gray-400">{meta.pattern}</span>
          </h2>
          <p className="text-xs text-gray-500">{meta.meaning}</p>
        </div>
        {entities.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">لا يوجد بعد.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {entities.map((e) => (
              <li key={e.id}>
                <Link href={`/archive/entities/${e.id}`} className="-mx-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-gray-50">
                  <span dir="ltr" className="font-mono text-sm font-semibold text-brand-700">{e.code}</span>
                  <span className="font-medium">{e.name ?? "رمز مجهَّل"}</span>
                  {e.parent_id && <span className="text-xs text-gray-400">{parentName.get(e.parent_id)}</span>}
                  {!e.is_active && <span className="text-xs text-gray-400">(غير نشط)</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canCreate && (
        <form action={createEntityForm} className="card grid gap-3 sm:grid-cols-2">
          <h2 className="font-bold sm:col-span-2">إنشاء {meta.ar} جديد — يُولَّد الرمز آلياً</h2>
          <input type="hidden" name="entity_type" value={type} />
          {type === "period" ? (
            <input name="year" required className="input" dir="ltr" placeholder="السنة، مثل 2027" />
          ) : type === "beneficiary" ? (
            <p className="text-sm text-gray-500 sm:col-span-2">
              رمز المستفيد لا يحمل اسماً أبداً. الاسم يُحفظ فقط في قوائم 08.02 لمن له صلاحية صريحة.
            </p>
          ) : (
            <input name="name" required className="input" placeholder="الاسم" />
          )}
          {parentType && (
            <select name="parent_id" className="input" defaultValue="">
              <option value="">{type === "project" ? "البرنامج" : "المشروع"} (اختياري)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.name ? `${p.code} — ${p.name}` : p.code}</option>
              ))}
            </select>
          )}
          {type === "person" && (
            <select name="profile_id" className="input" defaultValue="">
              <option value="">ربط بحساب في النظام (اختياري)</option>
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          )}
          {(type === "project" || type === "person" || type === "activity") && (
            <>
              <label className="text-xs text-gray-500">
                {type === "person" ? "بداية الخدمة" : "تاريخ البدء"}
                <input type="date" name="start_date" className="input mt-1" />
              </label>
              <label className="text-xs text-gray-500">
                {type === "person" ? "انتهاء الخدمة" : "تاريخ الإغلاق"}
                <input type="date" name="end_date" className="input mt-1" />
              </label>
            </>
          )}
          {type !== "beneficiary" && (
            <textarea name="description" rows={2} className="input sm:col-span-2" placeholder="وصف (اختياري)" />
          )}
          <button className="btn-primary sm:col-span-2 sm:justify-self-start">إنشاء</button>
        </form>
      )}
    </div>
  );
}
