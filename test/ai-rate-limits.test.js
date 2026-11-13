import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202611130002_ai_rate_limits.sql", import.meta.url), "utf8");

test("AI rate limits are isolated per user and feature", () => {
  assert.match(migration, /primary key \(user_id, feature_key\)/);
  assert.match(migration, /on conflict \(user_id, feature_key\) do nothing/);
  assert.match(migration, /where user_id = p_user_id and feature_key = v_feature for update/);
});

test("AI rate limit RPC is server-only and has bounded parameters", () => {
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /greatest\(1, least\(coalesce\(p_limit, 10\), 120\)\)/);
  assert.match(migration, /grant execute on function public\.consume_ai_rate_limit\(uuid, text, integer, integer\) to service_role/);
});
