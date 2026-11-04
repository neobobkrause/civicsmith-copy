/* format-registry: requirement-named tests for the beta's roster and the kinds that are not on it (build/requirements/format-registry.md
 * R33-R43; T53, N1266, DEC-467, DEC-473), at the module's interface, on generated samples. A type that another module registers (the
 * structured-text and mail readers) or a figure another module holds (runtime-limits' per-kind rows) and that has not arrived is a
 * `test.todo` naming the requirement, never a pin of today's behaviour. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormat, unregisterFormat, getFormat, listFormats, detectFormat, formatNameFor, kindTable } from "../../../src/formats.mjs";
import { READ_BOUNDS, boundOf } from "../../../src/read-bounds.mjs";
import { STRUCTURED_TEXT_ENTRIES } from "../../../src/structured-text-reader/index.mjs";
import { MAIL_ENTRIES } from "../../../src/mail-reader/index.mjs";
import { WORD_ROWS, hasWord } from "../../../src/setup-words/index.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";

const enc = (s) => new TextEncoder().encode(s);
const cat = (...xs) => Uint8Array.from(xs.flatMap((x) => [...(typeof x === "string" ? enc(x) : x)]));
const noise = (n, seed) => { const out = new Uint8Array(n); let x = seed >>> 0 || 1; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out[i] = x >>> 24; } return out; };
const pad = (b, n) => { const o = new Uint8Array(Math.max(n, b.length)); o.set(b); return o; };
const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

/* A compound file whose directory holds the named streams (one directory sector, 512-byte sectors). */
function cfb(names) {
  const sector = (i) => 512 * (i + 1);
  const out = new Uint8Array(512 * 4);
  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  out[30] = 9;
  out.set(u32(1), 44); // one FAT sector
  out.set(u32(1), 48); // directory starts at sector 1
  out.fill(0xff, 76, 512);
  out.set(u32(0), 76); // FAT is sector 0
  const fat = new DataView(out.buffer, sector(0), 512);
  fat.setUint32(0, 0xfffffffd, true); // the FAT sector
  fat.setUint32(4, 0xfffffffe, true); // the directory: one sector
  for (let i = 2; i < 128; i++) fat.setUint32(4 * i, 0xffffffff, true);
  names.forEach((n, i) => {
    const e = sector(1) + 128 * i, u = new TextEncoder().encode(n);
    for (let c = 0; c < n.length; c++) { out[e + 2 * c] = n.charCodeAt(c) & 255; out[e + 2 * c + 1] = n.charCodeAt(c) >>> 8; }
    out[e + 64] = (n.length + 1) * 2; out[e + 66] = i === 0 ? 5 : 2;
    void u;
  });
  return out;
}

const PDF = enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const PDF_ENCRYPTED = enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R /Encrypt 9 0 R >>\n%%EOF\n");
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
const withPart = (zipEntries) => makeZip(zipEntries);
const opc = (main, part, extra = []) => makeZip([
  { name: "[Content_Types].xml", data: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${part}" ContentType="${main}"/></Types>`, method: 0 },
  { name: "_rels/.rels", data: "<Relationships/>" }, { name: part, data: "<x/>" }, ...extra,
]);
const tarBlock = pad(cat("a.txt", new Uint8Array(252), "ustar\0", "00"), 1024);

/* one generated sample for each type this module detects itself */
const SAMPLES = {
  jpeg: Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 16),
  png: cat([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], new Uint8Array(8)),
  gif: enc("GIF89a\x01\0\x01\0"),
  tiff: Uint8Array.of(0x49, 0x49, 0x2a, 0, 8, 0, 0, 0),
  webp: cat("RIFF", u32(20), "WEBPVP8 ", new Uint8Array(8)),
  bmp: pad(cat("BM", u32(60), [0, 0, 0, 0], u32(54), u32(40)), 60),
  jp2: Uint8Array.of(0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a, 0, 0, 0, 20),
  heic: cat(u32(0).reverse(), "ftypheic", new Uint8Array(8)),
  heif: cat(u32(0).reverse(), "ftypmif1", new Uint8Array(8)),
  avif: cat(u32(0).reverse(), "ftypavif", new Uint8Array(8)),
  html: enc("<!doctype html><html><body>x</body></html>"),
  pdf: PDF,
  rtf: enc("{\\rtf1\\ansi hello}"),
  docx: opc(DOCX_TYPE, "word/document.xml"),
  xlsx: opc(XLSX_TYPE, "xl/workbook.xml"),
  pptx: opc(PPTX_TYPE, "ppt/presentation.xml"),
  odt: odfZip("application/vnd.oasis.opendocument.text"),
  ods: odfZip("application/vnd.oasis.opendocument.spreadsheet"),
  odp: odfZip("application/vnd.oasis.opendocument.presentation"),
  doc: cfb(["Root Entry", "WordDocument"]),
  xls: cfb(["Root Entry", "Workbook"]),
  ppt: cfb(["Root Entry", "PowerPoint Document"]),
  tar: tarBlock,
  gz: Uint8Array.of(0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, 0, 3),
  "7z": Uint8Array.of(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4),
  zip: makeZip([{ name: "a.txt", data: "a" }]),
  text: enc("Minutes of the regular meeting.\nItem 1: call to order.\n"),
};

test("R33: each type the registry detects from content is answered with that format and certain", () => {
  for (const [type, bytes] of Object.entries(SAMPLES)) {
    const r = detectFormat(bytes, null);
    assert.equal(r.format, type, type);
    assert.equal(r.confidence, type === "zip" || ["docx", "xlsx", "pptx"].includes(type) ? "likely" : "certain", type);
    assert.ok(r.signals.length > 0 && r.signals.every((s) => typeof s === "string"), type);
    assert.ok(listFormats().includes(type), type);
  }
});
test("R33: the roster holds every type of the list that is built in this module, in the order that keeps R23", () => {
  const order = listFormats();
  for (const p of ["jpeg", "png", "gif", "tiff", "webp", "bmp", "jp2", "heic", "heif", "avif"]) assert.ok(order.indexOf(p) < order.indexOf("html"), p);
  assert.ok(order.indexOf("html") < order.indexOf("pdf"));
  for (const o of ["docx", "xlsx", "pptx", "odt", "ods", "odp"]) assert.ok(order.indexOf(o) < order.indexOf("zip"), o);
  // a picture whose later bytes carry another format's marker is the picture
  assert.equal(detectFormat(cat(SAMPLES.gif, "%PDF-1.4 <html"), null).format, "gif");
  assert.equal(detectFormat(cat(SAMPLES.tiff, "%PDF-1.4"), null).format, "tiff");
  assert.equal(detectFormat(cat(SAMPLES.webp, "<html>"), null).format, "webp");
  // the controls: a near-miss is not the type
  assert.notEqual(detectFormat(enc("GIF90a......"), null).format, "gif");
  assert.notEqual(detectFormat(cat("BM", noise(60, 3)), null).format, "bmp");
  assert.notEqual(detectFormat(cat(u32(0).reverse(), "ftypisom", new Uint8Array(8)), null).format, "heic");
  // a declared type alone is likely, never certain (R10, R11)
  for (const [ct, f] of [["image/gif", "gif"], ["image/tiff", "tiff"], ["image/webp", "webp"], ["image/avif", "avif"], ["application/gzip", "gz"], ["application/rtf", "rtf"]]) {
    const r = detectFormat(null, ct);
    assert.equal(r.format, f);
    assert.equal(r.confidence, "likely");
  }
});
test("R33: structured-text-reader's and mail-reader's entries are registered unmodified", () => {
  for (const e of [...STRUCTURED_TEXT_ENTRIES, ...MAIL_ENTRIES]) assert.equal(getFormat(e.format), e, e.format);
  const ours = ["json", "ndjson", "xml", "svg", "kml", "kmz", "geojson", "ics", "vcf", "srt", "vtt", "eml", "msg", "mbox"];
  assert.deepEqual(listFormats().filter((f) => ours.includes(f)), ours);
  assert.ok(listFormats().indexOf("kmz") < listFormats().indexOf("zip"), "kmz is asked before the plain ZIP");
  assert.ok(listFormats().indexOf("xml") < listFormats().indexOf("text"));
  const cases = { json: '{"a": [1, 2, 3]}\n', xml: '<?xml version="1.0"?><root><a/></root>', svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    ics: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n", vcf: "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:A B\r\nEND:VCARD\r\n",
    eml: "From: a@example.org\r\nTo: b@example.org\r\nSubject: hi\r\n\r\nbody\r\n" };
  for (const [f, body] of Object.entries(cases)) assert.equal(detectFormat(enc(body), null).format, f, f);
});
/* R33's tsv and xlsm (kinds answered as csv and xlsx), the whole roster as one list and mhtml: roster-t53.test.mjs */

test("R34: a file is judged from its bytes; a name that disagrees is named in a signal, and the answer is the content's", () => {
  const cases = [["report.docx", PDF, "pdf"], ["report.pdf", SAMPLES.zip, "zip"], ["table.xls", enc("a,b,c\n1,2,3\n4,5,6\n7,8,9\n10,11,12\n13,14,15\n"), "csv"],
    ["photo.txt", SAMPLES.png, "png"], ["x.jpg", SAMPLES.png, "png"]];
  for (const [name, bytes, format] of cases) {
    const r = detectFormat(bytes, null, name);
    assert.equal(r.format, format, name);
    assert.ok(r.signals.length > detectFormat(bytes, null).signals.length - (format === "csv" ? 1 : 0), `${name}: a signal names the disagreement`);
    assert.ok(r.signals.at(-1).includes(name), name);
  }
  // controls: a name that agrees, or a generic one, adds nothing
  assert.deepEqual(detectFormat(PDF, null, "a.pdf"), detectFormat(PDF, null));
  assert.deepEqual(detectFormat(SAMPLES.text, null, "a.log"), detectFormat(SAMPLES.text, null));
  assert.deepEqual(detectFormat(SAMPLES.jpeg, null, "a.jpg"), detectFormat(SAMPLES.jpeg, null));
});

test("R35: valid text no entry claims is text; a binary file is never text", () => {
  for (const [name, body] of [["run.log", "2026-10-01 12:00 started\n2026-10-01 12:01 stopped\n"], ["README.md", "# Title\n\nSome *words*.\n"], ["notes", "plain\n"]]) {
    const r = detectFormat(enc(body), null, name);
    assert.equal(r.format, "text", name);
    assert.equal(r.confidence, "certain");
  }
  assert.equal(detectFormat(Uint8Array.of(0xff, 0xfe, ...[..."notes of the meeting\n"].flatMap((c) => [c.charCodeAt(0), 0])), null).format, "text", "UTF-16 by its BOM");
  assert.equal(detectFormat(SAMPLES.png, null, "photo.txt").format, "png");
  const random = detectFormat(noise(1 << 20, 7), null);
  assert.equal(random.format, "unlisted");
  assert.equal(random.named, null);
  assert.notEqual(random.format, "text");
  assert.equal(detectFormat(noise(2000, 9), "text/plain", "x.txt").format, "unlisted", "a binary file is not text whatever it is called or declared");
});
test("R35: ndjson, srt, vtt and mbox are answered by their leading structure", () => {
  const cases = { ndjson: '{"a":1}\n{"a":2}\n{"a":3}\n', srt: "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n",
    vtt: "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n", mbox: "From a@example.org Mon Oct  5 10:00:00 2026\nFrom: a@example.org\nSubject: x\n\nbody\n" };
  for (const [f, body] of Object.entries(cases)) assert.equal(detectFormat(enc(body), null).format, f, f);
});

test("R36: a package that holds a VBA project is its base format with variant macro and macros true, read as that format", () => {
  const cases = [["docx", DOCX_TYPE, "word/document.xml", "word/vbaProject.bin"], ["xlsx", XLSX_TYPE, "xl/workbook.xml", "xl/vbaProject.bin"], ["pptx", PPTX_TYPE, "ppt/presentation.xml", "ppt/vbaProject.bin"]];
  for (const [format, main, part, vba] of cases) {
    const r = detectFormat(opc(main, part, [{ name: vba, data: "not run" }]), null, `file.${format}m`);
    assert.equal(r.format, format);
    assert.equal(r.variant, "macro");
    assert.equal(r.macros, true);
    const plain = detectFormat(opc(main, part), null);
    assert.equal(plain.macros, undefined, "no VBA project, no macros key");
    assert.equal(plain.variant, undefined);
    assert.equal(getFormat(format).detect(opc(main, part, [{ name: vba, data: "x" }]), null).format, format, "the entry reads it as its base format");
  }
  // templates are their base format with variant template
  const t = detectFormat(opc("application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml", "word/document.xml"), null);
  assert.deepEqual([t.format, t.variant, t.flavour], ["docx", "template", "dotx"]);
  const p = detectFormat(opc("application/vnd.openxmlformats-officedocument.presentationml.template.main+xml", "ppt/presentation.xml"), null);
  assert.deepEqual([p.format, p.variant, p.flavour], ["pptx", "template", "potx"]);
});

test("R37: an encrypted ZIP, an encrypted Office container and an encrypted PDF are answered with their type and encrypted true", () => {
  const zip = detectFormat(makeZip([{ name: "a.txt", data: "secret", method: 0, encrypted: "traditional" }]), null);
  assert.deepEqual([zip.format, zip.encrypted], ["zip", true]);
  const office = detectFormat(cfb(["Root Entry", "EncryptionInfo", "EncryptedPackage"]), null, "budget.xlsx");
  assert.deepEqual([office.format, office.encrypted], ["xlsx", true]);
  const unknown = detectFormat(cfb(["Root Entry", "EncryptionInfo", "EncryptedPackage"]), null);
  assert.deepEqual([unknown.format, unknown.encrypted], ["unlisted", true], "never undetermined");
  const pdf = detectFormat(PDF_ENCRYPTED, null);
  assert.deepEqual([pdf.format, pdf.encrypted], ["pdf", true]);
  // controls
  assert.equal(detectFormat(PDF, null).encrypted, undefined);
  assert.equal(detectFormat(SAMPLES.zip, null).encrypted, undefined);
});
test("R37: a big PDF from a range source states its encryption from the tail", async () => {
  const body = cat(PDF.subarray(0, PDF.length - 20), new Uint8Array(2 << 20), "trailer << /Encrypt 5 0 R >>\n%%EOF\n");
  const src = { size: body.length, readRange: async (o, n) => body.subarray(o, o + n) };
  const r = await detectFormat(src, null);
  assert.deepEqual([r.format, r.encrypted], ["pdf", true]);
});

const NAMED = {
  pst: cat("!BDN", new Uint8Array(20)), mdb: cat([0, 1, 0, 0], "Standard Jet DB", new Uint8Array(8)), accdb: cat([0, 1, 0, 0], "Standard ACE DB", new Uint8Array(8)),
  sqlite: cat("SQLite format 3\0", new Uint8Array(100)), parquet: cat("PAR1", new Uint8Array(20), "PAR1"),
  xlsb: opc("application/vnd.ms-excel.sheet.binary.macroEnabled.main+xml", "xl/workbook.bin"), wpd: cat([0xff], "WPC", new Uint8Array(12)),
  pages: makeZip([{ name: "Index/Document.iwa", data: "x" }]), numbers: makeZip([{ name: "Index/Tables/Tile.iwa", data: "x" }]),
  vsd: cfb(["Root Entry", "VisioDocument"]), vsdx: makeZip([{ name: "visio/document.xml", data: "<x/>" }]), pub: cfb(["Root Entry", "Quill"]),
  one: cat([0xe4, 0x52, 0x5c, 0x7b, 0x8c, 0xd8, 0xa7, 0x4d, 0xae, 0xb1, 0x53, 0x78, 0xd0, 0x29, 0x96, 0xd3], new Uint8Array(16)),
  mpp: cfb(["Root Entry", "Props12"]), dwg: cat("AC1032", new Uint8Array(30)), dxf: enc("  0\nSECTION\n  2\nHEADER\n"),
  shapefile: cat([0, 0, 0x27, 0x0a], new Uint8Array(96)), gpkg: pad(cat("SQLite format 3\0"), 100).map((x, i) => (i >= 68 && i < 72 ? "GPKG".charCodeAt(i - 68) : x)),
  epub: makeZip([{ name: "mimetype", data: "application/epub+zip", method: 0 }, { name: "META-INF/container.xml", data: "<x/>" }]),
  audio: cat("ID3", [3, 0, 0, 0, 0, 0, 0]), video: cat([0, 0, 0, 24], "ftypmp42", new Uint8Array(12)),
};
test("R38: a type not on the list, and known, is unlisted with its name; one that is none is unlisted with no name and the reasons", () => {
  for (const [named, bytes] of Object.entries(NAMED)) {
    const r = detectFormat(bytes, null);
    assert.equal(r.format, "unlisted", named);
    assert.equal(r.named, named, named);
    assert.ok(Array.isArray(r.signals) && r.signals.length > 0, named);
  }
  for (const [named, bytes] of [["ost", cat("!BDN", new Uint8Array(20))], ["key", makeZip([{ name: "Index/Slide.iwa", data: "x" }, { name: "Index/Document.iwa", data: "x" }])]]) {
    const r = detectFormat(bytes, null);
    assert.equal(r.format, "unlisted");
    assert.ok(named === "ost" ? r.named === "pst" : r.named === "pages" || r.named === "key", "the signature names the kind's family");
  }
  const none = detectFormat(noise(4096, 11), null);
  assert.deepEqual([none.format, none.named, none.signals.length], ["unlisted", null, 2]);
  // the name never decides a binary format (R34): a SQLite file named .docx is SQLite
  assert.equal(detectFormat(NAMED.sqlite, null, "x.docx").named, "sqlite");
});

test("R39: a RAR, a Windows program, an installer, a library, a script and a disk image are refused with a plain reason", () => {
  const pe = (dll) => { const b = new Uint8Array(256); b.set([0x4d, 0x5a]); b.set(u32(128), 60); b.set(enc("PE\0\0"), 128); b[128 + 22] = dll ? 0x00 : 0; b[128 + 23] = dll ? 0x20 : 0; return b; };
  const iso = new Uint8Array(0x8001 + 16); iso.set(enc("CD001"), 0x8001);
  const cases = [["rar", cat("Rar!\x1a\x07\x00", new Uint8Array(16)), "rar"], ["exe", pe(false), "runs"], ["dll", pe(true), "runs"], ["iso", iso, "diskimage"],
    ["app", cat([0x7f], "ELF", new Uint8Array(16)), "runs"], ["sh", enc("#!/bin/sh\necho hi\n"), "runs"], ["bat", enc("@echo off\r\necho hi\r\n"), "runs"],
    ["jar", makeZip([{ name: "META-INF/MANIFEST.MF", data: "Manifest-Version: 1.0" }, { name: "A.class", data: "x" }]), "runs"],
    ["apk", makeZip([{ name: "AndroidManifest.xml", data: "x" }, { name: "classes.dex", data: "x" }]), "runs"],
    ["vhd", cat("conectix", new Uint8Array(32)), "diskimage"], ["pkg", cat("xar!", new Uint8Array(32)), "runs"]];
  for (const [kind, bytes, reason] of cases) {
    const r = detectFormat(bytes, null);
    assert.equal(r.format, "refused", kind);
    assert.equal(r.kind, kind, kind);
    assert.equal(formatNameFor(r).reason_key, `file.refused.reason.${reason}`, kind);
    assert.ok(hasWord(formatNameFor(r).reason_key), kind);
    assert.equal(typeof r.reason, "string");
  }
  // a script has no signature: valid text named for one is refused, and says so; plain text is not
  const ps = detectFormat(enc("Write-Host hi\n"), null, "run.ps1");
  assert.deepEqual([ps.format, ps.kind], ["refused", "ps1"]);
  assert.equal(detectFormat(enc("Write-Host hi\n"), null, "run.txt").format, "text");
});

test("R41: a new type is one registerFormat entry; nothing else changes", () => {
  const entry = { format: "fake-kind", detect: (b) => (b && b[0] === 0x7e && b[1] === 0x7e ? { format: "fake-kind", confidence: "certain", signals: ["~~"] } : null) };
  const before = listFormats();
  registerFormat(entry);
  try {
    assert.equal(detectFormat(Uint8Array.of(0x7e, 0x7e, 1, 2), null).format, "fake-kind");
    assert.equal(formatNameFor({ format: "fake-kind" }).name, "other", "a type with no words row reads as `other`");
  } finally { unregisterFormat("fake-kind"); }
  assert.deepEqual(listFormats(), before);
});

/* the 48 keys of the words files */
const KIND_KEYS = WORD_ROWS.map((r) => r[0]).filter((k) => typeof k === "string" && k.startsWith("file.kind."));
const ALL_TYPES = [...Object.keys(SAMPLES).filter((t) => t !== "text"), "text", "csv", "tsv", "xlsm", "docm", "dotx", "pptm", "potx", "xltx", "mhtml", "json", "ndjson", "xml", "svg", "kml", "kmz",
  "geojson", "ics", "vcf", "srt", "vtt", "eml", "msg", "mbox", ...Object.keys(NAMED), "ost", "key", "gpkg"];

test("R40, R43: every type, every named unlisted type and every refusal maps to a kind key the words files hold", () => {
  for (const t of ALL_TYPES) {
    const k = formatNameFor(t in NAMED ? { format: "unlisted", named: t } : { format: t });
    assert.ok(hasWord(k.kind_key), `${t} -> ${k.kind_key}`);
    assert.equal(k.text, k.text && typeof k.text === "string" ? k.text : null);
  }
  for (const kind of ["rar", "exe", "msi", "dll", "app", "apk", "dmg", "pkg", "bat", "cmd", "ps1", "sh", "vbs", "scr", "jar", "iso", "img", "vhd"]) {
    const k = formatNameFor({ format: "refused", kind });
    assert.ok(hasWord(k.kind_key), kind);
    assert.ok(hasWord(k.reason_key), kind);
  }
  assert.equal(formatNameFor({ format: "unlisted", named: null }).kind_key, "file.kind.other");
  assert.equal(formatNameFor({ format: "undetermined" }).kind_key, "file.kind.other");
  assert.equal(formatNameFor(null).kind_key, "file.kind.other");
});
test("R43: many keys to one name — the map of DEC-473, and the 48 kind keys are each the image of at least one", () => {
  const table = kindTable();
  const images = new Set(["other", ...table.map((r) => r.kind_key.replace("file.kind.", ""))]);
  assert.equal(KIND_KEYS.length, 48);
  for (const k of KIND_KEYS) assert.ok(images.has(k.replace("file.kind.", "")), k);
  const same = (names, name) => names.forEach((n) => assert.equal(formatNameFor({ format: n }).name, name, n));
  same(["docx", "doc", "docm", "dotx"], "docx"); same(["pptx", "ppt", "pptm", "potx"], "pptx"); same(["xlsx", "xlsm", "xltx"], "xlsx");
  same(["jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif", "jp2"], "picture"); same(["zip", "tar", "gz", "7z"], "archive"); same(["kml", "kmz", "geojson"], "map");
});
test("R43: a type that keeps its own key is its own name", () => {
  for (const n of ["pdf", "xls", "odt", "odp", "ods", "rtf", "csv", "tsv", "text", "xml", "svg", "ics", "vcf", "tiff", "mbox"]) assert.equal(formatNameFor({ format: n }).name, n);
});

test("R42: the table has a row for each roster key, each named unlisted type and each refused type; a key outside it has none", () => {
  const table = kindTable();
  const keys = table.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, "one row for each key");
  for (const f of listFormats().filter((f) => !["fake-kind"].includes(f))) assert.ok(keys.includes(f), `roster key ${f}`);
  for (const n of [...Object.keys(NAMED), "ost"]) assert.ok(keys.includes(n), `named ${n}`);
  for (const k of ["rar", "exe", "msi", "dll", "app", "apk", "dmg", "pkg", "bat", "cmd", "ps1", "sh", "vbs", "scr", "jar", "iso", "img", "vhd"]) assert.equal(table.find((r) => r.key === k)?.state, "not_kept", k);
  for (const k of ["pst", "mdb", "sqlite", "audio", "video", "epub", "other"]) assert.equal(table.find((r) => r.key === k)?.state, "kept_not_read", k);
  for (const k of ["pdf", "docm", "xlsm", "tiff", "mbox", "zip"]) assert.equal(table.find((r) => r.key === k)?.state, "read", k);
  for (const row of table) {
    assert.ok(["read", "kept_not_read", "not_kept"].includes(row.state));
    assert.ok(hasWord(row.kind_key), row.key);
    assert.ok(Array.isArray(row.limit.figures));
  }
  assert.equal(table.find((r) => r.key === "txt"), undefined);
  assert.ok(Object.isFrozen(table[0]));
});
test("R42: each limit is the runtime-limits figure for its kind, read through boundOf, never a literal here", () => {
  const MiB = 1048576;
  const bound = (key, what) => kindTable().find((r) => r.key === key).limit.figures.find((f) => f.what === what);
  for (const row of kindTable()) {
    for (const f of row.limit.figures) {
      assert.notEqual(f.bound, null, `${row.key}.${f.what}: runtime-limits holds row ${f.row.join(".")}`);
      assert.equal(f.bound, boundOf(...f.row), `${row.key}.${f.what}`);
      assert.equal(f.key, READ_BOUNDS[f.row[0]][f.row[1]].key);
    }
  }
  assert.deepEqual([bound("pdf", "bytes").bound, bound("pdf", "pages").bound], [100 * MiB, 5000]);
  assert.deepEqual([bound("xlsx", "bytes").bound, bound("xlsx", "rows").bound], [50 * MiB, 1048576]);
  assert.equal(bound("xls", "rows_per_sheet").bound, 65536);
  assert.equal(bound("jpeg", "bytes").bound, 50 * MiB);
  assert.equal(bound("json", "nesting").bound, 1000);
  assert.equal(bound("ics", "events").bound, 100000);
  assert.equal(bound("mbox", "messages").bound, 100000);
  assert.equal(bound("audio", "bytes").bound, bound("pdf", "bytes").bound, "audio and video take the document class's bound (K5571 (3))");
  assert.equal(kindTable().find((r) => r.key === "rar").limit.figures.length, 0);
});
