/**
 * sites.ts — KAIST department notice boards to crawl.
 *
 * One entry per department. listUrl is the board's first page; linkPattern
 * is tested against each anchor's resolved absolute href. Boards whose anchors
 * are javascript:/onclick only use jsLink to rebuild the detail URL from the id.
 *
 * Verified 2026-09-11. To add a department: find its 공지 board, confirm the
 * detail links are plain GETs, add an entry, run `npx tsx crawl.ts --dry-run --site=<dept>`.
 */

import type { NoticeSite } from "./notice-crawler";

/** Helper for the "boards/lists/<board>" CMS used by ae, cee, hss, ct, gsmse, cbe, bim */
function boardsCms(dept: string, host: string, board: string): NoticeSite {
  return {
    dept,
    listUrl: `https://${host}/boards/lists/${board}`,
    linkPattern: new RegExp(`^https://${host.replace(/\./g, "\\.")}/boards/chk_view/${board}/\\d+`),
  };
}

/** Helper for the "<path>/view/id/<n>" CMS used by chem, bcs, ise, stp, gggs, aisemi, gsds, semicon, gssa, quantum */
function viewIdCms(dept: string, host: string, path: string): NoticeSite {
  return {
    dept,
    listUrl: `https://${host}/${path}`,
    linkPattern: new RegExp(`^https://${host.replace(/\./g, "\\.")}/${path}/view/id/\\d+`),
  };
}

/** Helper for XE boards (index.php?mid=<mid>&document_srl=<n>) used by physics, bioeng, mse */
function xeCms(dept: string, host: string, mid: string): NoticeSite {
  return {
    dept,
    listUrl: `https://${host}/index.php?mid=${mid}`,
    linkPattern: new RegExp(`^https://${host.replace(/\./g, "\\.")}/index\\.php\\?mid=${mid}&document_srl=\\d+`),
  };
}

/** Helper for WordPress slug boards used by sse, gst, mo, ai4math */
function wpSlugCms(dept: string, host: string, path: string): NoticeSite {
  return {
    dept,
    listUrl: `https://${host}/${path}/`,
    linkPattern: new RegExp(`^https://${host.replace(/\./g, "\\.")}/${path}/(?!page/|feed/)[^/?#]+/$`),
  };
}

/** Helper for the doc/ko/selectDocList.do CMS (onclick fn_selectDoc) used by bio, btm, itm */
function selectDocCms(dept: string, host: string, menuSeq: number, bbsSeq: number): NoticeSite {
  return {
    dept,
    listUrl: `https://${host}/doc/ko/selectDocList.do?menuSeq=${menuSeq}&bbsSeq=${bbsSeq}`,
    linkPattern: new RegExp(`^https://${host.replace(/\./g, "\\.")}/doc/ko/selectDoc\\.do\\?docSeq=\\d+`),
    jsLink: {
      idPattern: /fn_selectDoc\(\s*'(\d+)'/,
      detailUrl: (id) => `https://${host}/doc/ko/selectDoc.do?docSeq=${id}&menuSeq=${menuSeq}&bbsSeq=${bbsSeq}`,
    },
  };
}

/** Helper for the /bbs/<board> CMS with javascript:readArticle used by cs, gsis */
function readArticleCms(dept: string, host: string, board: string): NoticeSite {
  // The board's onclick=readArticle(...) goes through an AJAX auth check that
  // 302s to /board/view?bbs_id=<board>&bbs_sn=<id>&page=1&skey=subject&svalue=&menu=<n>.
  // /bbs/<board>/<id> (a plausible-looking but wrong guess) returns a
  // "잘못된 접근입니다" error page. menu must be a non-empty number but its
  // value doesn't matter (verified against live cs/gsis boards 2026-09-11).
  return {
    dept,
    listUrl: `https://${host}/bbs/${board}`,
    linkPattern: new RegExp(
      `^https://${host.replace(/\./g, "\\.")}/board/view\\?bbs_id=${board}&bbs_sn=\\d+&page=1&skey=subject&svalue=&menu=1$`,
    ),
    jsLink: {
      idPattern: new RegExp(`readArticle\\(\\s*'${board}'\\s*,\\s*'(\\d+)'`),
      detailUrl: (id) =>
        `https://${host}/board/view?bbs_id=${board}&bbs_sn=${id}&page=1&skey=subject&svalue=&menu=1`,
    },
  };
}

export const SITES: NoticeSite[] = [
  // ---- 자연과학대학 ----
  xeCms("물리학과", "physics.kaist.ac.kr", "p_news_event1"),
  {
    dept: "수리과학과",
    listUrl: "https://mathsci.kaist.ac.kr/ko/xe/notice/",
    linkPattern: /^https:\/\/mathsci\.kaist\.ac\.kr\/ko\/xe\/notice\/\d+$/,
  },
  viewIdCms("화학과", "chem.kaist.ac.kr", "notice"),
  viewIdCms("양자대학원", "quantum.kaist.ac.kr", "notice"),
  wpSlugCms("AI수학대학원", "ai4math.kaist.ac.kr", "notice"),

  // ---- 생명과학기술대학 ----
  selectDocCms("생명과학과", "bio.kaist.ac.kr", 3363, 106),
  boardsCms("의과학대학원", "gsmse.kaist.ac.kr", "board_notice"),
  viewIdCms("뇌인지과학과", "bcs.kaist.ac.kr", "sub0601"),
  {
    dept: "줄기세포및재생생물학대학원",
    listUrl: "https://scrb.kaist.ac.kr/bbs/board.php?bo_table=sub5_2",
    linkPattern: /^https:\/\/scrb\.kaist\.ac\.kr\/bbs\/board\.php\?bo_table=sub5_2&wr_id=\d+/,
  },
  {
    dept: "공학생물학대학원",
    listUrl: "https://eb.kaist.ac.kr/bbs/board.php?bo_table=sub7_1",
    linkPattern: /^https:\/\/eb\.kaist\.ac\.kr\/bbs\/board\.php\?bo_table=sub7_1&wr_id=\d+/,
  },

  // ---- 공과대학 ----
  boardsCms("항공우주공학과", "ae.kaist.ac.kr", "board_notice"),
  {
    dept: "전기및전자공학부",
    listUrl: "https://ee.kaist.ac.kr/notice/",
    linkPattern: /^https:\/\/ee\.kaist\.ac\.kr\/notices\/[^/?#]+\/$/,
  },
  readArticleCms("전산학부", "cs.kaist.ac.kr", "notice"),
  boardsCms("건설및환경공학과", "cee.kaist.ac.kr", "notice"),
  xeCms("바이오및뇌공학과", "bioeng.kaist.ac.kr", "bio_06_01"),
  viewIdCms("산업및시스템공학과", "ise.kaist.ac.kr", "notices"),
  xeCms("신소재공학과", "mse.kaist.ac.kr", "mse_notice"),
  {
    dept: "원자력및양자공학과",
    listUrl: "https://nuclear.kaist.ac.kr/board/notice.php",
    linkPattern: /^https:\/\/nuclear\.kaist\.ac\.kr\/board\/notice_view\.php\?k_id=\d+/,
  },
  wpSlugCms("반도체시스템공학과", "sse.kaist.ac.kr", "notice"),
  readArticleCms("정보보호대학원", "gsis.kaist.ac.kr", "notice"),
  viewIdCms("인공지능반도체대학원", "aisemi.kaist.ac.kr", "notice"),
  viewIdCms("데이터사이언스대학원", "gsds.kaist.ac.kr", "news"),
  viewIdCms("반도체공학대학원", "semicon.kaist.ac.kr", "sub0601"),
  viewIdCms("시스템아키텍트대학원", "gssa.kaist.ac.kr", "notice"),
  wpSlugCms("조천식모빌리티대학원", "mo.kaist.ac.kr", "notice"),
  viewIdCms("녹색성장지속가능대학원", "gggs.kaist.ac.kr", "notice"),
  wpSlugCms("안보과학기술대학원", "gst.kaist.ac.kr", "board/notice"),

  // ---- 인문사회융합과학대학 ----
  boardsCms("디지털인문사회과학부", "hss.kaist.ac.kr", "notice"),
  boardsCms("문화기술대학원", "ct.kaist.ac.kr", "news_board"),
  viewIdCms("과학기술정책대학원", "stp.kaist.ac.kr", "notice"),
  {
    dept: "문술미래전략대학원",
    listUrl: "https://futures.kaist.ac.kr/ko/?c=192",
    linkPattern: /^https:\/\/futures\.kaist\.ac\.kr\/ko\/\?c=192&.*gbn=view&ix=\d+/,
  },

  // ---- 경영대학 ----
  {
    dept: "경영대학",
    listUrl: "https://www.business.kaist.ac.kr/_prog/_board/?code=kcbNotice&site_dvs_cd=kr&menu_dvs_cd=050201",
    linkPattern: /^https:\/\/www\.business\.kaist\.ac\.kr\/_prog\/_board\/\?mode=V&no=\d+&code=kcbNotice/,
  },
  {
    dept: "금융전문대학원",
    listUrl: "https://www.business.kaist.ac.kr/_prog/_board/?code=kgsfNotice&site_dvs_cd=kgsf&menu_dvs_cd=060201",
    linkPattern: /^https:\/\/www\.business\.kaist\.ac\.kr\/_prog\/_board\/\?mode=V&no=\d+&code=kgsfNotice/,
  },
  selectDocCms("기술경영학부", "btm.kaist.ac.kr", 3782, 140),
  selectDocCms("기술경영전문대학원", "itm.kaist.ac.kr", 3492, 23),
  boardsCms("바이오혁신경영전문대학원", "bim.kaist.ac.kr", "board_news"),

  // ---- 기타 ----
  {
    dept: "새내기과정학부",
    listUrl: "https://freshman.kaist.ac.kr/ko/board/news/list.do",
    linkPattern: /^https:\/\/freshman\.kaist\.ac\.kr\/ko\/board\/news\/view\.do\?docSeq=\d+/,
    jsLink: {
      idPattern: /javascript:view\(\s*'(\d+)'/,
      detailUrl: (id) => `https://freshman.kaist.ac.kr/ko/board/news/view.do?docSeq=${id}`,
    },
  },

  // Not crawled (verified 2026-09-11):
  // - 기계공학과 me.kaist.ac.kr (/news/news_010100.html, ?bmain=view&uid=N) and
  //   김재철AI대학원 gsai.kaist.ac.kr (/notice/, root-level slugs): both serve a
  //   JavaScript cookie challenge ("자동등록방지 ... prove that you are human",
  //   /cupid.js) to non-Korean IPs, so GitHub Actions runners get a 1 KB stub
  //   with 0 links. They work from a Korean IP; re-add if the crawler ever runs
  //   from one. Verified 2026-09-12 from ubuntu-latest.
  // - 산업디자인학과 id.kaist.ac.kr: React SPA, no server-rendered board.
  // - 융합인재학부 sts.kaist.ac.kr: board page has no post links.
  // - AI컴퓨팅학과 / AX학과 / AI시스템학과 / AI미래학과 (aicollege.kaist.ac.kr/<aic|ax|ais|fx>/notice):
  //   new departments with 0-1 posts; pattern is viewIdCms(dept, "aicollege.kaist.ac.kr", "<x>/notice") — add when they have posts.
  // - 사회적기업가MBA, 테크노경영MBA 등: covered by the 경영대학 board.
  // - 생명화학공학과 cbe.kaist.ac.kr: TLS cert expired (CERT_HAS_EXPIRED) as of
  //   2026-09-11 — not a sites.ts problem, re-add once the server's cert is renewed.
];
