# docket — requirements

**Status** · In force: a new product module (N520, DEC-116, DEC-100), its readings BOB's (K1134 (4)), its place BOB's (K1256, K1257); its codes its own (N533; K1331, K1291); N534 reviewed (K1369). Last fold T33 (T33-64: R6 amended; R25, R26 new), cross-references re-pointed T35 (K2035); every requirement met (K1832). Last changed T47 (T47-28: R12 amended, `withdrawalOf` names `entry`, the entry id `public-read` R20's link reads, N952; R29 new, C-129.29 `DOCKET_OUTCOME_UNREADABLE`'s translation read by key from `words.json`, DEC-199's sentence true of every arm, N992); marked not yet met (T47).

**Size (P6).** About 1,600–2,400 lines (tables, the two-step signing, take-back, withdrawal, standing, the core read, the public reads and the feed, catalogue rows), well under 4,000. `publication` (3,633 lines measured on `main` @ 8f475cff60) gains wording only.

## Public

### Purpose

After a case is published, the world responds without changing the case. This module keeps each case's docket: dated entries beside the case, each naming the edition it concerns, on three shelves. Any member files to the group's record; only the case's manager places an entry in public, signed with their registered key. It holds the withdrawal of an edition, grants of standing, and the required core the manager is asked to list, and it answers the public shelves and a feed per case for anybody to pull. It sends nothing anywhere, and no entry is ever evidence. (DEC-116; DEC-100; Publication §5D)

### Provides

Terms.
- The **case** and its **editions** are `publication`'s; an edition an entry names is a ratified edition number of that case.
- The **manager** of a case is an owner of its owning project (`membership.isProjectOwner`, its R54; DEC-72 clause 5).
- The **named subject** of an edition is each subject entity of its member findings (`inquiry.subjectEntityOf`, its R43).
- A **holder** is one to whom a grant of standing (R10) was made; a grant is **live** from its entry's `date` until a `standing-withdrawn` entry ends it.
- The **shelves** are `listed` ("what the group stands behind as accurately listed"), `reactions` ("Reactions elsewhere") and `record` ("In our record only"). Their labels, and every word a member or reader sees (the outward-act warning, the invitation, the stamp), are the UX design stream's, cited here and never decided.
- A **record entry** is a member's filing on `record`. A **public entry** is a manager's signed entry on `listed` or `reactions`.

**Filing to the record: docketFile({case, edition, kind, from, capture, contests?, proposed, reason, author, viewer})** (`op=docketfile`; member session; mutating)
- **R1** Any joined member of the case's project files a record entry. Refusals, in order, each writing nothing and carrying a catalogue row (DEC-49): (K5148; WALK-FINAL-10B R177) The summary filed with an entry is kept for every kind that has one, and `docketPrepare` uses it when the prepare names none (R4).
  - a machine or AI credential, or an operator token, is `MACHINE_CANNOT_FILE_DOCKET`;
  - a case that is absent, has no ratified edition, or whose project `viewer` does not see in full (`membership.sight`, its R44) is `NO_SUCH_CASE`, the same answer for each;
  - `author` not a joined participant of the project (`membership.projectAuthority`'s "joined", its R55) is `PROJECT_ACT_NOT_A_PARTICIPANT`, membership's row and words, relayed (K4557, K231; T51, K4568); `DOCKET_NOT_A_PARTICIPANT` (C-129.2) is no longer answered;
  - then the form checks, never merit: `edition` not a ratified edition of the case is `DOCKET_NO_EDITION`; `from` absent is `DOCKET_NOT_ATTRIBUTED`; `from: {kind: "subject", entity}` naming no named subject of that edition is `DOCKET_NOT_THE_SUBJECT`; `from: {kind: "holder", grant}` naming no grant live at this instant (R10) is `DOCKET_NO_STANDING`; `from: {kind: "other", name}` with `name` absent, blank or over 200 characters is `DOCKET_NOT_ATTRIBUTED`; `capture` not a capture `provenance`'s register holds (its R48) with a locator in `captured_locators` is `DOCKET_NO_CAPTURE`; `kind` not one of `response` (from the subject or a holder), `statement` (the subject's public statement elsewhere, a press release included), `reaction` (anyone else) or `outcome` is `DOCKET_KIND_UNKNOWN`; `proposed` not one of `record`, `public`, `both`, or `reason` absent, blank or over 2,000 characters, is `DOCKET_NO_REASON`.

  Otherwise it records the entry with its instant, `author`, `from`, `capture`, `proposed`, `reason`, `contests` (true only when the member says the response contests the edition) and `found_by`: `watch` when the capture was filed with a sweep origin (`acquisition` R21's `origin.kind: "sweep"`, the origin `capture` R82 reads), else `paste`. A contesting entry is reported to `reevaluation` (R13). (DEC-116 items 1, 3, 6; DEC-100 items 1, 4)

  (T45; N855, N880; Actions D5, D20; v0.2 rules 16, 17; K2781 (3)) A record entry of kind `outcome` also states:
  - `outcome: {kind, on}`: `kind` is `cure` (a later act of the office that the member links as the cure) or `harm_addressed` (a member's reasoned statement that a harm was addressed); `on` is the date the outcome occurred, a calendar date no later than the filing's day;
  - `summary`: the member's words, one paragraph of 1 to 600 characters, as R4 bounds a `reactions` summary.

  Refusals, after R1's form checks, each writing nothing: `outcome` absent, its `kind` not one of the two, or `on` not such a date, `DOCKET_OUTCOME_UNREADABLE` (a new row of this module's family, C-129, numbered at its stamp); a missing or malformed `summary`, `DOCKET_NO_SUMMARY`, as R4. An entry of any other kind stating `outcome` is refused `DOCKET_OUTCOME_UNREADABLE`. An `outcome` entry is filed by a member through this op only, at once; no other module files it (the plan's reconciliation R3). It is still never core (R9), and it is placed on `listed` only by the manager's signed act (R4, R5), as DEC-116 has it (K2781 (3)). A reply from an office that is not a named subject files as a `response` once the manager grants it standing (R10); no new `from` kind (l8 doubt 5). Controls: an `outcome` without `outcome`, with an unknown kind, or with `on` after today, is refused; a `response` stating `outcome` is refused; a well-formed outcome files.
- **R2** `docketPressure({entry, pressure: {kind, note}, author, viewer})` (`op=docketpressure`; mutating) marks a record entry as a threat: `kind` one of `legal`, `retaliation`, `discrediting`, `other` (as `actions` R48's), `note` at most 500 characters. The mark is appended and never rewrites the entry. Refusals, in order, each writing nothing: `MACHINE_CANNOT_MARK_DOCKET_PRESSURE` (this module's own row, R22; `action-grammar`'s `MACHINE_CANNOT_MARK_PRESSURE`, C-117.14, is `actions`' and is never answered here; DEC-49; N526); an entry that is absent, or whose project `viewer` does not see in full, `NO_SUCH_DOCKET_ENTRY`, one answer; a member who has not joined the entry's project `PROJECT_ACT_NOT_A_PARTICIPANT` (membership's `projectAuthority` "joined", relayed; K4557: a mark is a weighty act of the project; T51, K4568); an entry already marked `DOCKET_PRESSURE_MARKED`; a kind outside the four, or a note over 500 characters, `DOCKET_PRESSURE_REFUSED` (each this module's own row, R22, in place of `PRESSURE_MARKED` and `PRESSURE_REFUSED`, which are `action-grammar`'s, C-117.17 and C-117.15, and are never answered here; DEC-49; N533, K1331). (DEC-116 item 3)
- **R3** `docketOf({case, viewer})` (`op=docket`; a read) answers a viewer who sees the case's project in full every entry on all three shelves, oldest first:
  - each record entry with its `proposed`, `reason`, `found_by`, `contests`, pressure mark, and its state: `placed` (with the public entry), `declined` (with its reason, R7), `receipted` (R8), `taken-back` (R11) or `pending`;
  - each public entry as R14 answers it;
  - the core still due (R9);
  - for each contesting entry, its prompts: the re-evaluation cause it raised (R13) and the offer of a plan checkpoint (`action-plans`' own act, which this module never performs).

  A viewer who does not see the project in full receives `NO_SUCH_CASE`, as an absent case does. Writes nothing. (DEC-116 items 1, 3)

**Placing in public, signed: docketPrepare({case, kind, shelf, edition, entry?, summary?, reason?, holder?, takesBack?, viewer, by}) → `{entry, statement, digest, warning, expires}`** (`op=docketprepare`; writes nothing) **and docketPost({digest, signature, acknowledged, by}) → `{ok, case, seq, published_at}`** (`op=docketpost`; mutating)
- **R4** Only the manager prepares. Refusals, in order, each writing nothing:
  - a machine or AI credential, or an operator token, is `MACHINE_CANNOT_PLACE_DOCKET`;
  - `NO_SUCH_CASE` as R1;
  - `by` not the manager is `DOCKET_NOT_THE_MANAGER`;
  - no group slug recorded (`promotion`'s fact `producingGroup`, its R40) is `DOCKET_NO_GROUP_SLUG`, because there are no anonymous entries;
  - `entry` naming no record entry of the case is `NO_SUCH_DOCKET_ENTRY`; one already `placed`, `declined` or `receipted` is `DOCKET_ENTRY_SETTLED`;
  - R1's form checks on the entry it would sign, then the kind's own refusals (R7, R8, R10–R12);
  - `shelf` is `listed` or `reactions`: a `reaction` goes only to `reactions`, every other kind only to `listed`; any other pairing is `DOCKET_WRONG_SHELF`; `shelf` may be omitted, and the kind's own is then used (T51, K4568);
  - a `reactions` entry requires `summary`, the group's words, one paragraph of at most 600 characters (`DOCKET_NO_SUMMARY`), and a capture whose co-archive succeeded (`attestation` R3, R7) (`DOCKET_NO_ARCHIVE_COPY`; the member may re-attest, `capture` R68).

  Otherwise it answers the entry that would be published (R6) as canonical JSON (`record-grammar`'s), its SHA-256 `digest`, `statement` = `signatures.docketStatement(case, seq, digest)`, the outward-act warning (its meaning: the public will see it, and a later entry can take it back but never unsay it; its words the UX design stream's) and `expires` 60 minutes later. For the same inputs on the same UTC day, the answer is identical byte for byte. (DEC-116 items 1, 6)
- **R5** `docketPost` refuses, in order, each writing nothing: R4's caller refusals again at this instant; `acknowledged` other than exactly `true` `DOCKET_WARNING_NOT_ACKNOWLEDGED`; no prepared answer from `by` with this `digest`, or one past `expires`, or one whose `seq` another entry has taken since, `DOCKET_STALE` (prepare again); a signature `signatures.verifySshsig` rejects, in namespace `NS_DOCKET`, over exactly `statement`, against `credentials.attestingKeys()` (its R11) restricted to keys registered to `by`, `DOCKET_SIGNATURE_REFUSED` with the verifier's reason. Otherwise the entry is stored with its armored signature and its first-published instant and is answered by R14 and R15 from that instant on; a record entry it places reads `placed`; a withdrawal is reported to `reevaluation` (R13). `docketSigners()` answers each key (`keyB64`) that has signed a public entry, with the instant it first did; viewer-free, it writes nothing and names no member (for `network-notices` R21). (DEC-116 item 6)
- **R6** A public entry carries these fields and nothing else:
  - `format` (`civicsmith-docket-entry/1`; an entry published before T31 keeps its bytes and `civicos-docket-entry/1`, every reader accepts both labels forever as the same format, and a case's chain may hold both, `previous` being the prior entry's digest over its own stored bytes; DEC-124, K1365), `group` (the slug), `case`, `seq` (1, 2, … per case) and `previous` (the prior public entry's digest, or null);
  - `shelf`; `kind`, one of `response`, `statement`, `reaction`, `outcome`, `edition`, `disclosure`, `withdrawal`, `standing-granted`, `standing-withdrawn`, `receipt`, `take-back`, `court-order` (R25);
  - `edition` (a number, or `all` for a withdrawal of every edition, R12);
  - `date` (the entry's date) and `received` (the record entry's date, when it places one);
  - `from`: the subject entity's canonical name as the registry holds it (`entities.readEntity`, its R5), a holder's name as granted, or the source's name as filed;
  - `capture`: `{sha256, origin, archived}`, the origin locator and the archive's locator (null when none);
  - by kind, `summary`, `what_changed`, `reason`, `holder`, `answers`, `takes_back`, or, for `court-order`, `order` (R25).

  No member's name, handle or id appears in it. (DEC-116 items 1, 3, 6)

  (T45; Actions D5; v0.2 rule 17) A public entry of kind `outcome` also carries `outcome` (`{kind, on}`, as filed) and `summary`. They are additive fields of `civicsmith-docket-entry/1`: an `outcome` entry published before T45 without them still verifies and reads `outcome: null` (R24's form is otherwise unchanged). Control: a pre-T45 `outcome` entry verifies and reads `outcome: null`.

  A test proves that an entry signed with the old label `civicos-docket-entry/1` still verifies (the owner's signature over `signatures.docketStatement`), that a new entry carries `civicsmith-docket-entry/1`, and that a case's chain holding both labels reads whole and in order (R14, R15). (DEC-124; K1365)

**What the group lists, and never trims**
- **R7** A `response` or `statement` placed on `listed` is listed whole: R14 answers its capture's bytes as captured, and nothing in this module alters, trims or redacts a submission's bytes. The manager may instead decline a submission that contains redactions: `docketDecline({entry, reason, by})` (`op=docketdecline`; mutating) records on the record entry, with a reason (`DOCKET_NO_REASON` as R1), that it was declined for containing redactions; nothing is published. Only the manager declines (R4's first three refusals, then `NO_SUCH_DOCKET_ENTRY` and `DOCKET_ENTRY_SETTLED` as R4). A submission from anyone without standing (a `reaction`, or `from: {kind: "other"}`) is listed only by the group's choice and is never core (R9). (DEC-100 items 1, 2, 5)
- **R8** A `receipt` entry lists a subject's or holder's reply that names a private person: its `received` date, `from`, and `reason` ("names a private person", with the manager's words), and neither its text nor its capture's bytes. `docketInvitation({entry, viewer})` (`op=docketinvitation`; a read) answers the request to resend the reply without the name, prefilled for a member to send by their own means; its words are the UX design stream's, and this module sends nothing. A resent reply is filed (R1) naming the receipt it answers (`answers`) and is placed whole (R7). (DEC-116 item 4; DEC-100 item 5)

**The required core: coreDue({case?, viewer})** (a read)
- **R9** Answers, for each case the viewer manages (one case when `case` is given), each core item still due, with its `since`:
  - (a) each record entry `from` the named subject, or from a holder whose grant was live at its filing, of kind `response`, or of kind `statement` from the subject, not yet `placed`, `declined` (R7) or `receipted` (R8);
  - (b) each ratified edition above 1 with no `edition` entry naming it; that entry quotes the edition's "What changed" statement (`case-grammar`'s `whatChangedOf`, its R8);
  - (c) each candidate `case-tensions.caseTensions` (its R4; `publication` R50 before T33-62) answers on a member of the latest ratified edition whose role is `load_bearing`, with no `disclosure` entry naming it.

  A withdrawal is core by being itself a `listed` entry (R12). `outcome` entries are never core, nor is anything about the group's own contacts with the subject (DEC-100 item 3). Writes nothing; answers no case the viewer does not manage. (DEC-116 item 2; DEC-100 items 1, 3, 4)

**Standing**
- **R10** A `standing-granted` entry, placed by the manager with a `reason` and the `holder`'s name, makes a grant: the holder's submissions filed while it is live carry exactly the named subject's rights (core, R9 (a); listed whole or declined only for redactions, R7). A `standing-withdrawn` entry, with a reason and naming the grant's entry, ends it for submissions filed after its `date` only; those filed before keep the grant's rights. A grant already ended is refused `DOCKET_NO_STANDING`. A grant is never deleted. (DEC-116 item 5; DEC-100 item 4)

**Taking back, and withdrawal**
- **R11** A `take-back` entry names an earlier public entry of the case (`takes_back`, its `seq`) with a reason; both stay answered, and reads mark the earlier one taken back. A record entry is taken back the same way, by a later record entry with a reason, and reads `taken-back`. Nothing in this module deletes an entry. Taking back a `withdrawal` or a `court-order` (R25) is refused `DOCKET_WITHDRAWAL_FINAL`, and taking back a `take-back` `DOCKET_TAKE_BACK_FINAL`. (DEC-116 items 6, 7; K1480)
- **R12** A `withdrawal` entry, placed on `listed` by the manager, names one ratified edition or `all` (every edition ratified at its `date`; an edition ratified later is not withdrawn), with a published `reason` (`DOCKET_NO_REASON` as R1). An edition already withdrawn, or `all` when every ratified edition is, is refused `DOCKET_ALREADY_WITHDRAWN`. A withdrawal is never lifted (R11); standing behind the case again is a new edition. `withdrawalOf({case, edition})` answers the withdrawal entry naming that edition, `{seq, entry, date, reason, digest}` (`entry` the public entry's id, which `public-read` R20's link to it reads; T47, N952), or null; viewer-free, it writes nothing. The edition itself is untouched and answers forever (`publication` R24). (DEC-116 item 7; N470)
- **R13** At start this module fills `reevaluation`'s docket registration once (its R30) with `withdrawals({after, limit})` (each withdrawal: the case, its owning project, the editions it names, each member finding of each named edition at its pin as `{bundle_id, sha, edition}` (read through `publication`), the signing instant, its `seq` and its entry id; K1270) and `contested({after, limit})` (each record entry with `contests: true`: the case, the edition, the edition's member findings at their pins, the filing instant, the entry). After a withdrawal's post (R5) or a contesting filing (R1) commits, it calls `reevaluation.docketActed` (its R30) once with the act's kind, case and entry; a throw there never undoes the act. (DEC-116 items 3, 7)

**A court order (K1480; Publication §5D, "A court order has its own path")**
- **R25** A court order addressed to the group (to remove or redact a published case, or to seal or unseal material in it) is complied with openly, never silently. It is placed by the manager as a `court-order` entry on `listed`, through R4 and R5 like any public entry, with `order`: `{effect, editions, parts?}`, `effect` one of `remove`, `redact`, `seal`, `unseal`, `editions` the ratified editions it names (or `all`), and `parts` the parts of the edition it names (for `redact`, `seal` and `unseal`). Its `capture` is the captured order itself (R1's `DOCKET_NO_CAPTURE`); its `reason` the manager's words. Refusals, beside R4's, each writing nothing: an `effect` outside the four, or `parts` absent for `redact`, `seal` or `unseal`, `DOCKET_ORDER_UNREADABLE`; an `unseal` naming a part no `seal` entry of the case names `DOCKET_NOTHING_SEALED`. After the post commits, in the same transaction, the entry is named to `publication.stampEdition` (its R62), so each named edition carries the stamp linked to this entry. A `court-order` entry is never taken back (R11): a later order is a new entry. An unsealing order is captured and placed before the unsealed material is used in any later act. The entry's own fields name no member (R6), and it is public whole (R19); a part a sealing order names is never carried by it. (K1632) At start, docket registers with publication its order source (publication R62), `courtOrderOf(case, entry)` answering the posted `court-order` entry `{seq, effect, editions, parts}` or null.

**The docket's dates as "what we did" (EVENTS 2a, 2b; K1494)**
- **R26** At start this module registers once with `events.registerEventSource` (its R30). For a set of entity or event ids, its source answers each public entry of a case whose named subjects (or whose editions' member findings' subjects) are in the set, within `from`–`to` by the entry's `date`, as `{at, label, ref, kind}`: `at` the entry's `date` (and, for an entry placing a record entry, its `received` as a second item), `kind` the entry's kind, `ref` its case and `seq`; bounded by `limit`. Record entries, and any entry of a case whose project the viewer does not see in full, are never answered. It writes nothing and is never evidence (R17): an entry is the group's own act, never an event of the world. (T45; N855 (6a); Actions D4, D22; v0.2 rules 15, 17) Each item the source answers carries `public: true`, since every entry it answers is a public entry: the mark `case-authoring` R57 requires before it writes an item into a published timeline. Under `audience: "public"` (`events` R28, R30) it answers the same items. Control: every item carries `public: true`, and a record entry is never an item.

**The pressure marks, for the modules that act on them** (T45; N858; Actions D10; v0.2 rule 12; S1 §D 10)
- **R27** (T45; N858; Actions D10; v0.2 rule 12; the plan's reconciliation R14) Two reads of R2's marks.
  - `docketPressureMarks({kind?, after, limit})` answers, read as the plane (no viewer), each R2 mark in the order made after `after`, as `{mark, entry, case, project, kind, note, at}`, with `cursor` the last mark answered when more follow, else null. `limit` defaults to 1,000 and is clamped to 1–1,000. With `kind`, it answers only that kind; a `kind` outside R2's four is refused `DOCKET_PRESSURE_REFUSED`.
  - `docketPressureOf({entry, viewer})` answers that entry's mark as `{entry, case, project, kind, note, at}`, or `{entry, pressure: null}` when it has none. An entry that is absent, or whose project `viewer` does not see in full, is `NO_SUCH_DOCKET_ENTRY`, one answer.
  - Neither names a member. Each writes nothing and never throws: an unreadable table answers `{ok: false, reason: "DOCKET_UNREADABLE"}`, never a short list.
  - This module places no hold and raises no to-do (R20). `action-holds` reads these (a hold placed from a `legal` mark; its `holdsDue`, which covers docket `legal` marks and which `action-producers` reads for the hold to-do).

  Controls: an unmarked entry answers `pressure: null`; an unseen entry is answered as an absent one, byte-identical; `kind: "legal"` lists only legal marks; paging is tested across a `cursor`.

**Nothing of a counsel matter on a docket** (T45; N892; Actions D4; the plan's reconciliation R8)
- **R28** (T45; N892; Actions D4; v0.2 rule 15; `project-roster` R21, R23) `docketFile` (R1), `docketPrepare` (R4) and `docketPost` (R5) refuse, writing nothing, when `project-roster.projectScope` (its R23) answers `counsel_matter` for the case's owning project at the act: with `publication` R78's row, `COUNSEL_MATTER_NOT_PUBLISHED` (one code, one row), after R1's not-joined refusal (for `docketFile`) or R4's `DOCKET_NOT_THE_MANAGER` (for the other two) and before every form check. Entries already public stay public and answer forever (R16; a scope changes nothing already published, `project-roster` R21); R27's marks are still answered, so a hold can still be placed from one. Controls: the same acts on a case whose project's scope is `none` proceed; a case whose project became a counsel matter after an entry was placed still answers that entry in R14.

**Its words** (T47; DEC-199; N992)
- **R29** (T47; N992; DEC-194, DEC-199; amends R1, R22) C-129.29 `DOCKET_OUTCOME_UNREADABLE` takes its translation from `words.json`'s `refusal.DOCKET_OUTCOME_UNREADABLE`, read by key (as `membership`'s `HANDLE_WORDS` and `extraction`'s `TRANSCRIBE_WORDS` are), never a copy: DEC-199's sentence, true of every arm R1 refuses with it (an outcome missing, of an unknown kind, dated after its filing, or stated on another kind of entry). Its code, number, `where` and behaviour are unmoved; (K3110) C-129.13 `DOCKET_PRESSURE_REFUSED` likewise reads `words.json`'s `refusal.DOCKET_PRESSURE_REFUSED` by key, with its own control; this module's other rows, which `words.json` does not hold, keep theirs. The changed row waits for T48's promotion stamp (plan rule 5 (2)). Control: the row's translation equals its key's sentence, and each of R1's four outcome refusals answers it.

**A pressure mark says who made it** (T51; DEC-340)
- **R30** (T51; N858 D10; DEC-340, U366; K3935; amends R3, R27; `screens-publish` R43) **A pressure mark says who made it.** Each record entry `docketOf` answers (R3) carries its pressure mark as `{kind, note, at, by}`, `by` the marking member as `{member, handle}` for a viewer who sees the case's project in full (R2 stores her; the R27 plane-level reads still name no member), `null` for a mark whose author is not a member. Test: a mark made by Dev answers `by` Dev to a participant; control: `docketPressureMarks` and `docketPressureOf` still name no member.

**Public reads** (no credential; served by `public-read` R21)
- **R14** `docketPublic({case})` answers the case's public entries, oldest first, each with its JSON, armored signature and first-published instant, a taken-back entry marked so (R11), the bytes of each `listed` entry's capture by its hash (R7; never for a `receipt` or a `reactions` entry), and `last_entry`, the latest entry's date (null when none). A case with no ratified edition answers null, as an absent one. The `record` shelf never appears. (DEC-116 items 1, 8; DEC-100 item 2)
  `lastEntryOf({case})` answers, synchronously, whatever the viewer and without reading any capture's bytes, the `date` of the case's latest public entry (the `last_entry` `docketPublic` answers), or null; `public-read` R20 reads it for `docket_last_entry`. (K1276)
  Interface details settled at the build (K1274, K1278): `docketFile` takes an optional `takesBack` (a record entry id of the case) with `reason`, taking that entry back (R11); `docketPrepare` takes `candidate` (a disclosure, R9 (c)) or `grant` (a standing withdrawal, R10), published as the entry's `answers`; `docketPublic` answers each listed capture's bytes base64 under `captures: {<sha256>: <base64 or null>}`. Codes are family C-129.
- **R15** `docketFeed({case})` answers the same entries as an Atom 1.0 feed (RFC 4287), newest first, its `updated` the last entry's date, each entry linking to the case's docket; null for a case with no ratified edition. The feed's and each entry's Atom `id` (`urn:civicos:docket:<group>:<case>`, and `…:<seq>` for an entry) never change, whatever the entry's `format` label: they keep `urn:civicos:` permanently, because a changed id makes every reader show every entry again as new (DEC-124; K1365 (3)). Reading it writes nothing and records nothing about the reader. The module exports `DOCKET_UNREADABLE`, the sentence "Could not read the publisher's docket", for a citing copy to say when a docket cannot be read (DEC-101 (3)'s citing side: `case-import` R18, R19). (DEC-116 item 8)
- **R24** The public answer has this exact form. A citing copy depends on it (DEC-101 (3); `case-import` R18).
  - `docketPublic({case, captures?})` answers `{ok: true, case, group, entries, captures, last_entry, feed}`.
  - Each entry is `{seq, entry, digest, json, fields, signature, published_at, taken_back}`:
    - `json` is the exact canonical JSON (R4) whose SHA-256 is `digest`;
    - `signature` is the armored SSHSIG made over `signatures.docketStatement(case, seq, digest)` in `NS_DOCKET` (R5);
    - `fields` is `json` parsed;
    - `taken_back` is `{seq, date}` or null.
  - With `captures: "omit"`, `captures` is `{}` and the answer adds `captures_omitted: true`. No capture's bytes are read.
  - Everything else is as R14 says.

#### T53 additions

- **R32** (T53; JOURNEYS R-94, owner half, BLOCKS; Bob K5558, J5 = A: the project's owner, from the docket page; changes R1, R10, R12) The entry kinds the screen offers are the kinds the act accepts for the viewer; a court order, a correction and a withdrawal are filed by the manager (R12) through one act each, and an Outcome entry names the two fields it needs in its refusal. Test: each kind with each role answers filed or its refusal naming the missing field.
- **R33** (T53; moved from `publication` R83; JOURNEYS R-96, owner half; Bob K5559, J6 = A: each new edition is recorded on the docket automatically, with its "what changed" text; K5571 (2): the docket is later than `publication` and offers the act, `publication` calls nothing here) **Each new edition is recorded on the docket automatically, with its "what changed" text.** `docketRecordEdition({case, edition})`, in-plane, files the `edition` entry of R9 (b) for a ratified edition of the case, carrying the "What changed" statement `case-grammar.whatChangedOf` (its R8) answers; edition 1 files one without a change text. The module that ratifies an edition calls it once the edition is ratified (it is a later module, so this module and `publication` call nothing of it); an edition already holding its `edition` entry files none, so a repeated call is harmless, and an edition not ratified is refused with R1's `DOCKET_NO_EDITION`. Test: ratify edition 2 and call it: the docket holds an `edition` entry for edition 2 with the text, and edition 1 filed one without a change text; a second call files no second entry. Control: an edition no one has recorded stays on `coreDue` (R9 (b)); an unratified edition is refused `DOCKET_NO_EDITION` and files nothing. (BOB 4 Nov, PR 278, option (a); amends R33, keeping its intent: each ratified edition is recorded on the docket with its what-changed text) The entry is signed as every public entry is (R24): the ratification ceremony also signs it with the manager's registered key, since the plane holds no key of its own. `docketRecordEdition({case, edition})` answers the prepared entry (R6's fields, canonical JSON), its `digest` and `statement` = `signatures.docketStatement(case, seq, digest)`, writing nothing (as `docketPrepare`); `docketRecordEdition({case, edition, signature, by, digest?})` files it only after R5's verify (`signatures.verifySshsig` in `NS_DOCKET` over exactly that statement, against `credentials.attestingKeys()` restricted to keys registered to `by`), storing its armored signature. Refusals on the filing step, each writing nothing: `by` no member `MACHINE_CANNOT_PLACE_DOCKET`; not the manager `DOCKET_NOT_THE_MANAGER`; a `digest` that is not the entry's at this instant `DOCKET_STALE`; a signature the verifier rejects `DOCKET_SIGNATURE_REFUSED` with its reason. An edition already holding its entry answers `filed: false` at either step. The ratifying module carrying the signature is `ratification`'s, through the provider notice this change raises. Test: a prepared-then-signed edition entry's served signature verifies over `docketStatement` in `NS_DOCKET`; an unsigned or wrongly signed one is refused and files nothing.

## Private

### Uses
(K3115: re-taken from DOCKET #9's record, the services the code calls.)
- `record-core`: `transact` (its R32); `mintOpaqueId` (R6, R7; R62's `MINT_EXHAUSTED`); `registerMintSeed` (R70, R71); `declarePurge` (R21); `registerCounts` (R63); `readFile` (R13, R14); `evidenceStore` (R38); `stampInstant` (R47).
- `membership`: `sight` (its R44); `isProjectOwner` and `isJoinedParticipant` (R54); `projectAuthority` (R55); `positionalMember` (R76).
- `credentials`: `attestingKeys` (its R11).
- `promotion`: the `producingGroup` fact (its R40).
- `provenance`: `homeOf` (its R4, R5); the `register` and `captured_locators` read contract (R48), which carries acquisition's filed `origin` for `found_by`.
- `attestation`: `attestationsOf` (its R7).
- `entities`: `readEntity` (its R5), the subject's name (R6).
- `inquiry`: `subjectEntityOf` (its R43).
- `reevaluation`: `registerDocket` and `docketActed` (its R30).
- `publication`: `stampEdition` and `registerOrderSource` (its R62); `cases`, `published_cases`, `published_case_members` and `case_documents` under its R40; its R78 row, `COUNSEL_MATTER_NOT_PUBLISHED`, answered by R28.
- `case-grammar`: `whatChangedOf` (its R8).
- `case-tensions` (T33-62): `caseTensions` (its R4), R9 (c).
- `events` (T33-64): `registerEventSource` (its R30), R26.
- `project-roster` (T45; N892): `projectScope` (its R23), for R28.
- `record-grammar`: `canonicalJson`, `sha256HexSync`, `parseFrontmatter`, `isMachineIdentity`.
- `signatures`: `verifySshsig` (its R2); `NS_DOCKET` and `docketStatement` (its R39, R40).

### Invariants
- **R16** One way: a public entry is never altered or deleted; only a whole-store purge clears this module's tables, and a bundle purge leaves the docket standing. (DEC-116 items 6, 7; DEC-12, DEC-19)
- **R17** A docket entry is never evidence: nothing here writes a bundle, a basis leg, an edge, a state, a strength or a grade, and no answer here composes or changes one. (DEC-116 item 1)
- **R18** Only a member files and only the manager places, declines or signs; no machine, AI run, operator token or administrator does any of these. (DEC-116 item 6)
- **R19** No sealed, confidential or redacted public entry exists: an entry is public whole or not public (R7, R8). (DEC-100 item 2)
- **R20** This module makes no outbound call and pushes nothing; no public answer names a member. (DEC-116 item 8)
- **R21** No place is named in this module's behaviour or outward text (`layers.md`, "No jurisdiction in the product").
- **R22** Each refusal code above, except `NO_SUCH_CASE`'s shared answer, is a row of this module's own table (DEC-49), a new family numbered at its stamp; a change to any moves `CATALOG_VERSION`. No code of this module's table is a code another module's table holds (one code, one row; K1291, K1331): rows C-129.12 and C-129.13 carry `DOCKET_PRESSURE_MARKED` and `DOCKET_PRESSURE_REFUSED` (N533), re-worded and stamped by `promotion`.
- **R23** (N525) Every address this module answers (an entry's link to its case's docket, the feed's own address) is written as the rest of the public read path writes its addresses, the query alone with no leading `?` (`op=docketpublic&case=<case>`, `op=docketfeed&case=<case>`; `public-read` R20, R21). Inside the Atom feed (R15), where a link must resolve on its own, each `href` is that address as a query-only relative reference (`?op=…`, RFC 3986 §4.2), so it resolves against the feed's own address.

### Satisfies
- `docs/architecture/BIO_Publication_v0_1.md` §5D (all of it), §2 (one way), §3 rules 6 (right of reply) and 10 (the credential-free read), §7 (the slug as the group's public identity).
- DEC-116 items 1–8; DEC-100 items 1–5; DEC-72 clause 5 (the manager); DEC-12, DEC-19; DEC-49.
- N470 (K943: the withdrawal act); `plan/next.md` row H5 (DEC-100).
- DEC-101 response 3 (the public answer a citing copy reads, and `captures: "omit"` so a daily read does not fetch every capture): R24 (N534).
- `BIO_Action_v0_2.md` §4 rules 12, 15, 16, 17 (K2780; K2781 (3); T45, N893): dated outcome entries by a member's act (R1, R6), the published record of actions (R26), the pressure marks read for holds (R27), nothing of a counsel matter on a docket (R28); Actions D4, D5, D10, D20, D22.

### Suggestions
- **Tables:** `docket_entries` (public, with signatures), `docket_record` (record entries) and `docket_marks` (pressure marks, declines, receipts, take-backs of record entries). Each is declared to purge, whole store only (R16).
- **Two-step signing:** `network-notices`' and the case ceremony's pattern: prepare, sign in the browser, post.
- **The paste path** is the surface's: it calls `op=acquire` with the link, co-archive asked (`acquisition` R20), then `op=docketfile` with the capture. A watched source reaches the docket the same way, through a sweep's held capture (`link-sweep` R5, `capture` R82's `matched_sweep`). The assistant's labelled suggestion (DEC-95 (3)) has no home yet; `found_by` has no `suggestion` value until it does.
- **T33-64 (open technical details, BOB's).** R25's refusal codes and row numbers are the job's (family C-129). Whether a subject's dated response (`received`) should also become a held event in "what they did" (written through `events`, cited to its capture) rather than only an item of this source is open: R17 keeps a docket entry from being evidence, so R26 answers it as the group's lane only. Whether `seal` and `remove` withhold bytes from the public read is `publication`'s and `public-read`'s (R62 there).
- **Not drafted** (the draft's unresolved readings, kept): disclosures other than tensions (R9 (c) covers `case-tensions` R4 only); a link from a plan checkpoint to an entry. (T45) A `legal` mark's hold is `action-holds`' act and its to-do `action-producers`', both reading R27 through `action-holds`' `holdsDue`.
- **Tests:**
  - each refusal, with a negative control;
  - a withdrawal of `all`, then a new edition, which is not withdrawn;
  - a take-back of a withdrawal, refused;
  - a holder's submission before and after `standing-withdrawn`;
  - a reply naming a private person: the receipt carries no text and no bytes, the resent reply is listed whole;
  - no member id in any public answer, checked over every answer;
  - the feed read leaves every table byte-identical.

- **R31** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `docketfile`, `docketpost`, `docketpressure`, `docketprepare` (K4568). Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
