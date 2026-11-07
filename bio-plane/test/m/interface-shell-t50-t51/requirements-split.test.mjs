// interface-shell-t50-t51 was split by copy from interface-shell (5 Nov 2026, BOB, for the requirements cap of 70000 bytes).
// The requirements it holds are the 55 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/interface-shell-t50-t51.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('interface-shell-t50-t51 holds R73, R74, R75, R76, R77, R78, R79, R80, R81, R82, R83, R84, R85, R86, R87, R88, R89, R90, R91, R92, R93, R94, R95, R96, R97, R98, R99, R100, R101, R102, R103, R104, R105, R106, R107, R108, R109, R110, R111, R117, R118, R119, R120, R122, R123, R124, R125, R128, R129, R130, R131, R132, R133, R134 and R135, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R100', 'R101', 'R102', 'R103', 'R104', 'R105', 'R106', 'R107', 'R108', 'R109', 'R110', 'R111', 'R117', 'R118', 'R119', 'R120', 'R122', 'R123', 'R124', 'R125', 'R128', 'R129', 'R130', 'R131', 'R132', 'R133', 'R134', 'R135', 'R73', 'R74', 'R75', 'R76', 'R77', 'R78', 'R79', 'R80', 'R81', 'R82', 'R83', 'R84', 'R85', 'R86', 'R87', 'R88', 'R89', 'R90', 'R91', 'R92', 'R93', 'R94', 'R95', 'R96', 'R97', 'R98', 'R99']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});
