/* interface-shell, provider notice op-declarations:95 (PR 95: op-declarations R20, R24, R30, R41 restated for T53, ai-accounts R35).
   `accountreference` and `groupkeystate` are retired with no alias, so the frame no longer asks them: by R20 (T53) whether the
   assistant is reachable is `assistantstate` with the one combined read `aipathready`, and the alpha's third read
   (`subscriptionsignin`'s state) is not asked either. Each test fails with index.mjs' SHELL_OPS and browser.mjs' FRAME_READS reverted.
   fixtures-own: a stand-in screen whose render is the test's own input; the plane's answers are the harness's scripted ones */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { boot, ok } from "./harness.mjs";

const RETIRED = ["accountreference", "groupkeystate"];
const HOME = { id: "home", reads: () => ({}), acts: [], words: [], render: () => '<p id="here">home</p>' };
const dock = (p) => !!p.root().querySelector('.cs-mast [data-shell="dock"]');

test("notice op-declarations:95 (R20, T53) SHELL_OPS names neither retired op nor the alpha's subscriptionsignin state, and names aipathready; every other op it names is one OPS holds", () => {
  for (const op of [...RETIRED, "subscriptionsignin"]) assert.equal(SHELL_OPS.includes(op), false, op + " is not the shell's");
  for (const op of RETIRED) assert.equal(Object.hasOwn(OPS, op), false, op + " is retired from OPS (op-declarations R24, R41)");
  assert.ok(SHELL_OPS.includes("aipathready"));
  /* aipathready is the plane's read over the Worker (surface-declarations R15), not yet in OPS on the tranche */
  for (const op of SHELL_OPS) if (op !== "aipathready") assert.ok(Object.hasOwn(OPS, op), op + " is declared");
});

test("notice op-declarations:95 (R20, T53) a load sends no retired read: aipathready is asked once, and with assistantstate on and a ready path the assistant is offered", async () => {
  const p = await boot({ screens: [HOME], path: "/app", plane: { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) } });
  for (const op of [...RETIRED, "subscriptionsignin"]) assert.equal(p.byOp(op).length, 0, op + " is not asked");
  assert.equal(p.byOp("aipathready").length, 1, "aipathready is asked once");
  assert.ok(dock(p), "reachable: the masthead's assistant button");
});

test("notice op-declarations:95 (R20, T53) control: the retired reads' old answers no longer make the assistant reachable; without a ready path no assistant control is drawn", async () => {
  const old = { assistantstate: ok({ on: true }), accountreference: ok({ held: true }), groupkeystate: ok({ on: true, held: true }), subscriptionsignin: ok({ connected: true }) };
  const p = await boot({ screens: [HOME], path: "/app", plane: old });
  assert.equal(dock(p), false, "the old reads alone: not reachable");
  const q = await boot({ screens: [HOME], path: "/app", plane: { ...old, aipathready: ok({ state: "auth_failed" }) } });
  assert.equal(dock(q), false, "a not-ready reason: not reachable");
});
