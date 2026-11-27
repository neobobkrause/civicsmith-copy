/* office-readers, N724 (T36-3; K1972): a .docx table's `cells`, held as R30
 * holds a sheet's (R11's docx arm), each addressed by its `doc-table`
 * reference with its cell (R16). Driven through docxEntry.text() on packages
 * built by ./fixtures.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { docxEntry, docTableRef } from "../../../src/docx.mjs";
import * as F from "./fixtures.mjs";

/** @param {number} table @param {string} cell @param {string} value @param {number[]} paras */
const tc = (table, cell, value, paras) => ({ source: docTableRef(table, cell), value, type: "text", declared: null, cached: null, formula: null, paras });
/** @param {number} n */
const grid = (n) => `<w:tblGrid>${"<w:gridCol/>".repeat(n)}</w:tblGrid>`;
/** @param {string} pr @param {...string} paras */
const cell = (pr, ...paras) => `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ""}${paras.length ? paras.join("") : "<w:p/>"}</w:tc>`;
/** @param {string} t */
const txt = (t) => F.wp(F.wr(t));
/** @param {...string} cells */
const row = (...cells) => `<w:tr>${cells.join("")}</w:tr>`;
/** @param {number} cols @param {...string} rows */
const tbl = (cols, ...rows) => `<w:tbl>${grid(cols)}${rows.join("")}</w:tbl>`;
/** @param {string} body */
const tables = async (body) => {
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  return t.tables;
};
const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';

test("R11 R16 docx table cells: one per cell holding text, in row then column order, addressed by doc-table with its A1 cell, every one text with nothing declared, cached or calculated", async () => {
  /* a date and an amount, as a disclosure table carries them: held as written, no type inferred */
  const body = txt("intro") + tbl(3,
    row(cell("", txt("Date")), cell("", txt("Payee")), cell("", txt("Amount"))),
    row(cell("", txt("2026-03-14")), cell("", txt("Acme, Inc.")), cell("", txt("$1,250.00"))),
    row(cell("", "<w:p/>"), cell("", txt("blank date")), cell("", F.wp())),
  );
  assert.deepEqual(await tables(body), [{ table: 0, ref: "table 1", rows: 3, cols: 3, cells: [
    tc(0, "A1", "Date", [1]), tc(0, "B1", "Payee", [2]), tc(0, "C1", "Amount", [3]),
    tc(0, "A2", "2026-03-14", [4]), tc(0, "B2", "Acme, Inc.", [5]), tc(0, "C2", "$1,250.00", [6]),
    tc(0, "B3", "blank date", [8]),
  ] }]);
});

test("R11 docx table cells: a cell's value is its text as document carries it — non-empty paragraphs newline-joined, w:ins in, w:delText never, tabs and breaks kept", async () => {
  const body = tbl(1, row(cell("",
    F.wp(F.wr("first "), '<w:ins w:author="a">' + F.wr("added") + "</w:ins>", '<w:del><w:r><w:delText>gone</w:delText></w:r></w:del>'),
    "<w:p/>",
    F.wp("<w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r>"),
    txt("&amp;&lt;"),
  )));
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  const cells = t.tables?.[0]?.cells;
  assert(cells);
  assert.deepEqual(cells, [tc(0, "A1", "first added\na\tb\nc\n&<", [0, 2, 3])]);
  const first = cells[0];
  assert(first);
  assert.equal(t.document, first.value, "the same text, read once");
  assert.ok(!first.value.includes("gone"));
});

test("R11 docx table cells: a merged cell is one entry at its first grid position — gridSpan moves the next cell, gridBefore starts the row, vMerge and hMerge continuations join the cell they continue", async () => {
  const body = tbl(4,
    row(cell('<w:vMerge w:val="restart"/>', txt("tall")), cell('<w:gridSpan w:val="2"/>', txt("wide")), cell("", txt("D1"))),
    row(cell("<w:vMerge/>", "<w:p/>"), cell("", txt("B2")), cell('<w:hMerge w:val="restart"/>', txt("h")), cell("<w:hMerge/>", txt("h more"))),
    `<w:tr><w:trPr><w:gridBefore w:val="2"/></w:trPr>${cell("", txt("C3"))}${cell("", txt("D3"))}</w:tr>`,
    row(cell('<w:vMerge w:val="continue"/>', txt("tall tail")), cell("", txt("B4"))),
    row(cell("", txt("A5")), cell('<w:vMerge w:val="continue"/>', txt("orphan"))),
  );
  assert.deepEqual((await tables(body))?.[0]?.cells, [
    tc(0, "A1", "tall\ntall tail", [0, 9]), tc(0, "B1", "wide", [1]), tc(0, "D1", "D1", [2]),
    tc(0, "B2", "B2", [4]), tc(0, "C2", "h\nh more", [5, 6]),
    tc(0, "C3", "C3", [7]), tc(0, "D3", "D3", [8]),
    tc(0, "B4", "B4", [10]),
    tc(0, "A5", "A5", [11]), tc(0, "B5", "orphan", [12]),
  ], "a continuation with no restart above it stands as its own cell");
});

test("R11 R16 docx table cells: a nested table's cells are its own table's, numbered as it opens; the outer cell keeps only its own paragraphs, before and after the nested table", async () => {
  const inner = tbl(2, row(cell("", txt("i1")), cell("", txt("i2"))));
  const body = tbl(2,
    row(cell("", txt("o1")), cell("", txt("before"), inner, txt("after"))),
    row(cell("", txt("o2"))),
  ) + tbl(1, row(cell("", txt("next"))));
  assert.deepEqual(await tables(body), [
    { table: 0, ref: "table 1", rows: 2, cols: 2, cells: [tc(0, "A1", "o1", [0]), tc(0, "B1", "before\nafter", [1, 4]), tc(0, "A2", "o2", [5])] },
    { table: 1, ref: "table 2", rows: 1, cols: 2, cells: [tc(1, "A1", "i1", [2]), tc(1, "B1", "i2", [3])] },
    { table: 2, ref: "table 3", rows: 1, cols: 1, cells: [tc(2, "A1", "next", [6])] },
  ]);
});

test("R11 docx table cells: a text box in a cell is the cell's text; an mc:AlternateContent branch not read adds nothing to any cell", async () => {
  /** @param {string} c @param {string} f */
  const ac = (c, f) => `<mc:AlternateContent ${MC}><mc:Choice Requires="wps">${c}</mc:Choice><mc:Fallback>${f}</mc:Fallback></mc:AlternateContent>`;
  /** @param {string} t */
  const box = (t) => `<w:txbxContent>${txt(t)}</w:txbxContent>`;
  const body = tbl(2, row(
    cell("", F.wp(F.wr("anchor "), `<w:r>${ac(`<w:drawing>${box("boxed")}</w:drawing>`, `<w:pict>${box("vml copy")}</w:pict>`)}</w:r>`)),
    cell("", F.wp(`<w:r>${ac("<w:t>chosen</w:t>", "<w:t>fallback</w:t>")}</w:r>`)),
  ));
  assert.deepEqual((await tables(body))?.[0]?.cells, [tc(0, "A1", "anchor \nboxed", [0, 1]), tc(0, "B1", "chosen", [2])]);
});

test("R11 docx table cells: every table paragraph's text is in exactly one cell, and none from outside a table", async () => {
  const body = txt("outside") + tbl(3,
    row(cell('<w:gridSpan w:val="2"/>', txt("x1"), txt("x2")), cell("", tbl(1, row(cell("", txt("deep")))), txt("y"))),
    row(cell("", txt("z")), cell("", "<w:p/>"), cell("<w:vMerge/>", txt("w"))),
  ) + txt("also outside");
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  const tbls = t.tables;
  assert(tbls);
  /** @param {number} p */
  const textOf = (p) => {
    const para = t.paragraphs[p];
    assert(para);
    return para.text;
  };
  const inCells = tbls.flatMap((x) => {
    const xc = x.cells;
    assert(xc);
    return xc.flatMap((c) => c.value.split("\n"));
  });
  const tableTexts = t.paragraphs.map((p) => p.text).filter((s) => s && !s.includes("outside"));
  assert.deepEqual([...inCells].sort(), [...tableTexts].sort());
  for (const x of tbls) {
    const xc = x.cells;
    assert(xc);
    for (const c of xc) {
      assert.deepEqual(Object.keys(c), ["source", "value", "type", "declared", "cached", "formula", "paras"]);
      assert.equal(c.value, c.paras.map((p) => textOf(p)).join("\n"), "value is its paras' text");
      assert.deepEqual(c.source, docTableRef(x.table, c.source.cell));
      const at = c.source.cell;
      assert(typeof at === "string");
      assert.match(at, /^[A-Z]+[1-9]\d*$/);
    }
  }
});

test("R11 docx table cells: a table with no text has cells []; a body not read (over the guard, unreadable) has tables null, so no cells", async () => {
  assert.deepEqual(await tables(tbl(2, row(cell(""), "<w:tc/>"))), [{ table: 0, ref: "table 1", rows: 1, cols: 2, cells: [] }]);
  const over = await docxEntry.text(F.docx({ body: tbl(1, row(cell("", txt("x")))), mainCd: F.OVER }));
  assert(over.ok);
  assert.equal(over.tables, null);
  const corrupt = await docxEntry.text(F.docx({ body: tbl(1, row(cell("", txt("x")))), mainCd: F.CORRUPT }));
  assert(corrupt.ok);
  assert.equal(corrupt.tables, null);
  /* a table the body never closed keeps the cells seen */
  const cut = F.wdoc(tbl(1, row(cell("", txt("seen")))).replace("</w:tbl>", "")).replace("</w:body></w:document>", "");
  const unclosed = await docxEntry.text(F.docx({ document: cut }));
  assert(unclosed.ok);
  assert.deepEqual(unclosed.tables?.[0]?.cells, [tc(0, "A1", "seen", [0])]);
});

test("R11 docx table cells: each cell's paras are the ordinals of the paragraphs its value was read from, in reading order; a vertically merged cell's span its rows, so its paragraphs are found exactly, never by matching lines", async () => {
  /* A1 is merged down three rows; its lines sit between other cells' in the
     body, and "Total" is written twice, so a run of matched lines would find
     the wrong paragraph. */
  const body = txt("before") + tbl(3,
    row(cell('<w:vMerge w:val="restart"/>', txt("Fund"), "<w:p/>"), cell("", txt("Total")), cell("", txt("100"))),
    row(cell("<w:vMerge/>", txt("Total")), cell("", txt("Spent")), cell("", txt("40"))),
    row(cell('<w:vMerge w:val="continue"/>', "<w:p/>", txt("(restricted)")), cell('<w:vMerge w:val="restart"/>', txt("Left")), cell("", txt("60"))),
    row(cell("", txt("Note")), cell("<w:vMerge/>", txt("Total")), cell("", "<w:p/>")),
  ) + txt("after");
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  assert.deepEqual(t.paragraphs.map((p) => [p.para, p.text]), [
    [0, "before"], [1, "Fund"], [2, ""], [3, "Total"], [4, "100"], [5, "Total"], [6, "Spent"], [7, "40"],
    [8, ""], [9, "(restricted)"], [10, "Left"], [11, "60"], [12, "Note"], [13, "Total"], [14, ""], [15, "after"],
  ]);
  const cells = t.tables?.[0]?.cells;
  assert(cells);
  assert.deepEqual(cells, [
    tc(0, "A1", "Fund\nTotal\n(restricted)", [1, 5, 9]), tc(0, "B1", "Total", [3]), tc(0, "C1", "100", [4]),
    tc(0, "B2", "Spent", [6]), tc(0, "C2", "40", [7]),
    tc(0, "B3", "Left\nTotal", [10, 13]), tc(0, "C3", "60", [11]),
    tc(0, "A4", "Note", [12]),
  ]);
  /* full compliance: every cell's value is exactly its paras' texts, in order; every non-empty table paragraph is
     in exactly one cell; no empty paragraph and none outside the table is named */
  /** @param {number} p */
  const textOf = (p) => {
    const para = t.paragraphs[p];
    assert(para);
    return para.text;
  };
  /** @type {number[]} */
  const named = [];
  for (const c of cells) {
    assert.ok(c.paras.every((p, i) => {
      const prev = c.paras[i - 1];
      return i === 0 || (prev !== undefined && p > prev);
    }), "reading order");
    assert.equal(c.value, c.paras.map((p) => textOf(p)).join("\n"));
    named.push(...c.paras);
  }
  assert.deepEqual(named.sort((a, b) => a - b), [1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13]);
  /* a nested table's paragraphs are its own cells', and the ordinals stay the body walk's */
  const nested = await docxEntry.text(F.docx({ body: tbl(1, row(cell('<w:vMerge w:val="restart"/>', txt("o"), tbl(1, row(cell("", txt("i")))))), row(cell("<w:vMerge/>", txt("o2")))) }));
  assert(nested.ok);
  assert.deepEqual(nested.tables?.map((x) => x.cells?.map((c) => [c.source.ref, c.paras])), [[["table 1, A1", [0, 2]]], [["table 2, A1", [1]]]]);
});
