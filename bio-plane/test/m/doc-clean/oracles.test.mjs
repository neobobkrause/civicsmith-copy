/* doc-clean R5: each copy checked independently of this module. A PDF copy passes `qpdf --check` and opens in pdf.js
 * with the same pages and text as its original; a package copy passes Info-ZIP's `unzip -t` and opens in LibreOffice
 * with the same text as its original. The text pdf-reader, office-readers and odf-reader answer is the same for the
 * copy as for the original, except the metadata R6 removes (and an image's content address, which R2 changes), and
 * none of that metadata is in the copy. A check whose tool is missing is skipped by name, never passed. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { cleanDocument } from "../../../src/doc-clean/index.mjs";
import { extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { docxEntry } from "../../../src/docx.mjs";
import { xlsxEntry } from "../../../src/formats-xlsx.mjs";
import { pptxEntry } from "../../../src/pptx.mjs";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { SECRETS, has, jpeg, pdf, incremental, objStm, makePdf, enc, docx, xlsx, pptx, odf } from "./fixtures.mjs";
/** @import { DocxEntry, DocxText } from "../../../src/docx.mjs" */
/** @import { XlsxEntry, XlsxText } from "../../../src/formats-xlsx.mjs" */
/** @import { PptxEntry, PptxText } from "../../../src/pptx.mjs" */
/** @import { OdtText, OdsText, OdpText, ImagesPart } from "../../../src/odf.mjs" */
/** The reader each package copy is read back through (office-readers, odf-reader).
 *  @typedef {DocxEntry | XlsxEntry | PptxEntry | typeof odtEntry | typeof odsEntry | typeof odpEntry} PackageEntry */
/** What one of those readers' text() answers for a package it read.
 *  @typedef {DocxText | XlsxText | PptxText | (OdtText & ImagesPart) | (OdsText & ImagesPart) | (OdpText & ImagesPart)} PackageText */

const NO_QPDF = spawnSync("qpdf", ["--version"], { encoding: "utf8" }).error ? "qpdf is not installed" : false;
const NO_UNZIP = spawnSync("unzip", ["-v"], { encoding: "utf8" }).error ? "Info-ZIP unzip is not installed" : false;
const NO_SOFFICE = spawnSync("soffice", ["--version"], { encoding: "utf8" }).error ? "LibreOffice (soffice) is not installed" : false;
const NO_PDFTOTEXT = spawnSync("pdftotext", ["-v"], { encoding: "utf8" }).error ? "pdftotext is not installed" : false;
/* pdf.js from $PDFJS_DIST first, then as bio-plane resolves it. */
const PDFJS_DIST = process.env.PDFJS_DIST;
/** @returns {string | null} */
function pdfjsFromDist() {
  if (!PDFJS_DIST) return null;
  try { return createRequire(join(PDFJS_DIST, "x.js")).resolve("pdfjs-dist/legacy/build/pdf.mjs"); } catch {}
  const direct = join(PDFJS_DIST, "legacy/build/pdf.mjs");
  return existsSync(direct) ? direct : null;
}
/** @returns {boolean} */
function pdfjsResolves() {
  try { createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.mjs"); return true; } catch { return false; }
}
const PDFJS = pdfjsFromDist();
const NO_PDFJS = PDFJS || pdfjsResolves() ? false : "pdfjs-dist is not installed (bio-plane, or $PDFJS_DIST)";
const DIR = mkdtempSync(join(tmpdir(), "doc-clean-oracles-"));

/** Each PDF, and what its pages show.
 *  @type {[string, Uint8Array, string[]][]} */
const PDFS = [
  ["plain", pdf(), ["Hello"]],
  ["incremental", incremental(pdf(), jpeg({ meta: false })), ["Hello"]],
  ["annotated", pdf({ page: "/Annots [9 0 R]", more: ["<< /Type /Annot /Subtype /Text /Rect [0 0 10 10] /T (COMMENTERSECRET) /M (D:20190304) /Contents (Check this) >>"] }), ["Hello"]],
  ["objectStream", makePdf(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 9 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 8 0 R >> /XObject << /Im 5 0 R >> >> /Contents 4 0 R >>",
    { dict: "<< /Filter /FlateDecode >>", data: new Uint8Array(deflateSync("BT /F1 12 Tf 20 150 Td (Page one) Tj ET q 30 0 0 30 20 20 cm /Im Do Q")) },
    { dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: jpeg() },
    { dict: "<< >>", data: enc("BT /F1 12 Tf 20 150 Td (Page two) Tj ET") },
    objStm(8, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 8 0 R >> >> /Contents 6 0 R >>"])]), ["Page one", "Page two"]],
];

/** @type {[string, Uint8Array, PackageEntry][]} */
const PACKAGES = [["docx", docx(), docxEntry], ["xlsx", xlsx(), xlsxEntry], ["pptx", pptx(), pptxEntry], ["odt", odf("odt"), odtEntry], ["ods", odf("ods"), odsEntry], ["odp", odf("odp"), odpEntry]];

/** Each document's copy, beside its name, its original and what the table holds with it.
 *  @template E
 *  @param {[string, Uint8Array, E][]} table
 *  @returns {Promise<{ k: string, original: Uint8Array, copy: Uint8Array, with: E }[]>} */
async function copies(table) {
  /** @type {{ k: string, original: Uint8Array, copy: Uint8Array, with: E }[]} */
  const out = [];
  for (const [k, original, w] of table) {
    const r = await cleanDocument(original);
    assert.equal(r.ok, true, `${k}: ${r.ok ? "" : r.detail}`);
    assert.equal(r.clean, false);
    if (!r.ok || r.clean) throw new Error(`${k}: no copy`);
    out.push({ k, original, copy: r.bytes, with: w });
  }
  return out;
}

test("R5 a PDF copy passes qpdf --check", { skip: NO_QPDF }, async () => {
  for (const { k, copy } of await copies(PDFS)) {
    const f = join(DIR, `qpdf-${k}.pdf`);
    writeFileSync(f, copy);
    const r = spawnSync("qpdf", ["--check", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${k}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /No syntax or stream encoding errors found/);
  }
});

test("R5 a PDF copy opens in pdf.js and shows its original's pages and text", { skip: NO_PDFJS }, async () => {
  /** @type {typeof import("pdfjs-dist/legacy/build/pdf.mjs")} */
  const pdfjs = PDFJS ? await import(pathToFileURL(PDFJS).href) : await import("pdfjs-dist/legacy/build/pdf.mjs");
  /** @param {Uint8Array} bytes */
  const read = async (bytes) => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
    /** @type {string[]} */
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => "str" in x ? x.str : undefined).join(""));
    const info = (await doc.getMetadata()).info;
    await doc.destroy();
    return { pages, author: ("Author" in info ? info.Author : null) ?? null, creator: ("Creator" in info ? info.Creator : null) ?? null };
  };
  for (const { k, copy, with: shown } of await copies(PDFS)) {
    const b = await read(copy);
    assert.deepEqual(b.pages, shown, k);
    assert.deepEqual([b.author, b.creator], [null, null], `${k}: no /Info in the copy`);
  }
});

test("R5 pdf-reader answers the same text, pages and images for a PDF copy as for its original, and no metadata is in the copy", async () => {
  for (const { k, original, copy } of await copies(PDFS)) {
    const a = await extractPdfStructure(original), b = await extractPdfStructure(copy);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) throw new Error(`${k}: not read`);
    const aImages = a.images, bImages = b.images;
    if (!aImages || !bImages) throw new Error(`${k}: no images read`);
    assert.equal(b.pages, a.pages, k);
    assert.deepEqual(b.text.pages, a.text.pages, k);
    assert.equal(b.text.document, a.text.document, k);
    assert.deepEqual(bImages.map(({ rect, mime, width, height }) => ({ rect, mime, width, height })), aImages.map(({ rect, mime, width, height }) => ({ rect, mime, width, height })), k);
    assert.equal(b.text.producer.producer, null, k);
    assert.deepEqual(SECRETS.filter((s) => has(copy, s)), [], k);
  }
});

test("R5 a package copy passes Info-ZIP's unzip -t", { skip: NO_UNZIP }, async () => {
  for (const { k, copy } of await copies(PACKAGES)) {
    const f = join(DIR, `unzip-copy.${k}`);
    writeFileSync(f, copy);
    const r = spawnSync("unzip", ["-t", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${k}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /No errors detected/);
  }
});

test("R5 a package copy opens in LibreOffice and shows its original's text", { skip: NO_SOFFICE || NO_PDFTOTEXT, timeout: 600_000 }, async () => {
  /** @param {string} to @param {string} out @param {string[]} files */
  const lo = (to, out, files) => spawnSync("soffice", [`-env:UserInstallation=${pathToFileURL(join(DIR, "lo-profile")).href}`, "--headless", "--convert-to", to, "--outdir", out, ...files], { encoding: "utf8", timeout: 270_000 });
  /* LibreOffice 24 cannot load this file's hand-written .ods (with or without its comment), so the spreadsheet it
   * checks is one LibreOffice writes itself from the .xlsx fixture, metadata, comment and all. */
  const xf = join(DIR, "lo-source.xlsx");
  writeFileSync(xf, xlsx());
  lo("ods", DIR, [xf]);
  const ods = new Uint8Array(readFileSync(join(DIR, "lo-source.ods")));
  /** @type {[string, Uint8Array, PackageEntry][]} */
  const table = PACKAGES.map(([k, bytes, entry]) => [k, k === "ods" ? ods : bytes, entry]);
  const all = await copies(table);
  /** @type {string[]} */
  const files = [];
  for (const { k, original, copy } of all) {
    /** @type {[string, Uint8Array][]} */
    const both = [["original", original], ["copy", copy]];
    for (const [which, bytes] of both) {
      const f = join(DIR, `lo-${which}-${k}.${k}`);
      writeFileSync(f, bytes);
      files.push(f);
    }
  }
  const out = join(DIR, "lo-out"), sheet = /** @param {string} f */ (f) => /(^|\.)(xlsx|ods)$/.test(f);
  /** @type {[string, string[]][]} */
  const groups = [["pdf", files.filter((f) => !sheet(f))], ["csv", files.filter(sheet)]];
  for (const [to, group] of groups) {
    const r = lo(to, out, group);
    assert.equal(r.status, 0, r.stderr);
  }
  /** @param {string} which @param {string} k @returns {string} */
  const shown = (which, k) => {
    const made = join(out, `lo-${which}-${k}.${sheet(k) ? "csv" : "pdf"}`);
    assert.ok(existsSync(made), `${which} ${k} converted`);
    return sheet(k) ? readFileSync(made, "utf8") : spawnSync("pdftotext", [made, "-"], { encoding: "utf8" }).stdout;
  };
  for (const { k } of all) {
    const a = shown("original", k), b = shown("copy", k);
    assert.ok(b.trim().length > 0, k);
    assert.equal(b, a, k);
    assert.deepEqual(SECRETS.filter((s) => b.includes(s)), [], k);
  }
});

test("R5 office-readers and odf-reader answer the same text for a package copy as for its original, with none of R6's metadata in the copy", async () => {
  /* `counts.scanned_bytes` (office-readers R40) is the XML the reader walked: a copy without R6's metadata walks less, so it is not text and is left out of the comparison (K4872). */
  /** @param {PackageText} t */
  const strip = (t) => JSON.parse(JSON.stringify({ ...t, metadata: undefined, counts: t.counts && { ...t.counts, scanned_bytes: undefined }, images: t.images?.map(/** @param {{ mime: unknown, name: unknown }} image */ ({ mime, name }) => ({ mime, name })) }));
  for (const { k, original, copy, with: entry } of await copies(PACKAGES)) {
    const a = await entry.text(original), b = await entry.text(copy);
    assert.equal(b.ok, true, k);
    if (!a.ok || !b.ok) throw new Error(`${k}: not read`);
    /* A comment's author run (`COMMENTERSECRET:` in an xlsx comment, which office-readers R38 now reads as a comment part)
       is R6's metadata: the copy drops it, so the original is compared without it (K4872). */
    const unauthored = JSON.parse(JSON.stringify(strip(a), /** @param {string} _ @param {unknown} v */ (_, v) => typeof v === "string" ? SECRETS.reduce((t, s) => t.split(`${s}:`).join("").split(s).join(""), v) : v));
    assert.deepEqual(strip(b), unauthored, k);
    const metadata = "metadata" in b ? b.metadata : undefined;
    if (metadata) assert.deepEqual([metadata.author, metadata.lastModifiedBy, metadata.created, metadata.modified], [null, null, null, null], k);
    const s = await entry.structure(copy);
    const items = ("evidentiary" in s ? s.evidentiary?.items : undefined) ?? [];
    for (const it of items.filter((x) => x.kind === "comment" || x.kind === "tracked-change")) {
      assert.ok(!it.author, `${k}: ${it.kind} author ${it.author}`);
      assert.ok(!it.date, `${k}: ${it.kind} date ${it.date}`);
      if (it.kind === "comment") assert.ok(!it.initials, `${k}: comment initials ${it.initials}`);
    }
    if (k === "docx" || k === "odt") assert.ok(items.some((x) => x.kind === "comment" && /Check this figure/.test(x.text)), `${k}: the comment's text kept`);
    assert.deepEqual(SECRETS.filter((x) => JSON.stringify(s).includes(x) || JSON.stringify(b).includes(x)), [], k);
  }
});
