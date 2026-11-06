// The run (R43–R60, R8, R9, R29), against a stub issuer and a stub provider, in-process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { openSealed, parseBundle, verifyBundle, PUBLIC_BANK, sha256Hex } from '../../ai-gate/src/index.mjs';
import { verifyRunBundle } from '../../bio-plane/src/sshsig.mjs';
import { STEPS } from '../src/params.mjs';
import { says } from '../src/says.mjs';
import { VERSION_KEYS } from '../src/version.mjs';
import { ISSUER, PROVIDER_HOST, KEY, MODEL, world, goodProvider, challengeFor, declared, runBody, runner, finishedRun } from './helpers.mjs';

const PLACE = /oakland|alameda|california|\bbay area\b/i;
const td = new TextDecoder();
const SENTINEL_FORMS = [KEY, encodeURIComponent(KEY), Buffer.from(KEY).toString('base64').replace(/=+$/, '').slice(0, 20)];
const holdsKey = (text) => SENTINEL_FORMS.some((f) => text.includes(f));

async function open(h, bundleBytes) {
  const parts = parseBundle(bundleBytes);
  const plain = await openSealed(parts.payload, h.sealingKey);
  return plain ? JSON.parse(td.decode(plain)) : null;
}
async function takeBundle(h) {
  await h.call('GET', '/run/manifest');
  await h.call('POST', '/run/approve');
  return (await h.call('GET', '/run/bundle')).body;
}

/* ------------------------------------------------------------------ R43 the surface */

test('R43 each route answers its shape; every refusal carries trace and a detail with no place word', async () => {
  const h = await runner();
  const none = await h.call('GET', '/run/status');
  assert.equal(none.status, 409); assert.equal(none.json.code, 'NO_RUN');
  for (const [m, p] of [['GET', '/run/manifest'], ['POST', '/run/approve'], ['GET', '/run/bundle'], ['POST', '/run/discard']]) {
    const r = await h.call(m, p);
    assert.equal(r.status, 409, `${m} ${p}`); assert.equal(r.json.code, 'NO_RUN');
  }
  const s = await h.call('POST', '/run', runBody(), { 'x-civicsmith-trace': 'trace-abc' });
  assert.equal(s.status, 202);
  assert.deepEqual(Object.keys(s.json).sort(), ['ok', 'run', 'state']);
  assert.match(s.json.run, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(s.json.state, 'running');
  const again = await h.call('POST', '/run', runBody());
  assert.equal(again.status, 409); assert.equal(again.json.code, 'RUN_IN_PROGRESS');
  await h.r.settled();
  const st = await h.call('GET', '/run/status');
  assert.deepEqual(Object.keys(st.json).sort(), ['items_done', 'items_total', 'ok', 'state', 'tier']);
  assert.equal(st.json.state, 'done');
  const man = await h.call('GET', '/run/manifest');
  assert.equal(man.status, 200); assert.equal(man.json.schema, 'bio-gate-bundle/1');
  assert.equal((await h.call('GET', '/run/manifest')).status, 200, 'readable repeatedly');
  assert.deepEqual((await h.call('POST', '/run/approve')).json, { ok: true, state: 'approved' });
  const b = await h.call('GET', '/run/bundle');
  assert.equal(b.status, 200); assert.ok(b.body instanceof Uint8Array && b.body.length > 0);
  assert.deepEqual((await h.call('POST', '/run/discard')).json, { ok: true, state: 'discarded' });
  for (const r of [none, again]) {
    assert.deepEqual(Object.keys(r.json).sort(), ['code', 'detail', 'ok', 'trace']);
    assert.equal(r.json.detail, says(r.json.code));
    assert.ok(!PLACE.test(r.json.detail) && !holdsKey(JSON.stringify(r.json)));
  }
  assert.equal(again.json.trace.length > 0, true);
});

test('R43 control: GET /run/bundle before approval answers MANIFEST_NOT_SHOWN with no bytes', async () => {
  const h = await finishedRun();
  const b = await h.call('GET', '/run/bundle');
  assert.equal(b.status, 409); assert.equal(b.json.code, 'MANIFEST_NOT_SHOWN');
  assert.ok(!(b.body instanceof Uint8Array));
});

/* ------------------------------------------------------------------ R44 refusals before anything starts */

test('R44 POST /run refuses each bad request with its code and starts nothing (the stub issuer is not called)', async () => {
  const cases = [
    ['not json', 'BAD_REQUEST'],
    [{ ...runBody(), declared: declared({ host: 'http://api.stubmodels.net' }) }, 'BAD_RUN'],
    [{ ...runBody(), declared: declared({ host: '*.stubmodels.net' }) }, 'BAD_RUN'],
    [{ ...runBody(), declared: declared({ host: 'issuer.test' }) }, 'BAD_RUN'],
    [{ ...runBody(), declared: declared({ host: '10.0.0.5' }) }, 'BAD_RUN'],
    [{ ...runBody(), declared: declared({ host: 'models.internal' }) }, 'BAD_RUN'],
    [{ ...runBody(), tiers: ['T3'] }, 'BAD_RUN'],
    [{ ...runBody(), tiers: [] }, 'BAD_RUN'],
    [{ ...runBody(), ceiling: undefined }, 'CEILING_REQUIRED'],
    [{ ...runBody(), ceiling: { spend: 1, calls: 0, seconds: 5 } }, 'CEILING_REQUIRED'],
    [{ ...runBody(), ceiling: { spend: 1, calls: 5 } }, 'CEILING_REQUIRED'],
    [{ ...runBody(), key: '' }, 'BAD_RUN'],
    [{ ...runBody(), key: 'k'.repeat(5000) }, 'BAD_RUN'],
    [{ ...runBody(), key: 42 }, 'BAD_RUN'],
  ];
  for (const [body, code] of cases) {
    const h = await runner();
    const r = await h.call('POST', '/run', body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80)); assert.equal(r.json.code, code);
    assert.equal(h.world.seen.length, 0, 'nothing reached the issuer or a provider');
    assert.equal(h.r.state, null);
  }
  const ok = await runner();
  assert.equal((await ok.call('POST', '/run', runBody())).status, 202, 'control: a valid request starts');
});

/* ------------------------------------------------------------------ R45, R46 egress */

test('R45 the run list is the issuer and the declared host; a redirect to another host is refused and counted; after the run, the issuer alone', async () => {
  const w = world({ provider: () => new Response(null, { status: 307, headers: { location: 'https://elsewhere.test/v1/chat/completions' } }) });
  const h = await runner({ world: w });
  assert.deepEqual(h.r.egress, ['issuer.test'], 'at rest: the issuer alone');
  await h.call('POST', '/run', runBody());
  const during = h.r.egress;
  await h.r.settled();
  assert.deepEqual(during, ['issuer.test', PROVIDER_HOST]);
  assert.deepEqual(h.r.egress, ['issuer.test'], 'after the run: one name');
  assert.ok(!w.seen.some((s) => s.host === 'elsewhere.test'), 'the redirect target was never reached');
  const refused = h.lines.filter((l) => l.event === 'runner.egress.refused');
  assert.ok(refused.length > 0 && refused.every((l) => l.host === 'elsewhere.test' && l.status === 520));
  const payload = await open(h, await takeBundle(h));
  assert.equal(payload.run.refused_egress, refused.length, 'the run\'s record counts each');
  assert.ok(w.seen.some((s) => s.host === 'issuer.test') && w.seen.some((s) => s.host === PROVIDER_HOST), 'control: both listed hosts reached');
  const calls = w.seen.filter((s) => s.host === PROVIDER_HOST).length;
  assert.equal(w.seen.length, calls + 1, 'a 3xx sends no second request: only the challenge and the provider calls were sent');
  assert.ok(w.seen.every((s) => s.redirect === 'manual'), 'the door follows no redirect itself');
});

test('R46 every outbound request goes through the one door: a scan finds no other network call; an unlisted host is refused before a connection', async () => {
  const src = readdirSync(new URL('../src/', import.meta.url)).filter((f) => f.endsWith('.mjs') && f !== 'worker.mjs');
  for (const f of src) {
    const text = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const calls = text.match(/\bfetch\s*\(|node:(net|tls|https?|dgram|http2)\b|\bWebSocket\b|XMLHttpRequest/g) ?? [];
    if (f === 'door.mjs') assert.deepEqual(calls, ['fetch('], 'the door calls the platform fetch once');
    else if (f === 'entry.mjs') assert.deepEqual(calls, ['node:http'], 'the entry serves; it opens no outbound connection');
    else assert.deepEqual(calls.filter((c) => c !== 'fetch('), [], f);
    if (f !== 'door.mjs') assert.ok(!/globalThis\.fetch\s*\(|(^|[^.\w])fetch\s*\(/m.test(text.replace(/door\.fetch\s*\(/g, '')), `${f} calls fetch only through the door`);
  }
  const { makeDoor, egressList } = await import('../src/door.mjs');
  const reached = [], lines = [];
  const door = makeDoor({ fetchImpl: async (u) => { reached.push(u); return new Response('{}'); }, list: egressList('issuer.test'), log: (l) => lines.push(l) });
  await assert.rejects(door.fetch('https://third.test/x?q=secret'), (e) => e.code === 'EGRESS_REFUSED');
  assert.equal(reached.length, 0, 'refused before a connection');
  assert.deepEqual(lines, [{ event: 'runner.egress.refused', instance_ref: null, host: 'third.test', method: 'GET', path_template: '/x', status: 520 }]);
  await door.fetch('https://issuer.test/ai/challenge');
  assert.equal(reached.length, 1, 'control: the listed host passes');
  assert.ok((await runner()).r.version().capabilities.includes('egress-door'), 'the door says so in capabilities');
});

/* ------------------------------------------------------------------ R8, R9 nothing held, nothing written */

test('R8 the key appears in no output, line or file, a provider credential in the environment is never used, and the provider stub receives the key', async () => {
  const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY'];
  const saved = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  for (const k of envKeys) process.env[k] = `env-SENTINEL-${k}`;
  const before = readdirSync(tmpdir()).sort();
  try {
    const h = await finishedRun();
    const outputs = [JSON.stringify(h.started.json), JSON.stringify(h.lines)];
    for (const [m, p] of [['GET', '/run/status'], ['GET', '/run/manifest'], ['POST', '/run/approve'], ['GET', '/run/bundle'], ['GET', '/version']]) {
      const r = await h.call(m, p);
      outputs.push(r.body instanceof Uint8Array ? td.decode(r.body) : JSON.stringify(r.json));
    }
    for (const o of outputs) assert.ok(!holdsKey(o), 'no answer or line holds the key');
    const provider = h.world.seen.filter((s) => s.host === PROVIDER_HOST);
    assert.ok(provider.length > 0);
    assert.ok(provider.every((s) => s.headers.get('authorization') === `Bearer ${KEY}`), 'control: the provider stub receives the key');
    const sent = JSON.stringify(h.world.seen.map((s) => [s.body, [...s.headers]]));
    for (const k of envKeys) assert.ok(!sent.includes(`env-SENTINEL-${k}`), `${k} from the environment is never sent`);
    assert.ok(!JSON.stringify(h.world.seen.filter((s) => s.host === 'issuer.test').map((s) => [s.body, [...s.headers]])).includes(KEY), 'the issuer never sees the key');
    assert.deepEqual(readdirSync(tmpdir()).sort(), before, 'no file written');
  } finally { for (const k of envKeys) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

test('R9 nothing survives a run: the writable paths are equal before and after a run of each ending, and a fresh instance sees nothing', async () => {
  const listing = () => readdirSync(tmpdir()).sort();
  for (const end of ['done', 'incomplete', 'discarded']) {
    const before = listing();
    const h = await runner();
    await h.call('POST', '/run', end === 'incomplete' ? runBody({ ceiling: { spend: 100, calls: 1, seconds: 60 } }) : runBody());
    await h.r.settled();
    if (end === 'discarded') await h.call('POST', '/run/discard');
    assert.equal(h.r.state, end);
    assert.deepEqual(listing(), before, `${end}: no file left`);
    const fresh = await runner();
    assert.equal((await fresh.call('GET', '/run/status')).json.code, 'NO_RUN', 'a fresh instance sees nothing of the first');
  }
  const { writeFileSync, rmSync } = await import('node:fs');
  const planted = `${tmpdir()}/agent-runner-planted-${process.pid}`;
  const before = listing();
  writeFileSync(planted, 'x');
  try { assert.notDeepEqual(listing(), before, 'control: a planted file is found'); } finally { rmSync(planted); }
});

/* ------------------------------------------------------------------ R29 one line per step */

test('R29 each step writes one line with the closed fields and no sentinel; a refused request writes its line refused with its code', async () => {
  const w = world({ provider: goodProvider({ text: `echo ${KEY}`, headers: { 'x-request-id': 'req-SENTINELHDR' } }) });
  const h = await runner({ world: w });
  await h.call('POST', '/run', runBody(), { 'x-civicsmith-trace': 'trace-29' });
  await h.r.settled();
  await takeBundle(h);
  await h.call('POST', '/run/discard');
  const steps = h.lines.filter((l) => l.event === 'gate.runner');
  assert.deepEqual(steps.map((l) => l.step), ['challenge', 'start', 'tier', 'seal', 'manifest', 'approve', 'bundle', 'discard']);
  const base = ['event', 'trace', 'run_ref', 'step', 'outcome', 'status', 'ms', 'cold', 'uptime_s'];
  for (const l of steps) {
    const extra = l.step === 'tier' ? ['tier', 'items_done', 'items_total'] : l.step === 'ceiling' ? ['incomplete_reason'] : [];
    assert.deepEqual(Object.keys(l).sort(), [...base, ...extra].sort(), l.step);
    assert.ok(STEPS.includes(l.step)); assert.equal(l.outcome, 'ok');
    assert.equal(l.trace, 'trace-29');
    assert.match(l.run_ref, /^[0-9a-f]{12}$/);
  }
  const all = JSON.stringify(h.lines);
  assert.ok(!holdsKey(all) && !all.includes('SENTINELHDR') && !all.includes(challengeFor().nonce) && !all.includes('g0-echo'));
  const runId = (await (await runner()).call('POST', '/run', runBody())).json.run;
  assert.ok(!all.includes(runId));
  const r = await runner();
  await r.call('POST', '/run', 'nope');
  assert.deepEqual(r.lines.map((l) => [l.step, l.outcome, l.code, l.status]), [['start', 'refused', 'BAD_REQUEST', 400]]);
});

/* ------------------------------------------------------------------ R48 capture */

test('R48 the raw exchange is captured into the sealed payload only: bodies there, no credential, nothing in lines or answers', async () => {
  const w = world({ provider: goodProvider({ text: 'BODY-SENTINEL-48', headers: { 'x-leaky-header': 'HDR-SENTINEL-48' } }) });
  const h = await runner({ world: w });
  await h.call('POST', '/run', runBody());
  await h.r.settled();
  assert.ok(h.r.version().capabilities.includes('capture'));
  const manifest = (await h.call('GET', '/run/manifest')).json;
  const payload = await open(h, await takeBundle(h));
  const calls = payload.calls;
  assert.ok(calls.length > 0);
  assert.ok(JSON.stringify(calls.map((c) => c.response)).includes('BODY-SENTINEL-48'), 'the response body is in the opened payload');
  assert.ok(!JSON.stringify(calls.map((c) => c.headers)).includes('HDR-SENTINEL-48'), 'the headers record keeps only the named headers');
  assert.ok(!JSON.stringify(payload).toLowerCase().includes('authorization') && !holdsKey(JSON.stringify(payload)), 'no credential in any record');
  for (const t of [JSON.stringify(h.lines), JSON.stringify(manifest)]) assert.ok(!t.includes('BODY-SENTINEL-48'));
  assert.ok(calls.every((c) => c.request && c.timings && 'usage' in c && 'outcome' in c && c.status === 200));
});

test('R48 control: an image built with CAPTURE false answers no "capture" capability and holds no buffer', async () => {
  const h = await runner({ options: { capture: false } });
  assert.ok(!h.r.version().capabilities.includes('capture'));
  await h.call('POST', '/run', runBody());
  assert.equal(h.r.inspect().buffer, null);
  await h.r.settled();
  const payload = await open(h, await takeBundle(h));
  assert.deepEqual(payload.calls, []);
});

/* ------------------------------------------------------------------ R49 the challenge */

test('R49 a good challenge starts the run; a wrong bank version, an expired one, a refusal and an unreachable issuer each answer their code with no provider call', async () => {
  const cases = [
    [() => Response.json(challengeFor(Date.now(), { bank_version: 'bank-0' })), 502, 'CHALLENGE_INVALID'],
    [() => Response.json(challengeFor(Date.now() - 7200_000)), 502, 'CHALLENGE_INVALID'],
    [() => Response.json({ nonce: 'x' }), 502, 'CHALLENGE_INVALID'],
    [() => Response.json({ ok: false, code: 'ENTRY_UNKNOWN' }, { status: 409 }), 409, 'CHALLENGE_REFUSED'],
    [() => { throw new TypeError('fetch failed'); }, 502, 'ISSUER_UNREACHABLE'],
    [() => new Response('down', { status: 503 }), 502, 'ISSUER_UNREACHABLE'],
  ];
  for (const [issuer, status, code] of cases) {
    const h = await runner({ issuer });
    const r = await h.call('POST', '/run', runBody());
    assert.equal(r.status, status, code); assert.equal(r.json.code, code);
    if (code === 'CHALLENGE_REFUSED') assert.equal(r.json.issuer_code, 'ENTRY_UNKNOWN');
    assert.equal(h.world.seen.filter((s) => s.host === PROVIDER_HOST).length, 0, `${code}: no provider call`);
  }
  const h = await finishedRun();
  assert.equal(h.started.status, 202);
  const ask = h.world.seen.find((s) => s.host === 'issuer.test');
  assert.equal(ask.path, '/ai/challenge'); assert.equal(ask.method, 'POST');
  const body = JSON.parse(ask.body);
  assert.deepEqual(Object.keys(body).sort(), ['bank_version', 'declared_model', 'image_digest', 'plan', 'provider', 'run_public_key']);
  assert.equal(body.plan, 'stub-plan'); assert.equal(body.declared_model, MODEL);
  assert.match(body.run_public_key, /^ssh-ed25519 [A-Za-z0-9+/=]+ /);
  assert.ok(!holdsKey(ask.body), 'control: no key of the team\'s provider');
});

/* ------------------------------------------------------------------ R51 ceilings */

test('R51 a reported cost reaching the spend ceiling ends the run incomplete, sealed; a stalled provider stops at the time ceiling; calls likewise', async () => {
  const spend = await finishedRun({ provider: goodProvider({ cost: 0.6 }) }, runBody({ ceiling: { spend: 1, calls: 100, seconds: 60 } }));
  assert.deepEqual((await spend.call('GET', '/run/status')).json.incomplete_reason, 'ceiling_spend');
  assert.equal(spend.r.state, 'incomplete');
  assert.equal(spend.world.seen.filter((s) => s.host === PROVIDER_HOST).length, 2, 'no call after the meter said stop');
  const m = (await spend.call('GET', '/run/manifest')).json;
  assert.equal(m.incomplete_reason, 'ceiling_spend');
  assert.ok((await takeBundle(spend)).length > 0, 'still sealed');
  const calls = await finishedRun({}, runBody({ ceiling: { spend: 100, calls: 3, seconds: 60 } }));
  assert.equal((await calls.call('GET', '/run/status')).json.incomplete_reason, 'ceiling_calls');
  const stall = (req) => new Promise((_, reject) => req.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  const t0 = Date.now();
  const slow = await finishedRun({ provider: (req) => stall(req) }, runBody({ ceiling: { spend: 100, calls: 100, seconds: 0.2 } }));
  assert.ok(Date.now() - t0 < 5000);
  assert.equal((await slow.call('GET', '/run/status')).json.incomplete_reason, 'ceiling_time');
  assert.ok(slow.lines.some((l) => l.step === 'ceiling' && l.incomplete_reason === 'ceiling_time'));
  const ok = await finishedRun();
  assert.equal(ok.r.state, 'done', 'control: below every ceiling completes done');
  // each call's output is capped from one call's high estimate, and the manifest states that bound
  const price = { unit: 'USD', input_per_mtok: 1, output_per_mtok: 10 };
  const capped = await finishedRun({}, runBody({ declared: declared({ price }), estimate: { low: 0.006, expected: 0.012, high: 0.06 } }));
  const sent = capped.world.seen.filter((s) => s.host === PROVIDER_HOST).map((s) => JSON.parse(s.body).max_tokens);
  const high = 0.06 / sent.length;
  assert.ok(sent.length > 0 && sent.every((n) => n === Math.floor((high * 1e6) / 10)), JSON.stringify(sent));
  assert.equal((await capped.call('GET', '/run/manifest')).json.overshoot_bound, high);
});

/* ------------------------------------------------------------------ R52 scrub then scan */

test('R52 a provider echoing the key in an error body: scrubbed, and the scan is clean; with the scrub off, SECRET_IN_PAYLOAD and no bytes', async () => {
  const echo = () => Response.json({ error: { message: `bad key ${KEY} (${encodeURIComponent(KEY)})` } }, { status: 400 });
  const h = await finishedRun({ provider: echo });
  const payload = await open(h, await takeBundle(h));
  assert.ok(!holdsKey(JSON.stringify(payload)) && JSON.stringify(payload).includes('[scrubbed]'));
  const raw = await finishedRun({ provider: echo, options: { scrub: false } });
  assert.equal(raw.r.state, 'incomplete');
  assert.equal((await raw.call('GET', '/run/status')).json.incomplete_reason, 'secret_in_payload');
  const b = await raw.call('GET', '/run/bundle');
  assert.equal(b.json.code, 'SECRET_IN_PAYLOAD'); assert.ok(!(b.body instanceof Uint8Array));
  assert.equal(raw.r.inspect().key, null, 'the run is wiped');
  assert.equal(raw.r.inspect().buffer, null);
  const clean = await finishedRun();
  assert.equal(clean.r.state, 'done', 'control: a clean run seals');
});

/* ------------------------------------------------------------------ R53 sealed and signed inside */

test('R53 the bundle opens with the private half of the sealing key only, the plaintext is dropped, and a flipped manifest byte breaks the signature', async () => {
  const h = await finishedRun();
  const bytes = await takeBundle(h);
  assert.ok((await open(h, bytes)).calls.length > 0);
  const other = await (await import('./helpers.mjs')).testSealingKey();
  assert.equal(await openSealed(parseBundle(bytes).payload, { ...other, key_id: h.sealingKey.key_id }), null, 'no other key opens it');
  const held = h.r.inspect();
  assert.equal(held.key, null); assert.equal(held.buffer, null); assert.equal(held.prelim, null);
  const p = parseBundle(bytes);
  const manifest = JSON.parse(td.decode(p.manifest));
  assert.equal(manifest.sealed_to, h.sealingKey.key_id);
  const args = { payloadSha256: await sha256Hex(p.payload), armored: td.decode(p.signature), runPublicKey: manifest.run_public_key };
  const good = await verifyRunBundle({ ...args, manifestBytes: p.manifest });
  const flipped = Uint8Array.from(p.manifest); flipped[10] ^= 1;
  const bad = await verifyRunBundle({ ...args, manifestBytes: flipped });
  assert.equal(good.ok, true, 'the signature checks');
  assert.equal(bad.ok, false, 'control: a flipped byte breaks it');
});

test('R53 ai-gate verifyBundle reads the bundle the image makes: its schema, nonce, signature and payload check', async () => {
  const digest = 'sha256:' + 'ef'.repeat(32);
  const h = await finishedRun({ options: { imageDigest: digest } });
  const bytes = await takeBundle(h);
  const c = challengeFor();
  const out = await verifyBundle(bytes, {
    open: async (sealed) => openSealed(sealed, h.sealingKey),
    issuedNonce: () => ({ nonce: c.nonce, provider: 'stubco', plan: 'stub-plan', run_public_key: JSON.parse(td.decode(parseBundle(bytes).manifest)).run_public_key, bank_version: PUBLIC_BANK.version }),
    nonceUsed: () => false, releasedDigests: [digest], keyShapes: [],
  });
  assert.equal(out.status, 'verified', JSON.stringify(out).slice(0, 400));
});

/* ------------------------------------------------------------------ R54 manifest first */

test('R54 the bundle is answered only after the manifest is shown and approved; nothing goes to the issuer after the challenge', async () => {
  const h = await finishedRun();
  assert.equal((await h.call('GET', '/run/bundle')).json.code, 'MANIFEST_NOT_SHOWN');
  assert.equal((await h.call('POST', '/run/approve')).json.code, 'MANIFEST_NOT_SHOWN', 'approval needs the manifest shown');
  const m = await h.call('GET', '/run/manifest');
  assert.deepEqual(m.json.contains.holds, ['calls', 'run', 'stub_logs', 'preliminary']);
  assert.equal((await h.call('GET', '/run/bundle')).json.code, 'MANIFEST_NOT_SHOWN', 'shown is not approved');
  await h.call('POST', '/run/approve');
  assert.equal((await h.call('GET', '/run/bundle')).status, 200);
  assert.equal(h.world.seen.filter((s) => s.host === 'issuer.test').length, 1, 'the stub issuer receives the challenge request alone');
  const running = await runner({ provider: () => new Promise(() => {}) });
  await running.call('POST', '/run', runBody());
  assert.equal((await running.call('GET', '/run/manifest')).json.code, 'NO_MANIFEST_YET');
  await running.call('POST', '/run/discard');
});

/* ------------------------------------------------------------------ R57 R58 deployments */

test('R57 civicsmith refuses a plan off its sample list 403 NOT_A_SAMPLE_ACCOUNT; a listed one runs; the deployment is configuration, never a request', async () => {
  const off = await runner({ options: { deployment: 'civicsmith', sampleAccounts: ['cs-sample-1'] } });
  const r = await off.call('POST', '/run', runBody());
  assert.equal(r.status, 403); assert.equal(r.json.code, 'NOT_A_SAMPLE_ACCOUNT');
  assert.equal(off.world.seen.length, 0);
  const on = await runner({ options: { deployment: 'civicsmith', sampleAccounts: ['cs-sample-1'] } });
  assert.equal((await on.call('POST', '/run', runBody({ declared: declared({ plan: 'cs-sample-1', route: 'civicsmith' }) }))).status, 202);
  const team = await runner();
  assert.equal(team.r.version().deployment, 'team');
  const asks = await team.call('POST', '/run', runBody({ declared: declared({ route: 'machine' }) }));
  assert.equal(asks.json.code, 'BAD_RUN', 'a request cannot pick the machine route');
  const v = team.r.version();
  assert.ok(!('grade' in v) && !JSON.stringify(v).includes('grade'));
  const m = (await (await finishedRun()).call('GET', '/run/manifest')).json;
  assert.ok(!('grade' in m), 'the container does not grade itself');
});

test('R58 on a machine a loopback host over http is accepted and the list is that address and the issuer; elsewhere it is refused; a third host still is', async () => {
  const w = world({ provider: goodProvider() });
  const m = await runner({ world: w, options: { deployment: 'machine' } });
  const r = await m.call('POST', '/run', runBody({ declared: declared({ host: 'http://127.0.0.1:11434', route: 'machine' }) }));
  assert.equal(r.status, 202);
  assert.deepEqual(m.r.egress, ['issuer.test', '127.0.0.1']);
  await m.r.settled();
  assert.ok(w.seen.some((s) => s.host === '127.0.0.1'));
  for (const deployment of ['team', 'civicsmith']) {
    const t = await runner({ options: { deployment, sampleAccounts: ['stub-plan'] } });
    assert.equal((await t.call('POST', '/run', runBody({ declared: declared({ host: 'http://127.0.0.1:11434' }) }))).json.code, 'BAD_RUN', deployment);
    assert.equal((await t.call('POST', '/run', runBody({ declared: declared({ host: '127.0.0.1' }) }))).json.code, 'BAD_RUN', deployment);
  }
  const lan = await runner({ options: { deployment: 'machine' } });
  assert.equal((await lan.call('POST', '/run', runBody({ declared: declared({ host: 'http://192.168.1.4:8000' }) }))).json.code, 'BAD_RUN', 'http only for loopback');
  const { makeDoor, egressList } = await import('../src/door.mjs');
  const list = egressList('issuer.test'); list.forRun('127.0.0.1');
  await assert.rejects(makeDoor({ fetchImpl: async () => new Response(''), list }).fetch('https://third.test/'), (e) => e.code === 'EGRESS_REFUSED');
  assert.ok(m.r.version().capabilities.includes('local-endpoint'));
  const built = JSON.parse(readFileSync(new URL('../fleet-member.json', import.meta.url), 'utf8')).build.machine_run;
  assert.match(built, /--read-only/); assert.match(built, /-p 127\.0\.0\.1:8080:8080/);
  assert.ok(!/ -v |--volume|--mount|-e [A-Z_]*KEY|--env-file/.test(built), 'no volume, no key by environment or file');
});

/* ------------------------------------------------------------------ R59 R60 */

test('R59 the manifest names image_digest_declared and states attestation null', async () => {
  const digest = 'sha256:' + 'cd'.repeat(32);
  const h = await finishedRun({ options: { imageDigest: digest } });
  const m = (await h.call('GET', '/run/manifest')).json;
  assert.equal(m.attestation, null);
  assert.equal(m.image_digest_declared, digest);
  assert.ok(!('image_digest' in m));
  assert.equal(h.r.version().image_digest_declared, digest);
  assert.equal((await runner()).r.version().image_digest_declared, null, 'null where the deployment states none');
});

test('R60 a bank item carrying an expected answer is refused CHALLENGE_HAS_ANSWERS before any call; a clean item runs with preliminary figures', async () => {
  const bank = { ...PUBLIC_BANK, items: PUBLIC_BANK.items.map((it, i) => (i === 0 ? { ...it, expected: { state: 'x' } } : it)) };
  const h = await runner({ options: { bank } });
  const r = await h.call('POST', '/run', runBody());
  assert.equal(r.status, 409); assert.equal(r.json.code, 'CHALLENGE_HAS_ANSWERS');
  assert.equal(h.world.seen.length, 0, 'the provider stub (and the issuer) received no request');
  const ok = await finishedRun();
  const payload = await open(ok, await takeBundle(ok));
  assert.equal(payload.preliminary.preliminary, true);
  assert.ok(payload.preliminary.items.length > 0 && payload.preliminary.items.every((p) => p.preliminary === true));
});

/* ------------------------------------------------------------------ R5 */

test('R5 GET /version answers exactly its keys; a run in progress changes none', async () => {
  const h = await runner({ provider: () => new Promise(() => {}) });
  const before = (await h.call('GET', '/version')).json;
  assert.deepEqual(Object.keys(before), VERSION_KEYS);
  assert.equal(before.name, 'agent-runner');
  await h.call('POST', '/run', runBody());
  assert.deepEqual((await h.call('GET', '/version')).json, before);
  assert.ok(!holdsKey(JSON.stringify(before)) && !JSON.stringify(before).includes(PROVIDER_HOST));
  const without = await runner({ options: { localEndpoint: false } });
  assert.ok(!without.r.version().capabilities.includes('local-endpoint'), 'control: without R58 no "local-endpoint"');
  await h.call('POST', '/run/discard');
});

test('R55 in the image: discard wipes the run at once; the end of the review window wipes it as expired', async () => {
  const h = await finishedRun({ options: { reviewWindowMs: 30 } });
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(h.r.state, 'expired');
  assert.equal((await h.call('GET', '/run/manifest')).json.code, 'NO_RUN');
  const d = await runner({ provider: () => new Promise(() => {}) });
  await d.call('POST', '/run', runBody());
  await d.call('POST', '/run/discard');
  assert.equal(d.r.state, 'discarded');
  assert.equal(d.r.inspect().key, null);
  assert.deepEqual(d.r.egress, ['issuer.test']);
});

export { ISSUER };
