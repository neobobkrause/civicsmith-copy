/* format-registry, fix round 9 (T51; G130a to G130c, G141): requirement-named tests for the name pass (R9, R31), the
 * three-answer rule with it (R13), the detection from a range source (R32), its freedom from clock and network (R25) and
 * the pictures-first roster (R23), at the module's interface, each with its negative controls (K874). Fixed seeds only.
 * SCAN A12, SHEET C23 C24 C32 C33, DOCS O9 (scaled: the head is 1 MiB, so a file of a few MiB shows the cause that
 * 8 MiB did), DOCS T13. This file never changes the registry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerFormat, unregisterFormat, getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";
/** @import { FormatEntry, FormatDetection } from "../../../src/formats.mjs" */

/** @param {FormatDetection | Promise<FormatDetection>} d @returns {FormatDetection} */
const now = (d) => { if (d instanceof Promise) throw new Error("detectFormat answered later"); return d; };
/** @param {string} format @returns {FormatEntry} */
const entry = (format) => { const e = getFormat(format); if (!e) throw new Error(`no entry registered for ${format}`); return e; };
/** @param {FormatEntry | null} e @param {string} format @returns {FormatEntry} */
const must = (e, format) => { if (!e) throw new Error(`unregisterFormat(${format}) gave no entry`); return e; };

const enc = (/** @type {string} */ s) => new TextEncoder().encode(s);
const cat = (/** @type {(string | number[] | Uint8Array)[]} */ ...xs) => Uint8Array.from(xs.flatMap((/** @type {string | number[] | Uint8Array} */ x) => [...(typeof x === "string" ? enc(x) : x)]));
const MIB = 1 << 20;

/** Bytes of a fixed pseudo-random fill (a linear congruential sequence), `n` long: incompressible enough to stay big when stored.
 * @param {number} n @param {number} seed @returns {Uint8Array} */
function noise(n, seed) {
  const b = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; b[i] = x >>> 24; }
  return b;
}

/** A range source over `bytes` that counts what it hands out. @param {Uint8Array} bytes */
function source(bytes) {
  /** @type {{ calls: number, bytes: number, spans: [number, number][] }} */
  const log = { calls: 0, bytes: 0, spans: [] };
  return {
    size: bytes.length, log,
    readRange: async (/** @type {number} */ offset, /** @type {number} */ length) => {
      log.calls++;
      const out = bytes.slice(offset, offset + length);
      log.bytes += out.length;
      log.spans.push([offset, out.length]);
      return out;
    },
  };
}

const CSV = enc("name,qty,price\nbolts,10,0.5\nnuts,20,0.25\nwashers,30,0.1\n");
const TSV = enc("name\tqty\tprice\nbolts\t10\t0.5\nnuts\t20\t0.25\nwashers\t30\t0.1\n");
// csv-reader's R27: declared plain text (text/plain, or a .txt name) is a table only with at least 5 records
const CSV5 = enc("name,qty,price\nbolts,10,0.5\nnuts,20,0.25\nwashers,30,0.1\nscrews,40,0.2\nrivets,50,0.15\n");
const TSV5 = enc("name\tqty\tprice\nbolts\t10\t0.5\nnuts\t20\t0.25\nwashers\t30\t0.1\nscrews\t40\t0.2\nrivets\t50\t0.15\n");
const NOTE = enc("A note to the clerk: please confirm the agenda is posted by Friday. Thanks.\n");

const JPEG_SIG = [0xff, 0xd8, 0xff];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** @param {FormatDetection} r @param {string} format @param {string} confidence */
const isHit = (r, format, confidence) => {
  assert.equal(r.format, format);
  assert.equal(r.confidence, confidence);
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0 && r.signals.every((/** @type {string} */ s) => typeof s === "string"));
};

test("R23: SCAN A12 — a JPEG with %PDF-1.4 in a COM segment, <html in its EXIF, and a PNG with %PDF- in tEXt are read as pictures, pictures are asked first", () => {
  assert.deepEqual(listFormats().slice(0, 4), ["jpeg", "png", "html", "pdf"]);
  const jpegCom = cat(JPEG_SIG, [0xfe, 0x00, 0x0c], "%PDF-1.4\n", [0xff, 0xd9]);
  const jpegExif = cat(JPEG_SIG, [0xe1, 0x00, 0x30], "Exif\0\0<html><head><title>x</title></head>", [0xff, 0xd9]);
  const pngText = cat(PNG_SIG, [0, 0, 0, 20], "tEXt", "Comment\0%PDF-1.7 a polyglot", [0, 0, 0, 0]);
  /** @type {[string, Uint8Array][]} */
  const pictures = [["jpeg", jpegCom], ["jpeg", jpegExif], ["png", pngText]];
  for (const [format, b] of pictures) {
    for (const ct of [null, "application/pdf", "text/html", "image/jpeg", "application/octet-stream"]) {
      isHit(now(detectFormat(b, ct)), format, "certain");
      isHit(now(detectFormat(b, ct, "scan.pdf")), format, "certain");
    }
  }
  // negative controls: the same markers without a picture signature keep their meaning
  isHit(now(detectFormat(cat("%PDF-1.4\n", [0xfe, 0, 8], "COM"), null)), "pdf", "certain");
  isHit(now(detectFormat(enc("<html><body>x"), null)), "html", "certain");
});

test("R9: the name is the third argument, provided only as a non-empty string; bytes and content type keep their rules", () => {
  // a name that is not a non-empty string is not provided: the CSV bytes are not claimed
  for (const bad of [undefined, null, "", 0, 5, true, {}, [], ["a.csv"], new String("a.csv"), Symbol("n")]) {
    const r = now(detectFormat(CSV, "application/octet-stream", bad));
    assert.equal(r.format, "undetermined", String(bad));
    assert.equal(r.confidence, "none");
  }
  // the same bytes with a provided name are claimed
  isHit(now(detectFormat(CSV, "application/octet-stream", "budget.csv")), "csv", "likely");
  // bytes not provided (absent, null, empty, not a Uint8Array): the name has nothing to judge
  for (const b of [undefined, null, new Uint8Array(0), "a,b\n1,2\n", [97, 44, 98], 0]) {
    assert.equal(now(detectFormat(b, "application/octet-stream", "budget.csv")).format, "undetermined", String(b));
  }
  // the answer for bytes stays synchronous
  assert.ok(!(detectFormat(CSV, null, "budget.csv") instanceof Promise));
  // two arguments still work, as before
  assert.equal(now(detectFormat(CSV, "text/csv")).format, "csv");
  assert.equal(now(detectFormat(null, "text/html")).format, "html");
});

test("R31: SHEET C32 C33 C23 C24 — a delimited text declared ms-excel, octet-stream or text/plain, named .csv .tsv .tab .txt, is read as a sheet", () => {
  for (const ct of ["application/vnd.ms-excel", "application/octet-stream", "text/plain", "TEXT/PLAIN", "Application/Octet-Stream"]) {
    for (const [name, bytes] of [["budget.csv", CSV], ["BUDGET.CSV", CSV], ["rows.tsv", TSV], ["rows.tab", TSV5], ["rows.txt", CSV5], ["rows.TXT", TSV5]]) {
      const r = now(detectFormat(bytes, ct, name));
      isHit(r, "csv", "likely");
      assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
    }
  }
  // a type outside csv-reader's R21 list, or none, is not judged a sheet by name alone
  assert.equal(now(detectFormat(CSV, "application/x-unknown", "budget.csv")).format, "undetermined");
  assert.equal(now(detectFormat(CSV, null, "budget.csv")).format, "undetermined");
  // a .tsv declared text/tab-separated-values is the csv entry's own pass-2 answer, unchanged
  assert.deepEqual(detectFormat(TSV, "text/tab-separated-values", "rows.tsv"), entry("csv").detect(null, "text/tab-separated-values"));
  // negative controls: the name's extension, the shape of the head and a binary signature all matter
  assert.equal(now(detectFormat(CSV, "application/octet-stream", "budget.xls")).format, "undetermined", ".xls is not a delimited-text name");
  assert.equal(now(detectFormat(CSV, "application/octet-stream", "budget.pdf")).format, "undetermined");
  assert.equal(now(detectFormat(CSV, "application/octet-stream", "budget")).format, "undetermined");
  assert.equal(now(detectFormat(NOTE, "text/plain", "note.txt")).format, "undetermined", "a plain note has no delimiter and is read as text");
  assert.equal(now(detectFormat(enc("just words"), "application/octet-stream", "words.csv")).format, "undetermined");
  // a head of NULs, or a NUL inside a decoded 8-bit head, is not text
  assert.equal(now(detectFormat(cat("a,b\n1,2\n", [0, 0, 0, 0]), "application/octet-stream", "data.csv")).format, "undetermined");
});

test("R31: bytes never override a binary format — a ZIP, office, PDF, picture or HTML named .csv keeps its own format; a pass-2 type wins over the name", () => {
  /** @type {[string, Uint8Array][]} */
  const cases = [
    ["pdf", cat("%PDF-1.7\n", CSV)],
    ["png", cat(PNG_SIG, CSV)],
    ["jpeg", cat(JPEG_SIG, [0xe0], CSV)],
    ["zip", makeZip([{ name: "budget.csv", data: CSV }])],
    ["docx", officeZip("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml")],
    ["ods", odfZip("application/vnd.oasis.opendocument.spreadsheet")],
    ["html", cat("<!doctype html>\n", CSV)],
  ];
  for (const [format, bytes] of cases) {
    for (const ct of ["application/octet-stream", "application/vnd.ms-excel", "text/plain"]) {
      assert.equal(now(detectFormat(bytes, ct, "budget.csv")).format, format, `${format} / ${ct}`);
      assert.deepEqual(detectFormat(bytes, ct, "budget.csv"), detectFormat(bytes, ct));
    }
  }
  // an OLE compound file (a legacy .xls) has no entry: it is undetermined, never a sheet, whatever it is named
  const ole = cat([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], noise(600, 7));
  assert.equal(now(detectFormat(ole, "application/vnd.ms-excel", "legacy.csv")).format, "undetermined");
  assert.equal(now(detectFormat(ole, "application/vnd.ms-excel", "legacy.xls")).format, "undetermined");
  // pass 2 comes before pass 3: a declared type that an entry claims is that entry's answer
  assert.equal(now(detectFormat(CSV, "text/html", "budget.csv")).format, "html");
  assert.equal(now(detectFormat(CSV, "text/csv", "budget.csv")).confidence, "likely");
});

test("R31: the head is the first 1 MiB — a delimited head is a sheet whatever follows, and a delimiter beyond it is not seen", () => {
  const rows = enc("a,b,c\n1,2,3\n");
  const head = new Uint8Array(MIB);
  for (let at = 0; at < MIB;) { const n = Math.min(rows.length, MIB - at); head.set(rows.subarray(0, n), at); at += n; }
  const tail = cat(noise(MIB, 11));
  isHit(now(detectFormat(cat(head, tail), "application/octet-stream", "big.csv")), "csv", "likely");
  const sparse = cat(enc("x".repeat(MIB)), enc("a,b,c\n1,2,3\n".repeat(50)));
  assert.equal(now(detectFormat(sparse, "application/octet-stream", "big.csv")).format, "undetermined");
});

test("R13: with the name pass the only answers are an entry's verbatim result, the csv answer of R31 or the stated undetermined", () => {
  /** @type {[Uint8Array | null, string | null, string | null][]} */
  const inputs = [
    [CSV, "application/octet-stream", "a.csv"], [TSV, "text/plain", "a.tsv"], [NOTE, "text/plain", "n.txt"], [CSV, null, null],
    [cat("%PDF-1.7\n", CSV), "text/plain", "a.csv"], [null, "text/html", "a.csv"], [CSV, "text/csv", "a.csv"],
  ];
  for (const [b, c, n] of inputs) {
    const r = now(detectFormat(b, c, n));
    if (r.format === "undetermined") {
      assert.equal(r.confidence, "none");
      assert.equal(r.signals.length, 2);
      continue;
    }
    const own = b ? entry(r.format).detect(b, null) : entry(r.format).detect(null, c);
    if (own) assert.deepEqual(r, own, "an entry's own verbatim result");
    else { assert.equal(r.format, "csv"); assert.equal(r.confidence, "likely"); assert.equal(own, null); }
  }
  // the name pass names csv only while a csv entry is registered (a format is never named that nothing can read)
  const zip = unregisterFormat("zip"), csv = unregisterFormat("csv");
  try {
    assert.equal(now(detectFormat(CSV, "application/octet-stream", "a.csv")).format, "undetermined");
  } finally { registerFormat(must(csv, "csv")); registerFormat(must(zip, "zip")); }
  assert.equal(now(detectFormat(CSV, "application/octet-stream", "a.csv")).format, "csv");
});

/* Big containers: a stored member of noise makes the file big without being compressible. */
const BIG = 2 * MIB + 12345;

/** @param {string} main @param {string} part @param {string} media @param {number} size @returns {Uint8Array} */
function bigOffice(main, part, media, size) {
  return makeZip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${part}" ContentType="${main}"/></Types>` },
    { name: "_rels/.rels", data: "<Relationships/>" },
    { name: part, data: "<x/>" },
    { name: media, data: noise(size, 21), method: 0 },
  ]);
}
/** @param {string} mimetype @param {number} size @returns {Uint8Array} */
function bigOdf(mimetype, size) {
  return makeZip([
    { name: "mimetype", data: mimetype, method: 0 },
    { name: "META-INF/manifest.xml", data: "<manifest:manifest xmlns:manifest=\"urn:oasis:names:tc:opendocument:xmlns:manifest:1.0\"/>" },
    { name: "content.xml", data: "<office:document-content/>" },
    { name: "Pictures/a.bin", data: noise(size, 22), method: 0 },
  ]);
}

/** @type {[string, () => Uint8Array][]} */
const KINDS = [
  ["docx", () => bigOffice("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml", "word/media/a.bin", BIG)],
  ["xlsx", () => bigOffice("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml", "xl/workbook.xml", "xl/media/a.bin", BIG)],
  ["pptx", () => bigOffice("application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", "ppt/presentation.xml", "ppt/media/a.bin", BIG)],
  ["odt", () => bigOdf("application/vnd.oasis.opendocument.text", BIG)],
  ["ods", () => bigOdf("application/vnd.oasis.opendocument.spreadsheet", BIG)],
  ["odp", () => bigOdf("application/vnd.oasis.opendocument.presentation", BIG)],
  ["zip", () => makeZip([{ name: "a.bin", data: noise(BIG, 23), method: 0 }, { name: "b.txt", data: "b" }])],
];

test("R32: DOCS O9 — a file above the head is recognised from its end record and central directory: office, OpenDocument and plain ZIP, as the same bytes whole", async () => {
  for (const [format, build] of KINDS) {
    const bytes = build();
    assert.ok(bytes.length > 2 * MIB, `${format} fixture is past the 1 MiB head`);
    const whole = now(detectFormat(bytes, null));
    assert.equal(whole.format, format, `${format} whole`);
    const src = source(bytes);
    const answer = detectFormat(src, null);
    assert.ok(answer instanceof Promise, "a range source answers a Promise");
    const r = await answer;
    isHit(r, format, whole.confidence);
    assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
    // the content type and the name do not change a container's answer
    assert.equal((await detectFormat(source(bytes), "application/octet-stream", "file.csv")).format, format);
    assert.equal((await detectFormat(source(bytes), "text/html", "file.csv")).format, format);
    // what was pulled is a head, an end record, a directory and small parts: never the file
    assert.ok(src.log.bytes <= MIB + 256 * 1024 && src.log.bytes < bytes.length, `${format}: pulled ${src.log.bytes} of ${bytes.length}`);
    assert.deepEqual(src.log.spans[0], [0, MIB], "the first read is the 1 MiB head");
    assert.ok(src.log.spans.every(([, n]) => n <= MIB), "no read is larger than the head");
  }
});

test("R32: a source small enough to be read whole answers as the same bytes given whole, signals and all", async () => {
  const small = [CSV, NOTE, cat("%PDF-1.7\n%%EOF\n"), cat(JPEG_SIG, [0xfe, 0, 8], "%PDF-1.4"), officeZip("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml"),
    odfZip("application/vnd.oasis.opendocument.text"), makeZip([{ name: "a.txt", data: "a" }]), enc("<!doctype html><html></html>"), noise(900, 5)];
  for (const b of small) {
    for (const [ct, name] of [[null, null], ["application/octet-stream", "x.csv"], ["text/html", null], ["text/plain", "x.txt"]]) {
      assert.deepEqual(await detectFormat(source(b), ct, name), detectFormat(b, ct, name));
    }
  }
});

test("R32: the head decides the signatures and the name pass — a big picture, PDF, HTML and delimited text from a source", async () => {
  const fill = (/** @type {Uint8Array} */ head) => cat(head, noise(3 * MIB, 31));
  const jpeg = fill(cat(JPEG_SIG, [0xfe, 0, 12], "%PDF-1.4"));
  const png = fill(cat(PNG_SIG, "tEXt%PDF-1.7"));
  const pdf = fill(enc("%PDF-1.7\n"));
  const html = fill(enc("<!doctype html><html>"));
  isHit(await detectFormat(source(jpeg), null), "jpeg", "certain");
  isHit(await detectFormat(source(png), null), "png", "certain");
  isHit(await detectFormat(source(pdf), null), "pdf", "certain");
  isHit(await detectFormat(source(html), null), "html", "certain");
  // a big delimited text: pass 3 from the head, with no container read of its tail
  const rows = enc("a,b,c\n1,2,3\n");
  const big = new Uint8Array(3 * MIB);
  for (let at = 0; at < big.length;) { const n = Math.min(rows.length, big.length - at); big.set(rows.subarray(0, n), at); at += n; }
  const src = source(big);
  isHit(await detectFormat(src, "application/octet-stream", "big.csv"), "csv", "likely");
  // declared types are pass 2 as ever
  assert.equal((await detectFormat(source(noise(3 * MIB, 41)), "application/pdf")).format, "pdf");
  const und = await detectFormat(source(noise(3 * MIB, 42)), null);
  assert.equal(und.format, "undetermined");
  assert.equal(und.confidence, "none");
  assert.equal(und.signals.length, 2);
  // a ZIP-looking head with no readable end is not a container: the tail decides, not the first KiB
  const cut = officeZip("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml");
  const headless = cat(cut.subarray(0, cut.length - 30), noise(2 * MIB, 43));
  assert.notEqual((await detectFormat(source(headless), null)).format, "docx");
});

test("R32: a source with no size, no bytes or a failing read — an empty source is undetermined, a failed read rejects, a non-source is not one", async () => {
  const empty = await detectFormat({ size: 0, readRange: async () => new Uint8Array(0) }, "text/html");
  assert.equal(empty.format, "html", "no bytes: the declared type is judged as for absent bytes");
  assert.equal((await detectFormat({ size: 0, readRange: async () => new Uint8Array(0) }, null)).format, "undetermined");
  const boom = new Error("range failed");
  await assert.rejects(detectFormat({ size: 3 * MIB, readRange: async () => { throw boom; } }, null), (/** @type {unknown} */ e) => e === boom);
  // an object with a readRange but no finite size is not a source: it is "bytes not provided"
  const notSource = detectFormat({ size: "big", readRange: async () => new Uint8Array(4) }, "application/pdf");
  assert.ok(!(notSource instanceof Promise));
  assert.equal(notSource.format, "pdf");
  assert.equal(notSource.confidence, "likely");
  // a Uint8Array is always whole bytes, never a source
  assert.ok(!(detectFormat(CSV, null) instanceof Promise));
});

test("R25: a detection from a range source reads only through readRange; it touches no clock, no network and no registry state", async () => {
  const saved = { fetch: globalThis.fetch, now: Date.now, perf: performance.now, random: Math.random };
  const trap = (/** @type {string} */ what) => () => { throw new Error(`format-registry touched ${what}`); };
  const bytes = bigOffice("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml", "word/media/a.bin", BIG);
  const before = listFormats();
  globalThis.fetch = trap("fetch"); Date.now = trap("Date.now"); performance.now = trap("performance.now"); Math.random = trap("Math.random");
  /** @returns {Promise<[FormatDetection, FormatDetection]>} */
  const detectTwice = async () => {
    try {
      const a = await detectFormat(source(bytes), null, "x.docx");
      const b = await detectFormat(source(bytes), null, "x.docx");
      return [a, b];
    } finally { globalThis.fetch = saved.fetch; Date.now = saved.now; performance.now = saved.perf; Math.random = saved.random; }
  };
  const [a, b] = await detectTwice();
  assert.deepEqual(a, b, "one state and one input give one answer");
  assert.equal(a.format, "docx");
  assert.deepEqual(listFormats(), before);
});

test("R17: DOCS T13 — a note that mentions <html> or <!DOCTYPE html> in its first KiB is read as text, by whole bytes and by a source", async () => {
  const notes = [
    "Remember: the page template starts with <!DOCTYPE html> and then the <html> element.\n",
    "From: clerk\nSubject: site\n\nThe agenda is at <html>... please check.\n",
    "// sample\nconst s = '<html><body></body></html>';\n",
  ];
  for (const n of notes) {
    const b = enc(n);
    for (const ct of [null, "text/plain", "application/octet-stream"]) {
      assert.notEqual(now(detectFormat(b, ct)).format, "html", n);
      assert.notEqual((await detectFormat(source(b), ct)).format, "html", n);
    }
    // the declared type still decides when no entry claims the bytes (pass 2), and a real page is still a page
    assert.equal(now(detectFormat(b, "text/html")).format, "html");
    assert.equal(now(detectFormat(b, "text/html")).confidence, "likely");
  }
  isHit(now(detectFormat(enc("<!DOCTYPE html>\n<html><body>The page</body></html>"), "text/plain")), "html", "certain");
});
