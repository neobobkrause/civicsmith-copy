/* op-declarations, notice connections:71 (PR 71; connections R65, R74-R77). PR 71 adds the hop kind `named_in` to the
   `neighbours` read connection-grammar routes, restates R65's hub shape, checks a document's sight in `named_in` and
   registers the project-reach reader through membership. None of it is an op: connections' ops map and its
   DECLARED_OPS are unchanged, so nothing here changes. Confirmed: each op connections declares is served by its map
   and has a spec that agrees with its row, the hop kinds are not ops, and the stepsource acts keep their stamps. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, OP_STAMPS } from "../../../src/op-declarations/index.mjs";
import { connectionsOps, DECLARED_OPS, CONNECTIONS_KINDS } from "../../../src/connections/index.mjs";

const served = () => Object.keys(connectionsOps({}, new URL("http://plane/"), {}, {}));

test("notice connections:71: each op connections declares is served and has a spec that agrees with its row", () => {
  for (const [op, row] of Object.entries(DECLARED_OPS)) {
    assert.ok(served().includes(op), `${op} is not served`);
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual([...OPS[op].classes].sort(), [...row.classes].sort(), `${op}: classes`);
    assert.equal(OPS[op].mutating, row.mutating, `${op}: mutating`);
  }
  /* negative control: an op connections does not serve is not among them */
  assert.equal(served().includes("neighbours"), false);
});

test("notice connections:71: the hop kinds, named_in among them, are kinds of a read, never ops", () => {
  const kinds = CONNECTIONS_KINDS.map((k) => k.kind ?? k.name ?? k);
  assert.ok(kinds.includes("named_in"), `named_in is not registered: ${JSON.stringify(kinds)}`);
  for (const k of kinds) assert.equal(Object.hasOwn(OPS, k), false, `${k} is declared as an op`);
  /* the stepsource acts keep the session's member and viewer stamps (R67) */
  for (const op of ["stepsource", "stepsourcewithdraw"]) {
    assert.ok(OP_STAMPS[op].includes("member") && OP_STAMPS[op].includes("viewer"), op);
  }
});
