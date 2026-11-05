// installer-check was split by copy from installer (5 Nov 2026, the 70000 cap; coordinator standing rule).
// The requirements it holds are the 10 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/installer-check.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('installer-check holds R84, R85, R86, R87, R88, R89, R90, R91, R92 and R93, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R84', 'R85', 'R86', 'R87', 'R88', 'R89', 'R90', 'R91', 'R92', 'R93']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
