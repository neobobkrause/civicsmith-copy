# reading-pipeline — requirement notes

Moved out of `build/requirements/reading-pipeline.md` word for word on 4 Nov 2026 to bring it under the requirements cap (BOB's split ruling, PR 274). Nothing here is a requirement; every **R** line and its mark stays in the requirements file.

## The Status history

**Status** · In force: split from `extraction` (N513; K617, K1193), meaning unchanged: R1–R19 are `extraction` R2–R17, R60, R25 and R26, retired there; R20–R22 copy its R44, R45 and R50, binding both modules; R23 is BOB's wording of the seam; the text Bob's rulings (K102, K293, DEC-4, DEC-75) settled. Last changed T41 (T41-9: R29 new, a transcription tier above tier 3, as `draft-T41-investigation.md` §3.6; K2405, K2418), not yet met; R28 marked not yet met (T36: amended, a `.docx` table's cells; K1972, K2092), every other requirement met (last merged T35, K1962). Last changed T42 (T42-9: R30 new, the re-read's seed keeps the AI's pages; N832, K2611; N835's owner spelling is tests only, R29 stands, K2500), not yet met. Last changed T43 (T43-9: R29 amended, an account or limit refusal answered as `aiRefusal`; N853a; K2611, K2689), not yet met. Last changed T48 (T48-17: R31 new, the paying account asked of `ai-accounts` (`transcription.accounts`), `credentials` read in its place through T48; R29's citation re-pointed to `ai-accounts` R7, R11, wording only; Uses gain `ai-accounts`, `modules.json` `uses` drops `credentials`; N996, split map §5, K3101; `d606-perpage-ocr`, `tier2-wire` and `system/pdf-worker-binding` sign in by `{handle}`, N1052, K3192, test only; K3195); R31 marked not yet met (T48). Last changed T51 (T51-fix round, FR-65: R32 amended, a captured page's navigation, skip links and template tokens are no passage; K4194, K4210). Fix round 9 (T51; `build/plan/fix-round-9-T51.md`; K4831, K4834, K4837): R45–R58 new (the reader contract `plan`/`read` over `{size, readRange}` and the three read modes retired; the advance rule; chunked units and part kinds; completeness from counters; encodings through `ooxml.decodeText`; the light kinds in windows; HTML; classification as a budgeted step; named refusals; no OCR call inline; legibility; a ranged PDF completes its reading; reading waits for no scan); R2, R15, R23, R32, R35, R37, R40, R41 amended; all marked not yet met (T51). Fix round 6 (T51): R39 new, a bare digest is no document (`BARE_DIGEST`, G6); R40 new, a reading is read whole in pieces by a cursor (G13, G14); R41 new, nothing is cut in pieces (G15); R32 amended, an unclosed head (G14). Fix round 9 (T51; K4958): R46 amended (the encrypted statement on a whole read); marked not yet met (T51).

| old (`extraction`) | new | | old | new | |
|---|---|---|---|---|---|
| R2 | R1 | text read as text | R11 | R10 | the chain |
| R3 | R2 | tier 1 | R12 | R11 | final text, basis |
| R4 | R3 | tier 2 | R13 | R12 | page count, extent, boxes |
| R5 | R4 | tier 3 selection | R14 | R13 | dialect |
| R6 | R5 | a member's answer | R15 | R14 | `reading.provenance` |
| R7 | R6 | the tier-3 merge | R60 | R17 | text counts |
| R8 | R7 | a folio page | R16 | R15 | text units, the wire's bound |
| R9 | R8 | `image_unread` | R17 | R16 | nothing fetched |
| R10 | R9 | the tier-3 note | R25 | R18 | `readingProvenance` |
| | | | R26 | R19 | `compareProvenance` |
| R44, R45, R50 | R20, R21, R22 | invariants (copies) | — | R23 | the re-read's pieces (seam, new wording) |
| `read`'s heading | R24 | `read`'s signature and errors | | | |

**Size (P6).** This module takes `bio-plane/src/extraction/pipeline.mjs` (1,070) and `bio-plane/src/readingprov.mjs` (253) whole, into `bio-plane/src/reading-pipeline/`: 1,323 lines. The tests are:
- `test/m/extraction/read.test.mjs`, less its R1, R18 and `acquireReadingOp` arms;
- `convert-ocr.test.mjs`, `staffdirectory.test.mjs`, and `convert-tiers.test.mjs` less its R31/R34 arms;
- the R25/R26 cases of `rules.test.mjs`;
- the six legacy-path tests and fixtures `modules.json` names (`modules-json.md`).

Well under 4,000.

### Suggestions

- **Where it runs.** In the Worker, with the fleet bindings (the pipeline half of `extraction`'s "Two halves"). `extraction`'s store half calls it. Its one calibration read (R5's live calibration) is the `liveCalibration` callback `extraction` hands in, so this module needs no edge to `calibration`.
- **R23 is the seam.** It names what `extraction/index.mjs`:30 imports today. The names are not new. BOB rules whether they stand as one requirement here or stay unstated, as they were inside `extraction`.
- **`CAPTURE_TEXT_UNIT_CAP`** is defined here (R15). `extraction` re-exports it (`extraction/index.mjs`:33) for `observation-log`, `connections` and three tests. Whether the re-export stays is decision 6 (BOB's).
- **Tests move whole or split case by case** (`draft-T25-splits.md` E-1). The moved tests call `read(document, {evidence, env, view, liveCalibration})` directly, with a small fixture of their own (the extraction fixture's `bucket()` and `doc()` helpers), and their assertions do not change. `convert-chain` (R3, R11, R12, R15 there) and `convert-extent` (R13, R60 there) are split case by case. R2 and R15 (old R3, R16) get over-strictness arms: a PDF and an office capture read byte for byte as before.
- The pipeline owns no table and mints no catalogue row. C-51 stays with the re-read in `extraction`.
- **T33 (T33-23).** The hooks are held in memory, registered at start like every listener slot (K31's pattern), so the module still owns no table (Rules (6) asks nothing of it). A **capture class** is the caller's word for the kind of capture read (the profile's content-type key is proposed); which classes a module opts into, and who widens the set, are the registering module's (`events` R4; K1505 (9): the administrator's). R26 needs its caller: the module that commits a reading (`extraction`'s re-read, through `promotion`'s step) calls `afterRead` after its commit. `extraction` has no T33 entry, so until a job wires that call no hook runs; this is named to BOB. `membership` is a new edge (Uses), needed for R25–R26; the plan's entry listed none.
- **T36 (T36-13; K2092).** R28's `.docx` cells reach `extraction` (its R70), which stores and answers them; key tests: a `.docx` with a table of dates and amounts read with its cells keyed by `ref`, a nested table under its own key, a body with no tables `{}` and an unread body `cells: null`, kept distinct.

## Open for Bob

None. The text is `extraction`'s, already settled by Bob (K102).

## Decided by BOB (for the rulings)

- (N513, K1193, E-1 only) The split from `extraction`, R1–R19 = `extraction` R2–R17, R60, R25, R26, with no change of meaning, and R20–R22 copies of R44, R45, R50 (R20 without R44's drift and proposal clauses, decision 3 of the drafts' review). R24 is `read`'s signature (decision 4). `readingprov.mjs` is this module's from the opening (decision 6). Layer 4, after `calibration` and before `extraction`. `paths` is `bio-plane/src/reading-pipeline/`, which this module's T25 job creates by moving `extraction/pipeline.mjs` and `readingprov.mjs`.
- (owed) R23's seam wording; `CAPTURE_TEXT_UNIT_CAP`'s re-export (decision 6).
