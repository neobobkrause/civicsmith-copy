/* money F1 (store-request job, 4 Nov; R18, R27): the ops money declares are the ops its map serves. A declared op is a key of
   `moneyOps`, or the door's alias (op-declarations' `OP_ALIASES`) for one; every op the map serves is declared, by this module's
   `DECLARED_OPS` (itself or through an alias) or by op-declarations' own table. `fiscalyears` was declared while
   `moneyfiscalyears` was served, so neither held. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECLARED_OPS, moneyOps } from "../../../src/money/index.mjs";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";

const served = Object.keys(moneyOps({}, new URL("http://x/"), null));
const servedOf = (op) => (served.includes(op) ? op : served.includes(OP_ALIASES[op]) ? OP_ALIASES[op] : null);

test("F1: every op money declares is served by its ops map, and every op served is declared", () => {
  const unserved = Object.keys(DECLARED_OPS).filter((op) => servedOf(op) === null);
  assert.deepEqual(unserved, [], "declared but served by no arm");
  const byDeclaration = new Set(Object.keys(DECLARED_OPS).map(servedOf));
  const undeclared = served.filter((op) => !byDeclaration.has(op) && !Object.hasOwn(OPS, op));
  assert.deepEqual(undeclared, [], "served but declared nowhere");
  assert.equal(servedOf("moneyfiscalyears"), "moneyfiscalyears");
  assert.equal(Object.hasOwn(DECLARED_OPS, "fiscalyears"), false, "the unserved name is not declared");
});

test("F1 control: an op declared under a name no arm serves is found, as is an arm declared nowhere", () => {
  assert.equal(servedOf("worldprobeop"), null);
  assert.equal(["worldprobeop"].filter((op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(DECLARED_OPS, op)).length, 1);
});
