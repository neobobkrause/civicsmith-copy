Length: 294 lines. Last section: "Suggestions".

# text-chain: requirements

Next number: 107

## Public

### Purpose

Holds the transcription provenance CHAIN: what a derivation step (a decode, an OCR pass, an AI
clean-up, a conversion, a member's typing) may claim, the rule that a chain can only weaken as it
grows, per-region confidence honesty, the image-region anchor a machine reading must carry, member
attestation and the extent it is scoped to, and the reading-position/extent geometry that bounds what
an extraction or a citation may claim. It holds no engine, no calibration, no store, no network and no
clock, and no function in it throws.

### Provides

Every check function below returns `null` on success or a refusal `{ok:false, code, check,
translation, detail}`, where `code` is one of the keys below, and `check`/`translation` are read from
this module's own `TEXT_CHAIN_CHECKS` (family C-35, exported). `detail` is specific to the failure. A chain is a
non-empty array of step objects; `STEP_KINDS` below is the only source of which step names exist.

**`STEP_KINDS`** — a plain object whose keys are every step kind `checkChain` and `appendStep` accept.
- **R1** [met] Each entry has `role` (`"derivation"` or `"verification"`) and `label` (a human phrase). A `"derivation"` step produced or changed the text; a `"verification"` step (`attested`) checked text already there and never lowers or raises a derivation cap by itself.
- **R2** [met] Each entry has `tier`: an integer (the kind IS that extraction tier), the string `"step"` (the step itself names its tier, on a `tier` field), or `null` (the kind is not a rung on the extraction ladder).
- **R3** [met] `convert`, `typed` and (T41; R104, K2427) `ai_transcription` additionally declare `names` (the fields `checkChain` requires non-empty on that step), `unmeasured: "undetermined"` and `letter` (`"calibrated"` for `convert` and `ai_transcription`, `"never"` for `typed`) — read by `checkChain`'s and `derivationCap`'s rules, never hand-matched by spelling.
- Errors: not applicable; a plain object, never mutated.

**`checkChain(chain) → refusal | null`**
- **R4** [met] `null` for a well-formed chain: an array of at least one step object, each naming a key of `STEP_KINDS`.
- **R5** [met] A string `chain` (the pre-chain single-label shape) refuses `TEXT_CHAIN_COLLAPSED` (C-35.1), checked before the generic shape complaint.
- **R6** [met] A non-array or empty chain refuses `TEXT_CHAIN_EMPTY` (C-35.2).
- **R7** [met] A step that is not a plain object refuses `TEXT_CHAIN_STEP_SHAPE` (C-35.3). A step whose `.step` is not a key of `STEP_KINDS` refuses `TEXT_CHAIN_STEP_UNKNOWN` (C-35.4).
- **R8** [met] An `ocr` or `ai` step with no non-empty string `.engine` refuses `TEXT_CHAIN_STEP_UNNAMED` (C-35.5). A step of a kind that declares `names` (R3) missing any named field refuses the same code.
- **R9** [met] A step whose `.calibration` is present and not a non-empty string refuses `TEXT_CHAIN_CAL_REF` (C-35.12). A `.calibration` absent is legal on every kind.
- **R10** [met] A step of a kind whose `letter` is `"calibrated"` (R3) carrying `.cap` with no `.calibration` refuses `TEXT_CHAIN_LETTER_UNCALIBRATED` (C-35.13).
- **R11** [met] A step of a kind whose `letter` is `"never"` (R3) carrying `.cap` refuses `TEXT_CHAIN_LETTER_ON_PERSON` (C-35.14).
- Errors: never throws.

**`appendStep(chain, step) → chain | refusal`** Returns a NEW array; never mutates `chain` or `step`.
- **R12** [met] Refuses whatever `checkChain(chain)` or `checkChain([step])` refuses, checked in that order.
- **R13** [met] For a `step` whose kind's `role` is `"derivation"`: when `step.cap` and the chain's current `derivationCap(chain)` are both known grade letters and `step.cap` is STRONGER (a lower `BASIS_GRADES` index) than the chain's, refuses `TEXT_CHAIN_STRENGTHENS` (C-35.6). Otherwise appends.
- **R14** [met] For a `step` whose kind's `role` is `"verification"`, or when either cap is unknown, the step is appended unconditionally (rule 2 never blocks a verification, and an unmeasured comparison never refuses).
- Errors: never throws.

**`layerChain({tier, container, cap, measured_by, calibration}) → chain`**
- **R15** [met] Returns a one-step chain `[{step:"layer", tier, container, cap, measured_by, calibration}]` from a document's own text-layer decode. Every argument defaults to `null` and is carried through unvalidated (validate the result with `checkChain` if a refusal is needed).
- Errors: never throws.

**`convertedChain(step, chain) → chain | refusal`** Puts a conversion step (`step.step === "convert"`)
AHEAD of every step in `chain` — `convert → layer`, never the reverse.
- **R16** [met] Refuses whatever `checkChain([step])` or `checkChain(chain)` refuses.
- **R17** [met] For every derivation step `s` already in `chain`, refuses `TEXT_CHAIN_STRENGTHENS` (C-35.6, via R13) when `s.cap` is stronger than `step.cap` — rule 2 applied to what the conversion precedes.
- **R18** [met] On success, returns `[{...step}, ...chain.map(s => ({...s}))]`: a new array, neither input mutated.
- Errors: never throws.

**`mergedChain(parts) → chain | null | refusal`** `parts` is `[{chain, pages}]`, one entry per stretch
of a document with its own provenance, each `chain` already built by `appendStep`.
- **R19** [met] Zero parts → `null` (no text surface answered; distinct from an empty chain).
- **R20** [met] One part → that part's `chain`, unscoped and unchanged (a single-provenance document is not a mixed one), or the refusal `checkChain` gives it.
- **R21** [met] More than one part → the parts' chains CONCATENATED, in order. Any part whose `checkChain` refuses stops the merge and returns that refusal.
- **R22** [met] Within each part, every DERIVATION step is stamped `extent: {kind:"pages", pages}`, where `pages` is that part's `.pages` deduplicated, sorted, non-negative integers — `[]` when `.pages` is not an array or has none, which reads as an UNREADABLE extent to every reader below, never as "all the document". Every VERIFICATION step is copied through unscoped (an attestation carries its own extent). When two parts of one chain share a page, `mergedChain` also stamps each of their derivation steps' extents `part: <the part's index>`, and `derivationCap` (R28) keys parts the same way; chains whose parts partition their pages are unchanged byte for byte.
- Errors: never throws.

**`calibrationsOf(chain) → string[]`**
- **R23** [met] The de-duplicated `.calibration` values (non-empty strings) carried by any step, derivation or verification, in first-seen order.
- **R24** [met] A malformed chain (`checkChain` refuses it) answers `[]`.
- Errors: never throws.

**`derivationCap(chain, target?) → grade letter | null`** `target` is `{page}` or absent/omitted.
- **R25** [met] A malformed chain answers `null`.
- **R26** [met] With no `target`, and every derivation step unscoped (D-252 absent): the weakest measured `.cap` over the derivation steps, `null` when none carries one.
- **R27** [met] With `target.page` given, only steps whose extent (R22's shape, or absent = "all") covers that page bound the answer; the weakest of their measured caps, `null` when none of them measures one.
- **R28** [met] A MIXED document (derivation steps carry different page-list extents): with no `target`, the document's cap is the weakest cap over each distinct extent's steps, and a distinct extent with NO measured step makes the WHOLE answer `null` — a part's absent measurement is never silently resolved by another part's letter (this is what keeps an unmeasured text layer's `null` from being read as an OCR pass's letter).
- **R29** [met] A step of a kind whose `unmeasured` is `"undetermined"` (R3: `convert`) that carries no `.cap` and covers the queried target (or the whole document with no `target`) makes the answer `null` — an unmeasured conversion is not "sequence-neutral" the way an ordinary unmeasured step is, because every step after it measured the CONVERTED bytes.
- **R30** [met] ANY step anywhere in the chain whose extent this module cannot parse (R22's `[]`/unreadable case) makes the answer `null`, for every target and for the whole-document query alike — an extent nobody could evaluate is never assumed not to cover the page in hand.
- Errors: never throws.

**`isTranscribed(chain) → boolean`**
- **R31** [met] `true` when `chain` is well-formed and at least one step's `role` is `"derivation"` (a document's own text layer counts: `pdfstructure.mjs` decodes it, so it is a transcription too). `false` for a malformed chain or one with only verification steps.
- Errors: never throws.

**`terminalStep(chain) → step name | null`**
- **R32** [met] The `.step` of the chain's LAST entry; `null` for a malformed chain. Always document-level: it never distinguishes a page covered by two different step kinds from one covered by a single kind (R81 answers that question).
- Errors: never throws.

**`tiersEvidenced(chain) → {tiers: [{tier, steps, covers}], unclassified: string[]}`**
- **R33** [met] For every step whose kind declares a `tier` (R2) other than `null`, groups by that tier (the step's own `.tier` field when the kind's is `"step"`, `"unrecorded"` when that field is absent on such a step); each tier entry lists the step names that contributed and their UNION of coverage (R22's extent shape; "all" absorbs everything, "unreadable" absorbs a page list).
- **R34** [met] A step whose kind is missing the `tier` property entirely (declared nothing) names itself, once, in `unclassified`, rather than being scored into any tier.
- **R35** [met] A step whose kind declares `tier: null` (`ai`, `attested`, `typed`, `convert`) is skipped: neither a tier entry nor `unclassified`.
- **R36** [met] Tier entries are returned in the ORDER the steps that created them first appeared in `chain`, never sorted by tier number.
- **R37** [met] A malformed chain answers `{tiers: [], unclassified: []}`.
- Errors: never throws.

**`describeChain(chain) → string`**
- **R38** [met] A malformed chain answers `"this text's provenance was not recorded"`.
- **R39** [met] Otherwise, one sentence per step joined by `" -> "`: the kind's label, `(engine version)` or `(engine to format)` when the step names an engine (and, for `convert`, a format), `(member[, at])` for `attested` and `typed`, and, for a SCOPED derivation step (extent not "all"), the pages it covers or `(over an extent this record cannot read)` for an unreadable one. (Fix round 9, G141; ruling (6) of the plan's section 2b) The sentence spells a page 1-BASED, as a reader counts: the stored page number 0 is read "page 1", and a page list is spelled the same way; the stored numbers (R22's extents, R27, R47) stay 0-based and are not changed.
- Errors: never throws.

**`checkConfidence(confidence) → refusal | null`**
- **R40** [met] `null` for the literal string `"none"`.
- **R41** [met] A non-object (and not `"none"`) refuses `TEXT_CONFIDENCE_SHAPE` (C-35.8, "an absent confidence is not the same claim as a stated absent one").
- **R42** [met] An object whose `.basis` is not `"engine"` or `"none"` refuses `TEXT_CONFIDENCE_PSEUDO` (C-35.7) — the fence is on WHO produced the number, never on its value.
- **R43** [met] `.basis === "engine"` with `.value` not a number in `[0,1]` refuses `TEXT_CONFIDENCE_SHAPE` (C-35.8).
- Errors: never throws.

**`applyConfidenceFloor(regions, floor) → {regions, floored, undetermined}`** `regions` defaults to
`[]` when not an array; each output region is a new object.
- **R44** [met] A region whose `checkConfidence` refuses, or whose `.confidence` is `{value, basis:"engine"}` with `value < floor` (only when `floor` is a number), is replaced: `text: null`, `undetermined: true`, `why` (the refusal's detail, or the shortfall sentence), `confidence: "none"`, every OTHER field kept.
- **R45** [met] A region whose confidence is the stated `"none"` is never floored (nothing to compare).
- **R46** [met] `floored` and `undetermined` both count every region replaced under R44; a caller reads the shortfall from them rather than inferring a clean read.
- Errors: never throws.

**`checkAnchor(source) → refusal | null`** The image-region anchor a machine-produced reading carries:
`{kind:"pdf-page", ref?, page, rect}` (I2's IC-1 shape).
- **R47** [met] `null` when `source` is an object with `.kind === "pdf-page"`, `.page` a non-negative integer, and `.rect` an array of exactly 4 finite numbers.
- **R48** [met] Every other shape — not an object, a `.kind` other than `"pdf-page"`, a missing/invalid `.page`, a missing/malformed `.rect` — refuses `TEXT_ANCHOR_MISSING` (C-35.9).
- Errors: never throws.

**`checkAttestation(att) → refusal | null`** A member's claim to have checked text against the image.
- **R49** [met] `.member` identified as a machine credential (`isMachineIdentity`, from `record-grammar`) refuses `TEXT_ATTEST_MACHINE` (C-35.10), checked BEFORE anything about the extent. A non-string or empty `.member` refuses the same code.
- **R50** [met] A missing/empty `.at` refuses `TEXT_ATTEST_EXTENT` (C-35.11).
- **R51** [met] `.extent` must be an object whose `.kind` is `"region"`, `"page"` or `"document"`, else refuses `TEXT_ATTEST_EXTENT`. `"page"` requires a non-negative integer `.page`. `"region"` requires `checkAnchor(.extent.source)` to pass; its refusal is wrapped in `TEXT_ATTEST_EXTENT`'s detail.
- Errors: never throws.

**`extentCovers(extent, target) → boolean`** Does an attestation's extent cover
`target = {page, rect?}`?
- **R52** [met] `extent.kind === "document"` → `true` always.
- **R53** [met] `extent.kind === "page"` → `true` only when `extent.page === target.page`.
- **R54** [met] `extent.kind === "region"` → `true` only when `extent.source.page === target.page` and `target.rect` (4 numbers) sits inside `extent.source.rect`, both rects normalised (min/max) before comparing so an inverted rect still contains what it should.
- **R55** [met] Every other case — a malformed `extent` or `target`, an unrecognised `.kind`, a missing `target.page` for `page`/`region`, a missing `target.rect` for `region` — answers `false`. The default is always NO: an extent nobody could evaluate never reads as "covers everything".
- Errors: never throws.

**`gradeCeiling(chain, target, attestations = []) → {ceiling, determinant, by, why}`**
- **R56** [met] Filters `attestations` to those `checkAttestation` accepts AND whose `.extent` `extentCovers` `target`. If any remain: `{ceiling: EARNED_CAPTURE_CEILING, determinant:"attestation", by: [<their .member>], why: "..."}` — verification supersedes the derivation cap for what a leg citing `target` may claim.
- **R57** [met] Otherwise: `{ceiling: derivationCap(chain, target), determinant:"derivation", by: [], why: "..."}`, `why` naming the page when `derivationCap` is `null`, or describing the chain when it is a letter (via `describeChain`).
- Errors: never throws.

**`captureBound(chain, byteGrade = EARNED_CAPTURE_CEILING) → grade letter | null`** Transcription
fidelity BOUNDS the capture axis (DEC-4): never a third scale, never stronger than `byteGrade`.
- **R58** [met] `!isTranscribed(chain)` (including a malformed or `null`/absent chain) → returns `byteGrade` unchanged.
- **R59** [met] Transcribed with `derivationCap(chain) === null` → returns `null` (an unmeasured engine's output never rides the byte grade through).
- **R60** [met] Transcribed with a measured cap → returns `weaker(byteGrade, cap)` (never stronger than either).
- Errors: never throws.

**`readingSource(source) → {kind, ref, ...} | null`** Normalises a reader's element reference to
IC-1's canonical, key-ordered shape. TOTAL: every malformed or unrecognised input answers `null`,
never a refusal — a reading still writes with the position simply absent.
- **R61** [met] `null` unless `source` is a plain object with `.kind` one of `pdf-page`, `sheet-cell`, `slide-shape`, `doc-para`, and a non-empty string `.ref` (truncated to 200 characters). `dom` (IC-1's fifth arm) and any other kind answer `null` — there is no producer for it yet.
- **R62** [met] `pdf-page` needs `.page` a non-negative integer; `.rect` (4 finite numbers) carries through when present and valid, else `null` (the page alone still answers).
- **R63** [met] `doc-para` needs `.para` a non-negative integer; `.run`, when a non-negative integer, carries through, else `null`.
- **R64** [met] `sheet-cell` needs non-empty string `.sheet` and `.cell` (each truncated to 200/64 characters).
- **R65** [met] `slide-shape` needs `.slide` and `.shape`, both non-negative integers.
- Errors: never throws; never refuses — malformed input is absence, not an error a caller must handle.

**`readingSourceJson(source) → string | null`** The canonical JSON of everything `readingSource`
returns except `kind` and `ref` (which are stored in their own columns).
- **R66** [met] `null` when `readingSource(source)` is `null`; otherwise a `JSON.stringify` of the per-arm fields only, so two readings of the same place serialise identically.
- Errors: never throws.

**`readingOccurrenceKey(source) → string`** (D-454) Which occurrence, among several reads of one
reference, a `reading_refs` row is.
- **R67** [met] `` `${kind}:${readingSourceJson(source)}` `` when `readingSource(source)` normalises; otherwise `""` — every unplaced read of one reference is ONE occurrence.
- Errors: never throws.

**`readingSourceFromColumns(posKind, pos, posRef) → {kind, ref, ...} | null`** The inverse of the
writer's three stored columns (`pos_kind`, `pos`, `pos_ref`).
- **R68** [met] `null` unless `posKind` and `posRef` are non-empty strings, `pos` is a string that `JSON.parse`s to a plain object, and `readingSource({kind: posKind, ref: posRef, ...parsed})` normalises; otherwise the normalised result.
- Errors: never throws (a JSON parse failure answers `null`, not an exception).

**`readingPositionInExtent(position, extentKind, extent) → boolean`** Does a content row's extent
contain the place a reference was read? The default is NO.
- **R69** [met] `false` unless `readingSource(position)` normalises and `extentKind` is a non-empty string.
- **R70** [met] `extentKind === "document"` → `true` always (Bob's 5.3: a document extent's portion is the whole document).
- **R71** [met] Otherwise `extentKind` must equal the position's own `kind` (a coarser reading position is never covered by a finer extent), and: - `pdf-page`: `extent.page === position.page`; when `extent.rect` is absent the whole page counts, when present the position needs its own `.rect` inside it (normalised), else `false`. - `doc-para`: `extent.para === position.para`; when `extent.run` is absent the whole paragraph counts, when present the position needs the same `.run`, else `false`. - `sheet-cell`: `extent.sheet === position.sheet` and `extent.cell === position.cell`, exact. - `slide-shape`: `extent.slide === position.slide`; when `extent.shape` is absent the whole slide counts, when present it must equal the position's `.shape`.
- **R72** [met] A `sheet-cell` position is contained in a `sheet-range` extent when its `.sheet` is the range's sheet and its `.cell` falls within the range's bounds. Design: `EXTRACTION-BREADTH-DESIGN.md` §3.2. The units this reads are emitted by `office-readers` R9 (D-415).
- Errors: never throws.

**`glyphCount(s) → integer`** (D-501/D-514) The number of non-whitespace Unicode CODE POINTS in `s`.
- **R73** [met] `0` for a non-string. Otherwise counts code points (a surrogate pair counts once) that do not match `\s` (Unicode-aware) and are neither U+FFFD (the replacement character) nor U+0000 (NUL): a decode's failures are not glyphs (fix round 9, G141, G131g; X27).
- Errors: never throws.

**`mergeTier2Text(base, t2) → {ok, text?, wholesale?, perPageTier, replaced, kept, why?}`** (D-283)
Merges tier 2's page-wise decode into tier 1's `base`, PAGE BY PAGE, and records which tier won each
page. `base`/`t2` are `{document, pages:[{page, text, undetermined:[{count}]}], counts:{chars}}`-shaped.
- **R74** [met] When `base.pages` has no usable entries (no integer `.page`): if `base.document` is a string, refuses (`ok:false`) whenever it holds at least one glyph (`glyphCount`); if `base.document` is not a string, refuses whenever `base.counts.chars > 0`. The refusal's `why` names what was found and that a page-wise comparison could not be made.
- **R75** [met] In that same no-usable-pages case, when nothing is held (R74's condition false), `t2` is adopted WHOLE: `{ok:true, text:t2, wholesale:true, perPageTier:null, replaced:<t2's page numbers>, kept:[]}`.
- **R76** [met] Otherwise, for each of `base`'s usable pages, tier 2 wins that page — the merged `pages[]` entry becomes `{page, text:<t2's text>, undetermined:<t2's markers>, tier:2}` — only when BOTH: tier 2's page has strictly FEWER undetermined characters (summed `.undetermined[].count`) than tier 1's AND strictly MORE glyphs (`glyphCount` of `.text`, R73) than tier 1's. Otherwise tier 1's page is kept, spread unchanged plus `tier:1`. (Pages of `base` with no integer `.page`, and pages of `t2` that `base` lacks, are R105's.)
- **R77** [met] When tier 2 wins a page (R76), every entry of the base page's `undetermined` list whose `reason` starts with `image_content_`, and every base-page field whose name starts with `image_content_`, is carried onto the merged page unchanged, never re-graded, after tier 2's own markers (not duplicated when tier 2 already states one): they are facts about the page's images, not about which decode won.
- **R78** [met] On the page-wise path (R76), the result also carries `{ok:true, wholesale:false, text:{ ...base, document:<the non-empty pages' texts joined by "\n">, pages, undetermined:<concatenated>, counts:{chars: document.length, undetermined: undetermined.length}}, replaced:<tier-2-won pages>, kept:<tier-1-kept pages>, perPageTier:{tier1:kept, tier2:replaced}}`.
- Errors: never throws.

**`tier2Note(m) → string | null`** A human sentence for `mergeTier2Text`'s result, for a document's
notes.
- **R79** [met] `m.why` (or `null`) when `!m.ok`. `null` when `m.wholesale`. `null` when nothing replaced.
- **R80** [met] Otherwise a sentence naming how many pages tier 2 recovered and how many kept tier 1, plus a second clause noting the chain records the tier per page, when both `replaced` and `kept` are non-empty.
- Errors: never throws.

**[NOT MET — D-723] A page's chain kind, reading `mixed` when it should.** No exported service answers
this today; `terminalStep` (R32) is document-level and a caller (`store.mjs`) reads a page's kind as
`terminalStep(chain) || "layer"`, which names only the LAST-APPENDED step's kind even when a page is
covered by derivation steps of two different kinds (D-635's shape: a text layer's folio with an OCR
transcription appended over the same page). BOB #35's 09:35Z rule (in D-723) is that such a page reads
`mixed`, and BOB #36 superseded D-686's page rule for this one case (11:05Z, 2026-09-25). This module
must add a service that:
- **R81** [met] `chainKindFor(chain, target) → kind | "mixed" | null`, `target` `{page}` or a page number; `CHAIN_KIND_MIXED` is `"mixed"`. Each part covering the page (the extent test of R22/R27; a step's extent, or unscoped meaning the whole document) answers the kind of its LAST derivation step; an unscoped step met first from the end answers alone. The page reads that kind when all covering parts agree and `mixed` when they do not; `null` when no derivation step covers the page or a covering extent is unreadable (R30's rule). `terminalStep` itself is unchanged: it stays document-level and never answers `mixed`.

### Errors summary

Every `TEXT_CHAIN_*`, `TEXT_CONFIDENCE_*`, `TEXT_ANCHOR_*` and `TEXT_ATTEST_*` code above is a key of
`TEXT_CHAIN_CHECKS` (this module's, family C-35.1–C-35.14, K634). No other module may mint a C-35 code; a
new refusal condition in this module mints the next one in the family and is added there.

- **R87** [met] (N98, D-670; K278) `RECT_USER_SPACE` (`"user"`) and `rectSpace(holder) → string | null`: a holder's `.space` absent or `null` reads as `"user"`; a non-empty string is that space; anything else is `null` (unreadable, comparable to nothing). `readingSource`'s `pdf-page` arm carries `space` (truncated to 40) beside a valid rect only when it is not user space, so an explicit `"user"` and the unstated spelling give the same bytes (R66, R67 unchanged for every position written before D-670); a rect with an unreadable space drops to `null`, as a malformed rect does (R62). `readingSourceJson`, `readingOccurrenceKey` and `readingSourceFromColumns` carry it through.
- **R88** [met] (N98) `extentCovers`: a `region` extent covers a target only when `rectSpace(extent.source)` equals `rectSpace(target)`, neither `null` (added to R54's conditions; the default stays no).
- **R89** [met] (N98) `readingPositionInExtent`, `pdf-page` with a rect on both sides: `false` unless both rects are in the same readable space (added to R71's `pdf-page` rule).
- **R90** [met] (N102, D-665, D-697) `mergeTier2Text`: when tier 2 wins a page, each of the base page's `image_unread` markers is carried onto the merged page after tier 2's own, unless tier 2 states one with the same `reason` and `rect`; it counts 0 undetermined characters, so no award moves (R77's family).
- **R91** [met] (N104, K143) Each `STEP_KINDS` entry that is a machine reading declares `machine: true` (`ocr`, `ai`, and (T41; R104, K2427) `ai_transcription`), and no other does; `MACHINE_READ_KINDS` is the frozen array of those keys in `STEP_KINDS` order (`["ocr", "ai", "ai_transcription"]` from T41), which `query-language` re-exports.

**The content-extent algebra** (copied from the catalogue in T19, K747; the catalogue's copy was deleted at T19's close, K855, so this module's is the only one).
- **R92** [met] `CONTENT_EXTENT_KINDS` is a plain object whose keys are exactly `document`, `pdf-page`, `sheet-cell`, `slide-shape`, `doc-para`, `sheet-range`, `doc-table`, `image`, in that order, each `{landed: true, human: <its phrase>}`, each phrase read through `word` from the design's `textchain.text.*` row where one exists ("a cell of this spreadsheet", …; the word table wins, K3930, K3965), else through `localize`; `dom` is not a key.
- **R93** [met] `CONTENT_EXTENT_A1_RE` matches exactly a cell in A1 notation (an optional `$`, 1–3 letters of either case, an optional `$`, a row 1–9999999 with no leading zero); `CONTENT_EXTENT_RANGE_RE` matches such a cell or two joined by `:`.
- **R94** [met] `a1ToRowCol(cell)` → `{col, row}`, both 1-based, the column bijective base 26 (A=1, Z=26, AA=27, ZZ=702, AAA=703), `$` dropped and case folded; `null` for anything else.
- **R95** [met] `rangeCorners(range)` → `{r0, c0, r1, c1}` with each pair ordered (min, max), a single cell being a one-cell range, `null` unless the trimmed input matches `CONTENT_EXTENT_RANGE_RE`; `canonicalRange(range)` → `"<col0><r0>:<col1><r1>"`, upper case, no `$`, always two corners, `null` when `rangeCorners` is.
- **R96** [met] `contentCitedAs(extent)` → the extent's `cited_as` unchanged when present and not `""`; else `"bytes"` for an `image` and `"text"` for every other kind (a non-object reads as `{}`).
- **R97** [met] `canonicalExtent(extent)` → `canonicalJson` (record-grammar) of the arm's fixed fields, absent ones `null`, `ref` never among them: `document` {kind}; `pdf-page` {kind, page, rect min/max-normalised}; `sheet-cell` {kind, sheet trimmed, cell trimmed, `$`-free, upper case}; `slide-shape` {kind, slide, shape}; `doc-para` {kind, para, run}; `sheet-range` {kind, sheet, range = `canonicalRange`}; `doc-table` {kind, table, cell as sheet-cell's}; `image` {kind, cited_as = `contentCitedAs`, part trimmed lower-case, page, rect as pdf-page's}; integers only where an index is meant; any other kind `{kind: kind ?? null, fields: fields ?? null}`. Byte-identical to the catalogue's `canonicalExtent` for every input while the catalogue holds its copy (content ids are taken over it). (K4913) `pdf-page`, `slide-shape` and `sheet-range` also carry `run` when it is an integer and omit it otherwise (a chunk of a unit over 128 Ki characters, `reading-pipeline` R47, so each chunk has its own address and no existing address changes); `doc-part` {kind, part, ref} (the package part and the element reference, each a trimmed string or `null`; `content` R1, K4910).
- **R98** [met] `describeExtent(extent)` → an authored non-blank `ref`, trimmed; else the derived form per arm (`the whole document`; `page <n+1>` or `page <n+1>, a region of it`; `<sheet>!<cell>`; `¶<para+1>`; `slide <slide>`; `<sheet>!<canonical range>`; `table <t+1>[, <CELL>]`; `image <part, 12 chars>` or `an image on page <n+1>`), each arm's fallback phrase when its fields are missing, the kind's `human` for a landed kind otherwise, and `a part of this document the record cannot name` for any other kind (own keys only: a kind such as `constructor` reads as unknown). R92–R98 never throw. (K4913) `doc-part`: `part <ref>` (by key), `run` never in the sentence. Since K4917: a `doc-part`'s `ref` is its element reference, an address field: its form "part <ref>" is read before the authored-ref rule, and `run` is never in the sentence.

**Helpers named by N416** (K747; `EXTENT_KINDS` is internal).
- **R99** [met] `weaker(a, b)` → the weaker (higher `BASIS_GRADES` index) of two grade letters; `null` when either is not a `BASIS_GRADES` letter.
- **R100** [met] `stepCovers(step, page)` → `false` for a non-object step; `true` for an unscoped step (no `extent`); `false` for an extent this module cannot read (R22's unreadable case, R30); else `true` exactly when `page` is an integer in the extent's pages.
- **R101** [met] `CONFIDENCE_BASES` is a plain object whose keys are exactly `engine` and `none`: the bases R42 admits.
- **R102** [met] `perPageTierWinner(p1, p2)` → `"tier1"` when `p2` is absent, `"tier2"` when `p1` is absent, else `"tier2"` exactly on R76's two conditions and `"tier1"` otherwise; `TIER_RULE` is a non-empty sentence stating that rule (fewer undetermined characters and more glyphs, else tier 1).
- **R103** [met] `READING_POSITION_KINDS` is a plain object whose keys are exactly R61's four arms; `READING_POSITION_UNPRODUCED` is `"dom"`, the IC-1 arm `readingSource` answers `null` for.

**T41's addition** (N820; D21; K2418; `plan/draft-T41-investigation.md` §3.6)
- **R104** [met] (D21) Step kind `ai_transcription` with a derivation cap undetermined until its accuracy is measured (`calibration`), so `captureBound` answers undetermined for text it produced.

**Fix round 9's additions** (G141; X27)
- **R105** [met] `mergeTier2Text` drops no page. On the page-wise path (R76) the merged `pages` hold every page of `base` and every page of `t2` exactly once: a `base` page with no integer `.page` is kept as tier 1 (R76's tier-1 shape, `tier:1`), after the numbered pages and in its own order, and is listed in `kept`; a `t2` page that `base` lacks is adopted as tier 2 (`tier:2`) at its page number and is listed in `replaced`; `document`, `counts` and `perPageTier` follow the pages as R78 states, and `tier2Note` (R79, R80) counts them. A `t2` page with no integer `.page` is adopted as tier 2 after the numbered pages, in its own order. (K4864) The `kept` or `replaced` entry of a page with no integer number is `null`.
- **R106** [met] `appendStep` does work linear in the number of steps appended over a chain's life, not quadratic: a chain this module returned (from `layerChain`, `appendStep`, `convertedChain` or `mergedChain`) is known well-formed, so appending to it checks the new step against the chain's cap and extents without re-checking every earlier step; the refusals and results of R12-R14 are unchanged, and a chain built by hand is still checked whole. 5,000 `appendStep` calls inspect at most 4 times 5,000 steps in all (a count of steps inspected, not a time).

## Private

### Uses

- `record-grammar`: `BASIS_GRADES` (the ordered grade-letter array `rank`/`weaker` compare on) and
  `EARNED_CAPTURE_CEILING` (the strongest letter `captureBound` may answer); `isMachineIdentity`
  (whether an attestation's `.member` names a machine credential). (K634; until T18's text-chain job
  re-points, read through `legacy-checks`' re-exports.)
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R82** [met] Pure: no store, no network, no clock. The same inputs always give the same answer.
- **R83** [met] No function in this module throws. Every malformed input answers `null`, `false`, `[]`, or a refusal object — never an exception, and a bad extent or position is never read as "covers everything" or "the whole document" (R30, R55, R69).
- **R84** [met] No place is named in this module (`layers.md`, "No jurisdiction in the product"). It takes no jurisdiction profile and needs none: every space, grade, engine and extent it reasons about is a shape a caller supplies, not a fact this module holds.
- **R85** [met] Rule 2 (derivation only weakens) is enforced by `appendStep` and `convertedChain` alone, by computing `derivationCap` and comparing ranks — never by trusting a caller's claim.
- **R86** [met] A "no" always says which kind of no (the translations each owner's `checks.mjs` holds): outside a floor, undetermined, unjoined, a different value, one system — never plain absence.

### Satisfies

- `docs/architecture/BIO_Content_Framework_v0_10.md` — Part I, the extraction substrate, and Part II
  §14.2–14.3's adopted transcription-provenance tables; §16, the tier markers and the mixed-document
  chain.
- `docs/architecture/BIO_State_Rules_Consistency_v1_5.md` §3 onward — the record's shape rules this
  chain grammar and reading-position geometry are held to.
- `docs/development/EXTRACTION-BREADTH-DESIGN.md` §3.2 — the reading-position containment rule R72
  extends.
- Bob's rulings this file rests on: DEC-4 (transcription fidelity bounds the capture axis, no third
  scale), DEC-35 (the confidence contract — a number is only a number when a classic engine computed
  it), DEC-49 (the refusal families), DEC-75 (a `convert` step's letter is raised only by a calibration
  row), Bob's 5.1–5.3 and 5.8 (`BIO_Content_Framework_v0_10.md` §12, a citation names its portion; a
  letter raised now and lowered later is forbidden), Bob's 5.2 (a member may type a portion's text),
  BOB #35's 06:25Z and 09:35Z rulings and BOB #36's 11:05Z ruling (D-723's `mixed` page rule).

### Suggestions

- **For the caller composing a chain** (`extractrun.mjs`, `index.mjs`): build page-scoped chains with
  `mergedChain`/`convertedChain`/`appendStep` rather than hand-assembling arrays, so rule 2 and the
  extent grammar are enforced once, here, rather than re-derived per caller (REC-46's eleven-copies
  measurement is the cost of doing otherwise).
- **For R81's new service**: a plausible name is `chainKindFor(chain, page)`, read by `store.mjs` in
  place of its own `terminalStep(chain) || "layer"` line — not binding; the module is free to shape it
  differently as long as R81's outcome holds and `store.mjs`'s caller-side obligation (asking per page,
  not once per document) is met.
- D-635 and D-665 are carried rows against `mergeTier3Text` and OCR-routing measurement, both in
  `index.mjs` today (`extraction`/`legacy-index` territory once extracted), not in this module's
  `paths`. They are not requirements here; BOB #37 moved both rows (D-635, D-665) to `extraction` on 2026-09-25.
- The D-501/D-514 sweep found three OTHER readers outside this module comparing the same
  producer-reported character counts instead of glyphs (`needsTier2` and the tier-3 layer attribution
  in `index.mjs`); they are that module's requirements, not this one's, once it is written.
