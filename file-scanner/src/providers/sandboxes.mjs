/* Adapters of kind `sandbox` (R23, R22): `submit(ctx, file)` → `{vendor_ref, poll_after_ms}`, sending the bytes and the
 * tool's required parameters only; `result(ctx, vendor_ref)` → `{state:"running"}` or `{state:"done", engines}`, each
 * engine `{result, findings, sha256?, engine_version?}` with `found` for malicious, `suspicious` for suspicious, else
 * `clean`. The member keeps nothing between the two calls (R14). Endpoints follow study N710 §4; the fields it marks
 * unconfirmed are this adapter's assumptions, held by its stub test. */
import { ToolError, jsonOf, multipart, clientToken } from './net.mjs';
import { intelixSubmit, intelixToken, intelixHost, intelixResult } from './scanners.mjs';
/** @import { ToolContext, TargetFile, EngineResult, ModeHooks } from './net.mjs' */
/** @import { IntelixJob } from './scanners.mjs' */
/** @import { Answer } from '../store.mjs' */

/** @typedef {{vendor_ref: string, poll_after_ms: number}} Submission a sandbox's reference for a sample it took */
/** @typedef {{state: 'running'} | {state: 'done', engines: EngineResult[]}} SandboxResult */
/**
 * @typedef {Object} SandboxAdapterFields an adapter of kind `sandbox`
 * @property {(ctx: ToolContext, file: TargetFile) => Promise<Submission>} submit
 * @property {(ctx: ToolContext, ref: string) => Promise<SandboxResult>} result
 */
/** @typedef {ModeHooks & SandboxAdapterFields} SandboxAdapter an adapter of kind `sandbox` */
/** @typedef {Readonly<Record<string, SandboxAdapter>>} SandboxAdapters the sandboxes by `provider_id` */

// The vendors' answers, as each adapter reads them: each field as the vendor states it (study N710 §4), checked by the
// adapter before it is relied on.
/** @typedef {{data: {type: string}}} JoeAccount */
/** @typedef {{data: {public: boolean, submission_id: string, submission_ids: string[]}}} JoeSubmission */
/** @typedef {{detection: string, classification: string, threatname: string}} JoeAnalysis */
/**
 * @typedef {{data: {public: boolean, status: string, most_relevant_analysis: JoeAnalysis, analyses: {sha256: string}[]}}} JoeInfo
 */
/** @typedef {{data: {submissions: {submission_id: string}[], samples: {sample_id: string}[]}}} VmraySubmitted */
/** @typedef {{data: {submission_finished: boolean}}} VmraySubmission */
/**
 * @typedef {{data: {sample_verdict: string, sample_threat_names: string[], sample_classifications: string[], sample_sha256hash: string}}} VmraySample
 */
/** @typedef {{resources: {community_access: boolean}[]}} FalconSettings */
/** @typedef {{resources: {sha256: string, is_confidential: boolean}[]}} FalconSamples */
/** @typedef {{resources: {id: string, state: string}[]}} FalconSubmissions */
/** @typedef {{classification?: string[], threat_name?: string, sha256?: string}} FalconSandboxReport */
/** @typedef {{verdict?: string, sandbox?: FalconSandboxReport[]}} FalconSummary */
/** @typedef {{resources: FalconSummary[]}} FalconSummaries */

const POLL_AFTER_MS = 60_000;

// Joe Sandbox Cloud (Light and above). The key travels in the form body. Before a send, `account/info` must name an
// edition other than Basic (R22); an answer stating the analysis public contradicts the mode.
const JOE = 'https://jbxcloud.joesecurity.org/api/v2';
/** @param {ToolContext} ctx @param {Readonly<Record<string, string>>} extra */
const joeForm = (ctx, extra) => {
  const f = new URLSearchParams({ apikey: ctx.cred('api_key'), ...ctx.modeParams, ...extra });
  return { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: f.toString() };
};
/** @param {unknown} d @returns {string} */
const joeVerdict = (d) => (d === 'malicious' ? 'found' : d === 'suspicious' ? 'suspicious' : 'clean');
/** @type {SandboxAdapter} */
const joe = {
  async modeCheck(ctx) {
    const j = /** @type {JoeAccount} */ (await jsonOf(await ctx.net.http(`${JOE}/account/info`, joeForm(ctx, {}))));
    const type = j && j.data && j.data.type;
    return typeof type === 'string' && type.length > 0 && !/basic/i.test(type);
  },
  async submit(ctx, file) {
    const mp = multipart({ apikey: ctx.cred('api_key'), ...ctx.modeParams }, 'sample', file);
    const j = /** @type {JoeSubmission} */ (await jsonOf(await ctx.net.http(`${JOE}/submission/new`, { method: 'POST', headers: mp.headers, body: mp.body })));
    if (j.data && j.data.public === true) throw new ToolError('PRIVATE_MODE_NOT_HONOURED');
    const id = j.data && (j.data.submission_id || (j.data.submission_ids || [])[0]);
    if (!id) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    return { vendor_ref: String(id), poll_after_ms: POLL_AFTER_MS };
  },
  async result(ctx, ref) {
    const j = /** @type {JoeInfo} */ (await jsonOf(await ctx.net.http(`${JOE}/submission/info`, joeForm(ctx, { submission_id: ref }))));
    const d = j.data || {};
    if (d.public === true) throw new ToolError('PRIVATE_MODE_NOT_HONOURED');
    if (d.status !== 'finished') return { state: 'running' };
    const a = d.most_relevant_analysis || {};
    const result = joeVerdict(a.detection);
    const names = [a.classification, a.threatname].filter((x) => typeof x === 'string' && x);
    return { state: 'done', engines: [{ result, findings: result === 'clean' ? [] : (names.length ? names : [a.detection]),
      sha256: (d.analyses && d.analyses[0] && d.analyses[0].sha256) || undefined }] };
  },
};

// VMRay: the sample submitted with the key in its own header; the reference carries the submission and sample ids.
/** @param {ToolContext} ctx @returns {Readonly<Record<string, string>>} */
const vmrayAuth = (ctx) => ({ authorization: `api_key ${ctx.cred('api_key')}` });
/** @type {SandboxAdapter} */
const vmray = {
  async submit(ctx, file) {
    const mp = multipart({}, 'sample_file', file);
    const j = /** @type {VmraySubmitted} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/rest/sample/submit`,
      { method: 'POST', headers: { ...mp.headers, ...vmrayAuth(ctx) }, body: mp.body })));
    const sub = j.data && j.data.submissions && j.data.submissions[0];
    const sample = j.data && j.data.samples && j.data.samples[0];
    if (!sub || !sample) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    return { vendor_ref: `${sub.submission_id}:${sample.sample_id}`, poll_after_ms: POLL_AFTER_MS };
  },
  async result(ctx, ref) {
    const [sid, sample] = String(ref).split(':');
    if (!/^\d+$/.test(sid || '') || !/^\d+$/.test(sample || '')) throw new ToolError('BAD_VENDOR_REF');
    const s = /** @type {VmraySubmission} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/rest/submission/${sid}`, { headers: vmrayAuth(ctx) })));
    if (!(s.data && s.data.submission_finished)) return { state: 'running' };
    const j = /** @type {VmraySample} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/rest/sample/${sample}`, { headers: vmrayAuth(ctx) })));
    const d = j.data || {};
    const result = joeVerdict(d.sample_verdict);
    const names = [...(d.sample_threat_names || []), ...(d.sample_classifications || [])].map(String);
    return { state: 'done', engines: [{ result, findings: result === 'clean' ? [] : (names.length ? names : [d.sample_verdict]),
      sha256: d.sample_sha256hash || undefined }] };
  },
};

// CrowdStrike Falcon Sandbox: an OAuth token; the sample uploaded confidential (community access forced off, R22),
// then submitted by its SHA-256. Before a send, the client's settings must state community access off (the assumed
// `GET /falconx/entities/settings/v1`); an upload answer stating `is_confidential: false` contradicts the mode.
/** @param {ToolContext} ctx @returns {Promise<string>} */
const falconToken = (ctx) => clientToken(ctx.net, `https://${ctx.net.allowed[0]}/oauth2/token`,
  { client_id: ctx.cred('client_id'), client_secret: ctx.cred('client_secret') });
/** @type {SandboxAdapter} */
const falcon = {
  async modeCheck(ctx) {
    const token = await falconToken(ctx);
    const j = /** @type {FalconSettings} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/falconx/entities/settings/v1`, { headers: { authorization: `Bearer ${token}` } })));
    const r = j.resources && j.resources[0];
    return !!r && r.community_access === false;
  },
  async submit(ctx, file) {
    const token = await falconToken(ctx);
    /** @type {Readonly<Record<string, string>>} */
    const auth = { authorization: `Bearer ${token}` };
    const mp = multipart({ ...ctx.modeParams, file_name: 'sample' }, 'sample', file);
    const up = /** @type {FalconSamples} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/samples/entities/samples/v2`,
      { method: 'POST', headers: { ...mp.headers, ...auth }, body: mp.body })));
    const sample = up.resources && up.resources[0];
    if (!sample || !sample.sha256) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    if (sample.is_confidential === false) throw new ToolError('PRIVATE_MODE_NOT_HONOURED');
    const env = Number(ctx.config.environment_id) || 160;
    const sub = /** @type {FalconSubmissions} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/falconx/entities/submissions/v1`, {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ sandbox: [{ sha256: sample.sha256, environment_id: env }], send_email_notification: false }) })));
    const id = sub.resources && sub.resources[0] && sub.resources[0].id;
    if (!id) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    return { vendor_ref: id, poll_after_ms: POLL_AFTER_MS };
  },
  async result(ctx, ref) {
    const token = await falconToken(ctx);
    /** @type {Readonly<Record<string, string>>} */
    const auth = { authorization: `Bearer ${token}` };
    const s = /** @type {FalconSubmissions} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/falconx/entities/submissions/v1?ids=${encodeURIComponent(ref)}`, { headers: auth })));
    const state = s.resources && s.resources[0] && s.resources[0].state;
    if (state === 'error') return { state: 'done', engines: [{ result: 'unknown', findings: [], detail: 'FALCON:error' }] };
    if (state !== 'success') return { state: 'running' };
    const r = /** @type {FalconSummaries} */ (await jsonOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/falconx/entities/report-summaries/v1?ids=${encodeURIComponent(ref)}`, { headers: auth })));
    /** @type {FalconSummary} */
    const rep = (r.resources && r.resources[0]) || {};
    const verdict = String(rep.verdict || '');
    const result = /malicious/i.test(verdict) ? 'found' : /suspicious/i.test(verdict) ? 'suspicious' : 'clean';
    const reports = rep.sandbox;
    /** @type {FalconSandboxReport} */
    const sb = (reports && reports[0]) || {};
    const names = [...(sb.classification || []), sb.threat_name].filter((x) => typeof x === 'string' && x);
    return { state: 'done', engines: [{ result, findings: result === 'clean' ? [] : (names.length ? names : [verdict]), sha256: sb.sha256 || undefined }] };
  },
};

// Palo Alto WildFire (standalone API): XML answers; the verdict codes 0 benign, 1 malware, 2 grayware, 4 phishing,
// 5 command and control, -100 pending.
/** @param {string} text @param {string} tag @returns {string | null | undefined} */
const xml = (text, tag) => { const m = new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`).exec(text); return m ? m[1] : null; };
/** @type {Readonly<Record<number, string>>} */
const WF_NAMES = { 1: 'WildFire.malware', 2: 'WildFire.grayware', 4: 'WildFire.phishing', 5: 'WildFire.c2' };
/** @param {Answer} res @returns {Promise<string>} */
async function xmlOf(res) {
  if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new ToolError('SERVICE_REFUSED', { status: res.status }); }
  return res.text();
}
/** @type {SandboxAdapter} */
const wildfire = {
  async submit(ctx, file) {
    const mp = multipart({ apikey: ctx.cred('api_key') }, 'file', file);
    const t = await xmlOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/publicapi/submit/file`, { method: 'POST', headers: mp.headers, body: mp.body }));
    const sha = xml(t, 'sha256');
    if (!sha) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    return { vendor_ref: sha, poll_after_ms: POLL_AFTER_MS };
  },
  async result(ctx, ref) {
    const body = new URLSearchParams({ apikey: ctx.cred('api_key'), hash: ref }).toString();
    const t = await xmlOf(await ctx.net.http(`https://${ctx.net.allowed[0]}/publicapi/get/verdict`,
      { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }));
    const v = Number(xml(t, 'verdict'));
    if (v === -100) return { state: 'running' };
    if (v === 0) return { state: 'done', engines: [{ result: 'clean', findings: [], sha256: ref }] };
    if (v === 2) return { state: 'done', engines: [{ result: 'suspicious', findings: [WF_NAMES[2]], sha256: ref }] };
    if (WF_NAMES[v]) return { state: 'done', engines: [{ result: 'found', findings: [WF_NAMES[v]], sha256: ref }] };
    return { state: 'done', engines: [{ result: 'unknown', findings: [], detail: `WILDFIRE:${Number.isFinite(v) ? v : 'unreadable'}`, sha256: ref }] };
  },
};

// SophosLabs Intelix dynamic analysis: as its static analysis (scanners.mjs), on the dynamic endpoint.
/** @type {SandboxAdapter} */
const intelixDynamic = {
  async submit(ctx, file) {
    const { j } = await intelixSubmit(ctx, file, 'dynamic');
    if (!j.jobId) throw new ToolError('SERVICE_REFUSED', { status: 502 });
    return { vendor_ref: j.jobId, poll_after_ms: POLL_AFTER_MS };
  },
  async result(ctx, ref) {
    const token = await intelixToken(ctx);
    const j = /** @type {IntelixJob} */ (await jsonOf(await ctx.net.http(`https://${intelixHost(ctx)}/analysis/file/dynamic/v1/reports/${encodeURIComponent(ref)}`,
      { headers: { authorization: token } })));
    if (j.jobStatus !== 'SUCCESS') return { state: 'running' };
    return { state: 'done', engines: [{ ...intelixResult(j.report), sha256: (j.report && j.report.sha256) || undefined }] };
  },
};

/** @type {SandboxAdapters} */
export const SANDBOXES = Object.freeze({ 'joe-sandbox': joe, vmray, 'falcon-sandbox': falcon, wildfire, 'sophos-intelix': intelixDynamic });
