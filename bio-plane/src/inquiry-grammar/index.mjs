/* inquiry-grammar — the module's one public face (requirements: `build/requirements/inquiry-grammar.md`; T19 layer 6,
 * K766). The grammar of an inquiry document as the record checks it (`./grammar.mjs`, R1–R5, R11–R15, R17, R18), its rows
 * (`./checks.mjs`, R7, R16, R18), and its registration with record-core's grammar seam (R6, below). Pure (R9): apart from
 * `registerInquiryGrammar`, nothing here reads or writes the record, the clock or the network. */

import { supersedesEdgeFindings, divisionDisclosureFindings, checkRecheckCoverage, checkInquiryExtension }
  from "./grammar.mjs";

export { checkInquiryExtension, checkRecheckCoverage, checkInquiryBasis, checkLegExtentGrammar, supersedesEdgeFindings,
         divisionDisclosureFindings, leadLegFindings, GROUND_LABEL_RE, EARNED_SOURCE_AXIS, IMPORTED_FINDING_RE,
         importedFindingRef, parseImportedFindingRef, importedLegFindings, CALCULATION_REF_RE, calculationLegFindings,
         OCCURRENCE_REF_RE, OCCURRENCE_KEY_RE, occurrenceRef, parseOccurrenceRef, occurrenceLegFindings, DERIVED_CONNECTION_ID_RE,
         DERIVATION_FIELDS, derivedConnectionLegFindings, BIAS_EFFECTS, biasAppliedFindings,
         flattenBiasApplied, readBiasApplied, standardLegFindings, FILE_SAYS_CITABLE_FIELDS, FILE_SAYS_LEG_KEYS,
         FILE_SAYS_FROM, fileSaysLeg, readFileSaysLeg, fileSaysLegFindings } from "./grammar.mjs";
export { LEAD_CHECKS, INQUIRY_GRAMMAR_CHECKS } from "./checks.mjs";

/** R6 (C-6.1): the supersession and division arm, record-grammar R28's `checkSupersession` slot: for every document, at
 *  the end of the references arm, the edge findings and then the disclosure findings over `ctx.fm`. */
export function checkSupersession(ctx, findings) {
  supersedesEdgeFindings(ctx.fm, findings);
  divisionDisclosureFindings(ctx.fm, findings);
}

/* The three slots this module claims, in record-grammar R28's order, each with the arm that fills it. */
const SLOTS = Object.freeze([
  Object.freeze({ slot: "checkSupersession", ids: Object.freeze(["C-6.1"]), arm: checkSupersession }),
  Object.freeze({ slot: "checkRecheckCoverage", ids: Object.freeze(["C-15.1"]), arm: checkRecheckCoverage }),
  Object.freeze({ slot: "checkInquiryExtension", ids: Object.freeze(["C-2.8"]), arm: checkInquiryExtension }),
]);

/** R6: the one registration, `{ids, arm}`, claiming the C-6.1, C-15.1 and C-2.8 slots whole (record-core R67, K766).
 *  record-core's `grammars()` answers one entry per slot and calls this arm in each as `arm(ctx, findings, {slot, rest})`;
 *  the arm runs that slot's grammar, and in the C-2.8 slot hands `rest` (the slot's later claimants, `basis-versions`'
 *  grammar, its R43) to the sub-slot inside the entry arm (R6, K775 (1)). A call naming no slot of this module's runs
 *  nothing. */
export const INQUIRY_GRAMMAR = Object.freeze({
  ids: Object.freeze(SLOTS.flatMap((s) => s.ids)),
  arm(ctx, findings, where) {
    const s = SLOTS.find((x) => x.slot === (where && where.slot));
    return s ? s.arm(ctx, findings, where) : undefined;
  },
});

/** The same grammar as record-grammar's `checkBundle` takes it from a caller passing grammars itself (its R39; K787 (2)):
 *  one `{module, ids, arm}` per slot, in R28's order, since one entry may not claim two slots there. The C-2.8 entry
 *  runs no sub-slot: a caller wanting the version grammar beside it passes `basis-versions`' too. */
export const INQUIRY_GRAMMARS = Object.freeze(SLOTS.map((s) => Object.freeze({ module: "inquiry-grammar", ids: s.ids,
  arm: (ctx, findings) => s.arm(ctx, findings) })));

const registered = new WeakSet();

/** R6: registers `INQUIRY_GRAMMAR` with `record` through record-core's grammar seam (`registerGrammar`, its R67), as
 *  `inquiry-grammar`, once per record, at the start the composition root gives it (before `basis-versions`', so its
 *  version grammar runs at the sub-slot, module order being registration order, K775 (2)). A record with no seam (a
 *  test's stand-in) is left alone; a refusal is a defect of the wiring (another module holding one of these slots'
 *  ids outside a slot, or a malformed entry) and throws, as capture's and promotion's do, rather than leave the
 *  grammar silently unrun. Answers record-core's answer, or `null` when nothing was registered. */
export function registerInquiryGrammar(record) {
  if (!record || typeof record.registerGrammar !== "function" || registered.has(record)) return null;
  const answer = record.registerGrammar("inquiry-grammar", INQUIRY_GRAMMAR);
  if (answer && answer.ok === false)
    throw new Error(`inquiry-grammar: record-core refused the inquiry grammar: ${answer.reason}`
                    + `${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
  registered.add(record);
  return answer;
}
