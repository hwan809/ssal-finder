/**
 * Notice crawler — pure HTML helpers for KAIST department notice boards.
 * No DB, no LLM. Uses cheerio for parsing.
 */

import * as cheerio from "cheerio";

export interface NoticeSite {
  /** Human label, e.g. "전산학부" */
  dept: string;
  /** Absolute URL of the board's first page */
  listUrl: string;
  /** Tested against the resolved absolute href of each anchor */
  linkPattern: RegExp;
}

export interface NoticeLink {
  url: string;
  title: string;
}

const USER_AGENT = "Mozilla/5.0 (compatible; ssal-finder-crawler)";

/**
 * Resolve an href against a base URL. Returns null for non-http(s) results
 * (javascript:, mailto:, #fragment-only, malformed).
 */
function resolveHref(href: string | undefined, base: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || /^(javascript|mailto|tel):/i.test(trimmed)) {
    return null;
  }
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Extract detail-page links from a board list page.
 * Keeps anchors whose resolved href matches site.linkPattern, in page order,
 * deduped by URL. The first anchor with non-empty text wins the title.
 */
export function extractNoticeLinks(html: string, site: NoticeSite): NoticeLink[] {
  const $ = cheerio.load(html);
  const seen = new Map<string, NoticeLink>();

  $("a[href]").each((_, el) => {
    const url = resolveHref($(el).attr("href"), site.listUrl);
    if (!url || !site.linkPattern.test(url)) return;
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!title) return;
    if (!seen.has(url)) seen.set(url, { url, title });
  });

  return [...seen.values()];
}
