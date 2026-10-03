"use client";

import { useEffect, useRef, useState } from "react";
import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import AttachmentPicker from "@/components/AttachmentPicker";
import type { Attachment } from "@/lib/attachments";
import {
  deleteConversation,
  listConversations,
  loadConversation,
  type ConversationSummary,
} from "../actions";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

function when(iso: string) {
  return new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Gaza", dateStyle: "short", timeStyle: "short" });
}

export default function ChatClient({ initialConversations }: { initialConversations: ConversationSummary[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showList, setShowList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function open(id: string) {
    setShowList(false);
    if (id === conversationId) return;
    setOpening(true);
    setError(null);
    const msgs = await loadConversation(id);
    setConversationId(id);
    setMessages(msgs);
    setOpening(false);
  }

  function startNew() {
    setShowList(false);
    setConversationId(undefined);
    setMessages([]);
    setError(null);
  }

  async function remove(c: ConversationSummary) {
    if (!confirm(`حذف المحادثة «${c.title}»؟ لا يمكن استرجاعها.`)) return;
    const res = await deleteConversation(c.id);
    if (res.error) return setError(res.error);
    setConversations((l) => l.filter((x) => x.id !== c.id));
    if (c.id === conversationId) startNew();
  }

  async function send() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading || uploading) return;
    setError(null);
    const sent = attachments;
    setMessages((prev) => [...prev, { role: "user", content: text || "اقرأ الملفات المرفقة ولخّص أهم ما فيها.", attachments: sent }]);
    setInput("");
    setResetKey((k) => k + 1);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId, attachments: sent }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "حدث خطأ");
        return;
      }

      setConversationId(data.conversationId);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "user") next[next.length - 1] = { ...last, id: data.messageId ?? undefined, attachments: data.attachments ?? last.attachments };
        return [...next, { role: "assistant", content: data.answer }];
      });
      setConversations(await listConversations());
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  const list = (
    <div className="flex h-full flex-col">
      <button type="button" onClick={startNew} className="btn-primary mb-3 inline-flex items-center justify-center gap-2 !py-2 text-sm">
        <MessageSquarePlus className="h-4 w-4" aria-hidden /> محادثة جديدة
      </button>
      <p className="mb-1 px-1 text-[11px] font-semibold text-gray-400">المحادثات السابقة</p>
      <ul className="flex-1 space-y-0.5 overflow-y-auto">
        {conversations.length === 0 && <li className="px-1 text-xs text-gray-400">لا محادثات محفوظة بعد.</li>}
        {conversations.map((c) => (
          <li key={c.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => open(c.id)}
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-right text-sm ${
                c.id === conversationId ? "bg-brand-50 font-semibold text-brand-800" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="block truncate">{c.title}</span>
              <span className="block text-[10px] text-gray-400" suppressHydrationWarning>{when(c.updated_at)}</span>
            </button>
            <button
              type="button"
              onClick={() => remove(c)}
              aria-label="حذف المحادثة"
              className="shrink-0 p-1 text-gray-300 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
      <aside className="card hidden h-[70vh] !p-3 md:block">{list}</aside>

      <div ref={chatRef} className="card flex h-[75vh] flex-col md:h-[70vh]">
        <div className="mb-2 flex items-center justify-between md:hidden">
          <button type="button" onClick={() => setShowList((s) => !s)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <History className="h-4 w-4" aria-hidden /> المحادثات ({conversations.length})
          </button>
          <button type="button" onClick={startNew} className="inline-flex items-center gap-1 text-sm text-brand-700">
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> جديدة
          </button>
        </div>
        {showList && <div className="mb-3 max-h-64 rounded-xl border border-black/5 p-2 md:hidden">{list}</div>}

        <div className="flex-1 space-y-4 overflow-y-auto pl-1">
          {opening && <p className="text-sm text-gray-400">جارٍ فتح المحادثة…</p>}
          {!opening && messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
              اسألني أي شيء — عن بيانات الجمعية أو أي موضوع آخر، أو أرفق ملفاً لأقرأه.
              <br />
              مثال: «كم عدد المستفيدين هذا الشهر؟» أو «لخّص هذا التقرير».
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-gray-100 text-gray-800" : "bg-brand-600 text-white"
                }`}
              >
                {m.content}
                {!!m.attachments?.length && (
                  <ul className="mt-2 space-y-1">
                    {m.attachments.map((a, j) => (
                      <li key={j} className="text-[11px]">
                        {m.id ? (
                          <a href={`/api/attachments?src=ai&id=${m.id}&i=${j}`} target="_blank" rel="noreferrer" className="font-semibold underline" dir="auto">
                            {a.name}
                          </a>
                        ) : (
                          <span className="font-semibold" dir="auto">{a.name}</span>
                        )}
                        <span className="block text-gray-500">{a.note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-sm text-gray-400">المساعد يكتب...</div>}
          <div ref={bottomRef} />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 space-y-2 border-t border-black/5 pt-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="اكتب سؤالك هنا..."
              className="input flex-1 resize-none"
            />
            <button onClick={send} disabled={loading || uploading} className="btn-primary disabled:opacity-60">
              إرسال
            </button>
          </div>
          <AttachmentPicker source="ai_chat" onChange={setAttachments} onBusy={setUploading} dropTarget={chatRef} resetKey={resetKey} />
        </div>
      </div>
    </div>
  );
}
