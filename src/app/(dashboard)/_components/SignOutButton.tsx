"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="w-full rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
    >
      تسجيل الخروج
    </button>
  );
}
