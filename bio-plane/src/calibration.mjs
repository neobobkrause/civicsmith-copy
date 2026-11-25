/* CPDF-13 — THE CALIBRATION CONSTRUCT (D-183, D-253).
 *
 * A CALIBRATION IS A DATED, IDENTIFIED FIDELITY MEASUREMENT OF A NAMED
 * DERIVATION ENGINE AND VERSION, STORED WITH THE PROBE INPUTS AND THE SCORES
 * THAT PRODUCED IT.
 *
 * This module is that construct and — exactly as `textchain.mjs` holds no
 * engine — it holds NO ENGINE, NO PROBE CORPUS AND NO MEASURED NUMBER. It knows
 * what a measurement must carry to be one, how two measurements of the same
 * engine COMPARE, and what each direction of that comparison is allowed to
 * cause. The day an engine is calibratable in this instance, the honesty rules
 * are already built, already driven, and already refusing.
 *
 * ===================================================================== *
 * WHY THE CONSTRUCT IS ENGINE-GENERIC, WHICH IS THE ITEM'S FIRST WORD
 * ===================================================================== *
 *
 * D-183 was raised about Moondream. CPDF-11 then returned NO-GO on Moondream
 * (DEC-42: it could not answer coordinates), so the engine that provoked this
 * is not the engine that will first use it — and that is the argument, not an
 * inconvenience. THREE engines have one problem and D-164's lesson is to solve
 * it once rather than three times after the fact:
 *
 *   - TIER-2 pdf.js has a PINNED VERSION THAT WILL MOVE. It needs this today.
 *   - A TEXT LAYER names a third party's engine in its own /Info (D-251, and
 *     CPDF-9 measured ABBYY FineReader in 3 of 14 recent Legistar attachments).
 *     Nothing here measured it, and `null` says so.
 *   - AN EXTERNAL SERVICE RETRAINS UNDER AN UNCHANGED NAME — DEC-35's own
 *     argument against Textract, and the reason a version string alone is not
 *     a fingerprint.
 *
 * So nothing below tests an engine name against a literal, and nothing below
 * knows what a good score is. A SCORE IS A NUMBER THE PROBE PRODUCED; a CAP is
 * a letter from `BASIS_GRADES`, the one vocabulary this project has.
 *
 * ===================================================================== *
 * THE FOUR RULES, each a refusal below and an arm in the suite
 * ===================================================================== *
 *
 * 1. A CALIBRATION IS A MEASUREMENT, NEVER A CLAIM. It carries the probe that
 *    ran, the inputs that probe was given, and the scores that came back. A
 *    calibration with no probe run is REFUSED (`CAL_NO_PROBE`), and the refusal
 *    names the rule rather than the field: a vendor's changelog, a release
 *    note, a model card and a version bump are all CLAIMS, and CLAUDE.md ranks
 *    a claim below a measurement everywhere else in this system too.
 *
 *    THIS IS THE RULE THE ANNOUNCEMENT WATCH EXISTS UNDER, and it is why the
 *    watch can only ever accelerate. See rule 4.
 *
 * 2. THE DRIFT HANDLER IS ASYMMETRIC, and this is the half a build session
 *    would not derive (D-183 says so in as many words). A calibration that
 *    measures WORSE means every leg resting on the old cap now OVERCLAIMS, so
 *    it raises a RE-EVALUATION OBLIGATION naming exactly the transcriptions
 *    bound to the superseded measurement — and RE-GRADES NOTHING. A calibration
 *    that measures BETTER raises NOTHING AT ALL, because a grade rises only by
 *    an authored act (DEC-4: no machine mints a grade).
 *
 *    SILENT RE-GRADING IN EITHER DIRECTION IS THE DEFECT. Not one direction.
 *    Both. An automatic downgrade is a machine minting a grade just as much as
 *    an automatic upgrade is, and it would ALSO be wrong on the facts: what a
 *    worse calibration establishes is that the engine's output is worth less
 *    than the record says, which is a reason for a MEMBER to look at those
 *    transcriptions, not a new letter to stamp on them. The obligation names
 *    them; a person decides.
 *
 * 3. THE OBLIGATION IS DERIVED, NEVER STORED — REC-17's shape, and for REC-17's
 *    two reasons exactly. A stored "needs re-evaluation" bit goes stale in BOTH
 *    directions (still set after the member looked; still clear after the
 *    engine moved again), and the member decides rather than the plane. So
 *    the obligation is `extraction`'s, derived on read from `drifted` and the
 *    supersessions this module provides, and written nowhere (K73 (7), K136).
 *
 * 4. AN ANNOUNCEMENT WATCH MAY ONLY SHORTEN THE INTERVAL TO THE NEXT PROBE.
 *    It may never stand IN for one, and it may never itself change a grade.
 *    `nextProbeDue` takes the signals and can only ever return an instant at or
 *    BEFORE the cadence's own — never after — and that direction is computed
 *    here rather than trusted, because the plausible mistake is a well-meaning
 *    "no announcement, so nothing changed, so push the probe out". ABSENCE OF
 *    AN ANNOUNCEMENT IS NOT EVIDENCE OF NO CHANGE. A silent retrain under an
 *    unchanged version string is the exact failure DEC-35 named.
 *
 * ===================================================================== *
 * THE CADENCE, AND WHAT IT COSTS THE GROUP THAT INSTALLS THIS
 * ===================================================================== *
 *
 * `CALIBRATION_CADENCE_MS` is THIRTY DAYS, and it is a DECLARED CONSTANT
 * REVISABLE BY MEASUREMENT rather than a tuning knob: nobody has yet measured
 * how fast a derivation engine actually drifts, so monthly is a CHOSEN starting
 * point, recorded as chosen. When somebody measures the real drift interval,
 * this number moves and the reason moves with it.
 *
 * WHAT IT COSTS, stated here and in SCHEDULER.md so no group discovers it as a
 * surprise: ONE PROBE PER ENGINE PER CADENCE, on the INSTANCE'S OWN ACCOUNT,
 * against the free allocation. Not one per document, not one per capture, and
 * not a vendor account — the distribution model puts a sovereign instance in
 * each group's own Cloudflare account (D-115's class), so a calibration that
 * needed somebody else's key would not be a capability this project can ship.
 *
 * AND THE CONSUMER SELF-TERMINATES. An instance with no calibratable engine
 * registered holds NO ALARM AT ALL — `wake` is null — which is the property
 * REC-1 prized and the one the Free tier the installer targets is paid for. An
 * idle instance's cost for this feature is exactly zero.
 */

/* The module's own refusal rows (C-42, moved from the catalogue at T5-1) and the grade
   vocabulary, which is record-grammar's (its R16). */
import { BASIS_GRADES } from "./record-grammar/index.mjs";
import { CALIBRATION_CHECKS } from "./calibration/checks.mjs";
import { word, localize } from "./setup-words/index.mjs";

/* ------------------------------------------------------------------ *
 * The declared constants
 * ------------------------------------------------------------------ */

/** THE CADENCE. Thirty days, CHOSEN and recorded as chosen (see the header).
 *  One home: the store's consumer reads this, the suite reads this, and
 *  SCHEDULER.md quotes it by name rather than re-typing the number — the
 *  hand-carried-number failure is this project's most-repeated finding. */
export const CALIBRATION_CADENCE_MS = 30 * 24 * 60 * 60 * 1000;

/** The human name for the cadence, composed FROM the constant so it cannot
 *  drift from it. A sentence that disagrees with the number beside it is the
 *  same defect one altitude up. */
export function cadenceSentence(ms = CALIBRATION_CADENCE_MS) {
  const days = ms / (24 * 60 * 60 * 1000);
  return word("calibration.probe_per_calibratable", { days: String(Number.isInteger(days) ? days : days.toFixed(2)) });
}

/** The verdicts `compare` can return. Named rather than spelled, because every
 *  rule below asks which one it got and a literal in three places is three
 *  places to get it wrong. */
export const DRIFT = { WORSE: "worse", BETTER: "better", SAME: "same", INCOMPARABLE: "incomparable" };

/** What a probe must name about itself. A probe id and a corpus digest: the id
 *  says WHICH probe, the digest says WHICH INPUTS — because "we ran the probe"
 *  against a quietly changed corpus is two measurements wearing one name, and
 *  the whole point of storing the inputs is that a later reader can tell. */
export const PROBE_REQUIRED = ["probe_id", "probe_inputs", "scores"];

/* ------------------------------------------------------------------ *
 * Refusals — DEC-49. One row per condition in CALIBRATION_CHECKS, the code a
 * STRING LITERAL at its site, so the guard can see it.
 * ------------------------------------------------------------------ */

function refusal(key, detail) {
  const row = CALIBRATION_CHECKS[key];
  return { ok: false, code: key, check: row.check, translation: row.translation, detail };
}

/* A grade's STRENGTH is its position in BASIS_GRADES (A strongest at index 0),
   so WEAKER is a HIGHER index. Read from the imported array rather than written
   down, so the letters have exactly one home — `textchain.mjs`'s own reasoning,
   and the reason a fifth letter would need no edit here either. */
function rank(letter) {
  const i = BASIS_GRADES.indexOf(letter);
  return i < 0 ? null : i;
}

/* ------------------------------------------------------------------ *
 * Rule 1 — a calibration is a measurement
 * ------------------------------------------------------------------ */

/** Is this a well-formed calibration? Returns a refusal or null.
 *
 *  THE SHAPE:
 *
 *      { calibration_id: "CAL-7",
 *        engine: "<name>", version: "<version>",   // what was measured
 *        at: "<ISO date>",                         // WHEN it was measured
 *        cap: "A"|"B"|"C"|"D"|null,                // the fidelity it supports
 *        probe_id: "<which probe>",                // rule 1
 *        probe_inputs: { ... },                    // rule 1 — what it was given
 *        scores: { ... },                          // rule 1 — what came back
 *        measured_by: "<who ran it>" }
 *
 *  `cap: null` IS LEGAL AND IS NOT A GAP. A probe that ran and could not
 *  establish a fidelity letter measured something real — that the engine's
 *  fidelity is UNDETERMINED — and recording it is strictly better than
 *  recording nothing, because it is DATED: a later reader knows somebody looked
 *  and when. What is refused is a calibration with no probe behind it at all. */
export function checkCalibration(cal) {
  /* DEC-49 REGION is-calibration-shape */
  const c = cal && typeof cal === "object" && !Array.isArray(cal) ? cal : null;
  if (!c)
    return refusal("CAL_SHAPE", localize("calibration.calibration.a_calibration_is_an_object", "a calibration is an object; got {v1}", { v1: String(cal === null ? "null" : typeof cal) }));
  if (!(typeof c.engine === "string" && c.engine.trim()) || !(typeof c.version === "string" && c.version.trim()))
    return refusal("CAL_UNNAMED",
      localize("calibration.calibration.a_calibration_names_the_engine", "a calibration names the ENGINE and the VERSION it measured. A measurement of \"the OCR\" is a measurement of nothing re-runnable: an external service retrains under an unchanged name (DEC-35's own argument against Textract), which is exactly why the pair is required and why neither half is enough alone"));
  if (!(typeof c.at === "string" && c.at.trim()))
    return refusal("CAL_UNDATED",
      localize("calibration.calibration.a_calibration_carries_the_date", "a calibration carries the date the probe RAN. A fidelity letter is a fact about an engine AT A DATE, and an undated one cannot be superseded, cannot be compared, and cannot tell a reader whether anybody has looked recently"));
  if (c.cap != null && rank(c.cap) == null)
    return refusal("CAL_SHAPE",
      localize("calibration.calibration.cap_string_is_not_one", "cap '{String}' is not one of {BASIS_GRADES}, and a calibration does not invent a scale of its own — transcription fidelity bounds the capture axis and there is no third one (DEC-4)", { String: String(String(c.cap)), BASIS_GRADES: String(BASIS_GRADES.join(", ")) }));
  /* RULE 1, and the three fields are checked TOGETHER because they are one
     fact: a probe ran, over these inputs, and produced these scores. */
  for (const field of PROBE_REQUIRED) {
    const v = c[field];
    const present = typeof v === "string" ? v.trim().length > 0
                  : (v != null && typeof v === "object" ? Object.keys(v).length > 0 : false);
    if (!present)
      return refusal("CAL_NO_PROBE",
        localize("calibration.calibration.this_calibration_carries_no_field", "this calibration carries no {field}, so no probe run stands behind it. A CALIBRATION IS A MEASUREMENT, NEVER A CLAIM: a changelog, a release note, a model card and a version bump all say an engine changed, and none of them says what it now scores. The record stores the probe, its inputs and its scores precisely so a later reader can disagree with the letter", { field: String(field) }));
  }
  /* D-668 / D-587 (R5): its own code. A calibration whose probe, inputs and scores are all present
     WAS measured, and C-42.4's "Nothing here was actually measured" was false of it (DEC-49, D-484).
     At the store's door `measured_by` is the control plane's stamp of the caller, never the body's. */
  if (!(typeof c.measured_by === "string" && c.measured_by.trim()))
    return refusal("CAL_UNATTRIBUTED",
      localize("calibration.calibration.a_calibration_names_who_ran", "a calibration names who ran the probe. An unattributed measurement is one nobody can ask to be re-run"));
  /* END DEC-49 REGION is-calibration-shape */
  return null;
}

/* ------------------------------------------------------------------ *
 * Rule 2 — the comparison, and the asymmetry that hangs off it
 * ------------------------------------------------------------------ */

/** Compare a NEW calibration against the one it supersedes. Returns a DRIFT
 *  verdict and never throws.
 *
 *  THE COMPARISON IS ON THE CAP, NOT ON THE SCORES, and that is a decision
 *  rather than a simplification. A score is whatever the probe emitted — a
 *  character error rate, an F1, a count of minted digits — and it has no
 *  cross-probe meaning at all; the CAP is the only thing on a scale this record
 *  already uses and the only thing a grade ever rested on. Comparing raw scores
 *  would mean this module knowing what each probe's numbers mean, which is the
 *  engine knowledge it exists not to hold.
 *
 *  UNDETERMINED IS NOT A LETTER AND DOES NOT SORT. A cap going from `C` to
 *  `null` is not "worse by one"; it is the record losing its bound entirely.
 *  It is reported as WORSE — because a leg resting on `C` does now overclaim —
 *  and the direction from `null` to a letter is BETTER for the mirror-image
 *  reason. Two nulls are the SAME: nothing was bounded before and nothing is
 *  now, and raising an obligation for that would be raising one every cadence
 *  for ever on an engine nobody has managed to measure. */
export function compare(next, prev) {
  if (checkCalibration(next)) return DRIFT.INCOMPARABLE;
  if (prev == null) return DRIFT.SAME;          /* the FIRST calibration drifts from nothing */
  if (checkCalibration(prev)) return DRIFT.INCOMPARABLE;
  /* A calibration of a DIFFERENT engine is not a supersession of this one. The
     caller is expected to have matched them; this refuses to compare anyway,
     because an accidental cross-engine comparison would raise an obligation
     naming transcriptions that have nothing to do with the measurement. */
  if (next.engine !== prev.engine) return DRIFT.INCOMPARABLE;
  const rn = next.cap == null ? null : rank(next.cap);
  const rp = prev.cap == null ? null : rank(prev.cap);
  if (rn == null && rp == null) return DRIFT.SAME;
  if (rn == null) return DRIFT.WORSE;           /* a bound was lost */
  if (rp == null) return DRIFT.BETTER;          /* a bound was gained */
  if (rn === rp) return DRIFT.SAME;
  return rn > rp ? DRIFT.WORSE : DRIFT.BETTER;  /* higher index = weaker letter */
}

/** WHAT A DRIFT VERDICT IS ALLOWED TO CAUSE. This is rule 2 stated as a
 *  function so that nothing anywhere has to remember it, and so a caller that
 *  tried to re-grade would have to go around a value that says it may not.
 *
 *  `regrades` IS `false` ON EVERY BRANCH AND HAS NO PARAMETER THAT COULD MAKE
 *  IT TRUE. That is not decoration: the negative control for this item arms by
 *  making the drift handler re-grade, and a boolean that could be flipped by an
 *  argument is a boolean a caller can flip by accident. The field exists so the
 *  suite can assert on it by name rather than by inferring it from a store
 *  read — an absence proves nothing about whether the rule is enforced. */
export function drifted(verdict) {
  switch (verdict) {
    case DRIFT.WORSE:
      return { verdict, raises_obligation: true, regrades: false,
               why: localize("calibration.calibration.this_engine_now_measures_worse", "this engine now measures WORSE than the calibration these transcriptions were graded under, so legs resting on the old cap OVERCLAIM. The record names exactly which transcriptions those are and changes none of them: what a worse measurement establishes is a reason for a member to look, not a new letter to stamp (DEC-4, no machine mints a grade)") };
    case DRIFT.BETTER:
      return { verdict, raises_obligation: false, regrades: false,
               why: localize("calibration.calibration.this_engine_now_measures_better", "this engine now measures BETTER. Nothing is raised and nothing moves: a grade rises only by an authored act, so an automatic upgrade here would be your team's Civicsmith making a claim nobody authored (DEC-4)") };
    case DRIFT.SAME:
      return { verdict, raises_obligation: false, regrades: false,
               why: word("calibration.why.measurement_agrees_supersedes") };
    default:
      return { verdict: DRIFT.INCOMPARABLE, raises_obligation: false, regrades: false,
               why: word("calibration.why.two_measurements_cannot") };
  }
}

/* ------------------------------------------------------------------ *
 * Rule 4 — the announcement watch, which may only ACCELERATE
 * ------------------------------------------------------------------ */

/** When is the next probe due for one engine?
 *
 *  `lastAt` is the instant the last probe RAN (never the instant a changelog
 *  said something). `signals` are announcement-watch observations, each with
 *  its own `probe_by` instant.
 *
 *  THE RETURN CAN ONLY EVER BE AT OR BEFORE `lastAt + cadence`. That is
 *  computed with a `Math.min` over the cadence's own instant, so a signal
 *  asking to push the probe OUT is not merely ignored by convention — there is
 *  no arithmetic here that can produce a later answer. Rule 4's second half
 *  ("it may never stand IN for a probe") is enforced elsewhere by construction:
 *  a signal is not a calibration, `checkCalibration` refuses anything without a
 *  probe run, and nothing in this module reads a signal when computing a cap.
 *
 *  A NEVER-PROBED ENGINE IS DUE NOW, not one cadence from now. An engine whose
 *  fidelity nothing has ever measured is the case with the LEAST standing to
 *  wait, and defaulting it to a cadence away would mean a newly registered
 *  engine sits unmeasured for a month while the record grades against it. */
export function nextProbeDue({ lastAt = null, signals = [], cadenceMs = CALIBRATION_CADENCE_MS } = {}) {
  if (!Number.isFinite(lastAt)) return { at: 0, from: "never-probed",
    why: word("calibration.why.nothing_probed_engine") };
  const cadenceAt = lastAt + cadenceMs;
  let at = cadenceAt, from = "cadence";
  for (const s of (Array.isArray(signals) ? signals : [])) {
    const by = s && Number.isFinite(s.probe_by) ? s.probe_by : null;
    if (by == null) continue;
    /* ONLY EARLIER. The comparison is written as a strict "is this sooner",
       rather than as an assignment guarded by a later check, so the only way a
       signal moves this instant is by pulling it in. */
    if (by < at) { at = by; from = "signal"; }
  }
  /* The floor, stated rather than assumed: even a signal claiming the year 1970
     cannot move the answer earlier than "now, immediately", and even a signal
     claiming the year 3000 cannot move it later than the cadence. */
  return { at: Math.min(at, cadenceAt), from,
           cadence_at: cadenceAt,
           why: from === "signal"
             ? word("calibration.why.announcement_shortened_interval")
             : word("calibration.why.declared_cadence", { cadence_ms: String(cadenceSentence(cadenceMs)) }) };
}

/** Is this announcement signal well-formed, and is it asking for something a
 *  watch is allowed to ask for? The ONE refusal here is the one that matters:
 *  a signal that claims to BE a measurement. */
export function checkSignal(sig) {
  /* DEC-49 REGION is-calibration-signal */
  const s = sig && typeof sig === "object" && !Array.isArray(sig) ? sig : null;
  if (!s) return refusal("CAL_SIGNAL_SHAPE", localize("calibration.calibration.an_announcement_signal_is_an", "an announcement signal is an object"));
  if (!(typeof s.engine === "string" && s.engine.trim()))
    return refusal("CAL_SIGNAL_SHAPE", localize("calibration.calibration.an_announcement_signal_names_the", "an announcement signal names the engine it is about"));
  if (!(typeof s.source === "string" && s.source.trim()))
    return refusal("CAL_SIGNAL_SHAPE",
      localize("calibration.calibration.an_announcement_signal_names_where", "an announcement signal names WHERE it was observed. It is somebody else's statement about their own product and the record keeps it as that"));
  /* THE RULE, and it is refused at the door rather than sanitised quietly: a
     signal that carries a cap is a signal trying to be a calibration. */
  if (s.cap !== undefined || s.scores !== undefined)
    return refusal("CAL_SIGNAL_CLAIMS_MEASUREMENT",
      localize("calibration.calibration.this_announcement_carries_a_fidelity", "this announcement carries a fidelity (cap or scores). A VENDOR'S DOCUMENTATION IS A CLAIM, NOT A MEASUREMENT: an announcement may SHORTEN the interval to the next probe and may do nothing else — it may never stand in for a probe, and it may never itself set or change a grade. Record the announcement, then run the probe"));
  /* END DEC-49 REGION is-calibration-signal */
  return null;
}
