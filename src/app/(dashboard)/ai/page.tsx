import { requireProfile } from "@/lib/auth";
import ChatClient from "./_components/ChatClient";

export default async function AiPage() {
  await requireProfile();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🤖 المساعد الذكي</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدعوم بـ Claude — يرى بيانات النظام المتاحة لصلاحياتك، ويمكنه الإجابة عن أي سؤال آخر أيضًا.
        </p>
      </div>
      <ChatClient />
    </div>
  );
}
