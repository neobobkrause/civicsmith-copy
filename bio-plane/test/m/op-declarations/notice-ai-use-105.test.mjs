/* op-declarations, notice ai-use:105 (PR 105). ai-use changed its requirements and exports (its health, thresholds and
   per-member use among them). Confirmed with no code change here: every op ai-use serves has a spec (R6), its declared
   rows agree with the tables (R81), and each member op it serves is explained or named under one ground (R34). The ops
   are read from ai-use's own map and declarations, never a hand list (K3268). */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_STAMPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { aiUseOps } from "../../../src/ai-use/index.mjs";
import { explained } from "./help.mjs";

const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
const served = Object.keys(aiUseOps(stub, new URL("http://plane/"), {}, null));
const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

test("notice ai-use:105 (R6, R81): every op ai-use serves has a spec, and its declared rows agree with the tables (negative control: an op it does not serve has none)", () => {
  assert.ok(served.length > 0);
  for (const op of served) assert.ok(Object.hasOwn(OPS, op), `${op}: served, no spec`);
  for (const [op, row] of Object.entries(REGISTERED["ai-use"] ?? {})) {
    assert.equal(OPS[op].mutating, row.mutating, op);
    assert.deepEqual([...(OPS[op].classes ?? [])].sort(), [...(row.classes ?? [])].sort(), op);
    if (row.stamps && OP_STAMPS[op] !== undefined) assert.deepEqual([...OP_STAMPS[op]].sort(), [...row.stamps].sort(), op);
  }
  assert.equal(Object.hasOwn(OPS, "aiusenosuchop"), false);
});

test("notice ai-use:105 (R34): each member op ai-use serves is explained or under exactly one ground", () => {
  const member = served.filter((op) => SESSION_OPS.member.has(op));
  assert.ok(member.length > 0);
  for (const op of member) assert.equal(grounds(op).length, explained(op) ? 0 : 1, op);
});
