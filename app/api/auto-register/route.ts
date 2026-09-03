import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Google 설문지의 모든 필드에 답변을 생성하세요.

사용자 프로필 정보와 폼 필드 목록이 주어집니다.
모든 필드에 적절한 값을 채워주세요.

규칙:
- 이름/학번/학과/이메일/전화번호: 프로필 정보 그대로 사용
- 동의 체크박스: "동의합니다" 또는 "예"
- 참석/참여 확인: "참석합니다" 또는 "예"
- 과정 선택 (학부/석사/박사): 학번 앞 4자리가 2025 이상이면 "학부", 아니면 "대학원"
- 학년: 학번 기준으로 추정 (2025=1학년, 2024=2학년, ...)
- 선택형(라디오/드롭다운): 가장 일반적인 옵션 선택. 부처 선택 같은 건 "교무처"
- 서술형: 짧고 무난하게 작성 (1-2문장)
- 빈칸으로 남겨도 되는 선택 항목은 빈 문자열

반드시 JSON 객체만 출력하세요. 키는 entry ID, 값은 답변 문자열.`;

export async function POST(req: NextRequest) {
  try {
    const { eventId, profile } = await req.json();

    if (!eventId || !profile?.name) {
      return NextResponse.json({ error: "eventId and profile.name required" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: event } = await supabase
      .from("events")
      .select("title, form_id, form_mapping, register_url")
      .eq("id", eventId)
      .single();

    if (!event?.form_mapping || !event?.form_id) {
      return NextResponse.json({ error: "no form_mapping for this event" }, { status: 400 });
    }

    // Fetch live form fields with labels
    const formViewUrl = `https://docs.google.com/forms/d/e/${event.form_id}/viewform`;
    let formHtml = "";
    try {
      const formRes = await fetch(formViewUrl, {
        headers: { "Accept-Language": "ko-KR" },
      });
      formHtml = await formRes.text();
    } catch {}

    // Extract field labels from FB_PUBLIC_LOAD_DATA_
    const fieldLabels: Record<string, string> = {};
    const dataMatch = formHtml.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
    if (dataMatch) {
      try {
        const data = JSON.parse(dataMatch[1]);
        const fieldGroups = data?.[1]?.[1];
        if (Array.isArray(fieldGroups)) {
          for (const group of fieldGroups) {
            const label = group?.[1];
            const subFields = group?.[4];
            if (Array.isArray(subFields)) {
              for (const sub of subFields) {
                if (sub?.[0] != null && typeof label === "string") {
                  fieldLabels[`entry.${sub[0]}`] = label.trim();
                }
              }
            }
          }
        }
      } catch {}
    }

    const mapping = event.form_mapping as Record<string, string | null>;
    const fieldList = Object.entries(mapping)
      .map(([entryId, profileField]) => {
        const label = fieldLabels[entryId] || "(unknown)";
        return `- ${entryId} [${label}]: ${profileField || "(LLM이 답변 생성)"}`;
      })
      .join("\n");

    const userMessage = `사용자 프로필:
- 이름: ${profile.name}
- 학번: ${profile.student_id || ""}
- 학과: ${profile.department || ""}
- 이메일: ${profile.email || ""}
- 전화번호: ${profile.phone || ""}

행사: ${event.title}

폼 필드 목록 (entry ID [질문]: 프로필 필드 또는 답변 필요):
${fieldList}

프로필 필드가 매핑된 항목은 프로필 값을 그대로 사용하고,
"(LLM이 답변 생성)" 항목은 질문을 보고 적절한 답변을 생성해주세요.
모든 entry ID에 대해 답변을 포함하세요.`;

    // Call Haiku
    const llmRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const llmData = await llmRes.json();
    const llmText = llmData.content?.[0]?.text || "{}";

    // Parse LLM response
    let formValues: Record<string, string>;
    try {
      const jsonMatch =
        llmText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)?.[1] ||
        llmText.match(/\{[\s\S]*\}/)?.[0] ||
        llmText;
      formValues = JSON.parse(jsonMatch);
    } catch {
      return NextResponse.json({ error: "LLM response parsing failed", raw: llmText }, { status: 500 });
    }

    // Override with exact profile values for mapped fields
    for (const [entryId, profileField] of Object.entries(event.form_mapping as Record<string, string | null>)) {
      if (profileField && profile[profileField]) {
        formValues[entryId] = profile[profileField];
      }
    }

    // Submit to Google Forms
    const formUrl = `https://docs.google.com/forms/d/e/${event.form_id}/formResponse`;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(formValues)) {
      if (value) body.append(key, value);
    }

    const submitRes = await fetch(formUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      redirect: "follow",
    });

    // Log LLM usage
    const inputTokens = llmData.usage?.input_tokens || 0;
    const outputTokens = llmData.usage?.output_tokens || 0;
    try {
      await supabase.from("llm_logs").insert({
        model: "claude-haiku-4-5-20251001",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: inputTokens * 0.8 / 1_000_000 + outputTokens * 4.0 / 1_000_000,
        prompt_preview: userMessage.slice(0, 200),
        response_preview: llmText.slice(0, 500),
        purpose: "auto_register",
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      submitted: Object.keys(formValues).length,
      formUrl,
      status: submitRes.status,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
