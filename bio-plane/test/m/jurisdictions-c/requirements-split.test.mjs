// jurisdictions-c was split by copy from jurisdictions (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 28 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/jurisdictions-c.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('jurisdictions-c holds R111, R112, R113, R114, R115, R116, R117, R118, R119, R120, R121, R123, R124, R125, R126, R127, R128, R129, R130, R131, R132, R133, R134, R135, R136, R137, R138 and R139, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R111', 'R112', 'R113', 'R114', 'R115', 'R116', 'R117', 'R118', 'R119', 'R120', 'R121', 'R123', 'R124', 'R125', 'R126', 'R127', 'R128', 'R129', 'R130', 'R131', 'R132', 'R133', 'R134', 'R135', 'R136', 'R137', 'R138', 'R139']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
