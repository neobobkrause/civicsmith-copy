Length: 95 lines. Last section: "Suggestions".

# id-spaces: requirements

Next number: 34

## Public

### Purpose

Judges whether one identifier, appearing in two captured documents, is a shared identifier that counts as a connection. It checks the value, its form, the independence of the two systems that published it, and its referent, in that order. Every local fact it needs (spaces, forms, systems, floors) comes from the jurisdiction profiles it is given. It holds no record and reads nothing.

### Provides

Every service takes `view`: the combined view of the active jurisdiction profiles that `jurisdictions.combine` gives, with its `conflicts`. The identifier spaces are `enactment` (an ordinance or resolution number), `project`, `fund`, `parcel`, `account`, `object`, `vendor`, `proceeding` (a case or proceeding number, K1452), `person` (T33-9), `body` and `office` (T34-7), and `institution` (K1729). A profile supplies each space's forms, the publishing systems, and the coverage floors.

**spaces(view) → `[{space, label, referent, forms}]`**
- **R1** [met] Lists the twelve spaces (since K1729, `institution`, one form per institution scheme, as `person`), in the order Provides names them, and, for each, the forms the view supplies. `referent` is `name` for `fund` and `reading` for the others. `account`, `object` and `vendor` are the money record's identifiers (an account or object code, a vendor number; B1b.3); `proceeding` is a proceeding's number in the forms its forum writes it, so a capture carrying one resolves at grade A (K1452); `person` holds one form per person scheme the profile names (a Legistar `PersonId`, a filer id, a licence number, a bar number), and, as for every space, two forms never join without a crosswalk (R17), so one scheme's number is never compared with another's. `body` holds a body's number in a legislative system (a Legistar `BodyId`) and `office` an office record's number (a Legistar `OfficeRecordId`, one seat's holding), so `events` R22's Legistar following and `instance-setup` R50–R52 resolve the rows a deployed copy reads (N569, N613); `referent` is `reading` for both.
- **R2** [met] A space may have several forms at once. Forms are told apart by the value's shape, never by a date.
- Errors: never throws. A space with no form in the view is listed with `forms: []`.

**recognise(view, space, value) → `{space, value, form, normal, kind?, reach?}` or `null`**
- **R3** [met] Returns `null` for an unknown space, an empty value, or a value that has the shape of none of the space's forms.
- **R4** [met] `normal` is the string two values are compared on. It is derived from the value by removing formatting only, as the form defines (spacing, letter case, a prefix, the zero-padding of a numeric part). A digit is never changed.
- **R5** [met] For `enactment`, the result also gives `kind` (a kind the profile names, such as ordinance or resolution, or `null`), and `reach`, as `reach()` gives it for that number and kind.
- Errors: never throws.

**reach(view, number, kind?) → `{reach, floor?, says}`**
- **R6** [met] With a kind, `reach` is `INSIDE` at or above that kind's coverage floor and `OUTSIDE_REACH` below it.
- **R7** [met] With no kind, `reach` is `OUTSIDE_REACH` below every kind's floor, `INSIDE` at or above every floor, and `UNDETERMINED` otherwise. `says` names the floors and why.
- **R8** [met] `OUTSIDE_REACH` is never reported as "not found". `says` states that the record's source holds nothing that old.
- **R9** [met] With no floor for the kind, `reach` is `UNDETERMINED`. `says` distinguishes two causes: no coverage floor is measured, or the active profiles give conflicting floors (the view lists the conflict), naming them.
- Errors: never throws.

**parcelStanding(key, evidence) → `{standing, roll_year?, children?, vintages_searched, says}`.** `evidence` is optional: `current` (the keys in the assessor's current layer), `lineage` (key → the assessor's own retirement records `{roll_year, children}`) and `vintages` (the names of the published vintages searched).
- **R10** [met] `CURRENT` when the key is in `current`.
- **R11** [met] Otherwise `RETIRED` only when `lineage` records the key. `roll_year` is the earliest year recorded, and `children` is every child, deduplicated and sorted.
- **R12** [met] Otherwise `UNDETERMINED`, between "retired before the earliest published lineage" and "never a parcel". `says` gives the number of vintages searched, or says none was held. The answer is never "no such parcel".
- Errors: never throws. Missing evidence is treated as empty.

**systemOf(view, addresses) → `{origin, name, republication, provenance_stated, basis, addresses}` or `{origin: null, addresses, why}`**
- **R13** [met] One address names the system of the first system in the view that matches its host and, where the entry gives one, its path. A republication names the system it republishes.
- **R14** [met] A host that serves many offices' publications names no system, and `why` says so. So does an address no system in the view matches, and one that cannot be parsed.
- **R15** [met] Several addresses name a system only when every one names the same system. Otherwise `origin` is `null`, and `why` says whether there were no addresses, different systems, or unknown ones.
- Errors: never throws.

**judgePair(view, space, a, b, reading?) → `{verdict, counts, says, near_miss?, referent?}`.** `a` and `b` are `{rec, system, name?}`: `rec` from `recognise`, `system` from `systemOf`, and `name` for a fund. `reading` is the caller's referent reading: `agrees`, `disagrees` or `null`.
- **R16** [met] The checks run in this order, and the first that decides, decides: form, value, the systems' independence, the fund name (fund only), then the referent. So no reading can make two publications of one source count.
- **R17** [met] Different forms give `FORMS_UNJOINED`: an unmade join, not a mismatch. Two forms never join unless the view supplies a crosswalk between them.
- **R18** [met] Different values give `VALUES_DIFFER`. When they differ only by leading zeros, `near_miss` is `true`. A near miss is never counted.
- **R19** [met] An end with no known system gives `SYSTEM_UNDETERMINED`. Both ends in one system give `SAME_SYSTEM`.
- **R20** [met] For a fund, an end with no name gives `FUND_NAME_ABSENT`. Names equal after normalising (case, punctuation, the word "fund") give `SHARED`, with `referent.by` stating that the names were compared.
- **R21** [met] Otherwise, with no reading, the verdict is `REFERENT_UNREAD`. A reading of `disagrees` gives `REFERENT_DISAGREES`. A reading of `agrees` gives `SHARED`, and `says` and `referent.by` state that the referent rests on the caller's reading, which this module did not make and cannot check.
- **R22** [met] `counts` is `true` only for `SHARED`.
- Errors: throws `TypeError` when `a.rec` or `b.rec` is null, or when the two are not in `space`. The caller must recognise both values first.

**Legacy adapter (retired: N105, K143).** It served `legacy-store` until `op=idmatch` left it; removed by ID-SPACES #2 in T6.

**recogniseCitations(text, reporters?) → `{citations, undetermined?}`** (T33-9; C1, A COURTS (d) 2a; K1441, K1449)
- **R27** [met] Finds each court citation in `text` written as volume, reporter and first page (with an optional pin page), and answers it as `{volume, reporter, variant, page, pin?, start, end}`: `reporter` the reporter's standard abbreviation, `variant` the spelling as written, `start`/`end` its offsets in `text`, in reading order. A reporter is recognised only from the reporter and variant data `court-citations` holds (1,236 reporters, 2,369 variants), read from that module when it is built, or the same data passed as `reporters` (which takes precedence, so a test can pass its own); a reading is never a resolution: whether a held capture states the cited case is `standards`' resolver (T33-31), and a CourtListener lookup is its, through `acquisition` (K1449).
- **R28** [met] With no reporter data (the `court-citations` module not built and none passed), it answers `{citations: [], undetermined: {why}}`, saying no reporter data is held, never an empty finding read as "cites nothing". A run of text that has a volume-reporter-page shape but a reporter no variant names is listed in `undetermined.unrecognised` with its offsets, never dropped and never guessed.
- **R29** [met] Pure and place-free, as R23 and R24: the reporters are data; no reporter, court or jurisdiction is named in this module's code. Never throws on any `text`.

**recogniseSeries(view, text) → `{citations, undetermined?}`** (T35-7; N639; POLICIES L1, STANDARDS L1, Capability Ladders §6B.4, §6C.4; K1713, K1740)
- **R30** [met] Finds each citation in `text` of an item of a policy series or a standard designation that the view's `standard_sources` supply (`jurisdictions` R63: an entry with `series`, its `cite`), and answers each as `{key, series, label, kind, issuer, number, normal, portion?, edition?, start, end, basis, profile}`, in reading order: `key` and `series` the entry's issuer and family keys, `label`, `kind` and `issuer` the entry's, `number`, `portion` and `edition` the groups as written, `normal` the number's normal form (`jurisdictions` R63; R4: formatting removed, never a digit changed), `start`/`end` the citation's offsets in `text`, and `basis` and `profile` the entry's. So "AI 4.12 §3", "DGO K-03", "SO 9196" and "NFPA 1710, 2020 edition" are recognised from a profile that supplies those series, and from no code.
- **R31** [met] A citation whose text names no edition has no `edition`: it is never defaulted to an edition, the latest or any other (§6C.4: the edition in force is `standards`' to read on a date). A run of text that two or more entries' `cite` patterns match at overlapping offsets, naming different families or numbers, is listed in `undetermined.ambiguous` with every reading, never one chosen; two entries that read the same family and number are one citation. A family the view withholds as a conflict (`jurisdictions` R66) is not read, and `undetermined.conflicts` names it.
- **R32** [met] With no series in the view, it answers `{citations: [], undetermined: {why}}`, saying the active profiles supply no series, never an empty finding read as "cites no policy or standard". A reading is never a resolution: whether a held standard is the cited item, and which version of it, is `standards`' (T35-31); a citation names no force and no binding (K1722, K1723).
- **R33** [met] Pure and place-free, as R23 and R24: every series, issuer and pattern comes from the view; no family, issuer or designation is named in this module's code. Never throws on any `view` or `text`; a `text` that is not a string gives `{citations: [], undetermined: {why}}`.

## Private

### Uses

- `jurisdictions`: the combined view's shape (`combine`), and its identifier spaces, systems, floors, crosswalks and conflicts; since T35-7, its `standard_sources` entries with `series` (R63) and their conflicts (R66), for R30–R33.
- `court-citations` (T33-8; K1506): its reporter and variant data for R27.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R23** [met] Pure: no store, no network, no clock. The same inputs always give the same answer.
- **R24** [met] No place is named in this module. Given two profiles for different jurisdictions, every service answers from the view alone. The tests use at least one profile other than the first.
- **R25** [met] Every "no" says which kind of no: outside the reach, undetermined, unjoined, a different value, or one system. Absence is never reported as non-existence.

### Satisfies

- `BIO_Content_Framework_v0_10.md` §8.3, "What makes a shared identifier count", with BOB #34's amendment to rule 3 (2026-09-25).
- `build/layers.md`, "No jurisdiction in the product".
- `BIO_Capability_Ladders_v0_1.md` §2 PEOPLE and MONEY (scheme identifiers; money identifiers), COURTS C1 (the profile `proceeding` space; the citation recogniser); rulings K1441, K1449, K1452.
- `BIO_Capability_Ladders_v0_1.md` §6B.3–§6B.4 POLICIES L1 (policy citations recognised from the profile's series) and §6C.3–§6C.4 STANDARDS L1 (a designation and its edition recognised); rulings K1713, K1722, K1723, K1740 (R30–R33).

### Suggestions

- **For the caller** (`entities`, `op=idmatch`): pass `systemOf` only the addresses the record located each capture at, never an address from the request. A provenance hop a caller can hand in is one a caller can invent. That requirement belongs in `entities`, with the three refusals C-91.1 to C-91.3 now in `bio-checks.mjs`.
- **For the callers of R30** (L1's "find every document citing one"): a search over captured text groups the citations by `key`, `series` and `normal`; that service is the caller's, never this module's (it reads nothing). A policy number is not an identifier of a thirteenth space: two citations of one item are compared by `normal`, and a shared policy number is not judged a connection by `judgePair` unless BOB adds a space for it.
- The Oakland profile's facts are measured: M-119, M-132 and M-157. None of them is captured as a crosswalk today (M-157: 0 crosswalk lines).
