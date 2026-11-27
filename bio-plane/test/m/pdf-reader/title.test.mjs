/* pdf-reader: requirement-named tests for `pdfTitle(bytes)` (build/requirements/
 * pdf-reader.md R40; fix round 4, C25; acquisition R98), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateSync, constants } from "node:zlib";
import { pdfTitle, extractPdfStructure } from "../../../src/pdfstructure.mjs";
import { bytesOf, doc, hex } from "./pdf.mjs";
import { indexed, utf16hex } from "./indexed.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfMetadata } from "../../../src/pdfstructure.mjs" */
/** @import { IndexedObjects, IndexedOptions } from "./indexed.mjs" */

/** The zlib options a test writes an XMP stream with.
 *  @typedef {Object} ZOptions
 *  @property {number} [level]
 *  @property {number} [strategy]
 *  @property {number} [memLevel]
 *  @property {number} [windowBits]
 */
/** What a test gives `file` beside the Info.
 *  @typedef {Object} FileOptions
 *  @property {string | null} [xmp] the XMP packet of object 92, absent or null is none
 *  @property {string | null} [catalog] the catalog, absent or null is one naming the XMP when there is one
 *  @property {IndexedOptions} [kind] how the file is indexed
 *  @property {boolean} [flate] whether the XMP stream is compressed
 *  @property {ZOptions} [zopts] the zlib options it is compressed with
 */
/** One way of indexing a file, and its name.
 *  @typedef {Object} Kind
 *  @property {string} name
 *  @property {IndexedOptions} kind
 */

const IRS = new Uint8Array(readFileSync(new URL("./fixtures/f1040es.pdf", import.meta.url)));
const CATALOG = "<< /Type /Catalog /Pages 2 0 R >>";
const PAGES = "<< /Type /Pages /Kids [] /Count 0 >>";
/** @type {Kind[]} */
const KINDS = [
  { name: "table", kind: {} }, { name: "stream", kind: {} }, { name: "stream packed", kind: { xref: "stream", packed: [1, 2, 91] } },
  { name: "stream packed, stored", kind: { xref: "stream", packed: [1, 2, 91], level: 0 } },
  { name: "stream, no predictor", kind: { xref: "stream", predictor: false } },
];

/** The reading of a PDF; a thrown failure when it is refused.
 *  @param {PdfStructureAnswer} r
 *  @returns {PdfStructure} */
const read = (r) => {
  if (!r.ok) throw new Error(`the PDF was refused: ${r.reason}`);
  return r;
};
/** A reading's metadata; a thrown failure when it is null.
 *  @param {PdfStructure} r
 *  @returns {PdfMetadata} */
const metaOf = (r) => {
  const m = r.metadata;
  if (m === null) throw new Error("the reading has no metadata");
  return m;
};
/** Entry `i` of a list; a thrown failure naming `what` when there is none.
 *  @template T
 *  @param {T[]} xs
 *  @param {number} i
 *  @param {string} what
 *  @returns {T} */
const nth = (xs, i, what) => {
  const x = xs[i];
  if (x === undefined) throw new Error(`${what}[${i}] is missing`);
  return x;
};

/** A file whose Info is object 91 and whose Root may name an XMP stream (object 92).
 *  @param {string | null} info
 *  @param {FileOptions} [options]
 *  @returns {Uint8Array} */
function file(info, { xmp = null, catalog = null, kind = {}, flate = false, zopts = {} } = {}) {
  /** @type {IndexedObjects} */
  const objs = { 1: catalog ?? `<< /Type /Catalog /Pages 2 0 R${xmp != null ? " /Metadata 92 0 R" : ""} >>`, 2: PAGES };
  if (info != null) objs[91] = info;
  if (xmp != null) {
    const raw = bytesOf(xmp);
    objs[92] = flate
      ? { dict: "/Type /Metadata /Subtype /XML /Filter /FlateDecode", data: new Uint8Array(deflateSync(raw, zopts)) }
      : { dict: "/Type /Metadata /Subtype /XML", data: raw };
  }
  const trailer = `/Root 1 0 R${info != null ? " /Info 91 0 R" : ""}`;
  /** @type {IndexedOptions} */
  const options = { trailer, ...kind };
  return indexed(objs, options);
}
/** An XMP packet whose dc:title (under the prefix `ns`) holds `li`, or with no title when `li` is null.
 *  @param {string | null} li
 *  @param {string} [ns]
 *  @returns {string} */
const packet = (li, ns = "dc") => `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:${ns}="http://purl.org/dc/elements/1.1/"><${ns}:format>application/pdf</${ns}:format>${li == null ? "" : `<${ns}:title><rdf:Alt>${li}</rdf:Alt></${ns}:title>`}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
/** One language's entry of a title.
 *  @param {string} text
 *  @param {string} [l]
 *  @returns {string} */
const lang = (text, l = "x-default") => `<rdf:li xml:lang="${l}">${text}</rdf:li>`;
/** @param {string} s
 *  @returns {string} */
const utf8 = (s) => Buffer.from(s, "utf8").toString("latin1"); // the bytes bytesOf() writes back

test("R40: the real IRS Form 1040-ES answers its title, as the reading's metadata states it", async () => {
  assert.equal(pdfTitle(IRS), "2026 Form 1040-ES");
  assert.equal(metaOf(read(await extractPdfStructure(IRS))).title, "2026 Form 1040-ES");
});

test("R40: Info /Title is read exactly, whichever way the file is indexed (table, stream, packed, stored, no predictor)", () => {
  for (const { name, kind } of KINDS) {
    assert.equal(pdfTitle(file("<< /Title (Housing Notice) /Producer (W) >>", { kind })), "Housing Notice", name);
    assert.equal(pdfTitle(file("<< /Title (Notice \\(Draft\\) \\101) >>", { kind })), "Notice (Draft) A", name);
    assert.equal(pdfTitle(file(`<< /Title ${utf16hex("Café Étude — Ωmega 😀")} >>`, { kind })), "Café Étude — Ωmega 😀", name);
    assert.equal(pdfTitle(file(`<< /Title ${hex("\x80 List \x84 \xe9")} >>`, { kind })), "• List — é", name);
  }
});

test("R40: the title is answered uncleaned (the caller cleans it)", () => {
  assert.equal(pdfTitle(file("<< /Title (  Spaced   Title\\n ) >>")), "  Spaced   Title\n ");
  assert.equal(pdfTitle(file("<< /Title (Microsoft Word - notice.docx) >>")), "Microsoft Word - notice.docx");
});

test("R40: an indirect /Title and an /Info reached through a later revision are followed", () => {
  assert.equal(pdfTitle(file("<< /Title 95 0 R >>", { catalog: CATALOG })), null, "a dangling indirect /Title");
  const withRef = indexed({ 1: CATALOG, 2: PAGES, 91: "<< /Title 95 0 R >>", 95: "(Indirect Title)" },
    { trailer: "/Root 1 0 R /Info 91 0 R" });
  assert.equal(pdfTitle(withRef), "Indirect Title");
  /** @type {("table" | "stream")[]} */
  const xrefs = ["table", "stream"];
  for (const xref of xrefs) {
    const first = indexed({ 1: CATALOG, 2: PAGES, 91: "<< /Title (First) >>" }, { xref, trailer: "/Root 1 0 R /Info 91 0 R" });
    const second = indexed({ 91: "<< /Title (Second) >>" }, { xref, prev: first, trailer: "/Root 1 0 R /Info 91 0 R", xrefNum: 902 });
    assert.equal(pdfTitle(first), "First", xref);
    assert.equal(pdfTitle(second), "Second", xref);
    // a revision whose own trailer names no /Info still finds the earlier one
    const third = indexed({ 2: PAGES }, { xref, prev: second, trailer: "/Root 1 0 R", xrefNum: 903 });
    assert.equal(pdfTitle(third), "Second", xref);
  }
});

test("R40: with no Info /Title the XMP dc:title is the title (x-default first, entities and UTF-8 decoded), however indexed or compressed", () => {
  for (const { name, kind } of KINDS) {
    for (const flate of [false, true]) {
      const where = `${name}${flate ? " (flate)" : ""}`;
      assert.equal(pdfTitle(file("<< /Producer (W) >>", { xmp: packet(lang("Zoning Map &amp; Notes &#233; &#x2014; ok")), kind, flate })),
        "Zoning Map & Notes é — ok", where);
      assert.equal(pdfTitle(file(null, { xmp: packet(lang(utf8("Café Ωmega"))), kind, flate })), "Café Ωmega", where);
    }
  }
  const alt = packet(lang("Titre", "fr") + lang("Title", "x-default") + lang("Titel", "de"));
  assert.equal(pdfTitle(file(null, { xmp: alt })), "Title");
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("Titre", "fr") + lang("Titel", "de")) })), "Titre", "no x-default: the first");
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("A &lt;b&gt;"), "dcx") })), "A <b>", "the dc namespace under another prefix");
  assert.equal(pdfTitle(file(null, { xmp: packet(`<rdf:li xml:lang="x-default"><![CDATA[Plain & simple]]></rdf:li>`) })), "Plain & simple");
});

test("R40: XMP inflates whichever block type the producer used (stored, fixed Huffman, dynamic Huffman), and an object stream of each", () => {
  const long = "Notice of Public Hearing on the Proposed Amendments to the Zoning Ordinance, ".repeat(40);
  const li = lang(long.trim());
  /** @type {ZOptions[]} */
  const zoptions = [{ level: 0 }, { level: 1, strategy: constants.Z_FIXED }, { level: 6 }, { level: 9, strategy: constants.Z_HUFFMAN_ONLY },
    { level: 9, strategy: constants.Z_RLE }, { level: 9, memLevel: 1, windowBits: 9 }];
  for (const zopts of zoptions) {
    assert.equal(pdfTitle(file(null, { xmp: packet(li), flate: true, zopts })), long.trim(), JSON.stringify(zopts));
  }
  for (const level of [0, 1, 9]) {
    assert.equal(pdfTitle(file(`<< /Title (${"x".repeat(500)} packed) >>`, { kind: { xref: "stream", packed: [1, 2, 91], level } })),
      `${"x".repeat(500)} packed`, `object stream, level ${level}`);
  }
  const raw = new Uint8Array(deflateSync(bytesOf(packet(lang("Raw deflate"))), {}).subarray(2, -4)); // no zlib header or sum
  const rawFile = indexed({ 1: "<< /Type /Catalog /Pages 2 0 R /Metadata 92 0 R >>", 2: PAGES,
    92: { dict: "/Type /Metadata /Filter /FlateDecode", data: raw } }, { trailer: "/Root 1 0 R" });
  assert.equal(pdfTitle(rawFile), "Raw deflate");
});

test("R40: a hybrid-reference file (a table whose trailer names an /XRefStm) reaches the objects the stream indexes", () => {
  const packedPart = indexed({ 1: CATALOG, 2: PAGES, 91: "<< /Title (Hybrid) >>" }, { xref: "stream", packed: [91], trailer: "/Root 1 0 R" });
  const text = Buffer.from(packedPart).toString("latin1");
  const xrefStmAt = text.indexOf("990 0 obj");
  // a table that lists only objects 1 and 2, then points at the stream for the rest
  const t1 = text.indexOf("1 0 obj"), t2 = text.indexOf("2 0 obj");
  const tail = `xref\n0 1\n0000000000 65535 f \n1 1\n${String(t1).padStart(10, "0")} 00000 n \n2 1\n${String(t2).padStart(10, "0")} 00000 n \n`
    + `trailer\n<< /Size 991 /Root 1 0 R /Info 91 0 R /XRefStm ${xrefStmAt} >>\nstartxref\n`;
  const body = text.slice(0, text.lastIndexOf("startxref"));
  const at = body.length;
  const hybrid = bytesOf(body + tail.replace(/\\n/g, "\n") + at + "\n%%EOF\n");
  assert.equal(pdfTitle(hybrid), "Hybrid");
});

test("R40: Info /Title wins over XMP; an empty, blank, non-string or undecodable Info title falls to XMP, and to null without one", () => {
  const xmp = packet(lang("From XMP"));
  assert.equal(pdfTitle(file("<< /Title (From Info) >>", { xmp })), "From Info");
  for (const info of ["<< /Title () >>", "<< /Title (   ) >>", "<< /Title 12 >>", "<< /Title /Name >>", "<< /Title 99 0 R >>",
    `<< /Title ${utf16hex("  ")} >>`, "<< /Title <FEFF004800> >>", `<< /Title ${hex("a\x7fb")} >>`, "<< /Producer (W) >>"]) {
    assert.equal(pdfTitle(file(info, { xmp })), "From XMP", info);
    assert.equal(pdfTitle(file(info)), null, info);
  }
});

test("R40: none is null: no Info, no Metadata, an XMP without a title, a blank one, a damaged packet", () => {
  assert.equal(pdfTitle(indexed({ 1: CATALOG, 2: PAGES })), null);
  assert.equal(pdfTitle(file(null, { xmp: packet(null) })), null);
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("   ")) })), null);
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("")) })), null);
  assert.equal(pdfTitle(file(null, { xmp: "<x:xmpmeta><dc:title><rdf:Alt><rdf:li>never closed" })), null);
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("\xff\xfe broken utf8")) })), null);
  assert.equal(pdfTitle(file("<< /Title (T) >>", { catalog: "<< /Type /Catalog /Pages 2 0 R /Metadata 77 0 R >>" })), "T", "a dangling /Metadata");
  assert.equal(pdfTitle(file(null, { catalog: "<< /Type /Catalog /Pages 2 0 R /Metadata 77 0 R >>" })), null, "a dangling /Metadata, no Info");
  assert.equal(pdfTitle(file(null, { xmp: packet(lang("T")), catalog: "<< /Type /Catalog /Pages 2 0 R /Metadata 2 0 R >>" })), null, "/Metadata not a stream");
});

test("R40: the pages are not read: a file whose every page and content stream is damaged still answers", () => {
  const pages = ["<< /Type /Page /Parent 2 0 R /Contents 50 0 R /Resources << /Font << /F1 51 0 R >> >> >>"];
  const damaged = indexed({ 1: CATALOG, 2: "<< /Type /Pages /Kids [100 0 R] /Count 1 >>", 100: nth(pages, 0, "pages"),
    50: { dict: "/Filter /FlateDecode", data: "not a deflate stream at all" }, 51: "<< /Type /Font /ToUnicode 52 0 R >>",
    52: { dict: "/Filter /FlateDecode", data: "junk" }, 91: "<< /Title (Still Here) >>" }, { trailer: "/Root 1 0 R /Info 91 0 R" });
  assert.equal(pdfTitle(damaged), "Still Here");
});

test("R40: a file with no usable xref (none, a wrong startxref, a missing /Prev) is read by its trailer and objects", () => {
  const plain = doc([{ content: "" }], { objs: { 91: "<< /Title (No xref) >>" }, trailer: "trailer\n<< /Root 1 0 R /Info 91 0 R >>\n" });
  assert.equal(pdfTitle(plain), "No xref");
  const good = indexed({ 1: CATALOG, 2: PAGES, 91: "<< /Title (Wrong offset) >>" }, { trailer: "/Root 1 0 R /Info 91 0 R" });
  const text = Buffer.from(good).toString("latin1");
  const broken = bytesOf(text.replace(/startxref\n\d+/, "startxref\n7").replace(/\n(\d{10}) 00000 n /g, "\n0000000012 00000 n "));
  assert.equal(pdfTitle(broken), "Wrong offset");
  const orphan = indexed({ 91: "<< /Title (Orphan) >>" }, { prev: indexed({ 1: CATALOG, 2: PAGES }, { trailer: "/Root 1 0 R" }),
    trailer: "/Root 1 0 R /Info 91 0 R" }).slice();
  assert.equal(pdfTitle(orphan), "Orphan");
});

test("R40: an encrypted file's title is null, Info or XMP", () => {
  const ENC = "<< /Filter /Standard /V 1 /R 2 /O (owner) /U (user) /P -4 >>";
  for (const { kind } of KINDS.slice(0, 2)) {
    const enc = indexed({ 1: "<< /Type /Catalog /Pages 2 0 R /Metadata 92 0 R >>", 2: PAGES, 90: ENC, 91: "<< /Title (Secret) >>",
      92: { dict: "/Type /Metadata /Subtype /XML", data: packet(lang("Secret")) } },
    { ...kind, trailer: "/Root 1 0 R /Encrypt 90 0 R /Info 91 0 R" });
    assert.equal(pdfTitle(enc), null);
  }
  assert.equal(pdfTitle(doc([{ content: "" }], { objs: { 90: ENC, 91: "<< /Title (Secret) >>" },
    trailer: "trailer\n<< /Root 1 0 R /Encrypt 90 0 R /Info 91 0 R >>\n" })), null);
});

test("R40: bytes that are not a PDF, and every damaged form, answer null and never throw", () => {
  /** @type {unknown[]} */
  const values = [undefined, null, "%PDF-1.7", 12, {}, [], new ArrayBuffer(8), new Uint8Array(0), new Uint8Array(10),
    bytesOf("not a pdf at all"), bytesOf("%PDF-"), bytesOf("%PDF-1.7\n")];
  for (const v of values) assert.equal(pdfTitle(v), null);
  const t0 = Date.now();
  for (let cut = 0; cut < IRS.length; cut += 997) {
    const r = pdfTitle(IRS.subarray(0, cut));
    assert.ok(r === null || r === "2026 Form 1040-ES", `cut ${cut}`);
  }
  let seed = 7;
  /** @returns {number} */
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 150; i++) {
    const copy = IRS.slice();
    for (let k = 0; k < 40; k++) copy[Math.floor(rnd() * copy.length)] = Math.floor(rnd() * 256);
    const r = pdfTitle(copy);
    assert.ok(r === null || typeof r === "string");
  }
  assert.ok(Date.now() - t0 < 20000);
  // a hostile stream: a deflate bomb as the XMP and as an object stream must not exhaust memory or time
  const bomb = new Uint8Array(deflateSync(new Uint8Array(200 * 1024 * 1024), { level: 9 }));
  const hostile = indexed({ 1: "<< /Type /Catalog /Pages 2 0 R /Metadata 92 0 R >>", 2: PAGES,
    92: { dict: "/Type /Metadata /Filter /FlateDecode", data: bomb } }, { trailer: "/Root 1 0 R" });
  const t1 = performance.now();
  assert.equal(pdfTitle(hostile), null);
  assert.ok(performance.now() - t1 < 300, "a deflate bomb is cut at the bound, not inflated (12 ms bounded, over a second not)");
  // reference cycles and absurd indices
  const cyc = indexed({ 1: CATALOG, 2: PAGES, 91: "<< /Title 92 0 R >>", 92: "93 0 R", 93: "92 0 R" }, { trailer: "/Root 1 0 R /Info 91 0 R" });
  assert.equal(pdfTitle(cyc), null);
});

/* A 16 MB file shaped like the govinfo budget volumes: thousands of objects in
 * object streams, several cross-reference streams, an Info with no Title, and a
 * Root /Metadata XMP with a title, with other XMP packets (a logo's) before it
 * in the file. The real BUDGET-2024-APP.pdf (15,932,155 bytes) is timed the same
 * way by the job's platform check; no network file is read here. */
/** @param {string | null} [title]
 *  @returns {Uint8Array} */
function bigFile(title = "Budget Appendix") {
  const filler = new Uint8Array(16 * 1024 * 1024);
  let s = 12345;
  for (let i = 0; i < filler.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; filler[i] = s >>> 24; }
  /** @type {IndexedObjects} */
  const objs = { 1: "<< /Type /Catalog /Pages 2 0 R /Metadata 6023 0 R >>", 2: PAGES, 10260: "<< /Producer (Acrobat) /Creator (Acrobat) >>",
    6023: { dict: "/Type /Metadata /Subtype /XML", data: packet(title == null ? null : lang(title)) },
    5000: { dict: "/Type /Metadata /Subtype /XML", data: packet(lang("logo [linework]")) },
    5001: { dict: "/Subtype /Image /Width 4096 /Height 4096 /Filter /DCTDecode", data: filler } };
  for (let n = 100; n < 4000; n++) objs[n] = `<< /Type /Page /Parent 2 0 R /N ${n} >>`;
  /** @type {number[]} */
  const packed = [];
  for (let i = 0; i < 3900; i++) packed.push(100 + i);
  const first = indexed(objs, { xref: "stream", packed: [...packed], trailer: "/Root 1 0 R /Info 10260 0 R" });
  return indexed({ 7000: "<< /Note (revision) >>" }, { xref: "stream", prev: first, xrefNum: 902, objStmNum: 903,
    trailer: "/Root 1 0 R /Info 10260 0 R" });
}

test("R40: a file of 16 MB answers within 100 ms (the best of three), the title read without reading a page", () => {
  const big = bigFile();
  assert.ok(big.length > 16 * 1024 * 1024);
  pdfTitle(IRS); // the JIT is warm on the real shapes before the clock starts
  let best = Infinity;
  /** @type {string | null | undefined} */
  let got;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    got = pdfTitle(big);
    best = Math.min(best, performance.now() - t);
  }
  assert.equal(got, "Budget Appendix");
  assert.ok(best < 100, `took ${best.toFixed(1)} ms`);
  // a 16 MB file whose catalog states no title is answered null as fast: nothing falls back to a search of the file
  const none = bigFile(null);
  let bestNone = Infinity;
  /** @type {string | null | undefined} */
  let gotNone;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    gotNone = pdfTitle(none);
    bestNone = Math.min(bestNone, performance.now() - t);
  }
  assert.equal(gotNone, null);
  assert.ok(bestNone < 100, `took ${bestNone.toFixed(1)} ms`);
});

test("R40 control: extractPdfStructure is unchanged (its R39 metadata, notes and keys; pdfTitle changes nothing it answers)", async () => {
  const before = read(await extractPdfStructure(IRS));
  pdfTitle(IRS);
  const after = read(await extractPdfStructure(IRS));
  assert.deepEqual(Object.keys(after), Object.keys(before));
  assert.deepEqual(after.metadata, { title: "2026 Form 1040-ES", source: "/Info" });
  assert.deepEqual(after.notes, before.notes);
  assert.equal(after.pages, 16);
  const hand = read(await extractPdfStructure(file("<< /Title (Housing Notice) >>", { xmp: packet(lang("XMP only title")) })));
  assert.deepEqual(hand.metadata, { title: "Housing Notice", source: "/Info" });
  const xmpOnly = read(await extractPdfStructure(file("<< /Producer (W) >>", { xmp: packet(lang("XMP only title")) })));
  assert.deepEqual(xmpOnly.metadata, { source: "/Info" }, "R39 reads the Info title alone; pdfTitle's XMP is not leaked into it");
});
