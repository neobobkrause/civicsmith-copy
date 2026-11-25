// The fleet member as deployed (R10): the committed bundle loaded under Node, its marker and configuration; the
// surface's edge (R9); the stores and limits (R15, R16); storage writes (R11) and egress (R12) as the sources state
// them; no place named (R18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadWorker } from './stubs/runtime.mjs';
import { dialled } from './stubs/cloudflare-sockets.mjs';
import { handle } from '../src/handler.mjs';
import * as limits from '../src/limits.mjs';
import { writeObject, deleteObject } from '../src/store.mjs';
import { PROVIDERS } from '../src/providers/catalogue.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';
import { discoverMembers, containerParts, classPackages, containerClasses } from '../../bio-plane/scripts/fleet-bundle.mjs';
import { memoryBucket, depsWith, post, NOW } from './helpers.mjs';

const here = (p) => new URL(`../${p}`, import.meta.url);
const text = (p) => readFileSync(here(p), 'utf8');
const marker = () => JSON.parse(text('fleet-member.json'));
const wrangler = () => parseJsonc(text('wrangler.jsonc'), 'wrangler.jsonc');
const pkg = JSON.parse(text('package.json'));
const sources = (dir) => readdirSync(here(dir), { recursive: true }).filter((f) => f.endsWith('.mjs')).map((f) => [`${dir}/${f}`, text(`${dir}/${f}`)]);

test('R9 any other method or path is refused 404 UNKNOWN', async () => {
  const deps = depsWith();
  for (const [method, path] of [['GET', '/'], ['GET', '/scan'], ['POST', '/version'], ['DELETE', '/mirror'], ['PUT', '/render'], ['GET', '/provider/scan'],
    ['POST', '/provider'], ['POST', '/providers'], ['POST', '/scan/extra'], ['POST', '/__proto__'], ['POST', '/constructor']]) {
    const r = await handle(new Request(`https://file-scanner${path}`, { method }), deps);
    assert.deepEqual([r.status, await r.json()], [404, { ok: false, code: 'UNKNOWN' }], `${method} ${path}`);
  }
});

test('R10 the bundle exports the Worker and its two container classes, each with no internet', async () => {
  const mod = await loadWorker();
  assert.deepEqual(Object.keys(mod).sort(), ['ContainerProxy', 'FileScanner', 'SafeViewRenderer', 'default']);
  assert.deepEqual(Object.keys(mod.default).sort(), ['fetch', 'limits', 'scheduled']);
  const ctx = { storage: { kv: { get() {}, put() {} }, sql: { exec: () => [] }, get: async () => undefined, put: async () => {}, setAlarm: async () => {}, getAlarm: async () => null, deleteAlarm: async () => {}, sync: async () => {} },
    blockConcurrencyWhile: async (f) => f(), container: { running: false, start() {}, monitor: () => new Promise(() => {}), getTcpPort: () => ({ fetch: async () => new Response('') }) },
    id: { toString: () => 'x' }, waitUntil() {}, exports: {} };
  for (const name of ['FileScanner', 'SafeViewRenderer']) {
    const c = new mod[name](ctx, {});
    assert.equal(c.enableInternet, false, `${name} has no internet (R12)`);
    c.containerFetch = async () => new Response('');
    await c.fetch(new Request('http://container/sigs'));
    assert.equal(c.enableInternet, false, `${name} serving a scan or a render still has none`);
    assert.ok(!c.allowedHosts || c.allowedHosts.length === 0, `${name} allows no host`);
    assert.equal(c.defaultPort, 8080);
  }
  const updater = new mod.FileScanner(ctx, {});
  updater.containerFetch = async () => new Response('');
  await updater.fetch(new Request('http://container/update/r1', { method: 'POST', headers: { 'x-signature-updater': '1' } }));
  assert.equal(updater.enableInternet, true, 'the signature-updater instance the mirror starts has internet, for freshclam alone (R6, R34)');
  const renderer = new mod.SafeViewRenderer(ctx, {});
  assert.equal(renderer.enableInternet, false);
});

test('R10 through the binding: the bundle answers R8 and R9 from its env, and its scheduled trigger runs the mirror through the signature-updater instance, the Worker opening no connection', async () => {
  const mod = await loadWorker();
  const bucket = memoryBucket();
  const env = { CAPTURES: bucket, VERSION: pkg.version };
  const v = await (await mod.default.fetch(new Request('https://file-scanner/version'), env)).json();
  assert.deepEqual([v.ok, v.name, v.version], [true, 'file-scanner', pkg.version]);
  const u = await mod.default.fetch(new Request('https://file-scanner/nothing'), env);
  assert.equal(u.status, 404);
  const hosts = [], asked = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (req) => { hosts.push(new URL(req.url ?? req).hostname); return new Response('no', { status: 503 }); };
  const SCANNER = { idFromName: (n) => n, get: (n) => ({ fetch: async (req) => { asked.push([n, req.method, new URL(req.url).pathname, req.headers.get('x-signature-updater')]);
    return new Response(JSON.stringify({ ok: false, code: 'MIRROR_REFUSED', detail: 'exit 58: 403 Forbidden' }), { status: 200 }); } }) };
  const waits = [];
  try {
    mod.default.scheduled({ cron: '*/10 * * * *', scheduledTime: NOW }, { ...env, SCANNER }, { waitUntil: (p) => waits.push(p) });
    const r = await waits[0];
    assert.equal(r.ok, false);
    assert.equal(r.error, 'MIRROR_REFUSED:exit 58: 403 Forbidden');
  } finally { globalThis.fetch = saved; }
  assert.deepEqual(hosts, [], 'the Worker itself reaches no host');
  // R6: through the Worker's own fetch, the async start hands the run to the platform's waitUntil and answers 202.
  const handed = [];
  const a = await mod.default.fetch(new Request('https://file-scanner/mirror?async=1', { method: 'POST' }), { ...env, SCANNER }, { waitUntil: (p) => handed.push(p) });
  assert.deepEqual([a.status, await a.json(), handed.length], [202, { ok: true, started: true }, 1]);
  assert.equal((await handed[0]).ok, false, 'the run it handed over ended in the updater\'s refusal');
  assert.deepEqual(asked[0], ['file-scanner-signature-updater', 'POST', asked[0][2], '1'], 'the run goes to the signature-updater instance');
  assert.ok(asked.every(([n, , , h]) => n === 'file-scanner-signature-updater' && h === '1'), 'and to no other instance');
  assert.ok(bucket.calls.filter(([op]) => op === 'put').every(([, k]) => k.startsWith('clamav/')));
  assert.deepEqual(dialled, []);
});

test('R10 the marker states a container member with two digest-pinned classes, its bundle, its binding and its trigger, as bundler reads it', () => {
  const m = marker();
  assert.equal(m.kind, 'container');
  assert.deepEqual(m.containers.map((c) => c.class_name), ['FileScanner', 'SafeViewRenderer']);
  for (const c of m.containers) {
    assert.match(c.image.repository, /^[a-z0-9.-]+\/[a-z0-9._/-]+$/);
    assert.match(c.image.digest, /^sha256:[0-9a-f]{64}$/, 'digest-pinned, as the release published it');
    assert.match(c.image.base.digest, /^sha256:[0-9a-f]{64}$/);
    assert.equal(c.instance_type, 'standard-1');
    assert.ok(Number.isInteger(c.max_instances) && c.max_instances > 0);
    const docker = text(c.build.dockerfile);
    assert.ok(docker.includes(`FROM node:22-bookworm-slim@${c.image.base.digest}\n`), 'the Dockerfile\'s base is the marker\'s, by digest');
    const st = JSON.parse(text(c.image.packages));
    assert.equal(st.base.digest, c.image.base.digest);
    for (const p of st.packages) assert.ok(docker.includes(`${p.name}=${p.version}`), `${c.class_name}: ${p.name} pinned in its Dockerfile`);
  }
  assert.equal(m.containers[0].bind[0].binding, 'SCANNER');
  assert.deepEqual(m.callers, [{ member: 'bio-plane', binding: 'FILE_SCANNER', kind: 'service' }]);
  assert.deepEqual(m.triggers.crons, wrangler().triggers.crons);
  assert.equal(m.optional_bindings[0].binding, 'SECURITY_VPC');
  assert.deepEqual(m.egress.containers, ['FileScanner, the signature-updater instance alone: database.clamav.net, by freshclam (R6, R34)']);
  // as bundler reads it: one part per class, each image's Debian packages from its statement
  const member = discoverMembers().find((x) => x.name === 'file-scanner');
  const published = { ...member, marker: { ...member.marker, containers: member.marker.containers.map((c) => ({ ...c, image: { ...c.image, digest: `sha256:${'a'.repeat(64)}` } })) } };
  const parts = containerParts(published, discoverMembers().map((x) => x.name));
  assert.deepEqual(parts.parts.map((p) => p.path), ['container/FileScanner.json', 'container/SafeViewRenderer.json']);
  for (const c of containerClasses(member).classes) assert.equal(classPackages(member, c).ecosystem, 'Debian:12');
});

// R10 (T47; N990, K2816 (4), K2912): the release's registry rule. Both images are named
// `docker.io/civicsmith/<image>@sha256:<64 hex>` (N1242; K3805, K3808; bundler R35), the digest the release
// published, the same reference in the marker and the configuration, and no other registry named for them. Cloudflare
// Containers do not pull from ghcr.io; a public Docker Hub image is pulled by its digest with no credential.
const RULE = /^docker\.io\/civicsmith\/[a-z0-9][a-z0-9._-]*@sha256:[0-9a-f]{64}$/;
const references = (m) => m.containers.map((c) => `${c.image.repository}@${c.image.digest}`);

test('R10 the release\'s registry rule: both images named docker.io/civicsmith/<image>@sha256:<64 hex>, the same reference in the marker and the configuration, no other registry', () => {
  const m = marker();
  assert.deepEqual(m.containers.map((c) => c.image.repository), ['docker.io/civicsmith/file-scanner-scanner', 'docker.io/civicsmith/file-scanner-renderer']);
  for (const r of references(m)) assert.match(r, RULE, 'the digest the release published, 64 hex');
  assert.equal(new Set(m.containers.map((c) => c.image.digest)).size, 2, 'each image its own digest');
  assert.deepEqual(wrangler().containers.map((c) => c.image), references(m), 'the same reference in the configuration');
  // No other registry names an image: every image reference in the marker and the configuration is under the rule's
  // namespace (the Dockerfiles' base, pinned by digest, is the base's own coordinate and names neither image).
  const named = [...m.containers.map((c) => c.image.repository), ...wrangler().containers.map((c) => c.image)];
  assert.deepEqual(named.filter((r) => !r.startsWith('docker.io/civicsmith/')), []);
  for (const t of [text('fleet-member.json'), text('wrangler.jsonc'), text('Dockerfile.scanner'), text('Dockerfile.renderer')]) {
    assert.ok(!/ghcr\.io|registry\.cloudflare\.com|UNPUBLISHED/.test(t), 'no other registry and no unpublished placeholder');
  }
});

test('R10 an instance runs each image copied by its digest: the release describes each class by exactly that docker.io reference, never a tag', () => {
  const member = discoverMembers().find((x) => x.name === 'file-scanner');
  const parts = containerParts(member, discoverMembers().map((x) => x.name));
  assert.equal(parts.conflict ?? null, null);
  assert.deepEqual(parts.parts.map((p) => [p.class_name, p.descriptor.image]),
    marker().containers.map((c, i) => [c.class_name, references(marker())[i]]), 'the part names the image the copy pulls, by digest');
  for (const p of parts.parts) assert.match(p.descriptor.image, RULE);
});

test('R10 the configuration: the classes by class_name with the marker\'s images, their bindings, the bucket, the trigger, no VPC binding by default', () => {
  const w = wrangler();
  const m = marker();
  assert.equal(w.name, 'file-scanner');
  assert.equal(w.main, m.bundle.outfile);
  assert.equal(w.vars.VERSION, pkg.version);
  assert.deepEqual(w.containers.map((c) => c.class_name), m.containers.map((c) => c.class_name));
  for (const c of w.containers) {
    const k = m.containers.find((x) => x.class_name === c.class_name);
    assert.equal(c.image, `${k.image.repository}@${k.image.digest}`);
    assert.equal(c.instance_type, k.instance_type);
    assert.equal(c.max_instances, k.max_instances);
  }
  assert.deepEqual(w.durable_objects.bindings, [{ name: 'SCANNER', class_name: 'FileScanner' }, { name: 'RENDERER', class_name: 'SafeViewRenderer' }]);
  assert.deepEqual(w.r2_buckets.map((b) => b.binding), ['CAPTURES']);
  assert.ok(!('vpc_services' in w) && !JSON.stringify(w).includes('"SECURITY_VPC"'), 'SECURITY_VPC absent by default');
  assert.equal(w.workers_dev, false);
});

test('R11 the only storage writes are under clamav/ and reputation/: one write and one delete in the sources, both guarded', async () => {
  const calls = [];
  for (const [f, src] of [...sources('src'), ...sources('container')]) {
    for (const m of src.matchAll(/\.(put|delete|copy|rename|createMultipartUpload)\(/g)) calls.push(`${f}:${m[1]}:${src.slice(0, m.index).split('\n').length}`);
  }
  const allowed = calls.filter((c) => c.startsWith('src/store.mjs:put') || c.startsWith('src/store.mjs:delete'));
  assert.equal(allowed.length, 2, `the guarded write and delete: ${calls}`);
  const others = calls.filter((c) => !allowed.includes(c));
  // The container's own `rm`/`rename` work on its temporary copies, never the bucket; any other storage call fails.
  assert.deepEqual(others.filter((c) => !c.startsWith('container/')), [], 'no other storage call in the Worker\'s sources');
  const bucket = memoryBucket();
  for (const key of ['bio/captures/' + 'a'.repeat(64), 'scratch/captures/x', 'clamav/../bio/captures/x', 'other/x', 'reputation/../x']) {
    await assert.rejects(writeObject(bucket, key, 'x'), /never writes/);
    await assert.rejects(deleteObject(bucket, key), /never deletes/);
  }
  assert.deepEqual(bucket.calls, []);
});

test('R12 the sources\' egress: the mirror\'s host alone in the Worker\'s own fetches, the outside tools only through the guarded network', () => {
  const worker = sources('src');
  for (const [f, src] of worker) {
    for (const m of src.matchAll(/\bfetch\(/g)) {
      const line = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
      if (/^\s*(async\s+)?fetch\(/.test(line)) continue; // a handler's definition, not a call
      assert.ok(/via\(|\.fetch\(new Request\(`http:\/\/container|fetch: \(req\) => fetch\(req\)|deps\.fetch\(req\)|vpc\.fetch\(req\)|ns\.get/.test(line), `${f}: ${line.trim()}`);
    }
    assert.ok(!/\bconnect\(\s*\{/.test(src) || f === 'src/providers/net.mjs', `${f} opens a socket only through net.mjs`);
  }
  const containers = sources('container').map(([, s]) => s).join('\n');
  assert.ok(!/\bfetch\(|\bconnect\(|node:net|node:https'|node:tls|node:dgram|\brequest\(/.test(containers), 'the images\' servers open no connection');
});

test('R15 the namespace set is exactly ["bio", "scratch"], frozen, with PLANE_OPS empty', async () => {
  assert.deepEqual(limits.NAMESPACES, ['bio', 'scratch']);
  assert.ok(Object.isFrozen(limits.NAMESPACES));
  assert.deepEqual(limits.PLANE_OPS, []);
  assert.ok(Object.isFrozen(limits.PLANE_OPS));
  for (const store of ['bio', 'scratch']) {
    const r = await handle(post('/scan', { store, targets: [{ capture_sha: 'x' }] }), depsWith());
    assert.equal(r.status, 200, store);
  }
});

test('R16 the limits, by name; the bundle states the Worker\'s own limits once, equal to its configuration', async () => {
  assert.deepEqual([limits.SCAN_MAX_BYTES, limits.SCAN_BATCH_MAX, limits.SIGNATURES_MAX_AGE_MS, limits.SAFE_VIEW_DPI, limits.SAFE_VIEW_PAGES_MAX,
    limits.SAFE_VIEW_BYTES_MAX, limits.PROVIDER_TIMEOUT_MS, limits.SANDBOX_TIMEOUT_MS, limits.REPUTATION_LIST_MAX_AGE_MS],
  [268_435_456, 200, 259_200_000, 150, 500, 33_554_432, 120_000, 3_600_000, 86_400_000]);
  assert.deepEqual(limits.LOG_COUNT_KINDS, ['files_scanned', 'files_found', 'holds_placed', 'holds_released', 'deeper_checks', 'sandbox_submissions',
    'safe_views', 'safe_copies', 'reputation_listed', 'signin', 'credential', 'rate', 'handover', 'through']);
  assert.ok(Object.isFrozen(limits.LOG_COUNT_KINDS));
  assert.ok(limits.SCAN_TIME_MS > 0 && limits.RENDER_TIME_MS > 0, 'the measured time budgets');
  assert.deepEqual(limits.MEMBER_LIMITS, wrangler().limits);
  const stated = `bio-member-limits/1 ${Object.entries(wrangler().limits).sort().map(([k, v]) => `${k}=${v}`).join(' ')}`;
  assert.equal(limits.MEMBER_LIMITS_STATEMENT, stated);
  const bundle = text(marker().bundle.outfile);
  assert.deepEqual([...new Set([...bundle.matchAll(/(["'`])bio-member-limits\/1( [^"'`\\\n]*)\1/g)].map((m) => m[2]))], [stated.slice('bio-member-limits/1'.length)]);
  const mod = await loadWorker();
  assert.equal(mod.default.limits, stated);
  const v = await (await handle(new Request('https://file-scanner/version'), depsWith())).json();
  assert.deepEqual(v.bounds.SCAN_MAX_BYTES, { value: limits.SCAN_MAX_BYTES, source: 'alpha' });
});

// R18's one exemption (as agent-runner's, K1905): the images' registry address is a distribution coordinate, not a
// place the product states.
const PLACE = /oakland|alameda|california|\bbay area\b/i;
test('R18 no place is named in its behaviour, outward text or configuration; the registry address alone is exempt', async () => {
  const m = marker();
  const repos = m.containers.map((c) => c.image.repository);
  const scrub = (s) => repos.reduce((t, r) => t.split(r).join('<repository>'), s);
  const texts = [scrub(JSON.stringify(m)), scrub(text('wrangler.jsonc')), text('package.json'), text('packages-scanner.json'), text('packages-renderer.json'),
    text('Dockerfile.scanner'), text('Dockerfile.renderer'), ...sources('src').map(([, s]) => s), ...sources('container').map(([, s]) => s)];
  const deps = depsWith();
  for (const r of [new Request('https://file-scanner/version'), new Request('https://file-scanner/providers'), post('/scan', {}), post('/render', {}),
    post('/provider/scan', { store: 'bio' }), post('/provider/forward', {}), new Request('https://file-scanner/x')]) {
    texts.push(await (await handle(r, deps)).text());
  }
  assert.deepEqual(texts.filter((t) => PLACE.test(t)).map((t) => t.match(PLACE)[0]), []);
  assert.ok(PROVIDERS.length > 0);
});
