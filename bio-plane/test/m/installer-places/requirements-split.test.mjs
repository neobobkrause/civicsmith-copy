// installer-places was split by copy from installer (5 Nov 2026, the 70000 cap; coordinator standing rule).
// The requirements it holds are the 7 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/installer-places.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('installer-places holds R21, R83, R94, R95, R96, R97 and R98, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R21', 'R83', 'R94', 'R95', 'R96', 'R97', 'R98']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
