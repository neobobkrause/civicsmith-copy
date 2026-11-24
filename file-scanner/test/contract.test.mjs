// The provider contract: the descriptor (R19), the catalogue (R20), the tool spec's checks (R21), GET /providers
// (R29) and engine families (R31); R17's "every refused and held id is refused by name".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/handler.mjs';
import { validateDescriptor } from '../src/providers/descriptor.mjs';
import { PROVIDERS, REFUSED_PROVIDERS, HELD_PROVIDERS, engineFamily, differentEngine, providerById } from '../src/providers/catalogue.mjs';
import { depsWith, post, putCapture, memoryBucket, EICAR } from './helpers.mjs';
import { specs, vendorNet, HANDLING } from './vendors.mjs';
import { ELASTIC_DEFAULT_INDEX } from '../src/providers/sinks.mjs';

const ids = (l) => l.map((d) => d.provider_id);
const good = () => JSON.parse(JSON.stringify(providerById('scanii')));

test('R19 validateDescriptor: ok for a whole descriptor; DESCRIPTOR_MALFORMED naming the field; pure, never throws', () => {
  assert.deepEqual(validateDescriptor(good()), { ok: true });
  const cases = [
    [(d) => { delete d.vendor; }, 'vendor'], [(d) => { d.kinds = []; }, 'kinds'], [(d) => { d.kinds = ['scan', 'mail']; }, 'kinds'],
    [(d) => { d.transport = 'grpc'; }, 'transport'], [(d) => { d.reach = 'private'; }, 'reach'], [(d) => { d.hosts = ['not a host!']; }, 'hosts'],
    [(d) => { d.engine_family = []; }, 'engine_family'], [(d) => { d.credentials = [1]; }, 'credentials'],
    [(d) => { d.test_probe = { kind: 'ping' }; }, 'test_probe'], [(d) => { d.handling.recipient = ''; }, 'handling.recipient'],
    [(d) => { d.handling.sends = ['file_name']; }, 'handling.sends'], [(d) => { d.handling.sample_sharing = 'sometimes'; }, 'handling.sample_sharing'],
    [(d) => { d.handling.extra = 'x'; }, 'handling.extra'], [(d) => { d.mode_required = 'yes'; }, 'mode_required'],
    [(d) => { d.read_on = 'today'; }, 'read_on'], [(d) => { d.secret = 'x'; }, 'secret'], [(d) => { d.source_urls = ['http://x.example']; }, 'source_urls'],
  ];
  for (const [change, field] of cases) {
    const d = good(); change(d);
    assert.deepEqual(validateDescriptor(d), { ok: false, code: 'DESCRIPTOR_MALFORMED', field }, field);
  }
  for (const v of [null, undefined, 3, 'x', [], new Proxy({}, { get() { throw new Error('boom'); }, ownKeys() { throw new Error('boom'); } })]) {
    assert.equal(validateDescriptor(v).code, 'DESCRIPTOR_MALFORMED');
  }
  const frozen = Object.freeze(good());
  validateDescriptor(frozen);
  assert.deepEqual(frozen, good(), 'pure');
});

test('R19 the refusals, in order: shares samples, handling not stated, never_sends incomplete, address would leave, private mode unverifiable', () => {
  const with_ = (f) => { const d = good(); f(d); return validateDescriptor(d); };
  assert.deepEqual(with_((d) => { d.handling.sample_sharing = 'third_parties'; }), { ok: false, code: 'PROVIDER_SHARES_SAMPLES' });
  assert.deepEqual(with_((d) => { d.handling.sample_sharing = 'public'; d.handling.never_sends = []; }), { ok: false, code: 'PROVIDER_SHARES_SAMPLES' });
  assert.deepEqual(with_((d) => { d.handling.sample_sharing = 'not stated'; }), { ok: false, code: 'HANDLING_NOT_STATED' });
  assert.deepEqual(with_((d) => { d.handling.never_sends = ['file_name', 'member_identity']; }), { ok: false, code: 'NEVER_SENDS_INCOMPLETE' });
  assert.deepEqual(with_((d) => { d.handling.never_sends = 'not stated'; }), { ok: false, code: 'NEVER_SENDS_INCOMPLETE' });
  const rep = () => JSON.parse(JSON.stringify(providerById('cloudflare-intel')));
  for (const sends of [['url'], ['hostname']]) {
    const d = rep(); d.handling.sends = sends; d.handling.recipient = 'Another Company';
    assert.deepEqual(validateDescriptor(d), { ok: false, code: 'ADDRESS_WOULD_LEAVE' });
  }
  const pref = rep(); pref.handling.sends = ['hash_prefix']; pref.handling.recipient = 'Another Company';
  assert.deepEqual(validateDescriptor(pref), { ok: true }, 'a hash prefix may go to another recipient');
  assert.deepEqual(validateDescriptor(rep()), { ok: true }, 'an address may go to Cloudflare in the group\'s account');
  assert.deepEqual(with_((d) => { d.mode_required = { params: { x: '1' }, description: 'private' }; d.mode_check = null; }), { ok: false, code: 'PRIVATE_MODE_UNVERIFIABLE' });
  assert.deepEqual(with_((d) => { d.handling.sample_sharing = 'vendor_internal_research'; }), { ok: true }, 'S10: allowed, confirmed per spec (R21)');
});

test('R20 the catalogue: exactly the offered descriptors by kind, each passing R19 with its source and date; refused and held by name; frozen', () => {
  const byKind = (k) => ids(PROVIDERS.filter((d) => d.kinds.includes(k)));
  assert.deepEqual(byKind('scan'), ['scanii', 'metadefender-cloud', 'metadefender-core', 'icap', 'defender-storage', 'sophos-intelix']);
  assert.deepEqual(byKind('cdr'), ['opswat-deep-cdr', 'glasswall-halo']);
  assert.deepEqual(byKind('sandbox').sort(), ['falcon-sandbox', 'joe-sandbox', 'sophos-intelix', 'vmray', 'wildfire']);
  assert.deepEqual(byKind('url_reputation'), ['cloudflare-intel', 'google-web-risk']);
  assert.deepEqual(byKind('log_sink'), ['splunk-hec', 'sentinel', 'google-secops', 'elastic', 'syslog-tls', 'https-webhook']);
  for (const d of PROVIDERS) {
    assert.deepEqual(validateDescriptor(d), { ok: true }, d.provider_id);
    assert.match(d.read_on, /^\d{4}-\d{2}-\d{2}$/);
    if (!d.template) assert.ok(d.source_urls.length > 0, `${d.provider_id} cites its statement`);
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.handling));
  }
  assert.equal(providerById('metadefender-cloud').mode_required.params.samplesharing, '0');
  assert.ok(providerById('falcon-sandbox').mode_required, 'community access forced off');
  for (const id of ['sophos-intelix', 'wildfire']) assert.equal(providerById(id).handling.sample_sharing, 'vendor_internal_research', `${id}: S10`);
  assert.deepEqual(REFUSED_PROVIDERS.map((r) => [r.provider_id, r.reason]), [
    ['virustotal-upload', 'PROVIDER_SHARES_SAMPLES'], ['jotti', 'PROVIDER_SHARES_SAMPLES'], ['hybrid-analysis', 'PROVIDER_SHARES_SAMPLES'],
    ['joe-sandbox-basic', 'PROVIDER_SHARES_SAMPLES'], ['urlscan-io', 'PROVIDER_SHARES_SAMPLES'], ['any-run', 'NOT_OFFERED'],
    ['virustotal-url-submit', 'ADDRESS_WOULD_LEAVE'], ['google-web-risk-lookup', 'ADDRESS_WOULD_LEAVE'], ['sophos-intelix-url', 'ADDRESS_WOULD_LEAVE'],
    ['metadefender-url', 'ADDRESS_WOULD_LEAVE'], ['cloudflare-url-scanner', 'NOT_OFFERED'], ['cloudflare-logpush', 'NOT_OFFERED']]);
  assert.deepEqual(HELD_PROVIDERS, [{ provider_id: 'trend-vision-one', missing: 'HANDLING_NOT_STATED' }, { provider_id: 'votiro', missing: 'HANDLING_NOT_STATED' },
    { provider_id: 'checkpoint-threat-extraction', missing: 'HANDLING_NOT_STATED' }]);
  for (const l of [PROVIDERS, REFUSED_PROVIDERS, HELD_PROVIDERS]) assert.ok(Object.isFrozen(l));
  assert.deepEqual(ids(PROVIDERS.filter((d) => d.template)), ['icap', 'syslog-tls', 'https-webhook']);
});

test('R20 a generic template is completed by the administrator\'s statement and the spec\'s host, and R19 validates the result', async () => {
  const bucket = memoryBucket();
  const deps = depsWith({ bucket, fetch: vendorNet().fetch });
  const t = putCapture(bucket, EICAR);
  const base = specs().icap;
  const go = async (spec) => (await handle(post('/provider/scan', { store: 'bio', target: t, tool: spec }), deps)).json();
  assert.deepEqual(await go({ ...base, config: { ...base.config, engine_family: undefined } }), { ok: false, code: 'CONFIG_MISSING', field: 'engine_family', provider_id: 'icap' });
  for (const engine_family of ['kaspersky', [], ['  ']]) {
    assert.deepEqual(await go({ ...base, config: { ...base.config, engine_family } }), { ok: false, code: 'DESCRIPTOR_MALFORMED', field: 'engine_family', provider_id: 'icap' }, JSON.stringify(engine_family));
  }
  assert.deepEqual(await go({ ...base, config: { ...base.config, handling: { ...HANDLING, sample_sharing: 'public' } } }), { ok: false, code: 'PROVIDER_SHARES_SAMPLES', provider_id: 'icap' });
  assert.deepEqual(await go({ ...base, config: { ...base.config, handling: { ...HANDLING, sample_sharing: 'not stated' } } }), { ok: false, code: 'HANDLING_NOT_STATED', provider_id: 'icap' });
  assert.deepEqual(await go({ ...base, host: undefined }), { ok: false, code: 'PROVIDER_UNKNOWN', provider_id: 'icap' });
});

test('R21 the spec\'s checks answer 400 by name and send nothing: unknown, refused (with its reason), held, kind, credentials, handling, reach', async () => {
  const net = vendorNet();
  const bucket = memoryBucket();
  const deps = depsWith({ bucket, fetch: net.fetch });
  const t = putCapture(bucket, EICAR);
  const s = specs();
  const go = async (tool, path = '/provider/scan', body = { store: 'bio', target: t }) => {
    const r = await handle(post(path, { ...body, tool }), deps); return [r.status, await r.json()];
  };
  assert.deepEqual(await go({ ...s.scanii, provider_id: 'nobody' }), [400, { ok: false, code: 'PROVIDER_UNKNOWN' }]);
  assert.deepEqual(await go(null), [400, { ok: false, code: 'PROVIDER_UNKNOWN' }]);
  for (const r of REFUSED_PROVIDERS) assert.deepEqual(await go({ ...s.scanii, provider_id: r.provider_id }), [400, { ok: false, code: 'PROVIDER_REFUSED', reason: r.reason, provider_id: r.provider_id }]);
  for (const h of HELD_PROVIDERS) assert.deepEqual(await go({ ...s.scanii, provider_id: h.provider_id }), [400, { ok: false, code: 'PROVIDER_HELD', provider_id: h.provider_id }]);
  assert.deepEqual(await go(s['metadefender-core'], '/provider/scan'), [400, { ok: false, code: 'REACH_NOT_BOUND', provider_id: 'metadefender-core' }]);
  assert.deepEqual(await go(s.scanii, '/provider/cdr'), [400, { ok: false, code: 'KIND_NOT_OFFERED', provider_id: 'scanii' }]);
  assert.deepEqual(await go({ ...s.scanii, credentials: { api_key: 'k' } }), [400, { ok: false, code: 'CREDENTIALS_MISSING', field: 'api_secret', provider_id: 'scanii' }]);
  assert.deepEqual(await go({ ...s.wildfire, handling_confirmed: false }, '/provider/sandbox'), [400, { ok: false, code: 'HANDLING_NOT_CONFIRMED', provider_id: 'wildfire' }]);
  assert.deepEqual(await go({ ...s['sophos-intelix'], handling_confirmed: 'yes' }), [400, { ok: false, code: 'HANDLING_NOT_CONFIRMED', provider_id: 'sophos-intelix' }]);
  assert.deepEqual(await go({ ...s.scanii, region: 'mars' }), [400, { ok: false, code: 'REGION_UNKNOWN', provider_id: 'scanii' }]);
  assert.deepEqual(await go({ ...s.scanii, monthly_limit_left: 0 }), [400, { ok: false, code: 'MONTHLY_LIMIT_REACHED', provider_id: 'scanii' }]);
  assert.deepEqual(await go({ ...s.scanii, tool_id: undefined }), [400, { ok: false, code: 'TOOL_SPEC_MALFORMED', field: 'tool_id', provider_id: 'scanii' }]);
  assert.deepEqual(await go({ ...s['opswat-deep-cdr'], region: 'core' }, '/provider/cdr'), [400, { ok: false, code: 'PROVIDER_UNKNOWN', provider_id: 'opswat-deep-cdr' }]);
  assert.equal(net.seen.length, 0, 'nothing was sent');
  assert.ok(!bucket.calls.some(([op, k]) => op === 'get' && k.includes('captures')), 'nothing was read');
});

test('R17 every REFUSED_PROVIDERS and HELD_PROVIDERS id is refused by name on every route', async () => {
  const deps = depsWith({ fetch: vendorNet().fetch });
  const routes = [['/provider/scan', { store: 'bio', target: { capture_sha: 'a'.repeat(64), parts: null } }], ['/provider/sandbox', { store: 'bio', target: { capture_sha: 'a'.repeat(64), parts: null } }],
    ['/provider/cdr', { store: 'bio', target: { capture_sha: 'a'.repeat(64), parts: null } }], ['/provider/reputation', { address: 'https://example.org/' }],
    ['/provider/refresh', {}], ['/provider/forward', { record: { period: { from: '2026-10-07T10:00:00Z', to: '2026-10-07T11:00:00Z' }, counts: {} } }],
    ['/provider/test', {}], ['/provider/sandbox/result', { vendor_ref: 'x', submitted_at: '2026-10-07T10:00:00Z' }]];
  for (const [path, body] of routes) {
    for (const r of REFUSED_PROVIDERS) assert.equal((await (await handle(post(path, { ...body, tool: { provider_id: r.provider_id, tool_id: 'x' } }), deps)).json()).code, 'PROVIDER_REFUSED', `${path} ${r.provider_id}`);
    for (const h of HELD_PROVIDERS) assert.equal((await (await handle(post(path, { ...body, tool: { provider_id: h.provider_id, tool_id: 'x' } }), deps)).json()).code, 'PROVIDER_HELD', `${path} ${h.provider_id}`);
  }
});

test('R29 GET /providers answers the offered descriptors whole, the refused, the held and the generic transports; no credential value', async () => {
  const r = await handle(new Request('https://file-scanner/providers'), depsWith());
  const b = await r.json();
  assert.deepEqual(Object.keys(b), ['ok', 'offered', 'refused', 'held', 'transports']);
  assert.deepEqual(b.offered, JSON.parse(JSON.stringify(PROVIDERS)));
  assert.deepEqual(b.refused, JSON.parse(JSON.stringify(REFUSED_PROVIDERS)));
  assert.deepEqual(b.held, JSON.parse(JSON.stringify(HELD_PROVIDERS)));
  assert.deepEqual(ids(b.transports), ['icap', 'syslog-tls', 'https-webhook']);
  for (const d of b.offered) assert.ok(d.credentials.every((c) => typeof c === 'string' && /^[a-z_]+$/.test(c)), 'credential names only');
});

test('R19 each descriptor and generic template states config [{name, label, required, structured?}], each name once; a malformed list is DESCRIPTOR_MALFORMED config', () => {
  for (const d of PROVIDERS) {
    assert.ok(Array.isArray(d.config) && Object.isFrozen(d.config), d.provider_id);
    assert.deepEqual(new Set(d.config.map((f) => f.name)).size, d.config.length, `${d.provider_id}: each name once`);
    for (const f of d.config) {
      assert.deepEqual(Object.keys(f).filter((k) => k !== 'structured'), ['name', 'label', 'required'], d.provider_id);
      assert.match(f.name, /^[a-z][a-z0-9_]*$/); assert.ok(typeof f.label === 'string' && f.label.length > 0);
      assert.equal(typeof f.required, 'boolean'); assert.ok(Object.isFrozen(f));
    }
  }
  const named = (id) => providerById(id).config.map((f) => `${f.name}${f.required ? '*' : ''}`);
  assert.deepEqual(Object.fromEntries(PROVIDERS.map((d) => [d.provider_id, named(d.provider_id)]).filter(([, l]) => l.length)), {
    scanii: ['region*'], 'metadefender-core': ['host*'],
    icap: ['host*', 'engine_family*', 'handling*', 'source_urls', 'service', 'tls'],
    'defender-storage': ['tenant_id*', 'storage_account*', 'container*'], 'sophos-intelix': ['region*'],
    'opswat-deep-cdr': ['region*', 'host'], 'glasswall-halo': ['host*'], vmray: ['region*'],
    'falcon-sandbox': ['region*', 'environment_id'], wildfire: ['region*'], 'cloudflare-intel': ['account_id*'],
    'splunk-hec': ['host*'], sentinel: ['tenant_id*', 'endpoint*', 'dcr_id*', 'stream*'],
    'google-secops': ['region*', 'project*', 'location*', 'instance*', 'log_type*'],
    elastic: ['host*', 'index'], 'syslog-tls': ['host*', 'engine_family*', 'handling*', 'source_urls'],
    'https-webhook': ['host*', 'engine_family*', 'handling*', 'source_urls', 'path'],
  }, 'the settings each adapter reads, by name');
  const cases = [(d) => { delete d.config; }, (d) => { d.config = {}; }, (d) => { d.config = [{ name: 'x', label: 'X' }]; },
    (d) => { d.config = [{ name: 'x', label: '', required: true }]; }, (d) => { d.config = [{ name: 'X y', label: 'X', required: true }]; },
    (d) => { d.config = [{ name: 'x', label: 'X', required: 'yes' }]; }, (d) => { d.config = [{ name: 'x', label: 'X', required: true, value: 1 }]; },
    (d) => { d.config = [{ name: 'x', label: 'X', required: true }, { name: 'x', label: 'Y', required: false }]; }, (d) => { d.config = [null]; },
    (d) => { d.config = [{ name: 'x', label: 'X', required: true, structured: 'object' }]; }, (d) => { d.config = [{ name: 'x', label: 'X', required: true, structured: null }]; },
    (d) => { d.config = [{ name: 'x', label: 'X', structured: 'list' }]; }];
  for (const change of cases) { const d = good(); change(d); assert.deepEqual(validateDescriptor(d), { ok: false, code: 'DESCRIPTOR_MALFORMED', field: 'config' }); }
  for (const config of [[{ name: 'x', label: 'X', required: true }], [{ name: 'x', label: 'X', required: false, structured: 'list' }],
    [{ name: 'x', label: 'X', required: true, structured: 'handling' }]]) {
    const d = good(); d.config = config;
    assert.deepEqual(validateDescriptor(d), { ok: true }, JSON.stringify(config));
  }
});

test('R21 the spec\'s config: each required field present, else CONFIG_MISSING naming it and nothing sent; a field the list does not name is never sent', async () => {
  const net = vendorNet();
  const bucket = memoryBucket();
  const deps = depsWith({ bucket, fetch: net.fetch });
  const t = putCapture(bucket, EICAR);
  const s = specs();
  const go = async (path, body) => { const r = await handle(post(path, body), deps); return [r.status, await r.json()]; };
  const RECORD = { period: { from: '2026-10-07T10:00:00Z', to: '2026-10-07T11:00:00Z' }, counts: { files_scanned: 1 } };
  const call = { scan: (tool) => go('/provider/scan', { store: 'bio', target: t, tool }), forward: (tool) => go('/provider/forward', { tool, record: RECORD }),
    reputation: (tool) => go('/provider/reputation', { address: 'https://example.org/', tool }) };
  const cases = [['defender-storage', 'scan'], ['cloudflare-intel', 'reputation'], ['sentinel', 'forward'], ['google-secops', 'forward'], ['icap', 'scan'],
    ['syslog-tls', 'forward'], ['https-webhook', 'forward']];
  for (const [id, how] of cases) {
    // `host` and `region` are the spec's own fields (R19, T38): their absence is R21's PROVIDER_UNKNOWN or REGION_UNKNOWN.
    for (const f of providerById(id).config.filter((x) => x.required && x.name !== 'host' && x.name !== 'region')) {
      for (const absent of [undefined, null, '']) {
        const tool = { ...s[id], config: { ...s[id].config, [f.name]: absent } };
        assert.deepEqual(await call[how](tool), [400, { ok: false, code: 'CONFIG_MISSING', field: f.name, provider_id: id }], `${id} ${f.name}`);
      }
    }
  }
  for (const config of [undefined, null, 'x', []]) {
    assert.deepEqual(await call.scan({ ...s['defender-storage'], config }), [400, { ok: false, code: 'CONFIG_MISSING', field: 'tenant_id', provider_id: 'defender-storage' }]);
  }
  assert.equal(net.seen.length, 0, 'nothing sent');
  assert.ok(!bucket.calls.some(([op, k]) => op === 'get' && k.includes('captures')), 'nothing read');
  // An unnamed field is dropped: the webhook's call carries no trace of it, and an optional one may be left out.
  const extra = { ...s['https-webhook'], config: { ...s['https-webhook'].config, secret_extra: 'UNNAMED-FIELD', callback_url: 'https://elsewhere.example/' } };
  assert.deepEqual((await call.forward(extra))[1].ok, true);
  const elastic = { ...s.elastic, config: { index: undefined, member: 'UNNAMED-FIELD' } };
  assert.deepEqual((await call.forward(elastic))[1].ok, true, 'an optional field left out');
  assert.ok(net.seen.length >= 2);
  for (const r of net.seen) assert.ok(!`${r.url}${JSON.stringify(r.headers)}${r.text}`.includes('UNNAMED-FIELD') && !r.text.includes('elsewhere.example'), 'an unnamed field never leaves');
  assert.ok(net.seen.some((r) => r.text.includes(ELASTIC_DEFAULT_INDEX)), 'elastic used its default index');
});

test('R29 GET /providers answers each descriptor\'s and each generic template\'s config list', async () => {
  const b = await (await handle(new Request('https://file-scanner/providers'), depsWith())).json();
  for (const d of b.offered) assert.deepEqual(d.config, JSON.parse(JSON.stringify(providerById(d.provider_id).config)), d.provider_id);
  for (const d of b.transports) {
    for (const name of ['engine_family', 'handling']) assert.ok(d.config.some((f) => f.name === name && f.required), `${d.provider_id}: the administrator states its ${name} (K2175)`);
    assert.ok(d.config.some((f) => f.name === 'host' && f.required), `${d.provider_id}: the template's address is asked (T38)`);
  }
});

test('R31 engine families: clamav\'s is ["clamav"]; differentEngine is true exactly when two families share no name', () => {
  assert.deepEqual(engineFamily('clamav'), ['clamav']);
  for (const d of PROVIDERS) assert.ok(engineFamily(d.provider_id).length > 0);
  assert.equal(engineFamily('nobody'), null);
  const v = (tool, engine, extra = {}) => ({ tool, engine, engine_version: 'not reported', ...extra });
  const clam = v('clamav', 'clamav', { engine_version: '1.4.3' });
  assert.equal(differentEngine(clam, v('scanii', 'scanii')), true);
  assert.equal(differentEngine(v('scanii', 'scanii'), v('sophos-intelix', 'sophos')), false, 'Scanii and Intelix one family (K1946 T7)');
  assert.equal(differentEngine(clam, v('metadefender-cloud', 'clamav')), false, 'MetaDefender\'s ClamAV is ClamAV');
  assert.equal(differentEngine(clam, v('metadefender-cloud', 'bitdefender')), true);
  assert.equal(differentEngine(clam, v('clamav', 'clamav')), false);
  assert.equal(differentEngine(clam, v('icap', 'c-icap with clamav')), false, 'a generic ICAP tool naming ClamAV includes clamav');
  assert.equal(differentEngine(clam, v('icap', 'kaspersky scan engine')), true);
  assert.equal(differentEngine(v('vmray', 'vmray'), v('joe-sandbox', 'joe-sandbox')), true, 'not reported versions still have families');
  for (const x of [null, undefined, {}, 'clamav', { tool: 'x' }]) assert.equal(differentEngine(x, clam), false);
});

// R19 (T38; N791, K2239): what a settings page that asks only the `config` list needs to add each tool.
const needsAddress = (d) => d.template === true || d.host_from_spec === true
  || (!Array.isArray(d.hosts) && Object.values(d.hosts).some((l) => l.length === 0));
const regional = (d) => !Array.isArray(d.hosts);

test('R19 every generic template and every descriptor needing an address hosts does not give lists host, labelled and required (region where it applies)', () => {
  const addressed = PROVIDERS.filter(needsAddress);
  assert.deepEqual(ids(addressed), ['metadefender-core', 'icap', 'opswat-deep-cdr', 'glasswall-halo', 'splunk-hec', 'elastic', 'syslog-tls', 'https-webhook']);
  for (const d of addressed) {
    const host = d.config.find((f) => f.name === 'host');
    assert.ok(host, `${d.provider_id} lists host`);
    assert.ok(typeof host.label === 'string' && /address/i.test(host.label), `${d.provider_id}: host labelled`);
    // Required wherever the address is always needed; opswat-deep-cdr needs one only in its `core` region.
    const always = d.template === true || d.host_from_spec === true;
    assert.equal(host.required, always, `${d.provider_id}: host required ${always}`);
    if (!always) assert.match(host.label, /Core only/);
  }
  assert.ok(providerById('splunk-hec').config.some((f) => f.name === 'host' && f.required), 'splunk-hec (host_from_spec) asks its collector');
  for (const d of PROVIDERS.filter((x) => !needsAddress(x))) assert.ok(!d.config.some((f) => f.name === 'host'), `${d.provider_id}: hosts give its address`);
  // `region` where it applies: every descriptor whose hosts are keyed by region, required, its label naming each region.
  for (const d of PROVIDERS) {
    const region = d.config.find((f) => f.name === 'region');
    if (!regional(d)) { assert.equal(region, undefined, `${d.provider_id}: no regions`); continue; }
    assert.ok(region && region.required === true, `${d.provider_id} lists region, required`);
    for (const r of Object.keys(d.hosts)) assert.ok(region.label.split(/[ ,:]+/).includes(r), `${d.provider_id}: label names ${r}`);
  }
});

test('R19 a config entry whose value is not one text says so: a template\'s engine_family and source_urls structured "list", its handling structured "handling"; every other entry one text', () => {
  for (const d of PROVIDERS) {
    for (const f of d.config) {
      const want = d.template && (f.name === 'engine_family' || f.name === 'source_urls') ? 'list' : d.template && f.name === 'handling' ? 'handling' : undefined;
      assert.equal(f.structured, want, `${d.provider_id} ${f.name}`);
    }
  }
  for (const id of ['icap', 'syslog-tls', 'https-webhook']) {
    const by = Object.fromEntries(providerById(id).config.map((f) => [f.name, f]));
    assert.deepEqual([by.engine_family.structured, by.handling.structured, by.source_urls.structured], ['list', 'handling', 'list'], id);
  }
});

test('R19 R21 host and region in a config list are the spec\'s own fields: read from the spec, checked as R21 says, never sent inside config', async () => {
  const net = vendorNet();
  const bucket = memoryBucket();
  const deps = depsWith({ bucket, fetch: net.fetch });
  const s = specs();
  const RECORD = { period: { from: '2026-10-07T10:00:00Z', to: '2026-10-07T11:00:00Z' }, counts: { files_scanned: 1 } };
  const forward = async (tool) => { const r = await handle(post('/provider/forward', { tool, record: RECORD }), deps); return [r.status, await r.json()]; };
  // The spec's top-level host completes the call; nothing under config.host is needed.
  assert.equal((await forward(s['splunk-hec']))[1].ok, true);
  // No spec host: R21's PROVIDER_UNKNOWN, also when config carries one; no spec region: REGION_UNKNOWN.
  for (const id of ['splunk-hec', 'elastic', 'syslog-tls', 'https-webhook']) {
    assert.deepEqual(await forward({ ...s[id], host: undefined, config: { ...s[id].config, host: s[id].host } }), [400, { ok: false, code: 'PROVIDER_UNKNOWN', provider_id: id }], id);
  }
  assert.deepEqual(await forward({ ...s['google-secops'], region: undefined, config: { ...s['google-secops'].config, region: s['google-secops'].region } }),
    [400, { ok: false, code: 'REGION_UNKNOWN', provider_id: 'google-secops' }]);
  // A region the descriptor does not state, a prototype key among them, is REGION_UNKNOWN, never a way to name a host (R12).
  for (const region of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.deepEqual(await forward({ ...s['google-secops'], region, host: 'elsewhere.example' }), [400, { ok: false, code: 'REGION_UNKNOWN', provider_id: 'google-secops' }], region);
  }
  assert.ok(!net.seen.some((r) => r.url.includes('elsewhere.example')));
  // The webhook's call carries no `host` or `region` setting from config.
  const seen = net.seen.length;
  assert.equal((await forward({ ...s['https-webhook'], config: { ...s['https-webhook'].config, host: 'HOST-IN-CONFIG', region: 'REGION-IN-CONFIG' } }))[1].ok, true);
  for (const r of net.seen.slice(seen)) assert.ok(!`${r.url}${r.text}`.includes('-IN-CONFIG'), 'config host and region never leave');
});
