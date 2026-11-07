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
