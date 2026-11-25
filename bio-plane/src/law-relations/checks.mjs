/* law-relations' refusal rows (requirements: `build/requirements/law-relations.md`). DEC-49: every refusal this module
 * mints carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act
 * is reached. Split from `standards` (K1961): the nine rows `standards/law.mjs` minted move here with their C-112 ids,
 * codes and translations kept (C-112 stays the family's id, nine of its rows held here, as C-69.4 and C-69.5 are held
 * apart from their family's other rows, K1907); each `where` now names this module's file, awaiting promotion's stamp.
 * C-112.29's translation names a policy among a court link's targets (R8), and C-112.53 (`LAW_RELATION_NO_EDITION`,
 * R9) is new; both await the stamp. The refusals named "the host's" in the requirements (`NO_SUCH_STANDARD`,
 * `PORTION_UNKNOWN`, `STANDARD_*`) are minted by `standards` and answered here as the host gives them. No translation
 * names a place (R17) or speaks of a law's merit (R18). */

import { word } from '../setup-words/index.mjs';

const at = (fn, region) => `src/law-relations/index.mjs ${fn} > ${region}`;

export const LAW_RELATIONS_CHECKS = Object.freeze({
  MACHINE_CANNOT_RELATE: {
    check: 'C-112.23', where: at("machineRelate", "is-law-member"),
    translation: word('refusal.MACHINE_CANNOT_RELATE'),
  },
  LAW_RELATION_UNKNOWN: {
    check: 'C-112.24', where: at("refuseRelationUnknown", "is-law-relation-type"),
    translation: word('refusal.LAW_RELATION_UNKNOWN'),
  },
  LAW_RELATION_NO_CITATION: {
    check: 'C-112.26', where: at("refuseNoCitation", "is-law-relation-cited"),
    translation: word('refusal.LAW_RELATION_NO_CITATION'),
  },
  LAW_RELATION_NO_EFFECTIVE: {
    check: 'C-112.27', where: at("#relateRefusal", "is-temporal-effective"),
    translation: word('refusal.LAW_RELATION_NO_EFFECTIVE'),
  },
  NOT_A_COURT_STANDARD: {
    check: 'C-112.28', where: at("refuseNotCourt", "is-court-standard"),
    translation: word('refusal.NOT_A_COURT_STANDARD'),
  },
  COURT_LINK_TARGET_NOT_LAW: {
    check: 'C-112.29', where: at("#linkRefusal", "is-link-target-law"),
    translation: word('refusal.COURT_LINK_TARGET_NOT_LAW'),
  },
  TREATMENT_UNKNOWN: {
    check: 'C-112.30', where: at("#treatRefusal", "is-treatment-known"),
    translation: word('refusal.TREATMENT_UNKNOWN'),
  },
  NO_SUCH_LAW_ITEM: {
    check: 'C-112.31', where: at("lawWithdraw", "is-law-item-held"),
    translation: word('refusal.NO_SUCH_LAW_ITEM'),
  },
  LAW_RELATION_SELF: {
    check: 'C-112.32', where: at("refuseSelf", "is-relation-two-ends"),
    translation: word('refusal.LAW_RELATION_SELF'),
  },
  /* T35 (R9; ST2, ST5): new, awaiting promotion's stamp. */
  LAW_RELATION_NO_EDITION: {
    check: 'C-112.53', where: at("#relateRefusal", "is-incorporation-edition"),
    translation: word('refusal.LAW_RELATION_NO_EDITION'),
  },
});

/** A refusal carrying its row: its reason, code, check id and translation. Called with the code as a literal at each
 *  site, so the DEC-49 guard reads which code a marked region mints. */
export function refusal(code, detail, extra) {
  const row = LAW_RELATIONS_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}
