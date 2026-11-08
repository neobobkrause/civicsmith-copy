/* G41 at the platform's shape (K4426 (4); plan G41 (3), D6; K4636, K4639): a sheet is HELD and its text read whole; its typed cells are not all made at intake. A 4 MB CSV, an 8 MB CSV, the
 * largest CSV csv-reader's stated bound takes (`MEASURED_CSV_TEXT_BOUND_BYTES`, 20 MiB) and a 200,000-row xlsx (3 short cells a row, about 30.5 MB of declared sheet text, a 3 MB file) are uploaded by the
 * member's path and read to the end by the real plane's ledger, in a child under TEST-SUPPORT #9's value limit whose old space is `capFor(N)` for a file of N MB (G123a: the ONE cap convention, `cap.mjs`; the `128 + 39 - N` of this file's first
 * writing is retired). Pass, per run: the child alive, every tick within the work budget BY COUNT (evidence reads, bytes served, units, statements: `bars.mjs`; never node's wall time, R-CLOCK, G123b), `readingFor` stating its state at every tick, the first, a middle and the last row found in the index, in the text rows whose extent holds the row the generator put the mark on, and by `op=search` (`passage:`), `cellsOf` of the last row
 * answering the generator's cells at the same cap, the largest stored value under 1 MiB. The memory peaks are printed. A size that does not fit is reported with the largest that does.
 *   node g41.probe.mjs [csv4 csv8 csvmax xlsx ...]     (default: all four; one run at a time) */
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { shapeRun, csvDoc, xlsxRowsDoc, report, capFor, STORED_VALUE_BOUND } from "./harness.mjs";
import { generate as sheetGenerate } from "../../../sheetgen.mjs";
import { tickCountFailures, markExtentFailures } from "./bars.mjs";
import { MEASURED_CSV_TEXT_BOUND_BYTES } from "../../../../src/csv-reader/index.mjs";
import { boundOf } from "../../../../src/read-bounds.mjs";
import { STREAMED_TEXT_BOUND_BYTES } from "../../../../src/ooxml.mjs";

/* plane R116 (T53; K5655, K5648; amends R84): THE XLSX CASES ARE SIZED FROM THE BOUNDS, never from a fixed row count (the 150,000 and 200,000 rows of K4855 were sized
   for the alpha's 32 MiB and exceed the standard's 25 MB). The case read whole is the most rows of sheetgen's 3-cell workbook whose declared sheet text is at
   `runtime-limits`' `boundOf("xlsx", "declared_text")` (within 2 % under it); the refused case is the fewest rows over the bound office-readers refuses a sheet's
   text at, final (`ooxml`'s `STREAMED_TEXT_BOUND_BYTES`, its R35: the readers take the standard since runtime-limits T53-511, so a workbook between the two is read
   in pieces, not refused). Each count is measured from the generator's own central directory (`declaredSheetBytes`), so a bound changed in its table changes the case. */
export const XLSX_DECLARED_BOUND = boundOf("xlsx", "declared_text");
export const XLSX_REFUSED_BOUND = STREAMED_TEXT_BOUND_BYTES;
const declaredOf = async (rows) => declaredSheetBytes((await xlsxRowsDoc(rows)).recipe);
/** R116: the row count of sheetgen's 3-cell workbook whose declared sheet text is at `bound` (`"under"`: the most rows at or under it, within 2 %) or just over it (`"over"`) */
export async function rowsForDeclared(bound, side = "under") {
  const sample = 40_000, per = (await declaredOf(sample)) / sample;
  if (side === "under") {
    let n = Math.floor(bound / per), d = await declaredOf(n);
    while (d > bound) { n = Math.floor(n * bound / d) - 100; d = await declaredOf(n); }
    if (d < bound * 0.98) throw new Error(`R116: ${n} rows declare ${d} B, not within 2 % under ${bound} B`);
    return n;
  }
  let n = Math.ceil(bound / per * 1.01), d = await declaredOf(n);
  while (d <= bound) { n = Math.ceil(n * 1.02); d = await declaredOf(n); }
  return n;
}
export const XLSX_ROWS = await rowsForDeclared(XLSX_DECLARED_BOUND, "under");
export const XLSX_REFUSED_ROWS = await rowsForDeclared(XLSX_REFUSED_BOUND, "over");
/** the marks of a document: the CSV generator's three, or sheetgen's `<seed>-R<row>-C<col>` (G123e) */
export const marksOf = (doc) => doc.marks;
/** the cap for a file of `bytes` (N MB = MiB the bytes take in the object): the one convention, `capFor` (G123a) */
export const g41Cap = (bytes) => capFor(bytes / 1048576);
const csvMax = MEASURED_CSV_TEXT_BOUND_BYTES;
export const CASES = {
  csv4: async () => ({ label: "G41 4 MB CSV", doc: csvDoc(4 * 1048576) }),
  csv8: async () => ({ label: "G41 8 MB CSV", doc: csvDoc(8 * 1048576) }),
  csv12: async () => ({ label: "G41 12 MB CSV", doc: csvDoc(12 * 1048576) }),
  csv16: async () => ({ label: "G41 16 MB CSV", doc: csvDoc(16 * 1048576) }),
  csvmax: async () => ({ label: `G41 ${csvMax / 1048576} MB CSV (csv-reader's MEASURED_CSV_TEXT_BOUND_BYTES)`, doc: csvDoc(csvMax - 8192) }),
  xlsx: async () => ({ label: `G41 ${XLSX_ROWS}-row xlsx`, doc: await xlsxRowsDoc(XLSX_ROWS) }),
};
/** K4855: the cases that are refused at the alpha's bound, their refusal stated */
export const REFUSED_CASES = {
  xlsx200: async () => ({ label: `G41 ${XLSX_REFUSED_ROWS}-row xlsx (over office-readers' streamed text bound)`, doc: await xlsxRowsDoc(XLSX_REFUSED_ROWS) }),
};

/** K4855: the sheet text a generated workbook declares, from its own central directory (the worksheets' uncompressed sizes): the generator's figure, not the reader's */
export async function declaredSheetBytes(recipe) {
  const parts = []; for await (const c of sheetGenerate(recipe).chunks()) parts.push(Buffer.from(c));
  const b = Buffer.concat(parts);
  const z64 = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06])), eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let off = z64 >= 0 ? Number(b.readBigUInt64LE(z64 + 48)) : b.readUInt32LE(eocd + 16), total = 0;
  while (off + 46 <= b.length && b.readUInt32LE(off) === 0x02014b50) {
    const nl = b.readUInt16LE(off + 28), xl = b.readUInt16LE(off + 30), cl = b.readUInt16LE(off + 32), name = b.toString("utf8", off + 46, off + 46 + nl);
    let size = b.readUInt32LE(off + 24);
    if (size === 0xffffffff) size = Number(b.readBigUInt64LE(off + 46 + nl + 4));
    if (name.startsWith("xl/worksheets/")) total += size;
    off += 46 + nl + xl + cl;
  }
  return total;
}

/** K4855: one refused case: the run, and what failed (empty: the refusal is final, its size and bound the generator's declared sheet text and the bound, the child alive) */
export async function runRefused(name, { bound }) {
  const { label, doc } = await REFUSED_CASES[name]();
  const cap = g41Cap(doc.bytes);
  const r = await shapeRun({ doc, search: doc.marks, readingEachTick: true, cellsOf: false, maxTicks: 50 }, { capMB: cap });
  const f = [];
  if (r.died) f.push(`the child died: ${r.error || r.stderr || r.signal || "exit " + r.code}`);
  else {
    if (r.done.left.length) f.push(`the ledger still owes ${r.done.left} after ${r.done.ticks} ticks: a refusal is final, never owed`);
    if (r.ticks.length > 2) f.push(`the refusal took ${r.ticks.length} ticks; it is stated in one`);
    const last = r.ticks[r.ticks.length - 1];
    if (!last || !last.readingFor || last.readingFor.failure !== "final") f.push(`the reading is not final: ${JSON.stringify(last && last.readingFor)}`);
    const c = r.reading && r.reading.completeness;
    if (!c || c.state !== "stated" || !(typeof c.why === "string" && c.why)) f.push(`completeness is not stated: ${JSON.stringify(c)}`);
    /* the figures as data (K3810: a test never copies a sentence): the refusal's size is the generator's declared sheet text, its bound the table's */
    const declared = await declaredSheetBytes(doc.recipe), got = r.reading && r.reading.refusal;
    if (!got || got.size !== declared || got.bound !== bound) f.push(`the refusal states ${JSON.stringify(got)}, not size ${declared} and bound ${bound}`);
    if (!(declared > bound)) f.push(`the case is not over its bound: ${declared} <= ${bound}`);
    if (r.overBound) f.push(`a stored value of ${r.largestStored} B is over ${STORED_VALUE_BOUND} B`);
  }
  return { name, label, cap, r, failed: f };
}

/** one case: the run, and the list of what failed (empty: pass) */
export async function runCase(name, capOverride = null) {
  const { label, doc } = await CASES[name]();
  const cap = capOverride ?? g41Cap(doc.bytes);
  const r = await shapeRun({ doc, search: doc.marks, readingEachTick: true, cellsOf: true, maxTicks: 600 }, { capMB: cap });
  return { name, label, cap, r, failed: failures(r, doc.bytes) };
}

export function failures(r, fileBytes) {
  const f = [];
  if (r.died) return [`the child died: ${r.error || r.stderr || r.signal || "exit " + r.code}`];
  const d = r.done;
  if (d.left.length) f.push(`the ledger still owes ${d.left} after ${d.ticks} ticks`);
  f.push(...tickCountFailures(r.ticks, fileBytes));   /* G123b: the work budget is a count, never node's wall time (R-CLOCK) */
  const mute = r.ticks.filter((t) => !t.readingFor || t.readingFor.error || !(t.readingFor.state || t.readingFor.failure)); if (mute.length) f.push(`readingFor did not state its state at ${mute.length} tick(s), first: ${JSON.stringify(mute[0] && mute[0].readingFor)}`);
  f.push(...markExtentFailures(d));
  for (const m of Object.keys((d.gen && d.gen.markRows) || {})) {
    if (!(d.found[m] >= 1)) f.push(`${m} is not in the index (capture_text_fts rows: ${d.found[m]})`);
    const s = d.search[m]; if (!s || s.error || !(s.total >= 1)) f.push(`op=search passage:${m} found nothing: ${JSON.stringify(s)}`);
  }
  const c = r.cells;
  if (!c) f.push("cellsOf of the last row was not asked"); else if (c.error) f.push(`cellsOf of the last row: ${c.error}`);
  else if (JSON.stringify(c.values) !== JSON.stringify(c.expected)) f.push(`cellsOf of the last row ${c.lastRow} answered ${JSON.stringify(c.values)}, not ${JSON.stringify(c.expected)}`);
  if (r.largestStored == null) f.push("the largest stored value was not measured"); else if (r.overBound) f.push(`a stored value of ${r.largestStored} B is over ${STORED_VALUE_BOUND} B`);
  if (r.readingDied) f.push("the child died asking readingFor of the finished reading");
  return f;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2).filter((a) => CASES[a]); let worst = 0;
  for (const name of names.length ? names : Object.keys(CASES)) {
    const out = await runCase(name);
    console.log(report(out.label, out.r));
    console.log(`  ${out.failed.length ? "FAIL: " + out.failed.join("; ") : "PASS"} (cap ${out.cap} MB)`);
    if (out.failed.length) {
      worst = 1;
      if (name.startsWith("csv")) {   /* the stated bound: the largest CSV that fits, at its cap */
        for (const mb of [16, 12, 8, 6, 4, 2, 1]) {
          if (mb * 1048576 >= (await CASES[name]()).doc.bytes) continue;
          const t = await shapeRun({ doc: csvDoc(mb * 1048576), search: doc.marks, readingEachTick: true, cellsOf: true, maxTicks: 600 }, { capMB: g41Cap(mb * 1048576) });
          const tf = failures(t, mb * 1048576); console.log(`  try ${mb} MB at cap ${g41Cap(mb * 1048576)}: ${tf.length ? "FAIL " + tf[0] : "PASS (the largest that fits)"}`);
          if (!tf.length) break;
        }
      }
    }
  }
  process.exit(worst);
}
