# pdf-worker — requirements

## Public

### Purpose

The tier-2 member of the function-specific Worker fleet (I6): the dependency-laden PDF path
(`unpdf`/pdf.js) that cannot live in the plane's module graph
(MEASUREMENTS.md, 2026-07-31). It reads a captured PDF's bytes from its own R2 binding and returns the
record's own vocabulary — never a pdf.js object — for the plane to build on. It
writes nothing: no register row, no provenance, no capture, no task; a hop a caller can hand it is a hop
it never invents (D-112).

### Provides

**`POST /structure`** (service binding `PDF_WORKER`; path `/structure` or the empty path) — body
`{capture_sha, store}` → the I2 structure+text shape, or a named refusal.
- **R1** Before the body is read: when `env.CAPTURES.get` is not a function, answers 503
  `R2_NOT_CONFIGURED`.
- **R2** `capture_sha` is lower-cased, then must match 64 hex characters; a missing, non-string, wrong-
  length or non-hex value — including one from a body that failed to parse as JSON — answers 400
  `BAD_SHA`.
- **R3** `store` must be a string; anything else answers 400 `BAD_STORE` (checked before R4, so an
  absent `store` never reaches it).
- **R4** `store` must be exactly `"bio"` or `"scratch"`, case-sensitive; any other value, including a
  case variant, a well-formed but unlisted name, or `""`, answers 400 `NAMESPACE_UNKNOWN` carrying
  `asked` (the value, truncated to 80 chars) and `namespaces` (the two names, in order). This set is
  copied from, and tested equal to, the plane's own (D-478, D-456); it is not this member's to widen.
- **R5** Reads the capture from `CAPTURES` at the R2 key `${store}/captures/${sha}`, by `.get` only. A
  missing object answers 404 `NOT_FOUND` with `capture_sha` and `store`; nothing else is inferred about
  why.
- **R6** (fix round 9, G132h; CF-35; K4834) The object's size is judged against the envelope (R8) before any parse of its bytes: a file over the envelope is answered by R8 with no parse made at all. Within the envelope it is asked for the range only (R42); it runs `pdf-reader` over the bytes once, for that range (`openPdfRange`'s `range`; no whole-file tier-1 parse beside the tier-2 pass, so tier 2 never costs two whole parses). When `pdf-reader` answers `ok:false` (not a PDF, or not bytes), that answer is returned verbatim at 422 and no tier-2 pass runs.
- **R7** Otherwise its `.text` is replaced by this member's own reading of the pages asked (R42) and `.tier` is set (1 or 2) by R8–R10; every other field `pdf-reader` produced for the range (including R46's document-level members) is passed through unchanged, at 200.
- **R8** Over envelope: bytes larger than `MAX_PDF_BYTES` (env override, default 16,777,216) skip tier 2:
  `.text` becomes `{document:"", pages:[], undetermined:[{page:null, reason:"over_envelope", font:null,
  codes:"", count:0, bytes, limit}], counts:{chars:0, undetermined:1}}`, `.tier` is 1, and
  `"tier2_declined_over_envelope"` is appended to `.notes`. (fix round 6, G34; K4608) The default `MAX_PDF_BYTES` is `boundOf("pdf", "worker_bytes")` (`READ_BOUNDS`, alpha column: today's 67,108,864, 64 MiB; no numeric literal of the module's own), measured: tier 2 reads a 64 MiB file of up to 300 text pages in 20 MB of old space and a 23 MiB file of 1,600 text pages in 39 MB under raw workerd, so heap plus bytes stays under 128 MB. Test: `one byte over the default`, `exactly the default`, `the old 16 MiB default plus one`, `the walker's shape`. (Fix round 9, G124a) The refusal states the file's size and the limit, and is final, never `transient`.
- **R9** Tier 2, otherwise: `unpdf` extracts each page's text (pages kept separate). `.text.pages` is one
  `{page, text, undetermined}` per page; a page whose trimmed text is empty carries one
  `{page, reason:"no_text_layer", font:null, codes:"", count:0}` marker, in its own `undetermined` and in
  the document-level list. `.text.document` joins the non-empty pages' text with `"\n"`.
  `.text.counts` is `{chars: document.length, undetermined: undetermined.length}`. `.tier` is 2. (Fix round 9, G132h, G129a; K4831 (6)) Tier 2 reads only the pages of the range asked (R42), so the bytes it decodes are bounded by that range, WinAnsi and MacRoman fonts with no `ToUnicode` included (not escalated further in the alpha). An encrypted document whose password is empty is decrypted and its pages that carry text are read; a page with no text layer (a scan) carries the `no_text_layer` marker and is stated unread, the scan being Stage 3's. A document that needs a user password is not a tier-2 failure (R10): its `.text` carries one document-level marker `{page:null, reason:"password_required", font:null, codes:"", count:0}`, `.tier` is 1, and nothing is invented.
- **R10** Tier-2 failure: when the tier-2 pass throws, `.text` becomes `{document:"", pages:[],
  undetermined:[{page:null, reason:"tier2_extraction_error", font:null, codes:"", count:0}],
  counts:{chars:0, undetermined:1}}`, `.tier` is 1, and `"tier2_error:<message, first 80 chars>"` is
  appended to `.notes`; the R6 structure fields are kept, and nothing is invented. (Fix round 10, cause 8; K5053) A file cut before its trailer (a truncated file) is not a tier-2 failure of the whole file: tier 2 reads it on a repaired view of its bytes (the objects found, without the missing cross-reference) and answers the pages it can read, `.tier` 2, with the pages it could not read named and the reading stated partial; the failure above stands only when no repaired view can be read. Test: a 30-page PDF with six lines a page cut at 70 per cent of its bytes is answered with its first 22 pages' text as the truth has it, tier 2, partial; control: a file that is not a PDF still fails as above.
- **R42** (fix round 9, G132h; CF-35; K4834) **The range asked.** `POST /structure`'s body also accepts `from` and `count`, non-negative integers (`from` default 0; `count` default the pages left): the answer is R6's and R7's for the pages `[from, from + count)` only (`count` clamped to the pages left), carrying `pages` (the document's total), `from` and `count`; a `from` or `count` that is not a non-negative integer answers 400 `BAD_RANGE`, checked after R4 and before R5. A range of 3 pages is answered for 3 pages and decodes those pages only; with neither field, the whole document is the range, under the same envelope.
- **R43** (fix round 9, G139; K4835 (3)) **The test script runs every test.** `pdf-worker/package.json`'s `test` script runs every `*.test.mjs` under `pdf-worker/test/`, the 65 codec tests under `test/codecs/` (`image-codecs`' tests, run here) included; a test in this module's tests compares the script's file set with the files found under `test/` and fails on any test file the script does not run. `image-codecs`' job does not touch the script.

**`GET /version`** → `{ok:true, name:"pdf-worker", version: env.VERSION || "0.0.0"}`, always 200, read
from the deployed Worker's own `VERSION` var — never a constant compiled into the bundle, so it answers
the build actually serving rather than the build that was meant to (D-108).
- **R11** As stated. Never throws.

**Any other request** (any path but `structure`/`""`/`version`, or the wrong method) — **R12** answers
404 `{ok:false, reason:"UNKNOWN", detail:"POST /structure or GET /version only"}`.

**`SURFACE`** (exported constant) **and `fleet-member.json`** — the member's declared surface
(the fleet-coverage instrument that read them, `bio-plane/scripts/coverage.mjs`, retired with `tools/`, K739).
- **R35** `SURFACE` names exactly `structure` (`POST`) and `version` (`GET`), each `mutating:false` — this
  member asserts nothing (fleet rule 2).
- **R36** `fleet-member.json` names `entry` (`src/index.mjs`), `surface` (`"SURFACE"`), `testDir`
  (`"test"`), and the bundle recipe: `entry`, `outfile: dist/pdf-worker.bundled.mjs`,
  `manifest: dist/pdf-worker.bundle.json`.

## Private

### Uses

- `pdf-reader`: `extractPdfStructure(bytes)` for the I2 structure baseline and `openPdfRange(bytes)`'s `range` for the range asked (R42).
- `runtime-limits`: `READ_BOUNDS` and `boundOf(kind, name)` for the envelope (R8).

### Invariants

- **R37** Never writes. Holds no `STORE` (Durable Object) binding and no `PUBLISHED` binding; `CAPTURES`
  (R2) is the only data binding and is only ever `.get`, never `.put`, `.head` or `.delete`.
- **R38** No place is named in this module's code (`src/index.mjs`) or in any refusal text; it holds no jurisdiction data
  (grepped 2026-09-25: none outside one comment citing an Oakland measurement as evidence).
- **R41** Pure per call: the same bytes and options always answer the same way; no clock, no randomness,
  no state carried between requests.
- **R44** (fix round 9, G124; K4835 (1)) No numeric literal in this module's code is a ceiling it keeps (`MAX_PDF_BYTES`): it is read from `READ_BOUNDS`, and a test reads `src/index.mjs` and finds none.

### Satisfies

- `BIO_Content_Framework_v0_10.md` §16, "The non-text path, in three tiers": this member IS tier 2
  (`/structure`'s text).

### Suggestions

- `unpdf` (pdf.js) 1.8.0 is pinned; `Math.sumPrecise` is polyfilled only where the runtime lacks it
  (guards node, not workerd, where the native one runs — CPDF-5).
- `scripts/build.mjs` inlines `unpdf` and builds `dist/pdf-worker.bundled.mjs` plus its manifest (built at test,
  deploy and release, never committed); the guard that the build reproduces from source (FL-9) lives in `bio-plane/test/system/fleetbundles.test.mjs`, outside this
  module's own `test/`.

---

**Status** · In force: written by BOB #37 (T6), a helper module, its requirements BOB's (K20). Split by BOB #44 (K70): R13–R34, R39 and R40 moved to `pdf-pixels`, their numbers retired here and never reused; the decoders to `image-codecs`. Every requirement met. Changed in T51 fix round 9 (BOB; K4831, K4834, K4835 (3), K4837: R6, R7, R8, R9 amended; R42-R44 new; marked not yet met T51).
