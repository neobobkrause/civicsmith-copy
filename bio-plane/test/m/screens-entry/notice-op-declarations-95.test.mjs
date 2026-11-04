/* Provider notice op-declarations:95 (its R20, R24, R30, R41 restated for T53, `ai-accounts` R35): the team's key ops
   (`groupkeyset`, `groupkeyswitch`, `groupkeystate`, ...) are retired with no alias, and `aiaccountadd`, `aiaccountswitch`
   and the read `accountsof` take their place (op-declarations R24). `setup` (R6, R22) acts and reads only ops `OPS`
   holds, so `interface-shell`'s `checkScreens` accepts this module's screens and the page is served (before, every page
   of the plane answered 500: "screen setup's act names groupkeyset, which OPS does not hold"). */
import test from "node:test";
import assert from "node:assert/strict";
import { SCREENS } from "./kit.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { checkScreens } from "../../../src/interface-shell/index.mjs";

const setup = SCREENS.find((s) => s.id === "setup");
// the founder signed in with her handle, who reads every part (R19, R22)
const FOUNDER = { me: { session: true, rootOfTrust: true, handle: "rivera" } };

test("notice op-declarations:95 checkScreens accepts this module's screens against the current OPS", () => {
  assert.doesNotThrow(() => checkScreens(SCREENS));
  assert.equal(checkScreens(SCREENS), true);
});

test("notice op-declarations:95 setup's acts and reads name only ops OPS holds: the team's key is aiaccountadd, its switch aiaccountswitch, its state accountsof", () => {
  const acts = setup.acts.map((a) => a.op);
  for (const op of acts) assert.ok(Object.hasOwn(OPS, op), `setup's act ${op} is not in OPS`);
  for (const op of ["aiaccountadd", "aiaccountswitch"]) assert.ok(acts.includes(op), op);
  const reads = Object.values(setup.reads(FOUNDER));
  for (const r of reads) assert.ok(Object.hasOwn(OPS, r.op), `setup's read ${r.op} is not in OPS`);
  assert.deepEqual(reads.find((r) => r.op === "accountsof").query, { owner: "group" });
  // control: the retired ops are held by OPS no more, and setup names none of them
  for (const op of ["groupkeyset", "groupkeyswitch", "groupkeystate"]) {
    assert.ok(!Object.hasOwn(OPS, op), `${op} is still in OPS`);
    assert.ok(!acts.includes(op) && !reads.some((r) => r.op === op), `setup still names ${op}`);
  }
});
