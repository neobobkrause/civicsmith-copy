/* op-grades: T36's grades (R23–R26), at the module's exports. The five ops K2092 adds, the 23 ops of `file-safety`
   (with `openwithwarning`'s DEC-173 statement), `credentials`' keep-away with `assistantset` retired (its code re-coded in T37), and
   `personexpunge` kept for a larger screen (DEC-170, through IRREVERSIBLE_WEIGHT since DEC-181); each graded by R5 and R3. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, phoneOf } from "../../../src/op-grades/index.mjs";
import { T36_RUNGS, T36_RUNG_ABSENT, T36_NON_ACTS, T36_CONSEQUENCE_STATEMENTS } from "../../../src/op-grades/t36.mjs";
import { readRows, declaredSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => NON_ACTS[op].startsWith("read: ") && /writes nothing$/.test(NON_ACTS[op]) && NON_ACTS[op].length > 30;

/* ---- R23 ----------------------------------------------------------------------------------------------------------- */
const R23_WRITES = { standardinforcethrough: "reasoned", standardinforcethroughwithdraw: "reasoned", spotcheckvisit: "reasoned" };
const R23_CODES = { standardinforcethrough: "STANDARD_NO_REASON", standardinforcethroughwithdraw: "STANDARD_NO_REASON",
  spotcheckvisit: "NOT_TESTIMONY" };
const R23_READS = ["inforcethroughof", "spotcheck"];
const STANDARD_THROUGH = "standard-directed: keyed by a standard's version, reached from the standard; records what a "
  + "checked source shows, with who, when and why; moves no bundle";

test("R23: K2092's five ops — standardinforcethrough, standardinforcethroughwithdraw and spotcheckvisit `reasoned`, each "
   + "backed by its owner's code in JUSTIFICATION_REFUSALS (NOT_TESTIMONY joining), each with R23's reason; the reads "
   + "inforcethroughof and spotcheck `read:` and ungraded; none a machine refusal; the three acts phone acts", () => {
  const got = Object.fromEntries(Object.keys(R23_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, R23_WRITES);
  for (const [op, code] of Object.entries(R23_CODES)) assert.ok(JUSTIFICATION_REFUSALS.includes(code), `${op}: ${code}`);
  assert.equal(NON_ACTS.standardinforcethrough, STANDARD_THROUGH);
  assert.equal(NON_ACTS.standardinforcethroughwithdraw, STANDARD_THROUGH);
  assert.equal(NON_ACTS.spotcheckvisit, declaredSentence("calculations", "spotcheckvisit"));
  for (const op of R23_READS) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  assert.deepEqual([...Object.keys(R23_WRITES), ...R23_READS].filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.deepEqual(Object.keys(R23_WRITES).map(phoneOf), [true, true, true]);
  /* negative control */
  assert.notDeepEqual({ ...got, spotcheckvisit: "undetermined" }, R23_WRITES);
});

/* ---- R24 ----------------------------------------------------------------------------------------------------------- */
/* the 23 ops of file-safety's ops map (`fileSafetyOps`), its own names */
/* R35 (T47) amends R24: deepercheck `observational`, as deeperbatch */
const R24_WRITES = { releasescanhold: "reasoned", deepercheck: "observational", safecopyrequest: "undetermined",
  openoriginal: "observational", openwithwarning: "observational", scanbatch: "observational", deeperbatch: "observational",
  renderbatch: "substrate", securityforward: "substrate", securitytooladd: "credential", securitytoolremove: "credential",
  securitytooltest: "substrate" };
/* the reads of T36's table that are neither R23's two nor R25's `aikeepawaystate`: file-safety's (R24 counts 23 ops in all) */
const R24_READS = readRows(T36_NON_ACTS).filter((op) => !R23_READS.includes(op) && op !== "aikeepawaystate");
const FILE_ASKED = declaredSentence("file-safety", "deepercheck");
const TOOLS = declaredSentence("file-safety", "securitytooladd");
const WAKES = "scheduler: the security wakes; name no member and move no bundle";
const R24_REASONS = {
  openoriginal: declaredSentence("file-safety", "openoriginal"),
  openwithwarning: declaredSentence("file-safety", "openwithwarning"),
  deepercheck: FILE_ASKED, safecopyrequest: FILE_ASKED,
  releasescanhold: declaredSentence("file-safety", "releasescanhold"),
  securitytooladd: TOOLS, securitytooltest: TOOLS, securitytoolremove: TOOLS,
  scanbatch: WAKES, renderbatch: WAKES, deeperbatch: WAKES, securityforward: WAKES,
};

test("R24 R35: the 23 ops of file-safety — releasescanhold `reasoned` on HOLD_NO_REASON; deepercheck `observational` "
   + "(R35), safecopyrequest `undetermined`; the openings and the scan and deeper batches `observational`; renderbatch, securityforward, "
   + "securitytooltest `substrate`; tool add and remove `credential`; the 11 reads `read:` — each with R24's reason, none "
   + "a machine refusal, and only tool add and remove kept off the phone", () => {
  assert.equal(Object.keys(R24_WRITES).length + R24_READS.length, 23);
  const got = Object.fromEntries(Object.keys(R24_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, R24_WRITES);
  assert.ok(JUSTIFICATION_REFUSALS.includes("HOLD_NO_REASON"));
  assert.notEqual("HOLD_NO_REASON", "HOLD_REFUSED");
  /* each beside the op R24 names as its precedent */
  for (const [op, like] of [["renderbatch", "taskdrain"], ["securityforward", "taskdrain"],
    ["securitytooladd", "keyedserviceset"], ["securitytoolremove", "keyedserviceset"],
    ["securitytooltest", "keyedserviceswitch"]]) assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  for (const [op, e] of Object.entries(T36_RUNG_ABSENT)) assert.ok(e.is.length > 40, op);
  assert.deepEqual(Object.keys(R24_REASONS).sort(), Object.keys(R24_WRITES).sort());
  for (const [op, why] of Object.entries(R24_REASONS)) assert.equal(NON_ACTS[op], why, op);
  for (const op of R24_READS) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  /* none is a capture act (`capture-directed:` would enrol it in affordances' CAPTURE_ACTS) */
  for (const op of [...Object.keys(R24_WRITES), ...R24_READS]) assert.ok(!NON_ACTS[op].startsWith("capture-directed:"), op);
  assert.deepEqual([...Object.keys(R24_WRITES), ...R24_READS].filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  const offPhone = Object.keys(R24_WRITES).filter((op) => !phoneOf(op)).sort();
  assert.deepEqual(offPhone, ["securitytooladd", "securitytoolremove"]);
  /* negative control */
  assert.notDeepEqual({ ...got, openwithwarning: "reasoned" }, R24_WRITES);
});

test("R24 R4 R44 (DEC-173 (2)): openwithwarning carries a frozen dialog entry beside its `observational` ground, naming "
   + "the key of the sentence that says what opening risks; no rung is added", () => {
  const e = CONSEQUENCE_STATEMENTS.openwithwarning;
  assert.equal(e, T36_CONSEQUENCE_STATEMENTS.openwithwarning, "the same object, published by reference");
  assert.ok(Object.isFrozen(e));
  assert.deepEqual(Object.keys(e), ["friction", "key"]);
  assert.equal(e.friction, "dialog");
  assert.equal(e.key, "screen.open-file.warn.ends");
  assert.equal(gradeOf("openwithwarning"), "observational");
  assert.ok(!Object.hasOwn(RUNGS, "openwithwarning"));
  assert.ok(!IRREVERSIBLE_WEIGHT.includes("openwithwarning"));
});

/* ---- R25 ----------------------------------------------------------------------------------------------------------- */
test("R25: aikeepaway `reasoned` on AI_KEEP_AWAY_NO_REASON (T37: credentials R51's own code, C-29.32), NO_REASON "
   + "staying for the other ops, with its setting reason; aikeepawaystate `read:`; neither a machine refusal; "
   + "securitycount ungraded; assistantset retired from RUNG_ABSENT and NON_ACTS", () => {
  assert.equal(gradeOf("aikeepaway"), "reasoned");
  assert.ok(JUSTIFICATION_REFUSALS.includes("AI_KEEP_AWAY_NO_REASON"));
  assert.ok(JUSTIFICATION_REFUSALS.includes("NO_REASON"), "NO_REASON stays for the ops that still answer it");
  assert.equal(JUSTIFICATION_REFUSALS.filter((c) => c === "AI_KEEP_AWAY_NO_REASON").length, 1);
  assert.equal(NON_ACTS.aikeepaway, declaredSentence("ai-accounts", "aikeepaway"));
  assert.ok(isRead("aikeepawaystate"));
  assert.equal(gradeOf("aikeepawaystate"), null);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "aikeepaway") && !Object.hasOwn(MACHINE_REFUSALS, "aikeepawaystate"));
  assert.equal(gradeOf("securitycount"), null);
  assert.ok(!Object.hasOwn(NON_ACTS, "securitycount"));
  for (const t of [RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS]) assert.ok(!Object.hasOwn(t, "assistantset"));
  assert.equal(gradeOf("assistantset"), null);
  assert.equal(phoneOf("aikeepaway"), true);
});

test("R23 R24 R25: T36's tables hold exactly these ops, none both graded and stated absent", () => {
  assert.deepEqual(Object.keys(T36_RUNGS).sort(), [...Object.keys(R23_WRITES), ...Object.keys(R24_WRITES), "aikeepaway"]
    .filter((op) => Object.hasOwn(T36_RUNGS, op)).sort());
  assert.deepEqual([...Object.keys(T36_RUNGS), ...Object.keys(T36_RUNG_ABSENT)].sort(),
    [...Object.keys(R23_WRITES), ...Object.keys(R24_WRITES), "aikeepaway"].sort());
  assert.deepEqual(Object.keys(T36_NON_ACTS).sort(), [...Object.keys(R23_WRITES), ...R23_READS, ...Object.keys(R24_WRITES),
    ...R24_READS, "aikeepaway", "aikeepawaystate"].sort());
  assert.deepEqual(Object.keys(T36_RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
  assert.deepEqual(Object.keys(T36_CONSEQUENCE_STATEMENTS), ["openwithwarning"]);
});

/* ---- R26 ----------------------------------------------------------------------------------------------------------- */
test("R26 R18 (T37; DEC-181, replacing DEC-170): personexpunge leaves LARGER_SCREEN_ACTS, which holds filingsent alone, "
   + "and phoneOf still answers false for it through IRREVERSIBLE_WEIGHT; no op is in both sets; its `reasoned` rung, its "
   + "Irreversible weight and its consequence statement are unchanged", () => {
  assert.ok(Object.isFrozen(LARGER_SCREEN_ACTS));
  assert.deepEqual([...LARGER_SCREEN_ACTS], ["filingsent"]);
  assert.deepEqual(LARGER_SCREEN_ACTS.filter((op) => IRREVERSIBLE_WEIGHT.includes(op)), []);
  assert.equal(phoneOf("personexpunge"), false);
  assert.equal(RUNGS.personexpunge, "reasoned");
  assert.ok(IRREVERSIBLE_WEIGHT.includes("personexpunge"));
  assert.equal(CONSEQUENCE_STATEMENTS.personexpunge.friction, "dialog");
  /* R18 (T37): standardrelease, in IRREVERSIBLE_WEIGHT, moves from true to false; a reasoned act outside both stays */
  assert.equal(phoneOf("standardrelease"), false);
  assert.equal(phoneOf("releasescanhold"), true);
});
