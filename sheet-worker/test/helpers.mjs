/* What the suites share: the real engine compiled from the vendored wasm, a member over it, a recording R2 stand-in
 * and request helpers. A helper, not a suite. */
import "../../bio-plane/test/sandbox.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeEngine } from "../src/enginecore.mjs";
import { makeMember } from "../src/member.mjs";
/** @import { Engine } from '../src/enginecore.mjs' */
/** @import { Member } from '../src/member.mjs' */

/** The member's own folder, absolute, ending in a separator.
 *  @type {string} */
export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
/** The vendored engine wasm's absolute path.
 *  @type {string} */
export const WASM_PATH = fileURLToPath(new URL("../assets/sheet-engine.wasm", import.meta.url));
/** The vendored engine wasm's bytes (R13).
 *  @type {Buffer} */
export const WASM_FILE = readFileSync(WASM_PATH);
/** The vendored engine wasm, compiled.
 *  @type {WebAssembly.Module} */
export const MODULE = new WebAssembly.Module(WASM_FILE);
/** A stored workbook fixture's bytes, read from `test/fixtures/<name>`.
 *  @param {string} name the fixture's file name
 *  @returns {Uint8Array}
 *  @throws {Error} ENOENT when no fixture has that name */
export const fixture = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))));

/** The capture sha the helpers store a workbook under.
 *  @type {string}
 *  @bound 64 lower-case hex characters */
export const SHA = "ab".repeat(32);
/** The real engine over the vendored wasm.
 *  @returns {Engine} */
export const realEngine = () => makeEngine(MODULE);

/**
 * The call counts `spied` keeps.
 * @typedef {Object} EngineCalls
 * @property {number} open
 * @property {number} inspect
 * @property {number} load
 * @property {number} evaluate
 * @property {number} close
 */
/** An engine wrapper that counts each call, so a test can say which steps ran.
 *  @param {Engine} engine
 *  @returns {{engine: Engine, calls: EngineCalls}} */
export function spied(engine) {
  const calls = { open: 0, inspect: 0, load: 0, evaluate: 0, close: 0 };
  const out = { ...engine };
  for (const k of Object.keys(calls)) out[k] = (...a) => { calls[k]++; return engine[k](...a); };
  return { engine: out, calls };
}

/**
 * An R2 stand-in.
 * @typedef {Object} Bucket
 * @property {any} binding the stand-in to pass as `CAPTURES`: `get(key)` answers the stored bytes or null; any other
 *   method is recorded and throws
 * @property {Array<Array<unknown>>} calls every method called on it, in order, with its arguments
 * @property {Map<string, Uint8Array>} store the objects it holds, by key
 */
/** An R2 stand-in that records every method called on it and holds `objects` ({key: bytes}).
 *  @param {Record<string, Uint8Array>} [objects]
 *  @returns {Bucket} */
export function bucket(objects = {}) {
  const calls = [];
  const store = new Map(Object.entries(objects));
  const handler = {
    get(_, prop) {
      if (prop === "get") return async (key) => {
        calls.push(["get", key]);
        const v = store.get(key);
        return v ? { arrayBuffer: async () => v.slice().buffer } : null;
      };
      if (typeof prop === "string") return (...a) => { calls.push([prop, ...a]); throw new Error(`R2 ${prop} called`); };
      return undefined;
    },
  };
  return { binding: new Proxy({}, handler), calls, store };
}

/** Instance settings with recompute switched on (R2).
 *  @type {{SHEET_RECOMPUTE: string, VERSION: string}} */
export const ON = { SHEET_RECOMPUTE: "on", VERSION: "test" };

/** A POST request to the member; a string body is sent as it is, anything else as JSON.
 *  @param {unknown} body
 *  @param {string} [path] absent is "/recompute"
 *  @returns {Request} */
export function post(body, path = "/recompute") {
  return new Request(`https://sheet-worker${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * A member's answer, read.
 * @typedef {Object} CallAnswer
 * @property {number} status
 * @property {any} body the parsed JSON body
 * @property {string | null} type the content-type header
 */
/** Sends `req` to the member and reads its answer.
 *  @param {Member} member
 *  @param {Request} req
 *  @param {any} env
 *  @returns {Promise<CallAnswer>} */
export async function call(member, req, env) {
  const res = await member.fetch(req, env);
  return { status: res.status, body: await res.json(), type: res.headers.get("content-type") };
}

/** Recompute `bytes` through the whole HTTP path with recompute switched on.
 *  @param {Member} member
 *  @param {Uint8Array} bytes the workbook, stored at `bio/captures/<SHA>`
 *  @param {Record<string, unknown>} [env] settings laid over `ON` and the bucket
 *  @returns {Promise<CallAnswer>} */
export async function recomputeVia(member, bytes, env = {}) {
  const r2 = bucket({ [`bio/captures/${SHA}`]: bytes });
  return call(member, post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: r2.binding, ...env });
}

export { makeEngine, makeMember };
