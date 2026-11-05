/* store-assembly: the provider notice ai-runs:323 (PR 323; ai-runs F1, R97). Confirmed, no code change: the assembly spreads
   ai-runs' own op map into the store's (assemble.mjs, `aiRunsOps`) and its declarations carry ai-runs' DECLARED_OPS
   (declarations.mjs), so the store now serves `op=aipathready`, ai-runs' read of the AI path, through the door, once in the
   route map, with ai-runs' own declared row in the assembled table. The totals and op lists this module's tests check
   (declarations.test.mjs) are read from the owners' exports, so they count it with no change. Asked with nothing to ask it
   fails closed (ai-runs' ruled rule, read here, not restated). Fails with `aipathready` dropped from ai-runs' ops. */
import "../../../src/store-assembly/register.mjs";   /* the start's registration first, as declarations.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";
import { aiRunsOps, DECLARED_OPS as AI_RUNS_DECLARED_OPS } from "../../../src/ai-runs/index.mjs";

const OP = "aipathready";

test("notice ai-runs:323 (ai-runs F1, R97): ai-runs' map and declarations name aipathready, and the assembled table holds ai-runs' own row for it", () => {
  const u = new URL(`http://do/${OP}`);
  assert.equal(typeof aiRunsOps({}, u, null)[OP], "function", "ai-runs' map serves aipathready");
  assert.ok(AI_RUNS_DECLARED_OPS[OP], "ai-runs declares aipathready");
  assert.equal(OWNERS["ai-runs"][OP], AI_RUNS_DECLARED_OPS[OP], "the assembled table holds ai-runs' row for it");
});

test("notice ai-runs:323 (ai-runs F1, R97): through the door the store serves aipathready once in its route map, as ai-runs' own read answers it: not an unknown op, a read answer that fails closed with nothing to ask", async () => {
  const x = await store();
  const keys = Object.keys(x.s.routes(new URL(`http://do/${OP}`), null));
  assert.equal(keys.filter((k) => k === OP).length, 1, "aipathready once in the route map");
  const ask = async (qs) => {
    const r = await x.s.dispatch(new Request(`http://do/${OP}?${qs}`));
    const b = await r.json();
    return b.result ?? b;
  };
  for (const qs of ["", "viewer=member:ada", "viewer=member:ada&account_id=a1"]) {
    const got = await ask(qs);
    assert.equal(got.ok, true, `${qs}: ${JSON.stringify(got).slice(0, 300)}`);
    assert.deepEqual([got.state, got.ready], ["not_ready", false], `${qs}: fails closed`);
  }
  assert.equal((await ask("")).reason, "no_viewer");
  assert.equal((await ask("viewer=member:ada")).reason, "no_pair");
});
