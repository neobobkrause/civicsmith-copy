/* csv-reader, R5–R7: text() — the I2 text shape, the size guard (CSV body bytes, records, columns) and the dialect. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry, CSV_SHEET_NAME, CSV_STREAMED_UNDETERMINED_MAX } from "../../../src/csv-reader/index.mjs";
import * as F from "./fixtures.mjs";

const bytes = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const MiB = 1024 * 1024;
const u16le = (s, bom = true) => { const out = bom ? [0xff, 0xfe] : []; for (const c of s) { const n = c.charCodeAt(0); out.push(n & 255, n >> 8); } return new Uint8Array(out); };
const u16be = (s) => { const out = []; for (const c of s) { const n = c.charCodeAt(0); out.push(n >> 8, n & 255); } return new Uint8Array(out); };

/* ------------------------------------------------------------------ R5 */

test("R5 csv text carries {ok, container, document, undetermined, counts, images, sheets}; ok:false when parts failed", async () => {
  const t = await csvEntry.text(F.enc("a\n"));
  assert.equal(t.ok, true);
  assert.equal(t.container, "csv");
  for (const k of ["document", "undetermined", "counts", "images", "sheets"]) assert.ok(k in t, `csv.text has ${k}`);
  assert.ok(Array.isArray(t.undetermined));
  assert.deepEqual(await csvEntry.text(new Uint8Array(0)), { ok: false, container: "csv", reason: "empty_body" });
  assert.deepEqual(await csvEntry.text(undefined), { ok: false, container: "csv", reason: "PARTS_ABSENT" });
});

test("R5 csv images is always [] — a zero of the format, not of a walk", async () => {
  assert.deepEqual((await csvEntry.text(F.enc("a,b\n"))).images, []);
  assert.deepEqual((await csvEntry.text(bytes("a\x96,b\n"))).images, []);
});

test("R5 csv text: one sheet, null bound, row 1 is row 1, empty fields are measured emptiness, quoted fields per RFC 4180", async () => {
  const t = await csvEntry.text(F.enc('name,note\r\n"Smith, J","said ""hi"""\r\n,x\r\n\r\nlast,row'));
  assert.equal(t.dialect.delimiter, "comma");
  assert.equal(t.document, 'name\tnote\nSmith, J\tsaid "hi"\n\tx\nlast\trow');
  assert.deepEqual(t.sheets.map(({ cells, ...s }) => s), [{ sheet: 0, name: CSV_SHEET_NAME, hidden: false, rows: null, cols: null, usedRows: 5, usedCols: 2,
    range: { kind: "sheet-range", ref: `${CSV_SHEET_NAME}!A1:B5`, sheet: CSV_SHEET_NAME, range: "A1:B5" }, text: t.document, lineRows: [1, 2, 3, 5], undetermined: [] }]);
  assert.deepEqual(t.undetermined, []);
  assert.equal(t.counts.cells, 7);
  // a line break inside quotes is literal; it does not end the record
  const m = await csvEntry.text(F.enc("a,b\n".repeat(50) + '"one\ntwo",3\n'));
  assert.equal(m.sheets[0].usedRows, 51);
  assert.ok(m.document.endsWith("\none\ntwo\t3"));
  // no delimiter determined: one column, rows still rows
  const one = await csvEntry.text(F.enc("x\ny\n"));
  assert.equal(one.document, "x\ny");
  assert.equal(one.sheets[0].usedCols, 1);
});

test("R5 an empty field keeps its column (G131d): P100,,100 has cells at A and C and one slot per column in the text, so no value shifts left", async () => {
  const t = await csvEntry.text(F.enc("id,qty,price\nP100,,100\n,b,\n,,\nlast,,\n"));
  const s = t.sheets[0];
  assert.equal(s.text, "id\tqty\tprice\nP100\t\t100\n\tb\nlast");
  assert.deepEqual(s.lineRows, [1, 2, 3, 5]);
  assert.deepEqual(s.cells.filter((c) => c.source.cell.endsWith("2")).map((c) => c.source.cell), ["A2", "C2"]);
  assert.deepEqual(s.cells.filter((c) => c.source.cell.endsWith("3")).map((c) => c.source.cell), ["B3"]);
  assert.equal(s.usedCols, 3);
  assert.equal(s.usedRows, 5);
  // the line splits back into the columns the cells name
  assert.deepEqual(s.text.split("\n")[1].split("\t"), ["P100", "", "100"]);
});

test("R5 csv text: a field the encoding cannot read is undetermined by sheet-cell, never mojibake; the grid stands", async () => {
  /* 0x81 is a byte no legacy charset defines: the window has no encoding, so fields holding a byte >= 0x80 are unreadable */
  const t = await csvEntry.text(bytes("id,dash\n1,a\x81b\n2,plain\n\x81q\x81,3\n"));
  assert.equal(t.dialect.encoding, null);
  assert.equal(t.document, "id\tdash\n1\n2\tplain\n\t3");
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B2", reason: "encoding_undetermined" }, { sheet: 0, cell: "A4", reason: "encoding_undetermined" }]);
  assert.equal(t.counts.undetermined, 2);
  assert.equal(t.sheets[0].usedRows, 4);
  assert.equal(t.sheets[0].usedCols, 2);
});

test("R5 a UTF-8 field loses no character (G131a): Latin-1 supplement, Cyrillic, curly quotes and dashes, CJK and emoji are cells with their text", async () => {
  const fields = ["É", "Ñandú", "Привет", "it’s", "a – b", "“quoted”", "日本語", "😀 ok", "€5", "naïve café"];
  const body = fields.map((f, i) => `${i},${f}`).join("\n") + "\n";
  for (const b of [F.enc(body), new Uint8Array([0xef, 0xbb, 0xbf, ...F.enc(body)])]) {
    const t = await csvEntry.text(b);
    assert.equal(t.dialect.encoding, "utf-8");
    assert.deepEqual(t.undetermined, []);
    assert.equal(t.counts.undetermined, 0);
    assert.deepEqual(t.sheets[0].cells.filter((c) => c.source.cell.startsWith("B")).map((c) => c.value), fields);
    assert.ok(!t.document.includes("�"));
  }
});

test("R5 a UTF-8 file whose first window is ASCII reads its later characters (C26); an invalid sequence is a stated unreadable cell", async () => {
  const pad = "a,b\n".repeat((MiB >> 2) + 10);
  const row = (MiB >> 2) + 11;
  const utf = await csvEntry.text(new Uint8Array([...F.enc(pad), ...F.enc("ü’,日本\n"), ...F.enc("x,"), 0xc3, 0x28, ...F.enc("\n")]));
  assert.equal(utf.dialect.encoding, "utf-8", "the file is utf-8, not the us-ascii its first MiB alone would say");
  assert.equal(utf.dialect.assumed, true);
  assert.equal(utf.sheets[0].cells.find((c) => c.source.cell === `A${row}`).value, "ü’");
  assert.equal(utf.sheets[0].cells.find((c) => c.source.cell === `B${row}`).value, "日本");
  assert.deepEqual(utf.undetermined, [{ sheet: 0, cell: `B${row + 1}`, reason: "invalid_utf8" }]);
  assert.ok(!utf.document.includes("�"));
  assert.equal(utf.counts.replaced, 1);
});

test("R5 a windows-1252 body is read as windows-1252 and says it is assumed (C31); the replaced count is zero", async () => {
  const body = Uint8Array.from("id,name\n1,caf\xe9\n2,\x93q\x94\n3,na\xefve \x96 \x80\n", (c) => c.charCodeAt(0));
  const t = await csvEntry.text(body);
  assert.equal(t.dialect.encoding, "windows-1252");
  assert.equal(t.dialect.assumed, true);
  assert.deepEqual(t.sheets[0].cells.filter((c) => c.source.cell.startsWith("B")).map((c) => c.value), ["name", "café", "“q”", "naïve – €"]);
  assert.deepEqual(t.undetermined, []);
  assert.equal(t.counts.replaced, 0);
});

test("R5 csv text: a UTF-16 body is decoded whole, with a BOM or without one; a body that is not valid UTF-16 states the cells it spoils", async () => {
  const ok = await csvEntry.text(u16le("a,é\n1,2\n"));
  assert.equal(ok.document, "a\té\n1\t2");
  assert.equal(ok.dialect.assumed, false);
  for (const [name, body, enc] of [["LE", u16le("id,名前\n1,x\n2,y\n", false), "utf-16le"], ["BE", u16be("id,名前\n1,x\n2,y\n"), "utf-16be"]]) {
    const t = await csvEntry.text(body);
    assert.equal(t.dialect.encoding, enc, name);
    assert.equal(t.dialect.assumed, true, `${name}: no BOM decided it`);
    assert.equal(t.document, "id\t名前\n1\tx\n2\ty", name);
    assert.ok(!t.document.includes("\0"));
  }
  const bad = new Uint8Array([...u16le("a,b\n1,"), 0x00, 0xd8, 0x0a, 0x00]); // a lone high surrogate
  const t = await csvEntry.text(bad);
  assert.deepEqual(t.undetermined, [{ sheet: 0, cell: "B2", reason: "invalid_utf16" }]);
  assert.equal(t.document, "a\tb\n1");
});

test("R9 the sheet lists at most 200 unreadable cells; counts.undetermined is the whole count and cellsIn gives any address", async () => {
  assert.equal(CSV_STREAMED_UNDETERMINED_MAX, 200);
  const lines = ["id,name"];
  for (let i = 1; i <= 1000; i++) lines.push(`${i},bad\x81${i}`);
  const t = await csvEntry.text(bytes(lines.join("\n") + "\n"));
  assert.equal(t.undetermined.length, 200);
  assert.equal(t.sheets[0].undetermined.length, 200);
  assert.equal(t.counts.undetermined, 1000);
  assert.equal(t.counts.replaced, 1000);
  const last = await csvEntry.cellsIn(bytes(lines.join("\n") + "\n"), { fromRow: 1001, toRow: 1001 });
  assert.deepEqual(last.cells.map((c) => [c.source.cell, c.value]), [["A1001", "1000"], ["B1001", null]]);
});

/* ------------------------------------------------------------------ R6 */

test("R6 csv guard: the body's own byte length after any BOM against the bytes row of READ_BOUNDS; a body at it is read, one byte over both structure and text carry the marker; the dialect stands", async () => {
  const over = F.overBytes();
  for (let i = 9; i < over.length; i += 10) over[i] = 0x0a;
  for (let i = 4; i < over.length; i += 10) over[i] = 0x2c;
  const marker = { ok: false, text: "undetermined", why: "over_size_bound", size: over.length, bound: F.BYTES_BOUND, boundName: "MEASURED_CSV_TEXT_BOUND_BYTES", metric: "body_bytes", final: true };
  const t = await csvEntry.text(over);
  assert.equal(t.document, null);
  assert.deepEqual(t.sheets, []);
  assert.deepEqual(t.undetermined, [marker]);
  assert.equal(t.dialect.delimiter, "comma");
  const s = await csvEntry.structure(over);
  assert.deepEqual(s.evidentiary.undetermined[0].guard, marker);
  assert.equal(s.dialect.delimiter, "comma");
  // exactly the bound, with a BOM on top, is not over it: the BOM is not body
  const at = new Uint8Array(F.BYTES_BOUND + 3).fill(0x61);
  at.set([0xef, 0xbb, 0xbf]);
  for (let i = 3 + 99; i < at.length; i += 100) at[i] = 0x0a;
  const under = await csvEntry.text(at);
  assert.notEqual(under.document, null);
  assert.equal(under.sheets[0].usedRows, Math.ceil(F.BYTES_BOUND / 100));
});

test("R6 csv guard: a UTF-16 body over the bytes bound carries its encoding in the marker", async () => {
  const n = F.BYTES_BOUND / 2 + 8;
  const body = new Uint8Array(2 + n * 2);
  body.set([0xff, 0xfe]);
  for (let i = 0; i < n; i++) body[2 + i * 2] = i % 61 === 60 ? 0x0a : 0x61;
  const t = await csvEntry.text(body);
  assert.deepEqual(t.undetermined, [{ ok: false, text: "undetermined", why: "over_size_bound", size: body.length - 2, bound: F.BYTES_BOUND,
    boundName: "MEASURED_CSV_TEXT_BOUND_BYTES", metric: "body_bytes", final: true, encoding: "utf-16le" }]);
  assert.equal(t.dialect.encoding, "utf-16le");
});

test("R6 the records bound: 1,048,576 records are read, one more is refused whole with the count reached and the limit", async () => {
  const at = await csvEntry.text(F.enc("a\n".repeat(F.ROWS_BOUND)));
  assert.equal(at.ok, true);
  assert.equal(at.sheets[0].usedRows, F.ROWS_BOUND);
  const over = F.enc("a\n".repeat(F.ROWS_BOUND + 1));
  const marker = { ok: false, text: "undetermined", why: "over_size_bound", size: F.ROWS_BOUND + 1, bound: F.ROWS_BOUND, boundName: "MEASURED_CSV_ROWS_BOUND", metric: "rows", final: true };
  for (const t of [await csvEntry.text(over), await csvEntry.text(over, { windowBytes: 4096 })]) {
    assert.equal(t.document, null);
    assert.deepEqual(t.sheets, []);
    assert.deepEqual(t.undetermined, [marker]);
  }
  const s = await csvEntry.structure(over);
  assert.deepEqual(s.evidentiary.undetermined[0].guard, marker);
  assert.deepEqual(await csvEntry.cellsIn(over, { fromRow: 1, toRow: 1 }), { ...marker });
  assert.deepEqual(s.dialect, csvEntry.dialect(over), "the dialect of a refused body is the one dialect() states");
});

test("R6 the records and columns markers of a UTF-16 body carry its encoding", async () => {
  const t = await csvEntry.text(u16le("a\n".repeat(F.ROWS_BOUND + 1)));
  assert.deepEqual(t.undetermined, [{ ok: false, text: "undetermined", why: "over_size_bound", size: F.ROWS_BOUND + 1, bound: F.ROWS_BOUND,
    boundName: "MEASURED_CSV_ROWS_BOUND", metric: "rows", final: true, encoding: "utf-16le" }]);
  const wide = await csvEntry.text(u16le(`${",".repeat(F.COLUMNS_BOUND)}\n${",".repeat(F.COLUMNS_BOUND)}\n`));
  assert.equal(wide.undetermined[0].metric, "columns");
  assert.equal(wide.undetermined[0].encoding, "utf-16le");
});

test("R22 a record of more than 16,384 columns refuses the body whole, stated with the count and the limit; 16,384 columns are read", async () => {
  const wide = (n) => F.enc(`${Array.from({ length: n }, (_, i) => `c${i}`).join(",")}\n${Array.from({ length: n }, (_, i) => i).join(",")}\n`);
  const ok = await csvEntry.text(wide(F.COLUMNS_BOUND));
  assert.equal(ok.ok, true);
  assert.equal(ok.sheets[0].usedCols, F.COLUMNS_BOUND);
  const t = await csvEntry.text(wide(F.COLUMNS_BOUND + 1));
  assert.equal(t.document, null);
  assert.deepEqual(t.sheets, []);
  assert.deepEqual(t.undetermined, [{ ok: false, text: "undetermined", why: "over_size_bound", size: F.COLUMNS_BOUND + 1, bound: F.COLUMNS_BOUND,
    boundName: "SHEET_COLUMNS_MAX", metric: "columns", final: true }]);
  // a header of 200 KiB over 1,000 rows indexes its data rows: the header is a long record, not a wide one
  const header = Array.from({ length: 200 }, (_, i) => `h${i}`.padEnd(1024, "x")).join(",");
  const data = Array.from({ length: 1000 }, (_, r) => Array.from({ length: 200 }, (_, c) => `${r}.${c}`).join(",")).join("\n");
  const h = await csvEntry.text(F.enc(`${header}\n${data}\n`));
  assert.equal(h.sheets[0].usedRows, 1001);
  assert.equal(h.sheets[0].cells.at(-1).value, "999.199");
});

test("R22 a body of ONE line (no delimiter decided, R7) is judged by its columns too: 16,385 is refused with the count and the limit, 16,384 is read", async () => {
  const line = (n, sep = ",", end = "") => F.enc(Array.from({ length: n }, (_, i) => `c${i}`).join(sep) + end);
  const marker = (n) => [{ ok: false, text: "undetermined", why: "over_size_bound", size: n, bound: F.COLUMNS_BOUND,
    boundName: "SHEET_COLUMNS_MAX", metric: "columns", final: true }];
  for (const [sep, name] of [[",", "comma"], [";", "semicolon"], ["\t", "tab"], ["|", "pipe"]]) {
    for (const end of ["", "\n"]) {
      const over = line(F.COLUMNS_BOUND + 1, sep, end);
      const t = await csvEntry.text(over);
      assert.equal(t.document, null, `${name} ${JSON.stringify(end)}: refused whole`);
      assert.deepEqual(t.sheets, []);
      assert.deepEqual(t.undetermined, marker(F.COLUMNS_BOUND + 1), `${name}: the count and the limit`);
      const s = await csvEntry.structure(over);
      assert.deepEqual(s.evidentiary.undetermined.map((u) => u.guard), marker(F.COLUMNS_BOUND + 1));
      const at = line(F.COLUMNS_BOUND, sep, end);
      const r = await csvEntry.text(at);
      assert.equal(r.ok, true);
      assert.deepEqual(r.undetermined.filter((u) => u.why === "over_size_bound"), [], `${name}: 16,384 is not refused`);
      assert.equal(r.sheets.length, 1);
    }
  }
  // commas inside a quoted field are one field, not columns
  const quoted = await csvEntry.text(F.enc(`"${Array.from({ length: F.COLUMNS_BOUND + 5 }, (_, i) => `c${i}`).join(",")}"`));
  assert.equal(quoted.sheets.length, 1);
  assert.deepEqual(quoted.undetermined.filter((u) => u.why === "over_size_bound"), []);
  assert.equal(quoted.sheets[0].usedCols, 1);
});

test("R22 a cell over 32,767 characters is kept to 1 MiB and stated as over_cell_bound with its own reference and length; no other cell is affected", async () => {
  const a = "x".repeat(F.CELL_CHARS), b = "y".repeat(F.CELL_CHARS + 1), c = "z".repeat(F.CELL_KEPT + 5000);
  const t = await csvEntry.text(F.enc(`id,v\n1,${a}\n2,${b}\n3,${c}\n4,tail\n`));
  const cells = Object.fromEntries(t.sheets[0].cells.map((x) => [x.source.cell, x.value]));
  assert.equal(cells.B2, a, "32,767 characters are within the bound");
  assert.equal(cells.B3, b, "a cell over it is kept");
  assert.equal(cells.B4.length, F.CELL_KEPT, "a cell over 1 MiB is cut there");
  assert.equal(cells.B5, "tail");
  assert.deepEqual(t.undetermined, [
    { sheet: 0, cell: "B3", reason: "over_cell_bound", length: F.CELL_CHARS + 1 },
    { sheet: 0, cell: "B4", reason: "over_cell_bound", length: F.CELL_KEPT + 5000 },
  ]);
  assert.equal(t.counts.undetermined, 2);
  assert.equal(t.sheets[0].usedRows, 5);
});

/* ------------------------------------------------------------------ R7 */

test("R7 dialect encoding: BOM certain; UTF-16 without a BOM; no high byte us-ascii likely; valid utf-8 likely; a legacy charset assumed; otherwise null with encoding_undetermined", () => {
  const cases = [
    [[0xef, 0xbb, 0xbf, ...F.enc("a,b\n1,2\n")], "utf-8", "certain", false],
    [[0xff, 0xfe, 0x61, 0, 0x0a, 0], "utf-16le", "certain", false],
    [[0xfe, 0xff, 0, 0x61, 0, 0x0a], "utf-16be", "certain", false],
    [u16le("a,b\n1,2\n", false), "utf-16le", "likely", true],
    [u16be("a,b\n1,2\n"), "utf-16be", "likely", true],
    [F.enc("a,b\n1,2\n"), "us-ascii", "likely", true],
    [F.enc("é,b\n1,2\n"), "utf-8", "likely", true],
    [[0x61, 0x96, 0x0a], "windows-1252", "likely", true],
    [[0x61, 0x81, 0x0a], null, "none", true],
    [[0x61, 0x00, 0x96, 0x0a], null, "none", true],
    [[0xff, 0xfe, 0x00, 0x00, 0x61], null, "none", true], // UTF-32LE is not read as UTF-16LE
  ];
  for (const [b, encoding, conf, assumed] of cases) {
    const d = csvEntry.dialect(new Uint8Array(b));
    assert.equal(d.encoding, encoding, JSON.stringify([...b].slice(0, 5)));
    assert.equal(d.encodingConfidence, conf);
    assert.equal(d.assumed, assumed);
    assert.ok(Array.isArray(d.encodingSignals) && d.encodingSignals.length);
    assert.equal(d.undetermined.includes("encoding_undetermined"), encoding == null);
  }
  // a character the window's end cuts in two is not invalid
  const u = new Uint8Array(MiB + 10).fill(0x61);
  u[MiB - 1] = 0xc3; u[MiB] = 0xa9;
  assert.equal(csvEntry.dialect(u).encoding, "utf-8");
  // later windows count: ASCII first and non-ASCII after is not the us-ascii the head alone says
  const a = new Uint8Array(MiB + 10).fill(0x61);
  a[MiB + 5] = 0x96;
  assert.equal(csvEntry.dialect(a).encoding, "windows-1252");
});

test("R7 dialect delimiter: exactly one candidate consistent on a majority of the records is certain; tied, none consistent and too few lines each undetermined by name", () => {
  const d = (s) => csvEntry.dialect(F.enc(s));
  for (const [s, name] of [["a,b\n1,2\n", "comma"], ["a;b\n1;2\n", "semicolon"], ["a\tb\n1\t2\n", "tab"], ["a|b\n1|2\n", "pipe"], ['a,"x;y"\n1,"2;3;4"\n', "comma"]]) {
    const r = d(s);
    assert.equal(r.delimiter, name, s);
    assert.equal(r.delimiterConfidence, "certain");
    assert.deepEqual(r.undetermined, []);
  }
  const tied = d("a,b;c\n1,2;3\n");
  assert.equal(tied.delimiter, null);
  assert.deepEqual(tied.undetermined, ["delimiter_undetermined_tied"]);
  assert.deepEqual(d("a,b\nplain\n").undetermined, ["delimiter_undetermined_none_consistent"], "half the records is not a majority");
  assert.deepEqual(d("plain\nwords\n").undetermined, ["delimiter_undetermined_none_consistent"]);
  assert.deepEqual(d("a,b\n").undetermined, ["delimiter_undetermined_too_few_lines"]);
  assert.deepEqual(d("a,b\n1,2").undetermined, ["delimiter_undetermined_too_few_lines"], "the unterminated last line is not complete");
  // a majority decides: a ragged row, a title block, a quoted newline, CR-only endings do not fail it
  assert.equal(d("a,b\n".repeat(49) + "a,b,c\n").delimiter, "comma");
  assert.equal(d("Report title\nprepared by\nsomeone\nmore text\nand more\n" + "a,b,c\n".repeat(60)).delimiter, "comma");
  assert.equal(d('a,"x\ny"\n'.repeat(30)).delimiter, "comma");
  assert.equal(d("a;b\r1;2\r3;4\r").delimiter, "semicolon");
  assert.equal(d("a,b\n1,2,3\n").delimiter, "comma", "whatever its count on each line (cause 20): both records have commas");
  assert.equal(d("a,b\nplain\n").delimiter, null, "half the records is not a majority");
  assert.equal(d("a,b;c;d\n1,2;3;4\n5;6;7\n").delimiter, "semicolon", "two consistent: the modal count holding on most lines breaks the tie");
  // the first 1,000 complete records decide
  assert.equal(d("a,b\n".repeat(1000) + "x\n".repeat(5000)).delimiter, "comma");
  // both undetermined at once
  assert.deepEqual(csvEntry.dialect(new Uint8Array([0x81, 0x0a])).undetermined, ["encoding_undetermined", "delimiter_undetermined_too_few_lines"]);
});

test("R7 dialect: null for empty bytes or an undecodable BOM; the same computation structure() and text() report; its keys", async () => {
  assert.equal(csvEntry.dialect(new Uint8Array(0)), null);
  for (const s of ["a,b\n1,2\n", "a;b\n", "é|x\n1|2\n", "\x96,1\n2,3\n", "\x81,1\n2,3\n"]) {
    const b = bytes(s);
    const d = csvEntry.dialect(b);
    assert.deepEqual((await csvEntry.structure(b)).dialect, d);
    assert.deepEqual((await csvEntry.text(b)).dialect, d);
    assert.deepEqual((await csvEntry.parts(b)).ok, true);
    assert.deepEqual(Object.keys(d).sort(), ["assumed", "delimiter", "delimiterConfidence", "delimiterSignals", "disagree", "encoding", "encodingConfidence", "encodingSignals", "undetermined"]);
    assert.deepEqual(d.disagree, []);
  }
  const Real = globalThis.TextDecoder;
  globalThis.TextDecoder = class extends Real { constructor(l, o) { if (/utf-16/i.test(String(l))) throw new RangeError("x"); super(l, o); } };
  try { assert.equal(csvEntry.dialect(new Uint8Array([0xff, 0xfe, 0x61, 0])), null); } finally { globalThis.TextDecoder = Real; }
});
