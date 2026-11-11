import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202611110001_household_inventory.sql", import.meta.url), "utf8");

test("household inventory is scoped to an existing family list", () => {
  assert.match(migration, /list_id uuid not null references public\.family_lists\(id\) on delete cascade/);
  assert.match(migration, /unique \(list_id, normalized_name\)/);
});

test("inventory exposes the required read and write RPCs", () => {
  for (const functionName of [
    "get_family_inventory",
    "add_family_inventory_item",
    "update_family_inventory_item",
    "delete_family_inventory_item",
    "record_inventory_restock_request"
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}\\b`));
  }
});

test("inventory tables are protected by RLS and do not grant direct table access", () => {
  assert.match(migration, /alter table public\.family_inventory_items enable row level security/);
  assert.match(migration, /alter table public\.family_inventory_movements enable row level security/);
  assert.match(migration, /revoke all on public\.family_inventory_items from anon, authenticated/);
  assert.match(migration, /revoke all on public\.family_inventory_movements from anon, authenticated/);
});

test("inventory quantity and storage values are constrained", () => {
  assert.match(migration, /quantity between 0 and 999/);
  assert.match(migration, /storage_location in \('frigorifico','congelador','despensa','outro'\)/);
});
