/* interface-shell, provider notice wizard-scripts:546 (PR 546: wizard-scripts adds SCREEN_ACTS_ADDED, the acts a screen registers that
   the design file does not list, appended to the screen's registry acts; no requirement text). Confirmed, no code change: R21's one
   registry check (`checkScreens`) reads `SCREEN_REGISTRY`'s acts, which carry the added acts, so a screen naming an added act on its
   own screen is served and the same act on a screen that lists it nowhere still throws, naming the screen.
   fixtures-own: stand-in screens whose acts are the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { checkScreens, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { SCREEN_ACTS_ADDED } from "../../../src/wizard-scripts/data.mjs";

const screen = (id, op) => ({ id, render: () => "", acts: [{ op }] });
const listed = (id, op) => { const r = SCREEN_REGISTRY.find((x) => x.id === id); return !!r && (r.acts.includes(op) || (r.owed || []).some((o) => o.op === op)); };

test("notice wizard-scripts:546 (R21) each act SCREEN_ACTS_ADDED adds to a screen is served there through the registry, no re-point needed; control: on a screen that lists it nowhere it throws, naming that screen", () => {
  const added = Object.entries(SCREEN_ACTS_ADDED);
  assert.ok(added.length > 0);
  for (const [id, ops] of added) for (const op of ops) {
    assert.ok(listed(id, op), `the registry lists ${op} on ${id}`);
    assert.equal((RE_POINTS[id] || []).includes(op), false, `${op} on ${id} is the registry's, not a re-point`);
    assert.equal(checkScreens([screen(id, op)]), true, `${id} naming ${op} is served`);
    const other = SCREEN_REGISTRY.find((r) => !listed(r.id, op) && !(RE_POINTS[r.id] || []).includes(op));
    assert.throws(() => checkScreens([screen(other.id, op)]), new RegExp(other.id + ".*" + op));
  }
});
