/* pdf-reader: requirement-named tests for the bounds on what a file makes the reader hold (build/requirements/pdf-reader.md
 * R22, R41, R47, R48, fix round 9: G125a, G125e, G124d, G132l (a)), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { extractPdfStructure, extractPdfRange, openPdf } from "../../../src/pdfstructure.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { build, doc, FONT_OBJS, FONTS, flate } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfRefusal, PdfRange, PdfDoc, PdfValue, Marker } from "../../../src/pdfstructure.mjs" */
/** @import { Objects, StreamBody, Page } from "./pdf.mjs" */

/** `x`; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} x
 *  @param {string} what
 *  @returns {T} */
const must = (x, what) => { if (x === undefined || x === null) throw new Error(`${what}: none`); return x; };
/** The reading of a whole file; a thrown failure naming the refusal when it is refused.
 *  @param {PdfStructureAnswer} a
 *  @returns {PdfStructure} */
const reading = (a) => { if (!a.ok) throw new Error(`expected a reading, got ${a.reason}`); return a; };
/** A range's reading; a thrown failure naming the refusal when it is refused.
 *  @param {PdfRefusal | PdfRange} a
 *  @returns {PdfRange} */
const rangeOf = (a) => { if (!a.ok) throw new Error(`expected a range, got ${a.reason}`); return a; };
/** A document opened; a thrown failure when it is not a PDF.
 *  @param {Uint8Array} bytes
 *  @returns {Promise<PdfDoc>} */
const opened = async (bytes) => must(await openPdf(bytes), "openPdf");
/** `base` with `changes` laid over it, as a new table (the object numbers in the order JavaScript gives integer keys).
 *  @param {Objects} base
 *  @param {Objects} changes
 *  @returns {Objects} */
const over = (base, changes) => {
  /** @type {Objects} */
  const all = {};
  for (const [k, v] of Object.entries(base)) all[k] = v;
  for (const [k, v] of Object.entries(changes)) all[k] = v;
  return all;
};
/** The array a value is; a thrown failure naming `what` when it is not one.
 *  @param {PdfValue} v
 *  @param {string} what
 *  @returns {PdfValue[]} */
const itemsOf = (v, what) => { if (v === null || typeof v !== "object" || v.t !== "arr") throw new Error(`${what}: not an array`); return v.items; };

/** A text-showing content stream.
 *  @param {string} s
 *  @returns {string} */
const T = (s) => `BT /F1 12 Tf 40 700 Td (${s}) Tj ET`;
/** `mb` MiB of one byte, Flate-compressed at level 9.
 *  @param {number} mb
 *  @param {number} [fill]
 *  @returns {Uint8Array} */
const bomb = (mb, fill = 0x20) => new Uint8Array(deflateSync(Buffer.alloc(mb * 1048576, fill), { level: 9 }));
const PAGE_CONTENT = boundOf("pdf", "page_content");

test("R41, R22: a page whose decoded content passes the page bound is stated with its figures and the other pages are read (a 200 KB stream that inflates to 200 MB as page 3 of 10)", async () => {
  const pages = Array.from({ length: 10 }, /** @param {unknown} _ @param {number} i @returns {Page} */ (_, i) => ({ content: i === 2 ? { dict: "/Filter /FlateDecode", data: bomb(200) } : T(`P${i + 1}`) }));
  const bytes = doc(pages);
  assert.ok(bytes.length < 400 * 1024, "the file is small");
  const rss0 = process.memoryUsage().rss;
  /** @type {(PdfRange | PdfStructure)[]} */
  const answers = [rangeOf(await extractPdfRange(bytes, { from: 0, count: 10 })), reading(await extractPdfStructure(bytes))];
  for (const r of answers) {
    assert.equal(r.ok, true);
    const texts = r.text.pages.map((p) => p.text);
    assert.deepEqual(texts, ["P1", "P2", "", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]);
    const marks = r.text.undetermined.filter((u) => u.reason === "page_over_bound");
    assert.equal(marks.length, 1);
    /** @type {Marker} */
    const mark = must(marks[0], "marks[0]");
    assert.equal(mark.page, 2);
    assert.equal(mark.bound, PAGE_CONTENT);
    assert.ok(must(mark.size, "size") > PAGE_CONTENT, "the size found is past the bound");
    assert.deepEqual(Object.keys(mark).sort(), ["bound", "codes", "count", "font", "page", "reason", "size"]);
  }
  assert.ok(process.memoryUsage().rss - rss0 < 400 * 1048576, "the bomb is stopped at the cap, not inflated");
  const r = reading(await extractPdfStructure(bytes));
  assert.ok(r.notes.includes("stream_over_bound:page_content"));
  assert.equal(r.images, null, "a page that cannot be walked makes the image list null, never partial");
});

test("R22: a stream under 128 KiB compressed is held to the same cap as a larger one", async () => {
  const small = bomb(100, 0x20); // about 100 KB compressed, 100 MB decoded
  assert.ok(small.length < 128 * 1024, `${small.length}`);
  const r = rangeOf(await extractPdfRange(doc([{ content: { dict: "/Filter /FlateDecode", data: small } }]), { from: 0, count: 1 }));
  assert.equal(r.text.undetermined.filter((u) => u.reason === "page_over_bound").length, 1);
  /* a page just under the cap is read: 3 MB of text operators */
  const unit = T("word") + "\n";
  const data = flate(unit.repeat(Math.floor(3 * 1048576 / unit.length)));
  const ok = rangeOf(await extractPdfRange(doc([{ content: { dict: "/Filter /FlateDecode", data } }]), { from: 0, count: 1 }));
  assert.equal(ok.text.undetermined.length, 0);
  assert.ok(must(ok.text.pages[0], "page 0").text.length > 400000);
});

test("R22: an object stream, a ToUnicode CMap and an embedded file are each held to the cap of their kind, stated as stream_over_bound:<kind>", async () => {
  const tooBigCmap = bomb(2); // 2 MiB decoded, past the 1 MiB CMap cap
  const o = over(FONT_OBJS, { 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>",
    11: { dict: "/Filter /FlateDecode", data: tooBigCmap },
    100: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents 101 0 R >>`, 101: { data: T("kept") } });
  const r = reading(await extractPdfStructure(build(o)));
  assert.ok(r.notes.includes("stream_over_bound:cmap"), JSON.stringify(r.notes));
  assert.ok(r.text.undetermined.some((u) => u.reason === "no_tounicode"), "no character is guessed from a CMap that was not read");
  /* an object stream past its cap: its objects are unread and that is stated both ways */
  /** @type {StreamBody} */
  const stm = { dict: `/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode`, data: bomb(boundOf("pdf", "object_stream") / 1048576 + 1) };
  const r2 = reading(await extractPdfStructure(build(over(o, { 11: { data: "" }, 900: stm }))));
  assert.ok(r2.notes.includes("stream_over_bound:object_stream"));
  assert.ok(r2.notes.includes("objstm_undecodable"));
  assert.equal(r2.ok, true);
  /* an embedded file past its cap is an undetermined record naming why, never a file read in part */
  /** @type {StreamBody} */
  const big = { dict: "/Type /EmbeddedFile /Filter /FlateDecode", data: bomb(boundOf("pdf", "embedded_file") / 1048576 + 1) };
  const withFile = build(over(o, { 11: { data: "" }, 400: big, 401: "<< /Type /Filespec /F (big.bin) /EF << /F 400 0 R >> >>",
    100: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${FONTS} >> /Contents 101 0 R /Annots [402 0 R] >>`,
    402: "<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 1 1] /Contents (big) /FS 401 0 R >>" }));
  const r3 = reading(await extractPdfStructure(withFile));
  assert.ok(r3.notes.includes("stream_over_bound:embedded_file"), JSON.stringify(r3.notes));
  assert.ok(r3.links.some((l) => l.partition === "undetermined" && l.target.why === "embedded_stream_undecodable"));
});

test("R22: an image stream's declared size is judged before anything is allocated for it; a breach is null with the note stream_over_bound:image", async () => {
  const px = boundOf("image", "pixels"), stride = boundOf("image", "row_stride");
  /** An image stream of one MiB of zeros with `dict`'s entries beside the fixed ones.
   *  @param {string} dict
   *  @returns {StreamBody} */
  const img = (dict) => ({ dict: `/Type /XObject /Subtype /Image /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode ${dict}`, data: bomb(1, 0) });
  /** A file whose object 200 is that image.
   *  @param {string} dict
   *  @returns {Uint8Array} */
  const mk = (dict) => build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 100: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>", 200: img(dict) });
  /** The opened file and object 200 decoded.
   *  @param {string} dict
   *  @returns {Promise<{ d: PdfDoc, got: Uint8Array | null }>} */
  const read = async (dict) => { const d = await opened(mk(dict)); return { d, got: await d.streamDecoded(d.resolve({ t: "ref", n: 200, g: 0 })) }; };
  const wide = await read(`/Width ${Math.ceil(Math.sqrt(px)) + 1} /Height ${Math.ceil(Math.sqrt(px)) + 1}`);
  assert.equal(wide.got, null);
  assert.ok(wide.d.notes.includes("stream_over_bound:image"));
  const stride1 = await read(`/Width ${stride + 1} /Height 1`);
  assert.equal(stride1.got, null);
  assert.ok(stride1.d.notes.includes("stream_over_bound:image"));
  /* controls: a declared size inside both bounds decodes, with no note */
  const fine = await read("/Width 1024 /Height 1024");
  assert.equal(must(fine.got, "decoded").length, 1048576);
  assert.ok(!fine.d.notes.includes("stream_over_bound:image"));
});

test("R22: a stream with a TIFF predictor is not passed through as if un-predicted: streamDecoded answers null; PNG predictors still decode", async () => {
  const data = flate(new Uint8Array(100).fill(7));
  /** A file whose object 200 is that stream under `parms`.
   *  @param {string} parms
   *  @returns {Uint8Array} */
  const mk = (parms) => build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] /Count 0 >>", 200: { dict: `/Filter /FlateDecode /DecodeParms << ${parms} >>`, data } });
  const d2 = await opened(mk("/Predictor 2 /Columns 10 /Colors 1 /BitsPerComponent 8"));
  assert.equal(await d2.streamDecoded(d2.resolve({ t: "ref", n: 200, g: 0 })), null);
  const d1 = await opened(mk("/Predictor 1"));
  assert.equal(must(await d1.streamDecoded(d1.resolve({ t: "ref", n: 200, g: 0 })), "decoded").length, 100);
  const d12 = await opened(mk("/Predictor 12 /Columns 9"));
  assert.equal(must(await d12.streamDecoded(d12.resolve({ t: "ref", n: 200, g: 0 })), "decoded").length, 90);
});

test("R47: operands past the bound are not held and the page still reads (65,536 operands)", async () => {
  const many = "1 ".repeat(boundOf("pdf", "operands") + 100);
  const r = reading(await extractPdfStructure(doc([{ content: `${many} ${T("after")}` }])));
  assert.equal(r.ok, true);
  assert.equal(must(r.text.pages[0], "page 0").text, "after");
  assert.ok(r.notes.some((n) => n.startsWith("over_bound:operands:")), JSON.stringify(r.notes));
});

test("R48: every ceiling this module keeps is read from READ_BOUNDS by name, and none is a number of its own", () => {
  const src = readFileSync(new URL("../../../src/pdfstructure.mjs", import.meta.url), "utf8");
  /** @type {[string, string][]} */
  const rows = [["pdf", "page_content"], ["pdf", "object_stream"], ["pdf", "cmap"], ["pdf", "embedded_file"], ["pdf", "objects"],
    ["pdf", "direct_object"], ["pdf", "operands"], ["pdf", "tree_depth"], ["pdf", "bfrange_codes"], ["pdf", "need_mb"], ["image", "pixels"], ["image", "row_stride"]];
  for (const [kind, name] of rows) {
    assert.ok(src.includes(`boundOf("${kind}", "${name}")`), `${kind}.${name}`);
  }
  /* the ceilings that were this file's own numbers are gone */
  for (const gone of [/INNER_DECODE_MAX/, /const READ_LIMIT_MB\s*=\s*\d/, /const STREAM_MAX\s*=\s*\d/, /const OBJ_WINDOW_MAX\s*=\s*\d/, /\b128 \* 1024 \* 1024\b/, /\b8 \* 1024 \* 1024\b/]) {
    assert.ok(!gone.test(src), String(gone));
  }
});

test("R47: a direct object past the bound is absent and stated, and an input of more objects than the bound leaves the process alive and the answer within it", async () => {
  const dmax = boundOf("pdf", "direct_object");
  const huge = `[ ${"1 ".repeat(Math.ceil(dmax / 2) + 10)}]`;
  const r = reading(await extractPdfStructure(build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] /Count 0 >>", 7: huge, 8: "[ 1 2 3 ]" })));
  assert.equal(r.ok, true);
  assert.ok(r.notes.includes(`over_bound:direct_object:${dmax + 1}:${dmax}`), JSON.stringify(r.notes));
  const d = await opened(build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] /Count 0 >>", 7: huge, 8: "[ 1 2 3 ]" }));
  assert.equal(d.resolve({ t: "ref", n: 7, g: 0 }), null, "the object past the bound is absent");
  assert.equal(itemsOf(d.resolve({ t: "ref", n: 8, g: 0 }), "object 8").length, 3, "its neighbours are read");
  /* objects: a file of 2,000,100 small objects */
  const omax = boundOf("pdf", "objects");
  const head = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n", "latin1");
  const parts = [head];
  /** @type {string[]} */
  const chunk = [];
  for (let n = 3; n < omax + 100; n++) { chunk.push(`${n} 0 obj\n1\nendobj\n`); if (chunk.length === 100000) { parts.push(Buffer.from(chunk.join(""), "latin1")); chunk.splice(0); } }
  parts.push(Buffer.from(chunk.join("") + "trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
  const big = new Uint8Array(Buffer.concat(parts));
  const res = reading(await extractPdfStructure(big));
  assert.equal(res.ok, true);
  const note = res.notes.find((n) => n.startsWith("over_bound:objects:"));
  assert.equal(note, `over_bound:objects:${omax + 1}:${omax}`);
  const od = await opened(big);
  assert.ok(od._objs.size <= omax, "no more objects are held than the bound");
});
