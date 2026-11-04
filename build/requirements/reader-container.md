# reader-container — requirements

**Status** · New in T53 (N1266, N1267; K4831 (2), K5435, K5436; `build/plan/beta/planning/CONSISTENCY.md` §2 rows 2, 4, 9): a layer-1 module, a standalone worker run as a container, like `file-scanner` (bytes in, results out), for the heavy kinds that cannot be read in a Worker: legacy and macro Office and RTF by conversion, every image kind decoded to frames for OCR, and archives opened as streams; its capability was ruled by K4831 (2), so it is BOB's packaging and not a new decision for Bob. Placed in `modules.json` by BOB. Marked not yet met (T53); nothing is built. Lines from `build/plan/beta/files/REQ-readers-beta.md` CC1–CC6 (same ids), R7–R8 drafted by the worker.

## Public

### Purpose

Reads what the Workers cannot: it converts a legacy or macro-enabled Office file or an RTF to an open format and hands it to the existing readers, decodes every supported image kind to upright, OCR-ready frames, and opens archives as streams within their bounds. It refuses a file over its bound before any read, runs no macro and follows no link, and holds no record: results go back to the caller, which files them.

### Provides

The module is called with a source (a range source `{size, readRange(offset, length)}`, the reader contract of `reading-pipeline` R45) and the kind `format-registry` detected, and answers units, frames or members, or a stated refusal. The names of its calls are the job's, listed in its record; the lines below state outcomes.

- **R1** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC1) Legacy and macro Office: `.doc`, `.xls`, `.ppt`, RTF read after conversion by the container reader to an open format, then by the existing parsers; the original is kept whole and cited; units carry the same kinds (footnote, comment, notes). `.xls` stops at its format's 65,536 rows a sheet. Test: the portal's old Excel releases, a generated `.doc` with a footnote, an RTF with a table.
- **R2** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC2) Macros are never run: conversion runs with macros disabled and no external links followed; a macro's presence is stated on the document page. Test: a document whose macro writes a file: no file written, macros stated.
- **R3** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC3) Images: JPEG, PNG, TIFF (every page of a multi-page file), HEIC, HEIF, AVIF, GIF (first frame), WebP, BMP and JPEG 2000 are decoded to OCR-ready frames, turned upright, within 50 MB and the pixel limit. Test: each type's sample read by OCR; a sideways photo read upright; a 40-page TIFF gives 40 pages.
- **R4** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC4; K5448 (2)) The safe picture is `file-safety`'s one redraw (A4-R1 to A4-R7; K5448 (2), CONSISTENCY §2 row 2): `image-cover` redraws JPEG and PNG (its R12–R14); the container decodes every other image type to pixels and the same redraw and the `PHOTO_FACTS` table apply. This module adds no second redraw; it returns the decoded pixels and the facts the container can read (time, place, orientation) to that path. Test: a HEIC and a TIFF photo give the same safe picture and facts as the same photo as a JPEG. (Load: LOAD-PER-TYPE M14.)
- **R5** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC5) Archives: a ZIP within the Worker's reach opens in the Worker (`acquisition` R38, a lower job's); every other archive and a large ZIP open in the container client, as streams, within 500 MB uploaded, 2 GB unpacked, the one nesting count of `mail-reader` R10 (at most 3), 10,000 members, ratio 1,100; every member is recorded on the one ledger, the `acquisition` `member` job, and no second ledger is kept; RAR is refused by name; each member is its own capture and job; an encrypted member is stated. A single-file `.gz`/`.bz2`/`.xz` is a one-member archive. Test: a 500 MB ZIP, a depth-4 ZIP (refused, stated), a ratio bomb (refused), a TAR.GZ.
- **R6** (T53; N1266, N1267; K4831 (2), K5435; `build/plan/beta/files/REQ-readers-beta.md` CC6) A file of any kind over its bound is refused with its size and the limit in plain words, before any read (plan step). Test: each kind at bound + 1.

## Private

### Uses

- `runtime-limits`: `READ_BOUNDS`, `boundOf(kind, name)` and `statement` for every ceiling this module keeps (R3, R5, R6, R7).
- `test-support` for tests (generated Office files, photographs of every kind, archives and ratio bombs).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R7** (T53; K4831 (8); K4835 (1); drafted by the worker on the convention of `doc-clean` R12) No numeric literal in this module's code is a ceiling it keeps (the 50 MB image, 500 MB uploaded, 2 GB unpacked, 10,000 members, ratio 1,100, nesting 3, the pixel limit): each is read from `READ_BOUNDS` through `boundOf` (`runtime-limits` R37), and a test reads the module's source and finds none.
- **R8** (T53; K4831 (2); drafted by the worker, as `file-scanner`'s and the other readers' invariants) It holds no record and no store: bytes in, results out; nothing it converts, decodes or unpacks is run or fetched (R2); no place is named in its code or any refusal text; every failure is a stated result and never a throw. The converted copy is a derived copy: the original is kept whole and cited (R1).

### Satisfies

- K4831 (2) (a container reader for the heavy kinds), K4628 (a file within its bound is read whole and cited), K5435, K5436 (the beta's list; a type not read is held and named), K5439 and K4831 (8) (the protective limits: archive depth 3, 10,000 members, ratio 1,100).

### Suggestions

- Reader choice and licences are GAP-3.0's: LibreOffice for conversion, libvips for images, libarchive or 7-Zip for archives, an OLE parser for MSG; none is asserted here.
- Like `file-scanner`, the module is a container member of the fleet: `bundler` builds, signs and deploys it (`bundler` R24–R27, R36, R37); `bundler` is earlier in the order, and this module does not call it.
- CC4 states no photograph rule of its own: it returns the decoded pixels and the facts the container can read (time, place, orientation) to `file-safety`'s redraw, and adds no second redraw.


## Walk findings

- **F1** *(not yet met: walk p3dev-l1)* (walk p3dev-l1, 4 Nov 2026 01:04-01:11Z; the coordinator's root-14) **A deployed version answers on `/version` within the rollout check.** After `deploy-fleet.mjs` uploaded this member to copy p3dev-l1, its `https://<member>-p3dev-l1.<sub>.workers.dev/version` did not answer the deployed version (0.87.0) within 60 s: `ROLLOUT NOT CONFIRMED after 60s`. The same was measured for every container-backed member (agent-runner, agent-worker, file-scanner, reader-container) and none of the others. Test: after a deploy to a p3dev copy, `/version` answers the deployed version within the rollout check's bound; or the bound is stated from a measured container start time and the check waits for it.
