/* csv-reader, fix round 9 (G131a-G131e, G131i, G129f, G124e; K4834): R9 (windows with a carry, equal to the whole read, at the
   edge and one byte either side), R23 (a quote opens only at the start of a field), R24 (the dialect per window, stated
   disagreements), R25 (UTF-16, UTF-8 and a legacy charset to the standard through the windows), R18 (access points, bytes
   served by cellsIn bounded by the window). `windowBytes` is the entry's scaled-window seam: the smallest case that shows
   each cause runs here at a scaled window, the full size in the corpus set. Every body is built here by a route that shares
   no code with the reader; counts are bytes pulled and rows, never a clock (R-CLOCK). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
import { enc } from "./fixtures.mjs";
import { prng } from "./large.mjs";
import { generate } from "../../sheetgen.mjs";
/** @import { TextResult, TextDone, TextSheet, TypedCell, CellsResult, CellsDone, PartsResult, CsvParts, StructureResult, StructureDone, TextOptions, CellsQuery } from "../../../src/csv-reader/index.mjs" */
/** @import { SheetHeader } from "../../sheetgen.mjs" */

const MIB = 1024 * 1024;

/** A read that gave a document. @param {TextResult} t @returns {TextDone} */
const done = (t) => {
  if (!t.ok) assert.fail(`refused: ${t.reason}`);
  if (t.document === null) assert.fail("over a bound");
  return t;
};
/** The first sheet. @param {TextDone} t @returns {TextSheet} */
const sheet0 = (t) => {
  const s = t.sheets[0];
  if (s === undefined) assert.fail("no sheet");
  return s;
};
/** A sheet's listed cells. @param {TextSheet} s @returns {TypedCell[]} */
const listed = (s) => {
  const c = s.cells;
  if (c === null) assert.fail("cells held");
  return c;
};
/** The first sheet's listed cells. @param {TextDone} t @returns {TypedCell[]} */
const cells0 = (t) => listed(sheet0(t));
/** @param {CellsResult} r @returns {CellsDone} */
const cellsDone = (r) => {
  if (!r.ok) assert.fail(`cellsIn: ${r.why}`);
  return r;
};
/** @param {PartsResult} p @returns {CsvParts} */
const partsOk = (p) => {
  if (!p.ok) assert.fail(`parts refused: ${p.why}`);
  return p;
};
/** @param {StructureResult} st @returns {StructureDone} */
const structureOk = (st) => {
  if (!st.ok) assert.fail(`structure refused: ${st.reason}`);
  return st;
};

/** What a read says of its sheet: everything a window size must not change. @param {TextResult} r */
const sheetOf = (r) => { const { dialect, ...rest } = done(r); return rest; };
/** @param {string} s @param {boolean} [bom] @returns {Uint8Array} */
const u16le = (s, bom = true) => {
  /** @type {number[]} */
  const out = bom ? [0xff, 0xfe] : [];
  for (const c of s) { const n = c.charCodeAt(0); out.push(n & 255, n >> 8); }
  return new Uint8Array(out);
};
/** @param {string} s @returns {Uint8Array} */
const u16be = (s) => {
  /** @type {number[]} */
  const out = [];
  for (const c of s) { const n = c.charCodeAt(0); out.push(n >> 8, n & 255); }
  return new Uint8Array(out);
};
/** Each listed cell's value by its reference. @param {TextDone} t @returns {Map<string, string | null>} */
const cellsOf = (t) => {
  /** @type {Array<[string, string | null]>} */
  const none = [];
  const byCell = new Map(none);
  for (const c of cells0(t)) byCell.set(c.source.cell, c.value);
  return byCell;
};
/** The row number at the end of a cell reference. @param {string} cell @returns {number} */
const rowOf = (cell) => {
  const m = /\d+$/.exec(cell);
  if (m === null) assert.fail(`no row in ${cell}`);
  return Number(m[0]);
};

/**
 * A Uint8Array that counts the bytes `subarray` hands out: the bytes a read pulls.
 * @param {Uint8Array} bytes
 * @returns {{bytes: Uint8Array, meter: {n: number}}}
 */
function counting(bytes) {
  const meter = { n: 0 };
  class Counting extends Uint8Array {
    /** @param {number} [a] @param {number} [b] */
    subarray(a, b) { const r = super.subarray(a, b); meter.n += r.length; return r; }
  }
  const c = new Counting(bytes.length);
  c.set(bytes);
  return { bytes: c, meter };
}

/**
 * Records with the awkward things in: quoted line breaks every 3rd row, doubled quotes, CRLF, multi-byte characters, empty fields.
 * @param {number} rows
 * @returns {{fields: string[][], bytes: Uint8Array}}
 */
function awkward(rows) {
  const rand = prng(99);
  /** @type {string[][]} */
  const fields = [];
  /** @type {string[]} */
  const out = [];
  for (let r = 1; r <= rows; r++) {
    const f = [String(r), `name ${r} ${"é€😀日".charAt(r % 4)}`, r % 5 === 0 ? "" : `v${rand() % 1000}`, r % 3 === 0 ? `line one ${r}\nline two "q" ${r}` : `plain ${r}`];
    fields.push(f);
    out.push(f.map((x) => (/[",\n]/.test(x) ? `"${x.replaceAll('"', '""')}"` : x)).join(","));
  }
  return { fields, bytes: enc(out.join("\r\n") + "\r\n") };
}

test("R9 a body read in windows (4,099, 40,000, 50,000, 70,001 bytes) equals the whole read: text, lineRows, cells, counts, at the edge and one byte either side (C15)", async () => {
  const { bytes } = awkward(3500);
  assert.ok(bytes.length > 100 * 1024, `body ${bytes.length}`);
  const whole = sheetOf(await csvEntry.text(bytes));
  assert.ok((whole.sheets[0]?.usedRows ?? 0) >= 3500);
  for (const w of [4099, 40000, 50000, 70001, 65537]) {
    const got = sheetOf(await csvEntry.text(bytes, { windowBytes: w }));
    assert.deepEqual(got, whole, `window ${w}`);
  }
  // one byte either side of an edge: the body cut so that an edge lands on each byte around a CRLF, a quote pair and a multi-byte character
  for (const needle of ["\r\n", '""', "é", "€", "😀", "日"]) {
    const first = enc(needle)[0];
    if (first === undefined) assert.fail(`no bytes in ${needle}`);
    const at = bytes.indexOf(first, 50000);
    for (const shift of [-1, 0, 1]) {
      const cut = at + shift;
      const win = Math.max(16, cut);
      assert.deepEqual(sheetOf(await csvEntry.text(bytes, { windowBytes: win })), whole, `edge at ${cut} (${needle})`);
    }
  }
});

test("R9 an unfinished field, record, quote, CR and multi-byte character are carried across every edge: every window size from 16 to 200 gives the whole read", async () => {
  /** @type {string[][]} */
  const fields = [];
  let text = "";
  for (let i = 0; i < 40; i++) { fields.push([`r${i}`, i % 2 ? `x"y${i}` : `"q""${i}\nz"`, "日€"]); }
  text = fields.map((f, i) => [f[0], i % 2 ? f[1] : `"q""${i}\nz"`, f[2]].join(",")).join("\r\n") + "\r\n";
  const bytes = enc(text);
  const whole = sheetOf(await csvEntry.text(bytes));
  assert.equal(whole.sheets[0]?.usedRows, 40);
  for (let w = 16; w <= 200; w++) assert.deepEqual(sheetOf(await csvEntry.text(bytes, { windowBytes: w })), whole, `window ${w}`);
});

test("R9 the bytes pulled are at most twice the file's: parts() once over it, text() once more", async () => {
  const { bytes } = awkward(6000);
  const { bytes: probe, meter } = counting(bytes);
  const parts = partsOk(await csvEntry.parts(probe, { windowBytes: 65536 }));
  assert.ok(meter.n <= probe.length + 16384, `parts pulled ${meter.n} of ${probe.length}`);
  const t = done(await csvEntry.text(parts, { windowBytes: 65536 }));
  assert.equal(t.ok, true);
  assert.ok(meter.n <= 2 * probe.length + 16384, `parts and text pulled ${meter.n} of ${probe.length}`);
  const again = counting(bytes);
  await csvEntry.text(again.bytes, { windowBytes: 65536 });
  assert.ok(again.meter.n <= 2 * bytes.length + 16384, `text of the bytes pulled ${again.meter.n} of ${bytes.length}`);
  assert.ok(again.meter.n >= bytes.length, "and it did read the file");
});

/* ------------------------------------------------------------------ R23 */

test("R23 a double quote opens quote mode only at the start of a field: 12\" pipe,1 is the fields 12\" pipe and 1", async () => {
  const t = done(await csvEntry.text(enc('size,qty\n12" pipe,1\n6" pipe,2\nab"cd,3\n"x ""y"" z",4\nq"",5\n')));
  assert.deepEqual(cells0(t).map((c) => c.value), ["size", "qty", '12" pipe', "1", '6" pipe', "2", 'ab"cd', "3", 'x "y" z', "4", 'q""', "5"]);
  assert.deepEqual(t.undetermined, []);
  assert.equal(sheet0(t).usedRows, 6);
});

test("R23 one stray quote does not swallow the rest of the file: a stray 12\" pipe at row 100 of 500,000 rows reads all 500,000 (C14)", async () => {
  /** @type {string[]} */
  const lines = [];
  for (let r = 1; r <= 500000; r++) lines.push(r === 100 ? '12" pipe,x' : `${r},v`);
  const bytes = enc(lines.join("\n") + "\n");
  /** @type {TextOptions[]} the whole read, then windows of 40,000 bytes; cells never listed */
  const reads = [{ inlineCellsMax: 0 }, { windowBytes: 40000, inlineCellsMax: 0 }];
  for (const opts of reads) {
    const t = done(await csvEntry.text(bytes, opts));
    assert.equal(sheet0(t).usedRows, 500000);
    assert.equal(t.counts.cells, 1000000);
    assert.deepEqual(t.undetermined, []);
    assert.ok(t.document.endsWith("\n500000\tv"));
  }
  const cell = cellsDone(await csvEntry.cellsIn(bytes, { fromRow: 100, toRow: 100 }));
  assert.deepEqual(cell.cells.map((c) => c.value), ['12" pipe', "x"]);
});

test("R23 a quote left open when the file ends is stated with the row it opened on and the bytes it covers, and the rows before it are read", async () => {
  const body = 'a,b\n1,2\n3,"open here\nstill open\nmore\n';
  const t = done(await csvEntry.text(enc(body)));
  const covered = enc('open here\nstill open\nmore\n').length;
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B3", reason: "unterminated_quote", row: 3, bytes: covered }]);
  assert.equal(sheet0(t).usedRows, 3);
  assert.equal(t.document, "a\tb\n1\t2\n3");
  assert.deepEqual(cells0(t).at(-1)?.value, null);
  // the same through windows, with the quote opened early and the file long
  const lines = ['id,v'];
  for (let i = 1; i <= 20000; i++) { const n = i; lines.push(n === 15000 ? `${n},"never closed` : `${n},ok`); }
  const w = done(await csvEntry.text(enc(lines.join("\n") + "\n"), { windowBytes: 20000 }));
  assert.equal(sheet0(w).usedRows, 15001);
  assert.equal(w.undetermined.length, 1);
  const open = w.undetermined[0];
  if (open === undefined || open.reason !== "unterminated_quote") assert.fail(`not an open quote: ${JSON.stringify(open)}`);
  assert.equal(open.row, 15001);
  assert.equal(open.reason, "unterminated_quote");
  assert.ok(open.bytes > 40000);
  assert.ok(w.document.includes("14999\tok"));
  assert.ok(w.document.endsWith("\n15000"));
});

/* ------------------------------------------------------------------ R24 */

/**
 * Rows of fixed width `width` (including the newline) in `delim`, `count` of them.
 * @param {string} delim @param {number} count @param {number} width @param {number} [from]
 * @returns {string}
 */
const fixedRows = (delim, count, width, from = 1) => {
  let out = "";
  for (let i = 0; i < count; i++) {
    const head = `${delim === "," ? "c" : "s"}${from + i}`;
    out += `${head}${delim}${"v".repeat(width - head.length - 4)}${delim}z\n`;
  }
  return out;
};

test("R24 the dialect is decided on each window and the file's by majority: a window that differs is listed in disagree, stated, and read under its own delimiter (C18)", async () => {
  const W = 2000, width = 20, per = W / width;
  const text = fixedRows(",", per * 3, width) + fixedRows(";", per, width, 1000) + fixedRows(",", per * 2, width, 2000);
  const bytes = enc(text);
  const t = done(await csvEntry.text(bytes, { windowBytes: W }));
  assert.equal(t.dialect.delimiter, "comma", "the majority of the windows");
  assert.deepEqual(t.dialect.disagree, [3 * W], "the byte offset of the semicolon window");
  assert.ok(t.dialect.undetermined.includes("windows_disagree"));
  // the semicolon rows are read as rows of three cells, under their window's delimiter, not as one cell holding semicolons
  const cells = cellsOf(t);
  assert.equal(cells.get(`A${per * 3 + 1}`), "s1000");
  assert.equal(cells.get(`C${per * 3 + 1}`), "z");
  assert.equal(cells.get(`A${per * 4 + 1}`), "c2000");
  assert.equal(cells.get(`C${per * 4 + 1}`), "z");
  assert.deepEqual(t.dialect, csvEntry.dialect(bytes, { windowBytes: W }), "dialect() and text() state one dialect");
  assert.deepEqual(structureOk(await csvEntry.structure(bytes, { windowBytes: W })).dialect, t.dialect);
  // a body of one dialect states no disagreement
  const same = done(await csvEntry.text(enc(fixedRows(",", per * 6, width)), { windowBytes: W }));
  assert.deepEqual(same.dialect.disagree, []);
  assert.ok(!same.dialect.undetermined.includes("windows_disagree"));
});

test("R24 a ragged file with a 5-line title preamble, CR-only endings and a quoted newline still finds its delimiter (C18, C19)", async () => {
  const title = "Council report\nprepared 2026\nby the clerk\nDRAFT\n(all figures dollars)\n";
  /** @type {string[]} */
  const rows = [];
  for (let i = 0; i < 300; i++) rows.push(i % 17 === 0 ? `${i},"two\nlines",x,extra` : `${i},name${i},x`);
  const lf = done(await csvEntry.text(enc(title + rows.join("\n") + "\n")));
  assert.equal(lf.dialect.delimiter, "comma");
  assert.equal(sheet0(lf).usedRows, 5 + 300);
  const cr = done(await csvEntry.text(enc(title.replaceAll("\n", "\r") + rows.join("\r") + "\r")));
  assert.equal(cr.dialect.delimiter, "comma");
  assert.equal(sheet0(cr).usedRows, 5 + 300, "CR-only endings are records");
  const mixed = done(await csvEntry.text(enc(title + rows.map((r, i) => r + (i % 3 === 0 ? "\r\n" : i % 3 === 1 ? "\n" : "\r")).join(""))));
  assert.equal(mixed.dialect.delimiter, "comma");
  assert.equal(sheet0(mixed).usedRows, 5 + 300);
  // a first line over a window gives a dialect from the windows after it, not "too few lines"
  const longFirst = enc("x".repeat(9000) + "\n" + rows.join("\n") + "\n");
  const t = done(await csvEntry.text(longFirst, { windowBytes: 4096 }));
  assert.equal(t.dialect.delimiter, "comma");
  assert.equal(sheet0(t).usedRows, 301);
  assert.deepEqual(cells0(t).filter((c) => c.source.cell === "C2").map((c) => c.value), ["x"]);
});

test("R24 the encoding is decided per window and the file's by majority: a UTF-8 window in a windows-1252 file is listed and read as UTF-8 (C26)", async () => {
  const W = 2000;
  /** @param {string} s @returns {Uint8Array} */
  const cp = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  /** @param {string} label @returns {string} */
  const rowBytes = (label) => `${label},caf\xe9,\x93q\x94\n`;
  let latin = "";
  for (let i = 0; latin.length < W * 3; i++) latin += rowBytes(`l${i}`);
  const latinBytes = cp(latin.slice(0, W * 3));
  const utf = enc("é,日本,’\n".repeat(Math.ceil(W / 14)));
  const tail = cp(latin.slice(0, W));
  const body = new Uint8Array([...latinBytes, ...utf.subarray(0, W), ...tail]);
  const t = done(await csvEntry.text(body, { windowBytes: W }));
  assert.equal(t.dialect.encoding, "windows-1252");
  assert.equal(t.dialect.assumed, true);
  assert.ok(t.dialect.disagree.includes(3 * W), `disagree ${JSON.stringify(t.dialect.disagree)}`);
  assert.ok(t.dialect.undetermined.includes("windows_disagree"));
  const values = cells0(t).map((c) => c.value);
  assert.ok(values.includes("café") && values.includes("“q”"), "the windows-1252 windows read as windows-1252");
  assert.ok(values.includes("日本") && values.includes("’"), "the UTF-8 window reads as UTF-8");
  assert.deepEqual(t.undetermined.filter((u) => { const why = u.reason; return why !== "encoding_undetermined" && why !== "invalid_utf8"; }), []);
});

/* ------------------------------------------------------------------ R25 */

test("R25 UTF-8, a legacy charset and UTF-16 (BOM or none) are read to the same text through windows; a character split across an edge is not lost", async () => {
  /** @type {string[]} */
  const rows = [];
  for (let i = 0; i < 400; i++) rows.push(`${i},café “q” ${i},${"日本".charAt(i % 2)}`);
  const text = rows.join("\n") + "\n";
  const want = sheet0(done(await csvEntry.text(enc(text))));
  assert.equal(listed(want)[1]?.value, "café “q” 0");
  const legacyText = rows.map((r, i) => `${i},caf\xe9 \x93q\x94 ${i},x`).join("\n") + "\n";
  const legacy = Uint8Array.from(legacyText, (c) => c.charCodeAt(0));
  for (const w of [16, 33, 101, 4096]) {
    const u8 = done(await csvEntry.text(enc(text), { windowBytes: w }));
    assert.deepEqual(u8.sheets[0], want, `utf-8 window ${w}`);
    assert.equal(u8.counts.replaced, 0);
    /** @type {Array<[string, Uint8Array]>} */
    const bodies = [["utf-16le BOM", u16le(text)], ["utf-16le", u16le(text, false)], ["utf-16be", u16be(text)]];
    for (const [name, body] of bodies) {
      const t = done(await csvEntry.text(body, { windowBytes: w }));
      assert.deepEqual(t.sheets[0], want, `${name} window ${w}`);
      assert.deepEqual(t.undetermined, []);
    }
    const l = done(await csvEntry.text(legacy, { windowBytes: w }));
    assert.equal(l.dialect.encoding, "windows-1252");
    assert.equal(cells0(l)[1]?.value, "café “q” 0");
    assert.equal(l.counts.replaced, 0);
  }
});

test("R25 a declared legacy charset is used and not assumed (iso-8859-2)", async () => {
  const t = done(await csvEntry.text(Uint8Array.from("a,b\n1,\xa3\xb1\n2,x\n", (c) => c.charCodeAt(0)), { declared: "iso-8859-2" }));
  assert.equal(t.dialect.encoding, "iso-8859-2");
  assert.equal(t.dialect.assumed, false);
  assert.deepEqual(cells0(t).filter((c) => c.source.cell === "B2").map((c) => c.value), ["Łą"]);
});

test("R25 a UTF-16 body with a lone surrogate counts the replaced cell and says which", async () => {
  const bad = new Uint8Array([...u16le("a,b\n1,"), 0x00, 0xd8, 0x0a, 0x00, ...u16le("2,3\n", false)]);
  const t = done(await csvEntry.text(bad, { windowBytes: 16 }));
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B2", reason: "invalid_utf16" }]);
  assert.equal(t.counts.replaced, 1);
});

test("G131a a UTF-8 file with ’ in 300,000 rows reads every cell: no cell is null (C27)", async () => {
  /** @type {string[]} */
  const lines = [];
  for (let i = 1; i <= 300000; i++) lines.push(`${i},it’s,É Ñ 日本 😀`);
  const bytes = enc(lines.join("\n") + "\n");
  const t = done(await csvEntry.text(bytes, { inlineCellsMax: 0 }));
  assert.equal(t.counts.undetermined, 0);
  assert.equal(t.counts.replaced, 0);
  assert.equal(t.counts.cells, 900000);
  assert.deepEqual(t.undetermined, []);
  const last = cellsDone(await csvEntry.cellsIn(bytes, { fromRow: 300000, toRow: 300000 }));
  assert.deepEqual(last.cells.map((c) => c.value), ["300000", "it’s", "É Ñ 日本 😀"]);
});

test("G131a a windows-1252 file of 300,000 rows with 2 accented fields each reads 600,000 accented cells, none undetermined (C31)", async () => {
  /** @type {string[]} */
  const lines = [];
  for (let i = 1; i <= 300000; i++) lines.push(`${i},caf\xe9,ni\xf1o`);
  const bytes = Uint8Array.from(lines.join("\n") + "\n", (c) => c.charCodeAt(0));
  const t = done(await csvEntry.text(bytes, { inlineCellsMax: 0 }));
  assert.equal(t.dialect.encoding, "windows-1252");
  assert.equal(t.counts.undetermined, 0);
  assert.equal(t.counts.cells, 900000);
  assert.ok(t.document.endsWith("300000\tcafé\tniño"));
});

/* ------------------------------------------------------------------ G131d, C17 */

test("G131d empty cells keep their column in the first column, the middle, the last, a whole empty row and a whole empty column, inside and after line 50 (C17)", async () => {
  /** @type {string[]} */
  const rows = [];
  /** @type {string[][]} */
  const want = [];
  for (let r = 1; r <= 120; r++) {
    const f = r % 10 === 0 ? ["", "", "", ""] : [r % 4 === 0 ? "" : `a${r}`, `b${r}`, r % 3 === 0 ? "" : `c${r}`, r % 7 === 0 ? `d${r}` : ""];
    rows.push(f.join(","));
    want.push(f);
  }
  const t = done(await csvEntry.text(enc(rows.join("\n") + "\n")));
  const lines = sheet0(t).text.split("\n");
  const lineRows = sheet0(t).lineRows;
  assert.equal(lines.length, lineRows.length);
  lines.forEach((line, i) => {
    const row = lineRows[i];
    const f = row === undefined ? undefined : want[row - 1];
    if (f === undefined) assert.fail(`line ${i}: no row ${row}`);
    let last = f.length - 1;
    while (last >= 0 && f[last] === "") last--;
    assert.deepEqual(line.split("\t"), f.slice(0, last + 1), `row ${lineRows[i]}`);
  });
  const byCell = cellsOf(t);
  want.forEach((f, i) => f.forEach((v, c) => { assert.equal(byCell.get(`${"ABCD".charAt(c)}${i + 1}`), v === "" ? undefined : v); }));
});

/* ------------------------------------------------------------------ R18 / G131e */

test("R18 the bytes cellsIn pulls are bounded by the window, not the offset: rows 699,998 to 700,000 of an 8.9 MiB file read no more than rows near the top (G131e)", async () => {
  /** @type {string[]} */
  const lines = [];
  let size = 0;
  for (let i = 1; size < 8.9 * MIB; i++) { const l = `${i},r${i % 1000}\n`; lines.push(l); size += l.length; }
  const bytes = enc(lines.join(""));
  const rows = lines.length;
  assert.ok(rows > 700000, `rows ${rows}`);
  const { bytes: probe, meter } = counting(bytes);
  const parts = partsOk(await csvEntry.parts(probe));
  assert.ok(parts.accessPoints.length >= 8, `${parts.accessPoints.length} access points`);
  /** @param {CellsQuery} query @returns {Promise<{r: CellsDone, n: number}>} */
  const pulledBy = async (query) => { meter.n = 0; const r = cellsDone(await csvEntry.cellsIn(parts, query)); return { r, n: meter.n }; };
  const top = await pulledBy({ fromRow: 5, toRow: 7 });
  const deep = await pulledBy({ fromRow: 699998, toRow: 700000 });
  assert.deepEqual(deep.r.cells.map((c) => c.value), ["699998", `r${699998 % 1000}`, "699999", `r${699999 % 1000}`, "700000", `r${700000 % 1000}`]);
  assert.deepEqual(top.r.cells.map((c) => c.value).slice(0, 2), ["5", "r5"]);
  assert.ok(deep.n <= 2 * MIB, `rows at 700,000 pulled ${deep.n} bytes, the window is ${MIB}`);
  assert.ok(deep.n <= 2 * Math.max(top.n, MIB), `bytes at the offset (${deep.n}) are bounded by the window, as at the top (${top.n})`);
  // every row of the file is reachable the same way and equals the whole read's cell
  for (const fromRow of [1, 2, 41000, 123457, rows - 1, rows]) {
    const r = cellsDone(await csvEntry.cellsIn(parts, { fromRow, toRow: fromRow }));
    assert.deepEqual(r.cells.map((c) => c.value), [String(fromRow), `r${fromRow % 1000}`], `row ${fromRow}`);
  }
});

test("R18 cellsIn from an access point equals the whole read for rows around every window edge, quoted line breaks and CRLF included (scaled window)", async () => {
  const { fields, bytes } = awkward(3000);
  const whole = cells0(done(await csvEntry.text(bytes)));
  /** @type {Array<[number, TypedCell[]]>} */
  const none = [];
  const byRow = new Map(none);
  for (const c of whole) {
    const n = rowOf(c.source.cell);
    const held = byRow.get(n);
    const list = held ?? [];
    if (held === undefined) byRow.set(n, list);
    list.push(c);
  }
  const parts = partsOk(await csvEntry.parts(bytes, { windowBytes: 20000 }));
  assert.ok(parts.accessPoints.length >= 5);
  for (const ap of parts.accessPoints) {
    for (const fromRow of [ap.row, ap.row + 1, ap.row + 2]) {
      const r = cellsDone(await csvEntry.cellsIn(parts, { fromRow, toRow: fromRow + 3 }));
      /** @type {TypedCell[]} */
      const want = [];
      for (let n = fromRow; n <= Math.min(fromRow + 3, fields.length); n++) want.push(...(byRow.get(n) ?? []));
      assert.deepEqual(r.cells, want, `rows ${fromRow}-${fromRow + 3} after the access point at row ${ap.row}`);
    }
  }
});

test("R7 a 3,000-row five-column CSV with a title block and ragged rows reads with comma, five columns and its last mark in column A (cause 20); ragged alone and title alone read as before", async () => {
  const seed = "rw9-B-5c";
  /** @param {{header: SheetHeader, ragged?: boolean}} recipe @returns {Promise<TextDone>} */
  const read = async (recipe) => done(await csvEntry.text(await generate({ kind: "csv", seed, size: { rows: 3000, cols: 5 }, ...recipe }).bytes()));
  const both = await read({ header: "title", ragged: true });
  assert.equal(both.dialect.delimiter, "comma", "every row ragged, a title block above: the delimiter is still the comma");
  assert.equal(sheet0(both).usedCols, 5);
  assert.equal(sheet0(both).usedRows, 3003);
  const last = cells0(both).find((c) => c.value === `${seed}-R3003-C1`);
  assert.ok(last, "the last mark is read");
  assert.equal(last.source.cell, "A3003", "in column A of its row");
  const row3003 = cells0(both).filter((c) => /\D3003$/.test(c.source.cell));
  assert.equal(row3003.length, 5, "a five-field row");
  const ragged = await read({ header: "one", ragged: true });
  assert.equal(ragged.dialect.delimiter, "comma");
  assert.equal(sheet0(ragged).usedCols, 5);
  const title = await read({ header: "title" });
  assert.equal(title.dialect.delimiter, "comma");
  assert.equal(sheet0(title).usedCols, 5);
  assert.equal(sheet0(title).usedRows, 3003);
});
