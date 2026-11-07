/* control-plane R53, R2 (notice op-declarations:95; its R30; ai-accounts R35; signin-door's RETIRED_DISCONNECT): EVERY OP THE DOOR
   ROUTES BY NAME IS DECLARED IN THE ASSEMBLED REGISTRATION. The registration is the plane's own: every owner's DECLARED_OPS from
   `build/modules.json` registered beside op-declarations' hand rows (`register-declared.mjs`, the first read of this process), so no
   other module's op is listed here by hand (K3268). The ops routed are read from this module's own source: each name an `op ===`
   comparison routes on. A retired op the door still routes (the member's own `subscriptiondisconnect`, retired with no alias) is
   named here as an op no registration declares, and the test fails while any arm routes it. */
import "./register-declared.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { RETIRED_DISCONNECT } from "../../../src/signin-door/index.mjs";

const SRC = new URL("../../../src/control-plane/", import.meta.url);
const ROUTED = /(?<!typeof\s)\bop\s*===\s*"([a-z0-9]+)"/g;

function routedOps() {
  const out = new Map();
  for (const f of readdirSync(SRC).filter((n) => n.endsWith(".mjs"))) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    for (const m of text.matchAll(ROUTED)) {
      const line = text.slice(0, m.index).split("\n").length;
      if (!out.has(m[1])) out.set(m[1], `${f}:${line}`);
    }
  }
  return out;
}

test("R53 (notice op-declarations:95): every op control-plane routes by name is declared in the assembled registration", () => {
  const routed = routedOps();
  assert.ok(routed.size > 20, "the door's own routes are read");
  const undeclared = [...routed].filter(([op]) => !Object.hasOwn(OPS, op)).map(([op, at]) => `${op} (${at})`);
  assert.deepEqual(undeclared, [], "an op the door routes that no registration declares");
});

test("notice op-declarations:95: the retired subscriptiondisconnect is declared by no registration and routed by no arm here", () => {
  assert.equal(Object.hasOwn(OPS, RETIRED_DISCONNECT), false, "the retired op has no spec (ai-accounts R35, no alias)");
  assert.equal(routedOps().has(RETIRED_DISCONNECT), false, "no arm of the door routes the retired op");
});
