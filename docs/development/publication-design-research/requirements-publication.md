# Publication-side requirements: modules, marks, and ratification F1

Research for the `publication` design lane (qualifying). Read-only. Tranche `705f8823` (merge of PR 669, the lane's seed). Every cite is `path:line` at that commit, or a requirement id. Anything not stated outright in a file is marked **(inference)**.

Caveat on history: the checkout is a shallow clone (`git rev-parse --is-shallow-repository` = true). Its earliest commit is `47d7bf1d` ("Merge job PR 361", 4 Nov). So `git log -5` shows nothing older than 4 Nov, and the commits that added ratification F1 and the amendment to docket R33 cannot be traced from here (`git log -S` stops at `47d7bf1d`). For older history, the status lines inside each file are the source.

Caveat on "F1": the id names several unrelated things.
- `ratification.md:220` is the F1 the lane's ask means: a debt-inventory found mark (the docket edition entry).
- `ratification.md:184` and `publication.md:149` use "F1" for a security-review item: K1874, no credential in an address (`draft-T35-security-review.md`).
- `publication.md:284`, `public-read.md:189`, `screens-publish.md:198` and `case-checker.md:127` are each module's own found mark F1.

In this file, "F1" alone means `ratification.md:220`.

---

## 1. Per module

Columns: layer, `uses` and ledger state come from `process/ledger/<id>.json`. Module order comes from `build/modules.json`, where a later line may use an earlier one in the same layer. No ledger entry for these modules has a `marks` or `notices` field. The keys are only `id, title, layer, paths, tests, requirements, uses, suite, reading, prior_work, status`. Provider notices appear in `process/metrics/<id>.jsonl` (`notices`, `reopen`).

### publication — the published record and the two commits
- **Purpose.** "Publication is the one irreversible act". It holds every case document and the published projection. The two ceremonies (`ratification`) and preparation (`case-authoring`) write through it (`build/requirements/publication.md:11`).
- **Layer 8.** `build/modules.json:130`, the first of the publication group.
- **Ledger.** COMPLETE 2026-11-05T05:13:45Z, title "restate its test for case-grammar's format /10".
- **Uses.** retrieval, record-grammar, signatures, record-core, membership, promotion, provenance, connections, inquiry, basis-versions, reevaluation, sources, case-grammar, credentials, corpus-export, accepted-work, case-carriage, case-tensions, entities, standards, content, project-roster, setup-words. It does not use docket: "`docket` (T33-64) calls R62; this module does not use it" (`publication.md:196`).
- **Key requirements.**
  - R1 `caseDocument`, fenced for unsigned documents (`:19`).
  - R22 `commitEdition` / `commitCaseEdition`. Each writes inside the caller's transaction and records signature, signer and deliverer. "Neither decides who may publish (that is `ratification`'s)" (`:59`).
  - R24 one way: a correction is a new edition (`:207`).
  - R27 signer and deliverer are two facts (`:210`).
  - R51, R57, R58, R59 are the refusals at commit time: source consent, photo or document copy changed, format before `/6`, accepted work withdrawn (`:82–:111`).
  - R62 `stampEdition`, called by docket R25 inside the court-order post (`:115`).
  - R70 `signed_at` and `published_at` (`:132`).
  - R77 `registerWaitingEditions`, the seam with publish-schedule (`:133`).
  - R73 the review secret is never read from the address (security "F1", `:149`).
  - **R83 retired:** "moved to docket R33 (T53, K5571)" (`:174`).
- **Open marks.**
  - R30 *(not yet met: D-246)*, rendering pixels hash (`:213`).
  - F1 (`:284`): citation R29's "the file says" switch for a photo's time and place. Its commit `5283dfd7` (5 Nov) says it was built.
- **Recent changes.** `5283dfd7` 05 Nov publication F1 (photo-place switch); `6a539d12` 05 Nov "found: … publication F1 …"; `47d7bf1d` 04 Nov.

### ratification — the two signing ceremonies
- **Purpose.** "Publication takes two signatures: an owner signs the case document, and each finding and the evidence it rests on crosses by its own signature (Membership v2 §7)". It commits through `publication` and authors nothing. It also holds publishing at a set time (`ratification.md:11`).
- **Layer 8.** `modules.json:137`, after docket (`:132`), publish-schedule (`:131`), public-read (`:133`) and network-notices (`:135`).
- **Ledger.** COMPLETE 2026-11-05T14:26:51Z, title "answer its provider notice case-catalogue:224".
- **Uses.** record-grammar, signatures, record-core, membership, promotion, provenance, capture, acquisition, retrieval, inquiry, basis-versions, strength, publication, public-read, case-grammar, connections, credentials, inquiry-grammar, contradiction, reevaluation, network-notices, people, local-facts, jurisdictions, money, case-catalogue, case-tensions, publish-schedule, setup-words, test-support.
  - **docket is not in uses** (ledger, `modules.json:137`, Uses at `ratification.md:121–153`).
- **Key requirements.**
  - R1 `caseConclusionFor` (`:19`).
  - **R2** `op=caseratify` refusal order. The signature is verified over `caseRatifyStatement(case, edition, docSha)` in `NS_RATIFY` against an active signer (`:23`).
  - **R3** the commit, `ratifyCaseDocument`. `membership.caseAuthority` applies: "an owner signs; the founder or a joined member delivers". An edition waiting in publish-schedule is refused `PUBLISH_AT_ALREADY_SET` (`:24`).
  - R4 and R5 the finding ceremony over `ratifyStatement(id, sha)` (`:28–29`).
  - R6 case-file assembly after the commit; a copy that fails never fails the act (`:30`).
  - R18 pre-flight, which includes `NO_ATTESTING_KEY` and `CASE_SIGNER_NOT_AN_OWNER` (`:36`).
  - **R37** `network-notices.openSeals` is called *outside* the commit's transaction, and a failure there never changes the answer. This is the pattern F1 names (`:40`).
  - R39 materials copy (`:42`).
  - R40–R45, R48: `op=publishat`, `checked`, the scheduled publisher, hold reader, invariant (`:57–62`, `:168`).
  - R49 and R50 group approvals (`:66–67`).
  - **R52**: `caseratify` and `publishat` take `members: [{id, sha, signature}]`, which are "the same signer's signatures of the same sitting over `ratifyStatement`" (`:103`).
  - R54 `caseratify` declared op, accepts `caseId, edition, expectedSha, sig, members` (`:216`).
  - R60 concurrency of the act (`:111`).
  - R62 and R63 ungraded-passages statement (`:116–117`).
  - Invariants: R10 "A retry never re-signs" (`:157`); **R12** "Signer and deliverer are two facts" (`:159`); R13 recorded from signed bytes only (`:160`); R19 key predicate (`:163`).
- **Open marks.** **F1** *(not yet met: debt inventory, coordinator 22:55)* (`:220`, quoted in §2). A Uses line also notes `promotion` "*(not declared: that registration not yet provided)*" (`:130`).
- **Notices.** `process/metrics/ratification.jsonl` lists notices strength:176, case-grammar:202, case-catalogue:224 and publication:229. **No docket notice ever reached ratification** (grep of the file).
- **Recent changes.** Only `47d7bf1d` 04 Nov is visible (shallow). The status line's last entries are T51 fix round 7 and T51 FR-56 (`:3`). F1 and R54–R63 are appended after the Old ids section (`:215–220`), so they sit outside the Public section.

### docket — after publication: entries, signing, withdrawal
- **Purpose.** Dated entries beside each case on three shelves. "Any member files to the group's record; only the case's manager places an entry in public, signed with their registered key." It sends nothing, and no entry is ever evidence (`docket.md:11`).
- **Layer 8.** `modules.json:132`, after publication and publish-schedule and before ratification.
- **Ledger.** COMPLETE 2026-11-05T04:40:55Z, title "answer its provider notice case-grammar:202".
- **Uses.** record-grammar, signatures, record-core, membership, credentials, promotion, provenance, attestation, acquisition, entities, inquiry, reevaluation, case-grammar, publication, events, case-tensions, project-roster, setup-words, test-support.
- **Key requirements.**
  - R1 `docketFile` (`:24`).
  - **R4** `docketPrepare`: only the manager. It answers canonical JSON, `digest`, `statement = signatures.docketStatement(case, seq, digest)`, the outward-act warning, and `expires` 60 minutes later. The answer is identical "on the same UTC day" (`:47–57`).
  - **R5** `docketPost`: `DOCKET_STALE` when the prepared answer has expired or the `seq` was taken. The signature is verified "in namespace `NS_DOCKET`, over exactly `statement`, against `credentials.attestingKeys()` … restricted to keys registered to `by`" (`:58`).
  - R6 entry fields, including `previous` (a chain) and `date`. "No member's name … appears in it" (`:59–72`).
  - **R9 (b)**: each ratified edition above 1 with no `edition` entry stays core due (`:81`).
  - R12 withdrawal (`:91`).
  - R14, R15, **R24** public read and feed. "`signature` is the armored SSHSIG made over `signatures.docketStatement(case, seq, digest)` in `NS_DOCKET`" (`:119–129`).
  - R25 court order (`:95`).
  - R32 kinds by role (`:135`).
  - **R33** `docketRecordEdition` with its 4 Nov amendment (`:136`, quoted in §2).
  - Invariant **R18**: "Only a member files and only the manager places, declines or signs; no machine, AI run, operator token or administrator does any of these" (`:162`). R16 one way (`:160`). R20 no outbound call (`:164`).
  - Terms: the manager is "an owner of its owning project (`membership.isProjectOwner`, its R54; DEC-72 clause 5)" (`:17`). Labels and words are "the UX design stream's" (`:20`).
- **Open marks.** No inline mark. The status line still reads "marked not yet met (T47)" (`:3`). R33 is not marked, and the code exists: `bio-plane/src/docket/index.mjs:913` `docketRecordEdition({case, edition, signature, by, digest})`.
- **Notices.**
  - `process/metrics/docket.jsonl`, attempts 2 and 3 on PR 278 (4 Nov), reopened with: "docket R33 as built breaks docket R24: docketRecordEdition … stores the edition entry with signature '' … case-import R18 (check 2) therefore refuses every automatically recorded edition entry … Sign the edition entry docketRecordEdition files exactly as the other public entries are signed".
  - The provider notice docket:278 then went to network-notices (metrics 2026-11-04T22:33Z). docket:266 went to case-import. Neither went to ratification.
- **Recent changes.** `47d7bf1d` only (shallow).

### signatures — statement formats and namespaces (layer 1)
- **Purpose.** Builds and verifies signed and timestamped statements (SSHSIG), including "a bundle ratification or a case ratification". It holds no record, no key and no clock (`signatures.md:9`).
- **Layer 1.** COMPLETE 2026-11-04T10:08:08Z. Uses record-grammar and setup-words.
- **Key requirements.**
  - R1 namespaces are distinct: `NS_RELEASE` "bio-release", `NS_RATIFY` "bio-ratify", `NS_FLEET`, `NS_NOTICE` "bio-working-on", `NS_DOCKET` "bio-docket" (`:15–16`).
  - R2 `verifySshsig`, Ed25519 only, the key must be in `allowedKeys` (`:21`).
  - R5 `ratifyStatement` = `bio-ratify ${bundleId} ${bundleSha}\n` (`:26`).
  - R6 `caseRatifyStatement` = `bio-ratify-case ${caseId} ${edition} ${docSha}\n` (`:29`).
  - R7 the two leading tokens differ (`:30`).
  - **R39** `NS_DOCKET` = "bio-docket"; "The browser signer signs in it" (`:18`).
  - **R40** `docketStatement(caseId, seq, sha)` = `bio-docket ${caseId} ${seq} ${sha}\n`. It throws on a non-opaque id, `seq < 1` or a malformed sha (`:36`).
  - R41 `captureAccountStatement`, signed in `NS_RATIFY` (`:39`).
  - R28 a signature for one namespace or message never verifies for another (`:154`).
  - Satisfies: "§5D ('Who acts, and signing': the manager signs a public docket entry with their registered key; R39, R40; DEC-116)" (`:162`).
- **Open marks.** None inline.
- **Small inconsistency.** R1's count reads "Five", then "(T48) Six" (`:16`). R49 says "R1's count becomes nine with R55" (`:112`). R1's text was never re-counted.
- **Recent changes.** `47d7bf1d` only.

### publish-schedule — "Publish at…", the waiting edition
- **Purpose.** Publishing a signed case edition at a set time (DEC-147). The signature is held beside the document, never on it. At the set time the one publisher, which `ratification` registers, re-runs every check and commits only when nothing changed (`publish-schedule.md:23–25`).
- **Layer 8.** `modules.json:131`.
- **Ledger.** **OPEN** 2026-11-06T14:20:00Z, "confirm its requirements on layer 8 (… no unmet mark)".
- **Uses.** civil-time, local-facts, jurisdictions, record-core, membership, publication, setup-words, test-support.
- **Key requirements.**
  - R1 `scheduleEdition`. It records `{…signature, signer, delivered_by, signed_at, at, publish_at, … checked}` (`:40–56`).
  - **R2** `publishDue` hands each due edition to the registered publisher. A stopped edition is never retried, and "publishing it needs a new signing" (`:58–79`).
  - R3 move or cancel by an owner (`:80–90`).
  - R4 schedule read (`:92–101`).
  - R5 `signed_at` (`:103–109`).
  - R8 seam with publication (`:126–133`).
  - R9 C-122.5 `SCHEDULED_CHECK_UNAVAILABLE` (`:155`).
- **Open marks.** None inline. The status line still says "DRAFT for BOB, 2026-10-09 … Every requirement is not yet met (T41)" (`:3`), which disagrees with the ledger's "no unmet mark".
- **Recent changes.** `47d7bf1d` only.

### public-read — the credential-free published record and the docket's public reads
- **Purpose.** "The published record served to anybody without a credential, and its packaging … It writes nothing" (`public-read.md:11`).
- **Layer 8.** `modules.json:133`. COMPLETE 2026-11-04T16:09:03Z.
- **Uses.** record-grammar, signatures (`verifySshsig`, `NS_RATIFY`, `ratifyStatement`, `caseRatifyStatement`, `:134`), ooxml, case-grammar, publication, **docket** (`withdrawalOf`, `lastEntryOf`, `docketPublic`, `docketFeed`, `:142`), case-carriage, record-core, project-roster, setup-words, test-support, membership.
- **Key requirements.**
  - R3 `publishedCase` (`:21`).
  - **R20** a withdrawal stamp and `docket_last_entry` (`:58`).
  - **R21** serves `op=docketpublic` and `op=docketfeed` (`:59`).
  - R23 the case file carries "the signing keys" (`:65–72`).
  - R29 `signed_at` and `published_at` (`:84`).
  - **R37** "Corrections and orders": counts `edition`, `withdrawal` and `court-order` entries dated after `published_at`. An unreadable docket answers `undetermined: true` (`:24`).
  - R12 signer and deliverer are two facts (`:150`).
- **Open marks.** **F1** *(not yet met: BOB 6 Nov …; PR 607)*: Public / Provides must state `publishedcase`'s `materials: {materials: [rows], attestations}` shape (`:189`).
- **Recent changes.** `920d2ac8` 06 Nov "public-read: found mark F1 …"; `47d7bf1d` 04 Nov.

### screens-publish — the member screens: case editor, ceremony, docket
- **Purpose.** "From a case's draft to its public page …: preparing the case, sharing a review copy, the publication ceremony, the published case page, another group's case imported, the case's docket, and the doorbell's page" (`screens-publish.md:9`).
- **Layer 11.** `modules.json:204`. COMPLETE 2026-11-06T00:08:00Z, "consolidate its requirements file under the cap".
- **Uses.** case-import, interface-assets, interface-shell, setup-words, op-declarations, test-support, doorbell, basis-versions, case-authoring, review, public-read, record-grammar, publication, case-grammar, case-disclosures, answer-envelope, case-inputs, store-request, entities, capture, citation, sources, credentials, wizard-scripts, action-holds. Neither docket nor ratification is listed; both are reached as ops "through the plane" (`:182`).
- **Key requirements.**
  - R3 ceremony steps … Ties, Sign (`:22`).
  - **R8** docket screen: "`docketpost` 'Post it, signed' (signed with her own key, as R5's signing)" (`:33`).
  - **R12** Sign step: "Sign and publish now" (`caseratify`) or "Sign now and publish at <time>" (`publishat`) (`:43`).
  - **R13** "signs in one sitting (`cs.signer.sign`, R41) the case statement (`caseRatifyStatement`) and one `ratifyStatement` per finding … and per piece of evidence". No docket statement is in the sitting (`:44`).
  - R14 waiting or published states (`:45`).
  - R15 `NO_ATTESTING_KEY` and `CASE_SIGNER_NOT_AN_OWNER` (`:46`).
  - **R16** "`docketpost` signs `docketStatement` in `NS_DOCKET` through `cs.signer.sign` within the prepared statement's 60 minutes" (`:47`).
  - R70 preparing and signing are separate steps (`:143`).
  - R72 and R78 key file and device key (`:145`, `:195`).
  - **R88** every docket kind fileable, including the owner's correction, withdrawal and court order (K5558 J5 = A) (`:153`).
  - **R90** a new edition shows on the public docket with what changed (K5559 J6 = A) (`:155`).
  - **R94** "Ask an owner to sign" (`:159`).
- **Open marks.** R82–R85 and R87–R106 are `*(not yet met: T53)*` (`:147–171`), the JOURNEYS block. **R90 depends on ratification F1** **(inference: R90's test, "publish edition 1 then 2 … the public docket … list[s] the edition 2 entry", cannot pass while no ratifying path files the entry)**. F1 (`:198`) is the evidence shape. Commit `1cae0f1f` (6 Nov) built it.
- **Recent changes.** `1cae0f1f` 06 Nov F1; `f9333839` 05 Nov found mark F1; `d72eedae` 05 Nov R86.

### screens-public — the public frame, split from screens-publish by copy
- **Purpose.** Split from screens-publish on 5 Nov to keep its requirements under the cap, "copied from `build/requirements/screens-publish.md` as it stan[ds]" (`screens-public.md:3`). It holds the published page, the doorbell, the public evidence list and the checks.
- **Layer 11.** COMPLETE 2026-11-05T22:12:25Z. Uses screens-publish, setup-words, test-support.
- **Key requirements.** R6 (`:7`), R19 (`:9`), R33 "Corrections and orders" (`:24`), R36 (`:25`), R37 a finding's page (`:26`), R84 ungraded statement (`:40`), R100 evidence list (`:42`), R104 group name at head and foot (`:45`), R76 (`:49`).
- **Open marks.** R101, R102 and R104 are *(not yet met: T53)* (`:43–45`). The same ids are still marked in screens-publish, so one requirement has two homes **(inference: a double-tracking risk until screens-publish drops its copies)**.
- **Recent changes.** `dcc09d18` 05 Nov parts for R84 and R100; `a0b77931` 05 Nov R86; `4a43f667` 05 Nov cap split.

### case-disclosures — what a case discloses before signing
- **Purpose.** "What a case discloses about what it rests on, judged and written before anything is signed". It covers tensions, grades and co-attestation, sources, materials, method, accepted work, grading facts and hunch debt. It holds no table and no op (`case-disclosures.md:10–22`).
- **Layer 8.** `modules.json:140`. COMPLETE 2026-11-05T04:39:56Z. Uses are a long list (ledger), including public-read and case-checker.
- **Key requirements for signing.**
  - **R27** `tieAttestationJudged(signers, …)`: each signing member attests to no undeclared tie. ratification R41 records it in `checked` (`:153`).
  - R6 and R7 materials (`:87`, `:100`).
  - R10 off-the-record attesting member (`:117`).
  - R29 Photos step (`:158`).
  - R46 subject naming (`:186`).
- **Open marks.** R37–R45 *(not yet met: T53)* (`:177–185`): typed passages, register extracts, home address and phone guard, forwarded email.
- **Recent changes.** `47d7bf1d` only.

### case-carriage — what an edition carries at its commit
- **Purpose.** "What a case edition carries at its commit, prepared for `publication`'s commit, which calls it inside its own transaction": held materials, re-reads of sources and accepted work, photo marks, and document copies (`case-carriage.md:9–18`).
- **Layer 8.** **OPEN** 2026-11-06T14:20:00Z, "confirm its requirements on layer 8 (… no unmet mark)". Uses: ledger list.
- **Key requirements.** R1 `holdMaterials` (`:24`), R4 `acceptedWorkLapsed` (`:53`), R5 `sourcesLapsed` (`:59`), R13 `marksLapsed` (`:86`), R19–R21 lapse since an instant (`:71–73`), R9, R11 and R14 photo marks (`:83–87`).
- **Open marks.** None inline.
- **Recent changes.** `47d7bf1d` only.

### case-check — checked and held, unsigned
- **Purpose.** A case run through every check publication makes and held unsigned by choice, so a determination may rest on it (`case-check.md:11`).
- **Layer 8.** The last of the layer (`modules.json:145`). COMPLETE 2026-11-05T23:25:48Z. Uses record-grammar, record-core, membership, publication, case-carriage, case-authoring, setup-words.
- **Key requirements.** R1 `checkAndHold` (`:18`), R2 states held, void, published, none and undetermined (`:28`), R3 (`:42`). R5's words are "the UX stream's" (`:59`).
- **Open marks.** None.
- **Recent changes.** `47d7bf1d` only.

### case-checker — the offline checker of a case file
- **Purpose.** "Anybody can check a published case, and recreate its findings, without a Civicsmith copy". It is a pure function and also a standalone program (`case-checker.md:11`).
- **Layer 8.** `modules.json:138`. COMPLETE 2026-11-05T11:26:31Z. Uses record-grammar, signatures, bundler, content, strength, case-grammar, public-read, promotion, calc-grammar, case-catalogue, answers, setup-words.
- **Key requirements.**
  - **R3** verifies the case signature over `caseRatifyStatement` "in the ratify namespace" and each finding's over `ratifyStatement`, against the embedded key and the keys the case file lists. It verifies member attestation rows over `captureAccountStatement` (`:21`). **It verifies no docket signature.**
  - R13 the standalone program (`:36`).
- **Open marks.** R29–R32 *(not yet met: T53)*, register extracts (`:80–83`). F1–F3 are base-red program tests (`:127–129`); commit `27ed1c48` (5 Nov) says "F1-F3 met".
- **Recent changes.** `27ed1c48` 05 Nov; `b0789fc9` 05 Nov found marks; `25ffbd20` 04 Nov.

### Other modules whose requirements touch signing, docketing or ratifying (cited where read)
- **case-import R18** verifies a watched publisher's docket entries:
  - Check 2: "`signatures.verifySshsig(signature, docketStatement(case, seq, digest), NS_DOCKET, …)` verifies against the key the signature embeds".
  - `key_listed` is true when the key is in any held edition's manifest. An entry signed by an unlisted key is kept, never refused (`build/requirements/case-import.md:139`).
  - Uses `NS_DOCKET` and `docketStatement` (`:185`).
  - This is the reader that broke when docket filed unsigned edition entries (docket metrics, PR 278).
- **membership R56** `caseAuthority`: "unless `deliveredBy` is the founder, delivery needs `projectAuthority(…, "joined")`; then the signer must be an owner of the project, else `CASE_SIGNER_NOT_AN_OWNER`" (`build/requirements/membership.md:130`). R54 `isProjectOwner` (`:128`).
- **credentials R11** `attestingKeys()`, the one predicate (`build/requirements/credentials.md:31`). R9 `signerRegisterOwn`, the browser-held key (`:28`).
- **network-notices.** It consumes docket's `docketSigners()` (docket R5, `docket.md:58`, "for `network-notices` R21"). It received provider notice docket:278 (metrics).
- **Canon.** Publication §5D "Who acts, and signing. … Only the project's manager places an entry in public, signing with their registered key in a short step" (`docs/architecture/BIO_Publication_v0_1.md:370`). §3 rule 11: "case ratification needs one owner's signature, Membership v2 §7"; the exclusion statement's second-person check is "DISCLOSED, never enforced" (`:113`).

---

## 2. Ratification F1, the second signature, docketStatement

### 2.1 F1, exactly (`build/requirements/ratification.md:220`)

> - **F1** *(not yet met: debt inventory, coordinator 22:55)* The case ceremony never records a ratified edition on the docket: docket R33 says the module that ratifies an edition calls docket's docketRecordEdition with the case and the edition once the edition is ratified, filing its edition entry with the what-changed text, and nothing in bio-plane/src calls it. So no edition reaches the docket, and an edition no one recorded stays on coreDue. After an edition's commit, R3, call docketRecordEdition for it, outside the commit's transaction as R37 does for openSeals, with a test that a ratified edition 2 holds its edition entry with the text and a repeated ratify files no second one. Until done it is a known gap for the release notes.

Checked at the tranche: no caller outside docket. `grep docketRecordEdition bio-plane/src` finds only `bio-plane/src/docket/index.mjs:913` and `:1404`. `docketStatement` and `NS_DOCKET` are used only by docket, case-import (`case-import/index.mjs:78,1851–1855`) and a screens-publish comment (`screens-publish/docket.mjs:188`).

### 2.2 docket R33 as it now stands (`build/requirements/docket.md:136`), in two layers

**(a) Original text (T53; Bob K5559, J6 = A; K5571 (2)).**
- "`docketRecordEdition({case, edition})`, in-plane, files the `edition` entry of R9 (b) … edition 1 files one without a change text."
- "The module that ratifies an edition calls it once the edition is ratified (it is a later module, so this module and `publication` call nothing of it)."
- "an edition not ratified is refused with R1's `DOCKET_NO_EDITION`."

**(b) Amendment "(BOB 4 Nov, PR 278, option (a); amends R33, keeping its intent …)".**
- "The entry is signed as every public entry is (R24): **the ratification ceremony also signs it with the manager's registered key, since the plane holds no key of its own.**"
- `docketRecordEdition({case, edition})` "answers the prepared entry … its `digest` and `statement` = `signatures.docketStatement(case, seq, digest)`, writing nothing (as `docketPrepare`)".
- `docketRecordEdition({case, edition, signature, by, digest?})` "files it only after R5's verify (… in `NS_DOCKET` over exactly that statement, against `credentials.attestingKeys()` restricted to keys registered to `by`)".
- Refusals on the filing step: `MACHINE_CANNOT_PLACE_DOCKET`, `DOCKET_NOT_THE_MANAGER`, `DOCKET_STALE`, `DOCKET_SIGNATURE_REFUSED`.
- "**The ratifying module carrying the signature is `ratification`'s, through the provider notice this change raises.**"

This is the "second signature". The case ceremony would make two signatures in two namespaces over two statements:
- the case statement, already made: `caseRatifyStatement` in `NS_RATIFY` (ratification R2, `:23`; signatures R6, `:29`);
- the docket edition entry, new: `docketStatement` in `NS_DOCKET` (signatures R40, `:36`; docket R24, `:127`).

The per-finding `ratifyStatement`s of R52 (`ratification.md:103`) are further signatures of the same sitting.

### 2.3 Who signs what (as the requirements stand)

| Statement | Namespace | Who signs | Verified against | Where |
|---|---|---|---|---|
| `caseRatifyStatement(case, edition, docSha)` = `bio-ratify-case …\n` | `NS_RATIFY` "bio-ratify" | an **owner** of the case's project (`caseAuthority`); the deliverer is the founder or a joined member, a separate fact | "an active signer" (R2); key predicate membership R27, now credentials (R19) | ratification R2, R3, R12; signatures R6; membership R56 |
| `ratifyStatement(id, sha)` per finding and per resting evidence | `NS_RATIFY` | "the same signer … of the same sitting" (R52); for a finding, `caseAuthority` for some pinning project (R5) | as R4 | ratification R4, R5, R52; signatures R5 |
| `captureAccountStatement(sha, text)` | `NS_RATIFY` | the capture's actor | — | signatures R41; capture R69; case-checker R3 |
| `docketStatement(case, seq, digest)` for a manager's public entry | `NS_DOCKET` "bio-docket" | the **manager** = owner of the owning project (`isProjectOwner`) | `attestingKeys()` restricted to keys registered to `by` | docket R4, R5, R18, R24; signatures R39, R40 |
| `docketStatement` for the **edition** entry (R33) | `NS_DOCKET` | "the ratification ceremony also signs it with the manager's registered key" | as R5 | docket R33 (amended) |
| `noticeStatement` | `NS_NOTICE` | — | — | signatures R38 (network-notices) |

**Quorum.** Every row is one signature by one person. No requirement read asks for two people or a threshold. Canon: case ratification "needs one owner's signature" (`BIO_Publication_v0_1.md:113`). "Second signature" therefore means a second statement signed by the same person, not a second person **(inference from docket R33's "the ratification ceremony also signs it", `docket.md:136`)**.

The phrase has two other senses the lane should not mix up with this one:
- ratification's Purpose "Publication takes two signatures": the case document, then each finding (`ratification.md:11`);
- §3 rule 11's "SECOND PERSON" check of the exclusion statement, which is disclosed, not a signature (`BIO_Publication_v0_1.md:113`).

**Signer and manager coincide.** The case signer must be a project owner (membership R56, `membership.md:130`). The docket manager is a project owner (docket Terms, `docket.md:17`). So the person who signs the case can always also sign the docket entry, and no new authority is needed **(inference)**. The deliverer may be the founder (ratification R3, `:24`), and R33's filing refuses a `by` who is no member (`MACHINE_CANNOT_PLACE_DOCKET`). So `by` must be the signer, read from the verified signature (ratification R12, `:159`), never the deliverer **(inference)**.

**Keys.** The key is browser-held and registered by `signerRegisterOwn` (credentials R9, `:28`). The predicate is `attestingKeys()` (credentials R11, `:31`). The browser signer signs in `NS_DOCKET` (signatures R39, `:18`). The plane holds no key (docket R33). The public case file carries "the signing keys" (public-read R23, `:72`), and case-import uses them only to label `key_listed` (`case-import.md:139`).

### 2.4 Cross-module dependencies F1 touches

1. **ratification → docket edge.**
   - ratification's `uses` lacks docket (ledger; `modules.json:137`). docket is earlier in layer 8 (`modules.json:132`), so the edge is legal.
   - It is still a new `modules.json` edge, which the Uses notes elsewhere call "BOB's (P17)" (`publication.md:198–200`) **(inference that F1's job needs that edge granted)**.
2. **docket R33.** The prepare and file contract and its refusals (`docket.md:136`). The code exists (`docket/index.mjs:913–960`). Prepare refuses an unratified edition (`DOCKET_NO_EDITION`, `:917–920`).
3. **signatures R39 and R40**, unchanged (`signatures.md:18`, `:36`).
4. **screens-publish.**
   - R13's one sitting lists only `caseRatifyStatement` and the `ratifyStatement`s (`:44`).
   - R16 docket signing has a 60-minute window (`:47`).
   - R90 expects the edition entry on the public docket (`:155`).
   - Any change to what the Sign step signs is a screens-publish change (layer 11).
5. **ratification R52 and R54.** The `caseratify` payload `{caseId, edition, expectedSha, sig, members}` (`:103`, `:216`) has no field for a docket signature, so the op declaration would change **(inference)**.
6. **publish-schedule R1 and R2, ratification R42.** At a set time the scheduled publisher commits with no member present (`publish-schedule.md:58–75`; `ratification.md:59`).
7. **docket R9 (b).** An unrecorded edition stays on `coreDue` as the manager's to-do (`docket.md:81`). This is the existing fallback.
8. **Readers.**
   - public-read R37 counts `edition` entries for "Corrections and orders" (`public-read.md:24`).
   - case-import R18 verifies them (`case-import.md:139`).
   - screens-public R33 draws them (`screens-public.md:24`).
   - case-checker R3 does not look at the docket (`case-checker.md:21`).

### 2.5 Contradictions and gaps

1. **F1 is worded against R33's pre-amendment text.** F1 says to "call docketRecordEdition for it … filing its edition entry". Under the 4 Nov amendment, a call with only `{case, edition}` "answers the prepared entry … writing nothing". So F1's instruction, done literally, files nothing, and F1's own test ("a ratified edition 2 holds its edition entry") cannot pass without a signature (`ratification.md:220` vs `docket.md:136`; code `docket/index.mjs:949–951` returns `prepared: true` with no signature).
2. **R33 contradicts itself.** Its first half says the ratifier "calls it" and it "files"; the amendment says filing needs a signature. The original control ("an edition no one has recorded stays on `coreDue`") and the new test (an unsigned one "is refused and files nothing") both stand in one paragraph (`docket.md:136`).
3. **Order: one sitting before the commit, or a second step after it.**
   - The Sign step signs everything "in one sitting" before `caseratify` is sent (screens-publish R13, `:44`; ratification R52).
   - But the docket statement covers `seq`, `previous` and `date`, which docket fixes at prepare time. Prepare refuses an edition not yet ratified (`DOCKET_NO_EDITION`, `docket.md:136`; code `:917–920`).
   - So the docket statement cannot be prepared or signed until after the case commit. Either a second signing step follows the commit, or docket R33 must let an edition being ratified be prepared **(inference)**.
4. **Staleness.**
   - A prepared docket answer expires in 60 minutes (R4, `:57`). It is identical only "on the same UTC day", and the entry's `date` is the day of preparation (code `:944`, `dayOf(at)`).
   - Any other public entry posted in between takes the `seq` → `DOCKET_STALE` (R5, `:58`).
   - A signature made across midnight UTC, or after another post, fails **(inference)**.
5. **"Publish at…" has no signer at commit time.**
   - The scheduled publisher runs in the plane at `publish_at` (ratification R42; Suggestions `:192`), and "the plane holds no key of its own" (docket R33).
   - A docket statement signed at signing time would name a `seq`, `previous` and `date` that may be stale days later. Nothing in R40–R48 or publish-schedule R1 holds a docket signature.
   - So for a scheduled edition, either the entry waits on `coreDue` for the manager, or the design changes **(inference)**. No requirement says which.
6. **The notice never reached ratification.**
   - R33 says the obligation reaches ratification "through the provider notice this change raises". Provider notices go to a module's users, and ratification is not a user of docket.
   - docket:278 went to network-notices and docket:266 to case-import (metrics); ratification's metrics list no docket notice.
   - F1 was then raised by the coordinator's debt inventory instead **(inference about the mechanism; the facts are in `process/metrics/*.jsonl`)**.
7. **Failure semantics are unstated.**
   - F1 says "outside the commit's transaction as R37 does". R37 says a failure "never changes the ceremony's answer. It is stated, and retried by the `working-on-attest` consumer" (`ratification.md:40`).
   - F1 names no retrier and no answer field for a failed or unsigned docket filing. The only fallback is `coreDue` (docket R9 (b)) **(gap)**.
8. **The edition 1 entry.** R33 files an entry for edition 1 "without a change text". R9 (b) makes only editions above 1 core. F1's test names edition 2 only, so whether the ceremony must sign for edition 1 is not stated **(gap)**.
9. **Retry and idempotence.** F1 wants "a repeated ratify files no second one". R33 gives `filed: false` for an edition already holding its entry. ratification R10 says "A retry never re-signs" (`:157`). A retried `caseratify` whose first attempt committed but failed to file would need a fresh docket signature, which R10 forbids in spirit **(inference: R10 is about the case signature; the docket signature is a new statement)**.
10. **No requirement verifies the edition entry offline.** case-checker R3 does not touch docket signatures. Only case-import R18 does (`case-import.md:139`).

---

## 3. Requirements naming the lane, `publication-design`, or design owed to the UX stream

- **The lane by name.**
  - No requirements file names `publication-design` or the lane (grep of `build/requirements/` and `process/ledger/`).
  - It is named only in `process/config.json` `lanes` (`{"name": "publication", "dir": "docs/development/publication-design/", "module": "publication-design"}`), `DECISIONS.md:25–31` (BD-2), and `docs/development/publication-design/README.md:1–9`.
  - There is no `build/requirements/publication-design.md` and no ledger entry (unlike `ux-design.md`).
- **Words and design held for the UX or design stream** (the lane may now own them within its area; who owns what is a question, §4):
  - docket: the shelf labels and "every word a member or reader sees (the outward-act warning, the invitation, the stamp), are the UX design stream's, cited here and never decided" (`docket.md:20`). The outward-act warning's words (`:57`). The resend invitation (`:76`).
  - ratification: C-92.10 and C-58.5 translations are "BOB's drafts, which the UX stream may re-word" (`ratification.md:161`); C-58.6–C-58.10 likewise (`:166`). "The surfaces of 'Publish at…' … are the interface's screens, not this module's" (`:192`).
  - publication: C-122 rows (`publication.md:162`, `:216`).
  - public-read: "The public page itself, its line's exact words and the order of line, grades and detail are the UX stream's (K633)" (`public-read.md:161`); the two dates' placement (`:178`); the credit page drawing (`:179`).
  - case-disclosures: C-120 translations (`case-disclosures.md:138`, `:232`, `:240`).
  - case-carriage: `COPY_CLEANED_LABEL` and the photo labels, "the design stream re-words them" (`case-carriage.md:77`, `:85`, `:113`).
  - case-check: state words `case.check.*` (`case-check.md:59`).
  - case-checker: the "intact and consistent, not true" sentence (`case-checker.md:19`, `:49`).
  - screens-publish: `SCREEN_WORDS` "until the design stream keys them" (`:53`); keys from `docs/development/ux-substrate/screens/words-reads.json` (`:77`); "words and design owed" for the import departure screen (R103, `:168`).
  - screens-public: the same `:9`.
- **Decided design by Bob that the lane inherits** (JOURNEYS):
  - K5558 J5 = A: the owner files correction, withdrawal and court order from the docket page (screens-publish R88, `:153`; docket R32, `:135`).
  - K5559 J6 = A: each new edition is recorded on the docket automatically with what changed (docket R33, `:136`; screens-publish R90, `:155`).
  - K5560 J7 = B: an outside reader's acknowledgement is named only if ticked (screens-publish R99, `:164`).
  - DEC-147: "Publish now" / "Publish at…" (ratification `:183`; publish-schedule `:163–170`).

---

## 4. Open questions, and whose call

| # | Question | Whose call | Why |
|---|---|---|---|
| 1 | Is the edition entry signed in the same sitting as the case (one key prompt, so docket must prepare for an edition about to be ratified), or in a second signing step right after the commit? | **Lane** (ceremony design and wording), then BOB for the docket R33 and screens-publish R13 changes | J6 = A (Bob) settles *that* it is recorded and signed. *How* it is signed is interaction design (§2.5 item 3). |
| 2 | For "Publish at…", who signs the edition entry, and when? (a) left on `coreDue` for the manager, (b) a second prompt at publish time, (c) a different statement that does not bind `seq` or `date` | **Bob** if it changes a signed format or J6 = A's "automatically"; otherwise the lane | Option (c) changes signatures R40 or docket R6, a signed public format that case-import R18 verifies. |
| 3 | Re-word F1 to match the amended R33 (sign then file; the `members` and `caseratify` payload gain a docket signature; a new modules.json edge ratification → docket) | **BOB** (requirements and edges); the lane advises | Process ownership of requirements and P17 edges. |
| 4 | What happens on failure? Is a failed or stale docket filing stated in the act's answer, retried (by whom), or left to `coreDue`? Does R10 "a retry never re-signs" also bind the docket signature? | **Lane** for what the member sees; **BOB** for the retry rule | §2.5 items 7 and 9. |
| 5 | Does edition 1 need a signed entry at the ceremony (R33 files one), or only editions above 1 (R9 (b), F1's test)? | **Lane** (proposal), **Bob** if it changes J6 | §2.5 item 8. |
| 6 | Is "second signature" the docket statement (this reading), or does the lane's ask mean a second *person*? | **Bob / coordinator** to confirm the ask | Canon has one owner's signature and a disclosed second-person check (`BIO_Publication_v0_1.md:113`). Nothing in requirements asks for two people. |
| 7 | Which UX-stream wording in this area now belongs to the lane: docket shelf labels, outward-act warning, C-58, C-120 and C-122 translations, public page order? | **Bob / coordinator** (lane boundary between ux and publication) | BD-2 gives the lane its area but not the words still keyed in `ux-substrate`. |
| 8 | Should the offline case checker also verify a case's docket chain and edition entries? | **Lane** (proposal), **Bob** (scope) | §2.5 item 10. |
| 9 | Small consistency fixes: signatures R1's count; publish-schedule's DRAFT status line vs its ledger; R101, R102 and R104 tracked in both screens files | **BOB** | Housekeeping (§1). |
