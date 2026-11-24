import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readManifest, imageReference } from '../src/manifest.mjs';
import { parseJsonc } from '../../bio-plane/scripts/jsonc.mjs';
import { containerDescriptor, discoverMembers, isGuarded } from '../../bio-plane/scripts/fleet-bundle.mjs';
import { installRuntime, loadWorker, fakeCtx } from './stubs/runtime.mjs';
import { stubSdk, success, startRunner } from './helpers.mjs';

// R35 (N1197, K3611): the class answers every request 410 and passes nothing to its container, so the tests that drive
// its `fetch` are suspended, not deleted; they run again when R35 is lifted.
const SUSPENDED = { skip: 'suspended while R35 holds: the class answers 410 and passes nothing to its container' };

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const wrangler = () => parseJsonc(read('../wrangler.jsonc'), 'wrangler.jsonc');
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const UNPUBLISHED = 'UNPUBLISHED';

test('R13 the wrangler configuration declares the container: class, binding, migration, max_instances, image by digest', () => {
  const w = wrangler(), m = readManifest();
  assert.equal(w.name, 'agent-runner');
  assert.equal(w.account_id, '20b533579290b9b93168345edd3b7f72');
  assert.equal(w.main, m.bundle.outfile, 'the guarded bundle of the Worker deploys');
  assert.equal(w.containers.length, 1);
  const c = w.containers[0];
  assert.equal(c.class_name, 'AgentRunner');
  assert.ok(Number.isInteger(c.max_instances) && c.max_instances >= 1);
  assert.deepEqual(w.durable_objects.bindings, [{ name: 'AGENT_RUNNER', class_name: 'AgentRunner' }]);
  assert.ok(w.migrations.some((g) => (g.new_sqlite_classes || []).includes('AgentRunner')), 'a SQLite-backed class migration');
  // the image is named only as <repository>@sha256:<64 hex>, the marker's digest; UNPUBLISHED until the release writes it
  const at = c.image.lastIndexOf('@');
  assert.ok(at > 0, 'named by digest, never by tag');
  assert.equal(c.image.slice(0, at), m.image.repository);
  const digest = c.image.slice(at + 1);
  if (m.image.digest === null) assert.equal(digest, `sha256:${UNPUBLISHED}`);
  else { assert.match(digest, DIGEST); assert.equal(c.image, imageReference(m)); }
});

test('R13 the image\'s base is pinned by digest', () => {
  const froms = read('../Dockerfile').split('\n').filter((l) => /^FROM\s/i.test(l));
  assert.ok(froms.length >= 1);
  for (const f of froms) assert.match(f, /^FROM\s+\S+@sha256:[0-9a-f]{64}(\s|$)/, f);
});

test('R13 R10 the egress, the model API and the sign-in\'s host only, is declared in the member\'s own configuration and applied by its class', SUSPENDED, async () => {
  assert.deepEqual(readManifest().egress, ['api.anthropic.com', 'platform.claude.com']);
  // the image trusts the CA through which HTTPS egress is applied, and passes it to the query (runner R2's env)
  assert.match(read('../Dockerfile'), /NODE_EXTRA_CA_CERTS=\/etc\/cloudflare\/certs\/cloudflare-containers-ca\.crt/);
  const restore = installRuntime();
  const { sdk } = stubSdk(async () => success());
  const image = await startRunner(sdk);
  const fetch0 = globalThis.fetch;
  try {
    const mod = await loadWorker();
    const ctx = fakeCtx(image.base);
    await new mod.AgentRunner(ctx, {}).fetch(new Request('https://agent-runner/version'));
    const [start] = ctx.seen.starts;
    assert.equal(start.enableInternet, false, 'no internet but the allowed hosts');
    const https = ctx.seen.intercepts.filter((i) => i.scheme === 'https');
    const http = ctx.seen.intercepts.filter((i) => i.scheme === 'http');
    assert.ok(https.some((i) => i.host === '*'), 'all HTTPS goes through the outbound proxy');
    assert.ok(http.some((i) => i.host === '*'), 'all HTTP goes through the outbound proxy');
    for (const i of ctx.seen.intercepts) {
      assert.deepEqual(i.props.allowedHosts, ['api.anthropic.com', 'platform.claude.com']);
      assert.equal(i.props.enableInternet, false);
    }
    // the proxy with those props: the model API and the sign-in's token host pass, anything else is refused
    const passed = [];
    globalThis.fetch = async (req) => { passed.push(new URL(req.url).hostname); return new Response('{}', { status: 200 }); };
    const proxy = new mod.ContainerProxy({ props: https[0].props }, {});
    for (const url of ['https://api.anthropic.com/v1/messages', 'http://api.anthropic.com/', 'https://platform.claude.com/v1/oauth/token']) {
      assert.equal((await proxy.fetch(new Request(url, { method: 'POST' }))).status, 200, url);
    }
    for (const url of ['https://example.com/', 'https://statsig.anthropic.com/', 'http://169.254.169.254/latest', 'https://api.anthropic.com.evil.test/',
      'https://claude.ai/', 'https://claude.com/cai/oauth/authorize', 'https://x.platform.claude.com/', 'https://mcp-proxy.anthropic.com/']) {
      assert.equal((await proxy.fetch(new Request(url))).status, 520, url);
    }
    assert.deepEqual(passed, ['api.anthropic.com', 'api.anthropic.com', 'platform.claude.com']);
  } finally { globalThis.fetch = fetch0; restore(); await image.stop(); }
});

// While R35 holds the container never starts, so the egress is read from what the class declares for its start, and
// the library's proxy is given those same props.
test('R13 R10 the class declares the egress, the model API and the sign-in\'s host only, from the member\'s own configuration', async () => {
  const egress = ['api.anthropic.com', 'platform.claude.com'];
  assert.deepEqual(readManifest().egress, egress);
  assert.match(read('../Dockerfile'), /NODE_EXTRA_CA_CERTS=\/etc\/cloudflare\/certs\/cloudflare-containers-ca\.crt/);
  const restore = installRuntime();
  const fetch0 = globalThis.fetch;
  try {
    const mod = await loadWorker();
    const runner = new mod.AgentRunner(fakeCtx('127.0.0.1:9'), {});
    assert.deepEqual(runner.allowedHosts, egress);
    assert.equal(runner.enableInternet, false, 'no internet but the allowed hosts');
    assert.equal(runner.interceptHttps, true, 'all HTTPS goes through the outbound proxy');
    assert.deepEqual(Object.keys(mod.AgentRunner.outboundByHost).sort(), [...egress].sort(), 'one handler per egress host');
    const passed = [];
    globalThis.fetch = async (req) => { passed.push(new URL(req.url).hostname); return new Response('{}', { status: 200 }); };
    const proxy = new mod.ContainerProxy({ props: { allowedHosts: runner.allowedHosts, enableInternet: runner.enableInternet, interceptAll: true } }, {});
    for (const url of ['https://api.anthropic.com/v1/messages', 'https://platform.claude.com/v1/oauth/token'])
      assert.equal((await proxy.fetch(new Request(url, { method: 'POST' }))).status, 200, url);
    for (const url of ['https://example.com/', 'https://claude.ai/', 'https://api.anthropic.com.evil.test/', 'http://169.254.169.254/latest'])
      assert.equal((await proxy.fetch(new Request(url))).status, 520, url);
    assert.deepEqual(passed, ['api.anthropic.com', 'platform.claude.com']);
  } finally { globalThis.fetch = fetch0; restore(); }
});

test('R14 the marker states kind, image, bundle, class_name, max_instances, bind and image.digest for bundler', () => {
  const m = readManifest();
  assert.equal(m.kind, 'container');
  assert.equal(typeof m.image, 'object');
  assert.ok(m.image.digest === null || DIGEST.test(m.image.digest), 'sha256:<64 lowercase hex>, or null until the release');
  assert.equal(m.class_name, 'AgentRunner');
  assert.equal(m.max_instances, wrangler().containers[0].max_instances, 'one figure in the marker and the config');
  assert.deepEqual(m.bind, [{ member: 'agent-worker', binding: 'RUNNER' }]);
  assert.equal(m.bundle.entry, 'src/worker.mjs');
  // bundler lists it and guards its Worker (its R24)
  const listed = discoverMembers().find((x) => x.name === 'agent-runner');
  assert.equal(listed.kind, 'container');
  assert.ok(isGuarded(listed));
  // its container.json part (bundler R25): refused by name until the digest is written, then built from these fields
  const names = discoverMembers().map((x) => x.name);
  if (m.image.digest === null) assert.deepEqual(containerDescriptor(listed, names), { missing: ['image.digest'] });
  const withDigest = { ...listed, marker: { ...m, image: { ...m.image, digest: 'sha256:' + 'c'.repeat(64) } } };
  assert.deepEqual(containerDescriptor(withDigest, names).descriptor, {
    class_name: 'AgentRunner', image: `${m.image.repository}@sha256:${'c'.repeat(64)}`, scheduling_policy: 'default',
    max_instances: m.max_instances, bind: [{ member: 'agent-worker', binding: 'RUNNER' }],
  });
});

test('R33 the container runs at Cloudflare\'s instance type standard-1, declared in its deploy configuration; its max_instances and image are unchanged', () => {
  const c = wrangler().containers[0];
  assert.equal(c.instance_type, 'standard-1');
  // control: the figures the container had before R33
  assert.equal(c.max_instances, 10);
  assert.equal(c.image, imageReference(readManifest()), 'the image is the manifest\'s digest-pinned reference, whichever release wrote it');
});
