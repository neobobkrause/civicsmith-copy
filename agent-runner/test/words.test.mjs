// R41: the sentences the image reads are read by key from rows it carries as data of its own. Nothing here holds a
// sentence's text: a test compares with the carried row, or with the plane's word table's row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { WORD_ROWS } from '../../bio-plane/src/setup-words/index.mjs';
import { SAYS_WORDS } from '../src/says-words.mjs';
import { SAYS_KEYS, says } from '../src/says.mjs';
import { REFUSAL_CODES, RUNNER_DETAIL_CHARS_MAX } from '../src/params.mjs';
import { carriedRows, saysWordsModule } from '../scripts/build-words.mjs';
import { runner, runBody, declared } from './helpers.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const PLACE = /oakland|alameda|california|\bbay area\b/i;
const table = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));

test('R41 every key the image reads is carried, the carried row equals the word table row, and stale data fails', () => {
  assert.deepEqual(Object.keys(SAYS_KEYS).sort(), [...REFUSAL_CODES].sort());
  for (const [code, key] of Object.entries(SAYS_KEYS)) {
    assert.equal(key, `gate.runner.refused.${code}`);
    assert.equal(typeof SAYS_WORDS[key], 'string', `${code} is carried`);
    assert.equal(SAYS_WORDS[key], table.get(key), `${code}: the row as the table holds it`);
    assert.ok(SAYS_WORDS[key].length <= RUNNER_DETAIL_CHARS_MAX);
    assert.ok(!PLACE.test(SAYS_WORDS[key]) && !/\bgroups?\b/i.test(SAYS_WORDS[key]), `${code}: "team", never "group", and no place`);
  }
  assert.deepEqual(Object.keys(SAYS_WORDS).sort(), Object.values(SAYS_KEYS).sort(), 'nothing carried that no code reads');
  assert.equal(read('../src/says-words.mjs'), saysWordsModule(), 'the carried data is current');
  assert.throws(() => carriedRows([...REFUSAL_CODES, 'NO_SUCH_CODE']), /no row for gate\.runner\.refused\.NO_SUCH_CODE/, 'a code with no row fails the build');
  assert.throws(() => says('NO_SUCH_CODE'));
});

test('R41 each refusal answers the carried row of its code as detail', async () => {
  const seen = new Set();
  const h = await runner();
  for (const body of ['x', runBody({ tiers: ['T9'] }), runBody({ ceiling: null })]) {
    const r = await h.call('POST', '/run', body);
    assert.equal(r.json.detail, SAYS_WORDS[`gate.runner.refused.${r.json.code}`]);
    seen.add(r.json.code);
  }
  const c = await runner({ options: { deployment: 'civicsmith' } });
  const r = await c.call('POST', '/run', runBody({ declared: declared({ route: 'civicsmith' }) }));
  assert.equal(r.json.detail, SAYS_WORDS['gate.runner.refused.NOT_A_SAMPLE_ACCOUNT']);
  assert.ok(seen.size === 3);
});

test('R41 control: a scan of src/ finds no English string literal as a detail', () => {
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((x) => x.endsWith('.mjs') && x !== 'says-words.mjs')) {
    const text = read(`../src/${f}`);
    assert.ok(!/detail\s*:\s*['"`][A-Za-z]/.test(text), `${f}: a detail is read by key, never a literal`);
  }
});
