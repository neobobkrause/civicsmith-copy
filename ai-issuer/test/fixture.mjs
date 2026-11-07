/* ai-issuer's tests: the Worker driven at its interface (`src/index.mjs`). `cloudflare:workers` resolves to a stand-in
 * `DurableObject`; `STORE` is the module's own `IssuerStore` over an in-memory SQLite (node:sqlite) shaped as the
 * Durable Object's `storage.sql`, reached as the Worker reaches it, by method call with structured-cloned arguments;
 * `DOCS` and `BLOBS` are in-memory buckets that count their writes. Catalogue documents are signed with ai-catalogue's
 * published test fixture (its throwaway keys and payload), and test bundles are built by ai-gate's own bundle code
 * (`buildManifest`, `sealPayload`, `signBundle`, `encodeBundle`) with a throwaway run key and seal key made per run.
 * No key is held or committed; no network. */
import "../../bio-plane/test/sandbox.mjs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, webcrypto } from "node:crypto";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") {
      const src = "export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }";
      return { url: "data:text/javascript," + encodeURIComponent(src), shortCircuit: true };
    }
    return next(specifier, context);
  },
});

const mod = await import("../src/index.mjs");
export const worker = mod.default;
export const W = mod;
export const S = await import("../src/store.mjs");
export const C = await import("../src/checks.mjs");
export const P = await import("../src/params.mjs");
export const AC = await import("../../bio-plane/test/m/ai-catalogue/fixture.mjs");
const gate = await import("../../ai-gate/src/bundle.mjs");
const { canonicalJson } = await import("../../bio-plane/src/record-grammar/index.mjs");
const { aiSealKeyStatement, NS_AI_CATALOGUE } = await import("../../bio-plane/src/sshsig.mjs");
export { canonicalJson };

export const ORIGIN = "https://ai-issuer.example";
export const te = new TextEncoder();
export const td = new TextDecoder();
export const sha = (b) => createHash("sha256").update(b).digest("hex");
export const DAY = 86_400_000;
export const T0 = Date.parse("2026-11-01T12:00:00Z");

/* ------------------------------------------------------------------ the platform's stand-ins */

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

export function bucket() {
  const m = new Map();
  const b = {
    m, writes: 0, broken: false,
    async get(k) {
      if (b.broken) throw new Error("bucket unavailable");
      const v = m.get(k);
      return v ? { arrayBuffer: async () => v.slice().buffer } : null;
    },
    async put(k, v) {
      if (b.broken) throw new Error("bucket unavailable");
      b.writes++;
      m.set(k, v instanceof Uint8Array ? v.slice() : te.encode(String(v)));
    },
    async delete(k) { b.writes++; m.delete(k); },
  };
  return b;
}

export function makeStore(env) {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: sqlOver(db),
    transactionSync(fn) {
      db.exec("SAVEPOINT tx");
      try { const r = fn(); db.exec("RELEASE tx"); return r; } catch (e) { db.exec("ROLLBACK TO tx"); db.exec("RELEASE tx"); throw e; }
    },
  };
  let object = null;
  const ns = {
    db, broken: false, calls: [],
    get object() { return (object ??= new S.IssuerStore({ storage }, env)); },
    idFromName: (n) => ({ name: n }),
    get: () => new Proxy({}, {
      get: (_t, name) => async (...args) => {
        ns.calls.push(name);
        if (ns.broken) throw new Error("storage unavailable");
        return structuredClone(await ns.object[name](...structuredClone(args)));
      },
    }),
  };
  return ns;
}

export const OPERATOR = `op-${randomBytes(24).toString("base64url")}`;

/** An environment: the test catalogue key trusted, the operator credential's hash, the clock pinned at `now`. */
export function makeEnv(over = {}) {
  const env = { CATALOGUE_KEYS: AC.KEY.line, OPERATOR_CREDENTIAL_SHA256: sha(OPERATOR), BIO_NOW_MS: String(T0),
    DOCS: bucket(), BLOBS: bucket(), ...over };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  env.STORE = makeStore(env);
  return env;
}
export const at = (env, ms) => { env.BIO_NOW_MS = String(ms); };

/** Every row of every table, for the scans of R2, R24 and R26. */
export function dump(env) {
  const out = {};
  for (const t of S.TABLES) out[t] = env.STORE.db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }));
  return out;
}
export const rowCount = (env) => Object.values(dump(env)).reduce((n, rs) => n + rs.length, 0);

/* ------------------------------------------------------------------ requests */

export async function call(env, method, path, { body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) init.body = body instanceof Uint8Array ? body : typeof body === "string" ? body : JSON.stringify(body);
  const res = await worker.fetch(new Request(ORIGIN + path, init), env);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(td.decode(bytes)); } catch { json = null; }
  return { status: res.status, headers: res.headers, bytes, json };
}
export const op = (env, act, args = {}, { credential = OPERATOR } = {}) =>
  call(env, "POST", `/ai/operator/${act}`, { body: { by: "operator-test", ...args },
    headers: credential === null ? {} : { authorization: `Bearer ${credential}` } });

/* ------------------------------------------------------------------ catalogue documents (ai-catalogue's fixture) */

/** A payload at `seq` listing the given entries (ai-catalogue's fixture `payload` and `entry`). */
export function payloadOf(seq, entries = [AC.entry("fake-one")], over = {}) {
  return AC.payload({ seq, issued_at: iso(T0 - 30 * DAY + seq * 1000), entries, ...over });
}
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export async function decideAll(env, entries, decision = "list", ruling_ref = "K9001") {
  for (const e of entries) {
    const r = await op(env, "decide", { entry_id: e.entry_id, version: e.version, decision, ruling_ref });
    if (r.status !== 200) throw new Error(`decide: ${JSON.stringify(r.json)}`);
  }
}
/** A payload signed and published through the operator door. */
export async function publishPayload(env, doc, { key, decide = true } = {}) {
  if (decide) await decideAll(env, doc.entries);
  const pub = await AC.publish(doc, key ? { key } : {});
  const r = await op(env, "publishCatalogue", { bytes: pub.body, statement: pub.statement, armored: pub.armored });
  return { ...r, pub };
}
export async function publishAdvisory(env, fields, { ruling_ref = P.STANDING_RULE, key } = {}) {
  const ad = await AC.advisory(fields, key ? { key } : {});
  const { armored, ...advisory } = ad;
  return op(env, "publishAdvisory", { advisory, armored, ruling_ref });
}

/** The seal key: an X25519 pair made for this run, its public document signed with the test catalogue key. */
export async function sealKey({ key = AC.KEY, seq = 1, key_id = "seal-test" } = {}) {
  const kp = await webcrypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const public_key = Buffer.from(await webcrypto.subtle.exportKey("raw", kp.publicKey)).toString("base64");
  const doc = { key_id, public_key, not_before: "2026-10-01T00:00:00Z", not_after: "2027-10-01T00:00:00Z", seq };
  const armored = await AC.sign(key, NS_AI_CATALOGUE, aiSealKeyStatement(doc));
  return { doc, armored, privateKey: kp.privateKey };
}

/* ------------------------------------------------------------------ challenges and bundles (ai-gate's code) */

export const DIGEST = `sha256:${"a".repeat(64)}`;
export async function runKey() {
  const k = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  return { pair: k, line: await gate.runPublicLine(k.publicKey) };
}
export async function register(env, image_digest = DIGEST) {
  return op(env, "registerDigest", { image_digest, release: "1.0.0-test", ruling_ref: "K9002" });
}
export function challengeBody(run, over = {}) {
  return { provider: "fakeco", plan: "fakeco-api", image_digest: DIGEST, bank_version: "bank-test", run_public_key: run.line, ...over };
}
export async function challenge(env, run, over = {}) {
  return call(env, "POST", "/ai/challenge", { body: challengeBody(run, over) });
}

const PAYLOAD = Object.freeze({ calls: [], run: {}, stub_logs: {}, preliminary: { preliminary: true } });
const sealPair = await webcrypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
export const SEAL = { key_id: "seal-test",
  public_key: Buffer.from(await webcrypto.subtle.exportKey("raw", sealPair.publicKey)).toString("base64") };

/** A bundle built as a container builds it, for a challenge; `extra` adds manifest fields inside the signed bytes,
 *  `edit` changes the manifest bytes after signing, `signer` signs with another run key. */
export async function bundle(ch, run, { extra = {}, digest = DIGEST, edit, signer, nonce } = {}) {
  const m = gate.buildManifest({ payload: PAYLOAD, nonce: nonce ?? ch.nonce, challenge_id: ch.challenge_id,
    run_public_key: run.line, sealed_to: SEAL.key_id, started_at: "2026-11-01T12:00:00Z", ended_at: "2026-11-01T13:00:00Z",
    suiteVersions: { bank: "bank-test", scorer: "scorer-1", thresholds: "thresholds-0", image: digest },
    declared: { provider: "fakeco", plan: "fakeco-api" }, spend: {}, tiers: [], image_digest_declared: digest });
  if (!m.ok) throw new Error(`manifest: ${JSON.stringify(m)}`);
  let manifestBytes = te.encode(canonicalJson({ ...m.manifest, ...extra }));
  const sealed = await gate.sealPayload(PAYLOAD, SEAL);
  const sig = await gate.signBundle(manifestBytes, sealed.sha256, (signer ?? run).pair);
  if (edit) manifestBytes = te.encode(edit(td.decode(manifestBytes)));
  return gate.encodeBundle({ manifestBytes, signature: sig.signature, sealed: sealed.sealed });
}
export const send = (env, bytes) => call(env, "POST", "/ai/bundle", { body: bytes });

/** A registered digest, a challenge and a verified bundle in one: answers the bundle's reply. */
export async function sentBundle(env, opts = {}) {
  const run = await runKey();
  const ch = (await challenge(env, run)).json;
  return (await send(env, await bundle(ch, run, opts))).json;
}

export function resultArgs(over = {}) {
  return { subject_id: "fake-one", parts: { ask: { verdict: "passes", limits: [] } },
    figures: { ask: { g1: { k: 9, n: 10 } } }, speed: { median_ms: 900, p90_ms: 1500, window: "30d" },
    task_cost: { low: 0.01, high: 0.02, unit: "usd", price_date: "2026-10-01" },
    suiteVersions: { bank: "bank-test", scorer: "scorer-1", thresholds: "thresholds-0", image: DIGEST },
    scorer_version: "scorer-1", tested_at: "2026-11-01T10:00:00Z", ...over };
}
