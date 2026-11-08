# installer-copies — notes

**For BOB and the next installer job.** Written by installer-copies' job, attempt 1, 7 Nov 2026.

## R13 and R24: met by the code already on layer/11

Both marks were stale. The per-slug naming installer built for R64 (`namesFor` in `newgroup/src/steps/account.mjs`) already meets them:

- **R13.** `installFleet` (`newgroup/src/steps/install.mjs`) binds each `r2_buckets` entry a member's signed Worker part states to `names.role(bucket)`, so the file scanner gets `CAPTURES` → `bio-captures-<slug>`, the copy's own bucket. The plane gets its own `CAPTURES` and `PUBLISHED` the same way.
- **R24.** `ensureBuckets` (`newgroup/src/steps/probes.mjs`) creates `bio-captures-<slug>` and `bio-published-<slug>`, and every member Worker is named `<member>-<slug>`. A second copy in the same account shares no bucket and writes nothing the first holds. An install under a short name that a copy already holds is refused before anything is written (R64's `screen.install.stopped.nametaken`).

No product code changed. The tests in `bio-plane/test/m/installer-copies/isolation.test.mjs` run the installer end to end. They use installer's own fixture (`newgroup/test/fixture.mjs`) and a release that fixture signs when the test runs. I checked that both tests fail when `install.mjs` binds the fixed name `bio-captures` in place of `names.role(...)`.

## Already without marks

R32 (replaced by R62 and R64), R62, R63, R64 and R65 have no mark. Installer's own tests cover them (`newgroup/test/t50.test.mjs`, `newgroup/test/requirements.test.mjs`).

## Owed elsewhere (not this job's paths)

`newgroup/test/requirements.test.mjs` still holds `test.todo` lines for R13 (line 476) and R24 (line 931), saying "not yet met". They belong to installer's job, which removes R13, R24, R32 and R62 to R65 from `installer.md` in its next attempt.

## Attempt 2: re-tested against instance-setup's new interface (7 Nov 2026)

Instance-setup's change (land 2914227e80, its F2) changes only how `memberVersions` reads `agent-runner` from agent-worker's `/version`. Nothing this module rules reads that: the installer reads a copy's facts through `op=bootstrap` (R63), whose seven facts are unchanged. The suite (`isolation.test.mjs`, `requirements-split.test.mjs`) was run again on a branch that holds 2914227e80: 4 of 4 pass. No code or test changed.

## Attempt 3: re-tested against installer-steps' new interface (8 Nov 2026)

Installer-steps' change (land 68fee9c633, PR 957, marked additive) adds one test, `newgroup/test/steps/instance-setup-f2.test.mjs`. It covers how the serving verdict reads `agent-runner`'s version through agent-worker, after instance-setup's F2. It changes no installer code: `newgroup/` on this branch is identical to 68fee9c633. Nothing this module rules reads the serving verdict. R13 and R24 rest on per-slug bucket and worker names, and R62 to R65 on the existing-copy page and removal. The suite was run again on this branch, which holds layer/11 at 505d52143 and so holds 68fee9c633: 4 of 4 pass. No code or test changed.
