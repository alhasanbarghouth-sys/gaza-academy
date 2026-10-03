"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PublicChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/public/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "حدث خطأ");
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: data.answer }]);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex h-[65vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pl-1">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            اسألني عن عمل الجمعية، أو أي سؤال آخر.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-gray-100 text-gray-800" : "bg-brand-600 text-white"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">المساعد يكتب...</div>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2 border-t border-black/5 pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="اكتب سؤالك هنا..."
          className="input flex-1"
        />
        <button onClick={send} disabled={loading} className="btn-primary">
          إرسال
        </button>
      </div>
    </div>
  );
}
