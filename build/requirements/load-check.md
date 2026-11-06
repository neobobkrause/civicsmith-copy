# load-check — requirements

**Status** · New in T53 (N1274; K4746 (1), K5567; K5448 (5): a helper module carrying no product capability, CONSISTENCY §2.6, BOB's under `layers.md` ruling 5 as amended). Drafted by PLATFORM in `build/plan/beta/platform/load-test-draft.md` §5 (PL40 to PL45), worded here by BOB's worker (P5). Layer 11, last but for `journey-check`; its paths and tests are empty until its job creates them (K1043). Not in force, and not yet met (T53). Until it is built the study measures with the prototype's scripts on `proto/levels-2-3`.

**Size (P6).** Estimated 400–700 lines of code; measured at its START (K617).

## Public

### Purpose

The per-level load test's driver. It drives a scratch copy of Civicsmith, named by the caller and seeded by its own acts, with seeded members working at a stated rate, steps the number of members up until a screen or act breaks its time class at the 90th percentile or fails too often, and writes what it found as the measured figures (`P-M` rows of `PLATFORM.md`) that `runtime-limits`' level rows read. It is a test tool, not product: nothing in a team's copy imports it, and it touches no copy but a scratch one.

### Provides

Terms. A **copy** is a deployed Civicsmith the caller names by address and credentials. A **scratch copy** is one deployed for the test, seeded by this module and discarded, in Civicsmith's permitted Cloudflare account only (`20b533579290b9b93168345edd3b7f72`); the throwaway rehearsal account (`CS_TEST_CF_ACCOUNT_ID`) is for the new-team rehearsal alone (K4942) and is never used here. A **profile** is the mix of screens and acts a seeded member works through, with its think time. A **ramp** is the ordered member counts to step through. A **budget** is the time class of a screen or op (`runtime-limits` `budgetOf`).

- **R1** (T53; N1274; PL40) `runProfile(copy, profile, ramp)` drives the screens' declared reads and the acts of the profile (`op-declarations`) as seeded members against the copy the caller names, steps up through `ramp`, and stops at the first step that breaks a budget at the 90th percentile or fails over 1 % of operations, returning the per-step figures (per op and screen: net median, 90th and 99th percentile, hops, requests, repeats; per step: members, errors by code, the door window's wait, and the step's cost where it can be read). It refuses a copy whose account is not the permitted one, and any copy the caller marks as the shared test copy, before any request is made. Test: a copy fixture of a wrong account is refused with no request made; the shared copy is refused; a fixture whose latency rises with the number of members stops at the step that crosses the budget and returns the steps before it.
- **R2** (T53; N1274; PL41) The driver is bounded by what one scratch copy should take: a member count cap and a request-rate cap it will not exceed whatever the caller asks, a request beyond them clipped; it never loads a copy it did not seed; and it prints, logs and writes no credential. Test: a request beyond the cap is clipped to it; a copy carrying another team's seed is refused; the credential given in the test environment appears in no output, log or report.
- **R3** (T53; N1274; PL42) `seedCopy(copy, size)` builds a record of the named size through the product's own acts (never by writing rows past the plane), so the rows are those a real team's are, and returns the measured bytes, documents and rows. The size is stated as database bytes and R2 bytes apart, with a text-heavy and a scan-heavy mix both available (the record grows by extracted text, the container by pages). Test: the sizes reached are within 10 % of the request and equal what the gauge (`screens-settings`) reports for the record.
- **R4** (T53; N1274; PL43) `report(results)` writes the `P-M` row for each level: the rated number of members at once (the last step that held at the 90th percentile), the record bound, the upload bound, the cost, and which budgets broke first; each row says the copy, the commit, the date, the walkers present (none), the number of samples and the range. It records a `measured` figure only from a completed run, so `runtime-limits`' `measured` stays `null` for a level until a row is recorded. Test: a completed run records one row with every field; an interrupted run records none.
- **R5** (T53; N1274; K5535; N1272 R119; PL44) `runProfile` seeds interpretation the way members make it, through the product's own acts (`how` opened, cited, marked, accepted proposal), at three densities on each level's seeded record: ordinary (a part interpreted for every 20th page or sheet block of a held document, on the busiest 10 % of documents), heavy (every 5th page), and a stress run (marking every part of a 5,000-page document, the case `extraction` R119 says must be bounded). It records per density the rows and content bytes added per interpreted part, the room's hold per landing, and the times of `interpretationOf`, `proposeParts` and `partsOf` at the 5,000-page, 1-million-row document. Test: a seeded copy's measured rows per part equal the change the gauge reports; no density passes a budget silently.
- **R6** (T53; N1274; K5535; PL45) `report` states, per level, the **interpretation ceiling**: the largest count of interpretation rows (and the bytes of their content) at which the screens that read them still hold their budgets at the level's rated members at once, less the room those rows would take from the record bound (database and R2 apart); and the ordinary-team rate it clears, the heavy density across the level's rated number of documents. Where the ordinary rate and the limit are within a factor of 10, the ceiling is flagged for Bob and not set. It is the figure of `runtime-limits`' level row for the ceiling, `measured: null` until recorded (PL21); `extraction` R119's refusal names this figure and the count held. Test: the ceiling of a seeded copy is at least the heavy density's total; an unmeasured level has none; a stress run refuses at the figure plus one. Control: a ceiling within a factor of 10 of the ordinary rate is flagged and not recorded as set.

## Private

### Uses

- `op-declarations`: the screens' declared reads and waves (its `screenread` declaration) and the ops' budget classes, which `runProfile` replays and judges against (R1).
- `runtime-limits`: `budgetOf` (the time classes), the level rows and `levelOf` (the rows `report` fills, R4, R6).
- `test-support`: the sandbox, throwaway keys and fixtures (tests), and the session driver it shares with `journey-check` (the driver moves to `test-support`, or this module takes its own: CONSISTENCY §2.6, BOB's).

### Invariants

- **R7** (T53; CONSISTENCY §2.6; layers.md, helper modules) It uses `op-declarations`, `runtime-limits` and `test-support` only; it imports `journey-check` not, and no product module imports it. Test: the module's imports against its `modules.json` `uses`. Control: a copy's bundle holds nothing of it.

### Satisfies

- N1274 (K4746 (1): "figures confirmed by measurement before a team sees them"; K5567); `build/plan/beta/platform/load-test-draft.md` PL40 to PL45; K5535 (the interpretation ceiling per level, R5, R6); K4942 (the permitted accounts, R1).

### Suggestions

- The scratch deployment is BOB's act, one copy per level (Level 1 now; Level 2 when N1271's design is built; Level 3's parts that need an Enterprise account stated, not measured), in the permitted account only; whether Bob must authorize it is BOB's. The estimated charge for a full ramp and the seeding is set by a first dry run on the smallest record and reported before the larger runs.
- The driver speaks ops, not a browser, for the many members and a browser for a few (P23's method: "drawn" needs one). Profile (starting values; PLANNING may change them): Home 25 %, Queue 15 %, Project 20 %, Document 15 %, Held 5 %, Inbox 5 %, Add and writes 15 %; one member in 20 adding a document; one visitor capture a minute; one large file (the K4628 bound, kind by kind) reading in the background from the first minute; think times for 1, 2 and 4 screens a minute a member. Ramp: 5, 10, 15, 25, 40 and 60 members, ten minutes a step, the next only if the last held; then a soak at 80 % of the breaking step for an hour; a quiet-copy baseline first. Record sizes: 1, 5 and 25 GB of captured files and a database near the gauge's 70 % and 90 % of 10 GB. Archive fan-out and the registers and mail load are profile items (`build/plan/beta/files/LOAD-PER-TYPE.md`).
- It runs after layer 11's deploy and after the fold and the work fixes land (PL12 to PL14), so the first measured rating is of the beta's design; a short run on the alpha's design first gives the "before".
