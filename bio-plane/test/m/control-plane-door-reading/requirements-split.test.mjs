// control-plane-door-reading was split by copy from control-plane (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 18 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/control-plane-door-reading.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('control-plane-door-reading holds R72, R100, R105, R115, R117, R120, R121, R123, R124, R125, R128, R129, R130, R131, R132, R133, R134 and R135, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R100', 'R105', 'R115', 'R117', 'R120', 'R121', 'R123', 'R124', 'R125', 'R128', 'R129', 'R130', 'R131', 'R132', 'R133', 'R134', 'R135', 'R72']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
