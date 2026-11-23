Length: 47 lines. Last section: "What I did not check".

# Stage 2, program code: the import graph joined to the layer map

Written 23 Nov 2026 by civicsmith plane-scope lane #1 (the lane's own measurement, not a worker's). Evidence rules: `evidence-rules.md`.

## Method

[MEASURED] `node process/lanes/plane-scope/research/tools/stage2-join.mjs` builds the plane's program in memory with esbuild (entry `bio-plane/src/plane/index.mjs`, `write: false`), takes the import edges from esbuild's own metafile, gives each file the layer `layers/layers.json` gives its module (a mixed module's file takes the layer of the part that lists it), and writes `stage2/layer-edges.json`. Output: `files 853, edges 3921`. The same totals were measured separately by the build worker (`14-build-and-run.md`: 853 inputs, 3,921 edges). No file fell in a mixed module without a listed part (`mixed-unlisted` absent from `filesByLayer`).

Files by layer [MEASURED]: model 612, UI 130, middleware 56, shared foundation 42, fleet member 5, control plane 4, launcher 4.

An edge runs "against" a stacking when the importing file's layer is lower than the imported file's. Wanted stacking, lowest first: shared foundation, model, middleware, control plane, launcher, UI. Today's: shared foundation, model, middleware, UI, control plane, launcher.

## Edges against the wanted stacking: 45 of 3,921 [MEASURED]

| from -> to | edges | module pairs |
|---|---|---|
| control plane -> UI | 13 | 12 |
| model -> middleware | 19 | 16 |
| shared foundation -> model | 12 | 8 |
| middleware -> control plane | 1 | 1 |

Against today's stacking the same list less the 13 (32 edges).

**control plane -> UI (13).** The door's imports listed in `11-door-and-launcher.md` (T01 to T17).

**model -> middleware (19).** Eleven are inside one module, a model file importing the same module's handler file: `attestation/index.mjs -> attestation/ops.mjs`; `capture/index.mjs -> capture/ops.mjs`; `doorbell/index.mjs -> doorbell/door.mjs`; `ratification/index.mjs -> ratification/ops.mjs`, `-> ratification/finding.mjs`, `-> ratification/casefile.mjs` (twice); `affordances.mjs -> affordances/door.mjs`; `setup.mjs -> livefire.mjs` (instance-setup); `signin-door/ops.mjs -> signin-door/index.mjs`; `admission/window.mjs -> admission/index.mjs`. Eight cross modules: `extraction/index.mjs`, `doorbell/index.mjs` and `file-safety/index.mjs -> capture/ops.mjs`; `ratification/index.mjs -> publication/worker.mjs`; `tasks/index.mjs`, `queue/index.mjs`, `setup.mjs` (instance-setup) and `store-assembly/pending.mjs` (store-services) `-> scheduler/index.mjs`.

**shared foundation -> model (12).** All from `skills` (`skilldoctrine.mjs`, `skillpack.mjs`) into observation-log, strength, run-productions, basis-versions, inquiry-grammar, reading-guides, run-rules and contradiction. `10-layers.md` placed `skills` as a shared foundation by its rule P (who imports it); by what it imports it is not below the model. INFERENCE: `skills` belongs with the model; re-running the placement with `skills` as model would remove these 12.

**middleware -> control plane (1).** `plane/door.mjs -> control-plane/index.mjs`: `10-layers.md` counts `plane/door.mjs` as middleware (it says which handler answers which op).

The 19, the 12 and the 1 depend on the working definitions of `10-layers.md` (the scheduler and each module's door-side handler file counted as middleware; rule P). The 13 do not: they cross from the door's router files into files of modules 176 to 194 under any of the definitions considered.

## The whole matrix [MEASURED]

model -> model 2298; model -> shared foundation 712; middleware -> model 409; UI -> UI 188; middleware -> middleware 68; shared foundation -> shared foundation 65; middleware -> shared foundation 56; model -> middleware 19; control plane -> middleware 17; control plane -> UI 13; shared foundation -> model 12; control plane -> model 11; UI -> shared foundation 10; UI -> middleware 6; control plane -> shared foundation 6; launcher -> middleware 6; fleet member -> shared foundation 4; model -> fleet member 3; fleet member -> fleet member 3; control plane -> control plane 3; launcher -> model 3; launcher -> launcher 3; UI -> model 2; launcher -> control plane 2; middleware -> control plane 1; launcher -> shared foundation 1.

Read off it [MEASURED]: no model file and no middleware file imports a UI file or a launcher file; no UI file imports a control-plane or launcher file; UI files import model files twice and middleware files six times.

## What I did not check

- Tests: this is the program's code only (the 853 files the entry reaches). The tests half waits for `09-graph.md`.
- References that are not imports (evidence rule 7): those are in `11-door-and-launcher.md` and `12-ui-below-and-above.md`, not in this join.
- Code outside the plane's program (fleet members, installer, site, tooling).
- The placements themselves: this join inherits every limit `10-layers.md` states.
