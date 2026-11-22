Length: 58 lines. Last section: "Suggestions".

# roster-reader: requirements

Next number: 13

**Size (P6).** About 500–800 lines.

## Public

### Purpose

Reads rosters, organisation charts and staff directories for who is in an organisation and in which post, as the documents state it. A roster or chart is read as content and a roster table's columns are named, so `people.staffingAt` can read rosters as tables through its roster source, never copied into lines. A name read from a staff directory is a person reference that can match only at grade C.

### Provides

**Two content types, `{key, contract: MEMBERSHIP, detect, parse, assess}`**, registered through `docprofile`'s registry seam (`registerRosterTypes(register)`), after `doctypes`' types and before `generic`.
- **R1** [met] `staff_roster`: a document whose body is a list of one organisation's people or posts, with names and titles but no contact points (the shape `staff_directory` cannot see: its header names a board roster and a committee roster). `detect` is CERTAIN only with both a self-naming line (the view's roster words, `jurisdictions` vocabulary under this key) and at least a floor of name-and-title lines (a measured structural floor, in code); LIKELY with the lines alone; no match otherwise. A document `staff_directory` or a dated schedule matches is not matched (the dated-rows rule of `staff_directory`, applied here). `detect` reads the text one line at a time and keeps only counts and its self-naming lines, so a text of any length costs memory only for the text itself: a 26 MB, 160,000-line text of a budget volume is refused in an 80 MB heap with the text held (fix round 5, E2; K4551). (fix round 6, G37; K4617) `detect` over a text allocates in proportion to the text and costs at most 32 bytes of allocation per byte of text: a 1 MiB text of a budget volume causes at most 16 collections of a 2 MB semi-space and a 24 MiB text at most 384, and the 24 MiB text takes under 4 s; the verdicts are those of the documents' own lines, not of how the text is walked.
- **R2** [met] `staff_roster` `parse` gives `rows`: one per entry, `{name, title?, unit?, source}`, as the line states them; `as_of` the document's own stated date where a line states one, else `null` with why; and `organisation` as its title line names it. A line it cannot divide into a name and a title is kept whole as `line`, never paired by guess.
- **R3** [met] `org_chart`: a document naming an organisation's units and posts in chart form. `parse` gives `units` and `posts` as read (`{label, source}`), names beside posts where the text places them on the same line, and a `reports_to` pair only where the text itself states the relation in words; a chart's boxes and lines, which text does not carry, give no pair, and `pairs_why` says so. Its `detect` likewise reads one line at a time and holds no line it does not need (fix round 5, E2; K4551). (fix round 6, G37; K4617) The same bound for `org_chart`'s `detect`.
- **R4** [met] Neither type reads or emits a phone number, street address or personal e-mail address; a roster row carrying one is read without it (K1485 row 9, K1493).
- **R5** [met] `assess` compares two readings by row (a name with its title and unit): a row gone gives `delisted`, a row added `item_added`, a title or unit moved `item_changed`, from `site-profiles`' catalogue only.

**rosterColumns(header, view) → `{roles, why}`**
- **R6** [met] Names the roles of a captured roster or payroll table's columns, `name`, `title`, `unit`, `start`, `end`, `as_of`, `employee_id`, from the header words the view supplies; a column no word matches has no role; a table with no `name` and no `employee_id` column is not a roster, with why. Contact columns (phone, address, personal e-mail) are named `contact` so a reader can leave them unread. The table's rows are never copied (ladders §2 PEOPLE, "Rosters stay tables").

**directoryPersonRefs(entities) → `[{contact_key, name?, match_grade, why}]`**. `entities` are a `staff_directory` reading's `contact` entities.
- **R7** [met] For each contact entry the reference stays keyed by its address (`contact_key`), and the person's name is read from the entry's `line` only when, with the address, phone and title words removed, exactly one name-shaped span remains; otherwise no `name`, with why (a two-column line may hold two people's text). A name read here carries `match_grade: "C"`, a name alone, and can never resolve a person above grade C (K1484 row 12; K1488).

**rosterSource(reads) → source** (N614; K1505 (6), K1683; `people` R18, R19)
- **R12** [met] Answers a roster source `({organisation, at, viewer}) → {level, rosters, organisation, at, why?}` for `people.registerRosterSource`, in place of the one `plane` registers that answers "held as a table, not read". `reads({organisation, viewer})` is the store's read handed in by the composition root (this module holds no store): it answers the held roster documents and roster tables of that organisation that `viewer` may see. The source reads each, a document by R2 and a table's columns by R6, and answers it in `rosters` as `{source, as_of, rows}`, each row `{name?, title?, unit?, start?, end?, employee_id?, source}` as the roster states it, a contact column never read (R4); `level` is "held as a table, read by roster-reader". It states each roster's own `as_of` and never states that a row's person held the post at `at` (R10). With no held roster it answers `rosters: []` with why; when `reads` is absent or fails, `level` "held as a table, not read" with why. It writes nothing and never throws.

## Private

### Uses

- `docprofile`: the registry seam, `CONTRACT`, `CONFIDENCE`, `entity`, `diffEntities`, `flatten`, `selfNaming`, the reader view and `ctx.locate`; through it `site-profiles`' event catalogue.
- `jurisdictions` (through the view): roster self-naming words, roster header words and title vocabulary, under this module's keys.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R8** [met] No place in code; tested against the test profile and the first profile.
- **R9** [met] Each type is written from real documents fetched and read through the plane, named in its own header, and tested on them with the `staff_directory` header's four negatives (the candidate contact list, the dated meeting schedule, the business directory, the board roster as a positive here), never from what a roster probably looks like (the registry's standing rule).
- **R10** [met] Everything read is a reading of what the document states: no post, holder, reporting line or identity is written; lines and identity claims are proposed elsewhere and adopted by a member (K1443, K1452).
- **R11** [met] Every "no" (no match, no name, no pair, no role) says which kind of no and why.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2 PEOPLE ("Rosters stay tables"), §5A.4 L2–L3 (the roster and org-chart reader after the split; `staffingAt` through `registerRosterSource`), §5.4 (staff posts from directories and org charts, read by name), §10 (the people doctrine row: the staff directory stays keyed by address, the name read as a match graded C).
- Rulings K1443, K1452, K1484 (row 12), K1485 (row 9).

### Suggestions

- **For `calculations` and `people`**: the roster source `calculations` registers for `staffingAt` reads a captured table with R6's roles; that edge (`calculations` or `people` using `roster-reader`) is not in the plan's `uses` and is BOB's to add.
- **R12's reads (T34-64).** `plane` composes `reads` from the store: the captures `doctypeFor` placed as `staff_roster` or `org_chart` whose stated organisation resolves to the entity, and the tables `calculations` holds with R6's roles; that choice is `plane`'s, at its composition.
- **For `entities`**: the grade-C ceiling of R7 is the resolution cascade's (a name alone is C); entities applies it to a reference R7 produces.
- The fixtures are in the bucket the staff directory was measured on (`staff-directory.mjs` header: a board roster, a committee roster, org charts); the job fetches and captures them.
