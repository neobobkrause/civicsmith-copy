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
