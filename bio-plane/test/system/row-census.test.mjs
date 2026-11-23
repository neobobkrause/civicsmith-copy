/* row-census — promotion R50's census suite (N319, K382, K408, K431; LEGACY-TESTS #11, T13), promotion's own since T22's
   opening (K1006: legacy-tests retired, its files re-owned; PROMOTION #23 is the first promotion job to hold it).

   Promotion pins `ROW_CENSUS` = {version, rows, digest} beside `CATALOG_VERSION`: the census of every refusal row, in
   any module's table, as its last stamp read them (R34, R50). Promotion cannot read a later module's table (P4), so
   this suite holds the pin against the tree, computing the census EXACTLY as R50 words it (`row-census.mjs`, whose
   header states the reading; this suite reproduced promotion's own figure on its stamp commit 54abd9a659: 820 rows,
   f01ed42a…).

   WHAT PASSES. The census of the tree IS the pin; or it is the pin once the rows the open tranche's job records name
   `awaiting stamp` are taken back out (R50, K408: a row changed after the stamp by a job in a later layer, which the
   next tranche's layer-2 promotion job stamps). Each such row is declared below with the record that names it, the
   declaration is VERIFIED against that record (a line naming the check and `awaiting stamp`), and the row is LISTED.
   WHAT FAILS, naming the row: any other difference (a row that arrived, departed, or changed its check, code, `where`
   or translation with no record, or a stamp that missed one), found by diffing against the stamp's own lines
   (`fixtures/row-census-<version>.jsonl`, itself held to the pin's digest).
   NEGATIVE CONTROL: (run 2026-09-29, LEGACY-TESTS #11; the first three arms are in the suite and run with it, the
   fourth on a scratch worktree, restored by `git checkout`) (1) a row added to the census without a re-pin -> the
   comparison fails naming `arrived with no record: C-999.1 CONTROL_ARRIVAL`; (2) a stamped row taken out -> it fails
   naming `departed with no record: C-59.6 MINT_EXHAUSTED`; (3) that row's translation changed -> it fails naming
   `changed with no record: C-59.6 MINT_EXHAUSTED`, and a declared `awaiting stamp` row the tree does not bear out is a
   failure, not an exemption; (4) a row `C-59.99 CONTROL_ROW` added to record-core's own `RECORD_CORE_CHECKS` on the real
   tree -> 7 pass 1 fail, `CENSUS MOVED: arrived with no record: C-59.99 CONTROL_ROW`.
   RE-PINNED 2026-09-30 (LEGACY-TESTS #12, T14; PROMOTION #15, N318, N350): over 1.44.0, the stamp's own lines
   (`fixtures/row-census-1.44.0.jsonl`, 827 lines) reproduced by this reader on the stamp commit 872f6d4bd8 (827 rows,
   5eae043f…); the sort's tie broken by the line (N350); C-96.1's held-twice and open-tie assertions and 1.43.0's
   declarations retired.
   RE-PINNED 2026-09-30 (LEGACY-TESTS #14, T16; PROMOTION #17): over 1.46.0, the stamp's own lines
   (`fixtures/row-census-1.46.0.jsonl`, 877 lines) reproduced by this reader on the stamp commit 1dcde36e8b (877 rows,
   1002f871…); 1.45.0's declarations retired, T16's layers 3+ declared (see AWAITING_STAMP). Negative control re-run
   (private worktree): arms (1)-(3) in the suite pass; (4) C-59.99 CONTROL_ROW added to `RECORD_CORE_CHECKS` -> 7 pass
   1 fail, `CENSUS MOVED: arrived with no record: C-59.99 CONTROL_ROW`.
   RE-PINNED 2026-09-30 (LEGACY-TESTS #15, T17; PROMOTION #18, K577, K579): over 1.47.0, the stamp's own lines
   (`fixtures/row-census-1.47.0.jsonl`, 879 lines) reproduced by this reader on the stamp commit 6645daa0e0 (879 rows,
   b8bbd059…); 1.46.0's declarations (T16's layers 3+) and the queue split's composition are stamped in 1.47.0 and
   retired; T17's layers 3+ declared (see AWAITING_STAMP).
   RE-PINNED 2026-10-01 (LEGACY-TESTS #18, T20; PROMOTION #21, K884): over 1.50.0, the stamp's own lines
   (`fixtures/row-census-1.50.0.jsonl`, 986 lines) reproduced by this reader on the stamp commit 49c6e2762a (986 rows,
   dd61926a…); the 1.43.0–1.47.0 snapshots (no stamp reads them) deleted; 1.47.0's declarations retired, T20's layers 3+
   declared (see AWAITING_STAMP). The negative control no longer needs a snapshot: it drives `compare` against a stamp
   it makes from the tree's own lines, so it holds at every stamp (K884).
   RE-PINNED 2026-10-01 (LEGACY-TESTS #19, T21; PROMOTION #22, K941): over 1.51.0, the stamp's own lines
   (`fixtures/row-census-1.51.0.jsonl`, 984 lines) reproduced by this reader on the stamp commit a289ef6478 (984 rows,
   b7c43a32…); the 1.50.0 snapshot (no stamp reads it) deleted; 1.50.0's declarations retired, T21's layers 3+ declared
   (see AWAITING_STAMP), intent's registration among the compositions. A record may name its rows as a list under one
   line naming them `awaiting stamp` (FILINGS #9's record): the verification reads the line's paragraph.
   RE-PINNED 2026-10-01 (PROMOTION #23, T22, K1006): over 1.52.0, the stamp's own lines (`fixtures/row-census-1.52.0.jsonl`,
   1022 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T22/promotion.md`: 1022 rows,
   de396d62…); the 1.51.0 snapshot (no stamp reads it) deleted; 1.51.0's declarations (T21's layers 3–11) and intent's
   composition stamped in 1.52.0 and retired. A row a T22 job in layers 3–11 changes turns this suite red, accepted by
   name until T23's layer-2 stamp (`build/plan/current.md` rule 3; promotion's one job is layer 2, P8), so none is
   declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-02 (PROMOTION #24, T23, K1123): over 1.53.0, the stamp's own lines (`fixtures/row-census-1.53.0.jsonl`,
   1046 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T23/promotion.md`: 1046 rows,
   28dc9ebb…); the 1.52.0 snapshot (no stamp reads it) deleted; T22's layers 3–11 rows (35, none declared here, accepted
   red 3) stamped in 1.53.0. A row a T23 job in layers 3–11 changes turns this suite red, accepted by name until T24's
   layer-2 stamp (`build/plan/current.md` rule 7), so none is declared. Negative control re-run on the stamp commit: its
   arms in the suite pass.
   RE-PINNED 2026-10-02 (PROMOTION #25, T24, K1186): over 1.54.0, the stamp's own lines (`fixtures/row-census-1.54.0.jsonl`,
   1073 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T24/promotion.md`: 1073 rows,
   f1f0ad54…); the 1.53.0 snapshot (no stamp reads it) deleted; T23's layers 3–11 rows (24, none declared here,
   accepted red 1) and record-core's T24 rows (C-59.7–C-59.9) stamped in 1.54.0. A row a T24 job in layers 3–11 changes
   turns this suite red, accepted by name until T25's layer-2 stamp (`build/plan/current.md` red 5), so none is
   declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-02 (PROMOTION #26, T25, K1218): over 1.55.0, the stamp's own lines (`fixtures/row-census-1.55.0.jsonl`,
   1073 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T25/promotion.md`: 1073 rows,
   735376fd…); the 1.54.0 snapshot (no stamp reads it) deleted; T24's layers 3–11 rows (C-18.16–C-18.18, `where`
   re-pointed to link-sweep, none declared here, accepted red 1) stamped in 1.55.0. A row a T25 job in layers 3–11 changes
   turns this suite red, accepted by name until T26's layer-2 stamp (`build/plan/current.md` red 6), so none is
   declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-02 (PROMOTION #27, T26, K1246): over 1.56.0, the stamp's own lines (`fixtures/row-census-1.56.0.jsonl`,
   1073 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T26/promotion.md`: 1073 rows,
   3371a04b…); the 1.55.0 snapshot (no stamp reads it) deleted; T25's layers 3–11 rows (C-34.1–C-34.4, C-89.1, C-103.3,
   C-103.6, C-103.7, each `where` re-pointed by the provenance split, none declared here, accepted red 1) stamped in
   1.56.0. A row a T26 job in layers 3–11 changes turns this suite red, accepted by name until T27's layer-2 stamp, so
   none is declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-03 (PROMOTION #28, T28, S4): over 1.57.0, the stamp's own lines (`fixtures/row-census-1.57.0.jsonl`,
   1103 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T28/promotion.md`: 1103 rows,
   966af5b4…); the 1.56.0 snapshot (no stamp reads it) deleted; T27's layers 3–11 rows (C-117.23–C-117.25, C-69.5,
   C-129.1–C-129.26, thirty arrivals, none declared here, accepted red 2) stamped in 1.57.0. A row a T28 job in layers
   3–11 adds or changes turns this suite red, accepted by name until T29's layer-2 stamp (`build/plan/current.md` red 2),
   so none is declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-03 (PROMOTION #29, T29, S5): over 1.58.0, the stamp's own lines (`fixtures/row-census-1.58.0.jsonl`,
   1128 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T29/promotion.md`: 1128 rows,
   bc45a9ec…); the 1.57.0 snapshot (no stamp reads it) deleted; T28's layers 3–11 rows (C-21.3–C-21.5, C-120.8,
   C-120.10–C-120.13, C-122.2–C-122.4, C-130.1–C-130.14 arrived; C-129.10 re-keyed; C-58.5, C-92.4, C-92.5, C-92.10
   re-worded; none declared here, accepted red 2) stamped in 1.58.0. A row a T29 job in layers 3–11 adds or changes turns
   this suite red, accepted by name until T30's layer-2 stamp (S6), so none is declared. Negative control re-run on the
   stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-03 (PROMOTION #30, T30, S6): over 1.59.0, the stamp's own lines (`fixtures/row-census-1.59.0.jsonl`,
   1128 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T30/promotion.md`: 1128 rows,
   61929a98…); the 1.58.0 snapshot (no stamp reads it) deleted; T29's layers 8 and 11 rows (C-120.1–C-120.8 and
   C-120.10–C-120.13 `where` re-pointed to case-disclosures; C-129.12 and C-129.13 re-keyed to docket's own codes; none
   declared here, accepted red 2) stamped in 1.59.0. A row a T30 job in layers 3–11 adds or changes turns this suite red,
   accepted by name until T31's layer-2 stamp, so none is declared. Negative control re-run on the stamp commit: its arms
   in the suite pass.
   RE-PINNED 2026-10-03 (PROMOTION #31, T32, S7): over 1.60.0, the stamp's own lines (`fixtures/row-census-1.60.0.jsonl`,
   1162 lines) reproduced by this reader on the stamp commit (named in `build/jobs/T32/promotion.md`: 1162 rows,
   2bc34e46…); the 1.59.0 snapshot (no stamp reads it) deleted; T31's layers 3–11 rows (C-131.1–C-131.32, wizard-scripts'
   new family, three of whose codes filing-templates' C-125 also holds, each family's row counted as its own; C-130.15,
   C-130.16, case-import's watch; thirty-four arrivals, none declared here, accepted red 2) stamped in 1.60.0. A row a
   T32 job in layers 3–11 adds or changes turns this suite red, accepted by name until T33's layer-2 stamp, so none is
   declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-06 (PROMOTION #32, T34, N553): over 1.61.0, the stamp's own lines (`fixtures/row-census-1.61.0.jsonl`,
   1316 lines, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in `build/jobs/T34/promotion.md`:
   1316 rows, 5f710da0…, after membership's, record-core's and credentials' merges, K1752, K1754, K1764); the 1.60.0 snapshot (no stamp reads it) deleted; T33's rows awaiting stamp (136 arrivals,
   14 changed, C-114.5 departed; none declared here, accepted red at T33's close, K1708) and T34's layer-1 rows stamped
   in 1.61.0. Re-pinned in place as each T34 layer-2 job merges (BOB's CHANGE), so T34 names one catalogue. A row a T34
   job in layers 3–11 adds or changes turns this suite red, accepted by name until T35's layer-2 stamp (plan Rules (5)
   4), so none is declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-07 (PROMOTION #33, T35-16, N553's tail): over 1.62.0, the stamp's own lines
   (`fixtures/row-census-1.62.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T35/promotion.md`; 1378 rows, c6c85ffe…, over `tranche/T35` after its layer 1; 1383 rows, 71291fdc…, after
   record-core's and membership's merges, K1942; 1390 rows, ff8c6743…, after credentials', K1945); the 1.61.0 snapshot (no
   stamp reads it) deleted; T34's layers 3–11 rows (62 new, 5 re-keyed, 78 changed, each named by its job record; none
   declared here, accepted red 4 at T34's close) and this job's DEC-149 rows stamped in 1.62.0. Re-pinned in place as each
   T35 layer-2 job merges (BOB's CHANGE), so T35 names one catalogue. A row a T35 job in layers 3–11 adds or changes turns
   this suite red, accepted by name until T36's layer-2 stamp (plan T35, Rules 9 (2)), so none is declared. Negative
   control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-08 (PROMOTION #34, T36-8, T35's red 2): over 1.63.0, the stamp's own lines
   (`fixtures/row-census-1.63.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T36/promotion.md`; 1467 rows, a72e0b63…, over `tranche/T36` after its layer 1; 1470 rows, e9ef089b…, after membership's and
   credentials' merges, K2090, K2093); the 1.62.0 snapshot (no
   stamp reads it) deleted; T35's layers 3–11 rows (77 new, 44 changed, none departed, each named by its job record;
   none declared here, accepted red 4 at T35's close) stamped in 1.63.0. Re-pinned in place as each T36 layer-2 job
   merges (BOB's CHANGE), so T36 names one catalogue. A row a T36 job in layers 3–11 adds or changes turns this suite
   red, accepted by name until T37's layer-2 stamp (plan T36, Rules 5 (4)), so none is declared. Negative control re-run
   on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-08 (PROMOTION #35, T37-7, T36's red 4, N754): over 1.64.0, the stamp's own lines
   (`fixtures/row-census-1.64.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T37/promotion.md`; 1516 rows, 2e65afaf…, over `tranche/T37` after its layer 1; 1519 rows, 60d892ca…, after membership's and
   credentials' merges, K2183, K2184); the 1.63.0 snapshot (no
   stamp reads it) renamed to it; T36's layers 3–11 rows (47 new, 19 renumbered C-137 → C-139, 1 retired, 2 changed,
   each named by its job record; none declared here, accepted red 4 at T36's close) stamped in 1.64.0. Re-pinned in
   place as each T37 layer-2 job merges, so T37 names one catalogue. A row a T37 job in layers 3–11 adds or changes turns
   this suite red, accepted by name until T38's layer-2 stamp (plan T37, Rules 6 (2)), so none is declared. Negative
   control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-08 (PROMOTION #36, T38-6, T37's red 2): over 1.65.0, the stamp's own lines
   (`fixtures/row-census-1.65.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T38/promotion.md`; 1546 rows, d235871f…, over `tranche/T38` at its layer 2; 1547 rows, 6f8d4d64…, after
   project-roster's, membership's and credentials' merges, K2283); the 1.64.0 snapshot (no
   stamp reads it) renamed to it; T37's layers 3–11 rows (28 new, 1 retired, 7 changed, each named by its job record;
   none declared here, accepted red 2 at T37's close) stamped in 1.65.0. Re-pinned in place as each T38 layer-2 job
   merges, so T38 names one catalogue. A row a T38 job in layers 3–11 adds or changes turns this suite red, accepted by
   name until T39's layer-2 stamp (plan T38, rule 6 item 2), so none is declared. Negative control re-run on the stamp
   commit: its arms in the suite pass.
   RE-PINNED 2026-10-08 (PROMOTION #37, T39-3, T38's red 2): over 1.66.0, the stamp's own lines
   (`fixtures/row-census-1.66.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T39/promotion.md`; 1551 rows, 51c6423a…, over `tranche/T39` at its layer 2); the 1.65.0 snapshot (no
   stamp reads it) renamed to it; T38's layers 3–11 rows (5 new, 1 re-keyed, 1 retired, 2 changed, each named by its job
   record; none declared here, accepted red 2 at T38's close) stamped in 1.66.0. Re-pinned in place if T39's layer-2
   merge moves a row, so T39 names one catalogue. A row a T39 job in layers 3–11 adds or changes turns this suite red,
   accepted by name until T40's layer-2 stamp (plan T39, rule 3 item 2), so none is declared. Negative control re-run on
   the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-09 (PROMOTION #38, T40-4, T39's rule 3 item 2): over 1.67.0, the stamp's own lines
   (`fixtures/row-census-1.67.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T40/promotion.md`; 1566 rows, d3f742b5…, over `tranche/T40` after membership's and credentials' merges,
   K2413, K2414); the 1.66.0 snapshot (no stamp reads it) renamed to it; T39's layers 3–11 rows (5 new, each named by
   its job record; none declared here, accepted red 2 at T39's close) and T40's layer 2 rows (10 new, 3 changed)
   stamped in 1.67.0. A row a T40 job in layers 3–11 adds or changes turns this suite red, accepted by name until T41's
   layer-2 stamp (plan T40, rule 4 item 2), so none is declared. Negative control re-run on the stamp commit: its arms
   in the suite pass.
   RE-PINNED 2026-10-09 (PROMOTION #39, T41-6, T40's rule 4 item 2): over 1.68.0, the stamp's own lines
   (`fixtures/row-census-1.68.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T41/promotion.md`; 1567 rows, 8c92f849…, over `tranche/T41` after record-core's, membership's,
   project-roster's and credentials' merges, K2441, K2442, K2444, K2445); the 1.67.0 snapshot (no stamp reads it) renamed
   to it; T41's layer 1 rows (C-33.54 new, C-35.13 changed) and layer 2 rows (12 changed) stamped in 1.68.0; T40's layers
   3–11 moved no row. A row a T41 job in layers 3–11 adds or changes turns this suite red, accepted by name until T42's
   layer-2 stamp (plan T41, rule 4 item 2), so none is declared. Negative control re-run on the stamp commit: its arms in
   the suite pass.
   RE-PINNED 2026-10-11 (PROMOTION #40, T42-5, T41's rule 4 item 2): over 1.69.0, the stamp's own lines
   (`fixtures/row-census-1.69.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T42/promotion.md`; 1719 rows, 8902282a…, over `tranche/T42` at its layer 2); the 1.68.0 snapshot (no stamp
   reads it) renamed to it; T41's layers 3–11 rows (154 new, 2 retired, 22 changed, each named by its job record; none
   declared here, accepted red 2 at T41's close) and T42's layer 1 rows (record-grammar's C-33.40 and C-33.54 `where`s)
   stamped in 1.69.0. Re-checked over `tranche/T42` after record-core's, membership's and credentials' merges (K2623):
   the same 1719 rows, 8902282a…, so the pin stands, and T42 names one catalogue. A row a T42 job in
   layers 3–11 adds or changes turns this suite red, accepted by name until T43's layer-2 stamp (plan T42, rule 4 item 2),
   so none is declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-11 (PROMOTION #41, T43-6, T42's rule 4 item 2): over 1.70.0, the stamp's own lines
   (`fixtures/row-census-1.70.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T43/promotion.md`; 1722 rows, f73c10a3…, over `tranche/T43` at its layer 2); the 1.69.0 snapshot (no stamp
   reads it) renamed to it; T42's layers 3–11 rows (3 new, 5 re-keyed, 9 changed, each named by its job record; none
   declared here, accepted red 2 at T42's close) and T43's layer 1 row (record-grammar's C-33.40 `where`) stamped in
   1.70.0. T43's layer 2 is this job alone. A row a T43 job in layers 3–11 adds or changes turns this suite red, accepted
   by name until T44's layer-2 stamp (plan T43, rule 4 item 2), so none is declared. Negative control re-run on the stamp
   commit: its arms in the suite pass.
   RE-PINNED 2026-10-11 (PROMOTION #42, T44-3, T43's rule 4 item 2): over 1.71.0, the stamp's own lines
   (`fixtures/row-census-1.71.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T44/promotion.md`; 1722 rows, c6a39c14…, over `tranche/T44` at its layer 2); the 1.70.0 snapshot (no stamp
   reads it) renamed to it; T43's layers 3–11 rows (2 changed: extraction's C-51.7 and ai-use's C-143.4 translations;
   none declared here, accepted red 2 at T43's close) stamped in 1.71.0. T44's layer 1 moved no row, and its layer 2 is
   this job alone. A row a T44 job in layers 3–11 adds or changes turns this suite red, accepted by name until T45's
   layer-2 stamp (plan T44, rule 4 item 2), so none is declared. Negative control re-run on the stamp commit: its arms in
   the suite pass.
   RE-PINNED 2026-10-11 (PROMOTION #43, T45-4, T44's rule 4 item 2): over 1.72.0, the stamp's own lines
   (`fixtures/row-census-1.72.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T45/promotion.md`; 1732 rows, 795f5029…, over `tranche/T45` after its layer 2's membership and
   project-roster merged); the 1.71.0 snapshot (no stamp reads it) renamed to it; T44's layers 3–11 row (ai-use's C-143.5
   changed; none declared here, accepted red 2 at T44's close) and T45's layer 2 rows (membership's C-56.6, project-roster's
   C-147.1–.8, this job's C-86.16) stamped in 1.72.0. T45's layer 1 moved no row. A row a T45 job in layers 3–11 adds or
   changes turns this suite red, accepted by name until T46's layer-2 stamp (plan T45, rule 4 item 2), so none is
   declared. Negative control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-12 (PROMOTION #44, T46-6, T45's rule 4 item 2): over 1.73.0, the stamp's own lines
   (`fixtures/row-census-1.73.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T46/promotion.md`; 1872 rows, 65a4bea3…, over `tranche/T46` after its layer 2's record-core, membership and
   project-roster merged, K2931); the 1.72.0 snapshot (no stamp reads it) renamed to it; T45's layers 3–11 rows (145 new,
   7 moved to action-holds' C-149, 2 retired, 13 changed; none declared here, accepted red 2 at T45's close) and T46's
   layer 2 rows (membership's C-96.52 new, C-96.49–.51 retired; project-roster's C-147.3–.8 re-worded) stamped in 1.73.0.
   T46's layer 1 moved no row. A row a T46 job in layers 3–11 adds or changes turns this suite red, accepted by name until
   T47's layer-2 stamp (plan T46, rule 5 item 2), so none is declared. Negative control re-run on the stamp commit: its
   arms in the suite pass.
   RE-PINNED 2026-10-12 (PROMOTION #45, T47-10, T46's rule 5 item 2): over 1.74.0, the stamp's own lines
   (`fixtures/row-census-1.74.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T47/promotion.md`; 1882 rows, 42d2890c…, over `tranche/T47` after its layer 2's record-core, membership,
   project-roster and credentials merged, K3040); the 1.73.0 snapshot (no stamp reads it) renamed to it; T46's layers 3–11
   rows (7 new, 92 changed; none declared here, accepted red 2 at T46's close) and T47's layer 2 rows (record-core's
   C-102.33, credentials' C-29.40 and C-29.41, all new) stamped in 1.74.0. T47's layer 1 moved no row. A row a T47 job in
   layers 3–11 adds or changes turns this suite red, accepted by name until T48's layer-2 stamp (plan T47, rule 5 item 2),
   so none is declared. The suite now also fails a missing snapshot and holds the pin's shape (this job). Negative
   control re-run on the stamp commit: its arms in the suite pass.
   RE-PINNED 2026-10-14 (PROMOTION #46, T48-12, T47's rule 5 item 2): over 1.75.0, the stamp's own lines
   (`fixtures/row-census-1.75.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T48/promotion.md`; 1898 rows, dc157a20…, over `tranche/T48` after its layer 1); the 1.74.0 snapshot (no stamp
   reads it) renamed to it; T47's layers 3–11 rows (17 new, 41 changed, 1 retired; none declared here, accepted red 2 at
   T47's close) stamped in 1.75.0. Re-pinned in place after T48's layer 2 merged (ai-accounts, record-core, membership,
   credentials; K3213–K3218): 1898 rows, c57e3cf8…, ai-accounts' 21 moved C-29 `where`s, so T48 names one catalogue. The
   census leaves `journey-check/journey.mjs` out as a script (N1056), which killed it on import at T47's close; its arm
   and a control over a scratch tree are in the suite. A row a T48 job in layers 3–11 adds or changes turns this suite red,
   accepted by name until T49's layer-2 stamp (plan T48, rule 5 item 2), so none is declared. Negative control re-run on
   the stamp commit: its arms in the suite pass; with N1056's script entry taken out, the suite dies inside the journey
   with no tally (exit 1).
   RE-PINNED 2026-10-14 (PROMOTION #47, T49-4, T48's rule 5 item 2): over 1.76.0, the stamp's own lines
   (`fixtures/row-census-1.76.0.jsonl`, written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in
   `build/jobs/T49/promotion.md`; 1907 rows, e2035581..., over `tranche/T49` after its layer 2's membership, project-roster
   and credentials merged, K3336-K3338); the 1.75.0 snapshot (no stamp reads it) renamed to it; T48's layers 3-11 rows and
   T49's layer 2 rows (10 new, 23 changed, 1 retired; none declared here, accepted red 2 at T48's close) stamped in
   1.76.0. A row a T49 job in layers 3-11 adds or changes turns this suite red, accepted by name until T50's layer-2
   stamp (plan T49, rule 5 item 2), so none is declared.
   RE-PINNED 2026-10-17 (PROMOTION #48, T50-6): over 1.77.0, the stamp's own lines (`fixtures/row-census-1.77.0.jsonl`,
   written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in `build/jobs/T50/promotion.md`; 1909 rows,
   962db2b0..., over `tranche/T50` after its layer 2's ai-accounts, membership, credentials and project-roster merged,
   K3625-K3638); the 1.76.0 snapshot (no stamp reads it) renamed to it; R085's and T49's layers 3-11 rows and T50's layer 2
   rows (2 new, 68 changed, none retired; none declared here, accepted red 2 at T49's close) stamped in 1.77.0. A row a T50
   job in layers 3-11 adds or changes turns this suite red, accepted by name until T51's layer-2 stamp (plan T50, rule 5
   item 2), so none is declared.
   RE-PINNED 2026-10-18 (PROMOTION #49, T51-15): over 1.78.0, the stamp's own lines (`fixtures/row-census-1.78.0.jsonl`,
   written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in `build/jobs/T51/promotion.md`; 1918 rows,
   31b4a129..., over `tranche/T51` after its layer 2's membership, project-roster and credentials merged, K3843); the
   1.77.0 snapshot (no stamp reads it) renamed to it; T50's layers 3-11 rows and T51's layer 2 rows (9 new, 327 changed,
   none retired; none declared here, accepted red 9 at T50's close) stamped in 1.78.0. A row a T51 job in layers 3-11
   adds or changes turns this suite red, accepted by name until T52's layer-2 stamp (plan T51, rule 5 item 2), so none
   is declared.
   RE-PINNED 2026-10-19 (PROMOTION #51, CR-5): over 1.79.0, the stamp's own lines (`fixtures/row-census-1.79.0.jsonl`,
   written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in `build/jobs/T51/promotion.md`; 1923 rows,
   c5885eaf..., over `tranche/T51` after the completion round's jobs before this one merged, K4114); the 1.78.0 snapshot
   (no stamp reads it) renamed to it; the rows T51's layers 3-11 and R1 to R8 added or changed (5 new, 75 changed, none
   retired; none declared here) stamped in 1.79.0; the `civicos-ui/` patterns gone with the directory (N1246). A row a
   T52 job adds or changes turns this suite red until T53's stamp, so none is declared.
   RE-PINNED 2026-10-27 (PROMOTION #1, T52-8, K5339): over 1.80.0, the stamp's own lines (`fixtures/row-census-1.80.0.jsonl`,
   written by `row-census.mjs`'s own `censusOf`) on the stamp commit (named in `build/jobs/T52/promotion.md`; 1971 rows,
   17406b47...); the 1.79.0 snapshot (no stamp reads it) renamed to it; the rows added or changed after 1.79.0 (48 new,
   12 changed, none retired; none declared here) stamped in 1.80.0. A row a T52 job adds or changes turns this suite red
   until T53's stamp, so none is declared. */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { censusRows, censusOf, lineOf, isScript } from "./row-census.mjs";
import { ROW_CENSUS, CATALOG_VERSION } from "../../src/gate.mjs";
const LEGACY_DIR = new URL("../", import.meta.url);   /* moved to test/system/ (K612): its relative reads resolve from bio-plane/test/ */

const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const FIXTURE = (v) => fileURLToPath(new URL(`./fixtures/row-census-${v}.jsonl`, LEGACY_DIR));

/* THE OPEN TRANCHE'S ROWS AWAITING STAMP, each as its job record names it. `after` is the version they were changed
   after; a declaration for an older version is stamped since and is listed to be retired, never applied. `departed`
   carries the line as the stamp read it (so the stamp's census can be rebuilt); `arrived` names the row by check and
   code (its line is the tree's). */
const AWAITING_STAMP = [
  /* RE-ANCHORED 2026-10-19 (PROMOTION #51, CR-5): over 1.80.0, the stamp's own lines (`fixtures/row-census-1.80.0.jsonl`).
     The rows added or changed after 1.79.0 are stamped in 1.80.0. */
  /* Process4 tranche t1 (journey-check #1, PR 1282, on ARCH's word): rows moved after 1.80.0 in the earlier process's last work,
     named in their record; the next stamp takes them in. */
  { kind: "changed", after: "1.80.0", line: ["C-115.40","TEMPLATE_NOT_NAMED","src/filings/index.mjs filingPrepare > is-template-not-named","The jurisdiction profile holds no file template for this kind: name a template, or write the words."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "changed", after: "1.80.0", line: ["C-120.4","CO_ATTESTATION_UNACKNOWLEDGED","src/case-disclosures/index.mjs selfAttestedJudged > is-co-attestation-acknowledged","A load-bearing document has no trusted timestamp and co-archive. Retry them, or acknowledge publishing it as self-attested only, with a reason. Nothing was written."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "changed", after: "1.80.0", line: ["C-124.8","SUBJECT_IN_ACTIVE_PLAN","src/action-plans/index.mjs #subjects > is-subject-free","That matter is already in an open plan of this project, which is named. A matter is in one open plan of a project at a time; work in that one, or close it first. Nothing was written."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "changed", after: "1.80.0", line: ["C-137.5","BAD_PERIOD","src/following/index.mjs followBody > is-follow-period","A follow names the days it covers: a first day, and a last day not before it, or none. Nothing was written."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "changed", after: "1.80.0", line: ["C-140.45","SIGNATURES_RUN_UNDER_WAY","src/file-safety/index.mjs scanMirror > is-signature-run-under-way","Your team's Civicsmith is already checking for new signatures, so it did not start another check. Look again in a few minutes."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "changed", after: "1.80.0", line: ["C-53.13","CAPTURE_HELD_BY_ANOTHER_BUNDLE","src/provenance/index.mjs #testimonyFence > is-register-home","The record already holds this document, under another record. A document has one home in the record — the first record that registered it — and registering it again here would move it away from there. Nothing was written. Cite the record that holds it, or, if you found it at a new address, that sighting is already recorded as a corroboration of the one it holds."], record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "arrived", after: "1.80.0", check: "C-2.8", code: "CUTTING_LEG_IN_GROUND", record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
  { kind: "arrived", after: "1.80.0", check: "C-33.65", code: "WHICH_PASSAGE", record: "build/plan/row-census-awaiting-p4-t1.md", by: "journey-check #1, PR 1282 (ARCH, 23 Nov 2026)" },
];
/* COMPOSITIONS AWAITING STAMP: a change to which checks a gate runs moves no row, so the census cannot see it; each is
   declared here by name, verified against its record like a row, and listed (R50, K408, K464). Queue's registered step
   (1.44.0's declaration) is stamped in 1.45.0 and retired (LEGACY-TESTS #13, T15). LEGACY-TESTS #14 (T16, 2026-09-30):
   inquiry's step (1.45.0's declaration) is stamped in 1.46.0 and retired; the queue split's is declared for T17.
   LEGACY-TESTS #15 (T17, 2026-09-30): the queue split's (1.46.0's declaration) is stamped in 1.47.0 (PROMOTION #18) and
   retired; no T17 job names a composition change. LEGACY-TESTS #19 (T21, 2026-10-01): intent's registration changed its
   ids after the 1.51.0 stamp (INTENT #9, no row), declared for T22. */
const COMPOSITIONS_AWAITING = [
  /* PROMOTION #51 (T51, CR-5, 2026-10-19): re-anchored at 1.80.0; no job record names a composition change, and none is
     open. */
];
/* The plane's suite shape: every arm printed PASS or FAIL with its reason, the tally last, the exit its verdict. */
let pass = 0, fail = 0;
const test = (label, fn) => {
  try { fn(); pass++; console.log(`  PASS  ${label}`); }
  catch (e) { fail++; console.log(`  FAIL  ${label}\n         ${String(e && e.message || e).split("\n").join("\n         ")}`); }
};
const keyOf = (check, code) => `${check} ${code}`;
const keyOfLine = (l) => { const [check, code] = JSON.parse(l); return keyOf(check, code); };

/** The comparison, as a function so the negative control drives the SAME code: `lines` are the tree's census lines. */
function compare(lines, { pin = ROW_CENSUS, awaiting = AWAITING_STAMP, stamped = null } = {}) {
  const live = awaiting.filter((a) => a.after === pin.version);
  const byKey = new Map(lines.map((l) => [keyOfLine(l), l]));
  const listed = [], problems = [];
  const rebuilt = [...lines];   /* a multiset: two row objects with one line (C-41.x, held twice) are two lines */
  const drop = (l) => { const i = rebuilt.indexOf(l); if (i >= 0) rebuilt.splice(i, 1); };
  for (const a of live) {
    if (a.kind === "arrived") {
      const l = byKey.get(keyOf(a.check, a.code));
      if (!l) problems.push(`declared arrived after ${a.after} but not in the tree: ${keyOf(a.check, a.code)} (${a.by})`);
      else { drop(l); listed.push(`awaiting stamp, arrived: ${keyOf(a.check, a.code)} (${a.by})`); }
    } else if (a.kind === "departed") {
      const l = JSON.stringify(a.line);
      if (byKey.has(keyOf(a.line[0], a.line[1]))) problems.push(`declared departed after ${a.after} but still in the tree: ${keyOf(a.line[0], a.line[1])} (${a.by})`);
      else { rebuilt.push(l); listed.push(`awaiting stamp, departed: ${keyOf(a.line[0], a.line[1])} (${a.by})`); }
    } else if (a.kind === "changed") {
      const was = JSON.stringify(a.line), l = byKey.get(keyOf(a.line[0], a.line[1]));
      if (!l || l === was) problems.push(`declared changed after ${a.after} but ${l ? "unchanged" : "not"} in the tree: ${keyOf(a.line[0], a.line[1])} (${a.by})`);
      else { drop(l); rebuilt.push(was); listed.push(`awaiting stamp, changed: ${keyOf(a.line[0], a.line[1])} (${a.by})`); }
    }
  }
  const c = censusOf(rebuilt.map((l) => { const [check, code, where, translation] = JSON.parse(l); return { check, code, where, translation }; }));
  const held = c.rows === pin.rows && c.digest === pin.digest;
  const named = [];
  if (!held && stamped) {
    const S = new Map(stamped.map((l) => [keyOfLine(l), l])), R = new Map(c.lines.map((l) => [keyOfLine(l), l]));
    const plural = (m) => { const n = new Map(); for (const k of m) n.set(k, (n.get(k) || 0) + 1); return n; };
    const sCount = plural(stamped.map(keyOfLine)), rCount = plural(c.lines.map(keyOfLine));
    for (const [k, l] of R) if (!S.has(k)) named.push(`arrived with no record: ${k}`);
      else if (S.get(k) !== l && !stamped.includes(l)) named.push(`changed with no record: ${k}`);
    for (const k of S.keys()) if (!R.has(k)) named.push(`departed with no record: ${k}`);
    for (const [k, n] of rCount) if (S.has(k) && n !== sCount.get(k)) named.push(`held ${n} times, stamped ${sCount.get(k)}: ${k}`);
  }
  return { held: held && !problems.length, census: c, listed, problems, named };
}

const tree = await censusRows(REPO);
const now = censusOf(tree.rows);
const stampedPath = FIXTURE(ROW_CENSUS.version);
const stamped = existsSync(stampedPath) ? readFileSync(stampedPath, "utf8").split("\n").filter(Boolean) : null;
console.log(`  CENSUS (R50): ${tree.files.length} files, ${now.rows} rows, sha256 ${now.digest}`);
console.log(`  PIN: ${ROW_CENSUS.version}, ${ROW_CENSUS.rows} rows, sha256 ${ROW_CENSUS.digest}`);
console.log(`  not importable under node (no row literal in any, else BLIND below): ${tree.unimportable.map((u) => u.file).join(", ") || "none"}`);
console.log(`  scripts that run when imported, left out: ${tree.scripts.map((s) => s.file).join(", ") || "none"}`);

test("R50: the census is a census — its files, its tables read, no file holding rows left unread", () => {
  assert.ok(tree.files.length >= 200, `only ${tree.files.length} files: the module paths were not read`);
  assert.ok(now.rows >= 800, `only ${now.rows} rows: the tables were not read`);
  assert.deepEqual(tree.blind, [], "a file node cannot import holds a row literal, so its rows are not in the census");
  assert.deepEqual(tree.scripts.filter((s) => s.checkKey).map((s) => s.file), [],
    "a script left out holds a `check:` key, so leaving it out could move the census");
});

/* N1056 (K3192, PROMOTION #46, T48): `journey-check`'s `journey.mjs` runs its journey and exits when imported, so a census
   that imported it never reached its end (T47's close red T). R50 names it among the scripts. The control builds a
   scratch tree whose `journey.mjs` exits when imported, beside one row table, and runs the census over it to its end. */
const JOURNEY = "bio-plane/src/journey-check/journey.mjs";
test("R50 (T48): the census lists journey-check/journey.mjs among the scripts and never imports it", () => {
  assert.ok(isScript(JOURNEY), "R50's scripts do not name journey-check/journey.mjs");
  assert.ok(tree.files.includes(JOURNEY), `${JOURNEY} is not among the census's files: the module paths moved`);
  assert.deepEqual(tree.scripts.filter((s) => s.file === JOURNEY).map((s) => s.file), [JOURNEY]);
  assert.ok(!tree.rows.some((r) => r.file === JOURNEY) && !tree.unimportable.some((u) => u.file === JOURNEY),
    `${JOURNEY} was imported`);
});
const ctlTree = mkdtempSync(join(tmpdir(), "row-census-journey-"));
let ctlRun = null;
try {
  const put = (f, text) => { mkdirSync(dirname(join(ctlTree, f)), { recursive: true }); writeFileSync(join(ctlTree, f), text); };
  put("build/modules.json", JSON.stringify({ modules: [{ id: "journey-check", paths: ["bio-plane/src/journey-check/"] },
                                                       { id: "control", paths: ["bio-plane/src/control/"] }] }));
  put(JOURNEY, `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(join(ctlTree, "IMPORTED"))}, "");\nprocess.exit(3);\n`);
  put("bio-plane/src/control/checks.mjs", `export const CONTROL_CHECKS = { CONTROL_ROW: { check: "C-999.3", where: "control", translation: "A control row." } };\n`);
  execFileSync("git", ["-C", ctlTree, "init", "-q"]);
  execFileSync("git", ["-C", ctlTree, "add", "-A"]);
  ctlRun = await censusRows(ctlTree);
} catch (e) { ctlRun = { error: e }; }
test("R50 (T48) CONTROL: the census over a tree holding a journey.mjs that exits when imported runs to its end", () => {
  assert.ok(ctlRun && !ctlRun.error, `the census over the control tree threw: ${ctlRun && ctlRun.error}`);
  assert.ok(!existsSync(join(ctlTree, "IMPORTED")), "the control's journey.mjs was imported");
  assert.deepEqual(ctlRun.scripts.map((s) => s.file), [JOURNEY]);
  assert.deepEqual(ctlRun.rows.map((r) => `${r.check} ${r.code}`), ["C-999.3 CONTROL_ROW"], "the census did not read the tree past the script");
});
rmSync(ctlTree, { recursive: true, force: true });

test("R50: one row object in two tables, or one table under two exports, counts once; two row objects with one check count twice", () => {
  /* RETIRED 2026-09-30 (LEGACY-TESTS #12, T14; K408 (4), K458): the assertion that C-96.1 is held twice. The catalogue's
     copy left (LEGACY-CHECKS #8) and 1.44.0 counts membership's row once. What stays is the reader's own half: nothing
     is doubled by the reader, every repeated (check, code) being two DISTINCT row objects in two tables. */
  const where = new Map();
  for (const r of tree.rows) where.set(keyOf(r.check, r.code), [...(where.get(keyOf(r.check, r.code)) || []), `${r.file}#${r.table}`]);
  for (const [k, homes] of where) if (homes.length > 1) assert.equal(new Set(homes).size, homes.length, `${k} read twice from one table: ${homes}`);
  assert.equal(now.lines.filter((l) => l.startsWith('["C-96.1",')).length, 1, "C-96.1 is held once, membership's");
});

/* R50 sorts by check, then code, then the line itself (N350, PROMOTION #15): no two lines tie, so the digest does not
   depend on the order the rows are read in. RE-ANCHORED 2026-09-30 (LEGACY-TESTS #12, T14): the "open tie" this arm
   pinned (C-96.1 held twice, T13) is gone with the catalogue's copy, and the sort's third key closes the class. */
test("R50: the digest does not depend on the order rows are read — the sort's third key is the line itself", () => {
  assert.equal(censusOf([...tree.rows].reverse()).digest, now.digest);
  const shuffled = tree.rows.map((r, i) => [((i * 7919) % 104729), r]).sort((x, y) => x[0] - y[0]).map(([, r]) => r);
  assert.equal(censusOf(shuffled).digest, now.digest);
  /* The third key does work: two lines sharing check and code sort by the line in either read order. */
  const a = { check: "C-1.1", code: "X", where: "a", translation: "t" }, b = { ...a, where: "b" };
  assert.deepEqual(censusOf([b, a]).lines, censusOf([a, b]).lines);
  assert.equal(censusOf(tree.rows.map((r) => ({ ...r, where: r.where ?? undefined }))).digest, now.digest, "a missing where reads null");
});

test("R50 R34: the pin names the stamp it moves with — ROW_CENSUS.version is CATALOG_VERSION, the pin frozen and whole", () => {
  assert.equal(ROW_CENSUS.version, CATALOG_VERSION);
  /* PROMOTION #45 (T47-10): the version is set by reference, so the arm also holds the pin's own shape (R50: a count
     and a lowercase SHA-256), which a hand edit could break while the version still agreed. */
  assert.ok(Object.isFrozen(ROW_CENSUS), "ROW_CENSUS is frozen");
  assert.deepEqual(Object.keys(ROW_CENSUS).sort(), ["digest", "rows", "version"]);
  assert.ok(Number.isSafeInteger(ROW_CENSUS.rows) && ROW_CENSUS.rows > 0, `rows ${ROW_CENSUS.rows}`);
  assert.match(ROW_CENSUS.digest, /^[0-9a-f]{64}$/);
});

/* LEGACY-TESTS #14 (T16, 2026-09-30), K567: a record may name its row with the exact phrase
   "for promotion's stamp" (RATIFICATION #7's wording, build/jobs/T16/ratification.md:20) beside
   `awaiting stamp`; nothing broader is accepted. */
const AWAITING = /awaiting stamp|for promotion's stamp/i;
/* LEGACY-TESTS #19 (T21, 2026-10-01): a record may also list its rows under one line naming them `awaiting stamp`
   (FILINGS #9: "**Rows, each `awaiting stamp` (T22):**", then one bullet per kind of change). A line naming the row
   counts when it, or an earlier line of its paragraph (the lines up to a blank one), names `awaiting stamp`. */
const namesAwaiting = (text, needle) => {
  let para = false;
  for (const l of text.split("\n")) {
    if (!l.trim()) { para = false; continue; }
    if (AWAITING.test(l)) para = true;
    if (para && l.includes(needle)) return true;
  }
  return false;
};
test("R50: every row awaiting stamp is named so by its job record", () => {
  /* The paragraph reading's own control: a row named only in another paragraph, or before the naming line, is not named. */
  assert.equal(namesAwaiting("**Rows, `awaiting stamp`:**\n- C-1.1 X\n\n- C-1.2 Y", "C-1.1"), true);
  assert.equal(namesAwaiting("**Rows, `awaiting stamp`:**\n- C-1.1 X\n\n- C-1.2 Y", "C-1.2"), false);
  assert.equal(namesAwaiting("- C-1.3 Z\n**Rows, `awaiting stamp`:**", "C-1.3"), false);
  for (const a of AWAITING_STAMP.filter((x) => x.after === ROW_CENSUS.version)) {
    const check = a.named ?? (a.kind === "arrived" ? a.check : a.line[0]);
    const text = readFileSync(join(REPO, a.record), "utf8");
    assert.ok(namesAwaiting(text, check),
      `${a.record} has no line naming ${check} and "awaiting stamp" (${a.by})`);
  }
  for (const c of COMPOSITIONS_AWAITING.filter((x) => x.after === ROW_CENSUS.version)) {
    const text = readFileSync(join(REPO, c.record), "utf8");
    assert.ok(namesAwaiting(text, c.needle),
      `${c.record} has no line naming the ${c.needle} and "awaiting stamp" (${c.by})`);
    console.log(`  awaiting stamp, composition: ${c.what} (${c.by})`);
  }
  for (const c of COMPOSITIONS_AWAITING.filter((x) => x.after !== ROW_CENSUS.version))
    console.log(`  STAMPED SINCE, retire this declaration: composition ${c.what} (after ${c.after})`);
  for (const a of AWAITING_STAMP.filter((x) => x.after !== ROW_CENSUS.version))
    console.log(`  STAMPED SINCE, retire this declaration: ${a.kind} ${a.kind === "arrived" ? keyOf(a.check, a.code) : keyOf(a.line[0], a.line[1])} (after ${a.after})`);
});

test("R50: the stamp's own lines are the pin — the snapshot this suite names rows against is the stamp's", () => {
  /* PROMOTION #45 (T47-10): every stamp since 1.43.0 writes its snapshot, so a missing one is a stamp that missed it,
     never a pass: without it the arm below cannot name a moved row. */
  assert.ok(stamped, `no snapshot of ${ROW_CENSUS.version} (${stampedPath}): the stamp writes its own lines there`);
  const c = censusOf(stamped.map((l) => { const [check, code, where, translation] = JSON.parse(l); return { check, code, where, translation }; }));
  assert.deepEqual({ rows: c.rows, digest: c.digest }, { rows: ROW_CENSUS.rows, digest: ROW_CENSUS.digest });
});

test("R50: the tree holds the pin, the rows awaiting stamp listed — any other difference fails naming the row", () => {
  const r = compare(now.lines, { stamped });
  for (const l of r.listed) console.log(`  ${l}`);
  for (const l of [...r.problems, ...r.named]) console.log(`  CENSUS MOVED: ${l}`);
  assert.deepEqual(r.problems, []);
  assert.ok(r.held, `the census, less the rows awaiting stamp, is ${r.census.rows} rows sha256 ${r.census.digest}, `
    + `not the pin ${ROW_CENSUS.rows} ${ROW_CENSUS.digest}: ${r.named.join("; ") || "(no snapshot to name the rows)"}`);
});

test("R50 NEGATIVE CONTROL: a row added without a re-pin fails, naming it; so do a departure and a changed translation", () => {
  /* The control's own stamp, made from the tree's lines (K884): the arm drives the SAME `compare` at every stamp, with
     or without that stamp's snapshot, and first proves its stamp holds so a red below is the arm and not the stamp. */
  const own = censusOf(now.lines.map((l) => { const [check, code, where, translation] = JSON.parse(l); return { check, code, where, translation }; }));
  const ctl = { pin: { version: "control", rows: own.rows, digest: own.digest }, stamped: own.lines, awaiting: [] };
  assert.equal(compare(now.lines, ctl).held, true, "the control's own stamp does not hold over the lines it was made from");
  // fixtures-generic: CONTROL_ARRIVAL (a row made up on purpose for the negative control; no module gives it)
  const added = lineOf({ check: "C-999.1", code: "CONTROL_ARRIVAL", where: "src/nowhere.mjs control", translation: "A control arm's row." });
  const a = compare([...now.lines, added], ctl);
  assert.equal(a.held, false);
  assert.ok(a.named.includes("arrived with no record: C-999.1 CONTROL_ARRIVAL"), a.named.join("; "));
  /* PROMOTION #45 (T47-10): the departed and changed row is the tree's first row held once, so the control never depends on one
     module's row staying where it is (it named C-59.6 until T47). */
  const gone = now.lines.find((l) => now.lines.filter((x) => keyOfLine(x) === keyOfLine(l)).length === 1), goneKey = keyOfLine(gone);
  const d = compare(now.lines.filter((l) => l !== gone), ctl);
  assert.equal(d.held, false);
  assert.ok(d.named.includes(`departed with no record: ${goneKey}`), d.named.join("; "));
  const moved = JSON.parse(gone); moved[3] = `${moved[3]} (a control arm's edit)`;
  const m = compare(now.lines.map((l) => (l === gone ? JSON.stringify(moved) : l)), ctl);
  assert.equal(m.held, false);
  assert.ok(m.named.includes(`changed with no record: ${goneKey}`), m.named.join("; "));
  /* And a declaration the tree does not bear out is itself a failure, not an exemption. */
  const x = compare(now.lines, { ...ctl, awaiting: [
    { after: "control", kind: "arrived", by: "a control arm", record: "-", check: "C-999.2", code: "NOWHERE" }] });
  assert.equal(x.held, false);
  assert.ok(x.problems.some((p) => p.includes("C-999.2 NOWHERE")), x.problems.join("; "));
  /* A row declared changed whose line the tree still bears as stamped is a failure too (LEGACY-TESTS #13, T15). */
  const y = compare(now.lines, { ...ctl, awaiting: [
    { after: "control", kind: "changed", by: "a control arm", record: "-", line: JSON.parse(gone) }] });
  assert.equal(y.held, false);
  assert.ok(y.problems.some((p) => p.includes(`unchanged in the tree: ${goneKey}`)), y.problems.join("; "));
});

console.log(`\nrow-census: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
