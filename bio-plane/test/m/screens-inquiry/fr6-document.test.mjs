/* screens-inquiry fix round 6 (T51), the document screen: G6 (a stored statement that a copy was not read is drawn as that statement, with its size, and
 * offers no OCR re-read after it), G8 (a statement extraction states `repairable` offers "Read it"; a plain final does not), G13 (a text reading with `more` is
 * drawn as being read, with its progress, never as complete). On interface-shell's served page over a scripted plane whose reading answers are copied from the
 * real op (the shapes `fr6-seam.test.mjs` makes by the member's own acts); every expectation is a word read by key (R44). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { boot, ok } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { open, main, actsIn, says, word, D, SHA, DOCUMENT_MD, SCREENS, storeWorld } from "./fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
/* a capture of five parts: the provenance document's `capture.sha256` is the WHOLE, its parts listed beside it (capture's `#uploadedDocument`, acquisition R10) */
const WHOLE = "a05b3f74" + "4".repeat(56);
const PARTS = Array.from({ length: 5 }, (_, i) => ({ file: `snapshots/upload-${WHOLE}.part00${i}`, sha256: String(i + 1).repeat(64), bytes: 8388608 }));
const BYTES = 41942040;
const five = { [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: WHOLE, bytes: BYTES }, parts: PARTS }] }) } };
/* the statement as the real `op=reading` answers it for a capture over the reader's size (the seam test makes it by a 40 MB upload) */
/* what the real plane stores for a capture over the reader's size (`fr6-seam.test.mjs` makes it by a 40 MB upload): its reason, the figure it measured, the limit and the basis it states */
const BOUND = 25165824;
const BASIS = "This file is 41942040 bytes in 5 parts, over the 25165824 bytes allowed for this kind of file.";
const stated = (o = {}) => ok({ ok: true, found: true, capture_sha: WHOLE, bundle_id: D, content_type: "generic", reader_version: 1, reader_found: false, entity_count: 0,
  at: "2026-10-22T15:22:10Z", reading: { content_type: "generic", reader_version: 1, found: false, basis: BASIS, failure: "final", reason: "TOO_LARGE", size: BYTES, bound: BOUND, key: "limit.pdf.bytes", metadata: null },
  text_units: [], bytes: BYTES, format: "undetermined", ...o });
/** The page `path` as a member of a real world (the real store, a real sign-in, the page's own door): the bundles in `images` and the reading `reading`
 *  are the only answers the test scripts; every other op, `heldcaptures` among them, is the store's own for a copy it holds nothing of. */
async function openIn(path, { images = {}, reading, world = null, as = null } = {}) {
  const w = world || await storeWorld();
  const me = as || await w.signIn("ann", { capabilities: ["contribute"] });
  const { door, session } = w.boot(me);
  const plane = { image: (r) => ok(Object.hasOwn(images, r.query.id) ? images[r.query.id] : null), ...(reading ? { reading } : {}) };
  const p = await boot({ screens: SCREENS, door, session, path, plane });
  await p.settle();
  return p;
}
/** The page of a document the world holds, as `as` sees it over the world's own door: nothing scripted. */
async function openRealDocument(world, as, bundle) {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path: "/app/document/" + bundle });
  await p.settle();
  return p;
}
const mbOf = (n) => word("size.mb", { n: (n / 1048576).toFixed(1) });
const sizeWord = () => mbOf(BYTES);
/* a size refusal is drawn by its own figures (R96, fix round 10): the reading's size and its limit */
const sizeSentence = () => word("screen.document.reading.toolarge", { size: mbOf(BYTES), limit: mbOf(BOUND) });

test("R96 R129 G6 a 5-part capture whose reading is stored under the whole as a final statement draws that statement with the file's size; no 'Nothing here', no OCR re-read, nothing offered after it", async () => {
  const p = await openIn(at, { images: five, reading: stated() });
  const reads = p.byOp("reading").map((r) => r.query.sha256);
  assert.deepEqual(reads, [WHOLE], "the reading is asked of the whole's digest, never a part's");
  const m = main(p);
  assert.ok(text(m).includes(sizeSentence()), "the statement the plane stored is drawn: a size refusal, with the reading's own size and limit (R96)");
  assert.ok(text(m).includes(sizeWord()), "with the file's size");
  assert.ok(!says(m, "state.empty"), "the section is not 'Nothing here'");
  const acts = actsIn(m);
  assert.ok(!acts.includes("pdfstructure"), "no OCR re-read after a final statement");
  assert.ok(!acts.includes("readheld"), "and no 'Read it' for a statement that stands");
  assert.notEqual(m.querySelector("[data-text-state]") && m.querySelector("[data-text-state]").getAttribute("data-text-state"), "none", "and the fact line does not say the copy holds no text");
  assert.ok(m.querySelector('[data-reading="stated"]'), "the statement is its own element");
});

test("R96 G6 control: a reading that found no words and states no failure still offers the OCR re-read, as before; a full reading offers none", async () => {
  const none = await open(at, { plane: { reading: ok({ ok: true, found: true, capture_sha: SHA, reading: { content_type: "application/pdf", found: true, page_count: 2 }, text_units: [], unread_pages: [0, 1] }) } });
  assert.ok(actsIn(main(none)).includes("pdfstructure"), "blind pages offer OCR");
  const full = await open(at, { plane: { reading: ok({ ok: true, found: true, capture_sha: SHA, reading: { content_type: "application/pdf", found: true },
    text_units: [{ seq: 1, extent: { kind: "pdf-page", page: 0 }, reference: "u1", truncated: false, text: "Words of the page." }], unread_pages: [] }) } });
  assert.ok(!actsIn(main(full)).includes("pdfstructure"), "a full reading offers no OCR");
});

test("R96 R129 G8 a statement extraction states repairable (the old '(multipart)' final) offers 'Read it'; a plain final does not; pressing it sends readheld with the digest", async () => {
  const rep = await open(at, { images: five, plane: { reading: stated({ repairable: true }) } });
  assert.ok(actsIn(main(rep)).includes("readheld"), "Read it is offered for a repairable statement");
  assert.ok(text(main(rep)).includes(hasWord(OWED.repairable) ? word(OWED.repairable) : BASIS), "the statement is still said");
  assert.ok(!actsIn(main(rep)).includes("pdfstructure"), "and no OCR re-read");
  const plain = await open(at, { images: five, plane: { reading: stated() } });
  assert.ok(!actsIn(main(plain)).includes("readheld"), "a plain final is not offered Read it");
  const b = main(rep).querySelector('button[data-act="readheld"]');
  assert.equal(b.getAttribute("data-sha"), WHOLE, "it carries the whole's digest");
});

/* DEC-418's rows are on the design's table and not yet in the words list: a key is drawn when the list holds it, else the nearest held row stands in. The keys are
   held in variables, so this file names no key that the list lacks (the words check). */
const OWED = { progress: "screen.document.reading.progress", stated: "screen.document.reading.stated", repairable: "screen.document.reading.repairable", door: "screen.document.reading.repairable.door", done: "screen.document.reading.done" };
const sized = (n) => word(n >= 1048576 ? "size.mb" : "size.kb", { n: n >= 1048576 ? (n / 1048576).toFixed(1) : String(Math.round(n / 1024)) });

const lines = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ seq: from + i + 1, extent: { kind: "line", line: from + i }, reference: "u" + (from + i), truncated: false, text: "Line " + (from + i) + " of the long text." }));
const textAnswer = (o = {}) => ok({ ok: true, found: true, capture_sha: SHA, bundle_id: D, content_type: "text/plain", reader_found: true,
  reading: { content_type: "text/plain", found: true }, text_units: lines(3), bytes: 12000060, ...o });

test("R96 G13 a text reading with more is drawn as being read, as read_through of total (bytes of text), never as complete; its passages stay citable; no OCR, no Read it", async () => {
  const p = await open(at, { plane: { reading: textAnswer({ more: true, read_through: 3145728, total: 12000060 }) } });
  const m = main(p);
  assert.equal(m.querySelector("[data-text-state]").getAttribute("data-text-state"), "reading", "being read, not full");
  const progress = hasWord(OWED.progress) ? word(OWED.progress, { read: sized(3145728), total: sized(12000060) }) : word("state.loading") + " " + sized(3145728) + " / " + sized(12000060);
  assert.ok(text(m.querySelector("[data-text-state]").parentElement).includes(progress), "with how far: " + progress);
  assert.ok(m.querySelector('[data-reading="more"]'), "and said beside the passages");
  assert.ok(text(m).includes("Line 1 of the long text."), "what is read is shown");
  assert.ok(actsIn(m).includes("cite"), "and citable");
  assert.ok(!actsIn(m).includes("pdfstructure") && !actsIn(m).includes("readheld"));
  /* control: the same reading without `more` is complete and says nothing of being read */
  const done = await open(at, { plane: { reading: textAnswer() } });
  assert.equal(main(done).querySelector("[data-text-state]").getAttribute("data-text-state"), "full");
  assert.ok(!main(done).querySelector('[data-reading="more"]'));
});

test("R96 G13 while more, the reading is asked again on the page clock (at most every 10 seconds) until it is whole; then it is not asked again", async () => {
  let more = true;
  const reading = () => textAnswer({ text_units: lines(1), bytes: 100, ...(more ? { more: true, read_through: 50, total: 100 } : {}) });
  const p = await open(at, { plane: { reading } });
  const first = p.byOp("reading").length;
  await p.clock.tick(9000);
  assert.equal(p.byOp("reading").length, first, "not before 10 seconds");
  await p.clock.tick(1000);
  assert.equal(p.byOp("reading").length, first + 1, "once at 10 seconds");
  more = false;
  await p.clock.tick(10000);
  assert.equal(main(p).querySelector("[data-text-state]").getAttribute("data-text-state"), "full", "whole once the plane says it is");
  const whole = p.byOp("reading").length;
  await p.clock.tick(60000);
  assert.equal(p.byOp("reading").length, whole, "a whole reading is not asked again");
});

test("R96 G13 a reading the plane pages (`next`) draws the first page of passages and says it is a first page; the more control reads op=reading with after=<next> and the next passages follow; at the end there is no control and nothing is said to be cut", async () => {
  const pages = { "": textAnswer({ text_units: lines(4), next: 4, units_total: 6 }), 4: textAnswer({ text_units: lines(2, 4), next: null, units_total: 6 }) };
  const p = await open(at, { plane: { reading: (r) => pages[r.query.after === undefined ? "" : r.query.after] } });
  const m = main(p);
  const said = () => main(p).querySelector('[data-reading="more"]');
  /* screens-document-beta R61 (DEC-454): "Showing {n} of {m} passages" by its own row, and "More passages" apart from the page bar's "Next page" */
  assert.ok(said() && text(said()).includes(word("screen.document.reading.firstn", { n: "4", m: "6" })), "the first four of six, said");
  assert.ok(text(m).includes("Line 3 of the long text.") && !text(m).includes("Line 4 of the long text."), "four passages are drawn");
  assert.equal(p.byOp("reading").filter((r) => r.query.after !== undefined).length, 0, "the rest is not read until she asks");
  const box = (pg) => pg.doc.getElementById("document-read-more") && pg.doc.getElementById("document-read-more").querySelectorAll("label").find((l) => l.textContent.includes(word("document.read.more"))).querySelector("input");
  assert.ok(box(p), "the more control");
  const b = box(p); b.checked = true; p.fire(b, "change");
  await p.settle();
  assert.deepEqual(p.byOp("reading").filter((r) => r.query.after !== undefined).map((r) => r.query.after), ["4"], "it asks op=reading after the cursor");
  assert.ok(text(main(p)).includes("Line 5 of the long text."), "and the next passages follow");
  assert.ok(!said() || !text(said()).includes(word("screen.document.reading.firstn", { n: "6", m: "6" })), "at the end nothing is said to be cut");
  assert.ok(!p.doc.getElementById("document-read-more"), "and no more control");
});

test("R96 G6 G8 the design's rows (DEC-418) are drawn when the words list holds them: the statement with the file's size, the repairable sentence and its door; until then the plane's own words and 'Read it' stand in", async () => {
  const st = await open(at, { images: five, plane: { reading: stated() } });
  assert.ok(text(main(st)).includes(sizeSentence()), "a stored size refusal is drawn with the reading's own size and limit");
  const rep = await open(at, { images: five, plane: { reading: stated({ repairable: true }) } });
  assert.ok(text(main(rep)).includes(hasWord(OWED.repairable) ? word(OWED.repairable) : BASIS));
  const door = main(rep).querySelector('button[data-act="readheld"]');
  assert.ok(text(door).includes(hasWord(OWED.door) ? word(OWED.door) : word("document.read.title")), "the door by the design's label, else 'Read it'");
});

/* ------------------------------------------------------------------------------------------------------------------ G14 (completeness) */

test("R96 G14 a reading that states itself refused whole (a PDF over 16 MiB) draws its reason and the file's size: never 'none', never 'pages N have no text', no OCR re-read, its unread pages not offered as pictures of text", async () => {
  const BYTES2 = 20971520;
  const WHY = "the PDF is 20971520 bytes, over the 16777216 B its text is read from at the door, so only its first pages were read";
  const p = await open(at, { plane: { reading: ok({ ok: true, found: true, capture_sha: SHA, bundle_id: D, content_type: "application/pdf", reader_found: true,
    reading: { content_type: "application/pdf", found: true, page_count: 300 }, text_units: lines(2), unread_pages: [2, 3, 4, 5], bytes: BYTES2,
    completeness: { state: "stated", why: WHY } }) } });
  const m = main(p);
  assert.equal(m.querySelector("[data-text-state]").getAttribute("data-text-state"), "stated");
  assert.ok(text(m).includes(WHY), "the statement: the reason in the plane's words (the reading states no reason of its own, R96)");
  assert.ok(text(m).includes(word("size.mb", { n: (BYTES2 / 1048576).toFixed(1) })), "with the file's size (the original-file card)");
  assert.ok(!text(m).includes(word("screen.document.text.partial", { pages: "3–6" })) && !m.querySelector('[data-text-state="none"]'), "never 'pages have no text', never none");
  assert.ok(!actsIn(m).includes("pdfstructure") && !actsIn(m).includes("pagetranscribe") && !actsIn(m).includes("transcribe"), "no OCR, no typing of pages the size left unread");
});

test("R96 G14 a reading with passages left out (completeness partial, nothing more to come) is never drawn as full: it says what was left out; completeness whole is read in full; with total stated, once read in pieces, it says so", async () => {
  const cut = await open(at, { plane: { reading: textAnswer({ completeness: { state: "partial", why: "the first 4096 passages are searchable and citable; 117316 further passages are not", skipped: [{ units: 117316 }] } }) } });
  assert.equal(main(cut).querySelector("[data-text-state]").getAttribute("data-text-state"), "cut", "partial, not full");
  assert.ok(text(main(cut)).includes("117316 further passages"), "said");
  const whole = await open(at, { plane: { reading: textAnswer({ completeness: { state: "whole" } }) } });
  assert.equal(main(whole).querySelector("[data-text-state]").getAttribute("data-text-state"), "full");
  assert.ok(!main(whole).querySelector('[data-reading="more"]'), "a whole reading says nothing of being read");
  const pieces = await open(at, { plane: { reading: textAnswer({ completeness: { state: "whole" }, more: false, read_through: 12000060, total: 12000060 }) } });
  const done = hasWord(OWED.done) ? word(OWED.done) : word("screen.document.text.full");
  assert.ok(text(main(pieces).querySelector('[data-reading="more"]')).includes(done), "read in full, once the pieces are all read");
});

/* ------------------------------------------------------------------------------------------------------------------ G17 (lists say when they stop) */

const link = (i) => ({ address: "https://example.org/page-" + i, partition: "deferred", resolution: "offsite", verdict: null });
const range = (a, b) => Array.from({ length: b - a }, (_, i) => link(a + i));
const linksSec = (p) => main(p).querySelector('[data-tally="1"]').parentElement;

test("R67 G17 a page with 250 links draws the first 200 and says so; the more control reads the next page (after the cursor) and the rest follows; at the end nothing is said to be cut", async () => {
  const p = await open(at, { plane: { links: (r) => ok(r.query.after === "C200" ? { ok: true, links: range(200, 250), truncated: false, next: null } : { ok: true, links: range(0, 200), truncated: true, next: "C200" }) } });
  const cut = () => main(p).querySelector('[data-cut="links"]');
  assert.ok(cut() && text(cut()).includes(word("screen.people.more", { n: "200" })), "the first 200 are shown, said");
  assert.equal(main(p).querySelectorAll('a[href^="https://example.org/page-"], [data-link]').length >= 0, true);
  assert.equal(p.byOp("links").filter((r) => r.query.after !== undefined).length, 0, "the rest is not read until she asks");
  const box = (pg) => pg.doc.getElementById("document-links-more") && pg.doc.getElementById("document-links-more").querySelectorAll("label").find((l) => l.textContent.includes(word("shell.more"))).querySelector("input");
  const b = box(p); assert.ok(b, "a more control"); b.checked = true; p.fire(b, "change"); await p.settle();
  assert.deepEqual(p.byOp("links").filter((r) => r.query.after !== undefined).map((r) => r.query.after), ["C200"]);
  assert.ok(text(main(p)).includes("page-249"), "the 250th link is drawn");
  assert.ok(!cut() && !p.doc.getElementById("document-links-more"), "and nothing is said to be cut");
});

test("R68 G17 names, name matches and connections the plane cut are said to be cut; control: lists that are whole say nothing", async () => {
  const names = Array.from({ length: 3 }, (_, i) => ({ entity_id: "ENT-" + i, label: "Name " + i, kind: "organization", grade: "B", matched_by: "label", mentions: 1 }));
  const cutP = await open(at, { plane: { resolutions: ok({ ok: true, names, resolutions: [], truncated: true, names_truncated: true }), connections: ok({ ok: true, connections: [], truncated: true }) } });
  assert.ok(main(cutP).querySelector('[data-cut="names"]') && text(main(cutP).querySelector('[data-cut="names"]')).includes(word("screen.people.more", { n: "3" })));
  const whole = await open(at, { plane: { resolutions: ok({ ok: true, names, resolutions: [], truncated: false }), connections: ok({ ok: true, connections: [], truncated: false }) } });
  assert.ok(!main(whole).querySelector('[data-cut="names"]') && !main(whole).querySelector('[data-cut="connections"]'));
});

test("R56 G17 25 themes: 20 are drawn and the list says it is cut; the more control draws the rest", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await world.recipes.project(ann, "Stormwater");
  const { bundle } = await world.recipes.hold(ann, "Minutes", "The council met on Monday.", project);
  for (let i = 0; i < 25; i++) {
    const made = await ann.act("themedeclare", { body: { name: "Theme " + String(i).padStart(2, "0"), test: "the document concerns theme " + i } });
    assert.equal(made.ok, true, JSON.stringify(made));
    const placed = await ann.act("themeplace", { body: { theme: made.theme_id, target: bundle, note: "n" } });
    assert.equal(placed.ok, true, JSON.stringify(placed));
  }
  const p = await openRealDocument(world, ann, bundle);
  const placed = () => main(p).querySelectorAll("p[data-theme]").length;
  assert.equal(placed(), 20, "20 themes");
  assert.ok(main(p).querySelector('[data-cut="themes"]') && text(main(p).querySelector('[data-cut="themes"]')).includes(word("screen.people.more", { n: "20" })), "said");
  const b = p.doc.getElementById("document-themes-more").querySelectorAll("label").find((l) => l.textContent.includes(word("shell.more"))).querySelector("input");
  b.checked = true; p.fire(b, "change"); await p.settle();
  assert.equal(placed(), 25, "all 25 follow");
  assert.ok(!main(p).querySelector('[data-cut="themes"]'));
});

/* ------------------------------------------------------------------------------------------------------------------ G19 (supporting files) */

test("R3 G19 a web capture that skipped supporting files says how many were kept of all, with the reason by its code's sentence; control: none skipped says nothing (G110b: the plane's detail and the codes are not drawn)", async () => {
  const doc = (sup) => ({ [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: SHA, supporting: sup } }] }) } });
  const DETAIL = "fixture detail the plane gave";
  const p = await open(at, { images: doc({ kept: 400, skipped: 50, total: 450, reasons: [{ reason: "TOO_LARGE", count: 50, limit: 8388608, detail: DETAIL }] }) });
  const line = main(p).querySelector("[data-supporting]");
  assert.ok(line && text(line).includes(word("screen.capture.supporting.kept", { kept: "400", total: "450" })) && text(line).includes(word("screen.capture.supporting.toolarge", { n: "50" })));
  assert.ok(!text(line).includes(DETAIL), "the plane's own words (`detail`) are never drawn (G110b)");
  const nw = await open(at, { images: doc({ kept: 0, skipped: 0, total: 0, reasons: [], not_walked: "PRIMARY_TOO_LARGE" }) });
  assert.ok(main(nw).querySelector('[data-supporting-notwalked="toolarge"]'), "a page not walked at all says so, by the sentence of its kind");
  assert.ok(!text(main(nw).querySelector("[data-supporting]")).includes("PRIMARY_TOO_LARGE"), "and never draws the code");
  const none = await open(at, { images: doc({ kept: 12, skipped: 0, total: 12, reasons: [] }) });
  assert.ok(!main(none).querySelector("[data-supporting]"));
});

test("R96 DEC-432 a refusal measured in characters (a `_chars` metric) draws its size and limit as the design's one unit `characters`, never as bytes", async () => {
  const UNIT = "screen.document.reading.unit.characters";
  const fig = (n) => (hasWord(UNIT) ? word(UNIT, { n: n.toLocaleString("en-US") }) : n.toLocaleString("en-US"));
  for (const metric of ["text_chars", "chars"]) {
    const p = await openIn(at, { images: five, reading: stated({ reading: { content_type: "generic", reader_version: 1, found: false, basis: BASIS, failure: "final", reason: "TOO_LARGE", size: 3200000, bound: 2000000, metric, metadata: null } }) });
    const t = text(main(p));
    assert.ok(t.includes(fig(3200000)) && t.includes(fig(2000000)), `${metric}: the counts, in the characters unit`);
    assert.ok(!t.includes(mbOf(3200000)), `${metric}: not drawn as a byte size`);
  }
});
