/* format-registry: the beta's roster as one list, the kinds answered as another's key (`tsv`, `xlsm`), the saved web page, the
 * `text` entry asked last, and the kind table's limits (build/requirements/format-registry.md R23, R33, R35, R42; T53, N1266,
 * DEC-467), at the module's interface, on generated samples. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listFormats, getFormat, detectFormat, kindTable } from "../../../src/formats.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { makeZip } from "./zipfix.mjs";

const enc = (s) => new TextEncoder().encode(s);

/* R33's list, word for word, without the two kinds that are not registry keys (`tsv`, `xlsm`) */
const ROSTER = ["pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt", "odt", "ods", "odp", "rtf", "text", "html", "mhtml", "json", "ndjson",
  "xml", "svg", "kml", "kmz", "geojson", "ics", "vcf", "srt", "vtt", "jpeg", "png", "tiff", "heic", "heif", "avif", "gif", "webp", "bmp", "jp2",
  "eml", "msg", "mbox", "zip", "tar", "gz", "7z"];

test("R33: the roster's listFormats() equals the list without tsv and xlsm, one key each", () => {
  const keys = listFormats();
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual([...keys].sort(), [...ROSTER].sort());
  assert.ok(!keys.includes("tsv") && !keys.includes("xlsm"), "tsv and xlsm are kinds, not registry keys");
});

test("R23: the roster's order keeps fix round 9's rule: pictures, then the web pages and the PDF; zip after the office and ODF entries; text last", () => {
  const order = listFormats();
  const at = (k) => order.indexOf(k);
  for (const p of ["jpeg", "png", "gif", "tiff", "webp", "bmp", "jp2", "heic", "heif", "avif"]) {
    assert.ok(at(p) < at("html") && at(p) < at("mhtml") && at(p) < at("pdf"), p);
  }
  for (const o of ["docx", "xlsx", "pptx", "odt", "ods", "odp", "kmz"]) assert.ok(at(o) < at("zip"), o);
  assert.ok(at("mhtml") < at("eml"), "a saved web page is asked before a mailed message");
  assert.equal(order.at(-1), "text");
  // a JPEG carrying a PDF header and an HTML root in its later bytes is still the picture
  assert.equal(detectFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...enc("%PDF-1.4 <html>")]), null).format, "jpeg");
});

/* a page saved whole by a browser, and the same shape from an older one (no snapshot header; the HTML part names its place) */
const MHTML_BLINK = "From: <Saved by Blink>\r\nSnapshot-Content-Location: https://example.org/agenda\r\nSubject: Agenda\r\nMIME-Version: 1.0\r\n"
  + "Content-Type: multipart/related;\r\n\ttype=\"text/html\";\r\n\tboundary=\"----MultipartBoundary--abc\"\r\n\r\n"
  + "------MultipartBoundary--abc\r\nContent-Type: text/html\r\nContent-Location: https://example.org/agenda\r\n\r\n<html><body>Agenda</body></html>\r\n"
  + "------MultipartBoundary--abc--\r\n";
const MHTML_OLDER = "MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary=\"b1\"\r\n\r\nThis is a multi-part message in MIME format.\r\n\r\n"
  + "--b1\r\nContent-Type: text/html; charset=\"utf-8\"\r\nContent-Location: file:///C:/agenda.htm\r\n\r\n<html></html>\r\n--b1--\r\n";
/* a mailed HTML message with an inline picture: multipart/related too, but a message */
const HTML_MAIL = "Received: from mx.example.org\r\nFrom: a@example.org\r\nTo: b@example.org\r\nMessage-ID: <1@example.org>\r\nSubject: hi\r\nMIME-Version: 1.0\r\n"
  + "Content-Type: multipart/related; type=\"text/html\"; boundary=\"m\"\r\n\r\n--m\r\nContent-Type: text/html\r\nContent-Location: cid:x\r\n\r\n<html></html>\r\n--m--\r\n";

test("R33: a saved web page (MHTML) is mhtml, certain, from its content; a mailed HTML message stays eml", () => {
  for (const body of [MHTML_BLINK, MHTML_OLDER]) {
    const r = detectFormat(enc(body), null);
    assert.equal(r.format, "mhtml");
    assert.equal(r.confidence, "certain");
    assert.ok(r.signals.length > 0 && r.signals.every((s) => typeof s === "string"));
  }
  assert.equal(detectFormat(enc(HTML_MAIL), null).format, "eml");
  // a multipart/related archive with no HTML root is not a saved page
  assert.notEqual(detectFormat(enc(MHTML_OLDER.replace("text/html", "image/png")), null).format, "mhtml");
  // a declared type alone is likely (R11), and bytes outrank it (R26)
  assert.deepEqual([detectFormat(null, "multipart/related").format, detectFormat(null, "multipart/related").confidence], ["mhtml", "likely"]);
  assert.equal(detectFormat(enc("%PDF-1.7\n%%EOF\n"), "multipart/related").format, "pdf");
  assert.equal(getFormat("mhtml").structure, null);
});

const TAB_TABLE = "ward\tseats\tturnout\n" + Array.from({ length: 8 }, (_, i) => `W${i}\t${i + 3}\t${40 + i}\n`).join("");

test("R33: a tab-delimited table is answered csv with its dialect, declared as a TSV or as a general type with its name (R31)", () => {
  for (const [name, ct] of [["wards.tsv", "text/tab-separated-values"], [null, "text/tab-separated-values"], ["wards.tsv", "text/plain"],
    ["wards.tab", "application/octet-stream"], ["wards.tsv", "application/vnd.ms-excel"]]) {
    const r = detectFormat(enc(TAB_TABLE), ct, name);
    assert.equal(r.format, "csv", `${name} ${ct}`);
  }
  assert.equal(getFormat("csv").dialect(enc(TAB_TABLE)).delimiter, "tab");
  // controls: a note named .tsv is no table, and a binary file named .tsv is never a sheet
  assert.equal(detectFormat(enc("Just a note about the wards.\nNothing tabular here.\n"), "text/plain", "note.tsv").format, "text");
  assert.equal(detectFormat(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), "text/tab-separated-values", "x.tsv").format, "png");
});

test("R33: a macro-enabled workbook is answered xlsx with variant macro", () => {
  const xlsm = makeZip([
    { name: "[Content_Types].xml", data: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>', method: 0 },
    { name: "_rels/.rels", data: "<Relationships/>" }, { name: "xl/workbook.xml", data: "<x/>" }, { name: "xl/vbaProject.bin", data: "never run" },
  ]);
  const r = detectFormat(xlsm, null, "budget.xlsm");
  assert.deepEqual([r.format, r.variant, r.macros], ["xlsx", "macro", true]);
});

test("R35: the text entry is asked last, after the content-type pass and the name pass", () => {
  const csvBody = enc("a,b,c\n1,2,3\n4,5,6\n7,8,9\n10,11,12\n13,14,15\n");
  assert.equal(detectFormat(csvBody, "text/csv").format, "csv", "the content-type pass before text");
  assert.equal(detectFormat(csvBody, "text/plain", "table.csv").format, "csv", "the name pass before text");
  assert.equal(detectFormat(enc("hello there\n"), "text/html").format, "html", "a declared web page with no root is read as declared");
  assert.equal(detectFormat(csvBody, null).format, "text", "no type and no name: valid text");
  assert.equal(detectFormat(Uint8Array.of(0, 1, 2, 3, 0, 255, 254, 0), "text/plain", "x.txt").format, "unlisted", "a binary file is never text");
});

test("R42: JSON, XML, HTML, SVG and map data state 100 MB with nesting 1,000; plain text states its size only", () => {
  const MiB = 1048576;
  const row = (k) => kindTable().find((r) => r.key === k);
  for (const k of ["json", "ndjson", "xml", "svg", "html", "mhtml", "kml", "kmz", "geojson"]) {
    const figures = Object.fromEntries(row(k).limit.figures.map((f) => [f.what, f.bound]));
    assert.deepEqual(figures, { bytes: boundOf("text", "bytes"), nesting: boundOf("text", "nesting") }, k);
    assert.deepEqual([figures.bytes, figures.nesting], [100 * MiB, 1000], k);
    assert.equal(row(k).state, "read");
  }
  for (const k of ["text", "vcf", "srt", "vtt"]) assert.deepEqual(row(k).limit.figures.map((f) => f.what), ["bytes"], k);
  assert.equal(row("mhtml").kind_key, "file.kind.html");
});
