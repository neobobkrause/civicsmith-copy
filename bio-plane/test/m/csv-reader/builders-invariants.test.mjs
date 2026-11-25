/* csv-reader, R10–R15: the exported reference builders and the module's invariants (pure, never throws, never
 * invents, no meaning, no place). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry, sheetCellRef, usedSheetRange, sheetRangeRef, columnLetters } from "../../../src/csv-reader/index.mjs";
import * as F from "./fixtures.mjs";

const ODD = [undefined, null, 0, -1, 1.5, NaN, "", "PK\x03\x04", {}, [], true, new ArrayBuffer(3), new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])];
const letters = (n) => { let s = ""; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s; return s; };

/* ------------------------------------------------------------------ R10, R11 */

test("R10 sheetCellRef(sheet, cell): {kind:'sheet-cell', ref:'<sheet>!<cell>', sheet, cell}", () => {
  for (const sheet of ["Sheet1", "Q3 Budget", "It's", "csv", "Ω"]) for (const cell of ["A1", "Z99", "XFD1048576"]) {
    assert.deepEqual(sheetCellRef(sheet, cell), { kind: "sheet-cell", ref: `${sheet}!${cell}`, sheet, cell });
  }
});

test("R11 usedSheetRange(name, rows, cols): A1 to the used corner in bijective column letters, or null unless both are positive integers", () => {
  for (let c = 1; c <= 800; c++) {
    const r = (c * 7) % 1000 + 1;
    assert.deepEqual(usedSheetRange("S", r, c), { kind: "sheet-range", ref: `S!A1:${letters(c)}${r}`, sheet: "S", range: `A1:${letters(c)}${r}` });
    assert.equal(columnLetters(c), letters(c));
  }
  assert.equal(usedSheetRange("S", 1, 16384).range, "A1:XFD1");
  assert.equal(usedSheetRange("S", 1, 26).range, "A1:Z1");
  assert.equal(usedSheetRange("S", 1, 27).range, "A1:AA1");
  assert.equal(usedSheetRange("S", 1, 702).range, "A1:ZZ1");
  assert.equal(usedSheetRange("S", 1, 703).range, "A1:AAA1");
  assert.deepEqual(sheetRangeRef("S", "A1:B2"), { kind: "sheet-range", ref: "S!A1:B2", sheet: "S", range: "A1:B2" });
  for (const bad of [0, -1, 1.5, NaN, null, undefined, "3", Infinity]) {
    assert.equal(usedSheetRange("S", bad, 3), null, String(bad));
    assert.equal(usedSheetRange("S", 3, bad), null, String(bad));
  }
});

/* ------------------------------------------------------------------ R12 */

test("R12 pure: the same bytes always give the same answer, whatever the clock, and nothing reaches the network", async () => {
  const b = F.enc("a,b\n1,2\n");
  const realNow = Date.now, realFetch = globalThis.fetch, RealDate = globalThis.Date;
  const run = async () => ({ d: csvEntry.detect(b, null), s: await csvEntry.structure(b), t: await csvEntry.text(b), dl: csvEntry.dialect(b) });
  const first = await run();
  globalThis.fetch = () => { throw new Error("network reached"); };
  Date.now = () => 0;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [0])); } static now() { return 0; } };
  try {
    assert.deepEqual(await run(), first);
    Date.now = () => 9e12;
    assert.deepEqual(await run(), first);
  } finally { Date.now = realNow; globalThis.fetch = realFetch; globalThis.Date = RealDate; }
});

/* ------------------------------------------------------------------ R13 */

test("R13 never throws: odd arguments to every slot of the entry, and to the builders", async () => {
  for (const x of ODD) {
    for (const y of [null, "text/csv", 5, {}]) assert.doesNotThrow(() => csvEntry.detect(x, y), "csv.detect");
    await assert.doesNotReject(async () => csvEntry.parts(x), "csv.parts");
    await assert.doesNotReject(async () => csvEntry.structure(x), "csv.structure");
    await assert.doesNotReject(async () => csvEntry.text(x), "csv.text");
    assert.doesNotThrow(() => csvEntry.dialect(x));
    assert.doesNotThrow(() => { sheetCellRef(x, x); usedSheetRange(x, x, x); sheetRangeRef(x, x); });
  }
});

test("R13 never throws: randomly corrupted bodies, and every failure is a returned ok:false or a carried undetermined", async () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const b = F.enc("a,b\n1,2\n");
  for (let i = 0; i < 150; i++) {
    const m = b.slice();
    const flips = 1 + Math.floor(rnd() * 6);
    for (let k = 0; k < flips; k++) m[Math.floor(rnd() * m.length)] = Math.floor(rnd() * 256);
    const cut = rnd() < 0.2 ? m.subarray(0, Math.floor(rnd() * m.length)) : m;
    assert.doesNotThrow(() => csvEntry.detect(cut, null));
    const parts = await csvEntry.parts(cut);
    const s = await csvEntry.structure(parts);
    const t = await csvEntry.text(parts);
    assert.equal(typeof s.ok, "boolean");
    assert.equal(typeof t.ok, "boolean");
    if (!t.ok) assert.equal(typeof t.reason, "string");
  }
});

test("R13 never invents: a dialect, character or cell it cannot establish is stated undetermined, never dropped or guessed", async () => {
  const d = csvEntry.dialect(new Uint8Array([0x61, 0x81, 0x0a]));
  assert.equal(d.encoding, null);
  assert.ok(d.undetermined.includes("encoding_undetermined"));
  assert.equal(csvEntry.dialect(F.enc("a,b;c\n1,2;3\n")).delimiter, null);
  const t = await csvEntry.text(Uint8Array.from([0x78, 0x2c, 0x63, 0x61, 0x66, 0x81, 0x0a, 0x79, 0x2c, 0x7a, 0x0a]));
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B1", reason: "encoding_undetermined" }]);
  assert.ok(!t.document.includes("�") && !t.document.includes("é"));
  /* a legacy charset the bytes only suggest is ASSUMED and stated as such, never silent */
  const l = await csvEntry.text(Uint8Array.from([0x78, 0x2c, 0x63, 0x61, 0x66, 0xe9, 0x0a, 0x79, 0x2c, 0x7a, 0x0a]));
  assert.equal(l.dialect.encoding, "windows-1252");
  assert.equal(l.dialect.assumed, true);
  assert.deepEqual(l.undetermined, []);
  const g = await csvEntry.text(new Uint8Array(51 * 1024 * 1024).fill(0x61));
  assert.equal(g.undetermined.length, 1, "over the ceiling the refusal is a marker, not a silent truncation");
});

/* ------------------------------------------------------------------ R14 */

function keysDeep(v, out = new Set()) {
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  }
  return out;
}

test("R14 asserts nothing about meaning and writes nothing: no grade or judgment in any output, a URL in a cell is text, the input bytes are untouched", async () => {
  const b = F.enc("a,b\nhttp://example.org/x,2\n");
  const before = b.slice();
  const outs = [await csvEntry.parts(b), await csvEntry.structure(b), await csvEntry.text(b)];
  assert.deepEqual(b, before, "left its input unchanged");
  const keys = keysDeep(outs);
  for (const k of ["grade", "meaning", "entity", "entities", "finding", "claim", "record", "store"]) assert.ok(!keys.has(k), `output has no ${k}`);
  assert.deepEqual(outs[1].links, [], "a URL in a cell is not a link");
  assert.equal(outs[2].sheets[0].cells.find((c) => c.source.cell === "A2").value, "http://example.org/x");
});

/* ------------------------------------------------------------------ R15 */

test("R15 no place is named: a body naming one jurisdiction reads exactly as the same body naming another", async () => {
  const swap = (v) => JSON.parse(JSON.stringify(v).replaceAll("Oakland", "Fairfax"));
  const build = (n) => F.enc(`city,county\n${n},Alameda\n`);
  const a = build("Oakland"), b = build("Fairfax");
  assert.deepEqual(swap(await csvEntry.structure(a)), await csvEntry.structure(b));
  assert.deepEqual(swap(await csvEntry.text(a)), await csvEntry.text(b));
  assert.deepEqual(swap(csvEntry.dialect(a)), csvEntry.dialect(b));
});
