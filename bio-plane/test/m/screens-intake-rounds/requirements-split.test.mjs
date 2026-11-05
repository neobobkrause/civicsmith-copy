// screens-intake-rounds was split by copy from screens-intake (5 Nov 2026, coordinator standing rule).
// The requirements it holds are the 40 copied verbatim, under their numbers, each once.
// R61's line opens with its fix-round label before its id ("- **Fix round 6, G43 (K4657): R61**"), as in screens-intake; it is read as R61.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/screens-intake-rounds.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(?:Fix round [^*]*: )?(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('screens-intake-rounds holds R55, R56, R57, R58, R59, R60, R61, R62, R63, R64, R65, R66, R67, R68, R69, R70, R71, R72, R73, R74, R75, R76, R77, R78, R79, R80, R81, R82, R83, R84, R85, R86, R87, R88, R89, R90, R91, R92, R93 and R94, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R55', 'R56', 'R57', 'R58', 'R59', 'R60', 'R61', 'R62', 'R63', 'R64', 'R65', 'R66', 'R67', 'R68', 'R69', 'R70', 'R71', 'R72', 'R73', 'R74', 'R75', 'R76', 'R77', 'R78', 'R79', 'R80', 'R81', 'R82', 'R83', 'R84', 'R85', 'R86', 'R87', 'R88', 'R89', 'R90', 'R91', 'R92', 'R93', 'R94']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
