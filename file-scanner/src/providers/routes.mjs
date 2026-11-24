/* The outside tools' routes (R5, R21–R29): the tool spec checked before anything is read or sent (R21), the target's
 * checks as R1 and R2 (one target), private mode checked per call before a send (R22), then the tool's adapter through
 * the guarded network (net.mjs). The spec's credentials are used for the call only and appear in no answer (R13). */
import { SCAN_MAX_BYTES, SANDBOX_TIMEOUT_MS, REPUTATION_LIST_MAX_AGE_MS, LOG_COUNT_KINDS, PROVIDER_TIMEOUT_MS } from '../limits.mjs';
import { normaliseTarget, knownStore, sizeTarget, verifyTarget, targetStream } from '../store.mjs';
import { PROVIDERS, REFUSED_PROVIDERS, HELD_PROVIDERS, GENERIC, providerById, resolveDescriptor } from './catalogue.mjs';
import { normaliseFamily, SPEC_FIELDS } from './descriptor.mjs';
import { ToolError, makeNet, portPart, sleep } from './net.mjs';
import { SCANNERS } from './scanners.mjs';
import { SANDBOXES } from './sandboxes.mjs';
import { CDRS } from './cdr.mjs';
import { REPUTATIONS } from './reputation.mjs';
import { SINKS } from './sinks.mjs';
import { eicar, macroDocument, zeroCounts } from './probes.mjs';
import { createHash } from 'node:crypto';
import { localize } from '../../../bio-plane/src/setup-words/index.mjs';

// What the test probe says of the EICAR test file, for a scan or a sandbox (R28).
export const EICAR_FOUND = localize('file-scanner.routes.the_eicar_test_file_answered', 'the EICAR test file answered found');
// What the test probe says of a rebuilding tool that returned no file (R28, R32).
export const NO_SAFE_VIEW = localize('file-scanner.routes.no_safe_view', 'no safe view');
export const EICAR_NOT_FOUND = localize('file-scanner.routes.the_eicar_test_file_did', 'the EICAR test file did not answer found');

const ADAPTERS = { scan: SCANNERS, sandbox: SANDBOXES, cdr: CDRS, url_reputation: REPUTATIONS, log_sink: SINKS };
const STATUS = { NAMESPACE_UNKNOWN: 400, R2_NOT_CONFIGURED: 503, BAD_TARGET: 400, NOT_FOUND: 404, DIGEST_MISMATCH: 409,
  TOO_LARGE: 413, SERVICE_REFUSED: 502, SERVICE_UNREACHABLE: 502, TIME_LIMIT: 504, PRIVATE_MODE_UNCONFIRMED: 409,
  PRIVATE_MODE_NOT_HONOURED: 502, CDR_UNSUPPORTED_TYPE: 422, REPUTATION_LIST_ABSENT: 409, REPUTATION_LIST_STALE: 409,
  COUNTS_RECORD_INVALID: 400, BAD_ADDRESS: 400, PORT_REFUSED: 400, REACH_NOT_BOUND: 400, HOST_NOT_ALLOWED: 400 };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const refuse = (code, extra = {}) => reply(STATUS[code] || 400, { ok: false, code, ...extra });
const isoInstant = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s));
const TOOL_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** R21: the spec's checks, in order, before anything is read or sent. `{ok:true, d, adapter}` or `{ok:false, code, …}`. */
export function checkSpec(deps, spec, kind) {
  if (!spec || typeof spec !== 'object' || typeof spec.provider_id !== 'string') return { ok: false, code: 'PROVIDER_UNKNOWN' };
  const id = spec.provider_id;
  const refused = REFUSED_PROVIDERS.find((r) => r.provider_id === id);
  if (refused) return { ok: false, code: 'PROVIDER_REFUSED', reason: refused.reason, provider_id: id };
  if (HELD_PROVIDERS.some((h) => h.provider_id === id)) return { ok: false, code: 'PROVIDER_HELD', provider_id: id };
  const base = providerById(id);
  if (!base) return { ok: false, code: 'PROVIDER_UNKNOWN' };
  const regional = base.hosts && !Array.isArray(base.hosts);
  // Its own regions only: a region such as `toString` names no list (R12; a prototype key is no region).
  if (regional && !(typeof spec.region === 'string' && Object.hasOwn(base.hosts, spec.region))) return { ok: false, code: 'REGION_UNKNOWN', provider_id: id };
  const needsHost = base.template || base.host_from_spec || (regional && base.hosts[spec.region].length === 0);
  if (needsHost && !(typeof spec.host === 'string' && spec.host)) return { ok: false, code: 'PROVIDER_UNKNOWN', provider_id: id };
  const config = configOf(base, spec);
  if (config.missing) return { ok: false, code: 'CONFIG_MISSING', field: config.missing, provider_id: id };
  const r = resolveDescriptor(base, { ...spec, config: config.config });
  if (!r.ok) return { ...r, provider_id: id };
  const d = r.descriptor;
  if (!d.kinds.includes(kind)) return { ok: false, code: 'KIND_NOT_OFFERED', provider_id: id };
  const creds = spec.credentials && typeof spec.credentials === 'object' ? spec.credentials : {};
  const missing = d.credentials.find((n) => !(typeof creds[n] === 'string' && creds[n]));
  if (missing) return { ok: false, code: 'CREDENTIALS_MISSING', field: missing, provider_id: id };
  if (d.handling.sample_sharing === 'vendor_internal_research' && spec.handling_confirmed !== true) {
    return { ok: false, code: 'HANDLING_NOT_CONFIRMED', provider_id: id };
  }
  if (d.reach === 'tunnel' && !deps.vpc) return { ok: false, code: 'REACH_NOT_BOUND', provider_id: id };
  if (spec.host && portPart(spec.host, 0) === 25) return { ok: false, code: 'PORT_REFUSED', provider_id: id };
  if (!TOOL_ID.test(String(spec.tool_id || ''))) return { ok: false, code: 'TOOL_SPEC_MALFORMED', field: 'tool_id', provider_id: id };
  if (spec.monthly_limit_left !== undefined && !(Number(spec.monthly_limit_left) > 0)) return { ok: false, code: 'MONTHLY_LIMIT_REACHED', provider_id: id };
  return { ok: true, d, adapter: ADAPTERS[kind][id], config: config.config };
}

const present = (v) => v !== undefined && v !== null && v !== '';
/** R21 (N777): the spec's `config` as its descriptor's `config` (R19) names it: each `required` field present, else
 *  `{missing}`; a field the list does not name is dropped, so it is never read or sent. `host` and `region` (R19, T38)
 *  are the spec's own fields, checked there (`checkSpec`), never read from or added to its `config`. */
export function configOf(d, spec) {
  const given = spec.config && typeof spec.config === 'object' && !Array.isArray(spec.config) ? spec.config : {};
  const config = {};
  for (const f of d.config) {
    if (SPEC_FIELDS.includes(f.name)) continue;
    const v = Object.hasOwn(given, f.name) ? given[f.name] : undefined;
    if (present(v)) config[f.name] = v;
    else if (f.required) return { missing: f.name };
  }
  return { config: Object.freeze(config) };
}

function contextOf(deps, spec, c, started) {
  return { spec, d: c.d, config: c.config, bucket: deps.bucket, now: deps.now, maxAge: REPUTATION_LIST_MAX_AGE_MS,
    cred: (n) => String(spec.credentials[n]), modeParams: (c.d.mode_required && c.d.mode_required.params) || {},
    cloud: spec.provider_id === 'metadefender-cloud' || spec.region === 'cloud', net: makeNet(deps, c.d, spec, started) };
}

/** R22: before the bytes or the prefix are sent, the mode is confirmed; true when no mode applies. */
async function modeConfirmed(ctx, adapter) {
  if (!ctx.d.mode_required || (adapter.modeApplies && !adapter.modeApplies(ctx))) return true;
  try { return (await adapter.modeCheck(ctx)) === true; } catch { return false; }
}

/** R31: the family name a verdict's engine is stated by. */
function engineName(d, reported) {
  const family = normaliseFamily(d.engine_family);
  if (!d.per_engine || !reported) return family[0];
  const n = String(reported).toLowerCase(), squash = (s) => s.replace(/[^a-z0-9]/g, '');
  if (family.includes(n)) return n;
  const hit = family.find((f) => f !== 'metadefender-unlisted' && (squash(n).includes(squash(f)) || squash(f).includes(squash(n))));
  return hit || (family.includes('metadefender-unlisted') ? 'metadefender-unlisted' : family[0]);
}

function verdict(d, capture_sha, started, now, fields) {
  return { capture_sha, tool: d.provider_id, engine: engineName(d, fields.engine), engine_version: fields.engine_version || 'not reported',
    signatures: fields.signatures || null, scanned_at: new Date(now).toISOString(), result: fields.result,
    findings: fields.result === 'found' || fields.result === 'suspicious' ? (fields.findings || []).map(String) : [],
    ...(fields.reason ? { reason: fields.reason } : {}), ...(fields.detail ? { detail: fields.detail } : {}),
    ...(fields.vendor_ref ? { vendor_ref: String(fields.vendor_ref) } : {}), latency_ms: Math.max(0, now - started) };
}
const reasonOf = (e) => (e instanceof ToolError ? e.code : 'SERVICE_UNREACHABLE');
const detailOf = (e) => (e instanceof ToolError && e.status ? `HTTP:${e.status}` : undefined);

/** R1, R2 and R21 for one target, then R22: the file to send, or what to answer instead. */
async function prepare(deps, body, kind) {
  if (!body || !knownStore(body.store)) return { refusal: refuse('NAMESPACE_UNKNOWN') };
  if (!deps.bucket) return { refusal: refuse('R2_NOT_CONFIGURED') };
  const c = checkSpec(deps, body.tool, kind);
  if (!c.ok) { const { ok, ...rest } = c; return { refusal: reply(400, { ok: false, ...rest }) }; }
  const started = deps.now();
  const ctx = contextOf(deps, body.tool, c, started);
  const raw = body.target;
  const t = normaliseTarget(raw);
  const sha = t ? t.capture_sha : (raw && typeof raw.capture_sha === 'string' ? raw.capture_sha : null);
  if (!t) return { c, ctx, sha, started, reason: 'BAD_TARGET' };
  const max = Math.min(SCAN_MAX_BYTES, c.d.max_bytes || SCAN_MAX_BYTES);
  const size = await sizeTarget(deps.bucket, body.store, t, max);
  if (!size.ok) return { c, ctx, sha, started, reason: size.reason };
  const whole = await verifyTarget(deps.bucket, body.store, t);
  if (!whole.ok) return { c, ctx, sha, started, reason: whole.reason };
  if (!(await modeConfirmed(ctx, c.adapter))) return { c, ctx, sha, started, reason: 'PRIVATE_MODE_UNCONFIRMED' };
  const outcomes = [];
  const file = { bytes: size.bytes, stream: () => { const s = targetStream(deps.bucket, body.store, t); outcomes.push(s.outcome); return s.stream; } };
  const intact = async () => (await Promise.all(outcomes)).every((o) => o.ok || o.reason === 'CANCELLED');
  return { c, ctx, sha, started, file, intact };
}

export const NOT_HONOURED_CODE = 'PRIVATE_MODE_NOT_HONOURED';
const notHonoured = (id) => reply(502, { ok: false, code: NOT_HONOURED_CODE, provider_id: id });

/** POST /provider/scan (R5). */
export async function providerScan(deps, body) {
  const p = await prepare(deps, body, 'scan');
  if (p.refusal) return p.refusal;
  const { c, ctx, sha, started } = p;
  const one = (fields) => reply(200, { ok: true, verdicts: [verdict(c.d, sha, started, deps.now(), fields)] });
  if (p.reason) return one({ result: 'not_scanned', reason: p.reason });
  try {
    const engines = await c.adapter.scan(ctx, p.file);
    if (!(await p.intact())) return one({ result: 'not_scanned', reason: 'DIGEST_MISMATCH' });
    if (!engines.length) return one({ result: 'unknown', detail: 'NO_ENGINE_REPORTED' });
    return reply(200, { ok: true, verdicts: engines.map((e) => verdict(c.d, sha, started, deps.now(), e)) });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(c.d.provider_id);
    return one({ result: 'not_scanned', reason: reasonOf(e), detail: detailOf(e) });
  }
}

/** POST /provider/sandbox (R23). */
export async function sandboxSubmit(deps, body) {
  const p = await prepare(deps, body, 'sandbox');
  if (p.refusal) return p.refusal;
  if (p.reason) return refuse(p.reason);
  try {
    const s = await p.c.adapter.submit(p.ctx, p.file);
    if (!(await p.intact())) return refuse('DIGEST_MISMATCH');
    return reply(200, { ok: true, state: 'submitted', vendor_ref: s.vendor_ref, poll_after_ms: s.poll_after_ms });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(p.c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** POST /provider/sandbox/result (R23). */
export async function sandboxResult(deps, body) {
  const c = checkSpec(deps, body && body.tool, 'sandbox');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  if (typeof body.vendor_ref !== 'string' || !body.vendor_ref || !isoInstant(body.submitted_at)) return refuse('BAD_RESULT_REQUEST');
  const started = deps.now();
  const ctx = contextOf(deps, body.tool, c, started);
  const expired = deps.now() - Date.parse(body.submitted_at) > SANDBOX_TIMEOUT_MS;
  try {
    const r = await c.adapter.result(ctx, body.vendor_ref);
    if (r.state === 'running') {
      if (expired) return reply(200, { ok: true, state: 'done', verdicts: [verdict(c.d, null, started, deps.now(), { result: 'not_scanned', reason: 'TIME_LIMIT', vendor_ref: body.vendor_ref })] });
      return reply(200, { ok: true, state: 'running', poll_after_ms: 60_000 });
    }
    return reply(200, { ok: true, state: 'done', verdicts: r.engines.map((e) => verdict(c.d, e.sha256 || null, started, deps.now(), { ...e, vendor_ref: body.vendor_ref })) });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** POST /provider/cdr (R24). */
export async function providerCdr(deps, body) {
  const p = await prepare(deps, body, 'cdr');
  if (p.refusal) return p.refusal;
  if (p.reason) return refuse(p.reason);
  try {
    const out = await p.c.adapter.cdr(p.ctx, p.file);
    if (!(await p.intact())) return refuse('DIGEST_MISMATCH');
    const sha = createHash('sha256').update(out.bytes).digest('hex');
    return new Response(out.bytes, { status: 200, headers: { 'content-type': out.content_type, 'x-derived-sha256': sha,
      'x-of': p.sha, 'x-output-type': out.content_type, 'x-removed': JSON.stringify(out.removed || []), 'x-tool': p.c.d.provider_id } });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(p.c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** R25: a public `https:` or `http:` address, or null. */
export function publicAddress(a) {
  if (typeof a !== 'string' || a.length > 8192) return null;
  let u;
  try { u = new URL(a); } catch { return null; }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!h.includes('.') && !h.includes(':')) return null;
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.arpa)$/.test(h)) return null;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (v4) {
    const [a1, a2] = [Number(v4[1]), Number(v4[2])];
    if (a1 === 0 || a1 === 10 || a1 === 127 || (a1 === 169 && a2 === 254) || (a1 === 172 && a2 >= 16 && a2 <= 31)
      || (a1 === 192 && a2 === 168) || (a1 === 100 && a2 >= 64 && a2 <= 127) || a1 >= 224) return null;
  }
  if (h.includes(':') && (/^(::1?|fe[89ab][0-9a-f]:.*|f[cd][0-9a-f]{2}:.*|::ffff:.*)$/.test(h))) return null;
  return u.href;
}

/** POST /provider/reputation (R25). */
export async function providerReputation(deps, body) {
  const address = publicAddress(body && body.address);
  if (!address) return refuse('BAD_ADDRESS');
  const c = checkSpec(deps, body.tool, 'url_reputation');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  if (c.adapter.localList && !deps.bucket) return refuse('R2_NOT_CONFIGURED');
  const ctx = contextOf(deps, body.tool, c, deps.now());
  try {
    const r = await c.adapter.reputation(ctx, address);
    return reply(200, { ok: true, listed: r.listed === true, categories: r.categories, risk: r.risk, source: c.d.provider_id,
      lookup_privacy: c.adapter.lookup_privacy });
  } catch (e) { return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {}); }
}

/** POST /provider/refresh (R26). */
export async function providerRefresh(deps, body) {
  const c = checkSpec(deps, body && body.tool, 'url_reputation');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  if (!c.adapter.refresh) return refuse('NO_LOCAL_LIST');
  if (!deps.bucket) return refuse('R2_NOT_CONFIGURED');
  return reply(200, await c.adapter.refresh(contextOf(deps, body.tool, c, deps.now())));
}

/** R27: `{ok:true}` or the key that makes the record invalid. */
export function checkRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { ok: false, key: 'record' };
  for (const k of Object.keys(record)) if (k !== 'period' && k !== 'counts') return { ok: false, key: k };
  const p = record.period;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, key: 'period' };
  for (const k of Object.keys(p)) if (k !== 'from' && k !== 'to') return { ok: false, key: `period.${k}` };
  if (!isoInstant(p.from)) return { ok: false, key: 'period.from' };
  if (!isoInstant(p.to) || !(Date.parse(p.from) < Date.parse(p.to))) return { ok: false, key: 'period.to' };
  const c = record.counts;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, key: 'counts' };
  for (const [k, v] of Object.entries(c)) {
    if (!LOG_COUNT_KINDS.includes(k)) return { ok: false, key: `counts.${k}` };
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return { ok: false, key: `counts.${k}` };
  }
  return { ok: true };
}

/** POST /provider/forward (R27). */
export async function providerForward(deps, body) {
  const v = checkRecord(body && body.record);
  if (!v.ok) return refuse('COUNTS_RECORD_INVALID', { key: v.key });
  const c = checkSpec(deps, body.tool, 'log_sink');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  const record = { period: { from: body.record.period.from, to: body.record.period.to }, counts: { ...body.record.counts } };
  try {
    await c.adapter.forward(contextOf(deps, body.tool, c, deps.now()), record);
    return reply(200, { ok: true, sent_at: new Date(deps.now()).toISOString() });
  } catch (e) { return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {}); }
}

/** POST /provider/test (R28): the descriptor's probe through the same adapter. */
export async function providerTest(deps, body) {
  const spec = body && body.tool;
  const base = spec && providerById(spec.provider_id);
  const probe = base && base.test_probe && base.test_probe.kind;
  const kind = !base ? 'scan' : probe === 'eicar' ? (base.kinds.includes('scan') ? 'scan' : 'sandbox')
    : probe === 'macro_document' ? 'cdr' : probe === 'test_address' ? 'url_reputation' : 'log_sink';
  const c = checkSpec(deps, spec, kind);
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  const started = deps.now();
  const ctx = contextOf(deps, spec, c, started);
  const answer = (passed, detail) => reply(200, { ok: true, passed, detail });
  const inMemory = (bytes) => ({ bytes: bytes.length, stream: () => new Response(bytes).body });
  try {
    if (kind === 'scan' || kind === 'sandbox' || kind === 'cdr') {
      if (!(await modeConfirmed(ctx, c.adapter))) return answer(false, 'PRIVATE_MODE_UNCONFIRMED');
    }
    if (kind === 'scan') {
      const engines = await c.adapter.scan(ctx, inMemory(eicar()));
      return engines.some((e) => e.result === 'found') ? answer(true, EICAR_FOUND)
        : answer(false, EICAR_NOT_FOUND);
    }
    if (kind === 'sandbox') {
      const s = await c.adapter.submit(ctx, inMemory(eicar()));
      for (;;) {
        const r = await c.adapter.result(ctx, s.vendor_ref);
        if (r.state === 'done') {
          return r.engines.some((e) => e.result === 'found') ? answer(true, EICAR_FOUND)
            : answer(false, EICAR_NOT_FOUND);
        }
        const wait = Math.min(s.poll_after_ms || 5_000, 5_000);
        if (ctx.net.left() <= wait) return answer(false, localize('file-scanner.routes.the_sandbox_was_still_running', 'the sandbox was still running after {PROVIDER_TIMEOUT_MS} ms', { PROVIDER_TIMEOUT_MS: String(PROVIDER_TIMEOUT_MS) }));
        await sleep(wait);
      }
    }
    if (kind === 'cdr') {
      // R32: what a rebuilding tool gives is, in members' words, a safe view.
      const out = await c.adapter.cdr(ctx, inMemory(macroDocument()));
      return out.bytes.length && (out.removed || []).length ? answer(true, localize('file-scanner.routes.removed_names', 'removed: {names}', { names: out.removed.join(', ') }))
        : answer(false, out.bytes.length ? localize('file-scanner.routes.the_safe_view_reported_nothing', 'the safe view reported nothing removed') : NO_SAFE_VIEW);
    }
    if (kind === 'url_reputation') {
      // A tool with a local list fetches it first when it holds none, or none fresh (R26).
      const look = () => c.adapter.reputation(ctx, c.d.test_probe.address);
      const r = await look().catch(async (e) => {
        if (!c.adapter.refresh || !/^REPUTATION_LIST_(ABSENT|STALE)$/.test(reasonOf(e))) throw e;
        const f = await c.adapter.refresh(ctx);
        if (!f.ok) throw new ToolError(String(f.error).split(':')[0]);
        return look();
      });
      return r.listed ? answer(true, localize('file-scanner.routes.the_test_address_answered', 'the test address answered listed')) : answer(false, localize('file-scanner.routes.the_test_address_did', 'the test address did not answer listed'));
    }
    await c.adapter.forward(ctx, zeroCounts(deps.now()));
    return answer(true, localize('file-scanner.routes.a_test_record_of', 'a test record of zero counts was accepted'));
  } catch (e) {
    return answer(false, `${reasonOf(e)}${detailOf(e) ? ` ${detailOf(e)}` : ''}`);
  }
}

/** GET /providers (R29). */
export function providersList() {
  return reply(200, { ok: true, offered: PROVIDERS, refused: REFUSED_PROVIDERS, held: HELD_PROVIDERS,
    transports: PROVIDERS.filter((d) => GENERIC.includes(d.provider_id)) });
}
