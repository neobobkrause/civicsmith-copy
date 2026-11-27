/* G41 (fix round 6; K4636, K4639, K4642): a workbook's typed cells are not all made at intake. Opted in with
   `{inlineCellsMax}`, `xlsxEntry.text()` lists a sheet's cells only while the workbook's cells together are under the
   cap, else `cells` is null and `cells_held` is true; `cellsIn()` makes the cells of a range from the held bytes. Every test goes through
   `xlsxEntry`, with `fixtures.mjs` packages and a 200,000-row workbook.
   Ids: R36 (the opt-in inline cap and `cells_held`), R37 (`cellsIn`), beside R30 and R35 (R36 and R37 proposed to BOB). */
/** @import { TypedCell, XlsxText } from "../../../src/formats-xlsx.mjs" */
/** @import { ReadFailure } from "../../../src/docx.mjs" */
/** @import { G41TextReport, G41CellsReport } from "./g41-peak.mjs" */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "./fixtures.mjs";
import { bigXlsx, MIB } from "./large.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";

/* reading-pipeline's figure (K4646); the entry takes whatever number it is given */
const INLINE_CELLS_MAX_BYTES = 512 * 1024;

/** @type {(file: string, args: string[], options?: {maxBuffer?: number, timeout?: number}) => Promise<{stdout: string, stderr: string}>} */
const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SS = ["alpha", "beta & gamma", "delta", "epsilon", "zeta", "eta", "theta"];
/**
 * A cell's address as a case writes it out.
 * @typedef {Object} CellRef
 * @property {string} kind
 * @property {string} ref
 * @property {string} sheet
 * @property {string} cell
 */
/**
 * A typed cell as a case writes it out.
 * @typedef {Object} KnownCell
 * @property {CellRef} source
 * @property {string | null} value
 * @property {string} type
 * @property {string | null} declared
 * @property {string | null} cached
 * @property {string | null} formula
 */
/**
 * @typedef {Object} GridOptions
 * @property {number} [rows]
 * @property {string} [name]
 */
/** The `i`th of `list`, which the case reads as there.
 * @template T
 * @param {ReadonlyArray<T>} list
 * @param {number} i
 * @returns {T} */
const nth = (list, i) => { const x = list[i]; assert(x !== undefined, `no item ${i}`); return x; };
/** @param {string} sheet @param {string} cell @returns {CellRef} */
const ref = (sheet, cell) => ({ kind: "sheet-cell", ref: `${sheet}!${cell}`, sheet, cell });

/* The 5,000 x 4 workbook: a number, an inline string, a shared string, and a formula that carries its cached value on
   even rows and none on odd ones; row 4995 is hidden; every row also has a styled empty cell no list holds.
   @param {GridOptions} [o]
   @returns {{xml: string, name: string, rows: number}} */
function grid({ rows = 5000, name = "Sheet" } = {}) {
  /** @type {string[]} */
  const body = [];
  for (let r = 1; r <= rows; r++) {
    body.push(`<row r="${r}"${r === 4995 ? ' hidden="1"' : ""}><c r="A${r}"><v>${r}</v></c>`
      + `<c r="B${r}" t="inlineStr"><is><t>in ${r}</t></is></c><c r="C${r}" t="s"><v>${r % 7}</v></c>`
      + `<c r="D${r}"><f>A${r}*2</f>${r % 2 === 0 ? `<v>${r * 2}</v>` : ""}</c><c r="E${r}" s="1"/></row>`);
  }
  const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body.join("")}</sheetData></worksheet>`;
  return { xml, name, rows };
}
/** @param {string} name @param {number} r @returns {KnownCell[]} */
const known = (name, r) => [
  { source: ref(name, `A${r}`), value: String(r), type: "number", declared: null, cached: null, formula: null },
  { source: ref(name, `B${r}`), value: `in ${r}`, type: "text", declared: "inlineStr", cached: null, formula: null },
  { source: ref(name, `C${r}`), value: nth(SS, r % 7).replace("&amp;", "&"), type: "text", declared: "s", cached: null, formula: null },
  { source: ref(name, `D${r}`), value: r % 2 === 0 ? String(r * 2) : null, type: "number", declared: null,
    cached: r % 2 === 0 ? String(r * 2) : null, formula: `A${r}*2` },
];
const sst = () => F.sst(SS.map((t) => t.replace("&", "&amp;")));
/** @param {GridOptions} [o] */
const gridBytes = (o) => { const g = grid(o); return F.xlsx({ sheets: [{ name: g.name, xml: g.xml }], sharedStrings: sst() }); };
/** @param {string | null | undefined} got @param {string} want @param {string} what */
const same = (got, want, what) => assert.ok(got === want, `${what}: ${got == null ? got : got.length} chars, wanted ${want.length}`);
/** @param {TypedCell[] | null} v */
const jsonBytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

test("R36 held cells: a 5,000-row x 4-cell workbook (20,000 cells) read with {inlineCellsMax} lists none and says they are held", async () => {
  const bytes = gridBytes();
  const t = await xlsxEntry.text(bytes, { inlineCellsMax: INLINE_CELLS_MAX_BYTES });
  assert.equal(t.ok, true);
  const s = nth(t.sheets, 0);
  assert.ok(s.cells === null, "cells are not listed");
  assert.equal(s.cells_held, true);
  /* the text is read whole, every row, and the counts are the sheet's */
  assert.equal(s.text.split("\n").length, 5000);
  assert.equal(s.lineRows?.length, 5000);
  assert.equal(s.usedRows, 5000);
  assert.equal(t.counts.cells, 17500, "a cell with a displayed value: three a row and the formula's cached value on even rows");
  assert.equal(t.counts.formulas, 5000);
});

test("R36 controls: with no option every cell is listed and nothing is marked; a small workbook under the cap lists its cells unmarked", async () => {
  const t = await xlsxEntry.text(gridBytes());
  assert(t.ok);
  const s = nth(t.sheets, 0);
  const cells = s.cells;
  /* the A, B and C cells of every row, and a D cell for every row (a formula holds a cell with or without a cached value) */
  assert.equal(cells?.length, 20000);
  assert.ok(!("cells_held" in s));
  assert.deepEqual(cells?.slice(0, 4), known("Sheet", 1));
  const small = await xlsxEntry.text(gridBytes({ rows: 50 }), { inlineCellsMax: INLINE_CELLS_MAX_BYTES });
  assert(small.ok);
  assert.equal(nth(small.sheets, 0).cells?.length, 200);
  assert.ok(!("cells_held" in nth(small.sheets, 0)));
  assert.deepEqual(nth(small.sheets, 0).cells?.slice(-4), known("Sheet", 50));
  /* an option that is not a size is no option */
  for (const bad of [undefined, null, "x", NaN, -1, {}]) {
    const u = await xlsxEntry.text(gridBytes({ rows: 50 }), { inlineCellsMax: bad });
    assert(u.ok);
    assert.equal(nth(u.sheets, 0).cells?.length, 200, String(bad));
  }
});

test("R36 the cap is the workbook's cells together, in bytes of their JSON: at the size they are listed, one byte under they are held, over every sheet", async () => {
  const one = grid({ rows: 300, name: "One" }), two = grid({ rows: 300, name: "Two" });
  const bytes = F.xlsx({ sheets: [{ name: "One", xml: one.xml }, { name: "Two", xml: two.xml }], sharedStrings: sst() });
  const full = await xlsxEntry.text(bytes);
  assert(full.ok);
  const each = full.sheets.map((s) => jsonBytes(s.cells));
  const together = nth(each, 0) + nth(each, 1);
  const at = await xlsxEntry.text(bytes, { inlineCellsMax: together });
  assert(at.ok);
  assert.deepEqual(at.sheets.map((s) => s.cells?.length), [1200, 1200]);
  assert.ok(at.sheets.every((s) => !("cells_held" in s)));
  const under = await xlsxEntry.text(bytes, { inlineCellsMax: together - 1 });
  assert(under.ok);
  assert.deepEqual(under.sheets.map((s) => [s.cells === null, s.cells_held]), [[true, true], [true, true]]);
  /* each sheet alone would have fit: the cap is the workbook's */
  assert.ok(nth(each, 0) <= together - 1 && nth(each, 1) <= together - 1);
  /* held or listed, the text and counts are the same */
  assert.deepEqual(under.sheets.map((s) => s.text), at.sheets.map((s) => s.text));
  assert.deepEqual(under.counts, at.counts);
});

test("R36 a sheet the file could not give has no cells and no marker", async () => {
  const bytes = F.xlsx({ sheets: [{ name: "Bad", data: { rows: [{ r: 1, cells: [{ r: "A1", v: "1" }] }] }, cd: F.CORRUPT },
    { name: "Ok", xml: grid({ rows: 4000, name: "Ok" }).xml }], sharedStrings: sst() });
  const t = await xlsxEntry.text(bytes, { inlineCellsMax: INLINE_CELLS_MAX_BYTES });
  assert(t.ok);
  assert.ok(nth(t.sheets, 0).cells === null, "cells are not listed");
  assert.ok(!("cells_held" in nth(t.sheets, 0)));
  assert.equal(nth(t.sheets, 1).cells_held, true);
});

test("R37 cellsIn: rows 4,990 to 5,000 are exactly the cells of the whole read for them, formulas with and without cached values, a hidden row included", async () => {
  const bytes = gridBytes();
  const r = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 4990, toRow: 5000 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, { from: 4990, to: 5000 });
  assert.ok(!("next_row" in r), "answered whole: no next_row");
  const cells = r.cells;
  assert.equal(cells.length, 44);
  /** @type {KnownCell[]} */
  const want = [];
  for (let n = 4990; n <= 5000; n++) want.push(...known("Sheet", n));
  assert.deepEqual(cells, want);
  /* the whole read made the same cells for those rows */
  const wholeRead = await xlsxEntry.text(bytes);
  assert(wholeRead.ok);
  const wholeCells = nth(wholeRead.sheets, 0).cells;
  assert(wholeCells !== null, "the whole read lists its cells");
  const whole = wholeCells.filter((c) => { const m = /\d+$/.exec(c.source.cell); assert(m !== null); const n = Number(m[0]); return n >= 4990 && n <= 5000; });
  assert.deepEqual(cells, whole);
  assert.deepEqual(cells.slice(20, 24), known("Sheet", 4995), "the hidden row's cells are there");
  /* from the held bytes of the registry's own parts() answer too */
  const parts = await xlsxEntry.parts(bytes);
  const fromParts = await xlsxEntry.cellsIn(parts, { sheet: "Sheet", fromRow: 4990, toRow: 5000 });
  assert(fromParts.ok);
  assert.deepEqual(fromParts.cells, want);
});

test("R37 cellsIn: a column subset, a sheet named without case or by position, one row, rows past the sheet, and the first rows", async () => {
  const bytes = gridBytes();
  const cols = await xlsxEntry.cellsIn(bytes, { sheet: "sheet", fromRow: 2, toRow: 3, fromCol: 2, toCol: 3 });
  assert(cols.ok);
  assert.deepEqual(cols.cells, [...known("Sheet", 2).slice(1, 3), ...known("Sheet", 3).slice(1, 3)]);
  const byIndex = await xlsxEntry.cellsIn(bytes, { sheet: 0, fromRow: 1, toRow: 1 });
  assert(byIndex.ok);
  assert.deepEqual(byIndex.cells, known("Sheet", 1));
  const past = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 5001, toRow: 6000 });
  assert(past.ok);
  assert.deepEqual([past.ok, past.cells, "next_row" in past], [true, [], false]);
  const head = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 1, toRow: 2 });
  assert(head.ok);
  assert.deepEqual(head.cells, [...known("Sheet", 1), ...known("Sheet", 2)]);
  /* no toRow: to the end of the sheet, bounded by maxCells */
  const tail = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 4999, maxCells: 100 });
  assert(tail.ok);
  assert.deepEqual(tail.cells, [...known("Sheet", 4999), ...known("Sheet", 5000)]);
  assert.ok(!("next_row" in tail));
});

test("R37 cellsIn maxCells: whole rows only, at most maxCells (the first row whole if alone it is over), then next_row says where to go on", async () => {
  const bytes = gridBytes();
  const a = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 1, toRow: 5000, maxCells: 10 });
  assert.equal(a.ok, true);
  assert.equal(a.cells.length, 8);
  assert.deepEqual(a.rows, { from: 1, to: 2 });
  const aNext = a.next_row;
  assert.equal(aNext, 3);
  const b = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: aNext, toRow: 5000, maxCells: 10 });
  assert(b.ok);
  assert.deepEqual(b.cells, [...known("Sheet", 3), ...known("Sheet", 4)]);
  assert.equal(b.next_row, 5);
  const one = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 7, toRow: 9, maxCells: 2 });
  assert(one.ok);
  assert.deepEqual(one.cells, known("Sheet", 7));
  assert.equal(one.next_row, 8);
  /* exactly maxCells to the end of the range: nothing follows */
  const exact = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: 4999, toRow: 5000, maxCells: 8 });
  assert(exact.ok);
  assert.equal(exact.cells.length, 8);
  assert.ok(!("next_row" in exact));
  /* continued by next_row, the pieces are the whole answer */
  /** @type {TypedCell[]} */
  const got = [];
  /** @type {number | undefined} */
  let from = 1;
  for (let guard = 0; guard < 10; guard++) {
    /** @type {number | undefined} */
    const at = from;
    if (at == null) break;
    const p = await xlsxEntry.cellsIn(bytes, { sheet: "Sheet", fromRow: at, toRow: 12, maxCells: 12 });
    assert(p.ok);
    got.push(...p.cells);
    from = p.next_row;
  }
  /** @type {KnownCell[]} */
  const want = []; for (let n = 1; n <= 12; n++) want.push(...known("Sheet", n));
  assert.deepEqual(got, want);
});

test("R37 cellsIn refuses by name, never throws: no such sheet, not a workbook, bad arguments, a part that cannot be read", async () => {
  const bytes = gridBytes({ rows: 10 });
  const nope = await xlsxEntry.cellsIn(bytes, { sheet: "Nope", fromRow: 1, toRow: 2 });
  assert.deepEqual("reason" in nope ? nope.reason : undefined, "no_such_sheet");
  assert.equal((await xlsxEntry.cellsIn(bytes, { sheet: 5, fromRow: 1, toRow: 2 })).ok, false);
  assert.equal((await xlsxEntry.cellsIn(new Uint8Array([1, 2, 3]), { sheet: "Sheet", fromRow: 1, toRow: 2 })).ok, false);
  for (const bad of [undefined, null, {}, { sheet: "Sheet", fromRow: "x" }, { sheet: "Sheet", fromRow: 0 }, { sheet: "Sheet", fromRow: 5, toRow: 2 },
    { sheet: "Sheet", fromRow: 1, maxCells: 0 }, { sheet: "Sheet", fromRow: 1, fromCol: 3, toCol: 1 }]) {
    const r = await xlsxEntry.cellsIn(bytes, bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(typeof r.reason, "string");
  }
  const corrupt = F.xlsx({ sheets: [{ name: "S", data: { rows: [{ r: 1, cells: [{ r: "A1", v: "1" }] }] }, cd: F.CORRUPT }] });
  const c = await xlsxEntry.cellsIn(corrupt, { sheet: "S", fromRow: 1, toRow: 1 });
  assert.equal(c.ok, false);
  assert.match(c.reason, /crc_mismatch/);
  /* over the streamed ceiling the text is not read, and cellsIn says so */
  const over = F.xlsx({ sheets: [{ name: "S", data: { rows: [] }, cd: F.OVER }] });
  const o = await xlsxEntry.cellsIn(over, { sheet: "S", fromRow: 1, toRow: 1 });
  assert.equal(o.ok, false);
  assert.equal(o.reason, "over_size_bound");
});

/* The workbook over the whole-read guard at the real shape: 200,000 rows of 3 short cells, about 30.6 MB declared. */
/** @param {number} [rows] @returns {{bytes: Uint8Array, lines: string[], declared: number}} */
function longSheet(rows = 200000) {
  /** @type {string[]} */
  const body = [];
  /** @type {string[]} */
  const lines = [];
  for (let r = 1; r <= rows; r++) {
    const word = `w${String(r % 10007).padStart(5, "0")}`;
    body.push(`<row r="${r}"><c r="A${r}"><v>${r}</v></c><c r="B${r}" t="inlineStr"><is><t>${word}</t></is></c><c r="C${r}" s="1"><v>${r}.5</v></c></row>`);
    lines.push(`${r}\t${word}\t${r}.5`);
  }
  const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body.join("")}</sheetData></worksheet>`;
  return { bytes: F.xlsx({ sheets: [{ name: "Big", xml }] }), lines, declared: F.enc(xml).length };
}
/** @param {number} r @returns {KnownCell[]} */
const longKnown = (r) => [
  { source: ref("Big", `A${r}`), value: String(r), type: "number", declared: null, cached: null, formula: null },
  { source: ref("Big", `B${r}`), value: `w${String(r % 10007).padStart(5, "0")}`, type: "text", declared: "inlineStr", cached: null, formula: null },
  { source: ref("Big", `C${r}`), value: `${r}.5`, type: "number", declared: null, cached: null, formula: null },
];

test("R37 R35 R36: a 200,000-row x 3-cell workbook (over the whole-read bound) yields every row's text once, its cells held, and cellsIn answers its last rows, in a capped old space", async (t) => {
  const f = longSheet();
  assert.ok(f.declared > 20 * MIB && f.declared < 32 * MIB, `declares ${f.declared}`);
  const text = await xlsxEntry.text(f.bytes, { inlineCellsMax: INLINE_CELLS_MAX_BYTES });
  assert.equal(text.ok, true);
  assert.ok(text.piecewise, "over the whole-read bound the statement stands (R35)");
  const s = nth(text.sheets, 0);
  same(s.text, f.lines.join("\n"), "sheet text");
  const lineRows = s.lineRows;
  assert.equal(lineRows?.length, 200000);
  assert.equal(lineRows?.[199999], 200000);
  assert.ok(s.cells === null, "cells are not listed");
  assert.equal(s.cells_held, true);
  assert.equal(s.usedRows, 200000);
  /* the unopted read over the bound lists none either, and says nothing of held (R35 as it stood) */
  const plain = await xlsxEntry.text(f.bytes);
  assert(plain.ok);
  assert.ok(nth(plain.sheets, 0).cells === null, "cells are not listed");
  assert.ok(!("cells_held" in nth(plain.sheets, 0)));
  const r = await xlsxEntry.cellsIn(f.bytes, { sheet: "Big", fromRow: 199990, toRow: 200000 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cells, [199990, 199991, 199992, 199993, 199994, 199995, 199996, 199997, 199998, 199999, 200000].flatMap(longKnown));
  assert.deepEqual(r.rows, { from: 199990, to: 200000 });
  const mid = await xlsxEntry.cellsIn(f.bytes, { sheet: "Big", fromRow: 100000, toRow: 100001, fromCol: 2, toCol: 2 });
  assert(mid.ok);
  assert.deepEqual(mid.cells, [longKnown(100000)[1], longKnown(100001)[1]]);

  /* in a child whose old space is capped: the platform's object leaves the read 79 MB less the file's size above the
     idle of its plane; the child's idle is 17 MB and the lowest cap this read survives is 36 (cellsIn 24), so 56 holds
     the read well inside what the platform leaves */
  const dir = mkdtempSync(join(tmpdir(), "g41-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "big.xlsx");
  writeFileSync(file, f.bytes);
  /** @param {...string} args @returns {Promise<unknown>} */
  const child = async (...args) => JSON.parse((await run(process.execPath,
    ["--expose-gc", `--max-old-space-size=${CHILD_OLD_SPACE_MB}`, join(HERE, "g41-peak.mjs"), file, ...args], { maxBuffer: 1 << 26 })).stdout);
  const read = /** @type {G41TextReport} */ (await child("text"));
  const cellsAt = /** @type {G41CellsReport} */ (await child("cellsIn", "199990", "200000"));
  t.diagnostic(`declared ${f.declared} B, package ${f.bytes.length} B; child idle ${read.idleMB.toFixed(1)} MB, old space ${CHILD_OLD_SPACE_MB} MB`);
  assert.equal(read.answer.lines, 200000);
  assert.ok(read.answer.cells === null, "cells are not listed");
  assert.equal(read.answer.cells_held, true);
  const cellsAnswer = cellsAt.answer;
  assert(cellsAnswer.ok);
  assert.equal(cellsAnswer.cells.length, 33);
});

const CHILD_OLD_SPACE_MB = 56;

test("R36 R37 a cell type outside the format's list is stated whether the cells are listed or held, and by cellsIn for its range", async () => {
  const xml = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`
    + `<row r="1"><c r="A1" t="zz"><v>odd</v></c><c r="B1"><v>2</v></c></row></sheetData></worksheet>`;
  const bytes = F.xlsx({ sheets: [{ name: "S", xml }] });
  /** @param {XlsxText | ReadFailure} t */
  const stated = (t) => {
    assert(t.ok);
    return t.undetermined.flatMap((u) => ("reason" in u && u.reason === "cell_type_unknown" ? ["cell" in u ? u.cell : undefined] : []));
  };
  assert.deepEqual(stated(await xlsxEntry.text(bytes)), ["A1"]);
  assert.deepEqual(stated(await xlsxEntry.text(bytes, { inlineCellsMax: 0 })), ["A1"]);
  const r = await xlsxEntry.cellsIn(bytes, { sheet: "S", fromRow: 1, toRow: 1 });
  assert(r.ok);
  assert.deepEqual(r.undetermined.map((u) => [u.cell, u.reason]), [["A1", "cell_type_unknown"]]);
  assert.equal(r.cells.length, 2);
  assert.equal(nth(r.cells, 0).type, null);
});
