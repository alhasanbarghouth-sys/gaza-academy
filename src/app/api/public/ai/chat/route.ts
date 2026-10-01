import { NextResponse } from "next/server";
import { ApiError, GoogleGenAI } from "@google/genai";
import { gatherPublicAiContext } from "@/lib/ai/publicContext";
import { checkPublicAiRateLimit, getRequestIp } from "@/lib/public/rateLimit";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 12;

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const allowed = await checkPublicAiRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "عدد كبير من الأسئلة خلال وقت قصير — الرجاء المحاولة بعد قليل" },
      { status: 429 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "المساعد الذكي غير مُفعّل حاليًا" }, { status: 500 });
  }

  const body = await req.json();
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

  if (!message) {
    return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });
  }

  const context = await gatherPublicAiContext();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemPrompt = `أنت المساعد الذكي العام لموقع جمعية بسمة للثقافة والفنون، موجَّه لزوّار الموقع من الجمهور العام (وليس موظفي الجمعية).
تتحدث العربية بشكل أساسي وبأسلوب واضح وودود.

مهم جدًا: ليس لديك أي وصول إلى بيانات الجمعية الداخلية — لا الطلبات الداخلية، ولا الملفات، ولا التقارير المالية، ولا أسماء الموظفين أو المستفيدين، ولا مواقع المخيمات بالتفصيل. كل ما تعرفه عن الجمعية هو فقط الأرقام الإجمالية العامة المرفقة أدناه.
إذا سألك أحد عن أي تفصيل لا تملكه، قل بصراحة إنك لا تملك هذه المعلومة، ووجّهه إلى:
- تبويب "تقديم مناشدة" إذا كان يحتاج مساعدة.
- تبويب "الإبلاغ عن إساءة" إذا كان يريد الإبلاغ عن سلوك غير لائق من أحد الطاقم.
- التواصل المباشر مع الجمعية لأي استفسار إداري أو تفصيلي.
يمكنك أيضًا الإجابة عن أسئلة عامة لا علاقة لها بالجمعية، فأنت مساعد ذكاء اصطناعي عام.

بيانات الجمعية العامة المتاحة لك (JSON):
${JSON.stringify(context, null, 2)}`;

  const contents = [
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, MAX_MESSAGE_LENGTH) }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt, maxOutputTokens: 1024 },
    });

    const answer = response.text?.trim() || "عذرًا، لم أتمكن من توليد رد.";
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("Public AI chat error", err);
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return NextResponse.json(
          { error: "تم تجاوز حد الاستخدام المجاني مؤقتًا — حاول مرة أخرى بعد دقيقة" },
          { status: 429 }
        );
      }
      if (err.status === 503) {
        return NextResponse.json(
          { error: "خدمة المساعد الذكي مزدحمة حاليًا — حاول مرة أخرى خلال دقيقة" },
          { status: 503 }
        );
      }
    }
    return NextResponse.json({ error: "حدث خطأ أثناء الاتصال بالمساعد الذكي" }, { status: 500 });
  }
}
