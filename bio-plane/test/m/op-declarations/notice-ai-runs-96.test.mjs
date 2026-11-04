/* op-declarations, notice ai-runs:96 (PR 96). ai-runs now serves a member's acts on a run that waits or is refused, and a
   read of a run's parts, each declared in its own DECLARED_OPS (registered as the plane registers them, R80). Adapted
   here: R34 holds over them, so each member op ai-runs serves is explained in affordances' ACT_HELP or named under one
   ground of ACT_HELP_ABSENT, an act under the unexplained ground and a read under the read ground, until ACT_HELP holds
   its text. The ops are read from ai-runs' own map and declarations, never a hand list (K3268). */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_STAMPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { explained } from "./help.mjs";

const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
const served = Object.keys(aiRunsOps(stub, new URL("http://plane/"), {}));
const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

test("notice ai-runs:96: every op ai-runs serves has a spec agreeing with its declaration (R6, R81)", () => {
  assert.ok(served.length > 0);
  for (const op of served) assert.ok(Object.hasOwn(OPS, op), `${op}: served, no spec`);
  const declared = REGISTERED["ai-runs"];
  assert.ok(declared && Object.keys(declared).length > 0, "ai-runs declares nothing");
  for (const [op, row] of Object.entries(declared)) {
    assert.equal(OPS[op].mutating, row.mutating, `${op}: mutating`);
    assert.deepEqual([...(OPS[op].classes ?? [])].sort(), [...(row.classes ?? [])].sort(), `${op}: classes`);
    /* PR 96's member choices read their member as the door's actor, else its viewer: the declared row's stamps reach them */
    if (OP_STAMPS[op] !== undefined) assert.deepEqual([...OP_STAMPS[op]].sort(), [...(row.stamps ?? ["viewer"])].sort(), `${op}: stamps`);
  }
  /* negative control */
  assert.equal(Object.hasOwn(OPS, "airunnosuchact"), false);
});

test("notice ai-runs:96 (R34): each member op ai-runs serves is explained or under exactly one ground, its acts unexplained and its reads read (negative control: an explained op is under none)", () => {
  const member = served.filter((op) => SESSION_OPS.member.has(op));
  assert.ok(member.length > 0, "ai-runs serves no member op");
  for (const op of member) {
    const g = grounds(op);
    if (explained(op)) { assert.deepEqual(g, [], `${op}: explained and named`); continue; }
    assert.equal(g.length, 1, `${op}: under ${g.length} grounds`);
    if (!["nocontrol"].includes(g[0])) assert.equal(g[0], OPS[op].mutating ? "unexplained" : "read", `${op}: under ${g[0]}`);
  }
  /* the acts PR 96 added that wait for no text: at least one act and one read are grounded */
  assert.ok(member.some((op) => !explained(op) && OPS[op].mutating && grounds(op)[0] === "unexplained"));
  assert.ok(member.some((op) => !explained(op) && !OPS[op].mutating && grounds(op)[0] === "read"));
  /* negative control */
  const anExplained = [...SESSION_OPS.member].find(explained);
  assert.deepEqual(grounds(anExplained), []);
});
