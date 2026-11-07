# store-assembly: requirements notes

## Split proposal (job store-assembly, attempt 1, 4 Nov 2026), for BOB

**Why the move alone cannot meet the cap.** `build/requirements/store-assembly.md` is 95,700 bytes against the 70,000 cap. Its requirement lines alone (every `- **R<n>**` line, kept verbatim as the START asks) come to 77,954 bytes, and with their indented sub-items 86,721. Moving every other line (status, size, purpose, terms, Uses, Satisfies, Suggestions, Open for Bob: 17,746 bytes) still leaves the file over 70,000. So, as the START directs, nothing was moved and this is a split proposal.

**Bytes by group** (requirement lines with their sub-items):

| group | ids | files | bytes |
|---|---|---|---|
| assembled store | R1–R10, R99 | assemble.mjs, index.mjs | 8,627 |
| what the assembly composes | R11–R48 | assemble.mjs, wiring.mjs, wizards.mjs, owners.mjs | 23,656 |
| ask, draft and transcription doors | R49–R59 | ask.mjs, transcribe.mjs, unpack.mjs | 12,478 |
| owed-work ledger, job table, alarm | R60–R82, R102–R104 | pending.mjs, casesweep.mjs, acquire-timings.mjs, stats.mjs | about 23,600 |
| op declarations | R83–R85 | register.mjs, declarations.mjs, declared.mjs | 4,254 |
| owner map | R86–R89 | owner-ops.mjs | 5,588 |
| storeWorld | R90–R94 | test/m/store-assembly/world.mjs | 4,292 |
| words, invariants | R95–R98, R100, R101 | — | about 4,200 |

**Proposed new modules.** The two groups that already live in their own files, with imports that run one way only (`assemble.mjs` imports them; they never import `assemble.mjs`):

1. **`store-jobs`**: the owed-work ledger, job table and object alarm. Takes R60–R82 and R102–R104 (renumbered R1… in its own file, each keeping a `(was store-assembly R<n>)` note). Files: `pending.mjs`, `casesweep.mjs`, `acquire-timings.mjs`, `stats.mjs`. About 24 KB.
2. **`store-ask`**: the ask, draft and transcription doors. Takes R49–R59. Files: `ask.mjs`, `transcribe.mjs`, `unpack.mjs`. `transcribe.mjs` imports `pendingOf` from `pending.mjs`, so `store-ask` uses `store-jobs`. About 12.5 KB.

`store-assembly` keeps R1–R48, R83–R101: about 50.7 KB of requirement lines, under the cap with room for its Uses and Invariants.

**`build/modules.json` rows**, inserted directly before `store-assembly` (both are layer 11; every module they use already sits earlier in the file):

```json
{"id": "store-jobs", "layer": 11, "paths": ["bio-plane/src/store-jobs/"], "tests": ["bio-plane/test/m/store-jobs/"], "uses": ["acquisition", "ai-runs", "basis-versions", "capture", "connections", "extraction", "inquiry", "member-roster", "membership", "observation-log", "project-roster", "record-core", "run-productions", "scheduler", "test-support", "setup-words"]},
{"id": "store-ask", "layer": 11, "paths": ["bio-plane/src/store-ask/"], "tests": ["bio-plane/test/m/store-ask/"], "uses": ["store-jobs", "acquisition", "ai-accounts", "ai-runs", "ai-use", "answers", "capture", "credentials", "hypotheses", "membership", "network-notices", "record-core", "run-rules", "setup-words", "signin-door", "translations", "agent-worker", "test-support"]},
```

and `store-assembly`'s `uses` gains `"store-jobs", "store-ask"`. The `uses` lists are the imports of the moved files today (`grep 'from "../'`), plus `test-support` and `setup-words` for tests and words; the job that does the split checks them against its tests.

**`build/layers.md`**, layer 11 row: insert `store-jobs, store-ask` directly before `store-assembly`.

**Callers.** `plane` imports `askOp`, `actionDraftOp`, `ACTION_DRAFT_OPS`, `askOnObject`, `draftOnObject` and `traceStamped` through `store-assembly/index.mjs`. `store-assembly` re-exports them from the new modules, so `plane` does not change.

**Provider notices.** `action-clocks:60` and `run-rules:72` were not answered: they wait for the split. `run-rules` is used by `ask.mjs`, so after the split that notice goes to `store-ask` (and to `store-assembly` only if `assemble.mjs` reads the changed ids).

## The split as landed (job store-assembly, attempt 1, replacement session, 4 Nov 2026)

BOB accepted the split above and landed it on `tranche` (PR 109 `store-jobs`, PR 110 `store-ask`). This job retired the moved lines in `build/requirements/store-assembly.md`, each as one line naming its new id (`- **R<n>** *(retired: moved to <module>:R<m>, K617)*`), so ids stay traceable and are never reused: R49–R59 → `store-ask` R1–R11, R60–R82 → `store-jobs` R1–R23, R102–R104 → `store-jobs` R24–R26. The unmet marks of R102–R104 (T53) travel with them. The file went from 95,700 to about 62 KB, under the cap, with no other text moved. `requirements-split.test.mjs` pins the start commit's ids and marks and checks each moved line against its new module's copy. The code (`pending.mjs`, `casesweep.mjs`, `acquire-timings.mjs`, `stats.mjs`, `ask.mjs`, `transcribe.mjs`, `unpack.mjs`) stays here until the new modules' jobs build it.

## Provider notices ai-accounts:316 and ai-catalogue:317 (job store-assembly, attempt 6, 4 Nov 2026)

- **ai-catalogue:317** (exports `DEVELOPMENT_KEY_VAR`): affected, and no code change needed. `assembleStore` builds the storage's one catalogue with the deployment's `env` (`assemble.mjs`, `aiCatalogueOf(ctx, {record, env, clock})`) before `credentials`, `ai-use` and `ai-runs` reach it (the last two ask it without `env`). So a development deployment (`AI_CATALOGUE_DEVELOPMENT` "1") trusts its `AI_CATALOGUE_DEVELOPMENT_KEY` line, and a deployment that does not set that variable refuses the same seed. `notice-ai-catalogue-317.test.mjs` tests both cases and the build order.
- **ai-accounts:316**: already answered by PR 325 (attempt 5). The disclosure and sign-in door fixtures were respelled to `member:ann` in `t46.test.mjs` and `t47.test.mjs` (the R37 signin-door map test). Nothing more changes here.

## Attempt 10 (job store-assembly-2, 7 Nov 2026): found items and provider notices

- **Found items F1-F3** (requirements file, met): F1 removes the assembly's own `register-import` registration (dead: `scheduler` R34's own consumer holds the name, so it was refused `CONSUMER_DECLARED`); F2 hands `following` its keyed store (`following` R41); F3 hands `notice-producers` `importsEnded` beside `readingsEnded` (`noticeProducerFeeds`, for `notice-producers` R31). Test `found-f1-f3.test.mjs`, each test failing with its own change reverted. The split test (`requirements-split.test.mjs`) now checks the R ids against the split and the F ids apart.
- **Re-tested**: `admission` (a37e42fa05), `op-grades` (49ab2cf375), `queue-producers` (6830db9cff), `op-declarations` (e4c350c01d): the module's suite over the tranche with them landed; no code change.
- **following:744**: adapted (F2). **scheduler:748** (`Scheduler.listenTo` changed): the assembly calls no `Scheduler.listenTo` (its `listenTo` is `observation-log`'s); confirmed, with F1 answering R34. **registers:426**: confirmed; F3 reads its `importsEnded`.
- **ai-use:378, ai-use:613** (`useEstimate` changed, `budgetSet` added): the owner map's `aiestimate` arm calls `estimate`, not `useEstimate`; confirmed, no change.
- **actions:715** (`actionOverdue`, `actionZone` changed), **action-records:696** (`lawEntries` removed): the assembly calls none of them; it spreads `actionRecordsOps` and the actions map only; confirmed.
- **The rest** (agent-worker 364, 569; ai-runs 391, 485; inquiry-grammar 423; mail-door 428; local-facts 429; extraction 432; member-roster 446; ai-accounts 483; ai-catalogue 484, 611; instance-setup 544; wizard-scripts 546; investigation 628; publication 632; network-notices 633; case-checker 634; case-import 635; case-disclosures 636; public-read 642; case-carriage 658; case-authoring 681; filing-templates 712; action-plans 726; filings 727; monitoring 743): source changes or added exports the assembly does not name; it builds each by its factory and spreads its ops map as before; confirmed by the suite, no change.
