/* queue-producers — the feed's producers (requirements: `build/requirements/queue-producers.md`, R1–R51).
 * Split out of `queue` by N363 (Bob's K507; seams ruled K531, `build/plan/draft-N363-queue-split.md` §1, §3.2): each
 * producer derives, on read and writing nothing, the items one provider's facts earn for a viewer, naming each item's
 * subjects and home subjects, for `queue` to home, offer, mint and publish.
 *
 *   feedItems      queue's one read of this module (R8): every item R1, R2, R4–R7, R9, R14, R23, R30–R35, R37–R39, R41, R42 derive
 *                  for a member and viewer, each producer read as a feed of its own (R45: one that cannot be read is named in
 *                  `facts.failed`, one with no provider composed in `facts.absent`, and the others' items stand), every sentence
 *                  of an item read by key through `./words.mjs` (R43: `summary_key`, `detail_key`), every item `machinery-producers.conditionItems` answers (its R1: the
 *                  CONDITIONs about our own machinery, split out by K1850) and every item `action-producers.actionItems`
 *                  answers (its R13: the Action layer's to-dos, was this module's R15–R21, R29, moved by T45, K2781 (1)),
 *                  each homed through queue's walk and carrying queue's options (both passed in),
 *                  with the facts the answer publishes beside them. No item carries `disposition` (queue's mint gives
 *                  it) or `catalogue_id` (queue stamps it from its R2).
 *   proposalFindingItems, CARDINALITY_EXCEEDED   the FINDING producer over `progressions.proposalsFeed` (R2, R10, R11),
 *                  pure, re-exported from `./proposals.mjs`.
 *
 *   registerPlaceArrivals   R38's one door: `instance-setup` registers its `placeArrivals` read here once at start (K31's
 *                  pattern), since it comes later in layer 11.
 *
 *   R46–R48     the `members` feed (T51's fix round, K4169, UC-046): an endorsement owed on a proposed administrator, an owner vote
 *                  owed on a project's owner change, an expertise awaiting confirmation, each carrying its door (`door`, K4210).
 *   R49–R51     one read asks for each kind of fact once (no read per item or per project), a failed feed names its read and
 *                  code, and `facts.ms` says what each feed cost.
 *
 * REACHED as `queueProducersOf(ctx, deps)`: one instance per Durable Object storage. It registers nothing with an earlier
 * module and holds no check row: it refuses nothing a member does (draft §3.3); a second registration at R38's door is a
 * programming error answered to its caller.
 * `deps` (each defaults to its module's instance on the same `ctx`, reached lazily when first asked):
 *   record, membership, credentials, provenance, captureRequests, basisVersions, progressions, aiRuns, bias, publication,
 *   corpusExport, reevaluation, intent, monitoring, contradiction, docket, caseImport, wizardScripts, caseTensions,
 *   publishSchedule, projectRoster   the providers; and `machinery` (machinery-producers, K1850) and `actionProducers` (action-producers,
 *   T45), each built lazily over these same deps, so a dep a caller injects reaches them too (the moved producers' own:
 *   governor, capture, captureRequests, monitoring, linkSweep, networkNotices, actions; and actionClocks, escalation,
 *   actionPlans, actions, actionHolds, filingTemplates, localFacts, following, planWork).
 *
 * R7 (queue's homes walk) and R12 (queue's options) stay in queue, one walk and one derivation: `feedItems` takes them
 * as `homesOf(subjectIds)` and `optionsOf(subjectIds)`, closed over the read's viewer and identity by queue, and holds
 * them for the length of that one synchronous read. `#homesAt` (a case at depth 0) is built over `homesOf`, and both are
 * handed on to `machinery-producers.conditionItems` and `action-producers.actionItems` as they were handed here.
 */

import { normalizeType } from "../record-grammar/types.mjs";
import { STATES, vocabFor } from "../record-grammar/document.mjs";
import { MACHINE_AUTHOR_PREFIX, MACHINE_CLASS_PREFIX } from "../record-grammar/actors.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, hiddenBundles, GATE_MARK } from "../membership/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { captureRequestsOf } from "../capture-requests/index.mjs";
import { basisVersionsOf } from "../basis-versions/index.mjs";
import { progressionsOf } from "../progressions/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { publicationOf } from "../publication/index.mjs";
import { caseTensionsOf } from "../case-tensions/index.mjs";
import { publishScheduleOf } from "../publish-schedule/index.mjs";
import { corpusExportOf, EXPORT_LOG_LIMIT_DEFAULT } from "../corpus-export/index.mjs";
import { reevaluationOf } from "../reevaluation/index.mjs";
import { intentOf } from "../intent/index.mjs";
import { monitoringOf } from "../monitoring/index.mjs";
import { docketOf, DOCKET_UNREADABLE } from "../docket/index.mjs";
import { caseImportOf } from "../case-import/index.mjs";
import { wizardScriptsOf } from "../wizard-scripts/index.mjs";
import { machineryProducersOf, MachineryProducers } from "../machinery-producers/index.mjs";
import { actionProducersOf } from "../action-producers/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { ROOT_ADMIN } from "../member-roster/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { proposalFindingItems } from "./proposals.mjs";
import { say, holds, joined, fillWord, reasonWord, dayText, localDayOf, instantText, setText } from "./words.mjs";

export { proposalFindingItems, CARDINALITY_EXCEEDED } from "./proposals.mjs";

/** R45: why a feed's provider answered no list: `refused` (it refused), `undetermined` (it said it could not tell). A read that
 *  throws is `threw`. Codes, never English. */
class FeedFail extends Error {
  constructor(reason, read = null, code = null) { super(`feed unread: ${reason}`); this.reason = reason; this.read = read; this.code = code; }
}

/** R50: a refusal `contradiction.conflictNotices` answers for a project it tells this viewer nothing about (R7): not a failure. */
const TOLD_NOTHING = Object.freeze(["NOT_A_PARTICIPANT", "NO_SUCH_PROJECT", "PROJECT_SEEN_NOT_A_PARTICIPANT"]);
/** R50: a provider's own code as a code, never a sentence. */
const codeOf = (r) => {
  const c = r && typeof r === "object" ? (typeof r.code === "string" && r.code ? r.code : typeof r.reason === "string" ? r.reason : "") : "";
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(c) ? c : null;
};

/* The walk queue passes in answers this shape; with none passed, an item is ungrouped rather than given a home. */
const UNGROUPED = Object.freeze({ state: "determined", ungrouped: true, reasons: [], depth_bound: null, ancestors: [] });

export class QueueProducers {
  #host; #deps;
  /* The read's two functions from queue (R8), held for one synchronous `feedItems` call and cleared after it. */
  #homesFn = null; #optionsFn = null;
  constructor({ host, storage, deps = {} } = {}) {
    this.#host = host;
    this.sql = storage.sql;
    this.#deps = deps || {};
  }

  /* ------------------------------------------------------------------ the providers (Uses), reached lazily */
  #dep(name, make) {
    if (!(name in this.#deps) || this.#deps[name] === undefined) this.#deps[name] = make();
    return this.#deps[name];
  }
  get #record() { return this.#dep("record", () => recordOf(this.#host)); }
  get #membership() { return this.#dep("membership", () => membershipOf(this.#host)); }
  get #credentials() { return this.#dep("credentials", () => credentialsOf(this.#host)); }
  get #provenance() { return this.#dep("provenance", () => provenanceOf(this.#host)); }
  get #captureRequests() { return this.#dep("captureRequests", () => captureRequestsOf(this.#host)); }
  get #basisVersions() { return this.#dep("basisVersions", () => basisVersionsOf(this.#host)); }
  get #progressions() { return this.#dep("progressions", () => progressionsOf(this.#host)); }
  get #aiRuns() { return this.#dep("aiRuns", () => aiRunsOf(this.#host)); }
  get #bias() { return this.#dep("bias", () => biasOf(this.#host)); }
  get #contradiction() { return this.#dep("contradiction", () => contradictionOf(this.#host)); }
  get #publication() { return this.#dep("publication", () => publicationOf(this.#host)); }
  get #reevaluation() { return this.#dep("reevaluation", () => reevaluationOf(this.#host)); }
  get #intent() { return this.#dep("intent", () => intentOf(this.#host)); }
  get #monitoring() { return this.#dep("monitoring", () => monitoringOf(this.#host)); }
  /* N483 (K1122): the export log is corpus-export's (its R2), read from the host's one instance. */
  get #corpusExport() { return this.#dep("corpusExport", () => corpusExportOf(this.#host)); }
  /* K1850: the CONDITIONs about our own machinery are machinery-producers' (its R1–R5, was this module's R3, R22, R26, R27),
     built over this module's own deps, so whatever a caller injected here reaches it too. */
  get #machinery() { return this.#dep("machinery", () => machineryProducersOf(this.#host, this.#deps)); }
  /* T45 (K2781 (1)): the Action layer's to-dos are action-producers' (its R1–R12, was this module's R15–R21, R29), built
     over this module's own deps as machinery-producers is, so whatever a caller injected here (queue's providers, a
     test's fakes) reaches it too. */
  get #actionProducers() { return this.#dep("actionProducers", () => actionProducersOf(this.#host, this.#deps)); }
  /* N520: a case's required core is docket's (its R9). */
  get #docket() { return this.#dep("docket", () => docketOf(this.#host)); }
  /* N534: a watch's entries are case-import's (its R20). */
  get #caseImport() { return this.#dep("caseImport", () => caseImportOf(this.#host)); }
  /* N528: a wizard script's breaks and its submissions are wizard-scripts' (its R13, R17). */
  get #wizardScripts() { return this.#dep("wizardScripts", () => wizardScriptsOf(this.#host)); }
  /* N612 (K1505 (1)): a case's tensions after publication are case-tensions' (its R4, was publication R50). Its provider is
     registered by publication at start (K1505 (3)), so publication is reached first, as case-authoring does. */
  get #caseTensions() { return this.#dep("caseTensions", () => { void this.#publication; return caseTensionsOf(this.#host); }); }
  /* N823 (K2438): a case edition set to publish at a time is publish-schedule's (its R4, was publication R69). */
  get #publishSchedule() { return this.#dep("publishSchedule", () => publishScheduleOf(this.#host)); }
  /* T50 (R41, R42; N1091): a project's participants and requests to join are project-roster's (its R1, R14, R26, R34). */
  get #projectRoster() { return this.#dep("projectRoster", () => projectRosterOf(this.#host, { record: this.#record, membership: this.#membership })); }
  /* T51's fix round (R46, R48): who owes an endorsement and which expertise awaits confirmation are member-roster's (its R77, R78),
     read through the one membership instance, which delegates both: it is the roster credentials told the copy is claimed, so the
     founder is among the administrators (a second `membersOf` instance is never told, and drops her). */
  get #memberRoster() { return this.#dep("memberRoster", () => this.#membership); }
  /* R38: the read instance-setup registers at start (its R62), or null while none is. */
  #placeArrivals = null;
  /* R43: this read's clock, the group's zone and the current local day in it, held for the length of one `feedItems` call, so a
     date inside a sentence is read in the zone the group keeps (civil-time) and names its year only when it is not this one. */
  #nowMs = Date.now(); #zoneMemo = undefined; #todayMemo = undefined;
  /* R49: what this one read has already asked, cleared with it, so a kind of fact is asked once for all the items that name it. */
  #memo = null;
  #fresh() {
    return { titles: new Map(), cases: new Map(), owners: new Map(), seen: new Map(), names: new Map(), caseProject: new Map(), scopes: new Map(),
             authors: new Map(), captured: new Map(), lead: { homes: new Map(), facts: new Map() }, homes: new Map(), options: new Map(), shared: null };
  }
  /** The ids of `ids` that are strings, once each, that `held` has not answered yet. */
  static #missing(held, ids) { return [...new Set((ids || []).filter((x) => typeof x === "string" && x))].filter((x) => !held.has(x)); }
  /** The group's zone, asked of publish-schedule once per read and only when a sentence needs a date or a time. */
  #zoneNow() { if (this.#zoneMemo === undefined) this.#zoneMemo = this.#groupZone(); return this.#zoneMemo; }
  #todayNow() { if (this.#todayMemo === undefined) this.#todayMemo = this.#todayIn(this.#zoneNow()); return this.#todayMemo; }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /* ------------------------------------------------------------------ the viewer gate (membership R43, R80)
     membership offers the ONE predicate (`viewerPredicate`) and the one-id answer (`inSight`), so this module compiles
     its own gate from the predicate, as queue did. A machine credential (`scope: member`) is not filtered; an absent or
     unrecognised viewer compiles to DENY. */
  #bundleGate(col, viewer) {
    if (typeof col !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
      throw new Error(`REFUSED: the D-15 bundle gate needs a QUALIFIED column (got ${col}). `
        + "An unqualified name binds to `bundles` inside the gate's own subquery and passes everything.");
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [] };
    if (gate.scope === "DENY") return { sql: gate.sql, args: [] };
    return {
      sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b
              WHERE b.bundle_id = ${col} AND (${gate.sql})))`,
      args: gate.args,
    };
  }

  /** The same question of ONE id, memoised per read: the id when the viewer sees it (membership R80), else null. `seen.prefetch(ids)`
   *  (R49) asks it of every id the feed is about to name, by one statement over `membership.viewerGate` (what `inSight` asks of
   *  one id), so a loop over items reads no row for each. */
  #bundleRedactor(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return Object.assign((id) => id ?? null, { prefetch: () => {} });
    if (gate.scope === "DENY") return Object.assign((id) => (id ? null : id ?? null), { prefetch: () => {} });
    const memo = this.#memo.seen;
    const prefetch = (ids) => {
      const todo = QueueProducers.#missing(memo, ids);
      if (!todo.length) return;
      const g = this.#membership.viewerGate(viewer);
      const sees = new Set(this.#rows(`SELECT b.bundle_id AS id FROM bundles b WHERE b.bundle_id IN (SELECT value FROM json_each(?)) AND (${g.sql})`,
                                      JSON.stringify(todo), ...g.args).map((r) => r.id));
      for (const id of todo) memo.set(id, sees.has(id));
    };
    return Object.assign((id) => {
      if (!id) return id ?? null;
      if (!memo.has(id)) prefetch([id]);
      return memo.get(id) ? id : null;
    }, { prefetch });
  }

  /* ------------------------------------------------------------------ the providers' services, by the names the moved
     code already used (connections R22; basis-versions R22, R37; membership R64, R86) */
  #projectsDrawingOn(...a) { return this.#basisVersions.projectsDrawingOn(...a); }
  #conclusionOf(...a) { return this.#basisVersions.conclusionOf(...a); }
  #conclusionRecordOf(...a) { return this.#basisVersions.conclusionRecordOf(...a); }
  #isAdminMember(...a) { return this.#membership.isAdministrator(...a); }
  #activeAdmins(...a) { return this.#membership.activeAdmins(...a); }

  /* ------------------------------------------------------------------ the words' facts (R43) */
  /** R49: the titles of `ids`, every one not yet held read by one statement (`bundles` is record-core's stated read contract). */
  #titlesOf(ids) {
    const held = this.#memo.titles;
    const todo = QueueProducers.#missing(held, ids);
    if (!todo.length) return held;
    const found = new Map(this.#rows(`SELECT bundle_id, title FROM bundles WHERE bundle_id IN (SELECT value FROM json_each(?))`,
                                      JSON.stringify(todo)).map((r) => [r.bundle_id, r.title]));
    for (const id of todo) held.set(id, typeof found.get(id) === "string" && found.get(id) ? found.get(id) : null);
    return held;
  }
  /** An id's title, or null when it names no titled bundle. */
  #titleOf(id) {
    if (typeof id !== "string" || !id) return null;
    return this.#titlesOf([id]).get(id) ?? null;
  }
  /** R43: the scope of each of `ids` that is a published case, from publication's `published_cases` (its R40, a stated read
   *  contract): the newest edition that states one; null for an id that is no case or states none. One statement for all not yet held. */
  #scopesOf(ids) {
    const held = this.#memo.scopes;
    const todo = QueueProducers.#missing(held, ids);
    if (todo.length) {
      const found = this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='published_cases'`)
        ? new Map(this.#rows(`SELECT p.case_id, p.scope FROM published_cases p WHERE p.case_id IN (SELECT value FROM json_each(?))
                              AND p.scope IS NOT NULL AND p.scope <> ''
                              AND p.edition = (SELECT MAX(q.edition) FROM published_cases q WHERE q.case_id = p.case_id AND q.scope IS NOT NULL AND q.scope <> '')`,
                              JSON.stringify(todo)).map((r) => [r.case_id, r.scope]))
        : new Map();
      for (const id of todo) held.set(id, found.get(id) ?? null);
    }
    return held;
  }
  /** What a sentence calls a holder: a bundle by its title, a published case by its scope (its reading name), else its id (R43). */
  #nameOf(id) {
    const title = this.#titleOf(id);
    if (title) return title;
    if (typeof id === "string" && id) { const scope = this.#scopesOf([id]).get(id); if (scope) return scope; }
    return id === undefined || id === null ? "" : String(id);
  }
  /** What a sentence calls a member (C94): her handle; the founder by the handle she holds, else `member.founder.unnamed`'s word
   *  (DEC-230), never `admin`; any other member with no handle by her id, as R46 states (the word list holds no key for a member
   *  who has none: named in the job's QUESTION). */
  #memberName(id) {
    if (typeof id !== "string" || !id) return "";
    if (!this.#memo.names.has(id)) {
      let facts = null, founder = null;
      try { facts = this.#membership.memberFacts(id); } catch { facts = null; }
      if (id === ROOT_ADMIN) { try { founder = this.#membership.founderHandle(); } catch { founder = null; } }
      const handle = facts && typeof facts.handle === "string" && facts.handle ? facts.handle : typeof founder === "string" && founder ? founder : null;
      this.#memo.names.set(id, handle ?? (id === ROOT_ADMIN ? word("member.founder.unnamed") : id));
    }
    return this.#memo.names.get(id);
  }
  /** B7 (K4245): a name the roster answers as a member's handle, or null when it is an id (the member holds no handle): held
   *  by a member's row or by the founder. The fill `fills.who` carries it; the sentence keeps the name either way. */
  #heldHandle(name) {
    if (typeof name !== "string" || !name) return null;
    try {
      const held = this.#membership.memberByHandle(name) !== null || this.#membership.founderHandle() === name;
      return held ? name : null;
    } catch { return null; }
  }
  /** The group's time zone as publish-schedule R1 carries it (its `groupZone`), or null when none is held. */
  #groupZone() {
    try {
      const ps = this.#publishSchedule;
      const z = ps && typeof ps.groupZone === "function" ? ps.groupZone() : null;
      return typeof z === "string" && z ? z : null;
    } catch { return null; }
  }
  /** The current local day in `zone` (the UTC day when none is held; a sentence's, never an age's or a comparison's, R36). */
  #todayIn(zone) { return localDayOf(new Date(this.#nowMs).toISOString().replace(/\.\d{3}Z$/, "Z"), zone); }
  /** A date a provider states (a day, or an instant) as the sentence names it, in the group's zone; empty when it is neither. */
  #dayWord(value) {
    const day = localDayOf(value, this.#zoneNow());
    return day ? dayText(day, this.#todayNow()) : "";
  }
  /** `queue.source.untitled`'s `{date}`: the local day of the earliest retrieval of the captures registered under a bundle,
   *  from provenance's register and receipts (R11's stated read contract, its R48); empty when none can be read. */
  #capturedDay(bundleId) {
    const held = this.#memo.captured;
    if (!held.has(bundleId)) this.#prefetchCaptured([bundleId]);
    return held.get(bundleId) ?? "";
  }
  /** R49: the capture days of `ids` at once, one statement; none readable (a store without the tables) leaves each empty. */
  #prefetchCaptured(ids) {
    const held = this.#memo.captured;
    const todo = QueueProducers.#missing(held, ids);
    if (!todo.length) return;
    try {
      const found = new Map(this.#rows(`SELECT r.bundle_id AS bundle_id, MIN(cl.first_retrieved) AS first FROM register r
                                          JOIN captured_locators cl ON cl.capture_sha = r.capture_sha
                                         WHERE r.bundle_id IN (SELECT value FROM json_each(?)) GROUP BY r.bundle_id`,
                                       JSON.stringify(todo)).map((r) => [r.bundle_id, r.first]));
      for (const id of todo) held.set(id, found.get(id) ? this.#dayWord(String(found.get(id))) : "");
    } catch { for (const id of todo) held.set(id, ""); }
  }

  /** R45: the list a provider's answer states under `key`, or a `FeedFail` naming why it gave none, with `read` the provider read
   *  (`<module>.<read>`) and the provider's own code when it gave one (R50). */
  static #answered(r, key, read = null) {
    if (r && typeof r === "object" && !Array.isArray(r) && r.ok !== false && r.state !== "undetermined" && Array.isArray(r[key])) return r[key];
    throw new FeedFail(r && typeof r === "object" && (r.state === "undetermined" || r.undetermined === true) ? "undetermined" : "refused", read, codeOf(r));
  }
  /** R50: a provider read that threw is named by its read. */
  static #via(read, fn) {
    try { return fn(); } catch (e) { throw e instanceof FeedFail ? e : new FeedFail("threw", read); }
  }

  /* queue's R7 walk and R12 options, as this read was handed them (R8), asked once for each distinct set of subjects (R49): the
     same set is answered again from what was answered, a copy of it, so an item never shares an object with another. */
  #homesOf(subjectIds) {
    if (!this.#homesFn) return { ...UNGROUPED };
    const ids = subjectIds || [], key = JSON.stringify(ids);
    if (this.#memo.homes.has(key)) return structuredClone(this.#memo.homes.get(key));
    const answer = this.#homesFn(ids);
    try { this.#memo.homes.set(key, structuredClone(answer)); } catch { /* an answer that cannot be copied is asked again */ }
    return answer;
  }
  #optionsOf(subjectIds) {
    if (!this.#optionsFn) return [];
    const ids = subjectIds || [], key = JSON.stringify(ids);
    if (this.#memo.options.has(key)) return structuredClone(this.#memo.options.get(key));
    const answer = this.#optionsFn(ids) || [];
    try { this.#memo.options.set(key, structuredClone(answer)); } catch { /* an answer that cannot be copied is asked again */ }
    return answer;
  }

  /* ------------------------------------------------------------------ the bounds */
  /** Which object types can BE a case (queue's R7 vocabulary, through normalizeType): an inquiry or a project. */
  static QUEUE_CASE_TYPES = ["inquiry", "project"];
  /** How many subject bundles one item names (R2: at most 8), the bound queue's options read under too. */
  static QUEUE_OPTION_SUBJECTS_MAX = 8;
  /** R9: the lead's inquiry-grain act, take it up (cite into that inquiry); queue decorates it (its R17) and adds the
   *  set-aside at its mint, where the disposition is known (its R18). */
  static LEAD_TAKE_UP = Object.freeze({ id: "cite", label: word("queue-producers.label.take_up_under"), weight: "report" });
  /** K1850: the five sweep kinds, now machinery-producers' (its R4), kept here as an alias for this module's readers. */
  static SWEEP_CONDITION_KINDS = MachineryProducers.SWEEP_CONDITION_KINDS;
  /** How many pages of one provider's cursor-paged read (each at most 500 entries) one read follows. */
  static QUEUE_PAGES = 20;

  /** A provider's paged read followed by its cursor, at most QUEUE_PAGES pages; `truncated` when it was cut. */
  #pages(read, name = null) {
    const items = [];
    let after = null, cut = false;
    for (let page = 0; ; page += 1) {
      if (page === QueueProducers.QUEUE_PAGES) { cut = true; break; }
      const r = read(after);
      items.push(...QueueProducers.#answered(r, "items", name));
      if (!r.truncated || !r.cursor) break;
      after = r.cursor;
    }
    return { items, truncated: cut };
  }

  /* ================================================================== R8 · feedItems
   * queue's ONE read of this module. Every producer here is a pure read, called in the order queue's feed assembled
   * them before the split, so the items and their order are what queue minted from its own producers; queue sorts,
   * mints (the class fence, the disposition, the lead's set-aside), ages, mutes and publishes.
   *
   * `facts` carries what queue's answer publishes BESIDE its items: `objective_gap` and `contradiction`, the project
   * bounds R2 and R4 read under with whether they cut (queue R6 publishes them); `unattributed`, the readings of a
   * shared question no team could be read for (D-266); and `dispositions`, the proposals feed's recorded decisions,
   * from the same `proposalsFeed` read the FINDINGs came from, so R2 and queue R15 cannot disagree; and `action`,
   * action-producers' own facts (its R13: each of its producers' bound and cut, and any provider that failed). */
  feedItems({ member = null, viewer = null, now = null, identity = null, homesOf = null, optionsOf = null } = {}) {
    void identity;        // queue's options are closed over it already (its R12); named here as R8 names it
    const me = typeof member === "string" && member.trim() ? member.trim() : null;
    const at = Number.isFinite(Number(now)) && now !== null && now !== "" ? Number(now) : Date.now();
    this.#homesFn = typeof homesOf === "function" ? homesOf : null;
    this.#optionsFn = typeof optionsOf === "function" ? optionsOf : null;
    this.#nowMs = at;
    this.#zoneMemo = undefined;
    this.#todayMemo = undefined;
    this.#memo = this.#fresh();
    try {
      const items = [];
      /* R45: every producer is a feed read on its own. One whose read throws, or whose provider answers a refusal or
         `undetermined` instead of its list, contributes no item and is named in `facts.failed`; the others stand. A feed with
         no provider composed at this host is neither failed nor answered: it is named in `facts.absent`. */
      const failed = [], absent = [], ms = {};
      /* R50: a feed that could not be read names, beside its reason, the provider read and its code when they are known; R51: and
         every feed read, a feed that threw included, says in `facts.ms` what it cost. */
      const feed = (id, read) => {
        const t0 = performance.now();
        try { return read(); }
        catch (e) {
          const fail = e instanceof FeedFail ? e : null;
          failed.push({ feed: id, reason: fail ? fail.reason : "threw", ...(fail && fail.read ? { read: fail.read } : {}), ...(fail && fail.code ? { code: fail.code } : {}) });
          return null;
        } finally { ms[id] = Math.max(0, Math.round(performance.now() - t0)); }
      };
      const add = (list) => { if (Array.isArray(list)) items.push(...list); };
      /* OBLIGATION · R1: the bias debts. */
      add(feed("bias-debts", () => this.#obligationsBiasDebt(viewer, me, at)));
      /* FINDING · R2: the proposals feed, read ONCE (its dispositions are published from this same read). */
      let dispositions = [];
      add(feed("proposals", () => {
        const read = this.#progressions.proposalsFeed(at);
        if (!read || typeof read !== "object" || read.ok === false || read.state === "undetermined") throw new FeedFail(read && read.state === "undetermined" ? "undetermined" : "refused", "progressions.proposalsFeed", codeOf(read));
        const findingSeen = this.#bundleGate("pi.bundle_id", viewer);
        /* R49: the bundles behind every instance the feed names, read at once by one statement (the keys and entities named, then
           the pairs asked), not by one for each instance each time it is asked */
        const named = [...(Array.isArray(read.proposals) ? read.proposals.flatMap((x) => (x && Array.isArray(x.instances) ? x.instances : [])) : []),
                       ...(Array.isArray(read.instances) ? read.instances : [])].filter((x) => x && typeof x.progression_key === "string" && typeof x.entity_id === "string");
        const behind = new Map();
        if (named.length) {
          const wanted = new Set(named.map((x) => `${x.progression_key}\u0000${x.entity_id}`));
          for (const r of this.#rows(`SELECT DISTINCT pi.progression_key, pi.entity_id, pi.bundle_id FROM progression_instances pi
              WHERE pi.progression_key IN (SELECT value FROM json_each(?)) AND pi.entity_id IN (SELECT value FROM json_each(?))
                AND (${findingSeen.sql}) ORDER BY pi.bundle_id`,
            JSON.stringify([...new Set(named.map((x) => x.progression_key))]), JSON.stringify([...new Set(named.map((x) => x.entity_id))]), ...findingSeen.args)) {
            const k = `${r.progression_key}\u0000${r.entity_id}`;
            if (!wanted.has(k)) continue;
            if (!behind.has(k)) behind.set(k, []);
            behind.get(k).push(r.bundle_id);
          }
        }
        const found = proposalFindingItems(read, {
          subjectsOf: (pk, eid) => [...(behind.get(`${pk}\u0000${eid}`) ?? [])],
          homesOf: (subjects) => this.#homesOf(subjects),
          optionsOf: (subjects) => this.#optionsOf(subjects),
          subjectsMax: QueueProducers.QUEUE_OPTION_SUBJECTS_MAX });
        dispositions = Array.isArray(read.dispositions) ? read.dispositions : [];
        return found;
      }));
      /* FINDING · R2: the three shared-inquiry kinds (stance, new reading, concluded elsewhere). */
      let unattributed = { count: 0, inquiries: [] };
      add(feed("shared-inquiries", () => {
        const stance = this.#findingsStanceDiverged(viewer, at);
        const fromAnotherTeam = this.#findingsVersionFromAnotherTeam(viewer, at);
        const concluded = this.#findingsConcludedElsewhere(viewer, at);
        unattributed = { count: Number(fromAnotherTeam.unattributed) || 0,
                         inquiries: Array.isArray(fromAnotherTeam.unattributed_inquiries) ? fromAnotherTeam.unattributed_inquiries : [] };
        return [...stance, ...fromAnotherTeam, ...concluded];
      }));
      /* FINDING · R2 and R9: the lead, the export, the notices, the gaps, the flags. */
      add(feed("leads", () => this.#findingsOutOfInquiryLead(viewer, at)));
      add(feed("exports", () => this.#findingsExportPerformed(me, viewer, at)));
      add(feed("references", () => this.#findingsNewerCapture(viewer, at)));
      let gapFacts = { bound: QueueProducers.QUEUE_OBJECTIVE_GAP_PROJECTS, truncated: false };
      add(feed("objectives", () => {
        const gaps = this.#findingsObjectiveGap(me, viewer, at);
        gapFacts = { bound: gaps.bound, truncated: gaps.truncated === true };
        return gaps;
      }));
      add(feed("sources", () => this.#findingsSourceFlagged(viewer, at)));
      /* CONDITION (K1850): our own machinery's, machinery-producers' (its R1–R5), homed and offered through the same
         walk and options this read was handed. A provider it names in its own `facts.failed` is carried as `partial`. */
      add(feed("machinery", () => {
        const machinery = this.#machinery.conditionItems({ member: me, viewer, now: at, homesOf: this.#homesFn ? (x) => this.#homesOf(x) : undefined,
                                                           optionsOf: this.#optionsFn ? (x) => this.#optionsOf(x) : undefined });
        if (!machinery || !Array.isArray(machinery.items)) throw new FeedFail("refused", "machinery-producers.conditionItems");
        if (machinery.facts && Array.isArray(machinery.facts.failed) && machinery.facts.failed.length) failed.push({ feed: "machinery", reason: "partial" });
        return machinery.items;
      }));
      /* N345 · R4–R7: the contradictions. */
      let contradictionFacts = { bound: QueueProducers.QUEUE_CONTRADICTION_PROJECTS, truncated: false };
      add(feed("contradictions", () => {
        const scope = this.#contradictionProjects(me, viewer);
        const found = [...this.#contradictionItems(scope, viewer, at),
                       ...this.#findingsSideCorrected(viewer, at),
                       ...this.#findingsTensionAfterPublication(me, viewer, at),
                       ...this.#contradictionUnseenItems(me, scope, viewer)];
        contradictionFacts = { bound: scope.bound, truncated: scope.truncated === true };
        return found;
      }));
      /* OBLIGATION · R14: a member's own signing key, to the administrators. */
      add(feed("signing-keys", () => this.#obligationsSignerSelfRegistered(me, viewer, at)));
      /* The Action layer (T45; K2781 (1)): its to-dos are action-producers' (its R1–R12, was this module's R15–R21, R29),
         answered as machinery-producers' are, through the same walk and options this read was handed. */
      let actionFacts = {};
      add(feed("action", () => {
        const action = this.#actionProducers.actionItems({ member: me, viewer, now: at, homesOf: this.#homesFn ? (x) => this.#homesOf(x) : undefined,
                                                           optionsOf: this.#optionsFn ? (x) => this.#optionsOf(x) : undefined });
        if (!action || !Array.isArray(action.items)) throw new FeedFail("refused", "action-producers.actionItems");
        actionFacts = action.facts && typeof action.facts === "object" ? action.facts : {};
        if (Array.isArray(actionFacts.failed) && actionFacts.failed.length) failed.push({ feed: "action", reason: "partial" });
        return action.items;
      }));
      /* R23 (DEC-102 item 3): an observation of the member's own a prepared case uses, its credit level unchosen. A store
         publication has not migrated holds no case document: that feed is absent here. */
      if (this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='case_documents'`))
        add(feed("attribution", () => this.#obligationsAttributionUnchosen(me, viewer, at)));
      else absent.push("attribution");
      /* R30, R31 (N520; DEC-116): a case's required core still due, to its manager; a finding resting on an edition
         withdrawn or contested on its docket. */
      add(feed("docket", () => [...this.#obligationsDocketCoreDue(me, viewer, at), ...this.#findingsDocketDependents(viewer, at)]));
      /* R34, R35 (N534; DEC-101 (3)): a finding resting on another group's edition its publisher replaced or withdrew; and
         what a watch saw at the publisher's docket, to the member who set it. */
      add(feed("cited-cases", () => [...this.#findingsCitedCaseMoved(viewer, at), ...this.#watchItems(me, viewer, at)]));
      /* R32, R33, R39 (N528; DEC-121 (1), (5); DEC-158 (4)): a group's wizard script withdrawn or restored, told its owners
         and author; a version submitted, to each owner who may approve it; a copy whose base has a newer approved version. */
      add(feed("wizards", () => [...this.#findingsWizardBroken(me, viewer, at), ...this.#obligationsWizardApproval(me, viewer, at),
                                 ...this.#findingsWizardBaseUpdated(me, viewer, at)]));
      /* R37 (DEC-147; N662): a case edition signed to publish at a set time, while it waits, once published, once stopped. */
      add(feed("schedule", () => this.#scheduledEditionItems(me, viewer, at)));
      /* R38 (DEC-150 (3); N665): a held profile for the place the group named, arrived with an update, to the administrators. */
      if (this.#placeArrivals) add(feed("places", () => this.#conditionsPlaceArrived(me, viewer, at)));
      else absent.push("places");
      /* R41, R42, R54 (T50; N1091; DEC-248, DEC-286; K5157): a project's invitation, to the member invited; a request to join it, and a
         participant's request to leave it, to its owners. */
      add(feed("projects", () => [...this.#obligationsProjectInvitation(me, viewer, at), ...this.#obligationsProjectRequest(me, viewer, at),
                                  ...this.#obligationsProjectLeave(me, viewer, at)]));
      /* R46–R48 (T51's fix round; K4169, UC-046): an endorsement owed on a proposed administrator, an owner vote owed on a project's
         owner change, an expertise awaiting confirmation. */
      add(feed("members", () => [...this.#obligationsEndorsementOwed(me, at), ...this.#obligationsOwnerVoteOwed(me, viewer, at),
                                 ...this.#obligationsExpertiseOwed(me, at)]));
      return {
        items: QueueProducers.#onePerMatter(items),
        facts: {
          objective_gap: gapFacts,
          unattributed,
          contradiction: contradictionFacts,
          dispositions,
          action: actionFacts,
          failed,
          absent,
          ms,
        },
      };
    } finally {
      this.#memo = null;
      this.#homesFn = null;
      this.#optionsFn = null;
      this.#zoneMemo = undefined;
      this.#todayMemo = undefined;
    }
  }

  /** R8 (C69; walk CA60): one item per matter. Items that are the same thing to the member who reads them are one, standing where the first
   *  stood: a fact of an action's deadline, in whatever status and however many of its facts are due, is one to do for that action
   *  (`local-fact-due`, action-producers R7 raises one for each fact and status; the survivor is the item with the least id, so the same
   *  one stands at every read, and its basis names every status and fact it stands for); any other item equal to an earlier one in
   *  everything but its id (class, kind, subject, summary, detail and basis) is that item again. Two matters, however alike their words,
   *  are two items: a different subject, or a different basis, is a different matter. */
  static #onePerMatter(items) {
    const matterOf = (it) => {
      if (it && it.kind === "local-fact-due" && it.subject && typeof it.subject.id === "string" && it.subject.id) return `fact::${it.subject.id}`;
      try { const { id, ...rest } = it; void id; return `same::${canonicalJson([rest.class, rest.kind, rest.subject ?? null, rest.summary ?? null, rest.detail ?? null, rest.basis ?? null])}`; }
      catch { return `id::${it && it.id}`; }
    };
    const groups = new Map(), order = [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const key = matterOf(it);
      if (!groups.has(key)) { groups.set(key, []); order.push(key); }
      groups.get(key).push(it);
    }
    const out = [];
    for (const key of order) {
      const g = groups.get(key);
      const seenId = new Set(), unique = g.filter((x) => (seenId.has(x.id) ? false : (seenId.add(x.id), true)));
      const chosen = unique.reduce((a, b) => (String(b.id) < String(a.id) ? b : a));
      if (key.startsWith("fact::")) {
        const basis = chosen.basis && typeof chosen.basis === "object" ? chosen.basis : {};
        const uniq = (xs) => [...new Set(xs.filter((x) => typeof x === "string" && x))].sort();
        out.push({ ...chosen, basis: { ...basis, statuses: uniq(unique.map((x) => x.basis && x.basis.status)),
                                       paths: uniq(unique.map((x) => x.basis && x.basis.path)) } });
      } else out.push(chosen);
    }
    return out;
  }

  /** PL-15 / D-213 — WHAT THE RECORD CAN SAY ABOUT A CAPTURED DOCUMENT'S PLACE
   *  IN A CASE, MEASURED, and the reason it is measured rather than asserted.
   *
   *  The out-of-inquiry lead's defining property is an ABSENCE: the document is
   *  in the store and is deliberately part of NO claim. `CLAUDE.md` is explicit
   *  that an absence at one level is not evidence of absence at the next, and
   *  that saying WHICH is true is a first-class obligation rather than a
   *  diagnostic detail. A `basis` field simply omitting the leg would say
   *  nothing at all — a reader could not tell "we looked and it is in no case"
   *  from "nobody has read this document yet" from "this producer does not
   *  report that". So this asks BOTH basis projections directly and reports the
   *  counts it got, so the absence in the answer is the record's own and is
   *  dated by the read that made it.
   *
   *  BOTH PROJECTIONS, because there are two and they are different questions.
   *  `inquiry_basis` is the CURRENT basis of an inquiry (D-21's projection of
   *  `basis[]`), and `inquiry_basis_version_legs` holds the legs of every
   *  alternative composition anybody has proposed (PL-1's versions). A document
   *  absent from the first and present in the second IS part of a case — a
   *  suggested one — and reporting only the first would let the item announce
   *  "not part of any claim" about a document a run has already built a reading
   *  on. Neither table is filtered by inquiry: the claim being made is about the
   *  whole record, and narrowing it to inquiry B would make the sentence
   *  narrower than it reads.
   *
   *  A CAPTURE WITH NO REGISTER ROW IS `undetermined`, NOT `absent`. The
   *  register is what says which bundle a capture's bytes were registered
   *  under, so with no row there is no bundle to ask about and the honest answer
   *  is that this producer could not determine it — which is a different fact
   *  from "it is in no case", and the two must never be published as one word. */
  #leadBasisAbsence(captureSha) {
    const sha = typeof captureSha === "string" ? captureSha.trim() : "";
    if (!sha)
      return { state: "undetermined", reason: "no_capture_sha", bundle_id: null, bundle_state: null,
               basis_legs: null, version_legs: null,
               detail: localize("queue-producers.index.the_request_records_no_capture", "the request records no capture digest, so there is no document to ask about. That this producer could not look is a different fact from the document being part of nothing, and it is reported as the first rather than the second.") };
    const home = this.#memo.lead.homes.has(sha) ? this.#memo.lead.homes.get(sha) : this.#provenance.homeOf(sha);
    const reg = home ? { bundle_id: home.bundleId } : null;
    if (!reg)
      return { state: "undetermined", reason: "unregistered_capture", bundle_id: null, bundle_state: null,
               basis_legs: null, version_legs: null,
               detail: localize("queue-producers.index.no_register_entry_answers_to", "no register entry answers to this capture, so the bytes are not attached to a document this store can name and there is nothing whose place in a case could be asked. Undetermined, and STATED (D-9/D-45's unbacked-register shape).") };
    const held = this.#leadFacts([reg.bundle_id]).get(reg.bundle_id);
    const b = held.state === undefined ? null : { current_state: held.state };
    const legs = held.legs;
    const vlegs = held.vlegs;
    const none = legs === 0 && vlegs === 0;
    return {
      state: none ? "absent" : "present",
      reason: none ? "not_made_part_of_the_case" : "carried_by_a_reading",
      bundle_id: reg.bundle_id,
      bundle_state: b ? b.current_state : null,
      basis_legs: legs, version_legs: vlegs,
      detail: none
        ? localize("queue-producers.index.looked_for_and_not_there", "LOOKED FOR AND NOT THERE, which is the point of this item rather than an omission. The document was CAPTURED — an entry to the store — and no leg of any inquiry's basis and no leg of any proposed reading points at it (DEC-60, D-213). It was NOT made part of the case, which is a different sentence from nobody having read it, and this producer counted both basis projections to be able to say which.")
        : localize("queue-producers.index.this_document_is_carried_by", "this document IS carried by a reading of some question, so the lead has already been acted on or the document was evidence before the lead was raised. Reported rather than suppressed: the item is still the record of an observation somebody made."),
    };
  }

  /** R49: what the leads' basis absence asks of each bundle the captures are registered under (its state, and how many legs of the
   *  inquiries' bases and of the proposed readings point at it), every bundle not yet held read at once by three statements. */
  #leadFacts(bundleIds) {
    const held = this.#memo.lead.facts;
    const todo = QueueProducers.#missing(held, bundleIds);
    if (todo.length) {
      const json = JSON.stringify(todo);
      const states = new Map(this.#rows(`SELECT bundle_id, current_state FROM bundles WHERE bundle_id IN (SELECT value FROM json_each(?))`, json)
        .map((r) => [r.bundle_id, r.current_state]));
      const legs = new Map(this.#rows(`SELECT target_id, COUNT(*) AS n FROM inquiry_basis WHERE target_id IN (SELECT value FROM json_each(?)) GROUP BY target_id`, json)
        .map((r) => [r.target_id, r.n]));
      const vlegs = new Map(this.#rows(`SELECT target_id, COUNT(*) AS n FROM inquiry_basis_version_legs WHERE target_id IN (SELECT value FROM json_each(?)) GROUP BY target_id`, json)
        .map((r) => [r.target_id, r.n]));
      for (const id of todo) held.set(id, { state: states.has(id) ? states.get(id) : undefined, legs: legs.get(id) ?? 0, vlegs: vlegs.get(id) ?? 0 });
    }
    return held;
  }

  /** `out-of-inquiry-lead` (D-213, ANSWERED 2026-08-06 by Bob under DEC-60) —
   *  THE FINDING-CLASS SLUG WITH A PRODUCER, and this is the producer.
   *
   *  THE HOLE IT FILLS. DEC-60's investigative session reads ALL of a project's
   *  inquiries for context and writes only to the SUBJECT one, so evidence it
   *  turns up bearing on a DIFFERENT question — the same vendor holding three
   *  other contracts, met while investigating whether one was competitively bid
   *  — had nowhere to go and was dropped BY CONSTRUCTION. That is D-194's
   *  authored frontier with a PRODUCER generating them continuously rather than
   *  a member noticing one occasionally, which is what makes it worth a kind.
   *
   *  THE FACT IS THE REQUEST ROW'S OWN. `lead_inquiry` is written at the door by
   *  the run that made the observation, and this walk reads it. Nothing here
   *  infers a lead from subject matter, from a shared entity or from a
   *  similarity: an observation a producer can manufacture is one a producer can
   *  invent, and a notification claiming a member's attention on a manufactured
   *  connection is the record claiming more than it can support.
   *
   *  THE `case` SET DERIVES FROM INQUIRY B'S ANCESTORS, NOT A'S, and that IS the
   *  item. Filing a lead under the question the run happened to be working is
   *  what made these homeless in the first place — the evidence is about B, the
   *  people who need it are the people working B, and REC-20's every-ancestor
   *  walk over B is what routes it to them. `#conditionsCaptureRequested` walks
   *  the SAME table and files on `target`, which is correct for what IT
   *  announces (a capture this run asked for has completed) and wrong for this.
   *  Two producers, one table, two different homes, and the difference is the
   *  whole reason both exist.
   *
   *  FINDING AND NOT CONDITION. A CONDITION is a fact about our own machinery
   *  and a member may MUTE it personally (D-125, DEC-16). A lead is a fact about
   *  the world, and muting is exactly what must not be available: one member's
   *  inbox hygiene would remove a real lead from their view while the record
   *  went on believing the team had been told. It leaves the list the way every
   *  finding does — adopted, deferred or dismissed as an authored, attributed
   *  act. queuestate.mjs classes the slug FINDING and the mint refuses anything
   *  else, so this is enforced rather than intended.
   *
   *  GATED ON `lead_inquiry` AND NOT ON `target`. The item is ABOUT question B,
   *  it is FILED under B, and its acts are offered on B — so B is what a viewer
   *  must be able to see for the item to exist for them at all. A member invited
   *  to B and not to A learns nothing about A here beyond the fact that some run
   *  captured this document, which is the same disclosure `basis.source` makes
   *  everywhere else. Withheld WHOLE and with no count, the posture REC-30 set.
   *
   *  ONLY `captured` ROWS. A lead whose capture has not landed is not yet a
   *  lead a member can act on: the point of D-213's answer is that the DOCUMENT
   *  IS IN THE STORE, and announcing one before the bytes arrive would offer a
   *  member acts over something that may still be refused at the drain. */
  #findingsOutOfInquiryLead(viewer, now) {
    const out = [];
    const seen = this.#bundleRedactor(viewer);
    const requests = QueueProducers.#answered(this.#captureRequests.leads({ viewer }), "requests", "capture-requests.leads");
    /* R49: the sight and titles of the questions the leads name, read at once */
    seen.prefetch(requests.map((r) => r && r.target)); this.#titlesOf(requests.flatMap((r) => (r ? [r.target, r.lead_inquiry] : [])));
    /* and where each capture is registered, and what points at those bundles (R49): the register read for each capture, the legs at once */
    const registered = [];
    for (const r of requests) {
      const sha = r && r.attribution && r.attribution.ok && typeof r.capture_sha === "string" ? r.capture_sha.trim() : "";
      if (!sha || this.#memo.lead.homes.has(sha)) continue;
      const home = this.#provenance.homeOf(sha);
      this.#memo.lead.homes.set(sha, home);
      if (home) registered.push(home.bundleId);
    }
    this.#leadFacts(registered);
    for (const r of requests) {
      const attribution = r.attribution;
      /* THE SAME DEFENCE `#conditionsCaptureRequested` STATES, for the same
         reason and with the same honesty about what it is. The drain refuses to
         capture a row it cannot attribute, so no `captured` row reaching this
         walk can fail the composer today and this `continue` is UNDRIVABLE. It
         is kept because this is a READ over stored rows, which outlive the rules
         that wrote them, and a member-facing item that could not say whose act
         it announces is DEC-27(b)'s defect surfaced to a person. It mints no
         DEC-49 code: an unreachable branch costs a reader a moment, an
         unreachable CODE costs its family the floor that proves codes fire. */
      if (!attribution.ok) continue;
      const basisEntry = this.#leadBasisAbsence(r.capture_sha);
      const capturedMs = Date.parse(r.captured_at);
      out.push({
        id: `FINDING::out-of-inquiry-lead::${r.request}`,
        class: "FINDING",
        kind: "out-of-inquiry-lead",
        /* INQUIRY B'S ANCESTORS. The one line this item exists for. */
        case: this.#homesOf([r.lead_inquiry]),
        subject: { kind: "capture_request", id: r.request,
                   inquiry: r.lead_inquiry, address: r.address,
                   capture_sha: r.capture_sha ?? null,
                   bundle_id: basisEntry.bundle_id },
        summary: say("queue.out-of-inquiry-lead.summary", { question: this.#nameOf(r.lead_inquiry) }),
        summary_key: "queue.out-of-inquiry-lead.summary",
        /* the run's own question is named by its title only where this viewer may see it (R11); else by its id, as before */
        detail: say("queue.out-of-inquiry-lead.detail", { address: r.address, target: seen(r.target) === null ? r.target : this.#nameOf(r.target),
                                                          question: this.#nameOf(r.lead_inquiry), statement: attribution.statement }),
        detail_key: "queue.out-of-inquiry-lead.detail",
        basis: {
          source: "capture_requests", request: r.request, run: r.run,
          /* NAMED APART, deliberately. `found_while_working` is inquiry A and
             `bears_on` is inquiry B, and a single `inquiry` field would collapse
             the distinction the whole item is about — which is exactly what the
             sibling producer's basis does, correctly, because for IT there is
             only one question. */
          found_while_working: r.target,
          bears_on: r.lead_inquiry,
          address: r.address, host: r.host, purpose: r.purpose, ua_mode: r.ua_mode,
          capture_sha: r.capture_sha ?? null, captured_at: r.captured_at,
          attribution,
          basis_entry: basisEntry,
          detail: localize("queue-producers.index.both_principals_are_named_dec", "BOTH PRINCIPALS ARE NAMED (DEC-27(b), DEC-55.4) and BOTH QUESTIONS ARE NAMED (D-213): the act is the daemon's, performed at the session's request, and the session was working one question when it met evidence for another. The absence of a basis entry is MEASURED and reported on `basis_entry` rather than left to be inferred from an empty field — absence at one level is not evidence of absence at the next, and which one is true is the answer, not a footnote (CLAUDE.md)."),
        },
        age: Number.isFinite(capturedMs)
          ? { state: "determined", since: r.captured_at, ms: Math.max(0, now - capturedMs) }
          : { state: "undetermined", reason: "unparseable_captured_at",
              detail: localize("queue-producers.index.the_request_row_carries_a", "the request row carries a completion stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        /* R9 (REC-202; queue R18): THE INQUIRY-GRAIN ACTS ON INQUIRY B, which D-213 named and D-222's grain problem held back:
           take it up (cite the captured document into B, op=cite) and set it aside (the project-scoped disposition,
           queue R27). The set-aside is added at the mint, where the item's disposition is known, and only when that
           disposition is available: no item offers an act its op would refuse NO_PROJECT_SCOPE. */
        options: [QueueProducers.LEAD_TAKE_UP],
      });
    }
    return out;
  }

  /* ======================================================================
   * PL-13 / IS-3 — THE TWO SHARED-INQUIRY SLUGS, AND WHY THE MODEL NEEDS THEM.
   *
   * D-216's MODEL CHECK IS THE PRECONDITION AND ITS ANSWER IS **PER-PROJECT**
   * (landed 2026-08-08, DRIVEN through twelve ops against the real control
   * plane rather than read). §7 is correct and cloning the inquiry on
   * divergence is NOT the honest answer, because a clone duplicates the whole
   * evidence trail and the copies drift, so the shared investigation stops
   * being shared. The sharing edge is a `cites` row in `refs`; the inquiry's
   * own bytes carry NO stance; a read naming no project gets no `current` field
   * at all, which is a refusal to guess rather than a default.
   *
   * THAT ANSWER IS WHAT MAKES THESE TWO KINDS NECESSARY, and stating it the
   * other way round is the whole design. Because the stance is per-project,
   * NOTHING REFUSES A DIVERGENCE — two projects standing on two readings of one
   * question is a legal state that was measured happening with no refusal from
   * the plane. A legal state nobody is told about is a silent one, and the
   * failure mode is concrete: a team builds a case on a reading its partners
   * abandoned, and finds out at publication. So the cost of the correct model
   * is paid HERE, in the feed, by telling people — never by a reconciliation
   * that would quietly re-impose the single shared stance §7 rejected.
   *
   * BOTH ARE DERIVED ON READ AND NEITHER ADDS A TABLE. That is a finding rather
   * than a shortcut and it is worth naming, because a stance-divergence LEDGER
   * is the obvious build and it would be wrong twice over: it would be a second
   * place a stance is stated (D-21), and it would be a derived table that
   * `op=purge` must be taught about or silently leave rows behind (D-113). The
   * facts these two walk are ALREADY the record's own — `refs`, the projects'
   * own frontmatter, `inquiry_basis_versions` — so there is nothing to store,
   * nothing to go stale, and nothing for a purge to miss.
   *
   * WHAT THEY DO NOT DO. Neither refuses anything, neither moves a pointer, and
   * neither writes. `op=versioncurrent` moves ONE project's stance and moves
   * nothing else — PL-2 built it, D-216 measured it, and the plan row's
   * accepts-when says so in terms. These producers report; they do not
   * reconcile. A notification that changed somebody else's stance would be the
   * single shared stance arriving through the back door.
   * ====================================================================== */


  /** THE SHARED QUESTIONS, and the walk is bounded by the edge table rather
   *  than by the corpus. An inquiry is SHARED when two or more distinct bundles
   *  cite it; the `refs_target` index answers that with one grouped read, and
   *  the expensive per-project frontmatter confirmation then runs only over
   *  questions that could possibly diverge. A question ONE project draws on can
   *  hold no divergence and is never opened.
   *
   *  D-480 — THE GROUP RUNS OVER WHAT THE CALLER CAN SEE, AND THE PARAGRAPH
   *  THAT USED TO STAND HERE WAS WRONG IN A WAY WORTH KEEPING ON THE RECORD.
   *  It said the `HAVING COUNT(DISTINCT bundle_id) > 1` was on the UNGATED
   *  table ON PURPOSE — a CANDIDATE filter, not the answer, since
   *  `#projectsDrawingOn` gates afterwards and can take the real count back
   *  below two. **That is true of every candidate the page REACHES and says
   *  nothing about the page's EDGE**, which is the whole defect (found by
   *  D-464's worker, `BIO_Membership_Architecture_v2.md` §7 item 7.9). The
   *  candidate read is BOUNDED at `QUEUE_SHARED_INQUIRIES_MAX` and ordered by
   *  `target_id`, so a hidden project's citations do two things a later gate
   *  cannot undo: they make a question that only ONE visible project draws on
   *  qualify as shared, and that question then TAKES A SLOT — displacing a
   *  visible one past the cap and flipping the `inquiries_truncated` the feed
   *  publishes on every item. A count-shaped side channel, D-447's and D-464's
   *  class: *"Not its existence"* arriving as an aggregate.
   *
   *  THE FIX IS D-464'S AND D-486'S SUBTRACTION, NOT A SECOND SIGHT RULE, and
   *  that is also the answer to the old paragraph's performance objection.
   *  membership's `hiddenBundles(viewer)` (its R88; N352) is the ONE set of bundles the caller's own
   *  `viewerPredicate` does not pass, spelled once and read here as a set —
   *  `NOT IN`, an indexed subtraction SQLite materialises once per statement,
   *  never the per-row correlated gate the old paragraph rightly refused. Who
   *  is filtered is the gate's word, inherited rather than restated: a
   *  credential the gate does not filter (scope `member`) gets `hid` = nothing
   *  and the read it always got; an administrator, the founder included, gets
   *  the hidden projects it neither was invited to nor joined (D54), and a
   *  viewer SENT but unrecognised is DENY, so every bundle is hidden and the
   *  candidate set is empty — fails closed.
   *
   *  BOTH ENDS OF THE EDGE, and the second is not scope creep but the same
   *  sentence: a question the caller cannot see is dropped by
   *  `#queueSharedInquiry` a few lines below, so it never mints an item — but
   *  until this landing it still consumed a slot on the way there. The
   *  subtraction is over `bundles`, so a `target_id` naming NOTHING (a
   *  `references[]` entry for a document nobody has captured — the common case)
   *  is in no hidden set and is kept exactly as before, then dropped by the
   *  same existence check that always dropped it. Nothing here tightens what is
   *  ANSWERED; it decides only which rows are allowed to fill the bounded page.
   *
   *  THE CANDIDATE FILTER IS STILL A CANDIDATE FILTER. The severed-status
   *  confirmation and the per-project frontmatter read still run afterwards in
   *  `#projectsDrawingOn` and can still take the real count back below two, in
   *  which case no item is minted. */
  #queueSharedInquiryCandidates(viewer) {
    const cap = QueueProducers.QUEUE_SHARED_INQUIRIES_MAX;
    const hid = hiddenBundles(viewer);
    /* `hid` is null for a caller the gate does not filter: the statement is then
       BYTE-IDENTICAL to the one this method ran before D-480, which is what
       keeps the unfiltered classes measurably unmoved. */
    const where = hid ? ` AND rf.bundle_id NOT IN ${hid.sql} AND rf.target_id NOT IN ${hid.sql}` : "";
    const args = hid ? [...hid.args, ...hid.args] : [];
    const rows = this.#rows(
      `SELECT rf.target_id AS target_id FROM refs rf WHERE rf.kind='cites'${where}
        GROUP BY rf.target_id HAVING COUNT(DISTINCT rf.bundle_id) > 1
        ORDER BY rf.target_id LIMIT ?`, ...args, cap + 1);
    const out = rows.slice(0, cap).map((r) => r.target_id);
    out.truncated = rows.length > cap;
    out.bound = cap;
    return out;
  }

  /** THE BOUNDS THESE PRODUCERS WALK UNDER. A derivation over an unbounded scan
   *  is a class of defect this record has paid for (D-227, REC-66), and the
   *  first draft of these producers walked straight into it, found by the old
   *  suites' ceiling on unbounded derivations: an unbounded read of `refs` with
   *  per-row work inside the loop. `shared.test.mjs`'s R11 (D-480) test drives
   *  the shared-question page to exactly its bound and one past it.
   *
   *  PUBLIC so a suite can read them and so the bound a member is told about is
   *  the bound that was applied, never a second copy of the number.
   *
   *  WHAT A TRUNCATION MEANS HERE, AND IT IS PUBLISHED RATHER THAN SWALLOWED. A
   *  bounded project set makes `elsewhere` a FLOOR: the projects named really do
   *  stand where the item says, and there may be more the read did not reach. A
   *  divergence reported over a truncated set is still true; the ABSENCE of a
   *  divergence over one is not, so the item says which it had. */
  static QUEUE_SHARED_INQUIRIES_MAX = 64;
  static QUEUE_SHARED_PROJECTS_MAX = 32;
  static QUEUE_SHARED_VERSIONS_MAX = 64;
  /** The page basis-versions' read is asked at (its R9's largest). */
  static QUEUE_SHARED_VERSIONS_READ = 1000;

  /** IS THE QUESTION ITSELF STILL THERE, AND MAY THIS VIEWER SEE IT?
   *
   *  **THIS GUARD EXISTS BECAUSE THE PURGE ARM CAUGHT ITS ABSENCE, and the
   *  defect is worth recording rather than quietly fixed.** The sharing edge
   *  lives in the CITING PROJECT'S OWN BYTES — a `references[]` row and a
   *  `current_versions[]` row — and those OUTLIVE the target. So after
   *  `op=purge` removed the shared question, both producers went on announcing
   *  a divergence about a question that no longer existed, naming a bundle id
   *  nothing answers to. The candidate walk reads `refs`, which is a projection
   *  of the citing side, so nothing in it requires the target to be there.
   *
   *  It is also the VIEWER gate for the subject. `homesOf` and
   *  `#projectsDrawingOn` each gate what they name, but the question the item is
   *  ABOUT is named in its own `summary`, `detail` and `subject` — REC-30's
   *  posture is that an item about a bundle a viewer may not see is withheld
   *  WHOLE, and this is where that happens for these two kinds. */
  #queueSharedInquiry(inquiryId, viewer) {
    const gate = this.#bundleGate("bx.bundle_id", viewer);
    return this.#one(
      `SELECT bx.bundle_id, bx.title, bx.object_type FROM bundles bx
        WHERE bx.bundle_id=? AND (${gate.sql})`, inquiryId, ...gate.args) || null;
  }

  /** R49: the shared questions, and each one's row and the projects drawing on it, asked ONCE for the three shared-inquiry kinds
   *  of one read (they walk the same questions), not once for each. */
  #shared(viewer) {
    if (!this.#memo.shared) this.#memo.shared = { list: this.#queueSharedInquiryCandidates(viewer), byInq: new Map() };
    return this.#memo.shared;
  }
  #sharedQuestion(inq, viewer) {
    const byInq = this.#shared(viewer).byInq;
    if (!byInq.has(inq)) {
      const q = this.#queueSharedInquiry(inq, viewer);
      byInq.set(inq, q ? { q, drawing: this.#projectsDrawingOn(inq, viewer) } : { q: null, drawing: null });
    }
    return byInq.get(inq);
  }

  /** `stance-changed-here-not-elsewhere` (PL-13 / IS-3) — ONE ITEM PER
   *  (QUESTION, PROJECT THAT HOLDS A DATED STANCE) THAT STANDS APART.
   *
   *  THE GRAIN IS PER-PROJECT AND THE REASON IS THE DATE. The obvious
   *  alternative is one item per diverging QUESTION, and it fails on the one
   *  thing §7's field actually carries: the pointer is DATED, and the date is
   *  the whole of *changed*. Two projects standing apart have TWO dated
   *  pointers, so a per-question item would have to pick one date, invent one,
   *  or report its age undetermined — throwing away the only fact that makes
   *  this a change rather than a standing difference. Per-project, `age.since`
   *  is the project's OWN authored `at`, read from its OWN bytes.
   *
   *  ONLY A PROJECT THAT HOLDS A STANCE MINTS AN ITEM, and this is what makes
   *  the plan row's accepts-when come out right rather than approximately
   *  right. Project A moves to a reading while B has named none: ONE item, A's,
   *  saying B stands on nothing. B then moves to a different reading: TWO
   *  items, because there are now two dated acts and two teams who each need to
   *  know the other is elsewhere. A project with NO pointer is never the
   *  subject of one of these — it has not changed anything, and announcing "you
   *  stand nowhere" every time a partner moves would be the feed nagging a team
   *  about an act it has not taken.
   *
   *  FILED UNDER THE QUESTION'S ANCESTORS, WHICH IS EVERY PROJECT DRAWING ON
   *  IT. queue R7's walk climbs `refs kind='cites'` upward, so the homes of
   *  an item about a shared question ARE the projects sharing it — both sides
   *  of the divergence, by the same walk every other producer uses. That is the
   *  point: an item only the diverging team could see would tell the one team
   *  that already knows.
   *
   *  `elsewhere` IS ENUMERATED AND NEVER SUMMARISED TO A COUNT. A member needs
   *  to know WHICH reading the other team is on to decide whether the
   *  difference matters, and "2 projects differ" is the shape that reads as
   *  disagreement when it may be one project that simply has not caught up. */
  #findingsStanceDiverged(viewer, now) {
    const out = [];
    const shared = this.#shared(viewer).list;
    for (const inq of shared) {
      const { q, drawing } = this.#sharedQuestion(inq, viewer);
      if (!q) continue;
      if (drawing.length < 2) continue;
      const qname = q.title || inq;
      for (const p of drawing) {
        if (!p.current || !p.current.version) continue;
        const elsewhere = drawing
          .filter((q) => q.id !== p.id
                      && (!q.current || q.current.version !== p.current.version))
          .map((q) => ({ project: q.id, title: q.title,
                         version: q.current ? q.current.version : null,
                         at: q.current ? q.current.at : null,
                         by: q.current ? q.current.by : null,
                         state: q.current ? "stands_elsewhere" : "stands_on_nothing" }));
        if (elsewhere.length === 0) continue;
        const movedMs = Date.parse(p.current.at ?? "");
        out.push({
          id: `FINDING::stance-changed-here-not-elsewhere::${inq}::${p.id}`,
          class: "FINDING",
          kind: "stance-changed-here-not-elsewhere",
          case: this.#homesOf([inq]),
          subject: { kind: "project_stance", id: p.id, inquiry: inq,
                     version: p.current.version },
          summary: say(`queue.stance-changed-here-not-elsewhere.summary.${elsewhere.length === 1 ? "one" : "other"}`,
                       { project: p.title || p.id, version: p.current.version }),
          summary_key: `queue.stance-changed-here-not-elsewhere.summary.${elsewhere.length === 1 ? "one" : "other"}`,
          detail: joined(say("queue.stance-changed-here-not-elsewhere.detail", { question: qname, n: drawing.length, project: p.title || p.id, version: p.current.version }),
                         this.#dayWord(p.current.at) ? say("queue.stance-changed-here-not-elsewhere.detail.at", { date: this.#dayWord(p.current.at) }) : "",
                         p.current.by ? say("queue.stance-changed-here-not-elsewhere.detail.by", { who: p.current.by }) : ""),
          detail_key: "queue.stance-changed-here-not-elsewhere.detail",
          basis: {
            source: "project frontmatter (current_versions[]) + refs",
            inquiry: inq,
            here: { project: p.id, title: p.title, version: p.current.version,
                    at: p.current.at, by: p.current.by },
            elsewhere,
            drawing_projects: drawing.map((q) => q.id),
            /* THE BOUNDS, PUBLISHED WITH THE ANSWER THEY SHAPED. A truncated
               project set makes `elsewhere` a FLOOR — what is named really does
               stand there, and there may be more. Said here rather than left
               for a reader to wonder about, because a bounded walk reporting a
               complete-looking answer is the shape REC-57's discipline exists
               to end. */
            bounds: {
              inquiries_examined: shared.length, inquiries_bound: shared.bound,
              inquiries_truncated: shared.truncated === true,
              projects_named: drawing.length, projects_bound: drawing.bound,
              projects_truncated: drawing.truncated === true,
              detail: localize("queue-producers.index.this_feed_examines_a_bounded", "this feed examines a bounded number of shared questions per read and a bounded number of projects per question. Where either is truncated the divergence reported is a FLOOR: the projects named do stand where this says, and the read did not reach every one that might. A divergence over a truncated set is still true; an ABSENCE of one over a truncated set is not, which is why the flags are published rather than the counts alone."),
            },
            /* THE SHAPE OF THE POINTER, PUBLISHED ON THE ITEM. §7's field is a
               project-authored DATED frontmatter row and NEVER a settings row,
               and this producer read it as one — so a member (and a suite) can
               see from the notification itself where the fact came from,
               instead of taking the sentence's word for it. */
            pointer: { kind: "dated_frontmatter_field", field: "current_versions",
                       held_by: word("queue-producers.held_by"), settings_row: false,
                       detail: localize("queue-producers.index.dec_17s_reasoning_a_settings", "DEC-17's reasoning: a settings row would be a way to change the standard with nothing to read afterwards. Every stance named here was read out of a project's own promoted bytes, where the act that wrote it is in the append-only history beside it.") },
            detail: localize("queue-producers.index.d_216_measured_this_model", "D-216 measured this model rather than assuming it (2026-08-08): two projects were driven onto two different readings of one shared question SIMULTANEOUSLY, the plane refused neither, and after divergence each still saw every version and every leg of the other's. The sharing is real and the stance is not shared — which is why this item exists at all."),
          },
          /* THE DATE IS THE PROJECT'S OWN AUTHORED `at`, never this read's
             clock. A pointer whose date cannot be parsed reports UNDETERMINED
             rather than falling back to now: a stance dated by the reader is a
             fact about the reader. */
          age: Number.isFinite(movedMs)
            ? { state: "determined", since: p.current.at, ms: Math.max(0, now - movedMs) }
            : { state: "undetermined", reason: "unparseable_stance_date",
                detail: localize("queue-producers.index.this_projects_pointer_carries_no", "this project's pointer carries no date this producer can read as an instant, so how long the two teams have stood apart is undetermined and is reported as such rather than measured from this read") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([inq]),
          options_grain: {
            offered: "document",
            missing: "stance",
            detail: localize("queue-producers.index.the_natural_acts_here_are", "the natural acts here are at STANCE grain — move to the reading the others are on, or record why we are staying — and the first of those is op=versioncurrent on THIS project and nobody else's. It is deliberately not offered as an option on an item another project's members can also see: an act one team performs from a notification another team is reading is the single shared stance §7 rejected, arriving through a button (D-222's grain problem)."),
          },
        });
      }
    }
    return out;
  }

  /** `new-version-arrived-from-another-team` (PL-13 / IS-3) — A READING OF A
   *  SHARED QUESTION, PROPOSED UNDER SOMEBODY ELSE'S WORK.
   *
   *  THE TEAM IS READ, NOT INFERRED, AND WHERE IT CANNOT BE READ NO ITEM IS
   *  MINTED. A version row carries `author` (a member) and `run`. A MEMBER does
   *  not name a team: this record has no member-to-project map and inventing
   *  one from who-has-edited-what is exactly the manufactured connection
   *  `#findingsOutOfInquiryLead` refuses to make. What IS a stored fact is the
   *  RUN's context: `ai_runs.context_type='project'` with a `context_id`, set
   *  when the run was opened. So the source team is the run's context project
   *  or it is nothing, and a version composed by hand — or by a run whose
   *  context is the instance rather than a project — mints NO item at all.
   *
   *  THAT SILENCE IS A REAL COST AND IT IS DECLARED RATHER THAN ABSORBED. A
   *  hand-composed version of a shared question genuinely does reach the other
   *  team unannounced, and this producer cannot fix that without claiming to
   *  know something the record does not hold. Announcing it anyway — "arrived
   *  from another team" about a version whose team is undetermined — is the
   *  record claiming more than it can support, which this project ranks as
   *  worse than a missing feature. The gap is stated here, asserted in
   *  `shared.test.mjs` (R2: a run-less version produces NO item, driven), and
   *  raised as **D-266** so it is a known hole with a name rather than a
   *  surprise for whoever next reads this feed.
   *
   *  THE SOURCE PROJECT IS REMOVED FROM ITS OWN ITEM'S HOMES, and this is the
   *  one place this file filters a walk's result. `homesOf([inquiry])`
   *  returns EVERY project citing the question, including the one the version
   *  came from — and telling a team that a reading "arrived from another team"
   *  when they authored it is a false sentence, not merely noise. So the source
   *  is dropped from `case.ancestors` and the drop is DECLARED on the item
   *  (`case.excluded`) rather than performed quietly: a home set that is
   *  silently shorter is the exact failure DEC-16's truncation rule exists to
   *  prevent, and a filtered set that says so is not one.
   *
   *  HIDDEN VERSIONS ARE INCLUDED AND FLAGGED, NEVER FILTERED (D-214,
   *  DEC-29(b)). Hiding is a display decision one project made; it is not a
   *  reason another project should never learn the reading was proposed. */
  #findingsVersionFromAnotherTeam(viewer, now) {
    const out = [];
    /* D-266 — THE SILENCE, COUNTED. Not attributed: counted.
     *
     * The gap D-266 folds in is this producer's, and it is real — a reading of
     * a shared question composed BY HAND, or by a run whose context is not one
     * of the projects named here, reaches the other team with NO item minted,
     * because the source team is the RUN's stored context or it is nothing and
     * this producer will not guess one. **That much does not change here and
     * must not: attributing a team we cannot read is the record claiming more
     * than it can support, which this project ranks as worse than the silence.**
     *
     * WHAT DOES CHANGE IS THAT THE SILENCE IS NO LONGER SILENT. Absence at one
     * level is not evidence of absence at the next, and saying WHICH is true is
     * a first-class obligation rather than a diagnostic detail (CLAUDE.md). A
     * member reading this feed could not tell *no reading arrived from another
     * team* from *readings arrived and this record cannot say whose they are* —
     * two very different facts that rendered identically as an empty list. The
     * count below is the second one, published on the feed's envelope, and it
     * is deliberately a COUNT AND AN INQUIRY rather than a version name and a
     * guess: it says how much this read could not attribute and where to go and
     * look, and it claims nothing whatever about who authored anything.
     *
     * IT DISTINGUISHES NOTHING FURTHER, AND THAT IS REC-74 RATHER THAN
     * LAZINESS. Telling *the run's context was the instance* from *the run's
     * context was a project this viewer cannot see* would mean PROJECTING a
     * stored column of `ai_runs`, which this reader's declared role forbids —
     * so the two are counted together and the answer says they are. */
    let unattributed = 0;
    const unattributedIn = [];
    const shared = this.#shared(viewer).list;
    for (const inq of shared) {
      const { q, drawing } = this.#sharedQuestion(inq, viewer);
      if (!q) continue;
      if (drawing.length < 2) continue;
      const ids = new Set(drawing.map((p) => p.id));
      const qname = q.title || inq;
      /* THE HAND-COMPOSED READINGS, COUNTED AND NEVER READ. A `count(*)` over
         the complement of the predicate below — one aggregate per question
         inside a loop that is already bounded, projecting no column of any
         row, so nothing here reaches a member except the number itself. */
      /* basis-versions R8–R9: the question's versions as the viewer may read them, at its largest page. */
      const held = this.#basisVersions.basisVersions({ id: inq, limit: QueueProducers.QUEUE_SHARED_VERSIONS_READ, viewer });
      const heldVersions = QueueProducers.#answered(held, "versions", "basis-versions.basisVersions");
      {
        const n = heldVersions.filter((v) => !(typeof v.run === "string" && v.run)).length;
        if (n > 0) { unattributed += n; if (!unattributedIn.includes(inq)) unattributedIn.push(inq); }
      }
      /* BOUNDED, for the reason the bounds above are: a per-question read with
         per-row work inside it is the amplification class D-227 and REC-66
         paid for. One more than may be used, so the truncation is a fact
         rather than an inference. */
      const vcap = QueueProducers.QUEUE_SHARED_VERSIONS_MAX;
      const vrows = heldVersions.filter((v) => typeof v.run === "string" && v.run)
        .map((v) => ({ name: v.name, description: v.description ?? null, state: v.state, hidden: v.hidden ? 1 : 0,
                       author: v.author ?? null, at: v.at ?? null, run: v.run }));
      const vtrunc = vrows.length > vcap || held.truncated === true;
      for (const v of vrows.slice(0, vcap)) {
        /* A MEMBERSHIP TEST AGAINST THE PROJECTS ALREADY NAMED. This producer does
           not want a run's facts: it wants to know WHICH OF THE PROJECTS IT HAS
           ALREADY NAMED the reading came from, so the run's context is matched
           against the drawing set and `from_project` below is `p.id`, which came
           from `refs` and from the project's own frontmatter (REC-74 holds every
           reader of `ai_runs` to a declared role; ai-runs answers this read).

           IT IS ALSO THE STRICTER GATE. Iterating the DRAWING set means a run
           whose context is a project this viewer cannot see can never be
           matched, so the item cannot name it — REC-30's withheld-WHOLE posture
           obtained by construction rather than by a second check. */
        /* ai-runs R28: the run's context, for a run this viewer can see (null otherwise, which names no project). */
        const run = this.#aiRuns.runFor(v.run, viewer);
        const from = run && run.context_type === "project"
          ? drawing.find((p) => p.id === run.context_id) : undefined;
        /* D-266: the OTHER half of the silence — a reading that DOES carry a
           run, whose context this read could not match to any project it
           named. Counted with the hand-composed ones above and never told
           apart from them, for the REC-74 reason stated at the head. */
        if (!from) {
          unattributed += 1;
          if (!unattributedIn.includes(inq)) unattributedIn.push(inq);
          continue;
        }
        const src = from.id;
        if (!ids.has(src)) continue;
        /* THE OTHER TEAMS. If the source is the only project drawing on the
           question that this viewer can see, there is no "another team" for the
           reading to have arrived at, and no item is the honest answer. */
        const receiving = drawing.filter((p) => p.id !== src);
        if (receiving.length === 0) continue;
        const homes = this.#homesOf([inq]);
        const kept = homes.ancestors.filter((a) => a.id !== src);
        const arrivedMs = Date.parse(v.at ?? "");
        const srcRow = from;
        out.push({
          id: `FINDING::new-version-arrived-from-another-team::${inq}::${v.name}`,
          class: "FINDING",
          kind: "new-version-arrived-from-another-team",
          case: {
            ...homes,
            ancestors: kept,
            ungrouped: homes.state === "determined" && kept.length === 0,
            /* DECLARED, NEVER QUIET. The one home this producer removed and the
               reason, so a reader can tell a filtered set from a short one. */
            excluded: [{ id: src, reason: "authored_here",
                         detail: localize("queue-producers.index.the_project_this_reading_was", "the project this reading was proposed under is not a team it arrived FROM, so this item is not filed under it. Stated rather than performed silently: a home set that is quietly shorter is indistinguishable from nobody caring (DEC-16).") }],
          },
          subject: { kind: "basis_version", id: `${inq}::${v.name}`,
                     inquiry: inq, version: v.name },
          summary: say("queue.new-version-arrived-from-another-team.summary", { version: v.name, question: qname, project: srcRow && srcRow.title ? srcRow.title : src }),
          summary_key: "queue.new-version-arrived-from-another-team.summary",
          detail: joined(say("queue.new-version-arrived-from-another-team.detail", { question: qname, n: drawing.length, project: srcRow && srcRow.title ? srcRow.title : src, version: v.name }),
                         fillWord("state", v.state) ? say("queue.new-version-arrived-from-another-team.detail.state", { state: fillWord("state", v.state) }) : "",
                         v.hidden === 1 ? say("queue.new-version-arrived-from-another-team.detail.hidden") : "",
                         v.author ? say("queue.new-version-arrived-from-another-team.detail.by", { who: v.author }) : "",
                         this.#dayWord(v.at) ? say("queue.new-version-arrived-from-another-team.detail.at", { date: this.#dayWord(v.at) }) : ""),
          detail_key: "queue.new-version-arrived-from-another-team.detail",
          basis: {
            source: "inquiry_basis_versions + ai_runs",
            inquiry: inq, version: v.name, description: v.description,
            state: v.state,
            /* RETURNED AND FLAGGED, NEVER FILTERED — D-214 / DEC-29(b). */
            hidden: v.hidden === 1,
            from_project: src,
            from_project_title: srcRow ? srcRow.title : null,
            to_projects: receiving.map((p) => p.id),
            run: v.run, author: v.author ?? null, at: v.at ?? null,
            bounds: {
              inquiries_examined: shared.length, inquiries_bound: shared.bound,
              inquiries_truncated: shared.truncated === true,
              projects_named: drawing.length, projects_bound: drawing.bound,
              projects_truncated: drawing.truncated === true,
              versions_bound: vcap, versions_truncated: vtrunc,
              detail: localize("queue-producers.index.this_feed_examines_a_bounded_2", "this feed examines a bounded number of shared questions per read, a bounded number of projects per question and a bounded number of run-proposed readings per question. A truncation here means READINGS THIS READ DID NOT REACH, never readings that do not exist — the arrival of this one is unaffected by it, and the flag is published so the silence about any other cannot be read as evidence there is none."),
            },
            team_attribution: {
              state: "determined", via: "ai_runs.context",
              detail: localize("queue-producers.index.the_source_team_is_the", "the source team is the RUN's own context project, a fact stored when the run was opened. It is never inferred from who authored the version: a member does not name a team in this record, and a producer that guessed one would be manufacturing the connection the notification is claiming attention for. A version with no run, or a run whose context is not a project, mints NO item — the silence is a declared gap (D-266), not a filtered one."),
            },
            detail: localize("queue-producers.index.d_216_measured_that_one", "D-216 measured that one question sits beneath several projects and that each reads the whole version set (2026-08-08): after two projects diverged, each still saw every version and every leg of the other's. So this item announces an arrival, not a disclosure — the reading was already readable here, and what was missing was anybody being told it had appeared."),
          },
          age: Number.isFinite(arrivedMs)
            ? { state: "determined", since: v.at, ms: Math.max(0, now - arrivedMs) }
            : { state: "undetermined", reason: "unparseable_version_date",
                detail: localize("queue-producers.index.the_version_row_carries_no", "the version row carries no authored instant this producer can read, so how long this reading has been standing unanswered is undetermined") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([inq]),
          options_grain: {
            offered: "document",
            missing: "version",
            detail: localize("queue-producers.index.the_natural_acts_here_are_2", "the natural acts here are at VERSION grain — consider this reading, accept it, turn it down — and they exist (op=versionconsider / accept / reject), but they move the SHARED question's row and are therefore not this project's to take from a notification about somebody else's proposal. What IS this project's own act is op=versioncurrent, which moves only this project's stance (§7)."),
          },
        });
      }
    }
    /* D-266 — CARRIED ON THE ARRAY, the way `#projectsDrawingOn` already
       carries `truncated` and `bound`. The producer's contract is its ITEMS;
       this is a fact ABOUT THE READ that has no item to sit on, precisely
       because the readings it counts minted none. */
    out.unattributed = unattributed;
    out.unattributed_inquiries = unattributedIn;
    return out;
  }

  /** `shared-inquiry-concluded-by-another-project` (REC-124 / INVESTIGATIVE-SESSION.md
   *  §7.1 item 3) — *"Other projects are told, never moved — a FINDING-class
   *  notice, §7's notification pattern: project P concluded this shared inquiry
   *  on version N. Their stance is unchanged until they act."*
   *
   *  ONE ITEM PER (QUESTION, PROJECT THAT CONCLUDED IT), filed under every OTHER
   *  project drawing on the question and NOT under the one that concluded —
   *  `#findingsVersionFromAnotherTeam`'s exclusion, declared on the item for the
   *  same reason (a home set quietly shorter is indistinguishable from nobody
   *  caring). DERIVED ON READ from the projects' own `conclusions[]` rows through
   *  the ONE reader, so it adds no table, needs no purge arm (D-113), and cannot
   *  disagree with op=basisversions about what a project concluded.
   *
   *  FINDING AND NOT CONDITION, for §7's reason: another team having concluded
   *  the question you share is a fact about the world of the work, and one
   *  member's inbox hygiene must not make it vanish for the team. */
  #findingsConcludedElsewhere(viewer, now) {
    const out = [];
    const shared = this.#shared(viewer).list;
    for (const inq of shared) {
      const { q, drawing } = this.#sharedQuestion(inq, viewer);
      if (!q) continue;
      if (drawing.length < 2) continue;
      const qname = q.title || inq;
      for (const p of drawing) {
        const c = this.#conclusionOf(p.id, inq, viewer);
        if (!c) continue;
        const receiving = drawing.filter((x) => x.id !== p.id);
        if (receiving.length === 0) continue;
        const homes = this.#homesOf([inq]);
        const kept = homes.ancestors.filter((a) => a.id !== p.id);
        const atMs = Date.parse(c.at ?? "");
        out.push({
          id: `FINDING::shared-inquiry-concluded-by-another-project::${inq}::${p.id}`,
          class: "FINDING",
          kind: "shared-inquiry-concluded-by-another-project",
          case: {
            ...homes,
            ancestors: kept,
            ungrouped: homes.state === "determined" && kept.length === 0,
            excluded: [{ id: p.id, reason: "concluded_here",
                         detail: localize("queue-producers.index.the_project_that_concluded_is", "the project that concluded is not a team this was concluded ELSEWHERE for, so this item is not filed under it. Stated rather than performed silently (DEC-16).") }],
          },
          subject: { kind: "project_conclusion", id: p.id, inquiry: inq, version: c.version },
          summary: say("queue.shared-inquiry-concluded-by-another-project.summary", { project: p.title || p.id, question: qname, version: c.version }),
          summary_key: "queue.shared-inquiry-concluded-by-another-project.summary",
          detail: joined(say("queue.shared-inquiry-concluded-by-another-project.detail", { question: qname, n: drawing.length, project: p.title || p.id, version: c.version }),
                         c.by ? say("queue.shared-inquiry-concluded-by-another-project.detail.by", { who: c.by }) : "",
                         this.#dayWord(c.at) ? say("queue.shared-inquiry-concluded-by-another-project.detail.at", { date: this.#dayWord(c.at) }) : ""),
          detail_key: "queue.shared-inquiry-concluded-by-another-project.detail",
          basis: {
            source: "project frontmatter (conclusions[]) + refs",
            inquiry: inq,
            concluded_by_project: p.id, concluded_by_project_title: p.title ?? null,
            version: c.version, claim: c.claim, by: c.by, at: c.at,
            to_projects: receiving.map((x) => x.id),
            /* The receiving projects' OWN conclusions, read through the same
               reader and enumerated, never summarised: a team needs to know
               whether it concluded on the same reading, a different one, or not
               at all. */
            elsewhere: receiving.map((x) => {
              /* REC-136: a project that concluded and WITHDREW is said so,
                 never folded into "not concluded" — the two differ in what
                 the team knows, and the history is the record of it. */
              const { stance: o } = this.#conclusionRecordOf(x.id, inq, viewer);
              return { project: x.id, title: x.title ?? null,
                       state: !o ? "not_concluded" : o.act === "concluded" ? "concluded"
                            : o.act === "withdrawn" ? "withdrawn" : "undetermined",
                       version: o ? o.version : null, at: o ? o.at : null };
            }),
            bounds: {
              inquiries_examined: shared.length, inquiries_bound: shared.bound,
              inquiries_truncated: shared.truncated === true,
              projects_named: drawing.length, projects_bound: drawing.bound,
              projects_truncated: drawing.truncated === true,
              detail: localize("queue-producers.index.a_bounded_number_of_shared", "a bounded number of shared questions and of projects per question are read. A conclusion reported over a truncated set is still true; an ABSENCE over one is not, which is why the flags are published."),
            },
            /* R10 (D-82): the derivation, which this producer's basis alone did not state until the split. */
            detail: localize("queue-producers.index.a_conclusion_is_the_concluding", "a conclusion is the concluding project's own dated row (§7.1), read through basis-versions' one reader (its R22) for each project drawing on this shared question, and the others' own conclusions beside it. Derived on read: nothing is stored, and nobody else's stance moved."),
          },
          age: Number.isFinite(atMs)
            ? { state: "determined", since: c.at, ms: Math.max(0, now - atMs) }
            : { state: "undetermined", reason: "unparseable_conclusion_date",
                detail: localize("queue-producers.index.the_conclusion_row_carries_no", "the conclusion row carries no authored instant this producer can read") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([inq]),
        });
      }
    }
    return out;
  }

  /** `export-performed` (D-52, catalogue id N-1) — Membership v2 §8.1: *"The export is recorded in
   *  the append-only history, so it can never happen silently, and every administrator is notified."*
   *  The RECORD half was `export_log` and `op=exportlog`, which reach an administrator who LOOKS; this
   *  is the notification half, which reaches one who does not.
   *
   *  ONE ITEM PER `export_log` ROW, IN EVERY ADMINISTRATOR'S FEED AND IN NO OTHER. The reader is an
   *  administrator when `#isAdminMember` says so of the stamped member (the founder's own session is
   *  ROOT_ADMIN and counts), or, for a machine credential, when the credential IS the ADMIN_TOKEN class
   *  — the root of trust that took the export. Every other reader gets nothing, and not a count: an
   *  ordinary member is not told an export exists, since §8.1's audience is the administrators. The
   *  rule is asked of the READER, never of the exporter, so the item cannot collapse to "the person
   *  who exported was told" — the failure this item's control arm is aimed at.
   *
   *  DERIVED ON READ from the log itself, the lead's and the conclusions' precedent: no table, no purge
   *  arm (D-113), and it cannot disagree with `op=exportlog` about what was exported. An administrator
   *  appointed after an export is told of it too, which is the reading of "every administrator" that
   *  leaves no administrator uninformed.
   *
   *  WHAT IT CANNOT YET DO, STATED ON THE ITEM: leave anyone's list. It is a FINDING, and a finding
   *  leaves by an authored disposition or a member's personal mute; the disposition is scoped to a
   *  project and an export has none, and the personal mute of a finding (D-125) is ruled and not built.
   *  So the notice is bounded to the log's newest `EXPORT_LOG_LIMIT_DEFAULT` rows instead, and the bound
   *  is published. */
  #findingsExportPerformed(me, viewer, now) {
    const admin = me ? this.#isAdminMember(me) : viewer === `${MACHINE_CLASS_PREFIX}admin`;
    if (!admin) return [];
    const cap = EXPORT_LOG_LIMIT_DEFAULT;
    /* The export log is `corpus-export`'s (its R1, R2; K1043), read from its own instance since N483 (K1122). */
    const log = this.#corpusExport.exportLog({ limit: cap });
    const page = QueueProducers.#answered(log, "exports", "corpus-export.exportLog");
    if (page.length === 0) return [];
    const truncated = log.truncated === true;
    const raisedTo = this.#activeAdmins();
    const homes = this.#homesOf([]);
    return page.map((r) => {
      const atMs = Date.parse(r.at ?? "");
      return {
        id: `FINDING::export-performed::${r.seq}`,
        class: "FINDING",
        kind: "export-performed",
        case: homes,
        subject: { kind: "export", id: `export_log:${r.seq}`, seq: r.seq },
        /* DEC-359 (B2): a full export (scope working-corpus) and a rendering (scope rendering, named by its format) each have their
           own words; the format is read through `queue.fill.format.<code>`. */
        ...(r.scope === "rendering"
          ? { summary: say("queue.export-performed.rendering.summary", { format: fillWord("format", r.format), date: this.#dayWord(r.at) }),
              summary_key: "queue.export-performed.rendering.summary",
              detail: say("queue.export-performed.rendering.detail", { format: fillWord("format", r.format) }),
              detail_key: "queue.export-performed.rendering.detail" }
          : { summary: say("queue.export-performed.summary", { date: this.#dayWord(r.at),
                                                               records: say(`queue.export-performed.records.${r.bundles === 1 ? "one" : "other"}`, { n: r.bundles }),
                                                               files: say(`queue.export-performed.files.${r.files === 1 ? "one" : "other"}`, { n: r.files }) }),
              summary_key: "queue.export-performed.summary",
              detail: joined(say("queue.export-performed.detail"),
                             r.note ? say("queue.export-performed.detail.note", { note: r.note }) : say("queue.export-performed.detail.nonote")),
              detail_key: "queue.export-performed.detail" }),
        basis: {
          source: "export_log",
          seq: r.seq, at: r.at, scope: r.scope, bundles: r.bundles, files: r.files, note: r.note ?? null,
          raised_to: raisedTo,
          bounds: { limit: cap, truncated,
                    detail: localize("queue-producers.index.the_newest_exports_are_read", "the newest exports are read up to this bound. An export past it is still in the log (op=exportlog, with a larger limit) and is not told here.") },
          detail: localize("queue-producers.index.an_export_of_the_working", "an export of the working corpus is recorded in the append-only export log and every administrator is notified (Membership v2 §8.1). This notice is derived from that log row and reaches every administrator named in raised_to and no one else. No act clears it yet: a disposition is scoped to a project and an export has none, and a member's own mute of a finding (D-125) is ruled but not built."),
        },
        age: Number.isFinite(atMs)
          ? { state: "determined", since: r.at, ms: Math.max(0, now - atMs) }
          : { state: "undetermined", reason: "unparseable_export_instant",
              detail: localize("queue-producers.index.the_export_log_row_carries", "the export log row carries an instant this producer cannot read") },
        assignee: null,
        assignee_role: null,
        /* The producer's own option (NOTIFICATIONS.md item contract, rule 1): the act that shows the
           administrator the record behind the notice. Not REC-19's object derivation, because an
           export is not a bundle and has no affordances to derive. */
        options: [{ id: "exportlog", label: word("queue-producers.label.read_export_log"), weight: "single" }],
      };
    });
  }

  /* ======================================================================
   * N172, N229 — THE PRODUCERS THE CATALOGUE NAMED WITHOUT ONE (R2, R3; N172, N229 as queue R1, R9, R10 named them).
   *
   * Each reads the fact its owning module already offers and restates none of it: reevaluation's open notices (its
   * R14), intent's gaps (its R6), monitoring's plan (its R32), its flagged documents (its R48) and the addresses its
   * next archive tick would find eligible (its R47; N330). Each is derived on read and writes nothing, like every producer above it, and each
   * is bounded, the bound stated where a member could otherwise read a short list as a complete one.
   * ====================================================================== */

  /** R49: the rows of `ids` this viewer sees (`null` for one it does not), every one not yet held read by one statement. */
  #caseRows(ids, viewer) {
    const held = this.#memo.cases;
    const todo = QueueProducers.#missing(held, ids);
    if (todo.length) {
      const gate = viewerPredicate(viewer);
      const found = new Map(this.#rows(
        `SELECT b.bundle_id, b.object_type, b.current_state, b.title FROM bundles b
          WHERE b.bundle_id IN (SELECT value FROM json_each(?)) AND (${gate.sql})`, JSON.stringify(todo), ...gate.args)
        .map((r) => [r.bundle_id, r]));
      for (const id of todo) held.set(id, found.get(id) ?? null);
    }
    return held;
  }

  /** A home set made of the named cases themselves (each at depth 0, when this viewer sees it and it is a case) and
   *  every ancestor above them (queue R7): for an item that is ABOUT a case rather than about a document under one. */
  #homesAt(caseIds, viewer) {
    const up = this.#homesOf(caseIds);
    const own = [];
    const ids = [...new Set((caseIds || []).filter((x) => typeof x === "string" && x))];
    const rows = this.#caseRows(ids, viewer);
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      const ty = normalizeType(row.object_type);
      if (!QueueProducers.QUEUE_CASE_TYPES.includes(ty)) continue;
      const spec = vocabFor(STATES, row.object_type);
      const edges = spec && spec.edges ? spec.edges : null;
      const terminal = edges && Object.prototype.hasOwnProperty.call(edges, row.current_state)
        ? edges[row.current_state].length === 0 : null;
      own.push({ id: row.bundle_id, type: ty, title: row.title ?? null, state: row.current_state ?? null, terminal, depth: 0 });
    }
    const ancestors = [...own, ...up.ancestors.filter((a) => !own.some((o) => o.id === a.id))]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { ...up, ancestors, ungrouped: up.state === "determined" && ancestors.length === 0 };
  }

  /** `newer-capture-affects-reference` (N172; reevaluation R14): one FINDING per open notice on a holder this viewer
   *  sees, read through `reevaluation.notices`, which withholds a notice on a hidden holder and blanks what the viewer
   *  may not see of the newer capture. Homed under the holder and its ancestors. Its door is reevaluation's R15
   *  (`versionadopt`, `versionkeep`), published on its disposition (queue R12). At most one page of notices is read. */
  #findingsNewerCapture(viewer, now) {
    const page = this.#reevaluation.notices({ state: "open", viewer, limit: QueueProducers.QUEUE_NOTICES_MAX });
    const list = QueueProducers.#answered(page, "notices", "reevaluation.notices");
    const out = [];
    const seen = this.#bundleRedactor(viewer);
    /* R49: the sight, titles and homes of the targets and holders the notices name, read at once */
    seen.prefetch(list.map((n) => n && n.target));
    this.#titlesOf(list.flatMap((n) => (n ? [n.target, n.holder] : []))); this.#caseRows(list.map((n) => n && n.holder), viewer);
    /* R52 (C69): one item per (holder, target, newer version), standing where the first stood, the least notice id surviving (so the
       same one stands at every read) and its basis naming every notice it stands for. A notice whose newer version the viewer cannot
       see has no version to key on and stays its own matter. */
    const matterOf = (n) => (n.newer_capture ?? n.newer_bundle)
      ? `${n.holder}\u0000${n.target ?? ""}\u0000${n.newer_capture ?? n.newer_bundle}` : `notice\u0000${n.notice}`;
    const standing = new Map();
    for (const n of list) {
      if (!n || typeof n.notice !== "string" || !n.notice) continue;
      const k = matterOf(n), g = standing.get(k);
      if (!g) standing.set(k, { first: n, notices: [n.notice] });
      else { g.notices.push(n.notice); if (n.notice < g.first.notice) g.first = n; }
    }
    for (const { first: n, notices } of standing.values()) {
      const raisedMs = Date.parse(n.raised_at ?? "");
      /* the pinned document's title only where this viewer may see it (R11); else the sentence for a target with no title */
      const titleOfTarget = seen(n.target) === null ? null : this.#titleOf(n.target);
      out.push({
        id: `FINDING::newer-capture-affects-reference::${n.notice}`,
        class: "FINDING",
        kind: "newer-capture-affects-reference",
        case: this.#homesAt([n.holder], viewer),
        subject: { kind: "notice", id: n.notice, holder: n.holder, target: n.target ?? null, ord: n.ord ?? null,
                   content_id: n.content_id ?? null, capture_sha: n.capture_sha ?? null,
                   newer_capture: n.newer_capture ?? null, newer_bundle: n.newer_bundle ?? null },
        /* DEC-359 (B2): the grade through `queue.fill.grade.<letter>`, what it affects through `queue.fill.affects.<code>`; a capture
           the viewer cannot see (reevaluation blanks both) reads `.detail.unseen`. */
        ...(titleOfTarget
          ? { summary: say("queue.newer-capture-affects-reference.summary", { target: titleOfTarget, holder: this.#nameOf(n.holder) }),
              summary_key: "queue.newer-capture-affects-reference.summary" }
          : { summary: say("queue.newer-capture-affects-reference.summary.untitled", { holder: this.#nameOf(n.holder) }),
              summary_key: "queue.newer-capture-affects-reference.summary.untitled" }),
        ...(() => {
          if (!n.grade && !n.affects)
            return { detail: say("queue.newer-capture-affects-reference.detail.unseen"), detail_key: "queue.newer-capture-affects-reference.detail.unseen" };
          const affects = fillWord("affects", n.affects);
          /* C69: a capture read after its first carries no grade (reevaluation's grade-not-carried); it reads as undetermined, as reevaluation's own text does */
          return { detail: joined(say("queue.newer-capture-affects-reference.detail", { grade: fillWord("grade", n.grade ?? "undetermined") }),
                                  affects ? say("queue.newer-capture-affects-reference.detail.affects", { affects }) : ""),
                   detail_key: "queue.newer-capture-affects-reference.detail" };
        })(),
        basis: { source: "reevaluation.notices", notice: n.notice, notices: [...new Set(notices)].sort(), holder: n.holder, target: n.target ?? null,
                 grade: n.grade ?? null, affects: n.affects ?? null, raised_at: n.raised_at ?? null,
                 bound: { limit: page.limit ?? QueueProducers.QUEUE_NOTICES_MAX, truncated: page.truncated === true },
                 detail: localize("queue-producers.index.a_notice_is_reevaluations_its", "a notice is reevaluation's (its R14): raised when a newer capture of what a reference is pinned to is graded affected or undetermined, never for A or B. It is read here, never raised, and it closes only by the holder's adoption or keeping (its R15).") },
        age: Number.isFinite(raisedMs)
          ? { state: "determined", since: n.raised_at, ms: Math.max(0, now - raisedMs) }
          : { state: "undetermined", reason: "unparseable_raised_at",
              detail: localize("queue-producers.index.the_notice_carries_no_raised", "the notice carries no raised instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([n.holder]),
      });
    }
    return out;
  }

  /** The projects `objective-gap` asks intent about (N172): those this viewer sees in which the member participates
   *  (joined or leaving; membership R74), or every visible project when there is no member, in id order, at most
   *  QUEUE_OBJECTIVE_GAP_PROJECTS; `truncated` when a further one qualifies. */
  #objectiveGapProjects(me, viewer) {
    return this.#participatingProjects(me, viewer, QueueProducers.QUEUE_OBJECTIVE_GAP_PROJECTS);
  }

  /** The projects this viewer sees in which the member participates (joined or leaving; membership R74), or every
   *  visible project when there is no member, in id order, at most `cap`; `truncated` when a further one qualifies. */
  #participatingProjects(me, viewer, cap) {
    /* R49: ONE statement, the member's participations joined to the projects this viewer sees (`project_participants` is
       membership's stated read contract, its R120: what `participation` answers of one project, `joined` or `leaving`), never
       a read of her participation in each project. One past the bound is read, so a further qualifying project is observed. */
    const gate = viewerPredicate(viewer);
    const rows = me
      ? this.#rows(`SELECT b.bundle_id FROM bundles b JOIN project_participants mine ON mine.project_id = b.bundle_id
                     AND mine.member_id = ? AND mine.state IN ('joined', 'leaving')
                     WHERE b.object_type='project' AND (${gate.sql}) ORDER BY b.bundle_id LIMIT ?`, me, ...gate.args, cap + 1)
      : this.#rows(`SELECT b.bundle_id FROM bundles b WHERE b.object_type='project' AND (${gate.sql}) ORDER BY b.bundle_id LIMIT ?`,
                   ...gate.args, cap + 1);
    return { projects: rows.slice(0, cap).map((r) => r.bundle_id), bound: cap, truncated: rows.length > cap };
  }

  /** `objective-gap` (N172; intent R6): one FINDING per gap intent answers for each project `#objectiveGapProjects`
   *  names, homed under its project. A gap is a proposal intent derives on read; it is read here and never restated. */
  #findingsObjectiveGap(me, viewer, now) {
    const scope = this.#objectiveGapProjects(me, viewer);
    const items = [];
    this.#titlesOf(scope.projects); this.#caseRows(scope.projects, viewer);
    for (const project of scope.projects) {
      const g = this.#intent.gaps({ project, viewer });
      for (const gap of QueueProducers.#answered(g, "gaps", "intent.gaps")) {
        const b = gap.basis || {};
        items.push({
          id: `FINDING::objective-gap::${gap.key}`,
          class: "FINDING",
          kind: "objective-gap",
          case: this.#homesAt([project], viewer),
          subject: { kind: "objective", id: project, project, progression: b.progression ?? null,
                     entity: b.entity ?? null },
          ...(b.says
            ? { summary: say("queue.objective-gap.summary", { project: this.#nameOf(project), says: b.says }), summary_key: "queue.objective-gap.summary" }
            : { summary: say("queue.objective-gap.summary.gap", { project: this.#nameOf(project) }), summary_key: "queue.objective-gap.summary.gap" }),
          ...(Array.isArray(b.stages_missing)
            ? { detail: say("queue.objective-gap.detail.stages", { stages: b.stages_missing.join(", ") }), detail_key: "queue.objective-gap.detail.stages" }
            : { detail: say("queue.objective-gap.detail.grade", { reached: b.grade_reached, required: b.grade_required }), detail_key: "queue.objective-gap.detail.grade" }),
          basis: { source: "intent.gaps", key: gap.key, project, progression: b.progression ?? null,
                   entity: b.entity ?? null, grade: gap.grade ?? null, instances: gap.instances ?? [],
                   gap: b, surfaced_by: gap.surfaced_by ?? "machine",
                   detail: localize("queue-producers.index.a_gap_is_derived_intent", "a gap is DERIVED (intent R6): the objective's satisfaction test read against the record, recomputed at every read. It leaves this project's list by a recorded decision.") },
          age: { state: "undetermined", reason: "derived_on_read",
                 detail: localize("queue-producers.index.a_gap_is_recomputed_at", "a gap is recomputed at read time and has no creation instant") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([project]),
        });
      }
    }
    items.bound = scope.bound;
    items.truncated = scope.truncated;
    return items;
  }

  /** `source-modified` and `source-removed` (N229, N330; monitoring R48): one FINDING per monitored document this viewer
   *  may see whose latest tick flagged `reeval_pending` from its `source_status`, read through `monitoring.flagged`,
   *  which gates by sight inside its read (a hidden document is neither listed nor counted) and bounds it, the bound
   *  and whether it cut published on each item. Homed under the document's ancestors. */
  #findingsSourceFlagged(viewer, now) {
    const page = this.#monitoring.flagged({ viewer });
    const list = QueueProducers.#answered(page, "items", "monitoring.flagged");
    const out = [];
    /* R49: the flagged documents' titles are read at once, and the capture days of the untitled ones */
    const flagged = list.map((r) => (r && typeof r.bundleId === "string" && r.bundleId ? r.bundleId : null)).filter(Boolean);
    this.#titlesOf(flagged); this.#prefetchCaptured(flagged.filter((id) => this.#titleOf(id) === null));
    for (const r of list) {
      const id = r && typeof r.bundleId === "string" && r.bundleId ? r.bundleId : null;
      if (!id) continue;
      const removed = r.source_status === "removed";
      const kind = removed ? "source-removed" : "source-modified";
      const sinceMs = Date.parse(r.since ?? "");
      const title = this.#titleOf(id);
      out.push({
        id: `FINDING::${kind}::${id}`,
        class: "FINDING",
        kind,
        case: this.#homesOf([id]),
        subject: { kind: "bundle", id },
        title,
        /* R43: the document's title, else `queue.source.untitled` with the local day of its earliest capture's retrieval (monitoring
           answers only the flag, so the day is read from provenance's register and receipts, R11); with none readable the fill
           is left empty and the gap is named in the job's REPORT. */
        summary: say(`queue.${kind}.summary`, { title: title ?? say("queue.source.untitled", { date: this.#capturedDay(id) }) }),
        summary_key: `queue.${kind}.summary`,
        detail: say("queue.source.detail"),
        detail_key: "queue.source.detail",
        basis: { source: "monitoring.flagged", bundle_id: id, source_status: r.source_status ?? null,
                 since: r.since ?? null,
                 bound: { limit: page.limit ?? null, truncated: page.truncated === true },
                 detail: localize("queue-producers.index.monitorings_tick_records_what_it", "monitoring's tick records what it saw and never decides what a change means (its R8): this item is that flag, as monitoring reads it (its R48).") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: r.since, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "unparseable_since",
              detail: localize("queue-producers.index.the_flag_carries_no_instant", "the flag carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([id]),
      });
    }
    return out;
  }

  /** The bounds the new producers read under (R2): reevaluation's largest page; R2's fifty projects. The monitored
   *  documents and the archive addresses are bounded by monitoring's reads (its R47, R48), which publish their bounds. */
  static QUEUE_NOTICES_MAX = 1000;
  static QUEUE_OBJECTIVE_GAP_PROJECTS = 50;
  /** D-86: the OBLIGATION items the sweep raised, for `queueFeed`. Synchronous, like every producer there. The
   *  row is gated by `#bundleGate` over the run's `context_id` — the predicate `aiRunRead` compiles for the run
   *  itself, so an item about a run is shown exactly to the readers of that run. A member who is not a recipient
   *  is skipped unless the producer could name nobody, which is stated on the item. */
  #obligationsBiasDebt(viewer, me, now) {
    /* N171: bias's `uncleared` (its R43), gated by membership's predicate over the context, newest raised first. */
    const debts = this.#bias.uncleared({ gate: viewerPredicate(viewer), limit: QueueProducers.BIAS_DEBT_QUEUE_MAX });
    const items = [];
    for (const row of QueueProducers.#answered(debts, "debts", "bias.uncleared")) {
      const named = Array.isArray(row.recipients) ? row.recipients.filter((x) => typeof x === "string") : [];
      if (me && named.length && !named.includes(me)) continue;
      const raisedMs = Date.parse(row.raised);
      items.push({
        id: `OBLIGATION::bias-debt::${row.run}`,
        class: "OBLIGATION",
        kind: "bias-debt",
        case: this.#homesOf([row.context_id]),
        subject: { kind: "run", id: row.run, context: { type: row.context_type, id: row.context_id } },
        summary: say("queue.bias-debt.summary"),
        summary_key: "queue.bias-debt.summary",
        detail: say("queue.bias-debt.detail"),
        detail_key: "queue.bias-debt.detail",
        basis: { source: "bias.uncleared", computed_by: "aiRunRead", run: row.run, moved: true,
                 moved_basis: row.moved_basis, lens_then: row.lens_then, lens_now: row.lens_now,
                 observed: row.observed,
                 stated: word("queue-producers.stated.run_lens_now", { force: String(row.lens_then ?? localize("queue-producers.index.none_in_force", "none in force")), handed: String(row.moved_basis === "at_open" ? localize("queue-producers.index.the_lens_in_force_when", "the lens in force when it opened") : localize("queue-producers.index.the_lens_it_was_handed", "the lens it was handed")), force3: String(row.lens_now ?? localize("queue-producers.index.none_in_force", "none in force")) }),
                 detail: localize("queue-producers.index.bias_debt_is_disclosed_and", "bias debt is DISCLOSED and travels with the work; only an uncleared hunch refuses publication (DEC-20). Whether the lens moved is op=airun's own comparison, read by the sweep and never recomputed.") },
        age: Number.isFinite(raisedMs)
          ? { state: "determined", since: row.raised, ms: Math.max(0, now - raisedMs) }
          : { state: "undetermined", reason: "unparseable_raised",
              detail: localize("queue-producers.index.the_debt_row_carries_a", "the debt row carries a raised stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        recipients: named,
        ...(named.length ? {} : { recipients_stated: localize("queue-producers.index.no_member_could_be_named", "no member could be named inside this run's read gate, so it is offered to every member who can read the run") }),
        options: this.#optionsOf([row.context_id]),
      });
    }
    return items;
  }
  static BIAS_DEBT_QUEUE_MAX = 200;

  /* ======================================================================
   * N345 — THE CONTRADICTIONS (R4–R7; DEC-76 item 3, DEC-84 items 1–3, 7 and 13, DEC-85 with K456).
   *
   * Each reads the fact its owning module offers and restates none of it: the candidates shown on a project
   * (`contradiction` R25), the notices on a project's own side (its R50), the dependents resting on a side named wrong
   * (`reevaluation` R27) and the tensions a published case did not disclose (`case-tensions` R4). Each is derived on
   * read and writes nothing, and each follows its provider's cursor under a stated bound of pages.
   *
   * WHAT THE PROVIDER WITHHOLDS STAYS WITHHELD. `candidatesFor` answers only a candidate whose two sides the viewer
   * may see, and `conflictNotices` only the side the viewer may see of one they see half; nothing here reads the
   * candidate any other way, so no item, home, count or flag can name the other side (R7, R11).
   * ====================================================================== */

  /** How many projects R4 and R7 ask about (R4: at most 50, in id order), and how many pages of one provider's answer
   *  are followed per project before the read is stated cut. */
  static QUEUE_CONTRADICTION_PROJECTS = 50;
  static QUEUE_CONTRADICTION_PAGES = 20;
  /** R6: how many owned projects `tension-after-publication` asks `case-tensions` about. */
  static QUEUE_TENSION_PROJECTS = 50;
  /** R5: the page `reevaluation.correctedDependents` is read in (its R27's largest). */
  static QUEUE_CORRECTED_PAGE = 200;

  /** The projects R4 and R7 ask about: those this viewer sees that the member has joined (joined or leaving,
   *  membership R74), every visible project when there is no member; at most 50 in id order, `truncated` when a
   *  further one qualifies. The same rule as `objective-gap`'s projects, under R4's own bound. */
  #contradictionProjects(me, viewer) {
    return this.#participatingProjects(me, viewer, QueueProducers.QUEUE_CONTRADICTION_PROJECTS);
  }

  /** The bundles a side lives in, as `contradiction` answers a side (its R25, R50): a claim's, a leg's or a stance's
   *  inquiry, a stance's project, and the document a leg's or an extent's content row is in. Each is a subject the
   *  item is homed from (queue R7, as `#homesAt`: a case side at depth 0 and everything above it). */
  static #sideSubjects(side) {
    if (!side || typeof side !== "object") return [];
    const ids = [side.inquiry, side.kind === "stance" ? side.project : null,
                 side.source && typeof side.source === "object" ? side.source.bundle : null];
    return [...new Set(ids.filter((x) => typeof x === "string" && x))];
  }

  /** R4's kinds: a duty open, taken up or explained and not shown; a lead open; a plurality open. Nothing else is an
   *  item: a dismissed or resolved candidate has left, and `not_shown` is never answered. */
  static #contradictionKind(weight, state) {
    if (weight === "duty" && ["open", "taken_up", "explained_not_shown"].includes(state))
      return { cls: "OBLIGATION", kind: "contradiction-duty" };
    if (weight === "lead" && state === "open") return { cls: "FINDING", kind: "contradiction-lead" };
    if (weight === "plurality" && state === "open") return { cls: "FINDING", kind: "contradiction-plurality" };
    return null;
  }

  /** `contradiction-duty`, `contradiction-lead` and `contradiction-plurality` (R4; N345): one item per candidate
   *  `contradiction.candidatesFor({on: {project}})` answers for each project of `scope`, counted once whatever number
   *  of those projects it reaches, and homed under both sides. */
  #contradictionItems(scope, viewer, now) {
    const found = new Map();
    let cut = false;
    for (const project of scope.projects) {
      let after = null;
      for (let page = 0; ; page += 1) {
        if (page === QueueProducers.QUEUE_CONTRADICTION_PAGES) { cut = true; break; }
        const r = QueueProducers.#via("contradiction.candidatesFor", () => this.#contradiction.candidatesFor({ on: { project }, after, viewer }));
        for (const c of QueueProducers.#answered(r, "candidates", "contradiction.candidatesFor")) {
          if (!c || typeof c.candidate !== "string" || !QueueProducers.#contradictionKind(c.weight, c.state)) continue;
          const e = found.get(c.candidate) || { c, projects: [] };
          if (!e.projects.includes(project)) e.projects.push(project);
          found.set(c.candidate, e);
        }
        if (!r.truncated || !r.cursor) break;
        after = r.cursor;
      }
    }
    const out = [];
    const ordered = [...found.values()].sort((x, y) => (x.c.candidate < y.c.candidate ? -1 : 1));
    /* R49: the rows every item's sides are homed from, read for all the candidates at once */
    this.#caseRows(ordered.flatMap(({ c }) => [...QueueProducers.#sideSubjects(c.a), ...QueueProducers.#sideSubjects(c.b)]), viewer);
    for (const { c, projects } of ordered) {
      const { cls, kind } = QueueProducers.#contradictionKind(c.weight, c.state);
      const subjects = [...new Set([...QueueProducers.#sideSubjects(c.a), ...QueueProducers.#sideSubjects(c.b)])];
      const atMs = Date.parse((c.machine && c.machine.at) ?? "");
      out.push({
        id: `${cls}::contradiction::${c.candidate}`,
        class: cls,
        kind,
        case: this.#homesAt(subjects, viewer),
        /* R8 (K558): the shape queue R46's dispositions read. `between_projects` is contradiction R25's, which names
           only the member's own party projects; `parties` is each of them with its opt-in. */
        subject: { kind: "contradiction_candidate", id: c.candidate, state: c.state,
                   ...(c.inquiry ? { inquiry: c.inquiry } : {}),
                   between_projects: Array.isArray(c.between_projects) ? c.between_projects : [],
                   parties: (Array.isArray(c.between_projects) ? c.between_projects : [])
                     .map((b) => ({ project: b.project, opted_in: b.opted_in ?? null })) },
        summary: say(`queue.${kind}.summary`),
        summary_key: `queue.${kind}.summary`,
        detail: say(kind === "contradiction-duty" ? `queue.contradiction-duty.detail.${c.state}` : `queue.${kind}.detail`),
        detail_key: kind === "contradiction-duty" ? `queue.contradiction-duty.detail.${c.state}` : `queue.${kind}.detail`,
        basis: { source: "contradiction.candidatesFor", candidate: c.candidate, key: c.key ?? null, why: c.why ?? null,
                 weight: c.weight, state: c.state, a: c.a ?? null, b: c.b ?? null, machine: c.machine ?? null,
                 resolution: c.resolution ?? null, inquiry: c.inquiry ?? null, reach: c.reach ?? null,
                 projects, between_projects: Array.isArray(c.between_projects) ? c.between_projects : [],
                 bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true,
                          pages_bound: QueueProducers.QUEUE_CONTRADICTION_PAGES, pages_truncated: cut },
                 detail: localize("queue-producers.index.a_candidate_is_contradictions_its", "a candidate is contradiction's (its R24–R26): its weight comes from the machine's label and its key, and its state from the members' acts, both read here and never restated. The machine's label and reason stay the machine's.") },
        age: Number.isFinite(atMs)
          ? { state: "determined", since: c.machine.at, ms: Math.max(0, now - atMs) }
          : { state: "undetermined", reason: "no_candidate_instant",
              detail: localize("queue-producers.index.the_candidate_carries_no_instant", "the candidate carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf(subjects),
      });
    }
    return out;
  }

  /** `side-corrected` (R5; N345, DEC-84 item 7): one FINDING per (dependent, candidate) `reevaluation`
   *  `correctedDependents` answers the viewer (its R27, which withholds a hidden dependent and does not count it), homed
   *  under the dependent and its ancestors. It leaves when the cause closes (a recorded re-evaluation, its R16). */
  #findingsSideCorrected(viewer, now) {
    const out = [];
    let after = null, cut = false, read = true;
    /* R49: the pages are followed first, then every dependent's title and home are read at once, and the items made */
    const held = [];
    for (let page = 0; ; page += 1) {
      if (page === QueueProducers.QUEUE_CONTRADICTION_PAGES) { cut = true; break; }
      const r = QueueProducers.#via("reevaluation.correctedDependents", () => this.#reevaluation.correctedDependents({ after, limit: QueueProducers.QUEUE_CORRECTED_PAGE, viewer }));
      const entries = QueueProducers.#answered(r, "entries", "reevaluation.correctedDependents");
      if (r.corrections_read === false) read = false;
      for (const e of entries) {
        if (!e || typeof e.dependent !== "string" || !e.dependent || typeof e.candidate !== "string" || !e.candidate)
          continue;
        held.push({ e, read, cut });
      }
      if (!r.truncated || !r.cursor) break;
      after = r.cursor;
    }
    this.#titlesOf(held.map((x) => x.e.dependent)); this.#caseRows(held.map((x) => x.e.dependent), viewer);
    for (const { e, read, cut } of held) {
      const name = this.#nameOf(e.dependent);
      const sinceMs = Date.parse(e.since ?? "");
      out.push({
        id: `FINDING::side-corrected::${e.dependent}::${e.candidate}`,
        class: "FINDING",
        kind: "side-corrected",
        case: this.#homesAt([e.dependent], viewer),
        subject: { kind: "bundle", id: e.dependent, candidate: e.candidate },
        summary: say("queue.side-corrected.summary", { name }),
        summary_key: "queue.side-corrected.summary",
        detail: e.reason ? say("queue.side-corrected.detail.reason", { reason: e.reason }) : say("queue.side-corrected.detail"),
        detail_key: e.reason ? "queue.side-corrected.detail.reason" : "queue.side-corrected.detail",
        basis: { source: "reevaluation.correctedDependents", dependent: e.dependent, candidate: e.candidate,
                 cause: e.kind ?? "corrected", reason: e.reason ?? null, member: e.member ?? null,
                 since: e.since ?? null, inquiry: e.inquiry ?? null, act: e.act ?? null,
                 legs: Array.isArray(e.legs) ? e.legs : [],
                 bound: { limit: QueueProducers.QUEUE_CORRECTED_PAGE, pages_bound: QueueProducers.QUEUE_CONTRADICTION_PAGES,
                          truncated: cut, corrections_read: read },
                 detail: localize("queue-producers.index.the_cause_is_reevaluations_its_3", "the cause is reevaluation's (its R27): a live leg of this finding rests on a side contradiction marks stale. It is read here, never raised, and no strength, conclusion or case moved.") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: e.since, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "no_marking_instant",
              detail: localize("queue-producers.index.the_marking_act_carries_no", "the marking act carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf([e.dependent]),
      });
    }
    return out;
  }

  /** The projects this viewer sees that the member OWNS (membership R65), in id order, at most `cap`. */
  #ownedProjects(me, viewer, cap) {
    /* R49: ONE statement, as `#participatingProjects`: the projects she owns (`owner` in membership's R120 contract, what
       `projectOwners` lists), that this viewer sees. */
    const gate = viewerPredicate(viewer);
    const rows = this.#rows(`SELECT b.bundle_id FROM bundles b JOIN project_participants mine ON mine.project_id = b.bundle_id
                              AND mine.member_id = ? AND mine.owner = 1
                              WHERE b.object_type='project' AND (${gate.sql}) ORDER BY b.bundle_id LIMIT ?`, me, ...gate.args, cap + 1);
    return { projects: rows.slice(0, cap).map((r) => r.bundle_id), bound: cap, truncated: rows.length > cap };
  }

  /** R49: the member who authored each observation of `ids` (`register`'s `authored` rows, provenance R48), every one not yet held
   *  read at once by one statement; null for one with no authored row. */
  #authorsOf(ids) {
    const held = this.#memo.authors;
    const todo = QueueProducers.#missing(held, ids);
    if (todo.length) {
      const found = new Map();
      for (const r of this.#rows(`SELECT r.bundle_id, r.author FROM register r WHERE r.authored=1
                                    AND r.bundle_id IN (SELECT value FROM json_each(?)) ORDER BY r.rowid`, JSON.stringify(todo)))
        if (!found.has(r.bundle_id)) found.set(r.bundle_id, r.author ?? null);
      for (const id of todo) held.set(id, found.get(id) ?? null);
    }
    return held;
  }

  /** R49: the owners of `projects` (membership R65: `owner` in R120's `project_participants`, in the order they became owners), each
   *  project not yet held read at once by one statement. */
  #ownersOf(projects) {
    const held = this.#memo.owners;
    const todo = QueueProducers.#missing(held, projects);
    if (todo.length) {
      const by = new Map(todo.map((id) => [id, []]));
      for (const r of this.#rows(`SELECT project_id, member_id FROM project_participants WHERE owner=1
                                    AND project_id IN (SELECT value FROM json_each(?))
                                   ORDER BY project_id, COALESCE(owner_order, 0), created, member_id`, JSON.stringify(todo)))
        by.get(r.project_id).push(r.member_id);
      for (const [id, owners] of by) held.set(id, owners);
    }
    return held;
  }

  /** `tension-after-publication` (R6; N345, DEC-84 item 13): one FINDING per (case, candidate) `case-tensions`
   *  `caseTensions({project})` answers (its R4, was publication R50; N612), for each project the member owns, at most 50. It goes to those
   *  owners and to nobody else: a caller with no member, or a member who owns no project, gets none. It leaves when a
   *  later edition discloses it or the candidate resolves (the read no longer answers it). */
  #findingsTensionAfterPublication(me, viewer, now) {
    void now;
    if (!me) return [];
    const scope = this.#ownedProjects(me, viewer, QueueProducers.QUEUE_TENSION_PROJECTS);
    const visible = this.#bundleRedactor(viewer);
    const found = new Map();
    let cut = false;
    for (const project of scope.projects) {
      let after = null;
      for (let page = 0; ; page += 1) {
        if (page === QueueProducers.QUEUE_CONTRADICTION_PAGES) { cut = true; break; }
        const r = QueueProducers.#via("case-tensions.caseTensions", () => this.#caseTensions.caseTensions({ project, after }));
        for (const c of QueueProducers.#answered(r, "cases", "case-tensions.caseTensions")) {
          for (const t of (c && Array.isArray(c.tensions) ? c.tensions : [])) {
            if (!t || typeof t.candidate !== "string" || !t.candidate) continue;
            const key = `${c.case}::${t.candidate}`;
            const e = found.get(key) || { c, t, project, members: [], named: [] };
            if (typeof t.member === "string") e.named.push(t.member);
            found.set(key, e);
          }
        }
        if (!r.cursor) break;
        after = r.cursor;
      }
    }
    /* R49: the sight of every member the tensions name is read at once; the members she may see are then kept, in order */
    visible.prefetch([...found.values()].flatMap((e) => e.named));
    for (const e of found.values())
      for (const m of e.named) if (visible(m) !== null && !e.members.includes(m)) e.members.push(m);
    this.#caseRows([...found.values()].map((e) => e.project), viewer);
    this.#caseRows([...found.values()].flatMap((e) => e.members), viewer);
    const out = [];
    for (const [key, { c, t, project, members }] of [...found.entries()].sort()) {
      if (members.length === 0) continue;           // R11: a case whose members this viewer cannot see names nothing
      out.push({
        id: `FINDING::tension-after-publication::${key}`,
        class: "FINDING",
        kind: "tension-after-publication",
        case: this.#homesAt([project], viewer),
        subject: { kind: "case", id: c.case, edition: c.edition ?? null, project, candidate: t.candidate,
                   bundles: members.slice(0, QueueProducers.QUEUE_OPTION_SUBJECTS_MAX) },
        ...(c.edition !== undefined && c.edition !== null && c.edition !== ""
          ? { summary: say("queue.tension-after-publication.summary", { case: c.case, edition: c.edition }), summary_key: "queue.tension-after-publication.summary" }
          : { summary: say("queue.tension-after-publication.summary.unnumbered", { case: c.case }), summary_key: "queue.tension-after-publication.summary.unnumbered" }),
        detail: say("queue.tension-after-publication.detail"),
        detail_key: "queue.tension-after-publication.detail",
        basis: { source: "case-tensions.caseTensions", case: c.case, edition: c.edition ?? null, project,
                 candidate: t.candidate, state: t.state ?? null, members, depth: t.depth ?? 1,
                 ...(t.unseen_other_side ? { unseen_other_side: true, side: t.side ?? null }
                                         : { a: t.a ?? null, b: t.b ?? null }),
                 ...(Array.isArray(c.unread) && c.unread.length ? { unread: c.unread } : {}),
                 bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true,
                          pages_bound: QueueProducers.QUEUE_CONTRADICTION_PAGES, pages_truncated: cut },
                 detail: localize("queue-producers.index.a_tension_after_publication_is", "a tension after publication is case-tensions' (its R4, was publication R50), read under the owning project's owners' sight: a side any owner may not see is answered unseen, with nothing of it. It is told to the project's owners and to nobody else, and it composes no strength.") },
        age: { state: "undetermined", reason: "derived_on_read",
               detail: localize("queue-producers.index.a_tension_is_derived_at", "a tension is derived at read time from the edition and the candidates; it has no creation instant") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf(members),
      });
    }
    return out;
  }

  /** `contradiction-duty-unseen` and `contradiction-plurality-unseen` (R7; DEC-85, K456): for each project of R4's
   *  scope, one item per notice `contradiction.conflictNotices({project})` answers (its R50), counted once whatever
   *  number of the member's projects it reaches. Its only subject is the side the member may see, so its homes are
   *  walked from that side alone. It carries the notice's fixed sentence, `asked_by_another`, each of the member's party
   *  projects with its opt-in, the parties once revealed, and the relay; and no count, bound or flag of its own, since
   *  any would say something of the other side or of how many parties there are (R11). A caller with no member is no
   *  project's joined participant and is told nothing (contradiction R50's refusal). */
  #contradictionUnseenItems(me, scope, viewer) {
    if (!me) return [];
    const found = new Map();
    for (const project of scope.projects) {
      let after = null;
      for (let page = 0; page < QueueProducers.QUEUE_CONTRADICTION_PAGES; page += 1) {
        const r = QueueProducers.#via("contradiction.conflictNotices", () => this.#contradiction.conflictNotices({ project, after, viewer }));
        /* R50: a project this viewer is told nothing about (not a participant, or the project not hers to see) has no notice for her */
        if (r && r.ok === false && TOLD_NOTHING.includes(codeOf(r))) break;
        for (const n of QueueProducers.#answered(r, "notices", "contradiction.conflictNotices")) {
          if (!n || typeof n.candidate !== "string" || (n.weight !== "duty" && n.weight !== "plurality")) continue;
          const e = found.get(n.candidate) || { n, parties: [] };
          if (!e.parties.some((p) => p.project === n.project))
            e.parties.push({ project: n.project, opted_in: n.opted_in ?? null, asked_by_another: n.asked_by_another === true,
                             revealed: n.revealed === true, ...(n.revealed === true ? { parties: n.parties ?? [] } : {}),
                             responses: Array.isArray(n.responses) ? n.responses : [],
                             ...(n.reveal_undetermined ? { reveal_undetermined: true, reveal_why: n.reveal_why ?? null } : {}) });
          found.set(n.candidate, e);
        }
        if (!r.truncated || !r.cursor) break;
        after = r.cursor;
      }
    }
    const out = [];
    this.#caseRows([...found.values()].flatMap(({ n }) => QueueProducers.#sideSubjects(n.side)), viewer);
    for (const [candidate, { n, parties }] of [...found.entries()].sort()) {
      const duty = n.weight === "duty";
      const cls = duty ? "OBLIGATION" : "FINDING";
      const subjects = QueueProducers.#sideSubjects(n.side);
      const responses = [];
      for (const p of parties)
        for (const x of p.responses)
          if (!responses.some((y) => y.response === x.response)) responses.push(x);
      out.push({
        id: `${cls}::contradiction-unseen::${candidate}`,
        class: cls,
        kind: duty ? "contradiction-duty-unseen" : "contradiction-plurality-unseen",
        case: this.#homesAt(subjects, viewer),
        /* R8 (K558): the member's projects that hold R50's notice, each with its opt-in. */
        subject: { kind: "contradiction_notice", id: candidate,
                   parties: parties.map((p) => ({ project: p.project, opted_in: p.opted_in ?? null })) },
        summary: say(`queue.${duty ? "contradiction-duty-unseen" : "contradiction-plurality-unseen"}.summary`),
        summary_key: `queue.${duty ? "contradiction-duty-unseen" : "contradiction-plurality-unseen"}.summary`,
        detail: say(`queue.${duty ? "contradiction-duty-unseen" : "contradiction-plurality-unseen"}.detail`),
        detail_key: `queue.${duty ? "contradiction-duty-unseen" : "contradiction-plurality-unseen"}.detail`,
        basis: { source: "contradiction.conflictNotices", candidate, weight: n.weight, state: n.state ?? null,
                 side: n.side ?? null, says: n.says ?? null,
                 asked_by_another: parties.some((p) => p.asked_by_another),
                 projects: parties, responses,
                 detail: localize("queue-producers.index.a_notice_is_contradictions_its", "a notice is contradiction's (its R50): it names the side this project rests on and nothing of the other, nor who holds it, nor how many do. Your project can ask to resolve it; when every project holding a side has asked, the projects are named to each other and each can respond, sharing only what its responder chose.") },
        age: { state: "undetermined", reason: "derived_on_read",
               detail: localize("queue-producers.index.a_notice_is_derived_at", "a notice is derived at read time and carries no instant of its own") },
        assignee: null,
        assignee_role: null,
        options: this.#optionsOf(subjects),
      });
    }
    return out;
  }

  /* ======================================================================
   * N375 · R14 — A MEMBER'S OWN SIGNING KEY, TOLD TO EVERY ADMINISTRATOR (credentials R9, was membership R89).
   * ====================================================================== */

  /** R14: the act an administrator takes on a self-registered key, credentials R7's revoke (`op=signerset`). */
  static SIGNER_REVOKE = Object.freeze({ id: "signerset", label: word("queue-producers.label.revoke_signing_key"), weight: "single" });

  /** `signer-self-registered` (R14; credentials R8, R9; N375): for an administrator member (membership R64), or the
   *  `admin` machine credential as export-performed's reader is, one OBLIGATION per key `credentials.signerList`
   *  answers `active` with `origin: "self"`, naming the key's comment and its member, aged from its `added` instant, and
   *  offering credentials R7's revoke. Every other reader gets none, and not a count. It leaves when the key is no longer
   *  `active`, or when its row carries `known_by` (R55; credentials R83's `signerKnown`): the list is read at every read, so nothing is stored to clear. */
  #obligationsSignerSelfRegistered(me, viewer, now) {
    const admin = me ? this.#isAdminMember(me) : viewer === `${MACHINE_CLASS_PREFIX}admin`;
    if (!admin) return [];
    const list = this.#credentials.signerList();
    const keys = QueueProducers.#answered(list, "signers", "credentials.signerList")
      .filter((k) => k && k.status === "active" && k.origin === "self" && typeof k.key_b64 === "string" && k.key_b64
        && !k.known_by);                                       // R55: an administrator said they know of it (credentials R83)
    if (keys.length === 0) return [];
    const raisedTo = this.#activeAdmins();
    const homes = this.#homesOf([]);
    const registrant = (k) => (k.registered_by && k.registered_by !== "not recorded" ? k.registered_by : k.member_id);
    /* A-03 (K5257): the member who registered a key is told nothing of it: she did it, and has nothing to decide. */
    return keys.filter((k) => !me || registrant(k) !== me).map((k) => {
      const addedMs = Date.parse(k.added ?? "");
      const member = registrant(k);
      return {
        id: `OBLIGATION::signer-self-registered::${k.key_b64}`,
        class: "OBLIGATION",
        kind: "signer-self-registered",
        case: homes,
        subject: { kind: "signer_key", id: k.key_b64, member: k.member_id ?? null, comment: k.comment ?? null,
                   registered_by: member ?? null },
        ...(() => {
          const name = member ? this.#memberName(member) : "";
          const key = `queue.signer-self-registered.summary${member ? "" : ".unnamed"}${k.comment ? ".comment" : ""}`;
          return { summary: say(key, { member: name, comment: k.comment }), summary_key: key };
        })(),
        detail: say("queue.signer-self-registered.detail"),
        detail_key: "queue.signer-self-registered.detail",
        basis: { source: "credentials.signerList", key: k.key_b64, member: k.member_id ?? null, comment: k.comment ?? null,
                 registered_by: member ?? null, origin: "self", status: k.status, added: k.added ?? null,
                 attests: k.attests === true, raised_to: Array.isArray(raisedTo) ? raisedTo.filter((a) => a !== member) : raisedTo,
                 detail: localize("queue-producers.index.the_key_is_credentials_own", "the key is credentials' own row (its R8), registered by its member (its R9) and read here at every read: it is told to every administrator but the one who registered the key, and to nobody else, and it leaves when the key is no longer active, by an administrator's revoke (its R7) or otherwise.") },
        age: Number.isFinite(addedMs)
          ? { state: "determined", since: k.added, ms: Math.max(0, now - addedMs) }
          : { state: "undetermined", reason: "unparseable_added",
              detail: localize("queue-producers.index.the_keys_row_carries_an", "the key's row carries an added stamp this producer cannot read as an instant") },
        assignee: null,
        assignee_role: null,
        options: [QueueProducers.SIGNER_REVOKE],
      };
    });
  }

  /* ======================================================================
   * DEC-102 item 3 · R23 — THE CREDIT LEVEL A MEMBER HAS NOT CHOSEN (publication R2, R17, R56; provenance R48; K1019, K1105).
   * ====================================================================== */

  /** R23: how many prepared, unsigned case editions one read asks about, and the act that answers the item (publication
   *  R17, `op=attribute`: the observation's author chooses the level, with a reason). */
  static QUEUE_PREPARED_EDITIONS_MAX = 200;
  static ATTRIBUTE_CHOOSE = Object.freeze({ id: "attribute", label: word("queue-producers.label.choose_how_case"), weight: "single" });

  /** `attribution-unchosen` (R23; DEC-102 item 3): one OBLIGATION per (case edition, observation) where a prepared,
   *  unsigned case edition reaches an observation the member authored and no credit level is in force for it, to that
   *  member and to nobody else. The editions are listed from `case_documents` (publication R56's read contract:
   *  `sig_armored` null is authored and unsigned), the latest unsigned edition of each case only, since a later edition
   *  replaces an earlier preparation; each is asked of `publication.caseDocumentFacts` under the viewer, whose standing
   *  fence (publication R1) answers nothing to a viewer without standing in the case. Its attribution facts (R17) name
   *  each reached observation and the level in force, null when none can be published; the observation's author is
   *  `register`'s (`authored = 1`, `author`; provenance R48), never publication's. Nothing names the author to anyone
   *  else: the item is the author's alone and carries no count. It leaves when the member chooses a level, or the
   *  edition no longer reaches the observation, or it is signed or replaced (the reads no longer answer it); raised
   *  once (DEC-69, DEC-94). Its age runs from the edition's preparation (`authored_at`). */
  #obligationsAttributionUnchosen(me, viewer, now) {
    if (!me) return [];
    const cap = QueueProducers.QUEUE_PREPARED_EDITIONS_MAX;
    /* A store publication has not migrated holds no case document (the plane migrates it with every module; a caller's
       test world may not), so it prepares none: asked, never thrown over. */
    if (!this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='case_documents'`)) return [];
    const rows = this.#rows(
      `SELECT cd.case_id, cd.edition, cd.authored_at FROM case_documents cd
        WHERE cd.sig_armored IS NULL
          AND NOT EXISTS (SELECT 1 FROM case_documents later WHERE later.case_id = cd.case_id AND later.edition > cd.edition)
        ORDER BY cd.case_id, cd.edition LIMIT ?`, cap + 1);
    const truncated = rows.length > cap;
    const prepared = [];
    for (const e of rows.slice(0, cap)) {
      const facts = this.#publication.caseDocumentFacts(e.case_id, Number(e.edition), viewer);
      if (!facts || facts.ok !== true || !facts.doc || facts.doc.sig_armored) continue;
      prepared.push({ e, current: facts.attribution && Array.isArray(facts.attribution.current) ? facts.attribution.current : [] });
    }
    /* R49: the authors and titles of every observation the editions reach are read at once */
    const reached = prepared.flatMap(({ current }) => current.map((row) => (row && typeof row.observation === "string" ? row.observation : "")).filter(Boolean));
    const authors = this.#authorsOf(reached); this.#titlesOf(reached);
    const authored = (obs) => authors.get(obs) ?? null;
    const out = [];
    for (const { e, current } of prepared) {
      for (const row of current) {
        const obs = row && typeof row.observation === "string" ? row.observation : "";
        if (!obs || row.level || authored(obs) !== me) continue;
        const preparedMs = Date.parse(e.authored_at ?? "");
        const name = this.#nameOf(obs);
        out.push({
          id: `OBLIGATION::attribution-unchosen::${e.case_id}@${e.edition}::${obs}`,
          class: "OBLIGATION",
          kind: "attribution-unchosen",
          case: this.#homesOf([obs]),
          subject: { kind: "case_edition", id: `${e.case_id}@${e.edition}`, case: e.case_id, edition: Number(e.edition),
                     observation: obs },
          summary: say("queue.attribution-unchosen.summary", { case: e.case_id, observation: name }),
          summary_key: "queue.attribution-unchosen.summary",
          detail: say("queue.attribution-unchosen.detail", { edition: Number(e.edition) }),
          detail_key: "queue.attribution-unchosen.detail",
          basis: { source: "publication.caseDocumentFacts + case_documents + register", case: e.case_id,
                   edition: Number(e.edition), observation: obs, prepared_at: e.authored_at ?? null,
                   level: null, why: row.why ?? null, recipients_rule: "author",
                   bound: { editions_limit: cap, truncated },
                   detail: localize("queue-producers.index.the_edition_is_publications_prepared", "the edition is publication's prepared, unsigned case document (its R56), its attribution facts its own (its R2, R17); the observation's author is the register's (provenance R48). Only the author chooses the level (DEC-102 item 3), so only the author is told.") },
          age: Number.isFinite(preparedMs)
            ? { state: "determined", since: e.authored_at, ms: Math.max(0, now - preparedMs) }
            : { state: "undetermined", reason: "no_preparation_instant",
                detail: localize("queue-producers.index.the_case_document_carries_no", "the case document carries no instant this producer can read") },
          assignee: null,
          assignee_role: null,
          recipients: [me],
          options: [QueueProducers.ATTRIBUTE_CHOOSE],
        });
      }
    }
    return out;
  }

  /* ======================================================================
   * N520 · R30, R31 — THE DOCKET (docket R9; reevaluation R30; DEC-116 items 2, 3, 7).
   * Each reads the one fact its owning module offers, derived on read and writing nothing, so an item leaves on the
   * first read after the fact stops holding.
   * ====================================================================== */

  /** R30: the acts that answer a core item (docket R4, R7): placing it, and, for a submission, declining it. */
  static DOCKET_PREPARE = Object.freeze({ id: "docketprepare", label: word("queue-producers.label.place_case_docket"), weight: "single" });
  static DOCKET_DECLINE = Object.freeze({ id: "docketdecline", label: word("queue-producers.label.decline_containing_redactions"), weight: "single" });
  /** R30: the core items docket R9 (a)–(c) names, each read as `queue.docket-core-due.what.<kind>`. */
  static DOCKET_CORE_KINDS = Object.freeze(["response", "statement", "edition", "tension"]);
  /** R31: the item kind of each docket cause (reevaluation R30 (a), (b)). */
  static DOCKET_CAUSE_KINDS = Object.freeze({ withdrawal: "edition-withdrawn", contested: "edition-contested" });
  /** R31: the page `reevaluation.docketDependents` is read in (its R30's largest). */
  static QUEUE_DOCKET_PAGE = 200;

  /** R49: the project of each of `caseIds`, from publication's `cases` (its R40, a stated read contract); null when none. Every case
   *  not yet held is read at once by one statement. */
  #caseProjects(caseIds) {
    const held = this.#memo.caseProject;
    const todo = QueueProducers.#missing(held, caseIds);
    if (todo.length) {
      const found = this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='cases'`)
        ? new Map(this.#rows(`SELECT case_id, project_id FROM cases WHERE case_id IN (SELECT value FROM json_each(?))`, JSON.stringify(todo))
                    .map((r) => [r.case_id, r.project_id]))
        : new Map();
      for (const id of todo) held.set(id, typeof found.get(id) === "string" && found.get(id) ? found.get(id) : null);
    }
    return held;
  }

  /** `docket-core-due` (R30; docket R9; DEC-116 item 2): one OBLIGATION per core item `docket.coreDue` answers the viewer,
   *  keyed by the case, the item's kind and its reference, to the case's manager (its project's owners, membership R65)
   *  and to nobody else: a caller with no member is none of them. Its subject the case, naming the item and its edition;
   *  offering placement and, for a submission (a response or a statement), the decline; aged from the item's `since`.
   *  It leaves when the item is done (the read no longer answers it); raised once (DEC-69, DEC-94). */
  #obligationsDocketCoreDue(me, viewer, now) {
    if (!me) return [];
    const r = this.#docket.coreDue({ viewer });
    const list = QueueProducers.#answered(r, "items", "docket.coreDue");
    const visible = this.#bundleRedactor(viewer);
    const out = [];
    /* R49: the cases' projects, the projects' sight and owners and their homes, each read for every item at once */
    const projects = this.#caseProjects(list.map((x) => (x && typeof x.case === "string" ? x.case : null)));
    const named = [...new Set([...projects.values()].filter(Boolean))];
    visible.prefetch(named); this.#ownersOf(named); this.#caseRows(named, viewer);
    for (const x of list) {
      if (!x || typeof x.case !== "string" || !x.case || typeof x.kind !== "string" || !x.kind
          || x.ref === undefined || x.ref === null || x.ref === "") continue;
      const project = projects.get(x.case) ?? null;
      if (!project || visible(project) === null) continue;
      const managers = this.#ownersOf([project]).get(project);
      if (!managers.includes(me)) continue;
      /* a kind docket names that the word list holds no `what` for is left empty (R43; named in the job's REPORT) */
      const known = QueueProducers.DOCKET_CORE_KINDS.includes(x.kind);
      const what = known ? say(`queue.docket-core-due.what.${x.kind}`) : "";
      const submission = x.kind === "response" || x.kind === "statement";
      const edition = Number.isInteger(Number(x.edition)) && x.edition !== null ? Number(x.edition) : null;
      const sinceMs = Date.parse(x.since ?? "");
      out.push({
        id: `OBLIGATION::docket-core-due::${x.case}::${x.kind}::${x.ref}`,
        class: "OBLIGATION",
        kind: "docket-core-due",
        case: this.#homesAt([project], viewer),
        subject: { kind: "case", id: x.case, project, item: x.kind, ref: String(x.ref), edition },
        ...(edition !== null
          ? { summary: say("queue.docket-core-due.summary.edition", { case: x.case, what, edition }), summary_key: "queue.docket-core-due.summary.edition" }
          : { summary: say("queue.docket-core-due.summary", { case: x.case, what }), summary_key: "queue.docket-core-due.summary" }),
        detail: joined(known ? say(`queue.docket-core-due.detail.${x.kind}`, { edition }) : "", say("queue.docket-core-due.detail.tail")),
        detail_key: known ? `queue.docket-core-due.detail.${x.kind}` : "queue.docket-core-due.detail.tail",
        basis: { source: "docket.coreDue", case: x.case, project, item: x.kind, ref: String(x.ref), edition,
                 since: x.since ?? null, ...(x.what_changed !== undefined ? { what_changed: x.what_changed } : {}),
                 ...(x.state !== undefined ? { state: x.state } : {}), recipients_rule: "case_managers",
                 detail: localize("queue-producers.index.a_core_item_still_due", "a core item still due is docket's fact (its R9), read here and never stored; the case's project is publication's (its R40). It goes to the case's managers, its project's owners, and to nobody else (DEC-116 item 2), and is raised once (DEC-69, DEC-94).") },
        age: Number.isFinite(sinceMs)
          ? { state: "determined", since: x.since, ms: Math.max(0, now - sinceMs) }
          : { state: "undetermined", reason: "no_due_instant",
              detail: localize("queue-producers.index.the_item_carries_no_instant", "the item carries no instant this producer can read for when it fell due") },
        assignee: null,
        assignee_role: null,
        recipients: [...managers],
        options: submission ? [QueueProducers.DOCKET_PREPARE, QueueProducers.DOCKET_DECLINE] : [QueueProducers.DOCKET_PREPARE],
      });
    }
    return out;
  }

  /** `edition-withdrawn` and `edition-contested` (R31; reevaluation R30; DEC-116 items 3, 7): one FINDING per
   *  (dependent, entry) `reevaluation.docketDependents` answers the viewer (which withholds a hidden dependent and does
   *  not count it), keyed by the kind, the dependent and the entry the listing names (`<case>#<seq>` for a withdrawal;
   *  for a contesting entry, its record entry id), homed under the dependent and its ancestors. It leaves when the cause
   *  closes (a recorded re-evaluation, reevaluation R16), as R5's. */
  #findingsDocketDependents(viewer, now) {
    const out = [];
    let after = null, cut = false, flags = {};
    for (let page = 0; ; page += 1) {
      if (page === QueueProducers.QUEUE_CONTRADICTION_PAGES) { cut = true; break; }
      const r = this.#reevaluation.docketDependents({ after, limit: QueueProducers.QUEUE_DOCKET_PAGE, viewer });
      const entries = QueueProducers.#answered(r, "entries", "reevaluation.docketDependents");
      if (r.docket_absent) flags = { ...flags, docket_absent: true };
      if (r.docket_read === false) flags = { ...flags, docket_read: false };
      /* R49: the page's dependents' titles and homes are read at once */
      this.#titlesOf(entries.map((e) => e && e.dependent)); this.#caseRows(entries.map((e) => e && e.dependent), viewer);
      for (const e of entries) {
        const kind = e ? QueueProducers.DOCKET_CAUSE_KINDS[e.kind] : null;
        if (!kind || typeof e.dependent !== "string" || !e.dependent || typeof e.entry !== "string" || !e.entry) continue;
        const name = this.#nameOf(e.dependent);
        const withdrawn = kind === "edition-withdrawn";
        const editions = withdrawn
          ? (Array.isArray(e.withdrawn_editions) ? e.withdrawn_editions : [])
          : (e.edition !== undefined && e.edition !== null ? [e.edition] : []);
        const cs = typeof e.case === "string" && e.case ? say("queue.docket-case.named", { case: e.case }) : say("queue.docket-case.unnamed");
        const sinceMs = Date.parse(e.since ?? "");
        const summaryKey = withdrawn ? "queue.edition-withdrawn.summary" : "queue.edition-contested.summary";
        const detailKey = withdrawn
          ? (editions.length ? `queue.edition-withdrawn.detail.${editions.length === 1 ? "one" : "other"}` : "queue.edition-withdrawn.detail")
          : (editions.length ? "queue.edition-contested.detail.numbered" : "queue.edition-contested.detail");
        out.push({
          id: `FINDING::${kind}::${e.dependent}::${e.entry}`,
          class: "FINDING",
          kind,
          case: this.#homesAt([e.dependent], viewer),
          subject: { kind: "bundle", id: e.dependent, case: e.case ?? null, entry: e.entry, editions },
          summary: say(summaryKey, { case: cs, name }),
          summary_key: summaryKey,
          detail: say(detailKey, { case: cs, editions: editions.join(", "), edition: editions[0] }),
          detail_key: detailKey,
          basis: { source: "reevaluation.docketDependents", dependent: e.dependent, entry: e.entry, cause: e.kind,
                   case: e.case ?? null, editions, since: e.since ?? null, legs: Array.isArray(e.legs) ? e.legs : [],
                   cause_detail: e.detail ?? null, ...flags,
                   bound: { limit: QueueProducers.QUEUE_DOCKET_PAGE, pages_bound: QueueProducers.QUEUE_CONTRADICTION_PAGES,
                            truncated: cut },
                   detail: localize("queue-producers.index.the_cause_is_reevaluations_its", "the cause is reevaluation's (its R30): a live leg of this finding rests on a member finding of a withdrawn case edition, or this finding is a member of an edition a filed response contests. It is read here, never raised, and nothing was regraded.") },
          age: Number.isFinite(sinceMs)
            ? { state: "determined", since: e.since, ms: Math.max(0, now - sinceMs) }
            : { state: "undetermined", reason: "no_cause_instant",
                detail: localize("queue-producers.index.the_cause_carries_no_instant", "the cause carries no instant this producer can read") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([e.dependent]),
        });
      }
      if (!r.truncated || !r.cursor) break;
      after = r.cursor;
    }
    if (cut) for (const it of out) it.basis.bound.truncated = true;
    return out;
  }

  /* ======================================================================
   * N534 · R34, R35 — WATCHED CASES AT THEIR PUBLISHERS (reevaluation R33; case-import R20; DEC-101 (3), DEC-116 item 8).
   * Each reads the one fact its owning module offers, derived on read and writing nothing, so an item leaves on the first
   * read after the fact stops holding. Only a publisher move (a verified `edition` or `withdrawal` entry) is a cause of
   * re-evaluation (R34); every verified entry, a move or not, reaches only the member who set the watch (R35; K1339,
   * K1366 F1).
   * ====================================================================== */

  /** R34: the item kind of each publisher move (reevaluation R33 (a), (b)), and the page its listing is read in (its
   *  largest). */
  static CITED_MOVE_KINDS = Object.freeze({ edition: "cited-newer-edition", withdrawal: "cited-edition-withdrawn" });
  static QUEUE_CITED_PAGE = 200;
  /** R35: the acts a watch's item offers (case-import R4, R17): reading the imported case with its docket entries, and,
   *  for an unreadable docket, setting the watch's address again or ending the watch. */
  static IMPORT_READ = Object.freeze({ id: "importedcase", label: word("queue-producers.label.read_imported_case"), weight: "single" });
  static IMPORT_REWATCH = Object.freeze({ id: "importwatch", label: word("queue-producers.label.set_publisher_address"), weight: "single" });
  static IMPORT_UNWATCH = Object.freeze({ id: "importunwatch", label: word("queue-producers.label.stop_following_case"), weight: "single" });

  /** The words naming another group's case, as far as the viewer is told it (reevaluation R33 states the group and case
   *  only where the viewer sees the imported reference): `queue.cited-case.both|case|group|none`. */
  #citedCaseWords(group, cs) {
    const g = typeof group === "string" && group ? group : null, c = typeof cs === "string" && cs ? cs : null;
    return say(`queue.cited-case.${c && g ? "both" : c ? "case" : g ? "group" : "none"}`, { case: c, group: g });
  }

  /** What one entry seen at a publisher's docket says, quoted, as sentences: a move's `what_changed` or `reason`, its
   *  signing key where it is not among those the imported case file lists, and its take-back (R34, R35). */
  #entryWords(e, { key = true } = {}) {
    const said = e.kind === "edition" && typeof e.what_changed === "string" && e.what_changed
      ? say("queue.docket-entry.said.edition", { said: e.what_changed })
      : e.kind === "withdrawal" && typeof e.reason === "string" && e.reason
        ? say("queue.docket-entry.said.withdrawal", { said: e.reason }) : "";
    const unlisted = key && e.key_listed === false ? say("queue.docket-entry.key-unlisted") : "";
    const back = e.taken_back && typeof e.taken_back === "object"
      ? (() => {
          const numbered = e.taken_back.seq !== undefined && e.taken_back.seq !== null && e.taken_back.seq !== "";
          const date = e.taken_back.date ? this.#dayWord(String(e.taken_back.date)) : "";
          const k = `queue.docket-entry.taken-back${numbered ? "" : ".unnumbered"}${date ? ".dated" : ""}`;
          return say(k, { seq: e.taken_back.seq, date });
        })() : "";
    return [said, unlisted, back];
  }

  /** `cited-newer-edition` and `cited-edition-withdrawn` (R34; reevaluation R33; DEC-101 (3)): one FINDING per
   *  (dependent, move) `reevaluation.citedCaseDependents` answers the viewer (which withholds a hidden dependent and does
   *  not count it), by the move's kind, keyed `FINDING::<kind>::<dependent>::<import>#<seq>`, homed under the dependent
   *  and its ancestors. Its detail names the group, the case, the cited edition, the edition the move names, and quotes
   *  `what_changed` or `reason`; it says when the entry's signing key is not among the keys the imported case file lists,
   *  and when the move was taken back (the cause still stands). It leaves when the cause closes (a recorded
   *  re-evaluation, reevaluation R16), as R31's. */
  #findingsCitedCaseMoved(viewer, now) {
    const out = [];
    const seen = new Set();
    let after = null, cut = false, flags = {};
    for (let page = 0; ; page += 1) {
      if (page === QueueProducers.QUEUE_CONTRADICTION_PAGES) { cut = true; break; }
      const r = this.#reevaluation.citedCaseDependents({ after, limit: QueueProducers.QUEUE_CITED_PAGE, viewer });
      const entries = QueueProducers.#answered(r, "entries", "reevaluation.citedCaseDependents");
      if (r.accepted_work_absent) flags = { ...flags, accepted_work_absent: true };
      if (r.accepted_work_unreadable) flags = { ...flags, accepted_work_unreadable: true };
      this.#titlesOf(entries.map((e) => e && e.dependent)); this.#caseRows(entries.map((e) => e && e.dependent), viewer);
      for (const e of entries) {
        const kind = e ? QueueProducers.CITED_MOVE_KINDS[e.kind] : null;
        if (!kind || typeof e.dependent !== "string" || !e.dependent || typeof e.import !== "string" || !e.import
            || !Number.isInteger(Number(e.seq)) || e.seq === null || e.seq === "") continue;
        const id = `FINDING::${kind}::${e.dependent}::${e.import}#${Number(e.seq)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const name = this.#nameOf(e.dependent);
        const legs = Array.isArray(e.legs) ? e.legs : [];
        const cited = [...new Set(legs.map((l) => l && l.cited_edition).filter((x) => x !== undefined && x !== null))]
          .sort((a, b) => Number(a) - Number(b));
        const edition = e.edition === "all" ? "all" : e.edition === undefined || e.edition === null ? null : Number(e.edition);
        const withdrawn = kind === "cited-edition-withdrawn";
        const whose = this.#citedCaseWords(e.group ?? null, e.case ?? null);
        const citedWords = cited.length ? say(`queue.cited-editions.${cited.length === 1 ? "one" : "other"}`, { list: cited.join(", ") }) : say("queue.cited-editions.none");
        const numbered = Number.isInteger(edition);
        const detailKey = withdrawn
          ? `queue.cited-edition-withdrawn.detail.${edition === "all" ? "all" : numbered ? "numbered" : "unnumbered"}`
          : `queue.cited-newer-edition.detail.${numbered ? "numbered" : "unnumbered"}`;
        const summaryKey = withdrawn ? "queue.cited-edition-withdrawn.summary"
          : numbered ? "queue.cited-newer-edition.summary" : "queue.cited-newer-edition.summary.unnumbered";
        const entryDay = e.date ? this.#dayWord(String(e.date)) : "";
        const sinceMs = Date.parse(e.since ?? "");
        out.push({
          id,
          class: "FINDING",
          kind,
          case: this.#homesAt([e.dependent], viewer),
          subject: { kind: "bundle", id: e.dependent, import: e.import, group: e.group ?? null, case: e.case ?? null,
                     move: e.move ?? null, seq: Number(e.seq), cited_editions: cited, edition },
          summary: say(summaryKey, { name, cited: citedWords, whose, edition }),
          summary_key: summaryKey,
          detail: joined(say(detailKey, { whose, edition, cited: citedWords }),
                         entryDay ? say("queue.cited-docket.detail.dated", { date: entryDay }) : "",
                         ...this.#entryWords(e), say("queue.cited-docket.detail.tail")),
          detail_key: detailKey,
          basis: { source: "reevaluation.citedCaseDependents", dependent: e.dependent, move: e.move ?? null, import: e.import,
                   group: e.group ?? null, case: e.case ?? null, move_kind: e.kind, edition, seq: Number(e.seq),
                   date: e.date ?? null, since: e.since ?? null,
                   ...(e.kind === "edition" ? { what_changed: e.what_changed ?? null } : { reason: e.reason ?? null }),
                   key_listed: typeof e.key_listed === "boolean" ? e.key_listed : null, taken_back: e.taken_back ?? null,
                   cited_editions: cited, legs, cause_detail: e.detail ?? null, ...flags,
                   bound: { limit: QueueProducers.QUEUE_CITED_PAGE, pages_bound: QueueProducers.QUEUE_CONTRADICTION_PAGES,
                            truncated: cut },
                   detail: localize("queue-producers.index.the_cause_is_reevaluations_its_2", "the cause is reevaluation's (its R33): a live leg of this finding rests on another team's finding at an edition whose publisher has since listed a later edition or withdrawn it on its docket, a verified entry your team's Civicsmith read. It is read here, never raised, and nothing was regraded.") },
          age: Number.isFinite(sinceMs)
            ? { state: "determined", since: e.since, ms: Math.max(0, now - sinceMs) }
            : { state: "undetermined", reason: "no_cause_instant",
                detail: localize("queue-producers.index.the_cause_carries_no_instant_2", "the cause carries no instant this producer can read") },
          assignee: null,
          assignee_role: null,
          options: this.#optionsOf([e.dependent]),
        });
      }
      if (!r.truncated || !r.cursor) break;
      after = r.cursor;
    }
    if (cut) for (const it of out) it.basis.bound.truncated = true;
    return out;
  }

  /** Who a watch's items go to (R35): the member who set the watch in force, while an active member (membership R68's
   *  status); else the administrators (membership R86); with the rule that chose them. */
  #watchRecipients(setBy) {
    const who = typeof setBy === "string" ? setBy.trim() : "";
    const facts = who ? this.#membership.memberFacts(who) : null;
    if (facts && facts.status === "active") return { rule: "watch_setter", members: [who] };
    return { rule: "administrators", members: this.#activeAdmins() };
  }

  /** `followed-case-entry`, `cited-docket-entry-refused` and `cited-docket-unreadable` (R35; case-import R20; DEC-101 (3),
   *  DEC-116 item 8): what `case-import.watchItems` answers the viewer, each to the member who set the watch, else (that
   *  member no longer active) the administrators, and to nobody else: a caller with no member is none of them. Each
   *  item's subject is the import, and it has no project home. A verified entry that is not
   *  a publisher move reaches only them here, and never as a cause of re-evaluation (R34 reads moves alone).
   *  - one FINDING per verified entry seen, keyed `FINDING::followed-case-entry::<import>#<seq>`, naming its kind,
   *    edition, date and `key_listed`, and quoting a move's `what_changed` or `reason`;
   *  - one FINDING per refused entry, keyed `FINDING::cited-docket-entry-refused::<import>#<seq>`, naming the check
   *    failed (refused copies of one `seq` are one item, naming every check, aged from the first copy read; a refused
   *    entry with no readable `seq` is keyed `<import>#unnumbered`);
   *  - each finding ages from the instant this copy read its entry (`seen_at`; N546);
   *  - one CONDITION per watch in force whose latest read is unreadable, keyed `CONDITION::cited-docket-unreadable::<import>`,
   *    its detail opening with DOCKET_UNREADABLE's sentence (docket R15) and giving the reason and the instant, aged from
   *    it; it leaves when a read succeeds or the watch ends.
   *  The findings are raised once and leave when their recipient disposes of them (queue's mint). */
  #watchItems(me, viewer, now) {
    if (!me) return [];
    const r = this.#caseImport.watchItems({ viewer });
    if (!r || typeof r !== "object" || r.ok === false || r.state === "undetermined") throw new FeedFail(r && r.state === "undetermined" ? "undetermined" : "refused", "case-import.watchItems", codeOf(r));
    const recipients = new Map();
    const to = (setBy) => {
      const k = typeof setBy === "string" ? setBy : "";
      if (!recipients.has(k)) recipients.set(k, this.#watchRecipients(setBy));
      return recipients.get(k);
    };
    const complete = r.complete === false ? { complete: false } : {};
    const subjectOf = (x) => ({ kind: "import", id: x.import, group: x.group ?? null, case: x.case ?? null });
    const whose = (x) => this.#citedCaseWords(x.group ?? null, x.case ?? null);
    const out = [];
    const findings = new Map();
    for (const e of Array.isArray(r.entries) ? r.entries : []) {
      if (!e || typeof e.import !== "string" || !e.import || !Number.isInteger(e.seq)) continue;
      const rec = to(e.set_by);
      if (!rec.members.includes(me)) continue;
      const id = `FINDING::followed-case-entry::${e.import}#${e.seq}`;
      if (findings.has(id)) continue;
      const edition = e.edition === "all" ? "all" : e.edition === undefined || e.edition === null ? null : Number(e.edition);
      const numbered = Number.isInteger(edition);
      const summaryKey = e.kind === "edition" ? `queue.followed-case-entry.summary.edition${numbered ? "" : ".unnumbered"}`
        : e.kind === "withdrawal" ? `queue.followed-case-entry.summary.withdrawal.${edition === "all" ? "all" : numbered ? "numbered" : "unnumbered"}`
          : "queue.followed-case-entry.summary.other";
      const entryDay = e.date ? this.#dayWord(String(e.date)) : "";
      const it = {
        id,
        class: "FINDING",
        kind: "followed-case-entry",
        case: this.#homesOf([]),
        subject: subjectOf(e),
        summary: say(summaryKey, { whose: whose(e), edition }),
        summary_key: summaryKey,
        detail: joined(say("queue.followed-case-entry.detail", { seq: e.seq }),
                       entryDay ? say("queue.followed-case-entry.detail.date", { date: entryDay }) : "",
                       say(e.key_listed === false ? "queue.followed-case-entry.detail.unkeyed" : "queue.followed-case-entry.detail.keyed"),
                       ...this.#entryWords(e, { key: false }),
                       say(e.move ? "queue.followed-case-entry.detail.moves" : "queue.followed-case-entry.detail.nomoves")),
        detail_key: "queue.followed-case-entry.detail",
        basis: { source: "case-import.watchItems", import: e.import, group: e.group ?? null, case: e.case ?? null,
                 seq: e.seq, entry_kind: e.kind ?? null, edition, date: e.date ?? null,
                 key_listed: typeof e.key_listed === "boolean" ? e.key_listed : null, move: e.move === true,
                 ...(e.kind === "edition" ? { what_changed: e.what_changed ?? null } : {}),
                 ...(e.kind === "withdrawal" ? { reason: e.reason ?? null } : {}),
                 taken_back: e.taken_back ?? null, seen_at: e.seen_at ?? null, set_by: e.set_by ?? null,
                 recipients_rule: rec.rule, ...complete,
                 detail: localize("queue-producers.index.a_verified_entry_of_a", "a verified entry of a followed case's docket is case-import's (its R18, R20), read here and never stored. It goes to the member who set the watch, else the administrators, and to nobody else; only a new edition or a withdrawal is a cause of re-evaluation (K1339, K1366).") },
        age: QueueProducers.#seenAge(e.seen_at, now),
        assignee: null,
        assignee_role: null,
        recipients: [...rec.members],
        options: [QueueProducers.IMPORT_READ],
      };
      findings.set(id, it);
      out.push(it);
    }
    for (const e of Array.isArray(r.refused) ? r.refused : []) {
      if (!e || typeof e.import !== "string" || !e.import) continue;
      const rec = to(e.set_by);
      if (!rec.members.includes(me)) continue;
      const seq = Number.isInteger(e.seq) ? e.seq : null;
      const id = `FINDING::cited-docket-entry-refused::${e.import}#${seq === null ? "unnumbered" : seq}`;
      /* a refused entry whose check is named by no code leaves `{checks}` empty (R43; named in the job's REPORT) */
      const failed = typeof e.failed === "string" && e.failed ? e.failed : null;
      const held = findings.get(id);
      if (held) {
        if (failed !== null && !held.basis.failed.includes(failed)) {
          held.basis.failed.push(failed);
          Object.assign(held, QueueProducers.#refusedWords(seq, held.basis.failed));
        }
        /* one item for every refused copy of this entry: it ages from the first of them this copy read */
        const age = QueueProducers.#seenAge(e.seen_at, now);
        if (age.state === "determined" && (held.age.state !== "determined" || Date.parse(age.since) < Date.parse(held.age.since))) {
          held.age = age;
          held.basis.seen_at = age.since;
        }
        continue;
      }
      const it = {
        id,
        class: "FINDING",
        kind: "cited-docket-entry-refused",
        case: this.#homesOf([]),
        subject: subjectOf(e),
        summary: say("queue.cited-docket-entry-refused.summary", { whose: whose(e) }),
        summary_key: "queue.cited-docket-entry-refused.summary",
        ...QueueProducers.#refusedWords(seq, failed === null ? [] : [failed]),
        basis: { source: "case-import.watchItems", import: e.import, group: e.group ?? null, case: e.case ?? null, seq,
                 failed: failed === null ? [] : [failed], entry_detail: e.detail ?? null, seen_at: e.seen_at ?? null, set_by: e.set_by ?? null,
                 recipients_rule: rec.rule,
                 ...complete,
                 detail: localize("queue-producers.index.a_refused_entry_is_case", "a refused entry is case-import's (its R18, R20): an entry of the followed case's docket that failed a check, recorded and never a move. It goes to the member who set the watch, else the administrators, and to nobody else.") },
        age: QueueProducers.#seenAge(e.seen_at, now),
        assignee: null,
        assignee_role: null,
        recipients: [...rec.members],
        options: [QueueProducers.IMPORT_READ],
      };
      findings.set(id, it);
      out.push(it);
    }
    for (const u of Array.isArray(r.unreadable) ? r.unreadable : []) {
      if (!u || typeof u.import !== "string" || !u.import) continue;
      const rec = to(u.set_by);
      if (!rec.members.includes(me)) continue;
      const id = `CONDITION::cited-docket-unreadable::${u.import}`;
      if (findings.has(id)) continue;
      const atMs = Date.parse(u.at ?? "");
      const it = {
        id,
        class: "CONDITION",
        kind: "cited-docket-unreadable",
        case: this.#homesOf([]),
        subject: subjectOf(u),
        summary: say("queue.cited-docket-unreadable.summary", { whose: whose(u) }),
        summary_key: "queue.cited-docket-unreadable.summary",
        /* DEC-359 (B2): the reason through `queue.fill.reason.<code>` (`.http` with `{status}` for http_<n>); one the list does not
           hold leaves the sentence out */
        detail: joined(say("queue.cited-docket-unreadable.detail"),
                       reasonWord(u.reason) ? say("queue.cited-docket-unreadable.detail.reason", { reason: reasonWord(u.reason) }) : "",
                       this.#dayWord(u.at) ? say("queue.cited-docket-unreadable.detail.at", { date: this.#dayWord(u.at) }) : ""),
        detail_key: "queue.cited-docket-unreadable.detail",
        basis: { source: "case-import.watchItems", import: u.import, group: u.group ?? null, case: u.case ?? null,
                 docket: u.docket ?? null, reason: u.reason ?? null, at: u.at ?? null, sentence: DOCKET_UNREADABLE,
                 set_by: u.set_by ?? null, recipients_rule: rec.rule, ...complete,
                 detail: localize("queue-producers.index.an_unreadable_docket_is_case", "an unreadable docket is case-import's fact about this copy's latest read (its R18, R20), read here and never stored: a signal about our own reading, not about the publisher. It goes to the member who set the watch, else the administrators, and leaves on the first read after it stops holding.") },
        age: Number.isFinite(atMs)
          ? { state: "determined", since: u.at, ms: Math.max(0, now - atMs) }
          : { state: "undetermined", reason: "no_read_instant",
              detail: localize("queue-producers.index.the_read_carries_no_instant", "the read carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        recipients: [...rec.members],
        options: [QueueProducers.IMPORT_REWATCH, QueueProducers.IMPORT_UNWATCH],
      };
      findings.set(id, it);
      out.push(it);
    }
    return out;
  }

  /** R35 (N546): an entry's item ages from the instant this copy read it, case-import R20's `seen_at` (the docket read
   *  that first recorded it), never the publisher's date nor this read's clock; undetermined when none can be read. */
  static #seenAge(seenAt, now) {
    const ms = typeof seenAt === "string" && seenAt ? Date.parse(seenAt) : NaN;
    return Number.isFinite(ms)
      ? { state: "determined", since: seenAt, ms: Math.max(0, now - ms) }
      : { state: "undetermined", reason: "no_seen_instant",
          detail: localize("queue-producers.index.the_entry_carries_no_instant", "the entry carries no instant this copy read it at that this producer can read") };
  }

  /** R35: the refused entry's sentence and its key, naming every check its copies failed by the code case-import gives it. */
  static #refusedWords(seq, failed) {
    const words = failed.map((c) => fillWord("check", c)).filter(Boolean);
    const key = `queue.cited-docket-entry-refused.detail.${seq === null ? "unnumbered." : ""}${failed.length <= 1 ? "one" : "other"}`;
    return { detail: say(key, { seq, checks: words.length ? words.join(", ") : fillWord("check", "undetermined") }), detail_key: key };
  }

  /* ======================================================================
   * N528 · R32, R33 — WIZARD SCRIPTS (wizard-scripts R7, R13, R17; DEC-121 (1), (5); K1397).
   * Each reads the one fact its owning module offers, derived on read and writing nothing.
   * ====================================================================== */

  /** R32: the item kinds of a break and a return (wizard-scripts R13); R33: the act that answers a submission (its R7). */
  static WIZARD_BREAK_KINDS = Object.freeze({ withdrawn: "wizard-withdrawn", restored: "wizard-restored" });
  static WIZARD_APPROVE = Object.freeze({ id: "wizardapprove", label: word("queue-producers.label.read_wizard_script"), weight: "single" });
  static WIZARD_READ = Object.freeze({ id: "wizardread", label: word("queue-producers.label.read_wizard_script_2"), weight: "single" });

  /** `wizard-withdrawn` and `wizard-restored` (R32; wizard-scripts R13; DEC-121 (5): "its owner is told why"): one FINDING
   *  per entry `wizard-scripts.brokenScripts` answers the viewer, keyed `FINDING::wizard-<kind>::<script>@<version>::<at>`,
   *  to the script's project owners (membership R65) and its version's author, and to nobody else; a group script's
   *  owners are the administrators (membership R86; K1397, as wizard-scripts R17's). Its subject the version, naming its
   *  name and, for a withdrawal, the first refusal by its row's translation. Homed under the script's project (none for a
   *  group script). Raised once: it leaves when its recipient disposes of it (queue's mint), never by anything here. */
  #findingsWizardBroken(me, viewer, now) {
    if (!me) return [];
    const page = this.#pages((after) => {
      const r = this.#wizardScripts.brokenScripts({ after, viewer });
      return r && Array.isArray(r.entries) ? { ...r, items: r.entries } : r;
    }, "wizard-scripts.brokenScripts");
    const visible = this.#bundleRedactor(viewer);
    const owners = new Map();
    const out = [];
    /* R49: the projects the items name are read for sight, owners and home at once */
    const named = [...new Set(page.items.map((x) => (x && typeof x.project === "string" && x.project ? x.project : null)).filter(Boolean))];
    visible.prefetch(named); this.#ownersOf(named); this.#caseRows(named, viewer);

    for (const x of page.items) {
      const kind = x ? QueueProducers.WIZARD_BREAK_KINDS[x.kind] : null;
      if (!kind || typeof x.script !== "string" || !x.script || x.version === undefined || x.version === null
          || typeof x.at !== "string" || !x.at) continue;
      const project = typeof x.project === "string" && x.project ? x.project : null;
      if (project && visible(project) === null) continue;       // R11: a script of a project the viewer may not see
      const key = project || "";
      if (!owners.has(key)) owners.set(key, project ? this.#ownersOf([project]).get(project) : this.#activeAdmins());
      const author = typeof x.author === "string" && x.author && !x.author.startsWith(MACHINE_AUTHOR_PREFIX)
        && !x.author.startsWith(MACHINE_CLASS_PREFIX) ? x.author : null;
      const recipients = [...new Set([...owners.get(key), ...(author ? [author] : [])])];
      if (!recipients.includes(me)) continue;
      const version = `${x.script}@${x.version}`;
      const withdrawn = kind === "wizard-withdrawn";
      const refusal = withdrawn && x.refusal && typeof x.refusal === "object" ? x.refusal : null;
      const words = refusal && typeof refusal.translation === "string" && refusal.translation ? refusal.translation : null;
      const name = typeof x.name === "string" && x.name ? x.name : version;
      const atMs = Date.parse(x.at);
      out.push({
        id: `FINDING::${kind}::${version}::${x.at}`,
        class: "FINDING",
        kind,
        case: project ? this.#homesAt([project], viewer) : this.#homesOf([]),
        subject: { kind: "wizard_version", id: version, script: x.script, version: x.version, name: x.name ?? null, project,
                   ...(withdrawn ? { refusal: refusal ? { code: refusal.code ?? null, check: refusal.check ?? null, translation: words } : null } : {}) },
        summary: say(`queue.${kind}.summary`, { name }),
        summary_key: `queue.${kind}.summary`,
        detail: joined(say(`queue.${kind}.detail`), withdrawn && words ? say("queue.wizard-withdrawn.detail.reason", { reason: words }) : ""),
        detail_key: `queue.${kind}.detail`,
        basis: { source: "wizard-scripts.brokenScripts", script: x.script, version: x.version, name: x.name ?? null, project,
                 author, at: x.at, break_kind: x.kind, refusal, recipients_rule: project ? "project_owners_and_author" : "administrators_and_author",
                 bound: { pages_bound: QueueProducers.QUEUE_PAGES, truncated: page.truncated },
                 detail: localize("queue-producers.index.a_scripts_break_or_return", "a script's break or return is wizard-scripts' record (its R13), made when its checks are run again at start, read here and never stored. It goes to the script's project owners (for a team script, the administrators) and its version's author, once (DEC-69, DEC-70).") },
        age: Number.isFinite(atMs)
          ? { state: "determined", since: x.at, ms: Math.max(0, now - atMs) }
          : { state: "undetermined", reason: "no_break_instant", detail: localize("queue-producers.index.the_record_carries_no_instant", "the record carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        recipients,
        options: [QueueProducers.WIZARD_READ],
      });
    }
    return out;
  }

  /** `wizard-approval-requested` (R33; wizard-scripts R7, R17; DEC-121 (1)): one OBLIGATION per (version, owner)
   *  `wizard-scripts.submittedFor` answers the viewer, keyed `OBLIGATION::wizard-approval-requested::<script>@<version>::<owner>`,
   *  to that owner and to nobody else; its subject the version, naming its name and author, aged from the
   *  submission, homed under the script's project (none for a group script). It leaves when the version is approved,
   *  withdrawn or its script retired (the read no longer answers it); raised once (DEC-69, DEC-94). */
  #obligationsWizardApproval(me, viewer, now) {
    if (!me) return [];
    const page = this.#pages((after) => {
      const r = this.#wizardScripts.submittedFor({ after, viewer });
      return r && Array.isArray(r.entries) ? { ...r, items: r.entries } : r;
    }, "wizard-scripts.submittedFor");
    const visible = this.#bundleRedactor(viewer);
    const out = [];
    /* R49: the projects the items name are read for sight, owners and home at once */
    const named = [...new Set(page.items.map((x) => (x && typeof x.project === "string" && x.project ? x.project : null)).filter(Boolean))];
    visible.prefetch(named); this.#ownersOf(named); this.#caseRows(named, viewer);

    for (const x of page.items) {
      if (!x || typeof x.script !== "string" || !x.script || x.version === undefined || x.version === null
          || x.owner !== me) continue;
      const project = typeof x.project === "string" && x.project ? visible(x.project) : null;    // R11
      const version = `${x.script}@${x.version}`;
      const name = typeof x.name === "string" && x.name ? x.name : version;
      const author = x.author ? this.#memberName(x.author) : "";
      const atMs = Date.parse(x.submitted_at ?? "");
      out.push({
        id: `OBLIGATION::wizard-approval-requested::${version}::${x.owner}`,
        class: "OBLIGATION",
        kind: "wizard-approval-requested",
        case: project ? this.#homesAt([project], viewer) : this.#homesOf([]),
        subject: { kind: "wizard_version", id: version, script: x.script, version: x.version, name: x.name ?? null,
                   author: x.author ?? null, project },
        ...(author
          ? { summary: say("queue.wizard-approval-requested.summary", { author, name }), summary_key: "queue.wizard-approval-requested.summary" }
          : { summary: say("queue.wizard-approval-requested.summary.unnamed", { name }), summary_key: "queue.wizard-approval-requested.summary.unnamed" }),
        detail: say("queue.wizard-approval-requested.detail"),
        detail_key: "queue.wizard-approval-requested.detail",
        basis: { source: "wizard-scripts.submittedFor", script: x.script, version: x.version, name: x.name ?? null,
                 author: x.author ?? null, owner: x.owner, project, submitted_at: x.submitted_at ?? null,
                 recipients_rule: "approver",
                 bound: { pages_bound: QueueProducers.QUEUE_PAGES, truncated: page.truncated },
                 detail: localize("queue-producers.index.a_submitted_version_is_wizard", "a submitted version is wizard-scripts' fact (its R7, R17): each owner who may approve it is listed. It goes to that owner and to nobody else, and is raised once (DEC-69, DEC-94).") },
        age: Number.isFinite(atMs)
          ? { state: "determined", since: x.submitted_at, ms: Math.max(0, now - atMs) }
          : { state: "undetermined", reason: "no_submission_instant", detail: localize("queue-producers.index.the_submission_carries_no_instant", "the submission carries no instant this producer can read") },
        assignee: null,
        assignee_role: null,
        recipients: [me],
        options: [QueueProducers.WIZARD_APPROVE],
      });
    }
    return out;
  }

  /* ======================================================================
     * DEC-147 · R37 — A CASE EDITION SIGNED TO PUBLISH AT A SET TIME (publish-schedule R1–R4, was publication R66–R69;
   *   N662, K1784, K1785; N823, K2438).
   * DEC-150 (3) · R38 — A HELD PROFILE FOR THE PLACE THE GROUP NAMED (instance-setup R62; N665).
   * DEC-158 (4) · R39 — A COPIED WIZARD WHOSE BASE HAS A NEWER APPROVED VERSION (wizard-scripts R26; N679, K1818).
   * Each reads the one fact its owning module offers, derived on read and writing nothing, so an item leaves on the
   * first read after the fact stops holding; what is told once is raised once and leaves by its recipient's disposition.
   * ====================================================================== */

  /** R37: the acts that answer a waiting edition (publish-schedule R3): moving its time, or cancelling it. */
  static PUBLISH_AT_MOVE = Object.freeze({ id: "publishatmove", label: word("queue-producers.label.move_time_publishes"), weight: "single" });
  static PUBLISH_AT_CANCEL = Object.freeze({ id: "publishatcancel", label: word("queue-producers.label.cancel_publishing_time"), weight: "single" });
  /** R37: each state's class and kind (publish-schedule R2, R4); a cancelled edition earns no item. */
  static SCHEDULED_KINDS = Object.freeze({
    waiting: Object.freeze(["CONDITION", "edition-scheduled"]),
    published: Object.freeze(["FINDING", "edition-published-as-scheduled"]),
    stopped: Object.freeze(["FINDING", "scheduled-edition-stopped"]) });
  /** R38: the act that answers an arrival (instance-setup R14, `op=profilesset`): choosing the profile under Places. */
  static PLACE_CHOOSE = Object.freeze({ id: "profilesset", label: word("queue-producers.label.choose_profile_under"), weight: "single" });
  /** R39: the acts a copy's editors are offered (wizard-scripts R4, R26): seeing what changed (both versions, read), and
   *  bringing it across by their own revision (`adopt: {base}`). */
  static WIZARD_BASE_READ = Object.freeze({ id: "wizardread", label: word("queue-producers.label.see_changed_wizard"), weight: "single" });
  static WIZARD_BASE_ADOPT = Object.freeze({ id: "wizardrevise", label: word("queue-producers.label.bring_change_copy"), weight: "single" });

  /** A person's id, never a machine credential's. */
  static #person(x) {
    return typeof x === "string" && x.trim() !== "" && !x.startsWith(MACHINE_AUTHOR_PREFIX) && !x.startsWith(MACHINE_CLASS_PREFIX);
  }

  /** An instant's age, or undetermined for `reason`. */
  static #instantAge(v, now, reason, detail) {
    const ms = typeof v === "string" && v ? Date.parse(v) : NaN;
    return Number.isFinite(ms) ? { state: "determined", since: v, ms: Math.max(0, now - ms) } : { state: "undetermined", reason, detail };
  }

  /** `edition-scheduled`, `edition-published-as-scheduled` and `scheduled-edition-stopped` (R37; publish-schedule R1–R4;
   *  DEC-147 (2), (3), (5)): for each case edition `publishSchedule.scheduledEditions` answers read as the plane (its R4),
   *  paged by its cursor, items to the member who set its time and to the case's project's owners (membership R65), and
   *  to nobody else: a caller with no member is none of them. Each item's subject is the case edition, homed under the
   *  case's project (none when it has none), and a project this viewer may not see yields no item (R11).
   *  - while it is `waiting`, one CONDITION keyed `CONDITION::edition-scheduled::<case>@<edition>`, its summary
   *    "Signed · publishes <date, time>" as set, in the group's zone, never converted (R36); offering the move and the
   *    cancel; a moved time changes its words, never its key; it leaves when the edition leaves `waiting`;
   *  - once `published`, one FINDING keyed `FINDING::edition-published-as-scheduled::<case>@<edition>`, naming the set time
   *    and the instant published;
   *  - once `stopped`, one FINDING keyed `FINDING::scheduled-edition-stopped::<case>@<edition>`, naming each reason in its
   *    own translation and saying nothing was published and publishing needs a new signing.
   *  The two findings are raised once and leave by their recipient's disposition (DEC-69, DEC-70). A cancelled edition
   *  earns no item.
   *  The provider is asked whenever there is a member, never first tested for the read (N823): a provider that lost it
   *  fails loudly rather than leaving every scheduled item silently unraised. */
  #scheduledEditionItems(me, viewer, now) {
    if (!me) return [];
    const page = this.#pages((after) => {
      const r = this.#publishSchedule.scheduledEditions({ after });
      return r && Array.isArray(r.editions) ? { ...r, items: r.editions, truncated: !!r.cursor } : r;
    }, "publish-schedule.scheduledEditions");
    const visible = this.#bundleRedactor(viewer);
    /* R49: the projects the items name are read for sight, owners and home at once */
    const named = [...new Set(page.items.map((x) => (x && typeof x.project === "string" && x.project ? x.project : null)).filter(Boolean))];
    visible.prefetch(named); this.#ownersOf(named); this.#caseRows(named, viewer);
    const owners = new Map();
    const seen = new Set();
    const out = [];
    for (const e of page.items) {
      const k = e ? QueueProducers.SCHEDULED_KINDS[e.state] : null;
      if (!k || typeof e.case !== "string" || !e.case || !Number.isInteger(Number(e.edition)) || e.edition === null) continue;
      const project = typeof e.project === "string" && e.project ? e.project : null;
      if (project && visible(project) === null) continue;        // R11: a case of a project this viewer may not see
      const key = project || "";
      if (!owners.has(key)) owners.set(key, project ? this.#ownersOf([project]).get(project) : []);
      const setter = QueueProducers.#person(e.set_by) ? e.set_by : null;
      const recipients = [...new Set([...(setter ? [setter] : []), ...owners.get(key)])];
      if (!recipients.includes(me)) continue;
      const [cls, kind] = k;
      const edition = Number(e.edition);
      const id = `${cls}::${kind}::${e.case}@${edition}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const at = e.at && typeof e.at === "object" ? e.at : {};
      const zone = typeof at.zone === "string" && at.zone ? at.zone : null;
      /* R37, R43: the set time as set, in the group's zone as publish-schedule R4 carries it, never converted (R36); with
         none readable `{when}` is left empty. An instant published is read in that zone too (`civil-time`). */
      const today = this.#todayIn(zone || this.#zoneNow());
      const when = setText(at.date, at.time, today);
      const caseName = e.case;
      const moves = Array.isArray(e.moves) ? e.moves : [];
      const reasons = (Array.isArray(e.reasons) ? e.reasons : []).filter((x) => x && typeof x === "object")
        .map((x) => ({ code: x.code ?? null, translation: typeof x.translation === "string" ? x.translation : null }));
      let summary, detail, age, options, detailKey;
      const summaryKey = `queue.${kind}.summary`;
      if (kind === "edition-scheduled") {
        summary = say(summaryKey, { when, case: caseName, edition });
        detailKey = "queue.edition-scheduled.detail";
        detail = joined(say(detailKey, { when }),
                        zone ? say("queue.edition-scheduled.detail.zone", { zone }) : "",
                        moves.length ? say(`queue.edition-scheduled.detail.moved.${moves.length === 1 ? "one" : "other"}`, { n: moves.length }) : "");
        age = QueueProducers.#instantAge(e.signed_at, now, "no_signing_instant", localize("queue-producers.index.the_edition_carries_no_signing", "the edition carries no signing instant this producer can read"));
        options = [QueueProducers.PUBLISH_AT_MOVE, QueueProducers.PUBLISH_AT_CANCEL];
      } else if (kind === "edition-published-as-scheduled") {
        const published = instantText(e.outcome_at, zone || this.#zoneNow(), today);
        summary = say(summaryKey, { when, case: caseName, edition });
        detailKey = published ? "queue.edition-published-as-scheduled.detail" : "queue.edition-published-as-scheduled.detail.nopublished";
        detail = say(detailKey, { when, published });
        age = QueueProducers.#instantAge(e.outcome_at, now, "no_outcome_instant", localize("queue-producers.index.the_edition_carries_no_publishing", "the edition carries no publishing instant this producer can read"));
        options = [];
      } else {
        const said = reasons.map((x) => x.translation || say("queue.scheduled-edition-stopped.reason.unrecorded"));
        summary = say(summaryKey, { when, case: caseName, edition });
        detailKey = said.length ? "queue.scheduled-edition-stopped.detail" : "queue.scheduled-edition-stopped.detail.noreason";
        detail = say(detailKey, { reasons: said.join(" ") });
        age = QueueProducers.#instantAge(e.outcome_at, now, "no_outcome_instant", localize("queue-producers.index.the_edition_carries_no_stopping", "the edition carries no stopping instant this producer can read"));
        options = [];
      }
      out.push({
        id,
        class: cls,
        kind,
        case: project ? this.#homesAt([project], viewer) : this.#homesOf([]),
        subject: { kind: "case_edition", id: `${e.case}@${edition}`, case: e.case, edition, project },
        summary,
        summary_key: summaryKey,
        detail,
        detail_key: detailKey,
        basis: { source: "publish-schedule.scheduledEditions", case: e.case, edition, project, state: e.state,
                 at: { date: at.date ?? null, time: at.time ?? null, zone }, publish_at: e.publish_at ?? null,
                 signed_at: e.signed_at ?? null, signer: e.signer ?? null, set_by: e.set_by ?? null, moves,
                 outcome_at: e.outcome_at ?? null, ...(kind === "scheduled-edition-stopped" ? { reasons } : {}),
                 recipients_rule: "setter_and_project_owners",
                 bound: { pages_bound: QueueProducers.QUEUE_PAGES, truncated: page.truncated },
                 detail: localize("queue-producers.index.a_scheduled_edition_is_publish", "a scheduled edition is publish-schedule's (its R1–R4): its time as set, in the team's zone, and its outcome, read here as the plane and never stored. It goes to the member who set the time and to the case's project's owners, and to nobody else (DEC-147).") },
        age,
        assignee: null,
        assignee_role: null,
        recipients,
        options,
      });
    }
    return out;
  }

  /** R38 (DEC-150 (3); instance-setup R62): the one door through which `instance-setup` registers, once at start, its
   *  `placeArrivals` read (a function, or an object offering `placeArrivals`), K31's pattern since it comes later in
   *  layer 11. A second registration is refused `PLACE_ARRIVALS_REGISTERED`, a read that is neither
   *  `PLACE_ARRIVALS_MALFORMED`: programming errors answered to the caller, never a member's refusal. */
  registerPlaceArrivals(read) {
    const fn = typeof read === "function" ? read
      : read && typeof read === "object" && typeof read.placeArrivals === "function" ? (a) => read.placeArrivals(a) : null;
    if (!fn)
      return { ok: false, reason: "PLACE_ARRIVALS_MALFORMED", detail: localize("queue-producers.index.the_registered_read_is_placearrivals", "the registered read is placeArrivals, a function") };
    if (this.#placeArrivals)
      return { ok: false, reason: "PLACE_ARRIVALS_REGISTERED", detail: localize("queue-producers.index.the_read_of_a_named", "the read of a named place's arrivals is registered once at start, and it was") };
    this.#placeArrivals = fn;
    return { ok: true };
  }

  /** `place-profile-arrived` (R38; instance-setup R62; DEC-150 (3)): with a read registered (none: no item), for each
   *  arrival it answers read as the plane, one CONDITION keyed `CONDITION::place-profile-arrived::<profile>`, to every
   *  active administrator (membership R64, R86) and to nobody else, with no project home. It names the place the group
   *  named and the held profile's name and coverage, and offers choosing it under Places (instance-setup R14). Raised once
   *  per arrival; it leaves when the arrival leaves (the profile made active, or the name cleared or changed). */
  #conditionsPlaceArrived(me, viewer, now) {
    if (!this.#placeArrivals || !me || !this.#isAdminMember(me)) return [];
    const r = this.#placeArrivals({ viewer: null });
    const list = Array.isArray(r) ? r : QueueProducers.#answered(r, "arrivals", "instance-setup.placeArrivals");
    const seen = new Set();
    const out = [];
    let admins = null;
    for (const a of list) {
      if (!a || typeof a !== "object") continue;
      const held = a.profile && typeof a.profile === "object" ? a.profile : null;
      const profile = held ? held.id ?? held.profile ?? null : a.profile;
      if (typeof profile !== "string" || !profile) continue;
      const id = `CONDITION::place-profile-arrived::${profile}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (admins === null) admins = this.#activeAdmins();
      const place = typeof a.name === "string" && a.name.trim() ? a.name.trim() : null;
      const pname = (held ? held.name : a.profile_name) ?? null;
      const covers = (held ? held.covers : a.covers);
      const coverage = Array.isArray(covers) ? covers.filter((x) => typeof x === "string" && x) : [];
      const named = typeof pname === "string" && pname ? pname : profile;
      out.push({
        id,
        class: "CONDITION",
        kind: "place-profile-arrived",
        case: this.#homesOf([]),
        subject: { kind: "place_profile", id: profile, name: pname ?? null, covers: coverage, place },
        ...(place
          ? { summary: say("queue.place-profile-arrived.summary", { place, profile: named }), summary_key: "queue.place-profile-arrived.summary" }
          : { summary: say("queue.place-profile-arrived.summary.unnamed", { profile: named }), summary_key: "queue.place-profile-arrived.summary.unnamed" }),
        detail: joined(place ? say("queue.place-profile-arrived.detail", { place, profile: named }) : say("queue.place-profile-arrived.detail.unnamed", { profile: named }),
                       coverage.length ? say("queue.place-profile-arrived.detail.covers", { covers: coverage.join(", ") }) : ""),
        detail_key: place ? "queue.place-profile-arrived.detail" : "queue.place-profile-arrived.detail.unnamed",
        basis: { source: "instance-setup.placeArrivals", profile, profile_name: pname ?? null, covers: coverage, place,
                 found_at: a.found_at ?? null, recipients_rule: "administrators", raised_to: admins,
                 detail: localize("queue-producers.index.an_arrival_is_instance_setups", "an arrival is instance-setup's fact (its R62): a held profile matching the place the team named, first found at a start, read here through the read it registered and never stored. It goes to every administrator and to nobody else (DEC-150 (3)), and leaves when the arrival leaves.") },
        age: QueueProducers.#instantAge(a.found_at, now, "no_found_instant", localize("queue-producers.index.the_arrival_carries_no_instant", "the arrival carries no instant this producer can read")),
        assignee: null,
        assignee_role: null,
        recipients: [...admins],
        options: [QueueProducers.PLACE_CHOOSE],
      });
    }
    return out;
  }

  /** `wizard-base-updated` (R39; wizard-scripts R26; DEC-158 (4), K1818): one FINDING per entry and recipient
   *  `wizard-scripts.baseUpdates` answers (a copy whose base has a newer approved version, to the copy's wizard editors as
   *  it names them), paged by its cursor, keyed `FINDING::wizard-base-updated::<copy>::<base version>::<member>`, to that
   *  recipient and to nobody else: a caller with no member is none of them. Its subject the copy, naming the copy's name,
   *  its base's name and the base's new version, homed under the copy's project, a project this viewer may not see
   *  yielding none (R11); offering to see what changed and to bring it across by the member's own revision (wizard-scripts
   *  R4's `adopt: {base}`). Raised once and never repeated; it leaves when its recipient disposes of it (DEC-69, DEC-70). */
  #findingsWizardBaseUpdated(me, viewer, now) {
    if (!me || typeof this.#wizardScripts.baseUpdates !== "function") return [];
    const page = this.#pages((after) => {
      const r = this.#wizardScripts.baseUpdates({ after, viewer });
      return r && Array.isArray(r.entries) ? { ...r, items: r.entries } : r;
    }, "wizard-scripts.baseUpdates");
    const visible = this.#bundleRedactor(viewer);
    /* R49: the projects the items name are read for sight, owners and home at once */
    const named = [...new Set(page.items.map((x) => (x && typeof x.project === "string" && x.project ? x.project : null)).filter(Boolean))];
    visible.prefetch(named); this.#ownersOf(named); this.#caseRows(named, viewer);
    const seen = new Set();
    const out = [];
    for (const x of page.items) {
      if (!x || typeof x.copy !== "string" || !x.copy || x.base_version === undefined || x.base_version === null
          || x.base_version === "") continue;
      const recipients = (Array.isArray(x.recipients) ? x.recipients : []).filter((m) => QueueProducers.#person(m));
      if (!recipients.includes(me)) continue;
      const project = typeof x.project === "string" && x.project ? x.project : null;
      if (project && visible(project) === null) continue;        // R11: a copy in a project this viewer may not see
      const baseVersion = String(x.base_version);
      const id = `FINDING::wizard-base-updated::${x.copy}::${baseVersion}::${me}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const name = typeof x.name === "string" && x.name ? x.name : x.copy;
      const baseName = typeof x.base_name === "string" && x.base_name ? x.base_name : say("queue.wizard-base-updated.base.unnamed");
      out.push({
        id,
        class: "FINDING",
        kind: "wizard-base-updated",
        case: project ? this.#homesAt([project], viewer) : this.#homesOf([]),
        subject: { kind: "wizard", id: x.copy, name: x.name ?? null, copy_version: x.copy_version ?? null,
                   base: x.base ?? null, base_name: x.base_name ?? null, based_on: x.based_on ?? null,
                   base_version: baseVersion, project },
        summary: say("queue.wizard-base-updated.summary", { base: baseName, version: baseVersion, name }),
        summary_key: "queue.wizard-base-updated.summary",
        detail: say(x.based_on ? "queue.wizard-base-updated.detail.versioned" : "queue.wizard-base-updated.detail",
                    { name, base: baseName, version: baseVersion, based_on: x.based_on }),
        detail_key: x.based_on ? "queue.wizard-base-updated.detail.versioned" : "queue.wizard-base-updated.detail",
        basis: { source: "wizard-scripts.baseUpdates", copy: x.copy, copy_version: x.copy_version ?? null, name: x.name ?? null,
                 project, base: x.base ?? null, base_name: x.base_name ?? null, based_on: x.based_on ?? null,
                 base_version: baseVersion, found_at: x.found_at ?? null,
                 ...(x.steps && typeof x.steps === "object" ? { steps: x.steps } : {}),
                 recipients_rule: "copy_editors", raised_to: recipients,
                 bound: { pages_bound: QueueProducers.QUEUE_PAGES, truncated: page.truncated },
                 detail: localize("queue-producers.index.a_newer_approved_version_of", "a newer approved version of a copy's base is wizard-scripts' fact (its R26), listed once per copy and version and read here, never stored. It goes to each of the copy's wizard editors it names, once (DEC-69, DEC-70), and the change is brought across only by a member's own revision (its R4).") },
        age: QueueProducers.#instantAge(x.found_at, now, "no_found_instant", localize("queue-producers.index.the_entry_carries_no_instant_2", "the entry carries no instant this producer can read")),
        assignee: null,
        assignee_role: null,
        recipients: [me],
        options: [QueueProducers.WIZARD_BASE_READ, QueueProducers.WIZARD_BASE_ADOPT],
      });
    }
    return out;
  }

  /* ======================================================================
   * T50 · R41, R42 — AN INVITATION TO A PROJECT, AND A REQUEST TO JOIN ONE (project-roster R1, R12, R14, R26, R34; N1091;
   * DEC-248, DEC-286, DEC-309 (1)). Each reads the one fact project-roster offers, derived on read and writing nothing, so
   * an item leaves on the first read after the fact stops holding. Every sentence is a word of setup-words' list (K3366).
   * ====================================================================== */

  /** R41, R42: how many projects each producer asks about (R4's bound). */
  static QUEUE_PROJECT_ITEMS_MAX = 50;

  /** The member's invitations as `project-roster.projectInvitations` answers them (R44; its R35), keyed by project, following
   *  `next` while it says the page was cut and at most `cap` of them. A read that throws or answers a refusal reads as no
   *  invitation listed: the items are still raised from `projectList` (R41), their inviter then unnamed. */
  #invitationsOf(viewer, cap) {
    const found = new Map();
    try {
      let after = null;
      for (let page = 0; page < QueueProducers.QUEUE_PAGES && found.size < cap; page += 1) {
        const r = this.#projectRoster.projectInvitations({ viewer, ...(after ? { after } : {}) });
        if (!r || r.ok !== true || !Array.isArray(r.invitations)) break;
        for (const x of r.invitations) if (x && typeof x.projectId === "string" && x.projectId && !found.has(x.projectId)) found.set(x.projectId, x);
        if (r.truncated !== true || !r.next) break;
        after = r.next;
      }
    } catch { /* below: no invitation listed */ }
    return found;
  }

  /** `project-invitation` (R41, R44; DEC-248): one OBLIGATION for each project in which the member's `participation` is
   *  `invited` (project-roster R34, read through `projectList`), at most 50 in id order, keyed
   *  `OBLIGATION::project-invitation::<project>::<member>`, to her and to nobody else, with no project home; it names the
   *  project and offers `projectjoin`. The inviter and the instant come from `projectInvitations` (R44: the handle, the
   *  founder with no handle as `member.founder.unnamed`, never `admin`); an invitation that read does not list is still
   *  raised, unnamed, aged from her own row's `created` in `projectParticipants` (R1: for an `invited` row, the
   *  invitation's instant). It leaves when her state changes. */
  #obligationsProjectInvitation(me, viewer, now) {
    if (!me) return [];
    const list = this.#projectRoster.projectList({ viewer });
    if (!list || list.ok !== true || !Array.isArray(list.projects)) throw new FeedFail(list && list.state === "undetermined" ? "undetermined" : "refused", "project-roster.projectList", codeOf(list));
    const cap = QueueProducers.QUEUE_PROJECT_ITEMS_MAX;
    const invited = list.projects.filter((p) => p && typeof p.id === "string" && p.id && p.participation === "invited");
    const listed = this.#invitationsOf(viewer, cap);
    const handle = this.#membership.memberFacts(me)?.handle ?? me;
    const out = [];
    for (const p of invited.slice(0, cap)) {
      const inv = listed.get(p.id) ?? null;
      const by = inv && inv.invited_by && typeof inv.invited_by === "object" ? inv.invited_by : null;
      const who = !by ? null : by.founder === true && !by.handle ? word("member.founder.unnamed") : (by.handle ?? (by.member ? this.#memberName(by.member) : null));
      let own = null;
      if (!(inv && inv.invited_at)) {
        const roster = this.#projectRoster.projectParticipants({ projectId: p.id, by: me });
        own = roster && roster.ok === true && Array.isArray(roster.participants)
          ? roster.participants.find((x) => x && x.handle === handle && x.state === "invited") : null;
      }
      const invitedAt = inv && inv.invited_at ? inv.invited_at : own ? own.created ?? null : null;
      const name = typeof p.name === "string" && p.name ? p.name : p.id;
      const summaryKey = who ? "queue.project-invitation.summary" : "queue.project-invitation.summary.unnamed";
      out.push({
        id: `OBLIGATION::project-invitation::${p.id}::${me}`,
        class: "OBLIGATION",
        kind: "project-invitation",
        case: this.#homesOf([]),
        subject: { kind: "project", id: p.id, name: p.name ?? null },
        summary: say(summaryKey, { who, project: name }),
        summary_key: summaryKey,
        detail: say("queue.project-invitation.detail"),
        detail_key: "queue.project-invitation.detail",
        basis: { source: inv ? "project-roster.projectInvitations" : "project-roster.projectList", project: p.id, participation: "invited",
                 invited_at: invitedAt, inviter: by ? { member: by.member ?? null, handle: by.handle ?? null, founder: by.founder === true } : null,
                 recipients_rule: "invited_member",
                 bound: { limit: cap, truncated: invited.length > cap, list_truncated: list.truncated === true },
                 detail: localize("queue-producers.index.an_invitation_is_memberships_row", "an invitation is membership's row for the member (project-roster R34, membership R118), read here at every read and never stored. It goes to the member invited and to nobody else, and leaves when her state changes: she joins, is removed, or the invitation is withdrawn.") },
        age: QueueProducers.#instantAge(invitedAt, now, "no_invitation_instant",
                                        localize("queue-producers.index.the_members_row_carries_no", "the member's row carries no instant this producer can read")),
        assignee: null,
        assignee_role: null,
        recipients: [me],
        options: [{ id: "projectjoin", label: word("act.projectjoin.label.queue"), weight: "single" }],
      });
    }
    return out;
  }

  /** `project-request` (R42; DEC-286): for each project the member owns, at most 50 in id order, one OBLIGATION per open
   *  request `projectRequests({projectId})` answers (project-roster R14), keyed
   *  `OBLIGATION::project-request::<project>::<requester>` (the requester by handle), to each owner of the project
   *  (membership R65) and to nobody else, with no project home. The requester is named by handle; her own comment is
   *  carried apart as `quote`, her words and not this module's. It offers `projectrequestanswer` with its two answers.
   *  Aged from the request's `asked`. It leaves for every owner at once when one owner answers it or the requester
   *  withdraws (the read no longer answers it). */
  #obligationsProjectRequest(me, viewer, now) {
    if (!me) return [];
    /* A store project-roster has not migrated holds no request (the plane migrates it with every module; a caller's test
       world may not), so it holds none: asked, never thrown over, as R23's case documents are. */
    if (!this.#one(`SELECT 1 AS x FROM sqlite_master WHERE type='table' AND name='project_join_requests'`)) return [];
    const cap = QueueProducers.QUEUE_PROJECT_ITEMS_MAX;
    const scope = this.#ownedProjects(me, viewer, cap);
    const out = [];
    this.#titlesOf(scope.projects); this.#ownersOf(scope.projects);
    for (const project of scope.projects) {
      const r = this.#projectRoster.projectRequests({ projectId: project, by: me, viewer });
      const requests = QueueProducers.#answered(r, "requests", "project-roster.projectRequests");
      const owners = this.#ownersOf([project]).get(project);
      const name = this.#nameOf(project);
      for (const q of requests) {
        if (!q || q.state !== "open" || typeof q.handle !== "string" || !q.handle) continue;
        const text = typeof q.comment === "string" && q.comment.trim() ? q.comment : null;
        out.push({
          id: `OBLIGATION::project-request::${project}::${q.handle}`,
          class: "OBLIGATION",
          kind: "project-request",
          case: this.#homesOf([]),
          subject: { kind: "project", id: project, name: this.#titleOf(project), requester: q.handle },
          summary: word("queue.project-request.summary", { who: q.handle, project: name }),
          summary_key: "queue.project-request.summary",
          detail: word("queue.project-request.detail"),
          detail_key: "queue.project-request.detail",
          quote: text === null ? null : { by: q.handle, text },
          basis: { source: "project-roster.projectRequests", project, requester: q.handle, comment: text, asked: q.asked ?? null,
                   recipients_rule: "project_owners",
                   bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true,
                            requests_limit: r.limit ?? null, requests_truncated: r.truncated === true },
                   detail: localize("queue-producers.index.an_open_request_to_join", "an open request to join is project-roster's row (its R12, R14), read here at every read and never stored. It goes to each owner of the project and to nobody else, and leaves for all of them when one owner answers it or the requester withdraws.") },
          age: QueueProducers.#instantAge(q.asked, now, "no_request_instant", localize("queue-producers.index.the_request_carries_no_instant", "the request carries no instant this producer can read")),
          assignee: null,
          assignee_role: null,
          recipients: [...owners],
          options: [{ id: "projectrequestanswer", label: word("act.projectrequestanswer.label.queue"), weight: "single",
                      answers: [{ answer: "grant", label: word("screen.home.request.grant") },
                                { answer: "decline", label: word("screen.home.request.decline") }] }],
        });
      }
    }
    return out;
  }

  /** `project-leave` (R54; K5157; membership R35): for each project the member owns, at most 50 in id order, one OBLIGATION per
   *  participant whose row `projectParticipants` (project-roster R1) answers as `leaving`, keyed
   *  `OBLIGATION::project-leave::<project>::<handle>`, to each owner of the project (membership R65) and to nobody else, with no
   *  project home. The participant is named by handle, her note carried apart as `quote` (null when she left none). It offers
   *  `projectremove`, the owners' act: only an owner removes a participant (membership v2 §7.7). It leaves when an owner removes
   *  her or she withdraws the request (her row is no longer `leaving`). An owner who asks to leave is removed by the owners' vote
   *  (R47), not by this act, so she makes no item here. The project is read only for its owners, who are participants, so a
   *  hidden project names nothing to anyone else. */
  #obligationsProjectLeave(me, viewer, now) {
    if (!me) return [];
    const cap = QueueProducers.QUEUE_PROJECT_ITEMS_MAX;
    const scope = this.#ownedProjects(me, viewer, cap);
    const out = [];
    this.#titlesOf(scope.projects); this.#ownersOf(scope.projects);
    for (const project of scope.projects) {
      const r = this.#projectRoster.projectParticipants({ projectId: project, by: me });
      const rows = QueueProducers.#answered(r, "participants", "project-roster.projectParticipants");
      const owners = this.#ownersOf([project]).get(project);
      const name = this.#nameOf(project);
      for (const q of rows) {
        if (!q || q.state !== "leaving" || q.owner || typeof q.handle !== "string" || !q.handle) continue;
        const text = typeof q.comment === "string" && q.comment.trim() ? q.comment : null;
        const fills = { who: q.handle, project: name };
        out.push({
          id: `OBLIGATION::project-leave::${project}::${q.handle}`,
          class: "OBLIGATION",
          kind: "project-leave",
          case: this.#homesOf([]),
          subject: { kind: "project", id: project, name: this.#titleOf(project), participant: q.handle },
          fills,
          summary: localize("queue-producers.index.project_leave_summary", "{who} asks to leave {project}", fills),
          detail: localize("queue-producers.index.project_leave_detail", "A participant has asked to leave this project. Nothing changes until an owner removes them; they can also withdraw the request."),
          quote: text === null ? null : { by: q.handle, text },
          basis: { source: "project-roster.projectParticipants", project, participant: q.handle, comment: text,
                   recipients_rule: "project_owners",
                   bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true },
                   detail: localize("queue-producers.index.a_request_to_leave_is_the", "a request to leave is the participant's row in state leaving (membership R35, project-roster R1), read here at every read and never stored. It goes to each owner of the project and to nobody else, and leaves for all of them when an owner removes the participant or she withdraws the request.") },
          age: QueueProducers.#instantAge(null, now, "no_leave_instant", localize("queue-producers.index.the_row_carries_no_leave_instant", "the participant's row carries no instant for the request that this producer can read")),
          assignee: null,
          assignee_role: null,
          recipients: [...owners],
          options: [{ id: "projectremove", label: word("act.projectremove.label.project"), weight: "single" }],
        });
      }
    }
    return out;
  }

  /* ======================================================================
   * T51's fix round · R46–R48 — THE DECISIONS THE RECORD ROUTES TO A MEMBER (K4169, UC-046; member-roster R77, R78;
   * project-roster R30). `queue` R1 names the kinds `endorsement-owed` and `expertise-confirmation-owed`; these are the
   * producers. Each reads the one fact its owner offers, derived on read and writing nothing, so an item leaves on the first
   * read after the fact stops holding; each item names its door (`door`, K4210: an optional field `queue` reads).
   * ====================================================================== */

  /** R46–R48: the act each item opens (`act.<door>.label.queue`; a removal's has no row of the list's yet, so it is written here). */
  static ENDORSE = Object.freeze({ id: "adminendorse", label: word("act.adminendorse.label.queue"), weight: "single" });
  static OWNER_ADD = Object.freeze({ id: "projectowneradd", label: word("act.projectowneradd.label.queue"), weight: "single" });
  static OWNER_REMOVE = Object.freeze({ id: "projectownerremove", label: localize("queue-producers.index.agree_to_remove_an_owner", "Agree to remove an owner"), weight: "single" });
  static EXPERTISE_CONFIRM = Object.freeze({ id: "expertiseconfirm", label: word("act.expertiseconfirm.label.queue"), weight: "single" });

  /** The names a member goes by in the reads that name members by handle: her id, her handle, and the founder's held handle. */
  #namesOf(me) {
    const names = new Set([me]);
    let facts = null;
    try { facts = this.#membership.memberFacts(me); } catch { facts = null; }
    if (facts && typeof facts.handle === "string" && facts.handle) names.add(facts.handle);
    if (me === ROOT_ADMIN) {
      try { const h = this.#membership.founderHandle(); if (typeof h === "string" && h) names.add(h); } catch { /* none held */ }
    }
    return names;
  }

  /** `endorsement-owed` on a proposed administrator (R46; member-roster R77): one OBLIGATION for each member `endorsementsOwed({by: member})`
   *  answers, keyed `OBLIGATION::endorsement-owed::admin::<proposed member>::<member>`, to that administrator alone, with no project
   *  home, aged from `proposed_at`, offering `adminendorse` and naming it as its `door`. It leaves when she endorses, the member is no
   *  longer `proposed`, or the proposal is withdrawn (the read no longer lists it). */
  #obligationsEndorsementOwed(me, now) {
    if (!me) return [];
    const rows = QueueProducers.#via("member-roster.endorsementsOwed", () => this.#memberRoster.endorsementsOwed({ by: me }));
    if (!Array.isArray(rows)) throw new FeedFail("refused", "member-roster.endorsementsOwed", codeOf(rows));
    const out = [];
    for (const row of rows.slice(0, QueueProducers.QUEUE_PROJECT_ITEMS_MAX)) {
      if (!row || typeof row.memberId !== "string" || !row.memberId) continue;
      const have = Array.isArray(row.have) ? row.have : [], awaiting = Array.isArray(row.awaiting) ? row.awaiting : [];
      const handle = typeof row.handle === "string" && row.handle ? row.handle : null;
      const fills = { who: handle ?? this.#memberName(row.memberId), have: have.length, awaiting: awaiting.length };
      const summary = holds("queue.endorsement-owed.summary") ? say("queue.endorsement-owed.summary", fills)
        : localize("queue-producers.index.endorsement_owed_summary", "Endorse {who} as an administrator ({have} endorsed so far, {awaiting} still to endorse)", fills);
      const detail = holds("queue.endorsement-owed.detail") ? say("queue.endorsement-owed.detail")
        : localize("queue-producers.index.endorsement_owed_detail", "A member has been proposed as an administrator, and your endorsement is still to give. Nothing is decided until enough administrators have endorsed.");
      out.push({
        id: `OBLIGATION::endorsement-owed::admin::${row.memberId}::${me}`,
        class: "OBLIGATION",
        kind: "endorsement-owed",
        case: this.#homesOf([]),
        subject: { kind: "member", id: row.memberId },
        fills: handle ? { who: handle } : {},
        summary,
        ...(holds("queue.endorsement-owed.summary") ? { summary_key: "queue.endorsement-owed.summary" } : {}),
        detail,
        ...(holds("queue.endorsement-owed.detail") ? { detail_key: "queue.endorsement-owed.detail" } : {}),
        basis: { source: "member-roster.endorsementsOwed", member: row.memberId, proposed_by: row.proposed_by ?? null,
                 proposed_at: row.proposed_at ?? null, have, awaiting, recipients_rule: "administrators_not_yet_endorsed",
                 detail: localize("queue-producers.index.an_endorsement_owed_is_member_roster", "an endorsement owed is member-roster's fact (its R77), read here at every read and never stored. It goes to each active administrator who has not endorsed the proposal and may (not the one who proposed it), and to nobody else, and leaves when she endorses, the member is no longer proposed, or the proposal is withdrawn.") },
        age: QueueProducers.#instantAge(row.proposed_at, now, "no_proposal_instant",
                                        localize("queue-producers.index.the_proposal_carries_no_instant", "the proposal carries no instant this producer can read")),
        assignee: null,
        assignee_role: null,
        recipients: [me],
        options: [QueueProducers.ENDORSE],
        door: "adminendorse",
      });
    }
    return out;
  }

  /** `endorsement-owed` on an owner change (R47; project-roster R30): for each project the member owns, at most 50 in id order, one
   *  OBLIGATION for each change `projectOwnerVotes({projectId, viewer})` lists with her among its `awaiting`, keyed
   *  `OBLIGATION::endorsement-owed::owner::<project>::<change>:<target>::<member>`, to her only, with no project home, offering the
   *  change's own act (`projectowneradd` or `projectownerremove`), which is also its `door`. It leaves when she votes or the change
   *  is carried or withdrawn (the read no longer lists it for her). A project whose votes the read answers as absent to this viewer
   *  has none for her. */
  #obligationsOwnerVoteOwed(me, viewer, now) {
    if (!me) return [];
    const scope = this.#ownedProjects(me, viewer, QueueProducers.QUEUE_PROJECT_ITEMS_MAX);
    if (!scope.projects.length) return [];
    const mine = this.#namesOf(me);
    this.#titlesOf(scope.projects);
    const out = [];
    for (const project of scope.projects) {
      const r = QueueProducers.#via("project-roster.projectOwnerVotes", () => this.#projectRoster.projectOwnerVotes({ projectId: project, viewer }));
      if (r && r.ok === false && codeOf(r) === "NO_SUCH_PROJECT") continue;
      const name = this.#nameOf(project);
      for (const c of QueueProducers.#answered(r, "changes", "project-roster.projectOwnerVotes")) {
        const awaiting = c && Array.isArray(c.awaiting) ? c.awaiting : [];
        if (!c || (c.change !== "add" && c.change !== "remove") || typeof c.target !== "string" || !c.target
            || !awaiting.some((x) => mine.has(x))) continue;
        const agreed = Array.isArray(c.agreed) ? c.agreed : [];
        const fills = { who: c.target, project: name, agreed: agreed.length, awaiting: awaiting.length };
        const who = this.#heldHandle(c.target);
        const add = c.change === "add";
        const summary = add
          ? (holds("queue.endorsement-owed.owner.summary.add") ? say("queue.endorsement-owed.owner.summary.add", fills)
            : localize("queue-producers.index.owner_vote_owed_add", "Agree to make {who} an owner of {project} ({agreed} agree, {awaiting} still to)", fills))
          : (holds("queue.endorsement-owed.owner.summary.remove") ? say("queue.endorsement-owed.owner.summary.remove", fills)
            : localize("queue-producers.index.owner_vote_owed_remove", "Agree to remove {who} as an owner of {project} ({agreed} agree, {awaiting} still to)", fills));
        const detail = holds("queue.endorsement-owed.owner.detail") ? say("queue.endorsement-owed.owner.detail")
          : localize("queue-producers.index.owner_vote_owed_detail", "The owners of a project decide who its owners are together, and your vote on this change is still to give.");
        const summaryKey = `queue.endorsement-owed.owner.summary.${c.change}`;
        out.push({
          id: `OBLIGATION::endorsement-owed::owner::${project}::${c.change}:${c.target}::${me}`,
          class: "OBLIGATION",
          kind: "endorsement-owed",
          case: this.#homesOf([]),
          subject: { kind: "project", id: project, name: this.#titleOf(project), change: c.change, target: c.target },
          fills: who ? { who } : {},
          summary,
          ...(holds(summaryKey) ? { summary_key: summaryKey } : {}),
          detail,
          ...(holds("queue.endorsement-owed.owner.detail") ? { detail_key: "queue.endorsement-owed.owner.detail" } : {}),
          basis: { source: "project-roster.projectOwnerVotes", project, change: c.change, target: c.target,
                   proposed_by: c.proposed_by ?? null, proposed_at: c.proposed_at ?? null, agreed, awaiting,
                   recipients_rule: "owners_not_yet_voted",
                   bound: { projects_bound: scope.bound, projects_truncated: scope.truncated === true },
                   detail: localize("queue-producers.index.an_owner_vote_owed_is_project", "an owner vote owed is project-roster's fact (its R30), read here at every read and never stored. It goes to each owner whose vote would still count and is not in, and to nobody else, and leaves when she votes or the change is carried or withdrawn.") },
          age: QueueProducers.#instantAge(c.proposed_at, now, "no_proposal_instant",
                                          localize("queue-producers.index.the_proposal_carries_no_instant", "the proposal carries no instant this producer can read")),
          assignee: null,
          assignee_role: null,
          recipients: [me],
          options: [add ? QueueProducers.OWNER_ADD : QueueProducers.OWNER_REMOVE],
          door: add ? "projectowneradd" : "projectownerremove",
        });
      }
    }
    return out;
  }

  /** `expertise-confirmation-owed` (R48; member-roster R78): one OBLIGATION for each (member, label) `expertiseAwaitingConfirmation({by: member})`
   *  answers, keyed `OBLIGATION::expertise-confirmation-owed::<member declared>::<label>` (the same for every administrator it
   *  reaches, so one confirmation clears it for all), to each active administrator and to nobody else, with no project home, aged from
   *  `declared_at`, offering `expertiseconfirm` as its `door`. It leaves when any administrator confirms, the label is withdrawn or the
   *  member is no longer active (the read no longer lists it). */
  #obligationsExpertiseOwed(me, now) {
    if (!me) return [];
    const rows = QueueProducers.#via("member-roster.expertiseAwaitingConfirmation", () => this.#memberRoster.expertiseAwaitingConfirmation({ by: me }));
    if (!Array.isArray(rows)) throw new FeedFail("refused", "member-roster.expertiseAwaitingConfirmation", codeOf(rows));
    const out = [];
    for (const row of rows.slice(0, QueueProducers.QUEUE_PROJECT_ITEMS_MAX)) {
      if (!row || typeof row.memberId !== "string" || !row.memberId || typeof row.label !== "string" || !row.label) continue;
      const handle = typeof row.handle === "string" && row.handle ? row.handle : null;
      const fills = { who: handle ?? this.#memberName(row.memberId), label: row.label };
      const summary = holds("queue.expertise-confirmation-owed.summary") ? say("queue.expertise-confirmation-owed.summary", fills)
        : localize("queue-producers.index.expertise_confirmation_owed_summary", "Confirm {who}'s expertise in {label}", fills);
      const detail = holds("queue.expertise-confirmation-owed.detail") ? say("queue.expertise-confirmation-owed.detail")
        : localize("queue-producers.index.expertise_confirmation_owed_detail", "A member declared this expertise about themselves. Confirming it lets it be asked for when a check needs it; nothing else depends on it.");
      out.push({
        id: `OBLIGATION::expertise-confirmation-owed::${row.memberId}::${row.label}`,
        class: "OBLIGATION",
        kind: "expertise-confirmation-owed",
        case: this.#homesOf([]),
        subject: { kind: "member", id: row.memberId, label: row.label },
        fills: handle ? { who: handle } : {},
        summary,
        ...(holds("queue.expertise-confirmation-owed.summary") ? { summary_key: "queue.expertise-confirmation-owed.summary" } : {}),
        detail,
        ...(holds("queue.expertise-confirmation-owed.detail") ? { detail_key: "queue.expertise-confirmation-owed.detail" } : {}),
        basis: { source: "member-roster.expertiseAwaitingConfirmation", member: row.memberId, label: row.label,
                 declared_at: row.declared_at ?? null, recipients_rule: "administrators",
                 detail: localize("queue-producers.index.an_expertise_awaiting_confirmation_is_member", "an expertise awaiting confirmation is member-roster's fact (its R78), read here at every read and never stored. It goes to each active administrator and to nobody else, and leaves for all of them when any confirms, the label is withdrawn or the member is no longer active.") },
        age: QueueProducers.#instantAge(row.declared_at, now, "no_declaration_instant",
                                        localize("queue-producers.index.the_declaration_carries_no_instant", "the declaration carries no instant this producer can read")),
        assignee: null,
        assignee_role: null,
        recipients: [me],
        options: [QueueProducers.EXPERTISE_CONFIRM],
        door: "expertiseconfirm",
      });
    }
    return out;
  }

}

const OF = new WeakMap();

/** The one producers instance for this Durable Object's storage (`ctx`, or the storage itself). It registers nothing. */
export function queueProducersOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let p = OF.get(storage);
  if (!p) {
    p = new QueueProducers({ host: ctx, storage, deps: { ...(deps || {}) } });
    OF.set(storage, p);
  }
  return p;
}
