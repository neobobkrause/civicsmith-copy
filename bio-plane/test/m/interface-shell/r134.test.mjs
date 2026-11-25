/* interface-shell, fix round 10 (T51; K5308): R134's three re-points and R135's choice controls telling their screen of a change.
   fixtures-own: a stand-in screen whose render and handlers are the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { checkScreens, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";
import { boot } from "./harness.mjs";

const screen = (id, op) => ({ id, render: () => "", acts: [{ op }] });

/* R134: each re-point is admitted on its screen, refused on any other, and listed by no registry screen it names */
for (const [id, op, other] of [["setup", "factconfirm", "explore"], ["question", "leggrade", "document"], ["document", "resolve", "explore"], ["queue", "signerknown", "explore"]]) {
  test(`R134 ${op} is a named re-point of ${id}: ${id} naming it is served; control: ${op} on ${other}, and another unlisted op on ${id}, still throw`, () => {
    assert.ok(RE_POINTS[id].includes(op), `${op} is a re-point of ${id}`);
    const reg = SCREEN_REGISTRY.find((r) => r.id === id);
    assert.equal(reg.acts.includes(op) || (reg.owed || []).some((o) => o.op === op), false, "the registry lists it nowhere on this screen, so it is a re-point");
    /* `leggrade` is declared by op-declarations after citation's merge (citation R24); until then OPS refuses the name, as R21 says */
    assert.ok(Object.hasOwn(OPS, op), `${op} is an op OPS holds`);
    assert.equal(checkScreens([screen(id, op)]), true);
    assert.throws(() => checkScreens([screen(other, op)]), new RegExp(other + ".*" + op));
    assert.throws(() => checkScreens([screen(id, "stepsourcewithdraw")]), new RegExp(id + ".*stepsourcewithdraw"));
  });
}

/* R135: a radio group and a box tell the screen of a change as a typed field does */
const FORM = {
  id: "home", reads: () => ({}),
  words: [["screen.home.t.l", "fx label", false], ["screen.home.t.a", "fx a", false], ["screen.home.t.b", "fx b", false]],
  acts: [],
  render(cs, view) {
    const edited = (c2, v2, value) => { c2.set("unsaved", true); c2.set("last", JSON.stringify(value)); };
    return cs.checks("rr", { text: "role" }, [["a", "screen.home.t.a", true], ["b", "screen.home.t.b", false]], { radio: true, typing: edited })
      + cs.checks("nn", { text: "none" }, [["none", "screen.home.t.a", false]], { typing: edited })
      + cs.checks("plain", { text: "plain" }, [["x", "screen.home.t.a", false]])
      + '<p id="unsaved">' + (view.ui.unsaved ? "yes" : "no") + '</p><p id="last">' + cs.esc(view.ui.last || "-") + "</p>";
  },
};
const tick = async (p, id, on) => { const el = p.doc.getElementById(id); el.checked = on; p.fire(el, "change"); await p.settle(); };

test("R135 a radio group tells its screen of a change with the chosen value, and the nothing-left-out box with the ticked values; control: a group given no handler tells nothing and fails nothing", async () => {
  const p = await boot({ screens: [FORM], path: "/app" });
  assert.equal(p.doc.getElementById("unsaved").textContent, "no");
  await tick(p, "plain-0", true);
  assert.equal(p.doc.getElementById("unsaved").textContent, "no", "a group with no handler tells nothing");
  await tick(p, "rr-1", true);
  assert.equal(p.doc.getElementById("unsaved").textContent, "yes", "the radio's change reached the screen");
  assert.equal(p.doc.getElementById("last").textContent, JSON.stringify("b"), "with the chosen value");
  const q = await boot({ screens: [FORM], path: "/app" });
  await tick(q, "nn-0", true);
  assert.equal(q.doc.getElementById("unsaved").textContent, "yes", "the box's change reached the screen");
  assert.equal(q.doc.getElementById("last").textContent, JSON.stringify(["none"]), "with the values ticked");
});
