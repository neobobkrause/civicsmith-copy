/* screens-inquiry R139 (T51 fix round 10; DEC-439 to DEC-441; UX-DESIGN U481-U484; K5303): the words the design gave the alpha walk's remaining rows, drawn by key at the
 * walker's case of each row's note. On interface-shell's served page over the real world (K5054): the state is made by real acts, and each expectation is read from the
 * answer the owner gave (K874) and from the word held for its key (R44), never copied. Document: a flag recorded or already held, the list of flags raised on the
 * document, "Checked by {name}, {date}". Contradiction: a lead a member flagged, each side's kind by reader id. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot } from "../interface-shell/harness.mjs";
import { main, fill, press, storeWorld, SCREENS, word, day, section, lead } from "./fixtures.mjs";
import { CONTRADICTION_SCREEN } from "../../../src/screens-inquiry/contradiction.mjs";

const OWN = { capabilities: ["contribute", "create_projects"] };
const PARAGRAPHS = ["The Director shall repair each reported pothole within seven calendar days of the report.", "Repairs are recorded as closed when the crew reports the work complete."];
const pageHtml = (paragraphs) => `<html><head><title>Council minutes</title></head><body>\n<h1>Council minutes</h1>\n${paragraphs.map((t) => `<p>${t}</p>`).join("\n")}\n</body></html>`;
const SERVED = [...SCREENS.filter((x) => x.id !== "contradiction"), CONTRADICTION_SCREEN];

/** `ann` with a project and a web-page copy held by her (read, so its two paragraphs are its passages) */
async function member() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const doc = await world.recipes.hold(ann, "Council minutes", pageHtml(PARAGRAPHS), project, { type: "text/html", read: true });
  return { world, ann, project, sha: doc.sha, bundle: doc.bundle, at: "/app/document/" + doc.bundle };
}
/** the page as `as` reads it over the world's door; the answers it has been given are kept by op */
async function pageOn(world, as, path, screens = SCREENS, alter = null) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens, door: async (req) => { const a = await door(req); const b = alter ? alter(req.op, a) : a; kept.push([req.op, b]); return b; }, session, path });
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
const outcomeOf = (p) => { const el = main(p).querySelector('[data-outcome="contradictionflag"]'); return el ? el.textContent.trim() : null; };
const OTHER = "Rent notice, October 2026";

test("R139 C-M12 the flag recorded draws screen.document.flag.recorded and, pressed again, screen.document.flag.already, each in place of the owner's sentence", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, OTHER, { paragraphs: ["The rent rises on November 1."], project: w.project });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(outcomeOf(p), null, "control: before any press nothing is drawn beside the act");
  await pickDoc(p, other.bundle);
  fill(p, { "document-flag-here": "0", "document-flag-there": "0", "document-flag-why": "One says November, the other December." });
  await press(p, "contradictionflag");
  const first = p.answers("contradictionflag")[0];
  assert.equal(first.wrote, true, "the world recorded the flag");
  assert.equal(outcomeOf(p), word("screen.document.flag.recorded"), "the held sentence, not the owner's `says`");
  assert.notEqual(outcomeOf(p), first.says);
  await press(p, "contradictionflag");
  const again = p.answers("contradictionflag")[1];
  assert.equal(again.already, true, "the same pair again: the world answers already");
  assert.equal(outcomeOf(p), word("screen.document.flag.already"), "the held sentence for a pair already held");
  const sec = section(p, "screen.document.flags.head");
  assert.ok(sec && sec.querySelector(`[data-flag="${first.candidate}"]`), "the flag is in the list the page reads again after the act");
  assert.equal(sec.querySelectorAll("[data-flag]").length, 1, "the pair is listed once");
});

test("R139 C-M12 the flags raised on the document are listed from contradictioncandidates, each pair linked to its contradiction with who flagged it beneath; control: a document with no flag draws no list", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, OTHER, { paragraphs: ["The rent rises on November 1."], project: w.project });
  const before = await pageOn(w.world, w.ann, w.at);
  assert.ok(!main(before).textContent.includes(word("screen.document.flags.head")), "control: no flag, no list");
  const unit = async (h) => (await w.ann.read("reading", { query: { sha256: h.sha } })).text_units[0].extent;
  const flag = await w.ann.act("contradictionflag", { body: { here: { capture: w.sha, extent: await unit({ sha: w.sha }) }, other: { capture: other.sha, extent: await unit(other) }, reason: "One says November, the other December." } });
  const held = (await w.ann.read("contradictioncandidates", { query: { bundle: w.bundle } })).candidates.find((c) => c.candidate === flag.candidate);
  assert.ok(held && held.flagged_by, "the world holds the flag");
  const p = await pageOn(w.world, w.ann, w.at);
  const sec = section(p, "screen.document.flags.head");
  assert.ok(sec, "the section is drawn under its head");
  const list = sec.querySelector('[data-flags="1"]');
  assert.ok(list, "the list is drawn");
  const row = list.querySelector(`[data-flag="${flag.candidate}"]`);
  assert.ok(row, "one row for the flag");
  const link = row.querySelector("a");
  assert.ok(link && /\/app\/contradiction\//.test(link.getAttribute("href")) && link.getAttribute("href").includes(flag.candidate), "the pair is linked to the contradiction");
  assert.ok(row.textContent.includes("Council minutes") && row.textContent.includes(OTHER), "each passage named by its document");
  assert.ok(says(row, "screen.contradiction.flagged.by", { member: "ann", date: day(held.flagged_by.at) }), "who flagged it, and when, beneath");
});
const says = (el, key, vars) => String(el && el.textContent || "").includes(word(key, vars || {}));

/** `ann` types page 1 of a PDF whose second page has no text (a real transcription); `ben`, a member of the project, is signed in */
async function typed() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const ben = await world.signIn("ben", { capabilities: ["contribute"] });
  const project = await world.recipes.project(ann, "Pothole repairs");
  await ann.act("projectinvite", { query: { projectId: project, handle: "ben" } });
  await ben.act("projectjoin", { query: { projectId: project } });
  const pdf = await world.recipes.partialPdf(ann, "Inspection report", { project });
  const typing = (await ann.read("transcriptions", { query: { bundleId: pdf.bundle } })).transcriptions[0];
  return { world, ann, ben, project, pdf, typing, at: "/app/document/" + pdf.bundle };
}
const typedBox = (p) => main(p).querySelector("[data-fold=typed]");

test("R139 C-M2 a typed page a second member confirmed draws screen.document.attest.checked with who and when, to the typist and to the one who checked it; control: before the confirmation neither is drawn", async () => {
  const t = await typed();
  const before = await pageOn(t.world, t.ann, t.at);
  assert.ok(typedBox(before), "the typed page is drawn");
  assert.ok(!typedBox(before).textContent.includes(lead("screen.document.attest.checked")), "control: not yet checked, no checked line");
  assert.ok(says(typedBox(before), "screen.document.attest.status", { name: "ann" }), "control: and it says so");
  const done = await t.ben.act("transcriptionattest", { body: { contentId: t.typing.content_id, note: "Compared with the page image." } });
  assert.ok(done && done.ok !== false, "the world recorded ben's confirmation");
  const counted = (await t.ann.read("transcriptions", { query: { bundleId: t.pdf.bundle } })).transcriptions[0].attestations.find((a) => a.counts);
  assert.ok(counted && counted.at, "a confirmation that counts, dated");
  for (const [who, name] of [[t.ann, "ben"], [t.ben, "ben"]]) {
    const p = await pageOn(t.world, who, t.at);
    assert.ok(says(typedBox(p), "screen.document.attest.checked", { name, date: day(counted.at) }), `${who.handle || who.member} reads who checked it, and when`);
  }
});

/** a lead `ann` flagged between two pages of her project, by the real act, and the page of its contradiction */
async function flagged() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const a = await world.recipes.page(ann, "Lease amendment, March 2024", { paragraphs: ["The rent adjustment takes effect on November 1, 2026."], project });
  const b = await world.recipes.page(ann, "Rent notice, September 2026", { paragraphs: ["The adjusted rent is due beginning December 1, 2026."], project });
  const unit = async (h) => (await ann.read("reading", { query: { sha256: h.sha } })).text_units[0].extent;
  const flag = await ann.act("contradictionflag", { body: { here: { capture: a.sha, extent: await unit(a) }, other: { capture: b.sha, extent: await unit(b) }, reason: "The notice and the amendment give two different dates." } });
  const facts = (await ann.read("contradictionfacts", { query: { candidate: flag.candidate } })).facts;
  return { world, ann, project, flag, facts, at: "/app/contradiction/" + flag.candidate };
}

test("R139 C-M13 a lead a member flagged draws screen.contradiction.lead.member and not the assistant's guess; each side's kind is drawn by its reader id (screen.contradiction.doctype.<id>)", async () => {
  const f = await flagged();
  const kind = f.facts.find((x) => x.fact === "doctype");
  assert.ok(kind && kind.a && kind.b, "the world states a kind for each side");
  const p = await pageOn(f.world, f.ann, f.at, SERVED);
  const text = main(p).textContent;
  assert.ok(text.includes(word("screen.contradiction.lead.member")), "the member's lead is said to be a member's");
  assert.ok(!text.includes(word("screen.contradiction.this.is.a.lead.the.assistant")), "never the assistant's guess");
  const row = main(p).querySelector('[data-fact="doctype"]');
  assert.ok(row, "the kinds are drawn");
  assert.ok(says(row, "screen.contradiction.doctype." + kind.a) && says(row, "screen.contradiction.doctype." + kind.b), "each side by the word held for its reader id");
  assert.doesNotMatch(text, new RegExp("\\b" + kind.a + "\\b"), "never the id itself");
});

test("R139 C-M13 control: a reader id the design holds no row for draws no label for its side, and a side with a held id still does; no id is ever drawn as a label", async () => {
  const f = await flagged();
  const kind = f.facts.find((x) => x.fact === "doctype");
  /* the real answer, one side's reader id replaced by one no reader registers (no real world makes one; fixtures-generic: no_such_reader) */
  const alter = (op, a) => {
    if (op !== "contradictionfacts" || !a.json || !a.json.result) return a;
    const facts = a.json.result.facts.map((x) => (x.fact === "doctype" ? { ...x, b: "no_such_reader" } : x));
    return { ...a, json: { ...a.json, result: { ...a.json.result, facts } } };
  };
  const p = await pageOn(f.world, f.ann, f.at, SERVED, alter);
  const row = main(p).querySelector('[data-fact="doctype"]');
  assert.ok(row, "the side with a held id is drawn");
  assert.ok(says(row, "screen.contradiction.doctype." + kind.a), "its label");
  assert.equal(row.querySelectorAll("[data-kind]").length, 1, "and only that side's");
  assert.doesNotMatch(main(p).textContent, /no_such_reader/, "never the id");
  const both = await pageOn(f.world, f.ann, f.at, SERVED, (op, a) => (op === "contradictionfacts" && a.json && a.json.result
    ? { ...a, json: { ...a.json, result: { ...a.json.result, facts: a.json.result.facts.map((x) => (x.fact === "doctype" ? { ...x, a: "no_such_reader", b: "no_such_reader" } : x)) } } } : a));
  assert.ok(main(both).querySelector('[data-fact="doctype"]') === null, "neither side held: no row at all");
});

/* ---- Question ---- */
/** `ann`'s project and a question of it resting on `n` documents she holds, the passages (cited, with no grade and no partition) */
async function asked(n, { role = "supports" } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects", "publish"] });
  const project = await world.recipes.project(ann, "Stormwater");
  const docs = [];
  for (let i = 0; i < n; i++) docs.push((await world.recipes.hold(ann, "Passage " + (i + 1), "The Director shall repair each reported pothole, part " + (i + 1) + ".", project)).bundle);
  const id = (await world.recipes.question(ann, project, { title: "Seven days", text: "Do crews repair each pothole within seven days?", legs: docs.map((target) => ({ target, role })), draw: true })).id;
  return { world, ann, project, docs, id, at: "/app/question/" + id };
}
const tick = (p, id) => { p.doc.getElementById(id).checked = true; };

test("R139 C-M5 a 'Yes, because of' that names a passage answered 'No' is set aside and the page says so (screen.question.yes.setaside, {n} the passage's number); control: a 'Yes' naming a 'Yes' sets nothing aside", async () => {
  const q = await asked(2);
  const p = await pageOn(q.world, q.ann, q.at);
  tick(p, "ask-0-0"); /* passage 1: "No, my answer falls" */
  tick(p, "ask-1-1"); tick(p, "ask-which-1-0"); /* passage 2: "Yes, because of" passage 1 */
  await press(p, "inquiryground", { reason: "my reading" });
  assert.ok(says(main(p), "screen.question.yes.setaside", { n: "1" }), "the page says the Yes that names passage 1 was set aside");
  const held = (await q.ann.read("inquirypartition", { query: { id: q.id } }));
  assert.equal(held.answered, true, "the world holds the answers");
  const c = await asked(2);
  const r = await pageOn(c.world, c.ann, c.at);
  tick(r, "ask-0-1"); tick(r, "ask-1-1"); tick(r, "ask-which-1-0");
  await press(r, "inquiryground", { reason: "my reading" });
  assert.ok(!main(r).textContent.includes(lead("screen.question.yes.setaside")), "control: a Yes naming a Yes sets nothing aside");
});

test("R139 E-I2 a question a published case carries says so (screen.question.carried); control: a question no case carries does not", async () => {
  const q = await asked(1);
  const found = await q.world.recipes.finding(q.ann, q.project);
  const before = await pageOn(q.world, q.ann, "/app/question/" + found.id);
  assert.ok(!main(before).textContent.includes(word("screen.question.carried")), "control: not yet published");
  await q.world.recipes.published(q.ann, found);
  const p = await pageOn(q.world, q.ann, "/app/question/" + found.id);
  assert.ok(says(main(p), "screen.question.carried"), "the published finding says a case carries it");
  const other = await pageOn(q.world, q.ann, q.at);
  assert.ok(!main(other).textContent.includes(word("screen.question.carried")), "control: a question no case carries does not");
});

test("R139 C-M6 a severed passage offers 'Put it on the other side' beside Reinstate, and ticking it reinstates the leg on the other side (citation R23); control: Reinstate alone keeps the side it was cited on", async () => {
  /* the side the question's own record states for the leg, as the world holds it */
  const roleOf = async (q) => (/target: (\S+)\n\s+role: (\w+)/.exec(String((await q.ann.read("image", { query: { id: q.id } }))["bundle.md"]).replace(/\r/g, "").split(/\n---\n/)[0].split("basis:")[1] || "") || [])[2];
  const q = await asked(1);
  const p = await pageOn(q.world, q.ann, q.at);
  await press(p, "sever", { reason: "wrong side" });
  assert.ok(main(p).querySelector('[data-leg="severed"]'), "the leg is drawn severed");
  assert.ok(says(main(p), "screen.question.reinstate.otherside"), "the other-side choice stands beside Reinstate");
  assert.ok(says(main(p), "screen.question.reinstate.otherside.help"), "with its help");
  tick(p, "question-reinstate-side-0-0");
  await press(p, "reinstate", { reason: "it cuts against" });
  assert.equal(await roleOf(q), "cuts_against", "the world moved the leg to the other side");
  const c = await asked(1);
  const r = await pageOn(c.world, c.ann, c.at);
  await press(r, "sever", { reason: "wrong side" });
  await press(r, "reinstate", { reason: "back again" });
  assert.equal(await roleOf(c), "supports", "control: Reinstate alone keeps its side");
  const live = await asked(1);
  const l = await pageOn(live.world, live.ann, live.at);
  assert.ok(!main(l).textContent.includes(word("screen.question.reinstate.otherside")), "control: a live passage offers no other-side choice");
});
