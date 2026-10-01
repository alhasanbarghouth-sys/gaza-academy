import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navForRole, ROLE_LABELS_AR } from "@/lib/rbac";
import SidebarBody from "./_components/SidebarBody";
import MobileNav from "./_components/MobileNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (profile.must_change_password) redirect("/change-password");
  const items = navForRole(profile.role);

  // RLS already limits these to whoever can actually see each page (broader
  // management for appeals, only system_admin/executive_director for
  // misconduct reports) — a role without access just gets 0 back, not an error.
  const supabase = await createClient();
  const [pendingAppeals, pendingMisconduct] = await Promise.all([
    supabase.from("public_appeals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("misconduct_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const badges: Record<string, number> = {
    "/admin/appeals": pendingAppeals.count ?? 0,
    "/admin/misconduct": pendingMisconduct.count ?? 0,
  };

  const roleLabel = ROLE_LABELS_AR[profile.role];

  return (
    <div className="flex min-h-screen bg-[#f4f7f5] md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-l border-black/5 bg-white md:flex">
        <SidebarBody items={items} badges={badges} fullName={profile.full_name} roleLabel={roleLabel} />
      </aside>

      <MobileNav items={items} badges={badges} fullName={profile.full_name} roleLabel={roleLabel} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 hidden border-b border-black/5 bg-white/80 px-6 py-3 backdrop-blur md:block">
          <form action="/search" method="get" className="mx-auto flex max-w-6xl">
            <input
              type="text"
              name="q"
              placeholder="🔎 بحث شامل في كل بيانات النظام..."
              className="input max-w-md"
            />
          </form>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
