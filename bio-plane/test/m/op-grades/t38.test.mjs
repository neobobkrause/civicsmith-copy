/* op-grades: T38's grade (R28), at the module's exports. The withdrawal of a mark on a photo (case-carriage R14,
   op-declarations R40) graded `reasoned`, its code joining the family, and the mark itself (case-carriage R9) moved from
   RUNG_ABSENT to `reversible` now that a published act takes it back; each by R5 and R3. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import { T38_RUNGS, T38_NON_ACTS } from "../../../src/op-grades/t38.mjs";
import * as T38 from "../../../src/op-grades/t38.mjs";
import { declaredSentence } from "./declared.mjs";

/** @param {string} op */
const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op]?.ground : null;
const R28_WRITES = { obscuremarkwithdraw: "reasoned", obscuremark: "reversible" };
const WITHDRAW = declaredSentence("case-carriage", "obscuremarkwithdraw");
const MARK = declaredSentence("case-carriage", "obscuremark");

test("R28: obscuremarkwithdraw `reasoned`, backed by case-carriage R14's WITHDRAW_NO_REASON (C-141.10) in JUSTIFICATION_REFUSALS, with R28's photo-directed reason; obscuremark leaves RUNG_ABSENT for `reversible`, taken back by the withdrawal; neither a machine refusal (case-carriage refuses MACHINE_CANNOT_WITHDRAW_MARK itself); both phone acts; no statement, weight or larger-screen entry added", () => {
  const got = Object.fromEntries(Object.keys(R28_WRITES).map((op) => [op, gradeOf(op)]));
  assert.deepEqual(got, R28_WRITES);
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "obscuremark"));
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "obscuremarkwithdraw"));
  /* the backing: the owner's code for an absent reason is in the family, once */
  assert.equal(JUSTIFICATION_REFUSALS.filter((c) => c === "WITHDRAW_NO_REASON").length, 1);
  /* reversible on R3's rule: the act that takes a mark back is itself graded */
  assert.equal(RUNGS.obscuremark, "reversible");
  assert.notEqual(gradeOf("obscuremarkwithdraw"), null);
  /* the reasons */
  assert.equal(NON_ACTS.obscuremarkwithdraw, WITHDRAW);
  assert.equal(NON_ACTS.obscuremark, MARK);
  for (const op of Object.keys(R28_WRITES)) assert.ok(NON_ACTS[op]?.startsWith("capture-directed:") === false, op);
  /* the machine is refused by case-carriage's own code, never through MACHINE_REFUSALS */
  assert.deepEqual(Object.keys(R28_WRITES).filter((op) => Object.hasOwn(MACHINE_REFUSALS, op)), []);
  assert.ok(!Object.values(MACHINE_REFUSALS).includes("MACHINE_CANNOT_WITHDRAW_MARK"));
  assert.ok(!Object.values(MACHINE_REFUSALS).includes("MACHINE_CANNOT_MARK_PHOTO"));
  assert.deepEqual(Object.keys(R28_WRITES).map(phoneOf), [true, true]);
  for (const op of Object.keys(R28_WRITES)) {
    assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, op), op);
    assert.ok(!IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(OP_ALIASES, op), op);
  }
  /* negative controls */
  assert.notDeepEqual({ ...got, obscuremarkwithdraw: "undetermined" }, R28_WRITES);
  assert.ok(!JUSTIFICATION_REFUSALS.includes("NO_SUCH_MARK"), "an object demanded is not a reason");
});

test("R28: T38's tables hold exactly these two ops and state no absence; nothing is both graded and stated absent", () => {
  assert.deepEqual(Object.keys(T38_RUNGS).sort(), ["obscuremark", "obscuremarkwithdraw"]);
  assert.deepEqual(Object.keys(T38_NON_ACTS), ["obscuremarkwithdraw"]);
  assert.deepEqual(Object.keys(T38).sort(), ["T38_NON_ACTS", "T38_RUNGS"]);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
});
