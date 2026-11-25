/* The DOCX registry entry (I7, QUEUE COFF-4) — the first office format on the
 * FORMAT axis, built on ooxml.mjs's container primitives.
 *
 * WHAT IT EMITS (I2, plus the shared evidentiary envelope — IC-2):
 *
 *   structure(parts) ->
 *     { ok:true, container:"docx", paragraphs:<int>,
 *       links:[ LinkRecord... ],           // the SAME partitions HTML and PDF
 *       counts:{anchor,intra,deferred,refused,undetermined},   // use, wrapped
 *       evidentiary:{ ... },               // IC-2 — the extras a rendered form
 *       notes:[...] }                      //        of the document destroys
 *
 *   - word/_rels/document.xml.rels `TargetMode="External"` -> deferred/refused,
 *     wrapped by importing subresources.mjs's ONE `linkWrapper` — the parity
 *     property pdfstructure.test.mjs pins for PDF is pinned here for DOCX the
 *     same way, so FRAMEWORK consumes all three containers through one path.
 *   - `<w:hyperlink w:anchor>` -> bookmark -> `anchor` (an internal reference
 *     the way a PDF GoTo is); an anchor naming a bookmark the body does not
 *     define is a STATED undetermined, never an invented target.
 *   - word/embeddings/* -> `intra`, content-addressed by sha256 exactly as a
 *     PDF's embedded files are.
 *   - An unreadable .rels part or embedding is CARRIED as an undetermined
 *     LinkRecord naming the part and why — dropped structure is invented
 *     structure's quieter sibling, and both are forbidden.
 *
 *   ELEMENT REFERENCES are `{kind:"doc-para", ref:"¶<1-based>", para:<0-based>,
 *   run:<0-based, optional>}` per IC-1 as RESOLVED: a DOCX has no pages in its
 *   bytes (pagination is a render-time artifact), so the body's `<w:p>`
 *   sequence — every `<w:p>` in document order, including inside tables — is
 *   the honest anchor. `run` appears only when the reference genuinely targets
 *   runs (a hyperlink, a tracked change); run boundaries are producer
 *   artifacts, and the paragraph is what a person is shown.
 *
 *   text(parts) -> { ok:true, container:"docx", document, paragraphs:[
 *     {para, ref, text} ], undetermined:[Marker...], counts:{chars,
 *     undetermined} } — `<w:t>` runs in body order. A DOCX has no pages, so
 *   the per-unit list is `paragraphs`, not PDF's `pages` (the degenerate form
 *   I2's residual anticipated; stated in IC-2). Deleted text (`w:delText`)
 *   is NOT in the text stream — it is not what a reader of the served
 *   document sees — it lives in the evidentiary envelope as the SUPERSEDED
 *   WORDING. Inserted text (`w:ins` > `w:t`) IS in the stream: it is part of
 *   the document as served.
 *
 *   THE EVIDENTIARY CORE (DEC-5). Tracked changes and comments are evidence a
 *   published PDF of the same document is specifically designed to remove:
 *     { kind:"tracked-change", change:"insertion", author, date, text, source }
 *     { kind:"tracked-change", change:"deletion",  author, date,
 *       superseded, source }                  // the wording that was removed
 *     { kind:"comment", id, author, date, initials, text, source }
 *     { kind:"core-properties", creator, lastModifiedBy, revision, ... }
 *   under ONE envelope `evidentiary` shared by the office entries (IC-2):
 *     { container, kinds:[...], items:[...], undetermined:[{part,why}...],
 *       counts:{<kind>:n} }
 *   Absent attributes are null, never invented; an unreadable comments.xml is
 *   a STATED `{part, why}` in the envelope's own `undetermined`.
 *
 * DETECTION — the confidence ladder, decided deliberately (COFF-1's note):
 *   - bytes: ZIP magic + a READABLE central directory + BOTH
 *     `[Content_Types].xml` and `word/document.xml` present -> "likely". Not
 *     "certain": certainty needs the OPC content-type declaration, which is
 *     DEFLATED and so out of reach of the registry's synchronous detect;
 *     `parts()` runs the full async `discriminate()` and tells the truth.
 *   - a bare `PK\x03\x04` sniff (the acquire-time 1 KiB seam: no EOCD, no
 *     central directory) answers NULL — a renamed plain ZIP is not a .docx,
 *     so ZIP magic alone never claims one. The acquire stamp honestly reads
 *     `undetermined` for OOXML captures until a read-time consult sees the
 *     whole container.
 *   - content type alone: the exact .docx MIME type -> "likely" (the
 *     registry's second pass; a declared type is at most likely, per I7).
 *
 * SIZE GUARD: the DECLARED UNCOMPRESSED bytes of the text parts we would inflate
 * (word/document.xml + word/comments.xml, summed from the central directory —
 * the COFF-6 metric) are what this entry may hold in memory at once, up to
 * ooxml.mjs's bound. Over it, up to its STREAMED_TEXT_BOUND_BYTES, the body is
 * READ IN PIECES (R35, F7): inflated in windows and walked by the same two
 * walks that read a small one, fed a piece at a time, so the part is never
 * held; the tables' `cells` (N724) are not made (`cells` is null) and the
 * answer says it was read in pieces (`piecewise`). Over the streamed ceiling
 * full text extraction is refused as a STATED text-undetermined carrying the
 * marker, its size and `final: true`. Container walk, rels and
 * core-properties still run; nothing is silently truncated. Every part read
 * at all passes ooxml.mjs's part cap (R12, F18): a refusal names its limit
 * where that part's failure is stated.
 *
 * ACTIVE CONTENT (R32, K1888): `structure()` and `text()` carry `active`,
 * what in the file can act when opened (a VBA project, ActiveX and OLE parts,
 * embedded files, external relationship targets), found and read, never run;
 * `activeContent` below is the one builder the three OOXML entries share. The
 * macro-enabled flavours (.docm, .dotm) read as this entry with `variant` set
 * (R33).
 *
 * This module ASSERTS nothing about meaning (FRAMEWORK's, through I2) and
 * WRITES nothing. Never invent structure: everything unreadable is stated.
 */

import { linkWrapper } from "./subresources.mjs";
import {
  hasZipMagic, readContainer, readPart, normalizePartName,
  discriminate, walkRels, relsPartFor, textPlan, pieceWhy, cutAfterTag,
  CORE_PROPERTIES_PART, readCoreProperties, withContainerImages,
  readVbaProject, MEASURED_OOXML_TEXT_BOUND_BYTES,
} from "./ooxml.mjs";
/* The one A1 column reading (a cycle with formats-xlsx.mjs, which imports
   this file's shared builders; both sides use only hoisted functions). */
import { columnLetters } from "./formats-xlsx.mjs";
import { localize } from "./setup-words/index.mjs";
import { boundOf } from "./read-bounds.mjs";
import {
  Scanner, scanPart, scanWhole, scanSync, parseAttrs, unescape, readText, scanNotes, jsonBytes, memberIdentities, addressParts, countObjects, precountFloor, readTextBytes, scanBytes, owned, decodePart,
} from "./office-xml.mjs";

/* R44: what the walk may retain, paragraphs, cells and links together (the table's figure, never a literal here). */
const OFFICE_RETAINED_MAX = boundOf("office", "retained_objects");
/* R44: the decoded characters a walk may hold at once (the table's row). */
const OFFICE_DECODED_CHARS_MAX = boundOf("office", "decoded_chars");

/* Bytes as a Uint8Array, an ArrayBuffer, any typed-array view or an array of
 * byte values; anything else reads as no bytes, so a wrong argument is a
 * named refusal downstream, never a throw (R21; ooxml.mjs's own policy). */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return new Uint8Array(x ?? 0); } catch { return new Uint8Array(0); }
}
const isBytes = (x) => x instanceof ArrayBuffer || ArrayBuffer.isView(x);


export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/* R33 (K1903): the macro-enabled flavours' package types, each read as this
 * entry's own format; the flavour is named in the signals, never as `format`. */
const DOCX_TWIN_CONTENT_TYPES = new Map([
  ["application/vnd.ms-word.document.macroEnabled.12", "docm"],
  ["application/vnd.ms-word.template.macroEnabled.12", "dotm"],
]);
const CONTENT_TYPES_PART = "[Content_Types].xml";
const MAIN_PART = "word/document.xml";
const COMMENTS_PART = "word/comments.xml";
const EMBEDDINGS_DIR = "word/embeddings/";

/* ------------------------------------------------------------------ *
 * The IC-1 element reference
 * ------------------------------------------------------------------ */

/** `{kind:"doc-para", ref:"¶<1-based>", para:<0-based>[, run:<0-based>]}`.
 *  `run` is included only when the caller genuinely has one (IC-1: run
 *  boundaries are producer artifacts; the paragraph is what a person is
 *  shown). */
export function docParaRef(para, run = null) {
  const ref = { kind: "doc-para", ref: `¶${para + 1}`, para };
  if (run != null) ref.run = run;
  return ref;
}

/** FW-19 / IC-124 — `{kind:"doc-table", ref:"table <1-based>[, <cell>]",
 *  table:<0-based>[, cell:<A1>]}` (EXTRACTION-BREADTH §3.2).
 *
 *  `table` is the table's ORDINAL in document order — every table, nested
 *  ones included, counted by the same walk that reports the bound
 *  (`walkDocumentTables`), so a reference and the figure it is checked against
 *  cannot be numbered two ways. 0-based in the address and 1-based in `ref`,
 *  the `doc-para` convention one arm over. `cell` is OPTIONAL and is A1
 *  notation over the table's own grid (B3 = second column, third row), the
 *  one cell notation this grammar already has; it is included only when the
 *  caller genuinely names one. EXPORTED because `odf.mjs`'s `.odt` entry
 *  emits the same arm — one builder per arm, COFF-10's rule. */
export function docTableRef(table, cell = null) {
  const out = { kind: "doc-table", ref: `table ${table + 1}${cell != null ? `, ${cell}` : ""}`, table };
  if (cell != null) out.cell = cell;
  return out;
}

/* ------------------------------------------------------------------ *
 * XML plumbing: office-xml.mjs's one scanner (R42), its attribute reader and its entity decode (R40)
 * ------------------------------------------------------------------ */

const attrsOf = parseAttrs;
const decodeEntities = unescape;

/* ------------------------------------------------------------------ *
 * Markup Compatibility (ECMA-376 Part 3; N26) — one branch read, never two
 * ------------------------------------------------------------------ */

/** A producer writes the same content twice inside `<mc:AlternateContent>`:
 *  a modern form in `<mc:Choice>` (a DrawingML text box) and an older one in
 *  `<mc:Fallback>` (its VML copy). A consumer reads ONE branch. This reader
 *  understands no namespace better than another, so it takes the producer's
 *  own preference: the FIRST `<mc:Choice>`; every later `<mc:Choice>` and the
 *  `<mc:Fallback>` are not read; with no `<mc:Choice>` the `<mc:Fallback>`
 *  is. Before N26 both branches were walked, so a text box's paragraphs,
 *  text and tables appeared twice. Returns a per-token test: true while the
 *  token lies in a branch not read (that branch's own tags included).
 *  Exported for `pptx.mjs`' slide walk (N439), the same rule one format over:
 *  one selection, never a second copy that could drift. */
export function mceSkipper() {
  const taken = [];    // per open AlternateContent: has a branch been read
  let skip = null;     // { name, depth } while inside a branch not read
  return (name, closing, selfClosed) => {
    if (skip) {
      if (name === skip.name) {
        if (closing) { if (--skip.depth === 0) skip = null; }
        else if (!selfClosed) skip.depth++;
      }
      return true;
    }
    if (name === "AlternateContent") {
      if (closing) taken.pop();
      else if (!selfClosed) taken.push(false);
      return false;
    }
    if ((name === "Choice" || name === "Fallback") && !closing && taken.length) {
      const top = taken.length - 1;
      if (taken[top]) {
        if (!selfClosed) skip = { name, depth: 1 };
        return true;
      }
      taken[top] = true;
    }
    return false;
  };
}

/* ------------------------------------------------------------------ *
 * The body walk — ONE pass over word/document.xml collecting everything
 * structure(), text() and the evidentiary envelope need, in body order
 * ------------------------------------------------------------------ */

/** The body walk as a scanner handler. Collects
 *  { paragraphs:[{para,text}], hyperlinks:[{rid,anchor,para,run}],
 *    bookmarks:Map(name -> para), changes:[{change,author,date,text,para,run}],
 *    commentRefs:Map(id -> {para,run}), ridUsage:Map(rid -> {para,run}),
 *    footnoteRefs, endnoteRefs: Map(id -> {para,run}), headerRefs:[{kind,rid,type,para,run}],
 *    textBoxes:[{paras}], images:Map(para -> rid|null) }.
 *
 *  Paragraph index: EVERY `<w:p>` read in document order (a branch of
 *  `mc:AlternateContent` not read holds none: `mceSkipper`), numbered as it OPENS (a
 *  table cell's paragraphs are `<w:p>` elements too, and they count). A
 *  paragraph CAN hold another: a text box (`<w:txbxContent>`) sits inside a
 *  run of its anchoring paragraph. The inner paragraph takes the next number,
 *  and when it closes the walk returns to the outer one, whose later text,
 *  runs and links stay its own — never dropped for the inner close. Run index: `<w:r>` opens within the current paragraph,
 *  0-based, wherever they sit (inside hyperlinks and tracked changes
 *  included) — one sequence per paragraph, so a run index means the same
 *  thing to every reference into that paragraph.
 *
 *  `meter` (R44) counts what the walk retains, paragraphs, cells and links, and the characters it holds; the first
 *  figure past its bound is `meter.exceeded` and stops the scan. `paragraphText: false` keeps no paragraph's text (a
 *  reader that needs the count and the structure, not the words); the text of a tracked change is kept either way. */
function bodyWalk({ paragraphText, meter, count, over, charsMax, refs }) {
  const paragraphs = [];
  const hyperlinks = [];
  const bookmarks = new Map();
  const changes = [];
  const commentRefs = new Map();
  const ridUsage = new Map();
  const footnoteRefs = new Map();
  const endnoteRefs = new Map();
  const headerRefs = [];
  const textBoxes = [];
  const boxStack = [];
  const images = new Map();

  let para = -1;   // current 0-based paragraph index
  let run = -1;    // current 0-based run index within the paragraph
  let inPara = false;
  let last = -1;          // the highest paragraph number given so far
  const outer = [];       // {para, run} of the paragraphs an open one sits in
  let textTarget = null;            // "t" | "delText" | null, while inside one
  const hyperStack = [];            // open <w:hyperlink> contexts
  const insStack = [];              // open <w:ins> contexts
  const delStack = [];              // open <w:del> contexts

  const noteRid = (attrs) => {
    if (!inPara) return;
    for (const key of ["id", "embed", "link"]) {
      const v = attrs[key];
      if (typeof v === "string" && /^rId/.test(v) && !ridUsage.has(v))
        ridUsage.set(v, { para, run: run >= 0 ? run : null });
    }
  };
  const appendVisible = (s) => {
    if (!inPara || !s) return;
    if (paragraphText) {
      paragraphs[para].text += s;
      meter.chars += s.length;
      if (meter.chars > charsMax) over("TOO_MANY_CHARACTERS", meter.chars, charsMax);
    }
    for (const c of insStack) c.text += s;
  };
  const characters = (data) => {
    if (textTarget === "t") appendVisible(data);
    else if (textTarget === "delText" && delStack.length) delStack[delStack.length - 1].text += data;
  };

  const skipped = mceSkipper();

  const handler = {
    text(s) { if (textTarget) characters(owned(decodeEntities(s))); },
    cdata(s) { if (textTarget) characters(s); },
    close(name) {
      /* N26: a branch of mc:AlternateContent not read adds nothing. */
      if (skipped(name, true, false)) return;
      if (name === "t" || name === "delText") textTarget = null;
      else if (name === "p") {
        if (outer.length) ({ para, run } = outer.pop());
        else inPara = false;
      }
      else if (name === "hyperlink") { const h = hyperStack.pop(); if (h) hyperlinks.push(h); }
      else if (name === "ins") { const c = insStack.pop(); if (c) changes.push(c); }
      else if (name === "del") { const c = delStack.pop(); if (c) changes.push(c); }
      else if (name === "txbxContent") { const b = boxStack.pop(); if (b) textBoxes.push(b); }
    },
    open(name, raw, selfClosed) {
      /* N26: a relationship a branch not read uses still locates its part, at the paragraph and run that hold the
       * mc:AlternateContent — where the branch sits — never a guessed one. */
      if (skipped(name, false, selfClosed)) {
        if (raw && raw.includes("=")) noteRid(attrsOf(raw));
        return;
      }
      const attrs = raw && raw.includes("=") ? attrsOf(raw) : {};
      switch (name) {
        case "p":
          count();
          if (!selfClosed) {
            if (inPara) outer.push({ para, run });
            para = ++last; run = -1; inPara = true; paragraphs.push(refs ? { para, ref: `¶${para + 1}`, text: "" } : { para, text: "" });
          } else {
            paragraphs.push(refs ? { para: ++last, ref: `¶${last + 1}`, text: "" } : { para: ++last, text: "" });
            if (!inPara) { para = last; run = -1; }
          }
          for (const b of boxStack) b.paras.push(last);
          break;
        case "r":
          if (inPara && !selfClosed) {
            run++;
            for (const c of hyperStack) if (c.run == null) c.run = run;
            for (const c of insStack) if (c.run == null) c.run = run;
            for (const c of delStack) if (c.run == null) c.run = run;
          }
          break;
        case "t":
          if (!selfClosed) textTarget = "t";
          break;
        case "delText":
          if (!selfClosed) textTarget = "delText";
          break;
        case "tab":
          appendVisible("\t");
          break;
        case "br":
        case "cr":
          appendVisible("\n");
          break;
        case "hyperlink":
          count();
          noteRid(attrs);
          if (!selfClosed && inPara)
            hyperStack.push({ rid: attrs.id ?? null, anchor: attrs.anchor ?? null, para, run: null });
          else if (selfClosed && inPara)
            hyperlinks.push({ rid: attrs.id ?? null, anchor: attrs.anchor ?? null, para, run: null });
          break;
        case "ins":
          if (!selfClosed && inPara)
            insStack.push({ change: "insertion", author: attrs.author ?? null, date: attrs.date ?? null, text: "", para, run: null });
          break;
        case "del":
          if (!selfClosed && inPara)
            delStack.push({ change: "deletion", author: attrs.author ?? null, date: attrs.date ?? null, text: "", para, run: null });
          break;
        case "bookmarkStart":
          if (attrs.name != null && !bookmarks.has(attrs.name))
            bookmarks.set(attrs.name, para >= 0 ? para : 0);
          break;
        case "commentReference":
          if (attrs.id != null && !commentRefs.has(attrs.id))
            commentRefs.set(attrs.id, { para, run: run >= 0 ? run : null });
          break;
        case "footnoteReference":
        case "endnoteReference": {
          const into = name === "footnoteReference" ? footnoteRefs : endnoteRefs;
          if (attrs.id != null && !into.has(attrs.id)) into.set(attrs.id, { para, run: run >= 0 ? run : null });
          break;
        }
        case "headerReference":
        case "footerReference":
          headerRefs.push({ kind: name === "headerReference" ? "header" : "footer", rid: attrs.id ?? null,
            type: attrs.type ?? null, para: inPara ? para : null, run: inPara && run >= 0 ? run : null });
          noteRid(attrs);
          break;
        case "tc":
          count();
          break;
        case "txbxContent":
          if (!selfClosed) boxStack.push({ paras: [] });
          break;
        case "blip":
        case "imagedata":
          if (inPara && !images.has(para)) images.set(para, attrs.embed ?? attrs.id ?? null);
          noteRid(attrs);
          break;
        default:
          noteRid(attrs);
      }
    },
  };
  return { handler, result: () => ({ paragraphs, hyperlinks, bookmarks, changes, commentRefs, ridUsage,
    footnoteRefs, endnoteRefs, headerRefs, textBoxes, images }) };
}

/* R44: the elements the body walk counts as a retained object, one for each open of one (paragraphs, cells, links); `countObjects` counts the same. */
/* a body of at least this many declared bytes is kept as bytes (4 MiB: a string of it is under 8 MiB beside the answer) */
const WINDOWED_FLOOR = 4 * 1048576;
const BODY_COUNTED = new Set(["p", "tc", "hyperlink"]);

/** The walk the body gets (R42, R44): the body walk, and with `tables` the tables walk, fed by ONE scan. Its `handler` is
 *  what a scanner is given; `result()` the two walks' collections once the part is scanned; `meter.exceeded` the
 *  bound the walk went past, if it did (`{why:"TOO_MANY_OBJECTS"|"TOO_MANY_CHARACTERS", n, bound, final:true}`). */
export function createDocWalk({ paragraphText = true, tables = true, refs = false, retainedMax = OFFICE_RETAINED_MAX, charsMax = OFFICE_DECODED_CHARS_MAX } = {}) {
  const meter = { objects: 0, chars: 0, exceeded: null };
  const handler = { stopped: false };
  const over = (why, n, bound) => {
    if (!meter.exceeded) { meter.exceeded = { why, n, bound, final: true }; handler.stopped = true; }
  };
  const count = () => { if (++meter.objects > retainedMax) over("TOO_MANY_OBJECTS", meter.objects, retainedMax); };
  const body = bodyWalk({ paragraphText, meter, count, over, charsMax, refs });
  const tab = tables ? tablesWalk() : null;
  Object.assign(handler, {
    text: body.handler.text,
    cdata: body.handler.cdata,
    open(n, r, s) { body.handler.open(n, r, s); if (tab) tab.handler.open(n, r, s); },
    close(n) { body.handler.close(n); if (tab) tab.handler.close(n); },
  });
  return { handler, meter, body: body.result, tables: tab ? tab.result : () => [] };
}

/** Walk a whole WordprocessingML part held as a string, synchronously (the shape tests and callers without a part to
 *  read use): `{body, tables, meter, scanner}`. */
export function walkDocument(xml, opts) {
  const w = createDocWalk(opts);
  const scanner = new Scanner(w.handler);
  scanSync(scanner, xml);
  return { body: w.body(), tables: w.tables(), meter: w.meter, scanner };
}

/* ------------------------------------------------------------------ *
 * The parts outside the body: comments, footnotes, endnotes, headers, footers
 * ------------------------------------------------------------------ */

/** A part's units as a scanner handler. `unit` is the element delimiting them (`comment`, `footnote`, `endnote`) or null
 *  when the whole part is one (a header, a footer). A unit's text is its `<w:t>` runs, paragraphs newline-joined,
 *  `w:delText` never; with `layout`, tabs and line breaks too, as the body reads them. */
function unitReader(unit, layout) {
  const units = [];
  let cur = unit == null ? { attrs: {}, paras: [] } : null;
  if (cur) units.push(cur);
  let para = null, inT = false, root = null;
  const skipped = mceSkipper();
  const add = (s) => { if (inT && para != null) para += s; };
  const handler = {
    text(s) { add(decodeEntities(s)); },
    cdata(s) { add(s); },
    open(name, raw, self) {
      if (skipped(name, false, self)) return;
      if (root == null) root = name;
      if (unit != null && name === unit) {
        cur = { attrs: attrsOf(raw), paras: [] };
        units.push(cur);
        if (self) cur = null;
      } else if (name === "p") { if (cur && !self && para == null) para = ""; }
      else if (name === "t") { if (!self) inT = true; }
      else if (layout && para != null && name === "tab") para += "\t";
      else if (layout && para != null && (name === "br" || name === "cr")) para += "\n";
    },
    close(name) {
      if (skipped(name, true, false)) return;
      if (name === "t") inT = false;
      else if (name === "p") { if (para != null) { if (para) cur?.paras.push(para); para = null; } }
      else if (unit != null && name === unit) cur = null;
    },
  };
  return { handler, units: () => units.map((u) => ({ attrs: u.attrs, text: u.paras.join("\n") })), root: () => root };
}

/** Every `<w:comment>`: id, author, date, initials (each null when absent —
 *  never invented) and the comment's own text (its `<w:t>` runs, paragraphs
 *  newline-joined). A part holding a character reference that names no character is stated unreadable (R40). Async:
 *  awaits `yieldNow` as the body walk does. */
export async function parseComments(xml, yieldNow = null) {
  if (typeof xml !== "string") return { ok: false, why: "comments_unparseable" };
  const u = unitReader("comment", false);
  const sc = new Scanner(u.handler);
  await scanWhole(sc, xml, yieldNow);
  if (sc.badRef) return { ok: false, why: "char_ref_invalid", final: true, scanned: sc.scanned };
  if (u.root() !== "comments") return { ok: false, why: "comments_unparseable", scanned: sc.scanned };
  const comments = u.units().map((c) => ({
    id: c.attrs.id ?? null, author: c.attrs.author ?? null, date: c.attrs.date ?? null,
    initials: c.attrs.initials ?? null, text: c.text,
  }));
  return { ok: true, comments, scanned: sc.scanned, scanner: sc };
}

/** Read one note, header or footer part and give its units: `{ok:true, units:[{attrs,text}], scanner, partial?}` or the
 *  refusal (`{ok:false, why, ...}`) the part's own failure states. */
async function readUnits(parts, partName, unit, yieldNow) {
  const u = unitReader(unit, true);
  const r = await scanPart(parts.bytes, parts.container, partName, u.handler, { mode: parts.stream ? "pieces" : "whole", yieldNow });
  if (!r.ok) return r;
  return { ok: true, units: u.units(), scanner: r.scanner, ...(r.partial ? { partial: r.partial } : {}) };
}


/* ------------------------------------------------------------------ *
 * Link classification — the same partition rule pdfstructure applies
 * (http/https and bare relatives -> deferred; every other scheme refused)
 * ------------------------------------------------------------------ */

function classifyUri(uri) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(uri || "");
  const scheme = m ? m[1].toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  if (!scheme && uri) return "deferred";
  return "refused";
}

function deferredOrRefusedRecord(uri, source) {
  const partition = classifyUri(uri);
  return {
    partition,
    wrapper: partition === "deferred" ? linkWrapper.deferred(uri) : linkWrapper.refused(uri),
    target: { url: uri },
    source,
  };
}

function undeterminedRecord(source, why, extra = {}) {
  return { partition: "undetermined", wrapper: null, target: { why, ...extra }, source };
}


/* Resolve a rels Target against the source part's directory ("media/x.png"
 * relative to "word/" -> "word/media/x.png"; a leading "/" is package-root). */
function resolveRelTarget(relsPart, target) {
  const t = String(target || "");
  if (t.startsWith("/")) return normalizePartName(t);
  const baseDir = relsPart.replace(/_rels\/[^/]*\.rels$/, "");
  const segs = (baseDir + t).split("/");
  const out = [];
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return out.join("/");
}

/* ------------------------------------------------------------------ *
 * parts() — the container walk (I7 slot 2)
 * ------------------------------------------------------------------ */

const stripOk = ({ ok, ...rest }) => rest;
const EXTRA_KINDS = [
  [/\/header$/, "header"], [/\/footer$/, "footer"], [/\/footnotes$/, "footnote"], [/\/endnotes$/, "endnote"],
];
const EXTRA_NAME_RE = /^word\/(header\d*|footer\d*|footnotes|endnotes)\.xml$/;
/* Parts that can hold text and that no unit reads: stated, never a reading that says it is whole (R38). */
const UNREAD_TEXT_PART_RE = /^word\/(diagrams\/data[^/]*|charts\/chart[^/]*|glossary\/document)\.xml$/;

/* The parts outside the body that hold text, found through the document's own relationships, else by name:
   `[{kind, part, rid}]`, headers and footers in the order the relationships give them. */
function extraParts(container, rels, mainPart) {
  const found = [];
  const seen = new Set();
  const docRels = rels.byPart.find((p) => p.part === relsPartFor(mainPart));
  for (const r of docRels?.relationships ?? []) {
    if (r.external || !r.target) continue;
    const hit = EXTRA_KINDS.find(([re]) => re.test(String(r.type ?? "")));
    if (!hit) continue;
    const part = resolveRelTarget(docRels.part, r.target);
    if (seen.has(part)) continue;
    seen.add(part);
    found.push({ kind: hit[1], part, rid: r.id ?? null });
  }
  for (const entry of container.entries) {
    const part = normalizePartName(entry.name);
    const m = EXTRA_NAME_RE.exec(part);
    if (!m || seen.has(part)) continue;
    seen.add(part);
    const base = m[1];
    found.push({ kind: base.startsWith("header") ? "header" : base.startsWith("footer") ? "footer" : base === "footnotes" ? "footnote" : "endnote", part, rid: null });
  }
  return found;
}

/** Read everything structure()/text() will need, honestly:
 *  { ok:true, format:"docx", bytes, container, mainPart,
 *    documentXml|null, commentsXml|null, rels, core|null,
 *    extras:[{kind,part,rid}],         // footnotes, endnotes, headers, footers (R38)
 *    guard|null,                       // the sizeGuard marker when over bound
 *    partials:[{part,why:"partial",replaced}],   // a part decoded with more than 0.5 % replaced (R41)
 *    undetermined:[{part,why}...] }    // parts that exist but cannot be read
 *  or { ok:false, why, signals } when the bytes are not a readable DOCX. */
async function docxParts(bytes) {
  const b = toBytes(bytes);
  const d = await discriminate(b);
  if (!d.ok) return { ok: false, why: d.why, signals: d.signals };
  if (d.format !== "docx") {
    return {
      ok: false,
      why: d.format === "undetermined" ? d.why : `not_docx:${d.format}`,
      signals: d.signals,
    };
  }
  const container = readContainer(b);
  if (!container.ok) return { ok: false, why: container.why, signals: d.signals };

  const undetermined = [];
  const partials = [];
  const mainPart = normalizePartName(d.mainPart || MAIN_PART);
  const rels = await walkRels(b, container);
  const extras = extraParts(container, rels, mainPart);

  /* The COFF-6 metric: DECLARED UNCOMPRESSED bytes of the text parts we would
   * inflate, summed from the central directory BEFORE any inflation. */
  let declaredTextBytes = 0;
  for (const partName of [mainPart, COMMENTS_PART, ...extras.map((x) => x.part)]) {
    const e = container.byName.get(partName);
    if (e) declaredTextBytes += e.uncompressedSize;
  }
  const plan = textPlan(declaredTextBytes);
  const guard = plan.read === "none" ? plan.guard : null;
  const piecewise = plan.read === "pieces" ? plan.piecewise : null;

  let documentXml = null;
  let commentsXml = null;
  let refused = null, precounted = 0, documentBytes = null, documentEncoding = null;
  if (plan.read !== "none") {
    if (plan.read === "whole") {
      /* R44 (cause 11a): a body that could hold more objects than the figure is counted in pieces BEFORE it is held whole,
         so a part that would pass it is refused having spent no more than a piece. */
      const mainEntry = container.byName.get(mainPart);
      if (mainEntry && mainEntry.uncompressedSize >= precountFloor(OFFICE_RETAINED_MAX)) {
        const c = await countObjects(b, container, [mainPart], BODY_COUNTED, { skipper: mceSkipper, max: OFFICE_RETAINED_MAX });
        precounted = c.scanned;
        if (c.exceeded) refused = c.exceeded;
      }
      if (!refused && mainEntry && mainEntry.uncompressedSize >= WINDOWED_FLOOR) {
        /* a large body is kept as its bytes and decoded a window at a time by the walk: held as a string it is up to twice its size
           beside the answer (R44's margin) */
        const main = await readTextBytes(b, container, mainPart);
        if (main.ok) { documentBytes = main.data; documentEncoding = main.encoding; if (main.partial) partials.push(main.partial); }
        else undetermined.push({ part: mainPart, ...stripOk(main) });
      } else if (!refused) {
        const main = await readText(b, container, mainPart);
        if (main.ok) { documentXml = main.text; if (main.partial) partials.push(main.partial); }
        else undetermined.push({ part: mainPart, ...stripOk(main) });
      }
    } else if (!container.byName.has(mainPart)) {
      /* Read in pieces by text() and structure(), each in its own pass; a body
         the package does not hold is stated now (R35). */
      undetermined.push({ part: mainPart, why: "part_absent" });
    }
    const comments = container.byName.get(COMMENTS_PART);
    if (comments && comments.uncompressedSize > MEASURED_OOXML_TEXT_BOUND_BYTES) {
      /* The comments are small in any document; one over the bound is not read
         in pieces (they are parsed whole), and is stated with its size. */
      undetermined.push({ part: COMMENTS_PART, why: "over_size_bound", size: comments.uncompressedSize, final: true });
    } else if (comments) {
      const com = await readText(b, container, COMMENTS_PART);
      if (com.ok) { commentsXml = com.text; if (com.partial) partials.push(com.partial); }
      else undetermined.push({ part: COMMENTS_PART, ...stripOk(com) });
    }
    /* A part a relationship names and the package does not hold. */
    for (const x of extras) if (!container.byName.has(x.part)) undetermined.push({ part: x.part, why: "part_absent" });
    for (const entry of container.entries) {
      const part = normalizePartName(entry.name);
      if (UNREAD_TEXT_PART_RE.test(part)) undetermined.push({ part, why: "part_unread" });
    }
  }

  let core = null;
  if (container.byName.has(CORE_PROPERTIES_PART)) {
    const c = await readCoreProperties(b, container);
    if (c.ok) core = c;
    else undetermined.push({ part: CORE_PROPERTIES_PART, why: c.why });
  }

  /* R32: read from names, rels and the VBA project, so over the guard too. */
  const active = await activeContent(b, container, rels, "word/");

  const out = { ok: true, format: "docx", variant: d.variant ?? null, bytes: b, container, mainPart,
    documentXml, documentBytes, documentEncoding, commentsXml, rels, core, active, extras: extras.filter((x) => container.byName.has(x.part)),
    guard, piecewise, stream: plan.read === "pieces", partials, undetermined, refused, precounted };
  /* a body kept as bytes (R44) still answers `documentXml` for a caller that wants the string (extraction's renumbering): made when asked, held by no one */
  if (documentBytes != null) {
    Object.defineProperty(out, "documentXml", { enumerable: false, configurable: true, get: () => { const d = decodePart(documentBytes, mainPart); return d.ok ? d.text : null; } });
  }
  return out;
}

/* The body of a docx walked through `w` (createDocWalk): whole, its text in hand, or, over the bound, in pieces (R35).
   Answers `{ok:true, scanner}` or the refusal that states why the part was not read (R40: a character reference that
   names no character). A walk stopped by the retained-objects bound is `w.meter.exceeded` (R44). */
async function runBody(parts, w, yieldNow) {
  if (parts.documentBytes != null) {
    const sc = new Scanner(w.handler);
    await scanBytes(sc, parts.documentBytes, parts.documentEncoding, yieldNow);
    if (sc.badRef && !w.meter.exceeded) return { ok: false, why: "char_ref_invalid", final: true };
    return { ok: true, scanner: sc };
  }
  if (parts.documentXml != null) {
    const sc = new Scanner(w.handler);
    await scanWhole(sc, parts.documentXml, yieldNow);
    if (sc.badRef && !w.meter.exceeded) return { ok: false, why: "char_ref_invalid", final: true };
    return { ok: true, scanner: sc };
  }
  if (parts.stream) {
    const r = await scanPart(parts.bytes, parts.container, parts.mainPart, w.handler, { mode: "pieces", yieldNow });
    return r.ok || w.meter.exceeded ? { ok: true, scanner: r.scanner } : r;
  }
  return { ok: false, why: "unreadable" };
}


/* ------------------------------------------------------------------ *
 * structure() — I2 links + the evidentiary envelope (I7 slot 3)
 * ------------------------------------------------------------------ */

/** FW-19 — THE TABLES OF A WORDPROCESSING BODY, in document order, each with
 *  its grid: `[{ table, rows, cols }]`. EVERY `<w:tbl>` counts, nested ones
 *  included, numbered as it OPENS — the ordinal `docTableRef` addresses.
 *
 *  `rows` is the table's own `<w:tr>` count (a nested table's rows are its
 *  own, which the open-table stack keeps apart). `cols` is the declared grid
 *  — the `<w:gridCol>` count in the table's `<w:tblGrid>` — because a merged
 *  cell (`w:gridSpan`) makes a row's `<w:tc>` count SMALLER than the grid, and
 *  bounding by it would refuse a true address. Where a producer wrote no grid
 *  the widest row's cell count is used, which can only UNDER-state a merged
 *  table's width; that residue is stated here rather than discovered. A
 *  figure this walk could not establish is NULL, never 0.
 *
 *  N724 (R11, K1972): each table also lists its `cells`, `[{ row, col, paras }]`
 *  in row then column order, `row` and `col` 1-based over the table's own
 *  grid and `paras` the numbers of the paragraphs the cell holds, numbered as
 *  `walkDocumentBody` numbers them (every `<w:p>` read, as it opens), so the
 *  caller takes their text from that walk and the two cannot disagree. A
 *  paragraph belongs to the innermost cell open around it: a nested table's
 *  paragraphs are its own table's cells', never the outer cell's. A row's
 *  first cell sits after its `w:gridBefore` columns, and each cell moves the
 *  next by its `w:gridSpan`. A MERGED cell is one entry at its first grid
 *  position: a `w:vMerge` continuation joins the restart above it in the same
 *  column, a legacy `w:hMerge` continuation the cell before it in the row,
 *  each bringing its paragraphs (in practice empty) so no text is dropped; a
 *  continuation with nothing to join stands as its own cell. */
/** The tables walk as a scanner handler (the tables of N724 and their cells, as `walkDocumentTables` made them): fed by
 *  the same scan as the body walk, so the part is read once. `count` is the meter's object count */
function tablesWalk() {
  const done = [];
  const stack = [];
  let next = 0;
  let para = -1;  // the last paragraph number given, as the body walk gives them
  const skipped = mceSkipper(); // N26: a table in a branch not read is not a table of the reading
  const merge = (v) => (v == null ? null : v === "restart" ? "restart" : "continue");
  const closeCell = (t) => {
    const c = t.cell;
    if (!c) return;
    t.cell = null;
    t.nextCol = c.col + c.span;
    const owner = c.vMerge === "continue" ? t.vOwner.get(c.col)
      : c.hMerge === "continue" && t.rowCells.length ? t.rowCells[t.rowCells.length - 1] : null;
    if (owner) { owner.paras.push(...c.paras); return; }
    const entry = { row: c.row, col: c.col, paras: c.paras };
    t.cells.push(entry);
    t.rowCells.push(entry);
    if (c.vMerge === "restart") t.vOwner.set(c.col, entry);
    else t.vOwner.delete(c.col);
  };
  const finish = (t, rows) => {
    closeCell(t);
    done[t.table] = { table: t.table, rows,
      cols: t.gridCols > 0 ? t.gridCols : (t.maxTc > 0 ? t.maxTc : null), cells: t.cells };
  };
  const handler = {
    text() {},
    cdata() {},
    close(name) {
      if (skipped(name, true, false)) return;
      const top = stack.length ? stack[stack.length - 1] : null;
      if (name === "tbl" && stack.length) finish(stack.pop(), top.rows);
      else if (name === "tr" && top) {
        closeCell(top);
        if (top.tc > top.maxTc) top.maxTc = top.tc;
      } else if (name === "tc" && top) closeCell(top);
    },
    open(name, raw, selfClosed) {
      if (skipped(name, false, selfClosed)) return;
      const top = stack.length ? stack[stack.length - 1] : null;
      if (name === "p") { para++; if (top?.cell) top.cell.paras.push(para); return; }
      if (name === "tbl" && !selfClosed) {
        stack.push({ table: next++, rows: 0, gridCols: 0, tc: 0, maxTc: 0,
          cells: [], cell: null, nextCol: 1, rowCells: [], vOwner: new Map() });
      }
      else if (name === "tbl") done[next] = { table: next++, rows: 0, cols: null, cells: [] };
      else if (!top) return;
      else if (name === "gridCol") top.gridCols++;
      else if (name === "tr") { closeCell(top); top.rows++; top.tc = 0; top.nextCol = 1; top.rowCells = []; }
      else if (name === "gridBefore") {
        const n = parseInt(attrsOf(raw).val, 10);
        if (top.tc === 0 && Number.isInteger(n) && n > 0) top.nextCol = 1 + n;
      }
      else if (name === "tc") {
        closeCell(top);
        top.tc++;
        top.cell = { row: top.rows, col: top.nextCol, span: 1, vMerge: null, hMerge: null, paras: [] };
        if (selfClosed) closeCell(top);
      }
      else if (!top.cell) return;
      else if (name === "gridSpan") {
        const n = parseInt(attrsOf(raw).val, 10);
        if (Number.isInteger(n) && n > 1) top.cell.span = n;
      }
      else if (name === "vMerge") top.cell.vMerge = merge(attrsOf(raw).val ?? "continue");
      else if (name === "hMerge") top.cell.hMerge = merge(attrsOf(raw).val ?? "continue");
    },
  };
  const result = () => {
    /* A table the body never closed (a truncated part) is still a table this
       walk saw open; its figures are what was seen, and its ordinal stands so
       every later table keeps its number. */
    while (stack.length) { const t = stack.pop(); finish(t, t.rows || null); }
    return done;
  };
  return { handler, result };
}


/** N26's MIGRATION MAP — how a reading made before N26 (every branch of
 *  `mc:AlternateContent` walked) is numbered against one made now (one
 *  branch). For extraction's migration of stored references, and for nothing
 *  else; it goes when that migration has run.
 *
 *    { paragraphs: [{ old, new, outer }],      // one per <w:p> the OLD walk numbered
 *      runs: [{ old, new, outer }],            // one per <w:r> the OLD walk numbered; old/new {para, run}
 *      tables: [{ old, new }] }                // one per <w:tbl> the OLD walk numbered
 *
 *  A run is addressed as R15 addresses it, `{para, run}`. `new` is null for a
 *  paragraph (run, table) inside a branch no longer read: its content was the
 *  duplicate of the branch that is. Such a paragraph's `outer` is the NEW
 *  index of the paragraph that holds the `mc:AlternateContent` (null when
 *  none does), the narrowest place the reading still states; a dropped run's
 *  `outer` is its paragraph's new index, or that paragraph's `outer`. `outer`
 *  is null for what is kept. R28 (K747). Null when `xml` is not a string (R21). */
export function docxRenumbering(xml) {
  if (typeof xml !== "string") return null;
  /* The paragraph/run numbering exactly as the body walk keeps it. */
  const counter = () => {
    const s = { para: -1, run: -1, inPara: false, last: -1, outer: [] };
    return {
      s,
      openP(selfClosed) {
        if (!selfClosed) {
          if (s.inPara) s.outer.push({ para: s.para, run: s.run });
          s.para = ++s.last; s.run = -1; s.inPara = true;
          return s.para;
        }
        const n = ++s.last;
        if (!s.inPara) { s.para = n; s.run = -1; }
        return n;
      },
      closeP() { if (s.outer.length) ({ para: s.para, run: s.run } = s.outer.pop()); else s.inPara = false; },
      openR() { return s.inPara ? ++s.run : null; },
    };
  };
  const was = counter(), now = counter();
  const skipped = mceSkipper();
  const paragraphs = [], runs = [], tables = [];
  let tablesNew = 0;
  scanSync(new Scanner({
    text() {},
    cdata() {},
    close(name) {
      const skip = skipped(name, true, false);
      if (name === "p") { was.closeP(); if (!skip) now.closeP(); }
    },
    open(name, raw, selfClosed) {
      const skip = skipped(name, false, selfClosed);
      if (name === "p") {
        const old = was.openP(selfClosed);
        if (skip) paragraphs[old] = { old, new: null, outer: now.s.inPara ? now.s.para : null };
        else paragraphs[old] = { old, new: now.openP(selfClosed), outer: null };
      } else if (name === "r" && !selfClosed) {
        const run = was.openR();
        if (run == null) return;
        const para = was.s.para;
        if (skip) {
          const p = paragraphs[para];
          runs.push({ old: { para, run }, new: null, outer: p ? (p.new ?? p.outer) : null });
        } else runs.push({ old: { para, run }, new: { para: now.s.para, run: now.openR() }, outer: null });
      } else if (name === "tbl") {
        tables.push({ old: tables.length, new: skip ? null : tablesNew++ });
      }
    },
  }), xml);
  return { paragraphs, runs, tables };
}

async function docxStructure(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "docx", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  const yieldNow = opts?.yieldNow;
  const notes = [];
  const links = [];
  /* The body walked: whole (its XML in hand) or, over the bound, in pieces (R35), keeping no paragraph's text (this
     answer counts paragraphs and states changes, and holds no words but a change's own). A body that cannot be read to
     its end, or that the retained-objects bound refuses (R44), is stated. */
  let walk = null, bodyFailure = null;
  if (parts.refused) bodyFailure = parts.refused;
  else if (parts.documentBytes != null || parts.documentXml != null || parts.stream) {
    const w = createDocWalk({ paragraphText: false, tables: false });
    const run = await runBody(parts, w, yieldNow);
    if (w.meter.exceeded) bodyFailure = w.meter.exceeded;
    else if (run.ok) walk = w.body();
    else bodyFailure = stripOk(run);
  }
  if (!walk) {
    notes.push(parts.guard
      ? localize("office-readers.docx.word_document_xml_not_read_over_the_size_bound", "word/document.xml not read: over the size bound (stated in evidentiary.undetermined and by text())")
      : localize("office-readers.docx.word_document_xml_unreadable_element_references", "word/document.xml unreadable: element references unavailable (stated)"));
  }
  if (parts.piecewise) notes.push("text_read_in_pieces");

  /* Outbound rels -> deferred/refused, through the ONE linkWrapper. The
   * document part's rels get paragraph attribution from the body walk; every
   * other part's outbound rels are carried with source:null (a document-level
   * fact, not an invented location). One record per body USAGE when a rel is
   * used; a rel no usage was found for is still carried once. */
  const docRelsPart = relsPartFor(parts.mainPart);
  for (const rel of parts.rels.outbound) {
    if (rel.part === docRelsPart && walk) {
      const usages = walk.hyperlinks.filter((h) => h.rid === rel.id);
      if (usages.length) {
        for (const u of usages)
          links.push(deferredOrRefusedRecord(rel.target, docParaRef(u.para, u.run)));
        continue;
      }
    }
    links.push(deferredOrRefusedRecord(rel.target, null));
  }
  /* An unreadable .rels part means links may be MISSING: stated, not dropped. */
  for (const u of parts.rels.undetermined) {
    links.push(undeterminedRecord(null, "rels_unreadable", { part: u.part, detail: u.why }));
  }

  /* Internal `<w:hyperlink w:anchor>` -> bookmark -> anchor. */
  if (walk) {
    for (const h of walk.hyperlinks) {
      if (h.rid != null || h.anchor == null) continue;
      const source = docParaRef(h.para, h.run);
      if (walk.bookmarks.has(h.anchor)) {
        const targetPara = walk.bookmarks.get(h.anchor);
        const fragment = `#para=${targetPara + 1}`;
        links.push({
          partition: "anchor",
          wrapper: linkWrapper.anchor(fragment),
          target: { para: targetPara, fragment, bookmark: h.anchor },
          source,
        });
      } else {
        links.push(undeterminedRecord(source, "bookmark_unresolved", { bookmark: h.anchor }));
      }
    }
  }

  /* word/embeddings/* -> intra, content-addressed. Located back to a
   * paragraph through the rels id when the body uses it; else source:null.
   * The identity is taken as the member streams (R43), never from the member held whole. */
  const embeddingRids = new Map(); // resolved part name -> rel id (document rels)
  for (const bp of parts.rels.byPart) {
    if (bp.part !== docRelsPart) continue;
    for (const r of bp.relationships) {
      if (r.external || !r.target) continue;
      const resolved = resolveRelTarget(bp.part, r.target);
      if (resolved.startsWith(EMBEDDINGS_DIR)) embeddingRids.set(resolved, r.id);
    }
  }
  const embedded = [];
  for (const entry of parts.container.entries) {
    const name = normalizePartName(entry.name);
    if (!name.startsWith(EMBEDDINGS_DIR) || name === EMBEDDINGS_DIR) continue;
    embedded.push(name);
  }
  const identities = await memberIdentities(parts.bytes, embedded);
  for (const name of embedded) {
    const rid = embeddingRids.get(name) ?? null;
    const at = rid != null && walk ? walk.ridUsage.get(rid) ?? null : null;
    const source = at ? docParaRef(at.para, at.run) : null;
    const read = identities.get(name);
    if (!read?.ok) {
      links.push(undeterminedRecord(source, "embedded_part_unreadable", { part: name, detail: read?.why ?? "unreadable",
        ...(read?.limit != null ? { limit: read.limit } : {}) }));
      continue;
    }
    links.push({
      partition: "intra",
      wrapper: linkWrapper.intra(read.sha256),
      target: { sha256: read.sha256, name: name.slice(name.lastIndexOf("/") + 1), bytes: read.size },
      source,
    });
  }

  const counts = { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 };
  for (const l of links) counts[l.partition]++;

  /* ---- the evidentiary envelope (DEC-5, filed against I2 as IC-2) ---- */
  const items = [];
  if (walk) {
    for (const c of walk.changes) {
      const item = {
        kind: "tracked-change",
        change: c.change,
        author: c.author,
        date: c.date,
        source: docParaRef(c.para, c.run),
      };
      if (c.change === "deletion") item.superseded = c.text; // THE SUPERSEDED WORDING
      else item.text = c.text;
      items.push(item);
    }
  }
  const evUndetermined = [...parts.undetermined, ...parts.partials];
  if (parts.guard) evUndetermined.push({ part: parts.mainPart, why: "over_size_bound", guard: parts.guard });
  if (bodyFailure) evUndetermined.push({ part: parts.mainPart, ...bodyFailure });
  if (parts.commentsXml != null) {
    const parsed = await parseComments(parts.commentsXml, yieldNow);
    if (!parsed.ok) evUndetermined.push({ part: COMMENTS_PART, why: parsed.why, ...(parsed.final ? { final: true } : {}) });
    else {
      for (const c of parsed.comments) {
        const at = walk && c.id != null ? walk.commentRefs.get(c.id) ?? null : null;
        items.push({
          kind: "comment",
          id: c.id, author: c.author, date: c.date, initials: c.initials, text: c.text,
          source: at ? docParaRef(at.para, at.run) : null,
        });
      }
    }
  }
  if (parts.core) {
    items.push({
      kind: "core-properties",
      creator: parts.core.creator, lastModifiedBy: parts.core.lastModifiedBy,
      revision: parts.core.revision, revisionNumber: parts.core.revisionNumber,
      created: parts.core.created, modified: parts.core.modified, title: parts.core.title,
      source: null,
    });
  }
  const evCounts = {};
  for (const it of items) evCounts[it.kind] = (evCounts[it.kind] ?? 0) + 1;
  const evidentiary = {
    container: "docx",
    kinds: [...new Set(items.map((it) => it.kind))],
    items,
    undetermined: evUndetermined,
    counts: evCounts,
  };

  return {
    ok: true,
    container: "docx",
    paragraphs: walk ? walk.paragraphs.length : null, // null = honestly unknown
    links,
    counts,
    evidentiary,
    notes,
  };
}


/* ------------------------------------------------------------------ *
 * text() — <w:t> runs in body order (I7 slot 4)
 * ------------------------------------------------------------------ */

/** N724 (R11, K1972) — a table's cells held as R30 holds a sheet's, so a
 *  document table's date or amount column can be named as a sheet's is. One
 *  entry per cell holding text, in row then column order; `value` is the
 *  cell's text exactly as `document` carries it (its non-empty paragraphs
 *  newline-joined: `w:ins` in, `w:delText` never), taken from the body walk's
 *  own paragraphs, never a second reading. A Word table declares no cell type,
 *  so every cell is `text`, `declared`, `cached` and `formula` null: no date or
 *  number is inferred (R30's rule, R24).
 *
 *  N758 (R11, K2118): `paras` names the paragraphs `value` was read from, by
 *  their `para` ordinals, in reading order: the cell's non-empty paragraphs,
 *  a vertically merged cell's continuations included after its restart's, so
 *  `value` is exactly their texts newline-joined and a reader finds a cell's
 *  paragraphs without matching its lines. */
function tableCells(t, paragraphs) {
  const cells = [];
  for (const c of t.cells) {
    const paras = c.paras.filter((p) => paragraphs[p]?.text);
    if (!paras.length) continue;
    cells.push({ source: docTableRef(t.table, `${columnLetters(c.col)}${c.row}`),
      value: paras.map((p) => paragraphs[p].text).join("\n"), type: "text",
      declared: null, cached: null, formula: null, paras });
  }
  return cells;
}

/** The refusal text() and structure() give a body the walk could not or may not read: the main part unread, with the
 *  reason, the same on every call. */
function bodyRefused(reason) {
  return { ok: true, container: "docx", document: null, paragraphs: [], tables: null,
    undetermined: [reason], counts: { chars: 0, undetermined: 1, scanned_bytes: 0 } };
}

async function docxText(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "docx", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  if (parts.guard) {
    /* Over the streamed ceiling: the sizeGuard marker carried VERBATIM (COFF-2
     * shaped it for exactly this), never a silent truncation. */
    return {
      ok: true, container: "docx", document: null, paragraphs: [], tables: null,
      undetermined: [parts.guard],
      counts: { chars: 0, undetermined: 1, scanned_bytes: 0 },
    };
  }
  const yieldNow = opts?.yieldNow;
  /* The body walked: whole (its XML in hand) or, over the bound, in pieces (R35): the body walk and the tables walk
     are fed by ONE scan, so the part is never held and read once (R42). */
  /* R44 (cause 11a): refused before the body was held, by the count parts() made in pieces; the same answer the walk gives. */
  if (parts.refused) return bodyRefused({ part: parts.mainPart, ...parts.refused });
  if (parts.documentBytes == null && parts.documentXml == null && !parts.stream) {
    const stated = parts.undetermined.find((u) => u.part === parts.mainPart);
    return bodyRefused({ reason: "main_part_unreadable", part: parts.mainPart, ...(stated ? stripOk(stated) : { why: "unreadable" }) });
  }
  const w = createDocWalk({ paragraphText: true, refs: true });
  const run = await runBody(parts, w, yieldNow);
  /* R44: the walk would retain more than the table's figures: refused, by name and with its figure. */
  if (w.meter.exceeded) return bodyRefused({ part: parts.mainPart, ...w.meter.exceeded });
  if (!run.ok) return bodyRefused({ reason: "main_part_unreadable", part: parts.mainPart, ...stripOk(run) });
  const walk = w.body();
  const tablesDone = w.tables();
  let scanned = run.scanner.scanned + (parts.precounted ?? 0);
  const undetermined = [...parts.partials, ...scanNotes(parts.mainPart, run.scanner)];

  /* the walk made the paragraphs as they are answered (`refs`), so no second list of 200,000 objects is held beside the first (R44's margin) */
  const paragraphs = walk.paragraphs;
  const document = paragraphs.map((p) => p.text).filter((t) => t.length).join("\n");
  /* FW-19 / IC-124: the `doc-table` units — the bound the arm is checked
     against. An EMPTY list is a real zero (the body was walked and held no
     table). Read in pieces, a table lists no `cells` (null, as a body not read lists
     no tables): they are the copies of the paragraphs' text a large body
     cannot also carry (R35). */
  const tables = tablesDone
    .filter(Boolean)
    .map((t) => ({ table: t.table, ref: docTableRef(t.table).ref, rows: t.rows, cols: t.cols,
      cells: parts.stream ? null : tableCells(t, walk.paragraphs) }));
  /* R45: past the caller's cap (reading-pipeline's 512 KiB) the cells of every table are omitted with a statement; the
     paragraphs and `document` still carry every cell's text. */
  const cap = typeof opts?.inlineCellsMax === "number" && Number.isFinite(opts.inlineCellsMax) && opts.inlineCellsMax >= 0
    ? opts.inlineCellsMax : null;
  if (cap != null && !parts.stream) {
    let size = 0;
    for (const t of tables) size += jsonBytes(t.cells);
    if (size > cap) {
      for (const t of tables) { t.cells = null; t.cells_omitted = true; }
      undetermined.push({ part: parts.mainPart, why: "cells_omitted", size, bound: cap });
    }
  }

  /* R39: a paragraph whose only content is a picture lists the picture (`images`) and states it unread; no OCR is called. */
  for (const [p, rid] of walk.images) {
    if (!walk.paragraphs[p]?.text) undetermined.push({ part: parts.mainPart, why: "image_unread", ref: docParaRef(p), ...(rid ? { rid } : {}) });
  }

  /* R38: every other piece of text in the file is a unit with its kind. */
  const kinds = { header: [], body: [], footnote: [], endnote: [], footer: [], comment: [] };
  const refAt = (at) => (at ? docParaRef(at.para, at.run) : null);
  for (const x of parts.extras) {
    const r = await readUnits(parts, x.part, x.kind === "footnote" || x.kind === "endnote" ? x.kind : null, yieldNow);
    if (!r.ok) { undetermined.push({ part: x.part, ...stripOk(r) }); continue; }
    scanned += r.scanner.scanned;
    undetermined.push(...scanNotes(x.part, r.scanner));
    if (r.partial) undetermined.push(r.partial);
    if (x.kind === "header" || x.kind === "footer") {
      const text = r.units[0]?.text ?? "";
      if (!text) continue;
      const hr = walk.headerRefs.find((h) => h.rid != null && h.rid === x.rid);
      kinds[x.kind].push({ kind: x.kind, ref: x.part, part: x.part, text, ...(hr && hr.para != null ? { anchor: docParaRef(hr.para, hr.run) } : {}) });
      continue;
    }
    const into = x.kind === "footnote" ? walk.footnoteRefs : walk.endnoteRefs;
    for (const u of r.units) {
      if (!u.text || /^(separator|continuationSeparator|continuationNotice)$/.test(u.attrs.type ?? "")) continue;
      const anchor = refAt(u.attrs.id != null ? into.get(u.attrs.id) : null);
      kinds[x.kind].push({ kind: x.kind, ref: u.attrs.id != null ? `${x.kind} ${u.attrs.id}` : null, part: x.part, text: u.text, ...(anchor ? { anchor } : {}) });
    }
  }
  if (parts.commentsXml != null) {
    const parsed = await parseComments(parts.commentsXml, yieldNow);
    if (!parsed.ok) undetermined.push({ part: COMMENTS_PART, why: parsed.why, ...(parsed.final ? { final: true } : {}) });
    else {
      scanned += parsed.scanned;
      undetermined.push(...scanNotes(COMMENTS_PART, parsed.scanner));
      for (const c of parsed.comments) {
        const anchor = refAt(c.id != null ? walk.commentRefs.get(c.id) : null);
        if (c.text) kinds.comment.push({ kind: "comment", ref: c.id != null ? `comment ${c.id}` : null, part: COMMENTS_PART, text: c.text, ...(anchor ? { anchor } : {}) });
      }
    }
  } else {
    const stated = parts.undetermined.find((u) => u.part === COMMENTS_PART);
    if (stated) undetermined.push(stated);
  }
  for (const c of walk.changes) {
    if (c.change === "deletion" && c.text) kinds.body.push({ at: [c.para, c.run ?? -1], u: { kind: "tracked_deletion", ref: docParaRef(c.para, c.run), part: parts.mainPart, text: c.text } });
  }
  /* R38 (G166): a text box's piece names the paragraphs it holds, so a reader takes their words from the piece only. */
  for (const box of walk.textBoxes) {
    const text = box.paras.map((p) => walk.paragraphs[p]?.text ?? "").filter(Boolean).join("\n");
    if (text) kinds.body.push({ at: [box.paras[0] ?? 0, -1], u: { kind: "text_box", ref: docParaRef(box.paras[0] ?? 0), part: parts.mainPart, text, paras: [...box.paras] } });
  }
  kinds.body.sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
  for (const x of parts.undetermined) if (x.why === "part_unread" && !undetermined.includes(x)) undetermined.push(x);

  return {
    ok: true, container: "docx", document, paragraphs, tables,
    parts: addressParts([...kinds.header, ...kinds.body.map((b) => b.u), ...kinds.footnote, ...kinds.endnote, ...kinds.footer, ...kinds.comment]),
    undetermined,
    counts: { chars: document.length, undetermined: undetermined.length, scanned_bytes: scanned },
    ...(parts.piecewise ? { piecewise: parts.piecewise } : {}),
  };
}


/* ------------------------------------------------------------------ *
 * R31 (B §(d) EVENTS 3; K1505 (11)) — what the file states about itself
 * ------------------------------------------------------------------ */

/** `text()`'s `metadata`: the core-properties item's author and dates exactly
 *  as `docProps/core.xml` writes them (W3CDTF strings unchanged), or NULL when
 *  there is no readable core part. A part present but unreadable also yields
 *  its marker for `text().undetermined`; an ABSENT part yields none, because
 *  absence is normal OPC (ooxml R19). This states, never asserts an act (R24).
 *  Shared by the three OOXML entries — one builder, so they cannot drift. */
export function coreMetadata(parts, withTitle = false) {
  if (parts?.core) {
    const c = parts.core;
    const metadata = { author: c.creator ?? null, lastModifiedBy: c.lastModifiedBy ?? null,
      created: c.created ?? null, modified: c.modified ?? null, source: CORE_PROPERTIES_PART };
    /* R34: docx and pptx only; the key is absent, never null, for a missing, empty or blank title. */
    if (withTitle && typeof c.title === "string" && c.title.trim() !== "") metadata.title = c.title;
    return { metadata, marker: null };
  }
  const stated = Array.isArray(parts?.undetermined) ? parts.undetermined.find((u) => u.part === CORE_PROPERTIES_PART) : null;
  return { metadata: null,
    marker: stated ? { reason: "metadata_unreadable", part: CORE_PROPERTIES_PART, why: stated.why } : null };
}

/** Carry `metadata` onto an ok text() result; a marker joins `undetermined`
 *  and its count. */
export function withMetadata(out, parts, withTitle = false) {
  if (!out || !out.ok) return out;
  const { metadata, marker } = coreMetadata(parts, withTitle);
  if (!marker) return { ...out, metadata };
  return { ...out, metadata, undetermined: [...out.undetermined, marker],
    counts: { ...out.counts, undetermined: out.counts.undetermined + 1 } };
}

/* ------------------------------------------------------------------ *
 * R32 (K1888, K1903) — what in the file can act when it is opened
 * ------------------------------------------------------------------ */

const HYPERLINK_REL_RE = /\/relationships\/hyperlink$/;

/** The `active` list: every part of the file that can act when it is opened,
 *  FOUND AND READ, NEVER RUN. One item per finding, in central-directory
 *  order of its part, and within one `.rels` part in that part's order. It
 *  reads only names, `.rels` parts and the VBA project (through `ooxml`, whose
 *  part cap every read passes, R12), so it stands over the text guard too.
 *  `dir` is the format's own directory (`word/`, `ppt/`, `xl/`). An item says
 *  the file CAN act, never that it is malicious (R24); a `.rels` part that
 *  could not be read is an `unread` item, so an empty list is a finding and
 *  never a walk that missed. Shared by the three OOXML entries — one builder,
 *  so their lists cannot drift. */
export async function activeContent(bytes, container, rels, dir) {
  /* walkRels' results, by part, in its own order (a duplicated name keeps
     each of its readings in turn). */
  const relsOf = new Map();
  const queue = (part, r) => { if (!relsOf.has(part)) relsOf.set(part, []); relsOf.get(part).push(r); };
  for (const bp of rels.byPart) queue(bp.part, { relationships: bp.relationships });
  for (const u of rels.undetermined) queue(u.part, { why: u.why });

  const active = [];
  for (const entry of container.entries) {
    const part = normalizePartName(entry.name);
    if (!part || part.endsWith("/")) continue;
    const last = part.slice(part.lastIndexOf("/") + 1);
    if (last.toLowerCase() === "vbaproject.bin") {
      const v = await readVbaProject(bytes, container, part);
      /* `undetermined`: the modules whose source ooxml could not read, so a
         partial read never reads as complete (K1916). */
      active.push(v.ok
        ? { kind: "vba-project", part, read: true, why: null, project: v.project,
            modules: v.modules.map((m) => m.name), autoRun: v.autoRun, suspicious: v.suspicious,
            undetermined: v.undetermined }
        : { kind: "vba-project", part, read: false, why: v.why, project: null,
            modules: null, autoRun: null, suspicious: null, undetermined: null });
    }
    /* A part under `_rels/` is never itself an ActiveX, OLE or embedded
       item: it yields its own external-target items below (K1916). */
    const inRels = /(^|\/)_rels\//.test(part);
    if (!inRels && part.startsWith(`${dir}activeX/`)) active.push({ kind: "activex", part });
    else if (!inRels && part.startsWith(`${dir}embeddings/`)) {
      active.push({ kind: /^oleobject/i.test(last) ? "ole-object" : "embedded-file", part });
    } else if (dir === "xl/" && part.startsWith("xl/macrosheets/")) active.push({ kind: "xl4-macrosheet", part });
    const read = relsOf.get(part)?.shift();
    if (!read) continue;
    if (read.why != null) { active.push({ kind: "unread", part, why: read.why }); continue; }
    for (const r of read.relationships) {
      if (r.external && !HYPERLINK_REL_RE.test(r.type ?? ""))
        active.push({ kind: "external-target", part, type: r.type, target: r.target });
    }
  }
  return active;
}

/** Carry R32's `active` and R33's `variant` onto an ok structure() or text()
 *  result: both are the parts read once, so the two answers carry the same
 *  list. `variant` is the macro-enabled flavour (`"docm"`), null for a plain
 *  file. */
export function withActive(out, parts) {
  if (!out || !out.ok) return out;
  return { ...out, variant: parts.variant ?? null, active: parts.active };
}

/** `detect(null, contentType)` for an OOXML entry: `likely` for the plain
 *  type and for each macro-enabled twin's (R2, R33), with `format` always the
 *  entry's own; else null. Exact equality, never case-folded (R2). */
export function detectByContentType(format, plainType, twins, contentType) {
  if (contentType === plainType) {
    return { format, confidence: "likely", signals: [`content type "${contentType}"`] };
  }
  const variant = typeof contentType === "string" ? twins.get(contentType) : undefined;
  if (variant) {
    return { format, confidence: "likely", signals: [`content type "${contentType}"`,
      localize("office-readers.docx.the_macro_enabled_flavour_variant", "the macro-enabled flavour {variant}, read as {format} (R33)", { variant: String(variant), format: String(format) })] };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The I7 entry
 * ------------------------------------------------------------------ */

export const docxEntry = {
  format: "docx",
  detect(bytes, contentType) {
    if (bytes) {
      if (!hasZipMagic(bytes)) return null;
      /* Sync, so the central directory NAMES are the strongest honest signal:
       * an OPC content-type map plus the conventional main part. At the 1 KiB
       * acquire seam there is no EOCD, readContainer refuses, and this entry
       * answers null — ZIP magic alone NEVER claims a docx. */
      const container = readContainer(bytes);
      if (!container.ok) return null;
      if (container.byName.has(CONTENT_TYPES_PART) && container.byName.has(MAIN_PART)) {
        return {
          format: "docx", confidence: "likely",
          signals: [
            "magic: PK\\x03\\x04 with a readable central directory",
            `part: ${CONTENT_TYPES_PART} present`,
            `part: ${MAIN_PART} present`,
            "likely, not certain: the OPC content-type declaration is deflated — parts() discriminates",
          ],
        };
      }
      return null;
    }
    return detectByContentType("docx", DOCX_CONTENT_TYPE, DOCX_TWIN_CONTENT_TYPES, contentType);
  },
  parts: (bytes) => docxParts(bytes),
  structure: async (partsOrBytes, opts) => {
    /* Accept either parts() output or raw bytes, so detect→structure works
     * uniformly at the registry seam (formats.test.mjs's stub pattern) while
     * a caller that already paid for parts() does not pay twice. */
    const parts = isBytes(partsOrBytes)
      ? await docxParts(partsOrBytes)
      : partsOrBytes;
    return withActive(await docxStructure(parts, opts), parts);
  },
  /* `opts.inlineCellsMax` (R45), `opts.yieldNow` (R42) */
  text: async (partsOrBytes, opts) => {
    const parts = isBytes(partsOrBytes)
      ? await docxParts(partsOrBytes)
      : partsOrBytes;
    /* FW-19 / IC-124: `images` — every image under word/media/, content-
       addressed, exhaustive or NULL (ooxml.mjs's `containerImages`). */
    return withContainerImages(withActive(withMetadata(await docxText(parts, opts), parts, true), parts), parts, "word/media/");
  },
};
