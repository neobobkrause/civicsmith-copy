/* affordances F3 (T53; op-grades R55, BOB C13; coordinator ruling 5 Nov 04:19): op-grades grades the register ops from their
   owners' declarations, and two of its tables gain register rows: MACHINE_REFUSALS takes the register writes (which are not
   ACTS rows), IRREVERSIBLE_WEIGHT takes rowexpunge. This module publishes those tables by reference (R4, R20, R36) and its
   tests admit the rows: a MACHINE_REFUSALS key that is no ACTS row is admitted only when `registers` declares it, read from
   the owners' registration (register-owners.mjs), never listed here (K3268). The tables' content is op-grades'. */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "../../../src/op-grades/index.mjs";
import { ACTS, VOCABULARIES, decorate } from "../../../src/affordances.mjs";

const REG = REGISTERED.registers ?? {};
const isAct = (op) => ACTS.some((a) => a.id === op);
const admittedMachine = (op) => isAct(op) || Object.hasOwn(REG, op);

test("F3: every MACHINE_REFUSALS key is an ACTS row or an op `registers` declares, each with a MACHINE_* code", () => {
  for (const [op, code] of Object.entries(G.MACHINE_REFUSALS)) {
    assert.ok(admittedMachine(op), op);
    if (!isAct(op)) assert.match(String(code), /^MACHINE_/, op);
  }
  /* control: an op no owner declares and no ACTS row holds is not admitted */
  assert.equal(admittedMachine("nosuchop"), false);
  assert.equal(admittedMachine("guideoptout"), false);
});

test("F3: rowexpunge, when IRREVERSIBLE_WEIGHT holds it, is `registers`' op, answers phone false and is in no larger-screen "
   + "set; the table is published by reference", () => {
  assert.equal(VOCABULARIES.irreversible_weight, G.IRREVERSIBLE_WEIGHT);
  assert.deepEqual(G.LARGER_SCREEN_ACTS.filter((op) => G.IRREVERSIBLE_WEIGHT.includes(op)), []);
  for (const op of G.IRREVERSIBLE_WEIGHT) {
    assert.equal(G.phoneOf(op), false, op);
    assert.equal(decorate({ id: op, label: "x" }, null).phone, false, op);
  }
  if (G.IRREVERSIBLE_WEIGHT.includes("rowexpunge")) assert.ok(Object.hasOwn(REG, "rowexpunge"));
  /* the four held before R55 stay */
  for (const op of ["personexpunge", "publishat", "publishatmove", "standardrelease"]) assert.ok(G.IRREVERSIBLE_WEIGHT.includes(op), op);
});
