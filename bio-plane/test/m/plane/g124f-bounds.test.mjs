/* plane G124f (fix round 9; S-9, P8; corpus R set, plan section 7 item 3; K4426 "Still MISSING" row 2): the heavy spreadsheet kinds at their bounds, through plane's shape runner (the real plane in a
   child under the one cap convention and the platform's value limit), each file read to its end by the ledger. Every figure is read from `READ_BOUNDS` by `boundOf` (never a literal here); a case is a file whose
   figure is exactly `bound - 2`, `bound` or `bound + 1`, made by `shape/exact-gen.mjs` (the declared uncompressed text-part bytes of an XLSX's sheet or an ODS's content.xml, or the file's own bytes, to the byte).
     C03  bound - 2   read whole              C04  the bound   read whole              C05  bound + 1   REFUSED, stated with its size and its limit (the figures, not a sentence about a "region")
     C06  1,048,576 narrow rows padded to the entry's bound + 1: refused at the entry with its limit
     C07  1,048,576 rows x one narrow column, no row or cell references: read whole, or refused with size and limit      C08  1,048,577 rows: the same
     C07r, C08r  the same rows WITH references: over the declared-text bound, refused with size and limit
     X05  a 33 MiB declared XLSX (the walker's 236,709-row file's size): refused with size and limit, never "undecodable" (S-8)
   RESTATED for T53 (BOB's ruling, MSG bob-82 (1); runtime-limits T53-511, T53-540): the bounds are those in force: an XLSX's declared text `xlsx.declared_text` (25 MB), an ODS's declared content.xml
   `ods.content_xml` as `boundOf` answers it, and the entry's whole-read row for a spreadsheet, `wholeReadRow("spreadsheet")` (`spreadsheet.bytes`, 50 MiB), which the capture applies at the upload, so a
   file over it is refused there (`refusedAtUpload`). (The 24 MiB `pdf.bytes` ceiling these cases were written against is no spreadsheet's row since T53, and the 30,000,000 B C06 is under the entry's bound.)
   A case whose refusal the readers do not yet make at the bound in force is a `test.todo` naming the gap (K208), never a red test: an XLSX over `xlsx.declared_text` is read, not refused (C05, C07r, C08r,
   X05), an ODS's content.xml is refused at 20,971,520 B, not at `boundOf("ods", "content_xml")` (C03-C05), and an XLSX padded to the entry's bound is taken at the upload but
   the xlsx entry produces no text from it (entry C03, C04): office-readers' or reading-pipeline's, named in the job's not-verified.
   A refusal passes only with a numeric `size` equal to the file's figure and `bound` equal to the table's, and the member's sentence (the reading's `why`/`basis`) holding both figures and not the word "undecodable".
   Counts, never clocks (R-CLOCK). HEAVY: run alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeRun, capFor, report } from "./shape/harness.mjs";
import { exactFile } from "./shape/exact-gen.mjs";
import { whole, refused, refusedAtUpload } from "./shape/reading-judge.mjs";
import { boundOf, wholeReadRow } from "../../../src/read-bounds.mjs";

const MiB = 1048576;
const BOUNDS = {
  "xlsx declared text": { kind: "xlsx", bound: boundOf("xlsx", "declared_text"), figure: "declared" },
  "ods declared content.xml": { kind: "ods", bound: boundOf("ods", "content_xml"), figure: "declared" },
  "entry file bytes": { kind: "xlsx", bound: boundOf(...wholeReadRow("spreadsheet")), figure: "file" },
};
const ENTRY = boundOf(...wholeReadRow("spreadsheet"));
/* the cases the readers do not yet meet at the bounds in force (K208: a todo, never a red test) */
const XLSX_NOT_REFUSED = "not met: an XLSX over xlsx.declared_text is read whole, not refused (office-readers / reading-pipeline; T53-540)";
const ODS_AT_OTHER_BOUND = "not met: an ODS's content.xml is refused at 20971520 B, not at boundOf('ods','content_xml') (office-readers / file-safety)";
const ENTRY_NOT_READ = "not met: an XLSX of 1 MB declared text padded to the entry's bound is taken at the upload, then the xlsx entry produces no text from it (office-readers)";
const GAPS = { "xlsx declared text": { C05: XLSX_NOT_REFUSED },
               "ods declared content.xml": { C03: ODS_AT_OTHER_BOUND, C04: ODS_AT_OTHER_BOUND, C05: ODS_AT_OTHER_BOUND },
               "entry file bytes": { C03: ENTRY_NOT_READ, C04: ENTRY_NOT_READ } };
async function read(rec) {
  const f = await exactFile(rec);
  const r = await shapeRun({ doc: { kind: "file", path: f.path, bytes: f.bytes, name: f.name, type: f.type, marks: [] }, maxTicks: 400, pageAll: false }, { capMB: capFor(Math.min(f.bytes, 2 * MiB) / MiB) });
  console.log(report(`${JSON.stringify(rec)} -> ${f.bytes} B file, ${f.rows} rows`, r));
  return { f, r };
}
for (const [name, { kind, bound, figure }] of Object.entries(BOUNDS)) {
  const rec = (n) => (figure === "declared" ? { kind, declared: n } : { kind, declared: 1_000_000, padTo: n });
  const gap = GAPS[name] || {};
  const t = (id, title, fn) => (gap[id] ? test.todo(`${title} (${gap[id]})`) : test(title, { timeout: 1_800_000 }, fn));
  t("C03", `G124f SHEET C03 ${name}: ${bound} - 2 is read whole`, async () => { const { r } = await read(rec(bound - 2)); whole(r, `C03 ${name}`); });
  t("C04", `G124f SHEET C04 ${name}: the bound ${bound} itself is read whole`, async () => { const { r } = await read(rec(bound)); whole(r, `C04 ${name}`); });
  t("C05", `G124f SHEET C05 ${name}: ${bound} + 1 is refused with its size and its limit`, async () => {
    const { r } = await read(rec(bound + 1));
    if (figure === "file") refusedAtUpload(r, `C05 ${name}`, bound); else refused(r, `C05 ${name}`, bound + 1, bound);
  });
}

test(`G124f SHEET C06: 1,048,576 narrow rows padded to the entry's bound + 1 (${ENTRY + 1} B) are refused at the entry with its limit`, { timeout: 1_800_000 }, async () => {
  const { f, r } = await read({ kind: "xlsx", declared: null, narrow: true, rows: 1_048_576, padTo: ENTRY + 1 });
  assert.equal(f.bytes, ENTRY + 1); assert.ok(f.bytes > ENTRY, "the file is over the entry's whole-read row");
  refusedAtUpload(r, "C06", ENTRY);
});

for (const [id, rows] of [["C07", 1_048_576], ["C08", 1_048_577]]) {
  test(`G124f SHEET ${id}: ${rows} rows x one narrow column (XLSX) is read whole or refused with its size and limit`, { timeout: 1_800_000 }, async () => {
    const { f, r } = await read({ kind: "xlsx", declared: null, narrow: true, rows });
    assert.equal(f.rows, rows);
    assert.equal(r.died, false, r.error || r.stderr);
    const g = r.reading; assert.ok(g, "no reading was made");
    if (g.refusal) refused(r, id, Number(g.refusal.size), Number(g.refusal.bound)); else whole(r, id);
    console.log(`${id}: ${g.refusal ? "REFUSED " + JSON.stringify(g.refusal) : "READ WHOLE, " + g.total + " characters"} (declared ${f.declared} B)`);
  });
}

/* the same ladder with the row and cell references every writer puts in (an XLSX of 1,048,576 rows is then over the declared-text bound at about 48 MB, so the heavy kind is refused for its bytes, with size and limit) */
for (const [id, rows] of [["C07r", 1_048_576], ["C08r", 1_048_577]])
  test.todo(`G124f SHEET ${id}: ${rows} rows x one narrow column with references (XLSX) is refused with its declared size and the xlsx limit (${XLSX_NOT_REFUSED})`);

/* PRODUCT FINDING F1 (corpus-1-T51.md): the smallest case of C07/C08. A workbook whose rows and cells carry no `r` attribute (optional in the format; test-support's `no-r` file) is read by the XLSX entry (`text()`: 2,000 cells) yet the
   reading is `none`, no unit, no statement: `formats-xlsx.mjs:764` advances `usedRows` only for a row with an integer `r`, so the sheet's used range is empty and no block is made. */
test("G124f finding F1: a 1,000-row workbook without row and cell references is read whole, never recorded as an empty reading", { timeout: 600_000 }, async () => {
  const { r } = await read({ kind: "xlsx", declared: null, narrow: true, rows: 1000 });
  whole(r, "F1");
  assert.ok(r.done.units > 0, "F1: the reading holds units");
});

test.todo(`G124f SHEET X05: a 33 MiB declared XLSX is refused with its size and limit, never worded 'undecodable' (S-8) (${XLSX_NOT_REFUSED})`);
