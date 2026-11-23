import { word } from "../../../bio-plane/src/setup-words/index.mjs";

/* The installer's way to Cloudflare's management API (R66; F4, F6): one request function that waits out a slow, rate-limited
 * (429) or transiently failed (5xx or no answer) reply, backing off within one stated bound and drawing each wait; an
 * expired or revoked permission (401) ends the run asking for the founder's approval again (F6, R71), and a reply that
 * never comes right within the bound is a lasting failure, named as one.
 *
 * Waits are counted in NOMINAL seconds (the delays asked for), not read from a clock, so they are the same in a test that
 * makes every timer immediate and on the platform. */

/* R66: the bound `screen.install.progress.retrying` states in minutes. The word list gives none; the job proposes it from the
   measures of install-situations.md (S5, S8: a cold address answered after 6.7 s once and "a few minutes" otherwise; a
   fresh Worker's first start missed 30 s) and BOB sets it. */
/** @type {number} */
export const WAIT_BOUND_MINUTES = 5;
const BACKOFF_FIRST_S = 2, BACKOFF_CAP_S = 30;

/* The module's shared kinds, stated once here and imported by the files that use them. */
/**
 * @typedef {(waited: number, bound: number) => any} OnWait
 * the caller's way to draw a wait: nominal seconds waited, nominal bound
 */
/**
 * @typedef {Object} Emit the progress sink; this module calls only these three
 * @property {(id: string, label: string) => void} step
 * @property {(id: string, label?: string) => void} ok
 * @property {(id: string, label?: string) => void} no
 */
/**
 * @typedef {Object} Names the names a copy's parts carry in the account (R2)
 * @property {string} slug
 * @property {string} scheme "slug" or "legacy"
 * @property {string} captures the evidence bucket of captures
 * @property {string} published the evidence bucket of published items
 * @property {(member: string) => string} member a fleet member's Worker
 * @property {(member: string, cls: string, multi: boolean) => string} app a container application
 * @property {(role: string) => string} role the bucket of a role
 */
/**
 * @typedef {(path: string, init?: Object) => Promise<any>} Api
 * the management API call bound to one account's path prefix
 */
/**
 * @typedef {Object} Release a release as the installer's choice of release answers it
 * @property {string} version
 * @property {Blob} blob the plane's exact bytes
 * @property {string} [sha] SHA-256 of `blob`, kept once taken (R14)
 * @property {boolean} capable whether its plane reports its builds
 * @property {string} [from] where it was chosen from
 * @property {any} man its signed manifest, or null
 * @property {string} [base] where its members are kept; absent is RELEASE_LATEST
 * @property {Record<string, number>} limits the plane's stated limits (R10)
 */

/**
 * Waits `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * The request failed in a way that waiting can mend: a rate limit, a server error, or no answer at all.
 * @param {any} e the failure
 * @returns {boolean}
 */
export const transient = (e) => !!e && !e.final && (e.status === 429 || e.status >= 500 || e.network === true);

/** A failure still transient when the wait's bound was reached (`lasting: true`), carrying the cause's message, status and code. */
export class Lasting extends Error {
  /** @param {any} cause the last transient failure */
  constructor(cause) { super(cause.message); this.lasting = true; this.cause = cause; this.status = cause.status; this.code = cause.code; }
}
/** An expired or revoked permission (401): the run ends asking for the founder's approval again (`approveAgain: true`). */
export class ApproveAgain extends Error {
  constructor() { super(word("screen.install.approveagain")); this.approveAgain = true; }
}

/** A run's connection to Cloudflare: the access token (in this object only, held for the seconds the run takes) and what a
   wait is drawn through. `bearer` is read only where a request is made. */
export class Session {
  #token;
  /**
   * @param {string} token the access token
   * @param {OnWait|null} [onWait]
   */
  constructor(token, onWait = null) { this.#token = token; this.onWait = onWait; }
  get bearer() { return "Bearer " + this.#token; }
  toString() { return "[session]"; }
}

/* Waits for `fn` to succeed while its failures are transient, nominal bound `minutes`. `onWait(waitedS, boundS)` is told
   before each wait. A failure that is not transient throws as it is; one still transient at the bound throws Lasting. */
/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{onWait?: OnWait|null, minutes?: number}} [opts]
 * @returns {Promise<T>}
 * @throws {Lasting} when a failure is still transient at the bound
 */
export async function patiently(fn, { onWait = null, minutes = WAIT_BOUND_MINUTES } = {}) {
  const bound = minutes * 60;
  let waited = 0, delay = BACKOFF_FIRST_S;
  for (;;) {
    try { return await fn(); }
    catch (e) {
      if (e && e.approveAgain) throw e;
      if (!transient(e)) throw e;
      if (waited >= bound) throw new Lasting(e);
      if (onWait) await onWait(waited, bound);
      const wait = Math.max(delay, Math.min(Number.isFinite(e.retryAfter) ? e.retryAfter : 0, bound));
      await sleep(wait * 1000);
      waited += wait; delay = Math.min(delay * 2, BACKOFF_CAP_S);
    }
  }
}

const IDEMPOTENT = new Set(["GET", "PUT", "DELETE", "HEAD"]);

/* What a reply that is not a success says, as the error every caller sees: the API's first message (else `HTTP <status>`), its
   code and status; a 429's Retry-After (F4); a 401 as ApproveAgain carrying the API's code too (a Free account's Containers answer, 401 / 1000, is told from an expired
   permission by it), never retried. */
function failureOf(r, j = {}) {
  const e = new Error(j.errors?.[0]?.message || `HTTP ${r.status}`);
  e.code = j.errors?.[0]?.code;
  e.status = r.status;
  if (r.status === 429) { const after = Number(r.headers.get("retry-after")); if (Number.isFinite(after) && after > 0) e.retryAfter = after; }
  if (r.status === 401) return Object.assign(new ApproveAgain(), { status: 401, code: e.code, apiMessage: e.message });
  return e;
}
const networkError = (e) => Object.assign(new Error(String(e && e.message || e)), { network: true });

/**
 * One Cloudflare API call; `init.idem` marks a POST that is safe to repeat.
 * @param {Session} session
 * @param {string} path
 * @param {any} init the fetch options, and `idem`
 * @param {string} base
 * @returns {Promise<any>} the reply's `result`
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on any other refusal, carrying the API's message, `code` and `status`
 */
export async function cfCall(session, path, init = {}, base) {
  const { idem = false, ...rest } = init;
  const method = (rest.method || "GET").toUpperCase();
  const attempt = async () => {
    let r;
    try {
      r = await fetch(base + path, { ...rest, headers: {
        authorization: session.bearer,
        ...(rest.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...(rest.headers || {}) } });
    } catch (e) { throw networkError(e); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw failureOf(r, j);
    return j.result;
  };
  const retryable = IDEMPOTENT.has(method) || idem;
  return patiently(async () => {
    try { return await attempt(); }
    catch (e) {
      /* A POST that is not safe to repeat is repeated only when the platform said it did nothing (429). */
      if (!retryable && e.status !== 429) e.final = true;
      throw e;
    }
  }, { onWait: session.onWait });
}

/* A read whose answer is not JSON (a script's bytes): one GET to the management API, waited on as `cfCall` waits (429, 5xx and no
   answer back off; a 401 is ApproveAgain), answering the Response when it is ok. Any other refusal answers null. */
/**
 * @param {Session} session
 * @param {string} path
 * @param {any} [init] the fetch options
 * @param {string} [base]
 * @returns {Promise<any>} the Response when ok, else null
 * @throws {ApproveAgain} on a 401
 */
export async function cfRaw(session, path, init = {}, base = CF_API) {
  try {
    return await patiently(async () => {
      let r;
      try { r = await fetch(base + path, { ...init, headers: { authorization: session.bearer, ...(init.headers || {}) } }); }
      catch (e) { throw networkError(e); }
      if (r.ok) return r;
      const e = failureOf(r);
      if (e.approveAgain || r.status === 429 || r.status >= 500) throw e;
      return null;
    }, { onWait: session.onWait });
  } catch (e) { if (e && e.approveAgain) throw e; return null; }
}

/* Where the management API is, and where a release is kept (the installer's `CFG` reads these back). */
/** @type {string} */
export const CF_API = "https://api.cloudflare.com/client/v4";
/* Public releases: two committed files in the repo's release/ folder on main, readable without any API token or rate limit. */
/** @type {string} */
export const RELEASE_LATEST = "https://raw.githubusercontent.com/believeinoakland/bio/main/release";
/* R61: where the parts of a release other than the newest are kept, the release's own tag. */
/** @type {(version: string) => string} */
export const RELEASE_TAGGED = (version) => `https://raw.githubusercontent.com/believeinoakland/bio/v${version}/release`;

/* R66 (F4), R71 (F6): a slow, rate-limited or transiently failed answer is waited out within the stated bound; a permission
   that has expired ends the run asking for approval again. `token` is the run's Session (cfx.mjs). */
/**
 * @param {Session} token
 * @param {string} path
 * @param {any} [init]
 * @returns {Promise<any>}
 * @throws {ApproveAgain} on a 401
 * @throws {Lasting} when a transient failure is still failing at the bound
 * @throws {Error} on any other refusal
 */
const cf = (token, path, init = {}) => cfCall(token, path, init, CF_API);
/* The call bound to one account, the form account.mjs takes. */
/**
 * @param {Session} token
 * @param {string} acct the account id
 * @returns {Api}
 */
const apiOf = (token, acct) => (path, init) => cf(token, `/accounts/${acct}${path}`, init);
/* What waiting could not mend, and what asks for approval again, pass the catches of a step untouched. */
/**
 * @param {any} e
 * @returns {boolean}
 */
const special = (e) => !!e && (e.approveAgain === true || e.lasting === true);
/* A read the run can do without (the deployment to put back, a worker's presence for one binding): only a permission that has
   expired stops it; a failure that never mended is "not known". */
/**
 * @param {any} e
 * @returns {boolean}
 */
const approve = (e) => !!e && e.approveAgain === true;
export { cf, apiOf, special, approve };
