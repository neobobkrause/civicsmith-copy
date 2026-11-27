/* pdf-reader tests: a hand-built PDF writer. Every fixture these tests read is
 * built here from text, never taken from any one jurisdiction's documents
 * (R29). The reader is xref-free (R8), so no xref table is written. */
import { deflateSync, deflateRawSync } from "node:zlib";

/** Text of a fixture, as a string (read as Latin-1, one byte a character) or as bytes.
 *  @typedef {string | Uint8Array} Text */
/** A stream object's recipe: `dict` the entries without `<< >>`; `/Length` is written unless `length` overrides it,
 *  `length: null` omits it; `noEnd` leaves out `endstream` and `endobj`.
 *  @typedef {Object} StreamBody
 *  @property {string} [dict] the dictionary's entries, absent is none
 *  @property {Text} [data] the stream's bytes, absent is none
 *  @property {number | null} [length] the /Length written, absent is the data's length, null writes none
 *  @property {boolean} [noEnd] true ends the stream with a newline and no `endstream` / `endobj`
 */
/** One object's recipe: a string body, or a stream.
 *  @typedef {string | StreamBody} ObjectBody */
/** A file's objects by object number.
 *  @typedef {Record<string, ObjectBody>} Objects */
/** How `build` writes the file around its objects.
 *  @typedef {Object} BuildOptions
 *  @property {string} [header] the first line(s), absent is `%PDF-1.7`
 *  @property {string} [trailer] the trailer, absent is one naming 1 0 R as /Root
 *  @property {number[]} [order] the object numbers in the order written (a number twice writes it twice), absent is key order
 *  @property {string} [tail] text written after the trailer, before `%%EOF`
 */
/** One page of `doc`.
 *  @typedef {Object} Page
 *  @property {string | StreamBody} [content] its one content stream: a string is the stream's data
 *  @property {string} [resources] the entries of its /Resources dict, absent is the fonts
 *  @property {string} [extra] more page entries
 *  @property {string} [contents] a /Contents value that replaces the generated one (no content object is written)
 *  @property {string} [box] the page-box entries, absent is a 600x800 /MediaBox
 */
/** How `doc` writes the document: the objects it adds or replaces, more catalog and page-tree entries, and `build`'s
 *  options.
 *  @typedef {Object} DocOptions
 *  @property {Objects} [objs] objects added, or replacing the generated ones
 *  @property {string} [catalog] more catalog entries
 *  @property {string} [pagesExtra] more page-tree entries
 *  @property {string} [header] as `build`'s
 *  @property {string} [trailer] as `build`'s
 *  @property {number[]} [order] as `build`'s
 *  @property {string} [tail] as `build`'s
 */

/** The bytes of `s`: itself when it is bytes, else its characters as Latin-1.
 *  @param {Text} s
 *  @returns {Uint8Array} */
export const bytesOf = (s) => (s instanceof Uint8Array ? s : new Uint8Array(Buffer.from(s, "latin1")));
/** `s` zlib-compressed (FlateDecode).
 *  @param {Text} s
 *  @returns {Uint8Array} */
export const flate = (s) => new Uint8Array(deflateSync(bytesOf(s)));
/** `s` deflated with no zlib wrapper.
 *  @param {Text} s
 *  @returns {Uint8Array} */
export const flateRaw = (s) => new Uint8Array(deflateRawSync(bytesOf(s)));

/** The recipe of object `n`; a thrown failure when `objs` has none.
 *  @param {Objects} objs
 *  @param {number} n
 *  @returns {ObjectBody} */
function bodyOf(objs, n) {
  const body = objs[n];
  if (body === undefined) throw new TypeError(`no object ${n}`);
  return body;
}

/** One object: a string body, or `{ dict, data }` for a stream (`dict` the
 *  entries without `<< >>`; `/Length` is written unless `length` overrides it,
 *  `length: null` omits it).
 *  @param {number} num
 *  @param {ObjectBody} body
 *  @returns {Uint8Array[]} */
function objectBytes(num, body) {
  if (typeof body === "string") return [bytesOf(`${num} 0 obj\n${body}\nendobj\n`)];
  const data = bytesOf(body.data ?? "");
  const length = body.length;
  const len = length === undefined ? ` /Length ${data.length}` : length === null ? "" : ` /Length ${length}`;
  return [
    bytesOf(`${num} 0 obj\n<< ${body.dict ?? ""}${len} >>\nstream\n`),
    data,
    bytesOf(body.noEnd ? "\n" : "\nendstream\nendobj\n"),
  ];
}

/** A whole file from `{ num: body }`, in key order unless `order` is given.
 *  @param {Objects} objs
 *  @param {BuildOptions} [options]
 *  @returns {Uint8Array} */
export function build(objs, { header = "%PDF-1.7\n", trailer = "trailer\n<< /Root 1 0 R >>\n", order, tail = "" } = {}) {
  const parts = [bytesOf(header)];
  for (const n of order ?? Object.keys(objs).map(Number)) parts.push(...objectBytes(n, bodyOf(objs, n)));
  parts.push(bytesOf(trailer + tail + "%%EOF\n"));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

/* A simple font whose codes 0x20-0x7E map to themselves and are each 0.5 em
 * wide; F2 is the same font with no /Widths, so its advance is unknown. */
const TOUNI = "/CIDInit /ProcSet findresource begin 1 begincodespacerange <00> <FF> endcodespacerange "
  + "1 beginbfrange <20> <7E> <0020> endbfrange end";
/** The fonts' objects, 10 to 12.
 *  @type {Objects} */
export const FONT_OBJS = {
  10: `<< /Type /Font /Subtype /TrueType /BaseFont /Plain /FirstChar 32 /Widths [${Array.from({ length: 95 }, () => 500).join(" ")}] /ToUnicode 11 0 R >>`,
  11: { data: TOUNI },
  12: "<< /Type /Font /Subtype /TrueType /BaseFont /NoWidths /ToUnicode 11 0 R >>",
};
/** The /Font entry of a /Resources dict naming F1 and F2. */
export const FONTS = "/Font << /F1 10 0 R /F2 12 0 R >>";

/** A document of pages. Each page is `{ content, resources, extra, contents }`:
 *  `content` a string (or `{dict,data}`) for its one content stream, `resources`
 *  the entries of its /Resources dict (default: the fonts), `extra` more page
 *  entries, `contents` a /Contents value that replaces the generated one, `box`
 *  the page-box entries (default a 600x800 /MediaBox).
 *  Page i is object 100+2i and its content 101+2i.
 *  @param {Page[]} pages
 *  @param {DocOptions} [options]
 *  @returns {Uint8Array} */
export function doc(pages, { objs = {}, catalog = "", pagesExtra = "", ...opts } = {}) {
  /** @type {Objects} */
  const all = {};
  all[1] = `<< /Type /Catalog /Pages 2 0 R ${catalog} >>`;
  for (const [k, v] of Object.entries(FONT_OBJS)) all[k] = v;
  /** @type {string[]} */
  const kids = [];
  pages.forEach((p, i) => {
    const pn = 100 + 2 * i, cn = pn + 1;
    kids.push(`${pn} 0 R`);
    const res = p.resources ?? FONTS;
    const contents = p.contents ?? `${cn} 0 R`;
    all[pn] = `<< /Type /Page /Parent 2 0 R ${p.box ?? "/MediaBox [0 0 600 800]"} /Resources << ${res} >> /Contents ${contents} ${p.extra ?? ""} >>`;
    const content = p.content;
    if (p.contents == null) all[cn] = typeof content === "object" ? content : { data: content ?? "" };
  });
  all[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} ${pagesExtra} >>`;
  for (const [k, v] of Object.entries(objs)) all[k] = v;
  return build(all, opts);
}

/** A PDF string literal's hex form, for text the tests do not want escaped.
 *  @param {string} s
 *  @returns {string} */
export const hex = (s) => "<" + Buffer.from(s, "latin1").toString("hex") + ">";
