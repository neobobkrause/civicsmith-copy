/* pdf-reader: requirement-named tests for the PdfDoc reader and the module's
 * invariants (build/requirements/pdf-reader.md R18-R25, R27-R29, R37), at the
 * module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PdfDoc, openPdf, extractPdfStructure, pdfPageImages, pageShowsText, PRODUCER_DETERMINATIONS,
} from "../../../src/pdfstructure.mjs";
import { build, doc, flate, flateRaw, bytesOf } from "./pdf.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfValue, PdfRef, PdfName, PdfStr, PdfArr, PdfMap, PdfObjectEntry, LinkRecord } from "../../../src/pdfstructure.mjs" */
/** @import { Objects, StreamBody } from "./pdf.mjs" */

/** A value that is there; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined || v === null) throw new Error(`${what}: none`);
  return v;
}
/** The reading of a PDF; a thrown failure when the answer is a refusal.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
function readingOf(r) {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}
/** A document opened; a thrown failure when the bytes are not a PDF.
 *  @param {PdfDoc | null} d
 *  @returns {PdfDoc} */
const opened = (d) => must(d, "openPdf");
/** A document's page count, read afresh at each call.
 *  @param {PdfDoc} d
 *  @returns {number} */
const pagesOf = (d) => d.pageCount;
/** A name value; a thrown failure naming `what` when `v` is not a name.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfName} */
function nameOf(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "name") throw new Error(`${what}: not a name`);
  return v;
}
/** A string value; a thrown failure naming `what` when `v` is not a string.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfStr} */
function strValue(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "str") throw new Error(`${what}: not a string`);
  return v;
}
/** An array value; a thrown failure naming `what` when `v` is not an array.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfArr} */
function arrOf(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "arr") throw new Error(`${what}: not an array`);
  return v;
}
/** The map of a dictionary value; a thrown failure naming `what` when `v` is not a dictionary.
 *  @param {PdfValue | undefined} v
 *  @param {string} what
 *  @returns {PdfMap} */
function dictMap(v, what) {
  if (v === null || v === undefined || typeof v !== "object" || v.t !== "dict") throw new Error(`${what}: not a dictionary`);
  return v.map;
}
/** The text of decoded or raw bytes, read as Latin-1; a thrown failure naming `what` when there are none.
 *  @param {Uint8Array | null} u8
 *  @param {string} what
 *  @returns {string} */
const latin1 = (u8, what) => Buffer.from(must(u8, what)).toString("latin1");

/** The `dest` of a record's target, undefined when its target has none.
 *  @param {LinkRecord} l
 *  @returns {string | null | undefined} */
const destOf = (l) => (l.partition === "anchor" || l.partition === "undetermined" ? l.target.dest : undefined);

/** @param {number} n
 *  @returns {PdfRef} */
const ref = (n) => ({ t: "ref", n, g: 0 });
/** @type {StreamBody} */
const IMG = { dict: "/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", data: "\x80" };

test("R18: new PdfDoc holds the bytes; scanTopLevel, loadObjectStreams and buildPageIndex are R8's three steps", async () => {
  const bytes = doc([{ content: "" }, { content: "" }]);
  const d = new PdfDoc(bytes);
  assert.equal(d.bytes, bytes);
  assert.equal(d.pageCount, 0);
  assert.equal(d.dictOf(ref(100)), null);   // nothing read yet
  d.scanTopLevel();
  assert.equal(nameOf(must(d.dictOf(ref(100)), "object 100").Type, "Type").v, "Page");
  await d.loadObjectStreams();
  d.buildPageIndex();
  assert.equal(pagesOf(d), 2);
  assert.equal(nameOf(must(d.pageDict(1), "page 1").Type, "Type").v, "Page");
});

test("R19: pageCount is 0 before buildPageIndex and for a document with no pages, else the page-order length", async () => {
  const d = new PdfDoc(doc([{ content: "" }, { content: "" }, { content: "" }]));
  d.scanTopLevel(); await d.loadObjectStreams();
  assert.equal(pagesOf(d), 0);
  d.buildPageIndex();
  assert.equal(pagesOf(d), 3);
  const none = opened(await openPdf(build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [] >>" })));
  assert.equal(none.pageCount, 0);
  assert.equal(none.pageDict(0), null);
});

test("R20: resolve follows a reference chain; unresolvable or cyclic chains are null; non-references pass through", async () => {
  const d = opened(await openPdf(build({ 5: "6 0 R", 6: "7 0 R", 7: "42", 8: "9 0 R", 9: "8 0 R", 10: "/Name" })));
  assert.equal(d.resolve(ref(5)), 42);
  assert.deepEqual(d.resolve(ref(10)), { t: "name", v: "Name" });
  assert.equal(d.resolve(ref(99)), null);
  assert.equal(d.resolve(ref(8)), null);
  assert.equal(d.resolve(3), 3);
  assert.equal(d.resolve(true), true);
  assert.equal(d.resolve(null), null);
  assert.equal(d.resolve(undefined), null);
  /* a string value carries its bytes (R38) */
  /** @type {PdfStr} */
  const v = { t: "str", v: "x", raw: bytesOf("x") };
  assert.equal(d.resolve(v), v);
});

test("R21: dictOf gives a dict's or a stream's map, else null", async () => {
  const d = opened(await openPdf(build({ 5: "<< /A 1 >>", 6: { dict: "/B 2", data: "x" }, 7: "12", 8: "[1 2]", 9: "5 0 R" })));
  assert.equal(must(d.dictOf(ref(5)), "object 5").A, 1);
  assert.equal(must(d.dictOf(ref(9)), "object 9").A, 1);
  assert.equal(must(d.dictOf(ref(6)), "object 6").B, 2);
  /** @type {(PdfValue | undefined)[]} */
  const others = [ref(7), ref(8), ref(99), 3, null, undefined, { t: "name", v: "A" }];
  for (const v of others) assert.equal(d.dictOf(v), null);
});

test("R22: streamRawBytes reads by an agreeing /Length, else scans to endstream; null for a non-stream or no endstream", async () => {
  const d = opened(await openPdf(build({
    5: { data: "exact bytes" },
    6: { data: "wrong length", length: 3 },
    7: { data: "no length", length: null },
    /* the indirect /Length written in the dictionary, the same bytes `length: "9 0 R"` wrote */
    8: { dict: " /Length 9 0 R", data: "count is 9 0 R", length: null },
    9: "14",
    10: "<< /Not /AStream >>",
  })));
  /** @param {number} n
   *  @returns {string} */
  const s = (n) => latin1(d.streamRawBytes(d.resolve(ref(n))), `object ${n}`);
  assert.equal(s(5), "exact bytes");
  assert.equal(s(6), "wrong length");
  assert.equal(s(7), "no length");
  assert.equal(s(8), "count is 9 0 R");
  assert.equal(d.streamRawBytes(d.resolve(ref(10))), null);
  assert.equal(d.streamRawBytes(null), null);
  assert.equal(d.streamRawBytes(42), null);
  const open = opened(await openPdf(build({ 5: { data: "never closed", length: null, noEnd: true } }, { trailer: "" })));
  assert.equal(open.streamRawBytes(open.resolve(ref(5))), null);
});

test("R22: streamDecoded: unfiltered raw; Flate (zlib or raw deflate), PNG-un-predicted; null for other filters or failure", async () => {
  const rows = "\x02\x01\x02\x03\x02\x01\x01\x01";          // PNG Up, 3 columns
  const d = opened(await openPdf(build({
    5: { data: "plain" },
    6: { dict: "/Filter /FlateDecode", data: flate("zlib body") },
    7: { dict: "/Filter [/Fl]", data: flateRaw("raw body") },
    8: { dict: "/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 3 >>", data: flate(rows) },
    9: { dict: "/Filter /DCTDecode", data: "\xff\xd8" },
    10: { dict: "/Filter [/FlateDecode /ASCIIHexDecode]", data: flate("x") },
    11: { dict: "/Filter /FlateDecode", data: "not deflate at all" },
    12: { dict: "/Filter /FlateDecode /DecodeParms [<< /Predictor 12 /Columns 3 >>]", data: flate(rows) },
  })));
  /** @param {number} n
   *  @returns {Promise<Uint8Array | null>} */
  const dec = async (n) => d.streamDecoded(d.resolve(ref(n)));
  /** @param {number} n
   *  @returns {Promise<string>} */
  const txt = async (n) => latin1(await dec(n), `object ${n}`);
  assert.equal(await txt(5), "plain");
  assert.equal(await txt(6), "zlib body");
  assert.equal(await txt(7), "raw body");
  assert.deepEqual([...must(await dec(8), "object 8")], [1, 2, 3, 2, 3, 4]);
  assert.deepEqual([...must(await dec(12), "object 12")], [1, 2, 3, 2, 3, 4]);
  for (const n of [9, 10, 11]) assert.equal(await dec(n), null, String(n));
  assert.equal(await d.streamDecoded(null), null);
});

test("R23: isEncrypted is true exactly when a /Filter /Standard dict carries a numeric /R; cached", async () => {
  const enc = opened(await openPdf(build({ 5: "<< /Filter /Standard /V 1 /R 3 /O (o) /U (u) /P -4 >>" })));
  assert.equal(enc.isEncrypted(), true);
  assert.equal(enc.isEncrypted(), true);
  for (const body of ["<< /Filter /Standard /V 1 >>", "<< /Filter /Standard /R (3) >>",
                      "<< /Filter [/FlateDecode] /R 3 >>", "<< /Filter /FlateDecode /R 3 >>"]) {
    assert.equal(opened(await openPdf(build({ 5: body }))).isEncrypted(), false, body);
  }
});

test("R24: pure — no network, no clock, and the same bytes always give the same output", async () => {
  const bytes = doc([{ content: "BT /F1 10 Tf (Hello) Tj ET q 10 0 0 10 0 0 cm /I Do Q", resources: "/Font << /F1 10 0 R >> /XObject << /I 20 0 R >>", extra: "/Annots [30 0 R]" }],
    { objs: { 20: IMG, 30: "<< /Subtype /Link /Rect [0 0 1 1] /A << /S /URI /URI (https://example.org/) >> >>", 91: "<< /Producer (Tesseract) >>" },
      trailer: "trailer\n<< /Root 1 0 R /Info 91 0 R >>\n" });
  const saved = { fetch: globalThis.fetch, now: Date.now, perf: performance.now };
  const boom = () => { throw new Error("impure call"); };
  globalThis.fetch = boom; Date.now = boom; performance.now = boom;
  try {
    const a = await extractPdfStructure(bytes);
    const b = await extractPdfStructure(bytes.slice());
    assert.deepEqual(a, b);
    const d = opened(await openPdf(bytes));
    assert.deepEqual(await pdfPageImages(d, 0), await pdfPageImages(opened(await openPdf(bytes)), 0));
    assert.equal(await pageShowsText(d, d.pageDict(0)), true);
  } finally {
    globalThis.fetch = saved.fetch; Date.now = saved.now; performance.now = saved.perf;
  }
});

test("R25: a Flate stream with bytes after its end still decodes; the trailing-byte count is noted", async () => {
  const junk = new Uint8Array([...flate("BT /F1 10 Tf (kept) Tj ET"), ...bytesOf("\r\nJUNK")]);
  const r = readingOf(await extractPdfStructure(doc([{ content: { dict: "/Filter /FlateDecode", data: junk } }])));
  assert.equal(must(r.text.pages[0], "page 0").text, "kept");
  assert.deepEqual(must(r.text.pages[0], "page 0").undetermined, []);
  assert.deepEqual(r.notes.filter((n) => n.startsWith("flate_trailing_bytes")), ["flate_trailing_bytes:6"]);
  assert.deepEqual(r.images, []);
  const d = opened(await openPdf(doc([{ content: { dict: "/Filter /FlateDecode", data: junk } }])));
  assert.equal(latin1(await d.streamDecoded(d.resolve(ref(101))), "object 101"), "BT /F1 10 Tf (kept) Tj ET");
});

test("R25: a page whose content cannot be read carries a page-level marker, never reads as blank", async () => {
  const whole = flate("BT /F1 10 Tf (lost) Tj ET");
  const truncated = whole.subarray(0, whole.length - 5);
  /* `content` absent: with `contents` given, no content object is written (as `content: null` was) */
  const r = readingOf(await extractPdfStructure(doc([
    { content: { dict: "/Filter /FlateDecode", data: truncated } },
    { contents: "99 0 R" },
    { contents: "[97 0 R 98 0 R]" },
    { content: { dict: "/Filter /DCTDecode", data: "x" } },
    { contents: "" },
  ], { objs: { 97: { data: "" } } })));
  const reasons = r.text.pages.map((p) => p.undetermined.map((m) => m.reason));
  assert.deepEqual(reasons, [["content_stream_undecodable"], ["content_stream_unresolvable"],
    ["content_stream_unresolvable"], ["content_stream_undecodable"], []]);
  for (const p of r.text.pages.slice(0, 4)) {
    const first = must(p.undetermined[0], `page ${p.page}'s first marker`);
    assert.deepEqual(first, { page: p.page, reason: first.reason, font: null, codes: "", count: 0 });
  }
  assert.ok(r.notes.includes("content_stream_undecodable"));
});

test("R27: every undetermined, why and reason names its kind — never a bare false or empty standing for every cause", async () => {
  /** @type {Objects} */
  const objs = { 20: IMG, 21: "<< /Type /Font /Subtype /Type1 >>" };
  const fixtures = [
    doc([{ content: "BT (a) Tj /X 1 Tf (b) Tj /N 1 Tf (c) Tj ET", resources: "/Font << /N 21 0 R >>" }], { objs }),
    doc([{ content: "q 600 0 0 800 0 0 cm /I Do Q", resources: "/XObject << /I 20 0 R >>" }], { objs }),
    doc([{ content: { dict: "/Filter /FlateDecode", data: "bad" } }, { content: "/Gone Do" }], { objs }),
    doc([{ content: "", extra: "/Annots [30 0 R 31 0 R 32 0 R]" }],
      { objs: { 30: "<< /Subtype /Link /Dest /none >>", 31: "<< /Subtype /Link >>", 32: "<< /Subtype /FileAttachment /FS 99 0 R >>" } }),
  ];
  /** @param {unknown} v
   *  @returns {boolean} */
  const named = (v) => typeof v === "string" && /^[a-z][a-z0-9_]*[a-z0-9](:.*)?$/i.test(v);
  let seen = 0;
  for (const f of fixtures) {
    const r = readingOf(await extractPdfStructure(f));
    for (const m of r.text.undetermined) { assert.ok(named(m.reason), JSON.stringify(m)); seen++; }
    for (const l of r.links) if (l.partition === "undetermined") { assert.ok(named(l.target.why), JSON.stringify(l)); seen++; }
    for (const l of r.links) {
      const why = must(l.anchor, "anchor").why;
      if (why !== null) { assert.ok(named(why), JSON.stringify(l)); seen++; }
    }
    if (r.images === null) { assert.ok(named(r.imagesWhy), r.imagesWhy); seen++; }
    assert.ok(named(r.text.producer.why) || r.text.producer.why === null);
    // a page with no text and no marker never showed text this reader could have read
    for (const p of r.text.pages) if (!p.text && !p.undetermined.length) {
      const d = opened(await openPdf(f));
      assert.notEqual(await pageShowsText(d, d.pageDict(p.page)), true);
    }
  }
  assert.equal(seen, 13);
});

test("R28: producer.determination is only ever 'ocr' with a named engine, or 'undetermined' — never 'authored'", async () => {
  assert.deepEqual([...PRODUCER_DETERMINATIONS], ["ocr", "undetermined"]);
  assert.ok(Object.isFrozen(PRODUCER_DETERMINATIONS));
  const infos = ["<< /Producer (Tesseract) >>", "<< /Producer (Word Processor) /Creator (Author Tool) >>", "<< >>",
                 "<< /Creator (ABBYY) >>", "<< /Producer 7 >>"];
  for (const info of infos) {
    const { producer } = readingOf(await extractPdfStructure(doc([{ content: "BT /F1 10 Tf (typed by hand) Tj ET" }],
      { objs: { 91: info }, trailer: "trailer\n<< /Root 1 0 R /Info 91 0 R >>\n" }))).text;
    assert.ok(PRODUCER_DETERMINATIONS.includes(producer.determination), info);
    if (producer.determination === "ocr") {
      const ocr = must(producer.ocr, "ocr");
      assert.ok(ocr.engine && [producer.producer, producer.creator].includes(ocr.engine));
      assert.equal(producer.why, null);
    } else {
      assert.equal(producer.ocr, null);
      assert.ok(producer.why);
    }
  }
});

test("R29: the general parameters (0.25 em, 0.1 em, form depth 8, the OCR table) act on hand-built fixtures, with no jurisdiction supplied", async () => {
  /** @param {string} c
   *  @returns {Promise<string>} */
  const line = async (c) => readingOf(await extractPdfStructure(doc([{ content: c }]))).text.document;
  assert.equal(await line("BT /F1 10 Tf 0 0 Td (ab) Tj 12.5 0 Td (cd) Tj ET"), "abcd");
  assert.equal(await line("BT /F1 10 Tf 0 0 Td (ab) Tj 12.6 0 Td (cd) Tj ET"), "ab cd");
  assert.equal(await line("BT /F1 10 Tf [(ab) -100 (cd)] TJ ET"), "abcd");
  assert.equal(await line("BT /F1 10 Tf [(ab) -101 (cd)] TJ ET"), "ab cd");
  /** @param {number} n
   *  @returns {Uint8Array} */
  const chain = (n) => {
    /** @type {Objects} */
    const objs = {};
    for (let k = 1; k <= n; k++) objs[19 + k] = { dict: `/Subtype /Form /Resources << /Font << /F1 10 0 R >> ${k < n ? `/XObject << /Fm ${20 + k} 0 R >>` : ""} >>`, data: k < n ? "/Fm Do" : "BT /F1 10 Tf (z) Tj ET" };
    return doc([{ content: "/Fm Do", resources: "/XObject << /Fm 20 0 R >>" }], { objs });
  };
  assert.equal(readingOf(await extractPdfStructure(chain(8))).text.document, "z");
  assert.equal(must(readingOf(await extractPdfStructure(chain(9))).text.undetermined[0], "marker 0").reason, "form_text_unread");
  const p = readingOf(await extractPdfStructure(doc([{ content: "" }], { objs: { 91: "<< /Producer (readiris 17) >>" }, trailer: "trailer\n<< /Root 1 0 R /Info 91 0 R >>\n" }))).text.producer;
  assert.equal(must(p.ocr, "ocr").marker, "readiris");
});

/* R37: what `objects()` answers for a document, made comparable: the trailer as a
   plain object, and each listed object beside the value `resolve` gives for it. */
/** @param {PdfMap} m
 *  @returns {PdfMap} */
const plain = (m) => ({ ...m });
/** @param {PdfObjectEntry[]} list
 *  @returns {number[]} */
const nums = (list) => list.map((o) => o.num);

test("R37: objects() is the last trailer and every object reachable from it, each once, ascending, valued as resolve answers it", async () => {
  const bytes = build({
    1: "<< /Type /Catalog /Pages 2 0 R /Extra [5 0 R << /Deep 8 2 R >> 9 3 R 5 0 R] >>",
    2: "<< /Type /Pages /Kids [3 0 R] /Count 1 /Back 1 0 R >>",  // a cycle of dictionaries
    3: "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>",
    4: { data: "BT ET" },
    5: "6 0 R",                                                  // a chain of bare references
    6: "42",
    8: "<< /Old true >>",
    20: "<< /Producer (first revision) >>",
    30: "<< /Orphan true >>",
  }, { trailer: "trailer\n<< /Root 1 0 R /Info 20 0 R >>\n",
       tail: "8 2 obj\n0\nendobj\n9 3 obj\n<< /Gen 3 >>\nendobj\n21 0 obj\n<< /Producer (second) >>\nendobj\n"
           + "trailer\n<< /Root 1 0 R /Info 21 0 R /Prev 9 >>\n" });
  const d = opened(await openPdf(bytes));
  const got = must(d.objects(), "objects()");
  assert.deepEqual(Object.keys(got).sort(), ["objects", "trailer", "unresolved"]);
  assert.deepEqual(plain(got.trailer), { Root: ref(1), Info: ref(21), Prev: 9 });
  // the earlier revision's /Info (20) and an object nothing names (30) are not reachable
  assert.deepEqual(nums(got.objects), [1, 2, 3, 4, 5, 6, 8, 9, 21]);
  for (const o of got.objects) {
    assert.deepEqual(Object.keys(o), ["num", "gen", "value"]);
    assert.equal(o.value, d.resolve({ t: "ref", n: o.num, g: o.gen }), `object ${o.num}`);
  }
  /** @param {number} n
   *  @returns {PdfObjectEntry} */
  const by = (n) => must(got.objects.find((o) => o.num === n), `object ${n}`);
  assert.deepEqual([by(5).value, by(6).value], [42, 42]);
  assert.deepEqual([by(8).gen, by(8).value], [2, 0]);  // the later definition wins, with its own generation
  assert.equal(by(9).gen, 3);
  assert.equal(by(1).gen, 0);
  assert.equal(latin1(await d.streamDecoded(by(4).value), "object 4"), "BT ET");
  assert.deepEqual(got.unresolved, []);
});

test("R37: an xref stream's own dict is the trailer when it is last; objects in an object stream are listed as any other", async () => {
  /** @type {[string, string]} */
  const inner = ["<< /Producer (packed) >>", "[62 0 R]"];
  const header = `60 0 61 ${inner[0].length + 1} `;
  /** @type {Objects} */
  const objs = {
    1: "<< /Type /Catalog /Pages 2 0 R /Meta 61 0 R >>",
    2: "<< /Type /Pages /Kids [] >>",
    62: "(loose)",
    70: { dict: `/Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode`, data: flate(header + inner.join(" ")) },
    95: { dict: "/Type /XRef /Root 1 0 R /Info 60 0 R /W [1 2 1] /Size 96", data: "" },
  };
  const d = opened(await openPdf(build(objs, { trailer: "" })));
  const got = must(d.objects(), "objects()");
  assert.deepEqual(plain(got.trailer), { Type: { t: "name", v: "XRef" }, Root: ref(1), Info: ref(60), W: { t: "arr", items: [1, 2, 1] }, Size: 96, Length: 0 });
  assert.deepEqual(nums(got.objects), [1, 2, 60, 61, 62]);   // neither the container (70) nor the xref stream (95)
  const third = must(got.objects[2], "objects[2]");
  assert.equal(strValue(dictMap(third.value, "objects[2]").Producer, "Producer").v, "packed");
  assert.equal(third.gen, 0);
  assert.deepEqual(got.unresolved, []);
  // file order decides between the two shapes, as R10's choice does
  const classicFirst = opened(await openPdf(build(objs, { header: "%PDF-1.7\ntrailer\n<< /Root 2 0 R >>\n", trailer: "" })));
  assert.equal(nameOf(plain(must(classicFirst.objects(), "objects()").trailer).Type, "Type").v, "XRef");
  const classicLast = opened(await openPdf(build(objs, { trailer: "trailer\n<< /Root 2 0 R >>\n" })));
  assert.deepEqual(plain(must(classicLast.objects(), "objects()").trailer), { Root: ref(2) });
  assert.deepEqual(nums(must(classicLast.objects(), "objects()").objects), [2]);
});

test("R37: every reference on those chains that cannot be resolved is listed once as {num, gen}", async () => {
  /** @type {StreamBody} */
  const bad = { dict: "/Type /ObjStm /N 1 /First 5 /Filter /FlateDecode", data: "not deflate" };  // would hold 61
  const d = opened(await openPdf(build({
    1: "<< /Type /Catalog /Pages 2 0 R /A [99 3 R 99 3 R 61 0 R 80 0 R 82 0 R] /B << /C 83 0 R >> >>",
    2: "<< /Type /Pages /Kids [] /Again 99 3 R >>",
    70: bad,
    80: "81 0 R",   // a cycle of bare references: neither resolves
    81: "80 0 R",
    82: "null",     // resolves to nothing
    83: "<< /Next 84 1 R >>",
  }, { trailer: "trailer\n<< /Root 1 0 R /Encrypt 98 0 R >>\n" })));
  const got = must(d.objects(), "objects()");
  assert.deepEqual(nums(got.objects), [1, 2, 83]);
  assert.deepEqual(got.unresolved, [{ num: 61, gen: 0 }, { num: 80, gen: 0 }, { num: 81, gen: 0 },
    { num: 82, gen: 0 }, { num: 84, gen: 1 }, { num: 98, gen: 0 }, { num: 99, gen: 3 }]);
  for (const u of got.unresolved) assert.equal(d.resolve({ t: "ref", n: u.num, g: u.gen }), null);
});

test("R37: null when no trailer can be read; a long chain is walked whole; never throws", async () => {
  assert.equal(opened(await openPdf(build({ 1: "<< /Type /Catalog >>" }, { trailer: "" }))).objects(), null);
  assert.equal(opened(await openPdf(build({ 1: "<< /Type /Catalog >>" }, { trailer: "trailer\n[1 0 R]\n" }))).objects(), null);
  /** @type {Objects} */
  const chain = {};
  for (let k = 1; k <= 5000; k++) chain[k] = k < 5000 ? `<< /Next ${k + 1} 0 R >>` : "<< /End true >>";
  const long = must(opened(await openPdf(build(chain, { trailer: "trailer\n<< /Root 1 0 R >>\n" }))).objects(), "objects()");
  assert.equal(long.objects.length, 5000);
  assert.deepEqual(long.unresolved, []);
  const good = build({ 1: "<< /Type /Catalog /Pages 2 0 R >>", 2: "<< /Type /Pages /Kids [3 0 R] >>", 3: "<< /Type /Page /Parent 2 0 R >>" },
    { trailer: "trailer\n<< /Root 1 0 R /Size 4 >>\n" });
  for (let n = 0; n <= good.length; n += 3) {
    const d = await openPdf(good.subarray(0, n));
    const got = d && d.objects();
    assert.ok(got === null || (got && Array.isArray(got.objects) && Array.isArray(got.unresolved)), `cut at ${n}`);
  }
  let seed = 11;
  /** @returns {number} */
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 0xff;
  for (let k = 0; k < 40; k++) {
    const u = new Uint8Array([...bytesOf("%PDF-1.7\ntrailer << /Root 1 0 R >>\n"), ...new Uint8Array(300).map(rnd)]);
    const got = opened(await openPdf(u)).objects();
    assert.ok(got === null || Array.isArray(got.objects));
  }
  assert.doesNotThrow(() => new PdfDoc(good).objects());   // before any read step: answers, never throws
});

/* R38: a string value is {t:"str", v, raw}. `strOf` reads object 5's string; `again` writes `raw` back as a hex
   string into a fresh file and reads it, the trip a rewrite makes. */
/** @param {string} body
 *  @param {Objects} [objs]
 *  @returns {Promise<PdfStr>} */
const strOf = async (body, objs = {}) => {
  /** @type {Objects} */
  const all = { 5: body };
  for (const [n, o] of Object.entries(objs)) all[n] = o;
  return strValue(opened(await openPdf(build(all))).resolve(ref(5)), "object 5");
};
/** @param {Uint8Array} u8
 *  @returns {string} */
const hexOf = (u8) => "<" + Buffer.from(u8).toString("hex") + ">";
/** @param {PdfStr} s
 *  @returns {Promise<PdfStr>} */
const again = async (s) => strOf(hexOf(s.raw));
const ALL = Uint8Array.from({ length: 256 }, (_, i) => i);
/** @param {Uint8Array | number[]} u8
 *  @returns {string} */
const unitPerByte = (u8) => String.fromCharCode(...u8);

test("R38: a binary string's raw is its exact bytes, all 256 values, and survives a write-back of raw byte for byte", async () => {
  // every byte, octal-escaped in a literal and as hex digits
  const octal = "(" + [...ALL].map((b) => "\\" + b.toString(8).padStart(3, "0")).join("") + ")";
  for (const body of [octal, hexOf(ALL)]) {
    const s = await strOf(body);
    assert.deepEqual(Object.keys(s).sort(), ["raw", "t", "v"]);
    assert.equal(s.t, "str");
    assert.ok(s.raw instanceof Uint8Array);
    assert.deepEqual(s.raw, ALL);
    assert.equal(s.v, unitPerByte(ALL));               // no FE FF mark: each byte one code unit, 0x80-0x9F included
    const back = await again(s);
    assert.deepEqual(back.raw, ALL);
    assert.equal(back.v, s.v);
  }
  // every byte written as itself between the parentheses, but the four the syntax reserves (\ ( ) CR), escaped
  const bytes = [...ALL].flatMap((b) => (b === 0x5c || b === 0x28 || b === 0x29 ? [0x5c, b] : b === 0x0d ? [0x5c, 0x72] : [b]));
  const d = opened(await openPdf(build({ 5: Buffer.from([0x28, ...bytes, 0x29]).toString("latin1") })));
  const lit = strValue(d.resolve(ref(5)), "object 5");
  assert.deepEqual(lit.raw, ALL);
  assert.deepEqual((await again(lit)).raw, ALL);
  // a binary /ID in the trailer and an encryption dict's /O, /U read as bytes too
  const id = Uint8Array.from([0x80, 0x9f, 0x00, 0xfe, 0xff, 0x0d, 0x0a, 0x8d]);
  const t = must(opened(await openPdf(build({ 1: "<< /Type /Catalog >>", 7: `<< /Filter /Standard /R 3 /O ${hexOf(id)} /U (\\200\\237\\000) >>` },
    { trailer: `trailer\n<< /Root 1 0 R /ID [${hexOf(id)} (\\200\\237)] >>\n` }))).objects(), "objects()");
  const ids = arrOf(t.trailer.ID, "ID").items;
  assert.deepEqual(strValue(ids[0], "ID[0]").raw, id);
  assert.deepEqual(strValue(ids[1], "ID[1]").raw, Uint8Array.from([0x80, 0x9f]));
  const enc = must(opened(await openPdf(build({ 7: `<< /Filter /Standard /R 3 /O ${hexOf(id)} /U (\\200\\237\\000) >>` }))).dictOf(ref(7)), "object 7");
  assert.deepEqual([strValue(enc.O, "O").raw, strValue(enc.U, "U").raw], [id, Uint8Array.from([0x80, 0x9f, 0x00])]);
});

test("R38: a literal's escapes are decoded per the PDF syntax, and an unescaped end-of-line is one 0x0A", async () => {
  /** @type {[string, number[]][]} */
  const cases = [
    ["(\\n\\r\\t\\b\\f\\(\\)\\\\)", [0x0a, 0x0d, 0x09, 0x08, 0x0c, 0x28, 0x29, 0x5c]],
    ["(\\0\\12\\101\\1012\\777\\8)", [0x00, 0x0a, 0x41, 0x41, 0x32, 0xff, 0x38]],     // 1-3 octal digits; high bit dropped; \8 unknown
    ["(a\\q\\ b)", [0x61, 0x71, 0x20, 0x62]],                                            // unknown escape: the character, no backslash
    ["(a\\\nb\\\r\nc\\\rd)", [0x61, 0x62, 0x63, 0x64]],                                   // continuation: LF, CR LF, CR
    ["(a\nb\r\nc\rd\n\re)", [0x61, 0x0a, 0x62, 0x0a, 0x63, 0x0a, 0x64, 0x0a, 0x0a, 0x65]], // EOL: LF, CR LF, CR each one 0x0A; LF CR two
    ["(x(y(z))w)", [...Buffer.from("x(y(z))w")]],                                          // balanced parentheses kept
    ["()", []],
  ];
  for (const [body, want] of cases) {
    const s = await strOf(body);
    assert.deepEqual(s.raw, Uint8Array.from(want), body);
    assert.equal(s.v, unitPerByte(want), body);
    assert.deepEqual((await again(s)).raw, s.raw, body);
  }
  // an unterminated literal reads to the end of what is there and never throws
  const d = opened(await openPdf(bytesOf("%PDF-1.7\n5 0 obj\n(abc\\")));
  assert.deepEqual(strValue(d.resolve(ref(5)), "object 5").raw, Uint8Array.from([0x61, 0x62, 0x63]));
});

test("R38: an odd-length hex string's final digit is read as followed by 0; whitespace between digits is skipped", async () => {
  /** @type {[string, number[]][]} */
  const hexCases = [["<901fa>", [0x90, 0x1f, 0xa0]], ["<7>", [0x70]], ["<>", []], ["< 41 4 2\n43\t>", [0x41, 0x42, 0x43]],
                    ["<FEFF00>", [0xfe, 0xff, 0x00]], ["<fEfF004>", [0xfe, 0xff, 0x00, 0x40]]];
  for (const [body, want] of hexCases) {
    const s = await strOf(body);
    assert.deepEqual(s.raw, Uint8Array.from(want), body);
    const back = await again(s);
    assert.deepEqual(back.raw, s.raw, body);
    assert.equal(back.v, s.v, body);
  }
  assert.equal((await strOf("<901fa>")).v, "\x90\x1f\xa0");
  // an odd-length UTF-16 string: its text has the whole units, its raw every byte
  const odd = await strOf("<FEFF00410042C3>");
  assert.equal(odd.v, "AB");
  assert.deepEqual(odd.raw, Uint8Array.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42, 0xc3]));
  assert.deepEqual((await again(odd)).raw, odd.raw);
});

test("R38: after FE FF the text is UTF-16BE, surrogate pairs included; the mark alone is the whole of the rule", async () => {
  const text = "Ünïcødé ✓ \u{1F600} \u0080\u009f";
  const be = Buffer.from(text, "utf16le").swap16();
  const raw = Uint8Array.from([0xfe, 0xff, ...be]);
  for (const body of [hexOf(raw), "(" + [...raw].map((b) => "\\" + b.toString(8).padStart(3, "0")).join("") + ")"]) {
    const s = await strOf(body);
    assert.equal(s.v, text);
    assert.deepEqual(s.raw, raw);
    const back = await again(s);
    assert.deepEqual(back.raw, raw);
    assert.equal(back.v, text);
  }
  // FF FE (little-endian mark) and FE alone are not the mark: one unit per byte
  assert.equal((await strOf("<FFFE4100>")).v, "\xff\xfe\x41\x00");
  assert.equal((await strOf("<FE41>")).v, "\xfeA");
  assert.equal((await strOf("<FEFF>")).v, "");
});

test("R38: every string the reader answers carries raw: in arrays, dicts, object streams, and those the services read", async () => {
  const inner = "<< /S (\\200in) /A [<9f> (x)] >>";
  const header = "61 0 ";
  const d = opened(await openPdf(build({
    1: "<< /Type /Catalog /Pages 2 0 R /Names << /Dests 40 0 R >> >>",
    2: "<< /Type /Pages /Kids [] >>",
    5: "<< /K (\\224) /L [(\\225) << /M <96> >>] >>",
    40: "<< /Names [(\\223dest\\224) [0 /Fit]] >>",
    70: { dict: `/Type /ObjStm /N 1 /First ${header.length} /Filter /FlateDecode`, data: flate(header + inner) },
  })));
  const m = must(d.dictOf(ref(5)), "object 5");
  const K = strValue(m.K, "K");
  const L = arrOf(m.L, "L").items;
  const L0 = strValue(L[0], "L[0]");
  const M = strValue(dictMap(L[1], "L[1]").M, "M");
  assert.deepEqual([K.raw, L0.raw, M.raw].map((r) => [...r]), [[0x94], [0x95], [0x96]]);
  assert.deepEqual([K.v, L0.v, M.v], ["\x94", "\x95", "\x96"]);
  const p = must(d.dictOf(ref(61)), "object 61");
  assert.deepEqual([[...strValue(p.S, "S").raw], [...strValue(arrOf(p.A, "A").items[0], "A[0]").raw]], [[0x80, 0x69, 0x6e], [0x9f]]);
  assert.equal(strValue(p.S, "S").v, "\x80in");
  // the reader's own services read v as R38 states it: a named destination with 0x93/0x94 bytes resolves by it
  const r = readingOf(await extractPdfStructure(doc([{ content: "", extra: "/Annots [30 0 R]" }],
    { catalog: "/Names << /Dests 40 0 R >>", objs: { 30: "<< /Subtype /Link /Rect [0 0 1 1] /Dest (\\223dest\\224) >>", 40: "<< /Names [(\\223dest\\224) [0 /Fit]] >>" } })));
  const link = must(r.links[0], "link 0");
  assert.deepEqual([link.partition, destOf(link)], ["anchor", "\x93dest\x94"]);
});

test("R22: streamDecoded answers a Promise and never rejects; streamRawBytes never throws", async () => {
  const d = opened(await openPdf(build({ 5: { dict: "/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 99999999999 /Colors -3 >>", data: flate("abcdef") } })));
  /** The document, through a view whose stream readers are asked with values that are not stream values as well.
   *  @type {{ streamDecoded(v: unknown, kind?: string): Promise<Uint8Array | null>, streamRawBytes(v: unknown): Uint8Array | null }} */
  const asked = d;
  const bad = [undefined, null, 0, "x", {}, { t: "stream" }, { t: "stream", dict: null }, { t: "stream", dict: {}, start: -1 },
    { t: "stream", dict: {}, start: 1.5 }, { t: "stream", dict: {}, start: 1e12 }, { t: "stream", dict: { Filter: 5 }, start: 0 },
    { t: "stream", dict: { Length: { t: "ref", n: 1, g: 0 } }, start: "9" }];
  for (const v of bad) {
    const p = asked.streamDecoded(v);
    assert.ok(p instanceof Promise, JSON.stringify(v));
    assert.equal(await p, null, JSON.stringify(v) ?? String(v));
    assert.doesNotThrow(() => asked.streamRawBytes(v));
  }
  // parameters no row can satisfy still answer, never reject
  const extreme = d.streamDecoded(d.resolve(ref(5)));
  assert.ok(extreme instanceof Promise);
  const got = await extreme;
  assert.ok(got === null || got instanceof Uint8Array);
  // a PdfDoc over something that is not bytes reads nothing, and still answers
  const empty = new PdfDoc(undefined);
  assert.equal(await empty.streamDecoded({ t: "stream", dict: {}, start: 0 }), null);
  assert.equal(empty.streamRawBytes({ t: "stream", dict: {}, start: 0 }), null);
  // a well-formed stream still decodes to a Promise of its bytes
  const ok = opened(await openPdf(build({ 5: { dict: "/Filter /FlateDecode", data: flate("fine") } })));
  const p = ok.streamDecoded(ok.resolve(ref(5)));
  assert.ok(p instanceof Promise);
  assert.equal(latin1(await p, "object 5"), "fine");
});
