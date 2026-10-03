"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Archive,
  Banknote,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NAV_SECTION_LABELS, type NavIcon, type NavItem, type NavSection } from "@/lib/rbac";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  "daily-log": ClipboardList,
  requests: Inbox,
  reports: BarChart3,
  financial: Banknote,
  archive: Archive,
  files: FolderOpen,
  search: Search,
  assistant: Sparkles,
  "facilitator-reports": FileSpreadsheet,
  camps: MapPin,
  users: Users,
  appeals: Megaphone,
  misconduct: ShieldAlert,
};

const ORDER: NavSection[] = ["main", "field", "information", "admin"];

export default function SidebarNav({ items, badges }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  // The most specific matching item is the active one (/reports/financial over /reports).
  const active = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {ORDER.map((section) => {
        const group = items.filter((i) => i.section === section);
        if (!group.length) return null;
        return (
          <div key={section} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-gray-400">{NAV_SECTION_LABELS[section]}</p>
            <ul className="space-y-0.5">
              {group.map((item) => {
                const Icon = ICONS[item.icon];
                const isActive = item.href === active;
                const count = badges?.[item.href] ?? 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={clsx(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                        isActive ? "bg-brand-50 text-brand-800" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      {isActive && <span aria-hidden className="absolute inset-y-1.5 right-0 w-[3px] rounded-l bg-brand-600" />}
                      <Icon aria-hidden className={clsx("h-[18px] w-[18px] shrink-0", isActive ? "text-brand-700" : "text-gray-400")} strokeWidth={1.75} />
                      <span className="flex-1">{item.label}</span>
                      {count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
