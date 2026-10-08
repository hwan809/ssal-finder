/**
 * Tests for normalizeClassification.
 * Run: npx tsx --test test-llm-classifier.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClassification } from "./llm-classifier";

test("not an event stays not an event", () => {
  assert.deepEqual(normalizeClassification({ is_event: false }), {
    is_event: false,
    is_food_event: false,
  });
});

test("garbage input is not an event", () => {
  assert.equal(normalizeClassification(null).is_event, false);
  assert.equal(normalizeClassification("hi").is_event, false);
});

test("legacy food-only shape implies is_event", () => {
  const r = normalizeClassification({ is_food_event: true, title: "x", food_type: "버거" });
  assert.equal(r.is_event, true);
  assert.equal(r.is_food_event, true);
  assert.equal(r.food_type, "버거");
  assert.equal(r.category, "기타");
});

test("non-food event drops food fields and keeps a valid category", () => {
  const r = normalizeClassification({
    is_event: true,
    is_food_event: false,
    category: "대회",
    title: "ML 해커톤",
    food_type: "기타",
    food_note: "없음",
  });
  assert.equal(r.is_food_event, false);
  assert.equal(r.category, "대회");
  assert.equal(r.food_type, undefined);
  assert.equal(r.food_note, null);
});

test("unknown category falls back to 기타", () => {
  assert.equal(normalizeClassification({ is_event: true, category: "파티" }).category, "기타");
});

test("string 'true' from the model is not trusted as food", () => {
  // the prompt describes is_food_event in prose; only a real boolean counts
  assert.equal(normalizeClassification({ is_event: true, is_food_event: "true" }).is_food_event, false);
});
