/**
 * OpenRouter chat call shared by the Next app (auto-register) and the
 * collection scripts (classifier, form-parser). No dependencies so both
 * the app and scripts/ can import it.
 */

export const LLM_MODEL = "openai/gpt-6-luna";

export interface ChatResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function chat(opts: {
  system: string;
  user: string;
  maxTokens: number;
}): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      // 모든 호출이 JSON 한 개만 받는다
      response_format: { type: "json_object" },
      reasoning: { effort: "low" },
      usage: { include: true },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    costUsd: data.usage?.cost ?? 0,
  };
}
