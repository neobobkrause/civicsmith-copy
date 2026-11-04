# Build manifest

**Status** · The one place that says where the product's build state, requirements canon and tests live (PROCESS-MECHANICS §1). The process itself is neoProcess, defined in `neobobkrause/neoprocess` (onboarded 29 Oct 2026: `build/onboarding/`; the old process, `believeinoakland/civicos-process`, is retired).

## Where things are

| what | where |
| --- | --- |
| the process: principles, rulebooks, design files, the process tool, hooks and checks | `neobobkrause/neoprocess`, cloned at `/home/user/neoprocess`; `CLAUDE.md`, the skill `.claude/skills/neoprocess/`, `.claude/settings.json` and the gate and prune workflows are written by its `proc shims` |
| the product's own procedures, each read whole when its situation arises | `build/situations/`: `release.md`, `deploy-and-walk.md`, `fix-round.md`, `design-channel.md`; `job.md`, every job's standing rules, named in each START |
| the requirements canon (mission, product requirements, construct designs) | listed in `requirements/README.md`; the files are under `docs/architecture/` and `docs/development/` |
| the layers, with their contracts and rulings | `build/layers.md` (rendered: `build/layers-view.html`); their split history, `build/plan/archive/layers-history.md` |
| the modules in their total order, with paths, tests and uses | `build/modules.json` |
| each module's requirements, and the conventions they follow | `build/requirements/<module>.md`, `build/requirements/README.md` |
| the running round's plan (its Status, Round, Jobs and Owed lines written by `proc`), the next one, the finished tranches and rounds | `build/plan/current.md`, `build/plan/next.md`, `build/plan/archive/T<n>.md`, `archive/T<n>-R<k>.md` |
| what each coming extraction moves out of a legacy module (P18) | `build/extraction/<module>.md` |
| one record per module job (its Status line and completion reports, written by `proc job …`) | `build/jobs/T<n>/<module>.md` |
| the capability ladders: what each construct can do at each rung L0–L5, every need found, and what each later rung takes (read before planning a stage that adds capability, or when a member's situation shows a gap) | `docs/architecture/BIO_Capability_Ladders_v0_1.md` (canon); the study's full evidence on branch `study/constructs`, commit `892fca16c4` (never deleted, K1433) |
| what Anthropic's plans and terms permit or forbid: verbatim quotes, each with its page, date read and the plan it governs (ids `AT-n`), the questions the pages leave open, and Bob's own choices; every other statement cites it (K1763) | `build/terms/anthropic.md` |
| the rulings in force, read whole at takeover: Bob's process judgments and BOB's conventions no code holds | `build/rulings-active.md` |
| Bob's product rulings by subject (K5323), each read whole by the work that touches it: `ai`, `installer-accounts`, `platform`, `quality`, `reading`, `scope`, `stewards`, `tests`, `words-ux` | `build/rulings-product/<subject>.md` |
| every ruling, one line each (searched on need, never read whole) | `build/rulings.md` |
| tokens processed per session | `build/metrics/T<n>.csv` (transition sessions under `T0`) |
| the latest handoff (replaced whole at each handoff) | `build/handoff.md` |
| the old plan, frozen, and its triage | `docs/development/transition/old-plan/` |
| the restore point from before the new process | branch `snapshot/pre-refactor-2026-09-25` |
| walk captures and screenshots, never in git (REP 6; PROTOCOL §7d) | R2 bucket `bio-walks` on account 20b533579290b9b93168345edd3b7f72; every object expires 30 days after upload (lifecycle rule `expire-30-days`); the report with the keys goes to the tranche branch |

## Tests

| layer | layer tests |
| --- | --- |
| every layer | none yet; each module's tests are under its `tests` paths in `modules.json`. A layer's tests are added here when it has any (P11: kept as small as possible). |

The full regression runs only at a release or when Bob asks (P11): the GitHub workflow `regression`, started by hand.

## Generated artifacts (PROCESS-MECHANICS §14)

Committed files built from several modules' source. No job edits one by hand or writes another module's; a job that stales one reports it. At every merge and every layer close, `proc merge` and `proc layer close` run each row's regenerate command, then its verify command, from the repository root, in this table's order (K1540: member-roster's order, setup-words, then program.mjs, which prints the members' words through setup-words' rows, K4355; court-data and wizard-scripts' data; the bundles, which take program.mjs; newgroup last), and commit what changed; a verify that fails undoes the merge. A `SKIP` in a bundle verify means a member's `node_modules` is missing (`npm ci` there first, `build/situations/job.md`). Baseline on `tranche/T1` @ BOB #40's takeover: 96 pass, 0 fail, no skip.

| artifact | owned by | regenerate | verify |
| --- | --- | --- | --- |
| `bio-plane/src/member-roster/order.mjs` | member-roster (from `build/modules.json`; K3633, K3972, K3979) | `node bio-plane/src/member-roster/order-build.mjs` | `node bio-plane/src/member-roster/order-build.mjs --check` |
| `bio-plane/src/setup-words/rows.mjs`, `bio-plane/src/setup-words/words-unreviewed.json` | setup-words (from `words.json` and every `t(id, en)` call; K3366, K3932) | `node bio-plane/src/setup-words/build.mjs` | `node bio-plane/src/setup-words/build.mjs --check` |
| `bio-plane/src/case-checker/program.mjs` (not committed since 4 Nov: over `max_file_bytes`; built where needed by process/config.json's generated row, the deploy and the release assemble, before the bundles; BOB) | case-checker (through `bundler`; K1315) | `node bio-plane/src/case-checker/build-program.mjs` | `node --test bio-plane/test/m/case-checker/program.test.mjs` |
| `court-citations/court-data.mjs` | court-citations (vendored packages; K1518) | `node court-citations/build.mjs` | `node court-citations/build.mjs --check` |
| `bio-plane/src/wizard-scripts/screen-registry.mjs`, `bio-plane/src/wizard-scripts/front-doors.mjs`, `bio-plane/src/wizard-scripts/civicsmith-library.mjs` | wizard-scripts (the design registry; K3771) | `node bio-plane/src/wizard-scripts/build-data.mjs` | `node bio-plane/src/wizard-scripts/build-data.mjs --check` |
| `site/src/pages.mjs` | site (K3372) | `node site/build.mjs` | `node site/build.mjs --check` |
| `bio-plane/public/newgroup/index.html` | installer (R79; K4073) | `cd newgroup && node scripts/invite-page.mjs` | `cd newgroup && node scripts/invite-page.mjs --check` |
| `bio-plane/dist`, `pdf-worker/dist`, `ocr-worker/dist`, `agent-runner/dist`, `agent-worker/dist`, `sheet-worker/dist`, `file-scanner/dist` | each member (`bundler`; the plane `not_product`) | `node bio-plane/scripts/bundles.mjs` | `node --test --test-force-exit bio-plane/test/system/fleetbundles.test.mjs` |
| `newgroup/dist` | installer (K4083) | `cd newgroup && npm run build` | `node --test --test-force-exit bio-plane/test/system/newgroup-bundle-fresh.test.mjs` |

The sheet-worker's vendored engine `assets/sheet-engine.wasm` is rebuilt only by `npm run build:engine` there (rustup's `wasm32-unknown-unknown` and `wasm-bindgen-cli` 0.2.126; K1531), never at a merge.

## Parallel work: the UX design stream (Bob, 2026-10-01; K945)

Bob's UX design work runs under his **primary account**, outside this process and its sessions (today on branch `claude/gallant-brown-zg0wc1`, today UX design #46, `session_018BhceeSwn6V6RdavfMqjcH`, started by BOB #330 from #45's prompt (`a22295bbb6`), K5295; earlier sessions archived by their successors). It writes `docs/development/ux-substrate/`, mints **DEC** ids (DEC-96 onward) for Bob's UX rulings, and amends canon documents under `docs/architecture/`. Every record this process writes (rulings, plans, job records, handoffs, reports to Bob) recognises it:
- Its DEC rulings are Bob's, made there; this process never mints a DEC id, cites them as that stream's, and folds a DEC into module requirements only once it is on `main` (or Bob names it), as a requirement change with its DEC cited.
- Its files are its own: no session of this process edits, reverts or re-words `docs/development/ux-substrate/` or that stream's canon amendments, and a merge conflict with them is resolved by keeping its text. One exception (Bob, K5681): BOB adds a module's `reads` entry in `screens/words-reads.json` for a key already in the stream's `words.json`, never wording.
- Entries left out as "Bob's: UX" (K633; N470 and the legacy-ui shares in `plan/next.md`) wait on that stream's outcome, not on a question from this process.
- `main` can move while a tranche runs when that stream lands: a tranche's close then merges `main` into the tranche branch (never a rebase or force) and runs the checks before the fast-forward.
- A report to Bob says what this process did; it never presents that stream's decisions as this process's work.

## Parallel work: the investigation design lane (Bob, 2026-10-07; K2076)

Bob's design of the investigation engine and the project as an investigation (K1627, K2064, K2075) runs in its own session, **INVESTIGATION-DESIGN** (#2: `session_01WzvEVTg39Jijv4CesGz4Dc`, started by BOB #145, K2398; #1 `session_01MoJa8LUVd6PRJDtgoSdRvj` archived), on branch `design/investigation`, writing only `docs/development/investigation-design/`. It works with Bob directly and records his decisions as D-numbers (the study's D1–D24, new ones from D25), never K or DEC. Its `HANDOFF.md` (entries `H<n>`) is read by BOB at takeover and at every backstop check; BOB folds each hand-off into requirements (N748) and answers with the K that folds it. Its screens are owed to the UX design stream. A successor (`#n+1`) is started by the BOB of the day when the lane asks.

## Parallel work: the beta's design lanes (Bob, 2026-10-27; K5417, K5418)

AI-DESIGN, PLATFORM (which carries the former PERFORMANCE lane's scope), CAPABILITIES, FILES, JOURNEYS, TESTS-SWEEP and PLANNING: their rules, scopes, branches, folders and current sessions are in `build/plan/beta/LANES.md` (§3 the sessions), the needs between them in `build/plan/beta/MAP.md`. BOB reads each lane's `HANDOFF.md` section 0 at takeover and at every backstop check and merges each lane's folder into the tranche. The earlier lane sessions (AI-DESIGN #1, JOURNEYS #3, PERFORMANCE #3) are superseded by these.

## Parallel work: the process repair (Bob, 2026-10-28; K5791)

The PROCESS-REPAIR lane builds and certifies the fixes of Bob's analysis "Civicsmith Merge Slowdown" with his four answers (K5791): first aid, then a GitHub merge queue, generated files and screenshots out of git (screenshots to R2, deleted once a walk is analyzed). Its charter and `HANDOFF.md` are in `lane-process-repair/` on civicos-process branch `lane/process-repair`; BOB reads section 0 at takeover and each backstop check and merges each certified phase. Product work waits on it. Current: **PROCESS-REPAIR #1**, `session_018Bhced86RzzxLW63fnTCmx` (started by BOB #333).

## Parallel work: the process redesign (Bob, 2026-10-26; K5334; ended K5351)

The PROCESS-REDESIGN lane designed, built and certified the redesigned process, now in use (civicos-process `main`); its record is `lane-process-redesign/HANDOFF.md` there (R1-R17). It ended once T51b R1 ran clean on the process (#3 `session_016AUJRfwhxT75qBeN33AT57` archived; #2 left idle, K5344). Its last work, R14 (test runs that name a missing result's cause, the memory watch, `proc tests`), is civicos-process PR #13, merged by BOB at T52's open (`next.md`). A new process fault goes to BOB, or to a lane BOB restarts.

## Parallel work: the reading architecture (Bob, 2026-10-23; K4812; ended K4834)

The READING-ARCHITECTURE lane designed how Civicsmith reads every file type and large file; Bob confirmed its architecture (K4831: D staged, C the fallback). Its deliverables, with Stage 0's measurements (`stage0/RESULTS.md`, K4838), are under `build/plan/lane-reading-architecture/` on the tranche; `GAP.md` is T51's reading work (K4834), its Stage 1 fix round 9 (K4837). The lane is ended; its sessions are archived.

## Starting a session

- **ROOT** (mechanics §2, K156): started by Bob, the parent of every BOB; reads `roles/ROOT.md`; woken by a BOB's `send_message` and by the platform's event when a BOB it started fails. Current, on Bob's **primary** account: **ROOT #10**, `session_01XHjMEPkzmkLycoWtxb4yn6` (started by Bob 2026-10-26, replacing ROOT #7 `session_01NBNGB2ziVqiZg4ewLgRSWm`; K5313), replaced (by Bob) when its context passes 55% of its window (Bob, 2026-10-11, K2679). ROOT #5 `session_0187SrKsqhqzSTqwDk2hzcXy` is archived. On the **third** account, where the work runs since BOB #269 (K4786-K4790): **ROOT #9**, `session_01GndWUi5ubGmXCVVnFqtJAi` (started by Bob 2026-10-23; K4789), which started BOB #269. On the **secondary** account, superseded by ROOT #9 and unreachable from the third: **ROOT #8**, `session_01R3hvN64bYHG3vPQmYmaeLR` (started by Bob 2026-10-20; K4213), which started BOB #232 to #268; ROOT #6 `session_01FXbdTJZyPp3Bhcv7pfVSR1` (2026-10-07; K2022) is superseded. Sessions on one account are unreachable from the other. Earlier ROOTs are archived (rulings K693–K2022).
- **BOB, a job, a lane, ROOT:** invoke the skill `neoprocess` with the role (`CLAUDE.md`); it prints the reading and the start command.
