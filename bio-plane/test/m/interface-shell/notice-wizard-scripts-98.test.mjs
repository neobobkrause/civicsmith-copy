/* interface-shell, provider notices wizard-scripts:98 (PR 98: wizard-scripts R54 re-takes the registry at 30af4350f2) and
   wizard-scripts:163 (PR 163: the registry's and library's retired ai-accounts acts read as their T53 ops, no requirement text).
   98: the registry now lists R134's four re-points on their screens (`factconfirm` on `setup`, `leggrade` on `question`, `resolve` on
   `document`, `signerknown` on `queue`), so they leave RE_POINTS (R134: "each until the registry lists the op on that screen") and
   R21's one registry check admits them. The first test fails with index.mjs' RE_POINTS reverted.
   163: confirmed, no code change: R21's check admits a screen act by the registry and OPS, so a screen naming the T53 op the registry
   now lists is served and one naming the retired op it replaced is refused, naming the screen.
   fixtures-own: stand-in screens whose acts are the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { checkScreens, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";

const screen = (id, op) => ({ id, render: () => "", acts: [{ op }] });
const listed = (id, op) => { const r = SCREEN_REGISTRY.find((x) => x.id === id); return !!r && (r.acts.includes(op) || (r.owed || []).some((o) => o.op === op)); };
const FOUR = [["setup", "factconfirm", "explore"], ["question", "leggrade", "document"], ["document", "resolve", "explore"], ["queue", "signerknown", "explore"]];

test("notice wizard-scripts:98 (R134, R73) R134's four re-points leave RE_POINTS once the registry lists each on its screen, and R21's check still admits them there; control: on another screen each still throws, as does an unlisted op on its own", () => {
  for (const [id, op, other] of FOUR) {
    assert.ok(listed(id, op), `the registry lists ${op} on ${id}`);
    assert.equal((RE_POINTS[id] || []).includes(op), false, `${op} is no longer a re-point of ${id}`);
    assert.equal(checkScreens([screen(id, op)]), true, `${id} naming ${op} is served`);
    assert.equal(listed(other, op), false);
    assert.throws(() => checkScreens([screen(other, op)]), new RegExp(other + ".*" + op));
    assert.throws(() => checkScreens([screen(id, "stepsourcewithdraw")]), new RegExp(id + ".*stepsourcewithdraw"));
  }
  /* R73: no re-point at all is one the registry lists for its screen */
  for (const [id, ops] of Object.entries(RE_POINTS)) for (const op of ops) assert.equal(listed(id, op), false, `${id} ${op}`);
});

test("notice wizard-scripts:163 (R21) a screen naming the T53 account op the registry lists is served; control: the retired op it replaced throws, naming the screen", () => {
  for (const [id, op, retired] of [["setup", "aiaccountadd", "groupkeyset"], ["teamai", "aiaccountswitch", "groupkeyswitch"], ["connect", "aiownadd", "accountreferenceset"], ["connect", "aiaccountremove", "accountreferenceremove"]]) {
    assert.ok(listed(id, op), `the registry lists ${op} on ${id}`);
    assert.equal(checkScreens([screen(id, op)]), true, `${id} ${op}`);
    assert.throws(() => checkScreens([screen(id, retired)]), new RegExp(id + ".*" + retired));
  }
});
