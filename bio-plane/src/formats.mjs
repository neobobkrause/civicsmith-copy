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
import { STRUCTURED_TEXT_ENTRIES } from "./structured-text-reader/index.mjs";
import { MAIL_ENTRIES } from "./mail-reader/index.mjs";
import * as csv from "./csv.mjs";
import * as ooxml from "./ooxml.mjs";
import { localize, word, hasWord } from "./setup-words/index.mjs";
import { READ_BOUNDS, boundOf } from "./read-bounds.mjs";

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

/* Passes 2 and 3, the fallback entries (`text`) and the stated answer, once pass 1 and the classifier have missed. `b` is the
   bytes (or, for a range source, its head) or null. With bytes and no answer the file is `unlisted` with no name and its
   reasons (R38, K5436); with no bytes it is R12's `undetermined`. */
function afterBytes(b, ct, nm) {
  if (ct) {
    for (const entry of REGISTRY.values()) {
      if (entry.fallback) continue;
      const r = entry.detect(null, ct);
      if (r && r.format) return r;
    }
  }
  if (b && nm && REGISTRY.has("csv")) {
    const head = b.subarray(0, HEAD_MAX);
    if (csv.isDelimitedText(nm, ct, head)
      || (SHEET_EXTENSIONS.has(extensionOf(nm)) && looksText(head) && csv.isDelimitedText("content.csv", ct ?? "application/octet-stream", head))) {
      return { format: "csv", confidence: "likely",
               signals: [localize("format-registry.formats.name_and_delimited_head", "name \"{name}\" and a head of delimited text", { name: String(nm) })] };
    }
  }
  if (b) {
    for (const entry of REGISTRY.values()) {
      if (!entry.fallback) continue;
      const r = entry.detect(b, null);
      if (r && r.format) return r;
    }
    /* The roster's closure (R38; K5436): a registry that holds the fallback `text` entry closes on a held, unnamed `unlisted`;
       a registry without it keeps R12's stated `undetermined`. */
    const u = undetermined(b, ct);
    if (REGISTRY.has("text") && REGISTRY.get("text").fallback) return { format: "unlisted", named: null, confidence: "none", signals: u.signals };
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
  if (size <= HEAD_MAX) return detectBytes(head, ct, nm);
  let container = null;
  for (const entry of REGISTRY.values()) {
    if (entry.fallback) continue;
    let r;
    if (CONTAINER_FORMATS.has(entry.format)) {
      container ??= await ooxml.discriminate({ size, read: (o, n) => src.readRange(o, n) }, null);
      r = container && container.ok === true && container.format === entry.format
        ? { format: entry.format, confidence: ODF_FORMATS.has(entry.format) ? "certain" : "likely",
            ...(container.variant ? { variant: container.variant } : {}),
            signals: [localize("format-registry.formats.container_judged_from_end", "judged from the end record and the central directory of {size} bytes", { size: String(size) }),
                      ...(Array.isArray(container.signals) ? container.signals.filter((x) => typeof x === "string") : [])] }
        : null;
    } else r = entry.detect(head, null);
    if (r && r.format) {
      if (r.format === "pdf" && !r.encrypted) {
        const tail = await src.readRange(Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES));
        if (tail instanceof Uint8Array && PDF_ENCRYPT.test(LATIN1.decode(tail))) r = encryptedOf(r, "/Encrypt in the trailer");
      }
      return r;
    }
  }
  return afterBytes(head, ct, nm);
}

/* Pass 1 over bytes, then the classifier of the unlisted and refused kinds, then passes 2 and 3 (afterBytes). */
function detectBytes(b, ct, nm) {
  for (const entry of REGISTRY.values()) {
    if (entry.fallback) continue;
    const r = entry.detect(b, null);
    if (r && r.format) return refine(r, b);
  }
  return classify(b, nm, ct) ?? afterBytes(b, ct, nm);
}

export function detectFormat(bytes, contentType, name) {
  const ct = typeof contentType === "string" && contentType ? contentType : null;
  const nm = typeof name === "string" && name ? name : null;
  if (isRangeSource(bytes)) return detectRange(bytes, ct, nm).then((r) => noteDisagreement(r, nm));
  const b = bytes instanceof Uint8Array && bytes.length ? bytes : null;
  return noteDisagreement(b ? detectBytes(b, ct, nm) : afterBytes(null, ct, nm), nm);
}

/* ------------------------------------------------------------------ *
 * The entries. HTML and PDF — the two formats the plane already spoke,
 * moved onto the registry by COFF-1 with NO new capability.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * T53 (N1266; R33–R43): the beta's roster by content, the classifier of the kinds
 * not on it, encrypted and macro answers, and the one table of kind names.
 * ------------------------------------------------------------------ */

const TAIL_BYTES = 65536;
const PDF_ENCRYPT = /\/Encrypt(?:\s+\d+\s+\d+\s+R|\s*<<)/;
const startsAt = (b, sig, at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const u16at = (b, o) => b[o] | (b[o + 1] << 8);
const u32at = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const hexOf = (sig) => sig.map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");
const magicSignal = (hex, at) => localize("format-registry.formats.magic_hex_at_offset", "magic: {hex} at offset {at}", { hex: String(hex), at: String(at) });
const certain = (format, ...signals) => ({ format, confidence: "certain", signals });

export function extensionOf(name) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name ?? ""));
  return m ? m[1].toLowerCase() : "";
}
const SHEET_EXTENSIONS = new Set(["xls", "xlsx", "xlsm", "xlsb", "ods", "xltx"]);

/* Valid text in a known encoding: a UTF-16 head by its BOM, else no NUL and almost no control code (R35). A binary file
   is never text. */
function looksText(bytes) {
  const head = bytes.subarray(0, 65536);
  if (!head.length) return false;
  const bom16 = (head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff);
  if (!bom16) {
    let ctl = 0;
    for (const x of head) {
      if (x === 0) return false;
      if ((x < 9) || (x > 13 && x < 32 && x !== 27) || x === 127) ctl++;
    }
    if (ctl * 200 > head.length) return false;
  }
  const d = ooxml.decodeText(head, { kind: "text" });
  return !!d && d.ok === true && d.replaced_ratio < 0.01;
}

/* ---- an MS-CFB compound file: the stream and storage names of its directory (legacy Word, Excel, PowerPoint, Visio, ...) */
const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const CFB_CACHE = new WeakMap();
function cfbNames(bytes) {
  if (CFB_CACHE.has(bytes)) return CFB_CACHE.get(bytes);
  let names = null;
  if (startsAt(bytes, CFB_SIG) && bytes.length >= 512) {
    names = [];
    const shift = u16at(bytes, 30), size = 1 << shift;
    if (shift === 9 || shift === 12) {
      const at = (sec) => (sec + 1) * size;
      const fat = [];
      const nFat = Math.min(u32at(bytes, 44), 109);
      for (let i = 0; i < nFat; i++) {
        const sec = u32at(bytes, 76 + 4 * i);
        if (at(sec) + size > bytes.length) break;
        for (let o = 0; o < size; o += 4) fat[sec * (size / 4) + o / 4] = u32at(bytes, at(sec) + o);
      }
      let sec = u32at(bytes, 48);
      for (let hops = 0; hops < 4096 && sec < 0xfffffffa && at(sec) + size <= bytes.length; hops++) {
        for (let o = 0; o + 128 <= size; o += 128) {
          const e = at(sec) + o, len = u16at(bytes, e + 64);
          if (len >= 2 && len <= 64 && bytes[e + 66] !== 0)
            names.push(new TextDecoder("utf-16le").decode(bytes.subarray(e, e + len - 2)));
        }
        const next = fat[sec];
        if (next === undefined) break;
        sec = next;
      }
    }
  }
  CFB_CACHE.set(bytes, names);
  return names;
}

function cfbEntry(format, stream, label, contentTypes) {
  return {
    format,
    detect(bytes, ct) {
      if (bytes) {
        const names = cfbNames(bytes);
        return names && stream.some((n) => names.includes(n)) ? certain(format, magicSignal(hexOf(CFB_SIG), 0), `stream: ${label}`) : null;
      }
      return contentTypes.includes(ct) ? { format, confidence: "likely", signals: [`content type "${ct}"`] } : null;
    },
    parts: null, structure: null, text: null,
  };
}

/* ---- the pictures and archives with a signature of their own (R33): found here, read by the container */
function signedEntry(format, match, hex, at, contentTypes) {
  return {
    format,
    detect(bytes, ct) {
      if (bytes) return match(bytes) ? certain(format, magicSignal(hex, at)) : null;
      return contentTypes.includes(ct) ? { format, confidence: "likely", signals: [`content type "${ct}"`] } : null;
    },
    parts: null, structure: null, text: null,
  };
}
const sigMatch = (sig, at = 0) => (b) => startsAt(b, sig, at);
const ftypBrand = (b) => (b.length >= 12 && startsAt(b, ascii("ftyp"), 4) ? String.fromCharCode(...b.subarray(8, 12)) : null);
const HEIC_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"];
const HEIF_BRANDS = ["mif1", "msf1", "heif"];
const AVIF_BRANDS = ["avif", "avis"];
const BMP_DIB = new Set([12, 40, 52, 56, 64, 108, 124]);

const PICTURE_ENTRIES = [
  signedEntry("gif", (b) => startsAt(b, ascii("GIF87a")) || startsAt(b, ascii("GIF89a")), "47 49 46 38 37|39 61", 0, ["image/gif"]),
  signedEntry("tiff", (b) => startsAt(b, [0x49, 0x49, 0x2a, 0]) || startsAt(b, [0x4d, 0x4d, 0, 0x2a])
    || startsAt(b, [0x49, 0x49, 0x2b, 0]) || startsAt(b, [0x4d, 0x4d, 0, 0x2b]), "49 49 2A 00|4D 4D 00 2A", 0, ["image/tiff"]),
  signedEntry("webp", (b) => startsAt(b, ascii("RIFF")) && startsAt(b, ascii("WEBP"), 8), "52 49 46 46 .. .. .. .. 57 45 42 50", 0, ["image/webp"]),
  signedEntry("bmp", (b) => b.length >= 26 && b[0] === 0x42 && b[1] === 0x4d && u32at(b, 6) === 0 && BMP_DIB.has(u32at(b, 14)), "42 4D", 0, ["image/bmp", "image/x-ms-bmp"]),
  signedEntry("jp2", sigMatch([0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]), "00 00 00 0C 6A 50 20 20 0D 0A 87 0A", 0, ["image/jp2"]),
  signedEntry("heic", (b) => HEIC_BRANDS.includes(ftypBrand(b)), "ftyp heic", 4, ["image/heic"]),
  signedEntry("heif", (b) => HEIF_BRANDS.includes(ftypBrand(b)), "ftyp mif1", 4, ["image/heif"]),
  signedEntry("avif", (b) => AVIF_BRANDS.includes(ftypBrand(b)), "ftyp avif", 4, ["image/avif"]),
];
const RTF = signedEntry("rtf", sigMatch(ascii("{\\rtf")), "7B 5C 72 74 66", 0, ["application/rtf", "text/rtf"]);
const ARCHIVE_ENTRIES = [
  signedEntry("tar", sigMatch(ascii("ustar"), 257), "75 73 74 61 72", 257, ["application/x-tar"]),
  signedEntry("gz", sigMatch([0x1f, 0x8b, 0x08]), "1F 8B 08", 0, ["application/gzip", "application/x-gzip"]),
  signedEntry("7z", sigMatch([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), "37 7A BC AF 27 1C", 0, ["application/x-7z-compressed"]),
];

/* `text`: valid text that no entry above claimed (R35). A FALLBACK entry: asked after the content-type and name passes, so a
   sheet or a web page declared as text is still read as what it is declared (R31), and a binary file is never text. */
const TEXT_ENTRY = {
  format: "text",
  fallback: true,
  detect(bytes) {
    return bytes && looksText(bytes)
      ? certain("text", localize("format-registry.formats.valid_text_no_structure", "valid text in a known encoding with no other leading structure"))
      : null;
  },
  parts: null, structure: null, text: null,
};

/* ---- answers that carry more than a format: encrypted (R37), macros and templates (R36) */
const encryptedOf = (r, why) => ({ ...r, encrypted: true, signals: [...r.signals, why] });
const OFFICE_BASE = { docx: "word/", xlsx: "xl/", pptx: "ppt/" };
const OFFICE_FLAVOURS = { docx: ["docm", "dotx"], xlsx: ["xlsm", "xltx"], pptx: ["pptm", "potx"] };
const TEMPLATE_TYPES = new Map([
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml", "dotx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml", "xltx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.template.main+xml", "potx"],
]);

/* [Content_Types].xml of a package, read synchronously when it is stored or the host can inflate it; else null. */
function contentTypesText(bytes, container) {
  const e = container.byName.get(ooxml.CONTENT_TYPES_PART);
  if (!e || e.uncompressedSize > 1048576 || (e.flags & 0x2041) !== 0) return null;
  const lh = e.localHeaderOffset;
  if (!startsAt(bytes, [0x50, 0x4b, 3, 4], lh)) return null;
  const start = lh + 30 + u16at(bytes, lh + 26) + u16at(bytes, lh + 28);
  const raw = bytes.subarray(start, start + e.compressedSize);
  try {
    if (e.method === 0) return new TextDecoder().decode(raw);
    const zlib = globalThis.process?.getBuiltinModule?.("node:zlib");
    return e.method === 8 && zlib ? new TextDecoder().decode(zlib.inflateRawSync(raw, { maxOutputLength: 1048576 })) : null;
  } catch { return null; }
}

/* A hit of pass 1 judged further from the same bytes: a package with a VBA project is `macro`, a template `template`
   (both read as their base format, R36), an encrypted ZIP or PDF is `encrypted`, and a ZIP that is a known kind of
   another module's (EPUB, Apple, Visio, Excel binary, a jar, an apk) is that kind (R37, R38, R39). */
function refine(r, bytes) {
  if (r.format === "pdf") {
    const seen = bytes.length <= 2 * TAIL_BYTES ? LATIN1.decode(bytes)
      : `${LATIN1.decode(bytes.subarray(0, TAIL_BYTES))}\n${LATIN1.decode(bytes.subarray(bytes.length - TAIL_BYTES))}`;
    return PDF_ENCRYPT.test(seen) ? encryptedOf(r, localize("format-registry.formats.encrypt_in_trailer", "/Encrypt in the trailer")) : r;
  }
  const base = OFFICE_BASE[r.format];
  if (base) {
    const c = ooxml.readContainer(bytes);
    if (!c.ok) return r;
    let out = r;
    const macros = c.entries.some((e) => /(^|\/)vbaProject\.bin$/i.test(e.name));
    const types = contentTypesText(bytes, c);
    const template = types ? [...TEMPLATE_TYPES].find(([t]) => types.includes(t)) : null;
    if (macros) {
      out = { ...out, variant: "macro", macros: true, flavour: OFFICE_FLAVOURS[r.format][0],
              signals: [...out.signals, localize("format-registry.formats.vba_project_present", "a VBA project is in the package; nothing is run")] };
    } else if (template) {
      out = { ...out, variant: "template", flavour: template[1],
              signals: [...out.signals, localize("format-registry.formats.template_package", "the package is a template")] };
    }
    return out;
  }
  if (r.format === "zip") {
    const c = ooxml.readContainer(bytes);
    if (!c.ok) return r;
    return zipKind(bytes, c) ?? ((c.entries.some((e) => (e.flags & 0x2041) !== 0 || e.method === 99))
      ? encryptedOf(r, localize("format-registry.formats.member_encrypted", "a member is encrypted")) : r);
  }
  return r;
}

const hasName = (c, test) => c.entries.some((e) => test(ooxml.normalizePartName(e.name)));
function zipKind(bytes, c) {
  const unlisted = (named, why) => ({ format: "unlisted", named, confidence: "certain", signals: [why] });
  const refused = (kind, reason, why) => ({ format: "refused", kind, reason, confidence: "certain", signals: [why] });
  if (c.byName.has("mimetype")) {
    const m = new TextDecoder().decode(bytes.subarray(30 + 8, 30 + 8 + 20));
    if (m.startsWith("application/epub+zip")) return unlisted("epub", localize("format-registry.formats.epub_mimetype", "the first member is the EPUB mimetype"));
  }
  if (hasName(c, (n) => n === "xl/workbook.bin")) return unlisted("xlsb", localize("format-registry.formats.part_xl_workbook_bin", "part: xl/workbook.bin"));
  if (hasName(c, (n) => n === "visio/document.xml")) return unlisted("vsdx", localize("format-registry.formats.part_visio_document", "part: visio/document.xml"));
  if (hasName(c, (n) => /^index\/[^/]*\.iwa$/i.test(n) || n === "Index.zip" || n.startsWith("Index/Tables/")))
    return unlisted(hasName(c, (n) => n.startsWith("Index/Tables/")) ? "numbers" : hasName(c, (n) => /^Index\/Slide/i.test(n)) ? "key" : "pages",
      localize("format-registry.formats.part_iwork_index", "part: an Apple iWork Index"));
  if (hasName(c, (n) => n === "AndroidManifest.xml") && hasName(c, (n) => /^classes\d*\.dex$/.test(n)))
    return refused("apk", "runs", localize("format-registry.formats.part_android_manifest", "part: AndroidManifest.xml and classes.dex"));
  if (hasName(c, (n) => n.toUpperCase() === "META-INF/MANIFEST.MF") && !c.byName.has(ooxml.CONTENT_TYPES_PART))
    return refused("jar", "runs", localize("format-registry.formats.part_jar_manifest", "part: META-INF/MANIFEST.MF"));
  return null;
}

/* The kinds not on the roster, by signature: held and named (`unlisted`, R38) or not kept (`refused`, R39). Null when
   the bytes are none of them. Never looks at the name for a binary format (R34); a script has no signature, so a shebang,
   `@echo off`, or a script name on valid text decides, and says so. */
const UNLISTED_SIGNATURES = [
  ["pst", (b) => startsAt(b, ascii("!BDN")), "21 42 44 4E", 0],
  ["mdb", (b) => startsAt(b, [0, 1, 0, 0]) && startsAt(b, ascii("Standard Jet DB"), 4), "Standard Jet DB", 4],
  ["accdb", (b) => startsAt(b, ascii("Standard ACE DB"), 4), "Standard ACE DB", 4],
  ["gpkg", (b) => startsAt(b, ascii("SQLite format 3\0")) && startsAt(b, ascii("GPKG"), 68), "GPKG", 68],
  ["sqlite", (b) => startsAt(b, ascii("SQLite format 3\0")), "53 51 4C 69 74 65", 0],
  ["parquet", (b) => startsAt(b, ascii("PAR1")), "50 41 52 31", 0],
  ["wpd", (b) => startsAt(b, [0xff, 0x57, 0x50, 0x43]), "FF 57 50 43", 0],
  ["one", (b) => startsAt(b, [0xe4, 0x52, 0x5c, 0x7b, 0x8c, 0xd8, 0xa7, 0x4d, 0xae, 0xb1, 0x53, 0x78, 0xd0, 0x29, 0x96, 0xd3]), "E4 52 5C 7B", 0],
  ["dwg", (b) => /^AC10\d\d/.test(LATIN1.decode(b.subarray(0, 6))), "AC10..", 0],
  ["dxf", (b) => /^\s*0\s*\r?\n\s*SECTION\s*\r?\n/.test(LATIN1.decode(b.subarray(0, 64))), "0 SECTION", 0],
  ["shapefile", (b) => startsAt(b, [0, 0, 0x27, 0x0a]), "00 00 27 0A", 0],
  ["audio", (b) => startsAt(b, ascii("ID3")) || startsAt(b, ascii("fLaC")) || startsAt(b, ascii("OggS"))
    || (startsAt(b, ascii("RIFF")) && startsAt(b, ascii("WAVE"), 8)) || (startsAt(b, ascii("FORM")) && startsAt(b, ascii("AIFF"), 8))
    || (b.length > 3 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x18) !== 0x08 && (b[1] & 0x06) !== 0
      && (b[2] >> 4) !== 0x0f && (b[2] & 0x0c) !== 0x0c && b[1] !== 0xfe)
    || ["M4A ", "M4B ", "M4P "].includes(ftypBrand(b)), "audio signature", 0],
  ["video", (b) => (ftypBrand(b) !== null && !HEIC_BRANDS.includes(ftypBrand(b)) && !HEIF_BRANDS.includes(ftypBrand(b)) && !AVIF_BRANDS.includes(ftypBrand(b)))
    || (startsAt(b, ascii("RIFF")) && startsAt(b, ascii("AVI "), 8)) || startsAt(b, [0x1a, 0x45, 0xdf, 0xa3]) || startsAt(b, ascii("FLV\x01"))
    || startsAt(b, [0, 0, 1, 0xba]) || startsAt(b, ascii("moov"), 4) || startsAt(b, ascii("mdat"), 4), "video signature", 0],
];
const CFB_UNLISTED = [["vsd", ["VisioDocument"]], ["pub", ["Quill"]], ["mpp", ["Props", "Props9", "Props12", "Props14"]]];

function classify(b, nm, ct) {
  const unlisted = (named, hex, at) => ({ format: "unlisted", named, confidence: "certain", signals: [magicSignal(hex, at)] });
  const refused = (kind, reason, why) => ({ format: "refused", kind, reason, confidence: "certain", signals: [why] });
  if (startsAt(b, ascii("Rar!\x1a\x07"))) return refused("rar", "rar", magicSignal("52 61 72 21 1A 07", 0));
  if (b[0] === 0x4d && b[1] === 0x5a && b.length > 64) {
    const pe = u32at(b, 60);
    if (pe + 24 < b.length && startsAt(b, ascii("PE\0\0"), pe)) {
      const kind = (u16at(b, pe + 22) & 0x2000) !== 0 ? "dll" : extensionOf(nm) === "scr" ? "scr" : "exe";
      return refused(kind, "runs", localize("format-registry.formats.portable_executable", "a Windows program: MZ with a PE header"));
    }
  }
  if (startsAt(b, [0x7f, 0x45, 0x4c, 0x46]) || startsAt(b, [0xcf, 0xfa, 0xed, 0xfe]) || startsAt(b, [0xce, 0xfa, 0xed, 0xfe])
    || startsAt(b, [0xfe, 0xed, 0xfa, 0xce]) || startsAt(b, [0xfe, 0xed, 0xfa, 0xcf]))
    return refused("app", "runs", localize("format-registry.formats.native_executable", "a program for another system: ELF or Mach-O"));
  if (startsAt(b, ascii("xar!"))) return refused("pkg", "runs", magicSignal("78 61 72 21", 0));
  if (startsAt(b, ascii("conectix")) || startsAt(b, ascii("vhdxfile"))) return refused("vhd", "diskimage", localize("format-registry.formats.virtual_disk", "a virtual disk"));
  for (const at of [0x8001, 0x8801, 0x9001])
    if (startsAt(b, ascii("CD001"), at)) return refused("iso", "diskimage", magicSignal("43 44 30 30 31", at));
  if (startsAt(b, CFB_SIG)) {
    const names = cfbNames(b) ?? [];
    if (names.some((n) => [...n].some((ch) => ch.charCodeAt(0) >= 0x3800 && ch.charCodeAt(0) <= 0x4840)))
      return refused("msi", "runs", localize("format-registry.formats.installer_package", "a Windows installer package"));
    if (names.includes("EncryptedPackage")) {
      const hint = (ext) => (["docx", "xlsx", "pptx"].includes(ext) ? ext : null);
      const base = hint(extensionOf(nm)) ?? (ct && /wordprocessingml/.test(ct) ? "docx" : ct && /spreadsheetml/.test(ct) ? "xlsx" : ct && /presentationml/.test(ct) ? "pptx" : null)
        ?? (/^(doc|dotx|docm)$/.test(extensionOf(nm)) ? "docx" : /^(xlsm|xltx)$/.test(extensionOf(nm)) ? "xlsx" : /^(pptm|potx)$/.test(extensionOf(nm)) ? "pptx" : null);
      return base
        ? { format: base, confidence: "likely", encrypted: true, signals: [localize("format-registry.formats.encrypted_office_container", "an encrypted Office container; the kind is taken from its name or declared type")] }
        : { format: "unlisted", named: null, confidence: "none", encrypted: true, signals: [localize("format-registry.formats.encrypted_office_unknown", "an encrypted Office container whose kind cannot be read")] };
    }
    for (const [kind, streams] of CFB_UNLISTED)
      if (streams.some((n) => names.includes(n) || names.some((x) => x.startsWith(n)))) return unlisted(kind, hexOf(CFB_SIG), 0);
    return { format: "unlisted", named: null, confidence: "none",
             signals: [localize("format-registry.formats.compound_file_unknown", "a compound file of a kind this list does not name")] };
  }
  if (ooxml.hasZipMagic(b)) {
    const c = ooxml.readContainer(b);
    if (c.ok) {
      const k = zipKind(b, c);
      if (k) return k;
    }
  }
  if (b.length >= 512 && startsAt(b, ascii("koly"), b.length - 512)) return refused("dmg", "runs", magicSignal("6B 6F 6C 79", b.length - 512));
  for (const [named, test, hex, at] of UNLISTED_SIGNATURES) if (test(b)) return unlisted(named, hex, at);
  if (looksText(b)) {
    const head = LATIN1.decode(b.subarray(0, 256));
    if (head.startsWith("#!")) return refused("sh", "runs", localize("format-registry.formats.script_shebang", "a script: it begins with #!"));
    if (/^\s*@echo\s+off\b/i.test(head)) return refused("bat", "runs", localize("format-registry.formats.script_echo_off", "a script: it begins with @echo off"));
    const ext = extensionOf(nm);
    if (["bat", "cmd", "ps1", "sh", "vbs", "scr"].includes(ext))
      return refused(ext, "runs", localize("format-registry.formats.script_name", "a script file: the text is named .{ext}", { ext }));
  }
  return null;
}

/* R34: a file whose name's extension names a kind other than the one its content shows is answered as its content, and
   says so in a signal. */
const EXT_KIND = new Map([
  ...["pdf", "docx", "doc", "xlsx", "xlsm", "xls", "csv", "tsv", "pptx", "ppt", "odt", "ods", "odp", "rtf", "html", "mhtml", "json", "ndjson", "xml",
    "svg", "kml", "kmz", "geojson", "ics", "vcf", "srt", "vtt", "jpeg", "png", "tiff", "heic", "heif", "avif", "gif", "webp", "bmp", "jp2",
    "eml", "msg", "mbox", "zip", "tar", "gz", "7z"].map((x) => [x, x]),
  ["jpg", "jpeg"], ["tif", "tiff"], ["htm", "html"], ["tgz", "gz"], ["docm", "docx"], ["dotx", "docx"], ["pptm", "pptx"], ["potx", "pptx"],
  ["xltx", "xlsx"], ["xlsm", "xlsx"], ["tab", "tsv"],
  ["txt", "text"], ["log", "text"], ["md", "text"],
]);
const TEXT_LIKE = ["text", "csv", "tsv", "json", "ndjson", "xml", "svg", "kml", "geojson", "ics", "vcf", "srt", "vtt", "eml", "mbox", "html", "mhtml", "rtf"];
function noteDisagreement(r, nm) {
  const expected = nm ? EXT_KIND.get(extensionOf(nm)) : null;
  if (!expected || !r || typeof r.format !== "string" || r.format === expected) return r;
  if (r.format === "undetermined" || (r.format === "unlisted" && r.named === null && !r.encrypted)) return r;
  if (r.confidence === "likely" && r.signals?.some?.((x) => typeof x === "string" && x.startsWith("content type"))) return r;
  /* a text file's own kinds are all text under a generic name, and a generic text name over any of them is no disagreement */
  if ((r.format === "text" && TEXT_LIKE.includes(expected)) || (expected === "text" && TEXT_LIKE.includes(r.format))) return r;
  return { ...r, signals: [...(Array.isArray(r.signals) ? r.signals : []),
    localize("format-registry.formats.name_disagrees_with_content", "the name \"{name}\" suggests {expected}, the content is {format}", { name: String(nm), expected, format: String(r.format) })] };
}

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
/* The other pictures (R33; T53): found by their own signature at their own offset, so they too are asked before the web page and the PDF. */
for (const entry of PICTURE_ENTRIES) registerFormat(entry);

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

/* `mhtml` (R33; T53): a web page saved whole as one MIME archive. Its header block, unfolded, declares `multipart/related`
   with an HTML root (the `type` parameter, or the first part's own Content-Type), and it is a saved page, not a mailed
   message: the archive names where the page was (Snapshot-Content-Location, or a Content-Location on its HTML part) and
   carries none of a message's transport fields (Received, To, Message-ID). Registered after `html` and before
   mail-reader's `eml`, which would otherwise take any header block for a message. Detection only, as `html` (R19). */
const MHTML_HEAD_BYTES = 16384;
const MHTML_CONTENT_TYPES = ["multipart/related", "application/x-mimearchive", "message/x-mhtml"];
function headerBlock(text) {
  const end = text.search(/\r?\n\r?\n/);
  if (end < 0) return null;
  const fields = new Map();
  for (const line of text.slice(0, end).replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const m = /^([!-9;-~]+):[ \t]*(.*)$/.exec(line);
    if (!m) return null;
    fields.set(m[1].toLowerCase(), m[2]);
  }
  return { fields, rest: text.slice(end).replace(/^\r?\n\r?\n/, "") };
}
function startsAsMhtml(bytes) {
  const top = headerBlock(LATIN1.decode(bytes.subarray(0, MHTML_HEAD_BYTES)));
  if (!top) return false;
  const ctype = top.fields.get("content-type") ?? "";
  if (!/^multipart\/related\s*(;|$)/i.test(ctype)) return false;
  if (["received", "to", "message-id"].some((f) => top.fields.has(f))) return false;
  const boundary = /;\s*boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i.exec(ctype);
  if (!boundary) return false;
  const delim = `--${boundary[1] ?? boundary[2]}`;
  const at = top.rest.indexOf(delim);
  const first = at < 0 ? null : headerBlock(top.rest.slice(at + delim.length).replace(/^[ \t]*\r?\n/, ""));
  const rootType = /;\s*type\s*=\s*"?text\/html"?/i.test(ctype);
  const firstHtml = !!first && /^text\/html\s*(;|$)/i.test(first.fields.get("content-type") ?? "");
  if (!rootType && !firstHtml) return false;
  return top.fields.has("snapshot-content-location") || (!!first && first.fields.has("content-location"));
}
registerFormat({
  format: "mhtml",
  detect(bytes, contentType) {
    if (bytes) {
      return startsAsMhtml(bytes)
        ? certain("mhtml", localize("format-registry.formats.mhtml_saved_page", "a saved web page: multipart/related with an HTML root and the page's location"))
        : null;
    }
    return contentType && MHTML_CONTENT_TYPES.includes(contentType.toLowerCase().split(";")[0].trim())
      ? { format: "mhtml", confidence: "likely", signals: [`content type "${contentType}"`] }
      : null;
  },
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

registerFormat(RTF);

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

/* The legacy Office formats, by the stream names of their compound file (R33), and the archives with a signature of their own. */
registerFormat(cfbEntry("doc", ["WordDocument"], "WordDocument", []));
registerFormat(cfbEntry("xls", ["Workbook", "Book"], "Workbook", []));
registerFormat(cfbEntry("ppt", ["PowerPoint Document"], "PowerPoint Document", []));
/* The readers' own entries, unmodified (R33): structured-text-reader's (json, ndjson, xml, svg, kml, kmz, geojson, ics, vcf, srt, vtt) and
   mail-reader's (eml, msg, mbox), before the archives so a `kmz` is asked before the plain ZIP. */
for (const entry of STRUCTURED_TEXT_ENTRIES) registerFormat(entry);
for (const entry of MAIL_ENTRIES) registerFormat(entry);
for (const entry of ARCHIVE_ENTRIES) registerFormat(entry);

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

/* Valid text no entry above claimed: registered last, asked after the content-type and name passes (R35). */
registerFormat(TEXT_ENTRY);

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

/* ------------------------------------------------------------------ *
 * The kind of an answer by key, and the one table the screens read (R40, R42, R43; DEC-467, DEC-473).
 * ------------------------------------------------------------------ */

/* The map of a registry key (or an unlisted `named`, or a refused `kind`) to the `<name>` of `file.kind.<name>`: many keys to
   one name (R43), the only map; no screen builds a name from an extension. */
const KIND_GROUPS = {
  docx: ["docx", "doc", "docm", "dotx"], pptx: ["pptx", "ppt", "pptm", "potx"], xlsx: ["xlsx", "xlsm", "xltx"],
  html: ["html", "mhtml"], json: ["json", "ndjson"], map: ["kml", "kmz", "geojson"], captions: ["srt", "vtt"],
  picture: ["jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif", "jp2"], email: ["eml", "msg"],
  archive: ["zip", "tar", "gz", "7z"], pst: ["pst", "ost"], access: ["mdb", "accdb"], maplayer: ["shapefile", "gpkg"],
  visio: ["vsd", "vsdx"], cad: ["dwg", "dxf"], program: ["exe", "msi", "dll", "app", "apk", "dmg", "pkg"],
  script: ["bat", "cmd", "ps1", "sh", "vbs", "scr", "jar"], diskimage: ["iso", "img", "vhd"],
};
const OWN_KIND = ["pdf", "xls", "odt", "odp", "ods", "rtf", "csv", "tsv", "text", "xml", "svg", "ics", "vcf", "tiff", "mbox", "sqlite",
  "parquet", "xlsb", "wpd", "pages", "numbers", "key", "pub", "one", "mpp", "epub", "audio", "video", "rar"];
const NAME_OF = new Map([...OWN_KIND.map((k) => [k, k]), ...Object.entries(KIND_GROUPS).flatMap(([n, ks]) => ks.map((k) => [k, n]))]);
const REASON_OF = new Map([["program", "runs"], ["script", "runs"], ["rar", "rar"], ["diskimage", "diskimage"]]);

/** The key of an answer's plain-word kind, `file.kind.<name>`, and for a refusal its reason's, `file.refused.reason.<name>` (R40,
 *  R43). A type that is none of the table's, and an unlisted answer with no name, is `other`. */
export function formatNameFor(answer) {
  const key = !answer || typeof answer !== "object" ? null
    : answer.format === "unlisted" ? answer.named ?? null
    : answer.format === "refused" ? answer.kind ?? null
    : typeof answer.format === "string" ? answer.format : null;
  const name = (key !== null && NAME_OF.get(key)) || "other";
  const kind_key = `file.kind.${name}`;
  const out = { name, kind_key, text: hasWord(kind_key) ? word(kind_key) : null };
  if (answer && answer.format === "refused") {
    const reason = REASON_OF.get(name) ?? null;
    out.reason_key = reason ? `file.refused.reason.${reason}` : null;
  }
  return out;
}

/* The limits each class of kind states, as figures of runtime-limits' per-kind rows (its R37), never literals here. A row it does
   not hold yet is a figure with `bound: null` (the job that adds it names the row; the table then answers it, with no edit to a screen). */
const LIMIT_CLASSES = {
  document: [["bytes", "document", "bytes"], ["pages", "document", "pages"]],
  spreadsheet: [["bytes", "spreadsheet", "bytes"], ["rows", "spreadsheet", "rows"]],
  xls: [["bytes", "spreadsheet", "bytes"], ["rows_per_sheet", "spreadsheet", "xls_sheet_rows"]],
  text: [["bytes", "text", "bytes"]],
  json: [["bytes", "text", "bytes"], ["nesting", "text", "nesting"]],
  calendar: [["bytes", "text", "bytes"], ["events", "text", "calendar_events"]],
  picture: [["bytes", "image", "bytes"]],
  tiff: [["bytes", "image", "bytes"], ["pages", "document", "pages"]],
  message: [["bytes", "message", "upload_bytes"], ["received_bytes", "mail", "message_bytes"]],
  mailbox: [["bytes", "archive", "uploaded_bytes"], ["messages", "archive", "mailbox_messages"]],
  archive: [["bytes", "archive", "uploaded_bytes"], ["unpacked_bytes", "archive", "unpacked_bytes"], ["members", "archive", "members"], ["depth", "archive", "depth"]],
  /* R42 gives the kept kinds no row of their own: the data kinds take the spreadsheet class's 50 MB, the rest the document class's 100 MB */
  kept50: [["bytes", "spreadsheet", "bytes"]],
  kept100: [["bytes", "document", "bytes"]],
  none: [],
};
function limitOf(cls) {
  const figures = LIMIT_CLASSES[cls].map(([what, kind, name]) => {
    const held = Object.hasOwn(READ_BOUNDS, kind) && Object.hasOwn(READ_BOUNDS[kind], name);
    return Object.freeze({ what, row: Object.freeze([kind, name]), bound: held ? boundOf(kind, name) : null, key: held ? READ_BOUNDS[kind][name].key : null });
  });
  return Object.freeze({ class: cls, figures: Object.freeze(figures) });
}

const TABLE_ROWS = [
  ["read", "document", ["pdf", "docx", "doc", "docm", "dotx", "pptx", "ppt", "pptm", "potx", "odt", "odp", "rtf"]],
  ["read", "spreadsheet", ["xlsx", "xlsm", "xltx", "ods", "csv", "tsv"]],
  ["read", "xls", ["xls"]],
  ["read", "text", ["text", "vcf", "srt", "vtt"]],
  /* R42: JSON, XML, HTML, SVG and map data are 100 MB with nesting 1,000 (runtime-limits R37's text rows) */
  ["read", "json", ["json", "ndjson", "html", "mhtml", "xml", "svg", "kml", "kmz", "geojson"]],
  ["read", "calendar", ["ics"]],
  ["read", "picture", ["jpeg", "png", "gif", "webp", "bmp", "avif", "heic", "heif", "jp2"]],
  ["read", "tiff", ["tiff"]],
  ["read", "message", ["eml", "msg"]],
  ["read", "mailbox", ["mbox"]],
  ["read", "archive", ["zip", "tar", "gz", "7z"]],
  ["kept_not_read", "archive", ["pst", "ost"]],
  ["kept_not_read", "kept50", ["mdb", "accdb", "sqlite", "parquet", "xlsb", "shapefile", "gpkg"]],
  ["kept_not_read", "kept100", ["wpd", "pages", "numbers", "key", "vsd", "vsdx", "pub", "one", "mpp", "dwg", "dxf", "epub", "audio", "video", "other"]],
  ["not_kept", "none", ["rar", "exe", "msi", "dll", "app", "apk", "dmg", "pkg", "bat", "cmd", "ps1", "sh", "vbs", "scr", "jar", "iso", "img", "vhd"]],
];

/** One row for each type of the roster, each named unlisted type and each refused type: `{key, state, kind_key, limit}` (R42). A key
 *  outside the table has no row. */
export function kindTable() {
  return TABLE_ROWS.flatMap(([state, cls, keys]) => keys.map((key) => Object.freeze({
    key, state, kind_key: `file.kind.${NAME_OF.get(key) ?? "other"}`,
    limit: limitOf(cls),
  })));
}
