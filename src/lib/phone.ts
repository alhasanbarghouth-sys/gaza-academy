/**
 * Staff log in with their phone number, not an email address. Supabase Auth
 * only speaks email+password, so we map phone -> a synthetic address under a
 * domain nothing will ever deliver mail to. This function must produce the
 * exact same string at account-creation time (admin/users, scripts/seed-staff.mjs)
 * and at login time, or the account becomes unreachable.
 */

// Phones set to Arabic type Arabic-Indic (٠-٩) or Persian (۰-۹) digits.
function toAsciiDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function normalizePhone(raw: string): string {
  return toAsciiDigits(raw).replace(/\D/g, "");
}

export function phoneToAuthEmail(rawPhone: string): string {
  return `${normalizePhone(rawPhone)}@basma.local`;
}

/**
 * The login box takes a phone number, but accounts created by hand in the
 * Supabase dashboard may use a name (e.g. "alhasan@basma.local") or a full
 * email, so accept those too.
 */
export function loginToAuthEmail(raw: string): string {
  const value = toAsciiDigits(raw).trim().toLowerCase();
  if (value.includes("@")) return value;
  if (/[a-z]/.test(value)) return `${value.replace(/\s+/g, "")}@basma.local`;
  return phoneToAuthEmail(value);
}
