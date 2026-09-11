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
  /**
   * For boards whose anchors are javascript:/onclick only.
   * idPattern (one capture group) is tested against `href + " " + onclick`;
   * the captured id is passed to detailUrl to build the absolute URL.
   */
  jsLink?: {
    idPattern: RegExp;
    detailUrl: (id: string) => string;
  };
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
    const u = new URL(trimmed.replace(/;jsessionid=[^?#]*/i, ""), base);
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

  $("a[href], a[onclick]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    let url = resolveHref(href, site.listUrl);

    if (!url && site.jsLink) {
      const onclick = $(el).attr("onclick") ?? "";
      const m = site.jsLink.idPattern.exec(`${href} ${onclick}`);
      if (m && m[1]) url = site.jsLink.detailUrl(m[1]);
    }

    if (!url || !site.linkPattern.test(url)) return;
    const title = $(el).text().replace(/\s+/g, " ").trim();
    if (!title) return;
    if (!seen.has(url)) seen.set(url, { url, title });
  });

  return [...seen.values()];
}

// NOTE: <form> is deliberately NOT stripped — many Korean board CMSs wrap the
// post body in a <form>, so stripping it throws the article away.
const STRIP_SELECTOR = "script, style, noscript, nav, header, footer, iframe";
const CONTENT_CANDIDATES = [
  "article",
  "main",
  ".board-view",
  ".board_view",
  ".view",
  ".bbs-view",
  "#content",
  ".content",
  "#container",
  "body",
];
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Every absolute http(s) link on a page, in document order, deduped.
 * Used to build the "site chrome" URL set from a board list page so that
 * navigation links can be subtracted from a detail page's URL list.
 */
export function extractAllLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $("a[href]").each((_, el) => {
    const u = resolveHref($(el).attr("href"), baseUrl);
    if (u) urls.add(u);
  });
  return [...urls];
}

/**
 * Reduce a detail page to plain text plus the absolute URLs it contains.
 * Strips chrome (nav/header/footer/scripts), then picks the first candidate
 * container with >= 200 chars of text; falls back to <body>.
 */
export function extractNoticeText(
  html: string,
  pageUrl: string,
): { text: string; urls: string[] } {
  const $ = cheerio.load(html);
  $(STRIP_SELECTOR).remove();

  let $root = $("body") as any;
  for (const sel of CONTENT_CANDIDATES) {
    const $el = $(sel).first();
    if ($el.length === 0) continue;
    const len = $el.text().replace(/\s+/g, " ").trim().length;
    if (len >= 200) {
      $root = $el;
      break;
    }
  }

  const text = $root.text().replace(/\s+/g, " ").trim();

  const urls = new Set<string>();
  $root.find("a[href]").each((_: number, el: any) => {
    const u = resolveHref($(el).attr("href"), pageUrl);
    if (u) urls.add(u);
  });
  for (const m of text.match(URL_REGEX) || []) {
    urls.add(m);
  }

  return { text, urls: [...urls] };
}

/**
 * Fetch a page as text with a timeout. Throws on non-2xx or timeout.
 */
export async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
