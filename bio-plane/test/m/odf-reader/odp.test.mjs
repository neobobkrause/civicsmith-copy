/* odf-reader: the .odp entry's structure() and text()
 * (build/requirements/odf-reader.md R21–R27). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odpEntry } from "../../../src/odf.mjs";
import { sizeGuard } from "../../../src/ooxml.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import { slideShapeRef } from "../../../src/pptx.mjs";
import { buildZip, members, pkg, withCd, OVER_BOUND } from "./pkg.mjs";

/** @typedef {import("../../../src/odf.mjs").OdpStructure} OdpStructure */
/** @typedef {import("../../../src/odf.mjs").OdpText} OdpText */
/** @typedef {import("../../../src/odf.mjs").ActiveItem} ActiveItem */
/** @typedef {import("../../../src/odf.mjs").ImagesPart} ImagesPart */
/** @typedef {import("../../../src/odf.mjs").ProjectionFailure} ProjectionFailure */
/** @typedef {import("../../../src/odf.mjs").TextUndetermined} TextUndetermined */

/** @param {string} body @param {string} [styles] */
const odp = (body, styles = "") => pkg("odp", { body, styles });
/* Every test that calls S or T reads the answer's slides, links, text or items, so relies on the read succeeding:
   the helpers state that (assert.ok(x.ok)) before handing the answer back. */
/** @param {string} b @param {string} [st] */
const S = async (b, st) => { const s = await odpEntry.structure(odp(b, st)); assert.ok(s.ok); return s; };
/** @param {string} b @param {string} [st] */
const T = async (b, st) => { const t = await odpEntry.text(odp(b, st)); assert.ok(t.ok); return t; };
/** @param {OdpStructure} s @param {string} kind */
const items = (s, kind) => s.evidentiary.items.filter((i) => i.kind === kind);

/** @param {...string} ps */
const box = (...ps) => `<draw:frame><draw:text-box>${ps.map((p) => `<text:p>${p}</text:p>`).join("")}</draw:text-box></draw:frame>`;
/** @param {...string} ps */
const notes = (...ps) => `<presentation:notes><draw:page-thumbnail/>${box(...ps)}</presentation:notes>`;
/** @param {string} inner @param {string} [attrs] */
const page = (inner, attrs = "") => `<draw:page${attrs ? " " + attrs : ""}>${inner}</draw:page>`;
const STYLES = `<style:style style:name="dpHidden" style:family="drawing-page"><style:drawing-page-properties presentation:visibility="hidden"/></style:style>
  <style:style style:name="dpShown" style:family="drawing-page"><style:drawing-page-properties presentation:visibility="visible"/></style:style>`;

/* A deck exercising every shape rule: a frame's text box, a custom shape's
   own paragraphs, a group whose children carry the text, an image, links on
   text and on a whole shape, and notes carrying their own shapes and links. */
const DECK = [
  page(box("Title one") + `<draw:custom-shape><text:p>custom <text:a xlink:href="https://example.org/s1">link</text:a></text:p><draw:enhanced-geometry/></draw:custom-shape>`
    + notes("note for one", `<text:a xlink:href="https://notes.example">in notes</text:a>`)),
  page(`<draw:g>${box("in group A")}<draw:g>${box("in group B")}<draw:rect><text:p>rect text</text:p></draw:rect></draw:g></draw:g>`
    + `<draw:a xlink:href="#slide1"><draw:frame><draw:image xlink:href="Pictures/x.png"><text:p>caption</text:p></draw:image></draw:frame></draw:a>`, 'draw:style-name="dpHidden"'),
  page(notes(""), 'presentation:visibility="hidden"'),
  page(box("four") + notes("   ", "n4"), 'draw:style-name="dpHidden" presentation:visibility="visible"'),
  page("", 'draw:style-name="dpShown"'),
].join("");

/* ------------------------------------------------------------------ R21 */

test("R21 slides counts the <draw:page> elements, or is null when the body was not read", async () => {
  assert.equal((await S(DECK, STYLES)).slides, 5);
  assert.equal((await S("")).slides, 0);
  const overS = await odpEntry.structure(buildZip(withCd(members("odp", { body: DECK }), "content.xml", { usize: OVER_BOUND })));
  assert.ok(overS.ok);
  assert.equal(overS.slides, null);
  const noBodyS = await odpEntry.structure(pkg("odp", { content: "<office:document-content/>" }));
  assert.ok(noBodyS.ok);
  assert.equal(noBodyS.slides, null);
});

/* ------------------------------------------------------------------ R22 */

test("R22 speaker-notes per page with non-empty notes, hidden-slide per hidden page (element over style); notes never in slide text or links", async () => {
  const s = await S(DECK, STYLES);
  assert.deepEqual(items(s, "speaker-notes"), [
    { kind: "speaker-notes", slide: 1, part: "content.xml", text: "note for one\nin notes", source: slideShapeRef(1) },
    { kind: "speaker-notes", slide: 4, part: "content.xml", text: "   \nn4", source: slideShapeRef(4) },
  ]);
  assert.deepEqual(items(s, "hidden-slide"), [
    { kind: "hidden-slide", slide: 2, part: "content.xml", source: slideShapeRef(2) },
    { kind: "hidden-slide", slide: 3, part: "content.xml", source: slideShapeRef(3) },
  ]);
  assert.ok(s.links.every((l) => { const t = l.target; return ("url" in t ? t.url : undefined) !== "https://notes.example"; }));
  const t = await T(DECK, STYLES);
  assert.ok(t.slides.every((x) => !x.text.includes("note")));
});

/* ------------------------------------------------------------------ R23 */

test("R23 links: every href in a page's own shapes, once, at slideShapeRef(slide, shape) with shapes numbered as they open, nested included", async () => {
  const s = await S(DECK, STYLES);
  // page 1: frame=0, custom-shape=1. page 2: g=0, frame=1, g=2, frame=3, rect=4, frame=5 (wrapped by draw:a), image=6
  assert.deepEqual(s.links, [
    { partition: "deferred", wrapper: linkWrapper.deferred("https://example.org/s1"), target: { url: "https://example.org/s1" }, source: slideShapeRef(1, 1) },
    { partition: "anchor", wrapper: "#slide1", target: { fragment: "#slide1", name: "slide1" }, source: slideShapeRef(2, 5) },
  ]);
  assert.deepEqual(s.counts, { anchor: 1, intra: 0, deferred: 1, refused: 0, undetermined: 0 });
  // a text link inside nested groups is located once, to its own shape, never also to each group around it
  const nested = await S(page(`<draw:g><draw:frame/><draw:g><draw:custom-shape><text:p><text:a xlink:href="mailto:a@b.example">m</text:a></text:p></draw:custom-shape></draw:g></draw:g>`));
  assert.deepEqual(nested.links.map((l) => [l.partition, l.source]), [["refused", slideShapeRef(1, 3)]]);
  // a draw:a wrapping a group belongs to the group; one inside a shape wrapping nothing, to that shape; one wrapping nothing at page level, to the page
  const wraps = await S(page(`<draw:a xlink:href="#g"><draw:g><draw:rect/></draw:g></draw:a>`
    + `<draw:frame><draw:a xlink:href="#inside"></draw:a></draw:frame><draw:a xlink:href="#pageLevel"></draw:a>`));
  assert.deepEqual(wraps.links.map((l) => { const t = l.target; return ["fragment" in t ? t.fragment : undefined, l.source]; }), [
    ["#g", slideShapeRef(1, 0)], ["#inside", slideShapeRef(1, 2)], ["#pageLevel", slideShapeRef(1)],
  ]);
  // two pages: numbering restarts per slide
  const two = await S(page(box(`<text:a xlink:href="#a">a</text:a>`)) + page(box("x") + box(`<text:a xlink:href="#b">b</text:a>`)));
  assert.deepEqual(two.links.map((l) => l.source), [slideShapeRef(1, 0), slideShapeRef(2, 1)]);
});

/* ------------------------------------------------------------------ R24 */

test("R24 text() slides: one per page in byte order, shapes counted by the same walk, text the shapes' own, never a group's twice", async () => {
  const t = await T(DECK, STYLES);
  assert.deepEqual(t.slides, [
    { slide: 1, ref: "slide 1", part: "content.xml", hidden: false, shapes: 2, text: "Title one\ncustom link" },
    { slide: 2, ref: "slide 2", part: "content.xml", hidden: true, shapes: 7, text: "in group A\nin group B\nrect text\ncaption" },
    { slide: 3, ref: "slide 3", part: "content.xml", hidden: true, shapes: 0, text: "" },
    { slide: 4, ref: "slide 4", part: "content.xml", hidden: false, shapes: 1, text: "four" },
    { slide: 5, ref: "slide 5", part: "content.xml", hidden: false, shapes: 0, text: "" },
  ]);
});

/* ------------------------------------------------------------------ R25 */

test("R25 speakerNotes only for pages with notes text; document is the deck as presented; notesChars counted apart", async () => {
  const t = await T(DECK, STYLES);
  assert.deepEqual(t.speakerNotes, [
    { slide: 1, ref: "slide 1 (notes)", part: "content.xml", hidden: false, text: "note for one\nin notes" },
    { slide: 4, ref: "slide 4 (notes)", part: "content.xml", hidden: false, text: "   \nn4" },
  ]);
  assert.equal(t.document, "Title one\ncustom link\nin group A\nin group B\nrect text\ncaption\nfour");
  assert.ok(!t.document.includes("note"));
  assert.deepEqual({ ...t.counts, scanned_bytes: undefined }, { chars: t.document.length, notesChars: "note for one\nin notes".length + "   \nn4".length, undetermined: 0, scanned_bytes: undefined });
});

/* ------------------------------------------------------------------ R26 */

test("R26 deckLength equals the slide count once the body is read, and is null on both branches that did not read it", async () => {
  const t = await T(DECK, STYLES);
  assert.equal(t.deckLength, 5);
  assert.equal(t.deckLength, t.slides.length);
  assert.equal((await T("")).deckLength, 0);
  const overT = await odpEntry.text(buildZip(withCd(members("odp", { body: DECK }), "content.xml", { usize: OVER_BOUND })));
  assert.ok(overT.ok);
  assert.equal(overT.deckLength, null);
  const crcT = await odpEntry.text(buildZip(withCd(members("odp", { body: DECK }), "content.xml", { crc: 5 })));
  assert.ok(crcT.ok);
  assert.equal(crcT.deckLength, null);
});

/* ------------------------------------------------------------------ R27 */

test("R27 text() over the guard, or with no readable body: document null, lists empty, the guard marker or main_part_unreadable", async () => {
  const over = await odpEntry.text(buildZip(withCd(members("odp", { body: DECK }), "content.xml", { usize: OVER_BOUND })));
  /** @param {TextUndetermined[]} undetermined @param {ActiveItem[]} [active] */
  const want = (undetermined, active = []) => ({ ok: true, container: "odp", document: null, slides: [], speakerNotes: [], parts: null, deckLength: null,
    undetermined, counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: undefined }, active });
  /* each answer stripped is compared with want()'s ok: true, so relies on the read succeeding */
  /** @param {(OdpText & { active: ActiveItem[] } & ImagesPart) | ProjectionFailure} a */
  const strip = (a) => { assert.ok(a.ok); const { images, imagesWhy, ...r } = a; return { ...r, counts: { ...r.counts, scanned_bytes: undefined } }; };
  assert.deepEqual(strip(over), want([{ ...sizeGuard(OVER_BOUND), final: true }], [{ kind: "unread", part: "content.xml", why: "over_size_bound" }]));
  assert.deepEqual(strip(await odpEntry.text(buildZip(withCd(members("odp"), "content.xml", { crc: 5 })))),
    want([{ reason: "main_part_unreadable", part: "content.xml", why: "crc_mismatch" }], [{ kind: "unread", part: "content.xml", why: "crc_mismatch" }]));
  assert.deepEqual(strip(await odpEntry.text(pkg("odp", { content: "<office:document-content><office:body><office:text/></office:body></office:document-content>" }))),
    want([{ reason: "main_part_unreadable", part: "content.xml", why: "no_office_presentation_body" }]));
});
