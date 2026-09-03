/**
 * Database upserter — writes classified events into Supabase.
 *
 * Uses the service_role key for write access (RLS is configured to allow
 * only anon reads; writes go through the service role).
 *
 * Environment variables:
 *   SUPABASE_URL          – Supabase project URL
 *   SUPABASE_SERVICE_KEY  – service_role key (NOT the anon key)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import type { ClassifiedEvent, LLMUsage } from "./llm-classifier";
import type { FormMapping } from "./form-parser";

export interface UpsertResult {
  action: "added" | "updated" | "skipped";
  eventId?: string;
  diff?: Record<string, unknown>;
}

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.",
      );
    }
    _supabase = createClient(url, key, {
      realtime: { enabled: false },
    });
  }
  return _supabase;
}

/**
 * Generate a deterministic hash for deduplication.
 * Based on title + start_at as specified in the data model.
 */
function computeSourceHash(title: string, startAt: string): string {
  return createHash("sha256")
    .update(`${title}|${startAt}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Normalize a title for fuzzy comparison by stripping bracketed tags,
 * common re-announcement prefixes, and collapsing whitespace.
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/^(RE:|FW:|재안내|리마인더|Reminder)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Compute a 0-1 similarity score between two event titles.
 * Uses normalized forms: exact match = 1, substring containment = 0.9,
 * otherwise falls back to character-set overlap ratio.
 */
function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  // Simple character-set overlap
  const setA = new Set(na);
  const setB = new Set(nb);
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  return intersection / Math.max(setA.size, setB.size);
}

/**
 * Find an existing event on the same day whose title is fuzzy-similar.
 * Returns the matching row or null.
 */
async function findFuzzyMatch(
  supabase: SupabaseClient,
  title: string,
  startAt: string,
): Promise<Record<string, unknown> | null> {
  // Derive the date portion (YYYY-MM-DD) from startAt
  const dayStart = startAt.slice(0, 10);
  const dayEnd = `${dayStart}T23:59:59.999Z`;

  const { data: sameDayEvents, error } = await supabase
    .from("events")
    .select("*")
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd);

  if (error) {
    console.warn("[db] Fuzzy match query failed:", error);
    return null;
  }

  if (!sameDayEvents || sameDayEvents.length === 0) return null;

  let bestMatch: Record<string, unknown> | null = null;
  let bestScore = 0;

  for (const row of sameDayEvents) {
    const score = titleSimilarity(title, row.title as string);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }

  if (bestScore > 0.7) {
    console.log(
      `[db] Fuzzy match found (score=${bestScore.toFixed(2)}): ` +
        `"${title}" ~ "${(bestMatch as Record<string, unknown>).title}"`,
    );
    return bestMatch;
  }

  return null;
}

/**
 * Upsert a single classified event into the `events` table.
 *
 * - If no row with the same `source_hash` exists, INSERT + log "added".
 * - If a row exists and fields differ, UPDATE + log "updated" with diff.
 * - If a row exists and nothing changed, skip.
 */
export async function upsertEvent(
  event: ClassifiedEvent,
  sourceType: "email" | "portal",
  formId?: string | null,
  formMapping?: FormMapping | null,
): Promise<UpsertResult> {
  if (!event.is_food_event || !event.title || !event.start_at) {
    return { action: "skipped" };
  }

  const supabase = getSupabase();
  const sourceHash = computeSourceHash(event.title, event.start_at);

  // Check for existing row
  const { data: existing, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("source_hash", sourceHash)
    .maybeSingle();

  if (fetchError) {
    console.error("[db] Error checking existing event:", fetchError);
    throw fetchError;
  }

  const newRow = {
    title: event.title,
    start_at: event.start_at,
    end_at: event.end_at || null,
    location: event.location || null,
    food_type: event.food_type || "기타",
    food_note: event.food_note || null,
    target_audience: event.target_audience || null,
    register_url: event.register_url || null,
    source_type: sourceType,
    source_hash: sourceHash,
    description: event.description || null,
    form_id: formId || null,
    form_mapping: formMapping || null,
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    // No exact hash match -- try fuzzy matching on same-day events
    const fuzzyMatch = await findFuzzyMatch(supabase, event.title, event.start_at);

    if (fuzzyMatch) {
      // Treat as an update to the fuzzy-matched event
      const diff = buildDiff(fuzzyMatch, newRow);

      if (Object.keys(diff).length === 0) {
        console.log(`[db] Skipped (fuzzy match, no changes): "${event.title}"`);
        return { action: "skipped", eventId: fuzzyMatch.id as string };
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({ ...newRow, updated_at: new Date().toISOString() })
        .eq("id", fuzzyMatch.id);

      if (updateError) {
        console.error("[db] Fuzzy-match update error:", updateError);
        throw updateError;
      }

      await logUpdate(fuzzyMatch.id as string, "updated", diff);

      console.log(
        `[db] Updated event (fuzzy match): "${event.title}" (${fuzzyMatch.id})`,
        diff,
      );
      return { action: "updated", eventId: fuzzyMatch.id as string, diff };
    }

    // No match at all -- INSERT new event
    const { data: inserted, error: insertError } = await supabase
      .from("events")
      .insert(newRow)
      .select("id")
      .single();

    if (insertError) {
      console.error("[db] Insert error:", insertError);
      throw insertError;
    }

    // Log the addition
    await logUpdate(inserted.id, "added", null);

    console.log(`[db] Added event: "${event.title}" (${inserted.id})`);
    return { action: "added", eventId: inserted.id };
  }

  // Compare fields and build diff
  const diff = buildDiff(existing, newRow);

  if (Object.keys(diff).length === 0) {
    console.log(`[db] Skipped (no changes): "${event.title}"`);
    return { action: "skipped", eventId: existing.id };
  }

  // UPDATE existing event
  const { error: updateError } = await supabase
    .from("events")
    .update({ ...newRow, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (updateError) {
    console.error("[db] Update error:", updateError);
    throw updateError;
  }

  await logUpdate(existing.id, "updated", diff);

  console.log(`[db] Updated event: "${event.title}" (${existing.id})`, diff);
  return { action: "updated", eventId: existing.id, diff };
}

/**
 * Insert an update_logs entry.
 */
async function logUpdate(
  eventId: string,
  action: "added" | "updated" | "removed",
  diff: Record<string, unknown> | null,
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from("update_logs").insert({
    event_id: eventId,
    action,
    diff,
  });

  if (error) {
    console.warn("[db] Failed to write update_log:", error);
  }
}

/**
 * Build a diff object showing which fields changed.
 * Only includes fields that actually differ.
 */
function buildDiff(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {};

  const fieldsToCompare = [
    "title",
    "start_at",
    "end_at",
    "location",
    "food_type",
    "food_note",
    "target_audience",
    "register_url",
    "description",
    "form_id",
  ];

  for (const field of fieldsToCompare) {
    const oldVal = existing[field] ?? null;
    const newVal = incoming[field] ?? null;

    // Normalize for comparison
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);

    if (oldStr !== newStr) {
      diff[field] = { old: oldVal, new: newVal };
    }
  }

  return diff;
}

/**
 * Save LLM usage logs to the llm_logs table.
 */
export async function saveLLMUsageLogs(logs: LLMUsage[]): Promise<void> {
  if (logs.length === 0) return;
  const supabase = getSupabase();

  const rows = logs.map((l) => ({
    model: l.model,
    input_tokens: l.input_tokens,
    output_tokens: l.output_tokens,
    cost_usd: l.cost_usd,
    prompt_preview: l.prompt_preview,
    response_preview: l.response_preview,
    purpose: l.purpose,
  }));

  const { error } = await supabase.from("llm_logs").insert(rows);
  if (error) {
    console.warn("[db] Failed to save LLM logs:", error.message);
  } else {
    console.log(`[db] Saved ${rows.length} LLM usage log(s)`);
  }
}

/**
 * Get the timestamp of the most recent event in the database.
 * Used to determine the "since" date for IMAP fetching.
 */
export async function getLastCollectionTime(): Promise<Date> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("update_logs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[db] Failed to get last collection time:", error);
  }

  if (data?.created_at) {
    return new Date(data.created_at);
  }

  // Default: look back 7 days on first run
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return sevenDaysAgo;
}
