#!/usr/bin/env tsx
/**
 * crawl.ts — KAIST 학과 공지사항 crawler.
 *
 * Each site in sites.ts is processed end-to-end before the next one, so a
 * timeout mid-run keeps the dedup state of the sites already done:
 *   1. Fetch board list page, extract detail links + the page's chrome links
 *   2. Drop URLs already in crawled_notices
 *   3. Fetch each new detail page, reduce to text + body-only links
 *   4. Mask PII, classify with Claude Haiku (existing classifier)
 *   5. Parse Google Forms, upsert food events (source_type = "portal")
 *   6. Record the site's classified URLs in crawled_notices in one write
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
  extractAllLinks,
  type NoticeSite,
  type NoticeLink,
} from "./notice-crawler";
import { maskForLLM } from "./privacy-filter";
import type { FetchedEmail } from "./imap-fetcher";
import {
  classifyEmail,
  usageLogs,
  getTotalUsage,
  type ClassifiedEvent,
} from "./llm-classifier";
import { parseAndMapForm, extractFormId, type FormMapping } from "./form-parser";
import { upsertEvent, saveLLMUsageLogs } from "./db-upserter";

const MAX_LINKS_PER_SITE = 30;
/** Body links handed to the LLM per notice, after chrome links are removed. */
const MAX_URLS_PER_NOTICE = 10;
/** Notice text budget; leaves room for the link block inside the classifier's 8000-char cap. */
const MAX_BODY_CHARS = 6000;
const CLASSIFY_CONCURRENCY = 5;
/** Crawled events dedup on containment / exact title only, unlike mail (0.7). */
const CRAWL_FUZZY_THRESHOLD = 0.9;

const USAGE = `Usage: npx tsx crawl.ts [--dry-run] [--site=<dept substring>]`;

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

interface NoticeRow {
  url: string;
  dept: string;
  title: string;
  is_food_event: boolean;
  event_id: string | null;
}

type Classification =
  | { ok: true; value: ClassifiedEvent }
  | { ok: false; error: Error };

interface Summary {
  sitesOk: number;
  failedSites: string[];
  links: number;
  fresh: number;
  fetched: number;
  classifyFailed: number;
  foodEvents: number;
  added: number;
  updated: number;
  skipped: number;
  recordFailed: number;
}

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let site: string | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--site=")) {
      const value = arg.slice("--site=".length).trim();
      if (!value) {
        console.error("--site= requires a value.");
        console.error(USAGE);
        process.exit(1);
      }
      site = value;
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error(USAGE);
      process.exit(1);
    }
  }

  return { dryRun, site };
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

/** Google Form parses are shared across sites (a form can be posted twice). */
const formCache = new Map<string, { formId: string | null; mapping: FormMapping }>();

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

/** Write one site's rows in a single upsert. Returns how many rows failed. */
async function recordNotices(rows: NoticeRow[]): Promise<number> {
  const supabase = getSupabase();
  if (!supabase || rows.length === 0) return 0;
  const { error } = await supabase
    .from("crawled_notices")
    .upsert(rows, { onConflict: "url" });
  if (error) {
    console.warn(`[crawl] Failed to record ${rows.length} notice(s): ${error.message}`);
    return rows.length;
  }
  return 0;
}

/**
 * Drop the list page's navigation links from a notice's URLs, float the
 * Google Form links to the front, and cap the rest.
 */
function selectNoticeUrls(urls: string[], chromeUrls: Set<string>): string[] {
  const isForm = (u: string) =>
    u.includes("forms.gle") || u.includes("docs.google.com/forms");
  const kept = urls.filter((u) => !chromeUrls.has(u));
  return [...kept.filter(isForm), ...kept.filter((u) => !isForm(u))].slice(
    0,
    MAX_URLS_PER_NOTICE,
  );
}

/** Masked subject + body (notice text plus its link block) for the classifier. */
function buildLlmBody(notice: FetchedNotice): { subject: string; body: string } {
  const linkBlock = notice.urls.length
    ? "\n\n[본문에 포함된 링크들]\n" + notice.urls.join("\n")
    : "";
  const pseudoEmail: FetchedEmail = {
    uid: 0,
    subject: `[${notice.site.dept}] ${notice.link.title}`,
    from: notice.site.dept,
    to: [],
    date: null,
    body: notice.text.slice(0, MAX_BODY_CHARS) + linkBlock,
    html: null,
  };
  return maskForLLM(pseudoEmail);
}

/**
 * Classify notices with a small worker pool. A notice whose call throws is
 * returned as { ok: false } so the caller can leave it unrecorded and retry
 * it on the next run instead of marking it seen forever.
 */
async function classifyWithPool(
  notices: FetchedNotice[],
  concurrency = CLASSIFY_CONCURRENCY,
): Promise<Classification[]> {
  const results: Classification[] = new Array(notices.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < notices.length) {
      const idx = nextIndex++;
      const notice = notices[idx];
      const { subject, body } = buildLlmBody(notice);
      try {
        results[idx] = { ok: true, value: await classifyEmail(subject, body) };
      } catch (err) {
        console.warn(
          `[crawl]   classify failed, will retry next run: [${notice.site.dept}] ${notice.link.title} — ${(err as Error).message}`,
        );
        results[idx] = { ok: false, error: err as Error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, notices.length) }, () => worker()),
  );
  return results;
}

/** Parse every Google Form referenced by the food events, caching by form id. */
async function cacheForms(events: ClassifiedEvent[]): Promise<void> {
  for (const event of events) {
    const url = event.register_url;
    if (!url) continue;
    if (!url.includes("google.com/forms") && !url.includes("forms.gle")) continue;
    const key = extractFormId(url) || url;
    if (formCache.has(key)) continue;
    try {
      const result = await parseAndMapForm(url);
      formCache.set(result.formId || key, result);
      console.log(`[crawl]   parsed form: ${url} -> ${Object.keys(result.mapping).length} fields`);
    } catch (err) {
      console.warn(`[crawl]   form parse failed for ${url}: ${(err as Error).message}`);
    }
  }
}

/**
 * One site, end to end. Anything site-local (list fetch failure, empty
 * selector, broken detail links) is logged and the run continues; a
 * filterUnseen failure is a DB failure and propagates to abort the run.
 */
async function processSite(site: NoticeSite, args: Args, summary: Summary): Promise<void> {
  let listHtml: string;
  let links: NoticeLink[];
  try {
    listHtml = await fetchHtml(site.listUrl);
    links = extractNoticeLinks(listHtml, site).slice(0, MAX_LINKS_PER_SITE);
  } catch (err) {
    console.warn(`[crawl] ${site.dept}: list fetch failed — ${(err as Error).message}`);
    summary.failedSites.push(site.dept);
    return;
  }
  if (links.length === 0) {
    console.warn(`[crawl] ${site.dept}: 0 links (selector broken?) — ${site.listUrl}`);
    summary.failedSites.push(site.dept);
    return;
  }
  summary.sitesOk++;
  summary.links += links.length;

  const chromeUrls = new Set(extractAllLinks(listHtml, site.listUrl));
  const unseenUrls = new Set(await filterUnseen(links.map((l) => l.url)));
  const fresh = links.filter((l) => unseenUrls.has(l.url));
  summary.fresh += fresh.length;
  console.log(`[crawl] ${site.dept}: links=${links.length} new=${fresh.length}`);

  // ---- Step 3: detail pages -------------------------------------------
  const notices: FetchedNotice[] = [];
  const rows: NoticeRow[] = [];
  for (const link of fresh) {
    try {
      const html = await fetchHtml(link.url);
      const { text, urls } = extractNoticeText(html, link.url);
      const notice = { site, link, text, urls: selectNoticeUrls(urls, chromeUrls) };
      notices.push(notice);
      if (args.dryRun) {
        console.log(`    ${link.title} | text=${text.length} urls=${notice.urls.length}`);
      }
    } catch (err) {
      const message = (err as Error).message;
      if (message.startsWith("HTTP 4")) {
        // Permanently broken link: record it so it stops retrying every 6 h.
        console.warn(
          `[crawl]   dead detail link${args.dryRun ? "" : ", recording as seen"}: ${link.url} — ${message}`,
        );
        rows.push({
          url: link.url,
          dept: site.dept,
          title: link.title,
          is_food_event: false,
          event_id: null,
        });
      } else {
        console.warn(`[crawl]   detail fetch failed, will retry next run: ${link.url} — ${message}`);
      }
    }
  }
  summary.fetched += notices.length;
  if (args.dryRun) return;

  // ---- Step 4: classify ------------------------------------------------
  const classifications = await classifyWithPool(notices);
  const foodEvents: Array<{ notice: FetchedNotice; classification: ClassifiedEvent }> = [];
  for (let i = 0; i < notices.length; i++) {
    const result = classifications[i];
    if (!result.ok) {
      summary.classifyFailed++;
      continue;
    }
    if (result.value.is_food_event) {
      foodEvents.push({ notice: notices[i], classification: result.value });
      console.log(`[crawl]   food event: "${result.value.title}" (${result.value.food_type})`);
    } else {
      console.log(`[crawl]   not food: "${notices[i].link.title}"`);
    }
  }
  summary.foodEvents += foodEvents.length;

  // ---- Step 5: forms + upsert -----------------------------------------
  await cacheForms(foodEvents.map((f) => f.classification));

  const eventIdByUrl = new Map<string, string | null>();
  for (const { notice, classification } of foodEvents) {
    const url = classification.register_url;
    const formId = url ? extractFormId(url) : null;
    const formData = formId ? formCache.get(formId) : url ? formCache.get(url) : null;
    try {
      const result = await upsertEvent(
        classification,
        "portal",
        formData?.formId,
        formData?.mapping,
        CRAWL_FUZZY_THRESHOLD,
      );
      eventIdByUrl.set(notice.link.url, result.eventId ?? null);
      if (result.action === "added") summary.added++;
      else if (result.action === "updated") summary.updated++;
      else summary.skipped++;
    } catch (err) {
      console.error(`[crawl]   upsert failed for "${classification.title}": ${(err as Error).message}`);
      eventIdByUrl.set(notice.link.url, null);
    }
  }

  // ---- Step 6: record (one write per site) ----------------------------
  for (let i = 0; i < notices.length; i++) {
    const result = classifications[i];
    if (!result.ok) continue; // retry next run
    rows.push({
      url: notices[i].link.url,
      dept: notices[i].site.dept,
      title: notices[i].link.title,
      is_food_event: Boolean(result.value.is_food_event),
      event_id: eventIdByUrl.get(notices[i].link.url) ?? null,
    });
  }
  summary.recordFailed += await recordNotices(rows);
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
  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY required for a full run.");
    process.exit(1);
  }

  const summary: Summary = {
    sitesOk: 0,
    failedSites: [],
    links: 0,
    fresh: 0,
    fetched: 0,
    classifyFailed: 0,
    foodEvents: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    recordFailed: 0,
  };

  for (const site of sites) {
    await processSite(site, args, summary);
  }

  if (summary.sitesOk === 0) {
    console.error("Every site failed. Exiting with error.");
    process.exit(1);
  }

  const failedList = summary.failedSites.length
    ? `${summary.failedSites.length} (${summary.failedSites.join(", ")})`
    : "none";

  if (args.dryRun) {
    console.log(
      `\n=== Dry run complete: sites ok=${summary.sitesOk} failed=${summary.failedSites.length} links=${summary.links} new=${summary.fresh} fetched=${summary.fetched}`,
    );
    console.log(`  Sites failed:    ${failedList}`);
    return;
  }

  await saveLLMUsageLogs(usageLogs);
  const totalUsage = getTotalUsage();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Crawl complete ===");
  console.log(`  Sites ok:        ${summary.sitesOk}`);
  console.log(`  Sites failed:    ${failedList}`);
  console.log(`  Links seen:      ${summary.links}`);
  console.log(`  New notices:     ${summary.fetched}`);
  console.log(`  Classify failed: ${summary.classifyFailed}`);
  console.log(`  Food events:     ${summary.foodEvents}`);
  console.log(`  DB added:        ${summary.added}`);
  console.log(`  DB updated:      ${summary.updated}`);
  console.log(`  DB skipped:      ${summary.skipped}`);
  console.log(`  Record failed:   ${summary.recordFailed}`);
  console.log(`  LLM calls:       ${totalUsage.calls}`);
  console.log(`  LLM cost:        $${totalUsage.cost_usd.toFixed(4)}`);
  console.log(`  Elapsed:         ${elapsed}s`);
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
