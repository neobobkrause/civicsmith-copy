/* queue — the member's one feed (requirements: `build/requirements/queue.md`).
 * Extracted from the legacy store, catalogue and control plane at T12 (K3, K49, K78 (2), P18; map
 * `build/extraction/queue.md`): the `op=queue` composition and its mint; the personal half (mute and snooze); the
 * dispose dispatch with its project arm and its class bridge. Split by N363 (K507, K531): the obligation inbox is
 * `tasks`' (this module reads it through its R6) and the feed's producers are `queue-producers`' (every item that is
 * not a task comes from its one read, `feedItems`, its R8).
 *
 *   queueFeed      op=queue: every item typed by class, homed under every case, with its options and its disposition
 *                  (R6–R18, R39, R40, R46, R50, R53); `queueAnswer` is the control plane's decoration of that answer (R17).
 *   queueMute, queueSnooze   the PERSONAL half: one member's preferences, writing nothing any other member reads
 *                  (R19–R22, R26, R30, R31).
 *   proposeDispose op=proposedispose: the set, the class bridge, the project arm; the progression arm is
 *                  `progressions.disposeProposal` (R27–R29).
 *   counts         its three figures, registered with record-core's counts (R42).
 *
 * REACHED as `queueOf(ctx, deps)` (K61): one instance per Durable Object storage, created on the first call. At that
 * call it declares its three tables to record-core's purge (R36) and registers its three figures with record-core's
 * counts (R42), and registers its `queue-renotify` consumer with the scheduler (R22) unless `deps` says a test is
 * driving it bare.
 * `deps` (each defaults to its module's instance on the same `ctx`, reached lazily when first asked):
 *   record, membership, connections, progressions, bias, affordances, scheduler, tasks,
 *   producers   the providers (`producers` is `queue-producers`, handed whichever of its own providers were given
 *              here: governor, provenance, capture, captureRequests, basisVersions, aiRuns, publication, reevaluation,
 *              intent, monitoring, contradiction, actionClocks, escalation, actionPlans, actions, filingTemplates,
 *              localFacts, networkNotices, linkSweep, docket, caseImport, wizardScripts and the shared ones);
 *   notices   `notice-producers` (R51), whose `noticeItems` is read beside the producers;
 *   zone      `() => zone | null`, the instance profile's time zone (R21, R22), in place of scheduler's `viewZone`;
 *   env       the instance bindings: `BIO_NOW_MS` (the clock);
 *   now       R53: this module's clock, `() => ms` (epoch milliseconds), in place of `env`'s; adopted from the first
 *             caller that supplies one, and a later caller's that is another function is refused by a throw naming
 *             `now` (capture R90's rule for its own). `op=queue` is judged at it and takes no instant from a request;
 *   investigation   `investigation` (R27, K2523), which this module registers its project arm's read with at start;
 *   start     false to skip the scheduler registration (a test that drives the consumer itself) and, unless
 *             `investigation` is given, investigation's.
 * The ops are `queueOps`' entries, which control-plane's `controlPlaneRoutes` spreads into the plane's one route map
 * (plane R5; control-plane's `dispatch` answers every store request over it); `op=queue`'s door half (the store's
 * answer decorated for the caller, R17) is `door.mjs`' `queueOp`, which the control plane's door reaches through the
 * plane's hooks (plane R6; T19).
 *
 * N301 (K356), R48 (DEC-107, DEC-131): the classes keep their codes and meanings and are shown to members as **To do**,
 * **Noticed** and **Status**: the answer publishes `class_labels`, and no member-facing sentence this module owns calls
 * a to-do an obligation, or a status item a condition or a signal.
 */

import { normalizeType, STATES, vocabFor, isMachineIdentity } from "../record-grammar/index.mjs";
import { recordOf, stampInstant, perItem } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, noSuchProject } from "../membership/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { progressionsOf, notADisposition } from "../progressions/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { schedulerOf, viewZone } from "../scheduler/index.mjs";
import { localDay, dayRange, isCalendarDate } from "../civil-time/index.mjs";
import { tasksOf } from "../tasks/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { queueProducersOf } from "../queue-producers/index.mjs";
import { noticeProducersOf } from "../notice-producers/index.mjs";
import { investigationOf } from "../investigation/index.mjs";
import { affordancesOf, deriveActs, decorate, PER_ITEM_ACTS, PER_ITEM_MAX } from "../affordances.mjs";
import { QUEUE_CONDITION_KINDS, QUEUE_FINDING_KINDS, catalogueIdOf, classOfKind, MUTE_REFUSAL_DETAIL,
         PERSONALLY_MUTABLE_CLASSES, itemClassOf, mutedAsItem, serializeMutedKinds, parseMutedKinds,
         parseMutedAt, serializeMutedAt, suppressedBy } from "../queuestate.mjs";
import { QUEUE_SCHEMA, QUEUE_TABLES, queueOwns } from "./schema.mjs";
import { QUEUE_MINT_CHECKS, QUEUE_ACT_CHECKS, queueRefusal } from "./checks.mjs";

export { QUEUE_SCHEMA, QUEUE_TABLES, queueOwns } from "./schema.mjs";
export { QUEUE_MINT_CHECKS, QUEUE_ACT_CHECKS } from "./checks.mjs";

/* R48 (N301, K356; DEC-107, DEC-110, DEC-131; K1038, K1536): how each class is shown to members. The codes are
   unchanged; the words are these, and no member-facing sentence this module answers calls a to-do an "obligation", or a
   status item a "condition" or a "signal" ("obligation" names only a public body's duty, DEC-107). */
export const QUEUE_CLASS_LABELS = Object.freeze({ OBLIGATION: word("mark.kind.todo.name"), FINDING: word("mark.kind.noticed.name"),
                                                  CONDITION: word("mark.kind.status.name") });

/* R54 (T48; N1047; DEC-226 (1); K3189): the sections a surface files kinds under instead of under a case, section id to
   its kinds. The words `queue.update.section` and `queue.update.section_says` are the interface's. Frozen through. */
export const QUEUE_SECTIONS = Object.freeze({ civicsmith: Object.freeze(["update-ready"]) });

/* R49 (DEC-110 (1); K1038): the orders the feed's `sort` names; absent or blank is DEC-110 (3)'s default. */
export const QUEUE_SORTS = Object.freeze(["added", "due", "case", "kind"]);

/* R6: a limit is clamped to 1–max; absent, blank or not a number, it is the default. */
const clampLimit = (limit, dflt, max) => {
  const n = limit === null || limit === undefined || limit === "" ? NaN : Math.floor(Number(limit));
  return Number.isFinite(n) ? Math.max(1, Math.min(max, n)) : dflt;
};

export class Queue {
  #host; #deps; #env; #clock;
  /* R94 (fix round 8, G116): the derivations made, by (member, viewer), each with the signature it was made under, and this
     module's own writes (its mutes, snoozes and decisions), which the record's write counter does not see. */
  #derived = new Map(); #ownWrites = 0;
  constructor({ host, storage, deps = {} } = {}) {
    this.#host = host;
    this.sql = storage.sql;
    this.#deps = deps || {};
    this.#env = (deps && deps.env) || {};
    this.#clock = deps && typeof deps.now === "function" ? deps.now : null;
  }

  /** The table pass: every table R36 names, created where it is absent. Idempotent. */
  migrate() {
    for (const stmt of QUEUE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";"))
      if (stmt.trim()) this.sql.exec(stmt);
    /* R55: a store made before the instants of a case's muted kinds were kept lacks their column; it is added, and the
       kinds muted before it answer no instant (`at: null`), never back-filled. */
    /* R59 (T51): likewise `snoozed_at`, the instant a snooze was made; R58 (T51): likewise the item mutes' `item_kind`,
       `item_title` and `item_subject`, each null for a row made before it was kept. */
    for (const [table, column] of [["queue_state", "muted_at"], ["queue_state", "snoozed_at"], ["queue_item_mutes", "item_kind"],
                                   ["queue_item_mutes", "item_title"], ["queue_item_mutes", "item_subject"]]) {
      const have = this.#rows(`PRAGMA table_info(${table})`).map((c) => c.name);
      if (have.length && !have.includes(column)) this.sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT`);
    }
  }

  /* ------------------------------------------------------------------ the providers (Uses), reached lazily */
  #dep(name, make) {
    if (!(name in this.#deps) || this.#deps[name] === undefined) this.#deps[name] = make();
    return this.#deps[name];
  }
  get #record() { return this.#dep("record", () => recordOf(this.#host)); }
  get #membership() { return this.#dep("membership", () => membershipOf(this.#host)); }
  get #tasks() { return this.#dep("tasks", () => tasksOf(this.#host)); }
  get #projectRoster() { return this.#dep("projectRoster", () => projectRosterOf(this.#host)); }
  get #connections() { return this.#dep("connections", () => connectionsOf(this.#host)); }
  get #progressions() { return this.#dep("progressions", () => progressionsOf(this.#host)); }
  get #bias() { return this.#dep("bias", () => biasOf(this.#host)); }
  get #affordances() { return this.#dep("affordances", () => affordancesOf(this.#host)); }
  /* queue-producers R8, handed the providers a caller gave this module (a test's fakes), each else its own. */
  get #producers() {
    return this.#dep("producers", () => queueProducersOf(this.#host, Object.fromEntries(
      Queue.PRODUCER_DEPS.filter((k) => this.#deps[k] !== undefined).map((k) => [k, this.#deps[k]]))));
  }
  static PRODUCER_DEPS = Object.freeze(["record", "membership", "governor", "provenance", "capture", "captureRequests",
    "basisVersions", "progressions", "aiRuns", "bias", "publication", "corpusExport", "reevaluation", "intent", "monitoring",
    "contradiction",
    /* queue-producers R15–R19 (K608, K728; K899 (7)): the Action layer's providers, `actions` for R19's holds; from T45
       `action-producers`' (its R1–R8, K2781 (1)), which `queue-producers` builds over these same deps. */
    "actionClocks", "escalation", "actionPlans", "actions",
    /* T45 (action-producers R5, R9, R10, R12): the hold read moved to `action-holds`, the watch question `following`'s,
       the take-ups and review days `plan-work`'s; queue passes them and calls none of their reads. */
    "actionHolds", "following", "planWork",
    /* queue-producers R20, R21 (K921): the review requests and the facts due; queue passes them and calls neither. */
    "filingTemplates", "localFacts",
    /* queue-producers R2 (N483) and R27 (DEC-111): corpus-export's export log; network-notices' notices of a project. */
    "networkNotices",
    /* queue-producers R26 (N506, K1181): link-sweep's sweep conditions (its R11), since the sweep left monitoring. */
    "linkSweep",
    /* queue-producers R30 (N520, DEC-116): docket's required core (its R9); queue passes it and calls none of its reads. */
    "docket",
    /* queue-producers R35 and R32, R33 (N545; plane R20's hand-off): case-import's followed dockets, wizard-scripts'
       breaks and submissions; queue passes them and calls none of their reads. */
    "caseImport", "wizardScripts",
    /* queue-producers R37 (K2484, K2582): publish-schedule's scheduled editions, read there directly since N823's split;
       queue passes it and calls none of its reads. */
    "publishSchedule",
    /* queue-producers R60, R61 (T53; PR 362): ai-accounts' stopped accounts and ai-use's re-testing turned off; queue passes
       them and calls none of their reads. */
    "aiAccounts", "aiUse"]);
  get #scheduler() { return this.#dep("scheduler", () => schedulerOf(this.#host, this.#env)); }
  /* R51 (T33-83): `notice-producers`, read beside `queue-producers`. */
  get #notices() { return this.#dep("notices", () => noticeProducersOf(this.#host)); }

  /** R21, R22 (K1444 (iii)): the instance profile's time zone, or null when none is held: the caller's `deps.zone`, else
   *  scheduler's `viewZone` over record-core's active jurisdiction profiles. Never throws; never the UTC day in its
   *  place. */
  #zone() {
    try {
      const z = typeof this.#deps.zone === "function" ? this.#deps.zone() : viewZone(this.#record);
      return typeof z === "string" && z.trim() ? z.trim() : null;
    } catch { return null; }
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /** R53: the clock a caller of `queueOf` supplied (null while none has), and its adoption from the first later caller
   *  that supplies one; `queueOf` refuses a different one before calling this. */
  get clock() { return this.#clock; }
  adoptClock(fn) { if (this.#clock === null && typeof fn === "function") this.#clock = fn; }

  /** R93 (G80), R94: the number of writes this module made itself (a mute, a snooze, a decision), which the record's write counter
   *  does not see: they are kept in this module's own tables. Part of the derivation's signature beside record-core's counter. */
  #wrote() { this.#ownWrites += 1; }
  /** R94: the tasks the derivation asks `tasks` for: the largest a list's limit could reach (500, R6) twice over, so the one
   *  derivation serves every limit and the count, which is the length of the list with no cut. */
  static QUEUE_TASKS_READ_MAX = 1000;
  /** R94: a copy of a derivation, or of a part of one, that an answer may hand out and its caller change. */
  static #copyOf(v) { return structuredClone(v); }
  /** R94, R-LOG (K4428): runs the derivation `fn` and states what it cost in rows: the sum of the `rowsRead` and `rowsWritten`
   *  of every cursor the storage's SQL handed out meanwhile (the platform's own counters, so no clock in it, R-CLOCK), each
   *  null when the runtime states none, never a made-up number. The storage's `exec` is wrapped only for the call, and put
   *  back whatever it does; a storage that cannot be wrapped states null. One log line carries the figures. */
  #measured(fn) {
    const cursors = [];
    const sql = this.sql;
    let restore = null;
    try {
      const real = sql.exec;
      if (typeof real === "function") {
        const had = Object.prototype.hasOwnProperty.call(sql, "exec");
        sql.exec = function (...a) { const c = real.apply(sql, a); cursors.push(c); return c; };
        restore = () => { if (had) sql.exec = real; else delete sql.exec; };
      }
    } catch { restore = null; }
    let out;
    try { out = fn(); } finally { if (restore) { try { restore(); } catch { /* left as wrapped is harmless: it passes through */ } } }
    if (out && out.ok === true) {
      const sum = (key) => {
        let n = 0, any = false;
        for (const c of cursors) { const v = c ? c[key] : undefined; if (typeof v === "number" && Number.isFinite(v)) { n += v; any = true; } }
        return any ? n : null;
      };
      out.measure = { rows_read: sum("rowsRead"), rows_written: sum("rowsWritten"), ...out.measure };
      try { console.log(JSON.stringify({ event: "queue_derive", module: "queue", ...out.measure, items: out.items.length })); } catch { /* logged where it can be */ }
    }
    return out;
  }
  /** R93, R94: a derivation is reused for the same viewer while the record's write counter, this module's own writes and the
   *  clock's bucket are all unchanged; the bucket bounds how stale a feed that depends on the clock (a date that passed, an
   *  item's age) can be. A snooze is read at each ask's own instant. */
  static QUEUE_COUNT_BUCKET_MS = 5000;
  /** R93, R94: viewers whose derivation is kept; past it the kept ones are dropped whole (a cache, never a record). */
  static QUEUE_COUNT_VIEWERS_MAX = 256;
  /** R93, R94: the signature a derivation was made under, or null when the record states no write counter (record-core R90):
   *  with none, nothing is reused, never guessed. */
  #countSignature(now) {
    let w;
    try { w = typeof this.#record.writeCount === "function" ? this.#record.writeCount() : null; } catch { w = null; }
    if (!Number.isInteger(w) || w < 0) return null;
    return `${w}|${this.#ownWrites}|${Math.floor(now / Queue.QUEUE_COUNT_BUCKET_MS)}`;
  }

  /** The instant this read or act is at: an in-plane caller's (ms), else this module's clock (R53: the clock a caller of
   *  `queueOf` gave, else the instance binding `BIO_NOW_MS`, else the wall clock). A request never supplies the first:
   *  `op=queue`'s route passes none. An ABSENT param is null (or "") and falls through, never to the epoch; a clock
   *  answering no finite instant reads the wall clock. */
  #nowMs(explicit) {
    if (explicit !== undefined && explicit !== null && explicit !== "") {
      const e = Number(explicit);
      if (Number.isFinite(e) && e >= 0) return e;
    }
    if (this.#clock) {
      let t;
      try { t = Number(this.#clock()); } catch { t = NaN; }
      return Number.isFinite(t) ? t : Date.now();
    }
    const v = Number(this.#env && this.#env.BIO_NOW_MS);
    if (Number.isFinite(v) && v >= 0) return v;
    return Date.now();
  }

  /* ------------------------------------------------------------------ the providers' services, by the names the moved
     code already used (connections R22; membership R44, R55, R76, R77) */
  #refEdgeSevered(...a) { return this.#connections.edgeSevered(...a); }
  #positionalMember(...a) { return this.#membership.positionalMember(...a); }
  #existenceAct(...a) { return this.#membership.existenceAct(...a); }
  #projectAuthority(...a) { return this.#membership.projectAuthority(...a); }

  /* R27's reason bound: progressions R21's words ("over 160 characters, or a quotation mark, backslash or line
     break"), which the project arm asks as the progression arm does. */
  static EDGE_REASON_MAX = 160;


  /* ========================= REC-20 · op=queue =======================   *
   * ONE read, ONE contract, over the two producers that already exist: an
   * OBLIGATION is a row in `tasks` (D-98's routed work) and a FINDING is an
   * aggregated proposal from `proposalsFeed` (D-79's derived question). Before
   * this op a member had to open two surfaces and reconcile them by eye, and
   * neither could say WHICH CASE a thing belonged to. D-140 and SB-CORE
   * GAP-Q1/GAP-Q3; the queue is the one surface every member opens by habit.
   *
   * THE LOAD-BEARING SHAPE, and it is DEC-16 (Bob, 2026-08-02, answering his
   * own DEC-10): **the unit of state is the EVENT, not the (member, case)
   * entry — one state, N homes.** `case` is populated with EVERY ANCESTOR over
   * a bounded walk of the basis/citation edges, so a fact about a document
   * reaches everyone standing on it; and because the state lives on the event,
   * an event appearing under several cases does NOT create several entries, so
   * DEC-10's "one standing entry per (member, case)" survives intact and one
   * resolution clears the item everywhere.
   *
   * NO NEW TABLE, AND THAT IS A FINDING RATHER THAN A SHORTCUT. DEC-16's shape
   * asks for state that is keyed by the event. Both producers ALREADY key it
   * that way: `tasks.status` lives on the task row (the event), and
   * `proposal_dispositions` is keyed by (progression_key, stage_key) — the
   * proposal's own identity — never by who read it or under which case. So the
   * carrier exists, the homes are DERIVED on read from the edges, and nothing
   * is stored that could go stale. (REC-21's `queue_state` is the PERSONAL
   * half — mute and snooze — and is deliberately a different table with a
   * different doctrine: muting is personal, resolving is a record act.)
   *
   * THE VIEWER POSTURE. This is a read that names bundle ids, so it takes the
   * D-15 gate through membership's `viewerPredicate`, the ONE compilation
   * point (membership R43), exactly as REC-25
   * stamped the other reads. An ancestor the caller may not see is NOT named,
   * and its absence is STATED rather than silently shortening the set — the
   * same honesty DEC-16 requires of an exhausted walk, for the same reason: a
   * quietly truncated home set is indistinguishable from nobody caring.
   *
   * CONDITION ARRIVED WITH REC-32 (2026-08-04), and HOLE-1 IS HALF CLOSED. It
   * was deferred here — declared, never stubbed — until there was a real
   * producer to declare, because emitting a stub would have built the second
   * half of a bridge. Three of NOTIFICATIONS.md's catalogue entries now derive
   * from facts the store ALREADY holds, on the same read and with no table and
   * no stored state: see the REC-32 block below. The remaining catalogue kinds
   * stay unbuilt, and that is a gap in the CATALOGUE (queuestate.mjs's
   * vocabularies name every kind) rather than a gap in this class.
   * ======================================================================== */

  /** The classes this producer EMITS. `class` is NOT NULL on the producer:
   *  queueFeed refuses to answer rather than hand a surface a classless item,
   *  which is the shape a `class TEXT NOT NULL` column would enforce if the
   *  feed were a table. It is not a table — it is derived on read — so the
   *  constraint is enforced here, at the one place items are minted.
   *
   *  THE ORDER IS THE RANK, and it is the doctrine's own: something a NAMED
   *  PERSON must do outranks something the RECORD noticed, which outranks a
   *  fact about OUR OWN MACHINERY. CONDITION is therefore last and was
   *  appended rather than inserted (REC-32). */
  static QUEUE_CLASSES = ["OBLIGATION", "FINDING", "CONDITION"];

  /** R91 (T51; L13): a stopwatch for the feeds of one ask, in milliseconds (two decimals) off `performance.now()` where the
   *  runtime has it, else the wall clock; never negative. It measures how long a read took and is no instant of the record,
   *  so it is no part of R53's clock. */
  static #stopwatch() {
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now();
    return { start: () => now(), since: (t0) => Math.max(0, Math.round((now() - t0) * 100) / 100) };
  }

  /** R6's order: something a named person must do outranks something the record noticed, which outranks a fact about
   *  our own machinery, then stable on id so the feed does not shuffle. It is the order AMONG EQUALS of every sort R49
   *  names (K1038). */
  static r6Order(a, b) {
    const rank = (c) => Queue.QUEUE_CLASSES.indexOf(c);
    return rank(a.class) - rank(b.class) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  /** R49 (DEC-110): the comparator for `order` ("" the default, else one of QUEUE_SORTS) at the instant `now`. Each
   *  sorts on one value of the item; an item without it goes after those with it, and items without it, and ties, keep
   *  R6's order among themselves.
   *    default, `case`  the item's nearest home ancestor (`case.ancestors`, the least depth, then id), ordered by that
   *                     depth, then that id; within one case R6's order is to-dos, then noticed, then status items, then id.
   *                     DEC-110 (3)'s default IS grouping by case; the two part when its collapsing (DEC-110 (2)) lands.
   *    `added`          newest first, by when the item arose: its `age.since`, else `now` less `age.ms`.
   *    `due`            soonest first, by its `due` (`YYYY-MM-DD`, queue-producers R25).
   *    `kind`           by class in R6's order, then kind. */
  static feedOrder(order, now) {
    const r6 = Queue.r6Order;
    const rank = (c) => Queue.QUEUE_CLASSES.indexOf(c);
    const on = (key, cmp) => (a, b) => {
      const ka = key(a), kb = key(b);
      if (ka === null || kb === null) return ka === kb ? r6(a, b) : (ka === null ? 1 : -1);
      return cmp(ka, kb) || r6(a, b);
    };
    const str = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    const nearest = (it) => {
      const anc = (it.case && Array.isArray(it.case.ancestors) ? it.case.ancestors : [])
        .filter((x) => x && typeof x.id === "string" && Number.isFinite(x.depth));
      return anc.length ? anc.reduce((m, x) => (x.depth < m.depth || (x.depth === m.depth && x.id < m.id) ? x : m)) : null;
    };
    const arose = (it) => {
      const age = it.age && typeof it.age === "object" ? it.age : {};
      const since = typeof age.since === "string" ? Date.parse(age.since) : NaN;
      if (Number.isFinite(since)) return since;
      return Number.isFinite(age.ms) ? now - age.ms : null;
    };
    /* R22 (K1444 (iii)): a `due` is a local day as its producer wrote it, so it is read as a calendar date
       (`civil-time.isCalendarDate`) and compared as one, never parsed as a UTC midnight. */
    const due = (it) => (typeof it.due === "string" && isCalendarDate(it.due) ? it.due : null);
    switch (order) {
      case "added": return on(arose, (x, y) => y - x);
      case "due":   return on(due, str);
      case "kind":  return on((it) => it, (a, b) => rank(a.class) - rank(b.class) || str(String(a.kind), String(b.kind)));
      default:      return on(nearest, (x, y) => x.depth - y.depth || str(x.id, y.id));
    }
  }
  /** Declared, not stubbed. A class with no producer is named with the reason
   *  it is absent, so "not built yet" is distinguishable from "forgotten".
   *
   *  EMPTY as of REC-32, and the mechanism STAYS. CONDITION was its only entry
   *  and it has a producer now, so the entry was REMOVED rather than reworded —
   *  a deferral that outlives its own hole is a lie the next reader has to
   *  disprove. The block remains because the next class that arrives without a
   *  carrier must be declarable the same way. */
  static QUEUE_CLASSES_DEFERRED = {};
  /** R3's depth bound, applied to the ancestor walk. The basis graph is a DAG
   *  enforced at write (REC-11), so a walk terminates by construction — but
   *  "terminates" is not "terminates inside a Durable Object's CPU budget",
   *  and R3 requires derivation to carry a bound whose EXHAUSTION is reported
   *  as `undetermined` rather than as a failure or as a silent truncation.
   *  Six: deep enough that a real chain of questions resting on questions is
   *  covered whole (the corpus's own worked example is three), shallow enough
   *  that a pathological chain reports undetermined instead of burning the
   *  read. REC-12's read-time derivation takes THIS constant when it lands, so
   *  the record has one bound and not two. */
  static QUEUE_ANCESTOR_DEPTH = 6;
  /** Which object types can BE a case — the grouping key is a bundle id and it
   *  is an inquiry or a project, never a document. Consulted through
   *  normalizeType (REC-10's MAP RULE) so a legacy `focus`/`problem` spelling
   *  groups identically to a canonical `inquiry` one. */
  static QUEUE_CASE_TYPES = ["inquiry", "project"];
  /** How many subject bundles one FINDING derives its options from. An
   *  aggregated proposal spans N instances and therefore N documents; deriving
   *  acts over all of them would make one queue read O(corpus). */
  static QUEUE_OPTION_SUBJECTS_MAX = 8;
  /** D-266. How many RECORDED DISPOSITIONS `op=queue` publishes beside the open
   *  feed, before the publication itself reports that it was cut.
   *
   *  IT IS A BOUND ON A PUBLICATION AND NOT ON A DERIVATION, and saying which
   *  matters here: `proposalsFeed` already reads `proposal_dispositions` whole
   *  in order to AGE the open feed, so nothing is scanned twice and no work is
   *  amplified by this block. What the bound protects is the ANSWER — REC-57's
   *  discipline applied to a collection that grows with every act a member
   *  takes, on an op whose other collections are all bounded. Sixty-four, the
   *  same figure the shared-inquiry reads use: a member with more than sixty
   *  four standing decisions is reading a register rather than a queue, and
   *  `op=proposals` is the op that answers that question without a cap. */
  static QUEUE_DISPOSED_MAX = 64;
  /** R39: the window and the bound of the `resolved` block (the same sixty-four as `disposed`). */
  static QUEUE_RESOLVED_WINDOW_DAYS = 30;
  static QUEUE_RESOLVED_MAX = 64;
  /** R18: the lead's set-aside, added at the mint where its disposition is known (its take-up is queue-producers R9's). */
  static LEAD_SET_ASIDE = Object.freeze({ id: "proposedispose", label: word("queue.label.set_aside_project"),
                                          weight: "per-item" });

  /** One step UP the graph from a node: the edges an ancestor is reached by.
   *
   *  TWO edge kinds, because a case reaches a document two ways. `inquiry_basis`
   *  (REC-11) carries "this inquiry RESTS ON that target", indexed on target_id
   *  — the reverse index restingOn() already reads. `refs` with rel `cites`
   *  carries "this bundle CITES that target", which is how a project holds the
   *  documents and questions it is working on. Both are read at their target
   *  index, so a step is two indexed lookups and not a scan.
   *
   *  D-267 — A WITHDRAWN EDGE IS NOT A STEP, AND THE RULE IS CONSUMED RATHER
   *  THAN RESTATED. Both tables are PROJECTIONS of `references[]` and both DROP
   *  `status`, so a project that recorded `status: severed` still has its row in
   *  each — and this walk, reading the tables alone, kept it as a home for every
   *  item filed under the question it withdrew from. The plane already held the
   *  opposite rule one op over (`versionAct` refuses `VERSION_CURRENT_UNRELATED`
   *  for exactly that project, and `#projectsDrawingOn` reproduces it so the feed
   *  and the act agree about who is in the conversation), so the defect was never
   *  an undecided question. It is fixed HERE, at the walk, rather than in any one
   *  producer: a producer filtering its own homes would be a second
   *  implementation of the homes rule, which is the shape this repository has
   *  already lost a control to. The narrowing is `#refEdgeSevered`, the single
   *  predicate `#citesInto` and inquiry's `restsOnLive` also read, and BOTH edge kinds are
   *  confirmed — the basis half had the identical blindness and nothing had
   *  named it.
   *
   *  AN EDGE SURVIVES IF ANY OF ITS SPELLINGS IS LIVE. One document may reach one
   *  ancestor as a basis leg AND as a citation; withdrawing one of those is not
   *  withdrawing the other, so the confirmations are OR-ed and the home stays
   *  while any live edge remains. With `#refEdgeSevered`'s own two conservative
   *  arms — unreadable is live, unrecorded is live — the walk can only ever drop
   *  a home on a POSITIVE recorded withdrawal, never on a shape it failed to
   *  parse.
   *
   *  THE COST IS ONE DOCUMENT READ PER CANDIDATE EDGE, which is the price D-267
   *  costed against the alternative: teaching `refs` a `status` column would
   *  change a projection twelve readers and an export manifest build against,
   *  for a fact only the document can be authoritative about anyway (D-21). */
  #queueAncestorEdges(nodeId, memo = null) {
    if (memo && memo.edges.has(nodeId)) return memo.edges.get(nodeId);
    const up = new Map();
    const consider = (id, rel) =>
      up.set(id, (up.get(id) || false) || !this.#refEdgeSevered(id, nodeId, rel));
    for (const r of this.#rows(
      `SELECT DISTINCT bundle_id FROM inquiry_basis WHERE target_id=?`, nodeId))
      consider(r.bundle_id, null);
    for (const r of this.#rows(
      `SELECT DISTINCT bundle_id FROM refs WHERE target_id=? AND kind='cites'`, nodeId))
      consider(r.bundle_id, "cites");
    const out = [...up.entries()].filter(([, live]) => live).map(([id]) => id).sort();
    if (memo) memo.edges.set(nodeId, out);
    return out;
  }

  /** DEC-16's EVERY-ANCESTOR walk, bounded, viewer-gated, and honest about both
   *  ways it can come back incomplete.
   *
   *  Returns the SET of homes for one event, given the subject(s) the event is
   *  about. Breadth-first so `depth` means what it says; a `seen` set makes the
   *  walk cost linear in the edges actually reachable and makes a diamond
   *  (two questions resting on one document, both under one project) cost one
   *  visit rather than two.
   *
   *  WHAT IS AND IS NOT A HOME. The walk passes THROUGH every node it reaches
   *  but only ADMITS the case types (QUEUE_CASE_TYPES, via normalizeType) as
   *  homes: an information bundle that happens to cite another document is a
   *  waypoint, not a group header. Passing through it is deliberate — a
   *  question reachable only through a document is still a question that rests
   *  on the subject.
   *
   *  TWO WAYS TO COME BACK UNDETERMINED, both STATED and neither silent:
   *    - `depth_bound`: the frontier was still non-empty at the bound (R3).
   *    - `out_of_view`: an ancestor exists that this viewer may not see (D-15
   *      §7.9 filters PROJECT bundles). The id, the title, the state and even
   *      the COUNT are withheld — the count is the leak — but the FACT that the
   *      set is incomplete is reported, because a silently shorter set is
   *      exactly the "indistinguishable from nobody caring" failure DEC-16's
   *      truncation rule is about. The walk still passes THROUGH an invisible
   *      node: reaching a VISIBLE ancestor by way of an invisible one discloses
   *      nothing about the invisible one.
   *
   *  An EMPTY set with no reasons is UNGROUPED, and that is a real answer: an
   *  item nothing rests on sits ungrouped and is never given an invented home. */
  #queueAncestors(subjectIds, viewer, memo = null) {
    /* R91 (T51; L13): within one ask nothing is written, so a set of subjects has one answer: asked again (by another item of
       the same subject, or another producer) it is copied from the first, and the reads of a node's edges and of an
       ancestor's row are made once however many subjects reach it. */
    const mk = memo ? JSON.stringify([...new Set((subjectIds || []).filter((x) => typeof x === "string" && x))].sort()) : null;
    if (memo && memo.homes.has(mk)) {
      const h = memo.homes.get(mk);
      return { ...h, reasons: [...h.reasons], ancestors: h.ancestors.map((a) => ({ ...a })) };
    }
    const r = this.#walkAncestors(subjectIds, viewer, memo);
    if (memo) memo.homes.set(mk, { ...r, reasons: [...r.reasons], ancestors: r.ancestors.map((a) => ({ ...a })) });
    return r;
  }
  #walkAncestors(subjectIds, viewer, memo) {
    const bound = Queue.QUEUE_ANCESTOR_DEPTH;
    /* D-15 through the ONE compilation point. Fail closed: an absent or
       unrecognised viewer compiles to the deny predicate, so a caller that
       reached here without an identity groups under nothing rather than
       under everything. */
    const gate = viewerPredicate(viewer);
    const seen = new Set((subjectIds || []).filter((x) => typeof x === "string" && x));
    const found = new Map();
    const reasons = new Set();
    let frontier = [...seen];
    let depth = 0;
    while (frontier.length > 0 && depth < bound) {
      depth += 1;
      const next = [];
      for (const node of frontier) {
        for (const up of this.#queueAncestorEdges(node, memo)) {
          if (seen.has(up)) continue;
          seen.add(up);
          next.push(up);
          let row;
          if (memo && memo.rows.has(up)) row = memo.rows.get(up);
          else {
            row = this.#one(
              `SELECT b.bundle_id, b.object_type, b.current_state, b.title FROM bundles b
               WHERE b.bundle_id=? AND (${gate.sql})`, up, ...gate.args);
            if (memo) memo.rows.set(up, row);
          }
          if (!row) {
            /* Absent and invisible are indistinguishable TO THE CALLER (REC-25),
               but they are not the same fact and this producer must not report
               the wrong one: an edge whose target was purged is not an ancestor
               being withheld. The existence probe is internal — the store is a
               legitimate whole-corpus reader — and its answer never leaves this
               method except as the single word `out_of_view`. */
            if (this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, up))
              reasons.add("out_of_view");
            continue;
          }
          /* MAP RULE (REC-10, and REC-13's seam): every type and state
             consultation goes through the catalog's own vocabulary machinery,
             never a raw key — so a legacy `focus`/`problem` document groups
             exactly as a canonical `inquiry` one does. */
          const ty = normalizeType(row.object_type);
          if (!Queue.QUEUE_CASE_TYPES.includes(ty)) continue;   // a waypoint, not a home
          const spec = vocabFor(STATES, row.object_type);
          const edges = spec && spec.edges ? spec.edges : null;
          /* Is this case CLOSED? Three-valued on purpose: a state the machine
             does not name is UNDETERMINED, not terminal. DEC-16's own reasoning
             turns on whether an ancestor has been concluded, so a surface must
             be able to tell "no way out" from "we do not know". */
          const terminal = edges && Object.prototype.hasOwnProperty.call(edges, row.current_state)
            ? edges[row.current_state].length === 0 : null;
          found.set(row.bundle_id, {
            id: row.bundle_id, type: ty, title: row.title ?? null,
            state: row.current_state ?? null, terminal, depth });
        }
      }
      frontier = next;
    }
    /* EXHAUSTION IS REPORTED EXACTLY, not eagerly. Stopping with a non-empty
       frontier is not by itself a truncation: the last layer may simply have
       nothing above it, and reporting `undetermined` there would claim we do
       not know something we do. So the bound reports itself only when a node we
       never expanded genuinely HAS an unvisited ancestor — one extra indexed
       lookup per remaining node, and the difference between an honest
       undetermined and a reflexive one. */
    if (frontier.length > 0
        && frontier.some((n) => this.#queueAncestorEdges(n, memo).some((u) => !seen.has(u))))
      reasons.add("depth_bound");
    const ancestors = [...found.values()]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const state = reasons.size > 0 ? "undetermined" : "determined";
    return { state, ungrouped: state === "determined" && ancestors.length === 0,
             reasons: [...reasons].sort(), depth_bound: bound, ancestors };
  }

  /** DEC-16's event-state gate, asked of the EVENT and of nothing else.
   *
   *  A task's status IS the event's state: it lives on the task row, which is
   *  the event, and not on any (member, case) pairing. That is why one
   *  resolution clears the item under every ancestor without a second
   *  mechanism, and it is what the item's negative control breaks. */
  #queueEventLive(task) {
    return task && task.status !== "resolved";
  }

  /** The options a member may act on, DERIVED — never a copy, never invented.
   *
   *  REC-19 owns "what may be DONE to an object": ACTS + deriveActs over
   *  affordances' `affordanceFacts`, which is itself viewer-gated. This method
   *  calls THAT derivation and projects the three fields that survive the DO
   *  boundary; the control plane decorates them with `needs`, `mode` and
   *  `rung` from NEEDS/SESSION_OPS/RUNGS through the SAME function op=affordances
   *  uses, so a queue item's options and an affordances answer for the same
   *  subject and the same viewer are identical by construction rather than by
   *  agreement. A subject the viewer cannot see contributes nothing, and an
   *  empty list is the honest answer (REC-19's own posture for an `action`
   *  bundle: nothing operates it, so nothing is published).
   *
   *  Union order is ACTS order, preserved: a single-subject item's options are
   *  byte-for-byte op=affordances' `acts`. */
  #queueOptions(subjectIds, viewer, identity = null, memo = null) {
    const byId = new Map();
    /* D-311: the two act stamps `op=affordances` now sends (`author`, `by`), recovered from what the
       queue already carries so an item's options stay byte-for-byte that answer. A session's are its
       member; a bearer's viewer is its `class:<cls>` stamp — the roster stamp exactly, and a machine
       identity by the same predicate the author stamp's `token:<cls>` answers. Neither known: null,
       and a null narrows nothing and publishes no roster act. */
    const member = this.#positionalMember(viewer, identity);
    const actor = member !== null ? member : (isMachineIdentity(viewer) ? String(viewer).trim() : null);
    for (const id of (subjectIds || []).slice(0, Queue.QUEUE_OPTION_SUBJECTS_MAX)) {
      /* R91 (L13): a subject's acts are derived once per ask, whoever asks for them. */
      let acts = memo ? memo.acts.get(id) : undefined;
      if (acts === undefined) {
        const facts = this.#affordances.affordanceFacts({ target: id, viewer, identity, author: actor, by: actor });
        acts = !facts || facts.ok !== true ? [] : deriveActs(facts).map((a) => ({ id: a.id, label: a.label, weight: a.weight }));
        if (memo) memo.acts.set(id, acts);
      }
      for (const a of acts) if (!byId.has(a.id)) byId.set(a.id, { ...a });
    }
    return [...byId.values()];
  }

  /* ======================================================================
   * PL-13 — **WHAT IDENTITY A QUEUE ITEM CAN BE DISPOSITIONED ON, ANSWERED BY
   * THE PLANE AND PUBLISHED, INSTEAD OF BEING GUESSED AT A SURFACE.**
   *
   * UI-45 HANDED THIS OVER AND IT IS THE PLANE'S QUESTION. That item found a
   * live defect: `queueEntryControlsHtml` drew Adopt / Defer / Dismiss on EVERY
   * FINDING, while `op=proposedispose` is keyed on (`progression_key`,
   * `stage_key`) and refuses a pair that is not a real stage of a defined
   * progression. So on PL-15's `out-of-inquiry-lead` — whose basis carries
   * neither by design — all three controls could only ever have been refused.
   * UI-45's fix is the right SHAPE and its stated rule is the right rule: *ask
   * what identity the act is keyed on and whether THIS item carries it; do not
   * ask what kind it is.* Inverting rather than lengthening a list is what kept
   * that fix from going stale the day this item minted two new kinds.
   *
   * WHAT WAS STILL WRONG, AND IT IS WHY THIS IS PLANE-SIDE. The SURFACE was
   * answering it, by reaching into the item's `basis` and testing for two field
   * names it had learned from reading the plane's producers. That is a copy of
   * the plane's key living in a renderer — the drift class DEC-8 closed and the
   * one this codebase has paid for repeatedly. The moment a second disposition
   * key exists, or one producer spells the pair on `subject` while another
   * spells it on `basis`, the surface is wrong and nothing fails. **The act's
   * key is the act's own business, so the plane now says, on every item,
   * whether the item can be dispositioned and what the act would be keyed on.**
   *
   * **THE ANSWER TO THE QUESTION ITSELF, STATED PLAINLY: EXACTLY ONE IDENTITY
   * IS DISPOSITIONABLE TODAY — A DEFINED PROGRESSION'S REAL STAGE — AND THAT IS
   * TRUE OF THE CLASS AND NOT OF ANY KIND.** `proposal_dispositions` is keyed
   * `(progression_key, stage_key)`; `proposeDispose` refuses `NO_SUCH_PROGRESSION`
   * and `BAD_STAGE` against the definition tables. So a FINDING-class kind can
   * be dispositioned exactly when its item carries that pair — which today
   * means the two kinds `proposalsFeed` produces and nothing else. The lead
   * cannot. NEITHER OF THIS ITEM'S TWO NEW KINDS CAN, and that is now said out
   * loud on the item rather than discovered by a member clicking a button that
   * was always going to be refused.
   *
   * **WHAT THIS ITEM DELIBERATELY DID NOT DO, AND WHY IT IS NOT COWARDICE.**
   * Widening the act to take a generic item identity is a real option and it is
   * the wrong one to take from here. `proposal_dispositions`' primary key IS
   * the proposal's identity, so widening means a new key shape, a migration,
   * and a decision about what a disposition even MEANS for a kind that is
   * recomputed on every read — a dismissed stance-divergence would have to
   * un-dismiss itself when either project moves again, or it would silence a
   * fact that has since changed. That is D-222's grain problem, it is a
   * doctrine question about what declining means for a derived finding rather
   * than a plumbing question, and it now has a row (**D-266**) instead of a
   * hurried answer. What IS this item's to do is stop the record implying an
   * act it will refuse — and that is what publishing the key does.
   * ====================================================================== */

  /** The identity `op=proposedispose` is keyed on, in ONE place, read by the
   *  publication below. A list of field names rather than a list of kinds: the
   *  kinds change every wave and this pair has not changed since REC-7. */
  static QUEUE_DISPOSITION_KEY = ["progression_key", "stage_key"];
  /** R39, R59 (T51; tasks R21; K4213): the history entry that resolved a task: the last `resolved`, or `resolved_undecided`
   *  (a task `taskresolve` put aside before anyone decided it; it carries no `resolved`), else null. */
  static resolvingEntry(history) {
    return [...(Array.isArray(history) ? history : [])].reverse()
      .find((h) => h && (h.event === "resolved" || h.event === "resolved_undecided")) || null;
  }
  /** R8: the task statuses an OBLIGATION is live in (N373). */
  static TASK_LIVE_STATUSES = Object.freeze(["open", "forwarded"]);
  /** R12, R28 (K607, K608): the door an OBLIGATION not held in `tasks` leaves by, by kind; every other obligation is a
   *  task (taskresolve). The Action layer's four: a checkpoint is judged (action-plans R16), a proposed stage advanced
   *  or declined (escalation R13), a reminder answered (action-clocks R6), a litigation hold placed (action-holds R2,
   *  was actions R52; K899 (7); its release, action-holds R5, the other answer, named in its detail); T45's three: a
   *  watch kept or stopped (following R25), a plan's review recorded (plan-work R4), a paused plan resumed (action-plans
   *  R40); K921's two: a template version reviewed
   *  (filing-templates R9), a local fact confirmed (local-facts R1); a credit level chosen (publication R17;
   *  queue-producers R23, DEC-102 item 3); and (R50, DEC-116 item 2) the docket's core item placed or declined, two
   *  doors. The contradiction duties' doors are R46's, read off the item's subject (`#contradictionDisposition`); the
   *  bridge (R28), which holds no subject, answers the doors of a duty not yet taken up. A list is copied out
   *  (`doorOf`), never handed out frozen. */
  static OBLIGATION_DOORS = Object.freeze({ "bias-debt": "biasdebtresolve",
    /* R97 (T53; DEC-462): a signing-key item is answered per key, by the revoke (the door the screen leads with) or by
       "I know about this key"; the bridge names both. */
    "signer-self-registered": ["signerset", "signerknown"],
    "plan-checkpoint-due": "checkpointrecord", "escalation-stage-proposed": "escalationadvance",
    "action-reminder": "reminderanswer", "litigation-hold": "actionhold",
    "template-review-requested": "templatereview", "local-fact-due": "factconfirm",
    "attribution-unchosen": "attribute", "wizard-approval-requested": "wizardapprove",
    "inquiry-recheck-due": "waitlook",
    /* R52 (N820; steps R12, investigation R3): a step past the date its setter gave it leaves when the step is ended; a
       reminder on a step or a milestone is answered as `action-reminder`'s is, with another reminder or none. */
    "step-date-due": "stepend", "step-reminder": "stepreminder", "milestone-reminder": "milestonereminder",
    /* T45 (action-producers R10, R12; N855, N890): each is the op its owner serves for the act that makes it leave. */
    "watch-keep-or-stop": "watchanswer", "plan-review-due": "planreviewrecord", "plan-look-again": "planresume",
    /* R54 (N1047; DEC-226 (1)): a release ready to install is put aside until a date; updating or skipping it are the
       screen's, "See what changes" being the screen's too (machinery-producers R11). */
    "update-ready": "updatelater",
    /* R57 (T50; N1091, N1204; queue-producers R41, R42): an invitation is answered by joining the project (leaving it is the
       other answer, a member's own on the project), a request by the owners' answer. */
    "project-invitation": "projectjoin", "project-request": "projectrequestanswer",
    /* Fix round 10 (queue-producers R54; K5157): a request to leave a project is answered by an owner's removal of her. */
    "project-leave": "projectremove",
    "docket-core-due": Object.freeze(["docketprepare", "docketdecline"]),
    "contradiction-duty": Object.freeze(["contradictionclarify", "contradictiontakeup"]),
    "contradiction-duty-unseen": Object.freeze(["contradictionoptin"]) });
  /** R12 (T51; C62, K4171): the door a producer declared on an item it minted, or null: `door` is an op name, or a non-empty
   *  list of op names, the first the one the screen leads with. Anything else (blank, a list holding a non-name, a
   *  non-string) declares nothing. A list is copied. */
  static declaredDoor(door) {
    if (typeof door === "string") return door.trim() ? door.trim() : null;
    if (Array.isArray(door) && door.length > 0 && door.every((d) => typeof d === "string" && d.trim()))
      return door.map((d) => d.trim());
    return null;
  }
  /** The door R12 and R28 name for an OBLIGATION of `kind`: the door its producer declared on the item (`declared`, R12),
   *  else its entry above (a list copied), else `taskresolve`. */
  /** R97: the keys a signing-key item lists, `basis.keys`' `key_b64` in order, each once; none when the producer listed none. */
  static signerKeysOf(item) {
    const listed = item && item.basis && Array.isArray(item.basis.keys) ? item.basis.keys : [];
    const out = [];
    for (const k of listed) {
      const b = k && typeof k === "object" && typeof k.key_b64 === "string" ? k.key_b64.trim() : "";
      if (b && !out.includes(b)) out.push(b);
    }
    return out;
  }
  /** R97: a signing-key item's options are the producer's per-key pair (R34), kept only for a key the item lists and only
   *  the two acts, each once per key, so they number at most twice the keys listed; the revoke states `to: "revoked"`. */
  static SIGNER_ACTS = Object.freeze(["signerset", "signerknown"]);
  static signerOptionsOf(item) {
    const keys = Queue.signerKeysOf(item);
    const seen = new Set();
    const out = [];
    for (const o of Array.isArray(item.options) ? item.options : []) {
      if (!o || typeof o !== "object" || !Queue.SIGNER_ACTS.includes(o.id) || typeof o.key !== "string" || !keys.includes(o.key)) continue;
      const k = `${o.id}\u0000${o.key}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(o.id === "signerset" ? { ...o, to: "revoked" } : { ...o });
    }
    const at = (o) => keys.indexOf(o.key) * 2 + Queue.SIGNER_ACTS.indexOf(o.id);
    return out.sort((a, b) => at(a) - at(b));
  }
  static doorOf(kind, declared) {
    const own = Queue.declaredDoor(declared);
    if (own !== null) return own;
    const d = Object.prototype.hasOwnProperty.call(Queue.OBLIGATION_DOORS, kind) ? Queue.OBLIGATION_DOORS[kind] : null;
    return Array.isArray(d) ? [...d] : d || "taskresolve";
  }
  /** R28 (N527): the class segments of the contradiction duties' published ids (queue-producers R4, R7), each the
   *  duty's kind; the segment names the candidate's family, not a kind, because the producer keys an item by its
   *  candidate whatever its class. */
  static CONTRADICTION_DUTY_SEGMENTS = Object.freeze({ "contradiction": "contradiction-duty",
    "contradiction-unseen": "contradiction-duty-unseen" });
  /** R26, R28: the kind of an OBLIGATION published under its own class segment, or null: `OBLIGATION::<kind>::<rest>`
   *  for a catalogued OBLIGATION kind, or a contradiction duty's `OBLIGATION::<segment>::<candidate>` with a non-blank
   *  candidate. Anything else, an id of any other class included, is null. */
  static obligationKindOfId(id) {
    const m = typeof id === "string" ? /^OBLIGATION::([^:]*)(?:::(.*))?$/s.exec(id.trim()) : null;
    if (!m) return null;
    const [, seg, rest] = m;
    if (classOfKind(seg) === "OBLIGATION") return seg;
    return Object.prototype.hasOwnProperty.call(Queue.CONTRADICTION_DUTY_SEGMENTS, seg)
           && typeof rest === "string" && rest.trim() ? Queue.CONTRADICTION_DUTY_SEGMENTS[seg] : null;
  }
  /** R12: what each of those doors is, said on the item's disposition after the general sentence. */
  static OBLIGATION_DOOR_DETAIL = Object.freeze({
    "bias-debt": localize("queue.index.this_one_is_a_bias", " This one is a bias debt, which is keyed by the RUN it is about rather than by a task, so it is settled through op=biasdebtresolve with a stated reason — or by a re-run under the lens now in force, or by the lens moving back (BOB #32, 2026-09-23)."),
    "signer-self-registered": localize("queue.index.this_one_is_a_signing", " This one is a signing key a member registered for themselves, which is keyed by the KEY rather than by a task, so it leaves when an administrator says they know of the key (op=signerknown) or revokes it (op=signerset), or when it is otherwise no longer active."),
    "plan-checkpoint-due": localize("queue.index.this_one_is_a_checkpoint", " This one is a checkpoint your team set in an action plan, keyed by the plan, scenario and phase rather than by a task: it leaves when a member records whether its condition was met (op=checkpointrecord), or when the plan is closed."),
    "escalation-stage-proposed": localize("queue.index.this_one_is_an_escalations", " This one is an escalation's next stage, proposed because its trigger was met and keyed by the escalation and the stage rather than by a task: a member advances it (op=escalationadvance) or declines it with a reason (op=escalationdecline), and it also leaves when the escalation is suspended or ended."),
    "action-reminder": localize("queue.index.this_one_is_a_reminder", " This one is a reminder you asked for on one of the team's action deadlines, keyed by the action, the entry and the day rather than by a task: you answer it with another reminder or with none (op=reminderanswer), and it also leaves when the entry is no longer pending or the action is closed."),
    "litigation-hold": localize("queue.index.this_one_is_a_reply", " This one is a reply your team marked as legal pressure, keyed by the action and the entry rather than by a task: it leaves when a member records the hold in place or released, with a reason: in place by placing it (op=actionhold), released by releasing it (op=actionholdrelease), its own act. A legal mark on a docket entry, or a legal pressure record, is keyed by the mark instead, and leaves the same way."),
    "template-review-requested": localize("queue.index.this_one_is_a_review", " This one is a review a member asked of you on a filing template's version, keyed by the version and by you rather than by a task: it leaves when you review the version's present text (op=templatereview), or when the version is no longer in review."),
    "local-fact-due": localize("queue.index.this_one_is_a_holiday", " This one is a holiday calendar or office hours one of the team's deadlines reads, keyed by the fact rather than by a task: it leaves when a member confirms or corrects the fact (op=factconfirm), or when no live action reads it."),
    "attribution-unchosen": localize("queue.index.this_one_is_a_case", " This one is a case edition being prepared that reaches an observation you authored, keyed by the edition and the observation rather than by a task: it leaves when you choose a credit level for it (op=attribute), or when the edition no longer reaches it, or is signed or replaced."),
    "docket-core-due": localize("queue.index.this_one_is_an_item", " This one is an item the docket of a case you manage must list, keyed by the case, the item's kind and what it refers to rather than by a task: it stays until it is done, and it leaves when you place it on the docket (op=docketprepare prepares the entry) or, for a submission, decline it with a reason (op=docketdecline), or when it is otherwise placed, receipted or disclosed."),
    "wizard-approval-requested": localize("queue.index.this_one_is_a_wizard", " This one is a wizard script's version submitted for your approval, keyed by the version and by you rather than by a task: it leaves when you approve it (op=wizardapprove), or when the version is withdrawn or its script retired."),
    "inquiry-recheck-due": localize("queue.index.this_one_is_a_date", " This one is a date you set to look again at a question, keyed by the inquiry, the wait and the date rather than by a task, and it is yours alone: it leaves when you record that you looked (op=waitlook), set a new date or remove the wait in a revision of the inquiry, or when the inquiry concludes."),
    "step-date-due": localize("queue.index.this_one_is_a_date_2", " This one is a date you set on a step, keyed by the step and the date rather than by a task, and it is yours alone: it leaves when the step is ended (op=stepend), or when you set the step a new date."),
    "step-reminder": localize("queue.index.this_one_is_a_reminder_2", " This one is a reminder you asked for on a step's date, keyed by the reminder rather than by a task, and it is yours alone: you answer it with another reminder or with none (op=stepreminder), and it is told on its day only."),
    "milestone-reminder": localize("queue.index.this_one_is_a_reminder_3", " This one is a reminder you asked for on a milestone, keyed by the reminder rather than by a task, and it is yours alone: you answer it with another reminder or with none (op=milestonereminder), and it is told on its day only."),
    /* T45 (action-producers R10, R12; following R25, plan-work R4, action-plans R40). */
    "watch-keep-or-stop": localize("queue.index.this_one_is_a_watch", " This one is a watch a plan set running, asked about once because the plan closed or every promise it watched is met, keyed by the watch rather than by a task: it leaves when you answer it, keeping the watch until a date or stopping it (op=watchanswer), or when the watch ends. A watch relied on elsewhere is shown with no door."),
    "plan-review-due": localize("queue.index.this_one_is_a_review_2", " This one is a review day your team set for a plan, keyed by the plan and the day rather than by a task: it leaves when a member records a review of the plan (op=planreviewrecord), or when the plan is closed."),
    "plan-look-again": localize("queue.index.this_one_is_the_date", " This one is the date your team set to look again at a paused plan, keyed by the plan and the day rather than by a task: it leaves when a member resumes the plan (op=planresume) or closes it."),
    /* R54 (machinery-producers R11, instance-setup R89; DEC-226 (1)). */
    "update-ready": localize("queue.index.this_one_is_a_release", " This one is a release of your team's Civicsmith that is ready to install, one to-do for every administrator, keyed by the release rather than by a task: it leaves every administrator's list when any of them updates, skips the release or puts it aside until a date (op=updatelater), and when the running version is that release or newer. A newer release replaces it."),
    /* R57 (queue-producers R41, R42; membership's project acts). */
    "project-invitation": localize("queue.index.this_one_is_an_invitation", " This one is an invitation to a project, keyed by the invitation and by you rather than by a task: it leaves when you join the project (op=projectjoin) or leave it, or when the invitation is withdrawn."),
    "project-leave": localize("queue.index.this_one_is_a_participants", " This one is a participant's request to leave a project you own, keyed by the project and the participant rather than by a task: it leaves when an owner removes them (op=projectremove), or when they withdraw the request."),
    "project-request": localize("queue.index.this_one_is_a_members", " This one is a member's request to join a project you own, keyed by the request rather than by a task: it leaves when an owner grants or declines it (op=projectrequestanswer), or when it is withdrawn."),
    /* T34-53 (tasks R3, R14, R15; DEC-135): a task like any other, so its door is taskresolve, which closes only this
       member's own; taking it and recording the check are its other ways out. */
    "check-requested": localize("queue.index.this_one_is_a_check", " This one is a check a project owner asked for: take it (op=checktake) and record your check or a reasoned concern (op=checkrecord), which closes it; leaving it (op=taskresolve) closes only yours, and it stays open to the others asked. Once someone takes it, everyone else's closes, naming who took it."),
  });

  /** R46, R50: the acts a project-scoped FINDING of these kinds names beside R12's disposition: a recorded re-evaluation
   *  answers what a finding rests on being marked wrong (N345), a case edition it rests on being withdrawn or
   *  contested (DEC-116 items 3, 7), or a case the group cites having a newer edition or a withdrawn one (N547;
   *  DEC-101 (3)). */
  static FINDING_ACTS = Object.freeze({ "side-corrected": Object.freeze(["reevaluationrecord"]),
    "edition-withdrawn": Object.freeze(["reevaluationrecord"]), "edition-contested": Object.freeze(["reevaluationrecord"]),
    "cited-newer-edition": Object.freeze(["reevaluationrecord"]),
    "cited-edition-withdrawn": Object.freeze(["reevaluationrecord"]),
    /* T33-83 (notice-producers R8; K1491, K1467): what the machine noticed is disposed of, or taken up as a member's
       hunch or hypothesis, and nothing else. */
    "interest-check-noticed": Object.freeze(["hypothesishold"]),
    "money-detector-noticed": Object.freeze(["hypothesishold"]),
    /* R52 (T41; N820; notice-producers R17): a find is accepted, held as a hypothesis, or answered by a step planned
       (question-explorer R5, steps); something that arrived after a step looked for it answers that step (steps R23); a
       quiet project's doors are investigation R18's: keep watching, close it with its gaps, or revise its objective's
       condition (intent R2), each the op a member sends (op-declarations R43). */
    "question-find": Object.freeze(["findaccept", "hypothesishold", "stepcreate"]),
    "step-later-found": Object.freeze(["stepend"]),
    "project-quiet": Object.freeze(["projectwatch", "projectclosewithgaps", "objectivecondition"]) });
  /** R12 (T40; N812, K2376 (2), K2394): the AI accounts' three kinds are told to whom they concern and no team's list
   *  holds them: an explore ask is answered by its own act, the other two are quieted by their recipient. */
  static ACCOUNT_DOORS = Object.freeze({ "explore-ask": "exploreapprove", "ai-limit-reached": "queuemute",
    "project-account-suspended": "queuemute",
    /* T53 (R1, R12; layer 11 reopen; notice-producers R33-R35): a threshold alert, a terms notice, an account that left a
       list and a project sign-in account that ended are facts about an account, told to whom they concern, as above. */
    "ai-threshold-reached": "queuemute", "ai-terms-notice": "queuemute", "ai-account-left-list": "queuemute",
    "ai-account-left-project-list": "queuemute", "ai-signin-ended": "queuemute" });
  /** R12 (T45; action-producers R9, R11; upper doubt 15): FINDINGs that no project-scoped decision answers, quieted by
   *  their recipient for themselves as a CONDITION is: a member who left is told to the project's owners, and its doors
   *  are the take-ups its options lead with. */
  static QUIETED_FINDINGS = Object.freeze(["member-left-items"]);
  /** R98 (T53; N1259; notice-producers R30, R31): a register's change and an import's end are told to whom they concern and
   *  disposed of by that recipient, as R57 gives `watched-changed`: no team decides them. */
  static REGISTER_NOTICES = Object.freeze(["register-changed-noticed", "register-import-done", "register-import-stopped",
    "register-import-failed"]);
  /** R52: the FINDINGs a member quiets for themselves when no project home holds them (a personal mute). */
  static MUTED_OUTSIDE_A_PROJECT = Object.freeze(["question-find"]);

  /** D-266 / IC-60 — THE SECOND IDENTITY, and the whole of what this item added.
   *
   *  **A DISMISSAL IS SCOPED TO THE KEY'S OWN SUBJECT** (the ruling, 2026-08-10,
   *  and like this row's first ruling it was not Bob's because the repository
   *  already answered it). DEC-16's instance-wide clearing is instance-wide
   *  BECAUSE ITS SUBJECT IS: a progression-stage finding is a fact about the
   *  SHARED record, so one act clearing it under every case is DEDUP and not
   *  judgment-suppression. A stance is expressly one project's own property (§7,
   *  D-216), a dismissal is a judgment-layer act, and R5 makes forks at the
   *  judgment layer legitimate — so one team's dismissal of a stance-scoped
   *  finding governs THAT TEAM'S feed and nothing else. That is exactly the
   *  boundary `#findingsStanceDiverged` already enforces by refusing to offer
   *  `op=versioncurrent` across projects, so the two rules never pointed opposite
   *  ways: THEY SCOPE BY SUBJECT.
   *
   *  **THE OTHER KEY WAS DELIBERATELY NOT WIDENED WHILE THIS ONE LANDED**, and
   *  that restraint IS the item rather than caution about it. Widening
   *  `proposal_dispositions`' own primary key to carry a project would have made
   *  a shared-record finding per-project too — erasing the distinction this
   *  whole item exists to draw, in the one edit that would have looked like
   *  finishing the job. */
  static QUEUE_DISPOSITION_KEY_SCOPED = ["project", "finding"];

  /** Does THIS item carry the identity the disposition act is keyed on?
   *
   *  Reads `subject` first and `basis` second because that is the order the
   *  producers write them, and takes the pair from EITHER — a producer that
   *  carried the pair on only one of the two would otherwise be undispositionable
   *  for a reason that is about spelling rather than about identity.
   *
   *  IT REPORTS THE KEY IT WOULD USE, not merely a boolean. A surface that has
   *  the key does not have to reconstruct it from two fields, and a suite can
   *  assert that the published key is the one the act actually accepts — which
   *  is the difference between a claim about the act and a measurement of it. */
  #dispositionOf(item) {
    const KEYED_ON = Queue.QUEUE_DISPOSITION_KEY;
    const SCOPED_ON = Queue.QUEUE_DISPOSITION_KEY_SCOPED;
    const pick = (o, k) => (o && typeof o === "object" && typeof o[k] === "string"
                            && o[k].trim() ? o[k].trim() : null);
    const pk = pick(item.subject, "progression_key") || pick(item.basis, "progression_key");
    const sk = pick(item.subject, "stage_key") || pick(item.basis, "stage_key");
    /* REC-211: the version the act now REQUIRES, taken off the item the producer already stamped
       (`proposalsFeed` writes it onto the subject) and never re-queried here — a second read would be
       a second answer to "which version is current", which is the one thing REC-184 consolidated. A
       number here, so a producer that carried none publishes null rather than a guess. */
    const dv = item.subject && typeof item.subject === "object"
               && Number.isInteger(item.subject.definition_version)
      ? item.subject.definition_version : null;
    const contradiction = this.#contradictionDisposition(item);
    if (contradiction) return contradiction;
    /* R96, R97 (T53; DEC-462; credentials R7, R83; queue-producers R56): one item per member lists her keys (`basis.keys`);
       each listed key is answered on its own, by "I know about this key" (op=signerknown) or the revoke (op=signerset), the
       key named by the field both ops take (`keyB64`). `keys` is one entry per listed key, in the list's order; a key only
       `basis.keys_more` counts has none. The top-level `acts` names the answer that ends a key (R96). */
    if (item.kind === "signer-self-registered") {
      const keys = Queue.signerKeysOf(item);
      return { available: keys.length > 0, op: "signerknown", scope: "key", keyed_on: ["keyB64"], key: null, acts: ["signerknown"],
               requires: ["keyB64"], instead: Queue.doorOf(item.kind, item.door),
               keys: keys.map((k) => ({ key_b64: k, acts: ["signerknown"], instead: "signerset" })),
               detail: localize("queue.index.an_administrator_who_knows_this", "an administrator who knows of this key says so (op=signerknown) and it leaves every administrator's list; revoking it (op=signerset) ends it too.") };
    }
    if (item.class === "OBLIGATION")
      /* REC-207: AND `instead` NAMES THE DOOR THIS ITEM ACTUALLY HAS. N375 (R12; J1): a self-registered signing key is
         keyed by the KEY, not a task, and leaves when an administrator revokes it (op=signerset, membership R26). `op=taskresolve` addresses rows in
         `tasks` by id; a bias-debt obligation is keyed by the RUN it is about and has no task row, so
         every bias-debt item published before this named a door it could not go through — the row's own
         headline. The kind decides, not a list of exceptions to keep in step: a producer whose items are
         resolved somewhere else will need its own answer here and will find this line when it does. */
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "an_obligation_is_resolved_not_disposed",
               instead: Queue.doorOf(item.kind, item.door),
               detail: localize("queue.index.a_to_do_is_something", "a to-do is something a named person must do for the record to proceed and it leaves every list when it is DONE (D-125, DEC-16). Setting it aside is not a narrower version of that act, it is a different one.{v1}", { v1: String(Object.prototype.hasOwnProperty.call(Queue.OBLIGATION_DOOR_DETAIL, item.kind)
                        ? Queue.OBLIGATION_DOOR_DETAIL[item.kind] : "") }) };
    if (item.class === "CONDITION")
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "a_condition_is_acknowledged_or_muted",
               instead: "queuemute",
               detail: localize("queue.index.a_status_item_is_a", "a status item is a fact about our own machinery, and the only thing a member does to it is acknowledge or QUIET it — personally, with the status item persisting and every other member still seeing it.") };
    /* R12 (N172): a newer capture affecting a member's reference is decided by that member through reevaluation's
       door (its R15): adopt the newer version, or keep the earlier one. Keyed on the notice, never on a project.
       K1035 (reevaluation R15, C-110.29 VERSION_ADOPT_NO_REASON): adopting takes a why and keeping's stays optional;
       the detail says so, and `requires` stays the notice R12 states. */
    /* T33-83 (notice-producers R4; K1481, DEC-94): a standing question's answer is told once to its author and to
       nobody else, so no team's list holds it and there is no team for a record act to speak for: its author quiets it
       for themselves, which is the whole of disposing of it (R30: the mute writes only their row). */
    if (item.kind === "standing-answer")
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "an_answer_told_to_you_alone_is_quieted", instead: "queuemute",
               detail: localize("queue.index.your_standing_questions_answer_is", "your standing question's answer is told to you once and to nobody else, so no team's list holds it and there is no team for a disposition to speak for. Quiet it for yourself (op=queuemute, naming this item) once you have read it; your question keeps running and a later run's new finds are told to you as a new item.") };
    /* R57 (T50; N1204; DEC-304; notice-producers R24): a watched item's change is told to its watcher alone, as a standing
       question's answer is: no team's list holds it, so its watcher quiets it for themselves (R30). */
    if (item.kind === "watched-changed")
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "a_watched_change_is_told_to_you_alone_and_quieted", instead: "queuemute",
               detail: localize("queue.index.something_you_watch_changed_and", "something you watch changed, and you alone are told: no team's list holds it and there is no team for a disposition to speak for. Quiet it for yourself (op=queuemute, naming this item) once you have read it; the watch goes on and a later change is told as a new item.") };
    /* T53 (R1, R12; layer 11 reopen; notice-producers R36): unconfirmed mail removed is told to its owner alone, as a
       standing question's answer is: no team's list holds it, so its owner quiets it for themselves (R30). */
    if (item.kind === "mail-cleared")
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "a_mail_notice_is_told_to_you_alone_and_quieted", instead: "queuemute",
               detail: localize("queue.index.unconfirmed_mail_of_yours_was", "unconfirmed mail of yours was removed, and you alone are told: no team's list holds it and there is no team for a disposition to speak for. Quiet it for yourself (op=queuemute, naming this item) once you have read it.") };
    /* R98 (T53; notice-producers R30, R31): a register's change or an import's end, disposed of as R57 gives watched-changed. */
    if (Queue.REGISTER_NOTICES.includes(item.kind))
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "a_register_notice_is_told_to_you_and_quieted", instead: "queuemute",
               detail: localize("queue.index.a_register_notice_is_told", "this tells you what happened to a register: a change to one you watch, or an import you began that ended. No team's list holds it and there is no team for a disposition to speak for. Quiet it for yourself (op=queuemute, naming this item) once you have read it; a later change or import is told as a new item.") };
    /* R12 (T40; N812): an explore ask, a limit reached and a suspended project account are facts about an account,
       told to its owners or the member it served; no team decides them. */
    if (Object.prototype.hasOwnProperty.call(Queue.ACCOUNT_DOORS, item.kind)) {
      const door = Queue.ACCOUNT_DOORS[item.kind];
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: door === "exploreapprove" ? "an_ask_is_answered_by_its_act" : "an_account_notice_is_quieted",
               instead: door,
               detail: door === "exploreapprove"
                 ? localize("queue.index.one_of_your_accounts_may", "one of your accounts may explore today, and the ask is yours as its owner: approve it (op=exploreapprove), or let the day pass and it lapses. No team's list holds it.")
                 : localize("queue.index.this_is_about_an_account", "this is about an account and is told to whom it concerns; no team's list holds it and there is no team for a disposition to speak for. Quiet it for yourself (op=queuemute, naming this item) once you have read it.") };
    }
    /* R12 (T45; action-producers R9): a member who left had items routed to them; the take-ups lead its options, so
       there is no finding for a team to decide, and its recipient quiets it once read. */
    if (Queue.QUIETED_FINDINGS.includes(item.kind))
      return { available: false, op: null, scope: null, keyed_on: KEYED_ON, key: null,
               reason: "a_departure_is_taken_up_not_disposed", instead: "queuemute",
               detail: localize("queue.index.this_tells_the_projects_owners", "this tells the project's owners that a member who left had items routed to them. There is nothing here for a team to set aside: take up the items you choose (the acts this item offers first), and quiet it for yourself (op=queuemute, naming this item) once you have read it.") };
    if (item.kind === "newer-capture-affects-reference") {
      const notice = item.subject && typeof item.subject.id === "string" ? item.subject.id : null;
      return { available: notice !== null, op: null, scope: "notice", keyed_on: ["notice"], key: notice,
               notice, acts: ["versionadopt", "versionkeep"], requires: ["notice"],
               detail: localize("queue.index.a_newer_capture_of_what", "a newer capture of what your reference is pinned to was graded as affecting it or as undetermined, and the choice is yours: adopt the newer version (op=versionadopt, which writes a new version of your reference and keeps the old one readable, and takes a why of up to 2,000 characters) or keep the earlier one (op=versionkeep, where a why is optional). Either closes this notice.") };
    }
    if (pk && sk)
      return { available: true, op: "proposedispose", scope: "instance", keyed_on: KEYED_ON,
               key: `${pk}::${sk}`, progression_key: pk, stage_key: sk,
               /* REC-211 / IC-273: THE ACT ALSO REQUIRES THE VERSION THIS FINDING WAS DERIVED
                  AGAINST, so it is published beside the key rather than left for a surface to go and
                  find. It is NOT part of `keyed_on`: the identity is still the pair, and a decision
                  is one row per pair whatever version it was taken against. Publishing it here is
                  what keeps the sentence below true — an act a member "can actually complete" is one
                  a surface holding this block has every argument for. */
               definition_version: dv,
               requires: ["definitionVersion"],
               detail: localize("queue.index.this_finding_carries_a_progression", "this finding carries a progression stage, the identity the disposition act is keyed on, so Adopt, Defer and Dismiss can be completed. Send `definitionVersion`, the version published here: a decision on a definition since revised is refused DEFINITION_MOVED (REC-211), and the act still checks the pair (NO_SUCH_PROGRESSION, BAD_STAGE). The scope is `instance`: a progression stage is a fact about the shared record, so one act clears it under every case (D-266, DEC-16).") };
    /* ==================================================================== D-266
     * THE PROJECT-SCOPED HALF, AND IT IS A PROPERTY RATHER THAN A LIST OF SLUGS.
     *
     * The test is the one UI-45 wrote and PL-13 kept: ask whether THIS item
     * carries the identity the instance-wide act is keyed on, never what kind it
     * is. A finding that carries the pair is a fact about the shared record. A
     * finding that carries NONE is a fact at the JUDGMENT layer — about a
     * document, a question, or what one team stands on — and §7 makes that one
     * project's own property. So it is dispositionable, and the act is keyed on
     * (project, finding) rather than being refused for want of an identity.
     *
     * WHY `key` IS NULL WHILE `available` IS TRUE, and it is the honest answer
     * rather than an omission: the ACTING PROJECT is the member's to name. This
     * item may be filed under several, and a plane that picked one would be
     * choosing which team's judgment the act records — the single shared stance
     * §7 rejected, arriving through a defaulted parameter. `projects` enumerates
     * the candidates and `requires` says what the caller must send.
     *
     * A FINDING FILED UNDER NO PROJECT AT ALL IS A THIRD ANSWER AND IS SAID AS
     * ONE. There is nothing for the dismissal to be scoped TO, so the act is
     * unavailable for a reason that names the missing scope rather than the
     * missing identity — a member reading `no_disposition_identity` there would
     * be told something that is no longer true.
     * ==================================================================== */
    const homes = (item.case && Array.isArray(item.case.ancestors) ? item.case.ancestors : [])
      .filter((a) => a && a.type === "project" && typeof a.id === "string" && a.id.trim())
      .map((a) => a.id.trim())
      .sort();
    const fid = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
    /* R46, R50: a side-corrected, edition-withdrawn, edition-contested, cited-newer-edition or cited-edition-withdrawn
       finding keeps this disposition and names the act that answers it. */
    const acts = Object.prototype.hasOwnProperty.call(Queue.FINDING_ACTS, item.kind)
      ? { acts: [...Queue.FINDING_ACTS[item.kind]] } : {};
    /* R52: a find filed under no project is quieted by its recipient for themselves (a personal mute). */
    const muted = Queue.MUTED_OUTSIDE_A_PROJECT.includes(item.kind);
    if (homes.length === 0 || !fid)
      return { available: false, op: null, scope: "project", keyed_on: SCOPED_ON, key: null,
               finding: fid, projects: [], ...acts,
               reason: "no_project_scope",
               instead: muted ? "queuemute" : null,
               detail: localize("queue.index.this_finding_carries_no_progression", "this finding carries no progression stage, so its disposition is one project's judgment, scoped to that team's feed (D-266, §7/D-216), and it is filed under no project you can see: there is no team to record a decision for. A decision, where one can be made, ages the finding out of the team's open list until it is re-triaged, and deletes nothing (D-79).{v1}", { v1: String(muted ? " Quiet it for yourself instead (op=queuemute, naming this item)." : "") }) };
    return { available: true, op: "proposedispose", scope: "project", keyed_on: SCOPED_ON,
             key: null, finding: fid, projects: homes, requires: ["project", "finding"], ...acts,
             detail: localize("queue.index.this_finding_carries_no_progression_2", "this finding carries no progression stage, so its disposition is a judgment-layer act, and a stance is one project's own property (§7, D-216): one team's decision governs that team's feed and no other (D-266). Send `project` (one of `projects`; `key` is null because the acting project is yours to name) and `finding` with your disposition and reason. The decision ages the finding out of that team's open list until it is re-triaged, and deletes nothing (D-79).") };
  }

  /** R46 (N345; DEC-76 item 3, DEC-84 items 2, 3, 7, 13; DEC-85): the doors of the contradiction kinds, or null for any
   *  other kind. What decides them is on the item's `subject`, as the producer names it (`queue-producers` R4, R7): a
   *  candidate's `state` and, once taken up, its `inquiry`; and `parties`, the member's party projects each with
   *  `opted_in`. `contradictionoptin` is offered while one of those has not opted in, and `contradictionrespond` once
   *  one has. A side-corrected item keeps R12's project-scoped disposition and names its act. */
  #contradictionDisposition(item) {
    const s = item.subject && typeof item.subject === "object" ? item.subject : {};
    const parties = Array.isArray(s.parties) ? s.parties.filter((p) => p && typeof p.project === "string") : [];
    const relay = [...(parties.some((p) => p.opted_in !== true) ? ["contradictionoptin"] : []),
                   ...(parties.some((p) => p.opted_in === true) ? ["contradictionrespond"] : [])];
    const candidate = typeof s.id === "string" && s.id.trim() ? s.id.trim() : null;
    const closed = (reason, extra, detail) => ({ available: false, op: null, scope: null,
      keyed_on: Queue.QUEUE_DISPOSITION_KEY, key: null, reason, candidate, ...extra, detail });
    const notSetAside = (acts, detail) => ({ available: false, op: null, scope: "project",
      keyed_on: Queue.QUEUE_DISPOSITION_KEY_SCOPED, key: null, finding: item.id ?? null, projects: [],
      reason: "a_plurality_is_not_set_aside", instead: null, candidate, acts, detail });
    switch (item.kind) {
      case "contradiction-duty": {
        const inquiry = s.state === "taken_up" && typeof s.inquiry === "string" && s.inquiry ? s.inquiry : null;
        const own = inquiry ? "contradictionresolve" : ["contradictionclarify", "contradictiontakeup"];
        return closed("an_obligation_is_resolved_not_disposed",
          { instead: relay.length ? [...[own].flat(), ...relay] : own, ...(inquiry ? { inquiry } : {}) },
          localize("queue.index.a_conflict_the_record_holds", "a conflict the record holds is a duty: it is never muted, dismissed or set aside, and it leaves every list only when a member of a project it reaches resolves it, by saying what it turned out to be or by taking it up as a question and concluding it (DEC-84 item 2)."));
      }
      case "contradiction-duty-unseen":
        return closed("an_obligation_is_resolved_not_disposed", { instead: relay.length ? relay : ["contradictionoptin"] },
          localize("queue.index.something_this_project_rests_on", "something this project rests on is in conflict with a record you cannot see. It is never muted: your project can ask to resolve it, and once every project holding a side has asked, the projects are named to each other and you can respond (DEC-85)."));
      case "contradiction-lead":
        return { available: true, op: null, scope: "candidate", keyed_on: ["candidate"], key: candidate, candidate,
                 acts: ["contradictiondismiss", "contradictiontakeup"], requires: ["candidate"],
                 detail: localize("queue.index.a_lead_is_the_records", "a lead is the record's uncertainty, not a to-do: a member dismisses it with a reason or takes it up as a question (DEC-84 item 1).") };
      case "contradiction-plurality":
        return notSetAside(["contradictionclarify", "contradictiontakeup", ...relay],
          localize("queue.index.two_projects_conclusions_may_not", "two projects' conclusions may not both hold. Setting it aside would not clear it: naming the difference does, or taking it up as a question (DEC-84 item 3)."));
      case "contradiction-plurality-unseen":
        return notSetAside(relay.length ? relay : ["contradictionoptin"],
          localize("queue.index.this_projects_conclusion_may_not", "this project's conclusion may not hold together with a conclusion you cannot see. It is not set aside: your project can ask to resolve it (DEC-85)."));
      case "tension-after-publication":
        return closed("a_published_tension_is_disclosed", { instead: "publish" },
          localize("queue.index.a_finding_this_case_published", "a finding this case published rests on a conflict found since. It leaves when a later edition discloses it or the conflict is resolved."));
      default:
        return null;
    }
  }

  /** queue-producers R8: every item that is not a task, homed by R7's walk and offered R12's options (both handed in),
   *  with the facts the answer publishes. */
  #feedItems(args) {
    return this.#producers.feedItems(args);
  }

  /** R60 (T51; DEC-330 A62): the feeds the answer was assembled from, each with the classes it can raise: `tasks` (R8),
   *  `queue-producers`' own feeds by the ids its R45 names, and `notice-producers` (R51). A feed that can raise a class and did
   *  not answer withholds that class's all-clear; the classes are the catalogue's (R1) for each feed's kinds, over-stated
   *  where a feed raises more than one, which only ever withholds an all-clear. */
  static QUEUE_FEEDS = Object.freeze([
    ["tasks", ["OBLIGATION"]], ["bias-debts", ["OBLIGATION"]], ["proposals", ["FINDING"]], ["shared-inquiries", ["FINDING"]],
    ["leads", ["FINDING"]], ["exports", ["FINDING"]], ["references", ["FINDING"]], ["objectives", ["FINDING"]],
    ["sources", ["FINDING"]], ["machinery", ["OBLIGATION", "CONDITION"]], ["contradictions", ["OBLIGATION", "FINDING"]],
    ["signing-keys", ["OBLIGATION"]], ["action", ["OBLIGATION", "FINDING", "CONDITION"]], ["attribution", ["OBLIGATION"]],
    ["docket", ["OBLIGATION", "FINDING"]], ["cited-cases", ["FINDING", "CONDITION"]], ["wizards", ["OBLIGATION", "FINDING"]],
    ["schedule", ["FINDING"]], ["places", ["CONDITION"]], ["projects", ["OBLIGATION"]],
    ["members", ["OBLIGATION"]], ["notice-producers", ["OBLIGATION", "FINDING"]]]);

  /** R60: one row `{feed, classes, answered, failed}` for each feed in QUEUE_FEEDS, then one for any other feed id the
   *  producers name. `facts` is `queue-producers`' (its R45: `failed` `[{feed, reason}]` and `absent` the feed ids no provider
   *  is composed for), `noticed` is R51's read. `answered` is true only when the feed's read returned and named no failure, and
   *  never when it is absent; `failed` is what the feed named: the reason codes of R45's entries, or `notice-producers`' failed
   *  producers. A read that said nothing of failure names none. A failure that names the read that refused (`read`) or its
   *  `code` (queue-producers R50) carries them onto its row; a row with no such failure has neither key. */
  #feedRows(facts, noticed, own = {}) {
    /* R91 (T51; L13): `ms`, the milliseconds the feed's read took: this module's own measure for `tasks` and `notice-producers`,
       `facts.ms[feed]` (queue-producers R45) for a producer's feed, and null where none is stated, never a made-up number. */
    const stated = facts.ms && typeof facts.ms === "object" && !Array.isArray(facts.ms) ? facts.ms : {};
    const msOf = (feed) => {
      const v = Object.prototype.hasOwnProperty.call(own, feed) ? own[feed] : stated[feed];
      return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    };
    const codes = new Map();
    const absent = new Set();
    const named = new Map();
    const note = (feed, code) => { if (typeof feed === "string" && feed) codes.set(feed, [...(codes.get(feed) || []), code]); };
    for (const e of Array.isArray(facts.failed) ? facts.failed : [])
      if (typeof e === "string") note(e, "failed");
      else if (e && typeof e === "object") {
        note(e.feed, typeof e.reason === "string" && e.reason ? e.reason : "failed");
        /* R60 (T51 fix round, B7): the read that refused and its code, as the producers name them (queue-producers R50), carried
           onto the feed's row; the first failure that names either one. */
        const why = {};
        if (typeof e.read === "string" && e.read) why.read = e.read;
        if (typeof e.code === "string" && e.code) why.code = e.code;
        if (typeof e.feed === "string" && e.feed && Object.keys(why).length > 0 && !named.has(e.feed)) named.set(e.feed, why);
      }
    for (const e of Array.isArray(facts.absent) ? facts.absent : []) {
      const feed = typeof e === "string" ? e : e && typeof e === "object" ? e.feed : null;
      if (typeof feed === "string" && feed) absent.add(feed);
    }
    const known = new Set(Queue.QUEUE_FEEDS.map(([f]) => f));
    const rows = [...Queue.QUEUE_FEEDS, ...[...new Set([...codes.keys(), ...absent])].filter((f) => !known.has(f))
      .sort().map((f) => [f, [...Queue.QUEUE_CLASSES]])].map(([feed, classes]) => {
      if (feed === "tasks") return { feed, classes: [...classes], answered: true, failed: [], ms: msOf(feed) };
      if (feed === "notice-producers")
        return { feed, classes: [...classes], answered: noticed.failed.length === 0 && noticed.absent !== true,
                 failed: [...noticed.failed], ms: msOf(feed) };
      const failed = codes.get(feed) || [];
      return { feed, classes: [...classes], answered: failed.length === 0 && !absent.has(feed), failed: [...failed], ms: msOf(feed),
               ...(named.get(feed) || {}) };
    });
    return rows;
  }

  /** R51: `notice-producers.noticeItems`, as `{items, facts, failed}`. Its contract is never to throw; were it to, the
   *  read is named failed whole rather than taking the feed down, and contributes no item. */
  #noticeItems(args) {
    const np = this.#notices;
    if (!np || typeof np.noticeItems !== "function") return { items: [], facts: {}, failed: [], absent: true };
    let r;
    try { r = np.noticeItems(args); } catch { return { items: [], facts: {}, failed: ["noticeItems"] }; }
    const facts = r && r.facts && typeof r.facts === "object" ? r.facts : {};
    const failed = Array.isArray(facts.failed) ? facts.failed.filter((x) => typeof x === "string") : [];
    return { items: r && Array.isArray(r.items) ? r.items : [], facts, failed };
  }

  /** R94 (fix round 8, G116): the one derivation of a viewer's feed at one instant: the tasks' OBLIGATIONs and the producers'
   *  and notices' items, minted (R11), with the project decisions (R13) and the member's mutes (R14) applied, and the figures
   *  every answer made from it needs (the disposed block's rows, the feeds' rows, the all-clear). It reads and writes nothing
   *  else; the list, the count and the bridge's reads are made from it. A refusal of the mint is returned as it is. */
  #derive({ me, viewer, now, identity }) {
    const items = [];
    /* R91 (L13): what this ask has already read, for its walks and its option derivations (nothing is written in an ask). */
    const memo = { edges: new Map(), rows: new Map(), homes: new Map(), acts: new Map() };
    const clock = Queue.#stopwatch();
    /* R56 (N1123): the title of the bundle a subject names, when the viewer may see it, else null; asked once per id, through
       the one gate (D-15), and never of a bundle this viewer may not see (R33). */
    const titleOf = this.#titleReader(viewer);

    /* ---------------------------------------------------- OBLIGATION · tasks
       REC-30: the CASE set was gated from birth (#queueAncestors) but the
       SUBJECT was not, and an obligation's subject is a bundle id — with the
       task's `subject_text` beside it. An item about a bundle this viewer may
       not see is withheld whole, the same posture op=tasks now takes: an
       obligation nobody may be told about is not an obligation this feed can
       carry, and a routed task on an invisible project reaches its assignee,
       who by construction can see it. Withheld silently and with no count, for
       the reason `mute` states its own suppressions and this cannot: a count
       here would say a project exists. */
    /* tasks R6: the visible OPEN or FORWARDED tasks, newest first, each as `taskList` gives it (N363). N373 (K566): the
       read asks for the live statuses itself, so however many tasks were resolved lately none of them takes a place an
       open one needs (it used to read every status and drop the resolved ones after the cap). */
    /* N410 (tasks R6's `assignees`): a member's read asks for their own and the unassigned tasks itself, so other
       members' live tasks never take a place theirs need; a machine credential (no member) reads every assignee. */
    const tTasks = clock.start();
    for (const row of this.#tasks.recentTasks({ viewer, limit: Queue.QUEUE_TASKS_READ_MAX, statuses: Queue.TASK_LIVE_STATUSES,
                                                ...(me ? { assignees: [me, "unassigned"] } : {}) })) {
      if (me && row.assignee !== me && row.assignee !== "unassigned") continue;
      const subject = row.refers_to;
      /* The homes are derived FIRST and the event's state is asked ONCE, for
         all of them. This ordering is the whole of DEC-16 in two lines: one
         state, N homes.
         NEGATIVE CONTROL (REC-20): replace the single event-keyed test below
         with a per-(member, case) one — keep the item alive under every home
         except the first, as a queue_state row keyed by (member, case) would —
         and a resolved event with two ancestors leaves a stale unresolved copy
         under the second. */
      const homes = this.#queueAncestors([subject], viewer, memo);
      if (!this.#queueEventLive(row)) continue;
      const createdMs = Date.parse(row.created);
      items.push({
        id: row.id,
        class: "OBLIGATION",
        kind: row.kind,
        case: homes,
        subject: { kind: "bundle", id: subject, title: titleOf(subject) },
        summary: row.subject ? row.subject.text : null,
        detail: row.subject && row.subject.description !== undefined ? row.subject.description : null,
        basis: { source: "tasks", refers_to: subject, routed_role: row.assignee_role,
                 status: row.status,
                 detail: localize("queue.index.a_to_do_is_a", "a to-do is a routed task: a named person must act for the record to proceed (D-98). refers_to points at the SUBJECT; case is derived.") },
        age: Number.isFinite(createdMs)
          ? { state: "determined", since: row.created, ms: Math.max(0, now - createdMs) }
          : { state: "undetermined", reason: "unparseable_created",
              detail: localize("queue.index.the_task_row_carries_a", "the task row carries a created stamp this producer cannot read as an instant") },
        assignee: row.assignee,
        assignee_role: row.assignee_role,
        ...(Queue.declaredDoor(row.door) !== null ? { door: Queue.declaredDoor(row.door) } : {}),
        options: this.#queueOptions([subject], viewer, identity, memo),
      });
    }

    const tasksMs = clock.since(tTasks);
    const fromTasks = items.length;

    /* ------------------------------------------- the producers (queue-producers R8; N363)
       Every item that is not a task comes from the producers' one read, handed this module's R7 walk and R12
       options so there is one walk and one derivation; its `facts` are published below (R6, R15). Pushed above the
       mint, like every producer, so the mint validates what it mints. */
    const tFeeds = clock.start();
    const produced = this.#feedItems({ member: me, viewer, now, identity,
      homesOf: (subjects) => this.#queueAncestors(subjects, viewer, memo),
      optionsOf: (subjects) => this.#queueOptions(subjects, viewer, identity, memo) });
    const feedsMs = clock.since(tFeeds);
    const facts = produced && produced.facts && typeof produced.facts === "object" ? produced.facts : {};
    const fromProducers = produced && Array.isArray(produced.items) ? produced.items.length : 0;
    items.push(...(produced && Array.isArray(produced.items) ? produced.items : []));
    /* R51 (T33-83): `notice-producers`' one read, beside them, handed the same walk and options, its items treated
       exactly as theirs (minted, homed, muted, decided and sorted below). It writes nothing and never throws (its R1),
       and a producer it names in `facts.failed` contributes no item; the answer states which (`notice_producers`). A
       closed gate is that module's alone to honour: nothing here re-judges what it raises. */
    const tNotices = clock.start();
    const noticed = this.#noticeItems({ member: me, viewer, now, identity,
      homesOf: (subjects) => this.#queueAncestors(subjects, viewer, memo),
      optionsOf: (subjects) => this.#queueOptions(subjects, viewer, identity, memo) });
    const noticesMs = clock.since(tNotices);
    items.push(...noticed.items);

    /* THE MINT, and PL-15 SWEPT IT FOR THE CLASS RATHER THAN ADDING TO IT.
     *
     * WHAT WAS HERE AND WHY IT WAS HALF A FENCE. REC-32 refused an uncatalogued
     * kind for CONDITION items ONLY, and its stated reason was that an
     * uncatalogued condition kind would produce an item no member could ever
     * mute. That reason is true and it is not the only one. A kind is the word
     * a SURFACE renders, a feed groups on and a member recognises across items,
     * and `queuestate.mjs`'s three vocabularies are the single authority on the
     * whole set — `op=affordances` publishes them and every term carries the
     * sentence a member reads (R1; `catalogue.test.mjs`' R1 test). So an
     * OBLIGATION or a FINDING minted under a kind no vocabulary names is
     * exactly as unrenderable as a CONDITION was, and it was reaching members.
     * PL-15 needed one new FINDING slug refused when it is misspelled, and
     * fixing only that would have left the class standing for the other two —
     * which is the shape this project's standing instruction names.
     *
     * TWO REFUSALS WHERE REC-32 HAD ONE, and the split is `classOfKind`'s own
     * three-valued answer finally being used. `null` means the catalogue does
     * not name this kind AT ALL — a typo, an `N-<n>` id from a design document,
     * a slug somebody invented at a producer. A NON-NULL answer that differs
     * from the item's class means the kind is real and FILED ELSEWHERE, which is
     * a different defect with a different fix, and it is the dangerous one: a
     * CONDITION kind minted as a FINDING would be unmuteable, and an OBLIGATION
     * kind minted as a CONDITION would be MUTEABLE — one member able to silence
     * a task the record believes reached a person. `queuestate.mjs` says in its
     * own header that unknown is not the same as wrong and that the refusals
     * must say which happened. Now they do.
     *
     * IT REFUSES THE WHOLE ANSWER rather than dropping the item. A feed quietly
     * one item shorter is indistinguishable from nobody caring, which is the
     * same argument the mute block below makes about reporting suppressions.
     *
     * AND IT RUNS **BEFORE** THE MUTE LOOP, WHICH IT DID NOT UNTIL PL-15. THIS
     * ORDER IS THE FENCE AND THE OLD ONE WAS A HOLE — found by RUNNING the
     * control rather than by reading the code, and it is the sharpest thing
     * this item did. The mute loop removes items from the feed, so an item a
     * member had muted never reached the mint at all. Now put those two facts
     * together: a FINDING minted under a kind the catalogue files as a
     * CONDITION is exactly what the mute's write fence WILL accept — the fence
     * is `classOfKind(kind) === "CONDITION"` and the kind IS one — so the
     * misclassed item could be muted, was then suppressed, and the mint that
     * exists to refuse it never saw it. The single worst case the class
     * distinction protects against, escaping through the one door that made it
     * reachable. Validating what a producer MINTS is a different question from
     * what survives one member's preferences, and it is asked first. */
    const refusal = (code, detail, extra) =>
      queueRefusal(code, QUEUE_MINT_CHECKS[code], { detail, ...(extra || {}) });
    for (const it of items) {
      /* DEC-49 REGION is-queue-mint
       *
       * THE SPAN `QUEUE_MINT_CHECKS`' rows name (REC-71). A REGION and not the
       * whole of `queueFeed`, which is several hundred lines of producers whose
       * later refusals must not be conscripted into this family by a `where`
       * that claims too much — and whose set would GROW with the function. The
       * helper sits ABOVE the marker so its own variable-coded return is not
       * inside the governed span, and every code below is a STRING LITERAL at
       * its site, so a test can COMPARE them (PL-3's convention, REC-71's measurement);
       * the R11 tests compare code, check and translation. */
      if (!Queue.QUEUE_CLASSES.includes(it.class))
        return refusal("NO_CLASS",
          localize("queue.index.every_queue_item_says_which", "every queue item says which of {map} it is, and this one carries {v1}. The feed is DERIVED rather than stored, so the constraint a column would have carried is enforced at the one place an item is minted.", { map: String(Queue.QUEUE_CLASSES.map((c) => `"${QUEUE_CLASS_LABELS[c]}"`).join(", ")), v1: String(it.class === undefined ? "none" : JSON.stringify(String(it.class).slice(0, 40))) }),
          { id: it.id ?? null });
      if (classOfKind(it.kind) === null)
        return refusal("NO_SUCH_KIND",
          it.kind === undefined || it.kind === null || it.kind === ""
            ? localize("queue.index.this_item_carries_no_kind", "this item carries no kind at all. The vocabulary is queuestate.mjs's three lists and nothing else — it is what op=queuemute refuses against, what op=affordances publishes, and what carries the sentence a member reads instead of the slug. A kind invented at a producer would reach a surface with no words to render it, and ids of the form N-<number> are a DESIGN DOCUMENT's numbering that no code has ever used.")
            : localize("queue.index.kind_is_not_a_kind", "'{kind}' is not a kind this record's catalogue names. The vocabulary is queuestate.mjs's three lists and nothing else — it is what op=queuemute refuses against, what op=affordances publishes, and what carries the sentence a member reads instead of the slug. A kind invented at a producer would reach a surface with no words to render it, and ids of the form N-<number> are a DESIGN DOCUMENT's numbering that no code has ever used.", { kind: String(String(it.kind).slice(0, 60)) }),
          { id: it.id ?? null, kind: it.kind ?? null });
      if (classOfKind(it.kind) !== it.class)
        return refusal("KIND_MISCLASSED",
          localize("queue.index.string_is_catalogued_as_v1", "'{String}' is catalogued as \"{v1}\" and this item mints it as \"{v2}\". That is not a spelling mistake, it is a change of doctrine at a producer: the class decides whether leaving a member's list is a PERSONAL QUIET or an AUTHORED RECORD ACT (D-125, DEC-16), so minting a to-do's kind as a status item would let one member silence a task the record believes reached a person, and minting a status item's kind as something noticed would make a fact about our own machinery undismissable.", { String: String(String(it.kind).slice(0, 60)), v1: String(QUEUE_CLASS_LABELS[classOfKind(it.kind)]), v2: String(QUEUE_CLASS_LABELS[it.class]) }),
          { id: it.id ?? null, kind: it.kind ?? null,
            catalogued_as: classOfKind(it.kind), minted_as: it.class });
      /* END DEC-49 REGION is-queue-mint */
      /* PL-13 — THE DISPOSITION KEY, PUBLISHED AT THE MINT AND NOWHERE ELSE.
         Deliberately OUTSIDE the governed region above: it mints no refusal
         code and a `where` that swallowed it would claim a span whose set it
         does not answer. And deliberately AT THE
         MINT rather than in each producer: this is a property of the ITEM,
         asked of every item whatever its class and by one implementation, which
         is the same argument `suppressedBy` makes one block down. A producer
         computing its own answer would be six copies of the act's key. */
      it.disposition = this.#dispositionOf(it);
      if (it.kind === "signer-self-registered") it.options = Queue.signerOptionsOf(it);
      /* R56 (N1123): the subject names its title, `null` where it names no bundle the viewer may see or the bundle states none,
         never missing; asked here for every item whatever its producer, so no producer carries a copy. */
      if (it.subject && typeof it.subject === "object" && !Array.isArray(it.subject))
        it.subject = { ...it.subject, title: titleOf(it.subject.id) };
      /* R2, R8 (N363): the catalogue id is stamped here, where the catalogue is, and sits after `kind` as its producer
         once placed it. */
      const cid = catalogueIdOf(it.kind);
      if (cid !== null && it.catalogue_id !== cid) {
        const { id, class: cls, kind, catalogue_id: _, ...rest } = it;
        for (const k of Object.keys(it)) delete it[k];
        Object.assign(it, { id, class: cls, kind, catalogue_id: cid, ...rest });
      }
      /* R18: the lead's set-aside, offered exactly when its disposition is available (R12). */
      if (it.kind === "out-of-inquiry-lead" && it.disposition.available === true) it.options = [...it.options, Queue.LEAD_SET_ASIDE];
    }

    /* ============ D-266 / IC-60 · THE JUDGMENT-LAYER AGEING, PER PROJECT ======
     *
     * **ONE TEAM'S DISMISSAL GOVERNS THAT TEAM'S FEED AND NOTHING ELSE**, which
     * is the whole of the 2026-08-10 scoping ruling made operational. The
     * contrast one block down is deliberate and the two say so about each other:
     * a MUTE is personal and changes nobody else's feed; an INSTANCE-WIDE
     * disposition is a record act that clears the finding under every case it
     * appears in (DEC-16); a PROJECT-SCOPED disposition is a record act too —
     * authored, attributed, dated, and visible to that project's every member —
     * that clears the finding under ONE project and leaves every other project's
     * feed untouched by an item.
     *
     * IT RUNS AFTER THE MINT AND BEFORE THE MUTE, and the order is the argument.
     * After the mint, because it reads `disposition.scope`, which the mint is the
     * one place to compute. Before the mute, because a RECORD ACT is applied
     * before a PREFERENCE: a member's own mute must never be able to change
     * whether their team's decision was applied, only whether they are shown the
     * result.
     *
     * A PARTIALLY-DISPOSED ITEM STAYS AND SAYS SO. An item filed under two teams
     * where one has dismissed it is still a live finding for the other, so it
     * remains in the feed with the deciding team removed from its homes and the
     * removal DECLARED on `case.disposed_by` — never silently, which is the rule
     * `#findingsVersionFromAnotherTeam` already keeps for its own `excluded`
     * home. The item leaves the open list only when EVERY project home has
     * decided, and it is reported in `disposed` either way: an aged finding must
     * not read like an absent one (D-79), and that obligation does not weaken
     * because the ageing is now per-team.
     * ===================================================================== */
    const scopedRows = this.#rows(
      `SELECT project_id, finding_id, kind, state, reason, decided_by, at FROM finding_dispositions`);
    const scopedByFinding = new Map();
    for (const d of scopedRows) {
      let m = scopedByFinding.get(d.finding_id);
      if (!m) { m = new Map(); scopedByFinding.set(d.finding_id, m); }
      m.set(d.project_id, d);
    }
    const scopedDisposed = [];
    if (scopedByFinding.size > 0) {
      const surviving = [];
      for (const it of items) {
        const dsp = it.disposition;
        const byProject = dsp && dsp.scope === "project" && dsp.available === true
          ? scopedByFinding.get(it.id) : null;
        if (!byProject) { surviving.push(it); continue; }
        const homes = Array.isArray(dsp.projects) ? dsp.projects : [];
        const decided = homes.filter((p) => byProject.has(p));
        if (decided.length === 0) { surviving.push(it); continue; }
        for (const p of decided) {
          const d = byProject.get(p);
          scopedDisposed.push({
            /* THE ITEM ID THIS DECISION AGED, in the feed's own spelling — the
               same pin IC-53 put on the other key shape, and the reason a
               surface can tie a decision to the thing it removed without
               rebuilding an identity out of columns. */
            id: it.id, scope: "project", project: p, finding: d.finding_id,
            key: `${p}::${d.finding_id}`, kind: d.kind ?? it.kind ?? null,
            state: d.state, reason: d.reason, decided_by: d.decided_by, at: d.at,
          });
        }
        if (decided.length === homes.length) continue;   // every team decided: it leaves the open list
        const kept = (it.case && Array.isArray(it.case.ancestors) ? it.case.ancestors : [])
          .filter((a) => !(a && a.type === "project" && decided.includes(a.id)));
        it.case = {
          ...it.case, ancestors: kept,
          ungrouped: it.case.state === "determined" && kept.length === 0,
          disposed_by: decided.map((p) => ({ id: p, reason: "disposed_by_that_project",
            detail: localize("queue.index.this_team_decided_this_finding", "this team decided this finding at the judgment layer, so it has left their open list; it is still live for the teams named above, whose feed that act did not touch (D-266).") })),
        };
        it.disposition = { ...dsp, projects: homes.filter((p) => !decided.includes(p)),
                           disposed_by: decided };
        surviving.push(it);
      }
      items.length = 0;
      items.push(...surviving);
    }

    /* ------------------------------------------- REC-21 · the PERSONAL half
       MOVED BELOW THE MINT BY PL-15 (it used to run above it), and the reason
       is at the mint: an item a member had muted was suppressed BEFORE the
       fence could look at it, so a FINDING minted under a kind the catalogue
       files as a CONDITION — the one case the mute's write fence WILL accept —
       could be muted and vanish without the mint ever seeing it. Nothing else
       about this block changes, and nothing about its result does either for
       any correctly-minted feed: every item reaching here has now been
       validated, which is the state this block always assumed.

       ONE admission point, consulted for EVERY item whatever its class, over
       queuestate.mjs's pure decision. The class fence is at the WRITE (queueMute
       refuses anything that is not a CONDITION kind), so a kind present in
       muted_kinds already means "a condition this member muted" and the read
       asks only about membership. That is deliberate and it is what makes the
       rule's failure observable: negative control (b) removes the write fence,
       a real OBLIGATION kind enters the column, and a real obligation genuinely
       disappears from a real feed — which is exactly the harm the doctrine
       names, demonstrated rather than asserted.
       A mute is PERSONAL, so an anonymous or machine caller (no member) has no
       mutes and sees the whole live set: #queueMutes returns an empty map and
       this loop suppresses nothing. */
    const mutes = this.#queueMutes(me);
    /* D-125 (DEC-10 (b)) and D-170: the ITEM form, keyed on the item's own id and
       on no case, asked FIRST because it is the narrower preference. `scope`
       says which form suppressed each item, so the member's feed states what
       it hides and by which of their own choices. */
    const itemMutes = this.#queueItemMutes(me);
    const suppressed = [];
    const admitted = [];
    for (const it of items) {
      if (mutedAsItem(it, itemMutes)) {
        suppressed.push({ id: it.id, class: it.class, kind: it.kind, case: null, scope: "item" });
        continue;
      }
      /* R31: an OBLIGATION is never suppressed, even by a row that names its kind (the write refuses one, and this
         read does not trust the column to have been written by that write alone; `mutedAsItem`'s posture). */
      const by = it.class === "OBLIGATION" ? null : suppressedBy(it, mutes);
      if (by === null) { admitted.push(it); continue; }
      suppressed.push({ id: it.id, class: it.class, kind: it.kind, case: by, scope: "case" });
    }
    items.length = 0;
    items.push(...admitted);


    /* D-266 / IC-60. ONE LIST, TWO SCOPES, AND `scope` SAYS WHICH — never two
       arrays. What a member wants from this block is *what did I set aside and
       why*, which is one question; splitting it by the act's key shape would
       make a surface join two lists to answer it and would put the plane's
       internal distinction where a reader has to care about it. What the reader
       DOES have to be able to tell is whose feed each decision governs, and
       `scope` (with `project` beside it) says exactly that on every row. */
    const dispAll = [
      ...(Array.isArray(facts.dispositions) ? facts.dispositions : []).map((d) => ({
        /* THE ITEM ID THIS DECISION AGED, in the feed's own spelling, so a
           surface ties a decision to the thing it removed without rebuilding
           the identity from two columns — the drift class IC-53 closed one
           field over. */
        id: `FINDING::${d.key}`, scope: "instance", project: null,
        key: d.key, progression_key: d.progression_key, stage_key: d.stage_key,
        state: d.state, reason: d.reason, decided_by: d.decided_by, at: d.at,
        /* REC-184: the definition version the decision judged, and whether it still ages the
           finding — false once the definition is revised, when the finding is an OPEN item again. */
        definition_version: d.definition_version,
        definition_version_state: d.definition_version_state,
        applies: d.applies, applies_because: d.applies_because,
      })),
      ...scopedDisposed,
    ];
    /* R60 (T51; DEC-330 A62): which feeds answered, and the per-class all-clear: a class is clear only when every feed that can
       raise it answered and the unsuppressed feed (before the limit's cut) holds no item of it. A muted item is not a failure. */
    const feeds = this.#feedRows(facts, noticed, { tasks: tasksMs, "notice-producers": noticesMs });
    const classesAnswered = Object.fromEntries(Queue.QUEUE_CLASSES.map((c) => [c, feeds.filter((f) => f.classes.includes(c)).every((f) => f.answered)]));
    const allClear = Object.fromEntries(Queue.QUEUE_CLASSES.map((c) => [c, classesAnswered[c] && !items.some((i) => i.class === c)]));
    return { ok: true, items, suppressed, mutes, itemMutes, facts, noticed, feeds, feedsMs, dispAll, classesAnswered, allClear, resolved: null,
             measure: { items_by_producer: { tasks: fromTasks, "queue-producers": fromProducers, "notice-producers": noticed.items.length } } };
  }

  /** op=queue: the member's ONE feed.
   *
   *  `member` and `viewer` are BOTH stamped server-side by the control plane and are
   *  never taken from the caller — whose queue this is, and whose view its
   *  case names are compiled for, are server decisions or they are not
   *  decisions at all.
   *
   *  WHOSE OBLIGATIONS. Tasks assigned to the caller, PLUS tasks honestly
   *  `unassigned`. D-98 intends an unassigned task to stay claimable and
   *  routable by hand, and DEC-7 keeps it claimable rather than stranded, so
   *  hiding it from every queue would strand exactly the work routing could
   *  find nobody for. A machine credential has no member behind it and gets
   *  the whole live set, which is the operator view the token exists for.
   *
   *  `refers_to` POINTS AT THE SUBJECT, NOT AT THE CASE. They are different
   *  columns and the contract carries both: `subject` is what the item is
   *  about, `case` is where it is filed. Collapsing them is how a queue
   *  invents a home. */
  queueFeed({ member = null, viewer = null, nowMs = null, limit = 200, sort = null, muted = false, answered = false,
              aside = false, after = null, count = false } = {}) {
    const flag = (v) => v === true || v === "true" || v === "1";
    /* R55 (N1094; DEC-240 (D3)): the muted list, in place of the feed: asked for by `muted: true` (or the query's "true" or
       "1"), it answers what this member has muted and takes neither `sort` nor `limit`. */
    if (flag(muted))
      return this.#mutedList(typeof member === "string" && member.trim() ? member.trim() : null, viewer);
    /* R59 (T51; DEC-330 A61): what left this member's queue because of her, or because another did it for everyone, in place
       of the feed, as the muted list is (it takes neither `sort` nor `limit`). */
    if (flag(answered))
      return this.#answeredList(typeof member === "string" && member.trim() ? member.trim() : null, viewer, this.#nowMs(nowMs));
    /* R61 (T51; DEC-330 A63): the set-aside findings of both scopes, in place of the feed, paged by `after` and `limit`. */
    if (flag(aside))
      return this.#asideList(viewer, this.#nowMs(nowMs), limit, after);
    /* R49 (DEC-110 (1)): the order asked for is checked FIRST, before anything is read, so a refusal costs no read and
       a caller learns the four orders this feed keeps. Absent or blank is DEC-110 (3)'s default. */
    const order = typeof sort === "string" ? sort.trim() : (sort === null || sort === undefined ? "" : null);
    /* DEC-49 REGION is-queue-sort — R49/C-33.51. The code is a STRING LITERAL at its site; the check and the translation
       come off its row (R49's test compares them). */
    if (order === null || (order !== "" && !QUEUE_SORTS.includes(order)))
      return queueRefusal("QUEUE_SORT_UNKNOWN", QUEUE_ACT_CHECKS.QUEUE_SORT_UNKNOWN, {
        sort: typeof sort === "string" ? sort.slice(0, 40) : null, sorts: [...QUEUE_SORTS],
        detail: localize("queue.index.the_feed_keeps_four_orders", "the feed keeps four orders besides its default (grouped by case): {QUEUE_SORTS}. Send one of them as `sort`, or none for the default. Nothing was read.", { QUEUE_SORTS: String(QUEUE_SORTS.join(", ")) }) });
    /* END DEC-49 REGION is-queue-sort */
    const cap = clampLimit(limit, 200, 500);
    const now = this.#nowMs(nowMs);
    const me = typeof member === "string" && member.trim() ? member.trim() : null;
    /* REC-132 / D-422: the queue's act options ask D-310's owner fact of the POSITIONAL
       identity, which is `member` — already the control plane's stamp of who asks —
       spelled in the viewer grammar. A machine credential stamps no member and keeps
       the fallback to its viewer, byte-unchanged. */
    const identity = me ? `member:${me}` : null;
    /* R94 (fix round 8, G116): the list, the count and what they are made from are ONE derivation for a viewer at one signature
       (the record's write counter, this module's own writes, the clock's 5-second bucket), kept for the bucket; a hit is served
       by copying it, a miss makes it once. Nothing is kept when the record states no counter, nor for a refusal. */
    const derivedKey = JSON.stringify([me, viewer ?? null]);
    const derivedSig = this.#countSignature(now);
    let d = null, served = "miss";
    if (derivedSig !== null) {
      const kept = this.#derived.get(derivedKey);
      if (kept && kept.sig === derivedSig) { d = kept.d; served = "hit"; }
    }
    if (d === null) {
      d = this.#measured(() => this.#derive({ me, viewer, now, identity }));
      if (d.ok !== true) return d;
      /* R93: kept under the signature as it stands after the derivation: a provider's first read may write its own
         migrations (a row in its ledger) while it is read, and those writes are the derivation's own, so the count asked
         next with nothing written since is the one already made. */
      const keptSig = derivedSig !== null ? this.#countSignature(now) : null;
      if (keptSig !== null) {
        if (!this.#derived.has(derivedKey) && this.#derived.size >= Queue.QUEUE_COUNT_VIEWERS_MAX) this.#derived.clear();
        this.#derived.set(derivedKey, { sig: keptSig, d });
      }
    }
    /* R94: what the Server-Timing marks carry (control-plane's phase clock): `queue-count` is `served`, and `rows-queue` the
       derivation's own figures, stated for a miss only. */
    const derivation = served === "hit" ? { served } : { served, ...d.measure };
    /* R93 (T51 fix round 4, P9; K4429): the number of open items the list would hold (after the mutes and the project
       decisions, before the limit's cut), without the list, so the frame's bell and sidebar do not read the whole feed. */
    if (flag(count)) return { ok: true, member: me, count: d.items.length, derivation };
    /* the answer is made from a copy: a caller changing what it was handed changes no other answer made from the derivation */
    const kept = Queue.#copyOf(d);
    const { items, suppressed, mutes, itemMutes, facts, noticed, feeds, feedsMs, dispAll, classesAnswered, allClear } = kept;
    /* R40 (DEC-10 (a)): a snoozed case's items are MARKED, never withheld: a surface may hold them back until the
       instant, and the plane keeps reporting them (a snooze defers re-notification; it removes nothing). */
    const snoozes = this.#queueSnoozes(me, now);
    if (snoozes.size > 0)
      for (const it of items) {
        const on = (it.case && Array.isArray(it.case.ancestors) ? it.case.ancestors : [])
          .filter((a) => a && snoozes.has(a.id)).map((a) => ({ case: a.id, until: snoozes.get(a.id) }));
        if (on.length > 0)
          it.snoozed = { until: on.map((x) => x.until).sort().at(-1), cases: on };
      }

    /* R49, then R6's cut: the feed in the order asked for (DEC-110 (3)'s default when none was), applied BEFORE the
       limit, so a small limit takes the head of that order and not of another. */
    items.sort(Queue.feedOrder(order, now));
    const out = items.slice(0, cap);

    /* ============ D-266 · AN AGED FINDING MUST NOT READ LIKE AN ABSENT ONE
     *
     * **THE RULING THIS BLOCK IS THE TEETH OF, and the record made it rather
     * than this item: a disposition is keyed on the finding's STABLE IDENTITY,
     * it STANDS until it is re-triaged whether or not the underlying fact still
     * fires, and it AGES the finding out of the open list instead of deleting
     * it.** D-79 in terms — *a finding that disappears is indistinguishable
     * from one that was never made, and that rule does not relax because the
     * finder was a machine* — and `proposeDispose` says the same at its own
     * site (*the disposition is a standing decision keyed by identity … it does
     * NOT require a gap to currently fire*), and `proposalsFeed` implements
     * both halves: the disposed proposal leaves `proposals[]` and is RETURNED
     * in `dispositions[]`.
     *
     * **BEING RECOMPUTED ON EVERY READ IS NOT THE PROBLEM IT LOOKED LIKE, AND
     * THAT IS A MEASUREMENT RATHER THAN A PREFERENCE.** The two kinds that ARE
     * dispositionable today are themselves derived on every read — this feed
     * stamps them `age: { state: "undetermined", reason: "derived_on_read" }`
     * with its own hand, and `proposalsFeed` rebuilds them from
     * `progression_instances` every time it is called. Nothing is stored for a
     * disposition to attach to. What it attaches to instead is the IDENTITY,
     * and the identity is stable by construction: `proposal_dispositions`'
     * primary key is `(progression_key, stage_key)` and the item this feed
     * mints for it is `FINDING::<progression>::<stage>` — the same identity,
     * written by two producers that never consult each other. So a dismissal is
     * a fact about the SUBJECT, not about the inputs, and it neither decays nor
     * un-dismisses itself when they move. The record has already accepted the
     * consequence in the sharpest available case: a stage that later crosses
     * its deadline does NOT re-ask a member who set the gap aside.
     *
     * **WHAT WAS ACTUALLY BROKEN, AND IT WAS LIVE.** `proposalsFeed` keeps both
     * halves; THIS OP KEPT ONLY THE FIRST. `op=queue` is the one feed a member
     * opens by habit, and a finding they had dismissed simply stopped being in
     * it, with nothing anywhere in the answer saying so — indistinguishable
     * from a finding the record never derived, which is exactly what D-79
     * forbids and exactly the sparse-level failure CLAUDE.md makes a first-class
     * obligation. A surface could only keep a page-local Map of the dispositions
     * IT performed and render them under the queue, which is honest and is a
     * SECOND PLACE A FACT IS STATED (D-21/DEC-8) that survives neither a reload
     * nor a second member. The record holds the fact; the op publishes it
     * (`disposed` here, and R61's `aside` list whole, unbounded by this block's 64).
     *
     * **IT PUBLISHES THE DECISION AND ASSERTS NOTHING ABOUT THE GAP.** Whether
     * the underlying finding would fire again today is deliberately NOT claimed
     * here — the decision stands either way, and recomputing it would be a
     * second derivation of a question `op=proposals` already answers. `mute` one
     * block down is the deliberate contrast and the two say so about each other:
     * a mute is PERSONAL and changes nobody else's feed, a disposition is a
     * RECORD ACT carrying its author and reason and clears the finding under
     * every case it appears in. */
    const dispCap = Queue.QUEUE_DISPOSED_MAX;
    const disposedOut = dispAll.slice(0, dispCap);
    return {
      ok: true, member: me, items: out,
      /* REC-57: `truncated` was already here and is UNTOUCHED — this op is the
         one its siblings are being brought into line WITH, and adding a second
         spelling of a fact it already publishes is the drift REC-55 declined.
         What was missing is the other half of the pair: WHICH BOUND was
         applied, so a caller that sees `truncated:true` knows what to ask for
         next. `limit` is the cap after clamping, matching `op=search`. */
      limit: cap,
      /* R49: the order this answer is in; null is the default (grouped by case), which no `sort` was sent for. */
      sort: order === "" ? null : order,
      item_count: out.length, truncated: items.length > out.length,
      classes: Queue.QUEUE_CLASSES,
      /* N301 (K356): how each class is shown to members; FINDING reads Noticed, its code unchanged. */
      class_labels: QUEUE_CLASS_LABELS,
      /* R54 (N1047; DEC-226 (1)): the kinds a surface files under a named section, not under "no case". */
      sections: QUEUE_SECTIONS,
      /* R60 (T51; DEC-330 A62): the feeds this answer was assembled from and whether each answered; a surface says "looked and
         found none" for a class exactly when `all_clear` holds for it, and names a failed feed by its id. Asking again is the
         retry: no state is kept between asks. */
      feeds, feeds_ms: feedsMs, all_answered: feeds.every((f) => f.answered), classes_answered: classesAnswered, all_clear: allClear,
      classes_deferred: Queue.QUEUE_CLASSES_DEFERRED,
      ancestor_depth_bound: Queue.QUEUE_ANCESTOR_DEPTH,
      /* REC-21. What this member has chosen not to be told about, REPORTED
         rather than silently applied — the same rule the ancestor walk obeys
         and for the same reason: a feed that is quietly shorter is
         indistinguishable from nobody caring. A surface renders "you muted 2
         condition kinds on this case" from this block; nothing is hidden from
         the member who did the hiding. `personal: true` is stated because the
         one thing a reader must never conclude from a mute is that the record
         changed. */
      mute: {
        personal: true,
        cases: [...mutes.keys()].sort(),
        /* D-534: the kinds each of those cases mutes, case id -> sorted kinds.
           `cases` alone named the case and the kinds nowhere, so a case mute
           holding nothing back today (no live item of those kinds, so nothing
           on `suppressed`) could be neither named nor undone — the case form's
           unmute takes the kinds. A map BESIDE `cases` rather than objects IN
           it, because every reader of `cases` holds it as a list of ids (the
           module's R14 tests and the screens); this adds and moves nothing. */
        case_kinds: Object.fromEntries([...mutes.keys()].sort()
          .map((c) => [c, [...mutes.get(c)].sort()])),
        /* D-125: every item id this member muted, whether or not it is live
           now — a muted host that is not held today is still muted for them. */
        items: [...itemMutes].sort(),
        /* R40: each case this member has snoozed, with the instant it lapses (only those still in the future). */
        snoozed_until: Object.fromEntries([...snoozes.entries()].sort()),
        suppressed,
        suppressed_count: suppressed.length,
        detail: localize("queue.index.muting_is_personal_and_dismissing", "muting is PERSONAL and dismissing is a RECORD ACT (D-125). Nothing here was removed from the record and nothing here left another member's queue. A status item or a noticed item can be here, quieted by case over the kinds you named or by its own id (`scope`); a to-do never can, because it leaves every list only when it is DONE. A quieted noticed item is still open for the team and in op=proposals: it leaves the team's list only when it is adopted, deferred or dismissed, an act the record keeps."),
      },
      /* D-266. The other half of the sentence `mute` has just finished — a
         FINDING leaves this list when it is dismissed, and here is every one
         that did. `personal: false` is stated for the same reason `mute` states
         `personal: true`: the one thing a reader must be able to tell about a
         shorter feed is WHOSE act shortened it. */
      disposed: {
        personal: false,
        findings: disposedOut,
        count: disposedOut.length,
        recorded: dispAll.length,
        bound: dispCap,
        truncated: dispAll.length > disposedOut.length,
        detail: localize("queue.index.every_finding_here_left_the", "every finding here left the OPEN list by an AUTHORED RECORD ACT (op=proposedispose) carrying its author and their reason — never by a preference, which is the block above. It has NOT left the record: the decision is keyed on the finding's own identity, the same id the open feed mints for it, and it stands until it is RE-TRIAGED. Whether the underlying gap still fires is NOT asserted here and does not matter to the decision (D-79) — op=proposals is the op that answers that. **WHOSE FEED EACH DECISION GOVERNS IS ON THE ROW AND IS NOT ONE ANSWER (D-266, IC-60): `scope: instance` cleared this finding for EVERYBODY, because a progression-stage finding is a fact about the shared record and one act clearing it under every case is dedup (DEC-16); `scope: project` cleared it for THAT PROJECT AND NO OTHER, because a stance is one project's own property (§7, D-216) and R5 makes forks at the judgment layer legitimate.** So `personal: false` means no member's preference did this, and it never means every team's feed moved. AN EMPTY LIST MEANS THE RECORD LOOKED AND HOLDS NONE, never that this plane cannot say; and which act any given finding is open to is published on the item's own `disposition`, never inferred from its kind."),
      },
      /* R39 (DEC-16): the obligations resolved lately on subjects this viewer sees, each with who resolved it and
         when, so a member who did not resolve one reads "resolved by X on this date" rather than a gap. */
      resolved: Queue.#copyOf(d.resolved ??= this.#resolvedLately(viewer, now)),
      /* R94: how this answer was served: `hit` (the derivation kept) or `miss` (made now, with its figures). */
      derivation,
      /* N172: the bound on the projects `objective-gap` asks about, published beside whether it cut. */
      objective_gap_projects_bound: facts.objective_gap ? facts.objective_gap.bound ?? null : null,
      objective_gap_projects_truncated: !!(facts.objective_gap && facts.objective_gap.truncated === true),
      /* R6 (N345): the bound on the projects the contradiction producers ask about (queue-producers R4), beside
         whether it cut. Neither counts nor names the other side of a conflict a member cannot see. */
      contradiction_projects_bound: facts.contradiction ? facts.contradiction.bound ?? null : null,
      contradiction_projects_truncated: !!(facts.contradiction && facts.contradiction.truncated === true),
      /* R51 (T33-83): what `notice-producers` said of its read: each producer's bound and `truncated` as it states
         them, and `failed`, the producers that contributed no item because they could not be read. */
      notice_producers: { ...noticed.facts, failed: [...noticed.failed],
        detail: localize("queue.index.the_machines_and_the_assistants", "the machine's and the assistant's noticed items, duties come due and dated waits come round are read here beside the rest of the feed. A producer named in `failed` could not be read, so it contributed nothing this time: its absence from the feed is not a statement that it has nothing to say.") },
      /* D-266's SECOND, SMALLER HALF — the folded gap, counted rather than
         closed, because closing it needs an identity this record does not
         hold and inventing one would be the overclaim the silence exists to
         avoid. */
      unattributed_readings: {
        count: Number(facts.unattributed && facts.unattributed.count) || 0,
        inquiries: facts.unattributed && Array.isArray(facts.unattributed.inquiries)
          ? facts.unattributed.inquiries : [],
        detail: localize("queue.index.readings_of_a_shared_question", "readings of a SHARED question that this read met and could not attribute to a team, so no `new-version-arrived-from-another-team` item was minted for them. The source team is a run's own stored context or it is nothing: a member does not name a team in this record, and guessing one from who authored a reading would manufacture the very connection the notification claims attention for. SO THE COUNT IS PUBLISHED AND THE ATTRIBUTION IS NOT — an empty item list and an unattributable set are different facts and until now they read the same. The questions are named so a member can go and look (op=basisversions); the readings are not named and no author is implied. Why each one could not be attributed is deliberately NOT distinguished: telling a hand-composed reading from one whose run sat under something other than a project would mean projecting a stored column of `ai_runs`, which this reader's declared role forbids (REC-74). Zero means this read attributed everything it met, not that it did not look."),
      },
      counts: {
        obligation: out.filter((i) => i.class === "OBLIGATION").length,
        finding: out.filter((i) => i.class === "FINDING").length,
        /* REC-32. Additive: REC-20's two counts are untouched and a reader that
           knows nothing about conditions still gets the same numbers. */
        condition: out.filter((i) => i.class === "CONDITION").length,
        ungrouped: out.filter((i) => i.case.ungrouped).length,
        case_undetermined: out.filter((i) => i.case.state === "undetermined").length,
        suppressed: suppressed.length,
      },
    };
  }

  /* =================================================================   *  REC-21 · queue_state — the PERSONAL half, and the boundary it defends.
   *
   *  THE TWO OPS BELOW WRITE TO ONE TABLE AND TO NOTHING ELSE. Not `tasks`, not
   *  `proposal_dispositions`, and no bundle is minted. That is the discipline
   *  op=proposedispose established from the other side — declining is not
   *  authoring, so it writes a disposition rather than a document — carried one
   *  step further: a preference is not even a disposition. A disposition is
   *  ATTRIBUTED and DATED and stays in the case's history because the group is
   *  entitled to know its question was set aside and by whom. A mute is
   *  addressed to nobody, changes nothing about the record, and the group is
   *  entitled to know nothing about it.
   *
   *  WHY DEC-16 RAISES THE STAKES. Under shared resolution one member's act
   *  clears every other member's queue. That is right for a RESOLUTION — the
   *  City replacing a page is one fact about the world and anyone standing on
   *  it can settle it for everyone — and it is exactly why the personal half
   *  must not be able to reach the same lever. If mute and dismiss were one
   *  control, one member's inbox hygiene would clear the group's question, and
   *  a silent disappearance would be indistinguishable from a bug.
   *
   *  AND THE OTHER HALF OF DEC-16'S SAFEGUARD NEEDS NO CODE HERE, which is
   *  worth stating so nobody later builds it: an act that CHANGES the record is
   *  ITSELF AN EVENT, and it propagates by the same every-ancestor rule as any
   *  other. Resolving by LOOKING and finding nothing changed correctly clears
   *  the item for everyone; resolving by CHANGING something raises a new event
   *  that reaches every ancestor entry — including the entry of a member who
   *  muted conditions on that case, because the new event is an OBLIGATION and
   *  a mute cannot reach one. That is the ordinary consequence loop, not a
   *  mechanism; `feed.test.mjs`' R14/R31 test holds that a mute row naming an obligation's kind suppresses
   *  none.
   * ======================================================================== */

  /** This member's mute rows, as the pure decision wants them: a Map
   *  case_id -> Set(kind). A caller with no member (a machine credential, an
   *  unauthenticated probe) has no personal state and gets an empty map, so the
   *  operator view is the whole live set — the same carve-out D-15 makes for a
   *  machine viewer, for the same reason: there is no person whose preferences
   *  these could be. */
  #queueMutes(member) {
    const out = new Map();
    if (typeof member !== "string" || !member.trim()) return out;
    for (const r of this.#rows(
      `SELECT case_id, muted_kinds FROM queue_state WHERE member_id=?`, member.trim())) {
      const kinds = parseMutedKinds(r.muted_kinds);
      if (kinds.length > 0) out.set(r.case_id, new Set(kinds));
    }
    return out;
  }

  /** D-125: this member's ITEM mutes, as a Set of item ids. A caller with no
   *  member has none, for `#queueMutes`' reason. */
  #queueItemMutes(member) {
    const out = new Set();
    if (typeof member !== "string" || !member.trim()) return out;
    for (const r of this.#rows(
      `SELECT item_id FROM queue_item_mutes WHERE member_id=?`, member.trim())) out.add(r.item_id);
    return out;
  }

  /** R40: this member's snoozes still in the future, case id -> ISO instant. A caller with no member has none. */
  #queueSnoozes(member, now) {
    const out = new Map();
    if (typeof member !== "string" || !member.trim()) return out;
    for (const r of this.#rows(
      `SELECT case_id, snoozed_until FROM queue_state WHERE member_id=? AND snoozed_until IS NOT NULL`, member.trim())) {
      const ms = Date.parse(r.snoozed_until);
      if (Number.isFinite(ms) && ms > now) out.set(r.case_id, r.snoozed_until);
    }
    return out;
  }

  /** R39: the obligations resolved within the last QUEUE_RESOLVED_WINDOW_DAYS on subjects this viewer sees, each with
   *  who resolved it and when. The tasks, newest first, at most QUEUE_RESOLVED_MAX, each resolved by its history's
   *  `resolved` entry; and the settled bias debts, read through `bias.settled` (its R44; N326) with the viewer's gate in
   *  the same window and bound, each resolved by the member who settled it, or null beside its `settled_kind` when no
   *  member did (the lens moved back, or a re-run discharged it: K444). Null is never read as "nobody". */
  #resolvedLately(viewer, now) {
    const cap = Queue.QUEUE_RESOLVED_MAX;
    const since = stampInstant("second", now - Queue.QUEUE_RESOLVED_WINDOW_DAYS * 86400000);
    /* tasks R6: the tasks resolved since then on visible subjects, one past the bound so the cut is observed. */
    const rows = this.#tasks.resolvedTasks({ viewer, since, limit: cap + 1 });
    const tasks = rows.slice(0, cap).map((t) => {
      const by = Queue.resolvingEntry(t.history);
      return { id: t.id, class: "OBLIGATION", kind: t.kind, refers_to: t.refers_to, summary: t.subject.text,
               resolved_by: by ? by.actor : null, resolved_at: t.resolved_at ?? (by ? by.at : null) };
    });
    const settled = this.#bias.settled({ gate: viewerPredicate(viewer), since, limit: cap }) || {};
    const debts = (Array.isArray(settled.debts) ? settled.debts : []).map((d) => ({
      id: `OBLIGATION::bias-debt::${d.run}`, class: "OBLIGATION", kind: "bias-debt", run: d.run,
      context: { type: d.context_type ?? null, id: d.context_id ?? null },
      resolved_by: d.actor ?? null, settled_kind: d.settled_kind ?? null, resolved_at: d.settled_at ?? null,
      reason: d.reason ?? null }));
    return { personal: false, window_days: Queue.QUEUE_RESOLVED_WINDOW_DAYS, since, obligations: tasks,
             count: tasks.length, bound: cap, truncated: rows.length > cap,
             bias_debts: { read: settled.undetermined !== true, debts, count: debts.length,
                           bound: settled.limit ?? cap, truncated: settled.truncated === true,
                           ...(settled.undetermined === true || settled.stated ? { stated: settled.stated ?? null } : {}),
                           detail: localize("queue.index.bias_debts_settled_in_the", "bias debts settled in the window on runs this viewer may read (bias R44), each with the member who settled it. `resolved_by` is null when no member settled it (the lens moved back, or a re-run under the lens now in force discharged it), and `settled_kind` says which; null never means nobody acted.") },
             detail: localize("queue.index.to_dos_that_left_the", "to-dos that LEFT the list by being done, with who resolved each and when (DEC-16): one member's resolution clears the item for everyone, and this is where everyone else reads that it happened.") };
  }

  /** The case a personal preference may be attached to, resolved through the
   *  catalog's OWN machinery and gated by the viewer.
   *
   *  MAP RULE (REC-10/REC-13). `normalizeType` decides whether the bundle is a
   *  CASE at all, so a legacy `focus`/`problem` document is mutable exactly as a
   *  canonical `inquiry` one is, and `vocabFor` reads its state through the
   *  machine that document was authored under. A raw `object_type === "inquiry"`
   *  here would silently refuse every legacy question.
   *
   *  D-15 through the ONE compilation point: a case this viewer cannot see
   *  answers identically to one that does not exist, so a mute cannot be used to
   *  probe for the existence of a project nobody invited you to. */
  #queueCaseFor(caseId, viewer) {
    const id = typeof caseId === "string" ? caseId.trim() : "";
    if (!id) return { ok: false, reason: "NO_CASE",
                      detail: localize("queue.index.a_personal_preference_is_keyed", "a personal preference is keyed (member, case); name the case it is about") };
    const gate = viewerPredicate(viewer);
    /* `FROM bundles b` and not `FROM bundles`: viewerPredicate compiles a
       predicate over the alias `b`, which is the shape every other gated read in
       this file passes it. */
    const row = this.#one(
      `SELECT b.bundle_id, b.object_type, b.current_state, b.title FROM bundles b
        WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
    if (!row) return { ok: false, reason: "NO_SUCH_CASE", case: id,
      detail: localize("queue.index.no_case_by_that_id", "no case by that id is visible to you. A case you may not see and a case that does not exist answer identically here (D-15), so this refusal reveals nothing either way.") };
    const ty = normalizeType(row.object_type);
    if (!Queue.QUEUE_CASE_TYPES.includes(ty))
      return { ok: false, reason: "NOT_A_CASE", case: id, object_type: ty,
        detail: localize("queue.index.a_queue_entry_is_filed", "a queue entry is filed under a CASE — an inquiry or a project — and personal state is keyed to that. A document is a SUBJECT, not a home: muting one would be muting every question that rests on it, for reasons none of those questions' owners could see.") };
    const spec = vocabFor(STATES, row.object_type);
    return { ok: true, id: row.bundle_id, type: ty, title: row.title ?? null,
             state: row.current_state ?? null,
             known_state: !!(spec && spec.edges
               && Object.prototype.hasOwnProperty.call(spec.edges, row.current_state)) };
  }

  /** R56: a reader of the title of a bundle by id, for this viewer: the bundle's title when the viewer may see it, else null
   *  (never of a bundle they may not, R33); asked once per id, through the one gate (D-15). */
  #titleReader(viewer) {
    const gate = viewerPredicate(viewer);
    const titles = new Map();
    return (id) => {
      if (typeof id !== "string" || !id.trim()) return null;
      const key = id.trim();
      if (!titles.has(key)) {
        const row = this.#one(`SELECT b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, key, ...gate.args);
        titles.set(key, row && typeof row.title === "string" && row.title.trim() ? row.title : null);
      }
      return titles.get(key);
    };
  }

  /** R58 (T51): the item `itemId` as this member's current feed holds it, for the mute to store with its row: its kind, the
   *  title of its subject (R56) and the subject's id, each null when the item is not among her feed's items (not live, or
   *  already muted). Looked up once; never throws. */
  #liveItem(member, viewer, itemId) {
    const none = { kind: null, title: null, subject: null };
    try {
      const f = this.queueFeed({ member, viewer, limit: 500 });
      const it = f && f.ok === true && Array.isArray(f.items) ? f.items.find((i) => i && i.id === itemId) : null;
      if (!it) return none;
      const sub = it.subject && typeof it.subject === "object" ? it.subject : {};
      const title = typeof sub.title === "string" && sub.title.trim() ? sub.title : null;
      return { kind: typeof it.kind === "string" && it.kind ? it.kind : null, title,
               subject: title !== null && typeof sub.id === "string" && sub.id ? sub.id : null };
    } catch { return none; }
  }

  /** R59, R61: rows newest first by `at` (as a time, not as text), the undated after the dated, ties in the order `tie`
   *  gives (a text per row). */
  static #newestFirst(tie) {
    const ms = (x) => { const t = typeof x.at === "string" ? Date.parse(x.at) : NaN; return Number.isFinite(t) ? t : null; };
    return (a, b) => {
      const ma = ms(a), mb = ms(b);
      if (ma !== mb) return ma === null ? 1 : mb === null ? -1 : mb - ma;
      const ta = tie(a), tb = tie(b);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    };
  }

  /** R59 (T51; DEC-330 A61, K3806; `tasks` R6, R3; amends R39): what left this member's queue because of her, or because
   *  another member did it for everyone, in place of the feed: `{ok, answered, count, window_days, bound, truncated}`, newest
   *  first, within R39's window and bound. Four kinds of row, each `act`: `resolved` (R39's tasks that were hers, assigned to
   *  her or unassigned or resolved by her, and its settled bias debts; `by` the member who resolved it, null when none did,
   *  `by_you` true when she did), `forwarded` (a to-do she forwarded, from the task's own history: `to` is the task's
   *  assignee now when the entry is its latest forward, else null), `snoozed` (each case she snoozed whose snooze is still in
   *  the future), `set_aside` (each finding she dismissed or deferred in the window) and, from R95, `join_answer` (each join
   *  request she answered in the window, from project-roster's read by `closed_by` (its R44): `{act: "join_answer", project,
   *  title, requester: {member, handle}, answer: "granted" | "declined", at}`). Only `resolved` rows are about other
   *  members' acts; the rest are the asker's own. A caller with no member gets `resolved` rows only. A row names no subject
   *  or case the viewer may not see (R33). Reads only; never throws on stored text. */
  #answeredList(member, viewer, now) {
    const cap = Queue.QUEUE_RESOLVED_MAX, days = Queue.QUEUE_RESOLVED_WINDOW_DAYS;
    const sinceMs = now - days * 86400000;
    const since = stampInstant("second", sinceMs);
    const gate = viewerPredicate(viewer);
    const titleOf = this.#titleReader(viewer);
    const inWindow = (at) => { const t = typeof at === "string" ? Date.parse(at) : NaN; return Number.isFinite(t) && t >= sinceMs; };
    const rows = [];
    const resolved = this.#tasks.resolvedTasks({ viewer, since, limit: 1000 });
    for (const t of resolved) {
      const by = Queue.resolvingEntry(t.history);
      const resolvedBy = by && typeof by.actor === "string" ? by.actor : null;
      if (member && t.assignee !== member && t.assignee !== "unassigned" && resolvedBy !== member) continue;
      rows.push({ act: "resolved", id: t.id, class: "OBLIGATION", kind: t.kind, title: titleOf(t.refers_to),
                  by: resolvedBy, by_you: member !== null && resolvedBy === member, at: t.resolved_at ?? (by ? by.at : null) });
    }
    const settled = this.#bias.settled({ gate, since, limit: cap }) || {};
    for (const d of Array.isArray(settled.debts) ? settled.debts : [])
      rows.push({ act: "resolved", id: `OBLIGATION::bias-debt::${d.run}`, class: "OBLIGATION", kind: "bias-debt",
                  title: titleOf(d.context_id), by: d.actor ?? null, by_you: member !== null && d.actor === member,
                  at: d.settled_at ?? null, settled_kind: d.settled_kind ?? null });
    if (member) {
      const seen = new Set();
      for (const t of [...this.#tasks.recentTasks({ viewer, limit: 1000, statuses: Queue.TASK_LIVE_STATUSES }), ...resolved]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        const hist = Array.isArray(t.history) ? t.history : [];
        const latest = hist.reduce((m, h, i) => (h && h.event === "forwarded" ? i : m), -1);
        hist.forEach((h, i) => {
          if (h && h.event === "forwarded" && h.actor === member && inWindow(h.at))
            rows.push({ act: "forwarded", id: t.id, kind: t.kind, title: titleOf(t.refers_to), to: i === latest ? t.assignee : null,
                        at: h.at });
        });
      }
      for (const r of this.#rows(`SELECT case_id, snoozed_until, snoozed_at FROM queue_state WHERE member_id=? AND snoozed_until IS NOT NULL`, member)) {
        const until = Date.parse(r.snoozed_until);
        if (!(Number.isFinite(until) && until > now)) continue;
        const c = this.#one(`SELECT b.bundle_id, b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, r.case_id, ...gate.args);
        if (!c) continue;
        rows.push({ act: "snoozed", case: { id: c.bundle_id, title: typeof c.title === "string" && c.title.trim() ? c.title : null },
                    until: r.snoozed_until, at: r.snoozed_at ?? null });
      }
      for (const r of this.#rows(`SELECT project_id, finding_id, state, at FROM finding_dispositions WHERE decided_by=?`, member)) {
        if (!inWindow(r.at) || !this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, r.project_id, ...gate.args)) continue;
        rows.push({ act: "set_aside", scope: "project", project: r.project_id, finding: r.finding_id, state: r.state, at: r.at });
      }
      const feed = this.#progressions.proposalsFeed(now) || {};
      for (const d of Array.isArray(feed.dispositions) ? feed.dispositions : [])
        if (d && d.decided_by === member && (d.state === "dismissed" || d.state === "deferred") && inWindow(d.at))
          rows.push({ act: "set_aside", scope: "instance", project: null, finding: `FINDING::${d.key}`, state: d.state, at: d.at });
      /* R95: the join requests she answered; project-roster already leaves out a project she cannot see in full (its R44), and
         the gate here is the same R33 rule, so a project she is out of names nothing whichever reads it. */
      let joins = null;
      try { joins = this.#projectRoster.projectRequestsAnswered({ by: member, viewer, limit: cap }); } catch { joins = null; }
      for (const j of joins && joins.ok === true && Array.isArray(joins.answered) ? joins.answered : []) {
        if (!j || typeof j.projectId !== "string" || !inWindow(j.closed)) continue;
        const p = this.#one(`SELECT b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, j.projectId, ...gate.args);
        if (!p) continue;
        rows.push({ act: "join_answer", project: j.projectId, title: typeof p.title === "string" && p.title.trim() ? p.title : null,
                    requester: j.requester ?? null, answer: j.answer, at: j.closed });
      }
    }
    rows.sort(Queue.#newestFirst((x) => `${x.act}\u0000${x.id ?? x.finding ?? x.case?.id ?? x.project}\u0000${x.project ?? ""}\u0000${x.requester?.handle ?? ""}`));
    const page = rows.slice(0, cap);
    return { ok: true, answered: page, count: page.length, window_days: days, bound: cap, truncated: rows.length > cap };
  }

  /** R61 (T51; DEC-330 A63, K3839; amends R15): every set-aside finding of both scopes in place of the feed, newest first by
   *  `at` then `scope`, `project` and `finding`, each `{scope, finding, project, key, state, reason, decided_by, at,
   *  definition_version, title}`: an instance row is `progressions.proposalsFeed`'s `dispositions[]` (its R18) with the version
   *  it judged, a project row is `finding_dispositions`' with `definition_version: null`. Not cut at R15's 64: paged by `after`
   *  (the previous page's `next`, an opaque cursor naming the last row) and `limit` (default 200, at most 500). A row whose
   *  project, or a bundle its finding's id names, the viewer may not see is left out and not counted (R33); its `title` is the
   *  title of the first visible bundle the finding's id names, else null. */
  #asideList(viewer, now, limit, after) {
    const cap = clampLimit(limit, 200, 500);
    const gate = viewerPredicate(viewer);
    const titleOf = this.#titleReader(viewer);
    const sees = (id) => !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args);
    const exists = (id) => !!this.#one(`SELECT 1 AS x FROM bundles WHERE bundle_id=?`, id);
    const rows = [];
    const feed = this.#progressions.proposalsFeed(now) || {};
    for (const d of Array.isArray(feed.dispositions) ? feed.dispositions : [])
      if (d && (d.state === "dismissed" || d.state === "deferred"))
        rows.push({ scope: "instance", finding: `FINDING::${d.key}`, project: null, key: d.key, state: d.state, reason: d.reason ?? null,
                    decided_by: d.decided_by ?? null, at: d.at ?? null, definition_version: d.definition_version ?? null, title: null });
    for (const r of this.#rows(`SELECT project_id, finding_id, state, reason, decided_by, at FROM finding_dispositions`)) {
      if (!sees(r.project_id)) continue;
      /* the bundles the finding's id names: one the viewer may not see leaves the row out, the first they may names its title */
      const named = String(r.finding_id).split(/::|@|#/).filter((x) => x && exists(x));
      if (named.some((x) => !sees(x))) continue;
      rows.push({ scope: "project", finding: r.finding_id, project: r.project_id, key: `${r.project_id}::${r.finding_id}`, state: r.state,
                  reason: r.reason ?? null, decided_by: r.decided_by ?? null, at: r.at ?? null, definition_version: null,
                  title: named.length ? titleOf(named[0]) : null });
    }
    const cmp = Queue.#newestFirst((x) => `${x.scope}\u0000${x.project ?? ""}\u0000${x.finding}`);
    rows.sort(cmp);
    let from = 0;
    if (typeof after === "string" && after) {
      let c = null;
      try { c = JSON.parse(Buffer.from(after, "base64url").toString("utf8")); } catch { c = null; }
      if (c && typeof c === "object" && typeof c.scope === "string" && typeof c.finding === "string") {
        const mark = { at: typeof c.at === "string" ? c.at : null, scope: c.scope, project: typeof c.project === "string" ? c.project : null,
                       finding: c.finding };
        from = rows.findIndex((x) => cmp(x, mark) > 0);   // the rows after the cursor's place in the one total order
        if (from < 0) from = rows.length;
      }
    }
    const page = rows.slice(from, from + cap);
    const truncated = from + cap < rows.length;
    const last = page.at(-1);
    return { ok: true, aside: page, count: page.length,
             next: truncated && last ? Buffer.from(JSON.stringify({ at: last.at, scope: last.scope, project: last.project, finding: last.finding }), "utf8").toString("base64url") : null,
             truncated };
  }

  /** R55 (T50; N1094; DEC-240 (D3); amends R14, R19, R20): what this member has muted and nobody else's, one row per kind
   *  muted in a case (`{kind, case: {id, title}, at}`) and one per muted item (`{item, class, at}`), newest first. `at` is
   *  the instant the mute was made; a kind muted before its instant was kept answers `at: null`, never back-filled, and such
   *  a row follows every dated one. A case the viewer may no longer see names nothing (R33): its rows are left out, and
   *  not counted. A caller with no member has none to list. Reads only; never throws on stored text. */
  #mutedList(member, viewer) {
    if (!member) return { ok: true, muted: [], count: 0 };
    const gate = viewerPredicate(viewer);
    const rows = [];
    for (const r of this.#rows(`SELECT case_id, muted_kinds, muted_at FROM queue_state WHERE member_id=?`, member)) {
      const kinds = parseMutedKinds(r.muted_kinds);
      if (kinds.length === 0) continue;
      const c = this.#one(`SELECT b.bundle_id, b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, r.case_id, ...gate.args);
      if (!c) continue;
      const ats = parseMutedAt(r.muted_at);
      for (const kind of kinds)
        rows.push({ kind, case: { id: c.bundle_id, title: typeof c.title === "string" && c.title.trim() ? c.title : null },
                    at: ats[kind] ?? null });
    }
    /* R58 (T51): an item's row names it: its `kind` as her feed held it when she muted it, else the id's second segment where
       `classOfKind` names it a kind of the row's class, else null; and its `title`, the title recorded with the mute, never
       back-filled, and null when its subject is a bundle she may no longer see (R33). */
    for (const r of this.#rows(`SELECT item_id, item_class, muted_at, item_kind, item_title, item_subject FROM queue_item_mutes WHERE member_id=?`, member)) {
      const seg = String(r.item_id).split("::")[1];
      const kind = typeof r.item_kind === "string" && r.item_kind ? r.item_kind : (seg && classOfKind(seg) === r.item_class ? seg : null);
      const shown = typeof r.item_title === "string" && r.item_title.trim() && typeof r.item_subject === "string" && r.item_subject
        && this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, r.item_subject, ...gate.args);
      rows.push({ item: r.item_id, class: r.item_class, kind, title: shown ? r.item_title : null, at: r.muted_at ?? null });
    }
    /* newest first by the instant (as a time, not as text), the undated after them; ties in a fixed order. */
    const ms = (x) => { const t = x.at === null ? NaN : Date.parse(x.at); return Number.isFinite(t) ? t : null; };
    const tie = (x) => (x.item !== undefined ? `1\u0000${x.item}` : `0\u0000${x.case.id}\u0000${x.kind}`);
    rows.sort((a, b) => {
      const ma = ms(a), mb = ms(b);
      if (ma !== mb) return ma === null ? 1 : mb === null ? -1 : mb - ma;
      return tie(a) < tie(b) ? -1 : tie(a) > tie(b) ? 1 : 0;
    });
    return { ok: true, muted: rows, count: rows.length };
  }

  /** op=queuemute — a member's PERSONAL mute, in one of two forms (D-125, DEC-10).
   *
   *  THE CASE FORM, `{ case, kinds }` — DEC-10's (c): stop notifying ME about these
   *  kinds on this case. Scoped to the kinds NAMED when it is made, so a new kind
   *  on the case still reaches the member (queuestate.mjs `suppressedBy`).
   *
   *  THE ITEM FORM, `{ item }` — DEC-10's (b): stop notifying ME about this one
   *  item, keyed on the item's own stable id as op=queue publishes it (a
   *  FINDING's `FINDING::<progression>::<stage>` is the key its disposition
   *  already uses). It names no case, so it also reaches an UNGROUPED CONDITION
   *  (D-170, BOB #29), which the case form cannot. It writes ONE row of
   *  `queue_item_mutes` and nothing else.
   *
   *  `member` is stamped server-side by the control plane and is never taken from the
   *  caller: a caller who could name the member could mute somebody else's
   *  attention, which is the one thing a personal preference must not permit.
   *
   *  THE FENCE. Either form reaches a CONDITION or a FINDING and NEVER an
   *  OBLIGATION (NOTIFICATIONS.md "MARKED AS HANDLED", RULED 2026-09-22 by BOB
   *  #26): a mute is keyed on the MEMBER, so it moves no other member's list, and
   *  a finding still leaves the TEAM's list only by the authored disposition,
   *  which a mute never writes. An obligation is refused with its class and the
   *  act that DOES clear it. A kind or an item the catalogue cannot classify is
   *  refused separately: unknown is not the same as wrong. A case-less per-KIND
   *  mute stays unavailable (REC-32's hazard): the case form requires a case.
   *
   *  It refuses an EMPTY set too. "Mute this case" with no kinds is the delete
   *  button the doctrine forbids, and accepting it as a no-op would leave a
   *  member believing they had silenced something they had not. */
  queueMute({ member = null, case: caseId = null, kinds = null, item = null, unmute = false,
              viewer = null, at = null } = {}) {
    const me = typeof member === "string" ? member.trim() : "";
    if (!me) return { ok: false, reason: "NO_MEMBER",
      detail: localize("queue.index.a_mute_is_personal_it", "a mute is PERSONAL: it is keyed to the member whose attention it is about, and a machine credential has no member behind it. There is no instance-wide mute and there must not be.") };
    const mutableKinds = [...Object.keys(QUEUE_CONDITION_KINDS), ...Object.keys(QUEUE_FINDING_KINDS)];
    const itemId = typeof item === "string" ? item.trim() : "";
    const named = Array.isArray(kinds) ? kinds.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean) : [];
    let c = null;
    const subjects = [];
    if (itemId) {
      /* One form per call. An item named beside kinds or a case is ambiguous
         about which preference the member meant, and guessing is how a member
         ends up believing the wrong thing is silenced. */
      if (named.length > 0 || (typeof caseId === "string" && caseId.trim()))
        return { ok: false, reason: "BAD_KIND", item: itemId,
          detail: localize("queue.index.name_either_one_item_item", "name EITHER one item (`item`) OR kinds on a case (`case` + `kinds`), not both: they are two different preferences and this plane will not guess which one you meant") };
      /* The class is the id's own first segment; an OBLIGATION's id is an
         opaque task id with none, so `tasks` is asked to NAME it — the refusal
         must say OBLIGATION rather than merely "unknown". */
      let cls = itemClassOf(itemId);
      /* R26: an OBLIGATION published under its own class segment (`OBLIGATION::bias-debt::<run>`, R8) is named
         OBLIGATION too, so it is refused as one rather than as unknown. */
      if (cls === null && /^OBLIGATION::\S/.test(itemId)) cls = "OBLIGATION";
      /* tasks R6, gated by the viewer (N374, K565): a task this viewer may not see answers as no task, so its id is
         UNKNOWN_KIND exactly as an absent one's and the refusal reveals nothing (R33). */
      if (cls === null && this.#tasks.taskExists({ id: itemId, viewer })) cls = "OBLIGATION";
      subjects.push({ item: itemId, cls });
    } else {
      c = this.#queueCaseFor(caseId, viewer);
      if (c.ok !== true) return c;
      if (named.length === 0)
        return { ok: false, reason: "NO_KINDS", case: c.id,
          detail: localize("queue.index.name_the_kinds_to_mute", "name the kinds to mute, or name one `item`. A mute is scoped to the kinds present when it was made — that is what lets a NEW kind on this case still reach you — so there is no whole-case mute to ask for."),
          available: mutableKinds };
      for (const k of named) subjects.push({ kind: k, cls: classOfKind(k) });
    }
    for (const sb of subjects) {
      if (sb.kind !== undefined && sb.kind.includes(","))
        return { ok: false, reason: "BAD_KIND", kind: sb.kind, case: c.id,
          detail: localize("queue.index.a_kind_is_a_slug", "a kind is a slug and may not contain a comma; the stored set is comma-separated") };
      if (sb.cls === null)
        return { ok: false, reason: "UNKNOWN_KIND", ...(sb.item ? { item: sb.item } : { kind: sb.kind }),
          case: c ? c.id : null,
          detail: sb.item
            ? localize("queue.index.no_queue_item_by_that", "no queue item by that id is one this plane can classify: a noticed item's or a status item's id begins with its class code (as op=queue publishes it), and it names no to-do. Unknown is not the same as forbidden, and this refusal is the first rather than the second.")
            : localize("queue.index.the_notification_catalogue_does_not", "the notification catalogue does not name that kind. Unknown is not the same as forbidden, and this refusal is the first rather than the second."),
          available: mutableKinds };
      /* DEC-49 REGION is-mute-class — REC-64/C-33.27. */
      if (!PERSONALLY_MUTABLE_CLASSES.includes(sb.cls))
        return { ok: false, reason: "KIND_NOT_PERSONAL", code: "KIND_NOT_PERSONAL",
          check: QUEUE_ACT_CHECKS.KIND_NOT_PERSONAL.check, translation: QUEUE_ACT_CHECKS.KIND_NOT_PERSONAL.translation,
          ...(sb.item ? { item: sb.item } : { kind: sb.kind }), kind_class: sb.cls,
          case: c ? c.id : null,
          detail: MUTE_REFUSAL_DETAIL[sb.cls],
          available: mutableKinds };
      /* END DEC-49 REGION is-mute-class */
    }
    const stamp = typeof at === "string" && at ? at : new Date(this.#nowMs(null)).toISOString();
    if (itemId) {
      const cls = subjects[0].cls;
      const had = !!this.#one(
        `SELECT item_id FROM queue_item_mutes WHERE member_id=? AND item_id=?`, me, itemId);
      this.#wrote();
      if (unmute) this.sql.exec(
        `DELETE FROM queue_item_mutes WHERE member_id=? AND item_id=?`, me, itemId);
      else {
        /* R58 (T51; amends R20): the item is looked up once among her current feed's items, and its kind, its subject's
           title (R56) and that subject's id are stored with the row; an item that is not live (or is already muted, so is not
           in her feed) stores none, and a re-mute keeps what the row already held. */
        const live = this.#liveItem(me, viewer, itemId);
        this.sql.exec(
          `INSERT INTO queue_item_mutes (member_id, item_id, item_class, muted_at, item_kind, item_title, item_subject)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(member_id, item_id) DO UPDATE SET muted_at=excluded.muted_at,
             item_kind=COALESCE(excluded.item_kind, item_kind), item_title=COALESCE(excluded.item_title, item_title),
             item_subject=COALESCE(excluded.item_subject, item_subject)`,
          me, itemId, cls, stamp, live.kind, live.title, live.subject);
      }
      /* R94: the feed was derived (for the live item above) before this write, so the write is counted again: nothing made
         from that derivation outlives the mute. */
      this.#wrote();
      return {
        ok: true, member: me, form: "item", item: itemId, item_class: cls,
        muted_items: [...this.#queueItemMutes(me)].sort(),
        added: !unmute && !had ? [itemId] : [], removed: unmute && had ? [itemId] : [], at: stamp,
        wrote: { queue_item_mutes: 1, queue_state: 0, tasks: 0, proposal_dispositions: 0, bundles: 0 },
        detail: localize("queue.index.a_mute_is_personal_this", "a mute is PERSONAL: this one item leaves YOUR feed, which says so in its `mute` block. Nothing left the record, no other member's feed moved, no disposition was written, and op=proposals still carries the finding. A finding leaves the team's list only when it is adopted, deferred or dismissed (op=proposedispose). The key is the item's own id, so the same item arising again stays muted for you until you unmute it."),
      };
    }
    const row = this.#one(
      `SELECT muted_kinds, snoozed_until, muted_at FROM queue_state WHERE member_id=? AND case_id=?`, me, c.id);
    const had = parseMutedKinds(row ? row.muted_kinds : "");
    /* UNION on repeat, DIFFERENCE on unmute. Union rather than replace because
       a second mute is a member muting MORE, not restating everything they ever
       muted — and because replace would silently un-mute a kind the surface did
       not happen to re-send. */
    const next = unmute ? had.filter((k) => !named.includes(k))
                        : [...new Set([...had, ...named])];
    const text = serializeMutedKinds(next);
    /* R20, R55: the instant a kind was muted is kept when it is added to the set; a kind already in the set keeps the one it
       has (or none), and an unmuted kind's goes with it. */
    const ats = parseMutedAt(row ? row.muted_at : null);
    const keptAt = Object.fromEntries(next.map((k) => [k, ats[k] ?? (had.includes(k) ? undefined : stamp)])
      .filter(([, v]) => v !== undefined));
    this.#wrote();
    this.sql.exec(
      `INSERT INTO queue_state (member_id, case_id, muted_kinds, snoozed_until, last_seen, muted_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id, case_id) DO UPDATE SET muted_kinds=excluded.muted_kinds,
                                                     last_seen=excluded.last_seen, muted_at=excluded.muted_at`,
      me, c.id, text, row ? row.snoozed_until ?? null : null, stamp, serializeMutedAt(keptAt));
    return {
      ok: true, member: me, case: c.id, case_type: c.type, case_title: c.title,
      muted_kinds: parseMutedKinds(text), added: unmute ? [] : named.filter((k) => !had.includes(k)),
      removed: unmute ? named.filter((k) => had.includes(k)) : [], at: stamp,
      /* The RECORD SURFACES THIS ACT DID NOT TOUCH, counted rather than claimed,
         so the suite can assert the boundary from the op's own answer as well as
         from the tables. */
      wrote: { queue_state: 1, tasks: 0, proposal_dispositions: 0, bundles: 0 },
      detail: localize("queue.index.a_mute_is_personal_and", "a mute is PERSONAL and reaches the kinds of status items and noticed items, never a to-do. Nothing left the record, nothing left another member's queue, no disposition was written, and a to-do on this case still reaches you: a to-do leaves every list only when it is DONE, which is record state."),
    };
  }

  /** op=queuesnooze — defer a case's re-notification, for one member, until an
   *  instant the MEMBER named.
   *
   *  P-87 IS ENFORCED BY AN ABSENCE, and that is the point. "Re-notify at the
   *  stage's OWN declared interval, never a global one" means this plane has no
   *  instance-wide snooze constant to fall back on, so a snooze with no instant
   *  is REFUSED rather than filled in with one. There is nothing to configure
   *  and nothing to drift; the cadence comes from the member's own choice, and
   *  the re-notification clock is the REC-1 alarm's `queue-renotify` consumer,
   *  whose wake is read from these rows and from no constant of its own.
   *
   *  A SNOOZE HIDES NOTHING. It does not filter the feed — deferring a
   *  re-notification is not the same as removing an item, and treating them as
   *  the same is how an obligation would go quiet on a member who only meant
   *  "not right now". The feed keeps reporting the item; the alarm stops
   *  pushing about it until the instant passes. */
  queueSnooze({ member = null, case: caseId = null, until = null, clear = false,
                viewer = null, at = null } = {}) {
    const me = typeof member === "string" ? member.trim() : "";
    if (!me) return { ok: false, reason: "NO_MEMBER",
      detail: localize("queue.index.a_snooze_is_personal_it", "a snooze is PERSONAL: it is keyed to the member whose attention it is about, and a machine credential has no member behind it.") };
    const c = this.#queueCaseFor(caseId, viewer);
    if (c.ok !== true) return c;
    const stamp = typeof at === "string" && at ? at : new Date(this.#nowMs(null)).toISOString();
    let iso = null, dated = null;
    if (!clear) {
      if (typeof until !== "string" || !until)
        return { ok: false, reason: "NO_UNTIL", case: c.id,
          detail: localize("queue.index.name_the_instant_to_snooze", "name the instant to snooze until. There is no default and there must not be one: P-87 requires re-notification at the stage's OWN declared interval, never at a global one, so this plane holds no instance-wide snooze constant to fall back on.") };
      /* R21 (K1444 (iii)): `until` is an instant, or a calendar date read as the start of that local day in the
         instance profile's zone (`civil-time.dayRange`), never as a UTC midnight. A date is in the past when it is
         before TODAY'S local day there (`civil-time.localDay`), never the UTC day. */
      const nowMs = this.#nowMs(null);
      const text = until.trim();
      let ms = NaN, day = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        if (!isCalendarDate(text))
          return { ok: false, reason: "BAD_UNTIL", until, case: c.id,
            detail: localize("queue.index.until_must_be_an_instant", "until must be an instant (ISO-8601, with its time) or a calendar date (YYYY-MM-DD) naming a real day") };
        const zone = this.#zone();
        if (zone === null)
          return { ok: false, reason: "BAD_UNTIL", until, case: c.id,
            detail: localize("queue.index.a_calendar_date_is_snoozed", "a calendar date is snoozed until the start of that day where this team is, and no time zone is held for this copy (its jurisdiction profile gives none), so the day cannot be read without guessing one. Send an instant instead (ISO-8601, with its time).") };
        const today = localDay(new Date(nowMs).toISOString().replace(/\.\d{3}Z$/, "Z"), zone);
        const range = dayRange(text, text, zone);
        if (typeof today !== "string" || !range || typeof range.start !== "string")
          return { ok: false, reason: "BAD_UNTIL", until, case: c.id,
            detail: localize("queue.index.the_day_could_not_be", "the day could not be read in this copy's time zone; send an instant instead") };
        if (text < today)
          return { ok: false, reason: "UNTIL_IN_PAST", until, case: c.id, today,
            detail: localize("queue.index.that_day_is_before_today", "that day is before today ({today}) where this team is; a snooze that has already expired is not a snooze, it would report as deferred while deferring nothing", { today: String(today) }) };
        day = text;
        ms = Date.parse(range.start);
      } else {
        ms = /^\d{4}-\d{2}-\d{2}T/.test(text) ? Date.parse(text) : NaN;
        if (!Number.isFinite(ms))
          return { ok: false, reason: "BAD_UNTIL", until, case: c.id,
            detail: localize("queue.index.until_must_be_an_instant_2", "until must be an instant (ISO-8601, with its time) or a calendar date (YYYY-MM-DD)") };
        if (ms <= nowMs)
          return { ok: false, reason: "UNTIL_IN_PAST", until, case: c.id,
            detail: localize("queue.index.a_snooze_that_has_already", "a snooze that has already expired is not a snooze; it would report as deferred while deferring nothing") };
      }
      iso = new Date(ms).toISOString();
      if (day !== null) dated = { day, lapsed: ms <= nowMs };
    }
    const row = this.#one(
      `SELECT muted_kinds FROM queue_state WHERE member_id=? AND case_id=?`, me, c.id);
    this.#wrote();
    this.sql.exec(
      `INSERT INTO queue_state (member_id, case_id, muted_kinds, snoozed_until, last_seen, snoozed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(member_id, case_id) DO UPDATE SET snoozed_until=excluded.snoozed_until,
                                                     last_seen=excluded.last_seen, snoozed_at=excluded.snoozed_at`,
      me, c.id, row ? row.muted_kinds ?? null : null, iso, stamp, iso === null ? null : stamp);   /* R59: when it was made */
    return {
      ok: true, member: me, case: c.id, case_type: c.type, snoozed_until: iso, at: stamp,
      ...(dated ? { until_day: dated.day } : {}),
      wrote: { queue_state: 1, tasks: 0, proposal_dispositions: 0, bundles: 0 },
      detail: dated && dated.lapsed
        ? localize("queue.index.that_day_has_already_begun", "that day has already begun where this team is, so the snooze, which holds until its start, has already lapsed and defers nothing. The items are unchanged and no other member's feed moved.")
        : iso
        ? localize("queue.index.re_notification_about_this_case", "re-notification about this case is deferred for YOU until that instant. The items themselves are unchanged, they still appear in your feed, and no other member's feed moved.")
        : localize("queue.index.the_snooze_is_cleared_re", "the snooze is cleared; re-notification resumes at the declared interval of whatever raises it."),
    };
  }

  /** The earliest instant any member's snooze expires, or null. This is the
   *  whole of the `queue-renotify` consumer's wake and it holds NO constant of
   *  its own — P-87 by construction rather than by discipline. */
  /** How many snoozes have come due at this instant. */
  #queueRenotifyExpired(now) {
    return this.#rows(
      `SELECT count(*) c FROM queue_state WHERE snoozed_until IS NOT NULL AND snoozed_until<=?`,
      new Date(now).toISOString())[0].c;
  }

  #queueRenotifyWake(now) {
    let best = null;
    for (const r of this.#rows(
      `SELECT snoozed_until FROM queue_state WHERE snoozed_until IS NOT NULL`)) {
      const ms = Date.parse(r.snoozed_until);
      if (!Number.isFinite(ms) || ms <= now) continue;
      if (best === null || ms < best) best = ms;
    }
    return best;
  }

  /* op=proposedispose (REC-7): record a member's DEFER or DISMISS of a derived PROPOSAL, WITHOUT
     minting a bundle. REC-6's op=proposals surfaces the record's own questions (one missing-
     predecessor finding per (progression_key, stage_key), aggregated). A member who decides a
     question is not worth pursuing — or wants it parked — needs somewhere to record that. op=dispose
     cannot take it: it disposes a focus BUNDLE (a handle + a state), and a proposal is not a bundle.
     Doctrine is SETTLED (D-79): a declined proposal AGES with a recorded reason; it does NOT mint a
     bundle, open a focus, or attribute anything beyond this disposition record — because DECLINING
     IS NOT AUTHORING. So this writes ONE row keyed by the proposal's identity and nothing else: no
     bundle, no history entry, no manifest. proposalsFeed reads it and ages the proposal out of open.

     The reason is REQUIRED and never prefilled (NO_REASON, fail-closed) — the whole point is that a
     member's decision to set aside the record's question is itself accountable, in their own words.
     The deciding member is STAMPED server-side by the control plane (decidedBy); a caller-supplied value is
     overwritten there, and a blank one is refused here (NO_DECIDER) so a bypass fails closed. */
  /* D-266 / IC-60 — THE SECOND KEY SHAPE, AND WHY ONE OP RATHER THAN TWO.
     Deferring and dismissing are ONE act with one vocabulary, one required reason and one
     server-stamped decider; what differs between the two shapes is the SUBJECT the decision is a
     fact about, and a second op would be a second place to state one act (D-21/DEC-8) whose two
     copies would drift the first time the vocabulary moved. So the shape is chosen by which
     identity the caller sends:

       { key | progressionKey+stageKey }  -> proposal_dispositions, INSTANCE-WIDE (DEC-16).
       { project, finding }               -> finding_dispositions,  ONE PROJECT'S FEED (§7/D-216/R5).

     THE SECOND ARM VALIDATES THE PROJECT AND DELIBERATELY NOT THE FINDING'S HOMES. Checking that
     this finding is filed under that project would mean RE-DERIVING the item here from its id —
     a second implementation of an identity `queueFeed` already mints, which is exactly the drift
     class IC-53 closed one field over. The row is the acting team's own record of a judgment; a
     row naming a project the finding never reaches simply never matches, and harms nothing. What
     IS checked is that the project is a real project bundle THIS VIEWER CAN SEE, so a caller
     cannot write a decision under a team it was never invited to. */
  /** R29 (D-623): both of the project arm's no-scope refusals answer here, one code with its row (C-33.50). */
  #noProjectScope(extra) {
    /* DEC-49 REGION is-dispose-scope — R29/C-33.50. The whole of the refusal's site: the code is a STRING LITERAL
       and the check and translation come off its row (R29's test compares them), and a member reads the same
       sentence from the project arm and from the bridge. */
    const row = QUEUE_ACT_CHECKS.NO_PROJECT_SCOPE;
    return { ok: false, reason: "NO_PROJECT_SCOPE", code: "NO_PROJECT_SCOPE",
             check: row.check, translation: row.translation, ...(extra || {}) };
    /* END DEC-49 REGION is-dispose-scope */
  }

  /** R28 (T51; C62): the door the bridge names for an OBLIGATION key of `kind`: the door its producer declared on the caller's
   *  live item with that id (`Queue.doorOf`'s first source), else the kind's hand list, else `taskresolve`. The caller's feed is
   *  read once (and once for a whole set); nothing is written, and a feed that cannot be read names the hand list's door. */
  #bridgeFeeds = null;
  #bridgeDoor(id, kind, viewer, identity) {
    if (typeof id !== "string" || !id.trim()) return Queue.doorOf(kind);
    try {
      const member = typeof identity === "string" && identity.startsWith("member:") && identity.slice(7).trim() ? identity.slice(7).trim() : null;
      const ck = JSON.stringify([viewer ?? null, member]);
      let feed = this.#bridgeFeeds ? this.#bridgeFeeds.get(ck) : undefined;
      if (feed === undefined) {
        feed = this.queueFeed({ member, viewer, limit: 500 });
        if (this.#bridgeFeeds) this.#bridgeFeeds.set(ck, feed);
      }
      const it = feed && feed.ok === true && Array.isArray(feed.items) ? feed.items.find((i) => i && i.id === id.trim()) : null;
      return Queue.doorOf(kind, it && it.kind === kind && it.class === "OBLIGATION" ? it.door : undefined);
    } catch { return Queue.doorOf(kind); }
  }

  proposeDispose({ progressionKey, stageKey, key, project, finding, kind,
                   to, state, reason, definitionVersion = null,
                   decidedBy = null, viewer = null, identity = null, items } = {}) {
    /* D-126: WITH `items`, the act takes a SET under the PER-ITEM weight (`#perItem`), each item decided by
       THIS method's single-key path. The decider (the control plane's stamp) and the viewer and identity
       (the URL's, spread after the body at the dispatch) are forced onto every item. */
    if (items !== undefined) {
      /* R28 (T51; C62): a set's refusals read the caller's live feed for the door a producer declared, once for the whole set. */
      const own = this.#bridgeFeeds === null;
      if (own) this.#bridgeFeeds = new Map();
      try {
        return this.#perItem("proposedispose",
          /* REC-211: `definitionVersion` is SHARED so a set over ONE progression names the version
             once; `#perItem` spreads each item AFTER the shared fields, so a set spanning several
             progressions still gives each item its own. It is not stamped like the decider, because
             the decider is a fact about the actor and this is a fact about what the actor READ. */
          { items, progressionKey, stageKey, key, project, finding, kind, to, state, reason,
            definitionVersion },
          { decidedBy, viewer, identity }, (b) => this.proposeDispose(b));
      } finally { if (own) this.#bridgeFeeds = null; }
    }
    const proj = typeof project === "string" ? project.trim() : "";
    const find = typeof finding === "string" ? finding.trim() : "";
    /* WHICH ACT THIS IS, decided by what the caller SENT and never by inspecting the id's shape.
       A caller that names either half of the project-scoped identity is performing that act, and
       the missing half is refused BY NAME rather than being silently re-read as the other one. */
    const scoped = !!(proj || find);
    /* the proposal identity is (progression_key, stage_key). UI-5 sends the aggregation key it
       already holds ("progression::stage"); the pair may also be passed explicitly. */
    let pk = typeof progressionKey === "string" ? progressionKey.trim() : "";
    let sk = typeof stageKey === "string" ? stageKey.trim() : "";
    if (!scoped && (!pk || !sk) && typeof key === "string" && key.includes("::")) {
      const i = key.indexOf("::");
      if (!pk) pk = key.slice(0, i).trim();
      if (!sk) sk = key.slice(i + 2).trim();
    }
    if (scoped && !find) return { ok: false, reason: "NO_FINDING", project: proj,
      detail: localize("queue.index.a_project_scoped_disposition_names", "a project-scoped disposition names the FINDING it ages, by the queue item's own id (op=queue publishes it as disposition.finding). A project with no finding names a team and no decision.") };
    if (scoped && !proj) return this.#noProjectScope({ finding: find,
      detail: localize("queue.index.a_finding_that_carries_no", "a finding that carries no progression stage is dispositioned at the JUDGMENT LAYER, and that act is scoped to ONE project's feed (D-266: a stance is expressly one project's own property, §7/D-216, and R5 makes forks at the judgment layer legitimate). Name the project you are acting for — op=queue publishes the candidates as disposition.projects. It is not defaulted even when there is only one, because a plane choosing whose judgment the record carries is the single shared stance §7 rejected, arriving through a defaulted parameter.") });
    /* THE BRIDGE FOR A SURFACE BUILT BEFORE IC-60, AND IT NAMES THE FIX RATHER THAN THE SYMPTOM.
       A page that learned this act before the second shape existed composes `key` from the queue
       item's own id, so a stance-scoped finding arrives here as key='<kind>::<rest>'. Read as the
       old shape that is NO_SUCH_PROGRESSION — true, useless, and it tells a member to define a
       progression that has nothing to do with what they clicked. The catalogue already knows the
       first segment is a FINDING kind, so this says what is actually missing. It infers NOTHING
       about which project: it refuses, and names the two arguments to send. */
    /* REC-205 WIDENS THE BRIDGE IN TWO DIRECTIONS, and both are the same defect as the paragraph
       above — a refusal that is true and useless — met by the two things a SELECTION puts in front
       of this act that a single Adopt button never did.
         · THE OTHER SPELLING OF THE SAME MISTAKE. A surface composing `key` from the item's own
           published id sends the WHOLE id, `FINDING::<kind>::<rest>`, not the id with its class
           segment stripped; then `pk` is the literal "FINDING", the catalogue knows no such kind,
           and the answer was NO_SUCH_PROGRESSION again. `itemClassOf` is the lookup that reads a
           published id, and using it here means the bridge does not depend on WHICH of the two
           spellings a page happened to build.
         · A CONDITION OR AN OBLIGATION IN THE SELECTION. `#dispositionOf` already publishes, per
           item, that neither is disposed and WHICH act does reach it (`instead`), so a set arriving
           here with one is a surface that did not read that block — and under the per-item weight it
           is ONE item of a selection whose other items are being handled. It is retained with a
           refusal naming its own act rather than being told to define a progression. The `instead`
           values are read from the catalogue's class, never listed a second time here.
       NOTHING IS INFERRED ABOUT THE SUBJECT IN EITHER ARM: nothing is written, and the refusal names
       the act or the arguments to send. */
    const keyed = typeof key === "string" ? key.trim() : "";
    /* A PUBLISHED ID CARRIES ITS CLASS IN ITS FIRST SEGMENT AND ITS KIND IN ITS SECOND; a key with the
       class segment stripped carries the kind in the FIRST. Both are read here so the bridge does not
       depend on which spelling a page built, and the kind reported is the item's own either way. */
    /* R12, R26: an OBLIGATION not held in `tasks` is published as `OBLIGATION::<kind>::<rest>` (bias-debt, the
       self-registered key, the Action layer's four), which R3 does not read; its second segment is read here as R26
       reads it at the mute, so the bridge names its door rather than handing a progression arm the word OBLIGATION. */
    /* R28 (N527, K1293): a contradiction duty is published under its candidate, `OBLIGATION::contradiction::<c>` or
       `OBLIGATION::contradiction-unseen::<c>` (queue-producers R4, R7), whose second segment is no kind; it is read as
       the duty's kind, so the bridge names the duty's doors rather than handing a progression arm the word OBLIGATION. */
    const oblKind = !scoped ? Queue.obligationKindOfId(keyed) : null;
    const byId = !scoped && keyed ? (itemClassOf(keyed) || (oblKind ? "OBLIGATION" : null)) : null;
    const keyClass = byId || (!scoped ? classOfKind(pk) : null);
    const keyKind = oblKind || (byId ? (keyed.split("::")[1] || null) : (keyClass ? pk : null));
    /* DEC-49 REGION is-dispose-class — REC-205/C-33.44. The code is a STRING LITERAL at its site and the
       translation comes off the row (R28's tests compare them), and a member reads the same sentence
       wherever this act is reached. */
    if (keyClass === "CONDITION" || keyClass === "OBLIGATION") {
      const row = QUEUE_ACT_CHECKS.CLASS_NOT_DISPOSED;
      return { ok: false, reason: "CLASS_NOT_DISPOSED", code: "CLASS_NOT_DISPOSED",
               check: row.check, translation: row.translation,
               class: keyClass, kind: keyKind,
               /* R28 (K607): the same per-kind door R12 publishes on the item. */
               instead: keyClass === "CONDITION" ? "queuemute" : this.#bridgeDoor(keyed, keyKind, viewer, identity),
               detail: localize("queue.index.this_names_v1_and_v2", "this names {v1}, and {v2} is not DISPOSED: a disposition is an authored record act on something the record noticed, and op=queue publishes the act that does reach this item as its `disposition.instead`. Nothing was written. The rest of a selection is unaffected — under the per-item weight this item alone is kept, carrying this reason.", { v1: String(keyClass === "CONDITION" ? "a status item" : "a to-do"), v2: String(keyClass === "CONDITION" ? "a status item" : "a to-do") }) };
    }
    /* END DEC-49 REGION is-dispose-class */
    if (keyClass === "FINDING")
      return this.#noProjectScope({
               finding: byId ? keyed : `FINDING::${pk}::${sk}`,
               kind: keyKind,
               requires: ["project", "finding"],
               detail: localize("queue.index.this_names_a_finding_that", "this names a FINDING that carries no progression stage, so this is the project-scoped disposition and it needs the project you are acting for. Send `project` (one of op=queue's disposition.projects for this item) and `finding` (its disposition.finding) instead of `key`. Nothing was written and no team's feed moved.") });
    if (!scoped) return this.#progressions.disposeProposal({ progressionKey: pk, stageKey: sk, to, state, reason,
                                                                  definitionVersion, decidedBy });
    /* N285 (K275): a word that is no disposition is answered by progressions' `notADisposition` (its R35), the one
       site that mints NOT_A_DISPOSITION with its row, C-100.20; this act holds neither the list nor the sentence. */
    const st = typeof to === "string" ? to.trim() : (typeof state === "string" ? state.trim() : "");
    const undisposed = notADisposition(st);
    if (undisposed) return undisposed;
    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: localize("queue.index.deferring_or_dismissing_the_records", "deferring or dismissing the record's own question is recorded with a reason, in the member's own words — a disposition with no reason ages a finding with no account of why") };
    if (why.length > Queue.EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: localize("queue.index.a_reason_is_at_most", "a reason is at most {EDGE_REASON_MAX} characters and cannot contain a quote, a backslash, or a newline: the restricted frontmatter grammar has no escapes", { EDGE_REASON_MAX: String(Queue.EDGE_REASON_MAX) }) };
    const by = decidedBy == null ? "" : String(decidedBy).trim();
    if (!by)
      return { ok: false, reason: "NO_DECIDER",
               detail: localize("queue.index.a_disposition_is_recorded_under", "a disposition is recorded under the deciding member, stamped from the session. An unnamed decider cannot age the record's question.") };
    /* ================================================ D-266 · THE JUDGMENT-LAYER ARM
       Everything above is SHARED and is reached by both shapes on purpose: the vocabulary, the
       required reason, its grammar bound and the server-stamped decider are properties of the ACT
       and not of the subject, so a second spelling of any of them would be a second rule to keep
       in step. Only the identity differs, and only the identity is checked apart.

       THE PROJECT MUST BE A PROJECT THIS VIEWER CAN SEE. `viewerPredicate` is the ONE compilation
       point (D-15) and it fails CLOSED, so an absent or unrecognised viewer records nothing rather
       than recording under everything. The type test goes through `normalizeType` for the reason
       every other type consultation does — a legacy spelling is the same object.

       AND IT UPSERTS ON (project_id, finding_id), WHICH IS D-79's TEETH AT THE JUDGMENT LAYER: a
       team that re-triages a decision it already took keeps ONE row, re-triageable, never a second.
       The finding is AGED out of that team's open list and is deleted from nothing. */
    if (scoped) {
      const gate = viewerPredicate(viewer);
      const row = this.#one(
        `SELECT b.bundle_id, b.object_type FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`,
        proj, ...gate.args);
      /* REC-149: at EXISTENCE the positional C-70.1; NONE falls to the unchanged answer below. */
      if (!row) { const existence = this.#existenceAct(proj, viewer); if (existence) return existence; }
      /* The scope must be a PROJECT this viewer can see; absent and invisible answer identically (REC-25), through
         membership's one answer (R78, N208). */
      if (!row || normalizeType(row.object_type) !== "project") return noSuchProject(proj, { finding: find });
      /* REC-134: the gate above is SIGHT, and every administrator sees every project. The
         judgment it records is that TEAM's (D-266: *"a stance is expressly one project's own
         property"*), so the decider must have JOINED the project it acts for (Membership v2
         §7.5). Asked after the sight gate, so a caller who cannot see the project still gets
         the absent answer above and learns nothing here. */
      const denied = this.#projectAuthority(proj, identity, "joined", "proposedispose");
      if (denied) return denied;
      const atS = stampInstant("millisecond", this.#nowMs(null));
      const kd = typeof kind === "string" && kind.trim() ? kind.trim().slice(0, 120) : null;
      this.#wrote();
      this.sql.exec(
        `INSERT INTO finding_dispositions (project_id,finding_id,kind,state,reason,decided_by,at)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(project_id,finding_id) DO UPDATE SET
           kind=excluded.kind, state=excluded.state, reason=excluded.reason,
           decided_by=excluded.decided_by, at=excluded.at`,
        proj, find.slice(0, 400), kd, st, why.slice(0, Queue.EDGE_REASON_MAX), by.slice(0, 200), atS);
      return { ok: true, scope: "project", project: proj, finding: find.slice(0, 400),
               key: `${proj}::${find.slice(0, 400)}`, kind: kd,
               to: st, state: st, reason: why, decided_by: by, at: atS, bundle: null,
               detail: localize("queue.index.recorded_for_this_project_and", "recorded for THIS project and for no other. One team's dismissal of a judgment-layer finding governs that team's feed and nothing else (D-266, §7/D-216, R5) — no other project's queue moved by an item, and the finding itself is aged rather than deleted (D-79): it stands until it is re-triaged, whether or not the underlying fact still fires.") };
    }
  }

  /** R27 (T40, T41; K2371, K2523; investigation R2, inquiry R39): this project's own deferral or dismissal of a
   *  question, as this arm recorded it: the state of the one decision kept for (`project`, `question`), the question's
   *  own id sent as `finding`, else null. It reads that one row and no other project's, so what it answers never depends
   *  on how many projects draw on the question. Registered with `investigation` at start (`queueOf`). Never throws. */
  projectDisposition({ project, question } = {}) {
    const p = typeof project === "string" ? project.trim() : "";
    const q = typeof question === "string" ? question.trim() : "";
    if (!p || !q) return null;
    try {
      const r = this.#one(`SELECT state FROM finding_dispositions WHERE project_id=? AND finding_id=?`, p, q);
      return r && (r.state === "deferred" || r.state === "dismissed") ? r.state : null;
    } catch { return null; }
  }

  /* ------------------------------------------------------------------ the store's counts (R42) */

  /** R42 (N342; record-core R63): this module's three figures, each a row count with the rows naming a bundle in `hid`
   *  (the caller's `{sql, args}`, or null) left out: `findingDispositions` by `project_id`, `queueState` by `case_id`;
   *  `queueItemMutes` names no bundle and is counted whole. A figure that cannot be read is null, never zero.
   *  Synchronous; writes nothing; never throws. The `tasks` figure is `tasks`' (its R5; N363). */
  counts(hid = null) {
    const h = hid && typeof hid === "object" && typeof hid.sql === "string" && Array.isArray(hid.args) ? hid : null;
    const c = (t, ...keys) => {
      try {
        const conds = h ? keys.map((k) => `COALESCE(${k}, '') NOT IN ${h.sql}`) : [];
        const args = h ? keys.flatMap(() => h.args) : [];
        const n = Number(this.#one(`SELECT count(*) AS c FROM ${t}${conds.length ? ` WHERE ${conds.join(" AND ")}` : ""}`,
          ...args).c);
        return Number.isFinite(n) ? n : null;
      } catch { return null; }
    };
    return { findingDispositions: c("finding_dispositions", "project_id"),
             queueState: c("queue_state", "case_id"), queueItemMutes: c("queue_item_mutes") };
  }
  static COUNT_KEYS = Object.freeze(["findingDispositions", "queueState", "queueItemMutes"]);

  static PER_ITEM_MAX = PER_ITEM_MAX;   /* affordances.mjs: ONE number, published as set_acts[].max_items */
  #perItem(act, body, stamped, one) {
    const a = PER_ITEM_ACTS.find((x) => x.id === act);
    return perItem(act, body, stamped, one, { itemKeys: a && a.item_keys, sharedKeys: a && a.shared_keys });
  }

  /* ------------------------------------------------------------------ the scheduler consumer (R22)
     `scheduler` is earlier and keeps its registry; this module registers into it at start (K31, scheduler R8). */

  /** R22: the `queue-renotify` consumer: due when a snooze has expired, waking at the earliest future one; it writes
   *  nothing. */
  renotifyConsumer() {
    return { name: "queue-renotify", key: "queuerenotify",
      due:  (now) => this.#queueRenotifyExpired(now) > 0 ? now : null,
      wake: (now) => this.#queueRenotifyWake(now),
      tick: (now) => ({ queuerenotify: { expired: this.#queueRenotifyExpired(now),
                                         next: this.#queueRenotifyWake(now) } }) };
  }
}

const OF = new WeakMap();

/** K61: the one queue instance for this Durable Object's storage (`ctx`, or the storage itself); a later caller's `now`
 *  is adopted or refused (R53), its other deps are those of the first caller. On first reaching it,
 *  its three tables are declared to record-core's purge (R36) and its three figures registered with record-core's
 *  counts (R42), and, unless `deps.start` is false, its `queue-renotify` consumer is registered (R22). The inbox's
 *  registrations (the drain, the grammar, the TASK seed, its figure) are `tasks`' (N363, draft §3.3). */
export function queueOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let q = OF.get(storage);
  /* R53 (capture R90's rule): a later caller's clock is adopted when no caller supplied one, and refused when it is
     another function than the one a caller did; judged before anything else, so a refused call changes nothing. */
  if (q && deps && typeof deps.now === "function") {
    if (q.clock !== null && q.clock !== deps.now)
      throw new Error("queueOf: a caller supplied a different `now` for a storage whose queue already holds another "
                    + "clock a caller gave; queue refuses it rather than judge its feed at either silently (R53)");
    q.adoptClock(deps.now);
  }
  if (!q) {
    q = new Queue({ host: ctx, storage, deps: { ...(deps || {}) } });
    OF.set(storage, q);
    const record = (deps && deps.record) || recordOf(ctx);
    record.declarePurge("queue", [
      { name: "queue_state", keys: ["case_id"] },
      { name: "queue_item_mutes", keys: [] },
      { name: "finding_dispositions", keys: [] },
    ]);
    /* R42 (N342): the three figures `op=stats` and purge's proof read (record-core R63). */
    record.registerCounts("queue", [...Queue.COUNT_KEYS], (hid) => q.counts(hid));
    if (!deps || deps.start !== false) {
      const scheduler = (deps && deps.scheduler) || schedulerOf(ctx, deps && deps.env);
      scheduler.register("queue", q.renotifyConsumer());
    }
    /* R27 (K2523; investigation R2): the project arm's read of a question's own set-aside, registered once with
       `investigation` (earlier, K31's pattern), so a milestone waiting on a question this project deferred or dismissed
       reads stuck. With the scheduler's registration, or whenever a caller hands `investigation` in. */
    if (!deps || deps.start !== false || deps.investigation) {
      const investigation = (deps && deps.investigation) || investigationOf(ctx);
      const r = investigation.registerProjectDisposition("queue", (a) => q.projectDisposition(a));
      if (r && r.ok === false) throw new Error(`queue: registerProjectDisposition refused: ${r.reason || r.code}`);
    }
  }
  return q;
}

/* The ops this module answers, as entries of the plane's one route map (K3; control-plane's `controlPlaneRoutes` spreads
   them in, plane R5, and control-plane's `dispatch` answers every store request over it). `member`, `viewer` and
   `identity` are the control plane's stamps, read from the URL AFTER the body spread so a body never supplies one
   (R37); the decider and the actor ride in the body, stamped there by the control plane. */
export function queueOps(q, url, body) {
  const s = (k) => url.searchParams.get(k);
  return {
    /* R53 (N983): judged at this module's clock; a `now` in the query or the body is never read. */
    queue: () => q.queueFeed({ member: s("member"), viewer: s("viewer"), limit: s("limit"), sort: s("sort"),
                              muted: s("muted"), answered: s("answered"), aside: s("aside"), after: s("after"), count: s("count") }),
    queuemute: () => q.queueMute({ ...(body || {}), member: s("member"), viewer: s("viewer") }),
    queuesnooze: () => q.queueSnooze({ ...(body || {}), member: s("member"), viewer: s("viewer") }),
    proposedispose: () => q.proposeDispose({ ...(body || {}), viewer: s("viewer"), identity: s("identity") }),
  };
}

/** R17: the control plane's half of `op=queue`, given the store's answer `r` (never null: a store silence is the
 *  control plane's own answer) and the control plane's act gate `gate` (`{needs, mode}`, affordances' decorate). A
 *  refusal is passed through with status 400; an answer has every option decorated, so an option equals the act
 *  `op=affordances` publishes for that subject. It attaches no vocabularies: `op=affordances` publishes them once, and
 *  the app reads them there (K1717, K1863). Pure; never throws on a well-formed answer. */
export function queueAnswer(r, { gate } = {}) {
  if (!r || r.ok !== true) return { status: 400, refusal: r };
  /* R55, R59, R61: the muted list, what a member answered and the set-aside findings are each the answer in place of the
     feed: they have no items to decorate. R93: nor has the count. */
  if (Array.isArray(r.muted) || Array.isArray(r.answered) || Array.isArray(r.aside) || (typeof r.count === "number" && !Array.isArray(r.items)))
    return { status: 200, result: r };
  return { status: 200, result: {
    ...r,
    /* R97: a per-key option keeps the key it carries (and the revoke its `to`), which `decorate` does not name. */
    items: (r.items || []).map((i) => ({ ...i, options: (i.options || []).map((a) => {
      const d = decorate(a, gate);
      if (a && typeof a.key === "string") d.key = a.key;
      if (a && typeof a.to === "string") d.to = a.to;
      return d;
    }) })),
  } };
}

/* R92 (T51; K4168, K4202; op-declarations R80, op-grades R49): the ops of this module the screens send, declared by their owner
   beside the ops map: each row's classes, mutating, weight and description are the op's existing rows' (`op-declarations`,
   `op-grades`), its fields are what the arm reads. `decidedBy` (the control plane's stamp on `proposedispose`), `viewer`,
   `member` and `identity` are stamps, not fields. `queuemute` and `queuesnooze` also read an `at` (an instant), which only
   in-plane callers and tests send. A SET (`items`, queue-states' set arm) names each item's identity in its own item, so `items`
   satisfies the two identity groups; the disposition and the reason stay top-level, because the set shares them onto every item
   (`#perItem`). */
export const DECLARED_OPS = Object.freeze({
  proposedispose: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: localize("queue.declared.proposedispose", "ages a DERIVED proposal, keyed by (progression, stage) — not a bundle"),
    fields: { accepts: ["items","key","progressionKey","stageKey","project","finding","kind","to","state","reason","definitionVersion"],
              requires: [["project","key","progressionKey","items"],["finding","key","progressionKey","items"],["to","state"],"reason"] } },
  queuemute: { classes: ["admin","member"], mutating: true, weight: "caller-owned", description: localize("queue.declared.queuemute", "personal state, keyed (member, case) over the kinds named or (member, item) by the item's own id: a preference about one member's attention, not an act on an object — and never on the same control strip as a record act (D-125)"),
    fields: { accepts: ["case","kinds","item","unmute","at"], requires: [["item","case"]] } },
  queuesnooze: { classes: ["admin","member"], mutating: true, weight: "caller-owned", description: localize("queue.declared.queuesnooze", "personal state, keyed (member, case): defers re-notification for one member, changes nothing about the object or the record (D-125, P-87)"),
    fields: { accepts: ["case","until","clear","at"], requires: ["case",["until","clear"]] } },
});
