/* run-rules (R1–R8, R10, R11, R13; the ai-runs split, K617, K649 (1)): copied from `src/airun.mjs` at the split;
 * `ai-runs`' T19 job deleted that file once its readers had re-pointed here, so this module is the one home of these
 * rules. What follows is that file's account, kept as provenance: "this file" in it is the account's own, now this one.
 *
 * IS-6 — THE INVESTIGATIVE RUN'S VOCABULARY AND ITS REFUSALS, kept PURE.
 *
 * `INVESTIGATIVE-SESSION.md` §11 (the run is an object), §14b.6 (a run is
 * bounded and the bound is RECORDED), §14b.7 (partial results survive). The
 * mechanism lives in `ai-runs/index.mjs`; this file holds the words and the decisions
 * that can be made without a database, for `queuestate.mjs`'s stated reason:
 *
 *   "It is PURE — no storage, no clock, no viewer — so a suite can hold the
 *    decision to the store's own behaviour directly … store.mjs cannot be
 *    imported outside workerd, and a rule that can only be exercised through a
 *    Durable Object is a rule that gets exercised less."
 *
 * ---------------------------------------------------------------------------
 * WHAT THE RUN OBJECT IS, AND WHAT IT IS NOT
 * ---------------------------------------------------------------------------
 *
 * §11 says the proven model is `capture_sessions` — *"SCRATCH, not record… a
 * work list with an expiry"*: ticks, an expiry, opaque state, resumable across
 * invocations. The run EXTENDS that shape rather than inventing one, and the
 * three additions are the ones §11 and §14b.6 name: the conditions the run was
 * formed under, the BOUNDS it carries with their live consumption, and the
 * OBSERVATION LOG.
 *
 * THREE OBJECTS ARE DELIBERATELY KEPT APART AND THE LINES ARE STATED HERE
 * BECAUSE THEY HAVE BEEN CONFLATED IN CONVERSATION:
 *
 *   1. THE RECORD — bundles, `bundle.md`, the published projection. Written on
 *      SUCCESS. A version the run proposes lands here through IS-1's write
 *      site, and nothing in this file writes it.
 *   2. THE OBSERVATION LOG — where the run searched across the four levels,
 *      what it found, where it STOPPED and why. It lives in `ai_run_log` in the
 *      instance's own Durable Object, it is APPEND-ONLY, and §11 is explicit
 *      that it "cannot live in bundle.md, which is written only on success —
 *      the log's whole value is the failure path". C-22.6 is the fence.
 *   3. THE TRANSCRIPT — the model's reasoning. DEC-61 (Bob, 2026-08-06):
 *      DEVICE-LOCAL, TTL'd, deleted as part of publication, NEVER in the record
 *      store. Nothing in this file, in `ai-runs` (once `store.mjs`'s), or in any
 *      table this item adds holds one. The observation log is NOT a transcript and is not
 *      governed by DEC-61: it is a structured account of where the search went,
 *      it carries no reasoning, and it is the thing that lets someone else
 *      CHECK the run — which is exactly why it is instance-side and durable
 *      while the reasoning is neither.
 *
 * ---------------------------------------------------------------------------
 * THE ACCEPTANCE, AND HOW IT IS A MECHANISM RATHER THAN AN INTENTION
 * ---------------------------------------------------------------------------
 *
 * §14b.6: *the log is written WHETHER OR NOT THE RUN SUCCEEDS, and it NAMES THE
 * BOUND THAT STOPPED IT.* A log that exists only when the run finished is a log
 * about the runs that did not need one.
 *
 * "The run writes its log on the way out" is an INTENTION, and it fails in the
 * one case that matters: a run that is killed does not run its own exit path.
 * So the terminal entry is NOT the run's to write. Two properties carry it:
 *
 *   (a) ONE TERMINATION FUNCTION. `#aiRunTerminate` (`ai-runs`, once `store.mjs`'s) is the only thing
 *       that can move a run out of `running`, and it appends the terminal log
 *       entry in the SAME transaction as the status change. There is no state
 *       in which a run is finished and its log is silent, because the two are
 *       one write. `finishedBound` below is the pure half of that decision, so
 *       the ordinary path and the reaped path compute the bound through ONE
 *       function rather than two that agree.
 *
 *   (b) A THIRD PARTY ON THE CLOCK. A killed run never calls anything. Its
 *       LEASE lapses, and the scheduler consumer `ai-run-reap` — ONE appended
 *       entry in the scheduler's consumers (`scheduler/index.mjs`; once
 *       `#schedConsumers`), per SCHEDULER.md, no second alarm and no
 *       cron — terminates it through the same (a). The run's death is therefore
 *       observed by something that is not the run. That is the whole guarantee:
 *       the log is not written because the run remembered, it is written
 *       because the only exit from `running` writes it, and something outside
 *       the run takes that exit when the run cannot.
 *
 * ---------------------------------------------------------------------------
 * D-129, AND WHY `partial` IS A FIFTH MEMBER RATHER THAN A FLAG
 * ---------------------------------------------------------------------------
 *
 * D-129 began as a two-value split (we do not know / there is positively none)
 * and was widened twice by the surveys in `STORE-AS-CACHE.md`: Software
 * Heritage stores crawl outcomes as DATA rather than inferring them from
 * missing rows, and RFC 2308 separates "does not exist" from "exists but not
 * this record" from "we asked and could not tell". The settled set is
 * `NEVER_LOOKED / LOOKED_ABSENT / LOOKED_INDETERMINATE / PRESENT`, plus SWH's
 * `partial`.
 *
 * `partial` is a member of the same enumeration and not a boolean beside it,
 * because the question every consumer asks is "what did this observation
 * establish", and that question has one answer. A flag would let an entry be
 * both PRESENT and partial, and CPDF-5's measured Tier-1-at-88% case is exactly
 * the reading that must NOT report as PRESENT.
 * ========================================================================= */

import { AI_RUN_CHECKS as OBSERVATION_LOG_AI_RUN_CHECKS } from "../observation-log/checks.mjs";
import { AI_RUNS_CHECKS } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* R11: one map — observation-log's C-22 rows (C-22.1–.4, .6, .9, .10, .17, read from that module since its T18 job holds
   them, no longer from the catalogue) and every row of this module's own table (`./checks.mjs`), the run's C-22 rows and
   the rows of ai-runs' acts. `translationOf` below reads a received code's translation from it. */
const AI_RUN_CHECKS = Object.freeze({ ...OBSERVATION_LOG_AI_RUN_CHECKS, ...AI_RUNS_CHECKS });

/* N49 (K78 (3)): THE OBSERVATION LOG'S VOCABULARY AND ITS CHECKS ARE observation-log's. They stood here (the four
   levels, D-129's states, coverage, the content axis, the missing-row causes and sidedness, the watermark, the three
   meaning-level writers' judgements, the derivation statement, the referent faults, `checkObservation` and
   `checkCondition`); observation-log wrote its copy at its extraction, and this file re-exports it so there is one
   copy to drift. `airun.mjs`, whose readers this kept whole, is deleted (ai-runs T19); the re-export stays for the
   readers that still take these names here (run-rules' Uses), `agent-worker`'s harness suite among them. */
export {
  ALL_MISSING_ROW_CAUSES,
  CONTENT_AXIS_STATES,
  CONTENT_AXIS_UNDETERMINED,
  CONTENT_EVIDENCE_IS_ONE_SIDED,
  DEFINITIVE_STATES,
  INTERNET_EVIDENCE_IS_ONE_SIDED,
  INTERNET_FRONTIER_EMPTY_CAUSES,
  MEANING_EVIDENCE_IS_ONE_SIDED,
  MEANING_MISSING_ROW_CAUSES,
  MISSING_ROW_CAUSES,
  OBSERVATION_ACTOR_CLASSES,
  OBSERVATION_AUTHORITY_KINDS,
  OBSERVATION_COVERAGE,
  OBSERVATION_COVERAGE_UNDETERMINED,
  OBSERVATION_LEVELS,
  OBSERVATION_REFERENT_FAULTS,
  OBSERVATION_STATES,
  OBSERVATION_SUBJECT_KINDS,
  WATERMARK_AFTER,
  WATERMARK_BAND_CAUSE,
  WATERMARK_BEFORE,
  WATERMARK_SECOND_MS,
  WATERMARK_WITHIN_BAND,
  causesNotRuledOut,
  checkCondition,
  checkObservation,
  contentAxisFor,
  contentObservationsFor,
  derivationDocumentsFrom,
  derivationObservation,
  derivationStatement,
  enteredAfterFirstRow,
  observationCoverage,
  observationReferentFault,
  readerRunObservation,
  resolutionObservation,
  watermarkUncertaintyMs
} from "../observation-log/vocabulary.mjs";

/* N138 (K82 (5), K181): the completeness statement's `searched` section (`searchedSection`, `SEARCHED_LEVEL_OUTCOMES`)
   and the `SEARCHED_SUBJECT_SOURCES` re-export stood here; `case-authoring` holds them (its `searched.mjs`, R17), and
   this file's copy is gone. */

/* §14b.6's bounds, in its own enumeration: "a budget — fetches requested,
   sub-sessions spawned, wall time across resumptions". `lease` is the fifth and
   it is OURS rather than the design's: it is the heartbeat whose lapse is how a
   killed run is noticed at all, and it is named as a bound because when it is
   what stopped a run, that is the true and only honest answer to "which bound".

   `runtime` is here and is NOT this item's producer. §14b.6 says the record
   already has the word and lacks the writer — `runtime-ceiling-reached` in
   `queuestate.mjs` with no producer — and names IS-9(d) as the item that builds
   it. IS-6 publishes the RECORD that names the bound; the queue-feed
   notification stays IS-9's, and nothing in this file or in `ai-runs` (once
   store.mjs) emits a queue item. */
export const RUN_BOUNDS = {
  fetches:     word("run-rules.fetches_requested_capture"),
  subsessions: word("run-rules.evidence_sub_sessions"),
  wallclock:   word("run-rules.wall_time_across"),
  runtime:     "CPU or subrequest ceiling (D-54, D-56) — IS-9(d) builds its producer",
  /* SK-8, AND IT IS A BOUND RATHER THAN A POLICY BECAUSE §7.3 (5) RULED IT ONE.
     *"A machine that may mint citable rows without a bound produces a store of
     proposals nobody cited — each correctly labelled, the whole unexamined"*,
     which is exactly the failure `INVESTIGATIVE-SESSION.md` §15 named for
     versions one layer up. So the EXTRACT role's productions are budgeted in the
     table the run already has: **no schema, no new vocabulary**, which was the
     answer's own test.

     IT IS A ROW HERE AND NOT A SECOND FENCE. `finishedBound` already terminates
     a run whose consumed reaches its allowed, and `#aiRunTerminate` already
     writes which bound stopped it and where — a run that ran out of mints ends
     exactly as a run that ran out of fetches does, with no branch anywhere
     asking which kind of bound it was.

     IT IS LAST IN DECLARATION ORDER BEFORE `lease`, WHICH IS A TIE-BREAK RULE
     AND NOT AN OPINION: `finishedBound` sorts exhausted bounds by this object's
     key order, so a run that exhausted both its fetches and its mints in one
     tick reports FETCHES — the earlier, cheaper-to-explain cause. Putting mints
     first would have renamed every such run's ending without changing anything
     about it. */
  mints:       "passages a machine credential marked citable (§7.3 (5)) — the EXTRACT role's budget",
  /* D-85 (INVESTIGATIVE-SESSION.md §11 item 5, rule 2, BOB #25): AN ASSISTANT OPENS A QUESTION ONLY INSIDE A
     RUN, AND THE RUN BOUNDS HOW MANY. Ruled on `mints`' rule, so it is `mints`' shape: a ROW in this table, no
     schema and no second vocabulary; declared at `op=airunopen` by the member who opens the run; a creation
     under a run that declares none is REFUSED rather than given an allowance invented in code (a number
     chosen here would be a measurement with no measurement behind it); and a run whose surfaces reach the
     allowance ends at its next tick through `finishedBound`, as one that ran out of mints does. AFTER `mints`
     in declaration order for the tie-break reason `mints` gives: appending it renames no existing ending. */
  surfaces:    localize("run-rules.rules.bound_surfaces", "questions an assistant opened inside this run (§11 item 5, rule 2) — the run's bound on what it may surface"),
  /* R13 (K660 (2); BIO_Action_v0_1.md §4 rule 1): THE PLANNING RUN'S BOUND, on `mints`' and `surfaces`' rule. The number
     of proposals a planning run may make, consumed by `action-plans` (its R31) through `ai-runs.consumeBound` as each
     proposal lands, so it is COUNTED BY THE PLANE (PLANE_COUNTED_BOUNDS below). Its allowance is the one the member
     declares at the open, and nothing here caps it: five is the size of a page of the member's tray (`action-plans`
     R34), not a bound. AFTER `surfaces` for `mints`' tie-break reason: appending it renames no existing ending. */
  proposals:   word("run-rules.options_planning_run"),
  /* R26 (T41-21; D2): THE READING BOUND, on `mints`' rule. The number of pages of held documents a run may read; a run in
     mode `extract` or `investigate` reading inside a document declares it at the open, and the plane counts it as each
     page is read (PLANE_COUNTED_BOUNDS below), never the caller. A page of a document under a "no AI" material limit
     (`ai-accounts` R22) is refused inside the run whatever this bound allows (`checkPagesRead`). AFTER `proposals` for
     `mints`' tie-break reason: appending it renames no existing ending. */
  pages:       word("run-rules.pages_documents_group"),
  lease:      word("run-rules.run_stopped_heartbeating"),
};

/* The conditions a run may end on that are NOT a bound being reached. Kept
   apart from RUN_BOUNDS because "the member asked for it to stop" and "the
   budget ran out" are different facts, and collapsing them would put this item
   on the wrong side of its own doctrine two lines after stating it.

   FL-7 (2026-08-10, IC-62) ADDED THE THIRD, AND THE SENTENCE DIRECTLY ABOVE IS
   WHAT DECIDED IT. `mode-not-deployed` is a THIRD such fact, and it arrived as a
   MEASURED misattribution rather than as a gap somebody noticed: FL-3's
   deployment gate (`gate-mode`, today in `agent-harness/src/harness.mjs`) closed a refused
   launch on `cancelled` — which this vocabulary defines two lines up as *"a
   member stopped it"*. **A member did not.** The gate refused a mode that is not
   deployed, before anything was spent and with nobody asking. So a run's own
   ending was attributing a MACHINE REFUSAL TO A MEMBER ACT, in the one field
   that says why the run stopped, which is CLAUDE.md's worst defect class — a
   record claiming more than it can support — arriving at the smallest possible
   scale and therefore the easiest to leave alone.

   WHY THE WORD WAS MINTED RATHER THAN REUSED, since this project's standing
   instruction points the other way and that deserves an answer at the site.
   §14b.6's rule, quoted in `harness.mjs`'s own header, is *"the record already
   has the word and lacks the writer — IS-9(d) builds that producer rather than
   minting a new kind"*. **That ruling is conditional on the word EXISTING, and
   it was measured here and did not:** at FL-7 `mode-not-deployed` appeared
   EXACTLY ONCE in the whole repository — inside the `harness.mjs` comment that
   promised a refused run terminates on it — and was in neither this object nor
   `RUN_BOUNDS`. Both existing endings are FALSE of a gate refusal. The spelling
   is kept as the one that comment already used, so that header became TRUE
   rather than both sides moving to a third name nobody had written yet.

   AND IT IS AN ENDING RATHER THAN A BOUND for the reason this object exists: no
   bound was reached. The gate fires BEFORE any bound is consulted — a run that
   was never allowed to start must not be able to report that it ran out of
   something — which `agent-worker/test/harness.test.mjs` A6 measures (the gate
   fires even with every budget exhausted).

   THE GATE AND THIS CATALOGUE ARE HELD IN AGREEMENT IN BOTH DIRECTIONS by
   `agent-worker/test/harness.test.mjs` A6b, over every input the gate refuses:
   every ending the gate produces is defined here, and the one ending it produces
   is `mode-not-deployed`. Either half drifting fails that arm, which is the thing
   that stops this recurring — the state before FL-7 was exactly one of those two
   halves being unasserted. (A6b read this file and the harness's header as text
   until N421 converted it to the behaviour, T19.) */
export const RUN_ENDINGS = {
  completed:  word("run-rules.run_finished_work"),
  cancelled:  word("run-rules.member_stopped"),
  "nothing-written":
    localize("run-rules.rules.ending_nothing_written", "the run composed a candidate and wrote none, so it closed with nothing to show for its work; no member stopped it and no budget ran out"),
  "mode-not-deployed":
    localize("run-rules.rules.ending_mode_not_deployed", "the deployment gate refused this launch before it spent anything: the mode it asked for is not deployed yet, so no member stopped this run and no budget ran out"),
};

/* WHAT BECAME OF A RUN — the third of this file's three run vocabularies, and
   the one FL-7 deliberately did not reach into.

   FL-8 (2026-09-10, IC-67) ADDED `never-started`, AND THE ARGUMENT IS FL-7'S
   OWN APPLIED ONE LEVEL UP. `#aiRunTerminate` keys this on whether the ending
   is a BOUND: a bound reached is `stopped`, anything else is `finished`. A
   deployment-gate refusal reaches NO bound, so it fell through to `finished` —
   and **a launch the gate refused did not FINISH; it never started.** It took
   no step, spent nothing, and was refused before any bound was consulted. The
   record's own field for what became of the run said it ran to its end.

   THE MEASUREMENT §14b.6 REQUIRES, RUN BEFORE THE WORD WAS MINTED, because
   this project's standing rule points the other way and that deserves an answer
   at the site rather than in a commit message. The rule — quoted in
   `agent-worker/src/harness.mjs`'s header — is *"the record already has the
   word and lacks the writer: build that producer rather than minting a new
   kind"*, and FL-7 established that it is CONDITIONAL ON THE WORD EXISTING. So
   the three terms that were here were asked, one at a time:

     - `running`  — false of a terminated run; not a candidate.
     - `finished` — the defect itself. Its only producer is a run that reached
                    its own end.
     - `stopped`  — the only real candidate, and it FAILS on measurement. Its
                    sole producer anywhere in the plane is `stoppedByBound`, and
                    every sentence the record renders beside it says a bound was
                    reached (then `store.mjs`, now `ai-runs`: *"the run stopped because the '<b>'
                    bound was reached"*; `aiRunRead` prints `RUN_BOUNDS[b]` next
                    to it; `harness.mjs` NOT_OUR_BOUNDS.lease: *"a run that
                    stopped heartbeating DIED rather than finished"*). Filing a
                    never-started run under it would hand a consumer a status
                    whose whole established meaning is bound-exhaustion, about a
                    run that consulted no bound.

   **AND THE HALF THAT DECIDES IT: ALL THREE PRESUPPOSE THE RUN STARTED.**
   `running` is under way; `finished` and `stopped` are two ways of having run.
   There was no term here for a launch that was refused, and none elsewhere in
   the tree either. So §14b.6's condition failed here exactly as it failed for
   FL-7, and applied honestly the precedent points at minting.

   `never-started` names the RUN'S CONDITION rather than the machine's act, and
   that is why it is not spelled `refused`: `refused` is already a state word in
   two unrelated families (`capture_requests.state`, `subresources` LINK_TYPES),
   and a SECOND way for a run never to start would not fit under a word that
   names who refused this one.

   A MEMBER-CANCELLED RUN STILL READS `finished`, AND THAT IS A DECISION RATHER
   THAN AN OVERSIGHT. `cancelled` is an ending too, so it sits on the same side
   of the keying, and one could argue a run a member stopped did not "finish"
   either. It is left exactly as it was: that run RAN, which is what `finished`
   and `stopped` both presuppose and what `never-started` denies. It is a
   different question, decided on a weaker argument, and moving it here would be
   a second value-move riding on this one's reasoning. `test/m/run-rules/rules.test.mjs`
   R1 pins the whole partition so a later tidy-up cannot sweep them together.

   THE VALUES ARE `1` AND NOT SENTENCES, DELIBERATELY. This file's member-facing
   vocabularies are the exported plain objects whose values are ALL sentences
   (DEC-49's shape: RUN_BOUNDS, RUN_ENDINGS, STANDARD_BASIS, RUN_CONTEXTS, each
   held to it by `rules.test.mjs` R1), and `RUN_STATUS` is kept out of that shape
   on purpose: giving these terms texts would present a lifecycle word as though a
   surface rendered a sentence in its place, which is not what this vocabulary is.
   The shape is kept; the reasoning is here. (The refusal-code guard's
   arm E, deleted in T20, harvested such vocabularies by that shape and recorded
   `RUN_STATUS` as excluded by it.) */
export const RUN_STATUS = { running: 1, finished: 1, stopped: 1, "never-started": 1 };

/* WHICH ENDINGS MEAN THE RUN NEVER STARTED. Declared as DATA rather than as a
   literal inside the keying function, so both directions are walkable by a
   suite: every key here must be an ENDING (never a bound — a run that never
   started cannot have reached one), and `never-started` must be REACHABLE, or
   it is a term in a published vocabulary with no producer.

   ONE MEMBER TODAY, and that is a measurement rather than a shape chosen for
   the future: `mode-not-deployed` is the only way a launch is currently refused
   before its first step (`agent-harness/src/harness.mjs`'s `gate-mode` row, the
   FIRST row every run takes). A second one added later joins this set and
   inherits the status with no edit to the keying — which is the difference
   between a set and an `if`. */
export const RUN_NEVER_STARTED = { "mode-not-deployed": 1 };

/** WHAT BECAME OF A RUN THAT ENDED ON `bound` — the ONE place this is decided.
 *
 *  IT LIVES HERE, BESIDE THE THREE VOCABULARIES IT READS, AND THE MOVE IS HALF
 *  OF FL-8. The rule was an inline ternary written TWICE inside
 *  `store.mjs #aiRunTerminate` (once for the `UPDATE`, once for the returned
 *  object) and a THIRD time by hand in `agent-worker/test/harness.test.mjs`'s
 *  plane mock — and **that third copy was measurably WRONG:** it answered
 *  `stopped` for `mode-not-deployed` from the moment FL-7 minted the ending,
 *  while the plane answered `finished`. Nothing caught it because nothing
 *  compared them. That is this repository's parallel-path class, and the remedy
 *  is the one it always is: one function, and the copies BUILT FROM it.
 *
 *  `running` is deliberately not reachable from here. It is `aiRunOpen`'s to
 *  write and this function only ever answers about a run that has ENDED — a
 *  terminate path that could return `running` would be a run leaving `running`
 *  by staying in it. */
export function runStatusFor(bound) {
  const b = bound == null ? "" : String(bound);
  if (Object.prototype.hasOwnProperty.call(RUN_NEVER_STARTED, b)) return "never-started";
  if (Object.prototype.hasOwnProperty.call(RUN_BOUNDS, b)) return "stopped";
  return "finished";
}

/* REC-74 — HOW THE RUN'S BAR IS KNOWN, AND THE ABSENT CASE IS A MEMBER OF THIS
   VOCABULARY RATHER THAN A NULL.
 *
 * §11 names three conditions a run is formed under: the bias manifest in force,
 * the launching project's declared STANDARD PAIR, and the skill version.
 * `ai_runs.standard_pair` was WRITTEN by `aiRunOpen` and published by
 * `aiRunSpawnPayload` — and `aiRunRead` published it nowhere, so a member
 * reading the run object saw the skill version and the bias block and could not
 * see the bar the run was working to. PL-12 found the identical shape one field
 * over. A condition recorded and never published is not recorded for anybody
 * who was not there.
 *
 * WHY THE ANSWER IS A VOCABULARY AND NOT A BOOLEAN. Under DEC-17 the bar is a
 * property of a PROJECT, and *"an inquiry outside any project has no bar"* —
 * so the absent case is a first-class answer about the pair's semantics, not a
 * null, and `undetermined is first-class and must be STATED` (CLAUDE.md)
 * applies to this field exactly as it does to a grade. There is more than one
 * way for a run to have no bar and they are DIFFERENT FACTS:
 *
 *   - `context-has-no-project` — the run works on a question outside any
 *     project. DEC-17: nothing could have declared a bar, so no bar is not a
 *     shortfall and inheriting one from anywhere would INVENT it.
 *   - `none-recorded` — the run does run in a project and the launch recorded
 *     no bar. THE PLANE DOES NOT GO AND LOOK ONE UP: `aiRunOpen` stores what it
 *     was handed and derives nothing, so the honest sentence is about the
 *     RECORD OF THE FORMATION and never about the project's current state.
 *   - `names-no-axis` — something was recorded and it names neither axis. PL-4
 *     measured this class one field over: a value that survives a falsiness
 *     guard while naming nothing reads as PRESENT and travels. It is not a bar.
 *   - `unreadable` — a bar was recorded and cannot be parsed back. Stated,
 *     because "we stored something we can no longer read" and "there was
 *     nothing" are different facts and only one of them is a defect.
 *
 * Each value is the sentence a surface renders INSTEAD of the machine word, so
 * this vocabulary is DEC-49's shape and is held to it, as RUN_BOUNDS and
 * RUN_ENDINGS above are, by `test/m/run-rules/rules.test.mjs` R1 (every value a
 * sentence). */
export const STANDARD_BASIS = {
  recorded:
    word("run-rules.run_formed_bar"),
  "none-recorded":
    localize("run-rules.rules.basis_none_recorded", "no bar was recorded when this run was formed, and none is filled in afterwards"),
  "context-has-no-project":
    word("run-rules.run_works_question"),
  "names-no-axis":
    word("run-rules.something_recorded_bar"),
  unreadable:
    word("run-rules.bar_recorded_run_cannot"),
};

/* REC-69 — WHAT A RUN CAN BE IN THE CONTEXT OF, and it is a vocabulary rather
   than a pair of strings at a call site.
 *
 * §14a: *"A background session runs in a CONTEXT and is associated with an
 * inquiry or a project. Any window focused on any of those objects shows an
 * animated indicator that a job is running."* Two kinds, named by the design,
 * and until REC-69 the plane held the word nowhere — `aiRunOpen` stores
 * `String(contextType)` verbatim and `ai_runs.context_type` is a bare TEXT
 * column, so the two names existed only in prose and in whatever a caller
 * happened to type.
 *
 * IT IS A TEXT VOCABULARY, in RUN_BOUNDS' shape, for DEC-49's reason and not
 * for symmetry: `op=airuns` REFUSES a context kind outside it (C-36.2), and a
 * refusal that names the kinds it does hold must name them in words a member
 * reads rather than in the machine word they typed wrongly. The values are
 * therefore the sentence, and `test/m/run-rules/rules.test.mjs` R1 holds every
 * one of them to that.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO, stated here rather than discovered:
 * **`aiRunOpen` is NOT fenced by it.** The write still accepts any string, so a
 * run CAN be opened on a context kind this read will refuse to ask about. That
 * asymmetry is REAL and is REC-69's own finding rather than an oversight — the
 * open is PL-5's site and its refusals are C-22's family, and widening a write's
 * refusal set from inside a read's item is how one item's blast radius becomes
 * another item's red suite. It is DELEGATED with the measurement.
 * CLOSED 2026-09-19 by REC-153 (`checkRunContextKind`, on BOB #16's ruling that the kind is THIS closed
 * vocabulary): the open now REFUSES any word not a key here, before it looks at any bundle. REC-69's delegation
 * is discharged for new runs; rows stored before it are never rewritten (counted in MEASUREMENTS). */
export const RUN_CONTEXTS = {
  inquiry: word("run-rules.question_group_working"),
  project: word("run-rules.body_work_members"),
};

/* ------------------------------------------------------------------ refusals

   Each returns null when the subject is acceptable, or a REFUSAL object built
   from AI_RUN_CHECKS — the ONE place a C-number, a wire code and its canned
   translation live (DEC-49; the code-to-translation map read from one place
   rather than copied). `detail` is composed here because the useful sentence
   names the offending value, and a build-time table cannot.

   NULL-TOLERANT ON PURPOSE. Every read below tolerates an absent or wrongly
   typed field rather than throwing on `.length` of undefined: a control that
   dies early hides the arms behind it, and a refusal function that throws
   cannot NAME what it broke.

   ONE EXCEPTION TO THE NULL-OR-REFUSAL SHAPE, and it is named here rather than
   discovered: PL-18's `projectGate` returns a VERDICT OBJECT carrying its
   `refusal` (null or built) alongside the GROUND it decided on. It has to,
   because two of its four grounds PERMIT and both of those must still be
   stated on the answer — DEC-17's projectless case is a permission the record
   has to be able to explain, not an absence of refusal. Splitting it into a
   check and a separate statement-builder would put the sentence and the verdict
   in two places that can disagree. */

function refusal(key, detail, extra = null) {
  const row = AI_RUN_CHECKS[key];
  return { ok: false, code: key, check: row.check, translation: row.translation, detail,
           ...(extra && typeof extra === "object" ? extra : {}) };
}

/** C-22.5 — THE ITEM'S OWN REFUSAL. A run may not leave `running` without
 *  naming what stopped it. Both vocabularies are legal: a bound that was
 *  reached, or one of the two endings that are not bounds. Anything else, and
 *  anything absent, is refused. */
export function checkBound(bound) {
  const b = bound == null ? "" : String(bound);
  if (Object.prototype.hasOwnProperty.call(RUN_BOUNDS, b)) return null;
  if (Object.prototype.hasOwnProperty.call(RUN_ENDINGS, b)) return null;
  return refusal("AI_RUN_BOUND_UNNAMED",
    `'${b || "(absent)"}' names no bound and no ending. Bounds: ${Object.keys(RUN_BOUNDS).join(", ")}; `
    + `endings: ${Object.keys(RUN_ENDINGS).join(", ")} (§14b.6)`);
}

/* R13 (K660 (2)): `proposals` joins them, counted by `action-plans` through `ai-runs.consumeBound` as each proposal lands.
   REC-169 (INVESTIGATIVE-SESSION.md §14b.6 and §11 item 5 rule 2) — THE BOUNDS THE PLANE COUNTS ITSELF. `mints` is
   counted by `extractPropose` from what it actually minted, and `surfaces` by `promote` when an assistant's question
   lands (D-85). Each has a writer that names it BY LITERAL; `test/m/run-rules/rules.test.mjs` R3 and R13 hold this
   list, and a third plane-counted bound is added here with its writer. (`rec169-consume.test.mjs` ARM C, deleted in
   T20, held it equal to a census of `store.mjs`' writers read off the source.) A caller's figure for one of these can only disagree with the plane's: a positive one makes the bound say passages
   were minted or questions opened that were not, and a negative one is a refund of what the plane counted. So the
   caller spends neither, at the tick or as a seed at the open — a zero claims nothing and is let through. */
/* R26 (T41-21): `pages` joins them, counted by the run's read as each page is read inside a held document. */
export const PLANE_COUNTED_BOUNDS = Object.freeze(["mints", "surfaces", "proposals", "pages"]);

/* REC-172 (§14b.6) — THE BOUND THE PLANE DECIDES, and it is NOT a count. `lease` is the heartbeat whose LAPSE is how a
   killed run is noticed (`finishedBound`'s `expired`, the `ai-run-reap` consumer): the plane reads it off the clock,
   and nothing anywhere spends it. It is kept apart from PLANE_COUNTED_BOUNDS for two reasons, both measured: that list
   is the plane's literal-named bound writers (measured by rec169's ARM C), and `lease` has none; and a zero is not
   let through here as it is there, because a zero `mints` is a count of nothing while a zero `lease` is still a figure
   for a thing that has no figures — and the tick's upsert would write a `lease` row into the run's budget, which the
   record would then show beside the allowances a member declared. So ANY figure for it is refused, at the tick and at
   the open, under C-22.14's rationale: the plane decides it. */
export const PLANE_DECIDED_BOUNDS = Object.freeze(["lease"]);

/** REC-169 — C-22.13 and C-22.14: MAY THE CALLER WRITE THIS FIGURE INTO A RUN'S BOUND? Null when every entry may be
 *  written, else the refusal for the FIRST that may not (in the order given), so the caller is told which one.
 *
 *  `entries` is `[bound, value]` pairs. `seed` is true at the open, where an ABSENT figure (undefined or null) means
 *  "none spent yet" (or, for `allowance`, "no ceiling declared" — stored as 0 as it always was) and is not a figure.
 *  `allowance` is true for the MEMBER'S declared `allowed` at the open (REC-172): the same shape, and no plane-counted
 *  refusal, because the member who opens a run is exactly who sets its `mints` and `surfaces` ceilings (D-85).
 *  `map` is true at the tick, where `entries` is the caller's `consume` itself, and `list` at the open, where it is
 *  the member's `bounds` itself (see the note at each branch).
 *
 *  REC-172 (C-22.15): A PAIR WHOSE BOUND IS NOT A RUN_BOUNDS ROW IS REFUSED, NOT SKIPPED. It was skipped — the tick
 *  answered `ticked: true` over `{ fetchs: 1 }` and spent nothing, so the caller believed it had counted a fetch the
 *  record never held, and a member who declared `fetchs: 3` at the open got a run with no fetch ceiling at all.
 *  An own-property test, so `__proto__` and `constructor` name no bound either. And `lease` (PLANE_DECIDED_BOUNDS) is
 *  refused before its figure is looked at: there is no figure for it.
 *
 *  THE RULE: a figure is a NON-NEGATIVE SAFE INTEGER, and a JSON number — never a string that looks like one. The
 *  column is declared INTEGER and counts things (fetches, sub-sessions, milliseconds, ceilings, passages,
 *  questions); a count moves up by a whole number or not at all. A negative is a REFUND — the run's principal un-spending
 *  what its member allowed it — a fraction and a non-finite are not counts, and a string or `true` was coerced by
 *  `Number(v) || 0` into a figure nobody sent. Refused, never clamped: a clamp answers `ticked: true` over a spend that
 *  did not happen. */
export function checkConsume(entries, opts) {
  const { seed = false, allowance = false, map = false, list = false } = opts && typeof opts === "object" ? opts : {};
  /* REC-172 — THE OPEN'S DECLARATION, held to the tick's shape: with `list`, `entries` is `op=airunopen`'s own
     `bounds`, a LIST of `{ bound, allowed, consumed?, unit? }`; absent is a run declaring no bounds, as it always was.
     A map, and an entry that is not an object, are C-22.15 (each was DROPPED silently, so the member got a run without
     the ceiling they declared); then every entry's BOUND and ALLOWANCE are judged (`allowance`: an unknown name is
     C-22.15, `lease` is C-22.14, and an `allowed` that is not a whole number of zero or more is C-22.13 — it was written
     `Number(x) || 0`, so `-1`, `1.5` and `"3"` became a declaration nobody made), and then its `consumed` SEED, REC-169's
     check unchanged. The first refusal wins; nothing is written. In THIS function rather than a wrapper so every one of
     the rule's refusals sits inside the one governed span its three rows name (DEC-49's `where`). */
  if (list) {
    if (entries == null) return null;
    if (!Array.isArray(entries))
      return refusal("AI_RUN_BOUND_UNKNOWN",
        `\`bounds\` was ${typeof entries === "object" ? "a map" : `a ${typeof entries}`}: it is a list of `
        + "{ bound, allowed, unit }, one per bound the run is held to (§14b.6). Nothing was written", { bound: null });
    const bad = entries.findIndex((e) => !e || typeof e !== "object" || Array.isArray(e));
    if (bad >= 0)
      return refusal("AI_RUN_BOUND_UNKNOWN",
        `\`bounds[${bad}]\` is ${(JSON.stringify(entries[bad]) ?? String(entries[bad])).slice(0, 60)}, not a `
        + "{ bound, allowed, unit } entry, so it names no bound (§14b.6). Nothing was written", { bound: null });
    return checkConsume(entries.map((e) => [e.bound == null ? "" : String(e.bound), e.allowed]),
                        { seed: true, allowance: true })
        || checkConsume(entries.map((e) => [String(e.bound), e.consumed]), { seed: true });
  }
  /* REC-172 — C-22.15 at the TICK: with `map`, `entries` is the tick's own `consume`, a MAP from a bound's name to the
     figure spent on it. Absent (null or undefined) is a tick that spends nothing, as it always was. Anything else that
     is not a plain object — an ARRAY above all, whose keys are positions (`"0"`) that name no bound — was read as an
     empty map, so the tick answered `ticked: true` and spent nothing: `vf4-live-scratch.mjs` sent `[{ bound, amount }]`
     from the day it was written and not one of its fetches was ever counted. Refused whole, HERE rather than in a
     wrapper, so the refusal sits inside the one governed span (DEC-49's `where`) that already holds this rule. */
  if (map) {
    if (entries == null) return null;
    if (typeof entries !== "object" || Array.isArray(entries))
      return refusal("AI_RUN_BOUND_UNKNOWN",
        localize("run-rules.rules.consume_not_a_map", "`consume` was {what} ({value}): it is a map from a bound's name to the figure spent on it, e.g. {example}, and an array's keys are positions, which name no bound (§14b.6). Nothing was written", {
          what: Array.isArray(entries) ? "an array" : `a ${typeof entries}`,
          value: (JSON.stringify(entries) ?? String(entries)).slice(0, 80),
          example: "{ fetches: 1 }",
        }), { bound: null });
    entries = Object.entries(entries);
  }
  for (const [k, v] of Array.isArray(entries) ? entries : []) {
    const b = String(k);
    if (!Object.prototype.hasOwnProperty.call(RUN_BOUNDS, b))
      return refusal("AI_RUN_BOUND_UNKNOWN",
        localize("run-rules.rules.v1_names_no_bound_of", "'{v1}' names no bound of a run. The bounds a caller spends are {filter} (§14b.6); a figure for a bound that does not exist counts nothing. Nothing was written", { v1: String(b === "" ? "(absent)" : b.slice(0, 60)), filter: String(Object.keys(RUN_BOUNDS).filter((x) => !PLANE_COUNTED_BOUNDS.includes(x) && !PLANE_DECIDED_BOUNDS.includes(x)).join(", ")) }), { bound: b });
    if (PLANE_DECIDED_BOUNDS.includes(b))
      return refusal("AI_RUN_BOUND_PLANE_COUNTED",
        `'${b}' is decided by the plane — a run's lease lapses on the clock, read by the reaper, and nothing spends it `
        + `(§14b.6) — so no figure for it, not even a zero, is the caller's to send or a member's to declare. `
        + `Nothing was written`, { bound: b });
    /* REC-177 (§14b item 6, BOB #30) — A DECLARED BOUND STATES ITS ALLOWANCE. An `allowed` that is ABSENT (undefined
       or null) or ZERO was let through here and stored as 0, which `finishedBound` reads as NO CEILING: the run
       recorded a bound it did not have. So at the open it is refused, before the figure's form is judged — a bound
       the run does not want is simply not declared, and `0` stays "no ceiling" only for a bound nobody declared (the
       tick's upsert). A present figure of the wrong form (a string, a fraction, a negative) stays C-22.13's, below. */
    if (allowance && (v == null || v === 0))
      return refusal("AI_RUN_BOUND_NO_ALLOWANCE",
        `'${b}' was declared with ${v == null ? "no `allowed`" : "`allowed: 0`"}: a declared bound states how much the `
        + "run may spend, a whole number of one or more, and a bound the run is not held to is left out of `bounds` "
        + "(§14b item 6). A zero allowance would be read as no ceiling at all. Nothing was written", { bound: b });
    if (seed && v == null) continue;
    if (!(typeof v === "number" && Number.isSafeInteger(v) && v >= 0))
      return refusal("AI_RUN_CONSUME_INVALID",
        `'${b}' was ${allowance ? "declared an allowance of" : "given"} `
        + `${typeof v === "number" ? String(v) : (JSON.stringify(v) ?? String(v)).slice(0, 60)}`
        + ` — a bound's figure is a whole number of zero or more, ${allowance ? "allowed or spent" : "and a count never goes down"}`
        + ` (§14b.6). Nothing was written`, { bound: b });
    if (allowance) continue;
    if (v !== 0 && PLANE_COUNTED_BOUNDS.includes(b))
      return refusal("AI_RUN_BOUND_PLANE_COUNTED",
        `'${b}' is counted by the plane as the run's work lands, never by the caller (§11 item 5 rule 2, SK-8), `
        + `so a figure sent for it could only disagree with the count. Nothing was written`, { bound: b });
  }
  return null;
}

/* N293, R45 (REC-169's rule, one figure over) — THE MOST A RUN'S `state` MAY HOLD, in bytes: the UTF-8 length of its
   JSON, which is exactly what `ai_runs.state` stores and what every read of the run publishes (R19). A quarter of a
   mebibyte: the work list of a resumable run, never a transcript (DEC-61) and never the pages it read, which live in
   the record and the observation log. */
export const AI_RUN_STATE_MAX_BYTES = 262144;

/** C-22.18 — MAY THE RUN KEEP THIS STATE? Null when `state` is absent or null (a tick that sends none leaves the held
 *  state standing, R12, and an open that sends none stores the empty work list) or when its JSON is within
 *  AI_RUN_STATE_MAX_BYTES; else the refusal, naming `bytes` and `limit`. The ONE site that mints the code; the open and
 *  the tick relay it. A value JSON cannot hold (no body sent over the wire can carry one) is not measured here. */
export function checkRunState(state) {
  if (state == null) return null;
  let json;
  try { json = JSON.stringify(state); } catch { return null; }
  if (typeof json !== "string") return null;
  const bytes = new TextEncoder().encode(json).length;
  if (bytes <= AI_RUN_STATE_MAX_BYTES) return null;
  return refusal("AI_RUN_STATE_TOO_LARGE",
    `the run's state is ${bytes} bytes as JSON, over the ${AI_RUN_STATE_MAX_BYTES} a run may keep: \`state\` is the `
    + "run's resumable work list (§14b.7), not what it read. Nothing was written", { bytes, limit: AI_RUN_STATE_MAX_BYTES });
}

/* R17 (Q0-5; R-3 Q-E3; T33-49) — AN ASK'S OWN BOUNDS. An ask is no run (R16): it keeps no budget rows and no lease, so
   it is bounded by what it declares when it starts, held by the caller that runs it (`agent-worker`'s `/ask`, and
   `answers` for a standing question's AI half). Each bound's figure here is PROVISIONAL and is both the default an ask
   declares when it has no other figure and the CEILING no ask may declare above (the job's reading, posted to BOB as J1): M-Q7 measures the
   values at T33's release and replaces them. `turns` is `agent-worker`'s conversation limit; `bytes` the plane answers
   an ask reads into the model; `wall_ms` the wall time from its start; `reads` the plane reads it makes. In order: the
   order `askBoundReached` reports in, cheapest-to-explain first, as RUN_BOUNDS' tie-break. Frozen, every level. */
export const ASK_BOUNDS = Object.freeze({
  turns:   Object.freeze({ default: 12, means: word("run-rules.model_turns_ask") }),
  bytes:   Object.freeze({ default: 1048576, means: word("run-rules.bytes_record_answers") }),
  wall_ms: Object.freeze({ default: 180000, means: word("run-rules.milliseconds_ask_start") }),
  reads:   Object.freeze({ default: 40, means: word("run-rules.reads_record_ask") }),
});

const isCount = (v) => typeof v === "number" && Number.isSafeInteger(v);

/** R17 — MAY AN ASK START WITH THESE BOUNDS? `bounds` is a map naming every one of ASK_BOUNDS with a positive whole
 *  figure at most its ceiling. Null when it does; else the refusal for the FIRST fault, R3's codes for R3's faults: a
 *  shape that is not a map, or a name that is not an ask's bound, C-22.15; a bound left out, or a figure absent or zero,
 *  C-22.16; a figure that is not a whole number of one or more, C-22.13; and above the ceiling, C-22.21 (no R3 code says
 *  that truthfully). Names are judged in the order given, then the bounds left out in ASK_BOUNDS' order. Never throws. */
export function checkAskBounds(bounds) {
  if (bounds == null || typeof bounds !== "object" || Array.isArray(bounds))
    return refusal("AI_RUN_BOUND_UNKNOWN",
      `an ask's bounds were ${Array.isArray(bounds) ? "an array" : bounds == null ? "absent" : `a ${typeof bounds}`}: they are `
      + `a map naming each of ${Object.keys(ASK_BOUNDS).join(", ")} with its figure. Nothing was asked`, { bound: null });
  for (const [k, v] of Object.entries(bounds)) {
    if (!Object.prototype.hasOwnProperty.call(ASK_BOUNDS, k))
      return refusal("AI_RUN_BOUND_UNKNOWN",
        `'${k === "" ? "(absent)" : k.slice(0, 60)}' is not a bound of an ask. An ask's bounds are `
        + `${Object.keys(ASK_BOUNDS).join(", ")}. Nothing was asked`, { bound: k });
    if (v == null || v === 0)
      return refusal("AI_RUN_BOUND_NO_ALLOWANCE",
        `'${k}' was given ${v == null ? "no figure" : "a figure of 0"}: an ask states how much of each bound it may use, a `
        + "whole number of one or more. Nothing was asked", { bound: k });
    if (!(isCount(v) && v > 0))
      return refusal("AI_RUN_CONSUME_INVALID",
        `'${k}' was given ${typeof v === "number" ? String(v) : (JSON.stringify(v) ?? String(v)).slice(0, 60)}: an ask's `
        + "bound is a whole number of one or more. Nothing was asked", { bound: k });
    if (v > ASK_BOUNDS[k].default)
      return refusal("AI_ASK_BOUND_ABOVE_CEILING",
        `'${k}' was given ${v}, above the ${ASK_BOUNDS[k].default} one ask may have (${ASK_BOUNDS[k].means}). Nothing was asked`,
        { bound: k, limit: ASK_BOUNDS[k].default });
  }
  for (const k of Object.keys(ASK_BOUNDS))
    if (!Object.prototype.hasOwnProperty.call(bounds, k))
      return refusal("AI_RUN_BOUND_NO_ALLOWANCE",
        `'${k}' was left out: an ask states each of its bounds when it starts (${ASK_BOUNDS[k].means}). Nothing was asked`,
        { bound: k });
  return null;
}

/** R17 — WHICH OF AN ASK'S BOUNDS IS REACHED? The first, in ASK_BOUNDS' order, whose `used` figure is at or past the
 *  figure declared in `bounds`; null when none is. A declared figure that is not a positive whole number at most its
 *  ceiling is read as the ceiling, and a `used` figure that is not a number of zero or more as 0 — so a malformed
 *  declaration never lifts a bound and a malformed count never reaches one. Never throws. */
export function askBoundReached(bounds, used) {
  const b = bounds && typeof bounds === "object" ? bounds : {};
  const u = used && typeof used === "object" ? used : {};
  for (const [k, { default: ceiling }] of Object.entries(ASK_BOUNDS)) {
    const declared = Object.prototype.hasOwnProperty.call(b, k) ? b[k] : undefined;
    const limit = isCount(declared) && declared > 0 && declared <= ceiling ? declared : ceiling;
    const spent = Object.prototype.hasOwnProperty.call(u, k) ? u[k] : undefined;
    if (typeof spent === "number" && spent >= limit) return k;
  }
  return null;
}

/** R18 (K1481; the canon audit) — MAY THIS AI RUN OR ASK START? Only at a member's act: `startedBy`, the control plane's
 *  stamp for whoever started it, names a member (`member:<id>`, or a credential that member minted, `member:<id>/<tok>`,
 *  through `runPrincipalOf`). The ONE exception is the AI half of a standing question a member wrote (`answers` R19):
 *  with no member's act, it starts only when `standing` names its author, a member, and the mode is `ask` (R16's
 *  read-only reach; R17's bounds and the author's own account and ceiling are held by its callers). A draft (R21; T35,
 *  N686, DEC-153) starts only at the act of the member who asked for the help: the exception is `ask`'s alone, so with
 *  no member's act a draft is refused whatever `standing` holds, whatever its kind (R22's, R25's and R27's kinds
 *  alike: the detail names no kind); so is the mode `enquire` (R24; T41-21), the interview
 *  and planning, which starts only at the act of the member whose matter it is. Anything else — a token class, the scheduler, a blank
 *  or unrecognised stamp — is `AI_RUN_NOT_A_MEMBER_ACT` (C-22.19): fail closed. An exploring run (`origin: "explore"`;
 *  F1, K5821) is judged on `enabledBy`, the member who turned exploring on, with `enablerAllowed` (the caller's reading
 *  of that member now): `{ok: true, origin: "explore", accountable}`, else the same code with `exploring: "off"`.
 *  Never throws. */
export function startAllowed(asked) {
  const { startedBy = null, mode = null, standing = null, origin = null, enabledBy = null, enablerAllowed = false } =
    asked && typeof asked === "object" ? asked : {};
  const memberOf = (who) => {
    const p = runPrincipalOf(who);
    return /^member:\S/.test(p) ? p : "";
  };
  /* F1 (K5821, Bob's REC-11): an exploring run (origin `explore`, a team's or a project's) is judged on the member who
     turned exploring on, `enabledBy`, at each run, whoever stamped it: that member is its accountable member, so K1606
     holds (every run traces to a member's act). Whether that member is still a member and still allowed is the
     caller's to read and hand in as `enablerAllowed`, exactly `true`; anything else, or no enabling member, refuses
     with a sentence the screen shows and `exploring: "off"`, which stays so until a member turns it on again. */
  if ((origin == null ? "" : String(origin).trim()) === "explore") {
    const enabler = memberOf(enabledBy);
    if (enabler && enablerAllowed === true) return { ok: true, origin: "explore", accountable: enabler };
    return refusal("AI_RUN_NOT_A_MEMBER_ACT", enabler
      ? localize("run-rules.rules.explore_enabler_gone", "the member who turned exploring on is no longer a member here or may no longer start runs, so this exploring run was not started and exploring is off until a member turns it on again (K5821). Nothing was started")
      : localize("run-rules.rules.explore_no_enabler", "no member is recorded as having turned exploring on, so this exploring run has no member accountable for it and exploring is off until a member turns it on again (K5821). Nothing was started"),
      { exploring: "off" });
  }
  if (memberOf(startedBy)) return { ok: true };
  const author = standing && typeof standing === "object" ? memberOf(standing.author) : "";
  const m = mode == null ? "" : String(mode).trim();
  if (author && m === "ask") return { ok: true, exception: "standing_question", author };
  return refusal("AI_RUN_NOT_A_MEMBER_ACT",
    m === "enquire"
      ? "the interview and planning start only at the act of the member whose matter it is, and the standing "
        + "question's exception is an ask's alone (K1481). Nothing was started"
      : m === "draft"
      ? "a draft, of whatever kind, starts only at the act of the member who asked for the help, and the "
        + "standing question's exception is an ask's alone (DEC-153, K1481). Nothing was started"
      : author
      ? localize("run-rules.rules.a_standing_question_starts_only", "a standing question starts only an ask, which reads and answers; it cannot start a run in mode {stringify} (K1481). Nothing was started", { stringify: String(JSON.stringify(m.slice(0, 40))) })
      : localize("run-rules.rules.no_members_act_started_this", "no member's act started this, and it is not the AI half of a standing question a member wrote (K1481). Nothing was started"));
}

/* R23 (T41-21; N820) — WHERE A RUN CAME FROM. `member`: a member's own act opened it (every run before T41, and every
   run since that is not the explorer's); `explore`: the system exploring a question unasked, where an account owner
   turned exploring on (`question-explorer`). Frozen, in that order. R28 (K2822) leaves it so: a planning run's origins
   are PLAN_ORIGINS below, and `skills` reads the explorer's origin as this list's last, so nothing is appended here. */
export const RUN_ORIGINS = Object.freeze(["member", "explore"]);

/* R28 (T45; K2822; ai-runs R77) — THE ORIGINS A RUN IN MODE `plan` MAY HAVE: `member`, a member's planning run, and
   `reexamination`, the planning run started inside the member's act that records a response (v0.2 rule 16). Frozen. */
export const PLAN_ORIGINS = Object.freeze(["member", "reexamination"]);

/** R23, R28 — MAY A RUN OF THIS ORIGIN OPEN, IN THIS MODE? In mode `plan` (R28, K2822): `{ok: true}` for an origin of
 *  PLAN_ORIGINS, any other (`explore` included) `AI_RUN_ORIGIN_UNKNOWN` (C-22.25). In any other mode, or none, R23
 *  unchanged: `{ok: true}` for `member`; for `explore` only while `investigate` is deployable under R19 as amended — its
 *  verification chain and its test bar both held — which the caller reads from the record and hands here as
 *  `investigateDeployable` (`partDeployable("investigate", …)`); exactly `true` admits, anything else is
 *  `AI_RUN_EXPLORE_NOT_DEPLOYABLE` (C-22.27). Any other origin there (`reexamination` included), and an absent one, is
 *  `AI_RUN_ORIGIN_UNKNOWN`: an origin is said, never assumed. The one site that mints both; `ai-runs` R73's and R77's
 *  open relays them (B4, K2485; K2822). Pure; never throws. */
export function originAllowed(asked) {
  const { origin = null, mode = null, investigateDeployable = false } = asked && typeof asked === "object" ? asked : {};
  const o = typeof origin === "string" ? origin : "";
  if (mode === "plan")
    return PLAN_ORIGINS.includes(o) ? { ok: true } : refusal("AI_RUN_ORIGIN_UNKNOWN",
      `${JSON.stringify(String(origin ?? "").slice(0, 40))} is not where a planning run comes from: a planning run is `
        + `opened by a member, or by recording a reply (${PLAN_ORIGINS.join(", ")}). Nothing was started`, { origin: o || null });
  if (o === "member") return { ok: true };
  if (o === "explore")
    return investigateDeployable === true ? { ok: true } : refusal("AI_RUN_EXPLORE_NOT_DEPLOYABLE",
      "an exploring run opens only while investigating is switched on, after it has been checked in real use and has "
        + "passed its test investigations (R19). Nothing was started", { origin: o });
  return refusal("AI_RUN_ORIGIN_UNKNOWN",
    `${JSON.stringify(String(origin ?? "").slice(0, 40))} is not where a run comes from: a run is opened by a member or `
      + `by the explorer (${RUN_ORIGINS.join(", ")}). Nothing was started`, { origin: o || null });
}

/** R26 (T41-21; D2) — MAY THE RUN READ INSIDE THIS DOCUMENT? `limits` is the material limits held for the document
 *  (`ai-accounts` R22, each `{on, uses, reason}`, `uses` naming USE_KINDS entries and meaning all of them when absent).
 *  A limit that is on (`on` anything but exactly `false`) and covers the use `read` keeps the document from the AI: the
 *  read is refused `AI_RUN_READ_NO_AI` (C-22.23), whatever the run's `pages` bound allows — the bound is not consulted.
 *  Null otherwise: the bound is then judged by `finishedBound` as every bound is. A limit that is not an object is no
 *  limit; `limits` that is not a list is none. The detail never quotes a limit's reason. Pure; never throws. */
export function checkPagesRead(asked) {
  const { limits = null } = asked && typeof asked === "object" ? asked : {};
  const keeps = (l) => l != null && typeof l === "object" && !Array.isArray(l) && l.on !== false
    && (l.uses == null || (Array.isArray(l.uses) && l.uses.includes("read")));
  if (!(Array.isArray(limits) && limits.some(keeps))) return null;
  return refusal("AI_RUN_READ_NO_AI",
    "this document is kept away from the assistant by a limit on its material, so the run may not read inside it, "
      + "whatever its reading bound allows (R26). Nothing was read");
}

/** R35 (T50; N1169; K3501 (C2)) — DOES A `level-empty` FINDING HOLD OVER THIS SCOPE? `scope` is the plane's four-level
 *  statement of the read the finding rests on (`retrieval` R13). `true` exactly when `scope.documents` is a whole number of
 *  1 or more: a level with a document in scope was looked at. Otherwise `{holds: false, code, check, translation}`, C-22.31's
 *  row: a level that had no document in scope was not looked at, so no absence is written for it. A scope that is absent,
 *  not an object, or states no whole `documents` (a string, a fraction, a negative, an infinity, one inherited rather than
 *  stated) does not hold: fail closed. `agent-harness` R18 asks it before it composes a candidate. Pure; never throws. */
export function levelEmptyHolds(asked) {
  const has = (o, k) => o !== null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);
  let documents = null;
  try {
    if (has(asked, "scope") && has(asked.scope, "documents")) documents = asked.scope.documents;
  } catch { documents = null; }
  if (typeof documents === "number" && Number.isSafeInteger(documents) && documents >= 1) return true;
  const row = AI_RUN_CHECKS.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE;
  return { holds: false, code: "LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE", check: row.check, translation: row.translation };
}

/* ------------------------------------------------- DEC-63's gate (PL-18)

   THE THREE GROUNDS ON WHICH THE PROJECT GATE CAN PERMIT, as a CLOSED
   VOCABULARY rather than three booleans a reader has to combine. **All three
   PERMIT, and every one of them is STATED on the answer** — which is the half
   that is easy to skip and is the reason this vocabulary exists at all. DEC-17
   makes the projectless case real rather than an edge case, and a permission
   granted silently is indistinguishable from a gate that never ran. That is the
   overclaim shape this project refuses everywhere else: the record must be able
   to say WHY a run was allowed to start, not merely that it started.
   THE REFUSING OUTCOME IS NOT HERE. It is named by its code, C-22.8, and giving
   it a ground as well would be two names for one fact — see the note under this
   object. */
export const PROJECT_GATE_GROUNDS = {
  /* No member is behind this caller at all — a machine credential. The gate is
     NOT APPLIED, and the reason is that it CANNOT be: participation is a
     relationship between a PERSON and a project, and a token class is not a
     person. This keeps the gate's population identical to the capability
     FLOOR's, which the control plane (`control-plane/index.mjs`) applies only `if (viaSession)` — a fence
     wider than the floor beneath it would be an undeclared interface change
     wearing the costume of caution, and it would refuse the daemon outright.
     DEC-63 names the lever for this half explicitly and it is a different one:
     *"any narrowing happens at the credential layer"* — IS-5's `ai` credential
     scope, which can only narrow what a machine may reach. */
  NO_MEMBER_BEHIND_CALLER: word("refusal.NO_MEMBER_BEHIND_CALLER"),
  /* REC-145 (2026-09-19) — DEC-63 AS AMENDED BY BOB, 2026-09-18: *"A project doesn't own an area of
     enquiry to the exclusion of others."* A run whose context is a QUESTION consults no project for its
     verdict (Membership v2 §7, the DEC-63 ruling bullet, "How it applies at the code", BOB #16). ONE
     GROUND for every question, whoever cites it, and that is the §7.9 half of the ruling rather than
     tidiness. The ground this REPLACES, `PROJECTLESS` (PL-18, from DEC-17: *"An inquiry outside any
     project has no bar and inherits none"*), was said only when NO project cited the question, so its
     ABSENCE told a member that some project — possibly one hidden from them — did; a second permitting
     ground keyed on the citers would carry the same bit. DEC-17's case is not lost: a question in no
     project is still a question, permitted and STATED on this ground. And it is not a silent allow: the
     answer still says WHY the run was allowed, which is what PL-18's vocabulary exists for. */
  INQUIRY: "this run is over a question, and a project does not own a line of inquiry: the verdict consults no project (DEC-63 as amended, 2026-09-18)",
  PARTICIPANT: word("refusal.PARTICIPANT"),
};

/** REC-145 — DOES A RUN OVER THIS CONTEXT KIND CONSULT A PROJECT FOR ITS VERDICT? The ONE answer, read by
 *  `projectGate` below AND by the store before it asks any participation question, so the pure decision
 *  and the facts fed to it cannot disagree about which contexts are gated. Only a PROJECT context is:
 *  *"a project's contents are private to its participants"* (BOB #16). Every other kind names no project.
 *  `RUN_CONTEXTS` holds two kinds; an unvocabularied one (REC-69's delegated asymmetry — the open does
 *  not fence the word) is read as naming none, never as a project the caller did not say, which is how
 *  it was read before this item too (its citers were looked up, and a non-question has none). */
export function runConsultsProjects(contextType) {
  return String(contextType ?? "") === "project";
}
/* THERE IS NO `NOT_PARTICIPANT` GROUND, AND ITS ABSENCE IS A CORRECTION THIS
   ITEM'S OWN GUARD RUN FORCED RATHER THAN AN OMISSION. The first draft had one,
   and it was a SECOND NAME for a fact that already has a canonical one: the
   refusal's C-22.8 code. The refusal-code guard, deleted in T20, failed the
   harness on the shape that produced it — a refusing return whose code arrived
   through a spread rather than as a literal at the site — and the fix that
   satisfies the guard is the same fix that removes the duplicate name: the
   refusing path returns THE REFUSAL ITSELF, built by `refusal()` with the code
   spelled out, exactly as `checkObservation`, `checkCondition` and `checkBound`
   do three functions up. **A refusal is named by its code; a permission is
   named by its ground.** Two vocabularies for two different things, and neither
   one restating the other. */

/** DEC-63 / PL-18 — MAY THIS ACCOUNT ASK THE SYSTEM TO LOOK AT THIS CONTEXT?
 *
 *  AMENDED 2026-09-19 by REC-145 (DEC-63 as amended by Bob, 2026-09-18; Membership v2 §7): THE GATE
 *  NOW STANDS ONLY OVER A PROJECT CONTEXT. A run over a question consults no project — the ground is
 *  `INQUIRY`, whoever cites it — so `AI_RUN_NOT_PROJECT_MEMBER` is never said over a question, and the
 *  refusal no longer carries the one bit (*a project you cannot see cites this*) §7.9 forbids. What
 *  follows about joined/invited/leaving and the absent admin bypass is unchanged, and now applies to a
 *  run over a PROJECT only.
 *
 *  PURE, like everything else in this file: the STORE supplies the facts (which
 *  projects hold the context, and which of those the account has JOINED) and
 *  this function makes the decision and builds the refusal. One decision for
 *  all three run verbs, so `airunopen`, `airuntick` and `airunclose` cannot
 *  drift apart — which is the failure mode IS-6's own header warned about when
 *  it gave the three verbs one capability rather than gating only the open.
 *
 *  IT RETURNS BOTH THE VERDICT AND THE SENTENCE FROM ONE COMPUTATION. There is
 *  deliberately no second function computing the stated ground, because a
 *  statement derived separately from the decision it describes is a statement
 *  that can disagree with it — this repository has measured that class five
 *  times as "a hand copy agrees at zero cost".
 *
 *  `permitted` IS THE VERDICT AND IT LEADS EVERY RETURN, and that is a
 *  CORRECTION THIS ITEM'S OWN GUARD RUN FORCED rather than a shape chosen up
 *  front. The first draft led with `applied`, which is not a verdict at all —
 *  it says whether the gate had anything to check — so the two PERMITTING
 *  grounds returned `applied: false` and the refusal-code guard, deleted in T20,
 *  read both of them as CODELESS REFUSALS and failed the harness. It was right
 *  to: a reader who cannot tell *this gate did not apply* from *this gate
 *  refused* by looking at the verdict is the member-facing version of the same
 *  confusion. `permitted` is a literal `true` on all three permitting paths and
 *  a literal `false` on the one refusal, so the guard grades this function
 *  correctly and so does a person. `applied` survives beside it as the FACT it
 *  always was, which is what DEC-17's projectless case needs stated.
 *
 *  JOINED, NOT MERELY INVITED. `projectsJoined` is the store's `joined` set and
 *  the choice is `forkProject`'s, one door over: an invited member sees the
 *  project's SKELETON only, so there is nothing there for them to investigate.
 *  A `leaving` participant is likewise not counted — 7.6 makes that a REQUEST
 *  rather than a removal, but it is the member's own statement that they are
 *  done with this work, and starting new work on the strength of it would be
 *  the record acting against what the member said.
 *
 *  NO ADMINISTRATOR BYPASS, and it is deliberate rather than an oversight.
 *  Membership Architecture v2 4.9 is that an administrator SEES every project
 *  and DIRECTS none of them; the admin bypasses that exist (7.2, 7.7) are over
 *  PARTICIPATION ITSELF, which is custodial. Starting an investigation is WORK,
 *  and DEC-63's words are *"any member of a project"* — an administrator who is
 *  not in the project is not one. They have a remedy the refusal names: join.
 *
 *  `contextLabel` is what the CALLER named, and it is the only identifier the
 *  detail sentence carries. The projects are NOT named to a non-participant:
 *  7.12's skeleton rule means the existence of a project can itself be
 *  something an outsider is not entitled to, and a refusal that leaks the
 *  roster of projects touching a question would be this gate defeating the
 *  visibility rule it sits beside. */
export function projectGate(asked) {
  const { actor = null, contextType = null, contextId = null, projects = [], projectsJoined = [] } =
    asked && typeof asked === "object" ? asked : {};
  const who = actor == null ? "" : String(actor).trim();
  const all = Array.isArray(projects) ? projects.map(String) : [];
  const mine = Array.isArray(projectsJoined) ? projectsJoined.map(String) : [];
  const label = `${contextType == null ? "" : String(contextType)} ${contextId == null ? "" : String(contextId)}`.trim()
                || word("run-rules.named_context");

  if (!who)
    return { permitted: true, applied: false, ground: "NO_MEMBER_BEHIND_CALLER",
             why: PROJECT_GATE_GROUNDS.NO_MEMBER_BEHIND_CALLER, projects: all.length };
  /* REC-145: over a question NO PROJECT IS CONSULTED — neither list is read for the verdict, and the
     store asks no participation question at all. `projects` is carried only as the count the answer
     states, which the store replaces with the caller's SIGHTED count (REC-139). */
  if (!runConsultsProjects(contextType))
    return { permitted: true, applied: false, ground: "INQUIRY",
             why: PROJECT_GATE_GROUNDS.INQUIRY, projects: all.length };
  if (mine.length > 0)
    return { permitted: true, applied: true, ground: "PARTICIPANT",
             why: PROJECT_GATE_GROUNDS.PARTICIPANT, projects: all.length };

  /* THE REFUSAL ITSELF IS THE RETURN — not an object carrying one — and that is
     what puts the code where DEC-49 requires it. `refusal()` is the family's
     one builder and the code is a STRING LITERAL at this site, read by key from
     the table, so the refusal carries its row: `test/m/run-rules/table.test.mjs`
     R11 holds every refusal this module mints to its row, and control-plane's
     `test/m/control-plane/families.test.mjs` R22 holds the table reached whole.
     (The refusal-code guard that read the literal here was deleted in T20; a code arriving through a spread was invisible to it, and
     one shipped `translation: undefined` to a member exactly that way.) THIS IS THE ONE
     PLACE THE CODE IS WRITTEN: the three `ai-runs` call sites RELAY what comes
     back, precisely as its open relays C-22.7 from `./skill-version.mjs`.
     The answer carries `ok: false` and no `permitted`, so a caller's
     `if (!gate.permitted)` reads it correctly — and there is no second field
     that could disagree with the code about whether this was a refusal. */
  return refusal("AI_RUN_NOT_PROJECT_MEMBER",
    localize("run-rules.rules.starting_or_continuing_a_run", "starting or continuing a run over {label} is work inside that project, and this account has not joined it (DEC-63). This is not a capability: holding contribute would not change it, and an owner of that project inviting you would", { label: String(label) }));
}

/** REC-153 — IS THE NAMED CONTEXT THE KIND THE CALLER SAID IT IS? Membership Architecture v2 §7, the DEC-63
 *  ruling bullet, *"AND THE CONTEXT KIND IS CHECKED"* (BOB #16, 2026-09-19): *"A run's `contextType` must equal
 *  the named bundle's type; a mismatch is refused, and an id the caller cannot see answers as absent."*
 *
 *  WHY IT EXISTS: REC-145 made the verdict turn on the KIND (`runConsultsProjects` above), and the open took
 *  the kind as the caller typed it. A member who had not joined a project opened a run over THAT PROJECT'S ID
 *  by calling it an `inquiry` — permitted on the INQUIRY ground — which is the joined gate walked around by a
 *  word. Run at the open, BEFORE `projectGate`, so the gate is only ever asked about a context that is what
 *  it says it is.
 *
 *  PURE, like `projectGate`: the STORE supplies the one fact and this makes the decision.
 *    `found` — the named bundle's type (normalised) IF THE CALLER CAN SEE IT, else null. `ai-runs` asks sight
 *              through membership's `inSight` in the caller's OWN sight, so an absent id and a hidden one arrive here as the
 *              SAME null and this function cannot tell them apart — which is the §7.9 half, made structural.
 *
 *  THE RULE, in four lines, in this order (CORRECTED 2026-09-19 on BOB #16's ruling at `7d03e852`, which
 *  replaced the first build's machine carve-out and its open vocabulary):
 *    1. THE KIND IS `RUN_CONTEXTS`' CLOSED VOCABULARY — `inquiry` or `project`, spelled exactly. Any other word is
 *       REFUSED before any bundle is looked at: a closed vocabulary refuses, it does not ignore
 *       (`EXPERTISE_IS_NOT_ASSIGNED`'s precedent), and a word matched against the bundle's type would let
 *       `information` over an Information bundle through as a context kind nobody designed.
 *    2. AN ID THE CALLER CANNOT SEE ANSWERS AS ABSENT — for EVERY caller and every kind, sight before position
 *       (`#noSuchProject`'s order). A MACHINE SEES NO MORE THAN ITS PRINCIPAL (BOB #16): an `ai` credential asks
 *       in its member's sight, so its open over a project hidden from that member is that member's own answer,
 *       byte for byte; an unfiltered operator credential sees every bundle, so only a never-minted id is unseen
 *       to it, and it gets the same absent answer. This SUPERSEDES, for the open, PL-18's "a run's context need
 *       not be a bundle this store holds": a run now names a context this record holds and the caller can see.
 *    3. A bundle the caller sees answers by its type: equal to the kind said, or refused — whoever asks. A joined
 *       participant labelling their own project a question is refused too: the record would say the run is over
 *       a question when it is over a project.
 *    4. Otherwise nothing here; `projectGate` then asks participation over a project the caller can SEE.
 *  The refusal for 2 and 3 is built ONLY from what the caller sent, so a mismatch, an absent id and a hidden one
 *  are one object. Rule 1's detail differs from it only by the word the caller sent, which reveals nothing. */
export function checkRunContextKind(asked) {
  const { contextType = null, contextId = null, found = null } = asked && typeof asked === "object" ? asked : {};
  const said = String(contextType ?? "");
  const id = JSON.stringify(String(contextId ?? "").slice(0, 200));
  if (!Object.prototype.hasOwnProperty.call(RUN_CONTEXTS, said))
    return refusal("AI_RUN_NO_SUCH_CONTEXT",
      `${JSON.stringify(said.slice(0, 60))} is not a kind of run context: a run is over a question ("inquiry") or `
      + `a project ("project"), and nothing else, so no run over ${id} was opened`);
  if (found !== null && found !== undefined && found === said) return null;
  return refusal("AI_RUN_NO_SUCH_CONTEXT",
    `no ${JSON.stringify(said)} answers to ${id} here. A run's context must be the kind the run names; `
    + `something you cannot see answers exactly as something that does not exist (Membership Architecture v2 §7.9)`);
}

/** REC-152 — WHOSE RUN IS THIS, AS A PRINCIPAL? Membership v2 §7, "WHO MAY TICK AND CLOSE A RUN" (BOB #16,
 *  2026-09-19): *tick and close are the run's PRINCIPAL's acts — the member (or that member's minted machine
 *  credential) the plane stamped as `ai_runs.principal_plane` at open.*
 *
 *  The control plane stamps a principal in ONE composite form (`control-plane/index.mjs`, the `principal` stamp):
 *  `member:<id>` for a session, `<credential principal>/<tokenId>` for an `ai` credential, and
 *  `class:<cls>` for a token class. A member-kind credential's principal is `member:<id>`, so everything
 *  before the `/` is the MEMBER the credential acts for — and a member and the credentials minted for her
 *  are ONE principal, which is the ruling's parenthesis. A member id carries no `/` (`memberAdd`'s shape),
 *  so the first `/` is the credential's. A principal with NO member behind it — a token class, an
 *  organisation-kind key (`class:ai/<tokenId>`) — is compared WHOLE: an organisation key acts for the group
 *  with nobody individual behind it, so two such keys are two principals, not one. Whitespace is nobody. */
export function runPrincipalOf(principal) {
  const s = principal == null ? "" : String(principal).trim();
  if (!s.startsWith("member:")) return s;
  const i = s.indexOf("/");
  return i < 0 ? s : s.slice(0, i);
}

/** REC-152 — MAY THIS CALLER TICK OR CLOSE THIS RUN? Null when the caller IS the run's principal, else the
 *  POSITIONAL refusal (C-22.12). `caller` is the control plane's STAMP for the account asking and
 *  `principal` is `ai_runs.principal_plane` as stamped at open — never a field either party sent, because a
 *  principal a caller can name is not one (§14a).
 *
 *  THIS IS THE POSITIONAL HALF ONLY. Sight is asked FIRST, by the store, and a caller who cannot see the
 *  run's context never reaches this: they are answered as for a run that does not exist (§7.9; REC-138's
 *  order — sight before position). So the refusal below is said only to somebody who can already see the
 *  run exists, and it names nobody: not the principal, not the caller.
 *
 *  NO ADMINISTRATOR BYPASS — an administrator SEES every project and DIRECTS none (§4), and ending someone
 *  else's run directs their work. NO EMPTY BYPASS either: a caller the control plane stamped with nothing
 *  matches nobody, which is the fail-closed direction (a run nobody may drive by hand still ends by its own
 *  lease and bounds, through the reaper, which asks nobody). */
export function runPrincipalGate(asked) {
  const { caller = null, principal = null, act = null } = asked && typeof asked === "object" ? asked : {};
  const who = runPrincipalOf(caller), owner = runPrincipalOf(principal);
  if (who && owner && who === owner) return null;
  /* REC-165 (INVESTIGATIVE-SESSION.md §11 item 5, rule 1, BOB #25): the run's two PRODUCTIONS ask this too, and
     name their act so the detail says what was refused. Without `act` the sentence is REC-152's, byte for byte,
     so the tick and the close are unchanged. The act is the caller's own site's literal, never a request field. */
  const doing = typeof act === "string" && act.trim() ? act.trim() : "ticking or closing a run";
  return refusal("AI_RUN_NOT_PRINCIPAL",
    localize("run-rules.rules.doing_is_its_principals_act", "{doing} is its principal's act — the member who opened it, or a machine credential that member minted — and this account is not that principal (DEC-24: a run's work is attributed to its principal). A run nobody drives ends on its own lease and bounds", { doing: String(doing) }));
}

/** WHICH BOUND STOPPED THIS RUN — the pure decision, so the ordinary close and
 *  the reaper compute it through ONE function instead of two that agree.
 *
 *  A hand-written second copy in the reaper is the failure this repository has
 *  measured repeatedly: a parallel path that never touches the set the real
 *  path uses, agreeing at zero cost. The reaper therefore does not decide
 *  anything; it supplies rows and a clock and takes this answer.
 *
 *  `bounds` is the run's live budget rows: { bound, allowed, consumed }.
 *  An EXHAUSTED bound wins over the lease, because a run whose fetch budget ran
 *  out and then stopped heartbeating was stopped by the budget — reporting the
 *  lease there would name the symptom and hide the cause. Ties are broken by
 *  RUN_BOUNDS' declaration order so the answer is deterministic and a suite can
 *  pin it. */
export function finishedBound(bounds, opts) {
  const { expired = false, offered = null } = opts && typeof opts === "object" ? opts : {};
  if (offered != null && offered !== "") return String(offered);
  const rows = Array.isArray(bounds) ? bounds : [];
  const order = Object.keys(RUN_BOUNDS);
  const hit = rows
    .filter((r) => r && Number(r.allowed) > 0 && Number(r.consumed) >= Number(r.allowed))
    .sort((a, b) => order.indexOf(String(a.bound)) - order.indexOf(String(b.bound)))[0];
  if (hit) return String(hit.bound);
  if (expired) return "lease";
  return "completed";
}

/** The DEC-49 translation for a code, read from the one map. Exported so a
 *  surface (and the suite that stands in for one) resolves a code it RECEIVED
 *  rather than computing a refusal — DEC-8 as amended, whose protection is that
 *  the code must be received and never inferred. */
export function translationOf(code) {
  /* An own-property test, so `__proto__` and `constructor` name no code (R11: a code's translation, or null). */
  const key = String(code);
  return Object.prototype.hasOwnProperty.call(AI_RUN_CHECKS, key) ? AI_RUN_CHECKS[key].translation : null;
}

export { AI_RUN_CHECKS };

/* R8: the skill version's grammar is in the vocabulary block too; held in `./skill-version.mjs` (K82 (4)). */
export { checkSkillVersion, parseSkillVersion } from "./skill-version.mjs";
