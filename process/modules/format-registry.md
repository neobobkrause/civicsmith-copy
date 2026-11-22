Length: 102 lines. Last section: "Suggestions".

# format-registry: requirements

Next number: 33

## Public

### Purpose

The one place a document format is known. It holds a registry of format entries — one per format,
keyed by name — and answers, from bytes and/or a declared content type, which format a document is
(magic bytes always outrank a declared type), and which entry to dispatch to for that format's
container walk, structure and text extraction. It reads no record, writes nothing, and makes no
network call itself; a registered entry's own functions may do work when a caller invokes them, on
that entry's own account.

### Provides

**registerFormat(entry) → entry**
- **R1** [met] `entry.format` must be a non-empty string; otherwise throws `Error("a format entry must name its format")`. This also fires when `entry` itself is null, undefined, or not an object.
- **R2** [met] `entry.detect` must be a function; otherwise throws `Error('format "<format>": detect(bytes, contentType) is required')`.
- **R3** [met] Each of `entry.parts`, `entry.structure`, `entry.text` is optional: absent, `null` or `undefined` is accepted; present and not a function throws `Error('format "<format>": <slot> must be a function or null')`.
- **R4** [met] A second registration under a format already held throws `Error('format "<format>" is already registered; unregister it first')`; the existing entry is left in place.
- **R5** [met] Otherwise the entry is stored under `entry.format` and returned unchanged (not cloned, no default filled in for an absent slot), and is reachable from `getFormat`/`detectFormat` from that point on.

**unregisterFormat(format) → entry | null**
- **R6** [met] Removes the entry stored under `format` and returns it; returns `null`, and changes nothing, when no entry is stored under `format`. Never throws.

**getFormat(format) → entry | null**
- **R7** [met] Returns the entry stored under `format`, exactly as `registerFormat` received it, or `null` when none is stored. Never throws.

**listFormats() → string[]**
- **R8** [met] Returns every currently-registered format key, in the order the entries were registered (a format re-registered after being unregistered moves to the end of this order). Never throws.

**detectFormat(bytes, contentType) → { format, confidence, signals, ... }**
- **R9** [met] `bytes` counts as provided only when it is a `Uint8Array` with `length > 0`; anything else (absent, `null`, empty, or not a `Uint8Array`) counts as not provided. `contentType` counts as provided only when it is a non-empty string; anything else counts as not provided. (Fix round 9) `detectFormat(bytes, contentType, name)` takes the document's name as an optional third argument, provided only when it is a non-empty string (R31).
- **R10** [met] Pass 1 (bytes only): when bytes are provided, calls `entry.detect(bytes, null)` on every registered entry in registration order, and returns the first result that is truthy and carries a `.format` — verbatim, with whatever other keys that entry attached.
- **R11** [met] Pass 2 (content type only): runs only when pass 1 produced no hit (bytes not provided, or every entry answered nothing on bytes) and `contentType` is provided. Calls `entry.detect(null, contentType)` on every registered entry in registration order, and returns the first result that is truthy and carries a `.format`, verbatim.
- **R12** [met] When neither pass produces a hit, returns `{ format: "undetermined", confidence: "none", signals: [bytesReason, contentTypeReason] }`, where `bytesReason` is `"no registered magic-byte signature matched"` when bytes were provided else `"no bytes were available to sniff"`, and `contentTypeReason` is `` `content type "<contentType>" matched no registered format` `` when a content type was provided else `"no content type was declared"`.
- **R13** [met] A format is never guessed: the only three answers are a registered entry's own verbatim `detect()` result, the name pass's answer (R31, which is csv-reader's `isDelimitedText` made a result), or the stated `undetermined` of R12. `detectFormat` itself does not catch an error a registered entry's `detect` throws; it propagates to the caller.

**readingDialect(emitted) → { delimiter, encoding, confidence, signals, undetermined } | null**
- **R14** [met] Returns `null` when `emitted` is not a non-array object (covers `null`, `undefined`, a primitive, or an array).
- **R15** [met] Otherwise returns a projection built only from named keys of `emitted`, never `emitted` itself: `delimiter` is `emitted.delimiter` when it is a non-empty string, else `null`; `encoding` is `emitted.encoding` under the same rule. `confidence` is `{ delimiter, encoding }`, each `emitted.delimiterConfidence` / `emitted.encodingConfidence` when a non-empty string, else `null`. `signals` is `{ delimiter, encoding }`, each `emitted.delimiterSignals` / `emitted.encodingSignals` filtered to its string elements when an array, else `[]`. `undetermined` is `emitted.undetermined` filtered to its string elements when an array, else `[]`. (Fix round 9, G131c, G131g; K4628 reversed) `assumed` is `emitted.assumed` when it is a boolean, else `null` (the document's page shows an assumed encoding), and `disagree` is `emitted.disagree` filtered to its finite numbers when an array, else `[]` (the offsets of the windows whose encoding or delimiter differs from the file's).
- **R16** [met] Never throws. A key `readingDialect` does not name (anything else `emitted` carries) is dropped, so a later key an entry adds is not projected by accident.

**The built-in `html` entry**, registered under `"html"`:
- **R17** [met] `detect(bytes, contentType)`: when `bytes` is truthy, decodes its first 1024 bytes (through ooxml's `decodeText`, its R36: UTF-8, or UTF-16 by its BOM, else Latin-1) and lower-cases them, and returns `{ format: "html", confidence: "certain", signals: [...] }` when the decoded head, after a BOM, white space and any leading comments or XML declaration, BEGINS with `"<!doctype html"` or `"<html"`; otherwise returns `null`. A plain text that merely mentions `<html>` or `<!doctype html>` (a note, an e-mail, a code sample) is not HTML and is not read as HTML (G141; X27). `contentType` is not consulted while `bytes` is truthy.
- **R18** [met] When `bytes` is falsy: returns `{ format: "html", confidence: "likely", signals: [...] }` when `contentType` is exactly `"text/html"` or `"application/xhtml+xml"` (case-sensitive, exact match only); otherwise `null`.
- **R19** [met] `parts`, `structure` and `text` are all `null`: HTML's structure is produced at acquire time by the subresource walk, outside this module's reach — this entry answers detection only.

**The built-in `pdf` entry**, registered under `"pdf"`:
- **R20** [met] `detect(bytes, contentType)`: when `bytes` is truthy, decodes its first 1024 bytes as latin1 (no case change) and returns `{ format: "pdf", confidence: "certain", signals: [...] }` when it includes the literal `"%PDF-"` and its first four bytes are not the ZIP local-file magic `PK\x03\x04` (fix round 9, K4900: a ZIP archive whose first member is a PDF stored uncompressed is the ZIP of R25, never a PDF, whole or through a range source, R32); otherwise `null`. `contentType` is not consulted while `bytes` is truthy.
- **R21** [met] When `bytes` is falsy: returns `{ format: "pdf", confidence: "likely", signals: [...] }` when `contentType` is exactly `"application/pdf"`; otherwise `null`.
- **R22** [met] `parts` and `text` are `null` (a PDF is its own container, and its Tier-1 text rides `structure()`'s own output object). `structure(bytes)` delegates to `pdf-reader`'s `extractPdfStructure(bytes)` and returns its result unchanged.

**The built-in roster**
- **R23** [met] At module load, before any other caller registers or unregisters anything, the registry holds exactly twelve entries, added in this order (fix round 9, G130a; S14: pictures are asked before the web page and the PDF, so a JPEG that carries `%PDF-1.4` in a comment segment or `<html` in its EXIF is a picture): `jpeg`, `png` (defined in this module — R29, R30; T43, N853b, K2691), `html`, `pdf` (both defined in this module — R17-R22), `docx`, `xlsx`, `pptx` (from `office-readers`), `odt`, `ods`, `odp` (from `odf-reader`), `csv` (from `csv-reader`), `zip` (defined in this module — R28). `listFormats()` returns them in that order until a later `registerFormat`/`unregisterFormat` call changes it.

**The built-in `zip` entry**, registered under `"zip"` (N688; K1844, K1852):
- **R28** [met] `detect(bytes, contentType)`: when `bytes` is truthy, returns `{ format: "zip", confidence: "likely", signals: [...] }` exactly when `ooxml.discriminate(bytes)` (its default table) would answer `{ok:true, format:"zip"}`: the bytes carry the ZIP magic (`ooxml` R1), `ooxml.readContainer` reads their central directory (its R3), and that directory names neither `[Content_Types].xml` nor a `mimetype` member; otherwise `null`. It answers synchronously, from the central directory alone, never inflating a part. An office or OpenDocument file therefore never detects as `zip`, and `zip` is registered last (R23), so the office and ODF entries are asked first in each pass. When `bytes` is falsy: `{ format: "zip", confidence: "likely", signals: [...] }` when `contentType` is exactly `"application/zip"` or `"application/x-zip-compressed"`, else `null`. `parts(bytes)` is `ooxml.listArchive(bytes)` and returns its result unchanged (`ooxml` R27–R28); `structure` and `text` are `null`: an archive's members are read as captures of their own, never through this entry.

**The built-in picture entries** (T43; N853b; K2611, K2691):
- **R29** [met] The built-in `jpeg` entry: `detect` answers `{format: "jpeg", confidence: "certain", signals}` when the bytes begin `FF D8 FF`; with no bytes, `likely` for a content type of exactly `image/jpeg`; otherwise `null`. `structure(bytes)` answers `{ok: true, pages: 1, text: {document: "", pages: [{page: 0, text: "", undetermined: [m]}], undetermined: [m], counts: {chars: 0, undetermined: 1}}}`, where `m` is `{page: 0, reason: "no_text_layer", font: null, codes: "", count: 0}`, and answers `{ok: false, container: "jpeg", reason: "NOT_A_JPEG"}` for bytes without the signature. It decodes nothing; `parts` and `text` are `null`.
- **R30** [met] The built-in `png` entry, as R29: the signature `89 50 4E 47 0D 0A 1A 0A`, the content type `image/png`, and `NOT_A_PNG`.

**The name pass and detection from a range source (fix round 9, G130b, G130c; S-10, X5; rA G6)**
- **R31** [met] Pass 3 (name and head): runs only when passes 1 and 2 produced no hit, bytes are provided and `name` is provided. It calls csv-reader's `isDelimitedText(name, contentType, head)` (its R21), `head` the first bytes of `bytes` (up to 1 MiB), and when that is true returns `{ format: "csv", confidence: "likely", signals: [...] }`; otherwise R12's `undetermined`. So a CSV declared `application/vnd.ms-excel`, `application/octet-stream` or `text/plain` with a name ending `.csv`, `.tsv`, `.tab` or `.txt` is read as a sheet when its head holds the shape csv-reader requires of that name (for declared plain text, at least five records: csv-reader R27), and a binary format already claimed by pass 1 is never overridden by it (R26).
- **R32** [met] `detectFormat` also accepts, in place of `bytes`, a source `{size, readRange(offset, length) -> Promise<Uint8Array>}` and then answers a Promise: it judges signatures from the head and a container (the ZIP family and the office and ODF entries) from the end record and the central directory read through `readRange`, never from a 1 KiB prefix alone, and its answer is the same as for the same bytes given whole. An office file above 8 MiB is therefore `docx`, `xlsx` or `pptx`, not `undetermined`.

## Private

### Uses

- `office-readers`: `docxEntry` (`docx.mjs`), `xlsxEntry` (`formats-xlsx.mjs`), `pptxEntry` (`pptx.mjs`) — three ready-made format-entry objects (`format`, `detect`, and each's own `parts`/`structure`/`text`), registered here unmodified.
- `csv-reader` (fix round 9, rA G6; the edge is new: `format-registry` is order 19, `csv-reader` order 15, so the other way would be a lower module using a higher one, P4): `csvEntry`, registered here unmodified (`format`, `detect`, `parts`/`structure`/`text`, `dialect`), and `isDelimitedText` (its R21), which R31 calls. Their own detection, container-walk, structure and text behaviour is that module's requirement, not this one's.
- `odf-reader`: `odtEntry`, `odsEntry`, `odpEntry` (`odf.mjs`) — three more ready-made entry objects, registered here unmodified, same division of responsibility.
- `pdf-reader`: `extractPdfStructure(bytes)` (`pdfstructure.mjs`) — the function the built-in `pdf` entry's `structure` slot delegates to (R22); its own behaviour is `pdf-reader`'s requirement.
- `ooxml`: `hasZipMagic`, `readContainer` and `listArchive` (T35-11; the edge added at T35's opening, rule 8) — what the built-in `zip` entry's `detect` and `parts` are built on (R28); the listing's behaviour is `ooxml`'s requirement. Fix round 9: `decodeText` (its R36) for R17's head, and `discriminate` over a range source (its R11) for R32.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R24** [met] One entry per format key: `REGISTRY` never holds two entries for the same key at once (R4); it is a plain in-memory `Map`, so registration order is preserved and is what `listFormats()` (R8) and each `detectFormat` pass (R10, R11) iterate in.
- **R25** [met] The only state this module holds is that `Map`. `registerFormat` and `unregisterFormat` are its only mutators; nothing here reads a store, calls the network, or reads the clock (a source's `readRange`, R32, is the caller's), so `detectFormat`'s answer for one registry state and one pair of inputs never changes between calls. (An entry's own `parts`/`structure`/`text`/`dialect` may do work when a caller invokes it directly — that is on the entry's own module, not this one.)
- **R26** [met] Bytes always outrank a declared content type, structurally: `detectFormat` never starts pass 2 (contentType) before every entry has had its chance in pass 1 (bytes), regardless of how any individual entry is written (R10, R11).
- **R27** [met] An unmatched input is always a stated `undetermined` carrying why in `signals` (R12); `getFormat` and `unregisterFormat` answer `null` for an unknown key rather than throwing (R6, R7). Nothing in this module reports absence as a guess.

### Satisfies

- `BIO_Content_Framework_v0_10.md` §4, "One extension shape: the RECOGNISER" and "The axes we know about" — the FORMAT axis, and the claim that a new axis of variation costs a registry entry, not a rewrite.
- `docs/development/OFFICE-FORMATS.md`, "the format axis as ruled" — this module is what that document calls I7, the registry entry shape, and the place the ten built-in entries are registered.
- `docs/architecture/BIO_Intake_Doctrine_v1_1.md` §3, "Members of a captured archive" (K1852): an archive is recognised here (R28) so that it can be opened on capture; the members are cut by `acquisition` (N688, K1844).

- K4831 (3) and K4837 (fix round 9, G130, G141): detection from the head and the tail, pictures before the page and the PDF, the name pass for a sheet, a text that mentions HTML read as text (R17, R23, R31, R32).

### Suggestions

- The module's own header comment frames two dispatch-site doctrines that bind CALLERS, not this module's interface: no format-specific branching outside this registry at either the acquire-time detection site or the read-time structure site, and an entry asserts nothing about meaning and writes nothing. Both are properties of how `index.mjs`/`capture`/`extraction` use `detectFormat`/`getFormat`, and of how `office-readers`/`odf-reader`/`pdf-reader` write their entries — testable in those modules, not by calling this one in isolation.
- R28's bytes rule should be tested as an equivalence: over `test-support`'s fixtures (plain, ZIP64, hostile) and the office and ODF fixtures, `detect(bytes, null)` answers `zip` exactly when `await ooxml.discriminate(bytes)` answers `format:"zip"`. Acquisition detects on the whole stored bytes only up to its own threshold; a larger archive is recognised by its declared content type (R28's second arm) or by acquisition's own rule (T35-21, R17).
- `formats.test.mjs`'s existing pattern (register a test-only stub entry through `registerFormat`, drive it through `detectFormat`→`getFormat(...).structure`, then `unregisterFormat` it) is the cheapest way to test R1-R13 and R23 without needing a real office/ODF/PDF fixture.
