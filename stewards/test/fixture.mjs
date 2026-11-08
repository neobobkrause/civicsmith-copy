/* stewards' tests: the Worker driven at its interface. `cloudflare:email` resolves to a stand-in `EmailMessage`; the
   `STORE` namespace is the module's own `StewardsStore` over an in-memory SQLite (node:sqlite) shaped as the Durable
   Object's `storage.sql`; `NOTIFY` is a fake mail binding that records what it is asked to send; `fetch` to any other
   address is trapped and recorded. Every console line is captured, for the scans of R4, R9 and R14. */
import "../../bio-plane/test/sandbox.mjs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { mock } from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:email") {
      const src = "export class EmailMessage { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }";
      return { url: "data:text/javascript," + encodeURIComponent(src), shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const mod = await import("../src/index.mjs");
export const worker = mod.default;
export const W = mod;
export const ORIGIN = "https://stewards.example";

/* The Durable Object's `storage.sql`, over node:sqlite. */
function sqlOver(db) {
  return {
    exec(query, ...bindings) {
      const st = db.prepare(query);
      if (/^\s*(SELECT|WITH)/i.test(query)) return st.all(...bindings).map((r) => ({ ...r }));
      st.run(...bindings);
      return [];
    },
  };
}

export function makeStore({ broken = false } = {}) {
  const db = new DatabaseSync(":memory:");
  const object = new mod.StewardsStore({ storage: { sql: sqlOver(db) } });
  const calls = [];
  const ns = {
    db, object, calls,
    idFromName: (n) => ({ name: n }),
    get: () => ({
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push(body.op);
        if (broken === true || (typeof broken === "function" && broken(body.op))) throw new Error("storage unavailable");
        return object.fetch(new Request(url, init));
      },
    }),
  };
  return ns;
}

export const keyOf = () => randomBytes(32).toString("base64url");
export const shaHex = (s) => createHash("sha256").update(s).digest("hex");
export const ALICE = { name: "Alice Steward", key: keyOf() };
export const BOB = { name: "Second Steward", key: keyOf() };
export const ADDRESS = "stewards@civicsmith.example";

export function makeEnv(over = {}) {
  const sent = [];
  const env = {
    STEWARDS_ADDRESS: ADDRESS,
    REPORT_RETENTION_DAYS: "365",
    CONTACT_RETENTION_DAYS: "90",
    STEWARD_KEYS: `${ALICE.name}:${shaHex(ALICE.key)}\n${BOB.name}:${shaHex(BOB.key)}\n`,
    SOURCE_KEY: "k".repeat(32),
    NOTIFY_FROM: "notices@civicsmith.example",
    LISTING_RULE_TEXT_VERSION: "2026-10-15",
    STORE: makeStore(),
    NOTIFY: { send: async (m) => { sent.push(m); } },
    ...over,
  };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  env.sent = sent;
  return env;
}

/* Everything the service writes to the console, and every outbound fetch. */
export const LOGS = [];
export const OUTBOUND = [];
for (const m of ["log", "info", "warn", "error", "debug"]) console[m] = (...a) => LOGS.push(a.map(String).join(" "));
globalThis.fetch = async (u) => { OUTBOUND.push(String(u)); throw new Error("no outbound fetch in tests"); };

/* Every answer the suite saw, headers and body, for the scans. */
export const SEEN = [];
export async function call(env, path, { method = "GET", body, form, json = true, ip = "198.51.100.1", origin = ORIGIN, cookie, headers = {}, raw } = {}) {
  const h = new Headers(headers);
  if (ip) h.set("cf-connecting-ip", ip);
  if (cookie) h.set("cookie", cookie);
  if (method === "POST" && origin) h.set("origin", origin);
  let payload;
  if (raw !== undefined) payload = raw;
  else if (form) { h.set("content-type", "application/x-www-form-urlencoded"); payload = new URLSearchParams(form).toString(); }
  else if (body !== undefined) { h.set("content-type", "application/json"); payload = JSON.stringify(body); }
  else if (json) h.set("accept", "application/json");
  if (json && !h.has("accept") && !form) h.set("accept", "application/json");
  const res = await worker.fetch(new Request(ORIGIN + path, { method, headers: h, body: payload }), env);
  const text = await res.text();
  SEEN.push([...res.headers].map(([k, v]) => `${k}: ${v}`).join("\n") + "\n" + text);
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, data };
}

export const REPORT = Object.freeze({ kind: "harassment", concerns: "eastlake-tenants", description: "They posted my home address.", contact: "me@example.org" });
export const report = (env, over = {}, opts = {}) => call(env, "/report", { method: "POST", body: { ...REPORT, ...over }, ...opts });

export async function signIn(env, who = ALICE, opts = {}) {
  const r = await call(env, "/steward/signin", { method: "POST", body: { name: who.name, key: who.key }, ...opts });
  const set = r.headers.get("set-cookie") || "";
  const value = /steward_session=([^;]*)/.exec(set)?.[1];
  return { ...r, cookie: value ? `steward_session=${value}` : null, value, set };
}

/* The clock: Date mocked, advanced by hand. */
export const T0 = Date.UTC(2026, 9, 12, 12, 0, 0);
export function clock(start = T0) {
  mock.timers.enable({ apis: ["Date"], now: start });
  return { tick: (ms) => mock.timers.tick(ms), reset: () => mock.timers.reset() };
}
