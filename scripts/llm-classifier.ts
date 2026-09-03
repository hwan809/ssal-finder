/**
 * LLM classifier — sends masked email content to Claude Haiku for
 * food-event classification.
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY – API key for Claude
 */

import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `KAIST 캠퍼스 행사 메일을 분석하여 식사/다과를 제공하는 행사인지 판별합니다.
식사 제공 행사라면 아래 JSON으로 추출하세요. 아니면 {"is_food_event": false}만 반환하세요.

출력 JSON:
{
  "is_food_event": boolean,
  "title": "행사명",
  "start_at": "ISO 8601",
  "end_at": "ISO 8601 or null",
  "location": "장소",
  "food_type": "버거|도시락|샌드위치|간식|식사|기타",
  "food_note": "조건 (선착순, 사전신청 등)",
  "target_audience": "학부생|대학원생|전체",
  "register_url": "신청 링크 URL or null",
  "description": "행사 요약 2-3문장. 개인 이름/이메일/전화번호 절대 포함 금지."
}

반드시 유효한 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

export interface ClassifiedEvent {
  is_food_event: boolean;
  title?: string;
  start_at?: string;
  end_at?: string | null;
  location?: string;
  food_type?: string;
  food_note?: string | null;
  target_audience?: string;
  register_url?: string | null;
  description?: string;
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Classify a single email. Input should already be masked for PII.
 * Returns the parsed classification result.
 */
export async function classifyEmail(
  subject: string,
  body: string,
): Promise<ClassifiedEvent> {
  const client = getClient();

  const userMessage = `제목: ${subject}\n\n본문:\n${truncate(body, 8000)}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-20250414",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from the response
  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("") || "";

  // Parse JSON from the response — handle markdown code fences
  const jsonStr = extractJson(text);

  try {
    const parsed = JSON.parse(jsonStr) as ClassifiedEvent;
    return parsed;
  } catch (err) {
    console.warn("[llm] Failed to parse LLM response as JSON:", text);
    return { is_food_event: false };
  }
}

/**
 * Classify multiple emails concurrently with a concurrency limit.
 */
export async function classifyEmails(
  items: Array<{ subject: string; body: string }>,
  concurrency: number = 5,
): Promise<ClassifiedEvent[]> {
  const results: ClassifiedEvent[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      const item = items[idx];
      try {
        results[idx] = await classifyEmail(item.subject, item.body);
      } catch (err) {
        console.warn(`[llm] Classification failed for item ${idx}:`, err);
        results[idx] = { is_food_event: false };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n...(truncated)";
}

function extractJson(text: string): string {
  // Try to find JSON inside markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a raw JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];

  return text.trim();
}
