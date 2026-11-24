/* ai-runs — THE AI RUN (requirements: `build/requirements/ai-runs.md`, R9–R53). Extracted from `store.mjs` at T7
 * (T6-6's entry; the map is `build/extraction/ai-runs.md`). The vocabulary and pure rules, the deployment order and the
 * rows are `run-rules`' since the split (K617, K649 (1)); this file is the mechanism: the one exit, open, tick,
 * close, the reaper and the wake, the reads, and the services later modules produce under a run through (R28, R29).
 * The account a run carries (R52) is the one `ai-accounts.accountFor` answers for the act of the member who started it
 * (their own, a project's, or the group's API key; K1755), the act and its use still that member's; refused by name when
 * no account serves them. What that account has spent and may spend is `ai-use`'s (T40-8, K624: the counter, the
 * ceilings and the reads this module held as R48–R51 moved there): a run asks its `useCheck` and counts each tick's use
 * through its `countUsage`, under the run's id (R52, R72, R76). Since T41 a run may work as a step (`steps`, R73, R74).
 *
 * THE ONE EXIT (R14, R31) is `#aiRunTerminate`, and it is the only thing that moves a run out of `running`: the
 * terminal log entry and the status change are one transaction, so no run is over while its log is silent. The
 * reaper (`reap`) takes that exit for a run that was killed and called nothing.
 *
 * Reached as `aiRunsOf(ctx, env)` (K61), one instance per Durable Object storage; it reaches record-core,
 * membership, credentials, ai-accounts, connections, bias and observation-log through their factories on the same `ctx`. Which
 * account serves an act, and its switches, are read from `ai-accounts` (T48; N996 §5); `credentials` is reached only for the
 * run's own credentials (`aiRunCredentialMint`, `aiRunCredentialsEnd`, R14, R18) and the `ai` credential's row
 * (`aiCredentialLook`, R18). */

import { recordOf, stampInstant } from "../record-core/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { membershipOf, viewerPredicate, GATE_MARK, listenerRefusal, MODULE_ORDER } from "../membership/index.mjs";
import { connectionsOf } from "../connections/index.mjs";
import { biasOf } from "../bias/index.mjs";
import { observationLogOf } from "../observation-log/index.mjs";
import { retrievalOf } from "../retrieval/index.mjs";
import { contradictionOf } from "../contradiction/index.mjs";
import { CONDITION_KINDS } from "../observation-log/vocabulary.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { normalizeType, OBJECT_TYPES, isMachineIdentity, MACHINE_CLASS_PREFIX } from "../record-grammar/index.mjs";
import { credentialsOf } from "../credentials/index.mjs";
import { aiAccountsOf } from "../ai-accounts/index.mjs";
import { inquiryOf } from "../inquiry/index.mjs";
import { sha256hex, instanceAiCredential } from "../tokens.mjs";
import { storeId, storeStub } from "../store-place.mjs";
import { aiUseOf } from "../ai-use/index.mjs";
import { stepsOf, WORK_MAX } from "../steps/index.mjs";
/* The run's vocabulary, pure rules, deployment order and rows are `run-rules`' (K617, K649 (1)); read there, never
   re-exported from here. */
import { RUN_BOUNDS, RUN_ENDINGS, RUN_CONTEXTS, STANDARD_BASIS, OBSERVATION_STATES, OBSERVATION_LEVELS,
         OBSERVATION_COVERAGE, OBSERVATION_COVERAGE_UNDETERMINED, observationCoverage, checkBound, checkCondition,
         checkConsume, checkRunState, finishedBound, runStatusFor, projectGate, runConsultsProjects, checkRunContextKind,
         runPrincipalGate, checkSkillVersion, DEPLOYED_MODES, DEFAULT_MODE, AI_RUNS_CHECKS, RUN_MODES, startAllowed,
         checkVerification, partAdmittedOn, CIVICSMITH_TEST_SET, originAllowed, checkTestBarRecord } from "../run-rules/index.mjs";
import { AI_RUNS_SCHEMA, AI_RUNS_TABLES, AI_RUNS_ADDED_COLUMNS } from "./schema.mjs";

export { AI_RUNS_SCHEMA, AI_RUNS_TABLES } from "./schema.mjs";

/** R72: a provider's refusal for a spent limit (Anthropic's 429 `enforced_spend_limit_reached`), recognised in the reason
 *  or type the agent-worker relays to the wake's dispatch. */
const PROVIDER_LIMIT = /enforced_spend_limit_reached/;
/** R85: the most subjects a search half names. */
const SUBJECTS_MAX = 50;
/** R87 (T50; agent-worker R83, R87): the headers of a member's dispatch to `agent-worker`'s `/run`, each sent only when the
 *  door handed a non-empty printable string of at most 200 characters (the shape `signin-door` R3 mints, which a module of
 *  this layer cannot import); never in a body or an address. */
const TRACE_HEADER = "x-civicsmith-trace", MEMBER_REF_HEADER = "x-civicsmith-member-ref";
const HEADER_VALUE = /^[\x21-\x7e]{1,200}$/;

/** A member's id from any of the forms a stamp takes (`member:<id>`, `member:<id>/<tokenId>`, `<id>`); null for a
 *  machine identity, an absent value, or a deploy class. */
function memberIdOf(x) {
  if (typeof x !== "string") return null;
  const t = x.trim();
  if (!t || isMachineIdentity(t) || t.startsWith("class:") || t.startsWith("token:")) return null;
  const bare = t.startsWith("member:") ? t.slice(7) : t;
  const id = bare.split("/")[0];
  return /^[A-Za-z0-9._-]{1,128}$/.test(id) ? id : null;
}

/** R18 (T47; N955; credentials R63, K3033): THE WRITES A SEGMENT'S CREDENTIAL HOLDS, by the run's mode: each mode's own,
 *  every one of them an entry of `credentials.AI_RUN_WRITES` (a mode deployed later adds its own here): `check`'s are
 *  agent-worker R37's, `plan`'s agent-worker R53's. Frozen. */
export const AI_RUN_MODE_WRITES = Object.freeze({   /* passed whole: credentials R63 refuses one its list does not name */
  check: Object.freeze(["airuntick", "suggest", "capturerequest", "airunclose"]),
  plan: Object.freeze(["airuntick", "optionpropose", "airunclose"]),
});

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

/** R19's SIGHT OF A RUN, as SQL over the run's context column (D-15's bundle gate, the store's `#bundleGate`, a copy of
 *  the small helper, K57): the column must be qualified; a machine credential (membership's `member` scope) sees every
 *  run; an absent or unrecognised viewer none (fail closed); a member a run whose context bundle it may see. The ONE
 *  spelling of "may this viewer see this run": `read`, the tick and close, `runFor` and `hiddenRuns` all compile it. */
function runSight(col, viewer) {
  if (typeof col !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(col))
    throw new Error(`REFUSED: the D-15 bundle gate needs a QUALIFIED column (got ${col}).`);
  const gate = viewerPredicate(viewer);
  if (gate.scope === "member") return { sql: `${GATE_MARK} 1=1`, args: [], scope: gate.scope };
  if (gate.scope === "DENY") return { sql: gate.sql, args: [], scope: gate.scope };
  return {
    sql: `${GATE_MARK} (${col} IS NULL OR EXISTS (SELECT 1 FROM bundles b
            WHERE b.bundle_id = ${col} AND (${gate.sql})))`,
    args: gate.args, scope: gate.scope,
  };
}

/** R42 (N191, N276, D-486): THE ONE PREDICATE FOR "RUNS THIS VIEWER CANNOT SEE", as a WHERE tail over a run id: a
 *  run is kept only when it is one R19 answers `found: true` for, compiled from `runSight` itself, so the tallies and
 *  the reads cannot disagree about a run. A machine credential gets the empty tail; an absent or unrecognised viewer
 *  loses every run (fail closed), as R19 answers it nothing. This is the one place the subtraction is written.
 *
 *  Without `column` it is the tail over `observation_log` that retrieval takes (its R57): rows that are not a run's are
 *  never touched (`authority` also holds sweep, lead and document ids, so the `authority_kind` conjunct is
 *  load-bearing), and `COALESCE` keeps a NULL authority from deciding the answer by accident. With `column` (K333, for
 *  legacy-store's `ai_run_bounds` count) it is the same predicate and args over that column naming a run id; the
 *  column must be a plain identifier, and anything else is refused by the tail that keeps nothing, never
 *  interpolated. Pure over its arguments; never throws (a failure is the fail-closed tail). */
export function hiddenRuns(viewer, column = undefined) {
  const byColumn = column !== undefined;
  const closed = byColumn ? { sql: " AND 0=1", args: [] } : { sql: " AND COALESCE(authority_kind, '') <> 'run'", args: [] };
  try {
    if (byColumn && !(typeof column === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(column))) return closed;
    const seen = runSight("r.context_id", viewer);
    if (seen.scope === "member") return { sql: "", args: [] };
    const inSight = `(SELECT r.run FROM ai_runs r WHERE ${seen.sql})`;
    return byColumn
      ? { sql: ` AND COALESCE(${column}, '') IN ${inSight}`, args: seen.args }
      : { sql: ` AND NOT (authority_kind = 'run' AND COALESCE(authority, '') NOT IN ${inSight})`, args: seen.args };
  } catch {
    return closed;
  }
}

export class AiRuns {
  #waitSource = null;
  #runListeners = [];     // R43: {module, fn, seq}, in the modules' total order
  #openChecks = [];       // R47: {module, mode, fn}, one per mode and one per module
  #deps;
  /** `deps` is for in-process wiring only (never the wire or `env`): `inquiry` (R27's `migratedSurfacing`), `steps`,
   *  `aiUse` and `aiAccounts` (each module's own instance, else its factory on this `ctx`), and, for a module test alone,
   *  `deployedModes` in place of `run-rules`' `DEPLOYED_MODES` and `testSet` in place of `CIVICSMITH_TEST_SET`. */
  constructor(ctx, env = {}, deps = {}) {
    this.ctx = ctx;
    this.env = env || {};
    this.#deps = deps || {};
    this.sql = ctx.storage.sql;
    /* R38, R53 (plan T33, Rules (6)): this module's tables, declared explicitly to record-core (its R21). The
       surfacing rows are cleared by the question they name; the runs and their bounds by the whole-store purge only,
       each with the sight R19 gives a run (its context bundle's). The use counter and the ceilings are `ai-use`'s (its
       R7; record-core R80 refuses a table declared twice). */
    const cls = { expunge: "none", export: "admin-only", derive: "stored", version_chain: false, purge: "clear" };
    recordOf(ctx).declareTable("ai-runs", [
      { name: "inquiry_run_surfacings", ...cls, sight: "bundle" },
      { name: "ai_run_bounds", keys: [], ...cls, sight: "bundle" },
      { name: "ai_runs", keys: [], ...cls, sight: "bundle" },
      { name: "ai_mode_verifications", keys: [], ...cls, sight: "group" },
      /* T41: a step-run's looks (R73), keyed by the observation's seq; the test bar's results and a group's own test
         matters (R75), group-wide, cleared only with the whole store. */
      { name: "ai_run_looks", keys: [], ...cls, sight: "group" },
      { name: "ai_test_bar", keys: [], ...cls, sight: "group" },
      { name: "ai_group_tests", keys: [], ...cls, sight: "group" }]);
    /* R36: observation-log's `run` resolver (a run's log rows are visible to whoever may read the run) and
       retrieval's hidden-run tail (R42's `hiddenRuns`) and `surfaced_in` decoration; R30: the runs as bias's work
       products. */
    observationLogOf(ctx).registerAuthority("run", (run, viewer) => !!this.runFor(run, viewer));
    const retrieval = retrievalOf(ctx);
    retrieval.registerHiddenRunTail("ai-runs", hiddenRuns);
    retrieval.registerProjectionDecoration("ai-runs", (row, { viewer }) => (
      normalizeType(row.object_type) === "inquiry"
        ? this.surfacedIn(row.bundle_id, viewer).then((s) => ({ surfaced_in: s }))
        : { surfaced_in: null }));
    biasOf(ctx, { env: this.env }).registerWorkProducts("ai-run", this.workProducts());
    /* R37: the run gate contradiction offers (its R21, K182), filled from R28 and R5. */
    contradictionOf(ctx).registerRunGate("ai-runs", (run, viewer, caller) => {
      const g = this.runGate(run, viewer, caller, "proposing contradictions under a run");
      return { found: g.found, running: g.running, refusal: g.refusal };
    });
    /* R25–R26: the surfacing step, joining every promotion (promotion R39, K31). */
    promotionOf(ctx).registerStep("ai-runs", { check: (c) => this.#surfacingCheck(c), project: (c) => this.#surfacingProject(c) });
    /* R38: this module's tables' figures, for `op=stats` and purge's proof (record-core R63; moved from the legacy
       store's `#counts`, its `#hiddenRunTail` with them). */
    recordOf(ctx).registerCounts("ai-runs", [...AiRuns.COUNT_KEYS], (hid) => this.counts(hid));
    /* B2 (K2480; steps R1, R8): steps answers "a run it holds" through this module's resolver, registered once at start. */
    const steps = this.#steps();
    if (steps && typeof steps.registerRunHolder === "function")
      steps.registerRunHolder("ai-runs", (by, run) => this.runHolder(by, run));
  }

  /** The `steps` module (T41; R73, R74, B2): the injected one, else its factory on this `ctx`; null where it cannot be
   *  reached, so an act needing it is refused rather than trusted. */
  #steps() {
    if (this.#deps.steps) return this.#deps.steps;
    try { return stepsOf(this.ctx); } catch { return null; }
  }

  /** R73, R74 (J5 (8)): THE RUN'S OWN SYSTEM IDENTITY, the machine that creates and ends the run's system step. steps
   *  reads a member credential as that member, so a member's run (R74) needs a machine to make a step the system's; it is
   *  minted here per run, never presented by a caller, and `runHolder` answers it only while its run is running. */
  static systemOf(run) { return `${MACHINE_CLASS_PREFIX}daemon/${String(run)}`; }

  /** The sight a run's principal acts in, as a viewer: `member:<id>` for a member credential, the class for a machine
   *  one (`class:ai/<token>` acts as `class:ai`). */
  static #viewerOf(principal) {
    const p = typeof principal === "string" ? principal.trim() : "";
    const m = memberIdOf(p);
    return m ? `member:${m}` : p.replace(/\/.*$/, "");
  }

  /** B2 (K2480): whether `by` holds `run`, for steps' machine arm: `{enabled_by, principal}` for a running run whose
   *  principal `by` is (run-rules R5), or whose own system identity it is (`systemOf`); `enabled_by` the paying owner the
   *  run records (`principal_claude`, R52; ai-use R6's label) and `principal` the viewer the run's opener acts as (steps
   *  judges the step's place in that sight); null for a blank, unknown or ended run, or one another principal holds.
   *  Writes nothing and never throws. */
  runHolder(by, run) {
    try {
      const id = run == null ? "" : String(run).trim();
      if (!id || typeof by !== "string" || !by.trim()) return null;
      const r = this.#one(`SELECT status, principal_plane, principal_claude FROM ai_runs WHERE run = ?`, id);
      if (!r || r.status !== "running") return null;
      if (by !== AiRuns.systemOf(id) && runPrincipalGate({ caller: by, principal: r.principal_plane })) return null;
      return { enabled_by: r.principal_claude ?? null, principal: AiRuns.#viewerOf(r.principal_plane) };
    } catch { return null; }
  }

  /** R38 (D-113, D-464, D-486): the figures of this module's tables, through the caller's sight. `hid` is record-core
   *  R63's: membership's `hiddenBundles` (its R88, the bundles the viewer may not see), or null for a viewer that sees
   *  every bundle and for the direct internal call, which count whole. `aiRuns` drops a run whose context is hidden and
   *  `inquiryRunSurfacings` a row whose question is; `aiRunBounds` and `aiRunLog` (the observation log's run rows) keep
   *  only the rows of a run R19 would answer `found: true` for, as R42's `hiddenRuns` does: with `hid` given, a run is in
   *  sight exactly when its context is a bundle not in `hid`, which is `runSight`'s gate, since `hid` is every bundle the
   *  gate does not pass (every one, for a viewer it refuses). Synchronous; writes nothing. */
  static COUNT_KEYS = Object.freeze(["aiRuns", "aiRunBounds", "inquiryRunSurfacings", "aiRunLog"]);
  counts(hid = null) {
    const c = (q, ...a) => this.#one(q, ...a).c;
    if (!hid) return { aiRuns: c(`SELECT count(*) c FROM ai_runs`), aiRunBounds: c(`SELECT count(*) c FROM ai_run_bounds`),
      inquiryRunSurfacings: c(`SELECT count(*) c FROM inquiry_run_surfacings`),
      aiRunLog: c(`SELECT count(*) c FROM observation_log WHERE authority_kind = 'run'`) };
    const seen = `(SELECT r.run FROM ai_runs r WHERE r.context_id IS NULL OR (r.context_id IN (SELECT bundle_id FROM bundles)
                   AND r.context_id NOT IN ${hid.sql}))`;
    return {
      aiRuns: c(`SELECT count(*) c FROM ai_runs WHERE COALESCE(context_id, '') NOT IN ${hid.sql}`, ...hid.args),
      aiRunBounds: c(`SELECT count(*) c FROM ai_run_bounds WHERE COALESCE(run, '') IN ${seen}`, ...hid.args),
      inquiryRunSurfacings: c(`SELECT count(*) c FROM inquiry_run_surfacings WHERE COALESCE(bundle_id, '') NOT IN ${hid.sql}`,
        ...hid.args),
      aiRunLog: c(`SELECT count(*) c FROM observation_log WHERE authority_kind = 'run' AND COALESCE(authority, '') IN ${seen}`,
        ...hid.args),
    };
  }

  /** R30: the runs as the bias debt's work products (bias R33): `list(after, limit)` the run ids after `after`,
   *  ascending; `read(run)` the run's context, member principal, the lens recorded when it began (the lens in force
   *  at its open where the open recorded one, else the manifest it was handed; null when neither can be read, R32),
   *  the manifest it ran under when that was the lens in force, its `rerun_of`, and `registered` (N284): the run's
   *  `created`, the open's instant, which bias offers the scheduler's rank as the product's `waitingSince` (null
   *  when the stored instant cannot be read, never filled in); `visible(run, viewer)` R19's sight. Read as the
   *  administrator viewer, as bias reads every work product. */
  workProducts() {
    const MEMBER = /^member:([A-Za-z0-9._:-]{1,128}?)(?:\/.*)?$/;
    return {
      list: (after, limit) => this.#rows(`SELECT run FROM ai_runs WHERE run > ? ORDER BY run LIMIT ?`,
        String(after ?? ""), Math.max(1, Math.floor(Number(limit) || 50))).map((r) => String(r.run)),
      read: async (run) => {
        const row = this.#one(`SELECT rerun_of, created FROM ai_runs WHERE run = ?`, String(run ?? ""));
        if (!row) return null;
        /* An internal read, as bias reads every work product: a machine viewer, which sees every run (K2442: the
           founder's `admin` viewer no longer sees a hidden project it is not in, D54). */
        const a = await this.read({ run, viewer: AiRuns.#INTERNAL_VIEWER });
        const s = a && a.found === true ? a.session : null;
        if (!s) return null;
        const bias = s.bias || {};
        const sha = (m) => (m && typeof m.statements_sha === "string" ? m.statements_sha : null);
        const lens = bias.moved_basis === "at_open" ? { basis: "at_open", statements_sha: sha(bias.at_open) }
          : bias.moved_basis === "handed" ? { basis: "handed", statements_sha: sha(bias.manifest) } : null;
        const pm = MEMBER.exec(String((s.principal && s.principal.plane) || ""));
        return {
          context: s.context ? { type: s.context.type, id: s.context.id } : null,
          principal: pm ? pm[1] : null,
          lens,
          ranUnder: bias.in_force === true ? sha(bias.manifest) : null,
          rerunOf: row.rerun_of != null && String(row.rerun_of).trim() ? String(row.rerun_of).trim() : null,
          registered: typeof row.created === "string" && Number.isFinite(Date.parse(row.created)) ? row.created : null,
        };
      },
      visible: async (run, viewer) => !!this.runFor(run, viewer),
    };
  }

  /** The viewer of this module's own internal reads (K2442): a machine identity, never a person's sight. */
  static #INTERNAL_VIEWER = `${MACHINE_CLASS_PREFIX}daemon`;

  /** R35: the row of one of this module's acts' codes, read by key from `run-rules`' table (its R11, R15, R20). */
  #checkRow(code) { return AI_RUNS_CHECKS[code]; }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #membership() { return membershipOf(this.ctx); }
  /** N418 (K650): every write this module makes goes through record-core's `transact` (its R32), so the store's one
   *  transaction, its savepoints and its `afterCommit` (R66) hold over them; never `transactionSync` directly. */
  #transact(fn) { return recordOf(this.ctx).transact(fn); }
  #connections() { return connectionsOf(this.ctx); }
  #bias() { return biasOf(this.ctx); }
  #observations() { return observationLogOf(this.ctx); }

  /** D-15's bundle gate over a run's context column: `runSight`, the one spelling. */
  #bundleGate(col, viewer) { const { sql, args } = runSight(col, viewer); return { sql, args }; }

  /* ---- R16, R17: THE WAIT SOURCE `capture-requests` registers (K71, N39) ---------------------------------------
   * The wake reads the requests a run waits on through this, never `capture_requests` by name. `source` is
   * `{ tickMs(), holds(iso, limit), woken(limit), completions(run, limit), markWoken(requests, iso) }`, all
   * synchronous; `configured()` may be added, and answers whether anything drains at all (the hold is inert where
   * nothing will ever complete). With none registered the wake holds and wakes nothing (R17). */
  registerWaitSource(module, source) {
    const fns = ["tickMs", "holds", "woken", "completions", "markWoken"];
    if (typeof module !== "string" || !module || !source || fns.some((f) => typeof source[f] !== "function"))
      return { ok: false, reason: "WAIT_SOURCE_MALFORMED", detail: localize("ai-runs.index.a_wait_source_names_its", "a wait source names its module and {fns}", { fns: String(fns.join(", ")) }) };
    if (this.#waitSource) return { ok: false, reason: "WAIT_SOURCE_DECLARED", module, declaredBy: this.#waitSource.module };
    this.#waitSource = { module, source };
    return { ok: true, module };
  }
  #wait() { return this.#waitSource ? this.#waitSource.source : null; }

  /** R43 (N223, K259): a later module's post-write notice (`scheduler`'s R9), called after each successful `open`
   *  commits with `{run, contextType, contextId, expires}`, once per listener, in the modules' total order
   *  (membership's `MODULE_ORDER`, R83). A malformed registration, or a second by the same module, is refused by
   *  membership's `listenerRefusal` (its R81), the one site of LISTENER_MALFORMED and LISTENER_DECLARED. */
  onRunOpened(module, fn) {
    const refused = listenerRefusal(this.#runListeners, module, fn);
    if (refused) return refused;
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.#runListeners.push({ module, fn, seq: this.#runListeners.length });
    this.#runListeners.sort((a, b) => (rank(a.module) - rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }
  /** R47 (K660): a later module's check for one mode (`action-plans` for `plan`, its R30), registered once at start: a
   *  synchronous `fn({contextType, contextId, plan, actor, viewer}) → null | refusal` that `open` applies last and passes
   *  on unchanged. A malformed registration, or a second (by the same module, or for a mode already held), is refused by
   *  membership's `listenerRefusal` (LISTENER_MALFORMED, LISTENER_DECLARED). */
  registerOpenCheck(module, mode, fn) {
    const m = typeof mode === "string" ? mode.trim() : "";
    const refused = listenerRefusal(this.#openChecks, module, m ? fn : null)
      || listenerRefusal(this.#openChecks.find((c) => c.mode === m) || null, module, fn);
    if (refused) return refused;
    this.#openChecks.push({ module, mode: m, fn });
    return { ok: true, module, mode: m };
  }
  #deployedModes() { return Array.isArray(this.#deps.deployedModes) ? this.#deps.deployedModes : DEPLOYED_MODES; }
  /** R78 (T46; K2816 (2)): WHETHER THIS IS A TEST INSTANCE, a fact of the deployment and of nothing else: true exactly
   *  when the Worker environment's `CIVICSMITH_TEST_INSTANCE` is a string equal to its `INSTANCE_NAME`, both non-empty;
   *  false otherwise, and when either cannot be read. Only `env` is read: no op, body, query or table reaches it. */
  testInstance() {
    try {
      const env = this.env || {};
      const flag = env.CIVICSMITH_TEST_INSTANCE, name = env.INSTANCE_NAME;
      return typeof flag === "string" && typeof name === "string" && flag !== "" && name !== "" && flag === name;
    } catch { return false; }
  }
  /** R78, run-rules R19, R29 (B6, K2489; K2816 (2)): MAY THIS AI PART RUN HERE, on what this record holds: its
   *  verification chain (`verifications`) and its test bar (`testBarRecords`, R75) on Civicsmith's set (a module test's
   *  own set through `deps.testSet`), with the test-instance exception (`testInstance`). `run-rules`' `partAdmittedOn`
   *  is the one computation: `{admitted, untested}`, the label set only for a part admitted on the exception. The one
   *  gate of this module (R40, R23's input), and what later modules ask (question-explorer, instance-setup, plane). */
  partAdmitted(part) {
    try {
      const set = this.#deps.testSet || CIVICSMITH_TEST_SET;
      const said = partAdmittedOn(set, part, { verifications: this.verifications(), testBars: this.testBarRecords() },
        { testInstance: this.testInstance() });
      return said && said.admitted === true ? { admitted: true, untested: said.untested ?? null }
        : { admitted: false, untested: null };
    } catch { return { admitted: false, untested: null }; }
  }
  #captureRequestConfigured() {
    const w = this.#wait();
    return !!w && (typeof w.configured !== "function" || w.configured() === true);
  }
  #captureRequestTickMs() { const w = this.#wait(); return w ? Number(w.tickMs()) || 0 : 0; }

  /* R83 (R085-7; WALK-085 F2): TEN MINUTES, and it is a LEASE rather than a lifetime: every tick, and every dispatch the
     segment accepts, pushes it out. A run that heartbeats lives; a run whose segment died is dead within the lease and is
     reaped (bound `lease`), so it reads ended within minutes, never "working" for an hour. `AI_RUN_LEASE_MS` in the
     environment overrides it. */
  static AI_RUN_LEASE_MS = 600000;
  #leaseMs() {
    const v = Number(this.env && this.env.AI_RUN_LEASE_MS);
    return Number.isFinite(v) && v > 0 ? v : AiRuns.AI_RUN_LEASE_MS;
  }

  /* REC-70 — THE OBSERVATION LOG'S BOUND. NEITHER FIGURE IS NEW, and the PAIR
     is deliberately not copied whole from either sibling, because this log has
     TWO READERS WITH OPPOSITE NEEDS and no single existing pair serves both.

     200 is `op=exportlog`'s default (`EXPORT_LOG_LIMIT_DEFAULT`, REC-57), and
     it is the plane's ONLY other append-only, `seq`-ordered log read. The
     default belongs to the reader who is CHECKING a run — §11's "the log is
     what lets anyone else CHECK" — and a checker wants a page, not a replay.

     5000 is the plane's shared READ CEILING: `op=list`'s, which `op=projection`
     reused at REC-59 and the meaning layer reused at REC-60 rather than minting
     a second. The ceiling belongs to the OTHER reader — §14b.7's RESUMED run,
     which reads its own log to continue rather than restart, and for which a
     cut answer is a run that redoes work it already did. `op=exportlog`'s 1000
     was sized for an administrator scrolling exports; it is the wrong ceiling
     for a machine replaying its own history, and the meaning layer's 500
     default is sized for a member exploring a subject graph that grows on
     D-224's quadratic curve, which a run log does not.

     WHAT THIS DOES NOT GIVE, said plainly rather than left to be discovered
     (REC-60's own sentence, and it applies unchanged): a caller cut at the
     CEILING has no way past it. A run that emits more than 5000 observations
     cannot replay its log whole through this op. No cursor is minted here —
     REC-55's declined-second-copy rule — and the honest bound is published
     instead of the complete answer being promised. */
  static AI_RUN_LOG_LIMIT_DEFAULT = 200;
  static AI_RUN_LOG_LIMIT_MAX = 5000;

  /* REC-69 — THE CONTEXT-KEYED RUN LIST'S PAIR, AND NEITHER FIGURE IS NEW.
   *
   * 200/1000 is `op=versionchain`'s pair, which `op=basisversions` reused
   * rather than minting a second, and this read is the SAME KIND as both: a
   * KEYED lookup — one context, not a query a caller pages through a corpus
   * with — whose answer is a list of the objects hanging off that key. The log
   * pair above is deliberately NOT reused: it bounds ONE RUN'S OBSERVATIONS,
   * which grow one row per tick with nothing capping the tick count, and this
   * bounds THE RUNS IN A CONTEXT, which grow one row per investigation a member
   * launched. Different populations at different rates, so borrowing the log's
   * 5000 ceiling here would be a figure carried across on the strength of the
   * table name alone.
   *
   * WHAT THIS DOES NOT GIVE, on REC-60's sentence and `aiRunLog`'s above: a
   * caller cut at the CEILING has no way past it. No cursor is minted (REC-55's
   * declined-second-copy rule); the honest bound is published instead of the
   * complete answer being promised. */
  static AI_RUNS_LIMIT_DEFAULT = 200;
  static AI_RUNS_LIMIT_MAX = 1000;

  static #aiIso(ms) { return stampInstant("second", ms); }

  /** Append ONE run-log observation. **THE FOLD** (`OBSERVATION-LOG-DESIGN.md`
   *  §4.4): `ai_run_log`'s rows ARE rows of `observations` with
   *  `authority_kind = run`, `authority = <run>`, `actor_class = machine`. This
   *  method is no longer a writer — it is the run's DOOR onto the one writer, and
   *  that is what §4.4 means by *"two writers is not [the landing's call]"*.
   *
   *  ITS BEHAVIOUR DID NOT CHANGE AND THAT IS ASSERTED RATHER THAN CLAIMED:
   *  every entry that was accepted before this landing is accepted now, the
   *  refusal object comes back in the same shape, and `op=airunlog` answers
   *  byte-identically over rows written before the fold. C-22.10 did not fire
   *  on `run` for exactly this reason UNTIL REC-100 (2026-09-18, IC-130): the
   *  rollup ruling gave the run's two rollup writers a referent, and a bare
   *  `run` PRESENT is now refused here like any other — see its catalogue row. */
  #aiRunAppend(run, entry, at, terminal = 0, actor = null, step = null) {
    /* R73: a step-run's entries name its step (observation-log R1, steps R9): its looks, and its wake and terminal
       rollups too, since a rollup's `observation` referent must be a row of its own authority (C-22.10). Each is tied to
       the run here, so the run's log and rollup read them and no other run's. */
    if (step) {
      return this.#appendAs(run, entry, at, terminal, actor, step);
    }
    return this.#appendAs(run, entry, at, terminal, actor);
  }

  #appendAs(run, entry, at, terminal, actor, step = null) {
    const bad = this.#observations().observe({
      actorClass: "machine",
      /* WHO the machine was, PASSED IN BY THE CALLER RATHER THAN LOOKED UP
         HERE, and the change of shape is a finding rather than a preference.
         §4.4 says `actor` is *"the run's credential"*; `ai_runs` HAS NO SUCH
         COLUMN — measured, not assumed — and the column that actually carries
         the machine identity is `principal_claude`, IS-6's Claude principal.
         Reported as a DESIGN GAP against §4.4.
         THE FIRST DRAFT READ IT HERE, with `SELECT principal_claude FROM
         ai_runs`, and `run-conditions.test.mjs` ARM W3 caught it BY NAME: that
         made this method a THIRTEENTH reader of `ai_runs`, and ARM W9 then
         refused the only role that could have fitted, because an ATTRIBUTES
         reader must project nothing but the key. The arms were right twice over.
         The honest fix was not a role but to stop reading: every caller already
         holds the run row it is appending under, so the lookup was also one
         EXTRA SELECT PER APPENDED ENTRY — `op=airuntick` appends N and was
         paying N of them for a value it had in hand.
         A CALLER THAT DOES NOT SAY WRITES NULL, and that is correct rather than
         lossy: attributing a machine's look to the plane's own scheduler would
         be a false attribution in the one field that says who looked. */
      actor: actor || null,
      authorityKind: step ? "step" : "run",
      authority: step ? String(step) : run == null ? null : String(run),
      level: entry && entry.level ? entry.level : "document",
      /* `unstated`, and it is the honest word rather than a derived one.
         `ai_run_log` never recorded what KIND of subject a row was about, so
         deriving one from the level would be the record claiming more than it
         can support — see `OBSERVATION_SUBJECT_KINDS` in run-rules. */
      subjectKind: "unstated",
      subject: entry ? entry.subject : null,
      state: entry ? entry.state : undefined,
      governed: entry ? entry.governed === true : false,
      condition: entry ? entry.condition : null,
      bound: entry ? entry.bound : null,
      resultKind: entry ? (entry.result_kind ?? null) : null,
      resultRef: entry ? (entry.result_ref ?? null) : null,
      detail: entry ? entry.detail : null,
      /* C-22.6 travels through UNCHANGED: the bundle key is what the refusal
         reads, and it is passed rather than dropped here. */
      bundle: entry ? entry.bundle : null,
    }, at, terminal);
    if (!bad && step) {
      const r = this.#one(`SELECT MAX(seq) seq FROM observation_log WHERE authority_kind = 'step' AND authority = ?`, String(step));
      if (r && r.seq != null) this.sql.exec(`INSERT OR IGNORE INTO ai_run_looks (seq, run) VALUES (?, ?)`, r.seq, String(run));
    }
    return bad;
  }

  /** What the run's SEARCH established overall, reduced from the log the run
   *  actually wrote rather than declared by the run about itself.
   *
   *  The order is a strength order over D-129's vocabulary and it is stated
   *  here because it is a judgement: a run that found something says PRESENT
   *  (that is a positive finding, not a coverage claim); otherwise the weakest
   *  honest word wins, and a run with no observations at all says NEVER_LOOKED.
   *
   *  THE OVERRIDE IS THE POINT. When a BOUND stopped the run, a definitive
   *  absence is unavailable to it — not finding something and not finishing the
   *  search are different facts, and only one licenses a conclusion
   *  (`heldMatch`'s lesson, §14b.6's own citation). So LOOKED_ABSENT and
   *  NEVER_LOOKED both become LOOKED_INDETERMINATE on a bounded stop. PRESENT
   *  survives, because a document the run did hold does not stop existing
   *  because the run ran out of time afterwards. */
  /*  REC-100 / IC-130 — AND THE ROLLUP'S REFERENT COMES OUT OF THE SAME READ.
   *  `OBSERVATION-LOG-DESIGN.md` §3, RULED 2026-09-18 by BOB #14: a rollup's
   *  PRESENT carries `result_kind = observation` and `result_ref` = the `seq` of
   *  the LATEST non-terminal PRESENT row of this run, computed HERE and never
   *  supplied by a caller. So this returns `{ state, result_kind, result_ref }`
   *  and both rollup writers (`#aiRunTerminate`, `#aiRunWake`) spread it, rather
   *  than each deriving the pointer beside a state derived elsewhere.
   *
   *  THE INVARIANT THE RULING RESTS ON, and it is structural rather than
   *  checked: `state` is PRESENT exactly when the grouped read returned a PRESENT
   *  group, and that group's `MAX(seq)` IS the referent — one row of one query,
   *  so there is no second read for the two to disagree across. The bound
   *  override below only ever turns LOOKED_ABSENT / NEVER_LOOKED into
   *  LOOKED_INDETERMINATE and never produces or removes PRESENT. A rollup that
   *  is not PRESENT owes no referent and carries none. */
  /** A non-terminal restatement of the rollup (the wake's entry, a dispatch that did not complete): `NEVER_LOOKED` is
   *  never stored as a look (observation-log R3; only a run's terminal rollup may say it, K148), so a run whose own log
   *  holds no look yet restates LOOKED_INDETERMINATE — what its search established is not yet known from its log. */
  #aiRunRestatedState(run) {
    const s = this.#aiRunSearchState(run, false);
    return s.state === "NEVER_LOOKED" ? { ...s, state: "LOOKED_INDETERMINATE" } : s;
  }

  #aiRunSearchState(run, stoppedByBound) {
    const latest = new Map(this.#rows(
      `SELECT state, MAX(seq) seq FROM observation_log
        WHERE ${AiRuns.#ownRows()} AND terminal = 0
        GROUP BY state`, run, run).map((r) => [r.state, r.seq]));
    let s = latest.has("PRESENT") ? "PRESENT"
          : latest.has("partial") ? "partial"
          : latest.has("LOOKED_INDETERMINATE") ? "LOOKED_INDETERMINATE"
          : latest.has("LOOKED_ABSENT") ? "LOOKED_ABSENT"
          : "NEVER_LOOKED";
    if (stoppedByBound && (s === "LOOKED_ABSENT" || s === "NEVER_LOOKED")) s = "LOOKED_INDETERMINATE";
    return s === "PRESENT"
      ? { state: s, result_kind: "observation", result_ref: String(latest.get("PRESENT")) }
      : { state: s, result_kind: null, result_ref: null };
  }

  /** THE ONE EXIT. Every ending goes through here, and the terminal log entry
   *  is written in the same transaction as the status change.
   *
   *  `offered` is what the caller SAYS stopped the run; it is honoured when
   *  given and otherwise derived from the budget rows. Either way the answer
   *  comes out of `finishedBound`, so the reaper holds no arithmetic of its
   *  own. */
  /*  `derive` is the difference between the two kinds of caller, and it is the
   *  thing that makes C-22.5 REACHABLE rather than dead code. Found by this
   *  item's own suite on its first run: with derivation on every path, a close
   *  offering NO bound fell through `finishedBound` to "completed" — a legal
   *  answer — so the refusal that IS §14b.6 could never fire, and an ending
   *  nobody named would have been recorded as a run that finished. So:
   *
   *    - `aiRunClose` derives NOTHING. It is a caller SAYING why the run ended,
   *      and a caller who does not say is refused by name. Inferring "completed"
   *      from silence is exactly the manufactured fact this design refuses
   *      everywhere else.
   *    - `aiRunTick` and `#aiRunReap` DO derive, because there is no caller to
   *      ask: the budget rows and the clock are the only evidence there is, and
   *      `finishedBound` is the one function that reads them.
   */
  #aiRunTerminate({ run, offered = null, condition = null, at, expired = false, derive = true }) {
    const row = this.#one(`SELECT * FROM ai_runs WHERE run = ?`, run);
    if (!row) return { run, found: false,
      note: word("ai-runs.note.run_either_existed") };
    if (row.status !== "running")
      return { run, found: true, terminated: false, status: row.status,
               bound: row.stopped_bound, condition: row.stopped_condition,
               note: word("ai-runs.note.run_already_ended") };

    const bounds = this.#rows(`SELECT bound, allowed, consumed FROM ai_run_bounds WHERE run = ?`, run);
    const bound = derive ? finishedBound(bounds, { expired, offered })
                         : (offered == null ? "" : String(offered));

    /* C-22.5 — the refusal that IS §14b.6. A run may not leave `running`
       without saying what stopped it. */
    const badBound = checkBound(bound);
    if (badBound) return { run, found: true, terminated: false, ...badBound };
    /* C-22.4 — and it is checked against the LIVE vocabulary, observation-log's `CONDITION_KINDS`
       (`src/observation-log/vocabulary.mjs`), never a copy, so a kind that file removes cannot keep being emitted here. */
    const badCondition = checkCondition(condition, CONDITION_KINDS);
    if (badCondition) return { run, found: true, terminated: false, ...badCondition };

    const stoppedByBound = Object.prototype.hasOwnProperty.call(RUN_BOUNDS, bound);
    const rollup = this.#aiRunSearchState(run, stoppedByBound);
    const state = rollup.state;
    const last = this.#one(
      `SELECT level FROM observation_log
        WHERE ${AiRuns.#ownRows()} AND terminal = 0
        ORDER BY seq DESC LIMIT 1`, run, run);

    const done = this.#transact(() => {
      /* THE TERMINAL ENTRY FIRST, then the status. The order is deliberate: if
         anything could fail it is the append, and a run left `running` with its
         log written is recoverable by the reaper, while a run marked finished
         with no entry is the exact silence this item exists to prevent. */
      const bad = this.#aiRunAppend(run, {
        level: last ? last.level : "document",
        subject: row.context_id,
        /* `state`, `result_kind`, `result_ref` — the rollup and its referent
           from ONE read (REC-100; see `#aiRunSearchState`). */
        ...rollup,
        governed: false,
        condition,
        bound,
        detail: stoppedByBound
          ? localize("ai-runs.index.the_run_stopped_because_the", "the run stopped because the '{bound}' bound was reached ({v1})", { bound: String(bound), v1: String(RUN_BOUNDS[bound]) })
          : localize("ai-runs.index.the_run_ended_v1", "the run ended: {v1}", { v1: String(RUN_ENDINGS[bound]) }),
      /* R73: under the step, as its looks are, save a NEVER_LOOKED rollup (a step-run that looked at nothing), which the
         observation log admits only as a run's own terminal entry (C-22.17); it names no referent (C-22.10). */
      }, at, 1, null, rollup.state === "NEVER_LOOKED" ? null : (row.step || null));
      if (bad) return { run, found: true, terminated: false, ...bad };
      /* FL-8 / IC-67 — WHAT BECAME OF THIS RUN, ASKED ONCE AND OF `run-rules`.
         This was `stoppedByBound ? "stopped" : "finished"`, written out TWICE
         here, and it recorded a launch the deployment gate REFUSED as a run that
         FINISHED — a gate refusal reaches no bound, so it fell through the false
         arm. **It did not finish; it never started.** The keying now lives beside
         the vocabularies it reads (`runStatusFor`), so the status a run is
         recorded under cannot drift from the endings and bounds that decide it,
         and the fleet member's mock is BUILT from the same function instead of
         reproducing it by hand — which is how the previous copy came to be
         answering `stopped` for `mode-not-deployed` while this line answered
         `finished`, with nothing comparing them. `stoppedByBound` stays: it still
         chooses the terminal entry's SENTENCE two lines up, which is a different
         question from what the run's status is. */
      const status = runStatusFor(bound);
      /* R76: the run's cost is ai-use's figures under its id (one store, K2482); its ending fixes them as final. */
      this.sql.exec(
        `UPDATE ai_runs SET status = ?, updated = ?, stopped_bound = ?, stopped_condition = ?, stopped_at = ?
         WHERE run = ?`,
        status, at, bound, condition, at, run);
      return { run, found: true, terminated: true,
               status,
               bound, condition, state, at };
    });
    /* R73: a step-run's ending ties what it produced to its step (steps R9's `recordProduct`) and, for the run's own
       system step, ends it as steps R5 allows a machine, after the run's own ending has committed. A member's step a run
       worked is hers to end. A step that cannot be told is said in the answer; the run's ending stands. */
    /* R14 (T47; N955; credentials R63): the run's ending revokes every segment credential minted for it (R18), after the
       exit has committed; the call never throws, and its answer never changes the exit or its answer. */
    if (done && done.terminated === true) this.#endRunCredentials(run);
    return done && done.terminated === true && row.step ? { ...done, step_end: this.#endStep(row, bound) } : done;
  }

  /** R14 (T47): `credentials.aiRunCredentialsEnd({run})`, told and not listened to: whatever it answers or throws, the
   *  ending stands as written. */
  #endRunCredentials(run) {
    try {
      const c = credentialsOf(this.ctx);
      if (c && typeof c.aiRunCredentialsEnd === "function") c.aiRunCredentialsEnd({ run: String(run) });
    } catch { /* never changes the exit */ }
  }

  /** R73, R74 (steps R5, R9): each record the run's looks name (a capture, content or lead referent, steps R9's product
   *  kinds) tied to its step; then its own system step `ended` with every outcome undetermined for a completed run, or
   *  `set_aside` with the stopping bound's or ending's sentence for any other, by the run's system identity. Answers what
   *  steps said, never throws. */
  #endStep(row, bound) {
    const st = this.#steps();
    if (!st || typeof st.stepEnd !== "function") return { told: false, reason: word("ai-runs.reason.steps_reachable") };
    const by = AiRuns.systemOf(row.run);
    try {
      const products = this.#rows(
        `SELECT DISTINCT o.result_kind, o.result_ref FROM observation_log o JOIN ai_run_looks l ON l.seq = o.seq
          WHERE l.run = ? AND o.result_ref IS NOT NULL AND o.result_kind IN ('capture', 'content', 'lead', 'record')
          ORDER BY o.result_kind, o.result_ref LIMIT 200`, row.run);
      const tied = [];
      for (const p of products) {
        const t = typeof st.recordProduct === "function"
          ? st.recordProduct({ step: row.step, record: { kind: p.result_kind, id: String(p.result_ref) }, by }) : null;
        tied.push({ kind: p.result_kind, record: String(p.result_ref), ok: !!(t && t.ok === true) });
      }
      if (row.own_step !== "1") return { told: true, end: null, products: tied };
      const completed = bound === "completed";
      const said = st.stepEnd(completed
        ? { step: row.step, end: "ended", by }
        : { step: row.step, end: "set_aside", reason: RUN_BOUNDS[bound] || RUN_ENDINGS[bound] || bound, by });
      return { told: !!(said && said.ok === true), end: completed ? "ended" : "set_aside", products: tied,
               ...(said && said.ok !== true ? { refusal: said.code || said.reason || null } : {}) };
    } catch { return { told: false, reason: word("ai-runs.reason.steps_did_answer") }; }
  }

  /* ---- DEC-63 / PL-18: THE RUN VERBS' GATE IS PROJECT MEMBERSHIP ----------
   *
   * Bob, 2026-08-09: *"AN INVESTIGATION CAN BE STARTED BY ANY MEMBER OF A
   * PROJECT… the gate is PROJECT MEMBERSHIP, not a capability tier."* IS-6's
   * provisional gated the three run verbs on `contribute` alone. That token
   * stays, as the FLOOR beneath this — it is still checked, in `op-declarations`'
   * `NEEDS` (`src/op-declarations/index.mjs`), and it still refuses in its own words.
   *
   * THE DECISION IS NOT HERE. It is in `run-rules projectGate`, pure and shared
   * by all three verbs. What lives here is the two DATABASE questions the pure
   * function cannot ask: which projects hold this context, and which of those
   * the account has joined.
   */

  /** WHICH PROJECTS HOLD THIS CONTEXT — the run's context resolved to the
   *  projects whose participants may work on it.
   *
   *  [REC-145, 2026-09-19: for a QUESTION this set no longer licenses anything. DEC-63 as amended by
   *  Bob (*"a project doesn't own an area of enquiry"*) means the verdict over an inquiry consults no
   *  project; the set is read only for the report's SIGHTED count (REC-139). The inquiry paragraph
   *  below is kept as the record of PL-18's reading, and its "licenses" sentence is superseded.]
   *
   *  A `project` context is its own project, and nothing else: a run opened
   *  over a project is work in that project by definition.
   *
   *  An `inquiry` context is EVERY PROJECT THAT DRAWS ON IT, and it is a set
   *  rather than a single id because `#moveVersionState` already states the
   *  rule — *"an inquiry can sit beneath several projects and one team's
   *  decision must never silently move another team's stance"*. Participation
   *  in ANY ONE of them licenses asking the system to look at the question;
   *  demanding participation in ALL of them would be a fence tighter than
   *  DEC-63's rule, which says *a member of the project*, not *of every project*.
   *
   *  THE CITATION PREDICATE IS `#citesInto` AND NOT A SECOND QUERY. That helper
   *  is the record's ONE answer to "who cites this, and is the citation live",
   *  extracted precisely so retire's refusal and op=affordances' pre-flight
   *  could not disagree. A raw `SELECT … FROM refs` here would have been a
   *  third answer to the same question and would have counted SEVERED edges,
   *  because the projection does not carry status: a project that WITHDREW from
   *  a question would still have been licensing runs over it.
   *
   *  A context that is not a bundle at all yields an EMPTY set, which the gate
   *  treats as projectless. That is the honest direction and it is not a hole:
   *  a run's context is not required to be a bundle this store holds, and
   *  refusing on a lookup that came back empty would be refusing on what cannot
   *  be verified — a claim about the record made from a fact about our index.
   *  [SUPERSEDED FOR THE OPEN 2026-09-19 by REC-153 (BOB #16, `7d03e852`): a run's context must now be a
   *  bundle this record holds, of the kind named, that the caller can SEE — refused at the open by
   *  `checkRunContextKind` before this is asked, for every caller including a machine. This reading of an
   *  empty set survives only for runs stored before REC-153, which tick and close still read.]
   *
   *  REC-138 / D-426 — EXCEPT A CONTEXT THAT SAYS IT IS A PROJECT, which is now that project
   *  whether or not this store holds it. As built, a PROJECT context the store did not hold read
   *  as projectless and was PERMITTED, while one it held and the caller had not joined was refused
   *  — so a member naming `contextType=project` learned from the verdict whether the id existed,
   *  including for a project they cannot see (§7.9). The answer the paragraph above guards against
   *  does not arise here: the gate asks the CALLER's participation, and a participation row exists
   *  only for a project the record holds, so "you have joined no project by that id" is verified
   *  for an absent id exactly as for a hidden one. A member is now refused both, byte for byte (the
   *  refusal names only what the caller sent); a machine credential is not asked and is unchanged;
   *  a question context keeps its projectless reading, because it names no project. */
  #runContextProjects(contextType, contextId) {
    const id = contextId == null ? "" : String(contextId);
    if (!id) return [];
    if (String(contextType) === "project") return [id];
    return this.#connections().citesInto(id).confirmed.filter((from) => {
      const b = this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, from);
      return !!b && normalizeType(b.object_type) === "project";
    }).sort();
  }

  /** D-451 (INVESTIGATIVE-SESSION.md §11 item 5, RULE 1'S TARGET, BOB #28) — THE QUESTIONS A PROJECT RUN'S
   *  READINGS MAY LAND ON, published by `aiRunRead` so a member (FL-11's `runContextTarget`) can NAME one.
   *
   *  `#runContextProjects` read the other way round: every question `#citesInto` says this project
   *  CONFIRMED-cites (the one live-cites predicate, and the very expression `op=suggest`'s context check (d)
   *  asks, so a SEVERED edge is not a question the run may land on). Not `#refEdgeSevered` directly: the
   *  severance rule has one definition, `connections`' `citesInto`, and a seventh reader is the drift D-267
   *  removed; R19's test holds that a question the project severed is left out. Kept only where `op=suggest` would itself admit it as a target — an inquiry by id (its
   *  `SUGGEST_NOT_AN_INQUIRY` shape test) that THIS viewer can see (`#inSight`, the predicate its viewer gate
   *  asks). A question the viewer cannot see is omitted and not counted (§7.9: a count would say it exists).
   *  So the set published is exactly the set `suggestVersion`'s context check (d) admits for this caller, and
   *  never a second answer to it. Sorted, so the read is stable. */
  #runContextQuestions(projectId, viewer) {
    const id = projectId == null ? "" : String(projectId);
    if (!id) return [];
    const out = [];
    for (const r of this.#rows(`SELECT DISTINCT target_id FROM refs WHERE bundle_id=? AND kind='cites'`, id)) {
      const q = String(r.target_id);
      if (normalizeType(OBJECT_TYPES[q.split("-")[0]]) !== "inquiry") continue;
      if (!this.#connections().citesInto(q).confirmed.includes(id)) continue;
      if (!this.#membership().inSight(q, viewer)) continue;
      out.push(q);
    }
    return out.sort();
  }

  /** R86 (R085-15; K3501; DEC-17): AN INQUIRY THAT SITS IN A PROJECT TAKES THAT PROJECT'S BAR, so with none handed its
   *  basis is `none-recorded`, a fact about the formation, and `context-has-no-project` is left to an inquiry in no project.
   *  "In a project" is `#runContextProjects`' set (the confirmed citations, the one live-cites predicate), kept to the
   *  projects this viewer sees, so the answer never says that a project the viewer cannot see exists. */
  #inProject(row, viewer) {
    return this.#runContextProjects(row.context_type, row.context_id)
      .some((p) => this.#membership().inSight(p, viewer));
  }

  /** R85 (R085-15; K3501 (C3); amends R23): WHAT A RUN'S SEARCH SHOULD LOOK AT, `{items, truncated}`. For a run over an
   *  inquiry, each of its legs' targets (`{id, extent, kind: "leg"}`, the extent the leg's content row names in its human
   *  form, null for a leg that names none or the whole document) and each record it cites (`kind: "cited"`); for a run
   *  over a project, the same for each question R19's `questions` lists. Only what the viewer sees (`inSight`, the one
   *  predicate), deduplicated by id and extent, at most `SUBJECTS_MAX`, `truncated` past that. The reads are SQL over
   *  `inquiry_basis`, `content` and `refs`, as this module reads `bundles` and `refs` elsewhere. No lens is read. */
  #runSubjects(row, viewer) {
    const questions = row.context_type === "project" ? this.#runContextQuestions(row.context_id, viewer)
      : row.context_type === "inquiry" ? [String(row.context_id)] : [];
    const seen = new Set(), items = [];
    let over = false;
    const add = (id, extent, kind) => {
      const key = `${id}\u0000${extent ?? ""}`;
      if (seen.has(key) || !this.#membership().inSight(id, viewer)) return;
      seen.add(key);
      if (items.length >= SUBJECTS_MAX) { over = true; return; }
      items.push({ id, extent, kind });
    };
    for (const q of questions) {
      for (const l of this.#rows(
        `SELECT b.target_id AS id, c.extent_kind AS extent_kind, c.ref AS ref FROM inquiry_basis b
           LEFT JOIN content c ON c.content_id = b.content_id WHERE b.bundle_id = ? ORDER BY b.ord`, q)) {
        const named = l.ref != null && String(l.ref).trim() !== "" && l.extent_kind !== "document";
        add(String(l.id), named ? String(l.ref) : null, "leg");
      }
      for (const r of this.#rows(`SELECT DISTINCT target_id FROM refs WHERE bundle_id = ? AND kind = 'cites' ORDER BY target_id`, q))
        add(String(r.target_id), null, "cited");
    }
    return { items, truncated: over };
  }

  /** REC-153 — THE NAMED CONTEXT'S TYPE, AS THE CALLER CAN SEE IT: the one fact `checkRunContextKind` needs
   *  from the record. Null for an id no bundle holds AND for one the caller cannot see, through ONE return, so
   *  the decision downstream cannot tell absent from hidden (§7.9; `#noSuchProject`'s discipline). Sight is
   *  `#inSight`, the one predicate, and it FAILS CLOSED on an absent viewer — the run verbs' posture
   *  (`RUN_VERB_ACTIONS`, declared in `op-declarations` and stamped by `control-plane`: "fails closed on an
   *  absent stamp"). The first draft did not ask a viewer that was never sent, on `#rosterInSight`'s precedent; REC-145's `run-stamp-dropped` control
   *  showed that with the control plane's stamp removed the check then SAW every project — sight failing
   *  open. No caller reaches the open without the stamp (measured: no suite drives the store directly).
   *  The type is normalised (`problem`/`focus` read `inquiry`). */
  #runContextKind(contextId, viewer) {
    const id = contextId == null ? "" : String(contextId);
    const b = id ? this.#one(`SELECT object_type FROM bundles WHERE bundle_id=?`, id) : null;
    if (!b) return null;
    if (!this.#membership().inSight(id, viewer)) return null;
    return normalizeType(b.object_type);
  }

  /** R89 (T50; N1186): THE PROJECT A RUN IS OPENED IN, `{project, refusal}`. A run over a project is in that project,
   *  whatever `project` carries. A run over a question is in the project it names, or in none when it names none; the
   *  project must be one that draws on the question (`#runContextProjects`, the one live-cites predicate) and that the
   *  opening member has joined (membership's `participation`, as R6 reads it), the member being the one whose act it is
   *  (R52's `#accountMember`). The refusal is `run-rules` R6's `projectGate`, relayed over that project, so a project that
   *  is absent, hidden, not drawn on or not joined is refused alike; with no member behind the caller it is refused too
   *  (a project is a member's to name). Reads only; writes nothing. */
  #runProjectGate({ actor, principalPlane, principalClaude, contextType, contextId, project }) {
    if (String(contextType) === "project") return { project: String(contextId), refusal: null };
    const named = typeof project === "string" ? project.trim() : project == null ? "" : String(project).trim();
    if (!named) return { project: null, refusal: null };
    const member = AiRuns.#accountMember({ actor, principalPlane, principalClaude });
    const drawn = this.#runContextProjects(contextType, contextId).includes(named);
    const part = member && drawn ? this.#membership().participation(named, member) : null;
    const said = projectGate({ actor: member || "no-member", contextType: "project", contextId: named, projects: [named],
                               projectsJoined: part && part.state === "joined" ? [named] : [] });
    return said.permitted ? { project: named, refusal: null } : { project: null, refusal: said };
  }

  /** The gate, as the three run verbs call it. Returns `projectGate`'s verdict
   *  object — `refusal` null or built, and a `ground` that is stated either way.
   *
   *  `#participation` is the record's existing membership predicate and is
   *  CALLED rather than reimplemented, for the reason its own header gives: the
   *  admin bypass came to sit on invite and remove with different shapes
   *  because the test had two copies. */
  #aiRunProjectGate({ actor, contextType, contextId, viewer = null }) {
    const projects = this.#runContextProjects(contextType, contextId);
    const who = actor == null ? "" : String(actor).trim();
    /* R81 (T49; D5): PARTICIPATION IS KEYED BY THE BARE MEMBER ID, and the actor arrives as `member:<id>` (action-plans'
       `planAsk` passes its stamped author), `member:<id>/<tokenId>` or `<id>`. All three are asked as `<id>`. An actor that
       names no member (a machine identity, a `class:` or `token:` stamp) has no id here and is asked as given, so it is
       judged as before and never read as an absent actor. */
    const asked = memberIdOf(who) ?? who;
    /* REC-145 (DEC-63 as amended by Bob, 2026-09-18; Membership v2 §7, BOB #16): OVER A QUESTION NO
       PROJECT IS CONSULTED, so no participation question is asked at all — `runConsultsProjects` is the
       one answer to which contexts are gated, shared with `projectGate` so the facts fed to the verdict
       and the verdict cannot disagree. The citing projects are still resolved above, for the stated
       count below and for nothing else. A PROJECT context keeps the joined-participant gate. */
    const joined = who && runConsultsProjects(contextType)
      ? projects.filter((p) => {
          const part = this.#membership().participation(p, asked);
          return !!part && part.state === "joined";
        })
      : [];
    const g = projectGate({ actor: who, contextType, contextId, projects, projectsJoined: joined });
    /* REC-139 / D-428 (Membership v2 §7, BOB #15, 2026-09-18): THE REPORT COUNTS ONLY THE CITING
       PROJECTS ITS CALLER CAN SEE, and none of the others. [SUPERSEDED IN PART 2026-09-19 by REC-145:
       the verdict no longer reads the citing projects at all — over a question it consults none, over
       a project it reads that one. The count below is unchanged and stays sighted-only.] As REC-139
       built it: the VERDICT above is DEC-63's and is
       computed over EVERY citing project, unchanged — who may START a run is that ruling's question,
       and it requires no disclosure. What changes is the number the answer STATES: it counted a
       project the caller cannot see, so a member's run over a question read `projects: 2` the moment
       a project hidden from them cited it (§7.9, *"not its existence"*). Asked through `#inSight`,
       the one sight predicate, never a second copy; its absent-viewer posture is fail closed, so a
       caller the control plane did not stamp is stated no project rather than every one. A refusal
       carries no count and is returned as built. */
    if (!g.permitted) return g;
    return { ...g, projects: projects.filter((p) => this.#membership().inSight(p, viewer)).length };
  }

  /** The gate's outcome as it travels on a SUCCESS answer. The refusal is
   *  dropped (there is none) and the ground is kept, because DEC-17's
   *  projectless permission is a fact about how the run was allowed to start
   *  and a consumer that cannot see it cannot tell a permitted run from an
   *  ungated one. Shaped in one place so all three verbs publish it alike. */
  static #aiRunGateStated(g) {
    return { projectGate: { applied: g.applied, ground: g.ground, why: g.why, projects: g.projects } };
  }

  /** op=airunopen. Open a run over an inquiry or a project.
   *
   *  Every `conditions it was formed under` field §11 names is taken as given
   *  and stored verbatim — the bias manifest in force, the launching project's
   *  declared standard pair, the skill version. NONE of them is derived here,
   *  and where one is absent it is stored as absent rather than defaulted: §11
   *  says "until D-84 lands, 'no manifest was in force,' STATED", and a default
   *  would be this plane inventing a condition a version is later interpreted
   *  against.
   *
   *  BOTH PRINCIPALS ARE REQUIRED and neither is ever a token value (§14a,
   *  DEC-27(b), DEC-55.4). The Claude account a run carries is the one
   *  `ai-accounts.accountFor` answers for the act of the member who started it
   *  (R52; K1755: their own, else the group's API key), and the run is that
   *  member's act, recorded as `principal_claude`, `member:<id>`, whichever
   *  account serves it; the plane refuses to open a run that names no member, or
   *  one no account serves.
   *
   *  AND SINCE SK-1, SO IS THE SKILL VERSION. The paragraph above still holds
   *  for the bias manifest and the standard pair — absent is stored as absent
   *  and never defaulted — but the skill version is now REQUIRED rather than
   *  merely stored, because "every run records the skill version it ran under"
   *  is a requirement and a condition that may be omitted is not recorded. It
   *  is still never derived: the plane refuses, it does not fill in. The
   *  refusal is C-22.7, built in `run-rules checkSkillVersion`. */
  async open({ run, contextType, contextId, label = null, mode = null,
              principalPlane = null, principalClaude = null, principalClaudeRef = null,
              skillVersion = null, biasManifest = null, standardPair = null,
              bounds = null, state = null, leaseMs = null, at = null,
              /* REC-207 (BOB #32, 2026-09-23 23:42Z): WHICH RUN THIS ONE RE-RUNS, the opener's own word
                 and nothing derived. It is what makes discharge (2) addressable at all — without it there
                 is no link in the record between a re-run and the debt it settles, and a plane inferring
                 one from a context and a clock would be guessing at a judgement. Optional and additive: a
                 run that names none is exactly the run this op opened before. */
              rerunOf = null,
              /* R46 (K660): the plan a run in mode `plan` works on, stored verbatim; refused in any other mode. */
              plan = null,
              /* R73 (T41): where the run came from (`member`, or `explore`), and the step it works: an existing `step`, or
                 the `place` and `work` of a system step of its own, created once the run is open (K2490); a run naming
                 none is a member's, as every run before T41. */
              step = null, origin = null, place = null, work = null,
              /* R77 (T45): the recorded response a re-examination run (`origin: "reexamination"`, mode `plan`) re-examines
                 its plan after, an opaque id stored verbatim; read only on such a run. */
              response = null,
              /* R89 (T50; N1186): the project a run over a question is opened in, explicit at the open; a run over a project
                 is in that project whatever is sent. */
              project = null,
              /* PL-18 / DEC-63: WHICH MEMBER IS ASKING, stamped server-side by
                 `control-plane` and empty for a machine credential. Never a
                 caller's word — a principal a caller can name is not one, which
                 is the rule the two `principal*` fields above already follow. */
              actor = null,
              /* REC-139: WHOSE SIGHT the report's project count is taken in, stamped server-side
                 beside `actor` and read only by `#aiRunProjectGate`'s stated count. */
              viewer = null } = {}) {
    const nowMs = at ? Date.parse(at) : Date.now();
    const now = AiRuns.#aiIso(nowMs);
    /* `started`, deliberately NOT `opened`. When this was written, REC-58's
       consumer walk (`test/case-opened.test.mjs`, since deleted) swept the
       WHOLE repository for `.opened` to prove a published case's field had no
       consumers, and a run answering `opened: true` would have made that
       assertion read false for a reason that had nothing to do with published
       cases — so the collision was avoided here rather than that suite
       weakened. `started` is also the truer word: the run's own state vocabulary
       is `running`, and nothing about it is ever "closed" without a named bound.
       R10's test holds the answer's keys. */
    /* REC-76 — THIS REFUSAL WAS CODELESS UNTIL THE GUARD COULD SEE IT, and that
       is the item's own evidence rather than a tidy-up. `aiRunOpen` refuses with
       `started: false`; the DEC-49 guard's arm C graded a refusal by the single
       literal `ok: false`, so this whole function read as `92L (0 judged, 0
       code(s) checked)` — a governed site read in full, asserting nothing, and
       green. The moment the classifier asked what makes something a refusal IN
       PRINCIPLE, two codeless refusals appeared here. The code, its C-number and
       its canned translation are read from the catalogue at the moment of
       refusal, on REC-64's precedent three guards down; the `note` is kept
       unchanged beside it because it is the OPERATOR's sentence. */
    /* R35: every refusal this act mints, built in one place from its row read by key, so each code is written once, at
       its refusal (the DEC-49 guard's arm G), and each answer keeps its shape: the run, `started: false`, the code, its
       check and translation, then what that refusal adds. `run || null` because the first refusal is of a blank id. */
    const refusal = (code, more = {}) => {
      const row = this.#checkRow(code) || { check: null, translation: null };
      return { run: run || null, started: false, code, check: row.check, translation: row.translation, ...more };
    };
    /* DEC-49 REGION is-airun-open-context — C-33.30. The request names no run id or no
       context for it to sit in: asked before anything is looked up. D-589 narrowed C-33.29..31 from a
       whole-function `where` into one region each (REC-71's rule: a row names the smallest span), so a
       refusal written elsewhere in this function is judged by ITS OWN row and not by these three. */
    if (!run || !contextType || !contextId)
      return refusal("AI_RUN_NO_CONTEXT", {
               note: word("ai-runs.note.run_needs_id") });
    /* END DEC-49 REGION is-airun-open-context */
    /* PL-18 / DEC-63 — THE GATE, AND IT RUNS BEFORE THE RUN'S OWN SHAPE IS
       JUDGED. Placed here, immediately after the context is known and before
       the principals and the skill version, on purpose: whether this account
       may work on this question is a question about the CALLER, and answering
       the shape questions first would tell somebody with no standing here
       whether their skill version parses. Authority before shape is the
       fail-closed order.

       NO `DEC-49 REGION` MARKER HERE, AND THE ABSENCE IS DELIBERATE — it is a
       correction this item's own guard run forced. The refusal is MINTED in
       `run-rules projectGate`, whose row already claims it as a governed site;
       this is a RELAY, exactly as the C-22.7 line four guards down relays
       `run-rules`'s. A marker here would have declared a second governed
       site for one refusal, and `check-refusal-codes.mjs` failed the harness by
       name for precisely that: *a defence that is documented and not wired is
       worse than a missing one.* The code stays a string literal where it is
       written, which is the rule the marker exists to serve. */
    /* REC-153 (Membership v2 §7, the DEC-63 ruling bullet, "AND THE CONTEXT KIND IS CHECKED", BOB #16) — THE
       CONTEXT IS THE KIND IT SAYS IT IS, checked HERE, before the gate: the gate's verdict turns on the kind
       (REC-145), so a kind the caller chose freely was a way around it — an `inquiry` label over a project's
       id opened for a member who had not joined it. A RELAY, like the gate's below and C-22.7's: the refusal
       is minted in `run-rules checkRunContextKind`, whose catalogue row names that site. Only the CONTEXT's
       open is checked; tick and close read the stored kind, which is now checked at the door it came in by. */
    /* REC-149 (Membership v2 §7.14): a run over a DISCOVERABLE project the caller is outside is an act at
       EXISTENCE, answered with the positional C-70.1 — never "no such context" about a project the directory
       showed them. Asked only of a word in the closed vocabulary, so rule 1's refusal is untouched; a hidden or
       absent id still reaches the line below and its one answer. */
    if (Object.prototype.hasOwnProperty.call(RUN_CONTEXTS, String(contextType ?? ""))) {
      const existence = this.#membership().existenceAct(String(contextId ?? ""), viewer ?? "");
      if (existence)
        return { run, started: false, code: existence.code, check: existence.check,
                 translation: existence.translation, detail: existence.detail,
                 project: existence.project, name: existence.name };
    }
    const kind = checkRunContextKind({ contextType, contextId, found: this.#runContextKind(contextId, viewer) });
    if (kind)
      return { run, started: false,
               code: kind.code, check: kind.check,
               translation: kind.translation, detail: kind.detail,
               note: word("ai-runs.note.run_context_kind") };
    const gate = this.#aiRunProjectGate({ actor, contextType, contextId, viewer });
    if (!gate.permitted)
      return { run, started: false,
               code: gate.code, check: gate.check,
               translation: gate.translation, detail: gate.detail,
               note: localize("ai-runs.index.starting_an_investigation_over", "starting an investigation OVER A PROJECT is licensed by PARTICIPATION IN THAT PROJECT (DEC-63, Bob 2026-08-09; a run over a question consults no project, as amended 2026-09-18), and the contribute capability is only the floor beneath that. These are two different facts about an account and they are refused separately so each names its own remedy") };
    /* R89 (T50; N1186; credentials R79): THE PROJECT THE RUN IS OPENED IN, judged here with the gate it belongs to and
       recorded at the open. A run over a project is in that project, whatever `project` carries; a run over a question names
       one explicitly: a project the opening member has joined that draws on the question (`run-rules` R6's refusal,
       relayed, so a project that is absent, hidden, not drawn on or not joined answers alike). */
    const inProject = this.#runProjectGate({ actor, principalPlane, principalClaude, contextType, contextId, project });
    if (inProject.refusal)
      return { run, started: false, code: inProject.refusal.code, check: inProject.refusal.check,
               translation: inProject.refusal.translation, detail: inProject.refusal.detail, note: word("consequences.nothing") };
    /* REC-64 — UI-38's §14a RIDER, DISCHARGED HERE AND NOT AT A SURFACE.
       §14a promises the running-session surface SAYS SO when the capability is
       unavailable, and IS-BUILD-PLAN's FL-6 row states the failure it is
       guarding against: *"when no token resolves the capability is UNAVAILABLE
       and says so — never a silent no-op"*. UI-38 correctly LEFT that sentence
       rather than authoring it, because member-facing refusal wording is DEC-49's
       and not a surface's.

       THIS GUARD ALREADY WAS THAT CONDITION and was answering it with a
       CODELESS note — a sentence a surface can only render verbatim or blank,
       which is the state DEC-49 ended. It now carries a RECEIVED code, its
       C-number and the canned translation, read from the catalogue at the moment
       of refusal (RUNTIME lookup — see MACHINE_FENCE_CHECKS' header for the
       choice and the reason). The `note` is kept unchanged beside it: it is the
       OPERATOR's sentence, which is exactly the
       "keep the design explanation, translate the jargon" split REC-64's own row
       makes at the credential gate. DEC-8 is intact — the surface RECEIVES the
       code and computes nothing.

       [K1502, T33-50: there is no cascade. *No account* is now its own refusal,
       `AI_NO_ACCOUNT` (R52), asked below once the run's member is known; this one
       stays the refusal of a request that names no principal at all.] */
    /* DEC-49 REGION is-airun-open-capability — C-33.29. No account to run under: the
       two principals are not both named. See REC-64's note above for why one code and not two. */
    if (!principalPlane || !principalClaude)
      return refusal("AI_RUN_CAPABILITY_UNAVAILABLE", {
               note: localize("ai-runs.index.a_run_names_two_principals", "a run names TWO principals — the plane credential acting and the member whose own Claude account carries it (K1502, K1503). They are different principals and an act must say both (DEC-27(b), DEC-55.4)") });
    /* END DEC-49 REGION is-airun-open-capability */
    /* SK-1 — THE THIRD CONDITION, AND IT IS REFUSED WHERE THE PRINCIPALS ARE.
       §11 records what a run was FORMED under, and the skill version is one of
       the three. The decision and the two failure shapes are on
       `run-rules checkSkillVersion`, which is where the C-22.7 refusal is
       built and the only implementation of the rule. This site adds nothing to
       it: it hands the value over and returns what comes back, in the same
       `started: false` shape the two guards above use, carrying the DEC-49 code
       and its canned translation so a surface renders a sentence it RECEIVED. */
    const badSkill = checkSkillVersion(skillVersion);
    if (badSkill)
      return { run, started: false, code: badSkill.code, check: badSkill.check,
               translation: badSkill.translation, note: badSkill.detail };
    /* R40 (K102, K182 (4c)) — THE MODE IS A DEPLOYED ONE, asked after the skill version and before anything is
       written: no run, and so no production under a run, exists in a mode not deployed. A run that names no mode
       opens in the deployed mode and records it; a blank mode, or one the one deployment order has not deployed, is
       refused. The fleet member's own first row (`gate-mode`) still refuses first inside the harness. */
    const runMode = mode === undefined || mode === null ? DEFAULT_MODE : String(mode).trim();
    /* DEC-49 REGION is-airun-open-mode — C-109.1. */
    /* K1606 (run-rules R16, R19): a RUN's mode is one of the order's (`RUN_MODES`; `ask` is deployed apart and is no
       run), deployed by its flag, and deployable on what this record holds (B6: the chain and the test bar, R75). */
    /* R78: through `partAdmitted`, the one gate (the test-instance exception lifts the bar alone, never a flag). */
    const admissions = new Map(this.#deployedModes().filter((m) => RUN_MODES.includes(m))
      .map((m) => [m, this.partAdmitted(m)]));
    const deployed = [...admissions.keys()].filter((m) => admissions.get(m).admitted);
    if (!deployed.includes(runMode))
      return refusal("AI_RUN_MODE_NOT_DEPLOYED", {
               mode: String(mode).slice(0, 60), deployed: [...deployed],
               note: word("ai-runs.note.mode_deployed_group", { mode: String(mode).slice(0, 60), deployed: deployed.join(", "),
                                                                are: deployed.length === 1 ? "is" : "are" }) });
    /* END DEC-49 REGION is-airun-open-mode */
    /* R78, R32: the label a run admitted on the test-instance exception carries, fixed now and never derived later;
       null for a run the bar admitted. */
    const untested = admissions.get(runMode).untested ?? null;
    /* R46 (K660; BIO_Action_v0_1.md §4 rule 1): THE PLANNING RUN, asked after the mode is known deployed and before
       anything else about the run's shape: its plan named (and a plan named by no other mode), over a project, by a
       member, with no search allowance, in that order. Each code is written once, at its refusal (`refusal` above). */
    const planRefusal = (code, detail, extra = {}) => refusal(code, { detail, ...extra, note: word("consequences.nothing") });
    const planNamed = typeof plan === "string" && plan.trim() !== "";
    const who = actor == null ? "" : String(actor).trim();
    const search = (Array.isArray(bounds) ? bounds : []).find((b) => b && typeof b === "object"
      && (b.bound === "fetches" || b.bound === "subsessions") && typeof b.allowed === "number" && b.allowed > 0);
    /* DEC-49 REGION is-airun-open-plan */
    if (runMode === "plan" && !planNamed)
      return planRefusal("AI_RUN_PLAN_REQUIRED", "a planning run names the plan it works on: pass plan=<the plan's id>");
    if (runMode !== "plan" && plan != null)
      return planRefusal("AI_RUN_PLAN_UNEXPECTED", localize("ai-runs.index.a_run_in_mode_runmode", "a run in mode '{runMode}' names no plan; only a run in mode 'plan' works on one", { runMode: String(runMode.slice(0, 60)) }));
    if (runMode === "plan" && String(contextType) !== "project")
      return planRefusal("AI_RUN_PLAN_NEEDS_PROJECT", "a planning run is over the project the plan belongs to: contextType=project");
    if (runMode === "plan" && (!who || isMachineIdentity(who)))
      return planRefusal("AI_RUN_PLAN_NEEDS_MEMBER", localize("ai-runs.index.only_a_member_starts", "only a member starts a planning run, for one plan at a time; nothing starts one by itself"));
    if (runMode === "plan" && search)
      return planRefusal("AI_RUN_PLAN_NO_SEARCH", localize("ai-runs.index.a_planning_run_works_from", "a planning run works from what the record already holds, so it declares no '{bound}' allowance (it was given {allowed})", { bound: String(search.bound), allowed: String(search.allowed) }), { bound: search.bound });
    /* END DEC-49 REGION is-airun-open-plan */
    const runOrigin = origin == null ? "member" : String(origin).trim();
    /* R77 (T45; Actions D21; v0.2 rule 16): THE RE-EXAMINATION RUN, after R46's refusals and before anything else about the
       run's shape. A planning run is a member's (`member`, the default) or a re-examination of its plan after a recorded
       response (`reexamination`), started within the member's act that records the response, never by a schedule or
       another run (R46's one exception; that member is `actor`, R46's AI_RUN_PLAN_NEEDS_MEMBER above). The origin is
       judged by `run-rules`' `originAllowed` (its R23), a RELAY, told the run's mode: one site mints AI_RUN_ORIGIN_UNKNOWN
       (K231), so `reexamination` outside mode `plan`, and any origin of a planning run but those two, are refused there.
       A re-examination names the `response`, stored verbatim, and one per plan and response runs at a time. */
    const originSaid = originAllowed({ origin: runOrigin, mode: runMode,
                                       investigateDeployable: this.partAdmitted("investigate").admitted });
    if (!originSaid || originSaid.ok !== true)
      return { run, started: false, code: originSaid.code, check: originSaid.check, translation: originSaid.translation,
               detail: originSaid.detail, note: word("consequences.nothing") };
    const reexam = runMode === "plan" && runOrigin === "reexamination";
    const responseId = reexam && typeof response === "string" && response.trim() !== "" ? response.trim() : null;
    /* DEC-49 REGION is-airun-open-reexam */
    if (reexam && !responseId)
      return planRefusal("AI_RUN_REEXAM_NEEDS_RESPONSE", "a re-examination run names the response it re-examines the plan "
        + "after: pass response=<the recorded response's id>");
    /* asked here, in order, and again just before the insert (below), with no await between that ask and the write */
    const reexamOpen = () => (reexam && this.#reexamRunning(plan, responseId)
      ? planRefusal("AI_RUN_REEXAM_OPEN", localize("ai-runs.index.a_re_examination_of_this", "a re-examination of this plan after this response is already running; its result is the one to read"), { plan: String(plan).slice(0, 60), response: responseId.slice(0, 60) })
      : null);
    const runningAlready = reexamOpen();
    if (runningAlready) return runningAlready;
    /* END DEC-49 REGION is-airun-open-reexam */
    /* R73 (T41; run-rules R23): THE ORIGIN AND THE STEP, after the mode and the plan and before the bounds. The origin
       is judged by `run-rules`' `originAllowed`, a RELAY (an exploring run only while `investigate` may deploy, its chain
       and its test bar both held). A run that works as a system step of its own (an exploring run, each of R74's) names
       that step's `place` and `work`, never a step (K2490): the step is created after the run is open (steps R1's
       machine arm needs a run it holds). A member's run may instead work an existing `step` she can see (absent and
       unseen alike, steps R2); a run names one or the other, never both. The origin was judged above (R77's place). */
    const stepId = step == null || String(step).trim() === "" ? null : String(step).trim();
    const ownStep = place != null || work != null;
    /* DEC-49 REGION is-airun-open-step */
    if (runOrigin === "explore" && (!ownStep || stepId))
      return refusal("AI_RUN_EXPLORE_NEEDS_STEP", { detail: localize("ai-runs.index.an_exploring_run_works", "an exploring run works as a system step of its own: pass the step's place and work, and no step"), note: word("consequences.nothing") });
    if (stepId && (ownStep || !this.#stepSeen(stepId, viewer)))
      return refusal("AI_RUN_STEP_UNKNOWN", { detail: ownStep ? localize("ai-runs.index.a_run_works_one", "a run works one step: an existing one, or a step of its own by its place and work, not both") : localize("ai-runs.index.no_step_stepid_is_open", "no step '{stepId}' is open to this caller", { stepId: String(stepId.slice(0, 60)) }), step: stepId.slice(0, 60),
        note: word("consequences.nothing") });
    /* END DEC-49 REGION is-airun-open-step */
    /* REC-169 — THE SEED IS THE TICK'S RULE. A declared `consumed` is the other caller-written figure in
       `ai_run_bounds`, and `Number(b.consumed) || 0` let a run OPEN already refunded (`consumed: -10`) or seed a
       bound the plane counts. The same check the tick asks (`checkConsume`), with an absent seed meaning none spent.
       REC-172 (§14b.6) — AND THE DECLARATION ITSELF, before the seed: a `bounds` that is not a list, an entry that is
       not an object or names no bound (C-22.15), a `lease` entry (C-22.14 — the plane decides it), and an `allowed`
       that is not a whole number of zero or more (C-22.13). Each was DROPPED or COERCED below (`continue`, and
       `Number(b.allowed) || 0`), so a member who declared a ceiling could get a run without it, or one they never set.
       REC-177 (§14b item 6, BOB #30) — AND AN ENTRY THAT STATES NO ALLOWANCE (`allowed` absent or 0, C-22.16): it was
       opened at 0, which `finishedBound` reads as no ceiling, so the run recorded a bound it did not have. */
    const badSeed = checkConsume(bounds, { list: true });
    if (badSeed)
      return { run, started: false, code: badSeed.code, check: badSeed.check,
               translation: badSeed.translation, note: badSeed.detail };
    /* R45 (N293) — THE SEED'S STATE IS BOUNDED AS THE TICK'S IS, asked after the bounds and before anything is
       computed or written. A RELAY: C-22.18 is minted in `run-rules checkRunState`, whose row names that site. */
    const badState = checkRunState(state);
    if (badState)
      return { run, started: false, code: badState.code, check: badState.check,
               translation: badState.translation, note: badState.detail,
               bytes: badState.bytes, limit: badState.limit };
    /* D-85 (INVESTIGATIVE-SESSION.md §11 item 5, rule 3, BOB #25): THE LENS IN FORCE AT THIS INSTANT, computed by
       the PLANE, beside the manifest the run was HANDED. The handed one is stored verbatim below and nothing is
       derived from it; this is the call `#biasForRun` makes for the run's context (a project's scope for a run
       over a project, the instance scope for one over a question), in the opener's own sight — so the read can
       tell *the lens changed after the run opened* from *the run was handed a lens other than the one in force*,
       which `moved` alone could not. Asked AFTER every refusal above (a refused open computes nothing) and
       BEFORE the id's existence is asked, so the check and the insert below stay one synchronous step with no
       await between them. */
    const lensNow = await this.#bias().biasManifest({
      scope: String(contextType) === "project" ? "project" : "instance",
      scopeId: String(contextType) === "project" ? String(contextId) : "",
      viewer, limit: 1 });
    const lensAtOpen = JSON.stringify({
      in_force: lensNow.in_force === true,
      statements_sha: lensNow.in_force === true ? (lensNow.statements_sha ?? null) : null,
      scope: lensNow.scope ?? null, scope_id: lensNow.scope_id ?? null,
      bundles: (Array.isArray(lensNow.bundles) ? lensNow.bundles : [])
        .map((b) => ({ bundle_id: b.bundle_id, revision: b.revision ?? null })),
      at: now });
    /* R52 (K1503, K1755): THE ACCOUNT THE RUN CARRIES, asked of `ai-accounts.accountFor` for the act of the member who
       started it, here, before the id's existence is asked, so the check below and the insert stay one synchronous step
       with no await between them. Its answer is applied in R52's place further down (after the re-run refusals), and
       the unsealed key is dropped at once: only whether an account serves the member, and which, is kept. */
    const accountMember = AiRuns.#accountMember({ actor, principalPlane, principalClaude });
    /* (T41; ai-accounts R11) a run over a project names it, so the project's own account serves first when it is held */
    const account = accountMember ? await this.#accountFor(accountMember, "run",
      String(contextType) === "project" ? String(contextId) : null) : null;
    /* REC-76 — the second of the two codeless refusals the widened classifier
       found here. It is a real member-facing condition (an id that is already in
       use), and it was answering with a bare sentence a surface could only
       render verbatim or blank. */
    /* DEC-49 REGION is-airun-open-already — C-33.31. The run id is already on record.
       Asked AFTER the lens is computed and immediately before the insert, with no await between them. */
    if (this.#one(`SELECT run FROM ai_runs WHERE run = ?`, run))
      return refusal("AI_RUN_ALREADY_OPEN", { note: word("ai-runs.note.run_id_already") });
    /* END DEC-49 REGION is-airun-open-already */
    /* R77: asked again here, with no await between it and the insert, so two acts recording the same response cannot both
       open a re-examination run while the lens and the account above were awaited. The refusal is the one above's. */
    const runningNow = reexamOpen();
    if (runningNow) return runningNow;

    /* REC-207 — THE RE-RUN LINK IS JUDGED BEFORE IT IS WRITTEN, because a link the record cannot stand
       behind is worse than none: `aiRunClose` settles a bias debt on the strength of this field, so a
       `rerun_of` naming a run that is not there, or that is somewhere else, would be a discharge resting
       on the caller's word. Asked LAST of the open's guards — after authority and after shape — so a
       caller with no standing here learns nothing about which runs exist.
       NO `DEC-49 REGION` MARKER HERE, and the absence was a CORRECTION this item's own guard run forced —
       the same shape as the note at this function's project gate, one cause down. The three rows'
       `where` was the WHOLE FUNCTION, as its three existing rows' were, because `check-refusal-codes.mjs`
       (deleted in T20) judged a region's refusals at the region AND again at an enclosing whole-function
       site, where the code was not one of that site's rows: a region inside a function that kept a
       whole-function `where` failed all three by name. Measured on the first run of this item. The three
       rows are run-rules' (`run-rules/checks.mjs`, read here by key, R35), whose header carries the argument
       and D-589's later narrowing of C-33.29..31 into regions. R9's test holds the three refusals in their
       order, and R35's their rows. */
    const reRuns = String(rerunOf ?? "").trim();
    if (reRuns) {
      if (reRuns === String(run))
        return refusal("AI_RUN_RERUN_SELF", {
                 note: word("ai-runs.note.run_re_run") });
      const target = this.#one(`SELECT context_type, context_id FROM ai_runs WHERE run = ?`, reRuns);
      /* UNSEEN ANSWERS AS ABSENT, byte for byte — `aiRunClose`'s own posture and REC-25/REC-30's rule.
         A caller must not be able to establish that a run exists by offering to re-run it. */
      if (!target || !this.#aiRunInSight(reRuns, viewer))
        return refusal("AI_RUN_RERUN_UNKNOWN", {
                 note: word("ai-runs.note.run_either_existed_purged") });
      if (target.context_type !== String(contextType) || target.context_id !== String(contextId))
        return refusal("AI_RUN_RERUN_OTHER_CONTEXT", {
                 note: word("ai-runs.note.re_run_runs") });
    }

    /* R52 (K1502, K1503, K1755): THE ACCOUNT THE RUN CARRIES, the one `ai-accounts.accountFor` answered above for the act
       of the member who started it (their own reference, else their own sign-in (T38; K2299), else the group's API key
       while held and on); with none,
       refused by name. Then R50: that member's use today against the ceiling in force, the copy's included, whichever
       account serves them. Both before anything is written, and before R47's check, which stays last. Each refusal keeps
       the open's shape. */
    /* K1606 (run-rules R18, C-22.19, a RELAY): a run starts only at a member's act — the member found above; with none,
       the caller's own stamp is what is judged, and a run is never the standing question's exception. */
    const start = startAllowed({ startedBy: accountMember ? `member:${accountMember}` : (actor || principalPlane), mode: runMode });
    if (!start || start.ok !== true)
      return { run, started: false, code: start.code, check: start.check, translation: start.translation, detail: start.detail };
    if (!account || account.refusal)
      return { run, started: false, ...(account ? account.refusal : this.#noAccount(accountMember, "A run")) };
    /* R52 (B5): the paying account's limits, judged by `ai-use.useCheck` (its R3) for this member's use `run`, its
       refusal relayed in the open's shape. */
    const overLimit = this.#useCheck(account.owner, accountMember, nowMs);
    if (overLimit) return { run, started: false, ...AiRuns.#shed(overLimit) };
    /* R73, R74: a system step of its own needs steps, asked before anything is written. */
    if (ownStep && !this.#steps())
      return refusal("AI_RUN_STEP_UNKNOWN", { detail: localize("ai-runs.index.the_runs_own_step", "the run's own step cannot be made: steps is not reachable"), note: word("consequences.nothing") });

    /* R47 (K660): THE CHECK A LATER MODULE REGISTERED FOR THIS MODE, applied LAST, synchronously, just before the
       write, and its refusal passed on unchanged. A planning run with no check registered is refused (fail closed); so
       is a check that throws or answers something other than null or a refusal, since a check that cannot say is not
       a check that passed. */
    const held = this.#openChecks.find((c) => c.mode === runMode);
    /* DEC-49 REGION is-airun-open-check */
    if (held || runMode === "plan") {
      let said;
      /* R77: the check also receives the run's origin and, for a re-examination, the response (null otherwise). */
      try { said = held ? held.fn({ contextType: String(contextType), contextId: String(contextId), plan, actor, viewer,
                                    origin: runOrigin, response: responseId }) : undefined; }
      catch { said = undefined; }
      if (said !== null)
        return said && typeof said === "object" && typeof said.code === "string"
          ? { run, started: false, ...said }
          : refusal("AI_RUN_MODE_UNCHECKED", {
              detail: held ? localize("ai-runs.index.the_check_module_registered_for", "the check {module} registered for mode '{runMode}' gave no answer", { module: String(held.module), runMode: String(runMode) })
                           : localize("ai-runs.index.nothing_is_registered_to_check", "nothing is registered to check a run in mode '{runMode}'", { runMode: String(runMode) }),
              note: word("consequences.nothing") });
    }
    /* END DEC-49 REGION is-airun-open-check */
    const lease = Number(leaseMs) > 0 ? Number(leaseMs) : this.#leaseMs();
    let systemStep = null;
    const STEP_REFUSED = Symbol("step refused");
    try { this.#transact(() => {
      this.sql.exec(
        `INSERT INTO ai_runs (run, status, label, mode, context_type, context_id,
           principal_plane, principal_claude, principal_claude_ref, skill_version,
           bias_manifest, standard_pair, created, updated, expires, ticks, state, lens_at_open,
           rerun_of, plan, step, origin, response, untested, project)
         VALUES (?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        run, label, runMode, String(contextType), String(contextId),
        /* SK-1: TRIMMED, and the reason is PL-4's measurement one field over —
           a value that survives a falsiness guard while naming nothing reads as
           present and travels. `checkSkillVersion` judged the trimmed value, so
           storing the untrimmed one would store something the guard never saw. */
        /* R52: `principal_claude` is the member whose account carries the run (agent-worker R10 reads it so). */
        /* R52 (T41): `principal_claude` the paying owner the account answered (`member:<id>`, `project:<id>`, `group`),
           `principal_claude_ref` the member whose act it is, whichever account paid */
        String(principalPlane), account.owner, `member:${accountMember}`,
        String(skillVersion).trim(),
        biasManifest, standardPair, now, now, AiRuns.#aiIso(nowMs + lease),
        JSON.stringify(state == null ? {} : state), lensAtOpen,
        /* REC-207: judged above, and stored as every empty case on this open is stored — absent rather
           than defaulted. A run that names no re-run reads `rerun_of` NULL, which is what it is. */
        reRuns || null,
        /* R46: verbatim, and only a planning run carries one (any other mode naming a plan was refused above). */
        runMode === "plan" ? plan : null,
        /* R73: the step and the origin, judged above; R77: a re-examination's response, verbatim (trimmed, as judged) */
        stepId, runOrigin, responseId,
        /* R78: the exception's label, as admitted above */
        untested ? JSON.stringify(untested) : null,
        /* R89: the project the run is opened in, judged above; recorded here and never changed */
        inProject.project);
      for (const b of Array.isArray(bounds) ? bounds : []) {
        if (!b || !Object.prototype.hasOwnProperty.call(RUN_BOUNDS, String(b.bound))) continue;
        this.sql.exec(
          `INSERT INTO ai_run_bounds (run, bound, allowed, consumed, unit) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(run, bound) DO NOTHING`,
          run, String(b.bound), b.allowed,    /* REC-177: judged above, a whole number of one or more (C-22.16); the old `absent is 0` default was the no-ceiling path */
          b.consumed == null ? 0 : b.consumed,   /* REC-169: judged above */
          b.unit == null ? null : String(b.unit));
      }
      /* R73, R74 (K2490): THE RUN'S OWN SYSTEM STEP, created now the run is open, by the run's own system identity (steps
         R1's machine arm, held through `runHolder`), and tied to the run. In the open's own transaction: a step steps
         refuses (its place or work, R1; one alike, R8) rolls the run back, and the refusal is answered with nothing
         written. */
      if (ownStep) {
        const made = this.#steps().stepCreate({ place, work, run, by: AiRuns.systemOf(run) });
        if (!made || made.ok !== true || typeof made.step !== "string") { systemStep = made; throw STEP_REFUSED; }
        this.sql.exec(`UPDATE ai_runs SET step = ?, own_step = '1' WHERE run = ?`, made.step, run);
        systemStep = made.step;
      }
    }); } catch (e) {
      if (e !== STEP_REFUSED) throw e;
      const said = systemStep && typeof systemStep === "object" ? systemStep : {};
      return { run, started: false, code: said.code || said.reason || "STEP_REFUSED", check: said.check ?? null,
               translation: said.translation ?? null, detail: said.detail ?? null, ...(said.step ? { step: said.step } : {}),
               note: word("ai-runs.note.run_step_refused") };
    }
    /* R43: the post-write notice, after the run's transaction has committed, to every listener once in the modules'
       order; one that throws or rejects changes neither the run nor this answer. */
    const expires = AiRuns.#aiIso(nowMs + lease);
    for (const l of this.#runListeners) {
      try { await l.fn({ run, contextType: String(contextType), contextId: String(contextId), expires }); }
      catch { /* isolated */ }
    }
    /* PL-18: the gate's outcome travels on the SUCCESS answer too, and that is
       the half DEC-17 makes necessary. A run over a projectless inquiry is
       PERMITTED — *"an inquiry outside any project has no bar and inherits
       none"* — and a permission nobody can see is indistinguishable from a gate
       that never ran. Stating it is the same obligation as stating which
       absence was found. */
    return { run, started: true, status: "running", ticks: 1, created: now,
             expires,
             /* REC-207: the link, echoed, and ONLY when there is one. A caller that named a re-run should
                be able to see that the record took it, because the discharge at this run's close rests on
                it — and an echo that appeared as `null` on every other open would be a new key on an
                answer every existing reader parses, for no fact. */
             ...(reRuns ? { rerun_of: reRuns } : {}),
             ...(systemStep ? { step: systemStep } : stepId ? { step: stepId } : {}),
             ...(runOrigin !== "member" ? { origin: runOrigin } : {}),
             ...(responseId ? { response: responseId } : {}),
             /* R78: the label, null for a run the bar admitted */
             untested,
             /* R89: the project the run was opened in; null for a run in none */
             project: inProject.project,
             ...AiRuns.#aiRunGateStated(gate) };
  }

  /** R74 (D7; K2472; B4 (5), K2490): A MEMBER'S BATCH, one bounded run per step she may see, under one act and one
   *  estimate. `steps` is the list of her steps (at most `OPEN_MANY_MAX`, each named once); `mode`, `bounds`,
   *  `skillVersion`, `label` are each run's, as `open` takes them; `owner` the account the estimate is asked of (default:
   *  the account `ai-accounts.accountFor` answers for her act). Refused whole, nothing written: no member's act
   *  (`run-rules` R18, relayed), or no list of steps (`AI_RUN_NO_CONTEXT`). Otherwise `ai-use.estimate` is asked once for
   *  the batch (its answer, a refusal included, carried as `estimate`), then each step in order: one she cannot see
   *  answers `AI_RUN_STEP_UNKNOWN` for that step alone, a group-placed one `AI_RUN_NO_CONTEXT` (a run sits in an inquiry
   *  or a project); every other opens through `open` exactly as one run (its own checks, its own `useCheck`), over the
   *  step's place (its first question she sees, or its project), with a system step of its own whose work names hers
   *  (J5 (9)). A refusal of one is answered for it and the others open; each run's limits end it alone (R14), setting
   *  only its own step aside (R73). Answers `{ok, estimate, runs: [{step, run?, system_step?, refusal?}]}`. */
  static OPEN_MANY_MAX = 50;
  async openMany({ steps = null, mode = null, owner = null, bounds = null, skillVersion = null, label = null,
                   principalPlane = null, actor = null, viewer = null, at = null } = {}) {
    const member = memberIdOf(actor);
    const runMode = mode == null ? DEFAULT_MODE : String(mode).trim();
    const start = startAllowed({ startedBy: member ? `member:${member}` : (actor || principalPlane), mode: runMode });
    if (!start || start.ok !== true)
      return { ok: false, code: start.code, check: start.check, translation: start.translation, detail: start.detail };
    const list = Array.isArray(steps) ? steps.map((x) => (typeof x === "string" ? x.trim() : "")) : [];
    /* DEC-49 REGION is-airun-open-many */
    if (!list.length || list.length > AiRuns.OPEN_MANY_MAX || list.some((x) => !x) || new Set(list).size !== list.length)
      return { ...this.#refuse("AI_RUN_NO_CONTEXT", localize("ai-runs.index.a_batch_names_the_steps", "a batch names the steps it runs on, each once, 1 to {OPEN_MANY_MAX} of them. Nothing was started.", { OPEN_MANY_MAX: String(AiRuns.OPEN_MANY_MAX) })), started: false };
    /* END DEC-49 REGION is-airun-open-many */
    let payer = owner;
    if (payer == null) {
      const a = await this.#accountFor(member, "run", null);
      payer = a && !a.refusal ? a.owner : null;
    }
    let estimate = null;
    try {
      estimate = payer ? this.#aiUse().estimate({ owner: payer, use: "run", mode: runMode, count: list.length, viewer: `member:${member}` })
        : this.#noAccount(member, "A batch of runs");
    } catch { estimate = null; }
    const st = this.#steps();
    const runs = [];
    for (const stepId of list) {
      let seen = null;
      try { seen = st ? st.step({ step: stepId, viewer }) : null; } catch { seen = null; }
      if (!seen || seen.ok === false || seen.step !== stepId) {
        runs.push({ step: stepId, refusal: this.#refuse("AI_RUN_STEP_UNKNOWN", localize("ai-runs.index.no_step_stepid_is_open_2", "no step '{stepId}' is open to you. Nothing was started for it.", { stepId: String(stepId.slice(0, 60)) })) });
        continue;
      }
      const place = seen.place || {};
      const questions = Array.isArray(place.questions) ? [...place.questions].sort() : [];
      const context = place.project ? { type: "project", id: place.project, place: { project: place.project } }
        : questions.length ? { type: "inquiry", id: questions[0], place: { questions } } : null;
      if (!context) {
        runs.push({ step: stepId, refusal: this.#refuse("AI_RUN_NO_CONTEXT", localize("ai-runs.index.a_teams_own_step_has", "a team's own step has no question or project for a run to sit in. Nothing was started for it.")) });
        continue;
      }
      let k = 1;
      while (this.#one(`SELECT run FROM ai_runs WHERE run = ?`, `RUN-${stepId}-${k}`)) k += 1;
      const run = `RUN-${stepId}-${k}`;
      const opened = await this.open({ run, contextType: context.type, contextId: context.id, label, mode: runMode,
        principalPlane, principalClaude: `member:${member}`, skillVersion, bounds, at, actor, viewer, origin: "member",
        place: context.place, work: localize("ai-runs.index.ai_run_on_stepid_string", "AI run on {stepId}: {String}", { stepId: String(stepId), String: String(String(seen.work ?? "")) }).slice(0, WORK_MAX) });
      if (opened && opened.started === true) runs.push({ step: stepId, run, system_step: opened.step ?? null });
      else { const { run: _r, started: _s, ...refusal } = opened || {}; runs.push({ step: stepId, refusal }); }
    }
    return { ok: true, estimate, runs };
  }

  /** R77: whether a re-examination run for `plan` after `response` is running (a planning run of that origin naming both).
   *  Read whole, not through any viewer's sight: one per plan and response, whoever could see it. */
  #reexamRunning(plan, response) {
    return !!this.#one(`SELECT 1 x FROM ai_runs WHERE status = 'running' AND mode = 'plan' AND origin = 'reexamination'
                          AND plan = ? AND response = ? LIMIT 1`, String(plan), String(response));
  }

  /** R73: whether `viewer` may see step `id` (steps R2, R4's `step`); false where steps is not reachable or answers
   *  nothing, so an unverifiable step is refused rather than trusted. */
  #stepSeen(id, viewer) {
    try {
      const st = this.#steps();
      const a = st && typeof st.step === "function" ? st.step({ step: id, viewer }) : null;
      /* steps' refusal (NO_SUCH_STEP) also names the step it was asked about, so only an answer that is not a refusal
         counts as seen */
      return !!a && a.ok !== false && a.found !== false && a.step === id;
    } catch { return false; }
  }

  /** R73, R24, R14: the WHERE over `observation_log` naming one run's own rows: its run rows, and its looks under its
   *  step (tied to it in `ai_run_looks`). `alias` qualifies the columns. */
  static #ownRows(alias = "") {
    const a = alias ? `${alias}.` : "";
    return `((${a}authority_kind = 'run' AND ${a}authority = ?) OR ${a}seq IN (SELECT l.seq FROM ai_run_looks l WHERE l.run = ?))`;
  }

  /** REC-152 — CAN THIS VIEWER SEE THIS RUN? `aiRunRead`'s own predicate (D-15's `#bundleGate` over the
   *  run's context), asked of one run id, so the tick and the close hide exactly what `op=airun` hides. An
   *  absent stamp fails closed, as it does there. */
  #aiRunInSight(run, viewer) {
    const seen = this.#bundleGate("r.context_id", viewer);
    return !!this.#one(`SELECT 1 AS x FROM ai_runs r WHERE r.run = ? AND ${seen.sql}`, run, ...seen.args);
  }

  /** op=airuntick. The heartbeat, the work list, and the log — one call.
   *
   *  A tick does four things and the order matters: it appends what the run
   *  OBSERVED (so partial results survive a death that happens next), it spends
   *  the budget, it extends the lease, and only then does it ask whether a
   *  bound is now exhausted. A tick that spent the last of a budget ENDS the
   *  run through the one exit — a run cannot overspend and then decline to say
   *  so.
   *
   *  A tick for a run that has already ended is a STATED no-op rather than a
   *  refusal, following `saveCaptureSession`'s `{ saved: false }` precedent: it
   *  is a fact about the run's state, and a late tick from a straggling
   *  sub-session must not resurrect a run whose log is already closed. */
  tick({ run, state = null, consume = null, log = null, leaseMs = null, at = null,
              /* R84 (R085-7; agent-worker R91): how a segment ended, `{by, done, refusals, error?}`. */
              segment_end = null,
              /* R72 (N588), R88: one entry per conversation that reached the provider since the last tick,
                 `{mode, model, effort, usage, calls}`. */
              usage = null,
              actor = null, viewer = null,
              /* REC-152: the caller's PRINCIPAL, stamped server-side by `control-plane` in the form the open
                 stamps `principal_plane` in — never a caller's word. */
              caller = null } = {}) {
    const nowMs = at ? Date.parse(at) : Date.now();
    const now = AiRuns.#aiIso(nowMs);
    const row = this.#one(`SELECT * FROM ai_runs WHERE run = ?`, run);
    if (!row) return { run: run || null, found: false,
      note: word("ai-runs.note.run_either_existed") };
    /* REC-152 (Membership v2 §7, "WHO MAY TICK AND CLOSE A RUN", BOB #16) — SIGHT FIRST, THEN POSITION.
       A caller who cannot see the run's context is answered EXACTLY as for a run that does not exist —
       the answer two lines up, byte for byte — because a refusal would tell them the run exists (§7.9).
       One who can see it and is not the run's PRINCIPAL is refused positionally (C-22.12), before the
       project gate and before anything is written: a tick by anyone else writes acts under a name that
       did not take them. Sight is `aiRunRead`'s own question (`#aiRunInSight`), so a run `op=airun`
       hides is a run this door hides. */
    if (!this.#aiRunInSight(run, viewer)) return { run: run || null, found: false,
      note: word("ai-runs.note.run_either_existed") };
    const notPrincipal = runPrincipalGate({ caller, principal: row.principal_plane });
    if (notPrincipal)
      return { run, ticked: false, found: true, status: row.status,
               code: notPrincipal.code, check: notPrincipal.check,
               translation: notPrincipal.translation, detail: notPrincipal.detail,
               note: word("ai-runs.note.run_driven_principal") };
    /* PL-18 / DEC-63 — THE SAME GATE, AFTER THE RUN IS FOUND AND BEFORE
       ANYTHING IS WRITTEN. Ordered this way deliberately: an unknown run is
       answered as unknown to everybody, so the gate cannot be used to learn
       which run ids exist. It reads the context OFF THE RUN ROW rather than
       from the caller, because the caller does not name one here and a context
       a caller could name would be a gate a caller could choose.

       WHY THE TICK IS GATED AT ALL, which is IS-6's own argument for giving all
       three verbs one capability: gating the open and leaving the tick free
       would mean an account that may not START a run may still SPEND its budget
       and drive it, which is the fence in the wrong place.

       `ticked: false` IS DELIBERATELY THE FIRST BOOLEAN-SHAPED PROPERTY, ahead
       of `found: true`, and it is not cosmetic. REC-76's arm C grades a return
       by its FIRST boolean-shaped top-level property: a literal `true` there
       declares a success and is NOT judged, so a refusal that leads with
       `found: true` is invisible to the DEC-49 guard — which is precisely how
       two codeless refusals sat unjudged in `aiRunOpen` until the classifier was
       widened. The verdict of this return is that the tick did not happen.

       A RELAY, not a governed site — see the note at `aiRunOpen`'s gate. */
    const gate = this.#aiRunProjectGate({ actor, contextType: row.context_type, contextId: row.context_id, viewer });
    if (!gate.permitted)
      return { run, ticked: false, found: true, status: row.status,
               code: gate.code, check: gate.check,
               translation: gate.translation, detail: gate.detail,
               note: localize("ai-runs.index.continuing_a_run_over", "continuing a run over a project is licensed by PARTICIPATION IN THAT PROJECT (DEC-63), and the contribute capability is only the floor beneath that. Nothing was appended and no budget was spent") };
    if (row.status !== "running")
      return { run, found: true, ticked: false, status: row.status,
               bound: row.stopped_bound,
               note: word("ai-runs.note.run_ended_log") };
    /* REC-169 (§14b.6; §11 item 5 rule 2) — THE FIGURES ARE JUDGED WHOLE, BEFORE ANYTHING IS WRITTEN. The loop below
       used to write `Number(v) || 0` for every bound named, so the run's own principal could send `surfaces: -1`
       after its last question and open another — a REFUND of a bound its member set. One bad figure refuses the
       whole tick: nothing appended, nothing spent, the lease not extended. A clamp would answer `ticked: true` over
       a spend that did not happen. Asked AFTER sight, position, the project gate and status, so a caller who may
       not drive the run learns nothing about the figures' rule, and an ended run's tick stays its stated no-op. */
    /* REC-172 (§14b.6) — AND THE MAP ITSELF: a `consume` that is not a map (an ARRAY above all — vf4 sent one for its
       whole life) or a key naming no bound was SKIPPED by the loop below, answering `ticked: true` over a spend that
       did not happen (C-22.15); `lease` is the plane's to decide (C-22.14). */
    const badConsume = checkConsume(consume, { map: true });
    if (badConsume)
      return { run, ticked: false, found: true, status: row.status,
               code: badConsume.code, check: badConsume.check,
               translation: badConsume.translation, detail: badConsume.detail, bound: badConsume.bound,
               note: word("ai-runs.note.run_budget_moves") };
    /* R45 (N293) — THE STATE IS BOUNDED, judged whole after the figures and before anything is written: a state over
       the ceiling refuses the whole tick (no entry, no figure, no lease, no tick), and an absent or null one is not
       measured and the held state stands (R12). A RELAY of `run-rules checkRunState`, as the figures' refusal is. */
    const badState = checkRunState(state);
    if (badState)
      return { run, ticked: false, found: true, status: row.status,
               code: badState.code, check: badState.check,
               translation: badState.translation, detail: badState.detail,
               bytes: badState.bytes, limit: badState.limit,
               note: word("ai-runs.note.run_state_resumable") };
    /* R72 — THE CONVERSATIONS' FIGURES: a list, one entry per conversation that reached the provider. Each entry's shape
       is judged by `ai-use.countUsage` (its R1: `AI_RUN_CONSUME_INVALID`), the one judge, inside the tick's own
       transaction: a refused entry rolls the whole tick back, so nothing of it is written. */
    const calls = usage == null ? [] : Array.isArray(usage) ? usage : null;
    if (!calls)
      return { run, ticked: false, found: true, status: row.status,
               ...AiRuns.#shed(this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-runs.index.usage_is_a_list", "`usage` is a list with one entry per conversation that reached the model since the last tick, each {mode, model, usage, calls}."))),
               note: word("ai-runs.note.appended_budget_spent") };
    /* R52: the calls are counted to the account the run recorded as paying (`principal_claude`) and the member whose act
       the run is (`principal_claude_ref`); a run that names no member (one opened before T33-50) cannot have its calls
       counted, and a tick reporting calls for it is refused by name. */
    const payer = AiRuns.#memberOfRun(row);
    if (calls.length && !payer)
      return { run, ticked: false, found: true, status: row.status, ...AiRuns.#shed(this.#noAccount(null, "This run")) };
    /* R52 (B5) — THE PAYING ACCOUNT'S LIMITS (`ai-use.useCheck`, its R3), on the use before this tick. The calls this tick
       reports were made and paid for, so they are counted whatever the answer (the counter stays true, J5 (13)); over a
       limit the refusal is then answered and nothing else of the tick is written: no entry, no figure, no lease, no tick. */
    const overLimit = payer ? this.#useCheck(row.principal_claude, payer, nowMs) : null;
    if (overLimit) {
      const counted = calls.length ? this.#countTick(row, payer, calls, nowMs) : 0;
      if (counted && typeof counted === "object")
        return { run, ticked: false, found: true, status: row.status, ...AiRuns.#shed(counted),
                 note: word("ai-runs.note.appended_budget_spent") };
      return { run, ticked: false, found: true, status: row.status, ...AiRuns.#shed(overLimit), counted };
    }

    const lease = Number(leaseMs) > 0 ? Number(leaseMs) : this.#leaseMs();
    const seg = AiRuns.#segmentEnd(segment_end);
    const refused = [];
    let appended = 0;
    const USAGE_REFUSED = Symbol("usage refused");
    let usageRefusal = null;
    try { this.#transact(() => {
      /* R52, R72: the calls, through ai-use's counter under the run's id, in the tick's own transaction; nothing of them
         reaches the log. */
      if (calls.length) {
        const bad = this.#countEntries(row, payer, calls, nowMs);
        if (bad) { usageRefusal = bad; throw USAGE_REFUSED; }
      }
      for (const e of Array.isArray(log) ? log : []) {
        /* `row.principal_claude` is the run's machine identity and this method
           already holds the row — see #aiRunAppend's note on why it is passed
           rather than looked up. */
        const bad = this.#aiRunAppend(run, e, now, 0, row.principal_claude || null, row.step || null);
        if (bad) refused.push(bad); else appended += 1;
      }
      /* R84: the segment's end, at level `meaning`, after the entries the segment sent with it */
      if (seg) {
        const bad = this.#aiRunAppend(run, {
          level: "meaning", subject: "segment -> end", ...this.#aiRunRestatedState(run), governed: false,
          detail: localize("ai-runs.index.the_segment_ended_by_v1", "the segment ended (by: {v1}; {v2}{v3}). Refusals it met: {v4}", { v1: String(seg.by ?? "its own segment bound"), v2: String(seg.done ? localize("ai-runs.index.the_runs_work_is_done", "the run's work is done") : localize("ai-runs.index.the_runs_work_is_not_done", "the run's work is not done")), v3: String(seg.error ? `; in error ${seg.error}` : ""), v4: String(seg.refusals.length ? seg.refusals.join(", ") : "none") }),
        }, now, 0, row.principal_claude || null, row.step || null);
        if (bad) refused.push(bad); else appended += 1;
      }
      for (const [k, v] of Object.entries(consume && typeof consume === "object" ? consume : {})) {
        if (!Object.prototype.hasOwnProperty.call(RUN_BOUNDS, k)) continue;
        this.sql.exec(
          `INSERT INTO ai_run_bounds (run, bound, allowed, consumed) VALUES (?, ?, 0, ?)
           ON CONFLICT(run, bound) DO UPDATE SET consumed = consumed + ?`,
          run, k, v, v);   /* REC-169: judged above — a non-negative safe integer, on a bound the caller counts */
      }
      this.sql.exec(
        `UPDATE ai_runs SET updated = ?, expires = ?, ticks = ticks + 1${state == null ? "" : ", state = ?"}
         WHERE run = ?`,
        ...(state == null ? [now, AiRuns.#aiIso(nowMs + lease), run]
                          : [now, AiRuns.#aiIso(nowMs + lease), JSON.stringify(state), run]));
    }); } catch (e) {
      if (e !== USAGE_REFUSED) throw e;
      return { run, ticked: false, found: true, status: row.status, ...AiRuns.#shed(usageRefusal),
               note: word("ai-runs.note.conversation_figures_calls") };
    }

    /* The exhaustion check reads the rows back rather than trusting the deltas
       just written, so a bound that was ALREADY over before this tick is caught
       too. `finishedBound` answers "completed" when nothing is exhausted, which
       is not a stop — so the run continues and no ending is written. */
    const bounds = this.#rows(`SELECT bound, allowed, consumed FROM ai_run_bounds WHERE run = ?`, run);
    const hit = finishedBound(bounds, { expired: false, offered: null });
    const ended = Object.prototype.hasOwnProperty.call(RUN_BOUNDS, hit)
      ? this.#aiRunTerminate({ run, offered: hit,
          condition: hit === "runtime" ? "runtime-ceiling-reached" : null, at: now })
      : null;

    /* R84: a segment that stopped on its own bound with the run not done is to be dispatched again (`tickAndContinue`); one that
       ended in an error is logged with its code and is not (the run then ends on its lease, R83). */
    let next = null;
    if (seg && !ended) {
      const live = this.#one(`SELECT status FROM ai_runs WHERE run = ?`, run);
      next = !live || live.status !== "running" ? "ended" : seg.error ? "error" : seg.done ? "done" : "continue";
    }
    const after = this.#one(`SELECT ticks, status, expires FROM ai_runs WHERE run = ?`, run);
    return { run, found: true, ticked: true, ticks: after.ticks, status: after.status,
             expires: after.expires, appended, refused, ...(calls.length ? { counted: calls.length } : {}),
             ...AiRuns.#aiRunGateStated(gate),
             ...(seg ? { segment_end: { logged: appended > 0, next: next || "ended" } } : {}),
             ...(ended ? { ended } : {}) };
  }

  /** R84's normal form of a tick's `segment_end`: null when none was sent (or it is no object), else `{by, done, refusals,
   *  error}` with each field bounded and of its own type; a stray field is dropped. */
  static #segmentEnd(x) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return null;
    const text = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
    return { by: text(x.by, 80), done: x.done === true,
             refusals: (Array.isArray(x.refusals) ? x.refusals : []).map((c) => text(c, 80)).filter(Boolean).slice(0, 20),
             error: text(x.error, 80) };
  }

  /** R84: the tick of `op=airuntick`, and what follows it. The tick commits first (`tick`); then a segment that stopped on
   *  its own bound with the run not done is dispatched again by the plane, with no member's act, on R18's principal rules:
   *  a member's run on her own sign-in as `dispatchMemberRun` does it (a fresh segment credential), a run of the group's
   *  organisation credential as the wake does it. A continuation that is not dispatched appends one entry saying so, and
   *  the run waits for its principal. */
  async tickAndContinue(args = {}) {
    const out = this.tick(args);
    if (!out || out.ticked !== true || !out.segment_end || out.segment_end.next !== "continue") return out;
    const row = this.#one(`SELECT run, status, mode, context_type, context_id, principal_plane, principal_claude,
                                  principal_claude_ref, step FROM ai_runs WHERE run = ?`, out.run);
    if (!row || row.status !== "running") return out;
    const iso = AiRuns.#aiIso(args.at ? Date.parse(args.at) : Date.now());
    let dispatch;
    try {
      const principal = String(row.principal_plane ?? "");
      if (principal.startsWith("member:")) {
        const r = await this.dispatchMemberRun({ run: row.run, by: principal, at: args.at || null });
        dispatch = { dispatched: r.dispatched === true,
                     ...(r.dispatch ? { state: r.dispatch.state } : { state: "WITHHELD", reason: String(r.withheld || r.code || "NOT_DISPATCHED").slice(0, 80) }) };
      } else {
        const resumer = await this.#aiRunResumer();
        const decision = this.#aiRunResumeDecision(row, resumer);
        if (decision.dispatch) {
          const o = await this.#aiRunDispatch({ run: row.run, context_id: row.context_id, payer: AiRuns.#memberOfRun(row),
            step: row.step || null, project: row.context_type === "project" ? row.context_id : null, owner: row.principal_claude },
            resumer, iso);
          dispatch = { dispatched: o.state === "DISPATCHED" || o.state === "RUNNING", state: o.state };
        } else dispatch = { dispatched: false, state: "WITHHELD", reason: decision.withheld, says: decision.says };
      }
    } catch { dispatch = { dispatched: false, state: "WITHHELD", reason: "DISPATCH_FAILED" }; }
    /* an unaccepted or refused call has its own entry (`#aiRunDispatch`); a withheld one is said here */
    if (dispatch.state === "WITHHELD") {
      this.#transact(() => this.#aiRunAppend(row.run, {
        level: "meaning", subject: "segment -> end", ...this.#aiRunRestatedState(row.run), governed: false,
        detail: localize("ai-runs.index.the_next_segment_was_not", "the next segment was not dispatched ({reason}). The run is still resumable by its own principal; nothing it established is lost", { reason: String(dispatch.reason) }),
      }, iso, 0, row.principal_claude || null, row.step || null));
    }
    return { ...out, segment_end: { ...out.segment_end, dispatch } };
  }

  /** op=airunclose. The ordinary exit — the run is done, or a member stopped
   *  it. It carries no arithmetic and DERIVES NOTHING: it hands what it was told
   *  to the one exit, and a caller who names no bound is refused by C-22.5
   *  rather than having "completed" inferred from its silence. */
  /* REC-207 — ASYNC, and the change is one `await` at the foot. A re-run's own close is where discharge
     (2) is taken (see `#biasDebtDischargeByRerun` for why the close and not the open), and reading what
     lens this run was formed under goes through `#biasForRun`, which is async because `biasManifest` is.
     ADDITIVE ON THE WIRE: the DO's dispatch already `await`s every op, `#aiRunTerminate` is untouched and
     still synchronous, and the REAPER still calls it directly — so a lapsed run is closed by the clock on
     exactly the path it was before, with no member and no discharge. */
  async close({ run, bound = null, condition = null, at = null, actor = null, viewer = null,
               /* REC-152: the caller's PRINCIPAL, stamped server-side — see `aiRunTick`. */
               caller = null } = {}) {
    const now = at ? AiRuns.#aiIso(Date.parse(at)) : AiRuns.#aiIso(Date.now());
    /* PL-18 / DEC-63 — THE GATE, AND IT IS HERE RATHER THAN IN
       `#aiRunTerminate` FOR A REASON WORTH STATING: that function is the ONE
       exit and the REAPER goes through it too. A run killed mid-flight is
       closed by the alarm, where no member is asking and no participation could
       be checked; putting the gate on the shared exit would have made the gate
       a fact about the clock. So the MEMBER'S door is gated and the machine's
       exit is left alone — the two paths still terminate through one function,
       which R14's and R31's tests hold (and R15's, for the reaper's ending).

       An unknown run is left to `#aiRunTerminate`'s own not-found answer, the
       same ordering the tick uses: the gate never tells a caller whether a run
       id exists.

       A RELAY, not a governed site — see the note at `aiRunOpen`'s gate. */
    const row = this.#one(`SELECT context_type, context_id, principal_plane FROM ai_runs WHERE run = ?`, run);
    if (row) {
      /* REC-152 — SIGHT FIRST, THEN POSITION, as at the tick. Unseen answers `#aiRunTerminate`'s own
         not-found, byte for byte; seen-but-not-the-principal is refused in this door's own shape. The
         REAPER does not come through here — it calls `#aiRunTerminate` directly — so a run nobody may
         close by hand still ends on its lease and bounds, and no member is asked. */
      if (!this.#aiRunInSight(run, viewer)) return { run, found: false,
        note: word("ai-runs.note.run_either_existed") };
      const notPrincipal = runPrincipalGate({ caller, principal: row.principal_plane });
      if (notPrincipal)
        return { run, terminated: false, found: true, ok: false,
                 code: notPrincipal.code, check: notPrincipal.check,
                 translation: notPrincipal.translation, detail: notPrincipal.detail,
                 note: word("ai-runs.note.run_ended_principal") };
      const gate = this.#aiRunProjectGate({ actor, contextType: row.context_type, contextId: row.context_id, viewer });
      if (!gate.permitted)
        /* THE SHAPE IS `#aiRunTerminate`'S OWN — `found` / `terminated`, with
           the refusal spread beside them — because this refusal comes out of
           the same door as that function's four and a second vocabulary for one
           op's failures is a second thing every consumer must learn. And
           `terminated: false` leads, ahead of `found: true`, for the reason
           stated on the tick's gate: the guard grades the FIRST boolean-shaped
           property, and a refusal that leads with a literal `true` is a refusal
           the guard reads as a success. */
        return { run, terminated: false, found: true, ok: false,
                 code: gate.code, check: gate.check,
                 translation: gate.translation, detail: gate.detail,
                 note: localize("ai-runs.index.closing_a_run_over", "closing a run over a project is licensed by PARTICIPATION IN THAT PROJECT (DEC-63), and the contribute capability is only the floor beneath that. The run is untouched and is still running") };
    }
    let ended = this.#aiRunTerminate({ run, offered: bound, condition, at: now, derive: false });
    /* R76: at close the run answers its actual cost, to its paying account's owners only */
    if (ended && ended.terminated === true) {
      const held = this.#one(`SELECT run, status FROM ai_runs WHERE run = ?`, run);
      const cost = held ? this.#costFor(held, viewer) : null;
      if (cost) ended = { ...ended, cost };
    }
    /* REC-207 — THE DISCHARGE, AND ONLY OVER A RUN THAT ACTUALLY ENDED HERE. A refused close and a run
       that was already closed both leave `terminated` other than true, and neither is a re-run having
       run. The block is attached only when there was a link to follow, so an ordinary close answers
       byte-for-byte what it answered before this item. */
    if (ended && ended.terminated === true) {
      const discharge = await this.#bias().biasDebtRerun({ kind: "ai-run", key: run, at: now });
      if (discharge) return { ...ended, bias_debt: discharge };
    }
    return ended;
  }

  /* ---- the reaper's three parts, and none of them decides anything ----

     Each is a QUESTION about the clock; the answer to "which bound" comes from
     `finishedBound` inside `#aiRunTerminate`, the same function the ordinary
     close uses. That is the structural half of "the real path and the mutated
     path go through ONE function". */

  reapDue(now) {
    return this.#one(`SELECT count(*) c FROM ai_runs WHERE status = 'running' AND expires < ?`,
      AiRuns.#aiIso(now)).c;
  }

  reapWake(now) {
    const r = this.#one(`SELECT MIN(expires) e FROM ai_runs WHERE status = 'running'`);
    if (!r || !r.e) return null;                       // no run in flight: no alarm at all
    const at = Date.parse(r.e);
    return Number.isFinite(at) ? Math.max(at, now) : null;
  }

  /** THE NEGATIVE CONTROL THE DESIGN NAMES, as a mechanism: a run KILLED
   *  mid-flight never calls anything, so this is what writes its log. It closes
   *  every lapsed run through the one exit; `expired: true` is the only thing it
   *  contributes, and `finishedBound` turns that into `lease` — or into whatever
   *  budget was ALREADY exhausted, because a run that overspent and then died
   *  was stopped by the budget, and reporting the lease there would name the
   *  symptom and hide the cause. */
  reap(now) {
    const iso = AiRuns.#aiIso(now);
    const lapsed = this.#rows(
      `SELECT run FROM ai_runs WHERE status = 'running' AND expires < ? ORDER BY run`, iso);
    const reaped = [];
    for (const r of lapsed) {
      const t = this.#aiRunTerminate({ run: r.run, offered: null, condition: null, at: iso, expired: true });
      reaped.push({ run: r.run, terminated: t.terminated === true, bound: t.bound || null });
    }
    return { at: iso, lapsed: lapsed.length, reaped };
  }

  /* ---- FL-4's three parts, and none of them decides anything either ----

     The reaper's three above answer *is this run over*. These three answer *is
     this run waiting on us, and has the daemon answered* — and they are
     deliberately built in the reaper's shape, next to it, because they are the
     other half of one question about a run that is not heartbeating. A run that
     stopped because it died and a run that stopped because it is waiting on our
     own daemon look identical from outside, and telling them apart is the whole
     of this item: before it, the reaper took both and recorded `lease` over
     both.

     THE WAKE'S LOG ENTRY DERIVES ITS STATE THROUGH `#aiRunSearchState`, the
     SAME reducer the one exit uses. So a resumed run and a reaped one describe
     what the search established through ONE function rather than two that
     agree — the parallel-path failure this repository has measured repeatedly,
     avoided here the way `finishedBound` avoids it one method up. */

  /* THE PRODUCER'S OWN CADENCE, CAPPED BY THE THING THE HOLD PROTECTS.

     Following `#captureRequestTickMs` rather than minting a second constant is
     the point: this consumer exists to notice what THAT one produced, and a
     wake slower than the producer it follows leaves a completed capture sitting
     undelivered for the difference. There is no second number to drift.

     THE CAP IS A CORRECTNESS REQUIREMENT AND NOT TIDINESS. The hold has to
     reach a suspended run BEFORE its lease lapses, so an instance that slows
     the drain past the lease (the env override admits any value) must not slow
     the hold with it — a quarter of the lease leaves three ticks of margin.
     THE FLOOR IS THE OTHER DIRECTION and it is not shared with the drain: the
     drain's queue empties, so a zero cadence there is a burst that ends, while
     a hold persists as long as the daemon owes an answer and a zero wake would
     spin an idle-looking instance for as long as that lasts. */
  #aiRunWakeTickMs() {
    return Math.max(1000, Math.min(this.#captureRequestTickMs(),
                                   Math.floor(this.#leaseMs() / 4)));
  }

  /* HOW MANY RUNS ONE TICK HOLDS OR WAKES, AND THE FIGURE WAS NOT CHOSEN — IT
     WAS FORCED BY AN INSTRUMENT. The first shape of this consumer scanned
     `ai_runs` unbounded and looped over what came back, which is precisely the
     class `derivation-bounds.test.mjs` (deleted in T20) ratcheted (31 methods
     measured 2026-08-08, 11 of them dispatched): a method that AMPLIFIES work
     over an unbounded scan. That suite failed on the new member and named it,
     so the scan was bounded rather than the ceiling moved — a ceiling is not a
     ratchet. The bound is R16's, at most 25 runs per tick, and R16's test holds it.

     SIZED ON THE PRODUCER IT FOLLOWS. The drain lands at most
     `CAPTURE_REQUEST_TICK_BATCH` completions per tick, so a wake batch smaller
     than that would fall permanently behind the thing it exists to notice.
     Larger, because a hold is two integers and an UPDATE while a capture is a
     fetch, and because an instance that was unconfigured for a while can have a
     backlog of runs to hold on its first configured tick.

     A BATCH IS NOT A LOSS. While more remain the pending count stays above zero,
     so the wake re-arms and the next tick takes the next batch — the
     connection-derive sweep's progressive drain, and the reason that consumer
     can be bounded without dropping anything. */
  static AI_RUN_WAKE_TICK_BATCH = 25;

  /** THE SUSPENDED RUNS TO HOLD: still running, and the daemon still owes them
   *  an answer.
   *
   *  GATED ON THE DRAIN BEING CONFIGURED, exactly as `#captureRequestPending`
   *  is and for the same reason one layer up: where nothing drains, no request
   *  will ever complete, so a hold would keep a run alive for something that is
   *  not coming — an instance that has not wired this behaves byte-for-byte as
   *  it did before.
   *
   *  BOUNDED BY THE REQUEST'S OWN EXPIRY. `cr.expires > ?` is what stops this
   *  from being an immortality clause: a request nothing can satisfy stops
   *  holding its run at its own TTL, and the reaper then takes the run with an
   *  honest bound. Removing that predicate is declared control arm (4). */
  #aiRunWakeHolds(iso) {
    /* R16: the wait source answers the running runs with an outstanding, unexpired request, at most a batch. */
    if (!this.#captureRequestConfigured()) return [];
    const held = this.#wait().holds(iso, AiRuns.AI_RUN_WAKE_TICK_BATCH);
    return (Array.isArray(held) ? held : []).slice(0, AiRuns.AI_RUN_WAKE_TICK_BATCH)
      .filter((h) => h && this.#one(`SELECT 1 x FROM ai_runs WHERE run = ? AND status = 'running'`, String(h.run)))
      .map((h) => ({ run: String(h.run), outstanding: Number(h.outstanding) || 0 }));
  }

  /** THE RUNS TO WAKE: a completion the daemon has landed and this run has not
   *  been told about. `captured` and `refused` are BOTH completions — a refusal
   *  is an answer, and a run left waiting on a request that will never be tried
   *  again is a run waiting on nothing. */
  #aiRunWakeRuns() {
    /* D-260: `principal_plane` joins the projection because the resumption's ONE gate compares it — the run's own
       stamp, never a field anybody sent. It is read for that comparison and published nowhere by this path. */
    /* R16, R17: the runs the wait source says have completions not yet woken; none registered, none. */
    const w = this.#wait();
    if (!w) return [];
    const ids = w.woken(AiRuns.AI_RUN_WAKE_TICK_BATCH);
    return (Array.isArray(ids) ? ids : []).slice(0, AiRuns.AI_RUN_WAKE_TICK_BATCH)
      .map((run) => this.#one(`SELECT run, context_type, context_id, principal_plane, principal_claude, principal_claude_ref, step FROM ai_runs
                                WHERE run = ? AND status = 'running'`, String(run)))
      .filter(Boolean);
  }

  wakeDue(now) {
    const iso = AiRuns.#aiIso(now);
    return this.#aiRunWakeHolds(iso).length + this.#aiRunWakeRuns().length;
  }

  wakeWake(now) {
    /* NULL WHEN NOTHING IS SUSPENDED — the self-termination property REC-1
       prized, stated here rather than inherited: an instance with no run
       waiting on the daemon contributes no wake and holds no alarm at all. */
    if (this.wakeDue(now) <= 0) return null;
    return now + this.#aiRunWakeTickMs();
  }

  /** THE TICK. The hold keeps a legitimately-waiting run alive; the wake
   *  delivers the daemon's answer exactly once.
   *
   *  THE HOLD MOVES `expires` AND DELIBERATELY NOT `updated`. `updated` is when
   *  the RUN last acted, and the plane declining to kill a run is not the run
   *  acting — a reader must still be able to see how long it has been silent.
   *  Moving both would have made a held run indistinguishable from a
   *  heartbeating one, which is the fact this consumer exists to preserve.
   *
   *  IT GRANTS THE STANDARD LEASE AND NOT THE RUN'S OWN, stated because it is
   *  visible from outside: `leaseMs` is an argument to `aiRunOpen` and
   *  `aiRunTick`, it is never stored, and the record therefore has no memory of
   *  what a particular caller chose. `AI_RUN_LEASE_MS` is the only figure the
   *  store holds, so a run opened on a shorter lease is held on the standard
   *  one while the daemon owes it an answer. That is a widening and it is
   *  bounded twice over — by the request's own expiry, and by the fact that
   *  nothing renews it once the request is answered. */
  async wake(now) {
    const iso = AiRuns.#aiIso(now);
    const until = AiRuns.#aiIso(now + this.#leaseMs());
    const holds = [], wakes = [], dispatches = [];
    /* D-260: the resumer is resolved ONCE per tick and only when a run is about to be woken, BEFORE the synchronous
       hold-and-wake section below, so that section stays one uninterrupted read-and-write. */
    const resumer = this.#aiRunWakeRuns().length ? await this.#aiRunResumer() : null;
    for (const r of this.#aiRunWakeHolds(iso)) {
      this.#transact(() => { this.sql.exec(`UPDATE ai_runs SET expires = ? WHERE run = ?`, until, r.run); });
      holds.push({ run: r.run, outstanding: r.outstanding, expires: until });
    }

    for (const r of this.#aiRunWakeRuns()) {
      /* BOUNDED TOO, and for the same reason the run scan is: one run may have
         asked for many documents, and a wake that read all of them would put
         the unbounded scan back one level down. Completions past the batch stay
         unstamped, so the run is woken again on the next tick with the rest —
         a completion is DELAYED by a backlog and never dropped by one. */
      const done = (this.#wait().completions(r.run, AiRuns.AI_RUN_WAKE_TICK_BATCH) || []).slice(0, AiRuns.AI_RUN_WAKE_TICK_BATCH);
      if (!done.length) continue;      // the row's own EXISTS already proved otherwise
      /* D-583: `expired` is a completion too (capture-requests R29); each state is counted as itself. */
      const captured = done.filter((q) => q.state === "captured").length;
      const expired = done.filter((q) => q.state === "expired").length;
      const refused = done.length - captured - expired;
      /* D-260 — THE DECISION IS MADE BEFORE THE ENTRY IS WRITTEN, so the entry can say which it was. */
      const decision = this.#aiRunResumeDecision(r, resumer);
      const bad = this.#transact(() => {
        /* THE ENTRY FIRST, then the lease and the stamp — `#aiRunTerminate`'s
           order and its reasoning: if anything could fail it is the append, and
           a run left unwoken with nothing written is retried on the next tick,
           while a run stamped as woken with no entry has lost the record of it.
           THE APPEND CANNOT REFUSE FROM HERE BY CONSTRUCTION — the state comes
           from the reducer, there is no bundle, no condition and `governed` is
           false — so this branch is undrivable today. It is kept, and the
           failure is reported rather than swallowed, because the consequence of
           swallowing it is a wake that silently never happened: the answer
           NAMES it and the row stays unstamped, so a defect here is loud on
           every alarm instead of invisible on all of them. */
        /* NO ACTOR, and the NULL is stated rather than filled. The wake
           is the PLANE noticing a completion, and no principal performed it.
           D-260 widened the wake query to carry the run's `principal_plane`,
           but only so the resumption gate can COMPARE it: stamping it here as
           the actor would say the run's principal wrote an entry it never
           wrote. So the wake entry still says "a machine looked and the record
           cannot say which", which is true, instead of borrowing a name. */
        const refusal = this.#aiRunAppend(r.run, {
          level: "internet",
          subject: r.context_id,
          /* The rollup AND its `observation` referent (REC-100, IC-130): a wake
             entry is a rollup like the terminal one, so it points at the latest
             PRESENT look it restates, computed in the same read. */
          ...this.#aiRunRestatedState(r.run),
          governed: false,
          detail: localize("ai-runs.index.the_daemon_answered_length_capture", "the daemon answered {length} capture request(s) this run was waiting on ({captured} captured, {refused} refused, {expired} expired). The run is resumable: its own log carries what each request established, and §14b.7's resumed run reads it and continues rather than restarting. {says}", { length: String(done.length), captured: String(captured), refused: String(refused), expired: String(expired), says: String(decision.says) }),
        }, iso, 0, null, r.step || null);
        if (refusal) return refusal;
        this.sql.exec(`UPDATE ai_runs SET expires = ? WHERE run = ?`, until, r.run);
        this.#wait().markWoken(done.map((q) => q.request), iso);
        return null;
      });
      wakes.push({ run: r.run, completions: done.length, captured, refused, expired,
                   woken: !bad, ...(bad ? { unwritable: bad } : { expires: until }),
                   resume: decision.dispatch ? "DISPATCH" : decision.withheld });
      if (!bad && decision.dispatch) dispatches.push({ run: r.run, context_id: r.context_id, payer: AiRuns.#memberOfRun(r), step: r.step || null, project: r.context_type === "project" ? r.context_id : null,
                                       owner: r.principal_claude });
    }

    /* D-260 — THE DISPATCH, AFTER EVERY WAKE IS WRITTEN AND OUTSIDE ANY TRANSACTION: a network call inside
       a transaction is impossible, and a wake whose entry and stamp waited on another Worker would put the
       delivery-exactly-once property at the mercy of that Worker's latency. */
    for (const d of dispatches) {
      const outcome = await this.#aiRunDispatch(d, resumer, iso);
      const w = wakes.find((x) => x.run === d.run);
      if (w) w.dispatch = outcome;
    }
    return { at: iso, held: holds.length, holds, woken: wakes.length, wakes,
             dispatched: wakes.filter((w) => w.dispatch && (w.dispatch.state === "DISPATCHED" || w.dispatch.state === "RUNNING")).length };
  }

  /* =====================================================================
   * D-260 — THE WOKEN RUN'S CALLER (BOB #22, 2026-09-21; `BIO_Assistant_and_AI_Roles_v0_1.md` §6).
   *
   * FL-4 made a woken run a fact in the record and nothing re-entered it. This is the caller: the wake hands a
   * woken run to `agent-worker` (I8), under the instance's ONE organisation-principal `ai` credential, and ONLY
   * when that credential is the run's own principal. The ruling's reason is DEC-55 (4): the two principals carry
   * different accountability, so continuing a member's attributable run under the group's key would re-attribute
   * its later acts. A member's run therefore keeps FL-4's behaviour — woken, told, waiting for its own principal —
   * and the wake entry SAYS it was not dispatched and why. That is a stated LIMITATION, never a silent skip.
   *
   * THE GATE IS ONE COMPARISON, of two stamps the PLANE made: the run's `principal_plane` (stamped at open, D-199
   * (4), `<principal>/<tokenId>`) against the same composite built from the instance credential's own RECORD row.
   * Nothing a caller sent is compared. REC-152 (C-22.12) would ALSO refuse the resumed run's first tick under a
   * key that is not its principal — and that is exactly why it is not relied on here: a dispatch that leans on
   * the refusal downstream has already handed a member's run to the group's key, and the refusal proves only
   * that the tick failed. R18's test counts calls AT THE BINDING for that reason: no withheld run reaches it.
   *
   * THE SECRET NEVER REACHES THE RECORD. The token is read from the Worker secret, used as the dispatch body's
   * `credential`, and dropped; what the tick answers, and what the wake entry says, name the credential by its
   * record identity (`tokenId`) and never by value. `agent-worker` retains nothing (fleet law, I8).
   * ================================================================== */

  /** The namespace this Durable Object IS, asked of the runtime rather than remembered: `admission`'s
   *  `scopeFor` routes every call to `idFromName("bio")` or `idFromName("scratch")`, and a DO's id equals the one
   *  it was named by. Null for any other object (a suite's private instance) — the dispatch then says it could
   *  not name the namespace, rather than guessing one: a default here would let a resumed run touch the real
   *  record while the run lived in scratch. */
  #ownNamespace() {
    const ns = this.env && this.env.STORE;
    if (!ns || typeof ns.idFromName !== "function" || !this.ctx.id || typeof this.ctx.id.equals !== "function")
      return null;
    for (const name of ["bio", "scratch"]) if (this.ctx.id.equals(storeId(this.env, name))) return name;
    return null;
  }

  /* R82 (R085-7; WALK-085 F2): the dispatch waits only for `agent-worker` to ACCEPT the segment (its R91 answers 202 at
     once), so ten seconds; the segment then runs on whether or not this call is still connected. */
  static AI_RUN_DISPATCH_WAIT_MS = 10_000;
  #aiRunDispatchWaitMs() {
    const v = Number(this.env && this.env.AI_RUN_DISPATCH_WAIT_MS);
    return Number.isFinite(v) && v > 0 ? v : AiRuns.AI_RUN_DISPATCH_WAIT_MS;
  }

  /** WHO MAY RESUME, resolved once per tick: `{ ready: true, stamp, tokenId, token, store }` or
   *  `{ ready: false, withheld }`. `withheld` is a stated reason, never a secret. The credential is resolved the
   *  way the control plane resolves one (`admission`'s `aiCredentialPresented`: `aicredentiallook` against the
   *  `bio` object, which alone holds `ai_credentials`), so a key revoked by a member stops resuming anything the moment the row says so. */
  async #aiRunResumer() {
    const env = this.env || {};
    if (!env.AGENT_WORKER || typeof env.AGENT_WORKER.fetch !== "function")
      return { ready: false, withheld: "AGENT_WORKER_UNBOUND" };
    const cred = await instanceAiCredential(env);
    if (!cred.token) return { ready: false, withheld: cred.reason };
    const store = this.#ownNamespace();
    if (!store) return { ready: false, withheld: "NAMESPACE_UNDETERMINED" };
    const look = await this.#credentialLook(cred.token, store);
    if (!look) return { ready: false, withheld: "CREDENTIAL_RECORD_SILENT" };
    const c = look && look.found ? look.credential : null;
    if (!c) return { ready: false, withheld: "INSTANCE_AI_CREDENTIAL_NOT_ON_RECORD" };
    if (c.revoked) return { ready: false, withheld: "INSTANCE_AI_CREDENTIAL_REVOKED", tokenId: c.tokenId };
    /* ONE ORGANISATION-PRINCIPAL credential is what the ruling permits. A member-kind key configured here would
       make every run THAT MEMBER's key opened resumable by the instance, which is the re-attribution the ruling
       exists to prevent — so it resumes nothing, and says so. */
    if (c.principalKind !== "organisation")
      return { ready: false, withheld: "INSTANCE_AI_CREDENTIAL_NOT_ORGANISATION", tokenId: c.tokenId };
    /* K1502, K1514, K1755: the copy binds no Claude credential; the account a resumed run is carried by is the one that
       serves its member's act (R52: their own, or the group's API key), read per run at the dispatch. */
    return { ready: true, stamp: `${c.principal}/${c.tokenId}`, tokenId: c.tokenId, token: cred.token, store };
  }

  /** An `ai` credential's record row, looked up by its hash (credentials R15) where `ai_credentials` lives: this object
   *  when it is `bio`, else the `bio` object (`aicredentiallook`). `{found, credential}`, or null when the record did not
   *  answer. The value is hashed here and kept nowhere. */
  async #credentialLook(token, store) {
    const sha = await sha256hex(token);
    if (store === "bio") {
      try { return credentialsOf(this.ctx).aiCredentialLook({ secretSha: sha }); } catch { return null; }
    }
    try {
      const res = await storeStub(this.env || {}, "bio").fetch(`http://do/aicredentiallook?sha=${sha}`);
      const out = await res.json().catch(() => null);
      return out && out.ok === true ? out.result : null;
    } catch { return null; }
  }

  /** THE GATE, and the sentence the wake entry carries. `dispatch` is true ONLY on equality of the two stamps. The
   *  sentence (`says`) is served to a member in the run's log (R24), so it calls the group's own Civicsmith "your group's
   *  Civicsmith" (R54, DEC-149); `withheld`'s values are codes and stay. */
  #aiRunResumeDecision(run, resumer) {
    const principal = String((run && run.principal_plane) || "");
    /* R52 (K1503, K1755): the run continues only on the account that serves the act of the member who started it (their
       own, their own sign-in (T38; K2299), or the group's key); with none, it is withheld by name and waits, and the binding is not called. */
    const payer = AiRuns.#memberOfRun(run);
    /* (T41) a run a project's account pays for is judged by that account at the dispatch itself (ai-accounts R11) */
    const projectPaid = typeof (run && run.principal_claude) === "string" && run.principal_claude.startsWith("project:");
    if (resumer && resumer.ready && principal === resumer.stamp && !(payer && (projectPaid || this.#accountServing(payer))))
      return { dispatch: false, withheld: "NO_ACCOUNT",
               says: localize("ai-runs.index.resumption_not_dispatched_no_claude", "Resumption: NOT dispatched — no Claude account serves the member whose act started this run (none of their own is connected, and the team's key is not set or not on), and a run continues only on the account that serves that member's act (K1503, K1755). It waits.") };
    if (resumer && resumer.ready && principal === resumer.stamp)
      return { dispatch: true, withheld: null,
               says: word("ai-runs.says.resumption_handed_agent", { token_id: resumer.tokenId }) };
    const member = principal.startsWith("member:");
    const withheld = member ? "MEMBER_PRINCIPAL_RUN"
      : (resumer && !resumer.ready) ? resumer.withheld : "NOT_THE_INSTANCE_CREDENTIALS_RUN";
    const why = member
      ? localize("ai-runs.index.a_members_credential_opened_it", "a member's credential opened it, and your team's Civicsmith resumes only runs its own organisation credential opened (D-260, DEC-55 (4): continuing a member's run under the team's key would re-attribute its acts). It waits for its own principal")
      : withheld === "NOT_THE_INSTANCE_CREDENTIALS_RUN"
        ? word("ai-runs.text.principal_opened_organization")
        : word("ai-runs.text.group_civicsmith_resume", { withheld });
    return { dispatch: false, withheld, says: word("ai-runs.says.resumption_dispatched", { why }) };
  }

  /** THE CALL. Bounded, and every way it can fail is a stated outcome carrying no secret. A dispatch that did not
   *  complete appends ONE entry saying so, because the wake entry above it said the run was handed over. */
  async #aiRunDispatch(d, resumer, iso) {
    /* R52, K1514, K1601, K1755 (agent-worker R6, R10): the body carries `account`, the account `ai-accounts.accountFor`
       answers for the act of the run's member (its R7, R11), `{kind, level, secret, member, suggestions}`: `level` `member`
       for their own reference or (T38; K2299) their own sign-in, `signin`, never re-labeled an API key (K1553), `group`
       for the group's API key, whose use is still that member's act; `secret` is its R7's `key`, named as agent-worker R6
       reads it: (R79; T47, K3060 D10, K3068; ai-accounts R19) a held sign-in's token carried as an API key's, never logged, stored or
       answered (the T38 "no secret" sentence retired);
       `member` is the run's account member, `member:<id>`, so agent-worker can check it against the run (its R10). Used
       for this one call and kept nowhere here. The instance Claude account it carried before is retired (K1502). */
    let outcome, timer;
    /* the account, unless the caller resolved it already (R18's member dispatch judges it before minting) */
    let ref = d.ref !== undefined ? d.ref : await this.#dispatchAccount(d);
    if (!ref || ref.refusal)
      outcome = { state: "REFUSED", status: null,
                  reason: String((ref && ref.refusal && (ref.refusal.code || ref.refusal.reason)) || "NO_ACCOUNT").slice(0, 80) };
    /* K1615 (agent-worker R56): and the switch that governs the serving account. */
    /* (T41; ai-accounts R14, R9) every account now holds its `suggestions` switch, set by `accountUsesSet`: a member's
       reference or sign-in (whichever serves, read through `accountUses` as that member, its R15), and the group key
       (`groupKeySwitches()`, an in-plane read, its R9). Anything but an explicit on is off. */
    let suggestions = false;
    if (!outcome) {
      try {
        const c = this.#aiAccounts();
        if (ref.level === "group") suggestions = c.groupKeySwitches().suggestions === true;
        else if (ref.level === "member") {
          const u = c.accountUses({ owner: `member:${d.payer}`, viewer: `member:${d.payer}` });
          const acct = u && u.ok === true && u.accounts ? (ref.kind === "signin" ? u.accounts.signin : u.accounts.reference) : null;
          suggestions = !!(acct && acct.uses && acct.uses.suggestions === true);
        }
      } catch { suggestions = false; }
    }
    const body = outcome ? null : { run_id: d.run, store: resumer.store, credential: resumer.token,
                                    account: { kind: ref.kind, level: ref.level,
                                               /* R79: a sign-in's held token rides as an API key's does */
                                               ...(typeof ref.key === "string" ? { secret: ref.key } : {}),
                                               member: `member:${d.payer}`, suggestions } };
    ref = null; d.ref = null;
    if (body) try {
      const res = await Promise.race([
        this.env.AGENT_WORKER.fetch("https://agent-worker/run", {
          method: "POST", headers: { "content-type": "application/json", ...(d.headers || {}) }, body: JSON.stringify(body) }),
        new Promise((_, no) => { timer = setTimeout(() => no(new Error("dispatch-wait-elapsed")), this.#aiRunDispatchWaitMs()); }),
      ]);
      const out = await res.json().catch(() => null);
      const said = String((out && (out.reason || out.code || out.type)) || `http ${res.status}`);
      /* R82: `agent-worker` R91's acceptance (`202 {accepted: true}`) is RUNNING, the segment under way; an older `200 {ok: true}`
         answer (a segment that ended inside the wait) is DISPATCHED. */
      outcome = (res.ok && out && out.accepted === true)
        ? { state: "RUNNING", status: res.status }
        : (res.ok && out && out.ok === true)
        ? { state: "DISPATCHED", status: res.status }
        /* R50: the member's own provider limit is answered in plain words, as the ceiling is, never as an error. */
        : PROVIDER_LIMIT.test(said) ? { state: "LIMIT", status: res.status, ...this.#providerLimit() }
        : { state: "REFUSED", status: res.status, reason: said.slice(0, 80) };
    } catch (e) {
      /* D-205's rule: the plane's own words, never the exception's — a thrown error can carry a request, and this
         request carries a credential. */
      /* The sentinel is lowercase and compared on its own line: this outcome is a dispatch STATE, not a refusal
         code, and a code-shaped literal inside a `reason:` expression is read into DEC-49's census as one. */
      const elapsed = String(e && e.message) === "dispatch-wait-elapsed";
      /* R82: a worker that has not accepted within the bound is a call that did not complete (B6's "still running" reading
         is retired: the worker now answers at once, so no answer means no acceptance), and it is logged as such below. */
      outcome = { state: "SILENT", status: null,
                  reason: elapsed ? localize("ai-runs.index.no_acceptance_within_the_bound", "no acceptance within the bound") : word("ai-runs.reason.call_did_complete") };
    } finally { clearTimeout(timer); }
    if (outcome.state === "DISPATCHED" || outcome.state === "RUNNING") {
      /* R83: an accepted dispatch is a heartbeat, the lease counted from it */
      try { this.#transact(() => { this.sql.exec(`UPDATE ai_runs SET expires = ? WHERE run = ? AND status = 'running'`,
        AiRuns.#aiIso(Date.parse(iso) + this.#leaseMs()), d.run); }); } catch { /* the lease stands as it was */ }
    } else {
      const refusal = this.#transact(() => this.#aiRunAppend(d.run, {
        level: "internet", subject: d.context_id, ...this.#aiRunRestatedState(d.run), governed: false,
        detail: outcome.state === "LIMIT"
          ? localize("ai-runs.index.resumption_not_continued_now_detail", "Resumption: not continued now — {detail} The run was woken and is still resumable by its own principal; nothing it established is lost", { detail: String(outcome.detail) })
          : localize("ai-runs.index.resumption_the_dispatch_to_agent", "Resumption: the dispatch to agent-worker did not complete ({state}: {reason}). The run was woken and is still resumable by its own principal; nothing it established is lost", { state: String(outcome.state), reason: String(outcome.reason) }),
      }, iso, 0, null, d.step || null));
      if (refusal) outcome.unwritable = refusal;
    }
    return outcome;
  }

  /** R87: the headers a member's dispatch adds, `trace` and `memberRef` each only when a non-empty printable string of at
   *  most 200 characters; none handed (or one of another shape) adds none. */
  static #doorHeaders(trace, memberRef) {
    const h = {};
    if (typeof trace === "string" && HEADER_VALUE.test(trace)) h[TRACE_HEADER] = trace;
    if (typeof memberRef === "string" && HEADER_VALUE.test(memberRef)) h[MEMBER_REF_HEADER] = memberRef;
    return h;
  }

  /** R52 (T41): the account that serves the run's member now, `ai-accounts.accountFor`'s answer as `#accountFor` reads
   *  it; it must be the one the run recorded as paying (a run never moves to another), else `NO_ACCOUNT`. */
  async #dispatchAccount(d) {
    const ref = d.payer ? await this.#accountFor(d.payer, "run", d.project) : null;
    return ref && !ref.refusal && d.owner && ref.owner !== d.owner ? { refusal: { code: "NO_ACCOUNT", reason: "NO_ACCOUNT" } } : ref;
  }

  /** R18 (T46; N919; Bob's, K2892: a member's own sign-in runs check and plan for that member only): A MEMBER'S OWN RUN,
   *  DISPATCHED AT HER OWN ACT. The wake never dispatches a member's run (`MEMBER_PRINCIPAL_RUN`, above); this is the one
   *  door that does, called by `control-plane`'s door (op `airundispatch`, T46-59). `by` is the door's stamp of who acts,
   *  `viewer` its sight (`by` when not given). (T47; N955; K2976, K2999, K3027, K3030; credentials R63) The segment acts
   *  under a credential minted HERE for that segment only, never one a page holds: no credential is taken from the
   *  request (one given is never read), so a reloaded dock continues the run by the same act.
   *
   *  In order, nothing sent on any: absent or invisible, `{found: false}`; `by` not the member the run's principal names
   *  (`member:<id>`, opened by her session, or `member:<id>/<tokenId>`, on a credential of hers before T47),
   *  `AI_RUN_NOT_PRINCIPAL` (run-rules R5, relayed); not running, `{dispatched: false, status}`; a mode other than
   *  `check` or `plan`, `MEMBER_RUN_MODE_NOT_ADMITTED`; withheld by name as the wake's dispatch is
   *  (`AGENT_WORKER_UNBOUND`, `NAMESPACE_UNDETERMINED`); an account other than her own sign-in, `MEMBER_PRINCIPAL_RUN`.
   *  Then `credentials.aiRunCredentialMint({member, run, writes})` with the mode's own writes (`AI_RUN_MODE_WRITES`): a
   *  refusal answered unchanged with `dispatched: false`, a mint that throws or answers nothing withheld
   *  `CREDENTIAL_RECORD_SILENT`. Then the wake's call (`#aiRunDispatch`) carrying the minted token: the 10 s wait for
   *  acceptance (R82: accepted is `RUNNING`), and one log entry for a refused or unaccepted call. The token is used for that one call and is
   *  never answered, logged or written; a later mint for the run revokes it, and the run's end (R14) ends them all.
   *  (T50; R87, R89) `trace` and `memberRef`, the door's strings, ride the call as `x-civicsmith-trace` and
   *  `x-civicsmith-member-ref` and nowhere else; the mint carries the run's `project` when it has one. */
  async dispatchMemberRun({ run = null, by = null, viewer = null, at = null, trace = null, memberRef = null } = {}) {
    const iso = AiRuns.#aiIso(at ? Date.parse(at) : Date.now());
    const id = run == null ? "" : String(run).trim();
    const sight = viewer == null || viewer === "" ? by : viewer;
    const row = id ? this.#one(`SELECT run, status, mode, context_type, context_id, principal_plane, principal_claude,
                                       principal_claude_ref, step, project FROM ai_runs WHERE run = ?`, id) : null;
    if (!row || !this.#aiRunInSight(id, sight))
      return { run: run || null, found: false, note: word("ai-runs.note.run_either_existed") };
    /* run-rules R5's comparison, relayed: `by` must be the member the run's principal names. A run whose principal is no
       member (the organisation credential's, which the wake resumes) is no member's to continue, so it is refused as R5
       refuses a caller it does not recognise (asked with no caller). */
    const owner = String(row.principal_plane ?? "");
    const member = memberIdOf(by);
    const act = word("ai-runs.act.continuing_run");
    const notPrincipal = owner.startsWith("member:") && member
      ? runPrincipalGate({ caller: `member:${member}`, principal: owner, act })
      : runPrincipalGate({ caller: "", principal: owner, act });
    if (notPrincipal)
      return { run, dispatched: false, found: true, status: row.status, code: notPrincipal.code, check: notPrincipal.check,
               translation: notPrincipal.translation, detail: notPrincipal.detail,
               note: word("ai-runs.note.run_continued_principal") };
    if (row.status !== "running")
      return { run, found: true, dispatched: false, status: row.status,
               note: word("ai-runs.note.run_ended_later") };
    /* DEC-49 REGION is-airun-member-dispatch */
    if (row.mode !== "check" && row.mode !== "plan")
      return { run, found: true, dispatched: false, status: row.status,
               ...AiRuns.#shed(this.#refuse("MEMBER_RUN_MODE_NOT_ADMITTED", localize("ai-runs.index.on_a_members_own_sign", "on a member's own sign-in the assistant runs checks and plans for that member only; this run is in mode '{String}'. Nothing was sent.", { String: String(String(row.mode).slice(0, 40)) }))),
               mode: row.mode };
    /* END DEC-49 REGION is-airun-member-dispatch */
    const withheld = (w, extra = {}) => ({ run, found: true, dispatched: false, status: row.status, withheld: w, ...extra,
                                          note: word("ai-runs.note.sent") });
    const env = this.env || {};
    if (!env.AGENT_WORKER || typeof env.AGENT_WORKER.fetch !== "function") return withheld("AGENT_WORKER_UNBOUND");
    const store = this.#ownNamespace();
    if (!store) return withheld("NAMESPACE_UNDETERMINED");
    const d = { run: row.run, context_id: row.context_id, payer: AiRuns.#memberOfRun(row), step: row.step || null,
                project: row.context_type === "project" ? row.context_id : null, owner: row.principal_claude,
                /* R87: the door's trace and member ref, for the one call's headers; kept nowhere (no row, log or answer) */
                headers: AiRuns.#doorHeaders(trace, memberRef) };
    /* (T46; Bob's, K2892) on her own sign-in alone: any other account that would serve her (her API-key reference, the
       group's key, a project's account) is withheld, nothing sent, nothing written. */
    d.ref = await this.#dispatchAccount(d);
    /* the group's keep-away (ai-accounts R7, R20) answers no account at all: relayed unchanged, as the mint would
       refuse it (credentials R63), rather than read as another account */
    if (d.ref && d.ref.refusal && d.ref.refusal.code === "AI_KEPT_AWAY") {
      const { ok: _ok, ...kept } = d.ref.refusal;
      d.ref = null;
      return { run, found: true, dispatched: false, status: row.status, ...kept, note: word("ai-runs.note.sent") };
    }
    if (!(d.ref && !d.ref.refusal && d.ref.kind === "signin" && d.ref.level === "member")) {
      d.ref = null;
      return withheld("MEMBER_PRINCIPAL_RUN");
    }
    /* (T47; credentials R63) the segment's own credential, minted in the plane for this run and the mode's writes */
    let minted = null;
    try {
      /* R89 (credentials R79): the project the run was opened in, so everything the segment reads is within it; a run with
         none passes none and reads as before */
      minted = credentialsOf(this.ctx).aiRunCredentialMint({ member: `member:${member}`, run: row.run,
                                                             writes: [...AI_RUN_MODE_WRITES[row.mode]],
                                                             ...(row.project ? { project: row.project } : {}) });
    } catch { minted = null; }
    if (!minted || typeof minted !== "object") { d.ref = null; return withheld("CREDENTIAL_RECORD_SILENT"); }
    if (minted.ok !== true || typeof minted.token !== "string") {
      d.ref = null;
      if (typeof minted.code !== "string") return withheld("CREDENTIAL_RECORD_SILENT");
      const { ok: _ok, token: _t, ...refusal } = minted;
      return { run, found: true, dispatched: false, status: row.status, ...refusal, note: word("ai-runs.note.sent") };
    }
    const outcome = await this.#aiRunDispatch(d, { store, token: minted.token, tokenId: minted.tokenId }, iso);
    minted = null;
    return { run, found: true, dispatched: outcome.state === "DISPATCHED" || outcome.state === "RUNNING", status: row.status,
             dispatch: outcome };
  }

  /** op=airun — THE RUNNING-SESSION SURFACE'S READ (UI-38's rider).
   *
   *  The shape is chosen to be what UI-38's renderers already walk, because
   *  they are FIELD-NAME-BLIND: they print published name/value pairs verbatim
   *  in publication order and know no field names, so they cannot invent one
   *  and cannot go stale. `budget` is an ARRAY of scalar rows, `principal` and
   *  `condition` are flat objects, and nothing here is derived — `allowed` and
   *  `consumed` travel separately because a percentage computed anywhere fails
   *  that surface's own pin.
   *
   *  WHERE NO RUN EXISTS THIS ANSWERS `session: null`, which is a supported
   *  state and not a gap: §14a's surface shows NO INDICATOR rather than an
   *  invented "nothing is running".
   *
   *  NO TRANSCRIPT IS PUBLISHED HERE OR ANYWHERE (DEC-61). The plane holds
   *  none; the surface reads the device's own.
   *
   *  GATED. The run names an inquiry or a project bundle, and a run over a
   *  project the viewer may not see would disclose that the project exists —
   *  REC-25/REC-30's leak exactly. The gate is `#bundleGate` on `context_id`,
   *  through membership's `viewerPredicate`, the one compilation point (D-15). */
  /*  PL-12 / D-84 — AND THIS IS WHERE THE RUN STOPS CARRYING AN ABSENCE.
   *
   *  §3, RULED: *"the run carries the bias manifest in force when it ran … an
   *  assistant-surfaced focus must carry the bias manifest in force when it was
   *  surfaced… unlike a member it will not remember. Without the manifest… bias
   *  debt cannot be computed against it."* §3 also recorded the reason it could
   *  not be done: *"UNBUILDABLE TODAY: object_type: bias is absent from the
   *  check catalogue (D-84) … until D-84 lands, the manifest-carrying obligation
   *  is dischargeable only as 'no manifest was in force,' stated."*
   *
   *  MEASURED BEFORE THIS CHANGE, AND IT WAS WORSE THAN THE DESIGN SAID: this
   *  method published NO bias field of any kind. `ai_runs.bias_manifest` was
   *  written by `aiRunOpen` and read by nothing, so the honest absence §3
   *  settled for was not stated ANYWHERE a reader could see it — the run held a
   *  column and the answer was silent. An unstated limit reads as completeness,
   *  which is DEC-56/57/58's ruling exactly.
   *
   *  WHAT "IN FORCE" MEANS HERE, AND WHY IT IS NOT AN ECHO. The recorded
   *  manifest is what the run was FORMED under and is never recomputed —
   *  `aiRunOpen` stores it verbatim and derives nothing, deliberately. This read
   *  puts the record's CURRENT effective set beside it and says whether the lens
   *  has MOVED since. That comparison is the whole payoff: it is what makes bias
   *  debt computable against a run's output, which is the sentence §3 quotes
   *  from `Content_Framework` and the reason the obligation exists at all.
   *  Three distinguishable answers, never two:
   *    - `in_force: false` with `stated` — no manifest was in force. Honest
   *      absence, still supported, still the answer for a run opened without one.
   *    - `in_force: true, moved: false` — the lens the run carried is the lens
   *      the record holds now.
   *    - `in_force: true, moved: true` — the lens has changed since; the run's
   *      output owes a re-run under the current set. Ordinary BIAS DEBT, which
   *      is DISCLOSED and travels and blocks NOTHING (DEC-20, D-188) — it is
   *      HUNCH debt that disqualifies, and no hunch is named here.
   *
   *  ASYNC now, because the effective set is HASHED and `crypto.subtle` is. The
   *  dispatch already awaits every handler. */
  async read({ run, viewer = null } = {}) {
    const seen = this.#bundleGate("r.context_id", viewer);
    let cost = null;
    const row = this.#one(
      `SELECT r.* FROM ai_runs r WHERE r.run = ? AND ${seen.sql}`, run, ...seen.args);
    if (!row) return { run: run || null, found: false, session: null };
    const bounds = this.#rows(
      `SELECT bound, allowed, consumed, unit FROM ai_run_bounds WHERE run = ? ORDER BY bound`, run);
    /* R19: the stopping bound's or ending's sentence, whether or not a queue condition was named beside it (a close
       names none, and its ending's sentence is still what a reader is owed). */
    const cond = row.stopped_bound
      ? { kind: row.stopped_condition || "",
          detail: `${row.stopped_bound}: ${RUN_BOUNDS[row.stopped_bound] || RUN_ENDINGS[row.stopped_bound]
                                           || "a bound or ending this vocabulary no longer holds"}`,
          bound: row.stopped_bound, at: row.stopped_at }
      : null;

    /* PL-12: THE MANIFEST BLOCK. Read the header on `aiRunRead` for what the
       three answers mean and why the comparison rather than the echo is the
       point. Computed in ONE function because `aiRunSpawnPayload`'s COMPOSING
       half publishes the same block, and two computations of "what lens was
       this run formed under" would be two answers to a question that has one. */
    const bias = await this.#biasForRun(row, viewer);

    return { run, found: true, session: {
      id: row.run,
      label: row.label,
      mode: row.mode,
      status: row.status,
      ticks: row.ticks,
      created: row.created,
      updated: row.updated,
      expires: row.expires,
      /* D-451: a run over a PROJECT also publishes `questions` — the questions it confirmed-cites that this
         viewer can see (`#runContextQuestions`), the set `op=suggest` admits as its target. A run over a
         question publishes none: its context id IS its one question. */
      context: row.context_type === "project"
        ? { type: row.context_type, id: row.context_id,
            questions: this.#runContextQuestions(row.context_id, viewer) }
        : { type: row.context_type, id: row.context_id },
      /* §14a: the record names WHOSE Claude account carried the run (`member:<id>`, R52), BESIDE the
         plane-credential principal — two principals, never one, and never a
         token value. `ref` is the opener's own label for the account. */
      principal: { plane: row.principal_plane, claude: row.principal_claude,
                   ref: row.principal_claude_ref, skill: row.skill_version },
      budget: bounds.map((b) => ({ bound: b.bound, allowed: b.allowed,
                                   consumed: b.consumed, unit: b.unit })),
      condition: cond,
      /* PL-12 / D-84: the conditions the run was formed under gain their third
         member. It sits BESIDE `principal` and `budget` rather than inside
         them, because it is neither an identity nor an allowance — it is the
         LENS, and §11's whole reason for recording the conditions is that a
         version is only interpretable against them. */
      bias,
      /* REC-74: AND THE THIRD CONDITION, WHICH WAS SILENT HERE UNTIL NOW.
         §11's three are the manifest, the SKILL VERSION and the launching
         project's declared STANDARD PAIR. Two of them were published — the
         skill inside `principal`, the manifest as `bias` — and this one was
         written by `aiRunOpen`, published by `aiRunSpawnPayload`, and read by
         nobody here, so a member reading the run object could not see the bar
         the run was working to. It sits beside `bias` for the same reason
         `bias` sits beside `principal`: a bar is not an identity and not an
         allowance, it is the standard the work was held to.

         THE KEY IS ALWAYS PRESENT ON A FOUND RUN, and that is the whole
         design. An absent key means the READER does not publish this fact;
         `standard.in_force: false` with its `basis` and its `stated` sentence
         means we looked and there was no bar. A consumer can tell those apart;
         a null could not, which is why no null is published here. */
      standard: this.#standardForRun(row, viewer),
      /* B6 (AGENT-WORKER #1 REPORT 3): the run's resumable scratch as its last tick wrote it (R12), so a resumed
         segment continues its work list rather than restarting it; null when it cannot be read back. Never a
         transcript (DEC-61): it is the work list the run itself sent. */
      state: safeJson(row.state),
      /* R19 (N190): the run this run re-runs (REC-207's `rerun_of`, judged at the open), published only when this
         viewer can see that run too, through the same sight; else null — a run that re-runs nothing and one whose
         earlier run is out of view answer alike, so the field never says a hidden run exists. */
      rerun_of: row.rerun_of != null && String(row.rerun_of).trim() !== "" && this.#aiRunInSight(String(row.rerun_of), viewer)
        ? String(row.rerun_of) : null,
      /* R78: the label recorded at the open (null for a run the bar admitted, and for one opened before T46) */
      untested: AiRuns.#untestedOf(row),
      /* R89: the project the run was opened in, as recorded at the open; null for a run opened in none */
      project: row.project ?? null,
      /* R73: the step a step-run works on, and its origin; the keys exist only on a run that names a step or explores. */
      ...(row.step ? { step: row.step } : {}),
      ...(row.origin && row.origin !== "member" ? { origin: row.origin } : {}),
      /* R76 (D12): the run's cost, only to its paying account's owners; no key at all for anyone else */
      ...((cost = this.#costFor(row, viewer)) ? { cost } : {}),
      /* R46: the plan a planning run works on; the key exists only on a run in mode `plan`. */
      ...(row.mode === "plan" ? { plan: row.plan ?? null } : {}),
      /* R77: the response a re-examination run re-examines its plan after; the key exists only on such a run. */
      ...(row.origin === "reexamination" ? { response: row.response ?? null } : {}),
    } };
  }

  /** REC-74: the run's BAR, computed ONCE, for the same reason `#biasForRun`
   *  is — `aiRunSpawnPayload` publishes the same block, and "what bar was this
   *  run formed under" is a question with one answer.
   *
   *  NEVER RECOMPUTED AND NEVER LOOKED UP. `aiRunOpen` stores what the launch
   *  handed it and derives nothing; this reads that back and JUDGES it, which
   *  is a different act from deriving one. In particular it does NOT go and ask
   *  the project what its declared strength is today: DEC-17 puts the bar on
   *  the project axis, and a read that substituted the project's CURRENT
   *  declaration for the one the run was formed under would answer a different
   *  question and look identical. (`bias` publishes both sides precisely
   *  because it can COMPARE them; there is no comparison to make here until an
   *  op publishes a project's declared pair, which none does today — stated as
   *  a limit rather than papered over, and delegated.)
   *
   *  THE PAIR IS NEVER COMPOSED. DEC-21/DEC-44 refuse the composition four
   *  ways: capture and connection range over two different populations and
   *  nothing here averages, mixes or reduces them to one value. An axis the
   *  recorded bar does not name is published as `null` BESIDE the one it does,
   *  never filled in from its sibling.
   *
   *  Synchronous, deliberately: unlike the manifest there is no hash and no
   *  second read, so making this async would buy a promise nobody awaits for. */
  #standardForRun(row, viewer = null) {
    const raw = row.standard_pair;
    let parsed = null, unreadable = false;
    if (raw != null && String(raw).trim() !== "") {
      try { parsed = JSON.parse(String(raw)); }
      catch { unreadable = true; }
      /* An array or a scalar is not a pair. Judged rather than spread: a
         `JSON.parse("7")` that reached the return would publish `pair: {}` and
         read as a declared bar naming no axes, which is the shape below that
         this branch exists to keep out of `recorded`. */
      if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
        parsed = null; unreadable = true;
      }
    }
    /* PL-4's measurement, applied here: a value that survives a falsiness guard
       while naming nothing reads as PRESENT and travels. A recorded object that
       names neither axis is not a bar, and saying so is not strictness — it is
       the difference between "the group set a standard" and "a field was
       filled in". */
    const axis = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
    const capture = parsed ? axis(parsed.capture) : null;
    const connection = parsed ? axis(parsed.connection) : null;
    const basis = unreadable ? "unreadable"
      : parsed !== null ? (capture === null && connection === null ? "names-no-axis" : "recorded")
      /* DEC-17, verbatim: *"An inquiry outside any project has no bar. The
         declaration is a property of a project… and inheriting a bar from
         somewhere else would invent one."* So the projectless run's absence is
         STRUCTURAL and the projected run's is a fact about its formation, and
         the two are different answers rather than one null. */
      : row.context_type === "project" || this.#inProject(row, viewer) ? "none-recorded"
      : "context-has-no-project";
    return {
      in_force: basis === "recorded",
      basis,
      /* The sentence travels WITH the answer, from the plane's own vocabulary,
         so a surface renders what it RECEIVED rather than holding a copy of the
         map (DEC-8, and `op=airunlog`'s own precedent one method down). */
      stated: STANDARD_BASIS[basis],
      pair: basis === "recorded" ? { capture, connection } : null,
    };
  }

  /** op=airuns — WHICH RUNS ARE IN THIS CONTEXT. REC-69, UI-49's delegation.
   *
   *  ===========================================================
   *  THE QUESTION NO OP COULD ANSWER, AND WHY THAT MATTERED.
   *  ===========================================================
   *
   *  §14a promises that *"any window focused on an inquiry or a project shows
   *  an animated indicator that a job is running"*. UI-47 found the indicator
   *  had no call site at all; UI-49 built one — and MEASURED, while building
   *  it, that the plane could not be asked the question. `op=airun`,
   *  `op=airunlog` and `op=airunspawn` are all keyed by RUN ID, `ai_runs` is
   *  queried by `run` at all 14 sites, and `op=airunopen` has no UI consumer,
   *  **so the browser never learns a run id by opening one.** UI-49 therefore
   *  fed its seam from the only source that existed — the run addresses THIS
   *  DEVICE had already opened — which is honest, is pinned, and reaches only
   *  the member who already held the address. §14a's promise is about the
   *  TEAMMATE WHO DID NOT, and this method is the half that reaches them.
   *
   *  ===========================================================
   *  THE GATE, AND WHY THIS SHAPE IS THE ONE THAT LEAKS IF IT IS WRONG.
   *  ===========================================================
   *
   *  A run-id read is a poor leak: a caller must already hold the id. A
   *  CONTEXT-KEYED LIST is the opposite — it takes an id a member can see on
   *  their own screen and answers with everything hanging off it. So the gate
   *  is not incidental here, it is the feature's whole security posture.
   *
   *  IT IS `#bundleGate` ON `context_id`, THE SAME PREDICATE AND THE SAME
   *  COMPILATION POINT (D-15) that `aiRunRead`, `aiRunLog` and
   *  `aiRunSpawnPayload` already compile. **NO SECOND PREDICATE IS WRITTEN
   *  HERE**, and that is deliberate rather than economical: PL-11 measured that
   *  `viewerPredicate`'s MACHINE alternation returns an unfiltered `1=1`, so a
   *  hand-rolled gate that forgot the carve-out — or remembered it wrongly —
   *  would hand an agent the whole store, and a hand-rolled one that forgot the
   *  FAIL-CLOSED deny would turn a missing control-plane stamp from an outage
   *  into a leak. Both arms are `viewerPredicate`'s and neither is restated.
   *
   *  THE POSTURE IS WITHHOLD, NEVER REDACT (REC-36). A run over a project the
   *  viewer was never invited to is absent from this list BYTE-IDENTICALLY to a
   *  run that does not exist, and **no count of what was withheld is reported**
   *  — that count is exactly the disclosure that somebody is investigating
   *  something you cannot see (op=backlinks' rule; R22's tests hold it: a
   *  hidden context answers byte for byte as an empty one, and `truncated`
   *  counts only the runs the viewer may see). It follows that a well-formed context with no
   *  visible runs answers an ordinary EMPTY LIST: "no runs here" and "no runs
   *  you may see" are ONE answer BY CONSTRUCTION rather than by care.
   *
   *  ===========================================================
   *  BOUNDED, AND THE BOUND IS PUBLISHED — IC-25/IC-26's rule.
   *  ===========================================================
   *
   *  `limit` is the cap AFTER clamping, never the number the caller asked for;
   *  `truncated` is the completeness signal, in the spelling its three siblings
   *  already use (`op=airunlog`, `op=versionchain`, `op=basisversions`) rather
   *  than a fifth word beside the plane's four (REC-55). Both are published on
   *  the EMPTY answer too, so a reader who sees nothing does not have to guess
   *  which bound they would have been answered at. `cap + 1` is asked for and
   *  `cap` delivered — `op=exportlog`'s mechanism — because the extra row is
   *  the whole difference between "this context has 200 runs" and "here are its
   *  first 200".
   *
   *  ORDER IS NEWEST FIRST, and the cut therefore falls on the OLDEST. This is
   *  NOT `op=airunlog`, which is replayed FROM THE START by a resuming run
   *  (§14b.7) and must keep ascending order; the question here is "what is
   *  happening in this context", and a surface cut off from the newest run
   *  would be a surface that cannot see the job that is running now.
   *
   *  NO STATUS FILTER, deliberately. A `status='running'` filter here would put
   *  the judgement in the plane and leave a surface unable to render the run
   *  that ENDED — which is the overclaim UI-49 removed one layer up when it
   *  made the indicator carry the record's own status word instead of pulsing
   *  unconditionally. The record answers what is there; the surface decides
   *  what to draw. */
  async listInContext({ contextType = null, contextId = null,
                          viewer = null, limit = null } = {}) {
    /* The helper sits ABOVE the marker, on `#refusePairComposed`'s precedent
       and for its measured reason: the code here is a VARIABLE, so a `where`
       that enclosed it would report a refusal the DEC-49 guard cannot compare
       against a row. Every refusal INSIDE the region names its code as a STRING
       LITERAL, which is what makes arm C's verdict on this site evidence. */
    const refusal = (code, detail) => {
      const row = this.#checkRow(code);
      return { ok: false, reason: code, code, check: row.check,
               translation: row.translation, detail };
    };
    const kinds = Object.keys(RUN_CONTEXTS);
    const type = contextType == null ? "" : String(contextType).trim().toLowerCase();
    const id = contextId == null ? "" : String(contextId).trim();

    /* DEC-49 REGION is-airuns-context — REC-69 / C-36.1-3. The three ways the
     * QUESTION can be malformed, and nothing else: everything below this marker
     * is the answer, and a well-formed question about a context that holds no
     * visible runs is answered rather than refused. */
    if (!type)
      return refusal("AI_RUNS_NO_CONTEXT_TYPE",
        localize("ai-runs.index.op_airuns_answers_for_one", "op=airuns answers for ONE context and must be told which kind: contextType={kinds}. An inquiry and a project are different objects with different membership, so there is no default here that would not be answering about something you did not ask about.", { kinds: String(kinds.join("|")) }));
    if (!kinds.includes(type))
      return refusal("AI_RUNS_UNKNOWN_CONTEXT_TYPE",
        localize("ai-runs.index.no_work_is_attached_to", "no work is attached to anything of the kind {stringify}. The kinds it is attached to: {map}. Answered as a refusal rather than as an empty list, because an empty list here would say nothing is running in a place the record does not recognise.", { stringify: String(JSON.stringify(String(contextType).slice(0, 60))), map: String(kinds.map((k) => `${k} (${RUN_CONTEXTS[k]})`).join("; ")) }));
    if (!id)
      return refusal("AI_RUNS_NO_CONTEXT_ID",
        localize("ai-runs.index.op_airuns_named_the_kind", "op=airuns named the kind {stringify} but not which one. The gate is compiled over the context's own id, so a blank id would ask about every context at once — a different question, not a wider answer.", { stringify: String(JSON.stringify(type)) }));
    /* END DEC-49 REGION is-airuns-context */

    const seen = this.#bundleGate("r.context_id", viewer);
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || AiRuns.AI_RUNS_LIMIT_DEFAULT),
                                     AiRuns.AI_RUNS_LIMIT_MAX));
    /* `lower(r.context_type)` because the WRITE does not fence the word:
       `aiRunOpen` stores `String(contextType)` verbatim, so a run opened as
       `Inquiry` is in the record and a case-sensitive match here would answer
       "nothing is running" over a run that plainly is. Matching case-blind is
       the honest reading of what the record holds; fencing the WRITE is PL-5's
       site and C-22's family, and it is DELEGATED rather than reached into. */
    /* THE PAGE IS IDS, AND IT IS GATED — both halves matter and the second one
       is the security property rather than a detail. The gate is applied HERE,
       before the bound, so `truncated` counts only rows this viewer may see: a
       `truncated: true` computed over rows they may not would announce that
       hidden runs exist, which is op=backlinks' no-count rule broken by a flag
       instead of by a number. */
    const page = this.#rows(
      `SELECT r.run FROM ai_runs r
       WHERE lower(r.context_type) = ? AND r.context_id = ? AND ${seen.sql}
       ORDER BY r.created DESC, r.run LIMIT ?`,
      type, id, ...seen.args, cap + 1);
    /* EACH ROW IS COMPOSED BY `aiRunRead` ITSELF — the list IS the read, run per
       run, and that is the strongest available form of "the same `session`
       shape per row".
       WHY NOT A SHARED PRIVATE COMPOSER, which was written first and REVERTED,
       because the reason is a finding rather than a preference: extracting the
       block out of `aiRunRead` took `op=airun` OFF `meaning-bounds.test.mjs`'s
       (deleted in T20) bare roster — not because the read got better, but
       because its unbounded `ai_run_bounds` scan moved into a PRIVATE method the
       walk could not follow. The ratchet's FLOOR caught it immediately, which is
       exactly what that floor was for, and REC-70's whole subject is a read the
       instrument could not see. Calling the public method kept `op=airun`
       classified exactly as it was; R22's test holds that each row is the read.
       WHAT IT COSTS, stated rather than hidden: one extra keyed lookup per row,
       and the gate compiled once more per row through the SAME `#bundleGate`.
       The bound above is what keeps that finite, and re-asking the gate cannot
       widen the answer — it can only ever agree or withhold, so the redundancy
       fails safe.
       WHAT IT INHERITS: `op=airun`'s `budget` is a collection off an UNBOUNDED
       scan of `ai_run_bounds`. That is a known residual on REC-70's ratchet and
       it is untouched here rather than quietly fixed inside another item's
       method; it is DELEGATED with the measurement. */
    const runs = (await Promise.all(page.slice(0, cap)
      .map((r) => this.read({ run: r.run, viewer }))))
      .filter((a) => a && a.found).map((a) => a.session);

    return {
      ok: true,
      /* The context is echoed NORMALISED, so a caller sees what was actually
         asked rather than what they typed — the same reason op=meaningrows
         publishes the arm it resolved. */
      context: { type, id },
      runs, count: runs.length,
      limit: cap, truncated: page.length > cap,
    };
  }

  /** PL-12: the run's bias block, computed ONCE. Read `aiRunRead`'s header for
   *  what the three answers mean. */
  async #biasForRun(row, viewer) {
    const recordedRaw = row.bias_manifest;
    let recorded = null, unreadable = false;
    if (recordedRaw != null && String(recordedRaw).trim() !== "") {
      try { recorded = JSON.parse(String(recordedRaw)); }
      catch { unreadable = true; }
    }
    /* The CURRENT set for the run's own context. A run over a project reads the
       project scope — instance statements plus that project's — and a run over
       an inquiry reads the instance scope, because an inquiry is shared across
       projects and has no single lens of its own (§3's "a projectless inquiry
       has no CURRENT and no bar", one construct over). The viewer is the run's
       reader, so a lens naming bundles they cannot see is gated identically here
       and in op=biasmanifest — one predicate, not two. */
    const nowManifest = await this.#bias().biasManifest({
      scope: row.context_type === "project" ? "project" : "instance",
      scopeId: row.context_type === "project" ? row.context_id : "",
      viewer,
      /* The bound is irrelevant to the hash — `statements_sha` covers the whole
         set before any bound is applied — so the smallest legal page is asked
         for deliberately: this read needs the FACT, not the statements. */
      limit: 1,
    });
    const recordedSha = recorded && typeof recorded.statements_sha === "string"
      ? recorded.statements_sha : null;
    /* D-85 (INVESTIGATIVE-SESSION.md §11 item 5, rule 3, BOB #25): THE LENS IN FORCE WHEN THE RUN OPENED, which the
       PLANE computed at `aiRunOpen` (`ai_runs.lens_at_open`) beside the manifest the run was HANDED. Before it,
       `moved: true` could not tell *the lens changed after the run opened* from *the run was handed a lens other
       than the one in force* — two different facts, and only the first is bias debt accrued since. Now:
         - `at_open`  the lens in force at the open, as the plane computed it; `{ recorded: false, stated:
                      "not recorded" }` for a run opened before this rule, never a guess back-filled from the hand.
         - `hand`     `in_force` when what the run was handed IS the lens in force at its open (nothing handed and
                      nothing in force counts), `stale` when it is not; null where the open recorded nothing or the
                      hand cannot be read, because then it is undetermined and says so.
         - `moved`    for a recorded open, the lens in force at the open against the lens now — so a STALE hand
                      reads stale and not moved. For a run with no recorded open it keeps its old comparison (the
                      hand against now), and `moved_basis` says which of the two a `moved` is. */
    /* READ THROUGH `safeJson`, and an unreadable record is kept APART from an absent one: a lens recorded at the
       open that cannot be read back is not `not recorded`, and saying so would be the swallowed-read class
       (`provenance-marker.test.mjs`, deleted in T20). It reads `unreadable`, with `hand` and `moved` undetermined. */
    const atOpenHeld = row.lens_at_open != null && String(row.lens_at_open).trim() !== "";
    const atOpenParsed = atOpenHeld ? safeJson(String(row.lens_at_open)) : null;
    const atOpen = atOpenParsed && typeof atOpenParsed === "object" && !Array.isArray(atOpenParsed) ? atOpenParsed : null;
    const atOpenUnreadable = atOpenHeld && !atOpen;
    const shaOf = (m) => (m && m.in_force === true && typeof m.statements_sha === "string" ? m.statements_sha : null);
    const openSha = atOpen ? shaOf(atOpen) : null;
    const nowSha = shaOf(nowManifest);
    const nowBlock = { in_force: nowManifest.in_force === true,
                       statements_sha: nowManifest.statements_sha ?? null,
                       bundles: nowManifest.bundles ?? [] };
    const atOpenBlock = atOpen
      ? { recorded: true, in_force: atOpen.in_force === true, statements_sha: openSha,
          scope: atOpen.scope ?? null, scope_id: atOpen.scope_id ?? null,
          bundles: Array.isArray(atOpen.bundles) ? atOpen.bundles : [], at: atOpen.at ?? null }
      : atOpenUnreadable
        ? { recorded: true, unreadable: true,
            stated: word("ai-runs.stated.lens_force_run") }
        : { recorded: false, stated: "not recorded" };
    const handOf = (handedSha) => (!atOpen ? null : handedSha === openSha ? "in_force" : "stale");
    const basis = atOpen ? "at_open" : atOpenUnreadable ? null : "handed";
    if (recorded === null && !unreadable) {
      /* NOTHING WAS HANDED. §3's sentence is kept verbatim where it is TRUE — no manifest was in force at the open
         — and where the open recorded nothing to contradict it; it is NOT said of a run handed nothing while a
         lens was in force, which is the stale hand this rule exists to tell apart. */
      const staleEmpty = !!atOpen && atOpen.in_force === true;
      return { in_force: false,
               stated: staleEmpty
                 ? word("ai-runs.stated.manifest_handed_run")
                 : word("bias.manifest_force"),
               manifest: null,
               now: atOpen ? nowBlock : null,
               moved: atOpen ? openSha !== nowSha : null,
               moved_basis: atOpen ? basis : null,
               at_open: atOpenBlock, hand: handOf(null) };
    }
    if (unreadable)
      return { in_force: false,
               stated: word("ai-runs.stated.manifest_recorded_run"),
               manifest: null,
               now: atOpen ? nowBlock : null,
               moved: atOpen ? openSha !== nowSha : null,
               moved_basis: atOpen ? basis : null,
               at_open: atOpenBlock, hand: null };
    return { in_force: true,
             stated: null,
             /* AS RECORDED — what the run was formed under, never recomputed. */
             manifest: { scope: recorded.scope ?? null, scope_id: recorded.scope_id ?? null,
                         statements_sha: recordedSha,
                         bundles: Array.isArray(recorded.bundles) ? recorded.bundles : [] },
             /* AS THE RECORD STANDS NOW. */
             now: nowBlock,
             /* THE COMPARISON, which is what makes bias debt computable. For a run with no recorded open, `null`
                where one side has no hash to compare — an unknown is stated and never rendered as `false`, which
                would assert the lens had held. */
             moved: atOpen
               ? openSha !== nowSha
               : atOpenUnreadable ? null
               : (recordedSha == null || nowManifest.statements_sha == null
                   ? null : recordedSha !== nowManifest.statements_sha),
             moved_basis: basis,
             at_open: atOpenBlock, hand: handOf(recordedSha) };
  }


  /** op=airunspawn — THE FENCE, AS CODE.
   *
   *  `INVESTIGATIVE-SESSION.md` §14, and the sweep's own correction of v2:
   *  *"The lens rule is STRUCTURAL, and v2 demoting it to a skill requirement
   *  was the defect §14b.4 itself names (SWEEP C7): a skill is instructions; a
   *  fence is code."*
   *
   *    - *"The search half of the run never receives the bias. The spawn
   *      contract for search sub-sessions and search passes omits the manifest
   *      BY CONSTRUCTION — there is no field to read."*
   *    - *"Bias never shapes what is captured or monitored, only how conclusions
   *      are weighed"* (`Content_Framework:1283`) — the coupling is FORBIDDEN,
   *      not discouraged.
   *    - *"The composing half CARRIES the manifest (§3, ruled) for disclosure
   *      and for the weighing it discloses — never as a search input."*
   *
   *  WHY THIS IS AN OP AND NOT A COMMENT. A fence nothing can be pointed at is
   *  not a fence: before this, the search half's payload existed only as a
   *  sentence in a design document, so there was nothing an assertion could read
   *  and nothing a negative control could break. The payload is BUILT here, by
   *  one function, and R23's and R34's test asserts over the object this method
   *  returns — not over a promise about it.
   *
   *  AND THE ASSERTION IS ABSENCE, NEVER EMPTINESS. The search payload is
   *  written as an explicit literal that never touches `row.bias_manifest`, so
   *  there is no field to be filled in later by a default, a spread, or a
   *  well-meaning caller. `bias: null` would have been the weaker fence: a null
   *  field is a field, and a field acquires a value the first time somebody
   *  thinks they are being helpful.
   *
   *  GATED on the run's context, exactly as `aiRunRead` and `aiRunLog` are. */
  async spawnPayload({ run, half = "search", viewer = null } = {}) {
    const seen = this.#bundleGate("r.context_id", viewer);
    const row = this.#one(
      `SELECT r.* FROM ai_runs r WHERE r.run = ? AND ${seen.sql}`, run, ...seen.args);
    if (!row) return { run: run || null, found: false, half: null, payload: null };
    const composing = String(half) === "compose";
    /* BOUNDED IN SQL AND PUBLISHED, and not because a walk asked. `ai_run_bounds`
       carries at most one row per member of `RUN_BOUNDS`, so the bound is real
       and known — but "bounded by a vocabulary" is a fact in a comment, and a
       comment is not a bound: the cap is published (`limit`, `truncated`), and
       R23's test holds it at the bound count. The cap is the vocabulary's OWN size,
       read live rather than typed, so a bound added to `RUN_BOUNDS` tomorrow
       widens this automatically instead of silently cutting the newest one. */
    const budgetCap = Object.keys(RUN_BOUNDS).length;
    const budgetRows = this.#rows(
      `SELECT bound, allowed, consumed, unit FROM ai_run_bounds WHERE run = ? ORDER BY bound LIMIT ?`,
      run, budgetCap + 1);
    const bounds = budgetRows.slice(0, budgetCap);

    /* THE PAYLOAD, and every key in it is named here. It is deliberately NOT
       built by spreading the row and deleting fields: a delete-list is a list
       that falls behind the thing it lists (D-113's lesson in another table),
       and a column added to `ai_runs` tomorrow would ride a spread straight
       through this fence. */
    const payload = {
      run: row.run,
      context: { type: row.context_type, id: row.context_id },
      mode: row.mode,
      skill: row.skill_version,
      /* The launching project's declared standard pair travels to BOTH halves.
         It is a BAR and not a lens (DEC-54 a), and §3 reads it as one of the
         run's conditions — a bar tells the search what strength the work must
         reach, which is not the coupling §14 forbids. This is exactly why the
         two constructs had to be split before this fence could be drawn. */
      standard_pair: row.standard_pair,
      /* REC-74: THE SAME BAR, JUDGED, FROM THE SAME FUNCTION `op=airun` USES.
         `standard_pair` above is the column verbatim and is KEPT — `agent-worker`
         builds against it and removing it is an interface change this item has
         no mandate for — but verbatim is exactly what could not tell the two
         absences apart: a caller receiving `standard_pair: null` cannot say
         whether no bar was in force, whether the run has no project and could
         not have one, or whether this reader simply does not publish the fact.
         Two readers of one row must not disagree about which of its facts
         exist, so both now answer from `#standardForRun` and neither computes
         its own. */
      standard: this.#standardForRun(row, viewer),
      budget: bounds.map((b) => ({ bound: b.bound, allowed: b.allowed,
                                   consumed: b.consumed, unit: b.unit })),
      /* R85: the records and extents the search should look at, `{items, truncated}`; still no lens field. */
      subjects: this.#runSubjects(row, viewer),
    };

    return {
      run, found: true, half: composing ? "compose" : "search",
      payload,
      /* REC-57's two questions, settled on the one collection this answer
         carries: the bound APPLIED, and whether it cut anything. */
      limit: budgetCap, truncated: budgetRows.length > budgetCap,
      /* THE ONLY DIFFERENCE BETWEEN THE TWO HALVES, and it is one key. The
         composing half's block is the SAME block `op=airun` publishes, computed
         by the same function, because "what lens was this run formed under" has
         one answer. The search half gets no such key at all. */
      ...(composing ? { bias: await this.#biasForRun(row, viewer) } : {}),
      /* Stated, because a caller holding the search payload should be able to
         read WHY it is thinner rather than conclude something failed. */
      fence: composing
        ? word("ai-runs.fence.composing_half_carries")
        : word("ai-runs.fence.search_half_receives"),
    };
  }

  /** op=airunlog — THE OBSERVATION LOG. A different read from the one above and
   *  deliberately a different op: the surface renders the run, and this is what
   *  lets anyone else CHECK it (§11 — "search completeness is trained into the
   *  skill, which is COMPETENCE; the log is what lets anyone else CHECK").
   *
   *  It is also what a RESUMED run reads to continue rather than restart
   *  (§14b.7), which is why the entries come back in `seq` order with their
   *  levels and states intact rather than summarised.
   *
   *  Gated on the same column for the same reason as the read above.
   *
   *  ===========================================================
   *  REC-70 — BOUNDED, AND WHY THE RATCHET BUILT TO CATCH THIS DID NOT.
   *  ===========================================================
   *
   *  THE DEFECT: this read was `... FROM ai_run_log WHERE run = ? ORDER BY seq`
   *  with no `LIMIT`, no `limit` and no `truncated` — D-225's class exactly,
   *  arriving in an op IS-6 added AFTER REC-60 measured its roster. A run's log
   *  grows one row per tick and NOTHING caps the tick count: `RUN_BOUNDS` bounds
   *  fetches, sub-sessions and wall time, never observations.
   *
   *  THE PART THAT MATTERS MORE, AND IT IS RECORDED HERE BECAUSE THE NEXT
   *  UNBOUNDED READ WILL LAND BESIDE THIS ONE: `test/meaning-bounds.test.mjs`
   *  (deleted in T20) existed to fail the build when a new read published a
   *  collection off an unbounded row source, and it did not fail — `op=airunlog` appeared in NONE
   *  of its three buckets, so the walk never reached this method at all.
   *
   *  THE CAUSE, NAMED: **the walk graded only return objects containing the
   *  literal `ok: true`, and this method's success answer says `found: true`.**
   *  One success spelling was hard-coded as if it were the only one, four lines
   *  after that same file wrote its bound and completeness keys as SETS
   *  precisely because "the plane answers the second in five spellings on
   *  purpose". The instrument avoided the one-vocabulary mistake in its leaves
   *  and committed it at its root — and it was not one op: **the gate hid 27 of
   *  the 156 dispatched ops**, `op=signerlist`, `op=publishedlist`,
   *  `op=inbox` (M0-12: `inboxlist` is the DO PATH it is aliased to, not an op
   *  name a caller may send), `op=memberlist` and `op=verify` among them, every one of
   *  them a real unbounded collection read. Measured 2026-08-07, REC-70.
   *
   *  SO THE FIX IS NOT `ok: true` HERE. Adding the marker this method does not
   *  use would buy a green walk and leave the blindness in place for the next
   *  op that spells success a third way. The WALK was corrected instead — it now
   *  grades every return that does not DECLARE itself a refusal — and this
   *  method keeps `found: true`, which is what makes the corrected walk's
   *  verdict on it evidence rather than a coincidence.
   *
   *  D-227 APPLIED HERE. That walk graded what a method PUBLISHED, so an
   *  envelope left honest over a scan whose `LIMIT` was removed still read as
   *  bounded, and the suite pinned this op's SQL bound off its source. The pin
   *  went with the suite. R24's test holds the published bound (the page,
   *  `limit` and `truncated` over 205 entries); the SQL `LIMIT` below is what
   *  keeps the read itself bounded, and no test reads it from the source. */
  log({ run, viewer = null, limit = null } = {}) {
    /* REC-70, IN THE BODY AND NOT ONLY IN THE HEADER ABOVE, because the
       instrument that read this file SEGMENTED FROM THE SIGNATURE DOWN — a
       reasoning block written above the method was invisible to the same walk
       this note is about, which is a small instance of the identical mistake.
       THE CAUSE, in one line: this method answers success as `found: true`, and
       `meaning-bounds.test.mjs` (deleted in T20) graded only returns containing
       `ok: true`, so the ratchet built to catch an unbounded collection never
       reached it — one of 27 dispatched ops hidden by that single literal. The
       walk was inverted to grade everything that is not a declared refusal; this
       method kept `found: true` so the fix was proved rather than sidestepped. */
    const seen = this.#bundleGate("r.context_id", viewer);
    const row = this.#one(
      `SELECT r.* FROM ai_runs r WHERE r.run = ? AND ${seen.sql}`, run, ...seen.args);
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || AiRuns.AI_RUN_LOG_LIMIT_DEFAULT),
                                     AiRuns.AI_RUN_LOG_LIMIT_MAX));
    /* The bound the caller GETS, published on the absent answer too: a reader
       that cannot see the run must not have to guess which bound it would have
       been answered at, and REC-30's rule is that the unknown run and the
       unviewable one read identically. */
    if (!row) return { run: run || null, found: false, entries: [], stopped: null,
                       limit: cap, truncated: false };
    /* `cap + 1` asked for, `cap` delivered — `op=exportlog`'s own mechanism, and
       the extra row is the whole difference between "the run made 200
       observations" and "here are its first 200". ASCENDING order is KEPT: this
       is not `op=exportlog`, whose administrator wants the newest export. §14b.7
       replays this log FROM THE START, so the cut must fall at the END. */
    /* REC-93 — THE FOLD, READING THROUGH. `OBSERVATION-LOG-DESIGN.md` §4.4: the
       run's log is now rows of `observations` under this run's authority, read
       through the `(authority_kind, authority, seq)` index — which is why that
       index exists, since without it the fold would turn a primary-key read into
       a table scan and a fold would have become a regression.

       **`seq` IS RE-DERIVED AS THE ORDINAL WITHIN THIS AUTHORITY, AND THAT IS
       WHAT KEEPS I3 UNCHANGED IN SHAPE AND IN VALUE.** §3 makes `seq` STORE-WIDE
       so that two looks at different levels have an order the table holds. §4.4
       says *"the run's own ordering is the `seq` order within its authority"*.
       Those two are only compatible at this read: the stored `seq` is store-wide,
       and every existing consumer of this op was handed 1, 2, 3… per run. A
       store-wide number here would be a SILENT VALUE CHANGE inside an unchanged
       envelope — the worst shape an interface change can take, because no
       consumer's schema check would catch it. The ordinal is the array index
       because the rows are already `ORDER BY seq` ascending and the cut falls at
       the END (§14b.7 replays from the start), so index + 1 is exact rather than
       approximate. R24's test holds it: entries numbered from 1. */
    /* REC-113 / IC-116 — THE COVERAGE CLAIM, PROJECTED AND THEN STATED.
       ADDITIVE: `result_kind` and `result_ref` are APPENDED to the projection
       and `coverage` is composed after them, so every key this op answered
       yesterday keeps its value AND ITS POSITION. That second half is not
       pedantry — `test/rec113-identity.mjs` (since deleted) stripped exactly
       these three keys back off and compared the RAW RESPONSE TEXT to a
       pre-change build's, which is only a comparison if the order survives.
       R24's test now holds the entries' keys in their order.

       WHY THE READ CHANGED AND THE REFUSAL DID NOT. C-22.10 does not fire on
       `authority_kind = 'run'` (D-366), so rows under this very authority may
       assert PRESENT while naming nothing. REC-100 drove what happens if that
       carve-out is deleted today: `op=airunclose` answers `terminated: false,
       code: OBS_PRESENT_NO_REFERENT` and a run that observed anything PRESENT
       CANNOT BE CLOSED AT ALL — a lifecycle deadlock blocked on a design ruling
       about what a ROLLUP's referent is. That ruling is not this item's and the
       carve-out STANDS. [SUPERSEDED 2026-09-18 by REC-100 / IC-130: BOB #14
       ruled the rollup referent and the carve-out is DELETED, so a new bare
       `run` PRESENT is refused at the append and `undetermined` is now what the
       rows written BEFORE that read as.] What this item fixes is that the reader could not even
       SEE the condition: D-366's whole cost is *"a later reader cannot tell that
       row's coverage claim from one backed by a capture"*, and until now the
       read made that true by construction.

       NOTHING IS INFERRED FROM A SIBLING ROW. `observationCoverage` is pure and
       sees one row's own two values — `accepts-when` forbids the alternative by
       name, and a run whose OTHER rows carry referents says nothing whatever
       about this one. That is the agreement-is-not-evidence rule arriving inside
       a single answer. */
    const page = this.#rows(
      `SELECT seq, at, level, subject, state, governed, condition, bound, terminal, detail,
              result_kind, result_ref
       FROM observation_log WHERE ${AiRuns.#ownRows()}
       ORDER BY seq LIMIT ?`, run, run, cap + 1);
    /* REC-100 / IC-130 — A ROLLUP'S `observation` REFERENT IS RE-EXPRESSED IN
       THIS OP'S OWN `seq`, for the reason the note above gives for `seq` itself.
       The column stores the STORE-WIDE seq (§3, and what `op=frontier` publishes
       beside its store-wide `seq`); this op publishes the PER-RUN ordinal, so a
       store-wide number here would point at no entry in the same answer — a
       pointer a reader cannot follow, which is the one thing the rollup ruling
       says the referent must be. EXACT, NOT APPROXIMATE: C-22.10's arm admits an
       `observation` referent only to an EARLIER row of the SAME run, and the page
       is a PREFIX of the run's rows in `seq` order, so the referent is always in
       `ordinal`. The fallback keeps the stored value rather than inventing or
       dropping one, and is unreachable while that check stands. */
    const ordinal = new Map(page.slice(0, cap).map((e, i) => [String(e.seq), i + 1]));
    const entries = page.slice(0, cap)
      .map((e, i) => ({ ...e, seq: i + 1, governed: e.governed === 1, terminal: e.terminal === 1,
                        /* NULL IS NORMALISED TO `null` RATHER THAN LEFT AS `undefined`:
                           a key that serialises away is the absence-with-two-causes this
                           whole item is about, one layer down. */
                        result_kind: e.result_kind ?? null,
                        result_ref: e.result_kind === "observation" && ordinal.has(String(e.result_ref))
                          ? String(ordinal.get(String(e.result_ref)))
                          : (e.result_ref ?? null),
                        coverage: observationCoverage({ state: e.state, resultRef: e.result_ref }) }));
    return { run, found: true, status: row.status, entries,
             limit: cap, truncated: page.length > cap,
             stopped: row.stopped_bound
               ? { bound: row.stopped_bound, condition: row.stopped_condition, at: row.stopped_at }
               : null,
             /* The vocabularies travel WITH the answer rather than being looked
                up by a reader who would then hold a copy of them — the same
                reason op=affordances publishes the act set instead of naming it
                (DEC-8: a surface renders what it received). */
             vocabulary: { states: OBSERVATION_STATES, levels: OBSERVATION_LEVELS,
                           bounds: RUN_BOUNDS, endings: RUN_ENDINGS,
                           /* REC-113 / IC-116, APPENDED for the same reason the four
                              above travel at all (PL-17, DEC-8): a surface that must
                              render `undetermined` should read the word off the answer
                              rather than hold a literal it learned somewhere else and
                              will not re-learn. `coverage_undetermined` is published
                              SEPARATELY because it is deliberately not a member of
                              `coverage` — `op=contentaxis`'s `undetermined_value` is the
                              same shape one construct over. */
                           coverage: OBSERVATION_COVERAGE,
                           coverage_undetermined: OBSERVATION_COVERAGE_UNDETERMINED } };
  }
  /* ---- R28, R29: FOR THE MODULES THAT PRODUCE UNDER A RUN ------------------------------------------------------ */

  /** R28: the run's facts a producer gates on, for a held run the viewer can see; null for a blank id, an absent
   *  run and an invisible one alike. Never throws, writes nothing. Whether the caller holds it is R5 over
   *  `principal_plane`; `principal_claude` is the level that pays, which a production under the run records
   *  (capture-requests' request row). */
  runFor(run, viewer) {
    try {
      const id = run == null ? "" : String(run).trim();
      if (!id) return null;
      const seen = this.#bundleGate("r.context_id", viewer);
      const r = this.#one(`SELECT r.run, r.status, r.mode, r.context_type, r.context_id, r.principal_plane, r.principal_claude,
                                  r.plan, r.origin, r.response, r.untested, r.project FROM ai_runs r WHERE r.run = ? AND ${seen.sql}`, id, ...seen.args);
      return r ? { run: r.run, status: r.status, mode: r.mode, context_type: r.context_type,
                   context_id: r.context_id, principal_plane: r.principal_plane, principal_claude: r.principal_claude,
                   /* R78: the label recorded at the open */
                   untested: AiRuns.#untestedOf(r),
                   /* R89: the project the run was opened in */
                   project: r.project ?? null,
                   ...(r.mode === "plan" ? { plan: r.plan ?? null } : {}),
                   /* R77: a re-examination run's response, as `read` answers it */
                   ...(r.origin === "reexamination" ? { response: r.response ?? null } : {}) } : null;
    } catch { return null; }
  }

  /** R78: a run's recorded `untested` label, read back as stored at the open; null when none was recorded or it cannot be
   *  read (never derived from the bar or the instance now, R32). */
  static #untestedOf(row) {
    const v = row && row.untested != null ? safeJson(String(row.untested)) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  }

  /** R29: one bound's `{allowed, consumed}`, or null when the run declared none. */
  boundOf(run, bound) {
    const r = this.#one(`SELECT allowed, consumed FROM ai_run_bounds WHERE run = ? AND bound = ?`,
      String(run ?? ""), String(bound ?? ""));
    return r ? { allowed: Number(r.allowed), consumed: Number(r.consumed) } : null;
  }

  /** R29: add `n` to a bound's consumption, inside the caller's transaction (the row made at allowed 0 when none
   *  was declared). `n` 0 writes nothing; a figure that is not a non-negative safe integer is C-22.13 and nothing
   *  is written. It never ends a run: an exhausted bound ends it at the next tick (R12). */
  consumeBound(run, bound, n) {
    const b = String(bound ?? "");
    /* The figure's rule is R3's, asked of this one pair (an unknown bound C-22.15; `lease`, which nothing spends,
       C-22.14; a figure that is not a non-negative safe integer C-22.13). A good figure is asked as a zero, because the
       plane-counted refusal of `mints` and `surfaces` is not this caller's: here the plane is counting its own work. */
    const figure = typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
    const bad = checkConsume([[b, figure ? 0 : n]], { seed: false });
    if (bad) return bad;
    if (n === 0) return null;
    this.#transact(() => {
      this.sql.exec(
        `INSERT INTO ai_run_bounds (run, bound, allowed, consumed) VALUES (?, ?, 0, ?)
         ON CONFLICT(run, bound) DO UPDATE SET consumed = consumed + ?`, String(run), String(bound), n, n);
    });
    return null;
  }

  /** R37: the run gate `contradiction` offers (its R21), from R28 and R5: `found` false for blank, absent and
   *  invisible alike; `refusal` null or R5's `AI_RUN_NOT_PRINCIPAL` naming `act`. */
  runGate(run, viewer, caller, act = null) {
    const r = this.runFor(run, viewer);
    if (!r) return { found: false, running: false, refusal: null, run: null };
    return { found: true, running: r.status === "running", run: r,
             refusal: runPrincipalGate({ caller, principal: r.principal_plane, ...(act ? { act } : {}) }) };
  }

  /* ---- R52, R72, R76: THE ACCOUNT A RUN CARRIES, ITS USE AND ITS COST ----------------------------------------------
   *
   * What each account has spent and may spend is `ai-use`'s (T40-8, K624: this module's R48–R51 moved there whole, the
   * counter and ceilings with their tables): a run asks its `useCheck` before it opens and at each tick, counts each tick's
   * conversations through its `countUsage` under the run's id, and answers its cost from its `actualOf` (one store of the
   * figures, K2482). Which account pays is `ai-accounts.accountFor`'s (T48; N996 §5). */

  /** A refusal relayed inside the tick's own shape (`ticked: false` leads, so no `ok` rides beside it). */
  static #shed({ ok: _ok, ...rest }) { return rest; }

  /** One refusal of this module's acts, its row read by key from `run-rules`' table (R35). */
  #refuse(code, detail, extra = {}) {
    const row = this.#checkRow(code) || { check: null, translation: null };
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...extra };
  }

  /** The `ai-use` module (R52, R76): the injected one, else its factory on this `ctx`. */
  #aiUse() { return this.#deps.aiUse || aiUseOf(this.ctx); }

  /** The `ai-accounts` module (R18, R52, R79; T48, N996 §5): the injected one, else its factory on this `ctx`, which answers
   *  the one instance `credentials`' factory made at boot with the seal secret (ai-accounts R32). Which account serves an
   *  act (`accountFor`), whether one is held (`accountReferenceState`, `groupKeyState`) and its switches
   *  (`accountUses`, `groupKeySwitches`) are read here, never through `credentials`' transitional delegates. */
  #aiAccounts() { return this.#deps.aiAccounts || aiAccountsOf(this.ctx); }

  /** R52 (B5): `ai-use.useCheck` for the paying `owner` and `member`'s use `run` at `ms`: null, or its refusal relayed as
   *  it came. A check that cannot be asked refuses (fail closed, as ai-use R3 fails closed). */
  #useCheck(owner, member, ms) {
    try {
      return this.#aiUse().useCheck({ owner, member: `member:${member}`, use: "run", at: AiRuns.#aiIso(ms) }) ?? null;
    } catch {
      return this.#refuse("AI_NO_ACCOUNT", localize("ai-runs.index.the_use_of_the_account", "The use of the account that would serve this run cannot be judged now. Nothing was started."));
    }
  }

  /** R52, R72: each conversation of a tick counted through `ai-use.countUsage`, to the run's paying account and member,
   *  under use `run` and `act` the run's id (R76), inside the caller's transaction. Null, or the first entry's refusal
   *  (ai-use R1's `AI_RUN_CONSUME_INVALID`), naming which entry. */
  #countEntries(row, payer, entries, ms) {
    const use = this.#aiUse();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const said = e && typeof e === "object" && !Array.isArray(e)
        ? use.countUsage({ owner: row.principal_claude, member: `member:${payer}`, use: "run", mode: e.mode, model: e.model ?? null,
                           /* R88: the conversation's effort beside its model, ai-use R15's to judge; null where none is stated */
                           effort: e.effort ?? null, usage: e.usage, calls: e.calls, at: AiRuns.#aiIso(ms), act: String(row.run) })
        : this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-runs.index.the_entry_is_not", "the entry is not an object {mode, model, usage, calls}."));
      if (!said || said.ok !== true)
        return { ...(said || this.#refuse("AI_RUN_CONSUME_INVALID", localize("ai-runs.index.the_entry_could_not_be", "the entry could not be counted."))),
                 detail: localize("ai-runs.index.usage_entry_v1_v2", "usage entry {v1}: {v2}", { v1: String(i + 1), v2: String((said && said.detail) || localize("ai-runs.index.it_could_not_be_counted", "it could not be counted")) }) };
    }
    return null;
  }

  /** R52 (J5 (13)): a refused tick's conversations, counted in their own transaction (they were made and paid for): the
   *  number counted, or the refusal of a malformed entry, which counts none. */
  #countTick(row, payer, entries, ms) {
    const REFUSED = Symbol("refused");
    let bad = null;
    try {
      this.#transact(() => { bad = this.#countEntries(row, payer, entries, ms); if (bad) throw REFUSED; });
    } catch (e) { if (e !== REFUSED) throw e; return bad; }
    return entries.length;
  }

  /** R76 (D12, K2482; J5 (10)): the run's cost as `ai-use.actualOf({act: <run>, viewer})` answers it, to the paying
   *  account's owners only (ai-use decides who they are); `final` once the run has ended. Null for anyone else and where
   *  nothing is measured: no key at all is answered then. Never throws. */
  #costFor(row, viewer) {
    try {
      const a = this.#aiUse().actualOf({ act: String(row.run), viewer });
      if (!a || a.ok !== true || a.found !== true) return null;
      const { ok: _ok, found: _found, ...rest } = a;
      return { final: row.status !== "running", ...rest };
    } catch { return null; }
  }

  /** R72: a provider's refusal for a spent limit, answered in plain words at the wake's dispatch, never as an error. */
  #providerLimit() {
    return { provider_limit: true, detail: localize("ai-runs.index.the_claude_account_that_serves", "The Claude account that serves this run has reached the spending limit set on it, so the assistant cannot continue for now. Nothing was lost.") };
  }

  /** R52 (K1755): which account serves `member`'s act now, read without unsealing, for the synchronous checks (an ask's
   *  ceiling check, the wake's decision): `member` when they hold a reference of their own (ai-accounts R2's state, asked
   *  as that member) or are connected through their subscription (its R18; T38, K2299), else `group` when the group's API
   *  key is on and they are an active member (ai-accounts R6's state, asked as that member: it answers `{on}` to an active
   *  member alone), else null. Its R7's choice, as its own order makes it. */
  #accountServing(member) {
    const as = `member:${member}`;
    let c;
    try { c = this.#aiAccounts(); } catch { return null; }
    try {
      const s = c.accountReferenceState({ member: as, viewer: as });
      if (s && s.ok === true && s.held === true) return "member";
      /* (T38; K2299) else their own sign-in, when connected through their subscription (ai-accounts R18, R7) */
      if (s && s.ok === true && s.subscription && s.subscription.connected === true) return "member";
    } catch { /* read as none of their own */ }
    try {
      const g = c.groupKeyState({ viewer: as });
      return g && g.ok === true && g.on === true ? "group" : null;
    } catch { return null; }
  }

  /** R52 (K1503, K1755): the account `ai-accounts.accountFor` (its R7, R11) answers for `member`'s act of `kind` (`run`):
   *  `{level, kind, key}` when one serves it (R79; T47: a held sign-in's `key` is its token, ai-accounts R19); else `{refusal}`: `NO_ACCOUNT` read as this module's `AI_NO_ACCOUNT`, any
   *  other refusal of that service (the group key's notice not yet read, a member not active, the seal) relayed as it
   *  came. The caller keeps the key for the one call it serves, or not at all. */
  async #accountFor(member, kind, project = null) {
    let a = null;
    try {
      a = await this.#aiAccounts().accountFor({ member: `member:${member}`,
        act: { kind, member: `member:${member}`, ...(project ? { project } : {}) } });
    } catch { a = null; }
    /* R52 (T41): the owner that pays, as ai-use R1 spells it */
    const owner = (lvl, proj) => (lvl === "group" ? "group" : lvl === "project" ? `project:${proj}` : `member:${member}`);
    if (a && a.ok === true && typeof a.key === "string" && (a.level === "member" || a.level === "group" || a.level === "project"))
      return { level: a.level, kind: a.kind, key: a.key, owner: owner(a.level, a.project) };
    /* (T38; K2299) the member's own sign-in (ai-accounts R7, R18), or (T41; ai-accounts R10, R11) a project's, its sole
       owner's, answered with no key: carried with no `secret`. (T47; R79, ai-accounts R19) A held sign-in answers its
       token as `key` and is read by the arm above, its `kind` kept `signin`. */
    if (a && a.ok === true && a.kind === "signin" && (a.level === "member" || a.level === "project"))
      return { level: a.level, kind: "signin", key: null, owner: owner(a.level, a.project) };
    if (!a || a.code === "NO_ACCOUNT" || typeof a.code !== "string") return { refusal: this.#noAccount(member, "A run") };
    const { ok: _ok, ...rest } = a;
    return { refusal: { ok: false, ...rest } };
  }

  #noAccount(member, what) {
    /* DEC-49 REGION is-ai-no-account */
    return this.#refuse("AI_NO_ACCOUNT", member
      ? localize("ai-runs.index.what_needs_a_claude_account", "{what} needs a Claude account to serve the member whose act started it, and none serves that member: they have connected none of their own, and the team's key is not set or not on. Nothing was started.", { what: String(what) })
      : localize("ai-runs.index.what_names_no_member_whose", "{what} names no member whose Claude account carries it. Nothing was started.", { what: String(what) }));
    /* END DEC-49 REGION is-ai-no-account */
  }

  /** R52 (K1503): the member whose account a run carries — a member's session (`actor`), else the member a member-kind
   *  credential acts for (`principal_plane`), else, for a machine credential, the member the opener names
   *  (`principalClaude`, `member:<id>`). Null when there is none. */
  static #accountMember({ actor, principalPlane, principalClaude }) {
    return memberIdOf(actor) || memberIdOf(principalPlane)
      || (typeof principalClaude === "string" && principalClaude.trim().startsWith("member:") ? memberIdOf(principalClaude) : null);
  }

  /** R52: the member a stored run is carried by: its `principal_claude` when that is `member:<id>`; null for a run
   *  opened before T33-50, which recorded a level word there. */
  static #payerOf(principalClaude) {
    return typeof principalClaude === "string" && principalClaude.startsWith("member:") ? memberIdOf(principalClaude) : null;
  }

  /** R52 (T41): the member whose act a stored run is: its `principal_claude_ref` (`member:<id>`), else, for a run opened
   *  before T41, its `principal_claude` when that names a member. */
  static #memberOfRun(row) {
    const ref = row && typeof row.principal_claude_ref === "string" && row.principal_claude_ref.startsWith("member:")
      ? memberIdOf(row.principal_claude_ref) : null;
    return ref || AiRuns.#payerOf(row && row.principal_claude);
  }

  /* ---- K1606 (run-rules R19; VF-4): THE ACT THAT RECORDS A MODE'S FIRST LIVE RUN VERIFIED, written here, where runs
     are, and read back by the open's deployability (R40). ------------------------------------------------------------ */

  /** Every well-formed `verification_recorded` this record holds, oldest first, in run-rules' shape. */
  verifications() {
    try {
      return this.#rows(`SELECT mode, run, verified_by, at, evidence FROM ai_mode_verifications ORDER BY at, mode, run`)
        .map((r) => ({ mode: r.mode, run: r.run, verified_by: r.verified_by, at: r.at, evidence: safeJson(r.evidence) }));
    } catch { return []; }
  }

  /** run-rules R19: record that `mode`'s first live run, `run`, was verified, by the member `by` (the control plane's
   *  stamp), with `evidence`. Refused by `checkVerification` (C-22.20, a RELAY) as it judges it; a run this record
   *  does not hold in that mode, for this member's sight, is refused the same way, naming `run`. Append-only: a mode and
   *  run already recorded answer `existed: true`. The answer carries whether the next mode is now deployable. */
  verificationRecord({ mode = null, run = null, evidence = null, by = null, at = null } = {}) {
    const now = AiRuns.#aiIso(at ? Date.parse(at) : Date.now());
    const who = memberIdOf(by);
    const v = { mode, run, verified_by: who ? `member:${who}` : (by ?? null), at: now, evidence };
    const bad = checkVerification(v);
    if (bad) return bad;
    const held = this.runFor(run, by);
    if (!held || held.mode !== mode) {
      const row = this.#checkRow("AI_RUN_VERIFICATION_UNFIT");
      return { ok: false, code: "AI_RUN_VERIFICATION_UNFIT", check: row.check, translation: row.translation, field: "run",
               detail: localize("ai-runs.index.no_run_string_in_mode", "no run '{String}' in mode '{String_2}' is held here for this member. Nothing was recorded", { String: String(String(run).slice(0, 60)), String_2: String(String(mode).slice(0, 40)) }) };
    }
    const prior = this.#one(`SELECT at FROM ai_mode_verifications WHERE mode = ? AND run = ?`, mode, run);
    const existed = !!prior;
    if (!existed)
      this.#transact(() => this.sql.exec(`INSERT INTO ai_mode_verifications (mode, run, verified_by, at, evidence) VALUES (?, ?, ?, ?, ?)`,
        mode, run, v.verified_by, now, JSON.stringify(evidence)));
    const order = RUN_MODES;
    const next = order[order.indexOf(mode) + 1] ?? null;
    return { ok: true, mode, run, verified_by: v.verified_by, at: existed ? prior.at : now, existed,
             next: next ? { mode: next, deployable: this.partAdmitted(next).admitted } : null };
  }

  /* ---- R75 (T41; D14, D11): THE TEST BAR, written here, where runs are, and read by run-rules R19's deploy gate ---- */

  /** R75: record an AI part's result on a test set, written by the harness (an in-plane call, reached by no route): Civicsmith's
   *  frozen set, or a group's own (`set: "group"`). Its shape is judged by `run-rules`' `checkTestBarRecord` (AI_TEST_BAR_UNFIT,
   *  C-22.22; B3, K2485), a RELAY; refused whole where that judge is not reachable (fail closed). Figures only: no transcript is
   *  taken or kept (D15). Append-only. */
  testBarRecord({ part = null, set = null, set_version = null, false_alarm_rate = null, passed = null, graded_by = null,
                  at = null } = {}) {
    const now = AiRuns.#aiIso(at ? Date.parse(at) : Date.now());
    const record = { part, set, set_version, false_alarm_rate, passed, graded_by, at: now };
    const bad = checkTestBarRecord(record);
    if (bad) return bad;
    this.#transact(() => this.sql.exec(
      `INSERT INTO ai_test_bar (part, set_name, set_version, false_alarm_rate, passed, graded_by, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      String(part), String(set), Number(set_version), Number(false_alarm_rate), passed === true ? 1 : 0, String(graded_by), now));
    return { ok: true, part: String(part), set: String(set), set_version: Number(set_version),
             false_alarm_rate: Number(false_alarm_rate), passed: passed === true, at: now };
  }

  /** R75: every result recorded on Civicsmith's own test investigations (never a group's set, which opens or closes no
   *  gate), oldest first, in run-rules R19's shape, for its `deployable`. Writes nothing; never throws. */
  testBarRecords() {
    try {
      return this.#rows(`SELECT part, set_name, set_version, false_alarm_rate, passed, graded_by, at FROM ai_test_bar
                          WHERE set_name <> 'group' ORDER BY seq`)
        /* the version as the number run-rules' judge reads (a whole number of one or more), whatever the column's affinity */
        .map((r) => ({ part: r.part, set: r.set_name, set_version: Number(r.set_version), false_alarm_rate: Number(r.false_alarm_rate),
                       passed: r.passed === 1, graded_by: r.graded_by, at: r.at }));
    } catch { return []; }
  }

  /** R75: a member adds one of the group's own test investigations for a part: a matter and the answers the group's people
   *  wrote. `by` is the control plane's stamp, an active member. A blank part, matter or answers, or a caller who is not an
   *  active member, is AI_GROUP_TEST_INVALID (a row of run-rules' table, B4), nothing written. A matter already held for the
   *  part is replaced by its newer answers. */
  groupTestSet({ part = null, matter = null, answers = null, by = null, at = null } = {}) {
    const who = memberIdOf(by);
    const text = (v, max) => (typeof v === "string" && v.trim() !== "" && v.length <= max ? v.trim() : null);
    const p = text(part, 60), m = text(matter, 200);
    const a = typeof answers === "string" ? text(answers, 20000)
      : answers && typeof answers === "object" ? (JSON.stringify(answers).length <= 20000 ? JSON.stringify(answers) : null) : null;
    let active = false;
    try { const f = who ? this.#membership().memberFacts(who) : null; active = !!f && f.status === "active"; } catch { active = false; }
    /* DEC-49 REGION is-ai-group-test */
    if (!p || !m || !a || !active)
      return this.#refuse("AI_GROUP_TEST_INVALID", !active ? localize("ai-runs.index.a_teams_test_investigation_is", "a team's test investigation is added by one of its active members. Nothing was added.") : localize("ai-runs.index.a_teams_test_investigation_names", "a team's test investigation names its part, its matter and the answers your members wrote (missing: {filter}). Nothing was added.", { filter: String([!p && "part", !m && "matter", !a && "answers"].filter(Boolean).join(", ")) }));
    /* END DEC-49 REGION is-ai-group-test */
    const now = AiRuns.#aiIso(at ? Date.parse(at) : Date.now());
    this.#transact(() => this.sql.exec(
      `INSERT INTO ai_group_tests (part, matter, answers, by, at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(part, matter) DO UPDATE SET answers = excluded.answers, by = excluded.by, at = excluded.at`,
      p, m, a, `member:${who}`, now));
    return { ok: true, part: p, matter: m, at: now };
  }

  /** R75: a part's results on the group's own test investigations, with each false-alarm rate, to the group's active
   *  members; anyone else is answered none (withheld, never counted). Never a deploy gate's input. Writes nothing. */
  groupTestResults({ part = null, viewer = null } = {}) {
    const who = memberIdOf(viewer);
    const p = typeof part === "string" ? part.trim() : "";
    let active = false;
    try { const f = who ? this.#membership().memberFacts(who) : null; active = !!f && f.status === "active"; } catch { active = false; }
    if (!active || !p) return { ok: true, part: p || null, matters: 0, results: [] };
    const matters = this.#one(`SELECT count(*) c FROM ai_group_tests WHERE part = ?`, p).c;
    const results = this.#rows(`SELECT set_version, false_alarm_rate, passed, at FROM ai_test_bar
                                 WHERE set_name = 'group' AND part = ? ORDER BY seq`, p)
      .map((r) => ({ set_version: r.set_version, false_alarm_rate: Number(r.false_alarm_rate), passed: r.passed === 1, at: r.at }));
    return { ok: true, part: p, matters: Number(matters), results };
  }

  /* ---- R25, R26: THE SURFACING STEP, registered with promotion (K31) --------------------------------------------- */

  /** Whether this promotion is an assistant's creation of a question: a creation of an inquiry carrying the control
   *  plane's `assistantPrincipal` stamp, which `control-plane` sets for an `ai` credential only, deleting any caller's copy
   *  first. A member's creation, and every store-internal one, carries no stamp and is not asked. */
  static #surfacing(c) {
    const pkg = (c && c.pkg) || {};
    return !!c && !c.head && c.promotedType === "inquiry"
      && typeof pkg.assistantPrincipal === "string" && pkg.assistantPrincipal.trim() !== "";
  }

  /** D-85 (INVESTIGATIVE-SESSION.md §11 item 5, rule 2, BOB #25) — MAY THIS ASSISTANT OPEN A QUESTION, AND
   *  INSIDE WHICH RUN? Null when the creation may land, else the refusal (R25).
   *
   *  REC-165's ORDER, the tick's (REC-152): SIGHT first — a run whose context the caller cannot see answers the
   *  SAME SURFACE_NO_RUN a run never minted gets, and so does a creation naming no run, since both say the same
   *  thing to the caller: there is no run of yours here; then POSITION — `runPrincipalGate`, the member who
   *  opened the run or a credential she minted, relayed FIELD BY FIELD (a spread would hide the verdict from the
   *  DEC-49 guard); then STATUS; then the BOUND, on `mints`' rule — a run that declares no `surfaces` bound may
   *  surface nothing, because a default allowance chosen here would be a measurement with no measurement behind
   *  it. The bound is asked here AND consumed inside the promotion's transaction (R26), so a refused creation spends
   *  none. The caller is the STAMP, never a field the body carries; the run is the body's word, which is why every
   *  question above is asked of it. */
  #surfacingGate(pkg) {
    const caller = String(pkg.assistantPrincipal ?? "").trim();
    const run = String(pkg.run ?? "").trim();
    const refusal = (code, detail, extra) => {
      const row = this.#checkRow(code);
      return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail,
               run: run || null, ...(extra || {}) };
    };
    const runRow = this.runFor(run, pkg.actorViewer ?? null);
    /* DEC-49 REGION is-surface-run */
    if (!runRow)
      return refusal("SURFACE_NO_RUN",
        run ? localize("ai-runs.index.no_run_named_run_is", "no run named '{run}' is open here. An assistant opens a question only inside a run it holds (INVESTIGATIVE-SESSION.md §11 item 5, rule 2): the run carries the lens in force and the objective the question was surfaced under. Nothing was created.", { run: String(run.slice(0, 60)) })
            : "an assistant opens a question only inside a run it holds: pass run=<the run this question is "
              + "surfaced under> in the promotion. The run carries the lens in force and the objective it "
              + "pursued (INVESTIGATIVE-SESSION.md §11 item 5, rule 2). Nothing was created.");
    const notPrincipal = runPrincipalGate({ caller, principal: runRow.principal_plane,
                                            act: word("ai-runs.act.opening_question_under") });
    if (notPrincipal)
      return { ok: false, reason: notPrincipal.code, code: notPrincipal.code, check: notPrincipal.check,
               translation: notPrincipal.translation, detail: notPrincipal.detail, run,
               note: word("ai-runs.note.assistant_opens_question") };
    if (runRow.status !== "running")
      return refusal("SURFACE_RUN_NOT_RUNNING",
        localize("ai-runs.index.the_run_run_has_ended", "the run '{run}' has ended ({String}), and a question is read against the conditions of the run that surfaced it, which stopped being current when it stopped. Nothing was created.", { run: String(run.slice(0, 60)), String: String(String(runRow.status).slice(0, 40)) }), { status: runRow.status });
    const bound = this.boundOf(run, "surfaces");
    if (!bound || !(bound.allowed > 0))
      return refusal("SURFACE_NO_BOUND",
        localize("ai-runs.index.the_run_run_declares_no", "the run '{run}' declares no 'surfaces' bound, so the questions it may open would be unbounded. The bound is declared at op=airunopen, by the member who opens the run. Nothing was created.", { run: String(run.slice(0, 60)) }));
    if (bound.consumed >= bound.allowed)
      return refusal("SURFACE_BOUND_REACHED",
        localize("ai-runs.index.the_run_run_has_reached", "the run '{run}' has reached its 'surfaces' bound ({consumed} of {allowed}). Nothing was created; the next tick ends the run, and the log says which bound stopped it.", { run: String(run.slice(0, 60)), consumed: String(bound.consumed), allowed: String(bound.allowed) }), { allowed: bound.allowed, consumed: bound.consumed });
    /* END DEC-49 REGION is-surface-run */
    return null;
  }

  /** R25: the step's check, before the promotion writes anything. */
  #surfacingCheck(c) {
    if (!AiRuns.#surfacing(c)) return null;
    return this.#surfacingGate(c.pkg);
  }

  /** R26: THE LINK AND THE BOUND, in the creation's own transaction, so a question an assistant opened cannot exist
   *  without the row naming its run, and a refused creation spends nothing. An INSTANCE row keyed by the new inquiry
   *  and never a line in its bytes (the run is scratch). The answer's `surfaced_in` names the run, the instant and the
   *  bound after this spend. */
  #surfacingProject(c) {
    if (!AiRuns.#surfacing(c)) return null;
    const run = String(c.pkg.run).trim(), principal = c.pkg.assistantPrincipal.trim();
    const at = new Date().toISOString();
    this.#transact(() => {
      this.sql.exec(`INSERT INTO inquiry_run_surfacings (bundle_id, run, principal, at) VALUES (?,?,?,?)`,
        c.bundleId, run, principal, at);
      this.consumeBound(run, "surfaces", 1);
    });
    const left = this.boundOf(run, "surfaces");
    return { surfaced_in: { run, at, bound: { bound: "surfaces", allowed: left.allowed, consumed: left.consumed } } };
  }

  /* ---- R36: HIDDEN RUNS — `hiddenRuns` (R42, module level) is what retrieval holds; observation-log's resolver is
     `runFor` (R28), the same sight. ------------------------------------------------------------------------------ */

  /** R27 (K674): inquiry's `migratedSurfacing` (its R49) for a question with no surfacing row here: the migration
   *  replay's record of it, or null. Reached lazily through inquiry's factory; null when it answers nothing. */
  #migratedSurfacing(bundleId) {
    try {
      const k = this.#deps.inquiry || inquiryOf(this.ctx);
      const m = k && typeof k.migratedSurfacing === "function" ? k.migratedSurfacing(bundleId) : null;
      return m && typeof m === "object" ? m : null;
    } catch { return null; }
  }

  /** R27: which run a question was opened inside, and under what lens. The run's facts are `read`'s answer, taken
   *  whole under the same viewer. The migration-replay arm is inquiry's (map §5.8): a question with no surfacing
   *  row answers `not recorded` here. */
  async surfacedIn(bundleId, viewer) {
    const link = this.#one(`SELECT run, principal, at FROM inquiry_run_surfacings WHERE bundle_id=?`, bundleId);
    if (!link) return this.#migratedSurfacing(bundleId) ?? { recorded: false, stated: "not recorded", run: null, lens: null };
    const read = await this.read({ run: link.run, viewer });
    if (!read || read.found !== true || !read.session)
      return { recorded: true, run: null, by: null, at: link.at, lens: null,
               stated: word("ai-runs.stated.question_opened_inside") };
    return { recorded: true, run: link.run, by: link.principal, at: link.at,
             context: read.session.context, status: read.session.status, lens: read.session.bias };
  }

  /** The tables and their two additive columns (R38), and D-85's `ai_run_log` fold: the pre-fold run log's rows are
   *  copied into the observation log under `authority_kind = run` and the old table dropped, once. Idempotent;
   *  called by the store's migration after observation-log's. */
  migrate() {
    const bare = AI_RUNS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) if (st.trim()) this.sql.exec(st);
    const cols = new Set(this.#rows(`PRAGMA table_info(ai_runs)`).map((c) => c.name));
    for (const col of AI_RUNS_ADDED_COLUMNS)
      if (!cols.has(col)) this.sql.exec(`ALTER TABLE ai_runs ADD COLUMN ${col} TEXT`);
    if (this.#rows(`PRAGMA table_info(ai_run_log)`).length) {
      this.sql.exec(
        `INSERT INTO observation_log
           (at, actor_class, actor, authority_kind, authority, level, subject_kind, subject,
            state, governed, condition, bound, terminal, result_kind, result_ref, detail)
         SELECT l.at, 'machine', r.principal_claude, 'run', l.run, l.level, 'unstated', l.subject,
                l.state, l.governed, l.condition, l.bound, l.terminal, NULL, NULL, l.detail
           FROM ai_run_log l LEFT JOIN ai_runs r ON r.run = l.run
          ORDER BY l.run, l.seq`);
      this.sql.exec(`DROP TABLE ai_run_log`);
    }
  }
}

const INSTANCES = new WeakMap();
/** The one instance per Durable Object storage (K61). A later caller's `env` fills one created without it; `deps` are
 *  read on the first call only. */
export function aiRunsOf(ctx, env = null, deps = null) {
  const key = ctx.storage;
  let m = INSTANCES.get(key);
  if (!m) { m = new AiRuns(ctx, env || {}, deps || {}); INSTANCES.set(key, m); }
  else if (env && (!m.env || !Object.keys(m.env).length)) m.env = env;
  return m;
}

/** The run's ops (K3), for the control plane's dispatch: `airunopen`, `airuntick`, `airunclose`, `airun`, `airunlog`,
 *  `airuns`, `airunspawn` and `airunverify`. The use's ops (`aiusage`, and the ceilings', retired
 *  for `ailimitset`) are `ai-use`'s `aiUseOps` since T40-8 (K624). Every identity is a
 *  server-side stamp read from the QUERY and set AFTER the body's spread, so a caller's own copy in the body is
 *  overwritten rather than believed: the two principals on the open (§14a — a principal a caller can name is not one),
 *  `actor` (PL-18, DEC-63: which member is asking; empty for a machine), `viewer` (D-15's fail-closed sight; on the
 *  open only the stated project count reads it, REC-139), `caller` (the caller's principal on the tick and the close,
 *  REC-152) and `by` (who records a verification). */
export function aiRunsOps(runs, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    airunopen: () => runs.open({ ...(body || {}), principalPlane: q("principal"), actor: q("actor"), viewer: q("viewer") }),
    airuntick: () => runs.tickAndContinue({ ...(body || {}), actor: q("actor"), viewer: q("viewer"), caller: q("principal") }),
    airunclose: () => runs.close({ ...(body || {}), actor: q("actor"), viewer: q("viewer"), caller: q("principal") }),
    airun: () => runs.read({ run: q("run"), viewer: q("viewer") }),
    airunlog: () => runs.log({ run: q("run"), viewer: q("viewer"), limit: q("limit") }),
    /* REC-69: the CONTEXT-keyed read, beside the run-id-keyed ones; a caller that could name the viewer could read the
       runs of a project it was never invited to. */
    airuns: () => runs.listInContext({ contextType: q("contextType"), contextId: q("contextId"), viewer: q("viewer"),
                                       limit: q("limit") }),
    airunspawn: () => runs.spawnPayload({ run: q("run"), half: q("half"), viewer: q("viewer") }),
    /* K1606 (run-rules R19): the verification act, `by` the stamp. */
    airunverify: () => runs.verificationRecord({ ...(body || {}), by: q("by") }),
  };
}

/* R90 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  airunopen: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("ai-runs.declared.airunopen", "investigative run lifecycle, keyed by run id: starts a background session in the context of an inquiry or a project and changes NOTHING about that object (§14a)"),
    fields: { accepts: ["run","contextType","contextId","label","mode","principalClaude","principalClaudeRef","skillVersion","biasManifest","standardPair","bounds","state","leaseMs","at","rerunOf","plan","step","origin","place","work","response","project"], requires: ["run","contextType","contextId","principalClaude","skillVersion"] } },
  airunclose: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("ai-runs.declared.airunclose", "investigative run lifecycle, keyed by run id: ends a run and names the bound that stopped it (§14b.6); what the run PROPOSED is a separate act with its own author"),
    fields: { accepts: ["run","bound","condition","at"], requires: ["run","bound"] } },
});
