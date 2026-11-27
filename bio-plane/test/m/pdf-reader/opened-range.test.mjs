/* pdf-reader: requirement-named tests for a document opened once and read by ranges (R44; fix round 7, G68; K4738), at the
 * module's interface. `openPdfRange(bytes)` parses the file once and answers `{ok, pages, range({from, count, maxBytes})}`;
 * each `range` answers what `extractPdfRange(bytes, {from, count, maxBytes})` answers (R43), and no `range` scans the
 * file or decodes its object streams again. The counts are `pdfWork()`'s (how many scans and object-stream loads were
 * made), never a time (R-CLOCK). The real file is the 15.2 MiB, 1,354-page govinfo volume reading-pipeline's
 * `pdf-pieces.test.mjs` reads in 14 pieces (BUDGET-2024-APP, fetched once into BIO_FIXTURE_CACHE and checked against its
 * SHA-256). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfStructure, extractPdfRange, openPdfRange, pdfWork } from "../../../src/pdfstructure.mjs";
import { bytesOf } from "./pdf.mjs";
import { indexed } from "./indexed.mjs";
import { densePdf } from "./dense.mjs";
/** @import { PdfStructure, PdfStructureAnswer, PdfRange, PdfRefusal, PdfRangeArgs, PageText, OpenedRange, OpenRangeOptions, PdfWork } from "../../../src/pdfstructure.mjs" */
/** @import { IndexedObjects } from "./indexed.mjs" */
/** @import { RangeMessage, OpenedMessage } from "./memory-child.mjs" */

/** A reading that is a PDF's structure; a thrown failure naming `what` when it is a refusal.
 *  @param {PdfStructureAnswer} r
 *  @param {string} what
 *  @returns {PdfStructure} */
function structureOf(r, what) {
  if (!r.ok) throw new Error(`${what}: the reading answered ${r.reason}`);
  return r;
}
/** An opened document; a thrown failure naming `what` when the opening is a refusal.
 *  @param {OpenedRange | PdfRefusal} r
 *  @param {string} what
 *  @returns {OpenedRange} */
function openedOf(r, what) {
  if (!r.ok) throw new Error(`${what}: the opening answered ${r.reason}`);
  return r;
}
/** Opening options whose `yieldNow` may be of any kind, as a caller that does not check what it passes builds them. The one
 *  cast here: R45 states that an opening given a `yieldNow` that is not a function opens as without one, which no value of
 *  the stated kind can carry.
 *  @param {null | number | string | object} yieldNow
 *  @returns {OpenRangeOptions} */
const anyYieldNow = (yieldNow) => /** @type {OpenRangeOptions} */ (/** @type {unknown} */ ({ yieldNow }));

/** @param {string} p
 *  @returns {string} */
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const CHILD = here("./memory-child.mjs");
const PLATFORM = here("../../platform-sqlite.mjs");
const CACHE = process.env.BIO_FIXTURE_CACHE || join(tmpdir(), "bio-test-fixtures");
/** A real file: its govinfo package name, its page count and its SHA-256.
 *  @typedef {Object} RealFile
 *  @property {string} name
 *  @property {number} pages
 *  @property {string} sha
 */
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
/** How a child process ended and what it printed.
 *  @typedef {Object} ChildRun
 *  @property {number | null} code
 *  @property {string | null} signal
 *  @property {string} out
 *  @property {string} err
 */
/** @param {string[]} args
 *  @param {string[]} [nodeArgs]
 *  @returns {Promise<ChildRun>} */
function child(args, nodeArgs = []) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", PLATFORM, ...nodeArgs, CHILD, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", /** @param {Buffer} d */ (d) => (out += d));
    p.stderr.on("data", /** @param {Buffer} d */ (d) => (err += d));
    p.on("close", (code, signal) => resolve({ code, signal, out, err }));
  });
}
/** The JSON object a child printed; a thrown failure naming `what` when it printed none.
 *  @param {string} text
 *  @param {string} what
 *  @returns {object} */
function printed(text, what) {
  /** @type {unknown} */
  const v = JSON.parse(text);
  if (typeof v !== "object" || v === null) throw new Error(`${what}: the child printed no object`);
  return v;
}
/** A number a child printed; a thrown failure naming `what` when it is not one.
 *  @param {unknown} v
 *  @param {string} what
 *  @returns {number} */
function numberOf(v, what) {
  if (typeof v !== "number") throw new Error(`${what}: not a number`);
  return v;
}
/** A string a child printed; a thrown failure naming `what` when it is not one.
 *  @param {unknown} v
 *  @param {string} what
 *  @returns {string} */
function stringOf(v, what) {
  if (typeof v !== "string") throw new Error(`${what}: not a string`);
  return v;
}
/** What a child's `range` printed; a thrown failure naming the member it lacks.
 *  @param {string} text
 *  @returns {RangeMessage} */
function rangeMessageOf(text) {
  const v = printed(text, "range");
  return { baseMB: numberOf("baseMB" in v ? v.baseMB : undefined, "range: baseMB"), peakMB: numberOf("peakMB" in v ? v.peakMB : undefined, "range: peakMB"),
    slowestMs: numberOf("slowestMs" in v ? v.slowestMs : undefined, "range: slowestMs"), pages: numberOf("pages" in v ? v.pages : undefined, "range: pages"),
    calls: numberOf("calls" in v ? v.calls : undefined, "range: calls"), digest: stringOf("digest" in v ? v.digest : undefined, "range: digest") };
}
/** What a child's `opened` printed; a thrown failure naming the member it lacks.
 *  @param {string} text
 *  @returns {OpenedMessage} */
function openedMessageOf(text) {
  const v = printed(text, "opened");
  const held = "held" in v ? v.held : undefined;
  if (typeof held !== "boolean") throw new Error("opened: held: not a boolean");
  return { baseMB: numberOf("baseMB" in v ? v.baseMB : undefined, "opened: baseMB"), peakMB: numberOf("peakMB" in v ? v.peakMB : undefined, "opened: peakMB"),
    openMs: numberOf("openMs" in v ? v.openMs : undefined, "opened: openMs"),
    slowestMs: numberOf("slowestMs" in v ? v.slowestMs : undefined, "opened: slowestMs"), pages: numberOf("pages" in v ? v.pages : undefined, "opened: pages"),
    calls: numberOf("calls" in v ? v.calls : undefined, "opened: calls"), digest: stringOf("digest" in v ? v.digest : undefined, "opened: digest"), held };
}
/** The work done between two counts.
 *  @param {PdfWork} a
 *  @param {PdfWork} b
 *  @returns {PdfWork} */
const delta = (a, b) => ({ scans: b.scans - a.scans, objectStreamLoads: b.objectStreamLoads - a.objectStreamLoads, innerDecodes: b.innerDecodes - a.innerDecodes });

/* A document of 13 pages the way a modern producer writes one: a cross-reference stream, the catalog, the page tree, the
 * fonts and the page dictionaries packed into TWO object streams (pages 0-5 in the first, 6-12 in the second, so a range of
 * pages 4-8 reads from both), each page's content a stream of its own. Page 3 uses a font with no widths, page 8 shows a
 * code its font does not map, page 10 paints a full-page image under a folio (R26's and R34's markers), page 12 shows
 * nothing. */
const TOUNI = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";
/** @returns {Uint8Array} */
function openedDoc() {
  const N = 13;
  /** @type {IndexedObjects} */
  const objs = {
    1: "<< /Type /Catalog /Pages 2 0 R >>",
    10: `<< /Type /Font /Subtype /TrueType /BaseFont /Plain /FirstChar 32 /Widths [${Array.from({ length: 95 }, () => 500).join(" ")}] /ToUnicode 11 0 R >>`,
    11: { data: TOUNI },
    12: "<< /Type /Font /Subtype /TrueType /BaseFont /NoWidths /ToUnicode 11 0 R >>",
    13: { dict: "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", data: "\xff" },
  };
  /** @type {string[]} */
  const kids = [];
  /** @type {number[]} */
  const first = [1, 2, 10, 12];
  /** @type {number[]} */
  const second = [];
  for (let i = 0; i < N; i++) {
    const pn = 100 + 2 * i, cn = pn + 1;
    kids.push(`${pn} 0 R`);
    const res = i === 10 ? "/Font << /F1 10 0 R >> /XObject << /Im0 13 0 R >>" : "/Font << /F1 10 0 R /F2 12 0 R >>";
    objs[pn] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << ${res} >> /Contents ${cn} 0 R >>`;
    const text = i === 3 ? "BT /F2 12 Tf 10 700 Td (page number 4 text no widths) Tj ET"
      : i === 8 ? "BT /F1 12 Tf 10 700 Td (page number 9 \\200 text) Tj ET"
      : i === 10 ? "q 600 0 0 800 0 0 cm /Im0 Do Q BT /F1 12 Tf 10 20 Td (11) Tj ET"
      : i === 12 ? ""
      : `BT /F1 12 Tf 10 700 Td (page number ${i + 1} text) Tj 0 -14 Td (second line of page ${i + 1}) Tj ET`;
    objs[cn] = { data: text };
    (i < 6 ? first : second).push(pn);
  }
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${N} >>`;
  return indexed(objs, { xref: "stream", packed: [first, second], objStmNum: 900 });
}
const OBJSTMS = 2;

/* the arguments a reading-pipeline caller may pass, and the ones around them */
const FROMS = [0, 1, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 100];
/** @type {(number | undefined)[]} */
const COUNTS = [undefined, 0, 1, 2, 3, 5, 9, 13, 100];

test("R44: the file is parsed once however many ranges are read; extractPdfRange called twice parses it twice", async () => {
  const bytes = openedDoc();
  const w0 = pdfWork();
  await extractPdfRange(bytes, { from: 0, count: 2 });
  await extractPdfRange(bytes, { from: 2, count: 2 });
  const twice = delta(w0, pdfWork());
  assert.equal(twice.scans, 2, "extractPdfRange scans the file at every call");
  assert.equal(twice.objectStreamLoads, 2 * OBJSTMS, "and decodes its object streams at every call");

  const w1 = pdfWork();
  const opened = await openPdfRange(bytes);
  assert.equal(opened.ok, true);
  const afterOpen = pdfWork();
  assert.deepEqual(delta(w1, afterOpen), { scans: 1, objectStreamLoads: OBJSTMS, innerDecodes: delta(w1, afterOpen).innerDecodes }, "the opening is one scan and one load of each object stream");
  for (let round = 0; round < 3; round++) {
    for (let from = 0; from < 13; from += 2) await opened.range({ from, count: 2 });
  }
  const afterRanges = delta(afterOpen, pdfWork());
  assert.equal(afterRanges.scans, 0, "no range scans the file again");
  assert.equal(afterRanges.objectStreamLoads, 0, "no range decodes the object streams the opening decoded");
  /* the object streams are read for the objects asked, from the few held (R41): 2 streams of 13 pages never need more than
     one decode each for the whole of three rounds over them */
  assert.ok(afterRanges.innerDecodes <= OBJSTMS, `${afterRanges.innerDecodes} object-stream decodes in 21 ranges`);
});

test("R44: every range of every size answers what extractPdfRange answers for the same arguments, an object stream's edge and the last page included", async () => {
  const bytes = openedDoc();
  const perPage = bytes.length / 13;
  const opened = openedOf(await openPdfRange(bytes), "the opening");
  assert.equal(opened.pages, 13);
  const whole = structureOf(await extractPdfStructure(bytes), "the whole reading");
  assert.equal(whole.pages, 13);
  let checked = 0;
  for (const maxBytes of [undefined, perPage * 2.5, 1]) {
    for (const from of FROMS) {
      for (const count of COUNTS) {
        /** @type {PdfRangeArgs} */
        const args = { from, count, maxBytes };
        const want = await extractPdfRange(bytes, args);
        const got = await opened.range(args);
        assert.equal(JSON.stringify(got), JSON.stringify(want), `range ${JSON.stringify(args)}`);
        checked++;
      }
    }
  }
  assert.equal(checked, 3 * FROMS.length * COUNTS.length);
  /* the answers cover the markers the pages carry: the font with no widths, the unmapped code, the image over the folio */
  const marked = (await opened.range({ from: 0, count: 13 })).text.undetermined.map((m) => m.reason);
  for (const reason of ["unmapped_code", "image_content_unread", "image_unread"]) assert.ok(marked.includes(reason), reason);
  /* ranges in any order, and the same range again, answer the same: nothing a call reads is left to the next */
  /** @type {[number, number][]} */
  const order = [[8, 5], [0, 13], [12, 1], [4, 9], [8, 5], [0, 1], [10, 3]];
  for (const [from, count] of order) {
    assert.deepEqual(await opened.range({ from, count }), await extractPdfRange(bytes, { from, count }), `${from}+${count} after the others`);
  }
  /* a call with no argument, and with none of the keys, is the call extractPdfRange makes */
  assert.deepEqual(await opened.range(), await extractPdfRange(bytes));
  assert.deepEqual(await opened.range({}), await extractPdfRange(bytes, {}));
  /* the union of the pieces is the whole reading's pages, each once */
  /** @type {PageText[]} */
  const seen = [];
  for (let from = 0; from < 13; from += 4) seen.push(...(await opened.range({ from, count: 4 })).text.pages);
  assert.deepEqual(seen, whole.text.pages);
});

test("R44: what is not a PDF is refused as extractPdfRange refuses it, and an encrypted file and a file with no pages answer as it answers them", async () => {
  for (const bad of ["x", null, undefined, 7, {}, new TextEncoder().encode("hello"), new Uint8Array(0)]) {
    assert.deepEqual(await openPdfRange(bad), await extractPdfRange(bad, { from: 0, count: 1 }), String(bad));
    assert.equal((await openPdfRange(bad)).ok, false);
    assert.equal("range" in (await openPdfRange(bad)), false, "a refusal has no range");
  }
  const enc = densePdf({ pages: 5, encrypted: true });
  const e = await openPdfRange(enc);
  assert.equal(e.ok, true);
  /** @type {PdfRangeArgs[]} */
  const encCuts = [{ from: 0, count: 5 }, { from: 2, count: 1 }, { from: 5, count: 1 }, { from: 0, count: 0 }];
  for (const args of encCuts) {
    assert.deepEqual(await e.range(args), await extractPdfRange(enc, args), `encrypted ${JSON.stringify(args)}`);
  }
  assert.deepEqual((await e.range({ from: 0, count: 5 })).text.undetermined.map((m) => m.reason), ["encrypted"]);
  const none = bytesOf("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  const n = openedOf(await openPdfRange(none), "the opening of a file with no pages");
  assert.equal(n.pages, 0);
  assert.deepEqual(await n.range({ from: 0, count: 3 }), await extractPdfRange(none, { from: 0, count: 3 }));
});

test("R44: the real BUDGET-2024-APP, opened once, answers each range as extractPdfRange does, decoding each object stream once and no range scanning the file again", { timeout: 900_000 }, async () => {
  const path = await fixture(APP);
  const bytes = new Uint8Array(readFileSync(path));
  const w0 = pdfWork();
  const opened = openedOf(await openPdfRange(bytes), APP.name);
  assert.equal(opened.pages, APP.pages);
  const w1 = pdfWork();
  const open = delta(w0, w1);
  assert.equal(open.scans, 1);
  /** @type {PdfRangeArgs[]} */
  const cuts = [{ from: 0, count: 100 }, { from: 0, count: 1 }, { from: 333, count: 333 }, { from: 1300, count: 100 }, { from: 1353, count: 5 }, { from: 650, count: 1 }];
  /** @type {PdfRange[]} */
  const got = [];
  for (const args of cuts) got.push(await opened.range(args));
  const ranges = delta(w1, pdfWork());
  assert.deepEqual({ scans: ranges.scans, objectStreamLoads: ranges.objectStreamLoads }, { scans: 0, objectStreamLoads: 0 }, `${JSON.stringify(ranges)}: a range scanned or loaded the file again`);
  /* an object stream is decoded the first time a page's object in it is asked for, and never again: the second reading of
     every one of these ranges decodes none, and the first decoded no more than the file has */
  assert.ok(ranges.innerDecodes <= open.objectStreamLoads, `${ranges.innerDecodes} object-stream decodes for ${open.objectStreamLoads} streams`);
  const w2 = pdfWork();
  for (const args of cuts) await opened.range(args);
  const again = delta(w2, pdfWork());
  assert.deepEqual(again, { scans: 0, objectStreamLoads: 0, innerDecodes: 0 }, "the same ranges again decode nothing");
  /* and each answers what extractPdfRange answers (which opens the file for it) */
  for (let i = 0; i < cuts.length; i++) {
    assert.equal(JSON.stringify(got[i]), JSON.stringify(await extractPdfRange(bytes, cuts[i])), JSON.stringify(cuts[i]));
  }
  console.log(`R44 ${APP.name}: opening ${JSON.stringify(open)}; ${cuts.length} ranges of the opened document ${JSON.stringify(ranges)}, again ${JSON.stringify(again)}`);
});

/* L: the platform's shape. The file is opened once and held through 14 ranges of 100 pages in a V8 heap of 128 MB less its
 * bytes (the object's limit, as range.test.mjs and the reading-pipeline memory tests hold it), with the platform's value-limit
 * preload. The peak above idle is compared with the peak of 14 extractPdfRange calls in the same heap, one parse at a time:
 * the opened document may hold a stated margin more (a held document is a parse kept; it must not be a second one). */
const MARGIN_MB = 8;
test("R44: the opened 15.2 MiB volume, held through 14 ranges of 100 pages in a 128 MB object, holds no more than one parse plus a stated margin, and reads the same pages", { timeout: 900_000 }, async () => {
  const path = await fixture(APP);
  const mb = Math.ceil(readFileSync(path).length / 1048576);
  const flags = ["--expose-gc", `--max-old-space-size=${128 - mb}`, "--max-semi-space-size=2"];
  const one = await child(["range", path, "100"], flags);
  assert.equal(one.code, 0, `the 14 extractPdfRange calls did not complete in the heap (${one.signal ?? "exit " + one.code}): ${one.err.split("\n").slice(0, 3).join(" | ")}`);
  const opened = await child(["opened", path, "100"], flags);
  assert.equal(opened.code, 0, `the opened document did not complete in a ${128 - mb} MB heap (${opened.signal ?? "exit " + opened.code}): ${opened.err.split("\n").slice(0, 3).join(" | ")}`);
  const a = rangeMessageOf(one.out), b = openedMessageOf(opened.out);
  console.log(`R44 ${APP.name}: 14 extractPdfRange calls peak ${a.peakMB.toFixed(1)} MB, slowest ${Math.round(a.slowestMs)} ms; opened once (${Math.round(b.openMs)} ms) and held through 14 ranges: peak ${b.peakMB.toFixed(1)} MB, slowest range ${Math.round(b.slowestMs)} ms (heap ${128 - mb} MB, MARGIN ${MARGIN_MB} MB)`);
  assert.equal(b.pages, APP.pages);
  assert.equal(b.calls, 14);
  assert.equal(b.digest, a.digest, "the pages read from the opened document are the pages extractPdfRange reads");
  assert.ok(b.peakMB <= a.peakMB + MARGIN_MB, `the opened document peaked ${b.peakMB.toFixed(1)} MB; one parse peaked ${a.peakMB.toFixed(1)} MB`);
  assert.ok(b.peakMB < 64, `peak ${b.peakMB.toFixed(1)} MB above idle`);
});

/* R45 (fix round 7, G82; K4743): `openPdfRange(bytes, {yieldNow})` gives the thread back while it opens. */
/** A turn of the event loop.
 *  @returns {Promise<void>} */
const later = () => new Promise((r) => setImmediate(r));
/** What `stretches` gives: the `yieldNow`, the start and end marks, and what they counted.
 *  @typedef {Object} Stretches
 *  @property {() => Promise<void>} yieldNow
 *  @property {() => void} mark
 *  @property {() => void} end
 *  @property {number} calls
 *  @property {number} longest
 */
/** a `yieldNow` that counts its calls and takes, with the test's own clock outside the call, the longest stretch between
 *  the open's start (`mark()`), its yields and its end (`end()`)
 *  @returns {Stretches} */
function stretches() {
  let last = 0, longest = 0, calls = 0;
  const lap = () => { const t = performance.now(); longest = Math.max(longest, t - last); last = t; };
  return { yieldNow: async () => { calls++; lap(); await later(); last = performance.now(); },
    mark: () => { last = performance.now(); }, end: lap, get calls() { return calls; }, get longest() { return longest; } };
}

test("R45: the opening awaits yieldNow between its phases, and within them while the file's work grows", async () => {
  const bytes = openedDoc();
  const small = stretches();
  small.mark();
  const o = await openPdfRange(bytes, { yieldNow: small.yieldNow });
  assert.equal(o.ok, true);
  assert.ok(small.calls >= 3, `${small.calls} calls over a 13-page file: one after each of the three phases`);
  /* more work, more yields: a file of many objects yields inside the scan */
  const big = densePdf({ pages: 2500, linesPerPage: 1 });
  let n = 0;
  await openPdfRange(big, { yieldNow: async () => { n++; } });
  assert.ok(n > small.calls, `${n} calls for 2,500 pages, ${small.calls} for 13`);
  /* without a function, as R44: no call, same opened document */
  for (const none of [undefined, null, 5, "yes", {}]) {
    const w = openedOf(await openPdfRange(bytes, none === undefined ? undefined : anyYieldNow(none)), `yieldNow ${String(none)}`);
    assert.equal(JSON.stringify(await w.range({ from: 0, count: 13 })), JSON.stringify(await extractPdfRange(bytes, { from: 0, count: 13 })));
  }
});

test("R45: every range of an opened document answers the same with yieldNow as without, whatever yieldNow does", async () => {
  const bytes = openedDoc();
  const plain = openedOf(await openPdfRange(bytes), "the opening");
  /** One `yieldNow` the opening is given, and its name.
   *  @typedef {Object} Variant
   *  @property {string} name
   *  @property {() => (void | Promise<void>)} yieldNow
   */
  /** @type {Variant[]} */
  const variants = [
    { name: "a timer turn", yieldNow: async () => later() },
    { name: "a plain function", yieldNow: () => {} },
    { name: "one that throws", yieldNow: () => { throw new Error("no"); } },
    { name: "one that rejects", yieldNow: () => Promise.reject(new Error("no")) },
  ];
  for (const { name, yieldNow } of variants) {
    const y = openedOf(await openPdfRange(bytes, { yieldNow }), name);
    assert.equal(y.pages, plain.pages, name);
    for (const maxBytes of [undefined, bytes.length / 13 * 2.5]) {
      for (const from of FROMS) for (const count of COUNTS) {
        /** @type {PdfRangeArgs} */
        const args = { from, count, maxBytes };
        assert.equal(JSON.stringify(await y.range(args)), JSON.stringify(await plain.range(args)), `${name} ${JSON.stringify(args)}`);
      }
    }
  }
  /* a file of many pages (the page tree walked in slices) and a file with no pages */
  const big = densePdf({ pages: 700, linesPerPage: 2 });
  const a = openedOf(await openPdfRange(big), "700 pages"), b = openedOf(await openPdfRange(big, { yieldNow: async () => later() }), "700 pages with yieldNow");
  assert.equal(b.pages, 700);
  /** @type {PdfRangeArgs[]} */
  const bigCuts = [{ from: 0, count: 50 }, { from: 333, count: 100 }, { from: 650, count: 100 }];
  for (const args of bigCuts) {
    assert.equal(JSON.stringify(await b.range(args)), JSON.stringify(await a.range(args)));
  }
  const none = bytesOf("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  assert.deepEqual(await openedOf(await openPdfRange(none, { yieldNow: later }), "no pages with yieldNow").range({ from: 0, count: 3 }), await openedOf(await openPdfRange(none), "no pages").range({ from: 0, count: 3 }));
  /* a refusal is the refusal */
  assert.deepEqual(await openPdfRange("x", { yieldNow: later }), await openPdfRange("x"));
});

const STRETCH_BAR_MS = 60;
test("R45: opening the real BUDGET-2024-APP, no synchronous stretch of the open is longer than the bar, and the ranges are the same", { timeout: 900_000 }, async () => {
  const path = await fixture(APP);
  const bytes = new Uint8Array(readFileSync(path));
  const t0 = performance.now();
  const plain = openedOf(await openPdfRange(bytes), APP.name);
  const unsliced = performance.now() - t0;
  const s = stretches();
  s.mark();
  const y = openedOf(await openPdfRange(bytes, { yieldNow: s.yieldNow }), `${APP.name} with yieldNow`);
  s.end();
  console.log(`R45 ${APP.name}: the open without yieldNow is one stretch of ${Math.round(unsliced)} ms; with it ${s.calls} yields, longest stretch ${s.longest.toFixed(1)} ms (bar ${STRETCH_BAR_MS} ms)`);
  assert.ok(s.calls >= 80, `${s.calls} yields`);
  assert.ok(s.longest < STRETCH_BAR_MS, `the longest stretch was ${s.longest.toFixed(1)} ms`);
  /** @type {PdfRangeArgs[]} */
  const realCuts = [{ from: 0, count: 100 }, { from: 1300, count: 100 }, { from: 650, count: 1 }];
  for (const args of realCuts) {
    assert.equal(JSON.stringify(await y.range(args)), JSON.stringify(await plain.range(args)), JSON.stringify(args));
  }
});
