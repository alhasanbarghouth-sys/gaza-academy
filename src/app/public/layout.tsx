import Image from "next/image";
import Link from "next/link";

const NAV = [
  { href: "/public", label: "نظرة عامة" },
  { href: "/public/appeal", label: "تقديم مناشدة" },
  { href: "/public/report", label: "الإبلاغ عن إساءة" },
  { href: "/public/ai", label: "اسأل المساعد الذكي" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/public">
            <Image src="/logo.webp" alt="جمعية بسمة للثقافة والفنون" width={2000} height={667} className="h-10 w-auto" />
          </Link>
          <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-gray-600">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brand-700">
                {item.label}
              </Link>
            ))}
            <Link href="/login" className="btn-secondary !py-1.5 !px-3 text-xs">
              دخول الطاقم
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-xs text-gray-400">
        جمعية بسمة للثقافة والفنون
      </footer>
    </div>
  );
}
