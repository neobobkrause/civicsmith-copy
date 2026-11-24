/* basis-version-grammar — its refusal rows, its vocabularies and the sufficiency claim (requirements:
 * `build/requirements/basis-version-grammar.md` R1–R4, R7–R9). DEC-49: every refusal this module raises carries its
 * code, its C-number and the member's translation, read from one row.
 *
 * COPIED FROM `basis-versions` (`src/basis-versions/checks.mjs`) in T51 (T51-148; K624, K3946): the rows the grammar
 * raises (C-25.1–.10, .12–.15, .19, .36; `BASIS_VERSION_GRAMMAR_CHECKS`), C-27.15 (`VERSION_KIND_CHECKS`), the version
 * machine and its vocabularies, section 9's kinds and the third `asserted_by` state, ids, codes and translations
 * unchanged. The rows only the store or a read can raise (C-25.11, .16–.18, .37–.39), the six acts', the conclusion's
 * and `narrow`'s stay in `basis-versions`. Each `where` names the site in this module that answers it. */

import { isMachineIdentity } from "../record-grammar/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* The site every row the grammar raises names (R1–R3, R6, R7). */
const GRAMMAR_WHERE = "src/basis-version-grammar/grammar.mjs basisVersionFindings, reached from op=promote through the step "
  + "basis-versions registers with promotion (K31) and from the C-2.8 grammar slot";

/* ===================================================================== *
 * THE THIRD `asserted_by` STATE (DEC-65, answered 2026-08-09; PL-17).
 *
 * WHICH `asserted_by`, BECAUSE THERE ARE TWO AND THEY ARE NOT THE SAME FIELD.
 * This block is about the SUFFICIENCY assertion — `grounds[].asserted_by` on an
 * inquiry basis (C-2.8, `checkGrounds`) and `basis_version_grounds[].asserted_by`
 * on a version of one (C-25.6, `basisVersionFindings`). It is NOT the
 * `connections.asserted_by` column in `schema.mjs`, whose three values are
 * `system` / `source` / `member` and which answers "who claims these two
 * documents are connected". Nothing here belongs anywhere near that column, and
 * a reader who wires the two together will have made one field mean two things.
 *
 * THE FIELD'S PUBLISHED MEANING, and it is the whole reason a third state was
 * needed: *a member said this part of the argument is enough on its own.*
 * DEC-32 makes that the ONE thing a member can write that makes a finding
 * STRONGER — the strength is the MAXIMUM over parts asserted independently
 * sufficient — so it carries a named member and a date, and a machine may not
 * write it.
 *
 * THE GAP FL-3 MEASURED (DEC-65, and its reasoning is transplanted rather than
 * summarised). Under DEC-65's shape (b) a machine's SINGLE-PART version still
 * carries a row here, because C-25.5 makes the partition TOTAL. The endpoint
 * STAMPS the field from the session, so that row would read `class:ai` in a
 * field whose published meaning is a member's affirmative claim. **That is the
 * record claiming something nobody claimed** — the overclaim class this project
 * ranks worst, and worse than the missing feature it was reached for.
 *
 * SO THE HONEST SHAPE IS A THIRD STATE, and it is CLAUDE.md's *undetermined is
 * first-class and must be STATED* applied to exactly one field. The field's
 * legal values are now THREE, not two:
 *
 *   A NAMED MEMBER      the claim was made, by them, on that date.
 *   `SUFFICIENCY_UNCLAIMED`  no independent-sufficiency claim was made, said
 *                       OUTRIGHT. Distinct from a member's claim, and equally
 *                       distinct from a blank field.
 *   ABSENT / BLANK      the record does not say. The silent default, and both
 *                       gates refuse it — that has not changed and is not this
 *                       item's to change.
 *
 * WHY IT IS NOT A BACK DOOR TO DEC-32, which is the one thing this state could
 * have been. DEC-32's default is AND and *independent sufficiency is only ever
 * reached by an affirmative, attributed act.* `sufficiencyClaimState` answers
 * `claimed` for a named member and for NOTHING ELSE — not for this value, not for a
 * blank, not for a machine stamp — so a consumer that asks the one predicate
 * cannot take a maximum over a part nobody signed for however the field is
 * spelled. The state widens what the record can SAY; it widens nothing about
 * what it may CLAIM. And DEC-65's arithmetic argument is the narrow licence
 * this state is minted for and is stated here so it is not quietly widened
 * later: with EXACTLY ONE part there is no maximum to take, so the conservative
 * weakest-leg reading is what you get either way. Several parts, none of them
 * claimed, is a different thing and this state does not license it.
 *
 * WHY A COLON-SHAPED LITERAL RATHER THAN A WORD. REC-46's finding, one field
 * over: a word list is the shape to remove, not to extend, because a new
 * spelling escapes it silently and because a bare word can be somebody's name.
 * The colon puts the value in the control plane's own minted-identity grammar,
 * where it cannot collide with a person. The namespace is deliberately NEITHER
 * `token:` NOR `class:`: those two mean *a machine did this*, and this value
 * means *nobody did*. "A machine said" and "nobody said" are different
 * findings, which is the identical distinction the block above draws when it
 * refuses to call an ABSENT identity a machine one.
 *
 * WHERE IT IS WIRED (PL-19). C-25.6 (`basisVersionFindings`, `./grammar.mjs`)
 * admits this value on a version of exactly one part and refuses it on a
 * version of two or more, one finding per part; `versionAsWritten` writes it as
 * the asserter of every ground a machine author submits. Proven at this
 * module's interface by `test/m/basis-version-grammar/sufficiency-state.test.mjs` (R3)
 * and `grammar.test.mjs` (R5). It was minted first and wired after, per
 * DEC-65's own sequencing.
 * ===================================================================== */

/** The explicit "no independent-sufficiency claim was made" value for a
 *  sufficiency `asserted_by` field. ONE literal, in ONE place, so the writer
 *  that will stamp it and the checks that will read it cannot drift apart —
 *  which is the REC-46 lesson taken before it has a chance to repeat. */
export const SUFFICIENCY_UNCLAIMED = 'none:independent-sufficiency';

/** The three legal states of a sufficiency `asserted_by`, plus the one a gate
 *  refuses, each carrying the sentence a member reads INSTEAD OF the machine
 *  word (DEC-49's rule reaches a published vocabulary's texts too). Published
 *  through `vocabularies.sufficiency_claim_states` so no surface invents its
 *  own wording for a state the record now distinguishes.
 *
 *  THE WORDING CARRIES DEC-32's BAN, and it is a constraint on us: *never show
 *  AND / OR / disjunction / grounds — not even as tooltips.* The member-facing
 *  word for a part of an argument is a GROUP OF REASONS, which is the register
 *  `groundInquiry`'s own receipt already speaks in ("each group's strength is
 *  its weakest leg, and this question's is its strongest group"). */
export const SUFFICIENCY_CLAIM_STATES = {
  claimed:        word('basis-versions.claimed'),
  unclaimed:      word('basis-versions.unclaimed'),
  unstated:       word('basis-versions.unstated'),
  machine_stamped: word('basis-versions.machine_stamped'),
};

/** Read a sufficiency `asserted_by` as ONE of the four states above.
 *
 *  THE ORDER OF THE ARMS IS LOAD-BEARING, not stylistic. Blank is answered
 *  first because "nobody said" and "the record does not say" are different
 *  findings. The minted value is answered BEFORE `isMachineIdentity` so that
 *  this state can never be swallowed by a future addition to the machine
 *  prefixes — and the suite pins `isMachineIdentity(SUFFICIENCY_UNCLAIMED) ===
 *  false` besides, so a collision fails loudly instead of hiding behind this
 *  ordering.
 *
 *  `machine_stamped` is NOT a legal value of the field: both gates refuse it
 *  and neither is changed here. It is answered anyway, for the reason
 *  `#axisResult` gives one field over — a row may reach a projection around a
 *  gate, and the reading of one must not be a member's claim. */
export function sufficiencyClaimState(assertedBy) {
  const s = String(assertedBy ?? '').trim();
  if (s === '') return 'unstated';
  if (s.toLowerCase() === SUFFICIENCY_UNCLAIMED) return 'unclaimed';
  if (isMachineIdentity(s)) return 'machine_stamped';
  return 'claimed';
}

/* `isSufficiencyClaimed` (`sufficiencyClaimState(x) === 'claimed'`) stood here until T19 (legacy-checks, K653
   BOB-1): no reader asked it. The one predicate is `sufficiencyClaimState` above. */

/** Is this the explicit no-claim state? Case-folded, because the value reaches
 *  a check hand-written in a document exactly as `token:member` does, and
 *  `None:Independent-Sufficiency` is the same statement. */
export function isSufficiencyUnclaimed(assertedBy) {
  return sufficiencyClaimState(assertedBy) === 'unclaimed';
}

/* =========================================================================
 * PL-1 / IS-1 — BASIS VERSIONS. THE REFUSALS.
 *
 * An inquiry's basis supports many VERSIONS (INVESTIGATIVE-SESSION.md §6), each
 * a complete alternative account of the support for the inquiry's claim. The
 * version block is authored in `bundle.md` and projected inside op=promote's one
 * transaction, so these checks run at BOTH gates through one function —
 * `basisVersionFindings` (`./grammar.mjs`), registered in record-core's C-2.8 slot
 * and called by this module's promotion check. A version that cannot land cannot
 * audit clean either.
 *
 * DEC-49's SHAPE (the check catalogue's, which this file carries): the C-number, the
 * wire code and the CANNED TRANSLATION are ONE ROW, read from one place rather
 * than copied. `basisVersionFindings` reads the C-number OUT of this map at every
 * push site and passes the key as the finding's `code`, so there is no second
 * list of C-numbers anywhere and a row added here is enforced the moment it is
 * used. LOOKUP IS AT RUNTIME for AI_RUN_CHECKS' stated reason: the `message`
 * names the offending version and value, so a build-time table would carry
 * either a template language or a sentence with the facts taken out of it.
 *
 * WHY THE RELATIONSHIP IS A FIELD AND NOT DERIVED FROM THE PARTITION, which is
 * the one design choice here a reader will challenge. The partition alone
 * *implies* the arithmetic — legs sharing a ground are AND, grounds are OR
 * (DEC-32) — so a `relationship` that could only ever agree with it would be a
 * checkbox and D-21's second-place-to-state-a-fact. It is here because it CAN
 * disagree, and because of DEC-32's anti-gaming keystone: the structure is
 * authored BEFORE the strength is shown, and an AI-composed version arrives
 * structure-and-strength together (§12(b)). So the version states, in one word a
 * member affirms at the accept ceremony, what it claims its composition is — and
 * the record checks that word against the structure and REFUSES the disagreement
 * (C-25.4). A version whose partition says OR while its author wrote AND is a
 * version whose accepter would be signing for a claim they did not read. This is
 * the NO_SIBLING_DISCLOSURE posture applied inside one document: a disclosure
 * nobody can check is not a disclosure.
 *
 * AND THE ABSENCE IS REFUSED OUTRIGHT (C-25.3) rather than defaulted to `and`.
 * `inquiry_basis` defaults an unlabelled leg to the implicit single ground on
 * purpose — every leg written before REC-42 reads NULL and derives the
 * weakest-leg answer it always derived. A VERSION has no such history and gets
 * no such default: §3 is explicit that "a version with no relationship field
 * would re-ship the flat-AND basis REC-42 corrected".
 * ========================================================================= */
export const BASIS_VERSION_GRAMMAR_CHECKS = {
  /* §6 rule 1. The description is load-bearing rather than a courtesy: §10 makes
     it what survives a conversation that is deliberately not kept, and under §5
     it carries the naming of every ungraded leg. A version with none is an
     alternative account of the evidence with no account of itself. */
  VERSION_NO_DESCRIPTION: {
    check: 'C-25.1',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_NO_DESCRIPTION'),
  },
  /* §6 rule 2. Unique PER INQUIRY, never globally — "global uniqueness would
     make naming absurd". Two versions of one inquiry sharing a name makes every
     later reference to that name ambiguous, including `derived_from`, which is
     how the derivation tree is read. */
  VERSION_NAME_NOT_UNIQUE: {
    check: 'C-25.2',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_NAME_NOT_UNIQUE'),
  },
  /* R54 (T50; N1136; K3402): a name outside the form (1 to 64 permitted characters, `VERSION_NAME_RE`) is not a
     duplicate, and a member told "two versions share a name" for a name that fits nowhere is told the wrong fact. Its
     words are the list's, read by key. */
  VERSION_NAME_MALFORMED: {
    check: 'C-25.36',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_NAME_MALFORMED'),
  },
  /* §3 / SWEEP C5. See the block comment above for why this is a field. */
  VERSION_NO_RELATIONSHIP: {
    check: 'C-25.3',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_NO_RELATIONSHIP'),
  },
  /* The field is only a claim because it can be wrong. */
  VERSION_RELATIONSHIP_DISAGREES: {
    check: 'C-25.4',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_RELATIONSHIP_DISAGREES'),
  },
  /* §3: "A version that is a flat leg set cannot express plurality — the version IS the composition, and the partition is
     part of the composition." HELD, BUT RAISED BY NO DOCUMENT since fix round 10, cause 30b (K5077; DEC-32 clause 4, as
     `inquiry-grammar` R68): the partition need not cover the legs. A supporting leg naming no ground, beside legs that
     do, is a necessary leg of the version and no finding. The row stays: `basis-versions`' tests pin the row set. */
  VERSION_PARTITION_INCOMPLETE: {
    check: 'C-25.5',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_PARTITION_INCOMPLETE'),
  },
  /* REC-45 / DEC-32's attributed act, at the version's own grain. "These legs
     are enough on their own" is the one thing that makes a finding STRONGER, so
     it carries a named member and a date and a machine credential cannot assert
     it — `isMachineIdentity` is the one predicate, never a word list (REC-46). */
  VERSION_GROUND_UNASSERTED: {
    check: 'C-25.6',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_GROUND_UNASSERTED'),
  },
  /* §6 rule 3a: "Each version records what it was derived from, null where a run
     composed it fresh." An edge naming a version that is not here points the
     derivation tree at nothing. */
  VERSION_DERIVED_FROM_UNKNOWN: {
    check: 'C-25.7',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_DERIVED_FROM_UNKNOWN'),
  },
  /* A derivation tree is a TREE. A cycle makes "what was this derived from"
     unanswerable and the prune walk non-terminating. */
  VERSION_DERIVATION_CYCLE: {
    check: 'C-25.8',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_DERIVATION_CYCLE'),
  },
  /* DEC-50 / §6.7 — the clause the sweep added and the reason this is not merely
     a data check. "An edit that regroups the ground partition is the attributed
     regroup act REC-45 built — ungroup with a reason, cite, regroup — surfacing
     through the derived version's record of who and why. §6.7 licenses no
     unattributed structural edit." So a version whose partition DIFFERS from its
     parent's carries the act: a named member, a date, a reason. */
  VERSION_REGROUP_UNATTRIBUTED: {
    check: 'C-25.9',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_REGROUP_UNATTRIBUTED'),
  },
  /* D-184 / C-2.8, restated at the version's grain because a version's legs do
     not pass through checkInquiryBasis's own loop: a leg rests on information or
     on another inquiry and NOTHING ELSE. Stated as a standing bound of this item
     rather than discovered later. */
  VERSION_LEG_NOT_CITABLE: {
    check: 'C-25.10',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_LEG_NOT_CITABLE'),
  },
  /* §6 rule 4's vocabulary. This is the SIXTH state machine and IS-2 owns its
     transitions; PL-1 owns only that the word written is one of the four. An
     unknown state is refused rather than tolerated for DEC-8's reason: a surface
     rendering a state it has no translation for is the drift DEC-49 closed. */
  VERSION_STATE_UNKNOWN: {
    check: 'C-25.12',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_STATE_UNKNOWN'),
  },
  /* §6 rule 3a, DEC-29(b), D-214. PRUNE HIDES AND NEVER DELETES. The flag is a
     boolean and the refusal exists so that no caller can smuggle a third value
     ("archived", "deleted") into a field whose entire meaning is that the row
     stays in the record and stays queryable. */
  VERSION_HIDDEN_NOT_BOOLEAN: {
    check: 'C-25.13',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_HIDDEN_NOT_BOOLEAN'),
  },
  /* A leg naming its own inquiry. checkInquiryBasis refuses the same thing on
     `basis[]` as SELF_BASIS at the store; a version is an account OF the
     question and cannot rest on it. The transitive cycle check is NOT done here
     and that bound is stated in `basisVersionFindings`' own comment. */
  VERSION_LEG_SELF: {
    check: 'C-25.14',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_LEG_SELF'),
  },
  /* A leg or a ground row that belongs to no version in the block — the mirror
     of DERIVED_FROM_UNKNOWN, one grain down. Three sibling arrays joined by name
     is the shape `basis[]`/`grounds[]` already uses; an orphan in either of the
     two joined arrays is material the record would hold and never read. */
  VERSION_ORPHAN_ROW: {
    check: 'C-25.15',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_ORPHAN_ROW'),
  },
  /* PL-2 / IS-2 — THE SECOND ENFORCEMENT LAYER of §6 rule 4's reason rule, and
     it is here rather than only at the write op because VERIFICATION rule 3a
     requires an assertion at EACH place a rule is enforced, and because the two
     layers answer different questions. The write op refuses an ACT that carries
     no reason. This refuses a DOCUMENT that arrives already claiming a
     reason-bearing state with nothing behind it — which is the shape a hand-
     authored `bundle.md`, a replayed history, or a future writer would take, and
     none of those go through the op.

     BOTH LAYERS CALL `versionNeedsReason` AND NEITHER RE-TYPES THE SET. Two
     enforcement layers are what the rule requires; two IMPLEMENTATIONS of the
     membership test are what IS-6's C-22.4 control was absorbed by, so there is
     one predicate. */
  VERSION_DISPOSITION_UNATTRIBUTED: {
    check: 'C-25.19',
    where: GRAMMAR_WHERE,
    translation: word('refusal.VERSION_DISPOSITION_UNATTRIBUTED'),
  },
};

/* §6 rule 4's four states. Exported so IS-2's six member ops read the vocabulary
   from here rather than holding a second copy of it — the drift DEC-8 closed. */
export const VERSION_STATES = ['suggested', 'considering', 'accepted', 'rejected'];

/* ===================================================================
 * PL-2 / IS-2 — **THIS IS THE SIXTH STATE MACHINE IN THIS PLANE**, and
 * INVESTIGATIVE-SESSION.md §6 rule 4 says so in those words: *"This is a SIXTH
 * state machine and the design says so."* The five that already exist are the
 * five keys of `STATES` (record-grammar's: information, inquiry and its two legacy
 * spellings, action, project); task states and proposal dispositions are
 * DIFFERENT vocabularies belonging to different objects, and nothing existing is
 * this machine (SWEEP §1.4). It was stated in the catalogue that defined the
 * other five and moved here with this machine, so a reader counting state
 * machines counts six.
 *
 * IT IS DELIBERATELY NOT A SIXTH KEY OF `STATES`. `STATES` is keyed by
 * OBJECT_TYPE and consulted through `vocabFor` over a document's DECLARED type;
 * a basis version is not an object type, has no bundle id, and is never the
 * subject of `checkStateLegality`. Adding it there would make `vocabFor` answer
 * this machine for a document whose type happened to collide, and would put a
 * version's states into every sweep that enumerates the object machines. One
 * table, its own name, imported by everything that needs it.
 *
 * THE EDGES, and each one is a member act (§6 rule 4, second bullet):
 *
 *   suggested   -> considering | accepted | rejected
 *   considering -> suggested   | accepted | rejected
 *   accepted    -> considering | rejected
 *   rejected    -> suggested   | considering | accepted
 *
 * WHY `accepted -> suggested` IS ABSENT while every other reversal is present.
 * §6 rule 4 is explicit that *"`considering` and `rejected` are reversible, the
 * states are not a one-way ladder"*, and rule 5 is equally explicit that
 * *"accepted is a HISTORICAL FACT — this version was accepted, on this date, by
 * this member"* and that *"a version accepted in error is REJECTED, which is a
 * different and rarer act than being superseded"*. Returning an accepted version
 * to `suggested` would say nobody had ever acted on it, which is the one thing
 * the record knows to be false. So the way back from `accepted` is through an
 * act that is itself recorded — rejecting it, or putting it back under
 * consideration — and never through an erasure.
 *
 * A version that stops being CURRENT does not move in this machine at all: it
 * stays accepted, because it honestly was (§6 rule 5). Current is a property of
 * the PROJECT's relationship to the inquiry (§7) and is not a state here.
 */
export const VERSION_MACHINE = {
  legal: VERSION_STATES,
  edges: {
    suggested:   ['considering', 'accepted', 'rejected'],
    considering: ['suggested', 'accepted', 'rejected'],
    accepted:    ['considering', 'rejected'],
    rejected:    ['suggested', 'considering', 'accepted'],
  },
};

/* §6 rule 4, first bullet: a machine-written version is a PROPOSAL and inherits
   the interaction-construct's proposal rules — *"it is adopted, deferred WITH a
   recorded reason, or dismissed WITH a recorded reason"*. The three constructs
   map onto three of the six ops and the mapping is stated rather than implied:
   ADOPT is `accept`, DEFER is `consider` (the member has not decided and is
   saying so on the record), DISMISS is `reject`. So the two reason-bearing
   target states are `considering` and `rejected`, and this array is the ONE
   place that says which they are.

   Rule 4's second bullet raises `rejected` above the construct's floor —
   *"rejection at minimum carries an authored reason — the rejection record is
   the anti-omission instrument, and it is worthless without one"* — which is why
   the requirement is enforced at two layers (the write op and the catalog) and
   why VERIFICATION rule 3a then owes an assertion at EACH of them.

   ONE PREDICATE AND ONE ARRAY, never a second copy of the membership test: IS-6's
   C-22.4 control left its suite green at 98/98 because a rule had two
   implementations and removing either left the other absorbing the control. The
   six acts (`./index.mjs`) import `versionNeedsReason`; the grammar
   (`./grammar.mjs`) calls it; there is no third spelling. */
export const VERSION_REASON_REQUIRED = ['considering', 'rejected'];
export const versionNeedsReason = (to) => VERSION_REASON_REQUIRED.includes(to);

/* The two ways a composition can compose, and DEC-32's own words for them. NOT a
   surface vocabulary: DEC-32's elicitation clause 1 bans "ground partition" and
   the AND/OR words from every member-facing screen (D-226), which is why every
   translation in BASIS_VERSION_GRAMMAR_CHECKS above says "every part is needed" and
   "would carry the answer on its own" instead. */
export const VERSION_RELATIONSHIPS = ['and', 'or'];
/* Wider than GROUND_LABEL_RE by design: a member names a version and will use a
   full stop. Still bounded, still a single line, still no leading space. */
export const VERSION_NAME_RE = /^[a-z0-9][a-z0-9 ._-]{0,63}$/i;

/* Section 9's five kinds. A suggestion is one of these and nothing else, and
   the table is here rather than in the store because two things read it: the
   endpoint, which refuses an unknown kind, and `basisVersionFindings`, which
   refuses a DOCUMENT carrying one. One table, no second spelling.

   EVERY KIND WRITES THE SAME OBJECT — a version in state `suggested` carrying
   its run — and that is section 10's ruling rather than a simplification here:
   *"Export means the AI adds a new version to the inquiry being investigated"*,
   so both modes use ONE write path and the fence needs no second design. What
   differs between the kinds is what the version SAYS, which is why the kind is
   a field on the version and not a second endpoint. */
export const SUGGEST_KINDS = {
  'basis-version': localize('basis-version-grammar.checks.suggest_kind_basis_version', 'a new version of the inquiry\'s basis — the main output: a complete alternative composition with its legs, its branches and its description (section 6)'),
  'sharpen-question': localize('basis-version-grammar.checks.suggest_kind_sharpen_question', 'the inquiry asks two questions that need different evidence; here they are separated (section 8). The separation is carried as the version\'s claim'),
  'new-inquiry': localize('basis-version-grammar.checks.suggest_kind_new_inquiry', 'a proposition answering the question, with the first version of its basis (section 8, under section 3\'s basis ruling)'),
  'level-empty': localize('basis-version-grammar.checks.suggest_kind_level_empty', 'we looked at this level — meaning, content, documents, or the open internet — and it is empty, with the observation-log address of the search that establishes it. Without this kind a run that honestly found nothing supportable is indistinguishable from a run that emitted nothing (SWEEP section 6), and section 15\'s empty-run instrument has no object to count'),
  'new-edition': localize('basis-version-grammar.checks.suggest_kind_new_edition', 'evidence bearing on a PUBLISHED finding. A published case cannot be changed, so the only act available is a new edition, and it is the member\'s'),
};

/* C-27.15, the one row of the catalogue's `SUGGEST_CHECKS` this module raises (R1): the kind a DOCUMENT carries, checked
   by the grammar at both gates. The rest of C-27 is the suggest endpoint's, run-productions'. */
export const VERSION_KIND_CHECKS = {
  /* ---- the grammar's own row, fired from `basisVersionFindings` at both
     gates. A DOCUMENT can carry a kind without ever passing through the
     endpoint — a hand-authored file, a replayed revision, a future writer — and
     none of those go through the op, which is the same two-layer reasoning
     C-25.19 records one family up. ---- */
  VERSION_KIND_UNKNOWN: {
    check: 'C-27.15',
    where: GRAMMAR_WHERE,
    translation: localize('basis-versions.checks.this_reading_says_it_is', 'This reading says it is a kind of suggestion nobody recognises. The kinds are a closed set because what a suggestion CLAIMS to be decides how it is read, and a kind outside the set is a claim with nothing behind it.'),
  },
};
