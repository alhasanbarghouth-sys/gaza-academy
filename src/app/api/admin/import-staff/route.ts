import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importStaff } from "@/app/(dashboard)/admin/users/actions";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["system_admin", "executive_director"].includes(profile.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const formData = await req.formData();
  try {
    const result = await importStaff(formData);
    return NextResponse.json(result);
  } catch (err) {
    console.error("import-staff error", err);
    return NextResponse.json({ error: "تعذّرت العملية" }, { status: 500 });
  }
}
