/* following — the group's following of what happens at a body and in a register, on the scheduler's one alarm
 * (requirements: `build/requirements/following.md`; ladders §4.4, §5B.4, §6.4, §7.4, §8.5; K1443, K1444, K1449, K1468,
 * K1484). A body a member follows is read from its Legistar records so that `events` writes what it did; a document
 * watched per meeting is captured before each meeting by the body's notice period; a public register is re-read (or
 * re-rendered) on the tick, and one behind a member's account or a fee only at that member's act; a member may follow
 * a register's own query for one identifier naming a person; a portal's dataset is snapshotted and diffed by key.
 * Each policy the group holds is watched at its published copy with no member act, every version seen kept, its
 * changes read by `notice-producers` (R20, R21; K1727, K1740). Like `monitoring`, it watches and captures; what a
 * change means is never its to say (R16).
 *
 * New code beside `monitoring` (plan T33 Choices 7; no copy seam was found). Every tick runs under
 * `monitoring.sweepHost()` (its R65: one pause, one idempotence key, one landing), as `link-sweep` does (N506).
 *
 * REACHED as `followingOf(host, deps)` (K61, K1563 (1)): one instance per host, created on the first call; it creates
 * its tables and declares them with their classes (R17). `deps` (each reached through its factory on the same host
 * unless given; a test passes its own):
 *   record, membership   layer 2: `transact`, `declareTable`, `getSetting`, `evidenceStore`; `inSight`.
 *   capture              `acquire` (its capture-request arm; the render path, R7; a member's own credential, R8).
 *   entities, events     a body's existence and Legistar identifier (R1); its observed meetings (R4) and the
 *                        Legistar write (`followedImport`, R2).
 *   monitoring           `sweepHost()` (R13), `schedule(now)` (R4: the `per_meeting` subjects), `monitor` (R4's capture).
 *   standards            the held policies (`standardsIn`, `standardRead`), who may read one (`isMeasure`), and the
 *                        amendments of one (`lawRelationsOf`) (R20, R21). A policy's text capture is read through
 *                        `content`'s read contract (its R45) and its address through `provenance`'s (its R48).
 *   view                 the jurisdiction view, or a function answering it (default: `jurisdictions.combine` of the
 *                        instance's active profiles, record-core R26).
 *   actionPlans, planWork the plan read (state, closing instant, matters, project; `NO_SUCH_PLAN`, `PLAN_CLOSED`), each
 *                        matter's adopted promise-duties with the instant they were all read met (`matterPromiseDuties`,
 *                        its R13, R15: R27's one source) and the watch-reader door this module
 *                        registers with at start (`registerWatchReader`) (R23, R24, R26).
 *   duties, answers      a duty's sight and words; a standing question's sight, words and `ends`, and
 *                        its author's acts ending it or moving its end (R23–R26).
 *   monitoring           also an address's rows with their end date (its R32), `addressWatchEnd` (R71) and
 *                        `addressWatchers` (R72) (R23–R25).
 *   actions, actionClocks a proceeding's actions (`actionsFor`, its R30, R65) and the group's own deadlines
 *                        (`ourDeadlines`, its R18) (R30). The refusals of R29 are `entities`' (`noSuchEntity`,
 *                        `notAProceeding`, its R36, R53; R31).
 *   retrieval            `registerBrowseMarks`, the door this module registers its read of watch marks and second-look flags
 *                        with at start (its R86; R34).
 *   registers            T53 (R37, R39, R43): a register's status and the schemes it issues (`registerFilter`, `registerFor`),
 *                        a project's stated interest (`onInterest`, registered at start when the host holds registers'
 *                        tables, so the plane's registers, built before this module, is told), its watched refresh
 *                        (`refreshImport`) and its changes as counts (`changesSince`).
 *   keyed                T53 (R41, R42): `{store, capture?}`, acquisition's store for a docket's daily keyed check (its
 *                        R36, R130, R131, R137: credentials, the call ledger, evidence, provenance) and `keyedCapture`;
 *                        the store asks `followStanding` here. None: the keyed service is off and a docket is read as a page.
 *   now                  the instance clock in milliseconds.
 *   bytes(sha)           a capture's bytes (default: record-core's evidence store). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal } from "../membership/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { entitiesOf, noSuchEntity, notAProceeding } from "../entities/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { monitoringOf, MONITOR_VIEWER, MONITOR_CADENCE_MS, frequencyRefusal } from "../monitoring/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { actionPlansOf, noSuchPlan, refusePlanClosed } from "../action-plans/index.mjs";
import { planWorkOf } from "../plan-work/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { answersOf } from "../answers/index.mjs";
import { actionsOf } from "../actions/index.mjs";
import { actionClocksOf } from "../action-clocks/index.mjs";
import { isMachineIdentity, isPublicHttpsLocator } from "../record-grammar/index.mjs";
import { isCalendarDate, validAt, localDay, dayRange } from "../civil-time/index.mjs";
import { combine, governingZone, queryAddress } from "../../../jurisdictions/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf } from "../read-bounds.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { parse as parseLegistar, KEY as LEGISTAR_KEY } from "../../../legistar-reader/index.mjs";
import { FOLLOWING_TABLES, migrateFollowing } from "./schema.mjs";
import { legistarBodyId, eventsAddress, itemsAddress, votesAddress, mattersAddress, matterAddress, enactmentOf } from "./legistar.mjs";
import { noticeRule, meetingsOf, dueBefore } from "./meetings.mjs";
import { portalKey, readDataset, diffRows, storedRows } from "./snapshot.mjs";
import { followRefusal } from "./checks.mjs";
import { registersOf } from "../registers/index.mjs";
import { keyedCapture } from "../acquisition/index.mjs";
import { answerChange, docketEntriesAddress, NO_COUNTS, ALERT_SERVICE, ALERT_PURPOSE, ALERT_KINDS } from "./registerwatch.mjs";

export { FOLLOWING_SCHEMA, FOLLOWING_TABLES, migrateFollowing } from "./schema.mjs";
export { legistarSystems, bodySchemes, legistarBodyId } from "./legistar.mjs";
export { noticeRule, meetingsOf, dueBefore, MEETING_HORIZON_MONTHS } from "./meetings.mjs";
export { portalKey, readDataset, diffRows, storedRows, PORTAL_ROWS_INLINE_MAX, PORTAL_PART_CHARS } from "./snapshot.mjs";
export { FOLLOWING_CHECKS, followRefusal } from "./checks.mjs";
export { answerChange, docketEntriesAddress, ALERT_SERVICE, ALERT_PURPOSE } from "./registerwatch.mjs";

export const FOLLOWING_MODULE = "following";
/** R13: the consumer name under the host's epoch and running set. */
export const FOLLOW_CONSUMER = "following";
/** R13: subjects read per tick; with the scheduler's rank, ten times as many are read before ranking (monitoring R19). */
export const FOLLOW_TICK_BATCH = 50;
/** R2: fetches one body's read makes in one tick (its events, items, votes and matters), beyond which it says so. */
export const BODY_READ_FETCHES = 200;
/** R10 (G46, K1881): the capture size above which a portal's answer is not parsed into a snapshot: the tick holds the decoded
 *  text, the parsed rows and their JSON at once, and the diff two snapshots' rows, in one object. The snapshot is written with
 *  no rows and a stated reason; the capture is held whole and cited. Set by measure: a 4 MiB capture of 62-byte rows ticks and diffs
 *  at a node cap of 134 MB (x1.2 = 161, under the object's 163 at that size); 5 MiB needs 184 and 8 MiB 246. */
export const PORTAL_PARSE_MAX_BYTES = boundOf("following", "portal_parse_bytes");
/** R12: the cadences a follow may name: daily (the default) or longer, from monitoring's intervals (its R14). */
export const FOLLOW_CADENCES = Object.freeze(["daily", "weekly", "monthly"]);
export const FOLLOW_KINDS = Object.freeze(["body", "register", "person-query", "portal", "policy", "register-query", "register-interest"]);
/** R37, R39: the register watches of T53: a number a member names, and a project's stated interest watched automatically. */
export const REGISTER_WATCH_KINDS = Object.freeze(["register-query", "register-interest"]);
/** R8, R37: the kinds a gate keeps from the tick (nothing fetched; `member_act_required`). */
const GATED_KINDS = Object.freeze(["register", "person-query", "register-query"]);
/** R43: the most changes one answer gives, and its default. */
export const REGISTER_CHANGES_MAX = 200;
/** R20 (K1881, K1941): a policy watch's cadence, every 7 days from its last read; no act shortens it. */
export const POLICY_WATCH_CADENCE = "weekly";
/** R20: the access of a policy (standards R41) that is never read on the tick (R8, R15). */
export const POLICY_GATED_ACCESS = Object.freeze(["paywalled", "reading_room"]);
/** R21: the most changes one answer gives, and its default. */
export const POLICY_CHANGES_MAX = 200;
export const FOLLOW_PURPOSE = "following";
/** R30: the most items one lane of `proceedingDates` holds (`events` R27's bound), and the most pages of the group's
 *  actions and deadlines it reads to fill the `group` lane. */
export const PROCEEDING_LANE_MAX = 500;
const GROUP_LANE_PAGES = 50;
/** R23: the four kinds of watch a plan may set running (v0.2 rule 17). */
export const WATCH_KINDS = Object.freeze(["follow", "address", "duty", "question"]);
/** R24: the most questions one answer gives, and its default. */
export const WATCH_QUESTIONS_MAX = 200;
/** R32: the bundle types and entity kinds an item may be (`retrieval` R85), the longest note (R33), and R34's bounds. */
export const MARK_BUNDLE_TYPES = Object.freeze(["information", "inquiry", "action", "action_plan"]);
export const MARK_ENTITY_KINDS = Object.freeze(["person", "institution", "body", "movement"]);
export const SECOND_LOOK_NOTE_MAX = 500;
export const BROWSE_MARKS_MAX = 5000;
export const BROWSE_IDS_MAX = 200;
const MEMBER_ADMIN = "admin";
const MACHINE = MONITOR_VIEWER;
const EPOCH_MS = 3600000;
const STATIC_ONLY = word("following.static_only");
const NOT_PUBLIC = word("following.not_public");
const POLICY_PAGE = 200;

const said = (v) => typeof v === "string" && v.trim() !== "";
/* every refusal carries its C-137 row (DEC-49; `checks.mjs`) */
const refuse = (code, detail, extra) => (code === "WATCH_END_REFUSED" ? watchEndRefusal(detail, extra) : followRefusal(code, detail, extra));
/* R22, R25 (K2871): a watch's end refused with monitoring's own row (C-18.19, its R71), minted there once; this module
   mints none. Answered bare (no row) only on a monitoring that does not hold it. */
function watchEndRefusal(detail, extra = {}) {
  try { return frequencyRefusal("WATCH_END_REFUSED", detail, extra); }
  catch { return { ok: false, reason: "WATCH_END_REFUSED", code: "WATCH_END_REFUSED", check: null, translation: null, detail, ...extra }; }
}
const json = (v) => { try { return v == null ? null : JSON.parse(v); } catch { return null; } };
const ms = (s) => Date.parse(s);
const instant = (t) => stampInstant("second", t);
/* R21: an instant (ms since the epoch, or a non-empty string `Date.parse` reads, record-core R48's "readable instant")
   as the first whole second at or after it, in the record's `…:SSZ` spelling; else null (as `bias` R44 reads one). */
function wholeSecondFrom(v) {
  const t = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) return null;
  try { return instant(Math.ceil(t / 1000) * 1000); } catch { return null; }
}

/* ---- the instance (K61) ---- */

const instances = new WeakMap();

export function followingOf(host, deps = {}) {
  const storage = host && host.storage ? host.storage : host;
  let f = instances.get(storage);
  if (!f) {
    const record = deps.record || recordOf(host);
    const membership = deps.membership || membershipOf(host, { record });
    const lazy = (given, make) => { let v = given || null; return () => (v ||= make()); };
    f = new Following({ storage, record, membership, now: deps.now || null, view: deps.view || null, bytes: deps.bytes || null,
      capture: lazy(deps.capture, () => captureOf(host)),
      entities: lazy(deps.entities, () => entitiesOf(host)),
      events: lazy(deps.events, () => eventsOf(host)),
      standards: lazy(deps.standards, () => standardsOf(host, { record, membership })),
      monitoring: lazy(deps.monitoring, () => monitoringOf(host, { record, membership })),
      actionPlans: lazy(deps.actionPlans, () => actionPlansOf(host, { record, membership })),
      planWork: lazy(deps.planWork, () => planWorkOf(host, { record, membership })),
      duties: lazy(deps.duties, () => dutiesOf(host, { record, membership })),
      answers: lazy(deps.answers, () => answersOf(host, { record, membership })),
      actions: lazy(deps.actions, () => actionsOf(host, { record, membership })),
      actionClocks: lazy(deps.actionClocks, () => actionClocksOf(host, { record, membership })),
      retrieval: lazy(deps.retrieval, () => retrievalOf(host)),
      registers: lazy(deps.registers, () => registersOf(host)), keyed: deps.keyed || null });
    instances.set(storage, f);
    f.migrate();
    f.registered = f.registerWatches();
    f.marksRegistered = f.registerMarks();
    f.interestsRegistered = f.registerInterests(!!deps.registers);
  }
  return f;
}

export class Following {
  #sql; #declared = false; #listeners = [];

  constructor({ storage, record, membership, now, view, bytes, capture, entities, events, standards, monitoring, actionPlans, planWork, duties,
                answers, actions, actionClocks, retrieval, registers = null, keyed = null }) {
    this.#sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.now = typeof now === "function" ? now : () => Date.now();
    this.viewOpt = view;
    this.bytesOpt = bytes;
    this.dep = { capture, entities, events, standards, monitoring, actionPlans, planWork, duties, answers, actions, actionClocks, retrieval,
                 registers: registers || (() => null) };
    /* R41: the keyed path (`acquisition` R36, R130, R137): `{store, capture?}`, the store a keyed check is made under (its
       credentials, ledger, evidence and provenance) and `followStanding` answered by this module; none: the service is off */
    this.keyedOpt = keyed;
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  get capture() { return this.dep.capture(); }
  get entities() { return this.dep.entities(); }
  get events() { return this.dep.events(); }
  get standards() { return this.dep.standards(); }
  get monitoring() { return this.dep.monitoring(); }
  get actionPlans() { return this.dep.actionPlans(); }
  get planWork() { return this.dep.planWork(); }
  get duties() { return this.dep.duties(); }
  get answers() { return this.dep.answers(); }
  get actions() { return this.dep.actions(); }
  get actionClocks() { return this.dep.actionClocks(); }
  get retrieval() { return this.dep.retrieval(); }
  get registers() { return this.dep.registers(); }
  get host() { return this.monitoring.sweepHost(); }

  /** R17: the tables, and their declaration with their classes, once. */
  migrate() {
    migrateFollowing(this.#sql);
    if (!this.#declared && this.record && typeof this.record.declareTable === "function") {
      this.#declared = true;
      const d = this.record.declareTable(FOLLOWING_MODULE, FOLLOWING_TABLES.map((t) => ({ ...t, keys: [...t.keys] })));
      if (d && d.ok === false && d.reason !== "TABLE_DECLARED") throw new Error(`following: record-core refused its tables: ${d.reason}`);
    }
    return { ok: true };
  }

  /** R18: the instance's jurisdiction view; every local fact comes from it. */
  view() {
    if (this.viewOpt) return typeof this.viewOpt === "function" ? this.viewOpt() : this.viewOpt;
    const ids = typeof this.record.getSetting === "function" ? this.record.getSetting("jurisdiction_profiles") : null;
    const c = combine(Array.isArray(ids) ? ids : []);
    return c && c.ok ? c.view : {};
  }
  /* K5292 (jurisdictions R98): the team's governing zone (its stated `team_time_zone`, else the profiles'), else the view's. */
  zone() {
    try {
      const g = typeof this.record.getSetting === "function"
        ? governingZone(this.record.getSetting("jurisdiction_profiles"), this.record.getSetting("team_time_zone")) : null;
      if (g) return g;
    } catch { /* read the view below */ }
    const z = this.view().time_zone; return z && typeof z.value === "string" ? z.value : "UTC";
  }

  async #bytes(sha) {
    if (this.bytesOpt) return this.bytesOpt(sha);
    const store = typeof this.record.evidenceStore === "function" ? this.record.evidenceStore() : null;
    if (!store || !/^[0-9a-f]{64}$/.test(String(sha))) return null;
    try { const o = await store.get(sha); return o ? new Uint8Array(await o.arrayBuffer()) : null; } catch { return null; }
  }

  /** R19 (K1666): one listener per module, told `{follow, due}` after a follow is recorded, ended, or its next due
   *  instant changes, so `scheduler` re-arms its wake. A malformed or second registration is refused through
   *  `membership.listenerRefusal`. */
  onFollowed(module, fn) {
    const refused = listenerRefusal(this.#listeners, module, fn);
    if (refused) return refused;
    this.#listeners.push({ module, fn });
    return { ok: true, module };
  }
  /* R19: each listener once, after the act; one that throws never undoes it, nor stops the others. */
  #tell(follow, due) {
    for (const l of this.#listeners) { try { l.fn({ follow, due }); } catch { /* the act stands (R19) */ } }
  }
  /* R19: a follow's next due instant as R12 computes it (null when it is ended). */
  #nextDue(id) {
    const f = this.#follow(id);
    if (!f || f.ended_at) return null;
    if (this.#pending(f)) return instant(this.now());
    if (f.last_outcome === "rate_held") return f.held_until || instant(this.now());
    const iv = this.#intervalOf(f);
    return f.last_read ? instant(ms(f.last_read) + iv) : instant(this.now());
  }
  /* G21: a followed body whose read is not yet whole is due again at once. */
  #pending(f) { const c = f.kind === "body" ? json(f.body_cursor) : null; return !!c && !c.done; }
  /* R19: a per-meeting watch's next capture instant, or null when it is unscheduled. */
  #meetingDue(address) {
    const m = this.#meetingPlan(this.now()).find((x) => x.address === address);
    return m && !m.unscheduled ? m.due_at : null;
  }

  /* ===================================================================== *
   * THE ACTS (R1, R7–R10; R4's link). Each refuses in order and writes nothing when it refuses.
   * ===================================================================== */

  /* R1: the refusals every follow shares: a machine (or absent) author, and a home the author may not see. */
  #actorRefusal(author, viewer, home) {
    if (!said(author) || isMachineIdentity(author))
      return refuse("MACHINE_CANNOT_FOLLOW", localize("following.index.follow_is_member_act", "a follow is a member's own act; the machine follows nothing of its own accord"));
    if (home != null && (!said(home) || !this.membership.inSight(home, viewer ?? author)))
      return refuse("NO_SUCH_HOME", localize("following.index.follow_home_visible_bundle", "the follow's home is a bundle you may see, whose project it lives in"));
    return null;
  }
  #cadence(c) { return c == null || c === "" ? "daily" : FOLLOW_CADENCES.includes(c) ? c : null; }
  /* `lastRead`: R20's watch counts its policy's own text capture as its first read, so it is next due 7 days after it. */
  #insert(kind, subject, { home = null, author, from = null, until = null, cadence = "daily", gated = null, at: given = null,
                           lastRead = null, ends = null }) {
    const at = given || instant(this.now());
    this.#sql.exec(`INSERT INTO follows (kind, subject, home, author, from_day, until_day, cadence, gated, at, last_read, last_outcome)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, kind, JSON.stringify(subject), home, author, from, until, cadence,
                   gated ? JSON.stringify(gated) : null, at, lastRead, lastRead ? "held" : null);
    const id = Number(this.#one(`SELECT max(follow_id) AS n FROM follows`).n);
    if (ends) this.#sql.exec(`INSERT INTO follow_ends (follow_id, ends, by, at) VALUES (?,?,?,?)`, id, ends, author, at);
    this.#tell(id, lastRead ? this.#nextDue(id) : at);
    return { ok: true, follow: id, kind, at, ends: ends || null, ...(kind === "register" && !subject.render ? { form: "static", note: STATIC_ONLY } : {}) };
  }
  /* R22: a follow's end date as given: none, or a calendar day after today's local day in the instance's zone. Answers
     `{ends}` (null: none) or `{bad}`. */
  #endsGiven(v, nowMs = this.now()) {
    if (v == null) return { ends: null };
    if (!said(v) || !isCalendarDate(v.trim())) return { bad: word("following.bad.end_date_calendar") };
    if (v.trim() <= this.#today(nowMs)) return { bad: word("following.bad.end_date_day", { today: this.#today(nowMs) }) };
    return { ends: v.trim() };
  }
  #today(nowMs = this.now()) { return localDay(instant(nowMs), this.zone()); }
  /* R22: a follow's present end date (the latest setting), or null. */
  #endsOf(id) {
    const r = this.#one(`SELECT ends FROM follow_ends WHERE follow_id=? ORDER BY seq DESC LIMIT 1`, Number(id));
    return r ? r.ends ?? null : null;
  }
  /* R22: the instant a follow's end day is over: the start of the next local day in the instance's zone. */
  #endInstant(day) {
    try { const r = dayRange(day, day, this.zone()); return r && r.end ? r.end : null; } catch { return null; }
  }
  /* R22: every live follow whose end day is over is ended by itself, once, with no one as its ender; its listeners told. */
  #endExpired(nowMs) {
    for (const r of this.#rows(`SELECT f.follow_id, e.ends FROM follows f JOIN follow_ends e ON e.follow_id = f.follow_id
                                AND e.seq = (SELECT max(seq) FROM follow_ends WHERE follow_id = f.follow_id)
                                WHERE f.ended_at IS NULL AND e.ends IS NOT NULL`)) {
      const end = this.#endInstant(r.ends);
      if (!end || ms(end) > nowMs) continue;
      this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=NULL, ended_reason='ends' WHERE follow_id=? AND ended_at IS NULL`, end, r.follow_id);
      this.#tell(Number(r.follow_id), null);
    }
  }
  /* R8: an account or fee gate as declared by the following member; anything else is a public register. */
  #gated(g) {
    if (g == null || g === false) return { gated: null };
    if (typeof g !== "object") return { bad: "a gate is {kind: 'account' | 'fee', price?}" };
    if (g.kind === "account") return { gated: { kind: "account" } };
    if (g.kind === "fee" && said(g.price)) return { gated: { kind: "fee", price: g.price.trim() } };
    return { bad: word("following.bad.fee_bearing_register") };
  }

  /** R1: a member's follow of a body for a period. */
  followBody({ body, from, until = null, cadence = null, home = null, ends = null, author, viewer = null } = {}) {
    const r = this.#actorRefusal(author, viewer, home);
    if (r) return r;
    const ents = this.entities;
    const seen = said(body) && ents.has(body.trim()) && viewerPredicate(viewer ?? author).scope !== "DENY";
    if (!seen) return refuse("NO_SUCH_BODY", localize("following.index.no_body_seen", "no body by that id is registered that you may see"));
    const id = this.#legistarId(body.trim());
    if (!id) return refuse("NO_LEGISTAR_ID", localize("following.index.body_no_legistar_id", "the body holds no identifier in a scheme the active profiles name for Legistar"));
    if (!said(from) || !isCalendarDate(from.trim()) || (until != null && (!said(until) || !isCalendarDate(until.trim()) || until.trim() < from.trim())))
      return refuse("BAD_PERIOD", localize("following.index.period_days_named", "a follow names the days it covers: from (a day), and until (a day not before it) or none"));
    const c = this.#cadence(cadence);
    if (!c) return refuse("BAD_FOLLOW_CADENCE", localize("following.index.a_follow_is_read_daily", "a follow is read daily or at a longer cadence: {FOLLOW_CADENCES}", { FOLLOW_CADENCES: String(FOLLOW_CADENCES.join(", ")) }));
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    return this.#insert("body", { kind: "body", id: body.trim(), legistar: id }, { home, author, from: from.trim(),
      until: until == null ? null : until.trim(), cadence: c, ends: e.ends });
  }
  #legistarId(body) {
    let ids = null;
    try { ids = this.entities.identifiersOf(body); } catch { ids = null; }
    return legistarBodyId(ids && ids.ok ? ids.identifiers : [], this.view());
  }

  /** R1: a follow ends only by its author's act. */
  unfollow({ follow, author } = {}) {
    const row = this.#follow(follow);
    if (!row) return refuse("NO_SUCH_FOLLOW", localize("following.index.no_follow_held", "no follow by that id is held"));
    if (!said(author) || author !== row.author) return refuse("NOT_THE_AUTHOR", localize("following.index.follow_ended_by_author_only", "a follow is ended only by the member who made it"));
    if (row.ended_at) return { ok: true, already: true, follow: row.follow_id, ended_at: row.ended_at };
    const at = instant(this.now());
    this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=?, ended_reason='author' WHERE follow_id=?`, at, author, row.follow_id);
    this.#tell(Number(row.follow_id), null);
    return { ok: true, follow: row.follow_id, ended_at: at };
  }

  /** R22: a follow's end date changed later, by its author (or by R25's answer, `#setEnds`); `ends: null` removes it.
   *  A policy watch takes none (R20). */
  followEnd({ follow, ends, by, viewer = null } = {}) {
    if (!said(by) || isMachineIdentity(by))
      return refuse("MACHINE_CANNOT_FOLLOW", localize("following.index.end_date_member_act", "a follow's end date is set by a member's own act"));
    this.#endExpired(this.now());
    const row = this.#follow(follow);
    if (!row || !this.#sees(row, viewer ?? by)) return refuse("NO_SUCH_FOLLOW", localize("following.index.no_follow_seen_held", "no follow by that id you may see is held"));
    if (row.kind === "policy")
      return refuse("WATCH_END_REFUSED", localize("following.index.policy_standing_watch_no_end", "a policy's watch is the team's standing watch: it takes no end date and ends only with the policy"));
    if (by !== row.author) return refuse("NOT_THE_AUTHOR", localize("following.index.end_date_set_by_author", "a follow's end date is set by the member who made it"));
    if (row.ended_at) return refuse("WATCH_ENDED", localize("following.index.follow_already_ended", "the follow has already ended"));
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    return this.#setEnds(row, e.ends, by);
  }
  /* R22, R25: append an end date setting and tell the listeners (the next due is unchanged; the follow's end moved). */
  #setEnds(row, ends, by) {
    const at = instant(this.now());
    this.#sql.exec(`INSERT INTO follow_ends (follow_id, ends, by, at) VALUES (?,?,?,?)`, Number(row.follow_id), ends, by, at);
    this.#tell(Number(row.follow_id), this.#nextDue(row.follow_id));
    return { ok: true, follow: Number(row.follow_id), ends, ...(ends ? {} : { ends_state: "none_set" }), at };
  }
  /* R25: a follow ended now by the answer to its once-only question. */
  #endByAnswer(row, by) {
    const at = instant(this.now());
    this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=?, ended_reason='answer' WHERE follow_id=? AND ended_at IS NULL`, at, by, Number(row.follow_id));
    this.#tell(Number(row.follow_id), null);
    return at;
  }
  #follow(id) { const n = Number(id); return Number.isSafeInteger(n) ? this.#one(`SELECT * FROM follows WHERE follow_id=?`, n) : null; }

  /** R7, R8: a member switching a watch on for a register. */
  followRegister({ address, render = false, gated = null, cadence = null, home = null, ends = null, proceeding = null, author, viewer = null } = {}) {
    const r = this.#actorRefusal(author, viewer, home);
    if (r) return r;
    if (!said(address) || !isPublicHttpsLocator(address.trim())) return refuse("NO_LOCATOR", localize("following.index.register_public_https_locator", "a register is followed at a public https locator"));
    if (render !== true && render !== false && render != null) return refuse("BAD_RENDER", localize("following.index.render_true_or_false", "render is true or false"));
    const g = this.#gated(gated);
    if (g.bad) return refuse("BAD_GATE", g.bad);
    const c = this.#cadence(cadence);
    if (!c) return refuse("BAD_FOLLOW_CADENCE", localize("following.index.a_follow_is_read_daily_2", "a follow is read daily or at a longer cadence: {FOLLOW_CADENCES}", { FOLLOW_CADENCES: String(FOLLOW_CADENCES.join(", ")) }));
    /* R29: the proceeding followed, after R7's refusals and before R22's */
    const pr = proceeding == null ? null : this.#proceedingNamed(proceeding, viewer ?? author, "following a register names the proceeding it is followed for");
    if (pr && pr.refusal) return pr.refusal;
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    return this.#insert("register", { kind: "register", address: address.trim(), render: render === true, ...(pr ? { proceeding: pr.id } : {}) },
                        { home, author, cadence: c, gated: g.gated, ends: e.ends });
  }

  /* R29, R30, R31: `{id}` for a registered entity of kind `proceeding` that `viewer` may see; else `{refusal}`: absent or
     unseen alike `NO_SUCH_ENTITY` (`entities.noSuchEntity`), another kind `NOT_A_PROCEEDING` (`entities.notAProceeding`,
     the one site minting it). `asked` finishes the sentence naming what was asked of it. */
  #proceedingNamed(value, viewer, asked) {
    const id = typeof value === "string" ? value.trim() : "";
    let r = null;
    if (id && said(viewer) && viewerPredicate(viewer).scope !== "DENY") { try { r = this.entities.readEntity({ entityId: id, viewer }); } catch { r = null; } }
    const e = r && r.ok && r.found && r.entity ? r.entity : null;
    if (!e) return { refusal: noSuchEntity(id || null) };
    if (e.kind !== "proceeding")
      return { refusal: notAProceeding(`${asked}, an entity of kind proceeding; the entity named is of kind ${e.kind}.`, { entity_id: id, kind: e.kind }) };
    return { id };
  }

  /* R29: the newest capture of a register followed for a proceeding handed to `events.followedRegister` (its R38), as
     the machine's; its answer as given, or its refusal's reason. Never throws. */
  #handRegister(captureSha, proceeding) {
    try {
      const r = this.events.followedRegister({ captureSha, proceeding, by: MACHINE });
      return r && typeof r === "object" ? r : { ok: false, reason: "NO_ANSWER" };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
  }

  /** R9: a register's own query for one identifier a member names for a person. */
  followPersonQuery({ register, scheme, value, address, person = null, gated = null, cadence = null, home = null, ends = null, author, viewer = null } = {}) {
    const r = this.#actorRefusal(author, viewer, home);
    if (r) return r;
    const no = (detail) => refuse("PERSON_QUERY_NOT_NAMED", detail);
    const view = this.view();
    const sch = (Array.isArray(view.identifier_schemes) ? view.identifier_schemes : []).find((s) => s && s.scheme === scheme);
    if (!said(register) || !sch || !Array.isArray(sch.systems) || !sch.systems.includes(register))
      return no("the query names one register and a scheme the active profiles list for it; a query by name alone or across registers is not followed");
    if (!this.#inScheme(view, sch, value)) return no("the value is not an identifier of that scheme's form; a name is not an identifier");
    if (!said(address) || !isPublicHttpsLocator(address.trim()) || !this.#ofRegister(view, register, address.trim())
        || !decodeURIComponent(address).includes(String(value).trim()))
      return no("the query is the register's own address for that identifier, on the register's host, carrying the value");
    if (!said(home)) return no("a person query's follow lives in its author's project: name its home");
    if (person != null && !(said(person) && this.entities.has(person.trim()))) return no("the person named is not a registered entity");
    const g = this.#gated(gated);
    if (g.bad) return refuse("BAD_GATE", g.bad);
    const c = this.#cadence(cadence);
    if (!c) return refuse("BAD_FOLLOW_CADENCE", localize("following.index.a_follow_is_read_daily_3", "a follow is read daily or at a longer cadence: {FOLLOW_CADENCES}", { FOLLOW_CADENCES: String(FOLLOW_CADENCES.join(", ")) }));
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    return this.#insert("person-query", { kind: "person-query", register, scheme, value: String(value).trim(), address: address.trim(),
      person: person == null ? null : person.trim() }, { home, author, cadence: c, gated: g.gated, ends: e.ends });
  }
  #inScheme(view, sch, value) {
    if (value == null || String(value).trim() === "") return false;
    const space = view.spaces && view.spaces[sch.space];
    const forms = (space && Array.isArray(space.forms) ? space.forms : []).filter((f) => !sch.form || f.form === sch.form);
    return forms.some((f) => { try { return new RegExp(f.pattern.re, f.pattern.flags || "").test(String(value).trim()); } catch { return false; } });
  }
  #ofRegister(view, origin, address) {
    let u;
    try { u = new URL(address); } catch { return false; }
    return (Array.isArray(view.systems) ? view.systems : []).some((s) => {
      if (!s || s.origin !== origin || !Array.isArray(s.hosts) || !s.hosts.map((h) => String(h).toLowerCase()).includes(u.host.toLowerCase())) return false;
      if (!s.path) return true;
      try { return new RegExp(s.path.re, s.path.flags || "").test(`${u.pathname}${u.search}`); } catch { return false; }
    });
  }

  /** R37 (T53; N1259; K4405 (1)): a register's own answer for one number a member names (a filer, licence, docket or company
   *  number), at the address the profile's query template composes from the scheme and the value; the member never types an
   *  address. Refused in order, writing nothing: a machine author, a home the author cannot use; registers' own
   *  NO_SUCH_REGISTER, REGISTER_NOT_IN_ALPHA and REGISTER_NOT_MEASURED (a gated or fee-bearing register is followed under R8);
   *  QUERY_NOT_NAMED for a name, a value not of the scheme's form, a scheme not listed for that register, a pattern, a list
   *  or two registers; NO_SUCH_ENTITY; BAD_FOLLOW_CADENCE; R41's alert on anything but a CourtListener docket, BAD_ALERT;
   *  WATCH_END_REFUSED. */
  followRegisterQuery({ register, scheme, value, entity = null, home = null, cadence = null, ends = null, alert = null, name = undefined,
                        author, viewer = null } = {}) {
    const r = this.#actorRefusal(author, viewer, home);
    if (r) return r;
    /* a follow lives in its author's project (R17): its home is named */
    if (!said(home)) return refuse("NO_SUCH_HOME", localize("following.index.register_watch_home", "a register watch lives in its author's project: name a home you may see"));
    const no = (detail) => refuse("QUERY_NOT_NAMED", detail);
    /* DEC-49 REGION is-query-named */
    if (Array.isArray(register) || (register && typeof register === "object"))
      return no(localize("following.index.query_one_register", "a watch names one register; a call across registers is not followed"));
    const st = this.#registerStatus(register);
    if (st.refusal) return st.refusal;
    if (name !== undefined && name !== null)
      return no(localize("following.index.query_not_by_name", "a register is watched by a number, never by a name"));
    if (!said(scheme) || typeof value !== "string" || !value.trim() || /[*?%_\[\]{}|,;\s]/.test(value.trim()))
      return no(localize("following.index.query_one_value", "a watch names one value of its scheme; a pattern, a wildcard or a list is not followed"));
    const view = this.view();
    const listed = this.#schemeListed(view, scheme, register);
    const q = listed ? queryAddress(view, scheme, register, value.trim()) : { ok: false, reason: "NOT_LISTED" };
    if (!q.ok) return no(q.reason === "VALUE_NOT_OF_FORM"
      ? localize("following.index.query_value_form", "the value is not a number of that scheme's form; a name or a part of a number is not followed")
      : localize("following.index.query_scheme_listed", "the scheme is not one the active profiles list for that register"));
    /* END DEC-49 REGION is-query-named */
    const ent = entity == null ? null : this.#entitySeen(entity, viewer ?? author);
    if (ent && ent.refusal) return ent.refusal;
    const c = this.#cadence(cadence);
    if (!c) return refuse("BAD_FOLLOW_CADENCE", localize("following.index.a_follow_is_read_daily_5", "a follow is read daily or at a longer cadence: {FOLLOW_CADENCES}", { FOLLOW_CADENCES: String(FOLLOW_CADENCES.join(", ")) }));
    /* DEC-49 REGION is-alert-docket */
    if (alert != null && (!ALERT_KINDS.includes(alert) || scheme !== "docket" || !docketEntriesAddress(q.address)))
      return refuse("BAD_ALERT", localize("following.index.alert_docket_only", "a daily check of new filings is carried only by a docket number followed at the national docket service"));
    /* END DEC-49 REGION is-alert-docket */
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    return this.#insert("register-query", { kind: "register-query", register, scheme, value: value.trim(), address: q.address,
      entity: ent ? ent.id : null, entity_kind: ent ? ent.kind : null, ...(alert != null ? { alert } : {}) },
      { home, author, cadence: c, gated: st.gated, ends: e.ends });
  }
  /* R37: a register's status as `registers` answers it (`registerFilter` with no project: a read that writes nothing):
     `{gated}` (null, or the gate a member's act passes, R8), or `{refusal}`, registers' own. */
  #registerStatus(register) {
    let a;
    try { a = this.registers.registerFilter({ register: typeof register === "string" ? register.trim() : register }); }
    catch (e) { return { refusal: { ok: false, reason: "NO_REGISTERS", code: "NO_REGISTERS", detail: String((e && e.message) || e).slice(0, 160) } }; }
    if (a && a.ok === false && a.reason === "member_act_required") return { gated: { kind: a.gate || "account" } };
    if (!a || a.ok === false) return { refusal: a || { ok: false, reason: "NO_ANSWER" } };
    return { gated: null };
  }
  /* R37: a scheme the profile lists for a register: `registers.registerFor` names it, or a query template pairs them. */
  #schemeListed(view, scheme, register) {
    let regs = [];
    try { const f = this.registers.registerFor({ scheme }); regs = f && Array.isArray(f.registers) ? f.registers : []; } catch { regs = []; }
    if (regs.includes(register)) return true;
    return (Array.isArray(view.query_templates) ? view.query_templates : []).some((t) => t && t.scheme === scheme && t.register === register);
  }
  /* R37: an entity the author may see (`entities.noSuchEntity` else, as R29). */
  #entitySeen(value, viewer) {
    const id = typeof value === "string" ? value.trim() : "";
    let r = null;
    if (id && said(viewer) && viewerPredicate(viewer).scope !== "DENY") { try { r = this.entities.readEntity({ entityId: id, viewer }); } catch { r = null; } }
    return r && r.ok && r.found && r.entity ? { id, kind: r.entity.kind } : { refusal: noSuchEntity(id || null) };
  }

  /** R45, R46 (T53): a `register-query` or `register-interest` follow stopped now, as `unfollow`, by a member who may see
   *  it (its author, or for an interest's watch any member of its project); what was brought in stays in the record. */
  registerWatchStop({ follow, author, viewer = null } = {}) {
    if (!said(author) || isMachineIdentity(author))
      return refuse("MACHINE_CANNOT_FOLLOW", localize("following.index.stop_is_member_act", "a watch is stopped by a member's own act"));
    const row = this.#follow(follow);
    if (!row || !REGISTER_WATCH_KINDS.includes(row.kind) || !this.#sees(row, viewer ?? author))
      return refuse("NO_SUCH_FOLLOW", localize("following.index.no_register_watch_seen", "no register watch by that id you may see is held"));
    if (row.kind === "register-query" && author !== row.author)
      return refuse("NOT_THE_AUTHOR", localize("following.index.register_watch_author", "a watch of a number is stopped by the member who made it"));
    if (row.ended_at) return { ok: true, existed: true, follow: Number(row.follow_id), ended_at: row.ended_at };
    const at = instant(this.now());
    this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=?, ended_reason='author' WHERE follow_id=? AND ended_at IS NULL`, at, author, row.follow_id);
    this.#tell(Number(row.follow_id), null);
    return { ok: true, follow: Number(row.follow_id), ended_at: at };
  }

  /** R41 (`acquisition` R130's `followStanding`): whether a member still follows the case a daily keyed check names: a live
   *  `register-query` follow carrying `alert` for that service. Never throws. */
  followStanding({ follow, service } = {}) {
    try {
      const f = this.#follow(follow);
      const s = f ? json(f.subject) || {} : {};
      return !!f && !f.ended_at && f.kind === "register-query" && s.alert === service && service === ALERT_SERVICE;
    } catch { return false; }
  }

  /** R39 (T53; K4405 (1), (5)): this module's registration with `registers.onInterest` (its R32), at start: a stated interest
   *  watched automatically becomes one `register-interest` follow; switched off, forgotten or its project closed, the follow
   *  ends. Registered when the plane's registers is built on this host (its tables are held) or one is handed in; a
   *  refused registration is a start-up fault, reported by throwing. */
  registerInterests(given = false) {
    if (!given && !this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='register_interests'`)) return { ok: false, reason: "NO_REGISTERS" };
    let rg;
    try { rg = this.registers; } catch (e) { return { ok: false, reason: "NO_REGISTERS", detail: String((e && e.message) || e).slice(0, 160) }; }
    if (!rg || typeof rg.onInterest !== "function") return { ok: false, reason: "NO_REGISTERS" };
    const r = rg.onInterest(FOLLOWING_MODULE, (e) => this.#onInterest(e));
    if (!r || r.ok === false) throw new Error(`following: registers refused its interest listener: ${(r && r.reason) || "no answer"}`);
    return r;
  }
  /* R39: the listener: `{interest, watch}` after registers' act. */
  #onInterest(e) {
    const i = e && e.interest;
    if (!i || i.id == null) return;
    const live = this.#rows(`SELECT follow_id, subject FROM follows WHERE kind='register-interest' AND ended_at IS NULL`)
      .filter((x) => String((json(x.subject) || {}).interest) === String(i.id));
    if (e.watch === true && !i.ended) {
      if (live.length) return;
      this.#insert("register-interest", { kind: "register-interest", interest: i.id, project: i.project, register: i.register },
                   { home: i.project, author: said(i.by) ? i.by : "", cadence: "daily" });
      return;
    }
    for (const x of live) this.#endInterest(Number(x.follow_id), i.ended ? "interest_forgotten" : "interest_unwatched");
  }
  #endInterest(id, reason) {
    this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=NULL, ended_reason=? WHERE follow_id=? AND ended_at IS NULL`, instant(this.now()), reason, id);
    this.#tell(id, null);
  }
  /* R39: an interest's follow ends with its project: a project bundle closed ends every live interest watch living in it. */
  #endClosedProjects() {
    for (const x of this.#rows(`SELECT f.follow_id FROM follows f JOIN bundles b ON b.bundle_id = f.home
                                WHERE f.kind='register-interest' AND f.ended_at IS NULL AND b.current_state IN ('closed', 'archived')`))
      this.#endInterest(Number(x.follow_id), "project_closed");
  }
  /* R39: a register-interest follow is read no more often than daily, and never faster than its source's stated cadence. */
  #intervalOf(f) {
    const iv = MONITOR_CADENCE_MS[f.cadence] ?? MONITOR_CADENCE_MS.daily;
    if (f.kind !== "register-interest") return iv;
    try {
      const d = this.registers.definitionOf((json(f.subject) || {}).register);
      const h = d && d.definition && d.definition.refresh ? Number(d.definition.refresh.cadence_hours) : NaN;
      return Number.isFinite(h) && h > 0 ? Math.max(iv, h * 3600000) : iv;
    } catch { return iv; }
  }

  /** R10: a portal's dataset, keyed to its query, with a declared key field. */
  followPortal({ address, query = null, key, cadence = null, home = null, ends = null, author, viewer = null } = {}) {
    const r = this.#actorRefusal(author, viewer, home);
    if (r) return r;
    if (!said(address) || !isPublicHttpsLocator(address.trim())) return refuse("NO_LOCATOR", localize("following.index.portal_public_https_locator", "a portal is followed at a public https locator"));
    const q = portalKey(address.trim(), query);
    if (!q) return refuse("NO_LOCATOR", localize("following.index.portal_public_https_locator_2", "a portal is followed at a public https locator"));
    if (!said(key)) return refuse("NO_KEY", localize("following.index.portal_declares_key_field", "a portal follow declares the field that keys its rows"));
    const c = this.#cadence(cadence);
    if (!c) return refuse("BAD_FOLLOW_CADENCE", localize("following.index.a_follow_is_read_daily_4", "a follow is read daily or at a longer cadence: {FOLLOW_CADENCES}", { FOLLOW_CADENCES: String(FOLLOW_CADENCES.join(", ")) }));
    const e = this.#endsGiven(ends);
    if (e.bad) return refuse("WATCH_END_REFUSED", e.bad);
    const held = this.#rows(`SELECT follow_id, subject FROM follows WHERE kind='portal' AND ended_at IS NULL`)
      .find((x) => { const s = json(x.subject); return s && s.address === q && s.key === key.trim(); });
    if (held) return { ok: true, already: true, follow: Number(held.follow_id) };
    return this.#insert("portal", { kind: "portal", address: q, key: key.trim() }, { home, author, cadence: c, ends: e.ends });
  }

  /** R4 (K1505 (15)): the body and notice period of a `per_meeting` watch. */
  perMeetingBody({ address, body, notice = null, author, viewer = null } = {}) {
    if (!said(author) || isMachineIdentity(author))
      return refuse("MACHINE_CANNOT_FOLLOW", localize("following.index.watch_body_member_act", "naming a watch's body is a member's own act"));
    const sub = this.#perMeetingSubjects(this.now()).find((s) => s.address === (said(address) ? address.trim() : null)
      && this.membership.inSight(s.bundle, viewer ?? author));
    if (!sub) return refuse("NO_SUCH_MEETING_ADDRESS", localize("following.index.no_address_per_meeting", "no address you may see is watched per meeting"));
    if (!said(body) || !this.entities.has(body.trim())) return refuse("NO_SUCH_BODY", localize("following.index.no_body_registered_seen", "no body by that id is registered that you may see"));
    const at = instant(this.now());
    this.#sql.exec(`INSERT INTO per_meeting_links (address, bundle_id, body, notice, author, at) VALUES (?,?,?,?,?,?)`,
                   sub.address, sub.bundle, body.trim(), said(notice) ? notice.trim() : null, author, at);
    this.#tell(`per_meeting:${sub.address}`, this.#meetingDue(sub.address));
    return { ok: true, address: sub.address, body: body.trim(), notice: said(notice) ? notice.trim() : null, at };
  }

  /* ===================================================================== *
   * THE PLAN (R4, R5, R12): what is due, when, and what is not scheduled.
   * ===================================================================== */

  /* The `per_meeting` subjects monitoring holds (its R14, R16: unscheduled, no interval). */
  #perMeetingSubjects(nowMs) {
    let s = null;
    try { s = this.monitoring.schedule(nowMs); } catch { s = null; }
    return (s && Array.isArray(s.unscheduled) ? s.unscheduled : []).filter((u) => u.frequency === "per_meeting" && said(u.address));
  }

  /* R4, R5: each per_meeting watch's next capture, or why it is unscheduled. */
  #meetingPlan(nowMs) {
    const out = [];
    const view = this.view(), zone = this.zone();
    for (const sub of this.#perMeetingSubjects(nowMs)) {
      const link = this.#one(`SELECT * FROM per_meeting_links WHERE address=? ORDER BY seq DESC LIMIT 1`, sub.address);
      const base = { kind: "meeting", address: sub.address, bundle: sub.bundle };
      if (!link || !link.body) { out.push({ ...base, unscheduled: word("following.unscheduled.watch_names_body") }); continue; }
      const n = noticeRule(view, link.notice);
      if (n.why) { out.push({ ...base, body: link.body, unscheduled: n.why }); continue; }
      let label = null, observed = [];
      try { const e = this.entities.readEntity({ entityId: link.body, viewer: MACHINE }); label = e && e.entity ? e.entity.label : null; } catch { label = null; }
      try { const e = this.events.eventsFor({ entity: link.body, kinds: ["meeting"], viewer: MACHINE, limit: 500 }); observed = e && e.ok ? e.events : []; } catch { observed = []; }
      const since = ms(link.at);
      const m = meetingsOf({ view, bodyLabel: label, observed, fromMs: since, zone });
      if (m.why) { out.push({ ...base, body: link.body, unscheduled: m.why }); continue; }
      let next = null, why = null;
      for (const meeting of m.meetings) {
        if (this.#one(`SELECT 1 AS x FROM per_meeting_captures WHERE address=? AND meeting=?`, sub.address, meeting.instant)) continue;
        const d = dueBefore(meeting, n.rule, view);
        if (d.why) { why = d.why; continue; }
        if (ms(meeting.instant) < since) continue;
        next = { ...base, body: link.body, notice: n.rule.rule, meeting: meeting.instant, meeting_source: meeting.source,
                 ...(meeting.event_id ? { event_id: meeting.event_id } : {}), due_at: d.at };
        break;
      }
      if (next) out.push(next);
      else if (why) out.push({ ...base, body: link.body, unscheduled: why });
    }
    return out;
  }

  /* R12: each live follow's next read: due daily (or at its longer cadence) from its last read; never read, now. */
  #followPlan(nowMs) {
    return this.#rows(`SELECT * FROM follows WHERE ended_at IS NULL ORDER BY follow_id`).map((f) => {
      const iv = this.#intervalOf(f);
      /* R42: a docket held back by the service's limits is due again at once, first among those waiting since its last read */
      const due = f.last_outcome === "rate_held" ? (f.held_until ? ms(f.held_until) : null)
        : f.last_read && !this.#pending(f) ? ms(f.last_read) + iv : null;
      return { kind: "follow", follow: f, id: Number(f.follow_id), due_at: due == null ? null : instant(due), dueMs: due ?? 0 };
    });
  }

  /** R12: everything due now, oldest due first, and the earliest instant one falls due. */
  plan(now) {
    const nowMs = Number.isFinite(now) ? now : this.now();
    this.#syncPolicies(nowMs);
    this.#endExpired(nowMs);
    this.#endClosedProjects();
    const follows = this.#followPlan(nowMs), meetings = this.#meetingPlan(nowMs);
    const due = [], unscheduled = [];
    let wake = null;
    const consider = (t) => { if (wake === null || t < wake) wake = t; };
    for (const f of follows) {
      if (f.dueMs <= nowMs) due.push(f); else consider(f.dueMs);
      /* R22: the instant its end day is over is a wake too, so the end is recorded and told then */
      const e = this.#endsOf(f.id), end = e ? this.#endInstant(e) : null;
      if (end) consider(ms(end));
    }
    for (const m of meetings) {
      if (m.unscheduled) { unscheduled.push(m); continue; }
      const t = ms(m.due_at);
      if (t <= nowMs) due.push({ ...m, dueMs: t }); else consider(t);
    }
    /* oldest due first; then follows by id, then meetings by address */
    due.sort((a, b) => (a.dueMs - b.dueMs) || ((a.id ?? Infinity) - (b.id ?? Infinity))
      || String(a.address ?? "").localeCompare(String(b.address ?? "")) || 0);
    return { due, unscheduled, wake };
  }

  /** R12: due while any follow or per-meeting capture is due. */
  followDue(now) { return this.plan(now).due.length > 0; }
  /** R12: the earliest instant one falls due (now when one is), or null. */
  followWake(now) {
    const nowMs = Number.isFinite(now) ? now : this.now();
    const p = this.plan(nowMs);
    return p.due.length ? nowMs : p.wake;
  }

  /* ===================================================================== *
   * THE TICK (R13), and each subject's read (R2, R3, R4, R6–R10).
   * ===================================================================== */

  /** R13: at most 50 due subjects, oldest due first or in the rank's order, each claimed under the host's epoch. */
  async followTick(now, rank = null) {
    const h = this.host;
    const nowMs = Number.isFinite(now) ? now : this.now();
    const at = instant(nowMs);
    const answer = { configured: true, at, epoch: null, read: [], captured: [], unscheduled: [], member_act_required: [], failed: [], paused: h.paused() };
    /* R42: the poll's lists, present only while a live follow carries an alert (the key set stays as it was otherwise) */
    const alerting = this.#rows(`SELECT subject FROM follows WHERE kind='register-query' AND ended_at IS NULL`).some((x) => (json(x.subject) || {}).alert);
    if (alerting) Object.assign(answer, { polled: [], rate_held: [], alert_off: [] });
    if (answer.paused.paused) return { ...answer, note: word("following.note.daemon_paused_administrator") };
    if (h.running.has(FOLLOW_CONSUMER)) return { ...answer, busy: true };
    h.running.add(FOLLOW_CONSUMER);
    try {
      const p = this.plan(nowMs);
      answer.unscheduled = p.unscheduled.map((u) => ({ address: u.address, bundle: u.bundle, ...(u.body ? { body: u.body } : {}), reason: u.unscheduled }));
      const read = typeof rank === "function" ? p.due.slice(0, FOLLOW_TICK_BATCH * 10) : p.due;
      const batch = h.ranked(read, (x) => ({ kind: x.kind === "meeting" ? "meeting" : `follow:${x.follow.kind}`, id: this.#subjectKey(x),
                                            waitingSince: x.dueMs > 0 ? x.dueMs : null }), rank, nowMs).slice(0, FOLLOW_TICK_BATCH);
      const epoch = h.openEpoch(FOLLOW_CONSUMER, nowMs, EPOCH_MS);
      answer.epoch = epoch;
      const skipped = [];
      for (const x of batch) {
        const key = this.#subjectKey(x);
        if (!h.claim(FOLLOW_CONSUMER, key, epoch)) { skipped.push(key); continue; }
        try {
          const r = x.kind === "meeting" ? await this.#readMeeting(x, nowMs) : await this.#readFollow(x.follow, nowMs);
          if (r.member_act_required) answer.member_act_required.push(r.member_act_required);
          else answer.read.push(r.read);
          for (const k of ["polled", "rate_held", "alert_off"]) if (r[k] && answer[k]) answer[k].push(r[k]);
          for (const c of r.captured || []) answer.captured.push(c);
          for (const f of r.failed || []) answer.failed.push(f);
        } catch (e) { answer.failed.push({ subject: key, reason: String((e && e.message) || e).slice(0, 200) }); }
      }
      if (skipped.length) answer.skipped = skipped;
      if (!answer.failed.length && !skipped.length) h.closeEpoch(FOLLOW_CONSUMER, epoch);
      return answer;
    } finally { h.running.delete(FOLLOW_CONSUMER); }
  }
  #subjectKey(x) { return x.kind === "meeting" ? `meeting:${x.address}@${x.meeting}` : `follow:${x.id}`; }

  /* R4, R6: the watch's capture before its meeting, through monitoring's own check of the document, with the lateness. */
  async #readMeeting(x, nowMs) {
    const r = await this.monitoring.monitor({ bundleId: x.bundle, viewer: MACHINE, actorClass: "machine", actor: MACHINE });
    const b = (r && r.body) || {};
    const lateness = nowMs - ms(x.due_at);
    const taken = instant(nowMs);
    const outcome = b.ok ? "captured" : `failed: ${b.reason || "no answer"}`;
    const entry = { address: x.address, bundle: x.bundle, meeting: x.meeting, due_at: x.due_at, taken_at: taken, lateness_ms: lateness,
                    after_meeting_began: nowMs >= ms(x.meeting), ...(b.capture ? { capture: b.capture.sha256 ?? null } : {}) };
    if (!b.ok) return { read: { subject: `meeting:${x.address}`, outcome }, failed: [{ ...entry, reason: b.reason || word("following.reason.check_did_answer") }] };
    this.#sql.exec(`INSERT OR REPLACE INTO per_meeting_captures (address, meeting, bundle_id, due_at, taken_at, lateness_ms, outcome) VALUES (?,?,?,?,?,?,?)`,
                   x.address, x.meeting, x.bundle, x.due_at, taken, lateness, outcome);
    this.#tell(`per_meeting:${x.address}`, this.#meetingDue(x.address));
    return { read: { subject: `meeting:${x.address}`, outcome: "captured", lateness_ms: lateness }, captured: [{ kind: "per_meeting", ...entry }] };
  }

  /* One follow's read, by its kind. */
  async #readFollow(f, nowMs) {
    const subject = json(f.subject) || {};
    const at = instant(nowMs);
    const gated = json(f.gated);
    let r;
    if (f.kind === "policy" && POLICY_GATED_ACCESS.includes(subject.access)) {
      /* R20, R8, R15: a policy behind an account or a fee is never read on the tick, nothing fetched */
      r = { member_act_required: { follow: Number(f.follow_id), kind: f.kind, standard: subject.standard, gate: subject.access,
            why: word("following.why.policy_read_member") }, outcome: "member_act_required" };
    } else if (gated && GATED_KINDS.includes(f.kind)) {
      /* R8, R15: never read on the tick, nothing fetched */
      r = { member_act_required: { follow: Number(f.follow_id), kind: f.kind, gate: gated.kind, ...(gated.price ? { price: gated.price } : {}),
            why: word("following.why.register_read_act") }, outcome: "member_act_required" };
    } else if (f.kind === "body") r = await this.#readBody(f, subject, nowMs);
    else if (f.kind === "portal") r = await this.#readPortal(f, subject, nowMs);
    else if (f.kind === "policy") r = await this.#readPolicy(f, subject, nowMs);
    else if (f.kind === "register-interest") r = await this.#readInterest(f, subject, nowMs);
    else if (f.kind === "register-query") r = await this.#readQuery(f, subject, nowMs);
    else r = await this.#readRegister(f, subject, nowMs);
    /* a failed read stays due (its epoch stays open, so this tick's retry reads it again only under a fresh epoch); a
       policy watch's failed attempt counts as its read, so its address is fetched at most every 7 days (R20, K1881) */
    if (r.held) {
      /* R39, R42: held back (the service's limits, the host's pause): nothing was read, and the follow stays due */
      this.#sql.exec(`UPDATE follows SET last_outcome=?, held_until=? WHERE follow_id=?`, r.outcome, r.held_until || null, f.follow_id);
      this.#tell(Number(f.follow_id), r.held_until || at);
    } else if (r.pending) {
      /* G21: a body's read not yet whole goes on at the next tick; its last read is the last whole one */
      this.#sql.exec(`UPDATE follows SET last_outcome=? WHERE follow_id=?`, r.outcome, f.follow_id);
      this.#tell(Number(f.follow_id), at);
    } else if (r.outcome === "failed" && f.kind !== "policy") this.#sql.exec(`UPDATE follows SET last_outcome=? WHERE follow_id=?`, r.outcome, f.follow_id);
    else {
      this.#sql.exec(`UPDATE follows SET last_read=?, last_outcome=?, held_until=NULL WHERE follow_id=?`, at, r.outcome, f.follow_id);
      this.#tell(Number(f.follow_id), this.#nextDue(f.follow_id));
    }
    return r;
  }

  /* One address read through acquire's capture-request arm (R2, R7, R9, R10), held bytes compared, and landed when new.
     `member` and `credential` are R8's (a member's own act); the tick passes neither (R15). */
  async #take(f, address, nowMs, { render = false, reading = null, member = null, credential = null, notPublic = false, title = null,
                                   home = f.home } = {}) {
    const held = this.#one(`SELECT * FROM follow_reads WHERE follow_id=? AND address=?`, f.follow_id, address);
    const opts = { cls: member ? "member" : "daemon", member: !!member, sessMember: member || null,
      captureRequest: { locator: address, purpose: FOLLOW_PURPOSE, agent: null, render: render === true,
        ...(held ? { heldSha: held.capture_sha } : {}), ...(credential ? { credential } : {}) } };
    let a;
    try { const r = await this.capture.acquire({}, opts); a = (r && r.body) || r || { ok: false, reason: "NO_ANSWER" }; }
    catch (e) { a = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
    if (!a.ok) return { failed: { address, reason: a.reason || a.code || "failed" } };
    const sha = (a.document && a.document.capture && a.document.capture.sha256) || (a.capture && a.capture.sha256) || null;
    if (!sha) return { failed: { address, reason: word("following.reason.capture_named_digest") } };
    if (a.unchanged === true || (held && held.capture_sha === sha)) return { sha, same: true, bundle: held ? held.bundle_id : null };
    const at = instant(nowMs);
    const doc = { ...a.document };
    let bytes = null;
    if (reading) {
      bytes = await this.#bytes(sha);
      const rd = bytes ? reading(bytes, doc.locator || address, at) : null;
      if (rd) doc.reading = rd;
    }
    if (notPublic) doc.capture = { ...doc.capture, reproducible_by_public: false };
    const by = f.kind === "policy" ? word("following.text.group_standing_watch") : word("following.text.member_standing_act", { author: f.author });
    const landed = this.host.land({ id: `follow ${f.follow_id}`, bundle: home, locators: [address], target: null }, { locator: address, doc }, at, {
      title: title || word("following.title.followed", { address }),
      summary: word("following.summary", { address, follow_id: f.follow_id }),
      notes: word("following.notes", { follow_id: f.follow_id, kind: f.kind, by, at, not_public: notPublic ? ` ${NOT_PUBLIC}.` : "" }),
      trigger: `follow ${f.follow_id}` });
    if (!landed || !landed.ok) return { failed: { address, reason: (landed && (landed.reason || landed.detail)) || "NOT_FILED" } };
    this.#sql.exec(`INSERT OR REPLACE INTO follow_reads (follow_id, address, capture_sha, bundle_id, facts, at) VALUES (?,?,?,?,?,?)`,
                   f.follow_id, address, sha, landed.bundle_id, held ? held.facts : null, at);
    return { sha, same: false, bundle: landed.bundle_id, bytes, reading: doc.reading || null };
  }

  /* R2, R3: a body's Legistar records for its followed period, each read handed to `legistar-reader` and to events.
     G21 (K4571): one pass reads every page of the meetings and of the matters; a tick that reaches BODY_READ_FETCHES
     keeps where it stopped (`follows.body_cursor`) and the next tick goes on from there, until the pass is whole. */
  async #readBody(f, s, nowMs) {
    const { client, id } = s.legistar || {};
    const to = f.until_day || null;
    const period = { from: f.from_day, to: f.until_day };
    const captured = [], failed = [], imported = [];
    let fetches = 0, truncated = false;
    const legistarReading = (bytes, locator, at) => {
      try { return { content_type: LEGISTAR_KEY, reader_version: 1, found: true, at, entities: [], facts: parseLegistar({ locator, bytes, at }) }; }
      catch { return null; }
    };
    const read = async (address, imports = true) => {
      if (fetches >= BODY_READ_FETCHES) { truncated = true; return null; }
      fetches++;
      const t = await this.#take(f, address, nowMs, { reading: legistarReading, title: word("following.title.followed_body", { id: s.id, address }) });
      if (t.failed) { failed.push({ follow: Number(f.follow_id), ...t.failed }); return null; }
      if (!t.same) captured.push({ kind: "legistar", follow: Number(f.follow_id), address, capture: t.sha, bundle: t.bundle });
      if (!t.same && imports) {
        let imp;
        try { imp = this.events.followedImport({ captureSha: t.sha, body: s.id, period, by: MACHINE }); }
        catch (e) { imp = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
        if (imp && imp.ok === false) failed.push({ follow: Number(f.follow_id), address, reason: word("following.reason.events_refused_import", { imp: imp.reason }) });
        else imported.push({ address, capture: t.sha });
      }
      return t;
    };
    const parsed = (bytes, locator) => {
      if (!bytes) return null;
      try { const p = parseLegistar({ locator, bytes, at: null }); return { rows: p.rows, next: (p.page && p.page.next) || null }; } catch { return null; }
    };
    /* One page's rows and the address of the next. `held`: the page this pass already took, read from the held bytes
       with no fetch. `walk` is false for a page whose bytes equal the last pass's (its rows were walked then). */
    const pageOf = async (address, imports, held) => {
      if (held) {
        const h = this.#one(`SELECT capture_sha FROM follow_reads WHERE follow_id=? AND address=?`, f.follow_id, address);
        const p = h ? parsed(await this.#bytes(h.capture_sha), address) : null;
        if (p) return { ...p, walk: true };
      }
      const t = await read(address, imports);
      const p = t ? parsed(t.bytes || await this.#bytes(t.sha), address) : null;
      return p ? { ...p, walk: !t.same } : null;
    };
    /* a meeting's items, or an item's votes, are one Legistar page (1,000 rows): more is said, never read in part */
    const listOf = async (address, held) => {
      const p = await pageOf(address, true, held);
      if (p && p.next) failed.push({ follow: Number(f.follow_id), address, reason: "PAGE_LIMIT" });
      return p;
    };
    const prior = json(f.body_cursor);
    /* phase, the page's address, the row to go on at (`idx`, and in a meeting the item `vi`), the meetings before this page
       (`base`) and on it (`size`), whether the page is already taken (`got`) and whether more pages follow (`more`) */
    let st = prior && !prior.done ? prior
      : { phase: "events", addr: eventsAddress(client, id, f.from_day, to), idx: 0, vi: null, base: 0, size: 0, got: false, walk: false, more: false, meetings: 0 };
    const advance = (phase, addr) => {
      const meetings = st.phase === "events" && phase === "matters" ? st.base + st.size : st.meetings;
      st = { ...st, phase, addr, idx: 0, vi: null, got: false, walk: false, base: phase === st.phase ? st.base + st.size : 0, size: 0, more: phase === "events", meetings };
    };
    /* the meetings, then each meeting's items, then each item's votes (an item is written within its meeting) */
    while (st.phase === "events" && !truncated) {
      const p = await pageOf(st.addr, true, st.got);
      if (!p) { if (!truncated) advance("matters", mattersAddress(client, id, f.from_day, to)); break; }
      if (!st.got) { st.got = true; st.walk = p.walk; st.size = p.rows.length; st.more = !!p.next; if (!st.walk) st.idx = st.size; }
      for (; st.idx < st.size; st.idx++, st.vi = null) {
        const e = p.rows[st.idx];
        const items = await listOf(itemsAddress(client, e.ids.EventId), st.vi !== null);
        if (truncated) break;
        for (let j = st.vi ?? 0; items && items.walk && j < items.rows.length; j++) {
          st.vi = j;
          await listOf(votesAddress(client, items.rows[j].ids.EventItemId), false);
          if (truncated) break;
        }
        if (truncated) break;
      }
      if (truncated) break;
      if (p.next) advance("events", p.next);
      else advance("matters", mattersAddress(client, id, f.from_day, to));
    }
    /* R3: a matter whose enactment record moved is captured anew at its own address (a new version there) */
    while (st.phase === "matters" && !truncated) {
      const p = await pageOf(st.addr, false, st.got);
      if (!p) { if (!truncated) st = { done: true, meetings: st.meetings }; break; }
      if (!st.got) { st.got = true; st.walk = p.walk; st.size = p.rows.length; st.more = !!p.next; if (!st.walk) st.idx = st.size; }
      for (; st.idx < st.size; st.idx++) {
        const m = p.rows[st.idx];
        const key = matterAddress(client, m.ids.MatterId);
        const now = enactmentOf(m);
        const held = this.#one(`SELECT facts FROM follow_reads WHERE follow_id=? AND address=?`, f.follow_id, key);
        if (held && JSON.stringify(json(held.facts)) === JSON.stringify(now)) continue;
        const t = await read(key, false);
        if (!t && truncated) break;
        if (t) this.#sql.exec(`UPDATE follow_reads SET facts=? WHERE follow_id=? AND address=?`, JSON.stringify(now), f.follow_id, key);
        if (t && !t.same) captured[captured.length - 1].enactment = now;
      }
      if (truncated) break;
      if (p.next) advance("matters", p.next);
      else st = { done: true, meetings: st.meetings };
    }
    this.#sql.exec(`UPDATE follows SET body_cursor=? WHERE follow_id=?`, JSON.stringify(st), f.follow_id);
    const meetings = bodyProgress(st);
    const outcome = failed.length ? "failed" : captured.length ? "captured" : "unchanged";
    return { read: { follow: Number(f.follow_id), kind: "body", outcome, fetches, imported: imported.length, meetings, ...(truncated ? { truncated: true } : {}) },
             captured, failed, outcome, pending: !st.done };
  }

  /* R7, R9: a public register (or a person query on one), re-read, or re-rendered when the follow says so. */
  async #readRegister(f, s, nowMs) {
    const t = await this.#take(f, s.address, nowMs, { render: s.render === true, title: word("following.title.followed_register", { address: s.address }) });
    const form = f.kind === "register" && !s.render ? { form: "static", note: STATIC_ONLY } : {};
    if (t.failed) return { read: { follow: Number(f.follow_id), kind: f.kind, outcome: "failed", ...form }, failed: [{ follow: Number(f.follow_id), ...t.failed }], outcome: "failed" };
    let outcome = t.same ? "unchanged" : "captured";
    const captured = t.same ? [] : [{ kind: f.kind, follow: Number(f.follow_id), address: s.address, capture: t.sha, bundle: t.bundle }];
    /* R29: each read of a register followed for a proceeding hands its newest capture to events (an unchanged read too,
       so an import events refused is asked again); a refusal is a failure of this read and the follow stays due */
    let handed = {}, failed;
    if (f.kind === "register" && s.proceeding) {
      const imp = this.#handRegister(t.sha, s.proceeding);
      if (imp.ok === false) {
        outcome = "failed";
        failed = [{ follow: Number(f.follow_id), address: s.address, reason: imp.reason, by: "events", ...(imp.detail ? { detail: imp.detail } : {}) }];
      } else handed = { entries_written: Array.isArray(imp.written) ? imp.written.length : 0 };
    }
    return { read: { follow: Number(f.follow_id), kind: f.kind, outcome, capture: t.sha, ...handed, ...form }, captured, ...(failed ? { failed } : {}), outcome };
  }

  /* R37, R38, R41: a number's answer read on the tick: the docket's daily keyed check when its follow carries an alert and the
     service is on, else the register's own page at the composed address, re-read (and nothing else: no link is followed). */
  async #readQuery(f, s, nowMs) {
    if (s.alert) {
      const p = await this.#poll(f, s, nowMs, null);
      this.#sql.exec(`UPDATE follows SET alert_state=? WHERE follow_id=?`, p ? "on" : "off", f.follow_id);
      if (p) return p;
      const r = await this.#readNumber(f, s.address, nowMs);
      r.read.alert = "off";
      r.alert_off = { follow: Number(f.follow_id), why: localize("following.index.alert_off_page", "the docket service is off, holds no key or states no daily limit, so the docket's page was read instead") };
      return r;
    }
    return this.#readNumber(f, s.address, nowMs);
  }
  /* R37, R38: one read of a number's page; a capture whose bytes differ from the last is a change when R38 says so. */
  async #readNumber(f, address, nowMs, { member = null, credential = null, notPublic = false } = {}) {
    const base = { follow: Number(f.follow_id), kind: f.kind };
    const prev = this.#one(`SELECT capture_sha FROM follow_reads WHERE follow_id=? AND address=?`, f.follow_id, address);
    const t = await this.#take(f, address, nowMs, { member, credential, notPublic, title: word("following.title.followed_register", { address }) });
    if (t.failed) return { read: { ...base, outcome: "failed" }, failed: [{ ...base, ...t.failed }], outcome: "failed" };
    if (t.same) return { read: { ...base, outcome: "unchanged", capture: t.sha }, outcome: "unchanged" };
    const change = prev ? await this.#recordChange(f, prev.capture_sha, t.sha, address, t.bytes, nowMs) : null;
    return { read: { ...base, outcome: "captured", capture: t.sha, ...(change ? { change } : {}) },
             captured: [{ ...base, address, capture: t.sha, bundle: t.bundle }], outcome: "captured" };
  }
  /* R38: two captures of a number's answer compared; a change recorded once for the pair, with its counts, never its meaning.
     The change, or null. */
  async #recordChange(f, beforeSha, afterSha, address, afterBytes, nowMs) {
    if (!beforeSha || beforeSha === afterSha) return null;
    const before = await this.#bytes(beforeSha), after = afterBytes || await this.#bytes(afterSha);
    if (!before || !after) return null;
    const at = instant(nowMs);
    const c = answerChange({ view: this.view(), address, before, after, at });
    if (!c.changed) return { recorded: false, basis: c.basis };
    this.#sql.exec(`INSERT INTO register_query_changes (follow_id, before_sha, after_sha, home, at, counts, basis) VALUES (?,?,?,?,?,?,?)`,
                   f.follow_id, beforeSha, afterSha, f.home, at, c.counts ? JSON.stringify(c.counts) : null, c.basis);
    const id = Number(this.#one(`SELECT max(change_id) AS n FROM register_query_changes`).n);
    return { recorded: true, change: id, counts: c.counts, basis: c.basis };
  }

  /* R41, R42: a followed docket's check through the keyed service's entries (`acquisition.keyedCapture`, purpose
     docket-entries, the follow its standing; a member's refresh names the member instead): filed as a capture attributed to
     the follow, landed, compared with the last (R38), and handed to events when the follow names a proceeding. Null when the
     service is off, holds no key, or states no daily limit: the follow is then read as a page. Held (`rate_held`, nothing
     sent) when a limit is reached: due again when it lifts, never a failure. */
  async #poll(f, s, nowMs, member) {
    const k = this.keyedOpt;
    const url = docketEntriesAddress(s.address);
    if (!k || !k.store || !url) return null;
    const id = Number(f.follow_id);
    const base = { follow: id, kind: f.kind, alert: s.alert };
    let a;
    try {
      a = await (k.capture || keyedCapture)(k.store, { service: ALERT_SERVICE, purpose: ALERT_PURPOSE, request: { url, method: "GET" },
        viewer: member || MACHINE, standing: member ? null : { follow: String(id) }, at: nowMs });
    } catch (e) { a = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
    if (!a || a.ok === false) {
      const why = (a && a.reason) || "NO_ANSWER";
      if (["KEYED_SERVICE_OFF", "UNKNOWN_KEYED_SERVICE", "NOT_PERMITTED"].includes(why)) return null;
      if (why === "RATE_HELD") {
        const until = instant(nowMs + Math.max(Number(a.retry_in_ms) || 0, a.poll ? 3600000 : 1000));
        return { read: { ...base, outcome: "rate_held", until }, rate_held: { follow: id, ...(a.window ? { window: a.window } : { share: true }), until },
                 outcome: "rate_held", held: true, held_until: until };
      }
      if (why === "ALREADY_CHECKED_TODAY") return { read: { ...base, outcome: "unchanged" }, polled: { follow: id, outcome: "unchanged" }, outcome: "unchanged" };
      return { read: { ...base, outcome: "failed" }, failed: [{ ...base, address: url, reason: why }], outcome: "failed" };
    }
    const sha = a.document && a.document.capture ? a.document.capture.sha256 : a.capture ? a.capture.sha256 : null;
    const held = this.#one(`SELECT capture_sha, bundle_id FROM follow_reads WHERE follow_id=? AND address=?`, f.follow_id, url);
    if (a.existed || !a.document || (held && held.capture_sha === sha))
      return { read: { ...base, outcome: "unchanged", capture: sha }, polled: { follow: id, outcome: "unchanged", capture: sha }, outcome: "unchanged" };
    const at = instant(nowMs);
    const landed = this.host.land({ id: `follow ${id}`, bundle: f.home, locators: [url], target: null }, { locator: url, doc: a.document }, at, {
      title: word("following.title.followed_register", { address: url }),
      summary: word("following.summary", { address: url, follow_id: id }),
      notes: word("following.notes", { follow_id: id, kind: f.kind, by: word("following.text.member_standing_act", { author: f.author }), at, not_public: "" }),
      trigger: `follow ${id}` });
    if (!landed || !landed.ok) return { read: { ...base, outcome: "failed" }, failed: [{ ...base, address: url, reason: (landed && (landed.reason || landed.detail)) || "NOT_FILED" }], outcome: "failed" };
    this.#sql.exec(`INSERT OR REPLACE INTO follow_reads (follow_id, address, capture_sha, bundle_id, facts, at) VALUES (?,?,?,?,NULL,?)`, id, url, sha, landed.bundle_id, at);
    const change = held ? await this.#recordChange(f, held.capture_sha, sha, url, null, nowMs) : null;
    /* R41, R29: handed to events for the proceeding the follow names; what events answers is said beside the capture (its
       R38 is owed the entries' type, so a refusal here does not hold the follow back) */
    const imp = s.entity && s.entity_kind === "proceeding" ? this.#handRegister(sha, s.entity) : null;
    return { read: { ...base, outcome: "captured", capture: sha, ...(change ? { change } : {}),
                     ...(imp ? { register_import: imp.ok === false ? { ok: false, reason: imp.reason } : { ok: true, written: Array.isArray(imp.written) ? imp.written.length : 0 } } : {}) },
             captured: [{ ...base, address: url, capture: sha, bundle: landed.bundle_id }], polled: { follow: id, capture: sha }, outcome: "captured" };
  }

  /* R39: a stated interest's follow ticks only `registers.refreshImport` (its R33), which fetches by no other path; this
     module fetches nothing for it. */
  async #readInterest(f, s, nowMs) {
    const id = Number(f.follow_id);
    const base = { follow: id, kind: f.kind, interest: s.interest, register: s.register };
    let a;
    try { a = await this.registers.refreshImport({ interest: s.interest, now: nowMs, host: this.host }); }
    catch (e) { a = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
    if (a && a.ok !== false) return { read: { ...base, outcome: "refreshed", import: a.import ?? null }, outcome: "refreshed" };
    const why = (a && a.reason) || "NO_ANSWER";
    if (why === "REFRESH_UNCHANGED") return { read: { ...base, outcome: "unchanged", reason: why }, outcome: "unchanged" };
    if (why === "member_act_required")
      return { member_act_required: { follow: id, kind: f.kind, gate: a.gate || null, why: word("following.why.register_read_act") }, outcome: "member_act_required" };
    if (why === "HOST_PAUSED") return { read: { ...base, outcome: "host_paused" }, outcome: "host_paused", held: true };
    if (why === "NO_SUCH_INTEREST") { this.#endInterest(id, "interest_forgotten"); return { read: { ...base, outcome: "ended", reason: why }, outcome: "ended" }; }
    return { read: { ...base, outcome: "failed" }, failed: [{ ...base, reason: why }], outcome: "failed" };
  }

  /* R10: a portal's answer as a snapshot, a vintage valid at its capture instant. */
  async #readPortal(f, s, nowMs) {
    const t = await this.#take(f, s.address, nowMs, { title: word("following.title.portal_snapshot", { address: s.address }) });
    if (t.failed) return { read: { follow: Number(f.follow_id), kind: "portal", outcome: "failed" }, failed: [{ follow: Number(f.follow_id), ...t.failed }], outcome: "failed" };
    /* G46 (R-OLD): a capture held without its snapshot (a read that failed after `#take` held it) is written once, not answered unchanged */
    if (t.same && this.#one(`SELECT 1 AS n FROM portal_snapshots WHERE follow_id=? AND capture_sha=?`, f.follow_id, t.sha))
      return { read: { follow: Number(f.follow_id), kind: "portal", outcome: "unchanged", capture: t.sha }, outcome: "unchanged" };
    const bytes = await this.#bytes(t.sha);
    let ds;
    if (!bytes) ds = { why: word("following.why.snapshot_bytes_read") };
    else if (bytes.length > PORTAL_PARSE_MAX_BYTES)
      ds = { why: localize("following.index.snapshot_over_parse_bound", "this answer is {size} MB ({bytes} bytes), above the {bound} MB a snapshot can be compared at; the capture holds all of it",
                           { size: (bytes.length / 1048576).toFixed(2), bytes: String(bytes.length), bound: String(PORTAL_PARSE_MAX_BYTES / 1048576) }) };
    else ds = readDataset(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
    const at = instant(nowMs);
    const stored = ds.rows ? storedRows(ds.rows) : { value: null, pieces: [] };
    /* the snapshot row and its pieces are one write: a throw leaves neither (G46) */
    const write = () => {
      const seq = Number(this.#one(`SELECT COALESCE(max(seq), 0) + 1 AS n FROM portal_snapshots WHERE follow_id=?`, f.follow_id).n);
      this.#sql.exec(`INSERT INTO portal_snapshots (follow_id, seq, capture_sha, bundle_id, at, rows, why) VALUES (?,?,?,?,?,?,?)`,
                     f.follow_id, seq, t.sha, t.bundle, at, stored.value, ds.why || null);
      stored.pieces.forEach((chunk, part) => this.#sql.exec(`INSERT INTO portal_snapshot_parts (follow_id, seq, part, bundle_id, chunk) VALUES (?,?,?,?,?)`,
                                                            f.follow_id, seq, part, t.bundle, chunk));
      return seq;
    };
    const seq = typeof this.record.transact === "function" ? this.record.transact(write) : write();
    return { read: { follow: Number(f.follow_id), kind: "portal", outcome: "captured", capture: t.sha, snapshot: seq },
             captured: [{ kind: "portal", follow: Number(f.follow_id), address: s.address, capture: t.sha, bundle: t.bundle, snapshot: seq,
                          valid: vintage(at) }], outcome: "captured" };
  }

  /* R10, R11 (G46): a snapshot's rows as a list: whole in `rows`, or joined from its pieces; null when it holds none (a reason
     stands in `why`) or its pieces are not all held. */
  #rowsOf(snap) {
    if (!snap.rows) return null;
    const v = json(snap.rows);
    if (Array.isArray(v)) return v;
    if (!v || typeof v !== "object" || !Number.isInteger(v.parts)) return null;
    const chunks = this.#rows(`SELECT chunk FROM portal_snapshot_parts WHERE follow_id=? AND seq=? ORDER BY part`, snap.follow_id, snap.seq);
    if (chunks.length !== v.parts) return null;
    return json(chunks.map((c) => c.chunk).join("")) || null;
  }

  /** R8: a register behind an account or a fee, refreshed only by the act of the member whose credential it uses. */
  async refreshRegister({ follow, author, credential = null, price = null } = {}) {
    const f = this.#follow(follow);
    if (!f || f.ended_at || !GATED_KINDS.includes(f.kind)) return refuse("NO_SUCH_FOLLOW", localize("following.index.no_live_register_follow", "no live register follow by that id is held"));
    const gated = json(f.gated);
    const sub = json(f.subject) || {};
    /* R41, R42: a member's refresh of a followed docket carrying an alert: the entries through the keyed service, counted
       against its limits as any keyed call, the member named; with the service off, the page */
    if (!gated && f.kind === "register-query" && sub.alert) {
      if (!said(author) || isMachineIdentity(author) || author !== f.author)
        return refuse("NOT_THE_FOLLOWER", localize("following.index.only_follower_refreshes_docket", "only the member who follows this docket refreshes it"));
      const nowMs = this.now();
      const p = await this.#poll(f, sub, nowMs, author);
      const r = p || await this.#readNumber(f, sub.address, nowMs, { member: author });
      if (r.outcome === "rate_held") return { ok: false, reason: "RATE_HELD", code: "RATE_HELD", follow: Number(f.follow_id), until: r.read.until,
        detail: localize("following.index.refresh_rate_held", "the docket service allows no more calls for now; nothing was sent") };
      if (r.outcome === "failed") return refuse("NOT_READ", (r.failed && r.failed[0] && r.failed[0].reason) || "failed");
      this.#sql.exec(`UPDATE follows SET last_read=?, last_outcome=?, held_until=NULL WHERE follow_id=?`, instant(nowMs), r.outcome, f.follow_id);
      this.#tell(Number(f.follow_id), this.#nextDue(f.follow_id));
      return { ok: true, follow: Number(f.follow_id), via: p ? "entries" : "page", alert: p ? sub.alert : "off", capture: r.read.capture ?? null,
               unchanged: r.outcome === "unchanged", ...(r.read.change ? { change: r.read.change } : {}) };
    }
    if (!gated) return refuse("NOT_GATED", localize("following.index.public_register_read_tick", "a public register is read on the tick; a member's refresh is for one behind an account or a fee"));
    if (!said(author) || isMachineIdentity(author) || author !== f.author)
      return refuse("NOT_THE_FOLLOWER", localize("following.index.only_follower_refreshes", "only the member who follows this register refreshes it, with their own credential"));
    if (gated.kind === "fee" && price !== gated.price)
      return refuse("PRICE_FIRST", localize("following.index.this_register_charges_price_the", "this register charges {price}; the refresh runs only once that price is accepted as shown", { price: String(gated.price) }), { price: gated.price });
    if (gated.kind === "account" && (!credential || typeof credential !== "object"))
      return refuse("NO_CREDENTIAL", localize("following.index.account_gated_member_credential", "an account-gated register is read with the member's own credential"));
    const s = sub;
    if (f.kind === "register-query") {
      /* R37, R8: a gated number's answer brought in by its member's own act, compared with the last as on the tick (R38) */
      const r = await this.#readNumber(f, s.address, this.now(), { member: author, credential, notPublic: true });
      if (r.outcome === "failed") return refuse("NOT_READ", (r.failed && r.failed[0] && r.failed[0].reason) || "failed");
      this.#sql.exec(`UPDATE follows SET last_read=?, last_outcome=? WHERE follow_id=?`, instant(this.now()), r.outcome, f.follow_id);
      this.#tell(Number(f.follow_id), this.#nextDue(f.follow_id));
      return { ok: true, follow: Number(f.follow_id), capture: r.read.capture ?? null, unchanged: r.outcome === "unchanged", reproducible_by_public: false,
               note: NOT_PUBLIC, ...(r.read.change ? { change: r.read.change } : {}) };
    }
    const t = await this.#take(f, s.address, this.now(), { render: s.render === true, member: author, credential, notPublic: true,
      title: word("following.title.refreshed_member", { address: s.address }) });
    if (t.failed) return refuse("NOT_READ", t.failed.reason);
    this.#sql.exec(`UPDATE follows SET last_read=?, last_outcome=? WHERE follow_id=?`, instant(this.now()), t.same ? "unchanged" : "captured", f.follow_id);
    this.#tell(Number(f.follow_id), this.#nextDue(f.follow_id));
    /* R29: a refresh is a read too; what events answered is stated beside the capture, never hiding it */
    const imp = f.kind === "register" && s.proceeding ? this.#handRegister(t.sha, s.proceeding) : null;
    return { ok: true, follow: Number(f.follow_id), capture: t.sha, unchanged: t.same, reproducible_by_public: false, note: NOT_PUBLIC,
             ...(imp ? { proceeding: s.proceeding, register_import: imp.ok === false ? { ok: false, reason: imp.reason, ...(imp.detail ? { detail: imp.detail } : {}) }
                                                                                     : { ok: true, written: Array.isArray(imp.written) ? imp.written.length : 0 } } : {}) };
  }

  /* ===================================================================== *
   * THE POLICIES A GROUP HOLDS (R20, R21; K1727, K1740).
   * ===================================================================== */

  /* R20: every policy `standards` holds whose text is held from a capture with a direct receipt at a public https
     address, one entry per (policy, address): `{standard, address, capture, at, home, access}`, the latest of its text
     captures at that address. A superseded policy, one held cited or absent, and one whose text has no such capture
     are not watched. `home` is the text's bundle while the policy is held at its source's sight (standards R37), so
     each capture takes the policy's sight; else null (group-wide). Null when standards cannot be read. */
  #heldPolicies() {
    const out = new Map();
    let after = null;
    try {
      for (let page = 0; page < 1000; page++) {
        const r = this.standards.standardsIn({ kind: "policy", after, limit: POLICY_PAGE, viewer: MACHINE });
        if (!r || r.ok === false || !Array.isArray(r.items)) return null;
        for (const p of r.items) {
          if ((p.held || "text") !== "text" || p.superseded_by) continue;
          const bundleSight = p.sight && p.sight.class === "bundle";
          for (const contentId of Array.isArray(p.text) ? p.text : []) {
            const c = this.#one(`SELECT capture_sha, bundle_id FROM content WHERE content_id=?`, contentId);
            if (!c) continue;
            for (const l of this.#rows(`SELECT address, first_retrieved FROM captured_locators WHERE capture_sha=? AND via='direct'
                                         ORDER BY first_retrieved`, c.capture_sha)) {
              if (!said(l.address) || !isPublicHttpsLocator(l.address)) continue;
              const key = `${p.id}\n${l.address}`;
              const was = out.get(key);
              if (!was || l.first_retrieved > was.at)
                out.set(key, { standard: p.id, address: l.address, capture: c.capture_sha, at: l.first_retrieved,
                               home: bundleSight ? c.bundle_id : null, access: p.access ?? null });
            }
          }
        }
        if (!r.truncated || !r.cursor) break;
        after = r.cursor;
      }
    } catch { return null; }
    return out;
  }

  /* R20: the watches made when a policy's text is first held and ended when it is superseded or no longer watchable;
     each make and end tells R19's listeners. Nothing changes when standards cannot be read. */
  #syncPolicies(nowMs) {
    const held = this.#heldPolicies();
    if (!held) return;
    const live = new Map();
    for (const w of this.#rows(`SELECT follow_id, subject FROM follows WHERE kind='policy' AND ended_at IS NULL`)) {
      const s = json(w.subject) || {};
      live.set(`${s.standard}\n${s.address}`, Number(w.follow_id));
    }
    for (const [key, id] of live) {
      if (held.has(key)) continue;
      this.#sql.exec(`UPDATE follows SET ended_at=?, ended_by=?, ended_reason=? WHERE follow_id=?`, instant(nowMs), MACHINE,
                     this.#policyEndReason(key.split("\n")[0]), id);
      this.#tell(id, null);
    }
    for (const [key, p] of held) {
      if (live.has(key)) continue;
      const r = this.#insert("policy", { kind: "policy", standard: p.standard, address: p.address, access: p.access },
                             { home: p.home, author: "", cadence: POLICY_WATCH_CADENCE, at: instant(nowMs), lastRead: p.at });
      /* the policy's own text capture is the first version seen, and the bytes the first read compares with */
      this.#sql.exec(`INSERT INTO policy_versions (follow_id, seq, capture_sha, bundle_id, at) VALUES (?, 1, ?, ?, ?)`,
                     r.follow, p.capture, p.home, p.at);
      this.#sql.exec(`INSERT OR REPLACE INTO follow_reads (follow_id, address, capture_sha, bundle_id, facts, at) VALUES (?,?,?,?,NULL,?)`,
                     r.follow, p.address, p.capture, p.home, p.at);
    }
  }

  /* R14, R20: why a policy's watch ended: the policy was superseded, or is no longer held with its text at a public
     address (withdrawn from being watched). */
  #policyEndReason(standard) {
    try { const a = this.standards.standardRead({ id: standard, viewer: MACHINE }); if (a && a.ok !== false && a.superseded_by) return "superseded"; }
    catch { /* not read: withdrawn */ }
    return "withdrawn";
  }

  /* R20: one policy watch's read: its address, compared with the last version seen; bytes that differ are kept as a new
     version beside every earlier one, landed with the policy's sight. */
  async #readPolicy(f, s, nowMs) {
    let home = f.home;
    try {
      const a = this.standards.standardRead({ id: s.standard, viewer: MACHINE });
      if (a && a.ok !== false && a.sight && a.sight.class !== "bundle") home = null;   /* released (standards R37) */
    } catch { /* keep the watch's own home */ }
    const t = await this.#take(f, s.address, nowMs, { home, title: word("following.title.policy_watched", { address: s.address }) });
    const base = { follow: Number(f.follow_id), kind: "policy", standard: s.standard };
    if (t.failed) return { read: { ...base, outcome: "failed" }, failed: [{ ...base, ...t.failed }], outcome: "failed" };
    if (t.same) return { read: { ...base, outcome: "unchanged", capture: t.sha }, outcome: "unchanged" };
    const prev = this.#one(`SELECT seq, capture_sha, at FROM policy_versions WHERE follow_id=? ORDER BY seq DESC LIMIT 1`, f.follow_id);
    const at = instant(nowMs);
    this.#sql.exec(`INSERT INTO policy_versions (follow_id, seq, capture_sha, bundle_id, at) VALUES (?,?,?,?,?)`,
                   f.follow_id, (prev ? Number(prev.seq) : 0) + 1, t.sha, t.bundle, at);
    return { read: { ...base, outcome: "captured", capture: t.sha },
             captured: [{ ...base, address: s.address, capture: t.sha, bundle: t.bundle,
                          ...(prev ? { before: { capture: prev.capture_sha, at: prev.at } } : {}) }], outcome: "captured" };
  }

  /* R14, R21: whether the viewer may read the watched policy (standards' own sight, R37): `isMeasure` answers exactly
     that for a policy held with its text, the only kind watched. A viewer naming no one reads none. */
  #readsPolicy(standard, viewer) {
    if (!said(viewer) || viewerPredicate(viewer).scope === "DENY" || !said(standard)) return false;
    try { return this.standards.isMeasure(standard, viewer) === true; } catch { return false; }
  }

  /** R21: the policy changes a member reviews as "Noticed": one entry per kept version whose bytes differ from the one
   *  before, in order of the later capture's instant (then of keeping), after the cursor `after`, at most `limit`;
   *  with `since`, only those whose later capture's instant is at or after it (T36, N741), the order, `after`, `limit`
   *  and `cursor` unchanged. A `since` that is not an instant answers none and says so (`since_invalid`, as `bias`
   *  R44's). A change in a policy the viewer may not read is left out whole. Writes nothing; says nothing of what a
   *  change means. */
  policyChanges({ after = null, since = null, limit = null, viewer = null } = {}) {
    const n = Number.isInteger(Number(limit)) && limit !== null && limit !== ""
      ? Math.min(POLICY_CHANGES_MAX, Math.max(1, Number(limit))) : POLICY_CHANGES_MAX;
    const lo = since === null || since === undefined ? null : wholeSecondFrom(since);
    if (since !== null && since !== undefined && lo === null)
      return { ok: true, changes: [], cursor: null, since_invalid: true,
               note: word("following.note.since_instant_policy") };
    const from = said(String(after ?? "")) ? this.#one(`SELECT change_id, at FROM policy_versions WHERE change_id=?`, Number(after)) : null;
    /* every later capture's `at` is the tick's whole-second stamp (`instant`), so the instants compare as text */
    const rows = this.#rows(`SELECT v.change_id, v.follow_id, v.capture_sha, v.at, p.capture_sha AS before_sha, p.at AS before_at, f.subject
                             FROM policy_versions v JOIN policy_versions p ON p.follow_id = v.follow_id AND p.seq = v.seq - 1
                             JOIN follows f ON f.follow_id = v.follow_id
                             WHERE v.capture_sha <> p.capture_sha ${lo ? "AND v.at >= ?" : ""}
                               ${from ? "AND (v.at > ? OR (v.at = ? AND v.change_id > ?))" : ""}
                             ORDER BY v.at, v.change_id`, ...(lo ? [lo] : []), ...(from ? [from.at, from.at, Number(from.change_id)] : []));
    const seen = new Map();
    const changes = [];
    let more = false;
    for (const r of rows) {
      const s = json(r.subject) || {};
      if (!seen.has(s.standard)) seen.set(s.standard, this.#readsPolicy(s.standard, viewer));
      if (!seen.get(s.standard)) continue;
      if (changes.length === n) { more = true; break; }
      changes.push({ change: Number(r.change_id), watch: Number(r.follow_id), standard: s.standard, address: s.address,
                     before: { capture: r.before_sha, at: r.before_at }, after: { capture: r.capture_sha, at: r.at },
                     amendment_held: this.#amendmentHeld(s.standard, r.before_at, r.at) });
    }
    return { ok: true, changes: changes.map(({ change, ...c }) => c),
             cursor: more ? String(changes[changes.length - 1].change) : null,
             note: word("following.note.difference_between_two") };
  }

  /* R21: whether standards holds an amendment of the policy, or a version superseding it, effective between the two
     captures' local days (inclusive): the successor's stated start or the later capture of its version basis
     (standards R38), or an adopted temporal relation into it (`law-relations` R2, through `lawRelationsOf`). */
  #amendmentHeld(standard, beforeAt, afterAt) {
    const zone = this.zone();
    let lo, hi;
    try { lo = localDay(beforeAt, zone); hi = localDay(afterAt, zone); } catch { return false; }
    const within = (d) => typeof d === "string" && isCalendarDate(d) && d >= lo && d <= hi;
    try {
      const a = this.standards.standardRead({ id: standard, viewer: MACHINE });
      const next = a && a.ok !== false ? a.superseded_by : null;
      if (next) {
        const b = this.standards.standardRead({ id: next, viewer: MACHINE });
        if (b && b.ok !== false) {
          if (within(b.period && b.period.from)) return true;
          if (b.version_basis && typeof b.version_basis.through === "string" && within(localDay(b.version_basis.through, zone))) return true;
        }
      }
    } catch { /* not held, read as none */ }
    try {
      const r = this.standards.lawRelationsOf({ standard, viewer: MACHINE });
      for (const t of r && Array.isArray(r.temporal) ? r.temporal : []) {
        if (t.direction !== "in" || t.withdrawn || !t.effective) continue;
        const day = t.effective.date ? t.effective.date : this.#eventDay(t.effective.event, t.effective.edge);
        if (within(day)) return true;
      }
    } catch { /* none held */ }
    return false;
  }

  /* R21: the local day an event's `when` gives at its edge (`events`), or null. */
  #eventDay(eventId, edge) {
    try {
      const r = this.events.readEvent({ eventId, viewer: MACHINE });
      const w = r && r.event ? r.event.when : null;
      if (!w || typeof w.zone !== "string") return null;
      const at = edge === "end" ? (typeof w.end === "string" ? instant(Date.parse(w.end) - 1000) : null) : w.start;
      return typeof at === "string" ? localDay(at, w.zone) : null;
    } catch { return null; }
  }

  /* ===================================================================== *
   * THE WATCHES A PLAN SET RUNNING (R22–R26; v0.2 rules 1, 17, 18; K2781 (2)).
   * ===================================================================== */

  /* The plan as action-plans answers it to `viewer` (null: this module's own read, every plan), or null when it cannot
     be read. */
  #plan(id, viewer = null) {
    if (!said(String(id ?? ""))) return null;
    try { const r = this.actionPlans.planRead({ id: String(id).trim(), viewer }); return r && r.ok === true ? r : null; } catch { return null; }
  }
  #planClosedAt(p) { return p && p.state === "closed" ? (p.closed && p.closed.at) || null : null; }
  #memberId(v) { const m = /^member:(.+)$/.exec(String(v || "")); return m ? m[1] : null; }

  /* A standing question as its author reads it, never writing (answers R16: only its author sees it), or null. */
  #question(id, viewer) {
    if (!said(String(id ?? "")) || !said(viewer)) return null;
    try {
      const r = this.answers.standingQuestionsOf({ viewer });
      const list = r && Array.isArray(r.questions) ? r.questions : Array.isArray(r && r.items) ? r.items : Array.isArray(r) ? r : [];
      return list.find((q) => q && String(q.id) === String(id)) || null;
    } catch { return null; }
  }
  /* A duty as `viewer` reads it (`duties` R7), or null when absent or unseen. */
  #duty(id, viewer) {
    if (!said(String(id ?? ""))) return null;
    try { const r = this.duties.readDuty({ dutyId: String(id), viewer }); return r && r.ok && r.found ? r.duty : null; } catch { return null; }
  }
  /* A watched address's row as `viewer` sees it (`monitoring` R32), matched by its normalised form, or null. */
  #addressRow(address, viewer) {
    const key = said(address) ? portalKey(address.trim()) : null;
    if (!key || !said(viewer)) return null;
    try {
      const r = this.monitoring.monitoring({ viewer, now: this.now() });
      return (r && Array.isArray(r.items) ? r.items : []).find((i) => i && said(i.address) && portalKey(i.address) === key) || null;
    } catch { return null; }
  }

  /* R23–R26: one watch as `viewer` sees it, in its owner's terms: `{kind, id, words, ends, ended, policy?}`, or null
     when it is absent or unseen. `viewer` null is this module's own read: every watch but a standing question, which
     only its author sees. */
  #watch(kind, id, viewer) {
    const v = viewer ?? MACHINE;
    if (kind === "follow") {
      const f = this.#follow(id);
      if (!f || (viewer != null && !this.#sees(f, viewer))) return null;
      const s = json(f.subject) || {};
      return { kind, id: String(f.follow_id), words: s, ends: f.kind === "policy" ? null : this.#endsOf(f.follow_id),
               ended: !!f.ended_at, policy: f.kind === "policy" };
    }
    if (kind === "address") {
      const row = this.#addressRow(id, v);
      if (!row) return null;
      const until = row.until ?? null;
      /* the address as monitoring holds it (its normalised form, R15), so R25's act and R72's read name its subject */
      return { kind, id: row.address, words: row.address, ends: until,
               ended: row.state === "ended" || (typeof until === "string" && until < this.#today()) };
    }
    if (kind === "duty") {
      const d = this.#duty(id, viewer == null ? MACHINE : viewer);
      if (!d) return null;
      return { kind, id: String(d.duty_id), words: (d.performance && d.performance.act) || null, ends: this.dutyWatchEnd(d.duty_id),
               ended: !!d.withdrawn };
    }
    if (kind === "question") {
      const q = viewer == null ? null : this.#question(id, viewer);
      if (!q) return null;
      return { kind, id: String(q.id), words: q.question ?? null, ends: q.ends ?? null, ended: !!q.ended };
    }
    return null;
  }

  #link(id) { const n = Number(id); return Number.isSafeInteger(n) ? this.#one(`SELECT * FROM watch_links WHERE link_id=?`, n) : null; }
  #linkView(l) {
    return { link: Number(l.link_id), plan: l.plan, matters: json(l.matters), watch: { kind: l.watch_kind, id: l.watch_id },
             author: l.author, at: l.at };
  }
  /* R23: a link is seen by whoever sees its plan; a link to a standing question only by that question's author. */
  #seesLink(l, viewer) {
    if (l.watch_kind === "question") return said(viewer) && viewer === l.author && !!this.#question(l.watch_id, viewer);
    return viewer == null ? true : !!this.#plan(l.plan, viewer);
  }

  /** R23: a member's act recording that a plan set a watch running, for some of its matters or all of them. */
  watchLink({ plan, matters = null, watch = null, author, viewer = null } = {}) {
    if (!said(author) || isMachineIdentity(author))
      return refuse("MACHINE_CANNOT_LINK_WATCH", localize("following.index.link_watch_member_act", "linking a watch to a plan is a member's own act"));
    const who = viewer ?? author;
    const p = this.#plan(plan, who);
    if (!p) return noSuchPlan(said(String(plan ?? "")) ? String(plan) : null);
    if (p.state === "closed") return refusePlanClosed(p.id);
    const kind = watch && typeof watch === "object" ? watch.kind : null;
    const wid = watch && typeof watch === "object" && watch.id != null ? String(watch.id).trim() : null;
    if (!WATCH_KINDS.includes(kind) || !said(wid)) return refuse("NO_SUCH_WATCH", localize("following.index.no_watch_of_kind_seen", "no watch of that kind that you may see is held under that id"));
    const w = this.#watch(kind, wid, kind === "question" ? author : who);
    if (!w) return refuse("NO_SUCH_WATCH", localize("following.index.no_watch_of_kind_seen_2", "no watch of that kind that you may see is held under that id"));
    let keys = null;
    if (matters != null) {
      const list = Array.isArray(matters) ? matters : [matters];
      const held = new Map((Array.isArray(p.subjects) ? p.subjects : []).map((x) => [x.key, x]));
      keys = [];
      for (const m of list) {
        const k = typeof m === "string" ? m.trim() : m && typeof m === "object" ? (m.key || null) : null;
        if (k && held.has(k)) { if (!keys.includes(k)) keys.push(k); continue; }
        /* the matter is not the plan's: plan-work's own refusal (its MATTER_NOT_OF_PLAN), relayed as given */
        let r = null;
        try { r = this.planWork.matterPromiseDuties({ plan: p.id, matter: m, viewer: who }); } catch { r = null; }
        if (r && r.ok === false) return r;
        /* plan-work holds it as the plan's matter (one the viewer's plan read withheld): linked by its key */
        if (k && !keys.includes(k)) keys.push(k);
      }
      if (!keys.length) keys = null;
    }
    if (w.ended) return refuse("WATCH_ENDED", localize("following.index.watch_already_ended", "that watch has already ended"));
    const id = w.id;
    const had = this.#one(`SELECT * FROM watch_links WHERE plan=? AND watch_kind=? AND watch_id=?`, p.id, kind, id);
    if (had) return { ok: true, existed: true, ...this.#linkView(had) };
    const at = instant(this.now());
    this.#sql.exec(`INSERT INTO watch_links (plan, matters, watch_kind, watch_id, home, author, at) VALUES (?,?,?,?,?,?,?)`,
                   p.id, keys ? JSON.stringify(keys) : null, kind, id, p.project ?? null, author, at);
    const l = this.#one(`SELECT * FROM watch_links WHERE plan=? AND watch_kind=? AND watch_id=?`, p.id, kind, id);
    return { ok: true, ...this.#linkView(l) };
  }

  /* R24: whether another plan or project relies on a link's watch: another link of it names a plan not closed; for an
     address, a project other than the plan's asks for it (`monitoring` R72); a policy's watch always. Names none. */
  #reliedOn(l, w, project) {
    if (w && w.policy) return true;
    for (const o of this.#rows(`SELECT plan FROM watch_links WHERE watch_kind=? AND watch_id=? AND link_id<>?`, l.watch_kind, l.watch_id, l.link_id)) {
      const p = this.#plan(o.plan);
      if (p && p.state !== "closed") return true;
    }
    if (l.watch_kind === "address") {
      let ps = [];
      try { const r = this.monitoring.addressWatchers(l.watch_id); ps = Array.isArray(r) ? r : []; } catch { ps = []; }
      if (ps.some((x) => x && x !== project)) return true;
    }
    return false;
  }

  /* R24 (b), R27: the instant every promise-duty of the link's matters read met, from one source: plan-work's
     `matterPromiseDuties` (its R13, R15), read with no member's sight. Each matter (all the plan's when the link names
     none) must answer `all_met`, not `partial`, with a `met_at`; the latest `met_at` is the instant, in the record's
     whole-second spelling. Any matter that does not makes it null: never derived here, never guessed. `nowMs` is the
     instant the read is as of (the asker's `now`). */
  #promisesMetAt(l, p, nowMs) {
    const keys = json(l.matters) || (Array.isArray(p.subjects) ? p.subjects.map((x) => x.key) : []);
    if (!keys.length) return null;
    let last = null;
    for (const k of keys) {
      let r;
      try { r = this.planWork.matterPromiseDuties({ plan: p.id, matter: k, nowMs, viewer: null }); } catch { return null; }
      if (!r || r.ok !== true || r.all_met !== true || r.partial === true) return null;
      const t = wholeSecondFrom(r.met_at);
      if (!t) return null;
      if (!last || t > last) last = t;
    }
    return last;
  }

  /* R24: a link's question, `{due_at, cause}`, or null when it is not due (its watch ended, or neither cause holds). */
  #due(l, p, w, nowMs) {
    if (!p || !w || w.ended) return null;
    const closed = this.#planClosedAt(p);
    const met = this.#promisesMetAt(l, p, nowMs);
    if (closed && (!met || closed <= met)) return { due_at: closed, cause: "closed" };
    if (met) return { due_at: met, cause: "promises_met" };
    return null;
  }

  /* R24: who is asked: a standing question's author; else the link's author while an active member who sees the plan;
     else the plan's project's active owners; else the administrators. */
  #recipients(l, p) {
    if (l.watch_kind === "question") return [l.author];
    const active = (id) => { try { const f = this.membership.memberFacts(id); return !!f && f.status === "active"; } catch { return false; } };
    const a = this.#memberId(l.author);
    if (a && active(a) && this.#plan(p.id, l.author)) return [l.author];
    let owners = [];
    try { owners = (this.membership.projectOwners(p.project) || []).filter(active).map((x) => `member:${x}`); } catch { owners = []; }
    if (owners.length) return owners;
    try { return (this.membership.activeAdmins() || []).map((x) => (x === "admin" ? "admin" : `member:${x}`)); } catch { return []; }
  }

  /* R24: one link's entry when its question is due and unanswered, else null; `viewer` its sight (null: every link). */
  #question24(l, nowMs, viewer) {
    if (this.#one(`SELECT 1 AS x FROM watch_answers WHERE link_id=?`, l.link_id)) return null;
    if (viewer !== null && !this.#seesLink(l, viewer)) return null;
    const p = this.#plan(l.plan);
    if (!p) return null;
    const w = this.#watch(l.watch_kind, l.watch_id, l.watch_kind === "question" ? l.author : null);
    const d = this.#due(l, p, w, nowMs);
    if (!d) return null;
    const relied = this.#reliedOn(l, w, p.project);
    return { link: Number(l.link_id), plan: l.plan, matters: json(l.matters), watch: { kind: l.watch_kind, id: l.watch_id, ends: w.ends ?? null },
             due_at: d.due_at, cause: d.cause, relied_on: relied, offered: relied ? [] : ["keep", "stop"], recipients: this.#recipients(l, p) };
  }

  /** R24: the once-only question: one entry per link whose question is due and not yet answered, in (due instant, link)
   *  order after `after`, at most `limit` (1–200), with `cursor`. An entry the viewer may not see is left out whole.
   *  Writes nothing. */
  watchQuestions({ after = null, limit = null, viewer = null, now = null } = {}) {
    const nowMs = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : this.now();
    const n = Number.isInteger(Number(limit)) && limit !== null && limit !== "" ? Math.min(WATCH_QUESTIONS_MAX, Math.max(1, Number(limit))) : WATCH_QUESTIONS_MAX;
    if (!said(viewer) || viewerPredicate(viewer).scope === "DENY") return { ok: true, questions: [], cursor: null };
    const all = [];
    for (const l of this.#rows(`SELECT * FROM watch_links ORDER BY link_id`)) {
      const e = this.#question24(l, nowMs, viewer);
      if (e) all.push(e);
    }
    all.sort((a, b) => (a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : a.link - b.link));
    const m = said(String(after ?? "")) ? /^(.+)#(\d+)$/.exec(String(after)) : null;
    const from = m ? all.filter((e) => e.due_at > m[1] || (e.due_at === m[1] && e.link > Number(m[2]))) : all;
    const page = from.slice(0, n);
    return { ok: true, questions: page, cursor: from.length > n ? `${page.at(-1).due_at}#${page.at(-1).link}` : null };
  }

  /** R25: the one answer to a link's question, by one of its recipients: keep until a day, or stop now; the watch's end
   *  is set in its owner's terms in the same act. */
  watchAnswer({ link, keep = null, stop = null, author, viewer = null } = {}) {
    if (!said(author) || isMachineIdentity(author))
      return refuse("MACHINE_CANNOT_LINK_WATCH", localize("following.index.answer_keep_member_act", "answering whether to keep a watch is a member's own act"));
    const who = viewer ?? author;
    const l = this.#link(link);
    if (!l || !this.#seesLink(l, who)) return refuse("NO_SUCH_WATCH", localize("following.index.no_link_seen", "no link of a watch you may see is held under that id"));
    const had = this.#one(`SELECT * FROM watch_answers WHERE link_id=?`, l.link_id);
    if (had) return { ok: true, existed: true, link: Number(l.link_id), answer: had.answer, until: had.until_day, by: had.author, at: had.at };
    const nowMs = this.now();
    const e = this.#question24(l, nowMs, null);
    if (!e || !e.recipients.includes(author))
      return refuse("WATCH_NOT_ASKED", localize("following.index.no_question_yours_now", "there is no question about this watch that is yours to answer now"));
    if (e.relied_on) return refuse("WATCH_RELIED_ON", localize("following.index.relied_on_not_offered", "something else still relies on this watch, so it is not offered for keeping or stopping"));
    const keeping = keep != null && keep !== false, stopping = stop === true;
    if (keeping === stopping) return refuse("WATCH_END_REFUSED", localize("following.index.answer_keep_or_stop", "an answer either keeps the watch until a day, or stops it now"));
    let until = null;
    if (keeping) {
      const g = this.#endsGiven(keep && typeof keep === "object" ? keep.until : null, nowMs);
      if (g.bad || !g.ends) return refuse("WATCH_END_REFUSED", g.bad || localize("following.index.keep_names_day", "keeping a watch names the day it is kept until"));
      until = g.ends;
    }
    const today = this.#today(nowMs);
    const act = () => {
      const r = this.#endWatch(l, keeping ? until : null, author, today);
      if (r && r.ok === false) return r;
      const at = instant(this.now());
      this.#sql.exec(`INSERT INTO watch_answers (link_id, answer, until_day, cause, author, home, at) VALUES (?,?,?,?,?,?,?)`,
                     l.link_id, keeping ? "keep" : "stop", keeping ? until : today, e.cause, author, l.home, at);
      return { ok: true, link: Number(l.link_id), answer: keeping ? "keep" : "stop", until: keeping ? until : today, cause: e.cause, by: author, at,
               watch: { kind: l.watch_kind, id: l.watch_id }, owner: r };
    };
    return typeof this.record.transact === "function" ? this.record.transact(act) : act();
  }

  /* R25: a watch's end set in its owner's terms: a follow's `ends` or its end now; an address's end day (monitoring
     R71); a duty's on the link (here); a standing question's `ends` or its end (answers R34, R16). A refusal by the
     owner's act is answered as given. */
  #endWatch(l, until, by, today) {
    if (l.watch_kind === "follow") {
      const f = this.#follow(l.watch_id);
      if (!f) return refuse("NO_SUCH_WATCH", localize("following.index.follow_no_longer_held", "the follow is no longer held"));
      if (until) return this.#setEnds(f, until, by);
      return { ok: true, follow: Number(f.follow_id), ended_at: this.#endByAnswer(f, by), ended_reason: "answer" };
    }
    if (l.watch_kind === "address") return this.monitoring.addressWatchEnd({ address: l.watch_id, until: until || today, by, viewer: by });
    if (l.watch_kind === "duty") return { ok: true, duty: l.watch_id, until: until || today };
    if (until) return this.answers.standingQuestionEndSet({ id: l.watch_id, ends: until, author: by });
    return this.answers.standingQuestionEnd({ id: l.watch_id, author: by });
  }

  /** R25 (for `notice-producers` R5): the day after which a duty is no longer told: null while it has no link or any
   *  link of it is unanswered; else the latest end day its answered links hold. Writes nothing; never throws. */
  dutyWatchEnd(duty) {
    const e = this.#dutyEnd(duty);
    return e ? e.day : null;
  }

  /** R28 (for `notice-producers` R18): null exactly when `dutyWatchEnd` is; else `{day, at}`, `day` its end day and `at`
   *  the recorded instant of the answer that made that end hold: the last of the duty's links' answers to be recorded,
   *  from which none of its links stood unanswered. Writes nothing; never throws. */
  dutyWatchEndAt(duty) {
    return this.#dutyEnd(duty);
  }
  /* R25, R28: a duty's end from its links' answers, `{day, at}`, or null while it has no link or any link is unanswered.
     Every answer's `at` is the act's whole-second stamp (`instant`), so the instants compare as text. */
  #dutyEnd(duty) {
    try {
      const ls = this.#rows(`SELECT l.link_id, a.until_day, a.at FROM watch_links l LEFT JOIN watch_answers a ON a.link_id = l.link_id
                             WHERE l.watch_kind='duty' AND l.watch_id=?`, String(duty));
      if (!ls.length || ls.some((x) => x.until_day == null || x.at == null)) return null;
      return { day: ls.map((x) => x.until_day).sort().at(-1), at: ls.map((x) => x.at).sort().at(-1) };
    } catch { return null; }
  }

  /** R26: each watch linked to the plan that the viewer may see, in its owner's words, with its end date or
   *  `none_set`, whether it has ended, and `relied_on`. `viewer` null is the module's own read (the closing summary),
   *  which sees no standing question. Writes nothing; never throws. */
  watchesOfPlan({ plan, viewer = null } = {}) {
    try {
      const p = this.#plan(plan, viewer);
      if (!p) return [];
      const out = [];
      for (const l of this.#rows(`SELECT * FROM watch_links WHERE plan=? ORDER BY link_id`, p.id)) {
        if (l.watch_kind === "question" && (!said(viewer) || viewer !== l.author)) continue;
        const w = this.#watch(l.watch_kind, l.watch_id, l.watch_kind === "question" ? viewer : null);
        if (!w) continue;
        out.push({ link: Number(l.link_id), kind: l.watch_kind, watch: l.watch_id, words: w.words, ends: w.ends ?? null,
                   ...(w.ends ? {} : { ends_state: "none_set" }), ended: !!w.ended, relied_on: this.#reliedOn(l, w, p.project),
                   matters: json(l.matters) });
      }
      return out;
    } catch { return []; }
  }

  /** R26: this module's one registration, at start, through plan-work's watch-reader door (its R9). */
  registerWatches() {
    try {
      const pw = this.planWork;
      if (!pw || typeof pw.registerWatchReader !== "function") return { ok: false, reason: "NO_WATCH_DOOR" };
      return pw.registerWatchReader(FOLLOWING_MODULE, (a) => this.watchesOfPlan(a || {}));
    } catch (e) { return { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
  }

  /* ===================================================================== *
   * WATCH MARKS AND SECOND-LOOK FLAGS (R32–R35; T50; N1092; DEC-238 S23 "A").
   * ===================================================================== */

  /* R32: the member a stamp names, as `member:<id>` (the founder as `admin`), or null for an absent, unrecognised or
     machine stamp. A viewer carrying a project (`<viewer>@<project>`) is the same member. */
  #memberKey(v) {
    if (!said(v) || viewerPredicate(v).scope === "DENY") return null;
    const m = /^(?:member:([^@]+)|admin)(?:@[\s\S]*)?$/.exec(v);
    if (!m) return null;
    return m[1] === undefined || m[1] === MEMBER_ADMIN ? MEMBER_ADMIN : `member:${m[1]}`;
  }
  /* R33: a member key as the handle a reader sees (never an internal id): the founder's through membership's
     `founderHandle`; null while none is held. */
  #handleOf(key) {
    try {
      if (key === MEMBER_ADMIN) return this.membership.founderHandle() ?? null;
      const m = /^member:(.+)$/.exec(String(key));
      return m ? this.membership.memberFacts(m[1])?.handle ?? null : null;
    } catch { return null; }
  }
  /* R32: an item as `viewer` may see it: a bundle of the four types R85 lists that `membership` shows, or a registered
     entity of the kinds it lists (team-wide, `entities` R51) to a viewer membership recognises; else null. */
  #itemOf(id, viewer) {
    if (!said(id) || !said(viewer) || viewerPredicate(viewer).scope === "DENY") return null;
    const item = id.trim();
    try {
      const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, item);
      if (b) return MARK_BUNDLE_TYPES.includes(b.object_type) && this.membership.inSight(item, viewer) ? { id: item, bundle: item } : null;
      const r = this.entities.readEntity({ entityId: item, viewer });
      const e = r && r.ok && r.found && r.entity ? r.entity : null;
      return e && MARK_ENTITY_KINDS.includes(e.kind) ? { id: item, bundle: null } : null;
    } catch { return null; }
  }
  /* R32: the refusals every mark act shares, in order: a machine (or absent) author, an item not named, one not seen. */
  #markRefusal(by, item, viewer) {
    if (!said(by) || isMachineIdentity(by) || !this.#memberKey(by))
      return { ok: false, reason: "MACHINE_CANNOT_MARK", code: "MACHINE_CANNOT_MARK", check: null, translation: word("refusal.MACHINE_CANNOT_MARK"),
               detail: localize("following.index.watch_flag_member_acts", "watching and flagging are a member's own acts; the machine marks nothing") };
    if (!said(item)) return { refusal: refuse("MARK_NO_ITEM", localize("following.index.act_names_item", "an act on an item names the item")) };
    const it = this.#itemOf(item, viewer ?? by);
    if (!it) return { refusal: refuse("MARK_NO_SUCH_ITEM", localize("following.index.no_item_seen", "no item by that id is one you may see")) };
    return { item: it };
  }

  /** R32 (`op=watchitem`): a member puts an item on her own watch list, or takes it off with `on: false`. Setting what is
   *  set, or taking off what is not, answers `existed: true` and writes nothing. Each setting and taking off is kept
   *  with its instant. A mark is read back only to the member who set it (R34, R35). */
  watchItem({ item, on = true, by, viewer = null } = {}) {
    const m = this.#markRefusal(by, item, viewer);
    if (m.ok === false) return m;
    if (m.refusal) return m.refusal;
    const member = this.#memberKey(by);
    const want = !(on === false || on === "false" || on === 0 || on === "0");
    const cur = this.#one(`SELECT on_mark, at FROM watch_marks WHERE item=? AND member=? ORDER BY seq DESC LIMIT 1`, m.item.id, member);
    const has = !!cur && Number(cur.on_mark) === 1;
    if (has === want) return { ok: true, existed: true, item: m.item.id, watched: want, ...(cur ? { at: cur.at } : {}) };
    const at = instant(this.now());
    this.#sql.exec(`INSERT INTO watch_marks (item, bundle_id, member, on_mark, at) VALUES (?,?,?,?,?)`, m.item.id, m.item.bundle, member, want ? 1 : 0, at);
    return { ok: true, item: m.item.id, watched: want, at };
  }

  /* R33: one flag as a reader sees it: who raised it and who cleared it as handles, never as internal ids. */
  #flagView(f) {
    return { flag: Number(f.flag_id), item: f.item, by: this.#handleOf(f.raised_by), at: f.at, note: f.note,
             cleared_by: f.cleared_at ? this.#handleOf(f.cleared_by) : null, cleared_at: f.cleared_at ?? null };
  }
  #openFlag(item) { return this.#one(`SELECT * FROM second_looks WHERE item=? AND cleared_at IS NULL ORDER BY flag_id DESC LIMIT 1`, item); }

  /** R33 (`op=secondlook`): a member raises a flag asking the team to look at an item again, with her note (one line,
   *  at most 500 characters). An item already flagged and not cleared answers `existed: true` with that flag. */
  secondLook({ item, note, by, viewer = null } = {}) {
    const m = this.#markRefusal(by, item, viewer);
    if (m.ok === false) return m;
    if (m.refusal) return m.refusal;
    if (typeof note !== "string" || !note.trim() || note.length > SECOND_LOOK_NOTE_MAX || /[\r\n\u2028\u2029]/.test(note))
      return refuse("SECOND_LOOK_NO_NOTE", localize("following.index.a_second_look_carries_a", "a second look carries a note: one line of at most {SECOND_LOOK_NOTE_MAX} characters, saying what to check", { SECOND_LOOK_NOTE_MAX: String(SECOND_LOOK_NOTE_MAX) }));
    const open = this.#openFlag(m.item.id);
    if (open) return { ok: true, existed: true, ...this.#flagView(open) };
    this.#sql.exec(`INSERT INTO second_looks (item, bundle_id, raised_by, note, at) VALUES (?,?,?,?,?)`,
                   m.item.id, m.item.bundle, this.#memberKey(by), note.trim(), instant(this.now()));
    return { ok: true, ...this.#flagView(this.#openFlag(m.item.id)) };
  }

  /** R33 (`op=secondlookclear`): any member who may see the item clears its open flag, no reason required; the flag stays
   *  in the history with who cleared it and when. */
  secondLookClear({ item = null, flag = null, by, viewer = null } = {}) {
    let row = null, named = item;
    if (flag != null && flag !== "") {
      const n = Number(flag);
      row = Number.isSafeInteger(n) ? this.#one(`SELECT * FROM second_looks WHERE flag_id=?`, n) : null;
      named = row ? row.item : "\u0000";
    }
    const m = this.#markRefusal(by, named, viewer);
    if (m.ok === false) return m;
    if (m.refusal) return m.refusal;
    row = row || this.#openFlag(m.item.id);
    if (!row || row.cleared_at) return refuse("SECOND_LOOK_NOT_OPEN", localize("following.index.no_open_second_look", "the item has no open second look to clear"));
    this.#sql.exec(`UPDATE second_looks SET cleared_by=?, cleared_at=? WHERE flag_id=? AND cleared_at IS NULL`,
                   this.#memberKey(by), instant(this.now()), row.flag_id);
    return { ok: true, ...this.#flagView(this.#one(`SELECT * FROM second_looks WHERE flag_id=?`, row.flag_id)) };
  }

  /** R33: the flags raised on an item, open and cleared, oldest first, to a viewer who may see the item. Writes nothing. */
  secondLooksOf({ item, viewer = null } = {}) {
    if (!said(item)) return refuse("MARK_NO_ITEM", localize("following.index.second_looks_names_item", "a read of an item's second looks names the item"));
    if (!this.#itemOf(item, viewer)) return refuse("MARK_NO_SUCH_ITEM", localize("following.index.no_item_seen_2", "no item by that id is one you may see"));
    return { ok: true, item: item.trim(), flags: this.#rows(`SELECT * FROM second_looks WHERE item=? ORDER BY flag_id`, item.trim()).map((f) => this.#flagView(f)) };
  }

  /* R34: the viewer's own current watch marks, newest set first. */
  #watchedOf(member) {
    if (!member) return [];
    return this.#rows(`SELECT m.item, m.at FROM watch_marks m WHERE m.member=? AND m.on_mark=1
                       AND m.seq = (SELECT max(seq) FROM watch_marks WHERE item=m.item AND member=m.member) ORDER BY m.at DESC, m.seq DESC`, member);
  }

  /** R34: the read this module registers with `retrieval.registerBrowseMarks` (its R86). `{viewer, only, limit}` answers
   *  `{items, truncated}`: `watched`, the ids the viewer's own marks hold; `flagged`, every open flag the viewer may see
   *  as `{id, by, at, note}`, at most 5,000. `{viewer, ids}` answers `{watched, flagged}` for those ids (at most 200).
   *  Only what the viewer may see is answered. Writes nothing; never throws; a viewer membership does not recognise,
   *  and a machine's, get nothing. */
  browseMarks(a = {}) {
    const asked = a && typeof a === "object" ? a : {};
    const byIds = Array.isArray(asked.ids);
    const none = byIds ? { watched: [], flagged: [] } : { items: [], truncated: false };
    try {
      const viewer = asked.viewer;
      if (!said(viewer) || viewerPredicate(viewer).scope === "DENY") return none;
      const member = this.#memberKey(viewer);
      if (!member) return none;   /* a flag and a watch are a member's to read: a machine's viewer is given none */
      const seen = new Map();
      const visible = (id) => { if (!seen.has(id)) seen.set(id, !!this.#itemOf(id, viewer)); return seen.get(id); };
      const flag = (f) => ({ id: f.item, by: this.#handleOf(f.raised_by), at: f.at, note: f.note });
      if (byIds) {
        const ids = [...new Set(asked.ids.filter((x) => typeof x === "string" && x))].slice(0, BROWSE_IDS_MAX);
        if (!ids.length) return none;
        const mine = new Set(this.#watchedOf(member).map((x) => x.item));
        const flagged = new Map(this.#rows(`SELECT * FROM second_looks WHERE cleared_at IS NULL`).map((f) => [f.item, f]));
        return { watched: ids.filter((id) => mine.has(id) && visible(id)), flagged: ids.filter((id) => flagged.has(id) && visible(id)).map((id) => flag(flagged.get(id))) };
      }
      const cap = Math.max(1, Math.min(BROWSE_MARKS_MAX, Number.isFinite(Number(asked.limit)) && asked.limit != null ? Math.floor(Number(asked.limit)) : BROWSE_MARKS_MAX));
      const out = [];
      let truncated = false;
      if (asked.only === "watched") {
        for (const x of this.#watchedOf(member)) {
          if (!visible(x.item)) continue;
          if (out.length === cap) { truncated = true; break; }
          out.push(x.item);
        }
      } else if (asked.only === "flagged") {
        for (const f of this.#rows(`SELECT * FROM second_looks WHERE cleared_at IS NULL ORDER BY at DESC, flag_id DESC`)) {
          if (!visible(f.item)) continue;
          if (out.length === cap) { truncated = true; break; }
          out.push(flag(f));
        }
      } else return none;
      return { items: out, truncated };
    } catch { return none; }
  }

  /** R34: this module's second registration, at start, with retrieval's door (its R86). A registration the door refuses
   *  is a start-up fault, reported by throwing; a retrieval that cannot be reached answers why. */
  registerMarks() {
    let rt;
    try { rt = this.retrieval; } catch (e) { return { ok: false, reason: "NO_BROWSE_DOOR", detail: String((e && e.message) || e).slice(0, 160) }; }
    if (!rt || typeof rt.registerBrowseMarks !== "function") return { ok: false, reason: "NO_BROWSE_DOOR" };
    const r = rt.registerBrowseMarks(FOLLOWING_MODULE, (a) => this.browseMarks(a));
    if (!r || r.ok === false) throw new Error(`following: retrieval refused its marks read: ${(r && r.reason) || "no answer"}`);
    return r;
  }

  /** R35 (for `notice-producers` alone; no op serves it): each member whose watch mark on the item is set now, `member`
   *  her id and `at` the instant that mark was last set, oldest first; `MARK_NO_SUCH_ITEM` for what is no item R32 lists.
   *  Writes nothing; never throws. */
  watchedBy(item) {
    const no = () => refuse("MARK_NO_SUCH_ITEM", localize("following.index.no_item_marks_list", "no item by that id is one the marks list"));
    try {
      if (!said(item)) return no();
      const id = item.trim();
      const bundle = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id);
      let listed = !!bundle && MARK_BUNDLE_TYPES.includes(bundle.object_type);
      if (!bundle) {
        const r = this.entities.readEntity({ entityId: id, viewer: MACHINE });
        listed = !!(r && r.ok && r.found && r.entity && MARK_ENTITY_KINDS.includes(r.entity.kind));
      }
      if (!listed) return no();
      return { ok: true, watchers: this.#rows(`SELECT m.member, m.at FROM watch_marks m WHERE m.item=? AND m.on_mark=1
        AND m.seq = (SELECT max(seq) FROM watch_marks WHERE item=m.item AND member=m.member) ORDER BY m.at, m.seq`, id).map((x) => ({ member: x.member, at: x.at })) };
    } catch { return no(); }
  }

  /* ===================================================================== *
   * THE READS (R11, R14).
   * ===================================================================== */

  #sees(f, viewer) {
    if (viewerPredicate(viewer).scope === "DENY") return false;
    if (f.kind === "policy") return this.#readsPolicy((json(f.subject) || {}).standard, viewer);
    return f.home == null || this.membership.inSight(f.home, viewer);
  }

  /** R30 (T48; Actions D15, H19): a proceeding's dates in two lanes, never interleaved. `proceeding`: its own events as
   *  `events.eventsFor` answers them to the viewer (placed ones in order, then those placed nowhere), each with its
   *  `when` as held, kind, label and the captures it rests on, and today's stage as `events.proceedingStatusAt`
   *  answers it. `group`: the entries `action-clocks.ourDeadlines` answers (`owed_by: group`, pending) of the actions
   *  `actions.actionsFor` lists for the proceeding. Each lane holds at most 500 items, with `truncated`. States no
   *  lateness, no finding; writes nothing. Refused as R29 refuses. */
  proceedingDates({ proceeding, from = null, to = null, viewer = null } = {}) {
    const p = this.#proceedingNamed(proceeding, viewer, "a proceeding's dates are read of");
    if (p.refusal) return p.refusal;
    const day = (v) => v === null || v === undefined || v === "" ? null : said(v) && isCalendarDate(v.trim()) ? v.trim() : false;
    const lo = day(from), hi = day(to);
    if (lo === false || hi === false || (lo && hi && lo > hi))
      return refuse("BAD_PROCEEDING_DATES", "from and to are calendar days (YYYY-MM-DD), from not after to");
    const nowMs = this.now();
    /* the proceeding's lane */
    let ev;
    try { ev = this.events.eventsFor({ entity: p.id, from: lo, to: hi, limit: PROCEEDING_LANE_MAX, viewer }); }
    catch (e) { ev = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
    if (!ev || ev.ok === false) return ev || { ok: false, reason: "NO_ANSWER" };
    const all = [...(ev.events || []), ...(ev.placed_nowhere || [])];
    const items = all.slice(0, PROCEEDING_LANE_MAX).map((e) => this.#laneEvent(e, viewer));
    const own = { items, limit: PROCEEDING_LANE_MAX, truncated: ev.truncated === true || all.length > PROCEEDING_LANE_MAX };
    let status;
    try { status = this.events.proceedingStatusAt({ proceeding: p.id, at: this.#today(nowMs), viewer }); }
    catch (e) { status = { ok: false, reason: String((e && e.message) || e).slice(0, 160) }; }
    own.status = status && status.ok !== false ? status : { stage: "undetermined", why: (status && (status.detail || status.reason)) || "no answer" };
    /* the group's lane */
    const group = this.#groupLane(p.id, lo, hi, viewer, nowMs);
    return { ok: true, proceeding: p.id, from: lo, to: hi, lanes: { proceeding: own, group },
             note: word("following.note.proceeding_dates_group") };
  }
  /* R30: one event of the proceeding's lane: as eventsFor lists it, with its label (the place the event states, else
     its kind) and the captures it rests on. */
  #laneEvent(e, viewer) {
    let label = null, captures = [];
    try {
      const r = this.events.readEvent({ eventId: e.event_id, viewer });
      const v = r && r.found ? r.event : null;
      if (v) {
        label = said(v.where) ? v.where.trim() : null;
        captures = [...new Set((v.attestations || []).map((a) => a.capture_sha).filter(said))];
      }
    } catch { /* the event's own list entry stands */ }
    return { event: e.event_id, kind: e.kind, status: e.status ?? null, label: label ?? e.kind, when: e.when ?? null,
             ...(e.when ? {} : { when_undetermined: true, why: e.why ?? word("following.why.placed_nowhere_attestation") }), captures };
  }
  /* R30: the group's pending deadlines of the actions belonging to the proceeding. Both reads are paged and bounded; an
     action of another proceeding adds nothing, a body's entry is never listed by `ourDeadlines`. */
  #groupLane(proceeding, lo, hi, viewer, nowMs) {
    const lane = { items: [], limit: PROCEEDING_LANE_MAX, truncated: false };
    const ids = new Set();
    try {
      let after = null;
      for (let page = 0; page < GROUP_LANE_PAGES; page++) {
        const r = this.actions.actionsFor({ proceeding, after, limit: 200, viewer });
        if (!r || r.ok === false || !Array.isArray(r.items)) { lane.unread = (r && r.reason) || word("following.text.actions_read"); return lane; }
        for (const a of r.items) ids.add(a.id);
        if (!r.truncated || !r.cursor) { after = null; break; }
        after = r.cursor;
        if (page === GROUP_LANE_PAGES - 1) lane.truncated = true;
      }
    } catch { lane.unread = word("following.text.actions_read"); return lane; }
    if (!ids.size) return lane;
    try {
      let after = null;
      for (let page = 0; page < GROUP_LANE_PAGES; page++) {
        const r = this.actionClocks.ourDeadlines({ from: lo, to: hi, after, limit: PROCEEDING_LANE_MAX, viewer, now: nowMs });
        if (!r || r.ok === false || !Array.isArray(r.items)) { lane.unread = (r && (r.reason || r.detail)) || word("following.text.deadlines_read"); return lane; }
        for (const d of r.items) {
          if (!ids.has(d.action)) continue;
          if (lane.items.length >= PROCEEDING_LANE_MAX) { lane.truncated = true; return lane; }
          lane.items.push({ action: d.action, entry: d.ord ?? null, date: d.date, basis: d.basis ?? null, text: d.text ?? null, zone: d.zone ?? null });
        }
        if (!r.truncated || !r.cursor) return lane;
        after = r.cursor;
      }
      lane.truncated = true;
    } catch { lane.unread = word("following.text.deadlines_read"); }
    return lane;
  }

  /** R11: between two snapshots of one portal follow, what was added, removed and changed by key. Writes nothing. */
  snapshotDiff({ follow, from, to, viewer = null } = {}) {
    const f = this.#follow(follow);
    if (!f || f.kind !== "portal" || !this.#sees(f, viewer)) return refuse("NO_SUCH_FOLLOW", localize("following.index.no_portal_follow_seen", "no portal follow by that id you may see"));
    const snap = (n) => this.#one(`SELECT * FROM portal_snapshots WHERE follow_id=? AND seq=?`, f.follow_id, Number(n));
    const a = snap(from), b = snap(to);
    if (!a || !b) return refuse("NO_SUCH_SNAPSHOT", localize("following.index.snapshots_same_follow", "both snapshots are of this follow, by their sequence numbers"));
    const key = (json(f.subject) || {}).key;
    const base = { ok: true, follow: Number(f.follow_id), key, from: { seq: a.seq, at: a.at, valid: vintage(a.at) }, to: { seq: b.seq, at: b.at, valid: vintage(b.at) },
                   note: word("following.note.difference_between_two_answers") };
    const rowsA = this.#rowsOf(a), rowsB = this.#rowsOf(b);
    const unread = [[a, rowsA], [b, rowsB]].filter(([, r]) => !r).map(([x]) => x);
    if (unread.length) return { ...base, added: [], removed: [], changed: [],
      undetermined: unread.map((x) => ({ key: null, snapshot: x.seq, why: x.why || word("following.why.snapshot_read_rows") })) };
    return { ...base, ...diffRows(rowsA, rowsB, key) };
  }

  /** R10: a portal's snapshots, each a vintage whose validity is its capture instant (`civil-time` `validAt`). */
  snapshots({ follow, at = null, viewer = null } = {}) {
    const f = this.#follow(follow);
    if (!f || f.kind !== "portal" || !this.#sees(f, viewer)) return refuse("NO_SUCH_FOLLOW", localize("following.index.no_portal_follow_seen_2", "no portal follow by that id you may see"));
    const list = this.#rows(`SELECT seq, capture_sha, at, why FROM portal_snapshots WHERE follow_id=? ORDER BY seq`, f.follow_id)
      .map((x) => ({ seq: Number(x.seq), capture: x.capture_sha, at: x.at, valid: vintage(x.at),
                     ...(at ? { valid_at: validAt({ valid: vintage(x.at) }, at) } : {}), ...(x.why ? { why: x.why } : {}) }));
    return { ok: true, follow: Number(f.follow_id), snapshots: list };
  }

  /* R14, R22: a follow's end as every read answers it: `ends` (or null with `ends_state: "none_set"`), and when ended,
     when, by whom and why. A follow ended before T45 states its reason from its ender. */
  #endFields(f) {
    const ends = f.kind === "policy" ? null : this.#endsOf(f.follow_id);
    const reason = f.ended_reason || (f.ended_at ? (f.kind === "policy" ? "withdrawn" : "author") : null);
    return { ends, ...(ends ? {} : { ends_state: "none_set" }),
             ...(f.ended_at ? { ended_at: f.ended_at, ended_by: f.ended_by ?? null, ended_reason: reason } : {}) };
  }

  /* R40 (T53): a register watch as `follows` shows it: for a number, the register, scheme and value as the member gave them
     (`watched: "by_number"`); for a stated interest, its project, register and the filter's criteria as registers answers them
     to the viewer (`watched: "auto"`); both with the changes since the viewer's last look, a docket's alert, and why it is not
     being read (`not_read`), when it is not. */
  #registerWatchFields(f, s, gated, viewer) {
    const looked = this.#lookOf(f.follow_id, viewer);
    const notRead = gated ? "member_act_required" : ["rate_held", "host_paused", "member_act_required"].includes(f.last_outcome) ? f.last_outcome
      : s.alert && f.alert_state === "off" ? "alert_off" : null;
    if (f.kind === "register-query")
      return { register: s.register, scheme: s.scheme, value: s.value, watched: "by_number", changes_since_looked: this.#queryChangesSince(f.follow_id, looked),
               ...(s.alert ? { alert: f.alert_state === "off" ? "off" : s.alert } : {}), ...(notRead ? { not_read: notRead } : {}) };
    let criteria = null;
    try {
      const r = this.registers.interestOf({ project: s.project, register: s.register, viewer });
      const i = r && r.ok && Array.isArray(r.interests) ? r.interests.find((x) => String(x.id) === String(s.interest)) : null;
      criteria = i ? i.filter : null;
    } catch { criteria = null; }
    return { project: s.project, register: s.register, interest: s.interest, criteria, watched: "auto",
             changes_since_looked: this.#interestChanges(viewer).filter((c) => String(c.interest) === String(s.interest) && (!looked || c.at > looked)).length,
             ...(notRead ? { not_read: notRead } : {}) };
  }
  /* R40: the viewer's last look at a watch's changes, or null. */
  #lookOf(id, viewer) {
    const m = this.#memberKey(viewer);
    if (!m) return null;
    const r = this.#one(`SELECT at FROM register_looks WHERE follow_id=? AND member=?`, Number(id), m);
    return r ? r.at : null;
  }
  #queryChangesSince(id, looked) {
    return Number(this.#one(`SELECT count(*) AS n FROM register_query_changes WHERE follow_id=? ${looked ? "AND at > ?" : ""}`, Number(id), ...(looked ? [looked] : [])).n);
  }
  /* R39, R43: every change registers answers the viewer (its R34, paged through, bounded), oldest first. */
  #interestChanges(viewer) {
    const out = [];
    let after = 0;
    try {
      for (let page = 0; page < 50; page++) {
        const r = this.registers.changesSince({ after, limit: REGISTER_CHANGES_MAX, viewer });
        if (!r || r.ok === false || !Array.isArray(r.changes)) break;
        out.push(...r.changes);
        if (r.changes.length < REGISTER_CHANGES_MAX || !r.cursor || Number(r.cursor) === Number(after)) break;
        after = r.cursor;
      }
    } catch { /* none read */ }
    return out;
  }

  /** R40 (T53): a member's look at one register watch's changes: the changes recorded (a number's, R38; an interest's
   *  refreshes, `registers` R34), and her look recorded now, so `changes_since_looked` returns to 0. */
  followChanges({ follow, viewer = null } = {}) {
    const f = this.#follow(follow);
    const m = this.#memberKey(viewer);
    if (!f || !REGISTER_WATCH_KINDS.includes(f.kind) || !m || !this.#sees(f, viewer))
      return refuse("NO_SUCH_FOLLOW", localize("following.index.no_register_watch_seen_2", "no register watch by that id you may see is held"));
    const s = json(f.subject) || {};
    const changes = f.kind === "register-query"
      ? this.#rows(`SELECT change_id, at, counts, basis FROM register_query_changes WHERE follow_id=? ORDER BY at, change_id`, f.follow_id)
          .map((c) => ({ at: c.at, counts: json(c.counts) || { ...NO_COUNTS }, basis: c.basis }))
      : this.#interestChanges(viewer).filter((c) => String(c.interest) === String(s.interest)).map((c) => ({ at: c.at, counts: c.counts }));
    const at = instant(this.now());
    this.#sql.exec(`INSERT OR REPLACE INTO register_looks (follow_id, member, at) VALUES (?,?,?)`, Number(f.follow_id), m, at);
    return { ok: true, follow: Number(f.follow_id), changes, looked_at: at };
  }

  /** R43 (T53; `notice-producers` R30): one entry per change of a register watch, the read the queue takes: each recorded
   *  change of a number's follow (R38) and each refresh of an interest's follow that found rows added, changed or removed
   *  (`registers.changesSince`, its R34), in order of the change's instant after `after`, at most `limit` (1–200, default
   *  200), with `cursor`; `since` as R21's. `counts` and `total` only: no cell, name or value. A change of a watch the viewer
   *  may not see, or of an ended watch, is left out whole. Writes nothing. */
  registerChanges({ after = null, since = null, limit = null, viewer = null } = {}) {
    const n = limit !== null && limit !== "" && Number.isInteger(Number(limit)) ? Math.min(REGISTER_CHANGES_MAX, Math.max(1, Number(limit))) : REGISTER_CHANGES_MAX;
    const lo = since === null || since === undefined || since === "" ? null : wholeSecondFrom(since);
    if (since !== null && since !== undefined && since !== "" && lo === null)
      return { ok: true, changes: [], cursor: null, since_invalid: true, note: word("following.note.since_instant_policy") };
    if (!said(viewer) || viewerPredicate(viewer).scope === "DENY") return { ok: true, changes: [], cursor: null };
    const live = new Map();
    for (const f of this.#rows(`SELECT * FROM follows WHERE kind IN ('register-query', 'register-interest') AND ended_at IS NULL`))
      if (this.#sees(f, viewer)) live.set(Number(f.follow_id), f);
    const all = [];
    for (const c of this.#rows(`SELECT * FROM register_query_changes ORDER BY at, change_id`)) {
      const f = live.get(Number(c.follow_id));
      if (!f) continue;
      const s = json(f.subject) || {};
      const counts = json(c.counts) || { ...NO_COUNTS };
      all.push({ key: `${c.at}|q|${String(c.change_id).padStart(12, "0")}`, at: c.at,
                 entry: { watch: Number(f.follow_id), kind: f.kind, register: s.register, at: c.at, counts, total: total(counts), ...(s.alert ? { alert: s.alert } : {}) } });
    }
    const byInterest = new Map([...live.values()].filter((f) => f.kind === "register-interest").map((f) => [String((json(f.subject) || {}).interest), f]));
    if (byInterest.size)
      for (const c of this.#interestChanges(viewer)) {
        const f = byInterest.get(String(c.interest));
        if (!f) continue;
        const at = wholeSecondFrom(c.at) || c.at;
        const counts = { ...NO_COUNTS, ...(c.counts || {}) };
        all.push({ key: `${at}|i|${String(c.import ?? 0).padStart(12, "0")}`, at,
                   entry: { watch: Number(f.follow_id), kind: f.kind, register: c.register, project: c.project, at, counts, total: total(counts) } });
      }
    all.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const from = said(String(after ?? "")) ? String(after) : null;
    const rest = all.filter((x) => (!lo || x.at >= lo) && (!from || x.key > from));
    const page = rest.slice(0, n);
    return { ok: true, changes: page.map((x) => x.entry), cursor: rest.length > n ? page[page.length - 1].key : null,
             note: word("following.note.difference_between_two") };
  }

  /** R14: every follow the viewer may see, and every per-meeting watch, with what is not being read and why; each
   *  follow with its end date (R22). Ended follows are listed too when `ended` is set, each with when and why. */
  follows({ viewer = null, now = null, ended = false } = {}) {
    const nowMs = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : this.now();
    this.#syncPolicies(nowMs);
    this.#endExpired(nowMs);
    this.#endClosedProjects();
    const plan = this.#followPlan(nowMs);
    if (ended === true || ended === "1" || ended === "true")
      for (const f of this.#rows(`SELECT * FROM follows WHERE ended_at IS NOT NULL ORDER BY follow_id`))
        plan.push({ kind: "follow", follow: f, id: Number(f.follow_id), due_at: null, ended: true });
    plan.sort((a, b) => a.id - b.id);
    const items = [];
    for (const p of plan) {
      const f = p.follow;
      if (!this.#sees(f, viewer)) continue;
      const s = json(f.subject) || {};
      const gated = json(f.gated);
      items.push({ follow: p.id, kind: f.kind, subject: s, author: f.kind === "policy" ? null : f.author, home: f.home,
        period: f.kind === "body" ? { from: f.from_day, until: f.until_day } : null,
        /* G21: how far a body's read has gone: the meetings read of those counted, `more` while the count is not yet known */
        ...(f.kind === "body" ? { body_read: bodyProgress(json(f.body_cursor)) } : {}), cadence: f.cadence, at: f.at,
        proceeding: f.kind === "register" && s.proceeding ? s.proceeding : null,
        last_read: f.last_read, last_outcome: f.last_outcome, next_due: p.ended ? null : p.due_at ?? instant(nowMs),
        ...this.#endFields(f),
        ...(gated ? { gated, unscheduled: "read only at its member's own act (R8); the tick fetches nothing" } : {}),
        ...(f.kind === "policy" ? { watch: word("following.watch"),
                                    ...(POLICY_GATED_ACCESS.includes(s.access) ? { unscheduled: word("following.unscheduled.read_member_act") } : {}) } : {}),
        ...(f.kind === "register" && !s.render ? { form: "static", note: STATIC_ONLY } : {}),
        ...(REGISTER_WATCH_KINDS.includes(f.kind) ? this.#registerWatchFields(f, s, gated, viewer) : {}) });
    }
    for (const m of this.#meetingPlan(nowMs)) {
      if (!this.membership.inSight(m.bundle, viewer)) continue;
      items.push({ kind: "per_meeting", subject: { address: m.address, bundle: m.bundle, body: m.body ?? null },
        ...(m.unscheduled ? { unscheduled: m.unscheduled } : { notice: m.notice, meeting: m.meeting, meeting_source: m.meeting_source, next_due: m.due_at }),
        last_capture: this.#one(`SELECT meeting, due_at, taken_at, lateness_ms FROM per_meeting_captures WHERE address=? ORDER BY taken_at DESC LIMIT 1`, m.address) });
    }
    return { ok: true, as_of: instant(nowMs), items };
  }
}

/** G21: how far a followed body's read has gone, as the cursor says it: the meetings read of those counted so far, `more`
 *  while a page of meetings is not yet taken (the total is not known), `whole` once the read has finished, and its phase. */
export function bodyProgress(c) {
  if (!c) return null;
  if (c.done) return { read: c.meetings, total: c.meetings, more: false, whole: true, phase: "done" };
  if (c.phase === "matters") return { read: c.meetings, total: c.meetings, more: false, whole: false, phase: "matters" };
  return { read: c.base + c.idx, total: c.base + c.size, more: !!c.more, whole: false, phase: "meetings" };
}

/* R43: a change's counts summed. */
const total = (c) => ["added", "changed", "removed", "possibly_removed"].reduce((n, k) => n + (Number(c && c[k]) || 0), 0);

/** R10: a snapshot's validity: the capture instant, at second precision (`civil-time`'s value). */
export function vintage(at) { const v = String(at).slice(0, 19); return { from: v, to: v, precision: "second", zone: "UTC" }; }

/** The module's ops (K3), spread into the plane's op map. `viewer` and `by` are the control plane's stamps, read from
 *  the url; a body's own copy is never read. */
export function followingOps(f, url, body) {
  const q = (k) => url.searchParams.get(k);
  const act = (fn) => () => fn({ ...(body || {}), author: q("by") ?? null, viewer: q("viewer") ?? null });
  const mark = (fn) => () => fn({ ...(body || {}), by: q("by") ?? null, viewer: q("viewer") ?? null });
  return {
    followbody: act((b) => f.followBody(b)),
    unfollow: act((b) => f.unfollow(b)),
    watchitem: mark((b) => f.watchItem(b)),
    secondlook: mark((b) => f.secondLook(b)),
    secondlookclear: mark((b) => f.secondLookClear(b)),
    followend: () => f.followEnd({ ...(body || {}), by: q("by") ?? null, viewer: q("viewer") ?? null }),
    followregister: act((b) => f.followRegister(b)),
    followpersonquery: act((b) => f.followPersonQuery(b)),
    followportal: act((b) => f.followPortal(b)),
    permeetingbody: act((b) => f.perMeetingBody(b)),
    refreshregister: act((b) => f.refreshRegister(b)),
    proceedingdates: () => f.proceedingDates({ proceeding: q("proceeding"), from: q("from"), to: q("to"), viewer: q("viewer") }),
    follows: () => f.follows({ viewer: q("viewer"), now: q("now"), ended: q("ended") }),
    snapshots: () => f.snapshots({ follow: q("follow"), at: q("at"), viewer: q("viewer") }),
    snapshotdiff: () => f.snapshotDiff({ follow: q("follow"), from: q("from"), to: q("to"), viewer: q("viewer") }),
    watchlink: act((b) => f.watchLink(b)),
    watchanswer: act((b) => f.watchAnswer(b)),
    watchquestions: () => f.watchQuestions({ after: q("after"), limit: q("limit"), viewer: q("viewer") }),
  };
}

/* R36 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  followregister: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("following.declared.followregister", "register-directed: keyed by the register's address; a member's follow, moving no bundle"),
    fields: { accepts: ["address","render","gated","cadence","home","ends","proceeding"], requires: ["address"] } },
  watchitem: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("following.declared.watchitem", "item-directed: a member's own watch on one followed item, read back only to its setter; moves no bundle"),
    fields: { accepts: ["item","on"], requires: ["item"] } },
  secondlook: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("following.declared.secondlook", "item-directed: a member asks a second look at one followed item, seen by every member with the date and note; moves no bundle"),
    fields: { accepts: ["item","note"], requires: ["item","note"] } },
  secondlookclear: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("following.declared.secondlookclear", "item-directed: a member clears a second look at one followed item, with who and when; moves no bundle"),
    fields: { accepts: ["item","flag"], requires: [["item","flag"]] } },
});
