"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/rbac";
import clsx from "clsx";

export default function SidebarNav({ items, badges }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const count = badges?.[item.href] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <span aria-hidden>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
