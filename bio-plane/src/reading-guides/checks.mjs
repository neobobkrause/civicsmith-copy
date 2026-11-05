/* reading-guides' refusal rows (requirements: `build/requirements/reading-guides.md` R11, R14). DEC-49: every refusal this
 * module answers carries its code, its row and the member's translation. A new module with nothing moved: its rows are
 * a new family, C-144 (K2480, K2482: T41's new families steps C-142, ai-use C-143, reading-guides C-144,
 * question-explorer C-145, investigation C-146), each awaiting promotion's stamp (K231; T41 rule 4 item 2). No
 * translation names a place (R11, `layers.md` rule 1). The registrations' own refusals (`PROVIDER_DECLARED`,
 * `PROVIDER_MALFORMED`) are a starting module's errors and carry no row, as `public-read` R18's and `connections` R5's
 * do. This file imports nothing. */

import { word, localize } from "../setup-words/index.mjs";

const at = (file, fn, region) => `src/reading-guides/${file} ${fn} > ${region}`;

/* T46 (R14; DEC-194, N913), extended T50 (T50-42; N1132): the words of `words.json`
   (`docs/development/ux-substrate/screens/words.json`) this module answers, each `en` verbatim, read by key, as
   membership's `HANDLE_WORDS` and extraction's `TRANSCRIBE_WORDS` are: every refusal row (`refusal.<CODE>`) and the
   procedure guide's label (R13's `guide.procedure.legalinfo`, protected). The design stream's words are re-worded
   there, then re-taken here by key; a row never holds a copy of its sentence. `words.json` holds every row of this
   module, so each row reads its key. */
export const READING_GUIDES_WORDS = Object.freeze({
  "refusal.GUIDE_CARRIES_CONDUCT": word("refusal.GUIDE_CARRIES_CONDUCT"),
  "refusal.GUIDE_ITEMS_REFUSED": word("refusal.GUIDE_ITEMS_REFUSED"),
  "refusal.GUIDE_MEMBER_ACT": word("refusal.GUIDE_MEMBER_ACT"),
  "refusal.GUIDE_KIND_UNKNOWN": word("refusal.GUIDE_KIND_UNKNOWN"),
  "refusal.NO_SUCH_GUIDE": word("refusal.NO_SUCH_GUIDE"),
  "refusal.GUIDE_READ_ONLY": word("refusal.GUIDE_READ_ONLY"),
  "refusal.GUIDE_REVIEW_BY_AUTHOR": word("refusal.GUIDE_REVIEW_BY_AUTHOR"),
  "refusal.GUIDE_VERDICT_UNKNOWN": word("refusal.GUIDE_VERDICT_UNKNOWN"),
  "refusal.GUIDE_REASON_MISSING": word("refusal.GUIDE_REASON_MISSING"),
  "refusal.GUIDE_NOT_REVIEWABLE": word("refusal.GUIDE_NOT_REVIEWABLE"),
  "refusal.GUIDE_NOT_OFFERABLE": word("refusal.GUIDE_NOT_OFFERABLE"),
  "refusal.GUIDE_OFFER_UNREADABLE": word("refusal.GUIDE_OFFER_UNREADABLE"),
  "refusal.GUIDE_NO_GROUP_SLUG": word("refusal.GUIDE_NO_GROUP_SLUG"),
  "refusal.GUIDE_RETIRE_NOT_APPROVER": word("refusal.GUIDE_RETIRE_NOT_APPROVER"),
  "refusal.GUIDE_RETIRED": word("refusal.GUIDE_RETIRED"),
  "refusal.GUIDE_BASED_ON_UNKNOWN": word("refusal.GUIDE_BASED_ON_UNKNOWN"),
  "refusal.GUIDE_PROPOSAL_NOT_MACHINE": word("refusal.GUIDE_PROPOSAL_NOT_MACHINE"),
  "refusal.GUIDE_RUN_MISSING": word("refusal.GUIDE_RUN_MISSING"),
  "refusal.GUIDE_ITEM_UNSOURCED": word("refusal.GUIDE_ITEM_UNSOURCED"),
  "guide.procedure.legalinfo": word("guide.procedure.legalinfo"),
});

export const READING_GUIDES_CHECKS = Object.freeze({
  GUIDE_CARRIES_CONDUCT: {
    check: "C-144.1", where: at("check.mjs", "checkGuide", "is-guide-look-for"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_CARRIES_CONDUCT"],
  },
  GUIDE_ITEMS_REFUSED: {
    check: "C-144.2", where: at("check.mjs", "checkGuide", "is-guide-shape"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_ITEMS_REFUSED"],
  },
  GUIDE_MEMBER_ACT: {
    check: "C-144.3", where: at("index.mjs", "memberRefusal", "is-guide-member"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_MEMBER_ACT"],
  },
  GUIDE_KIND_UNKNOWN: {
    check: "C-144.4", where: at("index.mjs", "kindRefusal", "is-guide-kind"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_KIND_UNKNOWN"],
  },
  NO_SUCH_GUIDE: {
    check: "C-144.5", where: at("index.mjs", "noSuchGuide", "is-guide-held"),
    translation: READING_GUIDES_WORDS["refusal.NO_SUCH_GUIDE"],
  },
  GUIDE_READ_ONLY: {
    check: "C-144.6", where: at("index.mjs", "readOnly", "is-guide-ours"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_READ_ONLY"],
  },
  GUIDE_REVIEW_BY_AUTHOR: {
    check: "C-144.7", where: at("index.mjs", "guideReview", "is-guide-reviewer"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_REVIEW_BY_AUTHOR"],
  },
  GUIDE_VERDICT_UNKNOWN: {
    check: "C-144.8", where: at("index.mjs", "guideReview", "is-guide-verdict"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_VERDICT_UNKNOWN"],
  },
  GUIDE_REASON_MISSING: {
    check: "C-144.9", where: at("index.mjs", "reasonRefusal", "is-guide-reason"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_REASON_MISSING"],
  },
  GUIDE_NOT_REVIEWABLE: {
    check: "C-144.10", where: at("index.mjs", "guideReview", "is-guide-reviewable"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_NOT_REVIEWABLE"],
  },
  GUIDE_NOT_OFFERABLE: {
    check: "C-144.11", where: at("index.mjs", "offerable", "is-guide-offerable"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_NOT_OFFERABLE"],
  },
  GUIDE_OFFER_UNREADABLE: {
    check: "C-144.12", where: at("index.mjs", "guideAdopt", "is-guide-offer"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_OFFER_UNREADABLE"],
  },
  GUIDE_NO_GROUP_SLUG: {
    check: "C-144.13", where: at("index.mjs", "slugRefusal", "is-guide-slug"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_NO_GROUP_SLUG"],
  },
  GUIDE_RETIRE_NOT_APPROVER: {
    check: "C-144.14", where: at("index.mjs", "guideRetire", "is-guide-approver"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_RETIRE_NOT_APPROVER"],
  },
  GUIDE_RETIRED: {
    check: "C-144.15", where: at("index.mjs", "retiredRefusal", "is-guide-live"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_RETIRED"],
  },
  GUIDE_BASED_ON_UNKNOWN: {
    check: "C-144.16", where: at("index.mjs", "guideDraft", "is-guide-basis"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_BASED_ON_UNKNOWN"],
  },
  GUIDE_PROPOSAL_NOT_MACHINE: {
    check: "C-144.17", where: at("index.mjs", "guidePropose", "is-guide-machine"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_PROPOSAL_NOT_MACHINE"],
  },
  GUIDE_RUN_MISSING: {
    check: "C-144.18", where: at("index.mjs", "guidePropose", "is-guide-run"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_RUN_MISSING"],
  },
  GUIDE_ITEM_UNSOURCED: {
    check: "C-144.19", where: at("check.mjs", "checkGuide", "is-guide-sourced"),
    translation: READING_GUIDES_WORDS["refusal.GUIDE_ITEM_UNSOURCED"],
  },
  /* T53 (R20; K5508): a sole member's opt-out of review. `words.json` does not hold these two yet, so each row keeps its
     own sentence, written once here at its use (R14: "this module's other rows ... keep theirs"). */
  OPT_OUT_NOT_SOLE_MEMBER: {
    check: "C-144.20", where: at("index.mjs", "guideOptOut", "is-guide-sole-member"),
    translation: localize("refusal.OPT_OUT_NOT_SOLE_MEMBER", "Only the one member of a team may opt out of the review of its guide. Nothing was written."),
  },
  MACHINE_CANNOT_OPT_OUT: {
    check: "C-144.21", where: at("index.mjs", "guideOptOut", "is-guide-person"),
    translation: localize("refusal.MACHINE_CANNOT_OPT_OUT", "A machine cannot opt a guide out of review; a member does. Nothing was written."),
  },
  OPT_OUT_NOT_OWN_GUIDE: {
    check: "C-144.22", where: at("index.mjs", "guideOptOut", "is-guide-team-procedure"),
    translation: localize("refusal.OPT_OUT_NOT_OWN_GUIDE", "Only a team's own procedure guide may be opted out of review. Nothing was written."),
  },
});

/** A refusal carrying its row. Called with the code as a literal at each site, so the DEC-49 guard reads which code a
 *  marked region mints. */
export function refusal(code, detail, extra) {
  const row = READING_GUIDES_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}
