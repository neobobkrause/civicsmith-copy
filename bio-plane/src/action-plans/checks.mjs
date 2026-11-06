/* action-plans' refusal rows (requirements: `build/requirements/action-plans.md`). DEC-49: every refusal this module
 * mints carries its code, its row and the member's translation, so a surface shows the same sentence wherever the act
 * is reached. The family is C-124, minted with the module (K174: a new module holds its new family); each code is
 * minted at one site (K231), named by its row's `where`; every row was taken by promotion's stamp 1.49.0 (PROMOTION #20,
 * T19 layer 2; K711). Refusals minted by the modules this one uses are relayed with their own rows:
 * `NO_SUCH_PROJECT` (membership R78), `PROJECT_SEEN_NOT_A_PARTICIPANT` (membership R44), the project-authority
 * refusals (membership R55), `NO_SUCH_DETERMINATION` (conformance R19), `NO_SUCH_STANDARD` (standards R17),
 * `CONTACT_NOT_A_MEMBER` (actions R45) and `REMINDER_REFUSED` (action-clocks R4), each answered through its module's
 * exported site (`contactNotAMember`, `reminderRefused`; N427), `AI_RUN_NOT_PRINCIPAL`
 * (run-rules R5) and every refusal of the action's write (actions, action-clocks). */

import { word, localize } from '../setup-words/index.mjs';

const at = (fn, region) => `src/action-plans/index.mjs ${fn} > ${region}`;

/* R47 (T46; DEC-194, N913): the words of `words.json` (`docs/development/ux-substrate/screens/words.json`) this module
   answers, each `en` verbatim, read by key as `membership`'s `HANDLE_WORDS` and `extraction`'s `TRANSCRIBE_WORDS` are:
   seven rows' translations (`refusal.<CODE>`) and the closing note's prompt (R20, `plan.close.lessons`). The rows keep
   their codes, numbers and `where`s. (T47, R49; DEC-199, N963) `refusal.DOCUMENT_FIRST_NO_REASON` is DEC-199's sentence,
   true of R42's absent and malformed `why_first` alike, so C-124.63 reads it by key too: one code for both arms. */
export const PLAN_WORDS = Object.freeze({
  'refusal.SCENARIO_OUT_OF_RANGE': word('refusal.SCENARIO_OUT_OF_RANGE'),
  'refusal.NO_SUCH_SCENARIO': word('refusal.NO_SUCH_SCENARIO'),
  'refusal.SCENARIO_ALREADY_SET_ASIDE': word('refusal.SCENARIO_ALREADY_SET_ASIDE'),
  'refusal.SCENARIO_NOT_SET_ASIDE': word("refusal.SCENARIO_NOT_SET_ASIDE"),
  'refusal.PLAN_NOT_OPEN': word('refusal.PLAN_NOT_OPEN'),
  'refusal.PLAN_NOT_PAUSED': word('refusal.PLAN_NOT_PAUSED'),
  'refusal.DOCUMENT_FIRST_NO_REASON': word('refusal.DOCUMENT_FIRST_NO_REASON'),
  'plan.close.lessons': word('plan.close.lessons'),
  'refusal.PLAN_NO_TITLE': word('refusal.PLAN_NO_TITLE'),
});

export const ACTION_PLAN_CHECKS = Object.freeze({
  /* ---- R1, R4: opening a plan and its subjects ---- */
  MACHINE_CANNOT_PLAN: {
    check: 'C-124.1', where: at("machineCannotPlan", "is-plan-member"),
    translation: word('refusal.MACHINE_CANNOT_PLAN'),
  },
  PLAN_NO_TITLE: {
    check: 'C-124.2', where: at("planOpen", "is-plan-titled"),
    translation: PLAN_WORDS['refusal.PLAN_NO_TITLE'],
  },
  PLAN_NO_SUBJECT: {
    check: 'C-124.3', where: at("refuseNoSubject", "is-plan-subjects"),
    translation: word('refusal.PLAN_NO_SUBJECT'),
  },
  SUBJECT_MALFORMED: {
    check: 'C-124.4', where: at("refuseMalformed", "is-subject-shaped"),
    translation: word('refusal.SUBJECT_MALFORMED'),
  },
  NO_SUCH_INQUIRY: {
    check: 'C-124.5', where: at("refuseNoSuchInquiry", "is-inquiry-seen"),
    translation: word('refusal.NO_SUCH_INQUIRY'),
  },
  SUBJECT_NOT_OF_PROJECT: {
    check: 'C-124.6', where: at("#subjects", "is-subject-of-project"),
    translation: word('refusal.SUBJECT_NOT_OF_PROJECT'),
  },
  SUBJECT_NOT_LIVE: {
    check: 'C-124.7', where: at("#subjects", "is-subject-live"),
    translation: word('refusal.SUBJECT_NOT_LIVE'),
  },
  SUBJECT_IN_ACTIVE_PLAN: {
    check: 'C-124.8', where: at("#subjects", "is-subject-free"),
    translation: word('refusal.SUBJECT_IN_ACTIVE_PLAN'),
  },
  NO_SUCH_PLAN: {
    check: 'C-124.9', where: at("noSuchPlan", "is-plan-seen"),
    translation: word('refusal.NO_SUCH_PLAN'),
  },
  PLAN_CLOSED: {
    check: 'C-124.10', where: at("refusePlanClosed", "is-plan-open"),
    translation: word('refusal.PLAN_CLOSED'),
  },
  PLAN_NO_REASON: {
    check: 'C-124.11', where: at("refuseReason", "is-reason-given"),
    translation: word('refusal.PLAN_NO_REASON'),
  },

  /* ---- R9–R12: options and proposals ---- */
  MACHINE_CANNOT_ADD_OPTION: {
    check: 'C-124.12', where: at("#optionMember", "is-option-member"),
    translation: word('refusal.MACHINE_CANNOT_ADD_OPTION'),
  },
  OPTION_NO_SUMMARY: {
    check: 'C-124.13', where: at("#optionFields", "is-option-summary"),
    translation: word('refusal.OPTION_NO_SUMMARY'),
  },
  OPTION_DETAIL_TOO_LONG: {
    check: 'C-124.14', where: at("#optionFields", "is-option-detail"),
    translation: word('refusal.OPTION_DETAIL_TOO_LONG'),
  },
  CATEGORY_UNKNOWN: {
    check: 'C-124.15', where: at("#optionFields", "is-option-category"),
    translation: word('refusal.CATEGORY_UNKNOWN'),
  },
  OPTION_NO_SUBJECT: {
    check: 'C-124.16', where: at("#optionFields", "is-option-subject"),
    translation: word('refusal.OPTION_NO_SUBJECT'),
  },
  ADDRESSEE_REFUSED: {
    check: 'C-124.17', where: at("#optionFields", "is-option-addressee"),
    translation: localize('action-plans.checks.an_addressee_is_an_office', 'An addressee is an office by its role and body, a reporter or outlet, an organisation or another civic organization by role and organisation, or a described audience. It is never a private individual. Nothing was written.'),
  },
  ADDRESSEE_INCOMPLETE: {
    check: 'C-124.66', where: at("#optionFields", "is-option-addressee"),
    translation: localize('action-plans.checks.an_addressee_names_its_role_and_organisation', 'An addressee needs its role, and its organisation unless it is an office. Say which part is missing. Nothing was written.'),
  },
  DATE_REFUSED: {
    check: 'C-124.18', where: at("#optionFields", "is-option-date"),
    translation: word('refusal.DATE_REFUSED'),
  },
  TIER_REFUSED: {
    check: 'C-124.19', where: at("#optionFields", "is-option-tier"),
    translation: word('refusal.TIER_REFUSED'),
  },
  LOBBYING_NO_REQUIREMENT: {
    check: 'C-124.20', where: at("#optionFields", "is-lobbying-enforces"),
    translation: word('refusal.LOBBYING_NO_REQUIREMENT'),
  },
  OPTION_KEY_REFUSED: {
    check: 'C-124.21', where: at("refuseKeys", "is-no-cost-or-score"),
    translation: word('refusal.OPTION_KEY_REFUSED'),
  },
  NO_SUCH_PLAN_PROPOSAL: {
    check: 'C-124.22', where: at("refuseNoSuchProposal", "is-proposal-seen"),
    translation: word('refusal.NO_SUCH_PLAN_PROPOSAL'),
  },
  PROPOSAL_ADOPTED: {
    check: 'C-124.23', where: at("optionAdopt", "is-proposal-once"),
    translation: word('refusal.PROPOSAL_ADOPTED'),
  },
  PROPOSAL_NO_PROPOSER: {
    check: 'C-124.24', where: at("optionPropose", "is-proposer-stamped"),
    translation: word('refusal.PROPOSAL_NO_PROPOSER'),
  },
  PROPOSAL_WHY_REFUSED: {
    check: 'C-124.25', where: at("optionPropose", "is-proposal-why"),
    translation: word('refusal.PROPOSAL_WHY_REFUSED'),
  },

  /* ---- R13: dispositions ---- */
  MACHINE_CANNOT_DISPOSE: {
    check: 'C-124.26', where: at("optionDispose", "is-dispose-member"),
    translation: word('refusal.MACHINE_CANNOT_DISPOSE'),
  },
  DISPOSITION_UNKNOWN: {
    check: 'C-124.27', where: at("optionDispose", "is-disposition-known"),
    translation: word('refusal.DISPOSITION_UNKNOWN'),
  },
  NO_SUCH_OPTION: {
    check: 'C-124.28', where: at("refuseNoSuchOption", "is-option-held"),
    translation: word('refusal.NO_SUCH_OPTION'),
  },

  /* ---- R14–R16: scenarios and checkpoints ---- */
  MACHINE_CANNOT_SCHEDULE: {
    check: 'C-124.29', where: at("scenarioSet", "is-scenario-member"),
    translation: word('refusal.MACHINE_CANNOT_SCHEDULE'),
  },
  SCENARIO_OUT_OF_RANGE: {
    check: 'C-124.30', where: at("scenarioSet", "is-scenario-numbered"),
    translation: PLAN_WORDS['refusal.SCENARIO_OUT_OF_RANGE'],
  },
  SCENARIO_NAME_REFUSED: {
    check: 'C-124.31', where: at("scenarioSet", "is-scenario-named"),
    translation: word('refusal.SCENARIO_NAME_REFUSED'),
  },
  PHASE_MALFORMED: {
    check: 'C-124.32', where: at("#scenarioPhases", "is-phase-shaped"),
    translation: word('refusal.PHASE_MALFORMED'),
  },
  PHASE_OPTION_NOT_CHOSEN: {
    check: 'C-124.33', where: at("#scenarioPhases", "is-phase-option-chosen"),
    translation: word('refusal.PHASE_OPTION_NOT_CHOSEN'),
  },
  PHASE_CYCLE: {
    check: 'C-124.34', where: at("#scenarioPhases", "is-phase-acyclic"),
    translation: word('refusal.PHASE_CYCLE'),
  },
  BRANCH_UNKNOWN: {
    check: 'C-124.35', where: at("#scenarioPhases", "is-branch-known"),
    translation: localize('action-plans.checks.a_phase_starts_after_or', 'A phase starts after, or a judgement leads to, a phase of the same scenario, or a matter the plan is about. The one named is neither. Nothing was written.'),
  },
  MACHINE_CANNOT_JUDGE: {
    check: 'C-124.36', where: at("checkpointRecord", "is-judge-member"),
    translation: localize('action-plans.checks.whether_a_checkpoints_condition_was', 'Whether a checkpoint\'s condition was met is the team\'s own judgement. An assistant may not make it. Nothing was written.'),
  },
  CHECKPOINT_REFUSED: {
    check: 'C-124.37', where: at("checkpointRecord", "is-checkpoint-named"),
    translation: localize('action-plans.checks.a_judgement_names_a_scenario', 'A judgement names a scenario of the plan, one of its phases that has a checkpoint, met or not_met, and a note of up to 500 characters. Nothing was written.'),
  },
  CHECKPOINT_NOT_DUE: {
    check: 'C-124.38', where: at("checkpointRecord", "is-checkpoint-due"),
    translation: word('refusal.CHECKPOINT_NOT_DUE'),
  },
  CHECKPOINT_JUDGED: {
    check: 'C-124.39', where: at("checkpointRecord", "is-checkpoint-once"),
    translation: word('refusal.CHECKPOINT_JUDGED'),
  },

  /* ---- R18: starting an option ---- */
  MACHINE_CANNOT_START: {
    check: 'C-124.40', where: at("optionStart", "is-start-member"),
    translation: word('refusal.MACHINE_CANNOT_START'),
  },
  OPTION_NOT_CHOSEN: {
    check: 'C-124.41', where: at("optionStart", "is-start-chosen"),
    translation: word('refusal.OPTION_NOT_CHOSEN'),
  },
  OPTION_STARTED: {
    check: 'C-124.42', where: at("optionStart", "is-start-once"),
    translation: word('refusal.OPTION_STARTED'),
  },

  /* ---- R20: closing ---- */
  MACHINE_CANNOT_CLOSE_PLAN: {
    check: 'C-124.43', where: at("planClose", "is-close-member"),
    translation: word('refusal.MACHINE_CANNOT_CLOSE_PLAN'),
  },

  /* ---- R21: the project's kind of work ---- */
  WORK_KIND_UNKNOWN: {
    check: 'C-124.44', where: at("#workKindsCheck", "is-work-kind-known"),
    translation: word('refusal.WORK_KIND_UNKNOWN'),
  },
  MACHINE_CANNOT_SET_WORK_KIND: {
    check: 'C-124.45', where: at("#workKindsCheck", "is-work-kind-member"),
    translation: word('refusal.MACHINE_CANNOT_SET_WORK_KIND'),
  },

  /* ---- R30, R31, R34: the planning run ---- */
  PLAN_NOT_OF_PROJECT: {
    check: 'C-124.46', where: at("planRunCheck", "is-plan-of-context"),
    translation: word('refusal.PLAN_NOT_OF_PROJECT'),
  },
  PROPOSAL_NO_RUN: {
    check: 'C-124.47', where: at("#runGate", "is-proposal-run"),
    translation: word('refusal.PROPOSAL_NO_RUN'),
  },
  PROPOSAL_RUN_NOT_RUNNING: {
    check: 'C-124.48', where: at("#runGate", "is-proposal-run-running"),
    translation: word('refusal.PROPOSAL_RUN_NOT_RUNNING'),
  },
  PROPOSAL_RUN_OTHER_PLAN: {
    check: 'C-124.49', where: at("refuseRunOtherPlan", "is-run-of-plan"),
    translation: word('refusal.PROPOSAL_RUN_OTHER_PLAN'),
  },
  PROPOSAL_BOUND_REACHED: {
    check: 'C-124.50', where: at("#runGate", "is-proposal-bound"),
    translation: word('refusal.PROPOSAL_BOUND_REACHED'),
  },
  PROPOSAL_NO_SOURCE: {
    check: 'C-124.51', where: at("#sources", "is-proposal-sourced"),
    translation: word('refusal.PROPOSAL_NO_SOURCE'),
  },
  /* C-124.52 (PROPOSALS_CURSOR_REFUSED) is RETIRED and its number is never reused (R34 as amended; Bob's Actions D17,
     K2443): the tray answers every proposal of a planning run, with no `after` cursor to refuse. */

  /* ---- the record object (R27, R24): the plan's document ---- */
  MACHINE_CANNOT_WRITE_PLAN: {
    check: 'C-124.53', where: at("check", "is-plan-doc-member"),
    translation: word('refusal.MACHINE_CANNOT_WRITE_PLAN'),
  },
  PLAN_BY_ACT_ONLY: {
    check: 'C-124.54', where: at("check", "is-plan-doc-act"),
    translation: word('refusal.PLAN_BY_ACT_ONLY'),
  },
  PLAN_HISTORY_REWRITTEN: {
    check: 'C-124.55', where: at("check", "is-plan-append-only"),
    translation: word('refusal.PLAN_HISTORY_REWRITTEN'),
  },
  UNSPLICEABLE_PLAN: {
    check: 'C-124.56', where: at("#append", "is-plan-spliceable"),
    translation: word('refusal.UNSPLICEABLE_PLAN'),
  },
  PLAN_PROVIDER_UNAVAILABLE: {
    check: 'C-124.57', where: at("refuseProviderUnavailable", "is-provider-present"),
    translation: word('refusal.PLAN_PROVIDER_UNAVAILABLE'),
  },

  /* ---- R39, R40, R42, R20 (T45): scenarios set aside, the paused state, document first, the close ---- */
  NO_SUCH_SCENARIO: {
    check: 'C-124.58', where: at("#scenarioAct", "is-scenario-held"),
    translation: PLAN_WORDS['refusal.NO_SUCH_SCENARIO'],
  },
  SCENARIO_ALREADY_SET_ASIDE: {
    check: 'C-124.59', where: at("#scenarioAct", "is-scenario-in-use"),
    translation: PLAN_WORDS['refusal.SCENARIO_ALREADY_SET_ASIDE'],
  },
  SCENARIO_NOT_SET_ASIDE: {
    check: 'C-124.60', where: at("#scenarioAct", "is-scenario-aside"),
    translation: PLAN_WORDS['refusal.SCENARIO_NOT_SET_ASIDE'],
  },
  PLAN_NOT_OPEN: {
    check: 'C-124.61', where: at("#pauseAct", "is-plan-pausable"),
    translation: PLAN_WORDS['refusal.PLAN_NOT_OPEN'],
  },
  PLAN_NOT_PAUSED: {
    check: 'C-124.62', where: at("#pauseAct", "is-plan-paused"),
    translation: PLAN_WORDS['refusal.PLAN_NOT_PAUSED'],
  },
  DOCUMENT_FIRST_NO_REASON: {
    check: 'C-124.63', where: at("optionStart", "is-document-first"),
    translation: PLAN_WORDS['refusal.DOCUMENT_FIRST_NO_REASON'],
  },
  LOOK_AGAIN_REFUSED: {
    check: 'C-124.64', where: at("#pauseAct", "is-look-again-day"),
    translation: word('refusal.LOOK_AGAIN_REFUSED'),
  },
  CLOSE_NOTE_TOO_LONG: {
    check: 'C-124.65', where: at("planClose", "is-close-note"),
    translation: word('refusal.CLOSE_NOTE_TOO_LONG'),
  },
  /* ---- R56 (T53): who produced a proposal; the number is the next of C-124 at the job's stamp (BOB's), and the
     design has no words.json row yet, so the sentence is this module's own, as ADDRESSEE_INCOMPLETE's is ---- */
  PLAN_PRODUCED_BY_MALFORMED: {
    check: 'C-124.67', where: at("optionPropose", "is-proposal-produced-by"),
    translation: localize('action-plans.checks.produced_by_malformed', "This proposal named who produced it in a form your team's Civicsmith cannot read, so nothing was written. Send the labels of the conversations that produced it, or none."),
  },
});

/** One constructor for every refusal minted here: `reason`, the site's own `detail` and keys, then `code`, `check` and
 *  `translation` from the row. */
export function refusal(code, detail, extra) {
  const row = ACTION_PLAN_CHECKS[code];
  return { ok: false, reason: code, detail, ...(extra || {}), code, check: row.check, translation: row.translation };
}
