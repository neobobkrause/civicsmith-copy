/* FL-3 / IS-9 — THE RUN HARNESS, PROVED TWO WAYS.
 *
 * The item is a DETERMINISTIC CONTROL FLOW TABLE — code, never skill — so this
 * suite has to answer two different questions, and neither answer implies the
 * other:
 *
 *   PART A · THE TABLE, PURE. `src/harness.mjs` imports in a plain node process
 *     with no miniflare, so every row can be walked EXHAUSTIVELY. That is the
 *     only way "nextStep never leaves a row except by an edge the row declares"
 *     is a measurement rather than a reading of the code. A table exercised only
 *     through the op is a table nobody can exhaust.
 *
 *   PART B · THE TABLE, THROUGH `POST /run`, INSIDE WORKERD, over a real service
 *     binding to a plane mock. Because a pure walk proves nothing about whether
 *     a CALLER can reach the feature — `op=invitelook` shipped with a
 *     ReferenceError while 1276 assertions passed (D-43) — and because three of
 *     the four acceptance clauses are about what the PLANE ends up holding.
 *
 * THE MOCK IS THE INSTRUMENT, NOT A CONVENIENCE, and FL-2's is extended rather
 * than replaced: it records every request (op, token, namespace, body), holds a
 * mutable RECORD that every MUTATING op changes, keeps a real observation LOG
 * that `op=airuntick` appends to, spends the run's BUDGET and terminates the run
 * at its own exit when a bound is exhausted — writing `runtime-ceiling-reached`
 * exactly where PL-5's `#aiRunTerminate` writes it. And it implements F10's
 * plane side the way PL-3 built it: a verbatim resubmit is keyed on the CANONICAL
 * SUBMISSION byte for byte, returns the stored refusal WITHOUT re-running the
 * checks, and climbs a `repeats` counter. **That counter is this suite's teeth.
 * The whole point of the table is that it stays at zero on a well-behaved run,
 * and a mock that could not count it could not tell a retry loop from a run.**
 */
/* NEGATIVE CONTROL: DECLARED HERE, RUN BY `test/harness.control.mjs` — deliberately NOT a `.test.mjs`, because it EDITS REAL SOURCES while it runs and no runner may discover it: `npm test` and `node --test` take only `*.test.mjs` (FL-2/PL-3/PL-4/PL-11's precedent). THE HARNESS LIVES INSIDE THIS WORKTREE and never in a shared scratchpad, which a concurrent worker overwrote between ARM and RESTORE once already. Every arm is armed ALONE with the other defences held OPEN, every restore is verified BY sha256 AND BY CONTENT (`cmp`), and every arm names what MUST fail AND what MUST NOT.
   (H1) DEDUP-BEFORE-WRITE IS THE TABLE'S SHAPE. Add a `submit` edge to `compose`'s `to` and make `nextStep` take it -> the declared-edge walk AND the no-compose-to-submit arm must both FAIL; every refusal arm, the gate and the budget arms must HOLD.
   (H2) F10 — DENIED MEANS ADJUST. Make `nextStep` return `submit` from `submit` when a refusal is set (a verbatim retry) -> the F10 edge arm and the through-the-op `repeats stays 0` arm must FAIL; the dedup arms must HOLD.
   (H3) F10's PRECONDITION. Make `adjust` return `submit` regardless of `adjusted` -> the dropped-candidate arm and the mock's `repeats` counter must FAIL; nothing else.
   (H4) LOOP TERMINATION IS NOT THE MODEL'S. Remove `maxPasses` from `NOT_JUDGEABLE` -> the overreach arms must FAIL by name; the budget arms must HOLD (this is SK-2's review criterion as code).
   (H5) THE INVESTIGATE-MODE GATE (SK-4). Set `MODES.investigate.deployed = true` -> the gate arm must FAIL; every other arm must HOLD, which is what shows the gate is a ROW and not a side effect of something else.
   (H6) LOG-ALWAYS. Make the driver skip the tick on the terminal step -> the log-always arms must FAIL naming the missing terminal entry.
   (H7) THE FOUR-LEVEL FAN-OUT. Drop `internet` from `LEVELS` -> the plane-vocabulary source pin AND the four-spawns arm must both FAIL.
   (H8) query-never-load: name a second meaning reader -> the pinned-op-set arm must FAIL (floor and ceiling both).
   (H9) THE EMPTY-RUN INSTRUMENT (VF-1's owed control 7). Make `emptyLevelCandidates` return `[]` -> the empty-run arm must FAIL: an empty run and a silent failure become indistinguishable, which is the exact defect §9's kind exists to prevent.
   (H10) OVER-STRICTNESS, nothing broken, and these must PASS.
   ALL TEN ARMS RUN 2026-08-08 IN WORKTREE agent-ad6e5ed43aac4a2ab, baseline 194/0 (this suite) and 98/0 (agent-worker.test.mjs) before each; every one AS DECLARED on the recorded pass. **FOUR CAME BACK WRONG FIRST AND EVERY ONE WAS A FINDING ABOUT THE INSTRUMENT RATHER THAN THE SUBJECT — recorded, not smoothed:** H1 never ARMED (patch matched 0 times), then exited 2 on a restore MISMATCH (two snapshots of one file collided on the copy's name — the `cmp` instrument caught what the sha256 could not), then had its MUST-NOT corrected (`queue` is DEDUP'S output, so F10 cannot hold when dedup is skipped); H2 and H9 both KILLED the suite rather than failing it (`0 pass, -1 FAIL`) on a nested read of an empty collection — the CLASS was swept, not the two sites. MEASURED figures: H1 166/28 · H2 184/10 · H3 191/3 · H4 189/4 · H5 186/8 · H6 193/1 · H7 191/3 · H8 harness 192/2 + member 95/3 · H9 187/7 · H10 194/0, 98/0, coverage --strict exit 0. **ALL TEN RE-RUN 2026-08-09 UNDER FL-5 (which changed this file's subject: `collect` became a judged row and the fan-out composes spawn contracts) — 10 of 10 still AS DECLARED, every figure identical except H8, whose patch SITE moved and now reads harness 193/1 + member 96/2.**
   (F1) FL-7 — THE MISATTRIBUTION ITSELF. Regress `gate-mode` to close on `cancelled` -> the gate arms, A6b's DIRECTION 2 and the through-the-op B7 arms must FAIL and a misattribution arm must NAME it; A6b's DIRECTION 1 and `bio-plane/test/airun.test.mjs` must HOLD.
   (F2) FL-7 — THE CATALOGUE LOSES THE WORD. Remove `mode-not-deployed` from the plane's RUN_ENDINGS -> A6b's DIRECTION 1, airun V6/V6b and the through-the-op G1/G2 must FAIL (C-22.5 refusing a bound the vocabulary no longer holds is what proves the op path is real).
   (F3) FL-7 — ONE DIRECTION ONLY, AND IT IS THE ARM THAT EARNS THE TWO-WAY CLAIM. Change the header's terminates-on word to `cancelled`, a DIFFERENT REAL ending -> DIRECTION 2 must fail ALONE, with DIRECTION 1 GREEN. Measured 208/1: exactly one assertion.
   (F4) FL-7 — OVER-STRICTNESS, ARMED. Rewrite `cancelled`'s own sentence -> airun V6b and skillsequencing D5 must object (a genuine member cancellation is still asserted as a member act); the gate and both directions must HOLD.
   FL-7's FOUR ARMS RUN 2026-08-10 IN WORKTREE agent-a0301fcdabdaf43c6, baseline harness 209/0, airun 114/0, skillsequencing 27/0, battery 164/164 · 10,117. ALL FOUR AS DECLARED — F1 203/6+22/5+114/0 · F2 207/2+108/6 · F3 208/1 · F4 112/2+26/1+209/0. **F2 CAME BACK WRONG FIRST AND IT WAS A FINDING ABOUT THE ARM: `airun 0 pass, -1 FAIL` — the suite DIED, because FL-7's own new G2 read `gl.entries[len-1].bound` and the refused close left no terminal entry. Same class as H2/H9 above and swept the same way, across every nested read FL-7 added. Knowing the class did not prevent it; running the control did.**
   (G1) FL-8 — THE DEFECT ITSELF. Empty the plane's `RUN_NEVER_STARTED` so a gate-refused run is recorded `finished` again -> airun H1/H2/W3/W5 and this suite's own FL-8 arm must FAIL, with H2 NAMING the misdescription; the over-strictness partition H3, the vocabulary pin V9 and the source arm W1 must HOLD.
   (G2) FL-8 — A SECOND COPY OF THE RULE THAT AGREES, AND IT IS THE ARM THAT EARNS THE TWO-WAY CLAIM. Replace the store's `runStatusFor(bound)` call with an inline copy returning IDENTICAL answers -> airun ARM W1 must fail ALONE, with every behavioural arm GREEN. Measured 125/1: exactly one assertion, which is what shows the source arm is a second independent claim and not the behavioural one written twice (FL-7's F3, one item on).
   (G3) FL-8 — A STATUS TERM WITH NO PRODUCER. Add a fifth term (`abandoned`) to `RUN_STATUS` -> ARM V9 (the exact SET, a guard this vocabulary had NEVER had) and ARM W3 (vocabulary -> keying: every terminal term must be reachable) must both fail, and nothing else.
   (G4) FL-8 — OVER-STRICTNESS, ARMED. Sweep `cancelled` and `completed` into `RUN_NEVER_STARTED` -> ARM H3 (the whole partition), ARM C4 (the member cancellation's status, deliberately left standing by FL-8) and ARM W3 (`finished` becomes the term with no producer) must fail; H1/H2 must HOLD, which is what shows this measures OVER-reach rather than the fix.
   (G5) FL-8 — THE MOCK DECIDES AGAIN. Put back the plane mock's hand-written status keying, in the exact spelling it carried from FL-3 until FL-8 -> A6c2 and B7's FL-8 arm must fail; A6c itself and both A6b directions must HOLD, and the plane must stay green.
   FL-8's FIVE ARMS RUN 2026-09-10 IN WORKTREE agent-a50bd4cc90737bcaf, baseline harness 213/0, airun 126/0, battery 167/167 · 10,279 on `main` before any edit. ALL FIVE AS DECLARED, each armed ALONE — G1 airun 122/4 + harness 212/1 · G2 airun 125/1 (exactly one) · G3 airun 124/2 · G4 airun 123/3 · G5 harness 211/2 + airun 126/0. **THE FINDING THAT PAID FOR G5 WAS FOUND BY MEASUREMENT AND NOT BY THE CONTROL: this suite's plane mock had been answering `stopped` for `mode-not-deployed` since FL-7 minted the ending, while the real plane answered `finished`. A mock that contradicts the plane makes every arm driven through it evidence about a plane that does not exist, and nothing compared the two.**
   (E1) SK-8's DELEGATION (2026-09-14) — THE EXTRACT ROW FLIPPED WITHOUT THE RECORD MOVING. Set `MODES.extract.deployed = true` -> this suite's NOT-deployed and closed-at-the-gate extract arms must FAIL AND, across the tree, skillsequencing ARM B4 (index 0 is no longer the only deployed mode); the CHECK and investigate arms and skillsequencing ARM B3 must HOLD (the SET is unchanged — only a flag moved). MEASURED: harness 217/4 · skillsequencing 26/1, AS DECLARED.
   (E2) THE OTHER DIRECTION OF THE PAIRING — the `extract` row REMOVED while `DEPLOYMENT_SEQUENCE.order` still names it -> this suite's row-EXISTS and NOT-DEPLOYED-YET arms must FAIL (extract is an unknown word again) AND skillsequencing ARM B3 (recorded, not in the table) and ARM B4 (the partition lost a member); the CHECK, investigate and unknown-word arms must HOLD. MEASURED: harness 217/4 · skillsequencing 25/2, AS DECLARED.
   (E3) OVER-STRICTNESS — the landed state IS the arm: `extract` present and NOT deployed, `order` `["check","investigate","extract"]` -> harness 221/0, skillsequencing 27/0 (B3 and B4 GREEN with three modes in both rosters, which is the move arm (4) of skillsequencing's own declaration exists to make impossible to do silently), fleetbundles GREEN over the rebuilt member and plane bundles.
   E1–E3 RUN 2026-09-14 IN WORKTREE bio-worktrees/FLEET, baseline harness 221/0 and skillsequencing 27/0 before each arm, every restore verified sha256 + cmp. The gate's `why` is DERIVED FROM THE TABLE since this landing, so "not deployed yet" (a known row) and "no mode this table knows" (an unknown word) are two stated facts — asserted in A6 in both directions, and read with `?.` so a deleted row FAILS an arm instead of killing the suite (the H2/H9 class, met again by design rather than by surprise).
   (T1) FL-11 — THE SEEDING DROPPED. `state.target` no longer seeded from the run's context -> FT1, FT1b, FT1c, FT3 (C-27.1 fires before the principal gate, the plane's order), FT4 and B6's four level-empty suggestions must FAIL BY NAME, with fanout FL-12b; FT0 (the mock driven directly), FT1d/FT1e, FT2 and fanout FL-12a must HOLD.
   (T2) FL-12 — THE LOCATOR SENT AS `url` AGAIN -> FT4 (the ADDRESS arm), FT4b, FT4c and fanout FL-12b must FAIL BY NAME; FT0d/FT0e, fanout FL-12a and every FL-11 arm must HOLD.
   T1 AND T2 RUN 2026-09-23 BY THE FL-11+FL-12 WORKER, each armed ALONE on `src/index.mjs`, restores verified sha256 + cmp; baseline harness 246/0, fanout 184/0. T2 AS DECLARED first run: harness 243/3, fanout 183/1. **T1 CAME BACK NOT AS DECLARED FIRST, AND IT WAS THE DECLARATION:** it named FT3 and fanout FL-12b as MUST-NOT, and both failed — a target-less suggestion is refused C-27.1 before the principal gate is asked (the plane's own order), and a request's target defaults to the run's, so both are COUPLED to the seeding. Corrected and re-run: harness 226/20, fanout 177/7, AS DECLARED. The twenty include every older arm asserting a suggestion LANDS (B4, B8, B9) — the strict mock now sees the pre-FL-11 member wherever it suggests, which the permissive mock never could. H4's patch moved with `target` joining NOT_JUDGEABLE and was re-run: 241/4, AS DECLARED.
   (T3) D-451 — THE PROJECT'S QUESTIONS IGNORED: `runContextTarget` never reads `context.questions` (`src/harness.mjs`) -> FT2, FT2d, FT2g and FT2e must FAIL BY NAME; FT2b/FT2c/FT2f, FT0* and FT1* must HOLD. RUN 2026-09-25 BY WORKER D-451 (cloud), armed ALONE, restore verified sha256 + cmp: clean harness 258/0 (255 before the item); T3 -> 254/4 AS DECLARED. T1 CORRECTED IN THE SAME LANDING, never exempted: it declared FT2 MUST-NOT ("a project run never had a target", the defect D-451 fixes); re-run -> harness 233/25, fanout 177/7 AS DECLARED, with FT2/FT2d/FT2g now failing and FT2b/c/e/f holding. D2 re-run with FT2e as its coupled refusal arm -> 248/10 AS DECLARED.
   (D1) D-452 — THE DEFECT RESTORED: `adjust` with nothing adjusted and a non-empty queue routes back to `next-pass` -> B5b's `D-452: the rest of the pass is written` must FAIL BY NAME, with the sent-exactly-once, drop-went-to-submit and counts-what-it-wrote D-452 arms, A3's `with candidates queued behind it goes on to submit the REST` and fanout B6b's legal-candidate-LANDED arm (its level-empty candidate sits behind a drop, and that assertion pinned the loss until D-452 corrected it); `D-452: the DROPPED candidate was sent ONCE and never landed`, `D-452: nothing was resent verbatim`, B4, B5, B6, A3's NOTHING-behind-it arm and every FT arm must HOLD.
   (D2) D-452 — THE LIAR'S FIX: the dropped candidate RE-QUEUED behind the rest (`src/index.mjs` `adjust`) -> `D-452: the DROPPED candidate was sent ONCE and never landed`, `D-452: nothing was resent verbatim` and B5's called-ONCE arm must FAIL BY NAME, COUPLED FT1d/FT2d/FT3 (each drives a refusal) declared; `D-452: the rest of the pass is written` must HOLD — the reason the sent-once arm exists.
   D1 AND D2 RUN 2026-09-24 BY THE D-452 WORKER on land/conduct/c18-batch8 @ b0962be0, each armed ALONE, restores verified sha256 + cmp; baseline harness 255/0 with the fix. D1 AS DECLARED first run: harness 250/5; re-run with fanout B6b added to its declaration: harness 250/5 · fanout 183/1, AS DECLARED. T1 and T2 re-run over the new arms, AS DECLARED: T1 harness 233/22 · fanout 177/7, T2 252/3 · 183/1. fanout.control 9/10 and wire-vocabulary.control clean over the corrected fanout B6b; fanout F9's one miss is the same pre-existing coverage exit. **D2 CAME BACK NOT AS DECLARED FIRST, AND IT WAS THE ARM:** re-queued at the HEAD it is a verbatim-retry loop that starves the queue, so the rest-of-pass arm failed too (243/12) — not the liar the row names. Re-armed at the TAIL: 246/9, AS DECLARED. H3 re-run under the fix (its drop arm now reads A3's NOTHING-behind-it assertion, the old one having asserted the defect): 251/4, AS DECLARED. The whole driver, 25 arms: 24 AS DECLARED; H10's harness and member suites 0 FAIL, its `coverage --strict` exit 1 PRE-EXISTING at b0962be0 (C-73.2..C-73.5 never named), not this item's.
   (T21) RE-POINTED BY AGENT-WORKER #8 (N467, N469), and the declarations above are kept as they were made: wherever an arm above names `bio-plane/test/airun.test.mjs` or `skillsequencing.test.mjs` (both deleted in T20) as what must fail or hold, the driver now runs the module test that took that share — run-rules' R1 (`m/run-rules/rules.test.mjs`) and R9 (`m/run-rules/deployment.test.mjs`), ai-runs' R14 (`m/ai-runs/tick-close.test.mjs`) and this member's `requirements.test.mjs` R14/R44 — each said at its arm. G2 is RETIRED (its only subject, airun W1, read ai-runs' source text). S1 and S2 carry REC-100's `aw-steplog` and `aw-refused` (section R below) from its deleted driver. RUN 2026-10-01: E1 E2 F1 F2 F4 G1 G3 G4 G5 S1 S2 AS DECLARED; E2 first came back NOT AS DECLARED because `requirements.test.mjs` DIED on a deleted `extract` row (read without `?.`), and that suite was made null-tolerant there.
   FULL PER-ARM DETAIL IS IN `test/harness.control.mjs`'s own header.
   D-276's five arms are NOT restated here and are NOT counted here: they belong to `test/agent-worker.control.mjs`, which drives THIS suite as well as its own, and they are enumerated once in `test/agent-worker.test.mjs`'s declaration. Naming them again here would inflate the fleet's arm count with a cross-reference — measured, at the moment of writing this sentence. **RE-MEASURED 2026-08-09 BY D-276: this suite's baseline moved 194/0 to 199/0** and the figures above went stale with it; under those arms this suite reads 192/7, 198/1 and 197/2 respectively.
 * ========================================================================= */

/* D-186: owns $TMPDIR for this process and removes it on exit. */
import { ACCOUNT, MEMBER, ACCOUNT_SECRET, withAccount } from "./account.mjs";
import "../../bio-plane/test/sandbox.mjs";

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { CONTROL_FLOW, FIRST_STEP, LEVELS, MODES, BUDGET_BOUNDS, SPENT_NOT_WATCHED, NOT_OUR_BOUNDS, JUDGEABLE, NOT_JUDGEABLE, nextStep, stopBecause, stepLog, applyJudgement, adjustedFrom, canonical, emptyLevelCandidates } from "../../agent-harness/src/harness.mjs";
import { PLANE_OPS } from "../src/ops.mjs";
/* D-276: the mock's `op=meaningrows` branch, DERIVED from the plane's own arm
   registry and refusal catalog. This suite stages ROWS through `CFG.meaningRows`
   and still can — what it may no longer do is stage a SUCCESS for an arm the
   record does not hold. */
import { MEANING_ARMS, meaningRowsBranch } from "../../agent-steps/test/plane-meaning.mjs";
/* D-323/D-324: the mock's `op=suggest` branch, DERIVED from the plane's own name
   grammar, kind set, level set and placeholder predicate — the same treatment
   `plane-meaning.mjs` gave `op=meaningrows` and for the same measured reason.
   This suite's mock used to answer `{ wrote: true }` for ANY name, ANY kind and
   ANY level, so B6's `level-empty:<level>` assertion and B4/B5/B8/B9's
   `new-version` fixtures were all green over submissions a deployed plane
   refuses (VF-4, live at 0.57.0, MEASUREMENTS M-8). */
import { suggestBranch, WIRE_CHECKS, NOT_PRINCIPAL } from "../../agent-steps/test/plane-suggest.mjs";
/* FL-12: the capture-request door, derived from the plane — it reads `address` and refuses by name. */
import { captureRequestBranch } from "../../agent-steps/test/plane-capturerequest.mjs";
import { REPORTING_LEVEL } from "../../agent-harness/src/harness.mjs";
/* agent-harness R18 (T50): an absence is written only for a level the shell shows was read over a document, so these
   direct calls state it the way the shell does: one read of each level, three documents in scope. */
const SCOPE = Object.fromEntries(LEVELS.map((l) => [l, { reads: 1, documents: 3 }]));
import { MEANING_ARM } from "../../agent-steps/src/index.mjs";
/* FL-8 / IC-67 — THE PLANE'S STATUS KEYING, TAKEN FROM THE PLANE INSTEAD OF
   REPRODUCED HERE, AND THE CORRECTION IS A MEASURED DEFECT RATHER THAN A TIDY-UP.
   The mock's `airunclose` branch computed the run's status by hand as
   `bound === "completed" || bound === "cancelled" ? "finished" : "stopped"`. That
   was right when it was written and stopped being right the moment FL-7 minted a
   THIRD ending: from then until now this mock answered `stopped` for
   `mode-not-deployed` while the real plane answered `finished`, and nothing
   caught it because nothing compared the two. A mock that contradicts the plane
   is worse than no mock — every arm driven through it is evidence about a plane
   that does not exist. The table is now BUILT from `runStatusFor` over the
   plane's own vocabularies and interpolated into the mock's source, so it cannot
   drift again; arm A6c asserts the member can close on nothing the table lacks.
   Imported in the SUITE and not in the Worker: `harness.mjs`'s own header records
   why the member itself may not import the plane's module graph. */
/* The run's vocabulary is run-rules' (the ai-runs split, K617, K649 (1)); the observation vocabulary it re-exports. */
import { RUN_BOUNDS, RUN_ENDINGS, runStatusFor, OBSERVATION_LEVELS, OBSERVATION_STATES } from "../../bio-plane/src/run-rules/index.mjs";
/* N421: the harness's exports, for the purity walk, and the member driven in this process for the op arms (A9). */
import * as HARNESS from "../../agent-harness/src/harness.mjs";
import { driveMember, SUBSESSION_LIMIT } from "./inprocess.mjs";
import { planeEntry, MEMBER_PLAN } from "./plane-world.mjs";
import { PLANE_OPS_PINNED } from "./owners.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};

/* R37, R53: the op declaration this member exports, pinned here floor and ceiling (N402: never parsed from the plane). */
/* R78 (T45): a re-examination run's reads, action, reading and procedureguides. */
const [PINNED_READS, PINNED_WRITES] = PLANE_OPS_PINNED;  /* N1073: ai-runs', capture-requests' and action-plans' ops read from them (owners.mjs) */
const WORKER_SRC_PATH = fileURLToPath(new URL("../src/index.mjs", import.meta.url));
const WORKER_SRC = readFileSync(WORKER_SRC_PATH, "utf8");
const PLANE_INDEX = readFileSync(fileURLToPath(new URL("../../bio-plane/src/plane/index.mjs", import.meta.url)), "utf8");

/* EVERY NESTED READ IN THIS FILE IS NULL-TOLERANT, AND THE CLASS WAS SWEPT
 * RATHER THAN THE TWO SITES THAT BIT.
 *
 * MEASURED, NOT ANTICIPATED: control arms H2 and H9 both came back `0 pass, -1
 * FAIL` on their first run — the suite DIED instead of failing, because
 * `out[0].kind` and `submits[1].body` threw when the armed defect made those
 * collections empty. A harness that read a missing tally as `0` would have
 * recorded both as "stayed GREEN"; this one reports `-1` for a suite that
 * printed no tail line, which is the only reason the defect was visible at all.
 * FL-2's A3 met the identical class one file over and its header says the same
 * thing: **the CLASS was swept, not the one site.** An assertion that throws
 * cannot NAME what it broke, and it takes every arm behind it with it. */

/* N421 — THE HARNESS'S PURITY, MEASURED. Every function `src/harness.mjs` exports is called over a corpus of states
   twice, with the network, the clock, randomness and the process environment TRAPPED (each access counted, none
   answered from the outside world), and the two passes' answers compared byte for byte. Nothing is logged while the
   traps are set. `uncalled` names any exported function the corpus does not reach, so a function added tomorrow
   fails here until it is walked. */
async function harnessPurity() {
  const H = HARNESS;
  const steps = [...Object.keys(H.CONTROL_FLOW), ...Object.keys(H.PLAN_FLOW), "nowhere"];
  const budgets = [null, {}, { fetches: { allowed: 1, consumed: 1 } }, { proposals: { allowed: 2, consumed: 2 } },
                   { wallclock: { allowed: 0, consumed: 9 } }];
  const states = [];
  for (const step of steps) for (const mode of ["check", "plan", "investigate", "", undefined])
    for (const budget of budgets) for (const pass of [0, 1, 3]) for (const queue of [[], [{ name: "a" }]])
      for (const refusal of [null, { code: "X" }]) for (const resumeAt of [null, "collect", "dedup"])
        states.push({ step, mode, budget, pass, maxPasses: 3, queue, refusal, adjusted: refusal == null, resumeAt,
                      reports: [{ level: "meaning", state: "LOOKED_ABSENT", observed_at: "log:1" }],
                      candidates: [{ summary: "s", category: "c", subjects: [] }], observed: "PRESENT", level: "meaning" });
  const plan = { project: "P", subjects: [{ subject: { kind: "outcome", determination: "D", standard: "S" } },
                                          { kind: "inquiry", inquiry: "I", standards: ["S2"] }],
                 options: [{ summary: "s", category: "c", subjects: [] }], proposals: [] };
  const corpus = {
    nextStep: () => states.map((x) => H.nextStep(x)),
    nextPlanStep: () => states.map((x) => H.nextPlanStep(x)),
    stopBecause: () => states.map((x) => H.stopBecause(x)),
    passLimit: () => [3, 0, -1, "2", null, undefined, NaN].map((x) => H.passLimit(x)),
    planStopBecause: () => states.map((x) => H.planStopBecause(x)),
    gateStep: () => states.map((x) => H.gateStep(x)),
    advance: () => states.map((x) => H.advance(x, H.nextStep(x))),
    planAdvance: () => states.map((x) => H.planAdvance(x, H.nextPlanStep(x))),
    stepLog: () => states.map((x) => H.stepLog(x, H.nextStep(x))),
    applyJudgement: () => states.map((x) => H.applyJudgement(x, { candidates: [], pass: x.pass ? 1 : undefined })),
    applyPlanJudgement: () => states.map((x) => H.applyPlanJudgement(x, { candidates: [{ summary: "s", score: 1 }] })),
    emptyLevelCandidates: () => states.map((x) => H.emptyLevelCandidates({ ...x, scope: SCOPE }, "INQ-1")),
    runContextTarget: () => [{ context: { type: "inquiry", id: "I" } }, { context: { type: "project", id: "P", questions: ["A"] } },
                             { context: null }].map((x) => H.runContextTarget(x)),
    resumableState: () => states.map((x) => H.resumableState(x)),
    stateBytes: () => states.map((x) => H.stateBytes(x)),
    publishableState: () => states.map((x) => H.publishableState(x, 300, x.mode === "plan" ? H.PLAN_FLOW : H.CONTROL_FLOW)),
    resumeFrom: () => states.map((x) => H.resumeFrom(x, H.flowFor(x.mode))),
    resumeTargets: () => [H.resumeTargets(H.CONTROL_FLOW), H.resumeTargets(H.PLAN_FLOW)],
    flowFor: () => ["check", "plan", "x"].map((m) => Object.keys(H.flowFor(m))),
    canonical: () => states.map((x) => H.canonical(x)),
    adjustedFrom: () => states.map((x) => H.adjustedFrom(x.refusal, x.queue[0] ?? null)),
    proposalKey: () => states.map((x) => H.proposalKey(x.candidates[0])),
    planDedup: () => [H.planDedup(states[0].candidates, plan), H.planDedup([], null)],
    planSubjectReads: () => [H.planSubjectReads(plan), H.planSubjectReads(null)],
    earlierPlans: () => [H.earlierPlans({ plans: [{ id: "A", project: "P" }, { id: "B", project: "Q" }] }, "P", "B")],
    whyWithUndetermined: () => [H.whyWithUndetermined("why", [{ op: "plan", id: "X", code: "C" }]),
                                H.whyWithUndetermined("w".repeat(900), [])],
    /* agent-harness R18, R19 (T50) */
    levelsWithoutScope: () => states.map((x) => H.levelsWithoutScope(x)),
    disagreementKey: () => [{ record: "R", levels: ["meaning", "content"] }, { record: "R", levels: ["content", "meaning"] }]
      .map((p) => H.disagreementKey(p)),
    disagreementsToSettle: () => states.map((x) => H.disagreementsToSettle({ ...x, disagreements: [{ record: "R", levels: ["meaning", "content"] }] })),
    /* agent-harness R20–R24 (T53) */
    providerStateKey: () => [...states.map((x) => H.providerStateKey(x)), H.providerStateKey({ session_id: "s" }),
                             H.providerStateKey(null), H.providerStateKey([1])],
    resumeAt: () => states.flatMap((x) => [H.resumeAt(x, x.step), H.resumeAt(x, { at: x.step, completed: true }),
                                           H.resumeAt(x, { at: "compose", completed: true }, H.PLAN_FLOW)]),
    needOf: () => ["ask", "standing", "enquire", "draft", "draft:case_account", "draft:nope", "read", "extract", "transcribe", "subsession", "check", "plan", "check:judge", "nothing", null, 7].map((r) => H.needOf(r)),
    partOf: () => ["ask", "standing", "enquire", "draft", "draft:case_account", "draft:nope", "read", "extract", "transcribe", "subsession", "check", "plan", "check:judge", "nothing", null, 7].map((r) => H.partOf(r)),
    disclosureGate: () => [[{ disclosed: [{ provider: "p", host: "h" }] }, { provider: "p", host: "h" }],
                           [{ disclosed: [] }, { provider: "p", host: "h" }], [null, null]].map(([a, r]) => H.disclosureGate(a, r)),
  };
  const exported = Object.entries(H).filter(([, v]) => typeof v === "function").map(([k]) => k);
  const uncalled = exported.filter((k) => !corpus[k]);
  const trapped = { fetch: 0, clock: 0, random: 0, process: 0 };
  const saved = { fetch: globalThis.fetch, now: Date.now, Date: globalThis.Date, random: Math.random,
                  process: globalThis.process };
  const RealDate = Date;
  let calls = 0;
  const pass = () => JSON.stringify(Object.keys(corpus).map((k) => { const r = corpus[k](); calls += Array.isArray(r) ? r.length : 1; return r; }));
  let first, second;
  try {
    globalThis.fetch = () => { trapped.fetch += 1; throw new Error("the harness may not fetch"); };
    Date.now = () => { trapped.clock += 1; return 0; };
    globalThis.Date = new Proxy(RealDate, { construct() { trapped.clock += 1; return new RealDate(0); } });
    Math.random = () => { trapped.random += 1; return 0.5; };
    globalThis.process = new Proxy(saved.process, { get(t, k) { trapped.process += 1; return t[k]; } });
    first = pass();
    second = pass();
  } finally {
    globalThis.fetch = saved.fetch; Date.now = saved.now; globalThis.Date = saved.Date; Math.random = saved.random;
    globalThis.process = saved.process;
  }
  return { calls, uncalled, trapped, first, second };
}

/* ================================================================
 * PART A · THE TABLE, PURE AND EXHAUSTIVE
 * ================================================================ */
console.log("\n=== PART A · the control-flow table, walked exhaustively with no network ===");

console.log("\n--- A1 · the table is DATA, and its edges are the enforcement ---");
{
  const steps = Object.keys(CONTROL_FLOW);
  t("every row declares what it does, whether it judges, that it logs, and where it may go",
    steps.filter((s) => {
      const r = CONTROL_FLOW[s];
      return typeof r.does !== "string" || !("judged" in r) || r.logs !== true || !Array.isArray(r.to);
    }), []);
  t("every `to` target is itself a row (no edge points at nothing)",
    steps.flatMap((s) => CONTROL_FLOW[s].to.filter((x) => !CONTROL_FLOW[x])), []);
  t("`close` is the only terminal row", steps.filter((s) => CONTROL_FLOW[s].to.length === 0), ["close"]);
  t("the first step is a row", CONTROL_FLOW[FIRST_STEP] != null, true);
  t("every row is reachable from the first step", (() => {
    const seen = new Set([FIRST_STEP]);
    const stack = [FIRST_STEP];
    while (stack.length) for (const n of CONTROL_FLOW[stack.pop()].to) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    return steps.filter((s) => !seen.has(s));
  })(), []);

  /* DEDUP-BEFORE-WRITE, AS THE SHAPE OF THE TABLE AND NOT AS A RULE A STEP
     REMEMBERS. The absent edge IS the enforcement, so the assertion is about
     the absence. */
  t("there is NO edge from `compose` to `submit` — dedup is not skippable",
    CONTROL_FLOW.compose.to.includes("submit"), false);
  t("`compose` goes to `dedup` and to `close`, and nowhere else",
    [...CONTROL_FLOW.compose.to].sort(), ["close", "dedup"]);
  /* R11, N153 (T10): `resume` reaches `submit` too, and ONLY to continue a queue a previous segment's `dedup`
     formed — the state the run's own last tick published at `submit`. It never reaches it on its own. */
  t("`dedup` is the only row that can reach `submit` other than `submit`, `adjust` and a resumed `resume`",
    Object.keys(CONTROL_FLOW).filter((s) => CONTROL_FLOW[s].to.includes("submit")).sort(),
    ["adjust", "dedup", "resume", "submit"]);
  t("…and `resume` goes to `submit` only when the run's published state is AT `submit`",
    [null, "plan", "compose", "dedup", "adjust", "submit"]
      .filter((resumeAt) => nextStep({ step: "resume", mode: "check", pass: 0, maxPasses: 3, resumeAt }).step === "submit"),
    ["submit"]);
}

console.log("\n--- A2 · nextStep NEVER leaves a row except by an edge that row declares ---");
{
  /* THE EXHAUSTIVE WALK. Every row crossed with every combination of the state
     fields any row reads. This is the arm that makes the table load-bearing:
     without it, `to` is a comment. */
  const bools = [false, true];
  const budgets = [
    null,
    { fetches: { allowed: 10, consumed: 0 }, subsessions: { allowed: 10, consumed: 0 }, wallclock: { allowed: 10, consumed: 0 } },
    { fetches: { allowed: 1, consumed: 1 }, subsessions: { allowed: 10, consumed: 0 }, wallclock: { allowed: 10, consumed: 0 } },
    { subsessions: { allowed: 2, consumed: 5 } },
    { wallclock: { allowed: 0, consumed: 0 } },
  ];
  const illegal = [];
  let walked = 0;
  for (const step of Object.keys(CONTROL_FLOW))
    for (const mode of ["check", "investigate", "", "nonsense"])
      for (const budget of budgets)
        for (const passN of [0, 1, 3])
          for (const maxPasses of [0, 1, 3])
            for (const hasRefusal of bools)
              for (const wasAdjusted of bools)
                for (const queueLen of [0, 1, 2]) {
                  walked += 1;
                  const state = { step, mode, budget, pass: passN, maxPasses,
                                  refusal: hasRefusal ? { code: "X" } : null,
                                  adjusted: wasAdjusted,
                                  queue: Array.from({ length: queueLen }, (_, i) => ({ name: `c${i}` })),
                                  reports: [], candidates: [], resumedFrom: 0 };
                  const d = nextStep(state);
                  if (!CONTROL_FLOW[step].to.includes(d.step) && !(step === "close" && d.step === "close"))
                    illegal.push({ step, to: d.step, declared: CONTROL_FLOW[step].to });
                }
  /* GUARDED AGAINST AN EMPTY CORPUS — a walk over nothing reports its verdict
     triumphantly, which is a receipt this project has collected. */
  t("the walk actually walked something", walked > 5000, true);
  t("no transition left a row by an undeclared edge", illegal.slice(0, 5), []);
  t("every step returns a `why` a log entry can carry",
    Object.keys(CONTROL_FLOW).filter((step) =>
      !String(nextStep({ step, mode: "check", pass: 0, maxPasses: 3, queue: [] }).why || "").length), []);
}

console.log("\n--- A3 · F10: a refusal routes to ADJUST, never to a verbatim retry ---");
{
  const refusedAt = { step: "submit", mode: "check", pass: 0, maxPasses: 3,
                      refusal: { code: "SUGGEST_BOILERPLATE" }, queue: [{ name: "a" }, { name: "b" }] };
  t("a refused submit goes to `adjust`", nextStep(refusedAt).step, "adjust");
  t("and it does NOT go back to `submit`", nextStep(refusedAt).step === "submit", false);
  t("the reason names F10's rule rather than the budget", /never to a verbatim retry/.test(nextStep(refusedAt).why), true);
  /* THE BUDGET IS THE BACKSTOP, NOT THE MECHANISM: with the budget WIDE OPEN the
     refusal must still route to adjust. An arm that only fired when the budget
     was tight would be measuring the backstop. */
  t("with the budget wide open it still routes to adjust",
    nextStep({ ...refusedAt, budget: { fetches: { allowed: 1e6, consumed: 0 } } }).step, "adjust");

  const adjusted = { step: "adjust", mode: "check", pass: 0, maxPasses: 3, adjusted: true, queue: [{ name: "a" }] };
  t("an ADJUSTED submission may re-enter `submit`", nextStep(adjusted).step, "submit");
  /* CORRECTED 2026-09-24 (D-452), AND THE OLD ASSERTION WAS WRONG RATHER THAN OLD. It read "an UNADJUSTED
     one drops the candidate instead" and expected `next-pass` from a state whose queue still held `a` — so it
     asserted that one dropped candidate ends the PASS, which is the defect: every candidate queued behind the
     dropped one (the table-made level-empty ones included) was never written. A drop drops ONE candidate. The
     dropped one is already off the queue (`submit` shifted it), so `submit` here writes the rest, never it. */
  const dropped = { ...adjusted, adjusted: false };
  t("an UNADJUSTED one with candidates queued behind it goes on to `submit` the REST", nextStep(dropped).step, "submit");
  t("an UNADJUSTED one with NOTHING behind it ends the pass", nextStep({ ...dropped, queue: [] }).step, "next-pass");
  t("and a missing queue is read as empty, not as a reason to write", nextStep({ ...dropped, queue: undefined }).step,
    "next-pass");
  t("and says why in the record's terms, naming PL-3's counter — whether or not anything is behind it",
    [/repeats/.test(nextStep(dropped).why), /repeats/.test(nextStep({ ...dropped, queue: [] }).why)], [true, true]);

  console.log("\n  -- `adjustedFrom` answers by the BYTES, and key order is not a change --");
  t("identical objects are not an adjustment", adjustedFrom({ a: 1, b: 2 }, { a: 1, b: 2 }), false);
  t("the same object written in a different key order is not an adjustment",
    adjustedFrom({ a: 1, b: 2 }, { b: 2, a: 1 }), false);
  t("a changed value IS an adjustment", adjustedFrom({ a: 1 }, { a: 2 }), true);
  t("a removed field IS an adjustment", adjustedFrom({ a: 1, b: 2 }, { a: 1 }), true);
  t("null against null is not an adjustment", adjustedFrom(null, null), false);
  t("nested arrays compare by content", adjustedFrom({ l: [1, 2] }, { l: [1, 2] }), false);
  t("and a nested change is caught", adjustedFrom({ l: [{ x: 1 }] }, { l: [{ x: 2 }] }), true);
  t("canonical() sorts keys at every depth",
    canonical({ b: { d: 1, c: 2 }, a: 3 }), '{"a":3,"b":{"c":2,"d":1}}');
}

console.log("\n--- A4 · loop termination and the pass count are the TABLE's, never the model's ---");
{
  t("passes done >= maxPasses stops the loop", stopBecause({ pass: 3, maxPasses: 3 }), "completed");
  t("below it, nothing stops it", stopBecause({ pass: 1, maxPasses: 3 }), null);
  t("an exhausted budget stops it and NAMES the bound",
    stopBecause({ pass: 0, maxPasses: 3, budget: { subsessions: { allowed: 4, consumed: 4 } } }), "subsessions");
  /* ABSENT IS NOT ZERO, and this is the arm that matters most in the class: an
     unknown allowance read as exhausted would stop a run and name a bound that
     never bit — a run's own instrument manufacturing a false cause. */
  t("an ABSENT allowance is not an exhausted one", stopBecause({ pass: 0, maxPasses: 3, budget: {} }), null);
  t("a zero allowance is not an exhausted one either",
    stopBecause({ pass: 0, maxPasses: 3, budget: { fetches: { allowed: 0, consumed: 0 } } }), null);
  t("the bound named is deterministic in BUDGET_BOUNDS order",
    stopBecause({ pass: 0, maxPasses: 3,
      budget: { wallclock: { allowed: 1, consumed: 9 }, fetches: { allowed: 1, consumed: 9 } } }), "fetches");
  t("BUDGET_BOUNDS is the design's own three (§14b.6)", BUDGET_BOUNDS, ["fetches", "subsessions", "wallclock"]);
  t("`runtime` is SPENT but not watched by the table — the plane decides it",
    [Object.keys(SPENT_NOT_WATCHED), BUDGET_BOUNDS.includes("runtime")], [["runtime"], false]);
  t("`lease` is nobody's to spend here", Object.keys(NOT_OUR_BOUNDS), ["lease"]);
  t("every bound this harness names is a bound the PLANE declares",
    [...BUDGET_BOUNDS, ...Object.keys(SPENT_NOT_WATCHED), ...Object.keys(NOT_OUR_BOUNDS)]
      .filter((b) => !Object.prototype.hasOwnProperty.call(RUN_BOUNDS, b)),
    []);

  console.log("\n  -- SK-2's review criterion, as CODE: a judgement may not touch control flow --");
  for (const field of NOT_JUDGEABLE) {
    const r = applyJudgement({ pass: 0 }, { [field]: 99 });
    t(`a judgement setting \`${field}\` is REFUSED and NAMED`, [r.ok, r.overreach], [false, [field]]);
  }
  t("the refusal cites the measurement rather than a preference",
    /TREC 2011/.test(applyJudgement({}, { maxPasses: 99 }).detail), true);
  t("a judgement setting only judgeable fields is accepted",
    applyJudgement({ pass: 0 }, { candidates: [{ name: "x" }] }).ok, true);
  t("and it changes ONLY what it named",
    applyJudgement({ pass: 7, candidates: [] }, { candidates: [1] }).state, { pass: 7, candidates: [1] });
  t("a mixed judgement is refused whole, never partly applied",
    applyJudgement({ pass: 7 }, { candidates: [1], pass: 0 }).ok, false);
  t("JUDGEABLE and NOT_JUDGEABLE are disjoint", JUDGEABLE.filter((k) => NOT_JUDGEABLE.includes(k)), []);
}

console.log("\n--- A5 · the four-level fan-out, and the levels are the PLANE's vocabulary ---");
{
  /* THE SOURCE PIN. `LEVELS` is a copy (a fleet member ships alone and the plane
     publishes no op that names them), so what closes the drift is reading the
     plane's own file. A fifth level added there fails HERE rather than silently
     going unsearched — which is D-113's purge-list defect, one directory over. */
  /* T10: IMPORTED, no longer read as text — the plane now re-exports the vocabulary from observation-log, so the
     block this arm scanned for left `airun.mjs` and the pin went blind. The export is what the plane holds. */
  const planeLevels = Object.keys(OBSERVATION_LEVELS || {});
  t("the plane's OBSERVATION_LEVELS was actually found", planeLevels.length > 0, true);
  t("the plane declares four levels", planeLevels.length, 4);
  t("and LEVELS is exactly the plane's set, in the plane's order", LEVELS, planeLevels);
}

console.log("\n--- A6 · SK-4's gate is a ROW in this table, not a sentence in a skill ---");
{
  t("CHECK is deployed", MODES.check.deployed, true);
  t("investigate-fresh is NOT deployed", MODES.investigate.deployed, false);
  const gate = (mode) => nextStep({ step: "gate-mode", mode, pass: 0, maxPasses: 3 });
  t("a CHECK run passes the gate to `resume`", gate("check").step, "resume");
  t("an investigate run is CLOSED at the gate", gate("investigate").step, "close");
  /* CORRECTED 2026-08-10 BY FL-7 (IC-62), AND THE OLD EXPECTATION WAS `cancelled`.
     IT WAS RIGHT WHEN WRITTEN because it recorded what the gate then DID; it was
     never right about what the gate MEANT. The plane defines `cancelled` as "a
     member stopped it" and no member is present at this branch — the gate refused
     a launch before anything was spent — so the assertion was pinning a
     misattribution rather than a rule. FL-7 added `mode-not-deployed` to the
     plane's RUN_ENDINGS (the word this file's own header had already promised and
     nothing had ever defined) and this arm moved with the fix. */
  t("and the ending NAMES THE MACHINE THAT ACTED — a gate refusal is not a member cancelling a run",
    gate("investigate").bound, "mode-not-deployed");
  t("the refusal cites VF-5/SK-4's sequencing", /VF-5\/SK-4/.test(gate("investigate").why), true);
  t("an unknown mode is closed too, never defaulted to CHECK", gate("wat").step, "close");
  t("an absent mode is closed too", gate(undefined).step, "close");

  /* SK-8's DELEGATION, 2026-09-14 — THE EXTRACT ROW. SK-8 built the plane half
     of the EXTRACT role and measured that this gate refused the word as UNKNOWN,
     so nothing could drive one. The row lands NOT deployed (§7.3 point 7's
     provisional NO on a standing EXTRACT run) and its whole value today is that
     the refusal names a DIFFERENT fact: a known row not yet enabled, rather
     than a word the table never held. Two absences, two sentences, both
     asserted — and read with `?.` so a deleted row FAILS the arm instead of
     killing the suite (the H2/H9 class). */
  t("SK-8's delegation: an `extract` row EXISTS in the table", Object.prototype.hasOwnProperty.call(MODES, "extract"), true);
  t("and it is NOT deployed — §7.3(7)'s provisional NO holds; flipping it is an edit under review, not this row",
    MODES.extract?.deployed ?? null, false);
  t("the row names its authority (§7.3)", /7\.3/.test(MODES.extract?.does ?? ""), true);
  t("an extract run is CLOSED at the gate on the machine's word",
    [gate("extract").step, gate("extract").bound], ["close", "mode-not-deployed"]);
  t("and the refusal says NOT DEPLOYED YET — a known row, never an unknown word",
    [/not deployed yet/.test(gate("extract").why), /no mode this table knows/.test(gate("extract").why)], [true, false]);
  t("while an unknown word's refusal says the table does not know it — the two absences are different facts and both are stated",
    [/no mode this table knows/.test(gate("wat").why), /not deployed yet/.test(gate("wat").why)], [true, false]);
  t("the sentence is DERIVED from the table: it lists what is deployed now and what is not yet",
    [/deployed now: check/.test(gate("extract").why), /not yet: .*extract/.test(gate("extract").why)], [true, true]);
  /* OVER-STRICTNESS, and it is the arm that keeps the correction honest: the fix
     must not have made `cancelled` unreachable or unmeaning. A member stopping a
     run is still `cancelled`, and the gate must never produce that word. */
  t("the gate NEVER closes on `cancelled` for any mode it refuses — the member's word is not the machine's",
    ["wat", undefined, "investigate", ""].map((m) => gate(m).bound).filter((b) => b === "cancelled"), []);
  /* THE GATE FIRES BEFORE ANY BOUND IS CONSULTED. A mode that is not deployed
     must not be able to report that it ran out of budget — that would be a run
     that never should have started blaming the budget. */
  t("the gate fires even with every budget exhausted",
    nextStep({ step: "gate-mode", mode: "investigate", pass: 9, maxPasses: 1,
               budget: { fetches: { allowed: 1, consumed: 9 } } }).bound, "mode-not-deployed");
}

console.log("\n--- A6b · THE GATE'S ENDING AND THE PLANE'S CATALOGUE AGREE, FOR EVERY MODE IT REFUSES (FL-7) ---");
{
  /* WHY THIS ARM EXISTS, and it is a receipt rather than a precaution. From FL-3 until FL-7 the gate closed a refused
     run on `cancelled` (a member's word) while `mode-not-deployed` was defined nowhere in the repository. Two failures:
     an ending nothing defines, and a gate producing the wrong one.
     CONVERTED BY N421 (T19), NEVER EXEMPTED. This arm compared the gate with a sentence in `src/harness.mjs`' header
     prose ("terminates on `…`"), read as TEXT. A comment is not the member's interface, and the agreement that matters
     is between what the gate PRODUCES and what the plane's catalogue DEFINES, over every input the gate refuses — so
     that is what is asserted, both ways: no refused input produces an ending the catalogue lacks, and the ending it
     produces is the one ending the catalogue gives a launch nobody started. */
  t("the plane's RUN_ENDINGS was actually read — an empty import would pass everything",
    RUN_ENDINGS != null && typeof RUN_ENDINGS === "object", true);
  const planeEndings = Object.keys(RUN_ENDINGS || {});
  t("REACH: the catalogue is non-trivial (floor 3), so neither direction below is vacuous", planeEndings.length >= 3, true);
  /* Every input the gate refuses: each held mode not deployed, a word the table does not hold, absent, empty, and a
     deployed mode mis-spelled. */
  const refusedModes = [...Object.keys(MODES).filter((m) => !MODES[m].deployed), "wat", undefined, "", "CHECK", "check "];
  const endings = refusedModes.map((mode) => nextStep({ step: "gate-mode", mode, pass: 0, maxPasses: 3 }).bound);
  t("REACH: the gate refused every one of those inputs (and there are several)",
    [refusedModes.length >= 6, endings.every((b) => b != null)], [true, true]);
  t("DIRECTION 1 (gate -> catalogue): every ending the gate produces for a refused launch is DEFINED in the plane's "
    + "RUN_ENDINGS. Pre-FL-7 the word was defined nowhere, and this direction is what now refuses that",
    endings.filter((b) => !planeEndings.includes(b)), []);
  t("DIRECTION 2 (one ending): every refused input closes on the SAME ending, and it is the plane's mode-not-deployed",
    [...new Set(endings)], ["mode-not-deployed"]);
  t("and it is not the member's word: the gate's ending is never `cancelled`, for any input it refuses",
    endings.filter((b) => b === "cancelled"), []);
}

console.log("\n--- A7 · §9's empty-level kind is DERIVED BY THE TABLE (VF-1's owed control 7) ---");
{
  const reports = [
    { level: "meaning", state: "LOOKED_ABSENT", observed_at: "log:11" },
    { level: "content", state: "NEVER_LOOKED" },
    { level: "document", state: "LOOKED_INDETERMINATE", observed_at: "log:13" },
    { level: "internet", state: "partial", observed_at: "log:14" },
  ];
  const out = emptyLevelCandidates({ reports, scope: SCOPE }, "INQ-1");
  t("exactly one candidate, for the one level that was LOOKED_ABSENT", out.map((c) => c.level), ["meaning"]);
  t("it is §9's kind", out[0]?.kind ?? null, "level-empty");
  t("it names the inquiry and the observation-log address that establishes it",
    [out[0]?.target ?? null, out[0]?.observed_at ?? null], ["INQ-1", "log:11"]);
  /* D-129's four are DIFFERENT CLAIMS and only one of them is an absence. */
  for (const st of ["NEVER_LOOKED", "LOOKED_INDETERMINATE", "PRESENT", "partial"])
    t(`'${st}' does NOT produce an empty-level claim`,
      emptyLevelCandidates({ reports: [{ level: "meaning", state: st, observed_at: "x" }], scope: SCOPE }, "I"), []);
  /* CORRECTED 2026-09-13 (D-323): the candidate's `level` is the spelling a
     SUGGESTION is written in (`SUGGEST_LEVELS`), not the spelling the run's
     observation log uses (`OBSERVATION_LEVELS`), and the two disagree on one
     member. This arm compared the candidate against the LOG's vocabulary, which
     is why nothing saw that the document-level candidate was refused
     `SUGGEST_EMPTY_LEVEL_UNSTATED` / C-27.6 by every deployed plane. The
     one-per-level claim the arm is actually about is unchanged and is now
     asserted over the wire's four. */
  t("all four empty produce four candidates, one per level — absence at one level is not absence at the next",
    emptyLevelCandidates({ reports: LEVELS.map((l) => ({ level: l, state: "LOOKED_ABSENT", observed_at: "x" })), scope: SCOPE }, "I")
      .map((c) => c.level), LEVELS.map((l) => REPORTING_LEVEL[l]));
  t("no reports at all produce nothing (an unrun search is not an absence)",
    emptyLevelCandidates({ reports: [] }, "I"), []);
  t("and a malformed state carries nothing", emptyLevelCandidates({}, "I"), []);
}

console.log("\n--- A8 · log-always: every row logs, and the entry is in the PLANE's vocabulary ---");
{
  t("every row declares `logs: true`",
    Object.keys(CONTROL_FLOW).filter((s) => CONTROL_FLOW[s].logs !== true), []);
  const e = stepLog({ step: "fanout", level: "document", observed: "LOOKED_ABSENT" },
                    { step: "collect", why: "four sub-sessions spawned" });
  t("the entry names the transition it records", e.subject, "fanout -> collect");
  t("and carries D-129's state", e.state, "LOOKED_ABSENT");
  /* CORRECTED BY R26 (K148), NEVER EXEMPTED: this read "a control-flow entry that observed nothing is
     NEVER_LOOKED", and the record refuses NEVER_LOOKED from every member entry (observation-log R3). A step that
     looked at nothing sends no entry at all. */
  t("a control-flow step that observed nothing sends NO entry — never NEVER_LOOKED (R26, K148)",
    [stepLog({ step: "plan" }, { step: "fanout", why: "w" }),
     stepLog({ step: "plan", observed: "NEVER_LOOKED" }, { step: "fanout", why: "w" })], [null, null]);
  const term = stepLog({ step: "next-pass", observed: "LOOKED_ABSENT" }, { step: "close", why: "done", bound: "completed" });
  t("the terminal entry is marked terminal and names the bound", [term.terminal, term.bound], [true, "completed"]);
  t("a non-terminal entry names no bound",
    [e.terminal, e.bound], [false, null]);
  /* D-104's split travels: our governor holding a host is a fact about US. */
  t("a governed observation carries the flag the plane's C-22.2 reads",
    stepLog({ step: "plan", governed: true, observed: "LOOKED_INDETERMINATE" }, { step: "fanout", why: "w" })?.governed, true);
  /* REC-100 / IC-130 — THE UNIT HALF OF SECTION R. A model-judged PRESENT is
     not written as PRESENT: this entry can name nothing that was found, and the
     plane now refuses a PRESENT that names nothing (C-22.10). */
  const judged = stepLog({ step: "collect", level: "document", observed: "PRESENT" },
                         { step: "compose", why: "the reports are in" });
  t("A8 (REC-100): a model-judged PRESENT is recorded LOOKED_INDETERMINATE, carries no invented "
    + "referent, and STATES the judgement in its detail",
    [judged.state, "result_ref" in judged, "result_kind" in judged,
     judged.detail.startsWith("the model judged PRESENT"), judged.detail.endsWith("the reports are in")],
    ["LOOKED_INDETERMINATE", false, false, true, true]);
  t("every state this harness can emit is in the plane's D-129 vocabulary",
    ["NEVER_LOOKED", "LOOKED_ABSENT", "LOOKED_INDETERMINATE", "PRESENT", "partial"]
      .filter((s) => !Object.prototype.hasOwnProperty.call(OBSERVATION_STATES, s)), []);
}

console.log("\n--- A9 · query-never-load: the ops are PINNED, and every one is the plane's ---");
{
  /* R37, N402 (K575): THE DECLARATION THIS MEMBER EXPORTS, pinned op by op with its `mutating` flag. It used to be
     parsed against the plane's OPS table from source; that text moved, the parse came back empty and passed nothing.
     The cross-check (every op in the plane's table, the flag agreeing, every write in `AI_RUN_ACTIONS`) is
     control-plane's pin of this export (layer 11), which a layer-6 suite may not import. */
  t("R37: every declared op states `mutating` as a boolean and a reason",
    Object.entries(PLANE_OPS).filter(([, d]) => typeof d.mutating !== "boolean" || !(typeof d.why === "string" && d.why))
      .map(([op]) => op), []);
  t("R37, R53: the reads are exactly those R37 and R53 list",
    Object.keys(PLANE_OPS).filter((op) => PLANE_OPS[op].mutating === false).sort(), PINNED_READS);
  /* FLOOR AND CEILING BOTH, exactly as FL-2 pinned `{whoami}`. A call this
     member gains is a call somebody decided to give it, and a call it loses is
     visible too. */
  /* CORRECTED 2026-09-23 by D-220, never exempted: this read "exactly these nine" over a list of TEN. D-220 gives
     the member two READS, `search` and `versionchain` — the `collect` row resolves each citation to its document
     through the record's own version chain (INVESTIGATIVE-SESSION.md §3, consumer (3)), so a document is counted
     ONCE with its versions. Both are non-mutating in the plane's table, which the two arms above hold. */
  /* R48 added the thirteenth: `affordances`, what the plane publishes, which carried the rendered skill pack; since
     T36 (N695) it is `agentpack`, the pack and its fences served apart, and `affordances` is no op of this member.
     R53 (K660) adds mode `plan`'s: `plan`, `plans`, its reads (R51) and the write `optionpropose`. */
  t("R37, R53: the pinned op set is exactly the reads and the writes, nothing else",
    Object.keys(PLANE_OPS).sort(), [...PINNED_READS, ...PINNED_WRITES].sort());
  /* CONVERTED BY N421 (T19): these two arms read op names out of `src/index.mjs`' TEXT (`call("…")`, `askPlane(env,
     "…")`). They are measured now at the interface: the member's own handler driven in this process through a supplied
     run, a model run and a plan run (`test/inprocess.mjs`), and every op that reached its PLANE binding counted. */
  const { drives: D, all: ALL } = await driveMember();
  const reached = [...new Set(ALL.planeCalls.map((c) => c.op))].sort();
  t("every op the DRIVER actually sent the plane, across a supplied, a model and a plan run, is in the pinned set",
    [reached.length > 10, reached.filter((op) => !PLANE_OPS[op])], [true, []]);
  t("and the round trip's own op is too, and it is the first thing every run asks",
    [PLANE_OPS.whoami != null, [D.supplied, D.model, D.plan].map((d) => d.planeCalls[0]?.op)],
    [true, ["whoami", "whoami", "whoami"]]);
  t("R37: and the writes are exactly the five the plane makes for it (control-plane pins them to AI_RUN_ACTIONS)",
    Object.keys(PLANE_OPS).filter((op) => PLANE_OPS[op].mutating === true).sort(), PINNED_WRITES);

  /* QUERY, NEVER LOAD. The meaning-grain read is PL-9's op and this item
     CONSUMES it — there must be exactly one meaning reader named anywhere in
     this member, and no second one built beside it. */
  t("the meaning-grain read is PL-9's op", PLANE_OPS.meaningrows != null, true);
  /* CONVERTED BY N421: this counted the literal "meaningrows" in the driver's TEXT (one occurrence = one reader). At the
     interface, ONE READER means every meaning-grain read the run makes reaches the plane as PL-9's op: the parent's at
     the one arm it declares, and a sub-session's through the same door — and no other op is asked for rows. */
  const meaningReads = ALL.planeCalls.filter((c) => c.op === "meaningrows");
  t("and every meaning read went through that one op: the parent's at MEANING_ARM, the sub-sessions' through the same door",
    [D.supplied.planeCalls.filter((c) => c.op === "meaningrows").length > 0,
     [...new Set(D.supplied.planeCalls.filter((c) => c.op === "meaningrows").map((c) => c.query.rows))],
     D.model.planeCalls.filter((c) => c.op === "meaningrows" && c.query.limit === String(SUBSESSION_LIMIT)).length >= LEVELS.length,
     ALL.planeCalls.filter((c) => c.op !== "meaningrows" && "rows" in (c.query || {})).length],
    [true, [MEANING_ARM], true, 0]);
  t("no op in the pinned set serves document BYTES",
    Object.keys(PLANE_OPS).filter((op) => ["capture", "acquire", "image", "archivelookup", "publishedmanifest"].includes(op)), []);

  console.log("\n  -- and the harness holds NO scope, NO class and NO allow-list (D-199 (2)) --");
  /* CONVERTED BY N421 (T19): these read `src/harness.mjs`' TEXT for `class: "ai"`, an `aik-` literal, `fetch(`,
     `Date.now`, `globalThis` and `process.`. At the interface: what the harness EXPORTS carries no class, scope or
     credential, and its functions, called over a broad corpus with the network, the clock, randomness and the
     process environment trapped, touch none of them and answer the same twice — which is what "pure" means. */
  const EXPORTED = JSON.stringify(Object.fromEntries(Object.entries(HARNESS).filter(([, v]) => typeof v !== "function")));
  t("REACH: the harness's exported data was read (a declaration of every table and constant)", EXPORTED.length > 5000, true);
  t("no token class is named in what the harness exports", /"class"\s*:\s*"ai"|class:ai/.test(EXPORTED), false);
  t("no credential is compiled into it", /aik-/.test(EXPORTED), false);
  t("PLANE_OPS grants nothing: each row is a flag and a reason, with no scope, class or allow-list beside them",
    [...new Set(Object.values(PLANE_OPS).map((d) => Object.keys(d).sort().join(",")))], ["mutating,why"]);
  const purity = await harnessPurity();
  t("REACH: the purity walk called the harness's functions over a corpus (and every one of them was called)",
    [purity.calls > 5000, purity.uncalled], [true, []]);
  t("the harness performs no I/O at all — no fetch was made while it ran", purity.trapped.fetch, 0);
  t("and reads no clock and no randomness", [purity.trapped.clock, purity.trapped.random], [0, 0]);
  t("and no process state", purity.trapped.process, 0);
  t("and it is deterministic: the same corpus twice gives the same answers, byte for byte",
    purity.first === purity.second, true);
}

/* ================================================================
 * PART B · THROUGH `POST /run`, INSIDE WORKERD
 * ================================================================ */
console.log("\n=== PART B · the same table driven through the op, over a real service binding ===");

const { Miniflare } = await (async () => {
  try { return await import("miniflare"); } catch { /* fall through */ }
  const planePkg = fileURLToPath(new URL("../../bio-plane/package.json", import.meta.url));
  const resolved = createRequire(planePkg).resolve("miniflare");
  return await import(pathToFileURL(resolved).href);
})();

const sha = (v) => createHash("sha256").update(v).digest("hex");
const AIK = "aik-" + "a".repeat(64);

/* THE PLANE MOCK. FL-2's, extended with the run object, the observation log,
   the budget with a real exhaustion path, and F10's plane side as PL-3 built
   it. `MUTATING` is the set that moves the RECORD. */
/* FL-8 / IC-67 — WHAT THE PLANE WOULD RECORD, COMPUTED FROM THE PLANE. One entry
   per bound and per ending the plane's catalogue holds, each answered by the
   plane's own `runStatusFor`, then interpolated into the mock below as data. The
   mock LOOKS UP; it does not decide. Arm A6c asserts the table covers the whole
   domain a legal close can name, which is what makes the mock's fallback
   unreachable rather than merely unlikely. */
const STATUS_BY_BOUND = Object.fromEntries(
  [...Object.keys(RUN_BOUNDS), ...Object.keys(RUN_ENDINGS)].map((b) => [b, runStatusFor(b)]));

const PLANE_MOCK = `
const STATUS_BY_BOUND = ${JSON.stringify(STATUS_BY_BOUND)};
const MUTATING = new Set(["purge","promote","airunopen","airuntick","airunclose","suggest","capturerequest"]);
/* FL-11: THE RUN'S CONTEXT, ONE EXPRESSION — what \`op=airun\` publishes and what \`op=suggest\` bounds by are
   the same object, so the mock cannot publish one context and judge against another. */
/* D-451: and a run over a PROJECT publishes \`questions\` — the questions it confirmed-cites that the caller can see,
   the plane's \`#runContextQuestions\`, here the mock's \`cites\` (every one visible). \`CFG.noQuestions\` is a
   plane that predates D-451 and publishes no set; \`CFG.questions\` publishes a set other than \`cites\`. */
const runCtx = (CFG) => (CFG.contextType || "inquiry") === "project"
  ? (CFG.noQuestions ? { type: "project", id: CFG.target || "INQ-1" }
                     : { type: "project", id: CFG.target || "INQ-1", questions: CFG.questions || CFG.cites || [] })
  : { type: CFG.contextType || "inquiry", id: CFG.target || "INQ-1" };
const canon = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
};
export default {
  async fetch(req, env) {
    const CFG = JSON.parse(env.MOCK || "{}");
    if (!globalThis.__S) globalThis.__S = {
      record: { rows: [] }, log: [], runlog: (CFG.priorLog || []).slice(),
      budget: Object.fromEntries((CFG.budget || []).map((b) => [b.bound, { allowed: b.allowed, consumed: b.consumed || 0 }])),
      refusals: new Map(), status: "running", ended: null, suggested: [], spawns: 0, seq: (CFG.priorLog || []).length,
    };
    const S = globalThis.__S;
    const url = new URL(req.url);
    if (url.pathname === "/__mock/state")
      return Response.json({ record: S.record, log: S.log, runlog: S.runlog, budget: S.budget,
                             status: S.status, ended: S.ended, suggested: S.suggested, spawns: S.spawns,
                             requests: S.requests || [], bvIds: S.bvIds || [],
                             repeats: [...S.refusals.values()].map((r) => r.repeats) });
    const op = url.searchParams.get("op") || "";
    const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "") || "";
    const store = url.searchParams.get("store") || "";
    let body = null;
    if (req.method === "POST") { try { body = await req.json(); } catch { body = null; } }
    S.log.push({ op, token, store, method: req.method, body });
    if (MUTATING.has(op)) S.record = { rows: [...S.record.rows, { op, at: S.log.length }] };

    if (op === "whoami")
      return Response.json({ ok: true, result: { tokenClass: "ai", session: false, member: null }, store, tokenClass: "ai" });

    if (op === "airun")
      return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: true, session: {
        id: url.searchParams.get("run"), mode: CFG.mode || "check", status: S.status,
        principal: { plane: "member:ruth", claude: CFG.payer ?? "member:ruth", ref: CFG.payer ?? "member:ruth" },
        context: runCtx(CFG),
        max_passes: CFG.maxPasses || 1,
        /* agent-harness R18 (T50): a level is written absent only when the shell shows it was read over a document. This
           suite drives the table with the judgements it is handed, no sub-session reading, so the scope arrives as the run's
           published state, a place to resume at \`plan\` with every level read over three documents (\`noScope\` leaves it
           out, as a run that had read nothing). */
        state: CFG.noScope ? null : { step: "plan", pass: 0, scope: Object.fromEntries(
          ["meaning", "content", "document", "internet"].map((l) => [l, { reads: 1, documents: 3 }])) },
        budget: Object.entries(S.budget).map(([bound, b]) => ({ bound, allowed: b.allowed, consumed: b.consumed, unit: null })),
      } }, store });

    if (op === "airunlog")
      return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: true,
        entries: S.runlog, limit: 200, truncated: false } });

    if (op === "airunspawn") {
      S.spawns += 1;
      /* PL-12's fence: the SEARCH half's payload has NO bias key AT ALL — not
         null, absent. Written as an explicit literal here for the same reason
         store.mjs writes it as one: a field acquires a value the first time
         somebody thinks they are being helpful. */
      return Response.json({ ok: true, result: { run: url.searchParams.get("run"), found: true, half: "search",
        payload: { run: url.searchParams.get("run"), context: runCtx(CFG),
                   mode: CFG.mode || "check", skill: "pack-1.0.0", standard_pair: null, budget: [] } } });
    }

    ${meaningRowsBranch("CFG.meaningRows || []")}

    /* FL-11: WHICH question dedup compared against is recorded, so an arm can see the run's target arrive. */
    if (op === "basisversions") (S.bvIds = S.bvIds || []).push(url.searchParams.get("id"));
    if (op === "basisversions")
      return Response.json({ ok: true, result: { id: url.searchParams.get("id"),
        versions: (CFG.heldVersions || []).map((n) => ({ name: n })), limit: 50, truncated: false } });

    if (op === "airuntick") {
      if (S.status !== "running")
        return Response.json({ ok: true, result: { ticked: false, status: S.status,
          note: "this run has ended; its log is closed and a later tick does not reopen it" } });
      let appended = 0;
      for (const e of Array.isArray(body && body.log) ? body.log : []) { S.runlog.push({ seq: ++S.seq, ...e }); appended += 1; }
      for (const [k, v] of Object.entries((body && body.consume) || {}))
        if (S.budget[k]) S.budget[k].consumed += Number(v) || 0;
      /* THE EXHAUSTION CHECK, READ BACK RATHER THAN TRUSTED — and it terminates
         through the ONE exit, appending the terminal entry in the same act as
         the status change, exactly as PL-5's #aiRunTerminate does. The
         'runtime' -> 'runtime-ceiling-reached' mapping is the plane's and is
         reproduced here rather than invented. */
      const order = ["fetches","subsessions","wallclock","runtime","lease"];
      const hit = order.find((b) => S.budget[b] && S.budget[b].allowed > 0 && S.budget[b].consumed >= S.budget[b].allowed);
      if (hit) {
        const condition = hit === "runtime" ? "runtime-ceiling-reached" : null;
        S.runlog.push({ seq: ++S.seq, level: "document", state: "LOOKED_INDETERMINATE", terminal: 1,
                        bound: hit, condition, detail: "the run stopped because the '" + hit + "' bound was reached" });
        S.status = "stopped";
        S.ended = { bound: hit, condition };
        return Response.json({ ok: true, result: { ticked: true, appended, status: "stopped",
                                                   ended: { terminated: true, bound: hit, condition } } });
      }
      return Response.json({ ok: true, result: { ticked: true, appended, status: "running" } });
    }

    if (op === "airunclose") {
      const bound = (body && body.bound) || null;
      if (!bound)
        return Response.json({ ok: false, reason: "AI_RUN_BOUND_UNNAMED", code: "AI_RUN_BOUND_UNNAMED",
          check: "C-22.5", translation: "That run stopped without saying what stopped it." }, { status: 400 });
      S.runlog.push({ seq: ++S.seq, level: "document", state: "LOOKED_INDETERMINATE", terminal: 1, bound, condition: null });
      /* THE PLANE'S OWN ANSWER, LOOKED UP — not reproduced. See the import block
         at the head of this file for the drift this replaces. */
      S.status = STATUS_BY_BOUND[bound] || "finished";
      S.ended = { bound, condition: null };
      return Response.json({ ok: true, result: { terminated: true, bound, condition: null } });
    }

    ${captureRequestBranch({ run: { principal: "CFG.runPrincipal || " + JSON.stringify(AIK), status: "S.status" } })}

    ${suggestBranch({ f10: true, run: { context: "runCtx(CFG)", cites: "(CFG.cites || [])",
                                        principal: "CFG.runPrincipal || " + JSON.stringify(AIK), status: "S.status" } })}
    return Response.json({ ok: false, error: "unknown op: " + op }, { status: 400 });
  },
};
`;

/* --- A6c · FL-8 / IC-67: THE MOCK LOOKS THE PLANE'S STATUS UP, IT DOES NOT
   DECIDE IT. Placed HERE, immediately after the mock's source, because the
   assertions read that source and a `const` is not hoisted.

   WHY IT IS AN ARM RATHER THAN A CONVENIENCE. Until FL-8 the mock decided a
   closed run's status with a hand-written copy of the plane's rule, and that
   copy had been WRONG since FL-7 minted a third ending — it answered `stopped`
   for `mode-not-deployed` while the plane answered `finished`. Nothing caught it
   because nothing compared them: this repository's parallel-path class arriving
   in the INSTRUMENT rather than in the product, where it is worse, because every
   arm driven through a mock that contradicts the plane is evidence about a plane
   that does not exist. These two assertions are what stop it becoming a copy
   again — the table must cover the whole domain the plane admits, which makes
   the mock's `|| "finished"` fallback UNREACHABLE for any legal close rather
   than merely unlikely, and the interpolation must actually have reached the
   mock's source. */
console.log("\n--- A6c · the plane mock's status table is the PLANE's, built not copied (FL-8) ---");
{
  const mockDomain = [...Object.keys(RUN_BOUNDS), ...Object.keys(RUN_ENDINGS)];
  t("A6c REACH: the domain taken from the plane's catalogue is non-trivial (floor 8: five bounds and "
    + "three endings), so the two assertions below are not walking an empty set",
    mockDomain.length >= 8, true);
  t("A6c (FL-8): the mock's status table covers every bound AND every ending the plane's catalogue holds, "
    + "and each answer is the PLANE's own — taken from `runStatusFor` rather than reproduced here",
    mockDomain.filter((b) => STATUS_BY_BOUND[b] !== runStatusFor(b)), []);
  t("A6c2: and that table reached the mock's source AS DATA, with the hand-written keying gone — a mock "
    + "that decides a status is a second producer of the plane's rule, which is the drift this removed",
    [/const STATUS_BY_BOUND = \{/.test(PLANE_MOCK),
     /STATUS_BY_BOUND\[bound\]/.test(PLANE_MOCK),
     /bound === "completed"/.test(PLANE_MOCK)],
    [true, true, false]);
}

const newMf = (cfg = {}) => new Miniflare({
  workers: [
    { name: "agent-worker", modules: true, modulesRoot: "/", scriptPath: WORKER_SRC_PATH, script: WORKER_SRC,
      modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
      bindings: { VERSION: "test" },
      serviceBindings: { PLANE: "plane-mock" } },
    { name: "plane-mock", modules: true, script: PLANE_MOCK,
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
      bindings: { MOCK: JSON.stringify(cfg) } },
  ],
});

const runOp = (mf, body) =>
  mf.dispatchFetch("http://agent-worker/run", { method: "POST", body: JSON.stringify(withAccount(body)) });
const mockState = async (mf) =>
  (await (await (await mf.getWorker("plane-mock")).fetch("http://plane/__mock/state")).json());
const base = { run_id: "run-1", store: "scratch", credential: AIK };
const wide = [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
               { bound: "wallclock", allowed: 500000 }, { bound: "runtime", allowed: 5000 }];

console.log("\n--- B1 · a CHECK run walks the table and the plane holds the whole trace ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
  const res = await runOp(mf, base);
  t("200", res.status, 200);
  const out = await res.json();
  t("ok", out.ok, true);
  t("the stage says the HARNESS ran, not a round trip", out.stage, "harness");
  console.log("\n  -- and it still says WHICH HALF ran: no model turns, FL-6's cascade unresolved --");
  t("zero model turns, stated", out.turns_run, 0);
  t("R28: the judgement source is named rather than implied: the body's, on the stubbed path", out.judgement_source, "body");
  t("the mode is the RECORD's", out.mode, "check");
  t("the run ended and named its bound", out.ended?.bound ?? null, "completed");

  const st = await mockState(mf);
  console.log("\n  -- LOG-ALWAYS: every step ticks, and the last entry is the plane's TERMINAL one --");
  t("the plane's observation log is not empty", st.runlog.length > 0, true);
  /* CORRECTED BY R26 (K148): "every step produced a log entry" meant one NEVER_LOOKED entry per step, which the
     record refuses. Every step still TICKS; no step here judged a look, so the log holds only the plane's own
     terminal entry. */
  t("every step the trace names ticked, and none that looked at nothing sent an entry",
    /* R91 (R085): a segment also sends one closing tick, `segment_end`, beside its step ticks; this counts step ticks. */
    [st.log.filter((l) => l.op === "airuntick" && !("segment_end" in (l.body || {}))).length, st.runlog.length],
    [(out.trace || []).length, 1]);
  t("the last entry is terminal", st.runlog[st.runlog.length - 1]?.terminal ?? null, 1);
  t("and names the bound", st.runlog[st.runlog.length - 1]?.bound ?? null, "completed");

  console.log("\n  -- THE FOUR-LEVEL FAN-OUT: four sub-sessions, one per level, per pass --");
  t("four spawn payloads were taken", st.spawns, LEVELS.length);
  t("the sub-session count was charged to the budget", st.budget.subsessions.consumed, LEVELS.length);

  console.log("\n  -- the table's order is the table's: dedup ALWAYS falls between compose and submit --");
  const edges = (out.trace || []).map((x) => `${x.step}>${x.to}`);
  t("the run started at the gate", out.trace?.[0]?.step ?? null, "gate-mode");
  t("the gate went to `resume` before anything else was done", edges[0] ?? null, "gate-mode>resume");
  t("compose is followed by dedup, every time",
    (out.trace || []).filter((x) => x.step === "compose").every((x) => x.to === "dedup"), true);
  t("no step in the trace went anywhere its row does not declare",
    (out.trace || []).filter((x) => !(CONTROL_FLOW[x.step]?.to || []).includes(x.to) && x.step !== "close"), []);

  console.log("\n  -- ONE credential, the one it was handed, and never echoed --");
  const tokens = [...new Set(st.log.map((l) => l.token))];
  t("exactly one distinct credential reached the plane", tokens.length, 1);
  t("and it is the one handed in", tokens[0], AIK);
  t("the response body does not contain the credential", JSON.stringify(out).includes(AIK), false);

  console.log("\n  -- every op named is in the pinned set, and NO other op was reached --");
  t("the ops actually named are a subset of the pinned set",
    [...new Set(st.log.map((l) => l.op))].filter((op) => !PLANE_OPS[op]), []);

  /* PL-12's FENCE MOVED TO `fanout.test.mjs` AT FL-5, AND THE OLD ARM IS
     CORRECTED HERE RATHER THAN DELETED — it was measured VACUOUS and the
     measurement belongs on the record. It read:

       t("no search-half spawn payload carried a bias field",
         (out.trace || []).filter((x) => x.note && /manifest_field_present/.test(x.note)), []);

     `manifest_field_present` was computed into a local (`spawned`) that never
     reached the wire, and the trace note it grepped is fixed text that never
     contains the phrase — so the arm could only ever fail if somebody wrote those
     nineteen characters into a note. MEASURED at FL-5 rather than reasoned:
     with the plane mock's SEARCH-half payload made to carry a full bias block,
     this suite stayed **194 pass / 0 fail** and this arm PASSED. A mechanism
     believed on the strength of its existence rather than its behaviour is the
     defect this project meets most often, and it had one here.
     FL-5's replacement is a REFUSAL and three arms that can fail: the driver
     refuses a search payload carrying the lens (`SPAWN_PAYLOAD_CARRIES_LENS`),
     the spawn contract is published on the wire so its key set is read rather
     than promised, and a manifest genuinely in force on the composing half must
     appear in ZERO bytes of what any sub-session was handed. */
  console.log("\n  -- the fan-out spawned per level; FL-5's fence arms live in fanout.test.mjs --");
  t("four sub-session contracts were composed, one per level",
    (out.fanout?.contracts || []).map((c) => c.level), LEVELS);
  await mf.dispose();
}

console.log("\n--- B2 · §14b.7 — A RESUMED RUN READS ITS OWN LOG AND CONTINUES ---");
{
  const prior = Array.from({ length: 7 }, (_, i) => ({ seq: i + 1, level: "document", state: "NEVER_LOOKED",
    subject: "earlier segment", terminal: 0, bound: null }));
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, priorLog: prior });
  const out = await (await runOp(mf, base)).json();
  t("it read its own log and says how much of it there was", out.resumed_from, 7);
  const resume = out.trace.find((x) => x.step === "resume");
  t("the resume step says it is CONTINUING rather than restarting", /continuing rather than restarting/.test(resume?.why ?? ""), true);
  t("and names how many observations it carried", /7 observation/.test(resume?.why ?? ""), true);

  const st = await mockState(mf);
  t("the prior entries are still there — the log is APPENDED, never rewritten",
    st.runlog.slice(0, 7).map((e) => e.subject), prior.map((e) => e.subject));
  t("and this segment's entries came after them", st.runlog.length > 7, true);

  /* THE ARM THAT MAKES IT A RESUMPTION AND NOT A COINCIDENCE: a run with an
     EMPTY log says the opposite thing, so the sentence tracks the log rather
     than being printed either way. */
  const mf2 = newMf({ mode: "check", maxPasses: 1, budget: wide, noScope: true });
  const out2 = await (await runOp(mf2, base)).json();
  t("a run with no prior log says its log is EMPTY, not that it resumed", out2.resumed_from, 0);
  t("and says so in words", /log is empty/.test(out2.trace?.find((x) => x.step === "resume")?.why ?? ""), true);
  await mf2.dispose();
  await mf.dispose();
}

console.log("\n--- B3 · A BUDGET EXHAUSTION WRITES `runtime-ceiling-reached` ---");
{
  /* The `runtime` allowance is small, so the platform ceiling (D-54, D-56) is
     reached partway through. Nothing in this member emits the word: the harness
     SPENDS one unit per plane call and the PLANE writes the condition at its own
     one exit — which is the half §14b.6 said the record had a word for and no
     writer, and IS-9(d) is this item. */
  const mf = newMf({ mode: "check", maxPasses: 9,
    budget: [{ bound: "fetches", allowed: 50 }, { bound: "subsessions", allowed: 50 },
             { bound: "wallclock", allowed: 500000 }, { bound: "runtime", allowed: 6 }] });
  const out = await (await runOp(mf, base)).json();
  t("the run ended on the runtime bound", out.ended?.bound ?? null, "runtime");
  t("and the CONDITION is the record's own word", out.ended?.condition ?? null, "runtime-ceiling-reached");
  t("the ending was the PLANE's, not the table's", out.ended?.by ?? null, "the plane's own exit");

  const st = await mockState(mf);
  const term = st.runlog.filter((e) => e.terminal === 1);
  t("exactly one terminal entry was written", term.length, 1);
  t("it names the bound", term[0]?.bound ?? null, "runtime");
  t("and carries `runtime-ceiling-reached` in the observation log itself", term[0]?.condition ?? null, "runtime-ceiling-reached");
  t("the run is stopped, not finished", st.status, "stopped");

  /* THE WORD IS THE PLANE'S AND THIS MEMBER NEVER EMITS IT. A second producer
     inside a fleet member would be a copy of the plane's rule (DEC-8's drift
     class, and fleet rule 2 besides).
     ASSERTED BEHAVIOURALLY, AND THE FIRST SPELLING OF THIS ARM WAS WRONG —
     RECORDED RATHER THAN QUIETLY WIDENED. It read "the string appears nowhere in
     the source", and it came back RED over a DOC STRING in `SPENT_NOT_WATCHED`
     explaining that the plane writes the word. A member that DOCUMENTS whose
     word it is is doing the opposite of claiming it, so the arm was measuring
     the wrong thing: what must be true is that this member never SENDS it. The
     request bodies the plane received are the evidence, and that is a stronger
     arm than the source scan it replaces — it would also catch the word arriving
     by concatenation, which a literal scan cannot see. */
  t("this member sent the word to the plane exactly ZERO times",
    st.log.filter((l) => /runtime-ceiling-reached/.test(JSON.stringify(l.body ?? null))).length, 0);
  /* CONVERTED BY N421: this read the member's TEXT for an assignment of the word. At the interface: the table's own
     log entry, over every bound it can close on, carries no condition it was not handed by a judgement. */
  t("and the table never produces it: stepLog's terminal entry, over every bound the table closes on, carries no condition",
    [...Object.keys(RUN_BOUNDS), ...Object.keys(RUN_ENDINGS)]
      .map((bound) => stepLog({ step: "next-pass", observed: "LOOKED_INDETERMINATE" }, { step: "close", why: "w", bound }))
      .filter((e) => e && e.condition != null).length, 0);
  t("the word nevertheless reached the observation log — written by the PLANE",
    st.runlog.some((e) => e.condition === "runtime-ceiling-reached"), true);
  /* R91 (R085): the one tick after its exit is the segment's `segment_end`, telling the plane how it ended, and no step. */
  t("a run that ended is not ticked again after its exit — one tick per step taken, the last one the tick that ended it; "
    + "then only the segment's own segment_end, naming the plane's exit",
    [st.log.filter((l) => l.op === "airuntick" && !("segment_end" in (l.body || {}))).length,
     st.log.filter((l) => l.op === "airuntick" && "segment_end" in (l.body || {})).map((l) => l.body.segment_end.by),
     st.log[st.log.length - 1]?.body?.segment_end?.done],
    [(out.trace || []).length, ["the plane's own exit"], true]);
  await mf.dispose();
}

console.log("\n--- B4 · F10 — A REFUSAL IS FOLLOWED BY AN ADJUSTED SUBMISSION IN THE TRACE ---");
{
  /* `boilerplate: ["TBD"]` WAS STAGED HERE AND IS GONE ON PURPOSE (2026-09-13,
     D-324). The mock now runs the plane's OWN `isBoilerplate` over the
     description, and `tbd` is in the plane's own `BOILERPLATE_FORMS` — so this
     arm's refusal is now EARNED from the record's predicate rather than handed
     to the mock by the fixture, which is the difference between measuring F10
     and measuring a staged string. */
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
  const res = await runOp(mf, {
    ...base,
    /* THE JUDGEMENT LIST GAINED A SLOT AT FL-5 AND THE OLD SHAPE WAS WRONG
       RATHER THAN MERELY OLD. Judgements are consumed in order by the rows that
       judge, and FL-5 made `collect` one of them — because a sub-session's return
       must be held to the REPORT contract at the row that COLLECTS it, not at
       `compose`, which is the row that has already interpreted it. Supplying
       `reports` at `compose` was therefore supplying them one row after the
       contract could protect anything. */
    judgements: [
      { targets: [] },                                                   /* plan */
      { reports: [] },                                                   /* collect */
      /* D-324: the kind read `new-version` until 2026-09-13, and §9 holds no such
         kind — a deployed plane answers SUGGEST_UNKNOWN_KIND / C-27.3 and
         publishes the closed set it holds. The old spelling was WRONG rather
         than merely old: it passed only against a mock that accepted any kind,
         so F10's LANDING half had never once been exercised with a kind the real
         endpoint would take. `TBD` stays exactly as it was — it is in the plane's
         OWN `BOILERPLATE_FORMS`, so the refusal below is now EARNED from the
         plane's own predicate instead of staged by this fixture. */
      { candidates: [{ kind: "basis-version", name: "v1", description: "TBD" }] }, /* compose */
      {},                                                                /* dedup */
      { submission: { kind: "basis-version", name: "v1", description: "what changed, and why, in full" } }, /* adjust */
    ],
  });
  const out = await res.json();
  t("the run completed", out.ok, true);
  const edges = (out.trace || []).map((x) => `${x.step}>${x.to}`);
  t("the refusal routed to ADJUST", edges.includes("submit>adjust"), true);
  t("and the adjust routed BACK to submit", edges.includes("adjust>submit"), true);
  t("there is NO submit>submit edge carrying a refusal — no verbatim retry", out.verbatim_resubmits, 0);
  t("exactly one adjustment was made", out.adjusted, 1);
  t("the refusal is on the wire, in the PLANE's words", out.refusals[0]?.code ?? null, "SUGGEST_BOILERPLATE");
  /* CORRECTED 2026-09-13 (D-324), and the old pair was a DEFECT IN THE FIXTURE
     rather than a stale expectation. The mock answered EVERY staged refusal with
     C-27.13's number and C-27.13's translation whatever code it was asked for —
     so a `SUGGEST_BOILERPLATE` refusal arrived wearing `SUGGEST_UNWRITABLE_STATE`'s
     C-number and its words, and this arm asserted the plane's refusal was
     "unchanged, to the byte" over bytes the plane has never sent. Both are now
     READ OUT OF THE CATALOG BY CODE (`plane-suggest.mjs`), so the two cannot
     come apart again. */
  t("with the plane's C-number unchanged", out.refusals[0]?.plane?.check ?? null,
    WIRE_CHECKS.SUGGEST_BOILERPLATE.check);
  t("and the plane's canned translation unchanged, to the byte",
    out.refusals[0]?.plane?.translation ?? null,
    WIRE_CHECKS.SUGGEST_BOILERPLATE.translation);

  const st = await mockState(mf);
  const submits = st.log.filter((l) => l.op === "suggest");
  t("the endpoint was called twice: the refused one and the adjusted one", submits.length, 2);
  t("and the SECOND submission differs from the first — byte for byte, canonically",
    canonical(submits[0]?.body ?? null) !== canonical(submits[1]?.body ?? null), true);
  t("PL-3's `repeats` counter stayed at ZERO, which is what a table rather than a budget buys",
    st.repeats, [0]);
  t("the adjusted version LANDED", st.suggested.map((s) => s.name), ["v1"]);
  await mf.dispose();
}

console.log("\n--- B5 · F10's other half: an unanswerable refusal DROPS the candidate, never resends ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, refuse: { v1: "SUGGEST_UNWRITABLE_STATE" } });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [
      { targets: [] },
      { reports: [] },                                                   /* collect — FL-5's row */
      /* D-324 as in B4; and the description grew from `"d"` to a real sentence
         because `promote`'s document gate refuses a version whose description is
         under C-25.1's floor — a rule the old mock did not hold either. Neither
         change touches what this arm measures: the refusal is still the STAGED
         one, and it is still unanswerable by any adjustment. */
      { candidates: [{ kind: "basis-version", name: "v1",
                       description: "the reading this run composed, as it stands" }] },
      {},
      /* THE MODEL HANDS BACK THE SAME SUBMISSION — which is what happens when
         the refusal names an act a machine cannot perform (DEC-65's measured
         case: a machine may not assert a version's structure). */
      { submission: { kind: "basis-version", name: "v1",
                      description: "the reading this run composed, as it stands" } },
    ],
  })).json();
  const edges = (out.trace || []).map((x) => `${x.step}>${x.to}`);
  t("the refusal still routed to ADJUST", edges.includes("submit>adjust"), true);
  t("and the adjust DROPPED the candidate rather than resending it", edges.includes("adjust>next-pass"), true);
  t("nothing was adjusted", out.adjusted, 0);
  t("and nothing was resent", out.verbatim_resubmits, 0);
  const st = await mockState(mf);
  t("the endpoint was called ONCE — the same bytes were never sent twice",
    st.log.filter((l) => l.op === "suggest").length, 1);
  t("so PL-3's `repeats` counter never moved", st.repeats, [0]);
  t("and nothing landed", st.suggested, []);
  await mf.dispose();
}

console.log("\n--- B5b · D-452: a DROPPED candidate drops ONE candidate — the rest of the pass is written ---");
{
  /* THE DEFECT, THROUGH THE OP. `adjust` with nothing adjusted went to `next-pass` whatever was queued behind
     it, so the FIRST unanswerable refusal of a pass swallowed every candidate after it — the table-made
     level-empty ones included, which is §9's instrument silently not written. HOW A LIAR PASSES A WEAKER ARM:
     writing only the NEXT candidate, or re-queuing the dropped one. So this counts EVERY name behind the
     dropped one, requires each written EXACTLY ONCE, and requires the dropped one sent once and never landed. */
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-1",
                     refuse: { v1: "SUGGEST_UNWRITABLE_STATE" } });
  const lookedAbsent = LEVELS.slice(0, 2);
  const out = await (await runOp(mf, {
    ...base,
    judgements: [
      { targets: [] },
      { reports: lookedAbsent.map((l, i) => ({ level: l, state: "LOOKED_ABSENT", observed_at: `log:${i + 1}` })) },
      { candidates: [
        { kind: "basis-version", name: "v1", description: "the reading this run composed, which the plane refuses" },
        { kind: "basis-version", name: "v2", description: "a second reading queued behind the refused one" },
        { kind: "basis-version", name: "v3", description: "a third reading queued behind the refused one" }] },
      {},
      /* THE SAME BYTES HANDED BACK: unanswerable, so `v1` is DROPPED (B5's case, with a queue behind it). */
      { submission: { kind: "basis-version", name: "v1",
                      description: "the reading this run composed, which the plane refuses" } },
    ],
  })).json();
  const st = await mockState(mf);
  const behind = ["v2", "v3", ...lookedAbsent.map((l) => `level-empty-${REPORTING_LEVEL[l]}`)];
  const count = (names) => (want) => names.filter((n) => n === want).length;
  const sentN = count(st.log.filter((l) => l.op === "suggest").map((l) => String(l.body?.name ?? "")));
  const landedN = count(st.suggested.map((x) => String(x.name)));
  t("B5b: the fixture is what it claims — the dropped candidate is FIRST and four stand behind it",
    [st.log.find((l) => l.op === "suggest")?.body?.name ?? null, behind.length,
     (out.trace || []).some((x) => x.step === "submit" && x.to === "adjust")], ["v1", 4, true]);
  t("D-452: the rest of the pass is written — EVERY candidate behind the dropped one landed EXACTLY ONCE",
    behind.map((n) => `${n}×${landedN(n)}`), behind.map((n) => `${n}×1`));
  t("D-452: …and each was SENT exactly once, so no candidate behind it was retried either",
    behind.map((n) => `${n}×${sentN(n)}`), behind.map((n) => `${n}×1`));
  t("D-452: the DROPPED candidate was sent ONCE and never landed — not re-queued, not resent",
    [sentN("v1"), landedN("v1")], [1, 0]);
  t("D-452: the drop went on to `submit` and not to `next-pass`, and it was not an adjustment",
    [(out.trace || []).some((x) => x.step === "adjust" && x.to === "submit"),
     (out.trace || []).some((x) => x.step === "adjust" && x.to === "next-pass"), out.adjusted],
    [true, false, 0]);
  t("D-452: nothing was resent verbatim, so PL-3's `repeats` counter never moved",
    [out.verbatim_resubmits, st.repeats], [0, [0]]);
  t("D-452: the run counts what it wrote — four, the refused one not among them", out.submitted, 4);
  await mf.dispose();
}

console.log("\n--- B6 · THE EMPTY RUN (VF-1's owed control 7): proposes NOTHING, emits §9's kind ---");
{
  /* An inquiry the evidence does not support. The model reports that it looked
     at every level and found nothing, and composes NO version. The run must
     still EMIT something, or an honest empty-handed run is indistinguishable
     from a run that failed silently. */
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-1" });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [
      { targets: [] },
      /* THE REPORTS ARRIVE AT `collect` SINCE FL-5, where the return contract
         judges them. Each is a legal REPORT: an absence CITES NOTHING and is not
         required to — there would be nothing to cite — but it must say WHERE the
         search that establishes it was written down. */
      { reports: LEVELS.map((l, i) => ({ level: l, state: "LOOKED_ABSENT", observed_at: `log:${i + 1}` })) },
      { candidates: [] },
      {},
    ],
  })).json();
  const st = await mockState(mf);
  t("no legged version was proposed", st.suggested.filter((s) => s.kind !== "level-empty"), []);
  t("but FOUR level-empty suggestions were written — one per level",
    st.suggested.map((s) => s.kind), ["level-empty", "level-empty", "level-empty", "level-empty"]);
  /* D-323 — THE COLON FORM WAS WRONG, NOT MERELY OLD, AND THIS ARM IS THE ONE THE
     ITEM EXISTS FOR. It read ``LEVELS.map((l) => `level-empty:${l}`)`` and passed
     only because this suite's mock wrote whatever it was handed. `VERSION_NAME_RE`
     is `/^[a-z0-9][a-z0-9 ._-]{0,63}$/i` and admits NO colon, so a deployed plane
     refused all four of VF-1's owed control 7 objects — `BASIS_REFUSED`, finding
     C-25.2, `wrote: false`, measured live at 0.57.0 (MEASUREMENTS M-8). The level
     half moved with it: a run writes its log in `OBSERVATION_LEVELS`' spelling
     (`document`) and a suggestion in `SUGGEST_LEVELS`' (`documents`), which is a
     SECOND refusal — `SUGGEST_EMPTY_LEVEL_UNSTATED` / C-27.6 — at an earlier
     check that no live run ever reached. Derived from `REPORTING_LEVEL` rather
     than re-typed, so a respelling on either side fails here. */
  t("each names its level, in the spelling the WIRE holds", st.suggested.map((s) => s.name),
    LEVELS.map((l) => `level-empty-${REPORTING_LEVEL[l]}`));
  t("and not one of them carries the colon the version grammar refuses",
    st.suggested.filter((s) => String(s.name).includes(":")), []);
  t("and each carries the observation-log address that establishes it",
    st.log.filter((l) => l.op === "suggest").every((l) => typeof l.body.observed_at === "string" && l.body.observed_at), true);
  t("the run is therefore COUNTABLE: an empty run and a silent failure are different objects",
    [st.suggested.length > 0, out.submitted], [true, 4]);

  /* AND THE CONTRAST THAT MAKES IT A MEASUREMENT: a run whose levels were
     NEVER_LOOKED emits nothing, because an unrun search is not an absence. */
  const mf2 = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-1" });
  const out2 = await (await runOp(mf2, {
    ...base,
    judgements: [{ targets: [] },
                 { reports: LEVELS.map((l) => ({ level: l, state: "NEVER_LOOKED" })) }, /* collect */
                 { candidates: [] },
                 {}],
  })).json();
  const st2 = await mockState(mf2);
  t("a run that never looked emits NO empty-level claim", st2.suggested, []);
  t("and submits nothing", out2.submitted, 0);
  await mf2.dispose();
  await mf.dispose();
}

console.log("\n--- B7 · SK-4's gate through the op: an investigate run stops before it spends ---");
{
  const mf = newMf({ mode: "investigate", maxPasses: 3, budget: wide });
  const out = await (await runOp(mf, base)).json();
  /* CORRECTED 2026-08-10 BY FL-7 (IC-62). THE OLD EXPECTATION WAS `cancelled`
     AND IT WAS RIGHT WHEN WRITTEN — it recorded what the gate then produced
     through the op, which is what this arm is for. It was never right about what
     the record then SAID: the plane defines `cancelled` as the member-stopped word (`run-rules.member_stopped`),
     and this run was refused by a deployment gate with no member anywhere near
     it. FL-7 gave the machine's act its own word. This is the THROUGH-THE-OP
     half of the acceptance — the ending is read off what the op actually
     returned, not asserted at a store or off `nextStep`'s return value. */
  t("the run was closed at the gate, carrying an ending that NAMES WHAT HAPPENED — a machine refused the "
    + "launch, and the record no longer names a member as the one who stopped it",
    out.ended?.bound ?? null, "mode-not-deployed");
  /* THE MISATTRIBUTION ARM, stated as its own assertion so a regression NAMES
     the defect instead of failing an equality: whatever else changes, the word
     that means "a member did this" must never come out of this gate. */
  t("and it is NOT `cancelled` — the member-attribution assertion, which must fail naming it if the gate "
    + "ever closes a refused run under a member's word again",
    out.ended?.bound === "cancelled" ? "MISATTRIBUTED: a gate refusal recorded as a member cancellation" : "ok",
    "ok");
  t("it took exactly one step", (out.trace || []).length, 1);
  t("which was the gate", out.trace?.[0]?.step ?? null, "gate-mode");
  const st = await mockState(mf);
  t("no sub-session was spawned", st.spawns, 0);
  t("nothing was suggested", st.suggested, []);
  t("no fetch was requested", st.budget.fetches.consumed, 0);
  t("and the refusal IS in the log — a gate that closed silently would be unauditable",
    st.runlog.length > 0, true);
  /* FL-8 / IC-67 — WHAT THIS MEMBER'S REFUSED LAUNCH IS RECORDED AS, AND THE ARM
     IS DELIBERATELY MODEST ABOUT WHAT IT PROVES. The mock is not the plane, so
     this is evidence that the member's gate produces a close the PLANE'S OWN
     KEYING answers `never-started` for — the table it looks the status up in was
     built by `runStatusFor` at the head of this file. **The behavioural proof
     that the real plane records it is ai-runs' R14 test
     (`bio-plane/test/m/ai-runs/tick-close.test.mjs`: a close on
     `mode-not-deployed` read back from the run's row as `never-started`)**,
     which took `airun.test.mjs` ARM H1's share when T20 deleted that suite, and
     it is named here so a reader of this arm does not mistake a mock for a record.
     Before FL-8 this same read would have said `stopped`, from a hand copy that
     had disagreed with the plane's `finished` since FL-7 landed. */
  t("FL-8: and the run the gate refused is recorded as one that NEVER STARTED — the plane's own keying, "
    + "looked up rather than reproduced here, and the real-plane proof is ai-runs' R14 test",
    st.status ?? null, "never-started");
  await mf.dispose();
}

console.log("\n--- B8 · DEDUP-BEFORE-WRITE, observed at the plane ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, heldVersions: ["v1", "v2"] });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [{ targets: [] },
                 { reports: [] },                                        /* collect — FL-5's row */
                 /* D-324 plus C-25.1: the kind is §9's, and each candidate now
                    carries a description, because `promote` refuses a version
                    without one and the old mock held neither rule. Dedup is what
                    this arm measures and it keys on the NAME, which has not
                    moved. */
                 { candidates: [{ kind: "basis-version", name: "v1",
                                  description: "the reading the record already holds" },
                                { kind: "basis-version", name: "v3",
                                  description: "a reading the record does not hold yet" }] },
                 {}],
  })).json();
  const st = await mockState(mf);
  t("the record was READ before anything was written",
    st.log.findIndex((l) => l.op === "basisversions") < st.log.findIndex((l) => l.op === "suggest"), true);
  t("the candidate the record already holds was never submitted",
    st.suggested.map((s) => s.name), ["v3"]);
  t("and exactly one write reached the endpoint", st.log.filter((l) => l.op === "suggest").length, 1);
  t("the trace says what dedup compared", /compared against 2 on the record/.test(
    out.trace?.find((x) => x.step === "dedup")?.note ?? ""), true);
  await mf.dispose();
}

console.log("\n--- B8b · D-276: THE MEANING READ SUCCEEDED, AND THE OBSERVATION ENTRY COUNTS REAL ROWS ---");
/* THE ARM THAT MAKES D-276 IMPOSSIBLE TO REINTRODUCE QUIETLY IN THIS SUITE.
   `compose`'s note used to be computed as `Array.isArray(got.rows) ? got.rows.length : 0`
   off a body nobody had checked, so a REFUSED read wrote `0 meaning-grain
   row(s) queried` into an AI run's observation entries — the record saying it
   looked and found nothing about a call that never happened. The mock now
   REFUSES an arm the plane's registry does not hold (`plane-meaning.mjs`), so
   staging rows here and asserting the note COUNTS them fails the moment the
   member's argument is wrong again. A count of zero would not have been enough:
   zero is exactly what the defect produced. */
{
  const rows = [{ ord: 0, role: "supports", grade: "B" }, { ord: 1, role: "cuts_against", grade: "C" }];
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, meaningRows: rows });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [{ targets: [] }, { reports: [] }, { candidates: [] }, {}],
  })).json();
  const compose = out.trace?.find((x) => x.step === "compose") ?? null;
  /* PRINTED, because the SENTENCE is the subject here and an arm that could only
     report `want true / got false` would tell a later reader that something
     about the note changed and never WHAT. The negative control reads this line
     to check that the false zero is really back. */
  console.log(`  observation entry: ${JSON.stringify(compose?.note ?? null)}`);
  t("ARMED: the run reached the step that reads the meaning layer", compose != null, true);
  t("the observation entry COUNTS the rows the record answered with, at the arm's own grain",
    new RegExp(`^${rows.length} meaning-grain row\\(s\\) queried at the '${MEANING_ARM}' grain;`)
      .test(compose?.note ?? ""), true);
  t("...and it does not say the meaning layer went UNREAD",
    /NOT READ/.test(compose?.note ?? ""), false);
  t("...and the run published no meaningrows refusal",
    (out.refusals || []).filter((r) => r && r.at === "meaningrows"), []);
  t("the arm this member sends is one the PLANE's registry holds, not a spelling of it",
    MEANING_ARMS.includes(String(MEANING_ARM).trim().toLowerCase()), true);
  await mf.dispose();
}

console.log("\n--- B9 · VERSIONS ARE WRITTEN AS FORMED, NEVER BATCHED ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [{ targets: [] },
                 { reports: [] },                                        /* collect — FL-5's row */
                 /* D-324 plus C-25.1, as in B8. */
                 { candidates: [{ kind: "basis-version", name: "a", description: "the first reading, in full" },
                                { kind: "basis-version", name: "b", description: "the second reading, in full" },
                                { kind: "basis-version", name: "c", description: "the third reading, in full" }] },
                 {}],
  })).json();
  const st = await mockState(mf);
  t("three candidates produced THREE separate calls, not one batch",
    st.log.filter((l) => l.op === "suggest").length, 3);
  t("each call carried exactly one version", st.log.filter((l) => l.op === "suggest")
    .every((l) => typeof l.body.name === "string" && !Array.isArray(l.body.versions)), true);
  t("and each was followed by its own tick, so a death after any one keeps what it found",
    (() => {
      const ops = st.log.map((l) => l.op);
      return ops.filter((o, i) => o === "suggest" && ops[i + 1] === "airuntick").length;
    })(), 3);
  t("all three landed", st.suggested.map((s) => s.name), ["a", "b", "c"]);
  t("the driver reports the same count", out.submitted, 3);
  await mf.dispose();
}

console.log("\n--- B10 · a judgement that reaches for control flow is REFUSED through the op ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
  const res = await runOp(mf, { ...base, judgements: [{ targets: [], maxPasses: 9999 }] });
  const out = await res.json();
  t("400 JUDGEMENT_OVERREACH", [res.status, out.reason], [400, "JUDGEMENT_OVERREACH"]);
  t("the field is named", out.fields, ["maxPasses"]);
  t("and the step it was offered at is named", out.step, "plan");
  const st = await mockState(mf);
  t("nothing was suggested", st.suggested, []);
  await mf.dispose();
}

console.log("\n--- B11 · REC-52 one layer out, and the FL-2 fences that did not move ---");
{
  const noPlane = new Miniflare({
    workers: [{ name: "agent-worker", modules: true, modulesRoot: "/", scriptPath: WORKER_SRC_PATH, script: WORKER_SRC,
      modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
      compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"], bindings: { VERSION: "test" } }],
  });
  const res = await noPlane.dispatchFetch("http://agent-worker/run",
    { method: "POST", body: JSON.stringify(base) });
  const out = await res.json();
  t("no plane binding -> 503 PLANE_NOT_CONFIGURED", [res.status, out.reason], [503, "PLANE_NOT_CONFIGURED"]);
  t("it does NOT convert its own failure into a claim about the run", out.reason === "NO_SUCH_RUN", false);
  await noPlane.dispose();

  /* A RUN THE PLANE DOES NOT HOLD. This member opens no run — a run's identity
     and its conditions are the plane's, and a member that could open one would
     be a machine deciding what it was formed under. */
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
  const st0 = await mockState(mf);
  const bad = await runOp(mf, { ...base, credential: "hunter2" });
  t("a malformed credential is refused before any plane call", (await bad.json()).reason, "BAD_CREDENTIAL_SHAPE");
  const st1 = await mockState(mf);
  t("and that refusal wrote NOTHING — the record is byte-identical",
    sha(JSON.stringify(st1.record)), sha(JSON.stringify(st0.record)));
  await mf.dispose();
}

console.log("\n--- B12 · OVER-STRICTNESS: correct work in a spelling the guard did not anticipate must PASS ---");
{
  const cases = [
    ["no judgements at all", { }],
    ["more judgements than judged steps", { judgements: [{}, {}, {}, {}, {}, {}, {}, {}] }],
    ["an empty judgement object", { judgements: [{}] }],
    ["a judgement naming only judgeable fields", { judgements: [{ targets: [{ level: "meaning", target: "X" }] }] }],
    ["an explicit max_steps well inside the ceiling", { max_steps: 60 }],
    ["a run id carrying punctuation", { run_id: "run:2026-08-08/seg-3" }],
    /* CORRECTED BY D-462, NEVER EXEMPTED: this row required `BioSmoke-fleet` to be ACCEPTED, which asserted the
       defect — no instance holds that namespace, and the member now refuses it NAMESPACE_UNKNOWN (agent-worker.test
       §3). The correct spelling this row was reaching for is the other namespace, named explicitly. */
    ["the real record's namespace, named explicitly", { store: "bio" }],
    ["turns exactly at the bound", { turns: 120 }],
  ];
  for (const [label, extra] of cases) {
    const mf = newMf({ mode: "check", maxPasses: 1, budget: wide });
    const res = await runOp(mf, { ...base, ...extra });
    const out = await res.json();
    t(`${label} -> accepted`, [res.status, out.ok], [200, true]);
    await mf.dispose();
  }
  /* AND THE TABLE IS DETERMINISTIC END TO END: the same input twice produces the
     same trace. A control-flow table whose walk varied would not be one. */
  const traces = [];
  for (let i = 0; i < 2; i++) {
    const mf = newMf({ mode: "check", maxPasses: 2, budget: wide });
    traces.push((await (await runOp(mf, base)).json()).trace.map((x) => `${x.step}>${x.to}`));
    await mf.dispose();
  }
  t("two identical runs produce the identical trace", traces[0], traces[1]);
  t("and the trace actually went somewhere", (traces[0] || []).length > 5, true);
}

/* ============================================================================
 * FL-11 / FL-12 — THE RUN'S TARGET AND THE REQUEST'S ADDRESS, AGAINST A MOCK THAT REFUSES THE WAY THE PLANE
 * DOES (INVESTIGATIVE-SESSION.md §11 item 5: rule 1's target, BOB #28; the `op=capturerequest` paragraph).
 *
 * HOW A LIAR PASSES THESE ARMS, AND WHY IT CANNOT: a mock that accepts anything. Until FL-11/FL-12 both
 * mocks answered `wrote: true` to a suggestion naming no target, another question or another principal's
 * run, and `queued` to a capture request whose locator sat in a field the plane never reads — so the
 * member's two defects (no `state.target`, `url` for `address`) were invisible to every fleet suite while
 * the real plane refused every such call. The mock's `op=suggest` and `op=capturerequest` branches are now
 * DERIVED from the plane (`plane-suggest.mjs`, `plane-capturerequest.mjs`: codes, C-numbers, translations,
 * `isPublicHttpsLocator`'s own source, `runPrincipalGate` itself) and REFUSE BY NAME in the plane's order.
 * FT0 below drives the mock DIRECTLY with each wrong call, so a green here is not a mock saying yes.
 * NEGATIVE CONTROL: `test/harness.control.mjs` T1 (drop the seeding) and T2 (send `url` again).
 * ========================================================================== */
console.log("\n--- FT0 · FL-11/FL-12: the mock itself REFUSES by name what the plane refuses ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-FL11" });
  const mock = await mf.getWorker("plane-mock");
  const ask = async (op, body, token = AIK) =>
    (await (await mock.fetch(`http://plane/?op=${op}&store=scratch`,
      { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) })).json()).result ?? {};
  const good = { kind: "basis-version", name: "v1", description: "a reading the record does not hold yet", run: "run-1" };
  const codes = [
    (await ask("suggest", { ...good })).code,
    (await ask("suggest", { ...good, target: "PROJ-FL11" })).code,
    (await ask("suggest", { ...good, target: "INQ-ELSEWHERE" })).code,
    (await ask("suggest", { ...good, target: "INQ-FL11" }, "aik-" + "c".repeat(64))).code,
    (await ask("suggest", { ...good, target: "INQ-FL11", run: "" })).code,
  ];
  t("FT0 (FL-11): the suggest mock refuses no target, a project id, a question outside the run's context, "
    + "another principal and no run — each by the PLANE's code",
    codes, [WIRE_CHECKS.SUGGEST_NO_TARGET, WIRE_CHECKS.SUGGEST_NOT_AN_INQUIRY, WIRE_CHECKS.SUGGEST_OUTSIDE_RUN_CONTEXT]
      .map((row) => Object.keys(WIRE_CHECKS).find((k) => WIRE_CHECKS[k] === row))
      .concat([NOT_PRINCIPAL.code, Object.keys(WIRE_CHECKS).find((k) => WIRE_CHECKS[k] === WIRE_CHECKS.SUGGEST_NO_RUN)]));
  const outside = await ask("suggest", { ...good, target: "INQ-ELSEWHERE" });
  t("FT0b (FL-11): …and SUGGEST_OUTSIDE_RUN_CONTEXT carries the catalog's C-number and translation, not a lookalike",
    [outside.check, outside.translation, outside.wrote], [WIRE_CHECKS.SUGGEST_OUTSIDE_RUN_CONTEXT.check,
     WIRE_CHECKS.SUGGEST_OUTSIDE_RUN_CONTEXT.translation, false]);
  const inside = await ask("suggest", { ...good, target: "INQ-FL11" });
  t("FT0c (over-strictness): the same suggestion aimed at the run's own question, by its principal, LANDS",
    inside.wrote, true);
  const req = { run: "run-1", target: "INQ-FL11" };
  const creq = [
    (await ask("capturerequest", { ...req, url: "https://example.org/minutes" })).code,
    (await ask("capturerequest", { ...req, address: "http://example.org/minutes" })).code,
    (await ask("capturerequest", { ...req, address: "https://example.org/minutes" }, "aik-" + "c".repeat(64))).code,
    (await ask("capturerequest", { ...req, address: "https://example.org/minutes", run: "" })).code,
  ];
  t("FT0d (FL-12): the capture-request mock refuses a locator sent as `url`, a non-https address, another "
    + "principal and no run — each by the PLANE's code (C-28.2 for the first two)",
    creq, ["CAPTURE_REQUEST_NOT_PUBLIC", "CAPTURE_REQUEST_NOT_PUBLIC", "AI_RUN_NOT_PRINCIPAL", "CAPTURE_REQUEST_NO_RUN"]);
  t("FT0e (over-strictness): a public https `address` under the caller's own running run is QUEUED",
    (await ask("capturerequest", { ...req, address: "https://example.org/minutes" })).state, "queued");
  await mf.dispose();
}

console.log("\n--- FT1 · FL-11: a run over a QUESTION seeds its target, and its readings land inside it ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-FL11" });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [
      { targets: [] },
      { reports: [{ level: "internet", state: "LOOKED_ABSENT", observed_at: "log:4" }] },
      { candidates: [
        { kind: "basis-version", name: "untargeted", description: "a reading composed with no target of its own" }] },
      {},
    ],
  })).json();
  const st = await mockState(mf);
  /* THE OUTSIDE-THE-CONTEXT READING IS A SEPARATE RUN. It was one because of a measured fact about the
     table: a candidate dropped at `adjust` routed to `next-pass`, so the rest of that pass's queue was never
     written, and put in one run with the level-empty candidate it swallowed it. Reported with its fix by
     FL-11 and FIXED by D-452 (B5b above is its arm); the runs stay separate so FT1d/FT1e read one refusal
     in isolation. */
  const mfOut = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-FL11" });
  const outOut = await (await runOp(mfOut, {
    ...base,
    judgements: [{ targets: [] }, { reports: [] },
                 { candidates: [{ kind: "basis-version", name: "elsewhere", target: "INQ-ELSEWHERE",
                                  description: "a reading aimed at a question the run was not working on" }] },
                 {}],
  })).json();
  const stOut = await mockState(mfOut);
  t("FT1 (FL-11): the run publishes its target as the context question, and says why",
    [out.target?.id ?? null, out.target?.basis ?? null], ["INQ-FL11", localize("agent-harness.harness.the_runs_context_question", "the run's context question")]);
  t("FT1b (FL-11): dedup read `op=basisversions` under the RUN's target, never under an empty id",
    st.bvIds, ["INQ-FL11"]);
  t("FT1c (FL-11): the table-made level-empty candidate AND the untargeted reading LANDED on the run's question",
    st.suggested.map((x) => `${x.name}@${x.target}`).sort(),
    ["level-empty-internet@INQ-FL11", "untargeted@INQ-FL11"]);
  const outsideRef = (outOut.refusals || []).filter((r) => r.at === "suggest");
  t("FT1d (FL-11): the reading aimed OUTSIDE the context was refused by the plane's name and routed to ADJUST, "
    + "never retried verbatim, and nothing landed",
    [outsideRef.map((r) => r.code), outsideRef.map((r) => r.plane?.check ?? null), outOut.verbatim_resubmits,
     (outOut.trace || []).some((x) => x.step === "submit" && x.to === "adjust"), stOut.suggested],
    [["SUGGEST_OUTSIDE_RUN_CONTEXT"], [WIRE_CHECKS.SUGGEST_OUTSIDE_RUN_CONTEXT.check], 0, true, []]);
  t("FT1e (FL-11): …and dedup SAID it did not compare the candidate aimed elsewhere",
    /1 named a question other than the run's target and were NOT compared/.test(
      outOut.trace?.find((x) => x.step === "dedup")?.note ?? ""), true);
  await mfOut.dispose();
  await mf.dispose();
}

console.log("\n--- FT2 · FL-11 / D-451: a run over a PROJECT never lands on the project id ---");
/* CORRECTED 2026-09-25 by D-451, never exempted. FT2 and FT2d asserted that a project run citing ONE question
   has an UNDETERMINED target and that its level-empty candidate is refused SUGGEST_NO_TARGET. That was the
   defect D-451 names, pinned as behaviour: the run read published only `{ type, id }`, so the member could
   not name the project's question. The plane now publishes `context.questions` (`#runContextQuestions`), and
   a project run citing exactly one question seeds it as the target, so its level-empty candidate LANDS. The
   UNDETERMINED arms move to the cases where it is still true: several questions (FT2e) and a plane that
   publishes no set (FT2f). What FT2 was for — never the project id — is kept (FT2b). */
const projectRun = async (cfg, candidates) => {
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "PROJ-FL11", contextType: "project", ...cfg });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [
      { targets: [] },
      { reports: [{ level: "internet", state: "LOOKED_ABSENT", observed_at: "log:4" }] },
      { candidates },
      {},
    ],
  })).json();
  const st = await mockState(mf);
  await mf.dispose();
  return { out, st };
};
{
  const { out, st } = await projectRun({ cites: ["INQ-CITED"] },
    [{ kind: "basis-version", name: "cited", target: "INQ-CITED",
       description: "a reading of a question the project confirmed-cites" }]);
  t("FT2 (D-451): a project run citing ONE question seeds THAT question as its target, and says why — never "
    + "the project id",
    [out.target?.id ?? null, out.target?.basis ?? null],
    ["INQ-CITED", localize("agent-harness.harness.the_one_question_the_runs", "the one question the run's project confirmed-cites")]);
  t("FT2b (FL-11): no call this run made named the project as a suggestion's target",
    st.log.filter((l) => l.op === "suggest" && l.body?.target === "PROJ-FL11").length, 0);
  t("FT2c (FL-11): a reading aimed at a question the project confirmed-cites LANDS",
    st.suggested.filter((x) => x.name === "cited").map((x) => `${x.name}@${x.target}`), ["cited@INQ-CITED"]);
  t("FT2d (D-451): the table-made level-empty candidate is FILED on the project's one question, and nothing "
    + "was refused SUGGEST_NO_TARGET",
    [st.suggested.filter((x) => x.name === "level-empty-internet").map((x) => x.target),
     (out.refusals || []).filter((r) => r.at === "suggest").map((r) => r.code)],
    [["INQ-CITED"], []]);
  t("FT2g (D-451): dedup compared against the project's one question, never an empty id",
    st.bvIds, ["INQ-CITED"]);
}
{
  const { out, st } = await projectRun({ cites: ["INQ-CITED-A", "INQ-CITED-B"] },
    [{ kind: "basis-version", name: "cited", target: "INQ-CITED-B",
       description: "a reading naming one of the project's two questions" }]);
  t("FT2e (D-451): a project run citing SEVERAL questions does not pick one — its target is UNDETERMINED, "
    + "the count stated, and the level-empty candidate is refused by the PLANE's words while the candidate "
    + "naming its own question LANDS",
    [out.target?.id ?? null, /^UNDETERMINED: .* 2 questions/.test(out.target?.basis ?? ""),
     (out.refusals || []).filter((r) => r.at === "suggest").map((r) => r.code),
     st.suggested.map((x) => `${x.name}@${x.target}`)],
    [null, true, ["SUGGEST_NO_TARGET"], ["cited@INQ-CITED-B"]]);
}
{
  const { out } = await projectRun({ cites: ["INQ-CITED"], noQuestions: true }, []);
  t("FT2f (D-451): a plane that publishes NO question set leaves a project run's target UNDETERMINED and "
    + "STATED — the member never derives the set itself",
    [out.target?.id ?? null, /^UNDETERMINED: .*does not publish that set/.test(out.target?.basis ?? ""),
     (out.refusals || []).filter((r) => r.at === "suggest").map((r) => r.code)],
    [null, true, ["SUGGEST_NO_TARGET"]]);
}

console.log("\n--- FT3 · FL-11: the principal gate reaches the suggestion, through the op ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-FL11",
                     runPrincipal: "aik-" + "d".repeat(64) });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [{ targets: [] }, { reports: [] },
                 { candidates: [{ kind: "basis-version", name: "v1", description: "a reading under another's run" }] },
                 {}],
  })).json();
  const st = await mockState(mf);
  t("FT3 (FL-11): a suggestion under a run whose principal is not the caller is refused AI_RUN_NOT_PRINCIPAL "
    + "(C-22.12) and nothing lands",
    [(out.refusals || []).filter((r) => r.at === "suggest").map((r) => `${r.code}/${r.plane?.check}`), st.suggested],
    [["AI_RUN_NOT_PRINCIPAL/C-22.12"], []]);
  await mf.dispose();
}

console.log("\n--- FT4 · FL-12: an internet-level target files a request naming its ADDRESS ---");
{
  const mf = newMf({ mode: "check", maxPasses: 1, budget: wide, target: "INQ-FL12" });
  const out = await (await runOp(mf, {
    ...base,
    judgements: [{ targets: [{ level: "internet", url: "https://example.org/council/minutes" },
                             { level: "internet", url: "http://localhost/admin" }] },
                 { reports: [] }, { candidates: [] }, {}],
  })).json();
  const st = await mockState(mf);
  t("FT4 (FL-12, the ADDRESS arm): the public locator was QUEUED, named by `address`, under the run's target",
    st.requests, [{ run: base.run_id, target: "INQ-FL12", address: "https://example.org/council/minutes" }]);
  t("FT4b (FL-12): no request body carried the locator in `url`, the field the plane never reads",
    st.log.filter((l) => l.op === "capturerequest" && l.body && "url" in l.body).length, 0);
  t("FT4c (FL-12): the non-public locator was refused by the plane's name and C-number, and published",
    (out.refusals || []).filter((r) => r.at === "capturerequest").map((r) => `${r.code}/${r.check}`),
    ["CAPTURE_REQUEST_NOT_PUBLIC/C-28.2"]);
  await mf.dispose();
}

/* ========================================================================= *
 *  R · REC-100 / IC-130 — THE STEP LOG AGAINST THE REAL PLANE'S REFUSAL.
 *
 *  THE BLINDNESS THIS SECTION CLOSES, measured by REC-100 on 2026-09-16 and
 *  recorded in its DELEGATION: every mock of `op=airuntick` in this member's
 *  suites ACCEPTS ANY ENTRY, so the day C-22.10's `run` carve-out was deleted
 *  a model-judged bare PRESENT started being refused by the plane, this member
 *  did not read `refused[]`, and the entry vanished — with every suite green.
 *
 *  SO THE TICK IS NOT MOCKED HERE. A `plane-front` worker forwards every op to
 *  the ordinary mock EXCEPT `airuntick`, which goes to the REAL plane
 *  (`bio-plane/src/plane/index.mjs` under miniflare, its own Durable Object and
 *  SQLite), with a run opened there lazily on the first tick. The verdict on
 *  each entry — `appended`, `refused[]` and each refusal's shape — is therefore
 *  the plane's own `checkObservation` through its own `#aiRunAppend`, not a
 *  copy of it. The budget spend is NOT forwarded (the real run's bounds are the
 *  fixture's, not the mock's), which is stated so nobody reads R as a budget arm.
 *
 *  NEGATIVE CONTROL (declared and RUN 2026-09-18, REC-100, via REC-100's driver
 *  `bio-plane/test/nc-rec100.mjs`, deleted with the old battery in T20; its two
 *  arms are carried since T21 as `test/harness.control.mjs` S1 and S2):
 *    `aw-steplog` — revert `stepLog` to write the model's PRESENT verbatim.
 *        Declared MUST FAIL R1 and R1b; MUST NOT FAIL R2.
 *    `aw-refused` — revert the tick site to `logged += 1` with `refused[]`
 *        unread. Declared MUST FAIL R2 and R2b; MUST NOT FAIL R1.
 *  ACTUAL: `aw-steplog` — A8 (REC-100), R1, R1b red (224/3), R2/R2b green: AS
 *  DECLARED. `aw-refused` — FIRST RUN NOT AS DECLARED and it was BOTH the arm
 *  and the suite: the arm restored only the unread `refused[]`, not the
 *  envelope count, and R2b compared two fields the same code fills, so it
 *  stayed green 0 = 0. The arm now restores both halves of the old site, R2b
 *  counts off the trace and the REAL plane's log, and the re-run is R2 R2b red
 *  (225/2): AS DECLARED. Baseline both ends 227/0. Restores byte-identical.
 * ========================================================================= */
console.log("\n--- R · REC-100: the step log meets the REAL plane's refusal (IC-130) ---");
{
  /* T41 B6 (K2520): the real plane holds a passing test bar, or run-rules R19 refuses the fixture's run
     AI_RUN_MODE_NOT_DEPLOYED (C-109.1) and REC100-0 reads its log empty; see `./plane-world.mjs`. */
  const PLANE_WORLD = await planeEntry();
  const RB = "INQ-2026-0918-rec100-aw";
  const PROMOTE = {
    bundleId: RB, base: null, snapKey: "20260918T090000Z_inbox", author: "ruth",
    meta: { object_type: "inquiry", group: "believe-in-oakland", title: "does the step log land?",
            current_state: "open", created: "2026-09-18T09:00:00Z", last_updated: "2026-09-18T09:00:00Z" },
    files: [{ path: "bundle.md", text: `---\nid: ${RB}\n---\n\n## Question\n\nDoes it land?\n`,
              bytes: 90 /* REC-175 (2026-09-23): CORRECTED, not exempted — this sent sha256: "a".repeat(64), which is not the SHA-256 of the text above, and the old op=promote stored it as given; promote now refuses that by name (FILE_DIGEST_MISMATCH, C-33.38), so no digest is sent and the plane computes it from the bytes */ }],
    register: [] };
  const PROJECT_MD = ["---", "object_type: project", "current_state: forming", 'created: "2026-09-18T09:00:00Z"',
    'last_updated: "2026-09-18T09:00:00Z"', "references: []",
    /* T10: a project states its objective or the plane refuses it NO_OBJECTIVE (intent R1, C-2.9; N168). */
    'objective: "Find out whether the step log lands."', "---", "", "## Summary", "",
    "The project the member token's surfacing run is opened over (REC-171).", "", "## Session Log", ""].join("\n");
  const SURFACING_PROJECT = {
    base: null, snapKey: "20260918T085900Z_inbox", author: "ruth",
    meta: { object_type: "project", group: "believe-in-oakland", title: "REC-171 surfacing project",
            current_state: "forming", created: "2026-09-18T09:00:00Z", last_updated: "2026-09-18T09:00:00Z" },
    files: [{ path: "bundle.md", text: PROJECT_MD, bytes: PROJECT_MD.length,
              sha256: createHash("sha256").update(PROJECT_MD).digest("hex") }],
    register: [] };
  const SURFACING_OPEN = { run: "RUN-2026-0918-rec171-surfacing", contextType: "project",
    label: "REC-171: the run the context question is surfaced inside", mode: "check", principalAi: MEMBER,
    principalAiRef: "ruth's own account", skillVersion: "investigative-session@1", biasManifest: null,
    bounds: [{ bound: "surfaces", allowed: 1, unit: "questions" }], leaseMs: 3600000 };
  const OPEN = { contextType: "inquiry", contextId: RB, label: "REC-100's agent-worker fixture",
    mode: "check", principalAi: MEMBER, principalAiRef: "ruth's own account",
    skillVersion: "investigative-session@1", biasManifest: null,
    bounds: [{ bound: "fetches", allowed: 100000, unit: "requests" }], leaseMs: 3600000 };
  /* K1610 (ai-runs R52, K1503): a run opens only on the account of the member whose act starts it, so the opener names
     Ruth and her own account is connected first, by her act (credentials R22). N585 (T34-39; K1614, K1621): the plane
     routes `op=accountreferenceset` for a member's SESSION, never a deploy token (CLASS_FORBIDDEN), and keeps the
     reference under the copy's seal secret, so the fixture enrols Ruth with the administrator's token, signs her in,
     connects her account under her session, and makes every act of hers below (the surfacing project, the question,
     both opens, each tick) under that session: the run's opener is then the member whose account it carries.
     T53 (BOB's ruling, 4 Nov; ai-accounts R1, R7, R51; ai-runs R9): `accountreferenceset` is retired; her own account
     is one of the catalogue's API plan for members (`MEMBER_PLAN`, ai-accounts' published fixture, seeded in the
     plane by `./plane-world.mjs`), added by her `op=aiownadd`, its key sealed, switched on by her `op=aiaccountswitch`,
     and the notice of what its host receives seen by her `op=aisend`; a run names her as `principalAi`. */
  const RUTH_ID = MEMBER.replace(/^member:/, "");
  const CONNECT = { provider: MEMBER_PLAN.provider, plan: MEMBER_PLAN.plan, means: "sealed", secret: ACCOUNT.secret };
  const FRONT = `
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.searchParams.get("op") !== "airuntick") return env.MOCK.fetch(req);
    const body = await req.json();
    const real = async (op, tok, b) => {
      const headers = tok ? { authorization: "Bearer " + tok } : {};
      const r = await env.REAL.fetch("http://real/api/?op=" + op,
        b === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(b) });
      const j = await r.json();
      return j && typeof j === "object" && "result" in j ? j.result : j;
    };
    if (!globalThis.__session) {
      const id = ${JSON.stringify(RUTH_ID)};
      const add = await real("memberadd", env.ADMIN, { memberId: id, cover: "c-" + id, role: "admin",
                                                       capabilities: ["contribute", "publish"] });
      await real("enroll", null, { invite: add.invite, handle: id, password: id + "-passphrase-1" });
      globalThis.__session = (await real("login", null, { handle: id, password: id + "-passphrase-1" })).token;
      /* credentials R66 (T47): connecting Claude asks for the password again within five minutes, or REAUTH_DUE. */
      await real("reauth", globalThis.__session, { password: id + "-passphrase-1" });
      /* instance-setup R44, credentials R64 (T47): the disclosure shown to her, by her, before she connects, or
         DISCLOSURE_DUE (C-29.40); its version is the one her own read (op=disclosureof) answers. */
      const shown = await real("disclosureof", globalThis.__session);
      await real("disclosureshown", globalThis.__session, { member: "member:" + id, version: shown && shown.version });
      const added = await real("aiownadd", globalThis.__session, ${JSON.stringify(CONNECT)});
      if (!added || !added.account_id) throw new Error("aiownadd: " + JSON.stringify(added));
      const on = await real("aiaccountswitch", globalThis.__session, { account_id: added.account_id, on: true });
      if (!on || on.ok !== true) throw new Error("aiaccountswitch: " + JSON.stringify(on));
      await real("aisend", globalThis.__session, ${JSON.stringify({ provider: MEMBER_PLAN.provider, host: MEMBER_PLAN.host })});
      globalThis.__connected = added;
    }
    const T = globalThis.__session;
    const post = (op, b) => env.REAL.fetch("http://real/api/?op=" + op,
      { method: "POST", headers: { authorization: "Bearer " + T }, body: JSON.stringify(b) });
    if (!globalThis.__opened) {
      /* CORRECTED 2026-09-23 by REC-171 (INVESTIGATIVE-SESSION.md §11 item 5, "Rule 2's reach", BOB #30): the MEMBER
         deploy token's creation of the context question is stamped surfaced_by: agent, so it names a running run the
         token holds, with a surfaces bound, or the plane refuses it SURFACE_NO_RUN. The fixture used to create it
         outside any run, which is the defect the ruling closes; it now opens that run over a project first. */
      const proj = await (await post("promote", ${JSON.stringify(SURFACING_PROJECT)})).json();
      await post("airunopen", { ...${JSON.stringify(SURFACING_OPEN)},
                                contextId: (proj && proj.result ? proj.result : proj).bundleId });
      await post("promote", { ...${JSON.stringify(PROMOTE)}, run: ${JSON.stringify(SURFACING_OPEN.run)} });
      globalThis.__opened = await (await post("airunopen", { ...${JSON.stringify(OPEN)}, run: body.run })).json();
    }
    return post("airuntick", { run: body.run, log: body.log, leaseMs: 3600000 });
  },
};`;
  const realMf = (cfg) => new Miniflare({
    workers: [
      { name: "agent-worker", modules: true, modulesRoot: "/", scriptPath: WORKER_SRC_PATH, script: WORKER_SRC,
        modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
        compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
        bindings: { VERSION: "test" }, serviceBindings: { PLANE: "plane-front" } },
      { name: "plane-front", modules: true, script: FRONT,
        compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
        bindings: { ADMIN: "adm-rec100-aw" }, serviceBindings: { MOCK: "plane-mock", REAL: "real-plane" } },
      { name: "plane-mock", modules: true, script: PLANE_MOCK,
        compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
        bindings: { MOCK: JSON.stringify(cfg) } },
      { name: "real-plane", modules: true, modulesRoot: "/", scriptPath: PLANE_WORLD.path, script: PLANE_WORLD.script,
        compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
        durableObjects: { STORE: { className: "Store", useSQLite: true } },
        r2Buckets: ["CAPTURES", "PUBLISHED"],
        bindings: { ADMIN_TOKEN: "adm-rec100-aw", PROBE_TOKEN: "prb-rec100-aw",
                    VERSION: "test", TASK_DRAIN_DELAY_MS: "600000",
                    /* N585 (credentials R23): the seal secret Ruth's account reference is kept under */
                    ACCOUNT_SEAL_SECRET: "rec100-aw-seal-secret",
                    /* T53: the test instance, and the catalogue's test key and signed list (`./plane-world.mjs`) */
                    ...PLANE_WORLD.bindings } },
    ],
  });
  const realLog = async (mf) => {
    const w = await mf.getWorker("real-plane");
    /* Read as Ruth, signed in with her own password (the front enrolled her): the shared member token is retired
       (C-38.11), and a credential travels in the Authorization header only (C-38.10). */
    const login = await (await w.fetch("http://real/api/?op=login", { method: "POST",
      body: JSON.stringify({ handle: RUTH_ID, password: RUTH_ID + "-passphrase-1" }) })).json();
    const session = (login && typeof login === "object" && "result" in login ? login.result : login)?.token;
    const j = await (await w.fetch(`http://real/api/?op=airunlog&run=${base.run_id}&limit=500`,
      { headers: { authorization: `Bearer ${session}` } })).json();
    return (j && typeof j === "object" && "result" in j ? j.result : j) || {};
  };

  /* R1 — (1): A MODEL-JUDGED PRESENT IS CARRIED, NEVER REFUSED AND NEVER LOST.
     The judgement at `plan` sets `observed: PRESENT`, which the state carries
     to every later step. Each of those entries reaches the REAL plane. */
  {
    const mf = realMf({ mode: "check", maxPasses: 1, budget: wide });
    const out = await (await runOp(mf, { ...base,
      judgements: [{ targets: [], level: "document", observed: "PRESENT" }] })).json();
    const log = await realLog(mf);
    const entries = Array.isArray(log.entries) ? log.entries : [];
    t("REC100-0: the fixture ARMED — the run completed and the REAL plane holds this run's entries (a real "
      + "log with nothing in it would make every assertion below free)",
      [out.ok, log.found, entries.length > 0, (out.present_unbacked ?? 0) > 0], [true, true, true, true]);
    t("REC100-1: a model-judged PRESENT is CARRIED — the REAL plane refused NONE of this run's step entries, "
      + "and not one of them is a bare PRESENT the record would have had to take on the model's word",
      [out.log_refused ?? "(not published)", entries.filter((e) => e.state === "PRESENT").length],
      [[], 0]);
    t("REC100-1b: …it is recorded as LOOKED_INDETERMINATE with the judgement STATED, once per judged step, "
      + "and `logged` equals what the record actually holds — nothing counted that did not land",
      [entries.filter((e) => e.state === "LOOKED_INDETERMINATE"
                        && String(e.detail || "").startsWith("the model judged PRESENT")).length,
       out.logged],
      [out.present_unbacked, entries.length]);
    await mf.dispose();
  }

  /* R2 — (2), THE CLASS AND NOT THE INSTANCE: ANY entry the plane refuses is
     SURFACED. A judged state the record has no word for is refused by the REAL
     plane per entry (C-22.1). Before REC-100 this member counted each such tick
     `logged` and the run's own output said nothing.
     MOVED BY R92 (R085), NEVER WEAKENED: this arm's trigger was a judged
     `condition` outside the record's vocabulary (C-22.4). That was WALK-085's
     cause B (every live entry refused), so this member now sends such a
     condition as stated text in `detail` (`loggable` in `index.mjs`, through the plane's
     own `checkCondition`) and it lands; REC100-3 below holds that. The class
     this arm tests, a per-entry refusal surfaced, rides on a state instead,
     which this member does not rewrite: a state is the look itself. */
  {
    const mf = realMf({ mode: "check", maxPasses: 1, budget: wide });
    const out = await (await runOp(mf, { ...base,
      /* R26 (K148): only a step that states a look sends an entry, so the bad state rides on a judged look. */
      judgements: [{ targets: [], level: "document", observed: "NO_SUCH_STATE_REC100" }] })).json();
    const log = await realLog(mf);
    const entries = Array.isArray(log.entries) ? log.entries : [];
    const lr = Array.isArray(out.log_refused) ? out.log_refused : [];
    t("REC100-2: every step entry the REAL plane refused is SURFACED in the run's own output — named by the "
      + "plane's code and C-number and the step it came from — and none is silently dropped",
      [lr.length > 0, [...new Set(lr.map((r) => `${r.code}/${r.check}`))], lr.every((r) => typeof r.step === "string")],
      [true, ["AI_LOG_STATE_UNKNOWN/C-22.1"], true]);
    /* THE EXPECTATION IS COUNTED OFF THE RECORD AND THE TRACE, NOT OFF `log_refused`.
       The first draft compared `refusals` against `log_refused` — two fields the
       same code fills — and the `aw-refused` control arm (refused[] unread) left
       it GREEN, 0 = 0: an equality that cost nothing. Sent is one tick per trace
       step, landed is what the REAL plane holds, and the difference is what must
       be named. */
    /* R26: one entry was SENT — the plan step's, the only step whose judgement stated a look. */
    const sent = 1;
    t("REC100-2b: …and they are in `refusals` too, while `logged` counts ONLY what landed — every entry "
      + "SENT (one, the judged look) is either held by the REAL plane or named as refused, none neither",
      [sent > entries.length, (out.refusals || []).filter((r) => r.at === "airuntick.log").length, out.logged],
      [true, sent - entries.length, entries.length]);
    t("REC100-2c: …and the one step that looked is the only one that sent — no NEVER_LOOKED entry reached the plane",
      [entries.length + lr.length, entries.filter((e) => e.state === "NEVER_LOOKED").length], [sent, 0]);
    await mf.dispose();
  }

  /* R3 — R92 (R085-8; WALK-085 F2, cause B), AT THE REAL PLANE'S APPEND PATH. A model writes prose where the judging
     tool offers `condition`, and says `governed` beside a definitive state. Both were refused per entry (C-22.4,
     C-22.2), so a live check run's log stayed empty. Now each lands, in the record's own words. */
  {
    const mf = realMf({ mode: "check", maxPasses: 1, budget: wide });
    const out = await (await runOp(mf, { ...base,
      judgements: [{ targets: [], level: "document", observed: "LOOKED_ABSENT", governed: true,
                     condition: "the source answered slowly, so we stopped" }] })).json();
    const log = await realLog(mf);
    const entries = Array.isArray(log.entries) ? log.entries : [];
    const e = entries.find((x) => String(x.detail || "").includes("condition stated as")) || {};
    t("REC100-3 (R92): a judged look with a free condition and a governed definitive state LANDS at the REAL plane — "
      + "nothing refused, logged > 0 and equal to what the record holds",
      [out.log_refused, out.logged > 0, out.logged], [[], true, entries.length]);
    t("REC100-3b (R92): …in the record's words: no condition, LOOKED_INDETERMINATE (D-104), and what the model said is "
      + "stated in detail, never dropped",
      [e.condition ?? null, e.state, /the source answered slowly/.test(e.detail || ""), /LOOKED_ABSENT/.test(e.detail || "")],
      [null, "LOOKED_INDETERMINATE", true, true]);
    await mf.dispose();
  }
  PLANE_WORLD.dispose();
}

console.log(`\nharness: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
