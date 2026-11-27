/* pdf-reader: requirement-named tests for the ASCII filters (build/requirements/pdf-reader.md R22, R11; fix round 5, E11), at the
 * module's interface: a content stream written `/Filter [/ASCII85Decode /FlateDecode]`, reportlab's default, is a text page
 * and not pictures of text. The words are asserted in the page's text, never only that a reading exists (R-STOP). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { extractPdfStructure, openPdf, pdfTitle } from "../../../src/pdfstructure.mjs";
import { doc, bytesOf } from "./pdf.mjs";
import { indexed } from "./indexed.mjs";
/** @import { PdfStructureAnswer, PdfStructure, PdfDoc, PageText } from "../../../src/pdfstructure.mjs" */
/** @import { StreamBody } from "./pdf.mjs" */

/** `x`; a thrown failure naming `what` when it is undefined or null.
 *  @template T
 *  @param {T | undefined | null} x
 *  @param {string} what
 *  @returns {T} */
const must = (x, what) => { if (x === undefined || x === null) throw new Error(`${what}: none`); return x; };
/** The reading of a whole file; a thrown failure naming the refusal when it is refused.
 *  @param {PdfStructureAnswer} a
 *  @returns {PdfStructure} */
const reading = (a) => { if (!a.ok) throw new Error(`expected a reading, got ${a.reason}`); return a; };
/** A reading's first page.
 *  @param {PdfStructure} r
 *  @returns {PageText} */
const page0 = (r) => must(r.text.pages[0], "page 0");
/** A test case: its name and the content stream it reads.
 *  @typedef {{ name: string, stream: StreamBody }} StreamCase */
/** How `a85` writes: `wrap` breaks lines after that many characters (0 none); `marks` writes the leading `<~`.
 *  @typedef {{ wrap?: number, marks?: boolean }} A85Options */

const CONTENT = "BT /F1 10 Tf 40 700 Td (The council adopted the budget.) Tj 0 -14 Td (Item two was continued.) Tj ET";
const WORDS = ["The council adopted the budget.", "Item two was continued."];

/** ASCII85 as reportlab writes it: `<~`-less, groups of five, `z` for four zero bytes, a final short group, `~>`.
 *  @param {Uint8Array} bytes
 *  @param {A85Options} [options]
 *  @returns {string} */
function a85(bytes, { wrap = 0, marks = false } = {}) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const n = Math.min(4, bytes.length - i);
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (k < n ? must(bytes[i + k], `byte ${i + k}`) : 0);
    if (n === 4 && v === 0) { out += "z"; continue; }
    /** @type {string[]} */
    const g = [];
    for (let k = 0; k < 5; k++) { g.unshift(String.fromCharCode(33 + (v % 85))); v = Math.floor(v / 85); }
    out += g.slice(0, n + 1).join("");
  }
  out += "~>";
  if (marks) out = "<~" + out;
  return wrap ? out.replace(new RegExp(`(.{${wrap}})`, "g"), "$1\n") : out;
}
/** ASCIIHex of `bytes`, 32 digits a line, ended by `>`.
 *  @param {Uint8Array} bytes
 *  @returns {string} */
const ahx = (bytes) => Buffer.from(bytes).toString("hex").toUpperCase().replace(/(.{32})/g, "$1\n") + ">";
/** A one-page document whose content stream is `stream`.
 *  @param {StreamBody} stream
 *  @returns {Uint8Array} */
const pageOf = (stream) => doc([{ content: stream }]);
/** The reading of a one-page document whose content stream is `stream`.
 *  @param {StreamBody} stream
 *  @returns {Promise<PdfStructure>} */
const read = async (stream) => reading(await extractPdfStructure(pageOf(stream)));
/** The content, Flate-compressed.
 *  @returns {Uint8Array} */
const flat = () => new Uint8Array(deflateSync(Buffer.from(CONTENT, "latin1")));
/** The first page's text.
 *  @param {PdfStructure} r
 *  @returns {string} */
const texts = (r) => page0(r).text;
/** A document opened; a thrown failure when it is not a PDF.
 *  @param {Uint8Array} bytes
 *  @returns {Promise<PdfDoc>} */
const opened = async (bytes) => must(await openPdf(bytes), "openPdf");

test("R22 R11: a content stream under [/ASCII85Decode /FlateDecode] is read, and its words are the page's text", async () => {
  const r = await read({ dict: "/Filter [/ASCII85Decode /FlateDecode]", data: a85(flat(), { wrap: 64 }) });
  assert.equal(r.ok, true);
  for (const w of WORDS) assert.ok(texts(r).includes(w), `${JSON.stringify(texts(r))} lacks ${w}`);
  assert.ok(!r.notes.includes("content_stream_undecodable"));
  assert.deepEqual(page0(r).undetermined.map((m) => m.reason).filter(/** @param {string} x @returns {boolean} */ (x) => x === "content_stream_undecodable"), []);
});

test("R22 R11: the other ways a producer chains the ASCII filters are read the same way", async () => {
  const z = flat();
  const plain = new Uint8Array(Buffer.from(CONTENT, "latin1"));
  /** @type {StreamCase[]} */
  const cases = [
    { name: "ASCIIHexDecode then Flate", stream: { dict: "/Filter [/ASCIIHexDecode /FlateDecode]", data: ahx(z) } },
    { name: "the short names, A85 and Fl", stream: { dict: "/Filter [/A85 /Fl]", data: a85(z) } },
    { name: "AHx and Fl", stream: { dict: "/Filter [/AHx /Fl]", data: ahx(z).toLowerCase() } },
    { name: "ASCII85Decode alone", stream: { dict: "/Filter /ASCII85Decode", data: a85(plain, { wrap: 40 }) } },
    { name: "ASCIIHexDecode alone, an odd last digit", stream: { dict: "/Filter [/ASCIIHexDecode]", data: ahx(plain).replace(/>$/, "") + ">" } },
    { name: "ASCII85Decode with its <~ mark", stream: { dict: "/Filter [/ASCII85Decode]", data: a85(plain, { marks: true }) } },
    { name: "ASCII85 then ASCIIHex then Flate", stream: { dict: "/Filter [/ASCII85Decode /ASCIIHexDecode /FlateDecode]", data: a85(bytesOf(ahx(z))) } },
  ];
  for (const { name, stream } of cases) {
    const r = await read(stream);
    for (const w of WORDS) assert.ok(texts(r).includes(w), `${name}: ${JSON.stringify(texts(r))}`);
    assert.ok(!r.notes.includes("content_stream_undecodable"), name);
  }
});

test("R22: streamDecoded undoes ASCII85Decode byte for byte, `z` groups and a final group of 2, 3 and 4 characters included", async () => {
  for (const len of [0, 1, 2, 3, 4, 5, 7, 8, 11, 64, 257]) {
    const bytes = new Uint8Array(len).map((_, i) => (i % 9 === 0 ? 0 : (i * 37 + 11) & 0xff)); // zero runs make `z`
    const d = await opened(doc([{ content: { dict: "/Filter /ASCII85Decode", data: a85(bytes) } }]));
    const st = d.resolve({ t: "ref", n: 101, g: 0 });
    assert.deepEqual(Array.from(must(await d.streamDecoded(st), "decoded")), Array.from(bytes), `length ${len}`);
  }
  const zeros = new Uint8Array(12);
  assert.ok(a85(zeros).startsWith("zzz"));
  const d = await opened(doc([{ content: { dict: "/Filter /ASCII85Decode", data: a85(zeros) } }]));
  assert.deepEqual(Array.from(must(await d.streamDecoded(d.resolve({ t: "ref", n: 101, g: 0 })), "decoded")), Array.from(zeros));
});

test("R22: any other filter, or a malformed ASCII stream, is stated undecodable and never guessed", async () => {
  const z = flat();
  /** @type {StreamCase[]} */
  const bad = [
    { name: "LZWDecode", stream: { dict: "/Filter /LZWDecode", data: CONTENT } },
    { name: "ASCII85Decode then LZWDecode", stream: { dict: "/Filter [/ASCII85Decode /LZWDecode]", data: a85(z) } },
    { name: "RunLengthDecode", stream: { dict: "/Filter /RunLengthDecode", data: CONTENT } },
    { name: "an unknown filter name", stream: { dict: "/Filter [/ASCII85Decode /Mystery]", data: a85(z) } },
    { name: "Flate then ASCII85Decode", stream: { dict: "/Filter [/FlateDecode /ASCII85Decode]", data: a85(z) } },
    { name: "a character ASCII85 does not have", stream: { dict: "/Filter [/ASCII85Decode /FlateDecode]", data: a85(z).replace(/^./, "v") } },
    { name: "a lone final ASCII85 character", stream: { dict: "/Filter /ASCII85Decode", data: "87cURD]i,\"Ebo8~>".replace("Ebo8", "E") } },
    { name: "a character ASCIIHex does not have", stream: { dict: "/Filter [/ASCIIHexDecode /FlateDecode]", data: ahx(z).replace(/^./, "G") } },
  ];
  for (const { name, stream } of bad) {
    const r = await read(stream);
    assert.equal(page0(r).text, "", name);
    assert.deepEqual(page0(r).undetermined.map((m) => m.reason), ["content_stream_undecodable"], name);
    assert.ok(r.notes.includes("content_stream_undecodable"), name);
  }
});

test("R22 R12: a /ToUnicode map under ASCII85Decode and Flate is read, its characters decoded", async () => {
  const toUni = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange 1 beginbfrange <20> <7E> <0020> endbfrange end";
  const r = reading(await extractPdfStructure(doc([{ content: CONTENT }],
    { objs: { 11: { dict: "/Filter [/ASCII85Decode /FlateDecode]", data: a85(new Uint8Array(deflateSync(Buffer.from(toUni, "latin1")))) } } })));
  for (const w of WORDS) assert.ok(texts(r).includes(w), JSON.stringify(texts(r)));
  assert.deepEqual(r.text.undetermined, []);
});

test("R40 R22: pdfTitle reads an XMP title written under ASCII85Decode and Flate", () => {
  const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">Housing Notice</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta>`;
  const file = indexed({ 1: "<< /Type /Catalog /Pages 2 0 R /Metadata 4 0 R >>", 2: "<< /Type /Pages /Kids [] /Count 0 >>",
    4: { dict: "/Type /Metadata /Subtype /XML /Filter [/ASCII85Decode /FlateDecode]", data: a85(new Uint8Array(deflateSync(Buffer.from(xmp, "latin1")))) } },
  { trailer: "/Root 1 0 R" });
  assert.equal(pdfTitle(file), "Housing Notice");
});
