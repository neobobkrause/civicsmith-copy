Length: 95 lines. Last section: "What this suggests for a composition root's scope".

# Best practice: what a composition root should hold, and where whole-system tests should live

Research note for the plane-scope lane. Web searches on 23 Nov 2026. Claims not backed by a listed source are marked "(from general knowledge)".

## In plain English

The product is built from a long, ordered list of modules. The last one, the composition root, plugs them all together into the program that gets deployed. Because the whole-system tests need everything plugged in, all of them ended up in that last module. That causes three problems: any change to the last module runs every slow test; a module whose promise is only checked there gets no check when that module itself changes; and the owner of the last module ends up fixing other people's breakages.

The published practice largely agrees on five points:

1. **The composition root should be thin, and its own tests few.** It wires things together. It should check that the wiring works, not re-prove every other module's behaviour.
2. **Each module should prove its own promises in its own tests.** To make that possible without depending on later modules, earlier modules publish "stand-ins" (fakes) and agreements about how the parts talk to each other (contracts). Then each side checks itself against the agreement.
3. **Some genuinely whole-system tests are still worth having,** but only a few. They are the slowest and least reliable tests, so they belong in a clearly named place with a clear owner and a time budget.
4. **Slow test suites are made affordable by:** running only the tests a change can affect, splitting a suite across machines, and starting the expensive runtime once instead of once per file.
5. **Upgrade tests from old releases** are normally kept as saved sample data per supported release, with a written rule for how far back upgrades are supported. Older releases are then retired from the tests on purpose.

## 1. Where integration and end-to-end tests live, and who owns them

- Google sorts tests by *size* (what resources they may use), not by name. Small tests run in one process, medium tests on one machine, and large tests may span systems. Google's data shows large tests are much flakier (about 14%, against 0.5% for small tests), so it keeps them few and deliberate. *Software Engineering at Google* ch. 14 says each large test needs a clear owner, or it rots.
- Google's "Just Say No to More End-to-End Tests" argues that a failure in a broad test is hard to trace to its cause and slow to report. It recommends a 70/20/10 split of unit, integration and end-to-end tests (from general knowledge for the exact ratio).
- The test pyramid (Fowler; Vocke) recommends many fast, narrow tests and few broad ones. The "testing trophy" (Dodds) puts most effort into integration tests. In both, the broadest end-to-end tests are a thin layer. The two views differ on the middle layer, not on that top one.
- Mark Seemann: the composition root is the single place where the object graph is put together. Each unit test is its own small composition root, wiring the unit under test to stand-ins. The real root is tested with a few "does it start and wire correctly" checks (from general knowledge for the "few smoke tests" wording).
- Hexagonal architecture, or ports and adapters (Cockburn): a module talks to the world through ports. Tests plug fakes into those ports, so "system-level tests can run without production connections". Every adapter is then checked once against the real thing.

Sources:
- Google Testing Blog, "Test Sizes" — https://testing.googleblog.com/2010/12/test-sizes.html
- *Software Engineering at Google*, ch. 14 "Larger Testing" — https://abseil.io/resources/swe-book/html/ch14.html
- Google Testing Blog, "Just Say No to More End-to-End Tests" — https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html
- Mark Seemann, "Composition Root" and "Composition Root location" — https://blog.ploeh.dk/2011/07/28/CompositionRoot/ , https://blog.ploeh.dk/2019/06/17/composition-root-location/

## 2. Letting a module prove its behaviour in the whole system without depending on later modules

- **Dependency inversion with published fakes.** An early module defines the interface, called a port, and ships an in-memory fake of it. Later modules test against the fake. Gradle's `java-test-fixtures` plugin is a mainstream example of this: a module publishes "fake implementations, test data builders" for other modules' tests. In an ordered list, this is an early "test-support" module that every later module may import.
- **Contract tests at the seam.** In consumer-driven contracts (Robinson, Fowler; the Pact tool), the consumer records what it expects. The provider's own CI replays those expectations against the real provider. Each side is checked in its own job, so neither needs the other present. The limitation is that contracts check shape, not meaning, and they do not replace a few real end-to-end checks.
- **A whole-system harness as a dev-only service.** One module, placed early, offers "boot the system with these parts". A module's test then supplies its own real part and fakes for anything later in the order. This is common practice: in-process test hosts such as ASP.NET's WebApplicationFactory, and Miniflare for Workers (from general knowledge). The harness must not itself import later modules. Otherwise it simply recreates the dependency.
- **A final "acceptance" module.** The whole-system tests move out of the composition root into a module placed after it, which owns only those tests. This separates "the wiring changed" from "the system's behaviour changed", so a change to the root no longer runs every test. It does not by itself give earlier modules their own proof (from general knowledge).
- **Rule of thumb:** a requirement should be proven in the job of the module that owns it. A broad test elsewhere can confirm it again, but should not be the only proof (from general knowledge; consistent with Google's ownership advice above).

Sources:
- Gradle, "Java Test Fixtures plugin" — https://docs.gradle.org/current/userguide/java_test_fixtures_plugin.html
- Microsoft Engineering Playbook, "Consumer-Driven Contract Testing" — https://microsoft.github.io/code-with-engineering-playbook/automated-testing/cdc-testing/
- Thoughtworks Technology Radar, "Consumer-driven contract testing" — https://thoughtworks.com/radar/techniques/consumer-driven-contract-testing
- Eric Gunnerson, "Unit test success using ports, adapters and simulators" — https://learn.microsoft.com/en-us/archive/blogs/ericgu/unit-test-success-using-ports-adapters-and-simulators

## 3. Keeping CI runs under a time budget

- **Test impact analysis.** Use the dependency graph to run only the tests a change can reach. Dropbox and the `bazel-diff` tool do this from Bazel's graph. Two cautions apply: undeclared inputs make selection unsafe, so also run the full suite on a schedule; and the biggest gains come from filtering integration and acceptance tests, because unit tests are already cheap. In an ordered module list, "a module plus everything after it that imports it" is a natural impact set (from general knowledge).
- **Sharding.** Vitest splits files across machines with `--shard=i/n` and merges the per-shard reports afterwards. One team cut a 15-minute job to about 4.5 minutes this way. Shard boundaries are set by file, so one huge file still bounds the run time.
- **Share the expensive fixture.** Cloudflare's Workers Vitest integration "tries to minimise the number of workerd processes it starts" and reuses module caches. Isolated storage is per test file, and from v0.13 (Vitest 4) the old `singleWorker` switch has gone, so each test file pays a storage reset. Fewer, larger test files with a shared booted runtime are usually cheaper than many small ones. Measure this before restructuring (from general knowledge).
- **Snapshot fixtures rather than rebuilding them.** Build migration and seed stores once, save them, and load them in tests. This replaces replaying history on every run (see section 4).
- **Budgets.** Set a time limit per suite and per test (for example, "no module's job over 15 minutes"), and treat a breach like a failed test (from general knowledge). Google's size labels attach timeouts to each size.

Sources:
- Dropbox, "Continuous integration and deployment with Bazel" — https://dropbox.tech/infrastructure/continuous-integration-and-deployment-with-bazel
- Cloudflare, "Isolation and concurrency" (Workers Vitest integration) — https://developers.cloudflare.com/workers/testing/vitest-integration/isolation-and-concurrency/
- Vitest, "Improving Performance" (sharding) — https://vitest.dev/guide/improving-performance
- Contentstack, "How sharding Vitest cut CI from 15 minutes to 4.5" — https://developers.contentstack.com/blog/the-waiting-tax-on-every-pr-how-sharding-vitest-cut-ci-from-15-minutes-to-4-5

## 4. Testing data migrations from past releases

- **Stored fixtures per old version.** Drupal keeps database dumps of old major versions as fixtures. Drift (a Dart database library) exports a schema file per version and tests each step of the upgrade path. OpenStack Ironic walks every migration from the first to the latest, inserting data before chosen steps to check that the data survives.
- **Test against the versions a migration can actually meet.** GitLab runs a "multi-version upgrade" CI job from the latest *required upgrade stop*, seeding data first. A GitLab epic argues for testing new migrations against the previous version's data.
- **Supported-upgrade windows.** GitLab publishes required stops (for example 18.2, 18.5, 18.8 and 18.11). An installation more than one window behind must upgrade in steps. That limits how many old versions the tests must cover, so older fixtures can be retired.
- **Ownership:** a migration test belongs to the module that owns the stored data's shape. It needs that module's code and the saved fixtures, not the whole system (from general knowledge). Only a final "upgrade an old release end to end" check needs everything.

Sources:
- GitLab, "db:migrate:multi-version-upgrade job" — https://docs.gitlab.com/development/database/dbmigrate_multi_version_upgrade_job/
- GitLab, "Plan your upgrade path" (required stops) — https://docs.gitlab.com/update/upgrade_paths/
- Drift, "Testing migrations" — https://drift.simonbinder.eu/docs/migrations/tests/
- Drupal, "Generating database fixtures for migration tests" — https://www.drupal.org/docs/drupal-apis/migrate-api/generating-database-fixtures-for-migration-tests

## 5. Splitting a "god module" by responsibility

- Parnas (1972): divide a system so that each module hides one design decision that is likely to change, not by the steps the program runs. A composition root that holds 145 tests for other modules' decisions is hiding many decisions it does not own.
- Fowler's refactorings "Extract Class" and "Move Function/Field" apply at module scale: move each test to the module whose decision it checks, then extract what remains shared, such as harnesses, fixtures and builders, into its own module (from general knowledge for the module-scale application).
- A practical order (from general knowledge): first sort the tests by the requirement they prove, then move the ones that need nothing later than their owner. Next, give the rest an early fake or harness. Finally, leave only true whole-system tests in one place.

Sources:
- D. L. Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules" (CACM 1972) — https://cse.sc.edu/~mgv/csce330f24/ParnasCriteria.pdf
- Daniel Berry, "Parnas's Criteria for Decomposing Systems into Modules" — https://cs.uwaterloo.ca/~dberry/parnas.html
- Martin Fowler, Refactoring catalog (Extract Class, Move Function) — https://refactoring.com/catalog/ (from general knowledge; not opened)

## What this suggests for a composition root's scope

- **Shrink the composition root to wiring plus a few smoke tests.** These check that it boots, that every module is registered, and that one request goes end to end. *Gives:* a root change runs in minutes, and the root's owner stops fixing other modules' failures. *Costs:* every moved test needs a new home, which is real migration work across many modules.
- **Move each requirement's proof to the module that owns it,** using fakes and fixtures published by earlier modules. *Gives:* each module gets its proof when its own job runs. *Costs:* the fakes must be written and kept true to the real thing. A fake that drifts gives false confidence, so each fake needs a contract check against the real module.
- **Add an early "test-support" module** with fakes, data builders and a harness that boots the system from whichever parts a test supplies. *Gives:* modules can test "in the system" without importing later modules. *Costs:* it becomes a widely imported module, so changes to it start many jobs, and the harness must not quietly import later modules.
- **Use contract tests at the main seams,** such as storage, the request router and the Durable Object interface. The consumer records its expectations and the provider replays them in its own job. *Gives:* both sides of a seam are proven separately and cheaply. *Costs:* contracts check shape, not meaning, so a small number of real end-to-end tests are still needed.
- **Put the remaining true whole-system tests in a separate final "acceptance" module** after the root, with a named owner. *Gives:* root changes stop triggering them, and their failures go to a clear owner. *Costs:* one more module and job. It still runs long, and requirements proven only there still get no proof in their owner's job.
- **Give migration tests their own home, beside the module that owns the stored data's shape,** with saved per-release fixture stores and a published supported-upgrade window. *Gives:* migration checks run when the data shape changes, and old releases are retired on purpose. *Costs:* building and storing a fixture per release, and a policy decision on how far back upgrades are supported.
- **Select tests by impact:** run a module's tests plus those of later modules that import it, and run the full suite nightly. *Gives:* most jobs run a fraction of the tests. *Costs:* depends on an accurate import graph, and undeclared inputs can let a break slip through until the nightly run.
- **Share the booted runtime and shard what remains:** fewer, larger test files per workerd boot, plus `--shard` across parallel CI machines. *Gives:* wall-clock time drops well below the 45-minute limit without dropping tests. *Costs:* more CI machines in use, report merging, and care that tests sharing a runtime do not leak state into each other.
- **Set and enforce a per-module time budget,** for example about 15 minutes, with a breach treated as a failure. *Gives:* slowness is caught early, before it reaches the hard limit. *Costs:* someone has to act on breaches, and some legitimate large tests will need an explicit exception.
