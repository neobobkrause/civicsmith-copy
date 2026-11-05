// held-captures was split by copy from capture (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 12 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/held-captures.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('held-captures holds R77, R78, R79, R81, R82, R83, R84, R88, R91, R100, R101 and R102, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R100', 'R101', 'R102', 'R77', 'R78', 'R79', 'R81', 'R82', 'R83', 'R84', 'R88', 'R91']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
