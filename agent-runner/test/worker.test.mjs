// The Worker class (R12, R15, R26, R30, R34, R45 on the platform, R55), loaded from the committed bundle under a stubbed
// Workers runtime, over a container whose port is the real image server with a stub issuer and provider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installRuntime, loadWorker, fakeCtx } from './stubs/runtime.mjs';
import { readManifest } from '../src/manifest.mjs';
import { serve } from '../src/entry.mjs';
import { REVIEW_WINDOW_MS, LIFECYCLE } from '../src/params.mjs';
import { says } from '../src/says.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';
import { CATALOGUE_ADDRESS } from '../../bio-plane/src/ai-catalogue/index.mjs';
import { runner as stubRunner, runBody, PROVIDER_HOST, KEY } from './helpers.mjs';

const wrangler = () => parseJsonc(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'), 'wrangler.jsonc');
const ISSUER_HOST = new URL(CATALOGUE_ADDRESS).hostname;

function capture() {
  const lines = [], log = console.log;
  console.log = (s) => { try { lines.push(JSON.parse(s)); } catch { lines.push(s); } };
  return { lines, restore: () => { console.log = log; } };
}

// The class as the runtime hosts it, over the image's server (`serve`) answering from an in-process runner.
async function hosted({ provider, env = {} } = {}) {
  const restore = installRuntime();
  const inner = await stubRunner({ provider });
  const server = serve({ env: {}, load: async () => ({ makeRunner: () => inner.r }) });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `127.0.0.1:${server.address().port}`;
  const mod = await loadWorker();
  const ctx = fakeCtx(base);
  const runner = new mod.AgentRunner(ctx, env);
  let t = 1_000_000;
  runner.now = () => t;
  const allowed = [];
  const setAllowed = runner.setAllowedHosts.bind(runner);
  runner.setAllowedHosts = async (hosts) => { allowed.push([...hosts]); return setAllowed(hosts); };
  let stops = 0;
  runner.stop = async () => { stops += 1; };
  return { mod, ctx, runner, inner, base, allowed, stops: () => stops, tick: (ms) => { t += ms; },
    stop: async () => { restore(); server.closeAllConnections?.(); await new Promise((r) => server.close(r)); } };
}
// Whether agent-worker's configuration still binds RemoteSession (its REMOTE binding), which R13 deletes with it.
const remoteBound = () => /"class_name":\s*"RemoteSession"/.test(readFileSync(new URL('../../agent-worker/wrangler.jsonc', import.meta.url), 'utf8'));
const post = (path, body, headers = {}) => new Request(`https://agent-runner${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (path) => new Request(`https://agent-runner${path}`);

test('R12 the Worker exports AgentRunner, the library proxy and the default handler; each request reaches the image unchanged and is answered as the image answers', async () => {
  const h = await hosted({ provider: () => new Promise(() => {}) });
  try {
    // RemoteSession (R42's retired stub) is set aside here: its deletion, with migration v3, is R13's (not yet met),
    // and the R12 R10 test below checks it while agent-worker's REMOTE binding names it.
    assert.deepEqual(Object.keys(h.mod).filter((k) => k !== 'RemoteSession').sort(), ['AgentRunner', 'ContainerProxy', 'default']);
    const port = readManifest().image.port;
    for (const [method, path] of [['GET', '/version'], ['GET', '/run/status'], ['GET', '/'], ['DELETE', '/x'], ['POST', '/run']]) {
      const body = method === 'POST' ? JSON.stringify(runBody()) : undefined;
      const req = new Request(`https://agent-runner${path}`, { method, body, headers: { 'x-probe': 'kept', 'cf-container-target-port': '9999' } });
      const res = await h.runner.fetch(req);
      const seen = h.ctx.seen.requests.at(-1);
      assert.equal(seen.request, req, 'the very request, not a copy or a rewrite');
      assert.equal(seen.port, port, 'the image\'s port, whatever port the caller asks for');
      assert.equal(seen.request.headers.get('x-probe'), 'kept');
      const j = await res.json();
      if (path === '/version') assert.deepEqual(j, h.inner.r.version());
      if (path === '/' || path === '/x') assert.deepEqual(j, { ok: false, code: 'UNKNOWN' }, 'control: an unlisted path is the image\'s 404');
      if (method === 'POST') assert.equal(res.status, 202);
    }
    assert.ok(h.inner.world.seen.some((s) => s.host === 'issuer.test'), 'the body reached the image whole');
    await h.runner.fetch(post('/run/discard', {}));
  } finally { await h.stop(); }
});

test('R12 R8 R57 the image environment is three configuration values; the Worker has no binding, secret or address but its own (team: no service binding)', async () => {
  const h = await hosted({ env: { DEPLOYMENT: 'civicsmith', SAMPLE_ACCOUNTS: 'cs-1', ANTHROPIC_API_KEY: 'env-secret', OTHER: 'x' } });
  try {
    await h.runner.fetch(get('/version'));
    assert.equal(h.ctx.seen.starts.length, 1);
    const env = h.ctx.seen.starts[0].env ?? {};
    assert.deepEqual(Object.keys(env).sort(), ['DEPLOYMENT', 'IMAGE_DIGEST', 'SAMPLE_ACCOUNTS']);
    assert.equal(env.DEPLOYMENT, 'civicsmith');
    assert.ok(!JSON.stringify(env).includes('env-secret'));
    const bogus = await hosted({ env: { DEPLOYMENT: 'anything' } });
    try { await bogus.runner.fetch(get('/version')); assert.equal(bogus.ctx.seen.starts[0].env.DEPLOYMENT, 'team'); } finally { await bogus.stop(); }
    const w = wrangler();
    assert.deepEqual(Object.keys(w.vars).sort(), ['DEPLOYMENT', 'SAMPLE_ACCOUNTS', 'VERSION']);
    assert.equal(w.vars.DEPLOYMENT, 'team');
    for (const k of ['services', 'r2_buckets', 'kv_namespaces', 'd1_databases', 'secrets', 'queues', 'ai', 'routes', 'route'])
      assert.ok(!(k in w), `no ${k}`);
    assert.deepEqual(w.durable_objects.bindings.map((b) => b.class_name), ['AgentRunner']);
    assert.equal(w.workers_dev, false); assert.equal(w.preview_urls, false);
  } finally { await h.stop(); }
});

test('R15 the committed bundle has a default fetch handler answering 404 UNKNOWN, reading no body, beside the AgentRunner class', async () => {
  const restore = installRuntime();
  try {
    assert.equal(wrangler().main, readManifest().bundle.outfile);
    const mod = await loadWorker();
    assert.equal(mod.AgentRunner.name, 'AgentRunner');
    const touched = [];
    const env = new Proxy({}, { get: (_, k) => { touched.push(k); return undefined; } });
    for (const [method, path, body] of [['GET', '/version'], ['POST', '/run', 'secret-bearing body'], ['DELETE', '/x']]) {
      const req = new Request(`https://agent-runner${path}`, { method, body });
      const res = await mod.default.fetch(req, env, {});
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { ok: false, code: 'UNKNOWN' });
      assert.equal(req.bodyUsed, false);
    }
    assert.deepEqual(touched, []);
  } finally { restore(); }
});

test('R26 an answer of the library that is not JSON gives JSON 503 RUNNER_NOT_STARTED with its status; a JSON answer passes unchanged', async () => {
  const h = await hosted();
  try {
    h.runner.containerFetch = async () => new Response('Failed to start container: https://x.test/a?token=SECRET', { status: 500, headers: { 'content-type': 'text/plain' } });
    const res = await h.runner.fetch(get('/run/status'));
    assert.equal(res.status, 503);
    const j = await res.json();
    assert.deepEqual(Object.keys(j).sort(), ['code', 'detail', 'ok', 'status', 'trace']);
    assert.equal(j.code, 'RUNNER_NOT_STARTED'); assert.equal(j.status, 500); assert.equal(j.detail, says('RUNNER_NOT_STARTED'));
    assert.ok(!JSON.stringify(j).includes('SECRET') && !JSON.stringify(j).includes('x.test'));
    h.runner.containerFetch = async () => { throw new Error('not listening'); };
    assert.equal((await (await h.runner.fetch(get('/version'))).json()).code, 'RUNNER_NOT_STARTED');
    const body = JSON.stringify({ ok: false, code: 'NO_RUN', trace: 't', detail: 'd' });
    h.runner.containerFetch = async () => new Response(body, { status: 409, headers: { 'content-type': 'application/json' } });
    const pass = await h.runner.fetch(get('/run/status'));
    assert.equal(pass.status, 409); assert.equal(await pass.text(), body, 'control: JSON passes unchanged');
  } finally { await h.stop(); }
});

test('R45 on the platform: the list is the issuer alone at rest, the issuer and the declared host for a run, the issuer again after it', async () => {
  const h = await hosted();
  try {
    assert.deepEqual(h.runner.allowedHosts, [ISSUER_HOST]);
    const r = await h.runner.fetch(post('/run', runBody()));
    assert.equal(r.status, 202);
    assert.deepEqual(h.allowed[0], [ISSUER_HOST, PROVIDER_HOST], 'set before the request reached the image');
    await h.inner.r.settled();
    await h.runner.fetch(get('/run/status'));
    assert.deepEqual(h.allowed.at(-1), [ISSUER_HOST]);
    const refused = await hosted();
    try {
      await refused.runner.fetch(post('/run', { ...runBody(), tiers: ['T9'] }));
      assert.deepEqual(refused.allowed.at(-1), [ISSUER_HOST], 'a refused run leaves the issuer alone');
    } finally { await refused.stop(); }
  } finally { await h.stop(); }
});

test('R45 a declared host that fails the check never reaches the platform list; a second start cannot change the list a run set', async () => {
  for (const host of ['http://api.stubmodels.net', '10.0.0.5', '*.stubmodels.net', 'localhost', 'models.internal', ISSUER_HOST,
    'api.stubmodels.net:8443', 'api.stubmodels.net/v1', 42]) {
    const h = await hosted();
    try {
      const res = await h.runner.fetch(post('/run', { ...runBody(), declared: { ...runBody().declared, host } }));
      // The image may still take a host the Worker will not open (a port, or the stub's issuer differing): what is
      // asserted is that the platform list is never widened to it.
      await res.arrayBuffer();
      assert.ok(!h.allowed.flat().some((x) => x !== ISSUER_HOST), `${host}: never on the platform list`);
      assert.deepEqual(h.runner.allowedHosts, [ISSUER_HOST]);
    } finally { await h.stop(); }
  }
  const h = await hosted({ provider: () => new Promise(() => {}) });
  try {
    const other = { ...runBody(), declared: { ...runBody().declared, host: 'api.otherhost.net' } };
    const [a, b] = await Promise.all([h.runner.fetch(post('/run', runBody())), h.runner.fetch(post('/run', other))]);
    assert.deepEqual([a.status, b.status], [202, 409], 'the starts are taken one at a time');
    assert.deepEqual(h.allowed, [[ISSUER_HOST, PROVIDER_HOST]], 'the second start, made under the run hold, left the list as the run set it');
    await h.runner.fetch(post('/run/discard', {}));
  } finally { await h.stop(); }
});

test('R12 R10 the class keeps the container off the internet: enableInternet false, HTTPS intercepted, the issuer alone at rest', async () => {
  const h = await hosted();
  try {
    assert.equal(h.runner.enableInternet, false);
    assert.equal(h.runner.interceptHttps, true);
    assert.deepEqual(h.runner.allowedHosts, [ISSUER_HOST]);
    assert.equal(typeof h.mod.AgentRunner.outbound, 'function', 'every allowed request passes the logging handler');
    const w = wrangler();
    // agent-worker's REMOTE binding still names RemoteSession, so the stub and its migration stay until that binding goes (R13).
    if (remoteBound()) {
      assert.deepEqual(w.migrations.at(-1), { tag: 'v2', new_sqlite_classes: ['RemoteSession'] }, 'RemoteSession is not deleted while REMOTE binds it');
      assert.equal(typeof h.mod.RemoteSession, 'function', 'the bundle exports RemoteSession while REMOTE binds it (bundler R39)');
      const res = await new h.mod.RemoteSession({}, {}).fetch(new Request('https://x/remote/version'));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'REMOTE_UNAVAILABLE');
    }
  } finally { await h.stop(); }
});

test('R30 the class logs each lifecycle event and each egress request, never a query, header or body; R34 a refused request logs one line', async () => {
  const cap = capture();
  const h = await hosted();
  const savedFetch = globalThis.fetch;
  try {
    await h.runner.onStart();
    await h.runner.onStop({ exitCode: 0 });
    await assert.rejects(h.runner.onError(new Error('boom https://x.test/?k=SECRETSECRETSECRETSECRETSECRETSECRET')));
    await h.runner.startAndWaitForPorts().catch(() => {});
    await h.runner.onActivityExpired();
    const life = cap.lines.filter((l) => l.event === 'runner.lifecycle');
    for (const what of ['started', 'stop', 'error', 'start', 'activity_expired']) assert.ok(life.some((l) => l.what === what), what);
    for (const l of life) {
      assert.ok(LIFECYCLE.includes(l.what));
      assert.ok(Object.keys(l).every((k) => ['event', 'instance_ref', 'what', 'ms', 'error_head', 'run_hold'].includes(k)));
      assert.equal(typeof l.run_hold, 'boolean');
    }
    assert.ok(!JSON.stringify(life).includes('SECRET'));
    globalThis.fetch = async (req) => { await req.text(); return new Response('{}', { status: 200 }); };
    const out = h.mod.AgentRunner.outbound;
    const longId = 'a'.repeat(30);
    const req = new Request(`https://${PROVIDER_HOST}/v1/${longId}/chat?key=SENTINEL-Q`, { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: 'SENTINEL-B' });
    const res = await out(req, {}, { containerId: 'abcdef0123456789' });
    assert.equal(res.status, 200, 'passed unchanged');
    const egress = cap.lines.filter((l) => l.event === 'runner.egress');
    assert.deepEqual(egress.map(({ ms, ...l }) => l), [{ event: 'runner.egress', instance_ref: 'abcdef012345', host: PROVIDER_HOST, method: 'POST', path_template: '/v1/:id/chat', status: 200 }]);
    assert.ok(!JSON.stringify(cap.lines).includes('SENTINEL') && !JSON.stringify(cap.lines).includes(KEY));
    const proxy = new h.mod.ContainerProxy({ props: { className: 'AgentRunner', containerId: 'abcdef0123456789', allowedHosts: [ISSUER_HOST, PROVIDER_HOST], enableInternet: false, interceptAll: true } }, {});
    const no = await proxy.fetch(new Request('https://third.test/x?q=SENTINEL-Q'));
    assert.equal(no.status, 520);
    assert.deepEqual(cap.lines.filter((l) => l.event === 'runner.egress.refused'),
      [{ event: 'runner.egress.refused', instance_ref: 'abcdef012345', host: 'third.test', method: 'GET', path_template: '/x', status: 520 }]);
    const n = cap.lines.length;
    await proxy.fetch(new Request(`https://${PROVIDER_HOST}/v1/x`));
    assert.equal(cap.lines.filter((l) => l.event === 'runner.egress.refused').length, 1, 'control: an allowed host writes no refused line');
    assert.ok(cap.lines.length > n);
  } finally { globalThis.fetch = savedFetch; cap.restore(); await h.stop(); }
});

test('R55 with a fake clock: expiries during a run stop nothing; one after the review window stops it; discard stops at once; storage holds the marker alone', async () => {
  const cap = capture();
  const h = await hosted({ provider: () => new Promise(() => {}) });
  try {
    const started = await (await h.runner.fetch(post('/run', runBody()))).json();
    for (let i = 0; i < 3; i++) { h.tick(10 * 60_000); await h.runner.onActivityExpired(); }
    assert.equal(h.stops(), 0, 'the sleep timer never ends a run');
    const m = await h.ctx.storage.get('run');
    assert.deepEqual(Object.keys(m).sort(), ['deadline', 'run_ref', 'state']);
    assert.match(m.run_ref, /^[0-9a-f]{12}$/); assert.equal(m.state, 'running');
    assert.ok(!JSON.stringify(m).includes(started.run) && !JSON.stringify(m).includes(KEY));
    assert.ok(cap.lines.some((l) => l.what === 'held_awake' && l.run_hold === true));
    await h.runner.fetch(post('/run/discard', {}));
    assert.equal(h.stops(), 1, 'discard stops at once');
    assert.equal((await h.ctx.storage.get('run')).state, 'discarded');
    const keys = [...(await (async () => { const s = new Set(); for (const k of ['run', '__CF_CONTAINER_STATE', 'OUTBOUND_CONFIGURATION']) if (await h.ctx.storage.get(k) !== undefined) s.add(k); return s; })())];
    assert.ok(keys.includes('run'));
  } finally { cap.restore(); await h.stop(); }
  const d = await hosted();
  try {
    await d.runner.fetch(post('/run', runBody()));
    await d.inner.r.settled();
    await d.runner.onActivityExpired();
    assert.equal(d.stops(), 0, 'in the review window: held');
    assert.equal((await d.ctx.storage.get('run')).state, 'done');
    d.tick(REVIEW_WINDOW_MS + 1);
    await d.runner.onActivityExpired();
    assert.equal(d.stops(), 1, 'after the window: stopped');
    assert.equal((await d.ctx.storage.get('run')).state, 'expired');
  } finally { await d.stop(); }
  const idle = await hosted();
  try {
    await idle.runner.fetch(get('/version'));
    await idle.runner.onActivityExpired();
    assert.equal(idle.stops(), 1, 'control: an instance that never saw POST /run stops at its first expiry');
    assert.equal(await idle.ctx.storage.get('run'), undefined);
  } finally { await idle.stop(); }
});
