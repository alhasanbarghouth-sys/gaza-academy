import { requireProfile } from "@/lib/auth";
import { navForRole, ROLE_LABELS_AR } from "@/lib/rbac";
import SidebarNav from "./_components/SidebarNav";
import SignOutButton from "./_components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const items = navForRole(profile.role);

  return (
    <div className="flex min-h-screen bg-[#f4f7f5]">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-l border-black/5 bg-white">
        <div className="flex items-center gap-3 border-b border-black/5 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">
            ب
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">جمعية بسمة</p>
            <p className="text-xs text-gray-500">للثقافة والفنون</p>
          </div>
        </div>

        <SidebarNav items={items} />

        <div className="mt-auto border-t border-black/5 p-4">
          <p className="truncate text-sm font-semibold">{profile.full_name}</p>
          <p className="mb-3 text-xs text-gray-500">{ROLE_LABELS_AR[profile.role]}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 px-6 py-3 backdrop-blur">
          <form action="/search" method="get" className="mx-auto flex max-w-6xl">
            <input
              type="text"
              name="q"
              placeholder="🔎 بحث شامل في كل بيانات النظام..."
              className="input max-w-md"
            />
          </form>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
