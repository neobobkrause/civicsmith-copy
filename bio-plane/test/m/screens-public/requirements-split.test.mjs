// screens-public was split by copy from screens-publish (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 22 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/screens-public.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('screens-public holds R6, R9, R19, R21, R22, R29, R33, R36, R37, R38, R39, R49, R54, R56, R67, R76, R84, R86, R100, R101, R102 and R104, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R100', 'R101', 'R102', 'R104', 'R19', 'R21', 'R22', 'R29', 'R33', 'R36', 'R37', 'R38', 'R39', 'R49', 'R54', 'R56', 'R6', 'R67', 'R76', 'R84', 'R86', 'R9']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
