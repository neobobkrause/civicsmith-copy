/* op-declarations, notices wizard-scripts:98 (PR 98; its R54: the registry re-taken at 30af4350f2) and wizard-scripts:163
   (PR 163; source only). Confirmed with no code change here. R21: every act the carried registry marks declared or
   function is an op OPS holds (or an alias of one), as wizard-scripts carries it; the account-seam ops ai-accounts R35
   retired (`connect`'s accountreferenceset and accountreferenceremove among them) are carried as their T53 acts and have
   no spec here (R6, R20, R24, R41). Every op wizard-scripts serves has a spec. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, OP_ALIASES } from "../../../src/op-declarations/index.mjs";
import { SCREEN_REGISTRY, SCREEN_REGISTRY_SOURCE, registryActGaps, wizardScriptsOps } from "../../../src/wizard-scripts/index.mjs";
import { RETIRED_T53 } from "./help.mjs";

const declared = new Set([...Object.keys(OPS), ...Object.keys(OP_ALIASES)]);

test("notice wizard-scripts:98 (R21; wizard-scripts R54): every declared or function act of the registry at its pin is a declared op (negative control: a dropped op is a gap)", () => {
  assert.ok(typeof SCREEN_REGISTRY_SOURCE.commit === "string" && SCREEN_REGISTRY_SOURCE.commit.length > 0);
  const gaps = registryActGaps({ screens: SCREEN_REGISTRY, declared }).filter((g) => !g.owed);
  assert.deepEqual(gaps, []);
  const one = SCREEN_REGISTRY.flatMap((s) => s.acts)[0];
  const less = new Set(declared); less.delete(one);
  assert.ok(registryActGaps({ screens: SCREEN_REGISTRY, declared: less }).some((g) => g.act === one && !g.owed));
});

test("notice wizard-scripts:98 (R20, R24, R41; ai-accounts R35): no registry act is a retired account-seam op, and none of those has a spec", () => {
  const acts = new Set(SCREEN_REGISTRY.flatMap((s) => s.acts));
  for (const op of RETIRED_T53) {
    assert.equal(acts.has(op), false, `the registry carries ${op}`);
    assert.equal(Object.hasOwn(OPS, op), false, `${op} has a spec`);
  }
});

test("notice wizard-scripts:163: every op wizard-scripts serves has a spec (R6)", () => {
  const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
  const served = Object.keys(wizardScriptsOps(stub, new URL("http://plane/"), {}));
  assert.ok(served.length > 0);
  for (const op of served) assert.ok(Object.hasOwn(OPS, op), `${op}: served, no spec`);
});
