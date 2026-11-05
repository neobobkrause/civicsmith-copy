// acquisition-archives was split by copy from acquisition (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 22 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/acquisition-archives.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('acquisition-archives holds R38, R39, R40, R41, R45, R48, R107, R113, R114, R121, R122, R125, R126, R127, R128, R129, R132, R133, R135, R136, R138 and R139, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R107', 'R113', 'R114', 'R121', 'R122', 'R125', 'R126', 'R127', 'R128', 'R129', 'R132', 'R133', 'R135', 'R136', 'R138', 'R139', 'R38', 'R39', 'R40', 'R41', 'R45', 'R48']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
