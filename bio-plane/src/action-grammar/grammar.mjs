/* action-grammar — the action document's grammar as the catalogue held it (requirements:
 * `build/requirements/action-grammar.md`, R1–R6, R10, R13).
 *
 * Moved from `legacy-checks` (`checks/bio-checks.mjs`) in T19 layer 9 with their comments, line for line: the action
 * vocabularies (`ACTION_KINDS`, `RISK_TIERS`, `riskTierState`, `lawProposalLabel`, `ACTION_BASIS_KINDS`,
 * `CORRESPONDENCE_DIRECTIONS`, `RFC_RESPONSE_WINDOW_PRECEDENT`), C-2.10's leg and ledger arms (`actionBasisFindings`,
 * `correspondenceFindings`), the quote grammar (D-148: `QUOTE_KEYS`, `isQuoteEntry`, `quoteValue`, `quoteFindings`) and
 * the records-request lifecycle grammar (D-147: `CORRESPONDENCE_STAGES`, `CORRESPONDENCE_OUTCOMES`, `DECISION_STAGES`,
 * `LIFECYCLE_KEYS`, `lifecycleFindings`). Each value is the catalogue's, unchanged (R2). The catalogue was deleted at
 * T19's close (K855); nothing here imported it.
 *
 * Uses (each read, never copied):
 *   - `record-grammar`: `BUNDLE_ID_RE`, `OBJECT_TYPES`, `proposalLabel`;
 *   - `inquiry-grammar`: `leadLegFindings` (C-54.1, its R5), the one lead checker an action's leg is asked;
 *   - `connections`: `themeLegFindings` (C-81.1, its R46), asked of each leg.
 *
 * Pure (R10): nothing here reads or writes the record, the clock or the network; every function never throws on a
 * document it is handed. */

import { BUNDLE_ID_RE, OBJECT_TYPES, proposalLabel } from "../record-grammar/index.mjs";
import { leadLegFindings } from "../inquiry-grammar/grammar.mjs";
import { themeLegFindings } from "../connections/checks.mjs";
import { word, localize } from '../setup-words/index.mjs';

/** A finding, record-grammar's shape (its R11), with the optional `code` (REC-56 / D-206). */
function f(check, severity, message, repairs, code) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  if (code) out.code = code;
  return out;
}
/** A direction as a person reads it: the code `no_response` is written "no response". */
function plainDirection(d) { return d === 'no_response' ? 'no response' : String(d); }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** T45 (K2845, K2849 (5)): a success record's id as `consequences` mints it, `SUC-<year>-<4 digits>`, which a `rests_on`
 *  leg may name until record-grammar registers the prefix (N911). */
export const SUCCESS_RECORD_ID_RE = /^SUC-\d{4}-\d{4}$/;
/* A captured artifact's content hash (`sha256:` and 64 hex), the shape `correspondenceFindings` accepts beside bare hex. */
const CONTENT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// Constants (spec v1.1)
// ---------------------------------------------------------------------------

/** The ACTION vocabulary (C-2.10's suite). EXPORTED for op=affordances
 *  (REC-19): the plane publishes these so a surface never keeps a copy, and
 *  checkActionExtension consumes this same array, so the gate and the
 *  publication cannot drift apart. */
/* DEC-13 adds `request_for_comment` as the EIGHTH kind, and it is the one kind
 * in this array with an extra entry requirement attached (below). Bob's ruling
 * is that what is required is not the contact but the group's DECLARED,
 * JUSTIFIED POSITION on it — so this kind is never forced on anybody. What it
 * is forced to do is CARRY SPECIFICS when it is used: the Columbia Journalism
 * School review of Rolling Stone identified a comment request made WITHOUT
 * SPECIFICS as the central failure, so "we contacted them" and "we put these
 * four claims to them" must be different rows in this record. */
export const ACTION_KINDS = ['cpra_request', 'grand_jury', 'controller_referral', 'public_comment', 'media', 'litigation_support', 'request_for_comment', 'other'];

/* D-182, RULED 2026-09-21 by BOB #21 (BIO_Case_Making_v0_1.md §2, "risk_tier"): the tier of an action is
 * the ONE field that carries legal exposure, and its words are Bob's own, from the mission of record
 * (BIO_Complete_Roadmap_v5.md §8). A code->text map, not a list, for SUFFICIENCY_CLAIM_STATES' reason: the
 * sentence IS the tier's meaning, and a surface that renders a bare `2` has had to decide what 2 means.
 * Published by op=affordances (vocabularies.risk_tiers) so a surface invents none (REC-38's pattern).
 *
 * `undetermined` is the fourth value, as it is for authority and the counterparty (D-130): WRITTEN wherever
 * no member has stated a tier, and never a default of 1. Before this row every writer defaulted to 1, which
 * told a member an action was safe to file freely when nobody had assessed it. Only a member's authored act
 * sets 1, 2 or 3. An action whose bytes carry NO `risk_tier` key reads undetermined too, because that is
 * exactly what the absence says: nobody stated one. The gate does not refuse the absence, since a gate
 * that did would press a writer to invent the one value nobody assessed (CLAUDE.md §4). */
export const RISK_TIERS = {
  1: 'file freely',
  2: word('risk.tier.2'),
  3: word('risk.tier.3'),
  undetermined: word('risk.tier.undetermined'),
};
/* The stored value -> one of RISK_TIERS' keys, or null for a value the vocabulary does not hold (which
 * C-2.10 refuses by name). Absent and the literal `undetermined` read as undetermined; the NUMBERS 1, 2 and
 * 3 read as themselves (a quoted "2" stays refused, exactly as before this row). Every reader takes this,
 * never the literal. */
export function riskTierState(v) {
  if (v === undefined || v === null || v === 'undetermined') return 'undetermined';
  return v === 1 || v === 2 || v === 3 ? v : null;
}

/** REC-195's label, kept by name for its readers (`actions`, `action-clocks`): the `governing_laws` case. */
export function lawProposalLabel(proposedBy) {
  return proposalLabel(proposedBy, 'governing_laws');
}


/* REC-24 (a): the two kinds a leg of an action's basis may carry. Exported for
 * the same reason ACTION_KINDS is — op=affordances publishes it and the store
 * projects against it, so the gate and the publication read ONE array. */
export const ACTION_BASIS_KINDS = ['rests_on', 'advances'];

/* REC-24 (b): the three directions a correspondence entry may carry.
 * `no_response` is the one that is easy to leave out and must not be: DEC-13
 * rules a refusal to reply a dated first-party fact about the body, and
 * frequently the more useful one. */
export const CORRESPONDENCE_DIRECTIONS = ['sent', 'received', 'no_response'];

/* DEC-13's SOURCED PRECEDENT for a response window, carried as a citation and
 * NOT as an enforced range. GAO's own protocols under GAGAS/Yellow Book give an
 * audited agency 7 to 30 calendar days on a draft. What this catalog enforces is
 * that the window is AUTHORED by the group with a basis — the same shape a
 * progression's declared due-by takes — because a constant this project invented
 * would be this project asserting a deadline nobody agreed to. The numbers are
 * here so a surface can SHOW the precedent while the member chooses. */
export const RFC_RESPONSE_WINDOW_PRECEDENT = {
  min_days: 7, max_days: 30,
  source: 'GAGAS / GAO agency-comment protocol (7-30 calendar days on a draft)',
  enforced: false,
};

/** REC-24 (a): the action's basis legs, and DEC-13's specificity requirement.
 *
 *  Exported so `actions` runs this same function at the write (the
 *  checkInquiryBasis precedent), which is what stops a malformed basis landing
 *  and auditing clean at the same time.
 *
 *  WHAT IT HOLDS. A leg names a target that is a canonical id, and a kind from
 *  the closed pair. A leg may NOT point at an action: an action resting on an
 *  action is our own work cited as the reason for our own work, which is the
 *  circularity DEC-14 spends its whole ruling refusing, and it is cheaper to
 *  refuse the shape than to detect the claim later.
 *
 *  AND DEC-13'S ONE HARD REQUIREMENT: a `request_for_comment` NAMES THE
 *  SPECIFIC INQUIRIES IT DISCLOSED, as `advances` legs. Zero inquiries is
 *  refused BY NAME, because that is exactly the ask the Columbia review found
 *  at the centre of the Rolling Stone failure — a comment request with no
 *  specifics, which looks like diligence in the record and gave the subject
 *  nothing to answer. The kind is `advances` and not `rests_on` on purpose:
 *  putting a claim to its subject PURSUES that question, and the reply may
 *  change the answer (DEC-13: "the response may change the case, and that is
 *  the point"). A finding the request is BUILT ON is a rests_on leg and may sit
 *  beside it; it is not what was disclosed.
 *
 *  THE WINDOW IS AUTHORED, AND ITS RANGE IS NOT ENFORCED. A request_for_comment
 *  carries at least one clock[] entry — the response window — and C-11.1
 *  already requires every clock entry to carry a basis (the statute, order or
 *  commitment the date derives from). RFC_RESPONSE_WINDOW_PRECEDENT carries
 *  GAO's 7-30 days as a CITATION for a surface to show; nothing here compares a
 *  date against it, because a window this project invented would be this
 *  project asserting a deadline nobody agreed to. */
export function actionBasisFindings(fm, findings) {
  const legs = Array.isArray(fm?.action_basis) ? fm.action_basis : [];
  const REPAIRS = [localize('action-grammar.grammar.point_the_leg_at_the_finding_it', 'point the leg at the finding it rests on, or at the question it advances')];
  legs.forEach((l, i) => {
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.basis_leg_i_is_not_a', 'basis leg {i} is not a complete entry: it must name a record, and say whether the action rests on it or advances a question', { i: String(i) }), REPAIRS));
      return;
    }
    /* R30: the label the two checkers word their findings around is a plain name of the entry, never its field path. */
    const label = localize('action-grammar.grammar.basis_leg_label', 'basis leg {i}', { i: String(i) });
    /* MK-4 / C-54.1: an action resting on a LEAD rests on nothing found. */
    if (leadLegFindings(label, l, findings)) return;
    /* D-162 / C-81.1: an action resting on a THEME rests on a member's lens, not on anything found. */
    if (themeLegFindings(label, l, findings)) return;
    const target = typeof l.target === 'string' ? l.target : '';
    /* T45 (K2845, K2849 (5); `actions` R93): a `rests_on` leg may name a success record, `consequences`' own row, by its id;
       accepted here until record-grammar's id table registers the prefix (N911). Whether it is live and visible is
       `actions`' read (`successRecordRead`). */
    const success = l.kind === 'rests_on' && SUCCESS_RECORD_ID_RE.test(target);
    if (success) { /* a success record: no canonical-id finding */ }
    else if (!BUNDLE_ID_RE.test(target)) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.basis_leg_i_names_string_which', "basis leg {i} names '{String}', which is not a valid record id", { i: String(i), String: String(l.target).slice(0, 40) }), REPAIRS));
    } else if (OBJECT_TYPES[target.split('-')[0]] === 'action') {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.basis_leg_i_points_at_an_action', "basis leg {i} points at '{target}', which is an action. An action does not rest on our own action: evidence for what we did is evidence somebody else produced", { i: String(i), target: String(target) }),
        [localize('action-grammar.grammar.point_the_leg_at_the_finding_or', 'point the leg at the finding or the question, not at another action')]));
    }
    if (!ACTION_BASIS_KINDS.includes(l.kind)) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.basis_leg_i_must_say', "basis leg {i} must say whether the action rests on a finding or advances a question, not '{String}'", { i: String(i), String: String(l.kind).slice(0, 40) }), REPAIRS));
    }
  });

  if (fm?.action_kind === 'request_for_comment') {
    const disclosed = legs.filter((l) => l && typeof l === 'object' && l.kind === 'advances'
      && typeof l.target === 'string' && BUNDLE_ID_RE.test(l.target)
      && OBJECT_TYPES[l.target.split('-')[0]] === 'inquiry');
    if (!disclosed.length) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.a_request_for_comment_must_name', "A request for comment must name the specific questions it puts to the subject: add each one under 'Advances', chosen from your team's record. A comment request without specifics gives the subject nothing to answer."),
        [localize('action-grammar.grammar.choose_each_question_the_request', "choose each question the request puts to the subject, and mark it 'Advances'")]));
    }
    const clock = Array.isArray(fm.clock) ? fm.clock : [];
    if (!clock.length) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.request_for_comment_states_window', 'a request for comment states the response window it gave, as a dated entry with its own basis. The team sets the window; {source} is the precedent to reason from, and nothing here enforces it', { source: String(RFC_RESPONSE_WINDOW_PRECEDENT.source) }),
        [localize('action-grammar.grammar.add_a_response_date', 'add a response date: the date the response was due, and the basis it comes from')]));
    }
  }
}

/** REC-24 (b): the correspondence ledger, and the CAPTURE-OR-TESTIFY choice
 *  made structural.
 *
 *  Exported and run by `actions` at the write, like actionBasisFindings above.
 *
 *  THE RULE, and why NEITHER and BOTH are both refused. An entry carries either
 *  an `artifact_sha` — bytes we hashed and can produce later — or an `account`
 *  with an `author`, a named member's dated testimony that the exchange
 *  happened. NEITHER is an entry that stands for nothing: it asserts a
 *  correspondence and offers no way to check it, which is the overclaiming
 *  class this record exists to catch. BOTH is the subtler one and DEC-13 rules
 *  it directly — what comes back is CAPTURED, not summarised — so an entry may
 *  not carry the bytes AND a paraphrase of them, because the paraphrase is what
 *  a reader would quote and the bytes are what the group can defend.
 *
 *  THE SHA'S SHAPE IS CHECKED HERE AND ITS RESOLUTION IS NOT, stated rather
 *  than implied: this catalog is a pure function over one document, and the
 *  only resolver injected into it answers for BUNDLE ids. Whether the hash
 *  names a real capture is a fact about the `register` table, so promote
 *  enforces it — the REC-23 entity_id precedent, one construct over.
 *
 *  `author` IS SERVER-STAMPED and this check only requires its PRESENCE. A
 *  document carrying an account with no author is refused; a document carrying
 *  a FALSE author is not something a pure check can see, and `actions`'
 *  write overwriting the field is what makes it true. */
export function correspondenceFindings(fm, findings) {
  const entries = Array.isArray(fm?.correspondence) ? fm.correspondence : [];
  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      findings.push(f('C-2.10', 'error', localize('action-grammar.grammar.correspondence_i_is_not_an', 'entry {i} of the correspondence is not a complete entry', { i: String(i) })));
      return;
    }
    if (!CORRESPONDENCE_DIRECTIONS.includes(e.direction)) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.correspondence_i_direction_is_not', "entry {i} is marked '{String}', but it must be sent, received, or no response", { i: String(i), String: String(e.direction).slice(0, 40) }),
        [localize('action-grammar.grammar.record_a_non_response_as_direction', 'record a non-response as a no response entry, dated by when the reply was due')]));
    }
    if (!DATE_RE.test(String(e.at ?? '').slice(0, 10))) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.correspondence_i_at_string_is_not', "entry {i}'s date '{String}' is not a date. Every entry is dated, including a non-response, which is dated by when the reply was due", { i: String(i), String: String(e.at).slice(0, 40) })));
    }
    const sha = typeof e.artifact_sha === 'string' ? e.artifact_sha.trim() : '';
    const account = typeof e.account === 'string' ? e.account.trim() : '';
    const author = typeof e.author === 'string' ? e.author.trim() : '';
    const CHOICE = [
      localize('action-grammar.grammar.choice_capture', 'keep the document itself, so its exact bytes can be produced later, or'),
      localize('action-grammar.grammar.choice_testify', 'name the member who is testifying that the exchange happened'),
    ];
    if (sha && account) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.entry_carries_both_a_kept', "entry {i} carries both a kept document and a named account. What came back is kept as it arrived, not summarised. The document is what the team can defend; a paraphrase beside it is what a reader would quote instead", { i: String(i) }), CHOICE));
    } else if (!sha && !account) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.correspondence_i_carries_neither', 'entry {i} carries neither a kept document nor a named account: it claims an exchange and gives no way to check that it happened', { i: String(i) }), CHOICE));
    } else if (sha) {
      if (!CONTENT_HASH_RE.test(sha) && !/^[0-9a-f]{64}$/i.test(sha)) {
        findings.push(f('C-2.10', 'error',
          localize('action-grammar.grammar.correspondence_i_artifact_sha_string_is', "entry {i}'s kept document has the fingerprint '{String}', which is not a sha256 hash", { i: String(i), String: sha.slice(0, 24) })));
      }
      if (e.direction === 'no_response') {
        findings.push(f('C-2.10', 'error',
          localize('action-grammar.grammar.non_response_carries_a_kept', 'entry {i} is a no response but carries a kept document. Nothing arrived, so there is nothing to keep. A non-response is recorded as a named account with its date', { i: String(i) }),
          [localize('action-grammar.grammar.record_the_non_response_as_an', 'record the non-response as a named account: what was due, when, and that nothing came')]));
      }
    } else if (!author) {
      findings.push(f('C-2.10', 'error',
        localize('action-grammar.grammar.correspondence_i_carries_an_account', "entry {i} names an account with no member standing behind it: testimony is somebody's, and an unattributed account is a claim nobody stands behind", { i: String(i) })));
    }
    /* D-148: the QUOTE arm, one rule shared with op=actioncorrespond (quoteFindings below). */
    for (const q of quoteFindings(entries, i)) findings.push(f('C-2.10', 'error', q.message, null, q.code));
    /* D-147: the LIFECYCLE arm, one rule shared with op=actioncorrespond (lifecycleFindings below). */
    for (const q of lifecycleFindings(entries, i)) findings.push(f('C-2.10', 'error', q.message, null, q.code));
  });
}

/** D-148 — A FEE QUOTE IS EVIDENCE (Bob, 2026-09-22; `BIO_Case_Making_v0_1.md` §2).
 *
 *  A `received` correspondence entry may carry a QUOTE, written as FLAT keys on
 *  the entry because the restricted grammar has no nested map inside an array
 *  element:
 *
 *    quote_amount    the amount AS QUOTED — a number, kept as the text the body
 *                    wrote (`"1083.00"`, `"1,083.00"`), so a reader sees what was
 *                    said and not our rounding of it
 *    quote_currency  the currency AS QUOTED (`USD`, `$`), never inferred
 *    quote_basis     the stated basis VERBATIM (hours, rate, per page), optional:
 *                    absent means none was RECORDED, never that none was stated
 *    quote_answers   the ORD of the earlier `sent` entry it answers — the request's
 *                    own text is its scope
 *    quote_revises   optional: the ORD of an earlier quote this one revises. A
 *                    waiver is a revision to zero, and BOTH entries stand
 *
 *  THE RULE IS ONE FUNCTION and it runs at three gates, on the capture-or-testify
 *  precedent above: the op (so a member is told before anything is written), this
 *  catalog over the document that lands, and promote. Each finding carries its
 *  C-72 code so the op refuses by the same name the catalog reports.
 *
 *  WHAT IS NOT CHECKED, on purpose: that a quote is reasonable, lawful or larger
 *  than another. The record asserts only what was quoted, by whom, when, for which
 *  request (DEC-24); any judgement about a quote is a member's claim in an inquiry.
 *
 *  A NUMBER is a decimal with an optional sign and optional thousands separators in
 *  groups of three. A sign is allowed because the rule is "a number" and a fence
 *  tighter than its rule is not a safer fence; `quoteValue` parses it for ordering.
 *
 *  @returns {{code: string, message: string}[]} */
export const QUOTE_KEYS = ['quote_amount', 'quote_currency', 'quote_basis', 'quote_answers', 'quote_revises'];
const QUOTE_NUMBER_RE = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;
const ORD_RE = /^\d+$/;
export function isQuoteEntry(e) {
  return !!e && typeof e === 'object' && !Array.isArray(e)
    && Object.keys(e).some((k) => k.startsWith('quote_'));
}
export function quoteValue(amount) {
  const s = amount === null || amount === undefined ? '' : String(amount).trim();
  return QUOTE_NUMBER_RE.test(s) ? Number(s.replace(/,/g, '')) : null;
}
export function quoteFindings(entries, i) {
  const out = [];
  if (!Array.isArray(entries)) return out;
  const e = entries[i];
  if (!isQuoteEntry(e)) return out;
  if (e.direction !== 'received') {
    out.push({ code: 'QUOTE_NOT_ON_RECEIVED', message:
      localize('action-grammar.grammar.quote_i_is_on_a_sent', "entry {i} carries a quote, but it is marked '{String}'. A quote is what a body sent back, so it belongs on a received entry", { i: String(i), String: plainDirection(e.direction) }) });
    return out;
  }
  if (quoteValue(e.quote_amount) === null) {
    out.push({ code: 'QUOTE_AMOUNT_NOT_A_NUMBER', message:
      localize('action-grammar.grammar.quote_i_amount_string_is', "entry {i}'s quoted amount '{String}' is not a number: the amount is kept as quoted, and an amount that cannot be read as a number cannot be set beside another", { i: String(i), String: String(e.quote_amount ?? '').slice(0, 40) }) });
  }
  const cur = e.quote_currency === null || e.quote_currency === undefined ? '' : String(e.quote_currency).trim();
  if (!cur) {
    out.push({ code: 'QUOTE_NO_CURRENCY', message:
      localize('action-grammar.grammar.quote_i_carries_a_quote_with', 'entry {i} carries a quote with no currency: the currency is kept as quoted and is never inferred', { i: String(i) }) });
  }
  const ordOf = (v) => (v === null || v === undefined || !ORD_RE.test(String(v).trim()))
    ? null : Number(String(v).trim());
  const a = ordOf(e.quote_answers);
  const sent = a !== null && a < i ? entries[a] : null;
  if (!sent || typeof sent !== 'object' || sent.direction !== 'sent') {
    out.push({ code: 'QUOTE_ANSWERS_NO_SENT', message:
      localize('action-grammar.grammar.quote_i_answers_string_which', "entry {i} answers entry '{String}', which is not an earlier sent entry: a quote answers a request this record holds, and the request's own text is its scope", { i: String(i), String: String(e.quote_answers ?? '').slice(0, 20) }) });
  }
  if (e.quote_revises !== undefined && e.quote_revises !== null && e.quote_revises !== '') {
    const r = ordOf(e.quote_revises);
    const prior = r !== null && r < i ? entries[r] : null;
    if (!prior || typeof prior !== 'object' || prior.direction !== 'received' || !isQuoteEntry(prior)) {
      out.push({ code: 'QUOTE_REVISES_NO_QUOTE', message:
        localize('action-grammar.grammar.quote_i_revises_string_which', 'entry {i} revises entry \'{String}\', which is not an earlier quote: a revision names the quote it revises, and both entries stand', { i: String(i), String: String(e.quote_revises).slice(0, 20) }) });
    }
  }
  return out;
}

/** D-147 — THE RECORDS-REQUEST LIFECYCLE (BOB #27, 2026-09-22; `BIO_Case_Making_v0_1.md` §2,
 *  *THE RECORDS-REQUEST LIFECYCLE*), on D-148's pattern and bound by D-149.
 *
 *  `awaiting_response` hid every stage after the request. Each stage is now its OWN correspondence
 *  entry naming the entry it answers or follows, so the lifecycle reads as a chain of dated entries.
 *  FLAT keys on the entry, as D-148's quote is written, because the restricted grammar has no nested
 *  map inside an array element:
 *
 *    stage       what this entry IS in the round trip, by direction (CORRESPONDENCE_STAGES). Optional:
 *                an entry written before this row carries none and reads "not stated", never guessed.
 *    follows     the ORD of the earlier entry this one answers or follows. Required on every stage but
 *                `request`; an appeal names the DECISION it appeals (a received entry carrying an outcome).
 *    outcome     a decision's OUTCOME in the closed vocabulary (CORRESPONDENCE_OUTCOMES), as the body gave
 *                it — `none_stated` when it gave none, `none_exists` when it said no responsive record exists (R13). Only on a received entry; REQUIRED on the four
 *                decision stages, so a decision never reads as one whose outcome nobody recorded.
 *    exemptions  the exemptions a denial cited, VERBATIM as the body cited them. Received only.
 *    due_by      the date by which the NEXT stage is due, as a MEMBER states it, with
 *    due_cite    the citation it comes from — one of the action's D-149 governing laws (checked at the op,
 *                where the list is read; see below). Both or neither.
 *
 *  THE CLOCK IS NEVER ENCODED (D-149: the plane encodes no law's rules). Nothing here computes a due
 *  date from a kind, a law or a stage; with none stated it is UNDETERMINED, and `requestLifecycleOf`
 *  says so. What the plane derives is only what costs nothing to invent: days elapsed between dated
 *  entries, and that a stated date passed with no entry following it.
 *
 *  WHY `due_cite` IS JUDGED AGAINST THE LIST AT THE OP AND NOT HERE. This rule runs over every version
 *  of the document at promote, and the governing-law list is a member's act that may later change. A
 *  catalog arm refusing an entry whose cited law was later taken off the list would make op=actionlaws
 *  fail on history — an earlier dated statement made unwritable by a later one. So the op refuses a
 *  citation that is not on the list WHEN IT IS STATED (DUE_CITE_NOT_GOVERNING), and the read states,
 *  per entry, whether the citation is on the list NOW. A direct promote carrying a citation that was
 *  never on the list is therefore not refused here; the read says `on_list: false` for it.
 *
 *  @returns {{code: string, message: string}[]} */
export const CORRESPONDENCE_STAGES = {
  sent: ['request', 'fee_waiver_request', 'appeal', 'court_filing'],
  received: ['acknowledgement', 'fee_estimate', 'fee_waiver_decision', 'extension_notice', 'production',
             'denial', 'appeal_decision', 'court_decision'],
};
/* R13 (T41; H30 (1), intent R33, K2505): `none_exists`, the body's answer that no responsive record exists, is an outcome
 * of a received decision as the others are; appended, so every earlier position stands. */
export const CORRESPONDENCE_OUTCOMES = ['granted', 'denied', 'partial', 'reversed', 'affirmed', 'none_stated', 'none_exists'];
export const DECISION_STAGES = ['fee_waiver_decision', 'denial', 'appeal_decision', 'court_decision'];
export const LIFECYCLE_KEYS = ['stage', 'follows', 'outcome', 'exemptions', 'due_by', 'due_cite'];
export function lifecycleFindings(entries, i) {
  const out = [];
  if (!Array.isArray(entries)) return out;
  const e = entries[i];
  if (!e || typeof e !== 'object' || Array.isArray(e)) return out;
  const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const stage = str(e.stage), follows = str(e.follows), outcome = str(e.outcome);
  const exemptions = str(e.exemptions), dueBy = str(e.due_by), dueCite = str(e.due_cite);
  if (stage) {
    const legal = CORRESPONDENCE_STAGES[e.direction] || [];
    if (!legal.includes(stage)) {
      out.push({ code: 'STAGE_NOT_OF_DIRECTION', message:
        localize('action-grammar.grammar.entry_stage_is_not_one', 'entry {i} is marked as the \'{stage}\' stage, which a \'{direction}\' entry cannot be: {v1}', { i: String(i), stage: String(stage.slice(0, 40)), direction: plainDirection(e.direction), v1: String(legal.length ? `one of ${legal.join(', ')}` : localize('action-grammar.grammar.a_non_response_has_no', 'a non-response has no stage; it names the entry it awaited')) }) });
    }
  }
  let prior = null;
  if (follows) {
    const n = /^\d+$/.test(follows) ? Number(follows) : null;
    prior = n !== null && n < i ? entries[n] : null;
    if (!prior || typeof prior !== 'object') {
      out.push({ code: 'FOLLOWS_NO_ENTRY', message:
        localize('action-grammar.grammar.correspondence_i_follows_string_names', "entry {i} names entry '{follows}', which is not an earlier entry in this record. Each stage names the entry it answers or follows, by its position counted from zero", { i: String(i), follows: String(follows.slice(0, 20)) }) });
      prior = null;
    }
  } else if (stage && stage !== 'request') {
    out.push({ code: 'FOLLOWS_NO_ENTRY', message:
      localize('action-grammar.grammar.correspondence_i_is_a_naming', "entry {i} is a '{stage}' that names no entry it follows: each stage after the request names the entry it answers or follows, so the record reads as one chain", { i: String(i), stage: String(stage) }) });
  }
  if (stage === 'appeal' && follows && prior
      && !(prior.direction === 'received' && str(prior.outcome))) {
    out.push({ code: 'APPEAL_NAMES_NO_DECISION', message:
      localize('action-grammar.grammar.correspondence_i_is_an_appeal', 'entry {i} is an appeal of entry {follows}, which is not a decision: an appeal names the decision it appeals, a received entry with an outcome', { i: String(i), follows: String(follows) }) });
  }
  if (outcome) {
    if (e.direction !== 'received') {
      out.push({ code: 'OUTCOME_NOT_ON_RECEIVED', message:
        localize('action-grammar.grammar.correspondence_i_carries_an_outcome', "entry {i} carries an outcome but is marked '{String}': an outcome is what the body decided and sent back, so it belongs on a received entry", { i: String(i), String: plainDirection(e.direction) }) });
    } else if (!CORRESPONDENCE_OUTCOMES.includes(outcome)) {
      out.push({ code: 'OUTCOME_NOT_IN_VOCABULARY', message:
        localize('action-grammar.grammar.correspondence_i_outcome_string_is', "entry {i}'s outcome '{String}' is not one of: granted, denied, partial, reversed, affirmed, none stated, none exists", { i: String(i), String: String(outcome.slice(0, 40)) }) });
    }
  } else if (DECISION_STAGES.includes(stage) && e.direction === 'received') {
    out.push({ code: 'DECISION_WITHOUT_OUTCOME', message:
      localize('action-grammar.grammar.correspondence_i_is_a_with', "entry {i} is a '{stage}' with no outcome: a decision carries the outcome the body gave, and 'none stated' when it gave none", { i: String(i), stage: String(stage) }) });
  }
  if (exemptions && e.direction !== 'received') {
    out.push({ code: 'OUTCOME_NOT_ON_RECEIVED', message:
      localize('action-grammar.grammar.correspondence_i_carries_exemptions', "entry {i} carries exemptions but is marked '{String}': the exemptions are the ones the body cited, so they belong on a received entry", { i: String(i), String: plainDirection(e.direction) }) });
  }
  if (stage === 'fee_estimate' && e.direction === 'received' && !isQuoteEntry(e)) {
    out.push({ code: 'FEE_ESTIMATE_WITHOUT_QUOTE', message:
      localize('action-grammar.grammar.correspondence_i_is_a_fee', 'entry {i} is a fee estimate with no quote: a fee estimate is a quote, the amount and currency as quoted', { i: String(i) }) });
  }
  if (!!dueBy !== !!dueCite) {
    out.push({ code: 'DUE_HALF_STATED', message: dueBy
      ? localize('action-grammar.grammar.correspondence_i_states_a_due', "entry {i} gives a due date with no citation: a due date is stated with the citation it comes from, one of the action's governing laws, or not at all", { i: String(i) })
      : localize('action-grammar.grammar.correspondence_i_states_a_citation', "entry {i} gives a citation with no due date: a due date is stated with the citation it comes from, one of the action's governing laws, or not at all", { i: String(i) }) });
  } else if (dueBy && !/^\d{4}-\d{2}-\d{2}$/.test(dueBy)) {
    out.push({ code: 'DUE_NOT_A_DATE', message:
      localize('action-grammar.grammar.correspondence_i_due_by_string_is', "entry {i}'s due date '{String}' is not a date in the form year-month-day", { i: String(i), String: String(dueBy.slice(0, 40)) }) });
  }
  return out;
}
