/* POST /render (R7): the safe view. R1's and R2's checks for one target, then the copy is streamed to the
 * `SafeViewRenderer` image (container/renderer.mjs), whose answer, a PDF of page images and its headers, passes through. */
import { SAFE_VIEW_DPI, SAFE_VIEW_PAGES_MAX, SAFE_VIEW_BYTES_MAX, RENDER_TIME_MS, SCAN_LIMITS } from './limits.mjs';
import { normaliseTarget, knownStore, sizeTarget, targetStream } from './store.mjs';
import { localize } from '../../bio-plane/src/setup-words/index.mjs';
/** @import { Deps, RequestBody, StoreName, Target, Answer, Outcome } from './store.mjs' */

/**
 * A target's check: the refusal when it fails, else the target and its store.
 * @typedef {{ refusal: Response, t?: undefined, store?: undefined } | { refusal?: undefined, t: Target, store: StoreName }} CheckResult
 */
/** @typedef {{ code?: string, reason?: string, message?: unknown }} RendererRefusal the renderer's answer when it did not render */
/** @typedef {{ ok?: undefined, reason?: undefined }} Pending an answer that came before the copy was read whole */
/** @typedef {{ enqueue: (chunk: Uint8Array) => void, error: (e: unknown) => void }} PassController a transform's controller */

/** @type {{ readonly [reason: string]: number }} each refusal's status, by the reason a target's read gives */
const STATUS = { NOT_FOUND: 404, DIGEST_MISMATCH: 409, TOO_LARGE: 413 };
/** @param {number | undefined} status @param {string | undefined} code @param {object} [extra] what the refusal states beside its code @returns {Response} */
const refuse = (status, code, extra = {}) => new Response(JSON.stringify({ ok: false, code, ...extra }),
  { status, headers: { 'content-type': 'application/json' } });
/** @type {ReadonlySet<string | undefined>} */
const KNOWN = new Set(['ENCRYPTED', 'NOT_RENDERABLE', 'TIME_LIMIT', 'RENDER_FAILED']);
const PASSED = ['content-type', 'x-derived-sha256', 'x-pages', 'x-source-pages', 'x-truncated', 'x-source-pages-exact'];
/** R7 (G136b): a refusal of the render itself says whether a later try can succeed: `transient` (the render ran out of
 *  time, or the renderer was not reached: the caller retries with back-off) or `final` (this document will not render). */
/** @param {number} status @param {string | undefined} code @param {string} cls @param {object} [extra] what the refusal states beside its code and class @returns {Response} */
const failed = (status, code, cls, extra = {}) => refuse(status, code, { class: cls, ...extra });
/** The renderer's figures, quoted from the table by this Worker (its image cannot import it). */
/** @returns {string} */
const figures = () => `dpi=${SAFE_VIEW_DPI}&max=${SAFE_VIEW_PAGES_MAX}&bytes=${SAFE_VIEW_BYTES_MAX}&ms=${RENDER_TIME_MS}`
  + `&entries=${SCAN_LIMITS.max_files}&directory=${SCAN_LIMITS.zip_directory}`;
/** The renderer's PDF as a stream that ends in an error past `max` bytes: the image cuts the view itself, so this holds
 *  only against an image that does not.
 *  @param {ReadableStream<Uint8Array>} body @param {number} max @returns {ReadableStream<Uint8Array>} */
const held = (body, max) => {
  let n = 0;
  return body.pipeThrough(new TransformStream({
    /** @param {Uint8Array} chunk @param {PassController} c */
    transform(chunk, c) { n += chunk.byteLength; if (n > max) c.error(new Error('SAFE_VIEW_BYTES_MAX')); else c.enqueue(chunk); } }));
};

/** The target's check, shared with the outside tools' routes: `{t, store}` once it passes, else `{refusal}`, a refusal Response.
 *  @param {Deps} deps @param {RequestBody | null} body @returns {Promise<CheckResult>} */
export async function checkOne(deps, body) {
  const store = body && body.store;
  if (!body || !knownStore(store)) return { refusal: refuse(400, 'NAMESPACE_UNKNOWN') };
  const t = normaliseTarget(body.target);
  if (!t) return { refusal: refuse(400, 'BAD_TARGET') };
  if (!deps.bucket) return { refusal: refuse(503, 'R2_NOT_CONFIGURED') };
  return { t, store };
}

/** POST /render (R7). @param {Deps} deps @param {RequestBody | null} body @returns {Promise<Response>} */
export async function render(deps, body) {
  const c = await checkOne(deps, body);
  if (c.refusal) return c.refusal;
  if (body.route !== 'pdf' && body.route !== 'office') return refuse(400, 'NOT_RENDERABLE');
  const size = await sizeTarget(deps.bucket, c.store, c.t);
  if (!size.ok) return refuse(STATUS[size.reason], size.reason);
  const { stream, outcome } = targetStream(deps.bucket, c.store, c.t);
  /** @type {Answer | null} */
  let r;
  try {
    r = await deps.renderer(`/render?route=${body.route}&${figures()}`,
      { method: 'POST', body: stream, duplex: 'half' });
  } catch { r = null; }
  // An answer that came before the copy was read whole settles nothing about the bytes: a refusal stands, a PDF does not.
  /** @type {Pending} */
  const PENDING = {};
  /** @type {Outcome | Pending} */
  const raced = await Promise.race([outcome, new Promise(/** @param {(p: Pending) => void} res */ (res) => setTimeout(() => res(PENDING), 0))]);
  if (raced === PENDING) {
    const early = r;
    if (early && early.status === 200) { await early.body?.cancel().catch(() => {}); r = null; }
  }
  /** @type {Outcome} */
  const o = raced === PENDING ? { ok: true } : raced;
  const answer = r;
  if (!o.ok) return refuse(STATUS[o.reason] || 409, o.reason in STATUS ? o.reason : 'DIGEST_MISMATCH');
  if (!answer) return failed(503, 'RENDER_FAILED', 'transient', { message: localize('file-scanner.render.the_renderer_could_not', 'the renderer could not be reached') });
  if (answer.status !== 200) {
    const e = /** @type {RendererRefusal} the renderer's own answer */ (await answer.json().catch(() => ({})));
    const code = KNOWN.has(e.code) ? e.code : 'RENDER_FAILED';
    const said = e.message;
    const message = code === 'RENDER_FAILED' && e.reason === 'FIRST_PAGE_OVER_BOUND' ? localize('file-scanner.render.the_first_page_is_over_the_limit', 'the first page of the safe view is over the limit of {limit} bytes', { limit: String(SAFE_VIEW_BYTES_MAX) })
      : code === 'NOT_RENDERABLE' ? (typeof said === 'string' && said ? said.slice(0, 300) : undefined)
      : code === 'RENDER_FAILED' ? String(said || localize('file-scanner.render.the_renderer_answered_status', 'the renderer answered {status}', { status: String(answer.status) })).slice(0, 300) : undefined;
    return failed(code === 'TIME_LIMIT' ? 504 : code === 'RENDER_FAILED' ? 500 : 422, code, code === 'TIME_LIMIT' ? 'transient' : 'final', message ? { message } : {});
  }
  const declared = Number(answer.headers.get('content-length'));
  if (declared > SAFE_VIEW_BYTES_MAX) {
    await answer.body?.cancel().catch(() => {});
    return failed(500, 'RENDER_FAILED', 'final', { message: localize('file-scanner.render.the_safe_view_is_over_the_limit', 'the safe view is {bytes} bytes, over the limit of {limit}', { bytes: String(declared), limit: String(SAFE_VIEW_BYTES_MAX) }) });
  }
  const headers = new Headers();
  for (const h of PASSED) if (answer.headers.get(h) !== null) headers.set(h, answer.headers.get(h));
  return new Response(held(answer.body, SAFE_VIEW_BYTES_MAX), { status: 200, headers });
}
