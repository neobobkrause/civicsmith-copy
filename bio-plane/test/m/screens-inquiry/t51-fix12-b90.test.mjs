/* screens-inquiry T51 fix round 12 (B90; walks C and E): C-M12 (the contradiction flag fold stays open once another document is chosen, and a pick made
 * before a redraw is drawn as the member left it; DEC-394 3e, R127) and walk E S3 (a cited passage's "Cited" mark sits on its own line, not glued to the passage
 * text; R125, R3). On interface-shell's served page over the real world (K5054): the state is made by real acts, and every expectation is a word read by key (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { main, fill, press, says, storeWorld, SCREENS } from "./fixtures.mjs";

const OWN = { capabilities: ["contribute", "create_projects"] };
const PARAGRAPHS = ["The Director shall repair each reported pothole within seven calendar days of the report.", "Repairs are recorded as closed when the crew reports the work complete."];
const pageHtml = (paragraphs) => `<html><head><title>Council minutes</title></head><body>\n<h1>Council minutes</h1>\n${paragraphs.map((t) => `<p>${t}</p>`).join("\n")}\n</body></html>`;

/** `ann` with a project, a question in it, and a web-page copy held by her (read, so its two paragraphs are its passages) */
async function member() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const seven = (await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true })).id;
  const doc = await world.recipes.hold(ann, "Council minutes", pageHtml(PARAGRAPHS), project, { type: "text/html", read: true });
  const units = (await ann.read("reading", { query: { sha256: doc.sha } })).text_units;
  return { world, ann, project, seven, document: doc.bundle, sha: doc.sha, units, at: "/app/document/" + doc.bundle };
}
/** the page as `as` reads it over the world's door (the kit's own redraws and acts run as a member's would) */
async function pageOn(world, as, path) {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path });
  await p.settle();
  return p;
}
/** a choice changed as a member does it: the value set and the change fired (the kit redraws it) */
async function choose(p, id, value) {
  const el = p.doc.getElementById(id);
  el.value = value;
  p.fire(el, "change");
  await p.settle();
}
/** the other document chosen in the shared picker (R137, now screens-document-beta R70) (one radio of the fold `kind`) */
async function pickDoc(p, kind, value) {
  /* R70, R71 (screens-document-beta): the shared picker is read once opened; a document of another project is offered once its control is pressed */
  const offeredNow = () => main(p).querySelectorAll(`[data-picker="${kind}"] input`).some((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value);
  for (const box of [`document-pick-open-${kind}-0`, `${kind}-wide-0`]) if (!offeredNow() && p.doc.getElementById(box)) await p.choose("#" + box);
  const picker = main(p).querySelector(`[data-picker="${kind}"]`);
  const r = picker && picker.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value && !i.closest("[data-pick-pages]"));
  if (!r) throw new Error(`${value} is not offered in the ${kind} picker`);
  r.checked = true; p.fire(r, "change"); await p.settle();
}
const flagFold = (p) => main(p).querySelector('[data-fold="contradict"]');

test("R127 C-M12 choosing the other document opens the contradiction fold, and a passage picked before the page redraws keeps its pick; control: with no other document chosen the fold stays shut", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, "Rent notice, October 2026", { paragraphs: ["The rent rises on November 1."], project: w.project });
  const third = await w.world.recipes.page(w.ann, "Work orders, September 2026", { paragraphs: ["Crews closed forty orders."], project: w.project });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(flagFold(p).hasAttribute("open"), false, "control: nothing chosen, the fold is shut");
  await pickDoc(p, "flag", other.bundle);
  assert.equal(flagFold(p).hasAttribute("open"), true, "the other document chosen: the fold is open");
  fill(p, { "document-flag-here": "0" });
  await pickDoc(p, "flag", third.bundle);
  assert.equal(flagFold(p).hasAttribute("open"), true, "the redraw keeps the fold open");
  assert.equal(p.doc.getElementById("document-flag-here").value, "0", "the passage picked here is still picked after the redraw");
});

test("R125 R3 walk E S3 a cited passage's 'Cited' mark sits on its own line, not glued to its text; control: a passage not cited draws no mark", async () => {
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(main(p).querySelector("[data-passage-cited]"), null, "control: nothing cited, no mark");
  await choose(p, "document-cite-question", w.seven);
  await press(p, "cite");
  const mark = main(p).querySelector("[data-passage-cited]");
  assert.ok(mark, "the passage cited is marked");
  const before = mark.previousElementSibling;
  assert.ok(before && before.tagName === "BR", "the mark follows a line break, not the passage's text or a span");
  assert.ok(says(mark, "screen.finder.cite.cited"), "by its key");
});
