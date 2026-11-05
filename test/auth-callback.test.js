import test from "node:test";
import assert from "node:assert/strict";
import { completeAuthCallback } from "../src/lib/auth-callback.js";

function setup(href) {
  const location = { href };
  const history = { state: null, replaced: "", replaceState(_state, _title, url) { this.replaced = url; } };
  const values = new Map();
  const storage = { setItem(key, value) { values.set(key, value); }, getItem(key) { return values.get(key) || null; }, removeItem(key) { values.delete(key); }, has(key) { return values.has(key); }, get(key) { return values.get(key); } };
  return { location, history, storage };
}

test("exchanges a PKCE code once and preserves other query parameters", async () => {
  const env = setup("https://example.test/list?join=ABC&code=one-time-code");
  let calls = 0;
  const supabase = { auth: { async exchangeCodeForSession(code) { calls++; assert.equal(code, "one-time-code"); return { data: { session: { user: { id: "u1" } } }, error: null }; } } };
  const result = await completeAuthCallback({ supabase, ...env });
  assert.deepEqual(result, { handled: true, error: null });
  assert.equal(calls, 1);
  assert.equal(env.history.replaced, "/list?join=ABC");
  assert.equal(env.storage.has("listora-auth-callback-error"), false);
});

test("stores a PKCE exchange error for the account UI", async () => {
  const env = setup("https://example.test/?code=bad-code");
  const supabase = { auth: { async exchangeCodeForSession() { return { error: new Error("Invalid code verifier") }; } } };
  const result = await completeAuthCallback({ supabase, ...env });
  assert.equal(result.error, "Invalid code verifier");
  assert.equal(env.storage.get("listora-auth-callback-error"), "Invalid code verifier");
  assert.equal(env.history.replaced, "/");
});

test("restores legacy implicit token callbacks", async () => {
  const env = setup("https://example.test/#access_token=access&refresh_token=refresh&type=recovery");
  let received;
  const supabase = { auth: { async setSession(value) { received = value; return { data: { session: { user: { id: "u2" } } }, error: null }; } } };
  const result = await completeAuthCallback({ supabase, ...env });
  assert.equal(result.error, null);
  assert.deepEqual(received, { access_token: "access", refresh_token: "refresh" });
  assert.equal(env.history.replaced, "/");
});

test("does nothing when the URL has no auth callback", async () => {
  const env = setup("https://example.test/list?join=ABC");
  const result = await completeAuthCallback({ supabase: { auth: {} }, ...env });
  assert.deepEqual(result, { handled: false, error: null });
  assert.equal(env.history.replaced, "");
});

test("surfaces provider-denied callbacks and removes auth parameters", async () => {
  const env = setup("https://example.test/?error=access_denied&error_description=User+cancelled");
  const result = await completeAuthCallback({ supabase: { auth: {} }, ...env });
  assert.equal(result.handled, true);
  assert.equal(result.error, "User cancelled");
  assert.equal(env.storage.get("listora-auth-callback-error"), "User cancelled");
  assert.equal(env.history.replaced, "/");
});
