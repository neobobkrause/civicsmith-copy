// interface-shell-t53 was split by copy from interface-shell (5 Nov 2026, BOB, for the requirements cap of 70000 bytes).
// The requirements it holds are the 16 copied verbatim, under their numbers, each once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = readFileSync(new URL('../../../../build/requirements/interface-shell-t53.md', import.meta.url), 'utf8');
const ids = [...text.matchAll(/^- \*\*(R\d+|F\d+)\*\*/gm)].map((m) => m[1]);

test('interface-shell-t53 holds R136, R137, R138, R139, R140, R141, R142, R143, R144, R145, R146, R147, R148, R149, R150 and R151, each once, and no other requirement', () => {
  assert.deepEqual([...ids].sort(), ['R136', 'R137', 'R138', 'R139', 'R140', 'R141', 'R142', 'R143', 'R144', 'R145', 'R146', 'R147', 'R148', 'R149', 'R150', 'R151']);
});

test('its requirements file is under the requirements cap of 70000 bytes', () => {
  assert.ok(Buffer.byteLength(text) < 70000);
});

// Attempt 2 (7 Nov 2026) met R138 and R141 through interface-shell's hook (kit.test.mjs); every other one stays unmet, as copied.
const MET = ['R138', 'R141'];
test('R138 and R141 are met and struck; each other requirement is unmet, as copied', () => {
  for (const l of text.split('\n').filter((x) => /^- \*\*R\d+\*\*/.test(x))) {
    const id = /^- \*\*(R\d+)\*\*/.exec(l)[1];
    assert.equal(l.includes('*(not yet met'), !MET.includes(id), id);
  }
});
