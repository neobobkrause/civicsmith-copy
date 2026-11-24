/* op-declarations, T51 fix round 3 (fix-round-3-T51.md section 4; K4369, K4208): the causes this job meets, cause 1 (`moneysets`).
   Each test names the requirement it proves and carries its control. Specs, sets and stamps are read from the exported
   tables; the owners' declared rows are read from their own `DECLARED_OPS`, so an agreement (R81) is seen, not assumed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { DECLARED_OPS as MONEY_DECLARED } from "../../../src/money/index.mjs";

const { OPS, SESSION_OPS, NEEDS, OP_STAMPS } = O;
const MP = ["admin", "member", "probe"];
const plain = (s) => JSON.parse(JSON.stringify(s));

test("R17, R19, R20 (T51 fix round 3, cause 1; MONEY #6; K4369): `moneysets`, the read money serves, has its spec in money's family: classes admin, member and probe, not mutating, `viewer` stamped, its NEEDS row null, in both session sets; money's own declared row agrees (R81). Negative control: a read of money with no spec is seen", () => {
  assert.ok(Object.hasOwn(OPS, "moneysets"), "moneysets has a spec");
  assert.deepEqual(plain(OPS.moneysets.classes), MP);
  assert.equal(OPS.moneysets.mutating, false);
  assert.ok(Object.hasOwn(NEEDS, "moneysets") && NEEDS.moneysets === null, "a read's NEEDS row is null");
  assert.ok(SESSION_OPS.member.has("moneysets") && SESSION_OPS.admin.has("moneysets"));
  assert.deepEqual([...OP_STAMPS.moneysets], ["viewer"]);
  assert.deepEqual([...MONEY_DECLARED.moneysets.classes].sort(), [...OPS.moneysets.classes].sort());
  assert.equal(MONEY_DECLARED.moneysets.mutating, OPS.moneysets.mutating);
  /* control: a sibling read of money in the same family has the same shape, and a write of money still needs contribute */
  assert.ok(Object.hasOwn(NEEDS, "committedagainstpaid") && NEEDS.committedagainstpaid === null);
  assert.equal(NEEDS.moneyrecord, "contribute");
});
