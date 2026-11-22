Length: 181 lines. Last section: "Suggestions".

# docprofile: requirements

Next number: 42

## Public

### Purpose

Recognises which content type a captured document is (`doctypeFor`), over the host-stack
identification `site-profiles` gives (`identify`), and, given two captures of the same address, says
what changed between them in LAYERS that stop as soon as one can decide (`assess`), never by
comparing raw bytes. It gives extraction the one entry point that runs the same recognisers over text from any
container (`readText`). Its `registry.mjs` re-exports `site-profiles`' services, so a caller reaches
both through this module. The stack recognisers detect technology and need no jurisdiction
(`site-profiles`). Every registered CONTENT TYPE, by contrast, recognises a document by the vocabulary
one jurisdiction's clerks, staff and systems actually write — a masthead's wording, a code's own
abbreviation, a report template's section names — and takes that vocabulary from the active
jurisdiction profiles rather than holding it in code.

### Provides

**`identify(ctx)`** is `site-profiles`' (re-exported).

**`doctypeFor(ctx) → {type, confidence, signals, considered, also}`** `ctx` carries `site-profiles`' `identify` context
(`headers`, `locator`, `content_type`, `text`) and additionally `handler` (from `identify`), `kind`, and `view`: the combined view of the active jurisdiction
profiles that `jurisdictions.combine` gives.
- **R4** [met] Always returns a type: the first registered content type to match at CERTAIN confidence, else the highest-confidence match, else the `generic` fallback at confidence NONE. Confidence is `site-profiles`' one ladder (its R3, R4).
- **R5** [met] `also` names every OTHER non-fallback registered type whose own `detect` also matches this same `ctx`, so a document satisfying more than one class (measured: about one in twelve) states all of them rather than letting the first match stand for the whole document. A type whose `detect` throws during this pass is reported as an error entry in `also`, never dropped and never propagated. (fix round 6, G48; K4685) Each type is asked at most once in one classification: `also` is built from what the walk already asked, plus only the types registered after a winner that stopped the walk at CERTAIN; its entries and their order are those of the independent pass (`alsoFor`).
- Errors: never throws, provided no registered type's own `detect` throws outside the `also` pass
  (R5 states what happens there).

**`digests(bytes, handler, ctx)`** is `site-profiles`' (re-exported).

**`assess(before, after, ctx) → the layered result`** `before`/`after` are byte arrays of two
captures of one address. `ctx` carries `locator`, `headers`, `sha256`, and optionally `now`,
`before_at`, `after_at`.
- **R11** [met] Runs the layers L1 (stack) through L6 (connections) in order and stops as soon as one layer decides. The result carries `stopped_at` (the last layer reached) and `trail` (one entry per layer reached, each naming what it said), so how far the reasoning got is always visible.
- **R12** [met] `verdict` is one of: `unwatchable` (the handler is a shell at CERTAIN confidence, `site-profiles` R2; stops at L1; a client-rendered match at LIKELY or POSSIBLE is not a shell and the layers go on), `identical` (byte-identical), `unchanged` (only mechanical bytes differ), `restyled` (only presentational bytes differ), `undetermined` (the bytes differ, the stack was not identified at CERTAIN confidence, and the handler is not the always-trusted `conservative` one), `changed` (the substance differs and, once read, the content type judges the difference meaningful), or `routine` (the substance differs but the content type judges nothing meaningful).
- **R13** [met] `meaningful` is `true` only for `changed`; `false` for `identical`, `unchanged`, `restyled` and `routine`; `null` for `unwatchable`, `undetermined`, and a content type that could not parse the document — never guessed in either direction.
- **R14** [met] `events[]` is drawn from the one significance-graded catalogue (`site-profiles` R13) (`event`, `notice`, `routine`; a type naming an event kind the catalogue does not hold is a defect in that type, caught by the catalogue itself). `meaningful` is always `worstSignificance(events) === "event"`; it is never a second fact carried beside the events. (The content types' own share: `doctypes` R5.)
- **R15** [met] `connections[]` entries are either `referential` (`{connection:"referential", from, to, relation, why}`) or `temporal` (`{connection:"temporal", from, to, relation, at, expected_by, why}`) — the two are never collapsed into one shape. (The content types' own share: `doctypes` R6.)
- **R16** [met] `confirmation` states what was verified UNCHANGED whenever anything was, even alongside `changed`/`routine` events on the same result, and is `null` only when nothing was confirmed. A read that FOUND NOTHING on either side is reported as a failed reader (`meaningful: null`, a stated `why`), never as an emptied or unchanged document.
- **R17** [met] The result also carries `profile` (`site-profiles`' `profileRecord`'s own serialisation of the L1 stack identification) and, once L4 is reached, `content_type` (the winning content type's key).
- Errors: never throws; a content type's own `parse`/`assess` throwing is caught and reported as
  `meaningful: null` with a stated reason.

**`readText(supplied, ctx) → {determined, ...}`** `supplied` is a bare string or interface I2's
text shape (`document`, `pages[]`, `paragraphs[]`, `undetermined[]`, `counts`). `ctx` carries
whatever the caller knows (locator, headers, content type, `at`) plus, for the doctype pass,
`view`.
- **R18** [met] `determined:false` when no honest reading may be produced: no text was supplied, or the decoded text is mostly undetermined (more undetermined characters than decoded ones — the plane's own measured essentially-nothing line). (Fix round 9, G141; X27) A decoded character is a glyph: white space, U+FFFD and NUL are not counted as decoded (`text-chain` R73), so two glyphs among a thousand spaces and 600 undetermined characters is `determined:false`. `why` and `partial` state which. (K4865) `chars` and the count in `why` are glyphs (no white space, U+FFFD or NUL; a surrogate pair counts once); a marker's `why` is read as its reason beside `reason`, and a marker whose `why` is `over_size_bound` (itself or in its `guard`) is stated as a size refusal with the text's size and the limit, never as undecodable regions.
- **R19** [met] `determined:true` otherwise, carrying `partial` (true when any part is undetermined but not so much that R18 refused), `text_from` (which shape supplied the text), the recognised `stack` and `doctype` (as `site-profiles`' `identify` and `doctypeFor` gave them), the content type's own `parsed` result or a `parse_error` naming why it has none, and `position_parts`/`position_why` stating whether the supplied text carried enough structure to place a reference at all. (fix round 6, G48; K4685) `classified_over {chars, of, head_chars, windows[{from,to}], sheet_heads[{from,to}], heads_used}` is answered only when the type was judged from a view (R38), and `why` then ends with the sentence stating it; `heads_used` is true when the sheets' boundaries were established and their heads kept within the bound.
- **R20** [met] The content type's reader is handed a total `locate(offset)` function built from the supplied text's own segment map (R23); it may place a reference only where `locate` says, never at a position it composed itself. (The content types' own share: `doctypes` R7.)
- **R37** [met] (K1520) `readText` hands the content type's reader the supplied text's structure as `ctx.supplied` beside `text` and `locate`: its pages (a page with no text layer included), `undetermined` markers, `images`, an `ocr` transcription where the caller supplied one, and a sheet's typed `cells` (`office-readers` R30), unchanged.
- **R38** [met] (fix round 4, C5a/C5b/P8; K4467) **`readText` and `doctypeFor` stay bounded on a very large text.** They hand each type's `detect` and `parse` the supplied text's pages (`ctx.pages`, as R37 hands the reader) beside `text`, and their own work makes no second whole copy of the text beyond the one `flattenText` needs, released before the types run. Measured as heap + array buffers above what the caller holds (a child process, `--expose-gc`): over the reading of `BUDGET-2024-APP` (15.2 MiB, 1,354 pages, 13.6 M characters; pdf-reader's memory test fetches it), `readText` with every registered type adds under 16 MB, and every answer (`type`, `confidence`, `also`, `parsed`) is unchanged on every fixture and on the three govinfo files. Test: that measurement, and the answers compared with the tranche tip's. (K4865) "Every answer unchanged" holds for texts at or under `CLASSIFY_WHOLE_MAX_CHARS`; a text over it is classified from the view (R39) and its answer states `classified_over`. Over `CLASSIFY_WHOLE_MAX_CHARS`, `readText` and `doctypeFor` copy no more of the text than its classification view, handed once to each type with `ctx.window`; their own work adds under 6 MB at 3 MiB and at 12 MiB of text, measured above what the caller holds with no collection in the stretch; the garbage a type makes over the view is that type's (doctypes R37) (K4892).
- **R39** [met] (fix round 7, G88; K4768) **Classifying a long text gives the thread back.** `doctypeForYielding(ctx, {yieldNow})` (async) answers exactly what `doctypeFor(ctx)` answers (`type`, `confidence`, `signals`, `considered`, `also`, `why`, a throw from a `detect` in the main walk included), the two sharing one walk; once `ctx.text` is longer than 256 KiB of characters it awaits `yieldNow()` before each type's `detect`, in the main walk and in the `also` pass, so no synchronous stretch of the classification is longer than one `detect`; at or under that length, or with no `yieldNow` function, it never suspends; a `yieldNow` that throws or rejects is ignored and the answer is the same. `doctypeFor` stays synchronous and unchanged; the text is not sampled at or under `CLASSIFY_WHOLE_MAX_CHARS` (R19, R38 keep their bounds; above it, see the next paragraph). The threshold is the exported constant `CLASSIFY_YIELD_AT_CHARS` (256 KiB of characters). Test: `docprofile/test/g88-yield.test.mjs`, and `docprofile/test/memory.test.mjs` (the twin holds no second copy, R38). (fix round 6, G48; K4685) **A large sheet is classified from a stated view.** A text whose flat text is over `CLASSIFY_WHOLE_MAX_CHARS` (2 MiB), of every kind (fix round 9, G133f; X25: head and sample above 2 MiB for every kind), is classified from a view of at most `CLASSIFY_VIEW_MAX_CHARS` (1.5 MiB); for a sheet (`supplied.sheets` an array) the view is: the sheets' first lines, the first 256 Ki cut at a line end, then 12 windows of 96 Ki of whole lines spread over the rest, the last ending at the text's end (R19 states it); `identify` and every `parse` read the whole text; a bare string, `pages`, `paragraphs`, a PDF's text and a page have the same view without sheet heads (the first 256 Ki cut at a line end, then 12 windows of 96 Ki of whole lines, the last ending at the text's end), and R19's `classified_over` states it. *(Replaces "classified whole at any size" for these kinds.)*
- Errors: never throws; a content type's `parse` throwing is caught and reported as `parse_error`.

**Bounded classification and a verdict that gates watching, not reading (fix round 9, G140, G133f; X22, X25)** (K4865) Every text over `CLASSIFY_WHOLE_MAX_CHARS`, of any kind, is classified from the view (the head and windows spread across it), by `doctypeFor` itself and not only by `readText`, and the answer carries `classified_over`.
- **R40** [met] `doctypeFor` and `readText` hand each type's `detect` the view's window and a work counter (`ctx.work`, an object `{chars}`), and the characters all the detects together examine are at most 4 times the view for each registered type, for any text (K4876: every type is asked; one type's runaway stops those after it), whatever its shape (a long run of one pattern, 16,000 e-mail addresses on one line, 40,000 definitions, 150,000 dates); a test asserts the count. The longest synchronous stretch of the classification is one `detect` over one window (R39). The pass is a budgeted step: no `detect` is handed more than its window. (K4865) Each detect is handed `ctx.text` (the view, else the whole), `ctx.window = {from, to, of}` and one shared `ctx.work = {chars, limit}` with `limit = CLASSIFY_WORK_FACTOR` (4, exported) times the view's characters times the number of registered types (K4876; since doctypes charges each detect its window, R40's old whole-classification limit stopped every text after the fifth type, so `policy` and `staff_directory` were never asked); a detect adds the characters it examines; the registry asks no further type once `chars > limit` (checked between detects, so the total passes the limit by at most one detect) and the answer's `work.stopped_before` and `why` name the first type not asked.
- **R41** [met] (fix round 9, G140) A profile verdict gates watching and never reading: `readText` reads, classifies and parses the same text whatever `stack` was recognised, `unwatchable` or not, and the reading of a document is the same whether `assess` has called it a shell, `restyled` or `changed`. `docprofile/pipeline.mjs` and `docprofile/doctypes/registry.mjs` make no decision about a document's reading from a stack match below CERTAIN.

**`flattenText(supplied) → {text, source, chars, undetermined, reasons, segments, position_why}`** (K4865) The verdict's gate is `assess`'s: `unwatchable` only for a shell that site-profiles R2 answers (`identify(...).shell`, true at CERTAIN alone).
- **R21** [met] A bare string flattens to itself, with an empty segment map and a stated `position_why` (a string carries no container structure).
- **R22** [met] Interface I2's `document` field is preferred when present; a segment map is built from `pages`/`paragraphs` beside it ONLY when their own non-empty-item, newline-joined text is byte-for-byte equal to `document` — otherwise no map, and `position_why` states that the producer's `document` is not its itemised parts joined.
- **R23** [met] With no `document`, `pages`/`paragraphs` alone flatten to their own non-empty items, newline-joined, with one segment per surviving item (a `pdf-page` or `doc-para` source, per I2's own itemisation).
- **R24** [met] `undetermined` is the producer's own stated count (`counts.undetermined`) when given, else summed from its markers; never invented from the text alone.
- Errors: never throws.

**`makeLocator(segments) → locate`**
- **R25** [met] `locate(offset)` is TOTAL: a non-number, a negative number, or an offset inside no segment all answer `null`; otherwise the containing segment's own `source`.
- Errors: never throws.

**`fidelity`**, **`profileRecord`**, **`CONFIDENCE`** are `site-profiles`' (re-exported).

**`CONTRACT`** — how a monitored document of a given content type should be watched, declared per
type: `SUBSTANCE` (watch the evidentiary digest; any change is an event, furniture moving a
notice), `MEMBERSHIP` (watch which entries are present and whether each still says what it said),
`UNMONITORABLE` (a shell; nothing is watched, and the absence is stated rather than silently
reported "unchanged") (**R29**). This module holds and exports `CONTRACT` and its three values; each
content type's own declaration of its contract is `doctypes` R4 (T33-12).

## Private

### Uses

- `site-profiles`: `identify` (its R1–R3) for the stack a document was served by; `compare` (R10)
  for `assess`' byte layers L2–L3; `profileRecord` (R12) for `assess`' `profile`; `CONFIDENCE` and
  `makeRegistry` (R4, R5) for the content-type axis; the event catalogue (R13, R14) for every
  content type's events and `assess`' `meaningful`; `unescapeHtml` (R15) for the calendar's keys.
  `registry.mjs` re-exports its names (`digests`, `fidelity` and the rest) for this module's callers.
- `jurisdictions`: the combined view (`combine`). Instrument numbers (an ordinance's or resolution's
  number, in its caption or cited by another document) are recognised with the view's IDENTIFIER
  section, the same forms `id-spaces` uses for `enactment`, so the fact is stated once. For every
  registered content type, the view's recogniser-vocabulary section. By KIND of fact this module needs from it, per
  content-type key:
  - **self-naming/masthead phrases** — the words and qualifiers a clerk's masthead uses to name a
    document as (for example) minutes or an agenda, plus the furniture-recurrence floor that
    tells a masthead (repeats once per page) from a passing reference (once or twice) to the same
    kind of document;
  - **furniture lines** — fixed running header/footer strings (the publishing body's own name, its
    clerk's-office name, a "printed on" stamp) skipped when scanning back for a heading or a
    body's name, so they are never mistaken for either;
  - **operative-voice and caption vocabulary** — the phrases a body uses to ENACT an instrument
    (ordain/resolve, in the operative voice), the words that introduce its own caption (which
    kind of body: a council, a board, a commission), and any series suffix the jurisdiction's own
    captions carry (Oakland's is "C.M.S.");
  - **code-citation vocabulary** — how the jurisdiction names and abbreviates its own code, and
    the words ("Section", "Chapter") it cites a part of that code by;
  - **report-template section headings** — the named sections a staff or agenda report's house
    template uses (recommendation, background, fiscal impact, and the rest), and the phrase(s) a
    report self-names with on its title page;
  - **reference-line shapes** — the format of a source-assigned tracking number an item is filed
    under (for example a Legistar file number's two-digit-year–dash–four-digit-serial shape),
    used as an entity key. This is a DIFFERENT fact from an `id-spaces` identifier space's forms
    (see Suggestions) and is not assumed to be one without a ruling saying so;
  - **directory self-naming words** — the words ("directory", "staff", "roster", "contacts")
    that self-name a staff directory; the recognition floors themselves (the minimum count of
    distinct contact addresses and the share at one organisation's domain) are measured structural
    floors and stay in code, as R6 states (K574);
  - **measured local practice thresholds** — for example, how long a habitually late document of
    a given kind may go before its lateness is worth RAISING a question (never asserting one),
    each fact carrying its own measurement, per `layers.md`'s rule that a profile names the
    measurement each fact rests on;
  - **publishing-system address shapes** — the URL/path patterns this jurisdiction's own systems
    use for an index (a calendar, a list of legislation) and for one record's own page, so a
    content type's own address matching, and a stack handler's index/record distinction, can
    speak about the systems this jurisdiction actually uses rather than assuming Legistar's.

  The exact shape of the recogniser-vocabulary section (how it is keyed, and how a profile
  supplies zero, one or several forms of each kind above) is `jurisdictions`' to define; this
  module needs the kinds of fact above, keyed by content-type key, and needs no fact about a
  place's identity beyond that. The four built-in stack handlers use nothing from this section
  (see Purpose).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R30** [met] No place is named in this module's own code (the pipeline, `readText`, the shared helpers and the registry seam). That every local fact a content type tests for comes from the active profiles, tested with a profile that is not the first for every type, moved with the types to `doctypes` R3 and R20 (T33-12). The four stack handlers (`site-profiles`', its R16) hold no such facts and need none, because they recognise technology, never place.
- **R31** [met] Deterministic over its inputs: the same `bytes`/`text` and the same `ctx` values always give the same answer, with no exception in this module's own code: the calendar's forward-looking connection, which reads the wall clock when `ctx.now` is absent, moved with the types to `doctypes` R8 (T33-12). Nothing in this module reads a store or the network.
- **R32** [met] The failure asymmetry governs every default: an unrecognised document is never assumed decorated (`site-profiles`' `conservative` treats almost nothing as machinery and nothing as furniture, so any byte difference is reported), and a recogniser applied without CERTAIN confidence never asserts "unchanged" — only `conservative`'s own narrowing is trusted without certainty. (The content types' own share: `doctypes` R22.)
- **R33** [met] A reading, or a diff of two readings, that found NOTHING is a failed reader stated as such, never an emptied or unchanged document; a mass removal is never reported from a failed read.
- **R34** [met] An entity's position (`source`) is only ever what `ctx.locate` returned for the offset the reader actually read it at — never composed, never guessed — and is absent, not invented, when the supplied text carried no structure to place it in. A reference read more than once is one entity, `source` its first sighting's, carrying `occurrences`: every place it was read, in reading order, the first included, each what `ctx.locate` returned for that read (null where it could not say); a reference read once carries no `occurrences` (D-454; K754). (A content type's own reading: `doctypes` R7.)
- **R35** [met] Every "no" (no match, no confidence, no position, no digest, no meaningful change) says which kind of no and why; absence is never reported as sameness and never as non-existence.
- **R36** [met] (T33-12; K617; A §(c)) This module holds no content type in its own code: the seven types are `doctypes`' (its R1), registered into this module's registry at composition through `doctypes`' `registerDoctypes`, which `plane` wires; `doctypes/registry.mjs`'s static imports of the types are gone. Its pipeline, `readText`, the shared helpers `doctypes` imports (`readerView`, `vocabulary`, `CONTRACT`, `entity`, `referential`, `temporal` and the rest its Uses lists) and the registry seam stay, with their meaning unchanged; a name it re-exports for an importer not yet re-pointed reads through to `doctypes` until that importer moves (plan T33, Rules (9) item 4). (T34-8; N549) The seven copies of the types this module kept, and their registration by default (K1513 (3)), are deleted now that `plane` registers `doctypes`' types (T33-90): a type is in this module's registry only when a caller registered it through the seam.

### Satisfies

- `docs/architecture/BIO_Content_Framework_v0_10.md` §4, "One extension shape: the RECOGNISER"
  (the recogniser/registry shape both axes share), and §16, "How content is extracted today"
  (Identify, Read).
- `docs/development/DOCUMENT-PROFILES.md`, whole — the design of record this module implements.
- `build/layers.md`, "No jurisdiction in the product".

### Suggestions

- **The `id-spaces` overlap.** `regulation`'s and `staff_report`'s instrument-number vocabulary
  (an ordinance or resolution's own caption and the numbers other documents cite) is the same
  kind of fact as `id-spaces`' `enactment` identifier space (`requirements/id-spaces.md` R1–R5).
  `docprofile`'s declared `uses` (`build/modules.json`) is `jurisdictions` alone, so this file
  does not require sourcing that vocabulary through `id-spaces`, and the two may go on stating it
  independently. Whether `docprofile` should instead recognise and normalise an instrument number
  through `id-spaces` — one fact, read once — is an architecture question for BOB, not settled
  here.
- **`compare()` and the stack registry.** `pipeline.mjs`'s `assess` is built on `site-profiles`'
  `compare()` (its R10). The four built-in handlers are registered by `site-profiles` itself (its
  Suggestions); this module's `registry.mjs` stops registering them once it does, and only
  re-exports.
- **No edge from the old interface.** (The retired `legacy-ui`, K4100, once bundled a copy of this package; nothing outside `bio-plane/src` uses it now.)
- **The T33 split (T33-12).** `doctypes` merges first, then this module's job deletes its copies. R4's
  "always returns a type" assumes `generic` (now `doctypes`') is registered; a test of this module
  registers `doctypes`' types, or a stub fallback, before asking. How `doctypeFor` answers with no type
  registered at all is the job's START to name (BOB's).
- **The deletion (T34-8).** This module's own tests register stub types through the seam (a stub
  fallback among them) instead of the deleted copies.
- For the module job: the recogniser-vocabulary section most naturally keys each kind of fact by
  the content type's own `key` (`meeting_minutes`, `meeting_agenda`, `regulation`, `staff_report`,
  `staff_directory`, `meeting_calendar`), since that is how `doctypes/registry.mjs` already
  dispatches; not binding, only a starting shape.
