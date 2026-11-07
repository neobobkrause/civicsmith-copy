/* ===========================================================================
 *  scheduler (layer 10; build/requirements/scheduler.md): THE PLANE'S ONE RECONCILING DURABLE OBJECT ALARM.
 *
 *  DECISION (REC-1, recorded in full in docs/development/SCHEDULER.md; amended by Bob, K4566): the plane's periodic work
 *  runs on ONE reconciling Durable Object alarm, and never on a Worker cron trigger (R14). A cron's floor is a minute
 *  where the task drain coalesces at a second (granularity); a cron fires forever where the alarm is deleted when nothing
 *  waits (self-termination, R15); and every consumer reconciles against the Durable Object's own storage (locality).
 *  The one cron the plane declares is the watchdog over this alarm: it calls `watch` (R29), which checks the alarm and
 *  the heartbeat and re-arms, and never runs owed work.
 *
 *  MECHANISM. A registry of consumers `{name, key, due(now), wake(now), tick(now)}` (R5): `onAlarm` runs the tick of
 *  every consumer due at the firing instant (within the grace), in registry order, then reconciles the one alarm to
 *  the EARLIEST wake any consumer still wants, over the WHOLE registry, deleting it when none does (R1, R15, R16).
 *  A producer that created work calls `arm`, which reconciles the same way but only ever pulls the alarm earlier
 *  (R4). Each consumer's work, cadence, batch and delay are its owning module's (R7): this module holds the grace
 *  and nothing else, keeps no table (R18), raises no queue item (R19) and names no place (R20).
 *
 *  The consumers' owners are reached through their factories (K61); a later module (the task drain's owner `tasks`,
 *  the queue re-notify's `queue`, the group-domain re-check's `instance-setup`) registers its consumer through
 *  `register` (R8). The producers' notices of the earlier modules are registered here, at
 *  construction (R9, the registration rule K206).
 *
 *  T33-80 (R21): six consumers of T33's new work close the registry. `follow`, `standing-questions` and `dated-waits`
 *  are due and wake when their owners say. `duty-transitions`, `interest-checks` and `money-detectors` state no due or
 *  wake of their own, so they run once per local day at the group's local day start (K1522), and again at the next
 *  firing while their owner says its pass is not done (K1566); the day is `civil-time`'s in the active jurisdiction
 *  view's time zone. Their one piece of state, the day each last finished a pass and the cursor of a pass under way, is
 *  the storage value `sched_daily`, never a table (R18). An act their owners tell of (a duty tracked, a check changed, a
 *  detector switched on: R9) asks for a pass at the next firing, so the change is not left to the next local day.
 *
 *  T34-51, T41-49 (R22, R23): `scheduled-publish` takes each waiting edition at its set time through `publish-schedule`
 *  (its R2; `publication` R67 until N823's split), re-armed by publish-schedule's `onPublishScheduled` (its R6);
 *  `answers`' `onStandingSet` (its R27) re-arms the standing questions. A notice whose registration is refused is a start-up fault, kept and logged (`faults()`), never ignored.
 *
 *  T36-29, T37-24 (R24): five consumers close the registry, each calling `file-safety`, which the plane hands this
 *  module (`hand`, or `schedulerOf`'s `deps.fileSafety`) once it has built it: `file-scan` (its R4), `file-render` (its
 *  R12), `file-deeper` (its R36), `file-forward` (its R35) and `file-reputation` (its R41). Each one's due and wake are
 *  what `file-safety` R39 answers, asked afresh each time from its own durable state, so this module keeps no instant,
 *  period or interval for any of them (R7, R18); a value `sched_files` T36 left in storage is ignored, never read.
 *  When handed, it registers once with `file-safety.onFileWork` (its R40), whose call arms the alarm (R9).
 *
 *  T39-15 (R25; N806, K2333): `document-copy` closes the registry, calling `case-carriage.copyBatch` (its R15), its due
 *  and wake `copyWake(now)` asked afresh each time from case-carriage's own tables, so nothing is kept here (R7, R18).
 *  At start it registers once with `case-carriage.onCopyWork` (its R17), whose call arms the alarm (R9).
 *
 *  T41-49 (R26; N820, K2568): `question-explore` closes the registry, calling `question-explorer` (its R1), which the
 *  plane hands this module (`hand`, or `schedulerOf`'s `deps.questionExplorer`) once it has built it: due now while its
 *  `exploreDue` counts any question due, its wake `exploreWake`, its tick `exploreTick`; every cadence, including an
 *  Ask's re-check, is question-explorer's (R7). `investigation`'s quiet check (its R18) is read by `notice-producers`
 *  when it asks; it offers this module no due, wake or tick, so no consumer of investigation's is registered here.
 *
 *  G55 (R7, R24; K4562): `ingest` closes the registry, calling `calculations` (its R14): a money ingest over the
 *  inline threshold runs in the background, one slice for each firing. Due while `ingestDue(now)` says a record is
 *  `ingesting`, its wake `ingestWake(now)`, its tick `ingestTick(now)`; the slice sizes, the attempts and the stop are
 *  calculations' (R7). This module builds `calculations` itself (`schedulerOf`'s default owners) and registers once
 *  with `calculations.onIngestWork`, whose call arms the alarm (R9) when a record starts.
 *
 *  T53 (R34, R35; N1259, N824): after `question-explore` stand `register-import` (`registers`' `importDue`, `importWake` and
 *  `importTick(now, budget, host)`, `host` monitoring's `sweepHost()`, one slice a firing, the slice bound registers'; armed by
 *  `registers.onImportQueued`, its R11), `discard-clear` (`doorbell`'s `clearDiscarded`, R30; due only while its litigation-hold
 *  reader lets it clear) and `mail-clear` (`mail-door`'s `clearWaitingMail`, R6). `ingest` (G55, the later ruling) still closes
 *  the registry, so the T53 four stand together just before it.
 *
 *  G91, G92, G94, G95, G123g (R28-R33; fix round 9): a firing has a budget (about 10 s) shared by its consumers' ticks, each
 *  awaited for what is left of it; when it is spent the firing starts no further consumer, reconciles and ends, and the
 *  next begins at the consumer after the last one that ran (`rotate_from` in the heartbeat), so none holds the rest. A call
 *  that outlasts the budget goes on in an in-flight set: not abandoned, not asked or started again, its result taken at a
 *  later firing; it is told the instant its own work began (third argument of `tick`) and is logged as one line, before it
 *  ends when it runs past the threshold and when it ends. The heartbeat is read from storage at the start of every run.
 * ========================================================================= */
import { retrievalOf } from "../retrieval/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { progressionsOf } from "../progressions/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { captureRequestsOf } from "../capture-requests/index.mjs";
import { calibrationOf } from "../calibration/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { intentOf } from "../intent/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { monitoringOf } from "../monitoring/index.mjs";
import { linkSweepOf } from "../link-sweep/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { networkNoticesOf } from "../network-notices/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { peopleOf } from "../people/index.mjs";
import { moneyChecksOf } from "../money-checks/index.mjs";
import { answersOf } from "../answers/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { followingOf } from "../following/index.mjs";
import { publishScheduleOf } from "../publish-schedule/index.mjs";
import { caseCarriageOf } from "../case-carriage/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { registersOf } from "../registers/index.mjs";
import { doorbellOf } from "../doorbell/index.mjs";
import { mailDoorOf } from "../mail-door/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { localDay, dayRange } from "../civil-time/index.mjs";
import { governingZone } from "../../../jurisdictions/index.mjs";
import { localize } from "../setup-words/index.mjs";

/** An alarm may fire a hair early: a consumer due within this window of the firing instant runs (R1). */
export const SCHED_GRACE_MS = 250;
/** An alarm this far past is spent, not armed (R4, R11): the platform stops retrying after repeated killed runs. */
const SPENT_ALARM_MS = 60_000;
/** R30: the consumers of one firing share this budget; when it is spent the firing starts no further consumer. */
const FIRING_BUDGET_MS = 10_000;
/** R30: a consumer call that runs past this is logged before it ends as well as after (R-LOG). */
const SLOW_CONSUMER_MS = 1_000;
/** R28 (G95): `stale` once work has been owed this long with no firing completed in it, or one firing has run this long. */
const STALE_AFTER_MS = 5 * 60e3;

/** R5: the registry's order. `capture-request-drain` before `ai-run-wake` is load-bearing: a request that completes
 *  on an alarm wakes its run on the same alarm. `gathering-sweep` (T23) stands after `monitor-cadence`, where R5
 *  places it, so the positions after it move by one; `working-on-seal` and `working-on-attest` (T23) are appended
 *  last; `scheduled-publish` (R22) stands before them, so an opening a scheduled commit leaves undone is retried on the
 *  same alarm. Order is read by name, never by index (K1122). */
export const SCHEDULER_ORDER = Object.freeze([
  "selection-sweep", "task-drain", "archive-monitor", "connection-derive", "overdue-scan", "queue-renotify",
  "monitor-cadence", "gathering-sweep", "ai-run-reap", "capture-request-drain", "ai-run-wake", "calibration-reprobe",
  "group-domain-recheck", "bias-debt", "intent-age", "notice-sweep", "deadline-recheck", "scheduled-publish", "working-on-seal",
  "working-on-attest", "follow", "duty-transitions", "interest-checks", "money-detectors", "standing-questions",
  "dated-waits", "file-scan", "file-render", "file-deeper", "file-forward", "file-reputation", "document-copy", "question-explore",
  "register-import", "discard-clear", "mail-clear", "ingest",
]);

/** R2: each consumer's key in `onAlarm`'s answer. The task drain's counts are spread into the answer's own fields. */
export const SCHEDULER_KEYS = Object.freeze({
  "selection-sweep": "swept", "task-drain": "drain", "archive-monitor": "monitor", "connection-derive": "connderive",
  "overdue-scan": "overduescan", "queue-renotify": "queuerenotify", "monitor-cadence": "monitorcadence",
  "gathering-sweep": "gatheringsweep", "ai-run-reap": "airunreap", "capture-request-drain": "capturerequests", "ai-run-wake": "airunwake",
  "calibration-reprobe": "calibration", "group-domain-recheck": "groupdomain", "bias-debt": "biasdebt",
  "intent-age": "intentage", "notice-sweep": "noticesweep", "deadline-recheck": "deadlinerecheck", "scheduled-publish": "scheduledpublish",
  "working-on-seal": "workingonseal", "working-on-attest": "workingonattest", "follow": "follow",
  "duty-transitions": "dutytransitions", "interest-checks": "interestchecks", "money-detectors": "moneydetectors",
  "standing-questions": "standingquestions", "dated-waits": "datedwaits",
  "file-scan": "filescan", "file-render": "filerender", "file-deeper": "filedeeper", "file-forward": "fileforward",
  "file-reputation": "filereputation", "document-copy": "doccopy", "question-explore": "explore",
  "register-import": "registerfileimport", "discard-clear": "discardclear", "mail-clear": "mailclear", "ingest": "ingest",
});

/** R6: due at every firing. Every other consumer is due only when its owner says so. */
export const ALWAYS_DUE = Object.freeze(["selection-sweep", "task-drain", "archive-monitor", "connection-derive", "overdue-scan"]);

/** R10: the batch-bounded ticks, which receive the rank with their `now`. */
export const RANKED = Object.freeze(["monitor-cadence", "archive-monitor", "gathering-sweep", "capture-request-drain", "bias-debt",
                                     "follow"]);

/** R21 (K1522): the consumers whose owners state no due or wake: once per local day, and at every firing while a pass
 *  is under way. */
export const DAILY = Object.freeze(["duty-transitions", "interest-checks", "money-detectors"]);

/** money-checks R6 takes a budget and states none; this is the one its sibling owners state as their default
 *  (duties R13's and people R23's `budgetMs`, 1000 ms), passed until money-checks states its own (R7). */
export const DETECTORS_BUDGET_MS = 1000;

/** R24: the consumers of `file-safety`, after `dated-waits`. */
export const FILE_SAFETY_CONSUMERS = Object.freeze(["file-scan", "file-render", "file-deeper", "file-forward", "file-reputation"]);

/* The answer's own fields (R2); a registered consumer's key may not take one. */
const ANSWER_FIELDS = new Set(["swept", "drained", "created", "folded", "refused", "waiting", "remaining", "rearmed",
                               "nextAt", "probes"]);
const DRAIN_ZERO = Object.freeze({ drained: 0, created: [], folded: [], refused: [], waiting: [], remaining: 0 });
const PROBE_KEY = "sched_probe";
const DAILY_KEY = "sched_daily";
const BEAT_KEY = "sched_beat";   /* the heartbeat: {last_run, running_since, watchdog_seen, watchdog_ran, rotate_from, inflight, slowest, ...} (R28-R30, R33) */
/** A `running_since` older than this is a killed run's leftover, not a run in progress (R29): one cycle. */
const RUNNING_BOUND_MS = 5 * 60e3;
/** One cycle of the alarm, for `health()` (R28): the monitor's own five minutes (`monitoring` R19); a stall is two of them. */
const HEALTH_CYCLE_MS = 5 * 60e3;
/** `heal()` looks at the alarm at most this often per instance, so a request path may call it on every request (R28). */
const HEAL_EVERY_MS = 5e3;
const DAY_MS = 86_400_000;
const message = (e) => String((e && e.message) || e).slice(0, 500);
/* An instant in ms as civil-time's instant text, at the second (ISO_TS_RE). */
const instantText = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
/* An owner's instant: a number in ms, or instant text read to ms; anything else is none. */
const msOf = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
const nextDate = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** The group's local day of `ms`: `{date, zone, start, next}` (`start` and `next` the instants in ms its day and the
 *  next begin), through `civil-time.localDay` and `dayRange` in `zone`. With no zone, or one civil-time refuses, the UTC
 *  day, answered with `zone: null` so the answer says which day it read. */
export function localDayOf(ms, zone) {
  if (typeof zone === "string" && zone) {
    try {
      const date = localDay(instantText(ms), zone);
      if (typeof date === "string") {
        const a = dayRange(date, date, zone), b = dayRange(nextDate(date), nextDate(date), zone);
        if (a && typeof a.start === "string" && b && typeof b.start === "string")
          return { date, zone, start: Date.parse(a.start), next: Date.parse(b.start) };
      }
    } catch { /* read as the UTC day below */ }
  }
  const start = Math.floor(ms / DAY_MS) * DAY_MS;
  return { date: instantText(start).slice(0, 10), zone: null, start, next: start + DAY_MS };
}

/** The active jurisdiction view's time zone (record-core's `jurisdiction_profiles`, combined by `jurisdictions`), or
 *  null when none is held. */
export function viewZone(record) {
  try {
    const ids = record && typeof record.getSetting === "function" ? record.getSetting("jurisdiction_profiles") : null;
    const z = governingZone(ids, record.getSetting("team_time_zone")); /* K5292 (jurisdictions R98) */
    return typeof z === "string" && z ? z : null;
  } catch { return null; }
}

/** R10: the rank. `items` are `{kind, id, waitingSince?, cadenceMs?}` (`kind` one of `address`, `bundle`, `request`,
 *  as intent's `servesOf` names subjects, or `sweep`, `"<bundle>#<id>"` (link-sweep R4), which serves what its
 *  bundle serves, so intent is asked of that bundle; `waitingSince` the instant the item began to wait, in ms). Answers the items
 *  reordered, each with `rank: {overdue, gaps, aspirations, waited_ms}`: work that has waited longer than one whole
 *  cadence of its own first, then work serving an objective's open gap, then work serving an aspiration in force,
 *  then longest-waiting; ties keep the order given. No aspiration ranks above another (intent R12). `serves` is
 *  intent's `servesOf` (R28); one that throws or answers nothing ranks every item by its wait alone. */
export function rankBy(serves, items, now) {
  const list = Array.isArray(items) ? items.filter((x) => x && typeof x === "object") : [];
  const named = { addresses: [], bundles: [], requests: [] };
  const bucket = { address: "addresses", bundle: "bundles", request: "requests" };
  /* the subject intent is asked about: a sweep's is its bundle, the part of its full name before `#` */
  const subject = (x) => (x.kind === "sweep" && typeof x.id === "string" && x.id.includes("#")
    ? ["bundle", x.id.slice(0, x.id.indexOf("#"))] : [x.kind, x.id]);
  for (const x of list) { const [k, id] = subject(x); if (bucket[k] && !named[bucket[k]].includes(id)) named[bucket[k]].push(id); }
  let served = [];
  try { const a = serves ? serves(named) : null; served = (a && Array.isArray(a.serves)) ? a.serves : []; } catch { served = []; }
  const of = new Map(served.map((s) => [`${s.kind}\u0000${s.id}`, s]));
  const t = Number.isFinite(now) ? now : Date.now();
  const ranked = list.map((x, i) => {
    const [k, id] = subject(x);
    const s = of.get(`${k}\u0000${id}`) || {};
    const waited = Number.isFinite(x.waitingSince) ? Math.max(0, t - x.waitingSince) : 0;
    const overdue = Number.isFinite(x.cadenceMs) && x.cadenceMs > 0 && waited > x.cadenceMs;
    return { x, i, rank: { overdue, gaps: (s.gaps || []).length > 0, aspirations: (s.aspirations || []).length > 0, waited_ms: waited } };
  });
  const tier = (r) => (r.overdue ? 0 : r.gaps ? 1 : r.aspirations ? 2 : 3);
  ranked.sort((a, b) => tier(a.rank) - tier(b.rank) || b.rank.waited_ms - a.rank.waited_ms || a.i - b.i);
  return ranked.map(({ x, rank }) => ({ ...x, rank }));
}

export class Scheduler {
  #storage; #env; #owners; #registered = new Map(); #registeredOrder = [];
  /* deadline-recheck: the firing instant of its last tick that marked nothing, or null (see the consumer). */
  #deadlineIdleAt = null;
  /* R21, the daily consumers: `{[name]: {day, cursor, more}}` as the value `sched_daily` holds it (null until read),
     and the names whose last pass found nothing to work over, which want no wake until the instance's next start. */
  #daily = null; #dailyIdle = new Set(); #zone;
  /* R9: the daily consumers an owner's notice asked a pass of, at the next firing, whatever day they last ran. */
  #dailyPoked = new Set();
  /* scheduled-publish: the set time of an edition still waiting after a tick at or past it (see the consumer). */
  #publishHeld = null;
  /* true while scheduled-publish ticks: a take's notice then leaves the arming to onAlarm's own reconcile (R1). */
  #publishTicking = false;
  /* The refused registrations of listenTo, each a start-up fault (R23). */
  #faults = [];
  /* true while onAlarm runs: an `onFileWork` call made inside a batch leaves the arming to its reconcile (R1, R24). */
  #firing = false;
  #healedAt = -Infinity;
  #beat = null;
  /* R27: the registered consumers held, by name, at the wake that did not advance (see `#holding`). */
  #held = new Map();
  /* G70: the instant this instance last set the alarm for (null once deleted, undefined before any), so the next firing can say what it was scheduled for;
     the heartbeat's `next_set_for` answers it after a restart, when the alarm is no longer readable (the platform clears it while the handler runs). */
  #alarmFor;
  /* R30: the firing's budget and the threshold past which a consumer's call is logged before it ends (injected by tests). */
  #budgetMs; #slowMs;
  /* R30: the instant the running firing can no longer outlast (its start, its budget and the grace). */
  #firingEnds = 0;
  /* R31: the consumers whose call outlasted a firing's budget, by name: `{started, settled, result, error, ended}`. A call
     is a promise of this isolate, so a restart empties the set (the call died with the isolate; R33). */
  #inflight = new Map();

  /** `storage` is the Durable Object's storage (its alarm, and the probe seam's and the daily consumers' values);
   *  `owners` answers each consumer's owner (`retrieval`, `monitoring`, `connections`, `progressions`, `aiRuns`,
   *  `captureRequests`, `calibration`, `bias`, `intent`, `reevaluation`, `networkNotices`, `linkSweep`, `following`,
   *  `duties`, `people`, `moneyChecks`, `answers`, `inquiry`, `publishSchedule`, `fileSafety`, `caseCarriage`,
   *  `questionExplorer`), each a function returning the owner, so an
   *  owner is reached only when the registry is built; `zone()` answers the group's time zone or null (R21's local day). */
  constructor({ storage, env = null, owners = {}, zone = null, budgetMs = FIRING_BUDGET_MS, slowMs = SLOW_CONSUMER_MS } = {}) {
    this.#budgetMs = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : FIRING_BUDGET_MS;
    this.#slowMs = Number.isFinite(slowMs) && slowMs > 0 ? slowMs : SLOW_CONSUMER_MS;
    this.#storage = storage;
    this.#env = env || {};
    this.#owners = { ...owners };
    this.#zone = typeof zone === "function" ? zone : () => null;
  }

  #day(now) { let z = null; try { z = this.#zone(); } catch { z = null; } return localDayOf(now, z); }
  #dailyOwned() { return DAILY_OWNER.some(([, o]) => this.#owners[o]); }
  /* The daily consumers' state, read once per instance before a firing, an arm or the start reads a due or a wake. */
  async #loadDaily() {
    if (this.#daily || !this.#dailyOwned()) return;
    let v = null;
    try { v = typeof this.#storage.get === "function" ? await this.#storage.get(DAILY_KEY) : null; } catch { v = null; }
    this.#daily = v && typeof v === "object" ? v : {};
  }

  /* R21: a consumer whose owner states no due or wake. `run(now, cursor)` calls the owner and answers its answer;
     `read(answer)` answers `{more, cursor, nothing}`: whether the pass is under way, where it resumes, and whether it
     found nothing at all to work over. Due at the local day's start until a pass finishes that day; due at every
     firing while one is under way; a pass that throws or is refused counts the day as run, so it never spins (R3). */
  #dailyConsumer(name, key, run, read) {
    const st = () => (this.#daily && this.#daily[name]) || {};
    const want = (now, today) => {
      const s = st();
      if (s.more || this.#dailyPoked.has(name)) return now;
      if (this.#dailyIdle.has(name)) return null;
      return s.day === today.date ? null : today.start;
    };
    return {
      due: (now) => want(now, this.#day(now)),
      wake: (now) => { const today = this.#day(now); const w = want(now, today); return w !== null || this.#dailyIdle.has(name) ? w : today.next; },
      tick: async (now) => {
        const today = this.#day(now), s = st();
        this.#dailyPoked.delete(name);
        const settle = (v) => { this.#daily = { ...(this.#daily || {}), [name]: v }; };
        let r;
        try { r = await run(now, s.more ? s.cursor ?? null : null); }
        catch (e) { settle({ day: today.date, cursor: null, more: false }); throw e; }
        const ok = !(r && r.ok === false);
        const { more = false, cursor = null, nothing = false } = ok ? read(r || {}) : {};
        settle(more ? { day: s.day ?? null, cursor, more: true } : { day: today.date, cursor: null, more: false });
        if (!more && nothing) this.#dailyIdle.add(name); else this.#dailyIdle.delete(name);
        return { [key]: { ...(r && typeof r === "object" ? r : { answer: r }), local_day: { date: today.date, zone: today.zone } } };
      } };
  }

  #owner(name) { const f = this.#owners[name]; return typeof f === "function" ? f() : null; }

  /* R24: the five consumers over `file-safety`, each its due and wake R39's answer for its batch at `now`, asked afresh
     every time, so nothing is kept here (R7, R18). An answer that is not an instant in ms is none. A refusal is the
     tick's answer, and the next wake is again R39's. */
  #fileSafety() {
    const o = () => this.#owner("fileSafety");
    const at = (now) => new Date(now).toISOString();
    const ms = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const consumer = (key, wake, run) => ({
      due: (now) => ms(o()[wake](now)), wake: (now) => ms(o()[wake](now)),
      tick: async (now) => ({ [key]: await run(now) }) });
    return {
      "file-scan": consumer("filescan", "scanWake", (now) => o().scanBatch({ at: at(now) })),                      /* its R4 */
      "file-render": consumer("filerender", "renderWake", () => o().renderBatch({})),                             /* its R12 */
      "file-deeper": consumer("filedeeper", "deeperWake", () => o().deeperBatch({})),                             /* its R36 */
      "file-forward": consumer("fileforward", "forwardWake", () => o().forwardSecurityCounts({})),                /* its R35: its own period */
      "file-reputation": consumer("filereputation", "reputationWake", (now) => o().refreshReputationLists({ at: at(now) })),   /* its R41 */
    };
  }

  /* ---- R5, R6: this module's own consumers, each calling its owner's services ---- */
  #own() {
    const o = (n) => this.#owner(n);
    const due = (n) => n > 0;
    /* An owner's due answered as an instant, or as `true` for "now". */
    const instant = (v, now) => (v === true ? now : typeof v === "number" && Number.isFinite(v) ? v : null);
    const c = {};
    if (this.#owners.monitoring) {
      c["archive-monitor"] = {   /* monitoring R20 */
        due: (now) => instant(o("monitoring").archiveDue(now), now), wake: (now) => o("monitoring").archiveWake(now),
        tick: async (now, rank) => ({ monitor: await o("monitoring").archiveTick(now, rank) }) };
      c["monitor-cadence"] = {   /* monitoring R19 */
        due: (now) => instant(o("monitoring").cadenceDue(now), now), wake: (now) => o("monitoring").cadenceWake(now),
        tick: async (now, rank) => ({ monitorcadence: await o("monitoring").cadenceTick(now, rank) }) };
      /* monitoring R34, R35, its due and wake R50. An entry R34 cannot mark stays `pending`, so R50's wake stays in
         the past and every reconcile would find it due again at once: the alarm would spin. So when a tick marks
         nothing, a wake at or before that tick is held to the start of the next UTC day, R50's own granularity (the
         first alarm of a day), never an interval of this module's (R7); a tick that marks something releases it. */
      const held = (w) => {
        if (w === null || w === undefined || !Number.isFinite(w)) return null;
        const idle = this.#deadlineIdleAt;
        return idle !== null && w <= idle ? Math.floor(idle / DAY_MS) * DAY_MS + DAY_MS : w;
      };
      c["deadline-recheck"] = {
        due: (now) => { const d = held(instant(o("monitoring").deadlineRecheckDue(now), now)); return d !== null && d <= now ? d : null; },
        wake: (now) => held(o("monitoring").deadlineRecheckWake(now)),
        tick: async (now) => {
          this.#deadlineIdleAt = now;
          const r = await o("monitoring").deadlineRecheck(now);
          if (r && r.ok !== false && Array.isArray(r.marked) && r.marked.length) this.#deadlineIdleAt = null;
          return { deadlinerecheck: r };
        } };
    }
    if (this.#owners.linkSweep) c["gathering-sweep"] = {   /* link-sweep R4: the ratified sweeps, batch-bounded, given the rank (R10) */
      due: (now) => instant(o("linkSweep").sweepDue(now), now), wake: (now) => o("linkSweep").sweepWake(now),
      tick: async (now, rank) => ({ gatheringsweep: await o("linkSweep").sweepTick(now, rank) }) };
    if (this.#owners.retrieval) c["selection-sweep"] = {   /* retrieval R22, its wake R51 */
      due: (now) => now, wake: (now) => o("retrieval").sweepWake(now),
      tick: () => ({ swept: o("retrieval").sweepSelections() }) };
    if (this.#owners.connections) c["connection-derive"] = {   /* connections R18 */
      due: (now) => now, wake: (now) => o("connections").wake(now),
      tick: () => ({ connderive: o("connections").sweep() }) };
    if (this.#owners.progressions) c["overdue-scan"] = {   /* progressions R17 */
      due: (now) => now, wake: (now) => o("progressions").overdueScan(now).next_deadline,
      tick: (now) => ({ overduescan: o("progressions").overdueScan(now) }) };
    if (this.#owners.aiRuns) {
      c["ai-run-reap"] = {   /* ai-runs R15 */
        due: (now) => (due(o("aiRuns").reapDue(now)) ? now : null), wake: (now) => o("aiRuns").reapWake(now),
        tick: (now) => ({ airunreap: o("aiRuns").reap(now) }) };
      c["ai-run-wake"] = {   /* ai-runs R16, R17, R41 */
        due: (now) => (due(o("aiRuns").wakeDue(now)) ? now : null), wake: (now) => o("aiRuns").wakeWake(now),
        tick: async (now) => ({ airunwake: await o("aiRuns").wake(now) }) };
    }
    if (this.#owners.captureRequests) c["capture-request-drain"] = {   /* capture-requests R11, its due and wake R37 */
      due: (now) => (due(o("captureRequests").drainPending()) ? now : null),
      wake: (now) => (due(o("captureRequests").drainPending()) ? now + o("captureRequests").drainIntervalMs() : null),
      tick: async (now, rank) => ({ capturerequests: await o("captureRequests").drain({ actor: "alarm", now, rank }) }) };
    if (this.#owners.calibration) c["calibration-reprobe"] = {   /* calibration R9, given the grace (K74) */
      due: (now) => (due(o("calibration").calibrationDue(now)) ? now : null),
      wake: (now) => o("calibration").calibrationWake(now, SCHED_GRACE_MS),
      tick: (now) => ({ calibration: o("calibration").calibrationTick(now) }) };
    if (this.#owners.bias) c["bias-debt"] = {   /* bias R33, its due and wake R41 */
      due: (now) => o("bias").biasDebtDue(now), wake: (now) => o("bias").biasDebtWake(now),
      tick: async (now, rank) => ({ biasdebt: await o("bias").biasDebtSweep(now, rank) }) };
    if (this.#owners.intent) c["intent-age"] = {   /* intent R17, its due and wake R27 */
      due: (now) => o("intent").ageDue(now), wake: (now) => o("intent").ageWake(now),
      tick: async (now) => ({ intentage: await o("intent").ageSurfaced(now) }) };
    if (this.#owners.reevaluation) c["notice-sweep"] = {   /* reevaluation R25 */
      due: (now) => o("reevaluation").noticeSweepDue(now), wake: (now) => o("reevaluation").noticeSweepWake(now),
      tick: (now) => ({ noticesweep: o("reevaluation").noticeSweep(now) }) };
    /* R22: publish-schedule R2's waiting editions, each taken at the first firing at or after its set time (R2 takes only at
       or before `now`, so a firing inside the grace before it takes nothing and the reconcile re-arms at the time).
       Its `publishDue` awaits each answer of ratification's publisher, so the tick awaits it (R1). An edition still
       waiting after a tick at or past its time (a take that failed, or one another firing holds) would keep the wake
       in the past and the alarm firing at once, again and again: so that time is held, wanting no wake, until
       publish-schedule's next notice (its R6: every take, set, move and cancel tells it) or the instance's next start (R11),
       never retried on an interval of this module's (R7). */
    if (this.#owners.publishSchedule) {
      const wake = () => { const w = msOf(o("publishSchedule").publishWake()); return w !== null && this.#publishHeld !== null && w <= this.#publishHeld ? null : w; };
      c["scheduled-publish"] = {
        due: () => wake(), wake: () => wake(),
        tick: async (now) => {
          this.#publishTicking = true;
          try { return { scheduledpublish: await o("publishSchedule").publishDue(new Date(now).toISOString()) }; }
          finally {
            this.#publishTicking = false;
            let w = null;
            try { w = msOf(o("publishSchedule").publishWake()); } catch { w = null; }
            this.#publishHeld = w !== null && w <= now ? w : null;
          }
        } };
    }
    if (this.#owners.networkNotices) {
      c["working-on-seal"] = {   /* network-notices R14, R15: the weekly seal */
        due: (now) => instant(o("networkNotices").sealDue(now), now), wake: (now) => o("networkNotices").sealWake(now),
        tick: async (now) => ({ workingonseal: await o("networkNotices").sealTick(now) }) };
      c["working-on-attest"] = {   /* network-notices R12, R17: the monthly, closed and lapsed attestations, the retried openings */
        due: (now) => instant(o("networkNotices").attestDue(now), now), wake: (now) => o("networkNotices").attestWake(now),
        tick: async (now) => ({ workingonattest: await o("networkNotices").attestTick(now) }) };
    }
    /* ---- R21: the consumers of T33's new work ---- */
    /* An owner's due as an instant: `true` is now, an instant (ms or text) is itself, anything else none. */
    const dueOf = (v, now) => (v === true ? now : msOf(v));
    /* answers R17's due is how many questions are due: any is now. */
    const counted = (v, now) => (typeof v === "number" && v > 0 ? now : null);
    if (this.#owners.following) c["follow"] = {   /* following R12, R13: batch-bounded, given the rank (R10) */
      due: (now) => dueOf(o("following").followDue(now), now), wake: (now) => msOf(o("following").followWake(now)),
      tick: async (now, rank) => ({ follow: await o("following").followTick(now, rank) }) };
    if (this.#owners.duties) c["duty-transitions"] = this.#dailyConsumer("duty-transitions", "dutytransitions",   /* duties R13 */
      (now, cursor) => o("duties").recordTransitions({ asOf: instantText(now), ...(cursor ? { cursor } : {}) }),
      (r) => ({ more: r.done === false, cursor: r.cursor ?? null, nothing: r.duties_read === 0 }));
    if (this.#owners.people) c["interest-checks"] = this.#dailyConsumer("interest-checks", "interestchecks",   /* people R23 */
      () => o("people").evaluateChecks({}),   /* people holds its own cursor */
      (r) => ({ more: r.remaining === true, cursor: null, nothing: r.evaluated === 0 }));
    if (this.#owners.moneyChecks) c["money-detectors"] = this.#dailyConsumer("money-detectors", "moneydetectors",   /* money-checks R6 */
      (now, cursor) => o("moneyChecks").runDetectors({ budgetMs: DETECTORS_BUDGET_MS, cursor }),
      (r) => ({ more: r.remaining === true || !!r.cursor, cursor: r.cursor ?? null, nothing: r.detectors === 0 }));
    /* answers R17 and inquiry R57 read `now` as instant text and answer wakes as instant text. A consumer due now
       wants now, whatever its owner's wake says of later days. */
    if (this.#owners.answers) c["standing-questions"] = {
      due: (now) => counted(o("answers").standingDue(instantText(now)), now),
      wake: (now) => (counted(o("answers").standingDue(instantText(now)), now) !== null ? now : msOf(o("answers").standingWake(instantText(now)))),
      tick: async (now) => ({ standingquestions: await o("answers").standingTick(instantText(now)) }) };
    if (this.#owners.inquiry) c["dated-waits"] = {
      due: (now) => (o("inquiry").datedWaitsDue(instantText(now)) === true ? now : null),
      wake: (now) => (o("inquiry").datedWaitsDue(instantText(now)) === true ? now : msOf(o("inquiry").datedWaitsWake(instantText(now)))),
      tick: async (now) => ({ datedwaits: await o("inquiry").datedWaitsTick(instantText(now)) }) };
    if (this.#owners.fileSafety) Object.assign(c, this.#fileSafety());   /* R24 */
    /* R25: case-carriage R15's member documents' copies; its due and wake `copyWake(now)`, asked afresh every time (an
       instant in ms, or null), so a restarted instance re-derives them from its tables; a refusal is the tick's answer. */
    if (this.#owners.caseCarriage) {
      const ms = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      c["document-copy"] = {
        due: (now) => ms(o("caseCarriage").copyWake(now)), wake: (now) => ms(o("caseCarriage").copyWake(now)),
        tick: async () => ({ doccopy: await o("caseCarriage").copyBatch({}) }) };
    }
    /* R26 (K2568): question-explorer R1. `exploreDue(now)` counts the questions a tick would consider: any is now. Its
       wake is `exploreWake(now)` (now while any is due; else an Ask's re-check, its own instant; else null), asked afresh
       every time, so nothing is kept here (R7, R18). No arming notice: the wake is weighed at every firing, arm and start. */
    if (this.#owners.questionExplorer) c["question-explore"] = {
      due: async (now) => counted(await o("questionExplorer").exploreDue(now), now),
      wake: async (now) => msOf(await o("questionExplorer").exploreWake(now)),
      tick: async (now) => ({ explore: await o("questionExplorer").exploreTick(now) }) };
    /* ---- T53 (R34, R35) ---- */
    /* R34: registers R12's import slices, one a firing, under monitoring's sweep host (its pause, epoch and claim, monitoring
       R65), handed in so registers reaches no later module. Due while an import is queued or under way and due (registers'
       `importDue`, false while the host is paused); its wake `importWake`, asked afresh each time, none while the host is
       paused so a paused instance holds no alarm firing at once (R15). The slice bound is registers' (R7): no budget is passed. */
    if (this.#owners.registers) {
      const host = () => { const m = this.#owners.monitoring ? o("monitoring") : null; return m && typeof m.sweepHost === "function" ? m.sweepHost() : null; };
      const paused = (h) => !!(h && typeof h.paused === "function" && h.paused()?.paused);
      c["register-import"] = {
        due: (now) => (o("registers").importDue(now, host()) ? now : null),
        wake: (now) => { const h = host(); return paused(h) ? null : msOf(o("registers").importWake(now)); },
        tick: async (now) => ({ registerfileimport: await o("registers").importTick(now, undefined, host()) }) };
    }
    /* R35: doorbell R30's discarded knocks, cleared a week after receipt. Its due and wake are `discardClearDue`/`discardClearWake`
       (an instant), asked afresh; while the doorbell may not clear (`mayClearDiscarded`: no litigation-hold reader, or a hold)
       its owner is off for this consumer and it wants nothing, so a held knock never keeps the alarm firing (R15). */
    if (this.#owners.doorbell) {
      const may = () => { const d = o("doorbell"); return typeof d.mayClearDiscarded !== "function" || d.mayClearDiscarded().may === true; };
      const at = (now) => (may() ? msOf(o("doorbell").discardClearWake(now)) : null);
      c["discard-clear"] = {
        due: (now) => (may() ? msOf(o("doorbell").discardClearDue(now)) : null), wake: at,
        tick: async (now) => ({ discardclear: await o("doorbell").clearDiscarded({ now }) }) };
    }
    /* R35: mail-door R6's waiting mail, removed 14 days after receipt; its answer names each owner (R15 keeps the counts for
       notice-producers). Due now while `mailClearDue(now)` says one is due, its wake `mailClearWake(now)`. */
    if (this.#owners.mailDoor) c["mail-clear"] = {
      due: (now) => (o("mailDoor").mailClearDue(now) === true ? now : null),
      wake: (now) => (o("mailDoor").mailClearDue(now) === true ? now : msOf(o("mailDoor").mailClearWake(now))),
      tick: async (now) => ({ mailclear: await o("mailDoor").clearWaitingMail({ now }) }) };
    /* G55 (R7, R24): calculations R14's background ingest. Due while a record is `ingesting` (`ingestDue`), its wake
       `ingestWake`, both asked afresh every time from calculations' own tables, so a restarted instance re-derives them
       (R11) and nothing is kept here (R7, R18). A tick that fails is calculations' to count: after its third failed
       attempt the record is stopped and neither due nor wake is any more, so the consumer never spins (R3). An owner
       that does not offer the services wants nothing. */
    if (this.#owners.calculations) {
      const ask = (m, now) => { const k = o("calculations"); return k && typeof k[m] === "function" ? k[m](now) : null; };
      c["ingest"] = {
        due: (now) => dueOf(ask("ingestDue", now), now), wake: (now) => msOf(ask("ingestWake", now)),
        tick: async (now) => ({ ingest: await o("calculations").ingestTick(now) }) };
    }
    return c;
  }

  /* ---- R8 ---- */

  /** A later module registers each of its consumers once, at start. A name already held (registered, or one of this
   *  module's own) is refused `CONSUMER_DECLARED`; a consumer that is not `{name, key, due, wake, tick}` with a key
   *  outside the answer's own fields is refused `CONSUMER_MALFORMED`. Never throws. */
  register(module, consumer) {
    const c = consumer && typeof consumer === "object" ? consumer : null;
    if (typeof module !== "string" || !module || !c || typeof c.name !== "string" || !c.name
        || typeof c.due !== "function" || typeof c.wake !== "function" || typeof c.tick !== "function")
      return { ok: false, reason: "CONSUMER_MALFORMED", module: typeof module === "string" ? module : null,
               name: c && typeof c.name === "string" ? c.name : null };
    const key = typeof c.key === "string" && c.key ? c.key : (SCHEDULER_KEYS[c.name] || c.name);
    if (this.#registered.has(c.name) || this.#own()[c.name])
      return { ok: false, reason: "CONSUMER_DECLARED", module, name: c.name };
    if (ANSWER_FIELDS.has(key) || this.registry(null).some((r) => r.key === key))
      return { ok: false, reason: "CONSUMER_MALFORMED", module, name: c.name,
               detail: localize("scheduler.index.the_key_key_is_one", "the key '{key}' is one of the answer's own fields or another consumer's", { key: String(key) }) };
    this.#registered.set(c.name, this.#holding({ name: c.name, key, module, due: c.due, wake: c.wake, tick: c.tick }));
    this.#registeredOrder.push(c.name);
    return { ok: true, module, name: c.name, key, placed: SCHEDULER_ORDER.includes(c.name) ? "R5" : "appended" };
  }

  /* R27: a registered consumer whose `wake`, read after its tick, equals the `wake` read before it and is at or before
     the firing's `now` is held: its due and wake read as none, so it cannot keep the alarm firing at once, again and
     again. It is not held by a tick that answers rows ended (G35). It is released when its own `wake` changes, at an `arm` made outside a firing and at a start. The due, wake
     and tick of a consumer may answer a promise; each is awaited before its answer is read. Nothing is written, and no
     interval of this module's is added (R7). */
  #holding(c) {
    /* G35: a tick that answers rows ended (`finished` or `final` above zero, under the consumer's key or at the top) made progress: the wake it
       leaves is another row's own, equal to the one before when several rows share an instant, and holding it would strand those rows. */
    const endedWork = (r, key) => {
      const a = r && typeof r === "object" ? (r[key] && typeof r[key] === "object" ? r[key] : r) : null;
      return !!a && [a.finished, a.final].some((n) => typeof n === "number" && n > 0);
    };
    const held = this.#held, name = c.name;
    const wakeOf = async (now) => { try { return await c.wake(now); } catch { return null; } };
    /* the consumer's wake while it is held at that wake; none then, and released when its wake has changed */
    const heldWake = (w) => {
      if (!held.has(name)) return w;
      if (w === held.get(name)) return null;
      held.delete(name);
      return w;
    };
    return { ...c,
      due: async (now) => {
        if (held.has(name) && heldWake(await c.wake(now)) === null) return null;
        return await c.due(now);
      },
      wake: async (now) => heldWake(await c.wake(now)),
      tick: async (now, rank, started) => {
        const before = await wakeOf(now);
        const note = async (ended) => {
          const after = await wakeOf(now);
          if (!ended && Number.isFinite(before) && after === before && after <= now) held.set(name, after); else held.delete(name);
        };
        let r;
        try { r = await c.tick(now, rank, started); } catch (e) { await note(false); throw e; }
        await note(endedWork(r, c.key));
        return r;
      } };
  }

  /** The registry, in R5's order, then the registered consumers R5 does not name in the order they registered (the
   *  host registers the modules in their total order), then the test probes (R13). */
  registry(probe = null) {
    const own = this.#own();
    const reg = [];
    for (const name of SCHEDULER_ORDER) {
      const c = own[name] ? { name, key: SCHEDULER_KEYS[name], module: "scheduler", ...own[name] } : this.#registered.get(name);
      if (c) reg.push(c);
    }
    for (const name of this.#registeredOrder) if (!SCHEDULER_ORDER.includes(name)) reg.push(this.#registered.get(name));
    for (const name of Object.keys(probe || {})) {
      if (reg.some((c) => c.name === name)) continue;
      const st = probe[name];
      reg.push({ name, key: name, probe: true,
        due: () => (st.remaining > 0 ? st.next : null),
        wake: () => (st.remaining > 0 ? st.next : null),
        tick: (now) => { st.fires.push(now); st.remaining -= 1;
                         st.next = st.remaining > 0 ? st.next + st.period : null; return { probe: name }; } });
    }
    return reg;
  }

  /** The names of the consumers in the registry as it stands, in order (the probes excluded). */
  consumers() { return this.registry(null).map((c) => c.name); }

  /* ---- R10 ---- */

  /** The rank a batch-bounded tick receives: `rank(items, now?)` orders its due work by what intent's `servesOf`
   *  answers each item serves (`rankBy`). */
  rank(items, now = Date.now()) {
    const intent = this.#owners.intent ? this.#owner("intent") : null;
    return rankBy(intent && typeof intent.servesOf === "function" ? (named) => intent.servesOf(named) : null, items, now);
  }

  /* ---- R1–R3 ---- */

  /** The runtime's `alarm()` is `onAlarm(Date.now())`. */
  async alarm() { return await this.onAlarm(); }

  async onAlarm(now = Date.now()) {
    const t0 = Date.now();   /* R30: the budget is the real clock's, whatever instant the runtime hands in */
    /* R1, R30 (G91, K4912): the firing is marked running first, so an `arm` a request path makes while it runs (where `getAlarm()`
       answers none) is told apart (`#reconcile`); the reconcile at the end sets the next alarm outright. */
    this.#firing = true;
    this.#firingEnds = t0 + this.#budgetMs + SCHED_GRACE_MS;
    let probe, before, scheduledFor, previousEnd, reg;
    const answers = {};
    const probes = [];
    let stoppedAt = null, slowest = null;
    try {
    this.#beat = null;   /* R33: the heartbeat is read from storage at the start of every run, never trusted from memory */
    probe = await this.#probeState(now, true);
    before = await this.#beatRead();
    scheduledFor = this.#alarmFor !== undefined ? this.#alarmFor : before.next_set_for ?? null;   /* G70 */
    previousEnd = Number.isFinite(before.ended) ? before.ended : null;
    await this.#beatWrite({ running_since: now, inflight: this.#inflightRecord() });   /* R29: getAlarm() is null while this runs; R33: a cut run's in-flight calls died with it */
    await this.#loadDaily();
    const full = this.registry(probe);
    /* R30: the firing begins at the consumer the last budget-limited firing stopped before, wrapping, so none is always last */
    const from = typeof before.rotate_from === "string" ? full.findIndex((c) => c.name === before.rotate_from) : -1;
    reg = from > 0 ? [...full.slice(from), ...full.slice(0, from)] : full;
    const rank = (items, at = now) => this.rank(items, at);
    const took = (c, v) => { if (v !== null && v !== undefined) answers[c.key] = v; };
    for (let i = 0; i < reg.length; i++) {
      const c = reg[i];
      if (i > 0 && Date.now() - t0 >= this.#budgetMs) { stoppedAt = c.name; break; }   /* R30: the budget is spent */
      const fl = this.#inflight.get(c.name);   /* R31: a call that outlasted an earlier budget */
      if (fl) {
        if (!fl.settled) continue;   /* still running: neither asked nor started again */
        this.#inflight.delete(c.name);
        if (fl.error !== undefined) answers[c.key] = { error: message(fl.error) }; else took(c, this.#valueOf(c, fl.result));
      }
      let d;
      try { d = await c.due(now); } catch (e) { answers[c.key] = { error: message(e) }; continue; }
      if (d === null || d === undefined || d > now + SCHED_GRACE_MS) continue;
      /* Awaited, so an asynchronous consumer's work completes inside the alarm, for as much of the budget as is left. */
      const call = this.#call(c, now, RANKED.includes(c.name) ? rank : undefined);
      const left = Math.max(0, this.#budgetMs - (Date.now() - t0));
      let timer;
      const out = await Promise.race([call.done, new Promise((res) => { timer = setTimeout(() => res(null), left); })]);
      clearTimeout(timer);
      if (out === null) {   /* R31: not abandoned and not started twice; the firing starts no further consumer */
        this.#inflight.set(c.name, call.entry);
        call.entry.late = true;
        stoppedAt = reg[(i + 1) % reg.length].name;
        const ms = Math.max(0, Date.now() - call.entry.started);
        if (!slowest || ms > slowest.ms) slowest = { name: c.name, ms };
        break;
      }
      const ms = Math.max(0, out.ended - out.started);
      if (!slowest || ms > slowest.ms) slowest = { name: c.name, ms };
      if (out.error !== undefined) { answers[c.key] = { error: message(out.error) }; continue; }
      if (c.probe) { probes.push(c.name); continue; }
      took(c, this.#valueOf(c, out.result));
    }
    } finally { this.#firing = false; }
    try {
    /* Reconciled over the FULL registry, not only the consumers that ticked, and authoritatively: a fired alarm is
       spent, so the fresh earliest wake is set outright (R1, R16). */
    const nextAt = await this.#reconcile(now, reg, true, answers);
    /* G70 (K4428): what the walker saw as 28-64 s between ticks, said by the platform's own firing: when the alarm was
       scheduled for, when this firing started and ended, what it set next, and the gap since the previous firing ended.
       Kept in the heartbeat (one put, as before) and as one structured line. No pace is changed: this only records. */
    const ended = Math.max(Date.now(), now);
    const alarm = { scheduled_for: scheduledFor, started: now, ended, next_set_for: nextAt, gap_ms: previousEnd === null ? null : now - previousEnd };
    await this.#beatWrite({ last_run: now, running_since: null, ...alarm, rotate_from: stoppedAt, inflight: this.#inflightRecord(), slowest });   /* R28, R30 */
    try { console.log(JSON.stringify({ scheduler_alarm: alarm })); } catch { /* logged where it can be */ }
    if (probe) await this.#storage.put(PROBE_KEY, probe);
    if (this.#daily && DAILY.some((n) => reg.some((c) => c.name === n)) && typeof this.#storage.put === "function") {
      /* a storage that cannot hold the value keeps it for this instance alone; the firing still answers */
      try { await this.#storage.put(DAILY_KEY, this.#daily); } catch { /* kept in memory */ }
    }
    /* R2: the drain's counts (zero when it did not tick); a drain that threw is answered under its key (R3). */
    const { swept = 0, drain = null, ...rest } = answers;
    const d = drain && !drain.error ? { ...DRAIN_ZERO, ...drain } : DRAIN_ZERO;
    const count = (x) => (Array.isArray(x) ? x.length : Number(x) || 0);
    return { swept, drained: d.drained, created: count(d.created), folded: count(d.folded), refused: count(d.refused),
             waiting: count(d.waiting), remaining: d.remaining, rearmed: nextAt !== null, nextAt, probes,
             ...(drain && drain.error ? { drain } : {}), ...rest };
    } finally { await this.#beatWrite({ running_since: null }); }   /* R29: a run that ends, however it ends, is no longer running */
  }

  /* R30: the value a consumer's answer holds under its key (the answer itself when it names no key). */
  #valueOf(c, r) { return r && typeof r === "object" && c.key in r ? r[c.key] : r; }

  /* R31: whether the consumer's earlier call is still running. */
  #running(c) { const f = this.#inflight.get(c.name); return !!f && !f.settled; }

  /* R31: `{name: started}` of the calls still running past an earlier firing's budget. */
  #inflightRecord() { return Object.fromEntries([...this.#inflight].filter(([, f]) => !f.settled).map(([n, f]) => [n, f.started])); }

  /* R30, R32: one consumer's call. It is told the instant its own work began, and is recorded as one structured line
     `{"scheduler_consumer": {name, started, ended, outcome}}`: written when the call runs past the slow threshold (outcome
     "running", before it ends) and when it ends. `done` resolves, never rejects, with the entry; a call that outlasts the
     firing's budget goes on in the in-flight set (R31), and on settling arms the alarm so its consumer's next wake is weighed. */
  #call(c, now, rank) {
    const started = Math.max(Date.now(), now);
    const entry = { started, settled: false, late: false, ended: null };
    const line = (ended, outcome) => { try { console.log(JSON.stringify({ scheduler_consumer: { name: c.name, started, ended, outcome } })); } catch { /* logged where it can be */ } };
    const slow = setTimeout(() => line(null, "running"), this.#slowMs);
    const end = (patch) => {
      clearTimeout(slow);
      Object.assign(entry, patch, { settled: true, ended: Math.max(Date.now(), started) });
      line(entry.ended, entry.error !== undefined ? "error" : "ok");
      if (entry.late) this.arm().catch(() => null);
      return entry;
    };
    const done = (async () => c.tick(now, rank, started))().then((result) => end({ result }), (error) => end({ error: error === undefined ? new Error("rejected") : error }));
    return { entry, done };
  }

  /* ---- R28, R29: the heartbeat ---- */

  /** The heartbeat as stored: `{last_run, running_since, watchdog_seen}`, each an epoch-millisecond instant or null. */
  async #beatRead() {
    if (!this.#beat) {
      let v; try { v = await this.#storage.get(BEAT_KEY); } catch { v = null; }
      this.#beat = { last_run: null, running_since: null, watchdog_seen: null, ...(v && typeof v === "object" ? v : {}) };
    }
    return this.#beat;
  }
  /** Merges `patch` into the heartbeat and stores it (one put); a storage that cannot hold it keeps it in memory. */
  async #beatWrite(patch) {
    const b = { ...(await this.#beatRead()), ...patch };
    this.#beat = b;
    try { await this.#storage.put(BEAT_KEY, b); } catch { /* kept in memory */ }
  }

  /** Sets the one alarm to the earliest wake any consumer wants, or deletes it when none does. `exact` sets it
   *  outright (after a firing); otherwise it is only ever pulled earlier (R4), except that an alarm already past by
   *  more than `SPENT_ALARM_MS` is spent, not armed (the platform stops running one it killed too often), and is set
   *  afresh to `max(want, now)`. A consumer whose wake throws wants nothing and, when `errors` is given, is answered
   *  under its key (R3). */
  async #reconcile(now, reg, exact, errors = null, force = false) {
    /* R1, R30 (G91, K4912): while the handler runs the platform answers no alarm, so an arm made then (a producer's notice on the
       request path) would set a due row's own wake, already past, which the administrator reads for as long as the firing lasts.
       Inside a firing an arm weighs nothing: it leaves the alarm as it stands, or, when there is none, sets the instant the firing
       can no longer outlast (its budget and the grace), readable and ahead. The reconcile the firing makes at its end weighs every
       consumer's wake, the work that arm announced included, and sets the next alarm outright. */
    if (this.#firing && !exact && !force) {
      const at = await this.#storage.getAlarm();
      if (at !== null && at !== undefined) return at;
      const lease = Math.max(this.#firingEnds, Date.now() + SCHED_GRACE_MS);
      await this.#storage.setAlarm(lease);
      return lease;
    }
    const wants = [];
    for (const c of reg) {
      if (this.#running(c)) continue;   /* R31: a call in flight wants no wake; its settling arms the alarm */
      let w;
      try { w = await c.wake(now); } catch (e) { if (errors) errors[c.key] = { error: message(e) }; continue; }
      if (w !== null && w !== undefined && Number.isFinite(w)) wants.push(w);
    }
    if (!wants.length) { await this.#storage.deleteAlarm(); this.#alarmFor = null; return null; }
    const want = Math.min(...wants);
    const set = async (t) => { await this.#storage.setAlarm(t); this.#alarmFor = t; return t; };
    if (exact) return await set(want);
    if (force) return await set(Math.max(want, now));   /* R29 */
    const at = await this.#storage.getAlarm();
    if (at === null || at === undefined || at > want) return await set(want);
    if (!this.#firing && at < now - SPENT_ALARM_MS) return await set(Math.max(want, now));   /* R4, R11 */
    return at;
  }

  /* ---- R4, R11 ---- */

  /** The producers' door: reconciles without firing, never pushing a set alarm later. Runs no tick and writes no
   *  work; answers the alarm as it stands. */
  async arm(now = Date.now(), bringForward = false) {
    if (!this.#firing) this.#held.clear();   /* R27 */
    const probe = await this.#probeState(now, true);
    await this.#loadDaily();
    const at = await this.#reconcile(now, this.registry(probe), false, null, bringForward);
    if (probe) await this.#storage.put(PROBE_KEY, probe);
    return at;
  }

  /** R28, the request paths' door: a cheap check that the alarm is armed. When none is set or the one set is spent
   *  (R4) it arms as `arm` does. When the one set is still ahead it asks each consumer only its wake: one that has
   *  already come (G159, K4980; a row registered behind a daily alarm) brings the alarm to now. Otherwise it asks
   *  nothing of any consumer. At most one look every few seconds per instance. Answers the alarm as it stands, or null.
   *  Runs no tick and writes no work (R17). */
  async heal(now = Date.now()) {
    if (this.#firing || now - this.#healedAt < HEAL_EVERY_MS) return null;
    this.#healedAt = now;
    const at = await this.#storage.getAlarm();
    if (at === null || at === undefined || at < now - SPENT_ALARM_MS) return await this.arm(now);
    if (at <= now || await this.#oldestOverdue(now) === null) return at;
    return await this.arm(now, true);
  }

  /** The earliest wake any consumer has that has already come, or null (read only: each owner answers its own wake). */
  async #oldestOverdue(now) {
    const probe = await this.#probeState(now, false);
    await this.#loadDaily();
    let owed = null;
    for (const c of this.registry(probe)) {
      if (this.#running(c)) continue;   /* R31: work in flight is being done, not owed */
      let w;
      try { w = await c.wake(now); } catch { continue; }
      if (w !== null && w !== undefined && Number.isFinite(w) && w <= now && (owed === null || w < owed)) owed = w;
    }
    return owed;
  }

  /** R28: `{last_run, running_since, watchdog_seen, watchdog_ran, alarm_at, oldest_overdue, stale}`. `last_run` is the
   *  instant of the last firing that completed (null before any); `oldest_overdue` the earliest wake any consumer has that
   *  has already come (null when none is owed). `stale` (G95; K4807 (2), K4811 (5)) is true when work is owed and either the
   *  oldest wake already come is at least `STALE_AFTER_MS` old and no firing has completed in that long (a firing counts as
   *  completed at its end instant, `ended`; one in progress does not reset the clock), or one firing has run that long
   *  (`running_since`). It reads the firing's END, `ended`, not `last_run` (the START instant): a firing that ran for minutes
   *  and ended just now is a firing completed now. Reads only: it re-arms nothing and runs nothing. */
  async health(now = Date.now()) {
    const owed = await this.#oldestOverdue(now);
    const { last_run, running_since, watchdog_seen, watchdog_ran = null, ended = null } = await this.#beatRead();
    const alarm = await this.#storage.getAlarm();
    const done = Number.isFinite(ended) ? ended : last_run;
    const idle = !Number.isFinite(done) || now - done >= STALE_AFTER_MS;
    const stale = owed !== null && ((now - owed >= STALE_AFTER_MS && idle) || (Number.isFinite(running_since) && now - running_since >= STALE_AFTER_MS));
    return { last_run, running_since, watchdog_seen, watchdog_ran, alarm_at: alarm ?? null, oldest_overdue: owed, stale };
  }

  /** R29, the watchdog's one call (the plane's Worker `scheduled`, once a cycle): `watch(at)`, `at` the instant the cron
   *  was scheduled for. It records `watchdog_seen` (never backwards), reads the alarm and the heartbeat, and re-arms, as
   *  `arm` does but outright (the later of the earliest wake and now), only when (a) no alarm is set and no firing is in
   *  progress (`running_since` within a cycle: `getAlarm()` is null while the handler runs), or (b) the alarm is spent
   *  (R4), or (c) work is owed, no firing is in progress, `last_run` is older than two cycles and the alarm is still ahead (one already due is about to run). It runs no tick, reads
   *  no consumer's rows, and is idempotent: with a live alarm and a fresh `last_run` it asks no consumer anything and
   *  sets nothing. Answers what it saw and did: `{alarm_at, last_run, running_since, watchdog_ran, rearmed, why}`. */
  async watch(at, now = Date.now()) {
    const seen = Number.isFinite(at) ? at : now;
    let beat = await this.#beatRead();
    /* G94: `watchdog_seen` is the cron's slot (never backwards); `watchdog_ran` the instant this call ran, from its own clock */
    await this.#beatWrite({ watchdog_ran: now, ...(beat.watchdog_seen >= seen ? {} : { watchdog_seen: seen }) });
    beat = this.#beat;
    const alarm = await this.#storage.getAlarm();
    const running = Number.isFinite(beat.running_since) && now - beat.running_since < RUNNING_BOUND_MS;
    const none = alarm === null || alarm === undefined;
    const fresh = Number.isFinite(beat.last_run) && now - beat.last_run <= 2 * HEALTH_CYCLE_MS;
    let why = null;
    if (none && !running) why = "no_alarm";
    else if (!none && alarm < now - SPENT_ALARM_MS) why = "spent";
    else if (!running && !fresh && alarm > now && (await this.#oldestOverdue(now)) !== null) why = "stale";   /* an alarm at or before now is about to run */
    const out = { alarm_at: none ? null : alarm, last_run: beat.last_run, running_since: beat.running_since, watchdog_ran: now, rearmed: false, why };
    if (why === null) return out;
    this.#held.clear();   /* R27 */
    const probe = await this.#probeState(now, true);
    await this.#loadDaily();
    const at2 = await this.#reconcile(now, this.registry(probe), false, null, true);
    return { ...out, alarm_at: at2, rearmed: at2 !== null };
  }

  /** At the instance's start: reconciles as `arm` does, so an alarm lost to a failed firing or a reset is re-derived
   *  from durable state. It starts no probe that was not already armed. A daily consumer found idle before is asked
   *  again (R21): its owner's work may have grown since. */
  async start(now = Date.now()) {
    const probe = await this.#probeState(now, false);
    this.#dailyIdle.clear();
    this.#publishHeld = null;
    this.#held.clear();   /* R27 */
    await this.#loadDaily();
    /* R33: a `running_since` still set at a start belongs to a run the deploy or restart cut: no firing runs in a new instance */
    if (!this.#firing && Number.isFinite((await this.#beatRead()).running_since)) await this.#beatWrite({ running_since: null });
    return await this.#reconcile(now, this.registry(probe), false);
  }

  /** R24, R26: the owners the plane builds and hands this module after construction (`fileSafety`, which needs the
   *  plane's bindings; `questionExplorer`, whose tables the plane migrates), each an instance or a function answering
   *  it. An owner already held is kept. A `fileSafety` taken is registered with once, through its `onFileWork` (its R40), R9's notice for the five: each call runs `arm` at once
   *  (told after the act commits, record-core's `afterCommit`), except inside a firing, whose own reconcile stands; a
   *  refused or impossible registration is a start-up fault (`faults()`), as R23's. Answers the names taken; the plane
   *  then starts the scheduler (R11), whose reconcile weighs the new consumers. */
  hand(owners = {}) {
    const took = [];
    for (const [name, v] of Object.entries(owners && typeof owners === "object" ? owners : {})) {
      if (v === null || v === undefined || this.#owners[name]) continue;
      this.#owners[name] = typeof v === "function" ? v : () => v;
      took.push(name);
    }
    if (took.includes("fileSafety")) {
      let r;
      try {
        const fs = this.#owner("fileSafety");
        r = fs && typeof fs.onFileWork === "function"
          ? fs.onFileWork("scheduler", () => (this.#firing ? null : this.arm().catch(() => null)))
          : { ok: false, reason: "NOTICE_ABSENT", detail: localize("scheduler.index.the_file_safety_owner_offers_no_onfilework", "the file-safety owner offers no onFileWork") };
      } catch (e) { r = { ok: false, reason: "NOTICE_THREW", detail: message(e) }; }
      this.#fault("fileSafety", r);
    }
    return { ok: true, handed: took };
  }

  /* A notice's registration answered `{ok: false}`: kept as a start-up fault and logged (R23, R24). */
  #fault(notice, r) {
    if (!(r && r.ok === false)) return;
    const fault = { notice, reason: r.reason ?? r.code ?? null, detail: r.detail ?? null };
    this.#faults.push(fault);
    try { console.error(`scheduler: the ${notice} notice refused its registration`, JSON.stringify(fault)); } catch { /* logged where it can be */ }
  }

  /* ---- R13: the test seam, inert unless SCHED_PROBE is set ---- */

  #probeSpecs() {
    try {
      const s = JSON.parse((this.#env && this.#env.SCHED_PROBE) || "[]");
      return Array.isArray(s) ? s.filter((p) => p && typeof p.name === "string" && p.name
        && Number.isFinite(p.period) && p.period > 0 && Number.isFinite(p.fires)) : [];
    } catch { return []; }
  }
  async #probeState(now, create) {
    const specs = this.#probeSpecs();
    if (!specs.length) return null;
    let st = await this.#storage.get(PROBE_KEY);
    if (!st && !create) return null;
    if (!st) {
      st = {};
      for (const s of specs) st[s.name] = { period: s.period, remaining: s.fires, next: now + s.period, fires: [] };
      await this.#storage.put(PROBE_KEY, st);
    }
    return st;
  }
  async probeArm(now = Date.now()) { return await this.arm(now); }
  async probeLog() { return (await this.#storage.get(PROBE_KEY)) || {}; }
  async alarmAt() { return await this.#storage.getAlarm(); }

  /* ---- R9: the earlier producers' notices ---- */

  /** Registers `arm` with each notice an earlier producer offers (K72 (9), K206). Each listener only schedules.
   *  Whether monitoring is configured is asked of the `monitoring` owner when a notice arrives. Answers each
   *  registration's answer by notice; a refused one is also kept as a start-up fault (`faults()`) and logged. */
  listenTo({ retrieval, bias, promotion, capture, progressions, calibration, aiRuns, captureRequests, entities, inquiry, following,
             publishSchedule, answers, duties, people, moneyChecks, caseCarriage, calculations, registers } = {}) {
    const arm = () => this.arm();
    /* A notice its owner tells without awaiting: the arm runs, and a storage that fails it is never an unhandled
       rejection (the act stands, its owner's R27, R71). */
    const told = () => this.arm().catch(() => null);
    /* A notice told inside its owner's transaction, where no storage call may be awaited: the arm is deferred until
       the transaction has returned, once however many notices it told. */
    const deferred = () => {
      let queued = null;
      return () => { queued ||= Promise.resolve().then(() => { queued = null; return arm(); }).catch(() => null); return undefined; };
    };
    const monitoring = (ask) => {
      if (!this.#owners.monitoring) return false;
      try { const m = this.#owner("monitoring"); return !!(m && ask(m)); } catch { return false; }
    };
    const configured = () => monitoring((m) => m.configured());
    /* monitoring R50: an action holding a `pending` clock entry wants the deadline re-check's wake. */
    const clockPending = () => monitoring((m) => m.deadlineRecheckWake(Date.now()) != null);
    /* link-sweep R4: a ratified sweep due or waiting to run wants the gathering sweep's wake. */
    const sweepPending = () => {
      if (!this.#owners.linkSweep) return false;
      try { const l = this.#owner("linkSweep"); return !!(l && l.sweepWake(Date.now()) != null); } catch { return false; }
    };
    const out = {};
    if (retrieval) out.retrieval = retrieval.onSelectionCreated("scheduler", arm);                 /* retrieval R52 */
    if (bias) out.bias = bias.onLensChange("scheduler", () => (bias.biasDebtDue(Date.now()) === null ? null : arm()));   /* bias R23 */
    /* promotion R45: a promotion may leave a bundle monitored, a lens moved, an action holding a `pending` clock entry
       or a sweep ratified or re-ratified; the reconcile weighs monitoring's, the debt's, the re-check's and the
       sweep's own wakes, so the arm is asked whenever any could want one. */
    if (promotion) out.promotion = promotion.onCommitted("scheduler", async () =>
      (configured() || clockPending() || sweepPending() || (bias && bias.biasDebtDue(Date.now()) !== null) ? await arm() : null));
    if (capture) out.capture = capture.on("source-outcome", "scheduler",   /* capture R44 */
      async (o) => (o && o.counted && o.outcome !== "success" && configured() ? await arm() : null));
    if (progressions) out.progressions = progressions.onThreaded("scheduler", () => arm());   /* progressions R33 */
    /* N223: each of these acts creates its consumer's work, so each arms outright; the reconcile reads the owner's
       wake (the re-probe's, the reaper's, the drain's). */
    if (calibration) {
      out.calibrationSubject = calibration.onSubjectRegistered("scheduler", () => arm());   /* calibration R18 */
      out.calibrationSignal = calibration.onSignalRecorded("scheduler", () => arm());       /* calibration R19 */
    }
    if (aiRuns) out.aiRuns = aiRuns.onRunOpened("scheduler", () => arm());                     /* ai-runs R43 */
    if (captureRequests) out.captureRequests = captureRequests.onRequestFiled("scheduler", () => arm());   /* capture-requests R44 */
    /* entities R13: its listeners run inside the resolving transaction, where no storage call may be awaited, so the
       arm is deferred until the transaction has returned, once however many resolutions it inserted or raised; the
       reconcile then reads connections' wake over the entity it marked (connections R17, R18). */
    if (entities) out.entities = entities.onResolved("scheduler", deferred());
    /* inquiry R54 (K1601): a dated wait set or re-dated, told inside the promotion's transaction; the reconcile then
       reads the dated waits' wake (R21). */
    if (inquiry) out.inquiry = inquiry.onWaitSet("scheduler", deferred());
    /* following R19 (K1666): a follow recorded, ended or re-dated, told after the act's transaction; the reconcile reads
       the follow's wake (R21). */
    if (following) out.following = following.onFollowed("scheduler", () => arm());
    /* R22 (publish-schedule R6, K1816): after an edition is set to wait, its time moved or cancelled, or a due one taken;
       the reconcile reads `publishWake` again. A cancel's or a take's call arms nothing new (R4); a take's arrives
       inside this module's own tick, before onAlarm's authoritative reconcile, which stands. */
    if (publishSchedule) out.publishSchedule = publishSchedule.onPublishScheduled("scheduler", () => {
      this.#publishHeld = null;
      return this.#publishTicking ? null : told();
    });
    /* R23 (answers R27): a standing question set or ended re-arms the standing questions' wake at once. */
    if (answers) out.answers = answers.onStandingSet("scheduler", () => told());
    /* R9 (duties R26, people R35, money-checks R16): each told after the act's transaction; the daily consumer it
       concerns is asked for a pass at once, rather than at the next local day, and the alarm armed for it. */
    const poke = (name) => () => { this.#dailyPoked.add(name); this.#dailyIdle.delete(name); return told(); };
    if (duties) out.duties = duties.onDutyTracked("scheduler", poke("duty-transitions"));
    if (people) out.people = people.onChecksChanged("scheduler", poke("interest-checks"));
    if (moneyChecks) out.moneyChecks = moneyChecks.onDetectorSwitchedOn("scheduler", poke("money-detectors"));
    /* R25 (case-carriage R17): a member document queued, told after the act commits; arms at once, except inside a
       firing, whose own reconcile stands (R1). */
    if (caseCarriage) out.caseCarriage = caseCarriage.onCopyWork("scheduler", () => (this.#firing ? null : told()));
    /* G55 (calculations R14): a background ingest started, told after the act commits; arms at once, except inside a firing,
       whose own reconcile stands (R1). An owner that does not offer the notice is not registered with. */
    if (calculations && typeof calculations.onIngestWork === "function")
      out.calculations = calculations.onIngestWork("scheduler", () => (this.#firing ? null : told()));
    /* R34 (registers R11): an import queued (started, a refresh a follow asked for, following R39), told after the act; arms at
       once, except inside a firing, whose own reconcile stands (R1). */
    if (registers && typeof registers.onImportQueued === "function")
      out.registers = registers.onImportQueued("scheduler", () => (this.#firing ? null : told()));
    for (const [notice, r] of Object.entries(out)) this.#fault(notice, r);
    return out;
  }

  /** R23–R25: the registrations listenTo and hand were refused, each `{notice, reason, detail}`: start-up faults, reported, never
   *  ignored. Empty when every notice took its listener. */
  faults() { return this.#faults.map((f) => ({ ...f })); }
}

/* R21: each daily consumer and the owner it calls. */
const DAILY_OWNER = Object.freeze([["duty-transitions", "duties"], ["interest-checks", "people"], ["money-detectors", "moneyChecks"]]);

const instances = new WeakMap();

/** The one scheduler of a Durable Object (K61). `deps.owners` replaces the default owners (a test's); `deps.fileSafety`
 *  (R24) and `deps.questionExplorer` (R26) are handed to the instance, new or already made. question-explorer is never
 *  built here: the plane builds and migrates it, then hands it (its tables exist only once it has migrated them). */
export function schedulerOf(ctx, env = null, deps = {}) {
  let s = instances.get(ctx);
  if (!s) {
    const e = env || {};
    const owners = deps.owners || {
      retrieval: () => retrievalOf(ctx), monitoring: () => monitoringOf(ctx), connections: () => connectionsOf(ctx), progressions: () => progressionsOf(ctx, { env: e }),
      aiRuns: () => aiRunsOf(ctx, e), captureRequests: () => captureRequestsOf(ctx), calibration: () => calibrationOf(ctx),
      bias: () => biasOf(ctx), intent: () => intentOf(ctx), reevaluation: () => reevaluationOf(ctx),
      networkNotices: () => networkNoticesOf(ctx, { env: e }), linkSweep: () => linkSweepOf(ctx),
      duties: () => dutiesOf(ctx), people: () => peopleOf(ctx), moneyChecks: () => moneyChecksOf(ctx),
      answers: () => answersOf(ctx), inquiry: () => inquiryOf(ctx), following: () => followingOf(ctx),
      publishSchedule: () => publishScheduleOf(ctx), caseCarriage: () => caseCarriageOf(ctx), calculations: () => calculationsOf(ctx),
      registers: () => registersOf(ctx), doorbell: () => doorbellOf(ctx), mailDoor: () => mailDoorOf(ctx),
    };
    const zone = deps.zone || (() => viewZone(recordOf(ctx)));
    s = new Scheduler({ storage: deps.storage || ctx.storage, env: e, owners, zone });
    instances.set(ctx, s);
    if (!deps.owners)
      s.listenTo({ retrieval: retrievalOf(ctx), bias: biasOf(ctx), promotion: promotionOf(ctx), capture: captureOf(ctx),
                   progressions: progressionsOf(ctx, { env: e }), calibration: calibrationOf(ctx), aiRuns: aiRunsOf(ctx, e),
                   captureRequests: captureRequestsOf(ctx), entities: entitiesOf(ctx), inquiry: inquiryOf(ctx),
                   following: followingOf(ctx), publishSchedule: publishScheduleOf(ctx), answers: answersOf(ctx),
                   duties: dutiesOf(ctx), people: peopleOf(ctx), moneyChecks: moneyChecksOf(ctx),
                   caseCarriage: caseCarriageOf(ctx), calculations: calculationsOf(ctx), registers: registersOf(ctx) });
  }
  if (deps.fileSafety) s.hand({ fileSafety: deps.fileSafety });
  if (deps.questionExplorer) s.hand({ questionExplorer: deps.questionExplorer });
  return s;
}
