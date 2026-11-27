/* pdf-reader: requirement-named tests for the density term of the refusal of a document too large to read (build/requirements/pdf-reader.md
 * R42; fix round 5, E2), at the module's interface: `extractPdfStructure` of a PDF whose pages carry more text than the pages the
 * page rule was measured on. Measured under workerd with `reading-pipeline.read` at the index path's 2 MiB budget (build/jobs/T51/pdf-reader.md):
 * 1,500 pages of 200 lines, 11.6 MB, need 113 MB, where the page rule says 83. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { densePdf } from "./dense.mjs";

/** A value that is there; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} v
 *  @param {string} what
 *  @returns {T} */
function must(v, what) {
  if (v === undefined || v === null) throw new Error(`${what}: none`);
  return v;
}

test("R42: 1,500 pages of 200 lines of text, 11.6 MB, are refused as final with their pages: they need 113 MB and the page rule alone said 83", { timeout: 600_000 }, async () => {
  const bytes = densePdf({ pages: 1500, linesPerPage: 200 });
  assert.ok(bytes.length > 11 * 1048576 && bytes.length < 12 * 1048576, `${bytes.length}`);
  const got = await extractPdfStructure(bytes);
  assert.equal(got.ok, false, "the reading was started");
  assert.equal(got.reason, "TOO_LARGE_TO_READ");
  assert.equal(got.failure, "final");
  assert.equal(got.pages, 1500);
  assert.equal(got.bytes, bytes.length);
  assert.equal(got.limit_mb, 100);
  assert.ok(got.need_mb > 100 && got.need_mb < 125, `need ${got.need_mb} MB (measured 113)`);
  assert.equal("text" in got ? got.text : undefined, undefined);
  assert.equal("links" in got ? got.links : undefined, undefined);
});

test("R42: the density term decides on the characters, not the pages: 1,000 pages of 120 lines are read, 1,500 of 200 lines are not, 3,000 of 80 are refused by the page rule as before", { timeout: 600_000 }, async () => {
  const read = await extractPdfStructure(densePdf({ pages: 1000, linesPerPage: 120 }));
  assert.equal(read.ok, true, `${"reason" in read ? read.reason : undefined} ${"need_mb" in read ? read.need_mb : undefined}`);
  assert.equal(read.text.pages.length, 1000);
  const before = await extractPdfStructure(densePdf({ pages: 3000, linesPerPage: 80 }));
  assert.equal(before.ok, false);
  assert.equal(before.reason, "TOO_LARGE_TO_READ");
  assert.equal(before.text_share, 1, "decided by the page rule");
});

test("R42 (control): the sample leaves the answer as it was: notes, text and markers of a 200-page document of 120 lines", { timeout: 600_000 }, async () => {
  const a = await extractPdfStructure(densePdf({ pages: 200, linesPerPage: 120 }));
  const b = await extractPdfStructure(densePdf({ pages: 60, linesPerPage: 120 }));
  for (const r of [a, b]) {
    assert.equal(r.ok, true);
    assert.deepEqual(r.notes, []);
    assert.equal(r.text.undetermined.length, 0);
  }
  if (!a.ok) throw new Error(`refused as ${a.reason}`);
  assert.equal(a.text.pages.length, 200);
  assert.ok(must(a.text.pages[0], "page 0").text.length > 1000);
});
