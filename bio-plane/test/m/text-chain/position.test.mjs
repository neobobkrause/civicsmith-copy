/* text-chain: requirement-named tests for reading positions, their containment, and the glyph
 * counter (build/requirements/text-chain.md R61-R73). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readingSource, readingSourceJson, readingOccurrenceKey, readingSourceFromColumns, readingPositionInExtent, glyphCount,
} from "../../../src/textchain.mjs";

const pdf = (x = {}) => ({ kind: "pdf-page", ref: "p. 1", page: 0, ...x });
const para = (x = {}) => ({ kind: "doc-para", ref: "¶1", para: 0, ...x });
const cell = (x = {}) => ({ kind: "sheet-cell", ref: "S!B3", sheet: "S", cell: "B3", ...x });
const shape = (x = {}) => ({ kind: "slide-shape", ref: "slide 1", slide: 1, shape: 0, ...x });
const VALID = [pdf(), para(), cell(), shape()];

test("R61: null unless a plain object of kind pdf-page|sheet-cell|slide-shape|doc-para with a non-empty ref (truncated to 200)", () => {
  for (const s of [null, undefined, "pdf-page", 3, [], [pdf()], { ...pdf(), kind: "dom" }, { ...pdf(), kind: "image" },
    { ...pdf(), kind: "" }, { ...pdf(), kind: undefined }, { ...pdf(), ref: "" }, { ...pdf(), ref: "  " }, { ...pdf(), ref: 5 }, { ...pdf(), ref: undefined }])
    assert.equal(readingSource(s), null, JSON.stringify(s));
  for (const v of VALID) assert.equal(readingSource(v).kind, v.kind);
  const long = "x".repeat(300);
  for (const v of VALID) assert.equal(readingSource({ ...v, ref: long }).ref, long.slice(0, 200));
  /* The result is key-ordered and rebuilt: extra caller fields are not carried. */
  assert.deepEqual(Object.keys(readingSource({ zz: 1, ...pdf(), extra: 2 })), ["kind", "ref", "page", "rect"]);
});

test("R62: pdf-page needs a non-negative integer page; a valid rect carries, else null", () => {
  for (const page of [undefined, -1, 1.5, "0"]) assert.equal(readingSource(pdf({ page })), null);
  assert.deepEqual(readingSource(pdf({ page: 3 })), { kind: "pdf-page", ref: "p. 1", page: 3, rect: null });
  assert.deepEqual(readingSource(pdf({ rect: [1, 2, 3, 4] })), { kind: "pdf-page", ref: "p. 1", page: 0, rect: [1, 2, 3, 4] });
  for (const rect of [[1, 2, 3], [1, 2, 3, NaN], [1, 2, 3, "4"], "1 2 3 4", [1, 2, 3, 4, 5], [1, 2, 3, Infinity]])
    assert.equal(readingSource(pdf({ rect })).rect, null);
});

test("R63: doc-para needs a non-negative integer para; a valid run carries, else null", () => {
  for (const p of [undefined, -1, 0.5, "1"]) assert.equal(readingSource(para({ para: p })), null);
  assert.deepEqual(readingSource(para({ para: 4, run: 2 })), { kind: "doc-para", ref: "¶1", para: 4, run: 2 });
  for (const run of [undefined, -1, 1.5, "2"]) assert.deepEqual(readingSource(para({ run })), { kind: "doc-para", ref: "¶1", para: 0, run: null });
});

test("R64: sheet-cell needs non-empty string sheet and cell, truncated to 200/64", () => {
  for (const x of [{ sheet: "" }, { sheet: undefined }, { sheet: 3 }, { cell: "" }, { cell: "  " }, { cell: 5 }]) assert.equal(readingSource(cell(x)), null);
  assert.deepEqual(readingSource(cell()), { kind: "sheet-cell", ref: "S!B3", sheet: "S", cell: "B3" });
  const r = readingSource(cell({ sheet: "s".repeat(250), cell: "c".repeat(80) }));
  assert.equal(r.sheet.length, 200);
  assert.equal(r.cell.length, 64);
});

test("R65: slide-shape needs non-negative integer slide and shape", () => {
  for (const x of [{ slide: -1 }, { slide: 1.5 }, { slide: undefined }, { shape: undefined }, { shape: -2 }, { shape: "0" }]) assert.equal(readingSource(shape(x)), null);
  assert.deepEqual(readingSource(shape({ slide: 2, shape: 7 })), { kind: "slide-shape", ref: "slide 1", slide: 2, shape: 7 });
});

test("R66: readingSourceJson is the canonical JSON of the per-arm fields, identical for the same place", () => {
  assert.equal(readingSourceJson(null), null);
  assert.equal(readingSourceJson({ kind: "dom", ref: "x" }), null);
  assert.equal(readingSourceJson(pdf({ page: 2 })), JSON.stringify({ page: 2, rect: null }));
  assert.equal(readingSourceJson(para()), JSON.stringify({ para: 0, run: null }));
  assert.equal(readingSourceJson(cell()), JSON.stringify({ sheet: "S", cell: "B3" }));
  assert.equal(readingSourceJson(shape()), JSON.stringify({ slide: 1, shape: 0 }));
  /* Order-independent and ref-independent. */
  assert.equal(readingSourceJson({ rect: [1, 2, 3, 4], page: 1, ref: "a", kind: "pdf-page" }),
               readingSourceJson({ kind: "pdf-page", ref: "b", page: 1, rect: [1, 2, 3, 4] }));
});

test("R67: readingOccurrenceKey is kind:json for a placed source, \"\" otherwise", () => {
  for (const v of VALID) assert.equal(readingOccurrenceKey(v), `${v.kind}:${readingSourceJson(v)}`);
  for (const s of [null, {}, { kind: "dom", ref: "x" }, pdf({ page: -1 })]) assert.equal(readingOccurrenceKey(s), "");
});

test("R68: readingSourceFromColumns inverts the three stored columns, null for anything malformed", () => {
  for (const v of VALID) {
    const s = readingSource(v);
    assert.deepEqual(readingSourceFromColumns(s.kind, readingSourceJson(s), s.ref), s);
  }
  const cases = [["", "{}", "r"], ["pdf-page", "{\"page\":0}", ""], [null, "{}", "r"], ["pdf-page", "{\"page\":0}", 3],
    ["pdf-page", "{bad json", "r"], ["pdf-page", "null", "r"], ["pdf-page", "3", "r"], ["pdf-page", { page: 0 }, "r"],
    ["pdf-page", "{\"page\":-1}", "r"], ["dom", "{}", "r"]];
  for (const c of cases) assert.equal(readingSourceFromColumns(...c), null, JSON.stringify(c));
});

test("R69: false unless the position normalises and extentKind is a non-empty string", () => {
  for (const p of [null, {}, { kind: "dom", ref: "x" }, pdf({ page: -1 })]) assert.equal(readingPositionInExtent(p, "document", {}), false);
  for (const k of [undefined, null, "", "  ", 3]) assert.equal(readingPositionInExtent(pdf(), k, { page: 0 }), false);
});

test("R70: a document extent contains every valid position", () => {
  for (const v of VALID) {
    assert.equal(readingPositionInExtent(v, "document", null), true);
    assert.equal(readingPositionInExtent(v, "document", { page: 99 }), true);
  }
});

test("R71: otherwise the extent kind must equal the position's, with each arm's rule", () => {
  /* A different kind never contains (sheet-range aside, R72). */
  for (const v of VALID) for (const k of ["pdf-page", "doc-para", "slide-shape", "sheet-cell", "image", "dom"])
    if (k !== v.kind) assert.equal(readingPositionInExtent(v, k, { page: 0, para: 0, sheet: "S", cell: "B3", slide: 1, shape: 0 }), false);
  for (const v of VALID) for (const e of [null, undefined, [], "x"]) assert.equal(readingPositionInExtent(v, v.kind, e), false);
  /* pdf-page */
  assert.equal(readingPositionInExtent(pdf(), "pdf-page", { page: 0 }), true);
  assert.equal(readingPositionInExtent(pdf(), "pdf-page", { page: 1 }), false);
  assert.equal(readingPositionInExtent(pdf(), "pdf-page", { page: "0" }), false);
  assert.equal(readingPositionInExtent(pdf(), "pdf-page", { page: 0, rect: [0, 0, 1] }), true);
  assert.equal(readingPositionInExtent(pdf(), "pdf-page", { page: 0, rect: [0, 0, 10, 10] }), false);
  assert.equal(readingPositionInExtent(pdf({ rect: [2, 2, 3, 3] }), "pdf-page", { page: 0, rect: [10, 10, 0, 0] }), true);
  assert.equal(readingPositionInExtent(pdf({ rect: [3, 3, 2, 2] }), "pdf-page", { page: 0, rect: [0, 0, 10, 10] }), true);
  assert.equal(readingPositionInExtent(pdf({ rect: [2, 2, 11, 3] }), "pdf-page", { page: 0, rect: [0, 0, 10, 10] }), false);
  /* doc-para */
  assert.equal(readingPositionInExtent(para({ run: 3 }), "doc-para", { para: 0 }), true);
  assert.equal(readingPositionInExtent(para(), "doc-para", { para: 1 }), false);
  assert.equal(readingPositionInExtent(para(), "doc-para", { para: 0, run: 1 }), false);
  assert.equal(readingPositionInExtent(para({ run: 1 }), "doc-para", { para: 0, run: 1 }), true);
  assert.equal(readingPositionInExtent(para({ run: 2 }), "doc-para", { para: 0, run: 1 }), false);
  /* sheet-cell */
  assert.equal(readingPositionInExtent(cell(), "sheet-cell", { sheet: "S", cell: "B3" }), true);
  assert.equal(readingPositionInExtent(cell(), "sheet-cell", { sheet: "S", cell: "b3" }), false);
  assert.equal(readingPositionInExtent(cell(), "sheet-cell", { sheet: "T", cell: "B3" }), false);
  assert.equal(readingPositionInExtent(cell(), "sheet-cell", { sheet: "S" }), false);
  /* slide-shape */
  assert.equal(readingPositionInExtent(shape(), "slide-shape", { slide: 1 }), true);
  assert.equal(readingPositionInExtent(shape(), "slide-shape", { slide: 2 }), false);
  assert.equal(readingPositionInExtent(shape(), "slide-shape", { slide: 1, shape: 0 }), true);
  assert.equal(readingPositionInExtent(shape(), "slide-shape", { slide: 1, shape: 1 }), false);
});

test("R72: a sheet-cell position is inside a sheet-range extent of its sheet whose bounds hold its cell", () => {
  const inR = (c, range, sheet = "S") => readingPositionInExtent(cell({ cell: c }), "sheet-range", { sheet, range });
  /* Every cell of a 3x3 grid around the range B2:C3, exactly. */
  for (const col of ["A", "B", "C", "D"]) for (const row of [1, 2, 3, 4]) {
    const want = ["B", "C"].includes(col) && [2, 3].includes(row);
    assert.equal(inR(`${col}${row}`, "B2:C3"), want, `${col}${row}`);
    assert.equal(inR(`${col}${row}`, "C3:B2"), want, `${col}${row} reversed`);
    assert.equal(inR(`$${col}$${row}`, "$B$2:$C$3"), want, `${col}${row} absolute`);
  }
  assert.equal(inR("B3", "B3"), true);
  assert.equal(inR("B4", "B3"), false);
  assert.equal(inR("AA10", "Z1:AB20"), true);
  assert.equal(inR("Y10", "Z1:AB20"), false);
  assert.equal(inR("C99", "B:D"), true);
  assert.equal(inR("E1", "B:D"), false);
  assert.equal(inR("ZZ5", "3:7"), true);
  assert.equal(inR("A8", "3:7"), false);
  /* Another sheet, another reading arm, or anything unparseable: the honest no. */
  assert.equal(inR("B2", "B2:C3", "T"), false);
  for (const range of [undefined, "", "B2:C3:D4", "2B:C3", "B2-C3", "B0:C3", "B:3", 5]) assert.equal(inR("B2", range), false, String(range));
  for (const c of ["B", "2", "B2C", "B0"]) assert.equal(inR(c, "A1:Z99"), false, c);
  assert.equal(readingPositionInExtent(cell(), "sheet-range", null), false);
  assert.equal(readingPositionInExtent(cell(), "sheet-range", { range: "A1:Z9" }), false);
  for (const v of [pdf(), para(), shape()]) assert.equal(readingPositionInExtent(v, "sheet-range", { sheet: "S", range: "A1:Z9" }), false);
  /* The extent-kind rule is otherwise unchanged: a cell reading and a sheet-cell extent. */
  assert.equal(readingPositionInExtent(cell(), "sheet-cell", { sheet: "S", cell: "B3" }), true);
});

test("R73: glyphCount counts non-whitespace code points; 0 for a non-string", () => {
  for (const x of [undefined, null, 5, ["ab"], {}]) assert.equal(glyphCount(x), 0);
  assert.equal(glyphCount(""), 0);
  assert.equal(glyphCount(" \t\n\r  　"), 0);
  assert.equal(glyphCount("a b\nc"), 3);
  assert.equal(glyphCount("𝐀𝐁"), 2);
  assert.equal("𝐀𝐁".length, 4);
  assert.equal(glyphCount("é́"), 2);
  assert.equal(glyphCount("\ud800x"), 2);
});
