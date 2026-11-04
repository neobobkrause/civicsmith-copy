/* agent-worker over answers PR 103 (answers R1, as BOB ruled 4 Nov): ASK_SCOPE now equals credentials' AI_GRANT_OPS
 * less `aicredential`, ai-accounts' R65 read of the act's own sealed key, which serves the agent Worker alone. This
 * member's R55 holds ASK_OPS equal to both: equal to ASK_SCOPE both ways, and to AI_GRANT_OPS less GRANT_ONLY_OPS
 * (exactly `aicredential`). The read tool never offers it, and admitRead refuses it before any plane call. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ASK_OPS, GRANT_ONLY_OPS } from "../src/ops.mjs";
import { admitRead } from "../src/ask.mjs";
import { ASK_SCOPE } from "../../bio-plane/src/answers/scope.mjs";
import { AI_GRANT_OPS } from "../../bio-plane/src/credentials/index.mjs";

test("notice answers:103 (R55): ASK_OPS equals answers' ASK_SCOPE, both ways", () => {
  const scope = ASK_SCOPE.map((e) => e.op);
  assert.deepEqual([...ASK_OPS].sort(), [...scope].sort());
});

test("notice answers:103 (R55): ASK_OPS equals credentials' AI_GRANT_OPS less exactly GRANT_ONLY_OPS (aicredential)", () => {
  assert.deepEqual([...GRANT_ONLY_OPS], ["aicredential"]);
  assert.ok(GRANT_ONLY_OPS.every((o) => AI_GRANT_OPS.includes(o)), "each grant-only op is on the grant's class");
  assert.deepEqual([...ASK_OPS].sort(), AI_GRANT_OPS.filter((o) => !GRANT_ONLY_OPS.includes(o)).sort());
});

test("notice answers:103 (R55): an ask's read naming aicredential is refused ASK_OP_REFUSED; control: a scope read is admitted", () => {
  assert.equal(admitRead({ op: "aicredential", args: {} }).refused?.code, "ASK_OP_REFUSED");
  assert.equal(admitRead({ op: "entity", args: { id: "E-1" } }).refused, undefined);
});
