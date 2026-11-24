/* answers' refusal rows (requirements: `build/requirements/answers.md`, R24). DEC-49: every refusal this module answers
 * carries its code, its row and the member's translation. A new module: its rows are a new family, C-135 (the next free
 * after hypotheses' C-134; B3, K1607), awaiting promotion's stamp (row-census, plan T33 Rules (9)); a change to any row moves
 * `CATALOG_VERSION` at that stamp (rule 17). `NOT_AN_ADMIN` is membership's (its R84) and the saved-query refusals are
 * query-language's (its R30): answered through them, never minted here. No translation names a place (R25). */

import { word, localize } from "../setup-words/index.mjs";

const at = (fn, region) => `src/answers/${fn} > ${region}`;
const row = (n, fn, region, translation) => Object.freeze({ check: `C-135.${n}`, where: at(fn, region), translation });

export const ANSWERS_CHECKS = Object.freeze({
  ANSWER_MALFORMED: row(1, "check.mjs checkAnswer", "is-answer-shape",
    localize("answers.checks.the_assistants_answer_was_not", "The assistant's answer was not in the form every answer must take, so none of it is shown. Ask again; nothing was changed.")),
  ANSWER_CITES_UNREAD: row(2, "check.mjs checkAnswer", "is-holding-read",
    word("refusal.ANSWER_CITES_UNREAD")),
  ANSWER_FIGURE_UNSOURCED: row(3, "check.mjs checkAnswer", "is-figure-sourced",
    word("refusal.ANSWER_FIGURE_UNSOURCED")),
  ANSWER_RULE_NOT_PLANE: row(4, "check.mjs checkAnswer", "is-rule-plane",
    word("refusal.ANSWER_RULE_NOT_PLANE")),
  ANSWER_ABSENCE_WITHOUT_LEVEL: row(5, "check.mjs checkAnswer", "is-absence-level",
    word("refusal.ANSWER_ABSENCE_WITHOUT_LEVEL")),
  RULE_SERVICE_UNKNOWN: row(6, "rules.mjs ruleAnswer", "is-rule-service",
    word("refusal.RULE_SERVICE_UNKNOWN")),
  RULE_SERVICE_EXISTS: row(7, "rules.mjs registerRuleService", "is-rule-service-new",
    word("refusal.RULE_SERVICE_EXISTS")),
  RULE_SERVICES_OFF: row(8, "rules.mjs ruleAnswer", "is-rule-services-on",
    word("refusal.RULE_SERVICES_OFF")),
  MACHINE_CANNOT_AUTHOR: row(9, "standing.mjs standingQuestionSet", "is-standing-member",
    word("refusal.MACHINE_CANNOT_AUTHOR")),
  BAD_CADENCE: row(10, "standing.mjs standingQuestionSet", "is-standing-cadence",
    word("refusal.BAD_CADENCE")),
  STANDING_NEEDS_END: row(11, "standing.mjs standingQuestionSet", "is-standing-end",
    word("refusal.STANDING_NEEDS_END")),
  NO_SUCH_STANDING_QUESTION: row(12, "standing.mjs", "is-standing-yours",
    word("refusal.NO_SUCH_STANDING_QUESTION")),
  STANDING_NEEDS_SEARCH: row(13, "standing.mjs standingQuestionSet", "is-standing-search",
    word("refusal.STANDING_NEEDS_SEARCH")),
  ANSWER_VERDICT_WORD: row(14, "sentences.mjs checkSentences", "is-no-verdict-word",
    word("refusal.ANSWER_VERDICT_WORD")),
  ANSWER_CAUSE_UNESTABLISHED: row(15, "sentences.mjs checkSentences", "is-cause-established",
    word("refusal.ANSWER_CAUSE_UNESTABLISHED")),
  STANDING_ENDED: row(16, "standing.mjs standingQuestionEndSet", "is-standing-open",
    word("refusal.STANDING_ENDED")),
});

/** The row's fields beside a refusal: `{ok: false, reason, code, check, translation, detail, ...extra}`. */
export function refusal(code, detail, extra = {}) {
  const r = ANSWERS_CHECKS[code];
  return { ok: false, reason: code, code, check: r ? r.check : null, translation: r ? r.translation : null, detail,
           ...extra };
}
