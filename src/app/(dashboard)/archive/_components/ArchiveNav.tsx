"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/archive", label: "نظرة عامة", exact: true },
  { href: "/archive/new", label: "إدراج مستند" },
  { href: "/archive/search", label: "بحث" },
  { href: "/archive/entities", label: "الكيانات" },
  { href: "/archive/incomplete", label: "نواقص الربط" },
  { href: "/archive/packs", label: "حزم الأدلة" },
  { href: "/archive/access", label: "الصلاحيات والسجلات" },
  { href: "/archive/guide", label: "دليل التصنيف" },
];

export default function ArchiveNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-black/5">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`block border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
