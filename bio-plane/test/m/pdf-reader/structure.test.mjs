/* pdf-reader: requirement-named tests for the document shape and the link
 * graph (build/requirements/pdf-reader.md R1-R8), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { extractPdfStructure, PDF_LINK_TYPES } from "../../../src/pdfstructure.mjs";
import { linkWrapper, LINK_TYPES } from "../../../src/subresources.mjs";
import { build, doc, bytesOf, flate } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, LinkRecord, LinkSource, LinkPlace } from "../../../src/pdfstructure.mjs" */
/** @import { Objects, Page, StreamBody } from "./pdf.mjs" */

/** What a test gives `annotated` beside the annotations.
 *  @typedef {Object} AnnotatedOptions
 *  @property {Objects} [objs] objects added
 *  @property {string} [catalog] more catalog entries
 *  @property {number} [pages] the number of pages, absent is 1
 */
/** A link partition, the name of a member of the counts.
 *  @typedef {"anchor" | "intra" | "deferred" | "refused" | "undetermined"} Partition */

/** @param {Uint8Array} u8
 *  @returns {string} */
const sha = (u8) => createHash("sha256").update(u8).digest("hex");
/** @type {Partition[]} */
const PARTITIONS = ["anchor", "intra", "deferred", "refused", "undetermined"];

/** The reading of a PDF; a thrown failure when it is refused.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
const read = (r) => {
  if (!r.ok) throw new Error(`the PDF was refused: ${r.reason}`);
  return r;
};
/** Entry `i` of a list; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[]} xs
 *  @param {number} i
 *  @param {string} what
 *  @returns {T} */
const nth = (xs, i, what) => {
  const x = xs[i];
  if (x === undefined) throw new Error(`${what}[${i}] is missing`);
  return x;
};
/** A link's source; a thrown failure when it has none.
 *  @param {LinkRecord} l
 *  @returns {LinkSource | LinkPlace} */
const sourceOf = (l) => {
  const src = l.source;
  if (src === null) throw new Error("the link has no source");
  return src;
};
/** An undetermined link's `why`; undefined for a link of another partition, whose target has none.
 *  @param {LinkRecord} l
 *  @returns {string | undefined} */
const whyOf = (l) => (l.partition === "undetermined" ? l.target.why : undefined);
/** The file name an intra or undetermined link's target states; undefined for a link whose target has none.
 *  @param {LinkRecord} l
 *  @returns {string | null | undefined} */
const nameOf = (l) => (l.partition === "intra" || l.partition === "undetermined" ? l.target.name : undefined);
/** The destination an anchor or undetermined link's target states; undefined for a link whose target has none.
 *  @param {LinkRecord} l
 *  @returns {string | null | undefined} */
const destOf = (l) => (l.partition === "anchor" || l.partition === "undetermined" ? l.target.dest : undefined);

/** A one-page document whose page carries the given annotation dicts (objects 30+).
 *  @param {string[]} annots
 *  @param {AnnotatedOptions} [options]
 *  @returns {Uint8Array} */
function annotated(annots, { objs = {}, catalog = "", pages = 1 } = {}) {
  const refs = annots.map((_, i) => `${30 + i} 0 R`).join(" ");
  /** @type {Objects} */
  const all = { ...objs };
  annots.forEach((a, i) => { all[30 + i] = a; });
  /** @type {Page[]} */
  const ps = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0) ps.push({ content: "", extra: `/Annots [${refs}]` });
    else ps.push({ content: "" });
  }
  return doc(ps, { objs: all, catalog });
}
/** A Link annotation with `inner` (its action or destination) and `rect`.
 *  @param {string} inner
 *  @param {string} [rect]
 *  @returns {string} */
const link = (inner, rect = "/Rect [10 20 110 40]") => `<< /Type /Annot /Subtype /Link ${rect} ${inner} >>`;

test("R1: not bytes -> NOT_BYTES; no %PDF- signature in the first 1024 bytes -> NOT_A_PDF", async () => {
  /** @type {unknown[]} */
  const values = [undefined, null, "%PDF-1.7", [37, 80], new ArrayBuffer(8), Buffer.from("%PDF-1.7").buffer, 42];
  for (const v of values) {
    assert.deepEqual(await extractPdfStructure(v), { ok: false, container: "pdf", reason: "NOT_BYTES" });
  }
  assert.deepEqual(await extractPdfStructure(bytesOf("hello")), { ok: false, container: "pdf", reason: "NOT_A_PDF" });
  assert.deepEqual(await extractPdfStructure(new Uint8Array(0)), { ok: false, container: "pdf", reason: "NOT_A_PDF" });
  const late = build({}, { header: " ".repeat(1024) + "%PDF-1.7\n" });
  assert.deepEqual(await extractPdfStructure(late), { ok: false, container: "pdf", reason: "NOT_A_PDF" });
  const within = build({}, { header: " ".repeat(1000) + "%PDF-1.4\n" });
  const r = await extractPdfStructure(within);
  assert.equal(r.ok, true);
  assert.equal(read(r).version, "1.4");
});

test("R2: the ok shape — version, pages, links, counts, text, images at the top level, metadata, notes", async () => {
  const r = read(await extractPdfStructure(doc([{ content: "BT /F1 10 Tf (Hi) Tj ET" }, { content: "" }], { header: "%PDF-1.6\n" })));
  assert.deepEqual(Object.keys(r).sort(), ["active", "container", "counts", "images", "links", "metadata", "notes", "ok", "pageBoxes", "pages", "text", "version"]);
  assert.equal(r.ok, true);
  assert.equal(r.container, "pdf");
  assert.equal(r.version, "1.6");
  assert.equal(r.pages, 2);
  assert.ok(Array.isArray(r.links));
  assert.deepEqual(Object.keys(r.text).sort(), ["counts", "document", "pages", "producer", "undetermined"]);
  assert.deepEqual(r.images, []);
  assert.ok(Array.isArray(r.notes));
  // imagesWhy appears exactly when images is null
  const bad = read(await extractPdfStructure(doc([{ content: "/Missing Do" }])));
  assert.equal(bad.images, null);
  assert.equal(typeof bad.imagesWhy, "string");
});

test("R2: never throws, on any byte sequence (truncations, random bytes after a signature)", async () => {
  const good = doc([{ content: "BT /F1 10 Tf (Hello) Tj ET", extra: "/Annots [30 0 R]" }],
    { objs: { 30: link("/A << /S /URI /URI (https://example.org/) >>") } });
  for (let n = 0; n <= good.length; n += 7) {
    const r = await extractPdfStructure(good.subarray(0, n));
    assert.equal(typeof r.ok, "boolean");
  }
  let seed = 7;
  /** @returns {number} */
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
  for (let k = 0; k < 40; k++) {
    const junk = new Uint8Array(400).map(rnd);
    const u = new Uint8Array(9 + junk.length);
    u.set(bytesOf("%PDF-1.7\n")); u.set(junk, 9);
    const r = await extractPdfStructure(u);
    assert.equal(r.ok, true);
  }
});

test("R3: a URI link is deferred (http, https, bare relative) or refused (any other scheme), with subresources' wrappers", async () => {
  const uris = ["http://example.org/a", "https://example.org/b?x=1", "docs/page.html",
                "mailto:clerk@example.org", "javascript:alert(1)", "tel:+15550100", "file:///etc/passwd", "ftp://example.org/f"];
  const r = read(await extractPdfStructure(annotated(uris.map((u) => link(`/A << /S /URI /URI (${u}) >>`)))));
  assert.equal(r.links.length, uris.length);
  uris.forEach((u, i) => {
    const l = nth(r.links, i, "links");
    const deferred = i < 3;
    assert.deepEqual(l, {
      partition: deferred ? "deferred" : "refused",
      wrapper: deferred ? linkWrapper.deferred(u) : linkWrapper.refused(),
      target: { url: u },
      source: { page: 0, rect: [10, 20, 110, 40] },
      anchor: { text: null, why: "no_text_in_rect", tier: 1 },
    });
  });
});

test("R3: a URI action with no /URI string is undetermined uri_action_without_uri; a malformed /Rect is null", async () => {
  const r = read(await extractPdfStructure(annotated([
    link("/A << /S /URI >>"),
    link("/A << /S /URI /URI 5 >>", "/Rect [1 2 3]"),
    link("/A << /S /URI /URI (https://example.org/) >>", ""),
  ])));
  assert.deepEqual(r.links[0], { partition: "undetermined", wrapper: null, target: { why: "uri_action_without_uri" }, source: { page: 0, rect: [10, 20, 110, 40] }, anchor: { text: null, why: "no_text_in_rect", tier: 1 } });
  assert.deepEqual(r.links[1], { partition: "undetermined", wrapper: null, target: { why: "uri_action_without_uri" }, source: { page: 0, rect: null }, anchor: { text: null, why: "no_rect", tier: 1 } });
  assert.equal(sourceOf(nth(r.links, 2, "links")).rect, null);
});

test("R4: GoTo and /Dest resolve through an explicit array, /Root /Dests, and the /Names /Dests tree to an anchor", async () => {
  const objs = {
    40: "<< /Kids [41 0 R] >>",
    41: "<< /Names [(chapter) 42 0 R (other) [102 0 R /Fit]] >>",
    42: "<< /D [102 0 R /XYZ 0 0 0] >>",
    43: "<< /intro [100 0 R /Fit] >>",
  };
  const r = read(await extractPdfStructure(annotated([
    link("/A << /S /GoTo /D [102 0 R /Fit] >>"),
    link("/Dest [100 0 R /XYZ 0 800 0]"),
    link("/Dest /intro"),
    link("/A << /S /GoTo /D (chapter) >>"),
    link("/Dest (other)"),
    link("/A << /S /GoTo /D [1 /Fit] >>"),
  ], { objs, catalog: "/Dests 43 0 R /Names << /Dests 40 0 R >>", pages: 2 })));
  /** @type {[number, string | null][]} */
  const want = [[1, null], [0, null], [0, "intro"], [1, "chapter"], [1, "other"], [1, null]];
  r.links.forEach((l, i) => {
    const [page, dest] = nth(want, i, "want");
    const fragment = `#page=${page + 1}`;
    assert.deepEqual(l, { partition: "anchor", wrapper: linkWrapper.anchor(fragment),
      target: { page, fragment, dest }, source: { page: 0, rect: [10, 20, 110, 40] }, anchor: { text: null, why: "no_text_in_rect", tier: 1 } }, `link ${i}`);
  });
});

test("R4: an unresolved destination is undetermined, naming which step failed", async () => {
  const r = read(await extractPdfStructure(annotated([
    link("/A << /S /GoTo >>"),
    link("/Dest /nowhere"),
    link("/Dest [1 0 R /Fit]"),
    link("/Dest [7 /Fit]"),
    link("/Dest [/Fit 0]"),
    link("/Dest 12.5"),
  ], { catalog: "" })));
  const whys = r.links.map(whyOf);
  assert.deepEqual(whys, ["dest_absent", "named_dest_unresolved", "dest_page_not_in_tree",
    "dest_page_out_of_range", "dest_first_not_page", "dest_shape_unknown"]);
  assert.equal(destOf(nth(r.links, 1, "links")), "nowhere");
  for (const l of r.links) { assert.equal(l.partition, "undetermined"); assert.equal(l.wrapper, null); }
});

test("R5: an attached or embedded file with decodable bytes is intra, content-addressed", async () => {
  const body = "a,b\n1,2\n";
  /** @type {Objects} */
  const objs = {
    50: "<< /Type /Filespec /F (data.csv) /EF << /F 51 0 R >> >>",
    51: { dict: "/Type /EmbeddedFile /Filter /FlateDecode", data: flate(body) },
    52: "<< /Type /Filespec /UF (tree.txt) /EF << /F 53 0 R >> >>",
    53: { dict: "/Type /EmbeddedFile", data: "plain" },
    54: "<< /Names [(key-name) 52 0 R] >>",
  };
  const r = read(await extractPdfStructure(annotated(
    [`<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 10 10] /Contents (the data) /FS 50 0 R >>`,
     `<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 10 10] /FS 50 0 R >>`],
    { objs, catalog: "/Names << /EmbeddedFiles 54 0 R >>" })));
  const s1 = sha(bytesOf(body)), s2 = sha(bytesOf("plain"));
  assert.deepEqual(r.links[0], { partition: "intra", wrapper: linkWrapper.intra(s1),
    target: { sha256: s1, name: "the data", bytes: body.length }, source: { page: 0, rect: [0, 0, 10, 10] }, anchor: { text: null, why: "no_text_in_rect", tier: 1 } });
  assert.equal(nameOf(nth(r.links, 1, "links")), "data.csv");
  assert.deepEqual(r.links[2], { partition: "intra", wrapper: linkWrapper.intra(s2),
    target: { sha256: s2, name: "key-name", bytes: 5 }, source: null, anchor: { text: null, why: "no_rect", tier: 1 } });
});

test("R5: an embedded file that cannot be resolved is undetermined, naming the step and the file", async () => {
  /** @type {Objects} */
  const objs = {
    50: "<< /Type /Filespec /F (nobytes.pdf) >>",
    51: "<< /Type /Filespec /F (opaque.jpg) /EF << /F 52 0 R >> >>",
    52: { dict: "/Filter /DCTDecode", data: "\xff\xd8" },
  };
  const r = read(await extractPdfStructure(annotated([
    `<< /Subtype /FileAttachment /Rect [0 0 1 1] /FS 99 0 R >>`,
    `<< /Subtype /FileAttachment /Rect [0 0 1 1] /FS 50 0 R >>`,
    `<< /Subtype /FileAttachment /Rect [0 0 1 1] /FS 51 0 R >>`,
  ], { objs })));
  assert.deepEqual(r.links.map((l) => [l.partition, whyOf(l), nameOf(l)]), [
    ["undetermined", "embedded_filespec_unresolved", null],
    ["undetermined", "embedded_stream_absent", "nobytes.pdf"],
    ["undetermined", "embedded_stream_undecodable", "opaque.jpg"],
  ]);
});

test("R6: GoToR, Launch and other actions, or a Link with neither action nor /Dest, are undetermined by name", async () => {
  const r = read(await extractPdfStructure(annotated([
    link("/A << /S /GoToR /F (other.pdf) /D [0 /Fit] >>"),
    link("/A << /S /Launch /F (run.exe) >>"),
    link("/A << /S /JavaScript /JS (x) >>"),
    link(""),
    link("/A << /Type /Action >>"),
  ])));
  assert.deepEqual(r.links.map(whyOf), ["unsupported_action_GoToR", "unsupported_action_Launch",
    "unsupported_action_JavaScript", "link_without_action_or_dest", "link_without_action_or_dest"]);
  for (const l of r.links) assert.equal(l.partition, "undetermined");
});

test("R7: counts carries all five partitions, each the number of links of that partition", async () => {
  const empty = read(await extractPdfStructure(doc([{ content: "" }])));
  assert.deepEqual(empty.counts, { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 });
  const r = read(await extractPdfStructure(annotated([
    link("/A << /S /URI /URI (https://a.example/) >>"), link("/A << /S /URI /URI (https://b.example/) >>"),
    link("/A << /S /URI /URI (mailto:x@example.org) >>"), link("/Dest [100 0 R /Fit]"), link(""),
  ])));
  assert.deepEqual(r.counts, { anchor: 1, intra: 0, deferred: 2, refused: 1, undetermined: 1 });
  assert.deepEqual(PDF_LINK_TYPES, [...LINK_TYPES, "undetermined"]);
  for (const k of PARTITIONS) assert.equal(r.counts[k], r.links.filter((l) => l.partition === k).length);
});

test("R8: a later definition of an object wins; object streams fold in without overwriting a top-level object", async () => {
  // Object 100 (the page) is defined twice; the later one carries the text.
  const early = "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 10 0 R >> >> /Contents 101 0 R >>";
  const late = "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 10 0 R >> >> /Contents 102 0 R >>";
  const inner1 = "<< /Type /Font /Subtype /TrueType /BaseFont /FromObjStm >>";
  const inner2 = "<< /Type /Font /Subtype /TrueType /BaseFont /Compressed /ToUnicode 11 0 R >>";
  const header = `60 0 61 ${inner1.length + 1} `;
  /** @type {StreamBody} */
  const objstm = { dict: `/Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode`, data: flate(header + inner1 + " " + inner2) };
  const bytes = build({
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>",
    10: "<< /Type /Font /Subtype /TrueType /BaseFont /TopLevel /ToUnicode 11 0 R >>",
    11: { data: "1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange" },
    60: "<< /Type /Font /Subtype /TrueType /BaseFont /TopLevel60 >>",
    70: objstm,
    100: early,
    101: { data: "BT /F1 10 Tf (early) Tj ET" },
    102: { data: "BT /F1 10 Tf (late) Tj /F9 10 Tf (x) Tj ET" },
  }, { tail: `100 0 obj\n${late}\nendobj\n` });
  const r = read(await extractPdfStructure(bytes));
  assert.equal(r.text.document, "late");
  // object 61 exists only in the object stream and resolves; 60 keeps its top-level definition
  const r2 = read(await extractPdfStructure(doc([{ content: "BT /A 10 Tf (ok) Tj /B 10 Tf (no) Tj ET", resources: "/Font << /A 61 0 R /B 60 0 R >>" }],
    { objs: { 60: "<< /Type /Font /Subtype /TrueType /BaseFont /TopLevel60 >>", 70: objstm } })));
  assert.equal(r2.text.document, "ok");
  assert.deepEqual(r2.text.undetermined.map((m) => [m.reason, m.font]), [["no_tounicode", "TopLevel60"]]);
});

test("R8: pages follow /Root /Pages /Kids; with no walkable tree, every /Type /Page by object number, noted", async () => {
  const kidsOrder = build({
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    2: "<< /Type /Pages /Kids [3 0 R 9 0 R] >>",
    3: "<< /Type /Pages /Kids [20 0 R 8 0 R] >>",
    8: "<< /Type /Page /Contents 18 0 R /Resources << /Font << /F1 10 0 R >> >> >>",
    9: "<< /Type /Page /Contents 19 0 R /Resources << /Font << /F1 10 0 R >> >> >>",
    20: "<< /Type /Page /Contents 30 0 R /Resources << /Font << /F1 10 0 R >> >> >>",
    10: "<< /Type /Font /Subtype /TrueType /ToUnicode 11 0 R >>",
    11: { data: "1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange" },
    18: { data: "BT /F1 1 Tf (B) Tj ET" }, 19: { data: "BT /F1 1 Tf (C) Tj ET" }, 30: { data: "BT /F1 1 Tf (A) Tj ET" },
  });
  const r = read(await extractPdfStructure(kidsOrder));
  assert.deepEqual(r.text.pages.map((p) => p.text), ["A", "B", "C"]);
  assert.ok(!r.notes.includes("page_order_by_object_number_fallback"));
  const noRoot = build({
    8: "<< /Type /Page /Contents 18 0 R /Resources << /Font << /F1 10 0 R >> >> >>",
    5: "<< /Type /Page /Contents 19 0 R /Resources << /Font << /F1 10 0 R >> >> >>",
    10: "<< /Type /Font /Subtype /TrueType /ToUnicode 11 0 R >>",
    11: { data: "1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange" },
    18: { data: "BT /F1 1 Tf (eight) Tj ET" }, 19: { data: "BT /F1 1 Tf (five) Tj ET" },
  }, { order: [8, 5, 10, 11, 18, 19], trailer: "" });
  const f = read(await extractPdfStructure(noRoot));
  assert.equal(f.pages, 2);
  assert.deepEqual(f.text.pages.map((p) => p.text), ["five", "eight"]);
  assert.ok(f.notes.includes("page_order_by_object_number_fallback"));
});
