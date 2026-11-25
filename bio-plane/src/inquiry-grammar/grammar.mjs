/* inquiry-grammar — THE GRAMMAR OF AN INQUIRY DOCUMENT (requirements: `build/requirements/inquiry-grammar.md` R1–R5,
 * R8–R18; T19 layer 6, K766; R11 at T28, N522; R12–R16 at T33; R17 at T34, N582; R18 at T41, D59).
 *
 * MOVED FROM THE CHECK CATALOGUE (`checks/bio-checks.mjs`, legacy-checks) UNCHANGED: the C-2.8 entry arm and the
 * division block (`checkInquiryExtension`, `checkDividedExtension`), the recheck coverage (C-15.1,
 * `checkRecheckCoverage`), supersession and the division disclosure (C-6.1), the leg grammar with its grounds,
 * testimony, earned and inherited arms (C-2.8, C-6.3, C-21.2) and its part (C-45 through `content`), and the lead
 * checker (C-54.1). The code below is the catalogue's text line for line; what changed is the imports, this header,
 * the finding helper's comment, and one call: `checkInquiryBasis` no longer calls `basisVersionFindings` (R4), which
 * is `basis-versions`' own grammar, run at the sub-slot `./index.mjs`' C-2.8 arm offers (R6). Every finding is the
 * catalogue's, in check, severity, message, repairs and code.
 *
 * WHAT IS READ FROM ELSEWHERE, and from where (the module's Uses):
 *   - `record-grammar`: the id, type, actor and grade vocabularies;
 *   - `content`: the extent face the leg's part is judged by (`checkContentExtent`, `legExtent`,
 *     `legHasAuthoredExtent`, `CONTENT_ID_RE`, `CONTENT_EXTENT_DOCUMENT_ONLY`, and `CONTENT_EXTENT_KINDS`, whose landed kinds the repair sentence lists; its
 *     R1, R48: all ten kinds, `doc-part` among them);
 *   - `connections`: `themeLegFindings` (C-81.1, its R46), asked of each leg before any other complaint about it;
 *   - `observation-log`: `LEAD_ID_RE`, a lead id's shape (its R14);
 *   - `civil-time`: `isCalendarDate`, whether a `YYYY-MM-DD` names a real day (its R6; R3 and the hunch's date, T33-43);
 *   - `standards`: `isPortionPath` and `PORTION_PATH_MAX`, a portion path's form (its R31; R13, N583);
 *   - `connection-grammar`: `derivedId`, a derived connection's id (its R11; R17, N582);
 *   - `duties`: `OCCURRENCE_KEY_RE`, an occurrence key's form (its R24; R15, N675).
 * Each of the last three is read from the file that states it and imports nothing of the record (`duties/vocab.mjs`
 * for the last, T35; K1799), so this grammar stays pure and the standalone case checker that bundles it carries no
 * store code.
 *
 * Pure (R9): nothing here reads or writes the record, the clock or the network; every function never throws on a
 * document it is handed, and the facts a check needs (the published and earned registries) are handed to it. */

import { BUNDLE_ID_RE, ISO_TS_RE, OBJECT_TYPES, normalizeType, isMachineIdentity, BASIS_ROLES, BASIS_GRADES, GRADE_AXES,
  TESTIMONY_GRADE, GRADE_SOURCES, EARNED_GRADE_SOURCES, idPattern } from "../record-grammar/index.mjs";
import { isCalendarDate } from "../civil-time/index.mjs";
import { checkContentExtent, legExtent, legHasAuthoredExtent, CONTENT_ID_RE, CONTENT_EXTENT_DOCUMENT_ONLY, CONTENT_EXTENT_KINDS }
  from "../content/extent.mjs";
import { themeLegFindings } from "../connections/checks.mjs";
import { LEAD_ID_RE } from "../observation-log/checks.mjs";
import { isPortionPath, PORTION_PATH_MAX } from "../standards/instrument.mjs";
import { derivedId } from "../connection-grammar/shape.mjs";
import { OCCURRENCE_KEY_RE } from "../duties/vocab.mjs";
import { LEAD_CHECKS, INQUIRY_GRAMMAR_CHECKS } from "./checks.mjs";
import { localize } from '../setup-words/index.mjs';

// R69: field and value words, shown in plain words (an underscore becomes a space).
const words = (v) => String(v).replace(/_/g, " ");
const FIELD_WORD = {
  statement: localize("inquiry-grammar.grammar.field_word_statement", "the statement"),
  effect: localize("inquiry-grammar.grammar.field_word_effect", "the effect"),
  from: localize("inquiry-grammar.grammar.field_word_from", "the grade it started from"),
  to: localize("inquiry-grammar.grammar.field_word_to", "the grade it moved to"),
};

/** A finding, record-grammar's shape (its R11), with the optional `code` (REC-56 / D-206): a discriminator within a
 *  rule, minted at the same call site as the finding it describes. */
function f(check, severity, message, repairs, code) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}

/* The subject registry's own key shape, with no slug (unlike a bundle id). Shape only. R12 (S0-4, T33-43): it is
   record-grammar's `ID_TABLE` form for `ENT` (sequential: a 4-digit year and a counter of four or more digits), read
   from there and never copied, so `ENT-2026-10000` is a key and `ENT-2026-999` is not. */
const ENTITY_ID_RE = idPattern('ENT');

/** REC-16: WHAT A `supersedes` EDGE MUST CARRY.
 *
 *  Verified this pass and it is the reason this arm exists: before this item
 *  `supersedes` had ZERO occurrences in `store.mjs` and no producer at all.
 *  Membership of REL_VOCAB meant only that C-6.1 would not refuse the string —
 *  it never meant the edge was governed. So the first producer arrives together
 *  with the requirements, the way every state in the inquiry machine has
 *  arrived together with its entry requirements.
 *
 *  A REASON, because supersession is the heaviest member relation in the
 *  vocabulary: it says *this question replaced that one*, and an unexplained
 *  replacement is a change nobody can check. `links_to` is the precedent for
 *  requirements riding a rel; `sever with reason` is the precedent for the
 *  reason itself — the catalog already refuses moving an edge with no account.
 *
 *  A RESOLVABLE TARGET is the other half and is enforced in two places by
 *  construction rather than by agreement: C-6.2's resolver arm (record-grammar's references arm) catches it
 *  wherever a resolver is injected, and the store resolves it directly at the
 *  write. A supersedes edge to nothing points a reader at a question that does
 *  not exist, which is worse than no edge — it asserts a lineage. */
export function supersedesEdgeFindings(fm, findings) {
  const refs = Array.isArray(fm?.references) ? fm.references : [];
  refs.forEach((r, i) => {
    if (!r || typeof r !== 'object' || r.rel !== 'supersedes') return;
    if (typeof r.reason !== 'string' || r.reason.trim() === '') {
      findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.references_i_is_a_supersedes_p", "reference {i} links this inquiry as a replacement for another, with no reason given: a replacement with no account of why cannot be checked by anyone", { i: String(i) }),
        [localize("inquiry-grammar.grammar.author_the_reason_this_supersedes_p", "give the reason this replaces its target"), localize("inquiry-grammar.grammar.or_use_relates_to_which_p", "or use the relates-to link, which claims nothing about replacement")]));
    }
    if (typeof r.target !== 'string' || !BUNDLE_ID_RE.test(r.target)) {
      findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.references_i_is_a_supersedes_2_p", "reference {i} replaces '{String}', which is not a valid record reference: a replacement must name the inquiry it came from", { i: String(i), String: String(String(r.target).slice(0, 40)) })));
    }
  });
}


/** REC-16 / R4: THE DISCLOSURE, and it is this item's point rather than a
 *  detail.
 *
 *  A child of a division records its PARENT id AND its SIBLING ids, authored in
 *  `bundle.md` and projected through the ordinary promote path — the frontmatter
 *  keys REC-14 RESERVED (`division_parent`, `division_siblings`) with no
 *  producer, so the published shape would not change under readers once cases
 *  existed. This item is the producer.
 *
 *  THE REASONING INVERTS THE ARGUMENT FOR DIVISION. Division was justified as
 *  the mechanism that stops weakest-link composition forcing a member to
 *  overclaim or stay silent. The abuse is the SAME mechanism: dividing is a
 *  cheaper way to shed a finding that cuts against you than severing it, and a
 *  published child that discloses neither parent nor siblings defeats invariant
 *  7 with a housekeeping operation. A reader who can see one half of a divided
 *  inquiry must be able to see that the other half EXISTS.
 *
 *  WHAT THIS FUNCTION CAN AND CANNOT SEE. It is pure over one document, so it
 *  holds the disclosure's SHAPE: a supersedes edge and the division keys agree
 *  with each other, the sibling list is present and non-empty, and it names
 *  neither the child itself nor its parent. Whether the list is COMPLETE — every
 *  sibling of that division and not merely one — cannot be answered from the
 *  child alone; the store answers it at the write against the parent's own
 *  `division.into`, and refuses NO_SIBLING_DISCLOSURE. Both halves are needed:
 *  this one makes an incoherent child impossible to author, and that one makes a
 *  quietly incomplete one impossible to land. */
export function divisionDisclosureFindings(fm, findings) {
  /* SCOPED TO AN INQUIRY SUPERSEDING AN INQUIRY, which is the division shape and
     today the only shape supersession has: this item is `supersedes`'s first
     producer, and division is what it produces. An information object
     superseding another information object is a different claim about a
     different kind of thing, and it is governed by the edge requirements above
     (a reason and a resolvable target) without a disclosure it has nothing to
     disclose. If a later item gives INQUIRY supersession a second producer, this
     is the arm it has to argue with rather than route around — and the escape
     that already exists is `relates_to`, which claims no replacement at all. */
  if (normalizeType(fm?.object_type) !== 'inquiry') return;
  const refs = Array.isArray(fm?.references) ? fm.references : [];
  const supers = refs.filter((r) => r && typeof r === 'object' && r.rel === 'supersedes'
    && typeof r.target === 'string'
    && normalizeType(OBJECT_TYPES[r.target.split('-')[0]]) === 'inquiry');
  const parent = typeof fm?.division_parent === 'string' && fm.division_parent !== 'null' ? fm.division_parent : null;
  const sibsRaw = fm?.division_siblings;
  const sibs = Array.isArray(sibsRaw) ? sibsRaw.filter((x) => typeof x === 'string' && x !== '') : null;

  if (!parent && supers.length === 0) return;   // nothing to disclose, nothing claimed

  if (supers.length && !parent) {
    findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.this_document_carries_a_supersedes_p", "this inquiry replaces {target} but names no parent division: an inquiry that replaced another discloses which division it came out of, so a reader who can see one half can see that the other half exists", { target: String(supers[0].target) }),
      [localize("inquiry-grammar.grammar.set_division_parent_to_the_p", "name as the parent division the inquiry this was divided out of"), localize('inquiry-grammar.grammar.or_sever_the_supersedes_edge', 'or sever the supersedes edge')]));
  }
  if (parent && !supers.some((r) => r.target === parent)) {
    findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.division_parent_names_parent_with_p", "this inquiry names {parent} as its parent division, with no replacement link to it: the disclosure and the link are two views of one fact and cannot disagree", { parent: String(parent) }),
      [localize("inquiry-grammar.grammar.add_a_references_entry_rel_p", "add a reference that replaces {parent}, with its reason", { parent: String(parent) })]));
  }
  if (!parent) return;
  if (sibs === null || sibs.length === 0) {
    findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.division_parent_names_parent_and_p", "this inquiry names {parent} as its parent division and its sibling list is {v1}: a division produces at least two inquiries, so a child of one always has at least one sibling to name", { parent: String(parent), v1: String(sibs === null ? 'absent' : 'empty') }),
      [localize("inquiry-grammar.grammar.name_every_other_child_of_p", "name every OTHER child of this division in the sibling list")]));
    return;
  }
  for (const s of sibs) {
    if (!BUNDLE_ID_RE.test(s)) findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.division_siblings_names_string_which_p", "the sibling list names '{String}', which is not a valid record reference", { String: String(String(s).slice(0, 40)) })));
    if (s === parent) findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.division_siblings_names_s_which_p", "the sibling list names {s}, which is this inquiry's parent division: the parent is disclosed as the parent, and listing it as a sibling would hide that one of the halves is missing", { s: String(s) })));
    if (typeof fm.id === 'string' && s === fm.id) findings.push(f('C-6.1', 'error', localize("inquiry-grammar.grammar.division_siblings_names_this_document_p", "the sibling list names this inquiry itself: a sibling list that counts the inquiry can look complete while a real sibling is absent")));
  }
}

/** C-15: recheck coverage on inquiries (né Focuses), all dispositions.
 *  The comparison is against 'inquiry' because normalizeType now maps both
 *  legacy spellings there — left at 'focus' this check would silently stop
 *  firing for every document, old and new. */
export function checkRecheckCoverage(ctx, findings) {
  if (normalizeType(ctx.fm?.object_type) !== 'inquiry') return;
  const rts = Array.isArray(ctx.fm.recheck_triggers) ? ctx.fm.recheck_triggers : [];
  if (rts.length === 0) {
    findings.push(f('C-15.1', 'error', localize('inquiry-grammar.grammar.every_problem_in_every_disposition', 'every Problem, in every disposition including dismissed, carries at least one recheck trigger'), [localize('inquiry-grammar.grammar.author_a_trigger_dual_audience', 'author a trigger, dual-audience shape, dated when time-bound')]));
    return;
  }
  for (let i = 0; i < rts.length; i++) {
    const t = rts[i];
    if (typeof t !== 'object' || !t?.text || !t?.description) {
      findings.push(f('C-15.1', 'error', localize("inquiry-grammar.grammar.recheck_triggers_i_lacks_the_p", "recheck trigger {i} lacks its text or its description: every trigger has both", { i: String(i) })));
    } else if (t.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date))) {
      findings.push(f('C-15.1', 'error', localize("inquiry-grammar.grammar.recheck_triggers_i_date_date_p", "recheck trigger {i} has the date '{date}', which is not in the form YYYY-MM-DD", { i: String(i), date: String(t.date) })));
    } else if (t.date !== undefined && !isCalendarDate(String(t.date))) {
      /* R3 (T33-43, §7 item 6): shaped as a date and naming no day of the calendar (`2026-02-31`, `2026-13-01`), as
         civil-time judges it. Its own sentence, so the shape's sentence above stays the catalogue's. */
      findings.push(f('C-15.1', 'error', localize("inquiry-grammar.grammar.recheck_triggers_i_date_date_2_p", "recheck trigger {i} has the date '{date}', which is not a real calendar date", { i: String(i), date: String(t.date) })));
    }
  }
}

/* C-6 (T33-43): a date is a calendar date as civil-time judges it (its R6), never a shape alone. */
const isDate = (v) => typeof v === 'string' && isCalendarDate(v);

/* C-2.8, renamed from checkFocusExtension by REC-10. Keeps surfaced_by and
   disposition_reason exactly as the focus contract had them; REC-11 adds the
   basis[] leg grammar via checkInquiryBasis below, and REC-13 the CONCLUDED
   entry requirements. `completeness` (published) and the division fields
   arrive with REC-14/16, each with its state.
   R6 (K775 (1)): `where`, when the C-2.8 slot's arm is called through record-core's `grammars()`, carries `rest()`,
   the slot's later claimants (`basis-versions`' grammar, its R43); it runs for an inquiry only, after the entry,
   division and subject-entity findings and before the leg grammar, where the catalogue called
   `basisVersionFindings`. With no `where` this runs as the catalogue's did, synchronously; with one whose `rest()`
   answers a promise, the leg grammar runs once it settles, and the promise is answered. */
export function checkInquiryExtension(ctx, findings, where) {
  if (normalizeType(ctx.fm?.object_type) !== 'inquiry') return;
  const fm = ctx.fm;
  if (!['agent', 'human'].includes(fm.surfaced_by)) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.surfaced_by_surfaced_by_is_p", "who surfaced this inquiry is '{surfaced_by}', which is not one of: agent, human", { surfaced_by: String(fm.surfaced_by) })));
  }
  if (['deferred', 'dismissed'].includes(fm.current_state)) {
    if (typeof fm.disposition_reason !== 'string' || fm.disposition_reason.trim() === '') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.current_state_state_requires_a_p", "the {current_state} state requires a non-empty reason", { current_state: String(fm.current_state) })));
    }
  }
  /* REC-13: the `concluded` ENTRY REQUIREMENTS, modelled on C-2.7's `verified`
     arm above — the state is not a label a document may simply wear, it is a
     claim the document has to be able to carry.
     - a CONCLUSION, because `concluded` with nothing concluded is a state
       change wearing an answer's clothes;
     - a FALSIFIER, because a finding that names nothing which would overturn
       it is a narrative rather than a result, and "less narrative" is a
       constraint on US (CLAUDE.md's stance). This is the requirement the
       item's negative control removes;
     - AT LEAST ONE BASIS LEG. DEC-22 is exactly what bounds this: an `open`
       inquiry may hold a claim with ZERO legs — a STANDING OBJECTIVE, legal
       and readable and never auto-anything — so the requirement fires HERE
       and only here. A conclusion resting on nothing is the overclaim this
       repository's primary threat model is about.
     An UNDETERMINED conclusion is stated as such in the prose, never faked to
     pass this gate; what is refused is silence, not uncertainty. */
  if (fm.current_state === 'concluded') {
    if (typeof fm.conclusion !== 'string' || fm.conclusion.trim() === '') {
      /* REC-56 / D-203's SWEEP, and this one is the HARDER half of the class:
         `concluded -> open` IS a legal edge (REC-13 added it — a conclusion is
         revisable), so the state machine does not refuse this advice. THE OP
         SURFACE DOES. `REOPENABLE_FROM` is promotion R51's frozen `["deferred",
         "dismissed"]` and excludes `concluded` DELIBERATELY and BY NAME:
         `deriveActs` does not publish `reopen` on a concluded inquiry in no case,
         and promotion's `#reopen` answers NOT_SET_DOWN with the reason — a conclusion quietly reverting to open
         still wearing its conclusion records nothing, and the edition machinery
         is where that move belongs. So the old repair told an operator to do
         exactly what the plane refuses, on an edge that looks legal, which is
         why reading repair strings against `STATES` alone would not have found
         it. affordances.mjs states the principle in its own words on
         REOPENABLE_FROM: *an act the catalog permits that no caller can perform
         is the state machine lying.* This is that sentence read backwards — a
         repair the catalog advises that no caller can perform.
         The replacement names no destination, so it cannot go stale if the FROM
         set changes. */
      findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.concluded_state_requires_a_non', 'concluded state requires a non-empty conclusion'),
        [localize("inquiry-grammar.grammar.author_the_conclusion_where_the_p", "author the conclusion where the document stands: reopening does not pick a concluded inquiry back up, and the record refuses that move, so there is no act that undoes the conclusion and the repair is made in place")]));
    }
    /* REC-117 / BOB 2026-09-17. THE FALSIFIER REQUIREMENT BECOMES A REQUIREMENT
       TO ACCOUNT FOR THE FALSIFIER, which is not the same as dropping it.
       Bob ruled NO_FALSIFIER overridable "either temporarily or in the
       published record", and the store's conclude() opens the door; this arm is
       the OTHER half, and the two must move together. The requirement is
       enforced twice on purpose (the old conclude suite's header recorded why), so
       breaking the store alone leaves the catalog refusing the bundle
       op=conclude just wrote, and breaking the catalog alone leaves op=conclude
       refusing the call.
       THREE OUTCOMES, and the middle one is the one this item is about:
         a falsifier is stated                 -> clean, exactly as before;
         none is stated and the ABSENCE is     -> clean, and the record says in
           attributed to a member with a date     whose name and on what date;
         none is stated and nothing accounts   -> the original error, unchanged
           for it                                 in code, severity and words.
       A HALF-RECORDED OVERRIDE IS AN ERROR IN ITS OWN RIGHT, and it is the arm
       that matters most: an override missing its actor or its date is a SILENT
       override — the record has stopped requiring a falsifier and has not said
       who decided that — which is the only wrong answer this ruling admits. It
       cannot arise from op=conclude, which writes both or neither; it is
       reachable by a hand-edited document, and that is exactly what the catalog
       is for. */
    const ovBy = typeof fm.falsifier_override_by === 'string' ? fm.falsifier_override_by.trim() : '';
    const ovAt = typeof fm.falsifier_override_at === 'string' ? fm.falsifier_override_at.trim() : '';
    const falsStated = typeof fm.falsifier === 'string' && fm.falsifier.trim() !== '';
    if (!falsStated && !ovBy && !ovAt) {
      findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.concluded_state_requires_a_non_2', 'concluded state requires a non-empty falsifier: a conclusion that names nothing which would overturn it cannot be checked by anyone, including its author'),
        [localize('inquiry-grammar.grammar.state_what_evidence_would_falsify', 'state what evidence would falsify this conclusion'),
         localize("inquiry-grammar.grammar.or_if_none_can_honestly_p", "or, if none can honestly be stated, record the absence: conclude with the no-falsifier option set, so the record carries who accepted it and when")]));
    } else if (!falsStated && !(ovBy && ovAt)) {
      findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.concluded_state_has_no_falsifier', 'concluded state has no falsifier and only a HALF-RECORDED override: an override missing its {v1} is a silent one, and a record that has stopped requiring a falsifier without saying who accepted that claims more than it can support', { v1: String(ovBy ? 'date' : 'member') }),
        [localize("inquiry-grammar.grammar.record_both_falsifier_override_by_p", "record both who accepted the missing falsifier and when, or state a falsifier")]));
    } else if (falsStated && (ovBy || ovAt)) {
      findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.concluded_state_carries_both_an', 'concluded state carries BOTH an authored falsifier and a record that none was stated: those are two contradictory claims about this finding and nothing may choose between them'),
        [localize("inquiry-grammar.grammar.remove_the_falsifier_override_by_p", "remove the record of who accepted the missing falsifier and when, if the falsifier stands"),
         localize('inquiry-grammar.grammar.or_clear_the_falsifier_if', 'or clear the falsifier if the absence is what the member meant to record')]));
    }
    if (!Array.isArray(fm.basis) || fm.basis.length < 1) {
      findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.concluded_state_requires_at_least', 'concluded state requires at least one basis leg: an open inquiry may rest on nothing (a standing objective), a conclusion may not'),
        [localize("inquiry-grammar.grammar.add_a_basis_leg_naming_p", "add a basis leg naming what the conclusion rests on, and the same target among the references")]));
    }
  }
  /* CASE-4 / DEC-72: AND THIS IS WHERE THE `case_id` REQUIREMENT SURVIVES. The
     membership claim is the PAIR, so a document asserting a case EDITION while
     naming no case would otherwise slip past the whole ceremony by being
     half-formed — the exact hole REC-44's `case_id` arm was written to close,
     arriving through the new door. It is refused here, before the ceremony, and
     it names what is missing rather than what is present. */
  /* CASE-5b / DEC-72, 2026-09-10: THE ARM IS CORRECTED AND POINTS THE OTHER WAY
     NOW, AND THE OLD ONE IS WORTH SAYING OUT LOUD BECAUSE IT WAS RIGHT.

     WHAT IT USED TO SAY: `case_edition` with no `case_id` beside it names an
     edition of no case, so refuse it — membership was the PAIR and a half-formed
     claim would otherwise slip past the whole ceremony. That was exactly true
     while op=publish stamped both into every member.

     WHY IT IS WRONG NOW: this item removes BOTH from finding bytes. A finding's
     bytes no longer name a case at all — the case's assertions live in a case
     document a member signs (CASE-5b), which is the signature those facts had
     nowhere to move to until now. So the shape the old arm refused is no longer
     "half a membership claim", and the shape it ALLOWED — both fields present —
     is now the one that must not exist.

     IT IS A REFUSAL RATHER THAN AN ABSENCE, and that is the load-bearing part.
     If the gate merely stopped requiring these fields, a document carrying a
     stale `case_id` would sail through and every reader that still looks for one
     would find a case identity nothing in this plane wrote or checked — the
     second-authority drift D-21 names, arriving through bytes rather than
     through a table. Refused here, the deletion is a property of the FORMAT and
     not a property of op=publish remembering not to write it. */
  for (const k of ['case_id', 'case_edition', 'case_project', 'case_scope', 'case_findings', 'case_roles',
                   'bias_acknowledgement', 'required_strength']) {
    const v = fm?.[k];
    if (v === undefined || v === null || v === '' || v === 'null') continue;
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.a_finding_s_bytes_name_p", "this inquiry carries case facts of its own: since the case document took over, the case's identity, edition, producing project, scope, roster, load-bearing partition, bias acknowledgement and bar are signed once, in the case document a member reviews and ratifies, and not in each member's front matter. An inquiry is a member of a case because the case pinned its version, and that pin is inside the bytes the case's signer signed", { k: String(k) }),
      [localize("inquiry-grammar.grammar.remove_k_from_this_documents_p", "remove the case facts from this inquiry", { k: String(k) }),
       localize("inquiry-grammar.grammar.the_case_states_these_facts_p", "the case states these facts once, in its own signed document")]));
  }
  /* REC-16: the `divided` ENTRY REQUIREMENTS, on the same principle again — a
     state is not a label a document may wear. What `divided` claims is that
     this question was two questions and that every leg it rested on now lives
     on a child, so the document has to be able to carry BOTH halves of that:
     the division itself, and the account of where every leg went. */
  if (fm.current_state === 'divided') checkDividedExtension(fm, findings);
  /* REC-18 / DATA-MODEL D1(b): THE SUBJECT ENTITY, and it is one OPTIONAL
     scalar rather than a block, a list or a table.
     - OPTIONAL because DEC-15 rules exactly what its absence costs: "an inquiry
       with no subject entity simply has no A/B/C available to it, which is
       honest." Requiring it would make the price a GATE, and a gate that
       pressures a member into naming a subject they have not established is the
       bug CLAUDE.md names about the publication fence.
     - A SCALAR, singular, because the earned grade is "the strongest resolution
       of that document's captures to THE inquiry's subject entity". With a list,
       "strongest across all subjects" would let an A earned about a tangential
       subject be laundered into a leg about the question's real one. A question
       with two subjects is two questions, and the record already has an act for
       that (op=inquirydivide, REC-16).
     - NO JUSTIFICATION FIELD, unlike entity_relations. A declared relation is
       CONSTITUTIVE — the group fixing what its own statements mean — and D-83
       requires it justified and cited. Naming what a question is about asserts
       nothing about the world and carries no grade; it is addressing. */
  if (fm.subject_entity !== undefined && fm.subject_entity !== null && fm.subject_entity !== '') {
    if (typeof fm.subject_entity !== 'string' || !ENTITY_ID_RE.test(fm.subject_entity)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.subject_entity_string_is_not_p", "the subject entity '{String}' is not an entry in the subject registry", { String: String(String(fm.subject_entity).slice(0, 40)) }),
        [localize("inquiry-grammar.grammar.point_subject_entity_at_an_p", "point the subject entity at an entry in the subject registry (create one, or find one by alias), or leave it out: an inquiry may name no subject, and then no leg of it earns an A/B/C connection grade")]));
    }
  }
  const sub = where && typeof where.rest === 'function' ? where.rest() : null;
  if (sub && typeof sub.then === 'function')
    return sub.then(() => checkInquiryBasis(fm, findings, ctx.publishedRegistry, ctx.earnedRegistry));
  checkInquiryBasis(fm, findings, ctx.publishedRegistry, ctx.earnedRegistry);
}

/** REC-16 / DEC-28 / R4: what a `divided` parent must be able to say.
 *
 *  TWO TOP-LEVEL KEYS, and the split is forced by the restricted frontmatter
 *  grammar rather than chosen: a block is a map of scalars or an array of
 *  objects, never a map holding an array of objects. So `division` is the map
 *  (the act: into, apportioned_by, at, reason) and `division_apportionment` is
 *  the array (the account: one row per leg, naming the child it went to) —
 *  exactly the shape REC-14's `completeness` / `completeness_excluded` pair
 *  takes, for exactly the same reason.
 *
 *  WHY THE APPORTIONMENT IS A GATE AND NOT MERELY AN OP BEHAVIOUR. R4's whole
 *  argument is that division and severance do not substitute, because
 *  *"every leg gets a home… Neither is not"*: severance REMOVES material from a
 *  question, division only RE-HOMES all of it. The abuse it blocks is that
 *  dividing would otherwise be a cheaper way to shed a finding that CUTS
 *  AGAINST you than severing it. That protection is worth nothing if it lives
 *  only in the op — a hand-written document could then wear `divided` while
 *  quietly dropping the inconvenient leg — so the requirement is that EVERY
 *  ORD in basis[] is accounted for. Ord, not target: duplicate targets are
 *  legal by design (D4 — one document, two legs), and keying on the target
 *  would let one row discharge two legs.
 *
 *  NO PER-LEG REASON (DEC-29). One authored reason for the whole division; the
 *  per-leg judgment is recorded per leg IN THE APPORTIONMENT ITSELF, and the
 *  counterweight to the friction asymmetry with severance is DISCLOSURE, not
 *  ceremony. Nothing here should be read as an invitation to add one. */
function checkDividedExtension(fm, findings) {
  const d = (typeof fm.division === 'object' && fm.division && !Array.isArray(fm.division)) ? fm.division : null;
  if (!d) {
    findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.divided_state_requires_a_division', 'divided state requires a division block: a question recorded as divided with no account of the division is a state change wearing a correction\'s clothes'),
      /* REC-56 / D-203's sweep, third site: `divided` is TERMINAL — `divided:
         []` — so `divided -> open` is not an edge and C-4.2 refuses it by name,
         the same shape as `verified -> collected`. It is terminal
         STRUCTURALLY rather than by policy (the parent's legs are owned by its
         children now), so this is the one arm in the family where no state move
         exists in either direction and the honest advice says so.
         The first repair is UNCHANGED and is not a directive to run the op now
         — `op=inquirydivide` does not apply at `divided` either — it states
         where a division block legitimately comes from, which is C-20.1's
         `re-produce the creation at collected` shape exactly. */
      [localize("inquiry-grammar.grammar.divide_through_op_inquirydivide_which_p", "divide the inquiry with the divide act, which writes the division and records who apportioned it and when"),
       localize("inquiry-grammar.grammar.restore_the_division_block_from_p", "restore the division block from the inquiry's history if the division was made and the block was lost"),
       localize("inquiry-grammar.grammar.otherwise_raise_it_the_repair_p", "otherwise raise it: the repair here is not a state move, and the state machine refuses any transition it does not carry")]));
    return;
  }
  const into = Array.isArray(d.into) ? d.into.filter((x) => typeof x === 'string') : [];
  if (into.length < 2) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_into_names_length_child_p", "the division names {length} child{v1}: a division produces at least two inquiries, because one is a rename and none is a deletion", { length: String(into.length), v1: String(into.length === 1 ? '' : 'ren') }),
      [localize('inquiry-grammar.grammar.name_every_child_the_question', 'name every child the question was divided into')]));
  }
  for (const id of into) {
    if (!BUNDLE_ID_RE.test(id)) findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_into_names_string_which_p", "the division names '{String}', which is not a valid record reference", { String: String(String(id).slice(0, 40)) })));
  }
  if (new Set(into).size !== into.length) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_into_names_the_same_p", "the division names the same child twice: a leg apportioned to a child named twice has one home, not two")));
  }
  if (typeof d.reason !== 'string' || d.reason.trim() === '') {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_requires_a_non_empty_p", "division requires a non-empty reason: the reason belongs to the act of dividing, and a restructuring nobody accounted for is indistinguishable from one nobody should have made"),
      [localize('inquiry-grammar.grammar.author_the_reason_the_question', 'author the reason the question was two questions')]));
  }
  /* REC-46: one predicate, and the blank arm stays its own — absent is not
     machine, and "nobody apportioned" is a different finding from "a machine
     did". `isMachineIdentity` answers false for blank precisely so this reads
     as it always has. */
  if (typeof d.apportioned_by !== 'string' || d.apportioned_by.trim() === '' || isMachineIdentity(d.apportioned_by)) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_apportioned_by_apportioned_by_p", "the person who apportioned the division is '{apportioned_by}', which is not a named member: apportionment is authored and never automatic, so the record carries the name of whoever decided where each leg went", { apportioned_by: String(d.apportioned_by) })));
  }
  if (!ISO_TS_RE.test(String(d.at || ''))) {
    findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.division_requires_at_as_an', 'division requires \'at\' as an ISO timestamp (got \'{at}\')', { at: String(d.at) })));
  }
  /* THE ACCOUNT. Every leg the parent rested on, including — and this is the
     abuse R4 blocks — every leg whose role is `cuts_against`. */
  const legs = Array.isArray(fm.basis) ? fm.basis : [];
  const rows = Array.isArray(fm.division_apportionment) ? fm.division_apportionment : null;
  if (!rows) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.divided_state_requires_a_division_2_p", "a divided inquiry must say where every leg went: the parent records it in the apportionment, because dividing must not be a cheaper way to shed a finding that cuts against you than severing it"),
      [localize('inquiry-grammar.grammar.author_one_apportionment_row_per', 'author one apportionment row per basis leg, naming the child it went to')]));
    return;
  }
  const homes = new Map();            // ord -> Set(child)
  rows.forEach((r, i) => {
    if (!r || typeof r !== 'object') { findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_apportionment_i_is_not_p", "apportionment row {i} is not an object", { i: String(i) }))); return; }
    if (!Number.isInteger(r.ord) || r.ord < 0 || r.ord >= legs.length) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_apportionment_i_ord_ord_p", "apportionment row {i} names leg {ord}, which is not a leg of this inquiry's basis (0 to {v1}): a leg is addressed by its position, because one document legitimately carries two legs", { i: String(i), ord: String(r.ord), v1: String(legs.length - 1) })));
      return;
    }
    if (typeof r.to !== 'string' || !into.includes(r.to)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_apportionment_i_to_to_p", "apportionment row {i} sends its leg to '{to}', which is not one of the children named in the division: a leg's home is a child of THIS division", { i: String(i), to: String(r.to) })));
      return;
    }
    const leg = legs[r.ord];
    if (leg && typeof leg === 'object' && typeof r.target === 'string' && r.target !== leg.target) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_apportionment_i_names_target_p", "apportionment row {i} names '{target}' for leg {ord}, where the basis carries '{target_2}': the account and the basis are two views of one document and cannot disagree", { i: String(i), target: String(r.target), ord: String(r.ord), target_2: String(leg.target) })));
    }
    if (!homes.has(r.ord)) homes.set(r.ord, new Set());
    homes.get(r.ord).add(r.to);
  });
  const orphans = [];
  for (let i = 0; i < legs.length; i++) if (!homes.has(i)) orphans.push(i);
  if (orphans.length) {
    const cutting = orphans.filter((i) => legs[i] && legs[i].role === 'cuts_against');
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_leg_v1_orphans_v2_p", "basis leg{v1} {orphans} {v2} no home in the apportionment{v3}: every leg gets a home on a child, because division moves material to a child and only severance removes it", { v1: String(orphans.length === 1 ? '' : 's'), orphans: String(orphans.join(', ')), v2: String(orphans.length === 1 ? 'has' : 'have'), v3: String(cutting.length ? localize('inquiry-grammar.grammar.including_length_that_cutv1_against', ' (including {length} that cut{v1} AGAINST this inquiry)', { length: String(cutting.length), v1: String(cutting.length === 1 ? 's' : '') }) : '') }),
      [localize('inquiry-grammar.grammar.apportion_the_remaining_leg_s', 'apportion the remaining leg(s) to a child'), localize('inquiry-grammar.grammar.or_sever_them_with_a', 'or sever them with a reason, which is the act that removes material')]));
  }
  const empty = into.filter((c) => ![...homes.values()].some((s) => s.has(c)));
  if (empty.length) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.division_into_names_empty_which_p", "the children of the division include {empty}, which received no leg of the parent's basis: a child that inherits nothing is a new inquiry, not a half of this one", { empty: String(empty.join(', ')) })));
  }
}

/* Which axis each earned source is a source FOR. A resolution is the framework's
   §8.1 CONNECTION grade and nothing else; a capture grade is a property of an
   INFORMATION object (DEC-21) and nothing else. Stated as data rather than as
   two hand-written conditionals so the pairing has one home. */
export const EARNED_SOURCE_AXIS = { resolution: 'connection', capture: 'capture' };

/* REC-42 / DEC-32: a ground LABEL. Deliberately narrow — it is an identifier a
   member picks so two legs can say they belong together, not prose, and it
   appears inside derived sentences and inside frontmatter scalars. No quotes,
   no colons, no newlines, so nothing it names can break the block it is written
   in or smuggle punctuation into a sentence a reader trusts. */
export const GROUND_LABEL_RE = /^[a-z0-9][a-z0-9 _-]{0,47}$/i;

/* REC-11: the basis[] leg grammar, ONE function consulted by BOTH the checker
 * (via checkInquiryExtension above) and the store's op=promote write path —
 * the checkGatheringGrammar precedent — so a malformed leg never lands and the
 * two views cannot drift. Shape findings are C-2.8 (the inquiry extension);
 * the references[] subset arm is C-6.3, the rule that REPLACED the
 * elevated_into requirement (see record-grammar's `checkReferences`).
 *
 * The leg: {target, role, grade, grade_axis, grade_source, note, author, date}.
 * target is an INFO- or an inquiry-prefixed id — the inquiry target IS basis
 * recursion. role is invariant 7's storage: cuts_against is first-class. An
 * ABSENT or null grade is legal and means undetermined, STATED — never
 * invented to pass a gate. A PRESENT grade must say which axis it is on
 * (not derivable from target_type: connection grades legitimately sit on
 * INFO- legs — SB-OUTPUT 432-435) and where it came from. A hunch requires
 * its author and its date, refused BY NAME, because a hunch is only honest
 * while it announces itself; testimony is a member's signed account and is
 * grade D at no other value (DEC-15: hunch is the only authored grade
 * permitted above D). Duplicate targets are LEGAL by design — D4: a basis
 * legitimately cites one document for two legs, which is why this table has
 * an ordinal and refs could not carry it. */
/** REC-84 / IC-84 (1) — THE EXTENT GRAMMAR ON A LEG, AT BOTH LEG GRAINS.
 *
 *  A basis leg may say WHICH PART of its target it rests on. The grammar is
 *  IC-1's union flattened onto the leg (`legExtent` reads it; the restricted
 *  frontmatter grammar cannot carry a nested object, so the fields are scalars
 *  — the `completeness` / `division` precedent), plus the option of naming an
 *  already-minted part outright by its `content_id`.
 *
 *  ONE FUNCTION, TWO CHECK IDS, AND THAT PAIRING IS THE ITEM'S OWN RULE. C-2.8
 *  governs `basis[]` and C-25.10 governs `basis_version_legs[]`; they are two
 *  rules over two grains of one shape, and a second implementation of the
 *  grammar is the drift this repository has measured five times. The CHECK id is
 *  a parameter and the GRAMMAR is not.
 *
 *  IT RUNS THE CATALOGUE'S ONE CHECKER AND OWNS NO GRAMMAR OF ITS OWN.
 *  `checkContentExtent` is where an extent is judged, here and in the store
 *  alike; this function supplies the document-only context and re-labels the
 *  result. The two arms it adds on top are facts about the DOCUMENT and not
 *  about the extent — the shape of a named id, and a leg stating its referent
 *  twice.
 *
 *  WHY NAMING BOTH AN ID AND AN EXTENT IS REFUSED RATHER THAN RECONCILED. They
 *  are one fact written twice, and the record must never hold two authorities
 *  for one fact that can disagree — the `case_edition` and `refs`/`inquiry_basis`
 *  lessons, one construct down. Reconciling them would mean the plane silently
 *  preferring one, which is an authored citation moving without a member's act
 *  (Bob's 5.8). The id is the precise form and the extent is the descriptive
 *  one; a member uses whichever they have, never both.
 *
 *  AN ABSENT EXTENT IS `document` AND IS NEVER REFUSED (Bob's 5.3, no
 *  `unstated`), which is what makes every existing leg in the record promote
 *  byte-identically through this arm. */
export function checkLegExtentGrammar(leg, label, checkId, findings) {
  const bad = checkContentExtent(legExtent(leg), CONTENT_EXTENT_DOCUMENT_ONLY);
  if (bad)
    /* THE CODE TRAVELS AND THE C-NUMBER IS THE LEG GRAMMAR'S, and that pairing
       is a correction this item paid for rather than a design chosen up front.
       REC-82's arms assert that `dom` is refused BY NAME rather than as an
       unknown kind — a distinction a member meets as a different sentence and a
       machine meets as a different CODE. The first draft of this arm pushed a
       bare C-2.8 finding, the catalogue then fired BEFORE the store's own arm,
       and four of REC-82's assertions went red because the distinction had been
       flattened into one number. Carrying `f`'s fifth argument keeps both facts:
       the RULE is the leg grammar (which is what IC-84 moves), and the CODE is
       the content-extent family's, which is what carries the canned translation
       (DEC-49) and what tells `dom` from a typo. No new row and no new region:
       the code is MINTED in `checkContentExtent`'s own governed region and this
       is a RELAY of it — a relay given its own marker is the defect PL-18 was
       failed by name for. */
    findings.push(f(checkId, 'error', localize('inquiry-grammar.grammar.label_names_an_extent_this', '{label} names an extent this record cannot evaluate: {detail}', { label: String(label), detail: String(bad.detail) }),
      /* CORRECTED 2026-09-14 BY REC-85: this named two landed kinds because two
         were landed when REC-84 wrote it, and the other three landed the same
         day. GUIDANCE THAT NAMES A CLOSED LIST GOES STALE THE MOMENT THE LIST
         MOVES, and stale guidance is worse than none here — it tells a member
         citing a real cell that the record cannot hold the citation, which is
         false and would send them to the whole document instead. The list is
         COMPOSED FROM THE MAP rather than typed, so the next kind to land (or
         `dom`, the day CONTENT-HTML produces one) cannot leave this sentence
         behind: the same rule `describeChain` and the DEC-49 fence composer
         already follow — a sentence built from the value it describes cannot
         come to describe a different one. */
      [localize('inquiry-grammar.grammar.name_one_of_the_landed_p', 'name the part as one of these — {sort} — with the fields that arm takes', { sort: String(Object.values(CONTENT_EXTENT_KINDS)
        .filter((v) => v.landed).map((v) => v.human).sort().join('; ')) }),
       localize('inquiry-grammar.grammar.or_drop_the_extent_fields', 'or drop the extent fields entirely: a citation that names no part means the WHOLE document, which is always a legal thing to cite')],
      bad.code));
  const cid = leg && typeof leg === 'object' ? leg.content_id : undefined;
  if (cid !== undefined && cid !== null && cid !== '') {
    if (typeof cid !== 'string' || !CONTENT_ID_RE.test(cid.trim()))
      findings.push(f(checkId, 'error', localize("inquiry-grammar.grammar.label_content_id_string_is_p", "the content id on {label} ('{String}') is not a content id: a part of a document is named by the 64-character lowercase hexadecimal address this record gives it, and nothing shorter or longer can be one", { label: String(label), String: String(String(cid).slice(0, 40)) }),
        [localize('inquiry-grammar.grammar.copy_the_content_id_from', 'copy the content id from the part as this record answers for it'),
         localize("inquiry-grammar.grammar.or_describe_the_part_instead_p", "or describe the part instead — its kind and its fields — and the record will find or give the entry")]));
    else if (legHasAuthoredExtent(leg))
      findings.push(f(checkId, 'error', localize("inquiry-grammar.grammar.label_names_both_a_content_p", "{label} names BOTH a content id and an extent: these are one fact written twice and they can disagree, which would leave the record holding two answers to what this leg rests on", { label: String(label) }),
        [localize("inquiry-grammar.grammar.keep_the_content_id_it_p", "keep the content id — it names the part exactly"),
         localize("inquiry-grammar.grammar.or_keep_the_extent_fields_p", "or keep the extent fields and drop the content id — the record finds or gives the part they describe")]));
  }
}

export function checkInquiryBasis(fm, findings, publishedRegistry, earnedRegistry) {
  const legs = fm?.basis;
  /* R4 (K766, K775 (1)): the VERSION block is no longer called from here. It is `basis-versions`' own grammar (its
     R43), registered into the C-2.8 slot after this module and run at the sub-slot `checkInquiryExtension` offers
     (`rest()`, R6), exactly where this call stood: after the entry, division and subject-entity findings, before the
     grounds and the legs below. A caller that runs this function alone and wants the version rules runs
     `basis-versions`' grammar beside it. */
  /* REC-42: the grounds block is checked EVEN WITH NO BASIS. No basis is a
     legal open inquiry (DEC-22's standing objective), but a grounds[] block
     over no legs asserts independent sufficiency for nothing, and leaving it
     unchecked here would make "author the structure first" a way to leave an
     assertion in the record with nothing under it. */
  /* R11 (N522): a references[] entry naming an imported finding reference is refused, whatever the legs; such a leg's
     target is not a reference, so C-6.3 never asks it. Raised before the legs, so it holds for an inquiry with none. */
  importedReferenceFindings(fm, findings);
  /* R15 (T33-43): the same for a duty occurrence, which is not a reference either. */
  occurrenceReferenceFindings(fm, findings);
  if (legs === undefined || legs === null) { checkGrounds(fm, [], findings); return; }
  if (!Array.isArray(legs)) {
    findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.basis_is_not_an_array', 'basis is not an array')));
    return;
  }
  const refTargets = new Set((Array.isArray(fm.references) ? fm.references : [])
    .filter((r) => r && typeof r === 'object' && typeof r.target === 'string')
    .map((r) => r.target));
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (typeof leg !== 'object' || leg === null) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_is_not_an_p", "basis leg {i} is not an object", { i: String(i) })));
      continue;
    }
    /* MK-4 / C-54.1: a LEAD is refused BY NAME before the generic target grammar
       can answer "not a canonical record id" about it — see `leadLegFindings`. */
    if (leadLegFindings(`basis leg ${i}`, leg, findings)) continue;
    /* D-162 / C-81.1: a THEME, or membership in one, is refused BY NAME at the same door (§8.4 fence 4). */
    if (themeLegFindings(`basis leg ${i}`, leg, findings)) continue;
    /* R11 (N522): a leg on another group's finding is judged by its own arm IN PLACE OF the target arm below; role,
       note and grounds are asked as of any leg. The grade, axis, source, hunch, testimony, earned, inherited and
       extent arms stay silent: every field they judge is already one C-21.3 departure on such a leg, and a second
       complaint about one broken field helps nobody. */
    /* R14, R15 (T33-43), R17 (N582): a leg on a calculation, a duty occurrence or a derived connection is judged by its
       own arm in the same place and on the same terms: its grades are derived (strength, K1447; a derived connection's
       is its chain's), so every field the grade and extent arms judge is already one departure here. None is a
       reference (K1601), so C-6.3 asks none. */
    const label = `basis leg ${i}`;
    const derivedKind = importedLegFindings(label, leg, findings) || calculationLegFindings(label, leg, findings)
      || occurrenceLegFindings(label, leg, findings) || derivedConnectionLegFindings(label, leg, findings);
    if (derivedKind) {
      if (!BASIS_ROLES.includes(leg.role)) {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_role_role_is_p", "the role of basis leg {i} is '{role}', which is not one of: {BASIS_ROLES}", { i: String(i), role: words(leg.role), BASIS_ROLES: BASIS_ROLES.map(words).join(', ') })));
      }
      if (leg.note !== undefined && leg.note !== null && typeof leg.note !== 'string') {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_note_is_not_p", "the note on basis leg {i} is not text", { i: String(i) })));
      }
      /* R18 (D59): a bias application is judged on a derived leg as on any leg. */
      biasAppliedFindings(label, leg, findings);
      continue;
    }
    const t = leg.target;
    /* Hoisted out of the else below by REC-31: the capture-axis arm at the end
       of this loop asks the SAME question (what does this leg rest on), and a
       second derivation of it here would be a second answer waiting to
       disagree. Null while the target is unusable, so the arm below stays
       silent rather than adding a second complaint about one broken leg. */
    let targetType = null;
    if (typeof t !== 'string' || !BUNDLE_ID_RE.test(t)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_target_string_is_p", "basis leg {i} names '{String}', which is not a valid record reference", { i: String(i), String: String(String(t).slice(0, 40)) })));
    } else {
      const tt = targetType = normalizeType(OBJECT_TYPES[t.split('-')[0]]);
      /* R13 (K1447 (iii), T33-43): a held standard is a leg target, referenced like an information target and read
         as one by every other arm; its axis is judged below. */
      if (tt !== 'information' && tt !== 'inquiry' && tt !== 'standard') {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_target_t_is_p", "basis leg {i} names '{t}', which is a {tt}: a leg rests on information or on another inquiry, nothing else", { i: String(i), t: String(t), tt: String(tt) })));
      } else if (!refTargets.has(t)) {
        /* C-6.3 (the arm that replaced elevated_into): refs and inquiry_basis
           are projections of this one document and must not disagree. */
        findings.push(f('C-6.3', 'error', localize("inquiry-grammar.grammar.basis_i_target_t_is_2_p", "basis leg {i} names '{t}', which is not among the references: an inquiry carrying a basis leg carries the same target as a reference, so the two lists cannot disagree", { i: String(i), t: String(t) }),
          [localize("inquiry-grammar.grammar.add_a_references_entry_for_p", "add a reference for '{t}'", { t: String(t) }), localize('inquiry-grammar.grammar.remove_the_basis_leg', 'remove the basis leg')]));
      }
    }
    if (!BASIS_ROLES.includes(leg.role)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_role_role_is_2_p", "the role of basis leg {i} is '{role}', which is not one of: {BASIS_ROLES}", { i: String(i), role: words(leg.role), BASIS_ROLES: BASIS_ROLES.map(words).join(', ') })));
    }
    const graded = leg.grade !== undefined && leg.grade !== null;
    if (graded && !BASIS_GRADES.includes(leg.grade)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_grade_grade_is_p", "the grade of basis leg {i} is '{grade}', which is not one of: {BASIS_GRADES} (an empty grade means undetermined, and is stated as such)", { i: String(i), grade: String(leg.grade), BASIS_GRADES: BASIS_GRADES.join(', ') })));
    }
    if (leg.grade_axis !== undefined && leg.grade_axis !== null && !GRADE_AXES.includes(leg.grade_axis)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_grade_axis_grade_p", "the grade axis of basis leg {i} is '{grade_axis}', which is not one of: {GRADE_AXES}", { i: String(i), grade_axis: String(leg.grade_axis), GRADE_AXES: GRADE_AXES.join(', ') })));
    }
    if (leg.grade_source !== undefined && leg.grade_source !== null && !GRADE_SOURCES.includes(leg.grade_source)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_grade_source_grade_p", "the grade source of basis leg {i} is '{grade_source}', which is not one of: {GRADE_SOURCES}", { i: String(i), grade_source: String(leg.grade_source), GRADE_SOURCES: GRADE_SOURCES.join(', ') })));
    }
    /* R13: a standard's grade is the capture grade its captured text earns, and nothing else. A connection or
       testimony axis, or a hunch, is one departure, refused by name; the hunch, testimony, earned and inherited arms
       then stay silent on the leg (a second complaint about one broken field helps nobody). */
    const standardAxis = targetType === 'standard' && standardLegFindings(`basis leg ${i}`, leg, findings);
    if (graded) {
      if (!GRADE_AXES.includes(leg.grade_axis)) {
        /* MK-2: the axes are LISTED from the vocabulary rather than typed as a
           pair, so a third one cannot leave this sentence naming two. */
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_carries_a_grade_p", "basis leg {i} carries a grade with no grade axis: the axis is not derivable from the target, so a graded leg states which axis its grade is on ({GRADE_AXES})", { i: String(i), GRADE_AXES: GRADE_AXES.join(', ') })));
      }
      if (!GRADE_SOURCES.includes(leg.grade_source)) {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_carries_a_grade_2_p", "basis leg {i} carries a grade with no grade source: a grade with no account of where it came from is an invented one ({GRADE_SOURCES})", { i: String(i), GRADE_SOURCES: GRADE_SOURCES.join(', ') })));
      }
    }
    /* REC-31, from REC-12's landing. CAPTURE RANGES OVER DOCUMENTS (DEC-21):
       it measures how directly the record holds the bytes of an information
       object. An inquiry is not a document — it has no capture, no fidelity
       and nothing to have been captured FROM — so a capture-axis grade
       authored on an INQ- leg is a grade about no referent, and the record
       must not hold a strength claim about a thing that cannot have one.
       REFUSED HERE, at the leg's own grammar, which is BOTH gates at once:
       this one function is consulted by the catalog (checkInquiryExtension)
       and by the store's op=promote write path, so a leg like this cannot
       land and cannot audit clean either. Stated as the axis being wrong
       rather than the target: a leg to another inquiry is perfectly gradable
       — on CONNECTION, which is what a leg to an inquiry is an edge of.
       Why refuse rather than derive around it: REC-12's #strengthWalk names
       such a leg not load-bearing on capture, which was the honest reading
       while nothing refused the combination, but the axis was still AUTHORED
       and the derivation was quietly deciding it meant nothing. The
       derivation KEEPS that arm (history is append-only and a replayed
       revision may carry such a row), and this refusal is what stops new
       ones. */
    /* AMENDED AT THE REC-14 MERGE, and it narrows the arm by exactly one case
       rather than softening it. REC-31 wrote this rule when every grade_source
       was an AUTHORED one (resolution, testimony, hunch), and for all three it
       is unconditional: a member asserting a capture grade about an inquiry is
       asserting fidelity for bytes that do not exist. `inherited` did not exist
       then. An INHERITED capture grade is not a claim about the inquiry at all
       — it is the capture axis THAT CASE FROZE over ITS OWN documents when the
       group signed the edition being cited, which ranges over documents exactly
       as DEC-21 requires, and C-21.2 refuses it if it is stronger than the
       frozen value. It is carried on the leg rather than re-derived because a
       leg citing edition 1 must not silently follow edition 2 (DEC-12). So the
       one case where the axis HAS a referent is admitted, and every authored
       one is refused as before. */
    if (leg.grade_axis === 'capture' && targetType === 'inquiry' && leg.grade_source !== 'inherited') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_capture_p", "basis leg {i} states a capture-axis grade on an inquiry leg: capture is a property of an information object and an inquiry is not one, so this grade has no referent", { i: String(i) }),
        [localize('inquiry-grammar.grammar.grade_this_leg_on_the', 'grade this leg on the connection axis — a leg to another inquiry is a connection'),
         localize('inquiry-grammar.grammar.move_the_capture_grade_onto', 'move the capture grade onto the INFO- leg it is actually about')]));
    }
    /* MK-2: THE SAME RULE FOR THE THIRD AXIS, and for REC-31's reason exactly.
       A testimony grade is a fact about an AUTHORED DOCUMENT — whose words these
       bytes are — and an inquiry is not a document, so a testimony grade
       authored on an INQ- leg has no referent. The one case with a referent is
       admitted as it is on capture: an INHERITED testimony axis, which is the
       axis a published case froze over its own documents (checkInheritedLeg). */
    if (leg.grade_axis === 'testimony' && targetType === 'inquiry' && leg.grade_source !== 'inherited') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_p", "basis leg {i} states a testimony-axis grade on an inquiry leg: testimony is a property of a member's authored observation, which is a document, and an inquiry is not one, so this grade has no referent", { i: String(i) }),
        [localize('inquiry-grammar.grammar.rest_this_leg_on_the', 'rest this leg on the observation itself (its INFO- id)'),
         localize('inquiry-grammar.grammar.or_grade_this_leg_on', 'or grade this leg on the connection axis — a leg to another inquiry is a connection')],
        'testimony-axis-no-referent'));
    }
    /* REC-18: THE CAPTURE AXIS IS NEVER AUTHORED, and this arm is what closes
       it. Together with checkEarnedLeg's axis pairing (which refuses
       `resolution` here, because a resolution is a §8.1 CONNECTION grade), the
       capture axis now admits exactly two sources: `capture`, EARNED from the
       capture record, and `inherited`, taken from a published case's frozen
       capture axis. Neither is a member's assertion.
       WHY THE AUTHORED SOURCES ARE REFUSED RATHER THAN TOLERATED. A capture
       grade states HOW THE BYTES REACHED US (SB-EVIDENCE 602-607) — a fact
       about this record's own machinery, which the record holds and a member
       does not. Testimony is a member's account of a CONNECTION they can vouch
       for; a hunch is a member's provisional CONNECTION. Neither can be an
       account of a fetch. Left tolerated, the one thing this record must never
       do — claim more than it can support — was a member typing `A` beside a
       document, against the landed doctrine that grade A is not reachable at
       all here (CAPTURE-FIDELITY.md; index.mjs's own capture note). */
    if (leg.grade_axis === 'capture' && graded && !standardAxis
        && (leg.grade_source === 'testimony' || leg.grade_source === 'hunch')) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_capture_2_p", "basis leg {i} states a capture-axis grade with grade source '{grade_source}': a capture grade says how the bytes reached us, which is a fact this record holds about its own machinery and not one a member can assert. {v1}, and neither is an account of a fetch", { i: String(i), grade_source: String(leg.grade_source), v1: String(leg.grade_source === 'testimony' ? localize('inquiry-grammar.grammar.testimony_is_a_member_s', 'Testimony is a member\'s account of a connection') : localize('inquiry-grammar.grammar.a_hunch_is_a_member', 'A hunch is a member\'s provisional connection')) }),
        [localize("inquiry-grammar.grammar.use_grade_source_capture_the_p", "use grade source: capture — the capture axis is earned from the capture record, and the earned-basis check says what it earns"),
         localize('inquiry-grammar.grammar.or_move_this_grade_onto', 'or move this grade onto the connection axis, where testimony and hunches belong')]));
    }
    if (leg.grade_source === 'hunch' && !standardAxis) {
      if (typeof leg.author !== 'string' || leg.author.trim() === '') {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_is_a_hunch_p", "basis leg {i} is a hunch with no author: a hunch is declared bias and carries the name of the member declaring it", { i: String(i) })));
      }
      if (!isDate(String(leg.date ?? ''))) {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_is_a_hunch_2_p", "basis leg {i} is a hunch with no date: a hunch is temporary by construction and carries the date it was declared, YYYY-MM-DD", { i: String(i) })));
      }
    }
    /* MK-2: SILENT ON THE TESTIMONY AXIS, where checkTestimonyLeg refuses the
       same letter BY NAME and says why in the axis's own terms — a second
       complaint about one broken leg helps nobody. The rule is unchanged: the
       letter is TESTIMONY_GRADE on every axis a testimony can sit on. */
    if (leg.grade_source === 'testimony' && graded && leg.grade !== TESTIMONY_GRADE
        && leg.grade_axis !== 'testimony' && !standardAxis) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_testimony_at_p", "basis leg {i} states testimony at grade {grade}: a member's testimony is grade {TESTIMONY_GRADE} at no other value — a hunch is the only authored grade permitted above {TESTIMONY_GRADE_2}", { i: String(i), grade: String(leg.grade), TESTIMONY_GRADE: String(TESTIMONY_GRADE), TESTIMONY_GRADE_2: String(TESTIMONY_GRADE) })));
    }
    /* REC-18, the OTHER half of the same rule and it is what makes "always D"
       mean something. The arm above refuses a testimony leg that states A/B/C;
       this one refuses a testimony leg that states NOTHING. A grade_source with
       no grade claims to account for a grade that is not there, and for
       testimony it is worse than incoherent: the leg would sit in the record
       carrying a member's name and date beside no assertion, which reads as an
       ungraded (INERT, DEC-18) leg while looking like an act. `inherited` has
       been refused for exactly this since REC-14 (checkInheritedLeg below);
       this extends the same refusal to the two sources that can stand alone.
       An honestly undetermined leg states NO grade AND NO grade_source. */
    if ((leg.grade_source === 'testimony' || EARNED_GRADE_SOURCES.includes(leg.grade_source)) && !graded) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_grade_source_p", "basis leg {i} states a grade source '{grade_source}' with no grade: a source is an account of where a grade came from, and there is no grade here to account for", { i: String(i), grade_source: String(leg.grade_source) }),
        [localize('inquiry-grammar.grammar.state_the_grade_this_source', 'state the grade this source produced'), localize("inquiry-grammar.grammar.or_drop_grade_source_an_p", "or drop the grade source — an undetermined leg states neither, and is read as present and not yet load-bearing")]));
    }
    if (leg.note !== undefined && leg.note !== null && typeof leg.note !== 'string') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_note_is_not_2_p", "the note on basis leg {i} is not text", { i: String(i) })));
    }
    /* R18 (D59): the bias statements applied at this leg, their form only; it moves no grade, so the grade arms around
       it judge the leg's stated grade exactly as without it. */
    biasAppliedFindings(label, leg, findings);
    /* REC-84 / IC-84 (1): THE EXTENT, at C-2.8 and through the ONE checker. The
       bundle-id target grammar above is KEPT exactly as it was — the leg still
       names a document or another question — and this adds WHICH PART of it.
       Run unconditionally, including on a leg whose target was refused above: an
       extent is a fact about the leg's own bytes and does not need the target to
       resolve, and a member who typed `extent_kind: pdf-pge` should be told so
       in the same pass rather than on the next one. */
    checkLegExtentGrammar(leg, `basis leg ${i}`, 'C-2.8', findings);
    /* MK-2: BEFORE checkEarnedLeg, so a capture letter on an authored
       observation is refused BY NAME as what it is, rather than as a generic
       undetermined capture — and checkEarnedLeg stays silent on that one case. */
    if (standardAxis) continue;
    checkTestimonyLeg(leg, i, graded, targetType, earnedRegistry, findings);
    checkEarnedLeg(leg, i, graded, targetType, earnedRegistry, findings);
    checkInheritedLeg(leg, i, graded, publishedRegistry, findings);
  }
  checkGrounds(fm, legs, findings);
}

/** REC-42 / DEC-32: THE RELATIONSHIP BETWEEN LEGS, and the act that asserts it.
 *
 *  Bob ruled the arithmetic: *"sometimes the weakest is the claim's strength,
 *  and other times it's not. The difference is really whether the relationship
 *  between legs is AND or OR."* So a leg may name a GROUND, legs sharing a
 *  ground are AND-related (the ground is no stronger than its weakest leg), and
 *  the grounds are OR-related (the finding is as strong as its STRONGEST
 *  ground, because each is independently sufficient for the same conclusion).
 *
 *  THIS FUNCTION EXISTS BECAUSE OR TAKES THE MAXIMUM. Every other grammar arm
 *  in this file guards a claim that can only be as strong as what it rests on;
 *  a ground label is the one thing a member can write that makes a finding
 *  STRONGER. DEC-32's anti-gaming keystone is therefore a correctness
 *  requirement rather than a preference: **an unstructured basis stays
 *  weakest-leg, and independent sufficiency is only ever reached by an
 *  AFFIRMATIVE, ATTRIBUTED act.** Hence the `grounds[]` block — one row per
 *  label, carrying the NAME of the member who asserts that ground stands on its
 *  own and the DATE they asserted it, which is the same accountability shape as
 *  the conclusion itself. A label with no row is refused: strengthening by
 *  omission, by default, or by a member not understanding a question is exactly
 *  what must be impossible.
 *
 *  TWO TOP-LEVEL KEYS, forced by the restricted frontmatter grammar rather than
 *  chosen: `ground` is a scalar ON THE LEG (the partition) and `grounds` is an
 *  array of objects (the act), because the grammar cannot carry a map holding an
 *  array of objects. Exactly REC-14's `completeness`/`completeness_excluded` and
 *  REC-16's `division`/`division_apportionment` split, for the same reason.
 *
 *  THE PARTITION NEED NOT COVER THE LEGS (R68, fix round 10, cause 30b; DEC-32
 *  clause 4: the default is AND, independent sufficiency is claimed per branch).
 *  A supporting leg that names no ground, beside legs that do, is a NECESSARY
 *  leg of the basis, and the unlabelled supporting legs together are its one
 *  necessary part, as the strength arithmetic already computes it. It is no
 *  finding. What stays refused is each ground's own accounting: declared once,
 *  none empty, a leg naming a ground naming a declared one. A leg that cuts
 *  against is never in a ground, and naming one there is refused.
 *
 *  WHAT IS DELIBERATELY NOT HERE. No per-ground FALSIFIER: DEC-32 is explicit
 *  that minting one per ground reads as more honest and is less — it converts
 *  one checkable compound falsifier (*every ground fails*) into several partial
 *  ones, none of which refutes the finding. No per-ground grade: a ground's
 *  strength is DERIVED from its legs and never authored. And no AND/OR
 *  vocabulary reaches any member-facing surface — that is UI-27's elicitation
 *  half, which asks the member about CONSEQUENCES and derives this structure
 *  from their answers.
 *
 *  Q14's contradiction case stays SEPARATE and UNDESIGNED: grounds AGREE on the
 *  conclusion, and two conclusions disagreeing is a different thing entirely.
 *  Nothing here should be read as modelling it. */
function checkGrounds(fm, legs, findings) {
  const rows = fm?.grounds;
  const labelled = [];        // [i, label] for every leg that names a ground
  legs.forEach((leg, i) => {
    if (!leg || typeof leg !== 'object') return;
    const g = leg.ground;
    /* R68 (K4194): a leg that cuts against is not a reason FOR the conclusion, so it never belongs to a ground and the
       totality below counts the other legs only. Naming one in a ground is its own finding. */
    if (leg.role === 'cuts_against') {
      if (g !== undefined && g !== null && g !== '') {
        findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_cuts_against_ground_p", "basis leg {i} cuts against the conclusion, so it is not a reason for it and belongs to no ground, but it names the ground '{ground}'", { i: String(i), ground: String(typeof g === 'string' ? g.slice(0, 60) : g) }),
          [localize("inquiry-grammar.grammar.take_the_passage_out_of_its_ground_first", "take basis leg {i} out of its ground first: a ground groups only the passages that support the conclusion. Then put the passage on the side that cuts against it", { i: String(i) })],
          'CUTTING_LEG_IN_GROUND'));   // R70 (T52-20; K5332): its own code, so a screen maps it by the code and never by the English
      }
      return;
    }
    if (g === undefined || g === null || g === '') return;   // R68: an unlabelled supporting leg is a necessary leg, no finding
    if (typeof g !== 'string' || !GROUND_LABEL_RE.test(g)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_ground_string_is_p", "the ground on basis leg {i}, '{String}', is not a ground label: up to 48 characters of letters, digits, spaces, '-' and '_', naming the branch of the argument this leg belongs to", { i: String(i), String: String(String(g).slice(0, 60)) })));
      return;
    }
    labelled.push([i, g]);
  });
  if (rows === undefined || rows === null) {
    if (labelled.length) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_leg_v1_map_name_p", "basis leg{v1} {map} name{v2} a ground, but there is no grounds section: grounds compose as alternatives, so a finding takes its strongest ground rather than its weakest leg, and that is only ever reached by an affirmative, attributed act. Nothing may become stronger because a field was written and nobody signed for it", { v1: String(labelled.length === 1 ? '' : 's'), map: String(labelled.map(([i]) => i).join(', ')), v2: String(labelled.length === 1 ? 's' : '') }),
        [localize("inquiry-grammar.grammar.author_a_grounds_row_per_p", "write one grounds row per ground label, naming the member who asserts that ground is independently sufficient and the date"),
         localize('inquiry-grammar.grammar.or_drop_the_ground_labels', 'or drop the ground labels — an unstructured basis is no stronger than its weakest leg, which is the conservative reading')]));
    }
    return;
  }
  if (!Array.isArray(rows)) {
    findings.push(f('C-2.8', 'error', localize('inquiry-grammar.grammar.grounds_is_not_an_array', 'grounds is not an array')));
    return;
  }
  const declared = new Map();          // label -> row index
  rows.forEach((r, i) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_is_not_an_p", "grounds row {i} is not an object", { i: String(i) })));
      return;
    }
    const label = r.ground;
    if (typeof label !== 'string' || !GROUND_LABEL_RE.test(label)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_ground_string_is_p", "grounds row {i} has the ground '{String}', which is not a ground label: up to 48 characters of letters, digits, spaces, '-' and '_'", { i: String(i), String: String(String(label).slice(0, 60)) })));
      return;
    }
    if (declared.has(label)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_declares_label_a_p", "grounds row {i} declares '{label}' a second time: one ground, one assertion, one member answering for it", { i: String(i), label: String(label) })));
      return;
    }
    declared.set(label, i);
    /* REC-46 — THE SITE THE ITEM WAS ROUTED FOR. This asked the word list
       alone, so `token:member` (and `class:member`) reached the record here
       while `agent` was refused. It now asks the one predicate, and so does
       every other site that asks the same question.

       DEC-65's SINGLE-PART LICENCE STOPS ONE LEVEL UP, AND THIS IS A CLOSURE
       DECIDED RATHER THAN A SITE MISSED (PL-19, 2026-08-09). C-25.6 —
       `basisVersionFindings`, the identical question over a VERSION's ground
       rows — now accepts PL-17's explicit no-claim value on a version declaring
       exactly one part, because a MACHINE composes versions and would otherwise
       have to sign a member's name to one. THIS block governs the INQUIRY's own
       `grounds[]`, and it has NO machine writer to protect: `inquiry`'s
       `#ground` is the only act that writes these rows and it refuses a
       machine credential OUTRIGHT, before anything else, inside its own DEC-49
       region (`MACHINE_CANNOT_GROUND`, REC-64 / C-32.8). MEASURED at that op,
       not assumed from this file.
       So there is nothing here for the third state to keep honest, and admitting
       it would widen what the record may hold for a population that cannot
       produce it — which is the quiet widening DEC-65's own licence and PL-17's
       delegation both warn against. If a machine writer ever reaches these rows,
       THAT is when this arm earns the same treatment. */
    if (typeof r.asserted_by !== 'string' || r.asserted_by.trim() === ''
        || isMachineIdentity(r.asserted_by)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_asserted_by_asserted_p", "grounds row {i} names '{asserted_by}' as the one asserting it, which is not a named member: \"these legs are enough on their own\" is an authored judgment that makes the finding stronger, so it carries the name of the member making it — never a machine's", { i: String(i), asserted_by: String(r.asserted_by) }),
        [localize('inquiry-grammar.grammar.name_the_member_asserting_that', 'name the member asserting that this ground is independently sufficient')]));
    }
    if (!ISO_TS_RE.test(String(r.at || ''))) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_requires_at_as_p", "grounds row {i} requires a date as a full timestamp (got '{at}'): the assertion is dated because a structure authored after a strength was seen is a different act from one authored before it, and only a date lets a reader tell", { i: String(i), at: String(r.at) })));
    }
    if (r.statement !== undefined && r.statement !== null && typeof r.statement !== 'string') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_statement_is_not_p", "the statement on grounds row {i} is not a string", { i: String(i) })));
    }
  });
  /* A LABEL WITH NO ASSERTION, and its mirror. */
  for (const [i, label] of labelled) {
    if (!declared.has(label)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_ground_label_is_p", "basis leg {i} names the ground '{label}', which is not declared in the grounds: a ground that nobody asserted is independently sufficient cannot be one, and the finding must not take a maximum over a branch no member signed for", { i: String(i), label: String(label) }),
        [localize("inquiry-grammar.grammar.add_a_grounds_row_for_p", "add a grounds row for '{label}' with who asserted it and when", { label: String(label) })]));
    }
  }
  const carried = new Set(labelled.map(([, l]) => l));
  for (const [label, i] of declared) {
    if (!carried.has(label)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.grounds_i_declares_label_which_p", "grounds row {i} declares '{label}', which no basis leg belongs to: a ground groups the legs of the inquiry, and an empty one asserts that nothing is sufficient on its own", { i: String(i), label: String(label) }),
        [localize("inquiry-grammar.grammar.give_at_least_one_basis_p", "give at least one basis leg the ground '{label}'", { label: String(label) }), localize('inquiry-grammar.grammar.or_remove_the_row', 'or remove the row')]));
    }
  }
}

/** REC-18 / DATA-MODEL D1(b) / DEC-15: THE EARNED RULE, PER AXIS.
 *
 *  A grade a caller can hand us is a grade a caller can invent, and CLAUDE.md
 *  is explicit that such a thing is not evidence. So the two grades the RECORD
 *  can compute for itself are computed by the record, and a leg claiming one
 *  must state the value the record actually holds — refused otherwise, in
 *  EITHER direction. Not "no stronger than", which is `inherited`'s rule and is
 *  right there because DEC-12 gives the member a real choice (which edition to
 *  rest on) and a weaker grade can be an honest consequence of it. There is no
 *  such choice here: an earned grade is a FACT about the record at the moment
 *  of the write, and a leg stating anything else states a non-fact about how it
 *  was established, which is precisely what grade means (SB-EVIDENCE 602-607:
 *  "grade tracks how the bytes reached us, never how credible the document is").
 *
 *  THE SPLIT THIS ENFORCES, and it is the recogniser precedent moved up one
 *  layer (schema.mjs:739-743 — "the RECOGNISER never mints a D; the model holds
 *  it so a member can testify, never the machine"):
 *    - `resolution`  EARNED, connection axis, A/B/C — the strongest resolution
 *                    of that document's captures to the inquiry's SUBJECT
 *                    ENTITY. Never D: a D resolution is itself a member's
 *                    testimony (op=resolvetestify), so a leg resting on one is
 *                    testimony and says so, with its own author and date.
 *    - `capture`     EARNED, capture axis — what the record holds about how the
 *                    bytes arrived. B for a document this instance captured;
 *                    A is not reachable and is refused by name, because a
 *                    chain-of-custody web archive is out of a Worker's reach
 *                    and is not claimed (CAPTURE-FIDELITY.md, R2-e/R2-g).
 *    - `testimony`   a MEMBER'S act, always D, author and date carried.
 *    - `hunch`       a member's act, authored above D, HUNCH DEBT until cleared
 *                    (DEC-15) — and the earned path is what it is cleared INTO.
 *                    D-188: HUNCH debt, not "bias debt". Ordinary bias debt is
 *                    DISCLOSED and travels; the hunch is the kind that refuses
 *                    publication (DEC-20).
 *
 *  THE SUBJECT-ENTITY PRICE IS REAL AND IS STATED (DEC-15). An inquiry that
 *  names no subject entity has no A/B/C available to it on the connection axis.
 *  That is not a gate to be got past by inventing one: the leg states no grade,
 *  the axis suspends and names it (R1), and the case reads as what it is.
 *
 *  AN ABSENT REGISTRY IS NOT A WAY THROUGH, and the posture is checkInheritedLeg's
 *  exactly: the pure checker over a filesystem cannot see `resolutions` or
 *  `register`, so it says so rather than passing the leg. Every path a real
 *  caller has — the ratification gate and the store's own write path — injects
 *  the registry. */
/** MK-2 / D-184 / IC-142: THE TESTIMONY AXIS, AND THE §7 REFUSALS THAT FALL
 *  TO IT (`MEMBER-KNOWLEDGE-DESIGN.md` §3, §7). Every refusal carries a CODE
 *  on its C-2.8 finding — the D-206 discriminator within a rule — so each one
 *  is refused BY NAME and a caller can tell them apart without parsing prose:
 *
 *    testimony-grade-not-d        a testimony-axis grade other than
 *                                 TESTIMONY_GRADE. The ruling is that an
 *                                 observation stands on the observing member's
 *                                 trust, and nothing — a second member's
 *                                 co-signature included — makes it more.
 *    testimony-grade-unearned     a testimony letter other than the one the
 *                                 registry holds for that observation (value
 *                                 mode, resolution's precedent).
 *    testimony-axis-source        a testimony-axis grade whose source is not a
 *                                 testimony (or, on a published case, not
 *                                 inherited): a resolution, a capture or a hunch
 *                                 is an account of something else.
 *    testimony-axis-unconfirmable the checker cannot read the register, so it
 *                                 cannot confirm the target IS an observation
 *                                 (checkEarnedLeg's posture: an absent registry
 *                                 is not a way through).
 *    testimony-axis-not-authored  the target is not a member's authored
 *                                 observation. A publisher's document graded
 *                                 as testimony would be a captured source
 *                                 passing for a member's word — the other
 *                                 direction of the confusion §2 forbids.
 *    testimony-leg-capture-graded ANY capture-axis grade on a leg citing an
 *                                 authored observation, whatever its source:
 *                                 the capture axis measures reading a document
 *                                 in (DEC-21), which did not happen, and an A
 *                                 would be true of the bytes and read as
 *                                 strength the observation does not have.
 *
 *  WHAT DECIDES "AUTHORED" is the registry's `testimony` map, which
 *  `earnedBasisRegistry` builds from the REGISTER's `authored` flag — a flag
 *  only `op=testify` can set (C-53.8). Never the leg, never the document: a
 *  caller cannot make a target an observation by saying so.
 *
 *  WHAT IS DELIBERATELY NOT REFUSED: a CONNECTION-axis grade on a leg citing an
 *  observation. §7 does not list it, and §3 now RULES it (BOB #15, 2026-09-18,
 *  answering the design gap MK-2 named): a leg on an observation carries a
 *  connection grade graded exactly as any leg's, neither refused nor exempt —
 *  testimony says WHOSE WORD, connection says HOW DIRECTLY it bears, and with
 *  capture not applicable a refused connection grade would leave the leg
 *  invisible to the bar. This module's R4 test of a connection grade on an
 *  observation (`test/m/inquiry-grammar/grammar.test.mjs`) proves it. */
function checkTestimonyLeg(leg, i, graded, targetType, registry, findings) {
  if (!graded) return;
  const target = typeof leg.target === 'string' ? leg.target : null;
  const observation = registry && registry.earned && registry.earned.testimony && target
    ? registry.earned.testimony[target] || null : null;
  if (leg.grade_axis === 'capture' && targetType === 'information' && observation) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_capture_3_p", "basis leg {i} states a capture grade of {grade} for {target}, which is a member's authored observation: the capture axis measures the act of reading a document in, and nobody read these words in from anywhere — they are the member's own. Its grade is testimony, {grade_2}, on the testimony axis, and its capture axis is not applicable", { i: String(i), grade: String(leg.grade), target: String(target), grade_2: String(observation.grade) }),
      [localize("inquiry-grammar.grammar.grade_basis_i_on_the_2_p", "grade basis leg {i} on the testimony axis: grade axis testimony, grade {grade}, grade source testimony", { i: String(i), grade: String(observation.grade) }),
       localize("inquiry-grammar.grammar.or_state_no_grade_on_p", "or state no grade on basis leg {i} — the leg stays in the basis, present and not yet load-bearing", { i: String(i) })],
      'testimony-leg-capture-graded'));
    return;
  }
  if (leg.grade_axis !== 'testimony') return;
  if (leg.grade !== TESTIMONY_GRADE) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_2_p", "basis leg {i} states a testimony grade of {grade}: a member's firsthand observation is graded {TESTIMONY_GRADE} on the testimony axis and at no other value. It stands on the observing member's trust, and nothing raises it — a second member agreeing with it is a co-signature, not a second observation (a second member who saw the same thing records their own, and the case then rests on two testimonies, each {TESTIMONY_GRADE_2})", { i: String(i), grade: String(leg.grade), TESTIMONY_GRADE: String(TESTIMONY_GRADE), TESTIMONY_GRADE_2: String(TESTIMONY_GRADE) }),
      [localize("inquiry-grammar.grammar.state_grade_testimony_grade_on_p", "state grade {TESTIMONY_GRADE} on basis leg {i}", { TESTIMONY_GRADE: String(TESTIMONY_GRADE), i: String(i) })],
      'testimony-grade-not-d'));
    return;
  }
  /* A published case's frozen testimony axis is inherited like any other, and
     checkInheritedLeg compares it; the no-referent arm above already refused a
     non-inherited testimony grade on an inquiry leg. */
  if (leg.grade_source === 'inherited' || targetType === 'inquiry') return;
  if (leg.grade_source !== 'testimony') {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_3_p", "basis leg {i} states a testimony-axis grade with grade source '{grade_source}': a testimony grade comes from a member's own authored observation and from nothing else — a resolution, a capture or a hunch is an account of something other than whose word this is", { i: String(i), grade_source: String(leg.grade_source) }),
      [localize("inquiry-grammar.grammar.set_grade_source_testimony_on_p", "set the grade source to testimony on basis leg {i}", { i: String(i) })],
      'testimony-axis-source'));
    return;
  }
  if (!registry) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_4_p", "basis leg {i} states a testimony grade for {target}, but whether that document IS a member's authored observation is held by the register, which cannot be read here: a document is an observation because the act that records one wrote it, never because a leg says so", { i: String(i), target: String(target) }),
      [localize("inquiry-grammar.grammar.run_this_through_the_ratification_p", "run this through the ratification gate or the promote act, which read the record")],
      'testimony-axis-unconfirmable'));
    return;
  }
  if (!observation) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_5_p", "basis leg {i} states a testimony grade for {target}, which is not a member's authored observation: the testimony axis grades whose word a document is, and this one's bytes were captured, not authored here. Grading it as testimony would let a captured source pass for a member's own word", { i: String(i), target: String(target) }),
      [localize("inquiry-grammar.grammar.grade_basis_i_on_the_p", "grade basis leg {i} on the capture axis, which is what a captured document's grade measures", { i: String(i) }),
       localize("inquiry-grammar.grammar.or_if_this_is_your_p", "or, if this is your own firsthand knowledge, record it as an observation (the testify act) and cite that")],
      'testimony-axis-not-authored'));
    return;
  }
  /* mode 'value', on resolution's precedent: the record HOLDS the letter, so
     the leg states that letter and no other. Compared against the REGISTRY's
     answer rather than against the constant alone, so the registry is the one
     authority for what a target earns on this axis and the arm that lets an
     attestation move it is caught at the write. */
  if (leg.grade !== observation.grade) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_testimony_6_p", "basis leg {i} states a testimony grade of {grade} for {target}, but the record holds {grade_2} for it. {v1}", { i: String(i), grade: String(leg.grade), target: String(target), grade_2: String(observation.grade), v1: String(observation.why ?? '') }).trimEnd(),
      [localize("inquiry-grammar.grammar.state_grade_grade_on_basis_p", "state grade {grade} on basis leg {i}", { grade: String(observation.grade), i: String(i) })],
      'testimony-grade-unearned'));
  }
}

function checkEarnedLeg(leg, i, graded, targetType, registry, findings) {
  const src = leg.grade_source;
  if (!EARNED_GRADE_SOURCES.includes(src)) return;
  /* The no-grade case already produced its own finding in the loop above; a
     second complaint about one broken leg helps nobody. */
  if (!graded) return;
  if (!registry) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_grade_source_2_p", "basis leg {i} states a grade source '{src}' but the record it would be earned from cannot be read here: an earned grade is computed by the record and is never taken from a caller, so it cannot be confirmed by a checker that can only see this one record", { i: String(i), src: String(src) }),
      [localize("inquiry-grammar.grammar.run_this_through_the_ratification_2_p", "run this through the ratification gate or the promote act, which read the record"),
       localize('inquiry-grammar.grammar.or_state_the_grade_as', 'or state the grade as testimony (grade D, with an author and a date) if it is a member\'s account')]));
    return;
  }
  const wantAxis = EARNED_SOURCE_AXIS[src];
  /* REC-31's arm already refuses a capture-axis grade on an inquiry leg and says
     it better (the axis has no referent, which is the deeper fault). Silent here
     rather than adding a second complaint about one broken leg — the same
     discipline the loop above takes with an unusable target. */
  if (leg.grade_axis === 'capture' && targetType === 'inquiry' && src !== 'capture') return;
  if (leg.grade_axis !== wantAxis) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_grade_source_3_p", "basis leg {i} states a grade source '{src}' on the {grade_axis} axis: {v1}, so it can only be a source for a {wantAxis} grade", { i: String(i), src: String(src), grade_axis: String(leg.grade_axis), v1: String(src === 'resolution' ? localize("inquiry-grammar.grammar.a_resolution_is_the_framework_p", "a resolution IS the framework's connection grade and grades nothing else") : localize("inquiry-grammar.grammar.a_capture_grade_is_a_p", "a capture grade is a property of an information object and measures how the bytes arrived")), wantAxis: String(wantAxis) }),
      [localize("inquiry-grammar.grammar.set_grade_axis_wantaxis_on_p", "set the grade axis to {wantAxis} on basis leg {i}", { wantAxis: String(wantAxis), i: String(i) }),
       localize('inquiry-grammar.grammar.or_state_where_this_grade', 'or state where this {grade_axis}-axis grade actually came from', { grade_axis: String(leg.grade_axis) })]));
    return;
  }
  /* A leg to another INQUIRY earns nothing: an inquiry has no captures and no
     resolutions, so there is no record fact to compute from. Stated for
     `resolution` only — the capture-axis-on-an-inquiry case already has its own
     finding above (REC-31's arm), and it says the same thing better. */
  if (src === 'resolution' && targetType === 'inquiry') {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_claims_an_earned_p", "basis leg {i} claims an EARNED resolution grade on an inquiry leg: a resolution matches a captured document's reading to a registry entity, and an inquiry is not a captured document — there is nothing here for the recogniser to have graded", { i: String(i) }),
      [localize('inquiry-grammar.grammar.rest_this_leg_on_the_2', 'rest this leg on the INFO- document that carries the reference'),
       localize("inquiry-grammar.grammar.or_if_the_target_is_p", "or, if the target is a published case, inherit its frozen connection grade (grade source: inherited)")]));
    return;
  }
  if (src === 'resolution' && !registry.subject_entity) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_claims_an_earned_2_p", "basis leg {i} claims an EARNED resolution grade, but this inquiry names no subject entity: an earned connection grade is the strongest resolution of the target's captures to the inquiry's subject, and with no subject named there is nothing to have resolved to", { i: String(i) }),
      [localize("inquiry-grammar.grammar.add_subject_entity_ent_yyyy_p", "add a subject entity: the registry entry this inquiry is about"),
       localize("inquiry-grammar.grammar.or_state_no_grade_at_p", "or state no grade at all — an inquiry with no subject entity has no A/B/C available to it, and that is honest")]));
    return;
  }
  const earned = registry.earned && registry.earned[wantAxis]
    ? registry.earned[wantAxis][leg.target] : null;
  /* REC-88 / D-349 · THE UNDETERMINED BOUND, AND IT IS A DIFFERENT FACT FROM AN
     ABSENT ENTRY — which is why it is judged BEFORE the branch below.
     *
     * The capture axis is bounded by the weakest link of byte provenance and
     * transcription fidelity, with no third scale (DEC-4, framework Part II
     * Appendix A.1). A document whose text a machine derived, where no step of
     * that derivation carries a measured fidelity, has a bound of UNDETERMINED
     * — `captureBound` answers null rather than passing the byte grade through,
     * deliberately, so an unmeasured engine's output cannot ride a direct
     * capture's B.
     *
     * THE ENTRY IS PRESENT WITH A NULL GRADE AND THE BRANCH BELOW WOULD SAY THE
     * WRONG THING. Its sentence is "the record holds no registered capture for
     * that document: there are no bytes here" — false here, and falsely
     * actionable: it would send a member to go capture a document the record
     * already holds, when what is missing is a FIDELITY MEASUREMENT of a
     * transcription it already has. The record naming the wrong empty level is
     * the failure CLAUDE.md's "sparse is the normal condition at every level"
     * paragraph exists about.
     *
     * AND THE LEG IS NOT REFUSED FOR BEING UNMEASURED — it is refused for
     * CLAIMING A LETTER. An unmeasured transcription is undetermined and
     * STATED; a leg stating no capture grade at all is legal, suspends the axis
     * and names it, and never reaches this function at all (the `graded` guard
     * above returns first). That is the gate not pressuring anyone into
     * inventing an attribution. */
  /* MK-2: A MEMBER'S AUTHORED OBSERVATION IS REFUSED BY NAME IN
     checkTestimonyLeg, which runs first and says what the document IS and
     which axis its grade belongs on. Silent here, for the one cause and only
     for it — the MK-1 repair list this branch used to carry for it (no
     transcription to measure) moved with the refusal. */
  if (earned && earned.undetermined_because === 'CAPTURE_AXIS_AUTHORED') return;
  if (earned && earned.mode === 'ceiling' && earned.grade == null) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_an_earned_p", "basis leg {i} states an EARNED capture grade of {grade} for {target}, but what that document's capture can support is UNDETERMINED, not {grade_2}. {v1}", { i: String(i), grade: String(leg.grade), target: String(leg.target), grade_2: String(leg.grade), v1: String(earned.why ?? '') }),
      [localize("inquiry-grammar.grammar.state_no_capture_grade_on_p", "state NO capture grade on basis leg {i} — an undetermined axis is stated, not filled in, and the leg stays in the basis naming what it rests on", { i: String(i) }),
       localize('inquiry-grammar.grammar.or_have_the_transcription_measured', 'or have the transcription measured (the MEASUREMENTS ledger, per engine, per version) and state the letter the record then earns'),
       localize('inquiry-grammar.grammar.or_state_this_leg_as', 'or state this leg as testimony (grade D, with an author and a date) if it is a member\'s own account')]));
    return;
  }
  if (!earned || !earned.grade) {
    findings.push(f('C-2.8', 'error', src === 'resolution'
      ? localize("inquiry-grammar.grammar.basis_i_states_an_earned_2_p", "basis leg {i} states an EARNED resolution grade of {grade} for {target}, but the record holds no A/B/C resolution of that document to {subject_entity}: nothing was earned here. The recogniser never mints a D, so a document known to concern the subject only by a member's testimony earns nothing either — that leg is testimony and says so", { i: String(i), grade: String(leg.grade), target: String(leg.target), subject_entity: String(registry.subject_entity) })
      : localize("inquiry-grammar.grammar.basis_i_states_an_earned_3_p", "basis leg {i} states an EARNED capture grade of {grade} for {target}, but the record holds no registered capture for that document: there are no bytes here whose arrival this grade could be measuring", { i: String(i), grade: String(leg.grade), target: String(leg.target) }),
      src === 'resolution'
        ? [localize("inquiry-grammar.grammar.resolve_the_document_to_the_p", "resolve the document to the subject with the resolve act, then state the grade it earned"),
           localize('inquiry-grammar.grammar.or_state_this_leg_as_2', 'or state this leg as testimony (grade D, with an author and a date)')]
        : [localize("inquiry-grammar.grammar.state_no_capture_grade_an_p", "state no capture grade — an uncaptured document is undetermined on the capture axis, and undetermined is stated")]));
    return;
  }
  /* TWO COMPARISONS, because the record holds two DIFFERENT KINDS OF FACT and
     pretending otherwise would be the laundering this rule exists to stop.
     - mode 'value' (the CONNECTION axis): `resolutions` holds the grade itself,
       so the leg must state THAT VALUE and nothing else, in either direction. A
       weaker letter is not modesty, it is a false statement about how the leg
       was established, which is exactly what a grade means.
     - mode 'ceiling' (the CAPTURE axis): the record holds whether it has bytes
       for this document and what the STRONGEST capture this plane can produce is
       worth — it does NOT hold a per-document capture grade, because no such
       column exists. So the rule is the honest half: no leg may claim MORE than
       the ceiling (which makes grade A structurally unreachable, per the
       doctrine), and a weaker grade is admitted as the member's account of a
       poorer route. The residual — that B-or-weaker is still authored — is
       stated as debt rather than hidden behind a comparison that looks stricter
       than the record can support.
     *
     * REC-88 / D-349: THE COMPARISON BELOW DID NOT CHANGE AND ITS REACH DID.
     * Until this item the ceiling was `EARNED_CAPTURE_CEILING` for every
     * document the record held bytes of, so this arm could only ever refuse a
     * grade A. The registry now bounds that ceiling by TRANSCRIPTION FIDELITY
     * (DEC-4's weakest link, computed by `captureBound` and by nothing here),
     * so the very same line now refuses a B on a document this plane OCR'd at
     * C. That is the point: the rule was always "no leg may claim more than the
     * record can earn", and what moved is what the record admits it can earn.
     * `earned.why` carries the reason and is composed where the bound is
     * computed, so the sentence a member reads names the engine's measured
     * fidelity rather than this file guessing at it. */
  if (earned.mode === 'ceiling') {
    if (BASIS_GRADES.indexOf(leg.grade) < BASIS_GRADES.indexOf(earned.grade)) {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_a_capture_4_p", "basis leg {i} states a capture grade of {grade} for {target}, which is stronger than the {grade_2} the record can earn for it. {why} {v1}", { i: String(i), grade: String(leg.grade), target: String(leg.target), grade_2: String(earned.grade), why: String(earned.why), v1: String(earned.ceiling ?? '') }),
        [localize("inquiry-grammar.grammar.state_grade_grade_or_weaker_p", "state grade {grade} or weaker on basis leg {i} — the earned-basis check answers what each target earns before you write it", { grade: String(earned.grade), i: String(i) })]));
    }
    return;
  }
  if (earned.grade !== leg.grade) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_an_earned_4_p", "basis leg {i} states an EARNED {wantAxis} grade of {grade} for {target}, but the record earns {grade_2}: an earned grade is computed by the record and a caller does not hand it to us in either direction. {why}", { i: String(i), wantAxis: String(wantAxis), grade: String(leg.grade), target: String(leg.target), grade_2: String(earned.grade), why: String(earned.why) }),
      [localize("inquiry-grammar.grammar.state_grade_grade_on_basis_2_p", "state grade {grade} on basis leg {i} — the earned-basis check answers what each target earns before you write it", { grade: String(earned.grade), i: String(i) })]));
  }
}

/** REC-14 / C-21.2: THE INHERITANCE RULE, PER AXIS.
 *
 *  A case built on a case cannot be stronger than the case beneath it. So a
 *  basis leg whose target is a PUBLISHED inquiry carries grade_source
 *  'inherited', NAMES THE EDITION it rests on, and carries a grade no stronger
 *  than that edition's FROZEN strength ON THE SAME AXIS — refused if stronger
 *  on either axis, and the two are compared independently.
 *
 *  PER AXIS IS THE WHOLE OF IT (RECONCILED R2-j). A single scalar comparison
 *  would let a case inherit an A CONNECTION grade from a case whose A was a
 *  CAPTURE grade — two incommensurable measurements over two different
 *  populations, laundered through one letter. The frozen pair is stamped in the
 *  published bytes as two axis OBJECTS for exactly this reason, and the axis
 *  the leg selects is its own recorded grade_axis.
 *
 *  AN UNRATED OR UNDETERMINED AXIS ADMITS NO GRADE AT ALL, and the two say
 *  different things. UNRATED means nothing on that axis was ever established —
 *  a grade inherited from it would be invented outright. UNDETERMINED means the
 *  walk could not finish, so what lies beneath is UNKNOWN rather than absent,
 *  and a grade taken from it would be a claim about material nobody has seen.
 *
 *  THE EDITION DOES NOT SILENTLY FOLLOW (DEC-12). A leg citing edition 1 keeps
 *  citing edition 1 when edition 2 appears; REC-17's re-evaluation obligation
 *  surfaces the newer edition and the MEMBER decides. Nothing recomputes a
 *  strength on their behalf, because the strength was not changed for them. */
function checkInheritedLeg(leg, i, graded, registry, findings) {
  const target = typeof leg.target === 'string' ? leg.target : null;
  /* D-598 (BOB #34, 2026-09-25 03:00Z; BIO_Publication_v0_1.md §3 rule 5): THE RULE IS OVER PUBLISHED
     INQUIRIES ONLY. A document or observation published as a case's EVIDENCE (D-431(b)) froze no strength,
     so it is not a published finding and a leg on it keeps its own grade on its own axis (C-2.8 for
     testimony, the capture grade for a document) — forcing it to `inherited` made every later finding over
     published evidence ungradeable, the record claiming LESS than it can support. An entry with NO
     object_type (a registry built before the key, or a caller's) is held to the inquiry rule: undetermined
     is not evidence. */
  const entry = registry && target ? registry[target] : null;
  const pub = entry && (entry.object_type == null || entry.object_type === 'inquiry') ? entry : null;
  if (leg.grade_source === 'inherited' && !pub) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_states_grade_source_4_p", "basis leg {i} states grade source 'inherited' but its target {v1}: a grade is inherited from a case the team SIGNED, at a stated edition, and from nothing else", { i: String(i), v1: String(registry ? localize('inquiry-grammar.grammar.is_not_a_published_case', 'is not a published case') : localize('inquiry-grammar.grammar.cannot_be_checked_against_the', 'cannot be checked against the published record here')) }),
      [localize('inquiry-grammar.grammar.cite_a_published_case_and', 'cite a published case and name its edition'), localize('inquiry-grammar.grammar.or_state_where_this_grade_2', 'or state where this grade actually came from')]));
    return;
  }
  if (!pub) return;                       // not a published target: nothing to inherit
  if (!graded) {
    /* Legal and deliberately so: an ungraded leg is INERT (DEC-18) — present,
       named, not yet load-bearing. What it may not do is CLAIM inheritance,
       because inheriting nothing is not inheritance. */
    if (leg.grade_source === 'inherited') {
      findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.basis_i_claims_inherited_with_p", "basis leg {i} claims 'inherited' with no grade: a leg resting on a published case may state no grade at all — undetermined, stated — but it may not claim to have inherited one", { i: String(i) })));
    }
    return;
  }
  if (leg.grade_source !== 'inherited') {
    findings.push(f('C-21.2', 'error', localize("inquiry-grammar.grammar.basis_i_carries_a_grade_3_p", "basis leg {i} carries a grade of its own on a PUBLISHED case ({target}): a leg resting on a published case inherits that case's frozen strength and says so with grade source 'inherited'. A case built on a case cannot be stronger than the case beneath it", { i: String(i), target: String(target) }),
      [localize("inquiry-grammar.grammar.set_grade_source_inherited_and_p", "set the grade source to inherited and the target edition on basis leg {i}", { i: String(i) })]));
    return;
  }
  const ed = leg.target_edition;
  if (!Number.isInteger(ed)) {
    findings.push(f('C-21.2', 'error', localize("inquiry-grammar.grammar.basis_i_inherits_from_target_p", "basis leg {i} inherits from {target} without naming an edition: every edition is a separate document with its own frozen strength, so an unnamed edition leaves the inheritance rule nothing fixed to compare against", { i: String(i), target: String(target) }),
      [localize("inquiry-grammar.grammar.add_target_edition_to_basis_p", "add the target edition to basis leg {i}", { i: String(i) })]));
    return;
  }
  const frozen = pub.editions ? pub.editions[String(ed)] : null;
  if (!frozen) {
    findings.push(f('C-21.2', 'error', localize("inquiry-grammar.grammar.basis_i_names_edition_ed_p", "basis leg {i} names edition {ed} of {target}, which is not in the published record (published editions: {v1})", { i: String(i), ed: String(ed), target: String(target), v1: String(pub.editions ? Object.keys(pub.editions).join(', ') || 'none' : 'none') })));
    return;
  }
  const axis = leg.grade_axis;
  /* MK-2: every axis in the vocabulary, not a typed pair — a testimony axis a
     published case froze is inherited on the same per-axis rule, and one an
     older edition never froze reads ABSENT below rather than passing. */
  if (!GRADE_AXES.includes(axis)) return;   // C-2.8 named it already
  const on = frozen[axis];
  if (!on || on.state !== 'graded') {
    findings.push(f('C-21.2', 'error', localize("inquiry-grammar.grammar.basis_i_inherits_axis_grade_p", "basis leg {i} inherits {axis} grade {grade} from {target} edition {ed}, whose {axis_2} axis is {v1}: {v2}", { i: String(i), axis: String(axis), grade: String(leg.grade), target: String(target), ed: String(ed), axis_2: String(axis), v1: String(on ? on.state.toUpperCase() : 'ABSENT'), v2: String(on && on.state === 'unrated' ? localize('inquiry-grammar.grammar.nothing_on_that_axis_was', 'nothing on that axis was ever established there, so a grade taken from it would be invented outright') : localize('inquiry-grammar.grammar.what_lies_beneath_is_unknown', 'what lies beneath is unknown rather than absent, so a grade taken from it would be a claim about material nobody has seen')) }),
      [localize("inquiry-grammar.grammar.state_no_grade_on_basis_p", "state no grade on basis leg {i} — undetermined, stated, is the honest answer", { i: String(i) })]));
    return;
  }
  if (BASIS_GRADES.indexOf(leg.grade) < BASIS_GRADES.indexOf(on.grade)) {
    findings.push(f('C-21.2', 'error', localize("inquiry-grammar.grammar.basis_i_inherits_axis_grade_2_p", "basis leg {i} inherits {axis} grade {grade} from {target} edition {ed}, whose frozen {axis_2} strength is {grade_2}: a case built on a case cannot be stronger than the case beneath it, and the comparison is per axis — this leg's {axis_3} grade against that edition's {axis_4} grade, never against a composed letter", { i: String(i), axis: String(axis), grade: String(leg.grade), target: String(target), ed: String(ed), axis_2: String(axis), grade_2: String(on.grade), axis_3: String(axis), axis_4: String(axis) }),
      [localize("inquiry-grammar.grammar.set_basis_i_grade_to_p", "set the grade on basis leg {i} to {grade}, the frozen {axis} strength of that edition", { i: String(i), grade: String(on.grade), axis: String(axis) })]));
  }
}


/** C-54.1 — ONE LEG, ASKED WHETHER IT RESTS ON A LEAD. The one checker every
 *  leg grammar consults (`checkInquiryBasis`' basis[], the version legs, the
 *  action basis), so the rule has one spelling and three doors. It asks BOTH
 *  fields a leg can name a referent through — the target and the REC-82 content
 *  id — because a lead cited through the second is still a lead cited. Returns
 *  true when it pushed a finding, so the caller skips its own target complaint
 *  about the same leg rather than answering twice with the wrong name. */
export function leadLegFindings(label, leg, findings) {
  const l = leg && typeof leg === 'object' ? leg : {};
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code, message, repairs) => f(LEAD_CHECKS[code].check, 'error', message, repairs, code);
  /* DEC-49 REGION is-lead-not-evidence */
  for (const field of ['target', 'content_id']) {
    const v = typeof l[field] === 'string' ? l[field].trim() : '';
    if (v && LEAD_ID_RE.test(v)) {
      findings.push(refusal("LEAD_NOT_EVIDENCE",
        localize("inquiry-grammar.grammar.label_field_v_is_a_p", "the {field} on {label} ('{v}') is a LEAD, and a lead is never evidence: it says where to look, not what was found, so no leg can rest on it", { label: String(label), field: words(field), v: String(v) }),
        [localize('inquiry-grammar.grammar.follow_the_lead_and_cite', 'follow the lead and cite the document the look captured instead'),
         localize('inquiry-grammar.grammar.or_if_you_saw_the', 'or, if you saw the thing yourself, author it as your own observation and cite that')]));
      return true;
    }
  }
  /* END DEC-49 REGION is-lead-not-evidence */
  return false;
}


/* =====================================================================
 * R11 (N522; DEC-112 (6); DEC-96 items 1, 4) — ANOTHER GROUP'S FINDING, NAMED.
 *
 * A group's finding may rest on a finding of another group's case that the group has accepted. That finding is not a
 * bundle of this record (case-import holds it, late in the order), so it is named by a reference of its own:
 * `imported:<import>/<finding>`, the import's 64-hex id and the finding's id as the source case states it. The prefix
 * is not a bundle prefix, so a ref never collides with a local id, which BUNDLE_ID_RE alone matches.
 *
 * WHAT A LEG ON ONE MAY SAY, AND WHY SO LITTLE. It names the finding and the ONE edition it rests on, and nothing
 * else: the edition's grades stand as published (DEC-96 item 1), so the leg carries no grade of its own to disagree
 * with them, and that edition's own case file is the place its parts are checked, so the leg carries no part either.
 * Whether an acceptance of that edition is in force is not a fact this pure grammar can see: `accepted-work` asks it
 * at the write (its R3, R4). This arm judges only the form.
 * ===================================================================== */

const IMPORT_ID = '[0-9a-f]{64}';
const BUNDLE_BODY = BUNDLE_ID_RE.source.replace(/^\^/, '').replace(/\$$/, '');

/** R11: exactly `imported:<import>/<finding>`; capture 1 is the import, the last capture the finding. */
export const IMPORTED_FINDING_RE = new RegExp(`^imported:(${IMPORT_ID})/(${BUNDLE_BODY})$`);

/** R11: `{import, finding}` for a ref, else null. Never throws. */
export function parseImportedFindingRef(s) {
  if (typeof s !== 'string') return null;
  const m = IMPORTED_FINDING_RE.exec(s);
  return m ? { import: m[1], finding: m[2] } : null;
}

/** R11: the ref spelled from its two parts, or null when they would not spell one IMPORTED_FINDING_RE matches, so
 *  nothing this spells is a ref the grammar refuses. Never throws. */
export function importedFindingRef(importId, finding) {
  if (typeof importId !== 'string' || typeof finding !== 'string') return null;
  const s = `imported:${importId}/${finding}`;
  return IMPORTED_FINDING_RE.test(s) ? s : null;
}

const isRef = (v) => typeof v === 'string' && IMPORTED_FINDING_RE.test(v.trim());
const carries = (v) => v !== undefined && v !== null && v !== '';

/** R11: the leg arm. A leg whose target is a ref gains one C-21.3 error, IMPORTED_LEG_MALFORMED, for each departure,
 *  naming the leg and the field, and the answer is true; any other leg (a non-object read as an empty one) gains
 *  nothing and the answer is false, so the caller runs its own target arm. `checkId` lets a leg grammar at another
 *  grain relabel the rule, as checkLegExtentGrammar does; the code travels. Pure; never throws. */
export function importedLegFindings(label, leg, findings, checkId = INQUIRY_GRAMMAR_CHECKS.IMPORTED_LEG_MALFORMED.check) {
  const l = leg && typeof leg === 'object' ? leg : {};
  if (!isRef(l.target)) return false;
  const ref = l.target.trim();
  const refusal = (message, repairs) => importedRefusal(checkId, message, repairs);
  const ed = l.target_edition;
  if (!Number.isInteger(ed) || ed < 1) {
    findings.push(refusal(localize("inquiry-grammar.grammar.label_target_edition_string_does_p", "the target edition on {label} ('{String}') does not name an edition of {ref}: a leg on another team's finding names the one edition it rests on, a positive whole number, because each edition is a separate document with its own published grades", { label: String(label), String: String(String(ed).slice(0, 40)), ref: String(ref) }),
      [localize("inquiry-grammar.grammar.set_label_target_edition_to_p", "set the target edition on {label} to the edition this team accepted", { label: String(label) })]));
  }
  for (const field of ['grade', 'grade_axis', 'grade_source']) {
    if (carries(l[field])) {
      findings.push(refusal(localize("inquiry-grammar.grammar.label_field_is_set_on_p", "the {field} on {label} is set, on a leg on another team's finding ({ref}): that finding's grades are the ones its edition published, and the leg states none of its own", { label: String(label), field: words(field), ref: String(ref) }),
        [localize('inquiry-grammar.grammar.remove_field_from_label', 'remove {field} from {label}', { field: String(field), label: String(label) })]));
    }
  }
  if (carries(l.content_id)) {
    findings.push(refusal(localize("inquiry-grammar.grammar.label_content_id_is_set_p", "the content id on {label} is set, on a leg on another team's finding ({ref}): the leg names the finding, and the parts it rests on are checked in that team's own case file", { label: String(label), ref: String(ref) }),
      [localize("inquiry-grammar.grammar.remove_content_id_from_label_p", "remove the content id from {label}", { label: String(label) })]));
  }
  if (legHasAuthoredExtent(l)) {
    findings.push(refusal(localize('inquiry-grammar.grammar.label_names_an_extent_on', '{label} names an extent on a leg on another team\'s finding ({ref}): the leg names the finding, and the parts it rests on are checked in that team\'s own case file', { label: String(label), ref: String(ref) }),
      [localize('inquiry-grammar.grammar.remove_the_extent_fields_from', 'remove the extent fields from {label}', { label: String(label) })]));
  }
  if (carries(l.extent_capture)) {
    findings.push(refusal(localize("inquiry-grammar.grammar.label_extent_capture_is_set_p", "the extent capture on {label} is set, on a leg on another team's finding ({ref}): no capture of this record holds that finding", { label: String(label), ref: String(ref) }),
      [localize("inquiry-grammar.grammar.remove_extent_capture_from_label_p", "remove the extent capture from {label}", { label: String(label) })]));
  }
  return true;
}

/** R11: the one site the code IMPORTED_LEG_MALFORMED is minted, for the leg arm and the references arm alike: the rule
 *  (`checkId`) is the caller's, the code and its row this module's. */
function importedRefusal(checkId, message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(checkId, 'error', message, repairs, code);
  /* DEC-49 REGION is-imported-leg-form */
  return refusal("IMPORTED_LEG_MALFORMED");
  /* END DEC-49 REGION is-imported-leg-form */
}

/** R11: each references[] entry naming a ref is one C-21.3 error. Such a leg is not a reference (C-6.3 does not ask
 *  it), so an entry naming one would make the published graph claim an edge into another group's case. */
function importedReferenceFindings(fm, findings) {
  const refs = Array.isArray(fm?.references) ? fm.references : [];
  refs.forEach((r, i) => {
    if (!r || typeof r !== 'object' || !isRef(r.target)) return;
    findings.push(importedRefusal(INQUIRY_GRAMMAR_CHECKS.IMPORTED_LEG_MALFORMED.check,
      localize("inquiry-grammar.grammar.references_i_target_names_another_p", "reference {i} names another team's finding ({target}): a leg on it is not a reference, so the references do not list it", { i: String(i), target: String(r.target.trim()) }),
      [localize("inquiry-grammar.grammar.remove_references_i_the_basis_p", "remove reference {i}; the basis leg alone names that finding", { i: String(i) })]));
  });
}


/* =====================================================================
 * T33-43 (K1447; Choices 16) — THREE MORE THINGS A LEG MAY REST ON.
 *
 * A HELD STANDARD (R13). A leg may cite a standard the group holds, as it cites a document: the standard's captured
 * text is what it rests on, so its grade is the capture grade that text earns (`leg-earning` R8, through the earned
 * registry handed in) and nothing a member asserts. Whether the standard holds the portion the leg names is
 * `inquiry`'s check, which reads the record; here only the portion path's form is asked.
 *
 * A CALCULATION (R14) and A DUTY OCCURRENCE (R15). Both are DERIVED: a calculation's grade is its weakest input's
 * capture (each capped by its derivation), an occurrence's is its source text's and its trigger's attestation
 * (`strength`, K1447 (i), (ii)). So a leg on either names it and states no grade, axis or source of its own, and no
 * part: a member's grade there would claim what the record derives. Neither is listed in `references[]` (K1601): a
 * calculation's id names a row, not a bundle (record-grammar R3), and record-grammar's references arm refuses it there
 * as it refuses any id that is not a bundle's; the occurrence is not a thing the record holds a row for until it is
 * read, so it is named by a reference of its own, `occurrence:<DUT id>/<key>`, on R11's pattern, and a `references[]`
 * entry naming one is refused here. Whether the occurrence exists is `inquiry`'s check, reading `duties`. An action is
 * never a leg target (D113).
 * ===================================================================== */

/** R13: a leg on a held standard. A `target_portion` that is not a portion path (`standards.isPortionPath`, its R31,
 *  never spelled here; N583) is one C-2.8 error. A `connection` or
 *  `testimony` axis, or a `hunch` source, is one C-2.8 error STANDARD_LEG_AXIS naming the leg, and the answer is true
 *  (the caller keeps its grade arms silent on that leg); otherwise false. Pure; never throws. */
export function standardLegFindings(label, leg, findings) {
  const p = leg.target_portion;
  if (carries(p) && !isPortionPath(p)) {
    findings.push(f('C-2.8', 'error', localize("inquiry-grammar.grammar.label_target_portion_string_is_p", "the target portion on {label} ('{String}') is not a portion path: it names a section within the standard's instrument, as text of at most {PORTION_PATH_MAX} characters", { label: String(label), String: String(String(p).slice(0, 40)), PORTION_PATH_MAX: String(PORTION_PATH_MAX) }),
      [localize('inquiry-grammar.grammar.name_the_portions_path_on', 'name the portion\'s path on {label}', { label: String(label) }), localize("inquiry-grammar.grammar.or_drop_target_portion_the_p", "or drop the target portion — the leg then rests on the whole standard")]));
  }
  const wrong = [];
  if (leg.grade_axis === 'connection' || leg.grade_axis === 'testimony') wrong.push(localize('inquiry-grammar.grammar.a_grade_axis_axis', 'a {grade_axis} axis', { grade_axis: String(leg.grade_axis) }));
  if (leg.grade_source === 'hunch') wrong.push(localize('inquiry-grammar.grammar.a_hunch', 'a hunch'));
  if (!wrong.length) return false;
  findings.push(standardLegRefusal(localize('inquiry-grammar.grammar.label_rests_on_the_standard', '{label} rests on the standard {target} and states {wrong}: a standard is law the team holds in captured text, so the only grade a leg on it carries is the capture grade that text earns. Whether the standard bears on this question is the inquiry\'s own argument, not a grade', { label: String(label), target: String(leg.target), wrong: String(wrong.join(' and ')) }),
    [localize("inquiry-grammar.grammar.grade_label_on_the_capture_p", "grade {label} on the capture axis with grade source: capture — the earned-basis check answers what the standard's text earns", { label: String(label) }),
     localize('inquiry-grammar.grammar.or_state_no_grade_on_2', 'or state no grade on {label} — the leg stays in the basis, present and not yet load-bearing', { label: String(label) })]));
  return true;
}

/** R16: the one site STANDARD_LEG_AXIS is minted. */
function standardLegRefusal(message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(INQUIRY_GRAMMAR_CHECKS[code].check, 'error', message, repairs, code);
  /* DEC-49 REGION is-standard-leg-axis */
  return refusal("STANDARD_LEG_AXIS");
  /* END DEC-49 REGION is-standard-leg-axis */
}

/* The fields a derived leg (R14, R15, R17) states none of, in the order a departure is named: its grade, then its part. */
const DERIVED_LEG_GRADE = ['grade', 'grade_axis', 'grade_source'];

/** R14, R15, R17: one departure each for a grade field, a content id, an extent and an extent capture on a derived leg. */
function derivedLegDepartures(label, l, what, why, refusal) {
  for (const field of DERIVED_LEG_GRADE) {
    if (carries(l[field])) {
      refusal(localize("inquiry-grammar.grammar.label_field_is_set_on_2_p", "the {field} on {label} is set, on a leg on {what}: {why}, so the leg states none of its own", { label: String(label), field: words(field), what: String(what), why: String(why) }),
        [localize('inquiry-grammar.grammar.remove_field_from_label_2', 'remove {field} from {label}', { field: String(field), label: String(label) })]);
    }
  }
  if (carries(l.content_id)) {
    refusal(localize("inquiry-grammar.grammar.label_content_id_is_set_2_p", "the content id on {label} is set, on a leg on {what}: the leg names it whole, and the parts it reads are its own", { label: String(label), what: String(what) }),
      [localize("inquiry-grammar.grammar.remove_content_id_from_label_2_p", "remove the content id from {label}", { label: String(label) })]);
  }
  if (legHasAuthoredExtent(l)) {
    refusal(localize('inquiry-grammar.grammar.label_names_an_extent_on_2', '{label} names an extent on a leg on {what}: the leg names it whole, and the parts it reads are its own', { label: String(label), what: String(what) }),
      [localize('inquiry-grammar.grammar.remove_the_extent_fields_from_2', 'remove the extent fields from {label}', { label: String(label) })]);
  }
  if (carries(l.extent_capture)) {
    refusal(localize("inquiry-grammar.grammar.label_extent_capture_is_set_2_p", "the extent capture on {label} is set, on a leg on {what}: no capture holds it", { label: String(label), what: String(what) }),
      [localize("inquiry-grammar.grammar.remove_extent_capture_from_label_2_p", "remove the extent capture from {label}", { label: String(label) })]);
  }
}

/** R14: exactly a calculation's id, `record-grammar`'s `ID_TABLE` form for `CALC`. */
export const CALCULATION_REF_RE = idPattern('CALC');

/** R14: a leg whose target is a calculation's id gains one C-2.8 error CALCULATION_LEG_MALFORMED per departure (a
 *  grade, axis or source; a content id, extent or extent capture), naming the field, and the answer is true; any other
 *  leg (a non-object read as an empty one) gains nothing and the answer is false. Pure; never throws. */
export function calculationLegFindings(label, leg, findings) {
  const l = leg && typeof leg === 'object' ? leg : {};
  if (typeof l.target !== 'string' || !CALCULATION_REF_RE.test(l.target)) return false;
  derivedLegDepartures(label, l, localize('inquiry-grammar.grammar.the_calculation_target', 'the calculation {target}', { target: String(l.target) }),
    localize('inquiry-grammar.grammar.its_grades_are_derived_from', 'its grades are derived from the inputs it reads, the weakest input\'s capture capped by its derivation'),
    (message, repairs) => findings.push(calculationLegRefusal(message, repairs)));
  return true;
}

/** R16: the one site CALCULATION_LEG_MALFORMED is minted. */
function calculationLegRefusal(message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(INQUIRY_GRAMMAR_CHECKS[code].check, 'error', message, repairs, code);
  /* DEC-49 REGION is-calculation-leg-form */
  return refusal("CALCULATION_LEG_MALFORMED");
  /* END DEC-49 REGION is-calculation-leg-form */
}

const DUTY_CORE = idPattern('DUT').source.slice(1, -1);
/** R15 (N675; K1799): duties' occurrence key form (its R9, R24), imported from `duties/vocab.mjs`, which imports nothing
 *  of the record, and re-exported as the same binding, so the form has one statement and no copy here can drift. */
export { OCCURRENCE_KEY_RE };
/* the key's form with its anchors dropped, so it sits inside the ref's pattern */
const OCCURRENCE_KEY = OCCURRENCE_KEY_RE.source.replace(/^\^/, '').replace(/\$$/, '');

/** R15: exactly `occurrence:<DUT id>/<key>`; capture 1 is the duty, the last capture the key. */
export const OCCURRENCE_REF_RE = new RegExp(`^occurrence:(${DUTY_CORE})/(${OCCURRENCE_KEY})$`);

/** R15: `{duty, key}` for an occurrence ref, else null. Never throws. */
export function parseOccurrenceRef(s) {
  if (typeof s !== 'string') return null;
  const m = OCCURRENCE_REF_RE.exec(s);
  return m ? { duty: m[1], key: m[2] } : null;
}

/** R15: the ref spelled from its two parts, or null when they would not spell one OCCURRENCE_REF_RE matches. Never
 *  throws. */
export function occurrenceRef(duty, key) {
  if (typeof duty !== 'string' || typeof key !== 'string') return null;
  const s = `occurrence:${duty}/${key}`;
  return OCCURRENCE_REF_RE.test(s) ? s : null;
}

const isOccurrenceRef = (v) => typeof v === 'string' && OCCURRENCE_REF_RE.test(v.trim());

/** R15: a leg whose target is an occurrence ref (read trimmed, as a lead or an imported ref is) gains one C-2.8 error
 *  OCCURRENCE_LEG_MALFORMED per departure (a grade, axis or source; a content id, extent or extent capture), naming the
 *  field, and the answer is true; any other leg gains nothing and the answer is false. A `references[]` entry naming
 *  one is refused by `checkInquiryBasis`. Pure; never throws. */
export function occurrenceLegFindings(label, leg, findings) {
  const l = leg && typeof leg === 'object' ? leg : {};
  if (!isOccurrenceRef(l.target)) return false;
  derivedLegDepartures(label, l, localize('inquiry-grammar.grammar.an_occurrence_of_a_duty', 'an occurrence of a duty ({v1})', { v1: String(l.target.trim()) }),
    localize('inquiry-grammar.grammar.what_it_rests_on_is', 'what it rests on is derived from the duty\'s source in force, its trigger date, its due date and the level searched'),
    (message, repairs) => findings.push(occurrenceLegRefusal(message, repairs)));
  return true;
}

/** R16: the one site OCCURRENCE_LEG_MALFORMED is minted, for the leg arm and the references arm alike. */
function occurrenceLegRefusal(message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(INQUIRY_GRAMMAR_CHECKS[code].check, 'error', message, repairs, code);
  /* DEC-49 REGION is-occurrence-leg-form */
  return refusal("OCCURRENCE_LEG_MALFORMED");
  /* END DEC-49 REGION is-occurrence-leg-form */
}

/** R15: each `references[]` entry naming an occurrence ref is one C-2.8 error: the leg alone names the occurrence. */
function occurrenceReferenceFindings(fm, findings) {
  const refs = Array.isArray(fm?.references) ? fm.references : [];
  refs.forEach((r, i) => {
    if (!r || typeof r !== 'object' || !isOccurrenceRef(r.target)) return;
    findings.push(occurrenceLegRefusal(localize("inquiry-grammar.grammar.references_i_target_names_an_p", "reference {i} names an occurrence of a duty ({target}): a leg on it is not a reference, so the references do not list it", { i: String(i), target: String(r.target.trim()) }),
      [localize("inquiry-grammar.grammar.remove_references_i_the_basis_2_p", "remove reference {i}; the basis leg alone names that occurrence", { i: String(i) })]));
  });
}


/* =====================================================================
 * T34-28 (N582; K1607) — A DERIVED CONNECTION, NAMED (R17).
 *
 * A derived connection is not stored: it is formed over the record by a stated method as of a stated time, and named by
 * its id, the SHA-256 of its five fields (`connection-grammar.derivedId`, its R11). So a leg on one carries the five
 * flat, as `derivation_*` scalars (a document's list item holds scalars only), and its target must be the id they give:
 * a leg whose fields and id disagree names two different connections. Like a calculation and an occurrence it is
 * derived, so it states no grade (its grade is its chain's, `connection-grammar` R12) and no part, and it is not a
 * reference: it names a connection, not a bundle. Whether it re-derives today, and whether its chain carries a declared
 * or hunch hop, is `hypotheses` R6's store-side check (through `explore.rederive`); this arm judges only the form.
 * ===================================================================== */

/** R17: a derived connection's id, 64 lowercase hexadecimal digits (`connection-grammar.derivedId`'s answer). */
export const DERIVED_CONNECTION_ID_RE = /^[0-9a-f]{64}$/;

/** R17: the five fields a leg on a derived connection carries, in `derivedId`'s order: `derivation_<k>` for its `<k>`. */
export const DERIVATION_FIELDS = Object.freeze(['kind', 'from', 'to', 'as_of', 'method'].map((k) => `derivation_${k}`));

/** R17: a leg whose target is a derived connection's id gains one C-2.8 error DERIVED_LEG_MALFORMED per departure,
 *  naming the field: a `derivation_*` field missing or empty; a target that is not `derivedId` of the five (asked only
 *  when all five are stated); a grade, axis or source; a content id, extent or extent capture. The answer is true; any
 *  other leg (a non-object read as an empty one) gains nothing and the answer is false. Pure; never throws. */
export function derivedConnectionLegFindings(label, leg, findings) {
  const l = leg && typeof leg === 'object' ? leg : {};
  if (typeof l.target !== 'string' || !DERIVED_CONNECTION_ID_RE.test(l.target)) return false;
  const refuse = (message, repairs) => findings.push(derivedLegRefusal(message, repairs));
  const missing = DERIVATION_FIELDS.filter((k) => typeof l[k] !== 'string' || l[k].trim() === '');
  for (const k of missing) {
    refuse(localize("inquiry-grammar.grammar.label_k_is_missing_or_p", "the {k} on {label} is missing or empty, on a leg on a derived connection ({target}): the leg carries the five fields the connection was derived from ({DERIVATION_FIELDS}), each a non-empty string, so a reader can derive it again", { label: String(label), k: words(k), target: String(l.target), DERIVATION_FIELDS: DERIVATION_FIELDS.map(words).join(', ') }),
      [localize("inquiry-grammar.grammar.state_k_on_label_as_p", "state the {k} on {label}, as the connection's derivation gives it", { k: words(k), label: String(label) })]);
  }
  if (!missing.length) {
    const id = derivedId({ kind: l.derivation_kind, from: l.derivation_from, to: l.derivation_to,
                           as_of: l.derivation_as_of, method: l.derivation_method });
    if (id !== l.target) {
      refuse(localize("inquiry-grammar.grammar.label_target_target_is_not_p", "the target on {label}, {target}, is not the id of the derivation the leg carries ({id}): a derived connection is named by the SHA-256 of its five fields, so a leg whose target and fields disagree names two different connections", { label: String(label), target: String(l.target), id: String(id) }),
        [localize("inquiry-grammar.grammar.set_label_target_to_id_p", "set the target on {label} to {id}, the id its derivation fields give", { label: String(label), id: String(id) }),
         localize("inquiry-grammar.grammar.or_correct_the_derivation_fields_p", "or correct the derivation fields on {label} to the connection its target names", { label: String(label) })]);
    }
  }
  derivedLegDepartures(label, l, localize('inquiry-grammar.grammar.a_derived_connection_target', 'a derived connection ({target})', { target: String(l.target) }),
    localize('inquiry-grammar.grammar.its_grade_is_its_chain', 'its grade is its chain\'s, the weakest hop of the derivation, and never authored'), refuse);
  return true;
}

/** R16: the one site DERIVED_LEG_MALFORMED is minted. */
function derivedLegRefusal(message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(INQUIRY_GRAMMAR_CHECKS[code].check, 'error', message, repairs, code);
  /* DEC-49 REGION is-derived-leg-form */
  return refusal("DERIVED_LEG_MALFORMED");
  /* END DEC-49 REGION is-derived-leg-form */
}


/* =====================================================================
 * T41-13 (D59; K2448, K2472, K2474, K2479) — A BIAS STATEMENT APPLIED AT A LEG (R18).
 *
 * A member reading a leg through the project's declared bias may record that a statement of that lens bore on it:
 * `[{statement, effect, from?, to?}]`. The record keeps the application beside the leg so a reader (and the standalone
 * checker, under a lens of its own) can see which statement moved what, and redo the reading without it.
 *
 * ONE ENCODING (K2479). A leg is an item of `basis[]`, and a list item holds scalars only (record-grammar R7), so the
 * list is written on the leg as numbered scalar keys, `bias_<n>_statement`, `bias_<n>_effect`, `bias_<n>_from` and
 * `bias_<n>_to`, `n` from 1 and contiguous, as R17 flattens a derivation. `flattenBiasApplied` writes it and
 * `readBiasApplied` reads it back; `basis-versions` R48 uses the same pair for a conclusion row. A `bias_applied` key on
 * a row is not the encoding and is refused, so the record holds one spelling of one fact.
 *
 * WHAT IS JUDGED HERE IS THE FORM AND NOTHING ELSE. `statement` is the statement's id as its lens holds it, the author's
 * own string (bias R16, R49; no minted form, K2474), so it is asked only to be a non-empty string a front-matter scalar
 * can carry (at most 200 characters, no quote, backslash, newline or `#`); whether it is in force for the inquiry's
 * project lens is `inquiry` R61's store-side check, since this module reads no record (R9). `effect` names what the
 * statement did: `grade_lowered` (with the `from` and `to` letters, a lowering), `leg_excluded` or
 * `inference_refused`. The shape is closed, at most 32 applications, no statement and effect twice.
 *
 * IT MOVES NO GRADE. The leg's stated grade is the member's and is judged by R4's arms exactly as without it; a
 * `grade_lowered` row is not compared with that grade, and nothing here derives one from the other.
 * ===================================================================== */

/** R18: the effects a bias application at a leg may name, in R18's order. */
export const BIAS_EFFECTS = Object.freeze(['grade_lowered', 'leg_excluded', 'inference_refused']);

/* R18: the fields an application carries, in the order the encoding writes them; the caps K2479 sets. */
const BIAS_APPLICATION_KEYS = Object.freeze(['statement', 'effect', 'from', 'to']);
const BIAS_MAX = 32, BIAS_STATEMENT_MAX = 200;
/* a key of the encoding: `bias_<digits>_<rest>`; any other `bias_` key (a conclusion row's `bias_statements_sha`) is
   not this encoding's */
const BIAS_KEY_RE = /^bias_(\d+)_(.*)$/s;
const isCanonicalN = (d) => /^[1-9]\d*$/.test(d);
const plainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** R18 (K2479): the applications list written as the encoding's keys, `{bias_1_statement, bias_1_effect, bias_1_from?,
 *  bias_1_to?, bias_2_…}`, numbered from 1 in list order, each field present on its item copied as it is (absent,
 *  undefined, left out). `{}` for absent, null, '' or an empty list; null when the value cannot be written so (not a
 *  list, an item not an object, or a field outside the four), so nothing it answers loses part of what it was handed.
 *  It judges nothing else: `biasAppliedFindings` judges what it wrote. Pure; never throws. */
export function flattenBiasApplied(list) {
  if (!carries(list)) return {};
  if (!Array.isArray(list)) return null;
  const out = {};
  for (let j = 0; j < list.length; j++) {
    const a = list[j];
    if (!plainObject(a) || Object.keys(a).some((k) => !BIAS_APPLICATION_KEYS.includes(k))) return null;
    for (const k of BIAS_APPLICATION_KEYS) if (a[k] !== undefined) out[`bias_${j + 1}_${k}`] = a[k];
  }
  return out;
}

/** R18 (K2479): the applications a row (a leg, or a conclusion row) carries in the encoding, as a list in number order,
 *  each `{statement?, effect?, from?, to?}` with the fields its keys state. `[]` for a row with none, or anything that is
 *  not a row. Keys outside the encoding's form, and gaps in the numbering, are not read here (they are
 *  `biasAppliedFindings`' departures). Pure; never throws. */
export function readBiasApplied(row) {
  if (!plainObject(row)) return [];
  const byN = new Map();
  for (const k of Object.keys(row)) {
    const m = BIAS_KEY_RE.exec(k);
    if (!m || !isCanonicalN(m[1]) || !BIAS_APPLICATION_KEYS.includes(m[2])) continue;
    const n = Number(m[1]);
    if (!byN.has(n)) byN.set(n, {});
    byN.get(n)[m[2]] = row[k];
  }
  return [...byN.keys()].sort((a, b) => a - b).map((n) => {
    const e = byN.get(n), o = {};
    for (const k of BIAS_APPLICATION_KEYS) if (k in e) o[k] = e[k];
    return o;
  });
}

/** R18: the bias applications `value` holds, judged as R18's shape. `value` is a row (a leg, or a conclusion row: any
 *  object that is not a list) carrying them in the encoding, or the list itself (as `flattenBiasApplied` takes it).
 *  None, an empty list, or a row with no key of the encoding applies nothing and gains nothing. Otherwise one `checkId`
 *  error, code BIAS_APPLICATION_MALFORMED, per departure, each naming `label` and the key or item:
 *    - a row: a `bias_applied` key (not the encoding); a `bias_<digits>_…` key whose number is not 1, 2, … written
 *      plainly or whose field is not one of the four; numbers that are not contiguous from 1;
 *    - a list: not a list; an item not an object; a field outside the four;
 *    - either: more than 32 applications; a `statement` that is not a non-empty string, or one longer than 200
 *      characters or holding a quote, backslash, newline or `#`; an `effect` not one of `effects`; on `grade_lowered`,
 *      a `from` or `to` not one of the grades, or a `to` not weaker than its `from`; on any other effect, a `from` or
 *      `to` at all; a statement applied with the same effect twice.
 *  `effects` and `checkId` let a grammar at another grain (`basis-versions` R48, a conclusion's) use the same shape
 *  with its own effects and rule; the code and its row are this module's. Answers the number of departures. Pure;
 *  never throws; reads no record and no lens. */
export function biasAppliedFindings(label, value, findings, { effects = BIAS_EFFECTS, checkId = INQUIRY_GRAMMAR_CHECKS.BIAS_APPLICATION_MALFORMED.check } = {}) {
  let n = 0;
  const refuse = (message, repairs) => { findings.push(biasApplicationRefusal(checkId, message, repairs)); n++; };
  const FORM = 'bias_<n>_statement, bias_<n>_effect, bias_<n>_from, bias_<n>_to, n from 1';
  let entries;          // [{a, item, field}] to judge, in order
  if (plainObject(value)) {
    if (carries(value.bias_applied)) {
      refuse(localize("inquiry-grammar.grammar.label_bias_applied_is_not_p", "the bias applications on {label} are not written the way the record holds them: each one is recorded beside the leg as its own numbered entry, with its statement, its effect and, for a lowered grade, the grades from and to", { label: String(label), FORM: String(FORM) }),
        [localize("inquiry-grammar.grammar.write_each_application_as_form_p", "record each application as its own numbered entry on {label}, and remove the bias applied list from {label}", { FORM: String(FORM), label: String(label) })]);
    }
    const numbers = new Set();
    for (const k of Object.keys(value)) {
      const m = BIAS_KEY_RE.exec(k);
      if (!m) continue;
      const shown = k.slice(0, 60);
      if (!isCanonicalN(m[1])) {
        refuse(localize("inquiry-grammar.grammar.label_shown_is_not_a_p", "a numbered entry on {label} is not part of a bias application: its number is written as 1, 2, 3 and so on", { label: String(label), shown: String(shown) }),
          [localize("inquiry-grammar.grammar.renumber_shown_on_label_the_p", "renumber the applications on {label} from 1, with none left out", { shown: String(shown), label: String(label) })]);
      } else if (!BIAS_APPLICATION_KEYS.includes(m[2])) {
        refuse(localize("inquiry-grammar.grammar.label_shown_is_not_a_2_p", "an entry on {label} is not part of a bias application, which records {BIAS_APPLICATION_KEYS} only", { label: String(label), shown: String(shown), BIAS_APPLICATION_KEYS: BIAS_APPLICATION_KEYS.join(', ') }),
          [localize("inquiry-grammar.grammar.remove_shown_from_label_p", "remove that entry from {label}", { shown: String(shown), label: String(label) })]);
      } else numbers.add(Number(m[1]));
    }
    const top = numbers.size ? Math.max(...numbers) : 0;
    if (numbers.size !== top) {
      const gaps = [];
      for (let i = 1; i <= top && gaps.length < 5; i++) if (!numbers.has(i)) gaps.push(i);
      refuse(localize('inquiry-grammar.grammar.label_s_bias_applications_are', '{label}\'s bias applications are numbered up to {top} with {gaps}{v1} missing: they are numbered from 1 with none left out, so a reader can tell none was dropped', { label: String(label), top: String(top), gaps: String(gaps.join(', ')), v1: String(gaps.length === 5 ? localize('inquiry-grammar.grammar.and_more', ' and more') : '') }),
        [localize("inquiry-grammar.grammar.renumber_the_bias_n_keys_p", "renumber the applications on {label} 1, 2, 3 and so on", { label: String(label) })]);
    }
    const ordered = [...numbers].sort((x, y) => x - y);
    entries = readBiasApplied(value).map((a, j) => ({ a, item: localize("inquiry-grammar.grammar.application_n_of_at", "application {n} of {at}", { n: String(ordered[j]), at: String(label) }),
      field: (k) => localize("inquiry-grammar.grammar.field_on_application_of", "{field} on application {n} of {at}", { field: FIELD_WORD[k], n: String(ordered[j]), at: String(label) }) }));
  } else {
    if (!carries(value) || (Array.isArray(value) && value.length === 0)) return 0;
    const at = localize("inquiry-grammar.grammar.bias_applications_on_label", "the bias applications on {label}", { label: String(label) });
    if (!Array.isArray(value)) {
      refuse(localize("inquiry-grammar.grammar.at_is_not_a_list_p", "{at} must be a list: it lists each bias statement applied here, one statement and effect each", { at: String(at) }),
        [localize("inquiry-grammar.grammar.make_at_a_list_of_p", "make {at} a list of statement and effect items, or drop it — where no statement was applied there are none", { at: String(at) })]);
      return n;
    }
    entries = [];
    value.forEach((a, j) => {
      const item = localize("inquiry-grammar.grammar.application_n_of_at", "application {n} of {at}", { n: String(j + 1), at: String(at) });
      if (!plainObject(a)) {
        refuse(localize("inquiry-grammar.grammar.item_is_not_an_object_p", "{item} is not an object: an application names the statement applied and its effect", { item: String(item) }),
          [localize("inquiry-grammar.grammar.state_item_as_statement_effect_p", "state {item} as a statement and an effect, with from and to when the effect is grade lowered", { item: String(item) })]);
        return;
      }
      for (const k of Object.keys(a)) {
        if (!BIAS_APPLICATION_KEYS.includes(k)) {
          refuse(localize("inquiry-grammar.grammar.item_k_is_not_part_p", "{item} holds an entry that is not part of a bias application, which carries {BIAS_APPLICATION_KEYS} only", { item: String(item), k: String(k.slice(0, 40)), BIAS_APPLICATION_KEYS: BIAS_APPLICATION_KEYS.join(', ') }),
            [localize("inquiry-grammar.grammar.remove_v1_from_item_p", "remove that entry from {item}", { v1: String(k.slice(0, 40)), item: String(item) })]);
        }
      }
      entries.push({ a, item, field: (k) => localize("inquiry-grammar.grammar.field_on_item", "{field} on {item}", { field: FIELD_WORD[k], item: String(item) }) });
    });
  }
  const count = Array.isArray(value) ? value.length : entries.length;
  if (count > BIAS_MAX) {
    refuse(localize('inquiry-grammar.grammar.label_carries_count_bias_applications', '{label} carries {count} bias applications: at most {BIAS_MAX} are recorded in one place', { label: String(label), count: String(count), BIAS_MAX: String(BIAS_MAX) }),
      [localize('inquiry-grammar.grammar.keep_the_bias_max_applications', 'keep the {BIAS_MAX} applications that bear on it, or divide the question', { BIAS_MAX: String(BIAS_MAX) })]);
  }
  const seen = new Map();          // `${statement}\u0000${effect}` -> the item that applied it first
  for (const { a, item, field } of entries) {
    const st = a.statement;
    if (typeof st !== 'string' || st.trim() === '') {
      refuse(localize('inquiry-grammar.grammar.field_is_missing_or_empty', '{field} is missing or empty: an application names the bias statement applied, by its id as the project\'s declared bias holds it', { field: String(field('statement')) }),
        [localize('inquiry-grammar.grammar.state_field_the_id_of', 'state {field}, the id of the statement in the project\'s declared bias', { field: String(field('statement')) })]);
    } else if ([...st].length > BIAS_STATEMENT_MAX || /["'\\\r\n#]/.test(st)) {
      refuse(localize("inquiry-grammar.grammar.field_cannot_be_written_in_p", "{field} cannot be written in the record: a statement id is at most {BIAS_STATEMENT_MAX} characters, with no quote, backslash, newline or #", { field: String(field('statement')), BIAS_STATEMENT_MAX: String(BIAS_STATEMENT_MAX) }),
        [localize("inquiry-grammar.grammar.name_the_statement_by_an_p", "name the statement by an id of at most {BIAS_STATEMENT_MAX} characters without those marks, as the declared bias holds it", { BIAS_STATEMENT_MAX: String(BIAS_STATEMENT_MAX) })]);
    }
    const effect = a.effect;
    if (typeof effect !== 'string' || !effects.includes(effect)) {
      refuse(localize('inquiry-grammar.grammar.field_string_is_not_one', '{field} \'{String}\' is not one of: {effects}', { field: String(field('effect')), String: String(String(effect).slice(0, 40)), effects: effects.map(words).join(', ') }),
        [localize('inquiry-grammar.grammar.state_what_the_statement_did', 'state what the statement did: {effects}', { effects: effects.map(words).join(', ') })]);
      continue;
    }
    if (effect === 'grade_lowered') {
      const okFrom = BASIS_GRADES.includes(a.from), okTo = BASIS_GRADES.includes(a.to);
      if (!okFrom) refuse(localize("inquiry-grammar.grammar.field_string_is_not_one_2_p", "{field} is '{String}', which is not one of: {BASIS_GRADES}: a lowered grade names the letter it was lowered from", { field: String(field('from')), String: String(String(a.from).slice(0, 40)), BASIS_GRADES: BASIS_GRADES.join(', ') }),
        [localize('inquiry-grammar.grammar.state_field_the_grade_before', 'state {field}, the grade before the statement was applied', { field: String(field('from')) })]);
      if (!okTo) refuse(localize("inquiry-grammar.grammar.field_string_is_not_one_3_p", "{field} is '{String}', which is not one of: {BASIS_GRADES}: a lowered grade names the letter it was lowered to", { field: String(field('to')), String: String(String(a.to).slice(0, 40)), BASIS_GRADES: BASIS_GRADES.join(', ') }),
        [localize('inquiry-grammar.grammar.state_field_the_grade_after', 'state {field}, the grade after the statement was applied', { field: String(field('to')) })]);
      if (okFrom && okTo && BASIS_GRADES.indexOf(a.to) <= BASIS_GRADES.indexOf(a.from)) {
        refuse(localize("inquiry-grammar.grammar.item_lowers_the_grade_from_p", "{item} lowers the grade from {from} to {to}, which is not lower: a statement applied as grade lowered names a weaker letter than the one it started from", { item: String(item), from: String(a.from), to: String(a.to) }),
          [localize('inquiry-grammar.grammar.state_the_letters_the_grade', 'state the letters the grade moved between, {field} weaker than {field_2}', { field: String(field('to')), field_2: String(field('from')) }),
           localize('inquiry-grammar.grammar.or_name_another_effect_a', 'or name another effect — a statement that changed no letter did not lower one')]);
      }
    } else {
      for (const k of ['from', 'to']) {
        if (carries(a[k])) refuse(localize("inquiry-grammar.grammar.field_is_set_on_a_p", "{field} is set on a {effect} application: only a grade lowered names the letters a grade moved between", { field: String(field(k)), effect: words(effect) }),
          [localize('inquiry-grammar.grammar.remove_v1', 'remove {v1}', { v1: String(field(k)) })]);
      }
    }
    if (typeof st === 'string' && st.trim() !== '') {
      const key = `${st}\u0000${effect}`;
      if (seen.has(key)) {
        refuse(localize('inquiry-grammar.grammar.item_applies_the_statement_st', '{item} applies the statement {st} as {effect} a second time ({get} already does): one statement\'s one effect here is recorded once', { item: String(item), st: String(st.slice(0, 60)), effect: words(effect), get: String(seen.get(key)) }),
          [localize('inquiry-grammar.grammar.remove_item', 'remove {item}', { item: String(item) })]);
      } else seen.set(key, item);
    }
  }
  return n;
}

/** R18: the one site BIAS_APPLICATION_MALFORMED is minted: the rule (`checkId`) is the caller's, the code and its row
 *  this module's. */
function biasApplicationRefusal(checkId, message, repairs) {
  /* The family helper, by name: DEC-49's guard judges `refusal("CODE"` at the site. */
  const refusal = (code) => f(checkId, 'error', message, repairs, code);
  /* DEC-49 REGION is-bias-application-form */
  return refusal("BIAS_APPLICATION_MALFORMED");
  /* END DEC-49 REGION is-bias-application-form */
}
