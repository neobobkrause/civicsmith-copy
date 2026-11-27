/* The one way an adapter reaches its tool (R12, R13, K1874): a request goes only to a host its descriptor states for
 * the spec's region (or the spec's own host, for a template or a product on the organization's servers), over the
 * Workers VPC binding for a tunnelled tool, within PROVIDER_TIMEOUT_MS of the call's start; credentials ride in a
 * header, a body or the transport's own authentication, never in an address. Failures become `ToolError`s whose code
 * is a verdict's `reason` (R5). Nothing here logs. */
import { PROVIDER_TIMEOUT_MS } from '../limits.mjs';
/** @import { Descriptor, ToolSpec, SpecConfig } from './descriptor.mjs' */

/** @import { Deps, Answer, Bucket, Connect, Socket, SocketOptions, OutgoingRequest } from '../store.mjs' */

/**
 * @typedef {Object} HttpInit what an adapter sends with one request: never a credential in the address (K1874)
 * @property {string} [method]
 * @property {Readonly<Record<string, string>>} [headers]
 * @property {string | ReadableStream<Uint8Array>} [body]
 */
/**
 * @typedef {Object} ToolContext one outside call, as routes.mjs hands it to the tool's adapter
 * @property {ToolSpec} spec the call's tool spec (R21)
 * @property {Descriptor} d the descriptor the call works under
 * @property {SpecConfig} config the spec's `config`, the fields the descriptor names only (R21, N777)
 * @property {Bucket} bucket the group's bucket (the routes that reach a bucket check it is bound, R2_NOT_CONFIGURED)
 * @property {() => number} now
 * @property {number} maxAge REPUTATION_LIST_MAX_AGE_MS
 * @property {(name: string) => string} cred one of the spec's credentials, for this call only (R13)
 * @property {Readonly<Record<string, string>>} modeParams the private mode's parameters, empty when none (R22)
 * @property {boolean} cloud MetaDefender's Cloud rather than the organization's Core
 * @property {Net} net the call's guarded network
 */
/** @typedef {string | number | boolean | null | undefined} Finding a name a tool reports, made a text in the verdict */
/**
 * @typedef {Object} EngineResult one engine's raw result, as an adapter answers it and routes.mjs makes a verdict of it
 * @property {string} [engine] as the tool names it
 * @property {string | undefined} [engine_version]
 * @property {Readonly<Record<string, string>> | null} [signatures]
 * @property {string} result
 * @property {readonly Finding[]} findings
 * @property {string | undefined} [vendor_ref]
 * @property {string | undefined} [detail]
 * @property {string | undefined} [reason] for `not_scanned`: set by routes.mjs, never by an adapter
 * @property {string | undefined} [sha256] a sandbox's digest of what it ran
 */
/**
 * @typedef {Object} ModeHooks R22's hooks on an adapter whose descriptor states a private mode
 * @property {((ctx: ToolContext) => Promise<boolean>) | undefined} [modeCheck] true when the mode is confirmed
 * @property {(ctx: ToolContext) => boolean} [modeApplies] false when the mode does not apply to this call
 */
/**
 * @typedef {Object} Net one call's guarded network (`makeNet`)
 * @property {(url: string, init?: HttpInit) => Promise<Answer>} http
 * @property {(host: string, port: number, options?: SocketOptions) => Promise<Socket>} tcp
 * @property {() => number} left the milliseconds left of PROVIDER_TIMEOUT_MS
 * @property {string[]} allowed the hosts the call may reach
 */
/**
 * @typedef {Object} TargetFile the file a call sends: its size and a fresh stream of its bytes for each read
 * @property {number} bytes
 * @property {() => ReadableStream<Uint8Array>} stream
 */
/**
 * @typedef {Object} Multipart a multipart body and the headers that state it
 * @property {ReadableStream<Uint8Array>} body
 * @property {Readonly<Record<string, string>>} headers `content-type` and `content-length`
 */
/** @typedef {{status?: number, detail?: string, host?: string}} ToolErrorExtra what a ToolError states beside its code */

/** A call's failure, its code a verdict's `reason` (R5). */
export class ToolError extends Error {
  /** @param {string} code @param {ToolErrorExtra} [extra] */
  constructor(code, extra = {}) {
    super(code);
    /** @type {string} the verdict's `reason` */
    this.code = code;
    Object.assign(this, extra);
    /** @type {number | undefined} the tool's HTTP status, for `SERVICE_REFUSED` */
    this.status; // eslint-disable-line no-unused-expressions
    /** @type {string | undefined} */
    this.detail; // eslint-disable-line no-unused-expressions
    /** @type {string | undefined} the host refused, for `HOST_NOT_ALLOWED` */
    this.host; // eslint-disable-line no-unused-expressions
  }
}

/** Whether `host` is one of `allowed` (a `*.domain` entry stands for any host under it).
 * @param {unknown} host @param {readonly string[]} allowed @returns {boolean} */
export function hostAllowed(host, allowed) {
  const h = String(host || '').toLowerCase();
  return allowed.some((a) => (a.startsWith('*.') ? h.endsWith(a.slice(1)) && h.length > a.length - 1 : h === a));
}

/** The hosts one call may reach, from its descriptor and spec.
 * @param {Descriptor} d @param {{host?: string, region?: string}} spec @returns {string[]} */
export function callHosts(d, spec) {
  const host = spec.host;
  if (d.host_from_spec || d.template) return host ? [hostPart(host)] : [];
  const hosts = d.hosts;
  if (Array.isArray(hosts)) return hosts;
  // A missing region is the key "undefined", as Object.hasOwn and the index read it.
  const list = Object.hasOwn(hosts, String(spec.region)) ? hosts[String(spec.region)] : null;
  if (list && list.length === 0) return host ? [hostPart(host)] : [];
  return list || [];
}
/** A host as written (`https://host:port/path`), its name alone, lower-cased. @param {unknown} h @returns {string} */
export const hostPart = (h) => String(String(h).replace(/^[a-z]+:\/\//i, '').split('/')[0]).replace(/:\d+$/, '').toLowerCase();
/** A host's port as written, else `fallback`. @param {unknown} h @param {number} fallback @returns {number} */
export const portPart = (h, fallback) => { const m = /:(\d+)(?:\/|$)/.exec(String(h).replace(/^[a-z]+:\/\//i, '')); return m ? Number(m[1]) : fallback; };

const NEUTRAL = 'sample';

/** A multipart body streaming the file under a fixed neutral name, with `fields` before it.
 * @param {Readonly<Record<string, string>>} fields @param {string} fileField @param {TargetFile} file
 * @returns {Multipart} */
export function multipart(fields, fileField, file) {
  const boundary = `----civicsmith${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  const enc = new TextEncoder();
  let head = '';
  for (const [k, v] of Object.entries(fields)) head += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  head += `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${NEUTRAL}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const a = enc.encode(head), z = enc.encode(`\r\n--${boundary}--\r\n`);
  const src = file.stream();
  /** @type {ReadableStream<Uint8Array>} */
  const body = new ReadableStream({
    async start(c) { c.enqueue(a); },
    async pull(c) {
      const reader = src.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        c.enqueue(value);
      }
      c.enqueue(z);
      c.close();
    },
  });
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(a.length + file.bytes + z.length) } };
}

/** The call's network: `http(url, init)` and `tcp(host, port, options)`, guarded as above.
 * @param {Deps} deps @param {Descriptor} d @param {ToolSpec} spec @param {number} started @returns {Net} */
export function makeNet(deps, d, spec, started) {
  const allowed = callHosts(d, spec);
  const left = () => PROVIDER_TIMEOUT_MS - (deps.now() - started);
  /** @param {string} host @param {string | number} port */
  const guard = (host, port) => {
    if (!hostAllowed(host, allowed)) throw new ToolError('HOST_NOT_ALLOWED', { host });
    if (Number(port) === 25) throw new ToolError('PORT_REFUSED');
  };
  /** @param {string} url @param {HttpInit} [init] @returns {Promise<Answer>} */
  async function http(url, init = {}) {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ToolError('HOST_NOT_ALLOWED', { host: u.host });
    if (u.username || u.password) throw new ToolError('TOOL_ADDRESS_HAS_CREDENTIAL');
    guard(u.hostname, u.port);
    if (left() <= 0) throw new ToolError('TIME_LIMIT');
    const vpc = deps.vpc;
    /** @type {((request: OutgoingRequest) => Promise<Answer>) | null | undefined} */
    const via = d.reach === 'tunnel' ? vpc && ((req) => vpc.fetch(req)) : (req) => deps.fetch(req);
    if (!via) throw new ToolError('REACH_NOT_BOUND');
    const signal = AbortSignal.timeout(left());
    /** @type {HttpInit & {signal: AbortSignal, duplex?: string}} */
    const opts = { ...init, signal };
    const body = init.body;
    if (body && typeof body !== 'string' && typeof body.getReader === 'function') opts.duplex = 'half';
    try {
      return await via(new Request(url, opts));
    } catch (e) {
      if (signal.aborted || (e && e.name === 'TimeoutError')) throw new ToolError('TIME_LIMIT');
      throw new ToolError('SERVICE_UNREACHABLE');
    }
  }
  /** @param {string} host @param {number} port @param {SocketOptions} [options] @returns {Promise<Socket>} */
  async function tcp(host, port, options = {}) {
    guard(host, port);
    const vpc = deps.vpc;
    // The binding's own connect, called on the binding at once below (as `vpc.connect(a, o)`).
    const vpcConnect = vpc ? vpc.connect : undefined;
    /** @type {Connect | null | undefined} */
    const connect = d.reach === 'tunnel' ? vpc && vpcConnect && ((a, o) => vpcConnect.call(vpc, a, o)) : deps.connect;
    if (!connect) throw new ToolError(d.reach === 'tunnel' ? 'REACH_NOT_BOUND' : 'SERVICE_UNREACHABLE');
    try { return connect({ hostname: host, port }, options); } catch { throw new ToolError('SERVICE_UNREACHABLE'); }
  }
  return { http, tcp, left, allowed };
}

/** A tool's JSON answer, or the refusal it is (`SERVICE_REFUSED` with its status).
 * @param {Answer} res @returns {Promise<unknown>} the answer, decoded by the adapter that asked for it */
export async function jsonOf(res) {
  if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new ToolError('SERVICE_REFUSED', { status: res.status }); }
  try { return await res.json(); } catch { throw new ToolError('SERVICE_REFUSED', { status: res.status }); }
}

/** @param {number} ms @returns {Promise<void>} */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @typedef {Object} ClientCredentials an OAuth 2.0 client's credentials, and how it sends them
 * @property {string} client_id
 * @property {string} client_secret
 * @property {string} [scope]
 * @property {boolean} [basic] the two in a Basic authorization header, not the body
 */
/** @typedef {{access_token?: string}} TokenAnswer an OAuth 2.0 token endpoint's answer, the part read */
/** An OAuth 2.0 client-credentials token, the secret in the body (never the address).
 * @param {Net} net @param {string} url @param {ClientCredentials} credentials @returns {Promise<string>} */
export async function clientToken(net, url, { client_id, client_secret, scope, basic }) {
  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/x-www-form-urlencoded' };
  if (basic) headers.authorization = `Basic ${btoa(`${client_id}:${client_secret}`)}`;
  else { form.set('client_id', client_id); form.set('client_secret', client_secret); }
  if (scope) form.set('scope', scope);
  const j = /** @type {TokenAnswer} the token endpoint's answer to this call */ (await jsonOf(await net.http(url, { method: 'POST', headers, body: form.toString() })));
  const token = j.access_token;
  if (!token) throw new ToolError('SERVICE_REFUSED', { status: 401 });
  return token;
}
