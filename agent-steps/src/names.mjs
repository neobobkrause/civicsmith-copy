/* agent-steps — the names the steps and the shell share, declared once (R48; moved from `agent-worker`'s `ops.mjs`). */
/* Requirement ids in the comments below are `agent-worker`'s, as they stood when this code moved (T51, K3850); `build/requirements/agent-steps.md` maps them to this module's. */

/** R78 — A RE-EXAMINATION RUN'S `response` (ai-runs R77, stored verbatim; written by `plan-work` R10 from `actions`
 *  R95's `{action, ord}`): `<action>#<ord>`, the action's id and the entry's place in its correspondence ledger. */
export const RESPONSE_ID = /^(.{1,200})#(0|[1-9][0-9]{0,5})$/s;

/** THE MEANING ARM THIS MEMBER READS AT (D-276). `op=meaningrows` chooses no arm for a caller (C-23.1), so the arm is
 *  declared: `leg`, one row per leg of an inquiry's basis, which is what a run that forms versions of a basis composes
 *  against. The plural `legs` is an arm the plane does not hold and was refused C-23.2. */
export const MEANING_ARM = "leg";


/* R91 (R085-8; K3477; `ai-runs` R84; BOB's B2, B3) — HOW A SEGMENT ENDED, as its last `op=airuntick` states it in
 * `segment_end: {by, done, refusals, error?}`: `by` the run's end by the table's close or the plane's own exit (`done:
 * true`, R28's `ended.by`), a refusal (the plane's or the model's, its code in `refusals`) or an error (its code in
 * `error`, `SEGMENT_THREW` for a throw); `by` is null when the segment met one of its own bounds (turns, bytes, its wall
 * time or `max_steps`) while the run goes on. */
export const SEGMENT_END_BY = Object.freeze({
  table: "the table",
  plane: "the plane's own exit",
  refusal: "a refusal",
  error: "an error",
  /* R48, R52 (T53; AIR28): a segment ended at a step boundary by an AI stop, the run left resumable */
  ai: "an AI stop",
});
