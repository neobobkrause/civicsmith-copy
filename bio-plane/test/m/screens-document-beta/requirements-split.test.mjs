// screens-document-beta was split by copy from screens-document (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 18 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/screens-document-beta.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('screens-document-beta holds R58, R59, R60, R61, R62, R63, R64, R65, R66, R67, R68, R69, R70, R71, R72, R73, R74 and R75, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R58', 'R59', 'R60', 'R61', 'R62', 'R63', 'R64', 'R65', 'R66', 'R67', 'R68', 'R69', 'R70', 'R71', 'R72', 'R73', 'R74', 'R75']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
