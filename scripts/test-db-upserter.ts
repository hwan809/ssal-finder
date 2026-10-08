/**
 * Tests for the upserter's title matching.
 * Run: npx tsx --test test-db-upserter.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { titleSimilarity } from "./db-upserter";

test("titleSimilarity: parenthesized subtitle differences still match", () => {
  assert.equal(
    titleSimilarity(
      "2026 KAIST Model UN STI Summit (KAI-MUN)",
      "2026 KAIST Model UN STI Summit (KAIST 모의유엔 과학기술혁신 정상회의)",
    ),
    1,
  );
});

test("titleSimilarity: bracket tags and re-announcement prefixes are ignored", () => {
  assert.equal(titleSimilarity("[재안내] 망한과제 자랑대회", "망한과제 자랑대회"), 1);
});

test("titleSimilarity: unrelated titles stay below the 0.7 threshold", () => {
  assert.ok(titleSimilarity("ML 해커톤", "맥킨지 채용설명회") < 0.7);
});
