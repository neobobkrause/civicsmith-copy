/* inquiry-grammar — THE ROWS (requirements: `build/requirements/inquiry-grammar.md` R5, R7; DEC-49, K6).
 *
 * Each row is `{check, where, translation}`, its number and translation moved from the check catalogue
 * (`checks/bio-checks.mjs`, legacy-checks) unchanged. `LEAD_NOT_EVIDENCE` (C-54.1) is raised here, by
 * `leadLegFindings` (`./grammar.mjs`), and its `where` names that site (changed from the catalogue's; stamped by
 * 1.50.0, T20's layer 2). The other five are minted by `inquiry`'s acts (its R20, R11, R23, R27), which read them
 * from here; their `where`s name those acts' sites, unchanged. This file imports nothing. */

/* =====================================================================
 * MK-4 / IC-135 / IC-136 — THE LEAD (D-194, `MEMBER-KNOWLEDGE-DESIGN.md` §5):
 * the same member knowledge BEFORE the search. C-54, minted with the old
 * process's `node tools/mintid.mjs C` (that tool was retired in T19).
 *
 * ITS OWN FAMILY because its subject is its own: the ways a member's LEAD could
 * come to claim more than it is. §5 rules a lead is an authored row and NEVER
 * EVIDENCE — it cannot be a basis leg — and following it is a LOOK recorded in
 * `observation_log` under `authority_kind = 'lead'`. The observation log's own
 * refusals (C-22.x, `checkObservation` in `airun.mjs`) apply to that look
 * unchanged and are NOT restated here; what is here is the lead's own:
 *
 *   is-lead-not-evidence   THE REFUSAL THE ITEM EXISTS FOR (§7): a lead cited as
 *                          a leg, at every leg grammar, BY NAME
 *
 * THE LIAR THIS FAMILY REFUSES is a lead that is merely an UNLABELLED
 * OBSERVATION — stored as a bundle or a content row, so a leg could cite it as
 * evidence. The first fence is STRUCTURAL: a lead lives in `leads` under a
 * `LEAD-` id that no leg grammar accepts as a target or a content id. The second
 * is this family's C-54.1, which names the lead instead of answering "not a
 * canonical record id" — a member told their lead is malformed would re-author
 * it as a document, which is exactly the liar arriving by the front door.
 * ===================================================================== */

import { word, localize } from '../setup-words/index.mjs';

export const LEAD_CHECKS = {
  LEAD_NOT_EVIDENCE: {
    check: 'C-54.1',
    where: 'src/inquiry-grammar/grammar.mjs leadLegFindings > is-lead-not-evidence',
    translation: word('refusal.LEAD_NOT_EVIDENCE'),
  },
};


/** R7, R16, R18: the rows `inquiry`'s acts mint for the inquiry's own refusals, the lead row (R5), the imported leg's
 *  (R11), the four new leg kinds' (R13–R15, R17) and a bias application's (R18), by code. Named with the
 *  reserved `_CHECKS` suffix, so DEC-49 composition (control-plane's `families.mjs`) finds it as a family (K850). */
export const INQUIRY_GRAMMAR_CHECKS = Object.freeze({
  LEAD_NOT_EVIDENCE: LEAD_CHECKS.LEAD_NOT_EVIDENCE,
  NOT_INQUIRIES: {
    check: 'C-33.13',
    where: 'src/inquiry/index.mjs #dispose > is-dispose-inquiries',
    translation: word('refusal.NOT_INQUIRIES'),
  },
  SELF_BASIS: {
    check: 'C-33.22',
    where: 'src/inquiry/index.mjs check > is-basis-acyclic, reached from op=promote through the step inquiry registers with promotion (K31)',
    translation: word('refusal.SELF_BASIS'),
  },
  BASIS_CYCLE: {
    check: 'C-33.23',
    where: 'src/inquiry/index.mjs check > is-basis-acyclic, reached from op=promote through the step inquiry registers with promotion (K31)',
    translation: word('refusal.BASIS_CYCLE'),
  },
  MACHINE_CANNOT_DIVIDE: {
    check: 'C-32.7',
    where: 'src/inquiry/index.mjs #divide > is-machine-divide',
    translation: localize('inquiry-grammar.checks.dividing_a_question_says_the', 'Dividing a question says the team asked one thing when it was really asking two, and that is a judgement about the team\'s own work. The credential that asked here is an automated one: it may raise questions and gather what they rest on, and may not restructure them. Sign in to divide it.'),
  },
  MACHINE_CANNOT_GROUND: {
    check: 'C-32.8',
    where: 'src/inquiry/index.mjs #ground > is-machine-ground',
    translation: word('refusal.MACHINE_CANNOT_GROUND'),
  },
  /* R11 (N522): a leg on another group's finding, refused by `importedLegFindings` (`./grammar.mjs`). */
  IMPORTED_LEG_MALFORMED: {
    check: 'C-21.3',
    where: 'src/inquiry-grammar/grammar.mjs importedRefusal > is-imported-leg-form',
    translation: word('refusal.IMPORTED_LEG_MALFORMED'),
  },
  /* R16 (T33-43; K1447): the three new leg kinds' departures, all C-2.8, each refused by its own site in
     `./grammar.mjs`. Stamped by promotion's next stamping (T34). */
  STANDARD_LEG_AXIS: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs standardLegRefusal > is-standard-leg-axis',
    translation: word('refusal.STANDARD_LEG_AXIS'),
  },
  CALCULATION_LEG_MALFORMED: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs calculationLegRefusal > is-calculation-leg-form',
    translation: word('refusal.CALCULATION_LEG_MALFORMED'),
  },
  OCCURRENCE_LEG_MALFORMED: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs occurrenceLegRefusal > is-occurrence-leg-form',
    translation: word('refusal.OCCURRENCE_LEG_MALFORMED'),
  },
  /* R16, R17 (T34-28; N582): a leg on a derived connection's departures, C-2.8, refused by `derivedLegRefusal` in
     `./grammar.mjs`. Stamped by promotion's next stamping (T35). */
  DERIVED_LEG_MALFORMED: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs derivedLegRefusal > is-derived-leg-form',
    translation: word('refusal.DERIVED_LEG_MALFORMED'),
  },
  /* R16, R70 (T52-20; K5332): a leg that cuts against and names a ground, refused by `checkGrounds` in `./grammar.mjs`
     (carried inside `BASIS_REFUSED` by `inquiry`'s write and `citation`'s relay). Stamped by promotion's next stamping. */
  CUTTING_LEG_IN_GROUND: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs checkGrounds > is-cutting-leg-in-ground',
    translation: localize('inquiry-grammar.checks.a_passage_that_cuts_against_the_conclusion', 'A passage that cuts against the conclusion is not a reason for it, so it cannot sit in a ground, which groups the passages that support it. Take the passage out of its ground first, then put it on the other side. Nothing was written.'),
  },
  /* R18 (T41-13; D59): a bias application at a leg whose form departs from R18's shape, C-2.8, refused by
     `biasApplicationRefusal` in `./grammar.mjs` (carried inside `BASIS_REFUSED` by `inquiry`'s write, its R11).
     Stamped by promotion's next stamping. */
  BIAS_APPLICATION_MALFORMED: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs biasApplicationRefusal > is-bias-application-form',
    translation: word('refusal.BIAS_APPLICATION_MALFORMED'),
  },
  /* F1 (citation R29; DEC-460): a leg citing what a photograph's file says, whose form departs from its shape, C-2.8,
     refused by `fileSaysLegRefusal` in `./grammar.mjs`. Stamped by promotion's next stamping. */
  FILE_SAYS_LEG_MALFORMED: {
    check: 'C-2.8',
    where: 'src/inquiry-grammar/grammar.mjs fileSaysLegRefusal > is-file-says-leg-form',
    translation: localize('inquiry-grammar.checks.a_leg_citing_what_a_file_says', 'A leg citing what a photograph\'s file says cites its time taken or its place, with the value as the file gives it, from the file and not checked, and no grade. Correct the leg. Nothing was written.'),
  },
});
