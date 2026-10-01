/**
 * Supabase Storage object keys must be plain ASCII (no Arabic, spaces, or
 * punctuation like parentheses) or the upload is rejected with "Invalid key".
 * Real filenames almost always contain exactly that, so we never put the
 * original name in the storage path — only a random id + the file extension.
 * The real name is kept in the database (file_name column) for display and
 * for the downloaded file's name.
 */
export function safeStorageKey(originalName: string, prefix: string): string {
  const dot = originalName.lastIndexOf(".");
  const ext = dot > -1 ? originalName.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
  const id = crypto.randomUUID();
  return `${prefix}/${id}${ext ? `.${ext}` : ""}`;
}
