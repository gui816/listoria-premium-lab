import test from "node:test";
import assert from "node:assert/strict";
import { buildReceiptSummary } from "../src/lib/receipt-summary.js";

test("receipt summary calculates total, current month, average and top store", () => {
  const now = new Date(2026, 10, 13, 12);
  const summary = buildReceiptSummary([
    { storeName: "Continente", purchasedAt: "2026-11-02", total: 40 },
    { storeName: "Continente", purchasedAt: "2026-11-08", total: 20 },
    { storeName: "Lidl", purchasedAt: "2026-10-20", total: 30 },
  ], "pt-PT", now);
  assert.equal(summary.total, 90);
  assert.equal(summary.currentMonth, 60);
  assert.equal(summary.average, 30);
  assert.equal(summary.count, 3);
  assert.deepEqual(summary.topStore, ["Continente", 60]);
  assert.equal(summary.monthly.length, 6);
});

test("receipt summary handles empty data and invalid dates safely", () => {
  const summary = buildReceiptSummary([{ storeName: "Loja", purchasedAt: "invalid", total: 12 }], "en", new Date(2026, 10, 13));
  assert.equal(summary.total, 12);
  assert.equal(summary.currentMonth, 0);
  assert.equal(summary.monthly.length, 6);
});
