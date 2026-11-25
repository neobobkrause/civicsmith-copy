/* The FORMAT registry (I7, COFF-1) — the third axis, and the D-70 test.
 *
 * `BIO_Content_Framework_v0_10.md` §4 claims a new axis of variation costs a
 * registry entry rather than a rewrite, and D-70 records that the claim was
 * never exercised: no third axis had been added. FORMAT is that axis. This
 * module is the ONE place a format is known — one entry per format, and once
 * this landed the registry became the only dispatch: no format-specific
 * if-branch outside it at either dispatch site (acquire-time detection in
 * index.mjs's subresource branch, read-time structure in op=pdfstructure).
 * Adding a format is `registerFormat(entry)` here and NOTHING anywhere else;
 * `formats.test.mjs` proves it with a test-only stub that becomes reachable
 * through detect→structure with zero edits outside this file.
 *
 * THE ENTRY SHAPE (I7, confirmed from this file as built):
 *
 *   format      string — the registry key ("html", "pdf", ...).
 *   detect(bytes, contentType) -> { format, confidence, signals } | null
 *               REQUIRED. Called by detectFormat() in TWO passes — bytes only,
 *               then content type only — so magic-bytes-first is enforced by
 *               the REGISTRY, structurally, not left to each entry's manners.
 *               A byte-signature match answers `certain`; a content-type-only
 *               match answers `likely` at best. null = "not mine".
 *   parts(container) -> named parts | null
 *               The container walk. null for formats that are their own
 *               container (PDF: structure() takes the assembled bytes) —
 *               COFF-2's OOXML reader is the first real implementor.
 *   structure(parts) -> the I2 shape (links + element references) | null
 *               null for formats whose structure is produced elsewhere (HTML:
 *               at acquire time, by the subresource walk in subresources.mjs,
 *               which needs the live-fetch context this read-time seam does
 *               not have).
 *   text(parts) -> the I2 text shape | null
 *               null when text rides structure()'s own output object (PDF:
 *               CPDF-4's Tier 1 text extends the same I2 object — the
 *               do-not-fork rule in pdfstructure.mjs).
 *   dialect(bytes) -> the entry's decoding choice | null      OPTIONAL (REC-218)
 *               Only an entry that DECODES text makes one (today `csv`): the
 *               encoding and delimiter it would read these bytes in, from
 *               signatures alone, in the same shape its text() emits as
 *               `dialect`. The acquire wire asks it for a body read as text at
 *               intake, where text() never runs, and keeps the answer as
 *               `reading.dialect` through `readingDialect` below. An entry
 *               without the slot makes no decoding choice and the reading
 *               carries no dialect key.
 *
 * Doctrine carried from the axes already built (I7):
 *   - MAGIC BYTES FIRST, content type second. A source's declared Content-Type
 *     is frequently wrong and may be absent (I1).
 *   - `undetermined` is first-class: nothing matched -> a STATED undetermined
 *     with the reasons in `signals`, never a guessed format.
 *   - An entry asserts nothing about MEANING (FRAMEWORK's, through I2) and
 *     WRITES nothing (the fleet rule, one layer down).
 */

import { extractPdfStructure } from "./pdfstructure.mjs";
import { docxEntry } from "./docx.mjs";
import { xlsxEntry } from "./formats-xlsx.mjs";
import { pptxEntry } from "./pptx.mjs";
import { odtEntry, odsEntry, odpEntry } from "./odf.mjs";
import { csvEntry } from "./csv.mjs";
import * as csv from "./csv.mjs";
import * as ooxml from "./ooxml.mjs";
import { localize } from "./setup-words/index.mjs";

/* Registration order is dispatch order within a pass: the first entry whose
   detect() answers wins that pass. Kept insertion-ordered by Map. */
const REGISTRY = new Map();

export function registerFormat(entry) {
  if (!entry || typeof entry.format !== "string" || !entry.format)
    throw new Error("a format entry must name its format");
  if (typeof entry.detect !== "function")
    throw new Error(`format "${entry.format}": detect(bytes, contentType) is required`);
  for (const slot of ["parts", "structure", "text"]) {
    if (entry[slot] != null && typeof entry[slot] !== "function")
      throw new Error(`format "${entry.format}": ${slot} must be a function or null`);
  }
  if (REGISTRY.has(entry.format))
    throw new Error(`format "${entry.format}" is already registered; unregister it first`);
  REGISTRY.set(entry.format, entry);
  return entry;
}

/* Exists for this registry's OWN suite (the stub teardown and the automated
   half of the negative control). It touches only in-memory dispatch; the
   record holds no registry state to corrupt. Returns the removed entry so a
   test can restore exactly what it took out. */
export function unregisterFormat(format) {
  const entry = REGISTRY.get(format) || null;
  REGISTRY.delete(format);
  return entry;
}

export function getFormat(format) {
  return REGISTRY.get(format) || null;
}

export function listFormats() {
  return [...REGISTRY.keys()];
}

/* The registry-level recogniser. THREE passes, and the order is the doctrine:
 *
 *   pass 1 — bytes only.        Every entry is asked detect(bytes, null).
 *   pass 2 — content type only. Every entry is asked detect(null, contentType).
 *   pass 3 — name and head.     Only when bytes and a name were given: csv-reader's
 *            `isDelimitedText(name, contentType, head)` (its R21). A sheet has no
 *            magic bytes and its declared type is often a general one
 *            (`application/vnd.ms-excel`, `octet-stream`, `text/plain`), so the
 *            name and the shape of the head decide, and only when no entry above
 *            claimed the bytes: bytes never override a binary format (G130b; S-10).
 *
 * So a byte signature ALWAYS outranks a declared content type, whatever any
 * individual entry does — a renamed plain ZIP is not a .docx, and a PDF served
 * as text/html is a PDF. Nothing matched -> a stated `undetermined` carrying
 * WHY in signals, never a guess.
 *
 * Either argument may be absent (null): the acquire-time subresource guard
 * consults with the content type only, because at that seam the primary has
 * deliberately not been read back yet; the profile stamp consults with both.
 *
 * `bytes` may be a RANGE SOURCE `{size, readRange(offset, length) -> Promise<
 * Uint8Array>}` instead (G130c; X5, R32): the answer is then a Promise, judged from
 * the head for the signatures and, for a container, from the end record and the
 * central directory through `readRange` (ooxml's `discriminate`), so an office file
 * of any size is recognised and never taken for undetermined from its first KiB. */
const HEAD_MAX = 1 << 20;
/* The confidence the entries give the same bytes whole: an OpenDocument file is `certain` (its stored mimetype is read
   from the directory), an OPC package or a plain ZIP `likely` (the content-type map is deflated). */
const ODF_FORMATS = new Set(["odt", "ods", "odp"]);
const CONTAINER_FORMATS = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp", "zip"]);

function undetermined(b, ct) {
  return {
    format: "undetermined",
    confidence: "none",
    signals: [
      b ? localize("format-registry.formats.no_magic_byte_match", "no registered magic-byte signature matched") : localize("format-registry.formats.no_bytes_to_sniff", "no bytes were available to sniff"),
      ct ? localize("format-registry.formats.content_type_ct_matched_no", "content type \"{ct}\" matched no registered format", { ct: String(ct) }) : localize("format-registry.formats.no_content_type_declared", "no content type was declared"),
    ],
  };
}

/* Passes 2 and 3 and the stated undetermined, once pass 1 has missed. `b` is the
   bytes (or, for a range source, its head) or null. */
function afterBytes(b, ct, nm) {
  if (ct) {
    for (const entry of REGISTRY.values()) {
      const r = entry.detect(null, ct);
      if (r && r.format) return r;
    }
  }
  if (b && nm && REGISTRY.has("csv") && csv.isDelimitedText(nm, ct, b.subarray(0, HEAD_MAX))) {
    return { format: "csv", confidence: "likely",
             signals: [localize("format-registry.formats.name_and_delimited_head", "name \"{name}\" and a head of delimited text", { name: String(nm) })] };
  }
  return undetermined(b, ct);
}

function isRangeSource(x) {
  try {
    return !!x && typeof x === "object" && !(x instanceof Uint8Array) && typeof x.readRange === "function"
      && Number.isFinite(x.size);
  } catch { return false; }
}

async function detectRange(src, ct, nm) {
  const size = src.size;
  if (size <= 0) return afterBytes(null, ct, nm);
  const got = await src.readRange(0, Math.min(size, HEAD_MAX));
  const head = got instanceof Uint8Array && got.length ? got : null;
  if (!head) return afterBytes(null, ct, nm);
  if (size <= HEAD_MAX) return detectFormat(head, ct, nm);
  let container = null;
  for (const entry of REGISTRY.values()) {
    let r;
    if (CONTAINER_FORMATS.has(entry.format)) {
      container ??= await ooxml.discriminate({ size, read: (o, n) => src.readRange(o, n) }, null);
      r = container && container.ok === true && container.format === entry.format
        ? { format: entry.format, confidence: ODF_FORMATS.has(entry.format) ? "certain" : "likely",
            signals: [localize("format-registry.formats.container_judged_from_end", "judged from the end record and the central directory of {size} bytes", { size: String(size) }),
                      ...(Array.isArray(container.signals) ? container.signals.filter((x) => typeof x === "string") : [])] }
        : null;
    } else r = entry.detect(head, null);
    if (r && r.format) return r;
  }
  return afterBytes(head, ct, nm);
}

export function detectFormat(bytes, contentType, name) {
  if (isRangeSource(bytes)) {
    const ct = typeof contentType === "string" && contentType ? contentType : null;
    const nm = typeof name === "string" && name ? name : null;
    return detectRange(bytes, ct, nm);
  }
  const b = bytes instanceof Uint8Array && bytes.length ? bytes : null;
  const ct = typeof contentType === "string" && contentType ? contentType : null;
  const nm = typeof name === "string" && name ? name : null;
  if (b) {
    for (const entry of REGISTRY.values()) {
      const r = entry.detect(b, null);
      if (r && r.format) return r;
    }
  }
  return afterBytes(b, ct, nm);
}

/* ------------------------------------------------------------------ *
 * The entries. HTML and PDF — the two formats the plane already spoke,
 * moved onto the registry by COFF-1 with NO new capability.
 * ------------------------------------------------------------------ */

/* THE PICTURE ENTRIES (T43; N853b, K2611, K2691) — a JPEG or PNG file, such as
   a photographed page, read as ONE picture page with no text layer: the same
   `no_text_layer` marker a scanned PDF page carries, so the reading path treats
   a photo exactly as an un-OCR'd scan, with no format branch outside this
   registry. They DECODE NOTHING: a picture's pixels are `pdf-pixels`' to make
   (its `renderPictureToPixels`), never this registry's. Detected by the
   format's own signature at offset 0, `certain`; with no bytes, by the exact
   content type, `likely`. REGISTERED FIRST (G130a; S14): a picture's signature
   is at offset 0 and decides, so a JPEG whose comment segment holds `%PDF-1.4`
   or whose EXIF holds `<html`, and a PNG with `%PDF-` in a tEXt chunk, are
   pictures and never taken for the PDF or the web page that the 1 KiB scans of
   those two entries would otherwise find in them. No other entry's signature
   can begin with either of theirs. HEIC and TIFF are not registered (N853b §2
   (a)): they stay `undetermined`. */
function pictureEntry(format, signature, contentType, refusal) {
  const signed = (bytes) => bytes instanceof Uint8Array && bytes.length >= signature.length
    && signature.every((b, i) => bytes[i] === b);
  const hex = signature.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  return {
    format,
    detect(bytes, ct) {
      if (bytes) {
        return signed(bytes)
          ? { format, confidence: "certain", signals: [localize("format-registry.formats.magic_hex_at_offset_0", "magic: {hex} at offset 0", { hex: String(hex) })] }
          : null;
      }
      if (ct === contentType)
        return { format, confidence: "likely", signals: [`content type "${contentType}"`] };
      return null;
    },
    parts: null,
    /* One page, page 0, unread: the shape pdf-reader's Tier-1 text gives a
       page with no text layer (its R14), fresh on every call. */
    structure: async (bytes) => {
      if (!signed(bytes)) return { ok: false, container: format, reason: refusal };
      const m = { page: 0, reason: "no_text_layer", font: null, codes: "", count: 0 };
      return { ok: true, pages: 1,
               text: { document: "", pages: [{ page: 0, text: "", undetermined: [m] }],
                       undetermined: [m], counts: { chars: 0, undetermined: 1 } } };
    },
    text: null,
  };
}

registerFormat(pictureEntry("jpeg", [0xff, 0xd8, 0xff], "image/jpeg", "NOT_A_JPEG"));
registerFormat(pictureEntry("png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png", "NOT_A_PNG"));

const LATIN1 = new TextDecoder("latin1");

/* The exact pair the acquire-time guard compared against before COFF-1 moved
   it here (index.mjs's former HTML_CT constant). Compared EXACTLY, not
   case-folded, so the guard's behaviour is byte-identically what it was. */
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

/* Does the text of `bytes`' first KiB open with an HTML root? The decode is
   ooxml's one `decodeText` (G131g; its R36): UTF-8 or UTF-16 by BOM, else the
   legacy charset. Leading comments and an XML declaration are skipped; one
   that does not end inside the KiB leaves the root unseen, so the answer is no. */
const HTML_HEAD_BYTES = 1024;
function startsAsHtml(bytes) {
  const d = ooxml.decodeText(bytes.subarray(0, HTML_HEAD_BYTES), { kind: "html" });
  if (!d || d.ok !== true || typeof d.text !== "string") return false;
  let t = d.text.toLowerCase();
  for (;;) {
    t = t.replace(/^[\s\uFEFF]+/, "");
    if (t.startsWith("<!--")) {
      const e = t.indexOf("-->", 4);
      if (e < 0) return false;
      t = t.slice(e + 3);
    } else if (t.startsWith("<?xml")) {
      const e = t.indexOf("?>");
      if (e < 0) return false;
      t = t.slice(e + 2);
    } else break;
  }
  return /^<!doctype html(?=[\s>]|$)/.test(t) || /^<html(?=[\s>/]|$)/.test(t);
}

registerFormat({
  format: "html",
  detect(bytes, contentType) {
    if (bytes) {
      /* The root decides (G141; X27): the first KiB, decoded as text, must BEGIN
         with a doctype or an <html> tag, after a BOM, white space and any
         comments or XML declaration. A note, an e-mail or a code sample that
         merely MENTIONS `<html>` is text and is read as text. */
      return startsAsHtml(bytes)
        ? { format: "html", confidence: "certain",
            signals: [localize("format-registry.formats.magic_doctype_root_tag", "magic: doctype/root tag in the first 1024 bytes")] }
        : null;
    }
    if (contentType && HTML_CONTENT_TYPES.includes(contentType))
      return { format: "html", confidence: "likely",
               signals: [`content type "${contentType}"`] };
    return null;
  },
  /* HTML structure is produced at ACQUIRE time by the subresource walk
     (subresources.mjs), which needs the live-fetch context a read-time entry
     does not have. The registry consult at that site is detection only; the
     subresource branch stays HTML-only in behaviour (COFF-1's pin). */
  parts: null,
  structure: null,
  text: null,
});

registerFormat({
  format: "pdf",
  detect(bytes, contentType) {
    if (bytes) {
      /* %PDF- within the first 1024 bytes — the same window extractPdfStructure
         itself accepts, so detect and structure cannot disagree about what a
         PDF is. */
      /* Not a file that begins with the ZIP local-file magic (K4900; R20): a ZIP archive whose first
         member is a PDF stored uncompressed carries `%PDF-` inside that window and is the ZIP of
         R28 (or the office or ODF kind its entries make it), never a PDF. */
      if (!ooxml.hasZipMagic(bytes) && LATIN1.decode(bytes.subarray(0, 1024)).includes("%PDF-"))
        return { format: "pdf", confidence: "certain",
                 signals: ["magic: %PDF- header in the first 1024 bytes"] };
      return null;
    }
    if (contentType === "application/pdf")
      return { format: "pdf", confidence: "likely",
               signals: ['content type "application/pdf"'] };
    return null;
  },
  /* A PDF is its own container: structure() takes the assembled bytes, so a
     separate parts() walk would be a slot with nothing to do. */
  parts: null,
  /* pdfstructure.mjs IS the PDF entry (COFF-1). Byte-identical output: this is
     the same function op=pdfstructure always called, now reached through the
     registry instead of a direct import in index.mjs. */
  structure: (bytes) => extractPdfStructure(bytes),
  /* Tier 1 text rides structure()'s own I2 output object (`text` on the same
     object — pdfstructure.mjs's do-not-fork rule), so a second entry point
     would be a fork of exactly the kind that rule exists to prevent. */
  text: null,
});

/* docx.mjs IS the DOCX entry (COFF-4): detect's confidence ladder, the parts
   walk over ooxml.mjs, I2 structure through the ONE linkWrapper with
   {kind:"doc-para"} references (IC-1), <w:t> text in body order, and the
   DEC-5 evidentiary envelope (tracked changes, comments, core properties). */
registerFormat(docxEntry);

/* The XLSX entry (COFF-3) — defined in formats-xlsx.mjs, registered here and
   NOWHERE else: adding the format costs this one call (the D-70 property). */
registerFormat(xlsxEntry);

/* pptx.mjs IS the PPTX entry (COFF-5): the same detect ladder, the parts walk
   over ooxml.mjs, I2 structure through the ONE linkWrapper with
   {kind:"slide-shape"} references (IC-1), <a:t> text per slide, and the DEC-5
   evidentiary envelope (SPEAKER NOTES distinct from slide text, core
   properties). */
registerFormat(pptxEntry);

/* THE THREE OPENDOCUMENT ENTRIES (COFF-10, 2026-09-14) — `odf.mjs`, reading
   COFF-9's `partMap:"odf"` discrimination and ONE `content.xml` part into the
   SAME I2 shape and DEC-5 envelope the OOXML sibling of each kind produces:
   `.odt` → docx.mjs's paragraphs and `doc-para` references, `.ods` →
   formats-xlsx.mjs's sheets and `sheet-cell` references, `.odp` → pptx.mjs's
   slides and `slide-shape` references. No new IC-1 union member; I7 is
   CONFIRMED by three more entries in the existing shape, not changed.
   Warranted by Bob's 2026-09-14 Drive ruling (a Drive link keeps the link and
   the harvest is the OpenDocument export), not by the census — COFF-6's ZERO
   native ODF assets in 43,282 keys stands unrevised.

   THESE THREE CALLS ARE THE ENTIRE COST OF THE FORMAT, which is the D-70
   property this registry exists to keep: `index.mjs` never learns the names
   "odt", "ods" or "odp", and `formats-odf.test.mjs` asserts that by grepping
   the source for them and finding none. Registration order matters only
   within a pass, and these three cannot collide with each other — each
   answers on its own `mimetype` value, compared exactly. */
registerFormat(odtEntry);
registerFormat(odsEntry);
registerFormat(odpEntry);

/* THE CSV ENTRY (FW-23, 2026-09-24) — `csv.mjs`, designed by BOB #32 and
   written from a MEASURED page: all 166 `.csv` keys of `s3://cao-94612`,
   fetched whole (M-144). It is the ninth entry and the first that is NOT a
   container: one sheet, `sheet-cell` / `sheet-range` references (no new IC-1
   union member), the delimiter and the encoding found by SIGNATURE and
   recorded on the reading, undetermined when the bytes do not tell.

   ITS DETECT ANSWERS ONLY IN PASS 2, ON PURPOSE AND FROM A MEASUREMENT: a CSV
   has no magic bytes, and the shape a byte signature would match is a shape
   PROSE WEARS — 5 of 8 planted non-CSV text shapes fired the candidate
   signature, a hard-wrapped paragraph among them. So `csvEntry.detect`
   returns null for ANY bytes and the format is claimed from the declared
   content type alone, which 166 of 166 corpus keys carried. Registration
   order is therefore immaterial for this entry in pass 1, and in pass 2 no
   registered entry claims `text/csv`. */
registerFormat(csvEntry);

/* THE ZIP ENTRY (T35-11; N688, K1844, K1852) — a plain ZIP archive, recognised
   so that it can be opened on capture: `acquisition` cuts its members, each a
   capture of its own (Intake §3). It is the twelfth entry and registered LAST,
   so every office and OpenDocument entry is asked first in each pass.

   DETECT IS `ooxml.discriminate`'S `format:"zip"`, ANSWERED SYNCHRONOUSLY:
   ZIP magic, a central directory `readContainer` can read, and in it neither
   an OPC content-type map nor a `mimetype` member — the same lookups
   discriminate makes before it would inflate anything, so the two cannot
   disagree, and no part is ever inflated here. Anything carrying either
   declaration is an office or ODF file (or an undetermined one), never `zip`.
   "likely", not "certain": the archive is not opened until `parts()`.

   `parts` is `listArchive` (ooxml R27-R28), its answer unchanged. `structure`
   and `text` are null: a member is read as its own capture, never through
   this entry. */
const ZIP_CONTENT_TYPES = ["application/zip", "application/x-zip-compressed"];

registerFormat({
  format: "zip",
  detect(bytes, contentType) {
    if (bytes) {
      if (!ooxml.hasZipMagic(bytes)) return null;
      const container = ooxml.readContainer(bytes);
      if (!container.ok) return null;
      const { CONTENT_TYPES_PART: opcMap, ODF_MIMETYPE_PART: odfMime } = ooxml;
      if (container.byName.has(opcMap)) return null;
      if (container.byName.has(odfMime)
        || container.entries.some((e) => ooxml.normalizePartName(e.name) === odfMime)) return null;
      return { format: "zip", confidence: "likely",
               signals: ["magic: PK\\x03\\x04 with a readable central directory",
                         `part: ${opcMap} absent`, `part: ${odfMime} absent`,
                         `entries: ${container.count}`] };
    }
    if (contentType && ZIP_CONTENT_TYPES.includes(contentType))
      return { format: "zip", confidence: "likely",
               signals: [`content type "${contentType}"`] };
    return null;
  },
  parts: (bytes) => ooxml.listArchive(bytes),
  structure: null,
  text: null,
});

/* REC-218 — THE DIALECT AS THE RECORD KEEPS IT (BOB #33, 2026-09-24 21:55Z,
   option (b)): a `reading.dialect` key of its OWN, `{delimiter, encoding}`,
   persisted on the acquire document — NOT inside `container_extent`, which
   says what a container ITEMISES, and not inside a reading's provenance,
   which says WHO read which text. The dialect is a third fact: the decoding
   choice the entry made before any text existed. It is written here, on the
   registry, and not in `csv.mjs`, because the ruling suits ANY text format
   with a decoding choice; the next such entry emits a `dialect` and the
   record keeps it with no edit anywhere else.

   A PROJECTION OF NAMED KEYS, never the entry's object verbatim: the record
   holds exactly the notion the ruling names plus the reason when either half
   could not be told, so a later key an entry adds does not reach the record
   by accident. EACH HALF IS A STRING OR NULL, NEVER COERCED — a null is
   UNDETERMINED, and `undetermined` carries the entry's own reason codes
   (`encoding_undetermined`, `delimiter_undetermined_tied`, ...) beside the
   signals that led there. Nothing is guessed to fill a null.

   Returns null when the entry emitted something that is not a dialect object:
   the key is then PRESENT AND NULL on the reading (an entry answered and this
   record cannot state what), which is a different fact from ABSENT (no entry
   with a decoding choice ever read this document). */
export function readingDialect(emitted) {
  /* NEVER THROWS (R16), even on an object whose key read throws (a getter, a
     revoked Proxy): a key that cannot be read is a key that holds no value of
     the named type, so it projects as null / [] like any other. */
  try {
    if (!emitted || typeof emitted !== "object" || Array.isArray(emitted)) return null;
  } catch { return null; }
  const get = (k) => { try { return emitted[k]; } catch { return undefined; } };
  const str = (k) => { const v = get(k); return typeof v === "string" && v ? v : null; };
  const strs = (k) => {
    try {
      const v = get(k);
      return Array.isArray(v) ? Array.prototype.filter.call(v, (s) => typeof s === "string") : [];
    } catch { return []; }
  };
  /* G131c, G131g: whether the encoding was assumed (a boolean or null) and the offsets of
     the windows whose encoding or delimiter differ from the file's (finite numbers only). */
  const assumed = get("assumed");
  const nums = () => {
    try {
      const v = get("disagree");
      return Array.isArray(v) ? Array.prototype.filter.call(v, (n) => typeof n === "number" && Number.isFinite(n)) : [];
    } catch { return []; }
  };
  return {
    delimiter: str("delimiter"),
    encoding: str("encoding"),
    confidence: { delimiter: str("delimiterConfidence"), encoding: str("encodingConfidence") },
    signals: { delimiter: strs("delimiterSignals"), encoding: strs("encodingSignals") },
    undetermined: strs("undetermined"),
    assumed: typeof assumed === "boolean" ? assumed : null,
    disagree: nums(),
  };
}
