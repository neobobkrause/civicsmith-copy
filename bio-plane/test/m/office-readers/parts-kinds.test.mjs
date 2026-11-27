/* office-readers, R38, R39 (fix round 9, G134a, G134d): every part of a document is a unit with its kind; a picture
 * that is the only content of a place is listed and stated unread. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
/** @import { ReadFailure, DocParaRef } from "../../../src/docx.mjs" */
/** @import { PptxUndetermined } from "../../../src/pptx.mjs" */
/** @import { AddressedUnit, ElementRef } from "../../../src/office-xml.mjs" */
/** @import { ZipMember } from "./fixtures.mjs" */

/* A text() that read, and its answer. */
/**
 * @template {{ok: true}} T
 * @param {T | ReadFailure} r
 * @returns {T}
 */
function read(r) { if (!r.ok) assert.fail(`text() refused: ${r.reason}`); return r; }
/* The units an answer carries. */
/**
 * @template {ElementRef} A
 * @param {{parts?: AddressedUnit<A>[]}} t
 * @returns {AddressedUnit<A>[]}
 */
function partsOf(t) { const parts = t.parts; if (parts === undefined) assert.fail("the answer carries its parts"); return parts; }
/* An answer's document, read. */
/** @type {(t: {document: string | null}) => string} */
const documentOf = (t) => { const document = t.document; if (document === null) assert.fail("the answer has a document"); return document; };
/* The item at `i`, there. */
/**
 * @template T
 * @param {readonly T[]} list
 * @param {number} i
 * @returns {T}
 */
function nth(list, i) { const item = list[i]; if (item === undefined) assert.fail(`no item ${i}`); return item; }
/* A unit's anchor, there. */
/**
 * @template {ElementRef} A
 * @param {AddressedUnit<A>} u
 * @returns {A}
 */
function anchorOf(u) { const anchor = u.anchor; if (anchor === undefined) assert.fail(`${u.kind}: no anchor`); return anchor; }
/* A statement's `ref`, where it states one. */
/** @type {(u: object) => unknown} */
const statedRef = (u) => ("ref" in u ? u.ref : undefined);
/* The `slide` a statement's `ref` names, where it names one. */
/** @type {(u: PptxUndetermined) => unknown} */
const slideOf = (u) => { if (!("ref" in u)) return undefined; const ref = u.ref; return ref !== null && "slide" in ref ? ref.slide : undefined; };

const KINDS = ["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];
const RT_W = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/**
 * @template {ElementRef} A
 * @param {AddressedUnit<A>[]} parts
 * @param {string} kind
 * @returns {AddressedUnit<A>[]}
 */
const byKind = (parts, kind) => parts.filter((p) => p.kind === kind);

function wordPackage() {
  const body = F.wp(F.wr("Body line one"), `<w:r><w:footnoteReference w:id="2"/></w:r>`)
    + F.wp(F.wr("Before "), `<w:del w:id="9" w:author="A" w:date="2024-01-01T00:00:00Z"><w:r><w:delText>struck wording</w:delText></w:r></w:del>`, F.wr("after"))
    + F.wp(`<w:r><w:endnoteReference w:id="3"/></w:r>`)
    + F.wp(`<w:r><w:txbxContent>${F.wp(F.wr("Inside the box"))}</w:txbxContent></w:r>`)
    + F.wp(`<w:r><w:commentReference w:id="0"/></w:r>`, F.wr("Commented"))
    + `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/></w:sectPr>`;
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  return F.docx({
    body,
    rels: F.rels([
      { id: "rIdH", type: `${RT_W}/header`, target: "header1.xml" },
      { id: "rIdF", type: `${RT_W}/footer`, target: "footer1.xml" },
      { id: "rIdFn", type: `${RT_W}/footnotes`, target: "footnotes.xml" },
      { id: "rIdEn", type: `${RT_W}/endnotes`, target: "endnotes.xml" },
    ]),
    comments: `<w:comments ${W}><w:comment w:id="0" w:author="Pat" w:initials="P"><w:p><w:r><w:t>Margin remark $4,200</w:t></w:r></w:p></w:comment></w:comments>`,
    extra: [
      { name: "word/header1.xml", data: `<w:hdr ${W}><w:p><w:r><w:t>Running head</w:t></w:r></w:p></w:hdr>` },
      { name: "word/footer1.xml", data: `<w:ftr ${W}><w:p><w:r><w:t>Page foot</w:t></w:r></w:p></w:ftr>` },
      { name: "word/footnotes.xml", data: `<w:footnotes ${W}><w:footnote w:type="separator" w:id="0"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="2"><w:p><w:r><w:t>Footnote costs $1,234,567</w:t></w:r></w:p></w:footnote></w:footnotes>` },
      { name: "word/endnotes.xml", data: `<w:endnotes ${W}><w:endnote w:id="3"><w:p><w:r><w:t>An endnote</w:t></w:r></w:p></w:endnote></w:endnotes>` },
    ],
  });
}

test("R38 docx: footnotes, endnotes, headers, footers, comments, tracked deletions and text boxes are units, each with its kind, ref and part; document stays the body", async () => {
  const t = await docxEntry.text(wordPackage());
  assert.equal(t.ok, true);
  for (const p of partsOf(t)) assert.ok(KINDS.includes(p.kind), p.kind);
  /** @type {(k: string) => AddressedUnit<DocParaRef>} */
  const one = (k) => { const l = byKind(partsOf(t), k); assert.equal(l.length, 1, `${k}: one unit`); return nth(l, 0); };
  assert.equal(one("footnote").text, "Footnote costs $1,234,567");
  assert.equal(one("footnote").part, "word/footnotes.xml");
  assert.equal(one("footnote").ref, "footnote 2");
  assert.deepEqual(one("footnote").anchor, { kind: "doc-para", ref: "¶1", para: 0, run: 1 });
  assert.equal(one("endnote").text, "An endnote");
  assert.equal(one("endnote").part, "word/endnotes.xml");
  assert.equal(one("header").text, "Running head");
  assert.equal(one("footer").text, "Page foot");
  assert.equal(one("comment").text, "Margin remark $4,200");
  assert.equal(one("comment").part, "word/comments.xml");
  assert.equal(one("tracked_deletion").text, "struck wording");
  assert.equal(one("text_box").text, "Inside the box");
  /* the lists R11 describes are unchanged: the body's text, no deleted wording, no part text */
  assert.ok(documentOf(t).includes("Body line one") && documentOf(t).includes("Before after"));
  assert.ok(!documentOf(t).includes("struck wording") && !documentOf(t).includes("Footnote costs") && !documentOf(t).includes("Running head"));
  /* the same on a second call and from parts() */
  const again = await docxEntry.text(await docxEntry.parts(wordPackage()));
  assert.deepEqual(read(again).parts, t.parts);
});

test("R38 docx (G166): a text_box part names the paragraphs it holds in paras, their indices in paragraphs; other kinds carry none; a paragraph outside a box is not named", async () => {
  const body = F.wp(F.wr("Outside line"))
    + F.wp(`<w:r><w:txbxContent>${F.wp(F.wr("Box first"))}${F.wp(F.wr("Box second"))}</w:txbxContent></w:r>`)
    + F.wp(F.wr("After the box"));
  const t = await docxEntry.text(F.docx({ body }));
  assert.equal(t.ok, true);
  /** @type {(text: string) => number} */
  const idx = (text) => t.paragraphs.findIndex((p) => p.text === text);
  const [box, ...rest] = byKind(partsOf(t), "text_box");
  assert.equal(rest.length, 0, "one text_box piece");
  if (box === undefined) assert.fail("a text_box piece");
  assert.equal(box.text, "Box first\nBox second");
  const paras = box.paras;
  assert.deepEqual(paras, [idx("Box first"), idx("Box second")]);
  assert.ok(paras.every((n) => nth(t.paragraphs, n).para === n), "indices in paragraphs are the para numbers");
  assert.ok(!paras.includes(idx("Outside line")) && !paras.includes(idx("After the box")));
  /* the paragraphs keep their numbers and stay in paragraphs and document (R11) */
  assert.ok(documentOf(t).includes("Box first") && documentOf(t).includes("Box second"));
  /* control: a part of another kind has no paras */
  const w = read(await docxEntry.text(wordPackage()));
  for (const p of partsOf(w).filter((x) => x.kind !== "text_box")) assert.equal("paras" in p, false, p.kind);
  assert.deepEqual(nth(byKind(partsOf(w), "text_box"), 0).paras, [w.paragraphs.findIndex((p) => p.text === "Inside the box")]);
});

test("R38 docx: a package with no part outside the body has parts: []; a part the reader cannot read is stated, never a reading that says it is whole", async () => {
  const plain = await docxEntry.text(F.docx());
  assert.deepEqual(read(plain).parts, []);
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const t = await docxEntry.text(F.docx({ extra: [{ name: "word/diagrams/data1.xml", data: "<dgm/>" }, { name: "word/footnotes.xml", data: `<w:footnotes ${W}/>` }] }));
  assert.ok(read(t).undetermined.some((u) => u.part === "word/diagrams/data1.xml" && u.why === "part_unread"));
});

/**
 * @param {{members?: ZipMember[]}} [extra]
 * @returns {Uint8Array}
 */
function deckWith(extra = {}) {
  return F.pptx({
    slides: [
      { file: "slide1.xml", texts: ["Public slide"], notes: "Speaker says $9,876,543" },
      { file: "slide2.xml", texts: ["Secret hidden slide"], show: "0" },
      { file: "slide3.xml", xml: `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Box"/><p:cNvSpPr txBox="1"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Text box words</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>` },
    ],
    extra: [
      { name: "ppt/slideMasters/slideMaster1.xml", data: F.slideXml(["Master title style"]) },
      { name: "ppt/slideLayouts/slideLayout1.xml", data: F.slideXml(["Layout body text"]) },
      ...(extra.members ?? []),
    ],
  });
}

test("R38 pptx: speaker notes, master and layout text, text boxes and a hidden slide's text are units with their kind; hidden is marked", async () => {
  const t = await pptxEntry.text(deckWith());
  assert.equal(t.ok, true);
  for (const p of partsOf(t)) assert.ok(KINDS.includes(p.kind), p.kind);
  const note = byKind(partsOf(t), "speaker_note");
  assert.equal(note.length, 1);
  assert.equal(nth(note, 0).text, "Speaker says $9,876,543");
  assert.equal(nth(note, 0).ref, "slide 1");
  assert.deepEqual(nth(note, 0).anchor, { kind: "slide-shape", ref: "slide 1", slide: 1 });
  assert.deepEqual(byKind(partsOf(t), "master_text").map((p) => p.text).sort(), ["Layout body text", "Master title style"]);
  const box = byKind(partsOf(t), "text_box");
  assert.equal(box.length, 1);
  assert.equal(nth(box, 0).text, "Text box words");
  assert.equal(anchorOf(nth(box, 0)).slide, 3);
  /* cause 16: the hidden slide's text is held once, as its slide unit marked hidden, not also as a second body piece */
  assert.deepEqual(t.slides.filter((s) => s.hidden).map((s) => s.text), ["Secret hidden slide"]);
  assert.ok(!partsOf(t).some((p) => p.text === "Secret hidden slide"));
  assert.ok(documentOf(t).includes("Secret hidden slide"), "R23: a hidden slide is still in the document");
  assert.ok(!documentOf(t).includes("Speaker says") && !documentOf(t).includes("Master title"), "document stays the slides' text");
});

test("R38 pptx (K4987): a text box's words are the text_box part's; the slide names them (bodyText leaves them out, the box part names its shapes); a slide with no box has neither", async () => {
  /** @type {(id: number, box: boolean, words: string) => string} */
  const sp = (id, box, words) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="S${id}"/><p:cNvSpPr${box ? ' txBox="1"' : ""}/></p:nvSpPr><p:txBody><a:p><a:r><a:t>${words}</a:t></a:r></a:p></p:txBody></p:sp>`;
  /** @type {(...shapes: string[]) => string} */
  const sld = (...shapes) => `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${shapes.join("")}</p:spTree></p:cSld></p:sld>`;
  const t = await pptxEntry.text(F.pptx({ slides: [
    { file: "slide1.xml", xml: sld(sp(2, false, "Plain words"), sp(3, true, "Boxed words")) },
    { file: "slide2.xml", xml: sld(sp(2, true, "Only box")) },
    { file: "slide3.xml", xml: sld(sp(2, false, "No box here")) },
  ] }));
  assert.equal(t.ok, true);
  const [s1, s2, s3] = t.slides;
  if (s1 === undefined || s2 === undefined || s3 === undefined) assert.fail("the deck has its three slides");
  /* R11 stays: the slide's text and the document hold every word */
  assert.equal(s1.text, "Plain words\nBoxed words");
  assert.ok(documentOf(t).includes("Boxed words"));
  assert.equal(s1.bodyText, "Plain words");
  assert.equal(s2.bodyText, "");
  assert.equal("bodyText" in s3, false);
  const boxes = byKind(partsOf(t), "text_box");
  assert.deepEqual(boxes.map((b) => b.text), ["Boxed words", "Only box"]);
  assert.deepEqual(nth(boxes, 0).shapes, [anchorOf(nth(boxes, 0)).shape]);
  assert.equal(anchorOf(nth(boxes, 0)).shape, 1);
  for (const p of partsOf(t).filter((x) => x.kind !== "text_box")) assert.equal("shapes" in p, false, p.kind);
});

test("R38 xlsx: a cell comment is a cell_note unit citing its cell; a part that can hold other text is stated unread", async () => {
  const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const bytes = F.xlsx({
    sheets: [{ name: "Sheet1", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "x" }] }] }, rels: [{ id: "rIdC", type: `${RT_W}/comments`, target: "../comments1.xml" }] }],
    extra: [
      { name: "xl/comments1.xml", data: `<comments ${S}><authors><author>Pat</author></authors><commentList><comment ref="B2" authorId="0"><text><r><t>Check the $5,000 total</t></r></text></comment></commentList></comments>` },
      { name: "xl/drawings/drawing1.xml", data: "<d/>" },
    ],
  });
  const t = await xlsxEntry.text(bytes);
  assert.equal(t.ok, true);
  assert.equal(partsOf(t).length, 1);
  assert.equal(nth(partsOf(t), 0).kind, "cell_note");
  assert.equal(nth(partsOf(t), 0).text, "Check the $5,000 total");
  assert.equal(nth(partsOf(t), 0).part, "xl/comments1.xml");
  assert.equal(nth(partsOf(t), 0).ref, "Sheet1!B2");
  assert.deepEqual(nth(partsOf(t), 0).anchor, { kind: "sheet-cell", ref: "Sheet1!B2", sheet: "Sheet1", cell: "B2" });
  assert.ok(t.undetermined.some((u) => "part" in u && u.part === "xl/drawings/drawing1.xml" && "why" in u && u.why === "part_unread"));
  assert.ok(!documentOf(t).includes("Check the"), "document stays the sheets' text");
});

test("R39 a docx paragraph or a pptx slide whose only content is a picture lists the picture and states it unread with its ref", async () => {
  const body = F.wp(F.wr("Words")) + F.wp(`<w:r><w:drawing><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="p"><pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></w:drawing></w:r>`);
  const d = await docxEntry.text(F.docx({
    body,
    rels: F.rels([{ id: "rIdImg", type: F.RT.image, target: "media/pic.png" }]),
    extra: [{ name: "word/media/pic.png", data: "PNGDATA" }],
  }));
  assert.equal(d.ok, true);
  assert.ok(d.images && d.images.length === 1, "the picture is listed");
  const marker = d.undetermined.find((u) => u.why === "image_unread");
  assert.ok(marker);
  assert.deepEqual(statedRef(marker), { kind: "doc-para", ref: "¶2", para: 1 });
  const p = await pptxEntry.text(F.pptx({
    slides: [{ file: "slide1.xml", xml: `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>` }],
    extra: [{ name: "ppt/media/p.png", data: "PNG" }],
  }));
  assert.equal(p.ok, true);
  assert.ok(p.images.length === 1);
  const pm = p.undetermined.find((u) => u.why === "image_unread");
  assert.ok(pm);
  assert.equal(slideOf(pm), 1);
  /* control: a slide with words and a picture states nothing */
  const ok = await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", texts: ["Words"] }] }));
  assert.ok(!read(ok).undetermined.some((u) => u.why === "image_unread"));
});

/**
 * @template {ElementRef} A
 * @param {AddressedUnit<A>[]} parts
 */
const addressed = (parts) => {
  /** @type {Set<string>} */
  const seen = new Set();
  for (const p of parts) {
    assert.equal(typeof p.ref, "string", `${p.kind}: ref is a string`);
    assert.ok(p.ref.length > 0, `${p.kind}: ref is not empty`);
    const key = `${p.part}\u0000${p.ref}`;
    assert.ok(!seen.has(key), `no two pieces share (part, ref): ${p.part} ${p.ref}`);
    seen.add(key);
  }
};

test("R38 (K4924) docx: every part's ref is a string that addresses it alone within its part; two comments in one paragraph and two footnotes do not share an address", async () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const body = F.wp(F.wr("Words"), `<w:r><w:commentReference w:id="0"/></w:r>`, `<w:r><w:commentReference w:id="1"/></w:r>`, `<w:r><w:footnoteReference w:id="2"/></w:r>`, `<w:r><w:footnoteReference w:id="3"/></w:r>`)
    + F.wp(F.wr("Keep "), `<w:del w:id="9" w:author="A" w:date="2024-01-01T00:00:00Z"><w:r><w:delText>one</w:delText></w:r></w:del>`, `<w:del w:id="10" w:author="A" w:date="2024-01-01T00:00:00Z"><w:r><w:delText>two</w:delText></w:r></w:del>`)
    + F.wp(`<w:r><w:txbxContent>${F.wp(F.wr("Box A"))}</w:txbxContent></w:r><w:r><w:txbxContent>${F.wp(F.wr("Box B"))}</w:txbxContent></w:r>`);
  const t = await docxEntry.text(F.docx({
    body,
    rels: F.rels([{ id: "rIdFn", type: `${RT_W}/footnotes`, target: "footnotes.xml" }]),
    comments: `<w:comments ${W}><w:comment w:id="0" w:author="P"><w:p><w:r><w:t>First remark</w:t></w:r></w:p></w:comment><w:comment w:id="1" w:author="P"><w:p><w:r><w:t>Second remark</w:t></w:r></w:p></w:comment></w:comments>`,
    extra: [{ name: "word/footnotes.xml", data: `<w:footnotes ${W}><w:footnote w:id="2"><w:p><w:r><w:t>Note two</w:t></w:r></w:p></w:footnote><w:footnote w:id="3"><w:p><w:r><w:t>Note three</w:t></w:r></w:p></w:footnote></w:footnotes>` }],
  }));
  assert.equal(t.ok, true);
  addressed(partsOf(t));
  /** @type {(kind: string) => string[]} */
  const refOf = (kind) => byKind(partsOf(t), kind).map((p) => p.ref);
  assert.deepEqual(refOf("comment"), ["comment 0", "comment 1"]);
  assert.deepEqual(refOf("footnote"), ["footnote 2", "footnote 3"]);
  assert.equal(byKind(partsOf(t), "tracked_deletion").length, 2);
  assert.equal(byKind(partsOf(t), "text_box").length, 2);
  for (const p of byKind(partsOf(t), "comment")) assert.equal(anchorOf(p).kind, "doc-para");
  /* the same on a second call */
  assert.deepEqual(partsOf(read(await docxEntry.text(F.docx({ body, rels: F.rels([]) })))).map((p) => p.ref), partsOf(read(await docxEntry.text(F.docx({ body, rels: F.rels([]) })))).map((p) => p.ref));
  /* a header or footer is addressed by its part */
  const w = read(await docxEntry.text(wordPackage()));
  addressed(partsOf(w));
  assert.equal(nth(byKind(partsOf(w), "header"), 0).ref, "word/header1.xml");
  assert.equal(nth(byKind(partsOf(w), "footer"), 0).ref, "word/footer1.xml");
});

test("R38 (K4924) pptx and xlsx: every part's ref is a string unique within its part", async () => {
  const t = read(await pptxEntry.text(deckWith()));
  addressed(partsOf(t));
  assert.ok(byKind(partsOf(t), "master_text").every((p) => p.ref === p.part), "a master or layout, addressed by its part");
  const twoBoxes = `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/><p:cNvSpPr txBox="1"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Box one</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="B"/><p:cNvSpPr txBox="1"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Box two</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  const two = read(await pptxEntry.text(F.pptx({ slides: [{ file: "slide1.xml", xml: twoBoxes, notes: "A note" }] })));
  addressed(partsOf(two));
  assert.equal(byKind(partsOf(two), "text_box").length, 2);
  assert.equal(nth(byKind(partsOf(two), "speaker_note"), 0).ref, "slide 1");
  const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const x = read(await xlsxEntry.text(F.xlsx({
    sheets: [{ name: "Sheet1", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "x" }] }] }, rels: [{ id: "rIdC", type: `${RT_W}/comments`, target: "../comments1.xml" }] }],
    extra: [{ name: "xl/comments1.xml", data: `<comments ${S}><authors><author>P</author></authors><commentList><comment ref="B2" authorId="0"><text><r><t>One</t></r></text></comment><comment ref="B2" authorId="0"><text><r><t>Two</t></r></text></comment><comment ref="C3" authorId="0"><text><r><t>Three</t></r></text></comment></commentList></comments>` }],
  })));
  addressed(partsOf(x));
  assert.equal(partsOf(x).length, 3);
  assert.equal(nth(partsOf(x), 2).ref, "Sheet1!C3");
});
