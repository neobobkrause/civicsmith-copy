/* csv-reader, proposed R16 (G15, K4579): every sheet carries `lineRows`, one 1-based source row number per line of
   `sheet.text`, whole-file and windowed alike. Each body is built here and its expected row numbers computed by a route
   that shares no code with the reader (the row each line was written on). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvEntry } from "../../../src/csv-reader/index.mjs";
import { csvField, randomText, prng } from "./large.mjs";
import { enc } from "./fixtures.mjs";
/** @import { TextResult, TextDone, TextSheet } from "../../../src/csv-reader/index.mjs" */

/** @param {string} text @returns {number} */
const rowsOfLines = (text) => (text === "" ? 0 : text.split("\n").length);

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

test("R16 (proposed) lineRows: a csv with empty rows gives each line its true source row", async () => {
  /* A cell's row is its record's number. 120 records first (the delimiter signature reads the first 50 lines), every
     4th an empty line, every 9th only empty fields; then record 121 holds a quoted line break, record 122 is data. */
  /** @type {string[]} */
  const body = [];
  /** @type {number[]} */
  const want = [];
  for (let r = 1; r <= 120; r++) {
    if (r % 4 === 0) body.push("");
    else if (r % 9 === 0) body.push(",");
    else { body.push(`k${r},v${r}`); want.push(r); }
  }
  body.push('"p\nq",r'); want.push(121, 121);
  body.push("last,row"); want.push(122);
  const sheet = sheet0(done(await csvEntry.text(enc(body.join("\r\n")))));
  /* the quoted field holds a line break, so record 121's text spans two lines, each with that record's row */
  assert.equal(sheet.lineRows.length, rowsOfLines(sheet.text));
  assert.deepEqual(sheet.lineRows, want);
  assert.equal(sheet.text.split("\n").at(-3), "p");
  assert.equal(sheet.usedRows, 122);
});

test("R16 (proposed) lineRows: a plain csv's lineRows is 1..n; an empty-only csv's is []", async () => {
  const t = done(await csvEntry.text(enc("a,b\nc,d\ne,f\n")));
  assert.deepEqual(sheet0(t).lineRows, [1, 2, 3]);
  const e = done(await csvEntry.text(enc("\n\n\n")));
  assert.equal(sheet0(e).text, "");
  assert.deepEqual(sheet0(e).lineRows, []);
});

test("R16 (proposed) lineRows: a body walked in windows (over 1 MiB, cells held) gives each line its true row", async () => {
  const rand = prng(23);
  /** @type {string[]} */
  const out = [];
  /** @type {number[]} */
  const want = [];
  let bytes = 0;
  for (let r = 1; bytes <= 2.5 * 1024 * 1024; r++) {
    /** @type {string} */
    let record;
    if (r > 60 && r % 5 === 0) record = "";                       // an empty record: no line, its row is skipped
    else if (r > 60 && r % 7 === 0) {                              // a quoted field holding a bare line break: two lines, one row
      record = [String(r), `a,b\nsecond ${randomText(rand, 380)}`, randomText(rand, 400)].map(csvField).join(",");
      want.push(r, r);
    } else {
      record = [String(r), randomText(rand, 400), randomText(rand, 400)].map(csvField).join(",");
      want.push(r);
    }
    out.push(record);
    bytes += record.length + 2;
  }
  const t = done(await csvEntry.text(enc(out.join("\r\n") + "\r\n"), { inlineCellsMax: 512 * 1024 }));
  assert.equal(t.ok, true);
  const sheet = sheet0(t);
  assert.ok(sheet.cells === null && "cells_held" in sheet && sheet.cells_held === true, "cells held");
  assert.equal(sheet.lineRows.length, rowsOfLines(sheet.text));
  assert.deepEqual(sheet.lineRows, want);
  assert.equal(sheet.usedRows, out.length);
});
