/* case-catalogue — the case-document catalogue (C-41.1–C-41.19, with the case arms of C-2.8, C-3.1 and C-21.1) and
 * C-2.8's case-member arm (requirements: `build/requirements/case-catalogue.md`, R1–R5). Pure: it reads no table,
 * writes nothing and registers nothing; `ratification` registers `checkCaseDocument` and `checkPublishedExtension` with
 * `promotion`, runs them at its gates and re-exports every name here.
 *
 * Copied from `ratification/checks.mjs` (K617, K624 (1), K1824; seam read `build/extraction/ratification-split.md`)
 * with every name, id, message and translation unchanged: `caseEditionClaimed`, `isCaseMemberBytes` (record-grammar
 * keeps its own copy for C-3.1's heading rule, N69; Decided 3), `SUBJECT_POSITIONS`, `CASE_MEMBER_ROLES`,
 * `biasAcknowledgementOf`, `completenessFields`, `checkPublishedExtension` (C-2.8's case-member arm) and its three
 * runners (R2); `SEARCHED_SUBJECT_SOURCES`, `CASE_DOCUMENT_FAMILY` (C-41.1–C-41.19), `CASE_CITATION_VERSIONS`,
 * `checkCaseDocument` (R1, R3). The case-document formats and their three predicates are `case-grammar`'s (its R1).
 * The legacy code's comments moved with it. */

import { ISO_TS_RE, BUNDLE_ID_RE, BASIS_GRADES, GRADE_AXES } from "../record-grammar/index.mjs";
/* K1317: the pure spellings (strength's arithmetic, case-grammar R1), never the store-bound index files, so the
   standalone checker (case-checker R13) bundles only pure code. */
import { STRENGTH_STATES } from "../strength/arithmetic.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMATS_ACCEPTED,
         caseDocumentStatesMemberBlocks, caseDocumentRequiresDisclosures, caseDocumentRequiresV4Disclosures,
         whatChangedOf, isNoticeReference, WORKING_ON_KEY,
         caseDocumentStatesUngradedAndTyped, ungradedPassagesOf, typedPassagesOf, passagesOf, gradingFactsOf,
         ATTRIBUTION_LEVELS } from "../case-grammar/index.mjs";
/* R8 (A58, K1317): text-chain's pure `typedStepOf`; its file imports only record-grammar and setup-words. */
import { typedStepOf } from "../textchain.mjs";
import { localize } from '../setup-words/index.mjs';

/* The catalogue's finding shape (`{check, severity, message, repairable?, repairs?, code?}`), so a finding from here
   reads exactly as one from the record's grammars (`record-grammar` R11). */
function f(check, severity, message, repairs, code) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}

/* ===========================================================================
 * THE CASE RELATION IN A DOCUMENT'S OWN BYTES, AND THE CASE-MEMBER ARM OF C-2.8 (R2)
 * ========================================================================= */

/** CASE-4 / DEC-72: THE CASE RELATION AS A DOCUMENT'S OWN BYTES CARRY IT.
 *
 * One predicate, exported, so the catalog's several "is this published" sites
 * cannot drift apart — the same reason DISPOSITIONS and REOPENABLE_FROM live in
 * one array each. `case_id` is the field REC-44 put inside the bytes the member
 * SIGNS precisely so a stranger holding one document can read which case it
 * belongs to without contacting this instance, which is what makes it the right
 * field to ask: the relation is inside the signature, exactly as the state word
 * used to be, and nothing here reads a table.
 *
 * The `'null'` guard is not decoration: `#setOrAddScalar` writes the STRING
 * "null" for an absent value, and `case-authoring`'s `publishCase` excludes it
 * by name in its own case-identity resolution. Two readers of one convention that
 * disagreed about it would be the drift this file exists to prevent.
 *
 * IT IS THE PAIR AND NOT `case_id` ALONE, AND THAT WAS MEASURED RATHER THAN
 * preferred. `case_id` alone is what a document carries FOREVER after its first
 * publication — `op=reopen` deliberately leaves it, so `publishCase()` can
 * re-derive which case a second edition belongs to without taking an identity
 * from a caller. Keying on it alone therefore makes a REOPENED working document
 * read as a case member and drags the entire published ceremony onto a document
 * that is back in `open` being worked — a gate firing where the record says the
 * group is allowed to be mid-thought. The pair is the assertion: `case_edition`
 * is written by `publishCase()` and CLEARED by `op=reopen`, so "these bytes
 * claim to be a member of a specific edition of a specific case" is exactly what
 * the two of them together say, and it is true of precisely the documents that
 * used to say `current_state: published`.
 *
 * WHEN CASE-5b LANDS, THIS IS THE FIELD PAIR THAT MOVES. CASE-5b removes
 * `case_id` and friends from finding bytes once there is a case-level signing
 * ceremony for those facts to move to. This predicate is where that change
 * arrives, and it is ONE function rather than six inlined field reads for that
 * reason. */
/* CASE-5b / DEC-72, 2026-09-10 — AND THIS IS THE CHANGE THE COMMENT ABOVE SAID
 * WOULD ARRIVE HERE, ARRIVING. It is ONE function and not six inlined field
 * reads for exactly this turn.
 *
 * WHY THE OLD PREDICATE WAS RIGHT AND IS NOW WRONG, stated rather than deleted.
 * It keyed on `(case_id, case_edition)` because those were the facts op=publish
 * stamped into every member's signed bytes, and because a REOPENED document
 * keeps `case_id` while losing `case_edition` — so the PAIR, and not `case_id`
 * alone, was what distinguished "these bytes claim membership of a specific
 * edition of a specific case" from "this document was published once and is
 * back in `open` being worked". Every word of that was true of the format as it
 * stood. CASE-5b deletes both fields from finding bytes: the case's own
 * assertions now live in a CASE DOCUMENT a member signs, which is where they
 * were always supposed to be and had nowhere to go until this item. A predicate
 * left keyed on `case_id` would be false for EVERY document published after
 * this item — and since it is the entry condition to the whole published
 * ceremony, the ceremony would stop being checked on every document, silently,
 * with the suite green. That is the same trap CASE-4 recorded one field
 * earlier, and it is why this is corrected rather than removed.
 *
 * THE NEW SIGNAL IS `published_strength`, AND IT IS NOT AN ARBITRARY PICK. It
 * is the FROZEN PAIR (R2/DEC-21) — both axis objects, derived at the publishing
 * act from the finding's own basis and stamped into the bytes before the sha is
 * taken. Three properties make it the right field:
 *   - op=publish is the ONLY writer. Nothing else in this plane mints it, so a
 *     document carrying it was published, which is precisely the question.
 *   - it is the FINDING's OWN fact, not the case's. That matters now: every
 *     case-level fact has left these bytes, so a predicate keyed on one would
 *     be keyed on something that is no longer here.
 *   - `op=reopen` clears it with the rest of the publication stamp, so the
 *     reopened-document hole the old pair was built to close stays closed. That
 *     was asserted rather than assumed, by the old suite's reopen arm (`op=reopen`
 *     is not this module's, and no test of this module drives it).
 * The shape is checked, not merely the presence: an array of at least the two
 * axes R2 requires (three when a member's testimony is frozen, MK-2), which
 * checkPublishedExtension goes on to validate in detail, so a stray
 * `published_strength: []` does not drag a working document into the ceremony. */
export const caseEditionClaimed = (fm) => {
  const e = fm?.case_edition;
  return !(e === undefined || e === null || e === '' || e === 'null');
};
/* CORRECTED BY MK-2 (IC-142), never exempted, AND IT IS THE MOST DANGEROUS LINE
   IN THAT ITEM — found by its own control arm, not by reading. This read
   `s.length === 2`, which was "the frozen PAIR" while there were two axes. A case
   member resting on a member's testimony freezes THREE rows (the testimony axis
   beside capture and connection), and under the old predicate it stopped being a
   case member at all: checkPublishedExtension never ran over it and op=ratify
   would have read it as an ordinary inquiry — the ceremony silently unchecked,
   with every assertion about it passing over nothing. The measured symptom was a
   frozen block carrying an axis this record does not measure and drawing no
   finding. So the predicate asks what it always meant — a NON-TRIVIAL frozen
   array of axis objects, which a stray `published_strength: []` still is not —
   and leaves WHICH axes, and how many, to checkPublishedExtension, which refuses
   anything but capture and connection once each and testimony at most once. It
   FAILS CLOSED: a malformed frozen block is dragged into the ceremony and
   refused there, rather than let out of it. */
export const isCaseMemberBytes = (fm) => {
  const s = fm?.published_strength;
  return Array.isArray(s) && s.length >= 2
    && s.every((a) => a && typeof a === 'object' && typeof a.axis === 'string');
};

/** REC-14 / DEC-13: the group's position on putting the case to its subject.
 *  EXPORTED so op=affordances publishes it and no surface keeps a copy.
 *  The gate is that the position is declared and justified; WHICH position it
 *  is gates nothing, here or anywhere — a group facing a non-supportive body
 *  may have real cause not to give notice, and what is refused is being silent
 *  about having chosen. */
export const SUBJECT_POSITIONS = ['sought_and_answered', 'sought_no_answer', 'not_sought'];

/** CASE-2 / DEC-72 clause 4: the two designations a case member can carry.
 *  EXPORTED for SUBJECT_POSITIONS' own reason — op=affordances publishes the
 *  vocabulary and no surface keeps a copy, so CASE-6's ceremony renders the two
 *  terms the gate actually accepts rather than a third spelling of them.
 *
 *  THE SPELLING IS THE SCHEMA'S. CASE-1 fixed it on
 *  `published_case_members.role` and said in the column's own comment that it
 *  was fixed there "so CASE-2 and CASE-6 do not each invent a third". This is
 *  that spelling consumed; `case-authoring`'s `MEMBER_ROLES` (once `store.mjs`'s
 *  `Store.MEMBER_ROLES`) is the same list. The old suite asserted all three agreed
 *  by PARSING the schema rather than by restating it, because a vocabulary written
 *  three times is one that drifts; this module's R1 and R2 tests pin the two terms
 *  and that C-41.8 admits exactly them. */
export const CASE_MEMBER_ROLES = ['load_bearing', 'supporting'];

/** REC-14: the three ASSERTED fields of a completeness block, in one place so
 *  the gate (C-21.1), the store's own pre-flight and the frozen projection all
 *  compare the same thing.
 *
 *  `author` and `at` are deliberately NOT here. They are STAMPS: `at` is the
 *  server's clock and always differs, so comparing it is an equality that costs
 *  nothing to produce, and `author` may legitimately be the same member twice —
 *  requiring it to change would be requiring a different person to sign the
 *  next edition. `subject_position` is not here either: it is a vocabulary
 *  choice, and a group whose position has not changed must not be pushed into
 *  changing it. What must be authored FRESH is what is ASSERTED — the
 *  statement, the justification for the position, and the exclusion list. */
/** REC-47 / DEC-46 (a): the AUTHORED bias acknowledgement, read off the
 *  frontmatter exactly as completenessFields reads its three. Named once and
 *  exported so the store's pre-flight, the gate and the ratify-commit path
 *  cannot drift about which bytes are being compared — the drift hazard REC-44
 *  measured five times over. */
export function biasAcknowledgementOf(fm) {
  const v = fm && typeof fm.bias_acknowledgement === 'string' ? fm.bias_acknowledgement : null;
  return v === null || v === 'null' ? null : v;
}

export function completenessFields(fm) {
  const c = (fm && typeof fm.completeness === 'object' && fm.completeness) || {};
  const rows = Array.isArray(fm?.completeness_excluded) ? fm.completeness_excluded : [];
  return {
    statement: typeof c.statement === 'string' ? c.statement : null,
    subject_justification: typeof c.subject_justification === 'string' ? c.subject_justification : null,
    excluded: JSON.stringify(rows.map((r) => [
      r && typeof r.target === 'string' ? r.target : null,
      r && typeof r.description === 'string' ? r.description : '',
      r && typeof r.reason === 'string' ? r.reason : ''])),
  };
}

export function checkPublishedExtension(fm, findings) {
  const e = fm.edition;
  if (!Number.isInteger(e) || e < 1) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_an', 'a case member requires an integer edition of 1 or more (got \'{e}\'): an edition is what makes a revision safe — edition 2 does not overwrite edition 1, it joins it (DEC-12)', { e: String(e) }),
      [localize('case-catalogue.checks.publish_through_op_publish_which_stamps', 'publish through op=publish, which stamps the edition from the published record')]));
  }
  const c = (typeof fm.completeness === 'object' && fm.completeness) || null;
  if (!c) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_a_completeness', 'a case member requires a completeness block: a case that says nothing about what it does not cover is claiming to cover everything'),
      /* REC-56 / D-203's sweep, fourth site, and this one had a REACHABLE act
         available that the old string did not name. `published: ['open',
         'surfaced']` — `published -> concluded` is NOT an edge, so "move the
         inquiry back to concluded" fires C-4.2. What IS reachable is the full
         ceremony the STATES table's own comment describes, and `op=reopen` DOES
         apply, precisely so a legal edge is not left with no caller. So the
         correction here names an act rather than only refusing one.
         CORRECTED AGAIN 2026-09-10 (CASE-4 / DEC-72), never exempted, AND THE
         EDGE IS WHAT MOVED — not the advice. The route was `published -> open`
         because a case member wore `published`; DEC-72 ends that state, a member
         sits at `concluded`, and the ceremony is now `concluded -> open ->
         concluded` with a new edition published from there. `op=reopen` still
         applies, for the same reason it always did: its gate is now "a
         disposition OR a case member", so a case member reopens and a concluded
         finding in no case is still refused NOT_SET_DOWN. REC-56's whole point is
         that a repair string must name a route that EXISTS, and the old
         `repair-reachability.test.mjs` was the instrument that caught one that
         stopped existing — which is exactly how this line was found. */
      [localize('case-catalogue.checks.author_completeness_statement_and_exclusion', 'author completeness.statement and the exclusion list'),
       localize('case-catalogue.checks.reopen_this_case_for_second_edition', 'or reopen this case for a second edition (concluded -> open, op=reopen) and carry it back through conclude and publish: an edition is not edited back into concluded, and reopening does not unpublish edition 1 (DEC-12, DEC-72)')]));
  } else {
    if (typeof c.statement !== 'string' || c.statement.trim() === '') {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_a_non_empty', 'a case member requires a non-empty completeness.statement')));
    }
    if (typeof c.author !== 'string' || c.author.trim() === '') {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_completeness_author', 'a case member requires completeness.author: the completeness assertion is a named member\'s claim about the limits of this case')));
    }
    if (!ISO_TS_RE.test(String(c.at || ''))) {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_completeness', 'a case member requires completeness.at as an ISO timestamp (got \'{at}\')', { at: String(c.at) })));
    }
    /* DEC-13. The gate is the DECLARATION, never the act: every position below
       passes, and nothing reads which one it is. */
    if (!SUBJECT_POSITIONS.includes(c.subject_position)) {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_completeness_2', 'a case member requires completeness.subject_position, one of: {SUBJECT_POSITIONS} (got \'{subject_position}\'). The gate is that the position is declared and justified — never that contact happened, and never that the answer was favourable (DEC-13)', { SUBJECT_POSITIONS: String(SUBJECT_POSITIONS.join(', ')), subject_position: String(c.subject_position) }),
        [localize('case-catalogue.checks.declare_team_position_on_putting', 'declare the team\'s position on putting this case to its subject')]));
    }
    if (typeof c.subject_justification !== 'string' || c.subject_justification.trim() === '') {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_completeness_subject_justification', 'a case member requires completeness.subject_justification: a declared position with no reasoning behind it is the checkbox this gate exists to refuse. A team that sought comment says so and prints what came back; a team that deliberately did not says so and says why, and a reader weighs that justification exactly as they weigh any other declared bias (DEC-13)'),
        [localize('case-catalogue.checks.justify_position_including_deliberate', 'justify the position — including a deliberate decision not to give notice')]));
    }
  }
  /* REC-44 / DEC-44: THE CASE THIS FINDING WAS PUBLISHED IN, in the bytes the
     member signs. All three are required on `published`, and each closes a
     different hole:
       case_id        without it a published finding names no case, so C-21.1
                      has nothing to be fresh against and the container has no
                      identity to be an edition OF.
       case_scope     DEC-44 determination 2. AUTHORED and never prefilled —
                      this is the arm that fits the claim, since a scope may
                      legitimately be unchanged between editions and a
                      byte-check on it would pressure a member into inventing a
                      difference (see checkCompletenessFreshness).
       case_findings  DEC-44 determination 3. The roster is inside every
                      member's own signed bytes, so a stranger holding ONE
                      finding can see what else the case rests on, and the
                      ratify committer can refuse two members who disagree
                      about the set instead of silently reconciling them.

     REC-47 / DEC-46 (a) adds a FOURTH, `bias_acknowledgement`, and it is the
     one whose arm differs from case_scope's: it is required here AND it is
     under C-21.1's byte-check. Why, when scope beside it is not, is recorded
     once at checkCompletenessFreshness rather than twice. */
  /* CASE-4 / DEC-72, 2026-09-10: THE `case_id` ARM IS NOW THE ENTRY CONDITION
     ITSELF AND IS THEREFORE UNREACHABLE FROM HERE — SAID OUT LOUD RATHER THAN
     DELETED IN SILENCE, because "this cannot fire" and "nobody checked" look
     identical in a diff. Until this item, this function was entered on
     `current_state === 'published'` and `case_id` was one of the facts such a
     document had to carry; a published finding naming no case was a real,
     reachable shape. DEC-72 makes the case relation the condition, so
     `isCaseMemberBytes(fm)` is exactly this predicate and a document that fails
     it never arrives here — the refusal has not been lifted, it has become the
     door. The requirement is UNCHANGED and is now enforced one line earlier and
     for every document rather than only for documents wearing a state word.
     THE ONE THING THAT WOULD MAKE IT REACHABLE AGAIN is CASE-5b removing
     `case_id` from finding bytes; at that point this function's entry condition
     moves to whatever the case-level signed document offers, and this arm moves
     with it. Kept as a comment and not as dead code: an `if` that can never be
     true is a rule nobody is enforcing wearing the costume of one. */

  /* ===== CASE-5b / DEC-72: SIX ARMS LEFT THIS FUNCTION, AND THEY LEFT TOGETHER
     BECAUSE THEY ARE ONE QUESTION ASKED AT THE WRONG ALTITUDE. ================

     `case_scope`, `case_edition`, `case_project`, `case_findings`, `case_roles`
     and `bias_acknowledgement` were all required HERE, of every member, because
     every member's bytes carried them. They are not facts about a finding. They
     are facts about a CASE, and they were in a finding's gate only because a
     finding's signature was the only signature there was.

     THEY ARE NOT DELETED. Every one of them is now an arm of
     `checkCaseDocument` below, asked ONCE of the document a member actually
     signs for the case — same requirement, same refusal text where the text was
     already right, one altitude up. **Moving a check is the shape a lost check
     wears**, so this module's R1 test (`test/m/case-catalogue/checks.test.mjs`)
     asserts each arm by its declared id, firing on its own mutation, and that the
     arms cover the family exactly, rather than counting them.

     WHAT STAYED HERE IS WHAT IS GENUINELY THE FINDING'S: its completeness block,
     its exclusion list, its own frozen strength pair and its frozen grounds. A
     reader of these bytes is still told everything about THIS document that the
     ceremony ever told them. What they are no longer told N times is what the
     case as a whole asserted — for which they read the case document, whose
     signature covers it. ===================================================== */
  /* C-9. The FIELD may not be absent; the LIST may legitimately be empty. */
  if (!Array.isArray(fm.completeness_excluded)) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_completeness_excluded', 'a case member requires a completeness_excluded field: an EMPTY list is a claim (this case left nothing out) and is legal — an ABSENT field is silence, and silence about what a case excludes is what the completeness assertion exists to refuse'),
      [localize('case-catalogue.checks.author_completeness_excluded_empty_if', 'author completeness_excluded, empty if nothing was excluded')]));
  } else {
    fm.completeness_excluded.forEach((r, i) => {
      if (!r || typeof r !== 'object') {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.completeness_excluded_i_is_not', 'completeness_excluded[{i}] is not an object', { i: String(i) })));
        return;
      }
      const named = typeof r.target === 'string' && BUNDLE_ID_RE.test(r.target);
      const prose = typeof r.description === 'string' && r.description.trim() !== '';
      /* RECONCILED C-9: target OR prose, NEVER NEITHER. An exclusion may
         legitimately name something not in the record — an outstanding records
         request has no id to point at — so a required target would force the
         member to invent a referent or to say nothing. */
      if (!named && !prose) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.completeness_excluded_i_names_neither', 'completeness_excluded[{i}] names neither a target nor a description: every exclusion row carries a target id OR prose, never neither', { i: String(i) }),
          [localize('case-catalogue.checks.name_the_excluded_record_by_id', 'name the excluded record by id'), localize('case-catalogue.checks.or_describe_what_was_excluded_in', 'or describe what was excluded in prose')]));
      }
      if (typeof r.reason !== 'string' || r.reason.trim() === '') {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.completeness_excluded_i_carries_no', 'completeness_excluded[{i}] carries no reason: WHAT was left out and WHY are two statements and one does not stand in for the other', { i: String(i) })));
      }
    });
  }
  /* R2/DEC-21: BOTH axis objects, frozen, and never composed into one letter.
     The STATE is what keeps `unrated` (nothing on this axis is graded)
     distinguishable from `undetermined` (the walk hit its depth bound) — two
     different frozen facts that a single nullable grade could not tell apart,
     and C-21.2 compares against the right one. */
  /* MK-2 / IC-142: A THIRD AXIS, FROZEN ONLY WHEN IT CARRIES SOMETHING.
     capture and connection are REQUIRED exactly once each, as they always were.
     `testimony` is admitted at most once and is REQUIRED when a leg of this
     basis carries a testimony grade — the case then rests on a member's word
     and the frozen bytes must say at what. When nothing in the basis is
     testimony the row is ABSENT, and that is not an omission: every case
     frozen before this axis existed reads exactly that way and means exactly
     "rests on no testimony", so stamping an UNRATED testimony row on new ones
     would be a second spelling of the same fact across one corpus (D-21) — and
     would move the signed bytes of every ordinary case for no new information.
     The case's GRADED testimony axis can also arrive through a cited inquiry
     rather than a direct leg; `op=publish` freezes it from the derivation in
     that case too, and this arm checks what the document alone can see. */
  const axes = Array.isArray(fm.published_strength) ? fm.published_strength : null;
  const axisCount = (a) => (axes || []).filter((x) => x && x.axis === a).length;
  const testimonyLeg = Array.isArray(fm.basis) && fm.basis.some((l) => l && typeof l === 'object'
    && l.grade_axis === 'testimony' && l.grade !== undefined && l.grade !== null);
  if (!axes || axisCount('capture') !== 1 || axisCount('connection') !== 1
      || axisCount('testimony') > 1
      || axes.some((x) => !x || !GRADE_AXES.includes(x.axis))) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_published', 'a case member requires published_strength carrying BOTH axes, capture and connection, once each, and nothing but the axes this record measures ({GRADE_AXES}): a case does not have "a strength", it has one per axis, and composing them into one letter is the substitution R2 forbids', { GRADE_AXES: String(GRADE_AXES.join(', ')) }),
      [localize('case-catalogue.checks.publish_through_op_publish_which_stamps_frozen', 'publish through op=publish, which stamps the frozen axis objects into the bytes')]));
  } else if (testimonyLeg && axisCount('testimony') !== 1) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_whose_basis_carries', 'a case member whose basis carries a testimony grade requires a published_strength row for the testimony axis: the case rests on a member\'s word, and the frozen bytes must say at what, beside the capture and connection axes and never folded into either'),
      [localize('case-catalogue.checks.publish_through_op_publish_which_freezes_testimony', 'publish through op=publish, which freezes the testimony axis whenever it carries anything')],
      'testimony-axis-unfrozen'));
  } else {
    for (const a of axes) {
      if (!STRENGTH_STATES.includes(a.state)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_axis_state_state', 'published_strength.{axis} state \'{state}\' is not one of: {STRENGTH_STATES}', { axis: String(a.axis), state: String(a.state), STRENGTH_STATES: String(STRENGTH_STATES.join(', ')) })));
      } else if (a.state === 'graded' && !BASIS_GRADES.includes(a.grade)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_axis_is_graded', 'published_strength.{axis} is graded but carries no grade', { axis: String(a.axis) })));
      } else if (a.state !== 'graded' && a.grade != null) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_axis_is_state', 'published_strength.{axis} is {state} and still carries grade \'{grade}\': {v1}', { axis: String(a.axis), state: String(a.state), grade: String(a.grade), v1: String(a.state === 'unrated' ? localize('case-catalogue.checks.unrated_is_not_a_low', 'UNRATED is not a low score, it is nothing established on this axis') : localize('case-catalogue.checks.undetermined_is_what_we_do', 'undetermined is what we do not know, not a grade')) })));
      }
    }
  }
  /* REC-42 / DEC-32 clause (e): IF THE BASIS WAS STRUCTURED, THE FROZEN RESULT
     IS THE STRUCTURED ONE. A published case whose legs name grounds took a
     MAXIMUM over branches to reach the grade above, and that claim is only
     checkable by a reader if the bytes say which branch reached what. Absent
     here is not silence, it is the structure being invisible under a grade the
     structure produced — so it is refused, with the same reasoning that makes
     completeness_excluded's FIELD required even when the list is empty.
     Not required when nothing was grouped: an unstructured case's two axis
     objects already are the whole truth, and a one-row restatement would be a
     second place to state one fact (D-21). */
  /* R2 (fix round 10, cause 31): only LIVE legs count, as `strength` counts them. A leg whose citation edge the member's
     references[] marks severed (the first entry for a target decides) is dropped from the strength walk, so a ground
     whose every leg is severed has no frozen row and is none to ask for. */
  const severed = new Set();
  const seenRef = new Set();
  for (const x of Array.isArray(fm.references) ? fm.references : []) {
    if (!x || typeof x !== 'object' || seenRef.has(x.target)) continue;
    seenRef.add(x.target);
    if (x.status === 'severed') severed.add(x.target);
  }
  const liveLegs = Array.isArray(fm.basis) ? fm.basis.filter((l) => !(l && severed.has(l.target))) : [];
  const grouped = liveLegs.some((l) => l && typeof l === 'object' && typeof l.ground === 'string' && l.ground !== '');
  const frozenGrounds = Array.isArray(fm.published_strength_grounds) ? fm.published_strength_grounds : null;
  if (grouped && !frozenGrounds) {
    findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_member_requires_published_grounds', 'a case member requires published_strength_grounds when the basis names grounds: the grade above is the STRONGEST ground rather than the weakest leg, and "these grounds were each independently sufficient" is a claim a reader can only test if the case says which legs were in which branch and what each branch reached'),
      [localize('case-catalogue.checks.publish_through_op_publish_which_freezes_per', 'publish through op=publish, which freezes the per-ground breakdown beside the pair')]));
  } else if (grouped) {
    for (let i = 0; i < frozenGrounds.length; i++) {
      const g = frozenGrounds[i];
      if (!g || typeof g !== 'object') {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_i_is', 'published_strength_grounds[{i}] is not an object', { i: String(i) })));
        continue;
      }
      if (!GRADE_AXES.includes(g.axis)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_i_axis', 'published_strength_grounds[{i}].axis \'{axis}\' is not one of: {GRADE_AXES} — the branches are composed PER AXIS and both axes are frozen separately (DEC-21)', { i: String(i), axis: String(g.axis), GRADE_AXES: String(GRADE_AXES.join(', ')) })));
      }
      if (!STRENGTH_STATES.includes(g.state)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_i_state', 'published_strength_grounds[{i}].state \'{state}\' is not one of: {STRENGTH_STATES}', { i: String(i), state: String(g.state), STRENGTH_STATES: String(STRENGTH_STATES.join(', ')) })));
      } else if (g.state === 'graded' && !BASIS_GRADES.includes(g.grade)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_i_is_2', 'published_strength_grounds[{i}] is graded but carries no grade', { i: String(i) })));
      } else if (g.state !== 'graded' && g.grade != null) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_i_is_3', 'published_strength_grounds[{i}] is {state} and still carries grade \'{grade}\': a suspended ground states what is unknown, and an unrated one states that nothing on it is established — neither is a grade', { i: String(i), state: String(g.state), grade: String(g.grade) })));
      }
    }
    const liveGrounds = liveLegs.filter((l) => l && typeof l.ground === 'string' && l.ground);
    for (const label of new Set(liveGrounds.map((l) => l.ground))) {
      if (!frozenGrounds.some((g) => g && g.ground === label)) {
        findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.published_strength_grounds_names_no', 'published_strength_grounds names no row for ground \'{label}\': every branch the basis carries is frozen on every axis, because a branch missing from the frozen result is one no reader can check', { label: String(label) })));
      }
    }
  }
  /* CASE-5b: A SEVENTH ARM LEFT WITH THE OTHER SIX, AND IT WAS THE LAST CASE
     FACT STILL BEING ASKED OF A FINDING. `required_strength` is the BAR, and
     DEC-72 clause 2 is unambiguous that a bar is a property of the PROJECT told
     to the publishing act — so it is the CASE's, not any member's. It was here
     because it was in a member's bytes, and it was in a member's bytes because
     that is where the signature was. The arm is `C-41.12` now, with the
     "an ABSENT bar is STATED as absent rather than shown as blank" requirement
     carried word for word, plus the per-axis grade check below it. */
}

/* ===========================================================================
 * THE CASE-DOCUMENT CATALOGUE, C-41 (R1, R3)
 * ========================================================================= */

/* REC-96 / D-196 / IC-112 — WHERE A CASE'S `searched` SECTION GOT ITS SUBJECTS,
   AND THE VOCABULARY IS THE FENCE RATHER THAN A LABEL.

   WHAT A LIAR WOULD DO, STATED BEFORE WHAT THIS CHECKS. The cheapest way to make
   a coverage section green is not to forge a row — every row can be real and
   every number true. It is to choose the SUBJECT SET. Compute the section over
   *every subject the observation log holds a row for* and the answer is 100%
   searched BY CONSTRUCTION, and it is a statement about the log rather than about
   the case. That is D-196's own ancestor: Blair & Maron's attorneys stipulated
   they must reach 75% recall and sincerely believed they had; measured recall was
   ~20%, because what they measured was not what they claimed.

   SO THE SOURCE IS DECLARED IN THE SIGNED BYTES AND CHECKED AT THE GATE. The
   observation log is deliberately NOT a member of this object — the same
   construction that keeps `member` out of `OBSERVATION_AUTHORITY_KINDS`, where a
   provisional is enforced by a vocabulary having no value for it rather than by a
   comment asking nicely. A document declaring a source this object does not name
   is refused by C-41.10, so the fence stands over bytes a stranger hands us and
   not only over the path that wrote them.

   IT LIVES HERE AND NOT BESIDE THE OBSERVATION LOG'S VOCABULARIES: this is the
   case document's vocabulary rather than the observation log's, qualifying a
   provenance claim in a signed artifact, beside `CASE_DOCUMENT_FORMAT` and
   `SUBJECT_POSITIONS`. (Provenance: it was first kept here because the legacy
   `airun.mjs`, since deleted with its re-export of it, imported this file, so a
   gate check there would have been a cycle.) `case-authoring`'s `searched.mjs`
   imports it from this module, the one place it is spelled. */
export const SEARCHED_SUBJECT_SOURCES = {
  case_basis: "the subjects were taken from the CASE -- its members' basis legs and the content "
            + "rows those legs name -- and the observation log was consulted only to ask what "
            + "became of each. The log never supplies the subject set; a section computed the "
            + "other way round is 100% searched by construction and says nothing about the case",
};

/* THE FAMILY, DECLARED — and it is a declaration rather than twelve string
   literals for two measured reasons rather than tidiness.

   (1) Provenance: the old process's `tools/mintid.mjs` (retired with `tools/` in
   T19) READ THIS FILE FOR THE `C` NAMESPACE'S FLOOR, and its allocation pattern
   was `check: 'C-n.m'`. A family that existed only as the first positional
   argument to `f()` was INVISIBLE to that pattern, so its number read as a
   MENTION — and `mintid.test.mjs` then failed `no live floor is driven by
   prose`, correctly, because a floor taken off a sentence is a floor a stray
   sentence can move. This was a blind spot this item TRIPPED rather than
   created: every gate check in this catalog is spelled `f('C-2.8', …)` and none
   of them was an allocation by that pattern either. What this item owed was that
   the family it MINTED be visible to the allocator that minted it, and that is
   what this table did; widening the pattern to see the other families was
   `tools/`' ground and was not taken here.

   (2) This module's R1 and R4 tests (`test/m/case-catalogue/checks.test.mjs`, and
   ratification's `converted-c.test.mjs` through its registration) assert every arm of the family by its declared id,
   each firing on its own mutation, and that the arms cover the family exactly;
   a declared family is what they assert against. Moving a check is the shape a
   lost check wears, so the move is checkable rather than described.

   NOT NAMED `*_CHECKS`: that suffix is RESERVED — the DEC-49 guard harvests every
   `/_CHECKS$/` export as a REFUSAL family, and these are GATE findings with no
   refusal code and no canned translation. A table named that way would grow a
   ratchet's floor falsely, which this estate has already paid for. */
export const CASE_DOCUMENT_FAMILY = {
  FORMAT:       { check: 'C-41.1',  what: 'the format token' },
  IDENTITY:     { check: 'C-41.2',  what: 'case_id, and that it is the case being ratified' },
  EDITION:      { check: 'C-41.3',  what: 'case_edition, and that it is the edition being ratified' },
  PROJECT:      { check: 'C-41.4',  what: 'case_project — whose production this is (DEC-72 clause 2)' },
  SCOPE:        { check: 'C-41.5',  what: 'case_scope — what the case is ABOUT (DEC-44 determination 2)' },
  BIAS:         { check: 'C-41.6',  what: 'bias_acknowledgement (REC-47 / DEC-46 (a))' },
  ROSTER:       { check: 'C-41.7',  what: 'case_findings — what the case rests on (DEC-44 determination 3)' },
  ROLES:        { check: 'C-41.8',  what: 'case_roles — the authored partition (DEC-72 clause 4)' },
  PINS:         { check: 'C-41.9',  what: 'the version hash per member (DEC-72 clause 3)' },
  COMPLETENESS: { check: 'C-41.10', what: 'the completeness block (REC-14)' },
  EXCLUDED:     { check: 'C-41.11', what: 'the exclusion list field (C-9)' },
  BAR:          { check: 'C-41.12', what: 'required_strength — the standard of evidence (DEC-17 as DEC-72 rehomes it)' },
  DISCLOSURES:  { check: 'C-41.13', what: 'bias_manifest, the statement\'s acknowledgement list and the statement\'s WRITER, required of a bio-case-document/3 or /4 (REC-188; the writer REC-212)' },
  /* REC-219: BOB #34 named this check C-41.13, which /3's obligation above already holds, so it takes
     the next free member of the family. */
  PENDING:      { check: 'C-41.14', what: 'the adoptions pinning a PROPOSED revision at signing, stated beside bias_manifest, required of a bio-case-document/4 (REC-219)' },
  /* REC-219 / D-579(a) (BOB #34, 2026-09-25 02:30Z): the case's citation edges, each pinned to the
     version it was made against — one more /4 obligation, riding the same bump. */
  CITATIONS:    { check: 'C-41.15', what: 'case_citations — each citation edge with the version it rests on, a pinned one naming its capture, required of a bio-case-document/4 (REC-219, D-579(a))' },
  /* DEC-101 (2), K1019: a new edition says what changed in it, read through case-grammar's `whatChangedOf` (its R8). */
  WHAT_CHANGED: { check: 'C-41.16', what: 'the "What changed" statement, required of every edition above 1 (DEC-101 (2))' },
  /* DEC-111, R3 (K1119): the project reference a case may carry, read by case-grammar's `isNoticeReference` (its R10). */
  WORKING_ON:   { check: 'C-41.17', what: 'working_on, when present, a notice id (DEC-111; case-grammar R10)' },
  /* R7 (T53; DEC-461): the passages a /10 document states it was published without a grade for (case-grammar R36). */
  UNGRADED_PASSAGES_MISMATCH: { check: 'C-41.18', what: 'ungraded_passages — exactly the relied-on passages whose grading-facts row shows no grade, of a /10 document (DEC-461; case-grammar R36)' },
  /* R8 (T53; DEC-464): the passages a member typed, with each credit as the member chose it (case-grammar R37). */
  TYPED_PASSAGES_MISMATCH:    { check: 'C-41.19', what: 'typed_passages — exactly the relied-on passages whose chain is typed, each credit within its level, of a /10 document (DEC-464; case-grammar R37)' },
};
/* REC-219 / D-579(a): the states a case document's citation edge may carry, and which name a capture. */
export const CASE_CITATION_VERSIONS = ['pinned', 'only_capture', 'undetermined', 'no_capture', 'no_bytes'];
const CITATION_NAMES_CAPTURE = new Set(['pinned', 'only_capture']);
const C41 = Object.fromEntries(
  Object.entries(CASE_DOCUMENT_FAMILY).map(([k, v]) => [k, v.check]));

export function checkCaseDocument(fm, ctx = {}) {
  const findings = [];
  const { caseId = null, edition = null, priorCase = null, body = null, memberBasis = null } = ctx;
  /* N538 (K1365 (1), K1367): the obligations below are named by the format the document DECLARES, never by the current
     one. `/7` is `/6` in every field and is read as `/6` (case-grammar R1), so a `/6` document's findings stay byte for
     byte what they were before T31 and a `/7` one's differ only in the token; a `/3`, `/4` or `/5` document is no longer
     told it is the current format. The arms are asked only of an accepted format (case-grammar's predicates). */
  const declared = String(fm?.format);

  /* D-442: an ACCEPTED SET, never a single value — the IC-166 precondition for the bump. */
  if (!CASE_DOCUMENT_FORMATS_ACCEPTED.includes(fm?.format)) {
    findings.push(f(C41.FORMAT, 'error', localize('case-catalogue.checks.a_case_document_declares_format', 'a case document declares format \'{CASE_DOCUMENT_FORMAT}\', or one of the earlier formats accepted as written ({map}) (got \'{format}\'): the format token is what lets a stranger holding these bytes know what they are reading and what rules they were made under, which is the same reason the container manifest carries one', { CASE_DOCUMENT_FORMAT: String(CASE_DOCUMENT_FORMAT), map: String(CASE_DOCUMENT_FORMATS_ACCEPTED.filter((x) => x !== CASE_DOCUMENT_FORMAT).map((x) => `'${x}'`).join(', ')), format: String(fm?.format) }),
      [localize('case-catalogue.checks.republish_through_op_publish_which_authors', 're-publish through op=publish, which authors the case document')]));
  }
  /* THE IDENTITY AND THE EDITION, CHECKED AGAINST WHAT THE STORE IS ABOUT TO
     COMMIT THEM AS. This is the one arm that is not purely about the bytes, and
     it is the reason the ceremony is not a rubber stamp: the signature covers
     THESE bytes, so if the document's own idea of which case and which edition
     it is differs from the row being written, the plane would be committing a
     case fact at coordinates nobody signed for. #publishEdges' doctrine, at the
     one place it can still be violated. */
  if (typeof fm?.case_id !== 'string' || fm.case_id.trim() === '' || fm.case_id === 'null') {
    findings.push(f(C41.IDENTITY, 'error', localize('case-catalogue.checks.a_case_document_requires_case_id', 'a case document requires case_id: without it the document names no case, so C-21.1 has nothing to be fresh against and the container has no identity to be an edition OF (DEC-44)')));
  } else if (caseId && fm.case_id !== caseId) {
    findings.push(f(C41.IDENTITY, 'error', localize('case-catalogue.checks.this_case_document_names_case', 'this case document names case {case_id} and is being ratified as {caseId}: the signature covers these bytes, so a case identity taken from the request rather than from the signed document would place a commitment where nobody made one', { case_id: String(fm.case_id), caseId: String(caseId) })));
  }
  if (!Number.isInteger(fm?.case_edition) || fm.case_edition < 1) {
    findings.push(f(C41.EDITION, 'error', localize('case-catalogue.checks.a_case_document_requires_an', 'a case document requires an integer case_edition of 1 or more (got \'{case_edition}\'): an edition is a SEPARATE DOCUMENT and answers forever, so a signature that did not cover the number would stand for every edition of this case at once', { case_edition: String(fm?.case_edition) })));
  } else if (Number.isInteger(edition) && fm.case_edition !== edition) {
    findings.push(f(C41.EDITION, 'error', localize('case-catalogue.checks.this_case_document_names_edition', 'this case document names edition {case_edition} and is being ratified as edition {edition}: the edition is inside the hash the member signed, exactly as DEC-12 already requires of a record', { case_edition: String(fm.case_edition), edition: String(edition) })));
  }
  /* CASE-2 / DEC-72 clause 2 — WHOSE PRODUCTION. Text preserved from the arm
     this replaces, with 'a case member' corrected to 'a case document': the
     requirement is identical and the subject is not. */
  if (typeof fm?.case_project !== 'string' || fm.case_project.trim() === '' || fm.case_project === 'null') {
    findings.push(f(C41.PROJECT, 'error', localize('case-catalogue.checks.a_case_document_requires_case_project', 'a case document requires case_project: a case is a PRODUCTION OF A PROJECT (DEC-72), and the project is what supplied the standard of evidence the case was held to. A published case naming no project is one whose bar nobody declared, and a stranger holding it cannot say whose production it is'),
      [localize('case-catalogue.checks.publish_through_op_publish_with_project', 'publish through op=publish with project=<project id>, which writes it into the case document you sign')]));
  }
  /* DEC-44 determination 2. AUTHORED and never prefilled — and this is the arm
     that fits the claim, since a scope may legitimately be unchanged between
     editions and a byte-check on it would pressure a member into inventing a
     difference (see checkCompletenessFreshness). */
  if (typeof fm?.case_scope !== 'string' || fm.case_scope.trim() === '') {
    findings.push(f(C41.SCOPE, 'error', localize('case-catalogue.checks.a_case_document_requires_case_scope', 'a case document requires case_scope: the case states what brought these findings together and what question it answers as a whole. It is AUTHORED by the team and never derived from the findings\' titles — a scope this plane wrote is not a scope the team made (DEC-44)'),
      [localize('case-catalogue.checks.author_the_case_scope_on_op', 'author the case scope on op=publish')]));
  }
  /* REC-47 / DEC-46 (a). DEC-20 is the doctrine and it is worth stating at the
     gate rather than only in the register: a published case CARRIES the bias it
     was produced under, as a fact a reader weighs. This field is a DISCLOSURE,
     never a bar — nothing here reads WHICH bias it names, and nothing anywhere
     refuses a case for having one. The only bias that disqualifies is an
     uncleared HUNCH (HUNCH DEBT, D-188), and that refusal is
     op=publishpreflight's by name. */
  if (typeof fm?.bias_acknowledgement !== 'string' || fm.bias_acknowledgement.trim() === '') {
    findings.push(f(C41.BIAS, 'error', localize('case-catalogue.checks.a_case_document_requires_bias_acknowledgement', 'a case document requires bias_acknowledgement: a published case carries the bias it was produced under as a fact the reader weighs, and the publisher ACKNOWLEDGES it at the moment of export rather than passing a pre-flight checkbox (DEC-46). Ordinary declared bias never blocks publication and is disclosed precisely so a reader can apply or discount it (DEC-20) — what is refused here is publishing SILENTLY about the lens, not publishing under one'),
      [localize('case-catalogue.checks.author_the_bias_acknowledgement_on_op', 'author the bias acknowledgement on op=publish, fresh for this edition')]));
  }
  /* DEC-44 determination 3, AND CLAUSE 3'S FREEZE. The roster names every member
     AT A HASH. Reproduced from the member-side arm and then extended, because
     the member-side arm could not ask for a pin: at the moment one member signed,
     the other members' shas did not exist. */
  const roster = Array.isArray(fm?.case_findings) ? fm.case_findings : null;
  if (!roster || !roster.length) {
    findings.push(f(C41.ROSTER, 'error', localize('case-catalogue.checks.a_case_document_requires_case_findings', 'a case document requires case_findings naming every finding in this case: a stranger holding this document must be able to see what the case rests on without contacting this instance, which is the premise the portable container exists for (DEC-44 determination 3)'),
      [localize('case-catalogue.checks.publish_through_op_publish_which_writes_roster', 'publish through op=publish, which writes the roster into the case document')]));
  }
  {
    const names = (roster || []).map((x) => String(x));
    const rows = Array.isArray(fm?.case_roles) ? fm.case_roles.filter((r) => r && typeof r === 'object') : null;
    if (!rows || !rows.length) {
      findings.push(f(C41.ROLES, 'error', localize('case-catalogue.checks.a_case_document_requires_case_roles', 'a case document requires case_roles: the publisher DESIGNATES each member load_bearing or supporting, and the whole partition is signed so a stranger can see which findings were presented as carrying the case (DEC-72 clause 4). There is no default — a member designated by omission was designated by nobody'),
        [localize('case-catalogue.checks.designate_every_member_on_op_publish', 'designate every member on op=publish with roles={"<finding id>": "load_bearing"|"supporting"}')]));
    } else {
      const named = new Map(rows.map((r) => [String(r.target ?? ''), String(r.role ?? '')]));
      const pinned = new Map(rows.map((r) => [String(r.target ?? ''), r.version_sha]));
      for (const m of names) {
        if (!named.has(m)) {
          findings.push(f(C41.ROLES, 'error', localize('case-catalogue.checks.case_roles_designates_no_role', 'case_roles designates no role for {m}, which case_findings names as a member: the partition covers the roster exactly, because a member the partition is silent about was designated by nobody (DEC-72 clause 4)', { m: String(m) })));
        } else if (!CASE_MEMBER_ROLES.includes(named.get(m))) {
          findings.push(f(C41.ROLES, 'error', localize('case-catalogue.checks.case_roles_designates_m_get', 'case_roles designates {m} \'{get}\', which is not one of: {CASE_MEMBER_ROLES}', { m: String(m), get: String(named.get(m)), CASE_MEMBER_ROLES: String(CASE_MEMBER_ROLES.join(', ')) })));
        }
        const pin = pinned.get(m);
        if (typeof pin !== 'string' || !/^[0-9a-f]{64}$/.test(pin)) {
          findings.push(f(C41.PINS, 'error', localize('case-catalogue.checks.case_roles_names_m_without', 'case_roles names {m} without a 64-hex version_sha: publication PINS VERSIONS LIKE A COMMIT (DEC-72 clause 3), so a case that names its members and not the VERSIONS of them is a claim about the present rather than a frozen edition. The pin is the member\'s own bundle_sha, which is the hash that member signs', { m: String(m) }),
            [localize('case-catalogue.checks.republish_through_op_publish_which_pins', 're-publish through op=publish, which pins each member at the version it prepared')]));
        }
      }
      for (const [t] of named) {
        if (t && !names.includes(t)) {
          findings.push(f(C41.ROLES, 'error', localize('case-catalogue.checks.case_roles_designates_t_which', 'case_roles designates {t}, which case_findings does not name as a member of this case: the partition is OVER the roster and cannot reach outside it', { t: String(t) })));
        }
      }
      if (names.length && !names.some((m) => named.get(m) === 'load_bearing')) {
        findings.push(f(C41.ROLES, 'error', localize('case-catalogue.checks.case_roles_names_no_load_bearing', 'case_roles names no LOAD-BEARING member: a case rests on at least one finding that meets the project\'s standard of evidence (DEC-72\'s second ruled default). All-supporting material asserts nothing conclusively while the completeness assertion claims coverage of a question no member conclusively answers'),
          [localize('case-catalogue.checks.designate_the_finding_the_case', 'designate the finding the case actually rests on, or do not publish this as a case yet')]));
      }
    }
  }
  /* REC-14's COMPLETENESS ASSERTION, AT THE ALTITUDE IT WAS ALWAYS ABOUT. It is
     asked of the member's own bytes too (checkPublishedExtension keeps that arm)
     and it is asked HERE as well, for the reason this act already runs C-21.1
     twice: a one-sided check is a check the other side has to catch. */
  const c = (typeof fm?.completeness === 'object' && fm.completeness) || null;
  if (!c) {
    findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_a_completeness', 'a case document requires a completeness block: a case that says nothing about what it does not cover is claiming to cover everything'),
      [localize('case-catalogue.checks.author_completeness_statement_and_exclusion', 'author completeness.statement and the exclusion list')]));
  } else {
    if (typeof c.statement !== 'string' || c.statement.trim() === '')
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_a_non_empty', 'a case document requires a non-empty completeness.statement')));
    if (typeof c.author !== 'string' || c.author.trim() === '')
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_completeness_author', 'a case document requires completeness.author: the completeness assertion is a named member\'s claim about the limits of this case')));
    if (typeof c.at !== 'string' || !ISO_TS_RE.test(c.at))
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_completeness', 'a case document requires completeness.at as an ISO timestamp (got \'{at}\')', { at: String(c.at) })));
    if (!SUBJECT_POSITIONS.includes(c.subject_position))
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_completeness_2', 'a case document requires completeness.subject_position, one of: {SUBJECT_POSITIONS} (got \'{subject_position}\'). The gate is that the position is declared and justified — never that contact happened, and never that the answer was favourable (DEC-13)', { SUBJECT_POSITIONS: String(SUBJECT_POSITIONS.join(', ')), subject_position: String(c.subject_position) })));
    if (typeof c.subject_justification !== 'string' || c.subject_justification.trim() === '')
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_completeness_subject_justification', 'a case document requires completeness.subject_justification: a declared position with no reasoning behind it is the checkbox this gate exists to refuse (DEC-13)')));
  }
  /* D-150 / BIO_Publication_v0_1.md §3 rule 11 — THE STATEMENT'S ACKNOWLEDGEMENTS, C-41.10's
     arm because they are the completeness block's. ABSENCE IS NOT REQUIRED AWAY: a document
     authored before acknowledgements were recorded carries no list, and it is read as saying
     nothing about them (the ratify committer commits NULL, never an empty list), so this arm
     cannot demand the key without refusing what already crossed (rule 1). What it refuses is a
     list that claims more than it can support: a row naming no acknowledger or no kind, a count
     that disagrees with the list, and the statement's own author listed as its second reader —
     the one thing rule 11 says an acknowledgement is not. Nothing here asks for a row to exist:
     none is ever required to publish.

     REC-212 / §3 rule 13 (BOB #32 ruled (b), 2026-09-24: *two acts, two names, never conflated*) —
     THE EXCLUSION READS THE STATEMENT'S WRITER, WHICH IT COULD NOT DO BEFORE. It read
     `completeness.author`, and that names the member who PREPARED AND PUBLISHED the case. Where an
     editor wrote the exclusion statement and somebody else published it, this arm admitted the
     editor's own acknowledgement of their own sentence — so a signed case document claimed a second
     reading nobody made, which is the overclaim this catalogue exists to refuse, in the artifact a
     stranger holds. `completeness.statement_by` (REC-212, carried onto the document from the draft's
     server stamp) is the writer, and THREE STATES are told apart rather than two:
       - a NAME — an acknowledgement by that member is refused, and this is the arm the row is about;
       - `null`, the plane SAYING it could not establish the writer — then EVERY participant row is
         refused, once, because any one of them may BE the writer's own and a list that cannot rule
         that out is the record claiming a reader it cannot support. A RECIPIENT row is untouched: a
         grant's holder is never the writer;
       - NO KEY — a /1 or /2 document, authored before rule 13, read IN ITS OWN SHAPE: `author` is
         the only name those bytes hold, and refusing every acknowledgement of them would refuse what
         already crossed (rule 1).
     THE PUBLISHER'S OWN STAYS REFUSED, on its own reason and in its own words. They author this block
     and date it at the act of publishing, so their acknowledgement of it is not a second reading
     either, and `op=publish` has left it out since D-150. Two exclusions, two messages: one name for
     each act is the whole content of the ruling, and a single message covering both is how the two
     came to be one field in the first place. */
  if (fm && fm.completeness_acknowledgements !== undefined) {
    const acks = fm.completeness_acknowledgements;
    if (!Array.isArray(acks)) {
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_documents_completeness_acknowledgements_must', 'a case document\'s completeness_acknowledgements must be a list — empty when nobody but the statement\'s author acknowledged it (BIO_Publication §3 rule 11)')));
    } else {
      const publisher = c && typeof c.author === 'string' ? c.author : null;
      const statesWriter = !!c && Object.prototype.hasOwnProperty.call(c, 'statement_by');
      const writer = statesWriter && typeof c.statement_by === 'string' && c.statement_by.trim()
        ? c.statement_by.trim() : null;
      const writerUndetermined = statesWriter && !writer;
      for (const a of acks) {
        if (!a || typeof a !== 'object' || !['participant', 'recipient'].includes(a.kind)
            || typeof a.by !== 'string' || !a.by.trim() || typeof a.at !== 'string')
          findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_lists_an', 'a case document lists an acknowledgement of its statement that names no acknowledger, kind (participant or recipient) or date (got {stringify}): an acknowledgement is an authored, attributed, dated act, and an unattributed one is the record claiming a second reader it cannot name', { stringify: String(JSON.stringify(a)) })));
        else if (a.kind === 'participant' && writer && a.by === writer)
          findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_lists_by', 'a case document lists {by}, the member who WROTE its exclusion statement (completeness.statement_by), as having acknowledged it: an acknowledgement is a SECOND person\'s reading of what the case leaves out (BIO_Publication §3 rule 11), and the writer of the sentence has read it once. Who wrote the statement and who published the case are two acts and two names (§3 rule 13) — this is the writer, whether or not they are also completeness.author', { by: String(a.by) })));
        else if (a.kind === 'participant' && publisher && a.by === publisher)
          findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_lists_publisher', 'a case document lists {by}, completeness.author — the member who PREPARED AND PUBLISHED this case and authored this completeness block at that act — as having acknowledged its statement: an acknowledgement is a SECOND person\'s reading of what the case leaves out (BIO_Publication §3 rule 11), and the member who authored the block is its first reader by construction', { by: String(a.by) })));
      }
      if (writerUndetermined && acks.some((a) => a && typeof a === 'object' && a.kind === 'participant'))
        findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_states_that', 'a case document states that who wrote its exclusion statement is UNDETERMINED (completeness.statement_by is null) and lists {length} participant acknowledgement(s) of it: an acknowledgement is a SECOND person\'s reading (BIO_Publication §3 rule 11), and a document that cannot say who the FIRST reader was cannot support the claim that any of these is a second. Publish the edition again from a draft whose statement carries an author, or let the list stand with its recipients alone — a recipient of a review copy is never the statement\'s writer', { length: String(acks.filter((a) => a && typeof a === 'object' && a.kind === 'participant').length) })));
      if (c && c.acknowledged !== undefined && c.acknowledged !== acks.length)
        findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_documents_completeness_acknowledged', 'a case document\'s completeness.acknowledged ({acknowledged}) disagrees with the {length} acknowledgement(s) it lists: the count and the list are one claim', { acknowledged: String(c.acknowledged), length: String(acks.length) })));
    }
  }
  /* REC-188 — C-41.13, THE TWO DISCLOSURES A /3 DOCUMENT MUST CARRY. The arm above cannot demand the
     acknowledgement list and C-41.6 asks only for the authored acknowledgement, because both are read
     over /2 documents authored before D-84 and D-150; the token is what lets the gate tell a document
     that was never obliged from one that left its obligation out. So under /3, and ONLY under /3:
       (a) `bias_manifest` is a MAP whose `in_force` is a boolean, with `bias_manifest_bundles` beside it
           as a list. In force, it names the hash of the effective statement set; not in force, it SAYS
           so (`stated`) — the two are different facts from a lens with nothing in it (D-84), and a
           manifest that is neither is a blank a reader would take for one.
       (b) `completeness.acknowledged` is an integer of 0 or more and `completeness_acknowledgements` is
           a list. ZERO and an EMPTY list are legal and are the common answer: they say nobody but the
           statement's author acknowledged it, and nothing anywhere requires a second reader (rule 11).
     What is refused is SILENCE about the lens or about the second readers — never an unfavourable
     value. Nothing here reads WHICH bias is named (DEC-20: a disclosure, never a bar). */
  if (caseDocumentRequiresDisclosures(fm)) {
    const bm = fm?.bias_manifest;
    if (!bm || typeof bm !== 'object' || Array.isArray(bm) || typeof bm.in_force !== 'boolean') {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_document_requires', 'a {declared} case document requires a bias_manifest map with a boolean in_force (got {stringify}): a published case CARRIES the bias it was produced under (DEC-20), and the manifest is the lens itself — computed and stamped by the plane beside the acknowledgement the publisher authors (DEC-46). A document silent about the lens cannot be told from one produced under none', { declared: String(declared), stringify: String(JSON.stringify(bm ?? null)) }),
        [localize('case-catalogue.checks.republish_through_op_publish_which_stamps_manifest', 're-publish through op=publish, which stamps the manifest in force for the case\'s project into the case document')]));
    } else if (bm.in_force === true && !(typeof bm.statements_sha === 'string' && /^[0-9a-f]{64}$/.test(bm.statements_sha))) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_documents_bias_5', 'a {declared} case document\'s bias_manifest says a lens was in force and names no 64-hex statements_sha (got \'{v1}\'): the manifest is the (record, revision) pairs PLUS a hash of the effective statement set, and a lens named without its hash cannot be checked against op=biasmanifest by anyone', { declared: String(declared), v1: String(bm.statements_sha) }),
        [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
    } else if (bm.in_force === false && !(typeof bm.stated === 'string' && bm.stated.trim())) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_documents_bias', 'a {declared} case document\'s bias_manifest says no lens was in force and does not SAY so (stated is empty): "no manifest was in force" is a statement, and a blank is not one', { declared: String(declared) }),
        [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
    }
    if (bm && typeof bm === 'object' && !Array.isArray(fm?.bias_manifest_bundles)) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_2', 'a {declared} case document requires bias_manifest_bundles beside bias_manifest: an EMPTY list is a claim (no bias record was in force) and is legal — an ABSENT field is silence about which revisions the lens was', { declared: String(declared) }),
        [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
    }
    if (!c || !Number.isInteger(c.acknowledged) || c.acknowledged < 0) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_3', 'a {declared} case document requires completeness.acknowledged, the count of second readers of its statement (got \'{v1}\'): ZERO is a statement — nobody but its author acknowledged it — and is legal; an absent count is silence (BIO_Publication §3 rule 11). An acknowledgement is never required to publish', { declared: String(declared), v1: String(c ? c.acknowledged : undefined) }),
        [localize('case-catalogue.checks.republish_through_op_publish_which_lists', 're-publish through op=publish, which lists every acknowledgement of the statement it publishes')]));
    }
    if (!Array.isArray(fm?.completeness_acknowledgements)) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_4', 'a {declared} case document requires completeness_acknowledgements: an EMPTY list is a claim (nobody but the statement\'s author acknowledged it) and is legal — an ABSENT field is silence about who else read what this case leaves out (BIO_Publication §3 rule 11)', { declared: String(declared) }),
        [localize('case-catalogue.checks.republish_through_op_publish_which_lists', 're-publish through op=publish, which lists every acknowledgement of the statement it publishes')]));
    }
    /* REC-212 — (c) `completeness.statement_by`: WHO WROTE THE STATEMENT, told apart from
       `completeness.author`, who PREPARED AND PUBLISHED the case (§3 rule 13, BOB #32 (b), 2026-09-24).
       REQUIRED AS A KEY, /3 AND ONLY /3, for REC-188's own reason: a /1 or /2 document was never
       obliged to carry it and is read in its own shape, and the token is what tells a document that was
       never obliged from one that left its obligation out. `null` IS LEGAL AND IS A STATEMENT — the
       plane could not establish who wrote the sentence, said rather than guessed and never back-filled
       from `author`. What is refused is SILENCE: a /3 document handing a reader only the publisher's
       name leaves the two acts looking like one, which is the conflation this key exists to end. A
       document caught here is UNSIGNED — it is authored again by `op=publish`, which stamps the key —
       so nothing that already crossed is disturbed (rule 1). */
    if (!c || !Object.prototype.hasOwnProperty.call(c, 'statement_by')
        || !(c.statement_by === null || (typeof c.statement_by === 'string' && c.statement_by.trim()))) {
      findings.push(f(C41.DISCLOSURES, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_5', 'a {declared} case document requires completeness.statement_by, the member who WROTE its exclusion statement — a different act, and a different name, from completeness.author, who prepared and published the case (BIO_Publication §3 rule 13). NULL is a statement (the plane could not establish who wrote the sentence) and is legal; an ABSENT key is silence, and a reader holding only the publisher\'s name reads two acts as one (got {v1}{v2})', { declared: String(declared), v1: String(c ? JSON.stringify(c.statement_by ?? null) : undefined), v2: String(c && !Object.prototype.hasOwnProperty.call(c, 'statement_by') ? ', with no such key' : '') }),
        [localize('case-catalogue.checks.republish_through_op_publish_which_carries', 're-publish through op=publish, which carries the draft\'s server-stamped statement_by onto the document')]));
    }
  }
  /* REC-219 — C-41.14, THE ADOPTION PENDING AT SIGNING, a /4 obligation and nothing older
     (BIO_Publication_v0_1.md §3 rule 18; BOB #34, 2026-09-24 23:08Z). The frozen block states the
     scope's bias position AS IT STOOD AT SIGNING, and "no manifest was in force" is TRUE of a scope whose
     only adoption pins a PROPOSED revision — but alone it lets a later reader take "nobody declared
     anything" for "a declaration was pending". So a /4 document states, beside the manifest:
       - `bias_manifest.pins_proposed`, the COUNT of adoptions whose pinned revision stood at a state other
         than `adopted` (ZERO is a statement and the common answer);
       - `bias_manifest_pins_proposed`, one row per such adoption naming its bundle, the REVISION it
         pinned (64 hex) and the scope — the list's length the count;
       - `bias_manifest.pins_proposed_stated`, the sentence saying what the list is.
     What is refused is SILENCE, never a value: an EMPTY list with a zero count passes, and so does a
     long one. Nothing here reads WHICH revision is named, nor asks whether it will take effect — the
     ruling is that the document SAYS NOTHING about when or whether it does. A document whose manifest
     is absent or not a map is C-41.13's and is not asked twice.
     WHAT THIS CANNOT SEE: the RECORD at signing. The gate is a function of the bytes a stranger hands it,
     and the adoption table has moved since (a pin re-pins at promotion, REC-187), so "the record held
     one and the list omits it" is enforced where the record IS read — op=publish, which authors this
     list from the same op=biasmanifest answer the manifest is stamped from — and a document's own
     disagreement with itself (a count that is not its list's length) is what is refused here. */
  if (caseDocumentRequiresV4Disclosures(fm)) {
    const bm = fm?.bias_manifest;
    if (bm && typeof bm === 'object' && !Array.isArray(bm)) {
      const list = fm?.bias_manifest_pins_proposed;
      const n = bm.pins_proposed;
      if (!Number.isInteger(n) || n < 0 || !Array.isArray(list)) {
        findings.push(f(C41.PENDING, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_6', 'a {declared} case document requires bias_manifest.pins_proposed (a count, zero legal) and bias_manifest_pins_proposed (a list, empty legal) beside its manifest (got count {stringify}, list {v1}): "no manifest was in force" is true of a scope whose only adoption pins a revision the team has proposed and not accepted, and a document silent about that adoption lets a reader take "a declaration was pending" for "nobody declared anything" (BIO_Publication §3 rule 18)', { declared: String(declared), stringify: String(JSON.stringify(n ?? null)), v1: String(Array.isArray(list) ? `of ${list.length}` : 'absent') }),
          [localize('case-catalogue.checks.republish_through_op_publish_which_states', 're-publish through op=publish, which states every adoption of the scope pinning a proposed revision at signing')]));
      } else if (list.length !== n) {
        findings.push(f(C41.PENDING, 'error', localize('case-catalogue.checks.a_declared_case_documents_bias_2', 'a {declared} case document\'s bias_manifest.pins_proposed says {n} and its bias_manifest_pins_proposed lists {length}: the count and the list are one fact stated twice, and a document disagreeing with itself about a pending adoption states neither', { declared: String(declared), n: String(n), length: String(list.length) }),
          [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
      } else {
        const bad = list.filter((x) => !(x && typeof x === 'object'
          && typeof x.bundle_id === 'string' && x.bundle_id.trim()
          && typeof x.revision === 'string' && /^[0-9a-f]{64}$/.test(x.revision)
          && (x.scope === 'instance' || x.scope === 'project')));
        if (bad.length > 0)
          findings.push(f(C41.PENDING, 'error', localize('case-catalogue.checks.a_declared_case_documents_bias_3', 'a {declared} case document\'s bias_manifest_pins_proposed has {length} row(s) not naming a bundle_id, a 64-hex revision and a scope of instance or project (first: {stringify}): the ruling is that the document names the proposed revision the adoption pinned — its id — and a row without it says an adoption was pending without saying which', { declared: String(declared), length: String(bad.length), stringify: String(JSON.stringify(bad[0])) }),
            [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
        if (!(typeof bm.pins_proposed_stated === 'string' && bm.pins_proposed_stated.trim()))
          findings.push(f(C41.PENDING, 'error', localize('case-catalogue.checks.a_declared_case_documents_bias_4', 'a {declared} case document\'s bias_manifest carries no pins_proposed_stated: the list is stated in a sentence as "no manifest was in force" is, because a bare count is a blank a reader must decode', { declared: String(declared) }),
            [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
      }
    }
  }
  /* REC-219 / D-579(a) — C-41.15, THE CITATION EDGES AND THEIR VERSIONS, a /4 obligation (BOB #34,
     2026-09-25 02:30Z: *"A published case must say which version it cited, and a pin kept outside the
     signed bytes is one a reader cannot verify"*). A /4 document carries `case_citations`, a list (EMPTY
     legal: the project cited nothing), each row a target and a `version` from CASE_CITATION_VERSIONS:
     `pinned` and `only_capture` NAME the 64-hex capture; `undetermined`, `no_capture` and `no_bytes` name
     none and say why by their value. What is refused: the list absent, a row with no target or a version
     outside the vocabulary, a row whose version says it names a capture and OMITS IT (the pin dropped),
     and a row naming a capture its version says it has not.
     WHAT THIS CANNOT SEE, as C-41.14 cannot: the RECORD. Whether the edge's bytes held a pin that this
     row calls `undetermined` is op=publish's to get right, and is driven through the op. /3 and older are
     never asked: read today their edges are "version undetermined (signed before capture pins)", which
     op=casedocument states. */
  if (caseDocumentRequiresV4Disclosures(fm)) {
    const rows = fm?.case_citations;
    if (!Array.isArray(rows)) {
      findings.push(f(C41.CITATIONS, 'error', localize('case-catalogue.checks.a_declared_case_document_requires_7', 'a {declared} case document requires case_citations, the case\'s citation edges each with the version it rests on (got {stringify}): an EMPTY list is a claim (the project cited nothing) and is legal — an ABSENT field leaves a reader unable to say which version of anything the case cited (BIO_Publication §3 rule 18)', { declared: String(declared), stringify: String(JSON.stringify(rows ?? null)) }),
        [localize('case-catalogue.checks.republish_through_op_publish_which_signs', 're-publish through op=publish, which signs every cites edge of the project with its version')]));
    } else {
      const bad = rows.filter((x) => !(x && typeof x === 'object' && typeof x.target === 'string' && x.target.trim()
        && CASE_CITATION_VERSIONS.includes(x.version)
        && (CITATION_NAMES_CAPTURE.has(x.version)
          ? typeof x.capture === 'string' && /^[0-9a-f]{64}$/.test(x.capture)
          : x.capture === null || x.capture === undefined)));
      if (bad.length > 0)
        findings.push(f(C41.CITATIONS, 'error', localize('case-catalogue.checks.a_declared_case_documents_case_citations', 'a {declared} case document\'s case_citations has {length} row(s) that do not state a target and a version from one of: {versions}, with the 64-hex capture exactly where the version names one (first: {first}): a citation edge that says it is pinned and omits the pin, or names a capture its version disowns, states a version nobody can verify', { declared: String(declared), length: String(bad.length), versions: String(CASE_CITATION_VERSIONS.join(', ')), first: String(JSON.stringify(bad[0])) }),
          [localize('case-catalogue.checks.republish_through_op_publish', 're-publish through op=publish')]));
    }
  }
  /* REC-96 / D-196 / IC-112 — THE `searched` SECTION, AND IT IS C-41.10's ARM
     BECAUSE IT IS THE SAME QUESTION. The completeness statement says what this
     case does not cover; this says what was looked for. A case carrying the first
     without the second is Blair & Maron's stipulation with no disclosed process
     behind it, which D-196 records as the exact claim the field considers
     worthless — so the FIELD is required here for the reason the exclusion list
     and the bar are required one arm down: what is refused is SILENCE, never an
     unfavourable value.

     EVERY HONEST ANSWER IS LEGAL AND ONE OF THEM SAYS NOBODY LOOKED. A section
     reporting `never_looked` at every level passes this gate, and so does one
     reporting `no_subjects`. That is not a hole in the check — it is the check
     working. A gate that refused those would pressure a member into publishing a
     coverage claim they could not support, which is the failure mode CLAUDE.md
     names for the publication fence: a gate that pressures someone into inventing
     an attribution is a bug in the gate. */
  const srch = (typeof fm?.searched === 'object' && fm.searched) || null;
  if (!srch) {
    findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_searched_block', 'a case document requires a searched block beside its completeness block: a completeness claim with no record of what was looked for is prose with nothing behind it, which is what the search-completeness literature identifies as the claim worth least (D-196). An empty or negative answer is legal here — SILENCE is not'),
      [localize('case-catalogue.checks.publish_the_searched_section_computed', 'publish the searched section computed from the observation log over this case\'s own subjects')]));
  } else {
    if (!Object.prototype.hasOwnProperty.call(SEARCHED_SUBJECT_SOURCES, String(srch.subject_source)))
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_documents_searched_subject', 'a case document\'s searched.subject_source must name a source this record recognises (got \'{subject_source}\'; known: {keys}). THE SUBJECT SET IS THE FENCE: a coverage section computed over the observation log\'s own subjects is 100% searched by construction with every row in it honest, and is a statement about the log rather than about this case', { subject_source: String(srch.subject_source), keys: String(Object.keys(SEARCHED_SUBJECT_SOURCES).join(', ')) }),
        [localize('case-catalogue.checks.compute_the_section_over_the', 'compute the section over the case\'s own subjects — its members\' basis legs and the content rows those legs name')]));
    if (!Number.isInteger(srch.subjects) || srch.subjects < 0)
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_documents_searched_block', 'a case document\'s searched block requires an integer subject count (got \'{subjects}\')', { subjects: String(srch.subjects) })));
    if (!Array.isArray(fm?.searched_levels))
      findings.push(f(C41.COMPLETENESS, 'error', localize('case-catalogue.checks.a_case_document_requires_searched_levels', 'a case document requires a searched_levels field beside the searched block: an EMPTY list is a claim (this record could compute no level for this case) and is legal — an ABSENT field is silence about which levels were consulted'),
        [localize('case-catalogue.checks.author_searched_levels_empty_if', 'author searched_levels, empty if no level could be computed')]));
  }
  /* C-9. The FIELD may not be absent; the LIST may legitimately be empty. */
  if (!Array.isArray(fm?.completeness_excluded)) {
    findings.push(f(C41.EXCLUDED, 'error', localize('case-catalogue.checks.a_case_document_requires_completeness_excluded', 'a case document requires a completeness_excluded field: an EMPTY list is a claim (this case left nothing out) and is legal — an ABSENT field is silence, and silence about what a case excludes is what the completeness assertion exists to refuse'),
      [localize('case-catalogue.checks.author_completeness_excluded_empty_if', 'author completeness_excluded, empty if nothing was excluded')]));
  }
  /* DEC-17 AS DEC-72 REHOMES IT: THE BAR, IN THE SIGNED DOCUMENT. The FIELD is
     required and a DECLARED value is not, which is the whole of "an absent bar
     is not a bar of zero" written as a check. A case published where no bar was
     ever declared states that fact and claims no cleared standard — the design
     doc's own clause — so what is refused here is SILENCE about the bar, never
     the absence of one. */
  const rq = (typeof fm?.required_strength === 'object' && fm.required_strength) || null;
  if (!rq || typeof rq.declared !== 'boolean') {
    findings.push(f(C41.BAR, 'error', localize('case-catalogue.checks.a_case_document_requires_required_strength', 'a case document requires required_strength with a declared flag: a case publishes the bar the team set for itself beside the strength each member reached, and an ABSENT bar is STATED as absent rather than shown as blank (DEC-17). An absent bar is not a bar of zero — a reader cannot tell "no bar was declared" from "nobody wrote this down"'),
      [localize('case-catalogue.checks.declare_the_project_bar_with_op', 'declare the project bar with op=strengthbar, or publish with the bar stated absent')]));
  } else if (rq.declared) {
    /* THE PAIR, PER R2, and the reason is the one the member-side arm carried:
       a scalar would re-collapse the two axes in the one field a reader is most
       likely to quote.
       D-450 / BIO_Publication_v0_1.md §3 rule 14 (BOB #32, 2026-09-23): AN AXIS NOBODY SET IS NULL.
       A project may declare its bar on one axis only (`op=publish` admits it: an unset axis gates
       nothing), and demanding a grade on both refused the very document `op=publish` had authored —
       a case that published and could never be signed, and a gate pressuring a member to invent a
       bar on an axis they hold no view on (CLAUDE.md §4). So `null` is ADMITTED; what stays refused
       is an OMITTED key (the pair stays a pair — silence is not "unset"), any other value, and a
       bar declared on NEITHER axis, which claims a standard no axis holds. */
    for (const axis of ['capture', 'connection']) {
      if (!Object.prototype.hasOwnProperty.call(rq, axis)) {
        findings.push(f(C41.BAR, 'error', localize('case-catalogue.checks.required_strength_axis_is_absent', 'required_strength.{axis} is absent — the declared bar is a PAIR per R2 and both keys are always written: an axis nobody set is written null, never omitted, because a reader cannot tell an omitted key from one nobody wrote down', { axis: String(axis) }),
          [localize('case-catalogue.checks.write_required_strength_axis_null', 'write required_strength.{axis}: null if the project set no bar on the {axis_2} axis', { axis: String(axis), axis_2: String(axis) })]));
      } else if (rq[axis] !== null && !BASIS_GRADES.includes(rq[axis])) {
        findings.push(f(C41.BAR, 'error', localize('case-catalogue.checks.required_strength_axis_v1_is', 'required_strength.{axis} \'{v1}\' is not one of: {BASIS_GRADES}, or null for an axis nobody set — the declared bar is a PAIR per R2, because a scalar would re-collapse the two axes in the one field a reader is most likely to quote', { axis: String(axis), v1: String(rq[axis]), BASIS_GRADES: String(BASIS_GRADES.join(', ')) })));
      }
    }
    if (rq.capture === null && rq.connection === null) {
      findings.push(f(C41.BAR, 'error', localize('case-catalogue.checks.required_strength_is_declared_with_no', 'required_strength is declared with no bar set on either axis — a declared bar that gates nothing claims a standard no axis holds; a case with no bar states declared: false'),
        [localize('case-catalogue.checks.publish_with_the_bar_stated', 'publish with the bar stated absent (declared: false), or declare a grade on at least one axis')]));
    }
  }
  /* ===== D-442 / BIO_Publication_v0_1.md §3 rule 12 (d): EVERY CHECK FOLLOWS ITS BLOCK. ========
     Under /2 op=publish writes nothing on a member, so the member-bytes arms that required a block
     there — C-2.8's entry requirements (the edition, the completeness block, the exclusion FIELD, the
     frozen pair with its testimony row, the frozen grounds) and C-3.1's `## What This Excludes`
     section — would stop firing on every new member, silently, with the suite green: the trap
     CASE-4 and CASE-5b each recorded one field earlier. They are not re-spelled here. THE SAME
     FUNCTION, `checkPublishedExtension`, runs once per roster member over the member's facts AS THIS
     DOCUMENT STATES THEM — its edition from `case_roles`, its pair and grounds from `case_strength`
     and `case_strength_grounds`, the case's completeness and exclusions — beside the member's own
     `basis` at the pinned bytes (`memberBasis`, from the store; the testimony-row and per-ground arms
     read it). Same check ids, same refusal text, prefixed with the member it is about. None is
     dropped. A /1 document is not asked: its members' own bytes carry these blocks and the member
     gate still asks them there (`isCaseMemberBytes`). */
  if (caseDocumentStatesMemberBlocks(fm)) {
    const members = Array.isArray(fm?.case_findings) ? fm.case_findings.map((x) => String(x)) : [];
    const rolesRows = Array.isArray(fm?.case_roles) ? fm.case_roles.filter((r) => r && typeof r === 'object') : [];
    const rowsFor = (key, m) => (Array.isArray(fm?.[key]) ? fm[key] : [])
      .filter((r) => r && typeof r === 'object' && String(r.target ?? '') === m)
      .map(({ target, ...rest }) => rest);
    if (!Array.isArray(fm?.case_strength)) {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_document_requires_case_strength', 'a case document requires a case_strength field: since BIO_Publication_v0_1.md §3 rule 12 each member\'s FROZEN STRENGTH PAIR is stated here, once, and not in the member\'s bytes — a case document silent about what its findings reached leaves a reader with no strength at all'),
        [localize('case-catalogue.checks.republish_through_op_publish_which_states_frozen', 're-publish through op=publish, which states each member\'s frozen pair in the case document')]));
    }
    if (!Array.isArray(fm?.case_strength_grounds)) {
      findings.push(f('C-2.8', 'error', localize('case-catalogue.checks.a_case_document_requires_case_strength_grounds', 'a case document requires a case_strength_grounds field: an EMPTY list is a claim (no member\'s basis named grounds) and is legal — an ABSENT field is silence about the branches a structured grade was taken from'),
        [localize('case-catalogue.checks.republish_through_op_publish_which_states_grounds', 're-publish through op=publish, which states each member\'s frozen grounds in the case document')]));
    }
    for (const m of members) {
      const row = rolesRows.find((r) => String(r.target ?? '') === m) || {};
      /* R6: an entry is the member's basis array, or `{basis, references}` read at the same pinned bytes. */
      const entry = memberBasis && Object.prototype.hasOwnProperty.call(memberBasis, m) ? memberBasis[m] : undefined;
      const basis = entry && !Array.isArray(entry) && typeof entry === 'object' ? entry.basis : entry;
      const references = entry && !Array.isArray(entry) && typeof entry === 'object' ? entry.references : undefined;
      const memberFm = {
        edition: row.edition,
        completeness: fm?.completeness,
        completeness_excluded: fm?.completeness_excluded,
        published_strength: rowsFor('case_strength', m),
        ...(rowsFor('case_strength_grounds', m).length
          ? { published_strength_grounds: rowsFor('case_strength_grounds', m) } : {}),
        ...(Array.isArray(basis) ? { basis } : {}),
        ...(Array.isArray(references) ? { references } : {}),
      };
      const own = [];
      checkPublishedExtension(memberFm, own);
      for (const x of own) findings.push({ ...x, message: localize('case-catalogue.checks.case_document_member_m', 'case document, member {m}: {message}', { m: String(m), message: String(x.message) }) });
    }
    /* C-3.1's section, which a person reads: the member carried it under `## What This Excludes`;
       the case document carries it now, and a document that does not has moved the assertion out of
       the only place a reader of prose meets it. Asked only when the caller supplies the body. */
    if (typeof body === 'string' && !/^## What This Excludes\s*$/m.test(body)) {
      findings.push(f('C-3.1', 'error', localize('case-catalogue.checks.required_heading_what_this_excludes_is', 'required heading \'## What This Excludes\' is missing from the case document: since BIO_Publication_v0_1.md §3 rule 12 the case states what it excludes once, here, and not in any member\'s bytes'),
        [localize('case-catalogue.checks.republish_through_op_publish_which_writes_section', 're-publish through op=publish, which writes the section into the case document')]));
    }
  }
  /* DEC-101 (2) — C-41.16: an edition above 1 carries a non-blank "What changed" statement, as case-grammar reads it
     (its R8: the section's text, null where the block's hash disowns it or the format carries none). Asked only when
     the caller supplies the body, as C-3.1's section is. Its message is R1's translation, word for word. */
  if (typeof body === 'string' && Number.isInteger(fm?.case_edition) && fm.case_edition > 1) {
    const wc = whatChangedOf(fm, body);
    if (!wc || typeof wc.statement !== 'string' || !wc.statement.trim())
      findings.push(f(C41.WHAT_CHANGED, 'error', localize('case-catalogue.checks.a_new_edition_of_a', 'A new edition of a case says what changed in it, and why, before it is signed. This one does not. Write the statement, then sign. Nothing was signed.'),
        [localize('case-catalogue.checks.write_the_what_changed_in_this', 'write the "What changed in this edition, and why" statement on op=publish')]));
  }
  /* DEC-111, R3 (K1119) — C-41.17: a `working_on` the document carries is a notice id by case-grammar's one rule (its
     R10), so the published case never shows as its project reference a value no notice can have. An absent field names
     no notice and is not asked (the field is optional in `/5`); a present one is asked whatever it holds, `null` and an
     empty string included, since case-authoring writes no line for a project with no notice (K1144). */
  if (fm && typeof fm === 'object' && Object.prototype.hasOwnProperty.call(fm, WORKING_ON_KEY)
      && !isNoticeReference(fm[WORKING_ON_KEY])) {
    findings.push(f(C41.WORKING_ON, 'error', localize('case-catalogue.checks.a_case_documents_working_on', 'a case document\'s working_on names the notice this case\'s project published, and \'{String}\' is not a notice id: the published case shows it as the project reference, so a value no notice can have would point a reader at nothing (DEC-111)', { String: String(String(fm[WORKING_ON_KEY])) }),
      [localize('case-catalogue.checks.publish_through_op_publish_which_writes_notice', 'publish through op=publish, which writes the project\'s notice id, or leave working_on out')]));
  }
  /* R7, R8 (T53; DEC-461, DEC-464) — C-41.18 and C-41.19, asked only of an accepted format (as every arm above). */
  if (CASE_DOCUMENT_FORMATS_ACCEPTED.includes(fm?.format)) findings.push(...passageStatementFindings(fm));
  /* C-21.1 AT CASE ALTITUDE, and it is the arm that moved here WITHOUT its
     wording changing at all, because it was always a comparison between two
     CASE EDITIONS and never between two findings. A completeness claim carried
     forward unchanged is a checkbox. The scope statement is deliberately NOT in
     this comparison — the reasoning is at checkCompletenessFreshness. */
  if (priorCase && c) {
    if (typeof priorCase.statement === 'string' && priorCase.statement === (c.statement ?? null))
      findings.push(f('C-21.1', 'error', localize('case-catalogue.checks.the_completeness_statement_is_byte', 'the completeness statement is byte-identical to edition {edition}\'s. Every edition is a separate document and states its own limits in its own words, as of its own date. If nothing about the limits changed, say THAT, as of this edition', { edition: String(priorCase.edition) })));
    if (typeof priorCase.bias_acknowledgement === 'string'
        && priorCase.bias_acknowledgement === (fm?.bias_acknowledgement ?? null))
      findings.push(f('C-21.1', 'error', localize('case-catalogue.checks.the_bias_acknowledgement_is_byte', 'the bias acknowledgement is byte-identical to edition {edition}\'s. An acknowledgement of the bias a case was produced under is AUTHORED at the moment of export and never carried forward (DEC-46): reprinting the last edition\'s sentence is evidence nobody looked. Declaring a bias never blocks publication (DEC-20)', { edition: String(priorCase.edition) })));
  }
  return findings;
}


/* ===========================================================================
 * R7, R8 (T53) — THE PASSAGES A /10 DOCUMENT STATES APART: C-41.18 AND C-41.19
 *
 * Each compares the block the document signs (case-grammar R36, R37) with what the same document's `passages:` and
 * `grading_facts:` blocks (its R17) say it must hold, so a stranger holding the bytes can trust "published without a
 * grade" and "typed by a member" without the plane. A passage is keyed by `(finding, ord, content_id)`. Pure; never throws.
 * ========================================================================= */

/** R7: whether a `grading_facts:` row holds no grade, neither member-authored nor earned from the record. The row's
 *  `grade` is the grade the leg counts at (strength R35, R46); a leg on a typed passage (its `typed`, strength R47) is
 *  graded by the record (leg-earning R19), so it is never ungraded. This stands in for `strength.isLegUngraded` (A58),
 *  which `strength` does not yet export; its definition is the planning line's (lines-A5-A8-case-modules.md). */
export function legUngraded(row) {
  try {
    if (!row || typeof row !== 'object') return false;
    if (row.typed !== null && row.typed !== undefined) return false;
    return row.grade === null || row.grade === undefined;
  } catch { return false; }
}

const passageKey = (r) => JSON.stringify([r?.finding ?? null, r?.ord ?? null, r?.content_id ?? null]);
const flatRows = (byFinding) => (byFinding && typeof byFinding === 'object' ? Object.values(byFinding).flat() : []);
/* A raw block value as the grammar read it, back to its value (case-grammar's own spelling, R17): JSON from its
   quoted form, a number or boolean as read, else null. */
const unexactValue = (v) => {
  if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean') return v ?? null;
  if (typeof v !== 'string') return null;
  try { return JSON.parse(v); } catch { return null; }
};
/* The stated keys against the wanted ones: a repeated row, a row naming no `passages:` row, or a set that differs. */
const sameSet = (stated, wanted, known) => {
  const keys = stated.map(passageKey);
  if (new Set(keys).size !== keys.length) return false;
  if (keys.some((k) => !known.has(k))) return false;
  const want = new Set(wanted.map(passageKey));
  return keys.length === want.size && keys.every((k) => want.has(k));
};
const SHOWN_AT = ['cover', 'name'];
/* R8: a credit as written stays within its level: a level of R2's or none; a name only at `cover` or `name`, and a
   non-blank one there; nothing at `group`, `project` or no level. */
const creditOk = (level, shown) => {
  if (level !== null && !ATTRIBUTION_LEVELS.includes(level)) return false;
  if (SHOWN_AT.includes(level)) return typeof shown === 'string' && shown.trim() !== '';
  return shown === null;
};

function passageStatementFindings(fm) {
  const out = [];
  try {
    const stated = caseDocumentStatesUngradedAndTyped(fm);
    if (!stated) {
      /* An earlier format is not asked, except that one carrying the key states what no reader would read (R7). */
      if (fm && typeof fm === 'object' && Object.prototype.hasOwnProperty.call(fm, 'ungraded_passages'))
        out.push(f(C41.UNGRADED_PASSAGES_MISMATCH, 'error', localize('case-catalogue.checks.the_list_of_passages_this', 'The list of passages this case was published without a grade for does not match the passages that have none. Prepare the case again, and sign it. Nothing was signed.'),
          [localize('case-catalogue.checks.prepare_the_case_again_on_op', 'prepare the case again on op=publish, which states the passages for its format')]));
      return out;
    }
    const passages = flatRows(passagesOf(fm));
    const known = new Set(passages.map(passageKey));
    const facts = flatRows(gradingFactsOf(fm));
    const factOf = (p) => facts.find((g) => g.finding === p.finding && g.ord === p.ord);

    /* R7 — C-41.18. */
    const ungraded = ungradedPassagesOf(fm);
    const wantUngraded = passages.filter((p) => legUngraded(factOf(p)));
    if (ungraded.state !== 'stated' || !sameSet(ungraded.rows, wantUngraded, known))
      out.push(f(C41.UNGRADED_PASSAGES_MISMATCH, 'error', localize('case-catalogue.checks.the_list_of_passages_this', 'The list of passages this case was published without a grade for does not match the passages that have none. Prepare the case again, and sign it. Nothing was signed.'),
        [localize('case-catalogue.checks.prepare_the_case_again_on_op', 'prepare the case again on op=publish, which states the passages for its format')]));

    /* R8 — C-41.19. */
    const typed = typedPassagesOf(fm);
    const wantTyped = passages.filter((p) => typedStepOf(p.chain) !== null);
    let ok = typed.state === 'stated' && sameSet(typed.rows, wantTyped, known);
    if (ok) {
      const raw = Array.isArray(fm.typed_passages) ? fm.typed_passages.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) : [];
      ok = raw.every((r) => {
        const checkers = unexactValue(r.checkers);
        const list = Array.isArray(checkers) ? checkers : [];
        const checked = unexactValue(r.checked);
        if (checked !== (list.length > 0)) return false;
        if (!creditOk(unexactValue(r.typist_level), unexactValue(r.typist_shown))) return false;
        return list.every((c) => c && typeof c === 'object' && creditOk(c.level ?? null, c.shown ?? null));
      });
    }
    if (!ok)
      out.push(f(C41.TYPED_PASSAGES_MISMATCH, 'error', localize('case-catalogue.checks.a_page_a_member_typed', 'A page a member typed is not listed, or is listed with a credit the member\'s choice does not allow. Prepare the case again. Nothing was signed.'),
        [localize('case-catalogue.checks.prepare_the_case_again_on_op', 'prepare the case again on op=publish, which states the passages for its format')]));
  } catch { /* pure and never throws (R1): input it cannot read draws no finding here */ }
  return out;
}

/* ===========================================================================
 * C-2.8's CASE-MEMBER ARM, WHERE IT RUNS (R2)
 *
 * The catalogue's `checkInquiryExtension` no longer calls `checkPublishedExtension`, so the arm runs where this module
 * registers it: as a promotion check (promotion R39), as an audit check (record-core R59) and at `op=ratify`'s gate,
 * after the catalogue, over the same image (as `withBiasChecks` and `withRegisterChecks` do). Each asks it only of
 * bytes `isCaseMemberBytes` answers true for, which is the condition the catalogue asked it under.
 * ========================================================================= */

/** R2: the case-member findings of one document's front matter, or none when its bytes are not a case member's. */
export function caseMemberFindings(fm) {
  if (!fm || typeof fm !== "object" || !isCaseMemberBytes(fm)) return [];
  const out = [];
  checkPublishedExtension(fm, out);
  return out;
}

/** R2: the same over a gate image (`{path: text | {blobSha}}`) or an audit image (`{files: Map}`): its `bundle.md`'s
 *  front matter, parsed by the catalogue's parser. A document held as a blob, or with no readable front matter, is not
 *  asked (the catalogue refuses those itself). */
export function caseMemberImageFindings(image, parse) {
  const md = image && image.files instanceof Map ? image.files.get("bundle.md") : image ? image["bundle.md"] : null;
  const text = typeof md === "string" ? md : md instanceof Uint8Array ? new TextDecoder().decode(md) : null;
  if (text === null) return [];
  let fm = null;
  try { fm = parse(text).data; } catch { fm = null; }
  return caseMemberFindings(fm);
}

/** R2: a ratify gate's answer with the case-member arm's errors joined to its findings, `withBiasChecks`' shape. */
export function withCaseMemberChecks(image, gate, parse) {
  const errs = caseMemberImageFindings(image, parse).filter((x) => x.severity === "error")
    .map((x) => ({ check: x.check, detail: x.message, ...(x.repairs ? { repairs: x.repairs } : {}) }));
  if (!errs.length || !gate || typeof gate !== "object") return gate;
  return { ...gate, ok: false, findings: [...(Array.isArray(gate.findings) ? gate.findings : []), ...errs] };
}
