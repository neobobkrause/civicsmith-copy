/* The fleet member as deployed (K5637): the committed bundle loaded under Node, its marker, configuration and package
 * statement. R8: the Worker passes each request through to the class and keeps nothing (no bucket, no store, no
 * internet for the container); a route the image does not answer is 404 here. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadWorker } from './workers-runtime.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';
import { discoverMembers, classPackages, containerClasses, containerSourceHash, containerImageStates } from '../../bio-plane/scripts/fleet-bundle.mjs';

const here = (p) => new URL(`../${p}`, import.meta.url);
const text = (p) => readFileSync(here(p), 'utf8');
const marker = JSON.parse(text('fleet-member.json'));
const wrangler = parseJsonc(text('wrangler.jsonc'), 'wrangler.jsonc');

/* the class's namespace as the runtime binds it: each instance answers with its own name, and records what reached it */
function namespace() {
  const reached = [];
  return {
    reached,
    idFromName: (name) => ({ name }),
    get: (id) => ({ fetch: async (request) => { reached.push([id.name, request.method, new URL(request.url).pathname]); return new Response(id.name); } }),
  };
}

test('R8 the Worker passes each of the image\'s working routes through to one of the class\'s instances, unchanged', async () => {
  const worker = (await loadWorker()).default;
  const ns = namespace();
  for (const [method, path] of [['POST', '/convert'], ['POST', '/frames'], ['POST', '/archive']]) {
    const r = await worker.fetch(new Request(`https://reader-container${path}?kind=x`, { method, body: method === 'POST' ? 'b' : undefined }), { READER: ns });
    assert.equal(r.status, 200, `${method} ${path}`);
    assert.match(await r.text(), new RegExp(`^reader-[0-${marker.max_instances - 1}]$`));
  }
  assert.deepEqual(ns.reached.map(([, m, p]) => `${m} ${p}`), ['POST /convert', 'POST /frames', 'POST /archive']);
});

test('F1 GET /version answers the deployed VERSION from the Worker itself, waking no instance, so the rollout check reads it at once', async () => {
  const worker = (await loadWorker()).default;
  const ns = namespace();
  const r = await worker.fetch(new Request('https://reader-container/version'), { READER: ns, VERSION: wrangler.vars.VERSION });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.version, wrangler.vars.VERSION, 'the version the rollout check waits for');
  assert.deepEqual([body.ok, body.name, body.image], [true, marker.name, marker.image.digest]);
  const pk = JSON.parse(text('packages.json'));
  for (const p of pk.packages) assert.equal(body.tools[p.name], p.version, p.name);
  assert.equal(ns.reached.length, 0, 'no instance was woken');
  const unbound = await worker.fetch(new Request('https://reader-container/version'), { VERSION: '9.9.9' });
  assert.deepEqual([unbound.status, (await unbound.json()).version], [200, '9.9.9'], 'answered even with no class bound');
});

test('R8 any other method or path is 404 UNKNOWN, and with no class bound the answer is a stated 503, never a throw', async () => {
  const worker = (await loadWorker()).default;
  const ns = namespace();
  for (const [method, path] of [['GET', '/'], ['GET', '/convert'], ['POST', '/version'], ['PUT', '/archive'], ['POST', '/__proto__']]) {
    const r = await worker.fetch(new Request(`https://reader-container${path}`, { method }), { READER: ns });
    assert.deepEqual([r.status, await r.json()], [404, { ok: false, code: 'UNKNOWN' }], `${method} ${path}`);
  }
  assert.equal(ns.reached.length, 0);
  const none = await worker.fetch(new Request('https://reader-container/frames', { method: 'POST', body: 'b' }), {});
  assert.deepEqual([none.status, (await none.json()).code], [503, 'UNREACHABLE']);
});

test('R8 R2 the class has no internet; the configuration binds no bucket, no store and no public address', async () => {
  const mod = await loadWorker();
  assert.deepEqual(Object.keys(mod).sort(), ['ContainerProxy', 'ReaderContainer', 'default', 'instanceOf']);
  const ctx = { storage: { kv: { get() {}, put() {} }, sql: { exec: () => [] }, get: async () => undefined, put: async () => {}, setAlarm: async () => {}, getAlarm: async () => null, deleteAlarm: async () => {}, sync: async () => {} },
    blockConcurrencyWhile: async (f) => f(), container: { running: false, start() {}, monitor: () => new Promise(() => {}), getTcpPort: () => ({ fetch: async () => new Response('') }) },
    id: { toString: () => 'x' }, waitUntil() {}, exports: {} };
  const c = new mod.ReaderContainer(ctx, {});
  assert.deepEqual([c.enableInternet, c.defaultPort], [false, marker.image.port]);
  c.containerFetch = async () => new Response('');
  await c.fetch(new Request('http://container/convert?kind=doc&to=docx', { method: 'POST', body: 'b' }));
  assert.equal(c.enableInternet, false, 'serving a request it still has none');
  assert.ok(!c.allowedHosts || c.allowedHosts.length === 0, 'it allows no host');
  assert.equal(mod.default.limits, `bio-member-limits/1 cpu_ms=${wrangler.limits.cpu_ms}`, 'the bundle states the configuration\'s limits');
  assert.equal(marker.egress.length, 0);
  assert.equal(wrangler.account_id, '20b533579290b9b93168345edd3b7f72');
  assert.deepEqual([wrangler.workers_dev, wrangler.preview_urls, wrangler.observability.enabled], [false, false, true]);
  for (const key of ['r2_buckets', 'kv_namespaces', 'd1_databases', 'services', 'routes', 'triggers']) assert.equal(key in wrangler, false, key);
  assert.deepEqual(wrangler.durable_objects.bindings, [{ name: 'READER', class_name: 'ReaderContainer' }]);
  assert.deepEqual(wrangler.migrations, [{ tag: 'v1', new_sqlite_classes: ['ReaderContainer'] }]);
});

test('R8 the member is discovered by its marker; its class, image, binding and package statement are what the bundler reads', () => {
  const member = discoverMembers().find((m) => m.name === 'reader-container');
  assert.ok(member, 'discovered');
  const { classes, multi } = containerClasses(member);
  assert.equal(multi, false);
  assert.deepEqual([classes[0].class_name, classes[0].max_instances, classes[0].bind], ['ReaderContainer', 3, [{ member: 'reader-container', binding: 'READER' }]]);
  assert.equal(wrangler.containers[0].class_name, 'ReaderContainer');
  assert.equal(wrangler.containers[0].image.split('@')[0], marker.image.repository);
  assert.equal(wrangler.containers[0].image, `${marker.image.repository}@${marker.image.digest}`, 'both files name the one published image');
  assert.deepEqual(containerImageStates(member).map((c) => [c.class_name, c.state]), [['ReaderContainer', 'current']], 'the image was built from the files now here');
  assert.equal(wrangler.containers[0].max_instances, marker.max_instances);
  const pk = classPackages(member, classes[0]);
  assert.equal(pk.unread, undefined, pk.unread);
  assert.equal(pk.ecosystem, 'Debian:12');
  for (const p of pk.packages) assert.ok(typeof p.version === 'string' && p.version.length > 0, p.name);
  assert.ok(text('Dockerfile').startsWith('#') && text('Dockerfile').includes(`FROM node:22-bookworm-slim@${marker.image.base.digest}`), 'the statement\'s base is the Dockerfile\'s');
  for (const p of pk.packages) assert.ok(text('Dockerfile').includes(`${p.name}=${p.version}`), `the Dockerfile installs ${p.name} at the stated version`);
  assert.match(containerSourceHash(member, 'ReaderContainer').sha256 ?? '', /^[0-9a-f]{64}$/, 'the image\'s sources can be hashed');
});
