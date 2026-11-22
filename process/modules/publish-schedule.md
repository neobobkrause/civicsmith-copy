Length: 186 lines. Last section: "Suggestions".

# publish-schedule: requirements

Next number: 13

| old (`publication`) | new | |
|---|---|---|
| R66 | R1 | `scheduleEdition` |
| R67 | R2 | `publishWake`, `publishDue`, the publisher |
| R68 | R3 | `publishAtMove`, `publishAtCancel` |
| R69 | R4 | `scheduledEditions` |
| R70 (its set-time share) | R5 | the waiting edition's signing instant |
| R71 | R6 | `onPublishScheduled` |
| R74 | R7 | `waitingEditionOf` |
| (new: the seam, K31's pattern) | R8 | the waiting-edition source registered with `publication` |
| R33 (its C-122.5 share) | R9 | row C-122.5 |
| R31 (its share: the T34-79 table) | R10 | `scheduled_editions` declared to purge |
| R34 (a copy) | R11 | no place named |

## Public

### Purpose

Publishing a signed case edition at a set time (DEC-147). The case ceremony (`ratification`, `op=publishat`) signs and, in place of `publication` R22's commit, sets the edition to wait here. Its signature is held beside the document, never on it, so until the edition is published its document answers as an unsigned preparation and nothing of it is public (`publication` R29).

At its time the one publisher `ratification` registers runs every signing check again and commits through `publication` R22 only when nothing has changed. Otherwise the edition stops, once, and publishing it needs a new signing. An owner of the case's project may move or cancel the time until it comes.

This module holds the waiting editions and their table, and the publisher's and the listeners' registrations. It also answers:
- the schedule's read, for the case and the queue;
- the wake, for `scheduler`;
- the waiting-edition read, for `case-authoring`.

Every case-document table and every write to one stays `publication`'s (its R24). This module reads them only under `publication` R40, and `publication` reads whether a document waits through R8.

### Provides

Terms are `publication`'s: a **case**, an **edition**, the **case document**. A **waiting edition** is a signed case edition this module holds to be published at a set time. Every refusal names `reason`; one with a catalogue row carries its `check`, `code` and `translation`.

- **R1** [met] (was `publication` R66; DEC-147 (1), (2))

  `scheduleEdition({case, edition, docSha, signature, signer, deliveredBy, at, checked, by})` is called by the case ceremony (`ratification`, for `op=publishat`) in place of `publication` R22's commit, after every refusal that commit would make has passed, inside the caller's transaction.

  `at` is `{date, time}`: a `YYYY-MM-DD` and a 24-hour `HH:MM`. It is a local time in the team's governing zone, read as `retrieval` R69 reads it: the value that governs on this instance for the `time_zone` path as `local-facts` answers it (its R2, a local correction first), else the active profiles' `time_zone` (`jurisdictions` R41, read through `jurisdictions.combine` over record-core's `jurisdiction_profiles` setting). (T50; N1203, K3635 doubt 5) It is resolved to its instant through `civil-time` (`bounds` of the minute-precision date-time, its `earliest`).

  `checked` is what the ceremony checked at signing, as the publisher of R2 will compare it.

  Refusals, in order, each writing nothing:
  - `PUBLISH_AT_MALFORMED`: a date failing `civil-time.isCalendarDate`, or a time that is not `HH:MM` from `00:00` to `23:59`;
  - `PUBLISH_AT_NO_ZONE`: no zone held (the time is never read as UTC);
  - `PUBLISH_AT_PAST`: an instant not after now (publishing now is `publication` R22's commit);
  - `NO_CASE_DOCUMENT`: no unsigned document of the case edition at `docSha`;
  - `CASE_EDITION_ALREADY_RATIFIED`;
  - `PUBLISH_AT_ALREADY_SET`: the case edition already waits, answered with it.

  Otherwise it records one waiting edition `{case, edition, doc_sha, signature, signer, delivered_by, signed_at, at: {date, time, zone}, publish_at, set_by, state: "waiting", checked}` and answers `{ok: true, case, edition, state: "waiting", at, publish_at}`. The same call again answers `existed: true`.

  The signature is held beside the document, never on it: until R2 publishes it, `publication` R1, R2, R12 and R29 answer the document as unsigned, so nothing of the edition is public.

- **R2** [met] (was `publication` R67; DEC-147 (3), (5))

  `publishWake()` answers the earliest `publish_at` of a waiting edition, or null.

  `publishDue(now)` takes each waiting edition whose `publish_at` is at or before `now`, in `publish_at` order. It hands each, with its `checked`, to the one publisher registered at start: `registerScheduledPublisher({publishScheduled(entry, now)})`, `ratification`'s (K31's pattern, as `publication` R23's provider).

  The publisher may answer asynchronously. `publishDue` awaits each answer before taking the next edition (K1832), and hands it the entry R1 recorded, its held `signature` included.

  The publisher runs again every check signing ran. It commits through `publication` R22 only when each passes and nothing `checked` records has changed since signing: a source the case rests on (`publication` R51's consent, R59's accepted work), a publishing member's confirmation of no undeclared tie, a hold.

  It answers `{published: true, published_at}` or `{stopped: [{code, translation}]}`. Each stop entry is recorded with its `check` and `cause` exactly as the publisher answered them (T39; N805), so a waiting edition stopped by C-122.6 or C-122.7 keeps that code and translation.

  The edition then becomes `published`, with its `published_at`, or `stopped`, with its reasons, once:
  - it is never tried again;
  - a stopped edition has committed nothing (`publication` R22's refusals write nothing);
  - publishing it needs a new signing.

  With no publisher registered, or one that throws or gives neither answer, the edition is `stopped` with `SCHEDULED_CHECK_UNAVAILABLE` (R9) and never published unchecked.

  An edition taken after its time (a late alarm) is checked when it is taken, and keeps both its `publish_at` and its `published_at`.

  *(T51, G54; K4711)* A published answer may carry `after: {containers: [{case, edition, built, code?}]}`, one entry for each case file the publisher assembled (`ratification` R42). When the edition settles `published`, the row stores that list as it stands (an entry keeps only those four keys, its `code` at most 64 characters, the list at most 50 entries with failed ones kept first), or `"unknown"` when the answer gives no list (or the publisher threw after committing), never null, and the `taken` entry and R4's entry of the published edition answer it as `case_file_at_settle`. A row settled before the column existed answers `not_recorded`. It is the state at settle; the current state of an edition's case file is `publication`'s and `public-read`'s, not the row's. A stopped edition has none. The row settles `published` whenever the document is signed, whatever the list says.
- **R3** [met] (was `publication` R68; DEC-147 (4))

  `publishAtMove({case, edition, at, by})` (`op=publishatmove`) and `publishAtCancel({case, edition, by})` (`op=publishatcancel`), by an owner of the case's project (`membership.isProjectOwner`).

  Refusals, in order, each writing nothing:
  - `MACHINE_CANNOT_SCHEDULE_PUBLISH`: a machine or unstamped `by`;
  - `NOT_WAITING`: no waiting edition of that case edition the caller has standing to see (one answer), or one whose `publish_at` has come, naming its state;
  - `NOT_A_CASE_OWNER`;
  - for a move, R1's refusals of `at`.

  A move records the new `at` and `publish_at`, keeping each earlier time with who moved it and when. A cancel makes the edition `cancelled`, with who and when, and its document again an unsigned preparation (`publication` R21), the signature never committed. Each answers R4's entry for the edition.

- **R4** [met] (was `publication` R69; DEC-147 (2))

  `scheduledEditions({case?, state?, after, limit, viewer})` (`op=publishschedule`) answers `{editions: [{case, edition, project, state, signer, set_by, signed_at, at, publish_at, moves, outcome_at, reasons}], cursor}`:
  - `state` is `waiting`, `published`, `stopped` or `cancelled`;
  - `at` is the date and time as set, with its zone, so the case and the queue can say "Signed · publishes <date, time>" in the group's local time without converting;
  - `reasons` are R2's for a stopped edition.

  Editions come in `publish_at` order after `after`, at most `limit` (default 500, clamped to 1–500), with `cursor` the last answered when more follow, else null.

  A viewer without `publication` R1's standing in the case's project is answered as if none existed. Read as the plane (no `viewer`), it answers every edition, for `queue-producers` R37. It writes nothing.

- **R5** [met] (was `publication` R70, its set-time share; DEC-147 (5))

  An edition published at a set time was signed when R1 recorded its waiting edition (`signed_at`, the instant of the signature at the ceremony), not when it is committed.

  This module answers that instant, for the case edition while its edition waits, through R8's `signedAtOf`, so `publication` R22's commit holds it as the edition's `signed_at` beside its own `published_at` (`publication` R70, R40; K1826). It answers null for a case edition that does not wait, and the commit's instant then stands for both.

  An edition published at signing never passes through this module.

- **R6** [met] (was `publication` R71; K1811, K1816; `scheduler` R22's wake)

  `onPublishScheduled(module, fn)` takes one registration per module, refused through `membership.listenerRefusal` (as `answers` R27). `fn({publishAt})` is called once with R2's `publishWake()` as it then stands (null when none waits), after the act's transaction, following any of these:
  - an edition is set to wait (R1);
  - its time is moved or cancelled (R3);
  - a due edition is taken (R2).

  `scheduler` then re-arms its alarm at once. A throwing `fn` never undoes the act, and the notice writes nothing.

- **R7** [met] (was `publication` R74; N681; K1833)

  `waitingEditionOf(caseId)` answers the case's one edition R1 holds `waiting`, as `{case, edition, doc_sha, at, publish_at}`. It answers null when none waits (none set, or each `published`, `stopped` or `cancelled`).

  It is viewer-free and in-process (no op): `case-authoring` calls it before its acts (its R58). It writes nothing and never throws (a malformed `caseId` answers null).

- **R8** [met] (the seam with `publication`, K31's pattern; new in this split as `publication` R61 was in the fourth, carrying `publication` R21's waiting clause and R70's set-time share as built)

  At its creation this module registers once, with `publication.registerWaitingEditions({isWaiting, signedAtOf, signerOf})` (`publication` R77; K2438), the source `publication` reads a waiting edition through:
  - `isWaiting(caseId, edition)`: true while that case edition's edition waits (R1), else false. `publication` R21 then counts its document as signed, neither replacing nor re-authoring it.
  - `signedAtOf(caseId, edition)`: R5's instant while it waits, else null.
  - `signerOf(caseId, edition)`: `{signer, delivered_by}` while it waits, else null, so `publication` R76 counts a waiting edition's signer and deliverer (K2529).

  Both are synchronous, read only this module's table inside the caller's transaction, write nothing and never throw. Every case-document table and write stays `publication`'s (its R24).

## Private

### Uses

- `civil-time`: `bounds`, `isCalendarDate` (R1, R3).
- `local-facts`: the governing value of the `time_zone` path (its R2; R1, first). A new `modules.json` edge (T50, K3642).
- `jurisdictions`: `combine`, for the profiles' `time_zone` when no local value governs (its R41; R1).
- `record-core`: `getSetting("jurisdiction_profiles")` (R1), `transact`, `declareTable` (R10).
- `membership`: `viewerPredicate` (R3's machine fence), `isProjectOwner` (R3), `listenerRefusal` (R6).
- `publication`:
  - `hasCaseStanding` (its R1; R3, R4);
  - its R40 read contract on `cases` (`project_id`) and `case_documents` (`doc_sha`, `text`, `sig_armored`, `ratified_at`) (R1–R4);
  - `registerWaitingEditions` (R8).

  This module never calls `publication` R22 itself: `ratification`'s publisher commits through it (R2).
- `record-grammar`: in `modules.json`; the code copied uses none of it (the extraction map's doubt 6).
- Its users: `ratification` calls R1 and registers R2's publisher (its R40, R43), `case-authoring` calls R7 (its R58, R59), `scheduler` follows R2 and R6 (its R22), `queue-producers` reads R4 (its R37), and the plane builds it and spreads R3's and R4's ops.

### Invariants

- **R9** [met] (was `publication` R33's C-122.5 share; N687, K1839) Each check this module raises is an invariant with its test (K6). C-122.5 `SCHEDULED_CHECK_UNAVAILABLE` (R2) moves here with its number and translation unchanged, and leaves `publication`'s table, so no row id is held twice. Its translation: "This edition was not published at its set time, because the checks it needed then could not be run. Nothing was published. Sign it again to publish it." A stopped edition's `reasons` carry its `check`. A change to the row moves `CATALOG_VERSION` (rule 17).
- **R10** [met] (was `publication` R31's share; T34-79's table) This module declares `scheduled_editions` to `record-core`'s purge as the table was declared: - A waiting, stopped or cancelled edition is working material (`publication` R29) and is cleared by the whole-store purge with the unsigned document it holds a signature for. - A published one is kept, since it holds when its edition was signed.
- **R11** [met] (a copy of `publication` R34) No place is named in this module's behaviour or outward text.

### Satisfies

- DEC-147 (Bob's "S1: B", 2026-10-06; publishing at a set time):
  - "Publish now" or "Publish at…";
  - the signed edition waiting unpublished and checked again at its time;
  - cancel and move;
  - the two dates on the public page;
  - the design session's details: the group's local time, and the set time weighted Irreversible as publishing is.

  These are R1–R5, with `publication` R21's waiting clause through R8; K1784, K1785 (T34-79).
- K1811, K1816 (the arming notice for `scheduler` R22): R6. K1832 (the publisher answering asynchronously, the held signature): R1, R2. N805 (T39): R2's stop entries.
- N681 (K1833): R7. N687 (K1839): R9.
- `docs/architecture/BIO_Publication_v0_1.md` §6A.2 (the unsigned document's fence), as `publication` R29 holds it for a waiting edition: R1.

### Suggestions

- **Factory.** `publishScheduleOf(host, deps)` answers the one instance per host (K61). At creation it creates `scheduled_editions` with the same DDL `publication` created (`CREATE TABLE IF NOT EXISTS`: a running store's rows are kept, with no data move), declares it (R10), and registers R8. It is created by its first user: `ratification`'s factory when it registers R2's publisher, and the plane in the modules' order after `publication`. The ops are `publishScheduleOps(ps, url, body)`, with `by` and `viewer` the control plane's stamps (an absent viewer is no viewer at all, never the plane's whole read), spread by the plane's op map.
- **The copy (K624).** `schedule.mjs` moves whole, its SQL unchanged. Its `p.` reads become this module's own deps, on the same storage and clock, and `publication.hasCaseStanding`. `groupZone()` comes too (R1's zone read; no caller today).
- **In the window** before `publication`'s copy is deleted (T41-36), `publication` still declares the table, and this module's declaration is refused `TABLE_DECLARED` (nothing declared). This module keeps the answer and does not throw. The declaration's owner is then red, by name, until T41-36 merges.
- **Tests.** They move from `test/m/publication/` (`t34` R66–R69, R71, the purge arm; `t35` R74 and C-122.5; `t39` R67's kept stops), re-labelled, over `publication`'s fixture. Each check gets a negative control. R2's arms cover:
  - no publisher, a throwing one, an empty answer;
  - an asynchronous one;
  - an overlapping alarm, taking nothing twice.
- **For callers.** `publication`'s own R21 and R70 tests register a stand-in for R8, since a module's test may not import a later module.

- **R12** [met] (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `publishatcancel`, `publishatmove` (added K5195: `screens-publish`'s ceremony sends it). Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
