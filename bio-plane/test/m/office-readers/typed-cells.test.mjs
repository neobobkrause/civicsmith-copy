/* R30 (typed cells) and R31 (office metadata in text()), at the interface. */
import test from "node:test";
import assert from "node:assert/strict";
import * as F from "./fixtures.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { CORE_PROPERTIES_PART } from "../../../src/ooxml.mjs";
/** @import {CellType, TypedCell} from "../../../src/formats-xlsx.mjs" */
/** @import {DocxOptions, Flavour, PptxOptions, XlsxOptions} from "./fixtures.mjs" */

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
/** @param {string} sheet @param {string} cell */
const ref = (sheet, cell) => ({ kind: "sheet-cell", ref: `${sheet}!${cell}`, sheet, cell });
/**
 * @param {string} sheet @param {string} cell @param {string | null} value @param {CellType | null} type
 * @param {string | null} declared @param {string | null} [cached] @param {string | null} [formula]
 */
const cellOf = (sheet, cell, value, type, declared, cached = null, formula = null) =>
  ({ source: ref(sheet, cell), value, type, declared, cached, formula });

test("R30 xlsx cells: every cell holding a value or formula, typed only from `t`, lexical value kept, formula beside its cached value, row then column order", async () => {
  /* Written out of order on purpose (B2 before A2, row 3 before row 1), with
     an empty cell, a styled number (s="1"; the workbook has no styles part, so no
     date is typed from it: the date rule is dates-typed.test.mjs), a formula with no cached value, and every declared type. */
  const xml = `<?xml version="1.0"?><worksheet ${NS}><sheetData>`
    + `<row r="3"><c r="A3" t="str"><f>A1&amp;"!"</f><v>zero!</v></c><c r="B3"><f>SUM(B1:B2)</f></c></row>`
    + `<row r="1"><c r="C1" t="b"><v>1</v></c><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0.1</v></c><c r="D1" t="n"><v>1E+21</v></c></row>`
    + `<row r="2"><c r="B2" s="1"><v>45200</v></c><c r="A2" t="d"><v>2026-10-05T00:00:00</v></c><c r="C2" t="inlineStr"><is><t>inline</t></is></c><c r="D2" t="e"><v>#DIV/0!</v></c><c r="E2" s="3"/></row>`
    + `</sheetData></worksheet>`;
  const b = F.xlsx({ sheets: [{ name: "S", xml }], sharedStrings: F.sst(["zero"]) });
  const t = await xlsxEntry.text(b);
  assert(t.ok);
  const sheet = t.sheets[0];
  assert(sheet);
  const cells = sheet.cells;
  assert(cells);
  assert.deepEqual(sheet.cells, [
    cellOf("S", "A1", "zero", "text", "s"),
    cellOf("S", "B1", "0.1", "number", null),
    cellOf("S", "C1", "1", "boolean", "b"),
    cellOf("S", "D1", "1E+21", "number", "n"),
    cellOf("S", "A2", "2026-10-05T00:00:00", "date", "d"),
    cellOf("S", "B2", "45200", "number", null),
    cellOf("S", "C2", "inline", "text", "inlineStr"),
    cellOf("S", "D2", "#DIV/0!", "error", "e"),
    cellOf("S", "A3", "zero!", "text", "str", "zero!", 'A1&"!"'),
    cellOf("S", "B3", null, "number", null, null, "SUM(B1:B2)"),
  ]);
  /* The pair R10 holds is the same pair. */
  const s = await xlsxEntry.structure(b);
  assert(s.ok);
  const formulas = s.evidentiary.items.flatMap((i) => (i.kind === "formula" ? [i] : []));
  for (const f of formulas) {
    /** @type {TypedCell | undefined} */
    const c = cells.find((x) => x.source.cell === f.source.cell);
    assert(c);
    assert.deepEqual([c.formula, c.cached], [f.formula, f.value]);
  }
  assert.equal(formulas.length, cells.filter((c) => c.formula != null).length);
  /* The text stream is untouched by the typed cells: still file order. */
  assert.equal(sheet.text, "zero!\nTRUE\tzero\t0.1\t1E+21\n45200\t2026-10-05T00:00:00\tinline\t#DIV/0!");
});

test("R30 xlsx cells: an unresolved shared string keeps its entry with value null and stays undetermined; an undeclared type token is named; a cell with no address is placed by its position (R48: the column after the last); an empty sheet has []", async () => {
  const xml = `<?xml version="1.0"?><worksheet ${NS}><sheetData>`
    + `<row r="1"><c r="A1" t="s"><v>9</v></c><c r="B1" t="zz"><v>q</v></c><c t="inlineStr"><is><t>loose</t></is></c></row>`
    + `</sheetData></worksheet>`;
  const t = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", xml }, { name: "E", data: {} }], sharedStrings: F.sst(["only"]) }));
  assert(t.ok);
  const [s0, s1] = t.sheets;
  assert(s0 && s1);
  assert.deepEqual(s0.cells, [
    cellOf("S", "A1", null, "text", "s"),
    cellOf("S", "B1", "q", null, "zz"),
    cellOf("S", "C1", "loose", "text", "inlineStr"),
  ]);
  assert.deepEqual(s0.undetermined, [
    { sheet: 0, cell: "A1", reason: "shared_string_index_out_of_range" },
    { sheet: 0, cell: "B1", reason: "cell_type_unknown" },
  ]);
  assert.deepEqual(s1.cells, []);
  const unread = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: {}, cd: F.CORRUPT }] }));
  assert(unread.ok);
  const unreadSheet = unread.sheets[0];
  assert(unreadSheet);
  assert.equal(unreadSheet.cells, null, "a sheet not walked has null cells, never []");
});

test("R30 over the size guard: no sheet is walked, so no cells are given (sheets [] for xlsx)", async () => {
  const x = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "S", data: { rows: [{ r: 1, cells: [{ r: "A1", v: "1" }] }] }, cd: F.OVER }] }));
  assert(x.ok);
  assert.equal(x.document, null);
  assert.deepEqual(x.sheets, []);
});

const CORE = { creator: "A. Clerk", lastModifiedBy: "B. Editor", revision: "4",
  created: "2026-01-02T03:04:05Z", modified: "2026-02-03T04:05:06.7+08:00", title: "T" };
/** @type {{docx: (o: DocxOptions) => Uint8Array, pptx: (o: PptxOptions) => Uint8Array, xlsx: (o: XlsxOptions) => Uint8Array}} */
const build = {
  docx: (o) => F.docx(o),
  pptx: (o) => F.pptx(o),
  xlsx: (o) => F.xlsx(o),
};
const entries = { docx: docxEntry, pptx: pptxEntry, xlsx: xlsxEntry };
/** @type {Flavour[]} the keys of `entries`, in its order */
const FORMATS = ["docx", "pptx", "xlsx"];

test("R31 docx, pptx and xlsx text() carry metadata: the core part's author, lastModifiedBy, created, modified as written, each null when absent", async () => {
  for (const fmt of FORMATS) {
    const entry = entries[fmt];
    const t = await entry.text(build[fmt]({ core: F.core(CORE) }));
    assert(t.ok);
    const md = t.metadata;
    assert.deepEqual(md, { author: "A. Clerk", lastModifiedBy: "B. Editor",
      /** @copyof ooxml:CORE_PROPERTIES_PART */
      created: "2026-01-02T03:04:05Z", modified: "2026-02-03T04:05:06.7+08:00", source: "docProps/core.xml",
      ...(fmt === "xlsx" ? undefined : { title: "T" }) }, fmt);
    /* the same values the core-properties item holds (R10) */
    const st = await entry.structure(build[fmt]({ core: F.core(CORE) }));
    assert(st.ok);
    const item = st.evidentiary.items.find((i) => i.kind === "core-properties");
    assert(item?.kind === "core-properties");
    assert.deepEqual([md.author, md.lastModifiedBy, md.created, md.modified],
      [item.creator, item.lastModifiedBy, item.created, item.modified], fmt);
    const sparse = await entry.text(build[fmt]({ core: F.core({ title: "only" }) }));
    assert(sparse.ok);
    /** @copyof ooxml:CORE_PROPERTIES_PART */
    assert.deepEqual(sparse.metadata, { author: null, lastModifiedBy: null, created: null, modified: null, source: "docProps/core.xml",
      ...(fmt === "xlsx" ? undefined : { title: "only" }) }, fmt);
  }
});

test("R31 metadata is null with no readable core part: absent (no marker) or unreadable (its reason in undetermined); given over the size guard too", async () => {
  for (const fmt of FORMATS) {
    const entry = entries[fmt];
    const none = await entry.text(build[fmt]({}));
    assert(none.ok);
    assert.equal(none.metadata, null, fmt);
    assert.ok(!none.undetermined.some((u) => "part" in u && u.part === CORE_PROPERTIES_PART), fmt);
    const bad = await entry.text(build[fmt]({ extra: [{ name: CORE_PROPERTIES_PART, data: F.core(CORE), cd: F.CORRUPT }] }));
    assert(bad.ok);
    assert.equal(bad.metadata, null, fmt);
    assert.deepEqual(bad.undetermined.filter((u) => "part" in u && u.part === CORE_PROPERTIES_PART),
      /** @copyof ooxml:CORE_PROPERTIES_PART */
      [{ reason: "metadata_unreadable", part: "docProps/core.xml", why: "crc_mismatch" }], fmt);
    assert.equal(bad.counts.undetermined, bad.undetermined.length, fmt);
    const notCore = await entry.text(build[fmt]({ core: "<x/>" }));
    assert(notCore.ok);
    assert.deepEqual(notCore.undetermined.filter((u) => "part" in u && u.part === CORE_PROPERTIES_PART),
      /** @copyof ooxml:CORE_PROPERTIES_PART */
      [{ reason: "metadata_unreadable", part: "docProps/core.xml", why: "core_properties_unparseable" }], fmt);
  }
  const over = {
    docx: F.docx({ core: F.core(CORE), mainCd: F.OVER }),
    pptx: F.pptx({ core: F.core(CORE), slides: [{ file: "slide1.xml", texts: ["x"], cd: F.OVER }] }),
    xlsx: F.xlsx({ core: F.core(CORE), sheets: [{ name: "S", data: {}, cd: F.OVER }] }),
  };
  for (const fmt of FORMATS) {
    const entry = entries[fmt];
    const t = await entry.text(over[fmt]);
    assert(t.ok);
    assert.equal(t.document, null, fmt);
    assert.equal(t.metadata?.author, "A. Clerk", fmt);
  }
});

test("R34 docx and pptx metadata carries the core part's title as written; no title key when absent, empty or blank; null with no core part; xlsx unchanged", async () => {
  /** @type {Flavour[]} */
  const titledFormats = ["docx", "pptx"];
  for (const fmt of titledFormats) {
    const entry = entries[fmt];
    const titled = await entry.text(build[fmt]({ core: F.core({ creator: "A", title: "Budget  Memo " }) }));
    assert(titled.ok);
    const tm = titled.metadata;
    assert.equal(tm?.title, "Budget  Memo ", fmt);
    assert.equal(tm?.author, "A", fmt);
    for (const core of [F.core({ creator: "A" }), F.core({ creator: "A", title: "" }), F.core({ creator: "A", title: "  \t " })]) {
      const read = await entry.text(build[fmt]({ core }));
      assert(read.ok);
      const m = read.metadata;
      assert.ok(m && !("title" in m), fmt);
      assert.equal(m.author, "A", fmt);
    }
    const none = await entry.text(build[fmt]({}));
    assert(none.ok);
    assert.equal(none.metadata, null, fmt);
  }
  const xr = await xlsxEntry.text(build.xlsx({ core: F.core({ title: "T" }) }));
  assert(xr.ok);
  const x = xr.metadata;
  assert(x);
  assert.ok(!("title" in x));
});
