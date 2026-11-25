/* text-chain: requirement-named tests for the content-extent algebra (build/requirements/text-chain.md R92-R98).
 * This module holds the only copy (the catalogue's was deleted at T19's close, K855; N446). Every content id is taken
 * over `canonicalExtent`, so R97 and R98 are each swept over every kind, field and malformation against the
 * requirement's own statement, spelled again below rather than imported. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_EXTENT_KINDS, CONTENT_EXTENT_A1_RE, CONTENT_EXTENT_RANGE_RE, a1ToRowCol, rangeCorners, canonicalRange,
  contentCitedAs, canonicalExtent, describeExtent,
} from "../../../src/textchain.mjs";
import { canonicalJson } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const KINDS = ["document", "pdf-page", "sheet-cell", "slide-shape", "doc-para", "sheet-range", "doc-table", "image"];
const JUNK = [undefined, null, 0, 1, -1, 1.5, NaN, "", " ", "x", true, [], {}, [1, 2], Symbol.for("s"), () => 1,
  Object.create(null)];
/* A message for any input, a prototype-less object and a symbol included. */
const label = (x) => { try { return typeof x === "symbol" ? "symbol" : JSON.stringify(x) ?? String(x); } catch { return "(no string form)"; } };

test("R92: CONTENT_EXTENT_KINDS is the eight landed kinds, in order, each with its human phrase; dom is not one", () => {
  assert.equal(Object.getPrototypeOf(CONTENT_EXTENT_KINDS), Object.prototype);
  assert.deepEqual(Object.keys(CONTENT_EXTENT_KINDS), KINDS);
  assert.deepEqual(CONTENT_EXTENT_KINDS, {
    document: { landed: true, human: word("content.why.whole_document") },
    "pdf-page": { landed: true, human: "a page of a PDF" },
    "sheet-cell": { landed: true, human: word("textchain.text.cell_spreadsheet") },
    "slide-shape": { landed: true, human: word("textchain.text.shape_deck") },
    "doc-para": { landed: true, human: word("textchain.text.paragraph_document") },
    "sheet-range": { landed: true, human: word("textchain.text.range_cells_spreadsheet") },
    "doc-table": { landed: true, human: word("textchain.text.table_document") },
    image: { landed: true, human: word("textchain.text.image_document") },
  });
  assert.equal(Object.hasOwn(CONTENT_EXTENT_KINDS, "dom"), false);
});

test("R93: the A1 cell and range patterns match exactly the stated shapes", () => {
  const cells = ["A1", "b14", "$B$14", "$b14", "B$14", "ZZZ9999999", "xfd1048576", "AB10"];
  const notCells = ["", "A", "1", "A0", "A01", "AAAA1", "A10000000", "1A", "A1:B2", " A1", "A1 ", "$$A1", "A$$1", "A-1", "Ä1"];
  for (const c of cells) { assert.ok(CONTENT_EXTENT_A1_RE.test(c), c); assert.ok(CONTENT_EXTENT_RANGE_RE.test(c), c); }
  for (const c of notCells.filter((x) => x !== "A1:B2")) {
    assert.equal(CONTENT_EXTENT_A1_RE.test(c), false, c);
    assert.equal(CONTENT_EXTENT_RANGE_RE.test(c), false, c);
  }
  assert.equal(CONTENT_EXTENT_A1_RE.test("A1:B2"), false);
  for (const r of ["A1:B2", "$a$1:c$10", "C3:B2", "B3:B3"]) assert.ok(CONTENT_EXTENT_RANGE_RE.test(r), r);
  for (const r of ["A1:", ":B2", "A1:B2:C3", "A:C", "2:5", "A1-B2", "A1 : B2"]) assert.equal(CONTENT_EXTENT_RANGE_RE.test(r), false, r);
});

test("R94: a1ToRowCol answers 1-based {col,row}, the column bijective base 26, $ dropped and case folded; null otherwise", () => {
  const want = { A1: [1, 1], Z1: [26, 1], AA1: [27, 1], AZ1: [52, 1], BA1: [53, 1], ZZ1: [702, 1], AAA1: [703, 1],
    XFD1048576: [16384, 1048576], ZZZ9999999: [18278, 9999999], b14: [2, 14], "$B$14": [2, 14] };
  for (const [cell, [col, row]] of Object.entries(want)) assert.deepEqual(a1ToRowCol(cell), { col, row }, cell);
  /* Every column of one and two letters, against an independent count. */
  let n = 0;
  for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") assert.equal(a1ToRowCol(`${b}1`).col, ++n);
  for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") assert.equal(a1ToRowCol(`${a}${b}1`).col, ++n);
  for (const x of [...JUNK, "A0", "A01", "AAAA1", "1A", "A1:B2", " A1", "A 1"]) assert.equal(a1ToRowCol(x), null, label(x));
});

test("R95: rangeCorners orders the corners, a cell is a one-cell range; canonicalRange spells it with two corners", () => {
  assert.deepEqual(rangeCorners("B2:C3"), { r0: 2, c0: 2, r1: 3, c1: 3 });
  assert.deepEqual(rangeCorners("C3:B2"), { r0: 2, c0: 2, r1: 3, c1: 3 });
  assert.deepEqual(rangeCorners("C2:B3"), { r0: 2, c0: 2, r1: 3, c1: 3 });
  assert.deepEqual(rangeCorners(" b3 "), { r0: 3, c0: 2, r1: 3, c1: 2 });
  assert.deepEqual(rangeCorners("$Z$1:aa$20"), { r0: 1, c0: 26, r1: 20, c1: 27 });
  for (const x of [...JUNK, "A1:", "A:C", "2:5", "A1:B2:C3", "A0:B1"]) {
    assert.equal(rangeCorners(x), null, label(x));
    assert.equal(canonicalRange(x), null, label(x));
  }
  assert.equal(canonicalRange("B3"), "B3:B3");
  assert.equal(canonicalRange("B3:B3"), "B3:B3");
  assert.equal(canonicalRange("$c$10:a1"), "A1:C10");
  assert.equal(canonicalRange("az5:Ba7"), "AZ5:BA7");
  assert.equal(canonicalRange("ZZ1:AAA2"), "ZZ1:AAA2");
  /* Every spelling of one range is one string. */
  assert.equal(new Set(["A1:C10", "a1:c10", "$A$1:$C$10", "C10:A1", "c1:a10", "A10:C1"].map(canonicalRange)).size, 1);
});

test("R96: contentCitedAs is the stated value unchanged, else bytes for an image and text for any other kind", () => {
  for (const kind of KINDS) for (const v of [undefined, null, ""])
    assert.equal(contentCitedAs({ kind, cited_as: v }), kind === "image" ? "bytes" : "text", `${kind} ${v}`);
  for (const v of ["text", "bytes", "neither", 3, false, {}]) assert.equal(contentCitedAs({ kind: "doc-para", cited_as: v }), v);
  for (const x of JUNK) assert.equal(contentCitedAs(x), "text");
  assert.equal(contentCitedAs({ cited_as: "bytes" }), "bytes");
});

test("R97: canonicalExtent is canonicalJson of each arm's fixed fields, absent as null, every spelling of one address one string", () => {
  const C = (o) => canonicalJson(o);
  assert.equal(canonicalExtent({ kind: "document", page: 3, ref: "x" }), C({ kind: "document" }));
  assert.equal(canonicalExtent({ kind: "pdf-page", page: 2, rect: [10, 20, 1, 2], ref: "a" }), C({ kind: "pdf-page", page: 2, rect: [1, 2, 10, 20] }));
  for (const rect of [undefined, [1, 2, 3], [1, 2, 3, NaN], [1, 2, 3, "4"], [1, 2, 3, Infinity]])
    assert.equal(canonicalExtent({ kind: "pdf-page", page: 1.5, rect }), C({ kind: "pdf-page", page: null, rect: null }));
  assert.equal(canonicalExtent({ kind: "sheet-cell", sheet: " S1 ", cell: " $b$14 " }), C({ kind: "sheet-cell", sheet: "S1", cell: "B14" }));
  assert.equal(canonicalExtent({ kind: "sheet-cell", sheet: "  ", cell: "B0" }), C({ kind: "sheet-cell", sheet: null, cell: null }));
  assert.notEqual(canonicalExtent({ kind: "sheet-cell", sheet: "s", cell: "A1" }), canonicalExtent({ kind: "sheet-cell", sheet: "S", cell: "A1" }));
  assert.equal(canonicalExtent({ kind: "slide-shape", slide: 7, shape: 3 }), C({ kind: "slide-shape", slide: 7, shape: 3 }));
  assert.equal(canonicalExtent({ kind: "slide-shape", slide: "7" }), C({ kind: "slide-shape", slide: null, shape: null }));
  assert.equal(canonicalExtent({ kind: "doc-para", para: 0, run: 2 }), C({ kind: "doc-para", para: 0, run: 2 }));
  assert.equal(canonicalExtent({ kind: "doc-para" }), C({ kind: "doc-para", para: null, run: null }));
  assert.equal(canonicalExtent({ kind: "sheet-range", sheet: "S", range: "$c$3:b2" }), C({ kind: "sheet-range", sheet: "S", range: "B2:C3" }));
  assert.equal(canonicalExtent({ kind: "sheet-range", sheet: "S", range: 5 }), C({ kind: "sheet-range", sheet: "S", range: null }));
  assert.equal(canonicalExtent({ kind: "doc-table", table: 1, cell: "$a$2" }), C({ kind: "doc-table", table: 1, cell: "A2" }));
  assert.equal(canonicalExtent({ kind: "image", part: " Word/Media/IMG1.PNG ", page: 0, rect: [5, 5, 0, 0] }),
    C({ kind: "image", cited_as: "bytes", part: "word/media/img1.png", page: 0, rect: [0, 0, 5, 5] }));
  assert.equal(canonicalExtent({ kind: "image", cited_as: "text" }), C({ kind: "image", cited_as: "text", part: null, page: null, rect: null }));
  /* cited_as is in the image's address only. */
  assert.equal(canonicalExtent({ kind: "doc-para", para: 1, cited_as: "bytes" }), canonicalExtent({ kind: "doc-para", para: 1 }));
  /* Any other kind: a total form, never another arm's. */
  assert.equal(canonicalExtent({ kind: "dom", fields: { a: 1 } }), C({ kind: "dom", fields: { a: 1 } }));
  for (const x of JUNK) assert.equal(canonicalExtent(x), C({ kind: null, fields: null }), label(x));
  /* ref never takes part. */
  for (const kind of KINDS) assert.equal(canonicalExtent({ kind, page: 0, ref: "one" }), canonicalExtent({ kind, page: 0, ref: "two" }));
});

/* The inputs the R97 and R98 sweeps drive: every kind with each of its fields valid, missing and malformed. */
function* extents() {
  const vals = {
    page: [undefined, 0, 3, -1, 1.5, "2"], rect: [undefined, [0, 0, 10, 10], [10, 10, 0, 0], [1, 2, 3], [1, 2, 3, NaN]],
    sheet: [undefined, "Sheet1", " S ", "", 3], cell: [undefined, "B14", "$b$14", " c3 ", "B0", "A1:B2", 5],
    slide: [undefined, 1, 7, -1], shape: [undefined, 0, 3], para: [undefined, 0, 11, "1"], run: [undefined, 0, 2, -2],
    range: [undefined, "B2:C3", "c3:$b$2", "B3", "A:C", "", 9], table: [undefined, 0, 4, 1.5],
    part: [undefined, "word/media/image1.png", " PPT/Media/X.JPEG ", "", 7, "word/footnotes.xml"], cited_as: [undefined, null, "", "text", "bytes", "x"],
    ref: [undefined, "", "  ", " authored ", 4], fields: [undefined, { a: 1 }],
  };
  const arms = {
    document: [], "pdf-page": ["page", "rect", "run"], "sheet-cell": ["sheet", "cell"], "slide-shape": ["slide", "shape", "run"],
    "doc-para": ["para", "run"], "sheet-range": ["sheet", "range", "run"], "doc-part": ["part", "ref"], "doc-table": ["table", "cell"],
    image: ["part", "page", "rect", "cited_as"], dom: ["fields"], constructor: [], toString: [], "": [],
  };
  for (const [kind, fields] of Object.entries(arms)) {
    const combos = fields.reduce((acc, f) => acc.flatMap((o) => vals[f].map((v) => (v === undefined ? o : { ...o, [f]: v }))), [{ kind }]);
    for (const c of combos) { yield c; for (const ref of vals.ref.slice(1)) yield { ...c, ref }; }
  }
  yield* JUNK;
  yield { cited_as: "bytes" };
  yield { kind: 3, fields: "f" };
}

/* R97, spelled from the requirement: each arm's fixed fields, absent ones null, `ref` never among them. */
const isObj = (x) => x !== null && typeof x === "object";
const int = (n) => (Number.isInteger(n) ? n : null);
const rect4 = (r) => (Array.isArray(r) && r.length === 4 && r.every((n) => typeof n === "number" && Number.isFinite(n))
  ? [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])] : null);
const run = (e) => (Number.isInteger(e.run) ? { run: e.run } : {});
const sheetOf = (s) => (typeof s === "string" && s.trim() !== "" ? s.trim() : null);
const cellOf = (c) => (typeof c === "string" && /^\$?[A-Za-z]{1,3}\$?[1-9][0-9]{0,6}$/.test(c.trim())
  ? c.trim().split("$").join("").toUpperCase() : null);
function r97(x) {
  const e = isObj(x) ? x : {};
  switch (e.kind) {
    case "document": return { kind: "document" };
    case "pdf-page": return { kind: "pdf-page", page: int(e.page), rect: rect4(e.rect), ...run(e) };
    case "sheet-cell": return { kind: "sheet-cell", sheet: sheetOf(e.sheet), cell: cellOf(e.cell) };
    case "slide-shape": return { kind: "slide-shape", slide: int(e.slide), shape: int(e.shape), ...run(e) };
    case "doc-para": return { kind: "doc-para", para: int(e.para), run: int(e.run) };
    case "sheet-range": return { kind: "sheet-range", sheet: sheetOf(e.sheet), range: canonicalRange(e.range), ...run(e) };
    case "doc-part": return { kind: "doc-part", part: sheetOf(e.part), ref: sheetOf(e.ref) };
    case "doc-table": return { kind: "doc-table", table: int(e.table), cell: cellOf(e.cell) };
    case "image": return { kind: "image", cited_as: contentCitedAs(e),
      part: typeof e.part === "string" ? e.part.trim().toLowerCase() : null, page: int(e.page), rect: rect4(e.rect) };
    default: return { kind: e.kind ?? null, fields: e.fields ?? null };
  }
}

test("R97: canonicalExtent answers R97's form over every kind, field and malformation, ref never taking part", () => {
  let n = 0;
  for (const e of extents()) {
    assert.equal(canonicalExtent(e), canonicalJson(r97(e)), label(e));
    if (isObj(e) && Object.hasOwn(e, "ref") && e.kind !== "doc-part") {
      const { ref, ...bare } = e;
      assert.equal(canonicalExtent(e), canonicalExtent(bare), label(e));
    }
    n++;
  }
  assert.ok(n > 2000, `${n} inputs`);
  /* The address never depends on the order a caller wrote its fields in. */
  for (const e of extents()) if (isObj(e) && !Array.isArray(e) && typeof e !== "function")
    assert.equal(canonicalExtent(Object.fromEntries(Object.entries(e).reverse())), canonicalExtent(e), label(e));
});

test("R98: describeExtent is the authored ref, else the derived form per arm, else the kind's phrase or the unnamed sentence", () => {
  const cases = [
    [{ kind: "pdf-page", page: 3, ref: "  printed p. 4 " }, "printed p. 4"],
    [{ kind: "pdf-page", page: 3, ref: "   " }, "page 4"],
    [{ kind: "document" }, word("content.why.whole_document")],
    [{ kind: "pdf-page", page: 0 }, "page 1"],
    [{ kind: "pdf-page", page: 0, rect: [0, 0, 1, 1] }, "page 1, a region of it"],
    [{ kind: "pdf-page", page: "0" }, word("textchain.text.page_document")],
    [{ kind: "sheet-cell", sheet: " Sheet1 ", cell: " B14 " }, "Sheet1!B14"],
    [{ kind: "sheet-cell", sheet: "Sheet1" }, word("textchain.text.cell_spreadsheet")],
    [{ kind: "doc-para", para: 11, run: 2 }, "¶12"],
    [{ kind: "doc-para" }, word("textchain.text.paragraph_document")],
    [{ kind: "slide-shape", slide: 7, shape: 3 }, "slide 7"],
    [{ kind: "slide-shape", shape: 3 }, word("textchain.text.shape_deck")],
    [{ kind: "sheet-range", sheet: "S", range: "c3:$b$2" }, "S!B2:C3"],
    [{ kind: "sheet-range", sheet: "S", range: "A:C" }, word("textchain.text.range_cells_spreadsheet")],
    [{ kind: "doc-table", table: 0, cell: "$b$2" }, "table 1, B2"],
    [{ kind: "doc-table", table: 2 }, "table 3"],
    [{ kind: "doc-table" }, word("textchain.text.table_document")],
    [{ kind: "image", part: " Word/Media/IMAGE123456789.png " }, "image word/media/i"],
    [{ kind: "image", page: 4 }, "an image on page 5"],
    [{ kind: "image" }, word("textchain.text.image_document")],
    [{ kind: "dom" }, word("textchain.text.part_document_record")],
    [{ kind: "constructor" }, word("textchain.text.part_document_record")],
    [{ kind: "__proto__" }, word("textchain.text.part_document_record")],
  ];
  for (const [e, want] of cases) assert.equal(describeExtent(e), want, JSON.stringify(e));
  for (const x of JUNK) assert.equal(describeExtent(x), word("textchain.text.part_document_record"));
  /* Over every kind, field and malformation: R98's sentence, spelled again here, and always a non-empty string. */
  let n = 0;
  for (const e of extents()) {
    const said = describeExtent(e);
    assert.ok(typeof said === "string" && said.length > 0, label(e));
    assert.equal(said, r98(e), label(e));
    n++;
  }
  assert.ok(n > 2000, `${n} inputs`);
});

/* R98, spelled from the requirement: the authored ref, else each arm's derived form or fallback phrase, else the
   kind's own phrase (own keys only), else the unnamed sentence. Pages, paragraphs and tables shown 1-based. */
function r98(x) {
  const e = isObj(x) ? x : {};
  if (e.kind !== "doc-part" && typeof e.ref === "string" && e.ref.trim() !== "") return e.ref.trim();
  const sheet = sheetOf(e.sheet);
  switch (e.kind) {
    case "doc-part": return sheetOf(e.ref) ? `part ${sheetOf(e.ref)}` : word("textchain.text.part_document_record");
    case "document": return word("content.why.whole_document");
    case "pdf-page": return !Number.isInteger(e.page) ? word("textchain.text.page_document")
      : `page ${e.page + 1}${Array.isArray(e.rect) && e.rect.length === 4 ? ", a region of it" : ""}`;
    case "sheet-cell": return sheet && sheetOf(e.cell) ? `${sheet}!${sheetOf(e.cell)}` : word("textchain.text.cell_spreadsheet");
    case "doc-para": return Number.isInteger(e.para) ? `¶${e.para + 1}` : word("textchain.text.paragraph_document");
    case "slide-shape": return Number.isInteger(e.slide) ? `slide ${e.slide}` : word("textchain.text.shape_deck");
    case "sheet-range": {
      const range = typeof e.range === "string" ? canonicalRange(e.range) : null;
      return sheet && range ? `${sheet}!${range}` : word("textchain.text.range_cells_spreadsheet");
    }
    case "doc-table": {
      if (!Number.isInteger(e.table)) return word("textchain.text.table_document");
      const cell = sheetOf(e.cell);
      return `table ${e.table + 1}${cell ? `, ${cell.split("$").join("").toUpperCase()}` : ""}`;
    }
    case "image":
      if (sheetOf(e.part)) return `image ${e.part.trim().toLowerCase().slice(0, 12)}`;
      return Number.isInteger(e.page) ? `an image on page ${e.page + 1}` : word("textchain.text.image_document");
    default: return typeof e.kind === "string" && Object.hasOwn(CONTENT_EXTENT_KINDS, e.kind)
      ? CONTENT_EXTENT_KINDS[e.kind].human : word("textchain.text.part_document_record");
  }
}

test("R97: each chunk of a unit has its own address (a run joins pdf-page, slide-shape and sheet-range), and no existing address moves", () => {
  const arms = [{ kind: "pdf-page", page: 2, rect: null }, { kind: "pdf-page", page: 2, rect: [1, 2, 3, 4] },
    { kind: "slide-shape", slide: 3, shape: 1 }, { kind: "sheet-range", sheet: "S", range: "A1:C9" }];
  for (const a of arms) {
    const bare = canonicalExtent(a);
    /* No run, or one that is no integer: byte-identical to the form before runs existed. */
    for (const run of [undefined, null, "1", 1.5, NaN, -0.5]) assert.equal(canonicalExtent({ ...a, run }), bare, `${a.kind} ${String(run)}`);
    const seen = new Set([bare]);
    for (const run of [0, 1, 2, 17]) {
      const c = canonicalExtent({ ...a, run });
      assert.equal(c, canonicalJson({ ...JSON.parse(bare), run }), `${a.kind} run ${run}`);
      assert.ok(!seen.has(c), `${a.kind} run ${run} collides`);
      seen.add(c);
    }
  }
  assert.notEqual(canonicalExtent({ kind: "pdf-page", page: 2, rect: null, run: 1 }), canonicalExtent({ kind: "pdf-page", page: 2, rect: null, run: 0 }));
  /* The arms that never carried a run still do not: their bytes are the ones minted before. */
  for (const a of [{ kind: "document" }, { kind: "sheet-cell", sheet: "S", cell: "A1" }, { kind: "doc-table", table: 1, cell: "B2" },
    { kind: "image", part: "p", page: 1 }]) assert.equal(canonicalExtent({ ...a, run: 3 }), canonicalExtent(a), a.kind);
  assert.equal(canonicalExtent({ kind: "doc-para", para: 4, run: 3 }), canonicalJson({ kind: "doc-para", para: 4, run: 3 }));
});

test("R97: every part of a document has its own address, and the part's ref is the address, not a note", () => {
  const a = canonicalExtent({ kind: "doc-part", part: "word/footnotes.xml", ref: "fn1" });
  assert.equal(a, canonicalJson({ kind: "doc-part", part: "word/footnotes.xml", ref: "fn1" }));
  assert.notEqual(a, canonicalExtent({ kind: "doc-part", part: "word/footnotes.xml", ref: "fn2" }));
  assert.notEqual(a, canonicalExtent({ kind: "doc-part", part: "word/endnotes.xml", ref: "fn1" }));
  assert.equal(a, canonicalExtent({ kind: "doc-part", part: " word/footnotes.xml ", ref: " fn1 " }));
  assert.equal(canonicalExtent({ kind: "doc-part" }), canonicalJson({ kind: "doc-part", part: null, ref: null }));
  assert.equal(canonicalExtent({ kind: "doc-part", part: 3, ref: {} }), canonicalJson({ kind: "doc-part", part: null, ref: null }));
});

test("R98: a doc-part reads \"part <ref>\" by key, with no run in the sentence", () => {
  assert.equal(describeExtent({ kind: "doc-part", part: "word/footnotes.xml", ref: " fn1 " }), "part fn1");
  assert.equal(describeExtent({ kind: "doc-part", part: "word/footnotes.xml", ref: "fn1", run: 4 }), "part fn1");
  for (const e of [{ kind: "doc-part" }, { kind: "doc-part", part: "word/footnotes.xml", ref: "  " }, { kind: "doc-part", ref: 4 }])
    assert.equal(describeExtent(e), word("textchain.text.part_document_record"), JSON.stringify(e));
  assert.equal(describeExtent({ kind: "pdf-page", page: 1, run: 5 }), "page 2");
  assert.ok(!Object.hasOwn(CONTENT_EXTENT_KINDS, "doc-part"), "R92's eight kinds are unchanged");
});
