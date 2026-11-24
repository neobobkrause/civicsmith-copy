/* contradiction: what a candidate IS at a read, derived and never stored (R24, R26, R42). Pure functions over a
   candidate's row, its acts, and its inquiry's link as `inquiry` R48 answers it. Every read and every act asks these,
   so no surface and no act holds a second copy of the rule. */

/** R24's weights. */
export const WEIGHTS = Object.freeze(["lead", "duty", "plurality", "not_shown"]);

/** R26's states. */
export const STATES = Object.freeze(["open", "dismissed", "explained_not_shown", "taken_up", "resolved"]);

/** K5 is shown only once the gate's corpus holds a K5 arm, measured and passing (Satisfies: K5's judgement; DEC-84
 *  item 3; draft-T15 point 5). No measured run exists yet, so every K5 candidate is withheld as `not_shown`, and says
 *  why. The rule for a shown K5 candidate (plurality, then duty after `no_difference`) is written below and reached
 *  the day this is true, in the change that records the measurement. */
export const K5_GATE_MEASURED = false;
export const K5_UNSHOWN_WHY = "k5_gate_unmeasured";

/** K6 (T33-48; K1601): the pinned judgement prompt (R2) names K1–K4 and R3 renders no field of a money side, so a run
 *  judging a K6 pair sees no text. K6 pairs are formed and counted, and every K6 candidate is withheld as `not_shown`,
 *  saying why, until its prompt arm is measured (N579), K5's rule. The day that is true, it is weighted as K4's. */
export const K6_GATE_MEASURED = false;
export const K6_UNSHOWN_WHY = "k6_gate_unmeasured";

/** R24: a candidate's weight from its label and key, and whether a member recorded `no_difference` on it (R34). Never
 *  stored. Answers `{weight, why}`; `why` is null except for a withheld K5 candidate. */
export function weightOf(label, key, noDifference = false) {
  if (label === "precision" || label === "unrelated") return { weight: "not_shown", why: null };
  if (key === "K5") {
    if (!K5_GATE_MEASURED) return { weight: "not_shown", why: K5_UNSHOWN_WHY };
    return { weight: noDifference ? "duty" : "plurality", why: null };
  }
  if (key === "K6" && !K6_GATE_MEASURED) return { weight: "not_shown", why: K6_UNSHOWN_WHY };
  if (label === "world" || label === "undetermined") return { weight: "lead", why: null };
  if (label === "record") return { weight: "duty", why: null };
  return { weight: "not_shown", why: null };
}

/** The families of a resolution kind, as `inquiry` R46 answers them (`resolutionFamily`), read through the function
 *  the caller passes. */
export const CORRECTED = "CORRECTED";
export const DISSOLVED = "DISSOLVED";
export const GENUINE = "GENUINE";

/** R26: the state from the acts (oldest first) and the contradiction inquiry's link (`inquiry` R48's
 *  `contradictionLink`, null when none names the candidate). Answers `{state, kind, by, at, act, inquiry}`: `kind` is
 *  the resolution's kind when resolved, `act` the deciding act row (null when none), `inquiry` the inquiry id when one
 *  names the candidate.
 *
 *  AN INQUIRY OUTRANKS AN INLINE ACT: once taken up, the candidate is the inquiry's, and its conclusion's kind is the
 *  resolution (a reopened inquiry makes it `taken_up` again, since its `resolution` is read only while concluded). With
 *  no inquiry, the latest deciding act says what it is; `no_difference` decides nothing (the candidate stays `open`, at
 *  a weight R24 moves). */
export function stateOf(acts, link, inquiryId = null) {
  if (inquiryId) {
    const res = link && link.resolution && typeof link.resolution === "object" ? link.resolution : null;
    if (res && typeof res.kind === "string")
      return { state: "resolved", kind: res.kind, by: null, at: null, act: null, inquiry: inquiryId, resolution: res };
    return { state: "taken_up", kind: null, by: null, at: null, act: null, inquiry: inquiryId, resolution: null };
  }
  let out = { state: "open", kind: null, by: null, at: null, act: null, inquiry: null, resolution: null };
  for (const a of acts || []) {
    if (a.act === "dismiss") out = { ...out, state: "dismissed", kind: null, by: a.author, at: a.at, act: a };
    else if (a.act === "clarify" && a.choice === "one_wrong")
      out = { ...out, state: "resolved", kind: "corrected", by: a.author, at: a.at, act: a };
    else if (a.act === "clarify" && a.choice === "differs")
      out = (a.evidence && a.evidence.length)
        ? { ...out, state: "resolved", kind: "dissolved", by: a.author, at: a.at, act: a }
        : { ...out, state: "explained_not_shown", kind: null, by: a.author, at: a.at, act: a };
  }
  return out;
}

/** R31's closed states: nothing more is decided on the candidate inline. */
export const isClosed = (state) => state === "dismissed" || state === "resolved";

/** R49: a conflict between projects is a duty or a plurality still standing. */
export const isProjectConflict = (weight, state) =>
  (weight === "duty" || weight === "plurality")
  && (state === "open" || state === "explained_not_shown" || state === "taken_up");

/** R37: a recommendation stands while its candidate is open or explained. */
export const isStanding = (state) => state === "open" || state === "explained_not_shown";
