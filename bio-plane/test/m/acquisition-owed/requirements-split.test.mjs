// acquisition-owed was split by copy from acquisition (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 23 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/acquisition-owed.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('acquisition-owed holds R46, R96, R99, R100, R101, R102, R103, R104, R105, R106, R108, R109, R110, R111, R112, R115, R116, R117, R118, R119, R120, R123 and R140, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R100', 'R101', 'R102', 'R103', 'R104', 'R105', 'R106', 'R108', 'R109', 'R110', 'R111', 'R112', 'R115', 'R116', 'R117', 'R118', 'R119', 'R120', 'R123', 'R140', 'R46', 'R96', 'R99']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
