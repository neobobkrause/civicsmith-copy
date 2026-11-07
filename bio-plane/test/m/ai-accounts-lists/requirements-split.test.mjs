// ai-accounts-lists was split by copy from ai-accounts (5 Nov 2026, coordinator ruling 08:23).
// The requirements it holds are the seven copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/ai-accounts-lists.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('ai-accounts-lists holds R41, R46, R49, R50, R70, R72 and R77, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R41', 'R46', 'R49', 'R50', 'R70', 'R72', 'R77']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
