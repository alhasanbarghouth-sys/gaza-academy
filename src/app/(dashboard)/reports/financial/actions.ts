"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function uploadFinancialReport(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const period = String(formData.get("period") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const file = formData.get("file") as File | null;

  if (!title || !period) {
    redirect(`/reports/financial?error=${encodeURIComponent("الرجاء تعبئة العنوان والفترة")}`);
  }

  let file_url: string | null = null;
  if (file && file.size > 0) {
    const path = `financial/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("org-files")
      .upload(path, file, { contentType: file.type || undefined });

    if (uploadError) {
      redirect(`/reports/financial?error=${encodeURIComponent(uploadError.message)}`);
    }
    file_url = path;
  }

  const { error } = await supabase.from("financial_reports").insert({
    uploaded_by: profile.id,
    title,
    period,
    amount: amountRaw ? Number(amountRaw) : null,
    currency,
    file_url,
    notes,
  });

  if (error) {
    redirect(`/reports/financial?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports/financial");
  redirect("/reports/financial?saved=1");
}
