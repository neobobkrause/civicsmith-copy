/* The values a workbook file cached for its formula cells, read independently of the engine, so the suite can hold
 * the engine's recomputed values against the file's own (R15). A helper, not a suite. Reads the zip's central
 * directory and inflates with node:zlib; reads the XML with regular expressions, enough for the fixtures here.
 */
import { inflateRawSync } from "node:zlib";
/** @import { AnswerCell } from '../src/member.mjs' */

/**
 * @typedef {{ type: "text", value: string | undefined } | { type: "boolean", value: boolean }
 *   | { type: "error", value: string } | { type: "number", value: number }} CachedValue the value a file cached for a
 *   formula cell; a text read through a shared-string index outside the table is undefined
 */

/** The parts of a zip, by name, each inflated when it was deflated. @param {Uint8Array} bytes @returns {Map<string, Buffer>} */
export function unzip(bytes) {
  const b = Buffer.from(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  const count = b.readUInt16LE(eocd + 10);
  let at = b.readUInt32LE(eocd + 16);
  /** @type {Map<string, Buffer>} */
  const files = new Map([]);
  for (let n = 0; n < count; n++) {
    const method = b.readUInt16LE(at + 10), csize = b.readUInt32LE(at + 20);
    const nlen = b.readUInt16LE(at + 28), xlen = b.readUInt16LE(at + 30), clen = b.readUInt16LE(at + 32);
    const local = b.readUInt32LE(at + 42);
    const name = b.toString("utf8", at + 46, at + 46 + nlen);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + csize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));
    at += 46 + nlen + xlen + clen;
  }
  return files;
}

/* XML end-of-line handling first (a literal CR LF or CR reads as LF), then the references, which may produce a CR. */
/** @param {string} s @returns {string} */
const unesc = (s) => s.replace(/\r\n?/g, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (/** @type {string} */ _, /** @type {string} */ d) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (/** @type {string} */ _, /** @type {string} */ h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, "&");
/** Group `i` of a match, one that always takes part when the expression matched.
 *  @param {RegExpMatchArray} m @param {number} i @returns {string} */
const group = (m, i) => { const g = m[i]; if (g === undefined) throw new Error(`group ${i} did not take part`); return g; };
/** @param {string} tag @param {string} name @returns {string | null} */
const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? unesc(group(m, 1)) : null; };

/** Map "Sheet!A1" → {type, value} for every cell carrying <f> and a cached <v>.
 *  @param {Uint8Array} bytes @returns {Map<string, CachedValue>} */
export function cachedFormulaValues(bytes) {
  const files = unzip(bytes);
  /** @param {string} p @returns {string} */
  const text = (p) => { const part = files.get(p); if (!part) throw new Error(`no part ${p}`); return part.toString("utf8"); };
  /** @type {string[]} */
  const shared = [];
  if (files.has("xl/sharedStrings.xml"))
    for (const si of text("xl/sharedStrings.xml").matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g))
      shared.push([...group(si, 1).matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => unesc(group(m, 1))).join(""));
  /** @type {Map<string | null, string | null>} */
  const rels = new Map([]);
  for (const m of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) rels.set(attr(m[0], "Id"), attr(m[0], "Target"));
  /** @type {Map<string, CachedValue>} */
  const out = new Map([]);
  for (const s of text("xl/workbook.xml").matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = attr(s[0], "name");
    const target = rels.get(attr(s[0], "r:id"));
    if (target == null) throw new Error(`no relationship for sheet ${name}`);
    const part = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    if (!files.has(part)) continue;
    for (const c of text(part).matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const body = c[2] || "";
      if (!/<(?:\w+:)?f\b/.test(body)) continue;
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body);
      if (!v) continue;
      const t = attr(group(c, 1), "t") || "n", raw = unesc(group(v, 1));
      const ref = `${name}!${attr(group(c, 1), "r")}`;
      if (t === "s") out.set(ref, { type: "text", value: shared[Number(raw)] });
      else if (t === "str" || t === "inlineStr") out.set(ref, { type: "text", value: raw });
      else if (t === "b") out.set(ref, { type: "boolean", value: raw === "1" });
      else if (t === "e") out.set(ref, { type: "error", value: raw });
      else out.set(ref, { type: "number", value: Number(raw) });
    }
  }
  return out;
}

/** Whether a recomputed cell agrees with the cached one: numbers to a relative 1e-9, everything else exactly.
 *  @param {AnswerCell} cell @param {CachedValue} cached @returns {boolean} */
export function agrees(cell, cached) {
  if (cell.type !== cached.type) return false;
  if (cell.type === "number" && cached.type === "number") {
    /* the number arithmetic reads the cell's value as (`-` and Math.abs convert it the same way) */
    const a = Number(cell.value), b = cached.value;
    return cell.value === b || Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
  }
  return cell.value === cached.value;
}
