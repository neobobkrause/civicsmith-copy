/* op-grades R57 (T53; ai-accounts R35, op-declarations R90): the alpha's AI ops leave the grade tables. The retired ops are
   read from R57's own sentence ("The alpha's … are in no table"), never typed here; each must be in none of RUNGS,
   RUNG_ABSENT, NON_ACTS or MACHINE_REFUSALS, in the hand tables and with every owner's `DECLARED_OPS` registered (R49).
   `subscriptionsignin`, which R57 names among them, is still served and declared by `signin-door` (its R1–R4), so its owner's
   row grades it at registration; that conflict is BOB's (a todo below), and the op is held apart until it is ruled. */
import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../../../src/op-grades/index.mjs";
import { reqText, between, tickedAll, collectDeclaredOps, registeredOpGrades } from "./declared.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const TABLES = ["RUNGS", "RUNG_ABSENT", "NON_ACTS", "MACHINE_REFUSALS"];
const tablesOf = (m, op) => TABLES.filter((t) => Object.hasOwn(m[t], op));

const NAMED = tickedAll(between(reqText(57), "The alpha's ", " are in no table"));
const { ops: DECLARED } = await collectDeclaredOps(ROOT);
/* an op R57 names that an owner still declares is not retired at its door: held apart for BOB's ruling */
const STILL_DECLARED = NAMED.filter((op) => Object.hasOwn(DECLARED, op));
const RETIRED = NAMED.filter((op) => !Object.hasOwn(DECLARED, op));
const R = await registeredOpGrades();

test("R57: of the fifteen alpha AI ops R57 names, none an owner declares is in any grade table, in the hand tables or with "
   + "every owner's rows registered, and none carries a weight, larger-screen entry or consequence statement", () => {
  assert.equal(new Set(NAMED).size, 15);
  assert.deepEqual(STILL_DECLARED, ["subscriptionsignin"]);
  for (const m of [G, R]) for (const op of RETIRED) assert.deepEqual(tablesOf(m, op), [], op);
  for (const op of RETIRED) {
    assert.ok(!G.IRREVERSIBLE_WEIGHT.includes(op), op);
    assert.ok(!G.LARGER_SCREEN_ACTS.includes(op), op);
    assert.ok(!Object.hasOwn(G.CONSEQUENCE_STATEMENTS, op), op);
  }
  /* control: a still-graded sibling of the same family is in its table, so an empty answer is not a broken lookup */
  assert.deepEqual(tablesOf(G, "keyedserviceset"), ["RUNG_ABSENT", "NON_ACTS"]);
  assert.deepEqual(tablesOf(R, "aiaccountadd").includes("RUNGS"), true);
});

test.todo("R57: subscriptionsignin is in no table — signin-door still serves and declares it (ground credential), so BOB "
  + "rules whether R57 retires it or keeps signin-door's grade");
test.todo("R57: the assistant's ops R57 grades that no owner serves yet (op-declarations' budget rows keep their names for "
  + "the owners that will declare them) are graded, and the three Worker ops take R57's grounds");
