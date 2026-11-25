/* format-registry: requirement-named tests for the built-in html and pdf entries and the built-in roster
 * (build/requirements/format-registry.md R17-R23; the zip entry's R28 is zip.test.mjs, the picture entries' R29-R30 pictures.test.mjs), at the module's interface. This file never changes the
 * registry, so R23 sees it exactly as module load left it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { csvEntry } from "../../../src/csv.mjs";

const latin1 = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
const pad = (n, s) => latin1(" ".repeat(n) + s);
const html = getFormat("html"), pdf = getFormat("pdf");
const FALSY = [null, undefined, 0, "", false, NaN];

const isHit = (r, format, confidence) => {
  assert.equal(r.format, format);
  assert.equal(r.confidence, confidence);
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0 && r.signals.every((s) => typeof s === "string"));
  assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
};

test("R23: at module load the registry holds exactly the twelve built-in entries, in order, the readers' own objects unmodified", () => {
  assert.deepEqual(listFormats(), ["jpeg", "png", "html", "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "zip"]);
  for (const [f, e] of [["docx", docxEntry], ["xlsx", xlsxEntry], ["pptx", pptxEntry], ["odt", odtEntry],
    ["ods", odsEntry], ["odp", odpEntry], ["csv", csvEntry]]) {
    assert.equal(getFormat(f), e, `${f} is the reader's own entry object`);
    assert.equal(e.format, f);
  }
  assert.equal(html.format, "html");
  assert.equal(pdf.format, "pdf");
  assert.equal(getFormat("jpeg").format, "jpeg");
  assert.equal(getFormat("png").format, "png");
  assert.equal(getFormat("zip").format, "zip");
});

test("R17: html detect with bytes — a doctype or <html> root, any case, that BEGINS the decoded first 1024 bytes is certain; a text that mentions it is not; content type unconsulted", () => {
  for (const s of ["<!doctype html>", "<!DOCTYPE HTML PUBLIC>", "<!DocType Html>", "<html>", "<HTML lang=en>", "<html",
    "  \n\t<html>", "<?xml version=\"1.0\"?>\n<!DOCTYPE html>", "<!-- generated -->\n<!doctype html>",
    "<!-- a --><!-- b -->  <html>", "<?xml version=\"1.0\"?><!-- c --><html xmlns=\"http://www.w3.org/1999/xhtml\">"]) {
    isHit(html.detect(latin1(s), null), "html", "certain");
    isHit(html.detect(latin1(s), "application/pdf"), "html", "certain");
  }
  // the 1024-byte window: a root ending at byte 1024 counts, one byte later does not
  isHit(html.detect(pad(1019, "<html"), null), "html", "certain");
  assert.equal(html.detect(pad(1020, "<html"), null), null);
  isHit(html.detect(pad(1010, "<!doctype html"), null), "html", "certain");
  assert.equal(html.detect(pad(1011, "<!doctype html"), null), null);
  // UTF-8 with a BOM, and UTF-16 by its BOM, are decoded before the root is looked for
  isHit(html.detect(Uint8Array.from([0xef, 0xbb, 0xbf, ...latin1("<!doctype html>")]), null), "html", "certain");
  const u16 = (s, le) => Uint8Array.from([...(le ? [0xff, 0xfe] : [0xfe, 0xff]), ...[...s].flatMap((c) => (le ? [c.charCodeAt(0), 0] : [0, c.charCodeAt(0)]))]);
  isHit(html.detect(u16("<html><body>x", true), null), "html", "certain");
  isHit(html.detect(u16("<!DOCTYPE html>", false), null), "html", "certain");
  // G141 (X27): a text that merely MENTIONS the root, anywhere in the first KiB, is text
  for (const s of ["x<Html>y", "Note: the page begins <html> and then", "a mail about <!doctype html> pages", "see <!doctype html>",
    "<!doctype xml>", "<htm>", "< html>", "<head><body>", "%PDF-1.7", "plain text", "<!doctypehtml", "<htmlx>", "<html5>",
    "<!-- never closed <html>", "<?xml never closed <html>", "// <html>\nint main(){}", "<p>a <html> mention</p>"]) {
    assert.equal(html.detect(latin1(s), null), null, s);
    assert.equal(detectFormat(latin1(s), null).format !== "html", true, s);
  }
  // content type is not consulted while bytes are truthy — even an empty Uint8Array
  assert.equal(html.detect(latin1("plain"), "text/html"), null);
  assert.equal(html.detect(new Uint8Array(0), "text/html"), null);
  assert.equal(html.detect(latin1("plain"), "application/xhtml+xml"), null);
});

test("R18: html detect without bytes — exactly text/html or application/xhtml+xml is likely; anything else null", () => {
  for (const b of FALSY) {
    isHit(html.detect(b, "text/html"), "html", "likely");
    isHit(html.detect(b, "application/xhtml+xml"), "html", "likely");
    for (const ct of ["TEXT/HTML", "Text/Html", "text/html; charset=utf-8", " text/html", "text/html ", "text/xhtml",
      "application/xhtml", "text/plain", "", null, undefined, "application/pdf"]) {
      assert.equal(html.detect(b, ct), null, `${String(b)} / ${String(ct)}`);
    }
  }
});

test("R19: the html entry answers detection only — parts, structure and text are null", () => {
  assert.equal(html.parts, null);
  assert.equal(html.structure, null);
  assert.equal(html.text, null);
});

test("R20: pdf detect with bytes — the literal %PDF- within the first 1024 bytes is certain, case-sensitive; else null; content type unconsulted", () => {
  for (const s of ["%PDF-1.7\n", "%PDF-", "junk%PDF-2.0", "%PDF-1.4 %\xe2\xe3\xcf\xd3"]) {
    isHit(pdf.detect(latin1(s), null), "pdf", "certain");
    isHit(pdf.detect(latin1(s), "text/html"), "pdf", "certain");
  }
  isHit(pdf.detect(pad(1019, "%PDF-"), null), "pdf", "certain");
  assert.equal(pdf.detect(pad(1020, "%PDF-"), null), null);
  for (const s of ["%pdf-1.7", "%PDF1.7", "PDF-1.7", "% PDF-", "<html>", "plain"]) assert.equal(pdf.detect(latin1(s), null), null);
  assert.equal(pdf.detect(latin1("plain"), "application/pdf"), null);
  assert.equal(pdf.detect(new Uint8Array(0), "application/pdf"), null);
});

test("R21: pdf detect without bytes — exactly application/pdf is likely; anything else null", () => {
  for (const b of FALSY) {
    isHit(pdf.detect(b, "application/pdf"), "pdf", "likely");
    for (const ct of ["APPLICATION/PDF", "Application/Pdf", "application/pdf; charset=binary", " application/pdf",
      "application/x-pdf", "text/pdf", "", null, undefined, "text/html"]) {
      assert.equal(pdf.detect(b, ct), null, `${String(b)} / ${String(ct)}`);
    }
  }
});

test("R22: pdf parts and text are null; structure(bytes) is extractPdfStructure(bytes)'s own result, unchanged", async () => {
  assert.equal(pdf.parts, null);
  assert.equal(pdf.text, null);
  assert.equal(typeof pdf.structure, "function");
  const doc = latin1([
    "%PDF-1.7",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [4 0 R] >>\nendobj",
    "4 0 obj\n<< /Type /Annot /Subtype /Link /Rect [1 2 3 4] /A << /S /URI /URI (https://example.gov/a.pdf) >> >>\nendobj",
    "%%EOF\n"].join("\n"));
  for (const input of [doc, latin1("not a pdf"), new Uint8Array(0), null, undefined, "%PDF-1.7", pad(1020, "%PDF-1.4")]) {
    const via = pdf.structure(input);
    assert.ok(via instanceof Promise);
    assert.deepEqual(await via, await extractPdfStructure(input));
  }
  const r = await pdf.structure(doc);
  assert.equal(r.ok, true);
  assert.equal(r.links[0].target.url, "https://example.gov/a.pdf");
  // and it is what the registry's detect→structure path reaches
  assert.deepEqual(await getFormat(detectFormat(doc, null).format).structure(doc), await extractPdfStructure(doc));
});
