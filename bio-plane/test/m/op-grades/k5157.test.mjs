/* op-grades, fix round 10 (T51; K5157, AFFORDANCES #47 J26): `ruleservicesstate`, the read `answers` serves and declares
   (R7, K5131). It writes nothing, so it takes no rung and no ground; it is named in `NON_ACTS` with the owner's own sentence,
   as `moneyingestread` is (R13, R49, R51). Without that row affordances' totality (its R12) reports the read unpublished on
   the merged tranche: this module grades only what its own tables and the registered owners' rows name. `answers` comes after
   this module, so its row is scripted from its R7 and registered, and must agree. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, phoneOf } from "../../../src/op-grades/index.mjs";
import { registeredWith, ownerRow } from "./declared.mjs";

/* the owner's row, scripted from `answers` R7: a read, in the owner's sentence */
const OWNER = { answers: { ruleservicesstate: ownerRow("read", NON_ACTS.ruleservicesstate) } };

test("R13 (K5157): ruleservicesstate is a read: NON_ACTS names it with the owner's sentence, and the owner's `read` row "
   + "(answers R7) registers in agreement; no rung, no ground, not a machine refusal, phone true; control: ruleservicesswitch, the same owner's write, keeps its ground", async () => {
  assert.ok(NON_ACTS.ruleservicesstate.startsWith("read: ") && NON_ACTS.ruleservicesstate.endsWith("writes nothing"));
  const m = await registeredWith(OWNER);
  assert.equal(m.NON_ACTS.ruleservicesstate, NON_ACTS.ruleservicesstate, "the owner's read row agrees (a disagreement refuses the registration)");
  assert.equal(m.phoneOf("ruleservicesstate"), true);
  assert.equal(Object.hasOwn(RUNGS, "ruleservicesstate"), false);
  assert.equal(Object.hasOwn(RUNG_ABSENT, "ruleservicesstate"), false);
  assert.equal(Object.hasOwn(MACHINE_REFUSALS, "ruleservicesstate"), false);
  assert.equal(phoneOf("ruleservicesstate"), true);
  /* control: the owner's write beside it is graded as before, a ground and no sentence of a read */
  assert.equal(RUNG_ABSENT.ruleservicesswitch.ground, "substrate");
  assert.equal(NON_ACTS.ruleservicesswitch.startsWith("read: "), false);
});
