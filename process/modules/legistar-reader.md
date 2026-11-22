Length: 61 lines. Last section: "Suggestions".

# legistar-reader: requirements

Next number: 17

**Size (P6).** About 600–900 lines.

## Public

### Purpose

Reads captured Legistar Web API JSON as content: bodies, persons, office records (seats only), events, event items, votes, and matters' enactment fields. Its rows carry the source system's own identifiers at both ends, so what it reads is a system-rule assertion the machine may write (DEC-52; K1443), dated "as recorded by Legistar", never as truth. It drops every contact field.

### Provides

**LEGISTAR: a content type `{key: "legistar_api", contract: MEMBERSHIP, detect, parse, assess}`**, registered through `docprofile`'s registry seam as `doctypes` registers its types (`registerLegistar(register)`).
- **R1** [met] `detect` matches at CERTAIN only a capture whose locator is a Legistar Web API address (`webapi.legistar.com/v1/<client>/<endpoint>`, a publishing system's own address shape) and whose bytes parse as a JSON array of objects carrying that endpoint's id field (`BodyId`, `PersonId`, `OfficeRecordId`, `EventId`, `EventItemId`, `VoteId`, `MatterId`). Anything else does not match; malformed JSON does not match and says why.
- **R2** [met] `parse` gives `{endpoint, client, rows, page, facts}`: one row per object, each `{kind, key, ids, facts, source}`, `key` `legistar:<kind>:<id>`, `ids` the source's own identifiers (for example a seat's `PersonId` and `BodyId`), `source` the row's index in the capture, and `assertion: "system"` with `basis: "as recorded by Legistar"` (K1443).
- **R3** [met] No row carries a contact field: `PersonEmail`, `PersonEmail2`, `PersonPhone`, `PersonPhone2`, `PersonFax`, `PersonAddress1`, `PersonAddress2`, `PersonCity1`, `PersonCity2`, `PersonState1`, `PersonState2`, `PersonZip1`, `PersonZip2`, `PersonWWW`, `OfficeRecordEmail`, or any other field whose name names an e-mail, phone, fax, street address or web address. A test reads a fixture holding each and finds none of their values in the output (K1485 row 9).

**What each endpoint gives** (field names are the Legistar API's):
- **R4** [met] `bodies`: `{BodyId, name, type}`. A body whose name carries a cancellation marker, a special-meeting marker or a concurrent-meeting marker of the view's Legistar vocabulary is read as its base body with `status: cancelled` or `meeting_kind: special | concurrent`, its own `BodyId` kept; a body the view's body-variant map names gives that map's organisation key. Markers and the map are profile data, never code (ladders §4.4 L3; legistar-events §1 (a), §2 (2)).
- **R5** [met] `persons`: `{PersonId, name, name_normal, active}`, `name_normal` the name with white space folded. Two `PersonId`s with one `name_normal` are both read, each carrying `same_name_as` naming the other; nothing is merged (legistar-events §1 (d); K1488).
- **R6** [met] `officerecords`: seats only, `{OfficeRecordId, PersonId, BodyId, role, start, end}`, `role` the `MemberType` as given, `start` and `end` days as given (`end` `null` when absent). A title, district or contact field is never read (R-1 O-E2). An end date after the capture's own date is kept as given and marked `end_planned: true`.
- **R7** [met] `events`: `{EventId, BodyId, body, date, time, status, agenda_status, minutes_status, agenda_file, minutes_file, agenda_last_published, minutes_last_published, in_site}`. `date` is `EventDate`'s day and `time` `EventTime` as written, never joined here (the caller joins them with `civil-time.joinLocal` in the profile's zone). A cancelled body (R4) gives `status: cancelled`: one event, never a missing one.
- **R8** [met] `agenda_last_published` and `minutes_last_published` are read as UTC instants (named UTC though the value has no `Z`) and labelled `last publication, an upper bound`, never a first posting or a notice time (legistar-events §2 (3); ladders §4.4 L3).
- **R9** [met] `eventitems`: `{EventItemId, EventId, agenda_number, MatterId, MatterFile, title, action, passed, mover, seconder}`, `mover` and `seconder` as the source names them (a `PersonId` where given, else the name as text). `votes`: `{VoteId, EventItemId, PersonId, value, result}`, `value` the `VoteValueName` as given.
- **R10** [met] `matters`: `{MatterId, MatterFile, type, status, intro_date, passed_date, enactment_number, enactment_date}`. A null `MatterEnactmentDate` is `null`, never filled from `MatterPassedDate` (time-law §4).

**Paging**
- **R11** [met] A capture holding exactly 1,000 rows is read with `page: {skip, top: 1000, may_continue: true}` and `nextPage(locator)` answers the same address with `$skip` advanced by 1,000; fewer rows give `may_continue: false` and `nextPage` `null`. `readPages(parses)` joins the pages of one endpoint by key, a key seen twice with different facts reported, never silently overwritten (OfficeRecords: 1,262 rows, two pages).

**assess(before, after, ctx)**
- **R12** [met] Compares two readings of one address by row key, under the MEMBERSHIP contract, with events from `site-profiles`' catalogue only: a row gone gives `delisted`; an event row added `scheduled`, any other row added `item_added`; an event newly `cancelled` gives `cancelled`; an event's `date` or `time` moved gives `rescheduled`; a new `agenda_last_published` or `minutes_last_published` gives `agenda_published` or `minutes_published`; a vote's `value` or an item's `passed` moved gives `outcome_changed`; a body's or person's name moved gives `renamed`; any other fact moved gives `item_changed`. Key order and white space in the JSON give nothing.

## Private

### Uses

- `docprofile`: the registry seam (`register`), `CONTRACT`, `CONFIDENCE`, `diffEntities`, the reader view; through it `site-profiles`' event catalogue (`event`, `isMeaningful`; its R13, R14).
- `jurisdictions` (through `docprofile`'s view): the Legistar vocabulary for R4 (cancellation, special and concurrent markers; the body-variant map), keyed under this content type's key.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R13** [met] Pure over its inputs: no store, no network, no clock; it reads only the bytes and locator it is given.
- **R14** [met] No place is named in code: the client name in an address is read, never matched against a held list; every marker and map comes from the view; the tests use the test profile and a client other than the first profile's.
- **R15** [met] Every row is what the source states: no date, holder, seat or vote is inferred, completed or corrected; "no row" is never read as "no such seat" or "no such meeting".
- **R16** [met] Tested on fixtures captured by the job from the keyless API (`bodies`, `persons`, `officerecords` both pages, `events` for three years, and the 50 gold events' `events/{id}`, legistar-events §5, §7), with contact fields stripped before commit; the 50 gold events' date and time agree with the gold set.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §5.4 ("Seeding without AI": a Legistar `OfficeRecords` reader as a generic content type), §5A.4 (Legistar seats and holders, identifier-backed), §4.4 L3 and §5B.4 2a (observed meetings from Legistar `Events`; vendor encodings as profile data; posting times as upper bounds), §2 LAW (watching rests on Legistar enactments).
- Rulings K1443, K1468, K1485 (row 9), K1504 (Choices 1).

### Suggestions

- **For the callers**: `events` joins `date` and `time` through `civil-time.joinLocal` (legistar-events M-V2) and records a `publication` event at the first observation of a new last-published value; `instance-setup` seeds seats with a staleness check against attendance (legistar-events §1 (c)) and dedups persons only by a member's identity claim. Those belong in their requirements.
- Joining in this module instead would add a `civil-time` edge; the plan's `uses` (docprofile) keeps it out.
- The vocabulary key `legistar_api` and the Legistar marker keys are `jurisdictions`' to define (T33-2).
