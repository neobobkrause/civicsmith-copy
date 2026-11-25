/* The XLSX registry entry (QUEUE COFF-3) — the first real user of I7's
 * `parts` slot, built on COFF-2's container reader (ooxml.mjs) and COFF-1's
 * registry contract (formats.mjs, I7 CONFIRMED 1.0.0).
 *
 * WHAT IT EMITS, and where each piece of doctrine lives:
 *
 *   structure(parts) -> the I2 shape. Outbound links come from each sheet's
 *   `xl/worksheets/_rels/sheetN.xml.rels` joined to the sheet's <hyperlink>
 *   elements (the rels know the TARGET, the sheet XML knows the CELL), and
 *   land in the SAME four partitions HTML and PDF use through the ONE
 *   `linkWrapper` imported from subresources.mjs — never re-derived, the one
 *   way drift cannot happen (`pdfstructure.mjs` makes the identical move, and
 *   both suites pin the parity). Defined names and cross-sheet hyperlink
 *   locations -> `anchor`; `xl/embeddings/` -> `intra`, content-addressed by
 *   sha256 exactly as a bundle companion is; anything unresolvable ->
 *   a STATED `undetermined` carrying WHY, never dropped, never invented.
 *
 *   Element references are IC-1's resolved union (RESOLVED as amended,
 *   2026-08-03): `{ kind:"sheet-cell", ref:"Sheet1!B14", sheet, cell }` —
 *   `kind` the required discriminator, `ref` the human form the container
 *   knows, produced HERE so no consumer ever parses per-container syntax.
 *
 *   text(parts) -> the I2 text shape: `xl/sharedStrings.xml` + each sheet's
 *   cached <v> values (what the published sheet DISPLAYS), per sheet, with
 *   hidden sheets included AND flagged — the record holds what the file
 *   carries; hiding is a fact about the file, not a reason to omit.
 *
 *   THE EVIDENTIARY CORE (DEC-5), carried in the shared `evidentiary`
 *   envelope — IC-2 as ACCEPTED from COFF-4's as-built code (docx.mjs landed
 *   first; this entry CONFIRMS the envelope, inventing no variant):
 *     { container:"xlsx", kinds:[...], items:[{kind, source, ...}],
 *       undetermined:[{part, why, ...}], counts:{<kind>:n} }
 *   The <f> FORMULA is held BESIDE its cached <v> value as two named fields
 *   on one item — never collapsed, never substituted for the value in the
 *   text stream — because the derivation is frequently the finding and every
 *   rendered form of the sheet destroys it. Hidden rows, columns and SHEETS
 *   are emitted flagged hidden: a hidden sheet is a first-class finding
 *   invisible in every rendered form. `docProps/core.xml` rides the envelope
 *   as a `core-properties` item — the SAME kind name DOCX emits, so the
 *   provenance-adjacent metadata is one vocabulary across the office entries.
 *
 * THE CONFIDENCE LADDER for detect(), decided deliberately (the COFF-1
 * handoff requires it): detect is SYNCHRONOUS (the registry does not await
 * it), so it can walk the central directory but can never inflate
 * [Content_Types].xml. Therefore:
 *
 *   bytes, full container in hand : central directory readable AND
 *       [Content_Types].xml AND xl/workbook.xml both present -> "likely".
 *       Never "certain" from this seam — the flavour's declared main content
 *       type lives INSIDE a deflated part, and claiming certainty without
 *       reading it would be claiming what the bytes read so far do not say.
 *       parts() completes the discrimination through ooxml.mjs's
 *       discriminate() (magic + parts + declared type, confidence "high").
 *   bytes, a PREFIX only (the acquire-time 1 KiB seam): the central
 *       directory is out of reach, so the honest answer is NO ANSWER — a
 *       bare PK sniff must NOT claim xlsx (a renamed plain ZIP is not a
 *       .xlsx), and this entry returns null rather than a guess.
 *   content type only: the declared xlsx type -> "likely" at best, per the
 *       registry's own two-pass doctrine (a declared type is a claim).
 *
 * THE SIZE BOUND is COFF-6's measured metric, enacted in ooxml.mjs: 20 MiB
 * of DECLARED UNCOMPRESSED text-part bytes (sheets + sharedStrings), summed
 * from the central directory BEFORE inflation. It is what this entry may hold
 * in memory at once. Over it, up to ooxml.mjs's STREAMED_TEXT_BOUND_BYTES, the
 * text is READ IN PIECES (R35, F7): each sheet part is inflated in windows and
 * walked a run of whole rows at a time, so a sheet is never held whole and its
 * rows are consumed as they come; the typed `cells` list (R30) is not made
 * (`cells` is null, as over the guard) and the answer says it was read in
 * pieces (`piecewise`). Over the streamed ceiling the text is refused as a
 * STATED text-undetermined carrying the guard's marker, its size and
 * `final: true`; the container and metadata treatment still runs in full —
 * links from rels (their cell joins honestly undetermined), hidden SHEETS
 * still flagged from the small workbook.xml. Every part read passes
 * ooxml.mjs's part cap (R12, F18).
 *
 * HELD CELLS (G41; K4636, K4639, K4642). A sheet's typed cells are not all made
 * at intake. A caller that passes `{inlineCellsMax}` to text() (reading-pipeline,
 * which stores the reading) gets a sheet's `cells` only while the workbook's
 * cells together, as JSON, are within that many bytes; past it every walked
 * sheet carries `cells: null` and `cells_held: true`, and the cells of a range
 * are made from the held bytes by `cellsIn()`, the same cells the whole read
 * makes, one run of rows at a time. A caller that passes no option is answered
 * as it always was. A workbook under the bound above is read whole, the cells held
 * too: measured (job record, G41), an opted-in read of 19.6 MiB of declared
 * text survives at 48 MB of old space over an idle of 17, inside the 79 MB less
 * the file's size the plane's object leaves, so no smaller threshold for reading
 * in windows is needed (windows cost more for long strings than they save).
 *
 * ACTIVE CONTENT (R32): `active` on structure() and text(), from docx.mjs's
 * one `activeContent` builder, Excel 4.0 macro sheets included; .xlsm/.xltm/
 * .xlam read as this entry with `variant` set (R33).
 *
 * This module asserts nothing about MEANING (FRAMEWORK's, through I2) and
 * WRITES nothing.
 */

import {
  hasZipMagic, readContainer, discriminate,
  CONTENT_TYPES_PART, relsPartFor, normalizePartName, walkRels,
  declaredTextBytes, CORE_PROPERTIES_PART, readCoreProperties,
  withContainerImages, textPlan, cutBefore,
} from "./ooxml.mjs";
import { linkWrapper } from "./subresources.mjs";
import { withMetadata, activeContent, withActive, detectByContentType } from "./docx.mjs";
import { localize } from "./setup-words/index.mjs";
import { boundOf } from "./read-bounds.mjs";
import {
  Scanner, scanPart, scanWhole, scanSync, parseAttrs, unescape, readText, scanNotes, collectElements, memberIdentities, addressParts, textSink,
} from "./office-xml.mjs";

/* R44: what the walk may retain, cells and links together (the table's figure, never a literal here). */
const OFFICE_RETAINED_MAX = boundOf("office", "retained_objects");
const stripOk = ({ ok, ...rest }) => rest;

/* Bytes as a Uint8Array, an ArrayBuffer, any typed-array view or an array of
 * byte values; anything else reads as no bytes, so a wrong argument is a
 * named refusal downstream, never a throw (R21; ooxml.mjs's own policy). */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return new Uint8Array(x ?? 0); } catch { return new Uint8Array(0); }
}
const isBytes = (x) => x instanceof ArrayBuffer || ArrayBuffer.isView(x);


export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/* R33 (K1903): the macro-enabled flavours' package types, read as xlsx. */
const XLSX_TWIN_CONTENT_TYPES = new Map([
  ["application/vnd.ms-excel.sheet.macroEnabled.12", "xlsm"],
  ["application/vnd.ms-excel.template.macroEnabled.12", "xltm"],
  ["application/vnd.ms-excel.addin.macroEnabled.12", "xlam"],
]);

const WORKBOOK_PART = "xl/workbook.xml";
const SHARED_STRINGS_PART = "xl/sharedStrings.xml";
const STYLES_PART = "xl/styles.xml";

/* ------------------------------------------------------------------ *
 * XML extraction for the spreadsheet grammars (worksheet, sharedStrings, workbook, styles): office-xml.mjs's one
 * scanner reads each part once (R42); what a part cannot be read as yields a stated undetermined, never a guessed
 * structure.
 * ------------------------------------------------------------------ */

const decodeXmlEntities = unescape;

/** The shared strings as a scanner handler: one `<si>` is one string, its `<t>` text with the phonetic runs (`<rPh>`,
 *  East Asian reading guides, which are a reading aid and not the cell's text) left out. */
function sharedStringsReader() {
  const strings = [];
  let inSi = false, cur = "", inT = false, rph = 0;
  const handler = {
    text(s) { if (inT) cur += unescape(s); },
    cdata(s) { if (inT) cur += s; },
    open(name, raw, self) {
      if (name === "si") { if (self) strings.push(""); else { inSi = true; cur = ""; rph = 0; } }
      else if (inSi) {
        if (name === "rPh" && !self) rph++;
        else if (name === "t" && !self && rph === 0) inT = true;
      }
    },
    close(name) {
      if (name === "si") { if (inSi) strings.push(cur); inSi = false; inT = false; }
      else if (name === "rPh") { if (rph > 0) rph--; }
      else if (name === "t") inT = false;
    },
  };
  return { handler, strings };
}

/* ------------------------------------------------------------------ *
 * R30 — dates typed from the number format (fix round 9, G134c; S-11)
 * ------------------------------------------------------------------ */

/* The built-in number formats that are dates or date-times (ECMA-376 18.8.30; the East Asian locales' too). 18-21,
   32-35 and 45-47 carry only a time and stay numbers. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** A custom format code's kind: `"date"` when it carries date tokens (a year, a day, a month), `"time"` when it carries
 *  only time tokens, else null. Quoted text, escaped characters, fill characters, colours and conditions are not
 *  tokens; `m` is a minute when it follows an hour or precedes a second, else a month. */
function formatKind(code) {
  let f = String(code ?? "").replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/[_*]./g, "");
  let elapsed = false;
  f = f.replace(/\[(h+|m+|s+)\]/gi, (_, t) => { elapsed = true; return t[0].toLowerCase() === "m" ? "h" : t[0].toLowerCase(); });
  f = f.replace(/\[[^\]]*\]/g, "").split(";")[0].toLowerCase().replace(/am\/pm|a\/p/g, "");
  if (/[yd]/.test(f)) return "date";
  let minuteOrTime = elapsed || /[hs]/.test(f);
  for (const m of f.matchAll(/m+/g)) {
    let before = m.index - 1;
    while (before >= 0 && (f[before] === ":" || f[before] === " ")) before--;
    let after = m.index + m[0].length;
    while (after < f.length && (f[after] === ":" || f[after] === " " || f[after] === ".")) after++;
    if (f[before] === "h" || f[after] === "s") minuteOrTime = true;
    else return "date";
  }
  return minuteOrTime ? "time" : null;
}

/** `xl/styles.xml` as a scanner handler: the custom number formats and the cell formats (`cellXfs`) in order. */
function stylesReader() {
  const numFmts = new Map();
  const xfs = [];
  let inCellXfs = false;
  const handler = {
    text() {}, cdata() {},
    open(name, raw, self) {
      if (name === "numFmt") { const a = parseAttrs(raw); if (a.numFmtId != null) numFmts.set(parseInt(a.numFmtId, 10), a.formatCode ?? ""); }
      else if (name === "cellXfs" && !self) inCellXfs = true;
      else if (name === "xf" && inCellXfs) { const a = parseAttrs(raw); xfs.push(a.numFmtId != null ? parseInt(a.numFmtId, 10) : 0); }
    },
    close(name) { if (name === "cellXfs") inCellXfs = false; },
  };
  return { handler, numFmts, xfs };
}

/** What a workbook's styles say about its cells: `{is1904, kindOf(styleIndex) -> "date"|"time"|null}`. */
function datesFrom(styles, is1904) {
  const cache = new Map();
  const kindOfId = (id) => {
    if (BUILTIN_DATE_FORMATS.has(id)) return "date";
    if (id >= 164 && styles.numFmts.has(id)) return formatKind(styles.numFmts.get(id));
    return null;
  };
  return { is1904, kindOf(style) {
    const i = style != null && /^\d+$/.test(style) ? parseInt(style, 10) : 0;
    if (!cache.has(i)) cache.set(i, i < styles.xfs.length ? kindOfId(styles.xfs[i]) : null);
    return cache.get(i);
  } };
}

const DAY_MS = 86400000;
const pad = (n, w = 2) => String(n).padStart(w, "0");
/** A stored serial as ISO 8601 under the workbook's date system, or null when its system cannot express it (a serial
 *  before day 1, the 1900 system's nonexistent 29 February 1900, a year past 9999). A time part (`THH:MM:SS`) is given
 *  when the stored number has one. */
function serialToIso(lexical, is1904) {
  if (typeof lexical !== "string" || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(lexical.trim())) return null;
  const x = Number(lexical);
  if (!Number.isFinite(x) || x < 0) return null;
  let days = Math.floor(x);
  const frac = x - days;
  let secs = Math.round(frac * 86400);
  if (secs >= 86400) { days += 1; secs -= 86400; }
  let epochDays;
  if (is1904) epochDays = Date.UTC(1904, 0, 1) / DAY_MS + days;
  else {
    if (days < 1 || days === 60) return null; // 0 is no day, 60 is the fictitious 29 February 1900
    epochDays = Date.UTC(1899, 11, days < 60 ? 31 : 30) / DAY_MS + days;
  }
  const d = new Date(epochDays * DAY_MS);
  const y = d.getUTCFullYear();
  if (!(y >= 1 && y <= 9999)) return null;
  const date = `${pad(y, 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (frac === 0) return date;
  return `${date}T${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
}

/** The ISO date a cell holds when its number format makes it a date, else null. */
function dateOf(c, dates) {
  if (!dates || !(c.t == null || c.t === "n") || c.v == null) return null;
  if (dates.kindOf(c.s) !== "date") return null;
  return serialToIso(c.v, dates.is1904);
}

/* The sheet-reference builders (IC-1 `sheet-cell`, FW-19 `sheet-range`, A1 column letters) live in
 * `csv-reader` (module order: office-readers uses it); re-exported here so docx, odf and the
 * tests that import them from this file are unchanged. */
import { sheetCellRef, sheetRangeRef, columnLetters, usedSheetRange } from "./csv.mjs";
export { sheetCellRef, sheetRangeRef, columnLetters, usedSheetRange };

/* ------------------------------------------------------------------ *
 * D-415 — A WORKBOOK'S NAMED UNITS (R9; EXTRACTION-BREADTH §3.3 item 1).
 * ------------------------------------------------------------------ *
 *
 * `usedSheetRange` names the WHOLE sheet. A workbook also names FINER units
 * itself: a DEFINED NAME (`<definedName>` in workbook.xml) and a TABLE
 * (`xl/tables/tableN.xml`, reached through a sheet's own rels). Each that
 * names ONE rectangle on ONE sheet of THIS workbook is emitted as a
 * `sheet-range` unit through the one builder, carrying the name its author
 * gave it. Everything else a name can hold — several areas, a formula or
 * constant, `#REF!`, a whole row or column, another workbook, a sheet this
 * workbook does not have, an address past the grid — is SKIPPED WITH ITS
 * REASON, never dropped and never approximated: a unit widened or guessed
 * would be the record claiming an extent the author did not name (R22).
 *
 * Judged at the T2 job from the snapshot's D-415 (48245247) and kept as built
 * for `.xlsx`; the `.ods` half is `odf-reader`'s. `a1Corner` and
 * `rangeUnitFor` are PROVIDED (N27): the one reading of an A1 corner and the
 * one place a rectangle becomes a unit, so that half reuses them rather than
 * growing a second copy. As provided services they never throw (R21): an
 * argument they cannot read is a stated reason, like any other.
 */

const isCorner = (c) => c != null && Number.isInteger(c.col) && c.col > 0 && Number.isInteger(c.row) && c.row > 0;

/** One A1 corner (`$B$14`, `b14`) -> {col,row}, both 1-based, or null. The
 *  `$` markers are notation, not address; letters are read without case;
 *  surrounding whitespace is trimmed. Anything else — not a string, a whole
 *  row or column, a row of 0 or with a leading zero, more than three letters
 *  or seven digits — is null, never a guessed corner. */
export function a1Corner(s) {
  if (typeof s !== "string") return null;
  const m = /^\$?([A-Za-z]{1,3})\$?([1-9]\d{0,6})$/.exec(s.trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(m[2], 10) };
}

/** A rectangle on a named sheet -> {unit} or {why}. `a`/`b` are corners as
 *  `a1Corner` returns them, in either order; `sheets` the workbook's sheet
 *  names; `grid` the format's bound `{rows, cols}`, or null when the format
 *  fixes none (`.ods`, csv). A sheet name matches exactly, else
 *  case-insensitively when exactly one sheet answers (the format resolves
 *  sheet names without case); the unit carries the WORKBOOK's spelling. Why
 *  not: `not_a_range_reference` (a corner is not one), `no_such_sheet`,
 *  `outside_grid`. */
export function rangeUnitFor(sheetName, a, b, sheets, grid = null) {
  if (!isCorner(a) || !isCorner(b)) return { why: "not_a_range_reference" };
  const names = Array.isArray(sheets) ? sheets.filter((s) => typeof s === "string") : [];
  if (typeof sheetName !== "string") return { why: "no_such_sheet" };
  let sheet = names.includes(sheetName) ? sheetName : null;
  if (sheet == null) {
    const ci = names.filter((s) => s.toLowerCase() === sheetName.toLowerCase());
    if (ci.length === 1) sheet = ci[0];
  }
  if (sheet == null) return { why: "no_such_sheet" };
  const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
  const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
  if (grid && (c2 > grid.cols || r2 > grid.rows)) return { why: "outside_grid" };
  return { unit: sheetRangeRef(sheet, `${columnLetters(c1)}${r1}:${columnLetters(c2)}${r2}`) };
}

/** Split at every top-level `sep` — outside a quoted sheet name and outside
 *  parentheses — so `'a,b'!A1` is one area and `A1,B2` is two. */
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0, quoted = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") {
      if (quoted && s[i + 1] === "'") { cur += "''"; i++; continue; }
      quoted = !quoted;
    } else if (!quoted && ch === "(") depth++;
    else if (!quoted && ch === ")") depth--;
    else if (!quoted && depth === 0 && ch === sep) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** A defined name's formula text -> {unit} or {why}. The ONE grammar read is
 *  `Sheet!A1` / `Sheet!A1:B2` / `'Quoted ''Sheet'''!$A$1:$B$2`; anything else
 *  is a stated reason. A sheet name cannot hold `:` or `[`, so a `:` before the
 *  `!` is a 3-D (multi-sheet) reference and a `[..]` is another workbook. */
function definedNameUnit(formula, sheets) {
  const f = String(formula ?? "").trim();
  if (!f) return { why: "empty_reference" };
  if (/#REF!/i.test(f)) return { why: "broken_reference" };
  if (splitTopLevel(f, ",").length > 1 || /^\(.*\)$/.test(f)) return { why: "multi_area" };
  const m = /^(?:'((?:[^']|'')+)'|([^'!\s,()]+))!(.+)$/.exec(f);
  if (!m) return { why: "not_a_range_reference" };
  const sheetName = m[1] != null ? m[1].replace(/''/g, "'") : m[2];
  if (/\[[^\]]*\]/.test(sheetName)) return { why: "external_workbook" };
  if (sheetName.includes(":")) return { why: "multi_sheet_reference" };
  const corners = m[3].split(":");
  if (corners.length > 2) return { why: "not_a_range_reference" };
  const a = a1Corner(corners[0]);
  const b = corners.length === 2 ? a1Corner(corners[1]) : a;
  if (!a || !b) {
    if (corners.every((c) => /^\$?(?:[A-Za-z]{1,3}|\d+)$/.test(c.trim()))) return { why: "whole_row_or_column" };
    return { why: "not_a_range_reference" };
  }
  return rangeUnitFor(sheetName, a, b, sheets, { rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS });
}

/** R9 — every defined name and table part as a `sheet-range` unit, or skipped
 *  with its reason. `scope` is the sheet a sheet-scoped name belongs to
 *  (`localSheetId`) or a table's sheet, null for a workbook-scoped name;
 *  `hidden` is the file's own flag, carried and never a reason to omit (R23).
 *  Read from workbook.xml, the sheets' rels and the table parts only, so it is
 *  emitted over the text bound too. */
function xlsxRangeUnits(parts) {
  const names = parts.sheets.map((s) => s.name);
  const units = [], skipped = [];
  for (const dn of parts.definedNames) {
    const r = definedNameUnit(dn.ref, names);
    const scope = dn.localSheetId != null ? (parts.sheets[dn.localSheetId]?.name ?? null) : null;
    if (r.unit) units.push({ source: "defined-name", name: dn.name, scope, hidden: dn.hidden, unit: r.unit });
    else skipped.push({ source: "defined-name", name: dn.name, ref: dn.ref, why: r.why });
  }
  for (const t of parts.tables) {
    if (t.why) { skipped.push({ source: "table", name: t.name, ref: t.ref, part: t.part, why: t.why }); continue; }
    const corners = String(t.ref ?? "").split(":");
    const a = corners.length <= 2 ? a1Corner(corners[0]) : null;
    const b = corners.length === 2 ? a1Corner(corners[1]) : a;
    const r = a && b ? rangeUnitFor(t.sheet, a, b, names, { rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS })
                     : { why: "not_a_range_reference" };
    if (r.unit) units.push({ source: "table", name: t.name, scope: t.sheet, hidden: false, unit: r.unit });
    else skipped.push({ source: "table", name: t.name, ref: t.ref, part: t.part, why: r.why });
  }
  return { rangeUnits: units, rangeUnitsSkipped: skipped };
}

/* ------------------------------------------------------------------ *
 * COFF-11 / IC-100 / D-359 — A SHEET'S BOUND, AND THE DECISION IT CARRIES.
 * ------------------------------------------------------------------ *
 *
 * THE BOUND IS THE GRID, NEVER THE USED RANGE, and that is a decision rather
 * than a convenience. the sheet walk can say exactly how far this workbook's
 * cells reach, and feeding THAT to the `sheet-cell` arm of C-45.1 would refuse
 * `Summary!D500` on a sheet filled to row 12 — a cell that EXISTS in the
 * workbook and was EMPTY at capture. That is the record refusing a TRUE
 * statement, and in this product an empty cell is routinely the finding
 * ("the disclosure's Schedule B was left blank"). Worse, the refusal does not
 * stop a member citing the document: it pushes them up to the WHOLE DOCUMENT,
 * which claims MORE and not less — the reason already ruled twice in this
 * plane, at the store's `#pageSetForCapture` and `#containerExtentForCapture`.
 * So the bound refuses only the IMPOSSIBLE, and `NoSuchSheet!ZZ9999999` — the
 * address D-354 and D-359 both cite as the measured cost of the unfed arm — is
 * impossible on its ROW and is refused here.
 *
 * THE USED RANGE IS STILL EMITTED, BESIDE IT AND UNDER ITS OWN NAME
 * (`usedRows`/`usedCols`), because the two facts are different and a later
 * reader must be able to tell "empty at capture" from "outside the grid"
 * without either figure pretending to be the other. Nothing consumes the used
 * range today; it is emitted because this walk is the only place that knows it
 * and re-walking the container to ask again would be a second opinion about
 * one number (CAP-12's own rule at the acquire wire).
 *
 * THE FIGURES ARE THE FORMAT'S, MEASURED AGAINST A REAL PRODUCER ON THIS
 * MACHINE rather than cited from a vendor's documentation — see
 * `MEASUREMENTS.md`, 2026-09-15. `.ods` does NOT get a bound: OpenDocument
 * fixes no maximum table size at all, so `odf.mjs` emits a NULL there and says
 * so, which is undetermined-is-first-class at this construct and not a gap in
 * that reader. */
const XLSX_GRID_ROWS = 1048576;
const XLSX_GRID_COLS = boundOf("sheet", "columns");

/** The 1-based column number of an A1 reference, or null — `a1Corner`'s
 *  reading, the one there is. `$B$14` and `B14` both answer 2 — the absolute
 *  markers are notation, not address, exactly as `CONTENT_EXTENT_A1_RE` in the
 *  check catalog treats them. Anything this cannot read is null and is
 *  SKIPPED by the caller, never scored zero: a reference this helper does not
 *  understand must not silently shrink a sheet's measured extent. */
const a1Col = (ref) => a1Corner(ref)?.col ?? null;

/* http/https are addresses the record may hold a capture of elsewhere:
 * deferred. Everything else a hyperlink rel can carry (mailto:, file:, ...)
 * is refused — the same partition rule HTML and PDF apply. */
function classifyUrl(url) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(url || "");
  const scheme = m ? m[1].toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  if (!scheme && url) return "deferred"; // scheme-relative / bare address: resolvable against the record
  return "refused";
}

/* A worksheet rels target is resolved against the part's own directory
 * (OPC convention): "../drawings/x.xml" from "xl/worksheets/" -> "xl/...". */
function resolveTarget(fromPart, target) {
  if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(target) || target.startsWith("/")) {
    return normalizePartName(target);
  }
  const base = fromPart.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") base.pop();
    else base.push(seg);
  }
  return base.join("/");
}

/* ------------------------------------------------------------------ *
 * parts() — the container walk, run ONCE; structure() and text() are
 * projections of what it assembled.
 * ------------------------------------------------------------------ */

async function xlsxParts(bytes) {
  const b = toBytes(bytes);
  const undetermined = [];
  const partials = [];

  /* The full discrimination (magic + parts + declared main content type). A
   * container that is not honestly an xlsx yields a stated refusal, never a
   * walk of something else's parts. */
  const disc = await discriminate(b);
  if (!disc.ok) return { ok: false, why: disc.why, signals: disc.signals };
  if (disc.format !== "xlsx") {
    /* An undetermined discrimination carries its own reason (a refused
       limit included, R12), as docx and pptx state it. */
    return { ok: false, why: disc.format === "undetermined" ? disc.why : `not_xlsx:${disc.format}`, signals: disc.signals };
  }
  const container = readContainer(b);

  /* The workbook part: sheet order, names, and the HIDDEN state (DEC-5 —
   * state="hidden"|"veryHidden" is invisible in every rendered form). */
  const wbRead = await readText(b, container, WORKBOOK_PART);
  if (!wbRead.ok) return { ok: false, why: `workbook_unreadable:${wbRead.why}` };
  if (wbRead.partial) partials.push(wbRead.partial);
  const wb = collectElements(wbRead.text, ["sheet", "definedName", "workbookPr"]);
  if (wb.badRef) return { ok: false, why: "workbook_unreadable:char_ref_invalid" };
  const date1904 = wb.elements.some((e) => e.name === "workbookPr" && (e.attrs.date1904 === "1" || e.attrs.date1904 === "true"));

  /* Every _rels/*.rels part, walked ONCE: the workbook's (sheet parts), each
   * sheet's (hyperlink targets, table parts) and every other part's outbound
   * relationships (a drawing's hyperlinks, an external link's workbook path)
   * all come from this one walk, and an unreadable one is stated by it. */
  const rels = await walkRels(b, container);
  const relsOf = (part) => rels.byPart.find((p) => p.part === relsPartFor(part)) ?? null;

  /* workbook.xml.rels: r:id -> worksheet part, resolved against xl/. */
  const relsById = new Map();
  const wbRels = relsOf(WORKBOOK_PART);
  if (wbRels) {
    for (const r of wbRels.relationships) if (r.id) relsById.set(r.id, r);
  } else {
    const stated = rels.undetermined.find((u) => u.part === relsPartFor(WORKBOOK_PART));
    undetermined.push({ part: relsPartFor(WORKBOOK_PART), why: stated?.why ?? "part_absent" });
  }

  const sheets = wb.elements.filter((e) => e.name === "sheet").map((s, index) => {
    const state = s.attrs.state === "hidden" || s.attrs.state === "veryHidden" ? s.attrs.state : "visible";
    const rel = s.attrs.id ? relsById.get(s.attrs.id) : null;
    /* A <sheet> must carry a name; one that does not is stated, and the
     * placeholder it is given is said to be one (R22). */
    if (s.attrs.name == null) undetermined.push({ part: WORKBOOK_PART, why: `sheet_name_absent:${index}` });
    return {
      index,
      name: s.attrs.name ?? `sheet${index + 1}`,
      sheetId: s.attrs.sheetId ?? null,
      state,
      hidden: state === "visible" ? false : state,
      part: rel && !rel.external ? resolveTarget(WORKBOOK_PART, rel.target) : null,
      xml: null,
      why: rel ? null : "sheet_rel_unresolved",
    };
  });

  /* Defined names -> anchor material, and R9's units. `localSheetId` and
   * `hidden` ride along for the units; the anchor links read name/ref only. */
  const definedNames = wb.elements.filter((e) => e.name === "definedName" && e.attrs.name != null)
    .map((d) => ({ name: d.attrs.name, ref: d.text.trim(),
      localSheetId: /^\d+$/.test(d.attrs.localSheetId ?? "") ? parseInt(d.attrs.localSheetId, 10) : null,
      hidden: d.attrs.hidden === "1" || d.attrs.hidden === "true" }));

  /* R9 — TABLE PARTS, reached through each sheet's OWN rels (relationship
   * type …/table), never by filename. Workbook metadata, read even over the
   * text bound as hidden sheets are: a table part names an address, not text.
   * An unreadable table part is carried as a skip with its reason. */
  const tables = [];
  for (const sheet of sheets) {
    const sr = sheet.part ? relsOf(sheet.part) : null;
    sheet.rels = sr;
    if (!sr) continue;
    for (const r of sr.relationships) {
      if (r.external || !r.target || !/\/table$/.test(String(r.type ?? ""))) continue;
      const part = resolveTarget(sheet.part, r.target);
      const tr = await readText(b, container, part);
      if (!tr.ok) { tables.push({ sheet: sheet.name, part, name: null, ref: null, why: `table_part_unreadable:${tr.why}` }); continue; }
      const found = collectElements(tr.text, ["table"]);
      if (found.badRef) { tables.push({ sheet: sheet.name, part, name: null, ref: null, why: "table_part_unreadable:char_ref_invalid" }); continue; }
      const t = found.elements[0];
      tables.push({ sheet: sheet.name, part,
        name: t ? (t.attrs.displayName ?? t.attrs.name ?? null) : null, ref: t ? (t.attrs.ref ?? null) : null,
        why: t ? null : "table_element_absent" });
    }
  }

  /* THE MEASURED BOUND (COFF-6, enacted in ooxml.mjs): declared uncompressed
   * text-part bytes — the sheets and sharedStrings — summed from the central
   * directory BEFORE any inflation. Under the bound the parts are read whole.
   * Over it, up to the streamed ceiling, they are read in PIECES (R35): the
   * shared strings now, as a list, and each sheet when text() or structure()
   * walks it, so no sheet is held. Over the ceiling `guard` is the stated
   * marker (the docx.mjs pattern, so the two entries carry the refusal
   * identically). */
  const sheetParts = new Set(sheets.map((s) => s.part).filter(Boolean));
  const isTextPart = (n) => sheetParts.has(n) || n === SHARED_STRINGS_PART;
  const declared = declaredTextBytes(container, isTextPart);
  const plan = textPlan(declared.total);
  const guard = plan.read === "none" ? plan.guard : null;
  const piecewise = plan.read === "pieces" ? plan.piecewise : null;

  let sharedStrings = null;
  let dates = null;
  if (plan.read !== "none") {
    /* sharedStrings, if the package has one. Absence is normal; presence
     * that cannot be read is a stated undetermined every t="s" cell will
     * inherit rather than a guessed string. */
    if (container.byName.has(SHARED_STRINGS_PART)) {
      const reader = sharedStringsReader();
      const ss = await scanPart(b, container, SHARED_STRINGS_PART, reader.handler,
        { mode: plan.read === "whole" ? "whole" : "pieces", cut: SI_CUT });
      if (ss.ok) {
        sharedStrings = reader.strings;
        if (ss.partial) partials.push(ss.partial);
        undetermined.push(...scanNotes(SHARED_STRINGS_PART, ss.scanner));
      } else undetermined.push({ part: SHARED_STRINGS_PART, ...stripOk(ss) });
    }
    /* The number formats (R30): which cells are dates. Absence is normal OPC. */
    if (container.byName.has(STYLES_PART)) {
      const reader = stylesReader();
      const st = await scanPart(b, container, STYLES_PART, reader.handler, { mode: "whole" });
      if (st.ok) { dates = datesFrom(reader, date1904); if (st.partial) partials.push(st.partial); }
      else undetermined.push({ part: STYLES_PART, ...stripOk(st) });
    }
    for (const sheet of sheets) {
      if (!sheet.part) { undetermined.push({ part: `(sheet ${sheet.name})`, why: sheet.why }); continue; }
      if (plan.read === "pieces") {
        /* Walked in pieces by text() and structure(), each time it is asked
           for; a sheet the package does not hold is stated now. */
        if (container.byName.has(sheet.part) || container.entries.some((e) => normalizePartName(e.name) === sheet.part)) sheet.pieces = true;
        else { sheet.why = "part_absent"; undetermined.push({ part: sheet.part, why: "part_absent" }); }
        continue;
      }
      const read = await readText(b, container, sheet.part);
      if (read.ok) { sheet.xml = read.text; if (read.partial) partials.push(read.partial); }
      else { sheet.why = read.why; undetermined.push({ part: sheet.part, ...stripOk(read) }); }
    }
  }
  /* Over the streamed ceiling, nothing is inflated and nothing is pushed here:
   * the guard marker itself is the statement, carried by structure()'s
   * envelope and by text() verbatim (the docx.mjs pattern). */

  /* docProps/core.xml: absent is normal OPC; present-but-unreadable is a
   * stated undetermined, distinct from absence. */
  let core = null;
  if (container.byName.has(CORE_PROPERTIES_PART)) {
    const c = await readCoreProperties(b, container);
    if (c.ok) core = c;
    else undetermined.push({ part: CORE_PROPERTIES_PART, why: c.why });
  }

  /* R32: names, rels, the VBA project and Excel 4.0 macro sheets — read over
     the guard too (K1903). */
  const active = await activeContent(b, container, rels, "xl/");

  return {
    ok: true, format: "xlsx", variant: disc.variant ?? null, bytes: b, container, date1904, dates,
    sheets, definedNames, tables, rels, sharedStrings, core, active, declared, guard, piecewise, partials, undetermined,
    access: new Map(), shared: new Map(),
  };
}

/* ------------------------------------------------------------------ *
 * The per-sheet cell walk, shared by structure() (formulas, hidden rows/
 * cols, hyperlink cell joins) and text() (values). Returns per-sheet:
 *   rows: [{ r, hidden, cells: [{ cell, t, v, f, is }] }]
 *   hiddenRows, hiddenCols, hyperlinks
 * ------------------------------------------------------------------ */

/* The cuts for a sheet part read in pieces: between two rows (or a row and
 * the first hyperlink), so every piece holds whole elements. The expressions
 * are built here, not shared, and carry no state between cuts. */
const SHEET_CUT = cutBefore(/<(?:[\w.-]+:)?(?:row|hyperlink)\b/g);
const SI_CUT = cutBefore(/<(?:[\w.-]+:)?si\b/g);

/* ------------------------------------------------------------------ *
 * Access points (R37, G131e): where a sheet's rows are, left by the read, so a point read does not read the sheet again
 * ------------------------------------------------------------------ */

/* A sheet part over this is read for a point in blocks of about this size, not whole. */
const ACCESS_BLOCK_CHARS = 1 << 20;

/* The rows of a block, as the read meets them: the smallest and largest row number and whether they came in ascending
   order. A row with no readable `r` follows the row before it, across blocks too (`before`). */
function blockRows() {
  let last = 0;
  const open = (start, extra = {}) => ({ start, end: null, min: Infinity, max: 0, ordered: true, prev: 0, before: last, ...extra });
  const take = (blk, r) => {
    const n = Number.isInteger(r) && r > 0 ? r : last + 1;
    last = n;
    if (n < blk.prev) blk.ordered = false;
    blk.prev = n;
    if (n < blk.min) blk.min = n;
    if (n > blk.max) blk.max = n;
  };
  return { open, take };
}

/** Access points for a sheet held whole: blocks of offsets into the held text. */
function offsetAccess() {
  const rows = blockRows();
  const blocks = [];
  let cur = null;
  return {
    row(at, r) {
      if (!cur || at - cur.start >= ACCESS_BLOCK_CHARS) {
        if (cur) cur.end = at;
        cur = rows.open(blocks.length ? at : 0);
        blocks.push(cur);
      }
      rows.take(cur, r);
    },
    async finish(length) {
      if (cur) cur.end = length;
      return { kind: "offsets", blocks: blocks.filter((b) => b.min !== Infinity), length };
    },
  };
}

/* G178 (R46): the text is encoded once and written once; only the compressed chunks are collected (no Blob of the text, no
   Response collecting a second whole). */
const TEXT_ENC = new TextEncoder();
async function deflateText(s) {
  const cs = new CompressionStream("deflate-raw");
  const writing = (async () => { const w = cs.writable.getWriter(); await w.write(TEXT_ENC.encode(s)); await w.close(); })();
  const chunks = [];
  let size = 0;
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); size += value.length;
  }
  await writing;
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
async function inflateText(u8) {
  const out = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(out).text();
}

/** Access points for a sheet read in pieces: each piece (whole rows) is a block, kept deflated. */
function pieceAccess() {
  const rows = blockRows();
  const blocks = [];
  let cur = null;
  const begin = () => { cur = rows.open(0, { data: null, length: 0 }); };
  begin();
  /* G178 (R46): a piece is deflated while the next is walked, never more than one deflate ahead: the piece before the
     last is awaited when the last is given, so the pieces waiting to be compressed are not all of the sheet. */
  let before = null;
  return {
    row(_at, r) { rows.take(cur, r); },
    piece(text) {
      const blk = cur;
      blk.length = text.length;
      let wait;
      if (blk.min !== Infinity) { blocks.push(blk); blk.data = deflateText(text); wait = blk.data; }
      begin();
      return wait;
    },
    async finish() {
      for (const b of blocks) b.data = await b.data;
      return { kind: "pieces", blocks, length: blocks.reduce((n, b) => n + b.length, 0) };
    },
  };
}

/** R47 (S-18): the cells of `typed` (`{ref, cell}`) that lie in a merged range but are not its top-left cell: they are covered,
 *  and the value one holds is the file's statement under a merge, stated (`covered_by_merge`, with the range). */
function coveredCells(merges, typed, sheetIndex) {
  const at = new Map();
  for (const t of typed) { const c = a1Corner(t.ref ?? ""); if (c) at.set(c.row * 16385 + c.col, t.ref); }
  const out = [];
  for (const range of merges) {
    const ends = String(range).split(":");
    const a = a1Corner(ends[0]), b = ends.length === 2 ? a1Corner(ends[1]) : a;
    if (!a || !b) continue;
    const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
    const note = (ref) => out.push({ sheet: sheetIndex, cell: ref, reason: "covered_by_merge", range });
    if ((r2 - r1 + 1) * (c2 - c1 + 1) <= at.size) {
      for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) {
        const ref = at.get(row * 16385 + col);
        if (ref !== undefined && !(row === r1 && col === c1)) note(ref);
      }
    } else {
      for (const [k, ref] of at) {
        const row = Math.floor(k / 16385), col = k % 16385;
        if (row >= r1 && row <= r2 && col >= c1 && col <= c2 && !(row === r1 && col === c1)) note(ref);
      }
    }
  }
  return out;
}

/** A cell that holds a value or a formula (what the cell list and the text keep; a styled empty cell is neither). */
const holdsValue = (c) => c.v != null || c.f != null || (c.t === "inlineStr" && c.is != null);

/** R47 (S-15): a formula moved `dr` rows and `dc` columns, as Excel moves a shared formula's dependents: every relative
 *  reference (a cell, a column range, a row range) moves, an absolute one (`$`) stays, text in quotes is left alone,
 *  and a reference moved off the grid becomes `#REF!`. */
function shiftFormula(f, dr, dc) {
  if (!dr && !dc) return f;
  const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/, COL = /^\$?[A-Za-z]{1,3}$/, ROW = /^\$?\d{1,7}$/;
  const colOf = (letters) => { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  const move = (abs, v, d, max) => { if (abs) return v; const n = v + d; return n >= 1 && n <= max ? n : null; };
  let out = "", i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      for (;;) { const k = f.indexOf(ch, j); if (k < 0) { j = f.length; break; } if (f[k + 1] === ch) { j = k + 2; continue; } j = k + 1; break; }
      out += f.slice(i, j); i = j; continue;
    }
    if (/[$A-Za-z0-9_.]/.test(ch)) {
      let j = i; while (j < f.length && /[$A-Za-z0-9_.]/.test(f[j])) j++;
      const run = f.slice(i, j);
      const m = CELL.exec(run);
      if (m && f[j] !== "(") {
        const c = move(m[1] === "$", colOf(m[2]), dc, XLSX_GRID_COLS), r = move(m[3] === "$", parseInt(m[4], 10), dr, XLSX_GRID_ROWS);
        out += c == null || r == null ? "#REF!" : `${m[1]}${columnLetters(c)}${m[3]}${r}`;
        i = j; continue;
      }
      const rest = f[j] === ":" ? /^\$?[A-Za-z0-9]{1,7}/.exec(f.slice(j + 1)) : null;
      if (rest && COL.test(run) && COL.test(rest[0])) {
        const a = move(run[0] === "$", colOf(run.replace("$", "")), dc, XLSX_GRID_COLS), b = move(rest[0][0] === "$", colOf(rest[0].replace("$", "")), dc, XLSX_GRID_COLS);
        out += a == null || b == null ? "#REF!" : `${run[0] === "$" ? "$" : ""}${columnLetters(a)}:${rest[0][0] === "$" ? "$" : ""}${columnLetters(b)}`;
        i = j + 1 + rest[0].length; continue;
      }
      if (rest && ROW.test(run) && ROW.test(rest[0])) {
        const a = move(run[0] === "$", parseInt(run.replace("$", ""), 10), dr, XLSX_GRID_ROWS), b = move(rest[0][0] === "$", parseInt(rest[0].replace("$", ""), 10), dr, XLSX_GRID_ROWS);
        out += a == null || b == null ? "#REF!" : `${run[0] === "$" ? "$" : ""}${a}:${rest[0][0] === "$" ? "$" : ""}${b}`;
        i = j + 1 + rest[0].length; continue;
      }
      out += run; i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

/* A sheet's walk, as a scanner handler: `onRow` is called with each row as it is walked (`{r, hidden, cells:[{cell, t, s,
   f, v, is}]}`). `ctl.stopped` ends the scan (a bound went past); `access` is told where each row starts. */
function sheetHandler(onRow, { rowsOnly = false, ctl = { stopped: false }, access = null, retainedMax = OFFICE_RETAINED_MAX, shared = new Map(), startRow = 0 } = {}) {
  const hiddenRows = [];
  const hiddenCols = [];
  const hyperlinks = [];
  const merges = [];
  /* R48: where the walk is. A row with no usable `r` is the row after the last; a cell with no `r` is the column after the last. */
  let rowNo = startRow, colNo = 0;
  /* COFF-11 — THE USED EXTENT, accumulated over the cells this walk has
     already read. It is taken from the CELLS and not from the `<row>`
     elements: a producer may declare a row to carry formatting and put no
     cell in it, and counting that as reach would make the used range a
     statement about styling. A row whose `r` is unreadable, and a cell whose
     A1 reference `a1Col` does not understand, are SKIPPED rather than scored
     zero — the WORKER.md rule that a thing the matcher cannot classify is
     named, not silently counted. A sheet with no cells at all measures 0/0,
     which is a MEASURED zero (this sheet holds nothing) and is a different
     fact from the NULL the bound carries when the format fixes no maximum. */
  let usedRows = 0, usedCols = 0;
  let row = null, cell = null, target = null, buf = "", inIs = false, rph = 0;
  const endCell = () => {
    if (!cell) return;
    /* R47 (S-15): a shared formula's master states its text, its dependents state none: each is the master's, moved by the distance between the cells. */
    if (cell.shared != null) {
      if (cell.f) shared.set(cell.shared, { formula: cell.f, row: cell.row, col: cell.col });
      else { const m = shared.get(cell.shared); if (m) cell.f = shiftFormula(m.formula, cell.row - m.row, cell.col - m.col); }
    }
    if (row) row.cells.push(cell);
    cell = null; target = null;
  };
  const endRow = () => {
    if (!row) return;
    endCell();
    if (row.hidden && row.r != null) hiddenRows.push(row.r);
    /* R47 (S-17): only a cell holding a value or a formula reaches; a styled empty cell is formatting. */
    const held = row.cells.filter(holdsValue);
    if (held.length) {
      if (row.r > usedRows) usedRows = row.r;
      for (const c of held) {
        const col = a1Col(c.cell);
        if (col != null && col > usedCols) usedCols = col;
      }
    }
    const done = row;
    row = null;
    onRow(done);
  };
  const handler = {
    get stopped() { return ctl.stopped; },
    text(s) { if (target) buf += decodeXmlEntities(s); },
    cdata(s) { if (target) buf += s; },
    open(name, raw, self) {
      if (name === "row") {
        endRow();
        const a = parseAttrs(raw);
        const given = a.r != null ? parseInt(a.r, 10) : NaN;
        rowNo = Number.isInteger(given) && given > 0 ? given : rowNo + 1;
        colNo = 0;
        row = { r: rowNo, hidden: a.hidden === "1" || a.hidden === "true", cells: [] };
        if (access) access.row(handler.scanner.at, row.r);
        if (self) endRow();
        return;
      }
      if (row) {
        if (name === "c") {
          endCell();
          const a = parseAttrs(raw);
          const at = a.r ? a1Corner(a.r) : null;
          colNo = at ? at.col : colNo + 1;
          cell = { cell: a.r ? a.r : `${columnLetters(colNo)}${row.r}`, t: a.t ?? null, s: a.s ?? null, f: null, v: null, is: null, shared: null, row: at ? at.row : row.r, col: colNo };
          if (row.cells.length >= retainedMax) { ctl.stopped = true; ctl.exceeded ??= { why: "TOO_MANY_OBJECTS", n: row.cells.length + 1, bound: retainedMax, final: true }; }
          if (self) endCell();
        } else if (cell) {
          if (name === "f") {
            if (cell.f == null) { const fa = parseAttrs(raw); if (fa.t === "shared" && fa.si != null) cell.shared = fa.si; }
            if (self) { cell.f ??= ""; } else { target = cell.f == null ? "f" : "x"; buf = ""; }
          }
          else if (name === "v") { if (self) { cell.v ??= ""; } else { target = cell.v == null ? "v" : "x"; buf = ""; } }
          else if (name === "is") { if (!self) { inIs = cell.is == null; if (inIs) cell.is = ""; } else cell.is ??= ""; }
          else if (inIs && name === "rPh" && !self) rph++;
          else if (inIs && name === "t" && !self && rph === 0) { target = "t"; buf = ""; }
        }
        return;
      }
      if (rowsOnly) return;
      if (name === "col") {
        const a = parseAttrs(raw);
        if (a.hidden === "1" || a.hidden === "true") hiddenCols.push({ min: parseInt(a.min, 10), max: parseInt(a.max, 10) });
      } else if (name === "mergeCell") {
        const a = parseAttrs(raw);
        if (a.ref) merges.push(a.ref);
      } else if (name === "hyperlink") {
        const a = parseAttrs(raw);
        hyperlinks.push({ cell: a.ref ?? null, relId: a.id ?? null, location: a.location ?? null, display: a.display ?? null });
      }
    },
    close(name) {
      if (name === "row") { endRow(); return; }
      if (name === "c") { endCell(); return; }
      if (!cell) return;
      if (name === "f" || name === "v") {
        if (target === name) cell[name] = buf;
        if (target === name || target === "x") target = null;
      } else if (name === "t") {
        if (target === "t") { cell.is += buf; target = null; }
      } else if (name === "rPh") { if (rph > 0) rph--; }
      else if (name === "is") { inIs = false; rph = 0; }
    },
  };
  return { handler, done: () => ({ hiddenRows, hiddenCols, hyperlinks, merges, usedRows, usedCols }) };
}

/* R47 (S-15): a sheet's shared-formula masters, kept on the reading, so a block read alone (cellsIn) still finds the master of a dependent in a block before it. */
function sharedFormulasOf(parts, part) {
  parts.shared ??= new Map();
  if (!parts.shared.has(part)) parts.shared.set(part, new Map());
  return parts.shared.get(part);
}

/* One sheet part walked, whole (its XML in hand) or in pieces (R35): `onRow`
 * gets every row as it is walked, and the answer is the walk's totals, or
 * `{ failed: why }` when the part could not be read to its end. A caller whose
 * answer is `failed` has been given rows of a part that is not the part, and
 * drops what it built from them. `ctl.exceeded` is a bound the walk went past (R44). With `access` the walk also leaves the
 * sheet's access points (R37). */
async function walkSheetPart(parts, sheet, onRow, { yieldNow = null, ctl = { stopped: false }, access = null } = {}) {
  const w = sheetHandler(onRow, { ctl, access, shared: sharedFormulasOf(parts, sheet.part) });
  if (sheet.xml != null) {
    const sc = new Scanner(w.handler);
    await scanWhole(sc, sheet.xml, yieldNow);
    if (sc.badRef && !ctl.exceeded) return { failed: { why: "char_ref_invalid", final: true } };
    const done = w.done();
    if (access) parts.access.set(sheet.part, await access.finish(sheet.xml.length));
    return { ...done, scanner: sc };
  }
  const r = await scanPart(parts.bytes, parts.container, sheet.part, w.handler,
    { mode: "pieces", cut: SHEET_CUT, yieldNow, onPiece: access ? (piece) => access.piece(piece) : null });
  if (!r.ok && !ctl.exceeded) return { failed: stripOk(r) };
  if (access && r.ok) parts.access.set(sheet.part, await access.finish());
  return { ...w.done(), scanner: r.scanner };
}

/** One cell's DISPLAYED value (the cached claim the published sheet shows).
 *  Returns { value } or { undetermined: why }; an empty cell is null value. A date by its number format shows as the
 *  ISO date (R30, G134c). */
function cellValue(c, sharedStrings, dates = null) {
  if (c.t === "s") {
    const i = c.v != null ? parseInt(c.v, 10) : NaN;
    if (sharedStrings && Number.isInteger(i) && i >= 0 && i < sharedStrings.length)
      return { value: sharedStrings[i] };
    return { undetermined: sharedStrings ? "shared_string_index_out_of_range" : "shared_strings_unreadable" };
  }
  if (c.t === "inlineStr") return { value: c.is ?? "" };
  if (c.t === "b") return { value: c.v === "1" ? "TRUE" : c.v === "0" ? "FALSE" : c.v };
  const iso = dateOf(c, dates);
  if (iso != null) return { value: iso };
  /* t="str" (formula string result), t="e" (an error like #DIV/0! — itself a
   * fact the sheet published), t="n" and untyped numerics: the raw <v>. */
  return { value: c.v };
}

/* R30 (C:A-3; K1448) — THE TYPED CELL. The type is what the file declares in `t` (ECMA-376 ST_CellType); a number whose
 * format, read from the file's styles, is a date or date-time format is a `date` (fix round 9, G134c: its `value` the
 * ISO date, `serial` the stored lexical value beside); nothing is recalculated: a formula's cached <v> is the
 * file's statement, held beside the formula as R10's item holds it. A token
 * outside the format's list is named, never mapped to a guess (R22). */
const CELL_TYPES = { n: "number", s: "text", str: "text", inlineStr: "text", b: "boolean", d: "date", e: "error" };

/** One walked cell -> `{ cell, undetermined? }`. `value` is the lexical value
 *  as stored (the <v>, an inline string's text, a resolved shared string),
 *  never re-rendered through a float; null when it cannot be resolved. */
function typedCell(c, sheetName, sharedStrings, dates = null) {
  let type = c.t == null ? "number" : (CELL_TYPES[c.t] ?? null);
  let value = c.t === "inlineStr" ? (c.is ?? c.v) : c.v;
  let why = type == null ? "cell_type_unknown" : null;
  if (c.t === "s") {
    const r = cellValue(c, sharedStrings);
    value = r.undetermined ? null : r.value;
    if (r.undetermined) why = r.undetermined;
  }
  const iso = dateOf(c, dates);
  const formula = c.f != null;
  const cell = { source: c.cell ? sheetCellRef(sheetName, c.cell) : null, value: value ?? null, type,
    declared: c.t ?? null, cached: formula ? c.v : null, formula: formula ? c.f : null };
  if (iso != null) { cell.value = iso; cell.type = "date"; cell.serial = c.v; }
  return { cell, why };
}

/** R30's order: row, then column. A cell with no readable `r` keeps the place
 *  of the cell before it (sorted stably), never a guessed address. */
function rowColumnOrder(entries) {
  let last = [0, 0];
  const keyed = entries.map((e, i) => {
    const corner = a1Corner(e.ref ?? "");
    if (corner) last = [corner.row, corner.col];
    return { e, k: last, i };
  });
  keyed.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i);
  return keyed.map((x) => x.e);
}

/* ------------------------------------------------------------------ *
 * structure(parts) -> the I2 shape (+ the IC-2 evidentiary envelope)
 * ------------------------------------------------------------------ */

async function xlsxStructure(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "xlsx", reason: parts ? parts.why : "PARTS_ABSENT" };
  }
  const { bytes, container, sheets, definedNames, guard } = parts;
  const links = [];
  const notes = [];
  const evItems = [];
  const evUndetermined = [...parts.undetermined, ...parts.partials];

  for (const sheet of sheets) {
    /* The rels half: this sheet's own .rels, where the TARGETS live (read
     * once, by parts()'s walk; an unreadable one is stated below). */
    const relTargets = new Map();
    if (sheet.rels) {
      for (const r of sheet.rels.relationships) if (r.id) relTargets.set(r.id, r);
    }

    /* The sheet walked: whole (its XML in hand) or in pieces (R35), the
     * formulas gathered as the rows come (DEC-5, below) and no row kept. A
     * sheet read in pieces that cannot be read to its end is stated, with the
     * reason, and its links fall back to the rels alone. */
    const formulas = [];
    let walked = null, failedWhy = null;
    if (sheet.xml != null || sheet.pieces) {
      walked = await walkSheetPart(parts, sheet, (row) => {
        for (const c of row.cells) {
          if (c.f == null) continue;
          formulas.push({
            kind: "formula",
            source: c.cell ? sheetCellRef(sheet.name, c.cell) : null,
            formula: c.f,
            value: c.v, // the cached result, null when the file carries none — stated, not invented
          });
        }
      }, { yieldNow: opts?.yieldNow });
      if (walked.failed) {
        failedWhy = walked.failed.why;
        evUndetermined.push({ part: sheet.part, ...walked.failed });
        walked = null;
      }
    }

    if (walked == null) {
      /* Over the bound, or an unreadable sheet: the rels still name every
       * EXTERNAL target this sheet carries, so the outbound graph survives —
       * but the cell join lives in the unread sheet XML, so each link's
       * element reference is honestly null and the reason is on the record. */
      const why = failedWhy ?? (guard == null ? (sheet.why ?? "sheet_unreadable") : "over_size_bound");
      for (const [, r] of relTargets) {
        if (!r.external) continue;
        const partition = classifyUrl(r.target);
        links.push({
          partition,
          wrapper: partition === "deferred" ? linkWrapper.deferred(r.target) : linkWrapper.refused(),
          target: { url: r.target },
          source: null,
          note: `cell_join_unavailable:${why}`,
        });
      }
      continue;
    }

    const usedRels = new Set();

    /* Hyperlinks: the sheet XML knows the CELL, the rels know the TARGET. */
    for (const h of walked.hyperlinks) {
      const source = h.cell ? sheetCellRef(sheet.name, h.cell) : null;
      if (h.relId) {
        const rel = relTargets.get(h.relId);
        if (!rel) {
          links.push({ partition: "undetermined", wrapper: null,
            target: { why: "hyperlink_rel_unresolved", relId: h.relId }, source });
          continue;
        }
        if (!rel.external) {
          links.push({ partition: "undetermined", wrapper: null,
            target: { why: "hyperlink_rel_not_external", relId: h.relId, part: rel.target }, source });
          continue;
        }
        usedRels.add(rel);
        const partition = classifyUrl(rel.target);
        links.push({
          partition,
          wrapper: partition === "deferred" ? linkWrapper.deferred(rel.target) : linkWrapper.refused(),
          target: { url: rel.target },
          source,
        });
        continue;
      }
      if (h.location) {
        /* A cross-sheet reference: internal, final at capture -> anchor. */
        const fragment = `#${h.location}`;
        links.push({ partition: "anchor", wrapper: linkWrapper.anchor(fragment),
          target: { location: h.location, fragment }, source });
        continue;
      }
      links.push({ partition: "undetermined", wrapper: null,
        target: { why: "hyperlink_without_target" }, source });
    }

    /* An external relationship no <hyperlink> of this sheet uses is still an
     * outbound reference the file carries: carried once, with no cell to name
     * (R7's "an unused rel"), never dropped. */
    for (const [, r] of relTargets) {
      if (!r.external || usedRels.has(r)) continue;
      const partition = classifyUrl(r.target);
      links.push({
        partition,
        wrapper: partition === "deferred" ? linkWrapper.deferred(r.target) : linkWrapper.refused(),
        target: { url: r.target },
        source: null,
      });
    }

    /* DEC-5: formulas BESIDE their cached values — two named fields on one
     * item, never collapsed. The value in the TEXT stream stays the cached
     * <v> (what the sheet displays); the derivation lives here, cell-keyed. */
    for (const f of formulas) evItems.push(f);

    /* DEC-5: hidden rows and columns, flagged per sheet. */
    if (walked.hiddenRows.length) {
      evItems.push({ kind: "hidden-rows", sheet: sheet.name,
        rows: walked.hiddenRows, count: walked.hiddenRows.length, source: null });
    }
    if (walked.hiddenCols.length) {
      evItems.push({ kind: "hidden-cols", sheet: sheet.name,
        cols: walked.hiddenCols, count: walked.hiddenCols.length, source: null });
    }
  }

  /* Every OTHER part's outbound relationships (a drawing's hyperlinks, an
   * external link's workbook path, the package's own): document-level facts
   * with no cell to name. The sheets' own rels were handled above. */
  const sheetRelsParts = new Set(sheets.filter((s) => s.part).map((s) => relsPartFor(s.part)));
  for (const r of parts.rels.outbound) {
    if (sheetRelsParts.has(r.part)) continue;
    const partition = classifyUrl(r.target);
    links.push({
      partition,
      wrapper: partition === "deferred" ? linkWrapper.deferred(r.target) : linkWrapper.refused(),
      target: { url: r.target },
      source: null,
    });
  }
  /* An unreadable .rels part means links MAY be missing: stated as a link,
   * never read as zero (R7, R22) — the docx/pptx form. */
  for (const u of parts.rels.undetermined) {
    links.push({ partition: "undetermined", wrapper: null,
      target: { why: "rels_unreadable", part: u.part, detail: u.why }, source: null });
    if (sheetRelsParts.has(u.part)) evUndetermined.push({ part: u.part, why: u.why });
  }

  /* DEC-5: a hidden SHEET is a first-class finding — from workbook.xml,
   * which is small and read even over the text bound. */
  for (const sheet of sheets) {
    if (sheet.hidden) {
      evItems.push({ kind: "hidden-sheet", sheet: sheet.name, state: sheet.state, source: null });
    }
  }
  if (guard) {
    notes.push("text_parts_over_bound");
    evUndetermined.push({ part: "(text parts: worksheets + sharedStrings)", why: "over_size_bound", guard });
  }
  if (parts.piecewise) notes.push("text_read_in_pieces");

  /* Defined names -> anchor (workbook-scoped: no single source cell, and a
   * null source is a statement, never a guess). */
  for (const dn of definedNames) {
    const fragment = `#${dn.ref}`;
    links.push({ partition: "anchor", wrapper: linkWrapper.anchor(fragment),
      target: { definedName: dn.name, ref: dn.ref, fragment }, source: null });
  }

  /* xl/embeddings/ -> intra, content-addressed exactly as a bundle companion. */
  /* R43: the identity is taken as the member streams, never from the member held whole. */
  const embedded = [];
  for (const entry of container.entries) {
    const name = normalizePartName(entry.name);
    if (/^xl\/embeddings\//.test(name)) embedded.push(name);
  }
  const identities = await memberIdentities(bytes, embedded);
  for (const name of embedded) {
    const read = identities.get(name);
    if (!read?.ok) {
      links.push({ partition: "undetermined", wrapper: null,
        target: { why: `embedding_unreadable:${read?.why ?? "unreadable"}`, name, ...(read?.limit != null ? { limit: read.limit } : {}) }, source: null });
      continue;
    }
    links.push({ partition: "intra", wrapper: linkWrapper.intra(read.sha256),
      target: { sha256: read.sha256, name, bytes: read.size }, source: null });
  }

  const counts = { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 };
  for (const l of links) counts[l.partition]++;

  /* docProps/core.xml as a `core-properties` ITEM — the same kind, with the
   * same fields, that docx.mjs emits (IC-2 as accepted): the provenance-
   * adjacent metadata is one vocabulary, not a per-format field. Absence is
   * normal OPC and emits nothing; unreadable is already in `undetermined`
   * from parts(). */
  if (parts.core) {
    evItems.push({
      kind: "core-properties",
      creator: parts.core.creator, lastModifiedBy: parts.core.lastModifiedBy,
      revision: parts.core.revision, revisionNumber: parts.core.revisionNumber,
      created: parts.core.created, modified: parts.core.modified, title: parts.core.title,
      source: null,
    });
  }

  const evCounts = {};
  for (const it of evItems) evCounts[it.kind] = (evCounts[it.kind] ?? 0) + 1;

  return {
    ok: true,
    container: "xlsx",
    sheets: sheets.map((s) => ({ sheet: s.index, name: s.name, sheetId: s.sheetId,
      state: s.state, hidden: s.hidden })),
    links,
    counts,
    /* The IC-2 envelope AS ACCEPTED (COFF-4 filed it first, from docx.mjs as
     * built; this entry CONFIRMS — same key, same fields, no variant). */
    evidentiary: {
      container: "xlsx",
      kinds: [...new Set(evItems.map((it) => it.kind))],
      items: evItems,
      undetermined: evUndetermined,
      counts: evCounts,
    },
    notes,
  };
}

/* ------------------------------------------------------------------ *
 * text(parts) -> the I2 text shape
 * ------------------------------------------------------------------ */

/* G41: the cap on a workbook's cells in the answer, in bytes of their JSON, from the caller's option (the number is
 * reading-pipeline's, K4646); null when the caller did not opt in (then every cell is listed, as it always was). */
function inlineCellsCap(opts) {
  const v = opts?.inlineCellsMax;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
const JSON_ENC = new TextEncoder();
/** The UTF-8 bytes of one cell's JSON. */
function cellJsonBytes(cell) {
  const j = JSON.stringify(cell);
  return /[^\x00-\x7f]/.test(j) ? JSON_ENC.encode(j).length : j.length;
}

/** Cell comments, as a scanner handler: one `<comment ref>` is one note, its `<t>` text (phonetic runs left out). */
function commentsReader() {
  const list = [];
  let cur = null, inT = false, rph = 0;
  const handler = {
    text(s) { if (inT && cur) cur.text += decodeXmlEntities(s); },
    cdata(s) { if (inT && cur) cur.text += s; },
    open(name, raw, self) {
      if (name === "comment") { cur = { ref: parseAttrs(raw).ref ?? null, text: "" }; list.push(cur); if (self) cur = null; rph = 0; }
      else if (cur && name === "rPh" && !self) rph++;
      else if (cur && name === "t" && !self && rph === 0) inT = true;
    },
    close(name) {
      if (name === "comment") { cur = null; inT = false; }
      else if (name === "rPh") { if (rph > 0) rph--; }
      else if (name === "t") inT = false;
    },
  };
  return { handler, list };
}
/* Parts that can hold text and that no unit reads: stated, never a reading that says it is whole (R38). */
const UNREAD_TEXT_PART_RE = /^xl\/(drawings\/drawing[^/]*|charts\/chart[^/]*|diagrams\/data[^/]*)\.xml$/;

async function xlsxText(parts, opts) {
  /* The shapes below are IC-2's pageless degenerate form AS ACCEPTED from
   * docx.mjs (paragraphs[] there, sheets[] here — the per-unit list named for
   * what the unit IS; `ok`/`container`/`document`/`undetermined`/`counts`
   * shared wherever the meaning transfers). */
  if (!parts || !parts.ok) {
    return { ok: false, container: "xlsx", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  const { sheets, sharedStrings, guard, piecewise, dates } = parts;
  const yieldNow = opts?.yieldNow;

  if (guard) {
    /* Over the streamed ceiling: the sizeGuard marker carried VERBATIM inside
     * `undetermined` (the docx.mjs pattern — ooxml.mjs shaped the marker for
     * exactly this), never a silent truncation. */
    return {
      ok: true, container: "xlsx", document: null, sheets: [],
      ...xlsxRangeUnits(parts),
      undetermined: [guard],
      counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: 0 },
    };
  }

  const outSheets = [];
  const allUndetermined = [...parts.partials, ...parts.undetermined.filter((u) => u.part === STYLES_PART)];
  let cellCount = 0, formulaCount = 0, scanned = 0;
  /* G41: with the caller's cap, the workbook's cells are listed while all of them together, as JSON, are within it;
     once they are not, every sheet's list is dropped and none is made (`held`). Over the whole-read bound none is
     made either (R35). Without the caller's cap nothing is held: every cell is listed, as always. */
  const cap = inlineCellsCap(opts);
  let held = false, listedBytes = 0;
  const walkedOut = [];
  const sink = textSink((parts.declared?.total ?? 0) / 4);
  const spans = [];
  /* R44: the typed cells a read holds at once are bounded by the table's retained-objects figure: a read that would
     hold more is refused, by name and with its figure. */
  const ctl = { stopped: false, exceeded: null };
  let retained = 0;

  /* A sheet that gave no text: the marker, and the sheet as a unit with no
   * text and no cells. */
  const unreadable = (sheet, why, extra = {}) => {
    const marker = { sheet: sheet.index, cell: null, reason: why, ...extra };
    /* COFF-11: the BOUND still stands — this is a sheet of an XLSX workbook
       whether or not its part could be read, so an impossible address is
       still impossible and is still refused. The USED range is NULL rather
       than 0, because nothing walked it: a zero here would say "this sheet
       holds nothing", which is the one thing an unread sheet cannot say. */
    outSheets.push({ sheet: sheet.index, name: sheet.name, hidden: sheet.hidden,
      rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS, usedRows: null, usedCols: null,
      range: null, text: "", cells: null, undetermined: [marker] });
    allUndetermined.push(marker);
  };

  for (const sheet of sheets) {
    if (sheet.xml == null && !sheet.pieces) { unreadable(sheet, sheet.why ?? "sheet_unreadable"); continue; }
    const undetermined = [];
    /* G178 (R46): the sheet's lines go into the workbook's `sink` as they are made, never held as one string per row
       beside a joined whole; if the sheet cannot be read to its end they are taken back. */
    const sinkAt = sink.mark();
    let from = -1;
    /* G15: the 1-based row of each line, beside `lines` (empty rows give no
       line, so the line index is not the row). A row with no readable `r`
       follows the row before it, as the format defines. */
    const lineRows = [];
    let lastRow = 0;
    /* R30's typed cells: a sheet read in pieces lists none (`cells` is null,
       as over the guard), because they are the one thing here that grows with
       the sheet in objects, not in text (R35); nor does a workbook whose cells
       are held (G41). */
    let typed = piecewise || held ? null : [];
    let sheetBytes = 2;
    let sheetCells = 0, sheetFormulas = 0;
    /* R37: a sheet over a block leaves its access points when the caller keeps its cells held (the point reads follow). */
    const declaredSize = parts.container.byName.get(sheet.part)?.uncompressedSize ?? 0;
    const access = cap != null && declaredSize > ACCESS_BLOCK_CHARS && !parts.access.has(sheet.part)
      ? (sheet.xml != null ? offsetAccess() : pieceAccess()) : null;
    const walked = await walkSheetPart(parts, sheet, (row) => {
      const vals = [];
      const rowNo = Number.isInteger(row.r) && row.r > 0 ? row.r : lastRow + 1;
      lastRow = rowNo;
      for (const c of row.cells) {
        if (c.f != null) sheetFormulas++;
        /* R30: every cell holding a value or a formula, typed as declared. A cell type outside the format's list is
           stated whether or not the cells are listed. */
        if (c.v != null || c.f != null || (c.t === "inlineStr" && c.is != null)) {
          if (c.t != null && CELL_TYPES[c.t] == null) undetermined.push({ sheet: sheet.index, cell: c.cell, reason: "cell_type_unknown" });
          if (typed) {
            const tc = typedCell(c, sheet.name, sharedStrings, dates);
            typed.push({ ref: c.cell, cell: tc.cell });
            if (++retained > OFFICE_RETAINED_MAX && !ctl.exceeded) {
              ctl.exceeded = { why: "TOO_MANY_OBJECTS", n: retained, bound: OFFICE_RETAINED_MAX, final: true };
              ctl.stopped = true;
            }
            if (cap != null) {
              sheetBytes += cellJsonBytes(tc.cell) + (typed.length > 1 ? 1 : 0);
              if (listedBytes + sheetBytes > cap) {
                held = true; typed = null; retained = 0;
                for (const o of walkedOut) o.cells = null;
              }
            }
          }
        }
        const r = cellValue(c, sharedStrings, dates);
        if (r.undetermined) {
          undetermined.push({ sheet: sheet.index, cell: c.cell, reason: r.undetermined });
          continue;
        }
        if (r.value == null || r.value === "") continue;
        sheetCells++;
        vals.push(r.value);
      }
      if (vals.length) {
        if (sink.chars > 0) sink.newline();
        if (from < 0) from = sink.chars;
        sink.add(vals.join("\t")); lineRows.push(rowNo);
      }
    }, { yieldNow, ctl, access });
    if (ctl.exceeded) {
      return {
        ok: true, container: "xlsx", document: null, sheets: [],
        ...xlsxRangeUnits(parts),
        undetermined: [{ part: sheet.part, ...ctl.exceeded }],
        counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: scanned },
      };
    }
    if (walked.failed) {
      sink.reset(sinkAt);
      const { why, ...rest } = walked.failed;
      unreadable(sheet, why, rest);
      continue;
    }
    scanned += walked.scanner?.scanned ?? 0;
    if (walked.scanner) allUndetermined.push(...scanNotes(sheet.part, walked.scanner));
    /* R48 / R22: a row or column a positional reading puts past the format's grid is stated, never read as if it were an address of the sheet */
    /* R49 (K4630; as csv-reader R22): a sheet wider than the format's columns is refused whole, with its count and the limit; exactly the limit is read */
    if (walked.usedCols > XLSX_GRID_COLS) {
      return {
        ok: true, container: "xlsx", document: null, sheets: [],
        ...xlsxRangeUnits(parts),
        undetermined: [{ part: sheet.part, why: "over_size_bound", size: walked.usedCols, bound: XLSX_GRID_COLS, boundName: "SHEET_COLUMNS_MAX", metric: "columns", final: true,
          statement: localize("office-readers.formats-xlsx.sheet_columns_over_bound", "This sheet is {size} columns wide; a sheet may have at most {bound}, so the workbook is not read.", { size: String(walked.usedCols), bound: String(XLSX_GRID_COLS) }) }],
        counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: scanned },
      };
    }
    if (walked.usedRows > XLSX_GRID_ROWS)
      undetermined.push({ sheet: sheet.index, cell: null, reason: "outside_grid", usedRows: walked.usedRows, usedCols: walked.usedCols });
    cellCount += sheetCells;
    formulaCount += sheetFormulas;
    if (typed) listedBytes += sheetBytes;
    /* COFF-11 / IC-100 — the sheet's own extent, in TWO figures that are two
       different facts: `rows`/`cols` is the BOUND (the grid this format makes
       addressable, which is what C-45.1's inner bound compares against), and
       `usedRows`/`usedCols` is how far this workbook's cells actually reach.
       See the decision block above `XLSX_GRID_ROWS`. */
    outSheets.push({ sheet: sheet.index, name: sheet.name, hidden: sheet.hidden,
      rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS,
      usedRows: walked.usedRows, usedCols: walked.usedCols,
      /* FW-19 / IC-124: the sheet as a `sheet-range` unit, or NULL. */
      range: usedSheetRange(sheet.name, walked.usedRows, walked.usedCols),
      text: "", lineRows, cells: typed ? rowColumnOrder(typed).map((x) => x.cell) : null,
      /* R47 (S-18): the merged ranges the sheet states, when it states any */
      ...(walked.merges.length ? { merges: walked.merges } : {}), undetermined });
    if (walked.merges.length && typed) undetermined.push(...coveredCells(walked.merges, typed, sheet.index));
    if (from >= 0) spans.push({ o: outSheets[outSheets.length - 1], from, to: sink.chars });
    walkedOut.push(outSheets[outSheets.length - 1]);
    for (const u of undetermined) allUndetermined.push(u);
  }
  /* G41: a caller that opted in is told, for every sheet it was given no cells of, that they are held. */
  if (cap != null) {
    for (const o of walkedOut) {
      if (held || piecewise) o.cells = null;
      if (o.cells === null) o.cells_held = true;
    }
  }

  /* R38: the notes on cells are units (`cell_note`); the parts that can hold other text are stated unread. */
  const cellNotes = [];
  for (const sheet of sheets) {
    for (const r of sheet.rels?.relationships ?? []) {
      if (r.external || !r.target || !/\/comments$/.test(String(r.type ?? ""))) continue;
      const part = resolveTarget(sheet.part, r.target);
      const reader = commentsReader();
      const got = await scanPart(parts.bytes, parts.container, part, reader.handler, { mode: "whole", yieldNow });
      if (!got.ok) { allUndetermined.push({ part, ...stripOk(got) }); continue; }
      scanned += got.scanner.scanned;
      allUndetermined.push(...scanNotes(part, got.scanner));
      if (got.partial) allUndetermined.push(got.partial);
      for (const n of reader.list) {
        if (n.text) cellNotes.push({ kind: "cell_note", ref: n.ref ? sheetCellRef(sheet.name, n.ref) : null, part, text: n.text });
      }
    }
  }
  for (const e of parts.container.entries) {
    const part = normalizePartName(e.name);
    if (UNREAD_TEXT_PART_RE.test(part)) allUndetermined.push({ part, why: "part_unread" });
  }

  /* G178 (R46): the document is the one whole copy of the text, made once from the sink; each sheet's `text` is the slice of
     it that is the sheet's own (a slice shares the document's characters), so the text is never held twice. */
  const document = sink.text();
  for (const { o, from, to } of spans) o.text = document.slice(from, to);
  return {
    ok: true,
    container: "xlsx",
    document,
    sheets: outSheets,
    parts: addressParts(cellNotes),
    /* R9 / D-415: the defined names and tables as `sheet-range` units,
       beside each sheet's whole-sheet `range`. */
    ...xlsxRangeUnits(parts),
    undetermined: allUndetermined,
    counts: { chars: document.length, cells: cellCount, formulas: formulaCount,
      undetermined: allUndetermined.length, scanned_bytes: scanned },
    /* R35: said when the text was read in pieces, the figures it was judged by. */
    ...(piecewise ? { piecewise } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * cellsIn(parts | bytes, range) -> the typed cells of a range, from the held bytes (G41)
 * ------------------------------------------------------------------ *
 *
 * `range` is `{ sheet, fromRow, toRow, fromCol, toCol, maxCells }`: `sheet` the
 * sheet's name (exact, else without case when exactly one answers) or its
 * 0-based position; rows and columns 1-based and inclusive, `fromRow` and
 * `fromCol` 1 and `toRow` and `toCol` the end of the sheet when absent. The
 * answer is `{ ok:true, sheet, cells, rows:{from, to}, next_row, undetermined, served }`:
 * the cells text() would have listed for those rows and columns (the same
 * `typedCell`, shared strings from the one list, hidden rows and columns not
 * left out), in row then column order. A call answers at most `maxCells`
 * (default CELLS_IN_MAX) cells and whole rows only: the row that would pass it
 * is left to the next call, `next_row` its number, and `rows.to` the last row
 * answered; the first row is answered whole even if alone it is over. `next_row`
 * is absent when the range was answered whole.
 *
 * (Fix round 9, G131e; S-20) A sheet over a block (1 MiB of text) is read through its ACCESS POINTS: the read that
 * walked it (text() with the caller's cap, else the first point read on this reading) left, for each block of whole rows,
 * where it is and the rows it holds, so a call parses only the blocks that hold the rows asked for and stops when the
 * answer is full, and never inflates or checks the sheet again. `served` is what the call parsed, `{bytes, blocks}`:
 * bounded by the rows asked for and a block, not by the sheet's size or the row's offset. A sheet that cannot be read to
 * its end gives `{ ok:false, reason }`. A cell with no readable column is in every column range. Never throws.
 */
export const CELLS_IN_MAX = 20000;

function cellsInArguments(range) {
  if (range == null || typeof range !== "object") return { reason: "invalid_argument", argument: "range" };
  const { sheet, fromRow = 1, toRow = null, fromCol = 1, toCol = null, maxCells = CELLS_IN_MAX } = range;
  if (!((typeof sheet === "string" && sheet !== "") || (Number.isInteger(sheet) && sheet >= 0))) return { reason: "invalid_argument", argument: "sheet" };
  const pos = (v) => Number.isInteger(v) && v >= 1;
  if (!pos(fromRow)) return { reason: "invalid_argument", argument: "fromRow" };
  if (toRow !== null && !(pos(toRow) && toRow >= fromRow)) return { reason: "invalid_argument", argument: "toRow" };
  if (!pos(fromCol)) return { reason: "invalid_argument", argument: "fromCol" };
  if (toCol !== null && !(pos(toCol) && toCol >= fromCol)) return { reason: "invalid_argument", argument: "toCol" };
  if (!pos(maxCells)) return { reason: "invalid_argument", argument: "maxCells" };
  return { sheet, fromRow, toRow: Math.min(toRow ?? XLSX_GRID_ROWS, XLSX_GRID_ROWS), toRowGiven: toRow !== null, fromCol, toCol: toCol ?? XLSX_GRID_COLS, maxCells };
}

async function xlsxCellsIn(parts, a) {
  if (!parts || !parts.ok) return { ok: false, reason: parts?.why ?? "PARTS_ABSENT" };
  const { sheets, sharedStrings, guard, dates } = parts;
  parts.access ??= new Map();
  if (guard) return { ok: false, reason: guard.why, size: guard.size, bound: guard.bound, boundName: guard.boundName, final: true };
  let sheet = null;
  if (typeof a.sheet === "number") sheet = sheets[a.sheet] ?? null;
  else {
    sheet = sheets.find((s) => s.name === a.sheet) ?? null;
    if (!sheet) {
      const ci = sheets.filter((s) => s.name.toLowerCase() === a.sheet.toLowerCase());
      if (ci.length === 1) sheet = ci[0];
    }
  }
  if (!sheet) return { ok: false, reason: "no_such_sheet" };
  if (sheet.xml == null && !sheet.pieces) return { ok: false, reason: sheet.why ?? "sheet_unreadable" };

  const out = [], undetermined = [];
  const ctl = { stopped: false };
  let lastRow = 0, maxRow = 0, nextRow = null;
  const served = { bytes: 0, blocks: 0 };
  const takeRow = (row) => {
    const rowNo = Number.isInteger(row.r) && row.r > 0 ? row.r : lastRow + 1;
    lastRow = rowNo;
    if (rowNo > maxRow) maxRow = rowNo;
    if (rowNo < a.fromRow || rowNo > a.toRow) return;
    const cells = [];
    for (const w of row.cells) {
      if (!(w.v != null || w.f != null || (w.t === "inlineStr" && w.is != null))) continue;
      const col = a1Col(w.cell);
      if (col != null && (col < a.fromCol || col > a.toCol)) continue;
      const tc = typedCell(w, sheet.name, sharedStrings, dates);
      if (tc.why) undetermined.push({ sheet: sheet.index, cell: w.cell, reason: tc.why });
      cells.push({ ref: w.cell, cell: tc.cell });
    }
    if (out.length > 0 && out.length + cells.length > a.maxCells) { nextRow = rowNo; ctl.stopped = true; return; }
    for (const c of cells) out.push(c);
  };
  const parse = (xml) => {
    const w = sheetHandler(takeRow, { rowsOnly: true, ctl, shared: sharedFormulasOf(parts, sheet.part), startRow: lastRow });
    const sc = new Scanner(w.handler);
    scanSync(sc, xml);
    served.bytes += xml.length;
    served.blocks++;
    return sc.badRef;
  };

  let allMax = null;
  const small = sheet.xml != null && sheet.xml.length <= ACCESS_BLOCK_CHARS;
  if (small) {
    if (parse(sheet.xml)) return { ok: false, reason: "char_ref_invalid", final: true };
  } else {
    let access = parts.access.get(sheet.part);
    if (!access) {
      /* The first point read on a reading the read did not leave access points for: one pass leaves them. */
      if (sheet.xml != null) {
        const acc = offsetAccess();
        const w = sheetHandler(() => {}, { rowsOnly: true, access: acc, shared: sharedFormulasOf(parts, sheet.part) });
        const sc = new Scanner(w.handler);
        scanSync(sc, sheet.xml);
        if (sc.badRef) return { ok: false, reason: "char_ref_invalid", final: true };
        access = await acc.finish(sheet.xml.length);
      } else {
        const walked = await walkSheetPart(parts, sheet, () => {}, { access: pieceAccess() });
        if (walked.failed) { const { why, ...rest } = walked.failed; return { ok: false, reason: why, ...rest }; }
        access = parts.access.get(sheet.part);
      }
      parts.access.set(sheet.part, access);
    }
    allMax = access.blocks.reduce((m, b) => Math.max(m, b.max), 0);
    for (const blk of access.blocks) {
      if (ctl.stopped) break;
      if (blk.max < a.fromRow || blk.min > a.toRow) continue;
      let xml;
      if (access.kind === "offsets") xml = sheet.xml.slice(blk.start, blk.end);
      else { try { xml = await inflateText(blk.data); } catch { return { ok: false, reason: "sheet_unreadable" }; } }
      lastRow = blk.before;
      if (parse(xml)) return { ok: false, reason: "char_ref_invalid", final: true };
    }
  }
  const cells = rowColumnOrder(out).map((x) => x.cell);
  const to = nextRow != null ? nextRow - 1 : (a.toRowGiven ? a.toRow : Math.max(a.fromRow, allMax ?? maxRow));
  return { ok: true, sheet: sheet.name, cells, rows: { from: a.fromRow, to }, ...(nextRow != null ? { next_row: nextRow } : {}), undetermined, served };
}

/* ------------------------------------------------------------------ *
 * The I7 entry (registered by formats.mjs — one registerFormat call there,
 * nothing anywhere else; that is the D-70 property this axis exists to keep)
 * ------------------------------------------------------------------ */

export const xlsxEntry = {
  format: "xlsx",
  detect(bytes, contentType) {
    if (bytes) {
      if (!hasZipMagic(bytes)) return null;
      /* readContainer is synchronous (a directory walk, no inflation), so a
       * FULL container can answer here. A prefix — the acquire-time 1 KiB
       * seam — has no reachable central directory, and a bare PK sniff must
       * NOT claim xlsx: null, honestly, and the content-type pass may speak. */
      const c = readContainer(bytes);
      if (!c.ok) return null;
      if (c.byName.has(CONTENT_TYPES_PART) && c.byName.has(WORKBOOK_PART)) {
        return { format: "xlsx", confidence: "likely", signals: [
          "magic: PK\\x03\\x04 with a readable central directory",
          localize("office-readers.formats-xlsx.parts_content_types_part_and", "parts: {CONTENT_TYPES_PART} and {WORKBOOK_PART} present", { CONTENT_TYPES_PART: String(CONTENT_TYPES_PART), WORKBOOK_PART: String(WORKBOOK_PART) }),
          "likely, not certain: the declared main content type lives in a deflated part; parts() completes the discrimination",
        ] };
      }
      return null;
    }
    return detectByContentType("xlsx", XLSX_CONTENT_TYPE, XLSX_TWIN_CONTENT_TYPES, contentType);
  },
  parts: (bytes) => xlsxParts(bytes),
  /* Accept either parts() output or raw bytes, exactly as docx.mjs does, so
     detect→structure works uniformly at the registry seam while a caller that
     already paid for parts() does not pay twice. */
  structure: async (partsOrBytes, opts) => {
    const parts = isBytes(partsOrBytes)
      ? await xlsxParts(partsOrBytes)
      : partsOrBytes;
    return withActive(await xlsxStructure(parts, opts), parts);
  },
  /* `opts.inlineCellsMax` (G41): see HELD CELLS above; `opts.yieldNow` (R42). */
  text: async (partsOrBytes, opts) => {
    const parts = isBytes(partsOrBytes)
      ? await xlsxParts(partsOrBytes)
      : partsOrBytes;
    /* FW-19 / IC-124: `images` under xl/media/, exhaustive or NULL. */
    return withContainerImages(withActive(withMetadata(await xlsxText(parts, opts), parts), parts), parts, "xl/media/");
  },
  /* G41: the typed cells of a range of one sheet, made from the held bytes (an optional slot, as `dialect` is). */
  cellsIn: async (partsOrBytes, range) => {
    const args = cellsInArguments(range);
    if (args.reason) return { ok: false, reason: args.reason, ...(args.argument ? { argument: args.argument } : {}) };
    try {
      const parts = isBytes(partsOrBytes) ? await xlsxParts(partsOrBytes) : partsOrBytes;
      return await xlsxCellsIn(parts, args);
    } catch {
      return { ok: false, reason: "cells_in_failed" };
    }
  },
};
