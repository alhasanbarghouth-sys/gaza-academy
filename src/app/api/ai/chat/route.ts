import { NextResponse } from "next/server";
import { ApiError, GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { gatherAiContext } from "@/lib/ai/context";
import { downloadAttachment, validateAttachments, type Attachment } from "@/lib/attachments";
import { fileParts } from "@/lib/archive/classify";

export const maxDuration = 60;
// Files read by the assistant in one question (Gemini inline limit is ~20 MB).
const MAX_INLINE_TOTAL = 18 * 1024 * 1024;

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) {
    return NextResponse.json({ error: "الملف الشخصي غير موجود" }, { status: 401 });
  }

  const body = await req.json();
  const attachments = await validateAttachments(body.attachments, user.id);
  const message = String(body.message ?? "").trim() || (attachments.length ? "اقرأ الملفات المرفقة ولخّص أهم ما فيها." : "");
  let conversationId = body.conversationId as string | undefined;

  if (!message) {
    return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "لم يتم إعداد مفتاح Gemini بعد (GEMINI_API_KEY في إعدادات Vercel)" },
      { status: 500 }
    );
  }

  // Ensure a conversation row exists (owned by this user; RLS-enforced).
  if (!conversationId) {
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: profile.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !conv) {
      return NextResponse.json({ error: "تعذر إنشاء المحادثة" }, { status: 500 });
    }
    conversationId = conv.id;
  }

  const userRow: Record<string, unknown> = { conversation_id: conversationId, role: "user", content: message };
  let { data: saved, error: saveError } = await supabase
    .from("ai_messages")
    .insert(attachments.length ? { ...userRow, attachments } : userRow)
    .select("id")
    .single();
  // Until 0014 is run there is no attachments column; still answer.
  if (saveError && attachments.length) ({ data: saved } = await supabase.from("ai_messages").insert(userRow).select("id").single());
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  // The latest 30 messages, oldest first.
  type Turn = { role: string; content: string; attachments?: Attachment[] };
  let recent: Turn[] | null;
  let historyError: unknown;
  ({ data: recent, error: historyError } = await supabase
    .from("ai_messages")
    .select("role, content, attachments")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30));
  if (historyError) {
    ({ data: recent } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(30));
  }
  const history = (recent ?? []).reverse();

  // The files attached to this question are read in full; earlier ones are named only.
  const fileInput: object[] = [];
  let inlineBytes = 0;
  for (const a of attachments) {
    const buf = await downloadAttachment(a.path);
    if (!buf) continue;
    const { parts, readContent } = buf.length + inlineBytes <= MAX_INLINE_TOTAL ? await fileParts(buf, a.name, a.type) : { parts: [], readContent: false };
    if (readContent) inlineBytes += buf.length;
    fileInput.push({ text: `الملف المرفق «${a.name}»${readContent ? ":" : " (لم يُقرأ محتواه: نوعه أو حجمه لا يسمح)."}` }, ...parts);
  }

  const context = await gatherAiContext(profile);

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
  });

  const systemPrompt = `أنت المساعد الذكي لنظام إدارة جمعية بسمة للثقافة والفنون. تتحدث العربية بشكل أساسي وبأسلوب واضح ومباشر.
أنت مساعد ذكاء اصطناعي عام (LLM) — يمكنك الإجابة عن أي سؤال يطرحه المستخدم، وليس فقط الأسئلة المتعلقة بالنظام.
عندما يسأل المستخدم عن بيانات الجمعية (الطلبات، الأنشطة، التقارير)، استخدم البيانات الحقيقية المرفقة أدناه فقط — لا تختلق أرقامًا.
البيانات تتضمن أسماء الميسرين وفرق العمل لكل نشاط ومشروع (activities، projectsSummary، facilitatorsSummary)، فأجب عن «من عمل في…» و«ماذا أنجز فلان» بالأسماء مباشرة. لا تعرض المعرّفات التقنية (UUID) للمستخدم؛ استخدم الأسماء والروابط.
إذا لم تكن البيانات كافية للإجابة، قل ذلك بصراحة واقترح أين يمكن للمستخدم إيجاد المعلومة داخل النظام (تبويب الطلبات / التقارير / الملفات).
المستخدم الحالي: ${context.currentUser.name} — الدور: ${context.currentUser.roleLabel}.
البيانات المتاحة لك محدودة تلقائيًا بحسب صلاحيات دور هذا المستخدم فقط.

بيانات النظام الحالية (JSON):
${JSON.stringify(context)}`;

  // Gemini calls the assistant role "model".
  const turns = history.length ? history : [{ role: "user", content: message, attachments }];
  const contents = turns.map((m, i) => {
    const names = (m.attachments ?? []).map((a) => a.name);
    const text = names.length ? `${m.content}\n[مرفقات: ${names.join("، ")}]` : m.content;
    const isCurrent = i === turns.length - 1 && m.role === "user";
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: isCurrent && fileInput.length ? [...fileInput, { text }] : [{ text }],
    };
  });

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt, maxOutputTokens: 2048 },
    });

    const answer = response.text?.trim() || "عذرًا، لم أتمكن من توليد رد.";

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: answer,
    });

    return NextResponse.json({ conversationId, answer, messageId: saved?.id ?? null, attachments });
  } catch (err) {
    console.error("AI chat error", err);
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: "تم تجاوز حد الاستخدام المجاني مؤقتًا — حاول مرة أخرى بعد دقيقة" },
          { status: 429 }
        );
      }
      if (err.status === 503) {
        return NextResponse.json(
          { error: "خدمة Gemini مزدحمة حاليًا — حاول مرة أخرى خلال دقيقة" },
          { status: 503 }
        );
      }
    }
    return NextResponse.json({ error: "حدث خطأ أثناء الاتصال بالمساعد الذكي" }, { status: 500 });
  }
}
