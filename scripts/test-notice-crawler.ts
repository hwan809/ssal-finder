/**
 * Tests for notice-crawler.ts against saved HTML fixtures.
 * Run: npx tsx --test test-notice-crawler.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { extractNoticeLinks, type NoticeSite } from "./notice-crawler";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

const MATHSCI: NoticeSite = {
  dept: "수리과학과",
  listUrl: "https://mathsci.kaist.ac.kr/ko/xe/notice/",
  linkPattern: /^https:\/\/mathsci\.kaist\.ac\.kr\/ko\/xe\/notice\/\d+$/,
};

const PHYSICS: NoticeSite = {
  dept: "물리학과",
  listUrl: "https://physics.kaist.ac.kr/index.php?mid=p_news_event1",
  linkPattern: /document_srl=\d+/,
};

test("extractNoticeLinks: mathsci list yields absolute detail links with titles", () => {
  const links = extractNoticeLinks(fixture("mathsci-list.html"), MATHSCI);
  assert.ok(links.length >= 10, `expected >=10 links, got ${links.length}`);
  for (const l of links) {
    assert.match(l.url, MATHSCI.linkPattern);
    assert.ok(l.title.length > 0, `empty title for ${l.url}`);
  }
});

test("extractNoticeLinks: physics list resolves relative hrefs", () => {
  const links = extractNoticeLinks(fixture("physics-list.html"), PHYSICS);
  assert.ok(links.length >= 5, `expected >=5 links, got ${links.length}`);
  for (const l of links) {
    assert.ok(l.url.startsWith("https://physics.kaist.ac.kr/"), l.url);
  }
});

test("extractNoticeLinks: dedupes by url and drops empty-text anchors", () => {
  const html = `
    <a href="/ko/xe/notice/1">첫 번째 공지</a>
    <a href="/ko/xe/notice/1"><img src="x.png"></a>
    <a href="/ko/xe/notice/1">첫 번째 공지 (중복)</a>
    <a href="/ko/xe/notice/2">  두 번째  </a>
    <a href="/ko/xe/notice/?page=2">2</a>
    <a href="/ko/xe/news/3">다른 게시판</a>`;
  const links = extractNoticeLinks(html, MATHSCI);
  assert.deepEqual(links, [
    { url: "https://mathsci.kaist.ac.kr/ko/xe/notice/1", title: "첫 번째 공지" },
    { url: "https://mathsci.kaist.ac.kr/ko/xe/notice/2", title: "두 번째" },
  ]);
});
