/**
 * LLM classifier - sends masked email content to Claude Haiku for
 * food-event classification. Tracks token usage and cost.
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
  "register_url": "신청/사전등록 링크 URL or null",
  "description": "행사 요약 2-3문장. 개인 이름/이메일/전화번호 절대 포함 금지."
}

register_url 추출 규칙:
- 본문에 Google Forms 링크(forms.gle/xxx 또는 docs.google.com/forms/...)가 있으면 반드시 추출
- "사전신청", "사전등록", "신청 링크", "등록 링크" 근처의 URL을 우선 사용
- 여러 링크가 있으면 신청/등록 용도의 링크를 선택

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

export interface LLMUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  prompt_preview: string;
  response_preview: string;
  purpose: string;
}

// Haiku pricing (per token)
const HAIKU_INPUT_PRICE = 0.80 / 1_000_000;
const HAIKU_OUTPUT_PRICE = 4.0 / 1_000_000;
const MODEL = "claude-haiku-4-5-20251001";

// Accumulated usage across all calls in this run
export const usageLogs: LLMUsage[] = [];

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function classifyEmail(
  subject: string,
  body: string,
): Promise<ClassifiedEvent> {
  const client = getClient();
  const userMessage = `제목: ${subject}\n\n본문:\n${truncate(body, 8000)}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("") || "";

  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cost =
    inputTokens * HAIKU_INPUT_PRICE + outputTokens * HAIKU_OUTPUT_PRICE;

  usageLogs.push({
    model: MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: cost,
    prompt_preview: userMessage.slice(0, 200),
    response_preview: text.slice(0, 500),
    purpose: "classify_email",
  });

  const jsonStr = extractJson(text);
  try {
    return JSON.parse(jsonStr) as ClassifiedEvent;
  } catch {
    console.warn("[llm] Failed to parse response:", text.slice(0, 200));
    return { is_food_event: false };
  }
}

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

export function getTotalUsage(): {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
} {
  return usageLogs.reduce(
    (acc, u) => ({
      calls: acc.calls + 1,
      input_tokens: acc.input_tokens + u.input_tokens,
      output_tokens: acc.output_tokens + u.output_tokens,
      cost_usd: acc.cost_usd + u.cost_usd,
    }),
    { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 },
  );
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n...(truncated)";
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}
