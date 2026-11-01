/* standards' refusal rows (requirements: `build/requirements/standards.md`). DEC-49: every refusal this module answers
 * carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act is
 * reached. A new module with nothing moved (its map, §1): the rows are its own family, C-112 (K174: a module holds its
 * new family; C-112 assigned by BOB, K248). R5's read naming no standard is refused `STANDARD_NO_ID` through its row,
 * C-112.11, never codeless (N269, D-495): standards' own condition, so its own code (K275), not the generic `NO_ID`
 * other modules mint for their own subjects. C-112.20 (`STANDARD_NO_REASON`, R1 and R10; DEC-88, K1025) was minted in T22
 * and stamped by 1.53.0, as was C-112.17's re-wording (the record now holds the declarer's reason). No translation
 * names a place (R13, `layers.md` rule 1), and none speaks of a standard's merit (R12). Since T46 (R55), a row whose code
 * `words.json` holds as `refusal.<CODE>` reads its translation from there by key (`REFUSAL_WORDS`). */

import { word, localize } from "../setup-words/index.mjs";

const at = (fn, region, file = "index.mjs") => `src/standards/${file} ${fn} > ${region}`;

/* R55 (T46; DEC-194, N913), N1132 (T50): the refusal words this module answers, read by key through `setup-words`' `word`
   (`words.json`'s `refusal.<CODE>`, as `membership`'s `HANDLE_WORDS` and `extraction`'s `TRANSCRIBE_WORDS` are); a row's
   `translation` is the word itself, never a copy of the sentence. Only the codes the list holds as `refusal.<CODE>` are
   here: every other row keeps its own translation. */
export const REFUSAL_WORDS = Object.freeze(Object.fromEntries(
  ["refusal.COMMITMENT_AS_HEARD", "refusal.COMMITMENT_OWN_LETTER"].map((key) => [key, word(key)])));

export const STANDARDS_CHECKS = Object.freeze({
  MACHINE_CANNOT_DECLARE_STANDARD: {
    check: 'C-112.1', where: at("machineRefusal", "is-standard-member"),
    translation: word('refusal.MACHINE_CANNOT_DECLARE_STANDARD'),
  },
  STANDARD_NO_CITE: {
    check: 'C-112.2', where: at("refuseNoCite", "is-standard-cited"),
    translation: word('refusal.STANDARD_NO_CITE'),
  },
  STANDARD_KIND_UNKNOWN: {
    check: 'C-112.3', where: at("refuseKindUnknown", "is-standard-kind"),
    translation: word('refusal.STANDARD_KIND_UNKNOWN'),
  },
  STANDARD_NO_ISSUER: {
    check: 'C-112.4', where: at("#declareRefusal", "is-standard-issuer"),
    translation: word('refusal.STANDARD_NO_ISSUER'),
  },
  STANDARD_NO_TEXT: {
    check: 'C-112.5', where: at("#declareRefusal", "is-standard-text"),
    translation: word('refusal.STANDARD_NO_TEXT'),
  },
  STANDARD_TEXT_UNRESOLVED: {
    check: 'C-112.6', where: at("refuseTextUnresolved", "is-standard-text-held"),
    translation: word('refusal.STANDARD_TEXT_UNRESOLVED'),
  },
  STANDARD_PERIOD_INVALID: {
    check: 'C-112.7', where: at("#declareRefusal", "is-standard-period"),
    translation: word('refusal.STANDARD_PERIOD_INVALID'),
  },
  STANDARD_SUPERSEDES_UNKNOWN: {
    check: 'C-112.8', where: at("#declareRefusal", "is-superseded-held"),
    translation: word('refusal.STANDARD_SUPERSEDES_UNKNOWN'),
  },
  STANDARD_ALREADY_SUPERSEDED: {
    check: 'C-112.9', where: at("#declareRefusal", "is-supersession-once"),
    translation: word('refusal.STANDARD_ALREADY_SUPERSEDED'),
  },
  NO_SUCH_STANDARD: {
    check: 'C-112.10', where: at("noSuchStandard", "is-standard-held"),
    translation: word('refusal.NO_SUCH_STANDARD'),
  },
  STANDARD_NO_ID: {
    check: 'C-112.11', where: at("refuseNoId", "is-standard-named"),
    translation: word('refusal.STANDARD_NO_ID'),
  },
  STANDARD_DATE_INVALID: {
    check: 'C-112.12', where: at("refuseDateInvalid", "is-date-readable"),
    translation: word('refusal.STANDARD_DATE_INVALID'),
  },
  STANDARD_WHY_INVALID: {
    check: 'C-112.13', where: at("standardPropose", "is-proposal-why"),
    translation: word('refusal.STANDARD_WHY_INVALID'),
  },
  STANDARD_PROPOSER_UNNAMED: {
    check: 'C-112.14', where: at("standardPropose", "is-proposer-named"),
    translation: word('refusal.STANDARD_PROPOSER_UNNAMED'),
  },
  STANDARD_NO_SUCH_PROPOSAL: {
    check: 'C-112.15', where: at("standardAdopt", "is-proposal-held"),
    translation: word('refusal.STANDARD_NO_SUCH_PROPOSAL'),
  },
  STANDARD_PROPOSAL_ADOPTED: {
    check: 'C-112.16', where: at("#adoptRefusal", "is-proposal-open"),
    translation: word('refusal.STANDARD_PROPOSAL_ADOPTED'),
  },
  STANDARD_FIELD_UNKNOWN: {
    check: 'C-112.17', where: at("refuseFieldUnknown", "is-standard-field"),
    translation: word('refusal.STANDARD_FIELD_UNKNOWN'),
  },
  STANDARD_WRITTEN_ELSEWHERE: {
    check: 'C-112.18', where: at("#checkStandard", "is-standard-written-here"),
    translation: word('refusal.STANDARD_WRITTEN_ELSEWHERE'),
  },
  STANDARD_ACT_INVALID: {
    check: 'C-112.19', where: at("standardPropose", "is-proposal-act"),
    translation: word('refusal.STANDARD_ACT_INVALID'),
  },
  STANDARD_NO_REASON: {
    check: 'C-112.20', where: at("#declareRefusal", "is-standard-reason"),
    translation: word('refusal.STANDARD_NO_REASON'),
  },
  /* T33-31 (R18–R27; K1438, K1442, K1446, K1447, K1449): rows minted in T33, awaiting promotion's stamp (T34). */
  STANDARD_FIELD_INVALID: {
    check: 'C-112.21', where: at("refuseFieldInvalid", "is-standard-law-field"),
    translation: word('refusal.STANDARD_FIELD_INVALID'),
  },
  STANDARD_PORTION_NOT_IN_TEXT: {
    check: 'C-112.22', where: at("#lawFields", "is-portion-in-text"),
    translation: word('refusal.STANDARD_PORTION_NOT_IN_TEXT'),
  },
  PORTION_UNKNOWN: {
    check: 'C-112.25', where: at("portionUnknown", "is-portion-held"),
    translation: word('refusal.PORTION_UNKNOWN'),
  },
  /* T35-31 (R1, R33–R47; K1713, K1722–K1724, K1739, K1740; DEC-145): rows minted in T35, awaiting promotion's stamp
     (T36). C-112.53 is left for `law-relations`' LAW_RELATION_NO_EDITION (its R9). */
  STANDARD_TEXT_NOT_HELD_AS: {
    check: 'C-112.33', where: at("#heldFields", "is-held-text"),
    translation: word('refusal.STANDARD_TEXT_NOT_HELD_AS'),
  },
  FAMILY_UNKNOWN: {
    check: 'C-112.34', where: at("#familyField", "is-family-known"),
    translation: word('refusal.FAMILY_UNKNOWN'),
  },
  STANDARD_CITED_BY_MISSING: {
    check: 'C-112.35', where: at("#heldFields", "is-cited-by-held"),
    translation: word('refusal.STANDARD_CITED_BY_MISSING'),
  },
  STANDARD_SEARCH_MISSING: {
    check: 'C-112.36', where: at("#heldFields", "is-search-stated"),
    translation: word('refusal.STANDARD_SEARCH_MISSING'),
  },
  FORCE_UNKNOWN: {
    check: 'C-112.37', where: at("#forceRefusal", "is-force-known"),
    translation: word('refusal.FORCE_UNKNOWN'),
  },
  FORCE_NO_HOLDER: {
    check: 'C-112.38', where: at("#forceRefusal", "is-force-holder"),
    translation: word('refusal.FORCE_NO_HOLDER'),
  },
  FORCE_NO_CRITERIA: {
    check: 'C-112.39', where: at("#forceRefusal", "is-force-criteria"),
    translation: word('refusal.FORCE_NO_CRITERIA'),
  },
  FORCE_NO_CITATION: {
    check: 'C-112.40', where: at("#forceRefusal", "is-force-cited"),
    translation: word('refusal.FORCE_NO_CITATION'),
  },
  FORCE_TEXT_NOT_HELD: {
    check: 'C-112.41', where: at("refuseTextNotHeld", "is-force-text-held"),
    translation: word('refusal.FORCE_TEXT_NOT_HELD'),
  },
  FORCE_ALREADY_CONFIRMED: {
    check: 'C-112.42', where: at("#forceRefusal", "is-force-once"),
    translation: word('refusal.FORCE_ALREADY_CONFIRMED'),
  },
  COPY_UNKNOWN: {
    check: 'C-112.43', where: at("#copyFields", "is-copy-known"),
    translation: word('refusal.COPY_UNKNOWN'),
  },
  COPY_CLAIM_NOT_CITED: {
    check: 'C-112.44', where: at("#copyFields", "is-copy-claim-cited"),
    translation: word('refusal.COPY_CLAIM_NOT_CITED'),
  },
  RELEASE_NOT_OWNER: {
    check: 'C-112.45', where: at("releaseStandard", "is-release-owner"),
    translation: word('refusal.RELEASE_NOT_OWNER'),
  },
  NOT_HELD_FROM_SOURCE: {
    check: 'C-112.46', where: at("releaseStandard", "is-held-from-source"),
    translation: word('refusal.NOT_HELD_FROM_SOURCE'),
  },
  VERSION_BASIS_INVALID: {
    check: 'C-112.47', where: at("#versionFields", "is-version-basis"),
    translation: word('refusal.VERSION_BASIS_INVALID'),
  },
  OVERRIDE_INVALID: {
    check: 'C-112.48', where: at("#versionFields", "is-override-form"),
    translation: word('refusal.OVERRIDE_INVALID'),
  },
  FORCE_SOURCE_INVALID: {
    check: 'C-112.49', where: at("#versionFields", "is-force-source"),
    translation: word('refusal.FORCE_SOURCE_INVALID'),
  },
  ADOPTION_MODE_UNKNOWN: {
    check: 'C-112.50', where: at("adoptionRecord", "is-adoption-mode"),
    translation: word('refusal.ADOPTION_MODE_UNKNOWN'),
  },
  ADOPTION_NO_EDITION: {
    check: 'C-112.51', where: at("adoptionRecord", "is-adoption-edition"),
    translation: word('refusal.ADOPTION_NO_EDITION'),
  },
  ADOPTION_NO_CITATION: {
    check: 'C-112.52', where: at("adoptionRecord", "is-adoption-cited"),
    translation: word('refusal.ADOPTION_NO_CITATION'),
  },
  ACCESS_UNKNOWN: {
    check: 'C-112.54', where: at("#accessFields", "is-access-known"),
    translation: word('refusal.ACCESS_UNKNOWN'),
  },
  TEXT_NOT_MEMBER_CAPTURED: {
    check: 'C-112.55', where: at("#accessFields", "is-text-member-captured"),
    translation: word('refusal.TEXT_NOT_MEMBER_CAPTURED'),
  },
  TARGET_INVALID: {
    check: 'C-112.56', where: at("#targetField", "is-target-form"),
    translation: word('refusal.TARGET_INVALID'),
  },
  QUESTION_NOT_HELD: {
    check: 'C-112.57', where: at("#questionField", "is-question-held"),
    translation: word('refusal.QUESTION_NOT_HELD'),
  },
  NO_SUCH_FORCE: {
    check: 'C-112.58', where: at("forceWithdraw", "is-force-held"),
    translation: word('refusal.NO_SUCH_FORCE'),
  },
  /* T36-15 (R50; N736, K2021, K2092): rows minted in T36, awaiting promotion's stamp (T37). */
  THROUGH_INVALID: {
    check: 'C-112.59', where: at("inForceThroughRecord", "is-through-date"),
    translation: word('refusal.THROUGH_INVALID'),
  },
  THROUGH_NO_SOURCE: {
    check: 'C-112.60', where: at("inForceThroughRecord", "is-through-sourced"),
    translation: word('refusal.THROUGH_NO_SOURCE'),
  },
  THROUGH_AFTER_CHECK: {
    check: 'C-112.61', where: at("inForceThroughRecord", "is-through-checked"),
    translation: word('refusal.THROUGH_AFTER_CHECK'),
  },
  NO_SUCH_RECORD: {
    check: 'C-112.62', where: at("inForceThroughWithdraw", "is-through-record-held"),
    translation: word('refusal.NO_SUCH_RECORD'),
  },
  /* T45-7 (R52, R53; Actions D7; v0.2 §3 Standard): rows minted in T45. T46-10 (R55; DEC-194, N913): their translations
     are `words.json`'s `refusal.<CODE>`, read by key (`REFUSAL_WORDS` above), never a copy; awaiting T47's stamp. */
  COMMITMENT_AS_HEARD: {
    check: 'C-112.63', where: at("#commitmentRefusal", "is-commitment-confirmed"),
    translation: REFUSAL_WORDS['refusal.COMMITMENT_AS_HEARD'],
  },
  COMMITMENT_OWN_LETTER: {
    check: 'C-112.64', where: at("#commitmentRefusal", "is-commitment-not-own-letter"),
    translation: REFUSAL_WORDS['refusal.COMMITMENT_OWN_LETTER'],
  },
  /* T53 (R65; N1260, DEC-447): `standardsBinding`'s page size outside 1 to 200, the code BOB named; awaiting its stamp. */
  STANDARD_LIMIT_INVALID: {
    check: 'C-112.65', where: at("standardsBinding", "is-binding-limit"),
    translation: localize('refusal.STANDARD_LIMIT_INVALID', "A page of the standards that bind a body holds 1 to 200 records."),
  },
});

/** A refusal carrying its row: its reason, code, check id and translation. Called with the code as a literal at each
 *  site, so the DEC-49 guard reads which code a marked region mints. */
export function refusal(code, detail, extra) {
  const row = STANDARDS_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}
