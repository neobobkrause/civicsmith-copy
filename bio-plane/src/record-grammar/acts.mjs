// @ts-check
/* record-grammar: the shared act rows (R29), C-33.40 `NO_BASIS` and C-33.41 `NO_CITATION`, which entities,
   progressions and inquiry each raise; and (R52; T41-1, K2426) C-33.54 `ACCEPT_MUST_REAUTHOR`, which every owner of an
   accepting act raises from this one row. Moved from the catalogue's `ACT_SHAPE_CHECKS` at T19 with their number and
   translation unchanged; that family holds them by reference until its last owner takes its rows (rule 1). C-33.41's
   `where` was re-pointed on the move (N430, K720): `src/store.mjs actNoCitation`, which it named, was deleted by
   LEGACY-STORE #8, and the code is minted at entities' and progressions' sites, each through its module's one refusal
   helper. The row change was stamped by 1.49.0 (PROMOTION #20, T19 layer 2). C-33.40's `where` names all five of its
   sites since T43 (N857), stamped with that tranche's census. */

import { word } from '../setup-words/index.mjs';

/** A shared act row: its check number, the sites that raise it, and the sentence a member reads.
 * @typedef {{check: string, where: string, translation: string}} ActRow */
/** @type {Readonly<{NO_BASIS: ActRow, NO_CITATION: ActRow, ACCEPT_MUST_REAUTHOR: ActRow}>} */
export const SHARED_ACT_CHECKS = Object.freeze({
  /* ---------------------------------------------------------------------------
     D-484, 2026-09-24 — THE FIRST TWO ROWS THIS FAMILY'S OWN HEADER SAID IT
     COULD NOT HOLD, AND THEY EXIST BECAUSE THE PLANE CHANGED SHAPE RATHER THAN
     BECAUSE A SENTENCE WAS FINALLY WRITTEN.

     The header above states the bar and the reason: a row holds ONE `where`,
     one code may not hold two rows, and a `where` naming one of four sites
     would claim a span the code is not confined to — *"REC-71's overstatement
     wearing the other face"*. It then names the honest fix — *"the refusals
     consolidated behind one helper so there IS one site"* — and ROUTES it.
     D-484 is that routing coming back. `NO_BASIS` was minted at four sites in
     `store.mjs` and `NO_CITATION` at three; each is now minted at exactly ONE,
     inside the region named below, and every former site returns through it.

     So the `where` is not a narrowing of a claim this family could not support
     — it was then literally true, `store.mjs` holding one `reason: "NO_BASIS"`
     and one `reason: "NO_CITATION"` literal (the old battery's d484 suite pinned
     that; both are deleted). Each `where` now names the module whose one
     refusal helper mints the code (R29).

     EACH TRANSLATION IS TRUE AT EVERY SITE IT NOW SERVES, which is the price of
     consolidation and is where a careless one would do harm. `NO_BASIS` covers
     concluding an inquiry that rests on nothing, partitioning a question with no
     legs, a grade-D testimony with no stated basis, and a revision of a declared
     flow that does not say why it changes — so the sentence speaks about WHAT
     THIS RESTS ON and never about legs, or documents, or flows. The per-site
     `detail` still carries the particular, unchanged.

     THE UNDETERMINED DOOR IS NAMED, on NO_FALSIFIER's precedent (REC-117): a
     member refused for a missing basis is a member under pressure to invent one,
     and the record would rather carry *nothing supports this yet* in the open.
     --------------------------------------------------------------------------- */
  NO_BASIS: {
    check: 'C-33.40',
    /* (N827, K2467; T42) every site that answers with this row: inquiry's helper (basis-versions raises through it),
       progressions' and entities' one refusal helpers, each named with the acts it serves. (T43; N857, K2643) money's
       and lines' one refusal helpers join them: money's `refusal` for a fund's type (`setFundType`) and lines'
       `noBasis` for `recordLine`'s basis forms, each of which reads this row and adds none of its own. */
    where: 'src/inquiry/index.mjs actNoBasis > is-act-no-basis (inquiry\'s, and basis-versions\' through it), '
      + 'src/progressions/checks.mjs refusal (progressions\' first declaration and revision of a declared flow, '
      + 'src/progressions/index.mjs), src/entities/index.mjs actShapeRefusal (entities\' held identifier and '
      + 'grade-D testimony), src/money/index.mjs refusal (money\'s fund type, `setFundType`), and '
      + 'src/lines/index.mjs noBasis (lines\' basis forms, `recordLine`)',
    translation: word('refusal.NO_BASIS'),
  },
  NO_CITATION: {
    check: 'C-33.41',
    where: 'src/entities/index.mjs actShapeRefusal (entities\' declared relation, `declareRelation`), and '
      + 'src/progressions/checks.mjs refusal (progressions\' revision of a declared flow and exception document, '
      + 'src/progressions/index.mjs)',
    translation: word('refusal.NO_CITATION'),
  },
  /* R52 (T41-1, N820; D3; K231, K2426): ONE CODE, ONE CONDITION, ONE ROW. Accepting a proposal as proposed, where that
     would make a member vouch for a legal or authored statement (an action's reason, a case statement, a testimony), is
     refused by the act's owner with this row, and only `edited` or `own_instead` lands (Investigation §5). The owners
     (`steps` R24, `hypotheses` R17, `run-productions` R22, `question-explorer` R6, `investigation` R12, R20,
     `case-account` R4, case-authoring R64's account drafts moving there at L8; R55, K2608) read it from here and add no row of their own; the code is `ACCEPT_MUST_REAUTHOR`
     (acceptance.mjs). The translation states the meaning; the design stream words it later by key. */
  ACCEPT_MUST_REAUTHOR: {
    check: 'C-33.54',
    where: 'raised by the owner of each accepting act that would make a member vouch for a legal or authored statement '
      + '(steps R24, hypotheses R17, run-productions R22, question-explorer R6, investigation R12 and R20, case-account '
      + 'R4), from this shared row (record-grammar R52)',
    translation: word('refusal.ACCEPT_MUST_REAUTHOR'),
  },
});
