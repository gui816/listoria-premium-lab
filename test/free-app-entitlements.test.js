import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const [basketUi, appUi, estimate, estimateV2] = await Promise.all([
  read("../src/components/BasketEstimate.jsx"),
  read("../src/App.jsx"),
  read("../supabase/functions/listora-basket-estimate/index.ts"),
  read("../supabase/functions/listora-basket-estimate-v2/index.ts"),
]);

test("all users can access basket comparison without subscription or free-trial gates", () => {
  for (const source of [basketUi, appUi, estimate, estimateV2]) {
    assert.doesNotMatch(source, /premium_required|freeTrialUsed|consume_free_comparison_trial|premium-status/);
    assert.doesNotMatch(source, /Subscreve o Listoria Premium|LISTORIA PREMIUM|1,99/);
  }
  assert.match(basketUi, /listora-basket-estimate-v2/);
});

test("comparison endpoints retain technical rate limiting, not monthly quotas", () => {
  for (const source of [estimate, estimateV2]) {
    assert.match(source, /consume_ai_rate_limit/);
    assert.match(source, /rate_limited/);
    assert.doesNotMatch(source, /premium_comparison_trials|subscriptions/);
  }
});

test("AI extraction and recipe endpoints authenticate users and apply per-feature rate limits", async () => {
  const endpoints = [
    ["../supabase/functions/listora-list-extract/index.ts", "list_extract"],
    ["../supabase/functions/listora-receipt-extract/index.ts", "receipt_extract"],
    ["../supabase/functions/listora-recipe-assistant/index.ts", "recipe_assistant"],
  ];
  for (const [path, feature] of endpoints) {
    const source = await read(path);
    assert.match(source, /auth\/v1\/user/);
    assert.match(source, /consume_ai_rate_limit/);
    assert.ok(source.includes("p_feature_key: \"" + feature + "\""));
  }
});
