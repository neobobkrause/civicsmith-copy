/* doc-clean R10: a PDF copy writes every string from pdf-reader R38's `raw`, never rebuilt from its text `v`. Each
 * document is written by `fixtures.mjs`; the original and the copy are both read by pdf-reader (`openPdf`,
 * `objects`), never by this module, and every string the copy keeps is compared with the original's byte for byte. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanDocument } from "../../../src/doc-clean/index.mjs";
import { openPdf } from "../../../src/pdfstructure.mjs";
import { makePdf } from "./fixtures.mjs";
/** @import { CleanAnswer } from "../../../src/doc-clean/index.mjs" */
/** @import { PdfValue, PdfMap, PdfStr, PdfObjectEntry } from "../../../src/pdfstructure.mjs" */

/** @param {Uint8Array | number[]} bytes */
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const BINARY = Array.from({ length: 256 }, (_, i) => i);
const C1 = Array.from({ length: 32 }, (_, i) => 0x80 + i);
/** @param {number} b */
const octal = (b) => "\\" + b.toString(8).padStart(3, "0");

/** Each string under test: the key it is written at, its source, and the bytes a conforming reader reads from it.
 *  @type {[string, string, number[]][]} */
const STRINGS = [
  ["Binary", `<${hex(BINARY)}>`, BINARY],
  ["BinaryLiteral", `(${BINARY.map(octal).join("")})`, BINARY],
  ["OddFEFF", "<FEFF004142>", [0xfe, 0xff, 0x00, 0x41, 0x42]],
  ["OddFEFFDigit", "<FEFF00414>", [0xfe, 0xff, 0x00, 0x41, 0x40]],
  ["OddFEFFLiteral", "(\\376\\377\\000A\\000)", [0xfe, 0xff, 0x00, 0x41, 0x00]],
  ["C1", `(${C1.map(octal).join("")})`, C1],
  ["C1Hex", `<${hex(C1)}>`, C1],
  ["Ascii", "(Budget item one)", [...Buffer.from("Budget item one", "latin1")]],
];

/** A one-page PDF carrying every string of `STRINGS` in its page dictionary, again in an array and in a nested
 *  dictionary, and again in an indirect dictionary the page refers to, with `/Info` so the copy is written. */
function stringsPdf() {
  const direct = STRINGS.map(([k, src]) => `/${k} ${src}`).join(" ");
  return makePdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R ${direct} /List [${STRINGS.map(([, src]) => src).join(" ")}] /Nested << ${direct} >> /Held 5 0 R >>`,
    { dict: "<< >>", data: new TextEncoder().encode("q Q") },
    `<< ${direct} >>`,
    "<< /Author (Someone) >>",
  ], { trailer: "/Info 6 0 R" });
}

/** @param {CleanAnswer} r what a failed assertion on `r.ok` says */
const why = (r) => (r.ok ? undefined : r.detail);
/** @param {PdfValue | undefined} v @param {string} where @returns {PdfMap} */
function dictOf(v, where) {
  if (v === null || typeof v !== "object" || v.t !== "dict") throw new Error(`${where} is not a dictionary`);
  return v.map;
}
/** @param {PdfValue | undefined} v @param {string} where @returns {PdfStr} */
function strOf(v, where) {
  if (v === null || typeof v !== "object" || v.t !== "str") throw new Error(`${where} is not a string`);
  return v;
}
/** The page dictionary among `objects`, the first whose `/Type` is `Page`.
 *  @param {PdfObjectEntry[]} objects @returns {PdfMap} */
function pageOf(objects) {
  for (const o of objects) {
    const v = o.value;
    if (v === null || typeof v !== "object" || v.t !== "dict") continue;
    const type = v.map.Type;
    if (type !== null && typeof type === "object" && (type.t === "name" || type.t === "str") && type.v === "Page") return v.map;
  }
  throw new Error("no page dictionary");
}

/** Every string pdf-reader reads in `bytes`, by where it sits: `page.<key>`, `page.List.<i>`, `page.Nested.<key>`,
 *  `page.Held.<key>`, each its `raw` in hex.
 *  @param {Uint8Array} bytes @returns {Promise<Map<string, string>>} */
async function stringsOf(bytes) {
  const doc = await openPdf(bytes);
  assert.ok(doc, "pdf-reader opens it");
  const read = doc.objects();
  assert.ok(read, "pdf-reader reads its objects");
  assert.deepEqual(read.unresolved, []);
  /** @type {Map<number, PdfValue>} */
  const table = new Map(null);
  for (const o of read.objects) table.set(o.num, o.value);
  const page = pageOf(read.objects);
  /** @type {Map<string, string>} */
  const out = new Map(null);
  /** @param {string} where @param {PdfValue | undefined} v */
  const take = (where, v) => {
    assert.equal(v !== null && typeof v === "object" ? v.t : undefined, "str", where);
    const s = strOf(v, where);
    assert.ok(s.raw instanceof Uint8Array, where);
    out.set(where, hex(s.raw));
  };
  const held = page.Held;
  if (held === null || typeof held !== "object" || held.t !== "ref") throw new Error("page.Held is not a reference");
  for (const [k] of STRINGS) {
    take(`page.${k}`, page[k]);
    take(`page.Nested.${k}`, dictOf(page.Nested, "page.Nested")[k]);
    take(`page.Held.${k}`, dictOf(table.get(held.n), "page.Held")[k]);
  }
  const list = page.List;
  if (list === null || typeof list !== "object" || list.t !== "arr") throw new Error("page.List is not an array");
  list.items.forEach((v, i) => take(`page.List.${i}`, v));
  return out;
}

test("R10 a PDF copy writes every string from its raw bytes: a binary string (0x00-0xFF), an odd-length FE FF string and a string holding 0x80-0x9F, as hex and as literal, each read back byte for byte, in a dictionary, an array, a nested and an indirect dictionary", async () => {
  const original = stringsPdf();
  const before = await stringsOf(original);
  for (const [k, , bytes] of STRINGS) assert.equal(before.get(`page.${k}`), hex(bytes), `the fixture's ${k} reads as intended`);
  const r = await cleanDocument(original);
  assert.equal(r.ok, true, why(r));
  assert.equal(r.clean, false, "the trailer's /Info makes a copy");
  const after = await stringsOf(r.bytes);
  assert.deepEqual(after, before, "every string the copy keeps is the original's, byte for byte");
  for (const [k, , bytes] of STRINGS) {
    assert.equal(after.get(`page.${k}`), hex(bytes), k);
    assert.equal(after.get(`page.List.${STRINGS.findIndex(([x]) => x === k)}`), hex(bytes), `${k} in an array`);
  }
});

test("R10 negative control: an ASCII string is unchanged, its text and its bytes, and an odd-length FE FF string keeps its last byte where its text cannot", async () => {
  const r = await cleanDocument(stringsPdf());
  if (!r.ok || r.clean) throw new Error("expected a copy");
  const doc = await openPdf(r.bytes);
  assert.ok(doc, "pdf-reader opens it");
  const read = doc.objects();
  assert.ok(read, "pdf-reader reads its objects");
  const page = pageOf(read.objects);
  const ascii = strOf(page.Ascii, "page.Ascii");
  assert.equal(ascii.v, "Budget item one");
  assert.deepEqual([...ascii.raw], [...Buffer.from("Budget item one", "latin1")]);
  assert.deepEqual([...strOf(page.OddFEFF, "page.OddFEFF").raw], [0xfe, 0xff, 0x00, 0x41, 0x42], "the fifth byte, which no UTF-16 text holds, is kept");
});

test("R10 a copy written twice is the same: the strings of a copy, cleaned again, read back unchanged", async () => {
  const once = await cleanDocument(stringsPdf());
  if (!once.ok || once.clean) throw new Error("expected a copy");
  const twice = await cleanDocument(makePdfWithInfo(once.bytes));
  assert.equal(twice.ok, true, why(twice));
  if (!twice.ok || twice.clean) throw new Error("expected a copy");
  assert.deepEqual(await stringsOf(twice.bytes), await stringsOf(once.bytes));
});

/** `copy` with an incremental update adding a trailer `/Info`, so cleaning it writes a copy again.
 *  @param {Uint8Array} copy @returns {Uint8Array} */
function makePdfWithInfo(copy) {
  const s = Buffer.from(copy).toString("latin1");
  const sizeMatch = /\/Size (\d+)/.exec(s.slice(s.lastIndexOf("trailer")));
  const prevMatch = /startxref\s+(\d+)/.exec(s.slice(s.lastIndexOf("startxref")));
  if (!sizeMatch || !prevMatch) throw new Error("the copy states no /Size or startxref");
  const size = Number(sizeMatch[1]);
  const prev = Number(prevMatch[1]);
  const obj = Buffer.from(`${size} 0 obj\n<< /Author (Someone) >>\nendobj\n`, "latin1");
  const at = copy.length;
  const tail = `xref\n${size} 1\n${String(at).padStart(10, "0")} 00000 n \ntrailer\n<< /Size ${size + 1} /Root 1 0 R /Info ${size} 0 R /Prev ${prev} >>\nstartxref\n${at + obj.length}\n%%EOF\n`;
  return new Uint8Array(Buffer.concat([Buffer.from(copy), obj, Buffer.from(tail, "latin1")]));
}
