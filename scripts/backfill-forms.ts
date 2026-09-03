/**
 * Backfill form_mapping for existing events.
 *
 * Finds events that have a Google Forms register_url but no form_mapping,
 * then uses the form-parser module to fetch, parse, and map each form.
 *
 * Usage:
 *   npx tsx backfill-forms.ts
 *
 * Environment variables:
 *   SUPABASE_URL         – Supabase project URL
 *   SUPABASE_SERVICE_KEY – service_role key
 *   ANTHROPIC_API_KEY    – API key for Claude (used by form-parser LLM step)
 */

import { createClient } from "@supabase/supabase-js";
import { parseAndMapForm } from "./form-parser";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    realtime: { enabled: false },
  });

  // Find events with a Google Forms URL but no form_mapping
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, register_url")
    .is("form_mapping", null)
    .or("register_url.ilike.%google.com/forms%,register_url.ilike.%forms.gle%");

  if (error) {
    console.error("Failed to query events:", error);
    process.exit(1);
  }

  if (!events || events.length === 0) {
    console.log("No events to backfill.");
    return;
  }

  console.log(`Found ${events.length} event(s) to backfill.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of events) {
    const label = `"${event.title}" (${event.id})`;

    if (!event.register_url) {
      console.log(`[skip] ${label} — no register_url`);
      skipped++;
      continue;
    }

    console.log(`[parse] ${label}`);
    console.log(`        URL: ${event.register_url}`);

    try {
      const { formId, mapping } = await parseAndMapForm(event.register_url);

      if (Object.keys(mapping).length === 0) {
        console.log(`[skip] ${label} — no fields parsed\n`);
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({
          form_id: formId,
          form_mapping: mapping,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (updateError) {
        console.error(`[fail] ${label} — DB update error:`, updateError);
        failed++;
        continue;
      }

      console.log(`[done] ${label} — mapped ${Object.keys(mapping).length} field(s)\n`);
      success++;
    } catch (err) {
      console.error(`[fail] ${label} —`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log("\n--- Backfill complete ---");
  console.log(`  Success: ${success}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed:  ${failed}`);
}

main();
