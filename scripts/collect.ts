#!/usr/bin/env tsx
/**
 * collect.ts — Main entry point for the email collection pipeline.
 *
 * Orchestrates:
 *   1. IMAP fetch (emails since last run)
 *   2. Privacy filter (discard personal emails)
 *   3. PII masking (before LLM)
 *   4. LLM classification (Claude Haiku)
 *   5. Google Forms parsing (if register_url points to a form)
 *   6. DB upsert (Supabase)
 *
 * Usage:
 *   npx tsx collect.ts
 *
 * Can also pass --since=YYYY-MM-DD to override the lookback date.
 *
 * Environment variables (all required):
 *   GMAIL_USER           – doorayhwan809@gmail.com
 *   GMAIL_APP_PASS       – Gmail App Password
 *   ANTHROPIC_API_KEY    – Claude API key
 *   SUPABASE_URL         – Supabase project URL
 *   SUPABASE_SERVICE_KEY – Supabase service_role key
 */

import { fetchEmailsSince, fetchBodies, type FetchedEmail } from "./imap-fetcher";
import { shouldProcess, maskForLLM } from "./privacy-filter";
import { classifyEmails, type ClassifiedEvent } from "./llm-classifier";
import { parseAndMapForm, extractFormId, type FormMapping } from "./form-parser";
import { upsertEvent, getLastCollectionTime, saveLLMUsageLogs } from "./db-upserter";
import { usageLogs, getTotalUsage } from "./llm-classifier";

async function main() {
  const startTime = Date.now();
  console.log("=== ssal-finder collection pipeline ===");
  console.log(`Started at: ${new Date().toISOString()}`);

  // Determine "since" date
  let sinceDate: Date;

  const sinceArg = process.argv.find((arg) => arg.startsWith("--since="));
  if (sinceArg) {
    sinceDate = new Date(sinceArg.split("=")[1]);
    console.log(`Using --since override: ${sinceDate.toISOString()}`);
  } else {
    sinceDate = await getLastCollectionTime();
    console.log(`Last collection: ${sinceDate.toISOString()}`);
  }

  // -----------------------------------------------------------------------
  // Step 1: Fetch emails from IMAP
  // -----------------------------------------------------------------------
  console.log("\n--- Step 1: Fetching emails from IMAP ---");
  let emails: FetchedEmail[];
  try {
    emails = await fetchEmailsSince(sinceDate);
  } catch (err) {
    console.error("IMAP fetch failed:", err);
    process.exit(1);
  }
  console.log(`Fetched ${emails.length} email(s)`);

  if (emails.length === 0) {
    console.log("No new emails. Exiting.");
    return;
  }

  // -----------------------------------------------------------------------
  // Step 2: Privacy filter
  // -----------------------------------------------------------------------
  console.log("\n--- Step 2: Privacy filter ---");
  const filtered: FetchedEmail[] = [];
  let discarded = 0;

  for (const email of emails) {
    const result = shouldProcess(email);
    if (result.passed) {
      filtered.push(email);
    } else {
      discarded++;
      console.log(
        `  Discarded: "${email.subject}" — ${result.reason}`,
      );
    }
  }

  console.log(
    `Passed: ${filtered.length}, Discarded: ${discarded}`,
  );

  if (filtered.length === 0) {
    console.log("No emails passed privacy filter. Exiting.");
    return;
  }

  // -----------------------------------------------------------------------
  // Step 2.5: Fetch bodies for filtered emails
  // -----------------------------------------------------------------------
  console.log("\n--- Step 2.5: Fetching bodies ---");
  const uidsToFetch = filtered.map((e) => e.uid);
  const bodies = await fetchBodies(uidsToFetch);
  for (const e of filtered) {
    if (bodies[e.uid]) e.body = bodies[e.uid];
  }

  // -----------------------------------------------------------------------
  // Step 3: Mask PII and send to LLM
  // -----------------------------------------------------------------------
  console.log("\n--- Step 3: LLM classification ---");
  const maskedItems = filtered.map((email) => maskForLLM(email));

  const classifications = await classifyEmails(maskedItems);

  const foodEvents: Array<{
    classification: ClassifiedEvent;
    originalEmail: FetchedEmail;
  }> = [];

  for (let i = 0; i < classifications.length; i++) {
    const cls = classifications[i];
    if (cls.is_food_event) {
      foodEvents.push({
        classification: cls,
        originalEmail: filtered[i],
      });
      console.log(`  Food event: "${cls.title}" (${cls.food_type})`);
    } else {
      console.log(`  Not food: "${filtered[i].subject}"`);
    }
  }

  console.log(`Food events found: ${foodEvents.length}`);

  if (foodEvents.length === 0) {
    console.log("No food events found. Exiting.");
    return;
  }

  // -----------------------------------------------------------------------
  // Step 4: Parse Google Forms (if register_url is a Google Form)
  // -----------------------------------------------------------------------
  console.log("\n--- Step 4: Google Forms parsing ---");
  const formCache = new Map<
    string,
    { formId: string | null; mapping: FormMapping }
  >();

  for (const { classification } of foodEvents) {
    const url = classification.register_url;
    if (!url || !url.includes("docs.google.com/forms")) continue;

    const formId = extractFormId(url);
    if (!formId || formCache.has(formId)) continue;

    try {
      const result = await parseAndMapForm(url);
      formCache.set(formId, result);
    } catch (err) {
      console.warn(`  Form parse failed for ${url}:`, err);
    }
  }

  console.log(`Parsed ${formCache.size} unique form(s)`);

  // -----------------------------------------------------------------------
  // Step 5: Upsert to database
  // -----------------------------------------------------------------------
  console.log("\n--- Step 5: Database upsert ---");
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const { classification } of foodEvents) {
    const formId = classification.register_url
      ? extractFormId(classification.register_url)
      : null;
    const formData = formId ? formCache.get(formId) : null;

    try {
      const result = await upsertEvent(
        classification,
        "email",
        formData?.formId,
        formData?.mapping,
      );

      switch (result.action) {
        case "added":
          added++;
          break;
        case "updated":
          updated++;
          break;
        case "skipped":
          skipped++;
          break;
      }
    } catch (err) {
      console.error(
        `  Failed to upsert "${classification.title}":`,
        err,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  // Save LLM usage logs to DB
  console.log("\n--- Step 6: Saving LLM usage logs ---");
  await saveLLMUsageLogs(usageLogs);
  const totalUsage = getTotalUsage();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n=== Pipeline complete ===");
  console.log(`  Emails fetched:  ${emails.length}`);
  console.log(`  Privacy passed:  ${filtered.length}`);
  console.log(`  Food events:     ${foodEvents.length}`);
  console.log(`  DB added:        ${added}`);
  console.log(`  DB updated:      ${updated}`);
  console.log(`  DB skipped:      ${skipped}`);
  console.log(`  Forms parsed:    ${formCache.size}`);
  console.log(`  LLM calls:       ${totalUsage.calls}`);
  console.log(`  LLM tokens:      ${totalUsage.input_tokens} in / ${totalUsage.output_tokens} out`);
  console.log(`  LLM cost:        $${totalUsage.cost_usd.toFixed(4)}`);
  console.log(`  Elapsed:         ${elapsed}s`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
