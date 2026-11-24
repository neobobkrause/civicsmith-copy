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

/** interface-shell R21: the twelve registry screens this module draws. */
export const SCREENS = Object.freeze([PEOPLE_SCREEN, PERSON_SCREEN, EXPLORE_SCREEN, TIMELINE_SCREEN, MONEY_SCREEN, CALCULATION_SCREEN,
  HELP_SCREEN, PROCEEDING_SCREEN, DUE_DATE_SCREEN, STANDARD_SCREEN, TIES_SCREEN, THEME_SCREEN]);
