import Image from "next/image";
import type { NavItem } from "@/lib/rbac";
import SidebarNav from "./SidebarNav";
import SignOutButton from "./SignOutButton";

export default function SidebarBody({
  items,
  badges,
  fullName,
  roleLabel,
}: {
  items: NavItem[];
  badges: Record<string, number>;
  fullName: string;
  roleLabel: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-5 py-5">
        <Image src="/logo.webp" alt="جمعية بسمة للثقافة والفنون" width={2000} height={667} priority className="h-9 w-auto" />
        <p className="mt-2 text-[11px] font-medium text-gray-500">نظام المعلومات المؤسسي</p>
      </div>

      <SidebarNav items={items} badges={badges} />

      <div className="mt-auto border-t border-gray-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white"
          >
            {fullName.trim().charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
            <p className="truncate text-xs text-gray-500">{roleLabel}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
