import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/InventoryArea.jsx", import.meta.url), "utf8");

test("voice opens feedback modal before checking browser support", () => {
  const start = source.indexOf("function startVoiceCapture()");
  const modalOpen = source.indexOf("setVoiceModalOpen(true)", start);
  const supportCheck = source.indexOf("const SpeechRecognition", start);
  assert.ok(start >= 0 && modalOpen > start && supportCheck > modalOpen);
  assert.match(source, /Voz indisponível/);
});

test("voice capture ends manually or after three seconds of silence", () => {
  assert.match(source, /recognition\.continuous = true/);
  assert.match(source, /recognition\.interimResults = true/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /\}, 3000\)/);
  assert.match(source, /function stopVoiceCapture\(\)/);
  assert.match(source, /Terminar gravação/);
});

test("home photo capture supports multiple compressed images and visible progress", () => {
  assert.match(source, /multiple onChange=\{event => \{ void processCapturePhotos/);
  assert.match(source, /function prepareCapturePhoto\(/);
  assert.match(source, /1800 \/ Math\.max\(bitmap\.width, bitmap\.height\)/);
  assert.match(source, /files\.slice\(0, 3\)/);
  assert.match(source, /inventory-capture-status/);
});
