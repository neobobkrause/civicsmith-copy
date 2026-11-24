/* notice-producers — the feed's newer producers (requirements: `build/requirements/notice-producers.md`, R1–R29).
 * A new seam after `queue-producers` with no copy (plan T33-82; Choices 8 and 23): each producer derives, on read and
 * writing nothing, the items one provider's facts earn for a viewer, naming each item's subjects and homes for `queue`
 * to home, offer, mint and publish, exactly as `queue-producers` does for the rest.
 *
 *   noticeItems    queue's one read of this module (R1): every item R2–R6, R12–R17 derive for a member and viewer, each homed
 *                  through queue's walk and carrying queue's options (both passed in), with `facts` stating each
 *                  producer's bound and `truncated`, and `failed`, the providers that threw.
 *
 *   R2  interest-check-noticed   FINDING, people.checkResults            the machine's, "Noticed", hypothesis layer; a hint (R11)
 *   R3  money-detector-noticed   FINDING, money-checks.noticed           the machine's, "Noticed", hypothesis layer; a hint (R11)
 *   R4  standing-answer          FINDING, answers.standingAnswersFor     the assistant's machine work, told once
 *   R5  temporal-expectation-due FINDING, duties.dutiesOf/occurrencesOf  a question, never a violation; keyed per state; `{reason}`
 *                                is duties' member-facing `reason.says`, never `why` (R22, T48);
 *                                none due after following.dutyWatchEndAt's day (T45), unless already told at or
 *                                before the instant that end took hold: then it stays until disposed (R18, T46;
 *                                R21, T47)
 *   R6  inquiry-recheck-due      OBLIGATION (K1505 (15), K1522), inquiry.datedWaits, to the wait's setter alone
 *   R12 security-level-high      FINDING, credentials.securityLevel/securityMap  once per High episode, to administrators
 *   R13 policy-changed-noticed   FINDING, following.policyChanges        a policy's silent change, DEC-145 (5)'s words
 *   R14 scan-found               FINDING, file-safety.scanFindings       a file held after a scan, to who may see it
 *   R15 security-tool-off        FINDING, file-safety.securityToolEvents a tool switched off, to administrators
 *       (R5's, R6's and R13–R15's summary and detail by key from `words.json`, `queue.<kind>[.<state>].summary|detail`,
 *       each item answering its `summary_key`, `detail_key` and `fills`; R12 keeps its plain sentence; R20, T47)
 *   R16 explore-ask              FINDING ("Ask"), ai-use.exploreAsksPending     an account's daily Ask, to its owners
 *       ai-limit-reached         FINDING, ai-use.limitsReached                  a limit reached this period, to its owners
 *       project-account-suspended FINDING, ai-accounts.projectAccountsSuspended   a project's sign-in stopped serving (T48, N996 §5)
 *       (each item's sentence and fills read by key from `words.json`, `words.mjs`; DEC-189 (5), (6); `{date}` by
 *       `date.daymonth|daymonthyear`, `{when}` by `ai.until.*`, DEC-191 (3), DEC-192 (3), (5))
 *   R17 the investigation's items, each told once, keyed by its source's own key (N820; K2418, K2484), each kind's summary
 *       and detail `queue.<kind>.summary|detail` by key (DEC-189 (2)):
 *       question-find            FINDING, question-explorer.findsFor   "Hint · machine work"; `ai.label.explored` to the
 *                                paying account's owners, `ai.label.explored.member` to every other viewer (DEC-189 (7))
 *       step-later-found         FINDING, steps.laterFound
 *       step-date-due, step-reminder  OBLIGATION, steps.stepsDue     to the setter, to the member who asked; none for a
 *                                step whose date an action's clock entry holds (steps R29: stepsDue leaves it out; T45);
 *                                stepsDue's `truncated` carried into `facts.step_due` (R19, T46)
 *       step-cost-shared         FINDING, steps.costShares             to the sharing projects' owners
 *       step-cost-message        FINDING, steps.costMessages           to the owners it was relayed to
 *       milestone-overdue        FINDING, investigation.milestonesOverdue (and milestone-reminder, OBLIGATION)
 *       project-quiet            FINDING, investigation.quietPrompts
 *       review-comment-left-out  FINDING, review.reviewCommentsLeftOut
 *   R24 watched-changed          FINDING, retrieval.browse(only: watched) + following.watchedBy   a watched item changed after the
 *                                watcher's mark, told to her alone, once per change (T50; N1204, DEC-238)
 *   R27 fetch-done              FINDING, capture.fetchesDone           a large capture's fetch delivered, to the member who began it (G2)
 *   R28 ingest-done, ingest-stopped  FINDING, calculations.ingestNotices   a background money ingest finished or stopped, to who ingested (G55)
 *   R29 reading-ended            FINDING, deps.readingsEnded (plane's job table)  a reading that finished, ended in part or was refused, to the member it was made for (G135f)
 *
 * REACHED as `noticeProducersOf(host, deps)` (K1563 (1)): one instance per Durable Object storage. It registers nothing
 * and holds no check row: it refuses nothing. `deps` (each defaults to its module's instance on the same host, reached
 * lazily when first asked): membership, people, moneyChecks, duties, entities (R20's `{office}`, K3144), answers, inquiry, credentials (R12), aiAccounts (R16's suspended sign-ins, T48), following, standards,
 * retrieval (R24's watched items), capture (R27), calculations (R28), fileSafety, provenance, aiUse (R16), steps (with `step`, R17's step work), questionExplorer, investigation, review (R17);
 * and `view`, the jurisdiction view whose time zone R13's to R17's dates are read in (the profile's, when not given; read
 * once a read of `noticeItems`).
 *
 * R7 (queue's homes walk) and R12 (queue's options) stay in queue: `noticeItems` takes them as `homesOf(subjectIds)`
 * and `optionsOf(subjectIds)`, closed over the read's viewer and identity by queue, held for one synchronous read.
 */

import { normalizeType } from "../record-grammar/types.mjs";
import { STATES, vocabFor } from "../record-grammar/document.mjs";
import { MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../record-grammar/actors.mjs";
import { membershipOf, viewerPredicate } from "../membership/index.mjs";
import { overdueOn, dayRange, localDay, localClock } from "../civil-time/index.mjs";
import { combine as combineProfiles, governingZone } from "../../../jurisdictions/index.mjs";
import { peopleOf } from "../people/index.mjs";
import { moneyChecksOf } from "../money-checks/index.mjs";
import { dutiesOf } from "../duties/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { answersOf } from "../answers/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { credentialsOf, SECURITY_THRESHOLD, SECURITY_DAYS } from "../credentials/index.mjs";
import { aiAccountsOf } from "../ai-accounts/index.mjs";
import { followingOf } from "../following/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { standardsOf } from "../standards/index.mjs";
import { fileSafetyOf, findingKind } from "../file-safety/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { calculationsOf } from "../calculations/index.mjs";
import { aiUseOf } from "../ai-use/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { questionExplorerOf } from "../question-explorer/index.mjs";
import { investigationOf } from "../investigation/index.mjs";
import { reviewOf } from "../review/index.mjs";
import { wordsOf, hasWords, untilWords, dayInSentence } from "./words.mjs";
import { localize } from "../setup-words/index.mjs";

/* The walk queue passes in answers this shape; with none passed, an item is ungrouped rather than given a home. */
const UNGROUPED = Object.freeze({ state: "determined", ungrouped: true, reasons: [], depth_bound: null, ancestors: [] });

/** R2, R3: the label every machine-noticed item carries (the machine's, in the hypothesis layer). */
export const NOTICED_LABEL = "noticed";
/** R11 (DEC-131): the mark on every member-facing sentence of an R2 or R3 item; what the machine raised is a "hint",
 *  never a "signal". R4's, R5's and R6's items are not hints and never carry it. */
export const HINT_MARK = localize("mark.hint.label", "Hint · machine work");
/** R9: the gate (K1504, M-C8): a check or detector is shown only at a measured false-alarm rate of at most 20%. */
export const GATE_RATE_MAX = 0.2;
/** R2, R3 (as queue-producers R4): the projects whose checks and detectors one read asks about, in id order. */
export const NOTICE_PROJECTS_MAX = 50;
/** R4: the pages of 200 standing answers one read follows (answers R20's page). */
export const STANDING_PAGES_MAX = 5;
/** R5: the adopted duties one read derives occurrences for. */
export const DUTIES_MAX = 500;
/** R8: the one act an R2 or R3 item offers beside its disposal (queue's own): take it up as the member's hunch or
 *  hypothesis (`hypotheses`, `op=hypothesishold`). Nothing else: never a citation, never a grade, never a finding. */
export const TAKE_UP = Object.freeze({ id: "hypothesishold", label: localize("notice-producers.label.take_hint_hunch", "Take this hint up as your own hunch or hypothesis"), weight: "single" });
/** R6: the setter's own answer to a wait come round: record that they looked (`inquiry` R56, `op=waitlook`). */
export const WAIT_LOOK = Object.freeze({ id: "waitlook", label: localize("notice-producers.label.record_looked", "Record that you looked"), weight: "single" });
/** R12: the levels `credentials.securityLevel` answers (its R45); anything else is no answer, never `Ordinary`. */
export const SECURITY_LEVELS = Object.freeze(["Ordinary", "Raised", "High"]);
/** R12: the hours one `securityMap` read covers, so it answers hour by hour (its R45: `hour` up to 48 hours). */
export const SECURITY_READ_HOURS = 48;
/** R13 (K1943, K1881): the window of changes read, by the later capture's age, and the changes one read follows. */
export const POLICY_CHANGE_DAYS = 90;
export const POLICY_CHANGES_MAX = 1000;
/** R13: `following.policyChanges`' page (its R21: at most 200). */
export const POLICY_CHANGES_PAGE = 200;
/** R14 (T37; N762, K2175): the window of `found` notes read, by the note's age (as R13's), and the notes one read follows.
 *  Each read starts again at the window's start (`file-safety` R15's `cursor` is null at its end), so a note older than
 *  the window is never read and never uses up the bound. */
export const SCAN_FINDINGS_DAYS = 90;
export const SCAN_FINDINGS_MAX = 1000;
/** R15: the security tools' events one read follows (`file-safety.securityToolEvents`, its R31). */
export const TOOL_EVENTS_MAX = 1000;
/** R14, R15: the page asked of `file-safety`'s lists (its R15, R31: at most 1,000 a page). */
export const FILE_SAFETY_PAGE = 200;
/** R15: the event `file-safety` lists when it switches a tool off (its R31: `PRIVATE_MODE_NOT_HONOURED`), and the one
 *  that turns it on again (its R29). */
export const TOOL_SWITCHED_OFF = "switched_off";
export const TOOL_TEST_PASSED = "test_passed";
/** The kinds this module raises, with their class (queue R1's `classOfKind` gains them, T33-83; T35-67). */
export const NOTICE_KINDS = Object.freeze({
  "interest-check-noticed": "FINDING",
  "money-detector-noticed": "FINDING",
  "standing-answer": "FINDING",
  "temporal-expectation-due": "FINDING",
  "inquiry-recheck-due": "OBLIGATION",
  "security-level-high": "FINDING",
  "policy-changed-noticed": "FINDING",
  "scan-found": "FINDING",
  "security-tool-off": "FINDING",
  /* R16 (queue R1, T40; K2376 (2), K2394) */
  "explore-ask": "FINDING",
  "ai-limit-reached": "FINDING",
  "project-account-suspended": "FINDING",
  /* R17 (queue R1, T41; K2418, K2484) */
  "question-find": "FINDING",
  "step-later-found": "FINDING",
  "step-date-due": "OBLIGATION",
  "step-reminder": "OBLIGATION",
  "milestone-overdue": "FINDING",
  "milestone-reminder": "OBLIGATION",
  "project-quiet": "FINDING",
  "step-cost-shared": "FINDING",
  "step-cost-message": "FINDING",
  "review-comment-left-out": "FINDING",
  /* R24 (queue R57, T50; N1204) */
  "watched-changed": "FINDING",
  /* R27 (G2, K4562): a large capture's background fetch was delivered */
  "fetch-done": "FINDING",
  /* R28 (G55, K4562): a money ingest run in the background finished, or was stopped */
  "ingest-done": "FINDING",
  "ingest-stopped": "FINDING",
  /* R29 (fix round 9, G135f): a reading ended, in part or refused */
  "reading-ended": "FINDING",
});
/** R29: the window of ended readings read, by the row's end, and the rows one read follows (`plane` R98: at most 500 a page). */
export const READING_ENDED_DAYS = 90;
export const READING_ENDED_MAX = 1000;
export const READING_ENDED_PAGE = 200;
/** R29: the states of a job row that are told (plane R97: a row still queued, fetching, reading or partial is never told), and the one job kind that is a reading. */
export const READING_ENDED_STATES = Object.freeze(["finished", "final", "refused"]);
export const READING_JOB_KIND = "reading";
/** R28: the window of finished or stopped ingests read, by the ingest's age (as R27's), and the ingests one read follows. */
export const INGEST_NOTICE_DAYS = 90;
export const INGEST_NOTICE_MAX = 1000;
export const INGEST_NOTICE_PAGE = 200;
/** R28: the two states of an ingest that are told (calculations' `state`; `ingesting` is never told). */
export const INGEST_STATES = Object.freeze(["done", "stopped"]);
/** R27: the window of `fetch_done` records read, by the record's age (as R14's), and the records one read follows. */
export const FETCH_DONE_DAYS = 90;
export const FETCH_DONE_MAX = 1000;
export const FETCH_DONE_PAGE = 200;
/** R27: the door to the filed document (stand-in for the row owed, `notice.fetch.done.door`). */
const DOOR_OPEN_DOCUMENT = localize("notice-producers.index.open_the_document", "Open the document");
/** R16, R17: the items one read answers from each of their sources (as R13's and R14's bounds); `facts` states the
 *  bound and `truncated` when a source answers more. */
export const ACCOUNT_ITEMS_MAX = 200;
export const INVESTIGATION_ITEMS_MAX = 200;
/** R24: the watched items one read follows (`retrieval.browse`'s `next`, its R85: at most 200 a page). */
export const WATCHED_ITEMS_MAX = 1000;
export const WATCHED_PAGE = 200;
/** R16: the periods a limit counts over (ai-use R2), each with its `ai.period.*` and `ai.when.*` words. */
export const LIMIT_PERIODS = Object.freeze(["day", "month"]);
/** R16: the "Ask" item's label (an Ask, DEC-69's form), beside R16's two "Noticed" items' `noticed`. */
export const ASK_LABEL = "ask";
/** R16: the Ask's one act beside disposal: approve exploring on that account today (`ai-use` R9, `op=exploreapprove`). */
export const EXPLORE_APPROVE = Object.freeze({ id: "exploreapprove", label: wordsOf("act.exploreapprove.label.queue"), weight: "single" });

const HOUR_MS = 3600e3, DAY_MS = 24 * HOUR_MS;
/* A provider's failure, named in `facts.failed` as the provider it came from (R1). */
const failure = (provider) => Object.assign(new Error(`${provider} did not answer`), { provider });

/* R22: the clause `{reason}` leaves behind when it is filled with nothing ("… undetermined, because ."), dropped whole */
const NO_REASON_CLAUSE = /,\s*because\s+(?=\.)/;
const filled = (v) => typeof v === "string" && v.trim() !== "";
/* R16, R17: an item's key: `<CLASS>::<kind>::` and its source's own key, as given (a key already of that form is used whole). */
const keyed = (cls, kind, key) => (String(key).startsWith(`${cls}::${kind}::`) ? String(key) : `${cls}::${kind}::${key}`);
/* R16, R17: a source's list cut to its bound, and whether it was. */
const cut = (list, bound) => ({ list: list.slice(0, bound), truncated: list.length > bound });
const bare = (m) => { const t = typeof m === "string" ? m.trim() : ""; const x = /^member:(.+)$/.exec(t); return x ? x[1] : t || null; };
const isMachine = (m) => typeof m === "string" && (m.startsWith(MACHINE_AUTHOR_PREFIX) || m.startsWith(MACHINE_CLASS_PREFIX));
const instantOf = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
/* an ISO date-time: whole or fractional seconds, `Z` or an offset (R16, R17's instants, read by `#localDay`) */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const dayOf = (v) => { const d = typeof v === "string" ? v.slice(0, 10) : ""; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };
/* An item's age from an instant, or from a day: a day starts at its local midnight in `zone` (civil-time.dayRange),
   never the UTC midnight (K1444 (iii), K1688); with no zone held, a day's age is undetermined. */
const ageFrom = (since, now, reason, zone = null) => {
  const undetermined = (why, detail) => ({ state: "undetermined", reason: why, detail });
  if (!filled(since)) return undetermined(reason, "the provider states no instant this producer can read");
  let ms = NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    if (!filled(zone)) return undetermined("no_zone", "no time zone is held for this day, so when it began is not read (never as the UTC day)");
    let r = null;
    try { r = dayRange(since, since, zone); } catch { r = null; }
    if (!r || !filled(r.start)) return undetermined("no_zone", `the day ${since} could not be read in the zone ${zone}`);
    ms = Date.parse(r.start);
  } else ms = Date.parse(since);
  return Number.isFinite(ms) ? { state: "determined", since, ms: Math.max(0, now - ms) }
    : undetermined(reason, "the provider states no instant this producer can read");
};

export class NoticeProducers {
  #host; #deps;
  #homesFn = null; #optionsFn = null;
  #works = null;          /* R17: each step's work, read once a read (`#workOf`) */
  #zoneRead;              /* R13–R17: the profile's zone, read once a read (`#zone`); undefined until read */
  constructor({ host, storage, deps = {} } = {}) {
    this.#host = host;
    this.sql = storage.sql;
    this.#deps = { ...(deps || {}) };
  }

  /* ------------------------------------------------------------------ the providers (Uses), reached lazily */
  #dep(name, make) {
    if (!(name in this.#deps) || this.#deps[name] === undefined) this.#deps[name] = make();
    return this.#deps[name];
  }
  get #membership() { return this.#dep("membership", () => membershipOf(this.#host)); }
  get #people() { return this.#dep("people", () => peopleOf(this.#host)); }
  get #moneyChecks() { return this.#dep("moneyChecks", () => moneyChecksOf(this.#host)); }
  get #duties() { return this.#dep("duties", () => dutiesOf(this.#host)); }
  get #entities() { return this.#dep("entities", () => entitiesOf(this.#host)); }
  get #answers() { return this.#dep("answers", () => answersOf(this.#host)); }
  get #inquiry() { return this.#dep("inquiry", () => inquiryOf(this.#host)); }
  get #credentials() { return this.#dep("credentials", () => credentialsOf(this.#host)); }
  get #aiAccounts() { return this.#dep("aiAccounts", () => aiAccountsOf(this.#host)); }
  get #retrieval() { return this.#dep("retrieval", () => retrievalOf(this.#host)); }
  get #following() { return this.#dep("following", () => followingOf(this.#host)); }
  get #standards() { return this.#dep("standards", () => standardsOf(this.#host)); }
  get #fileSafety() { return this.#dep("fileSafety", () => fileSafetyOf(this.#host)); }
  get #capture() { return this.#dep("capture", () => captureOf(this.#host)); }
  get #calculations() { return this.#dep("calculations", () => calculationsOf(this.#host)); }
  get #provenance() { return this.#dep("provenance", () => provenanceOf(this.#host)); }
  get #aiUse() { return this.#dep("aiUse", () => aiUseOf(this.#host)); }
  get #steps() { return this.#dep("steps", () => stepsOf(this.#host)); }
  get #questionExplorer() { return this.#dep("questionExplorer", () => questionExplorerOf(this.#host)); }
  get #investigation() { return this.#dep("investigation", () => investigationOf(this.#host)); }
  get #review() { return this.#dep("review", () => reviewOf(this.#host)); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #homesOf(ids) { return this.#homesFn ? this.#homesFn(ids || []) : { ...UNGROUPED }; }
  #optionsOf(ids) { return this.#optionsFn ? this.#optionsFn(ids || []) || [] : []; }

  /* ================================================================== R1 · noticeItems
   * queue's ONE read of this module. Each producer reads one provider; a provider that throws contributes no item and
   * is named in `facts.failed` (the read never throws). `facts` states each producer's bound and whether it cut. R13's
   * second provider (`standards`, the declarer) is named for itself when it is the one that fails. */
  noticeItems({ member = null, viewer = null, now = null, identity = null, homesOf = null, optionsOf = null } = {}) {
    void identity;        // queue's options are closed over it already (its R12); named here as R1 names it
    const me = isMachine(member) ? null : bare(member);
    const at = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : Date.now();
    this.#homesFn = typeof homesOf === "function" ? homesOf : null;
    this.#optionsFn = typeof optionsOf === "function" ? optionsOf : null;
    const items = [], failed = [];
    const facts = {
      projects: { bound: NOTICE_PROJECTS_MAX, truncated: false },
      interest_check: { truncated: false },
      money_detector: { truncated: false },
      standing_answer: { bound: STANDING_PAGES_MAX * 200, truncated: false },
      temporal_expectation: { bound: DUTIES_MAX, truncated: false },
      inquiry_recheck: { truncated: false },
      security_level: { days: SECURITY_DAYS, truncated: false },
      policy_change: { bound: POLICY_CHANGES_MAX, days: POLICY_CHANGE_DAYS, truncated: false },
      scan_found: { bound: SCAN_FINDINGS_MAX, days: SCAN_FINDINGS_DAYS, truncated: false },
      security_tool_off: { bound: TOOL_EVENTS_MAX, truncated: false },
      explore_ask: { bound: ACCOUNT_ITEMS_MAX, truncated: false },
      ai_limit: { bound: ACCOUNT_ITEMS_MAX, truncated: false },
      signin_suspended: { bound: ACCOUNT_ITEMS_MAX, truncated: false },
      question_find: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      step_later_found: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      step_due: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      step_cost_shared: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      step_cost_message: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      milestone: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      project_quiet: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      review_left_out: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
      watched_changed: { bound: WATCHED_ITEMS_MAX, truncated: false },
      fetch_done: { bound: FETCH_DONE_MAX, days: FETCH_DONE_DAYS, truncated: false },
      ingest: { bound: INGEST_NOTICE_MAX, days: INGEST_NOTICE_DAYS, truncated: false },
      reading_ended: { bound: READING_ENDED_MAX, days: READING_ENDED_DAYS, truncated: false },
      failed,
    };
    const run = (provider, fn) => {
      try { const r = fn(); items.push(...r.items); Object.assign(facts[r.fact], r.facts || {}); }
      catch (e) { const named = e && typeof e.provider === "string" ? e.provider : provider; if (!failed.includes(named)) failed.push(named); }
    };
    try {
      if (!me) return { items, facts };
      let scope = { projects: [], truncated: false };
      try { scope = this.#projects(me, viewer); } catch { failed.push("membership"); }
      facts.projects.truncated = scope.truncated;
      run("people", () => ({ fact: "interest_check", ...this.#interestChecks(me, scope.projects, viewer, at) }));
      run("money-checks", () => ({ fact: "money_detector", ...this.#moneyDetectors(me, scope.projects, viewer, at) }));
      run("answers", () => ({ fact: "standing_answer", ...this.#standingAnswers(me, viewer, at) }));
      run("duties", () => ({ fact: "temporal_expectation", ...this.#dutiesDue(me, viewer, at) }));
      run("inquiry", () => ({ fact: "inquiry_recheck", ...this.#waitsDue(me, viewer, at) }));
      run("credentials", () => ({ fact: "security_level", ...this.#securityHigh(me, at) }));
      run("following", () => ({ fact: "policy_change", ...this.#policyChanges(me, viewer, at) }));
      run("file-safety", () => ({ fact: "scan_found", ...this.#scanFound(me, viewer, at) }));
      run("file-safety", () => ({ fact: "security_tool_off", ...this.#toolsOff(me, viewer, at) }));
      run("ai-use", () => ({ fact: "explore_ask", ...this.#exploreAsks(me, viewer, at) }));
      run("ai-use", () => ({ fact: "ai_limit", ...this.#limitsReached(me, viewer, at) }));
      run("ai-accounts", () => ({ fact: "signin_suspended", ...this.#accountsSuspended(me, viewer, at) }));
      run("question-explorer", () => ({ fact: "question_find", ...this.#questionFinds(me, viewer, at) }));
      run("steps", () => ({ fact: "step_later_found", ...this.#laterFound(me, viewer, at) }));
      run("steps", () => ({ fact: "step_due", ...this.#stepsDue(me, viewer, at) }));
      run("steps", () => ({ fact: "step_cost_shared", ...this.#costShares(me, viewer, at) }));
      run("steps", () => ({ fact: "step_cost_message", ...this.#costMessages(me, viewer, at) }));
      run("investigation", () => ({ fact: "milestone", ...this.#milestones(me, viewer, at) }));
      run("investigation", () => ({ fact: "project_quiet", ...this.#quietPrompts(me, viewer, at) }));
      run("review", () => ({ fact: "review_left_out", ...this.#reviewLeftOut(me, viewer, at) }));
      run("retrieval", () => ({ fact: "watched_changed", ...this.#watchedChanged(me, viewer, at) }));
      run("capture", () => ({ fact: "fetch_done", ...this.#fetchDone(me, viewer, at) }));
      run("calculations", () => ({ fact: "ingest", ...this.#ingestNotices(me, viewer, at) }));
      run("readings", () => ({ fact: "reading_ended", ...this.#readingsEnded(me, viewer, at) }));
      return { items, facts };
    } catch {
      return { items: [], facts: { ...facts, failed: [...new Set([...failed, "notice-producers"])] } };
    } finally {
      this.#homesFn = null;
      this.#optionsFn = null;
      this.#works = null;
      this.#zoneRead = undefined;
    }
  }

  /* ------------------------------------------------------------------ R7: sight */
  /** The projects this viewer sees in which the member participates (joined or leaving; membership R74), in id order,
   *  at most NOTICE_PROJECTS_MAX; `truncated` when a further one qualifies. A project hidden from the viewer is never
   *  asked about, so nothing inside it is shown or counted (R7). */
  #projects(me, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return { projects: [], truncated: false };
    const where = gate.scope === "member" ? "1=1" : gate.sql;
    const out = [];
    let truncated = false;
    for (const r of this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='project' AND (${where}) ORDER BY b.bundle_id`,
      ...(gate.scope === "member" ? [] : gate.args))) {
      const p = this.#membership.participation(r.bundle_id, me);
      if (!(p && (p.state === "joined" || p.state === "leaving"))) continue;
      if (out.length === NOTICE_PROJECTS_MAX) { truncated = true; break; }
      out.push(r.bundle_id);
    }
    return { projects: out, truncated };
  }

  /** A home set made of the named cases themselves (each at depth 0, when this viewer sees it and it is a case) and
   *  every ancestor queue's walk reaches above them (queue R7). */
  #homesAt(caseIds, viewer) {
    const ids = [...new Set((caseIds || []).filter(filled))];
    const up = this.#homesOf(ids);
    const gate = viewerPredicate(viewer);
    const own = [];
    for (const id of ids) {
      const row = gate.scope === "DENY" ? null : this.#rows(
        `SELECT b.bundle_id, b.object_type, b.current_state, b.title FROM bundles b WHERE b.bundle_id=?
           AND (${gate.scope === "member" ? "1=1" : gate.sql})`, id, ...(gate.scope === "member" ? [] : gate.args))[0];
      if (!row) continue;
      const ty = normalizeType(row.object_type);
      if (!["inquiry", "project"].includes(ty)) continue;
      const spec = vocabFor(STATES, row.object_type);
      const edges = spec && spec.edges ? spec.edges : null;
      const terminal = edges && Object.prototype.hasOwnProperty.call(edges, row.current_state)
        ? edges[row.current_state].length === 0 : null;
      own.push({ id: row.bundle_id, type: ty, title: row.title ?? null, state: row.current_state ?? null, terminal, depth: 0 });
    }
    const ancestors = [...own, ...(up.ancestors || []).filter((a) => !own.some((o) => o.id === a.id))]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ...up, ancestors, ungrouped: up.state === "determined" && ancestors.length === 0 };
  }

  /* ================================================================== R2 · interest checks (people R24, R25)
   * For each of the member's projects, the results `people.checkResults({project, viewer})` answers: only a version
   * whose gate is recorded open and that is switched on for that project, and only a result whose every input this
   * viewer may see (people withholds the rest whole, uncounted). A check with no project of its own runs in each
   * project that has not switched it off. One item per result, homed under every such project of the member's. */
  #interestChecks(me, projects, viewer, now) {
    const byKey = new Map();
    let truncated = false;
    let conditions = null;
    const conditionOf = (check, version) => {
      if (conditions === null) {
        conditions = new Map();
        const l = typeof this.#people.listChecks === "function" ? this.#people.listChecks({ viewer }) : null;
        for (const c of (l && Array.isArray(l.checks) ? l.checks : [])) conditions.set(`${c.check}@${c.version}`, c.condition ?? null);
      }
      return conditions.get(`${check}@${version}`) ?? null;
    };
    for (const project of projects) {
      const r = this.#people.checkResults({ project, viewer });
      if (!r || r.ok === false || !Array.isArray(r.checks)) continue;
      for (const c of r.checks) {
        /* R9: a closed gate raises no item and counts none; only an answer saying the gate is open is read */
        if (!c || c.gated !== false || !Array.isArray(c.results)) continue;
        if (c.truncated === true) truncated = true;
        for (const x of c.results) {
          if (!x || !filled(x.result_id)) continue;
          const id = `FINDING::interest-check-noticed::${c.check}::${x.result_id}`;
          const seen = byKey.get(id);
          if (seen) { seen.projects.push(project); continue; }
          byKey.set(id, { projects: [project], c, x });
        }
      }
    }
    const items = [];
    for (const [id, { projects: ps, c, x }] of byKey) {
      const den = x.denominator && typeof x.denominator === "object" ? x.denominator : { label: c.denominator ?? null, counted: null };
      const condition = conditionOf(c.check, c.version);
      items.push({
        id, class: "FINDING", kind: "interest-check-noticed",
        label: NOTICED_LABEL, layer: "hypothesis", by: "the machine's", mark: HINT_MARK,
        case: this.#homesAt(ps, viewer),
        subject: { kind: "interest_check_result", id: x.result_id, check: c.check, version: c.version, name: c.name ?? x.name ?? null },
        summary: localize("notice-producers.summary.pattern_check_finds", "{hint_mark}: a pattern the check \"{name}\" finds in held facts", { hint_mark: String(HINT_MARK), name: String(c.name ?? c.check) }),
        detail: `${HINT_MARK}. A check noticed this hint, the machine's work, in the hypothesis layer. The check's condition is data: `
              + `${condition ? JSON.stringify(condition) : "as its definition states"}. It is counted against `
              + `${den.label || "its stated set"}${Number.isFinite(den.counted) ? ` (${den.counted} counted on the last full pass)` : ""}, `
              + "and its derivation cites every row it rests on. This hint is a pattern worth a look: never a finding, never "
              + "a basis for a claim, and it says nothing about anyone. Dispose of it, or take it up as your own hunch or hypothesis.",
        basis: { source: "people.checkResults", check: c.check, version: c.version, result: x.result_id, condition,
                 denominator: den, derivation: x.derivation ?? null, gate: "open", projects: ps,
                 detail: localize("notice-producers.index.an_interest_checks_result_is", "an interest check's result is people's (its R23–R25): shown only once its version's gate is recorded open, switched on for the project, and to a viewer who may see every input.") },
        age: ageFrom(x.at, now, "no_result_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [TAKE_UP],
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R3 · money detectors (money-checks R9, R10)
   * For each of the member's projects, the results `money-checks.noticed({project, viewer})` answers: only versions
   * gated at or under 20% and switched on for it, whose every input this viewer may see. R9 here is a second guard:
   * a result whose gate is not stated at or under the bound is never raised. */
  #moneyDetectors(me, projects, viewer, now) {
    const byKey = new Map();
    let truncated = false;
    for (const project of projects) {
      const r = this.#moneyChecks.noticed({ project, viewer, limit: 500 });
      if (!r || r.ok === false || !Array.isArray(r.items)) continue;
      if (r.truncated === true) truncated = true;
      for (const x of r.items) {
        if (!x || !filled(x.result_id) || !filled(x.detector_id)) continue;
        const rate = x.gate ? Number(x.gate.false_alarm_rate) : NaN;
        if (!(Number.isFinite(rate) && rate <= GATE_RATE_MAX)) continue;
        const id = `FINDING::money-detector-noticed::${x.detector_id}::${x.result_id}`;
        const seen = byKey.get(id);
        if (seen) { seen.projects.push(project); continue; }
        byKey.set(id, { projects: [project], x });
      }
    }
    const items = [];
    const figure = (f) => (f && typeof f === "object" ? f.value ?? null : f ?? null);
    for (const [id, { projects: ps, x }] of byKey) {
      items.push({
        id, class: "FINDING", kind: "money-detector-noticed",
        label: NOTICED_LABEL, layer: "hypothesis", by: "the machine's", mark: HINT_MARK,
        case: this.#homesAt(ps, viewer),
        subject: { kind: "money_detector_result", id: x.result_id, detector: x.detector_id, version: x.version,
                   about: x.subject ?? null },
        summary: localize("notice-producers.summary.pattern_detector_finds", "{hint_mark}: a pattern the detector \"{detector_label}\" finds in held money facts", { hint_mark: String(HINT_MARK), detector_label: String(x.detector_label ?? x.detector_id) }),
        detail: `${HINT_MARK}. A detector noticed this hint, the machine's work, in the hypothesis layer: ${figure(x.numerator) ?? "a part"} of `
              + `${figure(x.denominator) ?? "its stated population"}, by the derivation it cites over each input. This hint is a `
              + "pattern worth a look: never a finding, never a basis for a claim, and it says nothing about anyone. "
              + "Dispose of it, or take it up as your own hunch or hypothesis.",
        basis: { source: "money-checks.noticed", detector: x.detector_id, version: x.version, result: x.result_id,
                 numerator: x.numerator ?? null, denominator: x.denominator ?? null, derivation: x.derivation ?? null,
                 inputs: Array.isArray(x.inputs) ? x.inputs : [], gate: x.gate, projects: ps,
                 detail: localize("notice-producers.index.a_detectors_result_is_money", "a detector's result is money-checks' (its R6–R10): shown only for a version gated at or under 20% and switched on for the project, to a viewer who may see every input.") },
        age: ageFrom(x.at, now, "no_result_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [TAKE_UP],
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R4 · standing answers (answers R20)
   * Each run of the member's own standing questions that found something new, one item per run, to its author alone
   * (answers answers nothing of another member's). Told once: raised per run, never repeated. */
  #standingAnswers(me, viewer, now) {
    void viewer;
    const entries = [];
    let after = null, truncated = false;
    for (let page = 0; ; page += 1) {
      if (page === STANDING_PAGES_MAX) { truncated = true; break; }
      const r = this.#answers.standingAnswersFor({ member: `member:${me}`, after });
      if (!r || r.ok === false || !Array.isArray(r.entries)) break;
      entries.push(...r.entries);
      if (r.cursor === null || r.cursor === undefined) break;
      after = r.cursor;
    }
    const items = [];
    for (const e of entries) {
      const q = e && e.question && filled(e.question.id) ? e.question : null;
      if (!q || e.run === undefined || e.run === null) continue;
      const finds = e.finds ?? null;
      const answered = e.answer !== null && e.answer !== undefined;
      const sentences = answered && Array.isArray(e.answer.sentences)
        ? e.answer.sentences.filter((s) => s && filled(s.text)).map((s) => s.text) : [];
      const n = finds && Array.isArray(finds.ids) ? finds.ids.length : null;
      items.push({
        id: `FINDING::standing-answer::${q.id}::${e.run}`, class: "FINDING", kind: "standing-answer",
        label: e.label ?? localize("answers.machine_work_standing", "machine work, from your standing question"), by: "the assistant's",
        case: this.#homesOf([]),
        subject: { kind: "standing_question", id: q.id, question: q.question ?? null, run: e.run },
        summary: localize("notice-producers.summary.standing_question_found", "Your standing question found something new: {question}", { question: String(q.question ?? q.id) }),
        detail: localize("notice-producers.index.machine_work_from_your_standing", "Machine work, from your standing question. {v1}{v2}. This is told once.", { v1: String(n === null ? "New finds are held" : `${n} new ${n === 1 ? "find" : "finds"}`), v2: String(answered ? (sentences.length ? `; the assistant's answer: ${sentences.join(" ")}` : "; the assistant's answer is held with it")
                : `; the assistant did not answer, because ${NoticeProducers.heldBackWords(e.held_back)}`) }),
        basis: { source: "answers.standingAnswersFor", question: q.id, run: e.run, finds, answer: e.answer ?? null,
                 held_back: e.held_back ?? null, withheld: Array.isArray(e.withheld) ? e.withheld : [],
                 detail: localize("notice-producers.index.a_standing_questions_run_is", "a standing question's run is answers' (its R17–R20), seen only by its author; one entry per run that found something new, so each new find is told once (DEC-94).") },
        age: ageFrom(e.at, now, "no_run_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [],
      });
    }
    return { items, facts: { truncated } };
  }

  /** R4: what held the AI half back (answers R19), in plain words: the switch, the account, or the paying account's
   *  limit (`ai-use`'s `AI_LIMIT_REACHED`, its words as answers carries them; the retired ceiling's codes are gone,
   *  run-rules R20). The group's Civicsmith is "your group's Civicsmith" to the member (DEC-149, T34-87). */
  static heldBackWords(h) {
    if (!h || typeof h !== "object") return localize("notice-producers.held_back", "it was held back");
    if (h.condition === "switch_off") return h.switch === "member" ? localize("notice-producers.switch_standing_questions", "your own switch for standing questions is off")
      : localize("notice-producers.assistant_half_standing", "the assistant's half of standing questions is switched off in your team's Civicsmith");
    if (h.condition === "no_account") return localize("notice-producers.account_set_assistant", "you have no account of your own set for the assistant");
    if (h.condition === "limit") return filled(h.translation) ? h.translation.replace(/\.$/, "")
      : localize("notice-producers.limits_account_pay", "the limits of the account that would pay could not be checked");
    if (h.condition === "not_deployed") return localize("notice-producers.assistant_available_group", "the assistant is not available in your team's Civicsmith");
    return filled(h.translation) ? h.translation.replace(/\.$/, "") : localize("notice-producers.held_back", "it was held back");
  }

  /* ================================================================== R5 · duty occurrences come due (duties R7–R11)
   * The adopted duties `duties.dutiesOf` answers the viewer, by obligor (the obligors from duties' read contract, its
   * R20); for each whose recipient is this member, `occurrencesOf` as of the read's instant. An occurrence `overdue`
   * (only after the latest candidate) or possibly overdue (between the candidates, civil-time R19) is one item, a
   * question and never a violation. The group's own checkpoint is never one (D234; action-plans R23). (T45) An occurrence
   * whose due day (the latest candidate's, when undetermined) falls after the day `following.dutyWatchEndAt` answers for
   * the duty is no item; one due on or before it is raised as before. An occurrence with no due day read stays told. (T46,
   * R18; T47, R21) An occurrence already told at or before the instant that end took hold is not cut: its item stays until
   * disposed or no longer due. (T47, R20) Its sentences are `words.json`'s by key. */
  #dutiesDue(me, viewer, now) {
    const asOf = instantOf(now);
    const obligors = this.#rows(`SELECT DISTINCT obligor FROM duties WHERE obligor IS NOT NULL ORDER BY obligor`).map((r) => r.obligor);
    const items = [];
    let count = 0, truncated = false;
    for (const entity of obligors) {
      if (truncated) break;
      const r = this.#duties.dutiesOf({ entity, as: "obligor", viewer, limit: DUTIES_MAX });
      if (!r || r.ok === false || !Array.isArray(r.duties)) continue;
      if (r.truncated === true) truncated = true;
      for (const d of r.duties) {
        if (!d || !filled(d.duty_id)) continue;
        if (count === DUTIES_MAX) { truncated = true; break; }
        count += 1;
        const to = this.#recipients(d.adoption && d.adoption.by, d.project);
        if (!to.members.includes(me)) continue;
        const o = this.#duties.occurrencesOf({ dutyId: d.duty_id, asOf, viewer });
        if (!o || o.ok === false || !Array.isArray(o.occurrences)) continue;
        const ends = this.#watchEnd(d.duty_id);
        for (const occ of o.occurrences) {
          const it = this.#occurrenceItem(d, occ, to, asOf, viewer, now);
          if (!it) continue;
          /* (T45) told only up to the day a plan's watch on the duty ends: an occurrence due after it is no item;
             (T46, R18) unless it was already told before that end took hold: then it stays until disposed */
          if (ends && it.due && it.due > ends.day) {
            if (!NoticeProducers.#toldBefore(it, ends)) continue;
            it.basis.watch_end = { day: ends.day, at: ends.at, told_before: true };
          }
          items.push(it);
        }
      }
    }
    return { items, facts: { truncated } };
  }

  /** R5 (T45; following R25), R21 (T47; following R28): the end of this duty's telling, `{day, at}`: the day after which
   *  the duty is no longer told and the instant that end took hold (`following.dutyWatchEndAt(duty)`), null while no
   *  plan's watch on it is answered (R5 as before). A following that throws fails R5's read (R1); an answer whose day is
   *  no day, or whose instant is none, is read as no end, so the duty is still told. */
  #watchEnd(duty) {
    const f = this.#following;
    if (!f || typeof f.dutyWatchEndAt !== "function") return null;
    let end;
    try { end = f.dutyWatchEndAt(duty); } catch { throw failure("following"); }
    if (!end || typeof end !== "object" || typeof end.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(end.day)) return null;
    const at = typeof end.at === "string" && INSTANT.test(end.at) ? Date.parse(end.at) : NaN;
    return Number.isFinite(at) ? { day: end.day, at: end.at, ms: at } : null;
  }

  /** R18 (T46; N927; queue R16), R21 (T47; N967; following R28): whether an occurrence was already told before its
   *  duty's end of telling took hold, so it keeps its item (and is told as R5 tells it) until disposed, met, met late or
   *  no longer overdue. Its told state begins at the end of its first told day (civil-time, in that day's own zone): the
   *  first candidate's, when its due date is uncertain (`undetermined` once that candidate has passed), else its due
   *  day's (`overdue`). It was told before the end when that beginning is at or before `at`, the instant the end took
   *  hold (the answer that made it hold), for a `keep` as for a `stop`. A beginning that cannot be read is not told. */
  static #toldBefore(item, ends) {
    const due = item && item.subject ? item.subject.due : null;
    const first = due && Array.isArray(due.candidates) ? due.candidates[0] : due;
    const day = first && typeof first === "object" ? dayOf(first.value) : null;
    const zone = first && typeof first === "object" && filled(first.zone) ? first.zone : null;
    if (!day || !zone) return false;
    try {
      const from = Date.parse((dayRange(day, day, zone) || {}).end);
      return Number.isFinite(from) && from <= ends.ms;
    } catch { return false; }
  }

  /** Who a duty's item goes to: the member who adopted it, else its project's owners (membership R65), else the
   *  administrators (membership R86); with the rule that chose them. */
  #recipients(author, project) {
    const who = bare(author);
    if (who && !isMachine(author)) return { rule: "adopter", members: [who] };
    const owners = filled(project) ? (this.#membership.projectOwners(project) || []).map(bare) : [];
    if (owners.length) return { rule: "project_owners", members: owners };
    return { rule: "administrators", members: (this.#membership.activeAdmins() || []).map(bare) };
  }

  /** R20's `{office}` (K3144): the duty's obligor by its registered name (`entities.readEntity`, its R5: the entity's
   *  label, else its canonical alias standing), else its id as `duties` answers it. A registry that throws or answers no
   *  entity leaves the id: the name is a fill, never the item's failure. */
  #officeOf(d) {
    const id = filled(d.obligor) ? d.obligor : null;
    if (!id) return d.duty_id;
    let e = null;
    try { const r = this.#entities.readEntity({ entityId: id }); e = r && r.ok !== false && r.found ? r.entity : null; } catch { e = null; }
    const alias = e && Array.isArray(e.aliases) ? e.aliases.find((a) => a && a.canonical && !a.withdrawn && filled(a.alias)) : null;
    return e && filled(e.label) ? e.label : alias ? alias.alias : id;
  }

  #occurrenceItem(d, occ, to, asOf, viewer, now) {
    if (!occ || !filled(occ.key)) return null;
    if (occ.trigger && occ.trigger.group_checkpoint === true) return null;
    const due = occ.due && !occ.due.undetermined ? occ.due.date : null;
    let state = null;
    if (occ.state === "overdue") state = "overdue";
    else if (occ.state === "undetermined" && due && Array.isArray(due.candidates) && !(occ.evidence || []).length) {
      const o = overdueOn({ due, at: asOf, side: "body" });
      if (o && o.code === "POSSIBLY_OVERDUE") state = "possibly overdue";
    }
    if (!state) return null;
    /* a body's due is the latest candidate (civil-time R17); its value is the local day in its own zone */
    const body = due && Array.isArray(due.candidates) ? due.candidates[due.candidates.length - 1] : due;
    const first = due && Array.isArray(due.candidates) ? due.candidates[0] : due;
    const dueDay = body && typeof body === "object" ? dayOf(body.value) : dayOf(body);
    const firstDay = first && typeof first === "object" ? dayOf(first.value) : dayOf(first);
    const sinceDay = state === "overdue" ? dueDay : firstDay;
    const sinceZone = state === "overdue" ? (body && typeof body === "object" ? body.zone : null) : (first && typeof first === "object" ? first.zone : null);
    /* R20 (T47; DEC-198 (3)): the sentences by key, `.overdue.*` or `.undetermined.*`, filled from duties' own facts */
    const today = NoticeProducers.#localDay(now, this.#zone() ?? (filled(sinceZone) ? sinceZone : null));
    const told = state === "overdue" ? "overdue" : "undetermined";
    const act = d.performance && filled(d.performance.act) ? d.performance.act : d.duty_id;
    const trace = occ.due && occ.due.trace && typeof occ.due.trace === "object" ? occ.due.trace : {};
    /* R22 (T48; N1044; duties R33): `{reason}` is duties' member-facing reason (`reason.says`), never `why`, which stays the
       record's derivation and is not drawn into the sentence; `reason: null` fills nothing and draws no reason clause */
    const says = occ.reason && filled(occ.reason.says) ? occ.reason.says.trim().replace(/\.\s*$/, "") : "";
    const fills = { duty: act, office: this.#officeOf(d), what: act,
                    basis: filled(trace.citation) ? trace.citation : d.adoption && filled(d.adoption.clause) ? d.adoption.clause
                      : occ.due && filled(occ.due.basis_kind) ? occ.due.basis_kind : (d.time && d.time.basis) || "",
                    reason: says,
                    ...(told === "overdue" ? { date: dayInSentence(dueDay, today) }
                      : { from: dayInSentence(firstDay, today), to: dayInSentence(dueDay, today) }) };
    const summaryKey = `queue.temporal-expectation-due.${told}.summary`, detailKey = `queue.temporal-expectation-due.${told}.detail`;
    return {
      /* K1676: the key carries the occurrence's state as duties answers it, so possibly overdue becoming overdue is new */
      id: `FINDING::temporal-expectation-due::${d.duty_id}::${occ.key}::${told}`,
      class: "FINDING", kind: "temporal-expectation-due",
      label: NOTICED_LABEL, by: "the machine's",
      case: this.#homesAt(filled(d.project) ? [d.project] : [], viewer),
      due: dueDay,
      subject: { kind: "duty", id: d.duty_id, occurrence: occ.key, due: due ?? null,
                 basis_kind: occ.due && occ.due.basis_kind ? occ.due.basis_kind : (d.time && d.time.basis) || null,
                 derivation: occ.derivation ?? null, state },
      summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills).replace(NO_REASON_CLAUSE, ""),
      summary_key: summaryKey, detail_key: detailKey, reason_code: occ.reason && filled(occ.reason.code) ? occ.reason.code : null, fills,
      basis: { source: "duties.occurrencesOf", duty: d.duty_id, occurrence: occ.key, state: occ.state, why: occ.why ?? null,
               trigger: occ.trigger ?? null, due: occ.due ?? null, derivation: occ.derivation ?? null, as_of: asOf,
               recipients_rule: to.rule,
               detail: localize("notice-producers.index.an_occurrences_state_is_duties", "an occurrence's state is duties' (its R9–R11), derived on read as of this read's instant; a body is overdue only after the latest candidate due date, possibly overdue between (K1444 (i)).") },
      age: ageFrom(sinceDay, now, "no_due_day", sinceZone),
      assignee: null, assignee_role: null,
      recipients: to.members,
      options: this.#optionsOf([d.duty_id]),
    };
  }

  /* ================================================================== R6 · dated waits come round (inquiry R55)
   * The waits this member set on inquiries the viewer may see, due on the local day (inquiry reads it in the profile's
   * zone). One to-do per (inquiry, date), to the setter alone, naming what is awaited, from whom and by when (DEC-98). */
  #waitsDue(me, viewer, now) {
    const r = this.#inquiry.datedWaits({ member: `member:${me}`, asOf: instantOf(now), viewer });
    if (!r || r.ok === false || !Array.isArray(r.waits)) return { items: [], facts: {} };
    const byKey = new Map();
    for (const w of r.waits) {
      if (!w || w.state !== "due" || !filled(w.inquiry) || !dayOf(w.date) || bare(w.set_by) !== me) continue;
      const id = `OBLIGATION::inquiry-recheck-due::${w.inquiry}::${w.date}`;
      if (!byKey.has(id)) byKey.set(id, []);
      byKey.get(id).push(w);
    }
    const items = [];
    const today = NoticeProducers.#localDay(now, filled(r.zone) ? r.zone : this.#zone());
    for (const [id, ws] of byKey) {
      const w = ws[0];
      /* R20 (T47; DEC-198 (3)): the sentences by key; `{what}` each wait's text and `{who}` its description, as inquiry
         answers them (its R55: what, and from whom, DEC-98), a description's own leading "from" left to the sentence, a wait
         with no description naming its text; `{date}` its day */
      const what = [...new Set(ws.map((x) => x.text).filter(filled))].join("; ");
      const whom = (x) => (filled(x.description) ? x.description.trim().replace(/^from\s+/i, "") : x.text);   /* the sentence says "from" */
      const who = [...new Set(ws.map(whom).filter(filled))].join("; ");
      const fills = { question: this.#titleOf(w.inquiry, viewer) ?? w.inquiry, what, who, date: dayInSentence(w.date, today) };
      const summaryKey = "queue.inquiry-recheck-due.summary", detailKey = "queue.inquiry-recheck-due.detail";
      items.push({
        id, class: "OBLIGATION", kind: "inquiry-recheck-due",
        case: this.#homesAt([w.inquiry], viewer),
        due: w.date,
        subject: { kind: "inquiry", id: w.inquiry, date: w.date,
                   waits: ws.map((x) => ({ index: x.index, text: x.text, description: x.description ?? null, set_at: x.set_at ?? null })) },
        summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills), summary_key: summaryKey, detail_key: detailKey, fills,
        basis: { source: "inquiry.datedWaits", inquiry: w.inquiry, date: w.date, set_by: w.set_by, zone: r.zone ?? null,
                 waits: ws.map((x) => x.index),
                 detail: localize("notice-producers.index.a_dated_wait_is_inquirys", "a dated wait is inquiry's (its R54–R57), due from the start of its local day; it goes to the member who set it and to nobody else, and leaves when they look, re-date or remove it, or the question concludes.") },
        age: ageFrom(w.date, now, "no_wait_day", r.zone),        /* the local day in inquiry's zone (K1688) */
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [WAIT_LOOK, ...this.#optionsOf([w.inquiry])],
      });
    }
    return { items, facts: {} };
  }
  /* ================================================================== R12 · the security level becomes High
   * (credentials R45; N703, K1874 (Q5), K1875, DEC-165 (7)). To an active administrator alone, while
   * `securityLevel` answers High: one item per episode, keyed by the episode's start. The episode is the unbroken run
   * of whole hours, reaching the call, at whose end the level was High by credentials' own rule (a `through` in the
   * 24 hours ending then, or that hour unusual at its threshold), read back hour by hour from `securityMap` under the
   * administrator's own `by`, at most the days of counts kept; the hour of the call counts as High, as the call says.
   * A level that does not answer one of the three is a failure, never read as Ordinary. Counts only, in its words. */
  #securityHigh(me, now) {
    let admins;
    try { admins = (this.#membership.activeAdmins() || []).map(bare); } catch { throw failure("membership"); }
    if (!admins.includes(me)) return { items: [], facts: {} };
    const lv = this.#credentials.securityLevel();
    if (!lv || typeof lv !== "object" || !SECURITY_LEVELS.includes(lv.level)) throw failure("credentials");
    if (lv.level !== "High") return { items: [], facts: {} };
    const { start, through, truncated } = this.#episode(me, now);
    const from = instantOf(start), to = instantOf(now);
    const got = through === 0 ? localize("notice-producers.nothing_got_through", "nothing got through")
      : localize("notice-producers.got_through_paused", "{through} {through_2} got through under a paused role", { through: String(through), through_2: wordsOf(through === 1 ? "notice-producers.sign_recovery" : "notice-producers.sign_ins_recoveries") });
    const fromText = NoticeProducers.#timeAt(from, this.#zone());
    return { items: [{
      id: `FINDING::security-level-high::${from}`, class: "FINDING", kind: "security-level-high",
      label: NOTICED_LABEL, by: "the machine's",
      case: this.#homesOf([]),
      subject: { kind: "civicsmith", id: null, episode: from },
      summary: localize("notice-producers.summary.security_level_group", "The security level of your team's Civicsmith is High"),
      detail: fromText === null
        ? localize("notice-producers.index.the_security_level_of_your_no_time", "The security level of your team's Civicsmith has been High, and in that time {got}.", { got: String(got) })
        : localize("notice-producers.index.the_security_level_of_your", "The security level of your team's Civicsmith has been High since {from}, and in that time {got}.", { from: fromText, got: String(got) }),
      screen: { op: "securitymap", from, to },
      basis: { source: "credentials.securityLevel", level: lv.level, level_at: lv.levelAt ?? null, episode: { from, to },
               through, threshold: { ...SECURITY_THRESHOLD },
               detail: localize("notice-producers.index.the_level_is_credentials", "the level is credentials' (its R45), over counts only (its R44); an episode is an unbroken run of hours at whose end the level was High, told once to each administrator, and a later one is told again.") },
      age: ageFrom(from, now, "no_episode_start"),
      assignee: null, assignee_role: null,
      recipients: [me],
      options: this.#optionsOf([]),
    }], facts: { truncated } };
  }

  /** R12: the episode reaching `now`: its first hour's start, the `through` count since, and whether the read reached
   *  the days kept still High. `securityMap` refusing is a failure of the provider (R1). */
  #episode(by, now) {
    const cur = Math.floor(now / HOUR_MS);
    const floor = cur - SECURITY_DAYS * 24;
    const hours = new Map();
    let lo = cur + 1;
    const load = () => {
      const fromH = Math.max(floor, lo - SECURITY_READ_HOURS);
      if (fromH >= lo) return false;
      const to = lo === cur + 1 ? now : lo * HOUR_MS;
      const m = this.#credentials.securityMap({ from: instantOf(fromH * HOUR_MS), to: instantOf(to), by: `member:${by}` });
      if (!m || m.ok !== true || m.step !== "hour" || !Array.isArray(m.buckets)) throw failure("credentials");
      for (const b of m.buckets) {
        const h = Math.floor(Date.parse(b.start) / HOUR_MS);
        if (!Number.isFinite(h)) continue;
        hours.set(h, { through: Number(b.counts && b.counts.through) || 0, total: Number(b.counts && b.counts.total) || 0,
                       usual: Number(b.usual && b.usual.total) || 0 });
      }
      lo = fromH;
      return true;
    };
    const at = (h) => { while (h < lo) if (!load()) return null; return hours.get(h) ?? { through: 0, total: 0, usual: 0 }; };
    const unusual = (x) => x.total >= SECURITY_THRESHOLD.atLeast
      && x.total > (x.usual === 0 ? SECURITY_THRESHOLD.times : SECURITY_THRESHOLD.times * x.usual);
    /* credentials R45's rule at the end of hour h: a `through` in the 24 hours ending then, or the hour unusual */
    const highAt = (h) => {
      const x = at(h);
      if (!x) return null;
      if (unusual(x)) return true;
      for (let k = h; k > h - 24 && k >= floor; k--) { const y = at(k); if (y && y.through > 0) return true; }
      return false;
    };
    at(cur);
    let start = cur, truncated = false;
    for (let h = cur - 1; ; h--) {
      if (h < floor) { truncated = true; break; }
      const high = highAt(h);
      if (high === null) { truncated = true; break; }
      if (!high) break;
      start = h;
    }
    let through = 0;
    for (let h = start; h <= cur; h++) through += (hours.get(h) || { through: 0 }).through;
    return { start: start * HOUR_MS, through, truncated };
  }

  /* ================================================================== R13 · a policy's silent change
   * (following R21; N652, K1727, K1740, DEC-145 (5)). The changes `policyChanges` answers this viewer whose later
   * capture is no older than the window, read through `since` (T36: never by filtering an unbounded read, so a change
   * older than the window is never read and never uses up the bound), whose `amendment_held` is false, following its
   * cursor to at most the bound of changes read (`facts` states it, and `truncated`). Each goes to the member who declared the policy in
   * `standards` while that member is active, else to the administrators, and only while the recipient sees it (the
   * read is the recipient's own). Its detail is DEC-145 (5)'s sentence, nothing more: never what the change means. */
  #policyChanges(me, viewer, now) {
    const since = now - POLICY_CHANGE_DAYS * DAY_MS;       /* an instant, in ms (following R21 reads it to the whole second at or after) */
    const changes = [];
    let after = null, read = 0, truncated = false;
    for (;;) {
      if (read >= POLICY_CHANGES_MAX) { truncated = true; break; }
      const r = this.#following.policyChanges({ since, after, limit: Math.min(POLICY_CHANGES_PAGE, POLICY_CHANGES_MAX - read), viewer });
      if (!r || r.ok === false || r.since_invalid === true || !Array.isArray(r.changes)) throw failure("following");
      read += r.changes.length;
      for (const c of r.changes) if (c && c.after && c.amendment_held === false) changes.push(c);
      if (r.cursor === null || r.cursor === undefined || r.changes.length === 0) break;
      after = r.cursor;
    }
    if (!changes.length) return { items: [], facts: { truncated } };
    const recipientOf = new Map();
    let admins = null;
    const adminsNow = () => {
      if (admins === null) { try { admins = (this.#membership.activeAdmins() || []).map(bare); } catch { throw failure("membership"); } }
      return admins;
    };
    const zone = this.#zone(), today = NoticeProducers.#localDay(now, zone);
    const items = [];
    for (const c of changes) {
      if (!filled(c.standard) || !c.before || !c.after || !filled(c.after.capture)) continue;
      if (!recipientOf.has(c.standard)) {
        let s;
        try { s = this.#standards.standardRead({ id: c.standard, viewer }); } catch { throw failure("standards"); }
        if (!s || s.ok === false) { recipientOf.set(c.standard, null); continue; }
        const declarer = isMachine(s.declared_by) ? null : bare(s.declared_by);
        let active = false;
        try { active = !!declarer && (this.#membership.memberFacts(declarer) || {}).status === "active"; }
        catch { throw failure("membership"); }
        recipientOf.set(c.standard, active ? { rule: "declarer", members: [declarer], cite: s.cite ?? null }
          : { rule: "administrators", members: adminsNow(), cite: s.cite ?? null });
      }
      const to = recipientOf.get(c.standard);
      if (!to || !to.members.includes(me)) continue;
      /* R20 (T47; DEC-198 (3)): the sentences by key, `{date}` the local day of `before.at` (DEC-145 (5)'s sentence) */
      const fills = { policy: to.cite ?? c.standard, date: dayInSentence(NoticeProducers.#localDate(c.before.at, zone), today) };
      const summaryKey = "queue.policy-changed-noticed.summary", detailKey = "queue.policy-changed-noticed.detail";
      items.push({
        id: `FINDING::policy-changed-noticed::${c.watch}::${c.after.capture}`, class: "FINDING", kind: "policy-changed-noticed",
        label: NOTICED_LABEL, by: "the machine's",
        case: this.#homesAt([c.standard], viewer),
        subject: { kind: "standard", id: c.standard, cite: to.cite, address: c.address ?? null, watch: c.watch,
                   before: { capture: c.before.capture, at: c.before.at }, after: { capture: c.after.capture, at: c.after.at } },
        summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills), summary_key: summaryKey, detail_key: detailKey, fills,
        basis: { source: "following.policyChanges", standard: c.standard, watch: c.watch, address: c.address ?? null,
                 before: c.before, after: c.after, amendment_held: false, recipients_rule: to.rule, zone,
                 detail: localize("notice-producers.index.a_difference_between_two_captures", "a difference between two captures of a policy's published copy (following R21), never a finding of the record and never what the change means; it leaves when an amendment is held for it or its recipient disposes of it.") },
        age: ageFrom(c.after.at, now, "no_capture_instant"),
        assignee: null, assignee_role: null,
        recipients: to.members,
        options: this.#optionsOf([c.standard]),
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R14 · a file held after a scan
   * (file-safety R15, R16–R18, R38; N707, N710, DEC-169 (4), K1892, K1913, K1929). The `found` notes
   * `scanFindings` answers this viewer (a capture the viewer may not see is left out by file-safety and never counted
   * here, R7), oldest first; one item per note, to this member while active. (T37; N762, N771, K2175) The read is the
   * window's: `since` the instant SCAN_FINDINGS_DAYS before the call, from the first page, following `cursor` while
   * `truncated`, to at most the bound, never from a cursor kept between reads (file-safety's is null at its end).
   * Its subject is the capture's home (provenance.homeOf); its detail names each finding with its engine, tool and day,
   * in findingKind's words, that the safe view stays open and how the original opens again. It names no member and is
   * no hint: a scanner's verdict, not the machine's noticing. It leaves when its recipient disposes of it (queue's, by
   * its key), or when `scanFindings` answers its note `held: false` (no open hold covers that finding any longer, read
   * in file-safety's same synchronous call): only a note inside the window is read, so only there can it leave on
   * `held`. A note past the window is not read, so its item is no longer answered: the window is the item's life (K2238,
   * as R13's window; queue keeps no item, only dispositions). */
  #scanFound(me, viewer, now) {
    if (!this.#active(me)) return { items: [], facts: {} };
    const since = now - SCAN_FINDINGS_DAYS * DAY_MS;       /* an instant, in ms (file-safety R15: notes at or after it) */
    const found = [];
    let after = null, read = 0, truncated = false;
    for (;;) {
      if (read >= SCAN_FINDINGS_MAX) { truncated = true; break; }
      const r = this.#fileSafety.scanFindings({ since, after, limit: Math.min(FILE_SAFETY_PAGE, SCAN_FINDINGS_MAX - read), viewer });
      if (!r || r.ok !== true || r.since_invalid === true || !Array.isArray(r.findings)) throw failure("file-safety");
      read += r.findings.length;
      found.push(...r.findings);
      if (r.truncated !== true || r.cursor === null || r.cursor === undefined || r.cursor === after) break;
      after = r.cursor;
    }
    const zone = this.#zone(), today = NoticeProducers.#localDay(now, zone);
    const items = [];
    for (const f of found) {
      if (!f || !filled(f.captureSha) || !filled(f.note_id)) continue;
      if (f.held === false) continue;                       /* no open hold covers it any longer: it leaves (N771) */
      let home = null, path = null;
      try { const h = this.#provenance.homeOf(f.captureSha); home = h && filled(h.bundleId) ? h.bundleId : null; path = h && filled(h.path) ? h.path : null; }
      catch { throw failure("provenance"); }
      const names = (Array.isArray(f.findings) ? f.findings : []).filter(filled);
      const explained = names.map((n) => ({ name: n, ...findingKind(n) }));
      /* R20 (T47; DEC-198 (3)): the sentences by key; `{document}` the title of the document the file is held in (its home,
         as this viewer sees it), else its registered path's last part (provenance R11), else the capture; `{engine}` the engine, else the tool, as named (a name is data); `{meanings}` each name in findingKind's words (its
         R38), named before its words when there are several; `{date}` the note's local day */
      const meanings = explained.map((k) => (explained.length > 1 ? `${k.name}: ` : "") + String(k.words || "").replace(/\.\s*$/, ""));
      const fills = { document: (home && this.#titleOf(home, viewer)) || (path && path.split("/").filter(filled).at(-1)) || f.captureSha,
                      engine: filled(f.engine) ? f.engine : filled(f.tool) ? f.tool : "", names: names.join(", "),
                      meanings: meanings.join("; "), date: dayInSentence(NoticeProducers.#localDate(f.at, zone), today) };
      const summaryKey = "queue.scan-found.summary", detailKey = "queue.scan-found.detail";
      items.push({
        id: `FINDING::scan-found::${f.captureSha}::${f.note_id}`, class: "FINDING", kind: "scan-found",
        by: "a scanner's",
        case: home ? this.#homesAt([home], viewer) : this.#homesOf([]),
        subject: { kind: "capture_home", id: home, capture: f.captureSha, note: f.note_id },
        summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills), summary_key: summaryKey, detail_key: detailKey, fills,
        basis: { source: "file-safety.scanFindings", capture: f.captureSha, note: f.note_id, tool: f.tool ?? null,
                 engine: f.engine ?? null, at: f.at ?? null, findings: explained, home, zone,
                 detail: localize("notice-producers.index.a_scanners_found_note_file", "a scanner's `found` note (file-safety R15) places a scan hold (its R16): the original does not open, the safe view stays; two members' releases (its R17) or a second engine's clean check of a hold the built-in scanner alone placed (its R18) open it again.") },
        age: ageFrom(f.at, now, "no_scan_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf(home ? [home] : []),
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R15 · a security tool switched off
   * (file-safety R27, R29, R31; K1929). To an active administrator alone: the events `securityToolEvents` answers
   * under the administrator's own viewer, following its cursor to at most the bound; one item per event that switched
   * a tool off (`PRIVATE_MODE_NOT_HONOURED`), until the tool is on again (a passed test since, or `securityTools`
   * answering it `on`). It names the tool, never a file or a member. */
  #toolsOff(me, viewer, now) {
    let admins;
    try { admins = (this.#membership.activeAdmins() || []).map(bare); } catch { throw failure("membership"); }
    if (!admins.includes(me)) return { items: [], facts: {} };
    const events = [];
    let after = null, read = 0, truncated = false;
    for (;;) {
      if (read >= TOOL_EVENTS_MAX) { truncated = true; break; }
      const r = this.#fileSafety.securityToolEvents({ after, limit: Math.min(FILE_SAFETY_PAGE, TOOL_EVENTS_MAX - read), viewer });
      if (!r || r.ok !== true || !Array.isArray(r.events)) throw failure("file-safety");
      read += r.events.length;
      events.push(...r.events);
      if (r.truncated !== true || r.cursor === null || r.cursor === undefined || r.cursor === after) break;
      after = r.cursor;
    }
    const offs = events.map((e, i) => ({ e, i })).filter(({ e }) => e && e.event === TOOL_SWITCHED_OFF && filled(e.tool_id) && filled(e.at));
    if (!offs.length) return { items: [], facts: { truncated } };
    const t = this.#fileSafety.securityTools({ viewer });
    if (!t || t.ok !== true || !Array.isArray(t.tools)) throw failure("file-safety");
    const tools = new Map(t.tools.filter((x) => x && filled(x.tool_id)).map((x) => [x.tool_id, x]));
    const zone = this.#zone();
    const items = [];
    for (const { e, i } of offs) {
      const tool = tools.get(e.tool_id);
      if (tool && tool.state === "on") continue;
      if (events.slice(i + 1).some((x) => x && x.tool_id === e.tool_id && x.event === TOOL_TEST_PASSED)) continue;
      const name = tool && filled(tool.provider_id) ? `${tool.provider_id} (${e.tool_id})` : e.tool_id;
      /* R20 (T47; DEC-198 (3)): the sentences by key, `{tool}` the tool as named here */
      const fills = { tool: name };
      const summaryKey = "queue.security-tool-off.summary", detailKey = "queue.security-tool-off.detail";
      items.push({
        id: `FINDING::security-tool-off::${e.tool_id}::${e.at}`, class: "FINDING", kind: "security-tool-off",
        by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: this.#homesOf([]),
        subject: { kind: "civicsmith", id: null, tool: e.tool_id, provider: tool ? tool.provider_id ?? null : null },
        summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills), summary_key: summaryKey, detail_key: detailKey, fills,
        basis: { source: "file-safety.securityToolEvents", tool: e.tool_id, event: e.event, at: e.at,
                 off_reason: tool ? tool.off_reason ?? null : null, state: tool ? tool.state ?? null : null, zone,
                 detail: localize("notice-producers.index.a_tool_answering_private_mode", "a tool answering PRIVATE_MODE_NOT_HONOURED is switched off (file-safety R31) and is used again only once an administrator's test passes (its R29).") },
        age: ageFrom(e.at, now, "no_event_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf([]),
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R16 · the AI accounts' items
   * (ai-use R5, R9; credentials R59; B7, K2353, K2376, K2488; DEC-188 (6), (7); DEC-189 (5), (6); N856). Each read is the
   * viewer's own: ai-use and credentials answer only the accounts and projects the viewer owns, so each item goes to this
   * member alone. Each is keyed by its source's own stable key, read as given and never composed here (K2488), so `queue`
   * mints it once per account, limit and period. Its sentence and every fill are `words.json`'s, by key (`words.mjs`):
   * it names whose account, which use and the period's end, and never a member. A read answering `unreadable` is its
   * provider's failure (R1), never read as no item. */
  #exploreAsks(me, viewer, now) {
    const r = this.#aiUse.exploreAsksPending({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || r.unreadable === true || !Array.isArray(r.asks)) throw failure("ai-use");
    const { list, truncated } = cut(r.asks.filter((a) => a && filled(a.key) && filled(a.owner)), ACCOUNT_ITEMS_MAX);
    const items = list.map((a) => {
      const o = this.#owner(a.owner, viewer);
      const what = Array.isArray(a.what) ? a.what.filter(filled).join("; ") : filled(a.what) ? a.what : "";
      /* `{scope}`: the group's or a member's own words, or the project's name; `{account}` the account's inline words */
      const fills = { scope: o.kind === "project" ? o.name : wordsOf(`ai.scope.${o.kind}`), what,
                      account: wordsOf(`ai.account.${o.kind}.inline`) };
      const text = wordsOf("ai.queue.exploreask", fills);
      return {
        id: keyed("FINDING", "explore-ask", a.key), class: "FINDING", kind: "explore-ask",
        label: ASK_LABEL, by: "the assistant's",
        case: o.project ? this.#homesAt([o.project], viewer) : this.#homesOf([]),
        subject: { kind: "ai_account", id: o.ref, day: a.day ?? null, questions: Array.isArray(a.what) ? [...a.what] : [] },
        summary: text, detail: text, word: "ai.queue.exploreask", fills,
        basis: { source: "ai-use.exploreAsksPending", key: a.key, owner: o.ref, day: a.day ?? null, asked_at: a.asked_at ?? null,
                 estimate: a.estimate ?? null,
                 detail: localize("notice-producers.index.an_accounts_ask_is_ai_uses", "an account's Ask is ai-use's (its R9): at most one a local day, answered to that account's owners; silence means no.") },
        age: ageFrom(a.asked_at, now, "no_ask_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [EXPLORE_APPROVE, ...this.#optionsOf(o.project ? [o.project] : [])],
      };
    });
    return { items, facts: { truncated } };
  }

  /* The "Noticed" item for a limit reached reads its sentence by the limit's scope (DEC-189 (5)): a use's
     `ai.queue.limitreached`, the overall limit's `.overall`, the per-member limit's `.member`; a use with no
     `ai.use.<use>.inline` key reads `.overall` (J1 (3), as K2720 for ai-use). An entry whose period, day or period end
     cannot be read is no item: ai-use R5 answers each (R3's unjudged refusal is never listed: it reached nothing). */
  #limitsReached(me, viewer, now) {
    const r = this.#aiUse.limitsReached({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || r.unreadable === true || !Array.isArray(r.reached)) throw failure("ai-use");
    const zone = this.#zone();
    const today = NoticeProducers.#localDay(now, zone);
    const ok = [];
    for (const e of r.reached) {
      if (!e || !filled(e.key) || !filled(e.owner) || !filled(e.scope) || !LIMIT_PERIODS.includes(e.period)) continue;
      const day = NoticeProducers.#localDay(e.reached_at, zone);
      const when = NoticeProducers.#periodEnd(e.period, e.period_start, day);
      const date = dayInSentence(day, today);
      if (when && date) ok.push({ e, when, date });
    }
    const { list, truncated } = cut(ok, ACCOUNT_ITEMS_MAX);
    const items = list.map(({ e, when, date }) => {
      const o = this.#owner(e.owner, viewer);
      const use = e.scope !== "overall" && e.scope !== "per_member" && hasWords(`ai.use.${e.scope}.inline`) ? e.scope : null;
      const word = e.scope === "per_member" ? "ai.queue.limitreached.member" : use ? "ai.queue.limitreached" : "ai.queue.limitreached.overall";
      const fills = { account: wordsOf(`ai.account.${o.kind}`, { project: o.name }), period: wordsOf(`ai.period.${e.period}`),
                      ...(use ? { use: wordsOf(`ai.use.${use}.inline`) } : {}), date, when };
      const text = wordsOf(word, fills);
      return {
        id: keyed("FINDING", "ai-limit-reached", e.key), class: "FINDING", kind: "ai-limit-reached",
        label: NOTICED_LABEL, by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: o.project ? this.#homesAt([o.project], viewer) : this.#homesOf([]),
        subject: { kind: "ai_account", id: o.ref, scope: e.scope, unit: e.unit ?? null, period: e.period, period_start: e.period_start ?? null },
        summary: text, detail: text, word, fills,
        basis: { source: "ai-use.limitsReached", key: e.key, owner: o.ref, scope: e.scope, unit: e.unit ?? null, period: e.period,
                 period_start: e.period_start ?? null, reached_at: e.reached_at ?? null, zone,
                 detail: localize("notice-producers.index.a_limit_first_reached_in", "a limit first reached in its current period is ai-use's (its R5), answered to that account's owners; it is told once a period, and names no member.") },
        age: ageFrom(e.reached_at, now, "no_reached_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf(o.project ? [o.project] : []),
      };
    });
    return { items, facts: { truncated } };
  }

  #accountsSuspended(me, viewer, now) {
    /* (T48; N996 §5) read from ai-accounts (its R13), which took the account reads from credentials */
    const r = this.#aiAccounts.projectAccountsSuspended({ viewer, at: instantOf(now) });
    if (!Array.isArray(r)) throw failure("ai-accounts");
    const { list, truncated } = cut(r.filter((e) => e && filled(e.key) && filled(e.project)), ACCOUNT_ITEMS_MAX);
    const items = list.map((e) => {
      const fills = { project: this.#titleOf(e.project, viewer) ?? e.project };
      const text = wordsOf("ai.queue.suspended", fills);
      return {
        id: keyed("FINDING", "project-account-suspended", e.key), class: "FINDING", kind: "project-account-suspended",
        label: NOTICED_LABEL, by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: this.#homesAt([e.project], viewer),
        subject: { kind: "project", id: e.project, since: e.since ?? null },
        summary: text, detail: text, word: "ai.queue.suspended", fills,
        basis: { source: "ai-accounts.projectAccountsSuspended", key: e.key, project: e.project, since: e.since ?? null,
                 detail: localize("notice-producers.index.a_projects_sign_in_account", "a project's sign-in account serves only while the project has one member (ai-accounts R13); answered to the project's owners, naming no member.") },
        age: ageFrom(e.since, now, "no_suspension_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf([e.project]),
      };
    });
    return { items, facts: { truncated } };
  }

  /** R16, R17: an AI account's owner (ai-use's `group`, `project:<id>` or `member:<id>`) as its words name it: `kind`
   *  `group`, `project` or `own` (the `ai.account.*` and `ai.scope.*` keys' last part), `name` a project's name (its
   *  bundle's title when this viewer sees it, else its id), `ref` naming it in an item without naming a member, and
   *  `owner`, R17's `{owner}`: the group's words, the project's name, or "your own account" (only its owner is told). */
  #owner(owner, viewer) {
    const s = typeof owner === "string" ? owner.trim() : "";
    if (s === "group") return { kind: "group", ref: "group", project: null, name: null, owner: wordsOf("ai.owner.group") };
    const p = /^project:(.+)$/.exec(s);
    if (p) {
      const name = this.#titleOf(p[1], viewer) ?? p[1];
      return { kind: "project", ref: `project:${p[1]}`, project: p[1], name, owner: name };
    }
    return { kind: "own", ref: "own", project: null, name: null, owner: wordsOf("ai.account.own.inline") };
  }

  /** A bundle's title (a project's name, a question's or a case's) when this viewer sees it, else null. */
  #titleOf(id, viewer) {
    if (!filled(id)) return null;
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return null;
    const row = this.#rows(`SELECT b.title FROM bundles b WHERE b.bundle_id=? AND (${gate.scope === "member" ? "1=1" : gate.sql})`,
      id, ...(gate.scope === "member" ? [] : gate.args))[0];
    return row && filled(row.title) ? row.title : null;
  }

  /** R16's `{when}` after "until" (DEC-192 (5)): a day's limit `ai.until.day`; a month's `ai.until.month` with `{month}`
   *  the next period's month from `date.month.*` ("… pause until 1 November"), the period read from `period_start`, else
   *  the local day it was reached; null when neither is read. */
  static #periodEnd(period, start, day) {
    if (period === "day") return untilWords("day");
    const from = dayOf(start) ?? dayOf(day);
    const m = from ? Number(from.slice(5, 7)) : NaN;
    return Number.isInteger(m) && m >= 1 && m <= 12 ? untilWords(period, (m % 12) + 1) : null;
  }

  /* ================================================================== R17 · the investigation's items
   * (N820; K2405, K2417, K2418, K2484, K2525; DEC-189 (2), (7); N856). Each source answers this viewer its own items,
   * each with a stable key, told once (DEC-94): the item is keyed `<CLASS>::<kind>::<the source's key>`, the key as given
   * (review's already has that form and is used whole). Its `summary` and `detail` are `queue.<kind>.summary|detail`,
   * by key, their placeholders filled from the source's own facts (J1 (4)–(6)). A source that throws or refuses
   * contributes no item and is named in `facts.failed`; a source answering more than the bound is cut, `truncated`
   * stated (as R13's). */
  #questionFinds(me, viewer, now) {
    const r = this.#questionExplorer.findsFor({ viewer, at: instantOf(now), limit: INVESTIGATION_ITEMS_MAX });
    if (!r || r.ok !== true || !Array.isArray(r.finds)) throw failure("question-explorer");
    const c = cut(r.finds.filter((f) => f && filled(f.key) && filled(f.question)), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((f) => {
      /* D64 (K2484; DEC-189 (7)): which account paid is answered only to its owners (question-explorer R5): only then the
         label names it, `{owner}` from ai-use R6's `enabled_by`; every other viewer's label names no account or person */
      const owned = filled(f.enabled_by);
      const word = owned ? "ai.label.explored" : "ai.label.explored.member";
      const label = wordsOf(word, owned ? { owner: this.#owner(f.enabled_by, viewer).owner } : {});
      return this.#r17Item(me, viewer, now, "FINDING", "question-find", f.key, {
        homes: [f.question], at: f.at, extra: { label, word, mark: HINT_MARK, by: "the system's" },
        fills: { question: this.#titleOf(f.question, viewer) ?? f.question, what: filled(f.how) ? f.how : f.ref ?? f.find ?? "" },
        subject: { kind: "explore_find", id: f.find ?? null, question: f.question, ref: f.ref ?? null, find_kind: f.kind ?? null },
        basis: { source: "question-explorer.findsFor", key: f.key, find: f.find ?? null, question: f.question,
                 bearing: f.bearing ?? null, how: f.how ?? null, false_alarm_rate: f.false_alarm_rate ?? null,
                 gold_set: f.gold_set ?? null, ...(owned ? { enabled_by: f.enabled_by } : {}),
                 detail: localize("notice-producers.index.a_find_is_the_systems", "a find is the system's work (question-explorer R5), offered once to each of the question's recipients who may see it; it is not evidence until a member takes it in.") },
        options: [f.question],
      });
    });
    return { items, facts: { truncated: c.truncated || r.truncated === true } };
  }

  #laterFound(me, viewer, now) {
    const r = this.#steps.laterFound({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || !Array.isArray(r.found)) throw failure("steps");
    const c = cut(r.found.filter((e) => e && filled(e.key) && filled(e.step)), INVESTIGATION_ITEMS_MAX);
    const zone = this.#zone(), today = NoticeProducers.#localDay(now, zone);
    const items = c.list.map((e) => {
      const qs = Array.isArray(e.questions) ? e.questions.filter(filled) : [];
      /* J1 (4): `{date}` the look's own local day (`looked_at`, steps R23), else the entry's (`at`) */
      return this.#r17Item(me, viewer, now, "FINDING", "step-later-found", e.key, {
        homes: qs, at: e.at,
        fills: { what: this.#workOf(e.step, viewer), date: dayInSentence(NoticeProducers.#localDay(filled(e.looked_at) ? e.looked_at : e.at, zone), today) },
        subject: { kind: "step", id: e.step, look: e.look ?? null, observation: e.observation ?? null, questions: qs },
        basis: { source: "steps.laterFound", key: e.key, step: e.step, look: e.look ?? null, observation: e.observation ?? null,
                 looked_at: e.looked_at ?? null, at: e.at ?? null,
                 detail: localize("notice-producers.index.a_later_arrival_is_steps", "a later arrival is steps' (its R23): told once to each recipient of a referring question who may see the step and what arrived, and to the member who did the step; no outcome moves by itself.") },
      });
    });
    return { items, facts: { truncated: c.truncated } };
  }

  #stepsDue(me, viewer, now) {
    const r = this.#steps.stepsDue({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || !Array.isArray(r.due)) throw failure("steps");
    const today = NoticeProducers.#localDay(now, this.#zone());
    const c = cut(r.due.filter((e) => e && filled(e.key) && filled(e.step) && (e.kind === "past_date" || e.kind === "reminder")), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((e) => {
      const reminder = e.kind === "reminder";
      return this.#r17Item(me, viewer, now, "OBLIGATION", reminder ? "step-reminder" : "step-date-due", e.key, {
        homes: [], due: dayOf(e.date), day: dayOf(e.date),
        fills: { step: filled(e.work) ? e.work : this.#workOf(e.step, viewer), date: dayInSentence(dayOf(e.date), today) },
        subject: { kind: "step", id: e.step, work: e.work ?? null, date: e.date ?? null },
        basis: { source: "steps.stepsDue", key: e.key, step: e.step, kind: e.kind, date: e.date ?? null,
                 detail: localize("notice-producers.index.a_steps_date_and_a", "a step's date and a reminder are steps' (its R12): told once, to the member who set the date or asked for the reminder, and to nobody else.") },
      });
    });
    /* R19 (T46; steps R12): `stepsDue` read its 1,000 dated steps or 1,000 reminders: a bound reached is never silent */
    return { items, facts: { truncated: c.truncated || r.truncated === true, ...(r.undetermined === true ? { undetermined: r.why ?? true } : {}) } };
  }

  #costShares(me, viewer, now) {
    const r = this.#steps.costShares({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || !Array.isArray(r.shares)) throw failure("steps");
    const c = cut(r.shares.filter((e) => e && filled(e.key) && filled(e.step)), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((e) => {
      const projects = Array.isArray(e.projects) ? e.projects.filter((p) => p && filled(p.id)) : [];
      const totals = e.totals && typeof e.totals === "object" ? e.totals : {};
      return this.#r17Item(me, viewer, now, "FINDING", "step-cost-shared", e.key, {
        homes: projects.map((p) => p.id),
        fills: { step: this.#workOf(e.step, viewer), totals: Object.entries(totals).map(([cur, amt]) => `${amt} ${cur}`).join(", "),
                 projects: projects.map((p) => p.name ?? p.id).join(", ") },
        subject: { kind: "step", id: e.step, totals, projects: projects.map((p) => ({ id: p.id, name: p.name ?? null })) },
        basis: { source: "steps.costShares", key: e.key, step: e.step, totals, projects: projects.map((p) => p.id),
                 detail: localize("notice-producers.index.a_shared_cost_is_steps", "a shared cost is steps' (its R14): answered to each owner of each sharing project only, never when any of them is hidden; told once per step, totals and project set.") },
      });
    });
    return { items, facts: { truncated: c.truncated } };
  }

  #costMessages(me, viewer, now) {
    const r = this.#steps.costMessages({ viewer });
    if (!r || r.ok !== true || !Array.isArray(r.messages)) throw failure("steps");
    const ok = r.messages.filter((m) => m && (Number.isSafeInteger(m.message) || filled(m.message)) && filled(m.step));
    const c = cut(ok, INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((m) => this.#r17Item(me, viewer, now, "FINDING", "step-cost-message", String(m.message), {
      homes: [], at: m.at,
      fills: { step: this.#workOf(m.step, viewer), member: m.writer ?? null, text: m.text ?? "" },
      subject: { kind: "step", id: m.step, message: m.message },
      basis: { source: "steps.costMessages", key: String(m.message), step: m.step, message: m.message,
               detail: localize("notice-producers.index.a_cost_message_is_steps", "a cost message is steps' (its R15): relayed once to the owners of each other sharing project, with its writer's handle, naming no project unless its writer did.") },
    }));
    return { items, facts: { truncated: c.truncated } };
  }

  #milestones(me, viewer, now) {
    const r = this.#investigation.milestonesOverdue({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || !Array.isArray(r.due)) throw failure("investigation");
    const today = NoticeProducers.#localDay(now, this.#zone());
    const c = cut(r.due.filter((e) => e && filled(e.key) && (e.kind === "overdue" || e.kind === "reminder")), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((e) => {
      const reminder = e.kind === "reminder";
      return this.#r17Item(me, viewer, now, reminder ? "OBLIGATION" : "FINDING", reminder ? "milestone-reminder" : "milestone-overdue", e.key, {
        homes: filled(e.project) ? [e.project] : [], due: dayOf(e.date), day: dayOf(e.date),
        fills: { milestone: filled(e.name) ? e.name : String(e.milestone ?? ""), date: dayInSentence(dayOf(e.date), today) },
        subject: { kind: "milestone", id: e.milestone ?? null, project: e.project ?? null, name: e.name ?? null, date: e.date ?? null },
        basis: { source: "investigation.milestonesOverdue", key: e.key, kind: e.kind, milestone: e.milestone ?? null,
                 project: e.project ?? null, date: e.date ?? null, state: e.state ?? null,
                 detail: localize("notice-producers.index.a_milestone_overdue_is_investigations", "a milestone overdue is investigation's (its R3): told once to each joined participant; a reminder to the member who asked, on its day, and to nobody else.") },
      });
    });
    return { items, facts: { truncated: c.truncated, ...(r.undetermined === true ? { undetermined: r.why ?? true } : {}) } };
  }

  #quietPrompts(me, viewer, now) {
    const r = this.#investigation.quietPrompts({ viewer, at: instantOf(now) });
    if (!r || r.ok !== true || !Array.isArray(r.prompts)) throw failure("investigation");
    const c = cut(r.prompts.filter((e) => e && filled(e.key) && filled(e.project)), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((e) => {
      const gaps = Array.isArray(e.gaps) ? e.gaps : [];
      /* J1 (5): `{progress}` the source's own words: the objective, then each gap as it says itself */
      const says = gaps.map((g) => (g && g.basis && filled(g.basis.says) ? g.basis.says : null)).filter(filled);
      return this.#r17Item(me, viewer, now, "FINDING", "project-quiet", e.key, {
        homes: [e.project],
        fills: { project: this.#titleOf(e.project, viewer) ?? e.project, progress: [e.objective, ...says].filter(filled).join("; ") },
        subject: { kind: "project", id: e.project, spell: e.spell ?? null, objective: e.objective ?? null,
                   condition: e.condition ?? null, gaps, doors: Array.isArray(e.doors) ? [...e.doors] : [] },
        basis: { source: "investigation.quietPrompts", key: e.key, project: e.project, spell: e.spell ?? null,
                 progress: e.progress ?? null,
                 detail: localize("notice-producers.index.a_quiet_spell_is_investigations", "a quiet spell is investigation's (its R18): told once per spell to the project's joined participants; no member act declares the objective met.") },
      });
    });
    return { items, facts: { truncated: c.truncated } };
  }

  #reviewLeftOut(me, viewer, now) {
    const r = this.#review.reviewCommentsLeftOut({ viewer, limit: INVESTIGATION_ITEMS_MAX });
    if (!r || r.ok !== true || !Array.isArray(r.items)) throw failure("review");
    const c = cut(r.items.filter((e) => e && filled(e.key) && filled(e.case)), INVESTIGATION_ITEMS_MAX);
    const items = c.list.map((e) => this.#r17Item(me, viewer, now, "FINDING", "review-comment-left-out", e.key, {
      homes: filled(e.project) ? [e.project] : [],
      fills: { case: this.#titleOf(e.case, viewer) ?? e.case },
      subject: { kind: "case", id: e.case, edition: e.edition ?? null, comments: Array.isArray(e.comments) ? [...e.comments] : [] },
      basis: { source: "review.reviewCommentsLeftOut", key: e.key, case: e.case, edition: e.edition ?? null, left_out: e.left_out ?? null,
               detail: localize("notice-producers.index.a_reviewers_comments_left_out", "a reviewer's comments left out are review's (its R33): told once to each member reviewer, who may file a response in the case's docket.") },
    }));
    return { items, facts: { truncated: c.truncated || r.truncated === true } };
  }

  /** R17: one item of `kind`, keyed by its source's key, to this member alone (each source answers the viewer's own), its
   *  summary and detail `queue.<kind>.summary|detail` with `fills`. `options` names the subjects queue's options are asked
   *  for (the subject's own id when not given). */
  #r17Item(me, viewer, now, cls, kind, key, { homes = [], due = null, day = null, at = null, extra = {}, fills, subject, basis, options = null }) {
    return {
      id: keyed(cls, kind, key), class: cls, kind, ...extra,
      case: homes.length ? this.#homesAt(homes, viewer) : this.#homesOf([]),
      ...(due ? { due } : {}),
      subject,
      summary: wordsOf(`queue.${kind}.summary`, fills), detail: wordsOf(`queue.${kind}.detail`, fills), fills,
      basis,
      age: day ? ageFrom(day, now, "no_due_day", this.#zone()) : ageFrom(at, now, "no_source_instant"),
      assignee: null, assignee_role: null,
      recipients: [me],
      options: this.#optionsOf((options ?? [subject.id]).filter(filled)),
    };
  }

  /** R17: a step's work as steps answers it this viewer (`step`, its R4), else the step's id (J1 (4)); one read per step
   *  in a read of `noticeItems`. A read that throws is steps' failure. */
  #workOf(step, viewer) {
    if (!this.#works) this.#works = new Map();
    if (!this.#works.has(step)) {
      let s = null;
      if (typeof this.#steps.step === "function") { try { s = this.#steps.step({ step, viewer }); } catch { throw failure("steps"); } }
      this.#works.set(step, s && s.ok !== false && filled(s.work) ? s.work : step);
    }
    return this.#works.get(step);
  }

  /* ================================================================== R24 · a watched item that changed
   * (retrieval R85; following R32, R35; queue R57; N1204, DEC-238 (S23 "A"), K3635). The items `retrieval.browse` lists as the
   * viewer's own watches (`only: "watched"`), following `next` to at most WATCHED_ITEMS_MAX; for each, the instant this member's
   * mark was last set is her entry in `following.watchedBy(item)`, and the item is told only when its `last_changed` is later.
   * Keyed by the item and that change, so the same change read again is the same item (queue mints it once). It goes to this
   * member alone: no other member's mark is read for her, and it says nothing of what changed. An entity's `last_changed` is its
   * creation instant, never later than a mark set on it, so none is told. A browse or watchedBy that throws, or answers
   * `undetermined`, is its provider's failure (R1). */
  #watchedChanged(me, viewer, now) {
    const watched = [];
    let after = null, truncated = false;
    for (;;) {
      if (watched.length >= WATCHED_ITEMS_MAX) { truncated = true; break; }
      let r;
      try { r = this.#retrieval.browse({ only: "watched", viewer, limit: Math.min(WATCHED_PAGE, WATCHED_ITEMS_MAX - watched.length), ...(after ? { after } : {}) }); }
      catch { throw failure("retrieval"); }
      if (!r || r.ok !== true || r.undetermined || !Array.isArray(r.items)) throw failure("retrieval");
      watched.push(...r.items);
      if (r.truncated !== true || !r.next || r.next === after) break;
      after = r.next;
    }
    const zone = this.#zone(), today = NoticeProducers.#localDay(now, zone);
    const items = [];
    for (const w of watched) {
      if (!w || !filled(w.id) || !filled(w.last_changed)) continue;
      const changed = INSTANT.test(w.last_changed) ? Date.parse(w.last_changed) : NaN;
      if (!Number.isFinite(changed)) continue;
      let who;
      try { who = this.#following.watchedBy(w.id); } catch { throw failure("following"); }
      if (!who || who.ok !== true || who.undetermined || !Array.isArray(who.watchers)) throw failure("following");
      const mark = who.watchers.find((x) => x && bare(x.member) === me);
      const set = mark && typeof mark.at === "string" && INSTANT.test(mark.at) ? Date.parse(mark.at) : NaN;
      if (!Number.isFinite(set) || !(changed > set)) continue;
      const fills = { what: filled(w.title) ? w.title : w.id, date: dayInSentence(NoticeProducers.#localDate(w.last_changed, zone), today) };
      const summaryKey = "queue.watched-changed.summary", detailKey = "queue.watched-changed.detail";
      items.push({
        id: `FINDING::watched-changed::${w.id}::${w.last_changed}`, class: "FINDING", kind: "watched-changed",
        label: NOTICED_LABEL, by: "the machine's",
        case: this.#homesAt([w.id], viewer),
        subject: { kind: w.kind ?? null, id: w.id, title: w.title ?? null, last_changed: w.last_changed },
        summary: wordsOf(summaryKey, fills), detail: wordsOf(detailKey, fills), summary_key: summaryKey, detail_key: detailKey, fills,
        basis: { source: "retrieval.browse", item: w.id, last_changed: w.last_changed, marked_at: mark.at, zone,
                 detail: localize("notice-producers.index.a_watched_items_last_change", "a watched item's last change is retrieval's (its R85), later than the instant this member's own watch mark was set (following R35); told once per change, to her alone, and it says nothing of what changed.") },
        age: ageFrom(w.last_changed, now, "no_change_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf([w.id]),
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R27 · a large capture's fetch was delivered
   * (capture's `fetchesDone`, its `fetch_done` records: {session, document, opener, project, at}, written when a background fetch is filed;
   * G2, K4562: the member "is told when the download completes"). One FINDING per record, to its opener alone while that
   * member is active, keyed by the session so queue mints it once and later cycles answer the same item. The read is the
   * window's, as R14's: `since` 90 days, from the first page, following `cursor` to at most the bound. Its
   * subject is the document, its home set the record's project; it names no other member and says nothing of the page. */
  #fetchDone(me, viewer, now) {
    if (!this.#active(me)) return { items: [], facts: {} };
    const since = now - FETCH_DONE_DAYS * DAY_MS;
    const done = [];
    let after = null, read = 0, truncated = false;
    for (;;) {
      if (read >= FETCH_DONE_MAX) { truncated = true; break; }
      const r = this.#capture.fetchesDone({ after, limit: Math.min(FETCH_DONE_PAGE, FETCH_DONE_MAX - read) });
      if (!r || r.ok !== true || !Array.isArray(r.fetches)) throw failure("capture");
      read += r.fetches.length;
      done.push(...r.fetches);
      if (r.truncated !== true || r.next === null || r.next === undefined || r.next === after) break;
      after = r.next;
    }
    const items = [];
    const seen = new Set();
    for (const f of done) {
      if (!f || !filled(f.session) || !filled(f.document) || bare(f.opener) !== me || seen.has(f.session)) continue;
      const when = Date.parse(f.at);
      if (!(Number.isFinite(when) && when >= since)) continue;      /* the window is the item's life, as R14's */
      seen.add(f.session);
      const fills = { document: this.#titleOf(f.document, viewer) ?? f.document };
      items.push({
        id: `FINDING::fetch-done::${f.session}`, class: "FINDING", kind: "fetch-done",
        label: NOTICED_LABEL, by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: filled(f.project) ? this.#homesAt([f.project], viewer) : this.#homesOf([]),
        subject: { kind: "document", id: f.document, session: f.session, project: f.project ?? null },
        summary: localize("notice-producers.index.fetch_done_summary", "{document} has been fetched", fills),
        detail: localize("notice-producers.index.fetch_done_detail", "The large page you asked for is fetched and filed. Open it to read it.", {}),
        fills, door: DOOR_OPEN_DOCUMENT,
        basis: { source: "capture.fetchesDone", session: f.session, document: f.document, project: f.project ?? null, at: f.at ?? null,
                 detail: localize("notice-producers.index.a_fetch_done_record_is", "a fetch-done record is capture's: written once when a large capture's background fetch is filed; told once, to the member who asked, and to nobody else.") },
        age: ageFrom(f.at, now, "no_fetch_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [...this.#optionsOf([f.document])],
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R28 · a background ingest finished or was stopped
   * (calculations' `ingestNotices`, G55; K4562: the member who ingested a table over the inline threshold "is told when it is
   * done"). One FINDING per ingest `calculations` answers this viewer as `done` or `stopped` (only the viewer's own ingests it
   * sees; it names no other member), to the viewer alone while active, keyed `FINDING::ingest-done::<ingest>` or
   * `FINDING::ingest-stopped::<ingest>` so queue mints it once and a later cycle answers the same item. Its order is the order
   * the ingests were started, not finished, so no `next` is kept between cycles: each read starts at `after` 0 and pages by `next`
   * to at most the bound. The window is 90 days of `finished_at`. A stopped ingest adds the reason's `says`. */
  #ingestNotices(me, viewer, now) {
    if (!this.#active(me)) return { items: [], facts: {} };
    const since = now - INGEST_NOTICE_DAYS * DAY_MS;
    const done = [];
    let after = 0, truncated = false;
    for (;;) {
      if (done.length >= INGEST_NOTICE_MAX) { truncated = true; break; }
      const r = this.#calculations.ingestNotices({ after, limit: Math.min(INGEST_NOTICE_PAGE, INGEST_NOTICE_MAX - done.length), viewer });
      if (!r || r.ok !== true || !Array.isArray(r.items)) throw failure("calculations");
      done.push(...r.items);
      if (r.next === null || r.next === undefined || r.next === after || r.items.length === 0) break;
      after = r.next;
    }
    const items = [];
    const seen = new Set();
    for (const g of done) {
      if (!g || !filled(g.ingest) || !INGEST_STATES.includes(g.state) || seen.has(g.ingest)) continue;
      const when = Date.parse(g.finished_at);
      if (!(Number.isFinite(when) && when >= since)) continue;      /* the window is the item's life, as R27's */
      seen.add(g.ingest);
      const kind = `ingest-${g.state}`;
      const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
      const fills = { written: String(count(g.written_count)), not_written: String(count(g.not_written_count)), rows: String(count(g.rows_total)) };
      const says = g.state === "stopped" && g.stopped && filled(g.stopped.says) ? g.stopped.says.trim() : "";
      const sentence = g.state === "done"
        ? localize("notice-producers.ingest.done", "Your table has been ingested: {written} of {rows} rows were written as money facts, {not_written} were not.", fills)
        : localize("notice-producers.ingest.stopped", "Your table's ingest was stopped after {written} of {rows} rows were written; the rest were not.", fills);
      items.push({
        id: `FINDING::${kind}::${g.ingest}`, class: "FINDING", kind,
        label: NOTICED_LABEL, by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: this.#homesOf([]),
        subject: { kind: "ingest", id: g.ingest, binding: g.binding ?? null, state: g.state },
        summary: sentence,
        detail: says ? `${sentence} ${says}` : sentence,
        fills,
        basis: { source: "calculations.ingestNotices", ingest: g.ingest, binding: g.binding ?? null, state: g.state, finished_at: g.finished_at ?? null,
                 reason: g.state === "stopped" && g.stopped ? g.stopped.reason ?? null : null,
                 detail: localize("notice-producers.index.an_ingests_end_is_calculations", "an ingest's end is calculations' (its R14): told once, to the member who ingested, when a background run is done or was stopped, and to nobody else.") },
        age: ageFrom(g.finished_at, now, "no_ingest_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: this.#optionsOf([]),
      });
    }
    return { items, facts: { truncated } };
  }

  /* ================================================================== R29 · a reading ended or stopped
   * (plane's job table through `deps.readingsEnded({after, limit})`, a callback the composition root injects, R-LAYER; G135f, K4831 (5):
   * the member "is told at finish or stop"). One FINDING per row of the `reading` kind that finished, ended in part (`final`, with its
   * reason) or was refused (with its limit), to the member the row names as its opener alone while active, keyed
   * `FINDING::reading-ended::<sha>::<state>`: a row that goes on after a stop and ends again earns a fresh key. Each cycle reads from the
   * start and pages by `next` to at most the bound; the window is 90 days of `ended_at`. A row still being read has no ended state and
   * is never told. Its subject is the document (its home as provenance gives it), its door "Open the document"; the words are stand-ins
   * keyed through `localize`, the rows owed named in the job record. With no `deps.readingsEnded` it contributes none and names none. */
  #readingsEnded(me, viewer, now) {
    const ended = this.#deps.readingsEnded;
    if (typeof ended !== "function") return { items: [], facts: {} };
    if (!this.#active(me)) return { items: [], facts: {} };
    const since = now - READING_ENDED_DAYS * DAY_MS;
    const rows = [];
    let after = null, truncated = false;
    for (;;) {
      if (rows.length >= READING_ENDED_MAX) { truncated = true; break; }
      const r = ended({ after, limit: Math.min(READING_ENDED_PAGE, READING_ENDED_MAX - rows.length) });
      if (!r || r.ok !== true || !Array.isArray(r.rows)) throw failure("readings");
      rows.push(...r.rows);
      if (r.next === null || r.next === undefined || r.next === after || r.rows.length === 0) break;
      after = r.next;
    }
    const items = [];
    const seen = new Set();
    const count = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
    for (const g of rows) {
      if (!g || g.kind !== READING_JOB_KIND || !filled(g.sha) || !READING_ENDED_STATES.includes(g.state) || bare(g.member) !== me) continue;
      const when = typeof g.ended_at === "number" ? g.ended_at : Date.parse(g.ended_at);
      if (!(Number.isFinite(when) && when >= since)) continue;      /* the window is the item's life, as R27's */
      const id = `FINDING::reading-ended::${g.sha}::${g.state}`;
      if (seen.has(id)) continue;
      seen.add(id);
      let home = null, path = null;
      try { const h = this.#provenance.homeOf(g.sha); home = h && filled(h.bundleId) ? h.bundleId : null; path = h && filled(h.path) ? h.path : null; }
      catch { throw failure("provenance"); }
      const read = count(g.written), total = read + count(g.skipped) + count(g.owed) + count(g.failed);
      const counted = total > 0;
      const fills = { document: (home && this.#titleOf(home, viewer)) || (path && path.split("/").filter(filled).at(-1)) || g.sha,
                      read: String(read), total: String(total), why: filled(g.why) ? g.why.trim() : "" };
      const sentence = g.state === "finished"
        ? (counted ? localize("notice-producers.reading.finished.counted", "{document} has been read: {read} of {total}.", fills)
                   : localize("notice-producers.reading.finished", "{document} has been read.", fills))
        : g.state === "final"
          ? (counted ? localize("notice-producers.reading.partial.counted", "{document} was read in part: {read} of {total}. {why}", fills)
                     : localize("notice-producers.reading.partial", "{document} was read in part. {why}", fills))
          : localize("notice-producers.reading.refused", "{document} was not taken in: {why}", fills);
      items.push({
        id, class: "FINDING", kind: "reading-ended",
        label: NOTICED_LABEL, by: localize("notice-producers.group_civicsmith", "the team's Civicsmith"),
        case: home ? this.#homesAt([home], viewer) : this.#homesOf([]),
        subject: { kind: "document", id: home, sha: g.sha, state: g.state },
        summary: sentence.trim(), detail: sentence.trim(), fills, door: DOOR_OPEN_DOCUMENT,
        basis: { source: "plane.readingsEnded", sha: g.sha, state: g.state, why: g.why ?? null, written: g.written ?? null, skipped: g.skipped ?? null,
                 owed: g.owed ?? null, failed: g.failed ?? null, ended_at: g.ended_at ?? null,
                 detail: localize("notice-producers.index.a_readings_end_is_the", "a reading's end is the job table's (plane R98): told once for each state, to the member it was made for, and to nobody else.") },
        age: ageFrom(typeof g.ended_at === "number" ? new Date(g.ended_at).toISOString() : g.ended_at, now, "no_reading_instant"),
        assignee: null, assignee_role: null,
        recipients: [me],
        options: [...this.#optionsOf(home ? [home] : [])],
      });
    }
    return { items, facts: { truncated } };
  }

  /** R14: whether this member is active (membership's member facts); a membership that throws is its failure. */
  #active(me) {
    try { return (this.#membership.memberFacts(me) || {}).status === "active"; } catch { throw failure("membership"); }
  }

  /** R13–R17: the profile's time zone (the jurisdiction view's), or null when none is held; read once a read of
   *  `noticeItems` (R17 asks it for each dated item). */
  #zone() {
    if (this.#zoneRead === undefined) this.#zoneRead = this.#readZone();
    return this.#zoneRead;
  }
  #readZone() {
    try {
      /* K5292 (jurisdictions R98): the team's governing zone (its stated `team_time_zone`, else the profiles') first */
      const held = (name) => { const row = this.#rows(`SELECT value FROM settings WHERE name=? ORDER BY rowid DESC LIMIT 1`, name)[0]; return row ? JSON.parse(row.value) : null; };
      try { const g = governingZone(held("jurisdiction_profiles"), held("team_time_zone")); if (g && typeof localDay("2026-01-01T00:00:00Z", g) === "string") return g; } catch { /* read the view below */ }
      let view = this.#deps.view;
      if (typeof view === "function") view = view();
      if (!view) {
        const row = this.#rows(`SELECT value FROM settings WHERE name='jurisdiction_profiles' ORDER BY rowid DESC LIMIT 1`)[0];
        const ids = row ? JSON.parse(row.value) : null;
        const c = Array.isArray(ids) && ids.length ? combineProfiles(ids) : null;
        view = c && c.ok ? c.view : null;
      }
      const z = view && view.time_zone && typeof view.time_zone.value === "string" ? view.time_zone.value : null;
      return z && typeof localDay("2026-01-01T00:00:00Z", z) === "string" ? z : null;
    } catch { return null; }
  }

  /** R16, R17: the local day of an instant (ms, or an ISO date-time, its fraction of a second or offset read as the same
   *  instant, since civil-time reads only whole-second UTC) in `zone` (civil-time), the UTC day when none is held; null when
   *  it is no instant (a sentence then says no day, never a word of this module's own). */
  static #localDay(at, zone) {
    const ms = typeof at === "number" ? at : typeof at === "string" && INSTANT.test(at) ? Date.parse(at) : NaN;
    const t = Number.isFinite(ms) ? instantOf(ms) : at;
    try { const d = localDay(t, zone || "UTC"); if (typeof d === "string") return d; } catch { /* below */ }
    return null;
  }

  /** R13, R14, R15: the local day of an instant in `zone`, as `following` reads it; null when it is no instant civil-time
   *  reads (R26: such a day is not written, never as ISO text). */
  static #localDate(at, zone) {
    return NoticeProducers.#localDay(at, zone);
  }

  /** R25 (DEC-299, DEC-333, DEC-335): an instant as a team reads a moment, `time.at` with `{date}` the local day with its
   *  year (`date.daymonthyear`) and `{time}` the local clock (`time.clock`, `time.am`, `time.pm`; civil-time's `localClock`,
   *  R30), in `zone`; with no zone held, the UTC reading and "UTC" after it. Null when the instant cannot be read (never
   *  raw text). */
  static #timeAt(at, zone) {
    const ms = typeof at === "string" && INSTANT.test(at) ? Date.parse(at) : NaN;
    if (!Number.isFinite(ms)) return null;
    const z = filled(zone) ? zone : "UTC";
    const date = dayInSentence(NoticeProducers.#localDay(ms, z), null);
    let wall = null;
    try { wall = localClock(instantOf(ms), z); } catch { wall = null; }
    if (!date || !wall || !Number.isInteger(wall.hour) || !Number.isInteger(wall.minute)) return null;
    const minute = String(wall.minute).padStart(2, "0");
    const clock = wordsOf("time.clock", { hour: String(wall.hour % 12 || 12), minute, ampm: wordsOf(wall.hour < 12 ? "time.am" : "time.pm") });
    const moment = wordsOf("time.at", { date, time: clock });
    return filled(zone) ? moment : `${moment} UTC`;
  }
}

const OF = new WeakMap();

/** The one producers instance for this host's storage (`host`, or the storage itself). It registers nothing. */
export function noticeProducersOf(host, deps = {}) {
  const storage = host && host.storage ? host.storage : host;
  let p = OF.get(storage);
  if (!p) {
    p = new NoticeProducers({ host, storage, deps });
    OF.set(storage, p);
  }
  return p;
}
