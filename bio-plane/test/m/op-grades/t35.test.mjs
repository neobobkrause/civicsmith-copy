/* op-grades: T35's grades (R21, R22), at the module's exports. `personexpunge`'s dialog and the Irreversible weight
   (DEC-142, DEC-143), and every op `op-declarations` R30 declares, graded by R5 and R3. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT, OP_ALIASES,
         LARGER_SCREEN_ACTS, phoneOf } from "../../../src/op-grades/index.mjs";
import { T35_RUNGS, T35_RUNG_ABSENT, T35_NON_ACTS } from "../../../src/op-grades/t35.mjs";
import { reqText, ticked, tickedAll, readRows, declaredSentence, doesSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;

/* ---- R21 ----------------------------------------------------------------------------------------------------------- */
test("R21: personexpunge keeps its `reasoned` rung and its NON_ACTS sentence, stays out of MACHINE_REFUSALS, and gains "
   + "DEC-142's dialog: what is removed and from where, that no one can undo it, the marker, the docket, and the "
   + "confirmation with a reason naming the law or order", () => {
  assert.equal(RUNGS.personexpunge, "reasoned");
  assert.match(NON_ACTS.personexpunge, /^person-directed: keyed by a person fact, claim, tie or source link/);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "personexpunge"));
  const e = CONSEQUENCE_STATEMENTS.personexpunge;
  assert.ok(Object.isFrozen(e));
  assert.deepEqual(Object.keys(e), ["friction", "key"]);
  assert.equal(e.friction, "dialog");
  assert.equal(e.friction, CONSEQUENCE_STATEMENTS.actionholdrelease.friction, "DEC-113's tier");
  assert.equal(e.key, "screen.person.expunge.statement", "the key of the sentence the surface fills with {date} and {member}");
  assert.ok(!Object.hasOwn(e, "statement"));
});

test("R21 R22 R37 (K2049): IRREVERSIBLE_WEIGHT, frozen, holds every op RUNGS grades `irreversible` (publishat, "
   + "publishatmove; publish left it at R37, T47), personexpunge and standardrelease, and no other op; it changes no rung",
() => {
  assert.ok(Object.isFrozen(IRREVERSIBLE_WEIGHT));
  const irreversible = Object.keys(RUNGS).filter((op) => RUNGS[op] === "irreversible" && !Object.hasOwn(OP_ALIASES, op));
  /* R37 (T47): publish, and publishcheck graded as it (K2839), prepare and are `terminal`: neither carries the weight */
  assert.deepEqual(irreversible.sort(), ["publishat", "publishatmove"]);
  for (const op of ["publish", "publishcheck"]) assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
  assert.deepEqual([...IRREVERSIBLE_WEIGHT].sort(), [...irreversible, "personexpunge", "standardrelease"].sort());
  assert.equal(new Set(IRREVERSIBLE_WEIGHT).size, IRREVERSIBLE_WEIGHT.length);
  assert.equal(RUNGS.personexpunge, "reasoned", "the weight is not a rung");
  /* K2049: standardrelease, never undone (standards R37), carries the weight and DEC-143's dialog; its rung stays */
  assert.equal(RUNGS.standardrelease, "reasoned");
  const r = CONSEQUENCE_STATEMENTS.standardrelease;
  assert.ok(Object.isFrozen(r));
  assert.equal(r.friction, "dialog");
  assert.equal(r.key, "consequence.standardrelease");
  assert.equal(JSON.stringify(IRREVERSIBLE_WEIGHT), JSON.stringify([...IRREVERSIBLE_WEIGHT]), "served as a list");
});

/* ---- R22 ----------------------------------------------------------------------------------------------------------- */
const R22_WRITES = { coarchiveset: "reversible", unpack: "undetermined", noterevise: "caller-owned",
  notedelete: "caller-owned", signout: "caller-owned", signouteverywhere: "caller-owned",
  recoverycodesissue: "credential", recover: "credential" };
const R22_REASONS = {
  unpack: "archive-directed: keyed by a held archive's capture, reached from its screen; files its entries as captures of "
    + "their own at the archive's grade, each promoted beside it",
  coarchiveset: "setting: the group's choice whether a capture asks for a co-archive; an administrator's act; moves no bundle",
  signout: declaredSentence("credentials", "signout"),
  signouteverywhere: declaredSentence("credentials", "signout"),
  recoverycodesissue: declaredSentence("credentials", "recoverycodesissue"),
  recover: declaredSentence("credentials", "recover"),
};
/* K2043 (B3): the other ops T35 grades for L5's and L6's owners, each with the code its reasoned
   grade rests on (in the family) or its ground */
const B3_WRITES = { standardforce: "reasoned", standardforcewithdraw: "reasoned", standardrelease: "reasoned",
  standardadoption: "reasoned", standardimpose: "reasoned", standardbenchmark: "reasoned", usewithdraw: "reasoned",
  uselink: "reasoned", useunlink: "reasoned", discretionrecord: "undetermined", assessmentrecord: "undetermined",
  usesfreeze: "observational", standardforcepropose: "undetermined", reviewpropose: "undetermined",
  recordsrequestopen: "undetermined", recordsrequestanswer: "undetermined", subscriptiondisconnect: "credential" };
const B3_CODES = { standardforce: "STANDARD_NO_REASON", standardforcewithdraw: "STANDARD_NO_REASON",
  standardrelease: "STANDARD_NO_REASON", standardadoption: "STANDARD_NO_REASON", standardimpose: "STANDARD_NO_REASON",
  standardbenchmark: "STANDARD_NO_REASON", usewithdraw: "NO_REASON", uselink: "DUTY_NO_REASON",
  useunlink: "DUTY_NO_REASON" };
/* the reads of T35's table: R22 names its own in backticks (`credit` is public and apart), the rest are K2043's */
/* a read whose owner words it without the "read: " lead holds the owner's sentence (K4168): securitymap */
const T35_READS = [...readRows(T35_NON_ACTS), ...Object.keys(T35_NON_ACTS).filter((op) => T35_NON_ACTS[op] === doesSentence(op))].filter((op) => op !== "credit");
const R22_READS = T35_READS.filter((op) => tickedAll(reqText(22)).includes(op));
const B3_READS = T35_READS.filter((op) => !R22_READS.includes(op));

test("R22 R3: every op op-declarations R30 declares is graded — coarchiveset `reversible`, unpack `undetermined`, the "
   + "note revise and delete and both sign-outs `caller-owned`, the recovery acts `credential` — each with R22's reason, "
   + "the reads `read:`, credit public; none a machine refusal; subscriptionsignin, which had no op in T35, in none of T35's tables (R27 grades it in T37)", () => {
  const got = Object.fromEntries(Object.keys(R22_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, R22_WRITES);
  assert.deepEqual([...Object.keys(T35_RUNGS), ...Object.keys(T35_RUNG_ABSENT)].sort(),
    [...Object.keys(R22_WRITES), ...Object.keys(B3_WRITES)].sort());
  for (const [op, e] of Object.entries(T35_RUNG_ABSENT)) assert.ok(e.is.length > 40, op);
  /* each beside the op R22 names as its precedent */
  /* (T47) R35 moved inboxpull, R22's first precedent for unpack, to `reversible`; caseimport stays the precedent */
  assert.notEqual(gradeOf("unpack"), gradeOf("inboxpull"));
  for (const [op, like] of [["unpack", "caseimport"], ["noterevise", "notewrite"],
    ["notedelete", "notewrite"], ["signout", "reminderset"], ["recoverycodesissue", "signeradd"],
    ["recover", "knockerconsent"]]) assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  for (const [op, why] of Object.entries(R22_REASONS)) assert.equal(NON_ACTS[op], why, op);
  for (const op of ["noterevise", "notedelete"]) assert.equal(NON_ACTS[op], NON_ACTS.notewrite, op);
  for (const op of R22_READS) {
    /* securitymap is declared in its owner's words, which do not lead with "read: " (K4168) */
    assert.ok(op === "securitymap" ? NON_ACTS[op] === doesSentence(op) : NON_ACTS[op].startsWith("read: ") && NON_ACTS[op].length > 20, op);
    assert.equal(gradeOf(op), null, op); /* a read takes no grade; securitymap is one too (K4210) */
  }
  assert.match(NON_ACTS.findin, /records nothing/);
  assert.equal(NON_ACTS.credit, "read: public, no credential");
  /* K2054: agentpack has no NEEDS row (op-declarations R30), so it carries no reason and no grade */
  assert.ok(!Object.hasOwn(NON_ACTS, "agentpack"));
  assert.equal(gradeOf("agentpack"), null);
  assert.deepEqual(Object.keys(T35_NON_ACTS).sort(),
    [...Object.keys(R22_WRITES), ...R22_READS, "credit", ...Object.keys(B3_WRITES), ...B3_READS].sort());
  const ALL = [...Object.keys(R22_WRITES), ...R22_READS, "credit"];
  assert.deepEqual(ALL.filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  for (const t of [T35_RUNGS, T35_RUNG_ABSENT, T35_NON_ACTS]) assert.ok(!Object.hasOwn(t, "subscriptionsignin"));
  /* R18 over them: the sign-outs are phone acts, the recovery acts are not */
  /* every op R22 names that carries a grade: R18's rule decides its phone (the credential ones are not phone acts) */
  const R22_GRADED = ticked(reqText(22)).filter((op) => gradeOf(op) !== null);
  const offPhone = (op) => ["terminal", "attested", "irreversible"].includes(RUNGS[op]) || RUNG_ABSENT[op]?.ground === "credential"
    || IRREVERSIBLE_WEIGHT.includes(op) || LARGER_SCREEN_ACTS.includes(op);
  for (const op of R22_GRADED) assert.equal(phoneOf(op), !offPhone(op), op);
  assert.deepEqual([phoneOf("signout"), phoneOf("signouteverywhere"), phoneOf("unpack"), phoneOf("coarchiveset")],
    [true, true, true, true]);
  assert.deepEqual([phoneOf("recoverycodesissue"), phoneOf("recover")], [false, false]);
  /* negative control */
  assert.notDeepEqual({ ...got, unpack: "substrate" }, R22_WRITES);
});

test("R22 R3 R13 (K2043): every other op op-declarations declares in T35 for L5's and L6's owners is graded by R3's rule "
   + "from its owner — standards' acts, usewithdraw, uselink and useunlink `reasoned` on a code of the family; the event "
   + "records, the proposals and the records requests `undetermined`; usesfreeze `observational` as recordset; "
   + "subscriptiondisconnect `credential` — each with its reason, the reads `read:`, none a machine refusal", () => {
  const got = Object.fromEntries(Object.keys(B3_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, B3_WRITES);
  assert.deepEqual(Object.keys(got).filter((op) => got[op] === "reasoned").sort(), Object.keys(B3_CODES).sort());
  for (const [op, code] of Object.entries(B3_CODES)) assert.ok(JUSTIFICATION_REFUSALS.includes(code), `${op}: ${code}`);
  for (const [op, like] of [["discretionrecord", "eventcreate"], ["usesfreeze", "recordset"],
    ["standardforcepropose", "lawpropose"], ["reviewpropose", "dutypropose"], ["subscriptiondisconnect",
    "accountreferenceremove"]]) assert.equal(gradeOf(op), gradeOf(like), `${op} as ${like}`);
  for (const op of Object.keys(B3_WRITES)) assert.ok(NON_ACTS[op].length > 30 && !NON_ACTS[op].startsWith("read: "), op);
  for (const op of B3_READS) {
    assert.ok(NON_ACTS[op].startsWith("read: ") && /writes nothing$/.test(NON_ACTS[op]), op);
    assert.equal(gradeOf(op), null, op);
  }
  assert.deepEqual([...Object.keys(B3_WRITES), ...B3_READS].filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  /* negative control */
  assert.notDeepEqual({ ...got, usesfreeze: "reasoned" }, B3_WRITES);
});
