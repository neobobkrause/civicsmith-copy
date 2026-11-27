/* Adapters of kind `log_sink` (R27, R30; K1892): `forward(ctx, record)` sends the counts record, already checked, in the
 * tool's transport shape and nothing else: no file digest, name, member, address or request detail. */
import { ToolError, jsonOf, clientToken, hostPart, portPart } from './net.mjs';
import { baseOf } from './scanners.mjs';
/** @import { ToolContext, TokenAnswer } from './net.mjs' */
/** @import { CountsRecord } from './descriptor.mjs' */
/** @import { Answer } from '../store.mjs' */

/**
 * @typedef {Object} SinkAdapter an adapter of kind `log_sink`
 * @property {(ctx: ToolContext, record: CountsRecord) => Promise<void>} forward the record, in the tool's transport shape
 */
/** @typedef {Readonly<Record<string, SinkAdapter>>} SinkAdapters the log sinks by `provider_id` */
/** @typedef {{'content-type': string, body: string}} Payload a JSON body and its content type */
/** @typedef {{code?: number}} HecAnswer Splunk HEC's answer, the part read */
/** @typedef {{errors?: boolean}} BulkAnswer Elastic `_bulk`'s answer, the part read */
/** @typedef {{private_key?: string, client_email?: string}} ServiceAccountKey a Google service account's key, the parts read */

/** @param {Answer} res @returns {Promise<void>} */
const ok = async (res) => { if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new ToolError('SERVICE_REFUSED', { status: res.status }); } };
/** @param {unknown} body @returns {Payload} */
const json = (body) => ({ 'content-type': 'application/json', body: JSON.stringify(body) });
/**
 * @param {ToolContext} ctx @param {string} url @param {Readonly<Record<string, string>>} headers @param {Payload} payload
 * @returns {Promise<Answer>}
 */
const post = (ctx, url, headers, payload) => ctx.net.http(url, { method: 'POST', headers: { ...headers, 'content-type': payload['content-type'] }, body: payload.body });

// Splunk HTTP Event Collector: `{"event": record}`, the token in Splunk's own header.
/** @type {SinkAdapter} */
const splunk = {
  async forward(ctx, record) {
    const j = /** @type {HecAnswer} */ (await jsonOf(await post(ctx, `${baseOf(ctx)}/services/collector/event`, { authorization: `Splunk ${ctx.cred('hec_token')}` }, json({ event: record }))));
    const code = j.code;
    if (code !== undefined && code !== 0) throw new ToolError('SERVICE_REFUSED', { status: 400 });
  },
};

// Microsoft Sentinel through the Logs Ingestion API: a JSON array to the data collection rule's stream.
/** @type {SinkAdapter} */
const sentinel = {
  async forward(ctx, record) {
    const token = await clientToken(ctx.net, `https://login.microsoftonline.com/${encodeURIComponent(String(ctx.config.tenant_id || ''))}/oauth2/v2.0/token`,
      { client_id: ctx.cred('client_id'), client_secret: ctx.cred('client_secret'), scope: 'https://monitor.azure.com//.default' });
    const host = hostPart(ctx.config.endpoint || '');
    const dcr = encodeURIComponent(String(ctx.config.dcr_id || '')), stream = encodeURIComponent(String(ctx.config.stream || ''));
    await ok(await post(ctx, `https://${host}/dataCollectionRules/${dcr}/streams/${stream}?api-version=2023-01-01`,
      { authorization: `Bearer ${token}` }, json([record])));
  },
};

// Google Security Operations, ImportLogs: a service account's signed assertion exchanged for a token, then one log
// entry whose data is the record; its times are the period's end.
/** @param {string | ArrayBuffer} b @returns {string} */
const b64url = (b) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** @param {ToolContext} ctx @returns {Promise<string>} */
async function googleToken(ctx) {
  /** @type {ServiceAccountKey} */
  let key;
  // The spec's own credential, decoded here: a service account's JSON key.
  try { key = /** @type {ServiceAccountKey} */ (JSON.parse(ctx.cred('service_account_key'))); } catch { throw new ToolError('CREDENTIALS_MISSING'); }
  const pem = String(key.private_key || '').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  /** @type {CryptoKey} */
  let signer;
  try {
    signer = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch { throw new ToolError('CREDENTIALS_MISSING'); }
  const iat = Math.floor(ctx.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 600 }))}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer, new TextEncoder().encode(unsigned));
  const form = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` });
  const j = /** @type {TokenAnswer} */ (await jsonOf(await ctx.net.http('https://oauth2.googleapis.com/token',
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() })));
  const token = j.access_token;
  if (!token) throw new ToolError('SERVICE_REFUSED', { status: 401 });
  return token;
}
/** @type {SinkAdapter} */
const secops = {
  async forward(ctx, record) {
    const token = await googleToken(ctx);
    const c = ctx.config;
    /** @param {unknown} v */
    const seg = (v) => encodeURIComponent(String(v || ''));
    const host = ctx.net.allowed.find((h) => h.endsWith('-chronicle.googleapis.com'));
    const url = `https://${host}/v1alpha/projects/${seg(c.project)}/locations/${seg(c.location)}/instances/${seg(c.instance)}/logTypes/${seg(c.log_type)}/logs:import`;
    const data = btoa(JSON.stringify(record));
    await ok(await post(ctx, url, { authorization: `Bearer ${token}` },
      json({ inline_source: { logs: [{ data, log_entry_time: record.period.to, collection_time: record.period.to }] } })));
  },
};

// Elastic `_bulk`: one index action and the record, as newline-delimited JSON.
/** @type {string} */
export const ELASTIC_DEFAULT_INDEX = 'civicsmith-security-counts';
/** @type {SinkAdapter} */
const elastic = {
  async forward(ctx, record) {
    const index = String(ctx.config.index || ELASTIC_DEFAULT_INDEX);
    const body = `${JSON.stringify({ index: { _index: index } })}\n${JSON.stringify(record)}\n`;
    const j = /** @type {BulkAnswer} */ (await jsonOf(await ctx.net.http(`${baseOf(ctx)}/_bulk`, { method: 'POST',
      headers: { authorization: `ApiKey ${ctx.cred('api_key')}`, 'content-type': 'application/x-ndjson' }, body })));
    if (j.errors) throw new ToolError('SERVICE_REFUSED', { status: 400 });
  },
};

// Syslog, RFC 5424 over TLS (RFC 5425's octet-counted framing): facility log audit (13), severity informational (6);
// no host name, the period's end as the time, the record as the message.
/** @param {CountsRecord} record @returns {string} */
export function syslogFrame(record) {
  const msg = `<110>1 ${record.period.to} - civicsmith - security-counts - ${JSON.stringify(record)}`;
  return `${new TextEncoder().encode(msg).length} ${msg}`;
}
/** @type {SinkAdapter} */
const syslog = {
  async forward(ctx, record) {
    const socket = await ctx.net.tcp(hostPart(ctx.spec.host), portPart(ctx.spec.host, 6514), { secureTransport: 'on' });
    const w = socket.writable.getWriter();
    try { await w.write(new TextEncoder().encode(syslogFrame(record))); await w.close(); }
    catch { throw new ToolError('SERVICE_UNREACHABLE'); }
    finally { try { await socket.close(); } catch { /* closed */ } }
  },
};

// Any HTTPS endpoint: the record as a JSON POST, the token as a bearer.
/** @type {SinkAdapter} */
const webhook = {
  async forward(ctx, record) {
    const path = String(ctx.config.path || '/');
    if (!path.startsWith('/') || /[?#]/.test(path)) throw new ToolError('SERVICE_REFUSED', { status: 400 });
    await ok(await post(ctx, `${baseOf(ctx)}${path}`, { authorization: `Bearer ${ctx.cred('token')}` }, json(record)));
  },
};

/** @type {SinkAdapters} */
export const SINKS = Object.freeze({ 'splunk-hec': splunk, sentinel, 'google-secops': secops, elastic, 'syslog-tls': syslog, 'https-webhook': webhook });
