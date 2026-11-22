Length: 143 lines. Last section: "Suggestions".

# runtime-limits: requirements

Next number: 37

## Public

### Purpose

Two runtime facts a Worker cannot get any other way. `cpu.mjs` measures what a capture spends in CPU:
Cloudflare freezes `Date.now()` during synchronous execution, so a Worker cannot time its own compute,
and it counts calls and bytes instead of fabricating a millisecond figure; it also finds the CPU ceiling
the runtime enforces, by a stepped probe that checkpoints after every step so the trail survives the
isolate being killed mid-probe. `tokens.mjs` is token hygiene: whether a secret value is live rather than
a value that has ever been published in this repository, and the status of the two instance-level
credentials an instance may hold as deploy secrets (BIO's own `ai` credential that resumes a run; the
group's copy binds no Claude account as a deploy secret, K1502, K1755: the group's API key, when held, is in `credentials`' sealed table, never a binding, so the instance-level Claude status always answers none), and which bound credential the instance's unattended work spends.
Neither half holds a store, reads the network, or has any way to
set a credential. A third part, for the reading modules, is the one table of every ceiling a reader keeps (`read-bounds.mjs`), a count of the bytes a reader holds (`byte-ledger.mjs`) and the platform's measured figures with the source of each; it too holds no store and reads no network.

### Provides

**makeMeter() → meter**
- **R1** [met] Returns an object with three methods: `sync(label, fn, bytes?)`, `cpuAwait(label, fn, bytes?)` and `report()`.
- **R2** [met] `sync` and `cpuAwait` each record one call under `label` — creating that segment on first use — and add `bytes` to its byte total when `bytes` is a finite number, before running `fn` (`cpuAwait` awaits it) and returning its result. The call is counted before `fn` runs, so a throwing `fn` still leaves it counted.
- **R3** [met] `report()` returns `{work_calls, work_bytes, segments, measured_ms: null, note}`: `work_calls` and `work_bytes` are the sums, over every label used on this meter, of each segment's calls and bytes; `segments` is a copy keyed by label, each `{calls, bytes}`; `measured_ms` is always `null`; `note` is a string stating these are counts, never times, because Cloudflare freezes the clock during synchronous execution.
- Errors: never throws on its own account. Propagates whatever `fn` throws or rejects with.

**burn(iterations) → number**
- **R4** [met] Runs a fixed, allocation-free arithmetic loop `iterations` times and returns the final value. The same `iterations` does the same amount of work every time; the returned number carries no meaning beyond that.
- Errors: never throws.

**cpuProbe({checkpoint, startStep, maxStep, iterationsPerStep, budgetMs, now}) → Promise<{completed, elapsed_ms, reason}>**
- **R5** [met] Defaults: `startStep` 0, `maxStep` 40, `iterationsPerStep` 2,000,000, `budgetMs` 20,000, `now` `Date.now`. `checkpoint` has no default.
- **R6** [met] Reads `now()` once, at the start, as `t0`. Starting from `step = startStep`, repeats: `burn` `iterationsPerStep` iterations, compute `elapsed = now() - t0`, then `await checkpoint(step + 1, elapsed)`. `checkpoint` is called exactly once per completed step, strictly in ascending step order, and is always awaited before the next step's `burn` begins.
- **R7** [met] Immediately after a checkpointed step whose `elapsed >= budgetMs`, returns `{completed: step + 1, elapsed_ms: elapsed, reason: "BUDGET_REACHED"}` without starting another step.
- **R8** [met] If `maxStep` is reached without the budget being reached, returns `{completed: maxStep, elapsed_ms, reason: "MAX_STEP_REACHED"}`, `elapsed_ms` from the last completed step.
- Errors: throws when `checkpoint` is not callable. Otherwise never throws on its own logic; propagates
  whatever `checkpoint` throws or rejects with.

**sha256hex(v) → Promise\<string\>**
- **R9** [met] Returns the SHA-256 digest of the UTF-8 encoding of `v`, as 64 lowercase hex characters.
- Errors: never throws for any string `v`, including the empty string.

**liveToken(v) → Promise\<boolean\>**
- **R10** [met] Returns `false` when `v` is not a string, or is the empty string.
- **R11** [met] Otherwise returns `false` when `sha256hex(v)` is a member of `PUBLISHED_TOKEN_HASHES`, and `true` otherwise.
- Errors: never throws.

**PUBLISHED_TOKEN_HASHES**
- **R12** [met] An exported `Set` of SHA-256 hex strings, the denylist. `liveToken` and every credential-status service below treat a value whose hash is in the set exactly as an empty one. A caller may also test membership directly (`PUBLISHED_TOKEN_HASHES.has(await sha256hex(v))`) and gets the same answer `liveToken(v)` would give.

**instanceClaudeStatus(env) → Promise\<{level: "instance", configured, reason, detail}\>**
- **R13** [met] (K1502) Answers `{level: "instance", configured: false, reason: CASCADE_UNSET, detail: <string>}` for every `env`, whatever it carries, `INSTANCE_CLAUDE_TOKEN` included: the group's copy binds no Claude credential in its environment, and `detail` says that the assistant is reached through a member's own Claude account or API key or the group's API key, each held in `credentials` (K1755), never a binding. It reads no binding for a Claude credential, and `INSTANCE_CLAUDE_BINDING` is no longer exported.
- **R16** [met] `detail` is `null` exactly when `configured` is `true`, otherwise a string; the return value never carries the configured value itself.
- Errors: never throws.

**instanceClaudeToken(env) → Promise\<string | null\>**
- **R17** [met] (K1502) Returns `null` for every `env`, `INSTANCE_CLAUDE_TOKEN` included: computed from `instanceClaudeStatus`'s own answer (R13), so the two can never disagree, and no Claude credential is ever read from the copy's bindings.
- Errors: never throws.

**instanceAiCredential(env) → Promise\<{token, reason}\>**
- **R18** [met] Reads `env.INSTANCE_AI_TOKEN` (`INSTANCE_AI_BINDING`). Missing, or the empty string: `{token: null, reason: INSTANCE_AI_UNSET}`.
- **R19** [met] A non-empty string that is not `liveToken`: `{token: null, reason: INSTANCE_AI_PUBLISHED}`.
- **R20** [met] Any other non-empty string `v`: `{token: v, reason: null}`.
- Errors: never throws.

**unattendedCredential(env) → {bound, token}** (K90 (2): the choice `monitoring` and `capture-requests` share)
- **R26** [met] `bound` is a boolean, computed synchronously: `true` exactly when `env.DAEMON_TOKEN` or `env.ADMIN_TOKEN` is present and non-empty, that is truthy (presence only; publication is not asked; K227). `token()` answers a `Promise<string | null>`: `env.DAEMON_TOKEN` when it is a string that is `liveToken`, else `env.ADMIN_TOKEN` on the same test, else `null`. The object itself never carries a credential's value. *(met, T8; the store still holds its own copies, `#monitorTokenBound` and `#monitorToken`, until monitoring and capture-requests are extracted)*
- Errors: never throws; `token()` never rejects.

**The reason constants**
- **R21** [met] `CASCADE_UNSET`, `CASCADE_PUBLISHED`, `INSTANCE_AI_UNSET` and `INSTANCE_AI_PUBLISHED` are exported string constants (`"NO_INSTANCE_ACCOUNT"`, `"INSTANCE_ACCOUNT_REVOKED_BY_PUBLICATION"`, `"NO_INSTANCE_AI_CREDENTIAL"`, `"INSTANCE_AI_CREDENTIAL_REVOKED_BY_PUBLICATION"`), stable across calls. They are the only values `reason` ever takes, besides `null`.

**Where the platform keeps the team's room (fix round 7 G83; K4746, K4747, K4752)** (`bio-plane/src/store-place.mjs`)
- **R27** [met] `STORE_HINTS` is the frozen list of Cloudflare's location hints, exactly `wnam`, `enam`, `sam`, `weur`, `eeur`, `apac`, `apac-ne`, `apac-se`, `oc`, `afr`, `me`; `storeHint(env)` answers `env.STORE_LOCATION` when it is exactly one of them, else `null` (an absent, empty, padded or differently cased value is no hint). `storeGeneration(env)` answers `env.STORE_GENERATION` as a whole number when it matches `/^[1-9][0-9]*$/` and is 2 or more, else `1` (so `"02"`, `"2.0"`, `" 2"` are `1`).
- **R28** [met] `storeId(env, name)` answers `env.STORE.idFromName(n)` and `storeStub(env, name)` answers `env.STORE.get(storeId(env, name), {locationHint: h})` when `storeHint(env)` is `h`, else `env.STORE.get(storeId(env, name))` with no second argument; `n` is `name` when `storeGeneration(env)` is `1`, else `` `${name}~g${generation}` ``. The suffix is on the object's name only: the logical names `bio` and `scratch` (a `store=` value, an R2 key prefix such as `bio/captures/`, `bio/published/`, `bio/inbox/`) never change with the generation. These are the only way product code names or obtains the team's room (`bio`, `scratch`): no other file calls `idFromName` on `env.STORE`. A hint is where the hosting platform runs the room, never a jurisdiction (R25).

**The reading ceilings, the byte ledger and the platform's figures (fix round 9, G123a, G124; K4831 (3) (8), K4834, K4835 (1); `bio-plane/src/read-bounds.mjs`, `bio-plane/src/byte-ledger.mjs`)**
- **R29** [met] `READ_BOUNDS` is a deeply frozen map `kind -> name -> {standard, alpha, protective, key}`: one row for every ceiling a reading module keeps (the bytes, rows, columns, cells, entries, depth, ratio, objects, pixels and the rest it refuses above), each with three figures and `key`, the `localize` key of the member sentence that states a refusal on it (the key belongs to the quoting module; this module holds no sentence). `standard` is the figure the standard sets (K4628); `alpha` is the figure the alpha keeps (K4831 (3)): the kind's own figure at the start of fix round 9 where it is lower than the standard; `protective` is a limit inside the standard against a file no ordinary program produces (K4831 (8)). A row's `alpha` is never above its `standard`.
- **R30** [met] The figures the table holds are these, and a quoting module's job adds a row, with its three figures and `key`, for any other ceiling it keeps, the `alpha` being the figure it holds at the start of the round. A figure in MB or GB counts 2^20 or 2^30 bytes, the platform's own unit (K4838 (6)). **Light kinds** (`text`, `csv`, `tsv`, `json`, `xml`): standard 50 MB (52,428,800 bytes) and 1,048,576 rows (K4628). **Archives:** standard 500 MB (524,288,000 bytes) as uploaded and 2 GB (2,147,483,648 bytes) unpacked, alpha 256 MiB for each (K4837), depth 3, ratio 1,100 to 1, 10,000 members, each member within its kind's figure. **Alpha figures of the heavy kinds** the plan names: PDF bytes read 24 MiB; XLSX declared text 32 MiB; ODS `content.xml` 20 MiB and 262,144 expanded repeat units; the analysis workbook's cells 250,000 (K4831 (10)), its file 20 MiB (standard and protective 50 MB) and its cells' JSON 64 MiB in all three columns, a protective figure (K4936); the sheet worker's 250,000 cells, 9,000,000 bytes and 120,000 ms; office retained objects 250,000. **Protective figures** (each is the plan's proposal, recorded by BOB when the capped child has shown it): columns 16,384; a cell 32,767 characters (longer kept to 1 MiB and stated per cell); sheets 1,000; members 10,000; nesting depth 3; ratio 1,100; a page's decoded content 64 MiB; an object stream 16 MiB; a CMap 1 MiB; an embedded file 64 MiB; objects 2,000,000; a direct object 4 MiB and 65,536 operands; tree depth 256; `bfrange` 65,536 codes; a picture edge 65,535 and chunks 65,536; a row stride 8 MiB; an XML tag 64 KiB; a zip directory 16 MiB; a name 4,096 bytes; office package entries 100,000 and archive entries 10,000; retained objects 250,000; pixels a page 120,000,000 (`COVER_MAX_PIXELS`); the render DOM (the figure the capture-sources job proposes).
- **R31** [met] `boundOf(kind, name) -> number` answers the ACTIVE figure of a row: its `alpha`, except for the light kinds (R30), which answer their `standard` (K4834). `statement(kind, name, size) -> {size, bound, key}` answers the size the caller measured, the active figure and the row's `key`, so a refusal is stated with the file's size and the limit and never says a file was read that was not. Both throw an `Error` naming the kind and name when no such row exists (a defect in the quoting module, found by its test); neither throws otherwise. A module that keeps a ceiling quotes `boundOf` and holds no numeric literal for it.
- **R32** [met] `byteLedger() -> {hold(n, tag), release(n, tag), peak(), held()}` makes one ledger, independent of every other, that counts the bytes of the backing stores (buffers, ranges, decoded copies) a reader holds. `hold` adds `n` bytes (a non-negative integer, else it throws a `TypeError`) under `tag`; `release` takes `n` bytes off that tag and never below zero; `held()` is the bytes held now, over all tags; `peak()` is the largest `held()` the ledger has reached. A buffer not released shows in `held()` after its work ends.
- **R33** [met] `capFor(N) -> integer` is the one cap convention for a capped child process: the old-space cap in whole megabytes for a child that holds `N` MB of backing bytes, computed from the memory entries of `PLATFORM_FIGURES` (R34: the isolate's memory, shared by the objects of a class, and the platform's idle figure), the same answer for a PDF run and a sheet run. No other formula for it exists.
- **R34** [met] `PLATFORM_FIGURES` is a deeply frozen map `name -> {value, source}`, one entry for each figure a gated job depends on (the memory idle figure; the landing batch size `LAND_BATCH_BYTES`; the plane's `cpu_ms`; the zone's request body cap). The entries start at Stage 0's measured figures (K4838): `isolate_memory_bytes` 268,435,456 (about 256 MiB of buffers per isolate, shared by up to five objects of a class; one buffer at most 134,217,728), `idle_bytes` 52,428,800 (K4616, not yet measured: P-M2 (c)), `cpu_ms` 300,000, `LAND_BATCH_BYTES` 1,048,576, `request_body_max` 104,857,600 (including framing), each with `source` `K4838 (<n>)` or `K4616`. `source` is the ruling the value rests on until BOB records the measured row in `PLATFORM.md`; the same commit then changes the entry's `value` and sets `source` to `PLATFORM.md P-M<n>` naming that row. An entry whose `source` is a ruling holds that ruling's figure; no entry changes its value without a `source` naming a row. No code reads the Markdown.
- **R35** [met] (fix round 9, G156; K4958) `READ_BOUNDS` gains six rows, today's figures in all three columns (no bound moves, K1881), each `same(n, k(...))`: `provenance.part_verify_bytes` 8 MiB; `acquisition.odf_digest_bytes` 8 MiB; `acquisition.large_fetch_bytes` 8 MiB; `case.copy_now_bytes` 2 MiB; `monitoring.docket_read_bytes` 8 MiB; `following.portal_parse_bytes` 4 MiB. Test: each through `boundOf` and `statement`.
- **R36** [met] (fix round 9; K4965) `wholeReadRow(kind) -> [kind, name]`, the `READ_BOUNDS` row that is a document's whole-read ceiling by its kind: `"pdf"` gives `["pdf", "bytes"]`, `"csv"` `["csv", "bytes"]`, `"text"` `["text", "bytes"]`, any other kind or none `["pdf", "bytes"]` (the whole-load row); exported from `read-bounds.mjs` beside `boundOf`, so every module judging a whole read by kind (capture R109, control-plane's inline gate) asks this one declaration. Test: each kind, an unknown kind and `undefined`; `boundOf(...wholeReadRow(k))` equals the row's active figure.

## Private

### Uses

- None. `runtime-limits` is Layer 1 with no `uses` entry in `modules.json`; every reading module takes a `uses` edge to it for R29-R34 (K4835 (1)). `unattendedCredential` (R26) calls
  this module's own `liveToken`.

### Invariants

- **R22** [met] Pure: no store, no network fetch, and (outside `cpuProbe`'s own injectable `now`) no clock. Every service gives the same answer for the same inputs; `cpuProbe`'s `elapsed_ms` is the one exception, since it depends on when it runs. (Fix round 9: a byte ledger, R32, keeps counters inside the object its caller made and nowhere else; `READ_BOUNDS` and `PLATFORM_FIGURES` are frozen constants.)
- **R23** [met] No function here accepts or sets a credential. `env.INSTANCE_AI_TOKEN` reaches this module only by already being present on the `env` object the caller passes at each call; nothing exported here can create, change or clear it (DS-3, D-260 §6: minting and setting an account credential is a member act elsewhere, never a plane write path). No Claude credential is read from `env` at all (R13, R17; K1502): a member's own account reference and the group's API key are `credentials`' (K1755).
- **R24** [met] `report()` never states a duration for synchronous work: `measured_ms` is always `null`, and `note` says why, rather than reporting a zero that would read as a measurement.
- **R25** [met] No place is named in this module (`build/layers.md`, "No jurisdiction in the product"). It holds no local fact of any jurisdiction, and none of its behaviour depends on one. A Cloudflare location hint is where the hosting platform runs the team's room, not a jurisdiction and not a place the product acts on (fix round 7, G3; K4752).

No check in `bio-plane/checks/bio-checks.mjs` names `cpu.mjs`, `tokens.mjs`, or any function or constant
of either file — this module owns no C-numbered check today.

### Satisfies

- `BIO_Distribution_v0_1.md` §6 (D-260, DS-3): an instance may hold one organisation-principal `ai`
  credential as a deploy secret (`INSTANCE_AI_TOKEN`), never generated by this module, denylisted on
  publication like every other token.
- `BIO_Assistant_and_AI_Roles_v0_1.md` §6, D-260 (RULED by BOB #22, 2026-09-21): publication of a
  credential's value is revocation.
- K1502 and K1503 (`BIO_Assistant_and_AI_Roles_v0_1.md` §6 as amended), with K1755: no project-wide
  Claude account, and the subscription token is each member's own by Bob's choice (K1755); the group's API key, when held, is `credentials`'; the
  group's copy binds no Claude credential in its environment (R13, R17, R23).
- The CPU-measurement half (`makeMeter`, `burn`, `cpuProbe`) rests on no canon design section; it is
  runtime instrumentation the code itself records discovering (2026-07-29: a Worker cannot time its own
  synchronous compute, so consumption is counted in work and the ceiling is found by a checkpointed
  probe instead).

- K4831 (3) and (8), K4834 and K4835 (1) (fix round 9): the alpha's limits stated to members with the file's size and the limit, the protective class of limits, the light kinds at the standard in Stage 1, and the table's home in this module (R29-R31); `build/plan/fix-round-9-T51.md` G123a and G124, R-GATE (R34).

### Suggestions

- Callers of `cpuProbe` (today, `legacy-index`'s `op=cpuprobe`) should make `checkpoint` itself durable
  (a store write) before it resolves: the whole design rests on the last completed step's checkpoint
  surviving an isolate kill that `cpuProbe` itself cannot detect or report, and a `checkpoint` that only
  buffers in memory defeats that.
- `unattendedCredential` (R26) is read by `capture-requests` and `monitoring` until their in-process paths
  (capture-requests R16, monitoring R23) leave them nothing to spend; `monitoring` keeps its own
  `MONITOR_NO_LIVE_CREDENTIAL` sentence for a `token()` of `null`.
- Today's callers: `subresources` uses `makeMeter`; `legacy-index` uses `cpuProbe`, `liveToken` (to admit
  `ADMIN_TOKEN`/`MEMBER_TOKEN`/`PROBE_TOKEN`/`DAEMON_TOKEN`) and re-exports `PUBLISHED_TOKEN_HASHES`;
  `legacy-store` uses `liveToken`, `sha256hex`, `instanceAiCredential` and `instanceClaudeToken`
  (after K1502 the last always answers `null`; its callers, `agent-worker`'s cascade among them, re-point to
  the member's own reference in their T33 jobs, and the two Claude services may then be removed by a later
  change);
  `legacy-index`'s `livefire.mjs` checks configured bindings directly against `PUBLISHED_TOKEN_HASHES`.
  None of this module's own tests may depend on those legacy files; test each service directly.
- A caller combining this module's `cpuProbe`/meter output with other runtimes limits (for example the
  subrequest ceiling, `legacy-store`'s concern) is composing several modules' reports; that composition is
  not this module's requirement.
