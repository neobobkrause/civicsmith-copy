/* C-60 and C-93 (R20; K6, K64's pattern): the pairing read's and the candidate door's refusals, moved from the check
   catalogue with their headers. Each is an invariant of this module with its own test (`test/m/contradiction/`). */

import { word, localize } from '../setup-words/index.mjs';

/* REC-146 / C-60 — THE CONTRADICTION PAIRING READ'S REFUSALS
 * (`CONTRADICTION-IDENTIFY-DESIGN.md` section 4, section 9 item 1).
 *
 * ONE refusal, and the family is one row rather than padded out, because the read
 * takes exactly one argument that can be wrong. `limit` is CLAMPED and not refused
 * (a number out of range is a caller asking for more than the plane gives, which the
 * published `limit` already answers); an absent or unrecognised viewer is not refused
 * either — it fails CLOSED through `viewerPredicate` and the answer SAYS the read saw
 * nothing, which is the section 6 obligation and not a refusal.
 *
 * WHY THE KEY IS REFUSED RATHER THAN IGNORED, and it is `MEANING_ROWS_UNKNOWN_ARM`'s
 * reasoning at C-23.2 one construct over: `key=` SELECTS A JOIN. A misspelled key that
 * silently ran all four — or none — would answer a question the caller did not ask, and
 * on THIS surface an answer reads as a census of what was compared. Section 4's own rule
 * is that keys are ADDED, never tuned, precisely so the per-key figures stay comparable
 * across runs; a key name that answered from a different key would make them incomparable
 * while looking complete. So the refusal NAMES the keys the record holds. */
export const CONTRADICTION_PAIR_CHECKS = {
  CONTRADICTION_KEY_UNKNOWN: {
    check: 'C-60.1',
    where: 'src/contradiction/index.mjs pairs > is-contradiction-key-unknown',
    translation: word('refusal.CONTRADICTION_KEY_UNKNOWN'),
  },
  /* N345 (DEC-76, DEC-77, DEC-84): the reads that show a candidate (R25) and the marks on a side (R27). */
  CANDIDATES_NO_SUBJECT: {
    check: 'C-60.2',
    where: 'src/contradiction/index.mjs candidatesFor > is-candidates-no-subject',
    translation: word('refusal.CANDIDATES_NO_SUBJECT'),
  },
  TENSIONS_TOO_MANY: {
    check: 'C-60.3',
    where: 'src/contradiction/index.mjs tensionsOn > is-tensions-too-many',
    translation: word('refusal.TENSIONS_TOO_MANY'),
  },
};

/* REC-147 / C-93 — THE CONTRADICTION CANDIDATE'S REFUSALS (`CONTRADICTION-IDENTIFY-DESIGN.md` section 5,
 * section 8, section 9 item 3). op=contradictionpropose is the ONE door a run's judgement enters the record by, and
 * every refusal here is asked of the WHOLE batch before anything is written, so a refused batch leaves nothing.
 *
 * WHY THE PAIR IS CHECKED AGAINST THE PAIRING AND NOT TAKEN FROM THE CALLER: a candidate says the record put these
 * two side by side for this key. A pair a caller can hand us is a provenance hop a caller can invent (the old
 * `CLAUDE.md` section 5, archived at `docs/archive/CLAUDE-2026-09-26-old-process.md`), so the plane re-forms the
 * pairs for THIS viewer and writes only a proposal naming one of them, with
 * the referents and versions the PLANE read, never the ones the body sent. The run's principal is REC-152's gate,
 * relayed with its own code, and is not restated here. */
export const CONTRADICTION_CANDIDATE_CHECKS = {
  CANDIDATE_NO_PROPOSER: {
    check: 'C-93.1',
    where: 'src/contradiction/index.mjs #runRefusals > is-candidate-no-proposer',
    translation: word('refusal.CANDIDATE_NO_PROPOSER'),
  },
  CANDIDATE_NO_RUN: {
    check: 'C-93.2',
    where: 'src/contradiction/index.mjs #runRefusals > is-candidate-no-run',
    translation: word('refusal.CANDIDATE_NO_RUN'),
  },
  CANDIDATE_RUN_NOT_RUNNING: {
    check: 'C-93.3',
    where: 'src/contradiction/index.mjs #runRefusals > is-candidate-run-not-running',
    translation: word('refusal.CANDIDATE_RUN_NOT_RUNNING'),
  },
  CANDIDATE_NO_PROPOSALS: {
    check: 'C-93.4',
    where: 'src/contradiction/index.mjs propose > is-candidate-no-proposals',
    translation: word('refusal.CANDIDATE_NO_PROPOSALS'),
  },
  CANDIDATE_LABEL_UNKNOWN: {
    check: 'C-93.5',
    where: 'src/contradiction/index.mjs propose > is-candidate-label-unknown',
    translation: word('refusal.CANDIDATE_LABEL_UNKNOWN'),
  },
  CANDIDATE_NO_REASON: {
    check: 'C-93.6',
    where: 'src/contradiction/index.mjs propose > is-candidate-no-reason',
    translation: word('refusal.CANDIDATE_NO_REASON'),
  },
  CANDIDATE_PAIR_NOT_FORMED: {
    check: 'C-93.7',
    where: 'src/contradiction/index.mjs propose > is-candidate-pair-not-formed',
    translation: word('refusal.CANDIDATE_PAIR_NOT_FORMED'),
  },
  /* N345 (DEC-76, DEC-77, DEC-84, DEC-85 as K456 clarified it): a member's acts on a candidate (R30–R36), the
     machine's one act (R37), the promotion check (R38), and the conflict between projects (R49–R54). `act` names the
     refusals common to every act (R30). */
  NO_CANDIDATE: {
    check: 'C-93.8',
    where: 'src/contradiction/index.mjs #noCandidate > is-no-candidate',
    translation: word('refusal.NO_CANDIDATE'),
  },
  NO_SUCH_CANDIDATE: {
    check: 'C-93.9',
    where: 'src/contradiction/index.mjs #noSuch > is-no-such-candidate',
    translation: word('refusal.NO_SUCH_CANDIDATE'),
  },
  MACHINE_CANNOT_ACT_ON_CANDIDATE: {
    check: 'C-93.10',
    where: 'src/contradiction/index.mjs #machineRefusal > is-machine-cannot-act-on-candidate',
    translation: word('refusal.MACHINE_CANNOT_ACT_ON_CANDIDATE'),
  },
  CANDIDATE_CLOSED: {
    check: 'C-93.11',
    where: 'src/contradiction/index.mjs #closed > is-candidate-closed',
    translation: word('refusal.CANDIDATE_CLOSED'),
  },
  CANDIDATE_TAKEN_UP: {
    check: 'C-93.12',
    where: 'src/contradiction/index.mjs #closed > is-candidate-taken-up',
    translation: word('refusal.CANDIDATE_TAKEN_UP'),
  },
  RECORD_CANNOT_BE_DISMISSED: {
    check: 'C-93.13',
    where: 'src/contradiction/index.mjs dismiss > is-record-cannot-be-dismissed',
    translation: word('refusal.RECORD_CANNOT_BE_DISMISSED'),
  },
  DISMISSAL_REASON_UNKNOWN: {
    check: 'C-93.14',
    where: 'src/contradiction/index.mjs dismiss > is-dismissal-reason-unknown',
    translation: word('refusal.DISMISSAL_REASON_UNKNOWN'),
  },
  CLARIFY_NOT_A_TENSION: {
    check: 'C-93.15',
    where: 'src/contradiction/index.mjs clarify > is-clarify-not-a-tension',
    translation: word('refusal.CLARIFY_NOT_A_TENSION'),
  },
  CLARIFY_CHOICE_UNKNOWN: {
    check: 'C-93.16',
    where: 'src/contradiction/index.mjs clarify > is-clarify-choice-unknown',
    translation: word('refusal.CLARIFY_CHOICE_UNKNOWN'),
  },
  CLARIFY_COORDINATE_UNKNOWN: {
    check: 'C-93.17',
    where: 'src/contradiction/index.mjs clarify > is-clarify-coordinate-unknown',
    translation: word('refusal.CLARIFY_COORDINATE_UNKNOWN'),
  },
  CLARIFY_NO_EXPLANATION: {
    check: 'C-93.18',
    where: 'src/contradiction/index.mjs clarify > is-clarify-no-explanation',
    translation: word('refusal.CLARIFY_NO_EXPLANATION'),
  },
  EVIDENCE_NOT_SEEN: {
    check: 'C-93.19',
    where: 'src/contradiction/index.mjs #evidenceRefusal > is-evidence-not-seen',
    translation: word('refusal.EVIDENCE_NOT_SEEN'),
  },
  WRONG_SIDE_UNNAMED: {
    check: 'C-93.20',
    where: 'src/contradiction/index.mjs clarify > is-wrong-side-unnamed',
    translation: word('refusal.WRONG_SIDE_UNNAMED'),
  },
  WRONG_SIDE_NO_REASON: {
    check: 'C-93.21',
    where: 'src/contradiction/index.mjs clarify > is-wrong-side-no-reason',
    translation: word('refusal.WRONG_SIDE_NO_REASON'),
  },
  PLURALITY_HAS_NO_WRONG_SIDE: {
    check: 'C-93.22',
    where: 'src/contradiction/index.mjs #noWrongSide > is-plurality-has-no-wrong-side',
    translation: word('refusal.PLURALITY_HAS_NO_WRONG_SIDE'),
  },
  TAKE_UP_NO_QUESTION: {
    check: 'C-93.23',
    where: 'src/contradiction/index.mjs takeUp > is-take-up-no-question',
    translation: word('refusal.TAKE_UP_NO_QUESTION'),
  },
  TAKE_UP_NO_FRAME: {
    check: 'C-93.24',
    where: 'src/contradiction/index.mjs takeUp > is-take-up-no-frame',
    translation: word('refusal.TAKE_UP_NO_FRAME'),
  },
  ACCEPTANCE_NOT_STANDING: {
    check: 'C-93.25',
    where: 'src/contradiction/index.mjs #acceptanceRefusal > is-acceptance-not-standing',
    translation: word('refusal.ACCEPTANCE_NOT_STANDING'),
  },
  ACCEPTANCE_VALUE_DIFFERS: {
    check: 'C-93.26',
    where: 'src/contradiction/index.mjs #acceptanceRefusal > is-acceptance-value-differs',
    translation: word('refusal.ACCEPTANCE_VALUE_DIFFERS'),
  },
  NOT_A_CONTRADICTION_INQUIRY: {
    check: 'C-93.27',
    where: 'src/contradiction/index.mjs #notContradictionInquiry > is-not-a-contradiction-inquiry',
    translation: word('refusal.NOT_A_CONTRADICTION_INQUIRY'),
  },
  RECOMMEND_NO_COORDINATES: {
    check: 'C-93.28',
    where: 'src/contradiction/index.mjs recommend > is-recommend-no-coordinates',
    translation: word('refusal.RECOMMEND_NO_COORDINATES'),
  },
  RECOMMEND_COORDINATE_UNKNOWN: {
    check: 'C-93.29',
    where: 'src/contradiction/index.mjs recommend > is-recommend-coordinate-unknown',
    translation: word('refusal.RECOMMEND_COORDINATE_UNKNOWN'),
  },
  RECOMMEND_NO_REASON: {
    check: 'C-93.30',
    where: 'src/contradiction/index.mjs recommend > is-recommend-no-reason',
    translation: word('refusal.RECOMMEND_NO_REASON'),
  },
  RECOMMEND_CANDIDATE_NOT_STANDING: {
    check: 'C-93.31',
    where: 'src/contradiction/index.mjs recommend > is-recommend-candidate-not-standing',
    translation: word('refusal.RECOMMEND_CANDIDATE_NOT_STANDING'),
  },
  CANDIDATE_NOT_HELD: {
    check: 'C-93.32',
    where: 'src/contradiction/index.mjs #notHeld > is-candidate-not-held',
    translation: word('refusal.CANDIDATE_NOT_HELD'),
  },
  WORDS_MALFORMED: {
    check: 'C-93.33',
    where: 'src/contradiction/index.mjs #overCap > is-words-malformed',
    translation: word('refusal.WORDS_MALFORMED'),
  },
  NOT_A_PARTY: {
    check: 'C-93.34',
    where: 'src/contradiction/index.mjs #partyRefusal > is-not-a-party',
    translation: word('refusal.NOT_A_PARTY'),
  },
  NOT_A_PROJECT_CONFLICT: {
    check: 'C-93.35',
    where: 'src/contradiction/index.mjs #partyRefusal > is-not-a-project-conflict',
    translation: word('refusal.NOT_A_PROJECT_CONFLICT'),
  },
  RESPONSE_BEFORE_OPT_IN: {
    check: 'C-93.36',
    where: 'src/contradiction/index.mjs respond > is-response-before-opt-in',
    translation: word('refusal.RESPONSE_BEFORE_OPT_IN'),
  },
  RESPONSE_NO_TEXT: {
    check: 'C-93.37',
    where: 'src/contradiction/index.mjs respond > is-response-no-text',
    translation: word('refusal.RESPONSE_NO_TEXT'),
  },
  DISCLOSURE_MALFORMED: {
    check: 'C-93.38',
    where: 'src/contradiction/index.mjs #disclosureRefusal > is-disclosure-malformed',
    translation: localize('contradiction.checks.disclosure_malformed', 'What a response shares about you is your cover, an email address, or neither, and nothing else. The address must be one address. The part that is not one of these is named. Nothing was written.'),
  },
  DISCLOSURE_NOT_YOURS: {
    check: 'C-93.39',
    where: 'src/contradiction/index.mjs #disclosureRefusal > is-disclosure-not-yours',
    translation: word('refusal.DISCLOSURE_NOT_YOURS'),
  },
  /* R61 (T51 fix round 2; UC-155; DEC-394 (3e)): a member flags two documents as contradicting. */
  FLAG_NO_PASSAGE: {
    check: 'C-93.40',
    where: 'src/contradiction/index.mjs #flagPassage > is-flag-no-passage',
    translation: localize('contradiction.checks.flag_no_passage', 'Setting two documents side by side as a contradiction names a passage in each, as a document and the part of it. One of them is missing, is not held here, or is not one you can see; which of the two is named. Nothing was written.'),
  },
  FLAG_SAME_DOCUMENT: {
    check: 'C-93.41',
    where: 'src/contradiction/index.mjs flag > is-flag-same-document',
    translation: localize('contradiction.checks.flag_same_document', 'A contradiction is between two documents, and both passages are in the same one. Name a passage in a different document. Nothing was written.'),
  },
  FLAG_NO_REASON: {
    check: 'C-93.42',
    where: 'src/contradiction/index.mjs flag > is-flag-no-reason',
    translation: localize('contradiction.checks.flag_no_reason', 'Saying two documents contradict is a kept decision, and a kept decision says why. Give the reason in your own words. Nothing was written.'),
  },
};
