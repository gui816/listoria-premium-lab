import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202611130001_move_purchased_item_to_inventory.sql", import.meta.url), "utf8");

test("purchased items move to inventory through a single transactional RPC", () => {
  assert.match(migration, /create or replace function public\.move_purchased_item_to_inventory/);
  assert.match(migration, /perform public\.add_family_inventory_item/);
  assert.match(migration, /delete from public\.family_items/);
  assert.match(migration, /and i\.done = true/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("inventory transfer RPC grants execution only to list-sharing roles", () => {
  assert.match(migration, /revoke all on function public\.move_purchased_item_to_inventory\(text, uuid\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.move_purchased_item_to_inventory\(text, uuid\) to anon, authenticated/);
});
