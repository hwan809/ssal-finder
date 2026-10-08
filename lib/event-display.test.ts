/** Run: scripts/node_modules/.bin/tsx --test lib/event-display.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eventIcon, eventsForMode, shareHeadline } from "./event-display";

test("eventIcon: food event uses food icon, legacy null food_type falls back", () => {
  assert.equal(eventIcon({ is_food: true, category: null, food_type: "버거" }), "🍔");
  assert.equal(eventIcon({ is_food: true, category: "세미나", food_type: null }), "🍴");
});

test("eventIcon: non-food event uses category icon", () => {
  assert.equal(eventIcon({ is_food: false, category: "대회", food_type: null }), "🏆");
  assert.equal(eventIcon({ is_food: false, category: null, food_type: null }), "📌");
});

test("shareHeadline: food vs non-food", () => {
  assert.equal(
    shareHeadline({ is_food: true, food_note: "피자", food_type: "식사", title: "x" }),
    "피자 쌀먹할 사람?",
  );
  assert.equal(
    shareHeadline({ is_food: false, food_note: null, food_type: null, title: "ML 해커톤" }),
    "ML 해커톤 같이 갈 사람?",
  );
});

test("eventsForMode: food mode drops non-food, all mode keeps everything", () => {
  const evts = [{ is_food: true }, { is_food: false }];
  assert.equal(eventsForMode(evts, "food").length, 1);
  assert.equal(eventsForMode(evts, "all").length, 2);
});

test("rows without is_food (pre-migration) count as food", () => {
  const legacy = [{} as { is_food: boolean }];
  assert.equal(eventsForMode(legacy, "food").length, 1);
});
