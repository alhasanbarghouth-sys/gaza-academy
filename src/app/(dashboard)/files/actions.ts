"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function uploadFile(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const category = String(formData.get("category") ?? "أخرى");
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    redirect(`/files?error=${encodeURIComponent("الرجاء اختيار ملف")}`);
  }

  const path = `general/${crypto.randomUUID()}-${file!.name}`;
  const { error: uploadError } = await supabase.storage
    .from("org-files")
    .upload(path, file!, { contentType: file!.type || undefined });

  if (uploadError) {
    redirect(`/files?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error } = await supabase.from("files").insert({
    uploaded_by: profile.id,
    category,
    file_name: file!.name,
    file_url: path,
    file_size: file!.size,
  });

  if (error) {
    redirect(`/files?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/files");
  redirect("/files?saved=1");
}
