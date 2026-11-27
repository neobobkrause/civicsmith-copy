/* pdf-reader tests: PDFs written the way real producers write them, WITH an
 * xref (a classic table or a cross-reference stream, objects optionally packed
 * in an object stream, revisions appended with /Prev), for R40's `pdfTitle`,
 * which reads through the xref where R8's reader does not need one. Built from
 * text here, never from any one jurisdiction's documents (R29). */
import { deflateSync } from "node:zlib";
import { bytesOf } from "./pdf.mjs";
/** @import { Text } from "./pdf.mjs" */

/** A stream object's recipe for `indexed`: `dict` the entries without `<< >>` (the /Length is written), `data` its bytes.
 *  @typedef {Object} IndexedStream
 *  @property {string} [dict] the dictionary's entries, absent is none
 *  @property {Text} [data] the stream's bytes, absent is none
 */
/** One object's recipe for `indexed`: a string body, or a stream.
 *  @typedef {string | IndexedStream} IndexedBody */
/** A revision's objects by object number.
 *  @typedef {Record<string, IndexedBody>} IndexedObjects */
/** How `indexed` writes a revision.
 *  @typedef {Object} IndexedOptions
 *  @property {"table" | "stream"} [xref] a classic table (absent) or a cross-reference stream
 *  @property {number[] | number[][]} [packed] the numbers of plain objects written inside one object stream, or a list of
 *    lists for several
 *  @property {string} [trailer] the trailer's entries beside /Size, absent is `/Root 1 0 R`
 *  @property {Uint8Array | null} [prev] the earlier file's bytes this revision is appended to, absent or null is none
 *  @property {number} [level] the zlib level of the streams this writes (0 stores), absent is 6
 *  @property {string} [header] the first line(s) of a first revision, absent is `%PDF-1.7`
 *  @property {number} [objStmNum] the first object stream's number, absent is 900
 *  @property {number} [xrefNum] the cross-reference stream's number, absent is 990
 *  @property {boolean} [predictor] whether the cross-reference stream's rows are PNG-predicted, absent is true
 *  @property {string} [junkAfter] text after a cross-reference stream's `%%EOF`
 */
/** Where an object is: at a byte offset (`type` 1), or the `idx`th object of object stream `stm` (`type` 2).
 *  @typedef {{ type: 1, off: number } | { type: 2, stm: number, idx: number }} XrefEntry */

/** The parts one after another.
 *  @param {Uint8Array[]} parts
 *  @returns {Uint8Array} */
const cat = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
};
/** `n` in decimal, padded with zeros to `w` digits.
 *  @param {number} n
 *  @param {number} w
 *  @returns {string} */
const pad = (n, w) => String(n).padStart(w, "0");
/** `n` as `w` big-endian bytes.
 *  @param {number} n
 *  @param {number} w
 *  @returns {number[]} */
const be = (n, w) => Array.from({ length: w }, (_, i) => Math.floor(n / 2 ** (8 * (w - 1 - i))) & 0xff);

/** PNG "Up" predictor (12) over rows of `cols` bytes.
 *  @param {number[][]} rows
 *  @param {number} cols
 *  @returns {Uint8Array} */
function predictUp(rows, cols) {
  /** @type {number[]} */
  const out = [];
  /** @type {number[]} */
  let prev = Array.from({ length: cols }, () => 0);
  for (const r of rows) { const above = prev; out.push(2, ...r.map((v, i) => (v - (above[i] ?? 0)) & 0xff)); prev = r; }
  return Uint8Array.from(out);
}

/** A recipe as an object: a string body as `{ text }`.
 *  @param {IndexedBody} b
 *  @returns {IndexedStream | { text: string }} */
const body = (b) => (typeof b === "string" ? { text: b } : b);

/** The object streams' numbers: `packed` itself when it is a list of lists, one list of it when it is numbers, none
 *  when it is empty.
 *  @param {number[] | number[][]} packed
 *  @returns {number[][]} */
function groupsOf(packed) {
  /** @type {number[][]} */
  const lists = [];
  /** @type {number[]} */
  const nums = [];
  for (const p of packed) { if (Array.isArray(p)) lists.push(p); else nums.push(p); }
  return lists.length ? lists : nums.length ? [nums] : [];
}

/** The recipe of object `n`; a thrown failure when `objs` has none.
 *  @param {IndexedObjects} objs
 *  @param {number} n
 *  @returns {IndexedBody} */
function bodyOf(objs, n) {
  const b = objs[n];
  if (b === undefined) throw new TypeError(`no object ${n}`);
  return b;
}

/** `objs`: { num: "<< dict >>" | { dict, data } }. `packed`: object numbers (plain
 *  values, no streams) written inside one object stream. `xref`: "table" | "stream".
 *  `trailer`: the entries beside /Size (default `/Root 1 0 R`). `prev`: the earlier
 *  file's bytes, which this revision is appended to (its startxref becomes /Prev).
 *  `level`: the zlib level of the streams this writes (0 stores).
 *  @param {IndexedObjects} objs
 *  @param {IndexedOptions} [options]
 *  @returns {Uint8Array} */
export function indexed(objs, { xref = "table", packed = [], trailer = "/Root 1 0 R", prev = null, level = 6,
  header = "%PDF-1.7\n", objStmNum = 900, xrefNum = 990, predictor = true, junkAfter = "" } = {}) {
  const first = prev ?? bytesOf(header);
  const parts = [first];
  let pos = first.length;
  /** @param {Uint8Array} b */
  const add = (b) => { parts.push(b); pos += b.length; };
  /** @type {[number, XrefEntry][]} */
  const none = [];
  const entries = new Map(none); // num -> {type:1, off} | {type:2, stm, idx}
  /* `packed` is one object stream's numbers, or a list of lists for several (numbered objStmNum, objStmNum + 1, ...) */
  const groups = groupsOf(packed);
  const loose = Object.keys(objs).map(Number).filter((n) => !groups.flat().includes(n));
  for (const n of loose) {
    entries.set(n, { type: 1, off: pos });
    const b = bodyOf(objs, n);
    if (typeof b === "string") add(bytesOf(`${n} 0 obj\n${b}\nendobj\n`));
    else {
      const data = bytesOf(b.data ?? "");
      add(bytesOf(`${n} 0 obj\n<< ${b.dict ?? ""} /Length ${data.length} >>\nstream\n`)); add(data); add(bytesOf("\nendstream\nendobj\n"));
    }
  }
  groups.forEach((group, g) => {
    const stmNum = objStmNum + g;
    let head = "", bodies = "";
    group.forEach((n, i) => { head += `${n} ${bodies.length} `; bodies += String(objs[n]) + "\n"; entries.set(n, { type: 2, stm: stmNum, idx: i }); });
    const raw = bytesOf(head + bodies);
    const data = new Uint8Array(deflateSync(raw, { level }));
    entries.set(stmNum, { type: 1, off: pos });
    add(bytesOf(`${stmNum} 0 obj\n<< /Type /ObjStm /N ${group.length} /First ${head.length} /Filter /FlateDecode /Length ${data.length} >>\nstream\n`));
    add(data); add(bytesOf("\nendstream\nendobj\n"));
  });
  const size = Math.max(...entries.keys(), prev ? 0 : 0, xrefNum) + 1;
  const xrefAt = pos;
  if (xref === "table") {
    const sorted = [...entries].sort((a, b) => a[0] - b[0]);
    let t = "xref\n";
    if (!prev) {
      t += `0 1\n0000000000 65535 f \n`;
    }
    for (const [n, e] of sorted) {
      if (e.type !== 1) continue; // a table cannot say "compressed"
      t += `${n} 1\n${pad(e.off, 10)} 00000 n \n`;
    }
    t += `trailer\n<< /Size ${size} ${trailer}${prev ? ` /Prev ${prevStartxref(prev)}` : ""} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    add(bytesOf(t));
  } else {
    entries.set(xrefNum, { type: 1, off: xrefAt });
    const sorted = [...entries].sort((a, b) => a[0] - b[0]);
    /** @type {[number, number, number]} */
    const w = [1, 4, 2];
    const cols = w[0] + w[1] + w[2];
    /** @type {number[][]} */
    const rows = [];
    /** @type {string[]} */
    const index = [];
    for (const [n, e] of sorted) {
      rows.push(e.type === 1 ? [1, ...be(e.off, 4), ...be(0, 2)] : [2, ...be(e.stm, 4), ...be(e.idx, 2)]);
      index.push(`${n} 1`);
    }
    const flat = predictor ? predictUp(rows, cols) : Uint8Array.from(rows.flat());
    const data = new Uint8Array(deflateSync(flat, { level }));
    const parms = predictor ? `/DecodeParms << /Columns ${cols} /Predictor 12 >> ` : "";
    add(bytesOf(`${xrefNum} 0 obj\n<< /Type /XRef /Size ${size} /W [${w.join(" ")}] /Index [${index.join(" ")}] ${trailer}`
      + `${prev ? ` /Prev ${prevStartxref(prev)}` : ""} /Filter /FlateDecode ${parms}/Length ${data.length} >>\nstream\n`));
    add(data);
    add(bytesOf(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n${junkAfter}`));
  }
  return cat(parts);
}

/** The byte offset the last `startxref` of `bytes` names.
 *  @param {Uint8Array} bytes
 *  @returns {number} */
function prevStartxref(bytes) {
  const s = Buffer.from(bytes).toString("latin1");
  const i = s.lastIndexOf("startxref");
  return parseInt(s.slice(i + 9).trim(), 10);
}

/** A literal string's PDF text-string forms the tests share.
 *  @param {string} s
 *  @returns {string} */
export const utf16hex = (s) => "<FEFF" + Buffer.from(s, "utf16le").swap16().toString("hex") + ">";
