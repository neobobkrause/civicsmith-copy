# Publication lane: what the code holds today (tranche 705f8823)

A worker for the `publication` design lane (session_018BhcecVeBq3c6BYSyTV3Ph) wrote this research note. It reads only. Every cite is `path:line` at tranche `705f8823d124a6c134cf5af3aa5aa297c8da18c4`, in a scratch clone.

**Tests.** I did not run the module suites. Every bio-plane test imports `src/setup-words/index.mjs`, which imports the generated `src/setup-words/rows.mjs`. That file is not committed: process/config.json:89-101 lists it as `generated`. A test run on `test/m/signatures/` failed at load with `ERR_MODULE_NOT_FOUND .../setup-words/rows.mjs`, and generating the file would have written into a checkout. Each module's tests directory is listed below so the lane can run them in a built tree.

---

## 1. `docs/development/publication-design/`, and what reads it

**What the folder holds.** At this tranche it holds only `README.md`, 9 lines.

- It says the lane decides design and wording there, and that its design documents are claude.ai artifacts (README.md:3).
- It names the area as ACTIONS-DESIGN's "Publication & action" (K2433). The earlier work is in `docs/development/action-design/` and in `actions-design/` on branch `design/actions` (README.md:5).
- Its research area is `docs/development/publication-design-research/` (README.md:7). That folder does not exist yet at this tranche.

**Every reference in the repository** (grep for `publication-design`, excluding `.git` and `node_modules`):

| Where | What it does |
|---|---|
| process/config.json:38-42 | The `lanes` row: `{"name":"publication","dir":"docs/development/publication-design/","module":"publication-design"}`. |
| DECISIONS.md:29 | BD-2 defines the lane and its area. |
| DECISIONS.md:39-40 | The lane's first ask is "ratification F1's second-signature design over docketStatement", and "Until then, no job takes ratification F1". |
| docs/development/publication-design/README.md:7 | Names the research folder. |

**What does not reference it:**

- There is no `generated` row under it. process/config.json:59-… lists only the ux-substrate words files, setup-words and the newgroup bundle.
- There is no module `publication-design` in build/modules.json (no `"id": "publication-design"`), and no `process/ledger/publication-design.json`. Only `ux-design.json` exists among the design ledgers.
- No build script, bundler (bio-plane/scripts/*), bio-plane source, app or test names the folder.
- The only design-stream path the build does read is the ux lane's words file: `docs/development/ux-substrate/screens/words.json`, read by bio-plane/src/setup-words/build.mjs:19-22.
- The old `action-design` folder appears in product code only in a CSS comment (bio-plane/src/interface-assets/index.mjs:15).

**What the process tool reads** (pinned `.process` at 56f8c932, the tree's submodule pin):

- It reads `lanes[].dir` only to classify pull requests and paths.
- A change confined to one lane's folder is a lane pull request and counts as records (.process/tool/lib/gate.mjs:253-269, :553; .process/tool/lib/util.mjs:401-417).
- A generated output under a lane folder is a gate finding (.process/tool/lib/gate.mjs:259).
- A research folder may never hold a generated path: "research is never what the build reads" (.process/tool/lib/lane.mjs:58-59).

**In plain terms:** the build reads nothing from `docs/development/publication-design/` today. Nothing is generated from it, nothing is bundled from it, and no module's tests read it.

**Where the screens' wording lives.** The words the lane's screens draw are held as keys in the ux lane's words files (for example docs/development/ux-substrate/screens/words-modules.json:11590 `screen.ceremony.permanent`, and words-t47.json:159 `signing.ceremony.who`), each tagged `"module": "screens-publish"`. From today's files, the wording of the publication screens lives in the ux lane's folder, not this lane's (see Open questions, Q8).

---

## 2. The product code the lane shapes

The places come from build/modules.json:

| Module | modules.json line | Paths |
|---|---|---|
| signatures | 13 | |
| publication | 130 | `bio-plane/src/deliverer.mjs`, `bio-plane/src/publication/` |
| publish-schedule | 131 | |
| docket | 132 | |
| public-read | 133 | `src/public-read/`, `src/publication/worker.mjs`, `src/container.mjs`, `src/inband.mjs` |
| ratification | 137 | |
| case-import | 139 | |
| store-assembly | 187 | |
| screens-publish | 204 | |
| screens-public | 205 | |

**How the wording is held.** Plane modules hold their wording as `localize("key", "default English")` and `word("key")`. Screens hold it as `cs.w("key")`, and the English is in the ux words files. Counts per module, as a rough measure of the wording each one owns:

| Module | `localize(` | `word(` | `cs.w(` |
|---|---|---|---|
| publication | 64 | 17 | |
| ratification | 64 | 33 | |
| docket | 11 | 31 | |
| publish-schedule | 17 | 0 | |
| public-read | 35 | 29 | |
| case-import | 67 | 0 | |
| store-assembly | 22 | 15 | |
| screens-publish | | | 354 |
| screens-public | | | 6 |
| sshsig.mjs | 0 | | |

Each plane module states in its own header that its member-facing words are "the UX design stream's" and that it carries a code plus a plain meaning. For example, bio-plane/src/docket/index.mjs:37-39 and bio-plane/src/network-notices/index.mjs:32-33.

### signatures: `bio-plane/src/sshsig.mjs` (793 lines)

Tests are in `bio-plane/test/m/signatures/`: signatures.test.mjs, release-notice.test.mjs and release-signer.test.mjs.

**Entry points:**

- Verify:
  - `verifySshsig(armored, message, expectNamespace, allowedKeys)` (sshsig.mjs:166-206). It never throws (:167-168). Its reasons are `MALFORMED`, `NAMESPACE`, `UNKNOWN_KEY`, `BAD_SIGNATURE` and `CRYPTO_UNAVAILABLE` (:173-205).
  - It accepts only ssh-ed25519 keys, sha512 or sha256, and SSHSIG version 1 (:11-13, :119-149).
  - The embedded key must be in `allowedKeys` after normalisation (:183-185).
- Parse:
  - `parseSshsig` (:119-149).
  - `parsePubkeyLine` (:79-91).
  - `normalizeKey(entry)` (:103-109) accepts a bare base64 key, an `ssh-ed25519 AAAA… comment` line, or an allowed_signers line.
  - `wirePubkey` (:95-97), `bytesToB64` (:45-49), `cat` (:69-75).
- Signing: none. The module "holds public keys … and verifies" (:26-31). Signing happens in the operator's browser (`src/sign-release.html`), in stock `ssh-keygen`, or in `scripts/sign-sshsig.mjs` (133 lines) for releases.
- Statement builders and namespaces: see §3.

**What it writes:** nothing. It is pure and has no storage.

**Wording:** no member-facing words. Its refusal strings are developer-facing, for example `"docketStatement: the case id is not an opaque id"` (:411-415) and `REFUSED [NOTICE_FIELD]` (:521).

**Key lists held here:**

- `RELEASE_KEYS`, frozen: Bob's release key and recovery key (:450-453).
- `CATALOGUE_KEYS` = Bob's two catalogue keys plus one development placeholder line (:590-597).
- There is no member or group key list. Member keys live in `credentials` (§3).

### ratification: `bio-plane/src/ratification/` (9 files, 4,102 lines)

Tests are in `bio-plane/test/m/ratification/` (45 files, for example caseratify-op, sitting, r7-publish-at, scheduled-commit and seals). No ratification test exercises the docket. The word "docket" appears only in g54-entry.mjs, g54-paths.test.mjs and g57-heal.test.mjs, as fixture data.

**What it is.** Header, index.mjs:1-7: "Publication takes two signatures: an owner signs the case document (`op=caseratify`), and each finding and the evidence it rests on crosses by its own signature (`op=ratify`)." It "authors nothing and owns no table" and commits through `publication`.

**Ops** (`ratificationOps`, index.mjs:1717): `gatefacts`, `casegate`, `caseratify`, `publishat`, `casetestimony`, `caseapproval`, `publish`, `release`, `retire`.

**The Worker half (`ops.mjs`):**

- `caseRatifyOp` and `publishAtOp` are both `caseCeremony` (ops.mjs:57, :63, :65).
- The body is `{caseId, edition, expectedSha, sig, members?, at?}` (:89-111).
- The signature is checked by `verifySshsig(body.sig, caseRatifyStatement(case, edition, doc_sha), NS_RATIFY, facts.signers…)` (:181-189).
- Each sitting member is weighed against the same verified key, `{keys:[sv.keyB64]}` (:212-218).
- `ratifyOp` (:382) is the single-finding act, verified in `weighFinding` (:593-611).

**The store half (`index.mjs`):**

- `ratifyCaseDocument` (:1151) commits through `publication.commitCaseEdition`.
- `caseRatifyPreflight` (:593).
- `publishScheduled(entry, now)` (:941-1000+), the "Publish at…" publisher. It re-verifies the waiting signature against the signers active at publish time (:958-965).
- `#heldMember` (:1438-1466).
- `caseFileSweep` (:881), `release` (:1633), `retire` (:1647).
- After the commit, `#openSeals` is called through `record.afterCommit` (:1402, :1468-1475). This is the existing pattern R37 uses for post-commit work, the one F1 says to copy.

**Data it writes:** none of its own tables. It writes through `publication`'s tables (`cases`, `case_documents`, `published_cases`, `published_case_members`, `published_bundles`) and `case_conclusions` (header, index.mjs:9-12).

**Wording** (examples, with the defaults inline):

- `CASE_UNSIGNED`'s detail: "…committed from BYTES A MEMBER SIGNED and from nothing else…" (index.mjs:1157-1158).
- `CASE_RATIFY_STALE`: "the case document has changed since it was reviewed; read it again and re-sign" (ops.mjs:154-155).
- `NO_SIGNERS`: "no active registered signing keys; an admin must register a member key before anything can be ratified" (ops.mjs:175-176).
- The `next` sentences: "the case is committed. {length} member finding(s) still to ratify…" (ops.mjs:315-318).

### docket: `bio-plane/src/docket/` (4 files, 1,790 lines)

Tests are in `bio-plane/test/m/docket/` (17 files: place, t45, t53, formats, notice-case-grammar-202 and others). A fixture signs with `NS_DOCKET` at bio-plane/test/m/docket/fixture.mjs:262, :290.

**Entry points** (class `Docket`, index.mjs:214):

- `docketFile` (:489), `docketPressure` (:553).
- `docketPrepare` (:742-832). This is prepare: the canonical-JSON entry, its `digest` and `statement = docketStatement(case, seq, digest)`. It is held in memory for `PREPARED_TTL_MS` = 1 h (:140, :825-831).
- `docketPost` (:835).
- `docketRecordEdition` (:913-982). This is R33, the edition entry (see §3).
- `docketDecline` (:985), `docketInvitation` (:1018), `coreDue` (:1088), `docketOf` (:1136).
- `withdrawalOf`, `courtOrdersOf`, `docketWithdrawals`, `docketContested`, `docketPressureMarks`, `docketEvents` (:1173-1302).
- `docketSigners` (:1343), `docketPublic` (:1353), `docketFeed` (:1390).
- Ops map `docketOps` (:1443-1462): `docketfile`, `docketpressure`, `docket`, `docketprepare`, `docketpost`, `docketdecline`, `docketinvitation`. There is **no op for `docketRecordEdition`**. It is in-plane only, and wrapped by `withRow` at :1404-1407.

**Data it writes:**

- Tables `docket_record`, `docket_marks` and `docket_entries` (schema.mjs:13, :33, :46).
- `docket_entries.signature TEXT NOT NULL` and `signer_key TEXT NOT NULL` (schema.mjs:56-57). An unsigned public entry cannot be stored.
- An entry's JSON is `{format:"civicsmith-docket-entry/1", group, case, seq, previous, shelf, kind, edition, date, …}` (:74-80, :797-799, :937-938). `previous` chains each entry to the digest of the one before it, and `date` is the UTC day of preparation.

**Wording:**

- `OUTWARD_ACT_WARNING` is held as a code plus meaning `word("docket.public_see_entry")` (:148-151).
- `RESEND_INVITATION` (:154-157), `RECEIPT_REASON` (:144), `DOCKET_UNREADABLE` (:146).
- Refusal sentences, for example "only an owner of the case's project signs its public docket" (:968).

### publication: `bio-plane/src/publication/` (5 files, 4,883 lines) and `src/deliverer.mjs` (54 lines)

Tests are in `bio-plane/test/m/publication/` (38 files).

**Entry points** (class `Publication`, index.mjs:300):

- `storeCaseDocument` (:546), `commitEdition` (:628), `commitCaseEdition` (:1072).
- `stampEdition` (:1472), docket's court-order hook (R62).
- `caseDocumentFacts` (:1859), `caseDocument` (:2059), `caseEditionState` (:2136), `recordCaseManifest` (:2368), `caseFilesOwed` (:2503), `publishEdges` (:2550).
- Registries `registerOrderSource` (:411) and `registerWaitingEditions` (:434).
- Ops (`publicationOps`, :3009): `recordcasemanifest`, `recordcasefile`, `publishedtargets`, `excludedby`, `casedocfacts`, `casedocument`, `publishedcasedoctext`.

**How the statement to sign is handed out.** The `casedocument` door hands the member the statement as `sign: {namespace: NS_RATIFY, statement: caseRatifyStatement(case, edition, doc_sha)}` (door.mjs:101-108). The public verifier half (`publication/worker.mjs`, a public-read path) states the same statement for a reader at worker.mjs:344-346, and `ratifyStatement` at :435-436.

**Data it writes.** Tables at schema.mjs:80-496: `published_bundles`, `published_shas`, `published_edges`, `published_held_references`, `published_cases`, `published_case_members`, `cases`, `case_documents`, `case_exclusions`, `edition_stamps` and `case_photo_places`.

- In `published_bundles`, `sig_armored` and `attestor_key` are NOT NULL (:86-90).
- In `case_documents`, `sig_armored` and `attestor_key` are NULL until `op=caseratify` (:431-432).

**Wording:** 64 `localize` and 17 `word` calls. Example: "a court order this team complied with keeps these contents from being served here…" (worker.mjs:135).

### publish-schedule: `bio-plane/src/publish-schedule/` (4 files, 682 lines)

Tests are in `bio-plane/test/m/publish-schedule/` (10 files).

**Entry points:**

- `PublishSchedule` (index.mjs:47): `scheduleEdition`, `publishWake`, `publishDue`, `publishAtMove`, `publishAtCancel`, `scheduledEditions`, `waitingEditionOf`, `signerOf` and others (:108-126).
- `registerScheduledPublisher` (:80); ratification registers itself as the publisher (ratification index.mjs:18-20).
- Ops: `publishatmove`, `publishatcancel`, `publishschedule` (:164).

**Data it writes:** table `scheduled_editions`: `doc_sha`, `sig_armored NOT NULL`, `signer`, `delivered_by`, `signed_at`, `at_date`, `at_time`, `zone`, `publish_at`, `state ∈ {waiting, published, stopped, cancelled}`, `checked`… (schema.mjs:21-40). It holds the case signature only, with no docket signature.

**Wording:** 17 `localize` calls.

### public-read: `bio-plane/src/public-read/` (9 files, 3,130 lines)

Tests are in `bio-plane/test/m/public-read/` (64 files).

**Entry points:**

- `PublicRead` (index.mjs:317): `publicRead` (:505), `docketPublic` (:536) and `docketFeed` (:547), which serve docket's public reads; `publishedManifest` (:631), `verifySha` (:789), `publishedList` (:836), `publishedEditions` (:881), `publishedFrozen` (:970), `publishedCase` (:1068), `publishedCaseWithCorrections` (:1512), `caseFileFacts` (:1565), `withheldOf` (:1903).
- Ops: `publishededitions`, `publishedfrozen`, `publishedcase`, `publishedmanifest`, `verify`, `publishedlist`, `publicread`, `docketpublic`, `docketfeed`, `casefilefacts`, `withheld` (:2174).

**What it writes:** nothing of its own that matters here. It reads publication and docket.

**Wording:** the lens sentences (index.mjs:118-120, :191) and others. It has 35 `localize` and 29 `word` calls.

### screens-publish: `bio-plane/src/screens-publish/` (15 files, 3,863 lines)

Tests are in `bio-plane/test/m/screens-publish/` (34 files; public.test.mjs:179 covers "Post it, signed").

**Ceremony** (`ceremony.mjs`):

- The Sign step draws `screen.ceremony.permanent`, `signing.ceremony.who` and "what this signs exactly" (`screen.ceremony.signs.exactly`, listing `screen.ceremony.signs.<kind>`) (:404-424).
- The two acts are `caseratify` (:614-645) and `publishat` (:647-676). Each signs, in one sitting, `P.sitting(doc, prepared)`: the case statement in `bio-ratify`, plus one `bio-ratify` statement per finding and per piece of evidence (parts.mjs:481-505), through `P.sitSign`, which calls `cs.signer.sign` (parts.mjs:557-561).
- The signer kit takes a list of `{label, bytes, namespace}`, with a namespace per item. The capture account is signed this way at ceremony.mjs:542.

**Docket** (`docket.mjs`):

- It lists entries, offering prepare-and-post only for a record entry proposed public and not yet posted (:39-47).
- "Post it, signed" (`docketpost`) re-prepares the entry if its hour has passed, signs `pr.statement` in `"bio-docket"` through `cs.signer.sign`, and posts `{digest, signature, acknowledged:true}` (:186-210).
- There is no control for a core-due edition entry.

**Docket, public view** (`docket-public.mjs:1-5`): it draws posted entries with no credential and does not show signatures.

**Wording:** 354 `cs.w` keys, with the English in docs/development/ux-substrate/screens/words-*.json. Examples:

- `screen.ceremony.permanent`: "Publishing makes this edition permanent and public. It can be corrected by a new edition, never removed." (words-modules.json:11590-11593, protected)
- `signing.ceremony.who`: "You sign as {signer}, an owner of {project}. The public page will read “Published by {group} · signed by {signer}”. …" (words-t47.json:159-161, protected)
- `screen.docket.posted.said`: "Posted, signed." (words-modules.json:12280-12281)
- `screen.ceremony.signs.case`: "the edition of {id}" (words-modules.json:11926)

### screens-public: `bio-plane/src/screens-public/index.mjs` (84 lines)

Tests are in `bio-plane/test/m/screens-public/` (4 files).

**Entry points:**

- Parts `ungradedStatement` (:20), `evidenceList` (:40) and `signatureShown` (:67-77).
- `signatureShown` draws `screen.published.verify.detail` together with the edition's `sig_armored` and `attestor.key_b64`, and draws neither when one of the two is missing.
- `PART_KEYS` (:80-84).

**Wording:** 6 keys. The module says "no member-facing English here" (:9-10).

### case-import: docket and signature parts (`bio-plane/src/case-import/`, 4 files, 2,783 lines)

Tests are in `bio-plane/test/m/case-import/` (26 files; watch.test.mjs and notice-docket-266.test.mjs sign `docketStatement` in `NS_DOCKET`).

**Entry points:** `watchImport` (:1733), `unwatchImport` (:1760), `watchedImports` (:1779) and `recordDocketRead` (:1880).

**How it checks another group's docket** (:1815-1870), in three checks:

1. **Digest and form.**
2. **Signature.** The verifier tries the keys the held manifests list first (`#listedKeys`). If the answer is `UNKNOWN_KEY`, it re-verifies against the embedded key and records `key_listed:false` (:1849-1859).
3. **Chain.** `previous` is the digest of `seq-1`.

**Data it writes:** `case_import_watches`, `case_import_docket_reads`, `case_import_docket_entries`, `case_import_edition_keys` and others (schema.mjs:20-256).

**Wording:** 67 `localize` calls. Example: "the signature does not verify over the entry's statement ({reason})" (:1859).

### store-assembly: docket and signature parts (`bio-plane/src/store-assembly/`, 16 files, 3,885 lines)

Tests are in `bio-plane/test/m/store-assembly/` (93 files; docket.test.mjs and watch.test.mjs sign `docketStatement` at watch.test.mjs:19, :33).

**How it composes these modules:**

- docket is built right after publication and handed to public-read and network-notices (assemble.mjs:372-382).
- ratification is composed at :388-394, with **no docket dependency**.
- Tables are migrated in module order (:758-760).
- Op maps are spread, among them `ratificationOps`, `publishScheduleOps` and `docketOps` (:870, :885-887).
- Declared ops: docket's `DECLARED_OPS` (declarations.mjs:56, :153).

**What it writes:** nothing of its own here.

---

## 3. The signature model as built

### Namespaces and statement builders

`sshsig.mjs` holds nine namespaces. The comment at :568 says "Nine namespaces in all (R1)"; `ai-gate/src/params.mjs:19` adds a tenth, `NS_GATE_SUITE = "bio-gate-suite"`.

| Namespace | Value | Builder (bytes signed) | Who signs | Verified where, against what keys |
|---|---|---|---|---|
| `NS_RELEASE` | `bio-release` (:211) | the release **asset bytes** themselves (:214-215) | Bob's release key, offline | installer and plane against `RELEASE_KEYS` (:450-453) |
| `NS_RATIFY` | `bio-ratify` (:212) | `ratifyStatement(bundleId, sha)` = `bio-ratify <id> <sha>\n` (:216-217) | a member, in the browser, per finding and evidence | ratification ops.mjs:611 and index.mjs:1451, against `credentials.attestingKeys()` or the one key the case verified against |
| ″ | ″ | `caseRatifyStatement(caseId, edition, docSha)` = `bio-ratify-case <case> <ed> <sha>\n` (:344-345); same namespace, the message's leading token keeps it apart (:340-343) | an **owner** of the project (`membership.caseAuthority`, membership/index.mjs:677-688) | ops.mjs:181-183; index.mjs:963 (publish-at, against the signers active at publish time) |
| ″ | ″ | `captureAccountStatement(sha, text)` = `bio-capture-account <sha>\n<text>` (:434-438) | the capturing member | capture and the standalone case checker |
| `NS_FLEET` | `bio-release-fleet` (:225) | `fleetStatement({version, plane, members})`, `/2` (:302-321) | release key | newgroup installer |
| `NS_NOTICE` | `bio-working-on` (:355) | `noticeStatement(id, rev, sha)` (:384-392) | project owner, in the browser | network-notices. The copy also countersigns with its **instance key** (network-notices/index.mjs:4-8) |
| `NS_DOCKET` | `bio-docket` (:402) | `docketStatement(caseId, seq, sha)` = `bio-docket <case> <seq> <sha>\n`; refuses a non-opaque id, a seq below 1, or a sha that is not 64-hex (:409-417) | the case's **manager** (= a project owner, docket index.mjs:298) | docket index.mjs:860 (`docketPost`), :968 (`docketRecordEdition`), against `attestingKeys()` filtered to `member_id === by`; importers at case-import index.mjs:1851-1855 |
| `NS_RELEASE_NOTICE` | `bio-release-notice` (:463) | `releaseNoticeStatement` (:518-523), verified by `verifyReleaseNotice` (:546-560) | release key | plane, against `RELEASE_KEYS` |
| `NS_AI_CATALOGUE` / `NS_AI_ADVISORY` | :569-570 | `aiCatalogueStatement`, `aiAdvisoryStatement`, `aiSealKeyStatement` (:666-680) | Bob's catalogue keys, or a development key | `verifyAi*` (:703-721) against `BOB_CATALOGUE_KEYS` by default |
| `NS_AI_RUN` | `bio-ai-run` (:571) | `runBundleStatement` (:774-778) | a test container's run key | `verifyRunBundle` (:782-793) |

**One non-SSHSIG signer.** `attestation`'s **instance key** is a raw Ed25519 PKCS#8 secret per instance, replaceable by the operator, with every public key it ever used kept in `receipt_keys`.

- It signs `instanceStatement(kind, sha)` = `<kind>\nsha256: <sha>\n` (attestation/index.mjs:219-224, :384-427).
- It is used for archive receipts (R4) and for network-notices' countersignatures (R5).
- `instanceKeyBound()` (:432-434) tells a caller whether a key is bound.

### Who signs, how many signatures, how keys are found and rotated

**Member keys:**

- Members register ssh-ed25519 keys made in the browser, or load a key file. These are the `credentials` `signers` rows.
- `credentials.attestingKeys()` is "the ONE predicate" for which keys attest (credentials R11, build/requirements/credentials.md:31; ratification index.mjs:481).
- Revoking a member revokes her keys inside the revoking act (credentials/index.mjs:160-202). Only an administrator re-activates a key (:908-914).
- There is no group key and no plane-held SSHSIG key.

**The case ceremony, one sitting.** It produces 1 + N signatures, all from one member key and all in `bio-ratify`:

- the case statement, plus one per finding and per piece of evidence (screens-publish parts.mjs:481-505; ops.mjs:207-218 checks every member against `sv.keyB64`, the key the case signature verified against);
- the signer must be an owner (`caseAuthority`), and the deliverer may be the founder or a joined member (REC-128; ops.mjs:220-223).

**Publish at a set time:**

- The signature is stored in `scheduled_editions.sig_armored`.
- `publishScheduled` re-verifies it at publish time against the signers active then (index.mjs:958-965). A revoked or withdrawn key therefore stops the edition (`SIG_UNKNOWN_KEY`).

**Docket entries:**

- One signature per entry, in `bio-docket`, from the manager's own registered key (docket index.mjs:860, :965-968).
- The signer key is stored per entry (`signer_key`).
- `docketSigners()` lists every key that has signed a public entry (:1343-1348), and network-notices serves it as part of the group's public keys (R21, network-notices/index.mjs:28).

**Importers (key rotation as other groups see it).** An entry signed by a key that no held manifest lists still verifies and is kept with `key_listed:false`. The case-import requirement says why: refusing it "would silently drop a real withdrawal signed by a newer manager's key" (build/requirements/case-import.md:139).

### The second signature over `docketStatement`: what exists, what is stubbed, what is missing

**What exists in docket.** `docketRecordEdition({case, edition, signature?, by?, digest?})` is at bio-plane/src/docket/index.mjs:913-982, written to docket R33 as amended by BOB on 4 Nov (PR 278, option (a)).

- **Without `signature`** it answers `{prepared:true, entry, digest, statement}` and writes nothing (:957-959).
- **With `signature` and `by`:**
  - it refuses `MACHINE_CANNOT_PLACE_DOCKET`, `DOCKET_NOT_THE_MANAGER`, and `DOCKET_STALE` when the given digest is not the entry's now;
  - it verifies `NS_DOCKET` over `docketStatement(case, seq, digest)` against `by`'s keys (:960-969);
  - it inserts in a transaction that re-builds the entry and refuses `DOCKET_STALE` if it moved (:971-980).
- An edition that already has an entry answers `filed:false` at either step (:942, :956).
- It refuses an edition that is not ratified with `DOCKET_NO_EDITION` (:917-920), so **the entry can be prepared only after the edition commits**.
- The entry includes `seq`, `previous` (the digest of the last entry) and `date: dayOf(at)` (:944-947). Its digest, and so the statement, change if any other entry is filed first or the UTC day turns. Unlike `docketPrepare`, it holds no one-hour prepared copy.

**Tests of that code.** docketRecordEdition is exercised by:

- test/m/docket/notice-case-grammar-202.test.mjs:39;
- test/m/network-notices/notice-docket-278.test.mjs:24-26 (prepare, then sign as "erin" in `NS_DOCKET`, then file);
- the case-import control test/m/case-import/notice-docket-266.test.mjs:51-63, where an unsigned edition entry is refused at check 2 and a signed one is a move.

**What is missing in ratification** (the debt F1 names):

- Nothing in bio-plane/src calls `docketRecordEdition`. Its only matches are docket/index.mjs:913 and :1404.
- ratification imports no docket module: its imports are at ratification/index.mjs:48-87, and `ratifyCaseDocument` calls only `#openSeals` after its commit (:1402).
- ratification's `uses` list has no `docket` (build/modules.json:137; process/ledger/ratification.json `uses`).
- The composition does not give ratification a docket (store-assembly/assemble.mjs:388-394).
- There is no op through which a browser could send a docket signature for an edition. `docketOps` has no `docketrecordedition` (docket index.mjs:1443-1462), and `caseratify` and `publishat` take only `sig` and `members` (ratification ops.mjs:89-111).
- `scheduled_editions` has no column for a second signature (publish-schedule/schema.mjs:21-40).
- The ceremony screen signs only `bio-ratify` statements (screens-publish parts.mjs:481-505).
- The docket screen offers no way to place a core-due edition entry. It only prepares record entries (screens-publish/docket.mjs:39-47), although `docketPrepare` accepts `kind:"edition"` (docket index.mjs:113-121, :817-822).

**What is stubbed:** nothing. There is no placeholder signature, and `signature` is NOT NULL in `docket_entries`. The case-import test comment says R33 "as built at the notice … stores the entry with an empty signature" (test/m/case-import/notice-docket-266.test.mjs:1-3), but that describes the code before PR 278. Today an unsigned edition entry cannot be filed.

**What a second signature would have to cover.** These are constraints the code sets on any design, not a design:

- **(a) Timing.** The `bio-docket` statement can only be built after the case commit (`DOCKET_NO_EDITION`). In today's code, a single browser sitting that signs both before the commit cannot produce it. A second round after the commit, or a change to how docket builds the entry, would be needed.
- **(b) Publish at a set time.** `publishScheduled` commits with no person present (ratification index.mjs:941-1000). The entry's `seq`, `previous` and `date` are known only at that moment, so a signature gathered at signing time would not match unless the docket stood still and the date were fixed in advance.
- **(c) Who signs.** The signer must be a project owner for both acts: `caseAuthority` (membership/index.mjs:688) and docket's `#isManager` (docket index.mjs:298) use the same `isProjectOwner`. But the session that delivers the case may be a non-owner's (REC-128). Only the signer, never the deliverer, can be the `by` that `docketRecordEdition` checks.
- **(d) The other paths that complete an edition.** R42's publisher and R57's sweep (ratification.md:30, :106) have no member present either.
- **(e) The instance key.** The instance key exists (attestation R4, R5) and already countersigns notices. But docket R24, and the R18 check importers apply, require an SSHSIG in `bio-docket` that verifies over `docketStatement`. The instance key is raw Ed25519 over a different statement shape, so using it would change docket R24 and case-import R18.

---

## 4. Gaps between code and requirements

1. **ratification F1 is not met.**
   - Requirement, build/requirements/ratification.md:220: "After an edition's commit, R3, call docketRecordEdition for it, outside the commit's transaction as R37 does for openSeals, with a test …".
   - Code: no call (see §3); ratification/index.mjs:1402 does only R37.
   - The same gap shows in docket R33's sentence "The ratifying module carrying the signature is `ratification`'s, through the provider notice this change raises" (build/requirements/docket.md:136). ratification's Uses (ratification.md) and modules.json:137 do not list `docket`.
2. **F1's wording leaves out the signature.** ratification.md:220 says to "call docketRecordEdition for it" with one test, as if the call files the entry. After PR 278 the call files only with a manager's `bio-docket` signature (docket.md:136; docket/index.mjs:957-969). Without one it answers a prepared entry and files nothing. F1 does not say where that signature comes from. That is the open design DECISIONS.md:39 sends to this lane.
3. **docket's own requirements disagree on edition 1.**
   - R9 (b) lists as due "each ratified edition **above 1** with no `edition` entry" (docket.md:81), and the code matches (docket/index.mjs:1048-1050).
   - R33 says "edition 1 files one without a change text" (docket.md:136), and `docketRecordEdition` does file for edition 1 (:937-938).
   - So nothing marks a missing edition-1 entry as due.
4. **"The plane holds no key of its own".**
   - docket.md:136 and the docket comment at docket/index.mjs:899-900 say this.
   - The plane does hold an instance key (attestation/index.mjs:362-427; R4, R5), which network-notices uses to countersign.
   - What is true is that the plane holds no SSHSIG key and no member key. The sentence should say that if it is the reason given (§3 (e)).
5. **screens-publish R90 depends on F1.** It is not yet met: "After edition 2 is published the public docket lists the edition entry … the owner's docket lists the edition entry" (build/requirements/screens-publish.md:155). No code path files that entry. R16 covers only `docketpost` (screens-publish.md:47).
6. **signatures R1's count is out of date.** It still says "Five … (T48; N1047) Six" (build/requirements/signatures.md:16). R49 and R55 amend R1 to add `NS_AI_*` (:112, :132). The code comment says nine (sshsig.mjs:568), and the `Provides` header (:15) lists five.
7. **screens-public's module row has no code path.** build/modules.json:205 gives `paths: ["build/requirements/screens-public.md"]`, but the code is at `bio-plane/src/screens-public/index.mjs` (84 lines), whose header says it was "split by copy from screens-publish (5 Nov 2026)". As registered, its source belongs to no module.
8. **Several different "F1"s.**
   - The one in DECISIONS.md:39 is ratification.md:220.
   - ratification.md:184 cites a different "F1's rule for digests (K1874; N761…)".
   - publication.md:284, public-read.md:189 and screens-publish.md:198 each have their own F1.
   - The first ask should cite the requirement line, not "F1" alone.
9. **The docket's public screen shows no signatures** (screens-publish/docket-public.mjs:1-5), while the published edition shows its own (screens-public/index.mjs:67-77). docket R24 serves `signature` per entry. Whether a reader is shown it is a wording and design choice; I found no requirement either way.

---

## Open questions and whose call

| # | Question | Whose call |
|---|---|---|
| Q1 | **Who makes the second signature, and when?** The same owner in a second browser round right after the commit (`docketRecordEdition` prepare, then sign `bio-docket`, then file), or one sitting with a changed docket that can prepare before the commit? | **Lane** for the ceremony's flow and words. **Bob or BOB** if docket R33/R24 must change: a changed entry shape or a pre-commit prepare touches a public format importers verify (case-import R18). |
| Q2 | **Publish at a set time, R42's publisher and R57's sweep.** No one is present at commit, so the entry's `seq`, `previous` and `date` cannot be signed in advance. Options: leave the edition entry as a core-due item (R9 (b)) for the owner to post later from the docket; pre-sign with a fixed date and fail closed if the docket moved; or something else. | **Lane** for the owner's experience. **Bob** if a published edition may stand without its docket entry for a while, since that reads against K5559's "recorded automatically". |
| Q3 | **Is a signature over the docket entry by the instance key acceptable?** It would avoid a second member signature, but it reverses BOB's PR 278 option (a) and changes docket R24 and case-import R18, a public format other groups verify. | **Bob's.** It is a trust-model and public-format change. |
| Q4 | **What happens on failure?** If the docket signing is declined or fails after the case commits, the edition is public with no docket entry. Should that be stated in the act's answer, the way R37 states a failed opening of seals, and the item stay on `coreDue`? | **Lane** (answer and words), within F1's "outside the commit's transaction". |
| Q5 | **Edition 1.** Should edition 1 file an entry (R33) or not (R9 (b))? | **BOB's**, a requirements consistency fix. The lane can recommend. |
| Q6 | **The deliverer.** A non-owner may deliver a case an owner signed (REC-128). The docket signature must be the signer's, so the flow has to bring the signer back if she is not the one at the screen. | **Lane** (flow). Within existing rules, no new ruling needed. |
| Q7 | **Showing docket signatures to readers.** Should the public docket show each entry's signature and key, as the published edition does (screens-public `signatureShown`)? | **Lane.** |
| Q8 | **Where the lane's wording lives.** The keys for ceremony and docket (`screen.ceremony.*`, `signing.ceremony.*`, `screen.docket.*`) are held in the ux lane's words files (`docs/development/ux-substrate/screens/words-*.json`, tagged `module: screens-publish`), and `setup-words` builds only from there (setup-words/build.mjs:19-22). If this lane decides that wording, how does it reach the build without editing the ux lane's folder? | **Bob or the coordinator** for the boundary between the two lanes. The process allows a lane pull request to touch only its own folder. |
| Q9 | **Which modules F1 touches.** ratification must gain a `uses` edge to `docket` (modules.json:137). The work spans ratification, possibly publish-schedule (a second signature column), screens-publish (the ceremony) and docket (if R33 changes). | **BOB** plans the jobs. **Lane** first rules the design, per DECISIONS.md:39. |
