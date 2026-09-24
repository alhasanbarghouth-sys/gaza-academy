import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { gatherAiContext } from "@/lib/ai/context";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

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
  const message = String(body.message ?? "").trim();
  let conversationId = body.conversationId as string | undefined;

  if (!message) {
    return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "لم يتم إعداد مفتاح Anthropic API بعد. راجع ملف .env.local" },
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

  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
  });

  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);

  const context = await gatherAiContext(profile);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `أنت المساعد الذكي لنظام إدارة جمعية بسمة للثقافة والفنون. تتحدث العربية بشكل أساسي وبأسلوب واضح ومباشر.
أنت مساعد ذكاء اصطناعي عام (LLM) — يمكنك الإجابة عن أي سؤال يطرحه المستخدم، وليس فقط الأسئلة المتعلقة بالنظام.
عندما يسأل المستخدم عن بيانات الجمعية (الطلبات، الأنشطة، التقارير)، استخدم البيانات الحقيقية المرفقة أدناه فقط — لا تختلق أرقامًا.
إذا لم تكن البيانات كافية للإجابة، قل ذلك بصراحة واقترح أين يمكن للمستخدم إيجاد المعلومة داخل النظام (تبويب الطلبات / التقارير / الملفات).
المستخدم الحالي: ${context.currentUser.name} — الدور: ${context.currentUser.roleLabel}.
البيانات المتاحة لك محدودة تلقائيًا بحسب صلاحيات دور هذا المستخدم فقط.

بيانات النظام الحالية (JSON):
${JSON.stringify(context, null, 2)}`;

  const messages =
    (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) || [];

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.length > 0 ? messages : [{ role: "user", content: message }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const answer = textBlock && "text" in textBlock ? textBlock.text : "عذرًا، لم أتمكن من توليد رد.";

    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: answer,
    });

    return NextResponse.json({ conversationId, answer });
  } catch (err) {
    console.error("AI chat error", err);
    return NextResponse.json({ error: "حدث خطأ أثناء الاتصال بالمساعد الذكي" }, { status: 500 });
  }
}
