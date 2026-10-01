import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 10;

export function getRequestIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Best-effort per-IP limit for the unauthenticated public AI endpoint, so it
 * can't be used to run up the org's shared Gemini quota. Uses the
 * service-role client — public_ai_requests has no RLS policies at all, so
 * nothing but this server-side check can read or write it.
 */
export async function checkPublicAiRateLimit(ip: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count } = await admin
    .from("public_ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) return false;

  await admin.from("public_ai_requests").insert({ ip });
  return true;
}
