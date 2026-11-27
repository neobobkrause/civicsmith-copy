/* Structure inside PDFs: the outbound-link graph (D-91, phase 1).
 *
 * CONTENT-PDF CONSUMES bytes (I1) and PRODUCES structure. This module is the
 * cheap, no-font half of that: it reads assembled PDF bytes and characterises
 * a document's outbound links into the SAME partitions HTML uses, so structure
 * is container-agnostic. It is the PDF analog of `subresources.mjs`'s link
 * classification, not a second link system, and it emits BYTE-IDENTICAL
 * wrappers by importing `linkWrapper`/`LINK_TYPES` from that file rather than
 * re-deriving them — the one way drift cannot happen. (`pdfstructure.test.mjs`
 * still asserts the parity, so a future local reimplementation that drifts is
 * caught.)
 *
 * The doctrine that shapes every line: a link we cannot resolve is recorded as
 * `undetermined`, never dropped and never invented. `undetermined` is
 * first-class (CLAUDE.md). A PDF whose structure is ambiguous says so.
 *
 * What phase 1 maps (D-91's measured table):
 *   /Annots /Subtype /Link with /A /S /URI     -> deferred (http/https)
 *                                              -> refused  (mailto:, javascript:, ...)
 *   /A /S /GoTo and /Dest destinations         -> anchor (target page + element ref)
 *   embedded / attached files                  -> intra (content-addressed), else undetermined
 *   element reference                          -> source page index + annotation /Rect
 *
 * The prose/content half is TIERED (D-91). Tier 1 lives HERE, pure JS, no
 * dependency (QUEUE CPDF-4): it walks each page's content stream(s), reads the
 * text-showing operators (Tj, TJ, and the '/" line variants), and decodes the
 * shown bytes to Unicode through each font's /ToUnicode CMap (beginbfchar /
 * bfrange). It reuses the same object/stream parser the link half uses. The
 * SAME first-class-undetermined doctrine governs it: a run shown by a font with
 * no /ToUnicode (a CID font is the canonical case), or a code that maps to
 * nothing, is recorded as `undetermined` NAMING the cause (the font) and its
 * bytes are NEVER guessed into readable text — no mojibake, per region. Tier 2
 * (`unpdf`/pdf.js, for the residue Tier 1 cannot decode) is a separate fleet
 * Worker (I6, CPDF-6) and does not live here.
 *
 * AND WHO MADE THAT LAYER (D-251). The text shape carries a `producer` field
 * read from the trailer's /Info: a layer whose producer NAMES OCR software is
 * recorded as such WITH THE PRODUCT NAMED, and a layer with no such marker
 * stays `undetermined` — never "authored", because an absent marker is an
 * absent marker. The classification may only ever make the claim WEAKER. See
 * the D-251 block below for the whole argument; it is the reason this is a
 * DETECTOR and not a lookup table of product names.
 *
 * No DOM, no Worker bindings, no bundled dependency. FlateDecode is the native
 * DecompressionStream("deflate"). The parser is LENIENT by design: rather than
 * trust a possibly-broken xref, it brute-force scans every `N G obj` in the
 * file AND every object inside every /ObjStm object stream, so a modern
 * xref-stream PDF (what Legistar/OpenGov serve) is never silently empty.
 */

import { LINK_TYPES, linkWrapper } from "./subresources.mjs";
import { word } from "./setup-words/index.mjs";
import { boundOf } from "./read-bounds.mjs";

/* ------------------------------------------------------------------ *
 * The kinds this module reads and answers (S4)
 * ------------------------------------------------------------------ */

/** A PDF name value, `/Type` read as `{ t: "name", v: "Type" }` (its `#xx` escapes decoded). One frozen object per distinct
 *  name, shared (R37).
 *  @typedef {{ readonly t: "name", readonly v: string }} PdfName */
/** A PDF string value (R38): `raw` the bytes the file states, `v` its text (UTF-16BE after `FE FF`, else a byte a unit).
 *  @typedef {{ t: "str", v: string, raw: Uint8Array }} PdfStr */
/** An indirect reference `N G R`.
 *  @typedef {{ t: "ref", n: number, g: number }} PdfRef */
/** A PDF array.
 *  @typedef {{ t: "arr", items: PdfValue[] }} PdfArr */
/** A dictionary's entries by key (no inherited key: a `constructor` or `__proto__` key is an ordinary one).
 *  @typedef {{ [key: string]: PdfValue }} PdfMap */
/** A PDF dictionary.
 *  @typedef {{ t: "dict", map: PdfMap }} PdfDict */
/** A stream: its dictionary and where its data starts in the file (or in the decoded object stream it was read from).
 *  @typedef {{ t: "stream", dict: PdfMap, start: number }} PdfStream */
/** Every value the lenient reader answers: a number, a boolean and null are themselves.
 *  @typedef {null | boolean | number | PdfName | PdfStr | PdfRef | PdfArr | PdfDict | PdfStream} PdfValue */
/** One value parsed from text, and where the text after it begins.
 *  @typedef {{ value: PdfValue, pos: number }} Parsed */
/** A stream's dictionary parsed, its data to follow at `pos`.
 *  @typedef {{ value: PdfStream, pos: number, streamPending: true }} ParsedStream */

/** A content-stream token (R11): a shown string's raw bytes, a number, a name, an operator, or a delimiter.
 *  @typedef {{ t: "str", bytes: Uint8Array }} TokStr */
/** @typedef {{ t: "num", v: number }} TokNum */
/** @typedef {{ t: "name", v: string }} TokName */
/** @typedef {{ t: "op", v: string }} TokOp */
/** @typedef {{ t: "dict_open" } | { t: "dict_close" } | { t: "arr_open" } | { t: "arr_close" }} TokMark */
/** @typedef {TokStr | TokNum | TokName | TokOp | TokMark} ContentToken */
/** @typedef {{ inlineImages?: boolean }} TokenizeOptions */

/** What a stream is read for, which decides the cap it is held to (R22).
 *  @typedef {"page_content" | "object_stream" | "cmap" | "embedded_file" | "image"} StreamKind */
/** A stream that passed the cap of its kind (R22): the bytes counted and the bound.
 *  @typedef {{ kind: StreamKind, size: number, bound: number }} OverBound */
/** `_decode`'s answer: the bytes, or none and, when the cap stopped it, why.
 *  @typedef {{ data: Uint8Array } | { data: null } | { data: null, over: OverBound }} Decoded */
/** A page's content streams, decoded and joined, and what of them could not be read (R25); `over` when they pass the page
 *  bound (R41).
 *  @typedef {{ data: Uint8Array, unread: string[], over?: { size: number, bound: number } }} PageContent */

/** The marker for a place tier 1 could not read (R9, R11-R14, R25-R27, R34, R41): `page` 0-based, or null for the document;
 *  `reason` the kind of unread thing; `font` the font named; `codes` the undecoded bytes in hex (64 at most, `…` beyond);
 *  `count` the characters or codes it covers. R41's `size`/`bound`, R26's `image_share`/`glyphs` and R34's
 *  `rect`/`area_share` ride on their own markers.
 *  @typedef {{
 *    readonly page: number | null, readonly reason: string, readonly font: string | null, readonly codes: string,
 *    readonly count: number, readonly size?: number, readonly bound?: number, readonly image_share?: number | null,
 *    readonly glyphs?: number, readonly rect?: number[], readonly area_share?: number | null
 *  }} Marker */
/** One page's tier-1 text and its markers.
 *  @typedef {{ page: number, text: string, undetermined: Marker[] }} PageText */
/** The text's counts: characters of `document`, and markers.
 *  @typedef {{ chars: number, undetermined: number }} TextCounts */
/** Who made the text layer (R10, D-251): an OCR product the file names, or undetermined and why.
 *  @typedef {Readonly<{ engine: string, field: "producer" | "creator", marker: string }>} OcrMarker */
/** @typedef {Readonly<{
 *    producer: string | null, creator: string | null, determination: "ocr" | "undetermined", ocr: OcrMarker | null,
 *    why: string | null
 *  }>} Producer */
/** `classifyProducer`'s argument: the two fields as the file states them, or the cause the metadata cannot be trusted.
 *  @typedef {{ producer?: string | null, creator?: string | null, unreadable?: string | null }} ProducerFields */
/** Tier 1 text (R9-R15): every non-empty page's text joined by "\n", each page, every marker, the counts, the producer.
 *  @typedef {{ document: string, pages: PageText[], undetermined: Marker[], counts: TextCounts, producer: Producer }} PdfText */

/** A link's element reference: its page and its annotation's `/Rect` (null when absent or malformed).
 *  @typedef {{ page: number, rect: number[] | null }} LinkSource */
/** R35: the text a link sits over, or null and why; tier 1's reading always.
 *  @typedef {{ text: string | null, why: string | null, tier: 1 }} LinkAnchor */
/** @typedef {{ partition: "deferred" | "refused", wrapper: string, target: { url: string }, source: LinkSource,
 *    anchor?: LinkAnchor }} UriLink */
/** @typedef {{ partition: "anchor", wrapper: string, target: { page: number, fragment: string, dest: string | null },
 *    source: LinkSource, anchor?: LinkAnchor }} AnchorLink */
/** @typedef {{ partition: "intra", wrapper: string, target: { sha256: string, name: string | null, bytes: number },
 *    source: LinkSource | null, anchor?: LinkAnchor }} IntraLink */
/** R3-R6's `undetermined` record's target: why, and the name or destination when known.
 *  @typedef {{ why: string, name?: string | null, dest?: string | undefined }} UndeterminedTarget */
/** @typedef {{ name?: string | null, dest?: string | undefined }} UndeterminedExtra */
/** Where an undetermined record was found: an annotation's page and rect, or (a document-level embedded file that could not
 *  be resolved) `{ page: null, rect: null }`.
 *  @typedef {{ page: number | null, rect: number[] | null }} LinkPlace */
/** @typedef {{ partition: "undetermined", wrapper: null, target: UndeterminedTarget, source: LinkPlace | null,
 *    anchor?: LinkAnchor }} UndeterminedLink */
/** One outbound link (R3-R6, R35): its partition, wrapper, target and source; `anchor` is on every record
 *  `extractPdfStructure` answers.
 *  @typedef {UriLink | AnchorLink | IntraLink | UndeterminedLink} LinkRecord */
/** R7: the links of each partition, all five keys always.
 *  @typedef {{ anchor: number, intra: number, deferred: number, refused: number, undetermined: number }} LinkCounts */

/** One image a page paints (R16): the IC-1 `image` reference and what the placement says of the image.
 *  @typedef {{
 *    kind: "image", ref: string, page: number, rect: number[], mime: string | null, name: string | null, inline: boolean,
 *    width: number | null, height: number | null, filters: string[], axis_aligned: boolean
 *  }} ImagePlacement */
/** The fields of a placement beside its reference.
 *  @typedef {{
 *    mime: string | null, name: string | null, inline: boolean, width: number | null, height: number | null,
 *    filters: string[], axis_aligned: boolean
 *  }} PlacementFields */
/** The IC-1 `image` reference alone (`pdfImageRef` with no fields beside it).
 *  @typedef {{ kind: "image", ref: string, page: number, rect: number[] }} ImageRef */
/** R32: the stream behind one placement (null for an inline image) and its composed CTM.
 *  @typedef {{ stream: PdfStream | null, ctm: number[] }} PlacementSource */
/** R16/R17: a page's images, or null and why (never a partial list).
 *  @typedef {{ images: ImagePlacement[], why: null } | { images: null, why: string }} PageImages */

/** R33: one distinct page box. @typedef {{ media_box: number[], w: number, h: number, rotate: number | null }} PageBox */
/** R33: every distinct box, and each page's index into them (null where its box cannot be read).
 *  @typedef {{ boxes: PageBox[], of_page: (number | null)[] }} PageBoxes */

/** R36: where an active item sits: the object holding it, its page, and its key.
 *  @typedef {{ object: number, page: number | null, key: string }} ActiveWhere */
/** R36's `detail`: an action's /S, the trigger keys, a target, a name, the security handler's /R.
 *  @typedef {string | string[] | number | null} ActiveDetail */
/** R36: one place the file can act when it is opened, or a part that could not be read (`unread`, `where` null).
 *  @typedef {{ kind: string, where: ActiveWhere | null, detail: ActiveDetail }} ActiveItem */
/** @typedef {(kind: string, key: string, detail: ActiveDetail) => void} ActiveEmit */

/** R39: the document's title, when it has one, from its `/Info`.
 *  @typedef {{ title?: string, source: "/Info" }} PdfMetadata */

/** R1, R43: the answer for bytes that are not a PDF.
 *  @typedef {{ ok: false, container: "pdf", reason: "NOT_BYTES" | "NOT_A_PDF" }} PdfRefusal */
/** R42: a document too large to read, refused before its text.
 *  @typedef {{
 *    ok: false, container: "pdf", reason: "TOO_LARGE_TO_READ", failure: "final", version: string, pages: number,
 *    bytes: number, need_mb: number, limit_mb: number, text_share: number
 *  }} PdfTooLarge */
/** R2: the reading of a PDF.
 *  @typedef {{
 *    ok: true, container: "pdf", version: string, pages: number, links: LinkRecord[], counts: LinkCounts, text: PdfText,
 *    images: ImagePlacement[] | null, imagesWhy?: string, pageBoxes: PageBoxes | null, active: ActiveItem[],
 *    metadata: PdfMetadata | null, notes: string[]
 *  }} PdfStructure */
/** @typedef {PdfStructure | PdfRefusal | PdfTooLarge} PdfStructureAnswer */

/** R43, R44: which pages a range reads; `maxBytes` bounds the decoded content it builds.
 *  @typedef {{ from?: number | undefined, count?: number | undefined, maxBytes?: number | undefined }} PdfRangeArgs */
/** A range's text, in the shape of the whole reading's for those pages.
 *  @typedef {{ pages: PageText[], undetermined: Marker[], counts: TextCounts }} RangeText */
/** R43, R44, R46, R50: one range's reading. `final` on an encrypted document's; the document-level members are on every
 *  range a reading of pages builds.
 *  @typedef {{
 *    ok: true, container: "pdf", pages: number, from: number, count: number, text: RangeText, notes: string[], final?: true,
 *    metadata?: PdfMetadata | null, pageBoxes?: PageBoxes | null, images?: ImagePlacement[] | null, imagesWhy?: string,
 *    text_glyphs?: number, words_total?: number
 *  }} PdfRange */
/** R45: what an opening gives the thread back through.
 *  @typedef {{ yieldNow?: (() => (void | Promise<void>)) | undefined }} OpenRangeOptions */
/** R44: a document opened once, read by ranges.
 *  @typedef {{ ok: true, pages: number, notes: string[], range: (range?: PdfRangeArgs) => Promise<PdfRange> }} OpenedRange */

/** R49: where a page is read from: the document's size, and its bytes by range.
 *  @typedef {{ size: number, readRange: (offset: number, length: number) => Promise<Uint8Array> }} RangeSource */
/** R49: one page as a PDF of its own, or the caller reads the whole file.
 *  @typedef {{ ok: true, pages: number, bytes: Uint8Array } | { ok: false, fallback: true, why: string }} PageSourceAnswer */

/** R37: one indirect object of the latest revision, and a reference that resolves to nothing.
 *  @typedef {{ num: number, gen: number, value: PdfValue }} PdfObjectEntry */
/** @typedef {{ num: number, gen: number }} PdfObjectRef */
/** @typedef {{ trailer: PdfMap, objects: PdfObjectEntry[], unresolved: PdfObjectRef[] }} PdfObjects */
/** R44's count of the work an opening did (no answer reads it).
 *  @typedef {{ scans: number, objectStreamLoads: number, innerDecodes: number }} PdfWork */

/* R48 (fix round 9, G124): every ceiling this module keeps is a row of READ_BOUNDS, quoted here and used by name below; none
 * is a number of this file's own. */
const BFRANGE_CODES_MAX = boundOf("pdf", "bfrange_codes");
const OBJECTS_MAX = boundOf("pdf", "objects");
const DIRECT_OBJECT_MAX = boundOf("pdf", "direct_object");
const TREE_DEPTH_MAX = boundOf("pdf", "tree_depth");
const OPERANDS_MAX = boundOf("pdf", "operands");
const IMAGE_PIXELS_MAX = boundOf("image", "pixels");
const IMAGE_ROW_STRIDE_MAX = boundOf("image", "row_stride");
/* R22: a decoded stream is held to the cap of its kind */
const STREAM_CAPS = Object.freeze({
  page_content: boundOf("pdf", "page_content"), object_stream: boundOf("pdf", "object_stream"),
  cmap: boundOf("pdf", "cmap"), embedded_file: boundOf("pdf", "embedded_file"),
});
/** The cap of a stream kind that has one (R22); undefined for an image, whose bound is its declared size.
 *  @param {string} kind
 *  @returns {number | undefined} */
const capOfKind = (kind) => (kind === "page_content" ? STREAM_CAPS.page_content : kind === "object_stream" ? STREAM_CAPS.object_stream
  : kind === "cmap" ? STREAM_CAPS.cmap : kind === "embedded_file" ? STREAM_CAPS.embedded_file : undefined);

/* E11 (fix round 5) — ASCII85Decode AND ASCIIHexDecode, BEFORE FlateDecode.
 *
 * reportlab, and many producers after it, write a content stream as `/Filter [/ASCII85Decode /FlateDecode]`: the bytes
 * are deflate output written in printable characters, and a reader that decodes Flate alone calls every page of such a
 * file `content_stream_undecodable`, a text page read as pictures of text. The two ASCII filters are exact (no
 * interpretation, a byte for a byte), so they are applied as the chain states them, first. A stage that is not
 * one of these, Flate, or the end of the chain (LZW, RunLength, CCITT, DCT, a name this reader does not know) is stated as
 * undecodable, never guessed. A malformed ASCII stream is the same: null. */
const ASCII_FILTERS = new Set(["ASCII85Decode", "A85", "ASCIIHexDecode", "AHx"]);

/** The bytes an ASCII85Decode stream states (ISO 32000-1 §7.4.3): groups of five characters `!`..`u` for four bytes, `z`
 *  for four zero bytes, white space ignored, an optional `<~` first and `~>` last, a final group of n characters (2 to 4)
 *  for n-1 bytes. Null for any other character, a group that overflows 32 bits, or a lone final character.
 *  @param {Uint8Array} src
 *  @returns {Uint8Array | null} */
function ascii85Decode(src) {
  let i = 0;
  while (i < src.length && isWhitespace(src[i])) i++;
  if (src[i] === 0x3c && src[i + 1] === 0x7e) i += 2;
  let zs = 0;
  for (let k = src.indexOf(0x7a); k !== -1; k = src.indexOf(0x7a, k + 1)) zs++;
  const out = new Uint8Array(Math.ceil(src.length * 4 / 5) + 3 * zs + 4); // a `z` is one character for four bytes
  let o = 0, n = 0, acc = 0;
  for (; i < src.length; i++) {
    const c = byteAt(src, i);
    if (isWhitespace(c)) continue;
    if (c === 0x7e) break; // "~>"
    if (c === 0x7a && n === 0) { o += 4; continue; } // z, the four zero bytes
    if (c < 0x21 || c > 0x75) return null;
    acc = acc * 85 + (c - 0x21);
    if (++n === 5) {
      if (acc > 0xffffffff) return null;
      out[o++] = acc >>> 24; out[o++] = (acc >>> 16) & 0xff; out[o++] = (acc >>> 8) & 0xff; out[o++] = acc & 0xff;
      n = 0; acc = 0;
    }
  }
  if (n === 1) return null;
  if (n > 1) {
    for (let k = n; k < 5; k++) acc = acc * 85 + 84;
    if (acc > 0xffffffff) return null;
    const four = [acc >>> 24, (acc >>> 16) & 0xff, (acc >>> 8) & 0xff, acc & 0xff];
    for (let k = 0; k < n - 1; k++) out[o++] = byteAt(four, k);
  }
  return out.slice(0, o);
}

/** The bytes an ASCIIHexDecode stream states (§7.4.2): hexadecimal digits, white space ignored, `>` the end, an odd last
 *  digit read as followed by 0. Null for any other character.
 *  @param {Uint8Array} src
 *  @returns {Uint8Array | null} */
function asciiHexDecode(src) {
  const out = new Uint8Array((src.length >> 1) + 1);
  let o = 0, hi = -1;
  for (let i = 0; i < src.length; i++) {
    const c = byteAt(src, i);
    if (isWhitespace(c)) continue;
    if (c === 0x3e) break;
    const d = c >= 0x30 && c <= 0x39 ? c - 0x30 : c >= 0x41 && c <= 0x46 ? c - 0x37 : c >= 0x61 && c <= 0x66 ? c - 0x57 : -1;
    if (d < 0) return null;
    if (hi < 0) hi = d; else { out[o++] = (hi << 4) | d; hi = -1; }
  }
  if (hi >= 0) out[o++] = hi << 4;
  return out.slice(0, o);
}

/** `raw` with the leading ASCII filters of `names` undone, and the names that remain: `{ data, rest }`, or null for a
 *  malformed ASCII stream. A name that is not one (null: a filter entry that is not a name) stops the ASCII stages.
 *  @param {(string | null)[]} names
 *  @param {Uint8Array} raw
 *  @returns {{ data: Uint8Array, rest: (string | null)[] } | null} */
function undoAscii(names, raw) {
  let data = raw, i = 0;
  for (; i < names.length; i++) {
    const name = names[i];
    if (name === undefined || name === null || !ASCII_FILTERS.has(name)) break;
    const next = name === "ASCIIHexDecode" || name === "AHx" ? asciiHexDecode(data) : ascii85Decode(data);
    if (!next) return null;
    data = next;
  }
  return { data, rest: names.slice(i) };
}

/* Partition vocabulary, mirrored from subresources.mjs and extended by the one
 * first-class value a byte-level reader needs that a DOM reader does not:
 * `undetermined`. LINK_TYPES stays exactly the HTML set so the four that map
 * are provably the same four; `undetermined` is ours and carries no wrapper. */
/** @type {string[]} */
export const PDF_LINK_TYPES = [...LINK_TYPES, "undetermined"];

/* ------------------------------------------------------------------ *
 * Byte helpers
 * ------------------------------------------------------------------ */

/** Bytes as a string of one code unit per byte, each unit the byte's value
 *  (N813). Not `TextDecoder("latin1")`: that label is windows-1252, which
 *  reads 0x80-0x9F as other code points (0x80 as U+20AC), so a string's or a
 *  shown run's bytes in that range came back changed. Anything that is not a
 *  Uint8Array reads as no bytes. */
/** @param {unknown} u8
 *  @returns {string} */
function binaryString(u8) {
  if (!(u8 instanceof Uint8Array)) return "";
  let out = "";
  /* The PDF bytes this module was handed, read as character codes: its own channel, decoded here (R2). `apply` takes the
     typed array as its list of codes, as it takes any list of numbers, without copying it (a spread is seven times slower). */
  for (let i = 0; i < u8.length; i += 16384) out += String.fromCharCode.apply(null, /** @type {number[]} */ (/** @type {unknown} */ (u8.subarray(i, i + 16384))));
  return out;
}

/** An empty map of the stated kinds.
 *  @template K, V
 *  @returns {Map<K, V>} */
function emptyMap() {
  /** @type {[K, V][]} */
  const none = [];
  return new Map(none);
}
/** An empty set of the stated kind.
 *  @template T
 *  @returns {Set<T>} */
function emptySet() {
  /** @type {T[]} */
  const none = [];
  return new Set(none);
}

/** The element at `i` of `a`, or NaN past its end: NaN reads, in arithmetic, a bitwise operation or a comparison with a
 *  number, as the missing element (`undefined`) did.
 *  @param {ArrayLike<number>} a
 *  @param {number} i
 *  @returns {number} */
function byteAt(a, i) {
  const v = a[i];
  return v === undefined ? NaN : v;
}

/** @param {number | undefined} c
 *  @returns {boolean} */
function isWhitespace(c) {
  return c === 0x00 || c === 0x09 || c === 0x0a || c === 0x0c || c === 0x0d || c === 0x20;
}
/** @param {number | undefined} c
 *  @returns {boolean} */
function isDelimiter(c) {
  return c === 0x28 || c === 0x29 || c === 0x3c || c === 0x3e || c === 0x5b ||
         c === 0x5d || c === 0x7b || c === 0x7d || c === 0x2f || c === 0x25;
}

/** FlateDecode via the native DecompressionStream — no bundled dependency.
 *  /FlateDecode is zlib-wrapped deflate, which is exactly what the "deflate"
 *  format decodes. Reads the output as it comes and stops at `cap` bytes (R22): `{ over }` (the bytes decoded when it
 *  stopped), `{ data, trailing }` (`trailing` the count of bytes after the compressed data's own end, D-591), or null on
 *  any other decode failure (leniency: an unreadable stream is an absence, never a throw that loses the whole doc). */
/** @typedef {{ data: Uint8Array, trailing: number } | { over: number }} Inflated */
/** @typedef {{ data: Uint8Array } | { over: number } | { chunks: Uint8Array[], total: number }} InflatedRead */
/** @param {Uint8Array} u8
 *  @param {number} cap
 *  @returns {Promise<Inflated | null>} */
async function inflate(u8, cap) {
  /* `"data" in x` is `x.data` read for truth (decoded bytes are an object), and `"over" in x` is `x.over !== undefined` (a count) */
  const first = await readInflated(u8, "deflate", cap);
  if ("data" in first) return { data: first.data, trailing: 0 };
  if ("over" in first) return { over: first.over };
  const kept = inflateWithTrailing(u8, first.chunks, first.total);
  if (kept) return kept;
  /* Some producers emit raw deflate with no zlib header. Try that. */
  const raw = await readInflated(u8, "deflate-raw", cap);
  if ("data" in raw) return { data: raw.data, trailing: 0 };
  if ("over" in raw) return { over: raw.over };
  return null;
}

/** One format's output, read chunk by chunk: `{ data }`; `{ over }` as soon as the output passes `cap` (nothing is kept);
 *  `{ chunks, total }` with what was decoded before the decoder refused the stream. */
/** @param {Uint8Array} u8
 *  @param {"deflate" | "deflate-raw"} format
 *  @param {number} cap
 *  @returns {Promise<InflatedRead>} */
async function readInflated(u8, format, cap) {
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream(format)).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) { await reader.cancel().catch(() => {}); return { over: total }; }
      chunks.push(value);
    }
  } catch {
    return { chunks, total };
  }
  const data = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { data.set(c, off); off += c.length; }
  return { data };
}

/* D-591 — A FLATE STREAM WITH BYTES AFTER ITS OWN END STILL DECODES.
 *
 * The native decoder refuses a zlib stream followed by anything (a stray EOL a
 * producer counted into /Length, padding), and the whole page then read as
 * empty. The decoder does hand over everything it inflated before it refuses,
 * so that output is kept, but ONLY when it is provably complete. A zlib stream
 * ends with the Adler-32 of its output, so the output is complete exactly when
 * that checksum sits in the input and the prefix ending there inflates cleanly
 * to the same bytes. A truncated or corrupt stream fails that proof and stays
 * undecodable. Raw deflate carries no checksum, so it gets no such recovery.
 * The test does not depend on the wording of any runtime's error message. */
/** @param {Uint8Array} u8
 *  @param {Uint8Array[]} chunks
 *  @param {number} total
 *  @returns {Inflated | null} */
function inflateWithTrailing(u8, chunks, total) {
  if (u8.length < 6 || (byteAt(u8, 0) & 0x0f) !== 8 || ((byteAt(u8, 0) << 8) | byteAt(u8, 1)) % 31 !== 0) return null;
  const data = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { data.set(c, off); off += c.length; }
  const sum = adler32(data);
  const want = [(sum >>> 24) & 0xff, (sum >>> 16) & 0xff, (sum >>> 8) & 0xff, sum & 0xff];
  for (let i = 2; i + 4 < u8.length; i++) {
    if (u8[i] !== want[0] || u8[i + 1] !== want[1] || u8[i + 2] !== want[2] || u8[i + 3] !== want[3]) continue;
    const end = i + 4;
    const again = inflateChecked(u8.subarray(0, end), total + 1, total);
    if (again && again.length === data.length && again.every((b, k) => b === data[k])) return { data, trailing: u8.length - end };
  }
  return null;
}

/** @param {Uint8Array} u8
 *  @returns {number} */
function adler32(u8) {
  let a = 1, b = 0;
  for (let i = 0; i < u8.length;) {
    /* 5552 bytes is the most that can be summed before the 32-bit sums can overflow */
    const end = Math.min(u8.length, i + 5552);
    for (; i < end; i++) { a += u8[i] ?? NaN; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Undo a PNG predictor (Predictor >= 10) applied before Flate. Xref and some
 *  object streams use it. Colors/BitsPerComponent default to 1/8; only the row
 *  filter byte and the Up/Sub/Average/Paeth cases are needed in practice. */
/** @param {Uint8Array} data
 *  @param {{ predictor?: number, colors?: number, columns?: number, bpc?: number }} [parms]
 *  @returns {Uint8Array} */
function unpredict(data, { predictor = 1, colors = 1, columns = 1, bpc = 8 } = {}) {
  if (predictor < 10) return data; /* TIFF predictor 2 is vanishingly rare here */
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowLen = Math.ceil((colors * bpc * columns) / 8);
  if (rowLen <= 0) return data;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * (rowLen + 1)];
    const src = data.subarray(r * (rowLen + 1) + 1, r * (rowLen + 1) + 1 + rowLen);
    const cur = out.subarray(r * rowLen, r * rowLen + rowLen);
    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? cur[i - bpp] ?? NaN : 0;
      const b = prev[i] ?? NaN;
      const c = i >= bpp ? prev[i - bpp] ?? NaN : 0;
      let v = src[i] ?? NaN;
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: break;
      }
      cur[i] = v;
    }
    prev = cur;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * A lenient PDF object parser
 *
 * Values are tagged so a name is never confused with a string and a reference
 * is never confused with two numbers:
 *   name   { t:"name", v }
 *   str    { t:"str",  v, raw }       (R38: `raw` the exact bytes, `v` the text)
 *   ref    { t:"ref",  n, g }
 *   dict   { t:"dict", map:{name->value} }
 *   arr    { t:"arr",  items:[...] }
 *   stream { t:"stream", dict, start, end }   (byte offsets into the buffer)
 *   number / boolean / null are native
 * ------------------------------------------------------------------ */

/** One value at `pos` of `s` (one unit a byte), or null for an unknown token. `buf`, when a number, is where `s` begins in
 *  the file, so a stream's `start` is a file offset.
 *  @param {unknown} buf
 *  @param {string} s
 *  @param {number} pos
 *  @returns {Parsed | null} */
function parseValue(buf, s, pos) {
  pos = skipWs(s, pos);
  if (pos >= s.length) return null;
  const c = s.charCodeAt(pos);

  if (c === 0x2f) return parseName(s, pos);                 // /
  if (c === 0x28) return parseLiteralString(s, pos);        // (
  if (c === 0x3c && s.charCodeAt(pos + 1) === 0x3c)         // <<
    return parseDict(buf, s, pos);
  if (c === 0x3c) return parseHexString(s, pos);            // <
  if (c === 0x5b) return parseArray(buf, s, pos);           // [

  // keywords
  if (s.startsWith("true", pos)) return { value: true, pos: pos + 4 };
  if (s.startsWith("false", pos)) return { value: false, pos: pos + 5 };
  if (s.startsWith("null", pos)) return { value: null, pos: pos + 4 };

  // number, or an indirect reference "N G R"
  if (c === 0x2b || c === 0x2d || c === 0x2e || (c >= 0x30 && c <= 0x39)) {
    const ref = tryParseRef(s, pos);
    if (ref) return ref;
    return parseNumber(s, pos);
  }
  return null; // unknown token: caller treats as absent (lenient)
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {number} */
function skipWs(s, pos) {
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if (c === 0x25) { // % comment to end of line
      while (pos < s.length && s.charCodeAt(pos) !== 0x0a && s.charCodeAt(pos) !== 0x0d) pos++;
    } else if (isWhitespace(c)) {
      pos++;
    } else break;
  }
  return pos;
}

/** R37 (E2): a name value is one frozen object per distinct name, shared by every place a document states it: a
 *  document of 135,000 annotations says `/Annot` and `/Text` 135,000 times, and a parsed tree of 135,000 objects is
 *  what a rewrite holds beside the file. The reader's values are never changed by a caller (doc-clean's own comment
 *  says so); a name past the table's size is a fresh object, as before. */
/** @type {Map<string, PdfName>} */
const NAME_VALUES = emptyMap();
const NAME_VALUES_MAX = 4096;
/** @param {string} v
 *  @returns {PdfName} */
function nameValue(v) {
  const had = NAME_VALUES.get(v);
  if (had) return had;
  /** @type {PdfName} */
  const n = { t: "name", v };
  Object.freeze(n);
  if (NAME_VALUES.size < NAME_VALUES_MAX && v.length <= 64) NAME_VALUES.set(v, n);
  return n;
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {{ value: PdfName, pos: number }} */
function parseName(s, pos) {
  pos++; // skip /
  let out = "";
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if (isWhitespace(c) || isDelimiter(c)) break;
    if (c === 0x23 && pos + 2 < s.length) { // #xx hex escape
      const h = parseInt(s.substr(pos + 1, 2), 16);
      if (!Number.isNaN(h)) { out += String.fromCharCode(h); pos += 3; continue; }
    }
    out += s[pos];
    pos++;
  }
  return { value: nameValue(out), pos };
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {Parsed} */
function parseNumber(s, pos) {
  const start = pos;
  if (s.charCodeAt(pos) === 0x2b || s.charCodeAt(pos) === 0x2d) pos++;
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if ((c >= 0x30 && c <= 0x39) || c === 0x2e) pos++;
    else break;
  }
  const n = parseFloat(s.slice(start, pos));
  return { value: Number.isNaN(n) ? 0 : n, pos };
}

/** "N G R" is an indirect reference; "N G obj" is an object header. Only the
 *  former is a value. Everything else beginning with a digit is a number. */
/** @param {string} s
 *  @param {number} pos
 *  @returns {Parsed | null} */
function tryParseRef(s, pos) {
  const m = /^(\d+)\s+(\d+)\s+R(?![a-zA-Z0-9])/.exec(s.slice(pos, pos + 32));
  if (!m) return null;
  return { value: { t: "ref", n: parseInt(m[1] ?? "", 10), g: parseInt(m[2] ?? "", 10) }, pos: pos + m[0].length };
}

/* R38 (N813) — A STRING IS ITS BYTES, AND ITS TEXT BESIDE THEM.
 *
 * A string value carries `raw`, the bytes the file states (escapes and hex
 * digits decoded, read by the same two readers the content lexer uses), and
 * `v`, the text read from them. `v` is a reading, not the value: a binary
 * string (an /ID, an encryption /O or /U) or an odd-length UTF-16 one cannot
 * survive a trip through text, so a caller that writes a string back writes
 * `raw`, and no byte is lost or changed. */
/** @param {string} s
 *  @param {number} pos
 *  @returns {Parsed} */
function parseLiteralString(s, pos) {
  const r = readLiteralBytes(s, pos);
  return { value: strValue(r.bytes), pos: r.pos };
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {Parsed} */
function parseHexString(s, pos) {
  const r = readHexBytes(s, pos);
  return { value: strValue(r.bytes), pos: r.pos };
}

/** @param {Uint8Array} raw
 *  @returns {PdfStr} */
function strValue(raw) {
  return { t: "str", v: decodePdfText(raw), raw };
}

/** A string's text (R38): UTF-16BE after the `FE FF` mark (a trailing odd byte
 *  has no unit and is left to `raw`), otherwise each byte as one code unit. */
/** @param {Uint8Array} raw
 *  @returns {string} */
function decodePdfText(raw) {
  if (raw[0] === 0xfe && raw[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < raw.length; i += 2) out += String.fromCharCode((byteAt(raw, i) << 8) | byteAt(raw, i + 1));
    return out;
  }
  return binaryString(raw);
}

/** @param {unknown} buf
 *  @param {string} s
 *  @param {number} pos
 *  @returns {Parsed} */
function parseArray(buf, s, pos) {
  pos++; // skip [
  /** @type {PdfValue[]} */
  const items = [];
  while (true) {
    pos = skipWs(s, pos);
    if (pos >= s.length || s.charCodeAt(pos) === 0x5d) { pos++; break; }
    const r = parseValue(buf, s, pos);
    if (!r) { pos++; continue; } // skip an unparseable token, stay lenient
    items.push(r.value);
    pos = r.pos;
  }
  /* `push` leaves room for seventeen: an array of four numbers held 150 bytes more than it needs (E2) */
  return { value: { t: "arr", items: items.length < 16 ? items.slice() : items }, pos };
}

/** A dictionary's map: an object with no inherited key (a name like `constructor` or `__proto__` is an ordinary key),
 *  made by a constructor and not by `Object.create(null)`, whose objects V8 keeps as dictionaries of their own (about
 *  250 bytes for five keys) where these share their layout (E2). */
/** @constructor */
function Dict() {}
Dict.prototype = { __proto__: null }; // a fresh object with no prototype, as `Object.create(null)` makes it
/** An empty dictionary map, made by `Dict`. A dictionary is what this module decodes from the PDF bytes it was handed, its
 *  own channel: the map is given its kind here, where it is made (R2), and holds what the parse puts in it.
 *  @returns {PdfMap} */
function newMap() {
  return /** @type {PdfMap} */ (/** @type {unknown} */ (new Dict()));
}

/** @param {unknown} buf
 *  @param {string} s
 *  @param {number} pos
 *  @returns {Parsed | ParsedStream} */
function parseDict(buf, s, pos) {
  pos += 2; // skip <<
  const map = newMap();
  while (true) {
    pos = skipWs(s, pos);
    if (pos >= s.length) break;
    if (s.charCodeAt(pos) === 0x3e && s.charCodeAt(pos + 1) === 0x3e) { pos += 2; break; }
    if (s.charCodeAt(pos) !== 0x2f) { pos++; continue; } // expected a key; skip junk
    const key = parseName(s, pos);
    pos = key.pos;
    const val = parseValue(buf, s, pos);
    if (!val) break;
    map[key.value.v] = val.value;
    pos = val.pos;
  }
  // A dict may be the head of a stream.
  const after = skipWs(s, pos);
  if (s.startsWith("stream", after)) {
    let p = after + 6;
    if (s.charCodeAt(p) === 0x0d) p++;
    if (s.charCodeAt(p) === 0x0a) p++;
    return { value: { t: "stream", dict: map, start: p + (typeof buf === "number" ? buf : 0) }, pos: p, streamPending: true };
  }
  return { value: { t: "dict", map }, pos };
}

/* ------------------------------------------------------------------ *
 * Document model: objects, streams, pages
 * ------------------------------------------------------------------ */

/* R41 — NOTHING IS PARSED THAT IS NOT ASKED FOR, AND NOTHING IS HELD THAT CAN BE
 * READ AGAIN.
 *
 * The first reader parsed every object into a map and kept it, with the whole
 * file as one string beside it: 108 MB of parsed values for an 8 MB budget
 * volume whose 56,000 objects are mostly its tagged structure tree, no page of
 * which reads one, and the object's limit is 128 MB (K4434). So the table below
 * keeps, for each object number, WHERE its winning definition is and the three
 * facts the loads and the page index ask of every object (is it a dictionary or
 * a stream, its `/Type` name, whether it could be the Standard security
 * handler), and parses the value from a small window of bytes when something
 * asks for it, keeping the recent ones. Every definition is still parsed ONCE
 * when the file is opened (that is how "a later definition wins" and "an
 * unparseable object is absent" stay exactly what R8 states), but the value is
 * dropped as soon as its facts are taken. An object inside an object stream is
 * read from the decoded stream, which is inflated again (synchronously, by the
 * same decoder `pdfTitle` uses) when it is asked for and not held; `PdfDoc`
 * checks at load that the second decode is byte-identical to the first and keeps
 * the first for any stream where it is not. */

/** R44's proof of "parsed once": how many times a document was scanned for its objects, how many object streams the open
 *  decoded (`loadObjectStreams`), and how many times an object stream was decoded again on demand to read one object
 *  (`_innerBytes`, the few-held cache of R41). A count and nothing else: no answer reads it. */
/** R45: the most one step of an opening does before it gives the thread back: objects placed, or bytes scanned, or
 *  object-stream entries placed. A count, never a time (the platform's clock does not move while a step runs). */
const SLICE_OBJECTS = 2000;
const SLICE_BYTES = 1 << 20;
const SLICE_STREAMS = 16;
/** R45, amended (G179; K5006): the most work a region's compute does before it gives the thread back, in units: a content token
 *  walked is one, a font's code-map entries an eighth each, 64 characters counted one (about 20 ms of this module's own work on
 *  the machine the figure was taken on, never read as a time). */
const SLICE_UNITS = 4096;
/** `yieldNow` as a tick that never fails: a `yieldNow` that throws or rejects is ignored, and the answer does not depend on it. */
/** @typedef {() => Promise<void>} Tick */
/** @param {() => (void | Promise<void>)} yieldNow
 *  @returns {Tick} */
const tickOf = (yieldNow) => async () => { try { await yieldNow(); } catch { /* the answer does not depend on it */ } };
/** The slicer a region's compute carries (R45): `n` counts the work since the last yield; a loop adds its work and awaits `go()`
 *  once it reaches SLICE_UNITS (`if (sl && ++sl.n >= SLICE_UNITS) await sl.go()` for a token, `await sl.add(k)` for a lump). */
/** @typedef {{ n: number, go: () => Promise<void>, add: (k: number) => Promise<void> }} Slicer */
/** @param {() => (void | Promise<void>)} yieldNow
 *  @returns {Slicer} */
function slicerOf(yieldNow) {
  const tick = tickOf(yieldNow);
  /** @type {Slicer} */
  const sl = { n: 0,
    async go() { sl.n = 0; await tick(); },
    /** @param {number} k */
    async add(k) { sl.n += k; if (sl.n >= SLICE_UNITS) await sl.go(); } };
  return sl;
}
/** @type {PdfWork} */
const WORK = { scans: 0, objectStreamLoads: 0, innerDecodes: 0 };
/** R44's count of the work openings did, a copy.
 *  @returns {PdfWork} */
export function pdfWork() { return { ...WORK }; }

/** Parsed objects kept for reuse, counted by the bytes they came from (times
 *  three); the decoded object streams kept, in bytes. */
const OBJ_CACHE_COST = 1_200_000;
const INNER_CACHE_BYTES = 16 * 1024 * 1024;
const INNER_CHECK_BYTES = 2 * 1024 * 1024;
/** A Flate stream of at least this many compressed bytes is decoded by `inflateChecked` first (R41). */
const LARGE_RAW_BYTES = 128 * 1024;

/** JavaScript's `\s` for one byte read as one code unit (the first reader scanned a string with it). */
/** @param {number | undefined} c
 *  @returns {boolean} */
const isJsSpaceByte = (c) => c !== undefined && ((c >= 0x09 && c <= 0x0d) || c === 0x20 || c === 0xa0);
/** The `N G obj` that opens at `off` of `b` (white space first allowed): `{ num, gen, bodyStart }`, or null. */
/** @param {Uint8Array} b
 *  @param {number} off
 *  @returns {{ num: number, gen: number, bodyStart: number } | null} */
function objHeaderAt(b, off) {
  let p = off;
  if (!Number.isInteger(p) || p < 0 || p >= b.length) return null;
  while (p < b.length && isJsSpaceByte(b[p])) p++;
  /** @returns {number | null} */
  const digits = () => { const at = p; let v = 0; for (let c = byteAt(b, p); p < b.length && c >= 0x30 && c <= 0x39; c = byteAt(b, p)) { v = v * 10 + c - 0x30; p++; } return p === at ? null : v; };
  const num = digits();
  if (num === null || !(p < b.length && isJsSpaceByte(b[p]))) return null;
  while (p < b.length && isJsSpaceByte(b[p])) p++;
  const gen = digits();
  if (gen === null || !(p < b.length && isJsSpaceByte(b[p]))) return null;
  while (p < b.length && isJsSpaceByte(b[p])) p++;
  if (!(b[p] === 0x6f && b[p + 1] === 0x62 && b[p + 2] === 0x6a) || isWordByte(b[p + 3])) return null;
  return { num, gen, bodyStart: p + 3 };
}
/** @param {number | undefined} c
 *  @returns {boolean} */
const isDigitByte = (c) => c !== undefined && c >= 0x30 && c <= 0x39;
/** @param {number | undefined} c
 *  @returns {boolean} */
const isWordByte = (c) => c !== undefined && ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f);

/** One value parsed at `pos` of `bytes`, from a window that grows (eightfold) while the parse ends within 16 bytes of
 *  its end, so a value, a stream keyword or a reference cut by the window is never taken for what is left of it.
 *  `{ value, len }` (`len` the bytes it spans, a stream's `start` absolute), or null. `first` is the first window. */
/** @param {Uint8Array} bytes
 *  @param {number} pos
 *  @param {number} [first]
 *  @returns {{ value: PdfValue, len: number } | null} */
function parseWindow(bytes, pos, first = 512) {
  parseWindow.over = false;
  if (!Number.isFinite(pos) || pos < 0 || pos >= bytes.length) return null;
  pos = Math.trunc(pos);
  for (let size = Math.min(Math.max(32, first), DIRECT_OBJECT_MAX); ; size = Math.min(size * 8, DIRECT_OBJECT_MAX)) {
    const hi = Math.min(bytes.length, pos + size);
    const s = binaryString(bytes.subarray(pos, hi));
    const r = parseValueSafe(s, 0, pos);
    const more = hi < bytes.length;
    const unfinished = more && (r ? skipWs(s, r.pos) + 16 > s.length : skipWs(s, 0) + 16 > s.length);
    /* R47: a direct object is never read past the bound; one still unfinished at it is absent, as an unparseable one is, and says so */
    if (unfinished && size >= DIRECT_OBJECT_MAX) { parseWindow.over = true; return null; }
    if (!r) {
      if (unfinished) continue;
      return null;
    }
    if (unfinished) continue;
    return { value: r.value, len: r.pos };
  }
}
/** Whether the last `parseWindow` found a direct object still unfinished at the bound (R47).
 *  @type {boolean} */
parseWindow.over = false;

/** A dictionary's or a stream's map; null for any other value.
 *  @param {PdfValue | undefined} v
 *  @returns {PdfMap | null} */
function mapOf(v) {
  return v && typeof v === "object" ? (v.t === "dict" ? v.map : v.t === "stream" ? v.dict : null) : null;
}

/** The value as an array, or null when it is not one.
 *  @param {PdfValue | undefined} v
 *  @returns {PdfArr | null} */
function asArr(v) { return v && typeof v === "object" && v.t === "arr" ? v : null; }
/** @param {PdfValue | undefined} v
 *  @returns {PdfDict | null} */
function asDict(v) { return v && typeof v === "object" && v.t === "dict" ? v : null; }
/** @param {PdfValue | undefined} v
 *  @returns {PdfStream | null} */
function asStream(v) { return v && typeof v === "object" && v.t === "stream" ? v : null; }
/** @param {PdfValue | undefined} v
 *  @returns {PdfRef | null} */
function asRef(v) { return v && typeof v === "object" && v.t === "ref" ? v : null; }
/** @param {PdfValue | undefined} v
 *  @returns {PdfName | null} */
function asName(v) { return v && typeof v === "object" && v.t === "name" ? v : null; }
/** @param {PdfValue | undefined} v
 *  @returns {PdfStr | null} */
function asStr(v) { return v && typeof v === "object" && v.t === "str" ? v : null; }

/** Whether a filter stage is Flate.
 *  @param {string | null} n
 *  @returns {boolean} */
function isFlateName(n) { return n === "FlateDecode" || n === "Fl"; }

/** The names of a stream's filter chain, a name for each stage (null for a stage that is not a name); `[null]` for a
 *  /Filter that is neither a name nor an array, which names no filter this can apply.
 *  @param {PdfValue} filter
 *  @returns {(string | null)[]} */
function filterNames(filter) {
  const n = asName(filter), a = asArr(filter);
  return filter == null ? [] : n ? [n.v] : a ? a.items.map((f) => { const fn = asName(f); return fn ? fn.v : null; }) : [null];
}
/** The colour components of a named colour space, for R22's row bound; another name reads as one. (An ordinary object: a
 *  name an object inherits, such as `constructor`, reads what it inherits, as it always has.)
 *  @type {{ [name: string]: number }} */
const COLOR_COMPONENTS = { DeviceRGB: 3, RGB: 3, DeviceCMYK: 4, CMYK: 4 };

/** The map of the first `/Type /Catalog` object, as reading its `.map` gives it: an object counted a dictionary is one, so
 *  this is its map (anything else reads as none), and a value that is gone (its object stream no longer decodes) throws as
 *  reading a member of nothing throws.
 *  @param {PdfValue | undefined} v
 *  @returns {PdfMap | null} */
function catalogMap(v) {
  if (v === undefined || v === null) throw new TypeError(`Cannot read properties of ${v} (reading 'map')`);
  const d = asDict(v);
  return d ? d.map : null;
}

/** Object number -> where its winning definition is, parsed on demand. An object is a row of typed arrays (E2: 135,000
 *  small objects as records of seven fields were 16 MB before anything was parsed): `p` the offset in the file (`stm` -1)
 *  or in object stream `stm`'s decoded bytes, `w` the window its first parse needed, `g` its generation, and the facts
 *  the loads ask of every object: dictionary (1), stream (2) or neither (0), its direct `/Type` name, and whether it
 *  could be the Standard security handler (a `/Filter /Standard` beside an `/R`). Rows are in first-definition order, as
 *  the first reader's map had it; a number is found through an open-addressing table of row numbers. */
class ObjectTable {
  /** @param {PdfDoc} doc */
  constructor(doc) {
    /** @type {PdfDoc} */
    this.doc = doc;
    /** @type {Map<number, { v: PdfValue, c: number }>} */
    this.hot = emptyMap();   // recently parsed: num -> { v, c }
    /** @type {Map<number, PdfValue>} */
    this.pins = emptyMap();  // parsed and kept: num -> v (an object whose identity a caller compares)
    /** @type {number} */
    this.cost = 0;
    /** @type {number} */
    this.n = 0;
    /** @type {Float64Array} */
    this.num = new Float64Array(256);
    /** @type {Uint32Array} */
    this.p = new Uint32Array(256);
    /** @type {Int32Array} */
    this.w = new Int32Array(256);
    /** @type {Float64Array} */
    this.stm = new Float64Array(256);
    /** @type {Float64Array} */
    this.g = new Float64Array(256);
    /** @type {Uint8Array} */
    this.fl = new Uint8Array(256);   // bits 0-1 the kind, bit 2 the Standard-handler candidate
    /** @type {Uint16Array} */
    this.ty = new Uint16Array(256);  // index into `types`; 0 none
    /** @type {(string | null)[]} */
    this.types = [null];
    /** @type {Map<string, number>} */
    this.typeIx = emptyMap();
    /** @type {Int32Array} */
    this.slots = new Int32Array(512); // row + 1; 0 empty
  }
  /** @returns {number} */
  get size() { return this.n; }
  /** @param {number} n
   *  @returns {number} */
  static hash(n) { return Math.imul((n % 4294967296) | 0, 0x9e3779b1) >>> 0; }
  /** @param {number} n
   *  @returns {number} */
  row(n) {
    const mask = this.slots.length - 1;
    for (let i = ObjectTable.hash(n) & mask; ; i = (i + 1) & mask) {
      const s = this.slots[i] ?? 0;
      if (!s) return -1;
      if (this.num[s - 1] === n) return s - 1;
    }
  }
  /** @param {number} n
   *  @returns {boolean} */
  has(n) { return this.row(n) >= 0; }
  /** @returns {Generator<number, void, unknown>} */
  *keys() { for (let i = 0; i < this.n; i++) yield byteAt(this.num, i); }
  /** @param {number} n
   *  @returns {number | undefined} */
  gen(n) { const r = this.row(n); return r < 0 ? undefined : this.g[r]; }
  /** Every row array twice as long, its rows kept. */
  grow() {
    const cap = this.num.length * 2;
    const num = new Float64Array(cap); num.set(this.num); this.num = num;
    const p = new Uint32Array(cap); p.set(this.p); this.p = p;
    const w = new Int32Array(cap); w.set(this.w); this.w = w;
    const stm = new Float64Array(cap); stm.set(this.stm); this.stm = stm;
    const g = new Float64Array(cap); g.set(this.g); this.g = g;
    const fl = new Uint8Array(cap); fl.set(this.fl); this.fl = fl;
    const ty = new Uint16Array(cap); ty.set(this.ty); this.ty = ty;
  }
  rehash() {
    this.slots = new Int32Array(this.slots.length * 2);
    const mask = this.slots.length - 1;
    for (let r = 0; r < this.n; r++) {
      let i = ObjectTable.hash(byteAt(this.num, r)) & mask;
      while (this.slots[i]) i = (i + 1) & mask;
      this.slots[i] = r + 1;
    }
  }
  /** A definition of `n` whose value, parsed at `p` of the file (`stm` -1) or of object stream `stm`, is `v`: the later
   *  one replaces an earlier one's, keeping the number's place in the order.
   *  @param {number} n
   *  @param {number} p
   *  @param {number} w
   *  @param {number} stm
   *  @param {number} g
   *  @param {PdfValue} v */
  put(n, p, w, stm, g, v) {
    let r = this.row(n);
    if (r < 0) {
      if (this.n === this.num.length) this.grow();
      if ((this.n + 1) * 2 > this.slots.length) this.rehash();
      r = this.n++;
      this.num[r] = n;
      const mask = this.slots.length - 1;
      let i = ObjectTable.hash(n) & mask;
      while (this.slots[i]) i = (i + 1) & mask;
      this.slots[i] = r + 1;
    }
    this.p[r] = p; this.w[r] = w; this.stm[r] = stm; this.g[r] = g;
    const map = mapOf(v);
    const type = map ? map.Type : undefined, filter = map ? map.Filter : undefined;
    const ty = type && typeof type === "object" && type.t === "name" ? type.v : null;
    let t = 0;
    if (ty !== null) { const had = this.typeIx.get(ty); if (had !== undefined) t = had; else { t = this.types.length; if (t > 0xffff) t = 0; else { this.types.push(ty); this.typeIx.set(ty, t); } } }
    this.ty[r] = t;
    const sd = map && filter && typeof filter === "object" && filter.t === "name" && filter.v === "Standard" && map.R != null;
    this.fl[r] = (asDict(v) ? 1 : asStream(v) ? 2 : 0) | (sd ? 4 : 0);
    this.pins.delete(n);
    const h = this.hot.get(n);
    if (h) { this.cost -= h.c; this.hot.delete(n); }
  }
  /** The parsed value of object `n`, or undefined; parsed objects are reused while they are recent.
   *  @param {number} n
   *  @returns {PdfValue | undefined} */
  get(n) {
    const r = this.row(n);
    if (r < 0) return undefined;
    if (this.pins.has(n)) return this.pins.get(n);
    const h = this.hot.get(n);
    if (h) { this.hot.delete(n); this.hot.set(n, h); return h.v; }
    const got = this.parse(r);
    if (!got) return undefined;
    const c = 1 + got.len * 3;
    this.hot.set(n, { v: got.value, c });
    this.cost += c;
    for (const [k, old] of this.hot) {
      if (this.cost <= OBJ_CACHE_COST || this.hot.size <= 1) break;
      this.hot.delete(k); this.cost -= old.c;
    }
    return got.value;
  }
  /** The parsed value of `n` without keeping it.
   *  @param {number} n
   *  @returns {PdfValue | undefined} */
  peek(n) {
    const r = this.row(n);
    if (r < 0) return undefined;
    if (this.pins.has(n)) return this.pins.get(n);
    const h = this.hot.get(n);
    if (h) return h.v;
    const got = this.parse(r);
    return got ? got.value : undefined;
  }
  /** Keep object `n`'s parsed value for good: a caller that compares the identity of what it resolved asks for this.
   *  @param {number} n */
  pin(n) {
    const v = this.get(n);
    if (v === undefined) return;
    const h = this.hot.get(n);
    if (h) { this.cost -= h.c; this.hot.delete(n); }
    this.pins.set(n, v);
  }
  /** @param {number} r
   *  @returns {{ value: PdfValue, len: number } | null} */
  parse(r) {
    const stm = byteAt(this.stm, r);
    const src = stm < 0 ? this.doc._b : this.doc._innerBytes(stm);
    return src ? parseWindow(src, byteAt(this.p, r), byteAt(this.w, r)) : null;
  }
  /** Object numbers, in order, whose winning definition is of kind `kind` (1 dictionary, 2 stream, 3 either) and, when
   *  given, has the `/Type` name `type`.
   *  @param {number} kind
   *  @param {string} [type]
   *  @returns {number[]} */
  nums(kind, type) {
    /** @type {number[]} */
    const out = [];
    const t = type === undefined ? -1 : this.typeIx.get(type);
    if (t === undefined) return out;
    for (let r = 0; r < this.n; r++) {
      const k = byteAt(this.fl, r) & 3;
      if (!(kind === 3 ? k > 0 : k === kind) || (t >= 0 && this.ty[r] !== t)) continue;
      out.push(byteAt(this.num, r));
    }
    return out;
  }
  /** Object numbers that could be the Standard security handler.
   *  @returns {number[]} */
  standard() {
    /** @type {number[]} */
    const out = [];
    for (let r = 0; r < this.n; r++) if (byteAt(this.fl, r) & 4) out.push(byteAt(this.num, r));
    return out;
  }
}

/** A 64-bit fingerprint of `a`'s bytes (two FNV-1a runs with different primes), as a string: what the second decode of an
 *  object stream is compared with, so the first need not be held while it is made. */
/** @param {Uint8Array} a
 *  @returns {string} */
function fingerprint(a) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? NaN;
    h1 = Math.imul(h1 ^ x, 0x01000193);
    h2 = Math.imul(h2 ^ x, 0x85ebca6b) + 0x9e3779b9 | 0;
  }
  return `${a.length}:${(h1 >>> 0).toString(16)}:${(h2 >>> 0).toString(16)}`;
}

/* The ONE PDF object/stream reader in the codebase (CPDF-12): `pdf-worker`
 * drives it too rather than growing a second one (the D-164 lesson). Its
 * interface is `openPdf` below and the members the requirements name (R18-R23,
 * R31, R37): `pageCount`, `pageDict`, `resolve`, `dictOf`, `streamRawBytes`,
 * `streamDecoded`, `isEncrypted`, and the three load steps. Every other field
 * (`_objs`, `_pageOrder`, `pageIndexByObj`, …) is private (N9, K28). */
export class PdfDoc {
  /** R18: a reader over `bytes`; anything that is not a Uint8Array reads as no bytes.
   *  @param {Uint8Array | undefined} bytes */
  constructor(bytes) {
    /** @type {Uint8Array | undefined} */
    this.bytes = bytes;
    /** @type {Uint8Array} */
    this._b = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
    /** @type {ObjectTable} */
    this._objs = new ObjectTable(this); // num -> where its definition is (R41)
    /** @type {Map<number, Uint8Array>} */
    this._inners = emptyMap();        // object stream num -> its decoded bytes, recent ones
    /** @type {number} */
    this._innerBytesHeld = 0;
    /** @type {Map<number, Uint8Array>} */
    this._sticky = emptyMap();        // object stream num -> decoded bytes that a second decode did not reproduce
    /** @type {Map<number, number>} */
    this._innerLen = emptyMap();      // object stream num -> its decoded length, so a second decode writes once
    /** @type {Map<number, number>} */
    this.pageIndexByObj = emptyMap(); // page object num -> 0-based index
    /** @type {number[]} */
    this._pageOrder = [];            // page object nums in page order
    /** R19: the pages in R8's page order, once `buildPageIndex()` has run.
     *  @type {number} */
    this.pageCount = 0;
    /** @type {PdfMap | null} */
    this.root = null;
    /** @type {string[]} */
    this.notes = [];
    /** @type {Set<number>} */
    this._trailingNoted = emptySet(); // where each stream already noted flate_trailing_bytes starts
    /** @type {Set<number>} */
    this._undecodedStreams = emptySet(); // object stream nums whose data could not be decoded
    /* Set when they are first asked for, and declared here (a bare statement reads nothing and sets nothing): */
    /** @type {XrefReader | null | undefined} the cross-reference chain, when it validated (R8 (a)) */
    this._xr; // eslint-disable-line no-unused-expressions
    /** @type {boolean | undefined} `isEncrypted`'s answer, once asked */
    this._encrypted; // eslint-disable-line no-unused-expressions
    /** @type {PdfMap | null | undefined} `infoDict`'s answer, once asked */
    this._info; // eslint-disable-line no-unused-expressions
    /** @type {{ notes: string[], noted: Set<number> } | undefined} what the open left, for ranges (R50) */
    this._opened; // eslint-disable-line no-unused-expressions
    /** @type {{ idx: number, content: PageContent } | null | undefined} a page's content a range read and did not build */
    this._peek; // eslint-disable-line no-unused-expressions
    /** @type {{ metadata: PdfMetadata | null, pageBoxes: PageBoxes | null, notes?: string[] } | undefined} R46's document-level members */
    this._level; // eslint-disable-line no-unused-expressions
  }

  /** The resolved dict of the page at 0-based `pageIdx` in page order, or null
   *  (R31).
   *  @param {number} pageIdx
   *  @returns {PdfMap | null} */
  pageDict(pageIdx) {
    if (!Number.isInteger(pageIdx) || pageIdx < 0 || pageIdx >= this.pageCount) return null;
    return this.dictOf({ t: "ref", n: byteAt(this._pageOrder, pageIdx), g: 0 });
  }

  /** @param {string} msg */
  note(msg) { this.notes.push(msg); }

  /** Scan every top-level `N G obj` in the file. Later definitions win, which
   *  matches incremental-update semantics without parsing any xref. The first
   *  reader scanned the file as a string with `/(\d+)\s+(\d+)\s+obj\b/g`; this
   *  finds the same matches in the same order from the bytes (`\s` as
   *  JavaScript means it: the PDF whitespace bytes, and 0x0B and 0xA0). */
  scanTopLevel() {
    for (const _ of this._scanSteps()); // eslint-disable-line no-unused-vars
  }

  /** `scanTopLevel` as steps (R45): it yields after about SLICE_OBJECTS objects or SLICE_BYTES bytes, so a caller that
   *  wants the thread back between slices drains it with an await between steps; `scanTopLevel` drains it with none.
   *  @returns {Generator<void, void, unknown>} */
  *_scanSteps() {
    WORK.scans++;
    const b = this._b;
    let sliceAt = 0, objects = 0;
    for (let j = b.indexOf(0x6a); j !== -1; j = b.indexOf(0x6a, j + 1)) {
      if (j - sliceAt >= SLICE_BYTES || objects >= SLICE_OBJECTS) { sliceAt = j; objects = 0; yield; }
      if (j < 2 || b[j - 1] !== 0x62 || b[j - 2] !== 0x6f || isWordByte(b[j + 1])) continue; // "obj", then a boundary
      let p = j - 3;
      if (!(p >= 0 && isJsSpaceByte(b[p]))) continue;
      while (p >= 0 && isJsSpaceByte(b[p])) p--;
      const genEnd = p + 1;
      while (p >= 0 && isDigitByte(b[p])) p--;
      const genStart = p + 1;
      if (genStart === genEnd || !(p >= 0 && isJsSpaceByte(b[p]))) continue;
      while (p >= 0 && isJsSpaceByte(b[p])) p--;
      const numEnd = p + 1;
      while (p >= 0 && isDigitByte(b[p])) p--;
      const numStart = p + 1;
      if (numStart === numEnd) continue;
      const num = parseInt(binaryString(b.subarray(numStart, numEnd)), 10);
      const bodyStart = j + 1;
      /* R47: past the objects bound the scan stops, and says so */
      if (this._objs.size >= OBJECTS_MAX && !this._objs.has(num)) { this.note(`over_bound:objects:${OBJECTS_MAX + 1}:${OBJECTS_MAX}`); break; }
      const r = parseWindow(b, bodyStart);
      if (parseWindow.over && !this.notes.some((n) => n.startsWith("over_bound:direct_object"))) this.note(`over_bound:direct_object:${DIRECT_OBJECT_MAX + 1}:${DIRECT_OBJECT_MAX}`);
      if (r) {
        this._objs.put(num, bodyStart, r.len + 64, -1, parseInt(binaryString(b.subarray(genStart, genEnd)), 10), r.value);
        /* R8 (b): what a stream holds is its data and not objects: the scan resumes after it */
        const st = asStream(r.value);
        if (st) { const end = this._streamBodyEnd(st); if (end > j) j = end - 1; }
      }
      objects++;
    }
    yield* this._xrefSteps();
  }

  /** Where the data of a stream whose dictionary has just been read ends, for the scan to step over: by a direct /Length
   *  that an `endstream` follows, else at the next `endstream`; -1 when neither is found (nothing is skipped). */
  /** @param {PdfStream} st
   *  @returns {number} */
  _streamBodyEnd(st) {
    const b = this._b, start = st.start, len = st.dict.Length;
    if (typeof len === "number" && len >= 0 && start + len <= b.length && startsAscii(b, skipWsBytes(b, start + len), "endstream")) return start + len;
    return firstAscii(b, "endstream", start);
  }

  /* R8 (a) — THE CROSS-REFERENCE CHAIN NAMES EACH OBJECT'S CURRENT DEFINITION.
   *
   * The scan above reads every `N G obj` and the later wins; that is right for a file written once and wrong for an
   * incremental update that was cut short, or a definition the newest revision does not name. So the chain from the last
   * `startxref` (tables, `/Prev`, cross-reference streams, a hybrid `/XRefStm`) is read as well (the reader `pdfTitle` uses),
   * and where it names an object's definition at an offset that is not the one the scan kept, that definition is the one
   * used. An object the chain does not name keeps what the scan found. A chain that does not validate (no `startxref`, a
   * link that does not read, a named object that is not where it is named) is not used at all: `xref_reconstructed`.
   * @returns {Generator<void, void, unknown>} */
  *_xrefSteps() {
    const b = this._b;
    const xr = new XrefReader(b);
    /** @type {XrefSection[]} */
    let secs;
    try { secs = xr.sections(); } catch { secs = []; }
    if (!(xr.complete && secs.some((sec) => sec.trailer && sec.trailer.Root))) { this._xrefLost(); return; }
    /** @type {[number, { num: number, gen: number, bodyStart: number }, { value: PdfValue, len: number }][]} */
    const fixes = [];
    let bad = false, count = 0;
    try {
      /** @type {[number, { num: number, gen: number, bodyStart: number }][]} */
      const entries = [];
      xr.eachEntry((n, e, si) => {
        if (bad || e.type !== 1) return;
        if (si > 0 && !sameEntry(xr.lookup(n), e)) return; // a newer section names it
        const h = objHeaderAt(b, e.off);
        if (!h || h.num !== n) { bad = true; return; }
        const row = this._objs.row(n);
        if (row < 0) { bad = true; return; }
        if (this._objs.stm[row] !== -1 || this._objs.p[row] !== h.bodyStart) entries.push([n, h]);
      });
      for (const [n, h] of entries) {
        if (++count % SLICE_OBJECTS === 0) yield;
        const r = parseWindow(b, h.bodyStart);
        if (!r) { bad = true; break; }
        fixes.push([n, h, r]);
      }
    } catch { bad = true; }
    if (bad) { this._xrefLost(); return; }
    for (const [n, h, r] of fixes) this._objs.put(n, h.bodyStart, r.len + 64, -1, h.gen, r.value);
    this._xr = xr;
  }

  _xrefLost() {
    this._xr = null;
    if (!this.notes.includes("xref_reconstructed")) this.note("xref_reconstructed");
  }

  /** The newest trailer's entry `key`: through the chain when it validated, else the last trailer in the file that has it.
   *  @param {string} key
   *  @returns {PdfValue | undefined} */
  _trailerValue(key) {
    const xr = this._xr;
    if (xr) return xr.trailerValue(key);
    const ts = this._trailers();
    for (let i = ts.length - 1; i >= 0; i--) { const t = ts[i]; if (t && t[key] !== undefined) return t[key]; }
    return undefined;
  }

  /** R20: `v` with its indirect-reference chain followed (64 hops at most); null for an unresolvable reference or a cycle,
   *  and a value that is not a reference unchanged (undefined as null).
   *  @param {PdfValue | undefined} v
   *  @param {number} [seen] hops already made
   *  @returns {PdfValue} */
  resolve(v, seen = 0) {
    let cur = v, hops = seen;
    for (;;) {
      const r = asRef(cur);
      if (!r || hops >= 64) break;
      cur = this._objs.get(r.n);
      hops++;
    }
    /* A chain still a reference after 64 hops is a cycle: unresolvable (R20),
       never the reference itself handed back as if it were a value. */
    if (asRef(cur)) return null;
    return cur ?? null;
  }

  /** R21: the map of the dictionary or stream `v` resolves to; null for anything else.
   *  @param {PdfValue | undefined} v
   *  @returns {PdfMap | null} */
  dictOf(v) {
    return mapOf(this.resolve(v));
  }

  /** R22: a stream's raw (still-compressed) bytes. /Length is used when it
   *  resolves to an integer; otherwise we scan to the next `endstream`, which
   *  is the lenient recovery path. Null for a value that is not a stream.
   *  @param {PdfValue | undefined} streamObj
   *  @returns {Uint8Array | null} */
  streamRawBytes(streamObj) {
    const so = asStream(streamObj);
    if (!so || !so.dict || typeof so.dict !== "object") return null;
    const bytes = this.bytes;
    if (!(bytes instanceof Uint8Array)) return null;
    const start = so.start;
    if (!Number.isInteger(start) || start < 0 || start > bytes.length) return null;
    const len = this.resolve(so.dict.Length);
    /** @type {number | null} */
    let end;
    if (typeof len === "number" && len >= 0 && start + len <= bytes.length) {
      const byLength = start + len;
      // sanity: endstream should be at/after end
      const tail = firstAscii(bytes, "endstream", Math.max(0, byLength - 2));
      end = tail === -1 || tail > byLength + 4 ? this._scanEndstream(start) : byLength;
    } else {
      end = this._scanEndstream(start);
    }
    const stop = end;
    if (stop == null || stop < start) return null;
    return bytes.subarray(start, stop);
  }

  /** @param {number} start
   *  @returns {number | null} */
  _scanEndstream(start) {
    const bytes = this.bytes;
    if (!(bytes instanceof Uint8Array)) return null; // asked only once `streamRawBytes` has found bytes
    const idx = firstAscii(bytes, "endstream", start);
    if (idx === -1) return null;
    let e = idx;
    // trailing EOL before endstream is not part of the data
    if (bytes[e - 1] === 0x0a) e--;
    if (bytes[e - 1] === 0x0d) e--;
    return e;
  }

  /** R22: decompress a stream's bytes if its filter chain is (Flate). Answers a
   *  Promise of the bytes, or of null for anything else, which the callers
   *  treat as "cannot resolve" -> the doc degrades to undetermined rather than
   *  crashing. The Promise never rejects (R22): whatever goes wrong inside is
   *  that null. `kind` names what the stream is for, which decides its cap.
   *  @param {PdfValue | undefined} streamObj
   *  @param {string} [kind]
   *  @returns {Promise<Uint8Array | null>} */
  async streamDecoded(streamObj, kind) {
    try {
      const got = await this._decode(streamObj, kind);
      return got.data ?? null;
    } catch {
      return null;
    }
  }

  /** R22: an embedded file's SHA-256 and length, computed as the stream is read and never held: `{ sha, bytes }`; `{ over }` for a
   *  stream that passes the embedded-file cap (stated `stream_over_bound:embedded_file`, as `_decode` states it); `undefined` for
   *  a stream this does not take (an ASCII stage, a predictor, a filter other than one Flate, a decoder that refuses it), which the
   *  caller decodes whole and hashes. Never throws.
   *  @param {PdfStream} streamObj
   *  @returns {Promise<{ sha: string, bytes: number, over?: undefined } | { over: number, sha?: undefined, bytes?: undefined } | undefined>} */
  async streamDigest(streamObj) {
    try {
      const raw = this.streamRawBytes(streamObj);
      if (!raw) return undefined;
      const bound = STREAM_CAPS.embedded_file;
      const filter = this.resolve(streamObj.dict.Filter);
      const names = filterNames(filter);
      let parms = this.resolve(streamObj.dict.DecodeParms) || this.resolve(streamObj.dict.DP);
      const pa = asArr(parms);
      if (pa) parms = this.resolve(pa.items[pa.items.length - 1]);
      const pd = asDict(parms);
      if (pd && this.resolve(pd.map.Predictor) != null) return undefined;
      const hash = new Sha256();
      if (names.length === 0) {
        if (raw.length > bound) { this._overBound("embedded_file"); return { over: raw.length }; }
        hash.update(raw);
        return { sha: hash.hex(), bytes: raw.length };
      }
      if (names.length !== 1 || (names[0] !== "FlateDecode" && names[0] !== "Fl")) return undefined;
      const got = await streamInflated(raw, bound, (chunk) => hash.update(chunk));
      if (!got) return undefined;
      if (got.over !== undefined) { this._overBound("embedded_file"); return { over: got.over }; }
      return { sha: hash.hex(), bytes: got.total };
    } catch {
      return undefined;
    }
  }

  /** `streamDecoded` that says why it has no bytes: `{ data }`, or `{ data: null, over: { kind, size, bound } }` for a stream
   *  that passed the cap of its kind (R22), or `{ data: null }` for any other failure. `cap` replaces the kind's cap (a page's
   *  streams share one).
   *  @param {PdfValue | undefined} streamObj
   *  @param {string} [kind]
   *  @param {number} [cap]
   *  @returns {Promise<Decoded>} */
  async _decode(streamObj, kind, cap) {
    const rawBytes = this.streamRawBytes(streamObj);
    const so = asStream(streamObj);
    if (!rawBytes || !so) return { data: null };
    const k = this._kindOf(so, kind);
    const bound = cap ?? capOfKind(k) ?? STREAM_CAPS.page_content;
    /* a stream is stopped the moment it passes the cap, so the bytes counted are the bound itself: it has more */
    /** @param {number} size
     *  @returns {Decoded} */
    const over = (size) => { this._overBound(k); return { data: null, over: { kind: k, size: Math.max(size, bound + 1), bound } }; };
    if (k === "image" && this._imageOverBound(so)) { this._overBound("image"); return { data: null }; }
    const filter = this.resolve(so.dict.Filter);
    /* A /Filter that is neither a name nor an array names no filter this can
       apply, so it is not read as none (R22: null for any other filter). */
    const names = filterNames(filter);
    if (names.length === 0) return { data: rawBytes }; // unfiltered
    const un = undoAscii(names, rawBytes);
    if (!un || !un.rest.every(isFlateName)) return { data: null }; // not our phase-1 job
    const raw = un.data;
    if (!un.rest.length) return this._unpredictedGot(so, raw);
    if (raw.length >= LARGE_RAW_BYTES) {
      const proved = inflateProved(raw, bound);
      if (proved && "over" in proved) return over(proved.over);
      if (proved && "data" in proved) return this._unpredictedGot(so, proved.data);
    }
    const inflated = await inflate(raw, bound);
    if (!inflated) return { data: null };
    if ("over" in inflated) return over(inflated.over);
    let data = inflated.data;
    if (inflated.trailing > 0 && !this._trailingNoted.has(so.start)) {
      this._trailingNoted.add(so.start);
      this.note(`flate_trailing_bytes:${inflated.trailing}`);
    }
    return this._unpredictedGot(so, data);
  }

  /** @param {PdfStream} streamObj
   *  @param {Uint8Array} data
   *  @returns {Decoded} */
  _unpredictedGot(streamObj, data) {
    const out = this._unpredicted(streamObj, data);
    if (out) return { data: out };
    return { data: out };
  }

  /** What a stream is for, which decides its cap (R22): an image by its subtype, an object stream by its type; otherwise the
   *  caller's kind, else a page's.
   *  @param {PdfStream} streamObj
   *  @param {string} [kind]
   *  @returns {StreamKind} */
  _kindOf(streamObj, kind) {
    const d = streamObj.dict;
    const sub = d.Subtype && this.resolve(d.Subtype), type = d.Type && this.resolve(d.Type);
    const sn = asName(sub), tn = asName(type);
    if (sn && sn.v === "Image") return "image";
    if (tn) {
      if (tn.v === "ObjStm" || tn.v === "XRef") return "object_stream";
      if (tn.v === "EmbeddedFile") return "embedded_file";
    }
    return kind === "page_content" || kind === "object_stream" || kind === "cmap" || kind === "embedded_file" ? kind : "page_content";
  }

  /** @param {string} kind */
  _overBound(kind) {
    const note = `stream_over_bound:${kind}`;
    if (!this.notes.includes(note)) this.note(note);
  }

  /** R22: an image stream's declared width, height, components, bits and predictor row, judged against the image bounds before
   *  anything is allocated for it. True when it is over one.
   *  @param {PdfStream} streamObj
   *  @returns {boolean} */
  _imageOverBound(streamObj) {
    const d = streamObj.dict;
    /** @param {PdfValue | undefined} v
     *  @returns {number | null} */
    const num = (v) => { const x = this.resolve(v); return typeof x === "number" && Number.isFinite(x) ? x : null; };
    const w = num(d.Width), h = num(d.Height);
    if (w === null || h === null || w < 0 || h < 0) return false;
    if (w * h > IMAGE_PIXELS_MAX) return true;
    const cs = this.resolve(d.ColorSpace);
    const csn = asName(cs);
    const comps = csn ? (COLOR_COMPONENTS[csn.v] ?? 1) : asArr(cs) ? 4 : 1;
    const bpc = num(d.BitsPerComponent) ?? 8;
    let columns = w, colors = comps;
    let parms = this.resolve(d.DecodeParms) || this.resolve(d.DP);
    const pa = asArr(parms);
    if (pa) parms = this.resolve(pa.items[pa.items.length - 1]);
    const pd = asDict(parms);
    if (pd) { columns = num(pd.map.Columns) ?? columns; colors = num(pd.map.Colors) ?? colors; }
    return Math.ceil(Math.max(columns, w) * Math.max(colors, comps) * bpc / 8) > IMAGE_ROW_STRIDE_MAX;
  }

  /** Optional PNG predictor via /DecodeParms; null for a TIFF predictor (R22).
   *  @param {PdfStream} streamObj
   *  @param {Uint8Array} data
   *  @returns {Uint8Array | null} */
  _unpredicted(streamObj, data) {
    let parms = this.resolve(streamObj.dict.DecodeParms) || this.resolve(streamObj.dict.DP);
    const pa = asArr(parms);
    if (pa) parms = this.resolve(pa.items[pa.items.length - 1]);
    const pd = asDict(parms);
    if (pd) {
      /** @param {PdfValue | undefined} x
       *  @returns {number | undefined} */
      const num = (x) => { const r = this.resolve(x); return typeof r === "number" ? r : undefined; };
      const predictor = num(pd.map.Predictor);
      /* R22 (G132l (a)): a TIFF predictor is not passed through as if un-predicted: the stream is undecodable, so a caller
         states its pixels undetermined */
      if (predictor === 2) return null;
      if (predictor && predictor >= 2) {
        data = unpredict(data, {
          predictor,
          colors: num(pd.map.Colors) ?? 1,
          columns: num(pd.map.Columns) ?? 1,
          bpc: num(pd.map.BitsPerComponent) ?? 8,
        });
      }
    }
    return data;
  }

  /** `streamDecoded`, for a Flate or unfiltered stream the platform decodes without recovery, in one step and without
   *  notes: what R41's second reading of an object stream uses. Null for any other, which `loadObjectStreams` then keeps
   *  as first decoded.
   *  @param {PdfStream} streamObj
   *  @param {number} [expect]
   *  @returns {Uint8Array | null} */
  _decodedSync(streamObj, expect) {
    try {
      const raw = this.streamRawBytes(streamObj);
      if (!raw) return null;
      const filter = this.resolve(streamObj.dict.Filter);
      const names = filterNames(filter);
      if (names.length === 0) return raw;
      const un = undoAscii(names, raw);
      if (!un || !un.rest.every(isFlateName)) return null;
      if (!un.rest.length) return this._unpredicted(streamObj, un.data);
      const data = inflateChecked(un.data, STREAM_CAPS.object_stream, expect);
      return data ? this._unpredicted(streamObj, data) : null;
    } catch {
      return null;
    }
  }

  /** Object stream `stm`'s decoded bytes, read again when it is not one of the few held; null when it cannot be.
   *  @param {number} stm
   *  @returns {Uint8Array | null} */
  _innerBytes(stm) {
    const held = this._inners.get(stm);
    if (held) { this._inners.delete(stm); this._inners.set(stm, held); return held; }
    const sticky = this._sticky.get(stm);
    const st = sticky ? null : asStream(this._objs.get(stm));
    const decoded = st ? this._decodedSync(st, this._innerLen.get(stm)) : null;
    if (decoded) WORK.innerDecodes++;
    const data = sticky || decoded;
    if (!data) return null;
    /* room is made before the new one is held, so a 19 MB stream is never held beside the 12 MB one it replaces */
    for (const [k, old] of this._inners) {
      if (this._innerBytesHeld + data.length <= INNER_CACHE_BYTES || !this._inners.size) break;
      this._inners.delete(k); this._innerBytesHeld -= old.length;
    }
    this._inners.set(stm, data);
    this._innerBytesHeld += data.length;
    return data;
  }

  /** R18: parse every /ObjStm and fold its contained objects into the table, so an
   *  xref-stream PDF that keeps its page/annot dicts compressed is not empty.
   *  Objects already defined at top level are NOT overwritten (top-level and
   *  compressed definitions of one number should not coexist; if they do, the
   *  uncompressed one is the safer read). Each is parsed once here, to know it
   *  parses and what it is, and read again from the decoded stream when asked for (R41).
   *  `tick`, when given, is awaited between slices (R45).
   *  @param {Tick | null} [tick]
   *  @returns {Promise<void>} */
  async loadObjectStreams(tick = null) {
    await this._loadStreams(tick, null);
    const xr = this._xr;
    if (!xr) return;
    /* R8 (a): every compressed object the chain names must be in the object stream it names, or the chain is not used and
       the objects that are missing are read the lenient way (a later definition wins) */
    /** @type {Set<number>} */
    const missing = emptySet();
    xr.eachEntry((n, e, si) => {
      if (e.type !== 2) return;
      if (si > 0 && !sameEntry(xr.lookup(n), e)) return;
      /* an object in a stream that could not be decoded is lost to that, already stated (`objstm_undecodable`), and says nothing of the chain */
      if (this._undecodedStreams.has(e.stm)) return;
      const row = this._objs.row(n);
      if (row < 0 || this._objs.stm[row] !== e.stm) missing.add(n);
    });
    if (missing.size) { this._xrefLost(); await this._loadStreams(tick, missing); }
  }

  /** The body of `loadObjectStreams`: every object stream, in file order, folded into the table. `only` (a Set of object
   *  numbers) restricts it to those objects and ignores the chain.
   *  @param {Tick | null} tick
   *  @param {Set<number> | null} only
   *  @returns {Promise<void>} */
  async _loadStreams(tick, only) {
    const streams = this._objs.nums(2, "ObjStm");
    /** @param {number} n
     *  @returns {number} */
    const at = (n) => byteAt(this._objs.p, this._objs.row(n));
    streams.sort((a, b) => at(a) - at(b));
    const xr = only ? null : this._xr;
    let sinceTick = 0;
    for (const stm of streams) {
      if (tick && ++sinceTick >= SLICE_STREAMS) { sinceTick = 0; await tick(); }
      const st = asStream(this._objs.get(stm));
      if (!st) continue;
      /* The decoded bytes live in this block alone: the second decode below is
         made after they are released, so two copies of a 19 MB stream are never
         held at once. */
      /** @type {{ len: number, fp: string } | null} */
      let proof = null;
      WORK.objectStreamLoads++;
      {
        const proved = this._decodedSync(st);   // proved by its own checksum, or null
        const checked = proved !== null;
        const data = checked ? proved : await this.streamDecoded(st);
        if (!data) { this.note("objstm_undecodable"); this._undecodedStreams.add(stm); continue; }
        const n = numberVal(this.resolve(st.dict.N));
        const first = numberVal(this.resolve(st.dict.First));
        if (n == null || first == null) continue;
        // header: N pairs of "objNum offset"
        const header = binaryString(data.subarray(0, first)).trim().split(/\s+/).map(Number);
        /* The next offset above each, so each object is first read from a window that ends where the next begins. */
        /** @type {number[]} */
        const offs = [];
        for (let i = 0; i < n; i++) { const o = header[i * 2 + 1]; if (o !== undefined && Number.isFinite(o)) offs.push(first + o); }
        offs.sort((a, b) => a - b);
        /** @param {number} at
         *  @returns {number} */
        const nextAbove = (at) => { let lo = 0, hi = offs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (byteAt(offs, m) <= at) lo = m + 1; else hi = m; } return lo < offs.length ? byteAt(offs, lo) : data.length; };
        let added = 0;
        for (let i = 0; i < n; i++) {
          if (tick && i && i % SLICE_OBJECTS === 0) await tick();
          const objNum = header[i * 2];
          const off = header[i * 2 + 1];
          if (objNum === undefined || !Number.isFinite(objNum) || off === undefined || !Number.isFinite(off)) continue;
          if (only && !only.has(objNum)) continue;
          const row = this._objs.row(objNum);
          const ent = xr ? xr.lookup(objNum) : null;
          /* the chain places the object, or nothing does and the file's own order decides: a top-level definition stands, and
             of two object streams' the later one's */
          if (ent ? !(ent.type === 2 && ent.stm === stm) : row >= 0 && byteAt(this._objs.stm, row) < 0) continue;
          const at = first + off;
          const r = parseWindow(data, at, nextAbove(at) - at + 16);
          if (r) { this._objs.put(objNum, Math.trunc(at), r.len + 64, stm, 0, r.value); added++; }
        }
        if (added) {
          this._innerLen.set(stm, data.length);
          /* A stream `inflateChecked` decoded is proved by its own checksum and is read again the same way. One the
             platform's decoder read (with a recovery, or a short stream) is decoded again and the two compared, if it
             is under INNER_CHECK_BYTES, and kept as first decoded if it is not: holding a second copy of a 19 MB
             stream beside the first is what R41 cannot afford. */
          if (!checked) {
            if (data.length <= INNER_CHECK_BYTES) proof = { len: data.length, fp: fingerprint(data) };
            else this._sticky.set(stm, data);
          }
        }
      }
      /* The second decode must give these bytes, or the first is kept for this stream. */
      const pf = proof;
      if (pf) {
        const again = this._decodedSync(st, pf.len);
        if (!again || again.length !== pf.len || fingerprint(again) !== pf.fp) {
          const first = await this.streamDecoded(st);
          if (first) this._sticky.set(stm, first);
        }
      }
    }
  }

  /** R18: locate the catalog and order the pages. Falls back to every /Type /Page in
   *  object-number order if the tree cannot be walked (leniency). */
  buildPageIndex() {
    for (const _ of this._pageIndexSteps()); // eslint-disable-line no-unused-vars
  }

  /** `buildPageIndex` as steps (R45): the tree walk yields every SLICE_OBJECTS nodes it visits.
   *  @returns {Generator<void, void, unknown>} */
  *_pageIndexSteps() {
    /* R8 (c): the catalog is the one the newest trailer's /Root names; the first `/Type /Catalog` in the file only when no
       trailer names one */
    /** @type {PdfMap | null} */
    let root = null;
    const named = asRef(this._trailerValue("Root"));
    if (named) {
      this._objs.pin(named.n);
      const v = this._objs.get(named.n);
      root = mapOf(v);
    }
    if (!root) {
      const cat = this._objs.nums(1, "Catalog")[0];
      if (cat !== undefined) { this._objs.pin(cat); root = catalogMap(this._objs.get(cat)); }
    }
    this.root = root;
    const catalog = this.root;
    let visited = 0;
    /** @param {PdfDoc} self
     *  @param {number} num
     *  @param {Set<number>} seen
     *  @param {number} depth
     *  @returns {Generator<void, void, unknown>} */
    const walkRef = function* (self, num, seen, depth) {
      if (++visited % SLICE_OBJECTS === 0) yield;
      const map = self.dictOf({ t: "ref", n: num, g: 0 });
      if (!map) return;
      const tn = asName(map.Type);
      const type = tn ? tn.v : null;
      if (type === "Page") { self._registerPage(num); return; }
      const kids = asArr(self.resolve(map.Kids));
      if (kids) {
        /* R47: a tree deeper than the bound is not walked further, and says so */
        if (depth >= TREE_DEPTH_MAX) {
          if (!self.notes.some((n) => n.startsWith("over_bound:tree_depth"))) self.note(`over_bound:tree_depth:${depth + 1}:${TREE_DEPTH_MAX}`);
          return;
        }
        for (const kid of kids.items) {
          const kr = asRef(kid);
          if (kr && !seen.has(kr.n)) { seen.add(kr.n); yield* walkRef(self, kr.n, seen, depth + 1); }
        }
      } else if (type !== "Pages") {
        /* a /Kids entry with no /Kids of its own is a page, whether or not it states /Type /Page (R8 (c)) */
        self._registerPage(num);
      }
    };

    const pagesRef = catalog ? asRef(catalog.Pages) : null;
    if (pagesRef) {
      yield* walkRef(this, pagesRef.n, new Set([pagesRef.n]), 0);
    }
    let fallback = false;
    if (this.pageIndexByObj.size === 0) {
      // Fallback: every /Type /Page, by object number.
      const pages = this._objs.nums(3, "Page");
      pages.sort((a, b) => a - b);
      pages.forEach((num, i) => this.pageIndexByObj.set(num, i));
      this.pageCount = pages.length;
      this._pageOrder = pages;
      if (pages.length) { this.note("page_order_by_object_number_fallback"); fallback = true; }
    }
    /* R8 (d): what the file declares and what could be read */
    const tree = catalog ? this.dictOf(catalog.Pages) : null;
    const declared = tree ? this.resolve(tree.Count) : null;
    const missing = typeof declared === "number" && Number.isInteger(declared) && declared > this.pageCount ? declared - this.pageCount : 0;
    if (missing > 0) {
      this.note("structure_reconstructed");
      this.note(`pages_missing:${missing}/${declared}`);
    } else if (fallback && this.notes.includes("xref_reconstructed")) {
      this.note("structure_reconstructed");
    }
  }

  /** @param {number} num */
  _registerPage(num) {
    if (this.pageIndexByObj.has(num)) return;
    const idx = this.pageIndexByObj.size;
    this.pageIndexByObj.set(num, idx);
    this.pageCount = this.pageIndexByObj.size;
    (this._pageOrder ||= []).push(num);
  }

  /** R23: is this an encrypted document? Detected from the Standard Security Handler
   *  dictionary (/Filter /Standard with a revision /R) — which is itself NEVER
   *  encrypted, so this is readable "from the trailer without decrypting
   *  anything" (CPDF-5). Tier 1 has no decryption: strings and streams are
   *  ciphertext, so content streams inflate to garbage and text decode yields
   *  nothing. Rather than degrade to a swarm of undifferentiated
   *  `content_stream_undecodable` notes (the CPDF-5 gap: the failure was silent
   *  as to CAUSE though /Encrypt is right there), we NAME it — a single
   *  `reason:"encrypted"` marker — so the record says WHY and the plane can route
   *  straight to the pdf-worker (I6), whose pdf.js decrypts a permission-only
   *  (empty-user-password) PDF transparently. Cached; call after scanTopLevel.
   *  @returns {boolean} */
  isEncrypted() {
    const known = this._encrypted;
    if (known !== undefined) return known;
    let enc = false;
    for (const num of this._objs.standard()) {
      const v = this._objs.peek(num);
      const map = v && mapOf(v);
      // /V and /R live only on the encryption dict; a page's /Filter is a codec
      // name array, never the bare name "Standard" with a numeric /R beside it.
      if (map && typeof this.resolve(map.R) === "number") { enc = true; break; }
    }
    /* R9, R23: an /Encrypt entry in the newest trailer, direct or by reference, is the same fact */
    if (!enc) { const e = this._trailerValue("Encrypt"); if (e !== undefined && e !== null) enc = true; }
    return (this._encrypted = enc);
  }

  /** The document information dictionary — the trailer's `/Info` (D-251).
   *
   *  TWO SHAPES, because the corpus has both and reading only one would make a
   *  whole class of document silently metadata-less. A classic PDF carries
   *  `trailer << … /Info N 0 R >>`; a modern xref-STREAM PDF (what Legistar and
   *  OpenGov serve, and the class this item was raised about) has no `trailer`
   *  keyword at all and carries `/Info` on its `/Type /XRef` stream dict.
   *
   *  THE LAST ONE IN THE FILE WINS, which is incremental-update semantics
   *  without parsing an xref — the same reasoning `scanTopLevel` already runs
   *  on, so a document that was re-saved reports the metadata it was re-saved
   *  WITH rather than the metadata it was born with.
   *
   *  Returns the resolved dict map, or null. Cached; call after
   *  `loadObjectStreams` so an /Info living inside an object stream resolves.
   *  @returns {PdfMap | null} */
  infoDict() {
    const known = this._info;
    if (known !== undefined) return known;
    /** @type {PdfRef[]} */
    const cands = [];
    for (const map of this._trailers()) { const r = asRef(map.Info); if (r) cands.push(r); }
    for (let i = cands.length - 1; i >= 0; i--) {
      const map = this.dictOf(cands[i]);
      /* A dangling /Info reference is an ABSENCE, so fall back to the previous
         candidate rather than reporting "no metadata" for a file that has some. */
      if (map) return (this._info = map);
    }
    return (this._info = null);
  }

  /** Every trailer dict in file order: each classic `trailer << … >>` and each
   *  `/Type /XRef` stream's own dict, by where it sits. R10 and R37 both choose
   *  from this one list, so the two cannot disagree about which is the last.
   *  @returns {PdfMap[]} */
  _trailers() {
    /** @type {[number, PdfMap][]} */
    const cands = [];
    const b = this._b;
    for (let t = firstAscii(b, "trailer", 0); t !== -1; t = firstAscii(b, "trailer", t + 1)) {
      if (isWordByte(b[t - 1]) || isWordByte(b[t + 7])) continue; // \btrailer\b
      const r = parseWindow(b, t + 7);
      const d = r ? asDict(r.value) : null;
      if (d) cands.push([t, d.map]);
    }
    for (const num of this._objs.nums(2, "XRef")) {
      const v = asStream(this._objs.peek(num));
      if (v) cands.push([v.start, v.dict]);
    }
    return cands.sort((a, b) => a[0] - b[0]).map((c) => c[1]);
  }

  /** R37: the latest revision as a rewrite reads it — the last trailer, every
   *  indirect object reachable from it by any chain of references (each once,
   *  ascending, its value as `resolve` answers it, its generation the one its
   *  winning definition states), and every reference on those chains that
   *  resolves to nothing. An object no chain reaches (an earlier revision's, an
   *  object stream's container) is not in it. Null without a readable trailer;
   *  never throws. The walk is iterative, so a deep or cyclic file cannot
   *  exhaust the stack.
   *  @returns {PdfObjects | null} */
  objects() {
    ARENA = { buf: new ArrayBuffer(32768), off: 0 };
    try {
      const trailers = this._trailers();
      const trailer = trailers[trailers.length - 1];
      if (!trailers.length || !trailer) return null;
      /** @type {PdfObjectEntry[]} */
      const found = [];
      /** @type {Map<number, PdfObjectRef>} */
      const missing = emptyMap();
      /** @type {PdfRef[]} */
      const queue = [];
      const done = new Uint8Array(this._objs.size); // by row: reached
      /** @param {PdfValue | undefined} v */
      const refsIn = (v) => {
        for (const stack = [v]; stack.length;) {
          const x = stack.pop();
          if (!x || typeof x !== "object") continue;
          if (x.t === "ref") queue.push(x);
          else if (x.t === "arr") for (const it of x.items) stack.push(it);
          else if (x.t === "dict" || x.t === "stream") for (const it of Object.values(x.t === "dict" ? x.map : x.dict)) stack.push(it);
        }
      };
      refsIn({ t: "dict", map: trailer });
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        if (!q) continue;
        const { n, g } = q;
        const row = this._objs.row(n);
        if (row >= 0 ? done[row] : missing.has(n)) continue;
        const value = this.resolve({ t: "ref", n, g });
        if (value === null) { missing.set(n, { num: n, gen: g }); if (row >= 0) done[row] = 1; }
        else { done[row] = 1; found.push({ num: n, gen: this._objs.gen(n) ?? 0, value }); }
        refsIn(this._objs.get(n)); // a cycle of bare references still names its members
      }
      queue.length = 0;
      return { trailer, objects: found.sort((a, b) => a.num - b.num), unresolved: [...missing.values()].sort((a, b) => a.num - b.num) };
    } catch {
      return null;
    } finally {
      ARENA = null;
    }
  }
}

/** @param {PdfValue} v
 *  @returns {number | null} */
function numberVal(v) {
  return typeof v === "number" ? v : null;
}
/** A defensive re-parse entry point kept separate so scanTopLevel stays simple.
 *  @param {string} s
 *  @param {number} pos
 *  @param {number} [base]
 *  @returns {Parsed | null} */
function parseValueSafe(s, pos, base = 0) {
  /* `base` is where `s` begins in the file: a stream's `start` is a file offset whatever window was parsed (R41). */
  try { return parseValue(base, s, pos); } catch { return null; }
}

/* ------------------------------------------------------------------ *
 * D-251 — WHO MADE THIS TEXT LAYER, AND THE ONE DIRECTION THE ANSWER
 * IS ALLOWED TO TRAVEL
 * ------------------------------------------------------------------ *
 *
 * A text layer is somebody else's transcription that we decode faithfully
 * through the FILE'S OWN /ToUnicode map, so a perfect decode of a wrong layer
 * is a perfect decode of a wrong layer (CPDF-10). CPDF-9 MEASURED that this is
 * not hypothetical: 3 of 14 recent Legistar attachments name
 * `Creator: ABBYY FineReader Engine 11`, and those three are exactly the City
 * Clerk's ENACTED CERTIFIED RESOLUTIONS (89484, 89498, 89518 CMS) — 300-dpi
 * JBIG2 scans under a machine OCR overlay whose garbage the record has been
 * reading as authored text (MEASUREMENTS.md 2026-08-03 §5).
 *
 * THE DESIGN IS THE DEFAULT, NOT THE TABLE, and that sentence is the whole
 * item. What follows is a DETECTOR, not a classifier of documents:
 *
 *   - A producer string that names OCR software makes the layer's provenance
 *     `ocr` with the PRODUCT NAMED — and the name comes from THE DOCUMENT'S
 *     OWN BYTES, never from the table below. The table decides only whether a
 *     marker is PRESENT; the record then says what the file said.
 *   - Everything else stays `undetermined`. NEVER "authored". An absent marker
 *     is an absent marker: a file may carry no /Info at all, may have been
 *     re-saved by a tool that overwrote the metadata, or may name a product
 *     nobody here has heard of. None of those is evidence that a human typed
 *     the text.
 *   - So THE CLASSIFICATION MAY ONLY EVER MAKE THE CLAIM WEAKER. There is no
 *     value in `PRODUCER_DETERMINATIONS` that strengthens anything, and the
 *     chain composed in `index.mjs` can only ever APPEND a step to the `layer`
 *     step that was already there. That is `CLAUDE.md`'s *undetermined is
 *     first-class and must be STATED*, on one field — and it is why a lookup
 *     table answering in BOTH directions would be the record claiming more
 *     than it can support one field wide on every document in the store.
 *
 * WHAT THIS CANNOT SEE, stated rather than left to be discovered. XMP
 * (`CreatorTool`) is NOT read here: CPDF-9's wider 19-document sweep found it
 * never disagreed with /Info, so a second reader buys nothing today and would
 * put one fact in two places. A wholly image-only scan may carry no metadata
 * at all and is caught structurally instead — zero fonts plus a drawn image is
 * the `no_text_layer` marker (CPDF-5), which is why detection is TWO cheap
 * reads that compose rather than one that has to be complete. And an OCR tool
 * that overwrites /Info with its own PDF-writer name is invisible to this and
 * stays `undetermined`, which is the honest answer rather than a missed
 * detection dressed up as a clean one.
 */

/** The two values this may ever answer, and there is deliberately no third.
 *  "authored" IS NOT A MEMBER AND MUST NEVER BECOME ONE — a marker's absence
 *  cannot establish authorship, and a vocabulary that could say so is a
 *  vocabulary that can STRENGTHEN a claim. R28's test (`test/m/pdf-reader/
 *  pdfdoc.test.mjs`) asserts this array by name for exactly that reason. */
/** @type {readonly ["ocr", "undetermined"]} */
export const PRODUCER_DETERMINATIONS = Object.freeze(["ocr", "undetermined"]);

/** The markers. Every row is a product whose named function IS optical
 *  character recognition, so naming it in producer metadata cannot mean
 *  anything else. This list is allowed to be INCOMPLETE and says so: a name it
 *  does not carry leaves the layer `undetermined`, which is exactly the answer
 *  the record gave before this existed. Adding a row can only ever move a
 *  document from `undetermined` to a NAMED engine — never the other way. */
/** @type {readonly Readonly<{ marker: string, re: RegExp }>[]} */
export const OCR_PRODUCER_MARKERS = Object.freeze([
  /* MEASURED IN THE LIVE RECORD — the reason this item exists (CPDF-9). Both
     spellings are carried because the vendor ships the engine under several
     product names and a second row costs nothing. */
  Object.freeze({ marker: "abbyy", re: /\babbyy\b/i }),
  Object.freeze({ marker: "finereader", re: /\bfine\s?reader\b/i }),
  /* Engines that do nothing else. */
  Object.freeze({ marker: "tesseract", re: /\btesseract\b/i }),
  Object.freeze({ marker: "omnipage", re: /\bomnipage\b/i }),
  Object.freeze({ marker: "readiris", re: /\breadiris\b/i }),
  Object.freeze({ marker: "ocrmypdf", re: /\bocrmypdf\b/i }),
  Object.freeze({ marker: "acrobat-capture", re: /\bacrobat\s+capture\b/i }),
  /* A producer that says OCR ABOUT ITSELF. Anchored on non-alphanumerics so an
     unrelated word that merely contains the letters does not fire. */
  Object.freeze({ marker: "ocr", re: /(^|[^0-9a-z])ocr([^0-9a-z]|$)/i }),
]);

/** Classify a document's producer metadata. PURE — no PDF, no I/O — so the rule
 *  can be driven directly and the `/Info` read can fail independently of it.
 *
 *  `unreadable` is a NAMED cause for metadata that exists and cannot be
 *  trusted. Encryption is the live case: /Info's strings are ciphertext under
 *  the Standard Security Handler, and matching a marker against ciphertext is
 *  matching against noise — an outcome that costs nothing to produce is not
 *  evidence (CLAUDE.md). It classifies NOTHING and publishes NOTHING. */
/** R10: classify producer metadata (see above). Never throws.
 *  @param {ProducerFields} [fields]
 *  @returns {Producer} */
export function classifyProducer({ producer = null, creator = null, unreadable = null } = {}) {
  /** @param {unknown} v
   *  @returns {string | null} */
  const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (unreadable)
    return Object.freeze({ producer: null, creator: null, determination: "undetermined",
                           ocr: null, why: String(unreadable) });
  const p = clean(producer), c = clean(creator);
  /* /Producer first, then /Creator. The order decides only which field is NAMED
     when both carry a marker; either one firing is the same finding. */
  /** @type {["producer" | "creator", string | null][]} */
  const fields = [["producer", p], ["creator", c]];
  for (const [field, value] of fields) {
    if (!value) continue;
    for (const m of OCR_PRODUCER_MARKERS) {
      if (!m.re.test(value)) continue;
      /* THE PRODUCT IS NAMED FROM THE DOCUMENT, NOT FROM THE TABLE. `marker`
         records which row fired, so a false positive is traceable to the row
         that caused it rather than to "the detector". */
      return Object.freeze({ producer: p, creator: c, determination: "ocr", why: null,
        ocr: Object.freeze({ engine: value, field, marker: m.marker }) });
    }
  }
  return Object.freeze({ producer: p, creator: c, determination: "undetermined", ocr: null,
    why: (p || c) ? "no_ocr_marker_in_producer_metadata" : "no_producer_metadata" });
}

/** Read `/Info` off a parsed document and classify it. NEVER THROWS: a metadata
 *  read that fails is an ABSENCE (`info_unreadable`), never a lost document —
 *  the same leniency every other read in this module has. */
/** R10: read `/Info` off a parsed document and classify it. Never throws.
 *  @param {PdfDoc} doc
 *  @returns {Producer} */
export function readProducer(doc) {
  if (doc.isEncrypted()) return classifyProducer({ unreadable: "encrypted" });
  try {
    const info = doc.infoDict();
    if (!info) return classifyProducer({});
    /* A /Producer that is not a STRING — a number, a name, a dangling
       reference — is ABSENT, not guessed at. */
    /** @param {string} k
     *  @returns {string | null} */
    const str = (k) => { const v = asStr(doc.resolve(info[k])); return v ? v.v : null; };
    return classifyProducer({ producer: str("Producer"), creator: str("Creator") });
  } catch {
    return classifyProducer({ unreadable: "info_unreadable" });
  }
}

/* ------------------------------------------------------------------ *
 * Link classification — the PDF analog of subresources.mjs's partitions
 * ------------------------------------------------------------------ */

/** http/https are addresses the record may hold a capture of elsewhere:
 *  deferred, resolved to linked-or-offsite at read time (exactly as HTML).
 *  Everything else a Link action can carry — mailto, javascript, tel, file — is
 *  not an address this system will carry: refused. */
/** @param {string} uri
 *  @returns {"deferred" | "refused"} */
function classifyUri(uri) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(uri || "");
  const scheme = m ? (m[1] ?? "").toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  // A bare relative reference with no scheme is still a web address in intent;
  // treat as deferred so it can be resolved against the record, never invented.
  if (!scheme && uri) return "deferred";
  return "refused";
}

/** An annotation's `/Rect` as four numbers, or null.
 *  @param {PdfDoc} doc
 *  @param {PdfMap} map
 *  @returns {number[] | null} */
function rectOf(doc, map) {
  const r = asArr(doc.resolve(map.Rect));
  if (r && r.items.length === 4) return numbersOf(r.items.map((x) => doc.resolve(x)));
  return null;
}

/** `vals` as numbers when every one is a number, else null.
 *  @param {PdfValue[]} vals
 *  @returns {number[] | null} */
function numbersOf(vals) {
  /** @type {number[]} */
  const nums = [];
  for (const v of vals) { if (typeof v !== "number") return null; nums.push(v); }
  return nums;
}

/** Resolve a destination to a 0-based target page index. A destination is
 *  either an explicit array whose first element is a page (ref or, for remote
 *  go-to, an integer), or a name/string into the /Dests name tree or dict. */
/** @typedef {{ ok: true, page: number } | { ok: false, why: string, dest?: string }} DestResolution */
/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} destIn
 *  @returns {DestResolution} */
function resolveDestination(doc, destIn) {
  const dest = doc.resolve(destIn);
  if (!dest) return { ok: false, why: "dest_absent" };

  // A named destination: look it up first.
  const named = asName(dest) || asStr(dest);
  if (named) {
    const name = named.v;
    const found = lookupNamedDest(doc, name);
    if (!found) return { ok: false, why: "named_dest_unresolved", dest: name };
    return resolveDestination(doc, found);
  }

  const arr = asArr(dest);
  if (arr) {
    const first = arr.items[0];
    const fr = asRef(first);
    if (fr) {
      const page = doc.pageIndexByObj.get(fr.n);
      if (doc.pageIndexByObj.has(fr.n) && page !== undefined)
        return { ok: true, page };
      return { ok: false, why: "dest_page_not_in_tree" };
    }
    if (typeof first === "number") {
      // Remote/embedded go-to page number, 0-based already.
      if (first >= 0 && first < doc.pageCount) return { ok: true, page: first };
      return { ok: false, why: "dest_page_out_of_range" };
    }
    return { ok: false, why: "dest_first_not_page" };
  }
  return { ok: false, why: "dest_shape_unknown" };
}

/** Look a name up in /Root /Dests (a plain name->dest dict, PDF 1.1) or
 *  /Root /Names /Dests (a name tree, PDF 1.2+). Returns the dest value or null. */
/** @param {PdfDoc} doc
 *  @param {string} name
 *  @returns {PdfValue | undefined} */
function lookupNamedDest(doc, name) {
  const root = doc.root;
  if (!root) return null;
  // Old style: /Dests dict on the catalog.
  const dests = doc.dictOf(root.Dests);
  if (dests && name in dests) return unwrapDest(doc, dests[name]);
  // New style: /Names /Dests name tree.
  const names = doc.dictOf(root.Names);
  if (names) {
    const tree = doc.resolve(names.Dests);
    const hit = searchNameTree(doc, tree, name);
    if (hit) return unwrapDest(doc, hit);
  }
  return null;
}

/** A named dest value is often a dict { /D [...] } rather than the array. */
/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @returns {PdfValue | undefined} */
function unwrapDest(doc, v) {
  const d = doc.dictOf(v);
  if (d && d.D) return d.D;
  return v;
}

/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} nodeIn
 *  @param {string} name
 *  @param {number} [depth]
 *  @returns {PdfValue | undefined} */
function searchNameTree(doc, nodeIn, name, depth = 0) {
  const node = asDict(doc.resolve(nodeIn));
  const map = node ? node.map : null;
  if (!map || depth > 64) return null;
  const names = asArr(doc.resolve(map.Names));
  if (names) {
    for (let i = 0; i + 1 < names.items.length; i += 2) {
      const key = asStr(doc.resolve(names.items[i]));
      if (key && key.v === name) return names.items[i + 1];
    }
  }
  const kids = asArr(doc.resolve(map.Kids));
  if (kids) {
    for (const kid of kids.items) {
      // Could honour /Limits to prune; a linear descent is fine at our sizes.
      const hit = searchNameTree(doc, kid, name, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Embedded / attached files -> intra
 * ------------------------------------------------------------------ */

const HEX = "0123456789abcdef";
/** @param {Uint8Array} u8
 *  @returns {string} */
function toHex(u8) {
  let out = "";
  for (let i = 0; i < u8.length; i++) { const b = byteAt(u8, i); out += `${HEX[b >> 4]}${HEX[b & 15]}`; }
  return out;
}
/** @param {Uint8Array} u8
 *  @returns {Promise<string>} */
async function sha256Hex(u8) {
  const d = await crypto.subtle.digest("SHA-256", u8);
  return toHex(new Uint8Array(d));
}

/* R22 — an embedded file is hashed AS IT STREAMS, never held. The platform's digest takes the whole input, so a file of the
 * cap's size (64 MiB) would be held, decoded, beside the copy the digest makes; SHA-256 (FIPS 180-4) is a block function
 * and is run here over each chunk the decoder gives, 64 bytes at a time, so memory is one chunk and one block. */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
class Sha256 {
  /** A digest with nothing yet given to it. */
  constructor() {
    /** @type {Uint32Array} */
    this.h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    /** @type {Uint32Array} */
    this.w = new Uint32Array(64);
    /** @type {Uint8Array} */
    this.block = new Uint8Array(64);
    /** @type {number} */
    this.fill = 0;
    /** @type {number} */
    this.length = 0;
  }
  /** @param {Uint8Array} b
   *  @param {number} at */
  _compress(b, at) {
    const w = this.w, h = this.h;
    for (let i = 0; i < 16; i++) { const j = at + i * 4; w[i] = (byteAt(b, j) << 24) | (byteAt(b, j + 1) << 16) | (byteAt(b, j + 2) << 8) | byteAt(b, j + 3); }
    for (let i = 16; i < 64; i++) {
      const a = byteAt(w, i - 15), c = byteAt(w, i - 2);
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((c >>> 17) | (c << 15)) ^ ((c >>> 19) | (c << 13)) ^ (c >>> 10);
      w[i] = (byteAt(w, i - 16) + s0 + byteAt(w, i - 7) + s1) | 0;
    }
    let a = byteAt(h, 0), b1 = byteAt(h, 1), c = byteAt(h, 2), d = byteAt(h, 3), e = byteAt(h, 4), f = byteAt(h, 5), g = byteAt(h, 6), hh = byteAt(h, 7);
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + byteAt(SHA256_K, i) + byteAt(w, i)) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b1) ^ (a & c) ^ (b1 & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b1; b1 = a; a = (t1 + t2) | 0;
    }
    h[0] = (byteAt(h, 0) + a) | 0; h[1] = (byteAt(h, 1) + b1) | 0; h[2] = (byteAt(h, 2) + c) | 0; h[3] = (byteAt(h, 3) + d) | 0;
    h[4] = (byteAt(h, 4) + e) | 0; h[5] = (byteAt(h, 5) + f) | 0; h[6] = (byteAt(h, 6) + g) | 0; h[7] = (byteAt(h, 7) + hh) | 0;
  }
  /** @param {Uint8Array} u8 */
  update(u8) {
    this.length += u8.length;
    let i = 0;
    if (this.fill) {
      const take = Math.min(64 - this.fill, u8.length);
      this.block.set(u8.subarray(0, take), this.fill);
      this.fill += take; i = take;
      if (this.fill < 64) return;
      this._compress(this.block, 0); this.fill = 0;
    }
    for (; i + 64 <= u8.length; i += 64) this._compress(u8, i);
    if (i < u8.length) { this.block.set(u8.subarray(i), 0); this.fill = u8.length - i; }
  }
  /** @returns {string} */
  hex() {
    const bits = this.length * 8;
    const pad = new Uint8Array(((this.fill < 56 ? 56 : 120) - this.fill) + 8);
    pad[0] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, Math.floor(bits / 4294967296));
    dv.setUint32(pad.length - 4, bits >>> 0);
    const len = this.length;
    this.update(pad);
    this.length = len;
    let out = "";
    for (const x of this.h) out += (x >>> 0).toString(16).padStart(8, "0");
    return out;
  }
}

/** Flate `u8` (zlib) through the platform's decoder, each chunk given to `sink` and none kept: `{ total }` for a clean decode,
 *  `{ over }` as soon as the output passes `cap`, `null` when the decoder refuses the stream (anything `sink` has taken is then
 *  not to be used). */
/** @param {Uint8Array} u8
 *  @param {number} cap
 *  @param {(chunk: Uint8Array) => void} sink
 *  @returns {Promise<{ total: number, over?: undefined } | { over: number, total?: undefined } | null>} */
async function streamInflated(u8, cap, sink) {
  const reader = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) { await reader.cancel().catch(() => {}); return { over: total }; }
      sink(value);
    }
  } catch {
    return null;
  }
  return { total };
}

/** An embedded file's bytes are content-addressed exactly as a bundle
 *  companion is, so an embedded file that we can resolve to bytes is `intra`
 *  under the same wrapper. If the stream cannot be decoded this phase, it is
 *  undetermined — recorded, never invented. */
/** R5: an embedded file's record: `intra` with its hash when its stream resolves to bytes, else `undetermined`. A record
 *  from the document's tree (`sourcePage` null) has no source; one from an annotation has its page and rect.
 *  @param {PdfDoc} doc
 *  @param {PdfValue | undefined} filespec
 *  @param {number | null} sourcePage
 *  @param {number[] | null} rect
 *  @param {string | null} name
 *  @returns {Promise<IntraLink | UndeterminedLink>} */
async function embeddedFileRecord(doc, filespec, sourcePage, rect, name) {
  /* an annotation's record (a page) carries `{ page, rect }` as its source; the tree's (no page) carries `{ page: null, rect: null }`
     on its undetermined records, as it always has */
  /** @type {LinkPlace} */
  const where = { page: sourcePage, rect };
  const fs = doc.dictOf(filespec);
  if (!fs) return undeterminedRecord(where, "embedded_filespec_unresolved", { name });
  const ef = doc.dictOf(fs.EF);
  const streamRef = ef && (ef.F || ef.UF || ef.DOS || ef.Mac || ef.Unix);
  const stream = asStream(doc.resolve(streamRef));
  const label = embeddedName(doc, fs, name);
  if (!stream)
    return undeterminedRecord(where, "embedded_stream_absent", { name: label });
  /* R22: hashed as it streams where the stream allows it (unfiltered, or one Flate stage with no predictor); anything else is
   * decoded whole, up to the same cap, as before */
  /** @type {string} */
  let sha;
  /** @type {number} */
  let size;
  const streamed = await doc.streamDigest(stream);
  if (streamed && streamed.sha) ({ sha, bytes: size } = streamed);
  else if (streamed && streamed.over) return undeterminedRecord(where, "embedded_stream_undecodable", { name: label });
  else {
    const bytes = await doc.streamDecoded(stream, "embedded_file");
    if (!bytes)
      return undeterminedRecord(where, "embedded_stream_undecodable", { name: label });
    sha = await sha256Hex(bytes);
    size = bytes.length;
  }
  return {
    partition: "intra",
    wrapper: linkWrapper.intra(sha),
    target: { sha256: sha, name: label, bytes: size },
    source: sourcePage == null ? null : { page: sourcePage, rect: rect || null },
  };
}

/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @returns {string | null} */
function strOf(doc, v) {
  const s = asStr(doc.resolve(v));
  return s ? s.v : null;
}

/** An embedded file's filing label (R5's `name`): the given label (an
 *  annotation's /Contents, a tree's key), else the file specification's own
 *  /UF or /F, else null. `fs` is the resolved file specification, or null. */
/** @param {PdfDoc} doc
 *  @param {PdfMap | null} fs
 *  @param {string | null} given
 *  @returns {string | null} */
function embeddedName(doc, fs, given) {
  return given || (fs && (strOf(doc, fs.UF) || strOf(doc, fs.F))) || null;
}

/* ------------------------------------------------------------------ *
 * Record builders
 * ------------------------------------------------------------------ */

/** @param {string} uri
 *  @param {LinkSource} source
 *  @returns {UriLink} */
function deferredOrRefusedRecord(uri, source) {
  const partition = classifyUri(uri);
  return {
    partition,
    wrapper: partition === "deferred" ? linkWrapper.deferred(uri) : linkWrapper.refused(),
    target: { url: uri },
    source,
  };
}

/** @param {PdfDoc} doc
 *  @param {number} targetPage
 *  @param {LinkSource} source
 *  @param {string | null} destName
 *  @returns {AnchorLink} */
function anchorRecord(doc, targetPage, source, destName) {
  const fragment = `#page=${targetPage + 1}`; // 1-based, PDF open-parameter form
  return {
    partition: "anchor",
    wrapper: linkWrapper.anchor(fragment),
    target: { page: targetPage, fragment, dest: destName ?? null },
    source,
  };
}

/** @param {LinkPlace | null} source
 *  @param {string} why
 *  @param {UndeterminedExtra} [extra]
 *  @returns {UndeterminedLink} */
function undeterminedRecord(source, why, extra = {}) {
  return { partition: "undetermined", wrapper: null, target: { why, ...extra }, source };
}

/* ================================================================== *
 * Tier 1 text extraction (QUEUE CPDF-4)
 *
 * The prose half, pure JS: read the text-showing operators out of each page's
 * content stream(s) and decode the shown bytes through the font's /ToUnicode
 * CMap. Nothing here guesses. A byte a font's /ToUnicode does not cover, or a
 * font that carries no /ToUnicode at all, produces an `undetermined` marker
 * naming the font — never a substituted or best-effort character.
 * ================================================================== */

/* ---- content-stream lexer (a postfix grammar, unlike the object grammar) ---- *
 * Tokens: { t:"str", bytes:[…0-255] } (raw shown bytes — NOT decoded as text,
 * because the bytes ARE the character codes the font maps), { t:"num", v },
 * { t:"name", v }, { t:"op", v }, and the array/dict delimiters. */
/** @param {string} s
 *  @param {TokenizeOptions} [opts]
 *  @returns {Generator<ContentToken, void, unknown>} */
function* tokenizeContent(s, opts = {}) {
  /* CPDF-18: `inlineImages` skips an inline image's binary data (the bytes
     between `ID` and `EI`), which would otherwise be read as operators. It is
     OFF for the Tier-1 text walk, whose output is measured and pinned, and ON
     only for the image walk (`pdfPageImages`), which is where a stray `Q` or
     `cm` inside sample bytes would move the graphics state. */
  const skipInline = opts.inlineImages === true;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (isWhitespace(c)) { i++; continue; }
    if (c === 0x25) { // % comment to EOL
      while (i < n && s.charCodeAt(i) !== 0x0a && s.charCodeAt(i) !== 0x0d) i++;
      continue;
    }
    if (c === 0x28) { const r = readLiteralBytes(s, i); yield { t: "str", bytes: r.bytes }; i = r.pos; continue; }
    if (c === 0x3c) {
      if (s.charCodeAt(i + 1) === 0x3c) { yield { t: "dict_open" }; i += 2; continue; }
      const r = readHexBytes(s, i); yield { t: "str", bytes: r.bytes }; i = r.pos; continue;
    }
    if (c === 0x3e && s.charCodeAt(i + 1) === 0x3e) { yield { t: "dict_close" }; i += 2; continue; }
    if (c === 0x5b) { yield { t: "arr_open" }; i++; continue; }
    if (c === 0x5d) { yield { t: "arr_close" }; i++; continue; }
    if (c === 0x2f) { const r = readContentName(s, i); yield { t: "name", v: r.v }; i = r.pos; continue; }
    if (c === 0x2b || c === 0x2d || c === 0x2e || (c >= 0x30 && c <= 0x39)) {
      const r = readContentNumber(s, i); yield { t: "num", v: r.v }; i = r.pos; continue;
    }
    // an operator: a run of regular characters (letters, and ' " * which are ops)
    const start = i;
    while (i < n) {
      const cc = s.charCodeAt(i);
      if (isWhitespace(cc) || isDelimiter(cc)) break;
      i++;
    }
    if (i > start) {
      const op = s.slice(start, i);
      yield { t: "op", v: op };
      if (skipInline && op === "ID") {
        /* One whitespace byte ends `ID`; the data runs to the first `EI` that
           stands alone after whitespace and before whitespace or a delimiter. */
        const re = /\sEI(?=[\s/[<(]|$)/g;
        re.lastIndex = i + 1;
        const m = re.exec(s);
        i = m ? m.index + 1 : n;
      }
    }
    else i++; // never stall
  }
}

/** D-608: the bytes a token list's text-showing operators (`Tj`, `TJ`, `'`,
 *  `"`) carry — what a form this walk could not enter would have shown. Bytes,
 *  not characters: no font is selected to say how wide a code is. */
/** @param {Iterable<ContentToken, void, undefined>} toks
 *  @returns {number} */
function textShowBytes(toks) {
  let n = 0;
  /** @type {number[]} */
  const pending = [];
  for (const tk of toks) {
    if (tk.t !== "op") { if (tk.t === "str") pending.push(tk.bytes.length); continue; }
    if (tk.v === "Tj" || tk.v === "TJ" || tk.v === "'" || tk.v === '"') for (const b of pending) n += b;
    pending.length = 0;
  }
  return n;
}

/** E2: while `objects()` reads (the whole list is held, and 135,000 strings of 15 bytes as 135,000 typed arrays of their
 *  own were 240 bytes each), a string's bytes are a view of a 32 KB chunk made for that call alone. A chunk is never
 *  shared between calls, so no document's bytes are reachable from another's. */
/** @type {{ buf: ArrayBuffer, off: number } | null} */
let ARENA = null;
/** @param {number} n
 *  @returns {Uint8Array} */
function newBytes(n) {
  const arena = ARENA;
  if (!arena || n > 512) return new Uint8Array(n);
  const chunk = arena.off + n > arena.buf.byteLength ? (ARENA = { buf: new ArrayBuffer(32768), off: 0 }) : arena;
  const u = new Uint8Array(chunk.buf, chunk.off, n);
  chunk.off += n;
  return u;
}

/** Read a literal ( … ) string as its BYTES, per ISO 32000-1 §7.3.4.2: the
 *  escapes decoded, `\` before an end-of-line a continuation (CR LF is one
 *  end-of-line), an unknown escape the character after it, nested parens kept,
 *  and an end-of-line written without a backslash (CR, LF or CR LF) one 0x0A.
 *  The one literal reader: object strings (R38) and the content lexer's shown
 *  runs, whose bytes are the codes the font maps. `s` is one unit per byte
 *  (`binaryString`). */
/** @param {string} s
 *  @param {number} pos
 *  @returns {{ bytes: Uint8Array, pos: number }} */
function readLiteralBytes(s, pos) {
  pos++; // (
  /* The common string has no escape, no nesting and no carriage return: its bytes are the text up to the closing
     parenthesis, copied once. */
  let q = pos;
  while (q < s.length) {
    const c = s.charCodeAt(q);
    if (c === 0x29 || c === 0x28 || c === 0x5c || c === 0x0d) break;
    q++;
  }
  if (q < s.length && s.charCodeAt(q) === 0x29) {
    const out = newBytes(q - pos);
    for (let i = 0; i < out.length; i++) out[i] = s.charCodeAt(pos + i);
    return { bytes: out, pos: q + 1 };
  }
  /** @type {number[]} */
  const bytes = [];
  let depth = 1;
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if (c === 0x5c) { // backslash
      if (pos + 1 >= s.length) { pos++; break; }
      const nc = s.charCodeAt(pos + 1);
      if (nc >= 0x30 && nc <= 0x37) { // octal, up to 3 digits
        let v = nc - 0x30, p = pos + 2;
        for (let n = 1; n < 3 && p < s.length; n++, p++) {
          const d = s.charCodeAt(p);
          if (d < 0x30 || d > 0x37) break;
          v = v * 8 + d - 0x30;
        }
        bytes.push(v & 0xff); pos = p; continue;
      }
      switch (nc) {
        case 110: bytes.push(0x0a); pos += 2; continue;  // n
        case 114: bytes.push(0x0d); pos += 2; continue;  // r
        case 116: bytes.push(0x09); pos += 2; continue;  // t
        case 98: bytes.push(0x08); pos += 2; continue;   // b
        case 102: bytes.push(0x0c); pos += 2; continue;  // f
        case 40: bytes.push(0x28); pos += 2; continue;   // (
        case 41: bytes.push(0x29); pos += 2; continue;   // )
        case 92: bytes.push(0x5c); pos += 2; continue;   // \
        case 0x0a: pos += 2; continue;                    // line continuation
        case 0x0d: pos += s.charCodeAt(pos + 2) === 0x0a ? 3 : 2; continue;
        default: bytes.push(nc); pos += 2; continue;     // unknown escape: literal next
      }
    }
    if (c === 0x0d) { bytes.push(0x0a); pos += s.charCodeAt(pos + 1) === 0x0a ? 2 : 1; continue; }
    if (c === 0x28) { depth++; bytes.push(0x28); pos++; continue; }
    if (c === 0x29) { depth--; if (depth === 0) { pos++; break; } bytes.push(0x29); pos++; continue; }
    bytes.push(c); pos++;
  }
  const out = newBytes(bytes.length);
  out.set(bytes);
  return { bytes: out, pos };
}

/** Read a < … > hex string as its bytes: whitespace (and any other non-digit)
 *  skipped, an odd final digit read as followed by 0. */
/** @param {string} s
 *  @param {number} pos
 *  @returns {{ bytes: Uint8Array, pos: number }} */
function readHexBytes(s, pos) {
  pos++; // <
  let hex = "";
  while (pos < s.length && s.charCodeAt(pos) !== 0x3e) {
    const ch = s.charAt(pos);
    if (/[0-9a-fA-F]/.test(ch)) hex += ch;
    pos++;
  }
  pos++; // >
  if (hex.length % 2) hex += "0";
  const bytes = newBytes(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return { bytes, pos };
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {{ v: string, pos: number }} */
function readContentName(s, pos) {
  pos++; // /
  let out = "";
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if (isWhitespace(c) || isDelimiter(c)) break;
    if (c === 0x23 && pos + 2 < s.length) {
      const h = parseInt(s.substr(pos + 1, 2), 16);
      if (!Number.isNaN(h)) { out += String.fromCharCode(h); pos += 3; continue; }
    }
    out += s[pos]; pos++;
  }
  return { v: out, pos };
}

/** @param {string} s
 *  @param {number} pos
 *  @returns {{ v: number, pos: number }} */
function readContentNumber(s, pos) {
  const start = pos;
  if (s.charCodeAt(pos) === 0x2b || s.charCodeAt(pos) === 0x2d) pos++;
  while (pos < s.length) {
    const c = s.charCodeAt(pos);
    if ((c >= 0x30 && c <= 0x39) || c === 0x2e) pos++;
    else break;
  }
  const v = parseFloat(s.slice(start, pos));
  return { v: Number.isNaN(v) ? 0 : v, pos };
}

/* R41 — THE SAME LEXER OVER BYTES. `tokenizeContent` reads a string with one unit a byte; a page of 60 MiB made a string of
 * 60 MiB beside its bytes, and with the text the walk builds the heap of a 128 MB object was gone before the bound
 * (a 40 MiB page of text needed 79 MB live, a 60 MiB page did not fit). `tokenizeContentBytes` yields the same tokens, read
 * from the bytes themselves; `content-lexer` tests it token for token against `tokenizeContent` on random streams. */
/** @param {Uint8Array} b
 *  @param {TokenizeOptions} [opts]
 *  @returns {Generator<ContentToken, void, unknown>} */
function* tokenizeContentBytes(b, opts = {}) {
  const skipInline = opts.inlineImages === true;
  let i = 0;
  const n = b.length;
  while (i < n) {
    const c = b[i] ?? NaN;
    if (isWhitespace(c)) { i++; continue; }
    if (c === 0x25) { while (i < n && b[i] !== 0x0a && b[i] !== 0x0d) i++; continue; }
    if (c === 0x28) { const r = readLiteralBytesU8(b, i); yield { t: "str", bytes: r.bytes }; i = r.pos; continue; }
    if (c === 0x3c) {
      if (b[i + 1] === 0x3c) { yield { t: "dict_open" }; i += 2; continue; }
      const r = readHexBytesU8(b, i); yield { t: "str", bytes: r.bytes }; i = r.pos; continue;
    }
    if (c === 0x3e && b[i + 1] === 0x3e) { yield { t: "dict_close" }; i += 2; continue; }
    if (c === 0x5b) { yield { t: "arr_open" }; i++; continue; }
    if (c === 0x5d) { yield { t: "arr_close" }; i++; continue; }
    if (c === 0x2f) { const r = readContentNameU8(b, i); yield { t: "name", v: r.v }; i = r.pos; continue; }
    if (c === 0x2b || c === 0x2d || c === 0x2e || (c >= 0x30 && c <= 0x39)) {
      const r = readContentNumberU8(b, i); yield { t: "num", v: r.v }; i = r.pos; continue;
    }
    const start = i;
    while (i < n) {
      const cc = b[i];
      if (isWhitespace(cc) || isDelimiter(cc)) break;
      i++;
    }
    if (i > start) {
      let op = "";
      for (let k = start; k < i; k++) op += String.fromCharCode(byteAt(b, k));
      yield { t: "op", v: op };
      if (skipInline && op === "ID") {
        /* the first `EI` that stands alone after white space (as JavaScript reads `\s`) and before white space, a
           delimiter of `/[<(`, or the end */
        let j = i + 1, found = -1;
        for (; j + 2 < n; j++) {
          if (isJsSpaceByte(b[j]) && b[j + 1] === 0x45 && b[j + 2] === 0x49) {
            const a = b[j + 3];
            if (j + 3 >= n || isJsSpaceByte(a) || a === 0x2f || a === 0x5b || a === 0x3c || a === 0x28) { found = j; break; }
          }
        }
        i = found >= 0 ? found + 1 : n;
      }
    }
    else i++; // never stall
  }
}

/** @param {Uint8Array} b
 *  @param {number} pos
 *  @returns {{ bytes: Uint8Array, pos: number }} */
function readLiteralBytesU8(b, pos) {
  pos++; // (
  let q = pos;
  while (q < b.length) {
    const c = b[q];
    if (c === 0x29 || c === 0x28 || c === 0x5c || c === 0x0d) break;
    q++;
  }
  if (q < b.length && b[q] === 0x29) {
    const out = newBytes(q - pos);
    out.set(b.subarray(pos, q));
    return { bytes: out, pos: q + 1 };
  }
  /** @type {number[]} */
  const bytes = [];
  let depth = 1;
  while (pos < b.length) {
    const c = byteAt(b, pos);
    if (c === 0x5c) {
      if (pos + 1 >= b.length) { pos++; break; }
      const nc = byteAt(b, pos + 1);
      if (nc >= 0x30 && nc <= 0x37) {
        let v = nc - 0x30, p = pos + 2;
        for (let k = 1; k < 3 && p < b.length; k++, p++) {
          const d = byteAt(b, p);
          if (d < 0x30 || d > 0x37) break;
          v = v * 8 + d - 0x30;
        }
        bytes.push(v & 0xff); pos = p; continue;
      }
      switch (nc) {
        case 110: bytes.push(0x0a); pos += 2; continue;
        case 114: bytes.push(0x0d); pos += 2; continue;
        case 116: bytes.push(0x09); pos += 2; continue;
        case 98: bytes.push(0x08); pos += 2; continue;
        case 102: bytes.push(0x0c); pos += 2; continue;
        case 40: bytes.push(0x28); pos += 2; continue;
        case 41: bytes.push(0x29); pos += 2; continue;
        case 92: bytes.push(0x5c); pos += 2; continue;
        case 0x0a: pos += 2; continue;
        case 0x0d: pos += b[pos + 2] === 0x0a ? 3 : 2; continue;
        default: bytes.push(nc); pos += 2; continue;
      }
    }
    if (c === 0x0d) { bytes.push(0x0a); pos += b[pos + 1] === 0x0a ? 2 : 1; continue; }
    if (c === 0x28) { depth++; bytes.push(0x28); pos++; continue; }
    if (c === 0x29) { depth--; if (depth === 0) { pos++; break; } bytes.push(0x29); pos++; continue; }
    bytes.push(c); pos++;
  }
  const out = newBytes(bytes.length);
  out.set(bytes);
  return { bytes: out, pos };
}

/** @param {Uint8Array} b
 *  @param {number} pos
 *  @returns {{ bytes: Uint8Array, pos: number }} */
function readHexBytesU8(b, pos) {
  pos++; // <
  /** @type {number[]} */
  const digits = [];
  while (pos < b.length && b[pos] !== 0x3e) {
    const c = byteAt(b, pos);
    const d = c >= 0x30 && c <= 0x39 ? c - 0x30 : c >= 0x41 && c <= 0x46 ? c - 0x37 : c >= 0x61 && c <= 0x66 ? c - 0x57 : -1;
    if (d >= 0) digits.push(d);
    pos++;
  }
  pos++; // >
  if (digits.length % 2) digits.push(0);
  const bytes = newBytes(digits.length / 2);
  for (let k = 0; k < digits.length; k += 2) bytes[k / 2] = (byteAt(digits, k) << 4) | byteAt(digits, k + 1);
  return { bytes, pos };
}

/** @param {Uint8Array} b
 *  @param {number} pos
 *  @returns {{ v: string, pos: number }} */
function readContentNameU8(b, pos) {
  pos++; // /
  let out = "";
  while (pos < b.length) {
    const c = byteAt(b, pos);
    if (isWhitespace(c) || isDelimiter(c)) break;
    if (c === 0x23 && pos + 2 < b.length) {
      const h = parseInt(String.fromCharCode(byteAt(b, pos + 1), byteAt(b, pos + 2)), 16);
      if (!Number.isNaN(h)) { out += String.fromCharCode(h); pos += 3; continue; }
    }
    out += String.fromCharCode(c); pos++;
  }
  return { v: out, pos };
}

/** @param {Uint8Array} b
 *  @param {number} pos
 *  @returns {{ v: number, pos: number }} */
function readContentNumberU8(b, pos) {
  const start = pos;
  if (b[pos] === 0x2b || b[pos] === 0x2d) pos++;
  while (pos < b.length) {
    const c = byteAt(b, pos);
    if ((c >= 0x30 && c <= 0x39) || c === 0x2e) pos++;
    else break;
  }
  let t = "";
  for (let k = start; k < pos; k++) t += String.fromCharCode(byteAt(b, k));
  const v = parseFloat(t);
  return { v: Number.isNaN(v) ? 0 : v, pos };
}

/* ---- /ToUnicode CMap parsing ---- *
 * A CMap maps a character CODE (1+ bytes) to a Unicode string. We need only the
 * bfchar/bfrange sections (and the codespacerange, which tells us how many bytes
 * a code is). Everything else in the CMap is PostScript we ignore. */

/** Interpret a hex run as UTF-16BE code units → a JS string. ToUnicode targets
 *  are UTF-16BE; a single-byte target (2 hex) is treated as one code point. */
/** @param {string} hex
 *  @returns {string} */
function hexToUnicode(hex) {
  if (hex.length <= 2) return String.fromCharCode(parseInt(hex || "0", 16));
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
  if (hex.length % 4 === 2) out += String.fromCharCode(parseInt(hex.substr(hex.length - 2, 2), 16));
  return out;
}

/** Increment the LAST 16-bit unit of a UTF-16BE hex target by `off` — the
 *  bfrange incrementing form: <lo> <hi> <dst> maps lo→dst, lo+1→dst+1, … */
/** @param {string} hex
 *  @param {number} off
 *  @returns {string} */
function unicodeIncr(hex, off) {
  /** @type {number[]} */
  const units = [];
  for (let i = 0; i + 4 <= hex.length; i += 4) units.push(parseInt(hex.substr(i, 4), 16));
  if (units.length === 0) return String.fromCharCode((parseInt(hex || "0", 16) + off) & 0xffff);
  units[units.length - 1] = (byteAt(units, units.length - 1) + off) & 0xffff;
  return units.map((u) => String.fromCharCode(u)).join("");
}

/** A /ToUnicode map (R12): single codes in a Map, a `bfrange` of at most BFRANGE_CODES_MAX codes expanded into it, a larger
 *  one kept as the arithmetic it is. `get(code)` answers what full expansion of every section, in the order the CMap states
 *  them, would answer. */
class ToUnicodeMap {
  /** An empty map. */
  constructor() {
    /** @type {Map<number, string>} */
    this.map = emptyMap();
    /** @type {{ lo: number, hi: number, dst: string }[]} */
    this.ranges = [];
  }
  /** @returns {number} */
  get size() { return this.map.size + this.ranges.length; }
  /** @param {number} code
   *  @returns {string | undefined} */
  get(code) {
    const u = this.map.get(code);
    if (u !== undefined) return u;
    for (let i = this.ranges.length - 1; i >= 0; i--) {
      const r = this.ranges[i];
      if (r && code >= r.lo && code <= r.hi) return unicodeIncr(r.dst, code - r.lo);
    }
    return undefined;
  }
  /** A range too large to expand: it replaces whatever earlier entries sit inside it, as expansion would.
   *  @param {number} lo
   *  @param {number} hi
   *  @param {string} dst */
  addRange(lo, hi, dst) {
    for (const k of [...this.map.keys()]) if (k >= lo && k <= hi) this.map.delete(k);
    this.ranges.push({ lo, hi, dst });
  }
}

/** One codespace range: its code width and bounds. @typedef {{ n: number, lo: number, hi: number }} CodeSpace */
/** A CMap's codespace ranges when they are of several widths, and those widths ascending.
 *  @typedef {{ list: CodeSpace[], widths: number[] }} CodeSpaces */
/** @param {string} text
 *  @returns {{ map: ToUnicodeMap, width: number, spaces: CodeSpaces | null }} */
function parseToUnicodeCMap(text) {
  const map = new ToUnicodeMap();
  /** @type {number | null} */
  let width = null;
  /* every codespace range, not the first (R12): codes of different widths in one CMap are each read at the width their range gives */
  /** @type {CodeSpace[]} */
  const spaces = [];
  for (const blk of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    const toks = (blk[1] ?? "").match(/<([0-9a-fA-F]+)>/g) || [];
    for (let i = 0; i + 1 < toks.length; i += 2) {
      const lo = (toks[i] ?? "").slice(1, -1), hi = (toks[i + 1] ?? "").slice(1, -1);
      const n = Math.max(1, Math.round(lo.length / 2)), l = parseInt(lo, 16), h = parseInt(hi, 16);
      if (Number.isFinite(l) && Number.isFinite(h)) spaces.push({ n, lo: l, hi: h });
    }
    const t0 = toks[0];
    if (width == null && toks.length && t0 !== undefined) width = Math.max(1, Math.round((t0.length - 2) / 2));
  }

  for (const m of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const toks = (m[1] ?? "").match(/<([0-9a-fA-F]*)>/g) || [];
    for (let i = 0; i + 1 < toks.length; i += 2) {
      const src = (toks[i] ?? "").replace(/[<>]/g, "");
      const dst = (toks[i + 1] ?? "").replace(/[<>]/g, "");
      if (!src) continue;
      map.map.set(parseInt(src, 16), hexToUnicode(dst));
      if (width == null) width = Math.max(1, Math.round(src.length / 2));
    }
  }

  for (const m of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    parseBfrange(m[1] ?? "", map, (w) => { if (width == null) width = w; });
  }

  const widths = [...new Set(spaces.map((s) => s.n))].sort((a, b) => a - b);
  return { map, width: width ?? 1, spaces: widths.length > 1 ? { list: spaces, widths } : null };
}

/** bfrange has two target forms: an incrementing hex target, and an explicit
 *  [ <..> <..> … ] array (one target per code in the range). Tokenise the block
 *  into hex atoms and arrays, then consume triples. */
/** @param {string} blk
 *  @param {ToUnicodeMap} cmap
 *  @param {(w: number) => void} seenWidth
 *  @returns {void} */
function parseBfrange(blk, cmap, seenWidth) {
  const map = cmap.map;
  /** @type {({ t: "hex", v: string } | { t: "arr", v: string[] })[]} */
  const tokens = [];
  let i = 0;
  while (i < blk.length) {
    const c = blk[i];
    if (c === "<") {
      const j = blk.indexOf(">", i);
      if (j === -1) break;
      tokens.push({ t: "hex", v: blk.slice(i + 1, j).replace(/[^0-9a-fA-F]/g, "") });
      i = j + 1;
    } else if (c === "[") {
      const j = blk.indexOf("]", i);
      if (j === -1) break;
      const arr = (blk.slice(i + 1, j).match(/<([0-9a-fA-F]*)>/g) || []).map((h) => h.replace(/[<>]/g, ""));
      tokens.push({ t: "arr", v: arr });
      i = j + 1;
    } else i++;
  }
  for (let k = 0; k + 2 < tokens.length; k += 3) {
    const lo = tokens[k], hi = tokens[k + 1], dst = tokens[k + 2];
    if (!lo || !hi || !dst) continue; // `k + 2 < tokens.length`: all three are there
    if (lo.t !== "hex" || hi.t !== "hex") { k -= 2; k += 1; continue; }
    const loN = parseInt(lo.v, 16), hiN = parseInt(hi.v, 16);
    seenWidth(Math.max(1, Math.round(lo.v.length / 2)));
    if (dst.t === "arr") {
      for (let code = loN, idx = 0; code <= hiN && idx < dst.v.length; code++, idx++) map.set(code, hexToUnicode(dst.v[idx] ?? ""));
    } else if (hiN - loN >= BFRANGE_CODES_MAX) {
      /* R12 (G125f): a range of more codes than the bound is looked up arithmetically, never expanded */
      cmap.addRange(loN, hiN, dst.v);
    } else {
      for (let code = loN, off = 0; code <= hiN && off <= hiN - loN; code++, off++) map.set(code, unicodeIncr(dst.v, off));
    }
  }
}

/* ---- fonts ---- */

/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @returns {string | null} */
function nameOf(doc, v) {
  const n = asName(doc.resolve(v));
  return n ? n.v : null;
}

/** Load a font's decoding info: its /ToUnicode map (or null), the code width in
 *  bytes, whether it is a composite (Type0/CID) font, and a name to report when
 *  something cannot be decoded. */
/** A font's decoding info (R12, R13): its code map, code width, codespace ranges and advance widths.
 *  @typedef {{ subtype: string | null, isType0: boolean, baseFont: string | null, toUni: ToUnicodeMap | null, width: number,
 *    spaces: CodeSpaces | null, widths: ((code: number) => number) | null, widthsWhy: string | null }} FontInfo */
/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} fontVal
 *  @returns {Promise<FontInfo | null>} */
async function loadFont(doc, fontVal) {
  const map = doc.dictOf(fontVal);
  if (!map) return null;
  const subtype = nameOf(doc, map.Subtype);
  const isType0 = subtype === "Type0";
  let baseFont = nameOf(doc, map.BaseFont);
  if (!baseFont && isType0) {
    // A Type0's descendant CIDFont may carry the BaseFont.
    const desc = asArr(doc.resolve(map.DescendantFonts));
    if (desc && desc.items.length) baseFont = nameOf(doc, doc.dictOf(desc.items[0])?.BaseFont);
  }
  /** @type {ToUnicodeMap | null} */
  let toUni = null;
  /** @type {number | null} */
  let width = null;
  /** @type {CodeSpaces | null} */
  let spaces = null;
  const tu = asStream(doc.resolve(map.ToUnicode));
  if (tu) {
    const data = await doc.streamDecoded(tu, "cmap");
    if (data) {
      const parsed = parseToUnicodeCMap(binaryString(data));
      if (parsed.map.size) { toUni = parsed.map; width = parsed.width; spaces = parsed.spaces; }
    }
  }
  const codeWidth = width ?? (isType0 ? 2 : 1); // composite codes are ≥2 bytes in practice; simple fonts are 1
  const w = fontWidths(doc, map, subtype, isType0);
  return { subtype, isType0, baseFont, toUni, width: codeWidth, spaces, widths: w.widths, widthsWhy: w.why };
}

/* D-502 — GLYPH ADVANCE WIDTHS, SO THE PEN HAS A POSITION.
 *
 * D-481 made a line break on a BASELINE move rather than on any positioning
 * operator, and said in the same breath what that cost: two runs on ONE
 * baseline separated only by a horizontal jump — a table row's cells, a
 * footer's left and right halves — were concatenated into one token, because
 * nothing here knew where the pen had got to. Measured on the Legistar agenda
 * as `OaklandPrinted` and `5:26:26PM` (M-133; 0.32% of that document's tokens).
 *
 * A jump can only be judged against where the pen WAS, and the pen only moves
 * by the width of what was shown. So the widths are read from the file:
 *
 *   - a SIMPLE font (Type1, TrueType, Type3) declares /FirstChar and /Widths,
 *     indexed by character code, with /FontDescriptor /MissingWidth for a code
 *     outside the array (ISO 32000-1 §9.6.2.1);
 *   - a COMPOSITE font's descendant CIDFont declares /DW (default 1000) and a
 *     /W array in two alternating shapes — `c [w …]` and `cFirst cLast w`
 *     (§9.7.4.3).
 *
 * EVERY WIDTH RETURNED IS IN TEXT SPACE, never glyph space: a simple font's
 * and a CIDFont's glyph space is 1/1000 of text space, and a Type3 font's is
 * whatever its own /FontMatrix says, so the [0] entry is read rather than the
 * 1/1000 assumed. A Type3 with no readable /FontMatrix yields NO widths.
 *
 * WHEN THE WIDTHS ARE NOT KNOWN THE ANSWER IS `null` AND THE PEN GOES UNKNOWN
 * WITH IT — it is never filled in from a default, an average or the font size.
 * This is the whole safety property of D-502: a document whose widths this
 * reader cannot establish reads EXACTLY as D-481 left it, because a break
 * placed on an invented width is an invented break, and the record would have
 * no way to tell one from a real one. `widthsWhy` names which case it was.
 *
 * THE ONE MAPPING THIS DOES NOT DO, stated rather than left to be found: a
 * composite font's code→CID mapping is taken as the IDENTITY, which is what
 * /Identity-H and /Identity-V mean and what every composite font in this
 * project's PDF corpus uses. Any other /Encoding — a predefined CMap by name,
 * or an embedded CMap stream — yields NO widths (`cid_encoding_not_identity`)
 * rather than widths read at the wrong index. */
/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @returns {number | null} */
function numOf(doc, v) {
  const n = doc.resolve(v);
  return typeof n === "number" ? n : null;
}

/** The horizontal glyph-space scale of a font: 1/1000 for everything but a
 *  Type3, whose /FontMatrix states its own. Null when a Type3 does not. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} map
 *  @param {string | null} subtype
 *  @returns {number | null} */
function glyphScale(doc, map, subtype) {
  if (subtype !== "Type3") return 0.001;
  const fm = asArr(doc.resolve(map.FontMatrix));
  if (!fm || fm.items.length < 6) return null;
  const a = numOf(doc, fm.items[0]);
  return typeof a === "number" && a !== 0 ? a : null;
}

/** Read a font's advance widths. Returns `{ widths, why }`; `widths` is a
 *  lookup from character code to a TEXT-SPACE advance, or null with `why`. */
/** @typedef {{ widths: ((code: number) => number) | null, why: string | null }} FontWidths */
/** @param {PdfDoc} doc
 *  @param {PdfMap} map
 *  @param {string | null} subtype
 *  @param {boolean} isType0
 *  @returns {FontWidths} */
function fontWidths(doc, map, subtype, isType0) {
  if (isType0) return cidWidths(doc, map);
  const scale = glyphScale(doc, map, subtype);
  if (scale == null) return { widths: null, why: "type3_no_font_matrix" };
  const first = numOf(doc, map.FirstChar);
  const arr = asArr(doc.resolve(map.Widths));
  if (first == null || !arr || arr.items.length === 0) {
    return { widths: null, why: "no_widths_array" };
  }
  const vals = arr.items.map((x) => numOf(doc, x));
  const desc = doc.dictOf(map.FontDescriptor);
  const missing = (desc ? numOf(doc, desc.MissingWidth) : null) ?? 0;
  /** @param {number} code
   *  @returns {number} */
  const widths = (code) => {
    const i = code - first;
    const w = i >= 0 && i < vals.length ? vals[i] : null;
    return (w == null ? missing : w) * scale;
  };
  return { widths, why: null };
}

/** A composite font's widths, from its descendant CIDFont's /DW and /W. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} map
 *  @returns {FontWidths} */
function cidWidths(doc, map) {
  const enc = nameOf(doc, map.Encoding);
  if (enc !== "Identity-H" && enc !== "Identity-V") {
    return { widths: null, why: "cid_encoding_not_identity" };
  }
  const descArr = asArr(doc.resolve(map.DescendantFonts));
  const cid = descArr && descArr.items.length
    ? doc.dictOf(descArr.items[0])
    : null;
  if (!cid) return { widths: null, why: "no_descendant_font" };
  const dw = numOf(doc, cid.DW) ?? 1000;
  /** @type {Map<number, number>} */
  const table = emptyMap();
  const wArr = asArr(doc.resolve(cid.W));
  if (wArr) {
    const items = wArr.items.map((x) => doc.resolve(x));
    let i = 0;
    while (i < items.length) {
      const c = items[i];
      if (typeof c !== "number") { i++; continue; }
      const next = items[i + 1];
      if (next && typeof next === "object" && next.t === "arr") {
        // `c [w1 w2 …]`: consecutive CIDs starting at c.
        const list = next.items.map((x) => numOf(doc, x));
        for (let k = 0; k < list.length; k++) { const lw = list[k]; if (lw != null) table.set(c + k, lw); }
        i += 2;
        continue;
      }
      const last = typeof next === "number" ? next : null;
      const third = items[i + 2];
      const w = typeof third === "number" ? third : null;
      // `cFirst cLast w`: one width for the whole range. The range is bounded
      // because a malformed pair could otherwise ask for millions of entries.
      if (last != null && w != null && last >= c && last - c <= 65535) {
        for (let code = c; code <= last; code++) table.set(code, w);
        i += 3;
        continue;
      }
      i++;
    }
  }
  /** @param {number} code
   *  @returns {number} */
  const widths = (code) => (table.get(code) ?? dw) * 0.001;
  return { widths, why: null };
}

/* ---- the per-page text interpreter ---- */

const HEX_CAP = 64; // cap the bytes echoed into an undetermined marker

/** @param {Uint8Array} bytes
 *  @param {number} [cap]
 *  @returns {string} */
function bytesToHex(bytes, cap = HEX_CAP) {
  const n = Math.min(bytes.length, cap);
  let out = "";
  for (let i = 0; i < n; i++) { const b = byteAt(bytes, i); out += `${HEX[b >> 4]}${HEX[b & 15]}`; }
  if (bytes.length > cap) out += "…";
  return out;
}

/** The character codes a shown byte run carries (R12). Codes are unsigned whatever their width. With one code width (the
 *  CMap's one codespace width, or its default) the run is cut every `width` bytes; when the CMap states codespace ranges of
 *  several widths, each code is the shortest prefix that lies in a range of its own width, and a prefix in none is taken
 *  at the shortest width (the CMap will not map it). `lens[i]` is code i's width in bytes; `leftover` the bytes of a final
 *  code that does not fit. */
/** @param {Uint8Array} bytes
 *  @param {number} width
 *  @param {CodeSpaces | null} [spaces]
 *  @returns {{ codes: number[], lens: number[], leftover: number }} */
function bytesToCodes(bytes, width, spaces = null) {
  /** @type {number[]} */
  const codes = [];
  /** @type {number[]} */
  const lens = [];
  if (!spaces) {
    const w = Math.max(1, width);
    for (let i = 0; i + w <= bytes.length; i += w) {
      let code = 0;
      for (let k = 0; k < w; k++) code = code * 256 + byteAt(bytes, i + k);
      codes.push(code); lens.push(w);
    }
    return { codes, lens, leftover: bytes.length % w };
  }
  let i = 0;
  while (i < bytes.length) {
    let took = 0, code = 0;
    for (const n of spaces.widths) {
      if (i + n > bytes.length) break;
      code = 0;
      for (let k = 0; k < n; k++) code = code * 256 + byteAt(bytes, i + k);
      const c = code;
      if (spaces.list.some((r) => r.n === n && c >= r.lo && c <= r.hi)) { took = n; break; }
    }
    if (!took) {
      /* the bytes left are the start of a longer code that does not fit: misaligned, as a short final code is */
      const rem = bytes.length - i;
      let prefix = 0;
      for (let k = 0; k < rem; k++) prefix = prefix * 256 + byteAt(bytes, i + k);
      const pre = prefix;
      if (spaces.list.some((r) => r.n > rem && pre >= Math.floor(r.lo / 256 ** (r.n - rem)) && pre <= Math.floor(r.hi / 256 ** (r.n - rem)))) break;
      const n = byteAt(spaces.widths, 0);
      if (i + n > bytes.length) break;
      code = 0;
      for (let k = 0; k < n; k++) code = code * 256 + byteAt(bytes, i + k);
      took = n;
    }
    codes.push(code); lens.push(took); i += took;
  }
  return { codes, lens, leftover: bytes.length - i };
}

/** Walk one page's Resources up the page tree — Resources is an inheritable
 *  attribute, so a page that omits it uses its /Pages parent's. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} pageMap
 *  @returns {PdfMap | null} */
function pageResources(doc, pageMap) {
  /** @type {PdfMap | null} */
  let map = pageMap;
  for (let seen = 0; seen < 64; seen++) {
    const cur = map;
    if (!cur) break;
    const res = doc.dictOf(cur.Resources);
    if (res) return res;
    const parent = asDict(doc.resolve(cur.Parent));
    map = parent ? parent.map : null;
  }
  return null;
}

/** Concatenate a page's content stream(s) into one decoded latin1 string, and
 *  name every part of it that could not be read (R25): a stream that would not
 *  decode (`content_stream_undecodable`), or a /Contents entry that resolves to
 *  no stream at all (`content_stream_unresolvable`). A page with no /Contents
 *  is genuinely blank and names nothing. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} pageMap
 *  @returns {Promise<PageContent>} */
async function pageContent(doc, pageMap) {
  /** @type {string[]} */
  const unread = [];
  if (pageMap.Contents == null) return { data: new Uint8Array(0), unread };
  const c = doc.resolve(pageMap.Contents);
  if (!c) return { data: new Uint8Array(0), unread: ["content_stream_unresolvable"] };
  const ca = asArr(c);
  const streams = ca ? ca.items.map((x) => doc.resolve(x)) : [c];
  /** @type {Uint8Array[]} */
  const parts = [];
  /* R41, R22: the page's streams share one cap; a page whose decoded content passes it is stated, not held */
  const bound = STREAM_CAPS.page_content;
  let total = 0;
  for (const st of streams) {
    if (asStream(st)) {
      const got = await doc._decode(st, "page_content", bound - total);
      if ("over" in got) { const over = got.over; return { data: new Uint8Array(0), unread: [], over: { size: total + over.size, bound } }; }
      if (got.data) {
        total += got.data.length;
        if (total > bound) return { data: new Uint8Array(0), unread: [], over: { size: total, bound } };
        parts.push(got.data);
      } else { doc.note("content_stream_undecodable"); unread.push("content_stream_undecodable"); }
    } else {
      unread.push("content_stream_unresolvable");
    }
  }
  /* the streams are one content stream, a line feed between them; the bytes are lexed as bytes (a 60 MiB page is not made a
     60 MiB string beside them, R41) */
  const only = parts[0];
  if (parts.length === 1 && only) return { data: only, unread };
  const data = new Uint8Array(total + Math.max(0, parts.length - 1));
  let at = 0;
  parts.forEach((part, i) => { if (i) data[at++] = 0x0a; data.set(part, at); at += part.length; });
  return { data, unread };
}

/* D-481 — THE TEXT MATRIX, ENOUGH OF IT TO KNOW WHERE A LINE IS.
 *
 * A PDF matrix is [a b c d e f]:  x' = a·x + c·y + e ;  y' = b·x + d·y + f.
 * `matMul(A, B)` is "apply A, then B", the order every PDF operator composes in
 * (ISO 32000-1 §8.3.3): `cm` premultiplies the CTM, `Td` premultiplies the text
 * LINE matrix. Only the translation row is read back (`baselineOf`), because the
 * only question asked of it is WHERE THE BASELINE IS.
 *
 * WHAT THIS DOES NOT MODEL, stated because a reader would otherwise assume it:
 * glyph ADVANCE. No font here carries /Widths or /W, so the pen's position after
 * a shown string is unknown, and only positions a positioning OPERATOR states are
 * known. See the note in extractPageText on what that costs. */
/** A matrix `[a b c d e f]`, six numbers. @typedef {readonly number[]} Matrix */
/** @type {readonly number[]} */
const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);
/** @param {Matrix} a
 *  @param {Matrix} b
 *  @returns {number[]} */
function matMul(a, b) {
  /* an entry that is missing reads as NaN, as it read in arithmetic; nothing is allocated but the answer (a glyph's walk calls this) */
  const a0 = a[0] ?? NaN, a1 = a[1] ?? NaN, a2 = a[2] ?? NaN, a3 = a[3] ?? NaN, a4 = a[4] ?? NaN, a5 = a[5] ?? NaN;
  const b0 = b[0] ?? NaN, b1 = b[1] ?? NaN, b2 = b[2] ?? NaN, b3 = b[3] ?? NaN, b4 = b[4] ?? NaN, b5 = b[5] ?? NaN;
  return [
    a0 * b0 + a1 * b2,
    a0 * b1 + a1 * b3,
    a2 * b0 + a3 * b2,
    a2 * b1 + a3 * b3,
    a4 * b0 + a5 * b2 + b4,
    a4 * b1 + a5 * b3 + b5,
  ];
}
/** The device-space y of a text line matrix under a CTM — the baseline.
 *  @param {Matrix} tlm
 *  @param {Matrix} ctm
 *  @returns {number} */
const baselineOf = (tlm, ctm) => byteAt(tlm, 4) * byteAt(ctm, 1) + byteAt(tlm, 5) * byteAt(ctm, 3) + byteAt(ctm, 5);
/** Float slack only. Any baseline move a document can SEE is orders above this,
 *  so "any y change breaks the line" survives it; identical inputs through
 *  identical multiplies do not drift, and non-identical paths to one baseline do. */
const BASELINE_EPS = 1e-6;

/* D-502 — THE WORD-GAP THRESHOLD, IN EMS, TAKEN FROM A MEASURED DISTRIBUTION
 * AND FROM A MEASURED SWEEP OF ITS OWN VALUE (M-141).
 *
 * The question this number answers: a positioning operator has landed on the
 * baseline already being written — did it CONTINUE the run just shown, or start
 * a new one? The distance from where the pen was left to where the operator
 * puts it is the evidence, in EMS of the text it follows, because 4 pt is a
 * word gap at 8 pt and a kern at 40 pt and one agenda holds both.
 *
 * THE DISTRIBUTION, over 5,960 same-baseline jumps in nine Oakland PDFs (the
 * seven committed PDF fixtures, `Budget-Basics-FY23-25.pdf` and the Legistar
 * agenda D-481 measured; shas and instrument in `measurements/M-141.md`):
 *
 *   |gap| ≤ 0.025 em     5,002   the pen landed where the widths said it would
 *   0.025 … 0.25 em         299   kerning and rounding, inside and between words
 *   0.25 … 0.45 em            9   ← the valley; (0.375, 0.450] holds NOTHING
 *   ≥ 0.45 em               579   word gaps, column jumps, footer halves
 *
 * AND THE SWEEP, which is the more useful half and says the figure is NOT
 * load-bearing: re-reading all seven text-bearing documents at fifteen values
 * of this constant gives 14,041 tokens at 0.03 and 14,039 at 1.0 — TWO tokens
 * of difference across a factor of thirty, because a jump into text the
 * document already spaced adds nothing (`softSpace`). What the sweep DOES find
 * is one cliff, and it is at zero: with the threshold at 0 the same corpus
 * reads 17,292 tokens with 4,578 of them ONE CHARACTER LONG, because float
 * noise in the matrix arithmetic becomes a word gap. So the property that
 * matters is being clear of that floor, not the exact value; 0.25 is the
 * valley's own midpoint and is what a space IS in a text face (0.25–0.33 em),
 * two independent readings meeting rather than one number standing alone.
 *
 * APPLIED TO THE MAGNITUDE, so ONE constant serves both directions. A BACKWARD
 * jump on a live baseline is a new run too — a column drawn out of order — and
 * its valley was measured on the same corpus: of 185 backward jumps, 181 are
 * ≤ 0.21 em (kerning and overprint) and four are ≥ 2.68 em. */
const WORD_GAP_EM = 0.25;

/* D-517 — THE SECOND WORD-GAP RULE, MEASURED (M-145), AND WHY IT KEEPS A
 * CONSTANT OF ITS OWN RATHER THAN BORROWING THE ONE ABOVE.
 *
 * This reader has TWO word-gap rules and they disagreed by 2.5x: the one above
 * judges a jump a POSITIONING OPERATOR makes between two runs, this one judges
 * a displacement the producer wrote INSIDE one shown run, as a number in a TJ
 * array. D-481 picked -100 thousandths by hand; D-502 kept it and said the
 * populations differ; this row MEASURED the second population and the two
 * statements now rest on figures rather than on each other.
 *
 * THE DISTRIBUTION, over 14,067 TJ numeric elements in M-141's own nine Oakland
 * PDFs (8,432 forward, 5,635 backward; shas and instrument in
 * `measurements/M-145.md`). The discriminator the run-gap population did not
 * need is WHAT THE ELEMENT FOLLOWS: a positioning operator's jump is always
 * between runs, while a TJ number sits wherever the producer put it, so a space
 * there either separates two words or doubles a separator already present.
 * Counting only the elements that follow a LETTER OR DIGIT — the ones where a
 * space is a claim about a word boundary —
 *
 *   ≤ 0.020 em          3,818   intra-word kerning: splitting here invents words
 *   0.020 … 0.180 em        0   <- THE VALLEY, and it is EMPTY, not merely thin
 *   ≥ 0.180 em             86   the producer's own word gaps
 *
 * so the valley runs from 0.020 to 0.180 em and 0.100 is its midpoint. D-481's
 * hand-picked figure was RIGHT and is confirmed here rather than replaced; what
 * it lacked was the measurement, which is what this constant now carries.
 *
 * AND THE SWEEP, which says the same thing the other way: tokens, words and
 * glue are FLAT at 14,039 / 13,396 / 17 from 0.02 to 0.18 em — a factor of
 * nine — collapse at 0 to 17,322 tokens with 3,481 of them ONE CHARACTER LONG
 * (float noise become a word gap, the same cliff M-141 found above), and decay
 * ABOVE the valley: at 0.25 em the corpus loses 75 words and gains 9 glue
 * tokens on `legistar-73545` alone.
 *
 * WHICH IS WHY UNIFYING THE TWO CONSTANTS AT 0.25 IS REFUSED BY MEASUREMENT,
 * not by preference: 75 of the 86 real word gaps here sit in (0.180, 0.25],
 * a band the run-gap population has nothing in. Unifying DOWNWARD at 0.1 was
 * measured too and is nearly free (+2 tokens), and is still not taken: it would
 * move 297 jumps M-141 classified as kerning into the word-gap class, against
 * that row's own measured valley, which this row did not re-measure. M-145
 * records both readings.
 *
 * ONE-SIDED, unlike the rule above, and this is measured rather than inherited:
 * of 5,635 BACKWARD elements not one exceeds 0.075 em, so the magnitude form is
 * byte-identical on this corpus — an equality that costs nothing to produce and
 * is therefore no evidence. The reason it stays forward-only is structural: a
 * backward displacement inside ONE shown run is the producer tightening or
 * overprinting, never a new run, while a backward jump BETWEEN runs is a column
 * drawn out of order, which is what the rule above is for. A suite arm pins the
 * asymmetry so it is not tidied away. */
const TJ_WORD_GAP_EM = 0.1;

/** R41: the fonts parsed so far, by font object, the most recent kept: a font's code map is the largest thing a page
 *  leaves behind, and a document of a thousand pages has a thousand subset fonts of its own. `max` is the code-map
 *  entries held (a font costs its entries and a constant); an evicted font is parsed again if a later page asks. */
class FontCache {
  /** @param {number} [max] */
  constructor(max = 25_000) {
    /** @type {number} */
    this.max = max;
    /** @type {Map<string, { f: FontInfo | null, c: number }>} */
    this.map = emptyMap();
    /** @type {number} */
    this.cost = 0;
  }
  /** @param {string} k
   *  @returns {boolean} */
  has(k) { return this.map.has(k); }
  /** @param {string} k
   *  @returns {FontInfo | null | undefined} */
  get(k) {
    const e = this.map.get(k);
    if (!e) return undefined;
    this.map.delete(k); this.map.set(k, e);
    return e.f;
  }
  /** @param {string} k
   *  @param {FontInfo | null} f */
  set(k, f) {
    const old = this.map.get(k);
    if (old) this.cost -= old.c;
    const tu = f ? f.toUni : null;
    const c = 64 + (f && tu ? tu.size : 0);
    this.map.delete(k); this.map.set(k, { f, c }); this.cost += c;
    for (const [key, e] of this.map) {
      if (this.cost <= this.max || this.map.size <= 1) break;
      this.map.delete(key); this.cost -= e.c;
    }
  }
}

/* R41, R22 — A PAGE'S TEXT IS BUILT AS TEXT, NOT AS AN ARRAY OF ITS CHARACTERS.
 *
 * The walk pushes one piece per decoded code and may take back only the LAST piece (a separator it inserted that the
 * document then supplies itself) or read it (`softSpace`). Held as an array that is a pointer per character: 40 MB for
 * the five million characters of an 8 MB page of text, copied again each time the array doubled, and the heap of a
 * 128 MB object was gone at a page of 8 MB where the page bound allows 64. A `PieceList` keeps the pieces still
 * takeable (the last two) and joins everything older into flat chunks, a byte or two a character. A page with a link
 * (R35) is asked for the glyph boxes, which pair with pieces one to one, and keeps the array. */
class PieceList {
  /** An empty list. */
  constructor() {
    /** @type {string[]} */
    this.chunks = [];
    /** @type {string[]} */
    this.block = [];
    /** @type {number} */
    this.count = 0;
  }
  /** @returns {number} */
  get length() { return this.count; }
  /** @param {string} p */
  push(p) {
    this.block.push(p);
    this.count++;
    if (this.block.length >= 4096) {
      const keep = this.block.splice(this.block.length - 2);
      this.chunks.push(this.block.join(""));
      this.block = keep;
    }
  }
  /** @returns {string | undefined} */
  pop() { this.count--; return this.block.pop(); }
  /** @param {number} i
   *  @returns {string | undefined} */
  at(i) { return i === -1 ? this.block[this.block.length - 1] : undefined; }
  /** The pieces joined (the separator is always "": a `PieceList` stands where an array's `join("")` is asked).
   *  @param {string} [sep]
   *  @returns {string} */
  join(sep) { return this.chunks.join("") + this.block.join(""); } // eslint-disable-line no-unused-vars
}

/** R35: where one shown code's ink is (its point `c`, in default user space). @typedef {{ c: number[] }} GlyphBox */
/** A marker, frozen: R41's one object for every place a page says the same thing.
 *  @param {Marker} m
 *  @returns {Marker} */
function frozenMarker(m) {
  Object.freeze(m);
  return m;
}
/** A new, empty list of pieces. @returns {string[]} */
function newPieces() {
  /** @type {string[]} */
  const list = [];
  return list;
}
/** A new, empty list of glyph boxes. @returns {(GlyphBox | null)[]} */
function newBoxes() {
  /** @type {(GlyphBox | null)[]} */
  const list = [];
  return list;
}
/** Where the glyph boxes go on a page with no link: nowhere.
 *  @typedef {{ push: (b: GlyphBox | null) => void, pop: () => void }} BoxSink */
/** A page's placed glyphs (R35), parallel arrays: on a page with a link they are arrays, on any other the pieces are a
 *  `PieceList` and the boxes go nowhere.
 *  @typedef {{ pieces: string[] | PieceList, boxes: (GlyphBox | null)[] | BoxSink, undecodedCenters: number[][], unpositioned: number }} Placed */
/** A page with a link's placed glyphs, as `anchorOf` reads them.
 *  @typedef {{ pieces: string[], boxes: (GlyphBox | null)[], undecodedCenters: number[][], unpositioned: number }} PlacedGlyphs */
/** One page's tier-1 reading: its text, its markers, and (when it was walked) its placed glyphs.
 *  @typedef {{ text: string, undetermined: Marker[], placed?: Placed }} PageReading */

/** Extract Tier 1 text from one page. Returns { text, undetermined:[markers] }.
 *  `fontCache` is keyed by font object so a font shared across pages is parsed
 *  once. Every undecodable region is recorded, never rendered.
 *  @param {PdfDoc} doc
 *  @param {number} pageIdx
 *  @param {PdfMap} pageMap
 *  @param {FontCache} fontCache
 *  @param {boolean} [wantPlaced]
 *  @param {PageContent | null} [given]
 *  @param {Slicer | null} [slice]
 *  @returns {Promise<PageReading>} */
async function extractPageText(doc, pageIdx, pageMap, fontCache, wantPlaced = true, given = null, slice = null) {
  const resources = pageResources(doc, pageMap);
  const fontDict = resources ? doc.dictOf(resources.Font) : null;
  const content = given ?? await pageContent(doc, pageMap);
  const overBound = content.over;
  if (overBound) {
    /* R41: stated with its figures, nothing of the page held */
    return { text: "", undetermined: [{ page: pageIdx, reason: "page_over_bound", font: null, codes: "", count: 0, size: overBound.size, bound: overBound.bound }],
             placed: { pieces: newPieces(), boxes: newBoxes(), undecodedCenters: [], unpositioned: 0 } };
  }
  const toks = tokenizeContentBytes(content.data);

  /** @type {string[] | PieceList} */
  const pieces = wantPlaced ? newPieces() : new PieceList();
  /* R35 (REC-206) — WHERE EACH PIECE'S INK IS, PARALLEL TO `pieces` (see
     `glyphBox`). A separator this reader inserts has no ink and holds null; a
     glyph shown while the pen was unknown holds null too and is COUNTED in
     `unpositioned`, so nothing downstream reads "no box" as "no glyph". */
  /* the glyph boxes only a page with a link is asked for (R35); no other page builds one per glyph (R41) */
  /** @type {(GlyphBox | null)[] | BoxSink} */
  const boxes = wantPlaced ? newBoxes() : { push() {}, pop() {} };
  /** @type {number[][]} */
  const undecodedCenters = []; // ink points of shown codes that decode to nothing
  let unpositioned = 0;        // glyphs shown while the pen was unknown
  /* D-591 (R25): a page whose content could not be read says so on the PAGE,
     so it is never indistinguishable from a page that is actually blank. */
  /** @type {Marker[]} */
  const undetermined = content.unread.map((reason) =>
    ({ page: pageIdx, reason, font: null, codes: "", count: 0 }));
  /* R41: a page that shows ten thousand codes its font does not map states ten
     thousand markers, and most of them state the same thing (the same code of
     the same font, again). Identical markers are ONE frozen object, so the
     answer holds one object per distinct marker and a reference per place it
     was said; the answer read, counted or serialised is what it was. */
  /** @type {Map<string | null, Map<string, Map<string, Marker>>>} */
  const markers = emptyMap(); // font -> reason -> codes (and count, when not 1) -> the marker
  /** @param {string} reason
   *  @param {string | null} font
   *  @param {string} codes
   *  @param {number} count */
  const mark = (reason, font, codes, count) => {
    const gotReason = markers.get(font);
    /** @type {Map<string, Map<string, Marker>>} */
    const byReason = gotReason ?? emptyMap();
    if (!gotReason) markers.set(font, byReason);
    const gotCodes = byReason.get(reason);
    /** @type {Map<string, Marker>} */
    const byCodes = gotCodes ?? emptyMap();
    if (!gotCodes) byReason.set(reason, byCodes);
    const key = count === 1 ? codes : `${codes}\u0000${count}`;
    const had = byCodes.get(key);
    const m = had ?? frozenMarker({ page: pageIdx, reason, font, codes, count });
    if (!had) byCodes.set(key, m);
    undetermined.push(m);
  };
  /** @type {FontInfo | null | undefined} */
  let curFont = null;      // font info, or null
  /** @type {string | null} */
  let curFontName = null;  // the resource name last selected by Tf
  /** @type {ContentToken[]} */
  const stack = [];

  /* D-608: the font dictionary and resources IN SCOPE. A Form XObject names
     its fonts in its OWN /Resources, so these move when the walk descends into
     one (`paintForm`) and come back when it returns. `scopeTag` keeps a font
     written as a DIRECT dict in a form from sharing a cache slot with a
     same-named direct font on the page; the page's own tag is empty, so every
     key the walk made before D-608 is spelled as it was. */
  let curResources = resources;
  let curFontDict = fontDict;
  let scopeTag = "";
  /** @param {string} name
   *  @returns {Promise<FontInfo | null | undefined>} */
  const getFont = async (name) => {
    const fd = curFontDict;
    if (!fd || !(name in fd)) return null;
    const ref = fd[name];
    const rr = asRef(ref);
    const key = rr ? "r" + rr.n : "n" + scopeTag + name;
    if (fontCache.has(key)) return fontCache.get(key);
    const f = await loadFont(doc, ref);
    fontCache.set(key, f);
    const tu = f ? f.toUni : null;
    if (slice && f && tu) await slice.add(Math.ceil(tu.size / 8));   /* R45: a code map parsed is work */
    return f;
  };

  /** @param {Uint8Array} bytes */
  const show = (bytes) => {
    if (!bytes || bytes.length === 0) return;
    const font = curFont; // `show` selects no font: the one in hand stays for the whole run
    if (!font) {
      penKnown = false; inkValid = false; // D-502: nothing says how far this moved the pen
      unpositioned += bytes.length;       // R35: and nothing says where they are
      mark(curFontName ? "font_not_in_resources" : "no_current_font", curFontName ?? null, bytesToHex(bytes), bytes.length);
      return;
    }
    const toUni = font.toUni;
    if (!toUni) {
      /* D-502: the text is undecodable, the ADVANCE is not \u2014 a width is
         looked up by CODE and needs no /ToUnicode. So the pen survives a run
         this reader cannot read, and the gap after it is still judged. */
      { /* R35: the run cannot be read and CAN be placed; its ink is kept so an
           anchor over it is known to be partly undecodable, never complete. */
        const before = wantPlaced && penKnown ? tmat.slice() : null;
        advanceOver(bytes);
        if (before && penKnown) undecodedCenters.push(glyphBox(before, tmat).c);
        else unpositioned += Math.ceil(bytes.length / (font.width || 1));
      }
      endRun();
      mark(font.isType0 ? "cid_font_no_tounicode" : "no_tounicode", font.baseFont ?? curFontName ?? null,
        bytesToHex(bytes), Math.ceil(bytes.length / (font.width || 1)));
      return;
    }
    const { codes, lens, leftover } = bytesToCodes(bytes, font.width, font.spaces);
    for (let ci = 0; ci < codes.length; ci++) {
      const code = byteAt(codes, ci);
      const before = wantPlaced && penKnown ? tmat.slice() : null;
      advanceOne(code);
      const box = before && penKnown ? glyphBox(before, tmat) : null;
      if (!box) unpositioned++;
      const u = toUni.get(code);
      if (u == null) {
        if (box) undecodedCenters.push(box.c);
        mark("unmapped_code", font.baseFont ?? curFontName ?? null,
          code.toString(16).padStart(byteAt(lens, ci) * 2, "0"), 1);
      } else {
        /* D-502: withdraw an inserted separator the DOCUMENT then supplies
           itself. `softSpace` cannot see what is coming, so the symmetric half
           of the rule lives here and in `breakLine`: a separator this reader
           added is kept only where it actually separates something. The net
           property, and it is the one worth stating: this reader adds a
           separator ONLY where the document wrote none. (D-502 for a
           positioning operator's jump; SINCE D-517 for a TJ displacement too,
           which until then pushed its space past both halves of this rule.) */
        if (softAt === pieces.length && /^\s/.test(u)) { pieces.pop(); boxes.pop(); softAt = -1; }
        pieces.push(u); boxes.push(box);
      }
    }
    endRun();
    if (leftover) {
      penKnown = false; inkValid = false; // D-502: bytes of unknown code width advance by an unknown amount
      mark("code_width_misaligned", font.baseFont ?? curFontName ?? null,
        bytesToHex(bytes.slice(bytes.length - leftover)), leftover);
    }
  };

  /** The last name operand, or null.
   *  @returns {TokName | null} */
  const lastName = () => {
    for (let i = stack.length - 1; i >= 0; i--) { const tk = stack[i]; if (tk && tk.t === "name") return tk; }
    return null;
  };
  /** The last string operand, or null.
   *  @returns {TokStr | null} */
  const lastStr = () => {
    for (let i = stack.length - 1; i >= 0; i--) { const tk = stack[i]; if (tk && tk.t === "str") return tk; }
    return null;
  };
  /** The last `n` numeric operands, in the order they were written, or null.
   *  @param {number} n
   *  @returns {number[] | null} */
  const numArgs = (n) => {
    /** @type {number[]} */
    const out = [];
    for (let i = stack.length - 1; i >= 0 && out.length < n; i--) {
      const tk = stack[i];
      if (tk && tk.t === "num") out.unshift(tk.v);
    }
    return out.length === n ? out : null;
  };

  /* D-481 — A LINE BREAKS WHEN THE BASELINE MOVES, NOT WHEN THE PEN MOVES.
   *
   * MEASURED, not assumed. Until this item every `Td`, `TD` and `Tm` pushed a
   * newline, on the reading that a positioning operator starts a line. It does
   * not: `Td tx 0` moves ALONG the current baseline, and a whole class of
   * producers positions EVERY GLYPH that way. Oakland's own
   * `Budget-Basics-FY23-25.pdf` (Skia/PDF m131, 11 pages, fetched 2026-09-24)
   * is written `<0021> Tj  30.6698 0 Td <01E3> Tj  11.47 0 Td <024E> Tj …`, one
   * `Td` per glyph, so Tier 1 read it as 4,496 one-character lines — 47 words in
   * the whole document — while the glyphs, the SPACES INCLUDED, were all there.
   * The record said far less than the document held, and said it confidently.
   *
   * THE RULE, and it is the PDF's own: the text LINE matrix is what a line is.
   *   - `Td`/`TD` with ty = 0 translate along the baseline  -> NO break.
   *   - `Tm` landing on the current line's baseline         -> NO break.
   *   - `T*`, `'`, `"`, and any y change                    -> BREAK.
   * The baseline is read in DEVICE space (the line matrix composed with the
   * CTM), never from the line matrix alone, because this same document gives
   * every one of its real lines the IDENTICAL `1 0 0 -1 .015625 44 Tm` and
   * separates them with `cm` — so a reading that trusted `Tm` alone would fuse
   * all eleven pages into one line and count MORE words for it. That is why
   * `q`, `Q` and `cm` are interpreted here.
   *
   * WHAT IT COSTS, stated rather than left to be discovered: two runs on ONE
   * baseline separated only by a horizontal jump — table columns — are now
   * CONCATENATED where they used to be split by a newline. Closing that needs
   * the pen's position, which needs glyph widths (/Widths, /W), which this
   * module does not read; a gap threshold guessed without them would be an
   * invented figure. Reported as a follow-up rather than guessed here.
   *
   * The inline-image option stays OFF for this walk (see tokenizeContent), so
   * an inline image's sample bytes can still be read as operators — including,
   * now, as `cm`. That is the same exposure the walk already had to a stray
   * `Td`, neither widened nor closed by this item. */
  let ctm = IDENTITY_MATRIX.slice();   // the current transformation matrix
  /** @type {number[][]} */
  const ctmStack = [];                 // q / Q
  let tlm = IDENTITY_MATRIX.slice();   // the text LINE matrix; BT resets it
  let leading = 0;                     // TL, the leading T* moves by
  /** @type {number | null} */
  let lineY = null;                    // the baseline of the line being written
  const breakLine = () => {
    /* D-502: a separator this reader inserted and then never separated
       anything is withdrawn rather than left at the end of a line. `softAt`
       is the length `pieces` had immediately after that push, so it still
       matches ONLY if nothing has been shown since — which is exactly the
       case where the jump turned out to end the line. A space the DOCUMENT
       wrote never matches. [CORRECTED BY D-517, 2026-09-24: this said a space
       "the TJ rule read out of a displacement" never matches either, which was
       true when written and is not now — that rule emits through `softSpace`
       too, so its separators are withdrawn on the same terms. Measured at
       M-145: 122 space characters and 12 whitespace-only lines leave the
       corpus, and not one token, word, glue token or non-whitespace character
       moves.] */
    if (softAt === pieces.length && pieces.length) { pieces.pop(); boxes.pop(); softAt = -1; }
    pieces.push("\n"); boxes.push(null);
    lineY = baselineOf(tlm, ctm);
  };

  /* D-502 \u2014 THE PEN, AND THE ONE THING IT IS ASKED.
   *
   * The TEXT matrix is the line matrix plus everything shown since the line
   * began; D-481 tracked only the line matrix, which is why a horizontal jump
   * BACK ALONG a baseline could not be told from a continuation. Tracked here:
   * the text matrix `tmat`, the font size, character and word spacing, and
   * horizontal scaling \u2014 the four text-state parameters that enter the glyph
   * displacement (ISO 32000-1 \u00a79.4.4). Rise does not; it moves y, and y is the
   * baseline's question, already answered.
   *
   * `penKnown` IS THE HONEST HALF. It goes false the moment something is shown
   * whose advance this reader cannot compute \u2014 no font, no width array, a
   * trailing partial code \u2014 and while it is false NO GAP IS JUDGED. It comes
   * back true at the next positioning operator, which STATES where the pen is.
   * So a document whose widths are unreadable reads exactly as D-481 left it,
   * rather than acquiring breaks derived from a width nobody read. */
  let tmat = IDENTITY_MATRIX.slice(); // the TEXT matrix
  let penKnown = true;                // is tmat where the pen actually is?
  let tfs = 0;                        // Tf size
  let tc = 0;                         // Tc character spacing
  let tw = 0;                         // Tw word spacing
  let th = 1;                         // Tz horizontal scaling, as a factor

  /* WHERE THE INK STOPPED, IN DEVICE SPACE, AND WHY IT IS HELD THAT WAY.
   *
   * `BT` resets the text matrices, and `Q`/`cm` move the CTM, so a position
   * kept in TEXT space is worthless across those \u2014 and a very common producer
   * writes ONE `BT \u2026 ET` PER RUN with its own `cm` (Legistar's own PDFs do:
   * `\u2026 cm BT 46 0 0 46 1053.309 94 Tm /TT4 1 Tf [\u2026] TJ ET Q q \u2026 cm BT 46 0 0
   * 46 1404.691 94 Tm \u2026`). Measured on `legistar-73450`: reading the pen off
   * the text matrix at the second `Tm` reads the ORIGIN, because `BT` had just
   * reset it, and every gap came out ~1,200 ems. So the pen's device x is
   * captured when the ink stops and survives `ET`, `Q` and `BT` untouched.
   *
   * `inkEm` is the em of the text LAST SHOWN, not of the text state at the
   * jump, and that is deliberate: in the same producer's output the `Tf` for
   * the next run comes AFTER its `Tm`, so the only font in hand at the moment
   * a gap is judged is the one the gap follows. That is also the right
   * reference \u2014 the question is whether the jump is wide FOR THE TEXT IT
   * FOLLOWS. */
  let softAt = -1;    // `pieces.length` just after the last separator inserted here
  let inkX = 0;       // device x where the last tracked run of ink ended
  /** @type {number | null} */
  let inkEm = null;   // device length of one em of that run
  let inkValid = false;

  /** Device-space x of a text-space origin under the current CTM.
   *  @param {Matrix} m
   *  @returns {number} */
  const deviceX = (m) => byteAt(m, 4) * byteAt(ctm, 0) + byteAt(m, 5) * byteAt(ctm, 2) + byteAt(ctm, 4);
  /** The device-space length of ONE EM of the current text state. A gap is
   *  judged in ems and never in points, because 4 pt is a word gap at 8 pt and
   *  a kern at 40 pt, and one document holds both. */
  /** @returns {number} */
  const emDevice = () => {
    const m = matMul(tmat, ctm);
    return Math.abs(tfs) * th * Math.hypot(byteAt(m, 0), byteAt(m, 1));
  };
  /* R35 — THE INK OF ONE SHOWN CODE, IN THE PAGE'S DEFAULT USER SPACE: the
   * same space and [x0,y0,x1,y1] order as an annotation's /Rect and an image's
   * rect (the walk's CTM starts at identity). The box is the glyph's EM BOX —
   * the pen's advance across, one em (the font size) up from the baseline — not
   * its outline: a descender is outside it, a text rise (`Ts`) is not applied,
   * and the font's own bounding box is not read. That is the most this reader
   * can place without inventing a figure. `c` is the point an anchor asks
   * about: mid-advance, 0.35 em up, inside the ink of any glyph of an ordinary
   * face. `m0`/`m1` are the text matrix before and after the advance. */
  /** @param {Matrix} m0
   *  @param {Matrix} m1
   *  @returns {GlyphBox} */
  const glyphBox = (m0, m1) => {
    const a = matMul(m0, ctm), b = matMul(m1, ctm);
    /** @param {number[]} m
     *  @param {number} x
     *  @param {number} y
     *  @returns {[number, number]} */
    const pt = (m, x, y) => [x * byteAt(m, 0) + y * byteAt(m, 2) + byteAt(m, 4), x * byteAt(m, 1) + y * byteAt(m, 3) + byteAt(m, 5)];
    const p0 = pt(a, 0, 0), p1 = pt(b, 0, 0), q0 = pt(a, 0, tfs);
    return { c: [(p0[0] + p1[0]) / 2 + 0.35 * (q0[0] - p0[0]), (p0[1] + p1[1]) / 2 + 0.35 * (q0[1] - p0[1])] };
  };
  /** Push a separator unless one is already there. Never opens a line. */
  const softSpace = () => {
    if (!pieces.length) return;
    const last = pieces.at(-1);
    if (last === undefined) throw new TypeError("Cannot read properties of undefined (reading 'endsWith')"); // as reading it would
    if (last.endsWith(" ") || last.endsWith("\n")) return;
    pieces.push(" "); boxes.push(null);
    softAt = pieces.length;
  };
  /** A positioning operator landed on the CURRENT baseline: is the distance it
   *  jumped a WORD GAP, or a continuation of the run just shown? */
  /** @param {number} toX */
  const judgeGap = (toX) => {
    if (!inkValid) return;
    const em = inkEm ?? emDevice();
    if (!(em > 0) || !Number.isFinite(em)) return;
    const gapEm = (toX - inkX) / em;
    if (Math.abs(gapEm) > WORD_GAP_EM) softSpace();
  };
  /** A shown run has ended: the ink is where the pen is, and one em of THAT
   *  run is the yardstick the next jump is measured with. */
  const endRun = () => {
    markInk();
    if (penKnown) inkEm = emDevice();
  };
  /** Advance the pen over one character code.
   *  @param {number} code */
  const advanceOne = (code) => {
    if (!penKnown) return;
    const font = curFont;
    const w0 = font && font.widths ? font.widths(code) : null;
    if (!font || w0 == null || !Number.isFinite(w0)) { penKnown = false; return; }
    const spacing = tc + (font.width === 1 && code === 32 ? tw : 0);
    tmat = matMul([1, 0, 0, 1, (w0 * tfs + spacing) * th, 0], tmat);
  };
  /** Advance the pen over a shown string whose text was not decoded.
   *  @param {Uint8Array} bytes */
  const advanceOver = (bytes) => {
    if (!penKnown) return;
    const font = curFont;
    if (!font || !font.widths) { penKnown = false; return; }
    const { codes, leftover } = bytesToCodes(bytes, font.width, font.spaces);
    for (const code of codes) advanceOne(code);
    if (leftover) penKnown = false;
  };
  /** Advance the pen by a TJ displacement, in thousandths of text space.
   *  @param {number} adj */
  const advanceBy = (adj) => {
    if (!penKnown) return;
    tmat = matMul([1, 0, 0, 1, (-adj / 1000) * tfs * th, 0], tmat);
  };
  /** The pen is where `tmat` says: record it in device space. */
  const markInk = () => {
    if (!penKnown) { inkValid = false; return; }
    inkX = deviceX(tmat);
    inkValid = true;
  };
  /** A positioning operator has set the line matrix: the pen is THERE, and it
   *  is known again whatever went before. */
  const penToLine = () => { tmat = tlm.slice(); penKnown = true; markInk(); };

  /** @param {Iterable<ContentToken, void, undefined>} toks
   *  @param {number} depth
   *  @param {number[]} formChain
   *  @returns {Promise<void>} */
  const run = async (toks, depth, formChain) => {
  for (const tk of toks) {
    if (slice && ++slice.n >= SLICE_UNITS) await slice.go();   /* R45: a page's token walk gives the thread back on a bounded slice */
    if (tk.t !== "op") {
      /* R47: operands past the bound are not held; the operator they were for sees none, and the page says so */
      if (stack.length >= OPERANDS_MAX) { stack.length = 0; if (!doc.notes.some((n) => n.startsWith("over_bound:operands"))) doc.note(`over_bound:operands:${OPERANDS_MAX + 1}:${OPERANDS_MAX}`); }
      stack.push(tk);
      continue;
    }
    const op = tk.v;
    switch (op) {
      case "Do": {
        /* D-608: the operator this walk did not interpret until now. A Form
           XObject is a content stream of its own, and the text it shows is on
           the page exactly as the page's own text is (M-166: ACFR FY2023-24
           p38 shows 34 of its 40 text runs inside forms). */
        const nameTok = lastName();
        stack.length = 0;
        await paintForm(nameTok ? nameTok.v : null, depth, formChain);
        break;
      }
      case "Tf": {
        const nameTok = lastName();
        const fontName = nameTok ? nameTok.v : null;
        curFontName = fontName;
        curFont = fontName ? await getFont(fontName) : null;
        const sz = numArgs(1); // D-502: `/F1 12 Tf` \u2014 the size is the operand
        if (sz) tfs = byteAt(sz, 0);
        break;
      }
      case "Tj": {
        const st = lastStr();
        if (st) show(st.bytes);
        break;
      }
      case "TJ": {
        let inArr = false;
        for (const it of stack) {
          if (it.t === "arr_open") { inArr = true; continue; }
          if (it.t === "arr_close") { inArr = false; continue; }
          if (!inArr) continue;
          if (it.t === "str") show(it.bytes);
          else if (it.t === "num") {
            /* D-517 — THE SAME RULE ON A MEASURED CONSTANT AND THE SHARED
               EMITTER. D-502 kept D-481's hand-picked -100 and said the two
               populations answer different questions and need their own
               distribution; M-145 measured it, and the figure is the same 0.1
               em, now stated in the unit the other rule is stated in so the two
               are comparable at the site. `-it.v / 1000` IS the displacement in
               ems — the horizontal-scale factor cancels, since the device
               advance is (-v/1000)·tfs·th·|m| and one em of that same text is
               tfs·th·|m| — and this predicate is the one `it.v < -100` was, on
               every one of the 417 distinct values the corpus holds and on the
               boundary in both directions (M-145). It still moves the pen,
               because the next positioning operator's gap is measured from
               wherever it left it. */
            if (-it.v / 1000 > TJ_WORD_GAP_EM) softSpace();
            advanceBy(it.v);
          }
        }
        break;
      }
      case "'":
      case '"': {
        // ' : next line then show;  " : aw ac (string) — next line then show.
        // Both are T* followed by Tj, so both MOVE the line matrix and BREAK.
        if (op === '"') {
          // `aw ac (string) "` sets word then character spacing (\u00a79.4.3).
          const a = numArgs(2);
          if (a) { tw = byteAt(a, 0); tc = byteAt(a, 1); }
        }
        tlm = matMul([1, 0, 0, 1, 0, -leading], tlm);
        breakLine();
        penToLine();
        const st = lastStr();
        if (st) show(st.bytes);
        break;
      }
      case "q":
        ctmStack.push(ctm.slice());
        break;
      case "Q":
        if (ctmStack.length) { const top = ctmStack.pop(); if (top) ctm = top; }
        break;
      case "cm": {
        const m = numArgs(6);
        if (m) ctm = matMul(m, ctm);
        break;
      }
      case "BT":
        tlm = IDENTITY_MATRIX.slice(); // BT resets the text and line matrices
        /* D-502: the matrices reset, the INK DOES NOT. `BT` moves the pen to
           this text object's origin, which is true and useless: the reference a
           jump is measured against is where the last run of ink STOPPED, and a
           producer that writes one `BT … ET` per run would otherwise have every
           gap measured from its own origin. Measured on `legistar-73450`, where
           marking the ink here read every gap as ~1,200 ems. */
        tmat = tlm.slice();
        penKnown = true;
        break;
      case "TL": {
        const a = numArgs(1);
        if (a) leading = byteAt(a, 0);
        break;
      }
      /* D-502: the three text-state parameters that enter a glyph's horizontal
         displacement beside the width itself. They change no character. */
      case "Tc": { const a = numArgs(1); if (a) tc = byteAt(a, 0); break; }
      case "Tw": { const a = numArgs(1); if (a) tw = byteAt(a, 0); break; }
      case "Tz": { const a = numArgs(1); if (a) th = byteAt(a, 0) / 100; break; }
      case "Td": case "TD": {
        const a = numArgs(2);
        if (!a) break;
        const tx = byteAt(a, 0), ty = byteAt(a, 1);
        if (op === "TD") leading = -ty;
        tlm = matMul([1, 0, 0, 1, tx, ty], tlm);
        const ly = lineY;
        if (ty !== 0) breakLine();
        else if (ly === null) lineY = baselineOf(tlm, ctm);
        /* D-608: `ty = 0` is along the baseline only if the CTM did not move
           it. A form is entered through its `cm` and /Matrix and typically
           starts `BT 0 0 Td`, which read as a continuation of the page's last
           line (`PAGE HEADform label`, the suite's FORM ARM). `Tm` has always
           asked the device baseline; `Td` now asks it too. Measured inert on
           everything else: 0 of 1,840 real pages moved (M-174). */
        else if (Math.abs(baselineOf(tlm, ctm) - ly) > BASELINE_EPS) breakLine();
        else judgeGap(deviceX(tlm));
        penToLine();
        break;
      }
      case "Tm": {
        const m = numArgs(6);
        if (!m) break;
        tlm = m;
        const y = baselineOf(tlm, ctm);
        const ly = lineY;
        if (ly === null || Math.abs(y - ly) > BASELINE_EPS) breakLine();
        else judgeGap(deviceX(tlm));
        penToLine();
        break;
      }
      case "T*":
        tlm = matMul([1, 0, 0, 1, 0, -leading], tlm);
        breakLine();
        penToLine();
        break;
      default:
        break;
    }
    stack.length = 0; // operands are consumed by their operator
  }
  };

  /* D-608 — TEXT INSIDE A FORM XOBJECT IS READ, THE WAY CPDF-18's IMAGE WALK
   * ALREADY DESCENDS (`pdfPageImages`).
   *
   * MEASURED, not assumed (M-166). This walk interpreted no `Do`, so a page
   * whose text sits in a Form XObject read as fully decoded with none of that
   * text and NO marker: ACFR FY2023-24 p38 gave tier 1 80 glyphs, its running
   * header, and tier 2 546, the header plus every label of two pie charts. All
   * 9 held pages where tier 2 read 10% or more beyond an unflagged tier 1
   * carried form text. The record claimed a page it had not read.
   *
   * WHAT `Do` DOES HERE, and it is ISO 32000-1 §8.10.1's own sequence: save
   * the graphics state, premultiply the CTM by the form's /Matrix, paint the
   * form's content with its OWN /Resources (the enclosing ones when it has
   * none — the image walk's fallback), restore. The text state (font, size,
   * Tc, Tw, Tz, TL) is part of the graphics state and is restored with it. The
   * text matrices are not, but a `Do` inside `BT` is outside the grammar, so
   * they are restored too rather than letting a form a producer wrongly nested
   * there move the page's line. The BASELINE and the INK are not restored: they
   * are held in device space, so a line the form wrote is compared with the
   * page's next line exactly as two page lines are. `/BBox` clipping is not
   * modelled; neither is clipping of the page's own text.
   *
   * WHAT IT CANNOT READ, IT SAYS, COUNTED. A form nested past
   * FORM_DEPTH_LIMIT, or one that paints itself, is not walked; if it shows
   * text, a `form_text_unread` marker counts the bytes its text-showing
   * operators carry (the unit `no_current_font` already counts in: no font is
   * in hand to say how wide a code is). A form whose stream cannot be decoded
   * is `form_stream_undecodable` with a count of 0: whether it held text is
   * undetermined, and a figure for it would be invented. A `Do` naming nothing
   * this scope resolves, or naming an image, adds nothing: there is no text
   * there that any reader could have. */
  /** @param {string | null} name
   *  @param {number} depth
   *  @param {number[]} formChain
   *  @returns {Promise<void>} */
  const paintForm = async (name, depth, formChain) => {
    const res = curResources;
    const xobjects = res ? doc.dictOf(res.XObject) : null;
    const ref = name != null && xobjects ? xobjects[name] : null;
    const st = asStream(ref ? doc.resolve(ref) : null);
    if (!st || nameOf(doc, st.dict.Subtype) !== "Form") return;
    const fr = asRef(ref);
    const key = fr ? fr.n : null;
    const data = await doc.streamDecoded(st);
    if (!data) {
      doc.note("form_stream_undecodable");
      undetermined.push({ page: pageIdx, reason: "form_stream_undecodable", font: null, codes: "", count: 0 });
      return;
    }
    const formToks = tokenizeContent(binaryString(data));
    if (depth >= FORM_DEPTH_LIMIT || (key != null && formChain.includes(key))) {
      const unread = textShowBytes(formToks);
      if (unread > 0) {
        undetermined.push({ page: pageIdx, reason: "form_text_unread", font: null, codes: "", count: unread });
      }
      return;
    }
    const saved = { ctm, curResources, curFontDict, scopeTag, curFont, curFontName,
                    tfs, tc, tw, th, leading, tlm, tmat, penKnown };
    const m = matrixOf(doc, st.dict.Matrix) || IDENTITY_MATRIX;
    ctm = matMul(m, ctm);
    const formRes = doc.dictOf(st.dict.Resources);
    if (formRes) {
      curResources = formRes;
      curFontDict = doc.dictOf(formRes.Font);
      scopeTag = "f" + (key ?? "?" + depth) + ":";
    }
    try {
      await run(formToks, depth + 1, key != null ? [...formChain, key] : formChain);
    } finally {
      ({ ctm, curResources, curFontDict, scopeTag, curFont, curFontName,
         tfs, tc, tw, th, leading, tlm, tmat, penKnown } = saved);
    }
  };

  await run(toks, 0, []);

  let text = pieces.join("").replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "");

  /* CPDF-10 — TIER 1 NAMES THE IMAGE-ONLY PAGE, and this exists because the
   * escalation that was supposed to name it CANNOT FIRE.
   *
   * MEASURED, not assumed. `needsTier2` escalates when undetermined REGIONS
   * outnumber decoded CHARACTERS. A scanned page decodes to zero characters
   * and produces zero markers — there is no font, so nothing ever reaches the
   * decode path to fail — so the test is `0 > 0`, which is FALSE. **The
   * image-only class, which is the entire reason OCR exists, was the one class
   * that never escalated.** Tier 2's `no_text_layer` marker is real and is what
   * `needsTier3` reads, and before this line nothing could ever produce it for
   * a scan, because pdf.js was never asked.
   *
   * THE SIGNAL IS STRUCTURAL, WHICH IS WHY IT IS TRUSTWORTHY. CPDF-9 verified
   * its scanned exhibit as image-only by the file's own structure — 4 pages, 0
   * fonts — rather than by how little text came out. A page that declares NO
   * font resource cannot bear text: that is a fact about the file, not a
   * threshold on an output, and it does not go stale the way a character count
   * would.
   *
   * AND A BLANK PAGE IS NOT A SCAN. Zero fonts alone would mark every empty
   * page as wanting OCR, which would send an engine over a blank sheet and
   * invite exactly the invention CPDF-9's own negative control exists to catch.
   * So the second half is required: the page must DRAW AN IMAGE. Zero fonts and
   * zero images is a blank page and this says NOTHING about it — an absence
   * with nothing to report is not a finding, and inventing a marker for it
   * would put a swarm of them through every document with a separator sheet.
   *
   * `no_text_layer` is I2's EXISTING vocabulary (the Tier-2 reason), used here
   * by a different tier rather than minted afresh — a second spelling for one
   * finding is D-164's lesson and this item is not going to repeat it. */
  /* D-585 — AND "NO FONT DECLARED" WAS TOO NARROW A SPELLING OF "BEARS NO TEXT".
   * A font dictionary is a RESOURCE, and a page can inherit one from its /Pages
   * parent without ever using it: `0201-cafr-2002` is 175 scanned pages, and 161
   * of them inherit a 12-font dictionary and carry an EMPTY `BT … ET` beside the
   * scan image (M-157). No glyph is shown on any of them, and this line read all
   * 161 as zero characters of TEXT — read, and empty — rather than UNREAD, and
   * `needsTier3` never heard of them. What bears text is a text-SHOWING
   * operator, so that is now what is asked, by the one predicate the OCR
   * member's renderer asks too (`pageShowsText`, below). The structural no-font
   * half is KEPT beside it, not replaced: a page with no font resource cannot
   * show a glyph whatever its content says, so it stays sufficient on its own,
   * and every page this line marked before it still marks. What is added is the
   * page that declares fonts and DEFINITELY shows nothing — `false`, never
   * `null`: a content stream or a Form XObject this reader could not read is not
   * evidence that nothing was shown there. */
  if (!text.length && !undetermined.length && pageDrawsImage(doc, resources)
      && (!fontDict || (await pageShowsText(doc, pageMap)) === false)) {
    undetermined.push({
      page: pageIdx, reason: "no_text_layer", font: null, codes: "", count: 0,
    });
  }
  return { text, undetermined, placed: { pieces, boxes, undecodedCenters, unpositioned } };
}

/* D-585 — THE TEXT-SHOWING OPERATORS, and the ONE predicate built on them.
 *
 * ISO 32000-1 §9.4.3 names four operators that show text: `Tj`, `TJ`, `'` and
 * `"`. Every glyph on a page is painted by one of them; `BT`/`ET` only open and
 * close a text object, `Tf` only selects a font, and a font in the resource
 * dictionary is only AVAILABLE. So "does this page bear text" is "does one of
 * these four run", and it is asked in exactly one place, here, by both of its
 * askers: Tier 1's `no_text_layer` marker above, and the OCR member's renderer
 * (`pdf-worker/src/pagepixels.mjs`, `analyzePage`, which imports it). Before
 * D-585 the two asked two different wrong questions — "is a font declared" and
 * "is a text object opened" — and a scan with an inherited font dictionary and
 * an empty `BT … ET` failed both, independently (M-157: 161 of `0201-cafr-2002`'s
 * 175 pages). One predicate is what keeps them from disagreeing again. */
/** @type {readonly string[]} */
export const TEXT_SHOWING_OPERATORS = Object.freeze(["Tj", "TJ", "'", '"']);
const TEXT_SHOWING = new Set(TEXT_SHOWING_OPERATORS);

/** Does this page SHOW text — run a text-showing operator — anywhere it paints:
 *  its own content streams and every Form XObject it draws, however deep (to
 *  `FORM_DEPTH_LIMIT`)? `true` or `false` is MEASURED; `null` is UNDETERMINED
 *  and says so — a content stream or a drawn form that could not be decoded or
 *  resolved, a form nested past the limit or in a cycle. A caller must not read
 *  `null` as `false`: the part this reader could not see is exactly the part
 *  that might have held the text. The tokenizer skips inline-image data, so a
 *  sample byte run that happens to spell `Tj` is not an operator. */
/** R15: see above. `true` or `false` is measured; `null` is undetermined. Never throws.
 *  @param {PdfDoc} doc
 *  @param {PdfMap | null | undefined} pageMap
 *  @returns {Promise<boolean | null>} */
export async function pageShowsText(doc, pageMap) {
  if (!pageMap) return null;
  const top = await decodeContentStreams(doc, pageMap.Contents);
  const topText = top.text;
  if (topText == null) return null;
  /* set by the walk, read once it is done */
  const seen = { unread: false };
  /** @param {string} content
   *  @param {PdfMap | null} resources
   *  @param {number} depth
   *  @param {number[]} formChain
   *  @returns {Promise<boolean>} */
  const walk = async (content, resources, depth, formChain) => {
    const xobjects = resources ? doc.dictOf(resources.XObject) : null;
    /** @type {string | null} */
    let lastName = null;
    for (const tk of tokenizeContent(content, { inlineImages: true })) {
      if (tk.t === "name") { lastName = tk.v; continue; }
      if (tk.t !== "op") continue;
      if (TEXT_SHOWING.has(tk.v)) return true;
      if (tk.v !== "Do") continue;
      const ln = lastName;
      const ref = ln != null && xobjects ? xobjects[ln] : null;
      const st = asStream(ref ? doc.resolve(ref) : null);
      if (!st) { seen.unread = true; continue; }
      if (nameOf(doc, st.dict.Subtype) !== "Form") continue;
      const fr = asRef(ref);
      const key = fr ? fr.n : null;
      if (depth >= FORM_DEPTH_LIMIT || (key != null && formChain.includes(key))) { seen.unread = true; continue; }
      const data = await doc.streamDecoded(st);
      if (!data) { seen.unread = true; continue; }
      const formRes = doc.dictOf(st.dict.Resources) || resources;
      if (await walk(binaryString(data), formRes, depth + 1,
                     key != null ? [...formChain, key] : formChain)) return true;
    }
    return false;
  };
  if (await walk(topText, pageResources(doc, pageMap), 0, [])) return true;
  return seen.unread ? null : false;
}

/** Does this page's resource dictionary declare an image XObject? The second
 *  half of the image-only test above. Deliberately asks about DECLARED
 *  resources rather than interpreting the content stream: a page that lists an
 *  image and never paints it is vanishingly rare, while re-walking the content
 *  stream to find a `Do` would be a second interpreter for one boolean. */
/** @param {PdfDoc} doc
 *  @param {PdfMap | null} resources
 *  @returns {boolean} */
function pageDrawsImage(doc, resources) {
  const xo = resources ? doc.dictOf(resources.XObject) : null;
  if (!xo) return false;
  for (const name of Object.keys(xo)) {
    const map = doc.dictOf(xo[name]);
    if (map && nameOf(doc, map.Subtype) === "Image") return true;
  }
  return false;
}

/* R35 (REC-206) — WHAT TEXT A LINK SITS OVER: its ANCHOR TEXT, read off tier
 * 1's placed glyphs, never off the link's target and never guessed.
 *
 * A glyph belongs to the anchor when its ink point (`glyphBox`'s `c`) lies in
 * the annotation's /Rect. The glyphs are taken in the order the page SHOWED
 * them, and anything between two that are inside (a separator, whitespace, a
 * glyph outside the rect) reads as ONE space; the result is trimmed. So the
 * anchor is the link's own words in content-stream order, which is reading
 * order for every producer measured and is not promised for one that paints
 * out of order.
 *
 * `why` IS NULL ONLY FOR A COMPLETE READING. It names, when not:
 *   no_rect            — the link has no page rect (a document-level file, a
 *                        malformed /Rect);
 *   text_not_read      — tier 1 read no text on that page (encrypted, an
 *                        unreadable page, an extraction error);
 *   no_text_in_rect    — every glyph on the page was placed and none is inside;
 *   positions_unknown  — none placed inside, and the page has glyphs it could
 *                        not place, so absence is not established;
 *   partly_unplaced    — text found, and the page has glyphs it could not place;
 *   undecodable        — nothing decoded inside, and a code under the rect
 *                        decoded to nothing;
 *   partly_undecodable — text found, and a code under the rect decoded to nothing.
 * `tier` is 1 always: when tier 2 later replaces a page's text, the anchor stays
 * tier 1's reading and says so. */
/** @param {PlacedGlyphs | null} placed
 *  @param {LinkPlace | null} source
 *  @returns {LinkAnchor} */
function anchorOf(placed, source) {
  const rect = source ? source.rect : null;
  if (!source || !Array.isArray(rect) || !Number.isInteger(source.page))
    return { text: null, why: "no_rect", tier: 1 };
  if (!placed) return { text: null, why: "text_not_read", tier: 1 };
  const a = byteAt(rect, 0), b = byteAt(rect, 1), c = byteAt(rect, 2), d = byteAt(rect, 3);
  const x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
  /** @param {number[]} pt
   *  @returns {boolean} */
  const inside = (pt) => byteAt(pt, 0) >= x0 && byteAt(pt, 0) <= x1 && byteAt(pt, 1) >= y0 && byteAt(pt, 1) <= y1;
  let out = "", gap = false;
  for (let i = 0; i < placed.pieces.length; i++) {
    const p = placed.pieces[i], bx = placed.boxes[i];
    if (bx && !/^\s*$/.test(p ?? "undefined") && inside(bx.c)) {
      if (gap && out.length) out += " ";
      out += p; gap = false;
    } else gap = true;
  }
  out = out.replace(/\s+/g, " ").trim();
  const undecodable = placed.undecodedCenters.some(inside);
  if (!out.length)
    return { text: null, why: placed.unpositioned ? "positions_unknown"
                            : undecodable ? "undecodable" : "no_text_in_rect", tier: 1 };
  return { text: out,
           why: undecodable ? "partly_undecodable" : placed.unpositioned ? "partly_unplaced" : null,
           tier: 1 };
}

/** Document text (Tier 1). Extends the I2 output; see the module header.
 *  `onPlaced(page, placed)` is handed the placed glyphs (R35), kept off the
 *  output, of each read page in `linkPages` the moment that page is read: only a
 *  page a link sits on is asked, and its glyphs are dropped when the call
 *  returns, so a long document never holds more than one page's at a time (R41). */
/** @param {PdfDoc} doc
 *  @param {(page: number, placed: PlacedGlyphs) => void} [onPlaced]
 *  @param {Set<number>} [linkPages]
 *  @returns {Promise<PdfText>} */
async function extractText(doc, onPlaced = () => {}, linkPages = new Set()) {
  /* D-251: WHO MADE THIS LAYER. Read ONCE, from the file's own /Info, and
     carried on the text shape rather than on the document — because the claim
     it bounds is a claim about the TEXT, and a consumer holding the text is the
     one that must not read it as authored. It rides the encrypted early return
     too: that path yields no text and still has something true to say about
     what could not be read. */
  const producer = readProducer(doc);
  // Encrypted: Tier 1 cannot decode ciphertext content streams, so it decodes
  // NOTHING. Say so with ONE document-level marker naming the cause, rather than
  // attempting every page and emitting a swarm of undecodable notes (CPDF-5).
  // The plane escalates on this to the pdf-worker (I6), which decrypts it.
  if (doc.isEncrypted()) {
    doc.note("encrypted");
    /** @type {Marker} */
    const marker = { page: null, reason: "encrypted", font: null, codes: "", count: 0 };
    return { document: "", pages: [], undetermined: [marker],
             counts: { chars: 0, undetermined: 1 }, producer };
  }
  const fontCache = new FontCache();
  /** @type {PageText[]} */
  const pages = [];
  /** @type {Marker[]} */
  const allUndetermined = [];
  for (let idx = 0; idx < doc.pageCount; idx++) {
    const pageMap = doc.pageDict(idx);
    if (!pageMap) {
      /* R27: a page object that does not resolve is UNREAD, not blank. */
      /** @type {Marker} */
      const marker = { page: idx, reason: "page_unreadable", font: null, codes: "", count: 0 };
      pages.push({ page: idx, text: "", undetermined: [marker] });
      allUndetermined.push(marker);
      continue;
    }
    /** @type {PageReading} */
    let res;
    try {
      res = await extractPageText(doc, idx, pageMap, fontCache, linkPages.has(idx));
    } catch {
      doc.note("text_extraction_error");
      res = { text: "", undetermined: [{ page: idx, reason: "text_extraction_error", font: null, codes: "", count: 0 }] };
    }
    pages.push({ page: idx, text: res.text, undetermined: res.undetermined });
    const placed = res.placed;
    /* a page a link sits on was read for its glyphs (`wantPlaced`), so its pieces and boxes are arrays */
    const pieces = placed ? placed.pieces : null, boxes = placed ? placed.boxes : null;
    if (placed && linkPages.has(idx) && pieces && !(pieces instanceof PieceList) && boxes && "length" in boxes) {
      onPlaced(idx, { pieces, boxes, undecodedCenters: placed.undecodedCenters, unpositioned: placed.unpositioned });
    }
    for (const u of res.undetermined) allUndetermined.push(u);
  }
  /* R41: the non-empty pages' text joined by "\n", as a rope: `join` would make a
     second flat copy of every page's text (27 MB more for the 1,354-page budget
     appendix, whose text is two-byte), where this shares the pages' own. Its
     value is the joined text; whatever flattens it first pays for the copy. */
  let document = "";
  for (const p of pages) if (p.text.length) document = document.length ? document + "\n" + p.text : p.text;
  return {
    document,
    pages,
    undetermined: allUndetermined,
    counts: { chars: document.length, undetermined: allUndetermined.length },
    producer,
  };
}

/* ------------------------------------------------------------------ *
 * CPDF-18 — IMAGES AS CONTENT (EXTRACTION-BREADTH §3.3 item 2, §7 row 4)
 * ------------------------------------------------------------------ *
 *
 * WHAT THIS EMITS. For every image a page PAINTS, the IC-1 `image` reference in
 * its PDF form, the shape IC-124 designed and IC-125's grammar already admits:
 *
 *   { kind:"image", ref:"an image on page <N+1>", page, rect:[x0,y0,x1,y1],
 *     mime, name, inline, width, height, filters, axis_aligned }
 *
 * `page` is 0-based (I2's own numbering) and `rect` is in the page's DEFAULT
 * USER SPACE, in points, lower-left then upper-right — the SAME space and the
 * SAME order as an annotation's /Rect, which is what `pdf-page`'s rect already
 * carries, so one rectangle means one place whichever arm names it (§3.2: "the
 * same fields as pdf-page").
 *
 * HOW THE RECTANGLE IS KNOWN, AND WHY IT IS NOT A GUESS. An image XObject paints
 * the unit square through the current transformation matrix; that is the PDF's
 * own definition of where an image goes (ISO 32000-1 §8.9.4). So the walk below
 * is a small interpreter of exactly the operators that move the CTM — `q`, `Q`,
 * `cm` — and of `Do` (and an inline image's `EI`), descending into Form XObjects
 * through their /Matrix and their own /Resources. It interprets nothing else,
 * and it is deliberately a SECOND walk rather than a change to the text
 * interpreter above, whose output is measured and pinned and must stay
 * byte-identical (the tokenizer's inline-image option is OFF for the text walk).
 *
 * WHAT THE RECTANGLE IS NOT, stated because a consumer would otherwise assume
 * it: it is the image's PAINTED extent, not what survives clipping, and not a
 * claim that nothing is drawn over it. A placement that rotates or skews the
 * image yields its axis-aligned bounding box and says `axis_aligned:false`
 * rather than pretending the box is the image's outline.
 *
 * THE ABSENCE RULE IS IC-124's, not the three older levels': `images` is NULL
 * with `imagesWhy` from every branch that did not walk (an encrypted document, a
 * content stream this reader cannot decode, a walk that threw), and an EMPTY
 * list is a MEASURED ZERO — every page's content was interpreted and none
 * painted an image. Never a partial list: one page that could not be walked
 * makes the whole list null, because a list missing a page reads downstream as
 * "that page has no images", which is the finding this reader is not entitled to.
 *
 * `mime` IS SET ONLY WHERE THE STREAM'S BYTES ARE A FILE OF THAT TYPE — a
 * DCTDecode stream is a JPEG and a JPXDecode stream is a JPEG 2000 codestream.
 * Every other image is SAMPLES, not a file, and its `mime` is null by meaning;
 * `filters` names what it is instead. An invented `image/png` for raw samples
 * would describe a file nobody made.
 *
 * `name` is the XObject's resource name on the page, for tracing; like an office
 * member's file name it is a producer's filing choice and it is NOT the address.
 * The address is page + rect (the canonical extent `canonicalExtent` takes).
 */

/** The file type a filter's bytes are (an ordinary object: a filter an object inherits the name of reads what it inherits).
 *  @type {Readonly<{ [filter: string]: string }>} */
const IMAGE_FILE_MIME = Object.freeze({
  DCTDecode: "image/jpeg", DCT: "image/jpeg", JPXDecode: "image/jp2",
});
const FORM_DEPTH_LIMIT = 8;

/** Round a coordinate to 1/1000 pt so float noise in a composed matrix does
 *  not give one placement two addresses. -0 is written 0. */
/** @param {number} v
 *  @returns {number} */
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x; };

/** The IC-1 `image` reference for a PDF page. Its `ref` is EXACTLY the human
 *  form `describeExtent` derives for the same address (IC-1's parity rule):
 *  R16 here and text-chain's R98 state the same `an image on page <n+1>`. */
/** The reference, with a placement's fields (when given) beside it, after `rect`.
 *  @param {number} page
 *  @param {number[]} rect
 *  @param {PlacementFields | { [key: string]: never }} [extra]
 *  @returns {ImageRef} */
export function pdfImageRef(page, rect, extra = {}) {
  return { kind: "image", ref: word("pdfstructure.image_page", { page: String(page + 1) }), page, rect, ...extra };
}
/** `pdfImageRef` with a placement's fields: one placement (R16), its members in that order.
 *  @param {number} page
 *  @param {number[]} rect
 *  @param {PlacementFields} fields
 *  @returns {ImagePlacement} */
function placementOf(page, rect, fields) {
  return { kind: "image", ref: word("pdfstructure.image_page", { page: String(page + 1) }), page, rect, ...fields };
}

/** CTM composition: `cm` sets CTM' = M x CTM (row-vector convention). */
/** @param {Matrix} m
 *  @param {Matrix} c
 *  @returns {number[]} */
function mulMatrix(m, c) {
  const m0 = byteAt(m, 0), m1 = byteAt(m, 1), m2 = byteAt(m, 2), m3 = byteAt(m, 3), m4 = byteAt(m, 4), m5 = byteAt(m, 5);
  const c0 = byteAt(c, 0), c1 = byteAt(c, 1), c2 = byteAt(c, 2), c3 = byteAt(c, 3), c4 = byteAt(c, 4), c5 = byteAt(c, 5);
  return [
    m0 * c0 + m1 * c2, m0 * c1 + m1 * c3,
    m2 * c0 + m3 * c2, m2 * c1 + m3 * c3,
    m4 * c0 + m5 * c2 + c4, m4 * c1 + m5 * c3 + c5,
  ];
}

/** The unit square through `ctm`, as an axis-aligned [x0,y0,x1,y1]. */
/** @param {Matrix} ctm
 *  @returns {number[]} */
function unitSquareRect(ctm) {
  /** @type {[number, number][]} */
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const pts = corners.map(([x, y]) =>
    [byteAt(ctm, 0) * x + byteAt(ctm, 2) * y + byteAt(ctm, 4), byteAt(ctm, 1) * x + byteAt(ctm, 3) * y + byteAt(ctm, 5)]);
  const xs = pts.map((p) => byteAt(p, 0)), ys = pts.map((p) => byteAt(p, 1));
  return [r3(Math.min(...xs)), r3(Math.min(...ys)), r3(Math.max(...xs)), r3(Math.max(...ys))];
}

/** A form's `/Matrix`: six finite numbers, or null.
 *  @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @returns {number[] | null} */
function matrixOf(doc, v) {
  const a = asArr(doc.resolve(v));
  if (!a || a.items.length !== 6) return null;
  const n = numbersOf(a.items.map((x) => doc.resolve(x)));
  return n && n.every((x) => Number.isFinite(x)) ? n : null;
}

/** @param {PdfDoc} doc
 *  @param {PdfMap} dict
 *  @returns {string[]} */
function imageFilters(doc, dict) {
  const f = doc.resolve(dict.Filter);
  if (!f) return [];
  const fn = asName(f), fa = asArr(f);
  if (fn) return [fn.v];
  if (fa) {
    /** @type {string[]} */
    const names = [];
    for (const x of fa.items) { const name = nameOf(doc, x); if (name) names.push(name); }
    return names;
  }
  return [];
}

/** Decode a list of content streams, or say which one could not be.
 *  @param {PdfDoc} doc
 *  @param {PdfValue | undefined} contents
 *  @returns {Promise<{ text: string, over?: undefined } | { text: null, over?: true }>} */
async function decodeContentStreams(doc, contents) {
  const c = doc.resolve(contents);
  if (!c) return { text: "" };
  const ca = asArr(c);
  const streams = ca ? ca.items.map((x) => doc.resolve(x)) : [c];
  /** @type {string[]} */
  const parts = [];
  const bound = STREAM_CAPS.page_content;
  let total = 0;
  for (const st of streams) {
    if (!asStream(st)) continue;
    const got = await doc._decode(st, "page_content", bound - total);
    if ("over" in got) return { text: null, over: true };
    if (!got.data) return { text: null };
    total += got.data.length;
    if (total > bound) return { text: null, over: true };
    parts.push(binaryString(got.data));
  }
  return { text: parts.join("\n") };
}

/* N9 (R32): each placement's stream and composed CTM, held OUTSIDE the
 * placement so its enumerable shape (R16) is exactly the IC-1 reference and no
 * parser object can be read off it by a field name. `pdf-worker`'s crop asks
 * `imagePlacementSource` instead. A copy of a placement is not a key. */
/** @type {WeakMap<object, PlacementSource>} */
const PLACEMENT_SOURCE = new WeakMap();

/** The stream and composed CTM behind one placement `pdfPageImages` returned:
 *  `{ stream, ctm }` (`stream` null for an inline image; `ctm` a fresh copy), or
 *  null for anything else (R32). Never throws. */
/** R32: see above. Never throws.
 *  @param {unknown} placement
 *  @returns {PlacementSource | null} */
export function imagePlacementSource(placement) {
  if (!placement || typeof placement !== "object") return null;
  const src = PLACEMENT_SOURCE.get(placement);
  return src ? { stream: src.stream, ctm: src.ctm.slice() } : null;
}

/**
 * Every image one page PAINTS, in painting order, with its rectangle.
 * Returns `{ images:[placement…], why:null }` or `{ images:null, why }`.
 * @param {PdfDoc} doc
 * @param {number} pageIdx
 * @returns {Promise<PageImages>}
 */
export async function pdfPageImages(doc, pageIdx) {
  return pageImagesOf(doc, pageIdx, null);
}

/** `pdfPageImages` whose walk gives the thread back on a bounded slice when it carries a slicer (R45).
 *  @param {PdfDoc} doc
 *  @param {number} pageIdx
 *  @param {Slicer | null} sl
 *  @returns {Promise<PageImages>} */
async function pageImagesOf(doc, pageIdx, sl) {
  const pageMap = doc.pageDict(pageIdx);
  if (!pageMap) return { images: null, why: `page_unreadable:${pageIdx}` };
  const top = await decodeContentStreams(doc, pageMap.Contents);
  const topText = top.text;
  if (topText == null) return { images: null, why: `${top.over ? "page_over_bound" : "content_stream_undecodable"}:page ${pageIdx}` };

  /** @type {ImagePlacement[]} */
  const images = [];
  /** @param {string} content
   *  @param {PdfMap | null} resources
   *  @param {number[]} ctm0
   *  @param {number} depth
   *  @param {number[]} formChain
   *  @returns {Promise<void>} */
  const walk = async (content, resources, ctm0, depth, formChain) => {
    const xobjects = resources ? doc.dictOf(resources.XObject) : null;
    const toks = tokenizeContent(content, { inlineImages: true });
    let ctm = ctm0;
    /** @type {number[][]} */
    const saved = [];
    /** @type {ContentToken[]} */
    const operands = [];
    for (const tk of toks) {
      if (sl && ++sl.n >= SLICE_UNITS) await sl.go();
      if (tk.t !== "op") { operands.push(tk); continue; }
      switch (tk.v) {
        case "q": saved.push(ctm); break;
        case "Q": if (saved.length) { const top = saved.pop(); if (top) ctm = top; } break;
        case "cm": {
          /** @type {number[]} */
          const all = [];
          for (const o of operands) if (o.t === "num") all.push(o.v);
          const nums = all.slice(-6);
          if (nums.length === 6) ctm = mulMatrix(nums, ctm);
          break;
        }
        case "Do": {
          /** @type {TokName | undefined} */
          let nameTok;
          for (let i = operands.length - 1; i >= 0; i--) { const o = operands[i]; if (o && o.t === "name") { nameTok = o; break; } }
          const nt = nameTok;
          const ref = nt && xobjects ? xobjects[nt.v] : null;
          const st = asStream(ref ? doc.resolve(ref) : null);
          /* A `Do` naming nothing this page can resolve may have painted an
             image; reporting the page without it would be the partial list the
             absence rule forbids, so the page is UNWALKABLE, by name. */
          if (!st)
            throw new Error(`xobject_unresolvable:page ${pageIdx}:${nt ? nt.v : "?"}`);
          const sub = nameOf(doc, st.dict.Subtype);
          if (sub === "Image") {
            const filters = imageFilters(doc, st.dict);
            const last = filters[filters.length - 1] || null;
            const placement = placementOf(pageIdx, unitSquareRect(ctm), {
              mime: IMAGE_FILE_MIME[String(last)] ?? null,
              name: nt ? nt.v : null,
              inline: false,
              width: typeof doc.resolve(st.dict.Width) === "number" ? numberVal(doc.resolve(st.dict.Width)) : null,
              height: typeof doc.resolve(st.dict.Height) === "number" ? numberVal(doc.resolve(st.dict.Height)) : null,
              filters,
              axis_aligned: ctm[1] === 0 && ctm[2] === 0,
            });
            PLACEMENT_SOURCE.set(placement, { stream: st, ctm });
            images.push(placement);
          } else if (sub === "Form") {
            const fr = asRef(ref);
            const key = fr ? fr.n : null;
            if (depth >= FORM_DEPTH_LIMIT || (key != null && formChain.includes(key))) {
              throw new Error(`form_nesting_unwalkable:page ${pageIdx}`);
            }
            const data = await doc.streamDecoded(st);
            if (!data) throw new Error(`form_stream_undecodable:page ${pageIdx}`);
            const m = matrixOf(doc, st.dict.Matrix) || [1, 0, 0, 1, 0, 0];
            const formRes = doc.dictOf(st.dict.Resources) || resources;
            await walk(binaryString(data), formRes, mulMatrix(m, ctm), depth + 1,
                       key != null ? [...formChain, key] : formChain);
          }
          break;
        }
        case "EI": {
          /* An inline image paints the unit square exactly as an XObject does.
             Its bytes live inside the content stream and nothing downstream
             extracts them yet, so it is REPORTED (it is on the page and a
             reader asking "what images are here" must be told) with no name
             and no file type, and `inline:true` says why. */
          const placement = placementOf(pageIdx, unitSquareRect(ctm), {
            mime: null, name: null, inline: true, width: null, height: null,
            filters: [], axis_aligned: ctm[1] === 0 && ctm[2] === 0,
          });
          PLACEMENT_SOURCE.set(placement, { stream: null, ctm });
          images.push(placement);
          break;
        }
        default: break;
      }
      operands.length = 0;
    }
  };
  try {
    await walk(topText, pageResources(doc, pageMap), [1, 0, 0, 1, 0, 0], 0, []);
  } catch (e) {
    return { images: null, why: String(thrownMessage(e) || e).slice(0, 120) };
  }
  return { images, why: null };
}

/** What `e && e.message` reads of a thrown value: its `message` when it is an object or function that has one (an Error
 *  this walk raised, or one the platform raised), else the value itself when falsy, else undefined.
 *  @param {unknown} e
 *  @returns {unknown} */
function thrownMessage(e) {
  if (!e) return e;
  if (e instanceof Error) return e.message;
  return (typeof e === "object" || typeof e === "function") && "message" in e ? e.message : undefined;
}

/** Every page's images, or NULL with the reason — never a partial list.
 *  @param {PdfDoc} doc
 *  @returns {Promise<PageImages>} */
async function extractImages(doc) {
  if (doc.isEncrypted()) return { images: null, why: "encrypted" };
  /** @type {ImagePlacement[]} */
  const all = [];
  for (let idx = 0; idx < doc.pageCount; idx++) {
    const got = await pdfPageImages(doc, idx);
    if (!got.images) return { images: null, why: got.why };
    for (const im of got.images) all.push(im);
  }
  return { images: all, why: null };
}

/* ------------------------------------------------------------------ *
 * D-627 (R26) — A PAGE WHOSE CONTENT IS A PAINTED IMAGE, WHILE ITS TEXT IS A
 * FOLIO
 * ------------------------------------------------------------------ *
 *
 * D-608 made tier 1 read text inside Form XObjects, so a page that paints an
 * image of a table and draws its folio through a form now BEARS text and
 * rightly carries no `no_text_layer`. Its CONTENT is still unread: a folio does
 * not read a page an image fills. This marker states that second fact, and the
 * escalation that reads markers can route it to OCR as it routes a no-text page.
 *
 * THE TWO FIGURES, both carried on the marker:
 *   - `image_share`: the share of the page's visible box (CropBox inside
 *     MediaBox, inherited) that the UNION of its painted images' rectangles
 *     (R16) covers, each clipped to the box: an overlap counts once and a part
 *     off the page counts nothing. Rounded to 4 places.
 *   - `glyphs`: the text the page SHOWS: its decoded non-whitespace code
 *     points, plus the `count` of its undetermined markers (characters shown
 *     that tier 1 could not decode). A folio with no /ToUnicode is 3 either way.
 *
 * THE THRESHOLDS ARE MEASURED (M-178, snapshot `land/worker/D-627`), not
 * guessed: over 1,788 pages of three budget and audit documents, the 17 pages
 * that paint an image and show at most a folio are all images of content, with
 * shares 0.1897 to 0.6542; every other image-painting page shows at least 22
 * glyphs. So at most 4 glyphs with a share of at least 0.18 reads
 * `image_content_unread`; any other image-painting page under 22 glyphs (5 to
 * 21 glyphs, a share under 0.18, or a page box that cannot be read) reads
 * `image_content_undetermined` — never forced either way; 22 glyphs or more
 * says nothing. R26 states these figures (K30). They are general PDF-reading
 * parameters (R29): where they were measured is provenance, not jurisdiction.
 * R26 applies only to a page that shows text: a page carrying `no_text_layer`
 * (R14) already says it is unread and carries neither marker (K32).
 *
 * WHAT THIS CANNOT SEE (M-178): a chart painted as an image under a text title
 * has the same two figures as a photo page with captions, so it reads no
 * marker. With `images` null (a walk that did not finish, or an encrypted file)
 * no share can be measured and nothing is said. */
const IMAGE_CONTENT_MAX_GLYPHS = 4;
const IMAGE_CONTENT_MIN_SHARE = 0.18;
const IMAGE_CONTENT_TEXT_GLYPHS = 22;

/** An INHERITABLE page attribute (/MediaBox, /CropBox, /Rotate: ISO 32000-1
 *  §7.7.3.4), read up the page tree: the nearest definition, resolved, or
 *  undefined when neither the page nor any /Pages ancestor defines it. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} pageMap
 *  @param {string} key
 *  @returns {PdfValue | undefined} */
function inheritedAttr(doc, pageMap, key) {
  /** @type {PdfMap | null} */
  let p = pageMap;
  for (let d = 0; ;) {
    const cur = p;
    if (!(cur && d++ < 32)) break;
    if (cur[key] !== undefined) return doc.resolve(cur[key]);
    p = doc.dictOf(cur.Parent);
  }
  return undefined;
}

/** An inherited box attribute as [x0,y0,x1,y1], corners normalised and origin
 *  kept, or null when the nearest definition is not four finite numbers. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} pageMap
 *  @param {string} key
 *  @returns {number[] | null} */
function inheritedBox(doc, pageMap, key) {
  const a = asArr(inheritedAttr(doc, pageMap, key));
  if (!a || a.items.length !== 4) return null;
  const v = numbersOf(a.items.map((x) => doc.resolve(x)));
  if (!v || !v.every((x) => Number.isFinite(x))) return null;
  const [x0, y0, x1, y1] = [byteAt(v, 0), byteAt(v, 1), byteAt(v, 2), byteAt(v, 3)];
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/** A page's visible box, [x0,y0,x1,y1]: CropBox inside MediaBox, each inherited
 *  through /Parent. Null when there is no readable MediaBox. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} pageMap
 *  @returns {number[] | null} */
function pageBox(doc, pageMap) {
  const mb = inheritedBox(doc, pageMap, "MediaBox");
  if (!mb) return null;
  const cb = inheritedBox(doc, pageMap, "CropBox");
  return cb ? clipRect(cb, mb) : mb;
}

/** @param {number[]} a
 *  @param {number[]} b
 *  @returns {number[]} */
const clipRect = (a, b) => [Math.max(byteAt(a, 0), byteAt(b, 0)), Math.max(byteAt(a, 1), byteAt(b, 1)), Math.min(byteAt(a, 2), byteAt(b, 2)), Math.min(byteAt(a, 3), byteAt(b, 3))];
/** @param {number[]} r
 *  @returns {number} */
const rectArea = (r) => Math.max(0, byteAt(r, 2) - byteAt(r, 0)) * Math.max(0, byteAt(r, 3) - byteAt(r, 1));

/** The area the union of axis-aligned rectangles covers, each point once.
 *  @param {number[][]} rects
 *  @returns {number} */
function unionArea(rects) {
  const rs = rects.filter((r) => rectArea(r) > 0);
  const xs = [...new Set(rs.flatMap((r) => [byteAt(r, 0), byteAt(r, 2)]))].sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = byteAt(xs, i), x1 = byteAt(xs, i + 1);
    const spans = rs.filter((r) => byteAt(r, 0) <= x0 && byteAt(r, 2) >= x1).map((r) => [byteAt(r, 1), byteAt(r, 3)]).sort((a, b) => byteAt(a, 0) - byteAt(b, 0));
    /* `lo` and `hi` are set together: `hi` is a number whenever `lo` is */
    let covered = 0, open = false, lo = 0, hi = 0;
    for (const span of spans) {
      const a = byteAt(span, 0), b = byteAt(span, 1);
      if (!open || a > hi) { if (open) covered += hi - lo; lo = a; hi = b; open = true; }
      else hi = Math.max(hi, b);
    }
    if (open) covered += hi - lo;
    total += covered * (x1 - x0);
  }
  return total;
}

/** Add D-627's markers to tier 1's text, in place. `images` is R16's list. */
/** @param {PdfDoc} doc
 *  @param {PdfText | RangeText} text
 *  @param {ImagePlacement[]} images
 *  @returns {void} */
function markImageContent(doc, text, images) {
  if (!text || !Array.isArray(text.pages) || !Array.isArray(images)) return;
  let added = 0;
  for (const pg of text.pages) {
    const painted = images.filter((im) => im.page === pg.page);
    if (!painted.length) continue;
    const marks = pg.undetermined;
    if (marks.some((m) => m.reason === "no_text_layer")) continue; // R26 is for a page that shows text (K32)
    let decoded = 0;
    for (const ch of pg.text) if (!/\s/u.test(ch)) decoded++;
    const glyphs = decoded + marks.reduce((n, m) => n + (Number.isFinite(m.count) ? m.count : 0), 0);
    if (glyphs >= IMAGE_CONTENT_TEXT_GLYPHS) continue;
    const pageMap = doc.pageDict(pg.page);
    const box = pageMap ? pageBox(doc, pageMap) : null;
    const share = box && rectArea(box) > 0
      ? Math.round(unionArea(painted.map((im) => clipRect(im.rect, box))) / rectArea(box) * 10000) / 10000
      : null;
    const unread = share !== null && share >= IMAGE_CONTENT_MIN_SHARE && glyphs <= IMAGE_CONTENT_MAX_GLYPHS;
    pg.undetermined = [...marks, {
      page: pg.page, reason: unread ? "image_content_unread" : "image_content_undetermined",
      font: null, codes: "", count: 0, image_share: share, glyphs,
    }];
    added++;
  }
  if (!added) return;
  restateUndetermined(text);
}

/** After markers were added to pages: the document's list is every page's, in
 *  page order, then the document-level ones; the count follows it. */
/** @param {PdfText | RangeText} text
 *  @returns {void} */
function restateUndetermined(text) {
  text.undetermined = [...text.pages.flatMap((p) => p.undetermined),
                       ...text.undetermined.filter((m) => !Number.isInteger(m.page))];
  text.counts = { ...text.counts, undetermined: text.undetermined.length };
}

/* ------------------------------------------------------------------ *
 * D-665 (R34) — EVERY PAINTED IMAGE ABOVE A SIZE FLOOR SAYS ITS CONTENT IS
 * UNREAD
 * ------------------------------------------------------------------ *
 *
 * The true statement is per IMAGE and needs no classifier: an image a page
 * paints is content whose text, if it has any, is UNREAD until a pass reads
 * it. That holds for a photo as for a chart, so tier 1 says it for every
 * placement above a size floor without deciding what the image depicts. The
 * marker carries the placement's `rect` exactly as R16 emits it (so it names
 * the same `image {page, rect}` reference) and its `area_share`: the part of
 * the rect inside the page's visible box (R26's box), over the box's area, to
 * 4 places. With no readable box the share is NULL and the image is still
 * marked: that it was painted is known, its size is not. `count` is 0: it is
 * not an undecoded character.
 *
 * THE FLOOR IS MEASURED (M-182), NOT GUESSED. Over 1,104 placements in three
 * held documents, 781 are 12x12-pixel bullets with shares of at most 0.0000624;
 * the smallest other placement has 0.0079. 0.001 sits inside that gap, nearer
 * the bullets, so an image smaller than any measured one is stated rather than
 * hidden. A general PDF-reading parameter (R29).
 *
 * IT ROUTES NOTHING. M-178's 49 classified pages showed no measured signal that
 * separates a chart under a title from a photo page, so this is not an OCR
 * reason; it says what is true in the meantime. */
const IMAGE_UNREAD_MIN_SHARE = 0.001;

/** Add R34's per-image markers to tier 1's text, in place. `images` is R16's list. */
/** @param {PdfDoc} doc
 *  @param {PdfText | RangeText} text
 *  @param {ImagePlacement[]} images
 *  @returns {void} */
function markImagesUnread(doc, text, images) {
  if (!text || !Array.isArray(text.pages) || !Array.isArray(images)) return;
  let added = 0;
  for (const pg of text.pages) {
    const painted = images.filter((im) => im.page === pg.page);
    if (!painted.length) continue;
    const pageMap = doc.pageDict(pg.page);
    const box = pageMap ? pageBox(doc, pageMap) : null;
    const boxArea = box ? rectArea(box) : 0;
    /** @type {Marker[]} */
    const marks = [];
    for (const im of painted) {
      const raw = box && boxArea > 0 ? rectArea(clipRect(im.rect, box)) / boxArea : null;
      if (raw !== null && raw < IMAGE_UNREAD_MIN_SHARE) continue;
      marks.push({ page: pg.page, reason: "image_unread", font: null, codes: "", count: 0,
                   rect: im.rect, area_share: raw === null ? null : Math.round(raw * 10000) / 10000 });
    }
    if (!marks.length) continue;
    pg.undetermined = [...pg.undetermined, ...marks];
    added += marks.length;
  }
  if (added) restateUndetermined(text);
}

/* ------------------------------------------------------------------ *
 * D-374 (R33) — EACH PAGE'S BOX, THE BOUND A `pdf-page` RECT IS CHECKED
 * AGAINST
 * ------------------------------------------------------------------ *
 *
 * WHICH BOX, AND WHY THE MEDIABOX. A `pdf-page` rect is in default user space,
 * the space the file's own content is laid out in, and the MediaBox is that
 * space's page. The CropBox is only the part a viewer SHOWS; content cropped
 * out of view is still in the file and a citation may need to point at it, so
 * bounding by the CropBox would refuse a true address. (R26's share asks a
 * different question, what a viewer sees, and reads the visible box.)
 *
 * NEVER A DEFAULT. A page with no readable /MediaBox has an UNDETERMINED box:
 * inventing US Letter for it would bound a citation by a box the document never
 * stated. A box with no area bounds nothing and is unreadable, not a zero page.
 *
 * THE BOX KEEPS ITS ORIGIN (`[-9 -9 621 801]` is legal): a rect is compared
 * with the box's own corners. `w`/`h` ride beside it for a reader who wants a
 * size. /ROTATE IS CARRIED AND DOES NOT MOVE THE BOX: user space is the
 * unrotated space; `rotate` lets a refusal tell a member whose coordinates came
 * from a turned view why they do not fit. One that is not a multiple of 90 is
 * not a rotation the format admits and reads NULL. */
/** @param {PdfDoc} doc
 *  @param {PdfMap | null} pageMap
 *  @returns {PageBox | null} */
function pdfPageBox(doc, pageMap) {
  if (!pageMap) return null;
  const box = inheritedBox(doc, pageMap, "MediaBox");
  if (!box || !(byteAt(box, 2) > byteAt(box, 0) && byteAt(box, 3) > byteAt(box, 1))) return null;
  const r = inheritedAttr(doc, pageMap, "Rotate");
  const rotate = r === undefined || r === null ? 0
    : typeof r === "number" && Number.isInteger(r) && r % 90 === 0 ? ((r % 360) + 360) % 360 : null;
  return { media_box: box, w: byteAt(box, 2) - byteAt(box, 0), h: byteAt(box, 3) - byteAt(box, 1), rotate };
}

/** Every page's box, `{ boxes, of_page }`: `of_page[i]` indexes page i's
 *  distinct box in `boxes`, or is null where it cannot be read. A document of
 *  thousands of pages is almost always one box, so each is stored once. Null
 *  only when there is no page to read. */
/** @param {PdfDoc} doc
 *  @returns {PageBoxes | null} */
function extractPageBoxes(doc) {
  /** @type {{ boxes: PageBoxes | null }} */
  const out = { boxes: null };
  for (const _ of pageBoxSteps(doc, out)); // eslint-disable-line no-unused-vars
  return out.boxes;
}

/** `extractPageBoxes` as steps (R45): it yields every SLICE_OBJECTS pages, so a range's first call over a document of many
 *  pages gives the thread back while it reads the boxes; `extractPageBoxes` drains it with no await between steps. */
/** The steps leave their answer in `out.boxes` (null when the document has no page).
 *  @param {PdfDoc} doc
 *  @param {{ boxes: PageBoxes | null }} out
 *  @returns {Generator<void, void, undefined>} */
function* pageBoxSteps(doc, out) {
  out.boxes = null;
  if (!doc.pageCount) return;
  /** @type {PageBox[]} */
  const boxes = [];
  /** @type {Map<string, number>} */
  const key = emptyMap();
  /** @type {(number | null)[]} */
  const of_page = [];
  for (let idx = 0; idx < doc.pageCount; idx++) {
    if (idx && idx % SLICE_OBJECTS === 0) yield;
    const b = pdfPageBox(doc, doc.pageDict(idx));
    if (!b) { of_page.push(null); continue; }
    const k = JSON.stringify(b);
    if (!key.has(k)) { key.set(k, boxes.length); boxes.push(b); }
    of_page.push(key.get(k) ?? null);
  }
  out.boxes = { boxes, of_page };
}

/* ------------------------------------------------------------------ *
 * K1888 (R36) — EVERY PLACE THE FILE CAN ACT WHEN IT IS OPENED
 * ------------------------------------------------------------------ *
 *
 * The readers' structure check of the virus package: what a viewer would RUN
 * or OPEN on its own, found by the keys and names that say so, after PDFiD's
 * triage keys (`/OpenAction`, `/AA`, `/JS`, `/JavaScript`, `/XFA`,
 * `/RichMedia`, `/Launch`, `/EmbeddedFile`, `/Encrypt`). READ, NEVER RUN: a
 * script's text is not even read, only the fact that a key holds one. An item
 * says the file CAN act, never that it is malicious; the threat grade
 * downstream weighs it.
 *
 * EVERY OBJECT R8's READ REACHES IS EXAMINED, in the page tree or not, in
 * object-number order, each walked depth-first through its direct
 * dictionaries and arrays (a referenced object is examined in its own turn),
 * so an action hidden off the page tree is still found and a key is listed
 * wherever it sits, as PDFiD counts it. A name is compared DECODED, because
 * the parser decodes `#xx` before anything sees it (`/J#61vaScript` is
 * `/JavaScript`): the obfuscation PDFiD reports separately cannot hide a key.
 *
 * ONE ITEM PER DICTIONARY PER KIND, at the first key that shows it, so a
 * JavaScript action written `/S /JavaScript /JS (…)` is one place, not two;
 * an embedded file is one item per FILE (a tree node can name several).
 *
 * WHAT IT COULD NOT READ, IT SAYS. An object stream that would not decode
 * hides every object in it, and an encrypted document's object streams are
 * ciphertext: each adds one `unread` item, so a short list is never read as
 * a clean one. `[]` is a measured nothing. */
const ACTIVE_WALK_DEPTH = 64;

/** R36's list for an opened document. */
/** @param {PdfDoc} doc
 *  @returns {ActiveItem[]} */
function extractActive(doc) {
  /* The page an object belongs to: a page itself, or an annotation one of
     them lists (the first page wins). */
  /** @type {Map<number, number>} */
  const pageOf = emptyMap();
  for (let idx = 0; idx < doc.pageCount; idx++) {
    const num = byteAt(doc._pageOrder, idx);
    if (!pageOf.has(num)) pageOf.set(num, idx);
  }
  for (let idx = 0; idx < doc.pageCount; idx++) {
    const pm = doc.pageDict(idx);
    const annots = asArr(pm ? doc.resolve(pm.Annots) : null);
    if (!annots) continue;
    for (const a of annots.items) { const ar = asRef(a); if (ar && !pageOf.has(ar.n)) pageOf.set(ar.n, idx); }
  }
  const efNodes = embeddedTreeNodes(doc);
  /** @type {ActiveItem[]} */
  const items = [];
  for (const num of [...doc._objs.keys()].sort((a, b) => a - b)) {
    const page = pageOf.get(num) ?? null;
    walkActive(doc, doc._objs.peek(num), efNodes, 0,
      (kind, key, detail) => items.push({ kind, where: { object: num, page, key }, detail }));
  }
  if (doc.notes.includes("objstm_undecodable"))
    items.push({ kind: "unread", where: null, detail: "objstm_undecodable" });
  if (doc.isEncrypted()) items.push({ kind: "unread", where: null, detail: "encrypted" });
  return items;
}

/** Every node of the catalog's /Names /EmbeddedFiles tree (R5's), by the
 *  identity of its resolved dict, so the walk knows a /Names array there is
 *  a list of files and not of anything else. */
/** @param {PdfDoc} doc
 *  @returns {Set<PdfMap>} */
function embeddedTreeNodes(doc) {
  /** @type {Set<PdfMap>} */
  const nodes = emptySet();
  /* The walk compares the identity of a node's dictionary with the one it meets
     when it examines that object (R41's table parses on demand), so the objects
     on this tree are pinned: every parse of one is the same value. */
  /** @param {PdfValue | undefined} v
   *  @returns {PdfValue} */
  const pinned = (v) => {
    let cur = v;
    for (let hops = 0; hops < 64; hops++) {
      const r = asRef(cur);
      if (!r) break;
      doc._objs.pin(r.n); cur = doc._objs.get(r.n);
    }
    const end = cur;
    return end && !asRef(end) ? end : null;
  };
  const root = doc.root;
  const namesNode = root ? pinned(root.Names) : null;
  const names = namesNode ? mapOf(namesNode) : null;
  /** @param {PdfValue | undefined} v
   *  @param {number} depth */
  const visit = (v, depth) => {
    const node = asDict(pinned(v));
    if (!node || depth > 64 || nodes.has(node.map)) return;
    nodes.add(node.map);
    const kids = asArr(doc.resolve(node.map.Kids));
    if (kids) for (const kid of kids.items) visit(kid, depth + 1);
  };
  if (names) visit(names.EmbeddedFiles, 0);
  return nodes;
}

/** Walk one value, calling `emit(kind, key, detail)` for each finding.
 *  @param {PdfDoc} doc
 *  @param {PdfValue | undefined} v
 *  @param {Set<PdfMap>} efNodes
 *  @param {number} depth
 *  @param {ActiveEmit} emit
 *  @returns {void} */
function walkActive(doc, v, efNodes, depth, emit) {
  if (!v || typeof v !== "object" || depth > ACTIVE_WALK_DEPTH) return;
  if (v.t === "arr") {
    for (const it of v.items) walkActive(doc, it, efNodes, depth + 1, emit);
    return;
  }
  const map = v.t === "dict" ? v.map : v.t === "stream" ? v.dict : null;
  if (!map) return;
  /** @type {Set<string>} */
  const found = emptySet();
  /** @type {ActiveEmit} */
  const once = (kind, key, detail) => { if (!found.has(kind)) { found.add(kind); emit(kind, key, detail); } };
  const attachment = nameOf(doc, map.Subtype) === "FileAttachment";
  for (const key of Object.keys(map)) {
    const val = map[key];
    switch (key) {
      case "OpenAction": once("open-action", key, openActionDetail(doc, val)); break;
      case "AA": {
        const aa = doc.dictOf(val);
        once("additional-actions", key, aa ? Object.keys(aa).map((k) => "/" + k) : []);
        break;
      }
      case "JS": case "JavaScript": once("javascript", key, null); break;
      case "S": {
        const s = nameOf(doc, val);
        if (s === "JavaScript") once("javascript", key, null);
        else if (s === "Launch") once("launch", key, launchTarget(doc, map));
        break;
      }
      case "XFA": once("xfa", key, null); break;
      case "RichMediaContent": once("rich-media", key, null); break;
      case "Subtype": if (nameOf(doc, val) === "RichMedia") once("rich-media", key, null); break;
      case "FS":
        if (attachment) emit("embedded-file", key, embeddedName(doc, doc.dictOf(val), strOf(doc, map.Contents)));
        break;
      case "Filter": {
        /* R23's own test: the Standard handler's dictionary, a bare name and a
           numeric /R, which the standard requires stay unencrypted. */
        const fn = asName(val);
        if (fn && fn.v === "Standard" && map.R != null && typeof doc.resolve(map.R) === "number")
          once("encryption", key, numberVal(doc.resolve(map.R)));
        break;
      }
      case "Names": {
        if (!efNodes.has(map)) break;
        const pairs = asArr(doc.resolve(val));
        if (!pairs) break;
        for (let i = 0; i + 1 < pairs.items.length; i += 2) {
          const k = asStr(doc.resolve(pairs.items[i]));
          emit("embedded-file", key, embeddedName(doc, doc.dictOf(pairs.items[i + 1]), k ? k.v : null));
        }
        break;
      }
      default: break;
    }
    walkActive(doc, val, efNodes, depth + 1, emit);
  }
  /* An attachment with no /FS is still R5's record (undetermined): listed. */
  if (attachment && !("FS" in map)) emit("embedded-file", "FS", embeddedName(doc, null, strOf(doc, map.Contents)));
}

/** `/OpenAction`'s detail: the action's /S, or "destination" for a bare
 *  destination (an array, a name or a string); null for an action dict with
 *  no /S or a value that resolves to nothing. */
/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} val
 *  @returns {string | null} */
function openActionDetail(doc, val) {
  const r = doc.resolve(val);
  if (!r || typeof r !== "object") return null;
  if (r.t === "arr" || r.t === "name" || r.t === "str") return "destination";
  if (r.t === "dict") return nameOf(doc, r.map.S);
  return null;
}

/** A Launch action's target as the file states it: /F (a string, or a file
 *  specification's /UF or /F), or the same under /Win; null when none. */
/** @param {PdfDoc} doc
 *  @param {PdfMap} action
 *  @returns {string | null} */
function launchTarget(doc, action) {
  for (const holder of [action, doc.dictOf(action.Win)]) {
    if (!holder) continue;
    const f = doc.resolve(holder.F);
    const fs = asStr(f), fd = asDict(f);
    if (fs) return fs.v;
    const name = fd ? embeddedName(doc, fd.map, null) : null;
    if (name) return name;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * N1202 (R39) — THE DOCUMENT'S OWN TITLE, FROM ITS /Info
 * ------------------------------------------------------------------ *
 *
 * `/Title` of the same `/Info` dictionary R10 chooses, decoded as a PDF text
 * string (ISO 32000-1 §7.9.2.2) from its raw bytes (R38): UTF-16BE after the
 * `FE FF` mark, otherwise PDFDocEncoding. A title it cannot decode is stated as
 * none, with the note `title_undecodable`; no character is replaced or guessed,
 * and nothing is invented from a file name or a heading. */

/** PDFDocEncoding's code points above 0x17 that are not Latin-1 (ISO 32000-1
 *  Annex D.2): 0x18-0x1F and 0x80-0xA0. Codes 0x7F, 0x9F and 0xAD are undefined. */
/** @type {Readonly<{ [code: number]: number }>} */
const PDFDOC_HIGH = Object.freeze({
  0x18: 0x02d8, 0x19: 0x02c7, 0x1a: 0x02c6, 0x1b: 0x02d9, 0x1c: 0x02dd, 0x1d: 0x02db, 0x1e: 0x02da, 0x1f: 0x02dc,
  0x80: 0x2022, 0x81: 0x2020, 0x82: 0x2021, 0x83: 0x2026, 0x84: 0x2014, 0x85: 0x2013, 0x86: 0x0192, 0x87: 0x2044,
  0x88: 0x2039, 0x89: 0x203a, 0x8a: 0x2212, 0x8b: 0x2030, 0x8c: 0x201e, 0x8d: 0x201c, 0x8e: 0x201d, 0x8f: 0x2018,
  0x90: 0x2019, 0x91: 0x201a, 0x92: 0x2122, 0x93: 0xfb01, 0x94: 0xfb02, 0x95: 0x0141, 0x96: 0x0152, 0x97: 0x0160,
  0x98: 0x0178, 0x99: 0x017d, 0x9a: 0x0131, 0x9b: 0x0142, 0x9c: 0x0153, 0x9d: 0x0161, 0x9e: 0x017e, 0xa0: 0x20ac,
});

/** A PDF text string's characters from its raw bytes, or null when they cannot
 *  be read exactly: an odd-length or unpaired-surrogate UTF-16BE string, a
 *  language-tag escape left open, or a byte PDFDocEncoding leaves undefined. */
/** @param {Uint8Array} raw
 *  @returns {string | null} */
function decodePdfTextStrict(raw) {
  if (raw[0] === 0xfe && raw[1] === 0xff) {
    if (raw.length % 2) return null;
    /** @type {number[]} */
    const units = [];
    for (let i = 2; i < raw.length; i += 2) units.push((byteAt(raw, i) << 8) | byteAt(raw, i + 1));
    let out = "";
    for (let i = 0; i < units.length; i++) {
      const u = byteAt(units, i);
      if (u === 0x1b) { // language tag: ESC, code, ESC
        const close = units.indexOf(0x1b, i + 1);
        if (close === -1) return null;
        i = close;
      } else if (u >= 0xd800 && u <= 0xdbff) {
        const lo = byteAt(units, i + 1);
        if (!(lo >= 0xdc00 && lo <= 0xdfff)) return null;
        out += String.fromCharCode(u, lo); i++;
      } else if (u >= 0xdc00 && u <= 0xdfff) {
        return null;
      } else out += String.fromCharCode(u);
    }
    return out;
  }
  let out = "";
  for (const b of raw) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b < 0x7f) || (b >= 0xa1 && b <= 0xff && b !== 0xad)) {
      out += String.fromCharCode(b);
    } else if (b in PDFDOC_HIGH) {
      out += String.fromCharCode(PDFDOC_HIGH[b] ?? NaN);
    } else return null;
  }
  return out;
}

/** R39's `metadata` for an opened document: `null` when no `/Info` can be read
 *  (none, dangling, or an encrypted document's undecoded strings). Notes
 *  `title_undecodable` on `doc` when the title cannot be decoded. Never throws. */
/** @param {PdfDoc} doc
 *  @returns {PdfMetadata | null} */
function extractMetadata(doc) {
  try {
    if (doc.isEncrypted()) return null;
    const info = doc.infoDict();
    if (!info) return null;
    /** @type {string | undefined} */
    let title;
    const t = asStr(doc.resolve(info.Title));
    if (t) {
      const text = decodePdfTextStrict(t.raw);
      if (text === null) doc.note("title_undecodable");
      else if (text.trim().length) title = text;
    }
    /* `title` first when there is one, then `source`: the keys in the order they were always written */
    if (title === undefined) return { source: "/Info" };
    return { title, source: "/Info" };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * C25 (R40) — THE TITLE ALONE, READ WITHOUT READING THE FILE
 * ------------------------------------------------------------------ *
 *
 * `extractPdfStructure` reads every page (355 ms for 33 pages, a second and
 * more for a 16 MB budget volume) and a caller that only wants the document's
 * name must not pay that. So `pdfTitle` opens nothing a page needs: it goes to
 * the end of the file for `startxref`, follows the cross-reference sections
 * (a table or a stream, `/Prev` and a hybrid `/XRefStm` included) to the three
 * objects it asks for, the `/Info` dictionary, the catalog and its `/Metadata`
 * stream, and reads each at its own offset: an object a few hundred bytes long,
 * or one object stream or XMP packet inflated to a stated bound. The cost is
 * the xref's, not the file's, which is what keeps it inside 100 ms at 16 MB.
 *
 * WHICH TITLE. `/Info /Title`, decoded exactly as R39 decodes it
 * (`decodePdfTextStrict`); when that is absent, blank or undecodable, the XMP
 * `dc:title` of the catalog's own `/Metadata` stream (`x-default`, else the
 * first language alternative), and nothing else: a logo's XMP inside the file
 * is not the document's, a heading is not a title, and a file name is the
 * caller's fallback, not this module's. The answer is uncleaned. An encrypted
 * file answers null (its strings are ciphertext, R9).
 *
 * A FILE WITH NO USABLE XREF IS NOT REFUSED, only read the way R8 reads it: the
 * last `trailer` (or the last cross-reference stream's own dictionary) names the
 * entries, and an object is the last `N G obj` in the file. Objects inside an
 * object stream are then reached only through a cross-reference stream's index,
 * because finding them without one would mean inflating every object stream,
 * which is the cost this exists to avoid; such a file answers null rather than
 * take the time. Nothing here throws: any failure is null.
 *
 * ZLIB IS INFLATED HERE, SYNCHRONOUSLY, because the answer is a value and not a
 * promise and the platform's `DecompressionStream` is asynchronous. The decoder
 * is RFC 1951 (puff's own structure), checks no Adler sum, and never writes
 * past `max`, so a stream that inflates to gigabytes is cut, not followed. */

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/** A canonical Huffman table from code lengths (RFC 1951 §3.2.2), or null when
 *  the lengths over-subscribe the code space. */
/** @typedef {{ count: Int32Array, symbol: Int32Array }} Huffman */
/** @param {number[]} lengths
 *  @returns {Huffman | null} */
function huffman(lengths) {
  const count = new Int32Array(16);
  for (const l of lengths) count[l] = byteAt(count, l) + 1;
  let left = 1;
  for (let len = 1; len <= 15; len++) {
    left = left * 2 - byteAt(count, len);
    if (left < 0) return null;
  }
  const offs = new Int32Array(16);
  for (let len = 1; len < 15; len++) offs[len + 1] = byteAt(offs, len) + byteAt(count, len);
  const symbol = new Int32Array(lengths.length);
  lengths.forEach((l, s) => { if (l) { const at = byteAt(offs, l); offs[l] = at + 1; symbol[at] = s; } });
  return { count, symbol };
}

/** @type {{ lit: Huffman | null, dist: Huffman | null } | null} */
let FIXED_TABLES = null;
/** @returns {{ lit: Huffman | null, dist: Huffman | null }} */
function fixedTables() {
  const made = FIXED_TABLES;
  if (made) return made;
  const l = Array.from({ length: 288 }, () => 8);
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  const d = Array.from({ length: 30 }, () => 5);
  const tables = { lit: huffman(l), dist: huffman(d) };
  FIXED_TABLES = tables;
  return tables;
}

/** zlib (RFC 1950) or raw deflate bytes to `{ data, full }` (`full` false when
 *  the output was cut at `max`), or null when the stream is not valid deflate.
 *  `expect`, when the decoded length is known, is the buffer made first, so the
 *  output is written once and never copied to grow; `count` keeps no output and
 *  answers only `len`, how long it is. `end` is where the stream's data ends
 *  (for zlib, where its checksum begins). */
/** @param {Uint8Array} src
 *  @param {number} max
 *  @param {number} [expect]
 *  @param {boolean} [count]
 *  @returns {{ data: Uint8Array | null, len: number, full: boolean, end: number } | null} */
function inflateSync(src, max, expect, count = false) {
  const zlibHead = src.length >= 2 && (byteAt(src, 0) & 0x0f) === 8 && ((byteAt(src, 0) << 8) | byteAt(src, 1)) % 31 === 0;
  let pos = zlibHead ? 2 : 0, bitBuf = 0, bitCnt = 0;
  /* `count`: no output is kept, only its length; a 64 KiB ring holds the last 32 KiB that a match can reach. */
  const M = count ? 0xffff : -1;
  let out = new Uint8Array(count ? 65536 : Math.min(max, expect !== undefined && Number.isInteger(expect) && expect >= 0 ? expect : Math.max(1024, src.length * 4))), o = 0;
  const STOP = { stop: true };
  /** @param {number} n
   *  @returns {number} */
  const bits = (n) => {
    while (bitCnt < n) {
      if (pos >= src.length) throw new Error("eof");
      bitBuf |= (src[pos++] ?? NaN) << bitCnt; bitCnt += 8;
    }
    const v = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n; bitCnt -= n;
    return v;
  };
  /** @param {Huffman | null | undefined} h
   *  @returns {number} */
  const decode = (h) => {
    if (!h) throw new Error("tables"); // a table that did not build: as reading its counts would throw
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const c = h.count[len] ?? NaN;
      if (code - c < first) return h.symbol[index + (code - first)] ?? NaN;
      index += c; first = (first + c) << 1; code <<= 1;
    }
    throw new Error("bad code");
  };
  /** @param {number} n */
  const room = (n) => {
    if (count) { if (o + n > max) throw STOP; return; }
    if (o + n <= out.length) return;
    if (o + n > max) { if (o < max) { /* fill to the bound */ } throw STOP; }
    let size = out.length;
    while (size < o + n) size *= 2;
    const bigger = new Uint8Array(Math.min(size, max));
    bigger.set(out.subarray(0, o));
    out = bigger;
  };
  try {
    for (let last = 0; !last;) {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        if (pos + 4 > src.length) throw new Error("eof");
        const len = byteAt(src, pos) | (byteAt(src, pos + 1) << 8);
        if ((len ^ 0xffff) !== (byteAt(src, pos + 2) | (byteAt(src, pos + 3) << 8))) throw new Error("stored length");
        pos += 4;
        if (pos + len > src.length) throw new Error("eof");
        const take = Math.min(len, max - o);
        room(take);
        if (count) for (let i = 0; i < take; i++) out[(o + i) & M] = src[pos + i] ?? NaN;
        else out.set(src.subarray(pos, pos + take), o);
        o += take; pos += len;
        if (take < len) throw STOP;
        continue;
      }
      if (type === 3) throw new Error("block type");
      /** @type {Huffman | null} */
      let lit;
      /** @type {Huffman | null} */
      let dist;
      if (type === 1) ({ lit, dist } = fixedTables());
      else {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        if (nlen > 286 || ndist > 30) throw new Error("counts");
        const cl = Array.from({ length: 19 }, () => 0);
        for (let i = 0; i < ncode; i++) cl[byteAt(CODE_LENGTH_ORDER, i)] = bits(3);
        const clh = huffman(cl);
        if (!clh) throw new Error("code lengths");
        /** @type {number[]} */
        const lens = [];
        while (lens.length < nlen + ndist) {
          const sym = decode(clh);
          if (sym < 16) lens.push(sym);
          else {
            let rep = 0, val = 0;
            if (sym === 16) { if (!lens.length) throw new Error("repeat"); val = byteAt(lens, lens.length - 1); rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            if (lens.length + rep > nlen + ndist) throw new Error("repeat");
            for (let i = 0; i < rep; i++) lens.push(val);
          }
        }
        if (lens[256] === 0) throw new Error("no end of block");
        lit = huffman(lens.slice(0, nlen)); dist = huffman(lens.slice(nlen));
        if (!lit || !dist) throw new Error("tables");
      }
      for (;;) {
        const sym = decode(lit);
        if (sym < 256) { room(1); out[o++ & M] = sym; continue; }
        if (sym === 256) break;
        const li = sym - 257;
        if (li >= 29) throw new Error("length symbol");
        const len = byteAt(LEN_BASE, li) + bits(byteAt(LEN_EXTRA, li));
        const ds = decode(dist);
        if (ds >= 30) throw new Error("distance symbol");
        const d = byteAt(DIST_BASE, ds) + bits(byteAt(DIST_EXTRA, ds));
        if (d > o) throw new Error("distance");
        const take = Math.min(len, max - o);
        room(take);
        for (let i = 0; i < take; i++, o++) out[o & M] = out[(o - d) & M] ?? NaN;
        if (take < len) throw STOP;
      }
    }
  } catch (e) {
    if (e === STOP) return { data: count ? null : out.subarray(0, o), len: o, full: false, end: pos };
    return null;
  }
  return { data: count ? null : out.subarray(0, o), len: o, full: true, end: pos };
}

/** A zlib stream (RFC 1950) inflated and PROVED: the output is made once at its exact size (a first pass counts it
 *  without keeping it, unless `expect` already says), and is returned only when the stream ends where its checksum
 *  begins and the checksum is the output's. That is every stream the platform's decoder reads without recovery, and
 *  for those it is the same bytes (a correct decode with a matching Adler-32 is the one decode); null for anything
 *  else (no zlib header, a preset dictionary, trailing bytes, a wrong or missing sum, damage, `max` outgrown), which
 *  the caller gives to the platform's decoder and its recoveries. Large decodes made this way are held once, not
 *  three times over as the stream machinery holds them (R41). */
/** @param {Uint8Array} src
 *  @param {number} max
 *  @param {number} [expect]
 *  @returns {Uint8Array | null} */
function inflateChecked(src, max, expect) {
  const r = inflateProved(src, max, expect);
  return r && "data" in r ? r.data : null;
}

/** `inflateChecked` that says why it did not answer: `{ data }`, `{ over }` (the output passed `max`; the bytes counted when it
 *  stopped), or null (not a stream it can prove). */
/** @param {Uint8Array} src
 *  @param {number} max
 *  @param {number} [expect]
 *  @returns {{ data: Uint8Array } | { over: number } | null} */
function inflateProved(src, max, expect) {
  if (!(src.length >= 6 && (byteAt(src, 0) & 0x0f) === 8 && ((byteAt(src, 0) << 8) | byteAt(src, 1)) % 31 === 0 && !(byteAt(src, 1) & 0x20))) return null;
  let len = expect;
  if (expect === undefined || !Number.isInteger(expect) || expect < 0) {
    const c = inflateSync(src, max, undefined, true);
    if (!c) return null;
    if (!c.full) return { over: c.len };
    len = c.len;
  }
  const r = inflateSync(src, max, len);
  if (!r) return null;
  if (!r.full) return { over: r.len };
  const data = r.data;
  if (!data || data.length !== len || r.end + 4 !== src.length) return null;
  const want = ((byteAt(src, r.end) << 24) | (byteAt(src, r.end + 1) << 16) | (byteAt(src, r.end + 2) << 8) | byteAt(src, r.end + 3)) >>> 0;
  if (adler32(data) !== want) return null;
  return { data };
}

const OBJ_WINDOW = 4096;               // the first look at an object; grown only while its dictionary is unfinished
const OBJ_WINDOW_MAX = DIRECT_OBJECT_MAX; // an object's dictionary is never read past this (R47)
const STREAM_MAX = STREAM_CAPS.object_stream; // a cross-reference or object stream, inflated, is never larger (R22)
const XMP_MAX = boundOf("pdf", "xmp");     // nor is an XMP packet read past this (R48)
const XREF_CHAIN_MAX = 64;

/** The first index of ASCII `needle` in `b` at or after `from`, hopping on its first byte; -1 for none.
 *  @param {Uint8Array} b
 *  @param {string} needle
 *  @param {number} [from]
 *  @returns {number} */
function firstAscii(b, needle, from = 0) {
  const c0 = needle.charCodeAt(0);
  for (let i = b.indexOf(c0, from); i !== -1; i = b.indexOf(c0, i + 1)) {
    let k = 1;
    while (k < needle.length && b[i + k] === needle.charCodeAt(k)) k++;
    if (k === needle.length) return i;
  }
  return -1;
}
/** The last index of ASCII `needle` in `b` starting at or before `from`; -1 for none.
 *  @param {Uint8Array} b
 *  @param {string} needle
 *  @param {number} [from]
 *  @returns {number} */
function lastAscii(b, needle, from = b.length - needle.length) {
  const c0 = needle.charCodeAt(0);
  for (let i = from < 0 ? -1 : b.lastIndexOf(c0, from); i !== -1; i = i > 0 ? b.lastIndexOf(c0, i - 1) : -1) {
    let k = 1;
    while (k < needle.length && b[i + k] === needle.charCodeAt(k)) k++;
    if (k === needle.length) return i;
  }
  return -1;
}
/** @param {Uint8Array} b
 *  @param {number} p
 *  @returns {number} */
const skipWsBytes = (b, p) => { while (p < b.length && isWhitespace(b[p])) p++; return p; };
/** @param {Uint8Array} b
 *  @param {number} p
 *  @param {string} s
 *  @returns {boolean} */
const startsAscii = (b, p, s) => { for (let k = 0; k < s.length; k++) if (b[p + k] !== s.charCodeAt(k)) return false; return true; };

/** A cross-reference entry: free (0), at an offset of the file (1), or the `idx`th object of object stream `stm` (2).
 *  @typedef {{ type: 0 } | { type: 1, off: number } | { type: 2, stm: number, idx: number }} XrefEntry */
/** One cross-reference section: its trailer, the links it states, its entry for an object, and (when it can list them)
 *  every entry.
 *  @typedef {{ trailer: PdfMap, prev: number | null, xrefStm: number | null, find: (n: number) => XrefEntry | null,
 *    each?: (fn: (n: number, e: XrefEntry) => void) => void }} XrefSection */

/** Two entries alike in kind, offset, stream and index (a member an entry of its kind does not have reads as undefined).
 *  @param {XrefEntry | null} a
 *  @param {XrefEntry | null} b
 *  @returns {boolean} */
const sameEntry = (a, b) => !!a && !!b && a.type === b.type && entryOff(a) === entryOff(b) && entryStm(a) === entryStm(b) && entryIdx(a) === entryIdx(b);
/** @param {XrefEntry} e
 *  @returns {number | undefined} */
const entryOff = (e) => (e.type === 1 ? e.off : undefined);
/** @param {XrefEntry} e
 *  @returns {number | undefined} */
const entryStm = (e) => (e.type === 2 ? e.stm : undefined);
/** @param {XrefEntry} e
 *  @returns {number | undefined} */
const entryIdx = (e) => (e.type === 2 ? e.idx : undefined);

/** The value of a number a regular expression matched, or NaN when the group did not take part (as `Number(undefined)`).
 *  @param {string | undefined} g
 *  @returns {number} */
const groupNumber = (g) => Number(g);

/** A cross-reference stream's `/W`: three whole numbers 0 to 8, or null when the entries are not that.
 *  @param {PdfValue[]} items
 *  @returns {[number, number, number] | null} */
function xrefWidths(items) {
  const [a, b, c] = items;
  const ok = (/** @type {PdfValue | undefined} */ x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 8;
  if (!items.every((x) => ok(x)) || typeof a !== "number" || typeof b !== "number" || typeof c !== "number") return null;
  return [a, b, c];
}

/** One file read through its cross-reference sections. See the block above. */
class XrefReader {
  /** @param {Uint8Array} bytes */
  constructor(bytes) {
    /** @type {Uint8Array} */
    this.b = bytes;
    /** @type {Map<number, PdfValue>} */
    this.objs = emptyMap();
    /** @type {Map<number, { inner: string | null, pairs: number[], first: number }>} */
    this.packs = emptyMap();
    /** @type {Set<number>} */
    this.busy = emptySet();
    /** @type {XrefSection[] | null} */
    this._secs = null;
    /** @type {boolean | undefined} set by `sections()`: the chain ended at a section with no /Prev, every link read (R8 (a)) */
    this.complete; // eslint-disable-line no-unused-expressions
  }

  /** The offset `startxref` states, or null.
   *  @returns {number | null} */
  startxref() {
    const b = this.b;
    const s = binaryString(b.subarray(Math.max(0, b.length - 2048)));
    const i = s.lastIndexOf("startxref");
    const m = i < 0 ? null : /^startxref\s+(\d+)/.exec(s.slice(i, i + 40));
    const off = m ? groupNumber(m[1]) : null;
    return off != null && off < b.length ? off : null;
  }

  /** Every cross-reference section, newest first: `{ trailer, prev, xrefStm, find(n) }`.
   *  @returns {XrefSection[]} */
  sections() {
    const had = this._secs;
    if (had) return had;
    /** @type {XrefSection[]} */
    const secs = [];
    this._secs = secs;
    /** @type {Set<number>} */
    const seen = emptySet();
    let off = this.startxref();
    /* `complete`: the chain from `startxref` ended at a section with no /Prev, every link read (R8 (a)) */
    this.complete = false;
    /** @param {number} at
     *  @returns {XrefSection | null} */
    const tryRead = (at) => { try { return this.readSection(at); } catch { return null; } };
    for (;;) {
      const at = off;
      if (at == null || secs.length >= XREF_CHAIN_MAX || seen.has(at)) break;
      seen.add(at);
      const sec = tryRead(at);
      if (!sec) break;
      secs.push(sec);
      const xs = sec.xrefStm;
      if (xs !== null && Number.isInteger(xs) && !seen.has(xs)) {
        seen.add(xs);
        const hy = tryRead(xs);
        if (hy) secs.push(hy);
      }
      off = Number.isInteger(sec.prev) ? sec.prev : null;
      if (off == null) this.complete = true;
    }
    if (!secs.some((s) => s.trailer.Root)) this.lenient(secs);
    return secs;
  }

  /** `fn(n, entry, i)` for every entry of every section, newest section (index 0) first.
   *  @param {(n: number, e: XrefEntry, i: number) => void} fn */
  eachEntry(fn) {
    this.sections().forEach((sec, i) => { if (sec.each) sec.each((n, e) => fn(n, e, i)); });
  }

  /** No usable xref: the last `trailer`, and the last cross-reference stream's own dictionary.
   *  @param {XrefSection[]} secs */
  lenient(secs) {
    const b = this.b;
    const t = lastAscii(b, "trailer");
    if (t >= 0) {
      const r = parseValueSafe(binaryString(b.subarray(t + 7, t + 7 + OBJ_WINDOW)), 0);
      const d = r ? asDict(r.value) : null;
      if (d) secs.push({ trailer: d.map, prev: null, xrefStm: null, find: () => null });
    }
    const x = lastAscii(b, "/XRef");
    if (x >= 0) {
      const start = this.objectStartBefore(x);
      const sec = (() => { try { return start == null ? null : this.readXrefStream(start); } catch { return null; } })();
      if (sec) secs.push(sec);
    }
  }

  /** The offset of the `N G obj` that opens the object holding position `pos`, or null.
   *  @param {number} pos
   *  @returns {number | null} */
  objectStartBefore(pos) {
    const b = this.b;
    for (let at = lastAscii(b, "obj", pos); at >= 0 && at > pos - 8192; at = lastAscii(b, "obj", at - 1)) {
      const s = binaryString(b.subarray(Math.max(0, at - 24), at + 3));
      const m = /(\d+)\s+(\d+)\s+obj$/.exec(s);
      if (m && b[at - 1] !== 0x64 /* d: endobj */) return at + 3 - m[0].length;
    }
    return null;
  }

  /** @param {number} off
   *  @returns {XrefSection | null} */
  readSection(off) {
    const p = skipWsBytes(this.b, off);
    if (startsAscii(this.b, p, "xref")) return this.readTable(p);
    return this.readXrefStream(p);
  }

  /** A classic table: its subsections by header, entries 20 bytes each, then the trailer.
   *  @param {number} p
   *  @returns {XrefSection | null} */
  readTable(p) {
    const b = this.b;
    /** @type {{ start: number, count: number, at: number }[]} */
    const subs = [];
    p = skipWsBytes(b, p + 4);
    for (let guard = 0; guard < 100000; guard++) {
      const m = /^(\d+)\s+(\d+)[ \t]*(?:\r\n|\r|\n)?/.exec(binaryString(b.subarray(p, p + 48)));
      if (!m) break;
      const start = groupNumber(m[1]), count = groupNumber(m[2]);
      const at = p + m[0].length;
      if (count > (b.length - at) / 19) return null;
      subs.push({ start, count, at });
      p = skipWsBytes(b, at + count * 20);
    }
    if (!startsAscii(b, p, "trailer")) {
      const t = firstAscii(b, "trailer", p);
      if (t < 0 || t - p > 64) return null;
      p = t;
    }
    const r = parseValueSafe(binaryString(b.subarray(p + 7, p + 7 + OBJ_WINDOW)), 0);
    const td = r ? asDict(r.value) : null;
    if (!td) return null;
    const trailer = td.map;
    /** @param {number} n
     *  @returns {XrefEntry | null} */
    const entry = (n) => {
      for (const s of subs) {
        if (n < s.start || n >= s.start + s.count) continue;
        const e = /^(\d{10}) (\d{5}) ([nf])/.exec(binaryString(b.subarray(s.at + (n - s.start) * 20, s.at + (n - s.start) * 20 + 20)));
        if (!e) return null;
        /* an in-use entry at offset 0 is a free slot written carelessly: nothing opens there but the header */
        return e[3] === "n" && groupNumber(e[1]) > 0 ? { type: 1, off: groupNumber(e[1]) } : { type: 0 };
      }
      return null;
    };
    /** @param {(n: number, e: XrefEntry) => void} fn */
    const each = (fn) => {
      for (const sub of subs) {
        for (let i = 0; i < sub.count; i++) {
          const e = /^(\d{10}) (\d{5}) ([nf])/.exec(binaryString(b.subarray(sub.at + i * 20, sub.at + i * 20 + 20)));
          if (e) fn(sub.start + i, e[3] === "n" && groupNumber(e[1]) > 0 ? { type: 1, off: groupNumber(e[1]) } : { type: 0 });
        }
      }
    };
    const prev = trailer.Prev, xrefStm = trailer.XRefStm;
    return { trailer, prev: typeof prev === "number" ? prev : null,
      xrefStm: typeof xrefStm === "number" ? xrefStm : null, find: entry, each };
  }

  /** A cross-reference stream: its dictionary is the trailer, its rows the entries.
   *  @param {number} p
   *  @returns {XrefSection | null} */
  readXrefStream(p) {
    const o = this.parseAt(p, null);
    const so = o ? asStream(o.value) : null;
    if (!o || !so) return null;
    const dict = so.dict;
    const type = asName(dict.Type);
    if (!type || type.v !== "XRef") return null;
    const w = asArr(this.deref(dict.W));
    if (!w || w.items.length !== 3) return null;
    const widths = xrefWidths(w.items);
    if (!widths) return null;
    const cols = widths[0] + widths[1] + widths[2];
    if (!cols) return null;
    const size = this.num(dict.Size);
    const idx = asArr(this.deref(dict.Index));
    /** @type {[number, number][]} */
    const ranges = [];
    if (idx) {
      for (let i = 0; i + 1 < idx.items.length; i += 2) {
        const first = idx.items[i], n = idx.items[i + 1];
        if (typeof first !== "number" || !Number.isInteger(first) || typeof n !== "number" || !Number.isInteger(n) || n < 0) return null;
        ranges.push([first, n]);
      }
    } else if (size !== null && Number.isInteger(size)) ranges.push([0, size]);
    else return null;
    const got = this.streamData(so, STREAM_MAX);
    if (!got || !got.full) return null;
    const data = got.data;
    /** @param {number} at
     *  @param {number} n
     *  @returns {number} */
    const field = (at, n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + byteAt(data, at + k); return v; };
    /** @param {number} n
     *  @returns {XrefEntry | null} */
    const entry = (n) => {
      let row = 0;
      for (const [start, count] of ranges) {
        if (n >= start && n < start + count) {
          const at = (row + (n - start)) * cols;
          if (at + cols > data.length) return null;
          const t = widths[0] ? field(at, widths[0]) : 1;
          const a = field(at + widths[0], widths[1]), c = field(at + widths[0] + widths[1], widths[2]);
          return t === 1 && a > 0 ? { type: 1, off: a } : t === 2 ? { type: 2, stm: a, idx: c } : { type: 0 };
        }
        row += count;
      }
      return null;
    };
    /** @param {(n: number, e: XrefEntry) => void} fn */
    const each = (fn) => {
      let row = 0;
      for (const [start, count] of ranges) {
        for (let i = 0; i < count; i++, row++) {
          const at = row * cols;
          if (at + cols > data.length) return;
          const t = widths[0] ? field(at, widths[0]) : 1;
          const a = field(at + widths[0], widths[1]), c = field(at + widths[0] + widths[1], widths[2]);
          fn(start + i, t === 1 && a > 0 ? { type: 1, off: a } : t === 2 ? { type: 2, stm: a, idx: c } : { type: 0 });
        }
      }
    };
    return { trailer: dict, prev: this.num(dict.Prev) ?? null, xrefStm: null, find: entry, each };
  }

  /** The newest section's entry for object `n`, or null when no section names it.
   *  @param {number} n
   *  @returns {XrefEntry | null} */
  lookup(n) {
    for (const sec of this.sections()) {
      const e = sec.find(n);
      if (e) return e;
    }
    return null;
  }

  /** The object at `off` (which must open `N G obj`, N being `n` when given): `{ num, value }`, a stream's `start` absolute.
   *  @param {number} off
   *  @param {number | null} n
   *  @returns {{ num: number, value: PdfValue } | null} */
  parseAt(off, n) {
    const b = this.b;
    if (!Number.isInteger(off) || off < 0 || off >= b.length) return null;
    for (let size = OBJ_WINDOW; ; size *= 8) {
      const end = Math.min(b.length, off + size);
      const s = binaryString(b.subarray(off, end));
      const m = /^\s*(\d+)\s+(\d+)\s+obj\b/.exec(s);
      if (!m || (n != null && groupNumber(m[1]) !== n)) return null;
      const r = parseValueSafe(s, m[0].length);
      const rv = r ? r.value : null;
      if (!r || !rv) return null;
      if (r.pos >= s.length && end < b.length && size < OBJ_WINDOW_MAX) continue; // the dictionary ran past the window
      const st = asStream(rv);
      /** @type {PdfValue} */
      const value = st ? { ...st, start: off + st.start } : rv;
      return { num: groupNumber(m[1]), value };
    }
  }

  /** The last top-level `N G obj` of object `n` anywhere in the file (a later definition wins), or null.
   *  @param {number} n
   *  @returns {PdfValue} */
  scanTop(n) {
    const b = this.b;
    for (let j = b.lastIndexOf(0x6a); j >= 2; j = j > 0 ? b.lastIndexOf(0x6a, j - 1) : -1) {
      if (b[j - 1] !== 0x62 || b[j - 2] !== 0x6f) continue; // "obj"
      const s = binaryString(b.subarray(Math.max(0, j - 30), j + 1));
      const m = /(?:^|\s)(\d+)\s+(\d+)\s+obj$/.exec(s);
      if (!m || groupNumber(m[1]) !== n) continue;
      const at = j + 1 - (m[0].length - (/^\s/.test(m[0]) ? 1 : 0));
      const o = this.parseAt(at, n);
      if (o) return o.value;
    }
    return null;
  }

  /** Object `n`'s value through the xref, falling to a scan for one the xref cannot place; null for none.
   *  @param {number} n
   *  @returns {PdfValue | undefined} */
  get(n) {
    if (!Number.isInteger(n)) return null;
    if (this.objs.has(n)) return this.objs.get(n);
    if (this.busy.has(n)) return null;
    this.busy.add(n);
    /** @type {PdfValue} */
    let v = null;
    try {
      const e = this.lookup(n);
      if (e && e.type === 1) v = this.parseAt(e.off, n)?.value ?? this.scanTop(n);
      else if (e && e.type === 2) v = this.packed(e.stm, e.idx, n);
      else if (!e) v = this.scanTop(n);
    } catch { v = null; }
    this.busy.delete(n);
    this.objs.set(n, v);
    return v;
  }

  /** Object `n` out of object stream `stm`.
   *  @param {number} stm
   *  @param {number} idx
   *  @param {number} n
   *  @returns {PdfValue} */
  packed(stm, idx, n) {
    const had = this.packs.get(stm);
    /** @type {{ inner: string | null, pairs: number[], first: number }} */
    let pack;
    if (had) pack = had;
    else {
      pack = { inner: null, pairs: [], first: 0 };
      const so = asStream(this.get(stm));
      const got = so ? this.streamData(so, STREAM_MAX) : null;
      const first = so ? this.num(so.dict.First) : null;
      const count = so ? this.num(so.dict.N) : null;
      if (got && first !== null && Number.isInteger(first) && count !== null && Number.isInteger(count) && first >= 0 && count >= 0 && count <= 1e6) {
        const inner = binaryString(got.data);
        const nums = inner.slice(0, first).trim().split(/\s+/).map(Number);
        pack = { inner, first, pairs: nums };
      }
      this.packs.set(stm, pack);
    }
    const inner = pack.inner;
    if (inner == null) return null;
    let at = -1;
    if (pack.pairs[idx * 2] === n) at = idx * 2;
    else for (let i = 0; i + 1 < pack.pairs.length; i += 2) if (pack.pairs[i] === n) { at = i; break; }
    const off = pack.pairs[at + 1];
    if (at < 0 || off === undefined || !Number.isFinite(off)) return null;
    const r = parseValueSafe(inner, pack.first + off);
    return r ? r.value : null;
  }

  /** `v` with indirect references followed (64 hops), or null.
   *  @param {PdfValue | undefined} v
   *  @returns {PdfValue} */
  deref(v) {
    let cur = v;
    for (let hops = 0; ; hops++) {
      const r = asRef(cur);
      if (!r) break;
      if (hops >= 64) return null;
      cur = this.get(r.n);
    }
    return cur ?? null;
  }
  /** @param {PdfValue | undefined} v
   *  @returns {PdfMap | null} */
  dict(v) {
    return mapOf(this.deref(v));
  }
  /** @param {PdfValue | undefined} v
   *  @returns {number | null} */
  num(v) {
    const d = this.deref(v);
    return typeof d === "number" ? d : null;
  }

  /** A stream's raw bytes: by `/Length` when `endstream` follows it, else up to the next `endstream`.
   *  @param {PdfStream} st
   *  @returns {Uint8Array | null} */
  rawStream(st) {
    const b = this.b, start = st.start;
    if (!Number.isInteger(start) || start < 0 || start > b.length) return null;
    const len = this.num(st.dict.Length);
    if (len !== null && Number.isInteger(len) && len >= 0 && start + len <= b.length && startsAscii(b, skipWsBytes(b, start + len), "endstream")) {
      return b.subarray(start, start + len);
    }
    const e = firstAscii(b, "endstream", start);
    if (e < 0) return null;
    let end = e;
    if (b[end - 1] === 0x0a) end--;
    if (b[end - 1] === 0x0d) end--;
    return b.subarray(start, Math.max(start, end));
  }

  /** A stream's decoded bytes `{ data, full }` (Flate only, PNG-predicted as `/DecodeParms` says), cut at `max`; null otherwise.
   *  @param {PdfStream} st
   *  @param {number} max
   *  @returns {{ data: Uint8Array, full: boolean } | null} */
  streamData(st, max) {
    const raw = this.rawStream(st);
    if (!raw) return null;
    const f = this.deref(st.dict.Filter);
    const fn = asName(f), fa = asArr(f);
    const names = f == null ? [] : fn ? [fn.v] :
      fa ? fa.items.map((x) => { const d = asName(this.deref(x)); return d ? d.v : null; }) : [null];
    const un = undoAscii(names, raw);
    if (!un || !un.rest.every(isFlateName)) return null;
    let data = un.data, full = true;
    if (!names.length && raw.length > max) { data = raw.subarray(0, max); full = false; }
    for (let i = 0; i < un.rest.length; i++) {
      const r = inflateSync(data, max);
      const rd = r ? r.data : null;
      if (!r || !rd) return null;
      data = rd; full = full && r.full;
    }
    let parms = this.deref(st.dict.DecodeParms) || this.deref(st.dict.DP);
    const pa = asArr(parms);
    if (pa) parms = this.deref(pa.items[pa.items.length - 1]);
    const pd = asDict(parms);
    if (pd) {
      const predictor = this.num(pd.map.Predictor);
      if (predictor === 2) return null;
      if (predictor && predictor >= 2) {
        data = unpredict(data, { predictor, colors: this.num(pd.map.Colors) ?? 1, columns: this.num(pd.map.Columns) ?? 1,
          bpc: this.num(pd.map.BitsPerComponent) ?? 8 });
      }
    }
    return { data, full };
  }

  /** The first trailer entry named `key` in section order (newest first), or undefined.
   *  @param {string} key
   *  @returns {PdfValue | undefined} */
  trailerValue(key) {
    for (const sec of this.sections()) if (sec.trailer[key] !== undefined) return sec.trailer[key];
    return undefined;
  }
}

/** @type {{ [name: string]: string }} */
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** XML text with its character references decoded, or null when one is not a character.
 *  @param {string} raw
 *  @returns {string | null} */
function xmlText(raw) {
  const found = { bad: false }; // set by the replacer, read once it is done
  const out = raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (/** @type {string} */ all, /** @type {string} */ ref) => {
    /** @type {number} */
    let cp;
    const entity = XML_ENTITIES[ref];
    if (ref[0] === "#") cp = ref[1] === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    else if (ref in XML_ENTITIES && entity !== undefined) return entity;
    else { found.bad = true; return ""; }
    if (!(cp >= 0x20 || cp === 0x09 || cp === 0x0a || cp === 0x0d) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) { found.bad = true; return ""; }
    return String.fromCodePoint(cp);
  });
  return found.bad ? null : out;
}

/** The `dc:title` an XMP packet states: its `x-default` alternative, else its first.
 *  @param {Uint8Array} packetBytes
 *  @returns {string | null} */
function xmpTitle(packetBytes) {
  /** @type {string} */
  let text;
  try {
    const bom = packetBytes[0] === 0xfe && packetBytes[1] === 0xff ? "utf-16be" : packetBytes[0] === 0xff && packetBytes[1] === 0xfe ? "utf-16le" : "utf-8";
    text = new TextDecoder(bom, { fatal: true }).decode(packetBytes);
  } catch { return null; }
  const ns = /xmlns:([A-Za-z_][\w.-]*)\s*=\s*["']http:\/\/purl\.org\/dc\/elements\/1\.1\/["']/.exec(text);
  const p = ns ? ns[1] : "dc";
  const block = new RegExp(`<${p}:title(?:\\s[^>]*)?>([\\s\\S]*?)</${p}:title\\s*>`).exec(text);
  if (!block) return null;
  /** @type {string | null} */
  let first = null;
  for (const li of (block[1] ?? "").matchAll(/<[\w.-]+:li\b([^>]*)>([\s\S]*?)<\/[\w.-]+:li\s*>/g)) {
    const attrs = li[1] ?? "";
    if (attrs.trim().endsWith("/")) continue;
    const inner = (li[2] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (/** @type {string} */ _, /** @type {string} */ c) => c.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
    if (/</.test(inner)) continue;
    const t = xmlText(inner);
    if (t == null || !t.trim().length) continue;
    if (/xml:lang\s*=\s*["']x-default["']/.test(attrs)) return t;
    if (first == null) first = t;
  }
  return first;
}

/** R40: the document's title, from its Info `Title` and, failing that, the catalog's XMP `dc:title`; null for none.
 *  Reads no page, and never throws. See the block above.
 *  @param {unknown} bytes
 *  @returns {string | null} */
export function pdfTitle(bytes) {
  try {
    if (!(bytes instanceof Uint8Array)) return null;
    if (!/%PDF-\d+\.\d+/.test(binaryString(bytes.subarray(0, 1024)))) return null;
    const f = new XrefReader(bytes);
    if (f.trailerValue("Encrypt") !== undefined) return null;
    /* R10's choice: the newest trailer's /Info, an earlier one when it dangles. */
    for (const sec of f.sections()) {
      const ref = asRef(sec.trailer.Info);
      const info = ref ? f.dict(ref) : null;
      if (!info) continue;
      const t = asStr(f.deref(info.Title));
      if (t) {
        const text = decodePdfTextStrict(t.raw);
        if (text !== null && text.trim().length) return text;
      }
      break;
    }
    const root = f.dict(f.trailerValue("Root"));
    const meta = asStream(root ? f.deref(root.Metadata) : null);
    if (!meta) return null;
    const got = f.streamData(meta, XMP_MAX);
    return got ? xmpTitle(got.data) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * The public entry point
 * ------------------------------------------------------------------ */

/**
 * Extract the outbound-link structure of a PDF.
 *
 * @param {Uint8Array} bytes  assembled PDF bytes (I1: read via op=capture)
 * @returns {Promise<object>} the container-agnostic structure object; see the
 *          module header and the returned `container`/`links` shape. Carries a
 *          `text` field (Tier 1, CPDF-4): { document, pages:[{page,text,
 *          undetermined:[…]}], undetermined:[…], counts:{chars,undetermined},
 *          producer:{…} }, where each undetermined marker names the cause (the
 *          font) rather than guessing an undecodable run into text. This is the
 *          producer side of the proposed I2 (structure -> framework).
 *
 *          `text.producer` (D-251, IC-58) is WHO MADE THE TEXT LAYER, read from
 *          the trailer's /Info: `{producer, creator, determination:"ocr"|
 *          "undetermined", ocr:{engine,field,marker}|null, why}`. There is no
 *          "authored" determination and there must never be one — see the D-251
 *          block above.
 */
/* R42 (fix round 4b, F10; K4498) — A DOCUMENT TOO LARGE TO READ IS REFUSED BEFORE ITS TEXT, NOT LOST TO A CRASH.
 *
 * The object that reads a document has 128 MB, and R41 bounded the working set of one page but not what the answer and
 * the tables grow with: the pages. Bytes alone cannot say what a reading will need (a 12 MB file of text pages is 3,000
 * pages and past the limit; a 20 MB file of a thousand scanned pages is not), and the pages are known only once the file
 * is opened, so the check is here, after R8's read and before the first page's text. A reading that would take the
 * object past READ_LIMIT_MB is answered `ok: false` with `failure: "final"` and the pages it has, and is never started:
 * the alternative is the object reset at the same page every time, which a ledger then retries without end.
 *
 * THE RULE, in MB: an idle isolate (READ_BASE_MB), the file's own bytes held beside, and a share of the answer and the
 * tables for each page, READ_PAGE_MB for a page that shows text and READ_BARE_PAGE_MB for one that does not. MEASURED
 * (build/jobs/T51/pdf-reader.md), under workerd, as the smallest V8 old space in which `reading-pipeline`'s `read` of a
 * file completes, plus the file's bytes. Text pages of 120 lines, 1,000 / 2,000 / 3,500 of them: 66 / 98 / 152 MB (the
 * rule: 61 / 97 / 150). The govinfo volumes of 188 / 295 / 1,354 pages: 35 / 50 / 98 (the rule: 33 / 43 / 82). What it
 * does not follow, stated: pages of more text than 120 lines cost more (1,500 pages of 200 lines: 114, the rule 83), and
 * pages of less cost less (3,500 pages of 40 lines: 68, the rule 140). The limit leaves the plane's own baseline and
 * that error inside the 128.
 *
 * WHICH PAGES SHOW TEXT is known only by looking, and a scanned packet of three thousand pages under 24 MiB (an image a
 * page, no text) costs a small part of what the same pages of text do, so it is looked at only when the rule with every
 * page counted as text is over the limit: a sample of READ_SAMPLE_PAGES pages, evenly spaced, is asked the one question
 * OCR's renderer asks (`pageShowsText`), and a page that cannot be told counts as text. The share of the sample that
 * shows text is the share of the pages that cost READ_PAGE_MB. An encrypted document builds no text (R9) and counts none. */
const READ_BASE_MB = 25;
const READ_PAGE_MB = 0.031;
const READ_BARE_PAGE_MB = 0.006;
const READ_LIMIT_MB = boundOf("pdf", "need_mb"); // R42, R48: quoted from READ_BOUNDS
const READ_SAMPLE_PAGES = 16;
/** @param {number} pages
 *  @param {number} bytes
 *  @param {number} textShare
 *  @returns {number} */
const readingNeedMB = (pages, bytes, textShare) =>
  READ_BASE_MB + bytes / 1048576 + pages * (READ_BARE_PAGE_MB + (READ_PAGE_MB - READ_BARE_PAGE_MB) * textShare);

/** The share of the document's pages that show text, from READ_SAMPLE_PAGES of them evenly spaced; a page that cannot be
 *  told is counted as text. */
/** @param {PdfDoc} doc
 *  @returns {Promise<number>} */
async function sampledTextShare(doc) {
  const n = doc.pageCount, k = Math.min(READ_SAMPLE_PAGES, n);
  /* the sample decodes streams, which notes; the reading that follows must find the document as it was */
  const notes = doc.notes.length, noted = new Set(doc._trailingNoted);
  let showing = 0;
  for (let i = 0; i < k; i++) {
    /** @type {boolean | null} */
    let shows;
    try { shows = await pageShowsText(doc, doc.pageDict(k === 1 ? 0 : Math.round(i * (n - 1) / (k - 1)))); } catch { shows = null; }
    if (shows !== false) showing++;
  }
  doc.notes.length = notes; doc._trailingNoted = noted;
  return k ? showing / k : 0;
}

/* R42, fix round 5 (E2) — THE SECOND TERM: A PAGE OF MORE TEXT THAN THE MEASURED ONE.
 *
 * Re-measured at the index path's budget (2 MiB of text units, `extraction`'s CAPTURE_TEXT_CAPTURE_BOUND) under workerd with
 * the 20 MB the plane's own baseline takes: the budget changes nothing (the answer is built whole whatever the units keep:
 * 1,000 pages of 120 lines read in 58 MB of old space with it and 58 without), and the page rule above holds for the pages it
 * was measured on. For pages of more text it is low: 1,500 pages of 200 lines, 11.6 MB, need 113 MB (the rule 83), over the
 * 108 the object leaves. The memory of those follows the characters, so a sample of the document's own pages is read the way
 * the reading reads them (READ_SAMPLE_PAGES, evenly spaced, notes left as they were) and the second term is READ_BASE_DENSE_MB
 * + the file's MiB + READ_PAGE_DENSE_MB a page + READ_MCHAR_MB a million characters (decoded, with the codes that cannot be
 * decoded): measured 63 / 96 / 112 / 72 / 98 against 63 / 97 / 113 / 68 / 98 for 1,000 and 2,000 pages of 120 lines, 1,500
 * of 200, 3,500 of 40 and 3,000 of 80. The reading is refused when either term is over READ_LIMIT_MB; neither lowers the
 * other, so every document the page rule refused is refused still. It is looked at only for a document of more than
 * READ_SAMPLE_FROM pages (a file under the byte ceiling cannot reach the limit below it) that the page rule passes, an
 * encrypted document counts none, and a page the sample cannot read counts as the largest it did read. It is not exact:
 * the govinfo volumes carry more per character than it says (BUDGET-2024-APP: 98 measured, 67 by this term, 82 by the page
 * rule), which the page rule's measurement still covers. */
const READ_BASE_DENSE_MB = 29;
const READ_PAGE_DENSE_MB = 0.001;
const READ_MCHAR_MB = 1.8;
const READ_SAMPLE_FROM = 64;
/** @param {number} pages
 *  @param {number} bytes
 *  @param {number} mchars
 *  @returns {number} */
const denseNeedMB = (pages, bytes, mchars) => READ_BASE_DENSE_MB + bytes / 1048576 + pages * READ_PAGE_DENSE_MB + mchars * READ_MCHAR_MB;

/** The million characters the document's pages show, from READ_SAMPLE_PAGES of them evenly spaced. */
/** @param {PdfDoc} doc
 *  @returns {Promise<number>} */
async function sampledMChars(doc) {
  const n = doc.pageCount, k = Math.min(READ_SAMPLE_PAGES, n);
  const notes = doc.notes.length, noted = new Set(doc._trailingNoted);
  const fontCache = new FontCache();
  let total = 0, most = 0, unread = 0;
  for (let i = 0; i < k; i++) {
    const pageMap = doc.pageDict(k === 1 ? 0 : Math.round(i * (n - 1) / (k - 1)));
    /** @type {number | null} */
    let chars = null;
    if (pageMap) {
      try {
        const got = await extractPageText(doc, i, pageMap, fontCache, false);
        chars = got.text.length + got.undetermined.reduce((c, m) => c + (Number.isFinite(m.count) ? m.count : 0), 0);
      } catch { chars = null; }
    }
    const counted = chars;
    if (counted === null) { unread++; continue; }
    total += counted; most = Math.max(most, counted);
  }
  doc.notes.length = notes; doc._trailingNoted = noted;
  return k ? (total + unread * most) / k * n / 1e6 : 0;
}

/** R8's whole lenient read, the one way a document is opened here and in
 *  `pdf-worker`. The caller has checked the bytes. */
/** @param {Uint8Array} bytes
 *  @returns {Promise<PdfDoc>} */
async function loadPdf(bytes) {
  const doc = new PdfDoc(bytes);
  doc.scanTopLevel();
  await doc.loadObjectStreams();
  doc.buildPageIndex();
  return doc;
}

/** `loadPdf` that gives the thread back (R45): `yieldNow()` is awaited between the three phases and between the slices
 *  inside each; a `yieldNow` that throws or rejects is ignored (the open goes on, and its answer is the same). */
/** @param {Uint8Array} bytes
 *  @param {() => (void | Promise<void>)} yieldNow
 *  @returns {Promise<PdfDoc>} */
async function loadPdfYielding(bytes, yieldNow) {
  const tick = tickOf(yieldNow);
  const doc = new PdfDoc(bytes);
  for (const _ of doc._scanSteps()) await tick(); // eslint-disable-line no-unused-vars
  await tick();
  await doc.loadObjectStreams(tick);
  await tick();
  for (const _ of doc._pageIndexSteps()) await tick(); // eslint-disable-line no-unused-vars
  await tick();
  return doc;
}

/** Open a PDF for reading (R30): a `PdfDoc` that has run R8's whole read, or
 *  null when `bytes` is not a Uint8Array or carries no `%PDF-` signature in its
 *  first 1024 bytes. Never throws. */
/** @param {unknown} bytes
 *  @returns {Promise<PdfDoc | null>} */
export async function openPdf(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (!/%PDF-\d+\.\d+/.test(binaryString(bytes.subarray(0, 1024)))) return null;
  return loadPdf(bytes);
}

/** R1, R2, R42: the reading of a PDF, or why there is none. Never throws (see the block above).
 *  @param {unknown} bytes
 *  @returns {Promise<PdfStructureAnswer>} */
export async function extractPdfStructure(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    return { ok: false, container: "pdf", reason: "NOT_BYTES" };
  }
  const header = binaryString(bytes.subarray(0, 1024));
  const sig = /%PDF-(\d+\.\d+)/.exec(header);
  if (!sig) {
    return { ok: false, container: "pdf", reason: "NOT_A_PDF" };
  }
  const version = sig[1] ?? "";

  const doc = await loadPdf(bytes);

  /* R42: the pages are known now and no page's text has been built. */
  let textShare = 1;
  let needMB = readingNeedMB(doc.pageCount, bytes.length, textShare);
  if (needMB > READ_LIMIT_MB) {
    textShare = doc.isEncrypted() ? 0 : await sampledTextShare(doc);
    needMB = readingNeedMB(doc.pageCount, bytes.length, textShare);
  }
  /** @type {number | null} */
  let mchars = null;
  if (needMB <= READ_LIMIT_MB && doc.pageCount > READ_SAMPLE_FROM && !doc.isEncrypted()) {
    const sampled = await sampledMChars(doc);
    mchars = sampled;
    needMB = Math.max(needMB, denseNeedMB(doc.pageCount, bytes.length, sampled));
  }
  if (needMB > READ_LIMIT_MB) {
    return {
      ok: false, container: "pdf", reason: "TOO_LARGE_TO_READ", failure: "final", version,
      pages: doc.pageCount, bytes: bytes.length, need_mb: Math.round(needMB), limit_mb: READ_LIMIT_MB,
      text_share: textShare,
    };
  }

  /** @type {LinkRecord[]} */
  const links = [];

  for (let pageIdx = 0; pageIdx < doc.pageCount; pageIdx++) {
    const page = doc.pageDict(pageIdx);
    if (!page) continue;
    const annots = asArr(doc.resolve(page.Annots));
    if (!annots) continue;

    for (const annotRef of annots.items) {
      const map = doc.dictOf(annotRef);
      if (!map) continue;
      const subtype = asName(map.Subtype);
      /** @type {LinkSource} */
      const source = { page: pageIdx, rect: rectOf(doc, map) };

      // File attachment annotations are embedded files -> intra (or undetermined).
      if (subtype && subtype.v === "FileAttachment") {
        links.push(await embeddedFileRecord(doc, map.FS, pageIdx, source.rect, strOf(doc, map.Contents)));
        continue;
      }

      if (!subtype || subtype.v !== "Link") continue;

      const action = doc.dictOf(map.A);
      const sn = action ? asName(action.S) : null;
      const sName = sn ? sn.v : null;

      // /A /S /URI
      if (action && sName === "URI") {
        const uri = strOf(doc, action.URI);
        if (uri != null) { links.push(deferredOrRefusedRecord(uri, source)); continue; }
        links.push(undeterminedRecord(source, "uri_action_without_uri"));
        continue;
      }

      // /A /S /GoTo, or a bare /Dest on the annotation
      if (sName === "GoTo" || map.Dest) {
        const dest = action && sName === "GoTo" ? action.D : map.Dest;
        const res = resolveDestination(doc, dest);
        if (res.ok) {
          links.push(anchorRecord(doc, res.page, source, destNameOf(doc, dest)));
        } else {
          links.push(undeterminedRecord(source, res.why, { dest: res.dest }));
        }
        continue;
      }

      // Actions we do not carry this phase (GoToR remote, Launch, etc.) or a
      // Link with no action at all: recorded, never invented.
      if (sName === "GoToR" || sName === "Launch") {
        links.push(undeterminedRecord(source, `unsupported_action_${sName}`));
        continue;
      }
      links.push(undeterminedRecord(source, sName ? `unsupported_action_${sName}` : "link_without_action_or_dest"));
    }
  }

  // Document-level embedded files (/Root /Names /EmbeddedFiles) -> intra. These
  // have no page/rect element reference; that is stated, not invented.
  for (const rec of await documentEmbeddedFiles(doc)) links.push(rec);

  /** @type {LinkCounts} */
  const counts = { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 };
  for (const l of links) counts[l.partition]++;

  // Tier 1 text (CPDF-4): extends this same I2 output object; do not fork it.
  /* R35: each page's placed glyphs, kept off the output, from which every
     link's anchor text is read. A document-level record that could not be resolved has the page null. */
  /** @type {Map<number | null, LinkRecord[]>} */
  const linksOf = emptyMap();
  for (const l of links) {
    const src = l.source;
    if (!src) continue;
    const had = linksOf.get(src.page);
    /** @type {LinkRecord[]} */
    const list = had ?? [];
    if (!had) linksOf.set(src.page, list);
    list.push(l);
  }
  /** @type {Set<number>} */
  const linkPages = emptySet();
  for (const k of linksOf.keys()) if (k !== null) linkPages.add(k);
  const text = await extractText(doc, (idx, placed) => {
    for (const l of linksOf.get(idx) ?? []) l.anchor = anchorOf(placed, l.source);
  }, linkPages);
  /* a link whose page was not read (encrypted, unreadable), or that has no page */
  for (const l of links) if (!("anchor" in l)) l.anchor = anchorOf(null, l.source);

  /* CPDF-18: the images each page PAINTS, as IC-1 `image {page, rect}`
     references. TOP-LEVEL on the structure object rather than on `text`,
     because the pdf-worker (I6) REPLACES `text` with its Tier-2 decode and an
     image list riding there would vanish on exactly the documents Tier 2
     reads. NULL with `imagesWhy` when not walked; an empty list is a zero. */
  const imgs = await extractImages(doc);
  /* D-627 (R26): a page an image fills while its text is a folio says so. */
  if (imgs.images) markImageContent(doc, text, imgs.images);
  /* R34: and every painted image above the floor says its content is unread. */
  if (imgs.images) markImagesUnread(doc, text, imgs.images);

  /* R39 (N1202): the document's /Info /Title; before the return, since a title
     it cannot decode adds a note. */
  const metadata = extractMetadata(doc);

  return {
    ok: true,
    container: "pdf",
    version,
    pages: doc.pageCount,
    links,
    counts,
    text,
    images: imgs.images,
    ...(imgs.images ? {} : { imagesWhy: imgs.why }),
    /* R33: each page's MediaBox, top-level for `images`' reason (tier 2
       replaces `text`): the bound a `pdf-page` rect is checked against. */
    pageBoxes: extractPageBoxes(doc),
    /* R36 (K1888): every place the file can act when opened, read and never
       run; top-level for the same reason. */
    active: extractActive(doc),
    /* R39: the title, top-level for the same reason. */
    metadata,
    notes: doc.notes,
  };
}

/* R43 (fix round 6, G26; K4606) — A RANGE OF PAGES, FOR A DOCUMENT TOO LARGE TO READ WHOLE.
 *
 * `extractPdfRange(bytes, {from, count})` opens the document once (R8's read, the cross-reference parsed once per call),
 * builds the text of the pages [from, from + count) only (0-based, `count` clamped to the pages left, `from` and `count`
 * whole numbers) with the same per-page reading `extractPdfStructure` makes, and returns before keeping any page's
 * structures: the answer holds only those pages' text. It answers `{ok, container, pages (the document's total), from,
 * count (pages built), text: {pages: [{page, text, undetermined}], undetermined, counts: {chars, undetermined}}}`; a
 * `from` at or past the pages answers `count: 0` and no pages; bytes that are not a PDF answer as `extractPdfStructure`
 * does. It never applies R42's refusal (a refusal exists for the whole document; a range is how the large one is read), an
 * encrypted document answers its one `encrypted` marker and no pages (R9), and the font cache is kept for the call only.
 * An optional `range.maxBytes` (G56) shrinks `count` to the pages that many file bytes carry at the document's bytes per page,
 * at least one; absent, or not a finite number above 0, the call is unchanged.
 * The images of the range's own pages give R26's and R34's markers as the whole reading gives them; the one difference is that
 * the whole reading drops them everywhere when a page elsewhere cannot be walked, which a range cannot know. */
/** R43: see above. Never throws on any bytes.
 *  @param {unknown} bytes
 *  @param {PdfRangeArgs} [range]
 *  @returns {Promise<PdfRange | PdfRefusal>} */
export async function extractPdfRange(bytes, range) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, container: "pdf", reason: "NOT_BYTES" };
  const refused = refusalOf(bytes);
  if (refused) return refused;
  return readRange(await loadPdf(bytes), bytes, range);
}

/** The answer for bytes that are not a PDF, as `extractPdfStructure` gives it; null for a PDF.
 *  @param {Uint8Array} bytes
 *  @returns {PdfRefusal | null} */
function refusalOf(bytes) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, container: "pdf", reason: "NOT_BYTES" };
  if (!/%PDF-\d+\.\d+/.test(binaryString(bytes.subarray(0, 1024)))) return { ok: false, container: "pdf", reason: "NOT_A_PDF" };
  return null;
}

/* R44 (fix round 7, G68; K4738) — A DOCUMENT OPENED ONCE AND READ BY RANGES MANY TIMES.
 *
 * `extractPdfRange` opens the file (R8's read: every `N G obj` scanned, every object stream decoded and its objects
 * placed) at each call, so a document read in fourteen pieces is opened fourteen times, and for a 23 MB file the opening
 * is most of every call. `openPdfRange(bytes)` opens it once and answers `{ ok: true, pages, range(...) }`; each `range`
 * is the page reading `extractPdfRange` makes of the opened document (the same function, `readRange`), so its answer is
 * the same for the same arguments. What the opened document holds is what one `extractPdfRange` holds while it reads: the
 * object table (typed arrays), the bounded caches of R41 (parsed objects, decoded object streams) and the bytes the
 * caller passed in. Nothing a `range` call builds is kept: its fonts and its pages' structures are the call's own, and
 * its notes are the open's again at the call's start (R50: the open's, kept and never cleared, then the range's own), so
 * fourteen calls leave the document as one left it. A caller that holds the opened document between calls (reading-pipeline, per digest) holds that. Bytes
 * that are not a PDF answer as `extractPdfRange` does, with no `range`.
 *
 * R45 (G82; K4743): `openPdfRange(bytes, {yieldNow})` with a function `yieldNow` awaits it between the opening's phases and
 * between slices inside each (SLICE_OBJECTS, SLICE_BYTES, SLICE_STREAMS), so on a platform that runs one thing at a time the
 * opening of a large file does not hold the thread for its whole length; the open's answer and every `range` are the same
 * as without it. The page index's last step (the numbered fallback over every page object) and the Info/trailer reads are
 * not sliced: they are one pass over typed arrays or a few objects. */
/** R44, R45, R50: see above. Never throws on any bytes.
 *  @param {unknown} bytes
 *  @param {OpenRangeOptions} [opts]
 *  @returns {Promise<OpenedRange | PdfRefusal>} */
export async function openPdfRange(bytes, opts) {
  if (!(bytes instanceof Uint8Array)) return { ok: false, container: "pdf", reason: "NOT_BYTES" };
  const refused = refusalOf(bytes);
  if (refused) return refused;
  /* `yieldNow` read as it always was: once to see that it is a function, and once to take it */
  const asked = opts ? opts.yieldNow : undefined;
  const yieldNow = opts && typeof asked === "function" ? opts.yieldNow ?? null : null;
  const doc = yieldNow ? await loadPdfYielding(bytes, yieldNow) : await loadPdf(bytes);
  openedNotes(doc);
  return { ok: true, pages: doc.pageCount, notes: [...new Set(doc.notes)], range: (range) => readRange(doc, bytes, range, yieldNow ? slicerOf(yieldNow) : null) };
}

/** The notes (and the streams already noted) the open left on `doc`, taken once, at the open.
 *  @param {PdfDoc} doc
 *  @returns {{ notes: string[], noted: Set<number> }} */
function openedNotes(doc) {
  return doc._opened ||= { notes: doc.notes.slice(), noted: new Set(doc._trailingNoted) };
}

/** A range's `count`, read again (as `range.count` was, once to see it is there and once to take it).
 *  @param {PdfRangeArgs} range
 *  @returns {number | undefined} */
function countOf(range) {
  return range.count;
}

/** R43's reading of an opened document's pages; the one body of `extractPdfRange` and of an opened document's `range`.
 *  @param {PdfDoc} doc
 *  @param {Uint8Array} bytes
 *  @param {PdfRangeArgs | undefined} range
 *  @param {Slicer | null} [sl]
 *  @returns {Promise<PdfRange>} */
async function readRange(doc, bytes, range, sl = null) {
  /* R50: the notes the open made stay; a range adds its own to them, each once */
  const opened = openedNotes(doc);
  doc.notes.length = 0;
  doc.notes.push(...opened.notes);
  doc._trailingNoted = new Set(opened.noted);
  const total = doc.pageCount;
  const from = Math.max(0, Math.floor(Number(range && range.from)) || 0);
  const asked = range && range.count !== undefined ? Math.floor(Number(countOf(range))) : total;
  /* An optional `maxBytes` (G56) bounds the call by work as well as by pages. Fix round 9 (G124d): it is judged against each
     page's own decoded size as the page is built, not the document's average, so the range stops before the page that would
     pass it (after at least one page) and a heavy page among light ones is a range of its own. */
  const maxBytes = range && range.maxBytes;
  const limited = typeof maxBytes === "number" && Number.isFinite(maxBytes) && maxBytes > 0 && total > 0;
  const count = Math.max(0, Math.min(Number.isFinite(asked) ? asked : total, total - from));
  /** @param {PageText[]} pages
   *  @param {Marker[]} undetermined
   *  @param {number} chars
   *  @returns {PdfRange} */
  const out = (pages, undetermined, chars) => ({
    ok: true, container: "pdf", pages: total, from, count: pages.length,
    text: { pages, undetermined, counts: { chars, undetermined: undetermined.length } },
    notes: [...new Set(doc.notes)],
  });
  if (count <= 0) return out([], [], 0);
  if (doc.isEncrypted()) {
    doc.note("encrypted");
    /** @type {Marker} */
    const marker = { page: null, reason: "encrypted", font: null, codes: "", count: 0 };
    return { ...out([], [marker], 0), count: 0, final: true };
  }
  const fontCache = new FontCache();
  /** @type {PageText[]} */
  const pages = [];
  /** @type {Marker[]} */
  const undetermined = [];
  let chars = 0, spent = 0;
  for (let idx = from; idx < from + count; idx++) {
    const pageMap = doc.pageDict(idx);
    /** @type {PageReading} */
    let res;
    if (!pageMap) {
      res = { text: "", undetermined: [{ page: idx, reason: "page_unreadable", font: null, codes: "", count: 0 }] };
    } else {
      try {
        /* the page's decoded content is known before it is built when `maxBytes` asks; the next call reuses it */
        /** @type {PageContent | null} */
        let given = null;
        if (limited && maxBytes !== undefined) {
          const peek = doc._peek;
          const content = peek && peek.idx === idx ? peek.content : await pageContent(doc, pageMap);
          given = content;
          doc._peek = null;
          const ov = content.over;
          const size = ov ? ov.size : content.data.length;
          if (pages.length > 0 && spent + size > maxBytes) { doc._peek = { idx, content }; break; }
          spent += size;
        }
        res = await extractPageText(doc, idx, pageMap, fontCache, false, given, sl);
      } catch {
        doc.note("text_extraction_error");
        res = { text: "", undetermined: [{ page: idx, reason: "text_extraction_error", font: null, codes: "", count: 0 }] };
      }
    }
    pages.push({ page: idx, text: res.text, undetermined: res.undetermined });
    for (const u of res.undetermined) undetermined.push(u);
    if (res.text.length) chars += (chars ? 1 : 0) + res.text.length;
  }
  const result = out(pages, undetermined, chars);
  /* R26 and R34 read the images each page paints; the walk is the range's own pages, so a page of the range that cannot be
     walked says nothing for the range (as a page anywhere in the whole reading says nothing for it), and the markers
     are those the whole reading puts on these pages. */
  /** @type {ImagePlacement[]} */
  const painted = [];
  let walked = true;
  /** @type {string | null} */
  let why = null;
  for (let idx = from; idx < from + pages.length && walked; idx++) {
    /** @type {PageImages | null} */
    let got;
    try { got = await pageImagesOf(doc, idx, sl); } catch { got = null; }
    const g = got;
    if (!g || !g.images) { walked = false; why = g ? g.why : `page_unreadable:${idx}`; } else for (const im of g.images) painted.push(im);
  }
  if (walked) { markImageContent(doc, result.text, painted); markImagesUnread(doc, result.text, painted); }
  /* R46: what a reading stores of the document and not of its text, so that the union of the ranges loses none of it */
  const levelFrom = doc.notes.length;
  /** The document-level members, read once for the opened document.
   *  @returns {Promise<{ metadata: PdfMetadata | null, pageBoxes: PageBoxes | null, notes?: string[] }>} */
  const readLevel = async () => {
    /** @type {PageBoxes | null} */
    let boxes = null;
    if (sl) { const got = { boxes }; for (const _ of pageBoxSteps(doc, got)) await sl.go(); boxes = got.boxes; } // eslint-disable-line no-unused-vars
    else boxes = extractPageBoxes(doc);
    const lv = (doc._level ||= { metadata: extractMetadata(doc), pageBoxes: boxes });
    lv.notes = doc.notes.slice(levelFrom);
    return lv;
  };
  const level = doc._level ?? await readLevel();
  for (const n of level.notes ?? []) doc.note(n);   /* a title that cannot be decoded is the document's, in every range */
  result.notes = [...new Set(doc.notes)];
  result.metadata = level.metadata;
  result.pageBoxes = level.pageBoxes;
  result.images = walked ? painted : null;
  if (!walked) result.imagesWhy = why ?? "";
  let glyphs = 0, words = 0, seen = 0;
  for (const pg of pages) {
    for (const ch of pg.text) {
      if (!/\s/u.test(ch)) glyphs++;
      if (sl && (++seen & 0x3fff) === 0) await sl.add(256);   /* R45: 16,384 characters counted, a quarter of a slice */
    }
    if (!sl) words += (pg.text.match(/\S+/gu) || []).length;
    else for (const _ of pg.text.matchAll(/\S+/gu)) { words++; if ((++seen & 0x3fff) === 0) await sl.add(256); } // eslint-disable-line no-unused-vars
  }
  result.text_glyphs = glyphs;
  result.words_total = words;
  return result;
}

/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} dest
 *  @returns {string | null} */
function destNameOf(doc, dest) {
  const d = doc.resolve(dest);
  const named = asName(d) || asStr(d);
  return named ? named.v : null;
}

/** @param {PdfDoc} doc
 *  @returns {Promise<(IntraLink | UndeterminedLink)[]>} */
async function documentEmbeddedFiles(doc) {
  /** @type {(IntraLink | UndeterminedLink)[]} */
  const out = [];
  const root = doc.root;
  if (!root) return out;
  const names = doc.dictOf(root.Names);
  if (!names) return out;
  const tree = doc.resolve(names.EmbeddedFiles);
  const pairs = collectNameTreePairs(doc, tree);
  for (const [name, filespec] of pairs) {
    out.push(await embeddedFileRecord(doc, filespec, null, null, name));
  }
  return out;
}

/** @param {PdfDoc} doc
 *  @param {PdfValue | undefined} nodeIn
 *  @param {number} [depth]
 *  @param {[string | null, PdfValue | undefined][]} [acc]
 *  @returns {[string | null, PdfValue | undefined][]} */
function collectNameTreePairs(doc, nodeIn, depth = 0, acc = []) {
  const node = asDict(doc.resolve(nodeIn));
  const map = node ? node.map : null;
  if (!map || depth > 64) return acc;
  const names = asArr(doc.resolve(map.Names));
  if (names) {
    for (let i = 0; i + 1 < names.items.length; i += 2) {
      const key = asStr(doc.resolve(names.items[i]));
      acc.push([key ? key.v : null, names.items[i + 1]]);
    }
  }
  const kids = asArr(doc.resolve(map.Kids));
  if (kids) for (const kid of kids.items) collectNameTreePairs(doc, kid, depth + 1, acc);
  return acc;
}

/* ------------------------------------------------------------------ *
 * R49 — ONE PAGE FROM A RANGE SOURCE
 *
 * `pageSource(source, pageIndex)` reads the trailer, the cross-reference chain (tables, streams, object streams) and the
 * page tree through `source.readRange(offset, length)` alone, and writes the page as a small PDF of its own: the page
 * dictionary with its inherited MediaBox, CropBox, Rotate and Resources written into it, its content streams, and every
 * object they reference (fonts, images, forms), renumbered. What it reads is the cross-reference data, the objects
 * on the path to the page and those objects: not the file. It never scans (a scan reads the file), so anything the chain
 * does not name, or names wrongly, is an irregularity: `{ ok: false, fallback: true, why }`, and the caller reads the whole.
 * ------------------------------------------------------------------ */

/** Raised inside the reading to answer `fallback` with a reason; never leaves `pageSource`. */
class PageFallback extends Error {
  /** @param {string} why */
  constructor(why) {
    super(why);
    /** @type {string} */
    this.why = why;
  }
}
/** @param {string} why
 *  @returns {PageSourceAnswer} */
const fallbackNote = (why) => ({ ok: false, fallback: true, why });
/** The reading goes on only where `cond` holds; otherwise it answers `fallback` with `why`.
 *  @param {unknown} cond
 *  @param {string} why
 *  @returns {asserts cond} */
function need(cond, why) { if (!cond) throw new PageFallback(why); }

/** The page-dictionary keys that are not carried into a page's own file: its place in the tree, and what points
 *  away from the page (annotations and their destinations, threads, structure, metadata). */
/** @type {Set<string>} */
const PAGE_DROPPED_KEYS = new Set(["Parent", "Annots", "B", "Thumb", "AA", "StructParents", "PieceInfo", "Metadata", "Tabs", "ID", "PZ"]);
const PAGE_INHERITED_KEYS = ["MediaBox", "CropBox", "Rotate", "Resources"];

/** One cross-reference section read through a range source: its entries are read when asked for.
 *  @typedef {{ trailer: PdfMap, prev: number | null, xrefStm: number | null, find: (n: number) => Promise<XrefEntry | null> }} RangeSection */
class RangeXref {
  /** @param {RangeSource} source */
  constructor(source) {
    /** @type {RangeSource} */
    this.source = source;
    /** @type {number} */
    this.size = source.size;
    /** @type {Map<number, PdfValue | undefined>} */
    this.objs = emptyMap();
    /** @type {Map<number, { text: string, first: number, pairs: number[] }>} */
    this.inner = emptyMap();
    /** @type {RangeSection[] | null} */
    this.secs = null;
    /** @type {number} */
    this.bytesRead = 0;
  }

  /** `length` bytes from `offset` (fewer at the end of the source), counted.
   *  @param {number} offset
   *  @param {number} length
   *  @returns {Promise<Uint8Array>} */
  async read(offset, length) {
    need(Number.isInteger(offset) && offset >= 0 && offset < this.size && Number.isInteger(length) && length > 0, "range_outside_source");
    const len = Math.min(length, this.size - offset);
    const got = await this.source.readRange(offset, len);
    need(got instanceof Uint8Array, "range_unreadable");
    this.bytesRead += got.length;
    return got;
  }

  /** The value of an object opening at `off` (`N G obj`, N being `n` when given), from windows that grow while its
   *  dictionary runs past them: `{ num, value }`, a stream's `start` absolute.
   *  @param {number} off
   *  @param {number | null} n
   *  @returns {Promise<{ num: number, value: PdfValue }>} */
  async parseAt(off, n) {
    for (let size = 512; ; size *= 8) {
      const b = await this.read(off, size);
      const s = binaryString(b);
      const m = /^\s*(\d+)\s+(\d+)\s+obj\b/.exec(s);
      need(m && (n == null || groupNumber(m[1]) === n), "object_not_at_offset");
      const r = parseValueSafe(s, m[0].length);
      const rv = r ? r.value : null;
      need(r && rv, "object_unparseable");
      if (r.pos >= s.length - 16 && off + b.length < this.size) {
        need(size < OBJ_WINDOW_MAX, "object_over_bound");
        continue;
      }
      const st = asStream(rv);
      return { num: groupNumber(m[1]), value: st ? { ...st, start: off + st.start } : rv };
    }
  }

  /** @returns {Promise<RangeSection[]>} */
  async sections() {
    const had = this.secs;
    if (had) return had;
    const tail = await this.read(Math.max(0, this.size - 2048), 2048);
    const ts = binaryString(tail);
    const at = ts.lastIndexOf("startxref");
    const m = at < 0 ? null : /^startxref\s+(\d+)/.exec(ts.slice(at, at + 40));
    need(m && groupNumber(m[1]) < this.size, "no_startxref");
    /** @type {RangeSection[]} */
    const secs = [];
    /** @type {Set<number>} */
    const seen = emptySet();
    /** @type {number | null} */
    let off = groupNumber(m[1]);
    for (;;) {
      const o = off;
      if (o == null) break;
      need(!seen.has(o) && secs.length < XREF_CHAIN_MAX, "xref_chain");
      seen.add(o);
      const sec = await this.readSection(o);
      secs.push(sec);
      const xs = sec.xrefStm;
      if (xs !== null && Number.isInteger(xs)) {
        need(!seen.has(xs), "xref_chain");
        seen.add(xs);
        secs.push(await this.readSection(xs));
      }
      off = Number.isInteger(sec.prev) ? sec.prev : null;
    }
    return (this.secs = secs);
  }

  /** @param {number} off
   *  @returns {Promise<RangeSection>} */
  async readSection(off) {
    const head = binaryString(await this.read(off, 64));
    const lead = head.length - head.trimStart().length;
    return head.slice(lead, lead + 4) === "xref" ? this.readTable(off + lead) : this.readXrefStream(off + lead);
  }

  /** A classic table: its subsection headers are read in turn, an entry only when asked for (20 bytes each).
   *  @param {number} p
   *  @returns {Promise<RangeSection>} */
  async readTable(p) {
    /** @type {{ start: number, count: number, at: number }[]} */
    const subs = [];
    p += 4;
    for (;;) {
      const s = binaryString(await this.read(p, 64));
      const lead = s.length - s.trimStart().length;
      const m = /^(\d+)\s+(\d+)[ \t]*(?:\r\n|\r|\n)?/.exec(s.slice(lead));
      if (!m) { p += lead; break; }
      const start = groupNumber(m[1]), count = groupNumber(m[2]);
      const at = p + lead + m[0].length;
      need(at + count * 20 <= this.size && subs.length < 100000, "xref_table");
      subs.push({ start, count, at });
      p = at + count * 20;
    }
    const tb = binaryString(await this.read(p, OBJ_WINDOW));
    const ti = tb.indexOf("trailer");
    need(ti >= 0 && tb.slice(0, ti).trim() === "", "xref_trailer");
    const r = parseValueSafe(tb, ti + 7);
    const td = r ? asDict(r.value) : null;
    need(r && r.value && td, "xref_trailer");
    const trailer = td.map;
    /** @param {number} n
     *  @returns {Promise<XrefEntry | null>} */
    const find = async (n) => {
      for (const s of subs) {
        if (n < s.start || n >= s.start + s.count) continue;
        const e = /^(\d{10}) (\d{5}) ([nf])/.exec(binaryString(await this.read(s.at + (n - s.start) * 20, 20)));
        need(e, "xref_entry");
        return e[3] === "n" && groupNumber(e[1]) > 0 ? { type: 1, off: groupNumber(e[1]) } : { type: 0 };
      }
      return null;
    };
    const prev = trailer.Prev, xrefStm = trailer.XRefStm;
    return { trailer, prev: typeof prev === "number" ? prev : null,
      xrefStm: typeof xrefStm === "number" ? xrefStm : null, find };
  }

  /** A cross-reference stream: held whole (its rows are the file's objects, a few bytes each).
   *  @param {number} p
   *  @returns {Promise<RangeSection>} */
  async readXrefStream(p) {
    const o = await this.parseAt(p, null);
    const so = asStream(o.value);
    need(so, "xref_stream");
    const dict = so.dict;
    const type = asName(dict.Type);
    need(type && type.v === "XRef", "xref_stream");
    const w = asArr(await this.deref(dict.W));
    need(w && w.items.length === 3, "xref_stream");
    const widths = xrefWidths(w.items);
    need(widths, "xref_stream");
    const cols = widths[0] + widths[1] + widths[2];
    need(cols > 0, "xref_stream");
    const size = await this.num(dict.Size);
    const idx = asArr(await this.deref(dict.Index));
    /** @type {[number, number][]} */
    const ranges = [];
    if (idx) {
      for (let i = 0; i + 1 < idx.items.length; i += 2) {
        const first = idx.items[i], n = idx.items[i + 1];
        need(typeof first === "number" && Number.isInteger(first) && typeof n === "number" && Number.isInteger(n) && n >= 0, "xref_stream");
        ranges.push([first, n]);
      }
    } else { need(size !== null && Number.isInteger(size), "xref_stream"); ranges.push([0, size]); }
    const got = await this.streamData(so, STREAM_MAX);
    need(got && got.full, "xref_stream_undecodable");
    const data = got.data;
    /** @param {number} at
     *  @param {number} n
     *  @returns {number} */
    const field = (at, n) => { let v = 0; for (let k = 0; k < n; k++) v = v * 256 + byteAt(data, at + k); return v; };
    /** @param {number} n
     *  @returns {Promise<XrefEntry | null>} */
    const find = async (n) => {
      let row = 0;
      for (const [start, count] of ranges) {
        if (n >= start && n < start + count) {
          const at = (row + (n - start)) * cols;
          need(at + cols <= data.length, "xref_entry");
          const t = widths[0] ? field(at, widths[0]) : 1;
          const a = field(at + widths[0], widths[1]), c = field(at + widths[0] + widths[1], widths[2]);
          return t === 1 && a > 0 ? { type: 1, off: a } : t === 2 ? { type: 2, stm: a, idx: c } : { type: 0 };
        }
        row += count;
      }
      return null;
    };
    return { trailer: dict, prev: (await this.num(dict.Prev)) ?? null, xrefStm: null, find };
  }

  /** The newest section's entry for object `n`, or null when no section names it.
   *  @param {number} n
   *  @returns {Promise<XrefEntry | null>} */
  async lookup(n) {
    for (const sec of await this.sections()) {
      const e = await sec.find(n);
      if (e) return e;
    }
    return null;
  }

  /** @param {string} key
   *  @returns {Promise<PdfValue | undefined>} */
  async trailerValue(key) {
    for (const sec of await this.sections()) if (sec.trailer[key] !== undefined) return sec.trailer[key];
    return undefined;
  }

  /** Object `n`'s value through the cross-reference chain: undefined for an object the chain does not hold (free, or no
   *  section names it: a reference to nothing, which reads as null as in a whole file); a damaged one is a fallback.
   *  @param {number} n
   *  @returns {Promise<PdfValue | undefined>} */
  async get(n) {
    if (!Number.isInteger(n) || n < 0) return undefined;
    if (this.objs.has(n)) return this.objs.get(n);
    need(this.objs.size < OBJECTS_MAX, "over_bound:objects");
    const e = await this.lookup(n);
    /** @type {PdfValue | undefined} */
    let v;
    if (!e || e.type === 0) v = undefined;
    else if (e.type === 1) v = (await this.parseAt(e.off, n)).value;
    else v = await this.packed(e.stm, e.idx, n);
    this.objs.set(n, v);
    return v;
  }

  /** Object `n` out of object stream `stm`: decoded once for the call.
   *  @param {number} stm
   *  @param {number} idx
   *  @param {number} n
   *  @returns {Promise<PdfValue>} */
  async packed(stm, idx, n) {
    const had = this.inner.get(stm);
    /** @type {{ text: string, first: number, pairs: number[] }} */
    let pack;
    if (had) pack = had;
    else {
      const so = asStream(await this.get(stm));
      need(so, "object_stream_missing");
      const first = await this.num(so.dict.First), count = await this.num(so.dict.N);
      need(first !== null && Number.isInteger(first) && count !== null && Number.isInteger(count) && first >= 0 && count >= 0 && count <= 1e6, "object_stream_header");
      const got = await this.streamData(so, STREAM_MAX);
      need(got && got.full, "object_stream_undecodable");
      const text = binaryString(got.data);
      pack = { text, first, pairs: text.slice(0, first).trim().split(/\s+/).map(Number) };
      this.inner.set(stm, pack);
    }
    let at = -1;
    if (pack.pairs[idx * 2] === n) at = idx * 2;
    else for (let i = 0; i + 1 < pack.pairs.length; i += 2) if (pack.pairs[i] === n) { at = i; break; }
    const off = pack.pairs[at + 1];
    need(at >= 0 && off !== undefined && Number.isFinite(off), "object_stream_entry");
    const r = parseValueSafe(pack.text, pack.first + off);
    need(r && r.value !== undefined, "object_stream_entry");
    return r.value;
  }

  /** @param {PdfValue | undefined} v
   *  @returns {Promise<PdfValue>} */
  async deref(v) {
    let cur = v;
    for (let hops = 0; ; hops++) {
      const r = asRef(cur);
      if (!r) break;
      need(hops < 64, "reference_chain");
      cur = await this.get(r.n);
    }
    return cur ?? null;
  }
  /** @param {PdfValue | undefined} v
   *  @returns {Promise<number | null>} */
  async num(v) {
    const d = await this.deref(v);
    return typeof d === "number" ? d : null;
  }

  /** A stream's raw bytes, by its `/Length` (the reader never scans for `endstream`, which would read on) and checked
   *  to be followed by `endstream`: a fallback otherwise.
   *  @param {PdfStream} st
   *  @returns {Promise<Uint8Array>} */
  async rawStream(st) {
    const len = await this.num(st.dict.Length);
    need(len !== null && Number.isInteger(len) && len >= 0 && st.start >= 0 && st.start + len <= this.size, "stream_length");
    need(len <= STREAM_CAPS.embedded_file, "over_bound:stream");
    const raw = len ? await this.read(st.start, len) : new Uint8Array(0);
    need(raw.length === len, "stream_length");
    const after = binaryString(await this.read(st.start + len, Math.min(24, this.size - st.start - len) || 1));
    need(/^\s*endstream/.test(after), "stream_length");
    return raw;
  }

  /** A stream's decoded bytes `{ data, full }` (Flate, with ASCII stages before it, PNG-predicted as `/DecodeParms` says).
   *  @param {PdfStream} st
   *  @param {number} max
   *  @returns {Promise<{ data: Uint8Array, full: boolean }>} */
  async streamData(st, max) {
    const raw = await this.rawStream(st);
    const f = await this.deref(st.dict.Filter);
    const names = filterNames(f);
    const un = undoAscii(names, raw);
    need(un && un.rest.every(isFlateName), "stream_filter");
    let data = un.data, full = true;
    if (!names.length && raw.length > max) { data = raw.subarray(0, max); full = false; }
    for (let i = 0; i < un.rest.length; i++) {
      const r = inflateSync(data, max);
      const rd = r ? r.data : null;
      need(r && rd, "stream_undecodable");
      data = rd; full = full && r.full;
    }
    let parms = await this.deref(st.dict.DecodeParms) || await this.deref(st.dict.DP);
    const pa = asArr(parms);
    if (pa) parms = await this.deref(pa.items[pa.items.length - 1]);
    const pd = asDict(parms);
    if (pd) {
      const predictor = await this.num(pd.map.Predictor);
      need(predictor !== 2, "stream_predictor");
      if (predictor && predictor >= 2) {
        data = unpredict(data, { predictor, colors: (await this.num(pd.map.Colors)) ?? 1, columns: (await this.num(pd.map.Columns)) ?? 1,
          bpc: (await this.num(pd.map.BitsPerComponent)) ?? 8 });
      }
    }
    return { data, full };
  }
}

/** A value written as PDF syntax into `out` (strings), with references renumbered through `renum` (a reference to nothing the
 *  page keeps is `null`). A string is written by its `raw` bytes in hex, so no byte changes. */
/** @param {PdfValue | undefined} v
 *  @param {Map<number, number>} renum
 *  @returns {string} */
function writeValue(v, renum) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "0";
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(6)));
  }
  switch (v.t) {
    case "name": return writeName(v.v);
    case "str": return "<" + toHex(v.raw) + ">";
    case "ref": { const n = renum.get(v.n); return n === undefined ? "null" : `${n} 0 R`; }
    case "arr": return "[" + v.items.map((x) => writeValue(x, renum)).join(" ") + "]";
    case "dict": return writeDict(v.map, renum);
    default: return "null";
  }
}
/** @param {string} s
 *  @returns {string} */
function writeName(s) {
  let out = "/";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c <= 0x20 || c >= 0x7f || c === 0x23 || isDelimiter(c) ? "#" + (c & 0xff).toString(16).padStart(2, "0") : s[i];
  }
  return out;
}
/** @param {PdfMap} map
 *  @param {Map<number, number>} renum
 *  @param {Set<string> | null} [skip]
 *  @param {string} [extra]
 *  @returns {string} */
function writeDict(map, renum, skip = null, extra = "") {
  let out = "<<";
  for (const k in map) if (!skip || !skip.has(k)) out += " " + writeName(k) + " " + writeValue(map[k], renum);
  return out + extra + " >>";
}
/** Every reference inside `v`, in order.
 *  @param {PdfValue | undefined} v
 *  @param {number[]} into
 *  @returns {number[]} */
function refsIn(v, into) {
  if (!v || typeof v !== "object") return into;
  if (v.t === "ref") into.push(v.n);
  else if (v.t === "arr") for (const x of v.items) refsIn(x, into);
  else if (v.t === "dict") for (const k in v.map) refsIn(v.map[k], into);
  else if (v.t === "stream") for (const k in v.dict) refsIn(v.dict[k], into);
  return into;
}

/** Whether a page-tree node states `/Type /Pages`.
 *  @param {PdfMap} map
 *  @returns {boolean} */
function isPagesNode(map) {
  const t = asName(map.Type);
  return !!(map.Type && t && t.v === "Pages");
}

/** R49: the page at `pageIndex` (0-based) of the document `source` holds, as a PDF of its own. See the block above. */
/** @param {RangeSource} source
 *  @param {number} pageIndex
 *  @returns {Promise<PageSourceAnswer>} */
export async function pageSource(source, pageIndex) {
  try {
    need(source && typeof source.readRange === "function" && Number.isInteger(source.size) && source.size > 0, "no_source");
    need(Number.isInteger(pageIndex) && pageIndex >= 0, "page_out_of_range");
    return await pageOf(source, pageIndex);
  } catch (e) {
    return fallbackNote(e instanceof PageFallback ? e.why : "unreadable");
  }
}

/** @param {RangeSource} source
 *  @param {number} pageIndex
 *  @returns {Promise<PageSourceAnswer>} */
async function pageOf(source, pageIndex) {
  const x = new RangeXref(source);
  const head = binaryString(await x.read(0, Math.min(1024, source.size)));
  const ver = /%PDF-(\d+\.\d+)/.exec(head);
  need(ver, "not_a_pdf");
  need((await x.trailerValue("Encrypt")) === undefined, "encrypted");
  const root = asDict(await x.deref(await x.trailerValue("Root")));
  need(root, "no_catalog");
  const top = asDict(await x.deref(root.map.Pages));
  need(top, "no_page_tree");
  const total = await x.num(top.map.Count);
  need(total !== null && Number.isInteger(total) && total >= 0, "no_page_count");
  need(pageIndex < total, "page_out_of_range");

  /* the walk: a subtree whose /Count lies wholly before the page is skipped unread */
  const inherited = newMap();
  /** @type {PdfDict} */
  let node = top;
  let rest = pageIndex;
  /** @type {PdfDict | null} */
  let page = null;
  const pageFound = () => page; // the walk's answer, read once the walk is done
  /** @type {Set<number>} */
  const onPath = emptySet();
  for (let depth = 0; page === null; depth++) {
    need(depth <= TREE_DEPTH_MAX, "over_bound:tree_depth");
    const nodeMap = node.map;
    for (const k of PAGE_INHERITED_KEYS) if (nodeMap[k] !== undefined) inherited[k] = nodeMap[k];
    const kids = asArr(await x.deref(nodeMap.Kids));
    need(kids, "page_tree_damaged");
    /** @type {PdfDict | null} */
    let next = null;
    /* a node whose /Count is the number of its kids holds only leaves: the page is the kid at `rest`, and the kids before it
     * are not read (a table of a thousand pages of one flat node costs the page, not the thousand); a kid that is not a leaf
     * after all is an irregularity */
    const flat = (await x.num(nodeMap.Count)) === kids.items.length;
    if (flat) {
      need(rest < kids.items.length, "page_tree_damaged");
      const kidRef = asRef(kids.items[rest]);
      need(kidRef, "page_tree_damaged");
      const kid = asDict(await x.deref(kidRef));
      need(kid && kid.map.Kids === undefined && !isPagesNode(kid.map), "page_tree_count");
      page = kid;
      break;
    }
    for (const item of kids.items) {
      const kidRef = asRef(item);
      need(kidRef && !onPath.has(kidRef.n), "page_tree_damaged");
      const kid = asDict(await x.deref(kidRef));
      need(kid, "page_tree_damaged");
      const isNode = kid.map.Kids !== undefined || isPagesNode(kid.map);
      if (!isNode) {
        if (rest === 0) { page = kid; break; }
        rest--;
        continue;
      }
      const count = await x.num(kid.map.Count);
      need(count !== null && Number.isInteger(count) && count >= 0, "page_tree_damaged");
      if (rest < count) { next = kid; onPath.add(kidRef.n); break; }
      rest -= count;
    }
    if (page === null) { const nx = next; need(nx, "page_tree_damaged"); node = nx; }
  }
  const pageDictOf = pageFound();
  /* the walk ends only with a page found: reading the page of none would throw, and so does this */
  if (!pageDictOf) throw new TypeError("Cannot read properties of null (reading 'map')");

  /* the page's own dictionary, the inherited keys written into it, then the objects it points to */
  const own = pageDictOf.map;
  const pageMap = newMap();
  for (const k in own) { const ov = own[k]; if (!PAGE_DROPPED_KEYS.has(k) && ov !== undefined) pageMap[k] = ov; }
  for (const k of PAGE_INHERITED_KEYS) { const iv = inherited[k]; if (pageMap[k] === undefined && iv !== undefined) pageMap[k] = iv; }
  need(pageMap.MediaBox !== undefined, "no_media_box");
  need(pageMap.Contents !== undefined || pageMap.Resources !== undefined, "page_without_content");

  /** @type {number[]} */
  const order = [];            // old object numbers, in the order they are written (new numbers from 4)
  /** @type {Map<number, number>} */
  const renum = emptyMap();
  /** @type {Map<number, PdfValue>} */
  const values = emptyMap();
  const queue = refsIn({ t: "dict", map: pageMap }, []);
  for (let qi = 0; qi < queue.length; qi++) {
    const n = byteAt(queue, qi);
    if (renum.has(n)) continue;
    const v = await x.get(n);
    if (v === undefined) continue;                                     // a reference to nothing reads as null
    const d = v ? mapOf(v) : null;
    const tn = d ? asName(d.Type) : null;
    const type = tn ? tn.v : null;
    if (type === "Page" || type === "Pages" || type === "Catalog") continue; // away from the page: null
    need(order.length < OBJECTS_MAX, "over_bound:objects");
    renum.set(n, 4 + order.length);
    order.push(n);
    values.set(n, v);
    for (const m of refsIn(v, [])) queue.push(m);
  }

  /* write the file */
  /** @param {string} s
   *  @returns {Uint8Array} */
  const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
  /** @type {Uint8Array[]} */
  const parts = [];
  /** @type {number[]} */
  const offsets = [];
  let pos = 0, kept = 0;
  /** @param {Uint8Array} b */
  const add = (b) => { parts.push(b); pos += b.length; };
  /** @param {number} num
   *  @param {string} body */
  const object = (num, body) => { offsets[num] = pos; add(enc(`${num} 0 obj\n${body}\nendobj\n`)); };
  add(enc(`%PDF-${ver[1]}\n%\xe2\xe3\xcf\xd3\n`));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, writeDict(pageMap, renum, new Set(["Type"]), " /Type /Page /Parent 2 0 R"));
  for (const n of order) {
    const v = values.get(n), num = renum.get(n) ?? NaN;
    if (v && typeof v === "object" && v.t === "stream") {
      const raw = await x.rawStream(v);
      kept += raw.length;
      need(kept <= STREAM_CAPS.embedded_file, "over_bound:page");
      offsets[num] = pos;
      add(enc(`${num} 0 obj\n` + writeDict(v.dict, renum, new Set(["Length"]), ` /Length ${raw.length}`) + "\nstream\n"));
      add(raw);
      add(enc("\nendstream\nendobj\n"));
    } else object(num, writeValue(v, renum));
  }
  const count = 4 + order.length;
  const xrefAt = pos;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) table += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  add(enc(table + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`));
  const bytes = new Uint8Array(pos);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  return { ok: true, pages: total, bytes };
}
