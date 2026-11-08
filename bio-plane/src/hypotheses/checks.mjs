/* hypotheses — THE ROWS (requirements: `build/requirements/hypotheses.md` R1, R2, R5, R6, R11, R13; K1467, K1473,
 * K1487; DEC-136).
 *
 * Each row is `{check, where, translation}`, family C-134, minted here. The acts' rows (R1, R2) are this module's own
 * answers, under codes of its own (N608, DEC-49 arm A: `HYPOTHESIS_NO_STATEMENT`, `HYPOTHESIS_NO_REASON`, numbers and
 * translations unchanged); the leg rows (R5, R6) are carried inside `BASIS_REFUSED` by the check this module registers
 * with `promotion`; the notes' rows (R11, R13; T34, K1807) answer a member's own notes, and (T35, DEC-144) C-134.13–C-134.16 name
 * `noteRevise` and `noteDelete` too, with no new code. Rows changed or added in T34 and T35 await
 * `promotion`'s next stamp; (T41) C-134.20–C-134.28 the system's proposals and a note's share, awaiting the stamp too;
 * (T42, R22; N843, K2566) C-134.22 and C-134.23 re-coded in place under codes of their own, numbers and translations
 * kept, so this module never answers action-plans' `PROPOSAL_NO_RUN` or intent's `NO_SUCH_PROPOSAL`; (layer 12, F1)
 * C-134.29–C-134.33 the rival explanations' refusals, awaiting the stamp too. No translation
 * names a place. This file imports nothing. */

import { word, localize } from "../setup-words/index.mjs";

const act = (fn) => `src/hypotheses/index.mjs ${fn}`;
const acts = (...fns) => fns.map(act).join("; ");
const leg = "src/hypotheses/index.mjs legRefusals";

export const HYPOTHESES_CHECKS = {
  NO_SUCH_BUNDLE: { check: "C-134.1", where: act("hold"),
    translation: localize("hypotheses.checks.there_is_no_inquiry_here", "There is no inquiry here by that id that you can see. Nothing was written.") },
  NOT_AN_INQUIRY: { check: "C-134.2", where: act("hold"),
    translation: localize("hypotheses.checks.a_hypothesis_is_held_in", "A hypothesis is held in an inquiry, and this record is not one. Hold it in the inquiry it belongs to. Nothing was written.") },
  MACHINE_CANNOT_HYPOTHESISE: { check: "C-134.3", where: act("hold"),
    translation: word("refusal.MACHINE_CANNOT_HYPOTHESISE") },
  UNKNOWN_HYPOTHESIS_KIND: { check: "C-134.4", where: act("hold"),
    translation: word("refusal.UNKNOWN_HYPOTHESIS_KIND") },
  HYPOTHESIS_NO_STATEMENT: { check: "C-134.5", where: act("hold"),
    translation: word("refusal.HYPOTHESIS_NO_STATEMENT") },
  BAD_ABOUT: { check: "C-134.6", where: act("hold"),
    translation: word("refusal.BAD_ABOUT") },
  HYPOTHESIS_NO_REASON: { check: "C-134.7", where: act("revise"),
    translation: word("refusal.HYPOTHESIS_NO_REASON") },
  NO_SUCH_HYPOTHESIS: { check: "C-134.8", where: act("revise"),
    translation: word("refusal.NO_SUCH_HYPOTHESIS") },
  HYPOTHESIS_WITHDRAWN: { check: "C-134.9", where: act("revise"),
    translation: word("refusal.HYPOTHESIS_WITHDRAWN") },
  HYPOTHESIS_NOT_A_LEG: { check: "C-134.10", where: `${leg} > is-hypothesis-leg`,
    translation: word("refusal.HYPOTHESIS_NOT_A_LEG") },
  LEAD_NOT_A_LEG: { check: "C-134.11", where: `${leg} > is-lead-leg`,
    translation: word("refusal.LEAD_NOT_A_LEG") },
  LEG_NOT_REDERIVED: { check: "C-134.12", where: `${leg} > is-rederived-leg`,
    translation: word("refusal.LEG_NOT_REDERIVED") },
  MACHINE_CANNOT_NOTE: { check: "C-134.13", where: acts("noteWrite", "noteRevise", "noteTurn", "noteDelete"),
    translation: word("refusal.MACHINE_CANNOT_NOTE") },
  NOTE_NO_TEXT: { check: "C-134.14", where: acts("noteWrite", "noteRevise"),
    translation: word("refusal.NOTE_NO_TEXT") },
  NOTE_TOO_LONG: { check: "C-134.15", where: acts("noteWrite", "noteRevise"),
    translation: word("refusal.NOTE_TOO_LONG") },
  NO_SUCH_NOTE: { check: "C-134.16", where: acts("noteTurn", "noteRevise", "noteDelete"),
    translation: localize("hypotheses.checks.there_is_no_note_of", "There is no note of yours by that number. Nothing was written.") },
  NOTE_TURN_UNKNOWN: { check: "C-134.17", where: act("noteTurn"),
    translation: word("refusal.NOTE_TURN_UNKNOWN") },
  NOTE_TURN_NOT_MADE: { check: "C-134.18", where: act("noteTurn"),
    translation: word("refusal.NOTE_TURN_NOT_MADE") },
  NOTE_TOO_LONG_FOR_HUNCH: { check: "C-134.19", where: act("noteTurn"),
    translation: word("refusal.NOTE_TOO_LONG_FOR_HUNCH") },
  /* T41 (T41-16; D33, D46 A, D3, D18): the system's proposals (R16–R18) and a note's share (R19–R21) */
  PROPOSAL_NO_HOW: { check: "C-134.20", where: act("hypothesisPropose"),
    translation: word("refusal.PROPOSAL_NO_HOW") },
  PROPOSAL_NO_RATE: { check: "C-134.21", where: act("hypothesisPropose"),
    translation: word("refusal.PROPOSAL_NO_RATE") },
  HYPOTHESIS_PROPOSAL_NO_RUN: { check: "C-134.22", where: act("hypothesisPropose"),
    translation: word("refusal.HYPOTHESIS_PROPOSAL_NO_RUN") },
  NO_SUCH_HYPOTHESIS_PROPOSAL: { check: "C-134.23", where: acts("hypothesisTakeUp", "hypothesisSetAside"),
    translation: word("refusal.NO_SUCH_HYPOTHESIS_PROPOSAL") },
  PROPOSAL_NOT_OPEN: { check: "C-134.24", where: acts("hypothesisTakeUp", "hypothesisSetAside"),
    translation: localize("hypotheses.checks.proposal_not_open", "This proposal was already taken up or set aside. Nothing was written.") },
  PROPOSAL_FORM_UNKNOWN: { check: "C-134.25", where: act("hypothesisTakeUp"),
    translation: word("refusal.PROPOSAL_FORM_UNKNOWN") },
  PROPOSAL_NO_REASON: { check: "C-134.26", where: act("hypothesisSetAside"),
    translation: word("refusal.PROPOSAL_NO_REASON") },
  NO_SUCH_SHARE: { check: "C-134.27", where: act("noteUnshare"),
    translation: word("refusal.NO_SUCH_SHARE") },
  NARRATIVE_NOT_A_LEG: { check: "C-134.28", where: `${leg} > is-narrative-leg`,
    translation: word("refusal.NARRATIVE_NOT_A_LEG") },
  /* F1 (layer 12, CR2-19; BD-17, IV-H1, IV-H2; the ux lane's DEC-502 words, keyed by code): the rivals and the mark, awaiting
     promotion's stamp. The machine's refusal is this module's own `MACHINE_CANNOT_MARK_RIVAL` (C-134.32), never sources'
     `MACHINE_CANNOT_MARK` (C-121.7), whose word names a paid service. */
  RIVALS_TOO_FEW: { check: "C-134.29", where: act("hypothesisRivals"),
    translation: word("refusal.RIVALS_TOO_FEW") },
  RIVALS_TOO_MANY: { check: "C-134.30", where: act("hypothesisRivals"),
    translation: word("refusal.RIVALS_TOO_MANY") },
  NOT_IN_INQUIRY: { check: "C-134.31", where: act("hypothesisRivals"),
    translation: word("refusal.NOT_IN_INQUIRY") },
  MACHINE_CANNOT_MARK_RIVAL: { check: "C-134.32", where: act("exploreNext"),
    translation: word("refusal.MACHINE_CANNOT_MARK_RIVAL") },
  NOT_A_RIVAL: { check: "C-134.33", where: act("exploreNext"),
    translation: word("refusal.NOT_A_RIVAL") },
};
