import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/components/InventoryArea.jsx", import.meta.url), "utf8");

test("home voice capture provides a clear fallback when speech recognition is unavailable", () => {
  const start = source.indexOf("function startVoiceCapture()");
  const supportCheck = source.indexOf("const SpeechRecognition", start);
  assert.ok(start >= 0 && supportCheck > start);
  assert.match(source, /O reconhecimento de voz não é suportado neste navegador/);
  assert.match(source, /microfone do teclado/);
  assert.match(source, /recognition\.onstart = \(\) =>/);
  assert.match(source, /setVoiceModalOpen\(true\)/);
});

test("home voice capture uses a single final result and keeps processing feedback visible", () => {
  assert.match(source, /recognition\.continuous = false/);
  assert.match(source, /recognition\.interimResults = false/);
  assert.match(source, /recognition\.maxAlternatives = 1/);
  assert.match(source, /recognition\.onresult = async event =>/);
  assert.match(source, /await extractCapturedItems\(\{ text: transcript/);
  assert.match(source, /recognition\.onend = \(\) =>/);
  assert.match(source, /recognitionRef\.current\?\.stop\(\)/);
  assert.match(source, /setVoiceModalOpen\(true\)/);
});

test("home photo capture supports multiple compressed images and visible progress", () => {
  assert.match(source, /multiple onChange=\{event => \{ void processCapturePhotos/);
  assert.match(source, /function prepareCapturePhoto\(/);
  assert.match(source, /1800 \/ Math\.max\(bitmap\.width, bitmap\.height\)/);
  assert.match(source, /files\.slice\(0, 3\)/);
  assert.match(source, /inventory-capture-status/);
});
