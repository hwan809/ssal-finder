/**
 * Tests for notice-crawler.ts against saved HTML fixtures.
 * Run: npx tsx --test test-notice-crawler.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { extractNoticeLinks, type NoticeSite, extractNoticeText } from "./notice-crawler";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

const MATHSCI: NoticeSite = {
  dept: "수리과학과",
  listUrl: "https://mathsci.kaist.ac.kr/ko/xe/notice/",
  linkPattern: /^https:\/\/mathsci\.kaist\.ac\.kr\/ko\/xe\/notice\/\d+/,
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

test("extractNoticeText: mathsci detail returns substantial text without script content", () => {
  const { text, urls } = extractNoticeText(fixture("mathsci-detail.html"), "https://mathsci.kaist.ac.kr/ko/xe/notice/1");
  assert.ok(text.length >= 200, `text too short: ${text.length}`);
  assert.ok(!/<script|function\s*\(|document\.getElementById/.test(text), "script leaked into text");
  assert.ok(Array.isArray(urls));
});

test("extractNoticeText: physics detail returns substantial text", () => {
  const { text } = extractNoticeText(fixture("physics-detail.html"), "https://physics.kaist.ac.kr/index.php?mid=p_news_event1");
  assert.ok(text.length >= 200, `text too short: ${text.length}`);
});

test("extractNoticeText: picks the largest content block, collects absolute urls", () => {
  const html = `<html><body>
    <nav><a href="/menu">메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴 메뉴</a></nav>
    <div id="content">
      <h1>간식 나눔 행사 안내</h1>
      <p>${"본문 내용입니다. ".repeat(30)}</p>
      <p>신청: <a href="https://forms.gle/abc123">여기</a> 또는 https://example.com/x?y=1</p>
      <script>var evil = document.getElementById("x");</script>
    </div>
    <footer>${"푸터 ".repeat(50)}</footer>
  </body></html>`;
  const { text, urls } = extractNoticeText(html, "https://mathsci.kaist.ac.kr/ko/xe/notice/1");
  assert.ok(text.includes("간식 나눔 행사 안내"));
  assert.ok(!text.includes("메뉴 메뉴"), "nav leaked");
  assert.ok(!text.includes("푸터"), "footer leaked");
  assert.ok(!text.includes("evil"), "script leaked");
  assert.deepEqual(urls, ["https://forms.gle/abc123", "https://example.com/x?y=1"]);
});

const CS: NoticeSite = {
  dept: "전산학부",
  listUrl: "https://cs.kaist.ac.kr/bbs/notice",
  linkPattern: /^https:\/\/cs\.kaist\.ac\.kr\/bbs\/notice\/\d+$/,
  jsLink: {
    idPattern: /readArticle\(\s*'notice'\s*,\s*'(\d+)'/,
    detailUrl: (id) => `https://cs.kaist.ac.kr/bbs/notice/${id}`,
  },
};

const BIO: NoticeSite = {
  dept: "생명과학과",
  listUrl: "https://bio.kaist.ac.kr/doc/ko/selectDocList.do?menuSeq=3363&bbsSeq=106",
  linkPattern: /^https:\/\/bio\.kaist\.ac\.kr\/doc\/ko\/selectDoc\.do\?docSeq=\d+/,
  jsLink: {
    idPattern: /fn_selectDoc\(\s*'(\d+)'/,
    detailUrl: (id) => `https://bio.kaist.ac.kr/doc/ko/selectDoc.do?docSeq=${id}&menuSeq=3363&bbsSeq=106`,
  },
};

test("jsLink: cs readArticle hrefs become /bbs/notice/<id> links", () => {
  const links = extractNoticeLinks(fixture("cs-list.html"), CS);
  assert.ok(links.length >= 3, `expected >=3, got ${links.length}`);
  for (const l of links) {
    assert.match(l.url, CS.linkPattern);
    assert.ok(l.title.length > 0);
  }
});

test("jsLink: bio onclick fn_selectDoc becomes selectDoc.do links", () => {
  const links = extractNoticeLinks(fixture("bio-list.html"), BIO);
  assert.ok(links.length >= 3, `expected >=3, got ${links.length}`);
  for (const l of links) {
    assert.match(l.url, BIO.linkPattern);
    assert.ok(l.title.length > 0);
  }
});

test("jsLink: ignores anchors whose id pattern does not match; plain hrefs still work", () => {
  const html = `
    <a href="javascript:readArticle('notice', '10', '1', 'subject', '', '151')">공지 열</a>
    <a href="javascript:readArticle('etcnotice', '11', '1', 'subject', '', '288')">기타 공지</a>
    <a href="javascript:void(0)">닫기</a>
    <a href="/bbs/notice/12">직접 링크</a>`;
  const links = extractNoticeLinks(html, CS);
  assert.deepEqual(links, [
    { url: "https://cs.kaist.ac.kr/bbs/notice/10", title: "공지 열" },
    { url: "https://cs.kaist.ac.kr/bbs/notice/12", title: "직접 링크" },
  ]);
});

test("resolveHref strips ;jsessionid", () => {
  const html = `<a href="/ko/xe/notice/5;jsessionid=ABC123?x=1">세션 링크</a>`;
  const links = extractNoticeLinks(html, MATHSCI);
  assert.deepEqual(links, [{ url: "https://mathsci.kaist.ac.kr/ko/xe/notice/5?x=1", title: "세션 링크" }]);
});
