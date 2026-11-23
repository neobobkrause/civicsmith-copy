/* screens-people R42 (amends R37): the form that adds a subject of a kind other than a person or an organization (the drawing's
   state g, the-record S7) ends in "Follow it" (`screen.people.addother.submit`), while the two-way form of R37 keeps "Follow them"
   (`screen.people.add.submit`). The screen is booted alone through interface-shell's harness with its own word list, so a key the
   list lacks would be drawn bare, and a scripted plane. Every sentence is asserted as `word(key, vars)`: no test here holds English. */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { boot, ok, settle } from "../interface-shell/harness.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { PEOPLE_SCREEN } from "../../../src/screens-investigate/people.mjs";

const FUND = { entity: "ENT-fund-1", kind: "fund", name: "Sewer Service Fund", today: { note: "Pays for the sewers" }, documents: 2 };
const CHEN = { entity: "ENT-chen-1", kind: "person", name: "L. Chen", today: { posts: [] }, documents: 1 };
const directory = (rows) => (req) => ok({ rows: req.query && req.query.show === "everything" ? rows.everything : rows.default, following: 1, in_your_projects: 0 });
const open = (plane) => boot({ screens: [PEOPLE_SCREEN], plane, path: "/app/people" });
const main = (p) => p.doc.getElementById("cs-main");
const button = (p, op) => main(p).querySelector(`button[data-act="${op}"]`);
const fill = (p, values) => { for (const [id, v] of Object.entries(values)) p.doc.getElementById(id).value = v; };
const press = async (p, op) => {
  const b = button(p, op);
  assert.ok(b, `a ${op} button is drawn`);
  await p.click(b);
  const ai = b.getAttribute("data-ai");
  const ta = p.doc.getElementById("cs-reason-" + ai.replace(":", "-"));
  if (ta) { ta.value = "the team follows it"; await p.click(p.root().querySelector(`[data-shell="reason-send"][data-for="${ai}"]`)); }
  await settle();
};
const showEverything = async (p) => { fill(p, { "people-show": "everything" }); await press(p, "search"); };

test("R42: with a kind other than people and organizations in view, the add form's button is \"Follow it\", never \"Follow them\"", async () => {
  const p = await open({ peopledirectory: directory({ default: [CHEN], everything: [CHEN, FUND] }) });
  await showEverything(p);
  assert.ok(p.doc.getElementById("people-other-name"), "the state g form is drawn");
  assert.ok(button(p, "entitycreate").textContent.startsWith(word("screen.people.addother.submit")), "the button leads with its label");
  assert.ok(!button(p, "entitycreate").textContent.includes(word("screen.people.add.submit")));
  assert.ok(!main(p).textContent.includes("screen.people.addother.submit"), "the key is in the screen's word list, never drawn bare");
});

test("R42: \"Follow it\" sends entitycreate with the kind chosen, the label, the aliases one per line and the note", async () => {
  const p = await open({ peopledirectory: directory({ default: [CHEN], everything: [FUND] }), entitysimilar: ok({ ok: true, similar: [] }),
    entitycreate: ok({ ok: true, entity_id: "ENT-new-1" }) });
  await showEverything(p);
  fill(p, { "people-other-name": " Storm Drain Fund ", "people-other-kind": "fund", "people-other-aliases": "Fund 42\n Fund 42 \nSDF",
    "people-other-note": "Pays for the storm drains." });
  await press(p, "entitycreate");
  assert.equal(p.byOp("entitycreate").length, 1);
  assert.deepEqual(p.byOp("entitycreate")[0].body, { kind: "fund", label: "Storm Drain Fund", note: "Pays for the storm drains.", aliases: ["Fund 42", "SDF"] });
});

test("R42 (error): \"Follow it\" pressed with no name sends nothing", async () => {
  const p = await open({ peopledirectory: directory({ default: [CHEN], everything: [FUND] }), entitycreate: ok({ ok: true, entity_id: "ENT-new-1" }) });
  await showEverything(p);
  fill(p, { "people-other-name": "   ", "people-other-kind": "fund", "people-other-note": "Pays for the storm drains." });
  await press(p, "entitycreate");
  assert.equal(p.byOp("entitycreate").length, 0);
  assert.ok(p.root().textContent.includes(word("screen.people.add.empty")));
});

test("R42 (bounds): with no subject of the kind chosen, the form that stands still ends in \"Follow it\"", async () => {
  const p = await open({ peopledirectory: directory({ default: [CHEN], everything: [] }) });
  await showEverything(p);
  assert.ok(p.doc.getElementById("people-other-name"));
  assert.ok(button(p, "entitycreate").textContent.startsWith(word("screen.people.addother.submit")), "the button leads with its label");
});

test("R37 (control): with people and organizations in view, the two-way form keeps \"Follow them\"; so does the empty state of R25", async () => {
  for (const rows of [[CHEN], []]) {
    const p = await open({ peopledirectory: directory({ default: rows, everything: [] }) });
    assert.ok(p.doc.getElementById("people-add-kind"), "the two-way form");
    assert.ok(button(p, "entitycreate").textContent.startsWith(word("screen.people.add.submit")), "the button leads with its label");
    assert.ok(!button(p, "entitycreate").textContent.includes(word("screen.people.addother.submit")));
  }
});
