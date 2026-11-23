/* What the suites share: the real engine compiled from the vendored wasm, a member over it, a recording R2 stand-in
 * and request helpers. A helper, not a suite. */
import "../../bio-plane/test/sandbox.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeEngine } from "../src/enginecore.mjs";
import { makeMember } from "../src/member.mjs";

/** @type {string} the member's folder, ending in a separator */
export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
/** @type {string} the vendored engine's path (R13) */
export const WASM_PATH = fileURLToPath(new URL("../assets/sheet-engine.wasm", import.meta.url));
/** @type {Buffer} the vendored engine's bytes */
export const WASM_FILE = readFileSync(WASM_PATH);
/** @type {WebAssembly.Module} the vendored engine, compiled */
export const MODULE = new WebAssembly.Module(WASM_FILE);
/** A stored fixture's bytes, from `test/fixtures/`.
 *  @param {string} name the file's name
 *  @returns {Uint8Array}
 *  @throws {Error} when no such file is stored */
export const fixture = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))));

/** @type {string} a well-formed capture sha
 *  @bound 64 lower-case hex characters */
export const SHA = "ab".repeat(32);
/** A fresh engine over the vendored wasm, as the worker makes one (R13). */
export const realEngine = () => makeEngine(MODULE);

/** An engine wrapper that counts each call, so a test can say which steps ran.
 *  @param {Record<string, any>} engine an engine as `makeEngine` makes one
 *  @returns {{engine: Record<string, any>, calls: {open: number, inspect: number, load: number, evaluate: number, close: number}}} */
export function spied(engine) {
  const calls = { open: 0, inspect: 0, load: 0, evaluate: 0, close: 0 };
  const out = { ...engine };
  for (const k of Object.keys(calls)) out[k] = (...a) => { calls[k]++; return engine[k](...a); };
  return { engine: out, calls };
}

/** An R2 stand-in that records every method called on it and holds `objects` ({key: bytes}). Any method but `get`
 *  is recorded and then throws, so a write is both seen and refused (R10).
 *  @param {Record<string, Uint8Array>} [objects] absent is an empty bucket
 *  @returns {{binding: any, calls: Array<Array<unknown>>, store: Map<string, Uint8Array>}} */
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

/** @type {{SHEET_RECOMPUTE: string, VERSION: string}} the instance settings with recompute on (R2) */
export const ON = { SHEET_RECOMPUTE: "on", VERSION: "test" };

/** A POST to the member.
 *  @param {unknown} body a string is sent as written, anything else as JSON
 *  @param {string} [path] absent is "/recompute"
 *  @returns {Request} */
export function post(body, path = "/recompute") {
  return new Request(`https://sheet-worker${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** The member's answer to `req`, its body parsed.
 *  @param {{fetch: (req: Request, env: unknown) => Promise<Response>}} member
 *  @param {Request} req
 *  @param {unknown} env the instance's settings and bindings
 *  @returns {Promise<{status: number, body: any, type: string | null}>} */
export async function call(member, req, env) {
  const res = await member.fetch(req, env);
  return { status: res.status, body: await res.json(), type: res.headers.get("content-type") };
}

/** Recompute `bytes` through the whole HTTP path with recompute switched on.
 *  @param {{fetch: (req: Request, env: unknown) => Promise<Response>}} member
 *  @param {Uint8Array} bytes the workbook's bytes, stored as the capture `SHA` in "bio"
 *  @param {Record<string, unknown>} [env] settings that replace `ON`'s
 *  @returns {Promise<{status: number, body: any, type: string | null}>} */
export async function recomputeVia(member, bytes, env = {}) {
  const r2 = bucket({ [`bio/captures/${SHA}`]: bytes });
  return call(member, post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: r2.binding, ...env });
}

/** R18: the bundle and its manifest are built, never committed. Builds them into `dist/` with the member's own
 *  `scripts/build.mjs`, and reads them back, while holding `dist/.building` (made and removed by this process), so
 *  that test files run at once never read a half-written bundle. Built once in each process.
 *  @returns {{bundle: Buffer, manifest: any}} the bundle's bytes and the manifest, parsed
 *  @throws {Error} when the build fails, or another build holds the lock past a minute */
export function builtBundle() {
  if (built) return built;
  const lock = `${MEMBER_DIR}dist/.building`;
  const deadline = Date.now() + 60_000;
  for (;;) {
    try { mkdirSync(lock); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() > deadline) throw new Error(`${lock} is held past a minute; remove it if no build is running`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    execFileSync(process.execPath, [`${MEMBER_DIR}scripts/build.mjs`], { cwd: MEMBER_DIR, stdio: "pipe" });
    built = {
      bundle: readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundled.mjs`),
      manifest: JSON.parse(readFileSync(`${MEMBER_DIR}dist/sheet-worker.bundle.json`, "utf8")),
    };
  } finally { rmSync(lock, { recursive: true, force: true }); }
  return built;
}
let built = null;

export { makeEngine, makeMember };
