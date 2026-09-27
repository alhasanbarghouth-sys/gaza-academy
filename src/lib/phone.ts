/**
 * Staff log in with their phone number, not an email address. Supabase Auth
 * only speaks email+password, so we map phone -> a synthetic address under a
 * domain nothing will ever deliver mail to. This function must produce the
 * exact same string at account-creation time (admin/users, scripts/seed-staff.mjs)
 * and at login time, or the account becomes unreachable.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function phoneToAuthEmail(rawPhone: string): string {
  return `${normalizePhone(rawPhone)}@basma.local`;
}
