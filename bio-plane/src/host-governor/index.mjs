/* host-governor — the per-host request governor (layer 3; D-95). Requirements: build/requirements/host-governor.md
   (R1–R30). Extracted from `legacy-store` (store.mjs, schema.mjs) and `legacy-index` (index.mjs) in T4 (T4-1, N25).

   Our APPETITE is a configured constant because it is ours. Their CAPACITY is discovered by being refused and
   recorded, the pattern capture_limits proved. The governor lives in the Durable Object because the object
   serialises, so one token bucket is globally correct for the instance for free (R20); a bucket in Worker memory
   governs nothing, since every invocation is independent.

   Pacing resembles a person rather than a loop: grants to one host are separated by a JITTERED gap around the
   appetite's base interval, never a metronome. The chosen constants are recorded in MEASUREMENTS.md as chosen, not
   measured. A 429 overrides the bucket entirely: a cool-off in the future refuses admission regardless of token
   balance, honouring Retry-After when the counterparty names one and escalating with consecutive refusals when it
   does not, mirroring their own escalation. Success decays the escalation to zero. This governs OUR instance only
   and cannot solve the shared-egress problem; that is D-95's recorded limit. Nothing here names a host (R25).

   REACHED THROUGH `governorOf(ctx)` inside the Durable Object (K61), and from a Worker through `governorOverStub`,
   the thin adapter K72 (2) names, which `governedFetch` takes as its `governor`. */
import { recordOf } from "../record-core/index.mjs";
import { HOST_GOVERNOR_SCHEMA } from "./schema.mjs";

export { HOST_GOVERNOR_SCHEMA };

/** The chosen constants (R2, R3, R5, R6, R9), recorded in MEASUREMENTS.md as chosen. */
export const GOVERNOR = Object.freeze({
  defaultAppetitePerMin: 12,   /* chosen: one document fetch every ~5s on average */
  jitterLow: 0.6, jitterHigh: 1.5,
  burstTokens: 3,              /* a person opens a few tabs; a loop opens forty */
  cooloff429BaseMs: 60_000,  cooloff429CapMs: 3_600_000,
  cooloffRefusedBaseMs: 30_000, cooloffRefusedCapMs: 1_800_000,
});

/** R3, R12: an appetite is a positive finite number, given as a number or as the text of one; anything else is
 *  no appetite (`null`). A binding, a stored value and a configured value are all judged by this one rule. */
export function appetiteOf(value) {
  if (typeof value === "string") { if (value.trim() === "") return null; }
  else if (typeof value !== "number") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** R12, R19: the one refusal of an appetite that is present and not a positive finite number. It has no catalogue
 *  row, so it carries its requirement as its check and its words as its translation. */
export function badAppetite(host = null) {
  const detail = "appetite_per_min must be a positive number, or omit it to reset to your team's default";
  return { ok: false, configured: false, reason: "BAD_APPETITE", code: "BAD_APPETITE", check: "host-governor.R12",
           translation: detail, detail, ...(host ? { host } : {}) };
}

/** R16: a `Retry-After` value in milliseconds: delta-seconds × 1000, or an HTTP-date minus `nowMs`, never below 0;
 *  `null` when absent or unreadable. The one parser (the Suggestion): `capture`'s subresource fetch reads it too. */
export function retryAfterMs(value, nowMs = Date.now()) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return Math.max(0, Number(s) * 1000);
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.max(0, t - nowMs) : null;
}

const hostOf = (q) => (q && typeof q.host === "string" && q.host !== "" ? q.host : null);

export class HostGovernor {
  /** `sql` is the Durable Object's (`ctx.storage.sql`); `core` is record-core, for the purge declaration (R24);
   *  `env` carries the instance binding `GOVERNOR_APPETITE_PER_MIN` (R3), read at each admission; `now` and
   *  `random` are the clock and the jitter source (the Suggestion), so R5, R6 and R9 are exact under test. */
  constructor({ sql, core = null, env = null, now = () => Date.now(), random = () => Math.random() } = {}) {
    this.sql = sql;
    this.core = core;
    this.env = env;
    this.now = now;
    this.random = random;
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)].map((r) => ({ ...r })); }
  #row(host) { return this.#rows(`SELECT * FROM host_governor WHERE host = ?`, host)[0] || null; }

  /* R2: first contact creates the host's state with a full burst, no cool-off and no refusals. */
  #rowOrNew(host, now) {
    let r = this.#row(host);
    if (!r) {
      this.sql.exec(`INSERT INTO host_governor (host, tokens, refilled_at, updated_at) VALUES (?, ?, ?, ?)`,
        host, GOVERNOR.burstTokens, now, new Date(now).toISOString());
      r = this.#row(host);
    }
    return r;
  }

  /* R29: the state R2 would create for a host not yet met, held in memory only: a peek decides on it and writes none. */
  #unmet(host, now) {
    return { host, appetite_per_min: null, tokens: GOVERNOR.burstTokens, refilled_at: now, last_grant_at: 0,
             cooloff_until: 0, refusals: 0, last_refusal_at: null, last_refusal_status: null };
  }

  /** This module's table, at every boot, idempotent; and its purge declaration (R24), once: exempt, because a
   *  cool-off is a counterparty's refusal and a purged instance still honours it. Run by the host inside its boot. */
  migrate() {
    const bare = HOST_GOVERNOR_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.sql.exec(t); }
    if (this.#declared || !this.core || typeof this.core.declarePurge !== "function") return;
    const answer = this.core.declarePurge("host-governor", [], { exempt: ["host_governor"] });
    if (answer && answer.ok === false)
      throw new Error(`host-governor: record-core refused its purge declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
  }
  #declared = false;

  /* R3: the host's configured appetite, else the instance binding when it is a positive finite number, else the
     chosen default. A stored value that is not a positive finite number (one written before R12 held) is no
     configuration, and the precedence goes on past it. */
  #appetite(r) {
    return appetiteOf(r.appetite_per_min)
      ?? appetiteOf(this.env ? this.env.GOVERNOR_APPETITE_PER_MIN : undefined)
      ?? GOVERNOR.defaultAppetitePerMin;
  }

  /** R1–R6, R29. Never throws on its own logic. `{host, peek: true}` (the one option this op accepts besides `host`;
   *  declared for the census, K4208) answers exactly as the booking would at this instant and writes nothing: no
   *  state for a host not yet met (R2's full burst is answered), no token, no grant, no refusal counted. Only
   *  `peek === true` peeks. */
  governorAdmit(q) {
    const host = hostOf(q);
    if (!host) return { admitted: false, reason: "no host named" };
    const peek = q.peek === true;
    const now = this.now();
    const at = new Date(now).toISOString();
    const r = peek ? (this.#row(host) ?? this.#unmet(host, now)) : this.#rowOrNew(host, now);
    const appetite = this.#appetite(r);

    /* R4, R22: a cool-off overrides the bucket entirely, whatever appetite is configured. */
    if (r.cooloff_until > now) {
      if (!peek) this.sql.exec(`UPDATE host_governor SET refused_total = refused_total + 1, updated_at = ? WHERE host = ?`, at, host);
      return { admitted: false, reason: "cooling_off", retry_in_ms: r.cooloff_until - now,
               refusals: r.refusals, last_refusal_status: r.last_refusal_status };
    }

    /* R5: refill, capped at a small burst: a person opens a few tabs at once and then reads; a loop opens forty and
       keeps going. A clock that stepped back refills nothing. */
    const tokens = Math.min(GOVERNOR.burstTokens, r.tokens + (Math.max(0, now - r.refilled_at) / 60_000) * appetite);
    if (tokens < 1) {
      const retryIn = Math.ceil(((1 - tokens) / appetite) * 60_000);
      if (!peek)
        this.sql.exec(`UPDATE host_governor SET tokens = ?, refilled_at = ?, refused_total = refused_total + 1, updated_at = ? WHERE host = ?`,
          tokens, now, at, host);
      return { admitted: false, reason: "appetite", retry_in_ms: retryIn };
    }

    /* R6: admitted. The caller waits wait_ms before fetching, which is where the human-shaped gap comes from:
       jittered around the base interval, and only when this grant follows the last one closely enough to need
       spacing. The grant is recorded at when the fetch goes out. */
    const j = GOVERNOR.jitterLow + this.random() * (GOVERNOR.jitterHigh - GOVERNOR.jitterLow);
    const gapWanted = (60_000 / appetite) * j;
    const sinceLast = now - (r.last_grant_at || 0);
    const wait = Math.max(0, Math.round(gapWanted - sinceLast));
    const cap = q.maxWaitMs == null || q.maxWaitMs === "" ? NaN : Number(q.maxWaitMs);
    if (Number.isFinite(cap) && wait > Math.max(0, cap)) {
      if (!peek)
        this.sql.exec(`UPDATE host_governor SET tokens = ?, refilled_at = ?, refused_total = refused_total + 1, updated_at = ? WHERE host = ?`,
          tokens, now, at, host);
      return { admitted: false, reason: "appetite", retry_in_ms: wait };
    }
    if (!peek)
      this.sql.exec(
        `UPDATE host_governor SET tokens = ?, refilled_at = ?, last_grant_at = ?, granted = granted + 1, updated_at = ? WHERE host = ?`,
        tokens - 1, now, now + wait, at, host);
    return { admitted: true, wait_ms: wait, appetite_per_min: appetite };
  }

  /** R7–R10. Never throws on its own logic. */
  governorReport(q) {
    const host = hostOf(q);
    if (!host) return { recorded: false };
    const s = Number(q.status) || 0;
    const now = this.now();
    const at = new Date(now).toISOString();
    if (s >= 200 && s < 400) {
      /* R8: they relented, or never objected; the escalation resets. The cool-off already recorded stands: they
         relented, but the window they named still stands until it lapses. */
      this.#rowOrNew(host, now);
      this.sql.exec(`UPDATE host_governor SET refusals = 0, updated_at = ? WHERE host = ?`, at, host);
      return { recorded: true, refusals: 0 };
    }
    if (s === 429 || s === 403 || s === 503) {
      const r = this.#rowOrNew(host, now);
      const refusals = (r.refusals || 0) + 1;
      const base = s === 429 ? GOVERNOR.cooloff429BaseMs : GOVERNOR.cooloffRefusedBaseMs;
      const cap  = s === 429 ? GOVERNOR.cooloff429CapMs  : GOVERNOR.cooloffRefusedCapMs;
      const escalated = Math.min(cap, base * Math.pow(2, refusals - 1));
      /* Retry-After is the counterparty naming their own capacity; honour it when it is longer than our escalation,
         never shorter. R21: no outcome shortens a cool-off, so a later, shorter refusal leaves a longer one standing. */
      const cooloff = Math.max(Number(r.cooloff_until) || 0, now + Math.max(escalated, Number(q.retry_after_ms) || 0));
      this.sql.exec(
        `UPDATE host_governor SET refusals = ?, last_refusal_at = ?, last_refusal_status = ?, cooloff_until = ?, updated_at = ? WHERE host = ?`,
        refusals, now, s, cooloff, at, host);
      return { recorded: true, refusals, cooloff_until: cooloff, cooloff_ms: cooloff - now };
    }
    /* R10: other statuses (404, 500, a fetch that produced no response reported as 0) are outcomes for monitoring,
       not capacity signals; the governor records nothing. */
    return { recorded: true, ignored: s };
  }

  /** R11, R12. A host is required, so a global appetite cannot be set; `null` or an omitted appetite clears the
   *  host's, which is how an operator says "stop treating this host specially". Never throws. */
  governorConfig(q) {
    const host = hostOf(q);
    if (!host) return { configured: false };
    const given = q.appetite_per_min;
    const appetite = given == null ? null : appetiteOf(given);
    if (given != null && appetite === null) return badAppetite(host);
    const now = this.now();
    this.#rowOrNew(host, now);
    this.sql.exec(`UPDATE host_governor SET appetite_per_min = ?, updated_at = ? WHERE host = ?`,
      appetite, new Date(now).toISOString(), host);
    return { configured: true, host, appetite_per_min: appetite };
  }

  /** R13: one host's row, or every row by host; never creates one. Never throws. R28: it reads only `host`, so a
   *  `now` or `nowMs` a caller sends is never read, and the rows it answers are as recorded, judging no instant. */
  governorState(q) {
    const host = q && q.host != null && q.host !== "" ? String(q.host) : null;
    return { hosts: host ? this.#rows(`SELECT * FROM host_governor WHERE host = ?`, host)
                         : this.#rows(`SELECT * FROM host_governor ORDER BY host`) };
  }

  /** R14: every host held at `now`, by R4's own test (`cooloff_until > now`); spends nothing, writes nothing. */
  governorHolding(q) {
    const now = q && Number.isFinite(Number(q.now)) && q.now !== null && q.now !== "" ? Number(q.now) : this.now();
    return this.#rows(`SELECT * FROM host_governor WHERE cooloff_until > ? ORDER BY host`, now);
  }

  /** R14: whether one host is held at `now`; `false` for a host with no state. A NON-CONSUMING read: a caller that
   *  must not spend a token it is not about to use asks this, never `governorAdmit`. */
  isHeld(host, now = this.now()) {
    if (typeof host !== "string" || host === "") return false;
    const r = this.#row(host);
    const at = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : this.now();
    return !!r && Number(r.cooloff_until) > at;
  }
}

/* K61: the one HostGovernor of a Durable Object's storage, made on first use over its `sql`, reaching record-core by
   `recordOf(ctx)` on the same `ctx`. */
const OF = new WeakMap();

/* R26 (N132, capture R58's pattern): for each instance, which of its options a caller supplied, so a later caller's
   option is judged against the right thing: one taken by default is adopted, one a caller gave must be the same. */
const SUPPLIED = new WeakMap();

/* Two `env`s are the same when they carry the same bindings, each the same value: the object one module was handed
   need not be the object another was handed for the one Durable Object. */
const sameEnv = (a, b) => {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && a[k] === b[k]);
};

/** K61, R26: the one HostGovernor for this object's storage. `opts`: `env` (the bindings R3 reads), `now` and `random`
 *  (the clock and the jitter source) and `record` (`recordOf(ctx)`). A later call's option is never silently dropped
 *  (N132: a first caller without `env` left the instance binding unread for every later one): an `env`, `now` or
 *  `random` the instance took by default is adopted from the first later caller that supplies it; one that differs
 *  from what an earlier caller supplied, or a `record` other than the one held, throws, naming the option, and a
 *  refused call changes nothing. */
export function governorOf(ctx, { env = null, now = null, random = null, record = null } = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  const opts = { env, now, random };
  let g = OF.get(storage);
  if (!g) {
    g = new HostGovernor({ sql: storage.sql, core: record ?? recordOf(ctx), env,
                           ...(now ? { now } : {}), ...(random ? { random } : {}) });
    OF.set(storage, g);
    SUPPLIED.set(g, new Set(Object.keys(opts).filter((k) => opts[k] != null)));
    return g;
  }
  const given = SUPPLIED.get(g);
  const refuse = (name) => {
    throw new Error(`governorOf: a caller supplied a different \`${name}\` for a storage whose governor already holds `
                  + `another one a caller gave; host-governor refuses it rather than run against either silently (R26)`);
  };
  /* Every option judged before any is adopted. */
  if (env != null && given.has("env") && !sameEnv(g.env, env)) refuse("env");
  for (const name of ["now", "random"]) if (opts[name] != null && given.has(name) && g[name] !== opts[name]) refuse(name);
  if (record != null && record !== g.core) refuse("record");
  for (const name of Object.keys(opts))
    if (opts[name] != null && !given.has(name)) { g[name] = opts[name]; given.add(name); }
  return g;
}

/** The Durable Object's routes for this module, as entries of the plane's one route map (plane R5: `routes` spreads
 *  them in, and control-plane's `dispatch` answers every store request over it): the four paths a Worker reaches the
 *  governor by. */
export function governorRoutes(g, url, body) {
  return {
    governoradmit: () => g.governorAdmit(body || { host: url.searchParams.get("host") }),
    governorreport: () => g.governorReport(body || {}),
    governorconfig: () => g.governorConfig(body || {}),
    governorstate: () => g.governorState(body || { host: url.searchParams.get("host") }),
  };
}

/** K72 (2): R1–R10 from a Worker, over the Durable Object's stub, as `governedFetch`'s `{admit, report}`. A stub that
 *  does not answer throws or answers `null`, which `governedFetch` reads as a governor it cannot reach (R17). */
export function governorOverStub(stub) {
  const ask = async (path, body) => {
    const res = await stub.fetch(`http://x/${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json();
    return out && out.ok === true && out.result ? out.result : null;
  };
  return { admit: (q) => ask("governoradmit", q), report: (q) => ask("governorreport", q) };
}

/** R30: the longest wait inside a request that `governedFetch` sleeps, R6's gap included (8 s: the whole gap at the default appetite, max 7.5 s); a longer one is refused. */
export const MAX_WAIT_MS = 8000;

/** R15–R17, R30. Every governed outbound fetch asks for admission first, waits the jittered gap the governor names,
 *  fetches with the agent the caller supplied, and reports the outcome back so the host's capacity is learned rather
 *  than guessed. Refusal by the governor is a named answer, not an exception. An UNREACHABLE governor never blocks
 *  the fetch: this is politeness, not coordination, and if the store is down the op fails by itself anyway. MEASURED
 *  case in point, 2026-07-30 on the deployed 0.46.0: eleven captures of one municipal site from Workers egress, one
 *  403 on the only cold back-to-back pair, ten paced or warmed requests admitted. */
export async function governedFetch(target, { userAgent = null, fetch: doFetch = globalThis.fetch, governor = null,
                                              now = () => Date.now(), maxWaitMs = MAX_WAIT_MS,
                                              sleep = (ms) => new Promise((s) => setTimeout(s, ms)) } = {}) {
  let host = null;
  try { host = new URL(target).host || null; } catch { /* an unreadable target is fetched ungoverned (R17) */ }
  const gov = host && governor && typeof governor.admit === "function" ? governor : null;
  let waitMs = 0;
  if (gov) {
    try {
      const g = await gov.admit({ host, maxWaitMs });
      if (g && g.admitted === false)
        return { refusedByGovernor: true, reason: g.reason || "governed",
                 retry_in_ms: g.retry_in_ms || 0, last_refusal_status: g.last_refusal_status ?? null };
      waitMs = (g && Number(g.wait_ms)) || 0;
      /* R30: a governor that did not honour `maxWaitMs` is not slept out; refused as R5 refuses (its grant stands). */
      if (waitMs > maxWaitMs)
        return { refusedByGovernor: true, reason: "appetite", retry_in_ms: waitMs, last_refusal_status: null };
    } catch { /* ungoverned is better than unfetched; see above */ }
  }
  if (waitMs > 0) await sleep(waitMs);
  const headers = typeof userAgent === "string" && userAgent !== "" ? { "user-agent": userAgent } : {};
  const res = await doFetch(target, { redirect: "follow", headers });
  let retryIn = null;
  if (gov && typeof gov.report === "function") {
    try {
      const ra = res && res.headers && typeof res.headers.get === "function" ? res.headers.get("retry-after") : null;
      const rec = await gov.report({ host, status: res.status, retry_after_ms: retryAfterMs(ra, now()) });
      /* R30: a status R9 holds against (403, 429, 503) comes back with the cool-off it recorded, so the caller can say
         when to try again without a second request. */
      if (rec && rec.recorded === true && Number.isFinite(rec.cooloff_ms)) retryIn = rec.cooloff_ms;
    } catch { /* an unrecorded outcome is not a failed fetch */ }
  }
  return retryIn === null ? { res } : { res, retry_in_ms: retryIn };
}

/* The Worker's side of a store call when a caller of `governorOp` hands no relay: `{answered, result}`, a body that is
   not a JSON `ok: true` answer being no answer at all. It tells a store refusal from a silence not at all, which is
   why R27 reads through the plane's `doAnswer` whenever the caller hands it, as `governorOpResponse`, the Worker's
   arm, always does. */
async function answerOf(call) {
  try {
    const out = await (await call()).json();
    return out && out.ok === true ? { answered: true, result: out.result } : { answered: false };
  } catch { return { answered: false }; }
}

/* R27 (N339, N349; K421, K445): the relay the control plane hands, as `capture`'s handlers take it: `doAnswer`, the one
   reader of the store's envelope (`control-plane` R23, R25), and `storeRefusal`, which relays the store's own refusal
   at its status. `null` when either is missing, so the call falls back to `answerOf`. */
const relayOf = (relay) =>
  relay && typeof relay.doAnswer === "function" && typeof relay.storeRefusal === "function" ? relay : null;

/* One store call, read through the relay when handed. A call that throws before it answers is handed to `doAnswer`
   as a rejected reply, so it reads it as the silence it is. */
async function storeCall(relay, call) {
  if (!relay) return answerOf(call);
  const out = await relay.doAnswer((async () => call())());
  if (out && out.refused) return { refused: true, response: relay.storeRefusal(out) };
  if (!out || !out.answered) return out && out.correlation ? { answered: false, correlation: out.correlation } : { answered: false };
  return { answered: true, result: out.result };
}

/** R18, R19: the two ops this module's handlers answer, the one list the Worker's dispatch asks. */
export const GOVERNOR_OPS = Object.freeze(["governorstate", "governorconfig"]);

/* R18, R19, R27: what a store call that did not answer with an answer comes back as. */
const unanswered = (r) => (r.refused ? { refused: true, response: r.response }
                                     : { silent: true, ...(r.correlation ? { correlation: r.correlation } : {}) });

/** R18, R19, R27: the handlers of `op=governorstate` and `op=governorconfig` (the control plane keeps their
 *  declarations, routing and envelope; K93 (3)). `store` is the Durable Object's stub, or a function answering it;
 *  `relay` is `{doAnswer, storeRefusal}` from the control plane (R27), optional so a caller that hands none keeps
 *  working. Answers `null` for any other op; `{refused: true, response}` when the store refused (the response is
 *  `storeRefusal`'s, the store's status, code and sentence; only with a relay); `{silent: true, correlation?}` when
 *  the store gave no answer, which the control plane reports as `storeSilent(op, correlation)`, never as an empty
 *  `{ok: true}`, the correlation present only when the store named one; else `{status, body}`. */
export async function governorOp(op, url, store, relay = null) {
  if (!GOVERNOR_OPS.includes(op)) return null;
  const rel = relayOf(relay);
  const st = typeof store === "function" ? store() : store;
  const host = url.searchParams.get("host");
  if (op === "governorstate") {
    /* D-103: which hosts the governor is holding and why. An empty `{ok:true}` here would read as "the governor is
       holding nothing", which is a claim about what the instance is doing to other people's servers (REC-52). */
    const r = await storeCall(rel, () => st.fetch(`http://x/governorstate${host ? `?host=${encodeURIComponent(host)}` : ""}`));
    return r.answered ? { status: 200, body: { ok: true, ...r.result } } : unanswered(r);
  }
  /* D-103: set a host's appetite. A host is required so a fat-fingered global change is impossible. */
  if (!host)
    return { status: 400, body: { ok: false, reason: "NEED_HOST",
                                  detail: "pass host=<hostname>; governorconfig never sets a global appetite" } };
  const raw = url.searchParams.get("appetite_per_min");
  const appetite = raw === null || raw === "" ? null : appetiteOf(raw);
  if (raw !== null && raw !== "" && appetite === null) return { status: 400, body: badAppetite(host) };
  /* REC-52: an operator sets a host's appetite, the store never records it, and a plane answering `{ok:true}` would
     leave the operator believing a courtesy limit is in force on somebody else's server when none is. */
  const r = await storeCall(rel, () => st.fetch("http://x/governorconfig", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ host, appetite_per_min: appetite }) }));
  if (!r.answered) return unanswered(r);
  /* R12 inside the store's answer (`ok: true` carrying the governor's own `BAD_APPETITE`): an answer, relayed at 400. */
  if (r.result && r.result.ok === false) return { status: 400, body: r.result };
  return { status: 200, body: { ok: true, ...r.result } };
}

/** R18, R19, R27: the Worker's arm for this module's two ops (legacy-index's `governorOp` block, moved here by the
 *  map's §4.4 plain move, K649 (7)). `plane` is what the control plane hands every arm: `json`, `doAnswer`,
 *  `storeRefusal` and `storeSilent`. Answers the reply: the store's own refusal through `storeRefusal`, a store that
 *  gave no answer through `storeSilent(op, correlation)` (never an empty `{ok: true}`), else `governorOp`'s body at its
 *  status. `null` for any other op. */
export async function governorOpResponse(op, url, store, { json, doAnswer, storeRefusal, storeSilent }) {
  const g = await governorOp(op, url, store, { doAnswer, storeRefusal });
  if (!g) return null;
  return g.refused ? g.response : g.silent ? storeSilent(op, g.correlation) : json(g.body, g.status);
}
