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
/** @import { Deps, Bucket, Outcome, Answer } from '../store.mjs' */
/** @import { Descriptor, ToolSpec, SpecConfig, ConfigValue, CountsRecord } from './descriptor.mjs' */
/** @import { ToolContext, TargetFile, EngineResult, Finding, ModeHooks } from './net.mjs' */
/** @import { ScanAdapter } from './scanners.mjs' */
/** @import { SandboxAdapter } from './sandboxes.mjs' */
/** @import { CdrAdapter } from './cdr.mjs' */
/** @import { ReputationAdapter } from './reputation.mjs' */
/** @import { SinkAdapter } from './sinks.mjs' */

/**
 * @typedef {ScanAdapter | SandboxAdapter | CdrAdapter | ReputationAdapter | SinkAdapter} AnyAdapter one of the five
 *   kinds' adapters
 */
/**
 * @typedef {ScanAdapter & SandboxAdapter & CdrAdapter & ReputationAdapter & SinkAdapter} Adapter the adapter
 *   checkSpec found for the kind it was asked: each route reads only that kind's members of it
 */
/** @typedef {{ok: true, d: Descriptor, adapter: Adapter, config: SpecConfig}} SpecOk the spec as R21 passed it */
/**
 * @typedef {{ok: false, code: string, reason?: string, provider_id?: string, field?: string}} SpecRefusal R21's refusal
 */
/** @typedef {SpecOk | SpecRefusal} SpecCheck */
/** @typedef {{missing: string, config?: undefined} | {missing?: undefined, config: SpecConfig}} ConfigCheck */
/**
 * @typedef {Object} VerdictFields what a verdict is made of: an engine's raw result, or what to answer instead
 * @property {string} [engine]
 * @property {string | undefined} [engine_version]
 * @property {Readonly<Record<string, string>> | null} [signatures]
 * @property {string} result
 * @property {readonly Finding[]} [findings]
 * @property {string | undefined} [reason]
 * @property {string | undefined} [detail]
 * @property {string | undefined} [vendor_ref]
 * @property {string | undefined} [sha256]
 */
/** @typedef {{refusal: Answer, reason?: undefined}} PreparedRefusal the answer to give at once */
/**
 * @typedef {Object} PreparedCall the spec, the context and the target as one call works with them
 * @property {undefined} [refusal]
 * @property {SpecOk} c
 * @property {ToolContext} ctx
 * @property {string | null} sha the target's digest as asked, null when it states none
 * @property {number} started
 */
/** @typedef {PreparedCall & {reason: string, file?: undefined, intact?: undefined}} PreparedNotSent what to answer instead of sending */
/**
 * @typedef {PreparedCall & {reason?: undefined, file: TargetFile, intact: () => Promise<boolean>}} PreparedSend the file to
 *   send, and whether every read of it was whole
 */
/** @typedef {PreparedRefusal | PreparedNotSent | PreparedSend} Prepared */
/** @typedef {{ok: true} | {ok: false, key: string}} RecordCheck R27's check of a counts record */
// The requests' own bodies, as each route reads them: the tool spec as R21 states it (checkSpec checks it before it is
// relied on), every other field as the request carries it until it is checked.
/** @typedef {{store: string, target: {capture_sha?: unknown} | null, tool: ToolSpec}} TargetCall a body naming a store, a target and a tool */
/** @typedef {{tool: ToolSpec, vendor_ref: unknown, submitted_at: string}} ResultCall R23's result call */
/** @typedef {{address: unknown, tool: ToolSpec}} ReputationCall */
/** @typedef {{tool: ToolSpec}} ToolCall */
/** @typedef {{tool: ToolSpec, record: unknown}} ForwardCall */
/** @typedef {{period: {from: string, to: string}, counts: Readonly<Record<string, number>>}} CheckedRecord */

// What the test probe says of the EICAR test file, for a scan or a sandbox (R28).
export const EICAR_FOUND = localize('file-scanner.routes.the_eicar_test_file_answered', 'the EICAR test file answered found');
// What the test probe says of a rebuilding tool that returned no file (R28, R32).
export const NO_SAFE_VIEW = localize('file-scanner.routes.no_safe_view', 'no safe view');
export const EICAR_NOT_FOUND = localize('file-scanner.routes.the_eicar_test_file_did', 'the EICAR test file did not answer found');

/** @type {Readonly<Record<string, Readonly<Record<string, AnyAdapter>>>>} */
const ADAPTERS = { scan: SCANNERS, sandbox: SANDBOXES, cdr: CDRS, url_reputation: REPUTATIONS, log_sink: SINKS };
/** @type {Readonly<Record<string, number>>} */
const STATUS = { NAMESPACE_UNKNOWN: 400, R2_NOT_CONFIGURED: 503, BAD_TARGET: 400, NOT_FOUND: 404, DIGEST_MISMATCH: 409,
  TOO_LARGE: 413, SERVICE_REFUSED: 502, SERVICE_UNREACHABLE: 502, TIME_LIMIT: 504, PRIVATE_MODE_UNCONFIRMED: 409,
  PRIVATE_MODE_NOT_HONOURED: 502, CDR_UNSUPPORTED_TYPE: 422, REPUTATION_LIST_ABSENT: 409, REPUTATION_LIST_STALE: 409,
  COUNTS_RECORD_INVALID: 400, BAD_ADDRESS: 400, PORT_REFUSED: 400, REACH_NOT_BOUND: 400, HOST_NOT_ALLOWED: 400 };
/** @param {number} status @param {object} body @returns {Answer} */
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** @param {string} code @param {object} [extra] @returns {Answer} */
const refuse = (code, extra = {}) => reply(STATUS[code] || 400, { ok: false, code, ...extra });
/** @param {unknown} s @returns {boolean} */
const isoInstant = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s));
const TOOL_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** R21: the spec's checks, in order, before anything is read or sent. `{ok:true, d, adapter}` or `{ok:false, code, …}`.
 * @param {Deps} deps @param {unknown} specIn the request's `tool` @param {string} kind @returns {SpecCheck} */
export function checkSpec(deps, specIn, kind) {
  const spec = /** @type {ToolSpec | null | undefined} decoded as R21 states it; each field checked below */ (specIn);
  if (!spec || typeof spec !== 'object' || typeof spec.provider_id !== 'string') return { ok: false, code: 'PROVIDER_UNKNOWN' };
  const id = spec.provider_id;
  const refused = REFUSED_PROVIDERS.find((r) => r.provider_id === id);
  if (refused) return { ok: false, code: 'PROVIDER_REFUSED', reason: refused.reason, provider_id: id };
  if (HELD_PROVIDERS.some((h) => h.provider_id === id)) return { ok: false, code: 'PROVIDER_HELD', provider_id: id };
  const base = providerById(id);
  if (!base) return { ok: false, code: 'PROVIDER_UNKNOWN' };
  const hosts = base.hosts, region = spec.region, host = spec.host;
  const regional = hosts && !Array.isArray(hosts);
  // Its own regions only: a region such as `toString` names no list (R12; a prototype key is no region).
  if (regional && !(typeof region === 'string' && Object.hasOwn(hosts, region))) return { ok: false, code: 'REGION_UNKNOWN', provider_id: id };
  // A regional descriptor has a list for the region by now (above).
  const needsHost = base.template || base.host_from_spec || (regional && hosts[String(region)]?.length === 0);
  if (needsHost && !(typeof host === 'string' && host)) return { ok: false, code: 'PROVIDER_UNKNOWN', provider_id: id };
  const config = configOf(base, spec);
  const missingField = config.missing;
  if (missingField) return { ok: false, code: 'CONFIG_MISSING', field: missingField, provider_id: id };
  // configOf answers `config` exactly when it names nothing missing.
  const specConfig = /** @type {SpecConfig} */ (config.config);
  const r = resolveDescriptor(base, { ...spec, config: config.config });
  if (!r.ok) return { ...r, provider_id: id };
  const d = r.descriptor;
  if (!d.kinds.includes(kind)) return { ok: false, code: 'KIND_NOT_OFFERED', provider_id: id };
  const given = spec.credentials;
  /** @type {SpecConfig} */
  const creds = given && typeof given === 'object' ? given : {};
  const missing = d.credentials.find((n) => !(typeof creds[n] === 'string' && creds[n]));
  if (missing) return { ok: false, code: 'CREDENTIALS_MISSING', field: missing, provider_id: id };
  if (d.handling.sample_sharing === 'vendor_internal_research' && spec.handling_confirmed !== true) {
    return { ok: false, code: 'HANDLING_NOT_CONFIRMED', provider_id: id };
  }
  if (d.reach === 'tunnel' && !deps.vpc) return { ok: false, code: 'REACH_NOT_BOUND', provider_id: id };
  if (host && portPart(host, 0) === 25) return { ok: false, code: 'PORT_REFUSED', provider_id: id };
  if (!TOOL_ID.test(String(spec.tool_id || ''))) return { ok: false, code: 'TOOL_SPEC_MALFORMED', field: 'tool_id', provider_id: id };
  const left = spec.monthly_limit_left;
  if (left !== undefined && !(Number(left) > 0)) return { ok: false, code: 'MONTHLY_LIMIT_REACHED', provider_id: id };
  // The adapter of the kind asked: every catalogued tool of a kind has its adapter (adapters.test.mjs).
  const adapter = /** @type {Adapter} the kind's adapter, read through that kind's members only */ (ADAPTERS[kind]?.[id]);
  return { ok: true, d, adapter, config: specConfig };
}

/** @param {unknown} v @returns {boolean} */
const present = (v) => v !== undefined && v !== null && v !== '';
/** R21 (N777): the spec's `config` as its descriptor's `config` (R19) names it: each `required` field present, else
 *  `{missing}`; a field the list does not name is dropped, so it is never read or sent. `host` and `region` (R19, T38)
 *  are the spec's own fields, checked there (`checkSpec`), never read from or added to its `config`.
 * @param {Descriptor} d @param {ToolSpec} spec @returns {ConfigCheck} */
export function configOf(d, spec) {
  const asked = spec.config;
  /** @type {SpecConfig} */
  const given = asked && typeof asked === 'object' && !Array.isArray(asked) ? asked : {};
  /** @type {Record<string, ConfigValue | undefined>} */
  const config = {};
  for (const f of d.config) {
    if (SPEC_FIELDS.includes(f.name)) continue;
    const v = Object.hasOwn(given, f.name) ? given[f.name] : undefined;
    if (present(v)) config[f.name] = v;
    else if (f.required) return { missing: f.name };
  }
  return { config: Object.freeze(config) };
}

/** @param {Deps} deps @param {ToolSpec} spec @param {SpecOk} c @param {number} started @returns {ToolContext} */
function contextOf(deps, spec, c, started) {
  const mode = c.d.mode_required;
  // The routes that reach a bucket's adapter check it is bound (R2_NOT_CONFIGURED); only a test probe may reach it unbound.
  const bucket = /** @type {Bucket} */ (deps.bucket);
  return { spec, d: c.d, config: c.config, bucket, now: deps.now, maxAge: REPUTATION_LIST_MAX_AGE_MS,
    cred: (n) => String(spec.credentials[n]), modeParams: (mode && mode.params) || {},
    cloud: spec.provider_id === 'metadefender-cloud' || spec.region === 'cloud', net: makeNet(deps, c.d, spec, started) };
}

/** R22: before the bytes or the prefix are sent, the mode is confirmed; true when no mode applies. */
/** @param {ToolContext} ctx @param {ModeHooks} adapter @returns {Promise<boolean>} */
async function modeConfirmed(ctx, adapter) {
  if (!ctx.d.mode_required || (adapter.modeApplies && !adapter.modeApplies(ctx))) return true;
  // An adapter with no check confirms nothing (as its call failing did).
  try { return (await adapter.modeCheck?.(ctx)) === true; } catch { return false; }
}

/** R31: the family name a verdict's engine is stated by. */
/** @param {Descriptor} d @param {string | undefined} reported @returns {string | undefined} */
function engineName(d, reported) {
  const family = normaliseFamily(d.engine_family);
  if (!d.per_engine || !reported) return family[0];
  const n = String(reported).toLowerCase(), squash = (/** @type {string} */ s) => s.replace(/[^a-z0-9]/g, '');
  if (family.includes(n)) return n;
  const hit = family.find((f) => f !== 'metadefender-unlisted' && (squash(n).includes(squash(f)) || squash(f).includes(squash(n))));
  return hit || (family.includes('metadefender-unlisted') ? 'metadefender-unlisted' : family[0]);
}

/**
 * A verdict (the module's `Verdict`) for one engine's raw result.
 * @param {Descriptor} d @param {string | null} capture_sha @param {number} started @param {number} now
 * @param {VerdictFields} fields
 */
function verdict(d, capture_sha, started, now, fields) {
  const { reason, detail, vendor_ref } = fields;
  return { capture_sha, tool: d.provider_id, engine: engineName(d, fields.engine), engine_version: fields.engine_version || 'not reported',
    signatures: fields.signatures || null, scanned_at: new Date(now).toISOString(), result: fields.result,
    findings: fields.result === 'found' || fields.result === 'suspicious' ? (fields.findings || []).map(String) : [],
    ...(reason ? { reason } : {}), ...(detail ? { detail } : {}),
    ...(vendor_ref ? { vendor_ref: String(vendor_ref) } : {}), latency_ms: Math.max(0, now - started) };
}
/** @param {unknown} e @returns {string} */
const reasonOf = (e) => (e instanceof ToolError ? e.code : 'SERVICE_UNREACHABLE');
/** @param {unknown} e @returns {string | undefined} */
const detailOf = (e) => { const status = e instanceof ToolError ? e.status : undefined; return status ? `HTTP:${status}` : undefined; };

/** R1, R2 and R21 for one target, then R22: the file to send, or what to answer instead. */
/** @param {Deps} deps @param {TargetCall | null} body @param {string} kind @returns {Promise<Prepared>} */
async function prepare(deps, body, kind) {
  const store = body && body.store;
  if (!body || !knownStore(store)) return { refusal: refuse('NAMESPACE_UNKNOWN') };
  const bucket = deps.bucket;
  if (!bucket) return { refusal: refuse('R2_NOT_CONFIGURED') };
  const c = checkSpec(deps, body.tool, kind);
  if (!c.ok) { const { ok, ...rest } = c; return { refusal: reply(400, { ok: false, ...rest }) }; }
  const started = deps.now();
  const ctx = contextOf(deps, /** @type {ToolSpec} checked by checkSpec */ (body.tool), c, started);
  const raw = body.target;
  const t = normaliseTarget(raw);
  const askedSha = raw && raw.capture_sha;
  const sha = t ? t.capture_sha : (raw && typeof askedSha === 'string' ? askedSha : null);
  if (!t) return { c, ctx, sha, started, reason: 'BAD_TARGET' };
  const max = Math.min(SCAN_MAX_BYTES, c.d.max_bytes || SCAN_MAX_BYTES);
  const size = await sizeTarget(bucket, store, t, max);
  if (!size.ok) return { c, ctx, sha, started, reason: size.reason };
  const whole = await verifyTarget(bucket, store, t);
  if (!whole.ok) return { c, ctx, sha, started, reason: whole.reason };
  if (!(await modeConfirmed(ctx, c.adapter))) return { c, ctx, sha, started, reason: 'PRIVATE_MODE_UNCONFIRMED' };
  /** @type {Promise<Outcome>[]} */
  const outcomes = [];
  /** @type {TargetFile} */
  const file = { bytes: size.bytes, stream: () => { const s = targetStream(bucket, store, t); outcomes.push(s.outcome); return s.stream; } };
  const intact = async () => (await Promise.all(outcomes)).every((o) => o.ok || o.reason === 'CANCELLED');
  return { c, ctx, sha, started, file, intact };
}

export const NOT_HONOURED_CODE = 'PRIVATE_MODE_NOT_HONOURED';
/** @param {string} id @returns {Answer} */
const notHonoured = (id) => reply(502, { ok: false, code: NOT_HONOURED_CODE, provider_id: id });

/** POST /provider/scan (R5). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerScan(deps, bodyIn) {
  const body = /** @type {TargetCall | null} the request's own body */ (bodyIn);
  const p = await prepare(deps, body, 'scan');
  if (p.refusal) return p.refusal;
  const { c, ctx, sha, started } = p;
  /** @param {VerdictFields} fields */
  const one = (fields) => reply(200, { ok: true, verdicts: [verdict(c.d, sha, started, deps.now(), fields)] });
  if (p.reason) return one({ result: 'not_scanned', reason: p.reason });
  // A reason is never empty: with none, the file is here.
  const send = /** @type {PreparedSend} */ (p);
  try {
    const engines = await c.adapter.scan(ctx, send.file);
    if (!(await send.intact())) return one({ result: 'not_scanned', reason: 'DIGEST_MISMATCH' });
    if (!engines.length) return one({ result: 'unknown', detail: 'NO_ENGINE_REPORTED' });
    return reply(200, { ok: true, verdicts: engines.map((e) => verdict(c.d, sha, started, deps.now(), e)) });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(c.d.provider_id);
    return one({ result: 'not_scanned', reason: reasonOf(e), detail: detailOf(e) });
  }
}

/** POST /provider/sandbox (R23). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function sandboxSubmit(deps, bodyIn) {
  const body = /** @type {TargetCall | null} the request's own body */ (bodyIn);
  const p = await prepare(deps, body, 'sandbox');
  if (p.refusal) return p.refusal;
  if (p.reason) return refuse(p.reason);
  // A reason is never empty: with none, the file is here.
  const send = /** @type {PreparedSend} */ (p);
  try {
    const s = await p.c.adapter.submit(p.ctx, send.file);
    if (!(await send.intact())) return refuse('DIGEST_MISMATCH');
    return reply(200, { ok: true, state: 'submitted', vendor_ref: s.vendor_ref, poll_after_ms: s.poll_after_ms });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(p.c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** POST /provider/sandbox/result (R23). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function sandboxResult(deps, bodyIn) {
  const body = /** @type {ResultCall} the request's own body; checkSpec refuses a missing one first */ (bodyIn);
  const c = checkSpec(deps, body && body.tool, 'sandbox');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  const vendorRef = body.vendor_ref;
  if (typeof vendorRef !== 'string' || !vendorRef || !isoInstant(body.submitted_at)) return refuse('BAD_RESULT_REQUEST');
  const started = deps.now();
  const ctx = contextOf(deps, body.tool, c, started);
  const expired = deps.now() - Date.parse(body.submitted_at) > SANDBOX_TIMEOUT_MS;
  try {
    const r = await c.adapter.result(ctx, vendorRef);
    if (r.state === 'running') {
      if (expired) return reply(200, { ok: true, state: 'done', verdicts: [verdict(c.d, null, started, deps.now(), { result: 'not_scanned', reason: 'TIME_LIMIT', vendor_ref: vendorRef })] });
      return reply(200, { ok: true, state: 'running', poll_after_ms: 60_000 });
    }
    return reply(200, { ok: true, state: 'done', verdicts: r.engines.map((e) => verdict(c.d, e.sha256 || null, started, deps.now(), { ...e, vendor_ref: vendorRef })) });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** POST /provider/cdr (R24). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerCdr(deps, bodyIn) {
  const body = /** @type {TargetCall | null} the request's own body */ (bodyIn);
  const p = await prepare(deps, body, 'cdr');
  if (p.refusal) return p.refusal;
  if (p.reason) return refuse(p.reason);
  // A reason is never empty: with none, the file is here.
  const send = /** @type {PreparedSend} */ (p);
  try {
    const out = await p.c.adapter.cdr(p.ctx, send.file);
    if (!(await send.intact())) return refuse('DIGEST_MISMATCH');
    const sha = createHash('sha256').update(out.bytes).digest('hex');
    return new Response(out.bytes, { status: 200, headers: { 'content-type': out.content_type, 'x-derived-sha256': sha,
      'x-of': p.sha, 'x-output-type': out.content_type, 'x-removed': JSON.stringify(out.removed || []), 'x-tool': p.c.d.provider_id } });
  } catch (e) {
    if (reasonOf(e) === 'PRIVATE_MODE_NOT_HONOURED') return notHonoured(p.c.d.provider_id);
    return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {});
  }
}

/** R25: a public `https:` or `http:` address, or null. @param {unknown} a @returns {string | null} */
export function publicAddress(a) {
  if (typeof a !== 'string' || a.length > 8192) return null;
  /** @type {URL} */
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

/** POST /provider/reputation (R25). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerReputation(deps, bodyIn) {
  const body = /** @type {ReputationCall} the request's own body; a missing one is refused BAD_ADDRESS first */ (bodyIn);
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

/** POST /provider/refresh (R26). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerRefresh(deps, bodyIn) {
  const body = /** @type {ToolCall} the request's own body; checkSpec refuses a missing one first */ (bodyIn);
  const c = checkSpec(deps, body && body.tool, 'url_reputation');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  if (!c.adapter.refresh) return refuse('NO_LOCAL_LIST');
  if (!deps.bucket) return refuse('R2_NOT_CONFIGURED');
  return reply(200, await c.adapter.refresh(contextOf(deps, body.tool, c, deps.now())));
}

/**
 * @typedef {{period: {from: string, to: string} | null, counts: Readonly<Record<string, unknown>> | null}} RecordAsked
 *   a counts record as a request states it: each field checked by checkRecord before it is relied on
 */
/** R27: `{ok:true}` or the key that makes the record invalid. @param {unknown} recordIn @returns {RecordCheck} */
export function checkRecord(recordIn) {
  const record = /** @type {RecordAsked | null | undefined} the request's own record */ (recordIn);
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

/** POST /provider/forward (R27). @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerForward(deps, bodyIn) {
  const body = /** @type {ForwardCall} the request's own body; a missing one is refused COUNTS_RECORD_INVALID first */ (bodyIn);
  const v = checkRecord(body && body.record);
  if (!v.ok) return refuse('COUNTS_RECORD_INVALID', { key: v.key });
  const c = checkSpec(deps, body.tool, 'log_sink');
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  const asked = /** @type {CheckedRecord} the request's own record, as checkRecord found it */ (body.record);
  /** @type {CountsRecord} */
  const record = { period: { from: asked.period.from, to: asked.period.to }, counts: { ...asked.counts } };
  try {
    await c.adapter.forward(contextOf(deps, body.tool, c, deps.now()), record);
    return reply(200, { ok: true, sent_at: new Date(deps.now()).toISOString() });
  } catch (e) { return refuse(reasonOf(e), detailOf(e) ? { detail: detailOf(e) } : {}); }
}

/** POST /provider/test (R28): the descriptor's probe through the same adapter.
 * @param {Deps} deps @param {unknown} bodyIn @returns {Promise<Answer>} */
export async function providerTest(deps, bodyIn) {
  const body = /** @type {ToolCall} the request's own body; checkSpec refuses a missing one */ (bodyIn);
  const spec = body && body.tool;
  const base = spec && providerById(spec.provider_id);
  const probe = base && base.test_probe && base.test_probe.kind;
  const kind = !base ? 'scan' : probe === 'eicar' ? (base.kinds.includes('scan') ? 'scan' : 'sandbox')
    : probe === 'macro_document' ? 'cdr' : probe === 'test_address' ? 'url_reputation' : 'log_sink';
  const c = checkSpec(deps, spec, kind);
  if (!c.ok) { const { ok, ...rest } = c; return reply(400, { ok: false, ...rest }); }
  const started = deps.now();
  const ctx = contextOf(deps, spec, c, started);
  /** @param {boolean} passed @param {string} detail */
  const answer = (passed, detail) => reply(200, { ok: true, passed, detail });
  /** @param {Uint8Array} bytes @returns {TargetFile} */
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
      // A test_address probe states its address (R19).
      const look = () => c.adapter.reputation(ctx, String(c.d.test_probe.address));
      const r = await look().catch(async (/** @type {unknown} */ e) => {
        if (!c.adapter.refresh || !/^REPUTATION_LIST_(ABSENT|STALE)$/.test(reasonOf(e))) throw e;
        const f = await c.adapter.refresh(ctx);
        if (!f.ok) throw new ToolError(String(String(f.error).split(':')[0]));
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

/** GET /providers (R29). @returns {Answer} */
export function providersList() {
  return reply(200, { ok: true, offered: PROVIDERS, refused: REFUSED_PROVIDERS, held: HELD_PROVIDERS,
    transports: PROVIDERS.filter((d) => GENERIC.includes(d.provider_id)) });
}
