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
      <div className="border-b border-black/5 px-5 py-5">
        <Image src="/logo.webp" alt="جمعية بسمة للثقافة والفنون" width={2000} height={667} priority className="h-9 w-auto" />
      </div>

      <SidebarNav items={items} badges={badges} />

      <div className="mt-auto border-t border-black/5 p-4">
        <p className="truncate text-sm font-semibold">{fullName}</p>
        <p className="mb-3 text-xs text-gray-500">{roleLabel}</p>
        <SignOutButton />
      </div>
    </div>
  );
}
