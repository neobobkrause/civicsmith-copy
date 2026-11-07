# BD-15 funding disclosure: draft requirements for `/11`

These are the publication lane's drafts for BOB to place (BD-15, Bob, 7 Nov 2026; BD-13; BD-14 Q9.6). Ids are lane ids (`PF-n`); BOB gives each its module number when he places it. Evidence: `funding-in-product.md` and `funding-disclosure-practice.md`. They go into the same `/11` change as BD-7's provenance and BD-8's `review:` block, so the signed format changes once.

Bob's values (BD-15):
1. The block is optional. A case may carry it or leave it out, and an absent block reads "not stated", not concealment.
2. Every institutional and in-kind funder is named, at any amount. An individual is named only at $5,000 or more a year, or for any gift given for this case.
3. Commissioned investigations are allowed and disclosed, with the commissioner named and its role stated.
4. AI vendor credits are not funding and are not named. Members' own subscriptions fall under `members`.

Held: the BD-6 line for `civicsmith-review/1` §1 (IFCN 3, "funders have no say over the conclusions") waits on Bob.

## case-grammar

- **PF-1 The `funding:` block (`/11`).**
  - A `/11` case document may carry `funding:`, one flat row per source (K549):
    `{ord, kind, name, entity, for, role, named_in_case}`.
  - `kind` is one of `members`, `group_funds`, `grant`, `donation`, `in_kind`, `commissioned` (closed).
  - `name`:
    - is null for `members` and `group_funds`;
    - for every other kind, is the funder's name as the group's register holds it (one line, at most 200 characters).
  - `entity` is the registry entity id when the funder resolves to one, else null.
  - `for` is `general` or `this_case`.
  - `role` is `none` or the group's own words (one paragraph, at most 600 characters). It is never `none` for `commissioned`.
  - `named_in_case` is a boolean set by case-disclosures PF-4.
  - `fundingLines(rows)` writes the block; `fundingOf(fm)` reads it:
    - a `/11` document with the block answers `{stated: true, rows}`;
    - a `/11` document without it answers `{stated: false}`;
    - a document of format `/10` or earlier answers `{stated: false, predates: true}`.
    No reader ever answers "no funding" for an absent block.
  - Tests:
    - each kind round-trips;
    - `commissioned` with `role: none` is malformed;
    - `/11` without the block reads `stated: false`;
    - a `/10` document reads `predates: true`.
- **PF-2 The complete edition prints it (R14, frozen per R33).**
  - When `stated`, a `/11` complete edition has one section, "Who paid for this work, and the members' ties". It lists, in this order:
    - each funding row (`role: none` prints the fixed no-influence sentence);
    - the note "named in this case" where `named_in_case`;
    - the declared `member_ties` rows (R21), which `/10` and earlier never printed. Each row names its signer only as that signer's own `level` and `shown` allow, never more.
  - When not stated, the section is one fixed line saying the case does not state who paid for the work. The declared ties still print.
  - The words are written by the ux lane (BD-3) and frozen for `/11`.
  - Tests: byte-stable re-render of both forms; a `/10` re-render is unchanged.
- **PF-3 Affirmation.** When `funding:` is present, the document's `review:` block carries `funding_affirmed: true` (PF-5). A document with the block and without the affirmation is malformed.

## case-disclosures

- **PF-4 A funder named in the case.**
  - `fundingNamedInCase(rows, named, viewer)` sets `named_in_case` true for a row whose `entity` is among the entities the case names. This is R27's resolution (`people`, `entities` identity reads), so one entity under two references is one.
  - Rows with a null `entity` are false. Nothing here infers an entity from a name.
  - Test: a grant from an entity the case names reads true; a name-only row reads false.
- **PF-5 The signer affirms it.**
  - When the case states funding, each signer affirms, in the ceremony, that the block names every source BD-15 requires: every institution and in-kind funder, and individuals at $5,000 or more a year or giving for this case.
  - Without the affirmation, the act is refused with `FUNDING_NOT_AFFIRMED`, writing nothing. This mirrors R27's tie attestation.
  - A case without the block asks for no affirmation.
  - Test: affirmed, the case commits with `funding_affirmed`; not affirmed, it is refused and writes nothing.

## The group's funding register (new; BOB places the module)

- **PF-6 `fundingAdd({group, kind, name, entity?, for, case?, role, basis?, what?, by})` and `fundingEnd({entry, reason, by})`.** By an owner of the group.
  - Refusals, in order, each writing nothing:
    - `MACHINE_CANNOT_RECORD_FUNDING`;
    - `NOT_A_GROUP_OWNER`;
    - `FUNDING_UNKNOWN_KIND` (`members` is never entered; it is implicit);
    - `FUNDING_NO_NAME`;
    - `FUNDING_FOR_CASE_UNKNOWN` (`for: this_case` without a case of the group);
    - `FUNDING_INDIVIDUAL_BELOW_THRESHOLD`: a `donation` from an individual (no `entity`, or an entity of kind person) whose `basis` is neither `5000_or_more_a_year` nor `for_this_case`. Such donors are not named (BD-15 2), so they are not entered;
    - `FUNDING_COMMISSION_NO_ROLE`.
  - No amount is stored. `basis` is the only trace of the threshold.
  - `in_kind` carries `what`, one line on what was given. AI service credits are not entered (BD-15 4); the form does not offer them.
  - `fundingEnd` closes an entry with a reason. Nothing is deleted, and an ended entry keeps who ended it, when and why.
  - `fundingOf({group, case?, viewer})` answers the live entries: general entries, plus those for the case when one is given.
  - Members of the group see the register. The public sees only what a published case states.
  - Tests:
    - each refusal;
    - an individual at `5000_or_more_a_year` is entered;
    - a below-threshold individual is refused;
    - an ended entry is answered as ended, never deleted.

## case-inputs and case-authoring

- **PF-7 `caseFunding({case, edition, state, sources?, by})` (case-inputs).** By an owner of the case's project.
  - With `state: false`, the edition states no funding (BD-15 1).
  - With `state: true`, the proposal is:
    - `members` (always);
    - the register's live `general` entries;
    - every entry `for: this_case` of this case.

    The owner may add `group_funds`.
  - A stated block must be complete. Leaving out an entry for this case, or a live institutional, in-kind or commissioned general entry, is refused with `FUNDING_OMITS_SOURCE`, naming it. The rule is all or nothing: a partial statement misleads where an absent one does not.
  - Test:
    - stated with every source, accepted;
    - stated without the commission for this case, refused;
    - `state: false`, accepted.
- **PF-8 case-authoring.**
  - It writes `funding:` (PF-1) into a `/11` document from PF-7, with `named_in_case` from PF-4.
  - The ceremony shows the block before signing, on R88's "shown before signing" pattern, with PF-5's affirmation.
  - Test: the document's rows equal PF-7's answer, and the signed sha covers them.

## public-read

- **PF-9** For a published `/11` edition, `public-read` serves `funding` (PF-1's `fundingOf` answer) and the declared `member_ties` rows beside it, each signer shown only as its row's `level` and `shown` allow. For `/10` and earlier, it serves `funding: {stated: false, predates: true}`. No member id appears, and no member name beyond what `shown` allows. Test: both forms are served, and a `/10` edition reads `predates`.

## ux (BD-3)

These words are the ux lane's, frozen for `/11`:
- the section heading;
- the fixed no-influence sentence for `role: none`;
- the "named in this case" note;
- the not-stated line;
- the register's screens;
- the ceremony's funding step and affirmation sentence.
