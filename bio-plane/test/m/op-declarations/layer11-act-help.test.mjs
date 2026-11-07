/* op-declarations, layer 11 (R34; F2): the member ops ai-use (F3, PR 613), extraction (its interpretation marks) and
   instance-setup (R115) declare on layer 11 with no `ACT_HELP` text yet are each named under exactly one ground of
   `ACT_HELP_ABSENT`: an act (mutating) under the unexplained ground, a read under the read ground. The ops are read from
   their owners' own declarations as registered (K3268), never a hand list of another module's ops. */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";

const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
const OWNERS = ["ai-use", "extraction", "instance-setup"];

test("R34, F2 (layer 11): every member op ai-use, extraction and instance-setup declare is explained in ACT_HELP or named under exactly one ground, an unexplained act under `unexplained` and an unexplained read under `read` (negative control: an op in neither is seen)", () => {
  let unexplainedCount = 0;
  for (const owner of OWNERS) {
    const rows = REGISTERED[owner] ?? {};
    assert.ok(Object.keys(rows).length > 0, `${owner} declares nothing`);
    for (const [op, row] of Object.entries(rows)) {
      if (!SESSION_OPS.member.has(op)) continue;
      assert.ok(Object.hasOwn(OPS, op), `${op}: declared, no spec`);
      const g = grounds(op);
      if (explained(op)) { assert.deepEqual(g, [], `${op}: explained and named`); continue; }
      unexplainedCount++;
      assert.equal(g.length, 1, `${owner}'s ${op}: neither explained nor named under one ground (${g.join(",")})`);
      if (row.mutating) assert.notEqual(g[0], "read", `${op}: an act under the read ground`);
      else assert.ok(["read", "nocontrol"].includes(g[0]), `${op}: a read under ${g[0]}`);
    }
  }
  assert.ok(unexplainedCount > 0);
  /* control: a member op dropped from every ground and not explained is seen */
  const seen = (op) => explained(op) || grounds(op).length === 1;
  assert.equal(seen("nosuchmemberop"), false);
});
