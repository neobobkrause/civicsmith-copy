/* capture's test fixture: a Durable Object storage stand-in over node:sqlite (`sql.exec`, `transactionSync` nesting
   as savepoints), record-core's tables, membership's and credentials' (K789: the signer keys R69 reads are credentials',
   its R11, built after membership as the host builds them), the two tables of provenance's stated read contract that
   capture joins (`register`, `captured_locators`: provenance R48, only the contract's columns), an evidence bucket,
   and stand-ins for the providers capture reaches (host-governor, provenance), each behaving as its Provides state.
   Attestation is never stood in for: R68 reaches its real `attest` (attestation R1–R3), whose authorities and archive
   answer through a scripted network (`network`, `granted`). */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { Capture } from "../../../src/capture/index.mjs";
import { holdsRegister } from "../provenance/fixtures.mjs";

export const sha = (b) => createHash("sha256").update(typeof b === "string" ? Buffer.from(b) : Buffer.from(b)).digest("hex");

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const s = {
    db,
    sql: { exec(q, ...args) { return db.prepare(q).all(...args.map((a) => (a === undefined ? null : a))); } },
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) db.exec(t);
  /* provenance R48's contract columns capture reads: `registered` orders a document's captures (R77). */
  db.exec(`CREATE TABLE register (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, path TEXT,
             registered TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z', bytes INTEGER)`);
  db.exec(`CREATE TABLE captured_locators (address_norm TEXT NOT NULL, address TEXT NOT NULL, capture_sha TEXT NOT NULL,
             via TEXT NOT NULL DEFAULT 'direct', first_retrieved TEXT NOT NULL, last_retrieved TEXT NOT NULL,
             observations INTEGER NOT NULL DEFAULT 1, retrieval_locator TEXT, PRIMARY KEY (address_norm, capture_sha, via))`);
  return s;
}

/* An evidence bucket stand-in (the R2 binding's shape), recording every call. */
export function bucket() {
  const held = new Map(), calls = [];
  /* a ranged read (`{range: {offset, length}}`, R2's option) answers those bytes alone, with the object's own size; none, the whole object */
  const obj = (k, range = null) => { const all = held.get(k), b = range ? all.subarray(range.offset, range.offset + range.length) : all;
    return { key: k, size: all.length, body: b, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
  return {
    calls, held, failPut: false,
    async head(k) { calls.push(["head", k]); return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async get(k, o) { const range = o && o.range ? o.range : null; calls.push(["get", k, range]); return held.has(k) ? obj(k, range) : null; },
    async put(k, bytes, opts) { calls.push(["put", k, opts]); if (this.failPut) throw new Error("bucket refused"); held.set(k, new Uint8Array(bytes)); return { key: k }; },
    async delete(k) { calls.push(["delete", k]); held.delete(k); },
  };
}

/* host-governor's R1–R14 as capture reaches them (`governorOf(ctx)`'s methods), each call recorded; `refuse` names
   hosts to refuse and `held` hosts cooling off. */
export function governor({ refuse = [], held = [] } = {}) {
  const calls = [];
  return {
    calls, configured: [],
    governorAdmit({ host }) { calls.push(["admit", host]); return refuse.includes(host)
      ? { admitted: false, reason: "cooling_off", retry_in_ms: 5000 } : { admitted: true, wait_ms: 0, appetite_per_min: 12 }; },
    governorReport(r) { calls.push(["report", r.host, r.status, r.retry_after_ms]); return { recorded: true }; },
    governorConfig(c) { this.configured.push(c); return { configured: true, ...c }; },
    isHeld(host) { calls.push(["isHeld", host]); return held.includes(host); },
  };
}

/* provenance's R5 and R13 as capture reaches them (`registerHolds`, `recordReceipt`). `registered` names the digests the
   register holds; `acquired` those an acquisition receipt names (a capture held in parts). */
export function provenance(s, { registered = [], acquired = [] } = {}) {
  const receipts = [];
  /* provenance's own answer to "what does the record hold" (K5044): its published fixture. The receipts this stand-in wrote are read from this store, so a
     rolled-back filing leaves none; a digest one names is asked of a provenance that holds a receipt for it. */
  const worlds = new Map();
  const heldFor = (digest) => {
    const named = [...s.sql.exec(`SELECT 1 AS x FROM captured_locators WHERE capture_sha = ? LIMIT 1`, digest)].length > 0;
    if (!worlds.has(named)) worlds.set(named, new Map());
    const byDigest = worlds.get(named);
    if (!byDigest.has(named ? digest : "")) byDigest.set(named ? digest : "", holdsRegister({ registered, acquired: named ? [...acquired, digest] : acquired }));
    return byDigest.get(named ? digest : "");
  };
  return {
    receipts,
    recordReceipt(r) {
      receipts.push(r);
      s.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved, last_retrieved, retrieval_locator)
                  VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET observations = observations + 1, last_retrieved = excluded.last_retrieved`,
                 r.addressNorm, r.address, r.captureSha, r.via || "direct", r.retrieved, r.retrieved, r.retrievalLocator);
      return { recorded: true };
    },
    signed: [],
    async signReceipt(r) { this.signed.push(r); return { ok: true, signed: true }; },
    /* R60: every receipt naming the capture, ordered by address then route */
    receiptsOfCapture({ captureSha }) {
      const rows = [...s.sql.exec(`SELECT address_norm, address, capture_sha, via, first_retrieved, last_retrieved, observations
                                    FROM captured_locators WHERE capture_sha = ? ORDER BY address_norm, via`, captureSha)].map((r) => ({ ...r }));
      return { capture_sha: captureSha, rows, observations: rows.reduce((n, r) => n + r.observations, 0) };
    },
    /* R5: provenance's own `registerHolds`, over the digests registered and those a receipt names, as provenance answers */
    registerHolds: (a) => heldFor(a.sha).registerHolds(a),
  };
}

/* A granted RFC 3161 TimeStampResp whose token carries the digest's raw bytes, which is what `signatures`'
   `parseTimestampResponse` binds a token on (the shape attestation's own tests answer with). */
export function granted(digestHex) {
  const der = (tag, body) => {
    const n = body.length;
    const len = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];
    return Buffer.concat([Buffer.from([tag, ...len]), body]);
  };
  const status = der(0x30, der(0x02, Buffer.from([0])));
  const token = der(0x30, Buffer.concat([der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02])),
                                          der(0x04, Buffer.from(digestHex, "hex"))]));
  return der(0x30, Buffer.concat([status, token]));
}

/* A fresh capture over a fresh store. `opts` goes to the Capture (env, governor, provenance). */
export function fresh({ env = {}, evidence = null, gov = null, prov = undefined } = {}) {
  const s = storage();
  const ctx = { storage: s };
  const core = recordOf(ctx, { evidence, evidencePrefix: "bio/captures/" });
  core.migrate();
  membershipOf(ctx, { record: core }).migrate();
  const credentials = credentialsOf(ctx, { record: core });
  credentials.migrate();
  const c = new Capture(s, { record: core, env: { ...env, ...(evidence ? { CAPTURES: evidence } : {}) }, governor: gov ?? governor(),
                             provenance: prov === undefined ? provenance(s) : prov, credentials });
  c.migrate();
  return { s, c, core, rows: (q, ...a) => s.sql.exec(q, ...a) };
}

/* A receipt row (provenance's) and a register row, for the joins capture reads on the contract. */
export function receipt(s, { address, capture, via = "direct", first, last = first, observations = 1 }) {
  s.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, first_retrieved, last_retrieved, observations)
              VALUES (?, ?, ?, ?, ?, ?, ?)`, address, address, capture, via, first, last, observations);
}
export function register(s, captureSha, bundleId, { type = "information", project = null, registered = "2026-01-01T00:00:00.000Z" } = {}) {
  s.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, registered) VALUES (?, ?, 'x', ?)`, captureSha, bundleId, registered);
  s.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version, project)
              VALUES (?, ?, 'g', 't', 'collected', '2026-01-01', '2026-01-01', 'x', 1, ?)`, bundleId, type, project);
}

/* A scripted network: `routes` maps a URL (or a function of it) to a Response or a thrower; every fetch is recorded. */
export function network(routes) {
  const seen = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u && u.url ? u.url : u);
    seen.push({ url, init });
    const r = typeof routes === "function" ? routes(url, init) : routes[url];
    if (r instanceof Error) throw r;
    if (!r) return new Response("not found", { status: 404 });
    return typeof r === "function" ? r(url, init) : r.clone();
  };
  return { seen, restore() { globalThis.fetch = orig; } };
}

export const H = (hex) => hex.padEnd(64, "0").slice(0, 64);

/* An SSHSIG signer (PROTOCOL.sshsig), for R69's signed accounts: an Ed25519 key and a detached signature over a
   message in a namespace, as `signatures.verifySshsig` verifies it. */
const enc = (s) => new TextEncoder().encode(s);
const cat8 = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? enc(v) : v; return cat8(u32(b.length), b); };
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
export async function newKey() {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { priv: kp.privateKey, raw, keyB64: b64(cat8(sstr("ssh-ed25519"), sstr(raw))) };
}
export async function sshsign(key, message, namespace) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-512", typeof message === "string" ? enc(message) : message));
  const signed = cat8(enc("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key.priv, signed));
  const blob = cat8(enc("SSHSIG"), u32(1), sstr(cat8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace),
    sstr(new Uint8Array(0)), sstr("sha512"), sstr(cat8(sstr("ssh-ed25519"), sstr(sig))));
  return `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;
}
/* A member in membership's table and a signer key in credentials' (`status` of each), as membership's R13/R16 and
   credentials' R6/R7 leave them. */
export function signer(s, memberId, keyB64, { keyStatus = "active", memberStatus = "active" } = {}) {
  s.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, role, status, created, updated) VALUES (?, 'c', 'member', ?, '2026-01-01', '2026-01-01')`,
             memberId, memberStatus);
  s.sql.exec(`INSERT INTO signers (key_b64, member_id, status, added) VALUES (?, ?, ?, '2026-01-01')`, keyB64, memberId, keyStatus);
}
