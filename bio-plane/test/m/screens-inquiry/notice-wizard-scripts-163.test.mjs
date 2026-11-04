/* Provider notice wizard-scripts:163 (PR 163; its RETIRED_ACTS and currentAct): the registry's acts are carried as the T53 ops
 * that do them, so its `projectai` row no longer lists the five retired project* acts. This module's `projectai` screen drew
 * them; R14 is retired (T53) and R153 links the project to `aiproject` instead, so the module serves no `projectai` screen
 * and none of its screens names a retired act. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { interfacePage } from "../../../src/interface-shell/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";
import { SCREENS, open, main, P } from "./fixtures.mjs";

test("notice wizard-scripts:163: no screen of this module names an act wizard-scripts retires, and the shell serves them", () => {
  assert.equal(SCREENS.some((s) => s.id === "projectai"), false, "projectai is not served (R14 retired; R153)");
  for (const s of SCREENS) for (const a of s.acts) {
    assert.ok(!Object.hasOwn(RETIRED_ACTS, a.op), `${s.id}: ${a.op} is retired`);
    assert.ok(Object.hasOwn(OPS, a.op) || !/^project/.test(a.op), `${s.id}: ${a.op}`);
  }
  assert.equal(typeof interfacePage(SCREENS), "string", "interface-shell R21's check passes over the module's screens");
});

test("notice wizard-scripts:163: R153's link opens aiproject by address; the module imports nothing of screens-ai and draws no projectai address", async () => {
  const dir = new URL("../../../src/screens-inquiry/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs")))
    assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), /from\s+["'][^"']*screens-ai/, `${f} imports nothing of screens-ai`);
  const p = await open("/app/project/" + P);
  assert.equal(main(p).querySelectorAll('a[href^="/app/aiproject/' + P + '"]').length, 1);
  assert.equal(p.root().querySelectorAll('a[href^="/app/projectai/"]').length, 0);
});
