/* ai-issuer — the store: one SQLite-backed Durable Object (R24), its blobs beside it in two buckets: `DOCS`, the public
 * documents the Worker serves without this object (R1, R20), and `BLOBS`, the sealed payloads it cannot open (R12,
 * R15). Every act reaches it by RPC from the Worker (`index.mjs`), which has already judged the operator credential
 * (R19). Every instant is the `now` the Worker hands (R22). Tables are append-only except a bundle's destruction (R18),
 * a name's withdrawal (R17) and a nonce's `used` mark (R10, R12); no table holds a request's address, headers, user
 * agent, a team's secret, a plaintext payload or any record text of a team (R24). */
import { DurableObject } from "cloudflare:workers";
import { canonicalJson, createSha256 } from "../../bio-plane/src/record-grammar/index.mjs";
import { CATALOGUE_KEYS, verifyAiCatalogue, verifyAiAdvisory, verifyAiSealKey, verifyRunBundle, normalizeKey }
  from "../../bio-plane/src/sshsig.mjs";
import { validatePayload, TOKEN_RE } from "../../bio-plane/src/ai-catalogue/validate.mjs";
import { ADVISORY_KINDS, ADVISORY_REASONS, legalMove } from "../../bio-plane/src/ai-catalogue/lifecycle.mjs";
import { parseBundle, MANIFEST_KEYS } from "../../ai-gate/src/bundle.mjs";
import { BUNDLE_SCHEMA } from "../../ai-gate/src/params.mjs";
import { combineResults } from "../../ai-gate/src/verdict.mjs";
import { refusal } from "./checks.mjs";
import { paramsOf, STANDING_RULE, HEALTH_REPORT_VERSION } from "./params.mjs";

const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: true });

/* ------------------------------------------------------------------ small helpers */

export const shaHex = (bytes) => createSha256().update(typeof bytes === "string" ? te.encode(bytes) : bytes).hex();
const b64 = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
export const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const dayOf = (ms) => iso(ms).slice(0, 10);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const isText = (x, max = 200) => typeof x === "string" && x.trim() !== "" && x.length <= max;
const isWhole = (x) => Number.isSafeInteger(x) && x >= 0;
const isDay = (s) => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) && iso(Date.parse(`${s}T00:00:00Z`) || 0).startsWith(s);
const RULING_RE = /^K[0-9]+$/;
export const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
/** `months` calendar months before the instant `ms` (UTC), as ai-gate's combineResults counts them. */
export const monthsBefore = (ms, months) => { const d = new Date(ms); d.setUTCMonth(d.getUTCMonth() - months); return d.getTime(); };
const bad = (field) => refusal("ISSUER_BAD_REQUEST", { field });
const parse = (s) => (s === null || s === undefined ? null : JSON.parse(s));

/** R12, R14: the manifest schema the issuer reads: the container's (ai-gate's MANIFEST_KEYS) and the two consent
 *  fields R14 names, carried inside the signed manifest. */
export const ISSUER_MANIFEST_KEYS = Object.freeze([...MANIFEST_KEYS, "agree_named", "declared_team"]);
/** R14: fields naming a team, member or address, dropped unless `agree_named` is true. */
const NAMING_FIELDS = Object.freeze(["declared_team"]);
const NAMING_IN_DECLARED = Object.freeze(["team", "team_name", "member", "member_name", "address", "email", "contact"]);

/** R14: the manifest redacted to the schema, and without a name unless the team agreed. */
export function redactManifest(m) {
  const out = {};
  for (const k of ISSUER_MANIFEST_KEYS) if (Object.hasOwn(m, k)) out[k] = structuredClone(m[k]);
  if (out.agree_named !== true) {
    for (const k of NAMING_FIELDS) delete out[k];
    if (isObj(out.declared)) for (const k of NAMING_IN_DECLARED) delete out.declared[k];
  }
  return out;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, seq INTEGER NOT NULL,
    path TEXT NOT NULL, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL, statement TEXT NOT NULL, armored TEXT NOT NULL,
    targets TEXT, ruling_ref TEXT, by TEXT NOT NULL, at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id TEXT NOT NULL, version TEXT NOT NULL,
    decision TEXT NOT NULL, ruling_ref TEXT NOT NULL, by TEXT NOT NULL, at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS digests (id INTEGER PRIMARY KEY AUTOINCREMENT, image_digest TEXT NOT NULL, act TEXT NOT NULL,
    release TEXT, ruling_ref TEXT NOT NULL, by TEXT NOT NULL, at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS challenges (challenge_id TEXT PRIMARY KEY, nonce TEXT NOT NULL UNIQUE, provider TEXT NOT NULL,
    plan TEXT NOT NULL, image_digest TEXT NOT NULL, bank_version TEXT NOT NULL, run_public_key TEXT NOT NULL,
    issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS bundles (receipt_id TEXT PRIMARY KEY, challenge_id TEXT NOT NULL, status TEXT NOT NULL,
    reason TEXT, manifest TEXT, blob TEXT, payload_sha256 TEXT, token_sha256 TEXT NOT NULL UNIQUE,
    received_at INTEGER NOT NULL, destroyed_at INTEGER, destroy_reason TEXT)`,
  `CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt_id TEXT, run_ref TEXT,
    subject_id TEXT NOT NULL, grade TEXT NOT NULL, scorer_version TEXT NOT NULL, suite_versions TEXT NOT NULL,
    tested_at TEXT NOT NULL, record TEXT NOT NULL, by TEXT NOT NULL, at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS health (entry_id TEXT NOT NULL, day TEXT NOT NULL, reports INTEGER NOT NULL,
    calls INTEGER NOT NULL, refused INTEGER NOT NULL, silent INTEGER NOT NULL, errors TEXT NOT NULL,
    PRIMARY KEY (entry_id, day))`,
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, act TEXT NOT NULL, by TEXT, at TEXT NOT NULL,
    ruling_ref TEXT, outcome TEXT NOT NULL)`,
];
export const TABLES = Object.freeze(["documents", "decisions", "digests", "challenges", "bundles", "results", "health", "audit"]);
/** R26: the row that counts a day's reports, so the daily cap needs no row per report. */
const DAY_ROW = "*";
const LISTED = ["listed", "watch"];
const NARROWING = { watch: "hold", lapse: "lapse", retire: "retire" };

/** The catalogue keys this deployment trusts (R3, R8): `signatures`' CATALOGUE_KEYS, or the lines a test passes. */
function keysOf(env) {
  const v = env && env.CATALOGUE_KEYS;
  if (typeof v === "string" && v.trim()) return v.split("\n").map((l) => l.trim()).filter(Boolean);
  return [...CATALOGUE_KEYS];
}

export class IssuerStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.p = paramsOf(env);
    this.keys = keysOf(env);
    for (const s of SCHEMA) this.sql.exec(s);
  }

  #rows(q, ...b) { return [...this.sql.exec(q, ...b)].map((r) => ({ ...r })); }
  #one(q, ...b) { return this.#rows(q, ...b)[0] ?? null; }
  #tx(fn) { return this.ctx.storage.transactionSync(fn); }

  /* ================================================================ the audit (R19) */

  #audit(act, by, now, ruling_ref, outcome) {
    this.sql.exec(`INSERT INTO audit (act, by, at, ruling_ref, outcome) VALUES (?,?,?,?,?)`, String(act).slice(0, 64),
      typeof by === "string" ? by.slice(0, 200) : null, iso(now), typeof ruling_ref === "string" && RULING_RE.test(ruling_ref) ? ruling_ref : null,
      outcome);
  }

  /** R19: a refused act appends only its refusal; who asked is not taken from an unauthorised body. */
  refused(act, now) {
    this.#audit(act, null, now, null, "ISSUER_NOT_AUTHORISED");
    return true;
  }

  /** R19: every operator act, audited with `by` and its outcome. */
  async operator(act, args, now) {
    const fn = OPERATOR_ACTS.includes(act) ? this[act] : null;
    const a = isObj(args) ? args : {};
    let r;
    if (!fn) r = bad("act");
    else if (!isText(a.by)) r = bad("by");
    else r = await fn.call(this, a, now);
    this.#audit(act, a.by, now, a.ruling_ref, r && r.ok === false ? r.code : "ok");
    return r;
  }

  auditRows() { return this.#rows(`SELECT act, by, at, ruling_ref, outcome FROM audit ORDER BY id`); }

  /* ================================================================ documents (R1, R3–R5, R8) */

  #maxSeq() {
    return this.#one(`SELECT MAX(seq) AS m FROM documents WHERE kind IN ('catalogue','advisory')`)?.m ?? 0;
  }

  /** R5: the index, from the stored rows: the newest payload and every advisory above it, each with its signature. */
  #index() {
    const cat = this.#one(`SELECT * FROM documents WHERE kind='catalogue' ORDER BY seq DESC LIMIT 1`);
    if (!cat) return null;
    const st = parse(cat.statement);
    const advisories = this.#rows(`SELECT statement, armored FROM documents WHERE kind='advisory' AND seq>? ORDER BY seq`, cat.seq)
      .map((r) => ({ ...parse(r.statement), armored: r.armored }));
    return { index_version: 1, catalogue: { seq: st.seq, schema_version: st.schema_version, issued_at: st.issued_at,
      sha256: st.sha256, bytes: st.bytes, path: cat.path, armored: cat.armored }, advisories };
  }

  /* Stores a document's bytes, then its row, then the index; a failure after the row takes the row back, so nothing
     is half accepted (R3's atomicity). */
  async #accept(kind, path, body, row) {
    await this.env.DOCS.put(path, body);
    const id = this.#tx(() => {
      this.sql.exec(`INSERT INTO documents (kind, seq, path, sha256, bytes, statement, armored, targets, ruling_ref, by, at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`, kind, row.seq, path, shaHex(body), body.length, canonicalJson(row.statement),
        row.armored, row.targets === undefined ? null : canonicalJson(row.targets), row.ruling_ref ?? null, row.by, row.at);
      return this.#one(`SELECT MAX(id) AS id FROM documents`).id;
    });
    try {
      const index = this.#index();
      if (index) await this.env.DOCS.put("index.json", te.encode(canonicalJson(index)));
    } catch (e) {
      this.sql.exec(`DELETE FROM documents WHERE id=?`, id);
      throw e;
    }
  }

  /** R3: a signed payload, stored for serving only when every check holds, in order. */
  async publishCatalogue({ bytes, statement, armored, by }, now) {
    if (typeof bytes !== "string") return bad("bytes");
    const body = te.encode(bytes);
    const v = await verifyAiCatalogue(statement, armored, 0, this.keys);
    if (!v.ok) return refusal(v.reason, v.field ? { field: v.field } : {});
    const st = v.statement;
    if (shaHex(body) !== st.sha256 || body.length !== st.bytes) return refusal("DIGEST_MISMATCH", { seq: st.seq });
    const held = this.#maxSeq();
    if (!(st.seq > held)) return refusal("NOT_NEWER", { seq: st.seq, held });
    let payload;
    try { payload = JSON.parse(bytes); } catch { return refusal("CATALOGUE_PAYLOAD_INVALID", { path: "payload" }); }
    const val = validatePayload(payload);
    if (!val.ok) return refusal("CATALOGUE_PAYLOAD_INVALID", { reason: val.reason, path: val.path });
    for (const f of ["seq", "schema_version", "issued_at"])
      if (payload[f] !== st[f]) return refusal("CATALOGUE_PAYLOAD_INVALID", { path: f });
    for (const e of payload.entries) {
      const d = this.#latestDecision(e.entry_id, e.version);
      if (!d || d.decision !== "list") return refusal("ENTRY_NOT_DECIDED", { entry_id: e.entry_id, version: e.version });
    }
    const targets = {
      entries: Object.fromEntries(payload.entries.map((e) => [e.entry_id, e.lifecycle])),
      plans: Object.fromEntries(payload.plans.map((p) => [p.plan_id, p.lifecycle])),
      rows: payload.library.map((r) => r.row_id),
    };
    const path = `catalogue/${st.seq}.json`;
    await this.#accept("catalogue", path, body, { seq: st.seq, statement: st, armored, targets, by, at: iso(now) });
    return { ok: true, seq: st.seq, path, sha256: st.sha256 };
  }

  /** R4, R7: a signed advisory, stored when it verifies, is newer, names a reason from the one list, moves its target
   *  legally from its last published state, and is let by the standing rule or by Bob's own decision. */
  async publishAdvisory({ advisory, armored, ruling_ref, by }, now) {
    const held = this.#maxSeq();
    const v = await verifyAiAdvisory(advisory, armored, held, this.keys);
    if (!v.ok) return refusal(v.reason, v.field ? { field: v.field } : v.reason === "NOT_NEWER" ? { seq: v.seq, held } : {});
    const st = v.statement;
    if (!ADVISORY_REASONS.includes(st.reason)) return refusal("ADVISORY_REASON_UNKNOWN", { seq: st.seq, reason_given: st.reason });
    const [tk] = Object.keys(st.target);
    const id = st.target[tk];
    const to = ADVISORY_KINDS[st.kind];
    const from = this.#states().get(`${tk === "entry_id" ? "entry" : "plan"}:${id}`)?.state ?? null;
    if (!to || from === null || !legalMove(from, to)) return refusal("ADVISORY_BAD_MOVE", { seq: st.seq, from, to: to ?? null });
    if (typeof ruling_ref !== "string" || !RULING_RE.test(ruling_ref)) return refusal("DECISION_NO_RULING", { seq: st.seq });
    const narrowing = Object.hasOwn(NARROWING, st.kind);
    const standing = narrowing && st.reason !== "other" && ruling_ref === STANDING_RULE;
    if (!standing) {
      const d = this.#latestDecisionOf(id);
      const wanted = narrowing ? NARROWING[st.kind] : "clear";
      if (!d || d.decision !== wanted || d.ruling_ref !== ruling_ref) return refusal("ENTRY_NOT_DECIDED", { entry_id: id });
    }
    const path = `advisories/${st.seq}.json`;
    const body = te.encode(canonicalJson({ ...st, armored }));
    await this.#accept("advisory", path, body, { seq: st.seq, statement: st, armored, targets: { narrowing }, ruling_ref, by, at: iso(now) });
    return { ok: true, seq: st.seq, path };
  }

  /** R7: the narrowing advisories above `seq`, for the operator to report to Bob. */
  advisoriesSince({ seq }) {
    const from = Number.isSafeInteger(seq) ? seq : 0;
    return { ok: true, advisories: this.#rows(`SELECT seq, statement, ruling_ref, by, at, targets FROM documents
      WHERE kind='advisory' AND seq>? ORDER BY seq`, from).filter((r) => parse(r.targets)?.narrowing)
      .map((r) => ({ ...parse(r.statement), ruling_ref: r.ruling_ref, by: r.by, at: r.at })) };
  }

  /** R8: the seal key's public document, signed in NS_AI_CATALOGUE; a retired key keeps its document. */
  async publishSealKey({ doc, armored, by }, now) {
    const v = await verifyAiSealKey(doc, armored, this.keys);
    if (!v.ok) return refusal(v.reason, v.field ? { field: v.field } : {});
    const d = v.doc;
    const held = this.#one(`SELECT MAX(seq) AS m FROM documents WHERE kind='seal_key'`)?.m ?? 0;
    if (!(d.seq > held)) return refusal("NOT_NEWER", { seq: d.seq, held });
    const body = te.encode(canonicalJson({ ...d, armored }));
    await this.env.DOCS.put(`seal-keys/${d.key_id}-${d.seq}.json`, body);
    await this.env.DOCS.put("seal-key.json", body);
    this.sql.exec(`INSERT INTO documents (kind, seq, path, sha256, bytes, statement, armored, targets, ruling_ref, by, at)
      VALUES ('seal_key',?,?,?,?,?,?,NULL,NULL,?,?)`, d.seq, `seal-keys/${d.key_id}-${d.seq}.json`, shaHex(body), body.length,
      canonicalJson(d), armored, by, iso(now));
    return { ok: true, key_id: d.key_id, seq: d.seq };
  }

  /* The last published state of every target (`entry:<id>`, `plan:<id>`), and when it last left listed or watch:
     payloads in seq order set each target they name, advisories move it where the move is legal. */
  #states() {
    const states = new Map();
    const move = (key, to, at) => {
      const cur = states.get(key);
      const leftAt = LISTED.includes(to) ? null : cur && LISTED.includes(cur.state) ? at : cur?.leftAt ?? null;
      states.set(key, { state: to, leftAt });
    };
    for (const r of this.#rows(`SELECT kind, statement, targets FROM documents WHERE kind IN ('catalogue','advisory') ORDER BY seq`)) {
      const st = parse(r.statement), t = parse(r.targets);
      if (r.kind === "catalogue") {
        const at = Date.parse(st.issued_at);
        for (const [id, s] of Object.entries(t.entries)) move(`entry:${id}`, s, at);
        for (const [id, s] of Object.entries(t.plans)) move(`plan:${id}`, s, at);
      } else {
        const [tk] = Object.keys(st.target);
        const key = `${tk === "entry_id" ? "entry" : "plan"}:${st.target[tk]}`;
        const cur = states.get(key), to = ADVISORY_KINDS[st.kind];
        if (cur && to && legalMove(cur.state, to)) move(key, to, Date.parse(st.effective_at));
      }
    }
    return states;
  }

  /* ================================================================ Bob's decisions (R6) and the digests (R11) */

  #latestDecision(entry_id, version) {
    return this.#one(`SELECT * FROM decisions WHERE entry_id=? AND version=? ORDER BY id DESC LIMIT 1`, entry_id, version);
  }
  #latestDecisionOf(entry_id) {
    return this.#one(`SELECT * FROM decisions WHERE entry_id=? ORDER BY id DESC LIMIT 1`, entry_id);
  }

  /** R6: a decision, appended, never edited. */
  decide({ entry_id, version, decision, ruling_ref, by }, now) {
    if (typeof ruling_ref !== "string" || !RULING_RE.test(ruling_ref)) return refusal("DECISION_NO_RULING");
    if (typeof entry_id !== "string" || !TOKEN_RE.test(entry_id) || entry_id.length > 96) return bad("entry_id");
    if (!isText(version)) return bad("version");
    if (!["list", "hold", "lapse", "retire", "clear"].includes(decision)) return bad("decision");
    const at = iso(now);
    this.sql.exec(`INSERT INTO decisions (entry_id, version, decision, ruling_ref, by, at) VALUES (?,?,?,?,?,?)`,
      entry_id, version, decision, ruling_ref, by, at);
    return { ok: true, entry_id, version, decision, ruling_ref, by, at };
  }

  #digestAct(act, { image_digest, release, ruling_ref, by }, now) {
    if (typeof image_digest !== "string" || !DIGEST_RE.test(image_digest)) return bad("image_digest");
    if (typeof ruling_ref !== "string" || !RULING_RE.test(ruling_ref)) return refusal("DECISION_NO_RULING");
    if (act === "register" && !isText(release)) return bad("release");
    this.sql.exec(`INSERT INTO digests (image_digest, act, release, ruling_ref, by, at) VALUES (?,?,?,?,?,?)`,
      image_digest, act, act === "register" ? release : null, ruling_ref, by, iso(now));
    return { ok: true, image_digest, act };
  }
  /** R11 */
  registerDigest(a, now) { return this.#digestAct("register", a, now); }
  withdrawDigest(a, now) { return this.#digestAct("withdraw", a, now); }
  #digestRegistered(d) {
    return this.#one(`SELECT act FROM digests WHERE image_digest=? ORDER BY id DESC LIMIT 1`, d)?.act === "register";
  }

  /* ================================================================ challenges (R9, R10) */

  /** R9: a single-use nonce and a selection seed; nothing of the bank, no team name. */
  challenge(req, now) {
    const KEYS = ["provider", "plan", "entry_id", "declared_model", "image_digest", "bank_version", "run_public_key"];
    if (!isObj(req)) return bad("request");
    const extra = Object.keys(req).find((k) => !KEYS.includes(k));
    if (extra) return bad(extra);
    for (const f of ["provider", "plan"]) if (typeof req[f] !== "string" || !TOKEN_RE.test(req[f]) || req[f].length > 96) return bad(f);
    if (req.entry_id !== undefined && (typeof req.entry_id !== "string" || !TOKEN_RE.test(req.entry_id))) return bad("entry_id");
    if (req.declared_model !== undefined && !isText(req.declared_model)) return bad("declared_model");
    if (typeof req.image_digest !== "string" || !DIGEST_RE.test(req.image_digest)) return bad("image_digest");
    if (!isText(req.bank_version, 64)) return bad("bank_version");
    if (typeof req.run_public_key !== "string" || req.run_public_key.length > 400 || !normalizeKey(req.run_public_key))
      return bad("run_public_key");
    if (!this.#digestRegistered(req.image_digest)) return refusal("ISSUER_DIGEST_UNKNOWN");
    const outstanding = this.#one(`SELECT COUNT(*) AS n FROM challenges WHERE used_at IS NULL AND expires_at>?`, now).n;
    const dayStart = Date.parse(`${dayOf(now)}T00:00:00Z`);
    const today = this.#one(`SELECT COUNT(*) AS n FROM challenges WHERE issued_at>=? AND issued_at<?`, dayStart, dayStart + 86_400_000).n;
    if (outstanding >= this.p.NONCE_OUTSTANDING_MAX || today >= this.p.NONCE_DAILY_MAX) return refusal("ISSUER_RATE_LIMITED");
    const nonce = b64url(random(Math.ceil(this.p.NONCE_BITS / 8)));
    const challenge_id = `ch-${hex(random(12))}`;
    const selection_seed = b64url(random(16));
    const issued = Math.floor(now / 1000) * 1000, expires = issued + this.p.NONCE_LIFE_MS;
    this.sql.exec(`INSERT INTO challenges (challenge_id, nonce, provider, plan, image_digest, bank_version, run_public_key,
      issued_at, expires_at, used_at) VALUES (?,?,?,?,?,?,?,?,?,NULL)`, challenge_id, nonce, req.provider, req.plan,
      req.image_digest, req.bank_version, req.run_public_key, issued, expires);
    return { ok: true, challenge_id, nonce, bank_version: req.bank_version, selection_seed, issued_at: iso(issued), expires_at: iso(expires) };
  }

  /* ================================================================ bundles (R12–R15) */

  /** R12, R13, R14: the envelope checked, in order; a kept bundle stored redacted, with a result token given once. */
  async receiveBundle(bytes, now) {
    const receipt_id = `rcp-${hex(random(12))}`;
    const answer = (status, reason, more = {}) => {
      const row = reason ? refusal(reason) : null;
      return { ok: true, status, ...(reason ? { reason, check: row.check, word: row.word } : {}), receipt_id, ...more };
    };
    if (!(bytes instanceof Uint8Array)) return answer("rejected", "BUNDLE_UNREADABLE");
    if (bytes.length > this.p.BUNDLE_MAX_BYTES) return answer("rejected", "BUNDLE_TOO_LARGE");
    /* everything up to the used mark is synchronous, so no other request runs between the check and the mark */
    const parts = parseBundle(bytes);
    if (!parts || parts.schema !== BUNDLE_SCHEMA) return answer("rejected", "BUNDLE_UNREADABLE");
    let manifest;
    try { manifest = JSON.parse(td.decode(parts.manifest)); } catch { return answer("rejected", "BUNDLE_UNREADABLE"); }
    if (!isObj(manifest) || manifest.schema !== BUNDLE_SCHEMA || typeof manifest.challenge_id !== "string")
      return answer("rejected", "BUNDLE_UNREADABLE");
    const ch = this.#one(`SELECT * FROM challenges WHERE challenge_id=?`, manifest.challenge_id);
    if (!ch || ch.nonce !== manifest.nonce) return answer("rejected", "NONCE_UNKNOWN");
    let reason = null;
    if (now >= ch.expires_at) reason = "NONCE_EXPIRED";
    else {
      if (ch.used_at !== null) return answer("rejected", "NONCE_REUSED");
      this.sql.exec(`UPDATE challenges SET used_at=? WHERE challenge_id=? AND used_at IS NULL`, now, ch.challenge_id);
    }
    if (!reason && (manifest.image_digest_declared !== ch.image_digest || !this.#digestRegistered(ch.image_digest)))
      reason = "IMAGE_DIGEST_MISMATCH";
    const payloadSha = shaHex(parts.payload);
    if (!reason) {
      let armored;
      try { armored = td.decode(parts.signature); } catch { armored = ""; }
      const sig = await verifyRunBundle({ manifestBytes: parts.manifest, payloadSha256: payloadSha, armored, runPublicKey: ch.run_public_key });
      if (!sig.ok) reason = sig.reason === "UNKNOWN_KEY" ? "UNKNOWN_KEY" : "BAD_SIGNATURE";
    }
    const extra = Object.keys(manifest).find((k) => !ISSUER_MANIFEST_KEYS.includes(k));
    if (extra) return answer("rejected", "BUNDLE_UNREADABLE", { field: extra });
    const status = reason ? "unverified" : "verified_envelope";
    const token = b64url(random(Math.ceil(this.p.NONCE_BITS / 8)));
    const blob = `bundles/${receipt_id}`;
    await this.env.BLOBS.put(blob, parts.payload);
    this.sql.exec(`INSERT INTO bundles (receipt_id, challenge_id, status, reason, manifest, blob, payload_sha256, token_sha256,
      received_at, destroyed_at, destroy_reason) VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL)`, receipt_id, ch.challenge_id, status,
      reason, canonicalJson(redactManifest(manifest)), blob, payloadSha, shaHex(token), now);
    if (!reason) return { ok: true, status, receipt_id, result_token: token };
    const row = rowOrNull(reason);
    return { ok: true, status, reason, ...(row ? { check: row.check, word: row.word } : {}), receipt_id, result_token: token };
  }

  /** R16: verified bundles for the scorer, sealed bytes as base64, each with the time it is due by. */
  async bundlesToScore({ after, limit }) {
    const n = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const from = typeof after === "string" ? after : "";
    const out = [];
    for (const b of this.#rows(`SELECT * FROM bundles WHERE status='verified_envelope' AND destroyed_at IS NULL AND receipt_id>?
      ORDER BY receipt_id LIMIT ?`, from, n)) {
      const obj = await this.env.BLOBS.get(b.blob);
      const sealed = obj ? new Uint8Array(await obj.arrayBuffer()) : null;
      out.push({ receipt_id: b.receipt_id, manifest: parse(b.manifest), sealed: sealed ? b64(sealed) : null,
        payload_sha256: b.payload_sha256, received_at: iso(b.received_at), due_by: iso(b.received_at + this.p.SCORE_WITHIN_MS),
        scored: !!this.#one(`SELECT id FROM results WHERE receipt_id=? LIMIT 1`, b.receipt_id) });
    }
    return { ok: true, bundles: out };
  }

  /* ================================================================ results (R16–R18, R25) */

  /** R16: the scorer's conclusion, REPORTED for a receipt and REPRODUCED only for Civicsmith's own run. */
  recordResult(a, now) {
    const { receipt_id, own_run, run_ref, subject_id, parts, figures, speed, task_cost, suiteVersions, scorer_version, tested_at, grade, by } = a;
    const isReceipt = typeof receipt_id === "string";
    if (isReceipt === (own_run === true)) return refusal("RESULT_REFUSED", { field: "receipt_id" });
    const want = isReceipt ? "REPORTED" : "REPRODUCED";
    if (grade !== undefined && grade !== want) return refusal("RESULT_REFUSED", { field: "grade" });
    if (!isReceipt && !isText(run_ref)) return bad("run_ref");
    if (typeof subject_id !== "string" || !TOKEN_RE.test(subject_id) || subject_id.length > 96) return bad("subject_id");
    if (!isObj(parts)) return bad("parts");
    if (!isObj(figures)) return bad("figures");
    if (!isObj(suiteVersions)) return bad("suiteVersions");
    if (!isText(scorer_version, 64)) return bad("scorer_version");
    if (typeof tested_at !== "string" || !Number.isFinite(Date.parse(tested_at)) || !isDay(tested_at.slice(0, 10))) return bad("tested_at");
    if (isReceipt) {
      const b = this.#one(`SELECT status, destroyed_at FROM bundles WHERE receipt_id=?`, receipt_id);
      if (!b || b.status !== "verified_envelope" || b.destroyed_at !== null) return refusal("RESULT_REFUSED", { field: "receipt_id" });
    }
    const sv = canonicalJson(suiteVersions);
    const same = isReceipt
      ? this.#one(`SELECT id FROM results WHERE receipt_id=? AND scorer_version=? AND suite_versions=?`, receipt_id, scorer_version, sv)
      : this.#one(`SELECT id FROM results WHERE run_ref=? AND scorer_version=? AND suite_versions=?`, run_ref, scorer_version, sv);
    if (same) return refusal("RESULT_REFUSED", { field: "scorer_version" });
    const record = { parts, figures, speed: speed ?? null, task_cost: task_cost ?? null };
    this.sql.exec(`INSERT INTO results (receipt_id, run_ref, subject_id, grade, scorer_version, suite_versions, tested_at, record, by, at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`, isReceipt ? receipt_id : null, isReceipt ? null : run_ref, subject_id, want, scorer_version,
      sv, tested_at, canonicalJson(record), by, iso(now));
    return { ok: true, grade: want, row_id: `r-${this.#one(`SELECT MAX(id) AS id FROM results`).id}` };
  }

  /* The current results: per receipt or own run, the latest only (a re-score supersedes). */
  #current(subject_id) {
    const latest = new Map();
    for (const r of this.#rows(`SELECT * FROM results WHERE subject_id=? ORDER BY id`, subject_id))
      latest.set(r.receipt_id !== null ? `rcp:${r.receipt_id}` : `run:${r.run_ref}`, r);
    return [...latest.values()].sort((a, b) => a.id - b.id);
  }
  #repeated(subject_id, sv) {
    return this.#current(subject_id).some((r) => r.grade === "REPRODUCED" && r.suite_versions === sv);
  }
  #atOf(at, now) { return typeof at === "string" && Number.isFinite(Date.parse(at)) ? Date.parse(at) : now; }

  /** R17: the library rows of a subject's active results, named only where the team agreed. */
  libraryRowsFor({ subject_id, at }, now) {
    const when = this.#atOf(at, now), from = monthsBefore(when, this.p.RESULT_ACTIVE_MONTHS);
    const rows = [];
    for (const r of this.#current(subject_id)) {
      const t = Date.parse(r.tested_at);
      if (!(t > from && t <= when)) continue;
      const rec = parse(r.record);
      const team = r.grade === "REPORTED";
      const row = { row_id: `r-${r.id}`, subject_id: r.subject_id, suiteVersions: parse(r.suite_versions), parts: rec.parts,
        speed: rec.speed ?? { open: true }, task_cost: rec.task_cost ?? { open: true }, tested_by: team ? "team" : "civicsmith",
        tested_at: r.tested_at.slice(0, 10), grade: r.grade, repeated_by_civicsmith: team && this.#repeated(r.subject_id, r.suite_versions) };
      if (team) {
        const m = parse(this.#one(`SELECT manifest FROM bundles WHERE receipt_id=?`, r.receipt_id)?.manifest ?? null);
        if (m && m.agree_named === true && isText(m.declared_team, 120)) Object.assign(row, { team_name: m.declared_team, consent_ref: r.receipt_id });
      }
      rows.push(row);
    }
    return { ok: true, rows };
  }

  /** R17: the combined records of a subject's results, by ai-gate's combineResults. */
  combinedFor({ subject_id, at, suiteVersions, thresholds }, now) {
    const when = iso(this.#atOf(at, now));
    const results = this.#current(subject_id).map((r) => {
      const rec = parse(r.record);
      return { subject_id: r.subject_id, figures: rec.figures, grade: r.grade, suiteVersions: parse(r.suite_versions),
        tested_at: r.tested_at, speed: rec.speed, task_cost: rec.task_cost,
        limits: Object.fromEntries(Object.entries(rec.parts ?? {}).map(([p, v]) => [p, Array.isArray(v?.limits) ? v.limits : []])) };
    });
    const c = combineResults(results, { at: when, activeMonths: this.p.RESULT_ACTIVE_MONTHS, suiteVersions, thresholds });
    if (!c.ok) return bad("suiteVersions");
    return { ok: true, records: c.records, left_out: c.left_out };
  }

  /** R17: a team's agreement to be named, withdrawn: the name leaves the stored manifest. */
  withdrawName({ receipt_id }) {
    const b = typeof receipt_id === "string" ? this.#one(`SELECT manifest FROM bundles WHERE receipt_id=?`, receipt_id) : null;
    if (!b) return bad("receipt_id");
    const m = parse(b.manifest);
    if (m) {
      m.agree_named = false;
      this.sql.exec(`UPDATE bundles SET manifest=? WHERE receipt_id=?`, canonicalJson(redactManifest(m)), receipt_id);
    }
    return { ok: true, receipt_id };
  }

  /** R18: the payload and manifest destroyed, a tombstone kept, unpublished results removed. */
  async destroyBundle({ receipt_id, reason, by }, now) {
    const b = typeof receipt_id === "string" ? this.#one(`SELECT * FROM bundles WHERE receipt_id=?`, receipt_id) : null;
    if (!b) return bad("receipt_id");
    if (!isText(reason, 64)) return bad("reason");
    if (b.destroyed_at !== null) return { ok: true, receipt_id, reason: b.destroy_reason, at: iso(b.destroyed_at) };
    if (b.blob) await this.env.BLOBS.delete(b.blob);
    const published = new Set();
    for (const r of this.#rows(`SELECT targets FROM documents WHERE kind='catalogue'`)) for (const id of parse(r.targets).rows) published.add(id);
    this.#tx(() => {
      this.sql.exec(`UPDATE bundles SET manifest=NULL, blob=NULL, destroyed_at=?, destroy_reason=? WHERE receipt_id=?`, now, reason, receipt_id);
      for (const r of this.#rows(`SELECT id FROM results WHERE receipt_id=?`, receipt_id))
        if (!published.has(`r-${r.id}`)) this.sql.exec(`DELETE FROM results WHERE id=?`, r.id);
    });
    return { ok: true, receipt_id, reason, at: iso(now) };
  }

  /** R18: the daily sweep: a scored bundle whose result is no longer active and whose subject is neither listed nor
   *  left listed less than LISTED_TAIL_MONTHS ago is destroyed. */
  async sweep(now) {
    const active = monthsBefore(now, this.p.RESULT_ACTIVE_MONTHS), tail = monthsBefore(now, this.p.LISTED_TAIL_MONTHS);
    const states = this.#states();
    const destroyed = [];
    for (const b of this.#rows(`SELECT receipt_id FROM bundles WHERE status='verified_envelope' AND destroyed_at IS NULL`)) {
      const r = this.#one(`SELECT subject_id, tested_at FROM results WHERE receipt_id=? ORDER BY id DESC LIMIT 1`, b.receipt_id);
      if (!r) continue;
      if (Date.parse(r.tested_at) > active) continue;
      const s = states.get(`entry:${r.subject_id}`);
      if (s && (LISTED.includes(s.state) || (s.leftAt !== null && s.leftAt > tail))) continue;
      await this.destroyBundle({ receipt_id: b.receipt_id, reason: "retention", by: "sweep" }, now);
      this.#audit("destroyBundle", "sweep", now, null, "ok");
      destroyed.push(b.receipt_id);
    }
    return { ok: true, destroyed };
  }

  /** R25: a team's own result by its token's SHA-256; null for a token no bundle holds. Writes nothing. */
  resultFor(tokenSha) {
    const b = this.#one(`SELECT receipt_id, destroyed_at, destroy_reason FROM bundles WHERE token_sha256=?`, tokenSha);
    if (!b) return null;
    if (b.destroyed_at !== null) return { status: "destroyed", reason: b.destroy_reason };
    const r = this.#one(`SELECT * FROM results WHERE receipt_id=? ORDER BY id DESC LIMIT 1`, b.receipt_id);
    if (!r) return { status: "pending" };
    const rec = parse(r.record);
    return { status: "scored", subject_id: r.subject_id, parts: rec.parts, figures: rec.figures, speed: rec.speed,
      task_cost: rec.task_cost, suiteVersions: parse(r.suite_versions), grade: "REPORTED",
      repeated_by_civicsmith: this.#repeated(r.subject_id, r.suite_versions), tested_at: r.tested_at };
  }

  /* ================================================================ health (R26) */

  /** R26: one report added into the aggregate per (entry, day); nothing of the request kept. */
  health(report, now) {
    const today = dayOf(now);
    const floor = dayOf(Date.parse(`${today}T00:00:00Z`) - this.p.HEALTH_DAYS_MAX * 86_400_000);
    if (!isObj(report)) return bad("report");
    const extra = Object.keys(report).find((k) => !["report_version", "day", "entries"].includes(k));
    if (extra) return bad(extra);
    if (report.report_version !== HEALTH_REPORT_VERSION) return bad("report_version");
    if (!isDay(report.day) || !(report.day < today) || report.day < floor) return bad("day");
    if (!Array.isArray(report.entries) || report.entries.length > 500) return bad("entries");
    const adds = [];
    for (const [i, e] of report.entries.entries()) {
      const f = `entries[${i}]`;
      if (!isObj(e) || Object.keys(e).some((k) => !["entry_id", "calls", "refused", "silent", "errors"].includes(k))) return bad(f);
      if (typeof e.entry_id !== "string" || !TOKEN_RE.test(e.entry_id)) return bad(`${f}.entry_id`);
      for (const k of ["calls", "refused", "silent"]) if (!isWhole(e[k])) return bad(`${f}.${k}`);
      const errors = e.errors ?? {};
      if (!isObj(errors) || Object.keys(errors).length > 32 || Object.entries(errors).some(([k, n]) => !/^[a-z_]{1,32}$/.test(k) || !isWhole(n)))
        return bad(`${f}.errors`);
      const failed = e.refused + e.silent + Object.values(errors).reduce((s, n) => s + n, 0);
      if (failed > e.calls) return bad(`${f}.calls`);
      adds.push({ ...e, errors });
    }
    const dayRow = this.#one(`SELECT reports FROM health WHERE entry_id=? AND day=?`, DAY_ROW, report.day);
    if ((dayRow?.reports ?? 0) >= this.p.HEALTH_DAILY_MAX) return refusal("ISSUER_RATE_LIMITED");
    const published = new Set();
    for (const r of this.#rows(`SELECT targets FROM documents WHERE kind='catalogue'`)) for (const id of Object.keys(parse(r.targets).entries)) published.add(id);
    let counted = 0;
    this.#tx(() => {
      this.#add(DAY_ROW, report.day, { calls: 0, refused: 0, silent: 0, errors: {} });
      for (const e of adds) if (published.has(e.entry_id)) { this.#add(e.entry_id, report.day, e); counted++; }
    });
    return { ok: true, counted };
  }
  #add(entry_id, day, e) {
    const cur = this.#one(`SELECT * FROM health WHERE entry_id=? AND day=?`, entry_id, day);
    const errors = cur ? parse(cur.errors) : {};
    for (const [k, n] of Object.entries(e.errors)) errors[k] = (errors[k] ?? 0) + n;
    const sorted = Object.fromEntries(Object.keys(errors).sort().map((k) => [k, errors[k]]));
    if (cur) this.sql.exec(`UPDATE health SET reports=reports+1, calls=calls+?, refused=refused+?, silent=silent+?, errors=?
      WHERE entry_id=? AND day=?`, e.calls, e.refused, e.silent, canonicalJson(sorted), entry_id, day);
    else this.sql.exec(`INSERT INTO health (entry_id, day, reports, calls, refused, silent, errors) VALUES (?,?,1,?,?,?,?)`,
      entry_id, day, e.calls, e.refused, e.silent, canonicalJson(sorted));
  }

  /** R26: the aggregate of an entry between two days, for ai-gate's health signal. */
  healthFor({ entry_id, from, to }) {
    if (typeof entry_id !== "string" || !TOKEN_RE.test(entry_id)) return bad("entry_id");
    if (!isDay(from)) return bad("from");
    if (!isDay(to)) return bad("to");
    return { ok: true, days: this.#rows(`SELECT day, reports, calls, refused, silent, errors FROM health WHERE entry_id=? AND day>=? AND day<=?
      ORDER BY day`, entry_id, from, to).map((r) => ({ ...r, errors: parse(r.errors) })) };
  }
}

const rowOrNull = (code) => { const r = refusal(code); return r.check ? r : null; };

/** R19: the operator acts, each behind the one credential. */
export const OPERATOR_ACTS = Object.freeze(["publishCatalogue", "publishAdvisory", "publishSealKey", "decide", "registerDigest",
  "withdrawDigest", "bundlesToScore", "recordResult", "libraryRowsFor", "combinedFor", "healthFor", "withdrawName",
  "destroyBundle", "advisoriesSince"]);
