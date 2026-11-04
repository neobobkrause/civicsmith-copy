/* reader-contract (its R45–R58, R60–R67; split from `reading-pipeline` by BOB, 4 Nov 2026, PR 274, the code moved word for word):
   the reader contract over a range source (`plan`, `rangeSource`), the cursors and the advance rule, units chunked and never cut
   and their kinds, completeness from the counters, the one decoding rule, the readers of the light kinds in byte windows and of
   HTML in one streaming pass (`html.mjs`), the named refusals and their figures, the evidence read (`bytesOf`, `cellsInRange`) and
   a reading's parts (`partsOf`, `interpretUnits`). It never imports `reading-pipeline`: `interpretUnits` is handed the reader
   it reads a document's units with (`{read}`), and `reading-pipeline` re-exports every name it exported before the split, so
   its callers see nothing change. Ids named here without a module are `reading-pipeline`'s. */
import { layerChain, appendStep, describeChain, checkChain, checkAnchor, applyConfidenceFloor, mergedChain,
         convertedChain, readingSource, mergeTier2Text, tier2Note, glyphCount, stepCovers } from "../textchain.mjs";
import { getFormat, readingDialect, detectFormat, formatNameFor } from "../formats.mjs";
import { identify, doctypeFor, doctypeForYielding, readText } from "../../../docprofile/registry.mjs";
import { extractPdfRange, openPdfRange } from "../pdfstructure.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf, statement, READ_BOUNDS } from "../read-bounds.mjs";
import { decodeText } from "../ooxml.mjs";
import { decodeReferences, visibleTextOfHtml, visibleTextOfHtmlYielding, visibleTextOfHtmlStream } from "./html.mjs";

export { visibleTextOfHtml };

/* gives the object's thread back (the same turn `reading-pipeline`'s `readingprov.mjs` gives) */
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

/* ===================================================================== *
 * The bounds (R15).
 * ===================================================================== */

/* REC-91: how much of a capture's text the reading's wire answer may carry. Half of `op=promote`'s INLINE_MAX
   (1 MiB), so JSON escaping and the rest of the acquire document cannot push a promotion over it. */
export const ACQUIRE_TEXT_UNITS_BUDGET = 512 * 1024;
/* What one unit costs the wire BESIDE its text: its extent, its seq and its keys as a caller serialising with
   `JSON.stringify(doc, null, 1)` spends them. Charged per unit, so twenty thousand short paragraphs cannot pass the
   byte budget on their words and blow INLINE_MAX on their punctuation. The smallest chargeable unit is 1 + 128 B, so
   this wire emits at most floor(524288 / 129) = 4,064 units: under the index's own unit bound (extraction R22's 4,096), which
   is why no second unit check sits in the loop (REC-111). */
export const ACQUIRE_TEXT_UNIT_ENVELOPE = 128;
/* CONTENT-SEARCH-DESIGN §4.3: one indexed unit's text is stored to this many characters (M-20: 6.2x the largest
   unit its census produced). The wire cuts a unit to it before charging it (D-685), and the index writer caps at the
   same number (extraction R22): one number, so the wire never pays for text the index discards. */
export const CAPTURE_TEXT_UNIT_CAP = 128 * 1024;
/* R2: a multi-part capture (streamed in 8 MiB parts, the whole never stored under its own digest) is assembled for
   its format entry only up to this many bytes: the office entries' measured text bound (M-20's 20 MiB, `ooxml.mjs`),
   which every entry in the registry guards at or under. Over it the capture is not read, and the reading says so. G124 (fix round 9):
   quoted from `READ_BOUNDS`, the office text row (its alpha, the measured 20 MiB), never a literal here. */
export const MULTIPART_READ_MAX = boundOf("office", "text_bytes");
/* R37 (fix round 4b, F10; K4487): the largest whole the object holds to read, measured under workerd with the object's
   128 MB (build/jobs/T51/cause-reading-4.md, step 0): the reading's heap grows with the pages (about 25 MB + 0.031 MB a
   page), and the whole's bytes sit beside it. A whole over this is never loaded: the reading is `final` and says its size. G124 (fix
   round 9): quoted from `READ_BOUNDS`, the PDF byte row (its alpha, today's 24 MiB, K4831 (3)); a refusal states it with the size
   (`statement`). */
export const WHOLE_READ_MAX = boundOf("pdf", "bytes");
/* R66 (T53-124): a text kind is refused above the text bound (100 MB, the active figure), but it is read whole only up to the measured whole-read figure, the text row's alpha
   (24 MiB, quoted from `READ_BOUNDS`); a text between the two is read in byte windows with a carry (R50, R51), never held whole. */
export const TEXT_WINDOW_FROM = READ_BOUNDS.text.bytes.alpha;
/* The same measured figure for a CSV (K4868): the PDF byte row's alpha, 24 MiB, what a whole read held before the beta lifted the active figure (WHOLE_READ_MAX) to the standard's 100 MB; a CSV above it
   and within its own bound (50 MB) is read by range, never held whole. */
export const CSV_WINDOW_FROM = READ_BOUNDS.pdf.bytes.alpha;
const WHOLE_READ_ROW = ["pdf", "bytes"];
/* R37 (D4): why a reading failed, as `reading.failure`. `transient`: the cause is outside the document (the store did not
   answer, a member was down or answered 5xx, an entry threw), so a later read can succeed; `final`: the document's own
   content, or its size, so reading it again cannot. A reading that is not a failed one carries neither. */
export const FAILURE_TRANSIENT = "transient";
export const FAILURE_FINAL = "final";
/* R28, R44 (fix round 6, G41; K4636, K4642): the most a workbook's or a CSV's typed cells may weigh in the reading, as the entry's
   own JSON of them, before the entry holds them in the file instead (`cells` null, `cells_held` true). The cap is OPT-IN: `read`
   passes it where it calls an entry (`{inlineCellsMax}`), and an entry called without it lists every cell. 512 KiB is about
   3,500 cells, leaving the reading's other keys room under the 1 MiB a stored reading may hold. */
export const INLINE_CELLS_MAX_BYTES = 512 * 1024;
/* R44: the reasons `cellsInRange` answers when it makes no cells. */
export const CELLS_NOT_INTERPRETABLE = "cells_not_interpretable";
export const BYTES_NOT_HELD = "bytes_not_held";

/* ===================================================================== *
 * Tier 2 (R3).
 * ===================================================================== */

/* D-665 (BOB #35, 2026-09-25 06:25Z): `image_unread` says an image is painted and its content unread; it is not an
   undecoded character and counts 0. Two readers judge the DECODE by the marker count (`needsTier2` and docprofile's
   `readText`), so both are handed the text with those markers taken out and the count lowered by as many. The
   markers stay on the text itself. N253 (R3, R11): pdf-reader emits one per painted image (its R34), so without this
   a photo page would escalate to tier 2, which reads no image. */
export function decodeView(text) {
  const marks = text && Array.isArray(text.undetermined) ? text.undetermined : null;
  if (!marks || !marks.some((m) => m && m.reason === "image_unread")) return text;
  const keep = (a) => (Array.isArray(a) ? a.filter((m) => !(m && m.reason === "image_unread")) : a);
  const undetermined = keep(marks);
  const c = text.counts;
  return { ...text, undetermined,
           ...(Array.isArray(text.pages) ? { pages: text.pages.map((p) => (p ? { ...p, undetermined: keep(p.undetermined) } : p)) } : {}),
           ...(c && typeof c.undetermined === "number"
             ? { counts: { ...c, undetermined: c.undetermined - (marks.length - undetermined.length) } } : {}) };
}

/* R3: a PDF escalates to the pdf-worker only when tier 1 got essentially nothing: more undetermined regions than
   glyphs of the text in hand (D-514: glyphs, never raw characters; `counts.chars` only when there is no document
   string), unless every marker is a scan marker, since tier 2 reads no image (CPDF-10; D-627's image-content
   markers are scan markers too). A mixed document still escalates. A missing or malformed text escalates nothing. */
/* The reading's memory (R2): a PDF's `document` is its pages' non-empty text joined by a newline (pdf-reader R2), held
   as a lazily-joined string until something reads it, and reading it makes a second flat copy of the whole book (two
   bytes a character once one page holds a character past U+00FF). When the pages are held beside it and the document's
   length is exactly theirs joined, the glyphs are counted over the pages and the document is never read. */
function pagesJoinLength(text) {
  const pages = text && Array.isArray(text.pages) ? text.pages : null;
  if (!pages || !pages.length || typeof text.document !== "string") return false;
  let n = 0, held = 0;
  for (const p of pages) {
    const t = p && typeof p.text === "string" ? p.text : "";
    if (t.length) { n += t.length; held++; }
  }
  return held > 0 && n + held - 1 === text.document.length;
}
export function glyphsOfDocument(text) {
  if (!text || typeof text.document !== "string") return null;
  return pagesJoinLength(text) ? text.pages.reduce((n, p) => n + (p && typeof p.text === "string" ? glyphCount(p.text) : 0), 0)
                               : glyphCount(text.document);
}
/* The same text without the joined copy, for the stages that read it whole (`docprofile.readText` joins the pages
   itself when the document is absent, R38), or the text itself when its document is not the pages joined. */
export function withoutJoinedDocument(text) {
  if (!pagesJoinLength(text)) return text;
  const { document, ...rest } = text;
  return rest;
}
/* R46: the reason a piece that advanced nothing ends its entry with. */
export const NO_PROGRESS = "NO_PROGRESS";
export const PASSWORD_REQUIRED = "PASSWORD_REQUIRED";
export const ENCRYPTED = "ENCRYPTED";
/* R46: the code pdf-worker's marker in a text's `undetermined` states (password_required before encrypted), or null */
export const encryptedReasonOf = (text) => {
  const marks = text && Array.isArray(text.undetermined) ? text.undetermined : [];
  return marks.some((m) => m && m.reason === "password_required") ? PASSWORD_REQUIRED
    : marks.some((m) => m && m.reason === "encrypted") ? ENCRYPTED : null;
};

/* ===================================================================== *
 * Text units (R15).
 * ===================================================================== */

/* REC-91 (R15): the indexable units of a capture's final text, recognised by SHAPE: one per page (`pages[]`, a
   `pdf-page` extent with the rect null, the whole page), paragraph (`paragraphs[]`, `doc-para`) or slide (`slides[]`,
   `slide-shape` with the shape omitted, the whole slide, Bob 2026-09-15) holding a glyph (D-531), its extent in the
   producer's own numbering and `seq` its position. An absent list and an empty one are different answers: no unit
   list is null.
   THE WIRE'S BUDGET: at most ACQUIRE_TEXT_UNITS_BUDGET, each unit charged its UTF-8 bytes plus the envelope.
   D-685 (R15): a unit is cut to CAPTURE_TEXT_UNIT_CAP before it is charged, and the cut is said (`truncated`), so
   the prefix the index receives is the prefix it would keep. A unit whose capped prefix does not fit what remains is
   left out, and every unit left out is NAMED (D-724, BOB #36 2026-09-25 11:20Z, option (b)): as runs of consecutive
   skipped units (first and last extent and seq, a count), because the keys ride in `data/provenance.json` under
   INLINE_MAX; a capture sends at most ~1,018 runs.
   N108 (R15, retrieval R25, D-672): a workbook's unit is its SHEET, `sheet-range` at the whole used range its reader
   names (`sheets[].range`, `usedSheetRange` in the xlsx, ods and csv entries); a sheet whose range the reader could
   not name is no unit, never a guessed rectangle. A workbook's defined names and tables are not units here. */
const sheetRangeOf = (u) => {
  const r = u.range;
  return r && r.kind === "sheet-range" && typeof r.sheet === "string" && r.sheet && typeof r.range === "string" && r.range
    ? { sheet: r.sheet, range: r.range } : { sheet: null, range: null };
};
/* R47 (fix round 9, G134d; K4831 (7)): the closed list of a unit's kinds. A reader's body units are `body`; every other part it
   emits (`office-readers` R38, `odf-reader` R53: `parts: [{kind, ref, part, text, hidden?}]`) is a unit of its own kind, its extent
   `{kind: "doc-part", part, ref}` (the package part and the element reference the reader names), so it reaches the index, the hit and
   the citation with its kind. A part whose kind is not in the list is read as `body`, never dropped. */
export const UNIT_KINDS = Object.freeze(["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box",
  "speaker_note", "master_text", "cell_note"]);
const kindOf = (k) => (UNIT_KINDS.includes(k) ? k : "body");
/* A sheet's `lineRows` when it names one 1-based row per line of its text, else null. */
const lineRowsOf = (sheet, lines) => (sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === lines
  && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null);
const linesIn = (t) => { let n = 1; for (let i = t.indexOf("\n"); i >= 0; i = t.indexOf("\n", i + 1)) n++; return n; };
/* Every unit of the text, before the wire's cap and budget: null when the text has no unit list. */
export function allUnitsOf(i2text) {
  if (!i2text) return null;
  /* R47 (G166; K4985): a paragraph a part names in its `paras` (`office-readers` R38: indices into `paragraphs`) is that part's words
     alone, so it is no body unit; its number stays what it was. */
  const named = new Set();
  for (const p of Array.isArray(i2text.parts) ? i2text.parts : [])
    if (p && typeof p === "object" && Array.isArray(p.paras)) for (const n of p.paras) if (Number.isInteger(n) && n >= 0) named.add(n);
  /* R47 (G166; K4987): a slide's body unit is its `bodyText` (the text outside its text boxes, '' for a box-only slide) when the entry
     states one, else its `text`. */
  const arm = (list, kind, fields, skip = null, textOf = (u) => u.text) => (Array.isArray(list) ? list : [])
    .map((u, i) => (u && typeof u === "object" && typeof textOf(u) === "string" && glyphCount(textOf(u)) > 0 && !(skip && skip.has(i))
      ? { extent: { kind, ...fields(u, i) }, seq: i, text: textOf(u), kind: "body", ...(u.hidden === true ? { hidden: true } : {}) } : null))
    .filter(Boolean);
  const body = Array.isArray(i2text.pages)      ? arm(i2text.pages, "pdf-page",
        (u, i) => ({ page: Number.isInteger(u.page) ? u.page : i, rect: null }))
    : Array.isArray(i2text.paragraphs) ? arm(i2text.paragraphs, "doc-para",
        (u, i) => ({ para: Number.isInteger(u.para) ? u.para : i, run: null }), named)
    : Array.isArray(i2text.slides)     ? arm(i2text.slides, "slide-shape",
        (u, i) => ({ slide: Number.isInteger(u.slide) ? u.slide : i, shape: null }), null, (u) => (typeof u.bodyText === "string" ? u.bodyText : u.text))
    : Array.isArray(i2text.sheets)     ? arm(i2text.sheets, "sheet-range", sheetRangeOf)
        .filter((u) => u.extent.sheet !== null)
        /* R47 (G128h): a sheet's unit carries the row of each of its lines, so a hit names its row */
        .map((u) => { const rows = u.text.length <= CAPTURE_TEXT_UNIT_CAP ? lineRowsOf(i2text.sheets[u.seq], linesIn(u.text)) : null;
                      return rows ? { ...u, lineRows: rows } : u; })
    : null;
  const parts = Array.isArray(i2text.parts) ? i2text.parts : null;
  if (!parts) return body;
  const out = body ? [...body] : [];
  /* R11b (fix round 10): the next seq is found by a loop, never by spreading the units into `Math.max`, which overflows the stack for 120,000 units */
  let seq = 0;
  for (const u of out) if (u.seq >= seq) seq = u.seq + 1;
  for (const p of parts) {
    if (!(p && typeof p === "object" && typeof p.text === "string" && glyphCount(p.text) > 0)) continue;
    out.push({ extent: { kind: "doc-part", part: typeof p.part === "string" ? p.part : null, ref: typeof p.ref === "string" ? p.ref : null },
               seq: seq++, text: p.text, kind: kindOf(p.kind), ...(p.hidden === true ? { hidden: true } : {}) });
  }
  return out;
}
/* R47 (G128d): a unit over the cap as consecutive units of the same element, `run` 0, 1, ... in its extent, each broken at a space
   when one is near (`chunksOf`) and stating the words before its seam (`overlap`), so a phrase across a seam is found. A sheet is
   chunked by blocks of whole rows (R41), never here. Each chunk holds its own words of the text (a word split by the seam is one). */
function chunkedUnit(u) {
  if (u.text.length <= CAPTURE_TEXT_UNIT_CAP || u.extent.kind === "sheet-range") return [u];
  return chunkUnits(u.text).map((c, k) => withOwnWords({ ...u, extent: { ...u.extent, run: k }, text: c.text,
                                                        ...(k > 0 ? { overlap: c.overlap } : {}) }, c.lead));
}
/* R47 (G128d): `text` as chunks of at most the cap, `{text, overlap, lead}`: `overlap` the last two words before the seam (what a
   phrase crossing it needs, up to 256 characters), `lead` 1 when the chunk continues a word the chunk before it cut. */
export function chunkUnits(text, cap = CAPTURE_TEXT_UNIT_CAP) {
  const cs = chunksOf(text, cap);
  return cs.map((t, k) => {
    if (k === 0) return { text: t, overlap: "", lead: 0 };
    const before = cs[k - 1];
    const words = before.trimEnd().split(/\s+/);
    return { text: t, overlap: words.slice(-2).join(" ").slice(-256), lead: continuesWord(before, t) ? 1 : 0 };
  });
}
/* The UTF-8 length of a string, counted without encoding it (the wire charges every unit, and a book is thousands). */
export function utf8Length(s) {
  if (s.length < 4096) return utf8Range(s, 0, s.length);
  /* G82: the native encoder counts a long string a slice at a time, into a scratch buffer, with no copy of the string: a slice never ends between the
     halves of a pair, and a lone half is the three bytes of its replacement, as `utf8Range` counts it */
  let n = 0;
  for (let at = 0; at < s.length;) {
    let end = Math.min(s.length, at + UTF8_SLICE);
    if (end < s.length && (s.charCodeAt(end - 1) & 0xfc00) === 0xd800 && (s.charCodeAt(end) & 0xfc00) === 0xdc00) end++;
    n += UTF8_ENCODER.encodeInto(s.slice(at, end), UTF8_SCRATCH).written;
    at = end;
  }
  return n;
}
const UTF8_SLICE = 16 * 1024, UTF8_ENCODER = new TextEncoder(), UTF8_SCRATCH = new Uint8Array(UTF8_SLICE * 3 + 4);
/* The UTF-8 length of `s.slice(from, to)`, counted in place (a pair cut at `to` is a lone surrogate there, as in the slice). */
function utf8Range(s, from, to) {
  let n = 0;
  for (let i = from; i < to; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < to && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
    else n += 3;
  }
  return n;
}
/* R37 (F8): `budget` is the bytes the units may spend. The default is the acquire answer's (R15): the wire carries at
   most that. The index path (a held reading read again, a re-read) has no wire, so its caller hands `Infinity` and
   every unit is given; the index's own bound is the caller's (extraction R22). R47 (fix round 9, G128d): a unit over
   CAPTURE_TEXT_UNIT_CAP is carried as its chunks (`chunkedUnit`), a sheet over it as blocks of whole rows (R41), never cut. */
export function textUnitsFor(i2text, { budget: wireBudget = ACQUIRE_TEXT_UNITS_BUDGET } = {}) {
  let textUnits = null, textUnitsOverBound = 0, textUnitsSkipped = null;
  if (i2text) {
    const units = allUnitsOf(i2text);
    let budget = wireBudget, dropped = 0;
    const kept = [], runs = [];
    let run = null;
    const skip = (u) => {
      if (run) { run.last = u.extent; run.last_seq = u.seq; run.units++; return; }
      run = { first: u.extent, first_seq: u.seq, last: u.extent, last_seq: u.seq, units: 1 };
      runs.push(run);
    };
    const sheets = Array.isArray(i2text.sheets) ? i2text.sheets : [];
    for (const u0 of (units || [])) {
      const pieces = u0.extent.kind === "sheet-range" && u0.text.length > CAPTURE_TEXT_UNIT_CAP
        ? sheetBlocks(u0, sheets[u0.seq]).map(({ leadWords = 0, ...b }) => withOwnWords(b, leadWords)) : chunkedUnit(u0);
      for (const u of pieces) {
        /* A string's UTF-8 is never shorter than its length in UTF-16 units, so a unit that cannot fit even at one
           byte a unit is left out without being measured. */
        const size = u.text.length + ACQUIRE_TEXT_UNIT_ENVELOPE > budget ? Infinity : utf8Length(u.text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
        if (size > budget) { dropped++; skip(u); continue; }
        budget -= size; kept.push(u); run = null;
      }
    }
    textUnits = kept.length ? kept : null;
    textUnitsOverBound = dropped;
    textUnitsSkipped = runs.length ? runs : null;
  }
  return { textUnits, textUnitsOverBound, textUnitsSkipped };
}

/* R35 (T51 fix round 2, C17): the words of a text, a word being a run of non-whitespace holding a glyph. */
const SPACE = /\s/;
/* `\s` as the regular expression has it, by code unit (G82: a word count over a 17 MB text was most of a tick's compute with a
   regular expression to a character): the ASCII white space, and above U+009F the ones `\s` names. */
const isSpaceUnit = (c) => c === 0x20 || (c >= 0x9 && c <= 0xd) || (c >= 0xa0 && (c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a)
  || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff));
export function wordsIn(s) {
  if (typeof s !== "string") return 0;
  let n = 0, inWord = false;
  for (let i = 0; i < s.length; i++) {
    const w = !isSpaceUnit(s.charCodeAt(i));
    if (w && !inWord) n++;
    inWord = w;
  }
  return n;
}

/* R35 (fix round 6, G40; K4622): the words a carried unit holds of the text, counted once. A piece's unit can hold words the text
   has once: the header a sheet's later block repeats (R41) and the tail of a word a hard cut split (R41's runs). Those units are
   entered here with their own words, so the pieces' words add up to the text's, never past it; any other unit holds `wordsIn` of
   its text. A cut unit holds fewer words than the text had, as R35 states. */
const ownWords = new WeakMap();
const wordsOfUnit = (u) => ownWords.get(u) ?? wordsIn(u.text);
const withOwnWords = (u, lead) => { ownWords.set(u, Math.max(0, wordsIn(u.text) - lead)); return u; };
/* The words a chunk of a run adds: the word it continues from the chunk before is not a new one. */
const continuesWord = (before, chunk) => before.length > 0 && chunk.length > 0 && !SPACE.test(before[before.length - 1]) && !SPACE.test(chunk[0]);

/* R35: `{words_total, words_read}` of a text that has text units, else null. `words_total` is the words of every unit the
   text has plus the words an OCR region below its floor held (carried as a count on the page, `unread_words`, never
   as text); `words_read` is the words of the units `textUnitsFor` keeps, a unit cut to its cap by the prefix it keeps. They
   are equal when the whole text was read. */
export function textWordsFor(i2text, keptUnits = undefined, { budget, all: held } = {}) {
  const kept = keptUnits !== undefined ? keptUnits : textUnitsFor(i2text, { budget }).textUnits;
  if (!kept) return null;
  const all = held || allUnitsOf(i2text) || [];   /* `held`: the very list `allUnitsOf(i2text)` gave, handed by a caller that has it */
  const unread = (Array.isArray(i2text.pages) ? i2text.pages : [])
    .reduce((n, p) => n + (p && Number.isInteger(p.unread_words) && p.unread_words > 0 ? p.unread_words : 0), 0);
  const sum = (units) => units.reduce((n, u) => n + wordsOfUnit(u), 0);
  return { words_total: sum(all) + unread, words_read: sum(kept) };
}

/* ===================================================================== *
 * Text units of a capture read as text (R32).
 * ===================================================================== */

/* R32: a capture read as text through no format entry (R1) has no `paragraphs` list from an entry, so its units are
   drawn here from the decoded text: one `doc-para` per paragraph, a paragraph being a run of text between blank lines,
   numbered from 0 over all paragraphs in the text's order (`textUnitsFor` skips the ones with no glyph and keeps
   `seq` as the position, R15). Nothing is added to the format registry: this is the one site. */
/* R32: the units of text read as text. `html` is true for a capture whose detected format is `html`.
   R33 (T50; N1191 (a)): a text that is not HTML and holds no blank line but at least two non-empty lines is split at
   its line breaks: one unit per non-empty line (the line trimmed), `para` counting the non-empty lines from 0. A text
   with a blank line anywhere keeps its paragraphs (a wrapped paragraph is never split), a one-line text is one unit,
   and an HTML page is read by R32's rule. */
/* R51: a paragraph of an HTML page is its words with the runs of white space one space; the tab that tells a row's cells apart (html.mjs) stays, so a table keeps its columns */
const squashHtmlRun = (p) => p.replace(/[ \f\v\u00a0\r\n]+/g, " ").replace(/^[ ]+|[ ]+$/g, "");
const BLANK_LINE_RUN = /\r?\n[ \t\f\v\u00a0 ]*(?:\r?\n[ \t\f\v\u00a0 ]*)+/;
function paragraphsOfText(text, html) {
  const visible = html ? visibleTextOfHtml(text) : text;
  /* Runs between blank lines; a run of no character (the text's edges, a markup-only block) is no paragraph, so `para`
     counts the paragraphs the text has, from 0, and a page's leading blank does not shift it. */
  const runs = visible.split(BLANK_LINE_RUN);
  const lines = !html && runs.length === 1 ? runs[0].split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length) : [];
  const paragraphs = (lines.length >= 2 ? lines : runs
    .map((p) => (html ? squashHtmlRun(p) : p.trim()))
    .filter((p) => p.length))
    .map((p, para) => ({ para, text: p }));
  return { paragraphs };
}
export function textUnitsOfText(text, { html = false, budget } = {}) {
  if (typeof text !== "string" || !text) return { textUnits: null, textUnitsOverBound: 0, textUnitsSkipped: null };
  const paras = paragraphsOfText(text, html);
  return { ...textUnitsFor(paras, { budget }), paragraphCount: paras.paragraphs.length };
}
/* R35: the words of a capture read as text, over the text its units are drawn from. */
export function textWordsOfText(text, { html = false, budget } = {}) {
  if (typeof text !== "string" || !text) return null;
  const paras = paragraphsOfText(text, html);
  return textWordsFor(paras, textUnitsFor(paras, { budget }).textUnits);
}

/* ===================================================================== *
 * A reading in pieces (R40, R41).
 * ===================================================================== */

/* R40 (fix round 6, G13, G14; K4571, K4578): a reading too large for one answer is read whole, in pieces by a cursor, never
   in part without saying so. `read(document, {cursor, unitsBudget, maxUnits})`: with the `cursor` key passed (null for the
   first piece, else the string the piece before answered) the answer is one piece of the capture's units, in the grain R15,
   R32 and R33 give, within `unitsBudget` bytes (each unit charged as R15 charges it) and `maxUnits` units (default
   PIECE_UNITS_MAX, extraction R22's index bound), and carries `more`, `cursor` (null when `more` is false),
   `read_through` and `total` (bytes of the text the units are drawn from), and `piece = {units, words, units_total?}`. A
   unit's `seq` is its place in the capture's whole list, so a later piece continues the numbering. A piece holds at
   least one unit, so a cursor always moves. The first piece is the reading with its units; a later piece is its units
   alone (no `reading`). The cursor is opaque and names the capture's digest and the shape of what it points into; one that
   does not fit the bytes now in hand is refused, with `refused` and no reading. Without the `cursor` key `read` is as it was.
   R41 (G15): in this mode a text line or paragraph over CAPTURE_TEXT_UNIT_CAP is carried whole as consecutive units
   (extent `run` 0, 1, ...), never cut; a sheet whose text is over the cap is carried as blocks of whole rows. */
export const PIECE_UNITS_MAX = 4096;
/* G26 (fix round 6): a PDF is read in pieces by page ranges (pdf-reader's `extractPdfRange`, R43), the cursor a page. A range's
   structures are dropped before the next is read, so a tick holds the bytes and one range, and the whole is one parse, not one
   per piece. G56 (K4693, K4700): a range is sized by work as well as by pages: at most `PDF_RANGE_PAGES` pages and at most
   `PDF_RANGE_BYTES` of file at the document's bytes a page, at least one page, the byte term applied by `extractPdfRange`
   (`maxBytes`, passed on every tick, so one formula serves the first tick and the later ones). Measured at the plane's shape
   (`g26.probe.mjs`, BUDGET-2024-APP, 1,354 pages, 15.2 MiB, in a child of 112 MB), the first tick is about 3 s fixed + 0.04 s a
   page: 200 pages 11.0 s (G37, K4615, chose 200 for the parse-total bar of 1.5 and measured 8.2 s on another machine), 150 pages
   9.5 s, 125 pages 7.3 s, 100 pages 6.4-7.5 s, 75 pages 6.0 s; 100 pages of that volume weigh about 1.2 MB, so 1.3 MB leaves its
   pieces at 100 pages and shrinks a page-dense or scan-shaped volume's. The parse-total ratio rises with the pieces (each pays a
   fixed cost), 1.53 at 200 and 1.57 at 100. */
export const PDF_RANGE_PAGES = 100;
export const PDF_RANGE_BYTES = 1_300_000;
export const BARE_DIGEST = "BARE_DIGEST";
export const CURSOR_MISMATCH = "CURSOR_MISMATCH";
export const NOT_PIECEWISE = "NOT_PIECEWISE";
/* Sentences the refusals carry. Stand-ins until T52 (K4269): the nearest held rows; owed: `reading-pipeline.index.bare_digest`,
   `.cursor_mismatch`, `.not_piecewise`. The code is the answer; the sentence only says it. */
export const refusal = (code, row) => ({ refused: { code, why: word(row) } });

export const refuse = refusal;   /* readInner's range branch has a local `refusal` (an entry's refusal, R38) */

const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function unb64(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,2000}$/.test(s)) return null;
  try { const o = JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/"))); return o && typeof o === "object" && !Array.isArray(o) ? o : null; }
  catch { return null; }
}
export const natural = (v) => Number.isInteger(v) && v >= 0;

/* A run of text over the unit cap, as consecutive chunks of at most the cap, each ended at the last space in the final
   eighth of its window when there is one, else cut at the cap (never inside a surrogate pair). */
export function chunksOf(text, cap = CAPTURE_TEXT_UNIT_CAP) {
  const out = [];
  for (let at = 0; at < text.length;) {
    let end = Math.min(text.length, at + cap);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end - 1);
      if (sp > at + cap - Math.floor(cap / 8)) end = sp + 1;
      else if ((text.charCodeAt(end - 1) & 0xfc00) === 0xd800) end--;
    }
    out.push(text.slice(at, end));
    at = end;
  }
  return out;
}

/* The grain of a text read as text (R32, R33): an HTML page and a text with a blank line are read by paragraph; a text with
   no blank line and at least two non-empty lines by line. */
function grainOf(visible, html) {
  if (html || BLANK_LINE_RUN.test(visible)) return "paragraphs";
  let found = 0;
  for (let at = 0; at < visible.length && found < 2;) {
    const nl = visible.indexOf("\n", at);
    const end = nl < 0 ? visible.length : nl;
    if (visible.slice(at, end).trim().length) found++;
    at = end + 1;
  }
  return found >= 2 ? "lines" : "paragraphs";
}

/* A walker over the non-empty runs of the visible text from `offset`: `next()` answers `{text, from}` (`from` is where the
   scan stood before the run, the offset a cursor resumes at) or null at the end. The runs and their trimming are those
   `paragraphsOfText` makes of the whole text. */
function runWalker(visible, grain, html, offset) {
  const sep = grain === "paragraphs" ? new RegExp(BLANK_LINE_RUN.source, "g") : null;
  let at = offset;
  return () => {
    while (at < visible.length) {
      const from = at;
      let end, next;
      if (sep) {
        sep.lastIndex = at;
        const m = sep.exec(visible);
        if (m) { end = m.index; next = sep.lastIndex; } else { end = next = visible.length; }
      } else {
        const nl = visible.indexOf("\n", at);
        if (nl < 0) { end = next = visible.length; } else { end = nl; next = nl + 1; }
      }
      at = next;
      const raw = visible.slice(from, end);
      const text = html ? squashHtmlRun(raw) : raw.trim();
      if (text.length) return { text, from };
    }
    return null;
  };
}

const visibleOf = (text, html) => (html ? visibleTextOfHtml(text) : text);
/* G131f, G82: in pieces, the visible text of a page over BREATHE_AT is made by the streaming pass that gives the turn back every HTML_STRETCH tokens */
export const visibleOfYielding = async (text, html, on) => (html && on && text.length > BREATHE_AT ? visibleTextOfHtmlYielding(text, { yieldNow }) : visibleOf(text, html));
/* G131h (R51): the visible text of the HTML page whose pieces are being read, kept for the next tick of the object that made it (one page at a time,
   as the open PDF is): a later tick of that digest reads nothing from the store and parses nothing. A tick that does not find it (the object was
   restarted, another page replaced it) makes it again from the page, the same text. */
export let heldHtml = null;   /* {sha, visible} */
/* the split (PR 274): `reading-pipeline`'s `read` holds and lets go of the page through this, since an imported binding is not assignable */
export const setHeldHtml = (v) => { heldHtml = v; };
const unitOf = (para, run, seq, text) => ({ extent: { kind: "doc-para", para, run }, seq, text, kind: "body" });
const fits = (units, size, room, maxUnits) => !units.length || (units.length < maxUnits && size <= room);

/* The piece of a text read as text, from `at` (null: the start; else `{o, p, q, r}`: the scan offset, the next `para`, the
   next `seq`, the next run of that paragraph). `{units, grain, more, at, through}`. */
function textPiece(visible, { html, at, budget, maxUnits, grain: given }) {
  const grain = given ?? grainOf(visible, html);
  const walk = runWalker(visible, grain, html, at ? at.o : 0);
  let para = at ? at.p : 0, seq = at ? at.q : 0, run0 = at ? at.r : 0;
  const units = [];
  let room = budget, more = false, resume = null;
  for (let r = walk(); r; r = walk()) {
    if (!(glyphCount(r.text) > 0)) { para++; seq++; continue; }   /* a paragraph with no glyph is no unit, but is counted (R32) */
    const chunks = r.text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(r.text) : null;
    const n = chunks ? chunks.length : 1;
    for (let k = chunks ? run0 : 0; k < n; k++) {
      const text = chunks ? chunks[k] : r.text;
      const lead = chunks && k > 0 && continuesWord(chunks[k - 1], text) ? 1 : 0;
      const size = utf8Length(text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
      if (!fits(units, size, room, maxUnits)) { more = true; resume = { o: r.from, p: para, q: seq, r: chunks ? k : 0 }; break; }
      room -= size;
      units.push(withOwnWords(unitOf(para, chunks ? k : null, seq, text), lead));
      seq++;
    }
    run0 = 0;
    if (more) break;
    para++;
  }
  return { units, grain, more, at: resume, para, seq };
}

/* R35 over the whole text, for a first piece: the units the text has and the words of them. */
export async function totalsOfText(visible, html, grain) {
  const walk = runWalker(visible, grain, html, 0);
  let units = 0, words = 0, since = 0, paras = 0;
  for (let r = walk(); r; r = walk()) {
    paras++;
    if (glyphCount(r.text) > 0) { units += r.text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(r.text).length : 1; words += wordsIn(r.text); }
    since += r.text.length;
    if (since > BREATHE_AT) { since = 0; await yieldNow(); }   /* G82: the walk over a whole text is given back every slice */
  }
  return { units, words, paras };
}

/* R41: a sheet unit over the cap as blocks of whole lines, the sheet's first line (its header) repeated at the head of each
   later block. `lineRows` (the 1-based row of each text line, as a reader emits it) names the rows of each block in its
   extent; without it the extent is the sheet's whole range. */
/* R41, R47 (fix round 9, G128g, G128h): the rows a block states, one per line of its text: a later block's repeated header line names
   its own row (the sheet's first), so a reader that joins the blocks drops the repeat; without the sheet's `lineRows` a line's row
   is its place in the sheet's text, from 1. */
function blockRows(rows, first, end) {
  const own = [];
  for (let i = first; i < end; i++) own.push(rows ? rows[i] : i + 1);
  return first > 0 ? [rows ? rows[0] : 1, ...own] : own;
}
function sheetBlocks(u, sheet) {
  const lines = u.text.split("\n");
  const rows = sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === lines.length
    && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null;
  const head = lines[0];
  const corner = rows && typeof u.extent.range === "string" ? /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range) : null;
  const lastCol = corner ? corner[1].toUpperCase() : null;
  const blocks = [];
  let cur = [], size = 0, first = 0;
  const flush = (end) => {
    if (!cur.length) return;
    const withHead = first > 0 ? `${head}\n${cur.join("\n")}` : cur.join("\n");
    const range = rows && lastCol ? `A${rows[first]}:${lastCol}${rows[end - 1]}` : u.extent.range;
    blocks.push({ ...u, extent: { ...u.extent, range }, text: withHead, lineRows: blockRows(rows, first, end),
                  ...(first > 0 ? { leadWords: wordsIn(head) } : {}) });
    cur = []; size = 0;
  };
  for (let i = 0; i < lines.length; i++) {
    const budget = CAPTURE_TEXT_UNIT_CAP - (i > 0 ? head.length + 1 : 0);
    const l = lines[i].length > budget ? lines[i].slice(0, budget) : lines[i];   /* a single row over the cap stays one cut row, flagged */
    if (cur.length && size + l.length + 1 > budget) { flush(i); first = i; }
    if (!cur.length) first = i;
    cur.push(l); size += l.length + 1;
  }
  flush(lines.length);
  const longRow = lines.some((l) => l.length > CAPTURE_TEXT_UNIT_CAP - head.length - 1);
  return longRow ? blocks.map((b) => ({ ...b, truncated: true })) : blocks;
}

/* G48 (fix round 6; K4679): the way a sheet over the unit cap is cut into blocks (R41), planned before it is built. One
   walk over the text, line by line with no line list, finds each block's lines, its UTF-8 bytes and whether a row is over
   the cap; a block is built from its own span of the text when a piece asks for it (`sheetBlockAt`), so a first tick that
   reads the first piece builds the first piece's blocks and counts the rest. The walk is `sheetBlocks`' own, line for line.
   Null when the header leaves no room beside a row (the eager `sheetBlocks` cuts that sheet). */
function sheetPlan(u) {
  const text = u.text, cap = CAPTURE_TEXT_UNIT_CAP;
  const nl0 = text.indexOf("\n");
  const headLen = nl0 < 0 ? text.length : nl0;
  if (headLen + 2 > cap) return null;
  const limit = cap - headLen - 1;
  const headBytes = utf8Range(text, 0, headLen);
  const blocks = [];
  let cur = null, longRow = false, i = 0, pos = 0;
  const close = () => {
    cur.end = i;
    cur.bytes = (cur.first > 0 ? headBytes + 1 : 0) + cur.lineBytes + (cur.end - cur.first - 1);
    blocks.push(cur); cur = null;
  };
  for (;;) {
    const e = text.indexOf("\n", pos);
    const end = e < 0 ? text.length : e;
    const len = end - pos;
    if (len > limit) longRow = true;
    const budget = i > 0 ? limit : cap;
    const keep = len > budget ? budget : len;   /* a single row over the cap stays one cut row, flagged */
    if (cur && cur.size + keep + 1 > budget) close();
    if (!cur) cur = { first: i, from: pos, to: end, size: 0, lineBytes: 0 };
    cur.size += keep + 1; cur.lineBytes += utf8Range(text, pos, pos + keep); cur.to = end;
    i++;
    if (e < 0) break;
    pos = e + 1;
  }
  close();
  return { blocks, lines: i, longRow, headLen, headBytes };
}
/* One planned block built: the unit `sheetBlocks` would have made, `seq` its place in the whole list. */
function sheetBlockAt(u, sheet, plan, k, seq) {
  const b = plan.blocks[k], cap = CAPTURE_TEXT_UNIT_CAP;
  const head = u.text.slice(0, plan.headLen);
  if (plan.rows === undefined)   /* checked once for the sheet, at its first block */
    plan.rows = sheet && Array.isArray(sheet.lineRows) && sheet.lineRows.length === plan.lines
      && sheet.lineRows.every(Number.isInteger) ? sheet.lineRows : null;
  const rows = plan.rows;
  const corner = rows && typeof u.extent.range === "string" ? /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range) : null;
  const lastCol = corner ? corner[1].toUpperCase() : null;
  const lines = u.text.slice(b.from, b.to).split("\n").map((l, j) => {
    const budget = b.first + j > 0 ? cap - plan.headLen - 1 : cap;
    return l.length > budget ? l.slice(0, budget) : l;
  });
  const text = b.first > 0 ? `${head}\n${lines.join("\n")}` : lines.join("\n");
  const range = rows && lastCol ? `A${rows[b.first]}:${lastCol}${rows[b.end - 1]}` : u.extent.range;
  const unit = { extent: { ...u.extent, range }, seq, text, kind: "body", lineRows: blockRows(rows, b.first, b.end),
                 ...(plan.longRow ? { truncated: true } : {}) };
  return withOwnWords(unit, b.first > 0 ? wordsIn(head) : 0);
}

/* The units of a text from a format entry, the way a piece carries them (R41): `allUnitsOf`'s, a sheet over the unit cap
   in blocks of rows, any other unit over it in runs (R47). `seq` is the
   place in this whole list. The list is a plan (G48): each entry knows its UTF-8 bytes, and a sheet's block is built only
   when asked for (`unitAt`), so the totals (`n`, `bytesBefore`) cost a counting walk and a piece costs its own blocks.
   `base` is `allUnitsOf(i2text)` when the caller holds it. */
export function pieceUnitPlan(i2text, base = allUnitsOf(i2text) || []) {
  const sheets = Array.isArray(i2text && i2text.sheets) ? i2text.sheets : [];
  const entries = [];   /* {bytes, unit, make?, meta?} */
  const push = (bytes, unit, make, meta) => entries.push({ bytes, unit, make, meta });
  for (const u of base) {
    let parts;
    if (u.extent.kind === "sheet-range" && u.text.length > CAPTURE_TEXT_UNIT_CAP) {
      const sp = sheetPlan(u);
      if (sp) {
        const first = entries.length;
        sp.blocks.forEach((b, k) => push(b.bytes, null, () => sheetBlockAt(u, sheets[u.seq], sp, k, first + k), { sheet: u, sheetAt: sheets[u.seq], plan: sp, first: b.first }));
        continue;
      }
      parts = sheetBlocks({ ...u, extent: { ...u.extent, range: u.extent.range } }, sheets[u.seq]);
    }
    else if (u.text.length > CAPTURE_TEXT_UNIT_CAP)   /* R47 (G128d): a page, slide, paragraph or part over the cap, as its chunks */
      parts = chunkUnits(u.text).map((c, k) => ({ ...u, extent: { ...u.extent, run: k }, text: c.text,
                                                  ...(k > 0 ? { overlap: c.overlap } : {}), ...(c.lead ? { leadWords: 1 } : {}) }));
    else parts = [u];
    for (const { leadWords = 0, ...p } of parts) {
      const cut = p.text.length > CAPTURE_TEXT_UNIT_CAP;
      const unit = withOwnWords({ ...p, seq: entries.length, text: cut ? p.text.slice(0, CAPTURE_TEXT_UNIT_CAP) : p.text, ...(cut || p.truncated ? { truncated: true } : {}) }, leadWords);
      push(utf8Length(unit.text), unit);
    }
  }
  return unitPlanOf(entries);
}
/* A plan over entries `{bytes, unit, make?}`: `n`, the bytes of unit `k`, unit `k` (built once), the bytes of the units before `k`. */
function unitPlanOf(entries) {
  return { n: entries.length,
           sizeAt: (k) => entries[k].bytes,
           unitAt: (k) => (entries[k].unit ??= entries[k].make()),
           metaAt: (k) => entries[k].meta,
           bytesBefore: (upto) => { let n = 0; for (let k = 0; k < upto; k++) n += entries[k].bytes; return n; } };
}
const unitPlanOfList = (list) => unitPlanOf(list.map((unit) => ({ bytes: utf8Length(unit.text), unit })));

/* A piece of a ready plan of units, from index `i`. */
function listPiece(plan, { i, budget, maxUnits }) {
  const units = [];
  let room = budget, at = i;
  for (; at < plan.n; at++) {
    const size = plan.sizeAt(at) + ACQUIRE_TEXT_UNIT_ENVELOPE;
    if (!fits(units, size, room, maxUnits)) break;
    room -= size; units.push(plan.unitAt(at));
  }
  return { units, more: at < plan.n, next: at };
}

/* Reads a cursor against what is in hand: `{at}` or `{refused}`. `shape` is "t" (a text read as text) or "u" (a list). */
function cursorIn(cursor, { sha, shape, chars, n }) {
  const bad = () => refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
  const c = unb64(cursor);
  if (!c || c.v !== 1 || c.s !== sha || c.k !== shape) return bad();
  if (shape === "t") {
    if (c.c !== chars || ![c.o, c.p, c.q, c.r].every(natural) || c.o >= chars) return bad();
    return { at: { o: c.o, p: c.p, q: c.q, r: c.r } };
  }
  if (c.n !== n || !natural(c.i) || c.i >= n) return bad();
  return { at: c.i };
}

/* A PDF range cursor: `{from}` (the first page of this piece) and `n` (the pages in the document), or `{refused}`. */
export function rangeCursorIn(cursor, { sha }) {
  if (cursor == null) return { from: 0, n: null };
  const c = unb64(cursor);
  if (c && c.v === 1 && c.s === sha && c.k === "u") return { list: true };   /* a list cursor: this document is read whole, as the entry reads it */
  if (!c || c.v !== 1 || c.s !== sha || c.k !== "p" || !natural(c.i) || !natural(c.n) || c.i >= c.n)
    return refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
  return { from: c.i, n: c.n };
}

/* One piece of a PDF's range text: the units of the pages the range holds (seq the page, as a whole read numbers them),
   within the budget; `next` is the first page not yet read. */
export function rangePieceAnswer(i2text, { sha, from, count, total, budget, maxUnits }) {
  const all = (allUnitsOf(i2text) || []).flatMap((u) => chunkedUnit({ ...u, seq: u.extent.page }));   /* R47: a page over the cap as its chunks */
  const plan = unitPlanOfList(all);
  const p = listPiece(plan, { i: 0, budget, maxUnits });
  const next = p.more ? all[p.next].extent.page : from + count;
  const more = next > from && next < total;   /* R46: a range that advanced nothing is never `more` */
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, from, next,
           fields: { more, cursor: more ? b64({ v: 1, s: sha, k: "p", n: total, i: next }) : null, read_through: next, total },
           piece: { units: p.units.length, words, pages: [from, next] } };
}

/* One piece of a text read as text: `{refused}` or `{units, piece, answer}` where `answer` is the cursor fields. */
export function textPieceAnswer(visible, { html, sha, cursor, budget, maxUnits }) {
  let at = null;
  if (cursor != null) {
    const r = cursorIn(cursor, { sha, shape: "t", chars: visible.length });
    if (r.refused) return r;
    if (r.at.o > 0 && !/\s/.test(visible[r.at.o - 1])) return refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");
    at = r.at;
  }
  const p = textPiece(visible, { html, at, budget, maxUnits });
  const cur = p.more ? b64({ v: 1, s: sha, k: "t", c: visible.length, ...p.at }) : null;
  const through = p.more ? utf8Length(visible.slice(0, p.at.o)) : utf8Length(visible);
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, grain: p.grain, at: p.at,
           fields: { more: p.more, cursor: cur, read_through: through, total: utf8Length(visible) },
           piece: { units: p.units.length, words } };
}

/* One piece of a list of units (a format entry's text). */
export function listPieceAnswer(plan, { sha, cursor, budget, maxUnits }) {
  let i = 0;
  if (cursor != null) {
    const r = cursorIn(cursor, { sha, shape: "u", n: plan.n });
    if (r.refused) return r;
    i = r.at;
  }
  const p = listPiece(plan, { i, budget, maxUnits });
  let words = 0;
  for (const u of p.units) words += wordsOfUnit(u);
  return { units: p.units, next: p.next,
           fields: { more: p.more, cursor: p.more ? b64({ v: 1, s: sha, k: "u", n: plan.n, i: p.next }) : null,
                     read_through: plan.bytesBefore(p.next), total: plan.bytesBefore(plan.n) },
           piece: { units: p.units.length, words } };
}

/* ===================================================================== *
 * The reader contract's source and plan (R45; fix round 9, G130, G132).
 * ===================================================================== */

/* R45: a capture's bytes as a range source, `{size, readRange(offset, length)}`, over the evidence store `read` is handed: the whole
   object by one ranged read when it is held whole, else across the parts the document states, in order (the parts of a capture held
   in parts, never looked up anywhere; `acquisition` R113's `readRange` is the same shape, which a caller may hand in its place).
   `readRange` answers the bytes that exist (a range past the end answers fewer, one at or past it none) or `{ok: false, reason}`,
   and never throws; `reads` counts the ranges asked, `[offset, length]` each. */
export function rangeSource(evidence, doc) {
  const sha = doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : null;
  const parts = Array.isArray(doc && doc.parts) ? doc.parts.filter((p) => p && typeof p.sha256 === "string" && natural(p.bytes)) : null;
  const size = parts && parts.length ? parts.reduce((n, p) => n + p.bytes, 0)
    : Number.isFinite(doc && doc.capture && doc.capture.bytes) ? doc.capture.bytes : null;
  const reads = [];
  /* the parts the document states are read first, each by a ranged get across the seam, and no question is asked of the store for the whole;
     a part not held, or short, leaves the range to the whole */
  const fromParts = async (offset, take) => {
    const out = new Uint8Array(take);
    let at = 0, start = 0;
    for (const p of parts) {
      const end = start + p.bytes, from = Math.max(offset, start), to = Math.min(offset + take, end);
      if (to > from) {
        const got = await rangeBytes(evidence, p.sha256, from - start, to - from);
        if (!got || got.bytes.length < to - from) return null;
        out.set(got.bytes.subarray(0, to - from), at); at += to - from;
      }
      start = end;
      if (start >= offset + take) break;
    }
    return out;
  };
  const readRange = async (offset, length) => {
    reads.push([offset, length]);
    try {
      if (!evidence || !sha || !natural(offset) || !natural(length)) return { ok: false, reason: "NOT_HELD" };
      if (size !== null && (offset >= size || length === 0)) return new Uint8Array(0);
      const take = size !== null ? Math.min(length, size - offset) : length;
      if (parts && parts.length) { const got = await fromParts(offset, take); if (got) return got; }
      const got = await rangeBytes(evidence, sha, offset, take);
      return got && got.bytes.length >= take ? got.bytes.subarray(0, take) : { ok: false, reason: "NOT_HELD" };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e).slice(0, 120) || "STORE_FAILED" };
    }
  };
  return { size, readRange, reads };
}

/* R45: the grain each kind is read in, and the `READ_BOUNDS` row its file is judged against (the light kinds their own; every other
   kind the whole-load ceiling `bytesOf` keeps, R37). */
const PLAN_HEAD = 1024 * 1024, PLAN_TAIL = 64 * 1024;
const MODE_OF = { pdf: "pages", jpeg: "pages", png: "pages", csv: "rows", tsv: "rows", xlsx: "rows", ods: "rows",
                  text: "windows", json: "windows", xml: "windows", html: "windows" };
const BOUND_ROW_OF = { text: ["text", "bytes"], html: ["text", "bytes"], undetermined: ["text", "bytes"], csv: ["csv", "bytes"],
                       tsv: ["tsv", "bytes"], json: ["json", "bytes"], xml: ["xml", "bytes"] };
/* T53-528 (format-registry R38, R39): the kind a reading goes by, from `detectFormat`'s answer. `text` is valid text no entry claimed and `json`, `xml` and `html` are read as text here; `unlisted` with a name is a file
   held and named (R67: `held_unread`); `unlisted` with no name is bytes no signature claimed (what was `undetermined`: UTF-16 with no BOM is such, R49), so they stay `undetermined` and the reading decides by its own decode. */
export const kindOfDetected = (found) => (found && typeof found.format === "string"
  ? (found.format === "unlisted" && !found.named && !found.encrypted ? "undetermined" : found.format) : "undetermined");

/* R45: `plan(source, {declared, name})` reads a head range and a tail range and the declared size, no body: `kind` detected from
   them (`format-registry.detectFormat` over the two ranges: an image asked before a PDF or a page, an office or OpenDocument file
   recognised by its tail directory), `pages` or `rows` the declared count when the ranges state it (null here: no body is read),
   `verdict` `{ok, size, limit, bound_key}` the size against the kind's bound, `mode` the grain. A range the two do not hold is read
   from the source (counted in its `reads`). */
export async function plan(source, { declared = null, name = null } = {}) {
  const size = source && Number.isFinite(source.size) ? source.size : null;
  if (!source || typeof source.readRange !== "function" || size === null)
    return { kind: "undetermined", pages: null, rows: null, verdict: { ok: false, size, limit: null, bound_key: null }, mode: null };
  const asBytes = (x) => (x instanceof Uint8Array ? x : null);
  const head = asBytes(await source.readRange(0, Math.min(size, PLAN_HEAD))) || new Uint8Array(0);
  const tailAt = Math.max(head.length, size - PLAN_TAIL);
  const tail = tailAt < size ? asBytes(await source.readRange(tailAt, size - tailAt)) || new Uint8Array(0) : new Uint8Array(0);
  const cached = { size, readRange: async (o, n) => {
    if (o + n <= head.length) return head.subarray(o, o + n);
    if (o >= tailAt && o + n <= tailAt + tail.length) return tail.subarray(o - tailAt, o - tailAt + n);
    return source.readRange(o, n);
  } };
  const found = await detectFormat(cached, declared, name);
  const kind = kindOfDetected(found);
  /* R67: a file held and named has no bound to judge and no grain: it is stated held, whatever its size (no TOO_LARGE) */
  if (kind === "unlisted") return { kind, pages: null, rows: null, verdict: { ok: true, size, limit: null, bound_key: null }, mode: "held" };
  const row = BOUND_ROW_OF[kind] || WHOLE_READ_ROW;
  const st = statement(row[0], row[1], size);
  const mode = MODE_OF[kind] || "whole";
  return { kind, pages: null, rows: null, verdict: { ok: size <= st.bound, size, limit: st.bound, bound_key: st.key }, mode };
}

/* R39 (fix round 6, G6; K4570): a document that states nothing of its object but a digest. */
export function isBareStub(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  const c = doc.capture;
  return !!c && typeof c === "object" && typeof c.sha256 === "string" && !Array.isArray(doc.parts)
    && !Number.isFinite(c.bytes) && typeof doc.retrieved !== "string" && !(doc.profile && typeof doc.profile === "object");
}

/* ===================================================================== *
 * A reading in pieces by a byte window (R40, G68).
 * ===================================================================== */

/* G68 (fix round 7; diagnosis-R7-reading.md R1): every tick re-opened the whole object: a 17 MiB CSV tick decoded the 17 MiB to
   cut one piece, and a 12 MB text decoded its 12 MB. The first piece still reads the whole (R35's totals, R14's provenance and the
   classification are over the whole text), and then names where the next piece begins in the OBJECT: a cursor of kind `w` holds
   a byte offset, and a later tick asks the evidence store for that window alone (record-core R88's ranged `get`) and reads the
   piece from it. The units, their `seq`, extents, words and the totals are exactly those of the cursors above (`t`, `u`): the
   same functions cut the same runs and blocks, only from a window. What a window cannot know it is told by the cursor: the
   text's grain, the sheet's last column, whether a row was cut, the bytes already read. A capture that cannot be windowed (an
   HTML page, whose visible text is judged over the whole markup; a text that is not valid UTF-8; a CSV in UTF-16; any other
   format; an object not held whole under the document's digest) is given the cursor above, read whole by each tick as before,
   and a cursor of the kinds above is still read as it was. */
export const WINDOW_BYTES = 1024 * 1024;
/* The bytes of a CSV's head that its encoding and delimiter signatures read (csv-reader's SIGNATURE_WINDOW_BYTES, 1 MiB, past a
   BOM): a window of the body is decoded beside this head, so the entry finds the dialect it found over the whole. */
const CSV_HEAD_BYTES = 1024 * 1024 + 3;
/* A chunk of a CSV is cut at the first record boundary at or after its nominal size; the bytes read beyond it to find one. */
const CSV_SLACK_BYTES = 64 * 1024;
const FATAL_UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const LENIENT_UTF8 = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });

/* The bytes [offset, offset + length) of a held object, or null when it is not held. A store that ignored the range and gave the
   whole object is cut here. `size` is the object's own, or null when the store did not say. */
async function rangeBytes(evidence, digest, offset, length) {
  const o = await evidence.get(digest, { range: { offset, length: Math.max(1, length) } });
  if (!o) return null;
  const all = new Uint8Array(await o.arrayBuffer());
  const size = Number.isFinite(o.size) ? o.size : null;
  if (all.length > length && size !== null && all.length === size) return { bytes: all.subarray(offset, offset + length), size };
  return { bytes: all, size };
}

/* The window cursor of a cursor string, or null when it is not one. */
export function windowCursorOf(cursor) {
  const c = unb64(cursor);
  return c && c.v === 1 && c.k === "w" ? c : null;
}
/* R45 (R23): the cursor of a byte window, opaque to its holder: `{m, n, ob, ...}` (the kind of window, the object's size, the offset
   where the next piece begins, and what a window cannot know) under the document's digest. */
export const windowCursor = (sha, o) => b64({ v: 1, k: "w", s: sha, ...o });
const mismatch = () => refusal(CURSOR_MISMATCH, "reading-pipeline.index.bytes_not_held");

/* --- a text read as text ------------------------------------------------------------------------------------------------ */

/* The end of the runs a window holds whole: the last separator (a blank line for paragraphs, a line break for lines) with
   something after it in the window, else 0. A match that reaches the window's end might go on beyond it, so it is no end. */
function completeRunsEnd(vis, grain) {
  if (grain === "lines") { const i = vis.lastIndexOf("\n"); return i < 0 ? 0 : i + 1; }
  const sep = new RegExp(BLANK_LINE_RUN.source, "g");
  let end = 0;
  for (let m = sep.exec(vis); m; m = sep.exec(vis)) {
    const e = m.index + m[0].length;
    if (e < vis.length) end = e;
  }
  return end;
}

/* The cursor a first (or `t`) piece of a text read as text hands on when the next piece can be read by a window, else null.
   `at` is textPiece's resume point (the scan offset in characters, the next `para`, `seq` and run), `through` the UTF-8 bytes of
   the text before it. The text is the object's bytes decoded without loss (valid UTF-8; a BOM only at its start). */
export async function textWindowCursorOf(evidence, { sha, bytes, text, whole, at, through, grain }) {
  if (!whole || !at || !(bytes instanceof Uint8Array)) return null;
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  if (text.includes("\ufffd")) { try { FATAL_UTF8.decode(bytes); } catch { return null; } }
  if (utf8Length(text) !== bytes.length - bom) return null;
  /* the window is an improvement: a store that cannot answer a range leaves the piece its cursor of the old kind */
  try { const probe = await rangeBytes(evidence, sha, through + bom, 1); if (!probe || probe.bytes.length !== 1) return null; } catch { return null; }
  return windowCursor(sha, { m: "t", n: bytes.length, ob: through + bom, bm: bom, g: grain === "lines" ? 1 : 0, p: at.p, q: at.q, r: at.r });
}

/* R50, R49 (job 40, B44 (1)): a window of a text in any encoding R49 reads. The head's encoding (ooxml's `decodeText`) is kept in the cursor (`en`, absent for UTF-8 and
   US-ASCII) and each window is decoded by it: UTF-8 as before; a single-byte charset (windows-125x, ISO-8859-x) one byte a character; UTF-16 in even offsets, a surrogate pair
   kept whole. `pre` the bytes of context read before a window, `startOk` whether the offset begins a character, `end` the bytes of a window that end at a character, `bytes`
   the bytes of a decoded string. */
const SINGLE_BYTE = /^(?:windows-125\d|iso-8859-\d+|ibm\d+|cp\d+|macintosh|koi8-[ru]|x-mac-cyrillic)$/;
const A_UTF8 = { pre: 4, startOk: (b, pre) => (b[pre] & 0xc0) !== 0x80, lenient: (x) => LENIENT_UTF8.decode(x), decode: (x) => FATAL_UTF8.decode(x),
  end: (b, pre, len) => { let i = len - 1; while (i > 0 && (b[pre + i] & 0xc0) === 0x80) i--; const lead = b[pre + i], need = lead < 0x80 ? 1 : lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1; return i + need > len ? i : len; },
  bytes: (str) => utf8Length(str) };
export const windowEncodable = (en) => !en || en === "utf-8" || en === "us-ascii" || en === "utf-16le" || en === "utf-16be" || SINGLE_BYTE.test(en);
function adapterFor(en) {
  if (!en || en === "utf-8" || en === "us-ascii") return A_UTF8;
  const td = new TextDecoder(en, { ignoreBOM: true });
  if (en === "utf-16le" || en === "utf-16be") {
    const le = en === "utf-16le";
    return { pre: 2, startOk: (b, pre, c) => (c.ob - c.bm) % 2 === 0, lenient: (x) => td.decode(x), decode: (x) => td.decode(x),
      end: (b, pre, len) => { let e = len - (len % 2); if (e >= 2 && ((le ? b[pre + e - 1] : b[pre + e - 2]) & 0xfc) === 0xd8) e -= 2; return e; }, bytes: (str) => str.length * 2 };
  }
  return { pre: 1, startOk: () => true, lenient: (x) => td.decode(x), decode: (x) => td.decode(x), end: (b, pre, len) => len, bytes: (str) => str.length };
}

/* R50 (G131i; K4834): the start and end of the first separator of a text's runs in `vis` (a blank line for paragraphs, a line break for lines), or null. */
function firstSeparator(vis, grain) {
  if (grain === "lines") { const i = vis.indexOf("\n"); return i < 0 ? null : [i, i + 1]; }
  const m = new RegExp(BLANK_LINE_RUN.source).exec(vis);
  return m ? [m.index, m.index + m[0].length] : null;
}
/* R50: the units of a run begun in an earlier window (`md`) or not ended in this one: `region` is the run's text in the window (to its separator, or to
   the window's end), cut as `chunksOf` cuts a run over the cap (R47), the same chunks the whole run would give since the cut is greedy from the run's
   start. A run still open keeps its last chunk for the next window (its end is not known); a complete run gives all. `{units, used, done, runs}`: the
   characters of `region` the units took, whether the run ended in them, and the run index the next chunk takes. */
function openRunPiece(region, { c, complete, room, maxUnits, room0 }) {
  const body = complete ? region.trimEnd() : region;
  const lead = c.md ? 0 : body.length - body.trimStart().length;
  const text = body.slice(lead);
  const chunks = text.length > CAPTURE_TEXT_UNIT_CAP ? chunksOf(text) : [text];
  const usable = complete ? chunks : chunks.slice(0, -1);
  const units = [];
  /* a cursor of a run's start that names a chunk already given (`r`) skips those chunks; one inside a run (`md`) begins at its chunk and numbers on from `r` */
  const skip = c.md ? 0 : Math.min(c.r || 0, usable.length), base = c.md ? c.r : 0;
  let used = lead, k = skip, ld = c.md ? c.ld === 1 : false;
  for (let i = 0; i < skip; i++) used += usable[i].length;
  for (; k < usable.length; k++) {
    const size = utf8Length(usable[k]) + ACQUIRE_TEXT_UNIT_ENVELOPE;
    if (!fits(units, size, room, maxUnits)) break;
    room -= size;
    const lead1 = (k === 0 ? ld : continuesWord(usable[k - 1], usable[k])) ? 1 : 0;
    units.push(withOwnWords(unitOf(c.p, chunks.length > 1 || c.md ? base + k : null, c.q + units.length, usable[k]), lead1));
    used += usable[k].length;
  }
  const done = complete && k === usable.length;
  const next = chunks[k];
  const carry = k > 0 && next !== undefined ? continuesWord(usable[k - 1], next) : ld;
  return { units, used: done ? region.length : used, done, runs: base + k, ld: carry, room };
}
/* A later piece of a text read as text, from the window the cursor names. R50 (fix round 9, G131i): a run with no separator in the window is read in
   chunks from the window (`openRunPiece`), its cursor marked `md`, so a text of one 50 MB line is read as a text of many lines is: neither holds the file
   whole. `src` is the range source of a capture read by range from its first piece (`ro`): its parts first, never the whole (R45). */
export async function textWindowTick(evidence, sha, c, { budget, maxUnits, windowBytes }, src = null) {
  if (![c.n, c.ob, c.bm, c.p, c.q, c.r].every(natural) || !(c.g === 0 || c.g === 1) || c.ob < c.bm || c.ob >= c.n || (c.bm !== 0 && c.bm !== 2 && c.bm !== 3) || (c.en !== undefined && !(typeof c.en === "string" && windowEncodable(c.en)))) return mismatch();
  const A = adapterFor(c.en);
  const enc = c.en ? { en: c.en } : {};
  const grain = c.g === 1 ? "lines" : "paragraphs";
  const pre = Math.min(A.pre, c.ob);
  const mid = c.md === 1;
  const ro = c.ro === 1;
  const get = async (o, l) => {
    if (!src) return rangeBytes(evidence, sha, o, l);
    const b = await src.readRange(o, l);
    return b instanceof Uint8Array ? { bytes: b, size: src.size } : null;
  };
  /* a window is what the piece can use: a piece holds at most `budget` bytes of units, each charged its envelope too, so a larger window is bytes pulled for nothing (R50: at most twice the file) */
  let want = Math.min(windowBytes, Math.max(32768, Math.ceil((Number.isFinite(budget) ? budget : windowBytes) / 2)));
  /* a window that holds no whole run is made longer: doubled, or for a run with no separator at once to what a piece can take of it (its budget and the chunk kept back) */
  const chunksFit = Math.max(1, Math.floor(Math.min(Number.isFinite(budget) ? budget : 4 * 1048576, 4 * 1048576) / (CAPTURE_TEXT_UNIT_CAP + ACQUIRE_TEXT_UNIT_ENVELOPE)));
  const openTarget = (chunksFit + 1) * CAPTURE_TEXT_UNIT_CAP + 4096;
  if (mid) want = Math.max(want, openTarget);   /* inside a run: the window the chunks a piece takes need, at once */
  const grow = (open) => { want = open ? Math.max(want * 2, openTarget) : want * 2; };
  for (;;) {
    const len = Math.min(want, c.n - c.ob);
    const got = await get(c.ob - pre, pre + len);
    if (!got) return { gone: true };
    if (got.size !== null && got.size !== c.n) return mismatch();
    const b = got.bytes;
    if (b.length !== pre + len) return mismatch();
    /* the offset begins a character, and (but inside a run) the character before it is white space (or it is the text's first): the start of a run */
    if (!A.startOk(b, pre, c)) return mismatch();
    if (c.ob > c.bm && !mid) {
      const before = A.lenient(b.subarray(0, pre));
      if (!before.length || !/\s/.test(before[before.length - 1])) return mismatch();
    }
    const eof = c.ob + len >= c.n;
    let end = len;   /* a window not at the end of the object may cut a character: it ends at the one before */
    if (!eof) end = A.end(b, pre, len);
    let vis;
    try { vis = A.decode(b.subarray(pre, pre + end)); } catch { return mismatch(); }
    const sep = firstSeparator(vis, grain);
    const upto = eof ? vis.length : completeRunsEnd(vis, grain);
    const openStart = mid || (!eof && upto === 0);   /* the window begins inside a run, or holds no whole run */
    /* an open run is cut into chunks only from a window longer than two units; shorter, a longer window is asked for */
    if (openStart && !eof && !sep && vis.length <= 2 * CAPTURE_TEXT_UNIT_CAP) { grow(true); continue; }
    let units = [], room = budget, p = c.p, q = c.q, pos = 0, stopped = false;
    if (openStart) {
      const complete = !!sep || eof;
      const region = vis.slice(0, sep ? sep[0] : vis.length);
      const o = openRunPiece(region, { c: { ...c, md: mid ? 1 : 0 }, complete, room, maxUnits });
      units = o.units;
      if (!o.done) {   /* more of this run follows: the next window takes it up at the chunk after the last given */
        if (!units.length) { if (!eof) { grow(true); continue; } return mismatch(); }
        const ob = c.ob + A.bytes(vis.slice(0, o.used));
        let words = 0; for (const u of units) words += wordsOfUnit(u);
        const cursor = windowCursor(sha, { m: "t", n: c.n, bm: c.bm, g: c.g, ...enc, ob, p, q: q + units.length, r: o.runs, md: 1, ld: o.ld ? 1 : 0, ...(ro ? { ro: 1, wr: (c.wr || 0) + words } : {}) });
        return { units, fields: { more: true, cursor, read_through: ob - c.bm, total: c.n - c.bm }, piece: { units: units.length, words } };
      }
      pos = sep ? sep[1] : vis.length; p += 1; q += units.length;
      for (const u of units) room -= utf8Length(u.text) + ACQUIRE_TEXT_UNIT_ENVELOPE;
      stopped = units.length >= maxUnits || room <= 0;
    }
    const text = vis.slice(pos, Math.max(pos, upto));
    let pc = null;
    if (!stopped && text.length) {
      pc = textPiece(text, { html: false, at: { o: 0, p, q, r: openStart ? 0 : c.r }, budget: room, maxUnits: maxUnits - units.length, grain });
      if (!pc.more && !eof && !units.length) { grow(false); continue; }   /* every whole run in the window was taken and the piece is not full: a longer window */
    }
    const all = pc ? [...units, ...pc.units] : units;
    let words = 0; for (const u of all) words += wordsOfUnit(u);
    /* where the next piece begins: inside the text the piece stopped in, else after the last whole run (the tail run begins it), else the end */
    const at = pc && pc.more ? { c: pos + pc.at.o, p: pc.at.p, q: pc.at.q, r: pc.at.r }
      : { c: stopped && !pc ? pos : Math.max(pos, upto), p: pc ? pc.para : p, q: pc ? pc.seq : q, r: 0 };
    const more = stopped || (pc && pc.more) || !eof;
    const ob = more ? c.ob + A.bytes(vis.slice(0, at.c)) : c.n;
    if (more && !all.length && ob === c.ob) { if (!eof) { grow(false); continue; } return mismatch(); }
    const cursor = more ? windowCursor(sha, { m: "t", n: c.n, bm: c.bm, g: c.g, ...enc, ob, p: at.p, q: at.q, r: at.r, ...(ro ? { ro: 1, wr: (c.wr || 0) + words } : {}) }) : null;
    return { units: all, fields: { more, cursor, read_through: ob - c.bm, total: c.n - c.bm }, piece: { units: all.length, words },
             ...(!more && ro ? { facts: { words_total: (c.wr || 0) + words } } : {}) };
  }
}

/* --- a CSV ---------------------------------------------------------------------------------------------------------------- */

/* The record boundaries of CSV bytes, as csv-reader walks records (RFC 4180): a line break outside double quotes ends a record, a
   CR, an LF or a CRLF as one; a double quote opens or closes quotes, so a doubled one inside quotes is two turns and no change.
   The delimiter takes no part. `b` begins at the object offset `base`; each offset where a record ends and the next begins is
   pushed to `out`, in order. `st` carries the scan between pieces of one run ({inQ, cr, crAt}); `finishScan` settles a CR that
   ended the last piece. An offset at the end of the object begins no record and is for the caller to drop. */
/* G131b (fix round 9; csv-reader's rule, its G131b): a double quote opens quotes only at the start of a field (a record's first byte,
   or the byte after the delimiter `d`); anywhere else it is a character of the field, so a stray `12" pipe` swallows nothing. Inside
   quotes a quote closes them, and a quote right after the closing one is an escaped quote that reopens them. */
function newScan(d = 0x2c) { return { inQ: false, cr: false, crAt: 0, start: true, closed: false, d }; }
function scanBoundaries(b, base, st, out) {
  let inQ = st.inQ, cr = st.cr, crAt = st.crAt, start = st.start, closed = st.closed;
  const d = st.d;
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (cr) { cr = false; start = true; if (c === 0x0a) { out.push(base + i + 1); continue; } out.push(crAt); }
    if (inQ) { if (c === 0x22) { inQ = false; closed = true; } continue; }
    if (closed && c === 0x22) { inQ = true; closed = false; continue; }
    closed = false;
    if (c === 0x22 && start) { inQ = true; start = false; }
    else if (c === 0x0a) { out.push(base + i + 1); start = true; }
    else if (c === 0x0d) { cr = true; crAt = base + i + 1; }
    else start = c === d;
  }
  Object.assign(st, { inQ, cr, crAt, start, closed });
}
/* the delimiter's byte from the dialect's name or character (a comma when it names none) */
const DELIMITER_BYTE = { comma: 0x2c, semicolon: 0x3b, tab: 0x09, pipe: 0x7c, ",": 0x2c, ";": 0x3b, "\t": 0x09, "|": 0x7c };
const delimiterByteOf = (i2text) => DELIMITER_BYTE[i2text && i2text.dialect && i2text.dialect.delimiter] ?? 0x2c;
function finishScan(st, out) { if (st.cr) { st.cr = false; out.push(st.crAt); } }

/* From a first (or `u`) piece of a CSV whose next block is the one at line `L`: the cursor that reads the next piece by a window,
   or null when it cannot (the object is not held whole, its encoding is UTF-16, the file is not longer than the head a window
   needs, the sheet's lines are not named by row, or its header leaves no room beside a row). `meta` is the plan's entry for the
   block, `read` and `total` the bytes of units before it and in all. Scans the head of the object in the store, as far as the block's
   record (the first piece's size), never the file. */
export async function csvWindowCursorOf(evidence, args) {
  try { return await csvWindowCursorIn(evidence, args); }
  catch { return null; }   /* the cursor of a window is an improvement: a store that cannot answer a range leaves the piece its cursor of the old kind */
}
async function csvWindowCursorIn(evidence, { sha, whole, size, i2text, meta, next, read, total }) {
  if (!whole || !meta || !meta.plan || !Number.isInteger(size) || !i2text || i2text.container !== "csv") return null;
  const enc = i2text.dialect ? i2text.dialect.encoding : undefined;
  if (!(enc === "utf-8" || enc === "us-ascii" || enc === null)) return null;
  const sheet = meta.sheetAt, u = meta.sheet, lines = meta.plan.lines;
  if (!sheet || !Array.isArray(sheet.lineRows) || sheet.lineRows.length !== lines || !sheet.lineRows.every(Number.isInteger)) return null;
  if (!u || !u.extent || u.extent.kind !== "sheet-range" || typeof u.extent.sheet !== "string" || typeof u.extent.range !== "string") return null;
  const L = meta.first, row = sheet.lineRows[L];
  if (!(L > 0) || !(row >= 1)) return null;
  let f = L;
  while (f > 0 && sheet.lineRows[f - 1] === row) f--;
  const corner = /:\$?([A-Za-z]{1,3})\$?\d+$/.exec(u.extent.range);
  /* the object, from its start, as far as the first record at or past the head and the block's own record */
  const dl = delimiterByteOf(i2text);
  const st = newScan(dl), seen = [];
  let target = row === 1 ? 0 : null, he = null, hr = null, count = 0;
  for (let at = 0; at < size && (target === null || he === null); at += WINDOW_BYTES) {
    const got = await rangeBytes(evidence, sha, at, Math.min(WINDOW_BYTES, size - at));
    if (!got || got.bytes.length !== Math.min(WINDOW_BYTES, size - at)) return null;
    seen.length = 0;
    scanBoundaries(got.bytes, at, st, seen);
    if (at + got.bytes.length >= size) finishScan(st, seen);
    for (const b of seen) {
      if (b >= size) continue;
      if (target === null && count === row - 2) target = b;
      if (he === null && b >= CSV_HEAD_BYTES) { he = b; hr = count + 1; }
      count++;
    }
  }
  if (target === null || he === null) return null;
  return windowCursor(sha, { m: "c", n: size, ob: target, rw: row, li: L, sk: L - f, bi: next, rt: read, tt: total, he, hr, dl,
                             lr: meta.plan.longRow ? 1 : 0, lc: corner ? corner[1].toUpperCase() : "", rg: u.extent.range, sh: u.extent.sheet });
}

/* A later piece of a CSV, from the window the cursor names: the blocks R41 makes of the sheet's lines, built from the lines of the
   records in a window, and the head the entry's signatures need before it. The lines are the entry's own (its text of the head
   and the window together), so a line, its row and its words are what the whole read gives. */
export async function csvWindowTick(evidence, sha, c, { budget, maxUnits, windowBytes }, src = null, first0 = null) {
  const nums = [c.n, c.ob, c.rw, c.li, c.sk, c.bi, c.rt, c.tt, c.he, c.hr];
  if (!nums.every(natural) || !(c.lr === 0 || c.lr === 1) || typeof c.lc !== "string" || typeof c.rg !== "string" || typeof c.sh !== "string") return mismatch();
  if (c.ob >= c.n || c.he >= c.n || c.he < CSV_HEAD_BYTES || c.rw < 1 || c.sk > c.li || !c.sh) return mismatch();
  /* K4868: a cursor made by the first piece of a CSV read by range (`ro`) also carries the widest row seen (`cn`, columns) and the words before
     it (`wr`), and counts its progress in the object's own bytes; its bytes come through the range source (the object held whole or in parts). */
  const ro = c.ro === 1;
  if (ro && !(natural(c.cn) && c.cn >= 1 && natural(c.wr) && src)) return mismatch();
  const rb = src ? async (offset, length) => { const r = await src.readRange(offset, length); return r instanceof Uint8Array ? { bytes: r, size: src.size } : null; }
                 : (offset, length) => rangeBytes(evidence, sha, offset, length);
  let cols = ro ? c.cn : 0;
  const entry = getFormat("csv");
  if (!entry || typeof entry.text !== "function") return mismatch();
  const cap = CAPTURE_TEXT_UNIT_CAP;
  const units = [];
  let room = budget, added = 0, seq = c.bi, stop = null;
  let headLine = null, limit = 0, headWords = 0;
  let cur = [], curRows = [], size = 0, first = null, last = 0;
  const build = () => {
    /* the sheet's first block begins at its first line, the header, and repeats nothing (sheetBlocks' own rule) */
    const lead = first.line > 0;
    const text = lead ? `${headLine}\n${cur.join("\n")}` : cur.join("\n");
    const range = ro ? `A${first.row}:${letterOf(cols)}${last}` : c.lc ? `A${first.row}:${c.lc}${last}` : c.rg;
    const unit = { extent: { kind: "sheet-range", sheet: c.sh, range }, seq, text, kind: "body", lineRows: lead ? [1, ...curRows] : [...curRows],
                   ...(c.lr ? { truncated: true } : {}) };
    return withOwnWords(unit, lead ? headWords : 0);
  };
  /* the open block is whole; `nextAt` is the first line of the block after it (null at the end of the sheet) */
  const emit = (nextAt) => {
    const unit = build(), bytes = utf8Length(unit.text);
    if (!fits(units, bytes + ACQUIRE_TEXT_UNIT_ENVELOPE, room, maxUnits)) { stop = first; return false; }
    units.push(unit); room -= bytes + ACQUIRE_TEXT_UNIT_ENVELOPE; added += bytes; seq++;
    cur = []; curRows = []; size = 0;
    if (nextAt && units.length >= maxUnits) { stop = nextAt; return false; }
    return true;
  };
  const feed = (line, at) => {
    const room1 = at.line === 0 ? cap : limit;   /* the header line, a block of its own, has the whole cap */
    const l = line.length > room1 ? line.slice(0, room1) : line;   /* a row over the cap stays one cut row (R41) */
    if (cur.length && size + l.length + 1 > limit && !emit(at)) return false;
    if (!cur.length) first = at;
    cur.push(l); curRows.push(at.row); size += l.length + 1; last = at.row;
    return true;
  };

  let start = c.ob < c.he ? 0 : c.ob;          /* the chunk's first byte: a record boundary */
  let rowBase = c.ob < c.he ? 1 : c.rw;        /* the row of the record that begins it */
  let skip = c.ob < c.he ? c.li : c.sk;        /* lines the chunk gives that are before the next block */
  let lineIdx = c.ob < c.he ? 0 : c.li - c.sk;  /* the index, in the sheet's lines, of the chunk's first line */
  let head = null, eofSeen = false;
  while (!eofSeen && stop === null) {
    const withHead = start >= c.he;
    /* the chunk: from `start` to the first record boundary at or after its nominal size (and, from the start of the object, past
       the head), so the signatures read what they read over the whole */
    let end = null, starts = null, region = null;
    for (let want = windowBytes; end === null; want *= 2) {
      const aim = Math.max(start + want, withHead ? 0 : c.he);
      const len = Math.min(c.n - start, aim - start + CSV_SLACK_BYTES);
      const got = await rb(start, len);
      if (!got) return { gone: true };
      if (got.size !== null && got.size !== c.n) return mismatch();
      if (got.bytes.length !== len) return mismatch();
      const st = newScan(natural(c.dl) ? c.dl : 0x2c), bounds = [];
      scanBoundaries(got.bytes, start, st, bounds);
      const atEnd = start + len >= c.n;
      if (atEnd) finishScan(st, bounds);
      const at = bounds.find((b) => b >= aim && b < c.n);
      if (at !== undefined) { end = at; starts = [start, ...bounds.filter((b) => b < at)]; region = got.bytes.subarray(0, at - start); }
      else if (atEnd) { end = c.n; eofSeen = true; starts = [start, ...bounds.filter((b) => b < c.n)]; region = got.bytes; }
    }
    if (withHead && !head) {
      const h = await rb(0, c.he);
      if (!h || h.bytes.length !== c.he) return h ? mismatch() : { gone: true };
      head = h.bytes;
    }
    let input = region;
    if (withHead) { input = new Uint8Array(head.length + region.length); input.set(head, 0); input.set(region, head.length); }
    await yieldNow();   /* G82: the turn is given back before the entry's compute over the head and the chunk, and after it */
    /* K4868: the first piece of a read by range is handed the entry's answer over the head, which is the first chunk's bytes */
    const res = first0 && start === 0 && !withHead && region.length === first0.len ? first0.res : await entry.text(input, { inlineCellsMax: 0, yieldNow });
    await yieldNow();
    const sheet = res && res.ok !== false && Array.isArray(res.sheets) ? res.sheets[0] : null;
    if (!sheet || typeof sheet.text !== "string" || !Array.isArray(sheet.lineRows)) throw new Error("the csv entry gave no sheet for a window");
    if (ro && Number.isInteger(sheet.usedCols) && sheet.usedCols > cols) cols = sheet.usedCols;
    const rows = sheet.lineRows, all = rows.length ? sheet.text.split("\n") : [];
    if (all.length !== rows.length) throw new Error("the csv entry's lines and their rows differ for a window");
    if (headLine === null) {
      if (!all.length) return mismatch();
      headLine = all[0]; limit = cap - headLine.length - 1; headWords = wordsIn(headLine);
      if (limit < 1) return mismatch();
    }
    /* the lines of the chunk (the head's lines come first and are not the chunk's), each with where it is in the object */
    let prevJ = -1, inRec = 0;
    for (let t = 0; t < all.length && stop === null; t++) {
      const rel = rows[t] - (withHead ? c.hr : 0);
      if (rel < 1) continue;
      const j = rel - 1;
      if (j >= starts.length) throw new Error("the csv entry numbered a row past the window's records");
      inRec = j === prevJ ? inRec + 1 : 0; prevJ = j;
      const at = { offset: starts[j], row: rowBase + j, line: lineIdx, inRec };
      lineIdx++;
      if (skip > 0) { skip--; continue; }
      if (!feed(all[t], at)) break;
    }
    rowBase += starts.length;
    start = end;
    /* K4868: the first piece of a read by range ends with the head, whose bytes are already in hand: the rest is the next pieces' */
    if (first0 && stop === null && !eofSeen) {
      const nextAt = { offset: end, row: rowBase, line: lineIdx, inRec: 0 };
      if (cur.length ? emit(nextAt) : true) stop = stop ?? nextAt;
      break;
    }
  }
  if (stop === null && cur.length) emit(null);   /* the end of the sheet: its last block */
  let words = 0;
  for (const u of units) words += wordsOfUnit(u);
  const more = stop !== null;
  const read = ro && more ? stop.offset : c.rt + added;
  return { units,
           fields: { more,
                     cursor: more ? windowCursor(sha, { m: "c", n: c.n, ob: stop.offset, rw: stop.row, li: stop.line, sk: stop.inRec, bi: seq, rt: read,
                                                        tt: c.tt, he: c.he, hr: c.hr, lr: c.lr, lc: c.lc, rg: c.rg, sh: c.sh, ...(natural(c.dl) ? { dl: c.dl } : {}),
                                                        ...(ro ? { ro: 1, cn: cols, wr: c.wr + words } : {}) }) : null,
                     read_through: more ? read : c.tt, total: c.tt },
           piece: { units: units.length, words },
           /* the last piece of a read by range states the document's words, which the first could not (R35, R57) */
           ...(ro && !more ? { facts: { words_total: c.wr + words } } : {}) };
}
/* a column count as the letters a range names it by (1 is A, 27 is AA) */
function letterOf(n) { let s = ""; for (let k = Math.max(1, n); k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(65 + ((k - 1) % 26)) + s; return s; }

/* A later piece by a window cursor (R40): `{refused}` or `{gone}` (the object is not held) or the piece's units and fields. */
export async function windowTick(evidence, sha, c, ask, doc) {
  if (c.s !== sha || !natural(c.n) || c.n < 1) return mismatch();
  if (c.m === "t") return textWindowTick(evidence, sha, c, ask, c.ro === 1 ? rangeSource(evidence, doc) : null);
  if (c.m === "c") return csvWindowTick(evidence, sha, c, ask, c.ro === 1 ? rangeSource(evidence, doc) : null);
  return mismatch();
}

/* K4868 (fix round 9, R45): a CSV larger than a whole read holds (`WHOLE_READ_MAX`) and within its own bound (`READ_BOUNDS` csv) is read from its
   first piece by range: the head the entry's signatures read (to the first record boundary at or past `CSV_HEAD_BYTES`) gives the dialect and
   the reading's facts, and the units come from the windows (`csvWindowTick`), so neither the object nor its text is ever held whole. `null`
   when the capture is not one (another size or kind, an encoding or a record the windows cannot take): it is read, or refused, as before. */
export async function csvRangedHead(evidence, doc, { recorded, declared }) {
  const src = rangeSource(evidence, doc);
  if (!(Number.isInteger(src.size) && src.size > CSV_WINDOW_FROM && src.size <= boundOf("csv", "bytes"))) return null;
  if (!(recorded === null || recorded === "csv" || recorded === "undetermined")) return null;
  const probe = await src.readRange(0, Math.min(src.size, CSV_HEAD_BYTES + 2 * CSV_SLACK_BYTES));
  if (!(probe instanceof Uint8Array) || probe.length < CSV_HEAD_BYTES + 2 * CSV_SLACK_BYTES) return null;
  if (recorded !== "csv" && detectFormat(probe, declared).format !== "csv") return null;
  const entry = getFormat("csv");
  const dialect = entry && typeof entry.dialect === "function" ? await entry.dialect(probe) : null;
  if (!dialect) return null;
  const enc = dialect.encoding;
  if (!(enc === "utf-8" || enc === "us-ascii" || enc === null)) return null;
  const dl = DELIMITER_BYTE[dialect.delimiter] ?? 0x2c;
  const bounds = [], st = newScan(dl);
  scanBoundaries(probe, 0, st, bounds);
  const i = bounds.findIndex((b) => b >= CSV_HEAD_BYTES);
  /* the first window (to the record boundary, and the slack beyond it that finds one) lies inside the probe, so the first piece reads nothing more */
  if (i < 0 || bounds[i] >= src.size || bounds[i] + CSV_SLACK_BYTES > probe.length) return null;
  const cached = { size: src.size, readRange: async (o, n) => (natural(o) && natural(n) && o + n <= probe.length ? probe.subarray(o, o + n) : src.readRange(o, n)) };
  return { src: cached, size: src.size, he: bounds[i], hr: i + 1, dl, head: probe.subarray(0, bounds[i]) };
}

/* R50 (fix round 9, G131i; K4834): a text, JSON or XML larger than a whole text read holds (`TEXT_WINDOW_FROM`) and within the text bound (`READ_BOUNDS` text, the standard's
   100 MB, R66) is read from its first piece by range, as a CSV is: the head (the first window) gives the reading's facts and the grain, and each piece is a byte window with
   a carry (`textWindowTick`), so neither the object nor its text is held whole. UTF-8 and US-ASCII only; another encoding of such a size is stated against the whole-read
   ceiling. `null` when the capture is not one: it is read, or refused, as before. */
export async function textRangedHead(evidence, doc, { recorded, declared, textual, charset, htmlOnly = false }) {
  const src = rangeSource(evidence, doc);
  if (!(Number.isInteger(src.size) && src.size > TEXT_WINDOW_FROM && src.size <= boundOf("text", "bytes"))) return null;
  if (!textual || !(recorded === null || recorded === "undetermined" || recorded === "text" || recorded === "json" || recorded === "xml" || recorded === "html")) return null;
  const want = Math.min(src.size, WINDOW_BYTES + 4);
  const probe = await src.readRange(0, want);
  if (!(probe instanceof Uint8Array) || probe.length < want) return null;
  const bom16 = probe.length >= 2 && ((probe[0] === 0xff && probe[1] === 0xfe) || (probe[0] === 0xfe && probe[1] === 0xff));
  if (!bom16 && probe.includes(0) && !/^utf-16/i.test(charset || "")) {
    /* a NUL in the head: UTF-16 without a BOM, only if the decode says so below; a binary file is no text */
  }
  /* R51 (fix round 10; K5211): a web page is read here too, by the one streaming pass in windows (`htmlWindows`); its own meta charset is the page's declaration */
  const isHtml = !bom16 && !probe.includes(0) && detectFormat(probe, declared).format === "html";
  if (htmlOnly && !isHtml) return null;
  const d = decodeText(probe.subarray(0, probe.length - (probe.length % 2)), { declared: charset, name: charset, kind: isHtml ? "html" : "text" });
  if (!d.ok || d.replaced_ratio > REPLACED_TOLERANCE || !windowEncodable(d.encoding)) return null;
  const en = d.encoding === "us-ascii" ? "utf-8" : d.encoding;
  if (!/^utf-16/.test(en) && probe.includes(0)) return null;
  if (!isHtml && !/^utf-16/.test(en) && !TEXT_FORMATS.has(kindOfDetected(detectFormat(probe, declared)))) return null;
  const bm = en === "utf-8" ? (probe.length >= 3 && probe[0] === 0xef && probe[1] === 0xbb && probe[2] === 0xbf ? 3 : 0) : /^utf-16/.test(en) ? (bom16 ? 2 : 0) : 0;
  return { src, size: src.size, head: probe, bm, text: d.text, decoded: d, en: en === "utf-8" ? undefined : en, grain: grainOf(d.text, isHtml), ...(isHtml ? { html: true } : {}) };
}

/* R51 (fix round 10; K5211): the visible text of a web page past a whole read, made by the one streaming pass (html.mjs) from the page's byte windows, each decoded by the head's
   encoding (a character cut by a window's end goes on with the next) and handed on with the carry the pass keeps. The page is never held as one string or one byte array.
   `stats.replaced` counts the replacement characters the windows decoded (R49). Answers null when a window is not held (the caller states it, transient). */
export async function htmlVisibleByWindows(rt, windowBytes, stats) {
  const A = adapterFor(rt.en), size = rt.size;
  let gone = false;
  async function* chunks() {
    let off = rt.bm, rest = new Uint8Array(0);
    while (off < size || rest.length) {
      const len = Math.min(windowBytes, size - off);
      let got = new Uint8Array(0);
      if (len > 0) {
        const r = await rt.src.readRange(off, len);
        if (!(r instanceof Uint8Array && r.length === len)) { gone = true; return; }
        got = r; off += len;
      }
      let buf = got;
      if (rest.length) { buf = new Uint8Array(rest.length + got.length); buf.set(rest, 0); buf.set(got, rest.length); }
      const eof = off >= size;
      const end = eof ? buf.length : A.end(buf, 0, buf.length);
      rest = buf.slice(end);
      if (!end) { if (eof) return; continue; }
      const text = A.lenient(buf.subarray(0, end));
      if (stats) for (let at = text.indexOf("\ufffd"); at >= 0; at = text.indexOf("\ufffd", at + 1)) stats.replaced++;
      yield text;
    }
  }
  const visible = await visibleTextOfHtmlStream(chunks(), { yieldNow });
  return gone ? null : visible;
}

/* --- a PDF -------------------------------------------------------------------------------------------------------------- */

/* G68 (fix round 7): a PDF read in page ranges is opened ONCE for its pieces. pdf-reader's `openPdfRange(bytes)` (R44) does the
   whole-file read (the objects scanned, the object streams decoded, the page index built) a range needs, and answers
   `{ok, pages, range({from, count, maxBytes})}`, each range exactly what `extractPdfRange` answers. The open document is kept here
   between the pieces of one digest, for the next tick of the object that ran this one: one entry, replaced when another digest is
   opened, dropped when the last piece is read or a range fails. A tick that finds its digest open does not read the object. */
export let openedPdf = null;   /* {sha, opened} */
/* the split (PR 274): `reading-pipeline`'s `read` opens and lets go of the document through this */
export const setOpenedPdf = (v) => { openedPdf = v; };
export const HELD_OPEN = new Uint8Array(0);   /* stands for the bytes of a document that is open: they are not read again */

/* ===================================================================== *
 * A reading's title (R34).
 * ===================================================================== */

export const TITLE_MAX_CHARS = 200;

/* R34: a title is the text with markup removed and character references decoded as R32 decodes them (markup first,
   so a decoded `&lt;` is text), whitespace runs collapsed to one space, trimmed, at most TITLE_MAX_CHARS characters
   (code points); one with no glyph is none (null). */
function cleanTitle(s) {
  if (typeof s !== "string") return null;
  const bare = decodeReferences(s.replace(/<\/?[A-Za-z][^\s>/]*(?:"[^"]*"|'[^']*'|[^'">])*>/g, ""))
    .replace(/\s+/g, " ").trim();
  const t = [...bare].slice(0, TITLE_MAX_CHARS).join("").trimEnd();
  return glyphCount(t) > 0 ? t : null;
}

/* The inner markup of the first element named `names` (a regex alternation) in `markup` that has an end tag; a
   self-closing tag and a start tag with no end tag are no element. */
function firstElementInner(markup, names) {
  const open = new RegExp(`<(${names})(?=[\\s>/])((?:"[^"]*"|'[^']*'|[^'">])*)>`, "gi");
  for (let m = open.exec(markup); m; m = open.exec(markup)) {
    if (m[2].endsWith("/")) continue;
    const end = new RegExp(`</${m[1]}\\s*>`, "i").exec(markup.slice(open.lastIndex));
    if (end) return markup.slice(open.lastIndex, open.lastIndex + end.index);
  }
  return null;
}

/* R34: the title of a capture read as HTML: its first `<title>` element, else its first heading (`h1` to `h6`) in
   document order. Nothing inside a comment, `script`, `style` or `template` is a title; `head` is not dropped, since
   it is where the title is. A `<title>` that holds no glyph is none, and the heading is read in its place. */
export function titleOfHtml(html) {
  if (typeof html !== "string" || !html) return null;
  const live = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?(?:<\/\1\s*>|$)/gi, " ")
    .replace(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/g, " ");
  for (const names of ["title", "h[1-6]"]) {
    const t = cleanTitle(firstElementInner(live, names));
    if (t !== null) return t;
  }
  return null;
}

/* R34: the title a format entry's metadata states (R28), when it is a non-blank string, else null. */
export function titleOfMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? cleanTitle(metadata.title) : null;
}

/* ===================================================================== *
 * The reading (R1, R11).
 * ===================================================================== */

/* The references a reader emitted, as they appear (extraction R46): kind:key raw, never resolved; the position re-normalised
   by `readingSource` (FW-17 / IC-86), null where it does not normalise, never "the whole document". */
export const readEntities = (list) => (Array.isArray(list) ? list : []).map((e) => ({
  key: e && e.key != null ? String(e.key) : null,
  kind: e && e.kind != null ? e.kind : null,
  label: e && e.label != null ? e.label : null,
  facts: e && e.facts && typeof e.facts === "object" ? e.facts : {},
  ref: `${e && e.kind != null ? e.kind : ""}:${e && e.key != null ? e.key : ""}`,
  source: readingSource(e && e.source),
  ...(Array.isArray(e && e.occurrences) ? { occurrences: e.occurrences } : {}),
})).filter((e) => e.key != null || e.kind != null);

/* D-375 / N139 (R17): how much text the reader was handed, as three facts. `text_chars` is I2's `counts.chars`, the
   producer's claim; `text_glyphs` the glyphs of the text in hand (D-514: what "holds text" means here); and
   `text_undetermined` I2's `counts.undetermined`, the residue a producing tier marked unread, over the decode view
   (R3: an `image_unread` marker is no undecoded character). OBSERVATION-LOG-DESIGN §4.2's fourth outcome, a scan read
   to nothing, is told from a document read whole by these. Null where the text states no such figure; no text, no
   keys (null answered here); never a zero nothing counted. */
export function textCountsOf(text) {
  if (text == null) return null;
  if (typeof text === "string")
    return { text_chars: text.length, text_glyphs: glyphCount(text), text_undetermined: null };
  if (typeof text !== "object") return null;
  const c = decodeView(text).counts;
  const n = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  return { text_chars: n(c && c.chars),
           text_glyphs: typeof text.document === "string" ? glyphsOfDocument(text) : null,
           text_undetermined: n(c && c.undetermined) };
}

/* D-374 / N100 (R12): each page's box as pdf-reader answered it (its R33, `pageBoxes`), read whole or not at all: one
   box this wire cannot read makes the answer null, because a partial list would bound the pages it kept and silently
   not the rest. A page whose box the reader could not read is null in `of_page`, as it said. */
export function pageBoxesFrom(v) {
  if (!v || typeof v !== "object" || !Array.isArray(v.boxes) || !Array.isArray(v.of_page)) return null;
  const fin = (x) => typeof x === "number" && Number.isFinite(x);
  const boxes = [];
  for (const b of v.boxes) {
    const m = b && Array.isArray(b.media_box) && b.media_box.length === 4 && b.media_box.every(fin) ? b.media_box : null;
    if (!m || !(m[2] > m[0] && m[3] > m[1])) return null;
    boxes.push({ media_box: m.slice(), w: m[2] - m[0], h: m[3] - m[1],
                 rotate: [0, 90, 180, 270].includes(b.rotate) ? b.rotate : null });
  }
  const of_page = [];
  for (const i of v.of_page) {
    if (i !== null && !(Number.isInteger(i) && i >= 0 && i < boxes.length)) return null;
    of_page.push(i);
  }
  return { boxes, of_page };
}

/* R11 (G48; K4571, K4679): the sentence a reading's basis carries when its sheet was classified over a bounded view
   (`classified_over`, docprofile R19/R38): how much of the text the kind of document was judged from. A stand-in owed to
   UX-DESIGN (code-origin, `localize`); built here from the figures, never from docprofile's own `why`. */
export function classifiedOverSentence(co) {
  const n = (v) => String(Number.isFinite(v) ? v : 0);
  return localize("reading-pipeline.index.classified_over_sample",
    "the kind of document was judged from a sample of its text ({chars} of its {of} characters: its opening, {windows} stretches spread through it and its end); the whole text is read in pieces",
    { chars: n(co && co.chars), of: n(co && co.of), windows: n(Array.isArray(co && co.windows) ? co.windows.length : 0) });
}

/* R11: the reading a wired text produces. A determined reading carries `text_source` (the chain), `text_tier`,
   `text_container`, and a basis naming the reader, the chain, the tier, the tier-2 and tier-3 notes and where
   references were read; an undetermined one is a failed reading whose basis gives the tier notes and the entry's
   reason. `docType` is read only on the failed branch. */
export function readingFromWire({ wired, docType, chain, wiredTier, fmt, retrieved, tier2note, ocrNote,
                                  tier3Candidate = !!ocrNote }) {
  let reading = null;
  /* G48 (K4571, K4679): a sheet classified over a bounded view says so, on the reading and in its basis, never silently. */
  const sampled = wired && wired.classified_over && typeof wired.classified_over === "object" ? wired.classified_over : null;
  if (wired && wired.determined) {
    const { entities: wiredEntities, ...wrest } = (wired.parsed || {});
    const wfacts = (wrest && typeof wrest.facts === "object" && Object.keys(wrest).length === 1)
      ? wrest.facts : wrest;
    const entities = wired.parse_error ? [] : readEntities(wiredEntities);
    const wtype = wired.doctype.type;
    const positioned = entities.filter((e) => e.source).length;
    const posNote = !entities.length ? null
      : positioned === entities.length
        ? word("reading-pipeline.reference_carries_read", { positioned: String(positioned), entities: String(entities.length) })
        : positioned
          ? word("reading-pipeline.references_carry_read", { positioned: String(positioned), entities: String(entities.length) })
          : word("reading-pipeline.no_reference_carries_where_it", { position_why: String(wired.position_why
              || word("reading-pipeline.reader_say")) });
    reading = {
      content_type: wtype.key, reader_version: wtype.version ?? null,
      read_from_text: true, found: entities.length > 0,
      entities, facts: wired.parse_error ? {} : (wfacts || {}), at: retrieved,
      text_source: chain, text_tier: wiredTier, text_container: fmt,
      basis: (wired.parse_error
        ? word("reading-pipeline.why.reader_parse_text", { key: String(wtype.key), fmt: String(fmt), parse_error: String(wired.parse_error) })
        : (entities.length
            ? word("reading-pipeline.why.read_reader_tier", { key: String(wtype.key), version: String(wtype.version), fmt: String(fmt), chain: String(describeChain(chain)), wired_tier: String(wiredTier), why: String(wired.why) })
            : word("reading-pipeline.why.reader_found_entities", { key: String(wtype.key), fmt: String(fmt), wired_tier: String(wiredTier) })))
        + (tier2note ? ` — ${tier2note}` : "")
        + (ocrNote ? ` — ${ocrNote}` : "")
        + (posNote ? ` — ${posNote}` : "")
        + (sampled ? ` — ${classifiedOverSentence(sampled)}` : ""),
      ...(sampled ? { classified_over: sampled } : {}),
      ...(tier3Candidate ? { tier3_candidate: true } : {}),
      position_parts: wired.position_parts ?? 0,
      position_why: positioned ? null : (wired.position_why || null),
    };
  } else if (wired) {
    reading = {
      content_type: docType.type.key, reader_version: docType.type.version ?? null,
      read_from_text: false, found: false, entities: [], facts: {}, at: retrieved,
      text_source: chain, text_tier: wiredTier, text_container: fmt,
      basis: [tier2note, ocrNote ? `${ocrNote} (${wired.why})` : wired.why].filter(Boolean).join(" — "),
      ...(sampled ? { classified_over: sampled } : {}),
      ...(tier3Candidate ? { tier3_candidate: true } : {}),
    };
  }
  return reading;
}

/* ===================================================================== *
 * The container extent (R12).
 * ===================================================================== */

/* CAP-12 / COFF-12 / COFF-13 / FW-19 (R12): the container's own extent, READ off the I2 shape the entry returned,
   recognised by the keys it emitted (sheets, paragraphs, slides by list; tables, images by key), never re-derived.
   An integer or null, never a coercion; a list over the bound (empty) is NULL, never zero; `tables`/`images` empty
   is a measured zero and null is a walk that did not finish; the slide map is keyed on the unit's own `slide` and
   is as long as the deck's `deckLength`. For a PDF (D-420): the images its pages paint as `{page, rect}`, exhaustive
   or null with `images_why`. Null when the entry itemised nothing. */
export function containerExtentOf(i2text, { pdfPaints = null, fmt = null } = {}) {
  let containerExtent = null;
  if (i2text) {
    const has = (k) => Array.isArray(i2text[k]);
    const held = (k) => (has(k) && i2text[k].length ? i2text[k] : null);
    if (has("sheets") || has("paragraphs") || has("slides")) {
      const sh = held("sheets"), pa = held("paragraphs"), sl = held("slides");
      const deckLen = Number.isInteger(i2text.deckLength) && i2text.deckLength > 0 ? i2text.deckLength : null;
      const int = (v) => (Number.isInteger(v) ? v : null);
      const slideExtents = (units) => {
        let n = Math.max(units.length, deckLen ?? 0);
        for (const u of units) if (u && Number.isInteger(u.slide) && u.slide > n) n = u.slide;
        const out = Array.from({ length: n }, () => ({ shapes: null }));
        for (const u of units) {
          if (!(u && Number.isInteger(u.slide) && u.slide >= 1)) continue;
          out[u.slide - 1] = { shapes: int(u.shapes) };
        }
        return out;
      };
      const own = (k) => Object.prototype.hasOwnProperty.call(i2text, k);
      const tablesOf = (list) => (Array.isArray(list)
        ? list.map((t) => ({ rows: int(t && t.rows), cols: int(t && t.cols) })) : null);
      const imagesOf = (list) => (Array.isArray(list)
          && list.every((x) => x && typeof x.part === "string" && /^[0-9a-f]{64}$/.test(x.part))
        ? list.map((x) => ({ part: x.part, mime: typeof x.mime === "string" ? x.mime : null }))
        : null);
      containerExtent = {
        container: typeof i2text.container === "string" ? i2text.container : null,
        levels: [...["sheets", "paragraphs", "slides"].filter(has), ...["tables", "images"].filter(own)],
        sheets: sh ? sh.map((s) => ({
          name: s && typeof s.name === "string" ? s.name : null,
          rows: int(s && s.rows), cols: int(s && s.cols),
          usedRows: int(s && s.usedRows), usedCols: int(s && s.usedCols) })) : null,
        paragraphs: pa ? pa.length : null,
        slides: sl || deckLen ? slideExtents(sl || []) : null,
        ...(has("slides") && own("deckLength") ? { deckLength: deckLen } : {}),
        ...(own("tables") ? { tables: tablesOf(i2text.tables) } : {}),
        ...(own("images") ? { images: imagesOf(i2text.images) } : {}),
      };
    }
  }
  if (!containerExtent && pdfPaints && fmt === "pdf") {
    const placements = Array.isArray(pdfPaints.images)
        && pdfPaints.images.every((x) => x && Number.isInteger(x.page) && x.page >= 0
          && Array.isArray(x.rect) && x.rect.length === 4
          && x.rect.every((n) => typeof n === "number" && Number.isFinite(n)))
      ? pdfPaints.images.map((x) => ({ page: x.page, rect: x.rect.slice() }))
      : null;
    containerExtent = {
      container: "pdf", levels: ["images"], images: placements,
      ...(placements ? {} : { images_why: pdfPaints.why
        || localize("reading-pipeline.index.placement_not_read", "a placement the structure op reported could not be read as {shape}", { shape: "{page, rect}" }) }),
    };
  }
  return containerExtent;
}

/* ===================================================================== *
 * What the entry emitted beside the text (R28).
 * ===================================================================== */

/* R28 (T33-24; C:A-5; K1556): the entry's document `metadata` as it emitted it (office-readers R31), or null; and, for
   a workbook (a text with a `sheets` list), `cells`: each named sheet's cells as the entry emitted them
   (office-readers R30, odf-reader R46), or null where it emitted none (over its size guard). Neither is altered; a
   sheet with no name is no key, since a key would be one this module made up. N724 (K1972, K2092): for a `.docx`
   text (container `docx`), `cells` keyed by each table's `ref` (`table <n+1>`, office-readers R16), its cells as the
   entry emitted them (office-readers R11's `tables[].cells`), nested tables under their own keys as the entry lists
   them; `{}` for a body with no tables, and null when `tables` is null (the body not read, or over its size guard),
   three facts kept apart (R21). A table with no `ref` is no key, as a sheet with no name. No text, or no entry:
   metadata null and no `cells`; any other document: no `cells`. (G41, R44) A sheet the entry holds the cells of in the
   file, not in the reading (`cells` null and `cells_held` true), is named in `cells_held`, a list of sheet names, present
   only when there is one; its `cells` stays null, as for a sheet with no list. */
export function emittedFieldsOf(i2text) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const out = { metadata: isObj(i2text) && isObj(i2text.metadata) ? i2text.metadata : null };
  if (isObj(i2text) && Array.isArray(i2text.sheets)) {
    const cells = {}, held = [];
    for (const sh of i2text.sheets)
      if (isObj(sh) && typeof sh.name === "string") {
        cells[sh.name] = Array.isArray(sh.cells) ? sh.cells : null;
        /* R44: a sheet whose typed cells the entry holds in the file says so; a sheet with a cell list never does */
        if (sh.cells_held === true && !Array.isArray(sh.cells)) held.push(sh.name);
      }
    out.cells = cells;
    if (held.length) out.cells_held = held;
  } else if (isObj(i2text) && i2text.container === "docx") {
    if (!Array.isArray(i2text.tables)) out.cells = null;
    else {
      const cells = {};
      for (const t of i2text.tables)
        if (isObj(t) && typeof t.ref === "string" && t.ref) cells[t.ref] = Array.isArray(t.cells) ? t.cells : null;
      out.cells = cells;
      /* R47 (fix round 9, G128e; docs A9): an optional part that would take the reading past the stored bound is omitted with a
         statement of its size and the bound, and the units stay: a `.docx`'s table cells over INLINE_CELLS_MAX_BYTES (as JSON, the
         bound a workbook's entry holds its cells by) are `null` here, `cells_omitted` saying so; their held form is Stage 3's */
      const size = utf8Length(JSON.stringify(cells));
      if (size > INLINE_CELLS_MAX_BYTES) { out.cells = null; out.cells_omitted = { size, bound: INLINE_CELLS_MAX_BYTES }; }
    }
  }
  return out;
}

/* ===================================================================== *
 * read (R1–R17, R24).
 * ===================================================================== */

/* The document's own address, for the recognisers (R11): a Drive export's document address from Google's hop, an
   archive replay's from the archive's hop, else the locator. */
export function documentAddressOf(doc) {
  const chain = Array.isArray(doc && doc.provenance_chain) ? doc.provenance_chain : [];
  const drive = chain.find((h) => h && h.drive_file_id && typeof h.document_address === "string");
  if (drive) return drive.document_address;
  const arch = chain.find((h) => h && h.via === "archive.org" && typeof h.document_address === "string");
  return arch ? arch.document_address : (doc && typeof doc.locator === "string" ? doc.locator : null);
}

/* R10: Google's export hop, when the document's chain carries one; its format is what the conversion produced. */
export function driveHopOf(doc) {
  const chain = Array.isArray(doc && doc.provenance_chain) ? doc.provenance_chain : [];
  const h = chain.find((x) => x && x.drive_file_id && typeof x.export_format === "string");
  return h ? { format: h.export_format } : null;
}

/* N615 (K1773): the origin of the bytes of every capture `read` is handed (see `readInner`). */
export const CAPTURE_ORIGIN = "fetch";

/* `textCountsOf` of a long string, the glyphs counted a slice at a time with the turn given back between (G82); a slice never ends between the halves of a pair. */
export async function textCountsSliced(text) {
  let glyphs = 0;
  for (let at = 0; at < text.length;) {
    let end = Math.min(text.length, at + 512 * 1024);
    if (end < text.length && (text.charCodeAt(end - 1) & 0xfc00) === 0xd800 && (text.charCodeAt(end) & 0xfc00) === 0xdc00) end++;
    glyphs += glyphCount(text.slice(at, end));
    at = end;
    await yieldNow();
  }
  return { text_chars: text.length, text_glyphs: glyphs, text_undetermined: null };
}

/* G82 (fix round 7): the object has one thread, and a read of a big capture is several stretches of compute: between them the thread is
   given back (a timer turn, which lets the object's other requests run), when the capture is big enough to matter. */
export const BREATHE_AT = 256 * 1024;

export const breatheIf = (on) => (n) => (on && n > BREATHE_AT ? yieldNow() : undefined);   /* called as `if (piecesOn) await breathe(n)`: a read that is not in pieces is never suspended here */

export const failed = (doc, docType, basis, extra = {}) => ({
  content_type: docType ? docType.type.key : null, reader_version: docType ? (docType.type.version ?? null) : null,
  read_from_text: false, found: false, entities: [], facts: {}, at: doc && typeof doc.retrieved === "string" ? doc.retrieved : null,
  basis, ...extra });

/* R38, R54: what an entry's final refusal states of itself: its `reason` and the figures it measured (`pages`, `bytes`, `need_mb`,
   `limit_mb`; and a statement's own: `size`, `bound`, `key`, `part`, `kind`, `name`, `n`). Nothing else of it is the reading's; an
   answer that is not final or names no reason carries none. */
export function refusalOf(a) {
  if (!a || a.ok !== false || a.failure !== FAILURE_FINAL || typeof a.reason !== "string" || !a.reason) return null;
  const out = { reason: a.reason };
  for (const k of ["pages", "bytes", "need_mb", "limit_mb", "size", "bound", "n"]) if (Number.isFinite(a[k])) out[k] = a[k];
  for (const k of ["key", "part", "kind", "name", "metric"]) if (typeof a[k] === "string" && a[k]) out[k] = a[k].slice(0, 200);
  return out;
}

/* R54 (fix round 9, G135d): a size marker an entry left in its text (`undetermined[].guard`, ooxml's `textPlan` and csv-reader's
   `sizeMarker`: `{why, size, bound, ...}`, final) is the file's own refusal by a bound: it is stated as `TOO_LARGE {size, bound}`
   (a size over its bound) or `STRUCTURE_OVER_BOUND {part, bound}` (a count or structure over its bound), with the part it names, and
   never as "undecodable regions". Null when the text holds none. */
export function guardRefusalOf(i2text) {
  const marks = i2text && Array.isArray(i2text.undetermined) ? i2text.undetermined : [];
  for (const m of marks) {
    const g = m && typeof m === "object" ? (m.guard && typeof m.guard === "object" ? m.guard : m.final === true ? m : null) : null;
    if (!g || !Number.isFinite(g.bound)) continue;
    const part = typeof m.part === "string" ? m.part : typeof g.part === "string" ? g.part : null;
    const named = part ? { part: part.slice(0, 200) } : {};
    /* R60: the unit the figure measures is the reader's own (`metric`); a bound marker that names none is counted in what its `why` counts */
    const metric = typeof g.metric === "string" && g.metric ? g.metric : g.why === "TOO_MANY_OBJECTS" ? "objects" : g.why === "TOO_MANY_CHARACTERS" ? "characters" : "bytes";
    if (Number.isFinite(g.size) && (g.why === "over_size_bound" || g.metric !== undefined || g.boundName !== undefined))
      return { reason: "TOO_LARGE", size: g.size, bound: g.bound, metric, ...named, ...(typeof g.boundName === "string" ? { name: g.boundName } : {}) };
    if (typeof g.why === "string")
      return { reason: "STRUCTURE_OVER_BOUND", bound: g.bound, metric, ...(Number.isFinite(g.n) ? { n: g.n } : {}), ...named, name: g.why };
  }
  return null;
}

/* R60: the word for the unit a refusal's figure measures: `bytes`, `rows`, `columns`, `objects`, `cells`, as the reader states it (a reader's own
   longer name, `declared_uncompressed_text_part_bytes`, is its kind of count in plain words). */
function unitWordOf(metric) {
  if (typeof metric !== "string" || !metric) return "bytes";
  if (/bytes$/.test(metric)) return "bytes";
  if (/chars$/.test(metric)) return "characters";
  return metric.replace(/_/g, " ");
}

/* R54 (G135a, G135d, G135e): the sentence of a refusal that names its own cause and figures. Stand-ins until T52 (K4269); owed:
   `reading-pipeline.index.too_large`, `.structure_over_bound`, `.unsupported_<kind>`. A size sentence holds the file's size and the limit
   and never says "read" of a file that is not. */
export function refusalSentence(r) {
  if (r.reason === "TOO_LARGE" && Number.isInteger(r.parts) && r.parts > 1)
    return localize("reading-pipeline.index.too_large_in_parts", "This file is {size} bytes in {parts} parts, over the {bound} bytes allowed for this kind of file.", { size: String(r.size), parts: String(r.parts), bound: String(r.bound) });
  if (r.reason === "TOO_LARGE" && unitWordOf(r.metric) !== "bytes")
    return localize("reading-pipeline.index.too_large_units", "This file has {size} {unit}, over the {bound} {unit} allowed for this kind of file.", { size: String(r.size), bound: String(r.bound), unit: unitWordOf(r.metric) });
  if (r.reason === "TOO_LARGE")
    return localize("reading-pipeline.index.too_large", "This file is {size} bytes, over the {bound} bytes allowed for this kind of file.", { size: String(r.size), bound: String(r.bound) });
  if (r.reason === "STRUCTURE_OVER_BOUND" && typeof r.metric === "string" && r.metric)
    return localize("reading-pipeline.index.structure_over_bound_units", "{part} holds more than {bound} {unit}, past what is allowed for this kind of file.", { part: String(r.part || r.name || "This file"), bound: String(r.bound), unit: unitWordOf(r.metric) });
  if (r.reason === "STRUCTURE_OVER_BOUND")
    return localize("reading-pipeline.index.structure_over_bound", "{part} is over the {bound} allowed for this kind of file.", { part: String(r.part || r.name || ""), bound: String(r.bound) });
  return null;
}

/* R54 (G135a, G135e; K4831 (3)): a kind with no reader is named, by its bytes and the types it is declared as, and its reading is
   stated `final` with `UNSUPPORTED_FORMAT {kind}`: no "non-textual or too large", and nothing for "Read it" to repair. */
export const sig = (b, o, s) => b.length >= o + s.length && [...s].every((c, i) => b[o + i] === (typeof c === "number" ? c : c.charCodeAt(0)));
export function unreadKindOf(b, types, name = null) {
  if (!(b instanceof Uint8Array) || !b.length) return null;
  const t = types.filter((x) => typeof x === "string").join(" ").toLowerCase();
  /* R61: a file is declared Word by its type, or by its name where no type that is not text (and not the generic octet-stream) is declared */
  const declared = types.filter((x) => typeof x === "string" && x.trim()).map((x) => x.toLowerCase().split(";")[0].trim());
  const wordDeclared = /msword/.test(t) || (typeof name === "string" && /\.doc$/i.test(name.trim()) && declared.every((x) => x === "application/octet-stream" || x.startsWith("text/")));
  if (sig(b, 0, "GIF87a") || sig(b, 0, "GIF89a")) return "gif";
  if (sig(b, 0, [0x49, 0x49, 0x2a, 0]) || sig(b, 0, [0x4d, 0x4d, 0, 0x2a])) return "tiff";
  if (sig(b, 0, "RIFF") && sig(b, 8, "WEBP")) return "webp";
  if (sig(b, 4, "ftyp")) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (/^(?:heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand)) return "heic";
    if (/^avi[fs]$/.test(brand)) return "avif";
  }
  if (sig(b, 0, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a])) return "jp2";
  if (sig(b, 0, "BM") && b.length >= 30 && [12, 40, 52, 56, 64, 108, 124].includes(b[14] | (b[15] << 8)) && b[16] === 0) return "bmp";
  if (sig(b, 0, [0, 0, 1, 0]) && /image\/(?:x-icon|vnd\.microsoft\.icon)/.test(t)) return "ico";
  if (sig(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return /msword|\.doc\b/.test(t) ? "legacy_word" : /ms-excel|\.xls\b/.test(t) ? "legacy_excel" : /ms-powerpoint|\.ppt\b/.test(t) ? "legacy_powerpoint" : "legacy_office";
  const head = String.fromCharCode(...b.subarray(0, Math.min(b.length, 2048)));
  if (/^\s*\{\\rtf/.test(head) || /\b(?:text|application)\/rtf\b/.test(t)) return "rtf";
  if (/message\/rfc822/.test(t)) return "email";
  const lines = head.split(/\r?\n/).slice(0, 16);
  const hdr = lines.filter((l) => /^(?:Received|Return-Path|Delivered-To|MIME-Version|Message-ID|Date|From|To|Subject|Content-Type):\s/i.test(l)).length;
  if (hdr >= 4 && lines.some((l) => /^(?:From|Subject|To|MIME-Version):/i.test(l)) && /^[\w-]+:\s/.test(lines[0] || "")) return "email";
  /* R61: bytes that say nothing of their own kind, under a Word declaration: stated legacy Word (final, nothing to repair), never "not read as text" */
  return wordDeclared ? "legacy_word" : null;
}
export function unreadSentence(kind) {
  switch (kind) {
    case "rtf": return localize("reading-pipeline.index.unsupported_rtf", "RTF is not read yet.");
    case "email": return localize("reading-pipeline.index.unsupported_email", "Email is not read yet.");
    case "legacy_word": return localize("reading-pipeline.index.unsupported_legacy_word", "Legacy Word is not read yet.");
    case "legacy_excel": return localize("reading-pipeline.index.unsupported_legacy_excel", "Legacy Excel is not read yet.");
    case "legacy_powerpoint": return localize("reading-pipeline.index.unsupported_legacy_powerpoint", "Legacy PowerPoint is not read yet.");
    case "legacy_office": return localize("reading-pipeline.index.unsupported_legacy_office", "This older Office file is not read yet.");
    case "tiff": return localize("reading-pipeline.index.unsupported_tiff", "TIFF is not read yet.");
    case "gif": return localize("reading-pipeline.index.unsupported_gif", "GIF is not read yet.");
    case "webp": return localize("reading-pipeline.index.unsupported_webp", "WebP is not read yet.");
    case "heic": return localize("reading-pipeline.index.unsupported_heic", "HEIC is not read yet.");
    case "avif": return localize("reading-pipeline.index.unsupported_avif", "AVIF is not read yet.");
    case "bmp": return localize("reading-pipeline.index.unsupported_bmp", "BMP is not read yet.");
    case "jp2": return localize("reading-pipeline.index.unsupported_jp2", "JPEG 2000 is not read yet.");
    case "ico": return localize("reading-pipeline.index.unsupported_ico", "ICO is not read yet.");
    default: return localize("reading-pipeline.index.unsupported_kind", "{kind} is not read yet.", { kind: String(kind) });
  }
}

/* K4904 (2c item 8): `read(..., {skipKilled: true})` steps past the window `cursor` names, one that killed its reader three times: it reads nothing of it and answers
   `{units: [], next, more, counters: {written: 0, skipped: 1, owed: 0, failed: 0}, stated: {cursor, why: "UNIT_KILLED_READER"}}`, `next` the cursor of the following window
   (a list's next unit - a slide, a sheet block - or a text's next window), so the read goes on; the window is stated on the reading (`reading.killed_windows`) and said
   in a sentence (R-SILENT). A page keeps PAGE_KILLED_READER (the PDF's unit is a page). Null when the cursor is not one this steps (it is read as it is). */
export const UNIT_KILLED_READER = "UNIT_KILLED_READER";
export async function skipWindow(evidence, doc, cursor, windowBytes) {
  const c = unb64(cursor);
  const sha = doc && doc.capture && typeof doc.capture.sha256 === "string" ? doc.capture.sha256 : null;
  if (!c || c.v !== 1 || !sha || c.s !== sha) return null;
  let next = null, through = null, total = null, statedBytes = null;
  if (c.k === "u" && natural(c.n) && natural(c.i) && c.i < c.n) {
    if (c.i + 1 < c.n) next = b64({ v: 1, s: sha, k: "u", n: c.n, i: c.i + 1 });
    through = c.i + 1; total = c.n;
  } else if (c.k === "w" && c.m === "t" && natural(c.n) && natural(c.ob) && c.ob < c.n && natural(c.bm)) {
    /* a text's window: the next begins at the character after this window's bytes, inside a run (`md`), so its lines are not numbered on from here */
    let ob = Math.min(c.n, c.ob + (Number.isInteger(windowBytes) && windowBytes > 0 ? windowBytes : WINDOW_BYTES));
    if (ob < c.n) {
      const src = c.ro === 1 ? rangeSource(evidence, doc) : null;
      const got = src ? await src.readRange(ob, 4) : (await rangeBytes(evidence, sha, ob, 4))?.bytes;
      if (!(got instanceof Uint8Array)) return null;
      let i = 0; while (i < got.length && (got[i] & 0xc0) === 0x80) i++;
      ob += i;
    }
    if (ob < c.n) { const { v, k, s: ignored, ...rest } = c; next = windowCursor(sha, { ...rest, ob, md: 1, r: (c.r || 0) + 1, ld: 0 }); }
    through = ob - c.bm; total = c.n - c.bm;
  } else if (c.k === "w" && c.m === "c" && natural(c.n) && natural(c.ob) && c.ob < c.n && natural(c.dl)) {
    /* a CSV window: the next begins at the first row boundary at or after the window's bytes (the quote state scanned from the window's start, which is a row's), the dialect
       kept in the cursor; the bytes that were not read are stated as a range, and the rows after it numbered on from the next row read */
    const src = c.ro === 1 ? rangeSource(evidence, doc) : null;
    const win = Number.isInteger(windowBytes) && windowBytes > 0 ? windowBytes : WINDOW_BYTES;
    const want = Math.min(c.n, c.ob + win);
    let ob = c.n;
    if (want < c.n) {
      const st = newScan(c.dl), bounds = [];
      for (let take = win + CSV_SLACK_BYTES; ob === c.n; take *= 2) {
        const len = Math.min(take, c.n - c.ob);
        const got = src ? await src.readRange(c.ob, len) : (await rangeBytes(evidence, sha, c.ob, len))?.bytes;
        if (!(got instanceof Uint8Array)) return null;
        bounds.length = 0; Object.assign(st, newScan(c.dl)); scanBoundaries(got, c.ob, st, bounds);
        const hit = bounds.find((x) => x >= want);
        if (hit !== undefined) { ob = hit; break; }
        if (c.ob + len >= c.n) break;
      }
    }
    if (ob < c.n) { const { v, k, s: ignored, ...rest } = c; next = windowCursor(sha, { ...rest, ob }); }
    through = ob; total = c.n;
    statedBytes = [c.ob, ob];
  } else return null;
  const stated = { cursor, why: UNIT_KILLED_READER, ...(statedBytes ? { bytes: statedBytes } : {}) };
  return { text_units: [], more: next !== null, cursor: next, next, final: next === null ? true : undefined,
           read_through: through, total, piece: { units: 0, words: 0 }, stated,
           counters: { written: 0, skipped: 1, owed: 0, failed: 0 },
           reading: { killed_windows: [{ cursor, why: UNIT_KILLED_READER, ...(statedBytes ? { bytes: statedBytes } : {}) }],
                      killed_window_note: localize("reading-pipeline.index.unit_killed_reader", "A part of this document could not be read after three tries, so it is skipped and the rest goes on.") } };
}

/* R45, R46, R53 (fix round 9, G129a, G129b, G132): every answer in the reader contract's terms, added to what it was. `counters`
   `{written, skipped, owed, failed}`: the units carried, the units stated unread (left out of the wire and named, a page the OCR
   member refused or the caller stated killed, a replacement over the decode's tolerance), the units owed (OCR pages left, an unread
   picture inside a text page) and the read that failed; `next` the cursor of the next piece (null at the end); `final` when nothing
   more follows. A piece after the first that failed for a cause outside the document (`transient`) keeps the cursor it was asked
   with and `more`, so the ledger tries it again and never writes it as the end (R53); a piece that answers `more` with the cursor
   it was asked with advanced nothing and ends the entry, stated (R46). A refusal is answered as it was, with its counters. */
export function contractOf(out, asked) {
  if (!out || typeof out !== "object") return out;
  const rd = out.reading && typeof out.reading === "object" ? out.reading : null;
  const inPieces = asked !== undefined;
  if (inPieces && typeof asked === "string" && rd && rd.failure === FAILURE_TRANSIENT && out.more !== true) {
    Object.assign(out, { more: true, cursor: asked, piece: { units: 0, words: 0 } });
  }
  if (inPieces && out.more === true && out.cursor === asked && !(rd && rd.failure === FAILURE_TRANSIENT)) {
    const stated = rd || failed(null, null, "");
    Object.assign(stated, { failure: FAILURE_FINAL, reason: stated.reason || NO_PROGRESS,
      basis: localize("reading-pipeline.index.no_progress", "a piece of this document advanced nothing, so its reading ends here, stated, and is never shown as being read") });
    Object.assign(out, { reading: stated, more: false, cursor: null });
  }
  const units = Array.isArray(out.text_units) ? out.text_units.length : 0;
  const own = rd && Number.isInteger(rd.units_skipped) ? rd.units_skipped : 0;
  const owedPages = rd && rd.ocr_left && Number.isInteger(rd.ocr_left.pages) ? rd.ocr_left.pages : 0;
  const owedPictures = rd && Number.isInteger(rd.pictures_unread) ? rd.pictures_unread : 0;
  out.counters = { written: units, skipped: (Number.isInteger(out.text_units_over_bound) ? out.text_units_over_bound : 0) + own,
                   owed: owedPages + owedPictures, failed: rd && rd.failure === FAILURE_TRANSIENT ? 1 : 0 };
  const more = out.more === true;
  out.next = more ? out.cursor : null;
  if (!more && !(rd && rd.failure === FAILURE_TRANSIENT)) out.final = true;
  return out;
}

/* R48 (fix round 9, G128a, G128b; K4837): completeness from the counters and from nothing else. `whole` exactly when nothing more
   follows and nothing is skipped, owed or failed; `stated` for a reading refused whole (`refused`, or `final` with a failure and no
   units); `none` when nothing was offered; `partial` otherwise. */
export function completenessOf(counters, { more = false, final = false, refused = false, reading = null } = {}) {
  const c = counters && typeof counters === "object" ? counters : {};
  const n = (k) => (Number.isInteger(c[k]) && c[k] > 0 ? c[k] : 0);
  const statedWhole = refused || (final && !n("written") && !!reading && reading.failure === FAILURE_FINAL);
  if (statedWhole) return "stated";
  if (!more && !n("written") && !n("skipped") && !n("owed") && !n("failed")) return "none";
  return !more && !n("skipped") && !n("owed") && !n("failed") ? "whole" : "partial";
}

/* R37 (F10): the size of a held object, from the store's `head` when it answers one, else null. */
async function sizeHeld(evidence, digest) {
  try {
    const h = typeof evidence.head === "function" ? await evidence.head(digest) : null;
    return h && Number.isFinite(h.size) ? h.size : null;
  } catch { return null; }
}
/* `{bytes, why?, failure?}`. A failure is `transient` (R37: the object, or a part, is not held yet, or the parts cannot
   be assembled within MULTIPART_READ_MAX while no whole is held: it can be) or `final` (the capture is over WHOLE_READ_MAX
   and is never loaded: nothing later changes that). It throws only when the store does, which the caller marks transient. */
export async function bytesOf(evidence, doc, { kind = null, textual = false } = {}) {
  const whole = async (digest) => {
    const o = await evidence.get(digest);
    return o ? new Uint8Array(await o.arrayBuffer()) : null;
  };
  const parts = Array.isArray(doc.parts) ? doc.parts : null;
  const wholeSha = typeof (doc.capture && doc.capture.sha256) === "string" ? doc.capture.sha256 : null;
  const total = parts ? parts.reduce((n, p) => n + (Number.isFinite(p && p.bytes) ? p.bytes : 0), 0)
                      : (Number.isFinite(doc.capture && doc.capture.bytes) ? doc.capture.bytes : null);
  /* R37: a whole the object cannot hold is never loaded, whatever else is held; the size is the capture's own, else the
     store's. */
  /* R54 (G124a): the refusal names its cause and its two figures, the size and the limit, from the table (`statement`) */
  /* a CSV over its own bound is stated against that row (K4868), every other kind against the whole-load ceiling's */
  const tooBig = (size) => {
    /* a text, JSON or XML over its own bound is stated against that row (R50), a CSV against its (K4868), every other kind against the whole-load ceiling's */
    const row = kind === "csv" && size > boundOf("csv", "bytes") ? ["csv", "bytes"]
      : textual && size > boundOf("text", "bytes") ? ["text", "bytes"] : WHOLE_READ_ROW;
    const st = row[0] === "pdf" && ceiling !== WHOLE_READ_MAX ? { ...statement(ceiling === CSV_WINDOW_FROM ? "csv" : "text", "bytes", size), bound: ceiling } : statement(...row, size);
    return { bytes: null, failure: FAILURE_FINAL, stated: { reason: "TOO_LARGE", ...st, metric: "bytes" },
             why: refusalSentence({ reason: "TOO_LARGE", size, bound: st.bound, parts: parts ? parts.length : 1 }) };
  };
  /* R66: a text kind is held whole only to the text row's whole-read figure (`TEXT_WINDOW_FROM`); a text above it that the windows could not take (an encoding they do not carry) is stated, not loaded */
  const ceiling = textual && (kind === null || kind === "undetermined" || kind === "text" || kind === "json" || kind === "xml" || kind === "html") ? TEXT_WINDOW_FROM : kind === "csv" ? CSV_WINDOW_FROM : WHOLE_READ_MAX;
  if (total !== null && total > ceiling) return tooBig(total);
  /* the store is asked only when the document states no size */
  const held = wholeSha && total === null ? await sizeHeld(evidence, wholeSha) : null;
  if (held !== null && held > ceiling) return tooBig(held);
  if (!parts) { const b = await whole(doc.capture.sha256); return b ? { bytes: b, whole: true } : { bytes: b }; }
  /* R2 (T51 fix round 2, C5): the whole object held under the document's fingerprint is read first; parts are
     assembled, and bounded, only when none is held. */
  const got = wholeSha ? await whole(wholeSha).catch(() => null) : null;
  if (got) return { bytes: got, whole: true };
  /* R1: a textual capture is assembled as a single object of it is read, up to the whole-read ceiling; every other kind to the office entries' text bound */
  const assembleMax = textual ? ceiling : MULTIPART_READ_MAX;
  if (total > assembleMax)
    return { bytes: null, failure: FAILURE_TRANSIENT,
             why: word("reading-pipeline.why.capture_bytes_parts", { total: String(total), parts: String(parts.length), multipart_read_max: String(assembleMax) }) };
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    const b = p && typeof p.sha256 === "string" ? await whole(p.sha256) : null;
    if (!b) return { bytes: null, failure: FAILURE_TRANSIENT, why: word("reading-pipeline.why.part_held_evidence", { index_of: String(parts.indexOf(p) + 1), parts: String(parts.length) }) };
    out.set(b.subarray(0, Math.max(0, total - at)), at); at += b.length;
  }
  return at === total ? { bytes: out }
                      : { bytes: null, failure: FAILURE_TRANSIENT, why: word("reading-pipeline.why.parts_held_add") };
}

/* R2/R32 (fix round 5, E1): a declared type that is text, as acquisition's `profilesAsText` judges it; and the bytes as text
   when they are UTF-8 without a NUL, else null. */
export const TEXT_TYPE = /^(?:text\/|application\/(?:xhtml\+xml|xml|json)|application\/[a-z0-9.+-]*\+xml)/i;
/* R1: the formats a text declared as text can be detected as with no entry to read them (`html` is detected and read here, as text); every other detected format is read
   by its entry or is no text, whatever type the sender declared */
const READ_AS_TEXT = new Set(["json", "ndjson", "xml", "svg", "kml", "geojson", "ics", "vcf", "srt", "vtt"]);
export const TEXT_FORMATS = new Set([null, "undetermined", "text", "html", ...READ_AS_TEXT]);
/* T53-528 (`structured-text-reader` R8): these formats now have registry entries, but their answer is the reader's own shape (a `text` string, units by path) and not the
   `document` and `pages` the stages below read, so the pipeline reads their bytes as text, as it did when no entry existed (a JSON or XML file is still named `json` or `xml`
   in the reading's container); `getFormat` is asked for no other. Reported to BOB: wiring the reader's units is not in T53's entries for this module. */
export const entryFor = (fmt) => (fmt && fmt !== "undetermined" && !READ_AS_TEXT.has(fmt) ? getFormat(fmt) : null);
/* R49 (fix round 9, G131g; X9): every text read here is decoded by one rule, `ooxml.decodeText` (UTF-8 with or without a BOM, UTF-16
   with or without one, the declared or detected legacy charset), handed the charset the capture's type declares. Its answer, or
   `{ok: false, why: "ENCODING_UNSUPPORTED", name}`. A replacement over `REPLACED_TOLERANCE` of the characters makes the reading
   partial with the count (R49). */
export const REPLACED_TOLERANCE = 0.005;
export const charsetOf = (type) => { const m = /;\s*charset\s*=\s*"?([^";\s]+)/i.exec(typeof type === "string" ? type : ""); return m ? m[1] : null; };
export function decodedTextOf(bytes, type, kind) {
  return decodeText(bytes, { declared: charsetOf(type), name: charsetOf(type), kind });
}
/* R49, R54 (fix round 10, K5195): the name an encoding it cannot decode is refused by: the charset the type declares, else the one the text
   declares of itself (the XML prolog's `encoding`, an HTML `meta` charset, as `ooxml.decodeText` looks for it), else none. `ooxml.decodeText` echoes only the
   `name` it is handed, so a refusal for the page's own declaration would otherwise name nothing. */
export function declaredNameOf(bytes, type, kind) {
  const header = charsetOf(type);
  if (header) return header;
  if ((kind !== "xml" && kind !== "html") || !(bytes instanceof Uint8Array)) return null;
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, kind === "xml" ? 1024 : 4096));
  const m = kind === "xml"
    ? head.match(/^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([^"']+)["']/i)
    : head.match(/<meta\b[^>]*?\bcharset\s*=\s*["']?\s*([^\s"';>/]+)/i);
  return m ? m[1] : null;
}
/* R49: what the reading states of its decode. */
export const encodingFacts = (d) => (d && d.ok ? { encoding: d.encoding, encoding_assumed: d.assumed === true,
  ...(Array.isArray(d.disagree) && d.disagree.length ? { encoding_disagree: d.disagree.slice(0, 200) } : {}),
  ...(d.replaced ? { encoding_replaced: d.replaced } : {}) } : {});

/* R44 (fix round 6, G41; K4636, K4642): a range of a held sheet's typed cells, made from the held file when a member opens or
   cites it. `format` is the entry's key; `sheet`, `fromRow`, `toRow`, `fromCol`, `toCol` and `maxCells` pass to its `cellsIn`
   (csv-reader, office-readers), and its answer `{ok, cells, rows, next_row?}` is answered as it is. `{ok: false, reason}`
   with `cells_not_interpretable` for an entry without the slot (or none, or one that throws or answers no object), and
   `bytes_not_held` for bytes the store does not hold (transient, as `bytesOf` states it; a whole over WHOLE_READ_MAX
   carries `failure: "final"`). An entry's own refusal is answered `{ok: false, reason, why?}` (K4656): `reason` from its `why`
   when that is all it gives. It never throws. */
export async function cellsInRange(evidence, doc, { format, sheet, fromRow, toRow, fromCol, toCol, maxCells } = {}) {
  try {
    const entry = typeof format === "string" && format ? getFormat(format) : null;
    if (!entry || typeof entry.cellsIn !== "function")
      return { ok: false, reason: CELLS_NOT_INTERPRETABLE };
    let got;
    try {
      /* K4868: a CSV past a whole read's bound and within its own is held in the range source's one read (its cells are made by the entry, which
         reads it in windows); every other capture is `bytesOf`'s */
      const src = format === "csv" ? rangeSource(evidence, doc || {}) : null;
      if (src && Number.isInteger(src.size) && src.size > CSV_WINDOW_FROM && src.size <= boundOf("csv", "bytes")) {
        const all = await src.readRange(0, src.size);
        got = all instanceof Uint8Array && all.length === src.size ? { bytes: all } : { bytes: null, failure: FAILURE_TRANSIENT };
      } else got = await bytesOf(evidence, doc || {});
    }
    catch { return { ok: false, reason: BYTES_NOT_HELD, failure: FAILURE_TRANSIENT }; }
    if (!got || !got.bytes)
      return { ok: false, reason: BYTES_NOT_HELD, failure: (got && got.failure) || FAILURE_TRANSIENT, ...(got && got.why ? { why: got.why } : {}) };
    const ask = { sheet, fromRow, toRow, fromCol, toCol, maxCells };
    for (const k of Object.keys(ask)) if (ask[k] === undefined) delete ask[k];
    const out = await entry.cellsIn(got.bytes, ask);
    if (!out || typeof out !== "object" || typeof out.ok !== "boolean") return { ok: false, reason: CELLS_NOT_INTERPRETABLE };
    /* K4656: one refusal shape whatever the entry: `reason`, set from the entry's `why` when that is all it answers, `why` kept */
    if (out.ok === false && typeof out.reason !== "string") return { ...out, reason: typeof out.why === "string" ? out.why : CELLS_NOT_INTERPRETABLE };
    return out;
  } catch (e) {
    return { ok: false, reason: CELLS_NOT_INTERPRETABLE, why: String(e && e.message || e).slice(0, 200) };
  }
}

/* ===================================================================== *
 * Parts of a reading, and a part's own interpretation (R64, R65; T53-125; N1272).
 * ===================================================================== */

/* R65: a part is `{kind, from, to}` for `pdf-page` (pages from 0), `doc-para` (paragraphs from 0) and `slide` (slides from 1), or
   `{kind: "sheet-range", sheet, from_row, to_row}` (rows from 1), numbered in the reading's own extent (K5734); `extraction`'s `normalPart` keys it. */
export const PART_KINDS = Object.freeze(["pdf-page", "doc-para", "slide", "sheet-range"]);
/* R65: the most parts one reading names (a protective bound, stated with `truncated` and the count when passed) */
export const PARTS_MAX = 10000;
/* R65: the unit a part is opened in. A sheet's block is the rows whose cells one `cellsOf` call answers (`extraction` R98: CELLS_RANGE_MAX, 20,000 in-extent cells;
   the figure is that module's, a layer above this one, so it is held here as the unit of a block); a document without headings is named in runs of this many pages
   or paragraphs, a deck by the slide. */
const PART_BLOCK_CELLS = 20000;
const PART_RUN = { "pdf-page": 10, "doc-para": 50 };
const isInt = (n) => Number.isInteger(n);
const partKindOfUnit = (u) => (u && u.extent && u.extent.kind === "pdf-page" ? "pdf-page" : u && u.extent && u.extent.kind === "doc-para" ? "doc-para"
  : u && u.extent && u.extent.kind === "slide-shape" ? "slide" : null);
const placeOfUnit = (kind, u) => (kind === "pdf-page" ? u.extent.page : kind === "doc-para" ? u.extent.para : u.extent.slide);
const isHeadingUnit = (u) => !!u && (u.heading === true || u.kind === "heading");

/* R65: `partsOf(reading, {kind})` names the candidate parts of a reading (`reading` is a reading, with its `text_units` when the caller holds them): its sheets in row
   blocks, its pages, paragraphs or slides by heading when its units state headings (`heading: true`), else in runs. In document order, at most PARTS_MAX; `{parts, total,
   truncated, headings?}` (`headings[i]` the text of a headed part i, aligned with `parts`), and a reading naming none says so with `why`. A part has no weight. Never throws. */
export function partsOf(reading, { kind = null } = {}) {
  const r = reading && typeof reading === "object" ? (reading.reading && typeof reading.reading === "object" ? { ...reading.reading, text_units: reading.text_units ?? reading.reading.text_units } : reading) : {};
  const want = (k) => kind === null || kind === undefined || kind === k;
  const parts = [], headings = [];
  let headed = false;
  const add = (p, heading = null) => { parts.push(p); headings.push(heading); if (heading !== null) headed = true; };
  const ext = r.container_extent && typeof r.container_extent === "object" ? r.container_extent : null;
  const units = Array.isArray(r.text_units) ? r.text_units : [];
  /* sheets: row blocks of the sheet's unit size, in the order the sheets stand */
  if (want("sheet-range") && ext && Array.isArray(ext.sheets)) {
    for (const s of ext.sheets) {
      const rows = s && isInt(s.usedRows) ? s.usedRows : s && isInt(s.rows) ? s.rows : 0;
      const cols = s && isInt(s.usedCols) ? s.usedCols : s && isInt(s.cols) ? s.cols : 1;
      if (!(s && typeof s.name === "string" && rows > 0)) continue;
      const block = Math.max(1, Math.floor(PART_BLOCK_CELLS / Math.max(1, cols)));
      for (let from = 1; from <= rows; from += block) {
        add({ kind: "sheet-range", sheet: s.name, from_row: from, to_row: Math.min(rows, from + block - 1) });
      }
    }
  }
  /* pages, paragraphs and slides: by heading when the units state them, else by run (a slide by itself) */
  for (const k of ["pdf-page", "doc-para", "slide"]) {
    if (!want(k)) continue;
    const mine = units.filter((u) => partKindOfUnit(u) === k && isInt(placeOfUnit(k, u)));
    const first = k === "slide" ? 1 : 0;
    const count = k === "pdf-page" ? (isInt(r.page_count) && r.page_count > 0 ? r.page_count : null)
      : k === "doc-para" ? (ext && isInt(ext.paragraphs) ? ext.paragraphs : null)
      : (ext && Array.isArray(ext.slides) ? ext.slides.length : null);
    const last = Math.max(count !== null ? count - 1 + first : -1, ...mine.map((u) => placeOfUnit(k, u)));
    if (!mine.length && count === null) continue;
    if (last < first) continue;
    const heads = mine.filter(isHeadingUnit).sort((a, b) => placeOfUnit(k, a) - placeOfUnit(k, b));
    if (heads.length && k !== "slide") {
      const starts = [...new Set(heads.map((u) => placeOfUnit(k, u)))];
      starts.forEach((from, i) => {
        const text = heads.find((u) => placeOfUnit(k, u) === from).text;
        add({ kind: k, from, to: (i + 1 < starts.length ? starts[i + 1] - 1 : last) }, typeof text === "string" ? text.slice(0, 200) : "");
      });
    } else {
      const run = k === "slide" ? 1 : PART_RUN[k];
      for (let from = first; from <= last; from += run) add({ kind: k, from, to: Math.min(last, from + run - 1) });
    }
  }
  const total = parts.length;
  const truncated = total > PARTS_MAX;
  const shown = truncated ? parts.slice(0, PARTS_MAX) : parts;
  return { parts: shown, total: truncated ? total : shown.length, truncated, ...(headed ? { headings: (truncated ? headings.slice(0, PARTS_MAX) : headings) } : {}),
           ...(total === 0 ? { why: "NO_UNITS" } : {}) };
}

/* R64: `interpretUnits(document, part, {evidence, env, view})` makes the facts the record relies on from one part's units only, mechanically. A sheet part goes through
   `cellsInRange` (R44); a page, paragraph or slide part through the content type's reader (R1), handed the text of that part's units alone. `{ok: true, part, entities, facts,
   cells?, at, basis}`, `basis` saying which units were read; `{ok: false, reason}` for a part not of this document or a read that failed. The whole-document entities and facts
   of the reading (R1) stay the reading's own, for search, and are not touched. No AI is asked (no `transcription` is passed to the read) and no tier is added to what the
   document's reading already used (`env` is the caller's, as for `read`). Never throws. */
export async function interpretUnits(document, part, { evidence = null, env = {}, view, liveCalibration = null, read = null } = {}) {
  try {
    if (!part || typeof part !== "object" || !PART_KINDS.includes(part.kind)) return { ok: false, reason: "PART_NOT_VALID" };
    const at = document && typeof document.retrieved === "string" ? document.retrieved : null;
    if (part.kind === "sheet-range") {
      if (!(typeof part.sheet === "string" && part.sheet && isInt(part.from_row) && isInt(part.to_row) && part.from_row >= 1 && part.to_row >= part.from_row))
        return { ok: false, reason: "PART_NOT_VALID" };
      const recorded = document && document.profile ? document.profile.format : null;
      const format = typeof recorded === "string" ? recorded : recorded && typeof recorded.format === "string" ? recorded.format : null;
      const got = await cellsInRange(evidence, document, { format, sheet: part.sheet, fromRow: part.from_row, toRow: part.to_row });
      if (!got || got.ok !== true) return { ok: false, reason: got && got.reason ? got.reason : CELLS_NOT_INTERPRETABLE, ...(got && got.failure ? { failure: got.failure } : {}) };
      return { ok: true, part, entities: [], facts: {}, cells: got.cells, at,
               basis: localize("reading-pipeline.index.interpret_cells", "read from the cells of {sheet}, rows {from} to {to}", { sheet: part.sheet, from: String(part.from_row), to: String(part.to_row) }) };
    }
    if (!(isInt(part.from) && isInt(part.to) && part.from >= (part.kind === "slide" ? 1 : 0) && part.to >= part.from)) return { ok: false, reason: "PART_NOT_VALID" };
    /* the document's units, all of them (no wire budget), piece by piece when its reading is cut in pieces */
    const units = [];
    let cursor = null;
    for (let guard = 0; guard < 100000; guard++) {
      const out = typeof read === "function" ? await read(document, { evidence, env, view, liveCalibration, cursor, unitsBudget: Infinity, maxUnits: 1000000 }) : null;
      if (!out || !out.reading || out.reading.failure) return { ok: false, reason: "READING_FAILED", ...(out && out.reading && out.reading.failure ? { failure: out.reading.failure } : {}) };
      for (const u of (Array.isArray(out.text_units) ? out.text_units : [])) units.push(u);
      if (out.more !== true || typeof out.cursor !== "string") break;
      cursor = out.cursor;
    }
    const inPart = units.filter((u) => partKindOfUnit(u) === part.kind && isInt(placeOfUnit(part.kind, u)) && placeOfUnit(part.kind, u) >= part.from && placeOfUnit(part.kind, u) <= part.to);
    if (!inPart.length) return { ok: false, reason: "PART_HAS_NO_UNITS" };
    const text = inPart.map((u) => u.text).join("\n");
    const ct = document && document.capture && typeof document.capture.content_type === "string" ? document.capture.content_type : "";
    const ctx = { headers: {}, locator: documentAddressOf(document), content_type: ct || null, text, origin: CAPTURE_ORIGIN };
    const vw = view ? { view } : {};
    const stackId = identify(ctx);
    const docType = doctypeFor({ ...ctx, handler: stackId.handler, kind: stackId.kind, ...vw });
    let entities = [], facts = {};
    if (docType && docType.type && typeof docType.type.parse === "function") {
      const parsed = docType.type.parse({ ...ctx, handler: stackId.handler, at, ...vw }) || {};
      const { entities: e, ...rest } = parsed;
      facts = (rest && typeof rest.facts === "object" && Object.keys(rest).length === 1) ? rest.facts : rest;
      entities = readEntities(e);
    }
    return { ok: true, part, entities, facts: facts || {}, at,
             basis: localize("reading-pipeline.index.interpret_units", "read from {count} text unit(s), numbers {first} to {last}", { count: String(inPart.length), first: String(inPart[0].seq), last: String(inPart[inPart.length - 1].seq) }) };
  } catch (e) {
    return { ok: false, reason: "INTERPRETATION_FAILED", why: String(e && e.message || e).slice(0, 200) };
  }
}
