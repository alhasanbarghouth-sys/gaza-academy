import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client — BYPASSES Row Level Security entirely.
 * Server-only. Never import this from a Client Component or expose the key
 * to the browser. Used for: admin user-management actions (creating /
 * deactivating accounts, changing roles), and computing the public portal's
 * aggregate-only impact numbers (the public has no RLS read access to any
 * table at all, by design — this client is the one deliberate, narrow
 * exception, and it must only ever return summed/counted numbers to a public
 * page, never raw rows). The internal AI assistant deliberately does NOT use
 * this client — it reads context through the caller's own RLS-scoped client
 * so it can never see more than that user already can.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
