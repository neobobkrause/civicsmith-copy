# network-notices — requirements

**Status** · In force: folded by BOB #94 at T23's opening (K1113; DEC-111, K1019, K1031, K1100), with later folds reviewed. Last changed T27 (N520: R21); every requirement met (last merged T34, K1835).

**Size (P6).** About 1,300–1,900 lines, well under 4,000.

## Public

### Purpose

This module lets a project's owner tell the network that the group is working on something, and it keeps that notice honest. A notice is prepared from a real project and signed in the browser by one of the project's owners, as a published case is signed. It is published at the group's own public address.

The copy computes what the owner cannot honestly assert alone, and signs those facts with its own instance key: the activity level, re-signed monthly, the cases the project has published, the seals opened, and the closing or lapse of the notice. The module seals each week of a project's work under an independent timestamp, and opens the seals that relate to a case when the case is published. It serves the group's public signing keys without names. It sends nothing anywhere. The network pages read what it publishes.

### Provides

Terms.
- A **notice** is one "working on" statement about one project. It has an opaque **notice id** that is never the project's id.
- A **revision** is one owner-signed version of a notice, in the format `civicsmith-working-on/1` (`civicos-working-on/1` for a revision published before T31; DEC-124).
- An **attestation** is one statement about a notice signed with the copy's instance key (R13), in the format `civicsmith-working-on-attestation/1` (`civicos-working-on-attestation/1` for an attestation issued before T31; DEC-124).
- A **week** is a UTC ISO week, from Monday 00:00Z to the next Monday 00:00Z.
- A **member act** is defined in R8. A **counted week** is a week with at least one member act on the project.
- The **activity window** is the 13 complete weeks before an attestation's `as_of`.
- A **seal** is the digest that commits to one week's member acts on one project (R15).
- The **project reference** is the notice id, carried by the notice and by every later case of the project (R19).

**prepareNotice({project, notice?, wording, body?, matter?, since, collaborate, handoff?, final?, viewer, by}) → `{ok, revision, statement, digest, warning, caution, expires}`** (`op=noticeprepare`; member session; writes nothing)
- **R1** Refusals, in order. Each writes nothing and carries a catalogue row (DEC-49):
  - no `project` is the required-argument refusal;
  - a project that is absent, or invisible to `by`, is `membership`'s `noSuchProject`, the same answer either way. A project `by` sees only at `existence`, in either of its forms (`membership.sight`, its R44; D54, K2529) is instead `membership.existenceAct`'s refusal (its R77, C-70.1), never `noSuchProject`;
  - a machine or AI credential, or an operator token, is `MACHINE_CANNOT_POST_NOTICE`;
  - `by` not an owner of the project (`membership.isProjectOwner`, its R54) is `NOTICE_NOT_THE_OWNER`;
  - a project at stage `closed` (`project-stage` R2) is `NOTICE_PROJECT_CLOSED`, unless `final` is `stopped` on an open notice (R11);
  - no group slug recorded (`promotion`'s fact `producingGroup`) is `NOTICE_NO_GROUP_SLUG`, because there are no anonymous notices;
  - no instance key bound (`attestation.instanceKeyBound`, its R6; `provenance` R57 before N512's split) is `NOTICE_NO_INSTANCE_KEY`, because a notice is never published without its signed level. The check signs nothing, so it never sets a key's `first_used`;
  - `wording` that is empty, more than one line or over 280 characters is `NOTICE_WORDING_MALFORMED`. So is `body` or `matter` of more than one line or over 120 characters, and `handoff` of more than one line or over 280 characters;
  - `since` that is not a date is `NOTICE_SINCE_MALFORMED`;
  - `since` earlier than the project's creation (the UTC date of the first entry in its history) is `NOTICE_SINCE_BEFORE_PROJECT`, naming that date;
  - `since` later than today (UTC) is `NOTICE_SINCE_IN_FUTURE`;
  - a first revision while the project already has an open notice is `NOTICE_ALREADY_OPEN`, naming that notice. A change is a new revision of it (R6).
  - a `notice` named that is not the project's latest unstopped notice, or a stop that names none, is `NOTICE_NOT_OPEN` (C-127.14);
  - `since` earlier than the notice's current `since` is `NOTICE_SINCE_EARLIER` (C-127.15);
  - a revision, other than a stop, whose `wording`, `body`, `matter`, `since` and `collaborate` equal the current ones is `NOTICE_UNCHANGED` (C-127.16).
- **R2** Otherwise it answers the revision that would be published, and changes nothing:
  - `revision` is canonical JSON (`record-grammar`'s) with exactly R3's fields;
  - `digest` is its SHA-256;
  - `statement` is `signatures.noticeStatement(noticeId, revision number, digest)`;
  - `warning` is the outward-act warning. Its meaning is that the public, including anyone being examined, will see it, and that stopping later will not unsay it. Its words are the UX design stream's (K1031 (5));
  - `caution` is `two_open_without_published_work` when the group has published no case edition (`publication` R40) and already has two or more open notices, and null otherwise. It never refuses (K1031 (4)), and its words are the UX design stream's;
  - `expires` is 60 minutes later.

  For the same inputs on the same UTC day, the answer is identical byte for byte.
- **R3** A revision carries these fields and nothing else:
  - `format` (`civicsmith-working-on/1`; a revision published before T31 keeps its bytes and `civicos-working-on/1`, every reader accepts both labels forever as the same format, and a notice's revisions may hold both, `previous` being the prior revision's digest over its own stored bytes; DEC-124, K1365), `group` (the slug), and `notice` (the notice id, minted at the first revision);
  - `revision` (1, 2, …) and `previous` (the prior revision's digest, or null);
  - `wording`, `body` and `matter` as the owner gave them, with absent ones omitted. They are never filled in from the project's contents;
  - `since` and `posted` (dates);
  - `collaborate` (true only when the owner chose it) and, with it, `doorbell`: the path of the group's doorbell relative to the group's public address (`capture`'s knock, its R32);
  - `status`, which is `open` or `stopped` (R11), and `handoff` (with `stopped` only);
  - `others_welcome`, a fixed sentence.

  No member's name, handle or id appears in a revision. The level, the cases, the seals, `closed` and `lapsed` are the copy's facts and appear only in attestations (R12).

  A test proves that a revision signed with the old label `civicos-working-on/1` still verifies (the owner's signature over `signatures.noticeStatement`), that a new revision carries `civicsmith-working-on/1`, and that a notice whose revisions hold both labels is served whole and in order (R20). (DEC-124; K1365)

**postNotice({digest, signature, acknowledged, by}) → `{ok, notice, revision, published_at, attestation}`** (`op=noticepost`; member session; mutating)
- **R4** Refusals, in order. Each writes nothing:
  - R1's caller refusals, checked again at this instant;
  - `acknowledged` other than exactly `true` is `NOTICE_WARNING_NOT_ACKNOWLEDGED`;
  - no prepared answer from `by` with this `digest`, or one past `expires`, is `NOTICE_STALE` (prepare again);
  - a signature that `signatures.verifySshsig` rejects is `NOTICE_SIGNATURE_REFUSED`, with the verifier's reason. The check is in namespace `NS_NOTICE`, over exactly `statement`, against `credentials.attestingKeys()` (its R11) restricted to the keys registered to `by`.
  - a first revision whose notice id is already spent is `NOTICE_STALE`. The post records the notice id through `record-core.recordOpaqueId` (its R75) inside its own transaction, so the ledger holds it from that instant, never only from a later start's mint seed.
- **R5** Otherwise the revision is stored with its armored signature and the instant it was first published. In the same transaction, an attestation (R12) is issued over it. Both are served by R20 from that instant on.
- **R6** A change to an open notice is a new revision through R1–R5. A change is a new wording, body or matter, a change to `collaborate`, or a later `since` within R1's bounds. The new revision names the prior one in `previous`, and the prior one stays served. A revision never changes `group` or `notice`.

**The activity level** (§5B "The activity level")
- **R7** The level is one of five words, decided by the number of counted weeks in the activity window: `Very active` (10–13), `Active` (7–9), `Some work` (4–6), `Quiet` (1–3) and `Dormant` (0). The cut-offs are this module's constants.
- **R8** A **member act** is a write to one of the project's bundles (`record-core.listBundles({project})`, its R35) whose history entry has a member author. That is an identity outside `record-grammar`'s non-member set, with a writer that is neither `mechanical` nor an AI run.
  - A member's adoption of a machine draft counts. The draft does not.
  - How many acts a week holds never changes the level. Only whether it has one does.
- **R9** `activity` is `{level, weeks_counted, window: 13, as_of, method}`. `as_of` is the date it was computed, and `method` is the version of R10's method.
- **R10** `activityMethod()` answers, with no credential, the method as fixed text with its version: the window, the cut-offs, R8's definition and what is never counted. A change to the method is a new version. An earlier attestation keeps naming the version it was computed under. The version's label is `civicsmith-working-on-activity/1`; `civicos-working-on-activity/1`, the label written before T31, names the same method, and `activityMethod()` lists that earlier label as the same method, so a reader holding an earlier attestation finds its method. Renaming the label is not a change to the method. (DEC-124; K1365 (2))

**Stopping, closing and lapse** (§5B "Ending")
- **R11** An owner stops a notice with a final revision through R1–R5, with `final: stopped`. It carries `status: stopped` and the optional `handoff` (one line, at most 280 characters, which may name another group or an open lead). A stopped notice takes no further revision.
- **R12** An **attestation** carries these fields and nothing else:
  - `format` (`civicsmith-working-on-attestation/1`; an attestation issued before T31 keeps its bytes and `civicos-working-on-attestation/1`, and every reader accepts both labels forever as the same format; DEC-124, K1365), `group`, `notice`, `as_of` and `kind`;
  - `revision`: the digest of the latest revision;
  - `status`: `open`, `stopped`, `closed` or `lapsed`;
  - `activity` (R9), computed at `as_of`;
  - `cases`: the public reference (case id and edition) of every case edition the project has published (`publication`'s `cases.project_id` and `published_cases`, under its R40);
  - `seals`: each counted week's `{week, seal, timestamp_sha, untimestamped}` (R15);
  - `openings`: references to the openings published so far (R17).

  `kind` is one of these, each issued once:
  - `posted`, issued with each revision (R5);
  - `monthly`, issued on the first day (UTC) of each month while the notice is open;
  - `published`, issued when a case edition of the project is published (R17);
  - `closed`, issued when the project reaches stage `closed` while the notice is open (signed by the copy's key at once; an owner may still add a stop with a handoff note; Bob, K1100);
  - `lapsed`, issued when a notice has been `Dormant` at two consecutive `monthly` attestations with no revision between them. The lapse also goes into the group's record.

  A stopped, closed or lapsed notice takes no further `monthly` attestation. It stays served and is never deleted.
- **R13** An attestation is signed with the copy's instance key (`attestation` R5; `provenance` R56 before N512's split) over the statement `attestation.instanceStatement(<its R12 format>, sha256(attestation))`: `civicsmith-working-on-attestation/1` for a new attestation, while one issued before T31 stays signed, and verifies, over `civicos-working-on-attestation/1`. A test proves that an attestation signed with the old label still verifies, and that a new one is signed with the new label (DEC-124; K1365). When no key is bound at the moment a `monthly` attestation falls due, the attestation is not issued. The miss is stated in R22 and becomes a condition for the project's owners (`queue-producers` R27). The notice then shows its last attested level with that level's date.

**Seals: proof of activity** (§5B "Proof of activity")
- **R14** After each week ends, this module seals that week's member acts (R8) for every project that is not `closed`, whether or not the project has a notice:
  - each act is a leaf made of the bundle id, the bundle digest after the act, the act's operation and its instant, never its author, with its own random 256-bit salt;
  - the project's week **seal** is the SHA-256 Merkle root over those leaves, padded to a fixed size with salted dummy leaves, so the root reveals neither the acts nor how many there were;
  - a week with no member act has no seal.

  The seal construction keeps its published name permanently: the hash tags `civicos-seal-leaf/1`, `civicos-seal-node/1`, `civicos-week-leaf/1` and `civicos-seal-dummy/1`, and the method `civicos-working-on-seal/1` an opening names, never change, because renaming them would break the opening of every week sealed before (DEC-124; K1365 (2)).

  `sealWake(now)` answers null when the instance has nothing to seal (no project that is not `closed` has a member act not yet sealed), so an idle instance holds no timer (`scheduler` R15); otherwise the instant the next seal falls due.
- **R15** One RFC 3161 timestamp is requested per instance per week (`signatures.timestampRequest`, through `host-governor`, trying `TSA_ENDPOINTS` in order). It is requested over the root of all of that week's project seals, and its token is kept. When every authority fails, the week's seals are kept and marked `untimestamped`, and their weeks still count.
- **R16** Salts and leaves are never served, exported or put in any answer until they are opened (R17). A seal reveals nothing, even to someone who holds candidate documents to test against it.
- **R17** `openSeals({case, edition})` is called by `ratification`'s case ceremony once an edition is committed (`ratification` R37), with no choice offered (K1031 (3)).
  - For each sealed week of the case's project, it publishes the leaves for acts on bundles that the edition publishes (`publication.caseCitedParts`, its R41, and the edition's members). Each leaf comes with its salt, its Merkle path to the project seal and on to the week root, and the timestamp token.
  - Nothing else of any week is revealed.
  - An opening is idempotent per (case, edition, week).
  - An opening's `format` is `civicsmith-working-on-opening/1`; an opening published before T31 keeps its bytes and `civicos-working-on-opening/1`, and every reader, `verifyOpening` (R18) included, accepts both labels forever as the same format. Its `method` stays `civicos-working-on-seal/1` (R14). A test proves that an opening with the old label still verifies (DEC-124; K1365).
  - An edition whose case document is committed (`publication` R40) but which is not yet published whole (its R53) is opened by no call: the call answers `NO_PUBLISHED_EDITION` and keeps the request, and the scheduled `working-on-attest` tick opens it once the edition is published whole, so nothing about an unpublished member is revealed (R16). A call for an edition with no committed case document keeps nothing.
  - A `published` attestation (R12) follows.
  - `attestWake(now)` answers null when no notice is open and no opening is kept, so an idle instance holds no timer (`scheduler` R15); otherwise the instant its next attestation or retried opening falls due.
- **R18** `verifyOpening(opening)` is pure. It answers whether the leaves hash to the sealed root and whether the token is bound to that root (`signatures.parseTimestampResponse`). A stranger, or this module's own tests, can check an opening without this instance.

**The project reference a later case carries**
- **R19** `noticeReferenceOf(project)` answers the notice id of the project's open or most recent notice, or null. `case-authoring` writes it into the case document, so that a case and its notice are visibly the same work (DEC-111; `case-grammar` R10, `case-authoring` R41).

**Public reads** (no credential; served at the group's public address through `public-read` R18; registered at start under the names `activitymethod` (R10), `noticespublic` (R20) and `groupkeyspublic` (R21), K1150)
- **R20** `noticesPublic({after, limit})` answers every revision and every attestation ever published, in order of (notice, then first-published instant). Each comes with its JSON, its signature (armored for a revision; for an attestation, the instance signature and its key id), its first-published instant, and, for an attestation, the openings it references (R17).
  - It answers at most `limit` items (200 by default, 1,000 at most), with `truncated` and `next`.
  - Nothing is ever removed from it.
  - A revision that is only prepared (R2) never appears in it.
- **R21** `groupKeysPublic()` answers the group slug and two lists:
  - `owners`: every key `credentials.signerList` (its R8) shows registered to a member who owns a project now, or who signed a published edition, a revision or a public docket entry (`docket` R5; N520). Each comes with `status` (`attests`, or `revoked` with the date its status changed, `credentials.signerList`'s `status_at` (its R8, R21), never the date this copy first saw it; null when `status_at` is null, a revocation recorded before the date was kept) and the date it was first listed, never the member's name, handle or id;
  - `copy`: every instance key that has signed an attestation (`attestation.instanceKeys`, its R5), with the date it was first used. Each is labelled as this group's Civicsmith key (DEC-149, K1821, K1833; the field name `copy` stays wire format).

  A revoked or replaced key stays listed, so older signatures can still be checked.

**Member reads**
- **R22** `noticesOf({project, viewer})` (`op=notices`) answers a viewer who can see the project (`membership.sight`, its R44). A project absent or invisible to `viewer` is `noSuchProject`; a project `viewer` sees only at `existence`, in either form (D54, K2529), is `membership.existenceAct`'s refusal (its R77, C-70.1). Otherwise it answers:
  - the project's notices, their revisions and their attestations;
  - the next `monthly` date, and the lapse date when one is running;
  - any `monthly` attestation missed for want of a key (R13);
  - its sealed weeks (week, seal, and whether timestamped), never the salts;
  - `methodVersion` (R10).
- **R23** (T53; K5507, K5527; N1110; rewrites R23's earlier text (a directory submission after publication); amends Purpose, R30, and `site`'s Listed groups note) `directorySubmission({case, edition, viewer})` (the op name is unchanged) answers the fields of a **submission of a published case to the network pages**, prefilled: the case's public link, title and summary, and the group slug. The network pages are the pages the holder of the network domains keeps outside Civicsmith, which read groups' signed notices (Publication §5B); they are not the directory of groups, which is the stewards' hand-kept list on civicsmith.org (`site`), and nothing in this requirement lists, requests, declines or removes a listing there (a group's request to be listed is R32's `listingRequest`). A member copies the fields or opens them. It sends nothing, and the answer names no network domain. Test: the answer's keys are exactly `ok, group, case, edition, link, title, summary, sends`, with no `listed`, `request` or `contact` key; a case with no published edition is `NO_PUBLISHED_EDITION`; no network call is made; the answer holds no domain; the requirements text of R30 and Purpose contains no "directory" (a grep test on the file). Control: behaviour unchanged for every input R23 had.

#### T53 additions

- **R32** (T53; N1110, K5507, K5530 B2, K5532; DEC-132 (3), DEC-247; outward-act warning, principle 4.5) **`listingRequest({viewer})` prefills a group's request to be listed on civicsmith.org.** For an administrator (`member-roster` R23; not "at `FULL` sight", which is a project's sight, `membership` R44), it answers the fields of the request: the group's display name, its place, its focus, and its published cases as the site's row shows them (`site` R4), each only if the group has set it public (DEC-132 (3); the focus and its `public` visibility are `member-roster` R44–R45's `groupDescription`; UNVERIFIED: no requirement read holds a group's "place" as a field of the description, so `place` is omitted from the answer when no field holds it). The display name is `instance-setup`'s (layer 11), which this module (layer 8) cannot use: the layer-11 door passes it in. An administrator copies the fields or opens the stewards' address with them. The answer also carries `contact`, an optional line the stewards may use to reply to the group by their own mail (K5530 B2, `stewards` R26, R-D2a's `contact?`). It is empty in the answer: the product does not fill it from any member's account, address or roster row (a member's email is not the group's contact); the administrator types a line of their choosing into the prefilled request, or leaves it blank, and the line goes only in the message the administrator sends the stewards (or the stewards' request door, `stewards` R-D2a), never to the site. `listingRequest` sends nothing, calls nothing and records nothing, so the product keeps no copy of it: the contact line exists only in the request the administrator sends, then in the stewards' store, erased with `stewards` R15's retention (`stewards` R-D2d). The line is never published: no field of `site` R4's row, of the listed-groups register's public output, of any status or of any answer to a visitor carries it. The act carries the outward-act warning that the people the group examines will see what it is watching (DEC-132 (3)). A group that keeps itself to its members answers `{listed: false}` and fields none, `contact` included. The prefilled request's words (setup-words key `listing.contact.note`) say, in plain words, that the line is for the stewards' reply by mail, is optional, and is never shown on the site; the group that gives none is told nothing and nothing about it is public. Test: a group with a public focus answers the four fields and `contact` as an empty string; a members-only group answers `{listed: false}` with no field and no `contact`; a sentinel in a member's account email appears nowhere in the answer; no network call is made and nothing is recorded (a table-count check before and after); the words key `listing.contact.note` resolves and names the stewards' own mail and "never on the site"; the site's row for a fixture listed group (`site` R4) built after a request with a contact sentinel holds no sentinel (that half is the `stewards` and `site` side, a control here). Control: `directorySubmission` (R23) answers as before; a request without a contact line is complete.

## Private

### Uses
- `record-grammar`: canonical JSON, `createSha256`, the non-member author set (R8) and the id grammar.
- `signatures`: `verifySshsig` (its R2), `timestampRequest` (its R15), `parseTimestampResponse` (its R17), `TSA_ENDPOINTS`, `TSA_CONTENT_TYPE` and `TSA_ACCEPT` (its R20, R21); and the new `NS_NOTICE` and `noticeStatement` (its R37, R38).
- `record-core`: `transact`; `listBundles({project})` (its R35); the history and manifest reads (its R15, R16, R42), for R8 and the creation date; `mintOpaqueId` (its R6), for notice ids; `recordOpaqueId` (its R75), for R4; `stampInstant` and `instantOrder` (its R47, R48); `declarePurge` (its R21); `registerCounts` (its R63).
- `membership`: `isProjectOwner` (its R54), `projectOwners` (its R65), `sight` (its R44), `noSuchProject` and `existenceAct` (its R77, for R1 and R22).
- `credentials`: `attestingKeys` (its R11) and `signerList` (its R8, with `status_at`, its R21, for R21).
- `promotion`: the `producingGroup` fact (its R40, registered by `instance-setup` R1).
- `host-governor`: `governedFetch`, for the timestamp authorities.
- `attestation`: `instanceStatement`, `instanceSign` and `instanceKeys` (its R5), which use the instance key of its R4, and `instanceKeyBound` (its R6, for R1); `provenance` R56, R34 and R57 before N512's split.
- `capture`: the doorbell's public path (its R32).
- `publication`: `cases` and `published_cases` under its R40; `publishedEditionsOf` (its R37) and `caseCitedParts` (its R41).
- `public-read`: the new public-read registration (its R18).
- `project-stage`: `projectStage` (its R1, R2), for `closed` and its date.
- `docket` (N520): `docketSigners` (its R5), the keys that signed a public docket entry, for R21.
- `member-roster` (T53; N1110, K5530 B2): `isAdministrator` (its R23) and `groupDescription` (its R44–R45), for R32. A new `modules.json` edge, BOB's; `member-roster` is layer 2, earlier.

### Invariants
- **R24** Only an owner's own signature publishes a revision. No machine, AI run or administrator can post, re-word or back-date a revision for a project they do not own. An attestation states only facts the copy computes (R12).
- **R25** No answer of this module names a member, save membership's own refusal it relays unchanged (R1, R22; its R77, which at a hidden project's `existence` names the owners, D54; K2529). There are no names in revisions, attestations, keys, leaves or openings.
- **R26** A published revision, attestation or opening is never altered or deleted. Only a whole-store purge clears this module's tables. A bundle purge leaves a published notice standing.
- **R27** In every revision, `since` is never earlier than the project's creation and never later than the day the revision was signed.
- **R28** The assistant's work never counts toward activity, and volume never moves the level.
- **R29** No place is named in this module's behaviour or outward text (`layers.md`, "No jurisdiction in the product").
- **R30** This module makes no outbound call except to the timestamp authorities, and it pushes nothing to any network page or list (T53, K5507).

### Satisfies
- `docs/architecture/BIO_Publication_v0_1.md`:
  - §5B, the Civicsmith half: only from a project and only by its owner; what a notice carries; the activity level; proof of activity; signing at the group's own address; ending; the honest limit;
  - §3 rule 10, the credential-free public read;
  - §5, an owner signs in the browser (DEC-80);
  - §7, the slug as the group's public identity.
- `docs/architecture/BIO_Complete_Roadmap_v5.md` §11, "Inter-group awareness".
- `docs/architecture/BIO_Design_Requirements_v2.md`, requirements 9 and 10.
- `docs/development/NOTIFICATIONS.md`: the item contract (`machinery-producers` R5, was `queue-producers` R27; K1850).
- DEC-111; DEC-49 (catalogue rows); DEC-80; K1019; K1031.
- (T53; K5507) `docs/architecture/BIO_Publication_v0_1.md` §5B (the network pages, held by the holder of the domains outside Civicsmith) and §5E (the directory of groups, the approved listing rule, DEC-255, DEC-270); DEC-132 (3), DEC-247 (the outward-act warning, principle 4.5).

### Suggestions
- **Tables:** `notices`, `notice_revisions`, `notice_attestations`, `week_seals` (with the leaves and salts held privately), `week_roots` (with the token) and `seal_openings`. Each is declared to purge, whole store only (R26).
- **Two-step signing:** the pattern of case ratification, which is prepare, sign in the browser, then post.
- **Weeks before T23 ships cannot be proven.** A notice's `seals` begin at the first sealed week, so early attestations show fewer timestamped weeks than counted ones. That is honest, and needs nothing more.
- **The ceremony's words.** The sentence on "What becomes permanent" (K1031 (3)), the warning and the caution (R2), the five levels, "Others welcome", the stop-and-handoff form, and the links out after publication (R23) are the UX design stream's. They are cited here, never decided.
- **Tests:**
  - each R1 and R4 refusal, with a negative control;
  - a back-dated `since` and a future `since`;
  - the cut-offs at 0/1, 3/4, 6/7 and 9/10;
  - a week with only AI work, which counts zero;
  - a lapse, and a lapse avoided by a revision;
  - a `monthly` attestation missed with no key;
  - a Merkle opening that verifies, and a tampered leaf that fails;
  - the caution at two open notices with no published work, posting anyway;
  - no member id in any public answer, checked over every answer.

- **R31** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `noticeprepare`, `noticepost`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).
