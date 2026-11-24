import { word } from "../setup-words/index.mjs";
/* wizard-scripts' refusal rows (requirements: `build/requirements/wizard-scripts.md`, R20; K1364, K1393; T34's rows,
 * C-131.33–.41, awaiting stamp until T35's promotion job, plan Rules (5) 4). DEC-49: every
 * refusal this module answers carries its code, its row and the member's translation. A new family, C-131 (K1393): every
 * row is new, and each is stamped by the next promotion job. `NOT_AN_ADMIN` is membership's (its R84, C-96.1), answered
 * through `notAnAdmin` and never held here. `NOT_A_DRAFT`, `NOT_AN_APPROVER` and `APPROVER_IS_AUTHOR` are also
 * filing-templates' codes (its C-125.9, .24, .25): this module answers its own rows, worded for a wizard script, and the
 * composed catalogue keeps the first source's (control-plane R22). */

const at = (fn, region, file = "index.mjs") => `src/wizard-scripts/${file} ${fn} > ${region}`;

export const WIZARD_SCRIPTS_CHECKS = Object.freeze({
  MACHINE_CANNOT_DRAFT_WIZARD: {
    check: "C-131.1", where: at("#machine", "is-wizard-member"),
    translation: word("refusal.MACHINE_CANNOT_DRAFT_WIZARD"),
  },
  NO_SUCH_WIZARD: {
    check: "C-131.2", where: at("#noWizard", "is-no-such-wizard"),
    translation: word("refusal.NO_SUCH_WIZARD"),
  },
  WIZARD_SCOPE_REFUSED: {
    check: "C-131.3", where: at("#scope", "is-wizard-scope"),
    translation: word("refusal.WIZARD_SCOPE_REFUSED"),
  },
  WIZARD_EDITOR_NOT_GRANTED: {
    check: "C-131.4", where: at("#notGranted", "is-wizard-editor"),
    translation: word("refusal.WIZARD_EDITOR_NOT_GRANTED"),
  },
  WIZARD_RECORDING_CARRIES_VALUES: {
    check: "C-131.5", where: at("#recordingRefusal", "is-wizard-recording"),
    translation: word("refusal.WIZARD_RECORDING_CARRIES_VALUES"),
  },
  WIZARD_NAME_REFUSED: {
    check: "C-131.6", where: at("wizardDraft", "is-wizard-draft"),
    translation: word("refusal.WIZARD_NAME_REFUSED"),
  },
  WIZARD_STEP_REFUSED: {
    check: "C-131.7", where: at("#stepRefusal", "is-wizard-step"),
    translation: word("refusal.WIZARD_STEP_REFUSED"),
  },
  NOT_A_DRAFT: {
    check: "C-131.8", where: at("#notADraft", "is-wizard-not-a-draft"),
    translation: word("refusal.NOT_A_DRAFT"),
  },
  WIZARD_NO_PROPOSER: {
    check: "C-131.9", where: at("wizardPropose", "is-wizard-propose"),
    translation: word("refusal.WIZARD_NO_PROPOSER"),
  },
  WIZARD_WHY_REFUSED: {
    check: "C-131.10", where: at("wizardPropose", "is-wizard-propose"),
    translation: word("refusal.WIZARD_WHY_REFUSED"),
  },
  MACHINE_CANNOT_APPROVE_WIZARD: {
    check: "C-131.11", where: at("#machine", "is-wizard-member"),
    translation: word("refusal.MACHINE_CANNOT_APPROVE_WIZARD"),
  },
  NOT_SUBMITTED: {
    check: "C-131.12", where: at("wizardApprove", "is-wizard-approve"),
    translation: word("refusal.NOT_SUBMITTED"),
  },
  WIZARD_NOT_APPROVED: {
    check: "C-131.13", where: at("wizardApprove", "is-wizard-approve"),
    translation: word("refusal.WIZARD_NOT_APPROVED"),
  },
  NOT_AN_APPROVER: {
    check: "C-131.14", where: at("#notAnApprover", "is-wizard-not-an-approver"),
    translation: word("refusal.NOT_AN_APPROVER"),
  },
  APPROVER_IS_AUTHOR: {
    check: "C-131.15", where: at("wizardApprove", "is-wizard-approve"),
    translation: word("refusal.APPROVER_IS_AUTHOR"),
  },
  WIZARD_REASON_REFUSED: {
    check: "C-131.16", where: at("wizardRetire", "is-wizard-retire"),
    translation: word("refusal.WIZARD_REASON_REFUSED"),
  },
  WIZARD_NOT_THE_GROUPS: {
    check: "C-131.17", where: at("#notTheGroups", "is-wizard-civicsmith"),
    translation: word("refusal.WIZARD_NOT_THE_GROUPS"),
  },
  WIZARD_ALREADY_ENDED: {
    check: "C-131.18", where: at("#ended", "is-wizard-ended"),
    translation: word("refusal.WIZARD_ALREADY_ENDED"),
  },
  WIZARDS_STATE_REFUSED: {
    check: "C-131.19", where: at("wizards", "is-wizards-state"),
    translation: word("refusal.WIZARDS_STATE_REFUSED"),
  },
  WIZARD_NO_STEPS: {
    check: "C-131.20", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_NO_STEPS"),
  },
  WIZARD_SCREEN_UNKNOWN: {
    check: "C-131.21", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_SCREEN_UNKNOWN"),
  },
  WIZARD_ACT_UNKNOWN: {
    check: "C-131.22", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_ACT_UNKNOWN"),
  },
  WIZARD_STEP_NO_WHY: {
    check: "C-131.23", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_STEP_NO_WHY"),
  },
  WIZARD_DRAFT_REFUSED: {
    check: "C-131.24", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_DRAFT_REFUSED"),
  },
  WIZARD_STEP_CONCLUDES: {
    check: "C-131.25", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_STEP_CONCLUDES"),
  },
  WIZARD_TRIVIAL: {
    check: "C-131.26", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_TRIVIAL"),
  },
  WIZARD_DUPLICATE: {
    check: "C-131.27", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_DUPLICATE"),
  },
  WIZARD_ALREADY_REGISTERED: {
    check: "C-131.28", where: at("wizardRegister", "is-wizard-register"),
    translation: word("refusal.WIZARD_ALREADY_REGISTERED"),
  },
  WIZARD_PROGRESS_REFUSED: {
    check: "C-131.29", where: at("wizardProgress", "is-wizard-progress"),
    translation: word("refusal.WIZARD_PROGRESS_REFUSED"),
  },
  WIZARD_USE_REFUSED: {
    check: "C-131.30", where: at("#useRefusal", "is-wizard-use"),
    translation: word("refusal.WIZARD_USE_REFUSED"),
  },
  WIZARD_EDITOR_MEMBER_UNKNOWN: {
    check: "C-131.31", where: at("wizardEditorGrant", "is-wizard-editor-grant"),
    translation: word("refusal.WIZARD_EDITOR_MEMBER_UNKNOWN"),
  },
  WIZARD_NO_SUCH_GRANT: {
    check: "C-131.32", where: at("wizardEditorRevoke", "is-wizard-editor-grant"),
    translation: word("refusal.WIZARD_NO_SUCH_GRANT"),
  },
  /* T34 (T34-52; DEC-139 (4)): a side trip that would not return. */
  WIZARD_VIA_REFUSED: {
    check: "C-131.33", where: at("checkScript", "is-wizard-check"),
    translation: word("refusal.WIZARD_VIA_REFUSED"),
  },
  /* T34 (T34-90, T34-91; DEC-152, DEC-153; K1837, K1841): writing help in a member's own words. BOB's drafts. */
  WRITING_HELP_REFUSED: {
    check: "C-131.34", where: at("writingHelpAt", "is-writing-help", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_REFUSED"),
  },
  WRITING_HELP_REASON_FIELD: {
    check: "C-131.35", where: at("writingHelpAt", "is-writing-help", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_REASON_FIELD"),
  },
  WRITING_HELP_DRAFT_HELD: {
    check: "C-131.36", where: at("writingHelpAt", "is-writing-help", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_DRAFT_HELD"),
  },
  WRITING_HELP_NOTHING_TOLD: {
    check: "C-131.37", where: at("writingHelp", "is-writing-help-request"),
    translation: word("refusal.WRITING_HELP_NOTHING_TOLD"),
  },
  WRITING_HELP_FACT_ADDED: {
    check: "C-131.38", where: at("checkDraft", "is-writing-help-check", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_FACT_ADDED"),
  },
  WRITING_HELP_SUGGESTIONS_OFF: {
    check: "C-131.39", where: at("checkDraft", "is-writing-help-check", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_SUGGESTIONS_OFF"),
  },
  WRITING_HELP_FIRSTHAND_READ: {
    check: "C-131.40", where: at("checkDraft", "is-writing-help-check", "writing-help.mjs"),
    translation: word("refusal.WRITING_HELP_FIRSTHAND_READ"),
  },
  ASSISTANT_DRAFT_UNAVAILABLE: {
    check: "C-131.41", where: at("writingHelp", "is-writing-help-request"),
    translation: word("refusal.ASSISTANT_DRAFT_UNAVAILABLE"),
  },
  /* T41 (T41-50; N820, D52; K2574): R28's check of a proposal made for a tangled message. BOB's draft. */
  START_RUMOUR_AS_QUESTION: {
    check: "C-131.42", where: at("checkStartProposal", "is-start-rumour", "start.mjs"),
    translation: word("refusal.START_RUMOUR_AS_QUESTION"),
  },
});

/** The row a code names, or null for a code this module does not answer. */
export function rowOf(code) {
  return Object.prototype.hasOwnProperty.call(WIZARD_SCRIPTS_CHECKS, code) ? WIZARD_SCRIPTS_CHECKS[code] : null;
}
