/* The three OpenDocument registry entries (I7, QUEUE COFF-10) — `.odt`,
 * `.ods`, `.odp` — built on COFF-9's ODF flavour row in `ooxml.mjs` and
 * emitting the SAME I2 shape and DEC-5 evidentiary envelope the OOXML sibling
 * of the same kind produces.
 *
 * WHY THEY ARE HERE AT ALL. COFF-6 measured ZERO native ODF assets in 43,282
 * oaklandca.gov keys and ruled DO NOT BUILD. That measurement is UNREVISED
 * and still true of native ODF in the wild. What changed is the SOURCE: Bob
 * ruled on 2026-09-14 that a Google Drive link KEEPS THE LINK and the harvest
 * is the OpenDocument EXPORT, which makes ODF the HARVEST format rather than
 * a published one. CAP-8 builds the capture side; without these entries the
 * export would be a document HELD and never READ, which is exactly the
 * document-is-not-the-answer failure `CLAUDE.md` names.
 *
 * WHY ONE MODULE FOR THREE FORMATS, and it is not a shortcut. OOXML is three
 * containers with three part maps — `word/document.xml`, `xl/workbook.xml` +
 * n worksheets, `ppt/presentation.xml` + n slides + n notesSlides — so
 * `docx.mjs`, `formats-xlsx.mjs` and `pptx.mjs` are three container walks.
 * OpenDocument is ONE container walk: `mimetype` says which document kind it
 * is and `content.xml` carries the WHOLE document — body, sheets, slides,
 * speaker notes, tracked changes, annotations and the automatic styles that
 * declare hiddenness, all in one part. The three entries therefore share one
 * `odfParts()` and differ only in the PROJECTION they take of it. Splitting
 * that into three files would triplicate the container walk to keep the
 * filenames tidy.
 *
 * ------------------------------------------------------------------------
 * WHAT EACH ENTRY EMITS, and the sibling whose shape it lands in
 * ------------------------------------------------------------------------
 *
 *   .odt  → `docx.mjs`'s shape.  structure(): {ok, container:"odt",
 *           paragraphs:<int>, links, counts, evidentiary, notes};
 *           text(): {ok, container:"odt", document, paragraphs:[{para, ref,
 *           text}], undetermined, counts:{chars, undetermined}}.
 *           Element references are IC-1's `doc-para`, built by IMPORTING
 *           `docParaRef` from `docx.mjs` — not re-derived here.
 *
 *   .ods  → `formats-xlsx.mjs`'s shape.  structure(): {ok, container:"ods",
 *           sheets:[{sheet, name, sheetId, state, hidden}], links, counts,
 *           evidentiary, notes};
 *           text(): {ok, container:"ods", document, sheets:[{sheet, name,
 *           hidden, text, undetermined, cells}], rangeUnits, rangeUnitsSkipped,
 *           undetermined, counts:{chars, cells, formulas, undetermined}}.
 *           Element references are IC-1's `sheet-cell` and `sheet-range`,
 *           built by IMPORTING `sheetCellRef`, `usedSheetRange` and
 *           `rangeUnitFor` from `formats-xlsx.mjs`.
 *
 *   .odp  → `pptx.mjs`'s shape.  structure(): {ok, container:"odp",
 *           slides:<int>, links, counts, evidentiary, notes};
 *           text(): {ok, container:"odp", document, slides:[{slide, ref,
 *           part, hidden, shapes, text}], speakerNotes:[{slide, ref, part,
 *           hidden, text}], deckLength:<int|null> (COFF-13; null when the
 *           body was not read), undetermined, counts:{chars, notesChars,
 *           undetermined}}.
 *           Element references are IC-1's `slide-shape`, built by IMPORTING
 *           `slideShapeRef` from `pptx.mjs`.
 *
 *   All three structure()s and text()s also carry `active` (R47), the one
 *   list of what can act when the file is opened, in `office-readers` R32's
 *   shape (`activeOf`).
 *
 * NO NEW IC-1 UNION MEMBER WAS NEEDED and none is invented: an OpenDocument
 * text document has paragraphs, a spreadsheet has cells, a presentation has
 * slides and shapes, and those are precisely the three arms IC-1 resolved.
 * I7 is therefore CONFIRMED by three more entries in the existing shape, not
 * changed.
 *
 * Link partitions come from the ONE `linkWrapper` imported from
 * `subresources.mjs` — the same parity pin `pdfstructure.mjs`, `docx.mjs`,
 * `formats-xlsx.mjs` and `pptx.mjs` all make, so FRAMEWORK consumes an
 * OpenDocument export through the identical code path as an HTML page.
 *
 * ------------------------------------------------------------------------
 * THE DEC-5 EVIDENTIARY EXTRAS: WHAT `content.xml` CARRIES, AND WHAT IT
 * CANNOT — STATED PER ENTRY RATHER THAN LEFT TO BE INFERRED FROM SILENCE
 * ------------------------------------------------------------------------
 *
 * This is the part that matters most, because the failure mode here is not a
 * crash: it is a consumer reading an ABSENT envelope item as a fact about the
 * DOCUMENT. `CLAUDE.md`'s sparse-at-every-level rule says absence at one
 * level is never evidence of absence at the next, so every extra this entry
 * does not read is carried as a NAMED `undetermined` in the envelope rather
 * than simply not emitted.
 *
 * MEASURED against real LibreOffice 26.8.0.3 output on 2026-09-14
 * (MEASUREMENTS.md), not read off the spec:
 *
 *   CARRIED BY content.xml, and emitted:
 *     .odt  tracked changes — `<text:tracked-changes>` holds each region's
 *           `<office:change-info>` (author, date) and, for a deletion, the
 *           SUPERSEDED WORDING itself; the body carries `<text:change-start>`
 *           / `<text:change-end>` / `<text:change>` marks that locate it to a
 *           paragraph. Exactly the docx `tracked-change` item, same kind name.
 *     .odt  comments — ODF's `<office:annotation>`, inline in the paragraph
 *           it annotates, with `<dc:creator>` and `<dc:date>`. Emitted as the
 *           same `comment` kind docx emits.
 *     .ods  formulas BESIDE cached values — `table:formula` on the cell,
 *           carried VERBATIM including OpenFormula's `of:` prefix, beside the
 *           displayed value as two named fields on one item. Never collapsed,
 *           never substituted into the text stream.
 *     .ods  hidden sheets — a table whose style declares
 *           `table:display="false"`. The style is in content.xml's own
 *           `<office:automatic-styles>`, so this IS readable from the one
 *           part. VERIFIED on real output: LibreOffice writes the flag on the
 *           table's STYLE, never on the `<table:table>` element; both are
 *           read, because a producer may do either.
 *     .ods  hidden rows and columns — `table:visibility="collapse"|"filter"`.
 *     .odp  SPEAKER NOTES — `<presentation:notes>` nested inside the page.
 *           Emitted as pptx's `speaker-notes` kind, kept OUT of `document`
 *           and counted apart, so no indexer can conflate them with slide
 *           text.
 *     .odp  hidden slides — `presentation:visibility="hidden"`, on the page's
 *           drawing-page style in automatic styles (where LibreOffice writes
 *           it) or on the page element. Extracted in full and FLAGGED.
 *
 *   NOT CARRIED BY content.xml, and READ FROM THEIR OWN PARTS (D-346,
 *   2026-09-25 — until then each was stated in `evidentiary.undetermined` as
 *   `outside_content_xml_not_read`, and both markers are gone because both
 *   parts are now read):
 *     core-properties (creator, title, created/modified, revision) live in
 *           `meta.xml`. Emitted as the SAME `core-properties` item, with the
 *           SAME fields and no others, that the OOXML entries build from
 *           `docProps/core.xml` — mapped by MEANING, not by element name,
 *           because ODF's `dc:creator` is the last editor (`parseOdfMeta`).
 *           A package WITHOUT meta.xml (OpenDocument permits it) is stated as
 *           `{part:"meta.xml", why:"part_absent"}`, so a missing item is
 *           never read as "this document has no author".
 *     embedded members (`Object 1/…`, an OLE blob, `ObjectReplacements/`)
 *           are listed in `META-INF/manifest.xml`, walked, and content-
 *           addressed into `intra` by sha256 exactly as the OOXML entries
 *           address `embeddings/`. Images under `Pictures/` are `text()`'s
 *           IC-124 `images`, not `intra` (`manifestIntraLinks` states the
 *           rule and what it cannot see).
 *
 *   DOES NOT EXIST IN OPENDOCUMENT AT ALL, as distinct from not read:
 *     a sheet's numeric id (xlsx's `sheetId`) — ODF identifies a table by
 *           name only, so `sheetId` is null and that null is the format
 *           speaking, not this reader.
 *     "veryHidden" — ODF's table visibility is a boolean, so `state` is
 *           "visible" or "hidden" and never xlsx's third value.
 *     a run index on a `doc-para` reference — `<text:span>` is a formatting
 *           artifact exactly as `<w:r>` is, but it is NOT the same unit, and
 *           emitting a span index under the field docx fills with a run index
 *           would assert a correspondence nothing established. References
 *           from these entries carry `para` and stop there (IC-1 makes `run`
 *           optional for precisely this reason).
 *
 * THE DETECT LADDER is the siblings' ladder, with ONE difference forced by
 * the format and named where it is made (see `detectOdf`): the OOXML entries
 * answer "likely" from part NAMES because their discriminating declaration is
 * deflated out of a synchronous detect's reach. ODF's discriminating
 * declaration — the `mimetype` member — is required by OpenDocument 1.2 part
 * 3 §3.3 to be FIRST and STORED, so it is reachable synchronously, and the
 * entries answer from the VALUE. Reading part names alone would be worse than
 * imprecise here: all three flavours have identical part names, so a
 * names-only ladder would make the first-registered entry claim every
 * OpenDocument package.
 *
 * THE SIZE BOUND is COFF-6's measured metric enacted in `ooxml.mjs`: 20 MiB
 * of DECLARED UNCOMPRESSED text-part bytes, summed from the central directory
 * BEFORE inflation. For ODF the text part is `content.xml` alone. Over the
 * bound the container walk and discrimination still run and text extraction
 * is refused as a STATED text-undetermined carrying the guard's own marker
 * verbatim (with its size, and `final: true`: R35 reads the other four
 * formats' text in pieces, and ODF is the one it does not, K4489) — the
 * docx.mjs pattern, never a silent truncation. Under it, the
 * REPEATS content.xml compresses are expanded within a second bound,
 * `ODF_REPEAT_EXPANSION_MAX` (R45; see the meter below), and a read that
 * would cross it is answered the same way with its own marker.
 *
 * FIX ROUND 9 (T51; R49–R55), in one place:
 *   - every part read for text (`content.xml`, `meta.xml`, `styles.xml`, the manifest) goes through one reader
 *     (`readXmlText`): decoded by ooxml's `decodeText` (R54), checked
 *     for a character reference that names no scalar value (R51: the part is stated unreadable, final), and made linear to
 *     walk (R52: one scan that turns any unclosed opener, or a tag over 64 KiB, into text, so no walk meets a token that
 *     never ends and no hostile run costs more than one scan);
 *   - a sheet is read a row at a time (`sheetRows`), in windows of tokens between which `yieldNow` is awaited (R49): the
 *     cells are listed only while their JSON is within `inlineCellsMax`, `cellsIn` makes any range from the same walk;
 *   - a covered table cell advances its column (R50); an annotation, a footnote, an endnote and a text box inside a
 *     paragraph are units of their own, with their kind, in `parts` (R53), and so are the master pages of `styles.xml`.
 *
 * This module ASSERTS nothing about meaning (FRAMEWORK's, through I2) and
 * WRITES nothing. Never invent structure: everything unreadable is stated.
 */

import {
  hasZipMagic, readContainer, readPart, normalizePartName, crc32,
  discriminate, sizeGuard, declaredTextBytes, IMAGE_MIME_BY_EXT, MEASURED_OOXML_TEXT_BOUND_BYTES,
  CONTAINER_FLAVOURS, ODF_MIMETYPE_PART, ODF_MANIFEST_PART, ODF_MIMETYPE_MAX_BYTES,
  withContainerImages,
} from "./ooxml.mjs";
import * as ooxml from "./ooxml.mjs";
import { boundOf } from "./read-bounds.mjs";
import { linkWrapper } from "./subresources.mjs";
import { docParaRef, docTableRef } from "./docx.mjs";
import { sheetCellRef, usedSheetRange, a1Corner, rangeUnitFor } from "./formats-xlsx.mjs";
import { slideShapeRef } from "./pptx.mjs";
import { word, localize } from "./setup-words/index.mjs";

/* ------------------------------------------------------------------ *
 * The kinds this module takes and hands back
 * ------------------------------------------------------------------ */

/**
 * @typedef {any} OoxmlContainer ooxml's `readContainer` answer (`{ok, entries, byName, why}`), read here and handed
 *   back to ooxml's own readers as ooxml hands it: ooxml states no kind for it yet.
 */
/**
 * @typedef {Object} OdfRow one `partMap:"odf"` row of ooxml's CONTAINER_FLAVOURS
 * @property {string} partMap
 * @property {string} flavour
 * @property {string} mimetype
 * @property {string} conventionalMainPart
 */
/** @typedef {ReadonlyMap<string, string>} Attrs an element's attributes by local name (R56: `calcext-value-type` apart) */
/** @typedef {{ attrs: Attrs, inner: string }} Element an element's attributes and the raw markup between its tags */
/** @typedef {{ name: string, attrs: Attrs, inner: string }} NamedElement an element with its local name */
/**
 * @typedef {Object} Meter one content.xml read's meter (R45, R49, R52)
 * @property {number} units the repeat units spent
 * @property {number} chars the characters repeats copied
 * @property {number} tokens the tokens the walks read
 * @property {number} last the token count at the last yield
 */
/**
 * @typedef {Object} SizeMarker ooxml's size-guard marker, with `final` (R13, R48)
 * @property {false} ok the size guard's own `ok: false`
 * @property {string} text always "undetermined"
 * @property {string} why "over_size_bound"
 * @property {number} size the declared bytes
 * @property {number} bound
 * @property {string} boundName
 * @property {string} metric
 * @property {boolean} final
 */
/**
 * @typedef {Object} RepeatMarker the repeat bound's marker, in the size guard's place (R45)
 * @property {string} text always "undetermined"
 * @property {string} why "over_repeat_bound"
 * @property {number} units the count reached when the read stopped
 * @property {number} bound
 * @property {string} boundName
 * @property {string} metric
 * @property {boolean} final
 */
/** @typedef {SizeMarker | RepeatMarker} BoundMarker */
/**
 * @typedef {Object} PartStatement a part not read, or read with a statement (R28, R51, R52, R54)
 * @property {string} part
 * @property {string} why
 * @property {boolean} [final]
 * @property {string | null | undefined} [name] the encoding named, for ENCODING_UNSUPPORTED
 * @property {string} [detail]
 * @property {number} [replaced]
 * @property {number} [count]
 * @property {BoundMarker} [guard] the marker, on the envelope's statement of a bound
 */
/**
 * @typedef {Object} ActiveItem one finding of what can act when the file is opened (R47, office-readers R32)
 * @property {string} kind "odf-basic", "odf-script", "embedded-file", "launch" or "unread"
 * @property {string} part
 * @property {string | null} [event]
 * @property {string} [why]
 */
/**
 * @typedef {Object} CoreProperties meta.xml read as OOXML's core properties (R29)
 * @property {true} ok
 * @property {string | null} creator
 * @property {string | null} lastModifiedBy
 * @property {string | null} revision
 * @property {number | null} revisionNumber
 * @property {string | null} created
 * @property {string | null} modified
 * @property {string | null} title
 */
/** @typedef {{ kind: string, ref: string, para: number }} DocParaRef IC-1's `doc-para`, built by office-readers */
/** @typedef {{ kind: string, ref: string, table: number }} DocTableRef IC-1's `doc-table`, built by office-readers */
/** @typedef {{ kind: string, ref: string, sheet: string, cell: string }} SheetCellRef IC-1's `sheet-cell`, built by office-readers */
/** @typedef {{ kind: string, ref: string, sheet: string, range: string }} SheetRangeRef IC-1's `sheet-range`, built by office-readers */
/** @typedef {{ kind: string, ref: string, slide: number, shape?: number }} SlideShapeRef IC-1's `slide-shape`, built by office-readers */
/** @typedef {DocParaRef | SheetCellRef | SlideShapeRef} ElementRef */
/**
 * @typedef {{ fragment: string, name: string } | { url: string } | { why: string, name: string }
 *   | { sha256: string, name: string, bytes: number }} LinkTarget
 */
/**
 * @typedef {Object} Link one link, partitioned as subresources' linkWrapper partitions it (R7, R17, R23, R29)
 * @property {"anchor" | "intra" | "deferred" | "refused" | "undetermined"} partition
 * @property {string | null} wrapper
 * @property {LinkTarget} target
 * @property {ElementRef | null} source
 */
/** @typedef {{ anchor: number, intra: number, deferred: number, refused: number, undetermined: number }} PartitionCounts */
/**
 * @typedef {Object} TrackedChangeItem (R8)
 * @property {"tracked-change"} kind
 * @property {string} change "insertion" or "deletion"
 * @property {string | null} author
 * @property {string | null} date
 * @property {DocParaRef | null} source
 * @property {string | null} [superseded]
 * @property {string | null} [text]
 * @property {string} [why]
 */
/**
 * @typedef {Object} CommentItem (R9)
 * @property {"comment"} kind
 * @property {string | null} id
 * @property {string | null} author
 * @property {string | null} date
 * @property {string | null} initials
 * @property {string} text
 * @property {DocParaRef | null} source
 */
/**
 * @typedef {Object} FormulaItem (R15)
 * @property {"formula"} kind
 * @property {SheetCellRef} source
 * @property {string} formula
 * @property {string | null} value
 */
/** @typedef {{ min: number, max: number, visibility: string }} HiddenRange a hidden run of rows or columns (R16) */
/** @typedef {{ kind: "hidden-rows", sheet: string, rows: HiddenRange[], count: number, source: null }} HiddenRowsItem */
/** @typedef {{ kind: "hidden-cols", sheet: string, cols: HiddenRange[], count: number, source: null }} HiddenColsItem */
/** @typedef {{ kind: "hidden-sheet", sheet: string, state: string, source: null }} HiddenSheetItem */
/** @typedef {{ kind: "speaker-notes", slide: number, part: string, text: string, source: SlideShapeRef }} SpeakerNotesItem (R22) */
/** @typedef {{ kind: "hidden-slide", slide: number, part: string, source: SlideShapeRef }} HiddenSlideItem (R22) */
/**
 * @typedef {Object} CorePropertiesItem (R29)
 * @property {"core-properties"} kind
 * @property {string | null} creator
 * @property {string | null} lastModifiedBy
 * @property {string | null} revision
 * @property {number | null} revisionNumber
 * @property {string | null} created
 * @property {string | null} modified
 * @property {string | null} title
 * @property {null} source
 */
/**
 * @typedef {TrackedChangeItem | CommentItem | FormulaItem | HiddenRowsItem | HiddenColsItem | HiddenSheetItem
 *   | SpeakerNotesItem | HiddenSlideItem | CorePropertiesItem} EvidentiaryItem
 */
/**
 * @typedef {Object} Envelope the DEC-5 evidentiary envelope
 * @property {string} container
 * @property {string[]} kinds
 * @property {EvidentiaryItem[]} items
 * @property {PartStatement[]} undetermined
 * @property {{ [kind: string]: number }} counts
 */
/**
 * @typedef {Object} OdfParts parts()'s answer on success (R3)
 * @property {true} ok
 * @property {string} format
 * @property {OdfRow} row
 * @property {Uint8Array} bytes
 * @property {OoxmlContainer} container
 * @property {string | null} contentXml
 * @property {string | null} stylesXml
 * @property {{ total: number, parts: { name: string, declared: number }[] }} declared
 * @property {SizeMarker | null} guard
 * @property {CoreProperties | null} core
 * @property {Link[]} embedded
 * @property {string | null} manifestWhy
 * @property {PartStatement[]} undetermined
 * @property {ActiveItem[]} active
 * @property {PartStatement[]} statements
 * @property {number} scanned
 * @property {RepeatMarker} [repeat] the repeat bound's marker, on the re-run of a projection that crossed it (R45)
 */
/**
 * @typedef {Object} PartsFailure parts()'s answer on failure (R3)
 * @property {false} ok
 * @property {string} container
 * @property {string} why
 * @property {string | null} part
 * @property {string | null} flavourDeclared
 * @property {string[]} signals
 */
/** @typedef {OdfParts | PartsFailure} PartsResult */
/** @typedef {PartsResult | ArrayBuffer | ArrayBufferView} PartsOrBytes parts()'s output, or raw bytes read through it */
/** @typedef {{ format: string, confidence: string, signals: string[] }} Detected detect()'s claim (R1, R2) */
/** @typedef {{ ok: false, container: string, reason: string, part: string | null }} ProjectionFailure (R5, R38) */
/**
 * @typedef {Object} TextOptions what text() accepts beside its parts (R49)
 * @property {number} [inlineCellsMax] bytes of the cells' JSON a whole read lists; past it every sheet's cells are held
 * @property {unknown} [yieldNow] awaited between windows when it is a function; anything else is no yield
 */
/**
 * @typedef {Object} ReadCtx one projection's read: its meter and the caller's options
 * @property {Meter} meter
 * @property {TextOptions | undefined} opts
 * @property {unknown} yieldNow
 */
/**
 * @typedef {Object} TextUnit one part of a document that is not a body paragraph, with its kind (R53)
 * @property {string} kind
 * @property {string} ref
 * @property {string} part
 * @property {string} text
 * @property {number[]} [paras]
 * @property {boolean} [hidden]
 */
/**
 * @typedef {Object} TextStatement text()'s statement of what it could not read, or read with a statement
 * @property {string} [reason]
 * @property {string} [part]
 * @property {string} [why]
 * @property {boolean} [final]
 * @property {string | null | undefined} [name]
 * @property {number} [replaced]
 * @property {number} [count]
 * @property {string} [detail]
 * @property {BoundMarker} [guard]
 * @property {null} [sheet]
 * @property {null} [cell]
 */
/** @typedef {BoundMarker | TextStatement} TextUndetermined */
/** @typedef {{ kind: string, ref: string, part: string, mime: string | null, name: string | null }} ImageRef an image's unit, built by ooxml */
/** @typedef {{ images: ImageRef[] | null, imagesWhy?: string }} ImagesPart text()'s `images` (R30), added by ooxml's withContainerImages */

const UTF8 = new TextDecoder();                // UTF-8, replacing what does not decode

/** Bytes as a Uint8Array view, from a Uint8Array, an ArrayBuffer, any typed
 *  view or a plain byte array; anything else reads as NO bytes (null), so a
 *  caller's odd argument is answered as "not this format", never a throw.
 *  @param {unknown} x
 *  @returns {Uint8Array | null} */
function asBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  if (Array.isArray(x)) { try { return Uint8Array.from(x); } catch { return null; } }
  return null;
}

/* ------------------------------------------------------------------ *
 * R45 (N30) — REPEATS ARE EXPANDED WITHIN A BOUND
 * ------------------------------------------------------------------ */

/* WHY A SECOND BOUND. COFF-6's guard bounds the BYTES of content.xml, but ODF
 * compresses runs: `table:number-columns-repeated`, `table:number-rows-
 * repeated` and `<text:s text:c>` each make one short element stand for many.
 * Expanded without a bound, a few hundred bytes hang the reader or end in
 * `reader_failed:RangeError` (`text:c="2000000000"`). So every expansion is
 * paid for, before it is made, from a meter one `content.xml` read owns:
 *   - one unit per cell given at one address (a carrying cell's column repeat
 *     times its row's repeat), and one per link a repeated address carries
 *     after the cell's first (the link at the first address is literal markup);
 *   - one unit per hidden row range listed (R16);
 *   - one unit per space a `<text:s text:c>` stands for, each time the text
 *     holding it is given;
 *   - and, apart from the units, the CHARACTERS a repeat copies: a repeated
 *     cell's text at each address after its first counts against COFF-6's own
 *     figure, so repeats produce no more text than the byte bound admits
 *     written out (the parity BOB's measurement rests on; J2).
 * An empty run advanced over, and a figure that only accumulates (R12's
 * rows/cols, R18's used extent), costs nothing. Past either bound the read
 * stops and the entry answers as over the size guard, with its own marker.
 *
 * THE CAP IS MEASURED (build/plan/draft-T13-wordings.md §5, in git history):
 * 262,144 = 2^18 sits between the literal carrying cells the 20 MiB bound
 * admits (338,250 numeric, 255,750 string), and `text()` at that many units
 * cost 183–646 ms and 78–112 MB of heap in node. */
export const ODF_REPEAT_EXPANSION_MAX = boundOf("ods", "repeat_units");
/* The characters a repeat may copy: the text bound, the same READ_BOUNDS row as `content.xml`'s own (R48). */
const REPEAT_TEXT_BOUND_CHARS = boundOf("ods", "content_xml");
/* R52: a tag longer than this is text, and the XML scan never reads further for one. */
const TAG_MAX_CHARS = boundOf("xml", "tag");
/* R49, R52: a window of reading is this many tokens; between windows `yieldNow` is awaited. */
const WINDOW_TOKENS = 65536;

/** Thrown out of a metered read the moment it would cross a bound, and caught
 *  only by `metered` callers, which answer with its marker. */
class OverRepeatBound extends Error {
  /** @param {RepeatMarker} marker */
  constructor(marker) {
    super("over_repeat_bound");
    /** @type {RepeatMarker} */
    this.marker = marker;
  }
}

/* The running read's meter. Every projection that expands anything runs its synchronous pieces under `withMeter`,
 * which installs the read's own meter and restores the one before it, so two reads in flight at once (R49: a read awaits
 * `yieldNow` between windows) never share a count. `tokens` counts the tokens the walks have read, and `last` the count
 * at the last yield (R52). */
/** @type {Meter | null} */
let meter = null;

/** @returns {Meter} */
const newMeter = () => ({ units: 0, chars: 0, tokens: 0, last: 0 });

/** The running read's meter, which every expansion needs.
 *  @returns {Meter} */
function currentMeter() {
  const running = meter;
  if (!running) throw new Error("odf.mjs: an expansion ran outside a metered read");
  return running;
}

/**
 * @template T
 * @param {Meter} m
 * @param {() => T} fn
 * @returns {T}
 */
function withMeter(m, fn) {
  const saved = meter;
  meter = m;
  try { return fn(); } finally { meter = saved; }
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
const metered = (fn) => withMeter(newMeter(), fn);

/** True when a window of tokens has been read since the last yield.
 *  @param {Meter | null} [m] */
const windowDue = (m = meter) => m != null && m.tokens - m.last >= WINDOW_TOKENS;

/** Let the caller's turn pass (R49): a `yieldNow` that is not a function is no yield; one that throws or rejects is
 *  ignored, and the answer does not depend on it. */
/** @param {ReadCtx} ctx */
async function letPass(ctx) {
  ctx.meter.last = ctx.meter.tokens;
  const yieldNow = ctx.yieldNow;
  if (typeof yieldNow !== "function") return;
  try { await yieldNow.call(ctx); } catch { /* a yield that fails is no yield */ }
}

/** Run a generator of windows to its end under the read's meter, awaiting the pass between its yields.
 * @template T
 * @param {Generator<undefined, T, undefined>} gen
 * @param {ReadCtx} ctx
 * @returns {Promise<T>}
 */
async function drive(gen, ctx) {
  for (;;) {
    const r = withMeter(ctx.meter, () => gen.next());
    if (r.done) return r.value;
    await letPass(ctx);
  }
}

/** The same generator run without passes (structure(), which gives the thread back to no one).
 * @template T
 * @param {Generator<undefined, T, undefined>} gen
 * @returns {T}
 */
function driveSync(gen) {
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
}

/** Pay `n` units before expanding them, or stop the read. `units` in the
 *  marker is the count reached when it stopped: one past the bound. */
/** @param {number} n */
function spend(n) {
  const meter = currentMeter();
  if (!(n > 0)) return;
  if (meter.units + n > ODF_REPEAT_EXPANSION_MAX) {
    throw new OverRepeatBound({ text: "undetermined", why: "over_repeat_bound",
      units: ODF_REPEAT_EXPANSION_MAX + 1, bound: ODF_REPEAT_EXPANSION_MAX,
      boundName: "ODF_REPEAT_EXPANSION_MAX", metric: "expanded_repeat_units", final: true });
  }
  meter.units += n;
}

/** Pay for `n` characters a repeat copies, or stop the read. */
/** @param {number} n */
function spendChars(n) {
  const meter = currentMeter();
  if (!(n > 0)) return;
  if (meter.chars + n > REPEAT_TEXT_BOUND_CHARS) {
    throw new OverRepeatBound({ text: "undetermined", why: "over_repeat_bound",
      units: REPEAT_TEXT_BOUND_CHARS + 1, bound: REPEAT_TEXT_BOUND_CHARS,
      boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "repeated_text_chars", final: true });
  }
  meter.chars += n;
}

/* ------------------------------------------------------------------ *
 * The part-map, taken from COFF-9's TABLE and never from a literal
 * ------------------------------------------------------------------ */

/* DISPATCH IS ON `partMap:"odf"`, NOT ON FLAVOUR NAMES. Every media type and
 * every main part name below is READ OUT of COFF-9's rows rather than spelled
 * again here, so a fourth OpenDocument kind (`.odg`, `.odf`) becomes one row
 * in `ooxml.mjs` plus one projection here — and, more to the point, these
 * entries cannot drift from the discriminator they dispatch on, because there
 * is only one place the facts live. */
const ODF_ROWS = CONTAINER_FLAVOURS.filter((f) => f?.partMap === "odf");

/**
 * @param {string} flavour
 * @returns {OdfRow}
 */
function odfRow(flavour) {
  const row = ODF_ROWS.find((f) => f?.flavour === flavour);
  /* Not defensive decoration: if COFF-9's table ever stopped carrying a row
   * these entries project, the honest outcome is a loud failure at module
   * load rather than three entries silently detecting nothing. (Every
   * `partMap:"odf"` row carries its `mimetype`.) */
  if (!row || !("mimetype" in row)) throw new Error(`odf.mjs: no partMap:"odf" row for "${flavour}" in ooxml.mjs`);
  return row;
}

export const ODT_ROW = odfRow("odt");
export const ODS_ROW = odfRow("ods");
export const ODP_ROW = odfRow("odp");

/** The three OpenDocument media types, from the table — these are also the
 *  content types CAP-8's Drive handler must ask Google's export endpoint for
 *  (`export?format=odt|ods|odp`) and the types the entries answer on in the
 *  registry's content-type pass. */
export const ODT_CONTENT_TYPE = ODT_ROW.mimetype;
export const ODS_CONTENT_TYPE = ODS_ROW.mimetype;
export const ODP_CONTENT_TYPE = ODP_ROW.mimetype;

/** The one part every entry reads. Taken from the row, not spelled here. */
const CONTENT_PART = normalizePartName(ODT_ROW.conventionalMainPart);

/** `meta.xml` — read for the `core-properties` item (D-346); named so its
 *  absence or unreadability is stated with the part that would have carried it. */
const META_PART = "meta.xml";

/* ------------------------------------------------------------------ *
 * Minimal XML plumbing. Local for the same reason docx.mjs and pptx.mjs
 * keep their own: ooxml.mjs's matchers are flat by design, and every walk
 * below needs NESTING (a paragraph inside a table cell inside a sheet; a
 * notes frame inside a page; an annotation inside the paragraph whose text
 * must exclude it). Same dependency-free discipline: what these patterns
 * cannot read yields a stated undetermined, never a guessed structure.
 * ------------------------------------------------------------------ */

/** @param {string} s */
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (/** @type {string} */ m, /** @type {string} */ e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      /* An out-of-range code point (`&#99999999;`) is left as written: it
         names no character, and fromCodePoint would throw on it. */
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e] ?? m;
  });
}

/* One pass over the raw attribute text of a tag, left to right, each character read once (R52: a regular expression
 * with a backtracking name group took quadratic time on a long run of name characters). A name is a run of name
 * characters (a prefix, a colon, a local name), then `=`, then a quoted value; anything else is skipped past. */
/** @param {number} c */
const isNameChar = (c) => (c >= 48 && c <= 58) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45 || c === 46;
/** @param {number} c */
const isSpaceChar = (c) => c === 32 || (c >= 9 && c <= 13);

/**
 * @param {string | undefined} raw
 * @returns {Attrs}
 */
function attrsOf(raw) {
  const attrs = new Map(/** @type {[string, string][]} */ ([]));
  const s = String(raw || "");
  const n = s.length;
  let i = 0;
  while (i < n) {
    if (!isNameChar(s.charCodeAt(i))) { i++; continue; }
    let j = i + 1;
    while (j < n && isNameChar(s.charCodeAt(j))) j++;
    const name = s.slice(i, j);
    let k = j;
    while (k < n && isSpaceChar(s.charCodeAt(k))) k++;
    if (s.charCodeAt(k) !== 61) { i = j; continue; }          // no `=`
    k++;
    while (k < n && isSpaceChar(s.charCodeAt(k))) k++;
    const q = s.charCodeAt(k);
    if (q !== 34 && q !== 39) { i = j; continue; }            // no quote
    const e = s.indexOf(q === 34 ? '"' : "'", k + 1);
    if (e < 0) { i = j; continue; }
    const local = name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name;
    /* R56: `calcext:value-type` (LibreOffice's refinement, "error") shares its local name with `office:value-type`, which
       decides a cell's type whichever the file writes first; calcext's is kept apart, for a cell with no office type. */
    attrs.set(name === "calcext:value-type" ? "calcext-value-type" : local, decodeEntities(s.slice(k + 1, e)));
    i = e + 1;
  }
  return attrs;
}

/** No attributes. @type {Attrs} */
const NO_ATTRS = new Map(/** @type {[string, string][]} */ ([]));

/** @param {string} n */
const localOf = (n) => (n.includes(":") ? n.slice(n.lastIndexOf(":") + 1) : n);

/* One token pass over the document: an open/close/self-closing tag, or a
 * comment / CDATA / processing instruction skipped whole. Group 1 is the tag
 * name (undefined for the skipped forms), group 2 the raw attributes, group 3
 * the self-closing slash.
 *
 * A FACTORY, NOT A SHARED CONSTANT, and this cost a measured hang before it
 * was one. `docx.mjs` and `pptx.mjs` each hold ONE module-level `/g` regex
 * and reset `lastIndex` at the top of their single walk, which is safe there
 * because neither walk calls anything that walks. Every walk in THIS module
 * nests — a paragraph's text is read while the body walk is mid-scan, a
 * page's notes while its shapes are — and a `/g` regex carries ONE
 * `lastIndex`, so the inner call's reset rewound the outer loop to the start
 * of the document and it never terminated. A fresh instance per call has no
 * shared cursor to corrupt. */
const TOKEN_SOURCE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([\w.-]+(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/)?>/.source;
/** @typedef {{ exec(xml: string): RegExpExecArray | null, readonly lastIndex: number }} Tokens */
/** @returns {Tokens} */
const tokens = () => {
  const re = new RegExp(TOKEN_SOURCE, "g");
  return {
    /** @param {string} xml */
    exec(xml) {
      const m = re.exec(xml);
      const running = meter;
      if (m !== null && running !== null) running.tokens++;
      return m;
    },
    get lastIndex() { return re.lastIndex; },
  };
};

/** Every element with this LOCAL name at any depth: `{ attrs, inner }`, where
 *  `inner` is the raw markup between the tags ("" for self-closing). Unlike
 *  ooxml.mjs's flat matcher this one is NESTING-AWARE: it counts opens and
 *  closes of the same local name, so `<draw:g>` inside `<draw:g>` does not
 *  end the outer one early. Only TOP-LEVEL occurrences are returned (a nested
 *  match is inside its parent's `inner`, where the caller can recurse). */
/**
 * @param {string} xml
 * @param {string} localName
 * @param {number} [limit]
 * @returns {Element[]}
 */
function elementsNested(xml, localName, limit = Infinity) {
  /** @type {Element[]} */
  const out = [];
  for (const el of iterNested(xml, new Set([localName]))) {
    out.push({ attrs: el.attrs, inner: el.inner });
    if (out.length >= limit) break;
  }
  return out;
}

/** The same walk, one top-level element at a time as it is found, for any of a set of local names: a sheet's rows are
 *  read this way so that no more than the row in hand is held (R49). Yields `{name, attrs, inner}`. */
/**
 * @param {string} xml
 * @param {ReadonlySet<string>} names
 * @returns {Generator<NamedElement, void, undefined>}
 */
function* iterNested(xml, names) {
  const RE = tokens();
  let depth = 0;
  /** @type {{ start: number, attrs: Attrs, name: string } | null} the top-level element open now */
  let open = null;
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const local = localOf(m[1]);
    if (!names.has(local)) continue;
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    if (closing) {
      depth--;
      const was = open;
      if (depth === 0 && was !== null) {
        const el = { name: was.name, attrs: was.attrs, inner: xml.slice(was.start, m.index) };
        open = null;
        yield el;
      }
      continue;
    }
    if (selfClosed) {
      if (depth === 0) yield { name: local, attrs: attrsOf(m[2]), inner: "" };
      continue;
    }
    if (depth === 0) open = { start: RE.lastIndex, attrs: attrsOf(m[2]), name: local };
    depth++;
  }
}

/** Strip every element with this local name, with its content, from a markup
 *  string — nesting-aware. Used to keep an annotation's own text out of the
 *  paragraph it annotates, and a page's speaker notes out of the slide's own
 *  text: in both cases the nested content is REAL and is emitted SEPARATELY,
 *  so merging it here would be the conflation DEC-5 forbids. */
/**
 * @param {string} xml
 * @param {string} localName
 * @returns {string}
 */
function stripElement(xml, localName) {
  let out = "";
  let cut = 0;
  const RE = tokens();
  let depth = 0, start = -1;
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m[1] === undefined) continue;
    if (localOf(m[1]) !== localName) continue;
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    if (selfClosed) {
      if (depth === 0) { out += xml.slice(cut, m.index); cut = RE.lastIndex; }
      continue;
    }
    if (closing) {
      depth--;
      if (depth === 0 && start >= 0) { cut = RE.lastIndex; start = -1; }
      continue;
    }
    if (depth === 0) { out += xml.slice(cut, m.index); start = m.index; }
    depth++;
  }
  return out + xml.slice(cut);
}

/** The visible text of a run of ODF markup: character data, with `<text:s>`
 *  (a run of spaces), `<text:tab>` and `<text:line-break>` honoured, and
 *  every element's markup dropped. ODF encodes repeated spaces as
 *  `<text:s text:c="n"/>` rather than literal runs, so ignoring it would
 *  silently close up gaps in the extracted text. Each space is paid for
 *  before it is made (R45), so `text:c="2000000000"` stops the read rather
 *  than ending in a RangeError. */
/**
 * @param {string} xml
 * @returns {string}
 */
function visibleText(xml) {
  let out = "";
  let prev = 0;
  const RE = tokens();
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m.index > prev) out += decodeEntities(xml.slice(prev, m.index));
    prev = RE.lastIndex;
    if (m[1] === undefined) continue;
    if (m[0][1] === "/") continue;
    const name = localOf(m[1]);
    if (name === "s") {
      const c = parseInt(attrsOf(m[2]).get("c") ?? "1", 10);
      const n = Number.isFinite(c) && c > 0 ? c : 1;
      spend(n);
      out += " ".repeat(n);
    } else if (name === "tab") out += "\t";
    else if (name === "line-break") out += "\n";
  }
  if (xml.length > prev) out += decodeEntities(xml.slice(prev));
  return out;
}

/* ------------------------------------------------------------------ *
 * Automatic styles — the reason hiddenness is readable from ONE part
 * ------------------------------------------------------------------ */

/** `<office:automatic-styles>` maps a style NAME to the properties a document
 *  element references by `*:style-name`. Both hidden-sheet and hidden-slide
 *  live there in real producer output, which is what makes them derivable
 *  from content.xml alone. Returns
 *  `{ tableDisplay: Map(name → boolean), pageVisible: Map(name → boolean) }`;
 *  a style that declares neither appears in neither map, so "absent" is
 *  distinguishable from "declared true". */
/** @typedef {{ tableDisplay: Map<string, boolean>, pageVisible: Map<string, boolean> }} AutomaticStyles */
/** No automatic styles: content.xml was not read.
 *  @returns {AutomaticStyles} */
const noStyles = () => ({ tableDisplay: new Map(/** @type {[string, boolean][]} */ ([])), pageVisible: new Map(/** @type {[string, boolean][]} */ ([])) });
/**
 * @param {string} xml
 * @returns {AutomaticStyles}
 */
function automaticStyles(xml) {
  const tableDisplay = new Map(/** @type {[string, boolean][]} */ ([]));
  const pageVisible = new Map(/** @type {[string, boolean][]} */ ([]));
  for (const block of elementsNested(xml, "automatic-styles")) {
    for (const st of elementsNested(block.inner, "style")) {
      const name = st.attrs.get("name");
      if (!name) continue;
      if (st.attrs.get("family") === "table") {
        for (const p of elementsNested(st.inner, "table-properties")) {
          if (p.attrs.get("display") != null) tableDisplay.set(name, p.attrs.get("display") !== "false");
        }
      } else if (st.attrs.get("family") === "drawing-page") {
        for (const p of elementsNested(st.inner, "drawing-page-properties")) {
          if (p.attrs.get("visibility") != null) pageVisible.set(name, p.attrs.get("visibility") !== "hidden");
        }
      }
    }
  }
  return { tableDisplay, pageVisible };
}

/* ------------------------------------------------------------------ *
 * Link classification — the SAME partition rule pdfstructure, docx,
 * formats-xlsx and pptx apply
 * ------------------------------------------------------------------ */

/** @param {string} uri */
function classifyUri(uri) {
  const m = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(uri || "");
  const scheme = m && m[1] !== undefined ? m[1].toLowerCase() : null;
  if (scheme === "http" || scheme === "https") return "deferred";
  if (!scheme && uri) return "deferred";
  return "refused";
}

/**
 * @param {string} uri
 * @param {ElementRef | null} source
 * @returns {Link}
 */
function linkRecord(uri, source) {
  /* An `xlink:href` that is a bare fragment is an INTERNAL reference — a
   * bookmark, a named range, a slide jump — final at capture, so it is an
   * `anchor` exactly as a docx bookmark link and a PDF GoTo are. */
  if (typeof uri === "string" && uri.startsWith("#")) {
    return { partition: "anchor", wrapper: linkWrapper.anchor(uri),
      target: { fragment: uri, name: uri.slice(1) }, source };
  }
  const partition = classifyUri(uri);
  return {
    partition,
    wrapper: partition === "deferred" ? linkWrapper.deferred(uri) : linkWrapper.refused(),
    target: { url: uri },
    source,
  };
}

/** Every `xlink:href`-bearing link element inside a run of markup, in document
 *  order: ODF's `<text:a>` (text documents, sheet cells, shape text) and
 *  `<draw:a>` (a whole shape made clickable). Returns the raw hrefs — the
 *  caller attaches the element reference it alone knows. */
/**
 * @param {string} xml
 * @returns {string[]}
 */
function hrefsIn(xml) {
  /** @type {string[]} */
  const out = [];
  const RE = tokens();
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m[1] === undefined || m[0][1] === "/") continue;
    if (localOf(m[1]) !== "a") continue;
    const href = attrsOf(m[2]).get("href");
    if (href != null) out.push(href);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The SYNCHRONOUS stored-member read — the one duplication in this
 * module, made deliberately and bounded to the case that forces it
 * ------------------------------------------------------------------ */

/* WHY THIS EXISTS. I7's `detect(bytes, contentType)` is SYNCHRONOUS: the
 * registry does not await it. `ooxml.mjs`'s `readPart` is async because it
 * may INFLATE. The `mimetype` member never needs inflating — OpenDocument 1.2
 * part 3 §3.3 requires it STORED, and COFF-9 pinned a refusal for any package
 * that disobeys — so the value the three entries must discriminate on is
 * reachable without awaiting anything.
 *
 * WHAT IT WILL NOT DO, so it cannot become a second ZIP reader: it reads
 * method 0 ONLY (a compressed member returns null, which is the same
 * conformance rule stated as an absence), it refuses anything over
 * `ODF_MIMETYPE_MAX_BYTES`, and it verifies length AND CRC-32 against the
 * central directory with `ooxml.mjs`'s OWN exported `crc32` — so a value that
 * passes here has passed exactly the checks `readPart` would have applied.
 * Every other part in this module goes through `readPart`. */
/**
 * @param {Uint8Array} bytes
 * @param {OoxmlContainer} container
 * @param {string} name
 * @param {number} maxBytes
 * @returns {string | null}
 */
function readStoredMemberSync(bytes, container, name, maxBytes) {
  const want = normalizePartName(name);
  const entry = container.byName.get(want)
    ?? container.entries.find((/** @type {OoxmlContainer} */ e) => normalizePartName(e.name) === want);
  if (!entry) return null;
  if (entry.method !== 0) return null;                    // not stored: ODF's own rule, as an absence
  if (entry.uncompressedSize > maxBytes) return null;     // the COFF-9 bound
  const lh = entry.localHeaderOffset;
  if (lh + 30 > bytes.length) return null;
  /* Each of the four bytes is inside `bytes`: `lh + 30` is within its length. */
  const nameLen = (bytes[lh + 26] ?? 0) | ((bytes[lh + 27] ?? 0) << 8);
  const extraLen = (bytes[lh + 28] ?? 0) | ((bytes[lh + 29] ?? 0) << 8);
  const start = lh + 30 + nameLen + extraLen;
  const end = start + entry.compressedSize;
  if (end > bytes.length) return null;
  const out = bytes.subarray(start, end);
  if (out.length !== entry.uncompressedSize) return null;
  if (crc32(out) !== entry.crc32) return null;
  return UTF8.decode(out);
}

/* ------------------------------------------------------------------ *
 * Reading a part to text: decoded (R54), its references checked (R51), its markup made linear to walk (R52)
 * ------------------------------------------------------------------ */

/** The `encoding` an XML declaration states, from the first bytes read as Latin-1 (every encoding a declaration
 *  names starts ASCII-compatibly, UTF-16 aside, which a BOM or the NUL pattern settles first), else null. */
/**
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
function declaredEncoding(bytes) {
  const head = Array.from(bytes.subarray(0, 256), (c) => String.fromCharCode(c)).join("");
  const decl = /^\s*<\?xml\b[^>]*?\bencoding\s*=\s*("([^"]*)"|'([^']*)')/.exec(head);
  return decl ? (decl[2] ?? decl[3] ?? "").trim() || null : null;
}

/** A numeric character reference in `text` that names no Unicode scalar value (above U+10FFFF, a surrogate, U+0000,
 *  or digits that do not parse): the part cannot be read as XML. One pass, each reference read once. */
/** @param {string} text */
function hasInvalidCharRef(text) {
  const n = text.length;
  for (let i = text.indexOf("&#"); i !== -1; i = text.indexOf("&#", i + 2)) {
    let j = i + 2;
    const hex = text.charCodeAt(j) === 120 || text.charCodeAt(j) === 88;
    if (hex) j++;
    const from = j;
    for (; j < n; j++) {
      const c = text.charCodeAt(j);
      if (!((c >= 48 && c <= 57) || (hex && ((c >= 65 && c <= 70) || (c >= 97 && c <= 102))))) break;
    }
    if (j === from || text.charCodeAt(j) !== 59 || j - from > 8) return true;
    const v = parseInt(text.slice(from, j), hex ? 16 : 10);
    if (v === 0 || v > 0x10ffff || (v >= 0xd800 && v <= 0xdfff)) return true;
  }
  return false;
}

/** R52: make the markup of a part linear to walk. Every `<` that begins a comment, a CDATA section, a processing
 *  instruction or a tag is checked once, left to right: one that is not closed (or a tag longer than `TAG_MAX_CHARS`)
 *  becomes text (`&lt;`, the whole examined span), so that every walk after this one meets only tokens that end, and a
 *  hostile run of openers costs one scan, not one scan each. Returns the text (the same string when nothing changed)
 *  and the work done: `scanned` characters examined, `tagOver` tags over the bound, `unterminated` openers never closed. */
/**
 * @param {string} text
 * @returns {{ text: string, scanned: number, tagOver: number, unterminated: number }}
 */
function linearMarkup(text) {
  const n = text.length;
  let scanned = 0, tagOver = 0, unterminated = 0;
  /** @type {string[]} */
  const out = [];                                 // the pieces so far: none while nothing is turned to text
  let keep = 0;                                   // where the unwritten part begins
  /** @param {number} i @param {number} stop */
  const turnToText = (i, stop) => {
    out.push(text.slice(keep, i), text.slice(i, stop).replaceAll("<", "&lt;"));
    keep = stop;
  };
  /* Each closer's next place: absent, not searched yet; -1, there is none ahead. */
  const closer = new Map(/** @type {[string, number][]} */ ([]));
  /** @param {"comment" | "cdata" | "pi"} key @param {string} token @param {number} from */
  const close = (key, token, from) => {
    const cached = closer.get(key);
    if (cached === -1) return -1;                  // none ahead of an earlier opener, so none ahead of this one
    if (cached !== undefined && cached >= from) return cached;
    const found = text.indexOf(token, from);
    closer.set(key, found);
    return found;
  };
  /* The next quote of a kind at or after `from`; the search only moves forward, so what one search found (or that there
     is none ahead) holds for the next, and a long run of openers never searches the same stretch twice. */
  const quoted = new Map(/** @type {[number, number][]} */ ([]));
  /** @param {number} ch @param {number} from */
  const quote = (ch, from) => {
    const cached = quoted.get(ch);
    if (cached === -1) return -1;
    if (cached !== undefined && cached >= from) return cached;
    const found = text.indexOf(ch === 34 ? '"' : "'", from);
    quoted.set(ch, found);
    return found;
  };
  let i = text.indexOf("<");
  while (i !== -1) {
    const c = text.charCodeAt(i + 1);
    let next = i + 1;
    if (c === 33 && text.startsWith("<!--", i)) {
      const e = close("comment", "-->", i + 4);
      if (e === -1) { unterminated++; turnToText(i, i + 1); scanned += 1; } else { scanned += e + 3 - i; next = e + 3; }
    } else if (c === 33 && text.startsWith("<![CDATA[", i)) {
      const e = close("cdata", "]]>", i + 9);
      if (e === -1) { unterminated++; turnToText(i, i + 1); scanned += 1; } else { scanned += e + 3 - i; next = e + 3; }
    } else if (c === 63) {
      const e = close("pi", "?>", i + 2);
      if (e === -1) { unterminated++; turnToText(i, i + 1); scanned += 1; } else { scanned += e + 2 - i; next = e + 2; }
    } else if (isNameChar(c) || (c === 47 && isNameChar(text.charCodeAt(i + 2)))) {
      const limit = Math.min(n, i + TAG_MAX_CHARS);
      let j = i + 1, end = -1;
      while (j < limit) {
        const ch = text.charCodeAt(j);
        if (ch === 62) { end = j + 1; break; }
        if (ch === 34 || ch === 39) {
          const q = quote(ch, j + 1);
          if (q === -1 || q >= limit) { j = limit; break; }
          j = q + 1;
        } else j++;
      }
      if (end !== -1) { scanned += end - i; next = end; }
      else {
        scanned += limit - i;
        if (limit < n) tagOver++; else unterminated++;
        turnToText(i, limit);
        next = limit;
      }
    } else scanned += 1;
    i = text.indexOf("<", next);
  }
  return { text: out.length === 0 ? text : out.join("") + text.slice(keep), scanned, tagOver, unterminated };
}

/** One part's bytes to the text a walk reads (R54, R51, R52), or the stated reason it cannot be:
 *  `{ok:true, xml, replaced, replacedRatio, scanned, tagOver, unterminated}` or `{ok:false, why, final?}`. */
/**
 * @typedef {{ ok: true, xml: string, replaced: number, replacedRatio: number, scanned: number, tagOver: number,
 *   unterminated: number } | { ok: false, why: string, final?: boolean, name?: string | null }} XmlText
 */
/**
 * @param {Uint8Array} bytes
 * @param {string} name
 * @returns {XmlText}
 */
function readXmlText(bytes, name) {
  const d = ooxml.decodeText(bytes, { declared: declaredEncoding(bytes), name, kind: "xml" });
  if (!d || !d.ok || !("text" in d)) {
    return { ok: false, why: (d && "why" in d ? d.why : null) ?? "ENCODING_UNSUPPORTED", name: (d && "name" in d ? d.name : null) ?? null };
  }
  if (hasInvalidCharRef(d.text)) return { ok: false, why: "char_ref_invalid", final: true };
  const lin = linearMarkup(d.text);
  return { ok: true, xml: lin.text, replaced: d.replaced ?? 0, replacedRatio: d.replaced_ratio ?? 0, scanned: lin.scanned, tagOver: lin.tagOver, unterminated: lin.unterminated };
}

/** More than this share of a part's characters replaced and the part is `partial` (R54). */
const PARTIAL_REPLACED_RATIO = 0.005;

/** R55: the package parts this module inflates for text, for a caller summing `declaredTextBytes(container, ...)`. */
const TEXT_PARTS = new Set(["content.xml", "styles.xml", "meta.xml"]);
/**
 * @param {unknown} name
 * @returns {boolean}
 */
export function isOdfTextPart(name) {
  try { return typeof name === "string" && TEXT_PARTS.has(normalizePartName(name)); } catch { return false; }
}

/* ------------------------------------------------------------------ *
 * detect() — shared by all three entries, parameterised by the ROW
 * ------------------------------------------------------------------ */

/**
 * @param {OdfRow} row
 * @param {unknown} raw
 * @param {unknown} contentType
 * @returns {Detected | null}
 */
function detectOdf(row, raw, contentType) {
  try { return detectOdfUnguarded(row, raw, contentType); } catch { return null; }
}

/**
 * @param {OdfRow} row
 * @param {unknown} raw
 * @param {unknown} contentType
 * @returns {Detected | null}
 */
function detectOdfUnguarded(row, raw, contentType) {
  if (raw) {
    const bytes = asBytes(raw);
    if (!bytes || !hasZipMagic(bytes)) return null;
    const container = readContainer(bytes);
    if (!container.ok) return null;                       // the 1 KiB acquire seam: no EOCD, no claim
    /* The FIRST-member requirement, checked the way COFF-9 checks it: the
     * mimetype must head the central directory AND no member may lie earlier
     * in the file (the ZIP format does not tie the two orders together). A
     * package that fails it is not this entry's — `discriminate()` will state
     * WHY when parts() runs; answering null here keeps detect from claiming
     * what the container cannot support. */
    const first = container.entries[0];
    if (!first || normalizePartName(first.name) !== ODF_MIMETYPE_PART) return null;
    if (container.entries.some((/** @type {OoxmlContainer} */ e) => e.localHeaderOffset < first.localHeaderOffset)) return null;
    const declared = readStoredMemberSync(bytes, container, ODF_MIMETYPE_PART, ODF_MIMETYPE_MAX_BYTES);
    if (declared !== row.mimetype) return null;           // EXACT, never trimmed — COFF-9's rule
    const main = normalizePartName(row.conventionalMainPart);
    const present = container.byName.has(main)
      || container.entries.some((/** @type {OoxmlContainer} */ e) => normalizePartName(e.name) === main);
    if (!present) return null;                            // both halves, or no claim
    /* CERTAIN, and this is the one place an office entry may say so. The OOXML
     * entries top out at "likely" because their discriminating declaration is
     * deflated beyond a synchronous detect's reach. Here the declaration was
     * READ — first member, stored, CRC-verified, compared exactly — and the
     * main part it names is present. Claiming only "likely" would understate
     * what the bytes say, which is the same defect as overclaiming pointed
     * the other way. */
    return {
      format: row.flavour, confidence: "certain",
      signals: [
        "magic: PK\\x03\\x04 with a readable central directory",
        localize("odf-reader.odf.part_odf_mimetype_part_is", "part: {ODF_MIMETYPE_PART} is the FIRST member, STORED, CRC-verified", { ODF_MIMETYPE_PART: String(ODF_MIMETYPE_PART) }),
        `odf:${ODF_MIMETYPE_PART}=${row.mimetype} (exact match, not trimmed)`,
        `part: ${main} present`,
      ],
    };
  }
  if (contentType === row.mimetype) {
    return { format: row.flavour, confidence: "likely", signals: [`content type "${contentType}"`] };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * parts() — ONE container walk, shared; structure() and text() are
 * projections of what it assembled (the formats-xlsx.mjs pattern)
 * ------------------------------------------------------------------ */

/** The name a thrown error gives, for a stated `reader_failed` (R38): every throw this module can meet is an Error.
 *  @param {unknown} e */
const errorName = (e) => (e instanceof Error ? e.name : null) ?? "Error";

/**
 * @param {OdfRow} row
 * @param {unknown} bytes
 * @returns {Promise<PartsResult>}
 */
async function odfParts(row, bytes) {
  try { return await odfPartsUnguarded(row, bytes); } catch (e) {
    /* R38's last line of defence: nothing below is expected to throw, and if
       something does the caller still gets a stated refusal, never an
       exception. */
    return { ok: false, container: row.flavour, why: `reader_failed:${errorName(e)}`, part: null, flavourDeclared: null, signals: [] };
  }
}

/**
 * @param {OdfRow} row
 * @param {unknown} bytes
 * @returns {Promise<PartsResult>}
 */
async function odfPartsUnguarded(row, bytes) {
  const b = asBytes(bytes) ?? new Uint8Array(0);

  /* The full discrimination (magic + first-and-stored mimetype + the declared
   * main part present), through COFF-9's own branch. A container that is not
   * honestly this flavour yields a STATED refusal, never a walk of something
   * else's parts. */
  const d = await discriminate(b);
  if (!d.ok) return { ok: false, container: row.flavour, why: "why" in d ? d.why : undefined, part: null, flavourDeclared: null, signals: d.signals };
  if (d.format !== row.flavour) {
    /* THE ABSENCE IS NAMED. `discriminate` reports a package whose mimetype
     * declares a flavour but whose main part is missing as
     * `declared_main_part_absent` with `flavourDeclared` set; this entry
     * carries the PART NAME with it, because "content.xml is absent" is the
     * fact a reader needs and "declared_main_part_absent" alone makes them
     * look it up. A package of the WRONG flavour is refused by name too:
     * `not_odt:ods`, never a silent empty structure. */
    const why = "why" in d ? d.why : undefined;
    const absent = why === "declared_main_part_absent";
    return {
      ok: false,
      container: row.flavour,
      why: d.format === "undetermined" ? why : `not_${row.flavour}:${d.format}`,
      part: absent ? CONTENT_PART : null,
      /* The flavour the package's own mimetype named: stated by
         `discriminate` on an undetermined read, and the flavour it found on a
         package of another OpenDocument kind (`not_odt:ods` declared ods). */
      flavourDeclared: ("flavourDeclared" in d ? d.flavourDeclared : undefined) ?? (ODF_ROWS.some((r) => r?.flavour === d.format) ? d.format ?? null : null),
      signals: d.signals,
    };
  }

  const container = readContainer(b);
  if (!container.ok) return { ok: false, container: row.flavour, why: container.why, part: null, flavourDeclared: null, signals: d.signals };

  /** @type {PartStatement[]} */
  const undetermined = [];

  /* COFF-6's metric, enacted in ooxml.mjs: the DECLARED UNCOMPRESSED size of
   * the text-bearing parts, from the central directory BEFORE inflation. For
   * OpenDocument there is exactly one: content.xml. */
  const declared = declaredTextBytes(container, (/** @type {string} */ n) => n === CONTENT_PART);
  const guardR = sizeGuard(declared.total);
  /* R35 (F7; BOB K4489): a content.xml over the bound is NOT read in pieces, and is
   * stated as it always was, with its size, and now as `final`: this reader
   * holds the part as one string that about fifteen walks slice and re-walk,
   * and R45's own bound stops a sheet of that size whatever is done. */
  /** @type {SizeMarker | null} */
  const guard = guardR.ok || guardR.bound === undefined ? null : { ...guardR, ok: false, final: true };

  /** @type {PartStatement[]} */
  const statements = [];
  let scanned = 0;
  /* R54, R51, R52: every part read for text goes through one reader; what it cannot read it states, final when the
     file's own bytes decide it. A part decoded with replacement characters over the share is stated partial. */
  /** @param {string} name @returns {Promise<XmlText>} */
  const readText = async (name) => {
    const read = await readPart(b, container, name);
    if (!read.ok) return { ok: false, why: read.why };
    const t = readXmlText(read.bytes, name);
    if (!t.ok) return t;
    /* The count is of the parts text() is made from (R52); meta.xml and the manifest answer other operations. */
    if (name === CONTENT_PART || name === STYLES_PART) scanned += t.scanned;
    if (t.replacedRatio > PARTIAL_REPLACED_RATIO) statements.push({ part: name, why: "partial", replaced: t.replaced });
    if (t.tagOver) statements.push({ part: name, why: "tag_over_bound", count: t.tagOver });
    if (t.unterminated) statements.push({ part: name, why: "markup_unterminated", count: t.unterminated });
    return t;
  };
  /** @param {string} name @param {{ why: string, final?: boolean, name?: string | null }} t @returns {PartStatement} */
  const stated = (name, t) => {
    /** @type {PartStatement} */
    const out = { part: name, why: t.why };
    if (t.final) out.final = true;
    if (t.why === "ENCODING_UNSUPPORTED") out.name = t.name;
    return out;
  };

  /** @type {string | null} */
  let contentXml = null;
  if (!guard) {
    const t = await readText(CONTENT_PART);
    if (t.ok) contentXml = t.xml;
    else undetermined.push(stated(CONTENT_PART, t));
  }
  /* Over the bound nothing is inflated and nothing is pushed here: the guard
   * marker itself is the statement, carried by structure()'s envelope and by
   * text() verbatim (the docx.mjs pattern). */

  /* D-346 — THE TWO PARTS BESIDE content.xml THAT CARRY DEC-5 EVIDENCE.
   * Until D-346 neither was read, and each was STATED as not read (the
   * `outside_content_xml_not_read` markers) so a consumer could not mistake
   * silence for a fact. Both are now read, in the siblings' treatment: a
   * `core-properties` item from meta.xml (docx.mjs's fields, no others) and
   * sha256 `intra` links for the embedded members META-INF/manifest.xml lists
   * (docx.mjs's `word/embeddings/` treatment). What cannot be read is still
   * STATED, by the part and the reason — including a package with NO meta.xml,
   * which OpenDocument permits and which is therefore said, not left silent:
   * no core-properties item and no statement would read as "no author". */
  /** @type {CoreProperties | null} */
  let core = null;
  if (hasMember(container, META_PART)) {
    const t = await readText(META_PART);
    if (!t.ok) undetermined.push(stated(META_PART, t));
    else {
      const c = metaOf(t.xml);
      if (c.ok) core = c;
      else undetermined.push({ part: META_PART, why: c.why });
    }
  } else {
    undetermined.push({
      part: META_PART,
      why: "part_absent",
      detail: localize("odf-reader.odf.this_package_carries_no_meta", "this package carries no meta.xml, so NO core-properties item is emitted; the absence of the part is not evidence the document has no author"),
    });
  }

  /* styles.xml: the master pages' headers, footers and master text (R53) and the event bindings (R47). It is bounded
     as content.xml is (COFF-6's metric, from the central directory first). */
  /** @type {string | null} */
  let stylesXml = null;
  /** @type {string | null} */
  let stylesWhy = null;
  if (hasMember(container, STYLES_PART)) {
    const g = sizeGuard(declaredTextBytes(container, (/** @type {string} */ n) => n === STYLES_PART).total);
    if (!g.ok) stylesWhy = g.why ?? null;
    else {
      const t = await readText(STYLES_PART);
      if (t.ok) stylesXml = t.xml; else stylesWhy = t.why;
    }
  }

  const manifest = await manifestIntraLinks(b, container, contentXml, undetermined, readText, stated);

  /* R47: what can act when the file is opened, read once here so structure()
     and text() carry the one list, over every bound included. */
  const contentWhy = guard ? guard.why : contentXml == null
    ? (undetermined.find((u) => u.part === CONTENT_PART)?.why ?? "part_unreadable") : null;
  const active = activeOf(container, contentXml, contentWhy, stylesXml, stylesWhy);

  return { ok: true, format: row.flavour, row, bytes: b, container, contentXml, stylesXml, declared, guard, core,
    embedded: manifest.links, manifestWhy: manifest.why, undetermined, active, statements, scanned };
}

/* ------------------------------------------------------------------ *
 * R47 (K1888, K1903) — ACTIVE CONTENT, found and read, never run
 * ------------------------------------------------------------------ */

/* WHAT CAN ACT WHEN AN OPENDOCUMENT FILE IS OPENED, in `office-readers`
 * R32's shape (the OOXML half of the same list):
 *   - a Basic library: every member under the package root's `Basic/`
 *     (`script-lc.xml`, a library's `script-lb.xml`, each module's source);
 *   - an embedded script: every member under the package root's `Scripts/`
 *     (the Python, BeanShell and JavaScript macros a document carries; K1917);
 *   - an event binding: every `script:event-listener` in content.xml or
 *     styles.xml, with the event it fires on (`dom:load`, `dom:click`, …) —
 *     the binding is the act, whatever it names — and every
 *     `presentation:event-listener` whose action is `execute` (a shape that
 *     launches a program; K1917);
 *   - an embedded object: every member under an `Object …/` sub-document
 *     directory, and the OLE blob an `ObjectReplacements/` rendering stands
 *     for (stored as ONE member, `Object 2`, so only its rendering names it).
 * Names come from the central directory, so they are listed whatever bound
 * the text read met; the listeners need the two parts read, and a part that
 * could not be is stated (`unread`), so `[]` always means "none", never "not
 * looked". Nothing is run, evaluated or resolved: a listener's target is not
 * followed, and no Basic module's or script's source is read. This asserts
 * no threat: an item says the file CAN act, not that it is malicious. */
/** @type {string} */
const STYLES_PART = "styles.xml";
const SCRIPT_NS = "urn:oasis:names:tc:opendocument:xmlns:script:1.0";
const PRESENTATION_NS = "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0";

/** The prefixes a part binds to a namespace; the conventional prefix when it
 *  declares none (a producer that never declares it still means it). */
/**
 * @param {string} xml
 * @param {string} ns
 * @param {string} conventional
 * @returns {Set<string>}
 */
function prefixesFor(xml, ns, conventional) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const m of xml.matchAll(/\sxmlns:([\w.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    if ((m[3] ?? m[4]) === ns && m[1] !== undefined) out.add(m[1]);
  }
  if (!out.size) out.add(conventional);
  return out;
}

/** Each event binding in a part's markup, in document order, as an item
 *  without its part: a `script:event-listener` as `odf-basic` with the
 *  `script:event-name` it binds, a `presentation:event-listener` whose
 *  `presentation:action` is `execute` as `launch` (each `event` null when it
 *  names none). */
/**
 * @param {string} xml
 * @returns {{ kind: string, event: string | null }[]}
 */
function eventBindingsIn(xml) {
  const script = prefixesFor(xml, SCRIPT_NS, "script");
  const presentation = prefixesFor(xml, PRESENTATION_NS, "presentation");
  /** @type {{ kind: string, event: string | null }[]} */
  const out = [];
  const RE = tokens();
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m[1] === undefined || m[0][1] === "/") continue;
    const i = m[1].indexOf(":");
    if (i < 0 || m[1].slice(i + 1) !== "event-listener") continue;
    const prefix = m[1].slice(0, i);
    if (script.has(prefix)) out.push({ kind: "odf-basic", event: attrsOf(m[2]).get("event-name") ?? null });
    else if (presentation.has(prefix)) {
      const attrs = attrsOf(m[2]);
      if (attrs.get("action") === "execute") out.push({ kind: "launch", event: attrs.get("event-name") ?? null });
    }
  }
  return out;
}

/**
 * @param {OoxmlContainer} container
 * @param {string | null} contentXml
 * @param {string | null} contentWhy
 * @param {string | null} stylesXml
 * @param {string | null} stylesWhy
 * @returns {ActiveItem[]}
 */
function activeOf(container, contentXml, contentWhy, stylesXml, stylesWhy) {
  /** @type {string[]} */
  const names = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const e of container.entries) {
    const name = normalizePartName(e.name);
    if (!name || name.endsWith("/") || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  const has = new Set(names);
  /* The OLE blobs: the source each `ObjectReplacements/X` rendering names. */
  /** @type {Set<string>} */
  const replaced = new Set();
  for (const n of names) {
    if (!n.startsWith("ObjectReplacements/")) continue;
    const source = n.slice("ObjectReplacements/".length);
    if (source && has.has(source)) replaced.add(source);
  }

  /** @type {ActiveItem[]} */
  const items = [];
  for (const name of names) {
    if (name.startsWith("Basic/")) items.push({ kind: "odf-basic", part: name });
    else if (name.startsWith("Scripts/")) items.push({ kind: "odf-script", part: name });
    else if (/^Object [^/]*\//.test(name) || replaced.has(name)) items.push({ kind: "embedded-file", part: name });
    else if (name === CONTENT_PART) {
      if (contentXml == null) items.push({ kind: "unread", part: name, why: contentWhy ?? "part_unreadable" });
      else for (const b of eventBindingsIn(contentXml)) items.push({ kind: b.kind, part: name, event: b.event });
    } else if (name === STYLES_PART) {
      if (stylesXml == null) items.push({ kind: "unread", part: name, why: stylesWhy ?? "part_unreadable" });
      else for (const b of eventBindingsIn(stylesXml)) items.push({ kind: b.kind, part: name, event: b.event });
    }
  }
  return items;
}

/* ------------------------------------------------------------------ *
 * D-346 — meta.xml into `core-properties`, the manifest into `intra`
 * ------------------------------------------------------------------ */

/**
 * @param {OoxmlContainer} container
 * @param {string} name
 * @returns {boolean}
 */
function hasMember(container, name) {
  return container.byName.has(name)
    || container.entries.some((/** @type {OoxmlContainer} */ e) => normalizePartName(e.name) === name);
}

const HEX = "0123456789abcdef";
/**
 * @param {Uint8Array} u8
 * @returns {Promise<string>}
 */
async function sha256Hex(u8) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", u8));
  let out = "";
  for (const byte of d) out += HEX.charAt(byte >> 4) + HEX.charAt(byte & 15);
  return out;
}

/** meta.xml's `<office:meta>` as the SAME fields `parseCoreProperties` reads
 *  from OOXML's docProps/core.xml — and NO others. meta.xml can carry more
 *  (keywords, description, user-defined fields, the generator, statistics);
 *  it is personal data in part, and this entry emits only what the OOXML
 *  path already emits, so no consumer meets a field from an .odt it would
 *  not meet from a .docx.
 *
 *  THE MAPPING, because the two vocabularies name the people differently
 *  (OpenDocument 1.2 part 1 §4.3): OOXML's `dc:creator` is the AUTHOR and
 *  `cp:lastModifiedBy` the last editor; ODF's `meta:initial-creator` is the
 *  author and ODF's `dc:creator` is the LAST EDITOR. So
 *    creator        ← meta:initial-creator
 *    lastModifiedBy ← dc:creator
 *    created        ← meta:creation-date
 *    modified       ← dc:date
 *    title          ← dc:title
 *    revision       ← meta:editing-cycles  (revisionNumber when an integer)
 *  Mapping by NAME (`dc:creator` → `creator`) would put the last editor in
 *  the author's field — a false attribution, which is the defect this record
 *  exists to avoid. Each field is the string the file carries or null when
 *  absent — never filled in from another. */
/** @typedef {CoreProperties | { ok: false, why: string }} MetaRead */
/**
 * @param {string} xml
 * @returns {MetaRead}
 */
function parseOdfMeta(xml) {
  const doc = elementsNested(xml, "document-meta")[0];
  const meta = doc ? elementsNested(doc.inner, "meta")[0] : null;
  if (!meta) return { ok: false, why: "core_properties_unparseable" };
  /** @param {string} local @returns {string | null} */
  const field = (local) => {
    const el = elementsNested(meta.inner, local)[0];
    return el ? visibleText(el.inner) : null;
  };
  const revision = field("editing-cycles");
  const revisionNumber = revision != null && /^\d+$/.test(revision.trim())
    ? parseInt(revision.trim(), 10) : null;
  return {
    ok: true,
    creator: field("initial-creator"),
    lastModifiedBy: field("creator"),
    revision,
    revisionNumber,
    created: field("creation-date"),
    modified: field("date"),
    title: field("title"),
  };
}

/** meta.xml read on its OWN meter: its text is expanded like content.xml's
 *  (`<text:s>` included), so a hostile meta.xml is stated as not read, never
 *  a failed package — and it never spends content.xml's bound (R45). */
/**
 * @param {string} xml
 * @returns {MetaRead}
 */
function metaOf(xml) {
  try { return metered(() => parseOdfMeta(xml)); } catch (e) {
    if (e instanceof OverRepeatBound) return { ok: false, why: "over_repeat_bound" };
    throw e;
  }
}

/** The `core-properties` item, field for field the one docx.mjs,
 *  formats-xlsx.mjs and pptx.mjs push (IC-2 as accepted). */
/**
 * @param {OdfParts} parts
 * @returns {CorePropertiesItem[]}
 */
function corePropertiesItems(parts) {
  const c = parts.core;
  if (!c) return [];
  return [{
    kind: "core-properties",
    creator: c.creator, lastModifiedBy: c.lastModifiedBy,
    revision: c.revision, revisionNumber: c.revisionNumber,
    created: c.created, modified: c.modified, title: c.title,
    source: null,
  }];
}

/* The package's OWN parts (OpenDocument 1.2 part 3 §3, plus LibreOffice's
 * `Configurations2/` UI state): the document itself and its machinery, not
 * something embedded in it. */
const PACKAGE_OWN = new Set(["mimetype", "content.xml", "styles.xml", "meta.xml", "settings.xml", "manifest.rdf"]);
const PACKAGE_OWN_DIRS = ["META-INF/", "Thumbnails/", "Configurations2/"];

/** META-INF/manifest.xml walked for the EMBEDDED members, each content-
 *  addressed into `intra` by the sha256 of its inflated bytes — exactly the
 *  link docx.mjs builds from `word/embeddings/`.
 *
 *  THE RULE IS AN INVERSION, not a list of what counts as embedded: every
 *  file entry the manifest names is `intra` EXCEPT
 *    - the package's own parts (PACKAGE_OWN / PACKAGE_OWN_DIRS);
 *    - an image under `Pictures/` — `text()` already content-addresses those
 *      as IC-124 `images`, the OOXML `word/media/` treatment, and a second
 *      address for the same bytes would count one image twice;
 *    - a font face content.xml names through `font-face-uri` (D-612's
 *      presentational judgment; OOXML's `word/fonts/` is not `intra` either).
 *  So an `Object N/` sub-document's members, an OLE blob, an
 *  `ObjectReplacements/` rendering, and a video or other non-image member are
 *  `intra`. A directory entry (`Object 1/`) is not a member; its files are
 *  listed, and linked, on their own.
 *
 *  WHAT IS STATED RATHER THAN LINKED: a manifest that cannot be read or
 *  parsed (the envelope names it — `intra` then means NOT LOOKED); a listed
 *  member the container does not hold, one encrypted (its stored bytes are
 *  ciphertext, and a hash of them would address nothing a reader holds), and
 *  one that will not inflate — each an `undetermined` link naming it.
 *
 *  WHAT IT CANNOT SEE: a container member the manifest does NOT list
 *  (OpenDocument requires the listing; a non-conforming producer can omit
 *  one); a font face named only from styles.xml, which is not read, and any
 *  font face when content.xml was not read (over the bound) — those are
 *  linked as `intra`, an over-inclusion, never an omission. `source` is null:
 *  locating a member to the `draw:object` that references it is not built. */
/**
 * @param {Uint8Array} bytes
 * @param {OoxmlContainer} container
 * @param {string | null} contentXml
 * @param {PartStatement[]} undetermined
 * @param {(name: string) => Promise<XmlText>} readText
 * @param {(name: string, t: { why: string, final?: boolean, name?: string | null }) => PartStatement} stated
 * @returns {Promise<{ links: Link[], why: string | null }>}
 */
async function manifestIntraLinks(bytes, container, contentXml, undetermined, readText, stated) {
  const read = await readText(ODF_MANIFEST_PART);
  if (!read.ok) {
    undetermined.push(stated(ODF_MANIFEST_PART, read));
    return { links: [], why: read.why };
  }
  const xml = read.xml;
  const root = elementsNested(xml, "manifest", 1)[0];
  if (!root) {
    undetermined.push({ part: ODF_MANIFEST_PART, why: "manifest_unparseable" });
    return { links: [], why: "manifest_unparseable" };
  }

  /** @type {Set<string>} */
  const fonts = new Set();
  if (contentXml != null) {
    for (const f of elementsNested(contentXml, "font-face-uri")) {
      const href = f.attrs.get("href");
      if (typeof href === "string" && href) fonts.add(normalizePartName(href.replace(/^(?:\.\/)+/, "")));
    }
  }

  /* First the listing: which members are embedded, each once (a manifest
     naming a member twice does not make two embeddings). */
  /** @type {{ name: string, encrypted: boolean }[]} */
  const listed = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const fe of elementsNested(root.inner, "file-entry")) {
    const path = fe.attrs.get("full-path");
    if (typeof path !== "string" || !path || path.endsWith("/")) continue;
    const name = normalizePartName(path);
    if (seen.has(name)) continue;
    seen.add(name);
    if (PACKAGE_OWN.has(name) || PACKAGE_OWN_DIRS.some((d) => name.startsWith(d))) continue;
    if (name.startsWith("Pictures/")) {
      const dot = name.lastIndexOf(".");
      if (dot > name.lastIndexOf("/") && name.slice(dot + 1).toLowerCase() in IMAGE_MIME_BY_EXT) continue;
    }
    if (fonts.has(name)) continue;
    listed.push({ name, encrypted: elementsNested(fe.inner, "encryption-data", 1).length > 0 });
  }

  /** @param {string} why @param {string} name @returns {Link} */
  const undeterminedLink = (why, name) => ({ partition: "undetermined", wrapper: null,
    target: { why, name }, source: null });

  /* THE SAME BOUND AND METRIC AS THE TEXT PART AND THE IMAGES (COFF-6):
     hashing inflates every embedded member, so their DECLARED uncompressed
     bytes are summed from the central directory first. Over the bound none is
     inflated and each is stated by name — never a partial set of links read
     as the whole. */
  let total = 0;
  for (const l of listed) {
    if (l.encrypted) continue;
    const e = container.byName.get(l.name) ?? container.entries.find((/** @type {OoxmlContainer} */ x) => normalizePartName(x.name) === l.name);
    if (e) total += e.uncompressedSize;
  }
  const g = sizeGuard(total);

  /** @type {Link[]} */
  const links = [];
  for (const { name, encrypted } of listed) {
    if (encrypted) { links.push(undeterminedLink("embedding_encrypted", name)); continue; }
    if (!hasMember(container, name)) { links.push(undeterminedLink("manifest_member_absent", name)); continue; }
    if (!g.ok) { links.push(undeterminedLink(`embeddings_over_size_bound:${total}>${g.bound}`, name)); continue; }
    const got = await readPart(bytes, container, name);
    if (!got.ok) { links.push(undeterminedLink(`embedding_unreadable:${got.why}`, name)); continue; }
    const sha = await sha256Hex(got.bytes);
    links.push({ partition: "intra", wrapper: linkWrapper.intra(sha),
      target: { sha256: sha, name, bytes: got.bytes.length },
      source: null });
  }
  return { links, why: null };
}

/** Why `intra` holds nothing, when it holds nothing — so an empty partition
 *  is never read as "this package embeds nothing" when the manifest was not
 *  read, and says so plainly when the manifest was read and lists none. */
/**
 * @param {OdfParts} parts
 * @returns {string[]}
 */
function intraNotes(parts) {
  const manifestWhy = parts.manifestWhy;
  if (manifestWhy) {
    return [localize("odf-reader.odf.no_intra_link_odf_manifest", "no intra link: {ODF_MANIFEST_PART} could not be read ({manifestWhy}), so embedded members were not looked for (stated in evidentiary.undetermined)", { ODF_MANIFEST_PART: String(ODF_MANIFEST_PART), manifestWhy: String(manifestWhy) })];
  }
  if (!parts.embedded.length) return [localize("odf-reader.odf.no_intra_link_odf_manifest_2", "no intra link: {ODF_MANIFEST_PART} lists no embedded member", { ODF_MANIFEST_PART: String(ODF_MANIFEST_PART) })];
  return [];
}

/* The body of content.xml for a given office body kind, or null. Every walk
 * below starts here rather than at the document root, so that automatic
 * styles and font declarations can never be mistaken for content. */
/**
 * @param {string | null} contentXml
 * @param {string} kind
 * @returns {string | null}
 */
function officeBody(contentXml, kind) {
  if (contentXml == null) return null;
  /* An EMPTY body ("" — a document with no paragraphs, sheets or pages) is a
     body read, not a body missing: callers test for null, never falsiness. */
  const body = elementsNested(contentXml, "body", 1)[0];
  if (!body) return null;
  const inner = elementsNested(body.inner, kind)[0];
  return inner ? inner.inner : null;
}

/** Why a structure() read no body (R10), for its notes. */
/**
 * @param {OdfParts} parts
 * @param {string} element
 * @returns {string}
 */
function bodyNotRead(parts, element) {
  if (parts.guard) return localize("odf-reader.odf.content_xml_not_read_over", "content.xml not read: over the size bound (stated in evidentiary.undetermined and by text())");
  const repeat = parts.repeat;
  if (repeat) return localize("odf-reader.odf.content_xml_not_read_its", "content.xml not read: its repeats expand past {boundName} (stated in evidentiary.undetermined and by text())", { boundName: String(repeat.boundName) });
  return `content.xml unreadable or carries no <office:${element}>: element references unavailable (stated)`;
}

/** The two absences above plus whatever parts() could not read, as the
 *  envelope's `undetermined` — and the size-guard marker when it fired. A part read with a statement (R54, R52) is
 *  stated here too, as it is by text(). */
/**
 * @param {OdfParts} parts
 * @returns {PartStatement[]}
 */
function envelopeUndetermined(parts) {
  const out = [...parts.undetermined, ...parts.statements];
  const { guard, repeat } = parts;
  if (guard) out.push({ part: CONTENT_PART, why: "over_size_bound", guard });
  /* R45: the read that crossed the repeat bound, its marker in the guard's place. */
  if (repeat) out.push({ part: CONTENT_PART, why: "over_repeat_bound", guard: repeat });
  return out;
}

/** What text() says of the parts it read with a statement, in its own `undetermined` shape. */
/** @param {OdfParts} parts @returns {TextStatement[]} */
const statedByText = (parts) => parts.statements.map(({ part, why, ...rest }) => ({ reason: why, part, ...rest }));

/**
 * @param {string} container
 * @param {EvidentiaryItem[]} items
 * @param {PartStatement[]} undetermined
 * @returns {Envelope}
 */
function envelopeOf(container, items, undetermined) {
  /** @type {{ [kind: string]: number }} */
  const counts = {};
  for (const it of items) counts[it.kind] = (counts[it.kind] ?? 0) + 1;
  return {
    container,
    kinds: [...new Set(items.map((it) => it.kind))],
    items,
    undetermined,
    counts,
  };
}

/**
 * @param {Link[]} links
 * @returns {PartitionCounts}
 */
function countPartitions(links) {
  const counts = { anchor: 0, intra: 0, deferred: 0, refused: 0, undetermined: 0 };
  for (const l of links) counts[l.partition]++;
  return counts;
}

/* ================================================================== *
 * .odt — the TEXT document, in docx.mjs's shape
 * ================================================================== */

/** One pass over `<office:text>`: the paragraph sequence (every `<text:p>`
 *  and `<text:h>` in body order, tables included — ODF's heading is a
 *  paragraph-level element and is what a person is shown), each paragraph's
 *  visible text, the hyperlinks located to their paragraph, the annotations
 *  located to theirs, and the tracked-change MARKS that locate a changed
 *  region to a paragraph.
 *
 *  What is DELIBERATELY excluded from the paragraph sequence, and why:
 *  `<text:tracked-changes>` at the head of the body holds the deleted
 *  regions' own paragraphs. Those paragraphs are NOT in the document as
 *  served — that is the entire point of a deletion — so counting them would
 *  shift every `¶N` past the first change and put superseded wording in the
 *  text stream, which is exactly the docx rule (`w:delText` is not in the
 *  text stream; it is the evidentiary superseded wording). An annotation's
 *  own paragraphs are excluded for the same reason at a smaller scale. */
/** @typedef {{ kind: string, inner: string, para: number | null, paras?: number[] }} InBodyUnit */
/**
 * @typedef {Object} TextWalk
 * @property {WalkedParagraph[]} paragraphs
 * @property {WalkedLink[]} hyperlinks
 * @property {WalkedAnnotation[]} annotations
 * @property {InBodyUnit[]} inBody
 * @property {ChangeMark[]} marks
 */
/** @typedef {{ para: number, text: string | null }} WalkedParagraph */
/** @typedef {{ href: string, para: number | null }} WalkedLink */
/** @typedef {{ attrs: Attrs, inner: string, para: number | null }} WalkedAnnotation */
/** @typedef {{ id: string, para: number | null }} ChangeMark */
/**
 * @param {string} bodyXml
 * @param {{ withText?: boolean }} [opts]
 * @returns {Generator<undefined, TextWalk, undefined>}
 */
function* walkTextBodyG(bodyXml, { withText = true } = {}) {
  /** @type {WalkedParagraph[]} */
  const paragraphs = [];
  /** @type {WalkedLink[]} */
  const hyperlinks = [];
  /** @type {WalkedAnnotation[]} */
  const annotations = [];
  /** @type {InBodyUnit[]} */
  const inBody = [];              // R53: { kind, inner, para }, the notes, annotations and text boxes in the order met
  /** @type {ChangeMark[]} */
  const marks = [];               // { id, para } — where a changed region sits

  /* The tracked-changes declaration block is read separately below; strip it
   * so its deleted paragraphs never enter the body sequence. */
  const served = stripElement(bodyXml, "tracked-changes");

  const RE = tokens();
  let para = -1;
  let inPara = false;
  let depthInPara = 0;
  let skipDepth = 0;              // inside an annotation, a note or a text box: its text is its own
  let paraStart = -1;

  for (;;) {
    const m = RE.exec(served);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const name = localOf(m[1]);
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";

    if (skipDepth > 0) {
      if (!closing && !selfClosed) skipDepth++;
      else if (closing) skipDepth--;
      continue;
    }

    if (!closing && !selfClosed && name === "annotation") {
      /* The annotation's markup runs to its close; capture it whole and take
       * its text out of the host paragraph. */
      const rest = served.slice(m.index);
      /* Only the FIRST: scanning the rest of the body for every annotation
         made a comment-heavy document quadratic. */
      const ann = elementsNested(rest, "annotation", 1)[0];
      const rec = { attrs: attrsOf(m[2]), inner: ann ? ann.inner : "", para: para >= 0 ? para : null };
      annotations.push(rec);
      inBody.push({ kind: "comment", inner: rec.inner, para: rec.para });
      skipDepth = 1;
      continue;
    }

    /* R53: a footnote or endnote, and a text box, are units of their own and are taken out of the host paragraph's
       text, as an annotation is. A box inside a paragraph (a frame anchored to it) leaves the paragraph a text without
       the box's words and holds none of the body's paragraph slots; a box outside any paragraph (a frame anchored to
       the page, or alone in a table cell) holds its paragraphs' slots, in the file's order, with no text of their
       own, and the unit names them (`paras`, G166). The links the box carries stay the body's (R7). */
    if (!closing && !selfClosed && (name === "note" || name === "text-box")) {
      const rest = served.slice(m.index);
      const el = elementsNested(rest, name, 1)[0];
      const inner = el ? el.inner : "";
      /** @type {InBodyUnit} */
      const unitOf = { kind: name === "text-box" ? "text_box" : attrsOf(m[2]).get("note-class") === "endnote" ? "endnote" : "footnote", inner, para: para >= 0 ? para : null };
      if (name === "text-box") {
        /** @type {number[]} */
        const own = [];
        if (!inPara) {
          for (const _ of iterNested(inner, PARAGRAPH_NAMES)) { para++; paragraphs.push({ para, text: withText ? "" : null }); own.push(para); }
          const first = own[0];
          if (first !== undefined) unitOf.para = first;
        }
        unitOf.paras = own;
        for (const a of iterNested(inner, LINK_NAMES)) {
          const href = a.attrs.get("href");
          if (href != null) hyperlinks.push({ href, para: unitOf.para });
        }
      }
      inBody.push(unitOf);
      skipDepth = 1;
      continue;
    }

    if (!closing && (name === "p" || name === "h")) {
      if (!selfClosed) {
        if (!inPara) { para++; inPara = true; depthInPara = 1; paraStart = RE.lastIndex; }
        else depthInPara++;   /* a paragraph inside a paragraph is not ODF, but
                                 a producer's nesting must not desynchronise
                                 the counter */
      } else {
        if (!inPara) { para++; paragraphs.push({ para, text: "" }); }
      }
      continue;
    }
    if (closing && (name === "p" || name === "h") && inPara) {
      depthInPara--;
      if (depthInPara === 0) {
        const raw = withText ? served.slice(paraStart, m.index) : "";
        /* structure() counts paragraphs and never reads their text: it is not
           expanded there, so a read pays for each space once (R45). */
        paragraphs.push({ para, text: withText ? visibleText(stripInline(raw)) : null });
        inPara = false;
        paraStart = -1;
        /* R49, R52: the window ends here when it is full. */
        if (windowDue()) yield;
      }
      continue;
    }

    const attrs = m[2] && m[2].includes("=") ? attrsOf(m[2]) : NO_ATTRS;

    const href = attrs.get("href");
    const changeId = attrs.get("change-id");
    if (!closing && name === "a" && href != null) {
      hyperlinks.push({ href, para: para >= 0 ? para : null });
    } else if (name === "change-start" && changeId != null) {
      marks.push({ id: changeId, para: para >= 0 ? para : null });
    } else if (name === "change" && changeId != null) {
      /* A bare `<text:change/>` is the position a deletion was taken FROM. */
      marks.push({ id: changeId, para: para >= 0 ? para : null });
    }
  }
  return { paragraphs, hyperlinks, annotations, inBody, marks };
}

/** @param {string} bodyXml @param {{ withText?: boolean }} [opts] */
const walkTextBody = (bodyXml, opts) => driveSync(walkTextBodyG(bodyXml, opts));

/** A paragraph's markup without what is a unit of its own: its annotations, its notes and its text boxes (R9, R53). */
/** @param {string} raw */
function stripInline(raw) {
  let out = raw;
  for (const name of ["annotation", "note", "text-box"]) if (out.includes(name)) out = stripElement(out, name);
  return out;
}

const PARAGRAPH_NAMES = new Set(["p", "h"]);
const LINK_NAMES = new Set(["a"]);

/** The paragraphs (`<text:p>`/`<text:h>`) of a run of markup, each as visible text, newline-joined. */
/** @param {string} xml */
function paragraphsText(xml) {
  /** @type {string[]} */
  const out = [];
  for (const el of iterNested(xml, PARAGRAPH_NAMES)) out.push(visibleText(el.inner));
  return out.join("\n");
}

/** @param {string} text */
const hasWords = (text) => /\S/.test(text);
/** A master page is mostly empty paragraphs and field placeholders: its unit keeps the lines that hold something. */
/** @param {string} text */
const nonEmptyLines = (text) => text.split("\n").filter(hasWords).join("\n");

/** The inserted text of every change region, taken from the BODY between
 *  its `<text:change-start>` and `<text:change-end>` marks: `Map(id → text)`.
 *  The declaration block carries a deletion's wording but NOT an insertion's —
 *  the insertion is in the document as served, which is why it is also in the
 *  text stream. One token walk over the served body for every region (the
 *  marks are matched by local name and `change-id`, in either quote style); a
 *  region with no start, no end, or an end before its start is absent from
 *  the map, and its text is null — absent is not empty. An annotation inside
 *  the region is the annotation's text, not the insertion's. */
/**
 * @param {string} servedXml
 * @returns {Map<string, string>}
 */
function insertedTexts(servedXml) {
  const out = new Map(/** @type {[string, string][]} */ ([]));
  const starts = new Map(/** @type {[string, number][]} */ ([]));
  const RE = tokens();
  for (;;) {
    const m = RE.exec(servedXml);
    if (m === null) break;
    if (m[1] === undefined || m[0][1] === "/") continue;
    const name = localOf(m[1]);
    if (name !== "change-start" && name !== "change-end") continue;
    const id = attrsOf(m[2]).get("change-id");
    if (id == null) continue;
    if (name === "change-start") { if (!starts.has(id)) starts.set(id, RE.lastIndex); }
    else if (starts.has(id) && !out.has(id)) {
      out.set(id, visibleText(stripElement(servedXml.slice(starts.get(id), m.index), "annotation")));
    }
  }
  return out;
}

/** `<text:tracked-changes>`: one entry per `<text:changed-region>`, each an
 *  insertion or a deletion with `<office:change-info>`'s author and date. */
/** @typedef {{ id: string | null, change: string, author: string | null, date: string | null, superseded: string | null }} TrackedChange */
/** @type {ReadonlyArray<readonly [string, string]>} each changed region's element, and the change it records */
const CHANGE_KINDS = [["insertion", "insertion"], ["deletion", "deletion"]];
/**
 * @param {string} bodyXml
 * @returns {TrackedChange[]}
 */
function parseTrackedChanges(bodyXml) {
  const block = elementsNested(bodyXml, "tracked-changes")[0];
  if (!block) return [];
  /** @type {TrackedChange[]} */
  const out = [];
  for (const region of elementsNested(block.inner, "changed-region")) {
    const id = region.attrs.get("id") ?? null;
    for (const [kind, change] of CHANGE_KINDS) {
      for (const el of elementsNested(region.inner, kind)) {
        const info = elementsNested(el.inner, "change-info")[0];
        const creator = info ? elementsNested(info.inner, "creator")[0] : null;
        const date = info ? elementsNested(info.inner, "date")[0] : null;
        out.push({
          id, change,
          author: creator ? visibleText(creator.inner) : null,   // null, never invented
          date: date ? visibleText(date.inner) : null,
          /* A deletion's own paragraphs ARE the superseded wording. An
             insertion's content is in the body, not here. */
          superseded: change === "deletion"
            ? elementsNested(stripElement(el.inner, "change-info"), "p").map((p) => visibleText(p.inner)).join("\n")
            : null,
        });
      }
    }
  }
  return out;
}

/**
 * @typedef {Object} OdtStructure odtEntry.structure()'s answer (R6 to R10)
 * @property {true} ok
 * @property {"odt"} container
 * @property {number | null} paragraphs
 * @property {Link[]} links
 * @property {PartitionCounts} counts
 * @property {Envelope} evidentiary
 * @property {string[]} notes
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @returns {OdtStructure | ProjectionFailure}
 */
function odtStructure(parts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "odt", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  const notes = intraNotes(parts);
  /** @type {Link[]} */
  const links = [];
  /** @type {EvidentiaryItem[]} */
  const items = [];
  const body = officeBody(parts.contentXml, "text");
  if (body == null) {
    notes.push(bodyNotRead(parts, "text"));
  }

  /** @type {number | null} */
  let paragraphs = null;
  if (body != null) {
    const walk = walkTextBody(body, { withText: false });
    paragraphs = walk.paragraphs.length;

    for (const h of walk.hyperlinks) {
      const at = h.para;
      links.push(linkRecord(h.href, at == null ? null : docParaRef(at)));
    }

    /* DEC-5: tracked changes, author/date/superseded-wording, located to the
     * paragraph the body's mark sits in. A region the body never marks is
     * still carried — with source null and the reason stated — because the
     * change is evidence whether or not we can place it. */
    const inserted = insertedTexts(stripElement(body, "tracked-changes"));
    const markFor = new Map(/** @type {[string, number | null][]} */ ([]));
    for (const mk of walk.marks) if (!markFor.has(mk.id)) markFor.set(mk.id, mk.para);
    for (const c of parseTrackedChanges(parts.contentXml ?? "")) {
      const id = c.id;
      const at = id != null ? markFor.get(id) : undefined;
      /** @type {TrackedChangeItem} */
      const item = {
        kind: "tracked-change",
        change: c.change,
        author: c.author,
        date: c.date,
        source: at == null ? null : docParaRef(at),
      };
      if (c.change === "deletion") item.superseded = c.superseded;
      else item.text = id != null ? inserted.get(id) ?? null : null;
      if (at === undefined) item.why = "change_region_unmarked_in_body";
      items.push(item);
    }

    /* DEC-5: comments. ODF's annotation is inline in the paragraph it
     * annotates, so the location is exact rather than joined through an id.
     * `initials` is emitted because the docx envelope carries it — ODF has
     * `<meta:creator-initials>` and LibreOffice does not write it, so it is
     * null when absent and that null is the file speaking. */
    for (const a of walk.annotations) {
      const annotated = a.para;
      const creator = elementsNested(a.inner, "creator")[0];
      const date = elementsNested(a.inner, "date")[0];
      const initials = elementsNested(a.inner, "creator-initials")[0];
      items.push({
        kind: "comment",
        id: a.attrs.get("name") ?? null,
        author: creator ? visibleText(creator.inner) : null,
        date: date ? visibleText(date.inner) : null,
        initials: initials ? visibleText(initials.inner) : null,
        text: elementsNested(stripElement(a.inner, "change-info"), "p").map((p) => visibleText(p.inner)).join("\n"),
        source: annotated == null ? null : docParaRef(annotated),
      });
    }
  }

  /* D-346: the manifest's embedded members, and meta.xml's core properties. */
  links.push(...parts.embedded);
  items.push(...corePropertiesItems(parts));

  return {
    ok: true,
    container: "odt",
    paragraphs,                              // null = honestly unknown, the docx.mjs convention
    links,
    counts: countPartitions(links),
    evidentiary: envelopeOf("odt", items, envelopeUndetermined(parts)),
    notes,
  };
}

/** FW-19 — THE TABLES OF AN `<office:text>` BODY, in document order, nested
 *  ones included and numbered as they OPEN — `docx.mjs`'s
 *  `walkDocumentTables` for OpenDocument, and the same ordinal `docTableRef`
 *  addresses. ODF compresses runs (`table:number-columns-repeated`,
 *  `table:number-rows-repeated`), so both figures are ACCUMULATED through the
 *  repeats exactly as `walkSheet` does; `cols` is the declared
 *  `<table:table-column>` grid. A figure the walk did not establish is NULL,
 *  never 0. */
/** @typedef {{ table: number, rows: number | null, cols: number | null }} OdfTable */
/**
 * @param {string} bodyXml
 * @returns {OdfTable[]}
 */
function walkOdfTables(bodyXml) {
  /** @type {OdfTable[]} */
  const done = [];
  /** @type {{ table: number, rows: number, cols: number }[]} */
  const stack = [];
  let next = 0;
  const RE = tokens();
  /** @param {string | undefined} v */
  const rep = (v) => { const n = parseInt(v ?? "1", 10); return Number.isFinite(n) && n > 0 ? n : 1; };
  for (;;) {
    const m = RE.exec(bodyXml);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const name = localOf(m[1]);
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    const top = stack.length ? stack[stack.length - 1] ?? null : null;
    if (closing) {
      const t = name === "table" ? stack.pop() : undefined;
      if (t) done[t.table] = { table: t.table, rows: t.rows, cols: t.cols > 0 ? t.cols : null };
      continue;
    }
    if (name === "table") {
      if (selfClosed) done[next] = { table: next++, rows: 0, cols: null };
      else stack.push({ table: next++, rows: 0, cols: 0 });
      continue;
    }
    if (!top) continue;
    const attrs = m[2] && m[2].includes("=") ? attrsOf(m[2]) : NO_ATTRS;
    if (name === "table-column") top.cols += rep(attrs.get("number-columns-repeated"));
    else if (name === "table-row") top.rows += rep(attrs.get("number-rows-repeated"));
  }
  for (;;) {
    const t = stack.pop();
    if (!t) break;
    done[t.table] = { table: t.table, rows: t.rows || null, cols: t.cols > 0 ? t.cols : null };
  }
  return done.filter(Boolean);
}

/**
 * @typedef {Object} OdtText odtEntry.text()'s answer, before its images (R11 to R13, R53)
 * @property {true} ok
 * @property {"odt"} container
 * @property {string | null} document
 * @property {{ para: number, ref: string, text: string | null }[]} paragraphs
 * @property {{ table: number, ref: string, rows: number | null, cols: number | null }[] | null} tables
 * @property {TextUnit[] | null} parts
 * @property {TextUndetermined[]} undetermined
 * @property {{ chars: number, undetermined: number, scanned_bytes: number }} counts
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @param {ReadCtx} ctx
 * @returns {Promise<OdtText | ProjectionFailure>}
 */
async function odtText(parts, ctx) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "odt", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  const marker = parts.guard ?? parts.repeat;
  if (marker) {
    return {
      ok: true, container: "odt", document: null, paragraphs: [], tables: null, parts: null,
      undetermined: [marker],           // the marker VERBATIM, never a truncation
      counts: { chars: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  const body = officeBody(parts.contentXml, "text");
  if (body == null) {
    const stated = parts.undetermined.find((u) => u.part === CONTENT_PART);
    /** @type {TextStatement} */
    const unread = { reason: "main_part_unreadable", part: CONTENT_PART, why: stated?.why ?? "no_office_text_body" };
    if (stated?.final) unread.final = true;
    return {
      ok: true, container: "odt", document: null, paragraphs: [], tables: null, parts: null,
      undetermined: [unread],
      counts: { chars: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  const walk = await drive(walkTextBodyG(body), ctx);
  return withMeter(ctx.meter, () => {
    const paragraphs = walk.paragraphs.map((p) => ({ para: p.para, ref: `¶${p.para + 1}`, text: p.text }));
    const document = paragraphs.map((p) => p.text).filter((t) => t !== null && t.length > 0).join("\n");
    /* FW-19 / IC-124: the `doc-table` units, in docx.mjs's shape and through
       its builder. An EMPTY list is a real zero; the branches above that walked
       nothing say `tables: null`. The tracked-changes block is stripped first,
       for `walkTextBody`'s own reason: a deleted table is not in the document
       as served, and counting it would renumber every table after it. */
    const tables = walkOdfTables(stripElement(body, "tracked-changes"))
      .map((t) => ({ table: t.table, ref: docTableRef(t.table).ref, rows: t.rows, cols: t.cols }));
    /* R53: every part of the document that is not a body paragraph, with its kind. */
    /** @type {TextUnit[]} */
    const units = [];
    /** @param {string} kind @param {number | null} para @param {string} text @param {number[]} [paras] */
    const unit = (kind, para, text, paras) => {
      if (!hasWords(text)) return;
      /** @type {TextUnit} */
      const u = { kind, ref: para == null ? "document" : docParaRef(para).ref, part: CONTENT_PART, text };
      if (paras) u.paras = paras;
      units.push(u);
    };
    for (const x of walk.inBody) {
      if (x.kind === "comment") unit("comment", x.para, paragraphsText(stripElement(x.inner, "change-info")));
      else if (x.kind === "text_box") unit("text_box", x.para, paragraphsText(x.inner), x.paras);
      else unit(x.kind, x.para, paragraphsText(elementsNested(x.inner, "note-body", 1)[0]?.inner ?? ""));
    }
    const marked = new Map(/** @type {[string, number | null][]} */ ([]));
    for (const mk of walk.marks) if (!marked.has(mk.id)) marked.set(mk.id, mk.para);
    for (const c of parseTrackedChanges(parts.contentXml ?? "")) {
      const id = c.id;
      if (c.change === "deletion") unit("tracked_deletion", id != null ? marked.get(id) ?? null : null, c.superseded ?? "");
    }
    units.push(...masterUnits(parts.stylesXml, "odt"));
    const stated = statedByText(parts);
    return {
      ok: true, container: "odt", document, paragraphs, tables, parts: units,
      undetermined: stated,
      counts: { chars: document.length, undetermined: stated.length, scanned_bytes: parts.scanned },
    };
  });
}
odtText.owns = true;

/** R53: what the master pages of styles.xml hold. An `.odt`'s headers and footers (each variant: left, first), an
 *  `.odp`'s master-page text. Empty ones are not units. */
const HEADER_FOOTER = new Set(["header", "header-left", "header-first", "footer", "footer-left", "footer-first"]);
const MASTER_PAGE = new Set(["master-page"]);
/**
 * @param {string | null} stylesXml
 * @param {string} flavour
 * @returns {TextUnit[]}
 */
function masterUnits(stylesXml, flavour) {
  if (stylesXml == null) return [];
  /** @type {TextUnit[]} */
  const out = [];
  for (const page of iterNested(stylesXml, MASTER_PAGE)) {
    const label = page.attrs.get("name") ?? "master";
    if (flavour === "odt") {
      for (const hf of iterNested(page.inner, HEADER_FOOTER)) {
        const text = nonEmptyLines(paragraphsText(hf.inner));
        if (hasWords(text)) out.push({ kind: hf.name.startsWith("header") ? "header" : "footer", ref: `${label} (${hf.name})`, part: STYLES_PART, text });
      }
    } else {
      const text = nonEmptyLines(paragraphsText(page.inner));
      if (hasWords(text)) out.push({ kind: "master_text", ref: `${label} (master)`, part: STYLES_PART, text });
    }
  }
  return out;
}

/* ================================================================== *
 * .ods — the SPREADSHEET, in formats-xlsx.mjs's shape
 * ================================================================== */

/** A1-style column name from a 0-based index. */
/** @param {number} i */
function columnName(i) {
  let n = i, out = "";
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}

/* R46 (C:A-4) — TYPED CELLS, in `office-readers` R30's contract. ODF states a
 * cell's type in `office:value-type` and its value in the attribute that type
 * names, written as the file writes it; both are taken as written, never
 * re-rendered through a binary float, and nothing is recalculated. */
/** @type {Readonly<{ [type: string]: string }>} */
const VALUE_ATTR = Object.freeze({ float: "value", percentage: "value", currency: "value",
  date: "date-value", time: "time-value", boolean: "boolean-value", string: "string-value" });
/** @type {Readonly<{ [type: string]: string }>} */
const CELL_TYPE = Object.freeze({ float: "number", percentage: "number", currency: "number",
  date: "date", time: "time", boolean: "boolean", string: "text" });
const VALUE_ATTRS = ["value", "date-value", "time-value", "boolean-value", "string-value"];

/** The cell's value attribute as written: the one its declared type names,
 *  else the first one it carries, else null. */
/**
 * @param {Attrs} attrs
 * @returns {string | null}
 */
function valueAttrOf(attrs) {
  const declared = attrs.get("value-type");
  const own = declared === undefined ? undefined : VALUE_ATTR[declared];
  const ownValue = own ? attrs.get(own) : undefined;
  if (ownValue != null) return ownValue;
  for (const a of VALUE_ATTRS) {
    const value = attrs.get(a);
    if (value != null) return value;
  }
  return null;
}

/** One walked cell as R46's typed cell, or null when it holds neither a value nor a formula: a cell once at each
 *  address `sheetRows` gave it (within R45's bound, which `sheetRows` already paid). A value type this table does not
 *  know types nothing: `type` is null, `declared` says what the file wrote. */
/**
 * @typedef {Object} TypedCell one cell in office-readers R30's contract (R46)
 * @property {SheetCellRef} source
 * @property {string | null} value
 * @property {string | null} type
 * @property {string | null} declared
 * @property {string | null} cached
 * @property {string | null} formula
 */
/**
 * @typedef {Object} WalkedCell one cell as a sheet's walk gives it, at one address
 * @property {number} col 0-based
 * @property {string} cell its A1 address
 * @property {string | null} valueType
 * @property {string | null} value
 * @property {string | null} formula
 * @property {string} display
 * @property {string[]} hrefs
 * @property {string | null} note
 */
/** @typedef {{ r: number, hidden: string | false, cells: WalkedCell[] }} SheetRow one row as a sheet's walk gives it */
/**
 * @param {string} sheetName
 * @param {WalkedCell} c
 * @returns {TypedCell | null}
 */
function typedCellOf(sheetName, c) {
  const value = c.value ?? (c.display !== "" ? c.display : null);
  if (c.formula == null && (value == null || value === "")) return null;
  const valueType = c.valueType;
  const type = valueType != null
    ? (CELL_TYPE[valueType] ?? null)
    : (c.display !== "" ? "text" : null);
  return {
    source: sheetCellRef(sheetName, c.cell),
    value,
    type,
    declared: c.valueType,
    cached: c.formula != null ? c.value : null,
    formula: c.formula,
  };
}

const ROW_NAMES = new Set(["table-row"]);
const CELL_NAMES = new Set(["table-cell", "covered-table-cell"]);

/** A sheet's hidden column ranges (R16): a repeat is one range, never expanded. */
/**
 * @param {string} tableXml
 * @returns {HiddenRange[]}
 */
function sheetHiddenCols(tableXml) {
  /** @type {HiddenRange[]} */
  const hiddenCols = [];
  let colIndex = 0;
  for (const col of elementsNested(tableXml, "table-column")) {
    const rep = parseInt(col.attrs.get("number-columns-repeated") ?? "1", 10);
    const n = Number.isFinite(rep) && rep > 0 ? rep : 1;
    const vis = col.attrs.get("visibility");
    if (vis === "collapse" || vis === "filter") {
      hiddenCols.push({ min: colIndex + 1, max: colIndex + n, visibility: vis });
    }
    colIndex += n;
  }
  return hiddenCols;
}

/** One sheet's rows and cells, a row at a time (R49: no more than the row in hand is held). ODF compresses runs with
 *  `table:number-columns-repeated` / `table:number-rows-repeated`, so a cell's
 *  ADDRESS cannot be counted off the element index — it must be accumulated
 *  through the repeats, or every reference after the first run of blanks
 *  points at the wrong cell. Trailing repeats are the padding a producer adds
 *  to square the sheet off; an empty repeat run is advanced over, never
 *  expanded, so a `repeated="1024"` blank tail costs one iteration rather
 *  than a thousand. A covered table cell (R50) is a cell of its address that holds nothing: it advances the column.
 *
 *  R45: every expansion is paid for BEFORE it is made — a carrying cell's
 *  addresses, the copies of its text and links at each address after its
 *  first, and each hidden row range. R16: a hidden row run is ONE range
 *  `{min, max, visibility}`, never a number per row, so a collapsed tail of a
 *  million rows costs one unit. `st.hiddenRows` collects those ranges when the caller gives a state.
 *  R53: a cell's annotation is the cell's `note`, apart from its displayed value, at its first address. */
/**
 * @param {string} tableXml
 * @param {{ hiddenRows: HiddenRange[] } | null} st
 * @returns {Generator<SheetRow, void, undefined>}
 */
function* sheetRows(tableXml, st) {
  /* R56: the repeat meter counts per sheet: each sheet's walk starts its units at zero. */
  const running = meter;
  if (running) running.units = 0;
  let rowIndex = 0;
  for (const row of iterNested(tableXml, ROW_NAMES)) {
    const rep = parseInt(row.attrs.get("number-rows-repeated") ?? "1", 10);
    const nRows = Number.isFinite(rep) && rep > 0 ? rep : 1;
    const vis = row.attrs.get("visibility");
    const hiddenAs = vis === "collapse" || vis === "filter" ? vis : null;
    if (hiddenAs !== null) {
      spend(1);
      st?.hiddenRows.push({ min: rowIndex + 1, max: rowIndex + nRows, visibility: hiddenAs });
    }

    /** @type {WalkedCell[]} */
    const cells = [];
    /* What ONE copy of this row costs beyond its cells: the spaces its texts
       expanded, the characters and the links each cell carries. */
    let rowSpaces = 0, rowChars = 0, rowLinks = 0;
    let c = 0;
    for (const cell of iterNested(row.inner, CELL_NAMES)) {
      const crep = parseInt(cell.attrs.get("number-columns-repeated") ?? "1", 10);
      const nCols = Number.isFinite(crep) && crep > 0 ? crep : 1;
      if (cell.name === "covered-table-cell") { c += nCols; continue; }
      let inner = cell.inner;
      /** @type {string | null} */
      let note = null;
      if (inner.includes("annotation")) {
        const found = elementsNested(inner, "annotation");
        if (found.length) {
          const text = found.map((a) => paragraphsText(stripElement(a.inner, "change-info"))).join("\n");
          if (hasWords(text)) note = text;
          inner = stripElement(inner, "annotation");
        }
      }
      /* R56: a typed cell with no value, no formula, no text and no note (a producer's padding to the sheet's edge) is an
         empty run: advanced over, never expanded. */
      const carries = valueAttrOf(cell.attrs) != null || cell.attrs.get("formula") != null || inner.trim() !== "" || note != null;
      /* An empty repeated run holds no content and no reference worth
         emitting; skip it but still advance the address. */
      if (carries) {
        /* Read ONCE per element, then given at each address it spans. */
        const before = currentMeter().units;
        /* The DISPLAYED form: ODF writes what the sheet shows as the cell's
           `<text:p>` children, which is the analogue of xlsx's cached <v>. */
        const display = elementsNested(inner, "p").map((p) => visibleText(p.inner)).join("\n");
        const spaces = currentMeter().units - before;
        const value = valueAttrOf(cell.attrs);
        const hrefs = hrefsIn(inner);
        const chars = display !== "" ? display.length : (value ?? "").length;
        spend(nCols);
        spend(spaces * (nCols - 1));
        spend(hrefs.length * (nCols - 1));
        spendChars(chars * (nCols - 1));
        rowSpaces += spaces * nCols;
        rowChars += chars * nCols;
        rowLinks += hrefs.length * nCols;
        const base = {
          valueType: cell.attrs.get("value-type") ?? cell.attrs.get("calcext-value-type") ?? null,
          value,
          formula: cell.attrs.get("formula") ?? null,
          display,
          hrefs,
        };
        for (let k = 0; k < nCols; k++) {
          cells.push({ col: c + k, cell: `${columnName(c + k)}${rowIndex + 1}`, ...base, note: k === 0 ? note : null });
        }
      }
      c += nCols;
    }

    /* A repeated ROW carries the same cells at each of its addresses, every
       copy after the first paid for first. A repeated run of EMPTY rows is
       the sheet's padding: it is advanced over, not materialised. */
    const materialise = cells.length ? nRows : 0;
    if (materialise > 1) {
      const copies = materialise - 1;
      spend(copies * cells.length);
      spend(copies * rowSpaces);
      spend(copies * rowLinks);
      spendChars(copies * rowChars);
    }
    for (let k = 0; k < materialise; k++) {
      const r = rowIndex + k;
      yield {
        r: r + 1,
        hidden: hiddenAs ?? false,
        cells: k === 0 ? cells : cells.map((cell) => ({ ...cell, cell: `${columnName(cell.col)}${r + 1}`, note: null })),
      };
    }
    rowIndex += nRows;
  }
}

/** The sheets of an `<office:spreadsheet>` body, with their hidden state.
 *  ODF declares hiddenness on the table's STYLE (`table:display="false"` in
 *  `<style:table-properties>`) — MEASURED as where LibreOffice writes it —
 *  and a producer may also write `table:display` on the element itself; both
 *  are read, the element winning because it is the more specific statement. */
/** @typedef {{ index: number, name: string, sheetId: null, state: string, hidden: false | "hidden", xml: string }} OdsSheet */
/**
 * @param {string} bodyXml
 * @param {AutomaticStyles} styles
 * @returns {OdsSheet[]}
 */
function sheetsOf(bodyXml, styles) {
  return elementsNested(bodyXml, "table").map((tbl, index) => {
    const styleName = tbl.attrs.get("style-name") ?? null;
    const fromElement = tbl.attrs.get("display") != null ? tbl.attrs.get("display") !== "false" : null;
    const fromStyle = styleName != null && styles.tableDisplay.has(styleName)
      ? styles.tableDisplay.get(styleName) : null;
    const displayed = fromElement ?? fromStyle ?? true;   // absence means shown; nothing is guessed
    return {
      index,
      name: tbl.attrs.get("name") ?? `table${index + 1}`,
      /* ODF identifies a table by NAME only — there is no numeric sheet id.
         null is the FORMAT speaking, not a gap in this reader. */
      sheetId: null,
      /* ODF's visibility is a boolean, so there is no xlsx "veryHidden". */
      state: displayed ? "visible" : "hidden",
      hidden: displayed ? false : "hidden",
      xml: tbl.inner,
    };
  });
}

/**
 * @typedef {Object} OdsStructure odsEntry.structure()'s answer (R14 to R17)
 * @property {true} ok
 * @property {"ods"} container
 * @property {{ sheet: number, name: string, sheetId: null, state: string, hidden: false | "hidden" }[]} sheets
 * @property {Link[]} links
 * @property {PartitionCounts} counts
 * @property {Envelope} evidentiary
 * @property {string[]} notes
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @returns {OdsStructure | ProjectionFailure}
 */
function odsStructure(parts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "ods", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  const notes = intraNotes(parts);
  /** @type {Link[]} */
  const links = [];
  /** @type {EvidentiaryItem[]} */
  const items = [];
  const body = officeBody(parts.contentXml, "spreadsheet");
  if (body == null) {
    notes.push(bodyNotRead(parts, "spreadsheet"));
  }
  if (parts.guard) notes.push("text_parts_over_bound");

  const contentXml = parts.contentXml;
  const styles = contentXml ? automaticStyles(contentXml) : noStyles();
  const sheets = body != null ? sheetsOf(body, styles) : [];

  for (const sheet of sheets) {
    /** @type {{ hiddenRows: HiddenRange[] }} */
    const st = { hiddenRows: [] };
    for (const row of sheetRows(sheet.xml, st)) {
      for (const cell of row.cells) {
        const ref = sheetCellRef(sheet.name, cell.cell);
        for (const href of cell.hrefs) links.push(linkRecord(href, ref));
        /* DEC-5: the formula BESIDE its cached value — two named fields on
           ONE item, never collapsed and never substituted for the value in
           the text stream. ODF's formula carries OpenFormula's namespace
           prefix (`of:=SUM([.B2:.B3])`); it is held VERBATIM, because
           rewriting it into another dialect would be this module inventing a
           derivation the file does not state. */
        const formula = cell.formula;
        if (formula != null) {
          items.push({
            kind: "formula",
            source: ref,
            formula,
            value: cell.display !== "" ? cell.display : cell.value,   // the cached result; null when the file carries none
          });
        }
      }
    }
    const hiddenCols = sheetHiddenCols(sheet.xml);
    if (st.hiddenRows.length) {
      items.push({ kind: "hidden-rows", sheet: sheet.name,
        rows: st.hiddenRows, count: st.hiddenRows.length, source: null });
    }
    if (hiddenCols.length) {
      items.push({ kind: "hidden-cols", sheet: sheet.name,
        cols: hiddenCols, count: hiddenCols.length, source: null });
    }
  }

  /* DEC-5: a hidden SHEET is a first-class finding — invisible in every
     rendered form of the workbook. */
  for (const sheet of sheets) {
    if (sheet.hidden) items.push({ kind: "hidden-sheet", sheet: sheet.name, state: sheet.state, source: null });
  }

  /* D-346: the manifest's embedded members, and meta.xml's core properties. */
  links.push(...parts.embedded);
  items.push(...corePropertiesItems(parts));

  return {
    ok: true,
    container: "ods",
    sheets: sheets.map((s) => ({ sheet: s.index, name: s.name, sheetId: s.sheetId, state: s.state, hidden: s.hidden })),
    links,
    counts: countPartitions(links),
    evidentiary: envelopeOf("ods", items, envelopeUndetermined(parts)),
    notes,
  };
}

/* ------------------------------------------------------------------ *
 * D-415, the `.ods` half (N27) — THE SPREADSHEET'S NAMED UNITS: each
 * `<table:named-range>` and `<table:database-range>` (ODF's table analogue)
 * that names ONE rectangle on ONE sheet of this document, as a `sheet-range`
 * unit through `rangeUnitFor`, the one place `formats-xlsx.mjs` turns a
 * rectangle into a unit; every other, and every `<table:named-expression>`
 * (a formula, as a formula-valued xlsx defined name is), SKIPPED with its
 * reason in xlsx R9's vocabulary — never dropped, never widened. No grid is
 * passed: OpenDocument fixes none (R42), so `outside_grid` cannot arise.
 *
 * WHERE THEY LIVE, and why the answer is NULL where xlsx's is a list: an xlsx
 * workbook declares its names in the small `workbook.xml`, read even over the
 * text bound; an `.ods` declares them only in `content.xml`, beside the cells.
 * So when content.xml was not read (over the bound, or no readable
 * `<office:spreadsheet>`), `rangeUnits` and `rangeUnitsSkipped` are NULL —
 * not looked, which `[]` would misstate as "this document names nothing".
 * ------------------------------------------------------------------ */

/** Split at every character `sepRe` matches outside a quoted sheet name
 *  (`'a b'`, `'it''s'`). */
/**
 * @param {string} s
 * @param {RegExp} sepRe
 * @returns {string[]}
 */
function splitUnquoted(s, sepRe) {
  /** @type {string[]} */
  const out = [];
  let quoted = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i);
    if (ch === "'") {
      if (quoted && s[i + 1] === "'") { cur += "''"; i++; continue; }
      quoted = !quoted;
    } else if (!quoted && sepRe.test(ch)) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** One ODF cell address (`$Sheet1.$A$1`, `$'My Sheet'.B2`, `.B2`) ->
 *  `{sheet (null when omitted), corner}`, `{sheet, line:true}` for a whole
 *  column or row (`.$A`, `.$3`), or null. */
/** @typedef {{ sheet: string | null, corner: { col: number, row: number } } | { sheet: string | null, line: true }} OdfCellAddress */
/**
 * @param {string | undefined} s
 * @returns {OdfCellAddress | null}
 */
function odfCellAddress(s) {
  const m = /^\$?(?:'((?:[^']|'')*)'|([^'.\s]*))\.(\S+)$/.exec(String(s ?? "").trim());
  if (!m) return null;
  /* Group 2 takes part whenever group 1 does not, and group 3 always does. */
  const sheet = m[1] != null ? m[1].replace(/''/g, "'") : (m[2] === "" || m[2] === undefined ? null : m[2]);
  const address = m[3] ?? "";
  const corner = a1Corner(address);
  if (corner) return { sheet, corner };
  return /^\$?(?:[A-Za-z]{1,3}|[1-9]\d*)$/.test(address) ? { sheet, line: true } : null;
}

/** An ODF range address (`table:cell-range-address`,
 *  `table:target-range-address`) -> `{unit}` or `{why}`. A space-separated
 *  list is several areas; the second corner may omit its sheet
 *  (`$S.$A$1:.$B$3`), meaning the first's. */
/**
 * @param {string | null} address
 * @param {string[]} sheets
 * @returns {{ unit: SheetRangeRef, why?: undefined } | { unit?: undefined, why: string }}
 */
function odsRangeAddressUnit(address, sheets) {
  const a = String(address ?? "").trim();
  if (!a) return { why: "empty_reference" };
  if (/#REF/i.test(a)) return { why: "broken_reference" };
  if (splitUnquoted(a, /\s/).filter((x) => x !== "").length > 1) return { why: "multi_area" };
  /* another document: `'file:///x.ods'#$Sheet1.A1` */
  if (/^(?:'(?:[^']|'')*'|[^'.\s]*)#/.test(a)) return { why: "external_workbook" };
  const ends = splitUnquoted(a, /:/);
  if (ends.length > 2) return { why: "not_a_range_reference" };
  const first = odfCellAddress(ends[0]);
  const second = ends.length === 2 ? odfCellAddress(ends[1]) : first;
  const sheet = first?.sheet;
  if (!first || !second || sheet == null) return { why: "not_a_range_reference" };
  const secondSheet = second.sheet;
  if (secondSheet != null && secondSheet !== sheet) return { why: "multi_sheet_reference" };
  if ("line" in first || "line" in second) return { why: "whole_row_or_column" };
  return rangeUnitFor(sheet, first.corner, second.corner, sheets, null);
}

/** Every named range, named expression and database range the spreadsheet
 *  body declares, in document order, in one walk. A named range or
 *  expression inside a sheet's `<table:table>` is scoped to that sheet
 *  (ODF 1.2+); one outside every table belongs to the document (`scope:
 *  null`). A database range's scope is the sheet its unit lies on, as an xlsx
 *  table's is. ODF has no hidden flag on a name, so `hidden` is false — the
 *  format speaking, as `sheetId: null` is. */
/** @typedef {{ source: string, name: string | null, scope: string | null, hidden: false, unit: SheetRangeRef }} RangeUnit (R44) */
/** @typedef {{ source: string, name: string | null, ref: string | null, why: string }} RangeUnitSkipped (R44) */
/**
 * @param {string} bodyXml
 * @param {OdsSheet[]} sheets
 * @returns {{ rangeUnits: RangeUnit[], rangeUnitsSkipped: RangeUnitSkipped[] }}
 */
function odsRangeUnits(bodyXml, sheets) {
  const names = sheets.map((s) => s.name);
  /** @type {RangeUnit[]} */
  const rangeUnits = [];
  /** @type {RangeUnitSkipped[]} */
  const rangeUnitsSkipped = [];
  const RE = tokens();
  let depth = 0, top = -1;
  /** @type {string | null} */
  let scope = null;
  for (;;) {
    const m = RE.exec(bodyXml);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const name = localOf(m[1]);
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    if (name === "table") {
      if (closing) { if (depth > 0 && --depth === 0) scope = null; }
      else if (depth === 0) {
        top++;
        if (!selfClosed) { depth = 1; scope = sheets[top]?.name ?? null; }
      } else if (!selfClosed) depth++;
      continue;
    }
    if (closing) continue;
    const kind = name === "named-range" || name === "named-expression" || name === "database-range" ? name : null;
    if (!kind) continue;
    const attrs = attrsOf(m[2]);
    const label = attrs.get("name") ?? null;
    if (kind === "named-expression") {
      rangeUnitsSkipped.push({ source: kind, name: label, ref: attrs.get("expression") ?? null, why: "not_a_range_reference" });
      continue;
    }
    const ref = (kind === "named-range" ? attrs.get("cell-range-address") : attrs.get("target-range-address")) ?? null;
    const r = odsRangeAddressUnit(ref, names);
    if (r.unit) {
      rangeUnits.push({ source: kind, name: label, scope: kind === "named-range" ? scope : r.unit.sheet,
        hidden: false, unit: r.unit });
    } else rangeUnitsSkipped.push({ source: kind, name: label, ref, why: r.why });
  }
  return { rangeUnits, rangeUnitsSkipped };
}

/** @param {string} str */
const utf8Length = (str) => (/[^\x00-\x7f]/.test(str) ? new TextEncoder().encode(str).length : str.length);

/** The inline-cells option as a number of bytes, or null (every cell is listed). */
/**
 * @param {TextOptions | undefined} opts
 * @returns {number | null}
 */
const inlineCellsCap = (opts) => {
  const max = opts?.inlineCellsMax;
  return typeof max === "number" && Number.isFinite(max) && max >= 0 ? max : null;
};

/**
 * @typedef {Object} OdsTextSheet one sheet of odsEntry.text() (R18, R19, R46, R49)
 * @property {number} sheet
 * @property {string} name
 * @property {false | "hidden"} hidden
 * @property {null} rows
 * @property {null} cols
 * @property {number} usedRows
 * @property {number} usedCols
 * @property {SheetRangeRef | null} range
 * @property {string} text
 * @property {TextUndetermined[]} undetermined
 * @property {number[]} lineRows
 * @property {TypedCell[] | null} cells
 * @property {true} [cells_held]
 */
/**
 * @typedef {Object} OdsText odsEntry.text()'s answer, before its images (R18 to R20, R44, R46, R49, R53)
 * @property {true} ok
 * @property {"ods"} container
 * @property {string | null} document
 * @property {OdsTextSheet[]} sheets
 * @property {RangeUnit[] | null} rangeUnits
 * @property {RangeUnitSkipped[] | null} rangeUnitsSkipped
 * @property {TextUnit[] | null} parts
 * @property {TextUndetermined[]} undetermined
 * @property {{ chars: number, cells: number, formulas: number, undetermined: number, scanned_bytes: number }} counts
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @param {ReadCtx} ctx
 * @returns {Promise<OdsText | ProjectionFailure>}
 */
async function odsText(parts, ctx) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "ods", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  const marker = parts.guard ?? parts.repeat;
  if (marker) {
    return {
      ok: true, container: "ods", document: null, sheets: [],
      rangeUnits: null, rangeUnitsSkipped: null,   // content.xml not read: not looked, never none
      parts: null,
      undetermined: [marker],
      counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  const body = officeBody(parts.contentXml, "spreadsheet");
  if (body == null) {
    const stated = parts.undetermined.find((u) => u.part === CONTENT_PART);
    /** @type {TextStatement} */
    const unread = { sheet: null, cell: null, reason: stated?.why ?? "no_office_spreadsheet_body" };
    if (stated?.final) unread.final = true;
    return {
      ok: true, container: "ods", document: null, sheets: [],
      rangeUnits: null, rangeUnitsSkipped: null,   // content.xml not read: not looked, never none
      parts: null,
      undetermined: [unread],
      counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  const contentXml = parts.contentXml ?? "";            // read: its body was found in it
  const styles = withMeter(ctx.meter, () => automaticStyles(contentXml));
  const odsSheets = withMeter(ctx.meter, () => sheetsOf(body, styles));
  /** @type {OdsTextSheet[]} */
  const outSheets = [];
  /** @type {TextUnit[]} */
  const units = [];
  let cellCount = 0, formulaCount = 0;
  /* R49: with the caller's option, the cells are listed while the JSON of all the sheets' lists is within it; past it
     none is kept (`held`), the walk goes on for the text and the counts, and `cellsIn` makes the cells of a range. */
  const cap = inlineCellsCap(ctx.opts);
  let held = /** @type {boolean} */ (false), listedBytes = 0;
  /** @type {TypedCell[][]} */
  const lists = [];
  for (const sheet of odsSheets) {
    /** @type {string[]} */
    const lines = [];
    /** @type {number[]} */
    const lineRows = [];
    /** @type {TypedCell[]} */
    const cells = [];
    lists.push(cells);
    if (!held) listedBytes += 2;
    let usedRows = 0, usedCols = 0;
    /** @param {SheetRow} row */
    const consume = (row) => {
      /** @type {string[]} */
      const vals = [];
      for (const c of row.cells) {
        if (c.formula != null) formulaCount++;
        const note = c.note;
        if (note != null) units.push({ kind: "cell_note", ref: sheetCellRef(sheet.name, c.cell).ref, part: CONTENT_PART, text: note });
        if (!held) {
          const tc = typedCellOf(sheet.name, c);
          if (tc) {
            if (cap != null) {
              listedBytes += utf8Length(JSON.stringify(tc)) + (cells.length ? 1 : 0);
              if (listedBytes > cap) { held = true; for (const l of lists) l.splice(0); }
            }
            if (!held) cells.push(tc);
          }
        }
        /* THE DISPLAYED VALUE, never the formula — the xlsx rule, so the
           derivation stays in the envelope and out of the text stream. */
        const v = c.display !== "" ? c.display : c.value;
        if (v == null || v === "") continue;
        cellCount++;
        vals.push(v);
      }
      if (vals.length) {
        const line = vals.join("\t");
        lines.push(line);
        /* A cell holding several paragraphs puts several lines of `text` on
           one row: each carries that row's number. */
        for (let k = line.split("\n").length; k > 0; k--) lineRows.push(row.r);
      }
      /* COFF-11: used extent, accumulated over the cells (a loop, never `Math.max(...rows)`), from rows that carry cells,
         so a padding run never counts as reach. */
      if (!row.cells.length) return;
      if (Number.isInteger(row.r) && row.r > usedRows) usedRows = row.r;
      for (const c of row.cells) {
        if (Number.isInteger(c.col) && c.col + 1 > usedCols) usedCols = c.col + 1;
      }
    };
    const it = sheetRows(sheet.xml, null);
    for (let more = true; more;) {
      more = withMeter(ctx.meter, () => {
        for (;;) {
          const r = it.next();
          if (r.done) return false;
          consume(r.value);
          if (windowDue()) return true;
        }
      });
      if (more) await letPass(ctx);
    }
    const text = lines.join("\n");
    /* A HIDDEN sheet's text IS extracted — the record holds what the file
       holds — and the flag is what keeps a reader from mistaking it for
       presented content (the xlsx precedent). */
    /* COFF-11 / IC-100 / D-359 — the sheet's own extent, in the two figures
       `formats-xlsx.mjs` emits and with the SAME meaning, which is the whole
       point of them being two: `usedRows`/`usedCols` is how far this sheet's
       cells reach, and `rows`/`cols` is the BOUND the `sheet-cell` arm of
       C-45.1 compares an address against.

       AND THE BOUND IS NULL HERE, DELIBERATELY. OpenDocument fixes no maximum
       table size — a `<table:table>` has no schema-level row or column limit
       and the grid a member's application offers is that APPLICATION's, which
       the file does not record. So `.ods` has no capacity to state, and the
       alternatives are both worse: bounding by the USED range would refuse a
       true citation of a cell that exists and was empty at capture (the
       decision `formats-xlsx.mjs` records at length), and borrowing OOXML's
       grid would be this reader inventing a bound the format never fixed.
       NULL is undetermined-is-first-class at this construct — the store's
       `#containerExtentForCapture` NAMES an absent level rather than reading
       it as a zero — and it means an `.ods` cell inside a known sheet stays
       unbounded and STATED. The used range is emitted anyway: it is the fact
       this walk knows, and a bound is not the only thing worth knowing. */
    outSheets.push({ sheet: sheet.index, name: sheet.name, hidden: sheet.hidden,
      rows: null, cols: null, usedRows, usedCols,
      /* FW-19 / IC-124: the sheet as a `sheet-range` unit, or NULL. */
      range: usedSheetRange(sheet.name, usedRows, usedCols),
      text, undetermined: [],
      /* R19: one 1-based sheet row per line of `text` (the row as a
         spreadsheet shows it, repeated rows counted), so a block of lines
         names its true rows; [] when the sheet has no text. */
      lineRows,
      /* R46: the typed cells, `office-readers` R30's contract field for field. */
      cells });
  }
  if (cap != null) {
    for (const o of outSheets) {
      if (held) { o.cells = null; o.cells_held = true; }
    }
  }
  const document = outSheets.map((s) => s.text).filter((t) => t.length).join("\n");
  return withMeter(ctx.meter, () => {
    const stated = statedByText(parts);
    return {
      ok: true, container: "ods", document, sheets: outSheets,
      /* D-415 (N27): named ranges and database ranges as `sheet-range` units,
         beside each sheet's whole-sheet `range`. */
      ...odsRangeUnits(body, odsSheets),
      parts: units,
      undetermined: stated,
      counts: { chars: document.length, cells: cellCount, formulas: formulaCount, undetermined: stated.length, scanned_bytes: parts.scanned },
    };
  });
}
odsText.owns = true;

/** `cellsIn` (R49): the typed cells of the rows `fromRow..toRow` and columns `fromCol..toCol` of one sheet, exactly the
 *  ones `text()` lists for them, in row then column order. With `maxCells` it stops before the row that would pass it
 *  (whole rows; a first row alone over it is given whole) and `next_row` names that row. The walk covers the sheets before
 *  the one asked for and that sheet to its `toRow`, under the same repeat meter as a whole read, and holds nothing else.
 *  Never throws. */
/**
 * @typedef {Object} CellsQuery what cellsIn() is asked for (R49)
 * @property {number | string} [sheet] the sheet's 0-based index, or its name
 * @property {number} [fromRow]
 * @property {number} [toRow]
 * @property {number} [fromCol]
 * @property {number} [toCol]
 * @property {number} [maxCells]
 */
/** @typedef {{ ok: true, cells: TypedCell[], rows: { from: number, to: number }, next_row?: number }} CellsInCells */
/** @typedef {CellsInCells | { ok: false, why: string } | SizeMarker | (RepeatMarker & { ok: false })} CellsInAnswer cellsIn()'s answer (R49) */
/** The sheet a query names: by its 0-based index, or by its name exactly, else without case when one sheet answers.
 * @param {OdsSheet[]} sheets
 * @param {number | string | undefined} asked
 * @returns {OdsSheet | null}
 */
function sheetAsked(sheets, asked) {
  if (typeof asked === "number" && Number.isInteger(asked)) return sheets[asked] ?? null;
  if (typeof asked !== "string") return null;
  const exact = sheets.find((s) => s.name === asked);
  if (exact) return exact;
  const loose = sheets.filter((s) => s.name.toLowerCase() === asked.toLowerCase());
  return loose.length === 1 ? loose[0] ?? null : null;
}

/** An object handed where parts() or bytes are expected is taken as parts()'s own output (the entries' contract, R5);
 *  a value that is no object reads as no parts.
 * @param {unknown} x
 * @returns {x is PartsResult}
 */
const asPartsGiven = (x) => x !== null && (typeof x === "object" || typeof x === "function");

/**
 * @param {OdfRow} row
 * @param {unknown} partsOrBytes parts()'s output or raw bytes; anything else reads as no parts (R38)
 * @param {CellsQuery | null | undefined} query
 * @returns {Promise<CellsInAnswer>}
 */
async function odsCellsIn(row, partsOrBytes, query) {
  try {
    const parts = partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes) ? await odfParts(row, partsOrBytes)
      : asPartsGiven(partsOrBytes) ? partsOrBytes : null;
    if (!parts || !parts.ok) return { ok: false, why: parts?.why ?? "PARTS_ABSENT" };
    if (parts.format !== row.flavour) return { ok: false, why: `not_${row.flavour}:${parts.format}` };
    const guard = parts.guard;
    if (guard) return { ...guard };
    /** @type {CellsQuery} */
    const q = query && typeof query === "object" ? query : {};
    /** @param {number} n @param {number} min */
    const whole = (n, min) => Number.isInteger(n) && n >= min;
    const fromRow = q.fromRow ?? 1, fromCol = q.fromCol ?? 1;
    const toRow = q.toRow ?? Infinity, toCol = q.toCol ?? Infinity;
    const maxCells = q.maxCells ?? Infinity;
    const body = officeBody(parts.contentXml, "spreadsheet");
    if (body == null) return { ok: false, why: parts.undetermined.find((u) => u.part === CONTENT_PART)?.why ?? "no_office_spreadsheet_body" };
    const sheets = sheetsOf(body, automaticStyles(parts.contentXml ?? ""));
    const sheet = sheetAsked(sheets, q.sheet);
    if (!sheet) return { ok: false, why: "no_such_sheet" };
    if (!whole(fromRow, 1) || !whole(fromCol, 1) || !(toRow === Infinity || whole(toRow, fromRow))
      || !(toCol === Infinity || whole(toCol, fromCol)) || !(maxCells === Infinity || whole(maxCells, 1))) {
      return { ok: false, why: "bad_range" };
    }
    const target = sheet;     // the walk below refers to it from a closure
    /** @type {TypedCell[]} */
    const cells = [];
    /** @type {{ nextRow: number | null, last: number }} where the walk stopped */
    const at = { nextRow: null, last: 0 };
    try {
      withMeter(newMeter(), () => {
        for (const other of sheets) {
          for (const r of sheetRows(other.xml, null)) {
            if (other !== target) continue;
            if (r.r > toRow) return;
            at.last = r.r;
            if (r.r < fromRow) continue;
            /** @type {TypedCell[]} */
            const rowCells = [];
            for (const c of r.cells) {
              if (c.col + 1 < fromCol || c.col + 1 > toCol) continue;
              const tc = typedCellOf(target.name, c);
              if (tc) rowCells.push(tc);
            }
            if (cells.length > 0 && cells.length + rowCells.length > maxCells) { at.nextRow = r.r; return; }
            for (const tc of rowCells) cells.push(tc);
          }
          if (other === target) return;
        }
      });
    } catch (e) {
      if (e instanceof OverRepeatBound) return { ok: false, ...e.marker };
      throw e;
    }
    const nextRow = at.nextRow;
    const to = nextRow != null ? nextRow - 1 : Math.max(fromRow - 1, Math.min(toRow, at.last));
    return { ok: true, cells, rows: { from: fromRow, to }, ...(nextRow != null ? { next_row: nextRow } : {}) };
  } catch (e) {
    return { ok: false, why: `reader_failed:${errorName(e)}` };
  }
}

/* ================================================================== *
 * .odp — the PRESENTATION, in pptx.mjs's shape
 * ================================================================== */

/* The shape-bearing draw:* elements, in the sense pptx.mjs's SHAPE_TAGS uses:
 * one sequence per slide in document order, nested included, so a shape index
 * means the same thing to every reference into that slide. */
const ODP_SHAPE_TAGS = new Set([
  "frame", "custom-shape", "rect", "ellipse", "circle", "line", "polyline",
  "polygon", "path", "connector", "measure", "caption", "g", "page-thumbnail",
  "control", "object", "image",
]);

/** One page's shapes: index, visible text, and the hrefs each carries. The
 *  `<presentation:notes>` subtree is EXCLUDED — the notes are walked
 *  separately and emitted as their own unit, never merged into slide text. */
/**
 * @typedef {Object} PageWalk
 * @property {number} count the shapes opened, nested included
 * @property {string[]} pageHrefs the links no shape owns
 * @property {{ shape: number, text: string | null, textBox: boolean, hrefs: string[] }[]} shapes
 */
/**
 * @param {string} pageXml
 * @param {{ withText?: boolean }} [opts]
 * @returns {PageWalk}
 */
function walkPage(pageXml, { withText = true } = {}) {
  const slideOnly = stripElement(pageXml, "notes");
  /** @type {{ shape: number, name: string, attrs: Attrs, inner: string }[]} */
  const shapes = [];
  const RE = tokens();
  let index = -1;
  /** @type {{ index: number, start: number, name: string, attrs: Attrs }[]} */
  const open = [];
  /* EACH LINK IS LOCATED ONCE, to the shape that owns it. A `<text:a>` inside
     a paragraph belongs to the innermost shape open around it — never also to
     the groups enclosing that shape, which counted one link once per level.
     A `<draw:a>` outside any paragraph WRAPS a shape (OpenDocument's
     clickable shape) and belongs to the first shape it opens; one that wraps
     no shape belongs to the shape around it, or, at page level, to the page
     itself (`page`), never dropped. */
  /** @typedef {{ href: string, placed: boolean }} PendingHref */
  const hrefsOf = new Map(/** @type {[number, string[]][]} */ ([]));                  // shape index → hrefs
  /** @type {string[]} */
  const pageHrefs = [];
  /** @type {PendingHref[]} */
  const pending = [];                         // draw:a hrefs waiting for their shape
  /** @type {(PendingHref | null)[]} */
  const aStack = [];                          // for each open <a>: its pending entry, or null
  let paraDepth = 0;
  /** @param {string} href */
  const own = (href) => {
    const top = open.length ? open[open.length - 1]?.index ?? null : null;
    if (top == null) pageHrefs.push(href);
    else {
      const held = hrefsOf.get(top);
      if (held) held.push(href); else hrefsOf.set(top, [href]);
    }
  };
  for (;;) {
    const m = RE.exec(slideOnly);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const name = localOf(m[1]);
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    if (name === "p" || name === "h") {
      if (!selfClosed) paraDepth = Math.max(0, paraDepth + (closing ? -1 : 1));
      continue;
    }
    if (name === "a") {
      if (closing) {
        const entry = aStack.pop();
        if (entry && !entry.placed) {
          pending.splice(pending.lastIndexOf(entry), 1);
          own(entry.href);
        }
        continue;
      }
      const href = attrsOf(m[2]).get("href");
      if (href == null) { if (!selfClosed) aStack.push(null); continue; }
      if (paraDepth > 0 || selfClosed) { own(href); if (!selfClosed) aStack.push(null); continue; }
      /** @type {PendingHref} */
      const entry = { href, placed: false };
      pending.push(entry);
      aStack.push(entry);
      continue;
    }
    if (!ODP_SHAPE_TAGS.has(name)) continue;
    if (closing) {
      const o = open.pop();
      if (o) shapes.push({ shape: o.index, name: o.name, attrs: o.attrs, inner: slideOnly.slice(o.start, m.index) });
      continue;
    }
    index++;
    if (pending.length) {
      hrefsOf.set(index, pending.map((e) => e.href));
      for (const e of pending) e.placed = true;
      pending.splice(0);
    }
    if (selfClosed) { shapes.push({ shape: index, name, attrs: NO_ATTRS, inner: "" }); continue; }
    open.push({ index, start: RE.lastIndex, name, attrs: name === "frame" ? attrsOf(m[2]) : NO_ATTRS });
  }
  /* An unclosed wrapper at the end of the page still states its link. */
  for (const e of pending) pageHrefs.push(e.href);
  /* A shape left open at the end of the page (malformed markup) still counts
     and still carries its text, to the end of the page. */
  for (;;) {
    const o = open.pop();
    if (!o) break;
    shapes.push({ shape: o.index, name: o.name, attrs: o.attrs, inner: slideOnly.slice(o.start) });
  }
  shapes.sort((a, b) => a.shape - b.shape);
  return {
    count: index + 1,
    pageHrefs,
    shapes: shapes.map((s) => ({
      shape: s.shape,
      /* A group's text is the text of the shapes inside it, which are their
         own entries; taking the group's inner markup would double-count it in
         the slide's text, so a shape's OWN text is the paragraphs outside
         every shape nested in it: a frame's `<draw:text-box>` or table, and
         the paragraphs a custom shape or rectangle holds DIRECTLY (which a
         text-box-only reading dropped). */
      text: withText ? ownShapeText(s.inner) : null,   // structure() emits none, so expands none (R45)
      /* R53: a free text box, a frame holding a text box that is no placeholder of the layout (`presentation:class`). */
      textBox: s.name === "frame" && s.attrs.get("class") == null && s.inner.includes("text-box"),
      hrefs: hrefsOf.get(s.shape) ?? [],
    })),
  };
}

/** The paragraphs (`<text:p>`/`<text:h>`) of a shape's inner markup that lie
 *  outside every shape nested in it, each as visible text, newline-joined. */
/**
 * @param {string} xml
 * @returns {string}
 */
function ownShapeText(xml) {
  /** @type {string[]} */
  const paras = [];
  const RE = tokens();
  let shapeDepth = 0, paraDepth = 0, start = -1;
  for (;;) {
    const m = RE.exec(xml);
    if (m === null) break;
    if (m[1] === undefined) continue;
    const name = localOf(m[1]);
    const closing = m[0][1] === "/";
    const selfClosed = m[3] === "/";
    if (ODP_SHAPE_TAGS.has(name)) {
      if (closing) shapeDepth = Math.max(0, shapeDepth - 1);
      else if (!selfClosed) shapeDepth++;
      continue;
    }
    if (shapeDepth > 0 || (name !== "p" && name !== "h")) continue;
    if (selfClosed) { if (paraDepth === 0) paras.push(""); continue; }
    if (!closing) { if (paraDepth++ === 0) start = RE.lastIndex; continue; }
    if (paraDepth > 0 && --paraDepth === 0) paras.push(visibleText(xml.slice(start, m.index)));
  }
  return paras.join("\n");
}

/**
 * @param {string} pageXml
 * @returns {string | null}
 */
function notesTextOf(pageXml) {
  const notes = elementsNested(pageXml, "notes")[0];
  if (!notes) return null;
  return elementsNested(notes.inner, "text-box")
    .map((tb) => elementsNested(tb.inner, "p").map((p) => visibleText(p.inner)).join("\n"))
    .filter((t) => t.length)
    .join("\n");
}

/** The deck, in the order the BYTES declare it. Unlike PPTX — where slide
 *  numbers must come from `<p:sldIdLst>` because `slideN.xml` records creation
 *  order — OpenDocument's `<draw:page>` elements ARE in presentation order
 *  inside the one content.xml, so the deck order needs no indirection and can
 *  never be unreadable while the body is readable. */
/** @typedef {{ slide: number, name: string | null, hidden: boolean, xml: string }} OdpPage */
/**
 * @param {string} bodyXml
 * @param {AutomaticStyles} styles
 * @returns {OdpPage[]}
 */
function deckOf(bodyXml, styles) {
  return elementsNested(bodyXml, "page").map((page, i) => {
    const styleName = page.attrs.get("style-name") ?? null;
    const fromElement = page.attrs.get("visibility") != null ? page.attrs.get("visibility") !== "hidden" : null;
    const fromStyle = styleName != null && styles.pageVisible.has(styleName)
      ? styles.pageVisible.get(styleName) : null;
    const visible = fromElement ?? fromStyle ?? true;     // absence means shown
    return { slide: i + 1, name: page.attrs.get("name") ?? null, hidden: !visible, xml: page.inner };
  });
}

/**
 * @typedef {Object} OdpStructure odpEntry.structure()'s answer (R21 to R23)
 * @property {true} ok
 * @property {"odp"} container
 * @property {number | null} slides
 * @property {Link[]} links
 * @property {PartitionCounts} counts
 * @property {Envelope} evidentiary
 * @property {string[]} notes
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @returns {OdpStructure | ProjectionFailure}
 */
function odpStructure(parts) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "odp", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  const notes = intraNotes(parts);
  /** @type {Link[]} */
  const links = [];
  /** @type {EvidentiaryItem[]} */
  const items = [];
  const body = officeBody(parts.contentXml, "presentation");
  if (body == null) {
    notes.push(bodyNotRead(parts, "presentation"));
  }
  const contentXml = parts.contentXml;
  const styles = contentXml ? automaticStyles(contentXml) : noStyles();
  const deck = body != null ? deckOf(body, styles) : null;

  if (deck) {
    for (const page of deck) {
      const walked = walkPage(page.xml, { withText: false });
      for (const s of walked.shapes) {
        for (const href of s.hrefs) links.push(linkRecord(href, slideShapeRef(page.slide, s.shape)));
      }
      for (const href of walked.pageHrefs) links.push(linkRecord(href, slideShapeRef(page.slide)));
      /* DEC-5: SPEAKER NOTES — routinely more candid than the slide, and
         removed from every presented form. Their own envelope kind, their own
         text unit, never merged. */
      const nt = notesTextOf(page.xml);
      if (nt != null && nt.length) {
        items.push({ kind: "speaker-notes", slide: page.slide, part: CONTENT_PART, text: nt,
          source: slideShapeRef(page.slide) });
      }
      /* DEC-5: a HIDDEN slide is invisible in every presented form. Extracted
         in full, and FLAGGED everywhere shown, cited or indexed. */
      if (page.hidden) {
        items.push({ kind: "hidden-slide", slide: page.slide, part: CONTENT_PART,
          source: slideShapeRef(page.slide) });
      }
    }
  }

  /* D-346: the manifest's embedded members, and meta.xml's core properties. */
  links.push(...parts.embedded);
  items.push(...corePropertiesItems(parts));

  return {
    ok: true,
    container: "odp",
    slides: deck ? deck.length : null,       // null = honestly unknown
    links,
    counts: countPartitions(links),
    evidentiary: envelopeOf("odp", items, envelopeUndetermined(parts)),
    notes,
  };
}

/** @typedef {{ slide: number, ref: string, part: string, hidden: boolean, shapes: number, text: string }} OdpSlide */
/** @typedef {{ slide: number, ref: string, part: string, hidden: boolean, text: string }} OdpSpeakerNotes */
/**
 * @typedef {Object} OdpText odpEntry.text()'s answer, before its images (R24 to R27, R53)
 * @property {true} ok
 * @property {"odp"} container
 * @property {string | null} document
 * @property {OdpSlide[]} slides
 * @property {OdpSpeakerNotes[]} speakerNotes
 * @property {TextUnit[] | null} parts
 * @property {number | null} deckLength
 * @property {TextUndetermined[]} undetermined
 * @property {{ chars: number, notesChars: number, undetermined: number, scanned_bytes: number }} counts
 */
/**
 * @param {PartsResult | null | undefined} parts
 * @param {ReadCtx} ctx
 * @returns {Promise<OdpText | ProjectionFailure>}
 */
async function odpText(parts, ctx) {
  if (!parts || !parts.ok) {
    return { ok: false, container: "odp", reason: parts?.why ?? "PARTS_ABSENT", part: parts?.part ?? null };
  }
  /* COFF-13: `deckLength` is NULL on both branches that did not read the body —
     the deck lives only in content.xml, so a format that has not read it
     cannot answer, and the null is a statement rather than a zero. */
  const marker = parts.guard ?? parts.repeat;
  if (marker) {
    return {
      ok: true, container: "odp", document: null, slides: [], speakerNotes: [], parts: null,
      deckLength: null,
      undetermined: [marker],
      counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  const body = officeBody(parts.contentXml, "presentation");
  if (body == null) {
    const stated = parts.undetermined.find((u) => u.part === CONTENT_PART);
    /** @type {TextStatement} */
    const unread = { reason: "main_part_unreadable", part: CONTENT_PART, why: stated?.why ?? "no_office_presentation_body" };
    if (stated?.final) unread.final = true;
    return {
      ok: true, container: "odp", document: null, slides: [], speakerNotes: [], parts: null,
      deckLength: null,
      undetermined: [unread],
      counts: { chars: 0, notesChars: 0, undetermined: 1, scanned_bytes: parts.scanned },
    };
  }
  /** @type {OdpSlide[]} */
  const slides = [];
  /** @type {OdpSpeakerNotes[]} */
  const speakerNotes = [];
  /** @type {TextUnit[]} */
  const units = [];
  const deck = withMeter(ctx.meter, () => deckOf(body, automaticStyles(parts.contentXml ?? "")));
  for (const page of deck) {
    withMeter(ctx.meter, () => {
      const walked = walkPage(page.xml);
      const text = walked.shapes.map((s) => s.text).filter((t) => t !== null && t.length > 0).join("\n");
      /* COFF-11 / IC-100 / D-359 — the slide's shape COUNT, which `walkPage` has
         always returned as `count` and this entry has always discarded. The
         pptx.mjs decision applies verbatim and for the same reason: a shape list
         is EXHAUSTIVE, so there is no used-range-versus-capacity question to
         answer here and the count is both figures at once. `count` is the number
         of shape OPENS in document order, nested included, which is the same
         sequence `slideShapeRef` numbers against — so the bound and the
         references it bounds are counted by one walk. */
      slides.push({ slide: page.slide, ref: `slide ${page.slide}`, part: CONTENT_PART,
        hidden: page.hidden, shapes: walked.count, text });
      /** @param {TextUnit} u a hidden page's unit is marked hidden */
      const add = (u) => { if (page.hidden) u.hidden = true; units.push(u); };
      for (const sh of walked.shapes) {
        const shapeText = sh.text;
        if (sh.textBox && shapeText !== null && hasWords(shapeText)) add({ kind: "text_box", ref: `slide ${page.slide} shape ${sh.shape}`, part: CONTENT_PART, text: shapeText });
      }
      const nt = notesTextOf(page.xml);
      if (nt != null && nt.length) {
        speakerNotes.push({ slide: page.slide, ref: `slide ${page.slide} (notes)`, part: CONTENT_PART,
          hidden: page.hidden, text: nt });
        add({ kind: "speaker_note", ref: `slide ${page.slide} (notes)`, part: CONTENT_PART, text: nt });
      }
    });
    if (windowDue(ctx.meter)) await letPass(ctx);
  }
  const master = withMeter(ctx.meter, () => masterUnits(parts.stylesXml, "odp"));
  units.push(...master);
  /* `document` is the deck as PRESENTED — a hidden slide's text is in it (the
     flag is what distinguishes it), speaker notes NEVER are, and the two are
     counted apart so no indexer can conflate them by accident. */
  const document = slides.map((s) => s.text).filter((t) => t.length).join("\n");
  const notesChars = speakerNotes.reduce((n, s) => n + s.text.length, 0);
  const stated = statedByText(parts);
  return {
    ok: true, container: "odp", document, slides, speakerNotes, parts: units,
    /* COFF-13 — THE DECK'S OWN LENGTH, on pptx.mjs's key. Every `<draw:page>`
       lives in the one content.xml, so once the body is read no slide can be
       unreadable on its own and the length EQUALS the slide list — emitted
       anyway, so the wire reads one key from every deck entry rather than
       inferring it from which entry answered. */
    deckLength: deck.length,
    undetermined: stated,
    counts: { chars: document.length, notesChars, undetermined: stated.length, scanned_bytes: parts.scanned },
  };
}
odpText.owns = true;

/* ================================================================== *
 * The three I7 entries (registered by formats.mjs — one registerFormat
 * call each there, and NOTHING anywhere else; that is the D-70 property
 * this axis exists to keep)
 * ================================================================== */

/**
 * @template {{ ok: true }} S
 * @template {{ ok: true }} X
 * @typedef {Object} OdfEntry an I7 FormatEntry (R1 to R5, R38, R47, R49)
 * @property {string} format
 * @property {(bytes: unknown, contentType?: unknown) => Detected | null} detect
 * @property {(bytes: unknown) => Promise<PartsResult>} parts
 * @property {(partsOrBytes: unknown) => Promise<(S & { active: ActiveItem[] }) | ProjectionFailure>} structure
 * @property {(partsOrBytes: unknown, opts?: TextOptions) => Promise<(X & { active: ActiveItem[] } & ImagesPart) | ProjectionFailure>} text
 */
/** @typedef {(partsOrBytes: unknown, query?: CellsQuery | null) => Promise<CellsInAnswer>} CellsIn (R49) */
/**
 * @template {{ ok: true }} S
 * @template {{ ok: true }} X
 * @param {OdfRow} row
 * @param {(parts: PartsResult | null | undefined) => S | ProjectionFailure} structureOf
 * @param {{ (parts: PartsResult | null | undefined, ctx: ReadCtx): Promise<X | ProjectionFailure>, owns?: boolean }} textOf
 * @returns {OdfEntry<S, X>}
 */
function entryFor(row, structureOf, textOf) {
  /* R38: a stated refusal, never an exception, whatever the argument. */
  /** @param {unknown} e @returns {ProjectionFailure} */
  const failed = (e) => ({ ok: false, container: row.flavour, reason: `reader_failed:${errorName(e)}`, part: null });
  /* Raw bytes in any form `asBytes` accepts are read through parts(); anything else is taken as parts()'s own output. */
  /** @param {unknown} partsOrBytes @returns {Promise<PartsResult | null>} */
  const partsOf = async (partsOrBytes) => (partsOrBytes instanceof ArrayBuffer || ArrayBuffer.isView(partsOrBytes) ? odfParts(row, partsOrBytes)
    : asPartsGiven(partsOrBytes) ? partsOrBytes : null);
  /* R45: each projection is one content.xml read, on its own meter. The read
     that would cross the bound stops, and the projection answers as it does
     over the size guard, content.xml not read and the repeat marker stated;
     what parts() read outside content.xml (R28–R30) is still answered. A projection that awaits (`owns`) installs the
     meter for its own synchronous windows (R49); the others run under it whole. */
  /**
   * @template {{ ok: true }} T
   * @param {{ (parts: PartsResult | null | undefined, ctx: ReadCtx): T | ProjectionFailure | Promise<T | ProjectionFailure>, owns?: boolean }} projectionOf
   * @param {PartsResult | null | undefined} parts
   * @param {TextOptions} [opts]
   * @returns {Promise<(T & { active: ActiveItem[] }) | ProjectionFailure>}
   */
  const bounded = async (projectionOf, parts, opts) => {
    /** @param {PartsResult | null | undefined} p */
    const run = (p) => {
      /** @type {ReadCtx} */
      const ctx = { meter: newMeter(), opts, yieldNow: opts?.yieldNow };
      return projectionOf.owns ? projectionOf(p, ctx) : withMeter(ctx.meter, () => projectionOf(p, ctx));
    };
    /** @type {T | ProjectionFailure} */
    let out;
    try { out = await run(parts); } catch (e) {
      /* Only a read of parts() that succeeded expands anything, so only it can cross the bound. */
      if (!(e instanceof OverRepeatBound) || !parts || !parts.ok) throw e;
      out = await run({ ...parts, contentXml: null, repeat: e.marker });
    }
    return withActive(parts, out);
  };
  /* R47: both projections carry parts()' one `active` list, on every
     successful answer, the bound branches included. */
  /**
   * @template {{ ok: true }} T
   * @param {PartsResult | null | undefined} parts
   * @param {T | ProjectionFailure} out
   * @returns {(T & { active: ActiveItem[] }) | ProjectionFailure}
   */
  const withActive = (parts, out) => (out && out.ok ? { ...out, active: parts && parts.ok ? parts.active : [] } : out);
  /** @type {OdfEntry<S, X>} */
  const entry = {
    format: row.flavour,
    detect: (bytes, contentType) => detectOdf(row, bytes, contentType),
    parts: (bytes) => odfParts(row, bytes),
    /* Accept either parts() output or raw bytes, exactly as the three OOXML
       entries do, so detect→structure works uniformly at the registry seam
       while a caller that already paid for parts() does not pay twice. */
    structure: async (partsOrBytes) => {
      try { return await bounded(structureOf, await partsOf(partsOrBytes)); } catch (e) { return failed(e); }
    },
    /* FW-19 / IC-124: `images` under the package's `Pictures/` directory,
       exhaustive or NULL, through the one enumerator the OOXML entries use.
       Read off the central directory, so it does NOT depend on
       META-INF/manifest.xml; the manifest walk (D-346) leaves these images
       out of `intra` so one image is never addressed twice. `opts` (R49): `inlineCellsMax` and `yieldNow`. */
    text: async (partsOrBytes, opts) => {
      try {
        const parts = await partsOf(partsOrBytes);
        return await withContainerImages(await bounded(textOf, parts, opts), parts, "Pictures/");
      } catch (e) { return failed(e); }
    },
  };
  return entry;
}

export const odtEntry = entryFor(ODT_ROW, odtStructure, odtText);
/** The `.ods` entry carries the optional slot `cellsIn` (R49). */
/** @type {OdfEntry<OdsStructure, OdsText> & { cellsIn: CellsIn }} */
export const odsEntry = { ...entryFor(ODS_ROW, odsStructure, odsText), cellsIn: (partsOrBytes, query) => odsCellsIn(ODS_ROW, partsOrBytes, query) };
export const odpEntry = entryFor(ODP_ROW, odpStructure, odpText);

/* ==================================================================
 * D-351 — THE EVIDENTIARY DIGEST OF AN OPENDOCUMENT PACKAGE, taken over
 * the CONTAINER'S substance member and never over the envelope
 * ================================================================== */

/* WHY THIS EXISTS. A Google Drive export is Google's conversion AT FETCH
 * TIME, and its ZIP envelope differs on every request (timestamps, member
 * order — MEASUREMENTS.md 2026-09-14 §4). So `capture_sha`, the trust root,
 * differs across three fetches of a document that did not change, and C-18.3's
 * corroboration fold and monitoring's "has the substance changed?" both lost
 * the document. `capture_sha` STAYS the envelope's: this digest is the §5
 * `evidentiary` digest beside it (BIO_Content_Framework_v0_10.md §5;
 * DOCUMENT-PROFILES.md "Three digests, not one"), never a replacement.
 *
 * WHAT IT IS, so anyone can recompute it from the artifact with two stock
 * tools: the sha256 of the `content.xml` member's INFLATED bytes, exactly
 * as `readPart` proves them whole (length and CRC-32 against the central
 * directory). For `.ods` no byte of content.xml is rewritten; for `.odt` the
 * list ids Google mints per export are relabelled (D-473, below). Outside content.xml the
 * package's other members are discounted, and each discount is a region
 * judgment §5 licenses: `meta.xml` (generation timestamps, the producer's
 * stamp — mechanical), `settings.xml` (view state — mechanical), the ZIP
 * envelope (per-request timestamps and order — mechanical, MEASURED to move),
 * `styles.xml`, `Thumbnails/` and the font faces content.xml names (page
 * styles, a preview and glyph shapes — presentational; D-612, below).
 *
 * WHY content.xml CAN SPEAK FOR THE SUBSTANCE, AND WHEN IT CANNOT. OpenDocument
 * puts the whole body — every cell, its formula beside its value, every
 * annotation and tracked change — in content.xml (this module's header). What
 * it does NOT hold is the bytes of a member it REFERENCES: an image under
 * `Pictures/`, an embedded object or chart under `Object N/`. A changed image
 * under an unchanged name would leave content.xml byte-identical, and a digest
 * that folded those two captures would hide a real change — the one failure
 * §"The failure asymmetry" says matters. So a package whose content.xml
 * references ANY member of the package is UNDETERMINED, naming the member;
 * the rule is the reference, not a list of directory names, so a producer
 * that puts an image somewhere else is caught the same way.
 *
 * WHY ONLY `.ods`, AND THE SPLIT IS THE ROW'S OWN ALTERNATIVE ("state it, or
 * split .odt out"). A normalisation is added only on MEASUREMENT (DOCUMENT-
 * PROFILES.md, "The failure asymmetry"):
 *   .ods  content.xml byte-identical across exports: 3 of 3 (MEASUREMENTS.md
 *         2026-09-14 §4) and 18 of 18 over 3 census targets (M-123). No
 *         normalisation is needed and none is applied.
 *   .odt  content.xml differs raw on exports carrying a list: M-123 found the
 *         class on 2 documents — a random `xml:id` on `<text:list>`. D-473
 *         RE-MEASURED it (M-167, a fresh population of public government Docs,
 *         two rounds apart in time): the only difference in every list-bearing
 *         pair is `text:list@xml:id`, and content.xml relabelled by
 *         `odtNormalisedContentXml` is byte-stable on every pair the digest can
 *         reach. The one other class M-167 saw (`draw:frame@draw:name`,
 *         `imageN` permuted per export) occurs only where content.xml references
 *         a `Pictures/` member, which the member rule below already refuses.
 *   .odp  content.xml raw byte-stable on every pair M-167 read, but every deck
 *         in that population references a package member, and the census holds
 *         no Slides target (M-123). UNDETERMINED until a census target is
 *         measured (M-167 names it).
 * Widening this is one entry in `ODF_EVIDENTIARY_MEASURED` plus the
 * measurement it cites, and any normalisation that measurement licensed
 * (`ODF_EVIDENTIARY_NORMALISE`, below). */
export const ODF_EVIDENTIARY_VERSION = 1;
/** The flavours this module's rows define, READ OFF the rows so the control
 *  plane can ask "is this an OpenDocument format?" without learning the names
 *  (formats-odf.test.mjs pins that index.mjs spells none of them — D-70). */
export const ODF_FORMATS = Object.freeze([ODT_ROW.flavour, ODS_ROW.flavour, ODP_ROW.flavour]);
export const ODF_EVIDENTIARY_MEASURED = Object.freeze({
  ods: localize("odf-reader.odf.content_xml_byte_identical_across", "content.xml byte-identical across Google exports of an unchanged document: 3/3 (the MEASUREMENTS ledger 2026-09-14 §4) and 18/18 over 3 census targets (M-123)"),
  odt: localize("odf-reader.odf.content_xml_with_text_list", "content.xml with text:list xml:id relabelled is byte-identical across two Google exports taken apart in time on every pair M-167 read (8 public government Docs; the only list-bearing difference is text:list@xml:id), after M-123 found the class on 2 census documents"),
});
/** The measured flavours, by flavour. */
/** @type {ReadonlyMap<string, string>} */
const MEASURED_BY_FLAVOUR = new Map(Object.entries(ODF_EVIDENTIARY_MEASURED));
/** @type {Readonly<{ [flavour: string]: string }>} */
const ODF_EVIDENTIARY_UNMEASURED = Object.freeze({
  odp: localize("odf-reader.odf.no_odp_export_has_been", "no .odp export has been measured for content.xml stability on a census target: M-167 read 8 public government Slides decks (content.xml raw byte-identical on every readable pair, every deck referencing a package member) and M-123's census holds no Slides target, so no evidentiary digest is claimed for .odp"),
});

/** Package members that content.xml REFERENCES by `href`, among the members
 *  the container actually holds. Every href-bearing attribute is read, in any
 *  namespace prefix (`attrsOf` keys by local name); a scheme-bearing URL or a
 *  bare fragment is not a package member. A directory reference (`./Object 1`)
 *  matches the members under it.
 *
 *  D-612 — ONE ELEMENT IS NOT COUNTED: `font-face-uri` (by local name, any
 *  prefix; Google writes `svg:font-face-uri`). Every real Google Doc export
 *  embeds its fonts as `Fonts/fontN.ttf` and names them from
 *  `office:font-face-decls` (M-167: 8 of 8 Docs, 8–9 fonts each), so counting
 *  them refused the digest on every real Doc. A font face is presentational —
 *  how a glyph is drawn, not what the document says — the same §5 judgment that
 *  discounts `styles.xml`. The exemption is the ELEMENT, not the `Fonts/`
 *  directory: an image or embedded object (`Pictures/`, `Object N/`) is
 *  referenced from `draw:image` / `draw:object` and still refuses, wherever the
 *  producer puts it. WHAT IT DOES NOT SEE: a font whose glyphs were redrawn
 *  under an unchanged name would render differently with content.xml
 *  unchanged; the rule discounts that as it discounts a restyled styles.xml. */
const PRESENTATIONAL_REF = new Set(["font-face-uri"]);
/**
 * @param {string} contentXml
 * @param {OoxmlContainer} container
 * @returns {string[]}
 */
function referencedMembers(contentXml, container) {
  /** @type {string[]} */
  const names = container.entries.map((/** @type {OoxmlContainer} */ e) => normalizePartName(e.name));
  /** @type {Set<string>} */
  const hit = new Set();
  const RE = tokens();
  for (;;) {
    const m = RE.exec(contentXml);
    if (m === null) break;
    if (m[1] === undefined || m[0][1] === "/") continue;
    if (PRESENTATIONAL_REF.has(localOf(m[1]))) continue;
    const href = attrsOf(m[2]).get("href");
    if (typeof href !== "string" || !href || href.startsWith("#")) continue;
    if (/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(href)) continue;
    const want = normalizePartName(href.replace(/^(?:\.\/)+/, "").replace(/\/+$/, ""));
    if (!want) continue;
    for (const n of names)
      if (n === want || n.startsWith(want + "/")) hit.add(n);
  }
  return [...hit];
}

/* D-473 — THE `.odt` NORMALISATION: RELABEL THE LIST IDS GOOGLE MINTS PER EXPORT.
 * M-123 found, and D-473's measurement (M-167) re-measured over a fresh population,
 * that Google writes a fresh random `xml:id` on every `<text:list>` at every
 * export (`list888038964` → `list3685929024`). An `xml:id` is an identifier
 * and says nothing a reader sees; what it CAN carry is a relationship — a list
 * whose `text:continue-list` names another list's id continues that list's
 * numbering, which a reader does see. So the ids are not stripped: each
 * `xml:id` on a `text:list` start tag is RELABELLED `L1`, `L2`, … in document
 * order, and every `text:continue-list` naming a relabelled id is rewritten to
 * its label. Two exports that differ only by the random ids then carry one
 * digest, and a list that continues a DIFFERENT list still moves it.
 *
 * WHAT IT DOES NOT REACH, so the rule is not read as wider than it is: it
 * matches the literal qualified names `text:list`, `xml:id` and
 * `text:continue-list` as Google writes them. A producer binding the text
 * namespace to another prefix is not normalised, its digest moves on every
 * export and the capture reads CHANGED — the safe direction (a change claimed,
 * never a sameness). A `text:continue-list` naming an id no list carries is
 * left verbatim. content.xml that is not valid UTF-8 is refused (null), never
 * decoded lossily, because a replacement character would make two different
 * byte strings equal for free. */
const LIST_ID_RE = /(<text:list\b[^>]*?\sxml:id\s*=\s*)("([^"]*)"|'([^']*)')/g;
const CONTINUE_RE = /(\stext:continue-list\s*=\s*)("([^"]*)"|'([^']*)')/g;
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });
/** content.xml's bytes with Google's per-export list ids relabelled, or null
 *  when the bytes are not valid UTF-8. Exported so the measurement instrument
 *  digests exactly what the product digests. */
/**
 * @param {Uint8Array} bytes
 * @returns {Uint8Array | null}
 */
export function odtNormalisedContentXml(bytes) {
  let xml = "";
  try { xml = UTF8_STRICT.decode(bytes); } catch { return null; }
  const label = new Map(/** @type {[string, string][]} */ ([]));
  /* One of the two quoted forms always takes part in a match. */
  let out = xml.replace(LIST_ID_RE, (/** @type {string} */ m, /** @type {string} */ head, /** @type {string} */ q, /** @type {string | undefined} */ dq, /** @type {string | undefined} */ sq) => {
    const id = dq ?? sq ?? "";
    if (!label.has(id)) label.set(id, `L${label.size + 1}`);
    return `${head}"${label.get(id)}"`;
  });
  out = out.replace(CONTINUE_RE, (/** @type {string} */ m, /** @type {string} */ head, /** @type {string} */ q, /** @type {string | undefined} */ dq, /** @type {string | undefined} */ sq) => {
    const id = dq ?? sq ?? "";
    return label.has(id) ? `${head}"${label.get(id)}"` : m;
  });
  return new TextEncoder().encode(out);
}
/** Per flavour, the normalisation applied to content.xml before it is digested.
 *  `.ods` needs none (content.xml measured byte-stable, M-123). */
/** @type {Readonly<{ [flavour: string]: { name: string, apply: (bytes: Uint8Array) => Uint8Array | null } }>} */
const ODF_EVIDENTIARY_NORMALISE = Object.freeze({
  odt: { name: "odt-list-ids v1 (xml:id on text:list relabelled in document order, text:continue-list rewritten to match)",
         apply: odtNormalisedContentXml },
});

/** The evidentiary digest of an OpenDocument package, or a stated refusal.
 *  `sha256Hex` is the caller's hasher (the plane's, so identity and this digest
 *  are named by one function). Returns
 *    { determined:true, flavour, over:"content.xml", evidentiary, basis }
 *  or { determined:false, flavour|null, evidentiary:null, basis }. Never throws
 *  on bad bytes: every failure is a sentence. */
/**
 * @typedef {{ determined: true, flavour: string, over: string, evidentiary: string, basis: string }
 *   | { determined: false, flavour: string | null, evidentiary: null, basis: string }} EvidentiaryDigest (R32 to R37)
 */
/** @typedef {(bytes: Uint8Array) => string | Promise<string>} Sha256Hex the caller's hasher: the sha256 of the bytes, in hex */
/**
 * @param {unknown} bytes
 * @param {Sha256Hex} sha256Hex
 * @returns {Promise<EvidentiaryDigest>}
 */
export async function odfEvidentiaryDigest(bytes, sha256Hex) {
  try { return await odfEvidentiaryDigestUnguarded(bytes, sha256Hex); } catch (e) {
    return { determined: false, flavour: null, evidentiary: null,
      basis: word("odf.why.digest_taken_none", { name: errorName(e), message: String((e instanceof Error ? e.message : null) ?? "no message") }) };
  }
}

/**
 * @param {unknown} bytes
 * @param {Sha256Hex} sha256Hex
 * @returns {Promise<EvidentiaryDigest>}
 */
async function odfEvidentiaryDigestUnguarded(bytes, sha256Hex) {
  const b = asBytes(bytes) ?? new Uint8Array(0);
  /** @param {string | null} flavour @param {string} basis @returns {EvidentiaryDigest} */
  const no = (flavour, basis) => ({ determined: false, flavour, evidentiary: null, basis });
  /* CERTAIN detection only — the mimetype member read first, stored,
     CRC-verified, compared exactly, and the main part present. A content type
     or a 1 KiB head is "likely", and "likely" never asserts sameness. */
  const row = [ODT_ROW, ODS_ROW, ODP_ROW].find((r) => detectOdf(r, b, null)?.confidence === "certain") ?? null;
  if (!row) return no(null, localize("odf-reader.odf.the_bytes_are_not_an", "the bytes are not an OpenDocument package detected with certainty, so no container digest was taken"));
  const flavour = row.flavour;
  const measured = MEASURED_BY_FLAVOUR.get(flavour);
  if (!measured)
    return no(flavour, ODF_EVIDENTIARY_UNMEASURED[flavour]
      || localize("odf-reader.odf.no_flavour_export_has_been", "no .{flavour} export has been measured for content.xml stability, so no evidentiary digest is claimed", { flavour: String(flavour) }));
  const container = readContainer(b);
  if (!container.ok) return no(flavour, localize("odf-reader.odf.the_packages_central_directory_could", "the package's central directory could not be read ({why})", { why: String(container.why) }));
  const declared = declaredTextBytes(container, (/** @type {string} */ n) => n === CONTENT_PART);
  const guard = sizeGuard(declared.total);
  if (!guard.ok) return no(flavour, localize("odf-reader.odf.content_xml_is_over_the", "content.xml is over the declared-uncompressed text bound ({v1}), so it was not inflated and no digest was taken", { v1: String(guard.why || "size_guard") }));
  const read = await readPart(b, container, CONTENT_PART);
  if (!read.ok) return no(flavour, localize("odf-reader.odf.content_xml_could_not_be", "content.xml could not be read whole ({why})", { why: String(read.why) }));
  /* STRICT UTF-8 for every flavour, before anything is read out of it: a
     lossy decode could hide an href behind a replacement character, and a
     digest of bytes that are not the text they claim to be speaks for
     nothing (R37). */
  let xml = "";
  try { xml = UTF8_STRICT.decode(read.bytes); } catch {
    return no(flavour, localize("odf-reader.odf.content_xml_is_not_valid", "content.xml is not valid UTF-8, so it was not decoded lossily and no digest was taken"));
  }
  const refs = referencedMembers(xml, container);
  if (refs.length)
    return no(flavour, localize("odf-reader.odf.content_xml_references_length_package", "content.xml references {length} package member(s) whose bytes it does not hold ({refs}{v1}); a digest of content.xml cannot speak for them, so none is claimed", { length: String(refs.length), refs: String(refs.slice(0, 3).join(", ")), v1: String(refs.length > 3 ? ", …" : "") }));
  const norm = ODF_EVIDENTIARY_NORMALISE[flavour];
  const digested = norm ? norm.apply(read.bytes) : read.bytes;
  if (!digested) return no(flavour, localize("odf-reader.odf.content_xml_is_not_valid_2", "content.xml is not valid UTF-8, so the normalisation was not applied and no digest was taken"));
  return {
    determined: true, flavour, over: CONTENT_PART,
    evidentiary: await sha256Hex(digested),
    basis: localize("odf-reader.odf.the_sha256_of_the_flavour", "the sha256 of the .{flavour} package's content.xml member (inflated, length and CRC-32 verified){v1}, odf-evidentiary v{ODF_EVIDENTIARY_VERSION}; the ZIP envelope, meta.xml, settings.xml, styles.xml, thumbnails and embedded font faces are discounted; measured: {v2}", { flavour: String(flavour), v1: String(norm ? `, normalised by ${norm.name}` : ", no byte rewritten"), ODF_EVIDENTIARY_VERSION: String(ODF_EVIDENTIARY_VERSION), v2: String(measured) }),
  };
}
