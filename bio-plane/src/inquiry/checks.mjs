/* inquiry's own rows (R38, R50; N345, DEC-49; K343's pattern in the C-2 family): C-2.11–C-2.18, the contradiction
 * inquiry's grammar arm (R47) and its one-candidate rule (R11), and C-66.5, the carried-forward `surfaced_by` (R50).
 * C-2.1–C-2.7, C-2.9 and C-2.10 are their owners', not the catalogue's; the rows the inquiry's grammar raises
 * (C-2.8, C-6.1, C-54.1) and its acts mint (C-33.13, C-33.22, C-33.23, C-32.7, C-32.8) are `inquiry-grammar`'s, read at
 * `./grammar.mjs`. Each row here is an invariant of this module with its test (`test/m/inquiry/contradiction.test.mjs`,
 * `surfaced.test.mjs`); promotion stamps them. */

import { word } from "../setup-words/index.mjs";

/* N345 (`BIO_Case_Making_v0_1.md` §CONTRADICTION, DEC-76 items 1–3, DEC-84 item 3). A contradiction candidate taken up
 * becomes an inquiry that names it (`contradiction: {candidate}`), and when concluded says what the conflict turned out
 * to be (`resolution`). The rows are judged at every promotion of an inquiry, which is every door that writes one
 * (take-up, resolve, `basis-versions`' `conclude`, a member's own edit), so no door concludes a contradiction inquiry
 * without its kind. */
export const INQUIRY_CONTRADICTION_CHECKS = {
  CONTRADICTION_LINK_MALFORMED: {
    check: 'C-2.11',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-contradiction-link',
    translation: word("refusal.CONTRADICTION_LINK_MALFORMED"),
  },
  RESOLUTION_WITHOUT_CONTRADICTION: {
    check: 'C-2.12',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-resolution-placed',
    translation: word("refusal.RESOLUTION_WITHOUT_CONTRADICTION"),
  },
  RESOLUTION_MISSING: {
    check: 'C-2.13',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-resolution-present',
    translation: word("refusal.RESOLUTION_MISSING"),
  },
  RESOLUTION_KIND_UNKNOWN: {
    check: 'C-2.14',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-resolution-kind',
    translation: word("refusal.RESOLUTION_KIND_UNKNOWN"),
  },
  RESOLUTION_INCOMPLETE: {
    check: 'C-2.15',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-resolution-complete',
    translation: word("refusal.RESOLUTION_INCOMPLETE"),
  },
  EXPLORES_MALFORMED: {
    check: 'C-2.16',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-explores-shape',
    translation: word("refusal.EXPLORES_MALFORMED"),
  },
  CANDIDATE_ALREADY_TAKEN_UP: {
    check: 'C-2.17',
    where: 'src/inquiry/index.mjs check > is-candidate-taken-up',
    translation: word("refusal.CANDIDATE_ALREADY_TAKEN_UP"),
  },
  /* N369 (proposed in INQUIRY #5 J1; stamped 1.47.0, T17): the arm's own failure, which C-2.11's words are not true of. */
  CONTRADICTION_ARM_FAILED: {
    check: 'C-2.18',
    where: 'src/inquiry/contradiction.mjs contradictionFindings > is-contradiction-arm-judged',
    translation: word("refusal.CONTRADICTION_ARM_FAILED"),
  },
};

/* REC-179 / C-66.5 (INVESTIGATIVE-SESSION.md §11 item 5, "Rule 2's reach", BOB #30; D-78's stated intent that a revision
 * carries the value forward), moved here from the catalogue's `SURFACE_CHECKS` with its number and translation unchanged
 * (T19 layer 6, R50); its `where` names this module's site, stamped 1.50.0 (K884). `surfaced_by` records the SURFACING
 * ACT, and that act happens once, at the creation, decided there by the server (D-78's restamp, or REC-173's verified
 * replay). Measured before this existed (`0e7cc03e`): the restamp runs only on a creation and nothing compared a
 * revision's value with the current version's, so a revision relabelled an assistant's question `human` (or a member's
 * `agent`) and landed, and the surfacing row then contradicted the bytes it describes. Asked inside the promotion's
 * transaction after the compare-and-swap (the current version is then the one the revision is based on) and before any
 * write. The comparison is of the value the record's parser reads out of each version's `bundle.md`, so a respelling of
 * the same value lands, and an unreadable or absent value is a value: a revision may not supply an origin its creation
 * did not record, nor drop one it did. */
export const INQUIRY_SURFACE_CHECKS = {
  SURFACED_BY_REWRITTEN: {
    check: 'C-66.5',
    where: 'src/inquiry/index.mjs check > is-promote-surfaced-by, reached from op=promote through the step inquiry registers with promotion (K31)',
    translation: word("refusal.SURFACED_BY_REWRITTEN"),
  },
};

/* R61 (T41; D59; inquiry-grammar R18's store-side share; K2448, K2472): a leg's `bias_applied` statement that is not in
 * the lens in force for the inquiry's project (or the instance), asked of `bias.statementInForce` (its R49) at the act
 * that records it. The next free number of this module's C-2 family (C-2.18 the last held at the job's START); the
 * translation is BOB's draft until `words.json` holds a key for it, and the row awaits T41's stamp. Minted at one site,
 * `biasNotInForce`, which `basis-versions` R48 and `case-disclosures` R31 answer through (K231). */
export const INQUIRY_BIAS_CHECKS = {
  BIAS_APPLICATION_NOT_IN_FORCE: {
    check: 'C-2.19',
    where: 'src/inquiry/index.mjs biasNotInForce > is-bias-application-in-force, reached from check > is-bias-applied',
    translation: word("refusal.BIAS_APPLICATION_NOT_IN_FORCE"),
  },
};

/* R62 (T42; N834; run-productions R22, R25; K2496, K231): a machine-passage read registered with `onMachinePassage` that
 * throws or answers anything but null or a refusal, so whether a leg may stand as the member's own is not known: the
 * promotion is refused, never passed (fail closed). The next free number of this module's C-2 family (C-2.19 the last
 * held at the job's START); the translation is BOB's draft until `words.json` holds a key for it, and the row awaits
 * T42's stamp. Minted at one site, `machinePassageUnchecked`, which `basis-versions` R49 answers through (K231). */
export const INQUIRY_PASSAGE_CHECKS = {
  MACHINE_PASSAGE_UNCHECKED: {
    check: 'C-2.20',
    where: 'src/inquiry/index.mjs machinePassageUnchecked > is-machine-passage-checked, reached from check > is-machine-passage-taken-up',
    translation: word("refusal.MACHINE_PASSAGE_UNCHECKED"),
  },
};

/* R39 (T41; DEC-188 (7)): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`) this module's
 * refusals read by key, each `en` verbatim; the UX stream re-words them there (its `question.refused.drawnon` replaced
 * BOB's drafted words). */
export const QUESTION_WORDS = Object.freeze({
  'question.refused.drawnon': word('question.refused.drawnon'),
});

/* R59 (T41; D13; K2479, K2480): the warning a promotion of a question carries when its question or named entities name a
 * person in no public role. A warning, never a refusal, so it takes no check number. Its words are BOB's draft
 * (INQUIRY #16 J1, K2480) until `words.json` holds the key, then read from there by key; `{persons}` is left for the
 * screen to fill with the persons the warning names. */
export const INQUIRY_WARNINGS = Object.freeze({
  PERSON_IN_NO_PUBLIC_ROLE: Object.freeze({
    key: 'question.warning.person',
    translation: word('refusal.PERSON_IN_NO_PUBLIC_ROLE', { persons: '{persons}' }),
  }),
});
