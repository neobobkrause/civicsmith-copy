/* Provider notice answers:103 (answers R1, PR 103): ASK_SCOPE is now credentials' AI_GRANT_OPS less `aicredential`, the agent
   Worker's own credential read (ai-accounts R65), which an ask never makes. This door logs a read under an ask's grant only
   when `askAdmits` admits its op (R11), so it follows the narrowed scope with no change of its own: `aicredential` served under
   a grant header is answered as served and never handed to the grant's read log, while every op of the scope still is. The
   lists are read from their owners, never hand-listed here. Fails with PR 103 reverted (`aicredential` back in the scope). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { go } from "./harness.mjs";
const { GRANT_HEADER } = await import("../../../src/store-door/dispatch.mjs");
const { ASK_SCOPE, askAdmits } = await import("../../../src/answers/scope.mjs");
const { AI_GRANT_OPS } = await import("../../../src/credentials/index.mjs");

const grantOps = () => (Array.isArray(AI_GRANT_OPS) ? AI_GRANT_OPS : Object.keys(AI_GRANT_OPS)).map((x) => (typeof x === "string" ? x : x.op));

test("notice answers:103 (answers R1; store-door R11): a read of `aicredential` under an ask's grant is answered as served and never handed to the grant's read log, since the asking scope no longer holds it; every other op the grant's class holds is still logged as before (control: each ASK_SCOPE op is logged once)", async () => {
  const ops = grantOps();
  assert.equal(ops.includes("aicredential"), true, "credentials' grant class still holds aicredential");
  assert.equal(askAdmits("aicredential"), false);
  const scope = ASK_SCOPE.map((x) => x.op).filter((op) => op !== "rule");
  const logged = [];
  const routes = Object.fromEntries([...scope, "aicredential"].map((op) => [op, () => ({ op, served: true })]));
  const store = { routes: () => routes, membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }),
                  logRead: (e) => { logged.push(e.op); return { op: e.op, logged: true }; } };
  const G = { [GRANT_HEADER]: "G-103" };
  const cred = await go(store, "aicredential?viewer=member:ann&account_id=acct-1", { headers: G });
  assert.deepEqual([cred.status, cred.json], [200, { ok: true, result: { op: "aicredential", served: true } }]);
  assert.deepEqual(logged, [], "aicredential is not logged under a grant");
  for (const op of scope) {
    const r = await go(store, `${op}?viewer=member:ann`, { headers: G });
    assert.deepEqual(r.json.result, { op, logged: true }, op);
  }
  assert.deepEqual(logged, scope);
});
