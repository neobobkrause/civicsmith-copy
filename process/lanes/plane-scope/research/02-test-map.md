Length: 303 lines. Last section: "Gaps and things not found".

# Plane scope research 02: map of plane's tests

Written 23 Nov 2026 by a research worker for the plane-scope lane, branch `work/plane-scope-research`. Read-only research; it decides nothing. Sources: `process/modules/plane.json`, `process/modules/order.txt` (the module order, 204 modules), every file named, the import graph worked out by script (static imports, dynamic imports, `new URL(...)` paths and `src/<module>/` path strings, followed through test helpers), each file's header comment, and git history. Nothing was run.

## Key

Paths: `pl/` = `bio-plane/test/m/plane/`, `cp/` = `bio-plane/test/m/control-plane/`, `m/` = `bio-plane/test/m/`, `bp/` = `bio-plane/test/`.

Boots:
- `MF`: Miniflare/workerd over `bio-plane/src/plane/index.mjs` (plane's Worker entry and its `Store`) loaded by path in the test itself.
- `MF-kit`: the same through control-plane's seam kit `cp/r8-kit.mjs` (which uses the counting door `cp/wrap-entry.mjs`, a wrapper of plane's default export).
- `MF-wrap`: the counting door directly. `MF-realplane`: screens-intake's `realplane.mjs` (Miniflare over plane index).
- `MF-sub`: Miniflare over a `pl/*-entry.mjs` that extends plane's `Store` with debug routes and re-exports plane's default Worker.
- `MF-copy`: a `plane-world.mjs` that copies `src/` to scratch and adds an entry over plane's door and `Store` (capture-requests', agent-worker's).
- `FX`: `pl/fixture.mjs`, plane's `Store` class constructed in node over node:sqlite (its constructor calls store-assembly's `assembleStore`). `SH`: `pl/shape/harness.mjs`, the FX Store in a memory-capped child process.
- `SA`: store-assembly code only (`registerReaders`, `assembleStore`), no plane file. `cfg`: reads plane's `wrangler.jsonc` only. `door`: imports plane's `door.mjs` hook only. `src-scan`: reads source as text.

Own entry (does the file need plane's own code, `bio-plane/src/plane/`?): `W+S` the Worker entry `index.mjs` and `Store`; `S` the `Store` class (`store.mjs`); `S+W` Store plus the entry's default imported in node; `door` `door.mjs`; `cfg` plane's `wrangler.jsonc`; `no` none.

Latest = the latest module in the order, other than plane, that the file reaches by import (directly or through its kit). Anything that loads plane's entry also reaches control-plane (195) through it, since `src/plane/index.mjs` and `store.mjs` import control-plane. `-` = reaches nothing but plane (path-loaded). Notes: `to Nm` = longest per-test timeout in minutes; `alone/heavy` = header says run alone / heavy / not run by the suite / minutes; `not run (.mjs)` = not a `.test.mjs`, so the module runner (`.github/scripts/module-tests.mjs`) never runs it.

No file states a "heavy" or "run alone" marker the runner reads; the runner runs all of a module's `.test.mjs` files in one `node --test` call. The marks below come from header text and timeouts only.

## A1. Plane's own requirements: the composition root (Store, Worker entry, door hooks, wrangler config, watchdog, RPCs, headers)

| path | proves | boots | own entry | latest | lines | notes |
|---|---|---|---|---|---|---|
| pl/body.test.mjs | plane R6, doorbell R20, publication R73 | FX | S | control-plane | 67 |  |
| pl/door.test.mjs | plane R1,R5, instance-setup R89,R90, store-assembly R1 | FX | S | control-plane | 284 |  |
| pl/fix4-defer.test.mjs | plane R75, control-plane R120, extraction R80 | FX | S | control-plane | 84 |  |
| pl/g83-census.test.mjs | plane R95, runtime-limits R28 | src-scan | no | - | 71 | text census of src/ |
| pl/g83-location.test.mjs | plane R95, runtime-limits R27,R28 | MF-sub+FX | W+S | control-plane | 181 |  |
| pl/l79.test.mjs | plane R79,R80 | MF-sub | W+S | store-assembly | 113 |  |
| pl/limits.test.mjs | plane R13 | cfg | cfg | subresources | 54 | reads wrangler.jsonc |
| pl/r-transcribe-answer.test.mjs | plane R36 | FX | S | control-plane | 82 |  |
| pl/r10-arrival-log.test.mjs | plane R24 | FX | S | control-plane | 50 |  |
| pl/r10-reading-ended.test.mjs | plane R1, notice-producers R29 | FX | S | control-plane | 70 |  |
| pl/r78-timing.test.mjs | plane R78,R96, store-assembly R62,R64 | FX | S | control-plane | 20 |  |
| pl/r8-heal-door.test.mjs | plane R102 | MF-sub | W+S | store-assembly | 147 |  |
| pl/r8-heal-sequence.test.mjs | plane R8 | FX | S | control-plane | 71 |  |
| pl/r8-timing-hook.test.mjs | plane R96, control-plane R128,R129 | FX | S | control-plane | 127 |  |
| pl/r99-r103.test.mjs | plane R99,R102,R103, scheduler R29, store-assembly R74,R75 | FX | S | control-plane | 71 |  |
| pl/split.test.mjs | plane R6 | FX | S | control-plane | 28 |  |
| pl/store.test.mjs | plane R1, R4, R9, R95, R111, R114 | FX | S | control-plane | 99 |  |
| pl/t42.test.mjs | plane R35-R38 (T42 composition) | MF+FX | W+S | control-plane | 222 |  |
| pl/t43.test.mjs | plane R6, control-plane R17 | FX | S | control-plane | 35 |  |
| pl/t44.test.mjs | plane R6, control-plane R17 | door | door | store-assembly | 33 | imports plane door.mjs gatedOp only |
| pl/t45.test.mjs | plane R111, op-declarations R49, run-rules R30 | FX | S | control-plane | 82 |  |
| pl/t46.test.mjs | plane R33, R36, R39, R40, R42, R47 (T46) | MF-sub+FX | W+S | control-plane | 143 |  |
| pl/t47.test.mjs | plane R43,R46,R48, ai-runs R18, bundler R31 | FX | S | control-plane | 127 |  |
| pl/t48.test.mjs | plane R54,R55, bundler R31, instance-setup R87 | FX | S | control-plane | 162 |  |
| pl/t50.test.mjs | plane R62,R63 | FX | S | control-plane | 158 |  |
| pl/watchdog.test.mjs | plane R79,R80, scheduler R28,R29 | FX+index(node) | S+W | control-plane | 211 | Worker scheduled handler in node + fixture Store |
| pl/worker.test.mjs | plane R6, R7, R8 (admission R20) | MF+FX | W+S | control-plane | 187 |  |

## A2. Plane-numbered platform-shape checks (plane R/G numbers that restate another module's behaviour at the platform's shape)

| path | proves | boots | own entry | latest | lines | notes |
|---|---|---|---|---|---|---|
| pl/corpus-r.test.mjs | plane corpus R set (G123d; R84 shape) | SH | S | control-plane | 32 | to 15m |
| pl/g123f-cells.test.mjs | plane R84 | SH | S | control-plane | 68 | to 10m |
| pl/g123f-workerd.test.mjs | plane G123f on workerd; calculations R1, content R52 | MF | W+S | - | 152 | to 15m |
| pl/g124f-bounds.test.mjs | plane G124f (sheet bounds; corpus R; no R named) | SH | S | control-plane | 79 | to 30m; alone/heavy |
| pl/g128i-over-24mib.test.mjs | plane G128i (files over 24 MiB; no R named) | SH | S | control-plane | 62 | to 60m; alone/heavy |
| pl/g41-shape.test.mjs | plane R84 | SH | S | control-plane | 77 | to 60m; alone/heavy |
| pl/g42-storage-seam.test.mjs | "R79" (module unstated; G42 stats gauge); op-declarations R81 | FX+index(node) | S+W | control-plane | 123 | imports plane index default in node + fixture Store |
| pl/g44-shape.test.mjs | plane R85 | SH | S | control-plane | 30 | to 30m; alone/heavy |
| pl/g48-classify.test.mjs | plane R86, docprofile R5,R19,R38 | SA | no | store-assembly | 127 | to 10m; SA only (store-assembly registerReaders): could live at store-assembly |
| pl/g54-l.test.mjs | plane R87 (ratification casefile-sweep on workerd) | MF-sub | W+S | ratification | 165 |  |
| pl/g55-alarm-l.test.mjs | plane R88 (calculations R14, scheduler R15) | MF-sub | W+S | notice-producers | 120 |  |
| pl/g57-heal.test.mjs | plane R89 (ratification R57, R6) | MF-sub | W+S | ratification | 89 |  |
| pl/l75.test.mjs | plane R75 | MF-sub | W+S | store-assembly | 63 |  |
| pl/l77-size.test.mjs | plane R77 | FX(child) | S | control-plane | 42 | to 30m; FX Store in capped child |
| pl/l77-traffic.test.mjs | plane R77 | MF-sub | W+S | store-assembly | 46 |  |
| pl/l77.test.mjs | plane R77 | MF-sub | W+S | store-assembly | 51 |  |
| pl/r10-filing-stall.test.mjs | plane R24 | MF-kit | W+S | screens-publish | 78 | to 10m; alone/heavy |
| pl/r10-lag-figure.test.mjs | plane R28b, extraction R111, store-assembly R78 | MF-kit | W+S | screens-publish | 100 | to 15m; alone/heavy; store-assembly R78 code "plane's until Wave B" |
| pl/r10-land-yields.test.mjs | plane R24 | MF-kit | W+S | screens-publish | 68 | to 15m; alone/heavy |
| pl/r10-nohome-filed-later.test.mjs | plane R25, plane R97, store-assembly R74 | MF-kit | W+S | screens-publish | 37 | alone/heavy |
| pl/r10-run-statements.test.mjs | plane R28b, store-assembly R78 | FX | S | control-plane | 77 | header: "the code is the plane's until Wave B" (store-assembly R78) |
| pl/r7-contention.test.mjs | plane R93 | MF-sub | W+S | store-assembly | 108 | to 15m; alone/heavy |
| pl/r8-headofline.test.mjs | plane G91 (reading tick vs slow consumer; R unstated) | MF-sub | W+S | store-assembly | 129 | to 15m; alone/heavy |
| pl/r8-lag.test.mjs | plane R105 | MF-kit | W+S | screens-publish | 34 | to 10m |
| pl/r8-wave.test.mjs | plane R105 | MF-kit | W+S | screens-publish | 89 | to 30m; alone/heavy |
| pl/r9-memory.test.mjs | plane R100, runtime-limits R32 | SH | S | control-plane | 42 | to 60m; alone/heavy |
| pl/shape-harness.test.mjs | plane G123a-c (harness self-test; R84) | SH | S | control-plane | 70 |  |

## B. Whole-plane proofs of another module's requirement (and legacy pre-module tests)

| path | proves | boots | own entry | latest | lines | notes |
|---|---|---|---|---|---|---|
| bp/cap13-reuse-pages.test.mjs | legacy CAP-13 (reuse floor counts pages; module unstated) | MF | W+S | subresources | 229 |  |
| bp/conclude-project.test.mjs | legacy conclude-project (negative controls; module unstated) | MF | W+S | queue-catalogue | 650 |  |
| bp/d526-refusal-order.test.mjs | legacy D-526; promotion R39 | MF | W+S | - | 267 |  |
| bp/d57selflink.test.mjs | legacy D-57 (resolveLinks self-link; module unstated) | MF | W+S | subresources | 170 |  |
| bp/d606-perpage-ocr.test.mjs | legacy D-606; extraction R103, reading-pipeline R55 | MF | W+S | reading-pipeline | 219 |  |
| bp/members.test.mjs | legacy members (membership R12, credentials R67 cited) | MF | W+S | - | 713 |  |
| bp/mk6-bundle-names-no-author.test.mjs | legacy MK-6 (publication R17 cited) | MF | W+S | ratification | 273 |  |
| bp/stats-disclosure.test.mjs | legacy REC-129 stats disclosure (membership R141 cited) | MF | W+S | - | 261 |  |
| bp/tier2-wire.test.mjs | legacy REC-98/D-283; text-chain R102 | MF | W+S | reading-pipeline | 565 |  |
| cp/limits.test.mjs | control-plane limits (installer R20) | cfg | cfg | control-plane | 29 | reads plane's wrangler.jsonc |
| cp/r10-caseratify-chain.test.mjs | ratification R60 (control-plane) | MF-kit | W+S | screens-publish | 41 | to 15m |
| cp/r100-upload.test.mjs | capture R92, control-plane R100, extraction R1,R20 | MF | W+S | control-plane | 150 |  |
| cp/r117-held.test.mjs | acquisition R96, control-plane R117, extraction R80 | MF | W+S | control-plane | 264 |  |
| cp/r118-shared.test.mjs | control-plane R118, project-roster R42, review R43 | MF | W+S | store-assembly | 84 |  |
| cp/r41-sweepset.test.mjs | control-plane R17,R29, link-sweep R13, link-sweep R13,R15 | MF-kit | W+S | screens-publish | 43 |  |
| cp/r8-bootstrap-fanout.test.mjs | control-plane G118 | MF-kit | W+S | screens-publish | 52 |  |
| cp/r8-caseratify-calls.test.mjs | control-plane G120, G121 | MF-kit | W+S | screens-publish | 55 | to 15m |
| cp/r8-door-phases.test.mjs | control-plane R129 | MF | W+S | control-plane | 158 |  |
| cp/r8-hops.test.mjs | control-plane G119 | MF-kit | W+S | screens-publish | 64 | to 10m |
| cp/r8-money-trail-hidden.test.mjs | control-plane R17,R29, money R12 | MF-kit | W+S | screens-publish | 35 | to 10m |
| cp/r8-words-door.test.mjs | control-plane R127 | MF-wrap | W+S | - | 114 | to 10m |
| cp/r8-wrap-entry.test.mjs | control-plane R-ONE (counting door self-test) | MF-wrap | W+S | - | 59 |  |
| cp/stats-capacity.test.mjs | control-plane R40 | MF | W+S | - | 72 |  |
| cp/t46-e2e.test.mjs | control-plane R75 | MF | W+S | screens-action | 229 |  |
| cp/t47-e2e.test.mjs | control-plane R81 | MF | W+S | screens-action | 301 |  |
| cp/t51-bootstrap.test.mjs | control-plane R122 | MF | W+S | screens-action | 129 |  |
| cp/t51-held-failed.test.mjs | control-plane R117, extraction R80, reading-pipeline R2 | MF | W+S | screens-intake | 143 | to 10m |
| cp/t51-hops.test.mjs | control-plane R121 | MF | W+S | - | 59 |  |
| cp/t51-large-pdfs.test.mjs | control-plane R120,R121 | MF | W+S | screens-intake | 109 | to 15m |
| cp/t51-reading-follows.test.mjs | plane R77, capture R103, control-plane R123 | MF | W+S | screens-intake | 143 | to 15m |
| cp/t51-round10-seam-csvprose.test.mjs | control-plane R100, csv-reader R26, csv-reader R7 | MF-kit | W+S | screens-publish | 37 |  |
| cp/t51-round10-seam-htmlparts.test.mjs | control-plane R100,R120,R123, control-plane R123, reading-pipeline R1 | MF-kit | W+S | screens-publish | 85 | to 15m |
| cp/t51-round10-seam-imported.test.mjs | citation R18 | MF-kit | W+S | screens-publish | 39 |  |
| cp/t51-round10-seam-observation.test.mjs | promotion R28, ratification R2 | MF-kit | W+S | screens-publish | 90 | to 15m |
| cp/t51-round10-seam-publishcheck.test.mjs | case-check R1, control-plane R17,R29 | MF-kit | W+S | screens-publish | 35 | to 15m |
| cp/t51-round5-press-seam.test.mjs | control-plane R125 | MF | W+S | screens-intake | 174 | to 10m |
| cp/t51-round5-seam.test.mjs | plane R77, control-plane R123,R125 | MF | W+S | screens-intake | 236 | to 10m |
| cp/t51-round6-seam.test.mjs | control-plane R105,R123,R124,R125 | MF | W+S | screens-intake | 290 | to 20m |
| cp/t51-round7-seam.test.mjs | control-plane R105,R123 | MF | W+S | screens-publish | 803 | to 20m |
| cp/t51-round8-seam.test.mjs | control-plane round 8 (G106-G116) | MF-kit | W+S | screens-publish | 16 | 16 lines; sections in control-plane's r8-seam-*.mjs |
| cp/walk-calc-tabledeclare.test.mjs | calculations R1,R51, control-plane R17,R29 | MF-kit | W+S | screens-publish | 48 | to 10m |
| cp/walk-cite-pdfpage-docx.test.mjs | content R62, control-plane R17,R29 | MF-kit | W+S | screens-publish | 48 | to 15m |
| cp/walk-consequences-escalation-end.test.mjs | basis-versions R18, consequences R27, consequences R5,R9,R27 | MF-kit | W+S | screens-publish | 80 | to 15m |
| cp/walk-contradiction-flag.test.mjs | contradiction R61, control-plane R17,R29 | MF-kit | W+S | screens-publish | 44 | to 10m |
| cp/walk-investigate-door.test.mjs | control-plane R17,R29, people R12, screens-investigate R33 | MF-kit | W+S | screens-publish | 105 | to 15m |
| cp/walk-monitoring-checknow-adopt.test.mjs | control-plane R17,R29,R123, monitoring R9,R79, monitoring R9,R79,R74 | MF-kit | W+S | screens-publish | 76 | to 15m |
| cp/walk-people-door.test.mjs | control-plane R17,R29, people R12, people R12andR21 | MF-kit | W+S | screens-publish | 94 | to 10m |
| cp/walk-photo-step.test.mjs | control-plane R17,R29 | MF-kit | W+S | screens-publish | 82 | to 15m |
| cp/walk-provenance-authority-taskdecide.test.mjs | control-plane R17,R29, provenance R80, tasks R20 | MF-kit | W+S | screens-publish | 77 | to 10m |
| cp/walk-publishcheck-held.test.mjs | case-check R1, control-plane R17,R29, store-request R19 | MF-kit | W+S | screens-publish | 63 | to 15m |
| cp/walk-selection-not-yours.test.mjs | control-plane R17,R29, retrieval R99 | MF-kit | W+S | screens-publish | 47 | to 10m |
| cp/walk-standards-paywalled.test.mjs | control-plane R17,R29, standards R41 | MF-kit | W+S | screens-publish | 55 | to 10m |
| cp/walk-tasks-filed-project.test.mjs | control-plane R17,R29, tasks R1 | MF-kit | W+S | screens-publish | 44 | to 10m |
| cp/walk10b-docket.test.mjs | control-plane R17,R29, docket R1,R4, docket R4 | MF-kit | W+S | screens-publish | 55 | to 15m |
| cp/walk10b-recreate.test.mjs | case-disclosures R15, control-plane R17,R29 | MF-kit | W+S | screens-publish | 65 | to 15m |
| m/affordances/door-events.test.mjs | affordances R39 | MF | W+S | affordances | 81 |  |
| m/affordances/plane.test.mjs | affordances R13-R23 (admission R20, plane R8 cited) | MF | W+S | affordances | 1018 |  |
| m/capture-requests/plane.test.mjs | capture-requests R16, R30, R31 | MF-copy | W+S | capture-requests | 331 |  |
| m/capture/g41b-plane.test.mjs | capture R107 (G41) | MF | W+S | - | 92 |  |
| m/capture/plane.test.mjs | capture (T42/T43 moved ops) | MF | W+S | capture | 90 |  |
| m/capture/r7-upload-plane.test.mjs | capture R103 (G79) | MF | W+S | - | 73 | to 10m |
| m/host-governor/ops.test.mjs | host-governor R18, R19 | MF | W+S | host-governor | 386 |  |
| m/instance-setup/reports.test.mjs | instance-setup R3, R10, R11, R17-R19 | MF | W+S | instance-setup | 289 | to 10m |
| m/instance-setup/worker-reports.test.mjs | instance-setup R17-R19, R33-R42 | MF | W+S | instance-setup | 215 |  |
| m/lines/invariants.test.mjs | lines R18-R20 | src-scan | no | lines | 122 | reads every src/ dir (text census), boots nothing |
| m/office-readers/r46-memory.test.mjs | office-readers R46 | runs SH probe | S (child) | office-readers | 109 | to 30m; runs plane's shape/g41.probe.mjs as a child process |
| m/reevaluation/r14-regrade-door.test.mjs | reevaluation R41 (amends R14) | MF | W+S | setup-words | 223 | to 10m |
| m/scheduler/invariants.test.mjs | scheduler R14, R18-R20, R28, R29 | cfg | cfg | scheduler | 65 | reads plane's wrangler.jsonc crons |
| m/scheduler/plane.test.mjs | scheduler R5, R8, R9, R12 | MF-copy | W+S | jurisdictions | 337 |  |
| m/screens-daily/c25-seam.test.mjs | screens-daily C25 | MF | W+S | screens-daily | 203 | to 15m |
| m/screens-daily/casedrafts-seam.test.mjs | screens-daily G12c | MF | W+S | screens-daily | 129 | to 10m |
| m/screens-inquiry/fr5-seam.test.mjs | screens-inquiry R81 (citation R21, extraction R80) | MF | W+S | screens-inquiry | 169 |  |
| m/screens-inquiry/fr6-seam.test.mjs | screens-inquiry R81 (G6, G12, G13) | MF | W+S | screens-inquiry | 193 |  |
| m/screens-inquiry/g41-document.test.mjs | screens-inquiry R44, R81 (G41) | MF | W+S | screens-inquiry | 142 |  |
| m/screens-inquiry/r10-question-seam.test.mjs | screens-inquiry R81 (G6) | MF | W+S | screens-inquiry | 141 |  |
| m/screens-inquiry/r10-stated.test.mjs | screens-inquiry R1, R10, R133 (ocr-worker R32) | MF | W+S | screens-inquiry | 263 |  |
| m/screens-inquiry/r9-refusal.test.mjs | screens-inquiry R130 (ocr-worker R32) | MF | W+S | screens-inquiry | 85 |  |
| m/screens-inquiry/r9-seam.test.mjs | screens-inquiry R130, R131 | MF | W+S | screens-inquiry | 114 |  |
| m/screens-intake/r10-held-paging.test.mjs | screens-intake R4, R33 cause (G6) | MF-realplane | W+S | screens-intake | 105 |  |
| m/screens-intake/r10-open-file.test.mjs | screens-intake R68 (file-safety R56) | MF | W+S | screens-intake | 74 |  |
| m/screens-intake/r10-pending.test.mjs | screens-intake R65 (control-plane R135) | MF-realplane | W+S | screens-intake | 62 |  |
| m/screens-intake/r10-refused-kind.test.mjs | screens-intake R64 | MF-realplane | W+S | screens-intake | 48 |  |
| m/screens-intake/t51-seam-e7.test.mjs | screens-intake E7 (T51) | MF | W+S | screens-intake | 114 |  |
| m/screens-intake/t51-seam-g126h.test.mjs | screens-intake R61 (control-plane R131, plane R97) | MF | W+S | screens-intake | 110 |  |
| m/screens-publish/door-seam.test.mjs | screens-publish G12c | MF | W+S | screens-publish | 67 |  |
| m/store-assembly/sa-assembly.test.mjs | store-assembly R1, R4, R5, R7, R8, R96-R99 | SA | no | store-assembly | 281 | imports reach store-assembly and earlier only; reads build/modules.json; why plane owns it: unknown |

## C. Helpers, kits, entries, generators (not tests; never run as tests)

| path | proves | boots | own entry | latest | lines | notes |
|---|---|---|---|---|---|---|
| cp/r8-kit.mjs | control-plane seam kit | MF-kit | W+S | screens-publish | 316 | not run (.mjs) |
| cp/wrap-entry.mjs | control-plane counting-door reader | MF-wrap | W+S | - | 78 | not run (.mjs); worker text wrap-entry.worker.txt (control-plane's) names plane index by path |
| m/capture-requests/plane-world.mjs | capture-requests kit (run-rules R19) | MF-copy | W+S | - | 62 | not run (.mjs) |
| m/screens-intake/realplane.mjs | screens-intake kit | MF | W+S | screens-intake | 76 | not run (.mjs) |
| pl/corpus-r-cases.mjs | corpus R cases (G123d) | other | no | setup-words | 95 | not run (.mjs) |
| pl/fixture.mjs | plane R1 (Store over node:sqlite) | FX | S | control-plane | 115 | not run (.mjs) |
| pl/g48-corpus.mjs | plane R86 corpus | SA | no | store-assembly | 28 | not run (.mjs) |
| pl/g54-l-entry.mjs | plane R87, R102 (entry) | MF-sub | W+S | ratification | 84 | not run (.mjs) |
| pl/g54-seed.mjs | plane R87/R89 seed (G54, G57) | FX | S | publication | 82 | not run (.mjs) |
| pl/g55-alarm-l-entry.mjs | plane R88 (entry) | MF-sub | W+S | notice-producers | 95 | not run (.mjs) |
| pl/g57-heal-entry.mjs | plane R89 (entry) | MF-sub | W+S | ratification | 43 | not run (.mjs) |
| pl/g83-entry.mjs | plane R95 | MF-sub | W+S | - | 29 | not run (.mjs) |
| pl/l75-entry.mjs | plane R75 | MF-sub | W+S | store-assembly | 85 | not run (.mjs) |
| pl/l77-size-child.mjs | plane R77 | FX(child) | S | control-plane | 96 | not run (.mjs) |
| pl/l79-entry.mjs | plane R79 | MF-sub | W+S | store-assembly | 51 | not run (.mjs) |
| pl/make-g48-plane-answers.mjs | plane R86 (one-off generator of g48 answers) | SA | no | store-assembly | 28 | not run (.mjs) |
| pl/maps.mjs | plane R5 (each module's ops map) | FX | S | store-assembly | 244 | not run (.mjs) |
| pl/r10-entry.mjs | plane R24 b2, R28b (entry) | MF-sub | W+S | store-assembly | 29 | not run (.mjs) |
| pl/r42-entry.mjs | plane R42, hypotheses R23 | MF-sub | W+S | - | 78 | not run (.mjs) |
| pl/r7-contention-entry.mjs | plane R93 | MF-sub | W+S | store-assembly | 86 | not run (.mjs) |
| pl/r8-headofline-entry.mjs | plane G91 (entry) | MF-sub | W+S | store-assembly | 93 | not run (.mjs) |
| pl/r8-wave-kit.mjs | plane R105 (shared world) | MF-kit | W+S | screens-publish | 72 | not run (.mjs) |
| pl/shape/bars.mjs | shape harness bars (G123b) | other | no | reading-pipeline | 43 | not run (.mjs) |
| pl/shape/cap.mjs | shape cap (runtime-limits R33/R34) | other | no | runtime-limits | 7 | not run (.mjs) |
| pl/shape/exact-gen.mjs | G124f generator | other | no | setup-words | 79 | not run (.mjs) |
| pl/shape/g44-gen.mjs | G44 generator | other | no | setup-words | 54 | not run (.mjs) |
| pl/shape/harness.mjs | plane R84 shape harness (E3) | SH | S | control-plane | 473 | not run (.mjs) |
| pl/shape/reading-judge.mjs | G124f/G128i assertions | other | no | - | 26 | not run (.mjs) |

## D. Odd ones (agent-worker, roster-reader fixture, probes, system/, sections run elsewhere, test-infrastructure checks)

| path | proves | boots | own entry | latest | lines | notes |
|---|---|---|---|---|---|---|
| agent-worker/test/agent-worker.test.mjs | agent-worker own estate (I8; FL-1); one section boots the real plane | MF | W+S | agent-worker | 745 | same dual listing |
| agent-worker/test/harness.test.mjs | agent-worker FL-3/IS-9 run harness; section R on real plane | MF-copy | W+S | agent-worker | 1879 | same dual listing |
| agent-worker/test/plane-world.mjs | agent-worker kit (ai-runs R75 test bar) | MF-copy | W+S | agent-worker | 61 | not run (.mjs) |
| agent-worker/test/requirements.test.mjs | agent-worker R1-R49 (build/requirements numbering) | MF | W+S | agent-worker | 1526 | also listed under agent-worker/test/ dir (plane names file; more specific wins) |
| agent-worker/test/versions.test.mjs | agent-worker versions (D-220 controls) | MF | W+S | agent-worker | 350 | same dual listing |
| bp/system/migrate-released.test.mjs | store-assembly R3 via whole plane (ARCH: plane's; REC-143) | MF | W+S | - | 544 | git show of releases; ARCH: to captured stores |
| bp/system/pdf-worker-binding.test.mjs | legacy I6/CPDF-6 (pdfstructure to pdf-worker binding) | MF | W+S | pdf-worker | 158 |  |
| cp/r9-seam-documents.mjs | control-plane round 9 seam sections | MF-kit | W+S | screens-publish | 709 | to 15m; not run (.mjs); sections of journey-check's t51-round9-seam.test.mjs |
| cp/r9-seam-hostile.mjs | control-plane round 9 section 18 | MF-kit | W+S | screens-publish | 134 | to 15m; not run (.mjs); same |
| cp/r9-seam-parts.mjs | control-plane round 9 sections 10-13 | MF-kit | W+S | screens-publish | 383 | to 20m; not run (.mjs); same |
| cp/r9-seam-reading.mjs | control-plane round 9 sections 1-3, 9 | MF-wrap | W+S | screens-intake | 715 | to 15m; not run (.mjs); same |
| cp/r9-seam-safety.mjs | control-plane round 9 sections 16-18 | MF-kit | W+S | screens-publish | 233 | to 15m; not run (.mjs); same |
| m/interface-shell/page-contention.probe.mjs | interface-shell R126 (probe) | workerd(spawn) | no (interface-shell) | interface-shell | 75 | alone/heavy; not run (.mjs); boots workerd on interface-shell, not plane; why plane owns it: unknown |
| pl/deployed-alarm-request-check.mjs | plane B95 (deployed-copy check; K5178) | deployed copy | no | - | 39 | alone/heavy; not run (.mjs) |
| pl/g123h-preload.test.mjs | plane G123h (npm test and module runner share the sqlite preload) | spawn node | no | - | 34 | reads package.json/test runner; boots nothing |
| pl/g55-L.probe.mjs | plane G55 probe (money ingest; not run by suite) | MF-copy | W+S | - | 137 | alone/heavy; not run (.mjs) |
| pl/shape/fault.probe.mjs | shape harness broken-stub probe | SH | S | control-plane | 10 | not run (.mjs) |
| pl/shape/g13.probe.mjs | G13 probe | SH | S | control-plane | 10 | not run (.mjs) |
| pl/shape/g15.probe.mjs | G15 probe | SH | S | control-plane | 14 | not run (.mjs) |
| pl/shape/g26.probe.mjs | G26 probe | SH | S | control-plane | 50 | not run (.mjs) |
| pl/shape/g41.probe.mjs | G41 probe (plane R84; run by g41-shape and office-readers R46) | SH | S | control-plane | 123 | not run (.mjs) |
| pl/shape/g44.probe.mjs | G44 probe (plane R85; run by g44-shape) | SH | S | control-plane | 89 | not run (.mjs) |
| pl/shape/keep40.probe.mjs | 40 MB keep probe (2a-5) | SH | S | control-plane | 11 | not run (.mjs) |
| roster-reader/test/fixtures/capture.mjs | roster-reader R9 (how its fixture was made) | MF | W+S | pdf-worker | 50 | not run (.mjs) |

## Grouped counts

plane.json `tests` names 105 paths; the directory `pl/` expands to 88 `.mjs` files (plus 3 fixture data files, not listed), so the map has 192 files, of which 147 are `.test.mjs` (the required run's ~147 files).

| group | files | `.test.mjs` | lines | `.test.mjs` by own entry needed |
|---|---|---|---|---|
| A1 composition root | 27 | 27 | 2,979 | S 17, W+S 6, S+W 1, door 1, cfg 1, no 1 (g83-census) |
| A2 plane-numbered platform checks | 27 | 27 | 2,158 | W+S 15, S 10, S+W 1, no 1 (g48-classify) |
| B other modules' proofs | 86 | 86 | 14,199 | W+S 81, cfg 2, no 2, S in child 1 |
| C helpers/kits | 28 | 0 | 2,647 | (not run) |
| D odd ones | 24 | 7 | 8,079 | W+S 6, no 1 (g123h-preload) |
| total | 192 | 147 | 30,062 | W+S 108, S 27, S+W 2, door 1, cfg 3, S in child 1, no 5 |

B by the folder (module) the test was written for: control-plane 46 (the walker's cases through the real door: control-plane R17/R29 and R100-R135 and G-items, about half naming another module's requirement as the cause: calculations, consequences, contradiction, content, citation, docket, monitoring, people, provenance, tasks, standards, retrieval, ratification, case-check, case-disclosures, csv-reader, link-sweep, money), legacy root `bp/*.test.mjs` 9, screens-inquiry 7, screens-intake 6, capture 3, affordances 2, instance-setup 2, scheduler 2, screens-daily 2, capture-requests 1, host-governor 1, lines 1, office-readers 1, reevaluation 1, screens-publish 1, store-assembly 1.

Plane's own code truly needed (by `.test.mjs`): 138 of 147 load plane code (108 the Worker entry and Store under Miniflare/workerd, 27 the Store class in node, 2 Store plus the entry's default in node, 1 `door.mjs`); 1 more runs plane's shape probe as a child (office-readers R46). 3 read only plane's `wrangler.jsonc` (pl/limits, cp/limits, m/scheduler/invariants). 5 load no plane code at all: pl/g48-classify (store-assembly `registerReaders` only), m/store-assembly/sa-assembly (store-assembly and earlier only), m/lines/invariants (text scan of `src/`), pl/g83-census (text scan of `src/`), pl/g123h-preload (reads the test runner and package.json).

Of the 27 `S` tests, the 17 in A1 test the Store's own surface (R1, R4, R5, R6 hooks, R36, R78, R96, R99, R102, R103, R111, R114). Whether the 10 in A2 need the `Store` class or only the store `assembleStore` builds (pl/fixture.mjs already exports `assembledOver`, an `assembleStore` call) was not checked test by test: unknown. Two A2 headers say the code they prove is "the plane's until Wave B" while numbered `store-assembly` R78 (pl/r10-run-statements, pl/r10-lag-figure).

Not run by plane's required run although plane owns them: the five `cp/r9-seam-*.mjs` sections are imported by journey-check's `cp/t51-round9-seam.test.mjs`; probes and entries are never run as tests.

Shared kits other modules own, used by plane's tests: control-plane's `cp/` folder files not named in plane.json (`register-declared.mjs`, `declared-ops.mjs`, `wrap-entry.worker.txt`, `r8-seam-capture.mjs`, `r8-seam-misc.mjs`, the counting door's worker text, which names plane's `src/plane/index.mjs` by path as text), interface-shell's `harness.mjs`, store-assembly's `fixture.mjs`, test-support's `sandbox.mjs`, generators and `platform-sqlite.mjs`.

Dual listing: `agent-worker.json` lists the directory `agent-worker/test/`; plane.json names four files in it. The more specific path wins, so they are plane's.

## The twelve owed pieces

ARCH's decision "Module list: order and ownership" says twelve pieces of code work "are owed to named modules' jobs, and are placed once jobs run". The numbered list itself was not found: not in `process/decisions-arch.md`, `process/waiting-for-arch.md`, `process/ranking.md`, any `process/modules/*.md`, `process/lanes/`, the body of PR #1128 (the module-list PR; its body is the tool's one line), or `/root/process4`. It is probably in ARCH's session: unknown. What git history shows of it (commit subjects and one code comment):

| item | what | where it landed |
|---|---|---|
| 2 | answers' declared-ops test returns to answers | answers job: "the declarations test reads the module order up to answers" (ad925708); list PR #1184 (cba794d4, out of store-assembly.json) |
| 3 | monitoring's declared-ops test returns to monitoring | monitoring R78 "declared-ops test reads declarations only up to monitoring" (e01b5f2c); list PR #1205 (4d95d093, out of store-assembly.json) |
| 6 | queue's and case-import's declared-ops tests return to their modules | queue (333ddeb7), case-import (4822d511, "prove only R33's own declaration"); list PR #1207 (5531d437, out of op-declarations.json) |
| 11b | budget-doctypes' fixture builder `budget-doctypes/test/fixtures/build.mjs` returns to budget-doctypes | list PR #1175 (9bc81882, out of pdf-worker.json) |
| 12 | agent-worker's `cascade.test.mjs`, `t35.test.mjs`, `requirements.test.mjs` return to agent-worker | agent-worker job: `agent-worker/test/published.mjs` holds the published token so its tests read no plane file (1835f077, "Owed item 12, this module's part"); list PR #1191 (c3e77c8d, out of plane.json); then `requirements.test.mjs` went back to plane, "it boots the plane" (PR #1203, 8b8de56c) |
| 1, 4, 5, 7, 8, 9, 10, 11 (11a) | unknown | no commit names them |

None of the known items is a plane test that boots the whole plane, except item 12's `requirements.test.mjs`, which returned to plane. The other three agent-worker tests plane still holds (agent-worker, harness, versions) were not part of item 12's move.

## Order facts

From `process/modules/order.txt` (204 modules):

- `test-support` 9, `agent-worker` 110, `scheduler` 152, `store-services` 173, `store-assembly` 174, `store-request` 175, `interface-assets` 176, `interface-shell` 177, `screens-entry` to `screens-action` 178-194 (17 parts), `control-plane` 195, `plane` 196, `release` 197, `journey-check` 204 (last).
- So store-assembly comes before plane, 22 places earlier. Between them: store-request, interface-assets, interface-shell, the 17 screens parts, control-plane.
- `src/plane/store.mjs` imports store-assembly, scheduler, ai-runs, public-read and control-plane (`deliverOwedRender`); `src/plane/index.mjs` imports store-assembly, control-plane (`makeFetch`), answer-envelope, public-read's `publication/worker.mjs`, instance-setup's `setup.mjs`, and plane's `door.mjs`, `watchdog.mjs`, `arrival.mjs`. plane's own code is five files, 371 lines.
- A test that boots through `assembleStore` alone (no door) can sit at store-assembly (174) if it imports nothing later; pl/g48-classify and m/store-assembly/sa-assembly already reach nothing later than store-assembly.
- A test that boots through `assembleStore` plus control-plane's door (`makeFetch`) must sit at control-plane (195) or later. A new module just before plane would be after control-plane, so it could hold such tests. But `makeFetch` takes its arms from the hooks plane's `door.mjs` supplies (`publicOp`, `gatedOp`, `publicInstanceGroup`); without plane's `door.mjs` the door has no store arms, so such a test needs either plane's `door.mjs` or a stand-in.
- Under Miniflare a test needs a Worker module with a Durable Object class. The only one in the product is plane's `index.mjs` + `Store`. Every `MF*` test (108 `.test.mjs`: 6 A1, 15 A2, 81 B, 6 D) therefore needs plane's own entry as written, unless a test-only entry outside plane composed the same pieces; that would test a copy, not the deployed plane.
- The kits that reach furthest before plane: control-plane's seam kit (`cp/r8-kit.mjs`) reaches screens-publish (192); `cp/t46-e2e`, `cp/t47-e2e`, `cp/t51-bootstrap` reach screens-action (194); screens-intake's and screens-inquiry's kits reach their own module and interface-shell. None reaches a module after plane.

Strictly need plane's `Store` class or Worker entry (`src/plane/`), by `.test.mjs`: 138 (108 W+S, 27 S, 2 S+W, 1 door). They need plane's own code but could, by imports alone, sit earlier: none, since all load `src/plane/`. They need no plane code and could sit earlier: 5 (g48-classify and sa-assembly at store-assembly; lines/invariants, g83-census, g123h-preload are text or config checks whose placement depends on what they read). 3 read only plane's `wrangler.jsonc`.

## Gaps and things not found

- The full list of ARCH's twelve owed pieces (items 1, 4, 5, 7-11a): not in the repository.
- Why `m/store-assembly/sa-assembly.test.mjs` and `m/interface-shell/page-contention.probe.mjs` are plane's: unknown (imports do not reach plane).
- Per-test counts (the ~591 tests) were not computed. Legacy root tests use their own test helpers and were not counted.
- "Proves" for legacy root tests and some kits is taken from headers, which name legacy ids (D-57, CAP-13, MK-6, REC-129) and not a module: the module is unknown where the table says so.
- Import tracing reads static text. Code that builds a path at run time from pieces (for example `join(SRC_DIR, "plane", "index.mjs")`) was caught by text search; anything less direct could be missed.
