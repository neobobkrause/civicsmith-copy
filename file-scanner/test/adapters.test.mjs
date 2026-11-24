// Every catalogued adapter against its vendor's stub (R17): the outside scan (R5), private mode per call (R22), the
// sandbox (R23), the rebuilt safe view (R24), reputation (R25, R26), forwarding (R27), the test probe (R28), the transports
// (R30) and engine families (R31); and across all of them, egress (R12) and the credentials (R13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/handler.mjs';
import { PROVIDERS, engineFamily } from '../src/providers/catalogue.mjs';
import { callHosts } from '../src/providers/net.mjs';
import { LOG_COUNT_KINDS, PROVIDER_TIMEOUT_MS, SANDBOX_TIMEOUT_MS, REPUTATION_LIST_MAX_AGE_MS } from '../src/limits.mjs';
import { makeZip } from '../../bio-plane/test/make-zip.mjs';
import { memoryBucket, putCapture, putDerived, depsWith, post, enc, EICAR, NOW } from './helpers.mjs';
import { vendorNet, vendorSockets, specs, infected, has, WEB_RISK_TEST } from './vendors.mjs';
import { NOT_HONOURED_CODE, EICAR_FOUND, EICAR_NOT_FOUND } from '../src/providers/routes.mjs';

const SCAN = ['scanii', 'metadefender-cloud', 'metadefender-core', 'icap', 'defender-storage', 'sophos-intelix'];
const SANDBOX = ['joe-sandbox', 'vmray', 'falcon-sandbox', 'wildfire', 'sophos-intelix'];
const CDR = ['opswat-deep-cdr', 'glasswall-halo'];
const SINKS = ['splunk-hec', 'sentinel', 'google-secops', 'elastic', 'syslog-tls', 'https-webhook'];
const MODE = ['metadefender-cloud', 'opswat-deep-cdr', 'joe-sandbox', 'falcon-sandbox'];
const DOCM = makeZip([{ name: '[Content_Types].xml', data: '<Types/>' }, { name: 'word/document.xml', data: '<w:document/>' },
  { name: 'word/vbaProject.bin', data: 'Sub AutoOpen()\r\nEnd Sub' }]);
const RECORD = { period: { from: '2026-10-07T10:00:00Z', to: '2026-10-07T11:00:00Z' }, counts: { files_scanned: 12, files_found: 1, signin: 3 } };

function world(state = {}, over = {}) {
  const bucket = memoryBucket();
  const net = vendorNet(state);
  const sockets = vendorSockets(over.answer);
  const deps = depsWith({ bucket, fetch: net.fetch, connect: sockets.connect, vpc: { fetch: net.fetch, connect: sockets.connect }, ...over.deps });
  const call = async (path, body) => { const r = await handle(post(path, body), deps); return r; };
  const jsonCall = async (path, body) => { const r = await call(path, body); return { status: r.status, body: await r.json() }; };
  return { bucket, net, sockets, deps, call, jsonCall, specs: specs() };
}
const sent = (w) => [...w.net.seen.map((r) => r.bytes), ...w.sockets.seen.map((s) => s.bytes())];
const sentFile = (w) => sent(w).some((b) => infected(b) || has(b, 'plain capture'));

test('R5 R31 each outside scanner answers one verdict per engine it reports, found or clean, each engine in its family', async () => {
  for (const id of SCAN) {
    const w = world();
    const bad = putCapture(w.bucket, EICAR), good = putCapture(w.bucket, enc('plain capture'));
    const a = await w.jsonCall('/provider/scan', { store: 'bio', target: bad, tool: w.specs[id] });
    const b = await w.jsonCall('/provider/scan', { store: 'bio', target: good, tool: w.specs[id] });
    assert.equal(a.status, 200, id); assert.equal(a.body.ok, true, id);
    const fam = id === 'icap' ? ['c-icap with clamav', 'clamav'] : engineFamily(id);
    for (const v of [...a.body.verdicts, ...b.body.verdicts]) {
      assert.equal(v.tool, id); assert.ok(fam.includes(v.engine), `${id}: ${v.engine} in its family`);
      assert.ok(typeof v.engine_version === 'string' && v.engine_version.length > 0);
      assert.ok(!('vendor_ref' in v) || !/sample|\./.test(v.vendor_ref), 'a vendor_ref is never a file name');
    }
    assert.ok(a.body.verdicts.some((v) => v.result === 'found' && v.findings.length), `${id} finds EICAR`);
    assert.ok(a.body.verdicts.every((v) => v.capture_sha === bad.capture_sha));
    assert.ok(b.body.verdicts.every((v) => v.result === 'clean' && v.findings.length === 0), `${id} clean`);
    if (id === 'scanii') assert.equal(a.body.verdicts.length, 1, 'Scanii answers one verdict');
    if (id === 'metadefender-cloud') {
      assert.deepEqual(a.body.verdicts.map((v) => v.engine), ['clamav', 'bitdefender', 'metadefender-unlisted']);
      assert.equal(a.body.verdicts[0].engine_version, '1.4.3');
    }
  }
});

test('R5 R13 the request carries the bytes and required parameters only: no file name, address, member, callback or metadata', async () => {
  for (const id of SCAN) {
    const w = world();
    const t = putCapture(w.bucket, EICAR);
    await w.jsonCall('/provider/scan', { store: 'bio', target: t, tool: w.specs[id] });
    for (const r of w.net.seen) {
      const all = `${r.url}\n${JSON.stringify(r.headers)}\n${r.text}`;
      for (const banned of [t.capture_sha, 'captures', 'bio/', 'member', 'callback', 'webhook_url', 'file-scanner']) assert.ok(!all.includes(banned), `${id} sends no ${banned}`);
      for (const m of r.text.matchAll(/filename="([^"]*)"/g)) assert.equal(m[1], 'sample', `${id}: the fixed neutral part name`);
      assert.ok(!/SENTINEL-/.test(r.url), `${id}: no credential in an address`);
      assert.ok(!r.headers['x-file-name'] && !r.headers.filename, `${id}: no file-name header`);
    }
  }
});

test('R5 not_scanned: TOO_LARGE (nothing sent), SERVICE_REFUSED with the status, SERVICE_UNREACHABLE, TIME_LIMIT', async () => {
  const w = world();
  const t = putCapture(w.bucket, EICAR);
  const head = w.bucket.head;
  w.bucket.head = async (k) => (k.endsWith(t.capture_sha) ? { size: 146_800_641 } : head(k));
  const big = await w.jsonCall('/provider/scan', { store: 'bio', target: t, tool: w.specs['metadefender-cloud'] });
  assert.deepEqual([big.body.verdicts[0].result, big.body.verdicts[0].reason], ['not_scanned', 'TOO_LARGE']);
  assert.equal(w.net.seen.length, 0, 'nothing sent');
  w.bucket.head = head;
  const wrong = { ...w.specs.scanii, credentials: { api_key: 'x', api_secret: 'y' } };
  const refused = await w.jsonCall('/provider/scan', { store: 'bio', target: t, tool: wrong });
  assert.deepEqual([refused.body.verdicts[0].reason, refused.body.verdicts[0].detail], ['SERVICE_REFUSED', 'HTTP:401']);
  const down = world({}, { deps: { fetch: async () => { throw new TypeError('connect refused'); } } });
  const t2 = putCapture(down.bucket, EICAR);
  assert.equal((await down.jsonCall('/provider/scan', { store: 'bio', target: t2, tool: down.specs.scanii })).body.verdicts[0].reason, 'SERVICE_UNREACHABLE');
  let clock = NOW;
  const slow = world({}, { deps: { now: () => (clock += PROVIDER_TIMEOUT_MS) } });
  const t3 = putCapture(slow.bucket, EICAR);
  assert.equal((await slow.jsonCall('/provider/scan', { store: 'bio', target: t3, tool: slow.specs.scanii })).body.verdicts[0].reason, 'TIME_LIMIT');
  const missing = await w.jsonCall('/provider/scan', { store: 'bio', target: { capture_sha: '7'.repeat(64), parts: null }, tool: w.specs.scanii });
  assert.equal(missing.body.verdicts[0].reason, 'NOT_FOUND');
  const bad = await w.jsonCall('/provider/scan', { store: 'bio', target: { capture_sha: 'nope' }, tool: w.specs.scanii });
  assert.equal(bad.body.verdicts[0].reason, 'BAD_TARGET');
  assert.deepEqual((await w.jsonCall('/provider/scan', { store: 'x', target: t, tool: w.specs.scanii })).body, { ok: false, code: 'NAMESPACE_UNKNOWN' });
});

test('R5 R2 a derived target (area "derived") is read from ${store}/derived/<sha>, checked as a capture is, and sent; any other area is BAD_TARGET, nothing sent', async () => {
  const w = world();
  const copy = putDerived(w.bucket, EICAR, { split: 16 });
  const r = await w.jsonCall('/provider/scan', { store: 'bio', target: copy, tool: w.specs.scanii });
  assert.deepEqual(r.body.verdicts.map((v) => [v.capture_sha, v.result]), [[copy.capture_sha, 'found']]);
  assert.ok(w.bucket.calls.every(([, k]) => !k.includes('/captures/')), 'nothing read under captures/');
  assert.ok(w.net.seen.some((x) => infected(x.bytes)), 'the derived copy\'s bytes were sent');
  const missing = await w.jsonCall('/provider/scan', { store: 'bio', target: { ...putCapture(w.bucket, enc('a capture')), area: 'derived' }, tool: w.specs.scanii });
  assert.equal(missing.body.verdicts[0].reason, 'NOT_FOUND');
  const n = w.net.seen.length;
  for (const area of ['captures', 'other', 7]) {
    const v = (await w.jsonCall('/provider/scan', { store: 'bio', target: { ...copy, area }, tool: w.specs.scanii })).body.verdicts[0];
    assert.deepEqual([v.result, v.reason], ['not_scanned', 'BAD_TARGET'], String(area));
  }
  assert.equal(w.net.seen.length, n, 'nothing sent for a bad area');
});

test('R5 an outside tool\'s address carrying a user name or password is refused TOOL_ADDRESS_HAS_CREDENTIAL and nothing is sent', async () => {
  for (const host of ['user:pw@halo.example.org', 'user@halo.example.org', ':pw@halo.example.org']) {
    const w = world();
    const doc = putCapture(w.bucket, DOCM);
    const r = await w.jsonCall('/provider/cdr', { store: 'bio', target: doc, tool: { ...w.specs['glasswall-halo'], host } });
    assert.deepEqual(r.body, { ok: false, code: 'TOOL_ADDRESS_HAS_CREDENTIAL' }, host);
    const f = await w.jsonCall('/provider/forward', { tool: { ...w.specs.elastic, host: host.replace('halo', 'elastic') }, record: RECORD });
    assert.deepEqual(f.body, { ok: false, code: 'TOOL_ADDRESS_HAS_CREDENTIAL' }, host);
    const s = await w.jsonCall('/provider/scan', { store: 'bio', target: putCapture(w.bucket, EICAR), tool: { ...w.specs['metadefender-core'], host: host.replace('halo', 'mdcore') } });
    assert.deepEqual([s.body.verdicts[0].result, s.body.verdicts[0].reason], ['not_scanned', 'TOOL_ADDRESS_HAS_CREDENTIAL'], host);
    assert.equal(w.net.seen.length, 0, `${host}: nothing sent`);
  }
});

test('R22 private mode per call: confirmed, refused before anything is sent, contradicted by the vendor\'s answer', async () => {
  const route = { 'metadefender-cloud': '/provider/scan', 'opswat-deep-cdr': '/provider/cdr', 'joe-sandbox': '/provider/sandbox', 'falcon-sandbox': '/provider/sandbox' };
  for (const id of MODE) {
    const target = (w) => putCapture(w.bucket, id === 'opswat-deep-cdr' ? DOCM : EICAR);
    // confirm: the mode's parameters ride on every request that carries the file
    const ok = world({ mode: 'confirm' });
    const r = await ok.call(route[id], { store: 'bio', target: target(ok), tool: ok.specs[id] });
    assert.equal(r.status, 200, `${id} confirmed`);
    const params = PROVIDERS.find((d) => d.provider_id === id).mode_required.params;
    const carriers = ok.net.seen.filter((x) => infected(x.bytes) || has(x.bytes, 'vbaProject'));
    assert.ok(carriers.length > 0);
    for (const c of carriers) for (const [k, v] of Object.entries(params)) {
      assert.ok(c.headers[k] === v || c.text.includes(`name="${k}"\r\n\r\n${v}`), `${id}: ${k}=${v} on the send`);
    }
    // refuse: the check fails, nothing of the file leaves
    const no = world({ mode: 'refuse' });
    const rr = await no.call(route[id], { store: 'bio', target: target(no), tool: no.specs[id] });
    const body = await rr.json();
    assert.equal(body.verdicts ? body.verdicts[0].reason : body.code, 'PRIVATE_MODE_UNCONFIRMED', id);
    assert.ok(!no.net.seen.some((x) => infected(x.bytes) || has(x.bytes, 'vbaProject')), `${id}: nothing sent`);
    // contradict: the vendor's answer states another mode
    const cx = world({ mode: 'contradict' });
    const rc = await cx.call(route[id], { store: 'bio', target: target(cx), tool: cx.specs[id] });
    assert.deepEqual([rc.status, await rc.json()], [502, { ok: false, code: NOT_HONOURED_CODE, provider_id: id }]);
  }
});

test('R23 a sandbox: submitted, running, then one verdict per engine (found, suspicious, clean); TIME_LIMIT past SANDBOX_TIMEOUT_MS', async () => {
  for (const id of SANDBOX) {
    const state = { sandbox: 'running' };
    const w = world(state);
    const t = putCapture(w.bucket, EICAR);
    const s = await w.jsonCall('/provider/sandbox', { store: 'bio', target: t, tool: w.specs[id] });
    assert.equal(s.body.state, 'submitted', id);
    assert.ok(typeof s.body.vendor_ref === 'string' && s.body.vendor_ref && s.body.poll_after_ms > 0);
    const ask = (at) => w.jsonCall('/provider/sandbox/result', { tool: w.specs[id], vendor_ref: s.body.vendor_ref, submitted_at: at });
    assert.deepEqual((await ask(new Date(NOW - 60_000).toISOString())).body.state, 'running');
    const late = (await ask(new Date(NOW - SANDBOX_TIMEOUT_MS - 1).toISOString())).body;
    assert.deepEqual([late.state, late.verdicts[0].result, late.verdicts[0].reason], ['done', 'not_scanned', 'TIME_LIMIT']);
    state.sandbox = 'done';
    const done = (await ask(new Date(NOW - 60_000).toISOString())).body;
    assert.equal(done.state, 'done');
    assert.ok(done.verdicts.length >= 1 && done.verdicts.every((v) => v.tool === id && engineFamily(id).includes(v.engine) && v.vendor_ref === s.body.vendor_ref));
    assert.equal(done.verdicts[0].result, 'found', id);
    assert.ok(done.verdicts[0].findings.length > 0);
    assert.deepEqual(w.bucket.calls.filter(([op]) => op === 'put'), [], 'the member keeps nothing between the calls');
  }
  // suspicious and clean
  const w = world();
  const t = putCapture(w.bucket, enc('plain capture'));
  for (const [id, want] of [['sophos-intelix', 'suspicious'], ['vmray', 'clean'], ['wildfire', 'clean'], ['joe-sandbox', 'clean'], ['falcon-sandbox', 'clean']]) {
    const s = (await w.jsonCall('/provider/sandbox', { store: 'bio', target: t, tool: w.specs[id] })).body;
    const d = (await w.jsonCall('/provider/sandbox/result', { tool: w.specs[id], vendor_ref: s.vendor_ref, submitted_at: new Date(NOW).toISOString() })).body;
    assert.equal(d.verdicts[0].result, want, id);
    assert.deepEqual(d.verdicts[0].findings.length > 0, want === 'suspicious');
  }
});

test('R24 a safe view by a rebuilding tool: the rebuilt file with its digest, origin, type, what was removed and the tool; CDR_UNSUPPORTED_TYPE; nothing stored', async () => {
  for (const id of CDR) {
    const w = world();
    const t = putCapture(w.bucket, DOCM);
    const r = await w.call('/provider/cdr', { store: 'bio', target: t, tool: w.specs[id] });
    assert.equal(r.status, 200, id);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const { createHash } = await import('node:crypto');
    assert.equal(r.headers.get('x-derived-sha256'), createHash('sha256').update(bytes).digest('hex'));
    assert.equal(r.headers.get('x-of'), t.capture_sha);
    assert.equal(r.headers.get('x-tool'), id);
    assert.equal(r.headers.get('x-output-type'), r.headers.get('content-type'));
    assert.deepEqual(JSON.parse(r.headers.get('x-removed')), ['Macro']);
    const txt = putCapture(w.bucket, enc('not an office file'));
    const u = await w.jsonCall('/provider/cdr', { store: 'bio', target: txt, tool: w.specs[id] });
    assert.deepEqual([u.status, u.body.code], [422, 'CDR_UNSUPPORTED_TYPE'], id);
    assert.deepEqual(w.bucket.calls.filter(([op]) => op === 'put'), [], 'never written to the bucket by this member');
  }
});

test('R25 reputation: Cloudflare\'s lookup in the group\'s account; Web Risk by hash prefix only, never the address', async () => {
  const w = world();
  const cf = (address) => w.jsonCall('/provider/reputation', { address, tool: w.specs['cloudflare-intel'] });
  const yes = (await cf('https://malware.testcategory.com/x')).body;
  assert.deepEqual(yes, { ok: true, listed: true, categories: ['Security threats'], risk: ['Malware'], source: 'cloudflare-intel', lookup_privacy: 'cloudflare_account' });
  assert.equal((await cf('https://example.org/page')).body.listed, false);
  for (const bad of ['ftp://example.org/', 'https://localhost/x', 'http://10.0.0.5/', 'http://192.168.1.1/', 'https://user:pw@example.org/', 'not a url', 'https://printer/']) {
    assert.deepEqual(await cf(bad), { status: 400, body: { ok: false, code: 'BAD_ADDRESS' } }, bad);
  }
  const g = (address, deps) => w.jsonCall('/provider/reputation', { address, tool: w.specs['google-web-risk'] });
  assert.equal((await g(WEB_RISK_TEST)).body.code, 'REPUTATION_LIST_ABSENT');
  assert.equal((await w.jsonCall('/provider/refresh', { tool: w.specs['google-web-risk'] })).body.ok, true);
  w.net.seen.length = 0;
  const hit = (await g(WEB_RISK_TEST)).body;
  assert.deepEqual(hit, { ok: true, listed: true, categories: [], risk: ['MALWARE'], source: 'google-web-risk', lookup_privacy: 'hash_prefix' });
  assert.equal(w.net.seen.length, 1);
  assert.equal(w.net.seen[0].path, '/v1/hashes:search');
  const miss = (await g('https://example.org/clean')).body;
  assert.equal(miss.listed, false);
  assert.equal(w.net.seen.length, 1, 'no local match: nothing is sent');
  for (const r of w.net.seen) for (const part of ['testsafebrowsing', 'malware.html', 'appspot', 'example.org']) {
    assert.ok(!r.url.includes(part) && !r.text.includes(part), `the address never leaves (${part})`);
  }
  const stale = world();
  await stale.jsonCall('/provider/refresh', { tool: stale.specs['google-web-risk'] });
  stale.deps.now = () => NOW + REPUTATION_LIST_MAX_AGE_MS + 1;
  assert.equal((await stale.jsonCall('/provider/reputation', { address: WEB_RISK_TEST, tool: stale.specs['google-web-risk'] })).body.code, 'REPUTATION_LIST_STALE');
});

test('R26 a refresh writes the list under reputation/<tool_id>/, replacing the last only once complete and its checksum holds', async () => {
  const state = {};
  const w = world(state);
  const spec = w.specs['google-web-risk'];
  const a = (await w.jsonCall('/provider/refresh', { tool: spec })).body;
  assert.deepEqual(Object.keys(a), ['ok', 'list_version', 'fetched_at']);
  assert.equal(a.ok, true); assert.equal(a.fetched_at, new Date(NOW).toISOString()); assert.match(a.list_version, /^[0-9a-f]{16}$/);
  assert.ok(w.bucket.calls.filter(([op]) => op === 'put' || op === 'delete').every(([, k]) => k.startsWith(`reputation/${spec.tool_id}/`)));
  const keysBefore = [...w.bucket.objects.keys()].sort();
  state.badChecksum = true;
  const b = (await w.jsonCall('/provider/refresh', { tool: spec })).body;
  assert.deepEqual([b.ok, b.list_version, b.fetched_at], [false, a.list_version, a.fetched_at]);
  assert.match(b.error, /^LIST_CHECKSUM_MISMATCH/);
  assert.deepEqual([...w.bucket.objects.keys()].sort(), keysBefore, 'the last good list stays');
  assert.equal((await w.jsonCall('/provider/reputation', { address: WEB_RISK_TEST, tool: spec })).body.listed, true);
  assert.deepEqual((await w.jsonCall('/provider/refresh', { tool: w.specs['cloudflare-intel'] })).body, { ok: false, code: 'NO_LOCAL_LIST' });
});

test('R27 a counts record goes in each sink\'s transport shape and nothing else is added', async () => {
  for (const id of SINKS) {
    const w = world();
    const r = await w.jsonCall('/provider/forward', { tool: w.specs[id], record: RECORD });
    assert.deepEqual(r.body, { ok: true, sent_at: new Date(NOW).toISOString() }, id);
    const bodies = [...w.net.seen.filter((x) => !/token|oauth2/.test(x.path)).map((x) => x.text), ...w.sockets.seen.map((s) => s.bytes().toString())];
    assert.equal(bodies.length, 1, `${id}: one send`);
    const b = bodies[0];
    const want = JSON.stringify(RECORD);
    if (id === 'splunk-hec') assert.equal(b, JSON.stringify({ event: RECORD }));
    if (id === 'sentinel') assert.equal(b, JSON.stringify([RECORD]));
    if (id === 'google-secops') {
      const o = JSON.parse(b);
      assert.deepEqual(o, { inline_source: { logs: [{ data: btoa(want), log_entry_time: RECORD.period.to, collection_time: RECORD.period.to }] } });
    }
    if (id === 'elastic') assert.equal(b, `{"index":{"_index":"counts"}}\n${want}\n`);
    if (id === 'syslog-tls') {
      const msg = `<110>1 ${RECORD.period.to} - civicsmith - security-counts - ${want}`;
      assert.equal(b, `${Buffer.byteLength(msg)} ${msg}`);
      assert.equal(w.sockets.seen[0].options.secureTransport, 'on');
      assert.equal(w.sockets.seen[0].port, 6514);
    }
    if (id === 'https-webhook') assert.equal(b, want);
  }
});

test('R27 any other key, a string, a negative or a fraction is COUNTS_RECORD_INVALID, naming the key, and nothing is sent', async () => {
  const w = world();
  const bad = [
    [{ ...RECORD, member: 'm1' }, 'member'],
    [{ ...RECORD, counts: { files_scanned: '12' } }, 'counts.files_scanned'],
    [{ ...RECORD, counts: { files_scanned: -1 } }, 'counts.files_scanned'],
    [{ ...RECORD, counts: { files_scanned: 1.5 } }, 'counts.files_scanned'],
    [{ ...RECORD, counts: { file_name: 1 } }, 'counts.file_name'],
    [{ ...RECORD, period: { from: RECORD.period.to, to: RECORD.period.from } }, 'period.to'],
    [{ ...RECORD, period: { ...RECORD.period, address: 'x' } }, 'period.address'],
    [{ period: RECORD.period }, 'counts'],
    [{ ...RECORD, period: { from: 'yesterday', to: RECORD.period.to } }, 'period.from'],
  ];
  for (const [record, key] of bad) {
    assert.deepEqual(await w.jsonCall('/provider/forward', { tool: w.specs['splunk-hec'], record }), { status: 400, body: { ok: false, code: 'COUNTS_RECORD_INVALID', key } });
  }
  assert.equal(w.net.seen.length, 0);
  assert.deepEqual(LOG_COUNT_KINDS.length, 14);
});

test('R28 every catalogued tool\'s test probe passes through its own adapter; a failing one says what failed; no capture is read', async () => {
  for (const d of PROVIDERS) {
    const w = world();
    const r = await w.jsonCall('/provider/test', { tool: w.specs[d.provider_id] });
    assert.equal(r.body.ok, true, d.provider_id);
    assert.equal(r.body.passed, true, `${d.provider_id}: ${r.body.detail}`);
    if (d.kinds.includes('scan') || d.kinds.includes('sandbox')) assert.equal(r.body.detail, EICAR_FOUND, d.provider_id);
    assert.ok(!w.bucket.calls.some(([, k]) => k.includes('captures')), 'no capture read');
  }
  const w = world();
  const broken = { ...w.specs.scanii, credentials: { api_key: 'a', api_secret: 'b' } };
  assert.deepEqual((await w.jsonCall('/provider/test', { tool: broken })).body, { ok: true, passed: false, detail: 'SERVICE_REFUSED HTTP:401' });
  const clean = world({}, { answer: () => 'ICAP/1.0 204 No Content\r\n\r\n' });
  assert.deepEqual((await clean.jsonCall('/provider/test', { tool: clean.specs.icap })).body, { ok: true, passed: false, detail: EICAR_NOT_FOUND });
});

test('R30 ICAP: RESPMOD over TCP or TLS; 204 or a bare 200 clean; X-Infection-Found or X-Virus-ID found; any other status unknown', async () => {
  const cases = [
    ['ICAP/1.0 204 No Content\r\n\r\n', 'clean', [], undefined],
    ['ICAP/1.0 200 OK\r\nEncapsulated: null-body=0\r\n\r\n', 'clean', [], undefined],
    ['ICAP/1.0 200 OK\r\nX-Infection-Found: Type=0; Resolution=2; Threat=Win.Test.EICAR_HDB-1;\r\n\r\n', 'found', ['Win.Test.EICAR_HDB-1'], undefined],
    ['ICAP/1.0 200 OK\r\nX-Virus-ID: Eicar-Signature\r\n\r\n', 'found', ['Eicar-Signature'], undefined],
    ['ICAP/1.0 500 Server Error\r\n\r\n', 'unknown', [], 'ICAP:500'],
  ];
  for (const [answer, result, findings, detail] of cases) {
    const w = world({}, { answer: () => answer });
    const t = putCapture(w.bucket, EICAR);
    const v = (await w.jsonCall('/provider/scan', { store: 'bio', target: t, tool: w.specs.icap })).body.verdicts[0];
    assert.deepEqual([v.result, v.findings, v.detail], [result, findings, detail]);
    const req = w.sockets.seen[0].bytes().toString('latin1');
    assert.match(req, /^RESPMOD icap:\/\/icap\.example\.org:1344\/avscan ICAP\/1\.0\r\n/);
    assert.match(req, /Encapsulated: res-hdr=0, res-body=\d+\r\n/);
    assert.ok(req.endsWith(`${EICAR.length.toString(16)}\r\n${Buffer.from(EICAR).toString('latin1')}\r\n0\r\n\r\n`), 'the bytes, chunked');
    assert.deepEqual([w.sockets.seen[0].host, w.sockets.seen[0].port], ['icap.example.org', 1344]);
  }
  const tls = world();
  const t = putCapture(tls.bucket, EICAR);
  await tls.jsonCall('/provider/scan', { store: 'bio', target: t, tool: { ...tls.specs.icap, host: 'icap.example.org', config: { ...tls.specs.icap.config, tls: true } } });
  assert.deepEqual([tls.sockets.seen[0].port, tls.sockets.seen[0].options.secureTransport], [11344, 'on']);
  // A settings page sends `tls` as one text (R19): yes/true/on/1 turn it on, anything else leaves it off.
  for (const [text, port] of [['yes', 11344], ['TRUE', 11344], ['on', 11344], ['1', 11344], ['no', 1344], ['false', 1344], ['0', 1344], ['off', 1344]]) {
    const n = tls.sockets.seen.length;
    await tls.jsonCall('/provider/scan', { store: 'bio', target: t, tool: { ...tls.specs.icap, host: 'icap.example.org', config: { ...tls.specs.icap.config, tls: text } } });
    assert.equal(tls.sockets.seen[n].port, port, `tls ${text}`);
    assert.equal(tls.sockets.seen[n].options.secureTransport, port === 11344 ? 'on' : undefined, `tls ${text}`);
  }
  const port25 = await tls.jsonCall('/provider/scan', { store: 'bio', target: t, tool: { ...tls.specs.icap, host: 'icap.example.org:25' } });
  assert.deepEqual(port25.body, { ok: false, code: 'PORT_REFUSED', provider_id: 'icap' });
});

test('R30 azure_blob: written to the organization\'s container, its index tag read, the blob deleted after', async () => {
  for (const [bytes, result] of [[EICAR, 'found'], [enc('plain capture'), 'clean']]) {
    const w = world();
    const t = putCapture(w.bucket, bytes);
    const v = (await w.jsonCall('/provider/scan', { store: 'bio', target: t, tool: w.specs['defender-storage'] })).body.verdicts[0];
    assert.equal(v.result, result);
    const blob = w.net.seen.filter((r) => r.host === 'orgscans.blob.core.windows.net');
    assert.deepEqual(blob.map((r) => [r.method, r.search]), [['PUT', ''], ['GET', '?comp=tags'], ['DELETE', '']]);
    assert.match(blob[0].path, /^\/scans\/[0-9a-f-]{36}$/, 'a random blob name, never the file\'s');
    assert.ok(blob.every((r) => r.path === blob[0].path));
  }
});

test('R12 every outside call reaches only its descriptor\'s hosts for the spec\'s region, or the spec\'s own host', async () => {
  const w = world();
  const t = putCapture(w.bucket, EICAR), doc = putCapture(w.bucket, DOCM);
  for (const d of PROVIDERS) {
    const spec = w.specs[d.provider_id];
    const before = w.net.seen.length, sockets = w.sockets.seen.length;
    if (d.kinds.includes('scan')) await w.call('/provider/scan', { store: 'bio', target: t, tool: spec });
    if (d.kinds.includes('sandbox')) {
      const s = await (await w.call('/provider/sandbox', { store: 'bio', target: t, tool: spec })).json();
      await w.call('/provider/sandbox/result', { tool: spec, vendor_ref: s.vendor_ref, submitted_at: new Date(NOW).toISOString() });
    }
    if (d.kinds.includes('cdr')) await w.call('/provider/cdr', { store: 'bio', target: doc, tool: spec });
    if (d.kinds.includes('url_reputation')) { await w.call('/provider/refresh', { tool: spec }); await w.call('/provider/reputation', { address: d.test_probe.address, tool: spec }); }
    if (d.kinds.includes('log_sink')) await w.call('/provider/forward', { tool: spec, record: RECORD });
    await w.call('/provider/test', { tool: spec });
    const allowed = callHosts(d, spec);
    const hosts = [...w.net.seen.slice(before).map((r) => r.host), ...w.sockets.seen.slice(sockets).map((s) => s.host)];
    assert.ok(hosts.length > 0, d.provider_id);
    for (const h of hosts) assert.ok(allowed.some((a) => (a.startsWith('*.') ? h.endsWith(a.slice(1)) : a === h)), `${d.provider_id} reached ${h}`);
  }
  // a tunnelled tool goes through the VPC binding, and without it answers REACH_NOT_BOUND
  const viaVpc = [];
  const v = world({}, { deps: { fetch: async () => { throw new Error('a tunnelled tool used the public network'); } } });
  const inner = v.deps.vpc.fetch;
  v.deps.vpc = { fetch: (req) => { viaVpc.push(new URL(req.url).hostname); return inner(req); } };
  const tv = putCapture(v.bucket, EICAR);
  await v.call('/provider/scan', { store: 'bio', target: tv, tool: v.specs['metadefender-core'] });
  assert.ok(viaVpc.length > 0 && viaVpc.every((h) => h === 'mdcore.example.org'));
});

test('R13 sentinel credentials appear in no answer, log line, bucket object or address, across every adapter', async () => {
  const lines = [];
  const saved = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) { saved[k] = console[k]; console[k] = (...a) => lines.push(a.map(String).join(' ')); }
  try {
    for (const state of [{}, { mode: 'refuse' }, { mode: 'contradict' }]) {
      const w = world(state);
      const t = putCapture(w.bucket, EICAR), doc = putCapture(w.bucket, DOCM);
      const answers = [];
      const keep = async (r) => { answers.push(`${JSON.stringify(Object.fromEntries(r.headers))}${await r.text()}`); };
      for (const d of PROVIDERS) {
        const spec = w.specs[d.provider_id];
        if (d.kinds.includes('scan')) await keep(await w.call('/provider/scan', { store: 'bio', target: t, tool: spec }));
        if (d.kinds.includes('sandbox')) await keep(await w.call('/provider/sandbox', { store: 'bio', target: t, tool: spec }));
        if (d.kinds.includes('cdr')) await keep(await w.call('/provider/cdr', { store: 'bio', target: doc, tool: spec }));
        if (d.kinds.includes('url_reputation')) { await keep(await w.call('/provider/refresh', { tool: spec })); await keep(await w.call('/provider/reputation', { address: d.test_probe.address, tool: spec })); }
        if (d.kinds.includes('log_sink')) await keep(await w.call('/provider/forward', { tool: spec, record: RECORD }));
        await keep(await w.call('/provider/test', { tool: spec }));
        await keep(await w.call('/provider/test', { tool: { ...spec, credentials: Object.fromEntries(Object.keys(spec.credentials || {}).map((k) => [k, `SENTINEL-wrong-${k}`])) } }));
      }
      await keep(await handle(new Request('https://file-scanner/version'), w.deps));
      await keep(await handle(new Request('https://file-scanner/providers'), w.deps));
      for (const a of answers) assert.ok(!a.includes('SENTINEL-'), `an answer echoed a credential: ${a.slice(0, 200)}`);
      for (const [k, v] of w.bucket.objects) assert.ok(!Buffer.from(v).includes('SENTINEL-'), `bucket object ${k}`);
      for (const r of w.net.seen) assert.ok(!r.url.includes('SENTINEL-'), `address ${r.url}`);
    }
  } finally { Object.assign(console, saved); }
  assert.ok(!lines.some((l) => l.includes('SENTINEL-')), 'no log line holds a credential');
});

test('R17 each catalogued adapter runs against its vendor\'s stub, which asserts no file name, member or address is sent', async () => {
  const kinds = new Map();
  for (const d of PROVIDERS) for (const k of d.kinds) kinds.set(k, [...(kinds.get(k) || []), d.provider_id]);
  assert.deepEqual(kinds.get('scan'), SCAN);
  assert.deepEqual(kinds.get('sandbox'), SANDBOX.slice(0, 4).concat(['sophos-intelix']).sort((a, b) => PROVIDERS.findIndex((d) => d.provider_id === a) - PROVIDERS.findIndex((d) => d.provider_id === b)));
  assert.deepEqual(kinds.get('cdr'), CDR);
  assert.deepEqual(kinds.get('url_reputation'), ['cloudflare-intel', 'google-web-risk']);
  assert.deepEqual(kinds.get('log_sink'), SINKS);
  for (const d of PROVIDERS) assert.ok(specs()[d.provider_id], `${d.provider_id} has a stubbed spec`);
  // sentFile is the stubs' own check that a capture's bytes left only where a send was made
  const w = world({ mode: 'refuse' });
  await w.call('/provider/scan', { store: 'bio', target: putCapture(w.bucket, EICAR), tool: w.specs['metadefender-cloud'] });
  assert.equal(sentFile(w), false);
});
