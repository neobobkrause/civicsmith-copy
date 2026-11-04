/* R19 as amended (T41-21; D11, D14; K2405, K2418) — THE TEST BAR. An AI part (each mode, the explorer's use, each draft
 * kind, transcription and reading) is deployable only when a well-formed `ai-runs` R75 record is held that it passed its
 * bar on Civicsmith's test investigations (`./test-set.mjs`), besides R19's verification chain (`./deployment.mjs`
 * `deployable`). This module holds no record: `ai-runs` writes them (its R75 `testBarRecord`) and hands the ones it
 * holds to `testBarHeld` and `partDeployable`, so the bar, like the chain, is the record's and never a parameter a caller
 * sets. R29 (T46) adds the test-instance exception below: `partAdmittedOn` is the one gate every door asks, and
 * `partRefusal` (R30) its refusal. Pure; never throws. */
import { AI_RUN_OWN_CHECKS } from "./checks.mjs";
import { DEPLOYMENT_SEQUENCE, ASK_MODE, ENQUIRE_MODE, DRAFT_KINDS, deployable } from "./deployment.mjs";
import { CIVICSMITH_TEST_SET } from "./test-set.mjs";

/** The AI parts the bar is held for, each by the name an R75 record carries: the run modes of the order; the
 *  interactive modes `ask` and `enquire`; `explore`, the explorer's use (`question-explorer`); each draft kind as
 *  `draft:<kind>` (a draft is measured per kind, since each reads and writes differently); `transcribe` and `read`
 *  (`credentials` R55's use kinds for transcription and reading inside documents). Frozen. */
export const TEST_BAR_PARTS = Object.freeze([
  ...DEPLOYMENT_SEQUENCE.order, ASK_MODE.mode, ENQUIRE_MODE.mode, "explore",
  ...DRAFT_KINDS.map((k) => `draft:${k}`), "transcribe", "read",
]);

/** `ai-runs` R75's record, the shape this module judges. */
export const TEST_BAR_RECORD = Object.freeze({
  fields: Object.freeze(["part", "set", "set_version", "false_alarm_rate", "passed", "graded_by", "at"]),
  means: Object.freeze({
    part: "the AI part tested, one of TEST_BAR_PARTS",
    set: "the set of test investigations it was graded on",
    set_version: "the version of that set, a whole number of one or more",
    false_alarm_rate: "how often it raised a false alarm on that set, from 0 to 1",
    passed: "whether it passed its bar there, true or false",
    graded_by: "who or what graded it",
    at: "when it was graded",
  }),
  /* R19 (T53; N1258): R75's records are kept per entry, so a record may name the AI it measured. */
  optional: Object.freeze(["entry_id"]),
  optional_means: Object.freeze({ entry_id: "the catalogue entry (the AI) it measured, when it measured one" }),
});

const blank = (v) => typeof v !== "string" || v.trim() === "";

function unfit(field, detail) {
  const row = AI_RUN_OWN_CHECKS.AI_TEST_BAR_UNFIT;
  return { ok: false, code: "AI_TEST_BAR_UNFIT", check: row.check, translation: row.translation,
           detail: `${detail}. Nothing was recorded`, field };
}

/** R19 — IS THIS A WELL-FORMED R75 RECORD? Null when it is; else `AI_TEST_BAR_UNFIT` (C-22.22) naming the first unfit
 *  field, in TEST_BAR_RECORD's order: a value that is not an object; a part not in TEST_BAR_PARTS; a blank set; a version
 *  that is not a whole number of one or more; a false-alarm rate that is not a number from 0 to 1; a `passed` that is not
 *  exactly true or false; a blank grader; a blank time. A record of any set is judged well-formed here: which set counts
 *  for the gate is `testBarHeld`'s. Never throws. */
export function checkTestBarRecord(r) {
  if (!r || typeof r !== "object" || Array.isArray(r))
    return unfit(null, `a test-bar result is a record of { ${TEST_BAR_RECORD.fields.join(", ")} }`);
  if (typeof r.part !== "string" || !TEST_BAR_PARTS.includes(r.part))
    return unfit("part", `${JSON.stringify(String(r.part ?? "").slice(0, 40))} is not an AI part the bar is held for`);
  if (blank(r.set)) return unfit("set", "it names no set of test investigations");
  if (!(Number.isSafeInteger(r.set_version) && r.set_version >= 1))
    return unfit("set_version", "its set's version is not a whole number of one or more");
  if (!(typeof r.false_alarm_rate === "number" && r.false_alarm_rate >= 0 && r.false_alarm_rate <= 1))
    return unfit("false_alarm_rate", "its false-alarm rate is not a number from 0 to 1");
  if (r.passed !== true && r.passed !== false) return unfit("passed", "it does not say whether the part passed");
  if (blank(r.graded_by)) return unfit("graded_by", "it names nobody who graded it");
  if (blank(r.at)) return unfit("at", "it does not say when it was graded");
  if (Object.prototype.hasOwnProperty.call(r, "entry_id") && r.entry_id !== undefined && blank(r.entry_id))
    return unfit("entry_id", "it names no AI it measured");
  return null;
}

/** R19 — IS THE BAR HELD FOR `part` ON `set`? The one computation `testBarHeld` makes over Civicsmith's set, exported so
 *  a set with matters can be judged before Civicsmith's has any. True when `records` holds a well-formed record
 *  (`checkTestBarRecord`) for that part with `passed: true` on `set`'s id at its CURRENT version, and `set` holds at least
 *  one matter. Another set's records, an earlier version's, a failed or unfit record, and every record on an empty or
 *  malformed set count for nothing. A part not in TEST_BAR_PARTS is false. Never throws. */
export function testBarHeldOn(set, part, records) {
  if (typeof part !== "string" || !TEST_BAR_PARTS.includes(part)) return false;
  if (!set || typeof set !== "object" || blank(set.id) || !Array.isArray(set.matters) || set.matters.length === 0)
    return false;
  return (Array.isArray(records) ? records : []).some((r) => checkTestBarRecord(r) === null && r.part === part
    && r.passed === true && r.set === set.id && r.set_version === set.version);
}

/** R19 — IS THE BAR HELD FOR `part`, ON CIVICSMITH'S SET (`./test-set.mjs`)? A group's own set never opens or closes the
 *  gate (`ai-runs` R75), so this reads Civicsmith's alone. While that set holds no matter, false for every part. */
export function testBarHeld(part, records) {
  return testBarHeldOn(CIVICSMITH_TEST_SET, part, records);
}

/** R19 as amended — MAY THIS AI PART BE DEPLOYED, ON THE RECORDS HELD, against `set`? `partDeployable`'s one computation:
 *  its test bar held on `set` (`testBarHeldOn`) AND, for a mode of the order, the chain (`deployable(part,
 *  verifications)`); a part outside the order (a mode that deploys apart, the explorer's use, a draft kind,
 *  transcription, reading) needs the bar alone here, its own reviewed flag deploying it besides. Never throws. */
export function partDeployableOn(set, part, held) {
  const { verifications = [], testBars = [] } = held && typeof held === "object" ? held : {};
  if (!testBarHeldOn(set, part, testBars)) return false;
  return DEPLOYMENT_SEQUENCE.order.includes(part) ? deployable(part, verifications) : true;
}

/** R19 as amended — THE DEPLOY GATE, on Civicsmith's set: `partDeployableOn(CIVICSMITH_TEST_SET, part, held)`, `held`
 *  being `{verifications, testBars}` as the record holds them. */
export function partDeployable(part, held) {
  return partDeployableOn(CIVICSMITH_TEST_SET, part, held);
}

/* A machine grader is not refused: R75's results are "written by the harness", grading against answers people wrote. */

/* R29 (T46; K2816 (2); amends R19; `draft-T46-trial.md` §1.1, §1.2) — THE TEST-INSTANCE EXCEPTION. Bob's ruling: the
 * deployer may mark one instance a test instance, on which an AI part whose test bar is not yet held runs anyway, every
 * output it gives labelled as not yet tested. The exception lifts the test bar and nothing else: it never sets or reads a
 * deploy flag (R14, R16, R21, R24, R27: the flags mark served code, and the doors still ask them), never lifts R19's
 * verification chain, and never counts as a bar held (no R75 record is written or read differently). `testInstance` is a
 * fact of the deployment that `ai-runs` reads from the Worker's environment and hands here (its R78), never a field a
 * caller sends; only the literal `true` is one. */

/** R29 — the key of the label's words (`words.json`, DEC-179), the design stream's to word. */
export const UNTESTED_WORDS = "ai.label.untested";

/** R29 — THE LABEL every output of a part admitted on the exception carries: `{kind: "untested", part, set, set_version,
 *  words}`, frozen, naming Civicsmith's set and its current version (the bar the part has not yet passed), for a part in
 *  TEST_BAR_PARTS; null for anything else. Pure; never throws. */
export function untestedLabel(part) {
  if (typeof part !== "string" || !TEST_BAR_PARTS.includes(part)) return null;
  return Object.freeze({ kind: "untested", part, set: CIVICSMITH_TEST_SET.id, set_version: CIVICSMITH_TEST_SET.version,
                         words: UNTESTED_WORDS });
}

/* R36 (T53; AIR13, AD7) — THE GATE PART OF EACH FINE PART. Gate 1 (`ai-gate`) rates an entry on six parts, the catalogue's
 * part ids (`ai-catalogue` R14); each fine part of TEST_BAR_PARTS keeps its own name and deploy flag and is judged on the
 * gate part it belongs to. `ai-accounts`' PART_OF_KIND says the same on the use kinds both name. */

/** R36 — the six gate parts, in the catalogue's order. Frozen. */
export const GATE_PARTS = Object.freeze(["ask", "draft", "read", "transcribe", "run", "account"]);

const gatePartFor = (p) => {
  if (p === "draft:case_account" || p === "draft:account_check") return "account";
  if (p.startsWith("draft:") || p === "enquire") return "draft";
  if (p === "extract" || p === "read") return "read";
  if (p === "ask" || p === "transcribe") return p;
  return "run"; /* check, investigate, plan, explore */
};

/** R36 — every TEST_BAR_PARTS entry to its gate part. Frozen. */
export const GATE_PART_OF = Object.freeze(Object.fromEntries(TEST_BAR_PARTS.map((p) => [p, gatePartFor(p)])));

/** R36 — the gate part of `part`, or null for a name outside TEST_BAR_PARTS. Pure; never throws. */
export function gatePartOf(part) {
  return typeof part === "string" && TEST_BAR_PARTS.includes(part) ? GATE_PART_OF[part] : null;
}

/** R19 (T53) — a Gate 1 verdict (`ai-catalogue` R14); only the first two admit. Frozen. */
export const GATE_VERDICTS = Object.freeze(["passes", "passes_with_limits", "not_suitable", "not_yet_rated"]);
const ADMITTING = Object.freeze(["passes", "passes_with_limits"]);
const SUITE_VERSIONS = Object.freeze(["bank", "scorer", "thresholds", "image"]);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const versionOk = (v) => (typeof v === "string" && v.trim() !== "") || (Number.isSafeInteger(v) && v >= 0);

/** R19 (T53) — IS THIS A WELL-FORMED GATE 1 RECORD (`ai-gate` R37)? Null when it is; else the name of the first unfit
 *  field (`record` for a value that is not an object): a gate part of GATE_PARTS; a non-blank `entry_id`; `suiteVersions`
 *  naming `bank`, `scorer`, `thresholds` and `image`; a verdict of GATE_VERDICTS; `limits` a list, non-empty for
 *  `passes_with_limits`; a non-blank `grade`; a non-blank `at`. Pure; never throws. */
export function checkGateRecord(r) {
  if (!isObj(r)) return "record";
  if (typeof r.part !== "string" || !GATE_PARTS.includes(r.part)) return "part";
  if (blank(r.entry_id)) return "entry_id";
  if (!isObj(r.suiteVersions) || !SUITE_VERSIONS.every((k) => versionOk(r.suiteVersions[k]))) return "suiteVersions";
  if (typeof r.verdict !== "string" || !GATE_VERDICTS.includes(r.verdict)) return "verdict";
  if (!Array.isArray(r.limits) || (r.verdict === "passes_with_limits" && r.limits.length === 0)) return "limits";
  if (blank(r.grade)) return "grade";
  if (blank(r.at)) return "at";
  return null;
}

/* The latest of `records` by `at` (an instant; one that does not parse sorts first), a later place in the list breaking
 * a tie. */
function latest(records) {
  let best = null, bestT = -Infinity;
  for (const r of records) {
    const t = Date.parse(r.at);
    const tt = Number.isFinite(t) ? t : -Infinity;
    if (best === null || tt >= bestT) { best = r; bestT = tt; }
  }
  return best;
}

const listOf = (v) => (Array.isArray(v) ? v : []);
const entryOf = (opts) => (opts != null && typeof opts === "object" && Object.prototype.hasOwnProperty.call(opts, "entry_id")
  && typeof opts.entry_id === "string" && opts.entry_id.trim() !== "" ? opts.entry_id : null);

/** R19 (T53) — DOES GATE 1 ADMIT `part` FOR `entry_id`? True when the latest well-formed Gate 1 record held for that entry
 *  and the part's gate part (GATE_PART_OF) has verdict `passes` or `passes_with_limits`. Pure; never throws. */
export function gateAdmits(part, entry_id, gateRecords) {
  const gp = gatePartOf(part);
  if (gp === null || blank(entry_id)) return false;
  const mine = listOf(gateRecords).filter((r) => checkGateRecord(r) === null && r.part === gp && r.entry_id === entry_id);
  const last = latest(mine);
  return last !== null && ADMITTING.includes(last.verdict);
}

/** R19 (T53), R37 — THE STANDING MEASURE: is `part` withdrawn for `entry_id` on `set`? When the latest well-formed R75
 *  record (`checkTestBarRecord`) for that part and entry on `set`'s id at its current version did not pass,
 *  `{part, entry_id, set, set_version}`, frozen; else null (never measured, a later pass, another entry's record, another
 *  set's or version's, an unfit one, or a set with no matter). Pure; never throws. */
export function partWithdrawnOn(set, part, entry_id, testBars) {
  if (typeof part !== "string" || !TEST_BAR_PARTS.includes(part) || blank(entry_id)) return null;
  if (!isObj(set) || blank(set.id) || !Array.isArray(set.matters) || set.matters.length === 0) return null;
  const mine = listOf(testBars).filter((r) => checkTestBarRecord(r) === null && r.part === part && r.entry_id === entry_id
    && r.set === set.id && r.set_version === set.version);
  const last = latest(mine);
  if (last === null || last.passed !== false) return null;
  return Object.freeze({ part, entry_id, set: set.id, set_version: set.version });
}

const ADMITTED = Object.freeze({ admitted: true, untested: null });
const NOT_ADMITTED = Object.freeze({ admitted: false, untested: null });

/** R29 as amended (T53) — THE ONE COMPUTATION EVERY DEPLOY GATE ASKS, against `set`, `held` being `{verifications,
 *  testBars, gateRecords}` and `opts` `{testInstance, entry_id}` (own keys only). For a part of TEST_BAR_PARTS whose
 *  chain stands (a mode of the order: `deployable(part, verifications)`) and which the standing measure has not withdrawn
 *  for the entry (`partWithdrawnOn`): `{admitted: true, untested: null}` when Gate 1 admits it for `entry_id`
 *  (`gateAdmits`); else, when `opts.testInstance` is exactly `true`, `{admitted: true, untested: untestedLabel(part)}`.
 *  Otherwise `{admitted: false, untested: null}`, whose refusal is `partRefusal(part, entry_id, {set, held})` (R30, R37).
 *  An absent or non-string `entry_id` admits nothing outside a test instance. Civicsmith's set no longer opens the gate.
 *  Answers frozen. Pure; never throws. */
export function partAdmittedOn(set, part, held, opts) {
  if (typeof part !== "string" || !TEST_BAR_PARTS.includes(part)) return NOT_ADMITTED;
  const { verifications = [], testBars = [], gateRecords = [] } = isObj(held) ? held : {};
  if (DEPLOYMENT_SEQUENCE.order.includes(part) && !deployable(part, verifications)) return NOT_ADMITTED;
  const entry = entryOf(opts);
  if (entry !== null && partWithdrawnOn(set, part, entry, testBars) !== null) return NOT_ADMITTED;
  if (entry !== null && gateAdmits(part, entry, gateRecords)) return ADMITTED;
  const testInstance = opts != null && typeof opts === "object" && Object.prototype.hasOwnProperty.call(opts, "testInstance")
    ? opts.testInstance : false;
  return testInstance === true ? Object.freeze({ admitted: true, untested: untestedLabel(part) }) : NOT_ADMITTED;
}

/** R29 — THE GATE ON CIVICSMITH'S SET: `partAdmittedOn(CIVICSMITH_TEST_SET, part, held, opts)`. */
export function partAdmitted(part, held, opts) {
  return partAdmittedOn(CIVICSMITH_TEST_SET, part, held, opts);
}

/** R30, R37 — the words keys the gate's two refusals are read by. Frozen. */
export const PART_REFUSAL_WORDS = Object.freeze({
  AI_PART_NOT_DEPLOYED: "ai.refused.aipartnotdeployed",
  PART_WITHDRAWN: "ai.refused.partwithdrawn",
});

const named = (v) => (typeof v === "string" ? v.slice(0, 40) : null);

/** R30, R37 — THE GATE'S REFUSAL FORM, its one minting site. `PART_WITHDRAWN` when `ctx` (`{set, held}`, `set` defaulting
 *  to Civicsmith's) shows the standing measure withdrew `part` for `entry_id` (`partWithdrawnOn`), naming the part, the
 *  entry, the set and its version; else `AI_PART_NOT_DEPLOYED` (C-22.29) naming the part and the entry. Each is built
 *  from its row, carries its words key (PART_REFUSAL_WORDS) and holds no sentence of its own: the detail is the row's
 *  translation, read by key. A part or entry is named by its first 40 characters, a non-string entry as null. A door
 *  that `partAdmittedOn` does not admit, and that has no refusal of its own, relays it unchanged. Pure; never throws. */
export function partRefusal(part, entry_id, ctx) {
  const p = String(part ?? "").slice(0, 40);
  const e = named(entry_id);
  const c = isObj(ctx) ? ctx : {};
  const set = isObj(c.set) ? c.set : CIVICSMITH_TEST_SET;
  const w = e === null ? null : partWithdrawnOn(set, part, entry_id, isObj(c.held) ? c.held.testBars : []);
  const code = w === null ? "AI_PART_NOT_DEPLOYED" : "PART_WITHDRAWN";
  const row = AI_RUN_OWN_CHECKS[code];
  const out = { ok: false, code, check: row.check, translation: row.translation, detail: row.translation,
                words: PART_REFUSAL_WORDS[code], part: p, entry_id: e };
  if (w !== null) { out.set = w.set; out.set_version = w.set_version; }
  return out;
}
