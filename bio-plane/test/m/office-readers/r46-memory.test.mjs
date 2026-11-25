/* office-readers R46 (fix round 9, G178; K5006): a workbook is read within its memory with room to spare. The text of a sheet and
   the document's are made once: not as one string per row beside the joined sheet and the joined document, and not while the
   unpacked parts they came from are all still held. Two parts: the answer is what it always was (the control), and the read's
   peak, measured in a child run under the object's cap (`capFor`, runtime-limits) for the file it reads, is at most 85 % of that
   cap and a small multiple of the document it makes. The same case read through the assembled plane's ledger is plane's
   `g41-shape.test.mjs`. */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "./fixtures.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { generate } from "../../sheetgen.mjs";
import { capFor } from "../../../src/byte-ledger.mjs";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const sheetOf = (rows) => F.sheetXml({ rows: rows.map((cells, i) => ({ r: i + 1, cells: cells.map((is, j) => ({ r: `${"ABC"[j]}${i + 1}`, t: "inlineStr", is })) })) });

test("R46 control: a workbook of several sheets answers the same text: each sheet's own lines, the document the non-empty sheets' texts joined by a newline, every character exact", async () => {
  const one = [["naïve", "señor", "ordinance"], ["مدينة", "😀 emoji", "﻿first"], ["a&amp;b", "tab", "end"]];
  const three = [["x"], ["y", "z"]];
  const bytes = F.xlsx({ sheets: [
    { name: "One", xml: sheetOf(one) },
    { name: "Empty", data: { rows: [] } },
    { name: "Three", xml: sheetOf(three) },
  ] });
  const t = await xlsxEntry.text(bytes);
  assert.equal(t.ok, true);
  const want = [one.map((r) => r.join("\t").replace("a&amp;b", "a&b")).join("\n"), "", three.map((r) => r.join("\t")).join("\n")];
  assert.deepEqual(t.sheets.map((s) => s.text), want);
  assert.equal(t.document, `${want[0]}\n${want[2]}`);
  assert.equal(t.counts.chars, t.document.length);
  assert.deepEqual(t.sheets.map((s) => s.lineRows), [[1, 2, 3], [], [1, 2]]);
  /* the text is the sheet's own whatever the options are */
  const held = await xlsxEntry.text(bytes, { inlineCellsMax: 0 });
  assert.equal(held.document, t.document);
  assert.deepEqual(held.sheets.map((s) => s.text), want);
});

test("R46 control: a workbook of one sheet gives that sheet's text as its document; no sheet with text gives the empty document", async () => {
  const solo = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "Solo", xml: sheetOf([["only", "row"]]) }] }));
  assert.equal(solo.document, "only\trow");
  assert.equal(solo.sheets[0].text, solo.document);
  const none = await xlsxEntry.text(F.xlsx({ sheets: [{ name: "A", data: { rows: [] } }, { name: "B", data: { rows: [] } }] }));
  assert.equal(none.document, "");
  assert.deepEqual(none.sheets.map((s) => s.text), ["", ""]);
  assert.equal(none.counts.chars, 0);
});

test("R46 control: a sheet that cannot be read to its end gives none of its lines, and the sheets around it are exactly their own (a part whose declared size is not its size is read in pieces and fails after its rows were walked)", async () => {
  const before = [["first", "sheet"], ["second", "row"]], after = [["last", "sheet"]];
  const bytes = F.xlsx({ sheets: [
    { name: "Before", xml: sheetOf(before) },
    { name: "Bad", xml: sheetOf([["never", "kept"], ["lost", "rows"]]), cd: F.OVER_WHOLE },
    { name: "After", xml: sheetOf(after) },
  ] });
  const t = await xlsxEntry.text(bytes);
  assert.equal(t.ok, true);
  assert.equal(t.sheets[1].text, "");
  assert.deepEqual(t.sheets[1].lineRows, undefined);
  assert.equal(t.sheets[1].cells, null);
  const text = (rows) => rows.map((r) => r.join("\t")).join("\n");
  assert.equal(t.sheets[0].text, text(before));
  assert.equal(t.sheets[2].text, text(after));
  assert.equal(t.document, `${text(before)}\n${text(after)}`);
  assert.ok(!t.document.includes("never") && !t.document.includes("lost"), "none of the unreadable sheet's rows is in the document");
});

test("R46 a 150,000-row workbook of 3 cells a row (the platform's shape), read in a child under its cap capFor(N) for a file of N MB, peaks at most 85 % of that cap and holds at most 6.5 bytes for each character of the document above its idle, while the unpacked parts are streamed and the text is made once", async (t) => {
  const recipe = { kind: "xlsx", seed: "hx150000", size: { rows: 150_000, cols: 3 }, header: "one", types: ["text", "integer", "text"] };
  const chunks = [];
  for await (const c of generate(recipe).chunks()) chunks.push(Buffer.from(c));
  const dir = mkdtempSync(join(tmpdir(), "r46-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "table.xlsx");
  const bytes = Buffer.concat(chunks);
  writeFileSync(file, bytes);
  const cap = capFor(bytes.length / 1048576);
  const child = async () => JSON.parse((await run(process.execPath, ["--expose-gc", `--max-old-space-size=${cap}`, "--max-semi-space-size=2",
    join(HERE, "r46-peak-child.mjs"), file], { maxBuffer: 1 << 26 })).stdout);
  /* the least of three: a collector that runs late shows in one run, not in all */
  const runs = [await child(), await child(), await child()];
  const best = (k) => runs.reduce((a, b) => (b[k] < a[k] ? b : a));
  t.diagnostic(`cap ${cap} MB; peak ${runs.map((r) => r.peakMB.toFixed(1)).join(", ")} MB; above idle ${runs.map((r) => r.aboveIdleMB.toFixed(1)).join(", ")} MB for a document of ${runs[0].documentLength} characters`);
  for (const r of runs) {
    assert.equal(r.ok, true);
    assert.equal(r.sheetIsDocument, true, "one sheet: its text is the document, held once");
    assert.equal(r.lines, 150_001);
    assert.ok(r.piecewise, "over the whole-read bound the sheet is read in pieces");
  }
  assert.ok(cap > 0, `capFor gives a cap for a file of ${bytes.length} bytes`);
  const peak = best("peakMB").peakMB;
  assert.ok(peak <= 0.85 * cap, `peak ${peak.toFixed(1)} MB is ${(100 * peak / cap).toFixed(1)} % of the cap ${cap} MB`);
  const idle = best("aboveIdleMB");
  assert.ok(idle.aboveIdleMB * 1048576 <= 6.5 * idle.documentLength, `${idle.aboveIdleMB.toFixed(1)} MB above idle for ${idle.documentLength} characters`);
});
