/* What the suites share: the real engine compiled from the vendored wasm, a member over it, a recording R2 stand-in
 * and request helpers. A helper, not a suite. */
import "../../bio-plane/test/sandbox.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeEngine } from "../src/enginecore.mjs";
import { makeMember } from "../src/member.mjs";

export const MEMBER_DIR = fileURLToPath(new URL("..", import.meta.url));
export const WASM_PATH = fileURLToPath(new URL("../assets/sheet-engine.wasm", import.meta.url));
export const WASM_FILE = readFileSync(WASM_PATH);
export const MODULE = new WebAssembly.Module(WASM_FILE);
export const fixture = (name) => new Uint8Array(readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url))));

export const SHA = "ab".repeat(32);
export const realEngine = () => makeEngine(MODULE);

/** An engine wrapper that counts each call, so a test can say which steps ran. */
export function spied(engine) {
  const calls = { open: 0, inspect: 0, load: 0, evaluate: 0, close: 0 };
  const out = { ...engine };
  for (const k of Object.keys(calls)) out[k] = (...a) => { calls[k]++; return engine[k](...a); };
  return { engine: out, calls };
}

/** An R2 stand-in that records every method called on it and holds `objects` ({key: bytes}). */
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

export const ON = { SHEET_RECOMPUTE: "on", VERSION: "test" };

export function post(body, path = "/recompute") {
  return new Request(`https://sheet-worker${path}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export async function call(member, req, env) {
  const res = await member.fetch(req, env);
  return { status: res.status, body: await res.json(), type: res.headers.get("content-type") };
}

/** Recompute `bytes` through the whole HTTP path with recompute switched on. */
export async function recomputeVia(member, bytes, env = {}) {
  const r2 = bucket({ [`bio/captures/${SHA}`]: bytes });
  return call(member, post({ capture_sha: SHA, store: "bio" }), { ...ON, CAPTURES: r2.binding, ...env });
}

export { makeEngine, makeMember };
