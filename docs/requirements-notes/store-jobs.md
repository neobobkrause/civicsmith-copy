# store-jobs: notes of the job (attempt 1, 7 Nov 2026)

For BOB. Plain notes of what the job did and what it could not do inside its paths.

## R24: built and tested

- `pending.mjs`: `member` added last to `JOB_KINDS` (so `PENDING_KINDS`), to `SESSION_KEYED` (`["subresources", "fetch", "member"]`) and to `RANK`;
  not `HEAVY`, so a tick runs it with the light kinds before the one heavy row. Its owner calls acquisition's `fileMember` (R136) with the row's
  `detail` (`container`, `container_kind`, `index`, `project`, `within`), `cls: "daemon"` and the registrar; `filed`, `already_held`, `not_filed`
  end it `finished`; `BAD_MEMBER` and `NO_SUCH_MEMBER` (refusals on the row's own facts, R76 (3)) end it `final` with the code; anything else
  (`WAITING`, `CONTAINER_NOT_HELD`, a store failure) stays owed and backs off.
- Tests: `bio-plane/test/m/store-jobs/r24-member.test.mjs`, six, all failing with `pending.mjs` reverted. The seam case uses the real `acquire`
  of a ZIP (acquisition R38 registers the rows) and the real `fileMember`.

## What blocks the merge: tests outside these paths

R24 says the pinned tests change in the same commit. Two of them are `store-assembly`'s files:

- `bio-plane/test/m/store-assembly/r9-jobs.test.mjs:22` `SESSION_KEYED = ["subresources", "fetch"]` -> add `"member"`;
  `:41` the expected kinds -> add `"member"` last. With R24's code and this file unchanged, the test
  "R74 jobRow: one row for each (sha or session, kind) ..." fails (checked: 71 pass, that one fails, over r9-jobs, r10-fixtures-run,
  fix6-pending, test-support doubles and acquisition t53-member).
- `bio-plane/test/m/store-assembly/r10-fixtures-run.test.mjs:56` `KINDS` and `SESSION`: add `"member"` (it passes unchanged, but then does not cover the kind).
- `bio-plane/test/job-registrar-stub.mjs` and `test/m/test-support/doubles.test.mjs` already carry `member` (test-support's work); nothing owed there.

## R25 and R26: not this module's code

- R25: whether a `safe_view` row is registered is decided by `file-safety`'s `#registerJobs` (`bio-plane/src/file-safety/index.mjs:291`,
  `#NO_VIEW` lists `png|jpe?g`); the registrar registers whatever kind it is handed. Meeting R25 is an edit of file-safety's rule, not of `pending.mjs`.
- R26: a change to the R75 200 MiB case in `store-assembly`'s `r9-jobs.test.mjs` (name the input `.zip`); outside these paths.

## Provider notice scheduler:748

Confirmed, no change: none of this module's code calls `Scheduler.listenTo`; the job wiring uses the scheduler's `register`.

## Not done

- A `filed` member whose answer carries a document (a message's attachment) is not handed to control-plane's `deliver`: that delivery is keyed
  by a capture session it loads, which a member's `<container>!<index>` key is not. R24 says the row ends `finished` on `filed`; whether the
  document is promoted is acquisition's or control-plane's to say.
