#!/usr/bin/env tsx
/**
 * crawl.ts — KAIST 학과 공지사항 crawler.
 *
 * For each site in sites.ts:
 *   1. Fetch board list page, extract detail links
 *   2. Drop URLs already in crawled_notices
 *   3. Fetch each new detail page, reduce to text
 *   4. Mask PII, classify with Claude Haiku (existing classifier)
 *   5. Parse Google Forms, upsert food events (source_type = "portal")
 *   6. Record every classified URL in crawled_notices
 *
 * Usage:
 *   npx tsx crawl.ts                 # full run
 *   npx tsx crawl.ts --dry-run       # steps 1–3 only, no LLM, no DB writes
 *   npx tsx crawl.ts --site=전산     # only sites whose dept contains "전산"
 *
 * Environment variables (full run):
 *   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SITES } from "./sites";
import {
  fetchHtml,
  extractNoticeLinks,
  extractNoticeText,
  type NoticeSite,
  type NoticeLink,
} from "./notice-crawler";
import { maskForLLM } from "./privacy-filter";
import type { FetchedEmail } from "./imap-fetcher";
import {
  classifyEmails,
  usageLogs,
  getTotalUsage,
  type ClassifiedEvent,
} from "./llm-classifier";
import { parseAndMapForm, extractFormId, type FormMapping } from "./form-parser";
import { upsertEvent, saveLLMUsageLogs } from "./db-upserter";

const MAX_LINKS_PER_SITE = 30;

interface Args {
  dryRun: boolean;
  site: string | null;
}

interface FetchedNotice {
  site: NoticeSite;
  link: NoticeLink;
  text: string;
  urls: string[];
}

function parseArgs(argv: string[]): Args {
  const siteArg = argv.find((a) => a.startsWith("--site="));
  return {
    dryRun: argv.includes("--dry-run"),
    site: siteArg ? siteArg.slice("--site=".length) : null,
  };
}

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

/** Return the subset of urls that are NOT yet in crawled_notices. */
async function filterUnseen(urls: string[]): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase || urls.length === 0) return urls;
  const { data, error } = await supabase
    .from("crawled_notices")
    .select("url")
    .in("url", urls);
  if (error) {
    throw new Error(`crawled_notices query failed: ${error.message}`);
  }
  const seen = new Set((data || []).map((r) => r.url as string));
  return urls.filter((u) => !seen.has(u));
}

async function recordNotice(row: {
  url: string;
  dept: string;
  title: string;
  is_food_event: boolean;
  event_id: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("crawled_notices").upsert(row, { onConflict: "url" });
  if (error) console.warn(`[crawl] Failed to record ${row.url}: ${error.message}`);
}

/**
 * Steps 1–3 for one site. Returns null if the site failed entirely.
 */
async function crawlSite(
  site: NoticeSite,
  dryRun: boolean,
): Promise<{ links: number; fresh: number; notices: FetchedNotice[] } | null> {
  let links: NoticeLink[];
  try {
    const html = await fetchHtml(site.listUrl);
    links = extractNoticeLinks(html, site).slice(0, MAX_LINKS_PER_SITE);
  } catch (err) {
    console.warn(`[crawl] ${site.dept}: list fetch failed — ${(err as Error).message}`);
    return null;
  }
  if (links.length === 0) {
    console.warn(`[crawl] ${site.dept}: 0 links (selector broken?) — ${site.listUrl}`);
    return null;
  }

  const unseenUrls = new Set(await filterUnseen(links.map((l) => l.url)));
  const fresh = links.filter((l) => unseenUrls.has(l.url));
  console.log(`[crawl] ${site.dept}: links=${links.length} new=${fresh.length}`);

  const notices: FetchedNotice[] = [];
  for (const link of fresh) {
    try {
      const html = await fetchHtml(link.url);
      const { text, urls } = extractNoticeText(html, link.url);
      notices.push({ site, link, text, urls });
      if (dryRun) {
        console.log(`    ${link.title} | text=${text.length} urls=${urls.length}`);
      }
    } catch (err) {
      console.warn(`[crawl]   detail fetch failed, will retry next run: ${link.url} — ${(err as Error).message}`);
    }
  }
  return { links: links.length, fresh: fresh.length, notices };
}

async function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv.slice(2));
  console.log("=== ssal-finder dept notice crawler ===");
  console.log(`Started at: ${new Date().toISOString()}${args.dryRun ? " (dry run)" : ""}`);

  const sites = args.site ? SITES.filter((s) => s.dept.includes(args.site!)) : SITES;
  if (sites.length === 0) {
    console.error(`No site matches --site=${args.site}`);
    process.exit(1);
  }

  if (!args.dryRun && !getSupabase()) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY required for a full run.");
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // Steps 1–3: crawl every site
  // -----------------------------------------------------------------------
  console.log("\n--- Step 1-3: Crawling boards ---");
  let sitesOk = 0;
  let sitesFailed = 0;
  let totalLinks = 0;
  let totalFresh = 0;
  const notices: FetchedNotice[] = [];

  for (const site of sites) {
    const result = await crawlSite(site, args.dryRun);
    if (!result) {
      sitesFailed++;
      continue;
    }
    sitesOk++;
    totalLinks += result.links;
    totalFresh += result.fresh;
    notices.push(...result.notices);
  }

  if (sitesOk === 0) {
    console.error("Every site failed. Exiting with error.");
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(`\n=== Dry run complete: sites ok=${sitesOk} failed=${sitesFailed} links=${totalLinks} new=${totalFresh} fetched=${notices.length}`);
    return;
  }

  if (notices.length === 0) {
    console.log("No new notices. Exiting.");
    return;
  }

  // -----------------------------------------------------------------------
  // Step 4: Mask PII, classify
  // -----------------------------------------------------------------------
  console.log(`\n--- Step 4: LLM classification (${notices.length} notice(s)) ---`);
  const maskedItems = notices.map((n) => {
    const pseudoEmail: FetchedEmail = {
      uid: 0,
      subject: `[${n.site.dept}] ${n.link.title}`,
      from: n.site.dept,
      to: [],
      date: null,
      body: n.text,
      html: null,
    };
    const masked = maskForLLM(pseudoEmail);
    if (n.urls.length > 0) {
      masked.body += "\n\n[본문에 포함된 링크들]\n" + n.urls.join("\n");
    }
    return masked;
  });

  const classifications = await classifyEmails(maskedItems);

  const foodEvents: Array<{ notice: FetchedNotice; classification: ClassifiedEvent }> = [];
  for (let i = 0; i < classifications.length; i++) {
    const cls = classifications[i];
    if (cls.is_food_event) {
      foodEvents.push({ notice: notices[i], classification: cls });
      console.log(`  Food event: "${cls.title}" (${cls.food_type}) — ${notices[i].site.dept}`);
    } else {
      console.log(`  Not food: "${notices[i].link.title}" — ${notices[i].site.dept}`);
    }
  }
  console.log(`Food events found: ${foodEvents.length}`);

  // -----------------------------------------------------------------------
  // Step 5: Google Forms + upsert
  // -----------------------------------------------------------------------
  console.log("\n--- Step 5: Forms + DB upsert ---");
  const formCache = new Map<string, { formId: string | null; mapping: FormMapping }>();
  for (const { classification } of foodEvents) {
    const url = classification.register_url;
    if (!url) continue;
    if (!url.includes("google.com/forms") && !url.includes("forms.gle")) continue;
    try {
      const result = await parseAndMapForm(url);
      const fid = result.formId || url;
      if (!formCache.has(fid)) {
        formCache.set(fid, result);
        console.log(`  Parsed form: ${url} -> ${Object.keys(result.mapping).length} fields`);
      }
    } catch (err) {
      console.warn(`  Form parse failed for ${url}:`, err);
    }
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const eventIdByUrl = new Map<string, string | null>();

  for (const { notice, classification } of foodEvents) {
    const url = classification.register_url;
    const formId = url ? extractFormId(url) : null;
    const formData = formId ? formCache.get(formId) : url ? formCache.get(url) : null;
    try {
      const result = await upsertEvent(classification, "portal", formData?.formId, formData?.mapping);
      eventIdByUrl.set(notice.link.url, result.eventId ?? null);
      if (result.action === "added") added++;
      else if (result.action === "updated") updated++;
      else skipped++;
    } catch (err) {
      console.error(`  Failed to upsert "${classification.title}":`, err);
      eventIdByUrl.set(notice.link.url, null);
    }
  }

  // -----------------------------------------------------------------------
  // Step 6: Record crawled URLs (food or not)
  // -----------------------------------------------------------------------
  console.log("\n--- Step 6: Recording crawled notices ---");
  for (let i = 0; i < notices.length; i++) {
    const n = notices[i];
    await recordNotice({
      url: n.link.url,
      dept: n.site.dept,
      title: n.link.title,
      is_food_event: Boolean(classifications[i].is_food_event),
      event_id: eventIdByUrl.get(n.link.url) ?? null,
    });
  }

  await saveLLMUsageLogs(usageLogs);
  const totalUsage = getTotalUsage();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Crawl complete ===");
  console.log(`  Sites ok/failed: ${sitesOk}/${sitesFailed}`);
  console.log(`  Links seen:      ${totalLinks}`);
  console.log(`  New notices:     ${notices.length}`);
  console.log(`  Food events:     ${foodEvents.length}`);
  console.log(`  DB added:        ${added}`);
  console.log(`  DB updated:      ${updated}`);
  console.log(`  DB skipped:      ${skipped}`);
  console.log(`  LLM calls:       ${totalUsage.calls}`);
  console.log(`  LLM cost:        $${totalUsage.cost_usd.toFixed(4)}`);
  console.log(`  Elapsed:         ${elapsed}s`);
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
