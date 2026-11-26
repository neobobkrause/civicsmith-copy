/* csv-reader R6 and R9 (fix round 9, G124f, G131i; K4834): a body up to the standard's bound (50 MB, the `csv` bytes row of
   READ_BOUNDS) is read in windows, in bounded memory; a body over it is STATED with its size and `final`. Every body is a
   real one built by `large.mjs`, its expected text computed by a route that shares no code with the reader. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { csvEntry, MEASURED_CSV_TEXT_BOUND_BYTES, walkRecords, createRecordWalk } from "../../../src/csv-reader/index.mjs";
import { bigCsv, prng } from "./large.mjs";
import { harnessCsv } from "./g41.mjs";
import * as F from "./fixtures.mjs";
/** @import { TextResult, TextDone, TextSheet, TypedCell, PartsResult, CsvParts, StructureResult, StructureDone } from "../../../src/csv-reader/index.mjs" */
/** @import { WorkerAsk } from "./large.mjs" */

const MIB = 1024 * 1024;
const BOUND = MEASURED_CSV_TEXT_BOUND_BYTES;
/** @param {string | null} got @param {string} want @param {string} what @returns {void} */
const same = (got, want, what) => assert.ok(got === want, `${what}: ${got == null ? got : got.length} chars, wanted ${want.length}`);

/** A read that gave a document. @param {TextResult} t @returns {TextDone} */
const done = (t) => {
  if (!t.ok) assert.fail(`refused: ${t.reason}`);
  if (t.document === null) assert.fail("over a bound");
  return t;
};
/** A read that was not refused, a document or a body over a bound. @param {TextResult} t */
const notRefused = (t) => {
  if (!t.ok) assert.fail(`refused: ${t.reason}`);
  return t;
};
/** The first sheet. @param {TextDone} t @returns {TextSheet} */
const sheet0 = (t) => {
  const s = t.sheets[0];
  if (s === undefined) assert.fail("no sheet");
  return s;
};
/** The first sheet's listed cells. @param {TextDone} t @returns {TypedCell[]} */
const cells0 = (t) => {
  const c = sheet0(t).cells;
  if (c === null) assert.fail("cells held");
  return c;
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

test("R6 csv: the bytes bound is the table's, 50 MB (the standard), with no literal in the module", () => {
  assert.equal(BOUND, F.BYTES_BOUND);
  assert.equal(BOUND, 50 * MIB);
  assert.equal(F.ROWS_BOUND, 1048576);
});

test("R9 csv: a 12 MB body yields its records, quoted fields and line breaks included, whole, with every cell", async () => {
  const f = bigCsv({ rows: 5500 });
  assert.ok(f.declared > 10 * MIB && f.declared <= BOUND, `fixture is ${f.declared} bytes`);
  const parts = partsOk(await csvEntry.parts(f.bytes));
  assert.equal(parts.ok, true);
  const t = done(await csvEntry.text(parts));
  assert.equal(t.ok, true);
  same(t.document, f.expected, "document");
  assert.equal(sheet0(t).usedRows, f.rows);
  assert.equal(sheet0(t).usedCols, 6);
  assert.ok(Array.isArray(sheet0(t).cells));
  assert.equal(t.dialect.delimiter, "comma");
  assert.ok(!("piecewise" in t));
  const st = structureOk(await csvEntry.structure(parts));
  assert.equal(st.ok, true);
  assert.ok(!st.notes.includes("text_read_in_pieces"));
});

const WORKER = new URL("./large-worker.mjs", import.meta.url);
/**
 * What this suite reads of the worker's answer (a WorkerAnswer of large.mjs).
 * @typedef {Object} WorkerSizes
 * @property {boolean} ok
 * @property {number | null} documentLength
 * @property {number} undetermined
 */
/**
 * The worker's answer, decoded: this module's own channel.
 * @param {unknown} v
 * @returns {WorkerSizes}
 */
const sizesOf = (v) => {
  if (typeof v !== "object" || v === null || !("ok" in v) || !("documentLength" in v) || !("undetermined" in v)) assert.fail("not a worker answer");
  const { ok, documentLength, undetermined } = v;
  if (typeof ok !== "boolean" || typeof undetermined !== "number" || (documentLength !== null && typeof documentLength !== "number")) assert.fail("not a worker answer");
  return { ok, documentLength, undetermined };
};
/**
 * Reads `bytes` in a worker under an old-space limit of `limitMb`.
 * @param {Uint8Array} bytes
 * @param {number} limitMb
 * @returns {Promise<WorkerSizes>}
 */
const inWorker = async (bytes, limitMb) => {
  /** @type {WorkerAsk} */
  const ask = { bytes };
  const options = { workerData: ask, argv: [], resourceLimits: { maxOldGenerationSizeMb: limitMb } };
  /** @type {Promise<unknown>} */
  const answered = new Promise((resolve, reject) => {
    const w = new Worker(WORKER, options);
    w.on("message", (/** @type {unknown} */ m) => resolve(m));
    w.on("error", (/** @type {unknown} */ e) => reject(e));
  });
  return sizesOf(await answered);
};

test("R19 memory: a csv read of 17 MiB completes inside a 128 MB old-space limit", async () => {
  const f = bigCsv({ rows: 8900 });
  assert.ok(f.declared > 16 * MIB - 1 && f.declared <= 18 * MIB, `csv declares ${f.declared}`);
  const got = await inWorker(f.bytes, 128);
  assert.equal(got.ok, true);
  assert.equal(got.undetermined, 0);
  assert.equal(got.documentLength, f.expected.length);
});

test("R9 csv: a harness CSV of a few MiB is read whole with its cells held; a body over the bound is stated with its size, final, and nothing is read", async () => {
  const { bytes } = harnessCsv(6 * MIB);
  const whole = done(await csvEntry.text(bytes, { inlineCellsMax: 512 * 1024 }));
  assert.equal(whole.ok, true);
  assert.ok(whole.document.includes("LASTROWMARK"));
  const over = F.overBytes();
  for (let i = 99; i < over.length; i += 100) over[i] = 0x0a;
  const marker = { ok: false, text: "undetermined", why: "over_size_bound", size: BOUND + 1, bound: BOUND,
    boundName: "MEASURED_CSV_TEXT_BOUND_BYTES", metric: "body_bytes", final: true };
  for (const r of [await csvEntry.text(over), await csvEntry.text(over, { inlineCellsMax: 512 * 1024 })]) {
    const t = notRefused(r);
    assert.equal(t.ok, true);
    assert.equal(t.document, null);
    assert.deepEqual(t.sheets, []);
    assert.deepEqual(t.undetermined, [marker]);
    assert.ok(!("piecewise" in t));
  }
  const st = structureOk(await csvEntry.structure(over));
  assert.deepEqual(st.evidentiary.undetermined[0]?.guard, marker);
  assert.ok(st.notes.includes("text_body_over_bound"));
  assert.deepEqual(await csvEntry.cellsIn(over, { fromRow: 1, toRow: 1 }), { ...marker });
});

test("R9 csv: a 27 MB body, over the old 17 MiB and 24 MiB bounds, is read: its last row is in the text", async () => {
  const f = bigCsv({ rows: 14000 });
  assert.ok(f.declared > 24 * MIB && f.declared <= BOUND, `fixture is ${f.declared} bytes`);
  const t = done(await csvEntry.text(f.bytes, { inlineCellsMax: 512 * 1024 }));
  assert.equal(t.ok, true);
  same(t.document, f.expected, "document");
  const sheet = sheet0(t);
  assert.equal(sheet.usedRows, f.rows);
  assert.equal(sheet.cells, null);
  assert.equal("cells_held" in sheet && sheet.cells_held, true);
  assert.equal(t.counts.cells, f.rows * 6 - Math.floor(f.rows / 11));
});

test("R9 csv: walking a text in pieces cut anywhere gives the records of walking it whole", () => {
  const rand = prng(41);
  const alphabet = ['a', 'b', ',', '"', '"', '\r', '\n', '\r\n', ' ', ';'];
  for (let round = 0; round < 400; round++) {
    let text = "";
    for (let i = 0, n = 1 + (rand() % 60); i < n; i++) text += alphabet[rand() % alphabet.length] ?? "";
    /** @type {Array<string | null>} */
    const delimiters = [",", null];
    for (const delimiter of delimiters) {
      const whole = walkRecords(text, delimiter);
      for (let cuts = 1; cuts <= 4; cuts++) {
        const points = Array.from({ length: cuts }, () => rand() % (text.length + 1)).sort((a, b) => a - b);
        /** @type {string[][]} */
        const got = [];
        const w = createRecordWalk(delimiter, (r) => got.push(r));
        let from = 0;
        for (const p of points) { w.feed(text.slice(from, p)); from = p; }
        w.feed(text.slice(from));
        w.end();
        assert.deepEqual(got, whole, JSON.stringify({ text, delimiter, points }));
      }
    }
  }
});

test("R9 csv: a Latin-1 body with 12,000 accented fields is read as windows-1252, every cell with its text and none undetermined", async () => {
  /** @type {string[]} */
  const lines = [];
  for (let i = 0; i < 60; i++) lines.push(`${i},plain,text\n`);
  for (let i = 0; i < 12000; i++) lines.push(`${i},${"p".repeat(200)},café\n`);
  const text = lines.join("");
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  const t = done(await csvEntry.text(bytes));
  assert.equal(t.ok, true);
  assert.equal(t.dialect.encoding, "windows-1252");
  assert.deepEqual(t.undetermined, []);
  assert.equal(t.counts.undetermined, 0);
  assert.equal(cells0(t).filter((c) => c.value === "café").length, 12000);
});
