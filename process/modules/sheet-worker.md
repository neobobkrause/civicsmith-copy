Length: 66 lines. Last section: "Suggestions".

# sheet-worker: requirements

Next number: 18

**Size (P6).** About 800–1,200 lines with tests, plus the vendored wasm (about 2.3 MB raw), which is a generated artifact (PROCESS-MECHANICS §14).

## Public

### Purpose

A standalone Cloudflare Worker, reached only through the plane's `SHEET_WORKER` service binding. Given a capture's sha and a store namespace, it reads a captured `.xlsx` workbook from R2 itself, recomputes every formula with a pinned build of the IronCalc engine, and answers each formula cell's recomputed value with the engine's version. Otherwise it gives a named refusal, saying the workbook is not recomputed here and why. It compares nothing with the file's cached values, holds no record and writes nothing. Until an administrator enables it after the release, it answers every recompute request with "not enabled".

### Provides

**POST /recompute**: body `{capture_sha, store}` → `{ok, ...}`.
- **R1** [met] Request checks, as `ocr-worker` R1–R3 and R5: `capture_sha` exactly 64 hex characters (lower-cased) or `BAD_SHA` (400); `store` a string or `BAD_STORE` (400); `store` exactly `"bio"` or `"scratch"` or `NAMESPACE_UNKNOWN` (400), before R2 is addressed; no `CAPTURES` binding gives `R2_NOT_CONFIGURED` (503); no bytes at `${store}/captures/${sha}` gives `NOT_FOUND` (404).
- **R2** [met] Inactive until enabled: unless the instance setting `SHEET_RECOMPUTE` is exactly `"on"`, every well-formed request is answered `NOT_ENABLED` (200, `ok: false`) before any bytes are read. The member's committed configuration sets it off; an administrator turns it on after the release deploys the member (K1501).
- **R3** [met] A workbook is refused, in this order, the first that applies being the one reported, each `200` with `ok: false`, `not_recomputed: "not recomputed here"` and `why`: 1. `ENGINE_ABSENT`: the wasm did not load as the pinned build (R13); 2. `NOT_A_WORKBOOK`: the bytes are not an OOXML spreadsheet container; 3. `OVER_BOUND`: its unzipped size exceeds `MAX_UNZIPPED_BYTES` or its cells exceed `MAX_CELLS`, naming the measured value and the bound; 4. `EXTERNAL_LINKS`: it has an external-link part, or a formula or defined name that refers to another workbook, naming how many; 5. `ENGINE_FAILED`: the engine refused or threw while loading or evaluating, with the engine's own message; 6. `TIME_LIMIT`: loading took longer than `TIME_BUDGET_MS`, so evaluation was not started.

  Checks 2–4 run before the engine loads the workbook.
- **R4** [met] A recomputed workbook answers `ok: true` with `engine` (`"ironcalc"`), `engine_version` (the pinned commit), `wasm_sha256`, `macros_present`, `counts` (`formula_cells`, `errors`, `volatile`), `notes`, and `cells`: one entry per formula cell, in sheet then row then column order, `{source, formula, value, type, error?, cause?, volatile}`. `source` is the cell's `sheet-cell` reference in `office-readers`' form (its R17), so a caller can pair it with that cell's cached value. `value` is the engine's result, a number written as the shortest decimal that reads back to the engine's value, never rounded further.
- **R5** [met] A cell whose result is an error value has `type: "error"`, `error` the engine's code (`#VALUE!`, `#N/A`, `#NAME?`, `#CIRC!`, `#N/IMPL!`, …) and `cause`: `unsupported_function` (the formula names a function the engine does not hold, named), `implicit_intersection` (an `@` over a range), `circular` (a circular reference, as an iterating workbook gives), `not_implemented`, or `undetermined`. The answer marks each such cell "not recomputed here" and never calls it a disagreement.
- **R6** [met] A cell whose formula calls a volatile function (`NOW`, `TODAY`, `RAND`, `RANDBETWEEN`, `OFFSET`, `INDIRECT`, `CELL`, `INFO`) is marked `volatile: true`.
- **R7** [met] Macros are never run. A workbook carrying a VBA project is recomputed by its formulas alone, with `macros_present: true` and a note saying so.

**GET /version** → `{ok: true, name: "sheet-worker", version, engine, engine_version, wasm_bytes, wasm_sha256, engine_loaded, engine_unavailable?, enabled, bounds: {max_unzipped_bytes, max_cells, time_budget_ms}}`.
- **R8** [met] `version` is read from the running build's `env.VERSION`. `engine_loaded` is asked, never assumed (R13), and `engine_unavailable` says why when it is false. `enabled` is R2's state. `bounds` are the limits R3 applies.

**Any other method or path**
- **R9** [met] Refused `{ok: false, reason: "UNKNOWN"}` with HTTP 404.

## Private

### Uses

- `bundler`: `writeMember` (the member's artifact and manifest, with the wasm's hash, as `ocr-worker`'s), and `verifyFresh`.
- `runtime-limits`: `makeMeter` for the time measured against `TIME_BUDGET_MS` (R3), `sha256hex`.
- `test-support`: the fleet member's test harness and fixtures.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R10** [met] Writes nothing: no write or delete call on any binding appears in its sources; it holds no Durable Object or `PUBLISHED` binding; the bucket is unchanged after any sequence of calls (as `ocr-worker` R15).
- **R11** [met] The namespace set is exactly `["bio", "scratch"]`, fixed in its source and exported frozen as `NAMESPACES`, with `PLANE_OPS` (empty) for `control-plane` to pin (as `ocr-worker` R16, R22).
- **R12** [met] The answer is a function of the workbook's bytes, the pinned engine and the instance settings (`SHEET_RECOMPUTE`, the bounds); no state is kept between calls; the only read is `CAPTURES.get`; no other network or storage call is made.
- **R13** [met] The engine is IronCalc built from a pinned commit with its `xlsx` feature (the npm package cannot read XLSX), vendored in the member's `assets/`, its byte length and SHA-256 fixed constants, and its bytes pinned by the bundle manifest (bundler R4). The member checks before any workbook that the wasm loaded as a compiled `WebAssembly.Module` of that length, and otherwise refuses `ENGINE_ABSENT`.
- **R14** [met] `MAX_UNZIPPED_BYTES`, `MAX_CELLS` and `TIME_BUDGET_MS` are fixed constants measured at the job on the deployed runtime's limits, and the member's configuration declares its CPU limit (bundler R15). A workbook above a bound is refused, never partly recomputed. (Fix round 9, G137e; K4831 (10), K4835 (1)) The values are 9,000,000 bytes (`MAX_UNZIPPED_BYTES`), 250,000 cells (`MAX_CELLS`) and 120,000 ms (`TIME_BUDGET_MS`), as measured at T33-18; each is a `READ_BOUNDS` row read through `boundOf` (`runtime-limits` R29-R31) and typed nowhere else in the member, `/version`'s `bounds` (R8) states them, and `workbooks` holds its cells bound equal to `MAX_CELLS` (its R20). Test: the three constants equal the table's rows and a grep over the member's source finds no numeric literal for them; control: a workbook of exactly 250,000 cells is not refused `OVER_BOUND` for its cells and one cell over is.
- **R15** [met] Tested on corpus workbooks (`measures-T33/courts-workbooks.md` §3): workbooks with no external links that agree whole, give every value equal to the cached one (numbers to a relative 1e-9); one fixture per refusal (an external link, over a bound) and per `cause` (`HYPERLINK`, an `@` range, an iterating workbook, array-lifted `TRIM` in `SUMPRODUCT`). The job re-measures cell and workbook agreement on the 111 link-free workbooks with this build and records the figures for `workbooks`' method note.
- **R16** [met] No place is named in this module's behaviour; the same bytes and settings give the same answer in any instance.
- **R17** [met] (N621; K1686; `installer` R20's model) The member states its limits in its own bundle, so the signed release's bytes cover them: exactly one distinct string `bio-member-limits/1 <key>=<positive integer> …`, one pair per key of its configuration's `limits` (keys sorted, single spaces), which survives bundling as written and equals that configuration: today `bio-member-limits/1 cpu_ms=300000` (K1536).

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §8.3 L3; §8.4 L3 (a fleet Worker on the `ocr-worker` precedent, inert until DIST deploys it; volatile functions flagged; macros never run; external links refused; "not recomputed here"; agreement between two engines, not accuracy, D110); §8.5 L4 (the workbook route for oversized work).
- `BIO_Distribution_v0_1.md` (whole): the fleet-member rules (writes nothing; versions on its own; `/version` reports the running build).
- Plan T33, "Measured GO (K1506)", entry T33-18 and "The release at T33's close"; rulings K1448, K1501, K1506.

### Suggestions

- **Bounds.** The measure points at starting values: the heaviest corpus files (10.4 MB unzipped, about 20,000 formulas) took 54 s natively, and wasm is slower, so a bound near 4 MB unzipped or 200,000 cells, with the paid 5-minute CPU limit, was a reasonable start; the job measured and fixed them, and R14 states the values.
- **Time.** A Worker cannot stop wasm evaluation partway. R3's `TIME_LIMIT` is checked between load and evaluation, and the CPU limit ends a run that goes over. The plane answers a dropped call as "not recomputed here" (`workbooks`).
- **Build.** Building the wasm needs a Rust toolchain in the bundler path, or a vendored, hashed wasm with the build command named in `build/manifest.md`. The latter fits §14. Choices settled (K1504) say the bundler's member list takes `sheet-worker` where it is code. The bundler job's START names that.
- **The setting name** `SHEET_RECOMPUTE` and its value are this draft's. The release step that turns it on belongs in the release checklist (K1501).
- External links are found in `xl/externalLinks/` parts and in `[n]`-prefixed references, which `office-readers` already reports as `external_workbook` (its R9).
