# KAIST 학과 공지사항 크롤러 — Design

Date: 2026-09-11

## Goal

Crawl the public notice boards of every KAIST department every 6 hours, classify
new notices with the existing Haiku food-event classifier, and upsert food events
into the `events` table. Runs alongside the existing Dooray/IMAP collection job
in the same GitHub Actions workflow.

## Non-goals

- JS-rendered sites (all probed department boards are server-rendered).
- Re-classifying notices already seen.
- Frontend changes. Events use the existing `source_type = "portal"` value.
- Pagination. Only the first page of each board is read per run; at 6-hour
  intervals this covers every new post on every board probed.

## Architecture

```
sites.ts ──► crawl.ts ──► notice-crawler.ts (fetch list, extract links, fetch body → text)
                │
                ├──► crawled_notices (Supabase) : skip URLs already processed
                ├──► privacy-filter.maskForLLM : strip phones/emails (existing)
                ├──► llm-classifier.classifyEmails : Haiku (existing)
                ├──► form-parser.parseAndMapForm : Google Forms (existing)
                └──► db-upserter.upsertEvent(…, "portal") : events + update_logs (existing)
```

### `scripts/sites.ts`

Exports `SITES: NoticeSite[]`:

```ts
export interface NoticeSite {
  dept: string;        // human label, e.g. "전산학부"
  listUrl: string;     // absolute URL of the board's first page
  linkPattern: RegExp; // tested against the resolved absolute href
}
```

One entry per KAIST department that has a public Korean notice/news board.
Departments whose site is down or has no board are omitted with a comment.
Prefer the general 공지사항 board; if a department has only a news board, use
that.

### `scripts/notice-crawler.ts`

Pure functions, no DB access, no LLM. Uses `cheerio` (new dependency).

- `fetchHtml(url, timeoutMs = 15000): Promise<string>` — `fetch` with a
  desktop User-Agent and `AbortController` timeout. Throws on non-2xx.
- `extractNoticeLinks(html, site): NoticeLink[]` — parse anchors, resolve
  `href` against `site.listUrl`, keep those matching `site.linkPattern`, dedupe
  by URL, return `{ url, title }` where `title` is the anchor's trimmed text.
  Anchors with empty text are dropped. Order preserved as on the page.
- `extractNoticeText(html): { text: string; urls: string[] }` — remove
  `script, style, noscript, nav, header, footer, iframe`, then pick the element
  with the most text among `article, main, .board-view, .view, #content,
  .content, body` (first match with ≥ 200 chars, else `body`). Collapse
  whitespace. `urls` = all absolute `http(s)` hrefs inside the chosen element
  plus URLs found by regex in the text, deduped.

### `scripts/crawl.ts`

Entry point, `npx tsx crawl.ts [--dry-run] [--site=<dept>]`.

Per site, in sequence:

1. `fetchHtml(listUrl)` → `extractNoticeLinks`. On error or zero links: log
   `[crawl] <dept>: <reason>` and continue to the next site.
2. Cap at 30 links per site per run.
3. Query `crawled_notices` for these URLs; drop those present.
4. For each new link: `fetchHtml(url)` → `extractNoticeText`. On error: log and
   skip (URL is **not** recorded, so it retries next run).
5. Build `{ subject: title, body: text + "\n\n[본문에 포함된 링크들]\n" + urls }`,
   run `maskForLLM`, then `classifyEmails` (concurrency 5).
6. For food events: Google Forms parse (same rule as collect.ts), then
   `upsertEvent(classification, "portal", formId, mapping)`.
7. Insert one `crawled_notices` row per classified notice:
   `{ url, dept, title, is_food_event, event_id }`. `event_id` is the upsert
   result's id when available.

After all sites: `saveLLMUsageLogs`, print summary (sites ok/failed, links
seen, new, food events, added/updated/skipped, LLM cost, elapsed).

`--dry-run`: steps 1–4 only, then print per-site `links=N new=M` and for each
new link `title`, `text.length`, `urls.length`. No LLM, no DB writes (the
`crawled_notices` read in step 3 still runs if credentials are present;
otherwise treat all links as new).

`--site=<dept>`: restrict to sites whose `dept` includes the string.

Exit code is 0 even if some sites failed; exit 1 only if **every** site failed
or the DB is unreachable.

## Database

`supabase/migrations/006_create_crawled_notices.sql`:

```sql
create table if not exists crawled_notices (
  url text primary key,
  dept text not null,
  title text,
  is_food_event boolean,
  event_id uuid references events(id) on delete set null,
  crawled_at timestamptz default now()
);
create index if not exists idx_crawled_notices_dept on crawled_notices(dept);
alter table crawled_notices enable row level security;
-- no anon policy: service role only
```

Also appended to `full_migration.sql`.

## Scheduling

`.github/workflows/collect.yml` gains a second job `crawl` with the same
`schedule` and `workflow_dispatch` triggers. It does not `needs:` the
`collect` job. Steps: checkout, setup-node 22, `npm ci` in `scripts/`,
`npx tsx crawl.ts`. Env: `ANTHROPIC_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`. `timeout-minutes: 20`.

## Error handling summary

| Failure | Behaviour |
|---|---|
| List page fetch error / timeout | log dept, skip site |
| Zero links extracted | log dept as "0 links (selector broken?)", skip site |
| Detail page fetch error | log URL, skip notice, not recorded → retried next run |
| LLM error for a notice | existing `classifyEmails` returns `is_food_event:false`; notice **is** recorded to avoid repeated cost |
| `upsertEvent` throws | log, notice recorded with `event_id = null`, `is_food_event = true` |
| `crawled_notices` insert error | log warn, continue |

## Testing

- `scripts/test-notice-crawler.ts` using `node:test` + `node:assert`. Fixtures
  in `scripts/fixtures/<dept>.html` saved from 4 real boards with different
  CMSs (cs, ee, physics, chem) plus one detail page each. Asserts link count
  ≥ expected, first link URL/title, and that `extractNoticeText` returns
  ≥ 200 chars with no `<script` content.
- Manual validation: `npx tsx crawl.ts --dry-run` across all sites before the
  first commit of `sites.ts`; every entry must produce ≥ 1 link, or be removed
  with a comment explaining why.
- `npm run typecheck` in `scripts/`.

## Dependencies

`scripts/package.json`: add `cheerio` (runtime). No other new packages.
