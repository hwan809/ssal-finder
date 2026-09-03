/**
 * Google Forms parser.
 *
 * Given a Google Forms URL, this module:
 *   1. Fetches the form page HTML
 *   2. Extracts `entry.XXXXX` field IDs and their associated labels
 *   3. Uses Claude Haiku to map each label to a profile field
 *      (name, student_id, department, email, phone)
 *   4. Returns a mapping: Record<entryId, profileField>
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY – API key for Claude (shared with llm-classifier)
 */

// Dynamic import: only loaded when ANTHROPIC_API_KEY is set
// import Anthropic from "@anthropic-ai/sdk";

export interface FormField {
  entryId: string;
  label: string;
}

export type ProfileField =
  | "name"
  | "student_id"
  | "department"
  | "email"
  | "phone";

export type FormMapping = Record<string, ProfileField | null>;

/**
 * Extract the form ID from a Google Forms URL.
 * Handles both /viewform and /formResponse URLs.
 */
export function extractFormId(url: string): string | null {
  const match = url.match(/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

/**
 * Resolve a short URL (e.g. forms.gle/xxx) to the full Google Forms URL.
 * Uses redirect: "manual" to read the Location header without following
 * the entire redirect chain (avoids closed-form redirects).
 */
async function resolveShortUrl(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "manual" });
  const location = res.headers.get("location");
  if (location && location.includes("docs.google.com/forms")) {
    return location;
  }
  // If first hop didn't land on Google Forms, return as-is
  return url;
}

/**
 * Fetch a Google Form's HTML and extract entry IDs and labels.
 */
export async function extractFormFields(formUrl: string): Promise<FormField[]> {
  // Resolve short URLs (forms.gle) to their full Google Forms URL
  let url = formUrl;
  if (
    url.includes("forms.gle/") ||
    (!url.includes("docs.google.com/forms") && !url.includes("/viewform"))
  ) {
    url = await resolveShortUrl(url);
  }

  // Normalize to the viewform URL
  if (!url.includes("/viewform")) {
    const formId = extractFormId(url);
    if (formId) {
      url = `https://docs.google.com/forms/d/e/${formId}/viewform`;
    }
  }

  // Strip any query params and ensure /viewform ending
  if (url.includes("/viewform?")) {
    url = url.replace(/\?.*$/, "");
  }

  // Fetch the form HTML; use redirect: "manual" so we can detect
  // closed-form redirects and still attempt to extract the viewform page.
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
  });

  // If the form redirects to /closedform, it's closed -- try to fetch the
  // closedform page (it sometimes still has FB_PUBLIC_LOAD_DATA_), but also
  // note the form is closed.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    if (location.includes("/closedform")) {
      // Fetch the closedform page
      const closedRes = await fetch(location, {
        headers: { "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
      });
      if (!closedRes.ok) {
        throw new Error(
          `Form is closed and closedform page returned ${closedRes.status}`,
        );
      }
      const closedHtml = await closedRes.text();
      const fields = parseFormHtml(closedHtml);
      if (fields.length > 0) return fields;
      // closedform pages often lack field data -- return empty with a warning
      console.warn(
        `[form-parser] Form is closed (redirected to /closedform), no field data available.`,
      );
      return [];
    }
    // Other redirect -- follow it
    const redirectUrl = location.startsWith("http")
      ? location
      : new URL(location, url).href;
    const redirectRes = await fetch(redirectUrl, {
      headers: { "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
    });
    if (!redirectRes.ok) {
      throw new Error(
        `Failed to fetch form after redirect: ${redirectRes.status} ${redirectRes.statusText}`,
      );
    }
    const html = await redirectRes.text();
    return parseFormHtml(html);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch form: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  return parseFormHtml(html);
}

/**
 * Parse the Google Forms HTML to extract field IDs and labels.
 *
 * Google Forms renders field data in an embedded script as a JavaScript
 * data structure.  The entry IDs appear as numeric identifiers and labels
 * are nearby strings.  We use two strategies:
 *
 * 1. Look for the FB_PUBLIC_LOAD_DATA_ script which contains a large
 *    nested array with field metadata.
 * 2. Fall back to regex scanning for `entry.XXXXX` paired with nearby
 *    label text in the HTML.
 */
function parseFormHtml(html: string): FormField[] {
  const fields: FormField[] = [];
  const seenEntryIds = new Set<string>();

  // Strategy 1: Parse the FB_PUBLIC_LOAD_DATA_ script payload.
  // The field definitions live inside a nested array.  Each field block
  // contains the entry ID (a large number) and the label string.
  const dataMatch = html.match(
    /FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/,
  );
  if (dataMatch) {
    try {
      const data = JSON.parse(dataMatch[1]);
      // data[1][1] is typically the list of field groups
      const fieldGroups = data?.[1]?.[1];
      if (Array.isArray(fieldGroups)) {
        for (const group of fieldGroups) {
          // group[1] = label text
          // group[4] = array of sub-fields, each sub-field has [0] = entry ID
          const label = group?.[1];
          const subFields = group?.[4];
          if (Array.isArray(subFields)) {
            for (const sub of subFields) {
              const entryId = sub?.[0];
              if (entryId != null && typeof label === "string") {
                const id = `entry.${entryId}`;
                if (!seenEntryIds.has(id)) {
                  seenEntryIds.add(id);
                  fields.push({ entryId: id, label: label.trim() });
                }
              }
            }
          }
        }
      }
    } catch {
      // Fall through to strategy 2
    }
  }

  if (fields.length > 0) return fields;

  // Strategy 2: Regex-based extraction from the HTML body.
  // Google Forms often renders hidden input-like attributes with entry IDs.
  const entryPattern =
    /data-params="[^"]*?(entry\.\d+)[^"]*?"[\s\S]*?class="[^"]*?"[^>]*>([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(html)) !== null) {
    const entryId = match[1];
    const label = match[2].trim();
    if (!seenEntryIds.has(entryId)) {
      seenEntryIds.add(entryId);
      fields.push({ entryId, label });
    }
  }

  if (fields.length > 0) return fields;

  // Strategy 3: Simplest fallback — find all entry.NNNNNN references
  // and pair them with any visible label-like text nearby.
  const simplePattern = /entry\.(\d+)/g;
  const entryIds: string[] = [];
  let simpleMatch: RegExpExecArray | null;
  while ((simpleMatch = simplePattern.exec(html)) !== null) {
    const id = `entry.${simpleMatch[1]}`;
    if (!seenEntryIds.has(id)) {
      seenEntryIds.add(id);
      entryIds.push(id);
    }
  }

  // Try to extract labels from aria-label attributes near each entry ID
  for (const id of entryIds) {
    const numericId = id.replace("entry.", "");
    const labelPattern = new RegExp(
      `aria-label="([^"]+)"[^>]*name="${id}"` +
        `|name="${id}"[^>]*aria-label="([^"]+)"` +
        `|data-item-id="${numericId}"[\\s\\S]*?class="[^"]*freebirdFormviewItemItemHeader[^"]*"[^>]*>([^<]+)`,
    );
    const lm = labelPattern.exec(html);
    const label = lm?.[1] || lm?.[2] || lm?.[3] || "";
    fields.push({ entryId: id, label: label.trim() || `(field ${numericId})` });
  }

  return fields;
}

/**
 * Heuristic keyword-based mapping of form field labels to profile fields.
 * Used as a fallback when ANTHROPIC_API_KEY is not available.
 */
function heuristicMapFields(fields: FormField[]): FormMapping {
  const patterns: Array<{ field: ProfileField; keywords: RegExp }> = [
    { field: "name", keywords: /이름|성명|name|full\s*name/i },
    { field: "student_id", keywords: /학번|student.?id|학생.?번호/i },
    { field: "department", keywords: /학과|소속|학부|전공|department|major|college|단과/i },
    { field: "email", keywords: /이메일|e-?mail|메일/i },
    { field: "phone", keywords: /전화|휴대|핸드폰|연락처|phone|mobile|tel/i },
  ];

  const result: FormMapping = {};
  const usedFields = new Set<string>();

  for (const f of fields) {
    let matched: ProfileField | null = null;
    for (const p of patterns) {
      if (!usedFields.has(p.field) && p.keywords.test(f.label)) {
        matched = p.field;
        usedFields.add(p.field);
        break;
      }
    }
    result[f.entryId] = matched;
  }

  return result;
}

/**
 * Use Claude Haiku to map form field labels to profile fields.
 * Falls back to heuristic keyword matching when ANTHROPIC_API_KEY is not set.
 */
export async function mapFieldsToProfile(
  fields: FormField[],
): Promise<FormMapping> {
  if (fields.length === 0) return {};

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[form-parser] ANTHROPIC_API_KEY not set, using heuristic mapping.");
    return heuristicMapFields(fields);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const fieldList = fields
    .map((f) => `- ${f.entryId}: "${f.label}"`)
    .join("\n");

  const systemPrompt = `Google 설문지의 필드 라벨을 사용자 프로필 필드에 매핑하세요.

가능한 프로필 필드:
- name: 이름
- student_id: 학번
- department: 학과/소속
- email: 이메일
- phone: 전화번호/휴대폰

어떤 프로필 필드에도 해당하지 않는 필드는 null로 매핑하세요.

반드시 유효한 JSON 객체만 출력하세요. 키는 entry ID (예: "entry.123456"), 값은 프로필 필드명 또는 null.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-20250414",
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `다음 설문지 필드를 매핑해주세요:\n\n${fieldList}`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => {
        if (block.type === "text") return block.text;
        return "";
      })
      .join("") || "";

  // Extract JSON from response
  const jsonMatch =
    text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)?.[1] ||
    text.match(/\{[\s\S]*\}/)?.[0] ||
    text.trim();

  try {
    const mapping = JSON.parse(jsonMatch) as Record<string, string | null>;

    // Validate and normalize
    const validFields = new Set<string>([
      "name",
      "student_id",
      "department",
      "email",
      "phone",
    ]);
    const result: FormMapping = {};

    for (const [entryId, value] of Object.entries(mapping)) {
      if (value === null || !validFields.has(value)) {
        result[entryId] = null;
      } else {
        result[entryId] = value as ProfileField;
      }
    }

    return result;
  } catch {
    console.warn("[form-parser] Failed to parse LLM mapping response:", text);
    return {};
  }
}

/**
 * High-level: given a form URL, extract fields and map them to profile fields.
 */
export async function parseAndMapForm(
  formUrl: string,
): Promise<{ formId: string | null; mapping: FormMapping }> {
  // Resolve short URL first to get form_id
  let resolvedUrl = formUrl;
  if (formUrl.includes("forms.gle/") || !formUrl.includes("docs.google.com/forms")) {
    resolvedUrl = await resolveShortUrl(formUrl);
  }
  const formId = extractFormId(resolvedUrl);
  console.log(`[form-parser] Parsing form: ${formUrl} -> ${resolvedUrl} (id: ${formId})`);

  try {
    const fields = await extractFormFields(formUrl);
    console.log(`[form-parser] Found ${fields.length} field(s):`, fields);

    if (fields.length === 0) {
      return { formId, mapping: {} };
    }

    const mapping = await mapFieldsToProfile(fields);
    console.log("[form-parser] Mapping result:", mapping);

    return { formId, mapping };
  } catch (err) {
    console.warn("[form-parser] Failed to parse form:", err);
    return { formId, mapping: {} };
  }
}
