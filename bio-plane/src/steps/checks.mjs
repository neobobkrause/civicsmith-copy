/* steps — THE ROWS (requirements: `build/requirements/steps.md`; T41-17, N820).
 *
 * Each row is `{check, where, translation}`, family C-142, minted here and awaiting the stamp of T42's promotion job.
 * A project's refusals (`PROJECT_SEEN_NOT_A_PARTICIPANT`, `NO_SUCH_PROJECT`, `PROJECT_ACT_NOT_A_PARTICIPANT`) are
 * `membership`'s, relayed; `MINT_EXHAUSTED` is `record-core`'s. No translation names a place. This file imports
 * nothing. */

import { word } from "../setup-words/index.mjs";

const at = (...fns) => fns.map((f) => `src/steps/index.mjs ${f}`).join("; ");

/** The module's refusal rows, keyed by code: each `{check, where, translation}`.
 * @type {Record<string, {check: string, where: string, translation: string}>} */
export const STEPS_CHECKS = {
  STEP_NO_WORK: { check: "C-142.1", where: at("stepCreate", "stepPropose", "stepAccept"),
    translation: word("refusal.STEP_NO_WORK") },
  STEP_BAD_PLACE: { check: "C-142.2", where: at("stepCreate", "stepPropose", "stepRefer"),
    translation: word("refusal.STEP_BAD_PLACE") },
  NO_SUCH_BUNDLE: { check: "C-142.3", where: at("stepCreate", "stepRefer", "stepsOn", "questionFollow"),
    translation: word("refusal.NO_SUCH_BUNDLE") },
  STEP_BAD_BY_WHEN: { check: "C-142.4", where: at("stepCreate", "stepByWhen"),
    translation: word("refusal.STEP_BAD_BY_WHEN") },
  STEP_NOT_YOUR_RUN: { check: "C-142.5", where: at("stepCreate", "stepPropose"),
    translation: word("refusal.STEP_NOT_YOUR_RUN") },
  STEP_ALIKE_EXISTS: { check: "C-142.6", where: at("stepCreate"),
    translation: word("refusal.STEP_ALIKE_EXISTS") },
  NO_SUCH_STEP: { check: "C-142.7", where: at("step", "stepStart", "stepEnd", "stepDelete", "stepRefer", "stepProduct", "costMessage"),
    translation: word("refusal.NO_SUCH_STEP") },
  STEP_WAITING: { check: "C-142.8", where: at("stepStart"),
    translation: word("refusal.STEP_WAITING") },
  STEP_BAD_END: { check: "C-142.9", where: at("stepEnd"),
    translation: word("refusal.STEP_BAD_END") },
  STEP_BAD_OUTCOME: { check: "C-142.10", where: at("stepEnd", "stepOutcome"),
    translation: word("refusal.STEP_BAD_OUTCOME") },
  STEP_MACHINE_NO_OUTCOME: { check: "C-142.11", where: at("stepEnd"),
    translation: word("refusal.STEP_MACHINE_NO_OUTCOME") },
  STEP_NOT_ITS_OWN: { check: "C-142.12", where: at("stepStart", "stepEnd", "stepDelete", "stepWait"),
    translation: word("refusal.STEP_NOT_ITS_OWN") },
  STEP_SHARED_NAME_THE_QUESTION: { check: "C-142.13", where: at("stepDelete"),
    translation: word("refusal.STEP_SHARED_NAME_THE_QUESTION") },
  STEP_WORKED_KEEPS_RECORD: { check: "C-142.14", where: at("stepDelete"),
    translation: word("refusal.STEP_WORKED_KEEPS_RECORD") },
  STEP_NARROWER_THAN_QUESTION: { check: "C-142.15", where: at("stepRefer"),
    translation: word("refusal.STEP_NARROWER_THAN_QUESTION") },
  STEP_BAD_PRODUCT: { check: "C-142.16", where: at("stepProduct", "recordProduct"),
    translation: word("refusal.STEP_BAD_PRODUCT") },
  NO_SUCH_PRODUCT: { check: "C-142.17", where: at("stepProduct"),
    translation: word("refusal.NO_SUCH_PRODUCT") },
  STEP_MEMBER_ONLY: { check: "C-142.18", where: at("stepLearn", "stepOutcome", "stepCostAdd", "stepProduct", "questionFollow", "stepAccept", "costMessage", "stepReminder", "stepByWhen"),
    translation: word("refusal.STEP_MEMBER_ONLY") },
  STEP_BAD_TEXT: { check: "C-142.19", where: at("stepLearn", "costMessage", "stepPropose", "stepEnd", "stepAccept"),
    translation: word("refusal.STEP_BAD_TEXT") },
  STEP_BAD_WAIT: { check: "C-142.20", where: at("stepWait"),
    translation: word("refusal.STEP_BAD_WAIT") },
  STEP_WAIT_CYCLE: { check: "C-142.21", where: at("stepWait"),
    translation: word("refusal.STEP_WAIT_CYCLE") },
  STEP_WAIT_NARROWER: { check: "C-142.22", where: at("stepWait"),
    translation: word("refusal.STEP_WAIT_NARROWER") },
  NO_SUCH_WAIT: { check: "C-142.23", where: at("stepWaitRemove"),
    translation: word("refusal.NO_SUCH_WAIT") },
  STEP_BAD_COST: { check: "C-142.24", where: at("stepCostAdd"),
    translation: word("refusal.STEP_BAD_COST") },
  NO_SUCH_COST: { check: "C-142.25", where: at("stepCostRemove"),
    translation: word("refusal.NO_SUCH_COST") },
  STEP_NOT_A_LEG: { check: "C-142.26", where: at("check"),
    translation: word("refusal.STEP_NOT_A_LEG") },
  STEP_BAD_FORM: { check: "C-142.27", where: at("stepAccept"),
    translation: word("refusal.STEP_BAD_FORM") },
  NO_SUCH_STEP_PROPOSAL: { check: "C-142.28", where: at("stepAccept"),
    translation: word("refusal.NO_SUCH_STEP_PROPOSAL") },
  STEP_PROPOSAL_DECIDED: { check: "C-142.29", where: at("stepAccept"),
    translation: word("refusal.STEP_PROPOSAL_DECIDED") },
  STEP_PROPOSE_NOT_A_MACHINE: { check: "C-142.30", where: at("stepPropose"),
    translation: word("refusal.STEP_PROPOSE_NOT_A_MACHINE") },
  STEP_BAD_REMINDER: { check: "C-142.31", where: at("stepReminder"),
    translation: word("refusal.STEP_BAD_REMINDER") },
};
