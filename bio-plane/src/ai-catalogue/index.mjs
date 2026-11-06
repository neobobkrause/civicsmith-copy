/* ai-catalogue — what a team's copy knows about the AIs it may be offered, and how it keeps that knowledge current
 * without a release: the signed, closed list of entries (a model at a host), their plans, evidence, the seven checks,
 * the Gate 1 verdict per part, lifecycle and advisories, and the published results library.
 *
 * Requirements: build/requirements/ai-catalogue.md (R1–R55; T53, K5457, K5482, N1220). It chooses no account, holds no
 * credential, calls no AI, makes no network call (R34 only states the request a caller makes, R52), writes no sentence
 * (R49) and names no provider: every provider fact is payload data (R48).
 *
 * SHAPE (K61). `aiCatalogueOf(ctx)` answers the one instance for a Durable Object's storage, over `ctx.storage.sql`,
 * reaching record-core by `recordOf(ctx)`; a test passes its own as `aiCatalogueOf(ctx, { record, env, clock, keys })`.
 * The instance is ready once `ready` resolves: every held payload and advisory is re-verified from its table, so a row
 * written without a verified statement is never read (R47). The only writers are `loadSeed`, `receive`,
 * `registerAdapterTypes` (in memory), `rollback` and `unrollback`; every read never throws, writes nothing and answers a
 * frozen, deterministic value, ordered by provider then entry id. */
import { canonicalJson, createSha256 } from "../record-grammar/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { CATALOGUE_KEYS, verifyAiCatalogue, verifyAiAdvisory } from "../sshsig.mjs";
import { CATALOGUE_CHECKS, CATALOGUE_STATES, STATE_WORDS, refusal } from "./checks.mjs";
import { AI_CATALOGUE_SCHEMA, AI_CATALOGUE_TABLES, AI_CATALOGUE_DECLARATIONS } from "./schema.mjs";
import { validatePayload, isObj, isOpen, isInstant, isDate, TOKEN_RE, CHECK_IDS, SHOWN_IDS, ENTRY_ID_MAX, DISPLAY_NAME_MAX,
  EFFORT_WORD_MAX, GRADES, LIFECYCLE, VERDICTS, LIMIT_KINDS } from "./validate.mjs";
import { ADVISORY_KINDS, ADVISORY_REASONS, MOVES, legalMove, badMove, effectiveState } from "./lifecycle.mjs";
import { RELEASE_SEED, SEED_PAYLOAD, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_MARK, DEVELOPMENT_KEY_VAR, isDevelopmentKey,
  catalogueKeysFor, seedOf, DEVELOPMENT_SEED, DEVELOPMENT_SEED_PAYLOAD, DEVELOPMENT_PROVIDER, DEVELOPMENT_PLAN, DEVELOPMENT_ADAPTERS, seedFor } from "./seed.mjs";

export { RELEASE_SEED, SEED_PAYLOAD, SEED_SIGNATURE_VAR, DEVELOPMENT_VAR, DEVELOPMENT_KEY_MARK, DEVELOPMENT_KEY_VAR, isDevelopmentKey,
  catalogueKeysFor, seedOf, DEVELOPMENT_SEED, DEVELOPMENT_SEED_PAYLOAD, DEVELOPMENT_PROVIDER, DEVELOPMENT_PLAN, DEVELOPMENT_ADAPTERS, seedFor };

export { validatePayload, CATALOGUE_CHECKS, CATALOGUE_STATES, STATE_WORDS, AI_CATALOGUE_TABLES, AI_CATALOGUE_DECLARATIONS,
  ADVISORY_KINDS, ADVISORY_REASONS, MOVES, CHECK_IDS, SHOWN_IDS, ENTRY_ID_MAX, DISPLAY_NAME_MAX, EFFORT_WORD_MAX, GRADES,
  LIFECYCLE, VERDICTS, LIMIT_KINDS };

/* ------------------------------------------------------------------ parameters (Suggestions; K5457, K5482, K5483) */

/** R37: the schema versions this release reads. */
export const SCHEMA_VERSIONS_READ = Object.freeze([1]);
export const INDEX_MAX_BYTES = 64 * 1024;
export const CATALOGUE_MAX_BYTES = 4 * 1024 * 1024;
export const HELD_VERSIONS = 5;
export const RESULT_ACTIVE_MONTHS = 6;
export const CATALOGUE_USER_AGENT = "Civicsmith-catalogue/1";
/** R34: the fixed address of the index `ai-issuer` serves, the publisher's own; payloads are relative paths beneath it. */
export const CATALOGUE_ADDRESS = "https://ai-issuer.believeinoakland.workers.dev/catalogue/index.json";
export const CHECK_TRIGGERS = Object.freeze(["schedule", "manual"]);

/* The store's single value is about 2.1 MB; a payload's text is held in chunks of at most this many UTF-16 units, so no
   chunk exceeds it in UTF-8 even at four bytes a character. */
const CHUNK = 480_000;

/* ------------------------------------------------------------------ small helpers */

const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const sha256Of = (bytes) => createSha256().update(bytes).hex();
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const dayOf = (instant) => instant.slice(0, 10);
const dayMs = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const daysBetween = (fromDay, toDay) => Math.round((dayMs(toDay) - dayMs(fromDay)) / 86_400_000);
const addDays = (d, n) => iso(dayMs(d) + n * 86_400_000).slice(0, 10);
/* `months` calendar months before day `d`, the day of the month clamped to the target month's last */
function monthsBefore(d, months) {
  let y = +d.slice(0, 4), m = +d.slice(5, 7) - months;
  while (m < 1) { m += 12; y -= 1; }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(Math.min(+d.slice(8, 10), last)).padStart(2, "0")}`;
}
function deepFreeze(x) {
  if (x && typeof x === "object" && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) deepFreeze(v); }
  return x;
}
const out = (x) => deepFreeze(structuredClone(x));
const toBytes = (body) => (typeof body === "string" ? te.encode(body) : body instanceof Uint8Array ? body
  : body instanceof ArrayBuffer ? new Uint8Array(body) : null);
const byProviderThenId = (idKey) => (a, b) => (a.provider < b.provider ? -1 : a.provider > b.provider ? 1
  : a[idKey] < b[idKey] ? -1 : a[idKey] > b[idKey] ? 1 : 0);
const answerOf = (c) => (isOpen(c) ? "OPEN" : c.answer);
const valueOf = (c) => (c === undefined ? undefined : isOpen(c) ? { open: true } : c.value);
const LEVELS = Object.freeze({ member: ["member"], project: ["member", "project"], team: ["member", "project", "group"] });
const PATH_RE = /^[a-z0-9._/-]+$/;

/* ------------------------------------------------------------------ R34: the request a caller makes */

/** R34: the GET a caller makes for the `index`, or for a payload at a relative `path` beneath the address. Headers are
 *  only `accept` and the fixed user agent; nothing of the team, its members, settings or version travels. The caller
 *  follows no redirect and reads at most `max_bytes`. */
export function pullRequest(kind, path) {
  /* DEC-49 REGION is-path-relative */
  let url;
  if (kind === "index" && path === undefined) url = CATALOGUE_ADDRESS;
  else if (kind === "payload" && typeof path === "string" && PATH_RE.test(path) && !path.startsWith("/")
           && !path.split("/").some((s) => s === ".." || s === "." || s === "")) url = new URL(path, CATALOGUE_ADDRESS).href;
  else return refusal("CATALOGUE_PATH_INVALID", { kind: typeof kind === "string" ? kind : null, path: typeof path === "string" ? path : null });
  /* END DEC-49 REGION is-path-relative */
  return out({ ok: true, method: "GET", url, redirect: "manual",
    headers: { accept: "application/json", "user-agent": CATALOGUE_USER_AGENT },
    max_bytes: kind === "index" ? INDEX_MAX_BYTES : CATALOGUE_MAX_BYTES });
}

/* ------------------------------------------------------------------ the catalogue */

export class AiCatalogue {
  #sql; #core; #env; #clock; #keys; #supported; #seed;
  #held = new Map();        /* seq → a held, verified payload: its statement, source, text and parsed document */
  #advisories = [];         /* verified advisories, by seq */
  #rollbacks = [];          /* rollback and unrollback rows, in order */
  #checks = [];             /* {at, trigger, kind, outcome, seq} */
  #adapters = new Map();    /* R38: type → {profile id → version} */
  #pending = null;          /* R35: the index's catalogue line, until its payload is received */
  #view = null;             /* the applied fold, rebuilt after every write */

  constructor({ sql, core = null, env = {}, clock = null, keys = CATALOGUE_KEYS, supported = SCHEMA_VERSIONS_READ,
    seed } = {}) {
    this.#sql = sql;
    this.#core = core;
    this.#env = env || {};
    this.#clock = typeof clock === "function" ? clock : () => Date.now();
    /* the keys this build trusts: development lines only where the deployment says it is one (seed.mjs) */
    this.#keys = catalogueKeysFor(keys, this.#env);
    /* F2: with no seed handed, the release's, or the development seed where the deployment says it is one */
    this.#seed = seed === undefined ? seedFor(this.#env) : seed;
    this.#supported = Object.freeze([...supported]);
    this.ready = null;
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #transact(fn) { return this.#core && typeof this.#core.transact === "function" ? this.#core.transact(fn) : fn(); }

  /** R50: every instant read from the store's clock: a handed `at`, else `env.BIO_NOW_MS`, else the wall clock. */
  #now(at) {
    if (typeof at === "number" && Number.isFinite(at)) return iso(at);
    if (typeof at === "string" && !Number.isNaN(Date.parse(at))) return iso(Date.parse(at));
    const pin = Number(this.#env.BIO_NOW_MS);
    if (this.#env.BIO_NOW_MS !== undefined && Number.isFinite(pin)) return iso(pin);
    return iso(this.#clock());
  }

  /* R46: the tables, at every boot, idempotent; then their declaration. */
  migrate() {
    const bare = AI_CATALOGUE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    if (this.#declared || !this.#core || typeof this.#core.declareTable !== "function") return;
    const answer = this.#core.declareTable("ai-catalogue", AI_CATALOGUE_DECLARATIONS);
    if (answer && answer.ok === false && answer.reason !== "TABLE_DECLARED")
      throw new Error(`ai-catalogue: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
  }
  #declared = false;

  /** R47: everything held, re-read from the tables and re-verified: a payload whose text does not hash to its statement,
   *  or whose statement does not verify, or an advisory that does not, is not read. */
  async start() {
    this.#held.clear();
    const bySeq = new Map();
    for (const r of this.#rows(`SELECT * FROM ai_catalogue_payloads ORDER BY seq, part`)) {
      if (!bySeq.has(r.seq)) bySeq.set(r.seq, []);
      bySeq.get(r.seq).push(r);
    }
    for (const [seq, rows] of bySeq) {
      const first = rows[0];
      if (rows.length !== first.parts || rows.some((r, i) => r.part !== i)) continue;
      const statement = { seq, schema_version: first.schema_version, issued_at: first.issued_at, sha256: first.sha256, bytes: first.bytes };
      const text = rows.map((r) => r.body).join("");
      const bytes = te.encode(text);
      if (bytes.length !== statement.bytes || sha256Of(bytes) !== statement.sha256) continue;
      const v = await verifyAiCatalogue(statement, first.armored, 0, this.#keys);
      if (!v.ok) continue;
      const doc = this.#parse(text, statement);
      if (!doc.ok) continue;
      const readable = this.#supported.includes(statement.schema_version);
      if (readable && !validatePayload(doc.payload, { supported: this.#supported }).ok) continue;
      this.#held.set(seq, { statement, armored: first.armored, source: first.source, received_at: first.received_at,
        text, payload: doc.payload, readable });
    }
    this.#advisories = [];
    for (const r of this.#rows(`SELECT * FROM ai_catalogue_advisories ORDER BY seq`)) {
      const ad = { seq: r.seq, target: { [r.target_kind]: r.target_id }, kind: r.kind, reason: r.reason,
        effective_at: r.effective_at, issued_at: r.issued_at };
      const v = await verifyAiAdvisory(ad, r.armored, 0, this.#keys);
      if (v.ok) this.#advisories.push(this.#advisoryRow(ad, r.armored, r.received_at));
    }
    this.#rollbacks = this.#rows(`SELECT act, from_seq, to_seq, by, reason, at FROM ai_catalogue_rollbacks ORDER BY n`);
    this.#checks = this.#rows(`SELECT at, trigger, kind, outcome, seq FROM ai_catalogue_checks ORDER BY n`);
    this.#view = null;
    this.seedAtStart = await this.#loadReleaseSeed();
    return true;
  }

  #advisoryRow(ad, armored, received_at) {
    const [k] = Object.keys(ad.target);
    return Object.freeze({ ...ad, target: Object.freeze({ ...ad.target }), key: `${k === "entry_id" ? "entry" : "plan"}:${ad.target[k]}`,
      armored, received_at });
  }

  /* A payload's text as a document whose own seq, schema and issue instant are its statement's. */
  #parse(text, statement) {
    let payload;
    try { payload = JSON.parse(text); } catch { return { ok: false, path: "payload" }; }
    if (!isObj(payload)) return { ok: false, path: "payload" };
    for (const k of ["seq", "schema_version", "issued_at"]) if (payload[k] !== statement[k]) return { ok: false, path: k };
    return { ok: true, payload };
  }

  /* ---------------------------------------------------------------- the applied fold */

  /* R41: the hold the rollback rows leave: `{to_seq, held_back_seq}` or null. */
  #hold() {
    let hold = null;
    for (const r of this.#rollbacks) {
      if (r.act === "rollback") hold = { to_seq: r.to_seq, held_back_seq: Math.max(hold ? hold.held_back_seq : 0, r.from_seq) };
      else hold = null;
    }
    return hold;
  }

  /* The current payload's seq: the highest readable held one, unless a rollback holds back those at or below its mark. */
  #currentSeq() {
    const ok = [...this.#held.values()].filter((h) => h.readable).map((h) => h.statement.seq).sort((a, b) => a - b);
    if (!ok.length) return null;
    const hold = this.#hold();
    if (hold) {
      const higher = ok.filter((s) => s > hold.held_back_seq);
      if (higher.length) return higher[higher.length - 1];
      const lower = ok.filter((s) => s <= hold.to_seq);
      return lower.length ? lower[lower.length - 1] : null;
    }
    return ok[ok.length - 1];
  }

  /* R25, R27: the fold of the applied payloads up to the current one, in seq order. Each entry and plan keeps the record
     and seq of the last payload that named it; one a later payload leaves out keeps that record, flagged with the seq of
     the first payload without it. Providers, profiles, guidance and warnings are carried the same way, by id. */
  #fold() {
    if (this.#view) return this.#view;
    const current = this.#currentSeq();
    const view = { current, payload: null, entries: new Map(), plans: new Map(), providers: new Map(), profiles: new Map(),
      guidance: new Map(), warnings: new Map(), applied: [] };
    if (current !== null) {
      const hold = this.#hold();
      const seqs = [...this.#held.values()].filter((h) => h.readable && h.statement.seq <= current
        && !(hold && h.statement.seq > hold.to_seq && h.statement.seq <= hold.held_back_seq && h.statement.seq !== current))
        .map((h) => h.statement.seq).sort((a, b) => a - b);
      for (const seq of seqs) {
        const p = this.#held.get(seq).payload;
        view.applied.push(seq);
        const carry = (map, list, idKey) => {
          const named = new Set();
          for (const rec of list) { map.set(rec[idKey], { rec, seq, omitted_since: null }); named.add(rec[idKey]); }
          for (const [id, held] of map) if (!named.has(id) && held.omitted_since === null) held.omitted_since = seq;
        };
        carry(view.entries, p.entries, "entry_id");
        carry(view.plans, p.plans, "plan_id");
        for (const x of p.providers) view.providers.set(x.id, x);
        for (const x of p.profiles) view.profiles.set(x.id, x);
        for (const x of p.guidance) view.guidance.set(x.guidance_id, x);
        for (const x of p.warnings) view.warnings.set(x.warning_id, x);
      }
      view.payload = this.#held.get(current).payload;
    }
    this.#view = view;
    return view;
  }

  #advisoriesFor(key) { return this.#advisories.filter((a) => a.key === key); }
  #stateOf(kind, id, held, at) {
    const s = effectiveState(held ? { seq: held.seq, state: held.rec.lifecycle } : null, this.#advisoriesFor(`${kind}:${id}`), at);
    return s ? s.state : null;
  }

  /* R38 */
  #needsRelease(e) {
    const profiles = this.#adapters.get(e.adapter_type);
    const v = profiles ? profiles[e.profile.id] : undefined;
    return !(Number.isSafeInteger(v) && v >= e.profile.min_version);
  }

  /* ---------------------------------------------------------------- writers */

  /** R38: what the copy's adapters can serve, `[{type, profiles: {id: version}}]`, held in memory, called at start by the
   *  module that owns the adapters. */
  registerAdapterTypes(list) {
    if (!Array.isArray(list)) throw new TypeError("ai-catalogue: registerAdapterTypes takes a list");
    for (const t of list) {
      if (!isObj(t) || typeof t.type !== "string" || !TOKEN_RE.test(t.type) || !isObj(t.profiles)
          || !Object.values(t.profiles).every((v) => Number.isSafeInteger(v) && v >= 1))
        throw new TypeError("ai-catalogue: an adapter type is {type, profiles: {id: version}}");
      this.#adapters.set(t.type, { ...(this.#adapters.get(t.type) || {}), ...t.profiles });
    }
    return out({ ok: true, types: [...this.#adapters.keys()].sort() });
  }

  /* R35, R36, R37, R39: a payload accepted only when, in this order, its bytes are the statement's, the statement
     verifies, its seq is newer than every held one, its schema is read and its document is valid; a payload of a schema
     this release cannot read is held verified and unapplied. Acceptance is atomic. */
  async #acceptPayload(statement, armored, body, source, at) {
    const bytes = toBytes(body);
    /* DEC-49 REGION is-digest-indexed */
    if (!bytes || !isObj(statement) || bytes.length !== statement.bytes || sha256Of(bytes) !== statement.sha256)
      return refusal("DIGEST_MISMATCH", { seq: isObj(statement) ? statement.seq ?? null : null });
    /* END DEC-49 REGION is-digest-indexed */
    const same = this.#held.get(statement.seq);
    if (same && same.statement.sha256 === statement.sha256) return { ok: true, outcome: "none", seq: statement.seq };
    const heldSeq = Math.max(0, ...this.#held.keys());
    const v = await verifyAiCatalogue(statement, armored, heldSeq, this.#keys);
    if (!v.ok) {
      /* DEC-49 REGION is-seq-newer */
      if (v.reason === "NOT_NEWER") return refusal("NOT_NEWER", { seq: v.seq, heldSeq: v.heldSeq });
      /* END DEC-49 REGION is-seq-newer */
      return Object.freeze({ ok: false, code: v.reason, reason: v.reason, ...(v.field ? { field: v.field } : {}) });
    }
    let text;
    try { text = td.decode(bytes); } catch { return refusal("CATALOGUE_PAYLOAD_INVALID", { path: "payload" }); }
    const doc = this.#parse(text, statement);
    if (!doc.ok) return refusal("CATALOGUE_PAYLOAD_INVALID", { path: doc.path });
    const readable = this.#supported.includes(statement.schema_version);
    if (readable) {
      const valid = validatePayload(doc.payload, { supported: this.#supported });
      if (!valid.ok) return valid;
      const move = this.#movesOf(doc.payload, at);
      if (move) return move;
    }
    const held = { statement: v.statement, armored, source, received_at: at, text, payload: doc.payload, readable };
    this.#transact(() => {
      const parts = Math.max(1, Math.ceil(text.length / CHUNK));
      for (let i = 0; i < parts; i++)
        this.#sql.exec(`INSERT INTO ai_catalogue_payloads (seq, part, parts, schema_version, issued_at, sha256, bytes, armored,
          source, received_at, body) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, statement.seq, i, parts, statement.schema_version,
          statement.issued_at, statement.sha256, statement.bytes, armored, source, at, text.slice(i * CHUNK, (i + 1) * CHUNK));
      this.#held.set(statement.seq, held);
      this.#view = null;
      if (readable) this.#prune();
    });
    this.#view = null;
    return { ok: true, outcome: "found", seq: statement.seq, applied: readable && this.#currentSeq() === statement.seq,
      held_unread: !readable };
  }

  /* R24, R25: every entry and plan a payload names in a state other than its effective one moves there legally. */
  #movesOf(payload, at) {
    const view = this.#fold();
    const judge = (kind, list, idKey, map, base) => {
      for (let i = 0; i < list.length; i++) {
        const rec = list[i], held = map.get(rec[idKey]);
        const from = this.#stateOf(kind, rec[idKey], held, at);
        if (from !== null && !legalMove(from, rec.lifecycle))
          return badMove({ path: `${base}[${i}].lifecycle`, from, to: rec.lifecycle, target: { [idKey]: rec[idKey] } });
      }
      return null;
    };
    return judge("entry", payload.entries, "entry_id", view.entries, "entries")
      || judge("plan", payload.plans, "plan_id", view.plans, "plans");
  }

  /* R42: the last HELD_VERSIONS verified payloads are kept, with the current one, the one rolled back from, and each
     that holds the last record of an entry or plan a later payload left out; older ones are dropped. */
  #prune() {
    const seqs = [...this.#held.keys()].sort((a, b) => b - a);
    const keep = new Set(seqs.slice(0, HELD_VERSIONS));
    const view = this.#fold();
    if (view.current !== null) keep.add(view.current);
    const hold = this.#hold();
    if (hold) keep.add(hold.held_back_seq);
    for (const m of [view.entries, view.plans]) for (const h of m.values()) if (h.omitted_since !== null) keep.add(h.seq);
    for (const seq of seqs) if (!keep.has(seq)) {
      this.#sql.exec(`DELETE FROM ai_catalogue_payloads WHERE seq=?`, seq);
      this.#held.delete(seq);
    }
    this.#view = null;
  }

  /* R26: a verified advisory, its kind and reason from the closed lists, its move legal where its target is held; one
     whose target is not yet held is kept and applies if the target arrives. */
  async #acceptAdvisory(ad, at) {
    if (!isObj(ad)) return Object.freeze({ ok: false, code: "MALFORMED", reason: "MALFORMED", field: "advisory" });
    const { armored, ...fields } = ad;
    if (this.#advisories.some((a) => a.seq === fields.seq)) return { ok: true, outcome: "none", seq: fields.seq };
    const v = await verifyAiAdvisory(fields, armored, 0, this.#keys);
    if (!v.ok) return Object.freeze({ ok: false, code: v.reason, reason: v.reason, seq: fields.seq ?? null, ...(v.field ? { field: v.field } : {}) });
    const st = v.statement;
    /* DEC-49 REGION is-advisory-reason */
    if (!ADVISORY_REASONS.includes(st.reason)) return refusal("ADVISORY_REASON_UNKNOWN", { seq: st.seq, reason_given: st.reason });
    /* END DEC-49 REGION is-advisory-reason */
    const to = ADVISORY_KINDS[st.kind];
    if (!to) return badMove({ seq: st.seq, kind: st.kind });
    const [k] = Object.keys(st.target);
    const kind = k === "entry_id" ? "entry" : "plan";
    const view = this.#fold();
    const held = (kind === "entry" ? view.entries : view.plans).get(st.target[k]);
    const from = this.#stateOf(kind, st.target[k], held, st.effective_at > at ? st.effective_at : at);
    if (from !== null && held && st.seq > held.seq && !legalMove(from, to)) return badMove({ seq: st.seq, from, to, target: st.target });
    this.#transact(() => {
      this.#sql.exec(`INSERT INTO ai_catalogue_advisories (seq, target_kind, target_id, kind, reason, effective_at, issued_at,
        armored, received_at) VALUES (?,?,?,?,?,?,?,?,?)`, st.seq, k, st.target[k], st.kind, st.reason, st.effective_at,
        st.issued_at, armored, at);
    });
    this.#advisories = [...this.#advisories, this.#advisoryRow(st, armored, at)].sort((a, b) => a.seq - b.seq);
    this.#view = null;
    return { ok: true, outcome: "found", seq: st.seq, upcoming: st.effective_at > at };
  }

  #record(at, trigger, kind, outcome, seq = null) {
    this.#sql.exec(`INSERT INTO ai_catalogue_checks (at, trigger, kind, outcome, seq) VALUES (?,?,?,?,?)`, at, trigger, kind, outcome, seq);
    this.#checks.push({ at, trigger, kind, outcome, seq });
  }

  /** R39: the release's seed payload, verified as a pulled one is (`statement` the fields R51 binds, `armored` its
   *  signature, `body` its bytes) and held as `source: "seed"`; one older than a held payload is `NOT_NEWER`. */
  async loadSeed({ statement, armored, body, at } = {}) {
    const r = await this.#acceptPayload(statement, armored, body, "seed", this.#now(at));
    return out(r);
  }

  /* R39: the release's seed, loaded at every start and verified as a pulled payload is. Its signature is the
     deployment's variable (a development deploy's) or the one the release carries (Bob's); with neither, nothing is
     loaded and the copy offers nothing until a payload is pulled. A seed already held answers `none` and writes nothing;
     one older than a held payload answers `NOT_NEWER`; a bad signature is refused and changes nothing. */
  async #loadReleaseSeed() {
    const seed = this.#seed;
    if (!isObj(seed) || !isObj(seed.statement) || typeof seed.body !== "string") return null;
    const fromEnv = this.#env[SEED_SIGNATURE_VAR];
    const armored = typeof fromEnv === "string" && fromEnv.trim() ? fromEnv : seed.armored;
    if (typeof armored !== "string" || !armored.trim()) return null;
    try {
      const r = await this.#acceptPayload(seed.statement, armored, seed.body, "seed", this.#now());
      /* F3: the development seed, verified and held, brings the adapter types its own entries need (R38), in memory */
      if (r.ok && seed === DEVELOPMENT_SEED && String(this.#env[DEVELOPMENT_VAR] ?? "") === "1")
        for (const t of DEVELOPMENT_ADAPTERS) {
          const had = this.#adapters.get(t.type) || {};
          this.registerAdapterTypes([{ type: t.type, profiles: Object.fromEntries(Object.entries(t.profiles)
            .filter(([id]) => !(id in had))) }]);
        }
      return out(r.ok ? { ok: true, outcome: r.outcome, seq: r.seq } : { ok: false, code: r.code });
    } catch { return out({ ok: false, code: "CATALOGUE_PAYLOAD_INVALID" }); }
  }

  /** R35: the only way a pulled byte becomes state. `kind` is `index` or `payload`; `status` the HTTP status; `body` the
   *  bytes read; `trigger` `schedule` or `manual`. The index's advisories are each verified and applied; its payload is
   *  asked for (`fetch`) only when its seq is above every held one; a payload is judged against the index's line for it.
   *  Each call appends one check, `{at, trigger, outcome}`. */
  async receive({ kind, status, body, at, trigger } = {}) {
    const when = this.#now(at);
    const how = CHECK_TRIGGERS.includes(trigger) ? trigger : "manual";
    const what = kind === "payload" ? "payload" : "index";
    if (status !== 200) { this.#record(when, how, what, "unreachable"); return out({ ok: false, outcome: "unreachable" }); }
    if (what === "index") {
      const index = this.#indexOf(body);
      if (!index) {
        this.#record(when, how, what, "CATALOGUE_PAYLOAD_INVALID");
        return out(refusal("CATALOGUE_PAYLOAD_INVALID", { path: "index", outcome: "CATALOGUE_PAYLOAD_INVALID" }));
      }
      const advisories = [];
      for (const ad of index.advisories) {
        const r = await this.#acceptAdvisory(ad, when);
        advisories.push({ seq: isObj(ad) ? ad.seq ?? null : null, outcome: r.ok ? r.outcome : r.code,
          ...(!r.ok && r.check ? { check: r.check, word: r.word } : {}) });
      }
      const cat = index.catalogue;
      const newer = cat.seq > Math.max(0, ...this.#held.keys());
      if (newer) this.#pending = cat;
      const outcome = newer || advisories.some((a) => a.outcome === "found") ? "found" : "none";
      this.#record(when, how, what, outcome, cat.seq);
      return out({ ok: true, outcome, advisories, fetch: newer ? pullRequest("payload", cat.path) : null });
    }
    const line = this.#pending;
    const r = line
      ? await this.#acceptPayload({ seq: line.seq, schema_version: line.schema_version, issued_at: line.issued_at,
        sha256: line.sha256, bytes: line.bytes }, line.armored, body, "pulled", when)
      : refusal("DIGEST_MISMATCH", { seq: null });
    if (r.ok) this.#pending = null;
    const outcome = r.ok ? r.outcome : r.code;
    this.#record(when, how, what, outcome, line ? line.seq : null);
    return out({ ...r, outcome });
  }

  /* R35: the index's shape; null when it is not one. */
  #indexOf(body) {
    const bytes = toBytes(body);
    if (!bytes || bytes.length > INDEX_MAX_BYTES) return null;
    let x;
    try { x = JSON.parse(td.decode(bytes)); } catch { return null; }
    if (!isObj(x) || !Number.isSafeInteger(x.index_version) || !isObj(x.catalogue) || !Array.isArray(x.advisories)) return null;
    const c = x.catalogue;
    if (!Number.isSafeInteger(c.seq) || c.seq < 1 || typeof c.path !== "string" || !pullRequest("payload", c.path).ok
        || typeof c.armored !== "string") return null;
    return x;
  }

  /** R41: a held, verified earlier payload made current; those at or below the seq rolled back from stay held, unapplied,
   *  until `unrollback` or a higher payload. Who may is the caller's. */
  rollback({ to_seq, by, reason, at } = {}) {
    const view = this.#fold();
    const target = this.#held.get(to_seq);
    /* DEC-49 REGION is-rollback-held */
    if (!target || !target.readable || view.current === null || !(to_seq < view.current)
        || typeof by !== "string" || !by || typeof reason !== "string" || !reason)
      return refusal("CATALOGUE_ROLLBACK_UNKNOWN", { to_seq: Number.isSafeInteger(to_seq) ? to_seq : null });
    /* END DEC-49 REGION is-rollback-held */
    const when = this.#now(at);
    const row = { act: "rollback", from_seq: view.current, to_seq, by, reason, at: when };
    this.#transact(() => this.#sql.exec(`INSERT INTO ai_catalogue_rollbacks (act, from_seq, to_seq, by, reason, at) VALUES (?,?,?,?,?,?)`,
      row.act, row.from_seq, row.to_seq, by, reason, when));
    this.#rollbacks.push(row);
    this.#view = null;
    return out({ ok: true, from_seq: row.from_seq, to_seq, held_back_seq: this.#hold().held_back_seq, by, reason, at: when });
  }

  /** R41: the hold cleared; the highest held payload applies. */
  unrollback({ by, at } = {}) {
    const when = this.#now(at);
    const had = this.#hold();
    if (!had) return out({ ok: true, cleared: false });
    if (typeof by !== "string" || !by) return refusal("CATALOGUE_ROLLBACK_UNKNOWN", { to_seq: null });
    this.#transact(() => this.#sql.exec(`INSERT INTO ai_catalogue_rollbacks (act, from_seq, to_seq, by, reason, at) VALUES (?,?,?,?,?,?)`,
      "unrollback", null, null, by, null, when));
    this.#rollbacks.push({ act: "unrollback", from_seq: null, to_seq: null, by, reason: null, at: when });
    this.#view = null;
    return out({ ok: true, cleared: true, current: this.#currentSeq() });
  }

  /* ---------------------------------------------------------------- reads */

  #unavailable() {
    /* DEC-49 REGION is-catalogue-held */
    return refusal("CATALOGUE_UNAVAILABLE");
    /* END DEC-49 REGION is-catalogue-held */
  }

  /* A part and the checks in force, judged against the current payload. */
  #question(part, checksInForce) {
    const view = this.#fold();
    if (!view.payload) return this.#unavailable();
    /* DEC-49 REGION is-part-known */
    if (typeof part !== "string" || !view.payload.parts.includes(part)) return refusal("PART_UNKNOWN", { part: typeof part === "string" ? part : null });
    /* END DEC-49 REGION is-part-known */
    const list = checksInForce === undefined ? [] : checksInForce;
    /* DEC-49 REGION is-check-known */
    if (!Array.isArray(list)) return refusal("CHECK_UNKNOWN", { check_id: null });
    for (const c of list) if (!CHECK_IDS.includes(c)) return refusal("CHECK_UNKNOWN", { check_id: typeof c === "string" ? c : null });
    /* END DEC-49 REGION is-check-known */
    return { ok: true, view, checks: CHECK_IDS.filter((c) => list.includes(c)) };
  }

  /* R29: a plan's row. */
  #planRow(held, view, at) {
    const p = held.rec;
    const state = this.#stateOf("plan", p.plan_id, held, at);
    const day = dayOf(at);
    const scope = isOpen(p.scope) ? "unconfirmed" : p.scope.value;
    const unconfirmed = scope === "unconfirmed";
    const reasons = [];
    const g = view.guidance.get(p.guidance_id);
    if (!g || g.plan_id !== p.plan_id) reasons.push("PLAN_NO_GUIDANCE");
    if (state === "lapsed") reasons.push("PLAN_LAPSED");
    if (state === "retired") reasons.push("PLAN_RETIRED");
    if (isOpen(p.means_allowed)) reasons.push("PLAN_NO_MEANS");
    const terms = p.binding_terms;
    const pending = terms.filter((t) => t.effective_from > day)
      .map((t) => ({ doc: t.doc, version: t.version, effective_from: t.effective_from, days_until: daysBetween(day, t.effective_from) }))
      .sort((a, b) => (a.effective_from < b.effective_from ? -1 : a.effective_from > b.effective_from ? 1 : 0));
    const needs = terms.some((t) => t.effective_from <= day && p.confirmed_at < t.effective_from);
    const w = p.warning_id !== undefined ? view.warnings.get(p.warning_id) : undefined;
    return {
      plan_id: p.plan_id, provider: p.provider, kind: p.kind, scope, levels: unconfirmed ? ["member", "project", "group"] : LEVELS[scope],
      unconfirmed, credential_kind: p.credential_kind, connection_ways: p.connection_ways,
      constraints: { runtimes: valueOf(p.runtimes), token_storage: valueOf(p.token_storage),
        enforce: p.kind === "subscription" && scope === "member" ? "level_rule_only" : "deployment" },
      terms_pending: pending, needs_reconfirmation: needs,
      terms_version: sha256Of(te.encode(canonicalJson({ restrictions: p.restrictions, binding_terms: p.binding_terms }))),
      warning_version: w ? sha256Of(te.encode(canonicalJson(w.text))) : null,
      free_tier_unconfirmed: isOpen(p.free_tier_trains),
      means_allowed: valueOf(p.means_allowed), money: valueOf(p.money), token_bounds: p.token_bounds ?? null,
      free_tier_trains: valueOf(p.free_tier_trains), guidance_id: p.guidance_id, warning_id: p.warning_id ?? null,
      binding_terms: p.binding_terms, restrictions: p.restrictions, price_basis: p.price_basis,
      state, omitted_since: held.omitted_since, offered: reasons.length === 0, reasons,
    };
  }

  /* R30, R31: every condition an entry fails for a part under the checks in force, in R31's fixed order. */
  #judge(held, view, part, checks, at) {
    const e = held.rec;
    const reasons = [];
    const state = this.#stateOf("entry", e.entry_id, held, at);
    if (state === "lapsed") reasons.push({ code: "ENTRY_LAPSED" });
    if (state === "retired") reasons.push({ code: "ENTRY_RETIRED" });
    if (this.#needsRelease(e)) reasons.push({ code: "NEEDS_NEWER_RELEASE" });
    const g = e.gate[part];
    const verdict = g ? g.verdict : "not_yet_rated";
    if (verdict === "not_suitable") reasons.push({ code: "PART_NOT_PASSED", verdict });
    if (verdict === "not_yet_rated") reasons.push({ code: "PART_NOT_RATED" });
    for (const c of checks) {
      const a = answerOf(e.checks[c]);
      if (a === "not_met") reasons.push({ code: "CHECK_NOT_MET", check: c });
      else if (a !== "met") reasons.push({ code: "CHECK_OPEN", check: c });
    }
    const plans = e.plan_ids.map((id) => view.plans.get(id)).filter(Boolean).map((h) => this.#planRow(h, view, at));
    const offered = plans.filter((p) => p.offered).map((p) => p.plan_id);
    if (!offered.length) reasons.push({ code: "NO_PLAN_OFFERED", plans: plans.map((p) => ({ plan_id: p.plan_id, reasons: p.reasons })) });
    return { reasons, state, verdict, g, offered };
  }

  #entryRow(held, view, at) {
    const e = held.rec;
    const state = this.#stateOf("entry", e.entry_id, held, at);
    const review = dayOf(at) > addDays(e.confirmed_at, view.payload.policy.review_period_days);
    return { ...structuredClone(e), state, watch: state === "watch", recipient: { provider: e.provider, host: e.host },
      needs_newer_release: this.#needsRelease(e), omitted_since: held.omitted_since, review_overdue: review };
  }

  /** R28: the entry whole, with its effective state, recipient, release need, omission and review flags; null for an
   *  id not held (a tested AI's id included, R54). */
  entryOf(entry_id, opts) {
    try {
      const { at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      const held = view.payload ? view.entries.get(entry_id) : undefined;
      return held ? out(this.#entryRow(held, view, this.#now(at))) : null;
    } catch { return null; }
  }

  /** R30: THE CLOSED LIST: the entries offered for a part under the checks in force. */
  entriesFor(opts) {
    try {
      const { part, checksInForce = [], at } = isObj(opts) ? opts : {};
      const q = this.#question(part, checksInForce);
      if (!q.ok) return q;
      const when = this.#now(at);
      const rows = [];
      for (const held of q.view.entries.values()) {
        const j = this.#judge(held, q.view, part, q.checks, when);
        if (j.reasons.length) continue;
        const e = held.rec;
        rows.push({ entry_id: e.entry_id, display_name: e.display_name, provider: e.provider, host: e.host,
          recipient: { provider: e.provider, host: e.host }, state: j.state, watch: j.state === "watch",
          part: { verdict: j.verdict, limits: j.g.limits, grade: j.g.ev.grade }, plans: j.offered,
          checks: Object.fromEntries(q.checks.map((c) => [c, answerOf(e.checks[c])])) });
      }
      rows.sort(byProviderThenId("entry_id"));
      return out({ ok: true, entries: rows });
    } catch { return this.#unavailable(); }
  }

  /** R31: `{offered, reasons}` by R30's predicate, every failing condition named in a fixed order. */
  whyNotOffered(opts) {
    try {
      const { entry_id, part, checksInForce = [], at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      if (!view.payload) return out({ ok: true, offered: false, reasons: [{ code: "ENTRY_UNKNOWN" }, { code: "CATALOGUE_UNAVAILABLE" }] });
      const q = this.#question(part, checksInForce);
      if (!q.ok) return q;
      const held = view.entries.get(entry_id);
      if (!held) return out({ ok: true, offered: false, reasons: [{ code: "ENTRY_UNKNOWN" }] });
      const j = this.#judge(held, view, part, q.checks, this.#now(at));
      return out({ ok: true, offered: j.reasons.length === 0, reasons: j.reasons });
    } catch { return this.#unavailable(); }
  }

  /** R29: the plans under each provider, each with its row; filtered by provider, by an entry's plans, or one plan. */
  plansOf(opts) {
    try {
      const { provider, entry_id, plan_id, at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      if (!view.payload) return out([]);
      const when = this.#now(at);
      let plans = [...view.plans.values()];
      if (entry_id !== undefined) {
        const e = view.entries.get(entry_id);
        plans = e ? plans.filter((h) => e.rec.plan_ids.includes(h.rec.plan_id)) : [];
      }
      if (plan_id !== undefined) plans = plans.filter((h) => h.rec.plan_id === plan_id);
      if (provider !== undefined) plans = plans.filter((h) => h.rec.provider === provider);
      const groups = new Map();
      for (const h of plans) {
        if (!groups.has(h.rec.provider)) groups.set(h.rec.provider, []);
        groups.get(h.rec.provider).push(this.#planRow(h, view, when));
      }
      return out([...groups.keys()].sort().map((p) => ({ provider: p,
        plans: groups.get(p).sort((a, b) => (a.plan_id < b.plan_id ? -1 : 1)) })));
    } catch { return out([]); }
  }

  /** R53: a host profile, or null. */
  profileOf(id) {
    try { const p = this.#fold().profiles.get(id); return p ? out(p) : null; } catch { return null; }
  }

  /** R54: a tested AI that is not an entry, or null. */
  testedOf(subject_id) {
    try {
      const p = this.#fold().payload;
      const t = p ? p.tested.find((x) => x.subject_id === subject_id) : undefined;
      return t ? out(t) : null;
    } catch { return null; }
  }

  #onList(view, subject_id, at) {
    const held = view.entries.get(subject_id);
    return held ? this.#stateOf("entry", subject_id, held, at) : "not_listed";
  }

  /** R45: the active library rows (tested less than RESULT_ACTIVE_MONTHS before `at`), each with its age, its subject's
   *  place on the list, and whether it is confirmed. */
  libraryRows(opts) {
    try {
      const { subject_id, part, at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      if (!view.payload) return out([]);
      const when = this.#now(at), day = dayOf(when), cutoff = monthsBefore(day, RESULT_ACTIVE_MONTHS);
      const rows = view.payload.library
        .filter((r) => r.tested_at > cutoff && r.tested_at <= day)
        .filter((r) => subject_id === undefined || r.subject_id === subject_id)
        .filter((r) => part === undefined || Object.hasOwn(r.parts, part))
        .map((r) => ({ ...r, age_days: daysBetween(r.tested_at, day), on_list: this.#onList(view, r.subject_id, when),
          confirmed: r.grade === "REPRODUCED" || r.repeated_by_civicsmith === true }))
        .sort((a, b) => (a.subject_id < b.subject_id ? -1 : a.subject_id > b.subject_id ? 1 : a.row_id < b.row_id ? -1 : 1));
      return out(rows);
    } catch { return out([]); }
  }

  /** R55: the combined record per subject and part, Civicsmith's, with its age; this module computes nothing. */
  combinedResults(opts) {
    try {
      const { subject_id, part, at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      if (!view.payload) return out([]);
      const day = dayOf(this.#now(at));
      return out(view.payload.combined
        .filter((c) => (subject_id === undefined || c.subject_id === subject_id) && (part === undefined || c.part === part))
        .map((c) => ({ ...c, age_days: daysBetween(c.as_of, day) }))
        .sort((a, b) => (a.subject_id < b.subject_id ? -1 : a.subject_id > b.subject_id ? 1 : a.part < b.part ? -1 : 1)));
    } catch { return out([]); }
  }

  /** R32: the catalogue's state and what it is serving. */
  catalogueState(opts) {
    try {
      const { at } = isObj(opts) ? opts : {};
      const view = this.#fold();
      const when = this.#now(at), day = dayOf(when);
      const cur = view.current === null ? null : this.#held.get(view.current);
      const hold = this.#hold();
      const unread = [...this.#held.values()].some((h) => !h.readable && (view.current === null || h.statement.seq > view.current));
      const good = this.#checks.filter((c) => c.outcome === "found" || c.outcome === "none");
      const ref = good.length ? good[good.length - 1].at : cur ? cur.received_at : null;
      const staleAfter = cur ? cur.payload.policy.stale_after_days : null;
      const state = !cur ? "unavailable" : unread ? "needs_newer_release"
        : ref && daysBetween(dayOf(ref), day) > staleAfter ? "stale" : "current";
      const last = this.#checks.length ? this.#checks[this.#checks.length - 1] : null;
      const upcoming = this.#advisories.filter((a) => a.effective_at > when)
        .map((a) => ({ seq: a.seq, target: a.target, kind: a.kind, reason: a.reason, effective_at: a.effective_at }));
      const entries = cur ? [...view.entries.values()] : [];
      return out({
        state, word: STATE_WORDS[state], seq: cur ? view.current : null, schema_version: cur ? cur.statement.schema_version : null,
        issued_at: cur ? cur.statement.issued_at : null, source: cur ? cur.source : null,
        last_check: last ? { at: last.at, trigger: last.trigger, outcome: last.outcome } : null,
        last_good_seq: cur ? view.current : null, age_days: cur ? daysBetween(dayOf(cur.statement.issued_at), day) : null,
        rolled_back: !!(hold && view.current !== null && view.current <= hold.held_back_seq),
        held_back_seq: hold ? hold.held_back_seq : null,
        advisories_seq: this.#advisories.length ? this.#advisories[this.#advisories.length - 1].seq : null,
        upcoming, entries: { total: entries.length, needing_release: entries.filter((h) => this.#needsRelease(h.rec)).length },
      });
    } catch { return out({ state: "unavailable", word: STATE_WORDS.unavailable }); }
  }

  /** The checks this copy has recorded (R35), oldest first. */
  checks() { return out(this.#checks.map((c) => ({ at: c.at, trigger: c.trigger, outcome: c.outcome }))); }
}

/* K61: the one AiCatalogue of a Durable Object's storage, made on first use over its `sql`, reaching record-core by
   `recordOf(ctx)`, migrated and started once (`ready`). The options are read on the first call only. */
const OF = new WeakMap();
export function aiCatalogueOf(ctx, { record = null, env = {}, clock = null, keys, supported, seed } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let c = OF.get(storage);
  if (!c) {
    c = new AiCatalogue({ sql: storage.sql, core: record ?? recordOf(ctx), env, clock,
      ...(keys ? { keys } : {}), ...(supported ? { supported } : {}), ...(seed !== undefined ? { seed } : {}) });
    OF.set(storage, c);
    c.migrate();
    c.ready = c.start();
  }
  return c;
}

/* isInstant, isDate: re-exported for the issuer's own checks of what it signs. */
export { isInstant, isDate };
