import { ApiError, type GoogleGenAI } from "@google/genai";

/**
 * Free-tier Gemini occasionally answers "model is currently experiencing
 * high demand" (503) for a transient second or two — retrying almost always
 * succeeds. This is not something code can eliminate (it's Google's shared
 * free capacity, not a bug), but a short retry makes most of those blips
 * invisible to the user instead of surfacing as a failure.
 */
export async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  attempts = 3
) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && (err.status === 503 || err.status === 429);
      if (!retryable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError;
}
