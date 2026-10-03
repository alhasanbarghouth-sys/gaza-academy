import { requireProfile } from "@/lib/auth";
import ChatClient from "./_components/ChatClient";
import { listConversations } from "./actions";

export default async function AiPage() {
  await requireProfile();
  const conversations = await listConversations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المساعد الذكي</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدعوم بـ Gemini — يرى بيانات النظام المتاحة لصلاحياتك، ويقرأ الملفات التي ترفقها. محادثاتك محفوظة ولا يراها غيرك.
        </p>
      </div>
      <ChatClient initialConversations={conversations} />
    </div>
  );
}
