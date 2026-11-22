Length: 166 lines. Last section: "Suggestions".

# odf-reader: requirements

Next number: 57

## Public

### Purpose

Reads an OpenDocument package — `.odt`, `.ods`, `.odp` — over ONE shared container walk
(`mimetype` names the kind; `content.xml` carries the whole document) and projects it into the
same I2/DEC-5 shape the OOXML entry of the matching kind produces (`docx`→`.odt`,
`formats-xlsx`→`.ods`, `pptx`→`.odp`), so `format-registry` can treat an OpenDocument export
exactly like its Office sibling. It also computes the D-351 evidentiary digest of an
OpenDocument package's substance, for a capture (a Google Drive export) whose ZIP envelope is
not stable across fetches even when its substance is. It holds no record, writes nothing, and
makes no network call.

### Provides

**`odtEntry`, `odsEntry`, `odpEntry` → `{format, detect(bytes, contentType), parts(bytes) →
Promise<Parts>, structure(partsOrBytes) → Promise<Structure>, text(partsOrBytes) →
Promise<Text>}`** — the I7 FormatEntry shape `format-registry` registers with `registerFormat`
and calls at both the detect→structure seam and directly (`entry.parts(bytes)`). `format` is
`"odt"`, `"ods"` or `"odp"`.

- **R1** [met] `detect(bytes, null)`: with the ZIP magic, a readable central directory, a first-and- STORED `mimetype` member whose CRC-32-verified value is EXACTLY the entry's media type (never trimmed), and the flavour's conventional main part present, returns `{format, confidence:"certain", signals}`. Any of those failing, or no ZIP magic, or no central directory, returns `null`. "likely" is never returned from bytes.
- **R2** [met] `detect(null, contentType)`: returns `{format, confidence:"likely", signals}` when `contentType` equals the entry's media type exactly, else `null`.
- **R3** [met] `parts(bytes) → Promise<Parts>`: runs the shared discrimination and the container read. Fails as `{ok:false, container:<flavour>, why, signals, part?, flavourDeclared?}`: `why` is the discriminator's reason, or `not_<flavour>:<found>` for a package of a different declared flavour; `part` is the content part's name when the package's own mimetype names this flavour but its main part is missing, else `null`; `flavourDeclared` is the flavour the mimetype named when the container declared one. Succeeds as `{ok:true, format, container, contentXml, declared, guard, undetermined}`: `contentXml` is `null` under the guard or an unreadable part (name pushed to `undetermined` with why); `declared` is `content.xml`'s declared-uncompressed byte total (COFF-6's metric, summed from the central directory before inflation); `guard` is the size-guard marker or `null` under the bound; `undetermined` carries each part not read, per R28 and R29.
- **R4** [met] `detect` and `parts` never throw, on any bytes.
- **R5** [met] When `parts` (or bytes passed to `structure()`/`text()` that fail discrimination through it) has `ok:false`, `structure()` and `text()` both return `{ok:false, container:<flavour>, reason: parts.why, part: parts.part ?? null}` — for every one of the three entries, without reading `content.xml`.

**`.odt` — `odtEntry.structure` → `{ok:true, container:"odt", paragraphs, links, counts,
evidentiary, notes}`**
- **R6** [met] `paragraphs` is the count of `<text:p>`/`<text:h>` elements in `<office:text>` body order (tables included, headings counted as paragraphs), or `null` when the body could not be read (R9).
- **R7** [met] `links` carries every `<text:a xlink:href>` in the body, located to its `doc-para` reference (`docParaRef`, from `office-readers`), classified `anchor`/`deferred`/`refused` exactly as `linkWrapper` classifies an OOXML hyperlink (a bare `#fragment` is `anchor`; an absolute or scheme-less URL is `deferred`; anything else is `refused`); `counts` sums the four partitions (`anchor`, `intra`, `deferred`, `refused`).
- **R8** [met] `evidentiary.items` carries, from `<text:tracked-changes>`, one `tracked-change` item per changed region: `change` (`"insertion"`/`"deletion"`), `author`, `date` (each `null` when the file does not state it), `source` (the `doc-para` the body's mark locates it to, or `null` with `why:"change_region_unmarked_in_body"` when the body carries no mark for it), and — for a deletion — `superseded` (the deleted paragraphs' text, verbatim), or — for an insertion — `text` (read from the body between its `change-start`/`change-end` marks, or `null` when unmarked). A deleted region's own paragraphs never appear in `paragraphs`, `document`, `tables` or their numbering.
- **R9** [met] `evidentiary.items` carries one `comment` item per `<office:annotation>`, inline in the paragraph it annotates: `id`, `author`, `date`, `initials` (each `null` when the file omits it), `text`, `source` (the `doc-para`). An annotation's own text is excluded from its host paragraph's `paragraphs`/`document`/`evidentiary` text.
- **R10** [met] Over the guard, or with no readable `<office:text>` body, `paragraphs` is `null`, no link or item is derived from the body, and `notes` names which (the guard, or an unreadable/absent body); what R29 reads from `meta.xml` and the manifest is still emitted.

**`.odt` — `odtEntry.text` → `{ok:true, container:"odt", document, paragraphs, tables,
undetermined, counts:{chars, undetermined}}`; `images` is added (R30).**
- **R11** [met] `paragraphs` is `[{para, ref:"¶"+(para+1), text}]` for every body paragraph in document order (0-based `para`); `document` is the non-empty paragraphs' text, newline-joined.
- **R12** [met] `tables` is `[{table, ref, rows, cols}]`, one per `<table:table>` in the body (nesting included, numbered in the order each opens, addressed by `docTableRef` from `office-readers`), with `table:number-rows-repeated`/`number-columns-repeated` runs accumulated into `rows`/`cols`; a figure never established is `null`, never `0`. A deleted table (inside `<text:tracked-changes>`) is never counted, and counting stops there so no table after it is renumbered. `tables` is `null`, never `[]`, when the body was not read.
- **R13** [met] Over the guard, `document` and `tables` are `null`, `paragraphs` is `[]`, and `undetermined` carries the guard marker verbatim (`{text:"undetermined", why:"over_size_bound", size, bound, boundName, metric}`). With no readable body and no guard, the same shape reports `undetermined:[{reason:"main_part_unreadable", part:"content.xml", why}]`.

**`.ods` — `odsEntry.structure` → `{ok:true, container:"ods", sheets, links, counts,
evidentiary, notes}`**
- **R14** [met] `sheets` is `[{sheet, name, sheetId:null, state:"visible"|"hidden", hidden:false|"hidden"}]`, one per `<table:table>`, in document order. `sheetId` is always `null` — ODF names a table, never numbers it. A sheet is hidden when its own element's `table:display` says so, else when its style's `table:display` (in `<office:automatic-styles>`) says so, the element winning when both are given; absence means shown.
- **R15** [met] `evidentiary.items` carries one `formula` item per cell carrying `table:formula`: `source` (the `sheet-cell` reference, `sheetCellRef` from `office-readers`), `formula` (verbatim, its OpenFormula `of:` prefix kept), `value` (the cell's displayed text, or, when there is none, its raw value attribute). The formula is never collapsed into, or substituted for, the cell's displayed text.
- **R16** [met] `evidentiary.items` carries one `{kind:"hidden-rows", sheet, rows:[{min, max, visibility}], count, source:null}` and one `{kind:"hidden-cols", sheet, cols:[{min, max, visibility}], count, source:null}` item per sheet that has any: one range per `<table:table-row>` or `<table:table-column>` whose `table:visibility` is `"collapse"` or `"filter"`, `min` and `max` the first and last row or column number its repeat spans (1-based, inclusive; a repeat is one range, never expanded into numbers), `visibility` that value, `count` the number of ranges; and one `hidden-sheet` item per hidden sheet.
 
- **R17** [met] `links` carries every `<text:a>`/`<draw:a>` href found inside a cell, located to that cell's `sheet-cell` reference; a repeated cell's links are attached at each of its addresses.

**`.ods` — `odsEntry.text` → `{ok:true, container:"ods", document, sheets, undetermined,
counts:{chars, cells, formulas, undetermined}}`; `images` is added (R30).**
- **R18** [met] `sheets` is `[{sheet, name, hidden, rows:null, cols:null, usedRows, usedCols, range, text, undetermined:[]}]`. `rows`/`cols` (the sheet's capacity) are always `null` — OpenDocument fixes no maximum table size, and this is never inferred from XLSX's grid or from the used range. `usedRows`/`usedCols` are the furthest 1-based row/column carrying a cell (accumulated over the cells, so a padding run of empty repeats never counts); `range` is `usedSheetRange(name, usedRows, usedCols)` (from `office-readers`), or `null` when nothing was used.
- **R19** [met] A sheet's `text` is its non-empty rows, each row's cells tab-joined by their (T51 fix round 6, G15; K4571, K4579) `odsEntry.text()`'s every sheet also carries `lineRows`: one 1-based row number per line of the sheet's `text` (the row as a spreadsheet shows it, `table:number-rows-repeated` counted; a cell of several paragraphs or line breaks gives each of its lines that cell's row), the same length as `text.split("\n")`, and `[]` when the sheet has no text. It is the sheet's own rows, never the used range. Over the size guard or repeat bound with no readable body, `sheets` is `[]` and no sheet carries it. Computed from the bytes at each read: a stored reading made before this has none, and a consumer reads absent as unknown. displayed value (never their formula), rows newline-joined; a hidden sheet's text IS extracted, flagged only by `hidden`. `document` is the non-empty sheets' text, newline- joined. `cells` counts every cell with a non-empty value; `formulas` counts every cell carrying a formula; both are summed across all sheets.
- **R20** [met] Over the guard, `document` is `null`, `sheets` is `[]`, and `undetermined` carries the guard marker verbatim. With no readable `<office:spreadsheet>` body and no guard, the same shape reports one `undetermined` marker naming the reason, with `sheet` and `cell` both `null`.

**`.odp` — `odpEntry.structure` → `{ok:true, container:"odp", slides, links, counts,
evidentiary, notes}`**
- **R21** [met] `slides` is the count of `<draw:page>` elements in the body, or `null` when the body was not read.
- **R22** [met] `evidentiary.items` carries one `speaker-notes` item per page whose `<presentation:notes>` holds non-empty text (`slide`, `part:"content.xml"`, `text`, `source`), and one `hidden-slide` item per page whose own, or its drawing-page style's, `presentation:visibility="hidden"` says so (element wins over style; absence means shown). Speaker-notes text is never merged into a slide's own text, and never into `links`.
- **R23** [met] `links` carries every `<text:a>`/`<draw:a>` href inside a page's own shapes (excluding its notes), located to `slideShapeRef(slide, shape)` (from `office-readers`): `slide` is 1-based, `shape` is 0-based and numbers every shape-tag open in document order (nesting included), so a shape's reference and the count that bounds it come from one walk.

**`.odp` — `odpEntry.text` → `{ok:true, container:"odp", document, slides, speakerNotes,
deckLength, undetermined, counts:{chars, notesChars, undetermined}}`; `images` is added (R30).**
- **R24** [met] `slides` is `[{slide, ref:"slide "+slide, part:"content.xml", hidden, shapes, text}]`, one per `<draw:page>` in the order the bytes declare it (OpenDocument's page order IS presentation order, needing no separate slide-order index the way PPTX does). `shapes` is the same shape count R23 numbers against. `text` is the page's own shapes' text, joined; a group shape's text is its child shapes' own (never double-counted at the group level).
- **R25** [met] `speakerNotes` is `[{slide, ref:"slide "+slide+" (notes)", part:"content.xml", hidden, text}]`, only for pages with non-empty notes text. `document` (the deck as presented) never includes notes text; a hidden slide's text IS in `document`, flagged by `hidden`. `notesChars` counts speaker-notes text apart from `chars`.
- **R26** [met] `deckLength` is the number of pages once the body is read (equal to `slides.length`, emitted as its own key so a caller reads one field regardless of which entry answered), and `null` on both branches that did not read the body.
- **R27** [met] Over the guard, or with no readable `<office:presentation>` body, `document` is `null`, `slides` and `speakerNotes` are `[]`, `deckLength` is `null`, and `undetermined` carries the guard marker verbatim, or (with no guard) a single `{reason:"main_part_unreadable", part:"content.xml", why}` marker — the same shape R13 states for `.odt`.

**Shared envelope facts, across all three `structure()`s and `text()`s:**
- **R28** [met] Every successful `structure()` call states, in `evidentiary.undetermined`, each part of the package it did not read, as `{part, why, detail?}`: under R29, `meta.xml` absent (`why:"part_absent"`) or unreadable (its `why`), and the manifest unreadable (its `why`).
- **R29** [met] narrows R28: when `meta.xml` is present, `structure()` reads it and emits one `core-properties` item (creator, title, created/ modified, revision — each `null` when the file omits it); a package without `meta.xml` still states the absence. When the manifest is present, `structure()` walks it and content-addresses each embedded member it lists into a `sha256`- keyed `intra` link; a package with no manifest, or none of whose listed members embed anything, still states why `intra` is empty. An embedded member is a manifest entry that is neither one of the package's own parts, nor under `Pictures/` (R30), nor a font referenced by `svg:font-face-uri`; one absent, encrypted or unreadable becomes an undetermined link naming its why.
- **R30** [met] `text()`'s output always carries `images`: the package's `Pictures/` directory, content-addressed exhaustively (`images`), or `images:null` with `imagesWhy` when it could not be — read off the central directory alone, so this is independent of the manifest.
- **R31** [met] `ODT_CONTENT_TYPE`, `ODS_CONTENT_TYPE`, `ODP_CONTENT_TYPE` are the three exact OpenDocument media types, read off the same `partMap:"odf"` rows `detect`/`parts` use, never a separate literal. `ODF_FORMATS` is `["odt","ods","odp"]`, the three flavour strings, read off the same rows and frozen.

**`odfEvidentiaryDigest(bytes, sha256Hex) → Promise<{determined:true, flavour, over:"content.xml",
evidentiary, basis} | {determined:false, flavour, evidentiary:null, basis}>`**
- **R32** [met] Detects with R1's CERTAIN branch only (a content-type-only "likely" match never qualifies); with no flavour detected certainly, returns `{determined:false, flavour:null, basis}` naming why.
- **R33** [met] A flavour with no entry in the measured-stable table — today `.odp` only, since no census target has been measured for it, while `.odt` and `.ods` are both measured — returns `{determined:false, flavour, basis}` naming that, without reading the container further.
- **R34** [met] Refuses (`determined:false`, `flavour` set, `basis` naming the specific reason) when the central directory cannot be read, when `content.xml`'s declared uncompressed size is over COFF-6's bound (not inflated), or when `content.xml` cannot be read whole (length and CRC-32 verified against the central directory).
- **R35** [met] Refuses (`determined:false`) when `content.xml` references, by any `href`-bearing attribute in any namespace, a package member whose bytes are not `content.xml` (naming up to 3 of them, with the total count) — a digest of `content.xml` alone cannot speak for a member it does not hold, so none is claimed.
- **R36** [met] narrows R35: an `href` on an element whose local name is `font-face-uri` does not count as a referenced member. A `Pictures/`- or `Object N/`-referencing `href` still refuses under R35 unchanged.
- **R37** [met] The digested bytes are, for `.odt`, `content.xml` with every `<text:list xml:id="...">` relabelled `L1`, `L2`, … in document order and every `text:continue-list` naming a relabelled id rewritten to match (`odtNormalisedContentXml`, exported so a measurement instrument digests exactly what this digests); for `.ods`, `content.xml` unchanged. Refuses (`determined:false`) when `content.xml` is not valid UTF-8 (never decoded lossily). `evidentiary` is `sha256Hex` of the (possibly normalised) bytes; `basis` names the part, the normalisation applied or that none was, `ODF_EVIDENTIARY_VERSION`, the discounted members (ZIP envelope, `meta.xml`, `settings.xml`, `styles.xml`, thumbnails) and the measurement the claim rests on.
- **R38** [met] Every service above never throws on malformed, truncated or hostile bytes; every failure — `detect`, `parts`, `structure`, `text`, `odfEvidentiaryDigest` alike — is a stated result naming why, never an exception the caller must catch.

- **R44** [met] (N27, D-415; K278) `odsEntry.text()` also carries `rangeUnits: [{source: "named-range" | "database-range", name, scope, hidden: false, unit}]`, one per `<table:named-range>` (document-scoped, `scope: null`; or inside a `<table:table>`, `scope` that sheet's name) and `<table:database-range>` (`scope` its sheet) whose address names one rectangle on one sheet of this document, `unit` its `sheet-range` reference from `office-readers`' `rangeUnitFor` (grid `null`, R42); and `rangeUnitsSkipped: [{source, name, ref, why}]` for every other, and for every `<table:named-expression>` (`source: "named-expression"`, `why: "not_a_range_reference"`). `why` is one of `multi_area`, `broken_reference`, `not_a_range_reference`, `whole_row_or_column`, `external_workbook`, `multi_sheet_reference`, `no_such_sheet`, `empty_reference` (`office-readers` R9's vocabulary). `hidden` is `false`: ODF has no hidden flag on a name. Over the guard, or with no readable `<office:spreadsheet>` body, both are `null`, never `[]`: an `.ods` declares its names only in `content.xml`, which was not read (R41).
- **R45** [met] (N30) Repeats are expanded within a bound: `ODF_REPEAT_EXPANSION_MAX` (262,144, exported) units per `content.xml` read, a unit being one cell given at one address (a carrying cell's `table:number-columns-repeated` and its row's `table:number-rows-repeated` multiplied, R15–R19; a link attached at a repeated address rides on its cell, R17), one hidden row range listed (R16), or one space a `<text:s text:c>` stands for (R11, R19, R24); a link a cell carries costs one unit at each repeated address after its first, where it is literal markup (R17). What a repeat copies is bounded too: a repeated cell's displayed text, at each address after its first, counts its characters against `MEASURED_OOXML_TEXT_BOUND_BYTES` (20,971,520), so repeats yield no more text than that bound admits written out (K428). An empty run advanced over, and every figure that only accumulates (R12's `rows`/`cols`, R18's used extent), costs none. (Fix round 9, G124: the repeat bound and the text bound are `READ_BOUNDS` rows taken through `boundOf`, with no numeric literal here.) The reader never expands past the bound: the read that would cross it stops, and the entry answers as over the size guard (R10, R13, R20, R27 for `text()`, R10's shape for each `structure()`), with the marker `{text: "undetermined", why: "over_repeat_bound", units, bound, boundName: "ODF_REPEAT_EXPANSION_MAX", metric: "expanded_repeat_units"}` (or, past the text bound, `units` the characters reached, `bound` 20,971,520, `boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES"`, `metric: "repeated_text_chars"`) in place of the guard's, `units` the count reached when it stopped (one past the bound). What R28–R30 read from outside `content.xml` is still answered, and `odfEvidentiaryDigest` (R32–R37), which expands nothing, is unaffected. It never ends in `reader_failed` for a repeat's size (R38).
- **R46** [met] (C:A-4; K1448) `odsEntry.text()` gives each sheet a `cells` list in `office-readers` R30's contract, field for field: `[{source, value, type, declared, cached, formula}]`, one per cell holding a value or a formula (a repeated cell once at each address it is given, within R45's bound), in row then column order. `value` is the cell's value attribute exactly as written (`office:value`, `office:date-value`, `office:time-value`, `office:boolean-value`, `office:string-value`), or its text when it has none, never re-rendered through a binary float. `declared` is its `office:value-type` as written; `type` maps it: `float`, `percentage` and `currency` to `number`, `date` to `date`, `time` to `time`, `boolean` to `boolean`, `string` to `text`, and a cell with no value type and a text to `text` (`office-readers` R30's set). For a cell carrying `table:formula`, `formula` is the formula verbatim (R15) and `cached` its value attribute as written (`null` when it carries none); otherwise both are `null`. Nothing is recalculated. Over the guard, or over R45's bound, `cells` is `null`, never `[]`; past `opts.inlineCellsMax` it is `null` with `cells_held: true` (R49).
- **R47** [met] (K1888, K1903; moved from Private to Provides T47, N942, its wording unchanged) `structure()` and `text()` both carry `active`, the same list from one builder: every part of the file that can act when it is opened, found and read, never run, in the shape of office-readers R32. One item per finding, in central-directory order: `{kind:"odf-basic", part}` for each member under a `Basic/` directory (a Basic library) and `{kind:"odf-basic", part, event}` for each `script:event-listener` in `content.xml` or `styles.xml` (`event` its `script:event-name`); `{kind:"embedded-file", part}` for each member under an `Object …/` sub-document directory or a `ObjectReplacements/` part's source; `{kind:"odf-script", part}` for each member under the package root's `Scripts/` (embedded Python, BeanShell or JavaScript macros; K1917); `{kind:"launch", part, event}` for each `presentation:event-listener` whose `presentation:action` is `execute`; `{kind:"unread", part, why}` for a part it could not read for this list. A file with none answers `[]`.

- **R48** [met] (fix round 4b, F7; K4489, K4504; fix round 9, G133a, K4831 (3)) **Large content is stated, not read.** The bound stays 20 MiB (`MEASURED_OOXML_TEXT_BOUND_BYTES`; the job does not raise it, and a figure change is BOB's to report to Bob, K1881); a `content.xml` up to it is read in windows (R49). A `content.xml` over the bound is not read and is stated with its size: `parts().guard`, R10, R13, R20 and R27's marker and the envelope's `guard` carry `sizeGuard`'s marker plus `final: true`; R45 and R34 unchanged. Test: `large.test.mjs`.

- **R49** [met] (fix round 9, G133a; S-2, S-1 for ODS; K4831 (3)) **Held cells and windows.** `odsEntry.text(partsOrBytes, opts)` gives the held-cells contract of csv-reader R17 and R18: with `opts.inlineCellsMax` (bytes) a sheet lists `cells` only while the JSON of all its sheets' cells is within it; past it every sheet has `cells: null` and `cells_held: true`, and its `text`, `lineRows`, `usedRows`, `usedCols`, `range` and counts are those of the whole read. Without the option every cell is listed. The optional slot `cellsIn(partsOrBytes, {sheet, fromRow, toRow, fromCol, toCol, maxCells})` answers `{ok:true, cells, rows:{from,to}, next_row?}`, the typed cells (R46's shape) of exactly those rows and columns in row then column order, identical to the whole read's, and `{ok:false, why}` (`no_such_sheet`, `bad_range`, or the guard's marker) otherwise; it never throws. `content.xml` is read as a stream of rows in windows with a carry, so a `content.xml` within the bound of R48 (20,400,000 bytes, 172,302 cells) is read whole in the object's heap and its peak is bounded by the window and the held text, not by the file. `text(partsOrBytes, {yieldNow})` awaits `yieldNow()` between windows when it is a function; the answer is the same without it.
- **R50** [met] (fix round 9, G133b; S-18) A `<table:covered-table-cell>` is iterated as a cell of its address: a cell to the right of a merge keeps its own column (a value at C1 is C1, not B1) in `cells`, in the row's `text` and in every `sheet-cell` reference; the covered cell itself holds no value.
- **R51** [met] (fix round 9, G133c; X12) A numeric character reference that names no Unicode scalar value (above U+10FFFF, a surrogate, U+0000, digits that do not parse) in any part never makes a read throw (R38): the part is stated unreadable (`{part, why:"char_ref_invalid", final:true}`), the same on every call, and the rest is read.
- **R52** [met] (fix round 9, G133d; X6) Reading a part costs work linear in its size, as office-readers R42 states for the OOXML parts: `counts.scanned_bytes` at most 4 times the part's bytes for any shape (an unterminated `<a `, deeply repeated markup), a tag longer than 64 KiB stated as text with `tag_over_bound`, and a `yieldNow` awaited at least every 65,536 tokens.
- **R53** [met] (fix round 9, G134a, G134b, G134d; X11, S-19; K4831 (7)) **Every part of a document is a unit with its kind.** The three `text()` answers carry `parts: [{kind, ref, part, text, hidden?}]` as office-readers R38 states (the same closed list of kinds, `part` always `content.xml` or the package part it came from): ODT footnotes, endnotes, headers, footers, annotations (`comment`), tracked deletions and text boxes; ODP speaker notes, master-page text and text boxes (a hidden page's text marked `hidden: true`); ODS cell annotations (`cell_note`, `ref` the cell's `sheet-cell`). A footnote's or an annotation's text is its own unit and is never fused onto its host paragraph or into a cell's displayed value (a cell with a note shows `5`, not `note text\n5`); R9's exclusion from `paragraphs` and `document` stays. **Amended (fix round 9, G166; K4987):** a text box's words (`draw:text-box`) are a piece of kind `text_box` only: the part names the paragraphs it holds (`paras`, their indices in the body's paragraphs), and those are not also body text, as office-readers R38 states for DOCX. Test: an ODT whose body holds a text box answers its words once, as `text_box`; control: a paragraph outside a box stays body.
- **R54** [met] (fix round 9, G131g; X9) `content.xml`, `meta.xml`, `styles.xml` and the manifest are decoded to text through ooxml's `decodeText` (its R36), so a UTF-16 part is read and a part in a declared legacy charset is not decoded as UTF-8; a part decoded with more than 0.5 % replacement characters is stated `partial` with the count. R37's digest is the exception: it stays over UTF-8 bytes and refuses anything else.
- **R55** [met] (fix round 9, G126d) `isOdfTextPart(name) -> boolean`, exported: true exactly for the package parts this module inflates for text (`content.xml`, and `styles.xml` and `meta.xml` where R54 decodes them), so a caller sums `ooxml.declaredTextBytes(container, isOdfTextPart)` for an ODF container without holding a second list. Never throws.
- **R56** [met] (fix round 9, G184; K5011; S-18, S-19) **ODS cells are typed and placed as the file states.** `office:value-type` decides a cell's type (`calcext:value-type` only where the office type is absent), so an error cell keeps its type; `table:covered-table-cell` is iterated, so no cell right of a merge shifts left; a typed-empty cell repeated to the sheet's edge is one empty run, never refused after 16 rows; every `over_repeat_bound` marker carries `final`; the repeat meter counts per sheet. Test: each case.

## Private

### Uses

- `runtime-limits`: `boundOf` and `statement` (its R29-R31), for R45's and R48's figures, with no numeric literal for a ceiling kept here (K4835 (1)).
- `test-support`: `sheetgen`, `docgen`, `zipChunks64` and their truth (its R19, R21-R24), for the tests at the platform's shape (K4835 (6)).
- `ooxml`: `decodeText` (its R36) for R54 and `streamMember` for the identity of a member, and `hasZipMagic`, `readContainer`, `readPart`, `normalizePartName`, `crc32`,
  `discriminate`, `sizeGuard` (and its `MEASURED_OOXML_TEXT_BOUND_BYTES` default),
  `declaredTextBytes`, `CONTAINER_FLAVOURS` (filtered to `partMap:"odf"` rows),
  `ODF_MIMETYPE_PART`, `ODF_MANIFEST_PART`, `ODF_MIMETYPE_MAX_BYTES`, `withContainerImages`,
  `IMAGE_MIME_BY_EXT`.
- `subresources`: `linkWrapper`, for the `anchor`/`deferred`/`refused` link partition.
- `office-readers`: `docParaRef`, `docTableRef` (`docx.mjs`); `sheetCellRef`, `usedSheetRange`
  (`formats-xlsx.mjs`); `a1Corner`, `rangeUnitFor` (`formats-xlsx.mjs`, R44; N27); `slideShapeRef` (`pptx.mjs`) — the one reference builder per IC-1 arm,
  never re-derived here.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R39** [met] Pure: no store, no network, no clock. The same bytes always give the same answer.
- **R40** [met] No place, system, form or vocabulary is named in this module; it carries no jurisdiction-specific fact of any kind.
- **R41** [met] Every "not read" is stated with which part and why; absence is never emitted as a zero, an empty list or a silent omission a caller could read as "none present" (R9's `null` guard branches, R28's markers, R33–R35's named refusals, R45's `over_repeat_bound`).
- **R42** [met] A `.ods` cell's capacity (`rows`/`cols` in R18) is always `null`: OpenDocument fixes no maximum table size, so this module never borrows XLSX's grid and never infers a bound from the used range.
- **R43** [met] This module owns no entry in `bio-plane/checks/bio-checks.mjs` (grepped: no function or refusal code in that file names `odf.mjs` or belongs to it). The IC-1 reference builders it calls are owned by `office-readers`; the C-45.x checks that validate a citation against them are owned by `content`.

### Satisfies

- `BIO_Content_Framework_v0_10.md` §16, "How content is extracted today" — the shared
  container-reader/entry pattern and, by DEC-5 (quoted there: "Bob ruled these public
  documents' revision history IS evidence"), the evidentiary envelope: formulas beside cached
  values, tracked changes with author and date, comments, speaker notes, hidden rows, columns,
  sheets and slides, and the file's core properties. §16 itself records that ODF was
  "deliberately not built" until CAP-8/COFF-10's 2026-09-14 ruling made a Google Drive export
  ODF's harvest format (this module's own header comment carries that ruling in full).
- K4831 (3) and (7) (fix round 9): the alpha keeps the 20 MiB guard, stated with the file's size and the limit, and an ODS within it is read through held cells and windows; every part of a document read and searchable, each result marked with its kind (R49-R55).
- `BIO_Content_Framework_v0_10.md` §5, "A document's anatomy: regions and digests" — the
  evidentiary digest (`odfEvidentiaryDigest`) sits BESIDE the capture identity digest, never
  replacing it.
- `docs/development/OFFICE-FORMATS.md`, "What each part-map offers, and where it maps onto I2"
  and "Bounds and the size guard" — the shared part-map table and the COFF-6 text-bound metric
  this module reads through `ooxml`, never restates.
- `docs/development/DOCUMENT-PROFILES.md`, "Three digests, not one" and "The failure asymmetry,
  which governs every default" — why `odfEvidentiaryDigest` exists and why it refuses on a
  member reference it cannot speak for (R35).
- `build/layers.md`, "No jurisdiction in the product".

### Suggestions

- The caller of `structure()`/`text()`/`odfEvidentiaryDigest` should pass only bytes it has
  itself fetched and can already trust the identity of; this module verifies the ZIP structure
  and the parts it reads, never a claimed capture identity — `odfEvidentiaryDigest`'s own
  caller (`index.mjs`'s `substanceDigests`, D-351) still re-hashes the container bytes against
  the capture's own `sha` before trusting `determined:true`, and that check belongs to the
  caller, not here.
- R29 and R36 (D-346, D-612) are already coded on the unlanded `snapshot/pre-refactor-2026-09-25`
  tree at tips `96eeb2d5` and `f2dcbc6c`; read that code first and keep what meets the
  requirement rather than re-deriving it (PROCESS-MECHANICS §12.5).
- `ODT_ROW`/`ODS_ROW`/`ODP_ROW` and `odfRow()` are exported but have no caller outside this
  file today (grepped); they are implementation surface, not a requirement, and may be
  un-exported without notice to any user.
