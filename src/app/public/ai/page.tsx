import PublicChatClient from "./_components/PublicChatClient";

export default function PublicAiPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المساعد الذكي</h1>
        <p className="mt-1 text-sm text-gray-500">
          مدعوم بـ Gemini — يعرف فقط الأرقام العامة لعمل الجمعية، ويمكنه الإجابة عن أي سؤال آخر أيضًا.
        </p>
      </div>
      <PublicChatClient />
    </div>
  );
}
