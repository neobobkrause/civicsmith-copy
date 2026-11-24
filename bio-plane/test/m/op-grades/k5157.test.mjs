/* op-grades, fix round 10 (T51; K5157, AFFORDANCES #47 J26): `ruleservicesstate`, the read `answers` serves and declares
   (R7, K5131). It writes nothing, so it takes no rung and no ground; it is named in `NON_ACTS` with the owner's own sentence,
   as `moneyingestread` is (R13, R49, R51). Without that row affordances' totality (its R12) reports the read unpublished on
   the merged tranche: this module grades only what its own tables and the registered owners' rows name. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, phoneOf } from "../../../src/op-grades/index.mjs";
import { collectDeclaredOps } from "./declared.mjs";

const here = new URL("../../../../", import.meta.url).pathname;
const owners = await collectDeclaredOps(here);

test("R13 (K5157): ruleservicesstate is a read: answers declares it `read`, not mutating; NON_ACTS names it with the owner's "
   + "sentence; no rung, no ground, not a machine refusal, phone true; control: ruleservicesswitch, the same owner's write, keeps its ground", () => {
  assert.equal(owners.owners.ruleservicesstate, "answers");
  assert.equal(owners.ops.ruleservicesstate.weight, "read");
  assert.equal(owners.ops.ruleservicesstate.mutating, false);
  assert.equal(NON_ACTS.ruleservicesstate, owners.ops.ruleservicesstate.description);
  assert.equal(Object.hasOwn(RUNGS, "ruleservicesstate"), false);
  assert.equal(Object.hasOwn(RUNG_ABSENT, "ruleservicesstate"), false);
  assert.equal(Object.hasOwn(MACHINE_REFUSALS, "ruleservicesstate"), false);
  assert.equal(phoneOf("ruleservicesstate"), true);
  /* control: the owner's write beside it is graded as before, a ground and no sentence of a read */
  assert.equal(RUNG_ABSENT.ruleservicesswitch.ground, "substrate");
  assert.equal(NON_ACTS.ruleservicesswitch.startsWith("read: "), false);
});

test("R13 (K5157): every read answers declares is named in NON_ACTS with its owner's sentence, and none holds a grade", () => {
  const reads = Object.keys(owners.ops).filter((op) => owners.owners[op] === "answers" && owners.ops[op].weight === "read");
  assert.ok(reads.length > 0);
  for (const op of reads) {
    assert.equal(NON_ACTS[op], owners.ops[op].description, op);
    assert.equal(Object.hasOwn(RUNGS, op) || Object.hasOwn(RUNG_ABSENT, op), false, op);
  }
});
