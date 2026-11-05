/* run-rules' DEC-49 table (R11, R15; K6, K64's pattern): every refusal the pure rules mint carries its row here, and so
 * do the rows of `ai-runs`' acts, which that module mints and reads here by key (its R35). Copied from `ai-runs/checks.mjs`
 * at the ai-runs split (K617, K649 (1), K624 (1)) with each row's code, number, translation and reasons unchanged; the
 * `where` of each row the pure rules mint now names this module's site (`rules.mjs`, `skill-version.mjs`), each such
 * change stamped by 1.49.0 (PROMOTION #20, T19 layer 2). `ai-runs`' own job deleted its copy after this module merged.
 * observation-log's C-22 rows (C-22.1–.4, .6, .9, .10, .17) are that module's; `./rules.mjs` answers `AI_RUN_CHECKS` as
 * those rows and this table's, one map. C-33's and C-66's other rows stay with their own families' owners (C-66.5
 * `inquiry`'s, C-66.6 `control-plane`'s). Tested in `test/m/run-rules/`.
 * DEC-149 (T34-86; K1784): a translation a member reads names the group's Civicsmith as "your group's Civicsmith", never
 * "this instance", "the copy" or "the plane" (C-33.29, C-109.1; C-109.9 until its retirement, R20). */

import { word, localize, hasWord } from "../setup-words/index.mjs";

/* R31 (T46; DEC-194; N913): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`) this module's
 * rows answer, each read by key through `setup-words`' `word(key)` (plan rule 6; K3632) as `membership`'s `HANDLE_WORDS` and
 * `extraction`'s `TRANSCRIBE_WORDS` are; a row's `translation` is the word itself, never a copy of the sentence (T50 corrects
 * the copies this table held, which had stayed "the group's account" after DEC-304 made it "the team's"). `refusal.AI_RUN_ORIGIN_UNKNOWN` is not held: its sentence speaks
 * only of a planning run, while `originAllowed` mints the code in every mode, so C-22.25 keeps its own sentence until the
 * design stream's covers both (R31). R32 (T47; N992; DEC-198): `refusal.MEMBER_RUN_MODE_NOT_ADMITTED`, which DEC-198 added,
 * is C-22.30's translation, read the same way. R35 (T50; N1169): `refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE` is C-22.31's. Frozen. */
export const RUN_RULES_WORDS = Object.freeze({
  'refusal.AI_RUN_REEXAM_NEEDS_RESPONSE': word('refusal.AI_RUN_REEXAM_NEEDS_RESPONSE'),
  'refusal.AI_RUN_REEXAM_OPEN': word('refusal.AI_RUN_REEXAM_OPEN'),
  'refusal.MEMBER_RUN_MODE_NOT_ADMITTED': word('refusal.MEMBER_RUN_MODE_NOT_ADMITTED'),
  'refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE': word('refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE'),
});

/* C-22's run rows: C-22.5, .7, .8, .11–.16, .18, T33's .19 (R18), .20 (R19) and .21 (R17), T41's .22 (R19's test
 * bar), .23 (R26) and .24 (R23), and T46's .29 (R30) and .30 (R32, minted by `ai-runs`), and T50's .31 (R35). The family's history and its reason for being one row per code are in
 * observation-log's `AI_RUN_CHECKS` header (`../observation-log/checks.mjs`), which holds the log's rows. C-22.7 (`checkSkillVersion`'s, R8) is
 * held here beside its one minting site, `./skill-version.mjs` (R8, R11; K333, N289); `skills` names it by key through
 * this module (its R25). */
export const AI_RUN_OWN_CHECKS = {
  /* §14b.6 IS THIS ITEM: "when a bound stops a run, the observation log says
     which bound and where it stopped". A close with no bound named is the
     `heldMatch` defect exactly — not found and did not finish looking made
     indistinguishable — so the terminate path REFUSES it rather than writing an
     unattributed ending. This is what makes "names the bound" a mechanism
     rather than an intention. */
  AI_RUN_BOUND_UNNAMED: {
    check: 'C-22.5',
    where: 'src/run-rules/rules.mjs checkBound, called from src/ai-runs/index.mjs #aiRunTerminate',
    translation: word('refusal.AI_RUN_BOUND_UNNAMED'),
  },
  /* SK-1, 2026-08-08. §11 lists THREE conditions a run is formed under — the
     bias manifest in force, the launching project's standard pair, and THE
     SKILL VERSION IT RAN UNDER — because "everything can change at the drop of
     a hat" and a version is only interpretable against them. SK-1's row makes
     the recording a REQUIREMENT and not an analogy (the Cerebras/Schulte
     disclosure standard), and a condition that may be omitted is not recorded:
     it is recorded by the runs that felt like it.

     REFUSED AT THE OPEN, beside the two principals, for the same reason those
     are: refusing later would mean a run had already searched under
     instructions nobody can name. Two ways to fail and ONE code, because they
     are one fact — the run object cannot say what it ran under. The worse of
     the two is a version that names no pack: `3` reads as an answer and
     identifies nothing, which is the blank-principal shape PL-4 measured one
     field over, arriving on a condition instead of an identity.

     A WHOLE-FUNCTION `where`: `checkSkillVersion` is small, single-purpose, and
     the only refusal it makes is this one. Moved from the catalogue with its
     reasons and translation unchanged (N289, K333); its `where` names the site
     this module holds (`skillpack.mjs`'s copy was deleted by N156). */
  AI_RUN_SKILL_VERSION_UNNAMED: {
    check: 'C-22.7',
    where: 'src/run-rules/skill-version.mjs checkSkillVersion, called from src/ai-runs/index.mjs open',
    translation: localize('run-rules.checks.this_run_did_not_say', 'This run did not say which version of its instructions it was working under. What a run found can only be read against the instructions it was given, so the record asks for that version before the run starts rather than guessing at it afterwards.'),
  },
  /* PL-18, 2026-08-09 — DEC-63'S GATE, AND IT IS THE ONE ROW IN THIS FAMILY
     THAT IS ABOUT WHO IS ASKING RATHER THAN ABOUT WHAT THE RUN OBJECT SAYS.
     Bob ruled 2026-08-09 that an investigation can be started by ANY MEMBER OF
     THE PROJECT: the gate is participation in the project the inquiry belongs
     to, and the capability token stays `contribute` only as the FLOOR beneath
     it. IS-6's provisional checked `contribute` alone.

     WHY IT IS ITS OWN CODE AND NOT THE CAPABILITY REFUSAL'S, which is the whole
     content of the item rather than a nicety. *You are not a member of this
     project* and *you lack contribute* are DIFFERENT FACTS ABOUT A MEMBER, and
     they have different remedies: one is answered by an owner of that project
     inviting you, the other by an administrator granting a capability. A single
     refusal covering both would tell a member nothing they can act on, which is
     DEC-49's rule and the ACT-AND-SAY principle in one place. The capability
     half keeps its own existing, differently-shaped refusal at the control
     plane (`NOT_CAPABLE`, carrying `needs`), so a caller can always tell which
     of the two stopped them.

     THE TRANSLATION DELIBERATELY NAMES NO PROJECT. A member who is not in a
     project may not be entitled to learn it exists — the skeleton-visibility
     rule (7.12) — so the canned sentence a surface renders says what happened
     and what to do, and the refusal's own `detail`, composed at the site, names
     only what the caller already put in their own request.

     CORRECTED 2026-09-19 by REC-145 (DEC-63 as amended by Bob, 2026-09-18): this refusal is now said
     ONLY over a run whose context is a PROJECT. A run over a question consults no project, so the old
     first sentence (*"asking the system to look into a question is work inside the project that
     question belongs to"*) stated the ruling Bob reversed — *a project does not own a line of inquiry*. */
  AI_RUN_NOT_PROJECT_MEMBER: {
    check: 'C-22.8',
    where: 'src/run-rules/rules.mjs projectGate, called from src/ai-runs/index.mjs open/tick/close',
    translation: word('refusal.AI_RUN_NOT_PROJECT_MEMBER'),
  },
  /* REC-153, 2026-09-19 — THE RUN'S CONTEXT IS THE KIND IT SAYS IT IS. Membership Architecture v2 §7, the
     DEC-63 ruling bullet, *"AND THE CONTEXT KIND IS CHECKED"* (BOB #16): *"A run's `contextType` must equal
     the named bundle's type; a mismatch is refused, and an id the caller cannot see answers as absent."*
     Once REC-145 made the run verdict turn on the KIND (a question consults no project), a run labelled
     `inquiry` over a PROJECT's id opened for a member who had not joined that project — the joined gate
     walked around by a word the caller chose.

     ONE CODE FOR THE MISMATCH, THE ABSENT ID AND THE HIDDEN ONE, and that is the §7.9 half of the ruling
     rather than economy. A second code for *"that is a project, not a question"* would be said over a
     project the caller can see and withheld over one they cannot, so the difference between the two codes
     would be the bit. The refusal is built from what the caller SENT and nothing else, which makes the
     three one object by construction (`#noSuchProject`'s discipline, one act over). It is one condition —
     *nothing of the kind you named answers to that id for you* — not two behind one number.

     CORRECTED THE SAME DAY on BOB #16's ruling (`7d03e852`), which the first build did not have: (i) A MACHINE
     SEES NO MORE THAN ITS PRINCIPAL — an `ai` credential's open over an id its member cannot see is that member's
     own absent answer, and an operator credential's open over a never-minted id is refused as absent too (the
     first build let a machine through for an id the store did not hold, on PL-18's word); (ii) THE KIND IS
     `RUN_CONTEXTS`' CLOSED VOCABULARY — any other word is refused HERE before any bundle is looked at, rather
     than matched against the bundle's type. Both are this row's one condition: the kind and id the caller named
     do not resolve to a context they can run in. A new code for (ii) was weighed and declined: C-22.12 is
     REC-152's, and the word refused is the caller's own, so the refusal can say which failed without a second
     code carrying any bit. */
  AI_RUN_NO_SUCH_CONTEXT: {
    check: 'C-22.11',
    where: 'src/run-rules/rules.mjs checkRunContextKind, called from src/ai-runs/index.mjs open',
    translation: word('refusal.AI_RUN_NO_SUCH_CONTEXT'),
  },
  /* REC-152, 2026-09-19 — TICK AND CLOSE ARE THE RUN'S PRINCIPAL'S ACTS (Membership v2 §7, "WHO MAY TICK
     AND CLOSE A RUN", BOB #16). C-22.12 and not C-22.11: CONDUCT #6 assigned C-22.11 to REC-153, which is
     on its own branch, so this number was taken with the gap left for it.

     WHY IT IS ITS OWN CODE AND NOT C-22.8's. *You are not in this project* and *this is not your run* are
     DIFFERENT FACTS with different remedies: the first is answered by an owner inviting you, the second by
     nobody — the run is its principal's, and one nobody drives ends on its own lease. A co-participant who
     is fully joined meets this and never C-22.8, and a single refusal covering both would tell them to ask
     for an invitation they already hold.

     SAID ONLY TO SOMEBODY WHO CAN SEE THE RUN'S CONTEXT. A caller who cannot is answered as for a run that
     does not exist, before this is reached (§7.9), so the sentence names nobody — neither the principal
     nor the caller — and the store's `detail` names only the rule. */
  AI_RUN_NOT_PRINCIPAL: {
    check: 'C-22.12',
    /* REC-165 (§11 item 5 rule 1, BOB #25): the run's two productions ask the same gate. */
    where: 'src/run-rules/rules.mjs runPrincipalGate, called from src/ai-runs/index.mjs tick/close/runGate/#surfacingGate and by run-productions',
    translation: localize('run-rules.checks.only_the_person_who_started', 'Only the person who started this investigation — or an AI credential they created for it — can continue it or end it. It is not about which projects you belong to or what you are allowed to do in general: an investigation nobody continues ends by itself when its time or budget runs out.'),
  },
  /* REC-169, 2026-09-23 (INVESTIGATIVE-SESSION.md §14b.6 — A RUN IS BOUNDED, AND THE BOUND IS RECORDED). The tick
     wrote `consumed + Number(v)` for any figure, so the run's own principal could REFUND a bound its member set
     (`surfaces: -1`, and open another question). A figure is a non-negative whole JSON number; the refusal is the
     whole tick's (or the whole open's, for a seed), and nothing is written. Its own code and not C-22.5's: that one
     is a CLOSE naming no bound, this is a figure no bound can hold. */
  /* REC-172, 2026-09-23: ALSO the member's `allowed` at the open (it was written `Number(x) || 0`, so `-1`, `1.5` and
     `"3"` became a declaration nobody made). One code for both halves of a bound's figure — the rule is the same whole
     number — and the translation widened from SPENDING to GIVING an amount so it reads true of either. */
  AI_RUN_CONSUME_INVALID: {
    check: 'C-22.13',
    where: 'src/run-rules/rules.mjs checkConsume, called from src/ai-runs/index.mjs tick and open',
    translation: word('refusal.AI_RUN_CONSUME_INVALID'),
  },
  /* REC-169 — THE BOUNDS THE PLANE COUNTS (`PLANE_COUNTED_BOUNDS`: `mints`, counted by extractPropose, and `surfaces`,
     counted by promote since D-85). WHY ITS OWN CODE: the figure may be perfectly well-formed; what is wrong is WHO
     is counting. The remedy differs too — the caller sends nothing for these, where C-22.13's caller sends a proper
     number. A zero claims nothing and is not refused. */
  /* REC-172, 2026-09-23: ALSO `lease` (`PLANE_DECIDED_BOUNDS`), at the tick and as a declaration at the open, and
     for ANY figure including zero. Same rationale — the plane decides it, off the clock — so the same code; the
     translation now names the lease beside the counts. */
  AI_RUN_BOUND_PLANE_COUNTED: {
    check: 'C-22.14',
    where: 'src/run-rules/rules.mjs checkConsume, called from src/ai-runs/index.mjs tick and open',
    /* R26 (T41-21): `pages` joins the plane-counted bounds, so the sentence names pages read beside the rest. */
    translation: word('refusal.AI_RUN_BOUND_PLANE_COUNTED'),
  },
  /* REC-172, 2026-09-23 (INVESTIGATIVE-SESSION.md §14b.6). A tick's `consume` key naming no bound, and a `consume`
     that is not a map at all (an ARRAY, whose keys are positions), were SKIPPED: the tick answered `ticked: true` and
     spent nothing, so a caller believed it counted work the record never held (the live instrument vf4 sent an array
     for its whole life). The open DROPPED an entry naming no bound, so a member who declared `fetchs: 3` got a run
     with no fetch ceiling. Its own code and not C-22.13's: the figure may be perfectly good; what is wrong is that it
     names nothing the run has, and the remedy (spell the bound, send a map) differs. */
  AI_RUN_BOUND_UNKNOWN: {
    check: 'C-22.15',
    where: 'src/run-rules/rules.mjs checkConsume (the tick\'s map, the open\'s list, and every key in either), called from src/ai-runs/index.mjs tick and open',
    translation: word('refusal.AI_RUN_BOUND_UNKNOWN'),
  },
  /* REC-177, 2026-09-23 (INVESTIGATIVE-SESSION.md §14b item 6, BOB #30). A bound declared at `op=airunopen` with an
     ABSENT or ZERO `allowed` was opened at 0, and `finishedBound` reads 0 as NO CEILING — so the run recorded a bound
     it did not have. Refused at the open, nothing written. Its own code and not C-22.13's: C-22.13 is a figure of the
     wrong FORM (a string, a fraction, a negative), and 0 is a perfectly good whole number; what is wrong here is that
     the declaration states no allowance, and the remedy differs (state one, or do not declare the bound). */
  AI_RUN_BOUND_NO_ALLOWANCE: {
    check: 'C-22.16',
    where: 'src/run-rules/rules.mjs checkConsume (the open\'s list, its allowance arm), called from src/ai-runs/index.mjs open',
    translation: localize('run-rules.checks.the_investigation_was_given_a', 'The investigation was given a limit on part of its budget without saying how much it may use. A limit of nothing would mean no limit at all, so the investigation was not started. Give it an amount, or leave that part out.'),
  },
  /* N293 (AGENT-WORKER #2 J1; REC-169's rule, one figure over), R45 — THE RUN'S SCRATCH IS BOUNDED. `state` is the
     run's resumable work list (R12, DEC-61: never a transcript), and it was stored with no bound on its size: the run's
     principal could write any amount on every tick, into a row every read of the run publishes whole (R19). The
     ceiling is `AI_RUN_STATE_MAX_BYTES`, measured as the UTF-8 length of the state's JSON, the bytes the row holds. Its
     own code and not C-22.13's: the figure there is a budget's; here nothing is wrong with any figure, the work list is
     simply too large to keep, and the remedy differs (keep less, or keep it elsewhere). A WHOLE-FUNCTION `where`, as
     C-22.7's: `checkRunState` makes this one refusal and no other; the open and the tick relay it. */
  AI_RUN_STATE_TOO_LARGE: {
    check: 'C-22.18',
    where: 'src/run-rules/rules.mjs checkRunState, called from src/ai-runs/index.mjs open and tick',
    translation: word('refusal.AI_RUN_STATE_TOO_LARGE'),
  },
  /* R18 (K1481; T33-49): AN AI RUN OR ASK STARTS ONLY AT A MEMBER'S ACT, with one exception: the AI half of a standing
     question a member wrote, which reads only, asks only, and runs on its author's own account. `startAllowed` makes the
     decision; `ai-runs` and `answers` relay it before anything is written or any model is called. A C-22 row because
     its one minting site is this module's pure rule (`rules.mjs`), as C-22.8's is. */
  AI_RUN_NOT_A_MEMBER_ACT: {
    check: 'C-22.19',
    where: 'src/run-rules/rules.mjs startAllowed, called from src/ai-runs/index.mjs open and by answers',
    translation: word('refusal.AI_RUN_NOT_A_MEMBER_ACT'),
  },
  /* R19 (VF-4; T33-49): THE ACT THAT RECORDS A MODE'S FIRST LIVE RUN VERIFIED is judged here and written by `ai-runs`.
     One code for every way the act is unfit (a mode outside the order, no run, no person verifying, a machine
     verifying, no evidence), the detail naming which field: they are one fact — this record cannot enable the next
     mode — and each remedy is to fill the field the detail names. */
  AI_RUN_VERIFICATION_UNFIT: {
    check: 'C-22.20',
    where: 'src/run-rules/deployment.mjs checkVerification, called from src/ai-runs/index.mjs',
    translation: word('refusal.AI_RUN_VERIFICATION_UNFIT'),
  },
  /* R17 (Q0-5; T33-49): A PER-ASK BOUND DECLARED ABOVE ITS CEILING. R3's codes say the rest of R17's refusals (an
     unknown name, an absent or zero figure, a figure that is not a whole number); none of them says this truthfully —
     the figure is a good whole number, and it is simply more than one ask may have. */
  AI_ASK_BOUND_ABOVE_CEILING: {
    check: 'C-22.21',
    where: 'src/run-rules/rules.mjs checkAskBounds, called from agent-worker and answers when an ask starts',
    translation: word('refusal.AI_ASK_BOUND_ABOVE_CEILING'),
  },
  /* R19 as amended (T41-21; D11, D14): AN AI PART'S RESULT ON THE TEST INVESTIGATIONS, `ai-runs` R75's record, judged
     here as `verification_recorded` is: one code for every way the record is unfit (a part this module does not name, no
     set, a version that is not a whole number of one or more, a false-alarm rate outside 0 to 1, a `passed` that is not
     true or false, nobody grading, no time), the detail naming the field. Its own code and not C-22.20's: that one is a
     member's verification of a live run; this is a graded result on frozen test matters, and its remedy differs. */
  AI_TEST_BAR_UNFIT: {
    check: 'C-22.22',
    where: 'src/run-rules/test-bar.mjs checkTestBarRecord, called from src/ai-runs/index.mjs testBarRecord',
    translation: word('refusal.AI_TEST_BAR_UNFIT'),
  },
  /* R26 (T41-21; D2): A READ INSIDE A DOCUMENT KEPT FROM THE ASSISTANT. A material limit that covers reading (`ai-accounts`
     R22) refuses the read whatever the run's `pages` bound allows: the bound counts pages a run may read, it never
     licenses one. Minted here by `checkPagesRead`; the run's read relays it. The sentence names no limit's reason. */
  AI_RUN_READ_NO_AI: {
    check: 'C-22.23',
    where: 'src/run-rules/rules.mjs checkPagesRead, called from the run\'s read inside a held document',
    translation: word('refusal.AI_RUN_READ_NO_AI'),
  },
  /* B3 (K2482; AI-RUNS #14 J1): A GROUP'S OWN TEST MATTER THAT IS MALFORMED, refused by `ai-runs` R75's `groupTestSet`
     and read here by key. Its own code and not C-22.22's: that one is a graded result on a set; this is a matter a member
     offers a group's own set, and its remedy (say the part, the matter and its answers) differs. A group's set never
     opens or closes a deploy gate. */
  AI_GROUP_TEST_INVALID: {
    check: 'C-22.24',
    where: 'src/ai-runs/index.mjs groupTestSet, reached from the team\'s test investigations',
    translation: word('refusal.AI_GROUP_TEST_INVALID'),
  },
  /* R23 (T41-21; N820; B4, K2485): A RUN'S ORIGIN outside RUN_ORIGINS, or none. Minted by `originAllowed`, the one site,
     which `ai-runs` R73's open relays. An origin is said, never assumed. */
  AI_RUN_ORIGIN_UNKNOWN: {
    check: 'C-22.25',
    where: 'src/run-rules/rules.mjs originAllowed, called from src/ai-runs/index.mjs open',
    translation: localize('run-rules.checks.nothing_was_started_because_this', 'Nothing was started, because this investigation did not say where it came from in a way the record knows: an investigation is started by a member or by exploring a question, and nothing else.'),
  },
  /* B4 (K2485): `ai-runs` R73 — an exploring run works as a system step of its own, by its place and work and naming no
     step; minted by `ai-runs` (open's step region, only for an `explore` origin; B6, K2514), read here by key. */
  AI_RUN_EXPLORE_NEEDS_STEP: {
    check: 'C-22.26',
    where: 'src/ai-runs/index.mjs open > is-airun-open-step, reached from op=airunopen with origin explore',
    translation: word('refusal.AI_RUN_EXPLORE_NEEDS_STEP'),
  },
  /* R23 (B4, K2485): an `explore`-origin run while `investigate` is not deployable (R19: its chain and its test bar).
     Minted by `originAllowed`, which `ai-runs` R73's open relays. */
  AI_RUN_EXPLORE_NOT_DEPLOYABLE: {
    check: 'C-22.27',
    where: 'src/run-rules/rules.mjs originAllowed, called from src/ai-runs/index.mjs open',
    translation: word('refusal.AI_RUN_EXPLORE_NOT_DEPLOYABLE'),
  },
  /* B4 (K2485): `ai-runs` R73, R74 — the step a run names is not one the record holds for it; minted by `ai-runs`, read
     here by key (B6, K2514): a member's step run naming a step unseen or both a step and its own, a run of its own step
     with `steps` unreachable, and each unseen step of R74's batch. Something unseen answers as something absent. */
  AI_RUN_STEP_UNKNOWN: {
    check: 'C-22.28',
    where: 'src/ai-runs/index.mjs open > is-airun-open-step and its own step\'s steps check, reached from op=airunopen; '
      + 'and openMany, for each step of a member\'s batch she cannot see',
    translation: word('refusal.AI_RUN_STEP_UNKNOWN'),
  },
  /* R30 (T46; K231; K2816 (2)): AN AI PART NOT ADMITTED by the one deploy gate, `partAdmittedOn` (R29): its test bar is
     not held on Civicsmith's set and the instance is not a test instance, or the chain before it is not verified. Minted
     only by `partRefusal(part)`, the gate's refusal form, and relayed unchanged by the doors that had no refusal of their
     own (`plane` R40: the ask and the drafts). C-22.29, the next free number. `AI_RUN_MODE_NOT_DEPLOYED` (C-109.1) and
     `TRANSCRIBE_NOT_DEPLOYED` (C-51.7) keep their codes, numbers and sites. DEC-83's form: what happened, then what
     still works. */
  AI_PART_NOT_DEPLOYED: {
    check: 'C-22.29',
    where: 'src/run-rules/test-bar.mjs partRefusal, called from the doors partAdmittedOn does not admit (plane R40\'s ask '
      + 'and drafts)',
    translation: hasWord('ai.refused.aipartnotdeployed') ? word('ai.refused.aipartnotdeployed') : word('refusal.AI_PART_NOT_DEPLOYED'),
  },
  /* R32 (T46; K2947; `ai-runs` R18): A MEMBER'S OWN SIGN-IN RUN IN A MODE IT DOES NOT SERVE. On her own Claude sign-in
     a member's run is dispatched for her only in `check` or `plan` (Bob's K2892); any other mode is refused by `ai-runs`
     at its dispatch and read here by key. C-22.30, the next free number after R30's. DEC-83's form. T47 (N992; DEC-198):
     its translation is `words.json`'s `refusal.MEMBER_RUN_MODE_NOT_ADMITTED`, read by key (RUN_RULES_WORDS above) as R31's
     rows are; T46's interim sentence is gone, and code, number and `where` are unmoved. */
  MEMBER_RUN_MODE_NOT_ADMITTED: {
    check: 'C-22.30',
    where: 'src/ai-runs/index.mjs dispatchMemberRun > is-airun-member-dispatch, reached from op=airundispatch',
    translation: RUN_RULES_WORDS['refusal.MEMBER_RUN_MODE_NOT_ADMITTED'],
  },
  /* R35 (T50; N1169; K3501 (C2); `agent-harness` R18): A `level-empty` FINDING OVER A SCOPE WITH NO DOCUMENT IN IT. A level that
     had no document in scope was not looked at, so no absence is written for it: `levelEmptyHolds` is the rule's one
     statement, `agent-harness` asks it before it composes a candidate, and the row is what it answers when the finding does
     not hold. C-22.31, the next free number after R32's C-22.30. Its translation is `words.json`'s
     `refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE`, read by key (RUN_RULES_WORDS above). */
  LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE: {
    check: 'C-22.31',
    where: 'src/run-rules/rules.mjs levelEmptyHolds, called from agent-harness before it composes a level-empty candidate',
    translation: RUN_RULES_WORDS['refusal.LEVEL_EMPTY_NO_DOCUMENT_IN_SCOPE'],
  },
  /* R37 (T53; N1258, AD13, K5475): A PART WITHDRAWN FOR ONE AI by the standing measure (R19 as amended): its latest R75
     record for that entry on Civicsmith's current set did not pass. Minted only by `partRefusal`, read by key
     `ai.refused.partwithdrawn` (`PART_REFUSAL_WORDS`). C-22.34, the next free number after observation-log's C-22.33;
     the number is BOB's to confirm. Its translation is that key's word once the word table holds it, until then
     C-22.29's (the part has not passed Civicsmith's tests on the AI chosen). */
  PART_WITHDRAWN: {
    check: 'C-22.34',
    where: 'src/run-rules/test-bar.mjs partRefusal, when partWithdrawnOn names the part withdrawn for the entry',
    translation: hasWord('ai.refused.partwithdrawn') ? word('ai.refused.partwithdrawn') : word('refusal.AI_PART_NOT_DEPLOYED'),
  },
};

/* C-33.29–.31 and C-33.45–.47: the open's own act-shape refusals, from the catalogue's ACT_SHAPE_CHECKS. */
export const AI_RUN_ACT_SHAPE_CHECKS = {
  /* ---------------------------------------------------------------------------
     UI-38's §14a RIDER, AND IT IS IN THIS FAMILY BECAUSE ANOTHER FAMILY'S SUITE
     REFUSED IT — WHICH IS THE CORRECT OUTCOME AND IS RECORDED RATHER THAN
     WORKED AROUND.

     REC-64 first put this row in `AI_RUN_CHECKS`, where the run's other three
     open-time conditions live. `airun.test.mjs` ARM D3 failed it: **every C-22
     allocation must name its enforcement site in a PURE CHECK MODULE**
     (then `src/airun.mjs` or `src/skillpack.mjs`; today this module's
     `rules.mjs` and `skill-version.mjs`), so the catalogue can be walked to a
     pure function. This condition is enforced at the run-open door (then
     `store.mjs`, today `ai-runs`' open), so it does not satisfy that invariant
     and does not belong in C-22. The
     ARM WAS NOT WIDENED: an invariant relaxed to fit a new row is not an
     invariant, and this one is load-bearing — it is what lets `op=audit` reach
     every C-22 condition without opening the store. (Since T20 deleted that
     suite, `test/m/run-rules/table.test.mjs` R11 holds it: each C-22 row this
     table mints names this module's pure site.)

     WHAT IT IS. §14a promises the running-session surface SAYS SO when the
     capability is unavailable, and IS-BUILD-PLAN's FL-6 row names the failure it
     guards: *"when no token resolves the capability is UNAVAILABLE and says so —
     never a silent no-op"*. UI-38 correctly LEFT that sentence rather than
     authoring it at the surface, because member-facing refusal wording is
     DEC-49's. The site already refused this condition — with NO CODE, so a
     surface could only render the operator's sentence verbatim or blank, the
     exact state DEC-49 ended.

     THE TRANSLATION SAYS "NOTHING RAN" IN SO MANY WORDS, on purpose: an
     unavailable capability must not be indistinguishable from a run that looked
     and found nothing. The second is a claim about the world; the first is a fact
     about us. That is `CLAUDE.md`'s "our governor refusing is not the source
     failing", arriving at the run door.

     ITS `where` IS A WHOLE FUNCTION AND NOT A REGION, which is the only one in
     REC-64's work — and the reason WAS a defect in the guard (arm C of
     the refusal-code guard, deleted in T20; this paragraph and the
     two below are its history) rather than a
     judgement about the span. `aiRunOpen` refuses with `started: false`, and arm
     C's matcher was `ok: false`, so a REGION here would have judged zero refusals
     and FAILED as a drifted marker. The whole-function form is honest at this site
     (every refusal `aiRunOpen` makes is a condition of opening a run) and the
     blindness was measured and delegated at the guard's own `codesChecked` floor.

     **REC-76 CLOSED THAT DELEGATION (D-236), AND THE WHOLE-FUNCTION `where` IS
     WHAT MADE IT PAY.** Arm C then graded an outcome by whether it DECLARES ITSELF
     A SUCCESS rather than by one literal, so this site went from `92L (0 judged,
     0 code(s) checked)` to four refusals judged — and TWO of them were CODELESS,
     at a governed site, for as long as the row has existed. They are the two rows
     immediately below. Nothing about the span changed; the instrument started
     seeing it.

     **D-589 (2026-09-25) NARROWED ALL THREE INTO REGIONS, AND THE PARAGRAPH TWO
     ABOVE IS NOW HISTORY, NOT RULE.** The whole-function `where` stopped being
     honest the moment a SECOND family's refusal was written inside `aiRunOpen`:
     REC-207's first draft put its re-run refusals in a narrowed region there and
     the guard failed them by name, because the region was judged once by its own
     rows and again by this whole-function site, where their codes are not rows.
     So each of these three rows now names the region around its one refusal
     (`is-airun-open-context`, `-capability`, `-already`), and arm C stopped
     judging a claimed region a second time from an enclosing whole-function
     `where` (the guard's `nestedRegionsIn`). What the narrowing costs, stated:
     the five RELAYED refusals in `aiRunOpen` (existence, kind, gate, skill,
     seed — each minted and governed at its own site) are not read at this
     function while no whole-function row names it.
     --------------------------------------------------------------------------- */
  AI_RUN_CAPABILITY_UNAVAILABLE: {
    check: 'C-33.29',
    where: 'src/ai-runs/index.mjs open > is-airun-open-capability, reached from op=airunopen',
    translation: word('refusal.AI_RUN_CAPABILITY_UNAVAILABLE'),
  },

  /* ---------------------------------------------------------------------------
     REC-76 / D-236 — THE TWO CODELESS REFUSALS THE WIDENED CLASSIFIER FOUND.

     Both have been at this governed site since before the row above was written,
     and neither was ever judged, because arm C could not see a refusal spelled
     `started: false`. They are not new conditions and they are not new refusals:
     they are two sentences a surface could only render verbatim or blank, which
     is the state DEC-49 ended. **The item that fixes an instrument owes the
     sites the instrument newly sees, and these are them.**
     --------------------------------------------------------------------------- */
  AI_RUN_NO_CONTEXT: {
    check: 'C-33.30',
    where: 'src/ai-runs/index.mjs open > is-airun-open-context, reached from op=airunopen',
    translation: word('refusal.AI_RUN_NO_CONTEXT'),
  },
  AI_RUN_ALREADY_OPEN: {
    check: 'C-33.31',
    where: 'src/ai-runs/index.mjs open > is-airun-open-already, reached from op=airunopen',
    translation: word('refusal.AI_RUN_ALREADY_OPEN'),
  },

  /* ---------------------------------------------------------------------------
     REC-207 — THE RE-RUN LINK'S THREE REFUSALS (BOB #32, 2026-09-23 23:42Z).

     They are ACT-SHAPE conditions — the answer to *may this open carry this
     link* — so they belong here rather than in a family of their own (SK-1's
     rule, and the same one that put the BIAS_DEBT rows in BIAS_CHECKS).

     WHY THEY ARE REFUSALS AT ALL, rather than a link stored and judged later.
     `aiRunClose` settles a bias debt on the strength of `rerun_of`, so a link
     the record cannot stand behind is a DISCHARGE resting on the caller's word.
     The three conditions are the three ways that could happen: the run names
     itself, it names something that is not there, or it names work in another
     context whose lens is a different lens entirely.

     A WHOLE-FUNCTION `where`, AND WHY. These three were first written inside a
     narrowed REGION, which is what the old process's `kickoffs/WORKER.md` (retired) asked for — and
     the refusal-code guard then FAILED all three by name: `aiRunOpen`'s three
     rows of the time carried a WHOLE-FUNCTION `where`, and the guard judged a
     region's refusals twice, once at the region and once at the enclosing
     function, where their codes were not rows. So these three were written at
     the whole function. D-589 (2026-09-25) then narrowed those three neighbours
     into governed regions (`is-airun-open-context`, `-capability`, `-already`,
     the rows above) and made arm C judge a claimed region once, by its own rows
     (`nestedRegionsIn`). These three are now the ONLY rows naming `aiRunOpen`
     as a whole, and the three regions' lines inside it are governed by the
     regions, not by this site. Narrowing these three into a region of their own
     is now possible and has not been done.
     --------------------------------------------------------------------------- */
  AI_RUN_RERUN_SELF: {
    check: 'C-33.45',
    where: 'src/ai-runs/index.mjs open, reached from op=airunopen',
    translation: word('refusal.AI_RUN_RERUN_SELF'),
  },
  AI_RUN_RERUN_UNKNOWN: {
    check: 'C-33.46',
    where: 'src/ai-runs/index.mjs open, reached from op=airunopen',
    translation: word('refusal.AI_RUN_RERUN_UNKNOWN'),
  },
  AI_RUN_RERUN_OTHER_CONTEXT: {
    check: 'C-33.47',
    where: 'src/ai-runs/index.mjs open, reached from op=airunopen',
    translation: word('refusal.AI_RUN_RERUN_OTHER_CONTEXT'),
  },
};

/* ===========================================================================
 * REC-69 — THE CONTEXT-KEYED RUN LIST'S REFUSALS. C-36, THREE NUMBERS.
 *
 * RENUMBERED C-34 -> C-36 on 2026-08-09 at this item's replay onto `main`, minted
 * with the old process's `node tools/mintid.mjs C` (floor C-35; that tool was
 * retired in T19) rather than by reading this file and adding one. REC-63's `ROUTE_MARK_CHECKS` took C-34.1-4 the same day and is
 * already on `main`, so it keeps the number. **REC-69 measured C-34 free when it
 * looked and was right when it looked** — which is exactly the finding D-243
 * recorded when seven items collided on an id in one day: the convention was the
 * defect, not the vigilance. **AND THE COLLISION WAS INVISIBLE TO THE BATTERY**
 * (the old suite runner, `battery.mjs`, deleted since).
 * 139/139 suites green at 8,887 assertions with two families both claiming
 * C-34.1-3; only the old `civicos-ui` suite caught it (through its
 * refusal-code guard, deleted in T20), with *"Two conditions behind one
 * C-number are one condition as far as op=audit can see."* Within this table, one
 * C-number per condition is held today by `test/m/run-rules/table.test.mjs` R11.
 *
 * `op=airuns&contextType=&contextId=` answers the one question about a run
 * that no op could answer at all: WHICH RUNS ARE IN THIS CONTEXT. Every other
 * `ai_runs` read is keyed by RUN ID — measured by UI-49 at all 14 sites — so a
 * window could show a run only to the member who already held its address, and
 * §14a's promise is about the teammate who did not.
 *
 * WHY THIS IS A NEW FAMILY RATHER THAN THREE MORE C-22 ROWS, since C-22's own
 * header warns that a new `*_CHECKS` family is a floor somebody must move.
 * C-22's invariant is stated there: its rows are facts about THE RUN OBJECT,
 * refused where the object is WRITTEN — the observation's absence word, the
 * ending's condition, the bound that stopped it, the three conditions the run
 * was formed under. **None of these three is a fact about a run.** They are
 * facts about THE QUESTION A CALLER ASKED, refused at a READ that may well
 * match no run at all — MEANING_READ_CHECKS' shape one construct over, and that
 * family is the precedent this one follows rather than C-22's (it was a family of
 * this file; since T5 it lives in `src/retrieval/checks.mjs`, retrieval's). The floor in
 * the refusal-code guard (deleted in T20) was moved in the same
 * turn, from the figure the guard PRINTED.
 *
 * WHY THEY ARE REFUSALS AND NOT AN EMPTY ANSWER, which is the whole judgement
 * here. An unrecognised context kind that answered `runs: []` would tell a
 * member THERE ARE NO RUNS HERE — a claim about the record manufactured out of
 * a caller's typo, which is the failure this repository ranks worst (REC-52,
 * D-197) and the one `op=meaningrows` refuses for the same reason one table
 * over. The absence must be distinguishable from the mistake, so the mistake
 * stops.
 *
 * AND WHAT IS DELIBERATELY *NOT* REFUSED, because it is the same distinction
 * read the other way: a context that is REAL, well-formed, and holds no runs —
 * or holds runs the caller may not see — answers an ordinary EMPTY LIST. The
 * viewer gate withholds the row whole (REC-36) and publishes no count of what
 * it withheld, so "no runs here" and "no runs you may see" are ONE answer BY
 * CONSTRUCTION rather than by care. A fourth code for the unviewable case would
 * be the leak wearing a refusal's clothes.
 * ========================================================================= */
export const AI_RUNS_CONTEXT_CHECKS = {
  /* No kind named at all. There is no honest default: `inquiry` and `project`
     are different objects with different membership, and answering from one
     when the caller meant the other is a confidently wrong answer about a
     different context — MEANING_ROWS_NO_ARM's reasoning, one table over. */
  AI_RUNS_NO_CONTEXT_TYPE: {
    check: 'C-36.1',
    where: 'src/ai-runs/index.mjs listInContext > is-airuns-context, reached from op=airuns',
    translation: word('refusal.AI_RUNS_NO_CONTEXT_TYPE'),
  },
  /* A kind was named and the record has no such context. Refused rather than
     answered empty: see the header — an empty answer here would be the record
     saying nothing is running, on the strength of a word it did not recognise. */
  AI_RUNS_UNKNOWN_CONTEXT_TYPE: {
    check: 'C-36.2',
    where: 'src/ai-runs/index.mjs listInContext > is-airuns-context, reached from op=airuns',
    translation: word('refusal.AI_RUNS_UNKNOWN_CONTEXT_TYPE'),
  },
  /* A kind but no id. The gate is compiled over the CONTEXT ID, so a blank one
     would ask the record about every context at once — which is not a wider
     answer, it is a different question nobody asked. */
  AI_RUNS_NO_CONTEXT_ID: {
    check: 'C-36.3',
    where: 'src/ai-runs/index.mjs listInContext > is-airuns-context, reached from op=airuns',
    translation: word('refusal.AI_RUNS_NO_CONTEXT_ID'),
  },
};

/* D-85 / C-66.1–.4 — AN ASSISTANT OPENS A QUESTION ONLY INSIDE A RUN IT HOLDS (INVESTIGATIVE-SESSION.md §11
 * item 5, rule 2, BOB #25, 2026-09-21). Framework §12 lets an assistant open a question unattended and §13
 * requires it to carry the lens in force when it did; that lens exists only on a run (§3, RULED), and the
 * objective it pursued only as the run's context (DEC-24 rule 2). So an `ai` credential's creation of an
 * inquiry names a RUNNING run whose PRINCIPAL it is, and counts against the run's declared `surfaces` bound.
 * Asked by this module's step with `promotion` (R25) before the promotion's write, in REC-165's order: SIGHT
 * (a run the caller cannot see answers as one never minted, so SURFACE_NO_RUN covers both), then POSITION
 * (`runPrincipalGate`, C-22.12, relayed), then STATUS, then the BOUND. A MEMBER's own creation is untouched. */
export const SURFACE_RUN_CHECKS = {
  SURFACE_NO_RUN: {
    check: 'C-66.1',
    where: 'src/ai-runs/index.mjs #surfacingGate > is-surface-run',
    translation: word('refusal.SURFACE_NO_RUN'),
  },
  SURFACE_RUN_NOT_RUNNING: {
    check: 'C-66.2',
    where: 'src/ai-runs/index.mjs #surfacingGate > is-surface-run',
    translation: word('refusal.SURFACE_RUN_NOT_RUNNING'),
  },
  SURFACE_NO_BOUND: {
    check: 'C-66.3',
    where: 'src/ai-runs/index.mjs #surfacingGate > is-surface-run',
    translation: word('refusal.SURFACE_NO_BOUND'),
  },
  SURFACE_BOUND_REACHED: {
    check: 'C-66.4',
    where: 'src/ai-runs/index.mjs #surfacingGate > is-surface-run',
    translation: word('refusal.SURFACE_BOUND_REACHED'),
  },
};

/* R40 (K102, K182) / C-109 — NO RUN EXISTS IN A MODE NOT DEPLOYED (INVESTIGATIVE-SESSION.md §14b.4: every "may not"
 * is a refusal in the plane). The one deployment order (`./deployment.mjs`) names the modes that deploy, first to
 * last, and a mode enables only when the one before it is verified live (`plan` deploys apart, R14). Before this row the plane stored any mode
 * string at the open and only `agent-worker`'s own first row (its `gate-mode`) refused one, inside the fleet member,
 * so a caller that never ran the harness could open a run, and produce under it, in a mode nobody deployed. The open
 * now refuses it, after the skill version and before anything is written; a run that names no mode opens in the
 * deployed mode and records it (K182 (4c)); a blank or undeployed one is refused. */
export const AI_RUN_OPEN_CHECKS = {
  AI_RUN_MODE_NOT_DEPLOYED: {
    check: 'C-109.1',
    where: 'src/ai-runs/index.mjs open > is-airun-open-mode, reached from op=airunopen',
    translation: word('refusal.AI_RUN_MODE_NOT_DEPLOYED'),
  },
  /* F2 (coordinator ruling 5 Nov 03:50; ai-runs R40 as amended, T53, AIR5, AD14): a deployed mode no entry of the
   * opener's account has passed is refused at the open, after run-rules R8 and before anything is written, naming
   * `part`. The next free number in the family. ai-accounts' own PART_NOT_PASSED (C-29.61, an entry's offer) stays its own. */
  PART_NOT_PASSED: {
    check: 'C-109.15',
    where: 'src/ai-runs/index.mjs open > is-airun-open-part, reached from op=airunopen',
    translation: localize('run-rules.checks.nothing_was_started_because_none', 'Nothing was started, because none of the AI accounts your group\'s Civicsmith can use has passed the test for this part of the work. Ask whoever looks after your team\'s AI accounts to add one that has passed it, or do this part without AI.'),
  },
};

/* F3 (coordinator ruling 5 Nov 03:50; ai-runs R106, T53, AIR28, BR27; agent-steps R54) — A RETRIED WRITE OF A RUN.
 * `spawnPayload`, `tick` and `close` take `idem`, `<run>:<pass>:<step>:<n>`; one not of that shape, or whose run part is
 * not the call's run, is refused, nothing done. Minted by ai-runs, read here by key; the next free number in C-109. */
export const AI_RUN_IDEM_CHECKS = {
  AI_RUN_IDEM_INVALID: {
    check: 'C-109.16',
    where: 'src/ai-runs/index.mjs spawnPayload, tick, close > is-airun-idem, reached from op=airunspawn, op=airuntick, op=airunclose',
    translation: localize('run-rules.checks.nothing_was_done_because_this', 'Nothing was done, because this step of the investigation was sent with a repeat mark the record could not read, or one that belongs to another investigation. The step was not counted, so nothing is lost; it can be sent again as it was first written.'),
  },
};

/* R15 (K660; BIO_Action_v0_1.md §4 rule 1) / C-109.2–.7, and R28's C-109.13–.14 — THE PLANNING RUN'S OPEN. A run in mode `plan` works on one
 * action plan, for a member, inside a project, from what the record already holds, and proposes options; it neither
 * searches nor starts itself. `ai-runs` mints each of these at its open (its R46, R47), after `run-rules` R8 and its own
 * R40, nothing written on any, and reads the rows here by key as it does R11's. They join C-109, the open's family for
 * the mode a run asks for, after C-109.1 (K107 (3), K385: a new code's row is named by the job, in its own family).
 * `action-plans`' own planning codes are rows of its own table: this module holds no later module's rows. */
export const AI_RUN_PLAN_CHECKS = {
  /* R46: a run in mode `plan` names the plan it works on; it is stored on the run verbatim. */
  AI_RUN_PLAN_REQUIRED: {
    check: 'C-109.2',
    where: 'src/ai-runs/index.mjs open > is-airun-open-plan, reached from op=airunopen',
    translation: word('refusal.AI_RUN_PLAN_REQUIRED'),
  },
  /* R46: only a planning run carries a plan, so no other run's record suggests it worked on one. */
  AI_RUN_PLAN_UNEXPECTED: {
    check: 'C-109.3',
    where: 'src/ai-runs/index.mjs open > is-airun-open-plan, reached from op=airunopen',
    translation: word('refusal.AI_RUN_PLAN_UNEXPECTED'),
  },
  /* R46: a plan belongs to the project that will act on it. */
  AI_RUN_PLAN_NEEDS_PROJECT: {
    check: 'C-109.4',
    where: 'src/ai-runs/index.mjs open > is-airun-open-plan, reached from op=airunopen',
    translation: word('refusal.AI_RUN_PLAN_NEEDS_PROJECT'),
  },
  /* R46: only a member starts a planning run, for one plan at a time; nothing schedules, wakes or starts one. */
  AI_RUN_PLAN_NEEDS_MEMBER: {
    check: 'C-109.5',
    where: 'src/ai-runs/index.mjs open > is-airun-open-plan, reached from op=airunopen',
    translation: word('refusal.AI_RUN_PLAN_NEEDS_MEMBER'),
  },
  /* R46: a planning run declares `fetches` 0 and `subsessions` 0; it works from the record and does not search. */
  AI_RUN_PLAN_NO_SEARCH: {
    check: 'C-109.6',
    where: 'src/ai-runs/index.mjs open > is-airun-open-plan, reached from op=airunopen',
    translation: word('refusal.AI_RUN_PLAN_NO_SEARCH'),
  },
  /* R47: fail closed. The check a later module registers for the mode is what judges the plan; with none, no run. */
  AI_RUN_MODE_UNCHECKED: {
    check: 'C-109.7',
    where: 'src/ai-runs/index.mjs open > is-airun-open-check, reached from op=airunopen',
    translation: word('refusal.AI_RUN_MODE_UNCHECKED'),
  },
  /* R28 (T45; K2820, K2822; ai-runs R77): A RE-EXAMINATION RUN, the planning run started inside the member's act that
     records a response (v0.2 rule 16). Minted by ai-runs at its open after R46 and the origin (`originAllowed`, R23 as
     R28 amends it), read here by key. DEC-83's form: the sentence, then the remedy. R31 (T46; DEC-194; N913): each
     translation is `words.json`'s `refusal.<CODE>`, read by key (RUN_RULES_WORDS above); code, number and `where`
     unmoved. */
  AI_RUN_REEXAM_NEEDS_RESPONSE: {
    check: 'C-109.13',
    where: 'src/ai-runs/index.mjs open > is-airun-open-reexam, reached from op=airunopen',
    translation: RUN_RULES_WORDS['refusal.AI_RUN_REEXAM_NEEDS_RESPONSE'],
  },
  AI_RUN_REEXAM_OPEN: {
    check: 'C-109.14',
    where: 'src/ai-runs/index.mjs open > is-airun-open-reexam, reached from op=airunopen',
    translation: RUN_RULES_WORDS['refusal.AI_RUN_REEXAM_OPEN'],
  },
};

/* R20 (Q0-5; K1450, K1502, K1601; D79) / C-109.10–.11 — WHAT HOLDS AN AI RUN OR ASK BACK BEFORE IT STARTS that is not a
 * use limit: no account serves the member's act; and a member's limit set or read by another. `ai-runs` and `answers`
 * mint the first, `ai-use` the second (its R2; B6, K2514), and each reads the rows here by key, as R11's `ai-runs` rows are. They join C-109, the open's family, after the
 * planning run's rows. Each is said in plain words and names no cost: a translation names a cost to nobody but the
 * paying account's owners, to whom `ai-use` R10, R11 answer it (D12), and these rows are read by any member.
 * T40 (N812; K2373, K2400): the ceiling codes retired for `ai-use`'s limits (RETIRED_CHECKS below); `ai-use`'s rows are
 * its own, in its own table (its R8), not this module's. */
export const AI_USE_CHECKS = {
  /* R52 (K1502, K1503; K1755): no account serves the member's act — none of their own connected (a subscription token
     or an API key), and the group's API key, which an administrator may hold, not held or switched off. T40 (N812):
     or the account that would serve has this use switched off, where `AI_USE_SWITCHED_OFF` (`ai-accounts` R11) is not
     answered in its place. */
  AI_NO_ACCOUNT: {
    check: 'C-109.10',
    where: 'src/ai-runs/index.mjs open and the ask\'s account, reached from op=airunopen and an ask',
    translation: word('refusal.AI_NO_ACCOUNT'),
  },
  /* R50 (K1601, K1610): a member's ceiling is that member's own to set and read. The copy's ceiling is an
     administrator's, refused to anyone else by membership's NOT_AN_ADMIN, never by this row. Stays at T40 (`ai-use` R2),
     minted since by `ai-use` alone (B6, K2514): its owner bar for a member's account, and a member's own use read. */
  NOT_YOUR_CEILING: {
    check: 'C-109.11',
    where: 'src/ai-use/index.mjs aiLimitSet, aiUsage, exploreApprove, estimate and aiLimits (a member\'s account, its '
      + 'owner bar) and aiUsageMine, reached from op=ailimitset, op=aiusage, '
      + 'op=exploreapprove, op=ailimits and ai-runs\' batch estimate',
    translation: word('refusal.NOT_YOUR_CEILING'),
  },
};

/* R20 (T40; N812; K2373, K2400) — THE CODES RETIRED FROM THIS TABLE, each with the number it held, never reused, and the
 * code that replaced it (`ai-use`'s, in its own table). Kept as data so a later row cannot take a retired number:
 * `test/m/run-rules/table.test.mjs` R20 holds every number here apart from every row's. Frozen, every level. */
export const RETIRED_CHECKS = Object.freeze({
  AI_USE_CEILING_REACHED: Object.freeze({ check: 'C-109.8', retired_for: 'AI_LIMIT_REACHED' }),
  AI_USE_COPY_CEILING_REACHED: Object.freeze({ check: 'C-109.9', retired_for: 'AI_LIMIT_REACHED' }),
  AI_CEILING_INVALID: Object.freeze({ check: 'C-109.12', retired_for: 'AI_LIMIT_INVALID' }),
});

/** Every row this module holds, by code. */
export const AI_RUNS_CHECKS = Object.freeze({ ...AI_RUN_OWN_CHECKS, ...AI_RUN_ACT_SHAPE_CHECKS, ...AI_RUNS_CONTEXT_CHECKS,
  ...SURFACE_RUN_CHECKS, ...AI_RUN_OPEN_CHECKS, ...AI_RUN_IDEM_CHECKS, ...AI_RUN_PLAN_CHECKS, ...AI_USE_CHECKS });
