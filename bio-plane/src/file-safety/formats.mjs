/* file-safety: what a captured file IS, read from its own bytes through the readers that own each format (R6's format
 * and `active` list, R11's route and cells, R14's structure check). Nothing here runs, renders or changes the file: the
 * readers read names and structure only (`pdf-reader` R36, `office-readers` R32–R33, `odf-reader` R47), and a cell's
 * value is the one the file holds, never computed (`office-readers` R30). Never throws. */
import { extractPdfStructure } from "../pdfstructure.mjs";
import { docxEntry } from "../docx.mjs";
import { pptxEntry } from "../pptx.mjs";
import { xlsxEntry } from "../formats-xlsx.mjs";
import { csvEntry } from "../csv.mjs";
import { odtEntry, odsEntry, odpEntry } from "../odf.mjs";
import { hasZipMagic, readContainer, declaredTextBytes, discriminate, parseRels } from "../ooxml.mjs";
import { boundOf } from "../read-bounds.mjs";
import { readDirectory, memberText, hasZipEnd } from "./zipdir.mjs";

const LATIN1 = new TextDecoder("latin1");

/* R45 (T50; N1163 M-F2; K3480): the characters of a plain-text file a safe view shows, and the most of the stored object
   read to decide a file's format and show them: four bytes for each character kept (a UTF-8 character is at most four). */
export const SAFE_VIEW_TEXT_MAX = 262_144;
export const HEAD_MAX = 4 * SAFE_VIEW_TEXT_MAX;
/* R56: how much of a file's end is read to decide what it is (a ZIP's end record and comment, a PDF's trailer). */
const TAIL_READ = 65_536 + 22;

/* The office and OpenDocument entries in the order a container is asked to name itself. */
const CONTAINERS = Object.freeze([["docx", docxEntry], ["xlsx", xlsxEntry], ["pptx", pptxEntry],
                                  ["odt", odtEntry], ["ods", odsEntry], ["odp", odpEntry]]);
const CONTAINER_NAMES = Object.freeze(CONTAINERS.map(([f]) => f));

/* R11: the routes of a safe view, by format. `pdf` and `office` are rendered as page images (`file-scanner` R7); `data`
   is the cells the reader read. */
const ROUTE = Object.freeze({ pdf: "pdf", docx: "office", pptx: "office", odt: "office", odp: "office",
                              xlsx: "data", ods: "data", csv: "data" });
export const safeViewRoute = (format) => ROUTE[format] || null;

/* R6: the formats with an `active` list from their reader, and those low by their kind alone. */
export const ACTIVE_FORMATS = Object.freeze(["pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "rtf", "eml"]);
export const PLAIN_FORMATS = Object.freeze(["image", "text", "html"]);
/* R56: the office and OpenDocument formats, whose active content is read from the directory when the file is too large to load. */
export const CONTAINER_FORMATS = CONTAINER_NAMES;

const startsWith = (b, sig) => sig.every((x, i) => b[i] === x);
const ascii = (b, from, to) => LATIN1.decode(b.subarray(from, to));

/* R56 (G136d): one table of the image signatures; the kinds a decoder of this product reads are `READ_IMAGES`, the others are
   named as unread image types (a TIFF, a HEIC, a BMP) and never examined. */
const IMAGE_SIGNATURES = Object.freeze([
  ["png", (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["jpeg", (b) => startsWith(b, [0xff, 0xd8, 0xff])],
  ["gif", (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38])],
  ["webp", (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && ascii(b, 8, 12) === "WEBP"],
  ["tiff", (b) => startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])],
  ["heic", (b) => b.length >= 12 && ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(ascii(b, 8, 12))],
  ["bmp", (b) => b.length >= 18 && b[0] === 0x42 && b[1] === 0x4d && b[6] === 0 && b[7] === 0 && b[8] === 0 && b[9] === 0
    && [12, 40, 52, 56, 64, 108, 124].includes(b[14] | (b[15] << 8) | (b[16] << 16))],
]);
export const READ_IMAGES = Object.freeze(["png", "jpeg", "gif", "webp"]);
/** The kind of picture the bytes begin as (`png`, `jpeg`, `gif`, `webp`, `tiff`, `heic`, `bmp`), else null. */
export function imageKind(b) {
  if (!(b instanceof Uint8Array)) return null;
  for (const [kind, is] of IMAGE_SIGNATURES) if (is(b)) return kind;
  return null;
}

/* Whether a decoded text is text and not bytes read as characters: at most 1 in 1,000 of the first 8,192 is a control character other than white space. */
function printable(t) {
  const n = Math.min(t.length, 8192);
  let control = 0;
  for (let i = 0; i < n; i++) { const c = t.charCodeAt(i); if ((c < 0x20 && c !== 9 && c !== 10 && c !== 13 && c !== 12) || c === 0x7f || c === 0xfffe || c === 0xffff) control++; }
  return n > 0 && control <= n * 0.001;
}

/* The text the bytes hold and how it is encoded, or null: UTF-8 (no NUL), UTF-16 (a byte order mark, or every other byte NUL),
   or Latin-1 (no NUL and no control character but the white space). R56 (G130d). */
export function textInfo(b) {
  if (b.length === 0) return null;
  const decode = (enc, bytes) => { try { return new TextDecoder(enc, { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return null; } };
  if (b.length >= 2 && ((b[0] === 0xff && b[1] === 0xfe) || (b[0] === 0xfe && b[1] === 0xff))) {
    const enc = b[0] === 0xff ? "utf-16le" : "utf-16be";
    const t = decode(enc, b.subarray(0, b.length - (b.length % 2)));
    return t === null ? null : { text: t.replace(/^﻿/, ""), encoding: enc };
  }
  const probe = b.subarray(0, Math.min(b.length, 8192));
  if (probe.includes(0)) {
    let odd = 0, even = 0;
    for (let i = 0; i + 1 < probe.length; i += 2) { if (probe[i] === 0) even++; if (probe[i + 1] === 0) odd++; }
    const pairs = Math.floor(probe.length / 2);
    const enc = odd >= pairs * 0.3 && even <= pairs * 0.02 ? "utf-16le" : even >= pairs * 0.3 && odd <= pairs * 0.02 ? "utf-16be" : null;
    if (!enc) return null;
    const t = decode(enc, b.subarray(0, b.length - (b.length % 2)));
    return t === null || !printable(t) ? null : { text: t, encoding: enc };
  }
  const t = decode("utf-8", b);
  if (t !== null) return { text: t, encoding: "utf-8" };
  let control = 0;
  for (let i = 0; i < b.length; i++) { const c = b[i]; if ((c < 0x20 && c !== 9 && c !== 10 && c !== 13 && c !== 12) || c === 0x7f) control++; }
  return control <= b.length * 0.001 ? { text: LATIN1.decode(b), encoding: "latin1" } : null;
}

/* A comma- or tab-separated table: at least two lines, each with the same number of separators, at least one. */
function looksDelimited(text) {
  const lines = text.split(/\r?\n/).filter((l) => l !== "").slice(0, 50);
  if (lines.length < 2) return false;
  for (const sep of [",", "\t", ";"]) {
    const n = lines[0].split(sep).length - 1;
    if (n >= 1 && lines.every((l) => l.split(sep).length - 1 === n)) return true;
  }
  return false;
}

/* The first element a markup text begins with (after a byte order mark, white space, comments, a declaration and a doctype). */
function rootOf(head) {
  let t = head.replace(/^﻿/, "");
  for (;;) {
    t = t.replace(/^\s+/, "");
    if (t.startsWith("<!--")) { const e = t.indexOf("-->"); if (e < 0) return null; t = t.slice(e + 3); }
    else if (t.startsWith("<?")) { const e = t.indexOf("?>"); if (e < 0) return null; t = t.slice(e + 2); }
    else if (/^<!doctype/i.test(t)) { const e = t.indexOf(">"); if (e < 0) return null; t = t.slice(e + 1); }
    else break;
  }
  const m = /^<([A-Za-z][\w:.-]*)/.exec(t);
  return m ? m[1].toLowerCase() : null;
}

const EML_HEADER = /^(?:from|to|received|return-path|mime-version|message-id|subject|date|content-type):/im;
function looksLikeEml(text) {
  const head = text.slice(0, 4096).split(/\r?\n\r?\n/)[0];
  const lines = head.split(/\r?\n/);
  const names = lines.filter((l) => /^[A-Za-z][A-Za-z0-9-]*:/.test(l)).map((l) => l.slice(0, l.indexOf(":")).toLowerCase());
  return names.length >= 3 && names.includes("from") && names.some((n) => ["received", "mime-version", "message-id", "return-path", "subject", "date"].includes(n))
    && EML_HEADER.test(head);
}

/* What a head that is no container, no compound file, no picture and no PDF is, from the text it holds. */
function textFormat(info) {
  const head = info.text.slice(0, 4096);
  const root = rootOf(head);
  if (root === "svg") return "svg";
  if (root === "html" || /<html[\s>]/i.test(head)) return "html";
  if (/^\s*\{\\rtf/.test(head)) return "rtf";
  if (looksLikeEml(info.text)) return "eml";
  if (looksDelimited(info.text)) return "csv";
  return "text";
}

/* A PDF's header is in its first KiB (the window `extractPdfStructure` itself accepts). */
const hasPdfHeader = (b) => /%PDF-\d+\.\d+/.test(ascii(b, 0, Math.min(b.length, 1024)));

/** The file's format, by its own bytes: `pdf`, an office or OpenDocument flavour, `zip` (an archive that is no office
 *  file), `ole` (a compound file: a legacy office file or an encrypted modern one), `image`, `svg`, `html`, `rtf`, `eml`,
 *  `csv`, `text`, `polyglot` (a PDF with a ZIP joined to it) or `unknown`. A container is judged before a PDF header (R56:
 *  `%PDF-` in the first KiB of a macro-enabled office file does not make it a PDF); the text kinds read the characters in
 *  UTF-8, UTF-16 or Latin-1. */
export function formatOf(bytes) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return "unknown";
    if (hasZipMagic(bytes)) {
      for (const [format, entry] of CONTAINERS) {
        try { if (entry.detect(bytes)) return format; } catch { /* not this one */ }
      }
      return "zip";
    }
    if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
    if (imageKind(bytes)) return "image";
    if (hasPdfHeader(bytes)) return hasZipEnd(bytes.subarray(Math.max(0, bytes.length - TAIL_READ))) ? "polyglot" : "pdf";
    const info = textInfo(bytes);
    return info === null ? "unknown" : textFormat(info);
  } catch { return "unknown"; }
}

/* R54, R56: whether the bytes of a compound file hold an encrypted package (`EncryptedPackage`, a stream name, in UTF-16). */
const ENCRYPTED_PACKAGE = new TextEncoder().encode("E\0n\0c\0r\0y\0p\0t\0e\0d\0P\0a\0c\0k\0a\0g\0e\0");
function holds(bytes, needle) {
  outer: for (let i = 0; i + needle.length <= bytes.length; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
/* R54: a PDF whose trailer carries `/Encrypt` asks for a password. */
const pdfEncrypted = (tail) => /\/Encrypt\b/.test(ascii(tail, 0, tail.length));

/** R54, R56: everything a file's own bytes say about what it is, read whole or from range reads of its head and its end:
 *  `{format, encoding, image, encrypted, directory}`. `src` is a range source `{size, read(offset, length)}`. A file of any size is
 *  judged by its structure (an office package by its directory, read from the tail; a PDF by its header and trailer), never by
 *  a prefix; `bytes`, when given, are the file whole and spare the reads. */
export async function describe(src, known = null) {
  try {
    const size = src.size;
    const bytes = known && known.bytes ? known.bytes : null;
    const head = known && known.head ? known.head : bytes ? bytes.subarray(0, Math.min(bytes.length, HEAD_MAX)) : await src.read(0, Math.min(size, HEAD_MAX));
    const whole = size <= HEAD_MAX;
    const tail = async () => (bytes ? bytes.subarray(Math.max(0, bytes.length - TAIL_READ)) : await src.read(Math.max(0, size - TAIL_READ), Math.min(size, TAIL_READ)));
    const out = { format: "unknown", encoding: null, image: null, encrypted: false, directory: null };
    if (head.length === 0) return out;
    if (hasZipMagic(head)) {
      let format = "zip";
      if (bytes) format = formatOf(bytes);
      else {
        const d = await discriminate({ size, read: (o, n) => (bytes ? Promise.resolve(bytes.subarray(o, o + n)) : src.read(o, n)) }, null).catch(() => null);
        if (d && d.ok === true && CONTAINER_NAMES.includes(d.format)) format = d.format;
      }
      const dir = await readDirectory(bytes ? { size, read: async (o, n) => bytes.subarray(o, o + n) } : src);
      out.format = format;
      out.directory = dir.ok ? dir : null;
      out.encrypted = dir.ok && dir.encrypted;
      return out;
    }
    if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      out.format = "ole";
      out.encrypted = holds(bytes || head, ENCRYPTED_PACKAGE);
      return out;
    }
    const image = imageKind(head);
    if (image) { out.format = "image"; out.image = image; return out; }
    if (hasPdfHeader(head)) {
      const t = await tail();
      out.format = hasZipEnd(t) ? "polyglot" : "pdf";
      out.encrypted = pdfEncrypted(t) || (whole && pdfEncrypted(head));
      return out;
    }
    const cut = whole ? head : wholeCharacters(head);
    const info = textInfo(cut);
    if (info === null) return out;
    out.format = textFormat(info);
    out.encoding = info.encoding;
    return out;
  } catch { return { format: "unknown", encoding: null, image: null, encrypted: false, directory: null }; }
}

/* R56: the active content of an office or OpenDocument file too large to load, read from its directory and its small
   relationship parts, as the readers read it from the whole: a macro project, an ActiveX control, an embedded object or file,
   an Excel 4 macro sheet, a relationship to a target outside the file (a hyperlink is none), an encrypted member. A part
   that cannot be read is `unread`, so an empty list is a finding and never a walk that missed. */
export async function activeFromDirectory(format, src, directory) {
  const dir = directory && directory.ok ? directory : await readDirectory(src);
  if (!dir.ok) return { ok: false, why: dir.why };
  const base = { docx: "word/", pptx: "ppt/", xlsx: "xl/" }[format] ?? null;
  const active = [];
  if (dir.encrypted) active.push({ kind: "encryption" });
  const HYPERLINK = /\/relationships\/hyperlink$/;
  for (const e of dir.entries) {
    const part = e.name.replace(/^\/+/, "");
    if (!part || part.endsWith("/")) continue;
    const last = part.slice(part.lastIndexOf("/") + 1);
    const inRels = /(^|\/)_rels\//.test(part);
    if (last.toLowerCase() === "vbaproject.bin") active.push({ kind: "vba-project", part, read: false });
    if (base) {
      if (!inRels && part.startsWith(`${base}activeX/`)) active.push({ kind: "activex", part });
      else if (!inRels && part.startsWith(`${base}embeddings/`)) active.push({ kind: /^oleobject/i.test(last) ? "ole-object" : "embedded-file", part });
      else if (base === "xl/" && part.startsWith("xl/macrosheets/")) active.push({ kind: "xl4-macrosheet", part });
    } else if (/^(Basic|Scripts)\//.test(part)) active.push({ kind: /^Basic\//.test(part) ? "odf-basic" : "odf-script", part });
    if (/\.rels$/i.test(part) && base) {
      const m = await memberText(src, e);
      if (!m.ok) { active.push({ kind: "unread", part, why: m.why }); continue; }
      const parsed = parseRels(m.text);
      if (!parsed.ok) { active.push({ kind: "unread", part, why: parsed.why || "rels_unparseable" }); continue; }
      for (const r of parsed.relationships) if (r.external && !HYPERLINK.test(r.type ?? "")) active.push({ kind: "external-target", part, type: r.type, target: r.target });
    }
  }
  return { ok: true, active, variant: null };
}

const ENTRY = Object.freeze({ docx: docxEntry, xlsx: xlsxEntry, pptx: pptxEntry, odt: odtEntry, ods: odsEntry, odp: odpEntry });

/* R56 (G130d): an RTF carrying an embedded object, and an e-mail carrying an attachment, are not plain text: what can act is read
   from the text itself and stated, never run. */
function rtfActive(text) {
  const active = [];
  if (/\\(?:objdata|objemb|objlink|objautlink|objocx|object|objupdate)\b/.test(text)) active.push({ kind: "ole-object", part: null });
  if (/\\\*\\template\b/.test(text) || /\\fldinst\b[^}]*\b(?:DDE|DDEAUTO|INCLUDETEXT|INCLUDEPICTURE|LINK)\b/i.test(text)) active.push({ kind: "external-target", part: null });
  return active;
}
function emlActive(text) {
  const active = [];
  const parts = text.split(/\r?\n(?=--)/);
  const seen = new Set();
  for (const p of parts) {
    const h = p.split(/\r?\n\r?\n/)[0];
    const attached = /content-disposition:\s*attachment/i.test(h) || /\bfilename\*?=/i.test(h)
      || (/content-type:\s*(?:application|audio|video|image)\//i.test(h) && !/content-type:\s*application\/(?:pgp-signature|pkcs7-signature|x-pkcs7-signature)/i.test(h));
    if (!attached) continue;
    const name = (/filename\*?="?([^";\r\n]+)/i.exec(h) || /\bname\*?="?([^";\r\n]+)/i.exec(h) || [null, null])[1];
    const key = name || `part${seen.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    active.push({ kind: "embedded-file", part: name });
  }
  return active;
}

/** The reader's whole structure read (R6, R14): `{ok:true, active, variant}` or `{ok:false, why}`. A reader that
 *  refuses, or answers no `active` list, is `ok:false`: the list is never read as empty. */
export async function readActive(format, bytes) {
  try {
    if (format === "csv") return { ok: true, active: [], variant: null };
    if (format === "rtf") return { ok: true, active: rtfActive(LATIN1.decode(bytes)), variant: null };
    if (format === "eml") {
      const info = textInfo(bytes);
      return info ? { ok: true, active: emlActive(info.text), variant: null } : { ok: false, why: "not_text" };
    }
    if (format === "pdf") {
      const s = await extractPdfStructure(bytes);
      return s && s.ok === true && Array.isArray(s.active) ? { ok: true, active: s.active, variant: null }
        : { ok: false, why: (s && (s.reason || s.why)) || "reader_failed" };
    }
    const entry = ENTRY[format];
    if (!entry) return { ok: false, why: "no_reader" };
    const s = await entry.structure(bytes);
    return s && s.ok !== false && Array.isArray(s.active) ? { ok: true, active: s.active, variant: s.variant ?? null }
      : { ok: false, why: (s && (s.why || s.reason || s.error)) || "reader_failed" };
  } catch (e) {
    return { ok: false, why: "reader_failed" };
  }
}

/* G44 (K4655, K4662, K4665; R11 amended, R21): the first screen of a spreadsheet's safe view, and what bounds it. A sheet shows at most
   `SAFE_VIEW_CELLS_MAX` cells (whole rows, from row 1; a first row alone over it is shown whole), a workbook at most
   `SAFE_VIEW_SHEETS_MAX` sheets and `SAFE_VIEW_TOTAL_CELLS_MAX` cells together, the cut stated. `SAFE_VIEW_INLINE_CELLS_MAX_BYTES` is the
   figure handed the entries' `text()` (bytes of the cells' JSON it may list; this module's own, it has no edge to reading-pipeline's):
   past it the cells are held and `cellsIn` makes the first rows. `SAFE_VIEW_ODS_DECLARED_MAX` is the declared size of an OpenDocument
   sheet's content.xml above which no preview is drawn (its entry has neither slot, so it lists every cell; measured, G44). */
export const SAFE_VIEW_CELLS_MAX = 1000;
export const SAFE_VIEW_SHEETS_MAX = 20;
export const SAFE_VIEW_TOTAL_CELLS_MAX = 5000;
export const SAFE_VIEW_INLINE_CELLS_MAX_BYTES = 524_288;
export const SAFE_VIEW_ODS_DECLARED_MAX = boundOf("file_safety", "ods_declared");

const DATA_ENTRY = Object.freeze({ xlsx: xlsxEntry, ods: odsEntry, csv: csvEntry });
const cellOf = (c) => ({ ref: c.source && c.source.cell ? c.source.cell : null, value: c.value, type: c.type });
const rowOfCell = (c) => { const m = /(\d+)$/.exec(c.ref ?? ""); return m ? Number(m[1]) : null; };
/* R51 / R11: a spreadsheet above what a preview can show: its size and the bound, never an empty view (K4571). */
const notDrawn = (size, bound) => ({ ok: false, why: "PREVIEW_NOT_DRAWN", size, bound });

/* The first whole rows of `cells` (in row order) within `max` cells: the first row always, a later one only if it fits. A first row
   alone over `max` is cut to its first `max` cells, and `cut` says so (the sheet is then truncated though no row follows). */
function firstRows(cells, max) {
  const rows = [];
  for (let i = 0; i < cells.length; i++) {
    const r = rowOfCell(cells[i]);
    const last = rows[rows.length - 1];
    if (last && (r === null || r === last.row)) last.to = i + 1; else rows.push({ row: r, from: i, to: i + 1 });
  }
  let take = 0;
  while (take < rows.length && (take === 0 || rows[take].to <= max)) take++;
  const end = take ? rows[take - 1].to : 0;
  const cut = end > max;
  return { cells: cells.slice(0, cut ? max : end), next_row: take < rows.length ? rows[take].row : null, cut };
}

/* One sheet of the answer: `{name, cells, rows, total_rows, truncated, next_row}` and, for a sheet that could not be shown, a `reason`
   with no cells and no size. */
const sheetAnswer = (s, cells, nextRow, cut = false) => ({ name: s.name, cells,
  rows: cells.length ? { from: rowOfCell(cells[0]), to: rowOfCell(cells[cells.length - 1]) } : null,
  total_rows: Number.isInteger(s.usedRows) ? s.usedRows : null, truncated: nextRow != null || cut, next_row: nextRow ?? null });
const unreadable = (s, reason) => ({ name: s.name, cells: [], rows: null, total_rows: null, truncated: false, next_row: null, reason });

async function firstScreen(entry, parts, s, max) {
  if (Array.isArray(s.cells)) { const f = firstRows(s.cells.map(cellOf), max); return sheetAnswer(s, f.cells, f.next_row, f.cut); }
  if (!s.cells_held || typeof entry.cellsIn !== "function") return unreadable(s, "sheet_unreadable");
  /* a row is shown to `SAFE_VIEW_CELLS_MAX` columns at most, so a row of a million fields is cut, and says so */
  const r = await entry.cellsIn(parts, { sheet: s.sheet, fromRow: 1, ...(s.usedRows >= 1 ? { toRow: s.usedRows } : {}), toCol: SAFE_VIEW_CELLS_MAX, maxCells: max });
  if (!r || r.ok !== true || !Array.isArray(r.cells)) return unreadable(s, "cells_unreadable");
  return sheetAnswer(s, r.cells.map(cellOf), r.next_row, Number.isInteger(s.usedCols) && s.usedCols > SAFE_VIEW_CELLS_MAX);
}

/** R11's data view: each sheet's first whole rows as the reader read them, `{name, cells:[{ref, value, type}], rows, total_rows,
 *  truncated, next_row}`, the value the file holds (a formula's cached value), never computed, with `sheets_total` and
 *  `sheets_truncated`; a sheet that could not be shown carries a `reason`; or `{ok:false, why}`, with `size` and `bound` when the
 *  file is above what a preview can show (`why` `PREVIEW_NOT_DRAWN`). `entries` is the readers by format (the tests'). */
export async function sheetsOf(format, bytes, entries = DATA_ENTRY) {
  try {
    const r = await readSheets(format, bytes, entries);
    if (!r.ok) return r;
    const { entry, parts, t } = r;
    const sheets = [];
    let budget = SAFE_VIEW_TOTAL_CELLS_MAX;
    for (const s of t.sheets.slice(0, SAFE_VIEW_SHEETS_MAX)) {
      if (sheets.length && budget <= 0) break;
      const a = await firstScreen(entry, parts, s, Math.min(SAFE_VIEW_CELLS_MAX, Math.max(1, budget)));
      sheets.push(a);
      budget -= a.cells.length;
    }
    return { ok: true, sheets, sheets_total: t.sheets.length, sheets_truncated: sheets.length < t.sheets.length };
  } catch { return { ok: false, why: "reader_failed" }; }
}

/* The reader's sheets, or the stated reason a preview is not drawn (the ground `sheetsOf` and `sheetWindow` share). */
async function readSheets(format, bytes, entries) {
  const entry = entries[format];
  if (!entry || safeViewRoute(format) !== "data") return { ok: false, why: "no_sheets" };
  if (format === "ods") {
    const declared = declaredTextBytes(readContainer(bytes), (n) => n === "content.xml").total;
    if (!(declared <= SAFE_VIEW_ODS_DECLARED_MAX)) return notDrawn(declared, SAFE_VIEW_ODS_DECLARED_MAX);
  }
  const parts = await entry.parts(bytes);
  if (!parts || parts.ok === false) return { ok: false, why: (parts && (parts.why || parts.reason)) || "reader_failed" };
  if (parts.guard) return notDrawn(parts.guard.size, parts.guard.bound);
  if (parts.piecewise) return notDrawn(parts.piecewise.declared, parts.piecewise.bound);
  const t = await entry.text(parts, { inlineCellsMax: SAFE_VIEW_INLINE_CELLS_MAX_BYTES });
  if (!t || t.ok === false || !Array.isArray(t.sheets)) return { ok: false, why: (t && (t.why || t.reason)) || "reader_failed" };
  if (!t.sheets.length) {
    /* no sheet came back: the entry stated why (a size guard, a repeat bound), never an empty view */
    const u = (Array.isArray(t.undetermined) ? t.undetermined : []).map((x) => (x && x.guard) || x).find((x) => x && Number.isFinite(x.bound));
    return notDrawn(u ? (Number.isFinite(u.size) ? u.size : u.units) : bytes.length, u ? u.bound : null);
  }
  return { ok: true, entry, parts, t };
}

/** R11 (G137b): one sheet's window from `fromRow` (default 1), the sheet named by `sheet` (default the first; its name, or its 0-based
 *  position), its whole rows within `SAFE_VIEW_CELLS_MAX` cells, `next_row` the row the next window starts at and null at the last
 *  row: `sheetsOf`'s shape with that sheet alone, `sheets_total` the workbook's, `sheets_truncated` true while others are not shown.
 *  `{ok:false, why}` for a sheet the workbook does not hold. */
export async function sheetWindow(format, bytes, { sheet = null, fromRow = 1 } = {}, entries = DATA_ENTRY) {
  try {
    const r = await readSheets(format, bytes, entries);
    if (!r.ok) return r;
    const { entry, parts, t } = r;
    const start = Number.isInteger(fromRow) && fromRow >= 1 ? fromRow : 1;
    const named = sheet === null || sheet === undefined || sheet === "" ? -1 : t.sheets.findIndex((s) => s.name === String(sheet));
    const i = sheet === null || sheet === undefined || sheet === "" ? 0
      : named >= 0 ? named
      : /^\d+$/.test(String(sheet)) ? Number(sheet) : -1;
    const s = i >= 0 ? t.sheets[i] : null;
    if (!s) return { ok: false, why: "SHEET_NOT_HELD" };
    let a;
    if (Array.isArray(s.cells)) {
      const later = s.cells.map(cellOf).filter((c) => (rowOfCell(c) ?? Infinity) >= start);
      const f = firstRows(later, SAFE_VIEW_CELLS_MAX);
      a = sheetAnswer(s, f.cells, f.next_row, f.cut);
    } else if (!s.cells_held || typeof entry.cellsIn !== "function") a = unreadable(s, "sheet_unreadable");
    else {
      const c = await entry.cellsIn(parts, { sheet: s.sheet, fromRow: start, toCol: SAFE_VIEW_CELLS_MAX, maxCells: SAFE_VIEW_CELLS_MAX });
      a = !c || c.ok !== true || !Array.isArray(c.cells) ? unreadable(s, "cells_unreadable")
        : sheetAnswer(s, c.cells.map(cellOf), c.next_row ?? null, false);
    }
    return { ok: true, sheets: [a], sheets_total: t.sheets.length, sheets_truncated: t.sheets.length > 1 };
  } catch { return { ok: false, why: "reader_failed" }; }
}

/** R14 (K1928 Q2): the structure check over the reader's whole read: what it flags, by name. An archive is checked
 *  by its listing (`archiveFlags`), and a file no reader reads could not be checked. */
const FLAGGED_KINDS = new Set(["launch", "activex", "ole-object", "embedded-file", "xl4-macrosheet", "external-target"]);
export function structureFlags(read) {
  if (!read.ok) return { ran: true, flags: [/ambiguous/i.test(String(read.why)) ? `ambiguous:${read.why}` : `refused:${read.why}`] };
  const flags = [];
  for (const item of read.active) {
    if (!item || typeof item !== "object") continue;
    if (item.kind === "unread") flags.push("unread");
    else if (item.kind === "encryption") flags.push("encrypted");
    else if (FLAGGED_KINDS.has(item.kind)) flags.push(item.kind);
    else if (item.kind === "vba-project") {
      if (item.read === false) flags.push("vba-project:unread");
      if (Array.isArray(item.suspicious) && item.suspicious.length) flags.push("vba-project:suspicious");
      if (Array.isArray(item.undetermined) && item.undetermined.length) flags.push("vba-project:undetermined");
    }
  }
  return { ran: true, flags: [...new Set(flags)] };
}

/** R45: whether the first bytes of a file say it is one whose format only the whole file can tell (a PDF, a ZIP container
 *  such as an office or OpenDocument file or an archive, or a compound file), so a file longer than `HEAD_MAX` is read whole. */
export function needsWholeFile(head) {
  if (!(head instanceof Uint8Array)) return true;
  return /%PDF-\d+\.\d+/.test(LATIN1.decode(head.subarray(0, 1024))) || hasZipMagic(head)
    || startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

/** R45: the bytes cut back to the end of their last whole UTF-8 character, for a head that stops mid-character. */
export function wholeCharacters(bytes) {
  let i = bytes.length - 1, back = 0;
  while (i >= 0 && back < 3 && (bytes[i] & 0xc0) === 0x80) { i--; back++; }
  if (i < 0) return bytes;
  const lead = bytes[i], need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
  return bytes.length - i < need ? bytes.subarray(0, i) : bytes;
}

/** R45: the file's own characters exactly as it holds them (a byte order mark kept, nothing interpreted), cut at
 *  `SAFE_VIEW_TEXT_MAX` characters: `{text, truncated}`, `truncated` true when the file goes on past the cut. `more` says
 *  the bytes are only the start of a longer file. `{ok:false}` when the bytes are not UTF-8. */
export function textView(bytes, more = false) {
  try {
    const all = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    let end = all.length, kept = 0;
    for (let i = 0; i < all.length; kept++) {
      if (kept === SAFE_VIEW_TEXT_MAX) { end = i; break; }
      i += all.codePointAt(i) > 0xffff ? 2 : 1;
    }
    return { ok: true, text: all.slice(0, end), truncated: end < all.length || more };
  } catch { return { ok: false }; }
}
