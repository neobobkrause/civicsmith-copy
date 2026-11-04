/* F2 and the provider notice op-declarations:95 (its R20, R24, R30, R41 restated for T53, ai-accounts R35): the door retired the
   old account ops with no aliases, `projectkeyset` among them, and the shell refuses a screen naming an op OPS does not hold, so
   every page of the plane answered 500. Every act on this module's screens is an op the assembled OPS holds (or a browser act the
   shell admits), the shell serves the screens, and no word of a retired act is drawn. Against the real OPS, never a list of its ops. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { SCREENS } from "../../../src/screens-daily/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { checkScreens, interfacePage } from "../../../src/interface-shell/index.mjs";

test("F2, notice op-declarations:95: every act on screens-daily's screens is an op the assembled OPS holds", () => {
  for (const s of SCREENS) for (const a of s.acts) assert.ok(Object.hasOwn(OPS, a.op), `${s.id}: ${a.op} is in OPS`);
});

test("F2: the shell serves the screens (no 'act names …, which OPS does not hold')", () => {
  assert.doesNotThrow(() => checkScreens(SCREENS));
  assert.doesNotThrow(() => interfacePage(SCREENS));
});

test("F2: the queue draws no word, act or field of the retired project key act", () => {
  const queue = SCREENS.find((s) => s.id === "queue");
  const op = "projectkeyset";   // this module's own former act (R3), retired at the door in T53 (op-declarations R41)
  assert.equal(Object.hasOwn(OPS, op), false, `${op} is retired at the door`);
  assert.equal(queue.words.some((k) => k.startsWith(`act.${op}.`) || k === "screen.queue.projectkey"), false, `queue draws no word of ${op}`);
  assert.equal(queue.acts.some((a) => a.op === op), false, `queue offers no ${op}`);
});
