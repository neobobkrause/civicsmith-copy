/* pdf-reader: requirement-named tests for `pageSource(source, pageIndex)` (R49; fix round 9, G132k; K4859; pdf-pixels R47),
 * at the module's interface. The source is `{size, readRange(offset, length)}`, counted: what the module reads is what a
 * test sees. Files are written by `pdfgen` (a table, a cross-reference stream, object streams; text, scanned and mixed
 * pages; four fonts) and by hand (inherited page attributes, nested trees), and the real 15.2 MiB govinfo volume
 * (BUDGET-2024-APP, fetched once into BIO_FIXTURE_CACHE and checked against its SHA-256). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageSource, extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { generate } from "../../pdfgen.mjs";
import { indexed } from "./indexed.mjs";
import { bytesOf } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PageSourceAnswer, RangeSource, ImagePlacement, PageBox } from "../../../src/pdfstructure.mjs" */
/** @import { PdfRecipe, PdfSize, PdfScan } from "../../pdfgen.mjs" */
/** @import { IndexedObjects, IndexedOptions } from "./indexed.mjs" */

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
/** A page's own PDF; a thrown failure naming why when the answer is a fallback.
 *  @param {PageSourceAnswer} a
 *  @returns {{ ok: true, pages: number, bytes: Uint8Array }} */
const pageOk = (a) => { if (!a.ok) throw new Error(`expected the page, got the fallback ${a.why}`); return a; };
/** An answer's `fallback`, as the answer holds it (undefined where it has none).
 *  @param {PageSourceAnswer} a
 *  @returns {boolean | undefined} */
const fallbackIn = (a) => ("fallback" in a ? a.fallback : undefined);
/** An answer's `why`, as the answer holds it (undefined where it has none).
 *  @param {PageSourceAnswer} a
 *  @returns {string | undefined} */
const whyIn = (a) => ("why" in a ? a.why : undefined);
/** An answer's `bytes`, as the answer holds it (undefined where it has none).
 *  @param {PageSourceAnswer} a
 *  @returns {Uint8Array | undefined} */
const bytesIn = (a) => ("bytes" in a ? a.bytes : undefined);
/** `pageSource` handed what is not a source or not an index, as an untyped caller may (R49: a fallback, never a throw).
 *  Those values are outside its stated parameter types by design, so they are cast here, once.
 *  @param {unknown} source
 *  @param {unknown} pageIndex
 *  @returns {Promise<PageSourceAnswer>} */
const pageSourceOf = (source, pageIndex) => pageSource(/** @type {RangeSource} */ (source), /** @type {number} */ (pageIndex));

const CACHE = process.env.BIO_FIXTURE_CACHE || join(tmpdir(), "bio-test-fixtures");
/** A real file: its govinfo package name, its page count and its SHA-256.
 *  @typedef {{ name: string, pages: number, sha: string }} RealFile */
/** @type {RealFile} */
const APP = { name: "BUDGET-2024-APP", pages: 1354, sha: "6e0b3dc5f2f3f5bbab8ae5032bbc29207a8dbb290ba25ebafe3feb20dfe13c1e" };
/** @param {Uint8Array} b
 *  @returns {string} */
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
/** The real file's path in the cache, fetched first when it is not there with its SHA-256.
 *  @param {RealFile} file
 *  @returns {Promise<string>} */
async function fixture({ name, sha }) {
  const path = join(CACHE, `${name}.pdf`);
  if (existsSync(path) && sha256(readFileSync(path)) === sha) return path;
  mkdirSync(CACHE, { recursive: true });
  const res = await fetch(`https://www.govinfo.gov/content/pkg/${name}/pdf/${name}.pdf`);
  assert.ok(res.ok, `${name}: answered ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  assert.equal(sha256(body), sha, `${name}: the file fetched is not the file measured`);
  writeFileSync(`${path}.part`, body);
  renameSync(`${path}.part`, path);
  return path;
}

/** A source that counts its reads: the bytes read and the calls made.
 *  @typedef {{ size: number, read: number, calls: number, readRange: (offset: number, length: number) => Promise<Uint8Array> }} CountedSource */
/** A counted source over `file`.
 *  @param {Uint8Array} file
 *  @returns {CountedSource} */
function sourceOf(file) {
  /** @type {CountedSource} */
  const s = { size: file.length, read: 0, calls: 0, readRange: async (offset, length) => {
    s.calls++;
    const b = file.slice(offset, offset + length);
    s.read += b.length;
    return b;
  } };
  return s;
}
/** What a test changes of the generator's recipe.
 *  @typedef {{ kinds?: string[], size?: PdfSize, scan?: PdfScan }} RecipeChange */
/** What a placement says of its image, beside its page.
 *  @typedef {{ mime: string | null, name: string | null, width: number | null, height: number | null, filters: string[],
 *    rect: number[], inline: boolean, axis_aligned: boolean }} PlacementSeen */
/** The generator's recipe for a file of `structure`, changed by `extra`.
 *  @param {string} structure
 *  @param {RecipeChange} [extra]
 *  @returns {PdfRecipe} */
const recipe = (structure, extra = {}) => ({ kind: "pdf", seed: "page-source", size: { pages: 40, lines: 30 },
  kinds: ["text", "scan", "mixed"], fonts: ["winansi", "macroman", "differences", "type0"], structure, compress: true, ...extra });
/** @param {ImagePlacement} i
 *  @returns {PlacementSeen} */
const placement = (i) => ({ mime: i.mime, name: i.name, width: i.width, height: i.height, filters: i.filters, rect: i.rect, inline: i.inline, axis_aligned: i.axis_aligned });

/** The box of page `i` of a reading: undefined where the page has no box.
 *  @param {PdfStructure} r
 *  @param {number} i
 *  @returns {PageBox | undefined} */
const boxOf = (r, i) => { const pb = must(r.pageBoxes, "pageBoxes"); const k = pb.of_page[i]; return k === undefined || k === null ? undefined : pb.boxes[k]; };
/** What a reader finds of page `i` of the whole file and of the page's own file: equal, but for the page number.
 *  @param {PdfStructure} whole
 *  @param {PdfStructure} one
 *  @param {number} i
 *  @param {string} label
 *  @returns {Promise<void>} */
async function same(whole, one, i, label) {
  const onePage = must(one.text.pages[0], `${label}: page 0`), wholePage = must(whole.text.pages[i], `${label}: page ${i}`);
  assert.equal(one.pages, 1, `${label}: one page`);
  assert.equal(onePage.text, wholePage.text, `${label}: the page's text`);
  assert.deepEqual(onePage.undetermined.map((u) => ({ ...u, page: 0 })), wholePage.undetermined.map((u) => ({ ...u, page: 0 })), `${label}: the markers`);
  assert.deepEqual((one.images ?? []).map(placement), (whole.images ?? []).filter((m) => m.page === i).map(placement), `${label}: the images placed`);
  assert.deepEqual(boxOf(one, 0), boxOf(whole, i), `${label}: the page box`);
}

test("R49: the page's own PDF reads as the same page of the whole file: first, middle and last page, every structure", async () => {
  for (const structure of ["classic", "xref-stream", "object-streams"]) {
    const file = await generate(recipe(structure)).bytes();
    const whole = reading(await extractPdfStructure(file));
    assert.equal(whole.pages, 40);
    for (const i of [0, 1, 19, 38, 39]) {
      const answer = await pageSource(sourceOf(file), i);
      assert.equal(answer.ok, true, `${structure} page ${i}: ${JSON.stringify(answer)}`);
      const got = pageOk(answer);
      assert.equal(got.pages, 40, "the document's page count");
      assert.ok(got.bytes instanceof Uint8Array);
      await same(whole, reading(await extractPdfStructure(got.bytes)), i, `${structure} page ${i}`);
    }
  }
});

test("R49: every font family of the generator reads the same (a simple font with an encoding, differences, a Type0 font with its ToUnicode map)", async () => {
  const file = await generate(recipe("object-streams", { kinds: ["text"], size: { pages: 8, lines: 12 } })).bytes();
  const whole = reading(await extractPdfStructure(file));
  for (let i = 0; i < 8; i++) {
    const answer = await pageSource(sourceOf(file), i);
    assert.equal(answer.ok, true);
    const one = reading(await extractPdfStructure(pageOk(answer).bytes));
    const page = must(one.text.pages[0], `page ${i}`);
    assert.ok(page.text.length > 20 || page.undetermined.length > 0, `page ${i} reads as something, text or stated markers`);
    await same(whole, one, i, `page ${i}`);
  }
});

test("R49: the bytes read are the page's, not the file's: a scanned file of 120 pages, page 60 and the last", async () => {
  const file = await generate(recipe("xref-stream", { size: { pages: 120, lines: 6 }, kinds: ["scan"], scan: { dpi: 150, bits: 8 } })).bytes();
  assert.ok(file.length > 200_000, `the file is ${file.length} bytes`);
  for (const i of [3, 60, 119]) {
    const src = sourceOf(file);
    const answer = await pageSource(src, i);
    assert.equal(answer.ok, true);
    const got = pageOk(answer);
    /* the cross-reference data, the path to the page, the page: a bound proportional to the page and a fixed part for the chain */
    assert.ok(src.read <= got.bytes.length * 2 + 24 * 1024, `page ${i}: read ${src.read} bytes for a page of ${got.bytes.length}`);
    assert.ok(src.read < file.length / 8, `page ${i}: read ${src.read} of ${file.length}`);
  }
});

test("R49: the real 15.2 MiB, 1,354-page govinfo volume: pages 0, 700 and the last read like the whole file's, from a small part of the bytes", async () => {
  const file = new Uint8Array(readFileSync(await fixture(APP)));
  const whole = reading(await extractPdfStructure(file));
  assert.equal(whole.pages, APP.pages);
  for (const i of [0, 700, APP.pages - 1]) {
    const src = sourceOf(file);
    const answer = await pageSource(src, i);
    assert.equal(answer.ok, true, JSON.stringify({ ...answer, bytes: undefined }));
    const got = pageOk(answer);
    assert.equal(got.pages, APP.pages);
    assert.ok(src.read < 1_000_000, `page ${i}: read ${src.read} of ${file.length}`);
    assert.ok(src.read < file.length / 10);
    await same(whole, reading(await extractPdfStructure(got.bytes)), i, `page ${i}`);
  }
});

/* a document whose page attributes are inherited from the tree, three levels deep, with leaves that state no /Type */
/* the tree's root and the first page's content, which the fallback tests change */
const TREE_ROOT = "<< /Type /Pages /Kids [3 0 R 4 0 R 8 0 R] /Count 5 /MediaBox [0 0 300 400] /Rotate 90 /Resources << /Font << /F1 20 0 R >> >> >>";
const FIRST_CONTENT = "BT /F1 12 Tf 10 100 Td (first page text) Tj ET";
/** @type {IndexedObjects} */
const TREE = {
  1: "<< /Type /Catalog /Pages 2 0 R >>",
  2: TREE_ROOT,
  3: "<< /Type /Page /Parent 2 0 R /Contents 30 0 R >>",
  4: "<< /Type /Pages /Parent 2 0 R /Kids [5 0 R 6 0 R] /Count 2 /MediaBox [0 0 500 600] >>",
  5: "<< /Parent 4 0 R /Contents 31 0 R >>",
  6: "<< /Type /Page /Parent 4 0 R /Rotate 270 /Contents 32 0 R /Annots [40 0 R] >>",
  8: "<< /Type /Pages /Parent 2 0 R /Kids [9 0 R 10 0 R] /Count 2 /Resources << /Font << /F1 21 0 R >> >> >>",
  9: "<< /Type /Page /Parent 8 0 R /Contents 33 0 R /MediaBox [10 20 210 320] >>",
  10: "<< /Parent 8 0 R /Contents 34 0 R /MediaBox [0 0 100 100] /Resources << /Font << /F1 20 0 R >> >> >>",
  20: "<< /Type /Font /Subtype /TrueType /BaseFont /Plain /ToUnicode 22 0 R >>",
  21: "<< /Type /Font /Subtype /TrueType /BaseFont /Serif /ToUnicode 22 0 R >>",
  22: { dict: "", data: "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end" },
  30: { dict: "", data: FIRST_CONTENT },
  31: { dict: "", data: "BT /F1 12 Tf 10 100 Td (second page text) Tj ET" },
  32: { dict: "", data: "BT /F1 12 Tf 10 100 Td (third page text) Tj ET" },
  33: { dict: "", data: "BT /F1 12 Tf 10 100 Td (fourth page text) Tj ET" },
  34: { dict: "", data: "BT /F1 12 Tf 10 100 Td (fifth page text) Tj ET" },
  40: "<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /Dest [10 0 R /Fit] >>",
};
/** The tree's file, written as `kind` says.
 *  @param {IndexedOptions} [kind]
 *  @returns {Uint8Array} */
const treeFile = (kind = {}) => indexed(TREE, kind);

test("R49: MediaBox, Rotate and Resources are inherited into the page's own dictionary, nearest first, through a nested tree and /Count skips", async () => {
  const expect = [
    { text: "first page text", box: [0, 0, 300, 400], rotate: 90 },
    { text: "second page text", box: [0, 0, 500, 600], rotate: 90 },
    { text: "third page text", box: [0, 0, 500, 600], rotate: 270 },
    { text: "fourth page text", box: [10, 20, 210, 320], rotate: 90 },
    { text: "fifth page text", box: [0, 0, 100, 100], rotate: 90 },
  ];
  /** @type {IndexedOptions[]} */
  const kinds = [{}, { xref: "stream" }, { xref: "stream", packed: [1, 2, 3, 4, 5, 6, 8, 9, 10, 20, 21, 40] }];
  for (const kind of kinds) {
    const file = treeFile(kind);
    const whole = reading(await extractPdfStructure(file));
    assert.equal(whole.pages, 5);
    for (let i = 0; i < 5; i++) {
      const answer = await pageSource(sourceOf(file), i);
      assert.equal(answer.ok, true, `page ${i}: ${JSON.stringify(answer)}`);
      const got = pageOk(answer);
      assert.equal(got.pages, 5);
      const one = reading(await extractPdfStructure(got.bytes));
      const want = must(expect[i], `expect[${i}]`);
      const box = must(must(one.pageBoxes, "pageBoxes").boxes[0], `page ${i} boxes[0]`);
      assert.equal(must(one.text.pages[0], `page ${i}`).text, want.text);
      assert.deepEqual(box.media_box, want.box, `page ${i} box`);
      assert.equal(box.rotate, want.rotate, `page ${i} rotate`);
      await same(whole, one, i, `page ${i}`);
    }
  }
  /* the page's file holds that page alone: not the tree, not its neighbours' text, not the annotation's destination */
  const one = Buffer.from(pageOk(await pageSource(sourceOf(treeFile()), 2)).bytes).toString("latin1");
  assert.ok(!/second page|fourth page|\/Kids\s*\[[^\]]*[4-9] 0 R/.test(one));
  assert.equal((one.match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length, 1);
  assert.ok(!/\/Annots/.test(one));
});

test("R49: an index outside the document, a source that is not one and a file that is not a PDF answer fallback with a reason and never throw", async () => {
  const file = treeFile();
  /** The answer is a fallback with a reason and no bytes.
   *  @param {PageSourceAnswer} got
   *  @param {string} label
   *  @returns {void} */
  const fb = (got, label) => { const why = whyIn(got); assert.equal(got.ok, false, label); assert.equal(fallbackIn(got), true, label); assert.ok(typeof why === "string" && why.length > 0, label); assert.equal(bytesIn(got), undefined, label); };
  /** @type {unknown[]} */
  const indexes = [-1, 5, 6, 1e9, 1.5, NaN, Infinity, "0", null, undefined, {}];
  for (const i of indexes) fb(await pageSourceOf(sourceOf(file), i), `index ${String(i)}`);
  /** @type {unknown[]} */
  const sources = [null, undefined, 0, "x", {}, { size: 10 }, { readRange() {} }, { size: 0, readRange: async () => new Uint8Array(0) }, { size: -4, readRange: async () => new Uint8Array(0) }];
  for (const s of sources) fb(await pageSourceOf(s, 0), `source ${JSON.stringify(s)}`);
  fb(await pageSource(sourceOf(bytesOf("hello, not a pdf at all, but long enough to be read in one range ".repeat(80))), 0), "not a PDF");
});

test("R49: a source whose reads fail or answer something else is a fallback, never a throw", async () => {
  const file = treeFile();
  /** @type {unknown[]} */
  const bad = [
    { size: file.length, readRange: async () => { throw new Error("store down"); } },
    { size: file.length, readRange: () => { throw new Error("sync"); } },
    { size: file.length, readRange: async () => ({ ok: false, reason: "NOT_HELD" }) }, // fixtures-own: input a source's refusal, a literal handed to pageSource
    { size: file.length, readRange: async () => undefined },
    { size: file.length, readRange: async () => "text" },
    { size: file.length, readRange: async () => new Uint8Array(0) },
    { size: file.length, readRange: /** @param {number} o @param {number} l */ async (o, l) => file.slice(o, o + l).fill(0x20) },
  ];
  for (const s of bad) {
    const got = await pageSourceOf(s, 0);
    assert.equal(got.ok, false);
    assert.equal(fallbackIn(got), true);
  }
});

test("R49: no usable cross-reference, a trailer with /Encrypt, a damaged object, a lying length, a lying count and a tree in a loop each answer fallback", async () => {
  /** The page source of `file`'s page 0, asserted a fallback with a reason.
   *  @param {Uint8Array} file
   *  @param {string} why
   *  @returns {Promise<PageSourceAnswer>} */
  const fb = async (file, why) => {
    const got = await pageSource(sourceOf(file), 0);
    const reason = whyIn(got);
    assert.equal(got.ok, false, why);
    assert.equal(fallbackIn(got), true, why);
    assert.ok(typeof reason === "string" && reason.length, why);
    return got;
  };
  /** @param {Uint8Array} f
   *  @returns {string} */
  const text = (f) => Buffer.from(f).toString("latin1");
  /** `f` with `a` replaced by `b`, asserted to hold `a`.
   *  @param {Uint8Array} f
   *  @param {string} a
   *  @param {string} b
   *  @returns {Uint8Array} */
  const replace = (f, a, b) => { const t = text(f); assert.ok(t.includes(a), `${a} is in the file`); return bytesOf(t.replace(a, b)); };
  const file = treeFile();
  /* no startxref, a startxref that points nowhere, one that points into an object, a cut file */
  await fb(replace(file, "startxref", "startxrff"), "no startxref");
  await fb(replace(file, must(/startxref\n\d+/.exec(text(file)), "startxref")[0], "startxref\n99999999"), "startxref past the end");
  await fb(replace(file, must(/startxref\n\d+/.exec(text(file)), "startxref")[0], "startxref\n20"), "startxref into an object");
  await fb(file.slice(0, Math.floor(file.length * 0.6)), "a file cut at 60 percent");
  await fb(bytesOf("%PDF-1.7\n" + text(file).slice(9).replace(/xref\n/g, "xrof\n")), "no table");
  /* /Encrypt in the trailer, direct and by reference, in a table and in a cross-reference stream */
  await fb(indexed(TREE, { trailer: "/Root 1 0 R /Encrypt << /Filter /Standard /R 3 /V 2 /O (x) /U (y) /P -4 >>" }), "direct /Encrypt, table");
  await fb(indexed({ ...TREE, 50: "<< /Filter /Standard /R 3 /V 2 /O (x) /U (y) /P -4 >>" }, { trailer: "/Root 1 0 R /Encrypt 50 0 R", xref: "stream" }), "indirect /Encrypt, stream");
  /* the page's object does not open where the table says it does (its header names another number) */
  await fb(replace(file, "3 0 obj", "7 0 obj"), "an object whose header is not its number");
  /* a content stream whose /Length is not where endstream follows */
  const len = FIRST_CONTENT.length;
  await fb(replace(file, `/Length ${len}`, `/Length ${len - 9}`), "a lying /Length");
  /* a count that does not reach the page; a tree that points back at its parent */
  await fb(indexed({ ...TREE, 2: TREE_ROOT.replace("/Kids [3 0 R 4 0 R 8 0 R] /Count 5", "/Kids [3 0 R 4 0 R 8 0 R] /Count 0") }), "/Count 0");
  await fb(indexed({ ...TREE, 3: "<< /Type /Pages /Parent 2 0 R /Kids [2 0 R] /Count 1 >>" }), "a tree in a loop");
  await fb(indexed({ ...TREE, 2: TREE_ROOT.replace("/MediaBox [0 0 300 400] ", ""), 3: "<< /Type /Page /Parent 2 0 R /Contents 30 0 R >>" }), "no MediaBox anywhere");
});

test("R49: the module reads through readRange alone and takes the same answer from a source that returns slices of one buffer or copies", async () => {
  const file = await generate(recipe("object-streams", { size: { pages: 12, lines: 10 } })).bytes();
  const aAnswer = await pageSource(sourceOf(file), 7);
  const b = pageOk(await pageSource({ size: file.length, readRange: async (o, l) => new Uint8Array(file.subarray(o, o + l)) }, 7));
  const c = pageOk(await pageSource({ size: file.length, readRange: async (o, l) => file.subarray(o, o + l) }, 7));
  assert.equal(aAnswer.ok, true);
  const a = pageOk(aAnswer);
  assert.deepEqual(Buffer.from(b.bytes), Buffer.from(a.bytes));
  assert.deepEqual(Buffer.from(c.bytes), Buffer.from(a.bytes));
  /* the same page twice is the same bytes */
  assert.deepEqual(Buffer.from(pageOk(await pageSource(sourceOf(file), 7)).bytes), Buffer.from(a.bytes));
});
