Length: 64 lines. Last section: "Suggestions".

# court-doctypes: requirements

Next number: 18

**Size (P6).** About 900–1,300 lines with tests.

## Public

### Purpose

Reads a proceeding's register (its list of entries) as published by three systems: a CourtListener docket page, a CPUC proceeding card with its documents report, and an eCourt register of actions captured by a member in their own browser. Each reading gives the proceeding's number, caption and status as written and the register's rows, each keyed the way its register allows. `assess` compares two readings row by row, so a new filing or order shows as a new row. It registers no proceeding and writes no event.

### Provides

**Three content types, `{key, label, version, contract: MEMBERSHIP, detect(ctx), parse(ctx), assess(before, after, ctx)}`**, registered through `docprofile`'s registry seam (`registerCourtTypes(register)`), after `roster-reader`'s types and before `generic`. Keys: `courtlistener_docket`, `cpuc_proceeding`, `ecourt_roa`. `ctx` is `docprofile`'s.
- **R1** [met] `detect` matches at CERTAIN only a capture whose locator has the system's address shape (the view's publishing-system address shapes, under this module's keys) and whose page has the system's own structure: for `courtlistener_docket`, entry rows `div#entry-<n>` under a docket header; for `cpuc_proceeding`, the proceeding card's fields or its documents report; for `ecourt_roa`, a register of actions. A page of the right address without that structure is not matched, with why (a login page, a search form, an error page).
- **R2** [met] `ecourt_roa` matches only a capture that `ctx.origin` says is a member's own capture made in their own browser. Any other origin is not matched, with why: "an account-gated register is read only from a member's own capture" (K1492, K1449).

**What `parse` gives: `{proceeding, parties, rows, key_basis, complete, page, provisional}`**
- **R3** [met] `proceeding` is `{number, number_as_written, caption, forum_as_written, kind_as_written, status_as_written, filed, source}`, each as the page states it or `null`. `number` is `id-spaces.recognise(view, "proceeding", number_as_written)`, or `null` with why when no form of the view's `proceeding` space matches (a CourtListener page also gives `docket_number_core` as written).
- **R4** [met] `parties` lists each party, judge, commissioner or staff member the page names, as `{name, role_as_written, source}`: CourtListener's "Assigned To"; CPUC's "Filed By" and each staff role with its "Assigned" date. A role is given only as written, never mapped to a closed role, and nothing is registered (K1443).
- **R5** [met] `rows` lists the register's entries in page order, each `{key, entry_id, date, text, filer, kind_as_written, links, sealing, source}`: `date` and `text` as written (CourtListener's "(Entered: …)" stays in `text`); `filer` and `kind_as_written` where the register states them (CPUC's Filed By and Document Type); `links` each document link with its label as written, a fee-bearing link ("Buy on PACER") marked `fee: true` and never followed.
- **R6** [met] `key` is keyed per register, and `key_basis` says how: `courtlistener_docket`, the entry number, and `date` with `text` for an unnumbered entry; `cpuc_proceeding`, the composite of date, document type, filer and description, plus the document link where there is one; `ecourt_roa`, the date with the entry's sequence within that date. `entry_id` is the entry number CourtListener assigns, and `null` for every CPUC and eCourt row, because those sources assign none.
- **R7** [met] Every `ecourt_roa` reading carries `provisional: true` and a `key_basis` saying the row shape and key are assumed from the portal's own description and not yet verified on a member's capture. The other two give `provisional: false`.
- **R8** [met] `page` is `{n, of, may_continue}` as the register's pagination states it, and `complete` is `true` only when the reading holds every row the register says it has (a single page of a register of several is `complete: false`).
- **R9** [met] `sealing` is `sealed`, `unsealed` or `null`: what a row's text states about a document being sealed or unsealed, in place-free legal voice held in code. It is the row's statement, never this module's finding (K1480).

**`assess(before, after, ctx)`: the register row diff**
- **R10** [met] It compares two readings of one register by R6's key, with events from `site-profiles`' catalogue only. A row added gives `item_added`. A row gone gives `delisted` when both readings are `complete`, and `possibly_delisted` otherwise. A held row whose date, text, filer, kind, links or `sealing` changed gives `outcome_changed`, naming the row and the field. A changed `status_as_written` gives `status_changed`. A changed caption or party gives `item_changed`. Page order, white space and markup with no text give nothing.
- **R11** [met] Under a composite key (CPUC), an edit to any key field reads as one row gone and one row added. `assess` reports the two together, each naming the other as its likely counterpart, and never pairs them silently into one unchanged row.
- **R12** [met] Two readings in which no row was read, or in which either reading failed, report a failed read and why, never a register emptied (no mass `delisted`).

## Private

### Uses

- `docprofile`: the registry seam (`register`), `CONTRACT`, `CONFIDENCE`, `entity`, `diffEntities`, the reader view, `ctx.locate`; through it `site-profiles`' event catalogue (`event`, `isMeaningful`).
- `id-spaces`: `recognise(view, "proceeding", value)` (R3).
- `jurisdictions` (through the view): the publishing-system address shapes of the three systems, under this module's keys (R1); the `proceeding` number forms, through `id-spaces`.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R13** [met] Pure over its inputs: no store, no network, no clock. Nothing is fetched, a document link included.
- **R14** [met] Everything given is what the register states: no date, party, role, outcome or status is inferred, completed or corrected; a row not on the page is never read as a filing that did not happen. Registering a proceeding (`entities`, K1443) and writing a row as a `filing` or `order` event (`events` R38) are their modules' acts.
- **R15** [met] No place is named in code: addresses and number forms come from the view; page structures are the publishing systems' own and stay in code. Tests use the test profile and the first profile.
- **R16** [met] Tested on captured registers: CourtListener docket 4214664 (at least two of its four pages, and an unnumbered entry), the CPUC proceeding A2106021 card and its first documents page, and a fictional `ecourt_roa` fixture built from the portal's stated fields and marked as such, to be replaced by a member's capture (`measures-T33/courts-workbooks.md` §1). Each fixture's rows, keys and number are as a member reads them.
- **R17** [met] Every "no" (no match, no number form, no key, an incomplete register) says which kind of no and why.

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §7.2 A1, A2, A7; §7.3 L1–L2; §7.4 L1 and L2 (the register doctype: rows of date, text and filer as written with the document link; the row diff in the register doctype's assess; a register row becomes an event only when the source assigns an entry id); §7.5 (fee-bearing records only by a member's act; registers behind a member's account refreshed only by that member's act).
- Plan T33, "Measured GO (K1506)" and entry T33-16; rulings K1443, K1449, K1480, K1492, K1506.
- `build/layers.md`, "No jurisdiction in the product".

### Suggestions

- **For `docprofile`** (open, BOB's): R2 needs the capture's origin in `ctx` (`ctx.origin`, a member's own capture or a fetch). `docprofile`'s `readText` ctx names locator, headers, content type and `at`; the plane must pass origin too. If BOB prefers, R2 can instead rest on a caller obligation in `acquisition` and `following`: never fetch an `ecourt_roa` address unattended.
- **For `following`**: a new register row is `item_added`, which the catalogue grades ROUTINE, so `meaningful` is false for a register that only grew. Following a proceeding ("tell me when the judge rules") needs new rows surfaced. That is either following's own rule or a new catalogue row (for example `entry_added`, NOTICE) in `site-profiles`. Neither is in the plan. BOB's.
- **For `events`** R38: only `courtlistener_docket` rows carry `entry_id`, so only they become events under "the source assigns an entry id".
- CourtListener refuses curl's default User-Agent (403). The captures are made by `acquisition`'s usual path. Its API JSON (with the group's token, K1449) could be a fourth reading of the same register later.
- CPUC rows beyond 100 need the APEX session's pagination or the report's CSV download. A CSV capture of the report is read by `office-readers`; this module's R6 key applies to its rows unchanged.
