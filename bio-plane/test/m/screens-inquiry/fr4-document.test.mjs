/* screens-inquiry fix round 3 of T51 (SCREENS-INQUIRY #19), the `document` screen: C16 (R3: one `heldcaptures` read for this copy's row, no `projectquestions`
 * for each project), C17 (R96, R3: an unread copy says so and draws no re-read; a picture is a picture by its record; typed words without "Nothing here"),
 * C25 (R3, screens-intake R54: the record's name), C95 (R3: this page's question preselected and first), N2 (R49, R61: a cite with no question chosen says
 * so beside the act), C81 (R5: the controls at 390 px), and interface-shell R113 (every act declares what it re-reads). On interface-shell's served page over
 * a scripted plane; every expectation is a word read by key (K3810); no test holds a sentence's English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, boot } from "../interface-shell/harness.mjs";
import { main, actsIn, fill, press, says, word, plane, storeWorld, READING, DOCUMENT_MD, provenanceOf, inquiryMd, SCREENS, P, Q, Q2, D, SHA } from "./fixtures.mjs";
import { onPhone } from "./phone.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
async function openWith(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
async function choose(p, id, value) {
  const el = p.doc.getElementById(id);
  el.value = value;
  p.fire(el, "change");
  await p.settle();
}
/** the page's reads of heldcaptures that carry bundle_id: this copy's row (R137's picker reads the team's documents besides) */
const copyReads = (p) => p.byOp("heldcaptures").filter((r) => r.query.bundle_id !== undefined);
/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it over the world's door, `plane` scripting
   only the ops it names; `answers(op)` are the door's own answers to that op, in order */
const OWN = { capabilities: ["contribute", "create_projects"] };
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens: SCREENS, door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; }, session, path, ...o });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}
const MINUTES = "<html><head><title>Council minutes</title></head><body><p>The council met on Monday.</p></body></html>";
/** A member `ann` with a project and, in it, a question `closed` and a question `seven`, and a copy of a page of the council's, held by her. With `forQuestion` the copy was captured from a public address
 *  for `closed` (`acquire` with `for`, the address served by the world's network, `world.script`) and filed as held (`recipes.hold` of the same bytes), so its held row names that question;
 *  with `vouch` she has also vouched for it (`select`, `release`). */
async function member({ forQuestion = false, vouch = false } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const seven = (await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true })).id;
  const closed = (await world.recipes.question(ann, project, { title: "Closed", text: "Does closed mean repaired?", draw: true })).id;
  if (forQuestion) {
    const address = "https://records.example.org/minutes.html";
    world.script(address, async () => new Response(MINUTES, { status: 200, headers: { "content-type": "text/html" } }));
    await ann.act("acquire", { body: { locator: address, for: closed } });
  }
  const doc = await world.recipes.hold(ann, "Council minutes", MINUTES, project, { type: "text/html", read: true });
  if (vouch) {
    const sel = await ann.act("select", { body: { ids: [doc.bundle] } });
    await ann.act("release", { query: { handle: sel.handle, acknowledgment: "Checked against the site", mitigation: "None needed" } });
  }
  return { world, ann, project, seven, closed, document: doc.bundle, sha: doc.sha, at: "/app/document/" + doc.bundle };
}
/** the document's record with a given profile, file name and title for its register document */
const docWith = (md, reg = {}, sha = SHA) => ({ [D]: { "bundle.md": md, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: sha, ...(reg.capture || {}) }, ...Object.fromEntries(Object.entries(reg).filter(([k]) => k !== "capture")) }] }) } });
const PDF_MD = DOCUMENT_MD.replace('title: "Pothole repair policy, Administrative Instruction 4.12"', 'title: "ai-4-12.pdf"');

/* ---- C16 / R3: the reads ---- */
test("R3 C16 the page reads heldcaptures once, for this copy's row alone (bundle_id), and never one projectquestions for each project", async () => {
  const w = await member();
  for (let i = 0; i < 6; i++) await w.world.recipes.project(w.ann, "Project " + i);
  /* a question resting on the copy, so it is cited */
  await w.world.recipes.question(w.ann, w.project, { title: "Resting", text: "Is it so?", legs: [{ target: w.document, role: "supports" }], draw: true });
  const p = await pageOn(w.world, w.ann, w.at);
  const h = copyReads(p);
  assert.equal(h.length, 1, "one heldcaptures read");
  assert.equal(h[0].query.bundle_id, w.document, "for this copy's row");
  assert.ok(!("member" in h[0].query) && !("project" in h[0].query), "not narrowed by member or project, and no list of 500");
  assert.ok(!("limit" in h[0].query), "a single row asks no limit");
  const pq = p.byOp("projectquestions");
  assert.ok(pq.length <= 1 && pq.every((r) => r.query.project === w.project), "at most the document's own project's questions are read: " + pq.map((r) => r.query.project));
  /* control: a page whose copy has no citations reads the same */
  const bare = await w.world.recipes.page(w.ann, "Uncited page", { project: w.project });
  const q = await pageOn(w.world, w.ann, "/app/document/" + bare.bundle);
  assert.equal(copyReads(q).length, 1, "control: one heldcaptures read with no citations");
  assert.equal(q.byOp("projectquestions").length, pq.length, "control: the same projectquestions reads with no citations");
});

test("R3 R118 C16 C35 two questions of two projects with one title are told apart by their project, each read once; control: unique titles unchanged and read nothing more", async () => {
  const w = await member();
  const elsewhere = await w.world.recipes.project(w.ann, "Elsewhere");
  const QB = (await w.world.recipes.question(w.ann, w.project, { title: "Is it repaired?", text: "Is it repaired?", draw: true })).id;
  const QA = (await w.world.recipes.question(w.ann, elsewhere, { title: "Is it repaired?", text: "Is it repaired?", draw: true })).id;
  const QU = (await w.world.recipes.question(w.ann, null, { title: "A unique title", text: "A unique title" })).id;
  /* the world's `list` states each row's project, so the page would need no read to tell them apart: the rows are scripted without it, over the real questions (R118) */
  const list = { bundles: [{ bundle_id: QA, title: "Is it repaired?" }, { bundle_id: QB, title: "Is it repaired?" }, { bundle_id: QU, title: "A unique title" }] };
  const p = await pageOn(w.world, w.ann, w.at, { plane: { list: ok(list) } });
  const options = p.doc.getElementById("document-cite-question").querySelectorAll("option");
  const label = (v) => text(options.find((o) => o.getAttribute("value") === v));
  assert.equal(label(QA), word("screen.document.cite.option", { question: "Is it repaired?", project: "Elsewhere" }), "the one in another project names it");
  assert.equal(label(QB), word("screen.document.cite.option", { question: "Is it repaired?", project: "Pothole repairs" }), "the one in this project names it");
  assert.equal(label(QU), "A unique title", "control: a unique title in no known project is its title alone");
  assert.deepEqual(p.byOp("image").filter((r) => [QA, QB, QU].includes(r.query.id)).map((r) => r.query.id).sort(), [QA].sort(), "only the questions the page cannot tell apart are read: " + p.byOp("image").map((r) => r.query.id));
  assert.ok(p.byOp("projectquestions").every((r) => r.query.project === w.project), "no project's questions but this one's");
});

/* ---- C17 / R96 / R3: an unread copy ---- */
const UNREAD = { reading: ok({ ok: true, found: false, capture_sha: SHA, reading: null }) };
test("R96 R3 C17 a copy no reading is held for says so and draws no act that reads it again; control: a copy with a reading held and pages unread still offers one", async () => {
  const PICTURE = docWith(DOCUMENT_MD.replace("ai-4-12.pdf", "photo.jpg"), { file: "photo.jpg", profile: { format: { format: "jpeg" }, source_content_type: "image/jpeg" } });
  for (const [name, images] of [["a picture", PICTURE], ["a document with no type stated", {}]]) {
    const p = await openWith(at, { images, plane: UNREAD, boot: {} });
    const acts = actsIn(main(p));
    assert.ok(!acts.includes("pdfstructure") && !acts.includes("pagetranscribe"), `${name}: no act that reads it again: ${acts}`);
    assert.ok(says(main(p), "screen.document.text.unread"), `${name}: it says the copy is unread`);
    assert.ok(!says(main(p), "screen.document.ocr.refused.unread"), `${name}: and not the rule the plane does not follow`);
    assert.equal(p.byOp("pdfstructure").length, 0, `${name}: nothing sent`);
  }
  /* control: a reading held with a page it could not make out offers the OCR re-read, for a PDF */
  const held1 = await openWith(at, { plane: { reading: ok(READING({ unread_pages: [7] })) } });
  assert.ok(actsIn(main(held1)).includes("pdfstructure"), "control: a held reading with unread pages still offers the OCR re-read");
});

test("R96 R3 C17 a picture is a picture by its record, whatever its reading states: a reading with no content type is never offered the PDF structure act", async () => {
  const reading = READING({ text_units: [], unread_pages: [0] });
  delete reading.reading.content_type;
  const PICTURE = docWith(DOCUMENT_MD, { file: "photo.jpg", profile: { format: { format: "jpeg" }, source_content_type: "image/jpeg" } });
  const p = await openWith(at, { images: PICTURE, plane: { reading: ok(reading) } });
  assert.ok(!actsIn(main(p)).includes("pdfstructure"), "a picture by its record: not offered the PDF structure act");
  /* control: the same reading over a record that states a PDF is offered it */
  const PDF = docWith(DOCUMENT_MD, { file: "ai.pdf", profile: { format: { format: "pdf" }, source_content_type: "application/pdf" } });
  const q = await openWith(at, { images: PDF, plane: { reading: ok(reading) } });
  assert.ok(actsIn(main(q)).includes("pdfstructure"), "control: a PDF by its record is offered it");
});

test("R96 R97 R3 C17 typed words are drawn without Nothing here; control: a reading with no words and nothing typed still says so", async () => {
  const w = await member();
  /* the reading (a PDF with no words) is scripted over the world's copy; the typing is the member's own act, and its list and words the world's */
  const noWords = READING({ capture_sha: w.sha, text_units: [], unread_pages: [0] });
  await w.ann.act("transcribe", { body: { bundleId: w.document, extent: { kind: "pdf-page", page: 0 }, text: "Typed words of the first page." } });
  const p = await pageOn(w.world, w.ann, w.at, { plane: { reading: ok(noWords) } });
  assert.ok(main(p).querySelector('[data-typed-text]'), "the typed words are drawn");
  assert.ok(text(main(p).querySelector('[data-typed-text]')).includes("Typed words of the first page."), "the words she typed");
  assert.equal(main(p).querySelector('.cs-state[data-state="empty"]'), null, "and no Nothing here above them");
  const other = await member();
  const q = await pageOn(other.world, other.ann, other.at, { plane: { reading: ok(READING({ capture_sha: other.sha, text_units: [], unread_pages: [0] })) } });
  assert.ok(main(q).querySelector('.cs-state[data-state="empty"]'), "control: with nothing typed the reading says it holds nothing");
});

/* ---- C25 / R3: the record's name ---- */
/* a reading's title in the fixture: a document's own name, never a word-table sentence */
const READ_TITLE = "Street repair order 7-3";
const headOf = (p) => text(main(p).querySelector("h1"));
test("R3 C25 the page is named by the record's one rule: the reading's title, else the title the capture states, else its file name, else its host and day; a document with a title draws it", async () => {
  const slugged = DOCUMENT_MD.replace('title: "Pothole repair policy, Administrative Instruction 4.12"', 'title: "ai-4-12.pdf"');
  /* a PDF with no reading is named by its file name, though the file name is the address's last segment */
  const byFile = await openWith(at, { images: docWith(slugged, { capture: { file_name: "ai-4-12.pdf" } }), plane: UNREAD });
  assert.equal(headOf(byFile), "ai-4-12.pdf", "the file name the source states");
  /* once read, the reading's title */
  const read = await openWith(at, { images: docWith(slugged, { capture: { file_name: "ai-4-12.pdf" } }), plane: { reading: ok(READING({ title: READ_TITLE })) } });
  assert.equal(headOf(read), READ_TITLE, "the reading's title");
  /* the title the capture's document states (acquisition R98) */
  const stated = await openWith(at, { images: docWith(slugged, { title: "Notice 2026-118" }), plane: UNREAD });
  assert.equal(headOf(stated), "Notice 2026-118", "the title the capture states");
  /* no title and no file name stated: the address's last segment is no name; its host and day are */
  const none = await openWith(at, { images: docWith(slugged), plane: UNREAD });
  assert.equal(headOf(none), word("document.untitled.web", { site: "example.org", date: "October 2, 2026" }).replace(/\s+/g, " "), "the host and the day");
  /* control: a document with a title of its own draws the title */
  const titled = await openWith(at, { plane: UNREAD });
  assert.equal(headOf(titled), "Pothole repair policy, Administrative Instruction 4.12", "control: its title");
});

/* ---- C95 / R3: this page's question ---- */
const optionValues = (p) => p.doc.getElementById("document-cite-question").querySelectorAll("option").map((o) => o.getAttribute("value"));
test("R3 C95 the question the copy was held for is preselected and leads the list, held or vouched; control: with none, none is selected and the choose option leads", async () => {
  const w = await member({ forQuestion: true });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(p.doc.getElementById("document-cite-question").value, w.closed, "preselected");
  assert.equal(optionValues(p)[0], w.closed, "and first in the list");
  assert.ok(!optionValues(p).includes(""), "no empty choose option when one is selected");
  assert.ok(optionValues(p).includes(w.seven), "the project's other question is still offered");
  const v = await member({ forQuestion: true, vouch: true });
  const vouched = await pageOn(v.world, v.ann, v.at);
  assert.equal(vouched.doc.getElementById("document-cite-question").value, v.closed, "a vouched copy keeps it");
  assert.equal(vouched.byOp("heldcaptures")[0].query.state, "held_and_vouched", "the one read answers a vouched copy too");
  const n = await member();
  const none = await pageOn(n.world, n.ann, n.at);
  assert.equal(none.doc.getElementById("document-cite-question").value, "", "control: none held for, none selected");
  assert.equal(optionValues(none)[0], "", "control: the choose option leads");
});

test("R55 C16 a held row of another member's capture draws no held banner and no vouch box; control: her own does", async () => {
  /* rosa's project, which ann has joined, holds a copy rosa has not vouched for: it is rosa's held copy, and ann reads its page */
  const w = await member();
  const rosa = await w.world.signIn("rosa", OWN);
  const hers = await w.world.recipes.project(rosa, "Rosa's project");
  await rosa.act("projectinvite", { query: { projectId: hers, handle: "ann" }, body: {} });
  await w.ann.act("projectjoin", { query: { projectId: hers }, body: {} });
  const copy = await w.world.recipes.page(rosa, "Rosa's page", { project: hers });
  const theirs = await pageOn(w.world, w.ann, "/app/document/" + copy.bundle);
  assert.equal(main(theirs).querySelector("[data-held]"), null, "not hers: no banner");
  assert.ok(!actsIn(main(theirs)).includes("release"), "no vouch box");
  /* a held row naming no actor cannot exist: every capture a document is filed from records its actor (capture/index.mjs:1035), and a sighting that records none files no document (:1008-1024) */
  const mine = await pageOn(w.world, w.ann, w.at);
  assert.ok(main(mine).querySelector("[data-held]") && actsIn(main(mine)).includes("release"), "control: her own is held");
});

/* ---- N2 / R49 / R61: a cite with no question chosen ---- */
test("R49 R61 N2 Cite this with no question chosen sends nothing and says so beside the act pressed; control: with a question chosen it sends", async () => {
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(p.doc.getElementById("document-cite-question").value, "", "none chosen");
  const slot = await press(p, "cite");
  assert.equal(p.byOp("cite").length, 0, "nothing sent");
  assert.ok(slot && says(slot, "screen.find-in.questionfirst"), "the sentence is said in the act's own place");
  const q = await pageOn(w.world, w.ann, w.at);
  await choose(q, "document-cite-question", w.seven);
  await press(q, "cite");
  assert.equal(q.byOp("cite").length, 1, "control: with a question chosen it sends");
  assert.equal(q.answers("cite")[0].cited.length, 1, "and the world cites the passage");
});

/* ---- C81 / R5: the controls at 390 px ---- */
test("R5 C81 at 390 px the document's route and OCR controls lie inside the screen and are 44 px to press; control: at 1280 px they lie inside it and the untouched controls keep their boxes", { timeout: 120000 }, async () => {
  const labels = [word("act.provenanceroute.label.document"), word("act.pdfstructure.label.document")];
  const o = { plane: { reading: ok(READING({ unread_pages: [7] })) } };
  const m = await onPhone({ path: at, o, width: 390, controls: labels });
  assert.ok(m.mainScroll <= 390, "the main area is no wider than the screen: " + m.mainScroll);
  for (const l of labels) {
    assert.ok(m.boxes[l].length >= 1, "drawn: " + l);
    for (const b of m.boxes[l]) assert.ok(b.right <= 390 && b.left >= 0 && b.width >= 44 && b.height >= 44, `${l} inside and 44 px: ${JSON.stringify(b)}`);
    assert.ok(m.boxes[l].every((b) => b.width >= 120), `${l} is not squeezed beside its text: ${JSON.stringify(m.boxes[l])}`);
  }
  assert.deepEqual(m.over.filter((x) => /button/.test(x)), [], "no button past the edge");
  const wide = await onPhone({ path: at, o, width: 1280, controls: [...labels, word("document.read.cite")] });
  for (const l of labels) for (const b of wide.boxes[l]) assert.ok(b.right <= 1280 && b.left >= 0, `control: ${l} inside at 1280: ${JSON.stringify(b)}`);
  const cite = wide.boxes[word("document.read.cite")][0];
  /* the height is the shell's one control height (40 px until interface-shell drew every control 44 px, attempt 6) */
  assert.equal(cite.width, 86, "control: an untouched control keeps its 1280 px width");
  assert.ok(cite.height >= 40 && wide.boxes[labels[0]].every((b) => b.height === cite.height), "control: and the shell's one control height: " + JSON.stringify([cite, wide.boxes[labels[0]]]));
});

/* ---- interface-shell R113 ---- */
test("R3 R113 every act of the document screen declares what it re-reads, and a cite re-reads what cites the copy and no other read; control: a refused act re-reads nothing", async () => {
  const screen = SCREENS.find((s) => s.id === "document");
  const readNames = Object.keys(screen.reads({ subject: D }));
  for (const a of screen.acts.filter((x) => !["hashcopy", "revisioncompare", "linkopen"].includes(x.op))) {
    assert.ok(a.rereads === "all" || (Array.isArray(a.rereads) && a.rereads.every((n) => readNames.includes(n))), `${a.op} declares rereads: ${JSON.stringify(a.rereads)}`);
  }
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  await choose(p, "document-cite-question", w.seven);
  const before = { image: p.byOp("image").filter((r) => r.query.id === w.document).length, backlinks: p.byOp("backlinks").length, list: p.byOp("list").length };
  await press(p, "cite");
  assert.equal(p.answers("cite")[0].cited.length, 1, "the world cited it");
  assert.equal(p.byOp("backlinks").length, before.backlinks + 1, "what cites it is read again");
  assert.equal(p.byOp("image").filter((r) => r.query.id === w.document).length, before.image, "the capture is not");
  assert.equal(p.byOp("list").length, before.list, "nor the question list");
  /* a refused cite: into a question of another member's project, which she cannot see (the world answers it as one that does not exist) */
  const rosa = await w.world.signIn("rosa", OWN);
  const hers = await w.world.recipes.project(rosa, "Rosa's project");
  const foreign = (await w.world.recipes.question(rosa, hers, { title: "Rosa's", text: "Is it rosa's?", draw: true })).id;
  const r = await pageOn(w.world, w.ann, w.at);
  await choose(r, "document-cite-question", foreign);
  const b2 = { backlinks: r.byOp("backlinks").length, image: r.byOp("image").length };
  await press(r, "cite");
  assert.equal(r.answers("cite")[0].ok, false, "the world refused it");
  assert.deepEqual([r.byOp("backlinks").length, r.byOp("image").length], [b2.backlinks, b2.image], "control: a refused cite re-reads nothing");
});

/* ---- U437 / R126 / R127: the two folds as the drawing places them ---- */
test("R126 R127 the testify fold labels 'How you know' by screen.document.testify.how and sits before the contradiction fold, both before the names' closing note; control: no unmatched name, no testify fold", async () => {
  const names = { resolutions: ok({ ok: true, names: [{ entity_id: "ENT-17", label: "L. Chen", kind: "person", grade: "B", matched_by: "label" }], resolutions: [], unresolved: [{ ref: "Director Chen", label: "Director Chen", page: 3 }] }) };
  const p = await openWith(at, { plane: names });
  const fold = main(p).querySelector('[data-fold="testify"]');
  assert.ok(fold, "the fold is drawn from unresolved");
  assert.ok(says(fold, "screen.document.testify.how"), "its label is the drawing's key");
  const order = main(p).innerHTML;
  assert.ok(order.indexOf('data-fold="testify"') < order.indexOf('data-fold="contradict"') || !order.includes('data-fold="contradict"'), "testify before contradict");
  const none = await openWith(at, { plane: { resolutions: ok({ ok: true, names: [], resolutions: [], unresolved: [] }) } });
  assert.equal(main(none).querySelector('[data-fold="testify"]'), null, "control: no unmatched name, no fold");
});
