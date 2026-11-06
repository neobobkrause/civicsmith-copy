// The image's surface and build: R6, R7, R11, R16, R26 (the entry), R33 (R56's listing waits: unmet.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { imageReference, readManifest, RUNNER_INSTANCE_TYPE } from '../src/manifest.mjs';
import { installScriptFaults } from '../scripts/install-scripts.mjs';
import { serve } from '../src/entry.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';
import { runner, runBody } from './helpers.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json'));
const PLACE = /oakland|alameda|california|\bbay area\b/i;

async function listening(opts) {
  const s = serve(opts);
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${s.address().port}`, close: () => new Promise((r) => { s.closeAllConnections?.(); s.close(r); }) };
}

test('R6 any other path or method answers 404 UNKNOWN', async () => {
  const s = await listening({ env: {} });
  try {
    for (const [method, path] of [['GET', '/'], ['POST', '/version'], ['GET', '/conversation'], ['POST', '/signin'],
      ['GET', '/run'], ['PUT', '/run/status'], ['DELETE', '/x'], ['GET', '/run/status/x']]) {
      const res = await fetch(`${s.base}${path}`, { method });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.deepEqual(await res.json(), { ok: false, code: 'UNKNOWN' });
    }
  } finally { await s.close(); }
});

test('R26 the server listens before the run code loads: /version answers while a loader never resolves; POST /run waits for it', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const s = await listening({ env: { DEPLOYMENT: 'team' }, load: () => new Promise(() => {}) });
  try {
    const v = await fetch(`${s.base}/version`);
    assert.equal(v.status, 200);
    assert.equal((await v.json()).name, 'agent-runner');
  } finally { await s.close(); }
  const h = await runner();
  const slow = await listening({ env: {}, load: async () => { await gate; return { makeRunner: () => h.r }; } });
  try {
    let answered = false;
    const p = fetch(`${slow.base}/run/status`).then((r) => { answered = true; return r; });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(answered, false, 'waits for the load');
    release();
    const r = await p;
    assert.equal((await r.json()).code, 'NO_RUN');
  } finally { await slow.close(); }
});

test('R7 the fleet manifest names one digest-pinned image, its surface (R5, R6, R43–R55) and its build recipe, and no terms', () => {
  const m = readManifest();
  assert.equal(m.name, 'agent-runner');
  assert.equal(m.kind, 'container');
  assert.deepEqual(Object.keys(m.surface), ['GET /version', 'POST /run', 'GET /run/status', 'GET /run/manifest',
    'POST /run/approve', 'GET /run/bundle', 'POST /run/discard', 'anything else']);
  const ids = new Set(Object.values(m.surface).flatMap((v) => v.split(':')[0].split(/,\s*/)));
  for (const id of ids) assert.match(id, /^R(5|6|4[3-9]|5[0-9]|60)$/, `${id} is a surface id`);
  for (const id of ['R5', 'R6', 'R43', 'R54', 'R55']) assert.ok(ids.has(id));
  for (const retired of ['R1', 'R2', 'R3', 'R4', 'R17', 'R27', 'R36']) assert.ok(!ids.has(retired), `${retired} is retired`);
  assert.equal('terms' in m, false, 'no terms field (R23 retired)');
  assert.equal(m.build.dockerfile, 'Dockerfile');
  const digest = 'sha256:' + 'ab'.repeat(32);
  assert.equal(imageReference({ image: { repository: m.image.repository, digest } }), `${m.image.repository}@${digest}`);
  assert.match(imageReference(m), /^[a-z0-9.-]+(:[0-9]+)?\/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$/);
  const w = parseJsonc(read('../wrangler.jsonc'), 'wrangler.jsonc');
  assert.equal(w.containers[0].image, imageReference(m), 'the configuration names the same image');
  for (const bad of [{ image: { repository: m.image.repository, digest: 'latest' } }, { image: { digest } }, null])
    assert.throws(() => imageReference(bad), (e) => e.code === 'IMAGE_NOT_PINNED');
  // control: a manifest listing a retired id fails the id check
  assert.doesNotMatch('R17', /^R(5|6|4[3-9]|5[0-9]|60)$/);
});

// R11's one exemption (K1905): the image's registry address is a distribution coordinate, the publisher's namespace.
const placeFaults = (texts) => texts.filter((t) => PLACE.test(t));
function configurationTexts(manifest, wranglerText) {
  const repo = manifest.image && manifest.image.repository;
  const marker = JSON.stringify({ ...manifest, image: { ...manifest.image, repository: '<repository>' } });
  const ref = new RegExp(`("image"\\s*:\\s*")${repo.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}@`, 'g');
  const containers = parseJsonc(wranglerText, 'wrangler.jsonc').containers || [];
  const found = wranglerText.match(ref) || [];
  assert.equal(found.length, containers.length, 'the exempt repository appears once per container image reference');
  for (const c of containers) assert.ok(c.image.startsWith(`${repo}@`), 'each container image is the marker\'s repository');
  return [marker, wranglerText.replace(ref, '$1<repository>@')];
}

test('R11 no place is named in its behaviour, outward text or configuration; the registry address alone is exempt', async () => {
  const manifest = readManifest(), wranglerText = read('../wrangler.jsonc');
  const src = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.mjs')).map((f) => read(`../src/${f}`));
  const texts = [...configurationTexts(manifest, wranglerText), read('../Dockerfile'), JSON.stringify(pkg), ...src];
  const h = await runner();
  for (const [m, p, b] of [['GET', '/version'], ['GET', '/x'], ['POST', '/run', 'nope'], ['POST', '/run', runBody({ tiers: ['T3'] })], ['GET', '/run/status']])
    texts.push(JSON.stringify((await h.call(m, p, b)).json));
  assert.deepEqual(placeFaults(texts), []);
  const ns = 'ghcr.io/believeinoakland/agent-runner', digest = 'sha256:' + '9d'.repeat(32);
  const published = { ...manifest, image: { ...manifest.image, repository: ns, digest } };
  const publishedWrangler = wranglerText.replace(/"image": "[^"@]+@sha256:[^"]+"/, `"image": "${ns}@${digest}"`);
  assert.deepEqual(placeFaults(configurationTexts(published, publishedWrangler)), [], 'the registry address is exempt');
  for (const [what, m, w] of [
    ['the note', { ...published, note: `${published.note} Published under ${ns}.` }, publishedWrangler],
    ['another marker field', { ...published, image: { ...published.image, platform: 'oakland/amd64' } }, publishedWrangler],
    ['a wrangler comment', published, `// Oakland's member\n${publishedWrangler}`],
  ]) assert.notDeepEqual(placeFaults(configurationTexts(m, w)), [], `a place word in ${what} still fails`);
});

// R16 (F20, AIR15): no package's install or lifecycle script runs at image build.
const installInputs = () => ({ dockerfile: read('../Dockerfile'), lock: JSON.parse(read('../package-lock.json')), pkg, admitted: [] });

test('R16 the image installs nothing and runs no install script; the lock holds no package with one', () => {
  assert.deepEqual(installScriptFaults(installInputs()), []);
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'the image has no runtime dependency to install');
});

test('R16 control: a lockfile package with an install script, or an install without --ignore-scripts, fails naming it', () => {
  const ok = installInputs();
  const lock = structuredClone(ok.lock);
  lock.packages['node_modules/planted-native'] = { version: '1.0.0', hasInstallScript: true };
  assert.deepEqual(installScriptFaults({ ...ok, lock }), ['planted-native: has an install script']);
  assert.deepEqual(installScriptFaults({ ...ok, lock, admitted: ['planted-native'] }), []);
  const dockerfile = `${ok.dockerfile}\nRUN npm ci --omit=dev`;
  assert.ok(installScriptFaults({ ...ok, dockerfile }).some((f) => /no --ignore-scripts/.test(f)));
  assert.ok(installScriptFaults({ ...ok, pkg: { ...pkg, scripts: { postinstall: 'x' } } }).includes('package.json declares postinstall'));
});

test('R33 the container instance_type is the recorded figure; max_instances and the image are unchanged by it', () => {
  const w = parseJsonc(read('../wrangler.jsonc'), 'wrangler.jsonc');
  assert.equal(w.containers[0].instance_type, RUNNER_INSTANCE_TYPE);
  assert.equal(RUNNER_INSTANCE_TYPE, 'standard-1');
  assert.equal(w.containers[0].max_instances, readManifest().max_instances);
});
