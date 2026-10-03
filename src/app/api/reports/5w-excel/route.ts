import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { isManagementRole } from "@/lib/rbac";
import { buildTrackerRows } from "@/lib/fivew/export";
import { fillTracker } from "@/lib/fivew/workbook";
import { CPAOR, DEFAULT_INDICATOR } from "@/lib/fivew/data";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });

  const form = await req.formData();
  const month = String(form.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "اختر الشهر" }, { status: 400 });

  const indicators: Record<string, [number, number] | null> = {};
  for (const type of Object.keys(DEFAULT_INDICATOR)) {
    const raw = String(form.get(`ind:${type}`) ?? "");
    const m = raw.match(/^(\d+):(\d+)$/);
    const p = m ? Number(m[1]) : -1;
    indicators[type] = m && CPAOR.pillars[p]?.indicators[Number(m[2])] ? [p, Number(m[2])] : null;
  }
  const status = String(form.get("status") ?? "");

  const { rows } = await buildTrackerRows({
    month,
    focalName: String(form.get("focal_name") ?? "").trim(),
    focalEmail: String(form.get("focal_email") ?? "").trim(),
    focalMobile: String(form.get("focal_mobile") ?? "").trim(),
    status: CPAOR.status.includes(status) ? status : "Completed",
    indicators,
  });

  const file = await fillTracker(rows);
  const [y, m] = month.split("-");
  const name = `${m}_BSCA._CPAoR_FA_Reporting_${y}.xlsm`;
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
