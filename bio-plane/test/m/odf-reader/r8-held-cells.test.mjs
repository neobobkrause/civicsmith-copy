/* odf-reader R49 (fix round 9, G133a; S-2): held cells and windows. `text(partsOrBytes, {inlineCellsMax, yieldNow})` and
   the optional `cellsIn` slot, through the entry's real operations; the 20,400,000-byte content.xml runs in a child at
   --max-old-space-size=112. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { odsEntry } from "../../../src/odf.mjs";
import { ods, gridBody, gridCells, tableOf, rowOf, cellOf, floatOf } from "./r9.mjs";

/** @typedef {import("../../../src/odf.mjs").OdsTextSheet} OdsTextSheet */

const here = dirname(fileURLToPath(import.meta.url));

test("R49 inlineCellsMax: past the bound every sheet has cells null and cells_held true, and text, lineRows, extent and counts are the whole read's", async () => {
  const bytes = ods(gridBody(30, 4, { name: "A" }) + gridBody(10, 2, { name: "B" }));
  const whole = await odsEntry.text(bytes);
  assert.ok(whole.ok);
  const [whole0] = whole.sheets;
  assert.ok(whole0);
  const wholeCells0 = whole0.cells;
  assert.ok(wholeCells0);
  assert.equal(wholeCells0.length, 120);
  assert.equal("cells_held" in whole0, false);
  const held = await odsEntry.text(bytes, { inlineCellsMax: 1000 });
  assert.equal(held.ok, true);
  /** @type {("text" | "lineRows" | "usedRows" | "usedCols" | "range" | "name" | "hidden")[]} */
  const same = ["text", "lineRows", "usedRows", "usedCols", "range", "name", "hidden"];
  for (const [i, s] of held.sheets.entries()) {
    assert.equal(s.cells, null);
    assert.equal(s.cells_held, true);
    /** @type {OdsTextSheet | undefined} */
    const w = whole.sheets[i];
    assert.ok(w);
    for (const k of same) assert.deepEqual(s[k], w[k], k);
  }
  assert.deepEqual(held.counts, whole.counts);
  assert.equal(held.document, whole.document);
});

test("R49 inlineCellsMax: within the bound every cell is listed and no sheet says held", async () => {
  const bytes = ods(gridBody(3, 2));
  const whole = await odsEntry.text(bytes);
  assert.ok(whole.ok);
  const [whole0] = whole.sheets;
  assert.ok(whole0);
  const roomy = await odsEntry.text(bytes, { inlineCellsMax: 1e6 });
  assert.ok(roomy.ok);
  const [roomy0] = roomy.sheets;
  assert.ok(roomy0);
  assert.deepEqual(roomy0.cells, whole0.cells);
  assert.equal("cells_held" in roomy0, false);
  const none = await odsEntry.text(bytes, { inlineCellsMax: 0 });
  assert.ok(none.ok);
  const [none0] = none.sheets;
  assert.ok(none0);
  assert.equal(none0.cells, null);
});

test("R49 cellsIn: the typed cells of exactly those rows and columns, in row then column order, identical to the whole read's", async () => {
  const bytes = ods(gridBody(40, 5));
  const wholeRead = await odsEntry.text(bytes);
  assert.ok(wholeRead.ok);
  const [whole0] = wholeRead.sheets;
  assert.ok(whole0);
  const whole = whole0.cells;
  assert.ok(whole);
  assert.equal(typeof odsEntry.cellsIn, "function");
  const a = await odsEntry.cellsIn(bytes, { sheet: "Grid", fromRow: 10, toRow: 14 });
  assert.equal(a.ok, true);
  assert.deepEqual(a.cells, whole.slice(45, 70));
  assert.deepEqual(a.rows, { from: 10, to: 14 });
  assert.equal("next_row" in a, false);
  const b = await odsEntry.cellsIn(bytes, { sheet: 0, fromRow: 3, toRow: 4, fromCol: 2, toCol: 3 });
  assert.ok(b.ok);
  assert.deepEqual(b.cells, gridCells("Grid", 5, 3, 4).filter((c) => /^[BC]/.test(c.source.cell)));
  const parts = await odsEntry.parts(bytes);
  const fromParts = await odsEntry.cellsIn(parts, { sheet: "Grid", fromRow: 40, toRow: 40 });
  assert.ok(fromParts.ok);
  assert.deepEqual(fromParts.cells, whole.slice(195));
});

test("R49 cellsIn: maxCells stops before the row that would pass it and names it; the first row is given whole", async () => {
  const bytes = ods(gridBody(20, 5));
  const a = await odsEntry.cellsIn(bytes, { sheet: "Grid", fromRow: 2, maxCells: 12 });
  assert.equal(a.ok, true);
  assert.equal(a.cells.length, 10);
  assert.deepEqual(a.rows, { from: 2, to: 3 });
  assert.equal(a.next_row, 4);
  const one = await odsEntry.cellsIn(bytes, { sheet: "Grid", fromRow: 2, maxCells: 1 });
  assert.ok(one.ok);
  assert.equal(one.cells.length, 5);
  assert.equal(one.next_row, 3);
});

test("R49 cellsIn: no_such_sheet, bad_range and the guard's marker, never a throw", async () => {
  const bytes = ods(gridBody(3, 2));
  assert.deepEqual(await odsEntry.cellsIn(bytes, { sheet: "Nope" }), { ok: false, why: "no_such_sheet" });
  assert.deepEqual(await odsEntry.cellsIn(bytes, { sheet: "Grid", fromRow: 0 }), { ok: false, why: "bad_range" });
  assert.deepEqual(await odsEntry.cellsIn(bytes, { sheet: "Grid", fromRow: 5, toRow: 2 }), { ok: false, why: "bad_range" });
  for (const junk of [null, undefined, 7, "x", new Uint8Array(0), new Uint8Array([1, 2, 3]), {}]) {
    const r = await odsEntry.cellsIn(junk, { sheet: "Grid" });
    assert.equal(r.ok, false);
  }
  assert.equal((await odsEntry.cellsIn(bytes, null)).ok, false);
  const huge = ods(`<table:table table:name="H"><table:table-row table:number-rows-repeated="1000"><table:table-cell office:value-type="string" table:number-columns-repeated="1000"><text:p>x</text:p></table:table-cell></table:table-row></table:table>`);
  const over = await odsEntry.cellsIn(huge, { sheet: "H" });
  assert.equal(over.ok, false);
  assert.equal(over.why, "over_repeat_bound");
});

test("R49 yieldNow: awaited between windows when a function, the answer the same with or without it, a failing one ignored", async () => {
  const bytes = ods(gridBody(9000, 12, { pad: "-padding-padding" }));
  const plain = await odsEntry.text(bytes);
  let calls = 0;
  const yielded = await odsEntry.text(bytes, { yieldNow: async () => { calls++; } });
  assert.equal(calls >= 2, true, `windows: ${calls}`);
  assert.deepEqual(yielded, plain);
  const failing = await odsEntry.text(bytes, { yieldNow: () => { throw new Error("no"); } });
  assert.deepEqual(failing, plain);
  const notAFunction = await odsEntry.text(bytes, { yieldNow: 5 });
  assert.deepEqual(notAFunction, plain);
});

test("R49 two reads in flight at once keep their own repeat meters", async () => {
  const bytes = ods(gridBody(3000, 12, { pad: "-padding-padding" }));
  const huge = ods(`<table:table table:name="H"><table:table-row table:number-rows-repeated="1000"><table:table-cell office:value-type="string" table:number-columns-repeated="1000"><text:p>x</text:p></table:table-cell></table:table-row></table:table>`);
  const slow = async () => { await new Promise(/** @param {(value: void) => void} r */ (r) => setTimeout(r, 1)); };
  const [a, b, c] = await Promise.all([odsEntry.text(bytes, { yieldNow: slow }), odsEntry.text(huge, { yieldNow: slow }), odsEntry.text(bytes, { yieldNow: slow })]);
  assert.ok(a.ok);
  const [a0] = a.sheets;
  assert.ok(a0);
  assert.equal(a.ok && a0.usedRows, 3000);
  assert.ok(c.ok);
  const [c0] = c.sheets;
  assert.ok(c0);
  assert.equal(c0.usedRows, 3000);
  assert.ok(b.ok);
  const [b0] = b.undetermined;
  assert.ok(b0);
  assert.equal(b0.why, "over_repeat_bound");
});

test("R49 a 20,400,000-byte content.xml (172,302 cells) is read whole at --max-old-space-size=112: cells held, the last row in the text, cellsIn rows 70000-70010 equal the listing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "odf-r49-"));
  try {
    const COLS = 2, ROWS = 86151; // 172,302 cells
    const base = gridBody(ROWS, COLS).length;
    const pad = "-".repeat(Math.round((20_400_000 - base - 1500) / (ROWS * COLS)));
    const body = gridBody(ROWS, COLS, { pad });
    const bytes = ods(body);
    writeFileSync(join(dir, "big.ods"), bytes);
    writeFileSync(join(dir, "expect.json"), JSON.stringify({ ROWS, COLS, pad }));
    const r = spawnSync(process.execPath, ["--max-old-space-size=112", join(here, "r8-held-child.mjs"), join(dir, "big.ods"), join(dir, "expect.json")], { encoding: "utf8", maxBuffer: 1 << 24 });
    assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
    const last = r.stdout.trim().split("\n").pop();
    assert.ok(last !== undefined);   // split always gives at least one line
    /* the child's own answer on stdout, decoded here (R2) */
    const got = /** @type {{ contentBytes: number, checks: unknown }} */ (JSON.parse(last));
    assert.equal(got.contentBytes >= 20_300_000 && got.contentBytes <= 20_500_000, true, String(got.contentBytes));
    assert.deepEqual(got.checks, { ok: true, cells: null, cells_held: true, usedRows: ROWS, usedCols: COLS, lastLine: true, cellCount: ROWS * COLS, window: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
