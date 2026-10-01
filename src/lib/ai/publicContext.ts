import { getPublicImpactStats } from "@/lib/public/stats";

/**
 * Context for the PUBLIC AI assistant — aggregate numbers only. Deliberately
 * does NOT reuse gatherAiContext (the internal one): this endpoint has no
 * logged-in user and no RLS protection behind it, so it must never be handed
 * anything beyond what's already shown on the public landing page.
 */
export async function gatherPublicAiContext() {
  const stats = await getPublicImpactStats();
  return {
    organization: "جمعية بسمة للثقافة والفنون (Basma Society for Culture and Arts)",
    mission: "تقديم أنشطة ثقافية وفنية ودعم نفسي اجتماعي للأطفال والعائلات في المخيمات والمواقع المتضررة.",
    impactStats: stats,
  };
}
