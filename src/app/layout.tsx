import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "نظام جمعية بسمة للثقافة والفنون",
  description: "نظام معلوماتي موحّد لإدارة الأنشطة، التقارير، والطلبات بين الإدارة والطاقم الميداني.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-sans antialiased text-gray-900">{children}</body>
    </html>
  );
}
