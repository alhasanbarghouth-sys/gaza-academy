/**
 * Supabase Storage object keys must be plain ASCII (no Arabic, spaces, or
 * punctuation like parentheses) or the upload is rejected with "Invalid key".
 * Real filenames almost always contain exactly that, so we never put the
 * original name in the storage path — only a random id + the file extension.
 * The real name is kept in the database (file_name column) for display and
 * for the downloaded file's name.
 */
/**
 * Browsers send a multipart upload's filename as raw UTF-8 bytes in the
 * Content-Disposition header, but Next.js's FormData parser in this version
 * decodes headers as Latin-1 per the HTTP spec, so e.g. "تقرير.xlsx" arrives
 * as "ØªÙ‚Ø±ÙŠØ±.xlsx". Detect that specific corruption (a string entirely
 * within the Latin-1 range, i.e. every codepoint <= 0xFF, containing at
 * least one byte >= 0x80) and undo it. A correctly-decoded Arabic name is
 * never touched — real Arabic codepoints (U+0600+) are outside 0xFF, so the
 * check never matches them.
 */
export function fixUploadedFilename(name: string): string {
  if (/^[\x00-\xFF]*$/.test(name) && /[\x80-\xFF]/.test(name)) {
    try {
      return Buffer.from(name, "latin1").toString("utf8");
    } catch {
      return name;
    }
  }
  return name;
}

export function safeStorageKey(originalName: string, prefix: string): string {
  const dot = originalName.lastIndexOf(".");
  const ext = dot > -1 ? originalName.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) : "";
  const id = crypto.randomUUID();
  return `${prefix}/${id}${ext ? `.${ext}` : ""}`;
}
