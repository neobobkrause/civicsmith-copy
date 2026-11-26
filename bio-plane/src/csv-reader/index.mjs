/* The CSV registry entry (QUEUE FW-23) — the ninth format on COFF-1's axis,
 * and the first one on it that is NOT a container.
 *
 * DESIGNED BY BOB #32, 2026-09-24 (`docs/development/OFFICE-FORMATS.md`, "CSV
 * — DESIGNED 2026-09-24"): the delimiter and the encoding are found BY
 * SIGNATURE and RECORDED ON THE READING; when either cannot be determined the
 * reading SAYS SO and nothing is guessed. The file is ONE sheet. Row 1 is row
 * 1 whether or not it looks like a header, because a header is a READING and
 * is never assumed. Cells are addressed with the existing `sheet-cell` /
 * `sheet-range` extent kinds (IC-1, IC-124), 1-based row and column. The
 * reading carries the CAPTURE's grade, because the bytes are the publisher's
 * — so this entry emits no grade of its own anywhere, and `formats-csv.test`
 * asserts that absence rather than leaving it to be noticed.
 *
 * WRITTEN FROM A MEASURED PAGE, NOT FROM THE SPEC. Every decision below was
 * taken against the 166 `.csv` keys of `s3://cao-94612` — all 166 fetched
 * whole, 90,402,768 bytes, 2026-09-24 (M-144). Where the corpus could not
 * answer a question that is SAID, and the question is answered somewhere the
 * corpus is not.
 *
 * ------------------------------------------------------------------------
 * 1. DETECTION: FROM THE DECLARED CONTENT TYPE, AND NEVER FROM THE BYTES.
 * ------------------------------------------------------------------------
 * A CSV has no magic bytes. It has a SHAPE — lines that partition into the
 * same number of fields — and the whole finding of this item is that PROSE
 * WEARS THAT SHAPE. Measured both ways, because one direction alone would
 * have been the wrong reading:
 *
 *   - over 198 NON-CSV bodies drawn from the same bucket (8 per extension
 *     over 34 extensions, seed 20260924), the candidate byte signature fired
 *     0 times. That looks like a licence to sniff, and it is NOT one: this
 *     corpus holds ONE `.txt` in 43,283 keys and its text-bearing half is
 *     27,764 PDFs. THE CORPUS CANNOT ANSWER THIS QUESTION — what a signature
 *     would false-positive on is exactly what is missing from it.
 *   - so the question was put to the shapes the corpus lacks, planted: a
 *     hard-wrapped prose paragraph with one comma a line, a minutes list
 *     ("Present: Bas, Fife"), a Markdown table, an apache log, an ini file.
 *     At a two-line minimum, 5 of 8 non-CSV shapes FIRED. At three lines,
 *     prose and the minutes list still fire. Raising the minimum only trades
 *     a false claim for a missed one, because there is nothing to find: three
 *     lines of prose each holding one comma and a three-row two-column CSV
 *     ARE THE SAME BYTES.
 *
 * So `detect(bytes, ...)` returns NULL — always, for any bytes. This is the
 * xlsx entry's own move at its prefix seam ("a bare PK sniff must NOT claim
 * xlsx"), arrived at from the other side: there the bytes are out of reach,
 * here they are in hand and DO NOT SAY. A format claimed from a shape prose
 * can wear is the record claiming more than it can support, which this
 * project holds to be worse than a missing feature.
 *
 * `detect(null, contentType)` answers `likely` for the types that name a CSV
 * or TSV outright — the ceiling the registry's two-pass doctrine fixes for a
 * declared type. A file declared `text/plain`, `application/vnd.ms-excel` or
 * `application/octet-stream` is judged by `isDelimitedText(name, type, head)`
 * (R21), which weighs the name, the type and the head TOGETHER (G130b): the
 * declared type alone names too little of what is on the wire (S-10).
 *
 * ------------------------------------------------------------------------
 * 2. THE ENCODING — decided per window, the file's by majority (G131a, G131c).
 * ------------------------------------------------------------------------
 * A body is read in byte windows (header §4). Each window is classified from
 * its own bytes: no byte >= 0x80 is `us-ascii` (every ASCII-grid encoding reads
 * it identically); valid UTF-8 beyond ASCII (a character the window's edge cuts
 * is carried, not invalid) is `utf-8`; bytes that are not UTF-8 are the legacy
 * charset (`windows-1252`, or the one the caller declared); and bytes no legacy
 * charset names (a NUL, a byte windows-1252 leaves undefined) are undetermined.
 * A BOM decides the file at `certain`. A body with no BOM whose even or odd
 * bytes are NULs is UTF-16 (`likely`, assumed). The FILE's encoding is the
 * majority of its non-ASCII windows; an all-ASCII file is `us-ascii` at
 * `likely` only, because a later window may differ. A window whose decision
 * differs from the file's is listed in `disagree` and READ under its own.
 *
 * The record walk runs over a BIJECTIVE BYTE TRANSPORT (each byte one code
 * unit U+0000-U+00FF; NOT `TextDecoder("latin1")`, which is windows-1252 and
 * maps 0x80-0x9F elsewhere), so the grid (delimiters, quotes, line breaks are
 * ASCII) is found whatever the high bytes mean, and each field holding a high
 * byte is decoded on its own under its window's encoding: a field the encoding
 * cannot read is `undetermined` with a null value — never mojibake. UTF-16 is
 * decoded as a stream, whole-file.
 *
 * ------------------------------------------------------------------------
 * 3. THE DELIMITER — the majority of the window's records (G131c).
 * ------------------------------------------------------------------------
 * A candidate (comma, semicolon, tab, pipe) is the delimiter of a window when
 * it occurs the same non-zero number of times, outside quotes, on a MAJORITY
 * of the window's first 1,000 complete records. Records, not lines: a quote
 * opens only at the start of a field, a quoted line break stays inside its
 * record, CR, LF and CRLF all end one. A ragged row, a title block, a quoted
 * newline or CR-only endings therefore do not fail it. Exactly one candidate
 * -> determined; two or more -> tied; none -> none consistent; under two
 * complete records -> too few. The file's delimiter is the most common
 * determined window decision; a window that decided otherwise is read under its
 * own, one that decided nothing under the last decided before it.
 *
 * THE CANDIDATE SET IS A LIST AND THAT IS ITS LIMIT, SAID PLAINLY. A file
 * delimited by anything else reads as one column with the delimiter recorded
 * `undetermined`.
 *
 * ------------------------------------------------------------------------
 * 4. THE GRID, THE BOUNDS, AND WHAT THIS FORMAT CANNOT CARRY.
 * ------------------------------------------------------------------------
 * ONE sheet, named by a CONSTANT (`CSV_SHEET_NAME`) because the file carries
 * no name at all. `rows`/`cols` — the C-45.1 BOUND — are NULL, for `.ods`'s
 * reason exactly: RFC 4180 fixes no maximum. `usedRows`/`usedCols` are measured
 * and emitted beside them. NO LINKS, NO EMBEDDINGS, NO EVIDENTIARY EXTRAS, NO
 * IMAGES — every one of those zeroes is a fact about the FORMAT, not a walk
 * that found nothing, and the notes say which kind of zero it is.
 *
 * THE BOUNDS are runtime-limits' `READ_BOUNDS` rows, taken through `boundOf`
 * with no literal here: the body's bytes (50 MB, the standard's figure for a
 * light kind, K4834), its records (1,048,576) and a record's columns (16,384);
 * a body over any is refused whole, stated with its size and the limit. A body
 * within them is read in 1 MiB byte WINDOWS with a carry of the unfinished
 * field, record, quote, multi-byte character or CRLF, holding about its text
 * and no record list; the pass that counted its records left an access point
 * (a byte, a row) at each window, from which `cellsIn` reads a range without
 * walking from byte 0 (G131e). A cell over 32,767 characters is kept to 1 MiB
 * and stated; a quote left open at the end of the file is stated with the row
 * it opened on and the bytes it covers (G131b).
 *
 * This module asserts nothing about MEANING (FRAMEWORK's, through I2) and
 * WRITES nothing.
 */

import { word, localize } from "../setup-words/index.mjs";
import { boundOf } from "../read-bounds.mjs";

/* ------------------------------------------------------------------ *
 * The kinds this module takes and hands back (S4)
 * ------------------------------------------------------------------ */

/** @typedef {{kind: "sheet-cell", ref: string, sheet: string, cell: string}} SheetCellRef IC-1's sheet-cell reference (R10) */
/** @typedef {{kind: "sheet-range", ref: string, sheet: string, range: string}} SheetRangeRef IC-124's sheet-range reference (R11) */
/** @typedef {ArrayBuffer | ArrayBufferView} BytesView bytes as a buffer or any typed-array view */
/** @typedef {BytesView | ArrayLike<number> | null | undefined} BytesInput bytes, or an array of byte values; anything else reads as no bytes */
/** @typedef {"comma" | "semicolon" | "tab" | "pipe"} DelimiterName the candidate delimiters' names (R7) */
/** @typedef {"delimiter_undetermined_too_few_lines" | "delimiter_undetermined_tied" | "delimiter_undetermined_none_consistent"} DelimiterUndetermined why no delimiter was decided (R7) */
/**
 * One window's (or a text's) delimiter decision (R7).
 * @typedef {Object} DelimiterDecision
 * @property {string | null} delimiter the delimiter character, or null when none was decided
 * @property {DelimiterName | null} name
 * @property {"certain" | "none"} confidence
 * @property {number} lines the complete records examined
 * @property {number} [modalLines] the records on which the decided delimiter's most common count holds
 * @property {string[]} signals
 * @property {DelimiterUndetermined | null} undetermined
 * @property {DelimiterName[]} tied the candidates still equal, when tied
 */
/**
 * The file's delimiter decision (R7): the chosen window's decision, `lines` summed over every window, `records` the chosen
 * window's own count of complete records.
 * @typedef {Object} FileDelimiter
 * @property {string | null} delimiter
 * @property {DelimiterName | null} name
 * @property {"certain" | "none"} confidence
 * @property {number} lines
 * @property {number} [modalLines]
 * @property {string[]} signals
 * @property {DelimiterUndetermined | null} undetermined
 * @property {DelimiterName[]} tied
 * @property {number} records
 */
/**
 * The file's encoding decision (R7).
 * @typedef {Object} EncodingDecision
 * @property {string | null} encoding
 * @property {"certain" | "likely" | "none"} confidence
 * @property {number} bomBytes
 * @property {boolean} assumed true when no BOM or declaration decided it
 * @property {string[]} signals
 * @property {"encoding_undetermined" | null} undetermined
 */
/**
 * The dialect as the entry states it (R7): `structure()`'s and `text()`'s `dialect`, and the `dialect` slot's answer.
 * @typedef {Object} Dialect
 * @property {string | null} encoding
 * @property {"certain" | "likely" | "none"} encodingConfidence
 * @property {string[]} encodingSignals
 * @property {DelimiterName | null} delimiter
 * @property {"certain" | "none"} delimiterConfidence
 * @property {string[]} delimiterSignals
 * @property {boolean} assumed
 * @property {number[]} disagree the byte offsets of the windows whose decision differs from the file's
 * @property {string[]} undetermined
 */
/** @typedef {{encoding: string, bomBytes: number, signal: string}} Bom a byte-order mark read */
/**
 * One window's bytes, scanned once (header §2).
 * @typedef {Object} ByteScan
 * @property {boolean} high a byte >= 0x80 is among them
 * @property {number} valid complete multi-byte UTF-8 sequences
 * @property {number} bad bytes that are not valid UTF-8
 * @property {number} nul NUL bytes
 * @property {number} undef bytes windows-1252 leaves undefined
 */
/**
 * One read window and its decisions (header §2, §3): `at`/`end` its byte span, `enc` its own encoding decision, `delim`
 * its own delimiter decision, `used` the delimiter it is read under, `readEnc` the encoding it is read under.
 * @typedef {Object} CsvWindow
 * @property {number} at
 * @property {number} end
 * @property {boolean} high
 * @property {string | null} enc
 * @property {string | null} delim
 * @property {DelimiterDecision} dec
 * @property {string | null} used
 * @property {string | null} readEnc
 * @property {ByteScan} [scan] absent for a UTF-16 body
 */
/** @typedef {{col: number, chars: number}} OpenQuote a quote still open at the end of the text: its column and the characters it covers */
/**
 * What the record walk says of each record it completes (`createRecordWalk`).
 * @typedef {Object} RecordInfo
 * @property {number} end the characters consumed up to and including the record's terminator
 * @property {boolean} skipLF a CR ended the record at the end of a piece: a LF that follows is its own
 * @property {number} cols the record's field count
 * @property {Array<[number, number]> | null} over the `[column, length]` of each field longer than the cell bound
 * @property {OpenQuote | null} open
 * @property {number} wide the most fields under any one candidate delimiter while none is decided, else 0
 */
/** @typedef {(record: string[], info: RecordInfo) => void} RecordSink called with each record the walk completes */
/** @typedef {{maxColumns?: number}} WalkLimits `maxColumns` stops a record keeping fields past it */
/**
 * The record walk fed in pieces (`createRecordWalk`).
 * @typedef {Object} RecordWalk
 * @property {(d: string | null | undefined) => void} setDelimiter
 * @property {() => void} resumeAfterCR
 * @property {(text: string) => void} feed
 * @property {() => void} end
 */
/** @typedef {{at: number, row: number, skipLF: boolean}} AccessPoint a byte a walk may resume at, and the row it follows */
/**
 * The marker a body over a bound is refused with (R6, R22).
 * @typedef {Object} BoundMarker
 * @property {false} ok
 * @property {"undetermined"} text
 * @property {"over_size_bound"} why
 * @property {number} size
 * @property {number} bound
 * @property {string} boundName
 * @property {"body_bytes" | "rows" | "columns"} metric
 * @property {true} final
 */
/**
 * The marker a UTF-16 body over a bound is refused with (R6, R22): `BoundMarker`'s members and the encoding.
 * @typedef {Object} Utf16BoundMarker
 * @property {false} ok
 * @property {"undetermined"} text
 * @property {"over_size_bound"} why
 * @property {number} size
 * @property {number} bound
 * @property {string} boundName
 * @property {"body_bytes" | "rows" | "columns"} metric
 * @property {true} final
 * @property {string} encoding
 */
/** @typedef {BoundMarker | Utf16BoundMarker} SizeMarker */
/**
 * The optional second argument of `parts`, `structure` and `dialect` (R3, R20).
 * @typedef {Object} ReadOptions
 * @property {number | undefined} [windowBytes] an integer of at least 16: a scaled read window
 * @property {string | undefined} [declared] a legacy charset the source declared
 * @property {(() => unknown) | undefined} [yieldNow] awaited between windows
 */
/**
 * `text()`'s optional second argument (R3, R17, R20).
 * @typedef {Object} TextOptions
 * @property {number | undefined} [windowBytes]
 * @property {string | undefined} [declared]
 * @property {(() => unknown) | undefined} [yieldNow]
 * @property {number | undefined} [inlineCellsMax] bytes of cells' JSON a sheet lists before it holds them
 */
/**
 * `parts()` refused: an empty body, or a BOM whose encoding the runtime cannot decode.
 * @typedef {Object} PartsRefusal
 * @property {false} ok
 * @property {string} why
 * @property {{encoding: string}} [encoding]
 */
/**
 * `parts()`'s answer for a body it read: what `structure()`, `text()` and `cellsIn()` project.
 * @typedef {Object} CsvParts
 * @property {true} ok
 * @property {"csv"} format
 * @property {Uint8Array} bytes
 * @property {number} bomBytes
 * @property {number} bodyBytes
 * @property {EncodingDecision} encoding
 * @property {FileDelimiter} delimiter
 * @property {number[]} disagree
 * @property {SizeMarker | null} guard the marker when the body is over a bound
 * @property {string[][] | null} records the records of a body that fits one window's first 64 KiB, else null
 * @property {Map<number, RecordInfo> | null} recInfo the walk's information on the kept records that have any to give
 * @property {number[] | null} recWindow the window each kept record ended in
 * @property {boolean} transport
 * @property {boolean} invalidUtf16
 * @property {boolean} windowed
 * @property {string | null} utf16
 * @property {number} W the window's bytes
 * @property {CsvWindow[]} windows
 * @property {AccessPoint[]} accessPoints
 * @property {number} rows
 */
/** @typedef {CsvParts | PartsRefusal} PartsResult `parts()`'s answer */
/** @typedef {PartsResult | BytesView | null | undefined} PartsOrBytes what `structure`, `text` and `cellsIn` accept */
/** @typedef {{format: "csv", confidence: "likely", signals: string[]}} Detection `detect()`'s claim from a declared type (R2) */
/** @typedef {{sheet: number, name: string, sheetId: null, state: "visible", hidden: boolean}} StructureSheet */
/** @typedef {{anchor: number, intra: number, deferred: number, refused: number, undetermined: number}} LinkCounts */
/** @typedef {{part: string, why: "over_size_bound", guard: SizeMarker}} GuardEntry */
/**
 * The IC-2 evidentiary envelope (R4): always empty of kinds and items.
 * @typedef {Object} Evidentiary
 * @property {"csv"} container
 * @property {never[]} kinds
 * @property {never[]} items
 * @property {GuardEntry[]} undetermined
 * @property {{[kind: string]: number}} counts
 */
/**
 * `structure()`'s answer for a body read (R4).
 * @typedef {Object} StructureDone
 * @property {true} ok
 * @property {"csv"} container
 * @property {StructureSheet[]} sheets
 * @property {never[]} links
 * @property {LinkCounts} counts
 * @property {Evidentiary} evidentiary
 * @property {Dialect} dialect
 * @property {never[]} active
 * @property {string[]} notes
 */
/** @typedef {{ok: false, container: "csv", reason: string}} ReadRefusal `structure()`'s or `text()`'s answer when `parts` failed */
/** @typedef {StructureDone | ReadRefusal} StructureResult */
/**
 * One typed cell (R8).
 * @typedef {Object} TypedCell
 * @property {SheetCellRef} source
 * @property {string | null} value null for a field the encoding could not read
 * @property {"text"} type
 * @property {null} declared
 * @property {null} cached
 * @property {null} formula
 */
/** @typedef {"encoding_undetermined" | "not_us_ascii" | "invalid_utf8" | "invalid_utf16"} UnreadReason why a field has no text (R5) */
/** @typedef {{sheet: 0, cell: string, reason: UnreadReason}} UnreadEntry a cell the encoding could not read (R5) */
/** @typedef {{sheet: 0, cell: string, reason: "unterminated_quote", row: number, bytes: number}} OpenQuoteEntry a quote left open: the row it opened on, the bytes it covers (R23) */
/** @typedef {{sheet: 0, cell: string, reason: "over_cell_bound", length: number}} OverBoundEntry a cell over the cell bound, and its length (R22) */
/** @typedef {UnreadEntry | OpenQuoteEntry | OverBoundEntry} UndeterminedCell an unreadable or over-long cell, named by its own reference */
/**
 * The one sheet of `text()` whose cells are listed (R5, R8, R16).
 * @typedef {Object} ListedSheet
 * @property {number} sheet
 * @property {string} name
 * @property {boolean} hidden
 * @property {null} rows
 * @property {null} cols
 * @property {number} usedRows
 * @property {number} usedCols
 * @property {SheetRangeRef | null} range
 * @property {string} text
 * @property {number[]} lineRows
 * @property {TypedCell[] | null} cells
 * @property {UndeterminedCell[]} undetermined
 */
/**
 * The one sheet of `text()` past `inlineCellsMax` (R17): `cells` is null and `cells_held` true.
 * @typedef {Object} HeldSheet
 * @property {number} sheet
 * @property {string} name
 * @property {boolean} hidden
 * @property {null} rows
 * @property {null} cols
 * @property {number} usedRows
 * @property {number} usedCols
 * @property {SheetRangeRef | null} range
 * @property {string} text
 * @property {number[]} lineRows
 * @property {TypedCell[] | null} cells
 * @property {true} cells_held
 * @property {UndeterminedCell[]} undetermined
 */
/** @typedef {ListedSheet | HeldSheet} TextSheet */
/** @typedef {{chars: number, cells: number, formulas: number, undetermined: number, replaced: number}} TextCounts `text()`'s counts for a body read */
/** @typedef {{chars: number, cells: number, formulas: number, undetermined: number}} BoundCounts `text()`'s counts for a body over a bound */
/**
 * `text()`'s answer for a body read (R5, R8).
 * @typedef {Object} TextDone
 * @property {true} ok
 * @property {"csv"} container
 * @property {never[]} images
 * @property {null} metadata
 * @property {never[]} active
 * @property {Dialect} dialect
 * @property {string} document
 * @property {TextSheet[]} sheets
 * @property {UndeterminedCell[]} undetermined
 * @property {TextCounts} counts
 */
/**
 * `text()`'s answer for a body over a bound (R6): no sheet, the marker carried.
 * @typedef {Object} TextOverBound
 * @property {true} ok
 * @property {"csv"} container
 * @property {never[]} images
 * @property {null} metadata
 * @property {never[]} active
 * @property {Dialect} dialect
 * @property {null} document
 * @property {never[]} sheets
 * @property {SizeMarker[]} undetermined
 * @property {BoundCounts} counts
 */
/** @typedef {TextDone | TextOverBound | ReadRefusal} TextResult */
/**
 * `cellsIn`'s query (R18), with `parts`'s options for a call on bytes.
 * @typedef {Object} CellsQuery
 * @property {number | string | null | undefined} [sheet] absent, 0 or "csv"
 * @property {number | undefined} [fromRow]
 * @property {number | undefined} [toRow]
 * @property {number | undefined} [fromCol]
 * @property {number | undefined} [toCol]
 * @property {number | undefined} [maxCells]
 * @property {number | undefined} [windowBytes]
 * @property {string | undefined} [declared]
 * @property {(() => unknown) | undefined} [yieldNow] awaited between windows of a call on bytes
 */
/**
 * `cellsIn`'s answer for a range read (R18).
 * @typedef {Object} CellsDone
 * @property {true} ok
 * @property {TypedCell[]} cells
 * @property {{from: number, to: number}} rows
 * @property {number} [next_row]
 */
/** @typedef {{ok: false, why: string}} CellsRefusal */
/** @typedef {CellsDone | CellsRefusal | SizeMarker} CellsResult */
/**
 * The I7 registry entry (R1 to R5, R7, R18).
 * @typedef {Object} CsvEntry
 * @property {"csv"} format
 * @property {(bytes: BytesInput, contentType: string | null | undefined) => Detection | null} detect
 * @property {(bytes: BytesInput, opts?: ReadOptions) => Promise<PartsResult>} parts
 * @property {(bytes: BytesInput, opts?: ReadOptions) => Dialect | null} dialect
 * @property {(partsOrBytes: PartsOrBytes, opts?: ReadOptions) => Promise<StructureResult>} structure
 * @property {(partsOrBytes: PartsOrBytes, opts?: TextOptions) => Promise<TextResult>} text
 * @property {(partsOrBytes: PartsOrBytes, query?: CellsQuery) => Promise<CellsResult>} cellsIn
 */

/* ------------------------------------------------------------------ *
 * The reference builders (R10, R11) — moved here from formats-xlsx.mjs
 * so that office-readers may use this module and not the reverse (the
 * module order; build/plan/draft-split-csv-reader.md, section 0).
 * formats-xlsx.mjs re-exports them, so their users are unchanged.
 * ------------------------------------------------------------------ */

/* IC-1: the sheet-cell element reference, produced by the container that
 * knows it. `ref` is the exact human form a citation surface displays.
 *
 * EXPORTED 2026-09-14 by COFF-10, and the export is the whole change to this
 * file: the `.ods` entry (`odf.mjs`) emits `sheet-cell` references too, and
 * its brief says REUSE the sibling's builder rather than grow a fourth. A
 * second copy of two lines is how two producers of one IC-1 arm drift — the
 * same argument that made `linkWrapper` imported rather than re-derived.
 * Behaviour here is untouched; the over-strictness arm proves this entry's
 * outputs are byte-identical across the change. */
/**
 * @param {string} sheet
 * @param {string} cell
 * @returns {SheetCellRef}
 */
export function sheetCellRef(sheet, cell) {
  return { kind: "sheet-cell", ref: `${sheet}!${cell}`, sheet, cell };
}

/** FW-19 / IC-124 — `{kind:"sheet-range", ref:"Sheet1!A1:C10", sheet, range}`
 *  (EXTRACTION-BREADTH §3.2): a table in a workbook, or a sheet as a unit
 *  (`CONTENT-SEARCH-DESIGN.md` §4.1's workbook unit). `range` is A1:A1
 *  notation with the top-left corner first. EXPORTED for `odf.mjs`'s `.ods`
 *  entry — one builder per arm (COFF-10's rule, which is why `sheetCellRef`
 *  above is exported too). */
/**
 * @param {string} sheet
 * @param {string} range
 * @returns {SheetRangeRef}
 */
export function sheetRangeRef(sheet, range) {
  return { kind: "sheet-range", ref: `${sheet}!${range}`, sheet, range };
}

/** A 1-based column number -> its A1 letters (1 -> A, 27 -> AA). Bijective
 *  base 26 — there is no zero digit, which is the mistake available here.
 * @param {number} n
 * @returns {string}
 */
export function columnLetters(n) {
  let out = "";
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) out = String.fromCharCode(65 + ((c - 1) % 26)) + out;
  return out;
}

/** The WHOLE-SHEET unit a sheet's walk can honestly name: A1 to the far
 *  corner of its USED range, or NULL when that range was not measured or is
 *  empty. The used range and not the grid, deliberately and unlike the
 *  `sheet-cell` BOUND: this is a UNIT a reader is shown ("the sheet"), and a
 *  unit of a million blank rows is not what anybody means by the sheet. The
 *  bound a citation is REFUSED against stays the grid (`rows`/`cols`).
 * @param {string} name
 * @param {number | null | undefined} usedRows
 * @param {number | null | undefined} usedCols
 * @returns {SheetRangeRef | null}
 */
export function usedSheetRange(name, usedRows, usedCols) {
  if (!(typeof usedRows === "number" && Number.isInteger(usedRows) && usedRows > 0
    && typeof usedCols === "number" && Number.isInteger(usedCols) && usedCols > 0)) return null;
  return sheetRangeRef(name, `A1:${columnLetters(usedCols)}${usedRows}`);
}

/* Bytes as a Uint8Array, an ArrayBuffer, any typed-array view or an array of
 * byte values; anything else reads as no bytes, so a wrong argument is a
 * named refusal downstream, never a throw (R21; ooxml.mjs's own policy). */
/**
 * @param {BytesInput} x
 * @returns {Uint8Array}
 */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return x == null ? new Uint8Array(0) : new Uint8Array(x); } catch { return new Uint8Array(0); }
}

/* The declared types this entry answers to outright, folded for case because RFC 2045 makes a media type
   case-insensitive. MEASURED: all 166 corpus keys were served `text/csv` exactly. The older synonyms are the same media
   type under older spellings; a TSV is read by this entry, its delimiter R7's. */
export const CSV_CONTENT_TYPE = "text/csv";
const CSV_CONTENT_TYPE_SYNONYMS = ["application/csv", "text/comma-separated-values"];
const TSV_CONTENT_TYPE = "text/tab-separated-values";

/** The ONE sheet's name. A CSV carries none, so this is a CONVENTION of the
 *  reader and is documented as one — see §4 of the header. Exported because
 *  the suite and any consumer comparing an extent's sheet must use the same
 *  string rather than spell it twice. */
export const CSV_SHEET_NAME = "csv";

/* THE BOUNDS (R6, R22): runtime-limits' rows, through `boundOf`, no literal for a ceiling here (K4835 (1)). The light
   kinds take the standard's figure in Stage 1 (K4834), so `boundOf("csv", ...)` is 50 MB and 1,048,576 records. */
export const MEASURED_CSV_TEXT_BOUND_BYTES = boundOf("csv", "bytes");
const CSV_ROWS_MAX = boundOf("csv", "rows");
const CSV_COLUMNS_MAX = boundOf("sheet", "columns");
const CELL_CHARS_MAX = boundOf("sheet", "cell_chars");
const CELL_KEPT_CHARS = boundOf("sheet", "cell_kept_chars");
/** How many unreadable cells a sheet LISTS (R9, G129f); `counts.undetermined` is the whole count and `cellsIn` gives the
 *  address of any. Proposed; BOB records its row in READ_BOUNDS (reported in the job record). */
export const CSV_STREAMED_UNDETERMINED_MAX = 200;

/** The window a large body is decoded and walked in (R19). */
const CSV_WINDOW_BYTES = 1 << 20;
const CSV_TEXT_CHUNK_LINES = 2048;

/** A body over this many bytes is walked in windows and no record list is kept (G41, K4636): the records of a body are
 *  about 15 times its size in objects. A body at or under it is walked once and its records kept. */
export const SHEET_WINDOW_MIN_BYTES = 64 * 1024;

/** How many complete records a window's delimiter decision examines (R7). */
const DELIMITER_RECORDS = 1000;
/** How many windows past one that decided nothing are asked, to read the first windows under the file's delimiter. */
const LOOKAHEAD_WINDOWS = 4;
/** The fewest bytes a delimiter decision looks at: a window smaller than this (a scaled window of a test) decides from this
 *  many bytes from its start, so that a window too small to hold two records is not a window with no delimiter. */
const DECISION_SPAN_MIN = 16 * 1024;

/** The candidate delimiters — §3's list, and its limit is in §3.
 *  @type {ReadonlyArray<{ch: string, name: DelimiterName}>} */
const DELIMITERS = [
  { ch: ",", name: "comma" },
  { ch: ";", name: "semicolon" },
  { ch: "\t", name: "tab" },
  { ch: "|", name: "pipe" },
];

/* ------------------------------------------------------------------ *
 * The encoding: the BOM, UTF-16 without one, and each window's bytes
 * ------------------------------------------------------------------ */

/** The BOM, or null. Returns `{ encoding, bomBytes, signal }`.
 *  @param {Uint8Array} b
 *  @returns {Bom | null} */
function readBom(b) {
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf)
    return { encoding: "utf-8", bomBytes: 3, signal: "BOM: EF BB BF" };
  /* Order matters: FF FE 00 00 is UTF-32LE, which this reader does not read
     and must not mistake for UTF-16LE. It is refused into the undetermined
     arm rather than decoded as something else. */
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xfe && b[2] === 0x00 && b[3] === 0x00)
    return null;
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe)
    return { encoding: "utf-16le", bomBytes: 2, signal: "BOM: FF FE" };
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff)
    return { encoding: "utf-16be", bomBytes: 2, signal: "BOM: FE FF" };
  return null;
}

/** UTF-16 with no BOM: the NULs of ASCII text sit at one parity.
 *  @param {Uint8Array} head
 *  @returns {"utf-16le" | "utf-16be" | null} */
function sniffUtf16(head) {
  const n = Math.min(head.length, 8192) & ~1;
  if (n < 8) return null;
  let even = 0, odd = 0;
  for (let i = 0; i < n; i += 2) { if (head[i] === 0) even++; if (head[i + 1] === 0) odd++; }
  const half = n / 2;
  if (odd >= half * 0.3 && even <= half * 0.02) return "utf-16le";
  if (even >= half * 0.3 && odd <= half * 0.02) return "utf-16be";
  return null;
}

/** One window's bytes, scanned once: whether any byte is >= 0x80, how many multi-byte sequences are valid UTF-8 and how
 *  many bytes are not, whether a NUL or a byte windows-1252 leaves undefined is among them. A sequence the window's end
 *  cuts is carried, not invalid; a window that starts inside a character skips its continuation bytes. A byte past the
 *  end of `after` reads as 0, as an absent byte's bits do.
 *  @param {Uint8Array} b
 *  @param {boolean} first
 *  @param {Uint8Array} after
 *  @returns {ByteScan} */
function scanBytes(b, first, after) {
  const n = b.length;
  /** @param {number} j @returns {number} */
  const byteAt = (j) => (j < n ? b[j] : after[j - n]) ?? 0;
  /** @param {number} j @returns {number} */
  const inWindow = (j) => b[j] ?? 0;
  let high = false, valid = 0, bad = 0, nul = 0, undef = 0, i = 0;
  if (!first) for (let s = 0; i < n && s < 3 && ((b[i] ?? 0) & 0xc0) === 0x80; s++) { i++; high = true; }
  while (i < n) {
    const c = b[i] ?? 0;
    if (c < 0x80) { if (c === 0) nul++; i++; continue; }
    high = true;
    /** @type {number} */
    let need;
    if (c >= 0xc2 && c <= 0xdf) need = 1;
    else if (c >= 0xe0 && c <= 0xef) need = 2;
    else if (c >= 0xf0 && c <= 0xf4) need = 3;
    else { bad++; if (c === 0x81 || c === 0x8d || c === 0x8f || c === 0x90 || c === 0x9d) undef++; i++; continue; }
    /* a sequence the window's end cuts is finished from the next bytes (`after`): it is the window it starts in that counts it */
    const near = i + need >= n;
    if (near && n - i - 1 + after.length < need) {
      let ok = true;
      for (let j = i + 1; j < n + after.length; j++) if ((byteAt(j) & 0xc0) !== 0x80) { ok = false; break; }
      if (ok) break;
      bad++; i++; continue;
    }
    const at = near ? byteAt : inWindow;
    const c1 = at(i + 1);
    let good = (c1 & 0xc0) === 0x80 && (need < 2 || (at(i + 2) & 0xc0) === 0x80) && (need < 3 || (at(i + 3) & 0xc0) === 0x80);
    if (good) {
      if (c === 0xe0 && c1 < 0xa0) good = false;
      else if (c === 0xed && c1 >= 0xa0) good = false;
      else if (c === 0xf0 && c1 < 0x90) good = false;
      else if (c === 0xf4 && c1 >= 0x90) good = false;
    }
    if (good) { valid++; i += need + 1; } else { bad++; i++; }
  }
  return { high, valid, bad, nul, undef };
}

/** A window's own encoding decision (header §2).
 *  @param {ByteScan} scan
 *  @param {string} legacy
 *  @returns {string | null} */
function classifyBytes(scan, legacy) {
  /* no complete multi-byte sequence and no invalid byte: only the edge of a character the neighbour window finishes decides nothing */
  if (!scan.high || (scan.valid === 0 && scan.bad === 0)) return "us-ascii";
  if (scan.bad === 0 || scan.valid >= scan.bad) return "utf-8";
  if (scan.nul > 0 || scan.undef > 0) return null;
  return legacy;
}

/** A legacy charset the caller declared, when the runtime has a decoder for it; else windows-1252.
 *  @param {string | undefined} declared
 *  @returns {string} */
function legacyLabel(declared) {
  if (typeof declared !== "string") return "windows-1252";
  const label = declared.trim().toLowerCase();
  if (!/^(windows-125\d|iso-8859-\d+|latin1|koi8-[ru])$/.test(label)) return "windows-1252";
  try { new TextDecoder(label); return label; } catch { return "windows-1252"; }
}

/* the default decoder is utf-8, not fatal, BOM not ignored */
const ASCII_DECODER = new TextDecoder();
/** The code units of one piece of the transport, a plain array so `String.fromCharCode.apply` takes it as its arguments. */
const WIDE = Array.from({ length: 8192 }, () => 0);

/** Whether any byte is >= 0x80.
 *  @param {Uint8Array} b
 *  @returns {boolean} */
function anyHigh(b) {
  for (let i = 0; i < b.length; i++) if ((b[i] ?? 0) >= 0x80) return true;
  return false;
}

/** The bijective byte transport: each byte one code unit U+0000-U+00FF. NOT `TextDecoder("latin1")`, which is
 *  windows-1252 (a byte 0x92 would become U+2019 and lose the byte). A window with no high byte is plain ASCII.
 *  @param {Uint8Array} b
 *  @param {boolean} [high] whether a byte >= 0x80 is among them; absent, it is looked for
 *  @returns {string} */
function transport(b, high) {
  const isHigh = high === undefined ? anyHigh(b) : high;
  if (!isHigh) return ASCII_DECODER.decode(b);
  let out = "";
  for (let i = 0; i < b.length; i += WIDE.length) {
    const n = Math.min(WIDE.length, b.length - i);
    for (let j = 0; j < n; j++) WIDE[j] = b[i + j] ?? 0;
    out += String.fromCharCode.apply(null, n === WIDE.length ? WIDE : WIDE.slice(0, n));
  }
  return out;
}

/** The bytes a transport string stands for.
 *  @param {string} s
 *  @returns {Uint8Array} */
function untransport(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ *
 * The delimiter: the majority of a window's records
 * ------------------------------------------------------------------ */

/** The per-candidate counts of the complete records of `text`, up to `DELIMITER_RECORDS`: a quote opens quote mode only at
 *  the start of a field, a quoted line break stays in its record, CR, LF and CRLF end one, a blank line is no record, and
 *  the last fragment (no terminator) is not complete. A window that does not begin a record skips to the first break.
 *  @param {string} text
 *  @param {boolean} first
 *  @returns {Array<[number, number, number, number]>} */
function recordCounts(text, first) {
  const n = text.length;
  /** @type {Array<[number, number, number, number]>} */
  const recs = [];
  let i = 0;
  if (!first) {
    while (i < n && text.charCodeAt(i) !== 10 && text.charCodeAt(i) !== 13) i++;
    if (i < n) { if (text.charCodeAt(i) === 13 && text.charCodeAt(i + 1) === 10) i++; i++; }
  }
  /** @type {[number, number, number, number]} */
  let rec = [0, 0, 0, 0];
  let inQuotes = false, atStart = true, any = false;
  for (; i < n && recs.length < DELIMITER_RECORDS; i++) {
    const c = text.charCodeAt(i);
    if (inQuotes) {
      if (c === 34) { if (text.charCodeAt(i + 1) === 34) i++; else inQuotes = false; }
      continue;
    }
    if (c === 34 && atStart) { inQuotes = true; atStart = false; any = true; continue; }
    if (c === 44) { rec[0]++; atStart = true; any = true; }
    else if (c === 59) { rec[1]++; atStart = true; any = true; }
    else if (c === 9) { rec[2]++; atStart = true; any = true; }
    else if (c === 124) { rec[3]++; atStart = true; any = true; }
    else if (c === 10 || c === 13) {
      if (c === 13 && text.charCodeAt(i + 1) === 10) i++;
      if (any) recs.push(rec);
      rec = [0, 0, 0, 0]; atStart = true; any = false;
    } else { atStart = false; any = true; }
  }
  return recs;
}

/** THE DELIMITER DECISION of one window (header §3, R7). Returns
 *  `{ delimiter, name, confidence, lines, signals, undetermined, tied }`.
 *  @param {string} text
 *  @param {boolean} first
 *  @returns {DelimiterDecision} */
function decideDelimiter(text, first) {
  const recs = recordCounts(text, first);
  const lines = recs.length;
  if (lines < 2) {
    return { delimiter: null, name: null, confidence: "none", lines,
      signals: [localize("office-readers.csv.length_complete_line_s_in", "{length} complete line(s) in the signature window; a delimiter needs at least 2 to be consistent with anything", { length: String(lines) })],
      undetermined: "delimiter_undetermined_too_few_lines", tied: [] };
  }
  /** @type {Array<{ch: string, name: DelimiterName, times: number, modalLines: number}>} */
  const consistent = [];
  /** @type {{comma: number, semicolon: number, tab: number, pipe: number}} each candidate's most common count per line */
  const modal = { comma: 0, semicolon: 0, tab: 0, pipe: 0 };
  DELIMITERS.forEach((d, j) => {
    /** @type {Array<[number, number]>} */
    const none = [];
    const seen = new Map(none);
    for (const r of recs) { const v = r[j] ?? 0; seen.set(v, (seen.get(v) ?? 0) + 1); }
    let best = 0, bestN = 0, present = 0;
    for (const [count, times] of seen) {
      if (count < 1) continue;
      present += times;
      if (times > bestN || (times === bestN && count > best)) { best = count; bestN = times; }
    }
    modal[d.name] = best;
    // consistent: present (at least once) on the majority of the lines, whatever its count on each (R7); the modal count breaks a tie
    if (present * 2 > lines) consistent.push({ ...d, times: present, modalLines: bestN });
  });
  if (consistent.length > 1) {
    const top = Math.max(...consistent.map((d) => d.modalLines));
    const lead = consistent.filter((d) => d.modalLines === top);
    if (lead.length === 1) consistent.splice(0, consistent.length, ...lead);
  }
  const d = consistent.length === 1 ? consistent[0] : undefined;
  if (d) {
    return { delimiter: d.ch, name: d.name, confidence: "certain", lines, modalLines: d.modalLines,
      signals: [d.times === lines
        ? localize("office-readers.csv.name_occurs_v1_time_s", "{name} occurs {v1} time(s) outside quotes on every one of the first {length} complete lines", { name: String(d.name), v1: String(modal[d.name]), length: String(lines) })
        : localize("office-readers.csv.delimiter_in_the_majority_of_the_records", "{name} occurs {v1} time(s) outside quotes on {times} of the {length} complete lines read, a majority", { name: String(d.name), v1: String(modal[d.name]), times: String(d.times), length: String(lines) })],
      undetermined: null, tied: [] };
  }
  if (consistent.length > 1) {
    return { delimiter: null, name: null, confidence: "none", lines,
      signals: [localize("office-readers.csv.length_candidates_are_equally_consistent", "{length} candidates are equally consistent over {length_2} lines: {map}", { length: String(consistent.length), length_2: String(lines), map: String(consistent.map((d) => `${d.name} (${modal[d.name]}/line)`).join(", ")) })],
      undetermined: "delimiter_undetermined_tied", tied: consistent.map((d) => d.name) };
  }
  return { delimiter: null, name: null, confidence: "none", lines,
    signals: [localize("office-readers.csv.no_candidate_map_occurs_a", "no candidate ({map}) occurs a consistent, non-zero number of times over {length} lines", { map: String(DELIMITERS.map((d) => d.name).join(", ")), length: String(lines) })],
    undetermined: "delimiter_undetermined_none_consistent", tied: [] };
}

/** The delimiter decision of a decoded text (the first window of a body).
 *  @param {string | null | undefined} text
 *  @returns {DelimiterDecision} */
export function delimiterSignature(text) {
  return decideDelimiter(String(text ?? ""), true);
}

/* ------------------------------------------------------------------ *
 * The record walk — RFC 4180, one pass, quote-aware, carrying its state across pieces
 * ------------------------------------------------------------------ */

/** Split `text` into records of fields. `delimiter` may be NULL, which is the
 *  undetermined case and yields ONE field per record — the rows survive
 *  because a line break is not a candidate for anything (header §3).
 *
 *  RFC 4180 as real producers write it: a field may be quoted; a quote opens quote mode ONLY AT THE START OF A FIELD (R23:
 *  `12" pipe` is an ordinary field); inside quotes a doubled `""` is one quote and CR, LF and the delimiter are literal; a
 *  CR, an LF or a CRLF outside quotes ends the record. MEASURED against the corpus —
 *  `documents/Oakland-E-scooter-Survey_7-15-Filtered-1.csv` carries 934 LFs
 *  against 867 CRLFs because free-text survey answers hold bare LFs INSIDE
 *  quoted fields, so a line-oriented split would have shredded 67 records.
 *  @param {string} text
 *  @param {string | null | undefined} delimiter
 *  @returns {string[][]} */
export function walkRecords(text, delimiter) {
  /** @type {string[][]} */
  const records = [];
  const w = createRecordWalk(delimiter, (record) => records.push(record));
  w.feed(text);
  w.end();
  return records;
}

/** The same walk, fed the text in pieces: `feed(text)` takes each piece in
 *  order (a piece may end anywhere, between the two quotes of a `""` and
 *  between the CR and LF of a CRLF included), `onRecord(fields, info)` is called for each record as it completes,
 *  `end()` after the last piece. One piece holding the whole text, then `end()`, is `walkRecords`.
 *
 *  `info` is `{ end, skipLF, cols, over, open }`: `end` is the number of characters consumed up to and including the
 *  record's terminator (so a walk can resume there; `skipLF` says a CR ended the record and a LF that follows is its own),
 *  `cols` the record's field count, `over` the `[column, length]` of each field longer than `CELL_CHARS_MAX` (the field is
 *  kept to `CELL_KEPT_CHARS`), `open` `{col, chars}` for a quote still open at the end of the text (that field is `""`),
 *  `wide` the most fields the record would have under any one of the four delimiters, counted outside quotes while no delimiter
 *  is decided (`0` when one is), so the column bound (R22) judges a record whose delimiter R7 could not decide.
 *  `limits.maxColumns` stops a record keeping fields past it (`cols` still counts them).
 *  @param {string | null | undefined} delimiter
 *  @param {RecordSink} onRecord
 *  @param {WalkLimits} [limits]
 *  @returns {RecordWalk} */
export function createRecordWalk(delimiter, onRecord, limits = {}) {
  const maxColumns = limits.maxColumns ?? Infinity;
  let delim = delimiter ? delimiter.charCodeAt(0) : -1;
  /** @type {string[]} */
  let row = [];
  let cols = 0, field = "", fieldLen = 0;
  /** @type {Array<[number, number]> | null} */
  let over = null;
  /** @type {[number, number, number, number]} */
  const candidates = [0, 0, 0, 0];
  let inQuotes = false, atStart = true, started = false;
  /* The last piece ended on a `"` inside quotes: the next character says whether it was one half of a doubled `""`. */
  let quoteOpen = false;
  /* The last piece ended on a CR that ended a record: a LF now belongs to it. */
  let skipLF = false;
  let consumed = 0;
  /** @param {string} s */
  const append = (s) => {
    if (!s) return;
    fieldLen += s.length;
    const room = CELL_KEPT_CHARS - field.length;
    if (room > 0) field += s.length > room ? s.slice(0, room) : s;
  };
  const endField = () => {
    cols++;
    if (fieldLen > CELL_CHARS_MAX) (over ??= []).push([cols, fieldLen]);
    if (cols <= maxColumns) row.push(field);
    field = ""; fieldLen = 0;
  };
  /**
   * @param {number} end
   * @param {boolean} crEnd
   * @param {OpenQuote | null} [open]
   */
  const endRecord = (end, crEnd, open) => {
    endField();
    /** @type {RecordInfo} */
    const info = { end, skipLF: crEnd, cols, over, open: open ?? null, wide: delim < 0 ? Math.max(...candidates) + 1 : 0 };
    const record = row;
    candidates.fill(0);
    row = []; cols = 0; over = null; started = false; atStart = true;
    onRecord(record, info);
  };
  return {
    setDelimiter(d) { delim = d ? d.charCodeAt(0) : -1; },
    /** Resume after a record whose CR ended the previous piece's text: the next piece's LF is that record's. */
    resumeAfterCR() { skipLF = true; },
    feed(text) {
      const n = text.length, base = consumed;
      consumed += n;
      let i = 0, run = 0;
      if (quoteOpen) {
        if (n === 0) return;
        quoteOpen = false;
        if (text.charCodeAt(0) === 34) { append('"'); i = run = 1; } else inQuotes = false;
      } else if (skipLF) {
        if (n === 0) return;
        skipLF = false;
        if (text.charCodeAt(0) === 10) i = run = 1;
      }
      for (; i < n; i++) {
        const c = text.charCodeAt(i);
        if (inQuotes) {
          if (c !== 34) continue;
          append(text.slice(run, i));
          if (i + 1 >= n) { quoteOpen = true; run = n; break; }
          if (text.charCodeAt(i + 1) === 34) { append('"'); i++; } else inQuotes = false;
          run = i + 1;
          continue;
        }
        if (c === 34 && atStart) { inQuotes = true; atStart = false; started = true; run = i + 1; continue; }
        if (delim < 0) {
          const k = c === 44 ? 0 : c === 59 ? 1 : c === 9 ? 2 : c === 124 ? 3 : -1;
          if (k !== -1) candidates[k]++;
        }
        if (c === delim) { append(text.slice(run, i)); endField(); run = i + 1; atStart = true; started = true; continue; }
        if (c === 13) {
          append(text.slice(run, i));
          let crEnd = false;
          if (i + 1 >= n) { skipLF = true; crEnd = true; } else if (text.charCodeAt(i + 1) === 10) i++;
          run = i + 1;
          endRecord(base + i + 1, crEnd);
          continue;
        }
        if (c === 10) { append(text.slice(run, i)); run = i + 1; endRecord(base + i + 1, false); continue; }
        atStart = false; started = true;
      }
      if (run < n && !quoteOpen) append(text.slice(run, n));
    },
    end() {
      if (quoteOpen) { quoteOpen = false; inQuotes = false; }
      /** @type {OpenQuote | null} */
      let open = null;
      if (inQuotes) { open = { col: cols + 1, chars: fieldLen }; field = ""; fieldLen = 0; over = null; inQuotes = false; }
      /* A trailing fragment with no terminator is still a record — a producer that
         omits the final CRLF has published a last row, not half of one. An EMPTY
         trailing fragment is not: that is the terminator of the record before it. */
      if (started || field !== "" || fieldLen > 0 || cols || open) endRecord(consumed, false, open);
    },
  };
}

/* ------------------------------------------------------------------ *
 * The windows and the dialect — one decision per window, the file's by majority
 * ------------------------------------------------------------------ */

/**
 * What a body is read through (`makeContext`): its bytes, BOM, encoding family, window size and count, and the windows
 * decided so far (`pending`: those a lookahead decided out of order).
 * @typedef {Object} ReadContext
 * @property {true} ok
 * @property {Uint8Array} b
 * @property {Bom | null} bom
 * @property {number} bomBytes
 * @property {number} bodyBytes
 * @property {string | null} utf16
 * @property {boolean} sniffed
 * @property {TextDecoder | null} decoder
 * @property {number} W
 * @property {number} nWin
 * @property {string} legacy
 * @property {boolean} declared
 * @property {CsvWindow[]} windows
 * @property {Map<number, CsvWindow>} pending
 */
/** @typedef {{encoding: EncodingDecision, delimiter: FileDelimiter, disagree: number[]}} DialectFields what `dialectOf` states */
/**
 * A body's windows decided without a walk (`scanDialect`): its UTF-16 encoding if any, its windows and its dialect.
 * @typedef {Object} DialectScan
 * @property {true} ok
 * @property {string | null} utf16
 * @property {CsvWindow[]} windows
 * @property {EncodingDecision} encoding
 * @property {FileDelimiter} delimiter
 * @property {number[]} disagree
 */

/** What a body is read through: its BOM, its encoding family, its windows. `opts.windowBytes` is a test seam (a scaled
 *  window, R-CLOCK's counts), `opts.declared` a legacy charset the source declared.
 *  @param {Uint8Array} b
 *  @param {ReadOptions | undefined} opts
 *  @returns {ReadContext | PartsRefusal} */
function makeContext(b, opts) {
  if (!b.length) return { ok: false, why: "empty_body" };
  const bom = readBom(b);
  const bomBytes = bom ? bom.bomBytes : 0;
  const bomUtf16 = bom && bom.encoding.startsWith("utf-16") ? bom.encoding : null;
  const sniff = !bom && !bomUtf16 ? sniffUtf16(b.subarray(0, Math.min(b.length, 8192))) : null;
  const utf16 = bomUtf16 ?? sniff;
  const sniffed = sniff != null;
  /** @type {TextDecoder | null} */
  let decoder = null;
  if (utf16) {
    try { decoder = new TextDecoder(utf16, { fatal: false, ignoreBOM: true }); }
    catch { return { ok: false, why: `decoder_unavailable:${utf16}`, encoding: { encoding: utf16 } }; }
  }
  const windowBytes = opts?.windowBytes;
  let W = typeof windowBytes === "number" && Number.isInteger(windowBytes) && windowBytes >= 16 ? windowBytes : CSV_WINDOW_BYTES;
  if (utf16) W &= ~1;
  const bodyBytes = b.length - bomBytes;
  const declared = opts?.declared;
  /** @type {Array<[number, CsvWindow]>} */
  const none = [];
  return { ok: true, b, bom, bomBytes, bodyBytes, utf16, sniffed, decoder, W,
    nWin: Math.max(1, Math.ceil(bodyBytes / W)), legacy: legacyLabel(declared), declared: typeof declared === "string",
    windows: [], pending: new Map(none) };
}

/** @param {ReadContext} ctx @param {number} k @returns {[number, number]} window `k`'s byte span */
const windowSpan = (ctx, k) => [ctx.bomBytes + k * ctx.W, Math.min(ctx.b.length, ctx.bomBytes + (k + 1) * ctx.W)];

/** Window `k` of a list every window of a body is decided into before it is read.
 *  @param {readonly CsvWindow[]} windows
 *  @param {number} k
 *  @returns {CsvWindow}
 *  @throws {RangeError} never in this module: a window is read only after it is decided */
function windowAt(windows, k) {
  const w = windows[k];
  if (!w) throw new RangeError(`no window ${k}`);
  return w;
}

/** Decide window `k` from its own bytes `sub`: its encoding (ASCII-grid bodies) and its delimiter. Returns the window and
 *  the text the walk runs over. `stream` is false when the window is asked out of order (a UTF-16 window then starts a
 *  decoder of its own, and the text is not the walk's).
 *  @param {ReadContext} ctx
 *  @param {number} k
 *  @param {Uint8Array} sub
 *  @param {boolean} stream
 *  @returns {{w: CsvWindow, text: string}} */
function decideWindow(ctx, k, sub, stream) {
  const [lo, hi] = windowSpan(ctx, k);
  const utf16 = ctx.utf16;
  const decoder = ctx.decoder;
  const scan = utf16 ? null : scanBytes(sub, k === 0, ctx.b.subarray(hi, hi + 3));
  /** @type {string} */
  let text;
  if (utf16) {
    text = stream && decoder ? decoder.decode(sub, { stream: hi < ctx.b.length })
      : new TextDecoder(utf16, { fatal: false, ignoreBOM: true }).decode(sub);
  } else {
    text = transport(sub, scan ? scan.high : undefined);
  }
  const enc = utf16 ? utf16 : scan ? classifyBytes(scan, ctx.legacy) : null;
  let dec = decideDelimiter(text, k === 0);
  /* a window too small to hold two records (a scaled window) decides from the bytes after its start instead */
  if (dec.undetermined === "delimiter_undetermined_too_few_lines" && ctx.W < DECISION_SPAN_MIN && hi < ctx.b.length) {
    const span = ctx.b.subarray(lo, Math.min(ctx.b.length, lo + DECISION_SPAN_MIN));
    dec = decideDelimiter(utf16 ? new TextDecoder(utf16, { fatal: false, ignoreBOM: true }).decode(span) : transport(span), k === 0);
  }
  /** @type {CsvWindow} */
  const w = { at: lo, end: hi, high: scan ? scan.high : false, enc, delim: dec.delimiter, dec, used: null, readEnc: null };
  if (scan) w.scan = scan;
  return { w, text };
}

/** Window `j`, decided out of order by a lookahead and kept until the walk reaches it.
 *  @param {ReadContext} ctx
 *  @param {number} j
 *  @returns {CsvWindow} */
function lookAhead(ctx, j) {
  const [lo, hi] = windowSpan(ctx, j);
  const ahead = decideWindow(ctx, j, ctx.b.subarray(lo, hi), false).w;
  ctx.pending.set(j, ahead);
  return ahead;
}

/** The delimiter window `k` is read under: its own decision, else the last one decided before it, else the first one the
 *  next few windows decide (asked here, out of order, so the first windows are not read as one column).
 *  @param {ReadContext} ctx
 *  @param {number} k
 *  @param {CsvWindow} w
 *  @param {string | null} lastDecided
 *  @returns {string | null} */
function resolveDelimiter(ctx, k, w, lastDecided) {
  const own = w.delim;
  if (own != null) return own;
  if (lastDecided != null) return lastDecided;
  for (let j = k + 1; j < Math.min(ctx.nWin, k + 1 + LOOKAHEAD_WINDOWS); j++) {
    const ahead = ctx.pending.get(j) ?? lookAhead(ctx, j);
    const theirs = ahead.delim;
    if (theirs != null) return theirs;
  }
  return null;
}

/** The FILE's dialect from its windows (header §2, §3, R7): the encoding by the majority of the non-ASCII windows, the
 *  delimiter by the majority of the determined ones, and the windows whose decision differs, by byte offset.
 *  @param {ReadContext} ctx
 *  @returns {{enc: EncodingDecision, delimiter: FileDelimiter, disagree: number[]}} */
function fileDialect(ctx) {
  const { windows } = ctx;
  const bom = ctx.bom;
  const utf16 = ctx.utf16;
  /** @type {EncodingDecision} */
  let enc;
  if (bom) {
    enc = { encoding: bom.encoding, confidence: "certain", bomBytes: bom.bomBytes, assumed: false,
      signals: [bom.signal, localize("office-readers.csv.declared_by_the_producer_in_the_bytes", "declared by the producer in the bytes")], undetermined: null };
  } else if (utf16) {
    enc = { encoding: utf16, confidence: "likely", bomBytes: 0, assumed: true,
      signals: ["no BOM", localize("office-readers.csv.the_nul_bytes_of_ascii_text_sit_at_one_parity", "the NUL bytes of ASCII text sit at one parity: {encoding} without a BOM", { encoding: utf16 })], undetermined: null };
  } else if (ctx.b.length >= 4 && ctx.b[0] === 0xff && ctx.b[1] === 0xfe && ctx.b[2] === 0 && ctx.b[3] === 0) {
    enc = { encoding: null, confidence: "none", bomBytes: 0, assumed: true,
      signals: ["BOM: FF FE 00 00 (UTF-32LE, not read)"], undetermined: "encoding_undetermined" };
  } else {
    /** @type {Array<[string | null, number]>} */
    const none = [];
    const tally = new Map(none);
    for (const w of windows) { const e = w.enc; if (e !== "us-ascii") tally.set(e, (tally.get(e) ?? 0) + 1); }
    if (!tally.size) {
      const total = windows.reduce((n, w) => n + (w.end - w.at), 0);
      enc = { encoding: "us-ascii", confidence: "likely", bomBytes: 0, assumed: true,
        signals: [`no byte >= 0x80 in the first ${total} bytes`,
          localize("office-readers.csv.us_ascii_not_utf_8_every_8_bit_superset", "us-ascii, not utf-8: every 8-bit superset decodes these bytes identically")], undetermined: null };
    } else {
      /** @type {string | null} */
      let best = null;
      let bestN = -1;
      for (const e of ["utf-8", ctx.legacy, null]) if ((tally.get(e) ?? 0) > bestN) { best = e; bestN = tally.get(e) ?? 0; }
      const chosen = best;
      if (chosen == null) {
        enc = { encoding: null, confidence: "none", bomBytes: 0, assumed: true,
          signals: ["no BOM", "a byte >= 0x80 that is not part of a valid utf-8 sequence and a NUL or a byte no legacy charset defines"],
          undetermined: "encoding_undetermined" };
      } else {
        const how = chosen === "utf-8"
          ? localize("office-readers.csv.every_multi_byte_sequence_in_the_signature_window", "every multi-byte sequence in the signature window is valid utf-8")
          : localize("office-readers.csv.the_bytes_are_not_utf_8_read_as_the_legacy_charset", "the bytes are not utf-8: read as the legacy charset {encoding}", { encoding: chosen });
        enc = { encoding: chosen, confidence: "likely", bomBytes: 0, assumed: !(ctx.declared && chosen === ctx.legacy),
          signals: ["no BOM", how, localize("office-readers.csv.likely_not_certain_validity_is_evidence", "likely, not certain: validity is evidence, not the producer's declaration")],
          undetermined: null };
      }
    }
  }
  /** @type {Array<[string, number]>} */
  const noDelims = [];
  const tally = new Map(noDelims);
  for (const w of windows) { const d = w.delim; if (d != null) tally.set(d, (tally.get(d) ?? 0) + 1); }
  /* the most common determined decision (the first window of the most common one on a tie), else the richest window's
     reason for deciding nothing */
  let pick = windowAt(windows, 0);
  if (tally.size) {
    let bestN = 0;
    for (const w of windows) { const d = w.delim; if (d != null && (tally.get(d) ?? 0) > bestN) { pick = w; bestN = tally.get(d) ?? 0; } }
  } else {
    for (const w of windows) if (w.dec.lines > pick.dec.lines) pick = w;
  }
  /** @type {FileDelimiter} */
  const delimiter = { ...pick.dec, lines: windows.reduce((n, w) => n + w.dec.lines, 0), records: pick.dec.lines };
  const delim = delimiter.delimiter;
  /** @type {number[]} */
  const disagree = [];
  for (const w of windows) {
    /* an ASCII-only window reads the same under every ASCII-grid encoding: it never disagrees */
    const encDiffers = !utf16 && w.enc !== "us-ascii" && w.enc !== enc.encoding;
    const own = w.delim;
    const delimDiffers = delim != null && own != null && own !== delim;
    if (encDiffers || delimDiffers) disagree.push(w.at);
  }
  /* a window is read under its own encoding; one with none to give (ASCII only, or undecodable) under the file's */
  for (const w of windows) { const e = w.enc; w.readEnc = utf16 ? utf16 : (e != null && e !== "us-ascii") ? e : (enc.encoding ?? e); }
  return { enc, delimiter, disagree };
}

/** The dialect AS THE ENTRY STATES IT (BOB #32: "found by signature and
 *  RECORDED on the reading"). One builder, so `structure()`, `text()` and the
 *  `dialect` slot cannot state two different dialects for one body.
 *
 *  IC-283 (I2 2.8.0 proposed, MINOR ADDITIVE) is this key. ITS RESIDUE IS
 *  CLOSED BY REC-218 (BOB #33, 2026-09-24 21:55Z, option (b)): the acquire
 *  wire keeps it as `reading.dialect`, a key of its own, through the
 *  registry's `readingDialect` projection (formats.mjs).
 *  @param {DialectFields} parts
 *  @returns {Dialect} */
function dialectOf(parts) {
  const disagree = parts.disagree;
  /** @type {string[]} */
  const undetermined = [];
  for (const u of [parts.encoding.undetermined, parts.delimiter.undetermined, disagree.length ? "windows_disagree" : null]) if (u) undetermined.push(u);
  return {
    encoding: parts.encoding.encoding,
    encodingConfidence: parts.encoding.confidence,
    encodingSignals: parts.encoding.signals,
    delimiter: parts.delimiter.name,
    delimiterConfidence: parts.delimiter.confidence,
    delimiterSignals: parts.delimiter.signals,
    assumed: parts.encoding.assumed === true,
    disagree: [...disagree],
    undetermined,
  };
}

/** The windows a dialect is decided over: all of a body within the byte bound, the first of a body over it (its dialect
 *  is read from the head, R6). Pure and synchronous: the decisions `csvParts` makes while it walks, made without walking,
 *  so a dialect read at intake and one read from a full parse of the same bytes cannot differ.
 *  @param {Uint8Array} b
 *  @param {ReadOptions | undefined} opts
 *  @returns {DialectScan | PartsRefusal} */
function scanDialect(b, opts) {
  const ctx = makeContext(b, opts);
  if (!ctx.ok) return ctx;
  const wins = ctx.bodyBytes > MEASURED_CSV_TEXT_BOUND_BYTES ? 1 : ctx.nWin;
  /** @type {string | null} */
  let last = null;
  for (let k = 0; k < wins; k++) {
    const [lo, hi] = windowSpan(ctx, k);
    const { w } = windowFor(ctx, k, b.subarray(lo, hi), true);
    ctx.windows.push(w);
    w.used = resolveDelimiter(ctx, k, w, last);
    const own = w.delim;
    if (own != null) last = own;
  }
  const f = fileDialectResult(ctx);
  return { ok: true, utf16: ctx.utf16, windows: ctx.windows, encoding: f.encoding, delimiter: f.delimiter, disagree: f.disagree };
}

/** @param {ReadContext} ctx @returns {DialectFields} */
function fileDialectResult(ctx) {
  const f = fileDialect(ctx);
  return { encoding: f.enc, delimiter: f.delimiter, disagree: f.disagree };
}

/** THE ENCODING over a body's windows (header §2). `{ encoding, confidence, bomBytes, signals, undetermined, assumed }`.
 *  @param {BytesInput} bytes
 *  @returns {EncodingDecision} */
export function encodingSignature(bytes) {
  const b = toBytes(bytes);
  const s = scanDialect(b, undefined);
  return s.ok ? s.encoding : { encoding: null, confidence: "none", bomBytes: 0, signals: [], undetermined: "encoding_undetermined", assumed: true };
}

/* ------------------------------------------------------------------ *
 * parts() — read once; structure() and text() are projections of it
 * ------------------------------------------------------------------ */

/** R20: let the caller's turn pass. A `yieldNow` that is not a function is no yield; one that throws or rejects is
 *  ignored (R13: this module never throws), so the answer is the same with it or without.
 *  @param {(() => unknown) | undefined} yieldNow
 *  @returns {Promise<void>} */
async function letPass(yieldNow) {
  if (typeof yieldNow !== "function") return;
  try { await yieldNow(); } catch { /* a yield that fails is no yield */ }
}

/** The marker a body over a bound is refused with (R6, R22): its size, the figure, the metric, and a UTF-16 body's encoding.
 *  @param {"body_bytes" | "rows" | "columns"} metric
 *  @param {number} size
 *  @param {number} bound
 *  @param {string} boundName
 *  @param {string | null} encoding
 *  @returns {SizeMarker} */
const sizeMarker = (metric, size, bound, boundName, encoding) => encoding
  ? { ok: false, text: "undetermined", why: "over_size_bound", size, bound, boundName, metric, final: true, encoding }
  : { ok: false, text: "undetermined", why: "over_size_bound", size, bound, boundName, metric, final: true };

/** Window `k`'s decision and the text the walk runs over: asked fresh, or taken from the lookahead that already decided it.
 *  @param {ReadContext} ctx
 *  @param {number} k
 *  @param {Uint8Array} sub
 *  @param {boolean} stream
 *  @returns {{w: CsvWindow, text: string}} */
function windowFor(ctx, k, sub, stream) {
  const cached = ctx.pending.get(k);
  if (!cached) return decideWindow(ctx, k, sub, stream);
  ctx.pending.delete(k);
  const decoder = ctx.decoder;
  const text = ctx.utf16 && decoder ? decoder.decode(sub, { stream: cached.end < ctx.b.length }) : transport(sub, cached.high);
  return { w: cached, text };
}

/** Is this UTF-16 body valid, decided in windows so no decoded copy of the body is held?
 *  @param {ReadContext} ctx
 *  @param {string} utf16 the body's UTF-16 label
 *  @param {(() => unknown) | undefined} yieldNow
 *  @returns {Promise<boolean>} */
async function validUtf16(ctx, utf16, yieldNow) {
  const decoder = new TextDecoder(utf16, { fatal: true, ignoreBOM: true });
  try {
    for (let k = 0; k < ctx.nWin; k++) {
      if (k > 0) await letPass(yieldNow);
      const [lo, hi] = windowSpan(ctx, k);
      decoder.decode(ctx.b.subarray(lo, hi), { stream: hi < ctx.b.length });
    }
    return true;
  } catch { return false; }
}

/** `parts()`: the body read once, in windows (R3, R6, R9).
 *  @param {BytesInput} bytes
 *  @param {ReadOptions | undefined} opts
 *  @returns {Promise<PartsResult>} */
async function csvParts(bytes, opts) {
  const b = toBytes(bytes);
  const yieldNow = opts?.yieldNow;
  const ctx = makeContext(b, opts);
  if (!ctx.ok) return ctx;
  const { bodyBytes } = ctx;
  const utf16 = ctx.utf16;
  const unit = utf16 ? 2 : 1;
  const encodingOf = utf16;

  /* THE BOUNDS (R6, R22), on the body's own length and on what the walk counts: over the bytes bound the body is refused
     whole, its dialect read from the head; over the records bound or a record's columns it is refused at the record that
     passes it. A body within them is read in windows and keeps no record list unless it fits one window's first 64 KiB. */
  /** @type {SizeMarker | null} */
  let guard = bodyBytes > MEASURED_CSV_TEXT_BOUND_BYTES
    ? sizeMarker("body_bytes", bodyBytes, MEASURED_CSV_TEXT_BOUND_BYTES, "MEASURED_CSV_TEXT_BOUND_BYTES", encodingOf)
    : null;
  const windowed = !guard && bodyBytes > SHEET_WINDOW_MIN_BYTES;
  /** @type {string[][] | null} */
  const records = !guard && !windowed ? [] : null;
  /** @type {Array<[number, RecordInfo]>} */
  const none = [];
  const recInfo = records ? new Map(none) : null;
  /* the window each kept record ended in: a record is read under the dialect of that window (R24) */
  /** @type {number[] | null} */
  const recWindow = records ? [] : null;
  /** @type {AccessPoint[]} */
  const accessPoints = [];
  /** @type {{boundary: AccessPoint | null}} the access point after the last record the walk completed */
  const reached = { boundary: null };
  let rows = 0, sawReplacement = false, at = 0;
  /** @returns {SizeMarker | null} the guard as the walk has left it */
  const guardNow = () => guard;
  /** @type {RecordSink} */
  const onRecord = (record, info) => {
    if (guard) return;
    rows++;
    const columns = Math.max(info.cols, info.wide);
    if (columns > CSV_COLUMNS_MAX) { guard = sizeMarker("columns", columns, CSV_COLUMNS_MAX, "SHEET_COLUMNS_MAX", encodingOf); return; }
    if (rows > CSV_ROWS_MAX) { guard = sizeMarker("rows", rows, CSV_ROWS_MAX, "MEASURED_CSV_ROWS_BOUND", encodingOf); return; }
    if (records && recInfo && recWindow) {
      if (info.over || info.open) recInfo.set(records.length, info);
      records.push(record);
      recWindow.push(at);
    }
    reached.boundary = { at: ctx.bomBytes + info.end * unit, row: rows, skipLF: info.skipLF };
  };
  const walk = createRecordWalk(null, onRecord, { maxColumns: CSV_COLUMNS_MAX });

  const wins = guard ? 1 : ctx.nWin;
  /** @type {string | null} */
  let last = null;
  for (let k = 0; k < wins; k++) {
    if (k > 0) await letPass(yieldNow);
    const [lo, hi] = windowSpan(ctx, k);
    const { w, text } = windowFor(ctx, k, b.subarray(lo, hi), true);
    at = k;
    ctx.windows.push(w);
    w.used = resolveDelimiter(ctx, k, w, last);
    const own = w.delim;
    if (own != null) last = own;
    if (guard) continue;
    if (utf16 && !sawReplacement && text.includes("�")) sawReplacement = true;
    walk.setDelimiter(w.used);
    walk.feed(text);
    const boundary = reached.boundary;
    const lastPoint = accessPoints.at(-1);
    if (!guardNow() && boundary && (!lastPoint || boundary.at > lastPoint.at)) accessPoints.push(boundary);
  }
  if (!guard) walk.end();
  ctx.pending.clear();
  const invalidUtf16 = !!utf16 && !guard && sawReplacement && !(await validUtf16(ctx, utf16, yieldNow));
  const dialect = fileDialect(ctx);

  return {
    ok: true, format: "csv", bytes: b, bomBytes: ctx.bomBytes,
    bodyBytes, encoding: dialect.enc, delimiter: dialect.delimiter, disagree: dialect.disagree, guard, records, recInfo, recWindow,
    transport: !utf16, invalidUtf16, windowed, utf16, W: ctx.W, windows: ctx.windows, accessPoints, rows,
  };
}

/** @typedef {(record: string[], info: RecordInfo | null, window: CsvWindow) => void} RecordVisitor one record, its walk's information and its window */

/** Every record of the body in order, to `onRecord(fields, info, window)`: the list `parts()` kept for a small body, else a
 *  walk in windows that keeps none, from `from` (an access point: the byte to resume at, the row it follows) or the start.
 *  `stopped()`, asked after each record of a list and each window, ends the walk early; a walk that ends early does not
 *  flush the record it was in the middle of. With `yieldNow` (R20) it awaits it between windows.
 *  @param {CsvParts} parts
 *  @param {RecordVisitor} onRecord
 *  @param {() => boolean} [stopped]
 *  @param {(() => unknown) | undefined} [yieldNow]
 *  @param {AccessPoint | null} [from]
 *  @returns {Promise<void>} */
async function forEachRecord(parts, onRecord, stopped = () => false, yieldNow, from = null) {
  const records = parts.records;
  if (records) {
    const recInfo = parts.recInfo;
    const recWindow = parts.recWindow;
    for (let i = 0; i < records.length; i++) {
      if (stopped()) return;
      onRecord(records[i] ?? [], (recInfo ? recInfo.get(i) : undefined) ?? null, windowAt(parts.windows, (recWindow ? recWindow[i] : undefined) ?? -1));
    }
    return;
  }
  const { bytes: b, W, bomBytes } = parts;
  let current = windowAt(parts.windows, 0);
  const walk = createRecordWalk(null, (record, info) => onRecord(record, info, current), { maxColumns: CSV_COLUMNS_MAX });
  if (from?.skipLF) walk.resumeAfterCR();
  const utf16 = parts.utf16;
  const decoder = utf16 ? new TextDecoder(utf16, { fatal: false, ignoreBOM: true }) : null;
  let at = from ? from.at : bomBytes, firstPiece = true;
  while (at < b.length) {
    if (!firstPiece) await letPass(yieldNow);
    firstPiece = false;
    const k = Math.floor((at - bomBytes) / W);
    const hi = Math.min(b.length, bomBytes + (k + 1) * W);
    current = windowAt(parts.windows, k);
    walk.setDelimiter(current.used);
    const sub = b.subarray(at, hi);
    walk.feed(decoder ? decoder.decode(sub, { stream: hi < b.length }) : transport(sub, at === current.at ? current.high : undefined));
    if (stopped()) return;
    at = hi;
  }
  walk.end();
}

/* ------------------------------------------------------------------ *
 * structure(parts) -> the I2 shape (+ the IC-2 evidentiary envelope)
 * ------------------------------------------------------------------ */

/** @param {PartsResult | null | undefined} parts @returns {StructureResult} */
function csvStructure(parts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "csv", reason: parts ? parts.why : "PARTS_ABSENT" };
  }
  const dialect = dialectOf(parts);
  /* EVERY ZERO BELOW IS A FACT ABOUT THE FORMAT, NOT A WALK THAT FOUND
     NOTHING, and the notes say so because CLAUDE.md §2's rule about a zero
     `intra` count is exactly the confusion available here. A CSV declares no
     relationships, embeds no files and holds no metadata part: there is
     nowhere for a link to BE. A URL sitting in a cell is the document's TEXT
     and FRAMEWORK's to read; treating it as a declared link would be this
     entry deciding what a string MEANS. */
  const notes = [
    word("csv.notes.csv_format_declares"),
    word("csv.notes.url_cell_text"),
  ];
  const guard = parts.guard;
  if (guard) notes.push("text_body_over_bound");
  return {
    ok: true,
    container: "csv",
    sheets: [{ sheet: 0, name: CSV_SHEET_NAME, sheetId: null, state: "visible", hidden: false }],
    links: [],
    counts: { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 },
    /* The IC-2 envelope in the shape the office entries accepted. A CSV
       carries none of DEC-5's extras — no formula beside a value, no tracked
       change, no comment, no hidden row, no core properties — because the
       format has no place for any of them. `kinds: []` is exhaustive by the
       FORMAT's definition, which the note records. */
    evidentiary: {
      container: "csv",
      kinds: [],
      items: [],
      undetermined: guard ? [{ part: "(body)", why: "over_size_bound", guard }] : [],
      counts: {},
    },
    dialect,
    /* R32: a csv can carry nothing that acts when opened — the format's zero. */
    active: [],
    notes,
  };
}

/* ------------------------------------------------------------------ *
 * text(parts) -> the I2 text shape
 * ------------------------------------------------------------------ */

/** Is every code unit of this field below 0x80? Under an undetermined
 *  encoding that is the difference between a cell whose characters are known
 *  and one whose characters are not.
 *  @param {string} s
 *  @returns {boolean} */
function asciiClean(s) {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) >= 0x80) return false;
  return true;
}

/** The bytes of a string's UTF-8 (a lone surrogate counts as the three of its replacement character).
 *  @param {string} s
 *  @returns {number} */
function utf8Length(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

/** The number of `\n` in a string: the lines a record's text adds beyond its first.
 *  @param {string} s
 *  @returns {number} */
function countLineBreaks(s) {
  let n = 0;
  for (let i = s.indexOf("\n"); i !== -1; i = s.indexOf("\n", i + 1)) n++;
  return n;
}

const UTF8_FATAL = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
/** @type {Array<[string, TextDecoder]>} */
const NO_DECODERS = [];
const legacyDecoders = new Map(NO_DECODERS);
/** @param {string} label @returns {TextDecoder} */
function legacyDecoder(label) {
  const known = legacyDecoders.get(label);
  if (known) return known;
  const d = new TextDecoder(label, { ignoreBOM: true });
  legacyDecoders.set(label, d);
  return d;
}

/** @typedef {{value: string} | {why: UnreadReason}} FieldRead one field's text, or why it has none */
/** @typedef {{col: number, value: string, over?: number}} ReadCell a field with a value; `over` its length past the cell bound */
/** @typedef {{col: number, value: null, why: UnreadReason}} UnreadCell a field the encoding could not read */
/** @typedef {{col: number, value: null, why: "unterminated_quote", open: OpenQuote}} OpenCell a field whose quote never closed */
/** @typedef {ReadCell | UnreadCell | OpenCell} RecordCell */

/** One field's text, or why it has none. `field` is as the walk made it: byte-transport code units for an ASCII-grid
 *  encoding, else decoded text; `enc` is the encoding of the window the record ended in. A field the walk cut at 1 MiB
 *  (`cut`) may end inside a character: that character is dropped, the rest is the value.
 *  @param {string} field
 *  @param {CsvParts} parts
 *  @param {string | null} enc
 *  @param {boolean} cut
 *  @returns {FieldRead} */
function fieldValue(field, parts, enc, cut) {
  if (!parts.transport) {
    return parts.invalidUtf16 && field.includes("�") ? { why: "invalid_utf16" } : { value: field };
  }
  if (asciiClean(field)) return { value: field };
  if (enc == null) return { why: "encoding_undetermined" };
  /* us-ascii, decided over a window: a byte >= 0x80 is not us-ascii and names no character this reading can state. */
  if (enc === "us-ascii") return { why: "not_us_ascii" };
  const bytes = untransport(field);
  if (enc === "utf-8") {
    for (let drop = 0; drop <= (cut ? 3 : 0); drop++) {
      try { return { value: UTF8_FATAL.decode(drop ? bytes.subarray(0, bytes.length - drop) : bytes) }; } catch { /* try shorter */ }
    }
    return { why: "invalid_utf8" };
  }
  try { return { value: legacyDecoder(enc).decode(bytes) }; } catch { return { why: "encoding_undetermined" }; }
}

/** The cells one record holds, in column order (R5, R8, R22, R23): `{col, value}` for a field with a value, `{col, value:
 *  null, why}` for one the encoding could not read or whose quote never closed, `over` the length of a field past the
 *  cell bound. An empty field is a measured emptiness and has no entry.
 *  @param {string[]} record
 *  @param {RecordInfo | null} info
 *  @param {CsvParts} parts
 *  @param {string | null} enc
 *  @returns {RecordCell[]} */
function readRecord(record, info, parts, enc) {
  /** @type {RecordCell[]} */
  const out = [];
  const overs = info?.over;
  for (let c0 = 0; c0 < record.length; c0++) {
    const raw = record[c0] ?? "";
    if (raw === "") continue;
    const col = c0 + 1;
    const ov = overs ? overs.find((o) => o[0] === col) : null;
    const cut = !!ov && ov[1] > raw.length;
    const read = fieldValue(raw, parts, enc, cut);
    if ("why" in read) out.push({ col, value: null, why: read.why });
    else {
      /** @type {ReadCell} */
      const e = { col, value: read.value };
      if (read.value.length > CELL_CHARS_MAX) e.over = cut && ov ? ov[1] : read.value.length;
      out.push(e);
    }
  }
  const open = info?.open;
  if (open) out.push({ col: open.col, value: null, why: "unterminated_quote", open });
  return out;
}

/** @type {Set<string>} */
const REPLACED_REASONS = new Set(["encoding_undetermined", "not_us_ascii", "invalid_utf8", "invalid_utf16"]);

/** @param {PartsResult | null | undefined} parts @param {TextOptions | undefined} opts @returns {Promise<TextResult>} */
async function csvText(parts, opts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "csv", reason: parts?.why ?? "PARTS_ABSENT" };
  }
  const dialect = dialectOf(parts);
  /** @type {{ok: true, container: "csv", images: never[], metadata: null, active: never[], dialect: Dialect}} */
  const base = {
    ok: true, container: "csv",
    /* Exhaustive and EMPTY, not null: the format has no media container to
       have looked in, so this is a zero of the format and not of a walk. */
    images: [],
    /* R31: the format carries no metadata part, so none is stated. */
    metadata: null,
    /* R32: nothing in a csv can act when it is opened — the format's zero. */
    active: [],
    dialect,
  };

  const guard = parts.guard;
  if (guard) {
    /* Over a bound: the marker carried VERBATIM (the docx/xlsx pattern),
       never a silent truncation. The dialect still stands — it was taken from
       the head, which is under any bound. */
    return {
      ...base, document: null, sheets: [],
      undetermined: [guard],
      counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1 },
    };
  }

  /* The unreadable cells a sheet lists are the first CSV_STREAMED_UNDETERMINED_MAX; `counts.undetermined` is the whole
     count and `cellsIn` gives the address of any (R9, G129f). */
  /** @type {UndeterminedCell[]} */
  const undetermined = [];
  let undeterminedCount = 0, replaced = 0;
  /** @param {UndeterminedCell} entry */
  const note = (entry) => {
    undeterminedCount++;
    if (REPLACED_REASONS.has(entry.reason)) replaced++;
    if (undetermined.length < CSV_STREAMED_UNDETERMINED_MAX) undetermined.push(entry);
  };
  /* The sheet's lines, joined a chunk at a time: a line is a string of its own, so holding all of a large body's lines at
     once is about a quarter again its size beside the text they make; a chunk's lines are garbage once it is joined. */
  /** @type {string[]} */
  const chunks = [];
  /** @type {string[]} */
  let lines = [];
  /* One 1-based row number per line of the sheet's text (`lineRows`, G15, K4579): empty records add no line, and a
     quoted line break makes one record several lines, so a line's index is not its row. Same length as the lines
     of `text`, on the whole-file and the streamed path alike. */
  /** @type {number[]} */
  const lineRows = [];
  /* R30: one typed cell per field holding a value — every csv field is
     `text`, the format declaring no type (`declared` null), and a field the
     encoding cannot read keeps its entry with a null value. G41 (K4636, K4642): a caller that passes
     `{inlineCellsMax}` (bytes) gets the cells only while their JSON is under it;
     past it `cells` is null and `cells_held` true, the walk goes on for the text,
     the rows and the counts, and `cellsIn` makes the cells of a range from the
     held body. A caller that passes nothing gets every cell, as before. */
  const inlineCellsMax = opts?.inlineCellsMax;
  const inlineMax = typeof inlineCellsMax === "number" && Number.isFinite(inlineCellsMax) && inlineCellsMax >= 0 ? inlineCellsMax : null;
  /** @type {{cells: TypedCell[] | null, held: boolean, bytes: number}} the cells listed so far, whether they are held, their JSON's bytes */
  const listing = { cells: [], held: false, bytes: 2 };   // "[]"
  /** @param {number} row @param {number} col @param {string | null} value */
  const listCell = (row, col, value) => {
    const cells = listing.cells;
    if (!cells) return;
    const cell = typedCell(row, col, value);
    cells.push(cell);
    if (inlineMax == null) return;
    listing.bytes += (cells.length > 1 ? 1 : 0) + utf8Length(JSON.stringify(cell));
    if (listing.bytes > inlineMax) { listing.cells = null; listing.held = true; }
  };
  let cellCount = 0, usedRows = 0, usedCols = 0;
  const unit = parts.utf16 ? 2 : 1;

  let r0 = 0;
  /** @type {RecordVisitor} */
  const addRecord = (record, info, window) => {
    /* ROW 1 IS ROW 1 (BOB #32). No header is consumed, skipped or renamed:
       whether record 1 names the columns is a READING, and this entry makes
       no readings. 1-BASED, because A1 notation is. */
    const row = ++r0;
    /** @type {string[]} */
    const vals = [];
    let last = -1;
    for (const e of readRecord(record, info, parts, window.readEnc)) {
      const cell = `${columnLetters(e.col)}${row}`;
      if (row > usedRows) usedRows = row;
      if (e.col > usedCols) usedCols = e.col;
      if ("why" in e) {
        /* The grid survives an encoding that cannot read these bytes; these
           characters do not. Named per cell with its own reference, never
           mojibake. */
        note(e.why === "unterminated_quote"
          ? { sheet: 0, cell, reason: e.why, row, bytes: e.open.chars * unit }
          : { sheet: 0, cell, reason: e.why });
        listCell(row, e.col, null);
        continue;
      }
      cellCount++;
      listCell(row, e.col, e.value);
      vals[e.col - 1] = e.value;
      last = e.col - 1;
      const over = e.over;
      if (over != null) note({ sheet: 0, cell, reason: "over_cell_bound", length: over });
    }
    /* TAB-joined, which is what `xlsxText` and `odf.mjs` emit for a sheet's row: one text stream shape across every
       spreadsheet container, so a consumer does not learn three. An empty field keeps its column (G131d): the line has a
       slot for every column up to the row's last value. */
    if (last >= 0) {
      let line = "";
      for (let c = 0; c <= last; c++) line += (c ? "\t" : "") + (vals[c] ?? "");
      lines.push(line);
      if (lines.length >= CSV_TEXT_CHUNK_LINES) { chunks.push(lines.join("\n")); lines = []; }
      /* a value with a line break in it (a quoted field) is several lines of the text, all of this record's row */
      for (let n = 1 + countLineBreaks(line); n > 0; n--) lineRows.push(row);
    }
  };
  await forEachRecord(parts, addRecord, undefined, opts?.yieldNow);

  if (lines.length) chunks.push(lines.join("\n"));
  const only = chunks.length === 1 ? chunks[0] : undefined;
  const text = only ?? chunks.join("\n");
  const cells = listing.cells;
  const cellsHeld = listing.held;
  /* THE BOUND IS NULL — `.ods`'s reason exactly: RFC 4180 fixes no maximum
     number of rows or columns, so a CSV has no capacity to state, and
     borrowing OOXML's grid would be this reader inventing a bound the
     format never fixed. The USED range is measured and emitted beside it. */
  const range = usedSheetRange(CSV_SHEET_NAME, usedRows, usedCols);
  /** @type {TextSheet} */
  const sheet = cellsHeld
    ? { sheet: 0, name: CSV_SHEET_NAME, hidden: false, rows: null, cols: null, usedRows, usedCols, range,
      text, lineRows, cells, cells_held: true, undetermined }
    : { sheet: 0, name: CSV_SHEET_NAME, hidden: false, rows: null, cols: null, usedRows, usedCols, range,
      text, lineRows, cells, undetermined };
  return {
    ...base,
    document: text,
    sheets: [sheet],
    undetermined,
    counts: { chars: text.length, cells: cellCount, formulas: 0, undetermined: undeterminedCount, replaced },
  };
}

/** One typed cell (R8): every csv field is `text`, the format declaring no type.
 *  @param {number} row
 *  @param {number} col
 *  @param {string | null} value
 *  @returns {TypedCell} */
function typedCell(row, col, value) {
  return { source: csvCellRef(row, col), value, type: "text", declared: null, cached: null, formula: null };
}

/** `cellsIn` (G41, K4636; R18, G131e): the typed cells of the rows `fromRow..toRow` (1-based, the record's number as `cells`
 *  and `usedRows` count it) and columns `fromCol..toCol`, made from the held body, identical to what `text()` lists for them
 *  (`typedCell` is the one builder; an unreadable field is a cell with a null value). The walk starts at the access point
 *  the whole read left before `fromRow`, so the bytes it reads are bounded by the rows asked for and one window, not by the
 *  offset. It stops after `toRow`; with `maxCells` it stops before the row that would pass it, whole rows only (a first row
 *  alone over `maxCells` is given whole, so every call advances), and `next_row` names that row. Never throws.
 *  @param {PartsOrBytes} partsOrBytes
 *  @param {CellsQuery | undefined} query
 *  @returns {Promise<CellsResult>} */
async function csvCellsIn(partsOrBytes, query) {
  /* parts() output is an object that is not bytes and has `ok`; anything else is read as bytes */
  const parts = !partsOrBytes || typeof partsOrBytes !== "object" || partsOrBytes instanceof ArrayBuffer
    || ArrayBuffer.isView(partsOrBytes) || !("ok" in partsOrBytes)
    ? await csvParts(partsOrBytes, query) : partsOrBytes;
  if (!parts.ok) return { ok: false, why: parts.why };
  /** @type {CellsQuery} */
  const q = query ?? {};
  const sheet = q.sheet;
  if (!(sheet == null || sheet === 0 || sheet === CSV_SHEET_NAME)) return { ok: false, why: "no_such_sheet" };
  /** @param {number} n @param {number} min @returns {boolean} */
  const whole = (n, min) => Number.isInteger(n) && n >= min;
  const fromRow = q.fromRow ?? 1, fromCol = q.fromCol ?? 1;
  const toRow = q.toRow ?? Infinity, toCol = q.toCol ?? Infinity;
  const maxCells = q.maxCells ?? Infinity;
  if (!whole(fromRow, 1) || !whole(fromCol, 1) || !(toRow === Infinity || whole(toRow, fromRow))
    || !(toCol === Infinity || whole(toCol, fromCol)) || !(maxCells === Infinity || whole(maxCells, 1))) {
    return { ok: false, why: "bad_range" };
  }
  const guard = parts.guard;
  if (guard) return { ...guard };

  /** @type {AccessPoint | null} */
  let point = null;
  if (!parts.records) for (const ap of parts.accessPoints) { if (ap.row < fromRow) point = ap; else break; }
  const from = point;

  /** @type {TypedCell[]} */
  const cells = [];
  /** @type {{next: number | null}} the row the walk stopped before, when `maxCells` stopped it */
  const stop = { next: null };
  let row = from ? from.row : 0, done = false;
  await forEachRecord(parts, (record, info, window) => {
    if (done) return;
    row++;
    if (row < fromRow) return;
    if (row > toRow) { done = true; return; }
    /** @type {TypedCell[]} */
    const rowCells = [];
    for (const e of readRecord(record, info, parts, window.readEnc)) {
      if (e.col >= fromCol && e.col <= toCol) rowCells.push(typedCell(row, e.col, e.value));
    }
    if (cells.length > 0 && cells.length + rowCells.length > maxCells) { stop.next = row; done = true; return; }
    for (const cell of rowCells) cells.push(cell);
    if (row >= toRow) done = true;
  }, () => done, undefined, from);
  const nextRow = stop.next;
  const to = nextRow != null ? nextRow - 1 : Math.min(toRow, row);
  return { ok: true, cells, rows: { from: fromRow, to }, ...(nextRow != null ? { next_row: nextRow } : {}) };
}

/** The `sheet-cell` reference for a 1-based row and column of THE one sheet.
 *  Built on this module's `sheetCellRef` (R10) rather than a fourth copy of
 *  two lines (COFF-10's rule).
 *  @param {number} row
 *  @param {number} col
 *  @returns {SheetCellRef} */
export function csvCellRef(row, col) {
  return sheetCellRef(CSV_SHEET_NAME, `${columnLetters(col)}${row}`);
}

/* ------------------------------------------------------------------ *
 * isDelimitedText (R21, G130b): the one judgement of whether bytes are a CSV or TSV
 * ------------------------------------------------------------------ */

/** @type {Set<string>} */
const DELIMITED_TYPES = new Set([CSV_CONTENT_TYPE, ...CSV_CONTENT_TYPE_SYNONYMS, TSV_CONTENT_TYPE, "text/plain", "application/vnd.ms-excel", "application/octet-stream"]);
const DELIMITED_EXTENSIONS = [".csv", ".tsv", ".tab", ".txt"];
const HEAD_MAX_BYTES = 1 << 20;
/** @type {ReadonlyArray<readonly number[]>} */
const BINARY_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08],           // ZIP (and every OOXML / ODF file)
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],                                       // OLE compound file (.xls)
  [0x25, 0x50, 0x44, 0x46, 0x2d],                                                         // PDF
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0xff, 0xd8, 0xff], [0x47, 0x49, 0x46, 0x38],   // PNG, JPEG, GIF
  [0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a], [0x1f, 0x8b, 0x08],                 // TIFF, gzip
];
/** @param {Uint8Array} h @returns {boolean} */
const hasBinarySignature = (h) => BINARY_SIGNATURES.some((sig) => h.length >= sig.length && sig.every((v, i) => h[i] === v))
  || (h.length >= 12 && h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 && h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50);   // WebP

/** R26: a file declared plain text (type `text/plain` or a `.txt` name) that no declared CSV or TSV (its type, or a `.csv`/`.tsv`
 *  name) overrides: its delimiter must repeat with one count on the majority of its lines, not merely appear on them.
 *  @param {string} lowerName
 *  @param {string} type
 *  @returns {boolean} */
function isDeclaredPlainText(lowerName, type) {
  const t = (type.split(";")[0] ?? "").trim().toLowerCase();
  if (t === CSV_CONTENT_TYPE || CSV_CONTENT_TYPE_SYNONYMS.includes(t) || t === TSV_CONTENT_TYPE) return false;
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) return false;
  return t === "text/plain" || lowerName.endsWith(".txt");
}

const PLAIN_TEXT_RECORDS_MIN = 5;
const PLAIN_TEXT_FIELD_CHARS_MAX = 40;

/** R27: beyond R26, declared plain text is a table only with at least five records whose fields average under 40 characters
 *  (prose lines with equal comma counts are neither). `s` is the dialect scan of `h`, whose delimiter is decided.
 *  @param {Uint8Array} h
 *  @param {DialectScan} s
 *  @returns {boolean} */
function looksTabular(h, s) {
  if (s.delimiter.lines < PLAIN_TEXT_RECORDS_MIN) return false;
  const text = new TextDecoder(s.utf16 || "utf-8").decode(h);
  let chars = 0, fields = 0;
  for (const record of walkRecords(text, s.delimiter.delimiter)) {
    for (const f of record) { chars += f.length; fields++; }
  }
  return fields > 0 && chars / fields < PLAIN_TEXT_FIELD_CHARS_MAX;
}

/** True exactly when `type` names a CSV, TSV or plain or opaque type, `name` ends in `.csv`, `.tsv`, `.tab` or `.txt`, and
 *  `head` (the first bytes of the file, up to 1 MiB) is delimited text: no binary signature, no NUL in an 8-bit head, an
 *  encoding R7 reads and one consistent delimiter. Never throws.
 *  @param {string} name
 *  @param {string} type
 *  @param {BytesView | null | undefined} head
 *  @returns {boolean} */
export function isDelimitedText(name, type, head) {
  try {
    if (typeof name !== "string" || typeof type !== "string") return false;
    if (!DELIMITED_TYPES.has((type.split(";")[0] ?? "").trim().toLowerCase())) return false;
    const lower = name.trim().toLowerCase();
    if (!DELIMITED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
    if (!(head instanceof ArrayBuffer || ArrayBuffer.isView(head))) return false;
    let h = toBytes(head);
    if (!h.length) return false;
    if (h.length > HEAD_MAX_BYTES) h = h.subarray(0, HEAD_MAX_BYTES);
    if (hasBinarySignature(h)) return false;
    const s = scanDialect(h, undefined);
    if (!s.ok || s.encoding.encoding == null || s.delimiter.delimiter == null) return false;
    /* a decided delimiter always has its modal count; an absent one would compare false either way */
    if (isDeclaredPlainText(lower, type) && !((s.delimiter.modalLines ?? 0) * 2 > s.delimiter.records && looksTabular(h, s))) return false;
    if (!s.utf16 && s.windows.some((w) => (w.scan?.nul ?? 0) > 0)) return false;
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * The I7 entry (registered by formats.mjs — one registerFormat call there
 * and nothing anywhere else; that is the D-70 property)
 * ------------------------------------------------------------------ */

/** @type {CsvEntry} the entry formats.mjs registers */
export const csvEntry = {
  format: "csv",
  detect(bytes, contentType) {
    /* BYTES NEVER ANSWER — header §1, measured both ways. This is not a
       missing branch; it is the finding. */
    if (bytes != null) return null;
    if (typeof contentType !== "string") return null;
    const ct = contentType.trim().toLowerCase();
    if (ct === CSV_CONTENT_TYPE) {
      return { format: "csv", confidence: "likely", signals: [
        `content type "${contentType}"`,
        localize("office-readers.csv.likely_not_certain_a_declared_type_is_a_claim", "likely, not certain: a declared type is a claim, and a csv has no magic bytes to check it against"),
        "measured: 166 of 166 .csv keys in s3://cao-94612 were served this type exactly (M-144)",
      ] };
    }
    if (ct === TSV_CONTENT_TYPE) {
      return { format: "csv", confidence: "likely", signals: [
        `content type "${contentType}"`,
        localize("office-readers.csv.a_tab_separated_file_is_read_by_this_entry", "a tab-separated file is read by this entry; its delimiter is decided from the bytes"),
      ] };
    }
    if (CSV_CONTENT_TYPE_SYNONYMS.includes(ct)) {
      return { format: "csv", confidence: "likely", signals: [
        `content type "${contentType}"`,
        `an older spelling of ${CSV_CONTENT_TYPE}; UNMEASURED in s3://cao-94612, where all 166 keys declared ${CSV_CONTENT_TYPE}`,
      ] };
    }
    return null;
  },
  /* `opts.windowBytes` (a scaled window, for tests) and `opts.declared` (a legacy charset the source declared) are the
     optional second argument; the registry passes none. */
  parts: (bytes, opts) => csvParts(bytes, opts),
  /* REC-218 — the registry's OPTIONAL `dialect` slot: the decoding choice this
     entry makes over these bytes, from the signatures alone (no record walk),
     in `dialectOf`'s shape; null when the body has no signature to take (empty,
     or a decoder the runtime lacks — the same refusals `parts()` states). */
  dialect: (bytes, opts) => {
    const s = scanDialect(toBytes(bytes), opts);
    return s.ok ? dialectOf(s) : null;
  },
  /* Accept either parts() output or raw bytes, exactly as the office entries
     do, so detect->structure works uniformly at the registry seam while a
     caller that already paid for parts() does not pay twice. */
  structure: async (partsOrBytes, opts) => {
    const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes)
      ? await csvParts(partsOrBytes, opts)
      : partsOrBytes;
    return csvStructure(parts);
  },
  /* `opts.inlineCellsMax` (bytes; R17) is the caller's opt-in to holding the
     sheet's cells back: without it every cell is listed, as before. `opts.yieldNow` (R20) is awaited between the
     1 MiB windows of a long read, and changes nothing in the answer. */
  text: async (partsOrBytes, opts) => {
    const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes)
      ? await csvParts(partsOrBytes, opts)
      : partsOrBytes;
    return await csvText(parts, opts);
  },
  /* G41 (R18): the OPTIONAL `cellsIn` slot, as `dialect` is one: the typed cells
     of a range, made from the held body when a member opens or cites it. */
  cellsIn: (partsOrBytes, query) => csvCellsIn(partsOrBytes, query),
};
