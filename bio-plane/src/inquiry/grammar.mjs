/* inquiry — the grammar face (requirements: `build/requirements/inquiry.md`, R1, R4–R9, R17). The leg and entry grammar
 * is `inquiry-grammar`'s (its R1–R8) and the state table and title helpers `record-grammar`'s (its R30, R31); each name
 * is re-exported here as the same binding, so every caller of the inquiry's grammar reaches it here and R4–R9 are met
 * through them. */

import { STATES, BASIS_ROLES, INQUIRY_TITLE_MAX, deriveInquiryTitle, inquiryQuestionOf, checkBundle }
  from "../record-grammar/index.mjs";
import { word } from "../setup-words/index.mjs";
import { GROUND_LABEL_RE, checkInquiryBasis, checkLegExtentGrammar, leadLegFindings, supersedesEdgeFindings,
         divisionDisclosureFindings, checkInquiryExtension, INQUIRY_GRAMMAR_CHECKS, INQUIRY_GRAMMARS }
  from "../inquiry-grammar/index.mjs";

export { BASIS_ROLES, GROUND_LABEL_RE, INQUIRY_TITLE_MAX, deriveInquiryTitle, inquiryQuestionOf, checkInquiryBasis,
         checkLegExtentGrammar, leadLegFindings, supersedesEdgeFindings, divisionDisclosureFindings, checkInquiryExtension };

/** R1: the inquiry's state machine, `{legal, edges}` — record-grammar's own table, never a copy. */
export const INQUIRY_MACHINE = STATES.inquiry;

/** R38: the rows this module's acts mint and its grammar raises, by code: `inquiry-grammar`'s (its R7), read, never a
 *  copy. */
export const INQUIRY_ROWS = INQUIRY_GRAMMAR_CHECKS;

/** R17 (`inquiry-grammar` R1, R2; C-2.8, C-6.1, C-15.1): an inquiry document's entry requirements, judged by
 *  record-grammar's `checkBundle` over the document as it reads it. `bundleMd` is the document's text; `opts` are
 *  `checkBundle`'s facts (`publishedRegistry`, `earnedRegistry`), null blinding the arms that need them, and `grammars`,
 *  the type grammars registered with record-core, which the instance's `checkEntry` passes from the record as
 *  promotion's gate does; with none named, `inquiry-grammar`'s own (`INQUIRY_GRAMMARS`), so a caller holding no record
 *  still has the inquiry judged. Answers the error findings, each `{check, severity, message, repairs?}`. Never throws:
 *  a document it cannot judge (a malformed grammar list among them) is one C-2.8 error saying so. */
export async function checkInquiryEntry(bundleMd, opts = {}) {
  try {
    const o = opts && typeof opts === "object" ? opts : {};
    const text = String(bundleMd ?? "");
    const id = (/^id:\s*(\S+)/m.exec(text) || [])[1] || "";
    const r = await checkBundle({ folderName: id, files: new Map([["bundle.md", text]]),
                                  publishedRegistry: o.publishedRegistry ?? null,
                                  earnedRegistry: o.earnedRegistry ?? null },
                                { grammars: o.grammars === undefined ? INQUIRY_GRAMMARS : o.grammars });
    const all = r && Array.isArray(r.findings) ? r.findings : [];
    return all.filter((x) => x && x.severity === "error");
  } catch (e) {
    return [{ check: "C-2.8", severity: "error", message: word("inquiry.message.entry_requirements_judged", { message: String(e && e.message) }) }];
  }
}
