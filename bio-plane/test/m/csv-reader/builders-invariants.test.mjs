/* csv-reader, R10–R15: the exported reference builders and the module's invariants (pure, never throws, never
 * invents, no meaning, no place). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry, sheetCellRef, usedSheetRange, sheetRangeRef, columnLetters } from "../../../src/csv-reader/index.mjs";
import * as F from "./fixtures.mjs";
/** @import { BytesInput, PartsOrBytes, Dialect, TextResult, TextDone } from "../../../src/csv-reader/index.mjs" */

/** @type {unknown[]} */
const ODD = [undefined, null, 0, -1, 1.5, NaN, "", "PK\x03\x04", {}, [], true, new ArrayBuffer(3), new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])];
/* R13 says the entry and the builders take a value of any kind without throwing. `detect` and `usedSheetRange`'s counts
   state that; the slots below still state a narrower kind (see each), so these hand a value of any kind on as the kind
   its slot states, as a caller the checker does not see may. */
/** `parts` and `dialect` read bytes through `new Uint8Array(x)`, which no check of a value of any kind reproduces.
 *  @param {unknown} v @returns {BytesInput} */
const asBytes = (v) => /** @type {BytesInput} */ (v);
/** `structure` and `text` take an object with a true `ok` as parts' answer, and fail on one that is not.
 *  @param {unknown} v @returns {PartsOrBytes} */
const asPartsOrBytes = (v) => /** @type {PartsOrBytes} */ (v);
/** The builders write the sheet's name into the reference, which a symbol or an object with no text form fails.
 *  @param {unknown} v @returns {string} */
const asText = (v) => /** @type {string} */ (v);

/** A body's dialect; no dialect fails the test there.
 *  @param {BytesInput} b @returns {Dialect} */
const dialectOf = (b) => {
  const d = csvEntry.dialect(b);
  if (d === null) assert.fail("no dialect");
  return d;
};
/** A body read whole; anything else fails the test there.
 *  @param {TextResult} r @returns {TextDone} */
const textDone = (r) => {
  if (!r.ok || r.document === null) assert.fail(`not a body read: ${JSON.stringify(r).slice(0, 200)}`);
  return r;
};

/** @param {number} n @returns {string} the column's bijective letters */
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
  assert.equal(usedSheetRange("S", 1, 16384)?.range, "A1:XFD1");
  assert.equal(usedSheetRange("S", 1, 26)?.range, "A1:Z1");
  assert.equal(usedSheetRange("S", 1, 27)?.range, "A1:AA1");
  assert.equal(usedSheetRange("S", 1, 702)?.range, "A1:ZZ1");
  assert.equal(usedSheetRange("S", 1, 703)?.range, "A1:AAA1");
  assert.deepEqual(sheetRangeRef("S", "A1:B2"), { kind: "sheet-range", ref: "S!A1:B2", sheet: "S", range: "A1:B2" });
  /** @type {unknown[]} */
  const bads = [0, -1, 1.5, NaN, null, undefined, "3", Infinity];
  for (const bad of bads) {
    assert.equal(usedSheetRange("S", bad, 3), null, String(bad));
    assert.equal(usedSheetRange("S", 3, bad), null, String(bad));
  }
});

/* ------------------------------------------------------------------ R12 */

test("R12 pure: the same bytes always give the same answer, whatever the clock, and nothing reaches the network", async (t) => {
  const b = F.enc("a,b\n1,2\n");
  const run = async () => ({ d: csvEntry.detect(b, null), s: await csvEntry.structure(b), t: await csvEntry.text(b), dl: csvEntry.dialect(b) });
  const first = await run();
  /* the runner's mocks: a fetch that throws, and a clock (Date.now and new Date) at 0, then at 9e12 */
  t.mock.method(globalThis, "fetch", () => { throw new Error("network reached"); });
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  try {
    assert.deepEqual(await run(), first);
    t.mock.timers.setTime(9e12);
    assert.deepEqual(await run(), first);
  } finally { t.mock.timers.reset(); t.mock.restoreAll(); }
});

/* ------------------------------------------------------------------ R13 */

test("R13 never throws: odd arguments to every slot of the entry, and to the builders", async () => {
  for (const x of ODD) {
    /** @type {unknown[]} */
    const types = [null, "text/csv", 5, {}];
    for (const y of types) assert.doesNotThrow(() => csvEntry.detect(x, y), "csv.detect");
    await assert.doesNotReject(async () => csvEntry.parts(asBytes(x)), "csv.parts");
    await assert.doesNotReject(async () => csvEntry.structure(asPartsOrBytes(x)), "csv.structure");
    await assert.doesNotReject(async () => csvEntry.text(asPartsOrBytes(x)), "csv.text");
    assert.doesNotThrow(() => csvEntry.dialect(asBytes(x)));
    assert.doesNotThrow(() => { sheetCellRef(asText(x), asText(x)); usedSheetRange(asText(x), x, x); sheetRangeRef(asText(x), asText(x)); });
  }
});

test("R13 never throws: R10's and R11's builders take a symbol or a value with no text form as a sheet name or cell, and still hand back their reference", () => {
  /** @type {unknown[]} */
  const textless = [Symbol("s"), Symbol(), Object.create(null), { toString() { throw new Error("no text form"); } }];
  for (const x of textless) {
    for (const build of [() => sheetCellRef(asText(x), "A1"), () => sheetCellRef("S", asText(x)), () => sheetRangeRef(asText(x), "A1:B2"),
      () => sheetRangeRef("S", asText(x)), () => usedSheetRange(asText(x), 2, 3)]) {
      assert.doesNotThrow(build);
      const r = build();
      assert.ok(r !== null);
      assert.equal(typeof r.ref, "string");
    }
    assert.equal(usedSheetRange(asText(x), 0, 3), null, "an unmeasured range is still null");
  }
  /* a name the builders could always write is written exactly as before */
  assert.equal(sheetCellRef("Q3 Budget", "B7").ref, "Q3 Budget!B7");
  assert.equal(usedSheetRange("csv", 2, 28)?.ref, "csv!A1:AB2");
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
  const d = dialectOf(new Uint8Array([0x61, 0x81, 0x0a]));
  assert.equal(d.encoding, null);
  assert.ok(d.undetermined.includes("encoding_undetermined"));
  assert.equal(dialectOf(F.enc("a,b;c\n1,2;3\n")).delimiter, null);
  const t = textDone(await csvEntry.text(Uint8Array.from([0x78, 0x2c, 0x63, 0x61, 0x66, 0x81, 0x0a, 0x79, 0x2c, 0x7a, 0x0a])));
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B1", reason: "encoding_undetermined" }]);
  assert.ok(!t.document.includes("�") && !t.document.includes("é"));
  /* a legacy charset the bytes only suggest is ASSUMED and stated as such, never silent */
  const l = textDone(await csvEntry.text(Uint8Array.from([0x78, 0x2c, 0x63, 0x61, 0x66, 0xe9, 0x0a, 0x79, 0x2c, 0x7a, 0x0a])));
  assert.equal(l.dialect.encoding, "windows-1252");
  assert.equal(l.dialect.assumed, true);
  assert.deepEqual(l.undetermined, []);
  const g = await csvEntry.text(new Uint8Array(51 * 1024 * 1024).fill(0x61));
  if (!g.ok) assert.fail(`refused: ${g.reason}`);
  assert.equal(g.undetermined.length, 1, "over the ceiling the refusal is a marker, not a silent truncation");
});

/* ------------------------------------------------------------------ R14 */

/** Every member name at any depth of a value, a byte array's indexes left out: JSON.stringify hands its replacer each
 *  member of every object and array it walks, by name.
 *  @param {unknown} v @returns {Set<string>} */
function keysDeep(v) {
  /** @type {Set<string>} */
  const out = new Set();
  JSON.stringify(v, (/** @type {string} */ k, /** @type {unknown} */ x) => {
    if (k !== "") out.add(k);
    return x instanceof Uint8Array ? undefined : x;
  });
  return out;
}

test("R14 asserts nothing about meaning and writes nothing: no grade or judgment in any output, a URL in a cell is text, the input bytes are untouched", async () => {
  const b = F.enc("a,b\nhttp://example.org/x,2\n");
  const before = b.slice();
  const parts = await csvEntry.parts(b), structure = await csvEntry.structure(b), text = await csvEntry.text(b);
  assert.deepEqual(b, before, "left its input unchanged");
  const keys = keysDeep([parts, structure, text]);
  for (const k of ["grade", "meaning", "entity", "entities", "finding", "claim", "record", "store"]) assert.ok(!keys.has(k), `output has no ${k}`);
  if (!structure.ok) assert.fail(`refused: ${structure.reason}`);
  assert.deepEqual(structure.links, [], "a URL in a cell is not a link");
  const cells = textDone(text).sheets[0]?.cells;
  assert.equal(cells?.find((c) => c.source.cell === "A2")?.value, "http://example.org/x");
});

/* ------------------------------------------------------------------ R15 */

test("R15 no place is named: a body naming one jurisdiction reads exactly as the same body naming another", async () => {
  /** @param {unknown} v @returns {unknown} the value with every Oakland written Fairfax */
  const swap = (v) => JSON.parse(JSON.stringify(v).replaceAll("Oakland", "Fairfax"));
  /** @param {string} n */
  const build = (n) => F.enc(`city,county\n${n},Alameda\n`);
  const a = build("Oakland"), b = build("Fairfax");
  assert.deepEqual(swap(await csvEntry.structure(a)), await csvEntry.structure(b));
  assert.deepEqual(swap(await csvEntry.text(a)), await csvEntry.text(b));
  assert.deepEqual(swap(csvEntry.dialect(a)), csvEntry.dialect(b));
});
