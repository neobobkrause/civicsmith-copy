/* capture's own refusal rows (requirements: `build/requirements/capture.md`). DEC-49: every refusal this module answers
 * carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act is
 * reached.
 *
 * C-48.1–C-48.7, C-83 and C-28.13 went with the acquisition act to `acquisition` (its R29; K617, K649 (1)). The first row
 * below is new with R63 (N285, K275, K343): "no evidence object is held under a digest" is one condition, minted at one
 * site, `evidenceAbsent` (`src/capture/ops.mjs`), which this module's R21 get and extraction's R31 answer through. The
 * evidence store had no family in the catalogue, so it takes the next free family number, C-118 (K107 (3)'s rule: the
 * job names a new code's row; K174: a module holds its new rows).
 *
 * C-118.1's code was `NOT_FOUND` until N347 (K440): a generic word any module could mint, so the door could not read
 * this table without lending the row to them. It is `EVIDENCE_NOT_HELD` (R63's own words); the row keeps its number and
 * its translation.
 *
 * C-118.5 and C-118.6 are new with N364 (K509): the capturing member's signed account (R69), each minted at the one site
 * its `where` names. C-118.8 and C-118.9 with DEC-97 (R79, R81: setting held material aside and bringing it back;
 * K1019). C-118.10 is new with R86 (T41-8a; K2425 (4)): a member's upload names where the file came from.
 *
 * R37 (T43; N849, N851; K2609): C-85.1–C-85.5 and C-118.2, .3, .4 and .7 moved with their raisers to `doorbell` (its
 * R21), numbers and translations kept, and are defined in doorbell's table alone; this table holds none of them.
 * C-118's next free number stays this module's to mint: C-118.12.
 *
 * T50 (N1116; K3366, K3368): each row's `translation` is words.json's `refusal.<CODE>`, read by key through
 * `words.mjs`; this module holds no member-facing English. */

import { rowWord } from "./words.mjs";
import { localize } from "../setup-words/index.mjs";

const at = (fn, region) => `src/capture/ops.mjs ${fn} > ${region}`;
const inIndex = (fn, region) => `src/capture/index.mjs ${fn} > ${region}`;

export const CAPTURE_CHECKS = Object.freeze({
  EVIDENCE_NOT_HELD: Object.freeze({
    check: 'C-118.1', where: at("evidenceAbsent", "is-evidence-held"),
    translation: rowWord("EVIDENCE_NOT_HELD"),
  }),
  NOT_THE_CAPTURING_ACTOR: Object.freeze({
    check: 'C-118.5', where: inIndex("recordCaptureAccount", "is-capturing-actor"),
    translation: rowWord("NOT_THE_CAPTURING_ACTOR"),
  }),
  ACCOUNT_NO_TEXT: Object.freeze({
    check: 'C-118.6', where: inIndex("recordCaptureAccount", "is-account-worded"),
    translation: rowWord("ACCOUNT_NO_TEXT"),
  }),
  MACHINE_CANNOT_SET_ASIDE: Object.freeze({
    check: 'C-118.8', where: inIndex("#heldActRefusal", "is-held-act-by-member"),
    translation: rowWord("MACHINE_CANNOT_SET_ASIDE"),
  }),
  SET_ASIDE_NO_REASON: Object.freeze({
    check: 'C-118.9', where: inIndex("#heldActRefusal", "is-held-act-reasoned"),
    translation: rowWord("SET_ASIDE_NO_REASON"),
  }),
  /* R86 (T41-8a; K2425 (4), K2434): the next free row of C-118, awaiting T42's stamp (plan rule 4 (2)). */
  UPLOAD_NO_STATEMENT: Object.freeze({
    check: 'C-118.10', where: inIndex("uploadCapture", "is-upload-stated"),
    translation: rowWord("UPLOAD_NO_STATEMENT"),
  }),
  /* R101 (T51 fix round 3; C9; K4370): the next free row of C-118, awaiting promotion's stamp. The words are the design's
     `refusal.CAPTURE_NOT_HELD`, read through `localize` as a stand-in until the design adds the key to capture's `reads`
     (words-reads.json is its file): the list wins, so the sentence is the design's. */
  CAPTURE_NOT_HELD: Object.freeze({
    check: 'C-118.11', where: inIndex("fileSeenIn", "is-capture-held"),
    translation: localize("refusal.CAPTURE_NOT_HELD", "Your team's Civicsmith holds no captured document like that, or you cannot see it. Nothing was written."),
  }),
});
