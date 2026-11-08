/* acquisition's test fixture. The act is reached as `acquire(store, body, opts)` with the capture store its caller hands
   in (acquisition's Provides: capture's instance). This module is earlier in the order than `capture` and its tests import
   none of it, so the store handed in here is a stand-in that behaves as capture's Provides state each service acquisition
   reaches (R8 outcomes and reachability, R15 enqueue, R22 sessions, R23 ceiling, R24–R25 site assets, R27 links, R39–R40
   render allowance, R55 measurement, R61 validators, R69 actor), recording every call so a test reads what the act handed
   in. Beside it: record-core's real instance over a node:sqlite stand-in for Durable Object storage (settings and the
   evidence store), an evidence bucket, attestation's real instance over the same storage (R20's `attest`, R3's
   `signReceipt`, handed in as `cap.attestation`, K1224), and stand-ins for host-governor and provenance as their
   Provides state them. */
import { DatabaseSync } from "node:sqlite";
import { createHash, generateKeyPairSync } from "node:crypto";
import { RECORD_SCHEMA, recordOf } from "../../../src/record-core/index.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { acquire, archiveLookup, acquisitionOf } from "../../../src/acquisition/index.mjs";
import { acceptDatetime } from "../../../src/capture-sources/memento.mjs";
import { PROVENANCE_SCHEMA } from "../../../src/provenance/schema.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { registeredHomes } from "../provenance/fixtures.mjs";

export const sha = (b) => createHash("sha256").update(typeof b === "string" ? Buffer.from(b) : Buffer.from(b)).digest("hex");
export const H = (hex) => hex.padEnd(64, "0").slice(0, 64);
export const stamp = (ms = Date.now()) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

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
  return s;
}

/* An evidence bucket stand-in (the R2 binding's shape), recording every call. As R2 does, an object put with a `sha256` is
   reported by `head` and `get` with the checksum it was verified by (`checksums.sha256`, bytes), unless a test sets
   `checksums = false` to stand for a store that gives none. */
export function bucket() {
  const held = new Map(), sums = new Map(), calls = [];
  const obj = (k, b) => { const sum = b.checksums !== false && sums.get(k); return { key: k, size: held.get(k).length, body: held.get(k),
    ...(sum && b.checksums !== false ? { checksums: { sha256: sum } } : {}),
    arrayBuffer: async () => held.get(k).buffer.slice(held.get(k).byteOffset, held.get(k).byteOffset + held.get(k).length) }; };
  return {
    calls, held, failPut: false, checksums: true,
    async head(k) { calls.push(["head", k]); if (!held.has(k)) return null; const o = obj(k, this); return { key: k, size: o.size, ...(o.checksums ? { checksums: o.checksums } : {}) }; },
    async get(k, o) { calls.push(o ? ["get", k, o] : ["get", k]); if (!held.has(k)) return null;
      const full = obj(k, this);
      if (o && o.range) { const part = held.get(k).slice(o.range.offset, o.range.offset + o.range.length); return { ...full, body: part, arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.length) }; }
      return full; },
    async put(k, bytes, opts) { calls.push(["put", k, opts]); if (this.failPut) throw new Error("bucket refused"); held.set(k, new Uint8Array(bytes));
      if (opts && typeof opts.sha256 === "string" && /^[0-9a-f]{64}$/.test(opts.sha256)) sums.set(k, Uint8Array.from(Buffer.from(opts.sha256, "hex")).buffer); else sums.delete(k);
      return { key: k }; },
    async delete(k) { calls.push(["delete", k]); held.delete(k); sums.delete(k); },
  };
}

/* host-governor's R1–R14 as the store reaches them, each call recorded; `refuse` names hosts to refuse and `held`
   hosts cooling off. */
export function governor({ refuse = [], held = [] } = {}) {
  const calls = [], granted = {};
  return {
    calls, granted, configured: [],
    /* R29: a `peek` answers as the admission would and writes nothing; any other admission that is granted books one grant */
    governorAdmit({ host, peek = false }) { calls.push([peek === true ? "peek" : "admit", host]);
      if (refuse.includes(host)) return { admitted: false, reason: "cooling_off", retry_in_ms: 5000 };
      if (peek !== true) granted[host] = (granted[host] || 0) + 1;
      return { admitted: true, wait_ms: 0, appetite_per_min: 12 }; },
    governorReport(r) { calls.push(["report", r.host, r.status, r.retry_after_ms]); return { recorded: true }; },
    governorConfig(c) { this.configured.push(c); return { configured: true, ...c }; },
    isHeld(host) { calls.push(["isHeld", host]); return held.includes(host); },
  };
}

/* provenance's R4–R7, R13, R24–R26 and R59 as the store reaches them (`registerHolds` is also what attestation's `attest`
   asks, R1). With `sql`, each receipt is also written to `captured_locators` (R48's read contract, which acquisition R39
   reads for an archive's document address). `homes` maps a capture to its home bundle (R4); `named` maps a capture to the
   parts its home's document names (R6). `captureGrade` answers as R24, R25, R26 and R59 state for the vias recorded. */
export function provenance({ registered = [], acquired = [], sql = null, homes = {}, named = {}, heldAt = {} } = {}) {
  const receipts = [], holds = [];
  /* `homeOf` and `registerHolds` are provenance's own (R4, R6) over provenance's own real world (its `registeredHomes` fixture): a home the
     test names in `homes` (or `registered`) is registered when the chain is next asked, by really promoting a bundle that carries a register
     document; a receipt is recorded with the real provenance too */
  let real = registeredHomes();
  let synced = new Map(), created = new Set(), alias = {};
  const sync = () => {
    const want = [...Object.entries(homes), ...registered.filter((r) => !homes[r]).map((r) => [r, null])];
    /* a capture named in `homes` again under another bundle starts the real world over, with the receipts recorded so far */
    if (want.some(([s, b]) => synced.has(s) && synced.get(s) !== b)) {
      real = registeredHomes(); synced = new Map(); created = new Set(); alias = {};
      for (const r of receipts) if (r.addressNorm && r.captureSha) real.provenance.recordReceipt(r);
    }
    const groups = new Map();
    for (const [s, bundleId] of want) {
      if (synced.has(s)) continue;
      const k = bundleId ?? `INFO-2026-${String(synced.size + groups.size + 1).padStart(4, "0")}-registered`;
      groups.set(k, [...(groups.get(k) ?? []), { sha: s, declared: bundleId }]);
    }
    for (const [bundleId, captures] of groups) {
      /* a bundle already promoted takes no more captures from this fixture: the later ones are promoted in a bundle of their own, named back below */
      const realId = created.has(bundleId) ? `${bundleId}~${created.size}` : bundleId;
      if (realId !== bundleId) alias[realId] = bundleId;
      created.add(realId);
      const r = real.many(realId, captures);
      if (r.ok !== true) throw new Error(`fixture provenance: ${bundleId}: ${JSON.stringify(r)}`);
      for (const c of captures) synced.set(c.sha, c.declared);
    }
  };
  const named_ = (h) => (h && alias[h.bundleId] ? { ...h, bundleId: alias[h.bundleId] } : h);
  const vias = (s) => [...new Set(receipts.filter((r) => r.captureSha === s).map((r) => r.via || "direct"))];
  const p = {
    receipts, holds, homes, named, heldAt,
    recordReceipt(r) {
      receipts.push(r);
      if (r.addressNorm && r.captureSha) real.provenance.recordReceipt(r);
      if (sql && r.addressNorm && r.captureSha)
        sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, via, retrieval_locator, first_retrieved, last_retrieved)
                  VALUES (?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET observations=observations+1, last_retrieved=excluded.last_retrieved`,
                 r.addressNorm, r.address ?? r.addressNorm, r.captureSha, r.via || "direct", r.retrievalLocator ?? null, r.retrieved, r.retrieved);
      return { recorded: true };
    },
    registerHolds(a) { holds.push(a.sha); sync(); return { ...real.provenance.registerHolds(a), ...(a.bundle ? { parts: named[a.sha] ? { state: "named", parts: named[a.sha] } : { state: "none" } } : {}) }; },
    /* R12: the bundle's captures with `held_at` (a test names it in `heldAt`, else the earliest receipt's instant) */
    capturesOf(bundleId) {
      return Object.keys(homes).filter((s) => homes[s] === bundleId).sort().map((s) => ({ capture_sha: s,
        held_at: heldAt[s] ?? receipts.filter((r) => r.captureSha === s).map((r) => r.retrieved).sort()[0] ?? null }));
    },
    homeOf(s) { sync(); return named_(real.provenance.homeOf(s)); },
    captureGrade(s, depth = 0) {
      const v = vias(s);
      if (v.includes("direct")) return { grade: EARNED_CAPTURE_CEILING, route: "direct", determined: true, basis: "measured" };
      /* F1 (BD-18): an archive replay is graded by provenance's own rule over the receipts recorded (a raw replay the
         archive letter, a rewritten one the reference-only letter), the provider's real answer, never a letter typed here */
      if (v.includes("archive.org")) return real.provenance.captureGrade(s);
      if (v.includes("unpacked")) {
        const r = receipts.find((x) => x.captureSha === s && x.via === "unpacked");
        const m = /^zip:([0-9a-f]{64})!(\d+)$/.exec(r.retrievalLocator || "");
        if (!m || depth >= 3) return { grade: null, route: "unpacked", determined: false, basis: "CAPTURE_UNPACKED_UNRESOLVED" };
        const a = p.captureGrade(m[1], depth + 1);
        return { ...a, route: "unpacked", basis: "CAPTURE_UNPACKED_FROM_ARCHIVE",
                 archive: { sha256: a.archive ? a.archive.sha256 : m[1], through: [...(a.archive ? a.archive.through : []), Number(m[2])],
                            route: a.archive ? a.archive.route : a.route, basis: a.archive ? a.archive.basis : a.basis } };
      }
      if (v.includes("doorbell")) return { grade: null, route: "doorbell", determined: false, basis: "CAPTURE_RECEIVED_NOT_FETCHED" };
      return { grade: null, route: "unrecorded", determined: false, basis: "CAPTURE_ROUTE_UNRECORDED" };
    },
  };
  return p;
}

/* membership's R64 as acquisition R43 reaches it: the administrators named. */
export function membership({ admins = ["boss"] } = {}) {
  return { admins, isAdministrator: (id) => admins.includes(id) };
}

/** A fresh Ed25519 private key, PKCS#8, base64: what an operator binds as the instance's secret (attestation R4). */
export const pkcs8 = () => generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");

/* The capture store handed in: each service as capture's Provides state it, in memory, every call recorded in `state`.
   `failures` is capture R8's consecutive-failure threshold for the fallback. */
export function captureStore({ core, env = {}, gov = null, prov = null, failures = 3 } = {}) {
  const state = { outcomes: [], reach: new Map(), sessions: new Map(), day: null, render: { spent_ms: 0, reserved_ms: 0, renders: 0, deferred: 0 },
                  slots: new Map(), admits: [], spends: [], validators: new Map(), actors: [], events: [], limits: new Map(),
                  assets: new Map(), siteRecords: [], links: [], emitted: [], sessionSaves: [], sessionDrops: [],
                  captured: [], late: [], clockMs: null, recordFails: false };
  const today = (at) => (at || stamp()).slice(0, 10);
  const dayOf = (at) => { const d = today(at); if (state.day !== d) { state.day = d; state.render = { spent_ms: 0, reserved_ms: 0, renders: 0, deferred: 0 }; } return state.render; };
  return {
    core, env, governor: gov, provenance: prov, state, staggerMs: 0,
    /* capture R8 */
    async recordSourceOutcome({ addressNorm, outcome, status = null, at = null }) {
      state.outcomes.push({ addressNorm, outcome, status, at });
      const r = state.reach.get(addressNorm) || { consecutive_failures: 0, governed_refusals: 0, last_outcome: null, last_status: null };
      if (outcome === "governed") r.governed_refusals++;
      else if (outcome === "success") r.consecutive_failures = 0;
      else r.consecutive_failures++;
      if (outcome !== "governed") r.last_status = status;
      r.last_outcome = outcome;
      state.reach.set(addressNorm, r);
      return { ok: true };
    },
    sourceReachability({ addressNorm }) {
      const r = state.reach.get(addressNorm);
      if (!r) return { address_norm: addressNorm, known: false, consecutive_failures: 0, governed_refusals: 0, fallback_eligible: false,
                       basis: word("capture.basis.attempt_address_ever") };
      const eligible = r.consecutive_failures >= failures;
      return { address_norm: addressNorm, known: true, ...r, fallback_eligible: eligible,
               basis: eligible ? word("capture.basis.consecutive_failures_produced", { consecutive_failures: String(r.consecutive_failures), failures: String(failures) }) : word("capture.basis.eligible_threshold_met") };
    },
    /* capture R22; as capture's own does (capture R22, K5205), a handed `at` (milliseconds) is the instant the session is saved at */
    saveCaptureSession(s) { state.sessionSaves.push(s); const cur = state.sessions.get(s.session);
      const now = s.at != null ? Number(s.at) : (state.clockMs ?? Date.now());
      state.sessions.set(s.session, { ...s, ticks: cur ? cur.ticks + 1 : 1, created: cur ? cur.created : stamp(now), updated: stamp(now),
                                      expires: stamp(now + (Number(s.ttlMs) || 3600000)) });
      return { session: s.session, saved: true, ticks: cur ? cur.ticks + 1 : 1 }; },
    /* capture R46: every session whose expiry is after `now`, in session order */
    liveCaptureSessions(now) {
      const at = typeof now === "string" ? now : stamp(Number(now));
      return [...state.sessions.values()].filter((x) => x.expires > at).sort((a, b) => (a.session < b.session ? -1 : 1)).map((x) => ({
        session: x.session, locator: x.locator, primarySha: x.primarySha, primaryFile: x.primaryFile, base: x.base, created: x.created,
        updated: x.updated, expires: x.expires, ticks: x.ticks, state: x.state })); },
    /* capture R94: once for each (capture, question, member); a malformed ask records nothing */
    recordCapturedFor({ captureSha, question, by, at = null }) {
      if (state.recordFails) throw new Error("capture refused");
      const okAsk = /^[0-9a-f]{64}$/.test(captureSha || "") && typeof question === "string" && question.trim() && question.length <= 200
        && typeof by === "string" && by.trim() && !/^(class:|daemon|bio-)/.test(by);
      if (!okAsk) return { recorded: false };
      if (!state.captured.some((c) => c.captureSha === captureSha && c.question === question && c.by === by)) state.captured.push({ captureSha, question, by, at });
      return { recorded: true };
    },
    /* as capture's does (R22): a session past its hour is pruned on the way past, so it is not found */
    loadCaptureSession({ session }) { const now = stamp(state.clockMs ?? Date.now());
      for (const [k, x] of state.sessions) if (x.expires < now) state.sessions.delete(k);
      const s = state.sessions.get(session);
      return s ? { session, found: true, locator: s.locator, primarySha: s.primarySha, primaryFile: s.primaryFile, base: s.base, ticks: s.ticks, state: s.state }
               : { session, found: false, note: word("capture.note.capture_session_either") }; },
    dropCaptureSession({ session }) { state.sessionDrops.push(session); state.sessions.delete(session); return { session, dropped: true }; },
    /* capture R39–R40: the concurrency cap first, then the day's account; a reservation held until spent. */
    renderAdmit({ allowanceMs, reserveMs = 0, cap = null, at = null }) {
      state.admits.push({ allowanceMs, reserveMs, cap, at });
      const d = dayOf(at);
      if (cap != null && state.slots.size >= cap) return { state: "waiting", cap, running: state.slots.size, reserve_ms: reserveMs };
      if (!(reserveMs > 0) || d.spent_ms + d.reserved_ms + reserveMs > allowanceMs) {
        d.deferred++;
        return { state: "deferred", day: today(at), spent_ms: d.spent_ms, reserved_ms: d.reserved_ms, reserve_ms: reserveMs, allowance_ms: allowanceMs, deferred: d.deferred };
      }
      d.reserved_ms += reserveMs; d.renders++;
      const slot = `slot-${state.admits.length}`;
      state.slots.set(slot, reserveMs);
      return { state: "admitted", slot, cap, reserve_ms: reserveMs, allowance_ms: allowanceMs };
    },
    renderSpend({ ms, releaseMs = 0, slot = null, at = null }) {
      state.spends.push({ ms, releaseMs, slot, at });
      if (slot) state.slots.delete(slot);
      const d = dayOf(at);
      if (!(typeof ms === "number" && ms >= 0)) return { released_ms: 0 };
      const released = Math.min(d.reserved_ms, releaseMs);
      d.spent_ms += Math.ceil(ms); d.reserved_ms -= released;
      return { released_ms: released };
    },
    /* capture R61 */
    recordValidators({ addressNorm, captureSha, etag = null, lastModified = null, at = null }) {
      state.validators.set(`${addressNorm} ${captureSha}`, { etag: etag || null, lastModified: lastModified || null, at }); return { recorded: true }; },
    validatorsOf({ addressNorm, captureSha }) {
      const v = state.validators.get(`${addressNorm} ${captureSha}`);
      return v && (v.etag || v.lastModified) ? { etag: v.etag, lastModified: v.lastModified } : null; },
    /* capture R69 */
    recordCaptureActor(a) { state.actors.push(a); return { recorded: true }; },
    /* capture R68 (T51; C12): a co-attestation that ended after the capture was answered, recorded when it ends */
    recordLateAttestations(a) { state.late.push({ ...a, recordedAt: Date.now() }); return { recorded: true }; },
    /* capture R15: one event per (kind, capture). */
    async taskEnqueue(e) {
      if (!state.events.some((x) => x.kind === e.kind && x.captureSha === e.captureSha)) state.events.push(e);
      return { ok: true };
    },
    /* capture R23 */
    captureLimit(runtime = "subrequests") { const l = state.limits.get(runtime);
      return l ? { runtime, observed: l, probeDue: false } : { runtime, observed: null, probeDue: true }; },
    recordCaptureLimit({ runtime = "subrequests", observed = null }) {
      if (observed != null) state.limits.set(runtime, observed); return { runtime, observed, recorded: observed != null }; },
    /* capture R24–R25: what a host has served (a test seeds `state.assets`), and what a capture saw of it. */
    siteAssets({ host }) { return { host, assets: Object.fromEntries(state.assets.get(host) || []) }; },
    recordSiteAssets(r) { state.siteRecords.push(r); return { host: r.host, recorded: r.observations.length }; },
    /* capture R27 */
    recordLinks(r) { state.links.push(r); return { recorded: r.links.length }; },
    /* capture R19's stagger, an instance setting: zero here unless a test sets it. */
    subresourceStaggerMs() { return this.staggerMs; },
    /* capture R55 */
    emit(event, payload) { state.emitted.push([event, payload]); return []; },
  };
}

/* A fresh world: record-core over a fresh store, an evidence bucket, the governor, provenance, attestation's real
   instance (its instance key `signingKey`, a fresh one unless a test binds none with `null`) and the capture store
   carrying it as `attestation`, as capture R73 hands it in. */
export function world({ env = {}, gov = {}, provOpts = {}, prov = undefined, failures = 3, evidence = true, signingKey = pkcs8(),
                        admins = ["boss"], acquisition = true } = {}) {
  const s = storage();
  const host = { storage: s };
  const b = bucket();
  const core = recordOf(host, { evidence: evidence ? b : null, evidencePrefix: "bio/captures/" });
  core.migrate();
  for (const t of PROVENANCE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";")) if (t.trim()) s.db.exec(t);
  const g = governor(gov);
  const mem = membership({ admins });
  const p = prov === undefined ? provenance({ sql: s.sql, ...provOpts }) : prov;
  const att = attestationOf(host, { record: core, provenance: p, signingKey, instanceName: "inst" });
  const store = captureStore({ core, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9", ...env }, gov: g, prov: p, failures });
  store.attestation = att;
  /* acquisition's own instance over the same storage (R38–R41, R43), handed in as `store.acquisition` (capture R73's form) */
  const acq = acquisition ? acquisitionOf(host, { record: core, provenance: p, membership: mem }) : null;
  if (acq) store.acquisition = acq;
  return { s, b, core, gov: g, prov: p, att, store, acq, mem, host, rows: (q, ...a) => s.sql.exec(q, ...a),
           signed: () => s.sql.exec("SELECT * FROM signed_receipts"),
           held: (digest) => b.held.has(`bio/captures/${digest}`), bytesOf: (digest) => b.held.get(`bio/captures/${digest}`) };
}

/* A scripted network: `routes` maps a URL (or a function of it) to a Response or a thrower; every fetch is recorded.
   Co-attestation's requests (R20: the timestamp authorities and the co-archive, sent under the agent naming the
   purpose `attest`, R9) are recorded in `attest`, apart from the act's own fetches in `seen`. */
const attestPurpose = (init) => /; attest\)$/.test(String((init && init.headers && init.headers["user-agent"]) || ""));
export function network(routes) {
  const seen = [], attest = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u && u.url ? u.url : u);
    (attestPurpose(init) ? attest : seen).push({ url, init });
    const r = typeof routes === "function" ? routes(url, init) : routes[url];
    if (r instanceof Error) throw r;
    if (!r) return new Response("not found", { status: 404 });
    return typeof r === "function" ? r(url, init) : r.clone();
  };
  return { seen, attest, restore() { globalThis.fetch = orig; } };
}

/* One acquisition over a scripted network; a member session unless `o` says otherwise. R20 (fix round 3, C12): the answer does
   not wait for co-attestation, which goes on after it, so the scripted network stays up until the attempt a pending answer names
   has been recorded against the capture (capture R68), unless `o.settle` is false: then the answer carries `settled()`, which a
   test that times the answer awaits when it is done. The other keys of `o` are `acquire`'s. */
export async function run(w, routes, body, o = {}) {
  const { settle = true, ...opts } = o;
  const net = network(routes);
  const had = w.store.state.late.length;
  try {
    const r = await acquire(w.store, body, { cls: "member", member: true, sessMember: "m1", storeName: "bio", ...opts });
    const pending = !!(r.body && r.body.document && Array.isArray(r.body.document.attestation_attempts)
      && r.body.document.attestation_attempts.some((a) => a && a.pending === true));
    const settled = async () => {
      for (let i = 0; pending && i < 3000 && w.store.state.late.length === had; i++) await new Promise((x) => setTimeout(x, 10));
      net.restore();
    };
    if (settle) { await settled(); return { ...r, net }; }
    return { ...r, net, settled };
  } catch (e) { net.restore(); throw e; }
}
export async function lookup(w, routes, args) {
  const net = network(routes);
  try { return { ...(await archiveLookup(w.store, args)), net }; }
  finally { net.restore(); }
}

export const HTML = (body = "<p>hello</p>") => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
export const page = (body, headers = {}, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
export const text = (body, headers = {}) => new Response(body, { headers: { "content-type": "text/plain", ...headers } });

/* A scripted Memento archive (RFC 7089) at the Wayback Machine's addresses (capture-sources R37's WAYBACK_MEMENTO):
   `mementos` are `{ts, original?, status?, body?, ct?, datetime?, link?}`. The TimeGate redirects to the newest memento
   (404 with none), the TimeMap lists every one with its datetime, and each memento's raw form (`id_`) answers its
   status, body, `Memento-Datetime` and `Link rel=original`. `over` replaces any route by URL (or a URL prefix). */
export const WB = "https://web.archive.org/web/";
export const http1123 = (ts) => acceptDatetime(ts);
export function wayback(mementos, { address = "https://gone.example/doc", over = {} } = {}) {
  const ms = [...mementos].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const orig = (m) => m.original || address;
  return (u) => {
    for (const [k, v] of Object.entries(over)) if (u === k || (k.endsWith("*") && u.startsWith(k.slice(0, -1)))) return typeof v === "function" ? v(u) : v;
    if (u === `${WB}${address}`) return ms.length
      ? new Response("", { status: 302, headers: { location: `${WB}${ms[0].ts}/${orig(ms[0])}`, vary: "accept-datetime",
                                                   link: `<${address}>; rel="original", <${WB}timemap/link/${address}>; rel="timemap"` } })
      : new Response("none", { status: 404 });
    if (u === `${WB}timemap/link/${address}`)
      return new Response([`<${address}>; rel="original"`, `<${WB}${address}>; rel="timegate"`,
        ...ms.map((m) => `<${WB}${m.ts}/${orig(m)}>; rel="memento"; datetime="${m.datetime ?? http1123(m.ts)}"`)].join(",\n"),
        { headers: { "content-type": "application/link-format" } });
    for (const m of ms) if (u === `${WB}${m.ts}id_/${orig(m)}`)
      return new Response(m.body ?? "archived bytes", { status: m.status || 200, headers: {
        "content-type": m.ct || "text/plain", "memento-datetime": m.datetime ?? http1123(m.ts),
        ...(m.link === null ? {} : { link: m.link ?? `<${orig(m)}>; rel="original", <${WB}timemap/link/${orig(m)}>; rel="timemap"` }) } });
    return null;
  };
}
/* Three consecutive failures at an address: capture R8's threshold here, so the archive fallback is eligible. */
export async function eligible(w, addr = "https://gone.example/doc") {
  for (let i = 0; i < 3; i++) await w.store.recordSourceOutcome({ addressNorm: addr, outcome: "source_refused", status: 404 });
}

/* A renderer bound as a service (capture-sources R18), answering `answer` and recording each request. */
export function rendererEnv(answer) {
  const calls = [];
  return { calls, RENDERER: { fetch: async (u, init) => { calls.push(JSON.parse(init.body)); return new Response(JSON.stringify(typeof answer === "function" ? answer() : answer)); } } };
}

/* R122: the door promotes what a call files, so each filed member of an archive has a home; a test that runs the daemon over an archive after a
   call that filed members, with no door in between, states that promotion here (a member with no home is offered again, R122 (2)). */
export function promoteFiled(w) {
  for (const r of w.rows("SELECT sha256 FROM archive_entries WHERE state='filed' AND sha256 IS NOT NULL")) w.prov.homes[r.sha256] ??= "INFO-door";
}
