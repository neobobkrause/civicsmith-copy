/* What the suites share: the real engine compiled from the vendored wasm, a member over it, a recording R2 stand-in
 * and request helpers. A helper, not a suite. */
import "../../bio-plane/test/sandbox.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeEngine } from "../src/enginecore.mjs";
import { makeMember } from "../src/member.mjs";
/** @import { Engine } from '../src/enginecore.mjs' */
/** @import { AnswerCell, CaptureBucket, Member, WorkerEnv, WorkerRequest, Work } from '../src/member.mjs' */

/**
 * @typedef {Object} Answer the member's JSON answer as a suite reads it: every member any of its routes may carry
 * @property {boolean} ok
 * @property {string} [reason]
 * @property {string} [detail]
 * @property {string} [not_recomputed]
 * @property {string} [why]
 * @property {"unzipped_bytes" | "cells"} [measure]
 * @property {number | null} [measured]
 * @property {"at_least" | "exact"} [measured_is]
 * @property {number} [bound]
 * @property {number} [links]
 * @property {{ parts: number, formulas: number, defined_names: number }} [external]
 * @property {"load" | "evaluate"} [stage]
 * @property {string} [engine_error]
 * @property {number} [elapsed_ms]
 * @property {number} [budget_ms]
 * @property {string} [asked]
 * @property {string[]} [namespaces]
 * @property {string} [capture_sha]
 * @property {string} [store]
 * @property {string} [engine]
 * @property {string} [engine_version]
 * @property {string} [wasm_sha256]
 * @property {boolean} [macros_present]
 * @property {{ formula_cells: number, errors: number, volatile: number }} [counts]
 * @property {string[]} [notes]
 * @property {AnswerCell[]} [cells]
 * @property {Work} [work]
 * @property {string} [name]
 * @property {string | null} [version]
 * @property {number} [wasm_bytes]
 * @property {boolean} [engine_loaded]
 * @property {string} [engine_unavailable]
 * @property {boolean} [enabled]
 * @property {{ max_unzipped_bytes: number, max_cells: number, time_budget_ms: number }} [bounds]
 */
/** @typedef {{ status: number, body: Answer, type: string | null }} Called what `call` answers */
/** @typedef {{ open: number, inspect: number, load: number, evaluate: number, close: number }} SpiedCalls */
/** @typedef {Array<[string, ...unknown[]]>} BucketCalls each method called on the stand-in, with its arguments */

export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
export const WASM_PATH = fileURLToPath(new URL("../assets/sheet-engine.wasm", import.meta.url));
export const WASM_FILE = readFileSync(WASM_PATH);
export const MODULE = new WebAssembly.Module(WASM_FILE);
/** @param {string} name a file under `test/fixtures/` @returns {Uint8Array} */
export const fixture = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))));

export const SHA = "ab".repeat(32);
/** @returns {Engine} */
export const realEngine = () => makeEngine(MODULE);

/** An engine wrapper that counts each call, so a test can say which steps ran.
 *  @param {Engine} engine @returns {{ engine: Engine, calls: SpiedCalls }} */
export function spied(engine) {
  /** @type {SpiedCalls} */
  const calls = { open: 0, inspect: 0, load: 0, evaluate: 0, close: 0 };
  /** @type {Engine} */
  const out = {
    ...engine,
    open: () => { calls.open++; return engine.open(); },
    inspect: (bytes, bounds) => { calls.inspect++; return engine.inspect(bytes, bounds); },
    load: (bytes) => { calls.load++; return engine.load(bytes); },
    evaluate: () => { calls.evaluate++; return engine.evaluate(); },
    close: () => { calls.close++; return engine.close(); },
  };
  return { engine: out, calls };
}

/** An R2 stand-in that records every method called on it and holds `objects` ({key: bytes}).
 *  @param {{ readonly [key: string]: Uint8Array }} [objects]
 *  @returns {{ binding: CaptureBucket, calls: BucketCalls, store: Map<string, Uint8Array> }} */
export function bucket(objects = {}) {
  /** @type {BucketCalls} */
  const calls = [];
  const store = new Map(Object.entries(objects));
  /** @type {ProxyHandler<CaptureBucket>} */
  const handler = {
    get(_, prop) {
      if (prop === "get") return async (/** @type {string} */ key) => {
        calls.push(["get", key]);
        const v = store.get(key);
        return v ? { arrayBuffer: async () => v.slice().buffer } : null;
      };
      if (typeof prop === "string") return (/** @type {unknown[]} */ ...a) => { calls.push([prop, ...a]); throw new Error(`R2 ${prop} called`); };
      return undefined;
    },
  };
  /* The Proxy answers `get` as R2 does, and records then throws for any other member; its target is never read. */
  const binding = new Proxy(/** @type {CaptureBucket} */ ({}), handler);
  return { binding, calls, store };
}

export const ON = { SHEET_RECOMPUTE: "on", VERSION: "test" };

/** A POST to the member, its body written as JSON unless it is already text.
 *  @param {unknown} body @param {string} [path] @returns {WorkerRequest} */
export function post(body, path = "/recompute") {
  return new Request(`https://sheet-worker${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** @param {Member} member @param {WorkerRequest} req @param {WorkerEnv | undefined} env @returns {Promise<Called>} */
export async function call(member, req, env) {
  const res = await member.fetch(req, env);
  /** @type {Answer} the member's own JSON answer */
  const body = await res.json();
  return { status: res.status, body, type: res.headers.get("content-type") };
}

/** Recompute `bytes` through the whole HTTP path with recompute switched on.
 *  @param {Member} member @param {Uint8Array} bytes @param {WorkerEnv} [env] @returns {Promise<Called>} */
export async function recomputeVia(member, bytes, env = {}) {
  const r2 = bucket({ [`bio/captures/${SHA}`]: bytes });
  return call(member, post({ capture_sha: SHA, store: "bio" }), { SHEET_RECOMPUTE: ON.SHEET_RECOMPUTE, VERSION: ON.VERSION, CAPTURES: r2.binding, ...env });
}

export { makeEngine, makeMember };
