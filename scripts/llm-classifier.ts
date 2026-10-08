/**
 * LLM classifier - sends masked email content to an OpenRouter model for
 * event classification (event? food? category). Tracks token usage and cost.
 */

import { chat, LLM_MODEL } from "../lib/openrouter";

const SYSTEM_PROMPT = `KAIST 캠퍼스 메일/공지를 분석하여 참석할 수 있는 행사인지, 식사/다과를 제공하는지 판별합니다.

행사(is_event: true): 정해진 일시에 사람들이 모이는 것. 세미나, 강연, 설명회, 워크숍, 해커톤, 대회, 시연회, 공연, 전시, 축제 등.
행사가 아님: 채용공고, 인턴/참가자 모집 공고, 학사 안내(수강·졸업·논문심사·랩배정 등), 장학 안내, 기사/수상 소식, 설문 요청.
단, 채용설명회처럼 일시와 장소가 정해진 모임은 행사입니다.

행사가 아니면 {"is_event": false}만 반환하세요. 행사라면 아래 JSON으로 추출하세요.

현재 연도는 2026년입니다. 제목이나 본문에 연도가 적혀 있으면(예: 2025 하반기, 2025.11.20) 그 연도를 그대로 쓰고, 연도 없이 월/일만 있을 때만 2026년으로 해석하세요.
시간대는 반드시 한국 시간(+09:00)으로 출력하세요.

출력 JSON:
{
  "is_event": true,
  "is_food_event": boolean (식사/다과/간식 제공이 본문에 명시되어 있으면 true),
  "category": "세미나|설명회|대회|문화|기타 (세미나=강연·워크숍·콜로퀴엄, 설명회=입학·채용·프로그램 설명회, 대회=해커톤·경진대회·공모전, 문화=공연·전시·축제)",
  "title": "행사명",
  "start_at": "ISO 8601 (반드시 +09:00 포함, 예: 2026-09-03T16:00:00+09:00)",
  "end_at": "ISO 8601 (+09:00) or null",
  "location": "장소",
  "food_type": "버거|도시락|샌드위치|간식|식사|기타 (음식 없으면 null)",
  "food_note": "음식 이름 4글자 이내 (예: 쉐이크쉑, 치킨, 피자, 떡볶이). 브랜드명 또는 음식 종류만. 조건은 쓰지 마세요. 음식 없으면 null",
  "target_audience": "학부생|대학원생|전체",
  "register_url": "신청/사전등록 링크 URL or null",
  "description": "행사 요약 2-3문장. 개인 이름/이메일/전화번호 절대 포함 금지."
}

register_url 추출 규칙:
- 본문에 Google Forms 링크(forms.gle/xxx 또는 docs.google.com/forms/...)가 있으면 반드시 추출
- "사전신청", "사전등록", "신청 링크", "등록 링크" 근처의 URL을 우선 사용
- 여러 링크가 있으면 신청/등록 용도의 링크를 선택

반드시 유효한 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

export const EVENT_CATEGORIES = ["세미나", "설명회", "대회", "문화", "기타"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface ClassifiedEvent {
  is_event: boolean;
  is_food_event: boolean;
  category?: EventCategory;
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

// Accumulated usage across all calls in this run
export const usageLogs: LLMUsage[] = [];

export async function classifyEmail(
  subject: string,
  body: string,
): Promise<ClassifiedEvent> {
  const userMessage = `제목: ${subject}\n\n본문:\n${truncate(body, 8000)}`;

  const { text, inputTokens, outputTokens, costUsd } = await chat({
    system: SYSTEM_PROMPT,
    user: userMessage,
    maxTokens: 1024,
  });

  usageLogs.push({
    model: LLM_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    prompt_preview: userMessage.slice(0, 200),
    response_preview: text.slice(0, 500),
    purpose: "classify_email",
  });

  const jsonStr = extractJson(text);
  try {
    return normalizeClassification(JSON.parse(jsonStr));
  } catch {
    console.warn("[llm] Failed to parse response:", text.slice(0, 200));
    return NOT_EVENT;
  }
}

const NOT_EVENT: ClassifiedEvent = { is_event: false, is_food_event: false };

/**
 * Coerce the model's JSON into a consistent shape: a food event is always an
 * event, category falls back to 기타, and non-food events carry no food fields.
 */
export function normalizeClassification(raw: unknown): ClassifiedEvent {
  if (!raw || typeof raw !== "object") return NOT_EVENT;
  const r = raw as Record<string, unknown>;
  const isFood = r.is_food_event === true;
  const isEvent = isFood || r.is_event === true;
  if (!isEvent) return NOT_EVENT;
  const category = EVENT_CATEGORIES.includes(r.category as EventCategory)
    ? (r.category as EventCategory)
    : "기타";
  const event = { ...(r as Partial<ClassifiedEvent>), is_event: true, is_food_event: isFood, category };
  if (!isFood) {
    event.food_type = undefined;
    event.food_note = null;
  }
  return event;
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
        results[idx] = NOT_EVENT;
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
