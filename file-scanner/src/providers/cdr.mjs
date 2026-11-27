/* Adapters of kind `cdr` (R24): `cdr(ctx, file)` → `{bytes, content_type, removed}`, the tool's rebuilt file and what
 * it reports removed; `CDR_UNSUPPORTED_TYPE` when the tool declines the format. Nothing is written to the bucket. */
import { ToolError, multipart } from './net.mjs';
import { metadefenderUpload, metadefenderPoll, metadefenderModeCheck, metadefenderBase, baseOf } from './scanners.mjs';
/** @import { ToolContext, TargetFile, ModeHooks } from './net.mjs' */
/** @import { Answer } from '../store.mjs' */

/** @typedef {{bytes: Uint8Array, content_type: string, removed: string[]}} CdrOutput a rebuilt file and what was removed */
/**
 * @typedef {Object} CdrAdapterFields an adapter of kind `cdr`
 * @property {(ctx: ToolContext, file: TargetFile) => Promise<CdrOutput>} cdr the tool's rebuilt file
 */
/** @typedef {ModeHooks & CdrAdapterFields} CdrAdapter an adapter of kind `cdr` */
/** @typedef {Readonly<Record<string, CdrAdapter>>} CdrAdapters the rebuilding tools by `provider_id` */

const UNSUPPORTED = /unsupported|not supported|file type/i;

/** @param {Answer} res @returns {Promise<{bytes: Uint8Array, content_type: string}>} */
async function bytesOf(res) {
  if (res.status === 415 || res.status === 422) { await res.body?.cancel().catch(() => {}); throw new ToolError('CDR_UNSUPPORTED_TYPE'); }
  if (!res.ok) { await res.body?.cancel().catch(() => {}); throw new ToolError('SERVICE_REFUSED', { status: res.status }); }
  return { bytes: new Uint8Array(await res.arrayBuffer()), content_type: res.headers.get('content-type') || 'application/octet-stream' };
}

// OPSWAT Deep CDR, on the Cloud (region `cloud`, private mode as MetaDefender Cloud's, R22) or the organization's Core
// (region `core`, the spec's host): upload with the `sanitize` rule, poll until sanitization ends, then download the
// converted file. The assumed answer's `sanitized` states `result` and `details` [{action, object_name}].
/** @type {CdrAdapter} */
const deepCdr = {
  modeCheck: metadefenderModeCheck,
  modeApplies: (ctx) => ctx.cloud,
  async cdr(ctx, file) {
    const id = await metadefenderUpload(ctx, file, { rule: 'sanitize' });
    const j = await metadefenderPoll(ctx, id, (x) => x.sanitized && Number(x.sanitized.progress_percentage) === 100);
    const s = j.sanitized;
    if (!/allowed|sanitized|success/i.test(String(s.result))) {
      if (UNSUPPORTED.test(String(s.reason || s.result))) throw new ToolError('CDR_UNSUPPORTED_TYPE');
      throw new ToolError('SERVICE_REFUSED', { status: 422 });
    }
    const removed = (s.details || []).filter((d) => /remov|sanitiz/i.test(String(d.action))).map((d) => String(d.object_name));
    const out = await bytesOf(await ctx.net.http(`${metadefenderBase(ctx)}/file/converted/${encodeURIComponent(id)}`,
      { headers: { apikey: ctx.cred('api_key'), ...(ctx.cloud ? ctx.modeParams : {}) } }));
    return { ...out, removed };
  },
};

// Glasswall Halo: one synchronous call answering the rebuilt file; the items it remedied are stated in the answer's
// `x-sanitisation-items` header as a JSON list of names (assumed, held by the stub).
/** @type {CdrAdapter} */
const halo = {
  async cdr(ctx, file) {
    const mp = multipart({}, 'file', file);
    const res = await ctx.net.http(`${baseOf(ctx)}/api/v3/cdr-file`,
      { method: 'POST', headers: { ...mp.headers, authorization: `Bearer ${ctx.cred('api_token')}` }, body: mp.body });
    /** @type {string[]} */
    let removed = [];
    // The tool's own header, decoded here: a JSON list of names (assumed, held by the stub).
    try { removed = /** @type {unknown[]} */ (JSON.parse(res.headers.get('x-sanitisation-items') || '[]')).map(String); } catch { removed = []; }
    return { ...(await bytesOf(res)), removed };
  },
};

/** @type {CdrAdapters} */
export const CDRS = Object.freeze({ 'opswat-deep-cdr': deepCdr, 'glasswall-halo': halo });
