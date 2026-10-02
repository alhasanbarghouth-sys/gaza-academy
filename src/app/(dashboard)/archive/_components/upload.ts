import { createClient } from "@/lib/supabase/client";
import { prepareUpload } from "../actions";

/** Sends the file straight from the browser to the private bucket via a one-time signed URL. */
export async function uploadToArchive(file: File, documentId?: string): Promise<{ path: string } | { error: string }> {
  const prep = await prepareUpload({ fileName: file.name, size: file.size, documentId });
  if ("error" in prep && prep.error) return { error: prep.error };
  const { path, token } = prep as { path: string; token: string };
  const { error } = await createClient()
    .storage.from("archive")
    .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
  if (error) return { error: error.message };
  return { path };
}
