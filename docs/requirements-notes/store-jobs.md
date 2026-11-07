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

## The pinned store-assembly tests (paths widened by BOB, PR 813; replacement session)

- `bio-plane/test/m/store-assembly/r9-jobs.test.mjs`: `SESSION_KEYED` and the expected kinds gain `member` (last); the R74 loop now registers and reads back a `member` row.
- `bio-plane/test/m/store-assembly/r10-fixtures-run.test.mjs`: `KINDS` and `SESSION` gain `member`.
- `bio-plane/test/job-registrar-stub.mjs` and `test/m/test-support/doubles.test.mjs` already carry `member` (test-support's work).
- Checked: r9-jobs, r10-fixtures-run, fix6-pending, test-support doubles and acquisition t53-member, 73 pass.

## R26: met

- The R75 200 MiB parted-upload case in `r9-jobs.test.mjs` (skipped since R104) names `big.zip` and runs; its control names the same size `.pdf`,
  refused `TOO_LARGE` by capture R119, with no job row and no upload opened. The evidence-key control (`PARTED_UPLOAD_UNAVAILABLE`) stays.
- The receipt's R26 test is `bio-plane/test/m/store-jobs/r26-size-ceiling.test.mjs` (the receipt takes only this module's tests): the 200 MiB `.zip` begins and its
  jobs register (`unpack` by digest, `member` by session); the `.pdf` control is refused with no job. R26 itself is a test-only change: the file fails with
  the change reverted only through its `member` registration (R24's code), which is said here plainly.

## R25: not this module's code (open)

- Whether a `safe_view` row is registered is decided by `file-safety`'s `#registerJobs` (`bio-plane/src/file-safety/index.mjs:291`,
  `#NO_VIEW` lists `png|jpe?g`); the registrar registers whatever kind it is handed. Meeting R25 is an edit of file-safety's rule, not of `pending.mjs`.
  Left open and named in `--not-verified`.

## Provider notice scheduler:748

Confirmed, no change: none of this module's code calls `Scheduler.listenTo`; the job wiring uses the scheduler's `register`.

## Not done

- A `filed` member whose answer carries a document (a message's attachment) is not handed to control-plane's `deliver`: that delivery is keyed
  by a capture session it loads, which a member's `<container>!<index>` key is not. R24 says the row ends `finished` on `filed`; whether the
  document is promoted is acquisition's or control-plane's to say.
