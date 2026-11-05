// control-plane-door-pages was split by copy from control-plane (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 11 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/control-plane-door-pages.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('control-plane-door-pages holds R75, R81, R82, R95, R99, R104, R109, R116, R122, R126 and R127, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R104', 'R109', 'R116', 'R122', 'R126', 'R127', 'R75', 'R81', 'R82', 'R95', 'R99']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
