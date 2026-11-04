/* screens-inquiry (T46-58; N897 (1), (2); N919; T47-61; T49-25): the investigation's working screens, a project's home,
 * one question, one captured document and the assistant's panel beside them (T53: the project's own AI account is
 * `screens-ai`'s `aiproject`, R153). Pure:
 * every read and act is an op the plane serves, called from the browser through `interface-shell`'s kit (its R21's
 * screen contract, K2996, K2998). Every sentence is a `words.json` word read by key (R44; `setup-words` R11–R13): the
 * module holds keys only. Requirements: `build/requirements/screens-inquiry.md`. */

import { COMMON } from "./common.mjs";
import { projectScreen } from "./project.mjs";
import { dashProjectScreen } from "./dashproject.mjs";
import { questionScreen } from "./question.mjs";
import { documentScreen } from "./document.mjs";
import { ASSISTANT_SCREEN, MODE_BOUNDS, REFUSALS, WITHHELD } from "./assistant.mjs";
import { CONTRADICTION_SCREEN } from "./contradiction.mjs";
import { objectiveScreen } from "./objective.mjs";

/** interface-shell R5's own rows: none since R44 (every word is `words.json`'s, through setup-words). */
export const SCREEN_WORDS = Object.freeze([]);

/** interface-shell R21: the registry screens this module draws, `project`, `dash-project` (R79), `question`, `document`, `assistant`
 *  (`projectai` retired with R14: the project page links `aiproject`, R153), `objective` and `contradiction`, each with the readers it shares (common.mjs) as its parts; the question's "Ask the assistant
 *  to look" opens its run with the dock's bounds (R33, R41). */
export const SCREENS = Object.freeze([projectScreen(COMMON), dashProjectScreen(COMMON), questionScreen(Object.freeze({ ...COMMON, bounds: MODE_BOUNDS, refusals: REFUSALS, withheld: WITHHELD })),
  documentScreen(COMMON), ASSISTANT_SCREEN, objectiveScreen(COMMON), CONTRADICTION_SCREEN]);
