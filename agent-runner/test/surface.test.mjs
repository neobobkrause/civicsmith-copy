import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { stubSdk, success, request, startRunner, conversation, MEMBER } from './helpers.mjs';
import { imageReference, readManifest } from '../src/manifest.mjs';
import { installScriptFaults } from '../scripts/install-scripts.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json'));
const PLACE = /oakland|alameda|california|\bbay area\b/i;

// A raw HTTP exchange, so upgrade requests to other paths can be checked as well.
const raw = (base, text) => new Promise((resolve, reject) => {
  const [host, port] = base.split(':');
  const s = net.connect(Number(port), host, () => s.write(text));
  let out = '';
  s.on('data', (d) => { out += d; });
  s.on('end', () => resolve(out));
  s.on('error', reject);
});

test('R5 GET /version answers 200 with the name, the version the image was built with, and its capabilities: "image" as R24 is met', async () => {
  const data = Buffer.from('a page').toString('base64');
  const { calls, sdk } = stubSdk(async (call, { callTool }) => { await callTool('search', {}); return success(); });
  const r = await startRunner(sdk);
  try {
    const res = await fetch(`http://${r.base}/version`);
    assert.equal(res.status, 200);
    const v = await res.json();
    assert.deepEqual(v, { ok: true, name: 'agent-runner', version: pkg.version, capabilities: ['image'] });
    // "image" is stated because this image passes a page's picture (R24): checked here, not assumed
    await conversation(r.base, request(), () => ({ content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data } }] }));
    assert.deepEqual(calls[0].results[0].content, [{ type: 'image', data, mimeType: 'image/png' }]);
    assert.ok(!calls[0].results[0].isError);
  } finally { await r.stop(); }
});

test('R6 any other path or method answers 404 UNKNOWN', async () => {
  const { calls, sdk } = stubSdk(async () => success());
  const r = await startRunner(sdk);
  try {
    for (const [method, path] of [['GET', '/'], ['POST', '/version'], ['GET', '/conversation'], ['POST', '/conversation'],
      ['GET', '/version/x'], ['DELETE', '/x'], ['PUT', '/conversation']]) {
      const res = await fetch(`http://${r.base}${path}`, { method });
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.deepEqual(await res.json(), { ok: false, code: 'UNKNOWN' });
    }
    const up = (path) => `GET ${path} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n`
      + 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n';
    for (const path of ['/version', '/', '/conversations']) {
      const out = await raw(r.base, up(path));
      assert.match(out, /^HTTP\/1\.1 404 /);
      assert.ok(out.endsWith('{"ok":false,"code":"UNKNOWN"}'));
    }
    assert.equal(calls.length, 0);
  } finally { await r.stop(); }
});

test('R7 the fleet manifest names one digest-pinned image, its surface and its build recipe', () => {
  const m = readManifest();
  assert.equal(m.name, 'agent-runner');
  assert.equal(m.kind, 'container');
  assert.deepEqual(Object.keys(m.surface), ['GET /version', 'GET /conversation (WebSocket upgrade)', 'POST /signin',
    'POST /signin/code', 'POST /signin/state', 'POST /signout', 'anything else']);
  for (const [k, r] of [['POST /signin', 'R17, R27, R31'], ['POST /signin/code', 'R18, R27, R31'], ['POST /signin/state', 'R19, R27'], ['POST /signout', 'R20, R27']])
    assert.ok(m.surface[k].startsWith(`${r}:`), k);
  assert.match(m.surface['POST /signin/code'], /token, valid_for/, 'the code answer carries the token (R27)');
  assert.equal(typeof m.terms, 'object', 'R23\'s terms are stated');
  assert.equal(m.build.dockerfile, 'Dockerfile');
  const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /npm ci/);
  assert.match(dockerfile, /CMD \["node", "src\/entry\.mjs"\]/);
  assert.match(dockerfile, new RegExp(`EXPOSE ${m.image.port}`));
  // the SDK pinned to one version, and the lock holds it
  const dep = pkg.dependencies['@anthropic-ai/claude-agent-sdk'];
  assert.match(dep, /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(lock.packages['node_modules/@anthropic-ai/claude-agent-sdk'].version, dep);
  // an install names exactly one image: by digest, or not at all
  const digest = 'sha256:' + 'ab'.repeat(32);
  assert.equal(imageReference({ image: { repository: m.image.repository, digest } }), `${m.image.repository}@${digest}`);
  for (const bad of [{ image: { repository: m.image.repository, digest: null } }, { image: { repository: m.image.repository, digest: 'latest' } },
    { image: { repository: m.image.repository, digest: 'sha256:abc' } }, { image: { repository: `${m.image.repository}@${digest}`, digest } },
    { image: { digest } }, {}, null]) {
    assert.throws(() => imageReference(bad), (e) => e.code === 'IMAGE_NOT_PINNED');
  }
  if (m.image.digest !== null) assert.equal(imageReference(m), `${m.image.repository}@${m.image.digest}`);
  else assert.throws(() => imageReference(m), (e) => e.code === 'IMAGE_NOT_PINNED');
});

// R10 (K2211): the model API, and the one host Claude Code's own sign-in, its renewal and its logout reach from the
// container (the pinned binary 2.1.289's TOKEN_URL); each named exactly, no wildcard.
export const EGRESS = ['api.anthropic.com', 'platform.claude.com'];
test('R10 the manifest\'s egress allow-list is the model API and the sign-in\'s host, each exactly', () => {
  const egress = readManifest().egress;
  assert.deepEqual(egress, EGRESS);
  for (const h of egress) assert.match(h, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/, `${h}: a host named exactly, no wildcard, scheme or path`);
});

// R11's one exemption (K1905): the image's registry address is a distribution coordinate, the publisher's namespace,
// not a place the product states. Exactly two values are exempt: the marker's `image.repository`, and the same
// repository as the prefix of each image reference in the wrangler configuration's `containers`. Everything else in
// the module's configuration, outward text and behaviour is read whole.
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
  const texts = [...configurationTexts(manifest, wranglerText), read('../Dockerfile'), JSON.stringify(pkg),
    read('../src/worker.mjs'), read('../src/entry.mjs'), read('../src/runner.mjs'), read('../src/ws.mjs'), read('../src/manifest.mjs'),
    read('../src/env.mjs'), read('../src/signin.mjs'), read('../src/screen.mjs'), read('../src/waits.mjs')];
  const { sdk } = stubSdk(async (call, { callTool }) => { await callTool('search', {}); return success(); });
  const r = await startRunner(sdk);
  try {
    texts.push(await (await fetch(`http://${r.base}/version`)).text(), await (await fetch(`http://${r.base}/x`)).text());
    texts.push(JSON.stringify((await conversation(r.base, request())).frames));
    texts.push(JSON.stringify((await conversation(r.base, request({ credential: null }))).frames));
    texts.push(JSON.stringify((await conversation(r.base, 'nope')).frames));
    texts.push(JSON.stringify((await conversation(r.base, request({ max_turns: 0 }))).frames));
  } finally { await r.stop(); }
  assert.deepEqual(placeFaults(texts), []);

  // The exemption is exactly those two values: the publisher's namespace there passes (the release writes
  // `ghcr.io/believeinoakland/agent-runner`, K1905), and the same word anywhere else still fails. The published form is
  // derived from the configuration as it stands (N750, K2074): on a tranche (`@sha256:UNPUBLISHED`) a published
  // namespace and digest are written in; on a release cut, which already holds them, it is judged as it is.
  const ns = 'ghcr.io/believeinoakland/agent-runner', digest = 'sha256:' + '9d'.repeat(32);
  const unpublished = `"${manifest.image.repository}@sha256:UNPUBLISHED"`;
  const onTranche = wranglerText.includes(unpublished);
  const published = onTranche ? { ...manifest, image: { ...manifest.image, repository: ns, digest } } : manifest;
  const publishedWrangler = onTranche ? wranglerText.replace(unpublished, `"${ns}@${digest}"`) : wranglerText;
  assert.deepEqual(placeFaults(configurationTexts(published, publishedWrangler)), [], 'the registry address is exempt');
  for (const [what, m, w] of [
    ['the build command', { ...published, build: { ...published.build, command: `docker build -t ${ns}:<version> agent-runner` } }, publishedWrangler],
    ['the note', { ...published, note: `${published.note} Published under ${ns}.` }, publishedWrangler],
    ['another marker field', { ...published, image: { ...published.image, platform: 'oakland/amd64' } }, publishedWrangler],
    ['a wrangler comment', published, `// Oakland's member\n${publishedWrangler}`],
    ['the wrangler name', published, publishedWrangler.replace('"name": "agent-runner"', '"name": "agent-runner-oakland"')],
    ['the terms', { ...published, terms: { ...published.terms, who_agrees: 'Alameda County groups' } }, publishedWrangler],
  ]) assert.notDeepEqual(placeFaults(configurationTexts(m, w)), [], `a place word in ${what} still fails`);
});

// R16 (F20, AIR15): no package's install or lifecycle script runs at image build. A dependency that needs its script
// is admitted only by a reviewed change naming it here, which BOB rules on; none is.
const ADMITTED_INSTALL_SCRIPTS = [];
const installInputs = () => ({ dockerfile: read('../Dockerfile'), lock: JSON.parse(read('../package-lock.json')), pkg,
  admitted: ADMITTED_INSTALL_SCRIPTS });

test('R16 the image installs with npm ci --omit=dev --ignore-scripts, and the lock holds no package with an install script', () => {
  assert.deepEqual(installScriptFaults(installInputs()), []);
  assert.match(read('../Dockerfile'), /^COPY package\.json package-lock\.json \.\/$/m, 'the lock is in the build context');
});

test('R16 control: a lockfile package with an install script, or an install without --ignore-scripts, fails naming it', () => {
  const ok = installInputs();
  const lock = structuredClone(ok.lock);
  lock.packages['node_modules/planted-native'] = { version: '1.0.0', hasInstallScript: true };
  assert.deepEqual(installScriptFaults({ ...ok, lock }), ['planted-native: has an install script']);
  assert.deepEqual(installScriptFaults({ ...ok, lock, admitted: ['planted-native'] }), [], 'admitted only when named');
  const dockerfile = ok.dockerfile.replace(/ --ignore-scripts/g, '');
  assert.ok(installScriptFaults({ ...ok, dockerfile }).some((f) => /no --ignore-scripts/.test(f)));
  assert.ok(installScriptFaults({ ...ok, pkg: { ...pkg, scripts: { postinstall: 'x' } } }).includes('package.json declares postinstall'));
});
