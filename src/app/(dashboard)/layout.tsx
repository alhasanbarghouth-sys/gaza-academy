import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navForRole, ROLE_LABELS_AR } from "@/lib/rbac";
import SidebarBody from "./_components/SidebarBody";
import MobileNav from "./_components/MobileNav";
import { Search } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (profile.must_change_password) redirect("/change-password");
  const items = navForRole(profile.role);

  // RLS already limits these to whoever can actually see each page (broader
  // management for appeals, only system_admin/executive_director for
  // misconduct reports) — a role without access just gets 0 back, not an error.
  const supabase = await createClient();
  const [pendingAppeals, pendingMisconduct, pendingRequests] = await Promise.all([
    supabase.from("public_appeals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("misconduct_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Requests waiting for this user's answer (RLS limits it to what they receive).
    // Requests the user deleted for themselves are not counted.
    supabase
      .from("requests")
      .select("id, request_hidden(profile_id)", { count: "exact", head: true })
      .is("request_hidden", null)
      .eq("status", "pending")
      .neq("requester_id", profile.id)
      .then((res) =>
        res.error
          ? supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending").neq("requester_id", profile.id)
          : res
      ),
  ]);
  const badges: Record<string, number> = {
    "/requests": pendingRequests.count ?? 0,
    "/admin/appeals": pendingAppeals.count ?? 0,
    "/admin/misconduct": pendingMisconduct.count ?? 0,
  };

  const roleLabel = ROLE_LABELS_AR[profile.role];

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f6f8] md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-l border-gray-200 bg-white md:flex">
        <SidebarBody items={items} badges={badges} fullName={profile.full_name} roleLabel={roleLabel} />
      </aside>

      <MobileNav items={items} badges={badges} fullName={profile.full_name} roleLabel={roleLabel} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden border-b border-gray-200 bg-white/90 px-6 py-3 backdrop-blur md:block">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6">
            <form action="/search" method="get" className="relative w-full max-w-md">
              <Search aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" name="q" placeholder="بحث شامل في بيانات النظام" className="input !py-2 pr-9" />
            </form>
            <p className="hidden shrink-0 text-xs font-medium text-gray-500 lg:block">
              نظام المعلومات المؤسسي · جمعية بسمة للثقافة والفنون
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
