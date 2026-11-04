/* interface-shell, fix round 10 (T51; K5308): R134's re-points (ended, see notice-wizard-scripts-98) and R135's choice controls telling their screen of a change.
   fixtures-own: a stand-in screen whose render and handlers are the test's own input */
import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot } from "./harness.mjs";

/* R134's four re-points ended (wizard-scripts R54, PR 98): the registry re-taken at 30af4350f2 lists each on its screen. They are covered by
   notice-wizard-scripts-98.test.mjs. */

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
