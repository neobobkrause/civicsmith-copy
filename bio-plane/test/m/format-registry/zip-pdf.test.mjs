/* format-registry, fix round 9 (T51; K4900): R20's amendment, at the module's interface. `%PDF-` in the first 1024
 * bytes makes a PDF only when the file does not begin with the ZIP local-file magic, so a ZIP whose first member is a
 * PDF stored uncompressed is the ZIP of R28 (or the office or ODF kind its entries make it), whole or from a range
 * source (R32), and a real PDF keeps Acrobat's rule. Fixed bytes only. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFormat } from "../../../src/formats.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";
/** @import { FormatDetection, RangeSource } from "../../../src/formats.mjs" */

const enc = (/** @type {string} */ s) => new TextEncoder().encode(s);
const cat = (/** @type {(string | Uint8Array)[]} */ ...xs) => Uint8Array.from(xs.flatMap((/** @type {string | Uint8Array} */ x) => [...(typeof x === "string" ? enc(x) : x)]));
const PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
/** @param {Uint8Array} bytes @returns {RangeSource} */
const source = (bytes) => ({ size: bytes.length, readRange: async (/** @type {number} */ o, /** @type {number} */ n) => bytes.slice(o, o + n) });
/** @param {FormatDetection | Promise<FormatDetection>} d @returns {FormatDetection} */
const now = (d) => { if (d instanceof Promise) throw new Error("detectFormat answered later"); return d; };

/** A ZIP of `n` members, each a PDF stored (method 0) with some filler, the first member's data starting at byte 30+name. */
const storedPdfZip = (n = 1) => makeZip(Array.from({ length: n }, (_, i) =>
  ({ name: `m${i}.pdf`, data: PDF + "\n%" + "x".repeat(4096), method: 0 })));

test("R20: a ZIP whose first member is a PDF stored uncompressed is a zip, whole and from a range source", async () => {
  for (const n of [1, 6]) {
    const z = storedPdfZip(n);
    assert.equal(now(detectFormat(z, null)).format, "zip");
    assert.equal(now(detectFormat(z, "application/pdf")).format, "zip");
    assert.equal(now(detectFormat(z.subarray(0, 1024), null)).format !== "pdf", true, "a 1 KiB head of it is not a PDF either");
    assert.equal((await detectFormat(source(z), null)).format, "zip");
  }
});

test("R20: an office file whose first stored entry holds %PDF- stays docx, and an OpenDocument one odt", async () => {
  const docx = makeZip([
    { name: "[Content_Types].xml", data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`, method: 0 },
    { name: "embed.pdf", data: PDF, method: 0 },
    { name: "word/document.xml", data: "<x/>" },
  ]);
  const officeFirst = now(detectFormat(docx, null));
  assert.equal(officeFirst.format, "docx");
  assert.equal((await detectFormat(source(docx), null)).format, "docx");
  const plain = officeZip("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml");
  assert.equal(now(detectFormat(plain, null)).format, "docx");
  const odt = now(detectFormat(odfZip("application/vnd.oasis.opendocument.text"), null));
  assert.equal(odt.format, "odt");
});

test("R20: a real PDF is a pdf — %PDF- at byte 0, and after junk that is not the ZIP magic; the ZIP magic first is not", () => {
  const at0 = enc(PDF);
  const after = cat("x".repeat(500), PDF);
  for (const b of [at0, after, cat("PK\x03", PDF), cat("PK\x03\x05", PDF), cat(" PK\x03\x04", PDF)]) {
    const r = now(detectFormat(b, null));
    assert.equal(r.format, "pdf");
    assert.equal(r.confidence, "certain");
  }
  const pk = now(detectFormat(cat("PK\x03\x04", "x".repeat(40), PDF), null));
  assert.notEqual(pk.format, "pdf", "the ZIP magic first is never a PDF");
  assert.equal(now(detectFormat(null, "application/pdf")).format, "pdf", "a content type alone still answers likely pdf");
});
