"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isManagementRole } from "@/lib/rbac";

export async function addCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const latitude = String(formData.get("latitude") ?? "").trim();
  const longitude = String(formData.get("longitude") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) {
    redirect(`/admin/camps?error=${encodeURIComponent("الرجاء إدخال اسم المخيم")}`);
  }

  const { error } = await supabase.from("camps").insert({
    name,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    notes,
    is_verified: true,
    created_by: profile.id,
  });

  if (error) {
    redirect(`/admin/camps?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
  redirect("/admin/camps?saved=1");
}

export async function verifyCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const latitude = String(formData.get("latitude") ?? "").trim();
  const longitude = String(formData.get("longitude") ?? "").trim();
  if (!id) return;

  await supabase
    .from("camps")
    .update({
      is_verified: true,
      ...(latitude ? { latitude: Number(latitude) } : {}),
      ...(longitude ? { longitude: Number(longitude) } : {}),
    })
    .eq("id", id);

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
}

export async function deleteCamp(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("camps").delete().eq("id", id);

  revalidatePath("/admin/camps");
  revalidatePath("/facilitator/daily-log");
}

export async function searchOfficialSites(q: string) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) return [];
  const { searchSites, guessCommunity } = await import("@/lib/fivew/data");
  return searchSites(q).map((s) => ({ gov: s.gov, type: s.type, value: s.value, nb: s.nb, guess: guessCommunity(s) }));
}

/** Links a camp to its entry in the 5Ws template's official site list. */
export async function linkCampSite(formData: FormData) {
  const profile = await requireProfile();
  if (!isManagementRole(profile.role)) throw new Error("غير مصرح");
  const { CPAOR, findSite } = await import("@/lib/fivew/data");

  const id = String(formData.get("id") ?? "");
  const [gov, type, value] = String(formData.get("site") ?? "").split("||");
  const community = String(formData.get("community") ?? "");
  const unlink = formData.get("unlink") === "1";

  const site = findSite(gov, type, value);
  if (!unlink && !site) redirect(`/admin/camps?error=${encodeURIComponent("اختر موقعاً من القائمة الرسمية")}`);
  if (!unlink && community && !(CPAOR.communities[site!.gov] ?? []).includes(community)) {
    redirect(`/admin/camps?error=${encodeURIComponent("المنطقة غير موجودة في قائمة المحافظة")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("camps")
    .update(
      unlink
        ? { cccm_governorate: null, cccm_site_type: null, cccm_site: null, cccm_community: null }
        : { cccm_governorate: site!.gov, cccm_site_type: site!.type, cccm_site: site!.value, cccm_community: community || null }
    )
    .eq("id", id);
  if (error) redirect(`/admin/camps?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admin/camps");
  redirect(`/admin/camps?linked=1#camp-${id}`);
}
