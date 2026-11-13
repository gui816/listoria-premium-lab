import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202611130003_bulk_inventory_add.sql", import.meta.url), "utf8");

test("captured inventory products are inserted in one transactional batch", () => {
  assert.match(migration, /create or replace function public\.add_family_inventory_items/);
  assert.match(migration, /jsonb_array_elements\(p_items\)/);
  assert.match(migration, /perform public\.add_family_inventory_item/);
  assert.match(migration, /return public\.family_list_payload\(v_list_id\)/);
  assert.match(migration, /jsonb_array_length\(p_items\) > 60/);
});

test("batch inventory RPC is executable by list-sharing roles only", () => {
  assert.match(migration, /revoke all on function public\.add_family_inventory_items\(text, jsonb\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.add_family_inventory_items\(text, jsonb\) to anon, authenticated/);
});
