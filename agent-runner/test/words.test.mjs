// R41: the sentences the image reads are read by key from rows it carries as data of its own. Nothing here holds a
// sentence's text: a test compares with the carried row, or with the plane's word table's row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverMembers, buildMember } from '../../bio-plane/scripts/fleet-bundle.mjs';
import { WORD_ROWS } from '../../bio-plane/src/setup-words/index.mjs';
import { SAYS_WORDS } from '../src/says-words.mjs';
import { SAYS_KEYS, says } from '../src/says.mjs';
import { carriedRows, saysWordsModule } from '../scripts/build-words.mjs';
import { agentRunnerOf } from '../src/entry.mjs';
import { signinOf } from '../src/signin.mjs';
import { stubSdk, success, startRunner } from './helpers.mjs';
import { GOOD_CODE } from './stubs/claude-values.mjs';
import { installRuntime } from './stubs/runtime.mjs';

const here = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(here(p), 'utf8');
const M = 'member-7d1e', OTHER = 'member-0b42';
const PLACE = /oakland|alameda|california|\bbay area\b/i;
const MACHINERY = /\binstance\b|\bcontainer\b/i;
const table = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
// The files the Dockerfile puts in the image.
const imageFiles = () => read('../Dockerfile').split('\n').filter((l) => l.startsWith('COPY src/')).flatMap((l) => l.split(/\s+/).slice(1, -1));

test('R41 every key the image reads is carried, the carried data is what the build writes (stale data fails), and a held row is carried as the table holds it', () => {
  const keys = Object.values(SAYS_KEYS);
  assert.ok(keys.length > 0 && new Set(Object.keys(SAYS_KEYS)).size === keys.length, 'one key per code');
  for (const [code, key] of Object.entries(SAYS_KEYS)) {
    assert.equal(typeof SAYS_WORDS[key], 'string', `${code}: ${key} is carried`);
    if (table.has(key)) assert.equal(SAYS_WORDS[key], table.get(key), `${code}: the row as the table holds it`);
    if (/^(screen\.connect\.refused|refusal)\./.test(key)) assert.ok(table.has(key), `${code}: a design row, held by the table`);
  }
  assert.deepEqual(Object.keys(SAYS_WORDS).sort(), [...new Set(keys)].sort(), 'nothing carried that no code reads');
  assert.equal(read('../src/says-words.mjs'), saysWordsModule(), 'the carried data is current');
  assert.deepEqual(Object.entries(SAYS_WORDS), carriedRows());
  // every carried row keeps R31's limits
  for (const [key, text] of Object.entries(SAYS_WORDS)) {
    assert.ok(text.length > 0 && text.length <= 300, `${key}: at most 300 characters`);
    assert.ok(!PLACE.test(text) && !MACHINERY.test(text), `${key}: DEC-149's words, no place`);
  }
  // a code with no carried row fails the build; a reader of one throws, never answers blank
  assert.throws(() => carriedRows({ X: 'refusal.NOT_A_ROW_ANYWHERE' }), /no row for refusal\.NOT_A_ROW_ANYWHERE/);
  assert.throws(() => says('NOT_A_CODE'), /no carried row/);
  assert.throws(() => says('REFUSED'), /needs \{v1\}/);
});

test('R41 each refusal of R17 to R20 answers the carried row of its code as detail', async () => {
  const check = (a, status, code, row) => {
    assert.deepEqual([a.status, a.body.code], [status, code]);
    assert.equal(a.body.detail, row, `${code}: the carried row`);
  };
  const r = await startRunner(stubSdk(async () => success()).sdk);
  try {
    for (const path of ['/signin', '/signin/code', '/signin/state', '/signout']) {
      check(await r.post(path, 'not json'), 400, 'BAD_REQUEST', says('BAD_REQUEST'));
      check(await r.post(path, { member: '' }), 400, 'BAD_MEMBER', says('BAD_MEMBER'));
    }
    check(await r.post('/signin/code', { member: M, code: GOOD_CODE }), 409, 'NO_SIGNIN_WAITING', says('NO_SIGNIN_WAITING'));
    const first = await r.post('/signin', { member: M });
    const second = await r.post('/signin', { member: M });
    check(await r.post('/signin/code', { member: M, code: GOOD_CODE, attempt: first.body.attempt }), 409, 'ATTEMPT_SUPERSEDED', says('ATTEMPT_SUPERSEDED'));
    check(await r.post('/signin/code', { member: M, code: '', attempt: second.body.attempt }), 400, 'BAD_CODE', says('BAD_CODE'));
    for (const [path, body] of [['/signin', { member: OTHER }], ['/signin/code', { member: OTHER, code: GOOD_CODE }], ['/signout', { member: OTHER }]])
      check(await r.post(path, body), 409, 'NOT_THIS_MEMBER', says('NOT_THIS_MEMBER'));
  } finally { await r.stop(); }
  for (const [mode, waits, code, status, row] of [
    ['foreign', undefined, 'SIGNIN_ADDRESS_UNEXPECTED', 502, says('SIGNIN_ADDRESS_UNEXPECTED')],
    ['silent', { address: 300 }, 'SIGNIN_UNAVAILABLE', 502, says('NO_ADDRESS')],
    ['exits', undefined, 'SIGNIN_UNAVAILABLE', 502, says('EXITED')],
  ]) {
    const h = await startRunner(stubSdk(async () => success()).sdk, { mode, waits });
    try { check(await h.post('/signin', { member: M }), status, code, row); } finally { await h.stop(); }
  }
  const none = await startRunner(stubSdk(async () => success()).sdk);
  try { check(await signinOf({ root: none.signinRoot, binary: null }).start(M), 502, 'SIGNIN_UNAVAILABLE', says('NO_BINARY')); } finally { await none.stop(); }
  // the outcome's arms of R18
  const hangs = await startRunner(stubSdk(async () => success()).sdk, { mode: 'hangs', waits: { outcome: 300 } });
  try {
    await hangs.post('/signin', { member: M });
    check(await hangs.post('/signin/code', { member: M, code: GOOD_CODE }), 409, 'SIGNIN_REFUSED', says('NO_OUTCOME'));
  } finally { await hangs.stop(); }
  const shaped = await startRunner(stubSdk(async () => success()).sdk, { mode: 'bad-token' });
  try {
    await shaped.post('/signin', { member: M });
    check(await shaped.post('/signin/code', { member: M, code: GOOD_CODE }), 409, 'SIGNIN_REFUSED', says('TOKEN_SHAPE'));
  } finally { await shaped.stop(); }
  const refuses = await startRunner(stubSdk(async () => success()).sdk, { mode: 'refuses' });
  try {
    await refuses.post('/signin', { member: M });
    const a = await refuses.post('/signin/code', { member: M, code: GOOD_CODE });
    const said = refuses.lines.filter((l) => l.event === 'signin.runner' && l.step === 'code').at(-1).said_head;
    check(a, 409, 'SIGNIN_REFUSED', says('REFUSED', { v1: ` (${said})` }));
    assert.equal(says('REFUSED', { v1: '' }).includes('()'), false, 'no binary words: no empty brackets');
  } finally { await refuses.stop(); }
  // a step that throws answers the carried row of NOT_RUN
  const server = agentRunnerOf({ sdk: stubSdk(async () => success()).sdk, signin: { start: async () => { throw new Error('x'); }, waiting: null } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/signin`, { method: 'POST', body: JSON.stringify({ member: M }) });
    check({ status: res.status, body: await res.json() }, 502, 'SIGNIN_UNAVAILABLE', says('NOT_RUN'));
  } finally { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); }
});

test('R41 RUNNER_NOT_STARTED answers the carried row as detail', async () => {
  // the Worker as its source builds today (the committed bundle is regenerated at the layer close)
  const built = await buildMember(discoverMembers().find((m) => m.name === 'agent-runner'), { write: false });
  const dir = mkdtempSync(join(tmpdir(), 'agent-runner-worker-'));
  writeFileSync(join(dir, 'worker.mjs'), built.bytes);
  const restore = installRuntime();
  try {
    const { AgentRunner } = await import(pathToFileURL(join(dir, 'worker.mjs')).href);
    const self = { defaultPort: 8080, containerFetch: async () => new Response('plain words', { status: 500 }), holdAfter: async () => {} };
    const res = await AgentRunner.prototype.passThrough.call(self, new Request('https://agent-runner/signin', { method: 'POST', body: '{}' }));
    const body = await res.json();
    assert.deepEqual([res.status, body.code], [503, 'RUNNER_NOT_STARTED']);
    assert.equal(body.detail, says('RUNNER_NOT_STARTED'));
  } finally { restore(); rmSync(dir, { recursive: true, force: true }); }
});

test('R41 control: the image holds no WORDS table and no English literal as a detail, and imports nothing outside itself', () => {
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = readdirSync(here('../src/')).filter((f) => f.endsWith('.mjs') && f !== 'says-words.mjs');
  for (const f of sources) {
    const text = stripComments(read(`../src/${f}`));
    assert.ok(!/\bWORDS\s*=/.test(text.replace(/\bSAYS_WORDS\s*=/g, '').replace(/\bREFUSED_WORDS\s*=/g, '').replace(/\bSTARTED_WORDS\s*=/g, '')), `${f}: no WORDS table`);
    assert.ok(!/setup-words|bio-plane/.test(text.replace(/^import .*bundler.*$/gm, '')) || f === 'manifest.mjs', `${f}: nothing of the plane`);
  }
  // the sign-in's answers and the Worker's: a detail is a row, never a literal
  const entry = stripComments(read('../src/entry.mjs'));
  const routes = entry.slice(entry.indexOf('createServer('), entry.indexOf("server.on('upgrade'"));
  for (const [name, text] of [['signin.mjs', stripComments(read('../src/signin.mjs'))], ['worker.mjs', stripComments(read('../src/worker.mjs'))], ['the sign-in routes of entry.mjs', routes]]) {
    assert.ok(!/\bdetail\s*:\s*['"`]/.test(text), `${name}: no literal as a detail`);
    assert.ok(!/\brefuse\(\d+,\s*'[A-Z_]+',\s*['"`]/.test(text), `${name}: no literal as a refusal's words`);
  }
  // every file the image runs imports only files the Dockerfile copies
  const copied = new Set(imageFiles().map((f) => f.replace(/^\.?\/?(src\/)?/, '')));
  for (const f of copied) {
    const text = read(`../src/${f}`);
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*'(\.[^']+)'/g)) assert.ok(copied.has(m[1].replace(/^\.\//, '')), `${f} imports ${m[1]}, which the image does not carry`);
  }
});
