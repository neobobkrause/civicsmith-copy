/* op-declarations, notice money:154 (PR 154; money R27, R40). money declares and serves its fiscal-years read as
   `moneyfiscalyears`; no module serves `fiscalyears`. Adapted here: `fiscalyears` leaves ACT_HELP_ABSENT's read ground,
   since R34 names no op OPS does not hold and R6 gives no spec without a handler. Ops are read from money's own map and
   declarations (K3268). */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_STAMPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { moneyOps } from "../../../src/money/index.mjs";
import { explained } from "./help.mjs";

const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
const served = Object.keys(moneyOps(stub, new URL("http://plane/"), {}));

test("notice money:154 (R34, R6): every op ACT_HELP_ABSENT names has a spec, so a name money no longer serves is named under no ground (negative control: a name with no spec is seen)", () => {
  const named = Object.values(ACT_HELP_ABSENT).flatMap((g) => [...g.ops]);
  const orphans = named.filter((op) => !Object.hasOwn(OPS, op));
  assert.deepEqual(orphans, [], `named with no spec: ${orphans}`);
  /* negative control */
  assert.ok([...named, "nosuchmoneyread"].some((op) => !Object.hasOwn(OPS, op)));
});

test("notice money:154 (money R27, R40): every op money serves and declares has a spec, its member reads explained or under one ground", () => {
  for (const op of served) assert.ok(Object.hasOwn(OPS, op), `${op}: served, no spec`);
  for (const [op, row] of Object.entries(REGISTERED.money ?? {})) {
    assert.equal(OPS[op].mutating, row.mutating, op);
    if (!row.mutating && SESSION_OPS.member.has(op) && !explained(op)) {
      const g = Object.entries(ACT_HELP_ABSENT).filter(([, x]) => x.ops.includes(op)).map(([k]) => k);
      assert.equal(g.length, 1, `${op}: a member read with no text, under ${g.length} grounds`);
      assert.ok(OP_STAMPS[op].includes("viewer"), `${op}: no viewer stamp`);
    }
  }
  assert.ok(served.includes("moneyfiscalyears"));
});
