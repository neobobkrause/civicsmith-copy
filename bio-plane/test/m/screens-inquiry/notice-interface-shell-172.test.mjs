/* Provider notice interface-shell:172 (PR 172; interface-shell R20 as T53 restates it): the assistant is reachable when
 * `assistantstate` answers `on` and `aipathready` answers `ready`; the alpha's three reads (`accountreference`,
 * `subscriptionsignin` `{step: "state"}`, `groupkeystate`) are no longer asked. This module registers the dock's panel
 * (R4) and draws its assistant-only controls only while reachable (R41's "Ask the assistant to look", the document's
 * `pagetranscribe`, DEC-190): it asks none of the three, and its controls follow `aipathready`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { ok } from "../interface-shell/harness.mjs";
import { open, plane, main, actsIn, SCREENS, P, Q, D } from "./fixtures.mjs";

const RETIRED = ["accountreference", "subscriptionsignin", "groupkeystate"];
const reach = (state) => ({ assistantstate: ok({ on: true }), aipathready: ok({ state }) });
const page = (path, state) => open(path, { boot: { plane: { ...plane(), ...reach(state) } } });
const dockButton = (p) => p.root().querySelector('.cs-mast [data-shell="dock"]');

test("notice interface-shell:172: no screen of this module reads the alpha's three reads", () => {
  /* every op a screen names is spelled as a string beside `op:`, or passed to `cs.call` or the screens' `later` */
  const dir = new URL("../../../src/screens-inquiry/", import.meta.url);
  const named = new RegExp(`(?:op:\\s*|cs\\.call\\(\\s*|later\\([^,]+,\\s*)"(${RETIRED.join("|")})"`);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) assert.doesNotMatch(readFileSync(new URL(f, dir), "utf8"), named, f);
  for (const s of SCREENS) for (const a of s.acts) assert.ok(!RETIRED.includes(a.op), `${s.id} acts on ${a.op}`);
});

test("notice interface-shell:172: a ready path draws the dock and the document's pagetranscribe; a not-ready path draws neither", async () => {
  const ready = await page("/app/document/" + D, "ready");
  assert.ok(dockButton(ready), "the masthead offers the dock");
  assert.ok(actsIn(main(ready)).includes("pagetranscribe"), "pagetranscribe while reachable");
  for (const op of RETIRED) assert.equal(ready.byOp(op).length, 0, `${op} is not asked`);
  await ready.click(dockButton(ready));
  await ready.settle();
  assert.ok(ready.root().querySelector('.cs-dock[data-panel="assistant"]'), "the dock opens this module's panel");
  /* control: a path answering a not-ready reason: no assistant control anywhere, the plain transcribe still offered */
  const not = await page("/app/document/" + D, "auth_failed");
  assert.equal(dockButton(not), null, "no dock");
  assert.ok(!actsIn(main(not)).includes("pagetranscribe") && actsIn(main(not)).includes("transcribe"));
  const q = await page("/app/question/" + Q, "auth_failed");
  assert.equal(dockButton(q), null);
});
