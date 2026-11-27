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
/** @import { ScanHandler, PartialNote, PartFailure, ObjectsExceeded, AddressedUnit, TextUnit } from "./office-xml.mjs" */
/** @import { ActiveItem, Link, LinkCounts, UrlTarget, IntraTarget, CorePropertiesItem, ActiveCarried, MetadataCarried, DetectAnswer, ReadFailure, ReadOptions, BytesInput, Undetermined, FailureBody } from "./docx.mjs" */

/* ------------------------------------------------------------------ *
 * The shapes this entry answers
 * ------------------------------------------------------------------ */

/** @typedef {"date" | "time"} DateKind what a number format makes a cell (R30) */
/**
 * What a workbook's styles say about its cells (R30): `kindOf` takes a cell's style index as written.
 * @typedef {Object} Dates
 * @property {boolean} is1904
 * @property {(style: string | null) => DateKind | null} kindOf
 */
/** @typedef {"visible" | "hidden" | "veryHidden"} SheetState a sheet's state as workbook.xml writes it */
/** @typedef {false | "hidden" | "veryHidden"} SheetHidden false for a visible sheet, else its state */
/**
 * One A1 corner (R26), both 1-based.
 * @typedef {Object} Corner
 * @property {number} col
 * @property {number} row
 */
/**
 * A format's grid (R27).
 * @typedef {Object} Grid
 * @property {number} rows
 * @property {number} cols
 */
/**
 * A rectangle made a unit (R27): `unit` csv-reader's `sheetRangeRef` (csv-reader states no kind for it yet).
 * @typedef {Object} RangeUnitMade
 * @property {any} unit
 */
/**
 * Why a rectangle or a name is not a unit (R9, R27).
 * @typedef {Object} RangeUnitRefused
 * @property {string} why
 */
/** @typedef {RangeUnitMade | RangeUnitRefused} RangeUnitResult what `rangeUnitFor` answers (R27) */
/**
 * A defined name or a table as a `sheet-range` unit (R9): `unit` csv-reader's `sheetRangeRef` (csv-reader states no
 * kind for it yet).
 * @typedef {Object} RangeUnit
 * @property {"defined-name" | "table"} source
 * @property {string | null} name
 * @property {string | null} scope the sheet it belongs to, null for a workbook-scoped name
 * @property {boolean} hidden
 * @property {any} unit
 */
/**
 * A defined name skipped, with its reason (R9).
 * @typedef {Object} NameSkipped
 * @property {"defined-name"} source
 * @property {string} name
 * @property {string} ref
 * @property {string} why
 */
/**
 * A table skipped, with its reason (R9).
 * @typedef {Object} TableSkipped
 * @property {"table"} source
 * @property {string | null} name
 * @property {string | null} ref
 * @property {string} part
 * @property {string} why
 */
/** @typedef {NameSkipped | TableSkipped} RangeUnitSkipped a name or table that is not a unit (R9) */
/**
 * R9's units and skips.
 * @typedef {Object} RangeUnits
 * @property {RangeUnit[]} rangeUnits
 * @property {RangeUnitSkipped[]} rangeUnitsSkipped
 */
/**
 * One sheet as `parts()` reads it from workbook.xml: `xml` its text when read whole, `pieces` when it is walked in
 * pieces (R35); `rels` its own `.rels` reading (ooxml `walkRels`' by-part reading; ooxml states no kind for it yet).
 * @typedef {Object} XlsxSheet
 * @property {number} index
 * @property {string} name
 * @property {string | null} sheetId
 * @property {SheetState} state
 * @property {SheetHidden} hidden
 * @property {string | null} part
 * @property {string | null} xml
 * @property {string | null} why
 * @property {any} [rels]
 * @property {true} [pieces]
 */
/**
 * A defined name of workbook.xml (R9).
 * @typedef {Object} DefinedName
 * @property {string} name
 * @property {string} ref
 * @property {number | null} localSheetId
 * @property {boolean} hidden
 */
/**
 * A table part reached through a sheet's rels (R9), or why it could not be read.
 * @typedef {Object} TablePart
 * @property {string} sheet
 * @property {string} part
 * @property {string | null} name
 * @property {string | null} ref
 * @property {string | null} why
 */
/**
 * A block of a sheet's rows (R37): where it is and the rows it holds.
 * @typedef {Object} AccessBlock
 * @property {number} start
 * @property {number | null} end
 * @property {number} min
 * @property {number} max
 * @property {boolean} ordered
 * @property {number} prev
 * @property {number} before the row before the block's first
 */
/**
 * A block of a sheet read in pieces (R37), kept deflated.
 * @typedef {Object} PieceBlock
 * @property {number} start
 * @property {number | null} end
 * @property {number} min
 * @property {number} max
 * @property {boolean} ordered
 * @property {number} prev
 * @property {number} before
 * @property {Promise<Uint8Array> | Uint8Array | null} data
 * @property {number} length
 */
/**
 * A sheet held whole's access points (R37): offsets into its text.
 * @typedef {Object} OffsetAccess
 * @property {"offsets"} kind
 * @property {AccessBlock[]} blocks
 * @property {number} length
 */
/**
 * A sheet read in pieces' access points (R37): each piece, deflated.
 * @typedef {Object} PieceAccess
 * @property {"pieces"} kind
 * @property {PieceBlock[]} blocks
 * @property {number} length
 */
/** @typedef {OffsetAccess | PieceAccess} SheetAccess where a sheet's rows are (R37) */
/**
 * What leaves a sheet held whole's access points as the walk meets its rows.
 * @typedef {Object} OffsetRecorder
 * @property {(at: number, r: number) => void} row
 * @property {(length: number) => Promise<OffsetAccess>} finish
 */
/**
 * What leaves a sheet read in pieces' access points as the walk meets its rows and pieces.
 * @typedef {Object} PieceRecorder
 * @property {(at: number, r: number) => void} row
 * @property {(text: string) => Promise<Uint8Array> | undefined} piece
 * @property {() => Promise<PieceAccess>} finish
 */
/** @typedef {OffsetRecorder | PieceRecorder} AccessRecorder */
/**
 * A shared formula's master (R47).
 * @typedef {Object} SharedMaster
 * @property {string} formula
 * @property {number} row
 * @property {number} col
 */
/**
 * What `parts()` reads, once, for `structure()`, `text()` and `cellsIn()`.
 * @typedef {Object} XlsxParts
 * @property {true} ok
 * @property {"xlsx"} format
 * @property {any} variant R33's macro-enabled flavour, from ooxml `discriminate` (ooxml states no kind for it yet)
 * @property {Uint8Array} bytes
 * @property {any} container ooxml `readContainer`'s answer (ooxml states no kind for it yet)
 * @property {boolean} date1904
 * @property {Dates | null} dates
 * @property {XlsxSheet[]} sheets
 * @property {DefinedName[]} definedNames
 * @property {TablePart[]} tables
 * @property {any} rels ooxml `walkRels`' answer (ooxml states no kind for it yet)
 * @property {string[] | null} sharedStrings
 * @property {any} core ooxml `readCoreProperties`' answer, or null (ooxml states no kind for it yet)
 * @property {ActiveItem[]} active
 * @property {any} declared ooxml `declaredTextBytes`' answer (ooxml states no kind for it yet)
 * @property {any} guard ooxml `textPlan`'s marker, or null
 * @property {any} piecewise ooxml `textPlan`'s statement, or null
 * @property {PartialNote[]} partials
 * @property {XlsxPartsUndetermined[]} undetermined
 * @property {Map<string, SheetAccess | undefined>} access by sheet part (R37); undefined where a walk left none
 * @property {Map<string, Map<string, SharedMaster>>} shared each sheet part's shared-formula masters (R47)
 */
/**
 * `parts()` when the bytes are not a readable XLSX: `signals` ooxml `discriminate`'s (ooxml states no kind for them yet).
 * @typedef {Object} XlsxPartsFailure
 * @property {false} ok
 * @property {string} why
 * @property {any} [signals]
 */
/** @typedef {XlsxParts | XlsxPartsFailure} XlsxPartsResult */
/**
 * One cell as the sheet walk meets it, its attributes and children as written.
 * @typedef {Object} WalkedCell
 * @property {string} cell
 * @property {string | null} t
 * @property {string | null} s
 * @property {string | null} f
 * @property {string | null} v
 * @property {string | null} is
 * @property {string | null} shared the shared formula's index (R47)
 * @property {number} row
 * @property {number} col
 */
/**
 * One row as the sheet walk meets it.
 * @typedef {Object} WalkedRow
 * @property {number} r
 * @property {boolean} hidden
 * @property {WalkedCell[]} cells
 */
/**
 * A walk's control (R44): `stopped` ends the scan; `exceeded` the bound it went past.
 * @typedef {Object} WalkControl
 * @property {boolean} stopped
 * @property {ObjectsExceeded | null} [exceeded]
 */
/**
 * A run of hidden columns (R10).
 * @typedef {Object} HiddenCols
 * @property {number} min
 * @property {number} max
 */
/**
 * A `<hyperlink>` of a sheet (R7).
 * @typedef {Object} SheetHyperlink
 * @property {string | null} cell
 * @property {string | null} relId
 * @property {string | null} location
 * @property {string | null} display
 */
/**
 * A sheet walk's totals.
 * @typedef {Object} SheetTotals
 * @property {number[]} hiddenRows
 * @property {HiddenCols[]} hiddenCols
 * @property {SheetHyperlink[]} hyperlinks
 * @property {string[]} merges
 * @property {number} usedRows
 * @property {number} usedCols
 */
/**
 * A sheet walked to its end, or as far as a bound let it run.
 * @typedef {Object} SheetWalked
 * @property {number[]} hiddenRows
 * @property {HiddenCols[]} hiddenCols
 * @property {SheetHyperlink[]} hyperlinks
 * @property {string[]} merges
 * @property {number} usedRows
 * @property {number} usedCols
 * @property {Scanner | undefined} scanner
 */
/**
 * A sheet that could not be read to its end.
 * @typedef {Object} SheetFailed
 * @property {FailureBody} failed
 */
/**
 * How a sheet's walk runs.
 * @typedef {Object} SheetHandlerOptions
 * @property {boolean} [rowsOnly]
 * @property {WalkControl} [ctl]
 * @property {AccessRecorder | null} [access]
 * @property {number} [retainedMax]
 * @property {Map<string, SharedMaster>} [shared]
 * @property {number} [startRow]
 */
/**
 * How `walkSheetPart` walks.
 * @typedef {Object} WalkOptions
 * @property {unknown} [yieldNow] a `YieldNow`; anything else is no yield
 * @property {WalkControl} [ctl]
 * @property {AccessRecorder | null} [access]
 */
/**
 * One cell's displayed value (R11), or why it has none.
 * @typedef {{value: string | null} | {undetermined: string}} CellValue
 */
/** @typedef {"number" | "text" | "boolean" | "date" | "error"} CellType a cell's type (R30) */
/**
 * One typed cell (R30, R36, R37): `source` csv-reader's `sheetCellRef` (csv-reader states no kind for it yet), null
 * with no readable address; `value` the lexical value as stored, the ISO date for a date; `serial` the stored number
 * beside a date.
 * @typedef {Object} TypedCell
 * @property {any} source
 * @property {string | null} value
 * @property {CellType | null} type
 * @property {string | null} declared
 * @property {string | null} cached
 * @property {string | null} formula
 * @property {string | null} [serial]
 */
/**
 * A typed cell and why it is not wholly determined.
 * @typedef {Object} TypedCellRead
 * @property {TypedCell} cell
 * @property {string | null} why
 */
/**
 * A typed cell with the address it was written at.
 * @typedef {Object} TypedEntry
 * @property {string} ref
 * @property {TypedCell} cell
 */
/**
 * A cell of a sheet, or a sheet, not read, and why (R11, R30, R47).
 * @typedef {Object} CellStatement
 * @property {number} sheet
 * @property {string | null} cell
 * @property {string} reason
 */
/**
 * A sheet not read to its end (R40), with its part's further figures where it states them.
 * @typedef {Object} SheetStatement
 * @property {number} sheet
 * @property {null} cell
 * @property {string} reason
 * @property {number} [size]
 * @property {boolean} [final]
 * @property {string} [name]
 * @property {string} [detail]
 */
/**
 * A part's refusal's figures besides its reason.
 * @typedef {Object} FailureRest
 * @property {number} [size]
 * @property {boolean} [final]
 * @property {string} [name]
 * @property {string} [detail]
 */
/**
 * A sheet whose cells reach past the grid (R48).
 * @typedef {Object} OutsideGridStatement
 * @property {number} sheet
 * @property {null} cell
 * @property {"outside_grid"} reason
 * @property {number} usedRows
 * @property {number} usedCols
 */
/**
 * A cell covered by a merge (R47).
 * @typedef {Object} CoveredStatement
 * @property {number} sheet
 * @property {string} cell
 * @property {"covered_by_merge"} reason
 * @property {string} range
 */
/**
 * A sheet wider than the format's columns (R49).
 * @typedef {Object} ColumnsOverStatement
 * @property {string} part
 * @property {"over_size_bound"} why
 * @property {number} size
 * @property {number} bound
 * @property {"SHEET_COLUMNS_MAX"} boundName
 * @property {"columns"} metric
 * @property {true} final
 * @property {string} statement
 */
/**
 * A sheet whose part is not resolved (R22): `why` null when its relationship is external.
 * @typedef {Object} SheetUnresolvedStatement
 * @property {string} part
 * @property {string | null} why
 */
/** @typedef {Undetermined | SheetUnresolvedStatement} XlsxPartsUndetermined what `parts()` states it did not read */
/**
 * What `structure()` and `text()` state they did not read (R11, R12, R30, R35, R38-R49).
 * @typedef {XlsxPartsUndetermined | CellStatement | SheetStatement | OutsideGridStatement | CoveredStatement
 *   | ColumnsOverStatement} XlsxUndetermined
 */
/**
 * One sheet of `text()` (R11, R30): `rows`/`cols` the grid, `usedRows`/`usedCols` how far its cells reach (null when
 * not walked); `range` csv-reader's `usedSheetRange` (csv-reader states no kind for it yet); `cells` null read in
 * pieces or held (G41).
 * @typedef {Object} XlsxSheetText
 * @property {number} sheet
 * @property {string} name
 * @property {SheetHidden} hidden
 * @property {number} rows
 * @property {number} cols
 * @property {number | null} usedRows
 * @property {number | null} usedCols
 * @property {any} range
 * @property {string} text
 * @property {number[]} [lineRows]
 * @property {TypedCell[] | null} cells
 * @property {string[]} [merges]
 * @property {XlsxUndetermined[]} undetermined
 * @property {true} [cells_held]
 */
/**
 * `text()`'s counts.
 * @typedef {Object} XlsxTextCounts
 * @property {number} chars
 * @property {number} cells
 * @property {number} formulas
 * @property {number} undetermined
 * @property {number} scanned_bytes
 */
/**
 * `text()`'s answer before `metadata`, `active` and `images` are carried onto it (R11, R9, R35, R38): `parts` the
 * notes on cells, anchored by csv-reader's `sheetCellRef` (csv-reader states no kind for it yet); `piecewise` ooxml
 * `textPlan`'s statement (ooxml states no kind for it yet).
 * @typedef {Object} XlsxTextBody
 * @property {true} ok
 * @property {"xlsx"} container
 * @property {string | null} document
 * @property {XlsxSheetText[]} sheets
 * @property {AddressedUnit<any>[]} [parts]
 * @property {RangeUnit[]} rangeUnits
 * @property {RangeUnitSkipped[]} rangeUnitsSkipped
 * @property {XlsxUndetermined[]} undetermined
 * @property {XlsxTextCounts} counts
 * @property {any} [piecewise]
 */
/**
 * `text()`'s answer (R11, R31, R32, R33): `images` ooxml's `withContainerImages` list (ooxml states no kind for it yet).
 * @typedef {XlsxTextBody & MetadataCarried & ActiveCarried & {images: any}} XlsxText
 */
/**
 * A cell's formula beside its cached value (R10): `source` csv-reader's `sheetCellRef` (csv-reader states no kind for
 * it yet).
 * @typedef {Object} FormulaItem
 * @property {"formula"} kind
 * @property {any} source
 * @property {string} formula
 * @property {string | null} value
 */
/**
 * A sheet's hidden rows (R10).
 * @typedef {Object} HiddenRowsItem
 * @property {"hidden-rows"} kind
 * @property {string} sheet
 * @property {number[]} rows
 * @property {number} count
 * @property {null} source
 */
/**
 * A sheet's hidden columns (R10).
 * @typedef {Object} HiddenColsItem
 * @property {"hidden-cols"} kind
 * @property {string} sheet
 * @property {HiddenCols[]} cols
 * @property {number} count
 * @property {null} source
 */
/**
 * A hidden sheet (R10).
 * @typedef {Object} HiddenSheetItem
 * @property {"hidden-sheet"} kind
 * @property {string} sheet
 * @property {SheetState} state
 * @property {null} source
 */
/** @typedef {FormulaItem | HiddenRowsItem | HiddenColsItem | HiddenSheetItem | CorePropertiesItem} XlsxEvidentiaryItem an xlsx evidentiary item (R10) */
/**
 * The DEC-5 evidentiary envelope (R10), as docx's `Evidentiary` with xlsx's statements.
 * @typedef {Object} XlsxEvidentiary
 * @property {"xlsx"} container
 * @property {string[]} kinds
 * @property {XlsxEvidentiaryItem[]} items
 * @property {XlsxUndetermined[]} undetermined
 * @property {{[kind: string]: number}} counts items by kind
 */
/**
 * A cross-sheet hyperlink's location (R7).
 * @typedef {Object} LocationTarget
 * @property {string} location
 * @property {string} fragment
 */
/**
 * A defined name as an anchor (R7).
 * @typedef {Object} DefinedNameTarget
 * @property {string} definedName
 * @property {string} ref
 * @property {string} fragment
 */
/**
 * A reference this entry could not resolve, and why (R7): the relationship, the part or the member it names.
 * @typedef {{why: string} | {why: string, relId: string} | {why: string, relId: string, part: string}
 *   | {why: string, part: string, detail: string} | {why: string, name: string} | {why: string, name: string, limit: number}} XlsxUndeterminedTarget
 */
/** @typedef {UrlTarget | LocationTarget | DefinedNameTarget | IntraTarget | XlsxUndeterminedTarget} XlsxLinkTarget an xlsx link's target */
/**
 * One link (R7): `source` csv-reader's `sheetCellRef` (csv-reader states no kind for it yet), null for a
 * document-level fact; `note` why a cell join is unavailable.
 * @typedef {Link<XlsxLinkTarget, any> & {note?: string}} XlsxLink
 */
/**
 * One sheet of `structure()`.
 * @typedef {Object} XlsxSheetSummary
 * @property {number} sheet
 * @property {string} name
 * @property {string | null} sheetId
 * @property {SheetState} state
 * @property {SheetHidden} hidden
 */
/**
 * `structure()`'s answer (R7, R10).
 * @typedef {Object} XlsxStructure
 * @property {true} ok
 * @property {"xlsx"} container
 * @property {XlsxSheetSummary[]} sheets
 * @property {XlsxLink[]} links
 * @property {LinkCounts} counts
 * @property {XlsxEvidentiary} evidentiary
 * @property {string[]} notes
 */
/**
 * What `cellsIn()` asks for (G41): `sheet` a name or a 0-based position; rows and columns 1-based and inclusive.
 * @typedef {Object} CellsInRange
 * @property {string | number} sheet
 * @property {number} [fromRow]
 * @property {number | null} [toRow]
 * @property {number} [fromCol]
 * @property {number | null} [toCol]
 * @property {number} [maxCells]
 */
/**
 * `cellsIn()`'s arguments, read.
 * @typedef {Object} CellsInArgs
 * @property {string | number} sheet
 * @property {number} fromRow
 * @property {number} toRow
 * @property {boolean} toRowGiven
 * @property {number} fromCol
 * @property {number} toCol
 * @property {number} maxCells
 */
/**
 * An argument `cellsIn()` cannot read.
 * @typedef {Object} CellsInInvalid
 * @property {"invalid_argument"} reason
 * @property {string} argument
 */
/**
 * `cellsIn()`'s answer (G41): the cells of the rows answered, `next_row` the row left to the next call; `served` what
 * the call parsed.
 * @typedef {Object} CellsInAnswer
 * @property {true} ok
 * @property {string} sheet
 * @property {TypedCell[]} cells
 * @property {{from: number, to: number}} rows
 * @property {number} [next_row]
 * @property {CellStatement[]} undetermined
 * @property {{bytes: number, blocks: number}} served
 */
/**
 * `cellsIn()` refused, and why: the argument it could not read, the size guard's figures, or the sheet part's own
 * refusal's figures where it states them.
 * @typedef {{ok: false, reason: string} | {ok: false, reason: string, argument: string}
 *   | {ok: false, reason: string, size: number, bound: number, boundName: string, final: true} | {ok: false, reason: string, final: true}
 *   | {ok: false, reason: string, size?: number, final?: boolean, name?: string, detail?: string}} CellsInFailure
 */
/** @typedef {CellsInAnswer | CellsInFailure} CellsInResult */
/** @typedef {XlsxPartsResult | ArrayBuffer | ArrayBufferView | null | undefined} PartsOrBytes */
/**
 * The xlsx registry entry (I7).
 * @typedef {Object} XlsxEntry
 * @property {"xlsx"} format
 * @property {(bytes: unknown, contentType?: unknown) => DetectAnswer | null} detect
 * @property {(bytes: BytesInput | null | undefined) => Promise<XlsxPartsResult>} parts
 * @property {(partsOrBytes: PartsOrBytes, opts?: ReadOptions) => Promise<(XlsxStructure & ActiveCarried) | ReadFailure>} structure
 * @property {(partsOrBytes: PartsOrBytes, opts?: ReadOptions) => Promise<XlsxText | ReadFailure>} text
 * @property {(partsOrBytes: PartsOrBytes, range: unknown) => Promise<CellsInResult>} cellsIn a `range` that is not a `CellsInRange` is refused (`invalid_argument`)
 */

/* R44: what the walk may retain, cells and links together (the table's figure, never a literal here). */
/** @type {number} */
const OFFICE_RETAINED_MAX = boundOf("office", "retained_objects");
/** @param {PartFailure} failure @returns {FailureBody} */
const stripOk = ({ ok, ...rest }) => rest;

/** Bytes as a Uint8Array, an ArrayBuffer, any typed-array view or an array of
 * byte values; anything else reads as no bytes, so a wrong argument is a
 * named refusal downstream, never a throw (R21; ooxml.mjs's own policy).
 * @param {BytesInput | null | undefined} x
 * @returns {Uint8Array} */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return x == null ? new Uint8Array(0) : new Uint8Array(x); } catch { return new Uint8Array(0); }
}


/** @type {string} */
export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/* R33 (K1903): the macro-enabled flavours' package types, read as xlsx. */
/** @type {ReadonlyMap<string, string>} */
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
 *  East Asian reading guides, which are a reading aid and not the cell's text) left out.
 *  @returns {{handler: ScanHandler, strings: string[]}} */
function sharedStringsReader() {
  /** @type {string[]} */
  const strings = [];
  let inSi = false, cur = "", inT = false, rph = 0;
  /** @type {ScanHandler} */
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
/** @type {ReadonlySet<number>} */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** A custom format code's kind: `"date"` when it carries date tokens (a year, a day, a month), `"time"` when it carries
 *  only time tokens, else null. Quoted text, escaped characters, fill characters, colours and conditions are not
 *  tokens; `m` is a minute when it follows an hour or precedes a second, else a month.
 *  @param {string | null | undefined} code
 *  @returns {DateKind | null} */
function formatKind(code) {
  let f = String(code ?? "").replace(/"[^"]*"/g, "").replace(/\\./g, "").replace(/[_*]./g, "");
  /* an elapsed-time token is one the replacement below meets */
  const elapsed = /\[(h+|m+|s+)\]/i.test(f);
  f = f.replace(/\[(h+|m+|s+)\]/gi, /** @param {string} _ @param {string} t */ (_, t) => t.charAt(0).toLowerCase() === "m" ? "h" : t.charAt(0).toLowerCase());
  f = (f.replace(/\[[^\]]*\]/g, "").split(";")[0] ?? "").toLowerCase().replace(/am\/pm|a\/p/g, "");
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

/** `xl/styles.xml` as a scanner handler: the custom number formats and the cell formats (`cellXfs`) in order.
 *  @returns {{handler: ScanHandler, numFmts: Map<number, string>, xfs: number[]}} */
function stylesReader() {
  /** @type {Map<number, string>} */
  const numFmts = new Map([]);
  /** @type {number[]} */
  const xfs = [];
  let inCellXfs = false;
  /** @type {ScanHandler} */
  const handler = {
    text() {}, cdata() {},
    open(name, raw, self) {
      if (name === "numFmt") { const a = parseAttrs(raw); const id = a.numFmtId; if (id != null) numFmts.set(parseInt(id, 10), a.formatCode ?? ""); }
      else if (name === "cellXfs" && !self) inCellXfs = true;
      else if (name === "xf" && inCellXfs) { const a = parseAttrs(raw); const id = a.numFmtId; xfs.push(id != null ? parseInt(id, 10) : 0); }
    },
    close(name) { if (name === "cellXfs") inCellXfs = false; },
  };
  return { handler, numFmts, xfs };
}

/** What a workbook's styles say about its cells: `{is1904, kindOf(styleIndex) -> "date"|"time"|null}`.
 *  @param {{numFmts: Map<number, string>, xfs: number[]}} styles
 *  @param {boolean} is1904
 *  @returns {Dates} */
function datesFrom(styles, is1904) {
  /** @type {Map<number, DateKind | null>} */
  const cache = new Map([]);
  /** @param {number} id @returns {DateKind | null} */
  const kindOfId = (id) => {
    if (BUILTIN_DATE_FORMATS.has(id)) return "date";
    if (id >= 164 && styles.numFmts.has(id)) return formatKind(styles.numFmts.get(id));
    return null;
  };
  return { is1904, kindOf(style) {
    const i = style != null && /^\d+$/.test(style) ? parseInt(style, 10) : 0;
    if (!cache.has(i)) { const id = i < styles.xfs.length ? styles.xfs[i] : undefined; cache.set(i, id !== undefined ? kindOfId(id) : null); }
    return cache.get(i) ?? null;
  } };
}

const DAY_MS = 86400000;
/** @param {number} n @param {number} [w] @returns {string} */
const pad = (n, w = 2) => String(n).padStart(w, "0");
/** A stored serial as ISO 8601 under the workbook's date system, or null when its system cannot express it (a serial
 *  before day 1, the 1900 system's nonexistent 29 February 1900, a year past 9999). A time part (`THH:MM:SS`) is given
 *  when the stored number has one.
 *  @param {string | null} lexical
 *  @param {boolean} is1904
 *  @returns {string | null} */
function serialToIso(lexical, is1904) {
  if (typeof lexical !== "string" || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(lexical.trim())) return null;
  const x = Number(lexical);
  if (!Number.isFinite(x) || x < 0) return null;
  let days = Math.floor(x);
  const frac = x - days;
  let secs = Math.round(frac * 86400);
  if (secs >= 86400) { days += 1; secs -= 86400; }
  /** @type {number} */
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

/** The ISO date a cell holds when its number format makes it a date, else null.
 *  @param {WalkedCell} c
 *  @param {Dates | null} dates
 *  @returns {string | null} */
function dateOf(c, dates) {
  const v = c.v, t = c.t;
  if (!dates || !(t == null || t === "n") || v == null) return null;
  if (dates.kindOf(c.s) !== "date") return null;
  return serialToIso(v, dates.is1904);
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

/** @typedef {readonly unknown[]} AskedList a list handed in by a caller, its members not yet read */
/** @param {unknown} v @returns {v is AskedList} */
const isAskedList = (v) => Array.isArray(v);
/** A corner as `a1Corner` makes one: `col` and `row` positive integers.
 *  @param {unknown} c @returns {c is Corner} */
const isCorner = (c) => {
  if (c == null || (typeof c !== "object" && typeof c !== "function")) return false;
  const col = "col" in c ? c.col : undefined, row = "row" in c ? c.row : undefined;
  return typeof col === "number" && Number.isInteger(col) && col > 0 && typeof row === "number" && Number.isInteger(row) && row > 0;
};

/** One A1 corner (`$B$14`, `b14`) -> {col,row}, both 1-based, or null. The
 *  `$` markers are notation, not address; letters are read without case;
 *  surrounding whitespace is trimmed. Anything else — not a string, a whole
 *  row or column, a row of 0 or with a leading zero, more than three letters
 *  or seven digits — is null, never a guessed corner.
 *  @param {unknown} s
 *  @returns {Corner | null} */
export function a1Corner(s) {
  if (typeof s !== "string") return null;
  const m = /^\$?([A-Za-z]{1,3})\$?([1-9]\d{0,6})$/.exec(s.trim());
  if (!m) return null;
  const letters = m[1] ?? "", digits = m[2] ?? "";
  let col = 0;
  for (const ch of letters.toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: parseInt(digits, 10) };
}

/** A rectangle on a named sheet -> {unit} or {why}. `a`/`b` are corners as
 *  `a1Corner` returns them, in either order; `sheets` the workbook's sheet
 *  names; `grid` the format's bound `{rows, cols}`, or null when the format
 *  fixes none (`.ods`, csv). A sheet name matches exactly, else
 *  case-insensitively when exactly one sheet answers (the format resolves
 *  sheet names without case); the unit carries the WORKBOOK's spelling. Why
 *  not: `not_a_range_reference` (a corner is not one), `no_such_sheet`,
 *  `outside_grid`.
 *  @param {unknown} sheetName
 *  @param {unknown} a
 *  @param {unknown} b
 *  @param {unknown} sheets
 *  @param {Grid | null} [grid]
 *  @returns {RangeUnitResult} */
export function rangeUnitFor(sheetName, a, b, sheets, grid = null) {
  if (a == null || b == null || !isCorner(a) || !isCorner(b)) return { why: "not_a_range_reference" };
  const listed = isAskedList(sheets) ? sheets : [];
  /** @type {string[]} */
  const names = [];
  for (const s of listed) if (typeof s === "string") names.push(s);
  if (typeof sheetName !== "string") return { why: "no_such_sheet" };
  const exact = names.includes(sheetName) ? sheetName : null;
  const ci = exact == null ? names.filter((s) => s.toLowerCase() === sheetName.toLowerCase()) : [];
  const sheet = exact ?? (ci.length === 1 ? ci[0] : undefined) ?? null;
  if (sheet == null) return { why: "no_such_sheet" };
  const c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
  const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row);
  if (grid && (c2 > grid.cols || r2 > grid.rows)) return { why: "outside_grid" };
  return { unit: sheetRangeRef(sheet, `${columnLetters(c1)}${r1}:${columnLetters(c2)}${r2}`) };
}

/** Split at every top-level `sep` — outside a quoted sheet name and outside
 *  parentheses — so `'a,b'!A1` is one area and `A1,B2` is two.
 *  @param {string} s
 *  @param {string} sep
 *  @returns {string[]} */
function splitTopLevel(s, sep) {
  /** @type {string[]} */
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
 *  `!` is a 3-D (multi-sheet) reference and a `[..]` is another workbook.
 *  @param {string | null | undefined} formula
 *  @param {string[]} sheets
 *  @returns {RangeUnitResult} */
function definedNameUnit(formula, sheets) {
  const f = String(formula ?? "").trim();
  if (!f) return { why: "empty_reference" };
  if (/#REF!/i.test(f)) return { why: "broken_reference" };
  if (splitTopLevel(f, ",").length > 1 || /^\(.*\)$/.test(f)) return { why: "multi_area" };
  const m = /^(?:'((?:[^']|'')+)'|([^'!\s,()]+))!(.+)$/.exec(f);
  if (!m) return { why: "not_a_range_reference" };
  const quoted = m[1], bare = m[2], address = m[3] ?? "";
  /* one of the two alternatives matched, so `bare` is there whenever `quoted` is not */
  const sheetName = quoted != null ? quoted.replace(/''/g, "'") : (bare ?? "");
  if (/\[[^\]]*\]/.test(sheetName)) return { why: "external_workbook" };
  if (sheetName.includes(":")) return { why: "multi_sheet_reference" };
  const corners = address.split(":");
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
 *  emitted over the text bound too.
 *  @param {XlsxParts} parts
 *  @returns {RangeUnits} */
function xlsxRangeUnits(parts) {
  const names = parts.sheets.map((s) => s.name);
  /** @type {RangeUnit[]} */
  const units = [];
  /** @type {RangeUnitSkipped[]} */
  const skipped = [];
  for (const dn of parts.definedNames) {
    const r = definedNameUnit(dn.ref, names);
    const localSheetId = dn.localSheetId;
    const scope = localSheetId != null ? (parts.sheets[localSheetId]?.name ?? null) : null;
    if ("unit" in r) units.push({ source: "defined-name", name: dn.name, scope, hidden: dn.hidden, unit: r.unit });
    else skipped.push({ source: "defined-name", name: dn.name, ref: dn.ref, why: r.why });
  }
  for (const t of parts.tables) {
    const why = t.why;
    if (why) { skipped.push({ source: "table", name: t.name, ref: t.ref, part: t.part, why }); continue; }
    const corners = String(t.ref ?? "").split(":");
    const a = corners.length <= 2 ? a1Corner(corners[0]) : null;
    const b = corners.length === 2 ? a1Corner(corners[1]) : a;
    /** @type {RangeUnitResult} */
    const r = a && b ? rangeUnitFor(t.sheet, a, b, names, { rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS })
                     : { why: "not_a_range_reference" };
    if ("unit" in r) units.push({ source: "table", name: t.name, scope: t.sheet, hidden: false, unit: r.unit });
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
/** @type {number} */
const XLSX_GRID_ROWS = 1048576;
/** @type {number} */
const XLSX_GRID_COLS = boundOf("sheet", "columns");

/** The 1-based column number of an A1 reference, or null — `a1Corner`'s
 *  reading, the one there is. `$B$14` and `B14` both answer 2 — the absolute
 *  markers are notation, not address, exactly as `CONTENT_EXTENT_A1_RE` in the
 *  check catalog treats them. Anything this cannot read is null and is
 *  SKIPPED by the caller, never scored zero: a reference this helper does not
 *  understand must not silently shrink a sheet's measured extent.
 *  @param {string} ref
 *  @returns {number | null} */
const a1Col = (ref) => a1Corner(ref)?.col ?? null;

/* http/https are addresses the record may hold a capture of elsewhere:
 * deferred. Everything else a hyperlink rel can carry (mailto:, file:, ...)
 * is refused — the same partition rule HTML and PDF apply. */
/** @param {string | null | undefined} url @returns {"deferred" | "refused"} */
function classifyUrl(url) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(url || "");
  const scheme = m ? (m[1] ?? "").toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  if (!scheme && url) return "deferred"; // scheme-relative / bare address: resolvable against the record
  return "refused";
}

/* A worksheet rels target is resolved against the part's own directory
 * (OPC convention): "../drawings/x.xml" from "xl/worksheets/" -> "xl/...". */
/** @param {string} fromPart @param {string} target @returns {string} */
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

/** @param {BytesInput | null | undefined} bytes @returns {Promise<XlsxPartsResult>} */
async function xlsxParts(bytes) {
  const b = toBytes(bytes);
  /** @type {XlsxPartsUndetermined[]} */
  const undetermined = [];
  /** @type {PartialNote[]} */
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
  const wbPartial = wbRead.partial;
  if (wbPartial) partials.push(wbPartial);
  const wb = collectElements(wbRead.text, ["sheet", "definedName", "workbookPr"]);
  if (wb.badRef) return { ok: false, why: "workbook_unreadable:char_ref_invalid" };
  const date1904 = wb.elements.some((e) => e.name === "workbookPr" && (e.attrs.date1904 === "1" || e.attrs.date1904 === "true"));

  /* Every _rels/*.rels part, walked ONCE: the workbook's (sheet parts), each
   * sheet's (hyperlink targets, table parts) and every other part's outbound
   * relationships (a drawing's hyperlinks, an external link's workbook path)
   * all come from this one walk, and an unreadable one is stated by it. */
  const rels = await walkRels(b, container);
  /** @param {string} part */
  const relsOf = (part) => rels.byPart.find(/** @param {any} p one of ooxml's readings by part */ (p) => p.part === relsPartFor(part)) ?? null;

  /* workbook.xml.rels: r:id -> worksheet part, resolved against xl/. */
  /** @type {Map<string, any>} ooxml's relationships (ooxml states no kind for them yet) */
  const relsById = new Map();
  const wbRels = relsOf(WORKBOOK_PART);
  if (wbRels) {
    for (const r of wbRels.relationships) if (r.id) relsById.set(r.id, r);
  } else {
    const stated = rels.undetermined.find(/** @param {any} u one of ooxml's statements */ (u) => u.part === relsPartFor(WORKBOOK_PART));
    undetermined.push({ part: relsPartFor(WORKBOOK_PART), why: stated?.why ?? "part_absent" });
  }

  /** @type {XlsxSheet[]} */
  const sheets = wb.elements.filter((e) => e.name === "sheet").map((s, index) => {
    const given = s.attrs.state;
    /** @type {SheetState} */
    const state = given === "hidden" || given === "veryHidden" ? given : "visible";
    const id = s.attrs.id;
    const rel = id ? relsById.get(id) : null;
    const name = s.attrs.name;
    /* A <sheet> must carry a name; one that does not is stated, and the
     * placeholder it is given is said to be one (R22). */
    if (name == null) undetermined.push({ part: WORKBOOK_PART, why: `sheet_name_absent:${index}` });
    /** @type {XlsxSheet} */
    const sheet = {
      index,
      name: name ?? `sheet${index + 1}`,
      sheetId: s.attrs.sheetId ?? null,
      state,
      hidden: state === "visible" ? false : state,
      part: rel && !rel.external ? resolveTarget(WORKBOOK_PART, rel.target) : null,
      xml: null,
      why: rel ? null : "sheet_rel_unresolved",
    };
    return sheet;
  });

  /* Defined names -> anchor material, and R9's units. `localSheetId` and
   * `hidden` ride along for the units; the anchor links read name/ref only. */
  /** @type {DefinedName[]} */
  const definedNames = [];
  for (const d of wb.elements) {
    const name = d.attrs.name;
    if (d.name !== "definedName" || name == null) continue;
    const localSheetId = d.attrs.localSheetId ?? "";
    definedNames.push({ name, ref: d.text.trim(),
      localSheetId: /^\d+$/.test(localSheetId) ? parseInt(localSheetId, 10) : null,
      hidden: d.attrs.hidden === "1" || d.attrs.hidden === "true" });
  }

  /* R9 — TABLE PARTS, reached through each sheet's OWN rels (relationship
   * type …/table), never by filename. Workbook metadata, read even over the
   * text bound as hidden sheets are: a table part names an address, not text.
   * An unreadable table part is carried as a skip with its reason. */
  /** @type {TablePart[]} */
  const tables = [];
  for (const sheet of sheets) {
    const sheetPart = sheet.part;
    const sr = sheetPart ? relsOf(sheetPart) : null;
    sheet.rels = sr;
    if (!sr || !sheetPart) continue;
    for (const r of sr.relationships) {
      if (r.external || !r.target || !/\/table$/.test(String(r.type ?? ""))) continue;
      const part = resolveTarget(sheetPart, r.target);
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
  /** @param {string} n */
  const isTextPart = (n) => sheetParts.has(n) || n === SHARED_STRINGS_PART;
  const declared = declaredTextBytes(container, isTextPart);
  const plan = textPlan(declared.total);
  const guard = plan.read === "none" ? plan.guard : null;
  const piecewise = plan.read === "pieces" ? plan.piecewise : null;

  /** @type {string[] | null} */
  let sharedStrings = null;
  /** @type {Dates | null} */
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
        const partial = ss.partial;
        if (partial) partials.push(partial);
        undetermined.push(...scanNotes(SHARED_STRINGS_PART, ss.scanner));
      } else undetermined.push({ part: SHARED_STRINGS_PART, ...stripOk(ss) });
    }
    /* The number formats (R30): which cells are dates. Absence is normal OPC. */
    if (container.byName.has(STYLES_PART)) {
      const reader = stylesReader();
      const st = await scanPart(b, container, STYLES_PART, reader.handler, { mode: "whole" });
      if (st.ok) { dates = datesFrom(reader, date1904); const partial = st.partial; if (partial) partials.push(partial); }
      else undetermined.push({ part: STYLES_PART, ...stripOk(st) });
    }
    for (const sheet of sheets) {
      const part = sheet.part;
      if (!part) { undetermined.push({ part: `(sheet ${sheet.name})`, why: sheet.why }); continue; }
      if (plan.read === "pieces") {
        /* Walked in pieces by text() and structure(), each time it is asked
           for; a sheet the package does not hold is stated now. */
        if (container.byName.has(part) || container.entries.some(/** @param {any} e one of ooxml's entries */ (e) => normalizePartName(e.name) === part)) sheet.pieces = true;
        else { sheet.why = "part_absent"; undetermined.push({ part, why: "part_absent" }); }
        continue;
      }
      const read = await readText(b, container, part);
      if (read.ok) { sheet.xml = read.text; const partial = read.partial; if (partial) partials.push(partial); }
      else { sheet.why = read.why; undetermined.push({ part, ...stripOk(read) }); }
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
    access: new Map([]), shared: new Map([]),
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
/** @type {number} */
const ACCESS_BLOCK_CHARS = 1 << 20;

/* The rows of a block, as the read meets them: the smallest and largest row number and whether they came in ascending
   order. A row with no readable `r` follows the row before it, across blocks too (`before`). */
/** @returns {{open: (start: number) => AccessBlock, take: (blk: AccessBlock, r: number) => void}} */
function blockRows() {
  let last = 0;
  /** @param {number} start @returns {AccessBlock} */
  const open = (start) => ({ start, end: null, min: Infinity, max: 0, ordered: true, prev: 0, before: last });
  /** @param {AccessBlock} blk @param {number} r */
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

/** Access points for a sheet held whole: blocks of offsets into the held text.
 *  @returns {OffsetRecorder} */
function offsetAccess() {
  const rows = blockRows();
  /** @type {AccessBlock[]} */
  const blocks = [];
  /** @type {AccessBlock | null} */
  let cur = null;
  return {
    row(at, r) {
      const was = cur;
      const blk = !was || at - was.start >= ACCESS_BLOCK_CHARS ? rows.open(blocks.length ? at : 0) : was;
      if (blk !== was) {
        if (was) was.end = at;
        cur = blk;
        blocks.push(blk);
      }
      rows.take(blk, r);
    },
    async finish(length) {
      const last = cur;
      if (last) last.end = length;
      return { kind: "offsets", blocks: blocks.filter((b) => b.min !== Infinity), length };
    },
  };
}

/* G178 (R46): the text is encoded once and written once; only the compressed chunks are collected (no Blob of the text, no
   Response collecting a second whole). */
const TEXT_ENC = new TextEncoder();
/** @param {string} s @returns {Promise<Uint8Array>} */
async function deflateText(s) {
  const cs = new CompressionStream("deflate-raw");
  const writing = (async () => { const w = cs.writable.getWriter(); await w.write(TEXT_ENC.encode(s)); await w.close(); })();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let size = 0;
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); size += value.length;
  }
  await writing;
  const only = chunks[0];
  if (chunks.length === 1 && only) return only;
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
/** @param {Uint8Array} u8 @returns {Promise<string>} */
async function inflateText(u8) {
  const out = new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(out).text();
}

/** Access points for a sheet read in pieces: each piece (whole rows) is a block, kept deflated.
 *  @returns {PieceRecorder} */
function pieceAccess() {
  const rows = blockRows();
  /** @type {PieceBlock[]} */
  const blocks = [];
  /** @returns {PieceBlock} */
  const fresh = () => ({ ...rows.open(0), data: null, length: 0 });
  let cur = fresh();
  const begin = () => { cur = fresh(); };
  /* G178 (R46): a piece is deflated while the next is walked, never more than one deflate ahead: the piece before the
     last is awaited when the last is given, so the pieces waiting to be compressed are not all of the sheet. */
  let before = null;
  return {
    row(_at, r) { rows.take(cur, r); },
    piece(text) {
      const blk = cur;
      blk.length = text.length;
      /** @type {Promise<Uint8Array> | undefined} */
      let wait;
      if (blk.min !== Infinity) { blocks.push(blk); const data = deflateText(text); blk.data = data; wait = data; }
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
 *  and the value one holds is the file's statement under a merge, stated (`covered_by_merge`, with the range).
 *  @param {string[]} merges
 *  @param {TypedEntry[]} typed
 *  @param {number} sheetIndex
 *  @returns {CoveredStatement[]} */
function coveredCells(merges, typed, sheetIndex) {
  /** @type {Map<number, string>} */
  const at = new Map([]);
  for (const t of typed) { const c = a1Corner(t.ref ?? ""); if (c) at.set(c.row * 16385 + c.col, t.ref); }
  /** @type {CoveredStatement[]} */
  const out = [];
  for (const range of merges) {
    const ends = String(range).split(":");
    const a = a1Corner(ends[0]), b = ends.length === 2 ? a1Corner(ends[1]) : a;
    if (!a || !b) continue;
    const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
    /** @param {string} ref */
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

/** A cell that holds a value or a formula (what the cell list and the text keep; a styled empty cell is neither).
 *  @param {WalkedCell} c @returns {boolean} */
const holdsValue = (c) => c.v != null || c.f != null || (c.t === "inlineStr" && c.is != null);

/** R47 (S-15): a formula moved `dr` rows and `dc` columns, as Excel moves a shared formula's dependents: every relative
 *  reference (a cell, a column range, a row range) moves, an absolute one (`$`) stays, text in quotes is left alone,
 *  and a reference moved off the grid becomes `#REF!`.
 *  @param {string} f
 *  @param {number} dr
 *  @param {number} dc
 *  @returns {string} */
function shiftFormula(f, dr, dc) {
  if (!dr && !dc) return f;
  const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/, COL = /^\$?[A-Za-z]{1,3}$/, ROW = /^\$?\d{1,7}$/;
  /** @param {string} letters @returns {number} */
  const colOf = (letters) => { let n = 0; for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  /** @param {boolean} abs @param {number} v @param {number} d @param {number} max @returns {number | null} */
  const move = (abs, v, d, max) => { if (abs) return v; const n = v + d; return n >= 1 && n <= max ? n : null; };
  let out = "", i = 0;
  while (i < f.length) {
    const ch = f.charAt(i);
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      for (;;) { const k = f.indexOf(ch, j); if (k < 0) { j = f.length; break; } if (f[k + 1] === ch) { j = k + 2; continue; } j = k + 1; break; }
      out += f.slice(i, j); i = j; continue;
    }
    if (/[$A-Za-z0-9_.]/.test(ch)) {
      let j = i; while (j < f.length && /[$A-Za-z0-9_.]/.test(f.charAt(j))) j++;
      const run = f.slice(i, j);
      const m = CELL.exec(run);
      if (m && f[j] !== "(") {
        /* every group of CELL takes part in a match */
        const c = move(m[1] === "$", colOf(m[2] ?? ""), dc, XLSX_GRID_COLS), r = move(m[3] === "$", parseInt(m[4] ?? "", 10), dr, XLSX_GRID_ROWS);
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
/** @param {(row: WalkedRow) => void} onRow @param {SheetHandlerOptions} [options] @returns {{handler: ScanHandler, done: () => SheetTotals}} */
function sheetHandler(onRow, { rowsOnly = false, ctl = { stopped: false }, access = null, retainedMax = OFFICE_RETAINED_MAX, shared = new Map([]), startRow = 0 } = {}) {
  /** @type {number[]} */
  const hiddenRows = [];
  /** @type {HiddenCols[]} */
  const hiddenCols = [];
  /** @type {SheetHyperlink[]} */
  const hyperlinks = [];
  /** @type {string[]} */
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
  /** @type {WalkedRow | null} */
  let row = null;
  /** @type {WalkedCell | null} */
  let cell = null;
  /** @type {"f" | "v" | "t" | "x" | null} */
  let target = null;
  let buf = "", inIs = false, rph = 0;
  const endCell = () => {
    const c = cell;
    if (!c) return;
    /* R47 (S-15): a shared formula's master states its text, its dependents state none: each is the master's, moved by the distance between the cells. */
    const sharedIndex = c.shared;
    if (sharedIndex != null) {
      const f = c.f;
      if (f) shared.set(sharedIndex, { formula: f, row: c.row, col: c.col });
      else { const m = shared.get(sharedIndex); if (m) c.f = shiftFormula(m.formula, c.row - m.row, c.col - m.col); }
    }
    const r = row;
    if (r) r.cells.push(c);
    cell = null; target = null;
  };
  const endRow = () => {
    const done = row;
    if (!done) return;
    endCell();
    if (done.hidden && done.r != null) hiddenRows.push(done.r);
    /* R47 (S-17): only a cell holding a value or a formula reaches; a styled empty cell is formatting. */
    const held = done.cells.filter(holdsValue);
    if (held.length) {
      if (done.r > usedRows) usedRows = done.r;
      for (const c of held) {
        const col = a1Col(c.cell);
        if (col != null && col > usedCols) usedCols = col;
      }
    }
    row = null;
    onRow(done);
  };
  /** @type {ScanHandler} */
  const handler = {
    get stopped() { return ctl.stopped; },
    text(s) { if (target) buf += decodeXmlEntities(s); },
    cdata(s) { if (target) buf += s; },
    open(name, raw, self) {
      if (name === "row") {
        endRow();
        const a = parseAttrs(raw);
        const r = a.r;
        const given = r != null ? parseInt(r, 10) : NaN;
        rowNo = Number.isInteger(given) && given > 0 ? given : rowNo + 1;
        colNo = 0;
        /** @type {WalkedRow} */
        const opened = { r: rowNo, hidden: a.hidden === "1" || a.hidden === "true", cells: [] };
        row = opened;
        /* the scanner sets itself on the handler before it hands it a tag */
        const sc = handler.scanner;
        if (access && sc) access.row(sc.at, opened.r);
        if (self) endRow();
        return;
      }
      const inRow = row;
      if (inRow) {
        if (name === "c") {
          endCell();
          const a = parseAttrs(raw);
          const ref = a.r;
          const at = ref ? a1Corner(ref) : null;
          colNo = at ? at.col : colNo + 1;
          cell = { cell: ref ? ref : `${columnLetters(colNo)}${inRow.r}`, t: a.t ?? null, s: a.s ?? null, f: null, v: null, is: null, shared: null, row: at ? at.row : inRow.r, col: colNo };
          if (inRow.cells.length >= retainedMax) { ctl.stopped = true; ctl.exceeded ??= { why: "TOO_MANY_OBJECTS", n: inRow.cells.length + 1, bound: retainedMax, final: true }; }
          if (self) endCell();
        } else {
          const c = cell;
          if (c) {
            if (name === "f") {
              if (c.f == null) { const fa = parseAttrs(raw); const si = fa.si; if (fa.t === "shared" && si != null) c.shared = si; }
              if (self) { c.f ??= ""; } else { target = c.f == null ? "f" : "x"; buf = ""; }
            }
            else if (name === "v") { if (self) { c.v ??= ""; } else { target = c.v == null ? "v" : "x"; buf = ""; } }
            else if (name === "is") { if (!self) { inIs = c.is == null; if (inIs) c.is = ""; } else c.is ??= ""; }
            else if (inIs && name === "rPh" && !self) rph++;
            else if (inIs && name === "t" && !self && rph === 0) { target = "t"; buf = ""; }
          }
        }
        return;
      }
      if (rowsOnly) return;
      if (name === "col") {
        const a = parseAttrs(raw);
        if (a.hidden === "1" || a.hidden === "true") hiddenCols.push({ min: parseInt(a.min ?? "", 10), max: parseInt(a.max ?? "", 10) });
      } else if (name === "mergeCell") {
        const a = parseAttrs(raw);
        const ref = a.ref;
        if (ref) merges.push(ref);
      } else if (name === "hyperlink") {
        const a = parseAttrs(raw);
        hyperlinks.push({ cell: a.ref ?? null, relId: a.id ?? null, location: a.location ?? null, display: a.display ?? null });
      }
    },
    close(name) {
      if (name === "row") { endRow(); return; }
      if (name === "c") { endCell(); return; }
      const c = cell;
      if (!c) return;
      if (name === "f" || name === "v") {
        if (target === name) c[name] = buf;
        if (target === name || target === "x") target = null;
      } else if (name === "t") {
        if (target === "t") { c.is += buf; target = null; }
      } else if (name === "rPh") { if (rph > 0) rph--; }
      else if (name === "is") { inIs = false; rph = 0; }
    },
  };
  return { handler, done: () => ({ hiddenRows, hiddenCols, hyperlinks, merges, usedRows, usedCols }) };
}

/* R47 (S-15): a sheet's shared-formula masters, kept on the reading, so a block read alone (cellsIn) still finds the master of a dependent in a block before it. */
/** @param {XlsxParts} parts @param {string} part @returns {Map<string, SharedMaster>} */
function sharedFormulasOf(parts, part) {
  parts.shared ??= new Map([]);
  const known = parts.shared.get(part);
  if (known) return known;
  /** @type {Map<string, SharedMaster>} */
  const made = new Map([]);
  parts.shared.set(part, made);
  return made;
}

/* One sheet part walked, whole (its XML in hand) or in pieces (R35): `onRow`
 * gets every row as it is walked, and the answer is the walk's totals, or
 * `{ failed: why }` when the part could not be read to its end. A caller whose
 * answer is `failed` has been given rows of a part that is not the part, and
 * drops what it built from them. `ctl.exceeded` is a bound the walk went past (R44). With `access` the walk also leaves the
 * sheet's access points (R37). */
/**
 * @param {XlsxParts} parts
 * @param {XlsxSheet} sheet
 * @param {string} part the sheet's part
 * @param {(row: WalkedRow) => void} onRow
 * @param {WalkOptions} [options]
 * @returns {Promise<SheetWalked | SheetFailed>}
 */
async function walkSheetPart(parts, sheet, part, onRow, { yieldNow = null, ctl = { stopped: false }, access = null } = {}) {
  const w = sheetHandler(onRow, { ctl, access, shared: sharedFormulasOf(parts, part) });
  const xml = sheet.xml;
  if (xml != null) {
    const sc = new Scanner(w.handler);
    await scanWhole(sc, xml, yieldNow);
    if (sc.badRef && !ctl.exceeded) return { failed: { why: "char_ref_invalid", final: true } };
    const done = w.done();
    if (access) parts.access.set(part, await access.finish(xml.length));
    return { ...done, scanner: sc };
  }
  /* a sheet read in pieces is given a recorder of pieces (text(), cellsIn()) */
  const pieces = access && "piece" in access ? access : null;
  const r = await scanPart(parts.bytes, parts.container, part, w.handler,
    { mode: "pieces", cut: SHEET_CUT, yieldNow, onPiece: pieces ? (piece) => pieces.piece(piece) : null });
  if (!r.ok && !ctl.exceeded) return { failed: stripOk(r) };
  if (pieces && r.ok) parts.access.set(part, await pieces.finish());
  return { ...w.done(), scanner: r.ok ? r.scanner : undefined };
}

/** One cell's DISPLAYED value (the cached claim the published sheet shows).
 *  Returns { value } or { undetermined: why }; an empty cell is null value. A date by its number format shows as the
 *  ISO date (R30, G134c).
 *  @param {WalkedCell} c
 *  @param {string[] | null} sharedStrings
 *  @param {Dates | null} [dates]
 *  @returns {CellValue} */
function cellValue(c, sharedStrings, dates = null) {
  if (c.t === "s") {
    const v = c.v;
    const i = v != null ? parseInt(v, 10) : NaN;
    /* the list is made by push, so an index inside it holds a string */
    if (sharedStrings && Number.isInteger(i) && i >= 0 && i < sharedStrings.length)
      return { value: sharedStrings[i] ?? null };
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
/** @type {{readonly [t: string]: CellType}} */
const CELL_TYPES = { n: "number", s: "text", str: "text", inlineStr: "text", b: "boolean", d: "date", e: "error" };

/** One walked cell -> `{ cell, undetermined? }`. `value` is the lexical value
 *  as stored (the <v>, an inline string's text, a resolved shared string),
 *  never re-rendered through a float; null when it cannot be resolved.
 *  @param {WalkedCell} c
 *  @param {string} sheetName
 *  @param {string[] | null} sharedStrings
 *  @param {Dates | null} [dates]
 *  @returns {TypedCellRead} */
function typedCell(c, sheetName, sharedStrings, dates = null) {
  const t = c.t;
  const type = t == null ? "number" : (CELL_TYPES[t] ?? null);
  let value = c.t === "inlineStr" ? (c.is ?? c.v) : c.v;
  /** @type {string | null} */
  let why = type == null ? "cell_type_unknown" : null;
  if (c.t === "s") {
    const r = cellValue(c, sharedStrings);
    if ("undetermined" in r) { value = null; why = r.undetermined; }
    else value = r.value;
  }
  const iso = dateOf(c, dates);
  const formula = c.f != null;
  /** @type {TypedCell} */
  const cell = { source: c.cell ? sheetCellRef(sheetName, c.cell) : null, value: value ?? null, type,
    declared: c.t ?? null, cached: formula ? c.v : null, formula: formula ? c.f : null };
  if (iso != null) { cell.value = iso; cell.type = "date"; cell.serial = c.v; }
  return { cell, why };
}

/** R30's order: row, then column. A cell with no readable `r` keeps the place
 *  of the cell before it (sorted stably), never a guessed address.
 *  @param {TypedEntry[]} entries
 *  @returns {TypedEntry[]} */
function rowColumnOrder(entries) {
  /** @type {[number, number]} */
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

/** @param {XlsxParts} parts @param {ReadOptions} [opts] @returns {Promise<XlsxStructure>} */
async function xlsxStructure(parts, opts) {
  const { bytes, container, sheets, definedNames, guard } = parts;
  /** @type {XlsxLink[]} */
  const links = [];
  /** @type {string[]} */
  const notes = [];
  /** @type {XlsxEvidentiaryItem[]} */
  const evItems = [];
  /** @type {XlsxUndetermined[]} */
  const evUndetermined = [...parts.undetermined, ...parts.partials];

  for (const sheet of sheets) {
    /* The rels half: this sheet's own .rels, where the TARGETS live (read
     * once, by parts()'s walk; an unreadable one is stated below). */
    /** @type {Map<string, any>} ooxml's relationships (ooxml states no kind for them yet) */
    const relTargets = new Map();
    if (sheet.rels) {
      for (const r of sheet.rels.relationships) if (r.id) relTargets.set(r.id, r);
    }

    /* The sheet walked: whole (its XML in hand) or in pieces (R35), the
     * formulas gathered as the rows come (DEC-5, below) and no row kept. A
     * sheet read in pieces that cannot be read to its end is stated, with the
     * reason, and its links fall back to the rels alone. */
    /** @type {FormulaItem[]} */
    const formulas = [];
    /** @type {SheetWalked | null} */
    let walked = null;
    /** @type {string | null} */
    let failedWhy = null;
    const part = sheet.part;
    if (part != null && (sheet.xml != null || sheet.pieces)) {
      const got = await walkSheetPart(parts, sheet, part, (row) => {
        for (const c of row.cells) {
          const f = c.f;
          if (f == null) continue;
          formulas.push({
            kind: "formula",
            source: c.cell ? sheetCellRef(sheet.name, c.cell) : null,
            formula: f,
            value: c.v, // the cached result, null when the file carries none — stated, not invented
          });
        }
      }, { yieldNow: opts?.yieldNow });
      if ("failed" in got) {
        failedWhy = got.failed.why;
        evUndetermined.push({ part, ...got.failed });
      } else walked = got;
    }

    const sheetWalk = walked;
    if (sheetWalk == null) {
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

    /** @type {Set<any>} ooxml's relationships (ooxml states no kind for them yet) */
    const usedRels = new Set();

    /* Hyperlinks: the sheet XML knows the CELL, the rels know the TARGET. */
    for (const h of sheetWalk.hyperlinks) {
      const cell = h.cell;
      const source = cell ? sheetCellRef(sheet.name, cell) : null;
      const relId = h.relId;
      if (relId) {
        const rel = relTargets.get(relId);
        if (!rel) {
          links.push({ partition: "undetermined", wrapper: null,
            target: { why: "hyperlink_rel_unresolved", relId }, source });
          continue;
        }
        if (!rel.external) {
          links.push({ partition: "undetermined", wrapper: null,
            target: { why: "hyperlink_rel_not_external", relId, part: rel.target }, source });
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
      const location = h.location;
      if (location) {
        /* A cross-sheet reference: internal, final at capture -> anchor. */
        const fragment = `#${location}`;
        links.push({ partition: "anchor", wrapper: linkWrapper.anchor(fragment),
          target: { location, fragment }, source });
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
    if (sheetWalk.hiddenRows.length) {
      evItems.push({ kind: "hidden-rows", sheet: sheet.name,
        rows: sheetWalk.hiddenRows, count: sheetWalk.hiddenRows.length, source: null });
    }
    if (sheetWalk.hiddenCols.length) {
      evItems.push({ kind: "hidden-cols", sheet: sheet.name,
        cols: sheetWalk.hiddenCols, count: sheetWalk.hiddenCols.length, source: null });
    }
  }

  /* Every OTHER part's outbound relationships (a drawing's hyperlinks, an
   * external link's workbook path, the package's own): document-level facts
   * with no cell to name. The sheets' own rels were handled above. */
  /** @type {Set<string>} */
  const sheetRelsParts = new Set([]);
  for (const s of sheets) { const part = s.part; if (part) sheetRelsParts.add(relsPartFor(part)); }
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
  /** @type {string[]} */
  const embedded = [];
  for (const entry of container.entries) {
    const name = normalizePartName(entry.name);
    if (/^xl\/embeddings\//.test(name)) embedded.push(name);
  }
  const identities = await memberIdentities(bytes, embedded);
  for (const name of embedded) {
    const read = identities.get(name);
    if (!read?.ok) {
      const limit = read?.limit;
      links.push({ partition: "undetermined", wrapper: null,
        target: { why: `embedding_unreadable:${read?.why ?? "unreadable"}`, name, ...(limit != null ? { limit } : {}) }, source: null });
      continue;
    }
    links.push({ partition: "intra", wrapper: linkWrapper.intra(read.sha256),
      target: { sha256: read.sha256, name, bytes: read.size }, source: null });
  }

  /** @type {LinkCounts} */
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

  /** @type {{[kind: string]: number}} */
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
/** @param {ReadOptions | undefined} opts @returns {number | null} */
function inlineCellsCap(opts) {
  const v = opts?.inlineCellsMax;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}
const JSON_ENC = new TextEncoder();
/** The UTF-8 bytes of one cell's JSON.
 *  @param {TypedCell} cell @returns {number} */
function cellJsonBytes(cell) {
  const j = JSON.stringify(cell);
  return /[^\x00-\x7f]/.test(j) ? JSON_ENC.encode(j).length : j.length;
}

/** Cell comments, as a scanner handler: one `<comment ref>` is one note, its `<t>` text (phonetic runs left out).
 *  @returns {{handler: ScanHandler, list: {ref: string | null, text: string}[]}} */
function commentsReader() {
  /** @type {{ref: string | null, text: string}[]} */
  const list = [];
  /** @type {{ref: string | null, text: string} | null} */
  let cur = null;
  let inT = false, rph = 0;
  /** @type {ScanHandler} */
  const handler = {
    text(s) { const c = cur; if (inT && c) c.text += decodeXmlEntities(s); },
    cdata(s) { const c = cur; if (inT && c) c.text += s; },
    open(name, raw, self) {
      if (name === "comment") { const made = { ref: parseAttrs(raw).ref ?? null, text: "" }; cur = made; list.push(made); if (self) cur = null; rph = 0; }
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

/** `text()` refused whole: no sheet, the one statement why, R9's units beside it.
 *  @param {XlsxParts} parts @param {XlsxUndetermined} why @param {number} scanned @returns {XlsxTextBody} */
function refusedText(parts, why, scanned) {
  const units = xlsxRangeUnits(parts);
  return {
    ok: true, container: "xlsx", document: null, sheets: [],
    rangeUnits: units.rangeUnits, rangeUnitsSkipped: units.rangeUnitsSkipped,
    undetermined: [why],
    counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: scanned },
  };
}

/** @param {XlsxParts} parts @param {ReadOptions} [opts] @returns {Promise<XlsxTextBody>} */
async function xlsxText(parts, opts) {
  /* The shapes below are IC-2's pageless degenerate form AS ACCEPTED from
   * docx.mjs (paragraphs[] there, sheets[] here — the per-unit list named for
   * what the unit IS; `ok`/`container`/`document`/`undetermined`/`counts`
   * shared wherever the meaning transfers). */
  const { sheets, sharedStrings, guard, piecewise, dates } = parts;
  const yieldNow = opts?.yieldNow;

  if (guard) {
    /* Over the streamed ceiling: the sizeGuard marker carried VERBATIM inside
     * `undetermined` (the docx.mjs pattern — ooxml.mjs shaped the marker for
     * exactly this), never a silent truncation. */
    return refusedText(parts, guard, 0);
  }

  /** @type {XlsxSheetText[]} */
  const outSheets = [];
  /** @type {XlsxUndetermined[]} */
  const allUndetermined = [...parts.partials, ...parts.undetermined.filter((u) => u.part === STYLES_PART)];
  let cellCount = 0, formulaCount = 0, scanned = 0;
  /* G41: with the caller's cap, the workbook's cells are listed while all of them together, as JSON, are within it;
     once they are not, every sheet's list is dropped and none is made (`held`). Over the whole-read bound none is
     made either (R35). Without the caller's cap nothing is held: every cell is listed, as always. */
  const cap = inlineCellsCap(opts);
  const listing = { held: false, bytes: 0 };
  /** @type {XlsxSheetText[]} */
  const walkedOut = [];
  const sink = textSink((parts.declared?.total ?? 0) / 4);
  /** @type {{o: XlsxSheetText, from: number, to: number}[]} */
  const spans = [];
  /* R44: the typed cells a read holds at once are bounded by the table's retained-objects figure: a read that would
     hold more is refused, by name and with its figure. */
  /** @type {WalkControl} */
  const ctl = { stopped: false, exceeded: null };
  let retained = 0;

  /* A sheet that gave no text: the marker, and the sheet as a unit with no
   * text and no cells. */
  /** @param {XlsxSheet} sheet @param {string} why @param {FailureRest} [extra] */
  const unreadable = (sheet, why, extra = {}) => {
    /** @type {SheetStatement} */
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
    /* a sheet held whole or walked in pieces has its part */
    const part = sheet.part;
    if (part == null || (sheet.xml == null && !sheet.pieces)) { unreadable(sheet, sheet.why ?? "sheet_unreadable"); continue; }
    /** @type {XlsxUndetermined[]} */
    const undetermined = [];
    /* G178 (R46): the sheet's lines go into the workbook's `sink` as they are made, never held as one string per row
       beside a joined whole; if the sheet cannot be read to its end they are taken back. */
    const sinkAt = sink.mark();
    let from = -1;
    /* G15: the 1-based row of each line, beside `lines` (empty rows give no
       line, so the line index is not the row). A row with no readable `r`
       follows the row before it, as the format defines. */
    /** @type {number[]} */
    const lineRows = [];
    let lastRow = 0;
    /* R30's typed cells: a sheet read in pieces lists none (`cells` is null,
       as over the guard), because they are the one thing here that grows with
       the sheet in objects, not in text (R35); nor does a workbook whose cells
       are held (G41). */
    /** @type {TypedEntry[] | null} */
    let typed = piecewise || listing.held ? null : [];
    let sheetBytes = 2;
    let sheetCells = 0, sheetFormulas = 0;
    /* R37: a sheet over a block leaves its access points when the caller keeps its cells held (the point reads follow). */
    const declaredSize = parts.container.byName.get(part)?.uncompressedSize ?? 0;
    const access = cap != null && declaredSize > ACCESS_BLOCK_CHARS && !parts.access.has(part)
      ? (sheet.xml != null ? offsetAccess() : pieceAccess()) : null;
    const walked = await walkSheetPart(parts, sheet, part, (row) => {
      /** @type {string[]} */
      const vals = [];
      const rowNo = Number.isInteger(row.r) && row.r > 0 ? row.r : lastRow + 1;
      lastRow = rowNo;
      for (const c of row.cells) {
        if (c.f != null) sheetFormulas++;
        /* R30: every cell holding a value or a formula, typed as declared. A cell type outside the format's list is
           stated whether or not the cells are listed. */
        if (c.v != null || c.f != null || (c.t === "inlineStr" && c.is != null)) {
          const t = c.t;
          if (t != null && CELL_TYPES[t] == null) undetermined.push({ sheet: sheet.index, cell: c.cell, reason: "cell_type_unknown" });
          const list = typed;
          if (list) {
            const tc = typedCell(c, sheet.name, sharedStrings, dates);
            list.push({ ref: c.cell, cell: tc.cell });
            if (++retained > OFFICE_RETAINED_MAX && !ctl.exceeded) {
              ctl.exceeded = { why: "TOO_MANY_OBJECTS", n: retained, bound: OFFICE_RETAINED_MAX, final: true };
              ctl.stopped = true;
            }
            if (cap != null) {
              sheetBytes += cellJsonBytes(tc.cell) + (list.length > 1 ? 1 : 0);
              if (listing.bytes + sheetBytes > cap) {
                listing.held = true; typed = null; retained = 0;
                for (const o of walkedOut) o.cells = null;
              }
            }
          }
        }
        const r = cellValue(c, sharedStrings, dates);
        if ("undetermined" in r) {
          undetermined.push({ sheet: sheet.index, cell: c.cell, reason: r.undetermined });
          continue;
        }
        const value = r.value;
        if (value == null || value === "") continue;
        sheetCells++;
        vals.push(value);
      }
      if (vals.length) {
        if (sink.chars > 0) sink.newline();
        if (from < 0) from = sink.chars;
        sink.add(vals.join("\t")); lineRows.push(rowNo);
      }
    }, { yieldNow, ctl, access });
    const exceeded = ctl.exceeded;
    if (exceeded) return refusedText(parts, { part, ...exceeded }, scanned);
    if ("failed" in walked) {
      sink.reset(sinkAt);
      const { why, ...rest } = walked.failed;
      unreadable(sheet, why, rest);
      continue;
    }
    const scanner = walked.scanner;
    scanned += scanner?.scanned ?? 0;
    if (scanner) allUndetermined.push(...scanNotes(part, scanner));
    /* R48 / R22: a row or column a positional reading puts past the format's grid is stated, never read as if it were an address of the sheet */
    /* R49 (K4630; as csv-reader R22): a sheet wider than the format's columns is refused whole, with its count and the limit; exactly the limit is read */
    if (walked.usedCols > XLSX_GRID_COLS) {
      return refusedText(parts, { part, why: "over_size_bound", size: walked.usedCols, bound: XLSX_GRID_COLS, boundName: "SHEET_COLUMNS_MAX", metric: "columns", final: true,
        statement: localize("office-readers.formats-xlsx.sheet_columns_over_bound", "This sheet is {size} columns wide; a sheet may have at most {bound}, so the workbook is not read.", { size: String(walked.usedCols), bound: String(XLSX_GRID_COLS) }) }, scanned);
    }
    if (walked.usedRows > XLSX_GRID_ROWS)
      undetermined.push({ sheet: sheet.index, cell: null, reason: "outside_grid", usedRows: walked.usedRows, usedCols: walked.usedCols });
    cellCount += sheetCells;
    formulaCount += sheetFormulas;
    const listed = typed;
    if (listed) listing.bytes += sheetBytes;
    /* COFF-11 / IC-100 — the sheet's own extent, in TWO figures that are two
       different facts: `rows`/`cols` is the BOUND (the grid this format makes
       addressable, which is what C-45.1's inner bound compares against), and
       `usedRows`/`usedCols` is how far this workbook's cells actually reach.
       See the decision block above `XLSX_GRID_ROWS`. */
    /* FW-19 / IC-124: the sheet as a `sheet-range` unit, or NULL. */
    const range = usedSheetRange(sheet.name, walked.usedRows, walked.usedCols);
    const cells = listed ? rowColumnOrder(listed).map((x) => x.cell) : null;
    /* R47 (S-18): the merged ranges the sheet states, when it states any */
    const merges = walked.merges;
    /** @type {XlsxSheetText} */
    let out;
    if (merges.length) {
      /** @type {XlsxSheetText} */
      const merged = { sheet: sheet.index, name: sheet.name, hidden: sheet.hidden, rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS,
        usedRows: walked.usedRows, usedCols: walked.usedCols, range, text: "", lineRows, cells, merges, undetermined };
      out = merged;
    } else {
      /** @type {XlsxSheetText} */
      const plain = { sheet: sheet.index, name: sheet.name, hidden: sheet.hidden, rows: XLSX_GRID_ROWS, cols: XLSX_GRID_COLS,
        usedRows: walked.usedRows, usedCols: walked.usedCols, range, text: "", lineRows, cells, undetermined };
      out = plain;
    }
    outSheets.push(out);
    if (walked.merges.length && listed) undetermined.push(...coveredCells(walked.merges, listed, sheet.index));
    if (from >= 0) spans.push({ o: out, from, to: sink.chars });
    walkedOut.push(out);
    for (const u of undetermined) allUndetermined.push(u);
  }
  /* G41: a caller that opted in is told, for every sheet it was given no cells of, that they are held. */
  if (cap != null) {
    for (const o of walkedOut) {
      if (listing.held || piecewise) o.cells = null;
      if (o.cells === null) o.cells_held = true;
    }
  }

  /* R38: the notes on cells are units (`cell_note`); the parts that can hold other text are stated unread. */
  /** @type {TextUnit<any>[]} */
  const cellNotes = [];
  for (const sheet of sheets) {
    /* a sheet's rels are read only when it has its part */
    const sheetPart = sheet.part;
    if (!sheetPart) continue;
    for (const r of sheet.rels?.relationships ?? []) {
      if (r.external || !r.target || !/\/comments$/.test(String(r.type ?? ""))) continue;
      const part = resolveTarget(sheetPart, r.target);
      const reader = commentsReader();
      const got = await scanPart(parts.bytes, parts.container, part, reader.handler, { mode: "whole", yieldNow });
      if (!got.ok) { allUndetermined.push({ part, ...stripOk(got) }); continue; }
      scanned += got.scanner.scanned;
      allUndetermined.push(...scanNotes(part, got.scanner));
      const partial = got.partial;
      if (partial) allUndetermined.push(partial);
      for (const n of reader.list) {
        const ref = n.ref;
        if (n.text) cellNotes.push({ kind: "cell_note", ref: ref ? sheetCellRef(sheet.name, ref) : null, part, text: n.text });
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
  const addressed = addressParts(cellNotes);
  /* R9 / D-415: the defined names and tables as `sheet-range` units,
     beside each sheet's whole-sheet `range`. */
  const units = xlsxRangeUnits(parts);
  /** @type {XlsxTextBody} */
  const body = {
    ok: true,
    container: "xlsx",
    document,
    sheets: outSheets,
    parts: addressed,
    rangeUnits: units.rangeUnits,
    rangeUnitsSkipped: units.rangeUnitsSkipped,
    undetermined: allUndetermined,
    counts: { chars: document.length, cells: cellCount, formulas: formulaCount,
      undetermined: allUndetermined.length, scanned_bytes: scanned },
  };
  /* R35: said when the text was read in pieces, the figures it was judged by. */
  if (piecewise) body.piecewise = piecewise;
  return body;
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
/** @type {number} */
export const CELLS_IN_MAX = 20000;

/** @param {unknown} range @returns {CellsInArgs | CellsInInvalid} */
function cellsInArguments(range) {
  if (range == null || typeof range !== "object") return { reason: "invalid_argument", argument: "range" };
  /** @type {{sheet?: unknown, fromRow?: unknown, toRow?: unknown, fromCol?: unknown, toCol?: unknown, maxCells?: unknown}} */
  const asked = range;
  const { sheet, fromRow = 1, toRow = null, fromCol = 1, toCol = null, maxCells = CELLS_IN_MAX } = asked;
  if (!((typeof sheet === "string" && sheet !== "") || (typeof sheet === "number" && Number.isInteger(sheet) && sheet >= 0))) return { reason: "invalid_argument", argument: "sheet" };
  /* a whole number of at least 1; `Number.isInteger` holds of numbers only */
  if (!(typeof fromRow === "number" && Number.isInteger(fromRow) && fromRow >= 1)) return { reason: "invalid_argument", argument: "fromRow" };
  if (toRow !== null && !(typeof toRow === "number" && Number.isInteger(toRow) && toRow >= 1 && toRow >= fromRow)) return { reason: "invalid_argument", argument: "toRow" };
  if (!(typeof fromCol === "number" && Number.isInteger(fromCol) && fromCol >= 1)) return { reason: "invalid_argument", argument: "fromCol" };
  if (toCol !== null && !(typeof toCol === "number" && Number.isInteger(toCol) && toCol >= 1 && toCol >= fromCol)) return { reason: "invalid_argument", argument: "toCol" };
  if (!(typeof maxCells === "number" && Number.isInteger(maxCells) && maxCells >= 1)) return { reason: "invalid_argument", argument: "maxCells" };
  return { sheet, fromRow, toRow: Math.min(toRow ?? XLSX_GRID_ROWS, XLSX_GRID_ROWS), toRowGiven: toRow !== null, fromCol, toCol: toCol ?? XLSX_GRID_COLS, maxCells };
}

/** @param {XlsxPartsResult | null | undefined} parts @param {CellsInArgs} a @returns {Promise<CellsInResult>} */
async function xlsxCellsIn(parts, a) {
  if (!parts || !parts.ok) return { ok: false, reason: parts?.why ?? "PARTS_ABSENT" };
  const { sheets, sharedStrings, guard, dates } = parts;
  parts.access ??= new Map([]);
  if (guard) return { ok: false, reason: guard.why, size: guard.size, bound: guard.bound, boundName: guard.boundName, final: true };
  const asked = a.sheet;
  /** @type {XlsxSheet | null} */
  let found = null;
  if (typeof asked === "number") found = sheets[asked] ?? null;
  else {
    found = sheets.find((s) => s.name === asked) ?? null;
    if (!found) {
      const ci = sheets.filter((s) => s.name.toLowerCase() === asked.toLowerCase());
      if (ci.length === 1) found = ci[0] ?? null;
    }
  }
  const sheet = found;
  if (!sheet) return { ok: false, reason: "no_such_sheet" };
  /* a sheet held whole or walked in pieces has its part */
  const part = sheet.part;
  if (part == null || (sheet.xml == null && !sheet.pieces)) return { ok: false, reason: sheet.why ?? "sheet_unreadable" };

  /** @type {TypedEntry[]} */
  const out = [];
  /** @type {CellStatement[]} */
  const undetermined = [];
  /** @type {WalkControl} */
  const ctl = { stopped: false };
  let lastRow = 0, maxRow = 0;
  /** @type {{nextRow: number | null}} the row left to the next call */
  const stop = { nextRow: null };
  const served = { bytes: 0, blocks: 0 };
  /** @param {WalkedRow} row */
  const takeRow = (row) => {
    const rowNo = Number.isInteger(row.r) && row.r > 0 ? row.r : lastRow + 1;
    lastRow = rowNo;
    if (rowNo > maxRow) maxRow = rowNo;
    if (rowNo < a.fromRow || rowNo > a.toRow) return;
    /** @type {TypedEntry[]} */
    const cells = [];
    for (const w of row.cells) {
      if (!(w.v != null || w.f != null || (w.t === "inlineStr" && w.is != null))) continue;
      const col = a1Col(w.cell);
      if (col != null && (col < a.fromCol || col > a.toCol)) continue;
      const tc = typedCell(w, sheet.name, sharedStrings, dates);
      const why = tc.why;
      if (why) undetermined.push({ sheet: sheet.index, cell: w.cell, reason: why });
      cells.push({ ref: w.cell, cell: tc.cell });
    }
    if (out.length > 0 && out.length + cells.length > a.maxCells) { stop.nextRow = rowNo; ctl.stopped = true; return; }
    for (const c of cells) out.push(c);
  };
  /** @param {string} xml @returns {boolean} */
  const parse = (xml) => {
    const w = sheetHandler(takeRow, { rowsOnly: true, ctl, shared: sharedFormulasOf(parts, part), startRow: lastRow });
    const sc = new Scanner(w.handler);
    scanSync(sc, xml);
    served.bytes += xml.length;
    served.blocks++;
    return sc.badRef;
  };

  /** @type {number | null} */
  let allMax = null;
  const whole = sheet.xml;
  const small = whole != null && whole.length <= ACCESS_BLOCK_CHARS;
  if (small) {
    if (parse(whole)) return { ok: false, reason: "char_ref_invalid", final: true };
  } else {
    /** @type {SheetAccess | undefined} */
    let access = parts.access.get(part);
    if (!access) {
      /* The first point read on a reading the read did not leave access points for: one pass leaves them. */
      if (whole != null) {
        const acc = offsetAccess();
        const w = sheetHandler(() => {}, { rowsOnly: true, access: acc, shared: sharedFormulasOf(parts, part) });
        const sc = new Scanner(w.handler);
        scanSync(sc, whole);
        if (sc.badRef) return { ok: false, reason: "char_ref_invalid", final: true };
        access = await acc.finish(whole.length);
      } else {
        const walked = await walkSheetPart(parts, sheet, part, () => {}, { access: pieceAccess() });
        if ("failed" in walked) { const { why, ...rest } = walked.failed; return { ok: false, reason: why, ...rest }; }
        access = parts.access.get(part);
      }
      parts.access.set(part, access);
    }
    /* a walk that left no access points (a bound went past) fails the call, as reading them would (`cells_in_failed`) */
    const points = access;
    if (!points) throw new TypeError("no access points for the sheet");
    let most = 0;
    for (const b of points.blocks) most = Math.max(most, b.max);
    allMax = most;
    for (const blk of points.blocks) {
      if (ctl.stopped) break;
      if (blk.max < a.fromRow || blk.min > a.toRow) continue;
      /** @type {string} */
      let xml;
      if (points.kind === "offsets") {
        /* offsets are left only for a sheet held whole; a block's end is set when the next opens or the walk ends */
        if (whole == null) throw new TypeError("no text for the sheet's offsets");
        xml = whole.slice(blk.start, blk.end ?? 0);
      } else {
        /* each piece's data is its deflated text once the walk is finished */
        const data = "data" in blk ? blk.data : null;
        if (!(data instanceof Uint8Array)) return { ok: false, reason: "sheet_unreadable" };
        try { xml = await inflateText(data); } catch { return { ok: false, reason: "sheet_unreadable" }; }
      }
      lastRow = blk.before;
      if (parse(xml)) return { ok: false, reason: "char_ref_invalid", final: true };
    }
  }
  const cells = rowColumnOrder(out).map((x) => x.cell);
  const next = stop.nextRow;
  const to = next != null ? next - 1 : (a.toRowGiven ? a.toRow : Math.max(a.fromRow, allMax ?? maxRow));
  return { ok: true, sheet: sheet.name, cells, rows: { from: a.fromRow, to }, ...(next != null ? { next_row: next } : {}), undetermined, served };
}

/* ------------------------------------------------------------------ *
 * The I7 entry (registered by formats.mjs — one registerFormat call there,
 * nothing anywhere else; that is the D-70 property this axis exists to keep)
 * ------------------------------------------------------------------ */

/** `structure()` and `text()` when `parts` failed: `structure()` names the parts' reason as it is, `text()` falls back
 *  to `PARTS_ABSENT` where there is none.
 *  @param {XlsxPartsFailure | null | undefined} parts
 *  @param {boolean} asText
 *  @returns {ReadFailure} */
function readRefused(parts, asText) {
  return { ok: false, container: "xlsx", reason: asText ? (parts?.why ?? "PARTS_ABSENT") : (parts ? parts.why : "PARTS_ABSENT") };
}

/** @type {XlsxEntry} */
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
    const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes)
      ? await xlsxParts(partsOrBytes)
      : partsOrBytes;
    /* parts that failed answer the refusal, which `withActive` carries unchanged */
    if (!parts || !parts.ok) return readRefused(parts, false);
    return withActive(await xlsxStructure(parts, opts), parts);
  },
  /* `opts.inlineCellsMax` (G41): see HELD CELLS above; `opts.yieldNow` (R42). */
  text: async (partsOrBytes, opts) => {
    const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes)
      ? await xlsxParts(partsOrBytes)
      : partsOrBytes;
    /* FW-19 / IC-124: `images` under xl/media/, exhaustive or NULL. */
    /* parts that failed answer the refusal, which `withMetadata`, `withActive` and `withContainerImages` carry unchanged */
    if (!parts || !parts.ok) return withContainerImages(readRefused(parts, true), parts, "xl/media/");
    return withContainerImages(withActive(withMetadata(await xlsxText(parts, opts), parts), parts), parts, "xl/media/");
  },
  /* G41: the typed cells of a range of one sheet, made from the held bytes (an optional slot, as `dialect` is). */
  cellsIn: async (partsOrBytes, range) => {
    const args = cellsInArguments(range);
    if ("reason" in args) return { ok: false, reason: args.reason, ...(args.argument ? { argument: args.argument } : {}) };
    try {
      const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes) ? await xlsxParts(partsOrBytes) : partsOrBytes;
      return await xlsxCellsIn(parts, args);
    } catch {
      return { ok: false, reason: "cells_in_failed" };
    }
  },
};
