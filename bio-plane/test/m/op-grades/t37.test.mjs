/* op-grades: T37's grades (R27) and the phone rule read from the Irreversible weight (R18, R26), at the module's exports.
   The ops T37 declares — case-carriage's photo marks, credentials' own password change and subscription sign-in, and
   instance-setup's translation of the interface — each graded by R5 and R3; `obscuremark` `reversible` since T38 (R28),
   a withdrawal taking a mark back. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT, LARGER_SCREEN_ACTS,
         OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import { T37_RUNGS, T37_RUNG_ABSENT, T37_NON_ACTS } from "../../../src/op-grades/t37.mjs";
import { T38_RUNGS } from "../../../src/op-grades/t38.mjs";
import { declaredSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;
const isRead = (op) => NON_ACTS[op].startsWith("read: ") && /writes nothing$/.test(NON_ACTS[op]) && NON_ACTS[op].length > 30;

/* ---- R27 ----------------------------------------------------------------------------------------------------------- */
const R27_WRITES = { obscuremark: "reversible", setpassword: "caller-owned", subscriptionsignin: "credential",
  translationgrant: "credential", translationdraft: "caller-owned", translationmark: "undetermined",
  translationadopt: "reversible", translationconfirm: "reversible", translationrevert: "reversible" };
const R27_READS = ["photomarks", "translations", "interfacewords"];
const R27_REASONS = {
  obscuremark: declaredSentence("case-carriage", "obscuremark"),
  setpassword: declaredSentence("credentials", "setpassword"),
  subscriptionsignin: declaredSentence("signin-door", "subscriptionsignin"),
  translationgrant: declaredSentence("translations", "translationgrant"),
  translationdraft: "translation-directed: keyed by a language and interface words; drafts labeled machine work for a "
    + "granted speaker to check (`to_language`), or an administrator's back-translation of one protected word that "
    + "writes nothing (`to_english`); moves no bundle",
  translationadopt: declaredSentence("translations", "translationadopt"),
  translationconfirm: declaredSentence("translations", "translationconfirm"),
  translationrevert: declaredSentence("translations", "translationrevert"),
  /* a hand sentence of this module with no owner's declaration (B28): its own table's text, not a copy of it */
  translationmark: T37_NON_ACTS.translationmark,
};

test("R27 (T38: R28; T48: R39): T37's ops — translationmark `undetermined`, translationdraft and setpassword `caller-owned`, "
   + "subscriptionsignin and translationgrant `credential`, translationadopt, translationconfirm and translationrevert "
   + "`reversible`, and obscuremark `reversible` since T38 (R28 moved it from RUNG_ABSENT), its reason naming the "
   + "reasoned withdrawal — each with R27's reason; the reads photomarks, translations and interfacewords `read:` and ungraded; "
   + "none a machine refusal; subscriptionsignin and translationgrant off the phone, every other a phone act", () => {
  const got = Object.fromEntries(Object.keys(R27_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, R27_WRITES);
  /* each beside the op R27 names as its precedent */
  for (const [op, like] of [["setpassword", "signout"], ["subscriptionsignin", "keyedserviceset"],
    ["translationgrant", "wizardeditorgrant"], ["translationdraft", "memberlanguageset"]])
    assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  for (const [op, e] of Object.entries(T37_RUNG_ABSENT)) assert.ok(typeof e.is === "string" && e.is.length > 40, op);
  assert.deepEqual(Object.keys(R27_REASONS).sort(), Object.keys(R27_WRITES).sort());
  for (const [op, why] of Object.entries(R27_REASONS)) assert.equal(NON_ACTS[op], why, op);
  assert.match(NON_ACTS.translationmark, /^translation-directed: /);
  for (const op of R27_READS) { assert.ok(isRead(op), op); assert.equal(gradeOf(op), null, op); }
  /* none is a capture act (`capture-directed:` would enrol it in affordances' CAPTURE_ACTS) */
  for (const op of [...Object.keys(R27_WRITES), ...R27_READS]) assert.ok(!NON_ACTS[op].startsWith("capture-directed:"), op);
  assert.deepEqual([...Object.keys(R27_WRITES), ...R27_READS].filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  const offPhone = Object.keys(R27_WRITES).filter((op) => !phoneOf(op)).sort();
  assert.deepEqual(offPhone, ["subscriptionsignin", "translationgrant"]);
  /* no vocabulary or statement is added */
  for (const op of [...Object.keys(R27_WRITES), ...R27_READS]) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
  }
  /* (T38) obscuremark is no longer stated absent, and nothing names it `undetermined` */
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "obscuremark"));
  /* negative control */
  assert.notDeepEqual({ ...got, translationrevert: "reasoned" }, R27_WRITES);
  assert.notDeepEqual({ ...got, obscuremark: "undetermined" }, R27_WRITES);
});

test("R27 R28: T37's tables hold exactly these ops, obscuremark's rung in T38's table since R28 moved it, none both "
   + "graded and stated absent", () => {
  assert.deepEqual(Object.keys(T37_RUNGS).sort(), ["translationadopt", "translationconfirm", "translationrevert"]);
  assert.ok(!Object.hasOwn(T37_RUNG_ABSENT, "obscuremark"));
  assert.equal(T38_RUNGS.obscuremark, "reversible");
  assert.deepEqual([...Object.keys(T37_RUNGS), ...Object.keys(T37_RUNG_ABSENT), "obscuremark"].sort(),
    Object.keys(R27_WRITES).sort());
  assert.deepEqual(Object.keys(T37_NON_ACTS).sort(), [...Object.keys(R27_WRITES), ...R27_READS].sort());
  assert.deepEqual(Object.keys(T37_RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
  assert.deepEqual(Object.keys(T37_RUNG_ABSENT).filter((op) => Object.hasOwn(RUNGS, op)), []);
});

/* ---- R18, R26 ------------------------------------------------------------------------------------------------------ */
test("R18 R26 (T37; DEC-181): phoneOf answers false for every op in IRREVERSIBLE_WEIGHT and for every alias of one, "
   + "standardrelease among them; LARGER_SCREEN_ACTS holds filingsent alone and shares no op with IRREVERSIBLE_WEIGHT", () => {
  assert.ok(IRREVERSIBLE_WEIGHT.length >= 4);
  for (const op of IRREVERSIBLE_WEIGHT) assert.equal(phoneOf(op), false, op);
  for (const [alias, op] of Object.entries(OP_ALIASES))
    if (IRREVERSIBLE_WEIGHT.includes(op)) assert.equal(phoneOf(alias), false, alias);
  for (const op of ["publishat", "publishatmove", "personexpunge", "standardrelease"])
    assert.ok(IRREVERSIBLE_WEIGHT.includes(op), op);
  /* R37 (T47): publish prepares and left the weight; it stays off the phone by its terminal rung */
  assert.ok(!IRREVERSIBLE_WEIGHT.includes("publish"));
  assert.equal(phoneOf("publish"), false);
  /* two of the set are `reasoned`: only the weight keeps them off the phone */
  assert.deepEqual([RUNGS.personexpunge, RUNGS.standardrelease], ["reasoned", "reasoned"]);
  assert.deepEqual([phoneOf("personexpunge"), phoneOf("standardrelease")], [false, false]);
  assert.deepEqual([...LARGER_SCREEN_ACTS], ["filingsent"]);
  assert.deepEqual(LARGER_SCREEN_ACTS.filter((op) => IRREVERSIBLE_WEIGHT.includes(op)), []);
  /* negative control: a reasoned op outside both sets stays a phone act */
  assert.equal(phoneOf("releasescanhold"), true);
});
