/* agent-harness (T33-54): copied from `agent-worker/src/harness.mjs` with no change of meaning; its requirements are
 * `build/requirements/agent-harness.md` R1–R10, tested in `agent-harness/test/`. The suites this header names
 * (`test/harness.test.mjs` and the like) are agent-worker's, which drive the Worker shell. R3's default pass limit
 * (`passLimit`) is held here since this copy. The run's plane ops and its namespaces (`PLANE_OPS`, `NAMESPACES`) are
 * `agent-worker`'s, declared once in its `ops.mjs`; its meaning arm (`MEANING_ARM`) is `agent-steps`', declared in its
 * `names.mjs`; this module exports none of them (R9, T34-37). */
/* FL-3 / IS-9 — THE RUN HARNESS, AS A DETERMINISTIC CONTROL FLOW TABLE.
 *
 * `INVESTIGATIVE-SESSION.md` §14b.4 is the whole item in one sentence: *"do not
 * let the model decide control flow that should be guaranteed. Loops, fan-out
 * and gates are deterministic; judgement happens inside a step."* And §14b.4's
 * evidential case is measured rather than stylistic — TREC 2011 found searchers
 * estimating their own recall erred by up to +95/-87 points and terminated
 * review prematurely on a false belief of high recall, so **the model never
 * decides when the loop stops.**
 *
 * SO THIS FILE IS A TABLE AND NOT A NARRATIVE, AND THAT DISTINCTION IS THE
 * ITEM. What the harness does next must be a ROW A SUITE CAN DRIVE, not a
 * sentence a model reads. Everything below is therefore:
 *
 *   - PURE. No fetch, no clock, no storage, no `globalThis`. `queuestate.mjs`'s
 *     recorded reason, one Worker over: "a rule that can only be exercised
 *     through a Durable Object is a rule that gets exercised less." The whole
 *     table can be walked in a plain node process with no miniflare at all, and
 *     `test/harness.test.mjs` walks it BOTH ways — pure, and through `POST /run`
 *     inside workerd — because a table proven only through the op is a table
 *     nobody can exhaust, and one proven only in the pure harness is a table
 *     nobody has run.
 *   - DATA. `CONTROL_FLOW` is an object of rows, each declaring the steps it may
 *     go `to`. `nextStep` may not return a step outside its row's `to` set, and
 *     the suite asserts that over an exhaustive state walk rather than trusting
 *     it. A table whose implementation can leave a row illegally is decoration.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PLAN ROW REQUIRES THIS TABLE TO CARRY, AND WHERE EACH ONE IS
 * ---------------------------------------------------------------------------
 *
 *   pass count and loop termination ....... `next-pass`, and `stopBecause` above
 *                                           every row — the model supplies no
 *                                           input to either
 *   four-level fan-out .................... `fanout`, over LEVELS, all four, in
 *                                           a fixed order, one sub-session each
 *   dedup-before-write .................... `dedup`, and there is NO EDGE from
 *                                           `compose` to `submit`. The ordering
 *                                           is the table's shape, not a rule a
 *                                           step remembers
 *   log-always ............................ every row carries `logs: true`, and
 *                                           `stepLog` builds the entry. §14b.6:
 *                                           the log is written whether or not
 *                                           the run succeeds
 *   denied-means-adjust (F10) ............. `submit --refused--> adjust`, and
 *                                           `adjust` may only RESEND a CHANGED
 *                                           submission; a drop goes on to the
 *                                           rest of the queue (D-452). See the
 *                                           F10 block below — this is the row
 *                                           the item is named for
 *   query-never-load ...................... `agent-worker`'s `PLANE_OPS` (its
 *                                           `ops.mjs`, R9 here). The meaning-
 *                                           grain read is PL-9's `op=meaningrows`
 *                                           and this item CONSUMES it; no op in
 *                                           the set returns document bytes
 *   versions as formed, never batched ..... `submit` takes ONE candidate off the
 *                                           head of the queue. There is no
 *                                           submit-all and no batch shape to
 *                                           write one
 *   budget: fetches, sub-sessions, wall ... BUDGET_BOUNDS, spent through the
 *                                           plane's own `op=airuntick` so the
 *                                           record's producer writes the
 *                                           condition — never a second producer
 *                                           here
 *
 * ---------------------------------------------------------------------------
 * F10 — DENIED MEANS ADJUST, AND WHY THE BUDGET IS NOT THE MECHANISM
 * ---------------------------------------------------------------------------
 *
 * PL-3 built F10's plane side: a verbatim resubmit is keyed on the canonical
 * submission BYTE FOR BYTE plus the inquiry's `bundle_sha`, returns the stored
 * refusal WITHOUT re-running the six checks, and climbs a `repeats` counter.
 * That counter is what makes a retry loop visible to something other than the
 * budget — and this table is the thing that must make it stay at ZERO on a
 * well-behaved run.
 *
 * So a refusal does not route back to `submit`. It routes to `adjust`, and
 * `adjust` is a row with a PRECONDITION the code enforces: the submission it
 * hands back must differ from the one that was refused. `adjustedFrom` compares
 * the two canonically; if the judgement supplied no change, the candidate is
 * DROPPED rather than resent. A run that cannot adjust has learned something,
 * and sending the same bytes again would learn nothing while costing a write
 * path and a counter.
 *
 * **THE BUDGET IS THE BACKSTOP, NOT THE MECHANISM.** A design in which the only
 * thing stopping a retry loop is the budget running out is a design that pays
 * full price for the loop before noticing it, and — worse — reports the budget
 * as the reason a run stopped when the real reason was that it never adjusted.
 * `stopBecause` would then name `fetches` on a run whose actual fault was F10.
 *
 * ---------------------------------------------------------------------------
 * THE INVESTIGATE-MODE GATE IS A ROW IN THIS TABLE (SK-4)
 * ---------------------------------------------------------------------------
 *
 * §2: CHECK is the first deployed mode — the same session run against an
 * EXISTING conclusion, the record read adversarially, aimed at self-directed
 * overclaiming. Smallest authorisation surface, clearest ground truth. The
 * investigate-fresh mode enables only after CHECK's first live run is verified
 * (VF-5), and SK-4 RECORDS that sequencing rather than enforcing it.
 *
 * **WHICH IS EXACTLY WHY THE GATE IS HERE AND NOT IN THE SKILL.** A gate in a
 * prompt is the defect §14b.4 names. `gate-mode` is the FIRST row every run
 * takes, it reads a flag the caller cannot set from inside a judgement, and a
 * run in a mode that is not deployed terminates on `mode-not-deployed` before
 * it has spent anything.
 *
 * **THAT SENTENCE WAS FALSE WHEN IT WAS WRITTEN AND IS TRUE NOW — FL-7,
 * 2026-08-10, IC-62.** From FL-3 until FL-7 this header named
 * `mode-not-deployed` while the `gate-mode` branch of `nextStep`, far below in
 * this same file, closed on `cancelled` — and `mode-not-deployed` existed
 * NOWHERE ELSE IN THE REPOSITORY:
 * not in the plane's `RUN_ENDINGS`, not in its `RUN_BOUNDS`, only here. So the
 * header described a value that did not exist while the code produced one that
 * said "a member stopped it" about a run no member touched. SK-4 measured both
 * halves and delegated the call; FL-7 closed it by ADDING the ending the header
 * had already named, rather than by editing this sentence down to match the
 * defect — the disagreement was the symptom and the misattribution was the bug.
 *
 * **AND THE AGREEMENT IS ASSERTED, which is the half that stops it
 * recurring.** `test/harness.test.mjs` A6b drives the gate over every input it
 * refuses and holds what it PRODUCES to the plane's catalogue, `run-rules`'
 * exported RUN_ENDINGS: every ending it closes on must exist there, and every
 * refused launch closes on the one ending, `mode-not-deployed` (N421 moved this
 * from a comparison with this header's text to the gate's behaviour). The
 * catalogue is the plane's export, never a literal copied into the arm, because
 * an expectation derived from the subject moves with it and proves nothing
 * (three items shipped exactly that on 2026-08-10).
 * ========================================================================= */

import { levelEmptyHolds } from "../../bio-plane/src/run-rules/index.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/* THE FOUR LEVELS, IN FAN-OUT ORDER.
 *
 * CLAUDE.md's standing section: when anything goes looking it "may need to
 * search meaning, content, documents, AND the open internet, in any order", and
 * "sparse is the normal condition at every level" — absence at one level is not
 * evidence of absence at the next.
 *
 * THIS IS A COPY OF THE PLANE'S `OBSERVATION_LEVELS` AND IT IS PINNED RATHER
 * THAN IMPORTED, which is a decision and not laziness. Importing
 * `../../bio-plane/src/run-rules/index.mjs` would drag the plane's module graph into this
 * Worker's bundle — the fleet's whole point is that a member ships alone — and
 * the plane publishes no op that names the levels, so there is nothing to read
 * at runtime. What closes the drift is a PIN: the suites import run-rules'
 * `OBSERVATION_LEVELS` and assert this array is exactly its key order (R44).
 * A fifth level added there fails this member's suite
 * rather than silently going unsearched, which is the failure a hand-kept copy
 * normally has and the reason D-113's purge list is this project's stock
 * example. */
export const LEVELS = ["meaning", "content", "document", "internet"];

/* THE SAME FOUR LEVELS IN THE SPELLING A `level-empty` SUGGESTION IS WRITTEN
 * IN — and the two vocabularies DISAGREE ON ONE MEMBER, which is D-323's
 * headline one field over.
 *
 * A run writes its observation log in `OBSERVATION_LEVELS`' spelling (`LEVELS`
 * above, singular `document`) and writes §9's empty-level suggestion in
 * `SUGGEST_LEVELS`' spelling (plural `documents`). The plane already knows this
 * and already publishes the bridge — `reportsAs()` in `src/skilldoctrine.mjs`,
 * whose own comment says *"the two disagree on one member"* — and
 * `emptyLevelCandidates` was not calling it or reproducing it. So the candidate
 * for the DOCUMENT level carried `level: "document"`, which is not one of
 * `SUGGEST_LEVELS`, and a deployed plane refuses it
 * `SUGGEST_EMPTY_LEVEL_UNSTATED` / C-27.11 — a DIFFERENT refusal from the one
 * D-323 was filed on, at a DIFFERENT check, several screens earlier. MEASURED
 * before it was fixed, by driving the composed candidate through the plane's own
 * `SUGGEST_LEVELS` (2026-09-13, D-323; VF-4's live run only ever exercised the
 * `meaning` and `content` levels, so it could not have seen this).
 *
 * PINNED, NOT IMPORTED, for exactly `LEVELS`' reason above: the fleet's whole
 * point is that a member ships alone, and importing the plane's module graph
 * would defeat it. `wire-vocabulary.test.mjs` reads `SUGGEST_LEVELS` and
 * `reportsAs` out of the plane's own files and asserts this map is TOTAL over
 * `LEVELS`, that every value is one the plane holds, and that the pairing is the
 * one `reportsAs` produces — floor and ceiling both. A fifth level, or a
 * renamed one, fails this member's suite rather than being refused live. */
export const REPORTING_LEVEL = Object.freeze({
  meaning: "meaning", content: "content", document: "documents", internet: "internet",
});

/* THE MODES (§2/§10), and WHICH ARE DEPLOYED: `check` and `plan` (R10, T46).
 *
 * `check` is DEC-24's CHECK role and it deploys first. `investigate` is the
 * fresh-investigation mode and it is NOT deployed: `deployed: false` here is the
 * gate `gate-mode` reads, and VF-5's verification of CHECK's first live run is
 * what flips it. Flipping it is an EDIT TO THIS FILE under review — which is the
 * point, because a mode that could be enabled by a request parameter would be a
 * gate the caller holds. */
export const MODES = {
  check:       { deployed: true,
                 does: localize("agent-harness.harness.mode_check_does", "read an EXISTING conclusion adversarially (DEC-24's CHECK role, §2)") },
  investigate: { deployed: false,
                 does: localize("agent-harness.harness.mode_investigate_does", "investigate fresh — enabled only after CHECK's first live run is verified (VF-5/SK-4)") },
  /* THE EXTRACT ROW, landed 2026-09-14 on SK-8's DELEGATION and NOT deployed.
     SK-8 built the plane half — `op=extractpropose` inside DEC-62's run, under
     the `mints` bound — and measured that nothing could DRIVE such a run,
     because this gate refused the word as unknown. The row's existence is what
     lets the refusal say "not deployed yet" instead of "no such mode", which
     are different facts. `deployed: false` is the honest state and it costs
     nothing: §7.3 point 7 leaves "may a project stand an EXTRACT run
     unattended" OPEN under a provisional NO, and a deployed extract mode is the
     first thing that question would bite on. Flipping this flag is a separate
     act — an EDIT here under review, never a request parameter — and it is not
     the act that added the row. */
  extract:     { deployed: false,
                 does: localize("agent-harness.harness.mode_extract_does", "propose citable passages and readings over a SUBJECT a member named, under the run's `mints` bound, never attesting — §7.3 of docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md; not yet deployed, and a standing EXTRACT run is provisionally NO (§7.3 point 7)") },
  /* R10 (T46; N919; Bob's, K2892): THE PLANNING SKILL, DEPLOYED. It walks its own table (`PLAN_FLOW`, R6) and proposes
     options to one action plan through `op=optionpropose`, never deciding anything (`BIO_Action_v0_1.md` §4). It is
     deployed by the one reviewed change that also sets `run-rules`' `DEPLOYED_MODES` (its R14) and `agent-worker`'s
     copy (its R53), never by model turns running; this copy must agree with run-rules', and the suite holds it to that.
     The flag marks served code and lifts no bar: an open in mode `plan` is still admitted only through `run-rules` R29. */
  plan:        { deployed: true,
                 does: localize("agent-harness.harness.mode_plan_does", "propose options to one action plan, strongest first, through op=optionpropose; it decides, starts, prepares and sends nothing (BIO_Action_v0_1.md §4)") },
};

/* §14b.6's budget, in the plane's OWN bound names (run-rules'
   RUN_BOUNDS). Three of the five are the run harness's to SPEND — the design's
   own enumeration, "fetches requested, sub-sessions spawned, wall time across
   resumptions". `lease` is the plane's heartbeat and `runtime` is the ceiling
   the platform imposes; neither is something this table decides to consume, and
   both are named here as NOT OURS so a later reader does not add a consumer for
   them by analogy.

   `runtime` IS SPENT BY THIS HARNESS AND IS DELIBERATELY NOT IN THE SET ABOVE,
   and the distinction is the one §14b.6 draws. The three bounds in
   `BUDGET_BOUNDS` are the DESIGN'S — "fetches requested, sub-sessions spawned,
   wall time across resumptions" — and `stopBecause` reads them, because the
   table has to know it is out of budget before it takes another step. `runtime`
   is the PLATFORM'S ceiling (D-54, D-56 — CPU and subrequests), which no table
   can see coming: the driver spends one unit per plane call it makes and the
   PLANE decides when that is exhausted, at its own one exit.

   §14b.6: *"the record already has the word and lacks the writer —
   `runtime-ceiling-reached` exists in the condition vocabulary with NO producer
   (`queuestate.mjs:82`) — IS-9(d) builds that producer rather than minting a new
   kind."* THIS ITEM IS IS-9(d) AND THIS IS WHERE IT DISCHARGES THAT: PL-5 wired
   the condition at `store.mjs #aiRunTerminate` (`condition: hit === "runtime" ?
   "runtime-ceiling-reached" : null`) and recorded in run-rules that the
   PRODUCER — the thing that actually consumes the bound — was not its own. The
   producer is the driver's per-call spend through `op=airuntick`.

   NOTHING HERE EMITS THE CONDITION ITSELF. A second producer of the word inside
   a fleet member would be a copy of the plane's rule — the drift class DEC-8
   closed, and fleet rule 2 besides. The harness SPENDS; the plane WRITES. That
   is why the acceptance reads "a budget exhaustion WRITES
   `runtime-ceiling-reached`" and not "the harness emits it". */
export const BUDGET_BOUNDS = ["fetches", "subsessions", "wallclock"];
export const SPENT_NOT_WATCHED = {
  runtime: "the platform's CPU/subrequest ceiling (D-54, D-56). Spent one unit per plane call; "
         + "the PLANE decides when it is exhausted and writes `runtime-ceiling-reached` at its own exit",
};
export const NOT_OUR_BOUNDS = {
  lease: "the plane's heartbeat — a run that stopped heartbeating DIED rather than finished, and only "
       + "something outside the run can observe that (PL-5's `ai-run-reap` consumer)",
};

/* ---------------------------------------------------------------- THE TABLE
 *
 * `to` is the COMPLETE set of steps a row may move to, and `nextStep` is held to
 * it. `judged` names what the MODEL decides inside the step — every row that
 * carries one is a row where judgement happens, and every row that does not is a
 * row where nothing is up to the model. Read the two columns together and the
 * §14b.4 table is visible as data: what is scripted, and what is judged. */
export const CONTROL_FLOW = {
  "gate-mode": {
    does:   localize("agent-harness.harness.sk_4s_gate_refuse_a", "SK-4's gate: refuse a mode that is not deployed, before anything is spent"),
    judged: null,
    logs:   true,
    to:     ["resume", "close"],
  },
  resume: {
    does:   "§14b.7 — read this run's OWN log and continue from it rather than restarting",
    judged: null,
    logs:   true,
    /* R11, N153: a run whose last tick published its state continues at the step that state names, so every
       row after the gate is an edge from here; a run with none starts its pass at `plan`. */
    to:     ["plan", "fanout", "collect", "compose", "dedup", "submit", "adjust", "next-pass", "close"],
  },
  plan: {
    does:   "open a pass: the pass counter is the TABLE's and the search targets are the model's",
    judged: "what to search for",
    logs:   true,
    to:     ["fanout", "close"],
  },
  fanout: {
    does:   "spawn ONE sub-session per level, all four, in LEVELS order",
    judged: null,
    logs:   true,
    to:     ["collect", "close"],
  },
  collect: {
    /* FL-5 / IS-9(a). The sub-session's return arrives HERE and is judged against
       the REPORT contract before anything downstream can read it: a REPORT with a
       citation, never documents, and the parent re-reads by address. The contract
       itself is `subsession.mjs`, kept out of this table for the reason the table
       exists — what the run does NEXT is a row, and what a return may CONTAIN is a
       shape; putting the second inside the first would make neither exhaustible.

       `judged` MOVED FROM null TO A JUDGEMENT AT FL-5, AND THAT IS A CORRECTION
       RATHER THAN AN ADDITION. Before FL-5 the reports entered at `compose`, one
       row too late: `compose` is where reports are INTERPRETED, so a return that
       arrived there had already been read by the step that forms versions from it,
       and the contract would have been enforced (if at all) after the harm. The
       returns now arrive at the row that collects them and are validated there. */
    does:   "take each sub-session's REPORT and hold it to the return contract "
          + "(a citation, never documents — §14b.1); re-read each citation BY ADDRESS",
    judged: "what each sub-session's REPORT says",
    logs:   true,
    to:     ["compose", "close"],
  },
  compose: {
    does:   "form candidate versions from the reports",
    judged: "what each level's reports mean, and what the version says",
    logs:   true,
    /* NO EDGE TO `submit`. Dedup is not a rule a step remembers to apply; it is
       the shape of the table, and this absent edge IS the enforcement. */
    to:     ["dedup", "close"],
  },
  dedup: {
    does:   "compare every candidate against the versions already on the record, BEFORE any write",
    judged: "whether this reading differs in substance",
    logs:   true,
    to:     ["submit", "next-pass", "close"],
  },
  submit: {
    does:   "write ONE candidate through PL-3's endpoint, as formed — never a batch",
    judged: null,
    logs:   true,
    /* THE F10 EDGE. A refusal goes to `adjust` and NOWHERE ELSE — there is no
       edge from `submit` back to `submit`, so a verbatim retry is not a path
       this table has. */
    to:     ["submit", "adjust", "next-pass", "close"],
  },
  adjust: {
    does:   "F10 — carry the plane's refusal back into the submission and CHANGE it, or drop the candidate",
    judged: "how to answer the refusal",
    logs:   true,
    to:     ["submit", "next-pass", "close"],
  },
  "next-pass": {
    does:   "the pass counter and the loop's termination — neither is the model's to decide",
    judged: null,
    logs:   true,
    to:     ["plan", "close"],
  },
  close: {
    does:   "the one exit, naming the bound (C-22.5). Terminal",
    judged: null,
    logs:   true,
    to:     [],
  },
};

export const FIRST_STEP = "gate-mode";

/** FL-11 (INVESTIGATIVE-SESSION.md §11 item 5, RULE 1'S TARGET, BOB #28) — THE QUESTION A RUN'S
 *  READINGS LAND ON, TAKEN FROM THE RUN'S OWN CONTEXT AND NEVER FROM THE CALLER.
 *
 *  The plane refuses a suggestion outside its run's context (`SUGGEST_OUTSIDE_RUN_CONTEXT`, C-27.19,
 *  REC-165): the context itself, or, for a run over a PROJECT, a question that project confirmed-cites.
 *  Until FL-11 this member never set `state.target` at all, so every table-made level-empty candidate
 *  went out `target: null` and was refused `SUGGEST_NO_TARGET`, and `dedup` read `op=basisversions`
 *  under `id=""` — a comparison against no question, written down as a comparison.
 *
 *  A RUN OVER A QUESTION: the target IS the context id — the only question inside the context.
 *
 *  A RUN OVER A PROJECT: NEVER the project id (a project is not an inquiry, and the plane refuses it
 *  `SUGGEST_NOT_AN_INQUIRY`). Its readings land on a question the project CONFIRMED-cites. D-451: the run
 *  read now PUBLISHES that set as `context.questions` (`aiRunRead` / `#runContextQuestions`: the confirmed-
 *  cited inquiries this caller can see, the set `op=suggest` admits). This member takes it as published and
 *  does NOT re-derive `#citesInto` from a project's bytes — a second implementation of the one live-cites
 *  predicate is the drift REC-19 removed. EXACTLY ONE question is the target. SEVERAL are left to the
 *  candidate — this member does not pick one of several — and NONE, or a plane that publishes no set, is
 *  UNDETERMINED and STATED: a candidate then carries its own target, which the plane bounds, and a
 *  table-made candidate with none is refused by the plane in its own words. `basis` says which of these is
 *  true, so the run's output never implies a target it does not hold. */
export function runContextTarget(session) {
  const ctx = session && typeof session === "object" ? session.context : null;
  const type = ctx && typeof ctx.type === "string" ? ctx.type : null;
  const id = ctx && ctx.id != null && String(ctx.id).trim() !== "" ? String(ctx.id).trim() : null;
  if (!id) return { target: null, basis: localize("agent-harness.harness.undetermined_the_run_read_published", "UNDETERMINED: the run read published no context id") };
  if (type === "project") {
    if (!Array.isArray(ctx.questions))
      return { target: null,
               basis: localize("agent-harness.harness.undetermined_a_run_over_a_project", "UNDETERMINED: a run over a project lands on a question the project confirmed-cites, and the run read does not publish that set; a candidate names its own target, never the project id") };
    const qs = [...new Set(ctx.questions.filter((q) => typeof q === "string" && q.trim() !== "")
                                        .map((q) => q.trim()))];
    if (qs.length === 1) return { target: qs[0], basis: localize("agent-harness.harness.the_one_question_the_runs", "the one question the run's project confirmed-cites") };
    if (qs.length === 0)
      return { target: null,
               basis: localize("agent-harness.harness.undetermined_the_runs_project_confirms_no", "UNDETERMINED: the run's project confirmed-cites no question this run can see; a candidate names its own target, never the project id") };
    return { target: null,
             basis: localize("agent-harness.harness.undetermined_the_runs_project_confirmed", "UNDETERMINED: the run's project confirmed-cites {length} questions and this member does not pick one of several; a candidate names its own target, never the project id", { length: String(qs.length) }) };
  }
  if (type === "inquiry") return { target: id, basis: localize("agent-harness.harness.the_runs_context_question", "the run's context question") };
  return { target: null, basis: localize("agent-harness.harness.undetermined_the_runs_context_kind", "UNDETERMINED: the run's context kind {stringify} is not one this member reads", { stringify: String(JSON.stringify(type)) }) };
}

/** §9's EMPTY-LEVEL KIND, DERIVED BY THE TABLE AND NEVER BY THE MODEL.
 *
 *  THE OWED CONTROL THIS EXISTS FOR (VF-1's seventh, the objective's own): feed
 *  a run an inquiry the evidence does not support and it must propose NOTHING
 *  and still EMIT something — *"an empty run and a silent failure
 *  distinguishable"*. §15's empty-run instrument needs an object to count, and
 *  §9 is explicit that without this kind *"a run that honestly found nothing
 *  supportable is indistinguishable from a run that emitted nothing"*.
 *
 *  SO THIS IS DETERMINISTIC AND IT HAS TO BE. If emitting the empty-level kind
 *  were the model's judgement, the one case the instrument exists to catch — a
 *  run that found nothing and said nothing — would be the case where the
 *  judgement is least likely to fire. The MODEL says what it observed at a
 *  level; the TABLE decides that an observed absence is written down.
 *
 *  D-129 IS WHY ONLY `LOOKED_ABSENT` QUALIFIES. `NEVER_LOOKED` is not an
 *  absence, `LOOKED_INDETERMINATE` is "we asked and could not tell", and
 *  `partial` got some of it. Only one of the five is the claim *"we looked at
 *  this level and it is empty"*, and PL-3 refuses the kind without the level AND
 *  the observation-log address that establishes it (`SUGGEST_EMPTY_LEVEL_UNSTATED`).
 *  Absence at one level is not evidence of absence at the next, so one candidate
 *  per empty level and never one for the run. */
export function emptyLevelCandidates(state, target) {
  const reports = Array.isArray(state?.reports) ? state.reports : [];
  const unscoped = new Set(levelsWithoutScope(state).map((x) => x.level));
  const out = [];
  for (const level of LEVELS) {
    const r = reports.find((x) => x && x.level === level);
    if (!r || r.state !== "LOOKED_ABSENT" || unscoped.has(level)) continue;
    const reported = REPORTING_LEVEL[level];
    out.push({
      kind: "level-empty",
      target: target ?? null,
      /* THE PLANE'S SPELLING, NOT THE LOG'S — see `REPORTING_LEVEL` above. */
      level: reported,
      /* THE ADDRESS OF THE SEARCH THAT ESTABLISHES IT. The report carries where
         in the observation log it was written; a level-empty with no address is
         the one shape a later reader cannot check, and PL-3 refuses it. */
      observed_at: r.observed_at ?? null,
      /* D-323 — THE SEPARATOR IS A DASH, AND IT WAS A COLON UNTIL 2026-09-13.
         `VERSION_NAME_RE` is `/^[a-z0-9][a-z0-9 ._-]{0,63}$/i` and has NO COLON
         in it, so `level-empty:<level>` — the name THIS FUNCTION mints, the
         object §15's empty-run instrument exists to count — was refused by every
         deployed plane, `BASIS_REFUSED` / C-25.2, `wrote: false`. Measured live
         at 0.57.0 by VF-4 (MEASUREMENTS M-8) and re-measured here against the
         grammar itself. So VF-1's owed control 7 could not be true of a real
         run: the honest empty-handed run was indistinguishable from exactly the
         silent failure the kind exists to rule out.
         THE OTHER FIX WAS AVAILABLE AND ITS COST IS WHY IT WAS DECLINED. Widening
         `VERSION_NAME_RE` to admit `:` would have made this name legal without
         touching this line — every name legal today still passes, so nothing
         breaks — but it LOOSENS A PUBLISHED GRAMMAR on the record's own
         addresses, permanently, for one instrument's convenience, and it does it
         in the one character this project already spends on IDENTITY
         (`token:admin`, `class:ai`, `log:11`): a reading could then be NAMED
         like a principal. It is also an I3 wire change owing an IC. Against
         that, the separator costs one line here plus the suites that pinned the
         old spelling — and NOTHING ELSE, because the colon form has never once
         been written: no record anywhere holds it, so there is no migration and
         no reader to break. A grammar is widened when the record needs the
         character, never when one caller mints one the record refuses. */
      name: `level-empty-${reported}`,
      /* D-323's THIRD HALF — `description` IS NOT A FIELD A REPORT HAS.
         This line read `r.description ?? null`, and `checkReport` REFUSES any
         report carrying `description`: `REPORT_KEYS` is an EXACT key set —
         `level, state, observed_at, summary, citations, governed, condition` —
         and everything absent from it is refused BY NAME. So on every
         contract-honouring report this read `undefined`, every empty-level
         candidate carried `description: null`, and PL-3 refused all four of them
         `SUGGEST_BOILERPLATE` / C-27.12. VF-4 recorded this as a report-shape
         finding (*"a report carrying only summary"*); it is unconditional, and
         driving the contract is what showed that.
         COMPOSED RATHER THAN REFUSED, and the argument is §9's own. The kind is
         derived by the TABLE and never by the model precisely because the one
         case the instrument exists to catch — a run that found nothing and said
         nothing — is the case a judgement is least likely to fire on. A harness
         that refused loudly here would emit NOTHING whenever the model omitted a
         prose field, which reinstates that silence one field lower down. So the
         table composes the description too, out of what the table KNOWS: which
         level, and where the search that establishes it is written. That is an
         honest account of what changed and why — §6 rule 1's standard — and it
         overclaims nothing, because every word of it is a fact the report
         carried. R14 (R085-29; K3528): the model's own `summary` is NOT appended. It is free prose written from
         `read_facts`, which holds raw record ids, and it reached the member verbatim; the report and its words stay
         in the run's log, which this description points to. */
      /* R13 (R085-23; K3510): the description names the question as "this question", never its record id. The id
         is the plane's to show with the question, and a raw id here reached the reader verbatim (`question.mjs`). */
      description: localize("agent-harness.harness.this_run_searched_the_reported", "this run searched the {reported} level of this question and found nothing supportable there; the search that establishes it is written in the run's observation log at {String}.", { reported: String(reported), String: String(String(r.observed_at ?? "(no address)")) }),
    });
  }
  return out;
}

/** R18 (T50; N1169; `run-rules` R35): the levels that reported `LOOKED_ABSENT` over a scope with no document in it, each
 *  as `{level, holds: false, code, check, translation}`, `run-rules`' answer. `state.scope` is `{<level>: {reads,
 *  documents}}`, set by the shell from the plane's four-level statement of each read (`retrieval` R13) and never from
 *  a report's words or a judgement: a level with no read, or whose `documents` is below 1, was not looked at, so no
 *  absence is written for it (`emptyLevelCandidates` composes none). A level absent from `scope` has no read. Pure. */
export function levelsWithoutScope(state) {
  const reports = list(state?.reports);
  const scope = record(state?.scope) || {};
  const out = [];
  for (const level of LEVELS) {
    const r = reports.find((x) => x && x.level === level);
    if (!r || r.state !== "LOOKED_ABSENT") continue;
    const read = record(scope[level]);
    const answer = levelEmptyHolds({ scope: read && Number(read.reads) >= 1 ? read : {} });
    if (answer !== true) out.push({ level, ...answer });
  }
  return out;
}

/* Canonical bytes for a submission, so "did the adjust actually change
   anything" is answered the same way PL-3 answers "is this a verbatim
   resubmit": by the BYTES, in a stable key order, and never by a hash. PL-1's
   reasoning transplanted — a hand-rolled synchronous hash would put a collision
   argument underneath the mechanism that decides whether a caller is told the
   truth about its own submission. */
export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

/** Did `adjust` actually adjust? F10's precondition, as a function so the table
 *  and the suite ask it the same way. */
export function adjustedFrom(before, after) {
  return canonical(before ?? null) !== canonical(after ?? null);
}

/* A budget row the table can read whatever shape the plane handed back. Absent
   is NOT zero: an unknown allowance must not read as an exhausted one, because
   that would stop a run and name a bound that never bit. */
const allowance = (budget, bound) => {
  const row = (budget || {})[bound];
  if (!row) return null;
  const allowed = Number(row.allowed);
  const consumed = Number(row.consumed) || 0;
  if (!Number.isFinite(allowed) || allowed <= 0) return null;
  return { allowed, consumed };
};

/** WHICH BOUND HAS STOPPED THIS RUN — or null, meaning carry on.
 *
 *  Checked ABOVE every row, so there is no step from which the table can
 *  continue past an exhausted budget. Deterministic in its ORDER too: the bounds
 *  are asked in `BUDGET_BOUNDS` order so two runs in the same state name the
 *  same bound, which is what lets a suite pin the answer. */
export function stopBecause(state) {
  const s = state || {};
  for (const bound of BUDGET_BOUNDS) {
    const row = allowance(s.budget, bound);
    if (row && row.consumed >= row.allowed) return bound;
  }
  /* LOOP TERMINATION, AND IT IS THE TABLE'S. §14b.4 and TREC 2011: the model
     never decides when the loop stops. `maxPasses` arrives with the run and is
     not reachable from any judgement — `applyJudgement` refuses to set it, and
     the suite drives that arm. */
  if (Number(s.pass) >= passLimit(s.maxPasses)) return "completed";
  return null;
}

/* R3 (was agent-worker R15): the pass limit is the run's `max_passes` when positive, else 3. Held here since T33-54
   so the table answers it alone; the shell (agent-worker) passes the run's figure through unchanged. */
export const DEFAULT_MAX_PASSES = 3;

/** The pass limit for a run's `max_passes`: the figure when it is a positive number, else `DEFAULT_MAX_PASSES`. */
export function passLimit(maxPasses) {
  const n = Number(maxPasses);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PASSES;
}

/** THE GATE, the first row of either table (R2): a mode that is not deployed closes `mode-not-deployed` before any
 *  bound is consulted; a deployed one goes on to `resume`. Pure. */
export function gateStep(state) {
  const s = state || {};
  /* A mode that is not deployed must not even be able to report that it ran out of budget. */
  const key = String(s.mode || "");
  const mode = MODES[key];
  if (!mode || !mode.deployed) {
    /* `mode-not-deployed`, NOT `cancelled`, AND THE CHANGE IS FL-7 (2026-08-10,
       IC-62) CORRECTING A MISATTRIBUTION THIS LINE USED TO MAKE. This branch
       closed on `cancelled` from FL-3 until FL-7 — and the plane defines
       `cancelled` as "a member stopped it", which is FALSE of every run that
       reaches this line: the gate refused a launch, nobody asked, and nothing
       had been spent. The ending now names the machine that actually acted.
       The word is the plane's (run-rules' RUN_ENDINGS) and is
       NOT minted here — a fleet member inventing an ending would be the
       drift class DEC-8 closed.

       THE SENTENCE IS DERIVED FROM THE TABLE SINCE 2026-09-14 (SK-8's
       delegation), because the hand-written two-mode story it replaced would
       have gone stale on the third row and every row after. Two absences are
       two facts and both are stated: a mode this table KNOWS and has not
       deployed says "not deployed yet" and names what it does; a word this
       table does not hold says so. The bound is the same for both — no run
       was started either way — and only the reason differs. */
    const deployed = Object.entries(MODES).filter(([, m]) => m.deployed).map(([k]) => k);
    const waiting = Object.entries(MODES).filter(([, m]) => !m.deployed).map(([k]) => k);
    const which = !mode
      ? localize("agent-harness.harness.mode_v1_is_not_deployed", "mode '{v1}' is not deployed — it is no mode this table knows at all (the table holds: {keys})", { v1: String(key || "(none)"), keys: String(Object.keys(MODES).join(", ")) })
      : localize("agent-harness.harness.mode_key_is_not_deployed", "mode '{key}' is not deployed yet — it is a row in this table ({does}), and enabling it is an EDIT to this file under review, never a request parameter", { key: String(key), does: String(mode.does) });
    return { step: "close", bound: "mode-not-deployed",
             why: localize("agent-harness.harness.which_check_is_the_first", "{which}. CHECK is the first deployed mode (§2); deployed now: {deployed}; not yet: {waiting}. investigate-fresh enables only after CHECK's first live run is verified (VF-5/SK-4). This gate is a row in the control-flow table and never a sentence in the skill.", { which: String(which), deployed: String(deployed.join(", ")), waiting: String(waiting.join(", ")) }) };
  }
  return { step: "resume", why: localize("agent-harness.harness.the_mode_is_deployed_read_this", "the mode is deployed; read this run's own log before doing anything else") };
}

/** THE TABLE, AS A FUNCTION. Pure: same state in, same step out, every time.
 *
 *  Returns `{ step, why }`. `why` is a sentence for the observation log, so the
 *  log says WHERE it stopped and WHY in the table's own words rather than in a
 *  model's — §11's whole argument for the log existing. */
export function nextStep(state) {
  return nothingWrittenGuard(state || {}, tableStep(state));
}

/* R16 (R085; S4 N4; K3557): A RUN THAT COMPOSED A CANDIDATE AND WROTE NONE NEVER CLOSES `completed`. The counts are the
   table's own (`advance` keeps them): `kept` is the candidates that survived dedup and went to be written (those
   dropped there as already held are on the record, so they are not lost), `wrote` the writes that succeeded; the shell's
   `written` list is honoured too. With no `kept` the figure falls to `composed`. */
export const NOTHING_WRITTEN = "nothing-written";
const countOf = (v) => (Array.isArray(v) ? v.length : Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

/** The sentence a close states when a run composed candidates and wrote none, else null. Pure. */
function nothingWrittenReason(state) {
  const s = state || {};
  const composed = countOf(s.composed);
  const kept = s.kept === undefined || s.kept === null ? composed : countOf(s.kept);
  if (kept <= 0 || Math.max(countOf(s.wrote), countOf(s.written)) > 0) return null;
  const refused = s.refusal ? localize("agent-harness.harness.the_plane_refused_code", " (the plane refused '{code}')", { code: String(s.refusal.code || s.refusal.reason || "?") }) : "";
  return localize("agent-harness.harness.nothing_written_composed_candidate_s", "nothing written: {composed} candidate(s) composed, {kept} sent to be written, none written{v1}", { composed: String(composed), kept: String(kept), v1: refused });
}

function nothingWrittenGuard(s, decision) {
  if (decision.step !== "close" || decision.bound !== "completed") return decision;
  const reason = nothingWrittenReason(s);
  return reason ? { ...decision, bound: NOTHING_WRITTEN, reason, why: `${decision.why}; ${reason}` } : decision;
}

function tableStep(state) {
  const s = state || {};
  const at = String(s.step || FIRST_STEP);
  const row = CONTROL_FLOW[at];
  if (!row) return { step: "close", why: localize("agent-harness.harness.at_is_not_a_row", "'{at}' is not a row in this table", { at: String(at) }), bound: "completed" };

  /* THE GATE FIRST, and before any bound is consulted (`gateStep`). */
  if (at === "gate-mode") return gateStep(s);

  /* AND THE BOUNDS ABOVE EVERY OTHER ROW. */
  const stopped = stopBecause(s);
  if (stopped && at !== "close")
    return { step: "close", bound: stopped,
             why: stopped === "completed"
               ? localize("agent-harness.harness.pass_of_passlimit_passes_are", "{pass} of {passLimit} passes are done; the loop's termination is the table's and not the model's", { pass: String(s.pass), passLimit: String(passLimit(s.maxPasses)) })
               : localize("agent-harness.harness.the_stopped_budget_is_spent", "the '{stopped}' budget is spent. §14b.6: when a bound stops a run, the log says WHICH bound and where", { stopped: String(stopped) }) };

  switch (at) {
    case "resume":
      /* R11, N153: the published state names where the last segment stopped, and the table continues there. */
      if (typeof s.resumeAt === "string" && CONTROL_FLOW.resume.to.includes(s.resumeAt))
        return { step: s.resumeAt,
                 why: localize("agent-harness.harness.this_runs_last_tick_published", "this run's last tick published its state at '{resumeAt}' with {v1} pass(es) done, and its log carries {v2} observation(s); continuing rather than restarting (§14b.7)", { resumeAt: String(s.resumeAt), v1: String(Number(s.pass) || 0), v2: String(Number(s.resumedFrom) || 0) }) };
      return { step: "plan",
               why: (s.resumedFrom > 0
                 ? localize("agent-harness.harness.this_runs_log_carries_observations", "this run's log carries {resumedFrom} observation(s); continuing rather than restarting (§14b.7)", { resumedFrom: String(s.resumedFrom) })
                 : localize("agent-harness.harness.this_runs_log_is_empty", "this run's log is empty; starting the first pass"))
                  + (s.resumeBasis ? `. ${s.resumeBasis}` : "") };

    case "plan":
      return { step: "fanout", why: localize("agent-harness.harness.pass_v1_fan_out_across", "pass {v1}: fan out across all {length} levels", { v1: String(Number(s.pass) + 1), length: String(LEVELS.length) }) };

    case "fanout":
      return { step: "collect", why: localize("agent-harness.harness.length_sub_sessions_spawned_one", "{length} sub-sessions spawned, one per level, in LEVELS order", { length: String(LEVELS.length) }) };

    case "collect": {
      /* THE SENTENCE NAMES BOTH NUMBERS, AND BEFORE FL-5 IT NAMED NEITHER. It
         read "no documents were returned", which was a claim the run had no way
         to have checked — exactly the shape §14b.4 calls a fence in a prose. What
         it can honestly say is how many returns HONOURED the contract and how many
         were REFUSED, because `subsession.mjs` decided each one. A refused return
         is not an absence and never becomes one: the level it came from is
         UNDETERMINED and stays stated. */
      const refused = (s.reportsRefused || []).length;
      return { step: "compose",
               why: localize("agent-harness.harness.length_report_s_honoured_the", "{length} REPORT(s) honoured the return contract{v1}", { length: String((s.reports || []).length), v1: refused
                      ? localize("agent-harness.harness.return_s_refused_a_sub", "; {refused} return(s) REFUSED — a sub-session that returns documents has defeated the architecture, and those levels are UNDETERMINED, not empty", { refused: String(refused) })
                      : localize("agent-harness.harness.none_refused", "; none refused") }) };
    }

    case "compose":
      /* THE ONLY EDGE OUT, and it is dedup. Even with nothing composed the run
         goes through `dedup` — a candidate list of zero is a real answer and
         §9's `level-empty` kind is written from it, so short-circuiting here
         would skip the row that produces the empty-run instrument's object. */
      return { step: "dedup", why: localize("agent-harness.harness.length_candidate_s_composed_nothing", "{length} candidate(s) composed; nothing may be written before dedup", { length: String((s.candidates || []).length) }) };

    case "dedup": {
      const queue = s.queue || [];
      if (!queue.length)
        return { step: "next-pass", why: localize("agent-harness.harness.no_candidate_differs_in_substance", "no candidate differs in substance from what the record already holds") };
      return { step: "submit", why: localize("agent-harness.harness.length_candidate_s_survived_dedup", "{length} candidate(s) survived dedup; they are written ONE AT A TIME, as formed", { length: String(queue.length) }) };
    }

    case "submit": {
      /* A REFUSAL ROUTES TO `adjust`. Never back here. */
      if (s.refusal) return { step: "adjust", why: localize("agent-harness.harness.the_plane_refused_string_f10", "the plane refused '{String}'; F10 routes a refusal to an ADJUST step, never to a verbatim retry", { String: String(String(s.refusal.code || s.refusal.reason || "?")) }) };
      const queue = s.queue || [];
      if (queue.length) return { step: "submit", why: localize("agent-harness.harness.length_candidate_s_still_to", "{length} candidate(s) still to write, one at a time", { length: String(queue.length) }) };
      return { step: "next-pass", why: localize("agent-harness.harness.every_candidate_this_pass_formed", "every candidate this pass formed has been written or dropped") };
    }

    case "adjust": {
      /* F10's PRECONDITION, enforced rather than trusted. A DROP DROPS ONE CANDIDATE, NOT THE PASS
         (D-452, 2026-09-24). This branch went to `next-pass` whatever was queued behind the dropped
         candidate, so one unanswerable refusal swallowed every candidate after it — the table-made
         level-empty ones included, which is §9's instrument silently not written. The dropped
         candidate is already off the queue (`submit` shifted it and `adjust` re-queues only a CHANGED
         submission), so going to `submit` here writes the REST and cannot resend it. */
      const queue = s.queue || [];
      if (!s.adjusted && queue.length)
        return { step: "submit",
                 why: localize("agent-harness.harness.the_refusal_could_not_be", "the refusal could not be answered by changing the submission, so the candidate is DROPPED and never resent (that would climb PL-3's `repeats` counter); {length} candidate(s) behind it in this pass are still written, one at a time", { length: String(queue.length) }) };
      if (!s.adjusted)
        return { step: "next-pass",
                 why: localize("agent-harness.harness.the_refusal_could_not_be_2", "the refusal could not be answered by changing the submission, so the candidate is DROPPED. Resending the same bytes would return the stored refusal without re-evaluation and climb PL-3's `repeats` counter, which is the loop F10 exists to make visible") };
      return { step: "submit", why: localize("agent-harness.harness.the_submission_was_adjusted", "the submission was ADJUSTED and differs from the one that was refused") };
    }

    case "next-pass":
      /* R15 (R085-29; K3529): a pass that submitted no new candidate (every one it composed was dropped by dedup as
         already held, or it composed none) closes the run: a further pass would search the same ground. */
      if (s.passAdded !== true)
        return { step: "close", bound: "completed",
                 why: localize("agent-harness.harness.pass_pass_added_no_new", "pass {pass} added no new candidate (each one composed was already held, or none was composed); a further pass would find nothing the record does not hold, so the run closes", { pass: String(s.pass) }) };
      return { step: "plan", why: localize("agent-harness.harness.pass_pass_done_the_table", "pass {pass} done; the table decides there is another", { pass: String(s.pass) }) };

    case "close":
      return { step: "close", why: "terminal", bound: s.bound || "completed" };

    /* No default: every row is named above, and a row added to CONTROL_FLOW
       without a case here falls to the unreachable return below, which the
       suite drives as its own arm. */
  }
  return { step: "close", why: localize("agent-harness.harness.at_has_no_transition", "'{at}' has no transition", { at: String(at) }), bound: "completed" };
}

/** THE MOVE FROM ONE ROW TO THE NEXT, as the driver applies it. Pure. `adjust` alone carries the refusal and the
 *  bytes that earned it; every other move clears them, so a stale refusal cannot route a later step into an adjust
 *  it did not earn. The pass counter moves on ENTERING `next-pass`: a pass counts when it is done (R3). */
export function advance(state, decision) {
  const s = state || {};
  const to = String((decision && decision.step) || "close");
  /* R19: the pairs the step just stated are settled once leaving `compose`, the named list spent with them. */
  const settled = s.step === "compose"
    ? { disagreed: [...list(s.disagreed), ...disagreementsToSettle(s).map(disagreementKey)], disagreements: [] } : {};
  if (to === "close") return { ...s, ...settled, step: "close" };
  const next = to === "adjust"
    ? { ...s, step: "adjust", refusedSubmission: s.submission ?? null, adjusted: false }
    : { ...s, step: to, refusal: null, adjusted: false, refusedSubmission: null };
  Object.assign(next, settled);
  /* The resume point is spent once `resume` has moved on from it. */
  if (s.step === "resume") { next.resumeAt = null; next.resumeBasis = null; }
  /* R15: a candidate surviving dedup goes to `submit`, so this pass adds one; the next pass starts with none. */
  if (s.step === "dedup" && to === "submit") next.passAdded = true;
  /* R16: the counts a close is judged by. */
  if (s.step === "compose") next.composed = countOf(s.composed) + (s.candidates || []).length;
  if (s.step === "dedup") next.kept = countOf(s.kept) + (s.queue || []).length;
  if (s.step === "submit" && to !== "adjust" && s.submission && !s.refusal) next.wrote = countOf(s.wrote) + 1;
  if (s.step === "next-pass" && to === "plan") next.passAdded = false;
  return to === "next-pass" ? { ...next, pass: (Number(next.pass) || 0) + 1 } : next;
}

/* ---------------------------------------------------- R11, N153: THE RESUMABLE STATE
 *
 * The run's `state` is its resumable scratch (ai-runs R12 stores what a tick hands it, R19 publishes it on
 * `op=airun`). This member writes the TABLE's own part of it on every tick after `resume` — the step it moves to
 * and the pass it is in, and what that step works from — so a later segment continues where this one stopped.
 *
 * WHAT IS NOT IN IT, AND WHY. The mode, the target, the pass limit and the budget are the RECORD's and are read
 * from the run on every segment; a copy here would be a second answer that ages, and one a published state could
 * then override. The model's transcript is not in it (DEC-61: never a transcript), nor are the spawn contracts,
 * which each `fanout` composes afresh from the plane's payload. */
export const RESUMABLE = ["step", "pass", "targets", "reports", "reportsRefused", "rereads", "holdings",
                          "candidates", "queue", "submission", "refusal", "refusedSubmission", "adjusted", "passAdded",
                          "composed", "kept", "wrote", "scope", "disagreed"];

/** The scratch a tick publishes: the table's own fields, nothing else. */
export function resumableState(state) {
  const s = state || {};
  const out = {};
  for (const k of RESUMABLE) out[k] = s[k] === undefined ? null : s[k];
  return out;
}

/* ---------------------------------------------------- R49, N293: THE STATE STAYS UNDER THE PLANE'S CEILING
 *
 * ai-runs R45 holds a run's `state` to `AI_RUN_STATE_MAX_BYTES`, measured as the UTF-8 length of its JSON, and refuses
 * a tick carrying more with nothing written: no entry, no spend, no lease. The table's working fields (reports,
 * holdings, candidates, the queue) come from judgements and can grow past it, so the state is measured before it is
 * published, the way the plane measures it.
 *
 * WHAT IS PUBLISHED WHEN IT DOES NOT FIT: the same pass, restarted. The smallest state that still resumes truthfully
 * is the pass count at `plan`, every working field null (`next-pass` and `close` keep their own step: neither works
 * from those fields). A later segment then fans out again rather than resuming from a state the record refuses; what
 * was already written stays written, and `dedup` keeps it from being written twice. A partial cut of the working
 * fields is not published: which half of a queue or a report list survived would be this member's guess. */
export const STATE_RESTART_STEPS = ["next-pass", "close"];

/** The UTF-8 length of a state's JSON: ai-runs R45's measure. */
export function stateBytes(state) {
  return new TextEncoder().encode(JSON.stringify(state ?? null)).length;
}

/** `{ state, bytes, restarted }`: the state a tick may publish under `limit`. With no positive limit (the plane
 *  publishes none), the state as it is. `restarted` is null when it fits, else `{ bytes, limit, at }`: the measured
 *  size of the state that did not fit and the step the published one restarts at. */
export function publishableState(state, limit, flow = CONTROL_FLOW) {
  const full = resumableState(state);
  const bytes = stateBytes(full);
  const ceiling = Number(limit);
  if (!(Number.isFinite(ceiling) && ceiling > 0) || bytes <= ceiling) return { state: full, bytes, restarted: null };
  /* `PLAN_FLOW`'s pass restarts at `read` (R6), `CONTROL_FLOW`'s at `plan`. */
  const at = flow === PLAN_FLOW ? (full.step === "close" ? "close" : "read")
    : (STATE_RESTART_STEPS.includes(full.step) ? full.step : "plan");
  const restart = resumableState({ step: at, pass: full.pass, adjusted: false, passAdded: full.passAdded,
    composed: full.composed, kept: full.kept, wrote: full.wrote, scope: full.scope,
    disagreed: full.disagreed });
  return { state: restart, bytes: stateBytes(restart), restarted: { bytes, limit: ceiling, at } };
}

const list = (v) => (Array.isArray(v) ? v : []);
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/** The steps a published state may name for a table to continue from: `resume`'s edges, and for `PLAN_FLOW` also
 *  `compose`, whose reads a state does not carry, so it continues by reading again (R6). */
export const resumeTargets = (flow = CONTROL_FLOW) =>
  (flow === PLAN_FLOW ? [...PLAN_FLOW.resume.to, "compose"] : CONTROL_FLOW.resume.to);

/** What a segment continues from: `{ at, state, basis }`. `at` is the step the published state names, when it is a
 *  row `resume` may move to, with the state's table fields; otherwise `at` is null and `basis` says why the run
 *  starts its pass at `plan`: no state published (null, or the empty scratch a run opens with), or one naming no
 *  step this table continues at. */
export function resumeFrom(published, flow = CONTROL_FLOW) {
  const p = record(published);
  if (!p || !Object.prototype.hasOwnProperty.call(p, "step") || p.step == null)
    return { at: null, state: null,
             basis: published == null
               ? localize("agent-harness.harness.the_run_publishes_no_state", "The run publishes no state it can be read back from, so this segment starts from the resume row")
               : localize("agent-harness.harness.the_runs_published_state_names", "The run's published state names no step yet, so this segment starts from the resume row") };
  const at = String(p.step);
  const pass = Number(p.pass);
  if (!resumeTargets(flow).includes(at) || !Number.isInteger(pass) || pass < 0)
    return { at: null, state: null,
             basis: localize("agent-harness.harness.undetermined_the_runs_published_state", "UNDETERMINED: the run's published state names step {stringify} at pass {stringify_2}, which is not a place this table continues from, so this segment starts the pass over rather than guess where the last one stopped", { stringify: String(JSON.stringify(at).slice(0, 60)), stringify_2: String(JSON.stringify(p.pass ?? null).slice(0, 20)) }) };
  return { at, basis: null, state: {
    pass, targets: list(p.targets), reports: list(p.reports), reportsRefused: list(p.reportsRefused),
    rereads: Number(p.rereads) > 0 ? Number(p.rereads) : 0, holdings: record(p.holdings),
    candidates: list(p.candidates), queue: list(p.queue), submission: record(p.submission),
    refusal: record(p.refusal), refusedSubmission: record(p.refusedSubmission), adjusted: p.adjusted === true,
    passAdded: p.passAdded === true, composed: countOf(p.composed), kept: countOf(p.kept), wrote: countOf(p.wrote),
    scope: record(p.scope), disagreed: list(p.disagreed),
  } };
}

/* ------------------------------------------------------- WHAT A STEP LOGS
 *
 * LOG-ALWAYS (§14b.6): the observation log is written whether or not the run
 * succeeds, and its whole value is the failure path — which is why §11 forbids
 * it from living in `bundle.md`, written only on success.
 *
 * The entry is built in the PLANE'S OWN vocabulary and validated by the PLANE's
 * own `checkObservation` (C-22.1 to C-22.6): D-129's absence states, D-104's
 * governed split, the condition vocabulary. Nothing here decides whether an
 * entry is legal — this member composes it and the plane refuses it if it is
 * not, which is the same division as every other fence in this Worker. */
/* REC-100 / IC-130 — A MODEL-JUDGED `PRESENT` IS NOT RECORDED AS `PRESENT`,
 * because this entry has nothing to point at, and the record now refuses a
 * `PRESENT` that names nothing (C-22.10, whose `run` carve-out REC-100 deleted
 * under BOB #14's ruling, D-366).
 *
 * `OBSERVATION-LOG-DESIGN.md` §4.4 gives this caller exactly two options: supply
 * the referent of what the model judged PRESENT (the capture or content it
 * found), or do not record PRESENT. THE FIRST IS NOT AVAILABLE HONESTLY, and why
 * is the decision:
 *   - This entry is a CONTROL-FLOW entry (`subject` is the transition). The
 *     model's `observed` is a JUDGEMENT; nothing in `JUDGEABLE` carries what was
 *     found, and adding a field for it would take a capture sha from the MODEL —
 *     which the plane does not verify for any authority, so it would be a
 *     referent that costs nothing to produce: invented to get past the gate.
 *   - An `observation` referent (a PRESENT row of this run, which the plane DOES
 *     verify) is the ROLLUP's form. Picking "the latest PRESENT row" here would be
 *     this member asserting the model's judgement rests on a row it never named —
 *     an association nobody made, and the same invention one level up.
 * So the SECOND option, and the state is `LOOKED_INDETERMINATE`, not
 * `NEVER_LOOKED`: something DID look (the model says so), and what the RECORD can
 * establish from it is that it cannot tell — the weaker, true claim. The model's
 * own word is kept verbatim in `detail`, prefixed so no reader mistakes the
 * state for the judgement, and the run's output COUNTS every such entry
 * (`present_unbacked`) so the downgrade is visible rather than silent. When a
 * look that can carry a referent exists (a sub-session's capture), it is the
 * PLANE's writers that record it with one — the capture drain already does. */
export const PRESENT_UNBACKED_NOTE = localize("agent-harness.harness.the_model_judged_present_at",
  "the model judged PRESENT at this step, but this entry can name nothing that was found, and the record refuses a PRESENT that names nothing (C-22.10) — so it is recorded as LOOKED_INDETERMINATE: a look happened, and the record cannot tell from it that the thing is there");

export function stepLog(state, decision) {
  const s = state || {};
  const d = decision || {};
  /* R26, K148 — A STEP THAT LOOKED AT NOTHING WRITES NO ENTRY. This entry used to default to `NEVER_LOOKED`, and
     the record refuses that state from every member entry (observation-log R3: NEVER_LOOKED is the absence of a
     row, never a row) and refuses an absent state too. So a control-flow entry carries the look its step's
     judgement states, or the step sends none; the transition itself stays in the run's `trace`. */
  if (!s.observed || s.observed === "NEVER_LOOKED") return null;
  const judgedPresent = s.observed === "PRESENT";
  const why = String(d.why || "");
  return {
    level:   s.level || null,
    subject: `${String(s.step || FIRST_STEP)} -> ${String(d.step || "?")}`,
    /* D-129's states are different claims — EXCEPT `PRESENT`, which this entry cannot back (see the note above
       `PRESENT_UNBACKED_NOTE`). */
    state:   judgedPresent ? "LOOKED_INDETERMINATE" : s.observed,
    governed: s.governed === true,
    condition: s.condition || null,
    terminal: d.step === "close",
    bound:    d.step === "close" ? (d.bound || null) : null,
    detail:  (judgedPresent ? `${PRESENT_UNBACKED_NOTE}. ${why}` : why).slice(0, 500),
  };
}

/* -------------------------------------------- WHAT A JUDGEMENT MAY NOT TOUCH
 *
 * The model's judgement enters the table through THIS function and no other
 * route, and the fields it may set are an exact set. Everything the plan row
 * calls deterministic is absent from it: `pass`, `maxPasses`, `step`, `budget`,
 * `mode`, `bound`. A judgement naming one of them is REFUSED and named — not
 * ignored, because a caller told its input was dropped learns nothing.
 *
 * THIS IS THE CODE HALF OF SK-2's REVIEW CRITERION. SK-2's negative control is
 * "a skill edit that moves loop termination into model judgement → FL-3's
 * deterministic-table review criterion fails the change". That criterion is not
 * a review habit: it is this refusal, and the suite drives it by handing a
 * judgement that tries to set `maxPasses`. */
export const JUDGEABLE = ["targets", "reports", "candidates", "queue", "adjusted", "submission",
                          "level", "observed", "governed", "condition", "disagreements"];
/* FL-11: `target` joins them. The question a run's readings land on is the run's CONTEXT (`runContextTarget`),
   the record's and never the model's; a judgement naming it was silently dropped before, which told the caller
   nothing. A candidate still names its own target — that is the candidate's field, and the plane bounds it. */
export const NOT_JUDGEABLE = ["pass", "maxPasses", "step", "budget", "mode", "bound", "run", "store", "target"];

/* R19 (T50; N1187; K3557; amends R4): THE DISAGREEMENTS A JUDGEMENT NAMES. A list of at most `DISAGREEMENTS_MAX`
   `{record, levels}`, `record` a non-empty id and `levels` two different members of `LEVELS`, nothing else on a pair
   (a free-text key would reach the member's statement). Applied at `compose` only. */
export const DISAGREEMENTS_MAX = 10;

const isPair = (p) => {
  const x = record(p);
  return !!x && Object.keys(x).every((k) => k === "record" || k === "levels")
    && typeof x.record === "string" && x.record.trim() !== ""
    && Array.isArray(x.levels) && x.levels.length === 2 && x.levels.every((l) => LEVELS.includes(l)) && x.levels[0] !== x.levels[1];
};

/** The keys of a malformed `disagreements` value, as `applyJudgement` names them. */
function badDisagreements(v) {
  if (!Array.isArray(v)) return ["disagreements"];
  const bad = v.slice(DISAGREEMENTS_MAX).map((_, i) => `disagreements[${DISAGREEMENTS_MAX + i}]`);
  v.slice(0, DISAGREEMENTS_MAX).forEach((p, i) => {
    if (isPair(p)) return;
    const x = record(p);
    if (!x) { bad.push(`disagreements[${i}]`); return; }
    for (const k of Object.keys(x)) if (k !== "record" && k !== "levels") bad.push(`disagreements[${i}].${k}`);
    if (!(typeof x.record === "string" && x.record.trim() !== "")) bad.push(`disagreements[${i}].record`);
    if (!(Array.isArray(x.levels) && x.levels.length === 2 && x.levels.every((l) => LEVELS.includes(l)) && x.levels[0] !== x.levels[1]))
      bad.push(`disagreements[${i}].levels`);
  });
  return bad;
}

/** A pair's identity: its record and its two levels, whichever order they were named in. */
export const disagreementKey = (p) => canonical([p.record, ...[...p.levels].sort()]);

/** R19: the named pairs not yet settled: those of `state.disagreements` whose key is not in `state.disagreed`, each
 *  once, in order, while the run's settled pairs stay at most `DISAGREEMENTS_MAX`. `advance` adds them to `disagreed`
 *  when the step leaves `compose`. A pair adds no candidate, changes no `passAdded` and opens no pass. Pure. */
export function disagreementsToSettle(state) {
  const held = new Set(list(state?.disagreed));
  const out = [];
  for (const p of list(state?.disagreements)) {
    if (held.size + out.length >= DISAGREEMENTS_MAX) break;
    if (!isPair(p)) continue;
    const key = disagreementKey(p);
    if (held.has(key) || out.some((q) => disagreementKey(q) === key)) continue;
    out.push({ record: p.record, levels: [...p.levels] });
  }
  return out;
}

export function applyJudgement(state, judgement) {
  const j = judgement && typeof judgement === "object" ? judgement : {};
  const overreach = Object.keys(j).filter((k) => NOT_JUDGEABLE.includes(k));
  if (overreach.length)
    return { ok: false, overreach,
             detail: localize("agent-harness.harness.a_judgement_may_not_set", "a judgement may not set {overreach}. Loop bounds, the pass counter, the budget, the mode and the step are the TABLE's and never the model's (§14b.4). The evidential case is measured: TREC 2011 found searchers erring by up to +95/-87 points on their own recall and stopping early on a false belief of high coverage.", { overreach: String(overreach.join(", ")) }) };
  /* R19: a malformed list is refused by key, at any step; a well-formed one is applied at `compose` only. */
  if (Object.prototype.hasOwnProperty.call(j, "disagreements")) {
    const bad = badDisagreements(j.disagreements);
    if (bad.length)
      return { ok: false, overreach: bad,
               detail: localize("agent-harness.harness.a_judgements_disagreements_are_at", "a judgement's disagreements are at most {DISAGREEMENTS_MAX} pairs, each a record id and two different levels of {LEVELS} and nothing else; {bad} breaks that.", { DISAGREEMENTS_MAX: String(DISAGREEMENTS_MAX), LEVELS: String(LEVELS.join(", ")), bad: String(bad.join(", ")) }) };
  }
  const next = { ...state };
  for (const k of JUDGEABLE) {
    if (!Object.prototype.hasOwnProperty.call(j, k)) continue;
    if (k === "disagreements") {
      if (String((state || {}).step || "") === "compose")
        next.disagreements = j.disagreements.map((p) => ({ record: p.record, levels: [...p.levels] }));
    } else next[k] = j[k];
  }
  return { ok: true, state: next };
}

/* ================================================================ MODE `plan` (R50–R53; K660)
 *
 * THE PLANNING SKILL WALKS ITS OWN TABLE, held beside `CONTROL_FLOW` and pure like it (`BIO_Action_v0_1.md` §4 rules
 * 1, 3, 8). One pass over one action plan: read what the record holds about the plan's matters, compose proposals
 * strongest first, drop those the plan already holds, and submit them one at a time through `op=optionpropose`. There
 * is no `fanout`: a plan-mode run spawns no sub-session, requests no capture, writes no version and fetches nothing;
 * its only writes are `optionpropose`, `airuntick` and `airunclose` (R53). It decides nothing: a proposal becomes an
 * option only when a member adopts it (`action-plans` R11, R33).
 *
 * THE ORDER IS THE ONLY SIGN OF STRENGTH (R52). The model answers its candidates strongest first; the table keeps that
 * order to the plane (one submission at a time, a resent candidate keeping its place), so the order the plane stores
 * the run's proposals in is the assistant's order of strength. No candidate carries a score, a rank figure or a
 * strength: `OPTION_KEYS` is an exact key set and a candidate carrying any other key is refused by name. */
export const PLAN_FLOW = {
  "gate-mode": {
    does:   "the same gate: refuse a mode that is not deployed, before anything is spent",
    judged: null,
    logs:   true,
    to:     ["resume", "close"],
  },
  resume: {
    does:   "§14b.7 — continue where the last segment's published state stopped; the reads are made again",
    judged: null,
    logs:   true,
    to:     ["read", "dedup", "submit", "adjust", "close"],
  },
  read: {
    does:   "read, under the run's credential only, the plan, the project's earlier plans and each subject's record (R51)",
    judged: null,
    logs:   true,
    to:     ["compose", "close"],
  },
  compose: {
    does:   "form candidate proposals from what was read, strongest first, each with only optionPropose's fields (R52)",
    judged: "which options to propose, in order of strength, and why",
    logs:   true,
    /* NO EDGE TO `submit`, for `CONTROL_FLOW`'s reason: dedup is the table's shape. */
    to:     ["dedup", "close"],
  },
  dedup: {
    does:   "drop a candidate the plan already holds as an option or a proposal, BEFORE any write (R52)",
    judged: null,
    logs:   true,
    to:     ["submit", "close"],
  },
  submit: {
    does:   "propose ONE candidate through op=optionpropose, in the order composed — never a batch",
    judged: null,
    logs:   true,
    to:     ["submit", "adjust", "close"],
  },
  adjust: {
    does:   "F10, unchanged (R25): change the refused proposal or drop it; a resent one keeps its place",
    judged: "how to answer the refusal",
    logs:   true,
    to:     ["submit", "close"],
  },
  close: {
    does:   "the one exit, naming the bound (C-22.5). Terminal",
    judged: null,
    logs:   true,
    to:     [],
  },
};

/** Which table a run walks: `PLAN_FLOW` for mode `plan`, `CONTROL_FLOW` for every other word (R6). */
export const flowFor = (mode) => (mode === "plan" ? PLAN_FLOW : CONTROL_FLOW);

/* R6: `stopBecause` asks `proposals` then `wallclock` for this table; `fetches` and `subsessions` are 0 on a plan-mode
   run (ai-runs R46) and never asked. R3's pass limit is 1: the one pass is done when its queue is. */
export const PLAN_BUDGET_BOUNDS = ["proposals", "wallclock"];
export const PLAN_MAX_PASSES = 1;

export function planStopBecause(state) {
  const s = state || {};
  for (const bound of PLAN_BUDGET_BOUNDS) {
    const row = allowance(s.budget, bound);
    if (row && row.consumed >= row.allowed) return bound;
  }
  if (Number(s.pass) >= PLAN_MAX_PASSES) return "completed";
  return null;
}

/** `PLAN_FLOW` as a function, `nextStep`'s twin. Pure. */
export function nextPlanStep(state) {
  const s = state || {};
  const at = String(s.step || FIRST_STEP);
  if (!PLAN_FLOW[at]) return { step: "close", why: localize("agent-harness.harness.at_is_not_a_row_2", "'{at}' is not a row in this table", { at: String(at) }), bound: "completed" };
  if (at === "gate-mode") return gateStep(s);
  const stopped = planStopBecause(s);
  if (stopped && at !== "close")
    return { step: "close", bound: stopped,
             why: stopped === "completed"
               ? localize("agent-harness.harness.the_plans_one_pass_is_done", "the plan's one pass is done; the loop's termination is the table's and not the model's")
               : localize("agent-harness.harness.the_stopped_budget_is_spent_2", "the '{stopped}' budget is spent. §14b.6: when a bound stops a run, the log says WHICH bound and where", { stopped: String(stopped) }) };
  const done = (why) => ({ step: "close", bound: "completed", why, pass_done: true });
  const queue = s.queue || [];
  switch (at) {
    case "resume":
      if (typeof s.resumeAt === "string" && ["dedup", "submit", "adjust"].includes(s.resumeAt))
        return { step: s.resumeAt,
                 why: localize("agent-harness.harness.this_runs_last_tick_published_2", "this run's last tick published its state at '{resumeAt}'; continuing rather than restarting (§14b.7)", { resumeAt: String(s.resumeAt) }) };
      return { step: "read",
               why: (s.resumeAt
                 ? localize("agent-harness.harness.this_runs_last_tick_published_3", "this run's last tick published its state at '{resumeAt}', which works from reads a state does not carry, so the reads are made again", { resumeAt: String(s.resumeAt) })
                 : localize("agent-harness.harness.starting_the_plans_one_pass", "starting the plan's one pass: read what the record holds"))
                  + (s.resumeBasis ? `. ${s.resumeBasis}` : "") };
    case "read":
      return { step: "compose", why: localize("agent-harness.harness.length_read_s_made_length", "{length} read(s) made, {length_2} UNDETERMINED", { length: String((s.reads || []).length), length_2: String((s.undetermined || []).length) }) };
    case "compose":
      return { step: "dedup", why: localize("agent-harness.harness.length_candidate_s_composed_strongest", "{length} candidate(s) composed, strongest first; nothing may be proposed before dedup", { length: String((s.candidates || []).length) }) };
    case "dedup":
      if (!queue.length) return done(localize("agent-harness.harness.no_candidate_differs_from_what_the_plan", "no candidate differs from what the plan already holds"));
      return { step: "submit", why: localize("agent-harness.harness.length_candidate_s_survived_dedup_2", "{length} candidate(s) survived dedup; they are proposed ONE AT A TIME, in order", { length: String(queue.length) }) };
    case "submit":
      if (s.refusal) return { step: "adjust", why: localize("agent-harness.harness.the_plane_refused_string_f10_2", "the plane refused '{String}'; F10 routes a refusal to an ADJUST step, never to a verbatim retry", { String: String(String(s.refusal.code || s.refusal.reason || "?")) }) };
      if (queue.length) return { step: "submit", why: localize("agent-harness.harness.length_candidate_s_still_to_2", "{length} candidate(s) still to propose, one at a time, in order", { length: String(queue.length) }) };
      return done(localize("agent-harness.harness.every_candidate_this_pass_composed", "every candidate this pass composed has been proposed or dropped"));
    case "adjust":
      if (s.adjusted) return { step: "submit", why: localize("agent-harness.harness.the_proposal_was_adjusted", "the proposal was ADJUSTED, differs from the refused one and keeps its place") };
      if (queue.length)
        return { step: "submit", why: localize("agent-harness.harness.the_refusal_could_not_be_3", "the refusal could not be answered by changing the proposal, so it is DROPPED and never resent; {length} candidate(s) behind it are still proposed, in order", { length: String(queue.length) }) };
      return done(localize("agent-harness.harness.the_refusal_could_not_be_none_remain", "the refusal could not be answered by changing the proposal, so it is DROPPED; none remain"));
    case "close":
      return { step: "close", why: "terminal", bound: s.bound || "completed" };
  }
  return { step: "close", why: localize("agent-harness.harness.at_has_no_transition_2", "'{at}' has no transition", { at: String(at) }), bound: "completed" };
}

/** The move, `advance`'s twin for `PLAN_FLOW`: the pass counts when it is done (a `completed` close from a work row). */
export function planAdvance(state, decision) {
  const next = advance(state, decision);
  return decision && decision.pass_done ? { ...next, pass: (Number(next.pass) || 0) + 1 } : next;
}

/* R52 — WHAT A PLAN-MODE JUDGEMENT MAY CARRY. The top-level keys per judged row, and the exact key set of one
   candidate: `optionPropose`'s fields (`action-plans` R9's option fields, `why`, `sources`) and nothing else. */
export const OPTION_KEYS = ["summary", "detail", "category", "subjects", "addressee", "dates", "tier", "enforces",
                            "lobbying", "why", "sources"];
export const PLAN_JUDGEABLE = { compose: ["candidates"], adjust: ["submission"] };

/** The one door a plan-mode judgement comes through (R16, R52). `{ok, state}` or `{ok: false, overreach, detail}`,
 *  naming every key it may not carry: a top-level key the row does not judge, and each candidate key outside
 *  `OPTION_KEYS` as `candidates[i].<key>` (a score, a rank or a strength among them). */
export function applyPlanJudgement(state, judgement) {
  const j = judgement && typeof judgement === "object" && !Array.isArray(judgement) ? judgement : {};
  const step = String((state || {}).step || "");
  const allowed = PLAN_JUDGEABLE[step] || [];
  const overreach = Object.keys(j).filter((k) => !allowed.includes(k));
  const shapes = [];
  if ("candidates" in j) {
    if (!Array.isArray(j.candidates)) shapes.push("candidates");
    else j.candidates.forEach((c, i) => {
      if (!c || typeof c !== "object" || Array.isArray(c)) { shapes.push(`candidates[${i}]`); return; }
      for (const k of Object.keys(c)) if (!OPTION_KEYS.includes(k)) overreach.push(`candidates[${i}].${k}`);
    });
  }
  if ("submission" in j && j.submission != null) {
    if (typeof j.submission !== "object" || Array.isArray(j.submission)) shapes.push("submission");
    else for (const k of Object.keys(j.submission)) if (!OPTION_KEYS.includes(k)) overreach.push(`submission.${k}`);
  }
  if (overreach.length || shapes.length)
    return { ok: false, overreach: [...overreach, ...shapes],
             detail: localize("agent-harness.harness.a_plan_mode_judgement_at", "a plan-mode judgement at '{step}' may carry only {v1}, and a proposal only {OPTION_KEYS} (optionPropose's fields). {v2} may not be set: the order of the candidates is the only sign of their strength, so no candidate carries a score, a rank or a strength, and the step, the pass, the budget and the plan are the table's.", { step: String(step), v1: String(allowed.join(", ") || "nothing"), OPTION_KEYS: String(OPTION_KEYS.join(", ")), v2: String([...overreach, ...shapes].join(", ")) }) };
  const next = { ...state };
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(j, k)) next[k] = j[k];
  if ("candidates" in j) next.candidates = j.candidates.map((c) => ({ ...c }));
  return { ok: true, state: next };
}

/** R52's duplicate: the canonical `{summary, category, subjects}`. */
export const proposalKey = (o) => canonical({ summary: o?.summary ?? null, category: o?.category ?? null,
                                               subjects: o?.subjects ?? null });

/** R52 — dedup, before any write: the candidates whose canonical `{summary, category, subjects}` equals no option or
 *  proposal on the plan, nor an earlier candidate, in their order. `plan` is `op=plan`'s answer (action-plans R6). */
export function planDedup(candidates, plan) {
  const p = plan && typeof plan === "object" ? plan : {};
  const pages = Array.isArray(p.planning_runs) ? p.planning_runs.flatMap((r) => list(r?.proposals)) : [];
  const held = new Set([...list(p.options), ...list(p.proposals), ...pages].filter((o) => o && typeof o === "object")
    .map(proposalKey));
  const queue = [], dropped = [];
  for (const c of list(candidates)) {
    const key = proposalKey(c);
    if (held.has(key)) { dropped.push(c); continue; }
    held.add(key);
    queue.push(c);
  }
  return { queue, dropped };
}

/* R51 — THE READS, AS DATA. What `read` asks the plane for: the run's plan, the earlier plans of its project, and per
   subject its record, each through the op the plane declares for it; once per run, the jurisdiction profiles. The op
   names are here and nowhere else, so a change the plane's declarations make is one line. */
export const PLAN_READS = {
  plan:    (planId) => ({ op: "plan", query: { id: planId } }),
  plans:   (project) => ({ op: "plans", query: { project } }),
  profile: () => ({ op: "profiles", query: {} }),
  subject: (subject) => {
    const s = subject && typeof subject === "object" ? subject : {};
    if (s.kind === "outcome")
      return [
        { op: "determination", query: { id: s.determination } },
        { op: "standard", query: { id: s.standard } },
        { op: "consequencesof", query: { determination: s.determination, standard: s.standard } },
        { op: "availableactions", query: { determination: s.determination } },
      ];
    if (s.kind === "inquiry")
      return [{ op: "publishededitions", query: { id: s.inquiry } },
              ...list(s.standards).map((id) => ({ op: "standard", query: { id } }))];
    return [];
  },
};

/** The profile view's three facts R51 names; an answer that does not carry one leaves it UNDETERMINED. */
export const PROFILE_FACTS = ["deadlines", "venues", "legal_organisations"];

/** R51 — the reads to make for a plan, in order, each once: the subjects' reads, then the profiles. */
export function planSubjectReads(plan) {
  const seen = new Set(), out = [];
  for (const subject of list(plan?.subjects)) {
    const inner = subject && typeof subject === "object" && subject.subject && typeof subject.subject === "object"
      ? subject.subject : subject;
    for (const r of PLAN_READS.subject(inner)) {
      const key = canonical(r);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  out.push(PLAN_READS.profile());
  return out;
}

/** R51 — the plans `op=plans` answered, kept to the SAME project and never the run's own plan. */
export function earlierPlans(answer, project, planId) {
  const items = list(answer?.plans ?? answer?.items);
  return items.filter((p) => p && typeof p === "object" && (p.project ?? project) === project
                             && String(p.id ?? p.plan ?? "") !== String(planId ?? ""));
}

export const WHY_MAX = 500;

/** R51 — a proposal's `why` carries every read that was refused or silent as UNDETERMINED, never as an absence: the
 *  table appends the sentence, and the model's own words are cut to fit the 500 characters `optionPropose` holds. */
export function whyWithUndetermined(why, undetermined) {
  const own = typeof why === "string" ? why.trim() : "";
  const u = list(undetermined);
  if (!u.length) return own.slice(0, WHY_MAX);
  const note = localize("agent-harness.harness.undetermined_not_absent_map", " UNDETERMINED, not absent: {map}.", { map: String(u.map((x) => `${x.op}${x.id ? ` ${x.id}` : ""} (${x.code ?? "no answer"})`)
    .join("; ")) });
  const tail = note.length > WHY_MAX ? note.slice(0, WHY_MAX) : note;
  const room = WHY_MAX - tail.length;
  const head = own.length > room ? `${own.slice(0, Math.max(0, room - 1))}…` : own;
  return `${head}${tail}`.trim().slice(0, WHY_MAX);
}
