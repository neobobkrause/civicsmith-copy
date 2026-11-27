/* The fixtures ocr-worker publishes to the tests of the modules that use it (K4990, K4993, K4995, K5044). Each is made by
 * this module's real code when it is called, never stored. Not product code.
 *
 *   memberRefusal(reason)         the real member's (src/member.mjs) 200 answer for an image it declines, `reason` one of
 *                                 PAGE_NOT_LEGIBLE, PIXELS_UNREADABLE, ENGINE_FAILED, UNEXPECTED_FAILURE: the member's own
 *                                 handler over a real PDF page, with the one step that provokes the decline replaced
 *   pageNotRenderable({renderReason})  the real member handler's 200 `{ok:false, reason:"PAGE_NOT_RENDERABLE", page, deferred,
 *                                 notes, refusal:{render:{reason, detail}}}` over bytes the real page renderer refuses
 *                                 (`renderReason` NOT_A_PDF, the default, or EMPTY_FILE)
 *   memberWorker({mode, name})    the real member booted in a worker (`ocrWorkerDef()`), behind a front of the given `name`
 *                                 that logs the pages asked and applies one named deviation to the real answers: mode "ok"
 *                                 (none), "throw" (the member throws on page 3), "refuse" (pages 0 and 2 are answered by the
 *                                 real member over bytes it cannot render: PAGE_NOT_RENDERABLE), "version" (page 4 comes back
 *                                 under another engine version), "stray" (page 2 comes back carrying page 5).
 *                                 `{workers, prepare(mf), log(mf), readable}`: pass `workers` to Miniflare, call `prepare(mf)`
 *                                 once it is up (it stores the bytes the front reads), `log(mf)` is the page lists asked, and
 *                                 `readable` is `{sha, bytes}` of a one-page picture the real member reads, which a test stores
 *                                 under a `store/captures/<sha>` key of the real member's `CAPTURES` bucket (`realName`). */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeMember } from "../src/member.mjs";
import { ocrWorkerDef } from "./memberworker.mjs";
import { generate } from "../../bio-plane/test/imggen.mjs";
/** @import { Miniflare } from 'miniflare' */
/** @import { MemberEngine, EngineFailure, WireRefusal, CaptureBucket, MemberRequest, MemberEnv } from '../src/member.mjs' */
/** @import { FrameRead, FrameOptions } from '../src/frame.mjs' */
/** @import { OcrWorkerDef } from './memberworker.mjs' */

const SCAN = new Uint8Array(readFileSync(fileURLToPath(new URL("../../pdf-worker/test/fixtures/scan-ccitt-g4-page.pdf", import.meta.url))));
/** @param {Uint8Array} b @returns {string} */
const hex = (b) => createHash("sha256").update(b).digest("hex");

/**
 * A member as `ask` asks it: `makeMember`'s `fetch`.
 * @typedef {Readonly<{ fetch: (req: MemberRequest, env?: MemberEnv) => Promise<MemberResponse> }>} AskedMember
 */
/**
 * The member's answer as `ask` reads it: the member's own wire answer, a refusal for every request these fixtures make.
 * @typedef {Readonly<{ json: () => Promise<WireRefusal> }>} MemberResponse
 */

/** One request to a member, as the door asks it: `bytes` stored under their digest in an in-memory `CAPTURES`.
 *  @param {AskedMember} member @param {Uint8Array} bytes @param {number} [page] @returns {Promise<WireRefusal>} */
async function ask(member, bytes, page = 0) {
  const sha = hex(bytes), key = `scratch/captures/${sha}`;
  /** @type {CaptureBucket} */
  const bucket = { get: async (k, o) => {
    if (k !== key) return null;
    const r = o && o.range, part = r ? bytes.subarray(r.offset, Math.min(bytes.length, r.offset + r.length)) : bytes;
    return { size: bytes.length, arrayBuffer: async () => part.slice().buffer };
  } };
  const res = await member.fetch(new Request("http://ocr-worker/transcribe", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ capture_sha: sha, store: "scratch", pages: [page] }) }), { CAPTURES: bucket, VERSION: "fixture" });
  return await res.json();
}

/** @param {(rgba: Uint8Array, width: number, height: number, opts: FrameOptions) => Promise<FrameRead | EngineFailure>} transcribeFrame @returns {MemberEngine} */
const engineOf = (transcribeFrame) => ({ name: "tesseract-wasm", version: "0.11.0", model: "tessdata_fast/eng", check: () => null, transcribeFrame });
/** @returns {FrameRead} */
const SEEN = () => ({ ok: true, regions: [{ text: "word word word", rect: [0, 0, 10, 10], confidence: 0.1 }], grain: "line", boxCount: 1,
                      words: [{ confidence: 0.1 }, { confidence: 0.1 }, { confidence: 0.1 }], orientation: { rotation: 0 } });

/** @param {string} reason @returns {Promise<WireRefusal>} */
export async function memberRefusal(reason) {
  switch (reason) {
    case "PAGE_NOT_LEGIBLE":   /* a real page, an engine that rates none of its words as read */
      return await ask(makeMember(engineOf(async () => SEEN())), SCAN);
    case "ENGINE_FAILED":
      return await ask(makeMember(engineOf(async () => ({ ok: false, error: "the engine ran out of memory", name: "RangeError" }))), SCAN);
    case "PIXELS_UNREADABLE": /* a renderer that answers a container the member cannot read */
      return await ask(makeMember(engineOf(async () => SEEN()),
        { render: async () => ({ ok: true, route: "decoded-dct", mediaType: "image/jpeg", bytes: new Uint8Array(4), width: 1, height: 1 }) }), SCAN);
    case "UNEXPECTED_FAILURE":
      return await ask(makeMember(engineOf(async () => SEEN()), { render: async () => { throw new Error("the renderer threw"); } }), SCAN);
    default:
      throw new Error(`memberRefusal: no such reason ${reason}`);
  }
}

/** @param {{ renderReason?: string }} [options] @returns {Promise<WireRefusal>} */
export async function pageNotRenderable({ renderReason = "NOT_A_PDF" } = {}) {
  const bytes = renderReason === "EMPTY_FILE" ? new Uint8Array(0) : new TextEncoder().encode("this file is not a PDF and not a picture");
  /* the engine is never reached: the real page renderer refuses these bytes first */
  return await ask(makeMember(engineOf(async () => { throw new Error("the engine must not run"); })), bytes);
}

/** a one-page picture of six lines the real member reads */
const readable = generate({ kind: "png", seed: "fx", size: { pages: 1, lines: 6 } });

const FRONT = `
const log = [];
const at = (out, page, deferred) => {
  const r = { ...out, deferred };
  if (r.ok) r.pages = [{ page, regions: r.pages[0].regions.map((g) => ({ ...g, source: { ...g.source, ref: "p" + page, page } })) }];
  else { r.page = page; if (r.refusal) r.refusal = { ...r.refusal, page }; }
  return r;
};
export default { async fetch(req, env) {
  const u = new URL(req.url);
  if (req.method === "GET" && u.pathname === "/log") return Response.json(log);
  const body = await req.json();
  const clean = [...new Set(body.pages)].filter(Number.isInteger).sort((a, b) => a - b);
  log.push(clean);
  const take = clean[0], deferred = clean.slice(1), M = env.MODE;
  if (M === "throw" && take === 3) throw new Error("the 33rd invocation");
  /* the real member answers its page 0 of the capture (a picture is a one-page document); the front names the page asked */
  const ask = async (sha) => await (await env.REAL.fetch("http://ocr-worker/transcribe", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, capture_sha: sha, pages: [0] }) })).json();
  if (M === "refuse" && (take === 0 || take === 2)) return Response.json(at(await ask(env.UNRENDERABLE_SHA), take, deferred));
  const out = at(await ask(body.capture_sha), take, deferred);
  if (M === "version" && take === 4 && out.ok) out.version = "0.12.0";
  if (M === "stray" && take === 2 && out.ok) out.pages = [{ page: 5, regions: out.pages[0].regions.map((g) => ({ ...g, source: { ...g.source, ref: "p5", page: 5 } })) }];
  return Response.json(out);
} };`;

const UNRENDERABLE = new TextEncoder().encode("this file is not a PDF and not a picture");
/** @type {string} the digest of the bytes the real member cannot render, stored by `prepare(mf)` */
export const UNRENDERABLE_SHA = hex(UNRENDERABLE);
const REAL = "ocr-real";

/**
 * The front `memberWorker` puts before the real member.
 * @typedef {Object} FrontDef
 * @property {string} name
 * @property {true} modules
 * @property {string} script
 * @property {string} compatibilityDate
 * @property {{ REAL: string }} serviceBindings
 * @property {{ MODE: string, UNRENDERABLE_SHA: string }} bindings
 */
/**
 * What `memberWorker` answers.
 * @typedef {Object} MemberWorkerFixture
 * @property {(FrontDef | OcrWorkerDef)[]} workers the front and the real member, for Miniflare
 * @property {string} realName the real member's worker name, whose `CAPTURES` bucket a test stores into
 * @property {{ sha: string, bytes: Uint8Array }} readable a one-page picture the real member reads
 * @property {(mf: Miniflare) => Promise<void>} prepare stores the bytes the front reads
 * @property {(mf: Miniflare) => Promise<number[][]>} log the page lists the front was asked
 */
/**
 * What a caller of `memberWorker` may ask for.
 * @typedef {Object} MemberWorkerOptions
 * @property {string} [mode] `"ok"` unless given
 * @property {string} [name] the front's name, `"ocr-worker"` unless given
 * @property {string} [store] `"scratch"` unless given
 */

/** @param {MemberWorkerOptions} [options] @returns {Promise<MemberWorkerFixture>} */
export async function memberWorker({ mode = "ok", name = "ocr-worker", store = "scratch" } = {}) {
  const bytes = await readable.bytes();
  const real = ocrWorkerDef({ name: REAL });
  /** @type {FrontDef} */
  const front = { name, modules: true, script: FRONT, compatibilityDate: "2026-07-01",
    serviceBindings: { REAL },
    bindings: { MODE: mode, UNRENDERABLE_SHA } };
  return {
    workers: [front, real], realName: REAL, readable: { sha: hex(bytes), bytes },
    prepare: async (mf) => {
      const bucket = await mf.getR2Bucket("CAPTURES", REAL);
      await bucket.put(`${store}/captures/${UNRENDERABLE_SHA}`, UNRENDERABLE);
    },
    log: async (mf) => await (await (await mf.getWorker(name)).fetch("http://f/log")).json(),
  };
}
