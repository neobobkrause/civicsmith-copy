// member-upload was split by copy from capture (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 16 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/member-upload.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('member-upload holds R86, R92, R93, R103, R107, R108, R109, R110, R111, R113, R114, R116, R117, R118, R119 and R120, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R103', 'R107', 'R108', 'R109', 'R110', 'R111', 'R113', 'R114', 'R116', 'R117', 'R118', 'R119', 'R120', 'R86', 'R92', 'R93']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
