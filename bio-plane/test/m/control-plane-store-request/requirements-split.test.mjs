// control-plane-store-request was split by copy from control-plane (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 5 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/control-plane-store-request.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('control-plane-store-request holds R29, R64, R136, R137 and R138, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R136', 'R137', 'R138', 'R29', 'R64']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
