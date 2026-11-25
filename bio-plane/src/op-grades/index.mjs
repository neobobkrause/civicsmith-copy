/* op-grades — EVERY OP'S GRADE, STATED OR ABSENT (K617, K1907; split from `affordances` by copy, no meaning changed).
 *
 * The rung ladder and each writing op's rung, or the one ground on which it has none (R1–R3); the consequence statements
 * published beside a rung (R4, R8, R21); the codes that back a `reasoned` rung (R1); the ops refused to a machine by name
 * and every other gated op's reason (R5); the owners' ops, graded (R6–R17, R22–R25, R27–R37); the advisory phone set (R18,
 * R26); the Irreversible weight (R21); and the alias table that gives an alias its op's grade (R17).
 *
 * DATA ONLY, AND IT IMPORTS NOTHING OF ANOTHER MODULE (R19, R20). It decides no op's behaviour: each grade is read from
 * its owner's requirements, and `affordances`, which uses this module, checks that every op is graded and every rung
 * backed (its R12, R19, R20) and publishes these very objects in its `VOCABULARIES` (its R4). Names written in the
 * comments below (`STATES`, `decorateAct`, `ACTS`, `CAPTURE_ACTS`, `deriveActs`, `unaccounted`) are `affordances`'.
 *
 * T33's, T34's, T35's, T36's, T37's, T38's, T41's, T42's, T45's, T46's, T47's and T48's ops are graded in `./t33.mjs`,
 * `./t34.mjs`, `./t35.mjs`, `./t36.mjs`, `./t37.mjs`, `./t38.mjs`, `./t41.mjs`, `./t42.mjs`, `./t45.mjs`, `./t46.mjs`,
 * `./t47.mjs`, `./t48.mjs`, `./t49.mjs` and `./t50.mjs`, spread into the tables below; each of those files imports nothing (t34, t35, t41 and t45 only `word` from `setup-words`), so the spread closes no cycle. */

/* R13 (T33-85): the grades and reasons of every op T33 adds, spread into RUNGS, RUNG_ABSENT and NON_ACTS below. */
import { T33_RUNGS, T33_RUNG_ABSENT, T33_NON_ACTS } from "./t33.mjs";
/* R17 (K1864): the grades and reasons of the ops T34 declares, and op-declarations R21's aliases (`aliased`, applied
   below NON_ACTS). */
import { T34_RUNGS, T34_RUNG_ABSENT, T34_NON_ACTS, OP_ALIASES, aliased } from "./t34.mjs";
/* R21, R22 (K1943): T35's grades and reasons, and `personexpunge`'s consequence statement. */
import { T35_RUNGS, T35_RUNG_ABSENT, T35_NON_ACTS, T35_CONSEQUENCE_STATEMENTS } from "./t35.mjs";
/* R23–R25 (K2092, K2130): T36's grades and reasons, and `openwithwarning`'s consequence statement. */
import { T36_RUNGS, T36_RUNG_ABSENT, T36_NON_ACTS, T36_CONSEQUENCE_STATEMENTS } from "./t36.mjs";
/* R27 (N757, N776, N669; T37): T37's grades and reasons. */
import { T37_RUNGS, T37_RUNG_ABSENT, T37_NON_ACTS } from "./t37.mjs";
/* R28 (N788; DEC-183 (2); T38): the withdrawal of a mark on a photo, and the mark's own rung. */
import { T38_RUNGS, T38_NON_ACTS } from "./t38.mjs";
/* R29, R30 (N797, N799, N820, N812; T41): the handle ops and T41's ops, graded from their owners. */
import { T41_RUNGS, T41_RUNG_ABSENT, T41_NON_ACTS } from "./t41.mjs";
/* R31 (N832; T42): `pagetranscribe`, the AI's reading of the pages Civicsmith could not read. */
import { T42_RUNG_ABSENT, T42_NON_ACTS } from "./t42.mjs";
/* R32 (T45; N893): every op T45's owners serve, graded from their owners. */
import { T45_RUNGS, T45_RUNG_ABSENT, T45_NON_ACTS } from "./t45.mjs";
/* R33 (T46): every op T46 adds, graded from its owner. */
import { T46_RUNGS, T46_RUNG_ABSENT, T46_NON_ACTS } from "./t46.mjs";
/* R36, R37 (T47) and K3104: every op T47's owners add, graded from its owner. */
import { T47_RUNGS, T47_RUNG_ABSENT, T47_NON_ACTS } from "./t47.mjs";
/* R38–R41 (T48): every op T48's owners add, graded from its owner, and R39's two given rows. */
import { T48_RUNGS, T48_RUNG_ABSENT, T48_NON_ACTS, T48_MACHINE_REFUSALS } from "./t48.mjs";
/* R43 (T49; N1072, N1091): `founderhandleset` and `projectownervotes`, graded from their owners. */
import { T49_RUNG_ABSENT, T49_NON_ACTS } from "./t49.mjs";
/* R45, R47 (T50; DEC-300 (5)): T50's new ops, graded from their owners, and the four acts DEC-300 (5) weighs Reversible. */
import { T50_RUNGS, T50_RUNG_ABSENT, T50_NON_ACTS } from "./t50.mjs";
/* R48 (T51; DEC-340): the three reads the design's new screens add, stated absent as reads. */
import { T51_NON_ACTS, T51_RUNGS, T51_RUNG_ABSENT, T51_ACT_NON_ACTS } from "./t51.mjs";
/* R49, R50 (T51 fix round; K4168): the owners' op declarations, taken into the tables above (`registerDeclaredOps`). */
import { createDeclaredOps } from "./declared.mjs";
import { word, localize } from "../setup-words/index.mjs";
export { OP_ALIASES, aliased } from "./t34.mjs";
/* R42 (T48): the design's weight for each rungless act a registered screen lists; it grades nothing. */
export { MARKS, MARK_SOURCES } from "./marks.mjs";

/* ===========================================================================
 * FW-14 — THE WEIGHT LADDER, ASSIGNED TO EVERY MUTATING OP OR STATED ABSENT.
 *
 * WHAT THIS BLOCK IS FOR, and it is not the ladder. The value here is that
 * EVERY mutating op is ACCOUNTED FOR and a NEW one cannot arrive unclassified.
 * `unaccounted(opTable)` (`affordances` R12) takes the control plane's table of ops — each
 * `{op, mutating, gated}` — and answers the classification TOTAL IN BOTH
 * DIRECTIONS: no mutating op missing from RUNGS ∪ RUNG_ABSENT, and no key of
 * either naming something the table does not carry as mutating.
 *
 * THE ABSENCE HALF IS HALF THE DELIVERABLE, not a get-out. An op with no rung
 * and no statement is indistinguishable from an op nobody classified; CLAUDE.md
 * requires that undetermined be STATED. So `RUNG_ABSENT` is a required, checked
 * table, not a fallback — an op reaches `rung: null` only by being named there
 * with a ground.
 *
 * FW-14 superseded REC-19's "do not add a rung without a document": rungs are derived from the enforcement, and
 * the suite counts the mutating ops rather than this comment.
 * =========================================================================== */

/* THE LADDER, low to high, and it is PUBLISHED (vocabularies.rung_ladder) so a
 * surface reads the order rather than holding its own copy — DISPOSITIONS'
 * reasoning exactly.
 *
 * DEC-19 AS AMENDED 2026-08-03 IS THE AUTHORITY FOR THE TOP RUNG. Bob:
 * *"Publishing IS an irreversible act! It's (one of?) the only irreversible
 * acts."* Correction is always possible and always moves FORWARD — a new
 * edition (a separate document; all published editions stand), a withdrawal by
 * another attested act (both stand), a finding rescinded to an inquiry by
 * removing its claim. That path is stated BESIDE the rung, never instead of it.
 *
 * `terminal` IS RETAINED, AND THAT IS A JUDGEMENT MADE ON MEASUREMENT — read
 * this before removing it. DEC-19's 2026-08-02 half wrote that `terminal`
 * ("cannot be walked back") "no longer describes anything in the system",
 * reasoning from DEC-12: a published case may be revised as a new edition and a
 * closed finding may be reopened. That reasoning is about the rungs that were
 * then the ladder's TOP TWO. It was never checked against the state machine, and
 * the state machine disagrees: `STATES.information.edges.retired` is `[]`, so
 * `op=retire` moves a bundle to a state with NO outgoing edge and there is no
 * act in this catalogue that walks it back. With `irreversible` restored above
 * it, `terminal` is no longer claiming to be the top of anything — it is the
 * mid-ladder name for exactly what Constructs:161 called it, "internal, cannot
 * be walked back", which is what the code enforces. The rung is asserted against
 * that imported table in `affordances`' R19 test (`test/m/affordances/`), so if an
 * edge out of `retired` is ever added this rung fails rather than lying.
 *
 * WHAT SEPARATES THE TOP TWO IS NOT ABSENCE OF CORRECTION but its weight and
 * visibility: an `attested` act cannot be undone SILENTLY (every correction is
 * itself an act with a name and a date on it), and an `irreversible` act's
 * output never stops answering at all. */
export const RUNG_LADDER = ["reversible", "reasoned", "terminal", "attested", "irreversible"];

/* The correction path DEC-19 requires to be stated beside the top rung rather than instead of it, as a KEY (R44): the
 * sentence is `setup-words`' `screen.ceremony.permanent` (publishing makes an edition permanent and public; it is
 * corrected by a new edition, never removed), read through `word(key)`. Published with the ladder so a surface that renders
 * "irreversible" cannot render it without the sentence that makes it honest. */
export const IRREVERSIBLE_CORRECTION_KEY = "screen.ceremony.permanent";

/* THE REFUSAL FAMILY THAT BACKS THE `reasoned` RUNG. Constructs:161 defines the
 * rung as "a justification is required and never prefilled", and these are the
 * codes by which the store REQUIRES one. Read as a CLASS and not as one
 * spelling — REC-76's finding, and this table is where it bites: grading
 * `reasoned` by `NO_REASON` alone would have missed `op=release` (which demands
 * an acknowledgment AND a mitigation) and `op=conclude` (a conclusion AND a
 * falsifier), both of which are the same requirement wearing the word the act
 * uses for it.
 *
 * DELIBERATELY NOT IN THIS FAMILY: `NO_TARGET`, `NO_SUCH_*`, `NO_ID`, `NO_KIND`,
 * `ENTITY_NO_LABEL`, `PROGRESSION_NO_LABEL`, `EXPERTISE_NO_LABEL` (the shared `NO_LABEL`, one code per site since
 * N285), `NO_CITATION`, `NO_BODY`, `NO_TITLE`, `NO_BUNDLE_MD`,
 * `NO_SIBLING_DISCLOSURE`. Those demand an OBJECT, an IDENTIFIER, EVIDENCE or a
 * well-formed document — none of them is the member saying why. A family that
 * swept them in would have graded nearly every op `reasoned` and the rung would
 * have meant nothing.
 * N364 (R1) MAKES ONE EXCEPTION, BY NAME, AND IT IS THE REQUIREMENT'S RATHER THAN A WIDENING HERE: a source's
 * disclosure, a claim that two sources are one person and a member's record of a source's consent are each an account
 * of what the member knows about a PERSON, and their account IS their evidence (sources R2, R6, R7: "evidence is
 * required"). R1 grades them `reasoned` on "a reason, or a question or conclusion, or evidence", so `sources'`
 * `NO_EVIDENCE` (C-121.3) joins the family. `NO_CITATION` and the rest above stay out. */
export const JUSTIFICATION_REFUSALS = [
  "NO_REASON", "VERSION_NO_REASON", "NO_ACKNOWLEDGMENT", "NO_MITIGATION",
  "NO_CONCLUSION", "NO_FALSIFIER", "NO_JUSTIFICATION",
  /* N115 (T7): the same requirement in the words three connections acts use for it — a withdrawal from a theme
     says why (C-81.11), a judgement of an inferred membership says why, and a member's own connection states its
     basis, "why these two documents are connected". Each is the member saying why, never an object or evidence. */
  "THEME_WITHDRAW_NO_REASON", "FILE_MEMBERSHIP_NO_REASON", "CONNECTION_ASSERT_NO_BASIS",
  /* INTENT #1 J4.3 (T7): retiring an aspiration records what pursuing it taught (C-110.17) — the member's account
     of why it ends, which is this family's requirement in intent's word for it. */
  "NO_LESSON",
  /* R3 as ruled by BOB (K211): the three acts it moved to `reasoned`, each refusing without the member's account —
     a bias-debt settlement's reason, a risk-tier revision's reason, and a narrowed reading's account of what changed. */
  "BIAS_DEBT_NO_REASON", "RISK_TIER_REASON_REFUSED", "NARROW_NO_DESCRIPTION",
  /* K219 (T7): a member's recorded re-evaluation carries its note, "what was looked at and what was decided"
     (reevaluation R16); the code refuses it absent as well as malformed, as RISK_TIER_REASON_REFUSED does. */
  "REEVALUATION_NOTE_MALFORMED",
  /* N310 (K368): `op=actionmove` answers its absent reason with its own code (actions R13), the family's requirement
     in actions' word for it. */
  "ACTION_MOVE_NO_REASON",
  /* N345 (K447): contradiction's member acts, each refusing without the member's account in its own word for it —
     a lead's reason for being set aside (one of three, never blank), an explanation of how the sides differ, the
     reason a side is wrong, and the question a taken-up conflict asks. */
  "DISMISSAL_REASON_UNKNOWN", "CLARIFY_NO_EXPLANATION", "WRONG_SIDE_NO_REASON", "TAKE_UP_NO_QUESTION",
  /* K4323 (contradiction R61): the member's own flag of two documents, refused without the reason it is kept for (C-93.42). */
  "FLAG_NO_REASON",
  /* N364 (R1): the source acts' account is their evidence (sources R2, R6, R7), refused absent as C-121.3. */
  "NO_EVIDENCE",
  /* K727 (T18): action-plans' one reason rule (its R4), the member's account in its word for it, at the plan's acts that
     revise what stands. */
  "PLAN_NO_REASON",
  /* K823, K834, K835 (T19): three modules now answer an absent reason in their own word for it, where they answered
     NO_REASON — intent's acts that close, depart from or set a proposal down (intent R30), a determination's
     supersession (conformance's C-113.22) and escalation's reasoned acts (escalation R24). The family's requirement,
     unchanged; `NO_REASON` stays for the acts that still answer it. */
  "INTENT_NO_REASON", "CONFORMANCE_NO_REASON", "ESCALATION_NO_REASON",
  /* K918 (T20): a litigation hold's statement without its reason (actions R52, C-117.21), refused absent as well as
     malformed, as RISK_TIER_REASON_REFUSED is. */
  "HOLD_REFUSED",
  /* R6 (K921, T21): retiring a template, or withdrawing a version, says why (filing-templates R11), and a member's act
     on a local fact says how they checked it (local-facts R1); each refused absent as well as malformed. */
  "TEMPLATE_REASON_REFUSED", "FACT_HOW_REFUSED",
  /* DEC-88 (K1025, K1038): the 30 acts it banded `reasoned`, each owner's refusal of the absent reason in its own word
     for it. Four acts' own authored words are their reason (`affordances` R19): an observation (C-53.3), a typing (C-52.6), a lead
     (C-54.3) and a goal's statement and bounds — and an aspiration's statement — (`PURSUIT_UNSTATED`), each refused
     empty. `NO_BASIS` JOINS AS THE STATED BASIS of a recogniser testimony (entities R12) and of a progression's first
     declaration (progressions R2), the member saying why; where `op=inquiryground` answers it for a question resting on
     nothing it demands an object, and that act's backing is driven on its restructure's reason, never on that code. */
  "TESTIMONY_NO_WORDS", "TRANSCRIBE_NO_TEXT", "LEAD_NO_WORDS", "PURSUIT_UNSTATED",
  "LEAD_LOOK_NO_DETAIL", "LEAD_SHARE_NO_REASON", "ATTEST_NO_NOTE", "ENTITY_NO_NOTE", "NO_BASIS",
  "VERSION_ADOPT_NO_REASON", "NO_NOTE", "BIAS_ADOPTION_NO_REASON", "BAR_NO_REASON", "STANDARD_NO_REASON",
  "PACKET_NO_REASON", "ATTRIBUTION_NO_REASON", "STATEMENT_ACK_NO_REASON", "RESOLVE_NO_REASON",
  /* K1025: `consequencerecord`'s assessed arm refuses its absent rationale as any reason is (consequences R3). */
  "NO_RATIONALE",
  /* K1019, K1023 (T22): a held capture set aside or restored without its reason (capture R79, R81), and an address's
     frequency set without a canned or custom reason (monitoring R52, C-18.15). */
  "SET_ASIDE_NO_REASON", "FREQUENCY_NO_REASON",
  /* R9 (N520; DEC-116): a docket filing's reason for the record/public/both choice (docket R1, C-129.9), a record
     entry's take-back (its R11) and the manager's decline of a submission (its R7), each refused absent as well as
     malformed. */
  "DOCKET_NO_REASON",
  /* R10 (N520, N522; DEC-96 items 1, 2): an imported edition accepted, or its acceptance withdrawn, without what the
     member checked and why (case-import R6, R7), and a flag raised or cleared without the issue or the reason (its R8),
     each refused absent, blank or over its bound. */
  "IMPORT_ACCEPT_NO_REASON", "IMPORT_FLAG_NO_ISSUE",
  /* R11 (DEC-121; N528): retiring a wizard script, or withdrawing a version, says why (wizard-scripts R9, as
     filing-templates R11), refused absent as well as malformed. */
  "WIZARD_REASON_REFUSED",
  /* R13 (T33-85): a member's statement of a duty occurrence's state names its cause (duties R13), a workbook's method
     note states its purpose (workbooks R10), and a member verifying an assistant mode's first live run gives the evidence
     of what they checked (run-rules R19; refused absent as well as malformed). Each the member's own account. */
  "NO_CAUSE", "NO_PURPOSE", "AI_RUN_VERIFICATION_UNFIT",
  /* R15 (K1805, K1807; T34-75): duties and hypotheses now answer an absent reason in their own word for it (duties' re-key,
     N608; hypotheses R2), where they answered NO_REASON; `NO_REASON` stays for the ops that still answer it. */
  "DUTY_NO_REASON", "HYPOTHESIS_NO_REASON",
  /* R17 (tasks R15): a check's `concern` says why, refused absent or blank. */
  "CHECK_NO_REASON",
  /* R23 (K2092): a spot-check visit's testimony, the visitor's own firsthand words (calculations R38), is its reason, as
     `testify`'s words are (`TESTIMONY_NO_WORDS` above): `NOT_TESTIMONY` refuses a visit whose testimony is not the
     visitor's authored observation, so it joins as the member's own account, by name, on R23's ruling — not as an
     object demanded (the deliberate exclusions above stay out). R24 (N707): a scan hold's release says why (file-safety
     R17), refused empty or over 2,000 characters; its own code, apart from `HOLD_REFUSED` (K231, K2103). */
  "NOT_TESTIMONY", "HOLD_NO_REASON",
  /* R25 (T37; N755's follow-on; K2175): `credentials` R51 answers `aikeepaway`'s `on: true` without a reason in its own
     word for it (C-29.32), where it answered NO_REASON; `NO_REASON` stays for the ops that still answer it. */
  "AI_KEEP_AWAY_NO_REASON",
  /* R28 (T38; N788; DEC-183 (2)): a mark on a photo is withdrawn with the member's reason (case-carriage R14, C-141.10),
     refused absent, blank or over 2,000 characters. */
  "WITHDRAW_NO_REASON",
  /* R30 (T41; K2569): T41's owners' reasoned acts, each refusing without the member's account in its own word for it —
     a milestone or one of its items removed (investigation R1), a project closed with its gaps (its R18, an enumerated
     reason), a proposed hypothesis set aside (hypotheses R18), a reading guide reviewed or retired (reading-guides R3,
     R7) and a proposed step set aside for the member's own (steps R24, `triage`'s shape). A project's keep-away
     answers `AI_KEEP_AWAY_NO_REASON`, already above. */
  "INVESTIGATION_NO_REASON", "CLOSE_BAD_REASON", "PROPOSAL_NO_REASON", "GUIDE_REASON_MISSING", "STEP_BAD_TEXT",
  /* R32 (T45; N893): T45's owners' reasoned acts, each refusing without the member's account in its own word for it —
     an action's confidential scope set or removed (actions R87), a harm-addressed statement and a success record's
     revision (consequences R9, R21; K2857: `addressedrecord` answers ADDRESSED_NO_REASON where it answered NO_REASON),
     and a group rule drafted or withdrawn (local-facts R10, R13). A plan's set-aside, restoration, pause and resume answer
     PLAN_NO_REASON, a project's scope and approval setting NO_REASON, and a cure's unlinking CONFORMANCE_NO_REASON, all
     above. R32 also names the reasons asked inside existing acts, whose rungs do not change: a contradicted sentence
     released at approval (filings R34), another outward step taken before the infraction is documented (action-plans
     R42) and a premise override's ground (actions R74). */
  "SCOPE_NO_REASON", "ADDRESSED_NO_REASON", "SUCCESS_NO_REASON", "RULE_NO_REASON",
  "CONTRADICTED_HELD", "DOCUMENT_FIRST_NO_REASON", "OVERRIDE_NO_GROUND",
  /* R36 (T47; N976): a project's own bar is set with the member's reason (strength R40, C-107.4), refused absent. */
  "PROJECT_BAR_NO_REASON",
  /* R40, R41 (T48; N1047, N1030): an update skipped says why (instance-setup R90, a skip recorded with who, when and why and
     never erased), and a member's cited backing of a declared step states its basis, the member's words on what the passage
     states (connections R68, as CONNECTION_ASSERT_NO_BASIS). `updatelater` and `updatestart` ask no reason. */
  "UPDATE_SKIP_NO_REASON", "STEP_SOURCE_NO_BASIS",
];

/* THE GROUNDS ON WHICH A MUTATING OP HAS NO RUNG. Written ONCE here and pointed
 * at by every op in RUNG_ABSENT, because sixty hand-written near-duplicate
 * sentences are sixty sentences that will drift apart.
 *
 * FOUR OF THESE FIVE ARE ABSENCES OF APPLICABILITY and one is a real
 * undetermined — and the distinction is the most useful thing this item
 * measured. The rung ladder is a property of AN ACT ON THE RECORD: it tells a
 * member what performing it costs to undo. Most mutating ops are not acts on the
 * record at all — they are the machinery, the credential layer, the caller's own
 * scratch state, or an observation — and for those the honest answer is not "no
 * rung yet" but "the ladder does not reach here". `undetermined` is the bucket
 * that DOES mean "no rung yet", and keeping it apart from the other four is what
 * stops a real gap from hiding inside a category error.
 *
 * DEC-149 (T34-87, K1849 (7)): served to every surface as `vocabularies.rung_absence_grounds`, so these sentences take
 * the member voice: none names the group's Civicsmith as "the plane", "this instance" or "this copy" ("server-side"
 * below says where a selection is kept, and stays). */
export const RUNG_ABSENCE_GROUNDS = {
  substrate:
    "the machinery a decided act rides on, not a decision. A member never chooses op=promote; they "
    + "choose to conclude, or to retire, and the write path is how that lands. A rung is a promise "
    + "about undoing something a member CHOSE, so there is nothing here to promise.",
  credential:
    "the subject is WHO MAY ACT, not what the record says. Adding a member, minting a machine "
    + "credential or moving a project's roster changes who can write; it writes nothing the record "
    + "asserts. The ladder grades acts on the record, and these are one layer beneath it.",
  "caller-owned":
    "the subject is the caller's own server-side or personal state — a selection is a lease the "
    + "credential that made it owns, a mute is one member's preference about their own feed. None of "
    + "it is in the record, so undoing it costs the record nothing and claims nothing to anybody.",
  observational:
    "the act records WHAT WAS OBSERVED, not what anybody decided. There is nothing to reverse: an "
    + "observation is corrected by observing again, and the earlier observation stays true of the "
    + "moment it was made.",
  undetermined:
    "THIS IS A REAL ACT ON THE RECORD AND IT HAS NO RUNG. No document assigns one and no refusal "
    + "establishes one, so the honest answer is that it is UNDETERMINED — stated, never "
    + "guessed (CLAUDE.md: undetermined is first-class and must be STATED). Do not read this as "
    + "'light'. Several of these are weighty, and the reason they are undetermined is that the "
    + "ladder as it stands has no rung for an act that is CORRECTED FORWARD but is not signed.",
};

/* R4 (DEC-88 (4); K1038): THE SIX JUDGEMENT CALLS' CONSEQUENCE STATEMENTS. DEC-88 names six acts whose weight is not
 * the rung's — a name made permanent, a disclosure that cannot be un-read, a person named in the registry, a gate on the
 * whole group, an approval that stands, an assistant set to work — and rules that each carries high friction with its
 * rung name unchanged (R3: a heavy consequence is not a new rung). Five open the full dialog stating the effect;
 * `workobjective` is the lightest, its reason field opening in place with the run's budget and scope beside it.
 * Published as `VOCABULARIES.rung_consequences`, the same object, beside the ladder: no key is added to the decorated act
 * (`affordances` R11), so a surface reads an act's entry by its id.
 * (R44, T49) AN ENTRY HOLDS A KEY, NEVER A SENTENCE: `{friction, key}`, the surface reading the sentence through
 * `setup-words` `word(key, vars)` (`consequence.<op>` for the eight DEC-258 minted; `screen.person.expunge.statement`, whose
 * `{date}` and `{member}` the surface fills, and `screen.open-file.warn.ends`, the design's own). Each sentence says only
 * what the owning module enforces; their look is the redesign's. */
const ENTRY = (friction, key) => Object.freeze({ friction, key });
export const CONSEQUENCE_STATEMENTS = Object.freeze({
  attribute:    ENTRY("dialog", "consequence.attribute"),
  leadshare:    ENTRY("dialog", "consequence.leadshare"),
  entitycreate: ENTRY("dialog", "consequence.entitycreate"),
  strengthbar:  ENTRY("dialog", "consequence.strengthbar"),
  filingapprove: ENTRY("dialog", "consequence.filingapprove"),
  workobjective: ENTRY("in-place", "consequence.workobjective"),
  /* R8 (DEC-113; K1134 (3), K1252): releasing a litigation hold restarts what the hold stopped, for the projects
     `action-holds` R6 (was `actions` R57) answers (`op=actionholdpreview`), which the surface reads and shows beside the
     statement. DEC-113's sentence, with K1252's purge: while a hold stands no held material is purged (action-holds R9). */
  actionholdrelease: ENTRY("dialog", "consequence.actionholdrelease"),
  /* R21 (N623, DEC-142): `personexpunge`'s and (K2049) `standardrelease`'s, written in ./t35.mjs beside its grades. */
  ...T35_CONSEQUENCE_STATEMENTS,
  /* R24 (DEC-173 (2)): `openwithwarning`'s, written in ./t36.mjs beside its ground. */
  ...T36_CONSEQUENCE_STATEMENTS,
});

/* R18 (DEC-122 (1); K1363 B5): THE ACTS KEPT FOR A LARGER SCREEN BEYOND WHAT THE LADDER AND THE IRREVERSIBLE WEIGHT
 * ALREADY SAY. Every decorated act carries an advisory `phone` flag (`phoneOf` below): false at the heavy rungs, for a
 * credential act and (DEC-181) for every op in `IRREVERSIBLE_WEIGHT`, and false for the acts named here, whose rung alone
 * would leave them on the phone — `filingsent`, DEC-122's "sending", is `reasoned`. (R26, T37: `personexpunge` left this
 * set; it answers `false` through `IRREVERSIBLE_WEIGHT`, so no op is in both.)
 * Advisory only: nothing refuses by device and the plane cannot know one. Published as
 * `VOCABULARIES.larger_screen_acts`, the same frozen array, so a change of the phone set is a change here only. */
export const LARGER_SCREEN_ACTS = Object.freeze([
  "filingsent",
]);


/* THE ASSIGNMENT. Every entry carries the source or the enforcement that BACKS
 * it, and every backing is driven by `affordances`' R19 tests (`test/m/affordances/`,
 * each act called without its account at its own module's interface) — a rung with
 * no backing is a promise to a member that nothing keeps. */
const RUNGS_DATA = {
  /* ---- irreversible. (R14; DEC-147) The two that set when a signed case edition goes public: the set time is weighed
     as publishing itself, and moving it sets again. (R37, T47) `op=publish` no longer stands here: it prepares (below). */
  publishat:          "irreversible",   // ratification R40 · signs now; publishes at the set time if every check passes again
  publishatmove:      "irreversible",   // publication R68 · sets again when the signed edition goes public

  /* ---- attested: signed or countersigned, and correctable only by a further
     act that is itself signed. Constructs:275. Both require an authority the
     group does not hold alone — a registered signer's key, a timestamp
     authority's token — which is what `attested` means and what makes these two
     unlike everything below. */
  attest:             "attested",   // Constructs:275 (a CAPTURE act — `affordances`' CAPTURE_ACTS)
  ratify:             "attested",   // Constructs:275 (its pre-flight is case-authoring's op=publishpreflight, R34)
  /* CASE-5b / DEC-72: signing the CASE DOCUMENT is `attested` for `ratify`'s own
     reason and not a new one — its authority is a registered signer's key over
     the document's hash, which is a thing the group does not hold by having
     decided something. Same rung, same ladder, a different subject. */
  caseratify:         "attested",
  /* N364 (DEC-81 item 3): the two late acts on a capture whose co-attestation failed, each `attested` for `attest`'s own
     reason — an authority the group does not hold alone. `reattest` asks a timestamp authority for a fresh token over
     the digest (capture R68, through attestation's `attest`, N512; it proves the bytes existed by now, not at capture), and
     `captureaccount` is refused unless a registered signer's key of the capturing member verifies the account
     (capture R69: `SIG_<reason>` otherwise). Neither is undone: each appends. */
  reattest:           "attested",   // capture R68 · a timestamp authority's token (attestation.attest)
  captureaccount:     "attested",   // capture R69 · SIG_* unless the capturing member's attesting key verifies it
  /* R7 (DEC-111, K1100): a working-on notice is published only by an owner's own signature over its revision
     (network-notices R4, R24), `caseratify`'s reason — a key the group does not hold by having decided something. A
     change or a stop is a new revision (its R6, R11), and nothing published is altered (its R26). */
  noticepost:         "attested",   // network-notices R4, R24 · an owner's own signature publishes the revision
  /* R9 (DEC-116, N520): a docket entry is published only by the manager's own signature over its statement (docket R5,
     R18), `noticepost`'s and `caseratify`'s reason; an entry is taken back only by a later entry (its R11), and nothing
     published is altered (its R16). The draft's "signed" is this rung: the ladder has no rung of that name (R3). */
  docketpost:         "attested",   // docket R5, R18 · the manager's own signature publishes the entry

  /* ---- terminal: the target state has no outgoing edge. See the ladder note.
     `op=retire` ALSO raises NO_REASON, so it is `reasoned` at minimum; it is
     declared at the higher rung because the state it writes cannot be left. */
  retire:             "terminal",   // Constructs:244 · STATES.information.edges.retired === []
  /* R8 (DEC-113; K1134 (3)): A NAMED EXCEPTION TO R3, which would grade it `reasoned` (a further statement corrects it
     forward, and HOLD_REFUSED asks its reason). DEC-113 rules releasing heavier than reasoned: what it restarts — the
     purge of held material and the deletion of assistant transcripts on members' devices — cannot be undone, and a
     release ends a hold in place at most once (action-holds R5, was actions R56; HOLD_ALREADY_RELEASED). Placing stays light: `actionhold` is
     `reasoned` (K918), and it refuses `released` (HOLD_RELEASE_IS_ITS_OWN_ACT), so the heavier act has its own op. */
  actionholdrelease:  "terminal",   // action-holds R5 (was actions R56) · DEC-113: what it restarts cannot be undone; HOLD_REFUSED asks its reason
  /* R37 (T47; K3100, doubt 9 as ruled; DEC-208 (2)): `op=publish` now only PREPARES. It stores the case edition unsigned
     with the publishing member's tie confirmation recorded in it (case-authoring R14, R34, R76); `caseratify` (or
     `publishat`) signs and publishes. A named exception beside `actionholdrelease`: the confirmation, once recorded in
     the edition she signs, is not walked back, so the act opens the dialog stating what it does, and it leaves the
     Irreversible weight (R21), which is publishing's. Its machine refusal stays (MACHINE_CANNOT_PUBLISH). */
  publish:            "terminal",   // case-authoring R34, R76 · prepares for signing; caseratify signs (K3100 doubt 9)

  /* ---- reasoned: the store refuses the act for want of an authored account.
     The four with a Constructs line keep it; the rest are DERIVED FROM THE
     REFUSAL, which is FW-14's instruction ("derive rungs from what the code
     already enforces") and not an invention — the refusal IS the requirement
     Constructs:161 names. */
  dispose:            "reasoned",   // Constructs:242 · NO_REASON
  release:            "reasoned",   // Constructs:241 · NO_ACKNOWLEDGMENT + NO_MITIGATION
  /* R36 (T47; citation R15): on a project its `cites` edges, and on a question its own legs (the `references[]` entry
     naming a leg's target), each moved with the member's reason and nothing deleted. ACTS rows, so no NON_ACTS row. */
  sever:              "reasoned",   // Constructs:243 · NO_REASON (citation R4, R15: a project's cites or a question's own legs)
  reinstate:          "reasoned",   // Constructs:243 · NO_REASON (citation R4, R15: a project's cites or a question's own legs)
  conclude:           "reasoned",   // NO_CONCLUSION + NO_FALSIFIER
  withdrawconclusion: "reasoned",   // NO_REASON (REC-136: a withdrawal says why)
  reopen:             "reasoned",   // NO_REASON
  inquirydivide:      "reasoned",   // NO_REASON (one authored reason per division, DEC-29)
  inquiryground:      "reasoned",   // NO_REASON
  actionmove:         "reasoned",   // ACTION_MOVE_NO_REASON (actions R13; N310)
  discharge:          "reasoned",   // NO_REASON (a lawful skip says why it was lawful)
  proposedispose:     "reasoned",   // NO_REASON (D-79: a finding AGES with a recorded reason)
  relationdeclare:    "reasoned",   // NO_JUSTIFICATION (D-83: relations carry one, NOT NULL)
  projectownerremove: "reasoned",   // NO_REASON
  projectownerrescue: "reasoned",   // NO_REASON
  adminremove:        "reasoned",   // NO_REASON
  /* N115 (T7), graded on R3's rule: each is corrected forward by a further act of its kind and refuses without an
     authored reason, so each is `reasoned`. */
  aliaswithdraw:      "reasoned",   // NO_REASON (entities R8: a withdrawal says why the name was wrong)
  relationwithdraw:   "reasoned",   // NO_REASON (entities R8)
  themewithdraw:      "reasoned",   // THEME_WITHDRAW_NO_REASON (C-81.11)
  filemembershipjudge: "reasoned",  // FILE_MEMBERSHIP_NO_REASON (connections R57)
  connectionassert:   "reasoned",   // CONNECTION_ASSERT_NO_BASIS (connections R31: the member's stated basis)
  /* INTENT #1 J4.3 (T7), on R3's rule: each refuses without the member's authored account. */
  goalclose:          "reasoned",   // INTENT_NO_REASON (C-110.13: a goal is closed with the reason it closed; intent R30)
  aspirationdepart:   "reasoned",   // INTENT_NO_REASON (a departure from the group's aspiration records why; intent R30)
  aspirationretire:   "reasoned",   // NO_LESSON (C-110.17: what pursuing it taught)
  /* R3, ruled by BOB (K211): acts corrected forward that refuse without the member's account. */
  biasdebtresolve:    "reasoned",   // BIAS_DEBT_NO_REASON (REC-207: an authored settlement, append-only)
  actionrisktier:     "reasoned",   // RISK_TIER_REASON_REFUSED (REC-214: a revision carries its reason)
  narrow:             "reasoned",   // NARROW_NO_DESCRIPTION (C-50.11: what changed and why)
  /* K219 (T7). `triage` asks its reason where the act sets a proposal down (defer, dismiss), which is `affordances` R19's "where
     the act revises what stands" (K212), `inquiryground`'s shape; adopting or opening a question asks none. */
  triage:             "reasoned",   // INTENT_NO_REASON (intent R16, R30: a proposal is deferred or dismissed with a reason)
  reevaluationrecord: "reasoned",   // REEVALUATION_NOTE_MALFORMED (reevaluation R16: the note is the account)
  /* Layer 9's acts that refuse without the member's authored reason, on R3's rule (K208 (2), K264; with N216). */
  consequencerevise:  "reasoned",   // NO_REASON (consequences R6: a part is revised with its reason)
  addressedrecord:    "reasoned",   // ADDRESSED_NO_REASON (consequences R9: addressed or not, with a reason; K2857)
  escalationevaluate: "reasoned",   // ESCALATION_NO_REASON (escalation R10, R24: a response is read with a reason)
  escalationadvance:  "reasoned",   // ESCALATION_NO_REASON (escalation R13, R24: an edge is taken with a reason)
  escalationdecline:  "reasoned",   // ESCALATION_NO_REASON (escalation R13, R24: a proposed stage is declined with a reason)
  escalationsuspend:  "reasoned",   // ESCALATION_NO_REASON (escalation R15, R24; escalationresume takes it back, and the higher rung is stated)
  /* N310 (with conformance's N233): superseding a determination asks its reason and refuses an absent one
     CONFORMANCE_NO_REASON (conformance R7, C-113.22; K834); a first determination replaces nothing and asks none,
     `inquiryground`'s shape (K212). */
  determine:          "reasoned",   // CONFORMANCE_NO_REASON (conformance R7: a supersession says why)
  /* N345 (K447), on R3's rule: each member act on a contradiction asks the member's account — a reason, an
     explanation, a question or a conclusion — and is corrected forward by a further act, never by one moving back. */
  contradictiondismiss: "reasoned", // DISMISSAL_REASON_UNKNOWN (contradiction R31: a lead is set aside for a stated reason)
  contradictionclarify: "reasoned", // CLARIFY_NO_EXPLANATION, WRONG_SIDE_NO_REASON (contradiction R32, R33)
  contradictiontakeup:  "reasoned", // TAKE_UP_NO_QUESTION (contradiction R35: the member's own question)
  /* K4323 (fix round 2; DEC-394 (3e); contradiction R61): a member's own flag of two documents as contradicting says why, refused
     FLAG_NO_REASON (C-93.42); the candidate it records is settled as any (R31–R36) and nothing it writes is erased. */
  contradictionflag:    "reasoned", // FLAG_NO_REASON (contradiction R61: the member's reason for the flag)
  contradictionresolve: "reasoned", // NO_CONCLUSION (contradiction R36, through basis-versions' conclude)
  resolutiondefect:     "reasoned", // NO_REASON (entities R38: a defect is reported with why)
  /* N364 (R1), on R3's rule: a member's act on a source's history, each asking its evidence (R1's "or evidence",
     JUSTIFICATION_REFUSALS above) and corrected forward — a later disclosure supersedes on read, a consent is
     withdrawn by a further act, and nothing is erased (sources R2, R6, R7). */
  sourcedisclose:        "reasoned", // NO_EVIDENCE (sources R2: a disclosure names its evidence)
  sourcelink:            "reasoned", // NO_EVIDENCE (sources R6: a claim that two sources are one person, with evidence)
  sourceconsent:         "reasoned", // NO_EVIDENCE (sources R7: a member's evidenced record of the source's consent)
  /* K727 (T18), on R3's rule: action-plans' acts that refuse without the member's reason (its R4), each corrected
     forward and kept in the plan's history. `optiondispose` asks it where the act sets an option down (declined,
     blocked), `triage`'s shape (K212). */
  plansubjectadd:        "reasoned", // PLAN_NO_REASON (action-plans R4)
  plansubjectremove:     "reasoned", // PLAN_NO_REASON (action-plans R4)
  optionrevise:          "reasoned", // PLAN_NO_REASON (action-plans R9: a revision with its reason)
  optiondispose:         "reasoned", // PLAN_NO_REASON (action-plans R13: declined and blocked need a reason)
  planclose:             "reasoned", // PLAN_NO_REASON (action-plans R20: a member closes a plan with a reason)
  /* K918 (T20), on R3's rule: a litigation hold is stated with its reason and corrected forward by a further
     statement, the earlier kept (actions R52). */
  actionhold:            "reasoned", // HOLD_REFUSED (action-holds R2, was actions R52: a hold stated without its reason)
  /* R6 (K921, T21), on R3's rule: a template's retirement (or a draft's withdrawal) asks its reason and stands, and an
     approver's later act supersedes nothing; a member's confirmation, correction or dispute of a local fact asks how
     they checked it, and a later act supersedes it on read, as `actionrisktier`'s revision does. */
  templateretire:        "reasoned", // TEMPLATE_REASON_REFUSED (filing-templates R11)
  factconfirm:           "reasoned", // FACT_HOW_REFUSED (local-facts R1)
  /* The version pair whose target state is in VERSION_REASON_REQUIRED. The
     OTHER FOUR version acts route through the SAME `#moveVersionState` and the
     SAME `VERSION_NO_REASON` refusal, and the branch DOES NOT FIRE for them —
     `versionNeedsReason(to)` gates it, and `basis-versions`' `VERSION_ACT_TO` maps accept →
     accepted, revert → suggested, current → null, hide → null, none of which is
     in the array. A classifier that graded these six by finding the code in the
     shared helper would have promoted four ops to a rung the store does not
     enforce; `affordances` R19's drive therefore performs the acts, never reading the text. */
  versionreject:      "reasoned",   // VERSION_REASON_REQUIRED includes 'rejected'
  versionconsider:    "reasoned",   // VERSION_REASON_REQUIRED includes 'considering'

  /* ---- reversible: the plane PUBLISHES AN ACT THAT TAKES THE RESULT BACK.
     This is the only evidence accepted for this rung, and the reason is
     CLAUDE.md's: an outcome that costs nothing to produce is not evidence, and
     "I found no obstacle" is exactly that. `reversible` is a promise to a
     member, so it is assigned only where another act discharges it.

     `cite` IS C-7's ANSWER AND THE ROW'S CLAIM ABOUT IT HOLDS. The FW-14 row
     says this derivation method already yields C-7's answer; it was CHECKED
     rather than assumed. `cite` writes `{ rel: "cites", status: "confirmed" }`
     and `sever`'s `from` set is `["confirmed", "proposed"]` — so the act that
     takes a citation back accepts exactly what citing wrote. UI-20 recorded
     "C-7 derives reversible" and rendered the rung as ABSENT because FW-14 had
     not assigned it; it is assigned here, and the derivation agrees.
     Note what `reversible` does NOT claim: severing is not erasure — the edge
     stays in the record carrying `status: "severed"` and the member's reason.
     The act is undone; the fact that it happened is not. */
  cite:               "reversible",  // sever accepts the status cite writes
  versionrevert:      "reversible",  // VERSION_MACHINE.edges.suggested reaches every state revert runs from
  versionhide:        "reversible",  // its own inverse: `hidden=false` un-hides (D-214: prune HIDES, never deletes)
  /* R3, ruled by BOB (K211): each is corrected forward, and a PUBLISHED act takes its result back. The rows above
     that graded them `undetermined` said "no way back exists"; the ruling reads a published act that moves the
     result on (reconsidering or turning down an accepted reading; standing on another reading; restating the laws;
     setting the visibility again) as that way back. */
  versionaccept:        "reversible",  // versionconsider and versionreject move an accepted reading away
  versioncurrent:       "reversible",  // a further versioncurrent stands the project on another reading
  actionlaws:           "reversible",  // a further actionlaws restates the list
  projectvisibilityset: "reversible",  // the owner sets it again
  /* T8 layer 11: resuming asks no reason (escalation R15: an optional one is kept), and a further suspension takes it
     back. */
  escalationresume:     "reversible",  // escalationsuspend takes it back
  /* N364 (K558), on R3's rule: a withdrawal of consent asks no reason — it is never made to justify itself — and a
     published act takes it back: a further `sourceconsent` raises the standing it lowered (sources R7). */
  sourceconsentwithdraw: "reversible", // sourceconsent takes it back
  /* K727 (T18), on R3's rule (`actionlaws`' precedent): a scenario is replaced whole by a further scenarioset, the
     earlier version kept in history, and no reason is asked (action-plans R14). */
  scenarioset:           "reversible", // a further scenarioset replaces it
  /* R35 (T47; N987; K3014): pulling a knock asks no reason, and the document it files waits held at `collected`, where a
     published act (`heldsetaside`, capture R79) takes it out of what the group relies on; the knock stays pulled
     (doorbell R13). It left RUNG_ABSENT's `undetermined` in T47. */
  inboxpull:             "reversible", // heldsetaside sets the filed document aside (capture R79)

  /* ---- DEC-88 (K1038, J1): THE 57 THAT WERE `undetermined`, BANDED BY BOB. The ladder's gap RUNG_ABSENT's
     `undetermined` ground names (an act corrected forward but not signed) is closed by ruling, not by a new rung (R3):
     each of these 57 is one of three bands, and RUNG_ABSENT keeps only the 21 the ruling left (R3). What DEC-88 banded
     `reasoned` asks the member's authored reason, refused by the owning module in its own word for it (`affordances` R19, each code
     in JUSTIFICATION_REFUSALS); four take their own words as the reason (`testify`, `transcribe`, `lead`,
     `goaldeclare`), and four their recorded grounds (K1025: `resolve`, `actioncorrespond`, `filingsent`,
     `consequencerecord`), as `affordances` R19 words them. Six are judgement calls that carry a consequence statement beside the
     rung (R4, CONSEQUENCE_STATEMENTS below). */
  /* reversible (DEC-88): a proposal, a draft, a member's own placement or link, or a run's opening and closing, each
     superseded by a further act of its kind or set down by the member's own act. */
  suggest:               "reversible", // DEC-88 · a run's proposed reading; the six version acts settle it
  extractpropose:        "reversible", // DEC-88 · a run's proposed reading of held text; never a finding until cited
  contradictionpropose:  "reversible", // DEC-88 · a run's proposed relation; a member's judgement settles it
  themepropose:          "reversible", // DEC-88 · a hunch in a theme; a member confirms or rejects it (themewithdraw)
  standardpropose:       "reversible", // DEC-88 · a proposed standard; never a standard until adopted
  comparisonpropose:     "reversible", // DEC-88 · a proposed comparison; never a determination
  theorypropose:         "reversible", // DEC-88 · a candidate theory; never the group's position
  actionriskpropose:     "reversible", // DEC-88 · a proposed risk tier, restated by the same proposer
  actionlawspropose:     "reversible", // DEC-88 · proposed governing laws, restated by the same proposer
  filingprepare:         "reversible", // DEC-88 · a filing draft; never sent until approved
  contentmint:           "reversible", // DEC-88 · a citable address, marked stale and re-marked, never deleted
  casedraft:             "reversible", // DEC-88 · a review copy, edited in place and never published
  reviewcomment:         "reversible", // DEC-88 · a comment on a draft, answered by another
  taskforward:           "reversible", // DEC-88 · a task moved to another member, who may forward it again
  taskresolve:           "reversible", // DEC-88 · how a task ended
  thread:                "reversible", // DEC-88 · documents threaded into a progression instance
  connectionchoose:      "reversible", // DEC-88 · a choice of mention, superseded by a re-choice
  themedeclare:          "reversible", // DEC-88 · a member's theme, a lens and never evidence
  themeplace:            "reversible", // DEC-88 · a placement in a theme; themewithdraw takes it back
  entityalias:           "reversible", // DEC-88 · an alias; aliaswithdraw takes it back
  goallink:              "reversible", // DEC-88 · a claim that an objective serves a goal
  versionkeep:           "reversible", // DEC-88 · a reference kept on the earlier capture; versionadopt moves it on
  airunopen:             "reversible", // DEC-88 · opens a run; airunclose ends it
  airunclose:            "reversible", // DEC-88 · ends a run
  projectfork:           "reversible", // DEC-88 · a new project; the source is unchanged
  /* reasoned (DEC-88), each with the code its owning module refuses the absent reason with (`affordances` R19). */
  testify:               "reasoned",   // TESTIMONY_NO_WORDS (provenance R28, C-53.3) · the observation's own words are its reason
  transcribe:            "reasoned",   // TRANSCRIBE_NO_TEXT (content R23, C-52.6) · the typed text is the member's claim
  lead:                  "reasoned",   // LEAD_NO_WORDS (observation-log R14, C-54.3) · the lead's own words are its reason
  goaldeclare:           "reasoned",   // PURSUIT_UNSTATED (intent R8) · the goal's statement and bounds are its reason
  leadlook:              "reasoned",   // LEAD_LOOK_NO_DETAIL (observation-log R17, C-54.11) · where they looked and what they found
  leadshare:             "reasoned",   // LEAD_SHARE_NO_REASON (observation-log R16, C-54.12) · why this project is told (R4)
  transcriptionattest:   "reasoned",   // ATTEST_NO_NOTE (content R25, C-52.10) · what the attestor compared
  attesttext:            "reasoned",   // ATTEST_NO_NOTE (content R43, C-52.10) · what the attestor compared
  resolve:               "reasoned",   // K1025 · its grounds: each resolution records its `basis` and `method` (entities R9–R11)
  resolvetestify:        "reasoned",   // NO_BASIS (entities R12) · the testifier's stated basis
  entitycreate:          "reasoned",   // ENTITY_NO_NOTE (entities R1, C-91.8) · who or what this is and why (R4)
  versionadopt:          "reasoned",   // VERSION_ADOPT_NO_REASON (reevaluation R15) · why the newer version is adopted
  progressiondefine:     "reasoned",   // NO_BASIS (progressions R2) · a first declaration's basis statement
  aspirationdeclare:     "reasoned",   // PURSUIT_UNSTATED (intent R9) · the aspiration's statement
  aspirationdeadend:     "reasoned",   // NO_NOTE (intent R11, C-111.27) · what was tried and why it went nowhere
  objectivecondition:    "reasoned",   // INTENT_NO_REASON (intent R2, R30) · why progress is measured this way
  biasadopt:             "reasoned",   // BIAS_ADOPTION_NO_REASON (bias R11, C-26.21) · why this lens is adopted
  strengthbar:           "reasoned",   // BAR_NO_REASON (strength R15, C-107.3) · why the group sets this bar (R4)
  standarddeclare:       "reasoned",   // STANDARD_NO_REASON (standards R1) · why the group holds its government to it
  standardadopt:         "reasoned",   // STANDARD_NO_REASON (standards R10, through R1)
  consequencerecord:     "reasoned",   // K1025 · its grounds: operands, a rationale (NO_RATIONALE) or why (consequences R2–R4)
  actioncorrespond:      "reasoned",   // K1025 · its grounds: the bytes or the member's account (actions R15–R16)
  filingsent:            "reasoned",   // K1025 · its grounds: actioncorrespond's (filings R7)
  escalationopen:        "reasoned",   // ESCALATION_NO_REASON (escalation R1, R24)
  escalationattach:      "reasoned",   // ESCALATION_NO_REASON (escalation R9, R24)
  counselpacket:         "reasoned",   // PACKET_NO_REASON (filings R8)
  attribute:             "reasoned",   // ATTRIBUTION_NO_REASON (publication R17, C-92.13) · why this level (R4)
  statementack:          "reasoned",   // STATEMENT_ACK_NO_REASON (case-authoring R19)
  workobjective:         "reasoned",   // INTENT_NO_REASON (intent R18, R30) · why the run is opened (R4)
  /* `inboxresolve`: DEC-88 banded it reversible while it only set a status; reasoned since DEC-78's pull is built
     (`doorbell` R13, was capture R65) and `doorbell` R3 (was capture R32) requires the member's reason on every arm. */
  inboxresolve:          "reasoned",   // RESOLVE_NO_REASON (doorbell R3)
  /* terminal (DEC-88): the act cannot be walked back — an ended escalation is never reopened, and a filing is
     approved at most once. */
  escalationend:         "terminal",   // escalation R14 · never reopened
  filingapprove:         "terminal",   // filings R6 · ALREADY_APPROVED: approved at most once (R4)

  /* ---- T22's new reasoned acts (K1019, K1023; R1): each asks the member's reason, refused in its owner's word for it,
     and is corrected forward — a later opening supersedes a decline, a set-aside is restored by a reasoned act and
     restored ones may be set aside again, and a later frequency replaces the earlier. */
  declinetoescalate:     "reasoned",   // ESCALATION_NO_REASON (escalation R27, R24; DEC-89)
  heldsetaside:          "reasoned",   // SET_ASIDE_NO_REASON (capture R79; DEC-97 (2))
  heldrestore:           "reasoned",   // SET_ASIDE_NO_REASON (capture R81, as R79)
  addressfrequencyset:   "reasoned",   // FREQUENCY_NO_REASON (monitoring R52, C-18.15): a canned or custom reason

  /* ---- R9 (DEC-116, N520): the docket's two reasoned acts, each corrected forward — a filing is taken back by a later
     record act with a reason (docket R11) and a declined submission may be filed again; neither is ever deleted. */
  docketfile:            "reasoned",   // DOCKET_NO_REASON (docket R1, C-129.9): why record, public or both
  docketdecline:         "reasoned",   // DOCKET_NO_REASON (docket R7): why the submission is declined

  /* ---- R10 (DEC-96 items 1, 2; N520, N522): DEC-96's four "reasoned acts" on an imported case, each corrected forward
     and never erased — an acceptance stands in the history after its withdrawal, and a flag after its clear
     (case-import R7, R8, R12). */
  importaccept:          "reasoned",   // IMPORT_ACCEPT_NO_REASON (case-import R6): what was checked, and why
  importacceptwithdraw:  "reasoned",   // IMPORT_ACCEPT_NO_REASON (case-import R7): why the acceptance is withdrawn
  importflag:            "reasoned",   // IMPORT_FLAG_NO_ISSUE (case-import R8): the specific issue
  importflagclear:       "reasoned",   // IMPORT_FLAG_NO_ISSUE (case-import R8): why the flag is cleared

  /* ---- R11 (DEC-121; N528): a wizard script's retirement (or a draft's withdrawal) asks its reason and stands, as
     `templateretire` (R6). */
  wizardretire:          "reasoned",   // WIZARD_REASON_REFUSED (wizard-scripts R9)

  /* ---- R12 (DEC-101 (3); N534): watching an imported case's docket and ending the watch, on R3's rule — neither asks a
     reason, and each takes the other back (case-import R17: an end leaves no watch in force; a new watch puts one back). */
  importwatch:           "reversible", // importunwatch takes it back
  importunwatch:         "reversible", // importwatch takes it back

  /* ---- R14 (DEC-147): cancelling a set time publishes nothing, and the edition returns to an unsigned preparation
     (publication R68); a new signing, published now (`caseratify`) or at a time (`publishat`), takes it back. */
  publishatcancel:       "reversible", // caseratify or publishat signs it again

  /* ---- R13 (T33-85): T33's ops, graded in ./t33.mjs, T34's in ./t34.mjs, T35's in ./t35.mjs, T36's in
     ./t36.mjs, T37's in ./t37.mjs, T38's in ./t38.mjs, T41's (R29, R30) in ./t41.mjs, T45's (R32) in ./t45.mjs and
     T46's (R33) in ./t46.mjs and T47's (R36, R37) in ./t47.mjs. */
  ...T33_RUNGS,
  ...T34_RUNGS,
  ...T35_RUNGS,
  ...T36_RUNGS,
  ...T37_RUNGS,
  ...T38_RUNGS,
  ...T41_RUNGS,
  ...T45_RUNGS,
  ...T46_RUNGS,
  ...T47_RUNGS,
  ...T48_RUNGS,
  ...T50_RUNGS,
  ...T51_RUNGS,
};


/* EVERY MUTATING OP THAT CARRIES NO RUNG, WITH THE GROUND. Checked against the
 * control plane's table in both directions by `unaccounted` (`affordances` R12): an op that is
 * neither here nor in RUNGS is answered `unranked` BY NAME, and a name here that the
 * table does not carry as mutating is answered `stale`. Adding a mutating op to the
 * control plane's table and neither classifying nor stating it is what this table
 * exists to make impossible.
 *
 * The one-liners say what this op is; the WHY is on the ground above. */
const RUNG_ABSENT_DATA = {
  /* ---- substrate: how a chosen act lands, or how the store maintains itself. */
  promote:              { ground: "substrate", is: "the one write path every act rides" },
  allocid:              { ground: "substrate", is: "id allocation" },
  lease:                { ground: "substrate", is: "the courtesy lock around promote" },
  capture:              { ground: "substrate", is: "byte movement, content-addressed" },
  acquire:              { ground: "substrate", is: "the fetch layer (M2')" },
  linkproject:          { ground: "substrate", is: "admits an observed link as an edge, keyed by capture" },
  cpuprobe:             { ground: "substrate", is: "the CPU probe — a Worker cannot time itself" },
  export:               { ground: "substrate", is: "writes an export manifest of what is already there" },
  taskdrain:            { ground: "substrate", is: "the task scheduler's own tick" },
  capturerequest:       { ground: "substrate", is: "queues a capture, a run's or (capture-requests R56) a member's own request for later; the capture is the act, this is the request" },
  capturerequestdrain:  { ground: "substrate", is: "the capture-request queue's own tick" },
  reproject:            { ground: "substrate", is: "rebuilds the projection from bundles already written" },
  livefire:             { ground: "substrate", is: "the self-test write, scratch-confined" },
  purge:                { ground: "substrate", is: "operator maintenance of the store, not an act on the record" },
  /* D-436: the root of trust's one act on a store that predates the value. It sits BENEATH the record — it records
     whose store this is, which every later creation is stamped with — and it rewrites nothing the record already
     holds, so there is no act on the record for a rung to price. It cannot be undone either: that is WRITTEN ONCE,
     refused a second time by name (C-64.3), and stated there rather than as a rung here. */
  instancegroupseed:    { ground: "substrate", is: "records, once, the producing group every later creation is stamped with" },
  /* REC-164: the group's display name and its domain claim — presentation of WHO publishes, never what the record says. */
  groupnameset:         { ground: "substrate", is: "records the group's own words for itself, a presentation value in no signed bytes" },
  groupdomainset:       { ground: "substrate", is: "records a domain CLAIM and its verdict; it moves no document, claim or grade" },
  /* K407 (instance-setup, C-119): `groupnameset`'s ground — which jurisdiction profiles the instance works under is its
     configuration, beneath the record; it moves no document, claim or grade. */
  profilesset:          { ground: "substrate", is: "records which jurisdiction profiles the instance works under, an administrator's configuration; it moves no document, claim or grade" },
  connect:              { ground: "substrate", is: "DERIVES connections from documents already held; re-running re-derives" },
  provenancechain:      { ground: "substrate", is: "rebuilds the provenance register from what is already recorded" },
  provenanceroute:      { ground: "substrate", is: "assesses a route already captured" },
  airuntick:            { ground: "substrate", is: "an AI run's own progress tick" },
  /* CPDF-13 / D-183. THE THREE CALIBRATION WRITES, and they are `substrate`
     rather than absent-for-want-of-thought: a RUNG is a step on the ladder of
     acts that move the RECORD's claims about the civic world, and none of these
     touches a claim. `calibrate` records what a probe measured of a DERIVATION
     ENGINE; `calibrationsubject` says which engine this instance can probe; and
     `calibrationsignal` records that somebody else announced something about
     their own product. What they establish is how far the record may be
     TRUSTED, which is a fact about the instrument and not about the subject.
     AND THE ABSENCE IS LOAD-BEARING RATHER THAN CLERICAL. If `calibrate` carried
     a rung it would be an act that moves the record — and the whole thesis of
     this item is that a measurement NEVER moves a grade, in either direction
     (DEC-4; refused by name at the door as CAL_CANNOT_REGRADE). A rung here
     would say the opposite of what the construct enforces. */
  calibrate:            { ground: "substrate", is: "records what a probe measured of a derivation ENGINE; it moves no claim and no grade (DEC-4)" },
  calibrationsubject:   { ground: "substrate", is: "declares which engine this instance can probe; registering is not measuring" },
  calibrationsignal:    { ground: "substrate", is: "records a vendor announcement; it may only SHORTEN the interval to the next probe and changes no grade" },
  /* N115 (T7): `connect`'s ground — the plane stores what it inferred from where a file is printed; nobody chose it. */
  filemembershipstore:  { ground: "substrate", is: "stores an agenda capture's inferred item-to-file containments as system-asserted connections; a member's judgement of each is a separate act" },

  /* ---- credential: who may act, not what the record says. */
  memberadd:            { ground: "credential", is: "roster governance" },
  memberset:            { ground: "credential", is: "roster governance" },
  membercaps:           { ground: "credential", is: "which capabilities a member holds" },
  adminendorse:         { ground: "credential", is: "administrator endorsement of a member" },
  signeradd:            { ground: "credential", is: "signer governance — the KEY, not what is signed with it" },
  signerset:            { ground: "credential", is: "signer governance" },
  /* N364 (membership R89, R90; DEC-80): a member registers or revokes their OWN signing key, `signeradd`'s ground — the
     key, never what is signed with it. */
  signerregister:       { ground: "credential", is: "a member registers their own signing key, every administrator told (membership R89); the key, not what is signed with it" },
  signerrevoke:         { ground: "credential", is: "a member revokes their own signing key (membership R90); the key, not what is signed with it" },
  governorconfig:       { ground: "credential", is: "operator tuning of the per-host governor" },
  /* K377 (monitoring R30): the administrator's pause of the monitoring daemon, on `governorconfig`'s ground beside it. */
  monitorpause:         { ground: "credential", is: "an administrator's setting over the instance's own fetching: pauses or resumes the monitoring daemon" },
  expertisedeclare:     { ground: "credential", is: "a member's own declaration about themselves" },
  expertiseconfirm:     { ground: "credential", is: "administrator act on a declaration" },
  enroll:               { ground: "credential", is: "an invitee becoming a member" },
  knock:                { ground: "credential", is: "an unauthenticated request to be let in" },
  /* N364 (sources R11): `knock`'s ground — the source proves who they are by the knocker secret, with no account, and
     what the act moves is whether a source's own consent stands, which `sourceconsent` (a member's evidenced record of
     it) grades on the ladder. */
  knockerconsent:       { ground: "credential", is: "a source, proving who they are by their knocker secret and holding no account, consents to or withdraws from one disclosure for one audience (sources R11)" },
  claim:                { ground: "credential", is: "claims an instance at bootstrap" },
  aicredentialmint:     { ground: "credential", is: "mints a machine credential" },
  aicredentialrevoke:   { ground: "credential", is: "revokes a machine credential" },
  projectinvite:        { ground: "credential", is: "roster act on a project, position-enforced by the store" },
  projectjoin:          { ground: "credential", is: "roster act on a project" },
  projectleave:         { ground: "credential", is: "roster act on a project" },
  /* REC-150 (Membership v2 §7.14): the request to join is participation — WHO may act in a project — exactly as the
     roster acts beside it are; a GRANT writes the same `invited` row `projectinvite` does. */
  projectrequest:         { ground: "credential", is: "a member outside a discoverable project asks to be added (§7.14); one open at a time, withdrawn by the requester" },
  projectrequestwithdraw: { ground: "credential", is: "the requester closes their own open request to join" },
  projectrequestanswer:   { ground: "credential", is: "an owner grants a request to join (an invitation: `invited`, never `joined`) or declines it" },
  projectremove:        { ground: "credential", is: "roster act on a project" },
  projectowneradd:      { ground: "credential", is: "roster act on a project" },
  /* N84 (T7): membership's three roster-self acts (N43) — who administers, who hosts, and which cover a member's
     handle is published under. Each changes who acts or how an actor is shown, never what the record asserts. */
  adminresign:          { ground: "credential", is: "an administrator resigns their own standing" },
  hostingaccessset:     { ground: "credential", is: "records who holds hosting access to the instance" },
  memberpairingset:     { ground: "credential", is: "a member (or an administrator) chooses whether a cover-and-handle pairing is published" },

  /* ---- caller-owned: the caller's own state, never the record's. */
  select:               { ground: "caller-owned", is: "a server-side selection snapshot, owned by the credential that made it" },
  selectionrelease:     { ground: "caller-owned", is: "releases that selection" },
  queuemute:            { ground: "caller-owned", is: "one member's preference about their own feed (REC-21, D-125)" },
  queuesnooze:          { ground: "caller-owned", is: "one member's preference about their own feed" },

  /* ---- observational. */
  monitor:              { ground: "observational", is: "one tick: what the source serves NOW against what was captured" },

  /* ---- undetermined: REAL RECORD ACTS WITH NO RUNG, STATED. FW-14 surfaced this list and named the ladder's gap it
     shares: an act a member performs once, kept attributed and dated, corrected by a further act moving FORWARD, and
     not signed — so neither `attested` (no key) nor `reversible` (no act takes it back) describes it. DEC-88 (K1038)
     closed the gap by ruling for 57 of the 78 that stood here, banding each `reversible`, `reasoned` or `terminal`
     (RUNGS); these 21 are what it left `undetermined` (R3), each on R3's rule: no authored reason is asked and no
     published act takes it back. R7 adds T23's `whatchangedpropose`, R9 the docket's `docketpressure` and R10 `case-import`'s `caseimport` and
     `caseimportdocument` on the same rule, at the foot of this table. */
  /* (R35, T47) `inboxpull` left this ground for `reversible` (RUNGS): the document it files waits held at `collected`,
     where `heldsetaside` takes it out of what the group relies on. */
  /* N345 (K481), on R3's rule. `contradictionrecommend` is `contradictionpropose`'s ground for its reason: a run
     proposes, and it is machine work. The opt-in and the response (DEC-85) ask no authored reason (their words are
     optional, a response's text is what is relayed, not an account of a decision), and no published act takes either
     back: an opt-in is never withdrawn, and a response is relayed as written. */
  contradictionrecommend: { ground: "undetermined", is: "a run RECOMMENDS in which respects the sides of a shown contradiction may differ — never which side is wrong or a kind — labeled machine work and standing only while the candidate is open (contradiction R37)" },
  contradictionoptin:   { ground: "undetermined", is: "a project, through one of its joined participants, asks to resolve a conflict with a record its members cannot see; never withdrawn, and when every project holding a side has asked, the projects are named to each other (contradiction R51, R52)" },
  contradictionrespond: { ground: "undetermined", is: "a member of an opted-in project responds to a conflict's notice, disclosing only what they choose; relayed as written to the other opted-in projects once they are named to each other (contradiction R53, R54)" },
  /* REC-126 / DEC-31 — THE REVIEW COPY. The GRANT and its withdrawal are `credential`: their whole subject is WHO MAY
     READ one draft, and they write nothing the record asserts. The draft and the comment are DEC-88's `reversible`
     (RUNGS). */
  reviewgrant:          { ground: "credential", is: "the owner grants one named recipient READ-AND-COMMENT on one draft at one case edition, by a per-grant read secret" },
  reviewrevoke:         { ground: "credential", is: "the owner withdraws a review grant; the secret then answers as one never issued" },
  /* K219 (T7): `capturerequestdrain`'s and `capturerequest`'s ground — the machinery a decided act rides on. */
  reevaluationraise:    { ground: "substrate", is: "reevaluation's bounded sweep raising the version notices; the unattended path, stamping nothing (reevaluation R14)" },
  capturerequestretry:  { ground: "substrate", is: "re-queues a capture request the source refused, once a member supplied what it asked; the capture is the act (capture-requests R42)" },
  /* K705, K709 (T18 layer 11), on R3's rule: filings' two new writes and actions' two. None asks an authored reason
     (a pressure mark's note describes what was received, and `PRESSURE_REFUSED` is a malformed mark, not a missing
     account), and no published act takes any of them back. `actioncreate` is a member's chosen act, not `promote`'s
     substrate, though it rides the same write. DEC-88 left all four `undetermined` (R3). */
  communicationprepare: { ground: "undetermined", is: "a machine or a member prepares a draft message, briefing or statement for an action, stored apart and labeled as its preparer's; never sent until a member approves it (filings R23)" },
  templatesave:         { ground: "undetermined", is: "a member starts a template draft (or a draft of a new version of a named template) from an approved filing draft, handed to the template library's draft act; no machine writes one (filings R32)" },
  actioncreate:         { ground: "undetermined", is: "a member creates an action, the same write as promoting an action document (actions R47)" },
  actionpressure:       { ground: "undetermined", is: word("act.actionpressure.does") },
  /* K727 (T18), on R3's rule: action-plans' acts that ask no authored reason and that no published act takes back —
     opening a plan, adding, proposing and adopting an option, a checkpoint's judgement (its note optional, never
     re-judged) and starting an option as an action (`actioncreate`'s ground). DEC-88 left all six `undetermined`. */
  /* R47 (T50): `planopen` left this ground for `reversible` (RUNGS, ./t50.mjs): planclose ends the plan (action-plans R20). */
  optionadd:            { ground: "undetermined", is: "a member adds an option to a plan — what could be done, its category, the subjects it serves (action-plans R9); revised forward with a reason, never deleted" },
  optionpropose:        { ground: "undetermined", is: "a machine or a member PROPOSES an option with its why, stored apart and labeled; never an option until a member adopts it (action-plans R11)" },
  optionadopt:          { ground: "undetermined", is: "a member adopts a proposal as an option, the option naming the proposal, at most once (action-plans R11)" },
  checkpointrecord:     { ground: "undetermined", is: "a member records whether a phase's condition was met at its checkpoint, with an optional note; judged once, never re-judged (action-plans R16)" },
  optionstart:          { ground: "undetermined", is: "a member starts a chosen option as an action composed from it and promoted, `actioncreate`'s ground (action-plans R18)" },
  /* K727 (T18): action-clocks' reminders (its R4, R6), `queuesnooze`'s ground — a member's own request about their own
     attention, kept in that module's table and never in the action's document. */
  reminderset:          { ground: "caller-owned", is: "a member asks to be reminded of a dated clock entry on a day, or changes or removes their own reminder (action-clocks R4)" },
  reminderanswer:       { ground: "caller-owned", is: "a member answers their own due reminder, with a further one or none (action-clocks R6)" },
  /* `export`'s ground: the bytes are already the record's; this hands them over and logs who took them. */
  counselpacketexport:  { ground: "substrate", is: "hands a member a counsel packet version's bytes and records who exported it, when and for which counsel (filings R11)" },
  /* R6 (K921, T21): the template library's acts. The grant and its revocation are `reviewgrant`'s and `reviewrevoke`'s
     ground: their subject is WHO MAY READ AND REVIEW one version. The other seven are R3's rule: none asks an authored
     reason that the act revises what stands, and no published act takes one back — a later version updates, never
     undoes, and a review or comment is answered by another. */
  templatereviewgrant:  { ground: "credential", is: "a participant of the template's project gives a named non-member a revocable read-comment-and-review door to one draft or in-review version, by a per-grant secret (filing-templates R8)" },
  templategrantrevoke:  { ground: "credential", is: "withdraws a template review grant; the secret then answers as one never issued (filing-templates R8)" },
  templatedraft:        { ground: "undetermined", is: "a member creates a template and its first draft, or a draft of a new version of one, from their own words, a version they may see or a proposal; never offered until reviewed and approved (filing-templates R3)" },
  templaterevise:       { ground: "undetermined", is: "a member revises a draft's text, every earlier revision kept with its author and time, or adopts a proposal's text (filing-templates R4)" },
  templatepropose:      { ground: "undetermined", is: "a machine or a member PROPOSES wording for a template or a kind with its why, stored apart and labeled; a template's text only when a member takes it up (filing-templates R6)" },
  templatesubmit:       { ground: "undetermined", is: "a member moves a draft to review, fixing its text, and names the members asked to review it (filing-templates R7)" },
  templatereview:       { ground: "undetermined", is: "a member, or a professional through a live grant, records one review of a version's present text: no concerns, concerns, or changes requested; a later review of the same text stands in its place, the earlier kept (filing-templates R9)" },
  templatecomment:      { ground: "undetermined", is: "a member, a grant's recipient or a labeled run comments on a version, or a member adds a note; attributed, never edited (filing-templates R12, R13)" },
  templateapprove:      { ground: "undetermined", is: "an approver who is not the version's sole author approves a reviewed version, the earlier approved version marked updated and still offered; or an administrator widens an approved template to the group (filing-templates R10)" },
  /* R7 (N485: K1025, K1035), on R3's rule, as `templatepropose`: a draft of a new edition's statement, machine or
     member, append-only; it asks no authored reason and no published act takes it back. */
  whatchangedpropose:   { ground: "undetermined", is: "a machine or a member PROPOSES a draft of a published case's next edition statement, labeled machine work when a machine proposed it and kept append-only; never a statement until a member adopts or rewrites it (case-authoring R39)" },
  /* R9 (DEC-116, N520), on R3's rule, as `actionpressure`: a pressure mark's note describes what was received (a
     malformed mark is PRESSURE_REFUSED, not a missing account), and no published act takes a mark back. */
  docketpressure:       { ground: "undetermined", is: "a member marks a docket record entry as a threat — legal, retaliation, discrediting or other — with an optional note; appended, never rewriting the entry, and an entry is marked once (docket R2)" },
  /* R10 (DEC-112 (6); N520), on R3's rule, as `inboxpull`: each brings bytes into this copy in a member's name, asks no
     authored reason, and no published act takes it back — an import is append-only and read-only (case-import R2, R12),
     and a completion stores only bytes the edition already names by fingerprint (its R5). */
  caseimport:           { ground: "undetermined", is: "a member imports another group's case file into a read-only project, one per source group, case and lens, each edition held beside the others and never replaced; every finding is recreated and its result recorded (case-import R1–R3)" },
  caseimportdocument:   { ground: "undetermined", is: "a member completes an imported edition with a document whose fingerprint the edition records as missing, and every finding of that edition is checked again; nothing else about the edition changes (case-import R5)" },
  /* R11 (DEC-120, DEC-121; N528): the wizard library's acts, on the template library's grounds (R6). The five drafting
     and approving acts are R3's rule, as the template acts: none asks an authored reason that the act revises what
     stands, and no published act takes one back (a later version updates, never undoes). The editor grant and its
     revocation are `credential`: their subject is WHO MAY write a blank start or add steps. A progress call is an
     unattributed tally of what happened, `observational`. */
  /* R47 (T50): `wizarddraft` left this ground for `reversible` (RUNGS, ./t50.mjs): wizardretire takes the script back (wizard-scripts R9). */
  wizardrevise:         { ground: "undetermined", is: "the draft's author replaces its steps by a new revision, every earlier revision kept with its author and time, or adopts a proposal's steps (wizard-scripts R4)" },
  wizardpropose:        { ground: "undetermined", is: "a machine or a member PROPOSES steps for a project or a script with its why, stored apart and labeled; a draft only when a member takes it up (wizard-scripts R5)" },
  wizardsubmit:         { ground: "undetermined", is: "the author moves a draft to submitted, fixing its steps and digest, once it passes the checks against the registered screens (wizard-scripts R6)" },
  wizardapprove:        { ground: "undetermined", is: "a project owner who is not the version's sole author approves a submitted version, the earlier approved version marked updated; or an administrator widens an approved script to the group (wizard-scripts R7)" },
  wizardeditorgrant:    { ground: "credential", is: "an administrator grants a member the advanced editor: a blank start and adding steps (wizard-scripts R8)" },
  wizardeditorrevoke:   { ground: "credential", is: "an administrator revokes an advanced-editor grant, appended and never deleted (wizard-scripts R8)" },
  wizardprogress:       { ground: "observational", is: "adds one to an unattributed daily tally of a script version's start, step reached or finish; names no member, case or project, and stopping is no event (wizard-scripts R15)" },
  /* R13 (T33-85): T33's ops, graded in ./t33.mjs, T34's in ./t34.mjs, T35's in ./t35.mjs, T36's in
     ./t36.mjs, T37's in ./t37.mjs, T41's in ./t41.mjs, T42's (R31) in ./t42.mjs, T45's (R32) in ./t45.mjs, T46's (R33) in
     ./t46.mjs and T47's (R37) in ./t47.mjs (T38's ./t38.mjs states no absence). */
  ...T33_RUNG_ABSENT,
  ...T34_RUNG_ABSENT,
  ...T35_RUNG_ABSENT,
  ...T36_RUNG_ABSENT,
  ...T37_RUNG_ABSENT,
  ...T41_RUNG_ABSENT,
  ...T42_RUNG_ABSENT,
  ...T45_RUNG_ABSENT,
  ...T46_RUNG_ABSENT,
  ...T47_RUNG_ABSENT,
  ...T48_RUNG_ABSENT,
  ...T49_RUNG_ABSENT,
  ...T50_RUNG_ABSENT,
  ...T51_RUNG_ABSENT,
};

/* D-311 · THE ACTS A MACHINE CREDENTIAL'S CLASS IS REFUSED BY NAME, each with the code its store
 * method answers — `!who || isMachineIdentity(who)` on the author stamp, REC-46's one predicate,
 * which fires whatever the object's state. `deriveActs` withholds these when the store states
 * `actor_is_machine === true`: before this, a `class:` credential was offered `publish` (and every
 * act below) and refused at the act, the pre-flight disagreeing with the act (DEC-8).
 * DECLARED HERE AND DRIVEN, `weight`'s precedent: `affordances`' R20 test (`test/m/affordances/`,
 * in the running plane, with `sourceconsent` and `contradictionresolve` at their own modules'
 * interfaces) performs every act in ACTS with a machine credential and holds this map to the codes
 * that come back, BOTH directions — an act refused by a MACHINE_* code and absent here fails by
 * name, and so does an entry the store no longer answers. `withdrawconclusion` enters `conclude()` after its machine
 * fence and answers conclude's code. NOT here, because the store refuses no machine at them:
 * `retire`, `dispose`, `cite`, `sever`, `reinstate`. */
const MACHINE_REFUSALS_DATA = {
  release:            "MACHINE_CANNOT_RELEASE",
  conclude:           "MACHINE_CANNOT_CONCLUDE",
  withdrawconclusion: "MACHINE_CANNOT_CONCLUDE",
  reopen:             "MACHINE_CANNOT_REOPEN",
  publish:            "MACHINE_CANNOT_PUBLISH",
  inquirydivide:      "MACHINE_CANNOT_DIVIDE",
  inquiryground:      "MACHINE_CANNOT_GROUND",
  actionmove:         "MACHINE_CANNOT_MOVE_ACTION",
  actioncorrespond:   "MACHINE_CANNOT_CORRESPOND",
  /* D-149's act, added at integration by c19-unionfix (2026-09-24): the store refuses a machine BY NAME at it
     (C-32.18, `is-machine-set-laws`), and D-149 landed it in ACTS without this entry — so a machine credential
     was OFFERED "State governing laws" and refused at the act, the DEC-8 disagreement this map exists to
     prevent. Found when the old `d311-roster-affordances` suite gained the drive its fixture guard demanded;
     `affordances` R20's drive holds it now. */
  actionlaws:         "MACHINE_CANNOT_SET_LAWS",
  /* REC-214: the store refuses a machine at the member's revision act by C-32.19's own code, through the one
     helper `promote`'s action block also asks (`#machineRiskTierRefusal`). */
  actionrisktier:     "MACHINE_CANNOT_SET_RISK_TIER",
  versionaccept:      "MACHINE_CANNOT_MOVE_VERSION",
  versionreject:      "MACHINE_CANNOT_MOVE_VERSION",
  versionconsider:    "MACHINE_CANNOT_MOVE_VERSION",
  versionrevert:      "MACHINE_CANNOT_MOVE_VERSION",
  versioncurrent:     "MACHINE_CANNOT_MOVE_VERSION",
  versionhide:        "MACHINE_CANNOT_MOVE_VERSION",
  /* N345: contradiction's member acts refuse an empty or machine author first (its R30, C-93.10). */
  contradictionresolve: "MACHINE_CANNOT_ACT_ON_CANDIDATE",
  /* R8, R32 (T45; K2885, K2887): the acts `affordances` R51 makes ACTS rows on an action target, each refused a machine
     by its owner's own code (action-holds, actions, action-replies, escalation, filings, action-clocks, plan-work through
     action-plans' row). `filingprepare`, `communicationprepare`, `holdnoticeprepare` and `actionbearingpropose` admit a
     machine and take no row. Each left NON_ACTS with this change; no rung moves. */
  actionhold:         "MACHINE_CANNOT_SET_HOLD",
  actionholdrelease:  "MACHINE_CANNOT_SET_HOLD",
  actionpressure:     "MACHINE_CANNOT_MARK_PRESSURE",
  holdnoticesent:     "MACHINE_CANNOT_SEND",
  actionreceipt:      "MACHINE_CANNOT_CORRESPOND",
  actionscope:        "MACHINE_CANNOT_SET_SCOPE",
  actionpromise:      "MACHINE_CANNOT_RECORD_PROMISE",
  actionreplybearing: "MACHINE_CANNOT_RECORD_BEARING",
  arosefrom:          "MACHINE_CANNOT_LINK",
  escalationopen:     "MACHINE_CANNOT_OPEN",
  escalationattach:   "MACHINE_CANNOT_ATTACH",
  counselpacket:      "MACHINE_CANNOT_NAME_COUNSEL",
  filingapprove:      "MACHINE_CANNOT_APPROVE",
  filingsent:         "MACHINE_CANNOT_FILE",
  clockstate:         "MACHINE_CANNOT_STATE_CLOCK",
  reminderset:        "MACHINE_CANNOT_SET_REMINDER",
  itemtakeup:         "MACHINE_CANNOT_PLAN",
  /* R33 (T46; affordances R52, amending R51): stopping and reopening an escalation are ACTS rows on an action target,
     each refused a machine by escalation's own code (its R31); neither has a NON_ACTS row. */
  escalationstoppursuing: "MACHINE_CANNOT_STOP",
  escalationreopen:       "MACHINE_CANNOT_STOP",
  /* R33 (T46; K2998; affordances R52): adopting a clock proposal is an ACTS row on an action, refused a machine by
     action-clocks' own code; its absence (`undetermined`) stands and it left NON_ACTS. */
  clockadopt:             "MACHINE_CANNOT_ADOPT_CLOCK",
  /* R38 (T48; affordances R58): the quoting record is an ACTS row on an action, refused a machine by its owner's own code
     (action-replies R10), with no NON_ACTS row. `planask` is none (R41, K3297): a plan act, a NON_ACTS row. */
  ...T48_MACHINE_REFUSALS,
};

/* (T45; R8, R32; K2885, K2887) The 21 acts `affordances` R51 makes ACTS rows on an action target are named here no
 * longer — the hold acts, the escalation and filing acts, the communication, the reminder and T45's own action acts —
 * since an op is an act or a non-act, never both (`affordances` R1, R12); their rungs and absences are unchanged.
 *
 * Every op in NEEDS that is NOT an object-directed act, with the reason — so
 * the totality check can tell "deliberately not an affordance" from "someone
 * added an op and forgot the publication", which is the drift this op exists
 * to close. Grouped by the reason, keyed by op. */
const NON_ACTS_DATA = {
  /* The write substrate. These are how any act lands, not acts on an object:
     a surface never renders a "promote" button beside a bundle. */
  promote: "substrate: the one write path every act rides",
  lease: "substrate: the courtesy lock around promote",
  allocid: "substrate: id allocation",
  capture: "substrate: byte movement, content-addressed",
  acquire: "substrate: the fetch layer (M2')",
  linkproject: "substrate: admits an observed link as an edge, keyed by capture",
  /* K4279 (R5): an administrator-session act, not object-directed; the sentence is corpus-export's declared row, word for word (R50 (b)). */
  export: "writes an export manifest of what is already there",
  /* Capture-directed: their subject is a capture sha, not a bundle's state.
     REC-38: NOT acts here, and their member-facing METADATA is published all
     the same — `affordances`' CAPTURE_ACTS carries the label, decorateAct adds the
     needs/mode/rung from the same tables every act reads, and op=affordances
     answers them in a `capture_acts` block beside the vocabularies. A reason
     beginning "capture-directed:" is what makes an op a member of that block,
     and the suite holds the two lists equal in both directions. */
  attest: "capture-directed: co-attestation of a capture's existence in time (metadata published in capture_acts)",
  monitor: "capture-directed: the monitor tick on a captured source (metadata published in capture_acts)",
  /* CPDF-10. NOT an object-directed act for `attest`'s three reasons above: the
     subject is a capture sha plus an extent, `affordanceFacts` carries no
     capture, and an applies() writable over those facts would publish the act
     for an information bundle holding no reading — a pre-flight disagreeing
     with the refusal it fronts, which is DEC-8's headline failure. */
  attesttext: "capture-directed: a member attesting that a capture's transcribed text matches the page image, over a stated extent, with the attestor's note saying what they compared, now required (content R43, C-52.10; DEC-88: `reasoned`) (metadata published in capture_acts)",
  /* SK-7 / framework Part II 14.4 (Bob's 5.7). NOT an object-directed act, and
     NOT capture-directed either — the reason deliberately does not begin
     "capture-directed:", because that prefix is what enrols an op in the
     CAPTURE_ACTS block and this act's subject is a DOCUMENT AND AN EXTENT
     rather than a capture sha. It mints an ADDRESS and writes no edge: nothing
     points at the row until a member's own basis leg names the same passage, so
     there is no bundle state for a surface to offer it against and an applies()
     over `affordanceFacts` would have nothing to read. */
  contentmint: "content-directed: marks a part of a document as citable, keyed by (document, extent); mints an address and no edge",
  /* REC-86 / IC-123. NOT an object-directed act, for `contentmint`'s reason one
     row up: its subject is ONE LEG of ONE READING — (inquiry, version, ordinal) —
     and `affordanceFacts` carries neither readings nor legs, so an applies() over
     those facts would offer it on every inquiry whether or not it holds a reading
     with a leg that has a part to narrow into. The surface that offers it is the
     leg display (UI's, DELEGATED), which is where the leg is in hand. */
  narrow: "leg-directed: makes ONE leg of ONE reading point at less of its document, keyed by (inquiry, reading, ordinal); writes a new reading and moves nothing existing",
  /* REC-86: the candidate list is a READ, on `extractproposals`' reasoning below. */
  narrowcandidates: "read: the machine's proposals for making one leg more specific, keyed by (inquiry, reading, ordinal); labeled machine work and writes nothing",
  /* REC-122 / IC-232. NOT an object-directed act, for `narrow`'s reason: its subject is ONE END
     of ONE CONNECTION — (capture, other capture, entity) — and `affordanceFacts` carries no
     connections, so an applies() over those facts would offer it on every document. The surface
     that offers it is the connection display (UI's, DELEGATED), where the connection is in hand. */
  connectionchoose: "connection-directed: records which mention is on point on ONE end of ONE connection, keyed by (capture, other capture, entity); writes a choice row beside the machine's pair and moves nothing existing",
  /* REC-146: the CONTRADICTION pairing read is a NON_ACT for a reason one step
     stronger than `narrowcandidates`' above, and it is worth stating because the
     surfacing item (PRESENT) will be tempted to make it one. It is not
     object-directed because its subject is a PAIR — two assertions in different
     questions, or two documents — and `affordanceFacts` carries neither. But the
     deeper reason is DEC-24 and this design's own section 2: what the pairing
     returns is not something to DO, it is something to LOOK AT, and nothing may act
     on a pair until a member has judged it. An affordance rendered beside a bundle
     would offer the act before the judgement that licenses it exists. */
  contradictionpairs: "read: which of the record's own assertions are worth comparing, by the five named keys; forms candidate pairs, judges none of them and writes nothing",
  /* N345 (R5). The member's acts on a contradiction are NOT object-directed: their subject is a CANDIDATE, keyed by
     its id, and `affordanceFacts` carries none, so an applies() over the facts would offer them on every document. They
     are reached where the candidate's sides are shown. The one act on a BUNDLE is `contradictionresolve`, which
     concludes a contradiction inquiry and is an ACTS row. */
  contradictiondismiss: "candidate-directed: keyed by a candidate, reached where its sides are shown; sets a lead aside for one of three stated reasons, kept, never deleted",
  contradictionclarify: "candidate-directed: keyed by a candidate, reached where its sides are shown; records how the sides differ, or which is wrong and why, and never edits a side",
  contradictiontakeup: "candidate-directed: keyed by a candidate, reached where its sides are shown; opens one contradiction inquiry framed around one side",
  /* K4323 (R51): the owner's declared word. Its id is contradiction's own, which the design's words.json does not key (it keys the
     owed act as `act.owed_contradictionflag.does`, another sentence), so `word` would refuse it; `localize` answers the row the list
     holds for that id, whatever English is given here, so a word changed there changes this reason with it. */
  contradictionflag: localize("contradiction.declared.contradictionflag", "document-directed: keyed by a passage in each of two documents the member may see, reached from either document; sets them side by side as a contradiction for the project to settle, with the member's reason, and changes neither document"),
  contradictionrecommend: "run-directed: a run's recommendation of the respects in which a candidate's sides may differ, keyed by (run, candidate); the run is the subject and no bundle state offers it",
  resolutiondefect: "registry correction, keyed by a resolution: reports with a reason that a recogniser's resolution paired a reference with the wrong entity, and changes no resolution",
  contradictioncandidates: "read: the contradictions shown on an inquiry, a passage, an entity, a bundle, a project or one candidate, each with its sides, label, weight and state; writes nothing",
  contradictiontensions: "read: the marks a contradiction leaves on each side the viewer can see — in tension, softened, stale, qualified, held irreconcilable; writes nothing",
  contradictionfacts: "read: the facts the record holds that bear on each respect in which a candidate's sides may differ, each labeled the record's; writes nothing",
  /* DEC-85: the conflict with a side the member cannot see. The opt-in and the response are the project's and the
     member's acts on a CONFLICT, keyed by the candidate and the member's own project, and a notice is where they are
     offered; no bundle state could say when to offer them. */
  contradictionoptin: "conflict-directed: keyed by a candidate and the member's project, reached from the conflict's notice; the project asks to resolve a conflict with a record its members cannot see, never withdrawn",
  contradictionrespond: "conflict-directed: keyed by a candidate and the member's project, reached from the conflict's notice; a response disclosing only what its author chooses, relayed once the projects are named to each other",
  contradictionnotices: "read: the conflicts a project's members are told of on their own side — the side they may see, never the other side or who holds it; writes nothing",
  contradictionresponses: "read: one conflict's responses for one project — its own as attributed, the other opted-in projects' as relayed; writes nothing",
  /* case-authoring R32: the ceremony's read of what a publication must disclose, before the act. */
  publishtensions: "read: the contradictions a case must disclose before it is published, each side the publisher cannot see highlighted and withheld; writes nothing",
  /* D-148. Not object-directed on `contradictionpairs`' reasoning: it reads ACROSS
     actions by counterparty, and what it returns is something to LOOK AT. */
  actionquotes: "read: the fee quotes the record holds, by counterparty or by request, side by side; judges none of them and writes nothing",
  versionnotice: "read: whether the document a citation rests on has a newer version at its address, and whether a passage at the same extent is in it — a candidate or UNDETERMINED — and whether the update AFFECTS the cited part, graded A/B (unaffected), C/NOT_FOUND (affected) or UNDETERMINED with its reason; moves nothing and writes nothing (D-394, REC-221)",
  /* REC-87 / IC-128. TRANSCRIBE is NOT an object-directed act, on `contentmint`'s
     reason: its subject is a PORTION of a document — (document, extent) — and
     `affordanceFacts` carries no page and no region, so an applies() over those
     facts would offer it on every document whether or not a page was selected.
     The surface that offers it is the page viewer with a region selected (UI's,
     DELEGATED), which is where the portion is in hand. The attestation's subject
     is ONE TYPING, keyed by content id, which is further still from an object. */
  transcribe: "content-directed: a member types what a selected portion of a document says, keyed by (document, extent); mints a content row carrying the typing and writes no edge",
  transcriptionattest: "content-directed: a second member attests another member's typing, keyed by content id, with the attestor's note saying what they compared, now required (content R25, C-52.10; DEC-88: `reasoned`); the typist's own attestation is refused",
  transcription: "read: one member's typing by content id — the text, who typed it, who attested it, and what a leg citing it may claim",
  /* MK-1 / IC-133. TESTIFY is NOT an object-directed act: it acts on no existing
     bundle — it CREATES one, from the member's own words — so there is no object
     in a state for `applies()` to offer it against. The surface that offers it is
     Program B's (MEMBER-KNOWLEDGE-DESIGN.md section 8: surfaces are not rowed). */
  testify: "creation: a member records a firsthand observation, which becomes a NEW authored document; acts on no existing bundle",
  /* MK-4 / IC-136. The LEAD is NOT an object-directed act: its subject is a
     member's words about something the record may not hold at all, which is the
     whole point of a lead, so no object's facts could say when to offer it. */
  lead: "member-directed: a member writes a lead in their own words, keyed by nothing the record holds; writes a `leads` row and no edge, and is never evidence",
  leadlook: "lead-directed: a member records following a lead, keyed by lead id; with the looker's words on where they looked and what they found, now required (observation-log R17, C-54.11; DEC-88: `reasoned`); writes one observation_log row under authority_kind lead",
  leadshare: "lead-directed: the lead's author shares it to one project they have joined, keyed by (lead id, project), with the sharer's reason for telling that project, now required (observation-log R16, C-54.12; DEC-88: `reasoned`); writes a `lead_shares` row and no edge",
  /* MK-7 / IC-319. The ATTRIBUTION ACT is not offered against an object's facts: its subject is a member's choice
     about their OWN words in ONE case edition, and whether an edition reaches an observation is the case's, not the
     observation's. The surface that offers it is Program B's (MEMBER-KNOWLEDGE-DESIGN.md §8). */
  attribute: "author-directed: an observation's author chooses its attribution level for one prepared case edition, keyed by (case, edition, observation); writes an `observation_attributions` row and re-authors the unsigned case document",
  /* N114 (T7), D-681 (observation-log R20). */
  leadlist: "read: the leads this viewer may read, each once — `leadread`'s fence over a list; writes nothing",
  leadread: "read: one lead by id — its words, its author, and every look recorded against it; readable by its author, by the joined participants of a project it was shared to, and by a machine credential only within a member's minted scope",
  /* D-162 / IC-241. THE THEME is NOT an object-directed act: its subject is a member's IDEA, which
     no object's facts could say when to offer, and a placement names a document without acting on
     it — no state moves, no edge is written, nothing the document says changes. */
  themedeclare: "member-directed: a member declares a theme (an idea and its test) keyed by nothing the record holds; writes a `themes` row, no edge and no entity, and is never evidence",
  themeplace: "theme-directed: a member places a document or a passage in a theme, keyed by (theme id, target); writes a `theme_placements` row as membership and no edge",
  themepropose: "theme-directed: a member or a machine proposes a placement, keyed by (theme id, target); writes a `theme_placements` row as a hunch that is never membership",
  /* REC-195: NOT AN ACT ON THE ACTION, and the distinction is D-149's whole ruling rather than a filing
     decision. An ACTS row is what a surface offers a member to DO to the object in front of them, and what
     this op writes is not on the action at all — it is a proposal stored apart from it, which becomes nothing
     unless a member states the list themselves with `actionlaws` (which IS an ACTS row). Publishing it as an
     act would put "propose the governing laws" beside "state the governing laws" on one object, which is the
     record offering a member the machine's half of a ruling that exists to keep the two apart. */
  actionlawspropose: "action-directed: a machine (or a member) proposes the laws governing an action's request, keyed by (action, proposer); writes `action_law_proposals` rows labeled machine work and never the action's own list",
  /* R20 (N6): no place is named here — the spaces, the systems and their floors are the active jurisdiction
     profiles' data (layers.md, "No jurisdiction in the product"). */
  idmatch: "read: one identifier recognised in one of the identifier spaces the active profiles declare — its form, its normalised value, its reach against its publishing system's coverage floor, its standing — or a PAIR judged under Framework §8.3: counts only in two independent systems read from each capture's own addresses, with the referent agreeing; writes nothing",
  /* N115 (T7): connections R43. */
  themewithdraw: "theme-directed: a member withdraws a placement or rejects a hunch in a theme with a reason, keyed by (theme id, target); the placement is kept, shown as withdrawn",
  themeread: "read: one theme by id — its idea, its test, its declarer, its members and its hunches apart, each placement gated by the viewer's sight of the document — or the themes, searchable by a phrase",
  /* SK-8 — THE EXTRACT RUN'S TWO OPS, and the reason they are NON_ACTS is a
     stronger version of `contentmint`'s directly above rather than a weaker one.
     `extractpropose` is keyed by (RUN, document): its subject is a run's
     production, so the thing a surface would have to offer it against is not a
     bundle in a state at all — and `applies()` is handed `affordanceFacts`,
     which holds no run. It is also not something a member performs: a run
     begins on a member's act (`op=airunopen`, itself a NON_ACT below for this
     reason) and the PRODUCTION is the machine's inside it, which is exactly
     what an affordance published against a document would misrepresent.
     `extractproposals` is a READ and nothing in this registry publishes reads. */
  extractpropose: "run-directed: an EXTRACT run's production, keyed by (run, document); the run is the subject and no bundle state offers it",
  extractproposals: "read: what an EXTRACT run proposed, keyed by a run or a document",
  /* REC-147: `extractpropose`'s reason exactly — its subject is a run's judgement over a PAIR the plane formed, keyed by
     (key, both referents at their versions), and `affordanceFacts` holds neither a run nor a pair. */
  contradictionpropose: "run-directed: a run's judgement over a pair the plane formed, keyed by (key, both referents at their versions); the run is the subject and no bundle state offers it",
  /* Keyed by entity / capture / progression — the framework surface, not a
     bundle-state act. */
  entitycreate: "registry write, keyed by entity: registers a subject with the declarer's note on who or what it is and why it belongs in the registry, now required (entities R1, C-91.8; DEC-88: `reasoned`)",
  entityalias: "registry write, keyed by entity",
  relationdeclare: "registry write, keyed by entity pair",
  /* N115 (T7): the registry corrected without erasure (entities R8): each is keyed by what it withdraws. */
  aliaswithdraw: "registry correction, keyed by (entity, alias): withdraws a mistaken alias with a reason and keeps it, shown as withdrawn",
  relationwithdraw: "registry correction, keyed by relation id: withdraws a declared relation with a reason and keeps it, shown as withdrawn",
  /* N115 (T7): connections' acts the derivation does not make (connections R31, R49, R57). Their subjects are a PAIR
     of documents, a capture's inferred containments and one stored containment: no bundle in a state, and
     `affordanceFacts` carries no connection, so an applies() over it would offer them on every document. */
  connectionassert: "connection-directed: a member asserts a connection between two held documents with a stated basis, keyed by the document pair; writes an asserted-connection row, grade D, apart from derived ones",
  filemembershipstore: "derivation: stores an agenda capture's inferred item-to-file containments as system-asserted connections, keyed by capture sha; asserts nothing of the caller's",
  filemembershipjudge: "connection-directed: a member confirms or rejects one stored containment with a reason, keyed by connection id; the inference and every judgement are kept",
  resolve: "recogniser write, keyed by capture sha",
  resolvetestify: "recogniser testimony, keyed by capture sha",
  connect: "connection derivation, keyed by entity",
  progressiondefine: "progression definition, keyed by progression key",
  thread: "progression instance write, keyed by (progression, entity)",
  discharge: "exception document, keyed by (progression, entity, stage)",
  proposedispose: "ages a DERIVED proposal, keyed by (progression, stage) — not a bundle",
  /* Inbox and publication. */
  inboxresolve: "inbox disposition, keyed by knock id, with the member's reason on every arm (doorbell R3, RESOLVE_NO_REASON): sets a knock aside or back to new, and its `pulled` arm is the pull, a filing act that answers as op=inboxpull does (doorbell R3, R13)",
  /* N364 (capture R65–R69, R72; DEC-78, DEC-81 item 3). A knock is not a bundle (capture R32) and a capture is keyed by
     its sha, so none of these has an object in a state beside which to offer it. `inboxpull` is `inboxresolve`'s
     subject, filed; the late co-attestation and the capturing member's account are capture-directed in subject but
     are NOT `capture-directed:` rows, because that prefix enrols an op in CAPTURE_ACTS, which offers an act for any
     capture, and these two are reached only where a case's pre-flight names a self-attested capture (case-authoring
     R34–R36). */
  inboxpull: "knock-directed: a member pulls one knock into the record, keyed by knock id: its bytes held under their own digest, a doorbell receipt written and the knock marked pulled; reached from the inbox, never beside a bundle",
  knocksof: "read: the knocks that presented the same knocker secret, keyed by pseudonym, oldest first, with the continuity sentence and never an identity; writes nothing",
  pulledknocks: "read: the knocks pulled into one capture, keyed by capture sha, never a contact; writes nothing",
  reattest: "self-attested-capture-directed: asks a timestamp authority, and for a public locator a fresh co-archive, over a capture held without co-attestation, keyed by capture sha; appends a late attestation stating it proves the bytes existed by now, not at capture; reached from a case's pre-flight",
  lateattestations: "read: one capture's late attestations in order, keyed by capture sha; writes nothing",
  captureaccount: "self-attested-capture-directed: the capturing member appends a signed account of when and how they captured it, keyed by capture sha; refused to anyone else; reached where the case marks the capture self-attested",
  captureaccounts: "read: one capture's signed accounts from its capturing member, keyed by capture sha; writes nothing",
  /* K1023, K1037 (T22; capture R76, R77, R79–R81): the held documents — collected and not yet kept or set aside — are
     keyed by their ids in a list, never a bundle state `affordanceFacts` describes, so each is reached from the held
     list. `doorbellrefused` is store-internal (the Worker's count of a knock refused before the store) and no public op,
     so it is named nowhere here. */
  heldsetaside: "held-directed: a member sets one or more held documents aside with one reason, keyed by their ids, reached from the held list; the set is refused whole or recorded whole, and nothing is deleted",
  heldrestore: "held-directed: a member restores documents set aside, with one reason, keyed by their ids, reached from the held list; the set-aside stays in the record",
  heldcaptures: "read: the collected documents not set aside, awaiting a member's decision, as the viewer may see them; writes nothing",
  gradenote: "read: one capture's grade note, the words op=acquire's answer carries, keyed by capture sha, null for a capture the viewer may not see; writes nothing",
  doorbelltally: "read: the doorbell's count-only tally of knocks it turned away, by day, for a member session only; holds no address, time or content, and writes nothing",
  /* N364 (sources R1–R9; DEC-78 item 5). A SOURCE is a person behind a knock, keyed by its own id, never a bundle, so no
     object's facts could say when to offer these. The one source act a member is prompted at, the consent, is an ACTS
     row (`sourceconsent`) so its prompt rides it; the rest are named here. `knockerconsent`, the source's own consent by
     secret, holds no account and has no `NEEDS` row, so it is not named here (`affordances` R12), as `knock` is not. */
  sourcedisclose: "source-directed: a member appends one disclosure to a source's history — what was revealed, how, to whom it is known, with its evidence — keyed by source id; never edited, a later entry superseding it on read",
  sourcelink: "source-directed: a member claims that two sources are one person, with evidence, keyed by the source pair; recorded as a disclosure and merging nothing",
  sourceconsentwithdraw: "source-directed: a member records the withdrawal of a source's consent for one disclosure and one audience, keyed by (source, entry); binds only later publications, and what is published stays published",
  sourceof: "read: the source of one capture as it stood when received, beside the source's current history as this viewer may read it, keyed by capture sha; writes nothing",
  sourcerung: "read: where a source stands on the ladder from unknown to publicly known, with who knows and how, keyed by source id; a withheld value stays withheld",
  sourcereadlog: "read: who read a source's stored values under sight, and when, keyed by source id; answered to the listed members and to administrators",
  sourcepublishable: "read: which of a source's disclosures may be shown to one audience at one instant, each with its basis (consent, or public elsewhere, cited), keyed by source id; says nothing of the rest and writes nothing",
  ratify: "publication: its pre-flight is op=publishpreflight (case-authoring R34), which runs the publication and the ratification's checks over the text and writes nothing, because the refusal turns on gate state a surface cannot see",
  /* N364 (case-authoring R34; K530): the ceremony's dry run, a READ for `publishtensions`' reason below. */
  publishpreflight: "read: the publication ceremony's dry run — op=publish's first refusal, every other refusal reachable, and whether the case is ready, over the same arguments, rolled back; writes nothing",
  /* CASE-5b / DEC-72. A NON_ACT for `ratify`'s reason and ALSO for a reason of
     its own, which is why it gets its own sentence rather than riding the row
     above. Its subject is a CASE EDITION, keyed (case_id, edition) — not a
     bundle in a state — so there is no object for it to appear beside, which is
     the same shape `inboxresolve` and `discharge` carry here. And like `ratify`
     its refusals turn on gate state and on whether a signature verifies, neither
     of which a surface can see in advance. The act the SURFACE offers is
     `op=publish`; this is the signature that act asks for next, and op=publish's
     own answer names it in `next:`. */
  caseratify: word("act.caseratify.does"),
  /* REC-126 / DEC-31: THE REVIEW COPY's three authoring acts. Their subject is a
     DRAFT CASE (keyed draft_id) or a GRANT (keyed grant_id) — neither is a bundle
     in a state, so no object's affordance block can publish them, and their
     refusals turn on project ownership the surface reads from the draft itself.
     The UI surface is DELEGATED (CLAIMS.md, REC-126 -> UI) and reads each act's
     answer, which names the next one. */
  casedraft: "review copy: its subject is a DRAFT CASE keyed draft_id, beside publish and never a bundle in a state — the answer names op=reviewcopy",
  reviewgrant: "review copy: its subject is a DRAFT CASE keyed draft_id and its product is a grant keyed grant_id, not a move of any bundle",
  reviewrevoke: "review copy: its subject is a GRANT keyed grant_id, not a bundle in a state",
  /* REC-198: a READ, and its subject is a PROJECT's set of drafts — it moves nothing and offers nothing beside a
     bundle; each row it answers names the read that opens that draft. */
  casedrafts: "read: the drafts of one project (BIO_Publication §6A.4), fenced exactly like reading one draft (BOB #32); each row names op=reviewcopy for its draft, and nothing is written",
  /* REC-14 / DEC-17. Its subject is the GROUP's own declaration about the
     standard its work is held to — authored before the work, about their own
     intentions — so there is no object in any state for it to appear beside. A
     project's override is not an op at all: it is authored frontmatter on the
     project's bundle.md, which is what makes lowering a bar an on-the-record
     act rather than a settings change with nothing to read afterwards. */
  strengthbar: "governance: the GROUP's declared default required strength, keyed by group and not by any bundle — a declaration about the group's own work, never a property of an object or of a reader",
  /* PL-12 / D-84, and it belongs BESIDE `strengthbar` because the two are the
     gate/disclose pair DEC-54 (a) exists to keep apart: the bar the group
     declares, and the lens it declares. Both are keyed by a SCOPE — an instance
     or a project — rather than by the object they are later applied to.
     WHY IT IS NOT AN ACT even though it names a bias bundle. This registry is
     what a surface renders as the CONTROLS BESIDE AN OBJECT, and the object
     `op=biasadopt` names is a bias set whose own lifecycle moves through
     `op=promote` like every other bundle's — draft, proposed, adopted are
     ordinary member-authored transitions and appear as such. What `biasadopt`
     writes is the ADOPTION: the authored, attributed, PINNED fact that a scope
     works under that set (DEC-54 c and d). Its subject is the (scope, set) pair,
     which is not a state of either. Publishing it here would put "adopt this
     lens over your project" on the same control strip as dispose and retire —
     the mistake REC-21 records for `queuemute`, one control for a governance
     declaration and a record act. */
  biasadopt: "governance: the authored, attributed adoption that puts a declared-bias set in force for a scope (DEC-54 c/d), keyed by (scope, bias bundle) and not by any object's state — the disclose half of the pair `strengthbar` is the gate half of",
  /* Selection lifecycle: a selection is the caller's own server-side snapshot. */
  select: "selection lifecycle, owned by the credential that made it",
  selectionrelease: "selection lifecycle, owned by the credential that made it",
  /* Participation: acts on a project's ROSTER, enforced by the store on who the
     caller IS (owner/participant), published today via op=projectparticipants
     and op=projectownerarith.

     D-310 (2026-09-10) kept the seven roster acts here until a per-pair fact existed; D-311 (2026-09-23) built it
     (`f.roster`) and moved them into ACTS (the roster block at its foot), each derived from its own op's refusal
     (`projectremove` is an OWNER's: Membership Architecture v2 §7.7). */
  projectfork: "creates a NEW project; gated on the create_projects shape, not on the source object's state",
  /* REC-150 (Membership v2 §7.14, the request to join). NOT ACTS, and each for a reason of its own shape:
     the ASK is made at EXISTENCE sight, where no object is before the caller — op=affordances answers a project the
     caller cannot see fully as it answers an absent one, so a control there would be offered beside nothing; it is
     reached from op=projectdirectory's row instead, which carries the caller's own request state. WITHDRAW and
     ANSWER act on a REQUEST, not on the project's state: their subject is the (project, requester) pair, which
     op=projectrequests lists — the requester's own list, and the owner's queue — and that is where §7.14 step 4's
     surface (UI-71) renders them. */
  projectrequest: "request to join (§7.14): made at EXISTENCE sight, where no object is before the caller — reached from op=projectdirectory's row, not from a target's control strip",
  projectrequestwithdraw: "request to join (§7.14): the requester's act on their own REQUEST, not on a bundle — listed by op=projectrequests",
  projectrequestanswer: "request to join (§7.14): an owner's grant or decline of a REQUEST, not a state of the project — listed in the owner's queue by op=projectrequests",
  /* Identity, roster and operator surface. */
  expertisedeclare: "a member's own declaration, not a corpus act",
  expertiseconfirm: "administrator act on a declaration, class-gated",
  memberadd: "roster governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)",
  memberset: "roster governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)",
  /* D-136. THE THREE ARRIVE HERE BECAUSE THEY ARRIVED IN `NEEDS`, and that is
     the totality guard doing its job rather than a formality: giving them
     session reach put them in the capability table, and every key there is an
     ACT or a NAMED non-act. They are NON_ACTS for `memberadd`'s reason exactly —
     their subject is a MEMBER and the roster, never a bundle, so there is no
     strip beside an object for them to appear on. D-310 decided the seven roster
     acts STAY non-acts; these three are the same argument and nothing about
     making them reachable by a person changes what they act ON.
     CORRECTED 2026-09-23 by D-311, which folded the seven in: the sentence named
     D-311 as the item that DECIDED they stay, and D-311 is the item that moved
     them. The argument for THESE three is unchanged — their subject is a MEMBER,
     where the seven's subject is a PROJECT, a bundle with a strip. */
  membercaps: "roster governance — the subject is a member's capabilities, not a bundle (4.9)",
  adminendorse: "section 4.7 governance — the subject is a proposed administrator, not a bundle",
  adminremove: "section 4.7 governance — the subject is an administrator's standing, not a bundle",
  /* N84 (T7): membership's roster-self acts (N43), on `adminremove`'s reason: the subject is a member, not a bundle. */
  adminresign: "section 4.7 governance — an administrator resigns their own standing; the subject is a member, not a bundle",
  hostingaccessset: "operator record of who holds hosting access — the subject is the instance's operators, not a bundle",
  memberpairingset: "a member's published cover-and-handle pairing — the subject is how a member is shown, not a bundle",
  /* REC-164: session-reachable through `IDENTITY_ACTIONS`, so in `NEEDS`, so named here: the subject is the group's
     public identity (Publication §7 points 2 and 3), never a bundle. */
  groupnameset: "the group's public display name — the subject is the instance's identity, not a bundle",
  groupdomainset: "the group's claimed domain — the subject is the instance's identity, not a bundle",
  /* K407 (instance-setup, C-119): an administrator's session act, `groupnameset`'s reason; its refusals are
     PROFILES_NOT_ADMIN, NOT_A_LIST, UNKNOWN_PROFILE and PROFILE_IS_TEST. `op=profiles` is a read with no `NEEDS` row
     and is not named here (`affordances` R12). */
  profilesset: "the instance's active jurisdiction profiles — the subject is the instance's configuration, not a bundle; refused PROFILES_NOT_ADMIN to a caller who is not an administrator",
  signeradd: "signer governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)",
  signerset: "signer governance (4.9), every administrator's — bounded by the roster against a stamped `by` (REC-159)",
  /* N364 (membership R89, R90; DEC-80): the member's own key, `signeradd`'s subject — a key, not a bundle. */
  signerregister: "signer governance: a member registers their own signing key, stamped `by` from their session, and every administrator is told; the subject is a key, not a bundle",
  signerrevoke: "signer governance: a member revokes their own signing key, stamped `by` from their session; the subject is a key, not a bundle",
  governorconfig: "operator tuning of the per-host governor",
  /* K377, K404 (monitoring R30, N314): open to member sessions, and refused NOT_AN_ADMIN to a caller who is neither an
     administrator nor the root of trust. */
  monitorpause: "an administrator's setting over the instance's own fetching, refused NOT_AN_ADMIN to a member who is not one; not an act on an object",
  /* Task acts: their subject is a TASK row, assignee-fenced by the store
     (NOT_YOURS), published with the task itself via op=tasks. */
  taskforward: "task act, assignee-fenced; travels with the task via op=tasks",
  taskresolve: "task act, assignee-fenced; travels with the task via op=tasks",
  /* REC-207 (BOB #32, 2026-09-23 23:42Z). The bias-debt pair, NON-ACTS for the RUN verbs' reason one
     table down rather than the task acts' above: a bias debt is keyed by the RUN whose lens moved, and
     settling it changes nothing about the inquiry or project that run's context names. The surface for
     both is the QUEUE ITEM — `#obligationsBiasDebt` publishes the obligation and `#dispositionOf`
     publishes the act it takes (`instead: "biasdebtresolve"`), so the act travels with the item exactly
     as a task act travels with its task, and no surface renders either beside a bundle. */
  biasdebtresolve: "bias-debt act, keyed by the RUN whose lens moved and gated by that run's read; travels with the queue item via op=queue, never beside a bundle",
  biasdebt: "read: one run's bias debt and what settled it, keyed by run id — the record behind the queue item, never an act on an object",
  /* REC-20. A READ, and one whose subject is a MEMBER rather than an object:
     op=queue answers "what has this record put in front of me", keyed by the
     member the control plane stamps. It is not an act on a bundle and no
     surface renders a "queue" button beside one — it is the surface those
     buttons live ON, and the acts it offers per item are THIS file's own
     derivation, carried into the feed rather than restated there. */
  queue: "read: the member's own feed, keyed by member — not an act on an object; the acts it offers per item ARE this derivation",
  /* REC-21, and this classification is DOCTRINE rather than bookkeeping. These
     two are NON_ACTS not merely because their subject is a (member, case) row
     instead of a bundle, but because publishing them here is precisely the
     failure D-125 names: this list is what a surface renders as the controls
     beside an object, so an entry here would put "mute" on the same strip as
     dispose, retire and sever — one control for a personal preference and a
     record act, which is the thing that must never happen. The mute control
     belongs to the QUEUE ENTRY (UI-14 renders it there), not to the object, and
     the vocabulary of what may be muted is published by the refusal and by
     op=queue's own `mute` block, never by a surface-side map. */
  /* REC-34. A READ, and one whose subject is a QUESTION rather than an act on
     it: op=inquirystrength answers what an inquiry's basis derives to, and no
     surface renders an "inquirystrength" button beside a bundle — it is the
     PANEL those buttons sit under (UI-11's strength panel, UI-12's live
     preview). op=queue's classification exactly, one altitude down. */
  inquirystrength: "read: the derived pair for one question — the panel the acts are rendered under, never an act on an object",
  /* REC-18. A READ, and its subject is a PROSPECTIVE leg rather than an object:
     op=earnedbasis says what the record would earn for a target if it were
     cited, which is a fact consulted while COMPOSING the act (op=promote) and
     is never itself an act. No surface renders an "earnedbasis" button beside a
     bundle; UI-20's cite flow reads it to fill a leg in. */
  earnedbasis: "read: what the record earns for a candidate basis leg — consulted while composing a citation, never an act on an object",
  /* REC-83 / IC-84. A READ keyed by CONTENT ID, and the reason it is not an act
     is the same one op=reading's is, one grain finer: it RESOLVES a referent —
     what this citation points at, what the text under it rests on, who has
     checked it — and resolving is what a surface does before rendering, not
     something a member does TO an object. The acts on a content row are
     elsewhere and each has its own door: minting is op=promote's projection,
     attesting is op=attesttext, and NARROWING a citation (REC-86) is an
     authored act on the INQUIRY. No surface renders a "content" button beside a
     bundle; UI-61 reads it to show a leg's `ref` and jump the viewer to the
     page. */
  /* N115 (T7), D-419 (content R32). */
  contentcrop: "read: the crop of a cited PDF image by content id — what a viewer shows for an image citation; writes nothing",
  content: "read: one content row by content_id — the extent a citation points at, its chain and cap, whether the transcription has moved, and the attestations covering it; the referent a leg resolves through, never an act on an object",
  /* REC-36. Keyed by ENTITY, like the registry writes above it: the question is
     "which captured documents name this subject", not "what may be done to this
     bundle". It offers candidates a member picks a resolve out of; the ACT is
     op=resolve, which is already a named non-act keyed by capture sha. */
  readingname: "read: which captured documents' readings name a registered subject (framework §8.1's grade-C tier), keyed by entity — the candidate list op=resolve is chosen from, never an act on an object",
  queuemute: "personal state, keyed (member, case) over the kinds named or (member, item) by the item's own id: a preference about one member's attention, not an act on an object — and never on the same control strip as a record act (D-125)",
  queuesnooze: "personal state, keyed (member, case): defers re-notification for one member, changes nothing about the object or the record (D-125, P-87)",
  /* IS-6. The three run verbs are NOT acts on a bundle and must not appear on
     one, which is why they are named here rather than added to ACTS. A run is
     keyed by RUN ID; its `context` names an inquiry or a project, but the run
     changes NOTHING about that object — INVESTIGATIVE-SESSION.md §14a is
     explicit that "the state of those objects does not change while the session
     runs, so there is no partial state to reconcile". An act offered beside an
     inquiry implies the inquiry moves when it is taken, and this one does not.
     What a run eventually proposes IS an act on an object, and it is IS-1's and
     IS-2's; that act will be an ACTS row, and this one is not it.
     REC-19's totality guard caught this within a minute of the NEEDS entries
     landing, which is the guard doing exactly what `attest`'s six-item history
     bought it. */
  airunopen: "investigative run lifecycle, keyed by run id: starts a background session in the context of an inquiry or a project and changes NOTHING about that object (§14a)",
  airuntick: "investigative run lifecycle, keyed by run id: the run's own heartbeat, budget spend and observation log — no bundle, no state, no record act",
  airunclose: "investigative run lifecycle, keyed by run id: ends a run and names the bound that stopped it (§14b.6); what the run PROPOSED is a separate act with its own author",
  /* PL-3 / IS-4 — AND THE PREDICTION ABOVE IS ANSWERED HERE RATHER THAN LEFT
     HANGING, because it was half right. The IS-6 lander wrote that *"what a run
     eventually proposes IS an act on an object, and it is IS-1's and IS-2's;
     that act will be an ACTS row"*. It IS an ACTS row — six of them, PL-2's
     accept/reject/consider/revert/current/hide, all published and all
     object-directed. `op=suggest` is not one of them and is not a seventh.
     WHY THIS ONE IS NOT AN ACT. An ACTS row is a thing this record OFFERS A
     MEMBER beside an object: it appears in `op=affordances` and a surface hosts
     it. No member presses this. In the background mode a run calls it unattended; in
     the interactive mode (§10) the member's act is "export", performed inside
     the session, and the plane call the session then makes is this one. Offering
     it beside an inquiry would tell a member they may compose a machine
     suggestion by hand, which is not a thing this record does — and would put an
     act on UI-52's register that no item owes a surface for.
     WHAT A MEMBER DOES SEE is the suggestion itself, through `op=basisversions`,
     and the six acts on it. That is where the four beats live. */
  suggest: "the investigative session's ONE write (§4 group 2), keyed by inquiry and run: proposes a reading of the evidence in state suggested. Not object-directed — no member takes it; the six acts ON the proposal are the member-facing ones and they are ACTS rows",
  /* PL-4 / IS-4 — §4 GROUP 1, AND IT IS A NON-ACT FOR EXACTLY op=suggest's
     REASON one line up. The AI REQUESTS acquisition and does not perform it; a
     request is keyed by run and address and changes nothing about any object a
     member is looking at. Offering it beside an inquiry would tell a member they
     may queue an unattended fetch by hand, and would put an act on UI-52's
     ACT REGISTER that no item owes a surface for.
     WHAT A MEMBER DOES SEE is the COMPLETION, and it is not an act either: it is
     a queue CONDITION on D-61's catalogued kind, which a member acknowledges or
     mutes through the queue's own surface. So nothing here is owed a new
     surface, and the register does not grow. */
  capturerequest: "the investigative session's request for a capture (§4 group 1), keyed by run and address, or (capture-requests R56) a member's own request for later, keyed by her stamp and address: writes a row and fetches nothing — the daemon captures, and DEC-47's conduct is applied at that drain. Not object-directed; the completion reaches a member as a queue CONDITION, not as an act",
  /* PL-11 / IS-5 / D-199 — GOVERNANCE, NOT AN ACT ON AN OBJECT, and the line is
     the same one `memberadd` and `signeradd` already sit on. Minting an agent
     credential decides what an automated worker may reach across the whole
     instance; it is keyed by nothing in the corpus and changes nothing about
     any bundle a member is looking at. Offering it beside an inquiry would be
     an affordance on the wrong noun entirely.
     IT IS STILL A MEMBER ACT AND STILL AUTHORED (D-199 (3)) — a non-act row is
     a statement about what a SURFACE offers next to an object, never about
     whether the record holds a name and a date for what happened. It holds
     both, in `ai_credentials`. */
  aicredentialmint: "creating an agent credential with a declared task scope (D-199): instance-level governance, authored and dated by a member, keyed by nothing in the corpus. Not object-directed — it is the roster ops' territory, not a bundle's",
  aicredentialrevoke: "withdrawing an agent credential (D-199): the narrowing half of the same governance act, recorded against the member who withdrew it. Not object-directed, for the reason its counterpart is not",
  /* REC-155 — Membership v2 §4.10 (BOB #19) gave these five SESSION reach, and a session-reachable op carries a
     `NEEDS` row, so this drift guard requires each to be an act or named here. NAMED HERE, AND THE PAIR'S
     SENTENCE SAYS WHAT IS TRUE RATHER THAN "not object-directed": the provenance pair IS keyed by a document.
     Publishing either as an ACT beside a document — a label, a rung, a surface — is NOT decided by §4.10, which
     ruled reach only, and no surface offers it; REC-155 does not invent that. The three calibration writes are
     keyed by an ENGINE, which is no object in the corpus. */
  provenancechain: "document-directed: rebuilds a document's provenance chain from the evidence its register already holds, keyed by bundleId; REPORTS by default and writes only on apply=1. Session reach since REC-155 (§4.10); whether a surface offers it beside a document is NOT decided, so no act row is published",
  provenanceroute: "document-directed: records a standing marker that a document's route cannot be shown, keyed by bundleId; moves no state and no byte. Session reach since REC-155 (§4.10); whether a surface offers it beside a document is NOT decided, so no act row is published",
  calibrate: "engine-directed: records what a probe measured of a derivation engine, keyed by (engine, version); moves no claim and no grade (CAL_CANNOT_REGRADE)",
  calibrationsubject: "engine-directed: registers an engine this instance can probe, keyed by engine; registering is not measuring",
  calibrationsignal: "engine-directed: records a vendor's announcement about an engine, keyed by engine; may only shorten the interval to the next probe",
  /* INTENT #1 J4.3 (T7): intent's seventeen ops. Their subjects are a project's OBJECTIVE, a GOAL, an ASPIRATION or a
     PROPOSAL — none a bundle in a state that `affordanceFacts` describes — so no applies() over it could say when to
     offer them. The surfaces that offer them are the objective, goal and aspiration views and the triage list. */
  objectivecondition: "objective-directed: sets, replaces or removes a project's satisfaction condition, keyed by project, with the author's reason for measuring progress this way, now required (intent R2, R30; DEC-88: `reasoned`); a new revision of the project's document",
  objectiveprogress: "read: a project's progress against its objective, computed against the record, keyed by project",
  objectivegaps: "read: what a project's objective still lacks, keyed by project; the gaps queue renders",
  goaldeclare: "goal-directed: a member declares a goal, keyed by the new goal; acts on no existing bundle's state",
  goallink: "goal-directed: the author's dated claim that a project's objective serves a goal, keyed by (goal, project)",
  goalclose: "goal-directed: a member closes a goal with its reason, keyed by goal id",
  goal: "read: one goal by id, with its objectives and, once closed, its reason",
  aspirationdeclare: word("intent.declared.aspirationdeclare"),
  aspirationdepart: word("intent.declared.aspirationdepart"),
  aspirationdeadend: "aspiration-directed: a dead end appended to an aspiration's pursuit record, keyed by aspiration id",
  aspirationretire: "aspiration-directed: a member retires an aspiration with what pursuing it taught, keyed by aspiration id",
  aspirations: "read: the aspirations of a project or a member, keyed by scope",
  aspirationcontacts: "read: the contacts the viewer's aspirations name, keyed by viewer",
  pursuit: "read: one aspiration's pursuit record by id",
  intentproposals: "read: the open proposals for a project's objective, keyed by project",
  triage: "proposal-directed: a member adopts, opens a question from, defers or dismisses one proposal, keyed by proposal key",
  /* K219 (T7): capture-requests' retry and reevaluation's three member acts. Their subjects are a REQUEST, a version
     NOTICE and a (dependent, cause) pair — none a bundle in a state that `affordanceFacts` describes; each travels with
     the queue item or the notice that offers it. */
  capturerequestretry: "request-directed: retries a capture request the source refused, keyed by request id; travels with the request in op=capturerequests",
  versionadopt: "notice-directed: adopts the newer capture a version notice names, keyed by notice, with the member's reason for adopting it, now required (reevaluation R15; DEC-88: `reasoned`); travels with the notice (reevaluation R14)",
  versionkeep: "notice-directed: keeps a reference on the earlier capture, keyed by notice; travels with the notice (reevaluation R14)",
  reevaluationrecord: "cause-directed: a member records a re-evaluation of a dependent against one standing cause, keyed by (dependent, cause), with its note",
  workobjective: "run-directed: opens an assistant's run on a project's objective, keyed by (run, project), with the member's reason for opening it, now required and shown beside the run's budget and scope (intent R18, R30; DEC-88: `reasoned`); the run is the subject and no bundle state offers it",
  /* Layer 9's acts (K208 (2), K264; restored with N216), keyed to their op maps (escalation's are its own
     `escalationOps`, its R25). Their subjects are a standard, a determination, a consequence part, a filing or packet, an escalation and a proposal:
     STD-, CONF-, CONS- and ESC- bundles carry one recorded state (or an escalation's own stages) that `affordanceFacts`
     does not describe, and the rest are rows, so no applies() over the facts could say when to offer them. Their reads
     carry no `NEEDS` row and are not named here (`affordances` R12). */
  standarddeclare: "standard-directed: a member records a standard (citation, kind, issuer, captured text, period), optionally superseding an earlier one, with the declarer's reason for holding the government to it, now required (standards R1; DEC-88: `reasoned`); writes an STD- bundle",
  standardpropose: "standard-directed: a member or a machine proposes a standard with its why, keyed by proposal id; writes a `standard_proposals` row, never a standard",
  standardadopt: "proposal-directed: a member adopts a standard proposal, keyed by proposal id, with the adopter's own reason, now required (standards R10, through R1; DEC-88: `reasoned`) — the proposal's why is the proposer's; writes an STD- bundle naming it",
  determine: "act-directed: a member determines a government act against named standards on published findings, keyed by (project, act); writes a CONF- bundle",
  comparisonpropose: "project-directed: a machine or a member proposes a comparison, rows and questions and never an outcome, keyed by project and optionally naming the contradiction it starts from; writes a `comparison_proposals` row",
  consequencerecord: "determination-directed: a member records one consequence part against one standard's noncompliant outcome, keyed by (determination, standard); writes a CONS- bundle",
  consequencerevise: "consequence-directed: a member revises a consequence part with its reason, keyed by part id; writes a successor CONS- bundle, the earlier one kept",
  addressedrecord: "consequence-directed: a member records a part addressed or not addressed, with a reason, keyed by part id; writes a `consequence_addressed` row",
  counselpacketexport: "packet-directed: hands a member one packet version's bytes and logs the export, keyed by (packet id, version)",
  theorypropose: "action-directed: a member or a machine proposes a candidate theory and remedy with its why, keyed by action (and packet); writes a `theory_proposals` row",
  escalationevaluate: "escalation-directed: a member reads a counterparty's response with a reason, keyed by escalation id; appends to its log",
  escalationadvance: "escalation-directed: a member advances an escalation along an edge with a reason, keyed by escalation id; appends to its log",
  escalationdecline: "escalation-directed: a member declines a proposed stage for now with a reason, keyed by escalation id; appends to its log",
  escalationend: "escalation-directed: a member ends an escalation, keyed by escalation id; appends to its log, never reopened",
  escalationsuspend: "escalation-directed: a member suspends an escalation with a reason, keyed by escalation id; appends to its log",
  escalationresume: "escalation-directed: a member resumes a suspended escalation at its stage, keyed by escalation id; appends to its log",
  /* J3 (T22; escalation R27, DEC-89): the reasoned decline, keyed by the determination it declines. Its read
     `escalationstatus` (R28) carries no `NEEDS` row, `escalationsdue`'s shape, so it is not named here (`affordances` R12). */
  declinetoescalate: "determination-directed: a member declines, with a reason, to escalate a live noncompliant determination, keyed by determination id; prose only, corrected forward, and a later opening supersedes it",
  actionriskpropose: "action-directed: a machine or a member proposes an action's risk tier with its basis, keyed by (action, proposer); writes an `action_risk_proposals` row, never the tier",
  /* K705, K709 (T18 layer 11): filings' and actions' new writes. A draft communication is a row keyed by an action, and
     a pressure mark is keyed by one correspondence entry; creating an action acts on no existing bundle (`testify`'s
     reason). Their reads (`action`, `actions`) carry no `NEEDS` row and are not named here (`affordances` R12). `templatesave` (filings
     R32, T21) starts a draft in the template library from an approved filing draft. */
  templatesave: "draft-directed: a member starts a template draft from an approved filing draft, keyed by the draft; writes the template library's rows and moves no bundle",
  actioncreate: "creation: a member creates an action from its document, the same write as its promotion; acts on no existing bundle",
  /* K899 (7), K902 (T20): a litigation hold is stated on one `legal` pressure mark, `actionpressure`'s key; it is
     reached where the mark is shown (and from the hold reminder, queue-producers R19), never beside a bundle. */
  /* R8 (DEC-113; actions R56–R58): the release is the hold's own act, keyed as the hold is; its preview and the
     "is this project held?" answer are reads, gated as the act and stamped `viewer`, so each carries a `NEEDS` row. */
  actionholdpreview: "read: what releasing one entry's hold would restart — the projects it alone covers that the viewer may see, and whether any is out of view — keyed by (action, entry ordinal); writes nothing",
  projectholds: "read: for each of 1 to 50 projects, whether a hold in place covers it, with when and by whom it was first stated; names no action, entry or reason, and writes nothing",
  /* K727 (T18): action-plans' twelve acts. A plan is a `PLN-` record object whose options, scenarios and checkpoints are
     rows of its own, none a bundle state `affordanceFacts` describes; they are reached in the plan's view. Its reads
     (`plan`, `plans`, `planproposals`) carry no `NEEDS` row and are not named here (`affordances` R12); `optionstartpreview` (T24,
     N490) is the one that does, and is named at the foot of the twelve. */
  planopen: "project-directed: a member opens a plan for one project over named subjects, keyed by project; writes a PLN- record object",
  plansubjectadd: "plan-directed: a member adds a subject to a plan with a reason, keyed by (plan, subject); kept in the plan's history",
  plansubjectremove: "plan-directed: a member removes a subject from a plan with a reason, keyed by (plan, subject); options serving it keep it, marked",
  optionadd: "plan-directed: a member adds an option to a plan, keyed by plan; writes an option row",
  optionrevise: "option-directed: a member revises an option with a reason, keyed by (plan, option); earlier revisions stay readable",
  optionpropose: "plan-directed: a machine or a member proposes an option with its why, keyed by plan; writes a proposal row, never an option",
  optionadopt: "proposal-directed: a member adopts a proposal as an option, keyed by proposal; at most once",
  optiondispose: "option-directed: a member disposes of one or more options (open, chosen, declined, done, blocked), keyed by (plan, options); every change kept in the option's history",
  scenarioset: "plan-directed: a member sets one of a plan's scenarios whole, keyed by (plan, scenario); the earlier version kept in history",
  checkpointrecord: "scenario-directed: a member judges a phase's checkpoint met or not met, keyed by (plan, scenario, phase); judged once",
  optionstart: "option-directed: a member starts a chosen option as an action, keyed by (plan, option); composes and promotes the action",
  planclose: "plan-directed: a member closes a plan with a reason, keyed by plan id; the plan stays readable",
  /* N490 (T24; action-plans R37, DEC-115): the start preview, gated as the act it previews is and stamped `author` and
     `viewer`, so it carries a `NEEDS` row and is named here by R5's rule. It is a read: it answers what `optionstart`
     would do and writes nothing. */
  optionstartpreview: "read: what starting a chosen option would do at this instant, keyed by (plan, option) — the action it would compose, the reminders it would set, and whether it would start or the refusal it would answer; allocates no id, sets no reminder and writes nothing",
  /* K727 (T18): action-clocks' reminders carry a `NEEDS` row with no capability (the control plane's `null`, as
     `queuesnooze`'s), so each is named: `queuesnooze`'s reason, the subject a member's own attention. */
  reminderanswer: "personal state, keyed (member, action, clock entry): a member answers their own due reminder, with a further one or none",
  /* R6 (K921, T21): the template library's ops and the local facts'. A template and its versions are rows of
     `filing-templates`' own, and a fact is a path into a jurisdiction profile: neither is a bundle in a state that
     `affordanceFacts` describes. A review grant's door reaches four of them, one version at a time. */
  templatedraft: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templaterevise: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templatepropose: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templatesubmit: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templatereviewgrant: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templategrantrevoke: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templatereview: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle; reached also through a review grant's door",
  templatecomment: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle; reached also through a review grant's door",
  templateapprove: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templateretire: "template-directed: keyed by a template or one of its versions, reached from the template library; writes this module's rows and moves no bundle",
  templates: "read: the templates the viewer may see, their offered versions by default, each with its state, attribution and reviews' summary; writes nothing",
  templateread: "read: one template version with its whole attribution, reviews, approval and comments' count; writes nothing; reached also through a review grant's door",
  templatecomments: "read: one template's or version's comments and notes, newest last; writes nothing; reached also through a review grant's door",
  factconfirm: "fact-directed: keyed by a profile fact's path, reached from the calendar and offices; moves no bundle",
  factstatus: "read: one local fact's status, the profile's value and the value that governs here, or every fact of the active profiles; writes nothing",
  factsdue: "read: the local facts unconfirmed, lapsed, due or disputed, or those of the paths named; writes nothing",
  /* K1019 (T22; monitoring R17, R52): an address's own checking frequency, keyed by the address, reached from the
     monitored documents' view; no bundle state `affordanceFacts` describes. */
  addressfrequencyset: "address-directed: a source owner sets how often an address is checked, with a canned or custom reason, keyed by address; a later setting replaces it",
  /* R7 (N485: K1025, K1035; K1094; DEC-111, K1100): T23's ops. A draft of an edition's statement is keyed by the
     published case, and a working-on notice by the project; neither is a bundle state `affordanceFacts` describes. The
     reads write nothing (`noticeprepare` composes a revision to sign and stores none); network-notices' three public
     reads answer with no credential (its R10, R20, R21), registered through public-read (its R18). */
  whatchangedpropose: "case-directed: keyed by a published case, reached from its next edition; a draft, never a statement until a member adopts it",
  noticepost: "project-directed: keyed by a project, reached from the project; an owner's signed notice",
  escalationreasondraft: "read: an escalation's opening reason pre-assembled from a live noncompliant determination's record, keyed by determination, each sentence naming the record it came from and labeled machine work; never a reason until a member sends it, and writes nothing",
  whatchangeddrafts: "read: a published case's drafts of its next edition statement, keyed by case, oldest first, each with its label; writes nothing",
  sweeps: "read: the link sweeps the viewer may see, each with its definition as quoted data, its ratification, its schedule and its last runs; writes nothing",
  noticeprepare: "read: a working-on notice's next revision composed for its owner to sign, keyed by project, with its statement and digest; stores nothing and writes nothing",
  notices: "read: a project's working-on notices, their revisions and attestations, and its sealed weeks without their salts, keyed by project; writes nothing",
  activitymethod: "read: public, no credential",
  noticespublic: "read: public, no credential",
  groupkeyspublic: "read: public, no credential",
  /* R9 (DEC-116, DEC-100; N520): the docket's ops. A docket entry is keyed by a published case (and an entry by its
     id), never a bundle state `affordanceFacts` describes; each is reached from the case's docket. The reads write
     nothing (`docketprepare` composes an entry to sign and holds it in memory for the post, `noticeprepare`'s shape), and the two public reads answer
     with no credential (docket R14, R15). */
  docketfile: "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle",
  docketpressure: "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle",
  docketdecline: "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle",
  docketpost: "case-directed: keyed by a published case, reached from its docket; never evidence, moves no bundle",
  docket: "read: one published case's docket as the viewer may see it — its record entries with their states and marks, and its public shelves; writes nothing",
  docketprepare: "read: a docket entry composed for the case's manager to sign, keyed by case, with its statement and digest; publishes nothing and writes nothing",
  docketinvitation: "read: the request to resend a receipted reply without the private person's name, prefilled for a member to send by their own means; sends nothing and writes nothing",
  docketpublic: "read: public, no credential",
  docketfeed: "read: public, no credential",
  /* R10 (DEC-112 (6), DEC-96 items 1, 2; N520, N522): `case-import`'s ops. An imported case lives in that module's own
     tables, keyed by an import (and an edition, a finding or a flag), never a bundle state `affordanceFacts` describes
     (case-import R2); each is reached from the imported cases. The two reads write nothing, and `case-checker`'s two
     public reads answer with no credential (its R15, registered through public-read R18). */
  caseimport: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  caseimportdocument: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importaccept: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importacceptwithdraw: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importflag: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importflagclear: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importedcases: "read: every case this copy has imported, with its source group, case, lens and editions, and when each was imported; writes nothing",
  importedcase: "read: one imported case's editions, each finding's recreation and its standing against this group's own bar, the source's bar labeled as the source's, and the acceptance in force and the open flags; writes nothing",
  casechecker: "read: public, no credential",
  casefilespec: "read: public, no credential",
  /* R12 (DEC-101 (3); N534): the watch of an imported case's docket is keyed by the import, as R10's acts are. */
  importwatch: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  importunwatch: "import-directed: keyed by an imported case (an import, an edition, a finding or a flag), reached from the imported cases; writes this module's rows and moves no bundle",
  /* R11 (DEC-120, DEC-121; N528): `wizard-scripts`' ops. A script and its versions are rows of that module's own, never a
     bundle state `affordanceFacts` describes; each act is reached from the library or a screen's mark. The reads write
     nothing; `wizardcheck` answers any credential, an assistant planning a wizard included (its R12). */
  wizarddraft: word("act.wizarddraft.does"),
  wizardrevise: word("act.wizardrevise.does"),
  wizardpropose: "wizard-directed: keyed by a script or one of its versions, reached from the library or a screen's mark; writes this module's rows and moves no bundle",
  wizardsubmit: word("act.wizardsubmit.does"),
  wizardapprove: word("act.wizardapprove.does"),
  wizardretire: word("act.wizardretire.does"),
  wizardeditorgrant: "wizard-directed: keyed by a script or one of its versions, reached from the library or a screen's mark; writes this module's rows and moves no bundle",
  wizardeditorrevoke: "wizard-directed: keyed by a script or one of its versions, reached from the library or a screen's mark; writes this module's rows and moves no bundle",
  wizardprogress: "tally: unattributed, keyed by a script's version; names no member",
  wizards: word("act.wizards.does"),
  wizardread: "read: one wizard script version with its steps and its whole attribution; writes nothing",
  wizardsat: "read: the offered wizard scripts that start on one screen, with the caller's own drafts marked; needs no machine credential and no key, and writes nothing",
  wizarduse: "read: a script's unattributed daily use tallies by version and day, to its project's owners and its version's author; writes nothing",
  wizardcandidates: "read: where offered scripts' step counts drop most and which acts are refused most, never a member, case, target or project; writes nothing",
  wizardcheck: "read: the checks every wizard script passes, run over a list of steps against the registered screens, naming each refusal's step; reached by any credential, and writes nothing",
  /* R11 (DEC-158 (4); K1818): the copies whose base has a newer approved version, a read for the wizard editors. */
  baseupdates: "read: each copy of a wizard script whose base has a newer approved version, with both versions' steps, for the group's wizard editors; writes nothing",
  /* R14 (DEC-147; N662): publishing at a set time. A case edition is keyed by (case, edition), never a bundle state
     `affordanceFacts` describes, so each is reached from the ceremony, the case or the owner's queue. */
  publishat: "case-directed: keyed by a case edition (case, edition), reached from the publication ceremony's last step; signs now and publishes at the set time only if every check passes again then",
  publishatmove: "case-directed: keyed by a case edition waiting to be published, reached from the case and the owner's queue; an owner's act until the set time",
  publishatcancel: "case-directed: keyed by a case edition waiting to be published, reached from the case and the owner's queue; an owner's act until the set time",
  publishschedule: "read: the case editions signed to publish at a set time, waiting, published, stopped or cancelled, each with its set time and who set it; writes nothing",
  /* R16 (DEC-152, DEC-153; K1364, K1837): the assistant's two labelled drafts write nothing, so neither takes a rung.
     K4247, B28 (DEC-390): store-door's declared word for this read is keyed, so the row reads it (R51). */
  groupdescriptiondraft: word("store-door.declared.groupdescriptiondraft"),
  writinghelp: word("act.writinghelp.does"),
  /* R13 (T33-85): T33's ops, their reasons in ./t33.mjs, T34's in ./t34.mjs, T35's in ./t35.mjs,
     T36's in ./t36.mjs, T37's in ./t37.mjs, T38's in ./t38.mjs, T41's in ./t41.mjs, T42's in ./t42.mjs, T45's in
     ./t45.mjs, T46's in ./t46.mjs and T47's in ./t47.mjs. */
  ...T33_NON_ACTS,
  ...T34_NON_ACTS,
  ...T35_NON_ACTS,
  ...T36_NON_ACTS,
  ...T37_NON_ACTS,
  ...T38_NON_ACTS,
  ...T41_NON_ACTS,
  ...T42_NON_ACTS,
  ...T45_NON_ACTS,
  ...T46_NON_ACTS,
  ...T47_NON_ACTS,
  ...T48_NON_ACTS,
  ...T49_NON_ACTS,
  ...T50_NON_ACTS,
  ...T51_NON_ACTS,
  ...T51_ACT_NON_ACTS,
};

/* R21 (N657, DEC-143): THE IRREVERSIBLE WEIGHT. An act that can never be undone shows the Irreversible weight on its
 * button, whatever its rung: every op RUNGS grades `irreversible` (since R37, T47, `publishat` and `publishatmove`:
 * `publish` and `publishcheck` prepare and left it), and `personexpunge` (DEC-142), whose rung stays
 * `reasoned`, its name honest, and (K2049) `standardrelease`, `reasoned` too. No other op: derived here before the aliases below are applied, so it names ops, never
 * an alias of one. It changes no rung and no decorated act's shape (`affordances` R11); `affordances` publishes it as
 * `VOCABULARIES.irreversible_weight`, the same frozen array (its R4), served as JSON, which is why it is not a `Set`. */
export const IRREVERSIBLE_WEIGHT = Object.freeze([
  ...Object.keys(RUNGS_DATA).filter((op) => RUNGS_DATA[op] === "irreversible"),
  "personexpunge",
  /* K2049 (DEC-143 applied): standards R37's release moves a policy to the group's sight and is never undone; its rung
     stays as R3 gives it (`reasoned`) */
  "standardrelease",
]);

/* R17 (op-declarations R21): each alias takes its op's very rung, absence and reason, so it never differs from its op. */
Object.assign(RUNGS_DATA, aliased(RUNGS_DATA));
Object.assign(RUNG_ABSENT_DATA, aliased(RUNG_ABSENT_DATA));
Object.assign(NON_ACTS_DATA, aliased(NON_ACTS_DATA));

/* R49, R50 (T51 fix round; K4168): THE GRADING TABLES, AS PUBLISHED. Each is the very table built above, behind a guard that
 * closes registration at its first read; `registerDeclaredOps` (./declared.mjs) adds an owner's declared ops to them before
 * that read. Nothing above or below this block reads them through the guard, so loading the module reads none. */
const declared = createDeclaredOps({
  ladder: RUNG_LADDER, grounds: RUNG_ABSENCE_GROUNDS, rungs: RUNGS_DATA, absent: RUNG_ABSENT_DATA, nonActs: NON_ACTS_DATA,
  machine: MACHINE_REFUSALS_DATA, refusals: JUSTIFICATION_REFUSALS,
});
export const RUNGS = declared.guard(RUNGS_DATA);
export const RUNG_ABSENT = declared.guard(RUNG_ABSENT_DATA);
export const MACHINE_REFUSALS = declared.guard(MACHINE_REFUSALS_DATA);
export const NON_ACTS = declared.guard(NON_ACTS_DATA);
export const registerDeclaredOps = declared.register;

/* fix round 3 (C64; `entities` R63; K4356, K4364): THE ACTS A MEMBER WHO DOES NOT ADMINISTER MAY DO ON ONE SCREEN ONLY. An office named from a
 * request is a member's act on `request` and on no other screen: `entitycreate` keeps its grade (Reasoned) and is admitted there to
 * a member; on another screen it is as it was. `memberMayDo(op, screen)` answers whether `screen` is one of the op's. Data only. */
export const MEMBER_SCREEN_ACTS = Object.freeze({ entitycreate: Object.freeze(["request"]) });
export const memberMayDo = (op, screen) => Object.hasOwn(MEMBER_SCREEN_ACTS, op) && MEMBER_SCREEN_ACTS[op].includes(screen);

/* R18 (DEC-122 (1); K1363 B5): the advisory phone flag — false at the rungs `terminal`, `attested` and `irreversible`,
 * for an absence on the `credential` ground, (T37; DEC-181) for every op in `IRREVERSIBLE_WEIGHT`, read from that set at
 * the call and never copied, so an op later given the weight leaves the phone with no change here, and for
 * `LARGER_SCREEN_ACTS`; true otherwise, so reads, captures and everyday acts are phone acts. Nothing refuses by it. An
 * alias answers as its op (R17): both sets name ops, so `filingrecordsent` is kept for a larger screen as `filingsent`
 * is. */
const NOT_ON_PHONE_RUNGS = new Set(["terminal", "attested", "irreversible"]);
export function phoneOf(id) {
  const op = Object.hasOwn(OP_ALIASES, id) ? OP_ALIASES[id] : id;
  if (Object.hasOwn(RUNGS, op) && NOT_ON_PHONE_RUNGS.has(RUNGS[op])) return false;
  if (Object.hasOwn(RUNG_ABSENT, op) && RUNG_ABSENT[op].ground === "credential") return false;
  if (IRREVERSIBLE_WEIGHT.includes(op)) return false;
  return !LARGER_SCREEN_ACTS.includes(op);
}
