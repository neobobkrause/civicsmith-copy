/* Provider notice screens-settings:174 (PR 174, its R95: the alpha AI ops retired with no aliases), with BOB's MSG bob-104:
 * the assembled plane's `checkScreens` refuses every page while a screen names an act the assembled registration does not
 * declare. Every act this module's screens draw, and every op its source reads or sends, is one the assembled declarations
 * hold (op-declarations' `OPS`, registered by store-assembly's world, fixtures.mjs) or a browser act; none is one of the
 * seventeen ops ai-accounts R35 retired (op-declarations PR 95's list), nor an act wizard-scripts carries as retired. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { SCREENS, open, main, P } from "./fixtures.mjs";
import { OPS, BROWSER_ACTS } from "../../../src/op-declarations/index.mjs";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";
import { interfacePage } from "../../../src/interface-shell/index.mjs";

const RETIRED = ["accountreferenceset", "accountreferenceremove", "accountreference", "groupkeyset", "groupkeyremove", "groupkeyswitch",
  "groupkeystate", "groupkeynotice", "groupkeynoticeseen", "subscriptiondisconnect", "projectkeyset", "projectsigninset",
  "projectaccountremove", "projectaccountswitch", "projectaccountstate", "projectkeynotice", "projectkeynoticeseen"];
const declared = (op) => Object.hasOwn(OPS, op) || Object.hasOwn(BROWSER_ACTS, op);

test("notice screens-settings:174: every act of every screen here is one the assembled registration declares, and none is retired", () => {
  for (const op of RETIRED) assert.ok(!Object.hasOwn(OPS, op), `${op} is retired from the assembled registration`);
  for (const s of SCREENS) for (const a of s.acts) {
    assert.ok(declared(a.op), `${s.id}: ${a.op} is declared`);
    assert.ok(!RETIRED.includes(a.op) && !Object.hasOwn(RETIRED_ACTS, a.op), `${s.id}: ${a.op} is retired`);
  }
  assert.equal(typeof interfacePage(SCREENS), "string", "checkScreens admits the module's screens over the assembled ops");
});

test("notice screens-settings:174: every op the module's source reads or sends is declared; the project page asks none of the retired ops", async () => {
  const dir = new URL("../../../src/screens-inquiry/", import.meta.url);
  const named = /(?:\bop:\s*|cs\.call\(\s*|cs\.act\(\s*|later\([^,()]+,\s*)"([a-z][a-z0-9]*)"/g;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs")))
    for (const m of readFileSync(new URL(f, dir), "utf8").matchAll(named)) assert.ok(declared(m[1]), `${f} names ${m[1]}, which no declaration holds`);
  /* control, at the page: the project's own page sends none of the seventeen */
  const p = await open("/app/project/" + P);
  assert.ok(main(p).querySelector("h1"));
  for (const op of RETIRED) assert.equal(p.byOp(op).length, 0, op);
});
