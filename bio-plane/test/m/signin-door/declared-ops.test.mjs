/* signin-door F3 (coordinator ruling 5 Nov 08:01; op-grades R57: a retired op is in no table; R6 retired): the module
   declares no op. `subscriptionsignin` is retired and replaced by `aisignin` (ai-accounts, op-declarations R90), so
   signin-door's DECLARED_OPS is empty and its registration puts no row for it in the registry. The control names an op
   that keeps its hand row in op-declarations both before and after op-declarations PR 430 (`clockpropose`, its row as
   its owner publishes it), so a refusal on disagreement is still shown to hold. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerDeclaredOps, declaredFields } from "../../../src/op-declarations/index.mjs";
import { OWNER_MAP_DECLARED_OPS } from "../../../src/store-assembly/owner-ops.mjs";
import { DECLARED_OPS } from "../../../src/signin-door/index.mjs";

test("F3 signin-door declares no op: DECLARED_OPS is frozen and empty, and `subscriptionsignin` is not in it", () => {
  assert.equal(Object.isFrozen(DECLARED_OPS), true);
  assert.deepEqual(Object.keys(DECLARED_OPS), []);
  assert.equal(Object.hasOwn(DECLARED_OPS, "subscriptionsignin"), false);
});

test("F3 the registration takes signin-door's empty table and leaves no declared fields for `subscriptionsignin`; control: a row whose stamps disagree with an op's hand row is refused naming the op", () => {
  const op = "clockpropose";
  const wrong = { ...OWNER_MAP_DECLARED_OPS[op], stamps: ["viewer"] };
  assert.throws(() => registerDeclaredOps([["signin-door", { [op]: wrong }]]),
    (e) => e.message.includes(op) && /differs from the hand row on/.test(e.message));
  registerDeclaredOps([["signin-door", DECLARED_OPS]]);
  assert.equal(declaredFields("subscriptionsignin"), undefined);
});
