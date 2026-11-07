/* screens-inquiry T51 fix round 13 (B92; re-walk C): R138 (amends R127; C-M12 new 4): after "Say these two contradict" the Document page says what the act
 * recorded, or the owner's sentence when the pair is already held, and a refusal is drawn beside the act; and C-M13 MINOR: the contradiction screen never
 * draws a fact's doctype by the id the reader states. On interface-shell's served page over the real world (K5054): the state is made by real acts, and each
 * expectation is read from the answer the owner gave, never copied (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { main, fill, press, says, storeWorld, SCREENS, word } from "./fixtures.mjs";
import { CONTRADICTION_SCREEN } from "../../../src/screens-inquiry/contradiction.mjs";

const OWN = { capabilities: ["contribute", "create_projects"] };
const PARAGRAPHS = ["The Director shall repair each reported pothole within seven calendar days of the report.", "Repairs are recorded as closed when the crew reports the work complete."];
const pageHtml = (paragraphs) => `<html><head><title>Council minutes</title></head><body>\n<h1>Council minutes</h1>\n${paragraphs.map((t) => `<p>${t}</p>`).join("\n")}\n</body></html>`;

/** `ann` with a project and a web-page copy held by her (read, so its two paragraphs are its passages) */
async function member() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const doc = await world.recipes.hold(ann, "Council minutes", pageHtml(PARAGRAPHS), project, { type: "text/html", read: true });
  return { world, ann, project, sha: doc.sha, bundle: doc.bundle, at: "/app/document/" + doc.bundle };
}
/** the page as `as` reads it over the world's door; the answers it has been given are kept by op */
async function pageOn(world, as, path, screens = SCREENS) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens, door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; }, session, path });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}
/** the other document chosen in the picker of the flag fold (one radio, not one of the page's controls) */
async function pickDoc(p, value) {
  /* R70, R71 (screens-document-beta): the shared picker is read once opened; a document of another project is offered once its control is pressed */
  const offeredNow = () => main(p).querySelectorAll(`[data-picker="flag"] input`).some((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value);
  for (const box of [`document-pick-open-flag-0`, `flag-wide-0`]) if (!offeredNow() && p.doc.getElementById(box)) await p.choose("#" + box);
  const picker = main(p).querySelector('[data-picker="flag"]');
  const r = picker && picker.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value && !i.closest("[data-pick-pages]"));
  assert.ok(r, `${value} is offered in the flag picker`);
  r.checked = true; p.fire(r, "change"); await p.settle();
}
/** the sentence the page draws beside the flag act, as text */
const outcomeOf = (p) => { const el = main(p).querySelector('[data-outcome="contradictionflag"]'); return el ? el.textContent.trim() : null; };

test("R138 C-M12 new 4: after 'Say these two contradict' the page says what was recorded, and when the pair is already held the owner's sentence for it; control: before any press nothing is drawn beside the act", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, "Rent notice, October 2026", { paragraphs: ["The rent rises on November 1."], project: w.project });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(outcomeOf(p), null, "control: nothing pressed, nothing drawn");
  await pickDoc(p, other.bundle);
  fill(p, { "document-flag-here": "0", "document-flag-there": "0", "document-flag-why": "One says November, the other December." });
  await press(p, "contradictionflag");
  const first = p.answers("contradictionflag")[0];
  assert.equal(first.wrote, true, "the world recorded the flag");
  /* R139 (DEC-439, DEC-440): the design's sentence, in place of the owner's `says` that R138 drew */
  assert.equal(outcomeOf(p), word("screen.document.flag.recorded"), "the page draws the sentence the flag was recorded with");
  await press(p, "contradictionflag");
  const again = p.answers("contradictionflag")[1];
  assert.equal(again.already, true, "the same pair again: the world answers already");
  assert.equal(outcomeOf(p), word("screen.document.flag.already"), "the page draws the design's sentence for a pair already held");
});

test("R138 a refusal is drawn beside the act by the owner's key; control: a refusal records nothing, so no sentence is drawn for the act", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, "Rent notice, October 2026", { paragraphs: ["The rent rises on November 1."], project: w.project });
  const p = await pageOn(w.world, w.ann, w.at);
  await pickDoc(p, other.bundle);
  fill(p, { "document-flag-here": "0", "document-flag-there": "0" });
  assert.ok(says(await press(p, "contradictionflag"), "refusal.FLAG_NO_REASON"), "no reason: refused by its key");
  assert.equal(outcomeOf(p), null, "control: a refusal records nothing, so no sentence is drawn for the act");
});

test("C-M13 MINOR the contradiction screen never draws a fact's doctype by the id the reader states ('generic · generic'): each side is drawn by the word held for its reader id (R139, DEC-440); control: the passages stay drawn", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const a = await world.recipes.page(ann, "Lease amendment, March 2024", { paragraphs: ["The rent adjustment takes effect on November 1, 2026."], project });
  const b = await world.recipes.page(ann, "Rent notice, September 2026", { paragraphs: ["The adjusted rent is due beginning December 1, 2026."], project });
  const unit = async (h) => (await ann.read("reading", { query: { sha256: h.sha } })).text_units[0].extent;
  const flag = await ann.act("contradictionflag", { body: { here: { capture: a.sha, extent: await unit(a) }, other: { capture: b.sha, extent: await unit(b) }, reason: "The notice and the amendment give two different dates." } });
  const p = await pageOn(world, ann, "/app/contradiction/" + flag.candidate, [...SCREENS.filter((x) => x.id !== "contradiction"), CONTRADICTION_SCREEN]);
  const row = main(p).querySelector('[data-fact="doctype"]');
  assert.ok(row, "the kinds the reader states are drawn");
  assert.ok(says(row, "screen.contradiction.doctype.generic"), "by the word held for the reader id");
  assert.doesNotMatch(row.textContent, /\bgeneric\b/, "never the id");
  assert.ok(main(p).querySelector('[data-side="a"]') !== null, "control: the passages stay drawn");
});
