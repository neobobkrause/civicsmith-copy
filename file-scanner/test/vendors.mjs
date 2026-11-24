// Stubs of each catalogued tool's documented API (R17), as its adapter is written against it (study N710 §2–§7, N705
// §2; the fields those marked unconfirmed are the adapters' stated assumptions). Each stub checks the call's own
// authentication, answers as the vendor would, and keeps what it was sent in `net.seen` (HTTP) or `sockets.seen` (TCP)
// for the tests to search. `state` steers the private mode (`confirm`, `refuse`, `contradict`) and a sandbox's progress.
import { createHash, generateKeyPairSync } from 'node:crypto';
import { recordingNet, enc, EICAR } from './helpers.mjs';

export const has = (bytes, needle) => Buffer.from(bytes).includes(Buffer.from(needle));
export const infected = (bytes) => has(bytes, EICAR);
const MACRO = 'vbaProject.bin';
const j = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
const xml = (s) => new Response(s, { status: 200, headers: { 'content-type': 'application/xml' } });
const deny = () => j({ error: 'unauthorised' }, 401);
const form = (rec) => Object.fromEntries(new URLSearchParams(rec.text));

/** Sentinel credentials: each value names its field, so a leak is found by searching for `SENTINEL-`. */
export const cred = (id, ...names) => Object.fromEntries(names.map((n) => [n, `SENTINEL-${id}-${n}`]));
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const SERVICE_ACCOUNT = JSON.stringify({ client_email: 'counts@project.iam.example', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token', _sentinel: 'SENTINEL-google-secops-service_account_key' });
export const HANDLING = { recipient: 'the organization', region: 'its own servers', file_retention: 'not kept', result_retention: 'not kept' };

/** The tool specs the tests send, one per catalogued provider. */
export function specs() {
  const s = (o) => ({ tool_id: `t-${o.provider_id}`, config: {}, handling_confirmed: false, ...o });
  return {
    scanii: s({ provider_id: 'scanii', region: 'eu1', credentials: cred('scanii', 'api_key', 'api_secret') }),
    'metadefender-cloud': s({ provider_id: 'metadefender-cloud', credentials: cred('mdc', 'api_key') }),
    'metadefender-core': s({ provider_id: 'metadefender-core', host: 'mdcore.example.org', credentials: cred('mdcore', 'api_key') }),
    icap: s({ provider_id: 'icap', host: 'icap.example.org:1344', config: { engine_family: ['c-icap with ClamAV'], service: 'avscan', handling: HANDLING } }),
    'defender-storage': s({ provider_id: 'defender-storage', credentials: cred('defender', 'client_id', 'client_secret'),
      config: { tenant_id: 'tenant-1', storage_account: 'orgscans', container: 'scans' } }),
    'sophos-intelix': s({ provider_id: 'sophos-intelix', region: 'de', credentials: cred('intelix', 'client_id', 'client_secret'), handling_confirmed: true }),
    'opswat-deep-cdr': s({ provider_id: 'opswat-deep-cdr', region: 'cloud', credentials: cred('deepcdr', 'api_key') }),
    'glasswall-halo': s({ provider_id: 'glasswall-halo', host: 'halo.example.org', credentials: cred('halo', 'api_token') }),
    'joe-sandbox': s({ provider_id: 'joe-sandbox', credentials: cred('joe', 'api_key') }),
    vmray: s({ provider_id: 'vmray', region: 'de', credentials: cred('vmray', 'api_key') }),
    'falcon-sandbox': s({ provider_id: 'falcon-sandbox', region: 'eu-1', credentials: cred('falcon', 'client_id', 'client_secret') }),
    wildfire: s({ provider_id: 'wildfire', region: 'eu', credentials: cred('wildfire', 'api_key'), handling_confirmed: true }),
    'cloudflare-intel': s({ provider_id: 'cloudflare-intel', credentials: cred('cfintel', 'api_token'), config: { account_id: '0123456789abcdef0123456789abcdef' } }),
    'google-web-risk': s({ provider_id: 'google-web-risk', credentials: cred('webrisk', 'api_key') }),
    'splunk-hec': s({ provider_id: 'splunk-hec', host: 'splunk.example.org:8088', credentials: cred('splunk', 'hec_token') }),
    sentinel: s({ provider_id: 'sentinel', credentials: cred('sentinel', 'client_id', 'client_secret'),
      config: { tenant_id: 'tenant-1', endpoint: 'dce-1.region-1.ingest.monitor.azure.com', dcr_id: 'dcr-1', stream: 'Custom-Counts' } }),
    'google-secops': s({ provider_id: 'google-secops', region: 'europe', credentials: { service_account_key: SERVICE_ACCOUNT },
      config: { project: 'p1', location: 'eu', instance: 'i1', log_type: 'CIVICSMITH_COUNTS' } }),
    elastic: s({ provider_id: 'elastic', host: 'elastic.example.org', credentials: cred('elastic', 'api_key'), config: { index: 'counts' } }),
    'syslog-tls': s({ provider_id: 'syslog-tls', host: 'syslog.example.org:6514', config: { engine_family: ['rsyslog'], handling: HANDLING } }),
    'https-webhook': s({ provider_id: 'https-webhook', host: 'hook.example.org', credentials: cred('webhook', 'token'), config: { path: '/intake', engine_family: ['webhook'], handling: HANDLING } }),
  };
}

// Web Risk's lists for the stubs: the test address's own hash prefix in MALWARE, and a decoy.
const sha256 = (s) => createHash('sha256').update(s).digest();
export const WEB_RISK_TEST = 'http://testsafebrowsing.appspot.com/s/malware.html';
const listed = [sha256('testsafebrowsing.appspot.com/s/malware.html').subarray(0, 4), sha256('decoy.example/').subarray(0, 4)];
const checksum = (prefixes) => createHash('sha256').update(Buffer.concat([...prefixes].sort(Buffer.compare))).digest('base64');

/** HTTP stubs for every catalogued tool. */
export function vendorNet(state = {}) {
  const st = state;
  st.mode ??= 'confirm';
  st.sandbox ??= 'done';
  const stored = new Map();
  const bearer = (rec, token) => rec.headers.authorization === `Bearer ${token}`;
  const md = (base) => (rec) => {
    const p = rec.path.replace(base, '');
    if (!rec.headers.apikey || !rec.headers.apikey.startsWith('SENTINEL-')) return deny();
    if (p === '/apikey/') return j(st.mode === 'refuse' ? { paid_mode: false } : { paid_mode: true, private_scanning: true });
    if (p === '/file' && rec.method === 'POST') {
      stored.set('md1', { bytes: rec.bytes, rule: rec.headers.rule });
      return j({ data_id: 'md1', ...(st.mode === 'contradict' ? { sample_sharing: 1 } : {}) });
    }
    if (p === '/file/md1') {
      const f = stored.get('md1');
      const bad = infected(f.bytes);
      const out = { scan_results: { progress_percentage: 100, scan_details: {
        ClamAV: { scan_result_i: bad ? 1 : 0, threat_found: bad ? 'Eicar-Test-Signature' : '', def_time: '2026-10-06T00:00:00Z', eng_version: '1.4.3' },
        Bitdefender: { scan_result_i: bad ? 1 : 0, threat_found: bad ? 'EICAR-Test-File (not a virus)' : '', def_time: '2026-10-06T00:00:00Z' },
        'Some New Engine': { scan_result_i: 0, threat_found: '' } } } };
      if (f.rule === 'sanitize') {
        out.sanitized = has(f.bytes, '%PDF') || has(f.bytes, 'PK')
          ? { result: 'Allowed', progress_percentage: 100, details: has(f.bytes, MACRO) ? [{ action: 'removed', object_name: 'Macro' }] : [] }
          : { result: 'Error', reason: 'Unsupported file type', progress_percentage: 100 };
      }
      return j(out);
    }
    if (p === '/file/converted/md1') return new Response(enc('rebuilt document'), { status: 200, headers: { 'content-type': 'application/vnd.ms-word.document.macroEnabled.12' } });
    return j({}, 404);
  };
  const sandboxDone = () => st.sandbox === 'done';
  const routes = {
    'api-eu1.scanii.com': (rec) => {
      if (rec.headers.authorization !== `Basic ${btoa('SENTINEL-scanii-api_key:SENTINEL-scanii-api_secret')}`) return deny();
      return j({ id: 'scanii-1', findings: infected(rec.bytes) ? ['content.malicious.eicar-test-signature'] : [] }, 201);
    },
    'api.metadefender.com': md('/v4'),
    'mdcore.example.org': md(''),
    'login.microsoftonline.com': (rec) => (form(rec).client_secret === 'SENTINEL-defender-client_secret' || form(rec).client_secret === 'SENTINEL-sentinel-client_secret'
      ? j({ access_token: 'azure-token' }) : deny()),
    'orgscans.blob.core.windows.net': (rec) => {
      if (!bearer(rec, 'azure-token')) return deny();
      if (rec.method === 'PUT') { stored.set(rec.path, rec.bytes); return new Response(null, { status: 201 }); }
      if (rec.method === 'DELETE') { stored.delete(rec.path); return new Response(null, { status: 202 }); }
      const b = stored.get(rec.path);
      const value = infected(b) ? 'Malicious' : 'No threats found';
      return xml(`<?xml version="1.0"?><Tags><TagSet><Tag><Key>Malware Scanning scan result</Key><Value>${value}</Value></Tag></TagSet></Tags>`);
    },
    'api.labs.sophos.com': (rec) => (rec.headers.authorization === `Basic ${btoa('SENTINEL-intelix-client_id:SENTINEL-intelix-client_secret')}` ? j({ access_token: 'intelix-token' }) : deny()),
    'de.api.labs.sophos.com': (rec) => {
      if (rec.headers.authorization !== 'intelix-token') return deny();
      if (rec.path === '/analysis/file/static/v1') return j({ jobId: 's1', jobStatus: 'SUCCESS', report: { score: infected(rec.bytes) ? 5 : 100, malwareName: infected(rec.bytes) ? 'EICAR-AV-Test' : undefined } });
      if (rec.path === '/analysis/file/dynamic/v1') { stored.set('d1', rec.bytes); return j({ jobId: 'd1', jobStatus: 'IN_PROGRESS' }, 202); }
      if (rec.path === '/analysis/file/dynamic/v1/reports/d1') {
        return sandboxDone() ? j({ jobStatus: 'SUCCESS', report: { score: infected(stored.get('d1')) ? 3 : 25, sha256: 'ab'.repeat(32) } }) : j({ jobStatus: 'IN_PROGRESS' });
      }
      return j({}, 404);
    },
    'halo.example.org': (rec) => {
      if (!bearer(rec, 'SENTINEL-halo-api_token')) return deny();
      if (!has(rec.bytes, 'PK')) return j({ error: 'unsupported' }, 415);
      return new Response(enc('rebuilt by halo'), { status: 200, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'x-sanitisation-items': JSON.stringify(has(rec.bytes, MACRO) ? ['Macro'] : []) } });
    },
    'jbxcloud.joesecurity.org': (rec) => {
      const apikey = rec.path === '/api/v2/submission/new' ? (has(rec.bytes, 'SENTINEL-joe-api_key') ? 'ok' : '') : form(rec).apikey;
      if (!apikey) return deny();
      if (rec.path === '/api/v2/account/info') return j({ data: { type: st.mode === 'refuse' ? 'basic' : 'light' } });
      if (rec.path === '/api/v2/submission/new') { stored.set('joe', rec.bytes); return j({ data: { submission_id: 'joe-1', ...(st.mode === 'contradict' ? { public: true } : {}) } }); }
      if (rec.path === '/api/v2/submission/info') {
        if (!sandboxDone()) return j({ data: { status: 'running' } });
        const bad = infected(stored.get('joe'));
        return j({ data: { status: 'finished', most_relevant_analysis: { detection: bad ? 'malicious' : 'clean', classification: bad ? 'EICAR test file' : '' }, analyses: [{ sha256: 'cd'.repeat(32) }] } });
      }
      return j({}, 404);
    },
    'eu.cloud.vmray.com': (rec) => {
      if (rec.headers.authorization !== 'api_key SENTINEL-vmray-api_key') return deny();
      if (rec.path === '/rest/sample/submit') { stored.set('vm', rec.bytes); return j({ data: { submissions: [{ submission_id: 11 }], samples: [{ sample_id: 22 }] } }); }
      if (rec.path === '/rest/submission/11') return j({ data: { submission_finished: sandboxDone() } });
      if (rec.path === '/rest/sample/22') {
        const bad = infected(stored.get('vm'));
        return j({ data: { sample_verdict: bad ? 'malicious' : 'clean', sample_threat_names: bad ? ['EICAR'] : [], sample_sha256hash: 'ef'.repeat(32) } });
      }
      return j({}, 404);
    },
    'api.eu-1.crowdstrike.com': (rec) => {
      if (rec.path === '/oauth2/token') return form(rec).client_secret === 'SENTINEL-falcon-client_secret' ? j({ access_token: 'falcon-token' }) : deny();
      if (!bearer(rec, 'falcon-token')) return deny();
      if (rec.path === '/falconx/entities/settings/v1') return j({ resources: [{ community_access: st.mode === 'refuse' }] });
      if (rec.path === '/samples/entities/samples/v2') {
        stored.set('fx', rec.bytes);
        return j({ resources: [{ sha256: '12'.repeat(32), is_confidential: st.mode !== 'contradict' }] });
      }
      if (rec.path === '/falconx/entities/submissions/v1' && rec.method === 'POST') return j({ resources: [{ id: 'fx-1' }] });
      if (rec.path === '/falconx/entities/submissions/v1') return j({ resources: [{ state: sandboxDone() ? 'success' : 'running' }] });
      if (rec.path === '/falconx/entities/report-summaries/v1') {
        const bad = infected(stored.get('fx'));
        return j({ resources: [{ verdict: bad ? 'malicious' : 'no specific threat', sandbox: [{ classification: bad ? ['EICAR'] : [], sha256: '12'.repeat(32) }] }] });
      }
      return j({}, 404);
    },
    'eu.wildfire.paloaltonetworks.com': (rec) => {
      if (!has(rec.bytes, 'SENTINEL-wildfire-api_key')) return deny();
      if (rec.path === '/publicapi/submit/file') { stored.set('wf', rec.bytes); return xml(`<wildfire><upload-file-info><sha256>${'34'.repeat(32)}</sha256></upload-file-info></wildfire>`); }
      if (rec.path === '/publicapi/get/verdict') return xml(`<wildfire><get-verdict-info><verdict>${sandboxDone() ? (infected(stored.get('wf')) ? 1 : 0) : -100}</verdict></get-verdict-info></wildfire>`);
      return j({}, 404);
    },
    'api.cloudflare.com': (rec, url) => {
      if (!bearer(rec, 'SENTINEL-cfintel-api_token')) return deny();
      const u = url.searchParams.get('url') || '';
      const bad = /testcategory\.com/.test(u);
      return j({ success: true, result: [{ url: u, content_categories: [{ id: 1, name: bad ? 'Security threats' : 'Technology' }], risk_types: bad ? [{ id: 117, name: 'Malware' }] : [] }] });
    },
    'webrisk.googleapis.com': (rec, url) => {
      if (rec.headers['x-goog-api-key'] !== 'SENTINEL-webrisk-api_key') return deny();
      if (rec.path === '/v1/threatLists:computeDiff') {
        const type = url.searchParams.get('threatType');
        const prefixes = type === 'MALWARE' ? listed : [];
        const sum = st.badChecksum ? 'AAAA' : checksum(prefixes);
        return j({ responseType: 'RESET', additions: { rawHashes: prefixes.length ? [{ prefixSize: 4, rawHashes: (st.unreadable ? Buffer.concat([...prefixes, Buffer.from([1])]) : Buffer.concat(prefixes)).toString('base64') }] : [] },
          newVersionToken: Buffer.from(`${type}-v1`).toString('base64'), checksum: { sha256: sum } });
      }
      if (rec.path === '/v1/hashes:search') {
        const prefix = Buffer.from(url.searchParams.get('hashPrefix'), 'base64');
        const full = sha256('testsafebrowsing.appspot.com/s/malware.html');
        return j({ threats: full.subarray(0, 4).equals(prefix) ? [{ threatTypes: ['MALWARE'], hash: full.toString('base64'), expireTime: '2026-10-08T00:00:00Z' }] : [] });
      }
      return j({}, 404);
    },
    'splunk.example.org': (rec) => (rec.headers.authorization === 'Splunk SENTINEL-splunk-hec_token' ? j({ text: 'Success', code: 0 }) : deny()),
    'dce-1.region-1.ingest.monitor.azure.com': (rec) => (bearer(rec, 'azure-token') ? new Response(null, { status: 204 }) : deny()),
    'oauth2.googleapis.com': (rec) => (form(rec).assertion ? j({ access_token: 'google-token' }) : deny()),
    'europe-chronicle.googleapis.com': (rec) => (bearer(rec, 'google-token') ? j({}) : deny()),
    'elastic.example.org': (rec) => (rec.headers.authorization === 'ApiKey SENTINEL-elastic-api_key' ? j({ errors: false, items: [{ index: { status: 201 } }] }) : deny()),
    'hook.example.org': (rec) => (bearer(rec, 'SENTINEL-webhook-token') ? new Response(null, { status: 204 }) : deny()),
  };
  return recordingNet(routes);
}

/** TCP for ICAP and syslog: a Workers-style socket whose peer answers once the request is complete. */
export function vendorSockets(answer = (rec) => (infected(rec.bytes()) ? 'ICAP/1.0 200 OK\r\nX-Infection-Found: Type=0; Resolution=2; Threat=Eicar-Test-Signature;\r\nEncapsulated: null-body=0\r\n\r\n' : 'ICAP/1.0 204 No Content\r\n\r\n')) {
  const seen = [];
  const connect = (address, options = {}) => {
    const chunks = [];
    let closed = false;
    const rec = { host: address.hostname, port: address.port, options, bytes: () => Buffer.concat(chunks.map((c) => Buffer.from(c))), get closed() { return closed; } };
    seen.push(rec);
    const complete = () => closed || rec.bytes().toString('latin1').endsWith('0\r\n\r\n');
    return {
      writable: new WritableStream({ write(c) { chunks.push(c); }, close() { closed = true; } }),
      readable: new ReadableStream({
        async pull(c) {
          while (!complete()) await new Promise((r) => setTimeout(r, 2));
          c.enqueue(enc(answer(rec))); c.close();
        },
      }),
      close: async () => { closed = true; },
    };
  };
  return { seen, connect };
}
