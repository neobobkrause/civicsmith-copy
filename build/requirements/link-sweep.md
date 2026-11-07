# link-sweep — requirements

**Status** · In force: split from `monitoring` (N506; K617, K1159; folded K1181), meaning unchanged: R1–R12 are `monitoring` R53–R64 in order, retired there and never reused; the text Bob's rulings K1019, K1036, K1044, K1094, K1099, K1122 and K1129 settled. Every requirement met (LINK-SWEEP #1, K1209). Last changed T51 (K4189: R13, R14 new, `sweepSet` and `sweepRatify`, a member's doors to define and ratify a sweep, C56, UC-034, UC-035; R15 new, the op declaration, K4168); R13–R15 met (LINK-SWEEP layer 10, 7 Nov 2026: `sweep-write`, `declared-ops`, `contracts` and `fixtures` tests).

**Size (P6).** About 800 lines of `monitoring`'s code move here: `bio-plane/src/monitoring/sweep.mjs` (537) and `sweep-match.mjs` (264), the `sweep_runs` and `sweep_filed` tables of `schema.mjs` and their purge declarations, the sweep half of `checks.mjs` (`SWEEP_CHECKS`, C-18.16–C-18.18, `SWEEP_CADENCES`, `SWEEP_FIELDS`, `sweepErrors`), and `index.mjs`'s sweep services (`sweepDue`, `sweepWake`, `sweepTick`, `sweeps`, `sweepConditions`, `registerSweepScope`, the `sweeps` route); with the tests `test/m/monitoring/sweep-grammar.test.mjs`, `sweep-reads.test.mjs` and `sweep-run.test.mjs` (about 700) and the share of `fixture.mjs` they need. Well under 4,000.

## Public

### Purpose

The link sweep: a ratified sweep is the group's named standing intent to watch a set of listing pages and bring in, one hop away, the documents on them its match admits, within its scope and its budget, each filed as its own Information bundle at `collected`, never higher (Intake Doctrine §4, §6, §9). This module states a sweep's definition and who may write one, runs the sweep for `scheduler`, and answers what members need to look at. The daemon it runs under, with its pause, its idempotence key and its landing, is `monitoring`'s.

### Provides

**The sweep's definition** (an entry of `data/gathering.json` `sweeps[]`, refused by C-18.5 through `monitoring` R27)
- **R1** A sweep is `{id, title, ratified, sources, seeds, match, cadence, budget}` and nothing else. C-18.5 refuses an entry that breaks any of the following, with one finding per field:
  - `id`: `^[a-z0-9][a-z0-9-]{0,39}$`, unique within the file. A sweep's full name is `"<bundle>#<id>"`.
  - `title`: a non-empty single line of at most 200 characters.
  - `ratified`: a boolean.
  - `sources`: the origin allowlist. It holds 1–20 public https prefixes (`isPublicHttpsLocator`). Each is a scheme and a host with an optional path prefix, and has no query or fragment. An address is **in scope** when its normalised form (`subresources.normalizeAddress`) equals a prefix, or continues one at a `/`.
  - `seeds`: 1–10 public https locators, each in scope. These are the listing pages read on every run.
  - `match`: `{terms?, paths?, formats?}`.
    - `terms`: 0–20 terms, each as R2 states.
    - `paths`: 0–20 prefixes, each in scope.
    - `formats`: 0–10 format names, each one that `format-registry.listFormats()` (its R8) answers at the gate.
  - `cadence`: `daily`, `weekly` or `monthly` (monitoring R14's intervals).
  - `budget`: `{per_run, backlog}`. `per_run` is an integer 1–100 and `backlog` an integer 1–1,000.

  `title` and `terms` are only ever shown as quoted data. `daemon.sweep_budget`, when set, caps the fetches all of a bundle's sweeps make in one tick together. When it is 0, they make none, and the run says so.

  At composition this module registers R1's and R2's rules (as C-18.5's sweep arm), R3's fence and R9's slate share with `monitoring.registerSweep` (monitoring R66, N506), so `monitoring` R27 keeps one refusal and R30 one slate.
- **R2** A **term** is a single-line string of 1–200 characters. It is a regular expression when it is written between slashes (`/…/`), and a literal otherwise. Both match without regard to case.
  - C-18.5 refuses a regular expression that does not compile, or that uses a backreference, a lookahead or a lookbehind (`SWEEP_TERM_REFUSED`, naming the term and the construct).
  - A term's matching time is linear in the length of the text it is matched against, whatever the term is. No term can make a run take longer than its text's length bounds.
  - A term is matched against at most 2,048 characters of a link's text and 2,048 of its decoded address. The rest is not read, and the run says how many links it cut.

**Who may write a sweep** (K1036 (7))
- **R3** A non-replay promotion carrying `data/gathering.json` is refused before anything is written, as follows:
  - `SWEEP_NOT_A_MEMBER` (C-18.5) when its author is not a member (an identity in `record-grammar`'s non-member set) and it adds a sweep, removes one, or changes any field of one. The one exception is setting `ratified` to `false`.
  - `SWEEP_RATIFY_NOT_AN_OWNER` (C-18.5) when its author is not an owner of the bundle's project (`record-core.bundleInfo`, its R34; `membership.isProjectOwner`, its R54) and the promotion does either of these:
    - sets a sweep's `ratified` to `true`;
    - changes any field of a sweep that is ratified before or after the write.

    A bundle in no project has no owner, so every such promotion on it is refused.

  Any member who may write the bundle may add or change an unratified sweep. An owner's change to a ratified sweep re-ratifies it. Any writer, the daemon included, may set `ratified` to `false`, because stopping breadth is never refused. The ratifying member and the instant are those of the promotion that last set `ratified` to `true` or changed a ratified sweep, read from the bundle's history.

**The run** (`sweepDue(now)`, `sweepWake(now)` and `sweepTick(now, rank?)`, for `scheduler`'s `gathering-sweep` consumer)
- **R4** A sweep is due when all of the following hold:
  - it is ratified;
  - the daemon is not paused (monitoring R30);
  - its bundle's `daemon.enabled` is not `false`;
  - its project is not at stage `closed` (Bob, K1094 (1));
  - it is not held (R8);
  - it has never run, or its last run plus its cadence's interval is at or before `now`.

  `sweepWake` answers now + 1 s while one is due, else the earliest next run, else null. A tick runs at most 5 due sweeps, longest-overdue first and then by full name. Given the scheduler's rank, it reads at most ten times that number in that order and runs its batch in the rank's order. Each sweep is offered as `{kind: "sweep", id: "<bundle>#<id>", waitingSince}`. Claims and epochs are monitoring R21's, and the tick is not re-entrant (monitoring R22), each through `monitoring.sweepHost` (monitoring R65), as are the pause and the rank.
- **R5** **Seeds.** Each seed is fetched through `capture.acquire`, paced by `host-governor`, with `origin: {kind: "sweep", matched_sweep: "<bundle>#<id>", deeming_actor: "bio-monitor"}` and the sweep's `sources` as the redirect scope (`acquisition` R31). Its capture is filed in the sweep's own bundle as a monitor snapshot, in the way monitoring R9 files a tick's bytes.
  - A seed whose bytes equal its last capture is recorded as `unchanged`, and its candidates are read again from that capture.
  - A seed that fails is recorded with `capture`'s reachability (its R8), and the run goes on with the other seeds.
  - A seed redirected out of scope is not fetched beyond the redirect, and is recorded as `out_of_scope_redirect` with its target.
- **R6** **Candidates and the match.** The candidates are the links in this run's seed captures, read from the seed's own bytes: HTML anchors with their text, feed items with their titles, and sitemap entries (address only). A candidate matches when all of these hold:
  - its normalised address is in scope;
  - it lies under one of `match.paths`, when any are given;
  - one of `match.terms` (R2) matches its text or its decoded address, when any are given.

  Only one hop is followed. A matching candidate is skipped, with the reason stated, in each of these cases:
  - this sweep has already filed a capture at that address (`already_swept`);
  - the record already holds a capture at that address (`already_held`);
  - the run's budget is spent (`budget_spent`). Seed fetches count toward `per_run` and toward `daemon.sweep_budget`.

  The rest are fetched in seed order and then in link order, each through `capture.acquire` with R5's origin and redirect scope. A redirect out of scope is recorded as `out_of_scope_redirect` with its target, and nothing at the target is fetched.
- **R7** **Filing.** Each fetched candidate whose detected format (`format-registry.detectFormat`) is in `match.formats` (any format when none are given) is filed as a new Information bundle at `collected`:
  - in the project of the sweep's bundle;
  - with the register entry's `origin` as R5 states it;
  - with the seed capture that listed it named in the bundle's Provenance Notes.

  A fetched document of another format is not filed (`format_excluded`), and its fetch still counts toward the budget.
- **R8** **Backlog, hold, anomaly and silence.**
  - **Backlog** is `capture.heldCount({sweep: "<bundle>#<id>"})` (`capture` R82): this sweep's documents still at `collected`, neither released nor set aside. When it answers `null` (the store could not be read), the sweep is held as if over its ceiling (K1129).
  - **Held:** while the backlog is at or over `budget.backlog`, the sweep does not run, and every read of it (R9) states `held: backlog`.
  - **Anomaly:** once at least 4 runs exist, a run notes an anomaly in either of these cases:
    - it filed more than three times the median of the last 8 runs, and more than 5;
    - it filed 0 while that median is at least 2.

    The note is kept on the run and changes nothing else.
  - **Silent:** a sweep whose last 4 runs each filed nothing, and which is not held, is `silent`.
- **R9** **Reads.**
  - `sweeps({viewer})` (`op=sweeps`; read; member session) answers every sweep in a `gathering.json` the viewer may see. Each comes with:
    - its definition, as quoted data;
    - `ratified`, with the ratifying member and instant (R3);
    - `due`, `next`, `held` and the backlog;
    - its last 20 runs, each with the seeds fetched, unchanged, failed or redirected, the candidates, the number filed, the skipped by reason, the links cut (R2) and any anomaly.

    It also answers `formats`, which is `format-registry.listFormats()`, the list the member chooses `match.formats` from (K1036 (6)).
  - Monitoring R30's due slate carries each due sweep's definition as quoted data inside the fixed framing, through the `dueForSlate` this module registers (monitoring R66).
- **R10** **Looks.** Each seed fetch and each candidate fetch writes one observation row (`observation-log`), with these fields:
  - authority kind `sweep`, authority `"<bundle>#<id>"`, level `document`, subject the address;
  - state `PRESENT`, referring to the capture, or `LOOKED_INDETERMINATE` with the reason (a failed fetch, `out_of_scope_redirect`, `format_excluded`, or a governed refusal marked `governed`).

  A skipped candidate writes nothing, because nothing was looked at.

**Writing a sweep** (T51; K4189; Intake Doctrine §4; UC-034, UC-035)
- **R13** (T51; K4189; Intake Doctrine §4) `sweepSet({bundle, sweep, title, sources, seeds, match, cadence, budget, author, viewer})` (`op=sweepset`; member session; mutating) adds a sweep (id minted from the title in R1's form, unique, written `ratified: false`) or, with `sweep` (`<bundle>#<id>`), changes one and leaves `ratified` as it is; R1's fields only, stored as quoted data; written through `monitoring`'s `write` (its R77). Refusals in order, each writing nothing: `MACHINE_CANNOT_SET_SWEEP` (new row); `ABSENT`; `NO_SUCH_SWEEP`; R1's and R2's findings as `SWEEP_TERM_REFUSED` and C-18.5 (`monitoring` R27's refusal, relayed); R3's fence relayed (`SWEEP_NOT_A_MEMBER`; `SWEEP_RATIFY_NOT_AN_OWNER` for a non-owner changing a ratified sweep). Answers the sweep as `sweeps` (R9) reads it. This module re-checks no grammar. Test: an unratified sweep is added and is never due (R4). Control: a non-owner changing a ratified sweep is refused, file unchanged.
- **R14** (T51; K4189; R3) `sweepRatify({sweep, ratified, author, viewer})` (`op=sweepratify`; member session; mutating) sets only `ratified`. To `true`: the project owner only (R3; a project's own bundle belongs to that project, K5170; a bundle in no project has none), `SWEEP_RATIFY_NOT_AN_OWNER` relayed; to `false`: any member who may write the bundle (stopping breadth is never refused). Refusals in order, each writing nothing: `MACHINE_CANNOT_SET_SWEEP`; `ABSENT`; `NO_SUCH_SWEEP`; the fence's. Already in the asked state: `{ok: true, existed: true}`. Answers `{ok, sweep, ratified, ratified_by, ratified_at, due, next}` (R3's history, R9's `due`, `next`). Test: the owner ratifies, the sweep is due at the next tick (R4) and files at `collected` (R7). Control: a non-owner member is refused; any writer stops it.
- **R15** (T51; K4189; K4168; K4230) The module exports `DECLARED_OPS` beside its ops, declaring `sweepset` (`admin`, `member` sessions; `machineClasses: []`; mutating; `needs: contribute`; `reversible`) and `sweepratify` (the same; `reversible`), fields accepted and required read from each op's arm, beside any other op it declares (`sweeps`; a read, `weight: "read"`: it writes nothing, so a rung on it is refused, op-grades R49; K4250). Every mutating row declares its `needs`; a member's act on a team's sweeps is `contribute`, and the owner-only ratify is refused by the arm (R3, R14), not by a capability. Every sentence a member reads is read by key; the ratify screen says, by key, that ratifying sends the team's fetches to the named hosts within the scope and budget shown, each filing at `collected`, never higher. Test: the key census; `test-support`'s helper on both ops.

**What reaches members** (NOTIFICATIONS.md, the catalogue and the item contract)
- **R11** `sweepConditions({viewer})` answers, for each sweep the viewer may see, every condition that needs a member's look, derived on read and writing nothing. Each condition is `{sweep, kind, since, detail}`:
  - `sweep-held-backlog`: the sweep is held (R8). `detail` gives the backlog and the limit.
  - `sweep-yield-anomaly`: the last run noted an anomaly (R8). `detail` gives the count filed and the median.
  - `sweep-seed-unreachable`: a seed failed on the last run (R5). `detail` names each such seed and its reachability.
  - `sweep-redirect-out-of-scope`: the last run met a redirect out of scope (R5, R6). `detail` names each address and its target.
  - `sweep-silent`: the sweep is silent (R8).

  A condition leaves on the first read after it stops holding.

**The scope check for `capture-requests`**
- **R12** (K1099, K1122; `capture-requests` R45) At its construction the module registers with `capture-requests` the sweep scope check that module's R45 calls (K31's pattern): given a sweep `<bundle>#<id>` and a request's locators, it answers whether the sweep is ratified and not held (R1 onward) and whether every locator is within the sweep's scope, by the same matcher a sweep's run uses. A request filed under a sweep this way counts toward that sweep's `per_run` on its next run.

## Private

### Uses

- `record-grammar`: `isPublicHttpsLocator` (R1), the non-member set and `isMachineIdentity` (R3), `createSha256`.
- `record-core`: `stampInstant`; `bundleInfo` (its R34; R3, R7), the bundle's file and image reads and history (`readFile`, `readImage`, `head`; R3's ratifier, R5), `evidenceStore` (R5), `declarePurge` for this module's tables.
- `subresources`: `normalizeAddress` (R1, R6).
- `format-registry`: `listFormats` (its R8; R1, R9), `detectFormat` (R7).
- `membership`: `isProjectOwner` (its R54; R3), `viewerPredicate`, bundle sight (R9, R11).
- `promotion`: `promote` (R5's monitor snapshot, R7's filing).
- `capture`: `acquire` (R5, R6; its R73), the reachability it records (its R8; R5), `heldCount` (its R82; R8). `host-governor`'s pacing and `acquisition`'s sweep scope (its R31) are reached through `capture.acquire`.
- `observation-log`: its one append (R10).
- `capture-requests`: `registerSweepScope` (its R45; R12).
- `project-stage`: `projectStage` (its R1, R2), for R4's closed test.
- `monitoring`: `sweepHost` (its R65), with `write` (its R77; T51, R13 and R14 write only through it): `paused` (its R30; R4), `openEpoch`, `claim`, `closeEpoch` (its R21; R4), `running` (its R22; R4), `ranked` (its R19's rule; R4), `land` (its R28's landing; R7), `gate` (R9, R11), `recheckMs` (its R20's interval, for the wake's recheck of a held or paused sweep; R4); `registerSweep` (its R66), at composition, for R1–R3 (C-18.5's sweep arm through its R27, the fence) and R9 (its R30's slate); the snapshot filing of its R9 (R5) and R14's intervals (R1, R4).

### Invariants

None numbered here: the split moved no invariant. Monitoring's R36 (the daemon fetches only what store state authorizes, a ratified sweep's seeds and the candidates R6 admits among them; no sweep fetch reaches an address out of its scope), R37, R39, R40 and R43 bind the sweep as they bind every daemon fetch, stated there unchanged.

### Satisfies

- `docs/architecture/BIO_Intake_Doctrine_v1_1.md` §4 (the ratified sweep, the ratification fence, constraints as security controls), §6 (bounded breadth), §9 (named standing intent).
- `docs/architecture/BIO_State_Rules_Consistency_v1_5.md` §4.1 (the register's sweep origin) and §6 I-18.
- `docs/development/NOTIFICATIONS.md` (the CONDITION items).
- K1036, K1044, K1094, K1099, K1122, K1129 (Bob's rulings on the sweep, as `monitoring` cited them).

### Suggestions

- **The seam with `monitoring`** (N506; ruled by BOB as `monitoring` R65, R66): `Sweeps`' handed-in helpers become `monitoring.sweepHost`'s services; `checks.mjs`' sweep arms (`sweepErrors`, `SWEEP_CADENCES`, the matcher) and the fence move here and are registered with `monitoring.registerSweep`, with `dueForSlate`. R12's registration is made under this module's name, not `monitoring`'s.
- Tables: `sweep_runs` (one row per run, with its counts and anomaly) and `sweep_filed` (the addresses each sweep filed, for `already_swept`). Both are this module's, declared to purge and derived, as monitoring R41's are.
- A linear-time matcher (R2) is a Thompson-NFA or RE2-class engine, never JavaScript's backtracking `RegExp`. Banning backreferences and lookaround alone does not make a backtracking engine linear, because `(a|a)*` and `(a+)+` still blow up.
- Codes `SWEEP_TERM_REFUSED`, `SWEEP_NOT_A_MEMBER` and `SWEEP_RATIFY_NOT_AN_OWNER` each take a catalogue row in this module's table (DEC-49). `op=sweeps` takes an `op-declarations` spec (member session, read) in L11.
- Tests:
  - each C-18.5 arm, with a negative control;
  - a regular expression with a backreference, and one with a lookbehind;
  - a pathological term over a 2,048-character text, finishing within a fixed bound;
  - an owner who ratifies against a member who ratifies;
  - a non-owner who changes a ratified sweep, and one who sets `ratified` to `false`;
  - the budget counted with seeds;
  - a redirect out of scope that fetches nothing at its target;
  - an `already_held` skip;
  - the held, anomaly and silent edges at 3/4 runs and at the median;
  - every R11 kind arriving and leaving.

## Open for Bob

None: the text is `monitoring`'s, already settled by Bob's rulings cited above.

## Decided by BOB (for the rulings)

- (N506, K1153, K1159) The split from `monitoring`, R1–R12 = `monitoring` R53–R64, with no change of meaning; layer 10 after `monitoring`; `paths` `bio-plane/src/link-sweep/`, which this module's T24 job creates by moving the files.
- (N506) The seam: `monitoring` R65 (`sweepHost`) and R66 (`registerSweep`); C-18.5's sweep arms, the fence and the slate share are this module's, registered at composition.
