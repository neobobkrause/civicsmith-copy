/* wizard-scripts F1 (T53; store-assembly PR 242, interface-shell PR 172; amends R51): ADMIN_ACTS names no op op-declarations'
   OPS does not hold. It named the retired group-key acts (ai-accounts R35, R36), which store-assembly hands on to the
   registration unchanged, and scanmirror and officeconfirm. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { ADMIN_ACTS } from "../../../src/wizard-scripts/index.mjs";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";

const unheld = (acts) => [...acts].filter((op) => !Object.hasOwn(OPS, op));

test("F1 ADMIN_ACTS names no op OPS does not hold, and no op ai-accounts retired; control: a retired name added is seen", () => {
  assert.deepEqual(unheld(ADMIN_ACTS), [], "every administrator act is an op OPS holds");
  assert.deepEqual([...ADMIN_ACTS].filter((op) => Object.hasOwn(RETIRED_ACTS, op)), [], "no retired act");
  for (const op of ["groupkeyset", "groupkeyremove", "groupkeyswitch"]) assert.ok(!ADMIN_ACTS.has(op), op);
  /* the T53 acts that replace them are a member's too, so they are not administrators' acts */
  for (const op of ["aiaccountadd", "aiaccountswitch", "aiaccountremove"]) assert.ok(!ADMIN_ACTS.has(op), op);
  assert.deepEqual(unheld(new Set([...ADMIN_ACTS, "groupkeyset"])), ["groupkeyset"]);
});
