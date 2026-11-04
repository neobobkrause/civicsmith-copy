/* ai-catalogue over a real SQLite database (node:sqlite) with the real record-core beside it (declareTable, transact).
 * Every payload and advisory is signed here with a throwaway key written from PROTOCOL.sshsig with WebCrypto (the
 * precedent of signatures' own tests), the copy given that key's line as its list; CATALOGUE_KEYS is only read. The
 * provider is made up, `fakeco`, and every fact about it is payload data (R48). No network. */
import { DatabaseSync } from "node:sqlite";
import { createHash, webcrypto } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { aiCatalogueOf } from "../../../src/ai-catalogue/index.mjs";
import { NS_AI_CATALOGUE, NS_AI_ADVISORY, aiCatalogueStatement, aiAdvisoryStatement } from "../../../src/sshsig.mjs";

/* ------------------------------------------------------------------ an independent SSHSIG signer */

const te = new TextEncoder();
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const u8 = (...parts) => {
  const o = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0; for (const p of parts) { o.set(p, i); i += p.length; }
  return o;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? te.encode(v) : v; return u8(u32(b.length), b); };
const armor = (blob) => `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;

export async function newKey() {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  return { priv: kp.privateKey, raw, line: `ssh-ed25519 ${b64(u8(sstr("ssh-ed25519"), sstr(raw)))} throwaway` };
}
export async function sign(key, namespace, message) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", message));
  const signed = u8(te.encode("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, signed));
  return armor(u8(te.encode("SSHSIG"), u32(1), sstr(u8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace),
    sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
}

export const KEY = await newKey();
export const OTHER = await newKey();
export const sha = (s) => createHash("sha256").update(s).digest("hex");

/* ------------------------------------------------------------------ payload builders */

export const OPEN = Object.freeze({ open: true });
export const ev = (grade = "STATED", extra = {}) => ({ grade, source: "fixture source", date: "2026-10-01", ...extra });
export const quoted = (grade = "STATED") => ev(grade, { page: "https://fake.example/terms", quote: "fixture quote" });
export const claim = (value, grade = "STATED") => ({ value, ev: ev(grade) });
export const met = (answer = "met") => ({ answer, ev: quoted() });
export const gateOf = (verdict = "passes", limits = []) => ({ verdict, limits, partial_coverage: false,
  suiteVersions: { bank: "b1", scorer: "s1", thresholds: "t1", image: "i1" }, tier: null, at: "2026-10-01T00:00:00Z",
  run_ref: "run-1", ev: ev("REPRODUCED") });
const prop = (value) => ({ value, method: "suite", samples: 10, conditions: "fixture", ev: ev("REPRODUCED") });
export function characterization() {
  const c = {};
  for (let i = 1; i <= 9; i++) c[`CH${i}`] = prop(i);
  c.CH4 = { ...prop("reasonable"), ev: ev("REPORTED"), reviewer: "reviewer-1" };
  c.CH10 = { ref: "checks" };
  return c;
}
export const PARTS = ["ask", "draft", "read", "transcribe", "run", "account"];
export const allChecks = (answer = "met") => Object.fromEntries(["P1", "P2", "P3", "P4", "P5", "P6", "P7"].map((p) => [p, met(answer)]));

export function entry(id, over = {}) {
  return {
    entry_id: id, display_name: `Fake ${id}`, provider: "fakeco", host: "fakeco", model: `fake-model-${id}`,
    version: "2026-01-01", version_kind: "dated", plan_ids: ["fakeco-api"], adapter_type: "generic_chat",
    profile: { id: "fakeco-profile", min_version: 1 }, developer: { name: "Fake Co", jurisdiction: "ZZ" },
    capabilities: { tools: claim(true), parallel_tools: claim(true), schema_output: claim(true), schema_with_tools: claim(false),
      image_input: claim(true), streaming: claim("text"), session: claim("resend_only"), caching: claim("automatic"),
      batch: claim(false) },
    effort_set: { values: ["low", "medium", "high"], default: "medium", ev: ev() },
    effort_classes: { low: "low", medium: "medium", ev: ev() },
    limits: { context_stated: claim(200000), context_effective: claim(150000, "REPRODUCED"), max_output: claim(8000),
      image_max_bytes: OPEN },
    prices: { unit: "usd_per_million_tokens", input: 1, output: 2, cache_read: 0.1, cache_write: null, date: "2026-10-01", ev: ev() },
    zero_retention: claim(false), standard_task_costs: OPEN, served_ids: [`fake-model-${id}`],
    checks: allChecks(), shown: { terms_permit_use: met(), breach_notification: { answer: "OPEN" } },
    gate: Object.fromEntries(PARTS.map((p) => [p, gateOf()])), characterization: characterization(),
    lifecycle: "listed", confirmed_at: "2026-10-01", ...over,
  };
}
export function plan(id = "fakeco-api", over = {}) {
  return {
    plan_id: id, provider: "fakeco", kind: "api", scope: claim("team"), credential_kind: "api_key",
    means_allowed: claim(["gateway", "sealed"]), connection_ways: ["pasted_key"], runtimes: claim(["shared_worker"]),
    token_storage: claim("sealed"), price_basis: { basis: "per_token", includes: [], limits: [], date: "2026-10-01", ev: ev() },
    money: claim("priced"), restrictions: [], binding_terms: [], guidance_id: `${id}-guide`, free_tier_trains: claim(false),
    lifecycle: "listed", confirmed_at: "2026-10-01", ...over,
  };
}
export const guidance = (planId) => ({ guidance_id: `${planId}-guide`, plan_id: planId,
  steps: [{ kind: "link", text: { en: "fixture step" }, url: "https://fake.example/keys" }], ev: ev() });
export const profile = (over = {}) => ({ id: "fakeco-profile", adapter_type: "generic_chat", version: 1,
  base_url: "https://api.fake.example/v1", allowed_hosts: ["api.fake.example"], auth_style: "bearer", mappings: {},
  pin_map: null, idempotency: null, reasoning_billing: "in_output", features: [], quirks: [], served_report: null,
  key_shapes: ["^fk-[A-Za-z0-9]{20,}$"], ...over });
export const provider = (id = "fakeco", kind = "direct") => ({ id, name: `Name of ${id}`, kind });

export function payload(over = {}) {
  const plans = over.plans ?? [plan()];
  return {
    schema_version: 1, seq: 1, issued_at: "2026-10-01T00:00:00Z", providers: [provider()], parts: [...PARTS],
    policy: { origin: { check: "P7", barred: ["XB"] }, review_period_days: 90, stale_after_days: 14 },
    profiles: [profile()], plans, guidance: plans.map((p) => guidance(p.plan_id)), warnings: [],
    entries: [entry("fake-one")], tested: [], library: [], combined: [], ...over,
  };
}

/* ------------------------------------------------------------------ signing and the channel */

export async function publish(doc, { key = KEY, namespace = NS_AI_CATALOGUE, text } = {}) {
  const body = text ?? JSON.stringify(doc);
  const bytes = te.encode(body);
  const statement = { seq: doc.seq, schema_version: doc.schema_version, issued_at: doc.issued_at, sha256: sha(bytes), bytes: bytes.length };
  return { statement, armored: await sign(key, namespace, aiCatalogueStatement(statement)), body };
}
export async function advisory(fields, { key = KEY, namespace = NS_AI_ADVISORY } = {}) {
  return { ...fields, armored: await sign(key, namespace, aiAdvisoryStatement(fields)) };
}
export const adv = (seq, target, kind, over = {}) => ({ seq, target, kind, reason: "other",
  effective_at: "2026-10-01T00:00:00Z", issued_at: "2026-10-01T00:00:00Z", ...over });
export const indexOf = (pub, advisories = []) => JSON.stringify({ index_version: 1,
  catalogue: pub ? { ...pub.statement, path: `payloads/${pub.statement.seq}.json`, armored: pub.armored }
    : { seq: 1, schema_version: 1, issued_at: "2026-10-01T00:00:00Z", sha256: "0".repeat(64), bytes: 1, path: "payloads/1.json", armored: "" },
  advisories });

/** A pull: the index, then the payload if it is asked for. Answers both receives. */
export async function pull(cat, pub, { advisories = [], at = "2026-10-02T00:00:00Z", trigger = "schedule", body } = {}) {
  const index = await cat.receive({ kind: "index", status: 200, body: indexOf(pub, advisories), at, trigger });
  if (!index.fetch) return { index, payload: null };
  const p = await cat.receive({ kind: "payload", status: 200, body: body ?? pub.body, at, trigger });
  return { index, payload: p };
}

/* ------------------------------------------------------------------ a world */

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
export function sqlOver(db) {
  return { exec(q, ...args) {
    const st = db.prepare(q);
    return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
  } };
}

/** A copy over a fresh store: record-core and the catalogue, the throwaway key its list, the made-up adapter type
 *  registered unless `adapters` is false. `db` reopens an existing database (a restart). */
export async function world({ keys = [KEY.line], supported, env = {}, adapters = true, db = null, seed } = {}) {
  const fresh = !db;
  db = db ?? new DatabaseSync(":memory:");
  const sql = sqlOver(db);
  const storage = { sql, transactionSync(fn) {
    db.exec("SAVEPOINT t");
    try { const r = fn(); db.exec("RELEASE t"); return r; } catch (e) { db.exec("ROLLBACK TO t"); db.exec("RELEASE t"); throw e; }
  } };
  if (fresh) {
    const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) db.exec(t); }
  }
  const ctx = { storage };
  const record = recordOf(ctx);
  if (typeof record.migrate === "function") record.migrate();
  const cat = aiCatalogueOf(ctx, { record, keys, env, ...(supported ? { supported } : {}), ...(seed !== undefined ? { seed } : {}) });
  await cat.ready;
  if (adapters) cat.registerAdapterTypes([{ type: "generic_chat", profiles: { "fakeco-profile": 1 } }]);
  return { db, sql, record, cat };
}

/** A copy holding `doc` as its seed. */
export async function seeded(doc = payload(), opts = {}) {
  const w = await world(opts);
  const pub = await publish(doc);
  const r = await w.cat.loadSeed({ ...pub, at: "2026-10-01T00:00:00Z" });
  if (!r.ok) throw new Error(`seed refused: ${JSON.stringify(r)}`);
  return { ...w, pub };
}
export const AT = "2026-10-02T00:00:00Z";
