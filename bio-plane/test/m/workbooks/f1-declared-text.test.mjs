/* F1 (T53; runtime-limits R37, the T53 register's `xlsx.declared_text` row): an xlsx whose declared text is over the
   register's xlsx row is refused by the add as WORKBOOK_FILE_TOO_LARGE, condition `declared_text`, its size and the
   row's figure and key stated, nothing written. The packages are office-readers' fixtures, their sheet part declaring
   its uncompressed size in the central directory (the reader sums the declarations before it inflates a byte). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import * as F from "../office-readers/fixtures.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { WORKBOOK_DECLARED_TEXT_MAX } from "../../../src/workbooks/index.mjs";

const NS = `xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`;
const SHEET = `<?xml version="1.0"?><worksheet ${NS}><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>`;
const declaring = (usize) => F.xlsx({ sheets: [{ name: "Big", xml: SHEET, cd: { usize } }] });

const add = async (usize) => {
  const w = world();
  for (const m of ["alice", "bob"]) w.member(m, m === "alice" ? { role: "admin" } : {});
  const P = w.project("Rates", "bob");
  const cap = w.capture(declaring(usize)).capSha;
  const before = w.snapshot();
  const r = await w.wb.addWorkbook({ captureSha: cap, question: "What does it cost?", period: "FY2025", project: P, by: V("bob") });
  return { r, unchanged: JSON.stringify(w.snapshot()) === JSON.stringify(before) };
};

test("F1 an xlsx declaring 25 MB + 1 byte of text is refused as WORKBOOK_FILE_TOO_LARGE, condition declared_text, stated on the register's xlsx.declared_text row, nothing written", async () => {
  const bound = boundOf("xlsx", "declared_text");
  assert.equal(bound, 25_000_000, "the T53 register's figure");
  assert.equal(WORKBOOK_DECLARED_TEXT_MAX, bound, "the module quotes the row");
  const { r, unchanged } = await add(bound + 1);
  assert.equal(r.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(r.condition, "declared_text");
  assert.equal(r.size_bytes, bound + 1);
  assert.equal(r.bound_bytes, bound);
  assert.deepEqual(r.limit, { size: bound + 1, bound, key: "limit.xlsx.declared_text" });
  assert.ok(r.detail && !/[{}]/.test(r.detail), "its words hold the figures");
  assert.ok(unchanged, "nothing is written");
});

test("F1 an xlsx declaring more text than the reader's streamed ceiling is stated on the xlsx row too, with its own declared size", async () => {
  const usize = boundOf("office", "streamed_text_bytes") + 1;
  const { r, unchanged } = await add(usize);
  assert.equal(r.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(r.condition, "declared_text");
  assert.deepEqual(r.limit, { size: usize, bound: boundOf("xlsx", "declared_text"), key: "limit.xlsx.declared_text" });
  assert.ok(unchanged);
});

test("F1 control: a declared text at exactly the xlsx row is not stated on it; one the reader will not hold whole is stated on the reader's own row", async () => {
  const { r, unchanged } = await add(boundOf("xlsx", "declared_text"));
  assert.equal(r.reason, "WORKBOOK_FILE_TOO_LARGE");
  assert.equal(r.condition, "declared_text");
  assert.equal(r.limit.key, "limit.office.text_bytes");
  assert.equal(r.bound_bytes, boundOf("office", "text_bytes"));
  assert.ok(unchanged);
});
