/* screens-publish (T47-63; N897 (1); N683, N757, N788; DEC-78, DEC-96, DEC-100, DEC-112, DEC-116, DEC-147, DEC-180,
 * DEC-181, DEC-183, DEC-201 (8), DEC-207, DEC-208, DEC-210): from a case's draft to its public page, and what comes in
 * from outside. The registry screens `case-editor`, `review-copy`, `ceremony`, `published`, `imported`, `docket`,
 * `docket-public`, `doorbell` and `review-outside`, built to interface-shell R21's screen contract: each `{id, reads, render, acts,
 * words}`, every function self-contained, every read and act an op through the shell. Pure: this module reads no table
 * and writes nothing, and holds no member-facing English: its screens' words are keys (`keys.mjs`, R24) that `setup-words`
 * answers. Requirements: `build/requirements/screens-publish.md`. */
import { SCREEN_KEYS } from "./keys.mjs";
import { CASE_EDITOR } from "./case-editor.mjs";
import { REVIEW_COPY } from "./review-copy.mjs";
import { CEREMONY } from "./ceremony.mjs";
import { PUBLISHED } from "./published.mjs";
import { IMPORTED } from "./imported.mjs";
import { DOCKET } from "./docket.mjs";
import { DOCKET_PUBLIC } from "./docket-public.mjs";
import { DOORBELL } from "./doorbell.mjs";
import { REVIEW_OUTSIDE } from "./review-outside.mjs";

/** R24 (K3366): the module holds no sentence of its own, so it has no rows of its own: every word is a key of `setup-words`. */
export const SCREEN_WORDS = Object.freeze([]);
export { SCREEN_KEYS };

/** interface-shell R21, R28: the nine screens, in the order a case travels (prepare, review, publish, read, import, the
 *  docket, the docket from outside, and the two doors from outside). Each screen's `words` is its keys (R24). */
export const SCREENS = Object.freeze([CASE_EDITOR, REVIEW_COPY, CEREMONY, PUBLISHED, IMPORTED, DOCKET, DOCKET_PUBLIC, DOORBELL, REVIEW_OUTSIDE]
  .map((s) => Object.freeze({ ...s, words: SCREEN_KEYS[s.id] })));
