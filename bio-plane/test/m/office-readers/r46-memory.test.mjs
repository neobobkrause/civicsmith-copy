/* office-readers R46 (fix round 9, G178; K5006): a workbook is read within its memory with room to spare. The text of a sheet and
   the document's are made once: not as one string per row beside the joined sheet and the joined document, and not while the
   unpacked parts they came from are all still held. Two parts: the answer is what it always was (the control), and the read's
   peak, measured in a child, is a small multiple of the document it makes. The whole case at the platform's shape (150,000 rows
   against `capFor(128)`) is plane's `g41-shape.test.mjs`, whose xlsx case carries the 85 % margin. */
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

test("R46 a 150,000-row workbook of 3 cells a row (the platform's shape) is read holding at most 6.5 bytes for each character of the document above its idle, while the unpacked parts are streamed and the text is made once", async (t) => {
  const recipe = { kind: "xlsx", seed: "hx150000", size: { rows: 150_000, cols: 3 }, header: "one", types: ["text", "integer", "text"] };
  const chunks = [];
  for await (const c of generate(recipe).chunks()) chunks.push(Buffer.from(c));
  const dir = mkdtempSync(join(tmpdir(), "r46-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "table.xlsx");
  writeFileSync(file, Buffer.concat(chunks));
  const child = async () => JSON.parse((await run(process.execPath, ["--expose-gc", "--max-old-space-size=202", "--max-semi-space-size=2",
    join(HERE, "r46-peak-child.mjs"), file], { maxBuffer: 1 << 26 })).stdout);
  /* the least of three: a collector that runs late shows in one run, not in all */
  const runs = [await child(), await child(), await child()];
  const best = runs.reduce((a, b) => (b.aboveIdleMB < a.aboveIdleMB ? b : a));
  t.diagnostic(`above idle ${runs.map((r) => r.aboveIdleMB.toFixed(1)).join(", ")} MB for a document of ${best.documentLength} characters`);
  assert.equal(best.ok, true);
  assert.equal(best.sheetIsDocument, true, "one sheet: its text is the document, held once");
  assert.equal(best.lines, 150_001);
  assert.ok(best.piecewise, "over the whole-read bound the sheet is read in pieces");
  assert.ok(best.aboveIdleMB * 1048576 <= 6.5 * best.documentLength, `${best.aboveIdleMB.toFixed(1)} MB above idle for ${best.documentLength} characters`);
});

/* The whole case at the platform's shape is plane's `g41.probe.mjs` (the shape harness: the real plane's ledger in a child under `capFor`'s cap, the xlsx case of
   `g41-shape.test.mjs`). It is run here as the process it is, not imported (it is plane's, a later module than this one), and its own report is read: the cap it ran
   at and the most memory any tick held. */
test("R46 the shape harness's 150,000-row xlsx (plane's g41 probe, run as its own process) peaks at most 85 % of its cap, the child alive", async (t) => {
  const probe = join(HERE, "..", "plane", "shape", "g41.probe.mjs");
  const platform = join(HERE, "..", "..", "platform-sqlite.mjs");
  const out = (await run(process.execPath, ["--import", platform, probe, "xlsx"], { maxBuffer: 1 << 26, timeout: 1_800_000 })).stdout;
  const cap = Number(/cap (\d+) MB, child survived/.exec(out)?.[1]);
  const peaks = [...out.matchAll(/^ {2}(?:tick \d+:.*peak heap\+buffers|done:.*, peak) ([\d.]+) MB/gm)].map((m) => Number(m[1]));
  t.diagnostic(`cap ${cap} MB; the ticks' peaks ${peaks.join(", ")} MB`);
  assert.ok(cap >= 150, `the case runs at the object's cap, ${cap} MB`);
  assert.ok(peaks.length >= 2, "the report states the ticks' peaks");
  assert.match(out, /^ {2}PASS \(cap \d+ MB\)$/m);
  const peak = Math.max(...peaks);
  assert.ok(peak <= 0.85 * cap, `peak ${peak} MB is ${(100 * peak / cap).toFixed(1)} % of the cap ${cap} MB`);
});
