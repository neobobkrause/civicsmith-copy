// @ts-check
/* record-grammar: the machine-work labels, the plane's own answer to "who proposed this" and "who minted this row",
   each read through `isMachineIdentity` and published as a sentence. Moved from the check catalogue at T19 with their
   comments. REC-195's `lawProposalLabel` is actions' and lives in action-grammar, over `proposalLabel`;
   `isMachineMinted` had no reader and went with the catalogue (K750). */

import { isMachineIdentity } from './actors.mjs';
import { word } from '../setup-words/index.mjs';

/* A value stringified and trimmed; one that cannot be stringified (a throwing `toString`, an object with no prototype)
   is blank, never a throw (R37, R38). */
/** @param {unknown} v @returns {string} */
function text(v) {
  try { return String(v ?? '').trim(); } catch { return ''; }
}

/* =====================================================================
 * REC-195 (D-149's remaining half; `BIO_Case_Making_v0_1.md` §2): A MACHINE'S
 * PROPOSAL OF THE LIST, LABELLED MACHINE WORK.
 *
 * The ruling's own words are *the machine may propose the list from the
 * counterparty, labelled as machine work, and never sets it*. D-149 built the
 * fence (C-32.18) and left the proposal unbuilt. The proposal is stored APART
 * from the member's list — it is not `governing_laws[]`, it is not in the
 * action's bytes, and no read composes the two — so the only thing this block
 * has to get right is the LABEL.
 *
 * THE LABEL IS THE PLANE'S OWN ANSWER, NOT A LITERAL FOR A SURFACE TO MATCH,
 * and this is `CONTENT_MINT_STATES` one construct over, for its reason exactly
 * (PL-17: *a surface that reads the field itself and matches on the literal has
 * rebuilt the predicate*). `proposed_by` holds an identity — a machine stamp,
 * or a member handle — and a surface rendering that identity verbatim prints a
 * machine word at a member. So the plane answers the QUESTION and publishes the
 * SENTENCE.
 *
 * THE BLOCK IS PRESENT ON EVERY PROPOSAL, not only on machine ones, for
 * `#mintLabel`'s stated reason: a key that appears only when the answer is
 * "machine" makes ABSENCE carry the meaning, and a surface that never learned
 * the key then renders nothing at all for a machine's proposal — which is the
 * failure the label exists to prevent, arriving as silence.
 *
 * THE READING IS TOTAL: three states, every `proposed_by` lands in exactly one,
 * and `unstated` is a STATED answer rather than a gap. A proposal nobody can be
 * named for is refused at the act, so `unstated` is not reachable through the
 * control plane today; it is kept because the reading is a property of the
 * VALUE, and a reader handed a row from anywhere must land somewhere honest.
 * ===================================================================== */
/** The three sentences of one proposal subject, keyed by state (R38).
 * @typedef {{machine_proposed: string, member_proposed: string, unstated: string}} ProposalSentences */
/** A proposal's state (R38). @typedef {'machine_proposed' | 'member_proposed' | 'unstated'} ProposalState */
/** @type {ProposalSentences} */
export const LAW_PROPOSAL_STATES = {
  machine_proposed: word('record-grammar.proposal.governing_laws.machine_proposed'),
  member_proposed: word('record-grammar.proposal.governing_laws.member_proposed'),
  unstated: word('record-grammar.proposal.governing_laws.unstated'),
};

/** Read a proposal's `proposed_by` as ONE of the three states above. Blank is
 *  answered first — "nobody said" and "a machine said" are different findings —
 *  and everything the machine predicate does not claim is a name, i.e. a member.
 *  `isMachineIdentity` is REC-46's one predicate and is not re-spelled here.
 * @param {unknown} proposedBy
 * @returns {ProposalState} */
export function lawProposalState(proposedBy) {
  const s = text(proposedBy);
  if (s.length === 0) return 'unstated';
  return isMachineIdentity(s) ? 'machine_proposed' : 'member_proposed';
}

/* K171 (2) (T8, N129): THE SAME LABEL FOR EVERY PROPOSAL THE ACTION LAYER STORES APART. A standard proposed by
 * the Legal/Policy Lookup skill or a member (standards R9), a comparison against standards (conformance R12), a
 * filing's draft (filings R5), a candidate theory and remedy (filings R14), an action plan's proposed option
 * (action-plans R11), a prepared communication (filings R23; both N-A1, T18), wording proposed for a filing template
 * (filing-templates R6; K921, T21), a draft of a new edition's statement of what changed (case-authoring R39;
 * DEC-101) and an escalation's pre-assembled opening reason (escalation R29; DEC-89; both K1019, T23), and steps proposed
 * for a wizard script (wizard-scripts R5; N543, T32), a law relation, court link or treatment (standards R23, R26,
 * R27, R30; N568, T34), a draft translation of an interface word (N669, T37), a draft of a case's account and a
 * check of a member's account (case-authoring R64; N838, T42), a layout of how a reply bears on an action's claims
 * (action-replies R1; N912, T46) and a draft of a status report on a plan (plan-work R14; N956, T47) are each machine
 * work or a member's suggestion, never the thing itself, and each is labelled by `lawProposalState`'s three states. ONE CLOSED
 * TABLE, keyed by what was proposed: `governing_laws` is REC-195's table above, the same object, so its words
 * cannot drift from it; each other subject says, in each state, what the proposal is not. A subject the table does
 * not hold is a caller's defect and throws, rather than answering a sentence written for something else. */
/** @type {Readonly<{governing_laws: ProposalSentences, standard: Readonly<ProposalSentences>, comparison: Readonly<ProposalSentences>, filing_draft: Readonly<ProposalSentences>, theory: Readonly<ProposalSentences>, plan_option: Readonly<ProposalSentences>, communication: Readonly<ProposalSentences>, template: Readonly<ProposalSentences>, edition_statement: Readonly<ProposalSentences>, escalation_reason: Readonly<ProposalSentences>, wizard: Readonly<ProposalSentences>, law_relation: Readonly<ProposalSentences>, translation: Readonly<ProposalSentences>, case_account: Readonly<ProposalSentences>, account_check: Readonly<ProposalSentences>, bearing: Readonly<ProposalSentences>, status_report: Readonly<ProposalSentences>}>} */
export const PROPOSAL_STATES = Object.freeze({
  governing_laws: LAW_PROPOSAL_STATES,
  standard: Object.freeze({
    machine_proposed: word('record-grammar.proposal.standard.machine_proposed'),
    member_proposed: word('record-grammar.proposal.standard.member_proposed'),
    unstated: word('record-grammar.proposal.standard.unstated'),
  }),
  comparison: Object.freeze({
    machine_proposed: word('record-grammar.proposal.comparison.machine_proposed'),
    member_proposed: word('record-grammar.proposal.comparison.member_proposed'),
    unstated: word('record-grammar.proposal.comparison.unstated'),
  }),
  filing_draft: Object.freeze({
    machine_proposed: word('record-grammar.proposal.filing_draft.machine_proposed'),
    member_proposed: word('record-grammar.proposal.filing_draft.member_proposed'),
    unstated: word('record-grammar.proposal.filing_draft.unstated'),
  }),
  theory: Object.freeze({
    machine_proposed: word('record-grammar.proposal.theory.machine_proposed'),
    member_proposed: word('record-grammar.proposal.theory.member_proposed'),
    unstated: word('record-grammar.proposal.theory.unstated'),
  }),
  /* N-A1 (T18, K608): an option proposed for an action plan (action-plans R11) is not an option until a member
     adopts it, and a prepared communication (filings R23) is a draft nobody has approved or sent, worded as
     `filing_draft`'s sentences are. */
  plan_option: Object.freeze({
    machine_proposed: word('record-grammar.proposal.plan_option.machine_proposed'),
    member_proposed: word('record-grammar.proposal.plan_option.member_proposed'),
    unstated: word('record-grammar.proposal.plan_option.unstated'),
  }),
  communication: Object.freeze({
    machine_proposed: word('record-grammar.proposal.communication.machine_proposed'),
    member_proposed: word('record-grammar.proposal.communication.member_proposed'),
    unstated: word('record-grammar.proposal.communication.unstated'),
  }),
  /* K921 (T21, R42): wording proposed for a filing template (filing-templates R6, R13) is not a template's text until a
     member adopts it into a draft, and a machine can propose it and never draft, review or approve a template. */
  template: Object.freeze({
    machine_proposed: word('record-grammar.proposal.template.machine_proposed'),
    member_proposed: word('record-grammar.proposal.template.member_proposed'),
    unstated: word('record-grammar.proposal.template.unstated'),
  }),
  /* DEC-101 (1) (K1019; T23, R43): a draft of a new edition's statement of what changed in it, and why
     (`BIO_Publication_v0_1.md` §5A; case-authoring R39), is not the group's statement until a member adopts or rewrites
     it, and the record keeps that it began as a machine draft. */
  edition_statement: Object.freeze({
    machine_proposed: word('record-grammar.proposal.edition_statement.machine_proposed'),
    member_proposed: word('record-grammar.proposal.edition_statement.member_proposed'),
    unstated: word('record-grammar.proposal.edition_statement.unstated'),
  }),
  /* DEC-89 with Bob's addition (K1019; T23, R44): an escalation's opening reason assembled from the determination's
     record (escalation R29) is not a member's reason until a member sends it, as offered or edited; the reason then
     recorded is the member's own. */
  escalation_reason: Object.freeze({
    machine_proposed: word('record-grammar.proposal.escalation_reason.machine_proposed'),
    member_proposed: word('record-grammar.proposal.escalation_reason.member_proposed'),
    unstated: word('record-grammar.proposal.escalation_reason.unstated'),
  }),
  /* N543 (K1396; T32, R45): steps proposed for a wizard script (wizard-scripts R5) are not a script's steps until its
     author adopts them into a version, and a machine can propose steps and never draft, submit or approve a script
     (wizard-scripts R19), worded as `template`'s sentences are. */
  wizard: Object.freeze({
    machine_proposed: word('record-grammar.proposal.wizard.machine_proposed'),
    member_proposed: word('record-grammar.proposal.wizard.member_proposed'),
    unstated: word('record-grammar.proposal.wizard.unstated'),
  }),
  /* N568 (K1571; T34, R49): a law relation, a court link or a treatment proposed beside the record (standards R23, R26,
     R27, R30) is not one the record holds until a member records it themselves, and a machine can propose one and never
     record one (K1443). Before this subject, standards' `lawPropose` labelled through `standard`, whose sentences speak
     of a standard and misnamed what was proposed. */
  law_relation: Object.freeze({
    machine_proposed: word('record-grammar.proposal.law_relation.machine_proposed'),
    member_proposed: word('record-grammar.proposal.law_relation.member_proposed'),
    unstated: word('record-grammar.proposal.law_relation.unstated'),
  }),
  /* N669 (K1793, K1804; T37, R50; DEC-127 (2), (5), DEC-157 (2)–(4)): a translation of an interface word drafted for a
     group's language (skills' draft run; instance-setup's workspace) is a draft, shown to members as "Draft", and not the
     group's wording until a member granted that language adopts it; a machine can draft one and never adopt or confirm
     one (DEC-157 (4)'s second check is a member's or an administrator's). */
  translation: Object.freeze({
    machine_proposed: word('record-grammar.proposal.translation.machine_proposed'),
    member_proposed: word('record-grammar.proposal.translation.member_proposed'),
    unstated: word('record-grammar.proposal.translation.unstated'),
  }),
  /* N838 (K2540; T42, R54): a draft of a case's account drawn from its cited evidence (case-authoring R64, kind
     `case_account`) is never the case's account, which a member writes in her own words; and a check of a member's
     account (kind `account_check`) flags the sentences the evidence they cite does not support, a draft and never a
     finding of the group. Before these subjects case-authoring worded the same three states itself (`#accountLabel`). */
  case_account: Object.freeze({
    machine_proposed: word('record-grammar.proposal.case_account.machine_proposed'),
    member_proposed: word('record-grammar.proposal.case_account.member_proposed'),
    unstated: word('record-grammar.proposal.case_account.unstated'),
  }),
  account_check: Object.freeze({
    machine_proposed: word('record-grammar.proposal.account_check.machine_proposed'),
    member_proposed: word('record-grammar.proposal.account_check.member_proposed'),
    unstated: word('record-grammar.proposal.account_check.unstated'),
  }),
  /* N912 (K2845; T46, R60): a layout of how a reply to a request for comment bears on each claim of the action
     (`action-replies` R1, `actionBearingPropose`) is a proposed reading, stored apart, and never the group's reading until a
     member records a layout themselves; a machine can propose one and never record one (action-replies R4). Before this
     subject action-replies labelled its proposals through `lawProposalState` with its own sentences. */
  bearing: Object.freeze({
    machine_proposed: word('record-grammar.proposal.bearing.machine_proposed'),
    member_proposed: word('record-grammar.proposal.bearing.member_proposed'),
    unstated: word('record-grammar.proposal.bearing.unstated'),
  }),
  /* N956 (K3028; T47, R61): a draft of a status report on a plan (`plan-work` R14, the assistant's draft) is kept with the
     plan and never published, and the report kept is the member's; a machine can draft one and never keep or publish one.
     `plan-work` labels the assistant's draft through this subject. */
  status_report: Object.freeze({
    machine_proposed: word('record-grammar.proposal.status_report.machine_proposed'),
    member_proposed: word('record-grammar.proposal.status_report.member_proposed'),
    unstated: word('record-grammar.proposal.status_report.unstated'),
  }),
});

/** The tables by subject, for a lookup by a subject's name. */
/** @type {Readonly<Record<string, Readonly<ProposalSentences>>>} */
const BY_SUBJECT = PROPOSAL_STATES;

/** The whole label block a reader is shown beside a proposal: who, which state,
 *  whether it is machine work, and the published sentence. ONE composer, so the
 *  store's read and any later surface cannot compose two answers to one
 *  question (REC-46's eleven-copies finding, arriving at a label). `subject` is
 *  one of `PROPOSAL_STATES`' keys (K171 (2)).
 * @param {string | null | undefined} proposedBy
 * @param {unknown} subject
 * @returns {{by: string | null, state: ProposalState, machine_work: boolean, says: string}} */
export function proposalLabel(proposedBy, subject) {
  const table = typeof subject === 'string' && Object.prototype.hasOwnProperty.call(PROPOSAL_STATES, subject)
    ? BY_SUBJECT[subject] : null;
  if (!table)
    throw new RangeError(`proposalLabel: '${String(subject).slice(0, 40)}' is not a proposal subject; `
      + `one of ${Object.keys(PROPOSAL_STATES).join(', ')}`);
  const state = lawProposalState(proposedBy);
  return { by: proposedBy ?? null, state, machine_work: state === 'machine_proposed', says: table[state] };
}

/* ===================================================================== *
 * WHO MINTED THIS CONTENT ROW (SK-7, out of framework Part II 14.4 —
 * Bob's ruling of 2026-09-14, folded there as 5.7).
 *
 * THE RULING, in its own words: *"The assistant may mark passages as citable
 * on its own, every such row labelled as machine work, never attested by it,
 * and part of a finding only when a member cites it."* Three obligations, and
 * this block is the FIRST of them. The second is C-35.10, which is UNCHANGED
 * and is asserted unchanged. The third is structural and is asserted where it
 * is structural (`earnedBasisRegistry` answers `earned.content` only over the
 * content ids a CALLER named, and the only caller that names them is a basis of
 * legs a member authored).
 *
 * WHY A PUBLISHED STATE MAP RATHER THAN A BOOLEAN ON THE ROW, and the
 * precedent is one field over rather than an argument from taste. PL-17 /
 * DEC-65 met exactly this shape on `asserted_by`: the column holds an IDENTITY,
 * a surface renders the identity verbatim, and the moment the field can hold a
 * machine word the surface prints a machine word at a member. `content.minted_by`
 * is that column again — it holds `plane`, a member handle, or a control-plane
 * machine stamp — and a surface that renders `Asserted by ${…}` verbatim is one
 * field over from it. So the plane answers the QUESTION and publishes the
 * SENTENCE, and the surface renders what it was given (DEC-49's rule reaching a
 * published vocabulary's texts, `SUFFICIENCY_CLAIM_STATES`' own words).
 *
 * THE READING IS TOTAL, which is what makes "labelled everywhere" checkable:
 * four states, every `minted_by` lands in exactly one, and `unstated` is a
 * STATED answer rather than a gap (CLAUDE.md — undetermined is first-class).
 *
 * `plane` IS NOT `machine`, AND THAT DISTINCTION IS THE LOAD-BEARING ONE.
 * A row minted at `op=promote` is the mechanical referent of a citation A
 * MEMBER AUTHORED — the member named the passage in their own basis and the
 * record minted the row to hold it, in the same transaction. Calling that
 * "machine work" would label a member's own citation as the assistant's, which
 * is the ruling read backwards and would put the label on the wrong act. What
 * 5.7 is about is a row NOBODY cited: a machine credential marking a passage
 * citable on its own initiative, which is why that state's sentence says out
 * loud that no member has cited it yet.
 * ===================================================================== */

/** The minter a row carries when the RECORD ITSELF minted it, at the moment a
 *  member's own citation first named the passage (`op=promote`'s projection).
 *  ONE literal in ONE place: content's `mint` default, the stamps inquiry and
 *  basis-versions pass at the write, query's `minted_by` filter, the classifier
 *  below and every assertion read the same string (content's `mintContent`,
 *  which defaulted to it, was removed uncalled in T22), so the stamp and the
 *  reading of it cannot drift — REC-46's finding taken before it repeats. */
export const CONTENT_MINTED_BY_PLANE = 'plane';

/** The four states of a content row's `minted_by`, each carrying the sentence a
 *  member reads INSTEAD OF the stored identity. Published through
 *  `vocabularies.content_mint_states` so no surface invents its own wording for
 *  a distinction the record now draws. */
/*  THE KEYS ARE SPECIFIC, AND THE REASON IS A MEASUREMENT RATHER THAN TASTE.
 *  The first draft spelled them `member` / `plane` / `machine` / `unstated`, and
 *  the old battery's `skillpack.test.mjs` ARM B2a went red (found by it; the
 *  suite was deleted at T20): `src/skillpack.mjs` carried
 *  `const MACHINE_MODE = "machine"` since SK-2, and publishing a vocabulary
 *  whose key is a single common word made that unrelated literal look like a
 *  HAND COPY of a published term — the defect that arm was written to catch,
 *  arriving as a false positive because the key was too generic to
 *  belong to anybody. The keys are now verbs of THIS act, which is what a
 *  published vocabulary's keys should have been anyway, and `machine_marked`
 *  reads beside `machine_stamped` one vocabulary over. */
/** @type {{member_marked: string, plane_minted: string, machine_marked: string, unstated: string}} */
export const CONTENT_MINT_STATES = {
  member_marked: word('record-grammar.mint.member_marked'),
  plane_minted: word('record-grammar.mint.plane_minted'),
  machine_marked: word('record-grammar.mint.machine_marked'),
  unstated: word('record-grammar.mint.unstated'),
};

/** Read a content row's `minted_by` as ONE of the four states above.
 *
 *  THE ORDER OF THE ARMS IS LOAD-BEARING, and it is `sufficiencyClaimState`'s
 *  order for its reason. Blank is answered first, because "nobody said" and "a
 *  machine said" are different findings. The PLANE's own value is answered
 *  BEFORE `isMachineIdentity`, so the record's mint on a member's behalf can
 *  never be swallowed into `machine` by a later addition to the machine
 *  prefixes — and the module's tests pin `isMachineIdentity(CONTENT_MINTED_BY_PLANE)
 *  === false` besides (R37), so a collision fails loudly instead of hiding behind
 *  this ordering. Everything left is a name, which is a member.
 * @param {unknown} mintedBy
 * @returns {'unstated' | 'plane_minted' | 'machine_marked' | 'member_marked'} */
export function contentMintState(mintedBy) {
  const s = text(mintedBy);
  /*  Spelled `s.length === 0` because a control in the old battery once anchored on the `s === ''` spelling elsewhere
   *  and had to match it exactly once (found by it; the control was deleted at T20). The two tests are the same. */
  if (s.length === 0) return 'unstated';
  if (s.toLowerCase() === CONTENT_MINTED_BY_PLANE) return 'plane_minted';
  if (isMachineIdentity(s)) return 'machine_marked';
  return 'member_marked';
}
