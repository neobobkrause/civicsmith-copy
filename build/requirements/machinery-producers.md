# machinery-producers — requirements

**Status** · In force: split from `queue-producers` by copy for size (K617, K1850), meaning unchanged: R1–R5 marked "was" and retired there; R6–R10 copies of its R11, R12, R13, R24 and R36, which stay. Last changed T34 at its split (T34-95); every requirement met (MACHINERY-PRODUCERS #1, K1863). Last changed T48 (T48-58: Purpose widened; R11 new, the administrators' update to-do, and R12 new, the read it is derived from, passed in by the plane's composition; N1047; DEC-226 (1); K3158, K3189, K3195); marked not yet met (T48). Last changed T50 (L11 fold, BOB #201: R15 a completed capture request told by key; N1143; DEC-274); marked not yet met (T50). Fix round 6 (T51): R2 amended, a parked fetch raises no partial-capture condition (G25).

**Size (P6).** About 1,050 lines. It takes about 840 lines from `queue-producers/index.mjs` (353–802, 1842–1939, 1943–2027, 3031–3237) and copies about 200 lines of helpers. That leaves `queue-producers` at about 3,155.

## Public

### Purpose

The feed's conditions about our own machinery: a host our governor holds, a capture left partial or finished unattended, a render held or expired, an address due a recheck or eligible for the archive fallback, a sweep that needs a member's look, and a working-on notice that needs its owners; and (T48) the administrators' to-do when a newer release of the group's Civicsmith is ready. Each is derived on read and writes nothing. Each names its subjects and home subjects for `queue-producers` to answer in `feedItems` and for `queue` to home, offer, mint and publish.

### Provides

Terms. An **item**, a **home set**, the **depth bound** and a **case** are `queue-producers`' (its Terms).

**conditionItems({member, viewer, now, homesOf, optionsOf}) → {items}** (`queue-producers`' read, its R8)
- **R1** (was `queue-producers` R8, its share) Answers every item R2–R5 derive for this member and viewer:
  - each homed through `homesOf(subjectIds)` and carrying `options` from `optionsOf(subjectIds)`, both passed in by `queue-producers` R8 (`queue` R7's walk and R12's options);
  - no item carries `disposition` or `catalogue_id`.

  It writes nothing.

**The producers**
- **R2** (was `queue-producers` R3) CONDITIONs, derived on read and writing nothing:
  - **governor-holding-host**, per held host. Its documents are gathered at most 16; past that, the home set states `subject_bound` and is undetermined.
  - **partial-capture-outstanding**, per live capture session that holds a capture's primary. (T51 fix round 6, G25; K4577; `acquisition` R105) A session a capture parks as owed work (`state.fetch_pending`) has captured nothing and raises none, a failed parked fetch included. Test: a parked and a failed fetch raise none; control: a real partial capture still does.
  - **capture-completed-unattended**, per bundle a machine credential wrote and per completed capture request.
  - **render-deferred**, per render request held under a code or expired. Its reason is the code's own translation.
  - **archive-fallback-eligible**, per address `monitoring.archiveEligible` answers (its R47: what the next tick would find; K406 Q2).
  - **monitoring-recheck-due**, per monitored address that `monitoring({viewer})` (monitoring R32) answers overdue by more than its interval, or unscheduled (monitoring R16, R31) (N229).

 
- **R3** (was `queue-producers` R22; DEC-95 (1); K1019) Each `capture-completed-unattended` item (R2) carries, in its detail, the grade note of each capture it names. These are the same words a member present at the capture would have read (`ACQUIRE_GRADE_NOTE`, exported by `capture`, as its R76 answers them).
  - A capture is named, and held, by its `register` row under the item's bundle (`provenance` R48). At most 8 are named, the option bound (as `queue-producers` R2's).
  - For a capture request, the capture is the request's own `capture_sha`.
  - A capture the viewer may not see carries no note.

  K1105: `gradeNoteOf` is asynchronous and the read is not; reading synchronously is its answer.
- **R4** (was `queue-producers` R26; link-sweep R11, monitoring R63 before N506's split; K1036 (8)) CONDITIONs, one for each condition that `link-sweep.sweepConditions` answers the viewer:
  - the kinds are `sweep-held-backlog`, `sweep-yield-anomaly`, `sweep-seed-unreachable`, `sweep-redirect-out-of-scope` and `sweep-silent`;
  - each is keyed `CONDITION::<kind>::<bundle>#<id>`;
  - each goes to the members of the sweep's project who may see its bundle;
  - its subject is the sweep's bundle, its `age` runs from `since`, and its `detail` comes from the condition;
  - it leaves when the condition leaves.

  The items' words are the UX design stream's (NOTIFICATIONS.md item contract; `docs/development/ux-substrate/ux-experience.json` UC-035).
- **R5** (was `queue-producers` R27; `network-notices` R12, R13; DEC-111, K1031) CONDITIONs for the owners of a project with an open notice (`membership` R65):
  - `notice-attestation-missed`: a `monthly` attestation was missed for want of an instance key (`network-notices` R13). It leaves when one is issued;
  - `notice-lapse-near`: a lapse is due within 7 days. It leaves on a revision, a stop or the lapse;
  - `notice-project-closed`: the project closed while the notice was open. It leaves after 30 days, or on an owner's stop, which may add a handoff.

  Each is keyed `CONDITION::<kind>::<notice>`.

**The update to-do** (T48; N1047; DEC-226 (1); K3158, K3189)
- **R11** (T48; N1047; DEC-226 (1); K3189; `instance-setup` R89; `queue` R54) `conditionItems` also answers, to each active administrator (`membership.activeAdmins`, its R86), the to-do for a release ready to install, derived on read from the notice read R12 is handed.
  - One item, class `OBLIGATION`, kind `update-ready`, id `OBLIGATION::update-ready::<version>`, for the newest verified release the read answers as ready: newer than the running one, neither skipped nor started, and not set aside by `updatelater` until a date still to come. A newer release replaces an unanswered older one, so at most one such item exists.
  - `assignee_role` is `admin`, `age` runs from when the release was found, and `detail` carries `version`, `date` and `security` (true when the notice marks a security fix), for the words `queue.update.ready` and the security mark (DEC-226 (1)). `options` carries `updatelater` through `optionsOf`; the way to "See what changes" is the screen's, not an option. It has no subject bundle, so its home set is ungrouped.
  - The item leaves every administrator's queue when the read answers any administrator's decision on that release (`updatestart`, `updateskip`, or `updatelater` until its date), or when the running version is that release or newer.
  - A member who is not an administrator is answered no such item. It writes nothing.
  - Tests: a ready release gives each of two administrators one item; a second, newer release replaces it; control: after one administrator's `updatelater` neither has the item until its date; a member gets none.
- **R12** (T48; K3189; K31's pattern) The read R11 derives from is handed to this module in process by the plane's composition (`store-assembly` R39), never imported: `deps.updateNotice()`, answering `instance-setup`'s notice read (its R89). With none handed, or one that throws or answers malformed, R11 answers no item and the answer's facts name `update-ready` in `failed`, never a guess. Control: with no read handed, the other producers answer as before.
- **R13** (T49; N1138; K3407; DEC-272; K3366) `capture-completed-unattended`'s `summary` and `detail` are read by key through `setup-words`' `word`: `queue.capture-completed-unattended.summary` and `.detail`, `{member}` the starter's handle (the founder's through `membership.founderHandle()`, R144), or `.who` when a credential that is no member started it, `{title}` the document's title; never a record or credential id, and none held draws no name.
- **R14** (R085-19; K3501 (b); amends R2's `capture-completed-unattended`) The item is raised only for a bundle that holds a capture (a `register` row, `provenance` R48) or a completed capture request; a machine's entry on a record holding no capture (an AI run's proposal on a question) raises none. Test: a question carrying a run's proposal raises no such item; control: a machine-written capture still does.


**A capture request, told in keys** (T50; N1143; DEC-274)
- **R15** (T50; N1143; DEC-274; K3366; `capture-requests` R10, R56; `run-rules` `runPrincipalOf`; amends R2) **A completed capture request is told by key.** Its item's `summary` and `detail` (`#conditionsCaptureRequested`) are read through `setup-words`' `word`, composing no English: `queue.capture-completed-unattended.request.summary` and `.request.summary.unnamed`, `.request.detail`, `.request.detail.assistant` and `.request.detail.unnamed`, with `{member}` the requesting member's handle (the founder's through `membership.founderHandle()`) and `{title}` the document's title, `screen.held.untitled` when it has none; never a record, run or credential id. The member is `at_the_request_of.member` (`capture-requests` R56), or, for a run's request (`at_the_request_of.run`), the member read from the attribution's `principals.plane` through `run-rules`' `runPrincipalOf`; a run's request draws `.request.detail.assistant`, a member's `.request.detail`, and one naming no member (a credential that is no member, or a run whose member cannot be read) draws the `.unnamed` forms. The grade note is appended to the detail as `queue.capture-completed-unattended.gradenote` (`{note}`, once per distinct note), by this producer and R13's bundle producer alike (R3). Test: a request by a member and one by a run draw their details, the run's naming the member; an untitled document draws `screen.held.untitled`. Control: a request naming no member, and a run whose principal cannot be read, draw the unnamed forms and name no id.
**The words members see** (DEC-107, DEC-131; H15, H19)
- **R9** (copy of `queue-producers` R24, which stays) Every member-facing sentence this module answers calls a CONDITION item a "status", never a "condition" or a "signal". (T48) R11's to-do is a to-do ("To do", `queue` R48), never an "obligation".
  - This covers an item's `summary` and `detail`, every sentence under it, and the words of its options.
  - "signal" leaves member text (DEC-131).
  - The internal codes, kinds and item ids are unchanged (`CONDITION`, `CONDITION::…`).

 

- **R16** (fix round 4b, F3 verification; K4509; provenance R73) **One note for a capture held in parts.** `#gradeNotes` lists one note for a capture held in parts (its whole), never one per register row (skip `part_of` rows). Test: the three-part fixture yields one note. Uses provenance `registeredFor` (R11, R73); R3's bound of 8 counts after the parts are left out.

## Private

### Uses

- `record-grammar`: `MACHINE_AUTHOR_PREFIX` (R2).
- `record-core`: `manifestByAuthor` (its R53), `stampInstant` (R2).
- `membership`: `viewerPredicate` (the viewer gate), and the projects a member owns (its R65; R5); (T48) `activeAdmins` (its R86; R11).
- Handed in, not used (T48; K3189; K31's pattern): `instance-setup`'s notice read (its R89), by the plane's composition (R12). No `modules.json` edge: `instance-setup` is later in the order.
- `host-governor`: `governorHolding` (its R14; R2).
- `provenance`: `register` (capture to bundle) and `captured_locators` by host (R2, R3).
- `capture`: `liveCaptureSessions` (its R46; R2); `ACQUIRE_GRADE_NOTE` (its R76; R3).
- `capture-requests`: `completed`, `rendersHeld` (its R26), `renderHoldReason` (R2).
- `actions`: `place`, `zoneOf` (the zone its R12 reads; R5's windows, R10; K1675).
- `monitoring`: `archiveEligible` (its R47), `monitoring()` (its R32) (R2).
- `link-sweep`: `sweepConditions`, `SWEEP_CONDITION_KINDS` (its R11; R4).
- `network-notices`: `noticesOf` (its R22; R5).
- `civil-time`: `localDay`, `dayRange`, `span`, `isCalendarDate` (R10).
- (T50; R15) `run-rules`: `runPrincipalOf`; `setup-words`: `word`. New `modules.json` edges, each to an earlier module.

### Invariants

- **R6** (copy of `queue-producers` R11) No answer names a bundle the viewer may not see, and no count reveals one (REC-30, DEC-36).
- **R7** (copy of `queue-producers` R12) A CONDITION earns an item only where a member's act can change it (NOTIFICATIONS, the item contract).
- **R8** (copy of `queue-producers` R13) No place is named in this module's behaviour or outward text.
- **R10** (copy of `queue-producers` R36, its R27 share; C-3b; K1444 (iii)) Every day this module derives or compares is the local day in the zone, through `civil-time` (`localDay`, `span`), never the UTC day computed in this module. This covers R5's lapse and closing windows, and an item's `age` counted in days. The zone is `actions.zoneOf(actions.place())`. With no zone held, the day and the `age` are undetermined, stated, and never computed on UTC.

### Satisfies

- `docs/architecture/BIO_Interaction_Constructs_v0_1.md`: Revision 0.2 (QUEUE: the CONDITION class); U (`undetermined` stated: `age`, the `subject_bound` home set).
- `docs/development/NOTIFICATIONS.md`: the CONDITION class, the item contract.
- DEC-36; DEC-95 (1) (R3); DEC-111 (R5); DEC-107, DEC-131 (R9); K1036 (8) (R4).
- (T48) K3158 (Bob: notify administrators when a release is ready) and DEC-226 (1) (the to-do, one for every administrator, leaving every queue when one acts): R11, R12.

### Suggestions

- **The copy (K624 (1), K1850).** This module's job copies the following `queue-producers/index.mjs` lines into `bio-plane/src/machinery-producers/index.mjs` as `MachineryProducers`, with the factory `machineryProducersOf(ctx, deps)`:
  - 353–802, 1842–1939, 1943–2027 and 3031–3237 (seam read §2);
  - the helpers they call, which are copied and also kept in `queue-producers`:
    - `#bundleGate`, `#bundleRedactor`, `#rows`, `#one`, `#homesOf`, `#optionsOf`, `#homesAt`, `#ownedProjects`;
    - the zone helpers (`#instanceZone`, `#knownZone`, `#localDayOf`, `#dayEdge`, `#today`, `#daysBetween`, `#localAge`, `#addDays`, `ZONE_UNDETERMINED`, `DAY_MS`);
    - the bounds `QUEUE_OPTION_SUBJECTS_MAX`, `QUEUE_CONDITION_SUBJECTS_MAX`, `QUEUE_MACHINE_AUTHOR_PREFIX` and `QUEUE_UNATTENDED_PAGE`.

  Every key, kind, recipient, bound and `basis` is copied verbatim, except the word changes R9 and DEC-149 name:
  - **R9:** `basis.detail` "a signal is a fact about OUR OWN machinery" (:487, :2013) becomes "a status is …". "a sweep's signal" (:3120) and "the sweep's signal" (:3126) become "status".
  - **DEC-149** (T34-87) rows that land here: `:3197`, `:3226` and the copied `ZONE_UNDETERMINED`.

  It copies these tests into `test/m/machinery-producers/`, re-labelled with these ids and driving `conditionItems` directly, with a copy of `world.mjs`:
  - `test/m/queue-producers/conditions.test.mjs` whole;
  - `producers.test.mjs` 137–209;
  - `sweeps.test.mjs` 40–221.

  It merges right after `tasks` and before `queue-producers` in layer 11. `queue-producers`' job (T34-54) then deletes its copy and calls `conditionItems` where `#queueConditions` stood.
- **Deps.** `queue-producers` builds this module lazily with its own `deps`, so injected deps reach it. `queue`'s `PRODUCER_DEPS` is unchanged.
- **Callers' obligations** (convention 2): `queue-producers` passes `member`, `viewer`, `now`, `homesOf` and `optionsOf` as `queue` passed them.

## Open for Bob

None.
- **F1** *(not yet met: coordinator ruling 5 Nov 03:26)* When a request is completed by a member's own file (capture-requests fillAskedRequest, brought_by set), capture-completed-unattended does not say the team's Civicsmith captured it; the behaviour change is this module's, its words come through the design stream.
