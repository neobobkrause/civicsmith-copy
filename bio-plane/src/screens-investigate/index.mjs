/* screens-investigate (T47-62; N897 (1); N719, N728, N735; DEC-200, DEC-203): the investigation's tools beside a question,
 * the People directory and the help page "How spot-checks work". Pure: every read and act is an op the plane serves,
 * called from the browser through `interface-shell`'s kit (its R21's screen contract). Requirements:
 * `build/requirements/screens-investigate.md`. */

import { PEOPLE_SCREEN } from "./people.mjs";
import { PERSON_SCREEN } from "./person.mjs";
import { EXPLORE_SCREEN } from "./explore.mjs";
import { TIMELINE_SCREEN } from "./timeline.mjs";
import { MONEY_SCREEN } from "./money.mjs";
import { CALCULATION_SCREEN, HELP_SCREEN } from "./calculation.mjs";
import { PROCEEDING_SCREEN } from "./proceeding.mjs";
import { DUE_DATE_SCREEN } from "./due-date.mjs";
import { STANDARD_SCREEN } from "./standard.mjs";
import { TIES_SCREEN } from "./ties.mjs";
import { THEME_SCREEN } from "./theme.mjs";

/**
 * One screen under `interface-shell` R21's screen contract: its registry id, the reads it asks for, how it draws, the acts
 * it sends, every word key it draws, and the shared readers it is handed.
 * @typedef {Object} Screen
 * @property {string} id the registry screen's id
 * @property {Function} reads answers the reads the screen asks for, each an op with its query
 * @property {Function} render draws the screen with the kit `cs` over the view, answering HTML
 * @property {Array<Object>} acts each act's op, label key and the body it sends, or the refusal it draws in place
 * @property {Array<string>} words every word key the screen draws, each read through `setup-words`
 * @property {Object} [parts] the shared readers the screen is handed
 */
/**
 * interface-shell R21: the twelve registry screens this module draws.
 * @type {ReadonlyArray<Screen>}
 */
export const SCREENS = Object.freeze([PEOPLE_SCREEN, PERSON_SCREEN, EXPLORE_SCREEN, TIMELINE_SCREEN, MONEY_SCREEN, CALCULATION_SCREEN,
  HELP_SCREEN, PROCEEDING_SCREEN, DUE_DATE_SCREEN, STANDARD_SCREEN, TIES_SCREEN, THEME_SCREEN]);
