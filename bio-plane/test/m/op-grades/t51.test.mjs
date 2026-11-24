/* op-grades: T51's grade (R48) at the module's exports. The three reads the design's new screens add are stated absent as
   reads: each has a `read: …` reason, takes no rung and no ground, and is no act. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT, phoneOf } from "../../../src/op-grades/index.mjs";
import { T51_NON_ACTS } from "../../../src/op-grades/t51.mjs";
import { MARKS, MARK_SOURCES, MARKS_KIT_COMMIT } from "../../../src/op-grades/marks.mjs";
import { JUSTIFICATION_REFUSALS } from "../../../src/op-grades/index.mjs";
import { declaredSentence, registeredOpGrades } from "./declared.mjs";

const READS = ["holdsdue", "templatebyhandle", "rulefields"];

/* ---- R48 ----------------------------------------------------------------------------------------------------------- */
test("R48: holdsdue, templatebyhandle and rulefields are NON_ACTS reads, each with a `read: …` reason that writes nothing, "
   + "and none has a rung or a ground", () => {
  for (const op of READS) assert.ok(Object.hasOwn(T51_NON_ACTS, op), op);
  for (const op of READS) {
    assert.equal(NON_ACTS[op], T51_NON_ACTS[op], op);
    assert.ok(NON_ACTS[op].startsWith("read: "), op);
    assert.match(NON_ACTS[op], /writes nothing$/, op);
    assert.equal(RUNGS[op], undefined, `${op} has no rung`);
    assert.equal(RUNG_ABSENT[op], undefined, `${op} has no absence ground`);
  }
  assert.match(NON_ACTS.holdsdue, /\(`action-holds` R19\)/);
  assert.match(NON_ACTS.templatebyhandle, /\(`filing-templates` R34\)/);
  assert.match(NON_ACTS.rulefields, /\(`local-facts` R18\)/);
});

test("R48: the three reads are no act (no MACHINE_REFUSALS row, no CONSEQUENCE_STATEMENTS entry, not irreversible) and each "
   + "answers phone true, the read's rule", () => {
  for (const op of READS) {
    assert.equal(Object.hasOwn(MACHINE_REFUSALS, op), false, op);
    assert.equal(Object.hasOwn(CONSEQUENCE_STATEMENTS, op), false, op);
    assert.equal(Object.hasOwn(IRREVERSIBLE_WEIGHT, op), false, op);
    assert.equal(phoneOf(op), true, op);
  }
});

/* ---- R77–R79 (op-declarations): the reads it declares for T51, each accounted here as a read ----------------------- */
test("R77 R78 R79: each read op-declarations declares for T51 has a NON_ACTS reason beginning \"read: \", and no rung, "
   + "ground or machine refusal", () => {
  const ops = Object.keys(T51_NON_ACTS);
  assert.equal(ops.length, 17, "the fourteen session reads op-declarations declares for T51 (three of them R48s), publishedfrozen (public), remindersfor (action-clocks R26, fix round 3) and holdsplaced (action-holds R22, K5232)");
  for (const op of ops) {
    assert.ok(NON_ACTS[op].startsWith("read: "), op);
    assert.equal(RUNGS[op], undefined, op);
    assert.equal(RUNG_ABSENT[op], undefined, op);
    assert.equal(Object.hasOwn(MACHINE_REFUSALS, op), false, op);
  }
});

/* ---- K5232 (action-holds R22): the places held, listed, a session read beside holdsdue ----------------------------- */
test("R48 (action-holds R22): holdsplaced is a NON_ACTS read whose reason is the owner's sentence, beginning \"read: \" and "
   + "ending \"writes nothing\", with no rung, ground or machine refusal, and it answers phone true", () => {
  assert.equal(T51_NON_ACTS.holdsplaced, NON_ACTS.holdsplaced);
  assert.ok(NON_ACTS.holdsplaced.startsWith("read: "));
  assert.match(NON_ACTS.holdsplaced, /writes nothing \(action-holds R22\)$/);
  assert.equal(RUNGS.holdsplaced, undefined, "a read has no rung");
  assert.equal(RUNG_ABSENT.holdsplaced, undefined, "a read has no absence ground");
  assert.equal(Object.hasOwn(MACHINE_REFUSALS, "holdsplaced"), false);
  assert.equal(Object.hasOwn(CONSEQUENCE_STATEMENTS, "holdsplaced"), false);
  assert.equal(phoneOf("holdsplaced"), true);
  /* control: the read is held in NON_ACTS alone, beside holdsdue, which keeps its own reason */
  assert.equal(NON_ACTS.holdsdue.startsWith("read: "), true);
  assert.notEqual(NON_ACTS.holdsplaced, NON_ACTS.holdsdue);
});

/* ---- fix round 2, K4323 (DEC-394): the design's new acts ------------------------------------------------------------ */
test("R46: capturerequests and casedrafts, the reads DEC-394's drawings add, have the kit's mark (Reversible, source the kit at the "
   + "commit the marks name); contradictionflag has none, its owner grades it", () => {
  assert.equal(MARKS_KIT_COMMIT, "0310c4953d");
  for (const op of ["capturerequests", "casedrafts"]) {
    assert.equal(MARKS[op], "Reversible", op);
    assert.equal(MARK_SOURCES[op], `mock-kit.js WEIGHT at ${MARKS_KIT_COMMIT}`, op);
  }
  /* control: the flag is a graded write, so it is in no mark table (R42's control: no op in RUNGS has an entry) */
  assert.equal(Object.hasOwn(MARKS, "contradictionflag"), false);
  assert.equal(Object.hasOwn(MARK_SOURCES, "contradictionflag"), false);
});

test("R42 R46: over the registered tables every rungless act of the registry at the marks' commit has a mark, and "
   + "contradictionflag has a rung there", async () => {
  const reg = await registeredOpGrades();
  assert.equal(reg.RUNGS.contradictionflag, "reasoned");
  for (const op of ["capturerequests", "casedrafts"]) {
    assert.equal(Object.hasOwn(reg.RUNGS, op), false, op);
    assert.ok(Object.hasOwn(MARKS, op), op);
  }
  /* control: a read's mark is dropped and the totality names it */
  const { capturerequests: _m, ...WITHOUT } = MARKS;
  assert.equal(Object.hasOwn(WITHOUT, "capturerequests"), false);
});

test("R1 R5 R51: contradictionflag is reasoned (contradiction R61 refuses it without a reason, FLAG_NO_REASON, in the "
   + "justification family), writes are never a non-act too, its reason is its owner's word, and its owner's row agrees", async () => {
  assert.equal(RUNGS.contradictionflag, "reasoned");
  assert.ok(JUSTIFICATION_REFUSALS.includes("FLAG_NO_REASON"));
  assert.equal(NON_ACTS.contradictionflag, declaredSentence("contradiction", "contradictionflag"));
  assert.equal(Object.hasOwn(RUNG_ABSENT, "contradictionflag"), false);
  assert.equal(Object.hasOwn(MACHINE_REFUSALS, "contradictionflag"), false, "contradiction refuses a machine by its own code");
  assert.equal(phoneOf("contradictionflag"), true);
  /* the registration of every owner's declared ops meets no DECLARED_OP_DISAGREES for it (R50 (b)) */
  const reg = await registeredOpGrades();
  assert.equal(reg.RUNGS.contradictionflag, "reasoned");
  assert.equal(reg.NON_ACTS.contradictionflag, NON_ACTS.contradictionflag);
  /* control: a sibling candidate act keeps its grade, and a different op is not backed by the flag's code */
  assert.equal(RUNGS.contradictiontakeup, "reasoned");
  assert.equal(JUSTIFICATION_REFUSALS.filter((c) => c === "FLAG_NO_REASON").length, 1);
});
