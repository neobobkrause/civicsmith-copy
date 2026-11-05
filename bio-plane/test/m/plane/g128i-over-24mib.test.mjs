/* plane G128i, FILES OVER 25,165,824 B (24 MiB) STATED "NOT READ" AGAINST BOB'S TIERS (fix round 9; X29; round 7 G14; corpus R set, K4426 "Still MISSING" row 6): the whole-read ceiling of the alpha is `boundOf("pdf","bytes")`
   (25,165,824 B, reading-pipeline `WHOLE_READ_MAX`), and it is the heavy kinds' alone (PDF, office, image: K4628's tier is 100 MB for a document, the alpha keeps 24 MiB where it is lower and says so, K4831 (3)). The LIGHT kinds (text, CSV,
   TSV, JSON, XML) take the standard from Stage 1 (K4834): `boundOf("text","bytes")` and `boundOf("csv","bytes")` are 50 MB. Through plane's shape runner (the real plane in a child under the one cap convention and the platform's value limit),
   each file uploaded by the member's path and read to its end by the ledger, the figures read from `READ_BOUNDS` by `boundOf` (never a literal here):
     text   25,165,825 B   (one byte over the alpha's whole-read ceiling, under the text tier)   READ WHOLE, the last line found    [round 7's A.md:12 "24 bytes over ... so it was not read"]
     csv    25,165,825 B                                                                         READ WHOLE, the last row found
     pdf    25,165,825 B   (over the heavy kinds' ceiling)    REFUSED, stated with its size and its limit, nothing owed
     text   the text tier + 1   REFUSED, stated with its size and its limit
   RESTATED for T53 (BOB's ruling, MSG bob-82 (1); runtime-limits T53-511): the heavy kinds' whole-read row `pdf.bytes` is now the standard, 104,857,600 B, equal to the text tier, so
   no file is over the one and under the other. The cases keep their files at the former ceiling, `READ_BOUNDS.pdf.bytes.alpha` + 1 (25,165,825 B, read from the table), which the text and CSV
   tiers now read whole, and the two refusals move to the figures in force: a PDF one byte over `boundOf("pdf","bytes")` and a text one byte over `boundOf("text","bytes")`, each stated with
   its size and its limit, at the upload when the capture refuses it there (`refusedAtUpload`), else by the reading.
   Counts only (R-CLOCK). HEAVY: run alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeRun, capFor, textDoc, csvDoc, pdfDoc, report } from "./shape/harness.mjs";
import { whole, refused, refusedAtUpload } from "./shape/reading-judge.mjs";
import { boundOf, READ_BOUNDS } from "../../../src/read-bounds.mjs";
import { generate as pdfGenerate } from "../../pdfgen.mjs";
import { mkdirSync, existsSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const MiB = 1048576;
const FORMER = READ_BOUNDS.pdf.bytes.alpha;   /* 25,165,824: the ceiling these cases were written against */
const WHOLE = FORMER;
const PDF = boundOf("pdf", "bytes");   /* 104,857,600 in force */
/* stated with its size and its limit, at the upload or by the reading */
const statedOver = (r, label, size, bound) => (/the upload was refused/.test(String(r.error || "")) ? refusedAtUpload(r, label, bound) : refused(r, label, size, bound));
const run = (doc, extra = {}) => shapeRun({ doc, maxTicks: 400, pageAll: false, ...extra }, { capMB: capFor(doc.bytes / MiB) });

test("G128i over-24MiB: a text one byte over the whole-read ceiling is under the text tier, so it is read whole and its last line is found, never stated 'not read'", { timeout: 3_600_000 }, async () => {
  const bytes = WHOLE + 1;
  assert.ok(bytes <= boundOf("text", "bytes"), "the text tier is above the whole-read ceiling");
  const r = await run(textDoc(bytes), { search: ["ENDMARKER"] });
  console.log(report(`text ${bytes} B`, r));
  whole(r, "text over 24 MiB");
  assert.ok(r.done.found.ENDMARKER >= 1, "the last line's mark is in the index");
});

test("G128i over-24MiB: a CSV one byte over the whole-read ceiling is under the CSV tier, so it is read whole and its last row is found", { timeout: 3_600_000 }, async () => {
  const bytes = WHOLE + 1;
  assert.ok(bytes <= boundOf("csv", "bytes"), "the CSV tier is above the whole-read ceiling");
  const r = await run(csvDoc(bytes));
  console.log(report(`csv ${bytes} B`, r));
  whole(r, "csv over 24 MiB");
  assert.ok(r.done.found.LASTROWMARK >= 1, "the last row's mark is in the index");
});

test("G128i over-24MiB: a PDF one byte over the heavy kinds' whole-read row in force is stated with its size and its limit, nothing owed", { timeout: 3_600_000 }, async () => {
  const dir = process.env.BIO_FIXTURE_CACHE || join(tmpdir(), "bio-test-fixtures"); mkdirSync(dir, { recursive: true });
  const path = join(dir, `over-pdf-${PDF + 1}.pdf`);
  if (!existsSync(path)) { const g = pdfGenerate({ kind: "pdf", seed: "over24", size: { pages: 3, lines: 20, bytes: PDF + 1 }, fonts: ["type0"] }); await pipeline(Readable.from(g.chunks()), createWriteStream(path + ".part")); (await import("node:fs")).renameSync(path + ".part", path); }
  const doc = pdfDoc(path);
  assert.equal(doc.bytes, PDF + 1);
  const r = await shapeRun({ doc, maxTicks: 60, pageAll: false }, { capMB: capFor(2) });
  console.log(report(`pdf ${doc.bytes} B`, r));
  statedOver(r, "pdf over its row", PDF + 1, PDF);
  if (r.done) assert.deepEqual(r.done.left, [], "nothing is owed to the ledger for a file that will not be read");
});

test("G128i over-24MiB: a text one byte over the text tier is stated with its size and its limit", { timeout: 3_600_000 }, async () => {
  const tier = boundOf("text", "bytes"), bytes = tier + 1;
  const r = await run(textDoc(bytes), { keepLater: "ledger" });
  console.log(report(`text ${bytes} B`, r));
  statedOver(r, "text over its tier", bytes, tier);
});
