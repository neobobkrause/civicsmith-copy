# Best practice for publication, ratification and the docket

Research worker for the `publication` design lane (session_018BhcecVeBq3c6BYSyTV3Ph). Read-only. Product cited at commit `705f8823d124a6c134cf5af3aa5aa297c8da18c4` (paths relative to the repo root, `file:line`). All web sources were retrieved on **2026-11-06**. Where I could not read the primary text myself, I mark it **[unverified]**.

Notes on sources: several pages were read through a summarising fetcher, which shortens quotations. Short quoted fragments are as returned. Paraphrases are marked as such.

---

## (a) Signing public statements

### The practice

**SSHSIG and namespaces (domain separation)**
- The SSHSIG blob is `"SSHSIG"`, version 1, public key, namespace, reserved, hash algorithm and signature. What gets signed is `"SSHSIG" | namespace | reserved | hash_alg | H(message)`. Verifiers must reject versions they do not support. The namespace gives the domain in which a signature is to be read, so that a signature made for one domain is not accepted in another ("prevents cross-protocol attacks"). It "MUST NOT be the empty string". The reserved field is for future use, and implementations "should ignore the reserved field if it is not empty". Only `sha256` and `sha512` are allowed. — https://raw.githubusercontent.com/openssh/openssh-portable/master/PROTOCOL.sshsig (retrieved 2026-11-06)
- PROTOCOL.sshsig says nothing about multiple signatures, or about how a verifier decides who signed. Trust comes from outside the format. — same source.
- `ssh-keygen` allowed_signers options: `namespaces=` (a pattern list of the namespaces accepted for this key), `valid-after=` and `valid-before=` (a key's validity window), and `cert-authority`. `-Y verify` takes `-r` (a revocation file, either a KRL or a list of keys) and `-O verify-time=` ("a time to use when validating signatures instead of the current time"). KRLs revoke keys by hash or by contents. — https://man.openbsd.org/ssh-keygen (2026-11-06)
- Git with SSH signing: allowed_signers supports `valid-after` and `valid-before` "since OpenSSH 8.8", and "Git will mark signatures as valid if the signing key was valid at the time of the signature's creation. This allows users to change a signing key without invalidating all previously made signatures." `gpg.ssh.revocationFile`: a key found there "will always be treated as having trust level 'never'". — https://git-scm.com/docs/git-config (2026-11-06). That Git signs in namespace `git` is **[unverified]**: the fetched part of the page did not state it.

**Statement canonicalisation**
- RFC 8785 (JCS): "Cryptographic operations like hashing and signing need the data to be expressed in an invariant format". It sorts properties recursively by UTF-16 code units, writes numbers the ECMAScript way, emits no whitespace, and encodes in UTF-8. — https://www.rfc-editor.org/rfc/rfc8785 (2026-11-06)
- DSSE binds the type to the bytes with a pre-authentication encoding, `PAE(type, body) = "DSSEv1" SP LEN(type) SP type SP LEN(body) SP body`. `payloadType` "uniquely and unambiguously identifies how to interpret payload". — https://github.com/secure-systems-lab/dsse/blob/master/protocol.md (2026-11-06)
- minisign: a *trusted comment* is covered by a global signature, `ed25519(<signature> || <trusted_comment>)`, and is meant for application metadata (for example, versions to prevent downgrade). The *untrusted comment* "can be freely modified". — https://jedisct1.github.io/minisign/ (2026-11-06)

**Co-signatures, countersignatures, threshold approval**
- DSSE multi-signature: one envelope can carry many signatures over the same PAE bytes. It is valid with "at least t of n unique trusted public keys", and the verifier must "Reject if the unique keys in ACCEPTED_KEYS is less than t". — DSSE protocol.md (2026-11-06)
- TUF: a role needs "a threshold of signatures of the role's keys", and a client "MUST NOT count more than one verified SIGNATURE from that KEYID towards the THRESHOLD" (§2.1, §5.3). Signed metadata is hashed over canonical JSON (§4.1). — https://theupdateframework.github.io/specification/latest/ (2026-11-06)
- in-toto: the layout is signed by the project owner's key or keys. Each step's `threshold` is "how many pieces of link metadata must be provided to verify this step". This is meant for steps where "multiple functionaries must perform the operation and report the same results" (§4.3.1). The spec implies that distinct signers are counted, but does not spell out the algorithm. — https://github.com/in-toto/docs/blob/master/in-toto-spec.md (2026-11-06)
- W3C VC Data Integrity 1.0 (a W3C Recommendation, 15 May 2025):
  - A *proof set* "has no order", for example several signatures on a contract.
  - A *proof chain* is ordered, for example "a notary countersigning". The later proof names `previousProof`, all such proofs "MUST also verify", and the later proof covers the earlier ones.
  - `proofPurpose` "acts as a safeguard to prevent the proof from being misused", which is domain separation.
  - `domain` and `challenge` guard against replay. `created` and `expires` are optional.
  — https://www.w3.org/TR/vc-data-integrity/ (2026-11-06)
- Threshold signing that produces one ordinary signature: FROST (RFC 9591, IRTF CFRG, Informational) has an Ed25519 suite whose signatures "can be verified with a verifier that is compliant with [RFC8032]". The output is one signature under a group key. It does not reveal who took part, and FROST treats "metadata protection" as a non-goal. — https://www.rfc-editor.org/rfc/rfc9591 (2026-11-06)
- Sigstore/Rekor records signed metadata in "an immutable, tamper-resistant ledger", with inclusion proofs. Signers can watch the log for their own identities. — https://docs.sigstore.dev/logging/overview/ (2026-11-06)

**Key rotation, revocation and compromise**
- TUF rotation: "an application will sign the new root.json file with both the new and old root keys" (§6.1). The client needs a threshold from both version N and version N+1. "If less than a threshold of Root keys are compromised, the repository should revoke trust on the compromised keys" (§2.1.1). Rollback is refused ("If the version of the new root metadata file is not N+1, discard it"), and so is a freeze (an expiry check). — TUF spec (2026-11-06)
- NIST SP 800-57 Pt 1 Rev 5 defines the *originator-usage period* as "The period of time in the cryptoperiod of a key during which cryptographic protection may be applied to data using that key." — https://csrc.nist.gov/glossary/term/originator_usage_period (2026-11-06). Its detailed guidance on compromise recovery is **[unverified]**: I did not reach the PDF text.
- C2PA 2.2 says that without an RFC 3161 time-stamp, "manifests without time-stamps cease to be valid when the signing credential expires or becomes revoked" (§10.3.2.5.1). A trusted time is what lets a signature outlive a later revocation. — https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html (2026-11-06)

### Where Civicsmith follows

- **Namespace per act.** Each public statement has its own SSHSIG namespace: `bio-docket`, `bio-working-on`, `bio-release-notice` and the AI ones. R1 requires that the namespaces be pairwise distinct. — `build/requirements/signatures.md:16`, `:18`, `:101`; `bio-plane/src/sshsig.mjs:395-402`. The verifier refuses a namespace mismatch. — `bio-plane/src/sshsig.mjs:180-181`; `build/requirements/signatures.md:21-22`.
- **Message-level separation as well.** Each statement has its own leading token, so no two statement kinds can be the same bytes, for example `bio-ratify` against `bio-ratify-case`. — `build/requirements/signatures.md:29-30`, `:36`, `:39`; `bio-plane/src/sshsig.mjs:335-344`. This matches the DSSE/PAE idea of binding a type to the bytes.
- **Fixed, unambiguous statement bytes.**
  - The docket statement is `bio-docket <case> <seq> <sha>\n`. It refuses anything it cannot state exactly. — `bio-plane/src/sshsig.mjs:404-416`; `build/requirements/signatures.md:36`.
  - The entry itself is canonical JSON, and its SHA-256 is what gets signed. — `build/requirements/docket.md:57`.
  - The release notice puts its notes inside the signed bytes, the trusted-comment idea. — `build/requirements/signatures.md:104`.
- **Stock verification.** Signatures are plain SSHSIG Ed25519, which `ssh-keygen -Y verify` accepts. — `build/requirements/signatures.md:86`; `docs/architecture/BIO_Publication_v0_1.md:307-309`.
- **Two-key scheme for releases.** There is a release key plus a recovery key. — `build/requirements/signatures.md:98`. The catalogue keys are a separate list. — `:115`.
- **Revoked keys stay published.** `groupKeysPublic` lists owners' keys with `revoked` and the date the status changed, "so older signatures can still be checked". This is close in spirit to Git's valid-before. — `build/requirements/network-notices.md:134-138`. Members revoke their own keys, and administrators can revoke any key. — `build/requirements/credentials.md:26-29`.
- **Monotonic sequence against replay.** Catalogue and notice verifiers refuse anything not newer (`NOT_NEWER`, a version higher than the one running). This matches TUF's rollback rule. — `build/requirements/signatures.md:107`, `:126`.

### Where it departs or is silent

- **Namespace reuse for ratification.** Case ratification, finding ratification and the capture account all share `bio-ratify`, and the separation is by message token only. The stated reason is that existing signers are already configured for that namespace. — `bio-plane/src/sshsig.mjs:340-343`, `:431-434`. PROTOCOL.sshsig puts domain separation in the namespace. Message tokens are a sound second layer, but they are not the primary one the spec intends.
- **One signer per statement.** `verifySshsig` takes one armored signature. Docket posting checks one manager key, restricted to the keys registered to `by`. — `build/requirements/docket.md:58`. There is no envelope, list or threshold for several signatures over one statement (unlike DSSE, TUF and in-toto).
- **Statements carry no time and no purpose beyond the token.**
  - `docketStatement` binds case, seq and digest. The entry's `date` is inside the signed JSON, but `published_at` is the instance's own clock and is not signed. — `build/requirements/docket.md:58`, `:125-128`.
  - Scheduled publication deliberately leaves the publish time unsigned. — `build/requirements/ratification.md:55`.
  - There is nothing like VC's `expires` or `challenge`. The digest freshness window is `expires` 60 minutes in the prepare step, server-side only. — `build/requirements/docket.md:57`.
- **No trusted time on docket entries.** RFC 3161 timestamps exist in the product (`build/requirements/signatures.md:50-72`), but nothing in `docket.md` asks for one per entry. So a revoked key's "date of revocation" cannot separate entries made before a compromise from backdated ones made after it. This is the gap C2PA's §10.3.2.5.1 describes.
- **No validity windows.** The key list uses `status` and `status_at`. — `build/requirements/credentials.md:27`, `:31`. A verifier that uses `verify-time` or valid-before would need a trusted signing time, which docket entries lack.
- **No compromise procedure beyond revoke-and-replace.** "A lost key is revoked and replaced as keys already are." — `docs/architecture/BIO_Publication_v0_1.md:309`. Nothing says what happens to public entries a compromised key signed. There is no TUF-style signing of the new key by the old one for member keys.

---

## (b) Append-only public logs and dockets

### The practice

**Transparency logs**
- Certificate Transparency (RFC 9162):
  - Leaves are `HASH(0x00||d)` and nodes are `HASH(0x01||…)`. This "domain separation is required to give second preimage resistance" (§2.1.1).
  - A Signed Tree Head carries the timestamp, the tree size and the root hash (§4.9–4.10).
  - Inclusion proofs show that an entry is present. "Merkle consistency proofs prove the append-only property" (§2.1.4).
  - Monitors and auditors check the log, and a failed audit yields "signed proof of the log's misbehavior" (§8.2–8.3).
  - Split views are named as misbehaviour, and gossip is left to research (§11.3).
  - Source: https://www.rfc-editor.org/rfc/rfc9162 (2026-11-06). Its status as an Experimental RFC is **[unverified]** on the page I read.
- C2SP checkpoint and signed note:
  - A checkpoint is a signed note: origin line, tree size, root hash, then optional extension lines. — https://raw.githubusercontent.com/C2SP/C2SP/main/tlog-checkpoint.md (2026-11-06)
  - A signed note can carry many signature lines. Verifiers "MUST accept at least up to 16 signatures" and "MUST ignore signatures from unknown keys". If a known key fails to verify, clients SHOULD reject the note, and they MUST reject it if no known key verifies.
  - Key ID = `SHA-256(name || 0x0A || type || pubkey)[:4]`. URL-like key names are recommended "to avoid accidental collisions".
  - Source: https://github.com/C2SP/C2SP/blob/main/signed-note.md (2026-11-06)
- C2SP witness cosigning:
  - "A cosignature is a statement by a cosigner that it verified the consistency of some Merkle Tree hash." The Ed25519 cosignature message starts with "the fixed string `cosignature/v1`, which provides domain separation" and a `time` line. Cosignatures "MUST be monotonically increasing". — https://github.com/C2SP/C2SP/blob/main/tlog-cosignature.md (2026-11-06; an editor's copy, no version shown)
  - A witness checks consistency against its own saved latest checkpoint. It answers 409 on an old-size mismatch and must persist before replying. The spec defines no k-of-n client policy. — https://raw.githubusercontent.com/C2SP/C2SP/main/tlog-witness.md (2026-11-06)

**Civic dockets**
- US federal civil docket (FRCP 79(a)):
  - The clerk keeps "the civil docket". "Actions must be assigned consecutive file numbers".
  - Papers, process, appearances, orders, verdicts and judgments are "entered chronologically in the docket".
  - Each entry briefly describes the kind of paper and states the substance and date of orders and judgments.
  - Source: https://www.law.cornell.edu/rules/frcp/rule_79 (2026-11-06)
- Corrections in court records:
  - FRCP 60(a): "The court may correct a clerical mistake … whenever one is found in a judgment, order, or other part of the record", and after an appeal is docketed only with the appellate court's leave. — https://www.law.cornell.edu/rules/frcp/rule_60 (2026-11-06)
  - CM/ECF practice (N.D. Cal.): after submitting, "You will have no further opportunity to modify this transaction". The clerk places a "filed in error" notation. The filer e-files a corrected version with "CORRECTION OF DOCKET # [x]" in the entry text. — https://www.cand.uscourts.gov/cases-e-filing/cm-ecf/support-and-troubleshooting/correcting-e-filing-mistakes/ (2026-11-06)
  - Other courts use "Notice of Corrective Entry" and similar events. Their labels vary, and I found no single national event. Per the search summary, these include www.tnwb.uscourts.gov/PDFs/ECF/crrctventrs.pdf **[secondary summary, not opened]**.
- Regulations.gov and EPA dockets:
  - "Docket IDs have five parts: AGENCY-LOCATION-OFFICE-YEAR-DOCKET NUMBER", and document IDs add a sixth part.
  - "A docket is a collection of documents made available by an agency for public viewing."
  - Internal, pre-decisional material is excluded.
  - Source: https://epa.gov/dockets/about-epa-dockets (2026-11-06). That comments are reviewed before posting rests on agency pages in a search summary **[unverified at primary]**.
- Federal Register corrections: the Document Drafting Handbook ch. 5 has separate procedures for corrections before and after publication, for withdrawal, and for the letters each needs. It also says "agencies are responsible for correcting errors in documents approved by their Federal Register liaison". — https://www.archives.gov/federal-register/write/ddh (2026-11-06). The detailed requirement that a correction cite the original page, column and line is from archived DDH editions **[unverified for the current edition]**.
- CPUC:
  - Accepted filings "will appear on the docket card of the proceeding". E-filed documents must be PDF/A. — https://www.cpuc.ca.gov/proceedings-and-rulemaking/cpuc-public-participation-hearings/serving-and-filing-proceeding-documents (2026-11-06)
  - Rules 1.13 and 1.14 govern tendering and Docket Office review. A CPUC sanctions decision reportedly held that mislabelling a material correction as "errata" violated Rule 1.1 (candour) **[secondary summary; not verified at primary]**.

### Where Civicsmith follows

- **One way.**
  - "A public entry is never altered or deleted." — `build/requirements/docket.md:160`
  - Take-back is by a later entry with a reason. Both stay readable. — `build/requirements/docket.md:91`; `docs/architecture/BIO_Publication_v0_1.md:370`
  - The rule is the same for publication: "a correction is a new edition". — `build/requirements/publication.md:207`
  - This matches CM/ECF's "filed in error" plus a corrected entry, and the corrections chapter of the Federal Register Document Drafting Handbook (DDH).
- **Numbering and a hash chain.** Each case has `seq` 1, 2, …, and `previous` holds the prior entry's digest. — `build/requirements/docket.md:60`. This is like FRCP 79's chronological, numbered docket. The hash chain gives tamper-evidence comparable to a linear log.
- **Independent monitors that detect forks.** A citing group's import re-verifies each entry's digest, signature and chain. It records an entry with a held `seq` but a different digest as `refused` with `differs: true` and both digests, and the held entry stands. — `build/requirements/case-import.md:137-142`. This is the CT/witness role of monitors that keep state and detect split views, done informally by peers. Pull-only distribution with a per-case Atom feed fits the same model. — `build/requirements/docket.md:122`; `docs/architecture/BIO_Publication_v0_1.md:374`.
- **Withdrawal kept separate from correction.** Withdrawal is never lifted, and the edition stays readable under a stamp. — `docs/architecture/BIO_Publication_v0_1.md:372`; `build/requirements/docket.md:92`. This is close to the DDH's separate withdrawal procedure.
- **Court orders complied with openly**, as a signed entry. — `build/requirements/docket.md:95`.

### Where it departs or is silent

- **No Merkle log and no signed head.** The docket is a per-case linear chain. A verifier can check the chain, but there is no signed tree head and no consistency proof across cases. The publisher's only signature is on each entry, so a publisher could show different readers different chains, and only a peer import that already holds an earlier entry would notice. — `build/requirements/case-import.md:140` ("unchecked" when `seq − 1` is not held).
- **No witness cosignature.** Peers detect forks for themselves but publish no cosignature. — `build/requirements/case-import.md:142`. The C2SP model would let a peer's view become a public, signed statement.
- **Entries are timestamped by the instance clock.** `published_at` is unsigned. — `build/requirements/docket.md:125-128`. Court and agency dockets have a clerk as a trusted third party. Civicsmith has none for docket entries, though the TSA machinery exists (`build/requirements/signatures.md:50-72`).
- **Errata versus substantive correction.**
  - There is a take-back, a withdrawal and a new edition, but no lightweight erratum for a clerical slip in an entry's summary. A take-back plus a re-entry is the only path. — `build/requirements/docket.md:91`.
  - The CPUC point that mislabelling a material correction as "errata" is a candour failure suggests keeping that distinction visible, if one is added.
- **The record shelf is not public.** Filed-but-unplaced entries stay "In our record only". — `build/requirements/docket.md:20`. This is a deliberate departure from a court docket, where every filing is listed. Agency practice of reviewing comments before posting is a closer analogue **[that analogue unverified at primary]**.

---

## (c) Ratification and endorsement by groups

### The practice

- **Robert's Rules: ratification.** In the 1915 edition, §39 "Ratify" is a main motion. Only actions of officers, committees or delegates that the assembly could have authorised beforehand can be ratified. It cannot validate what breaches law, the constitution or the bylaws, except emergency action taken without a quorum. It "cannot make valid a viva voce election when the by-laws require it to be by ballot". It is debatable, and no special vote is listed, so it needs a majority. — Robert's Rules of Order Revised (1915), Project Gutenberg #75990, https://gutenberg.org/cache/epub/75990/pg75990-images.html (2026-11-06). The wording in the current 12th edition (2020) is **[unverified]**. Secondary sources agree that ratification needs a majority at a meeting with a quorum, for example https://www.dummies.com/article/roberts-rules-quorumless-emergency-220885 (2026-11-06, secondary).
- **Robert's Rules: quorum.** "It is never permissible to transact substantive business in the absence of a quorum." A later point of order can invalidate prior action on "clear and convincing proof" (RONR 12th ed. 40:12). — https://robertsrules.com/frequently-asked-questions/ Q3 (2026-11-06)
- **Robert's Rules: approvals gathered one at a time.** Approval collected from members individually, even from all of them, is "not valid board approval, since no meeting was held" in which it could be debated (RONR 12th ed. 9:30–36, 49:16). Electronic meetings are valid "only if your bylaws specifically authorize you to do so". — robertsrules.com FAQ Q19 (2026-11-06)
- **Petition signature practice (US states vary).** Utah requires a written removal request with full name, residential address "exactly as it appeared when you signed", the petition, a clear statement, and "Your physical signature and the date". "You may NOT submit a request to remove your signature by email or other electronic means." The deadline depends on when the county clerk verifies the packet. — https://vote.utah.gov/how-do-i-remove-my-signature-from-a-petition (2026-11-06). Other states (WA, TX, OK) also allow withdrawal before verification, per https://ballotpedia.org/Petition_signature_revocation **[secondary; not opened]**.
- **Organisational sign-off by threshold** is the software analogue: TUF role thresholds, in-toto step thresholds and DSSE's t-of-n (see (a)).

### Where Civicsmith follows

- **Two-stage endorsement.** An owner signs the case document, and each finding and the evidence it rests on crosses by its own signature. — `build/requirements/ratification.md:11`. Re-ratification is idempotent: the same signature answers `existed: true`, and another signature on a ratified edition is refused. — `build/requirements/ratification.md:24`.
- **Group approval rule before signing.**
  - An administrator may name approvers whose approval is required before any case is signed. — `build/requirements/review.md:78`
  - Approvals bind to an approval digest, so a changed document needs new approvals. — `build/requirements/review.md:79`; `build/requirements/case-grammar.md:144`
  - Signing refuses `APPROVAL_MISSING`. — `build/requirements/ratification.md:66`
  - The rule and the approvals in force are carried inside the signed document. — `build/requirements/case-grammar.md:144`
  - This follows Robert's principle that ratification is of a specific, stated act.
- **Only a person acts.** Machines, AI and operator tokens cannot ratify or place entries. — `build/requirements/ratification.md:23`; `build/requirements/docket.md:162`.

### Where it departs or is silent

- **Approvals are not signatures.** An approval is a session act recorded as `{by, at}`. — `build/requirements/case-grammar.md:144`; `build/requirements/review.md:79`. A stranger can read that approvals happened but cannot verify them cryptographically. Only the owner's signature covers them, since the block is inside the signed document.
- **"All named approvers", not a quorum or threshold.** The rule names approvers, and all of them must approve. — `build/requirements/review.md:78`. There is no k-of-n, no majority, and no handling of an unavailable approver beyond the administrator changing the rule.
- **Asynchronous, one-at-a-time approval.** RONR treats individually gathered approval as not valid board approval unless the bylaws authorise it (FAQ Q19). A group adopting Civicsmith's approval rule would need its own rules to authorise this. The product is silent on that.
- **The docket has no group approval.** The manager alone places and signs a public entry, including a withdrawal. — `build/requirements/docket.md:47-58`, `:92`. There is no approval gate like `ratification` R49, so a single person can withdraw an edition the group ratified.
- **No withdrawal of an approval or signature before the deadline.** Unlike petition practice, the requirements state no way for an approver to retract an approval before signing. `review.md:79` makes a new `doc_sha` need a new approval, but not an explicit retraction **[not found in requirements; may exist elsewhere]**.

---

## (d) Publication integrity and corrections

### The practice

- **SPJ Code of Ethics** (revised 4 Oct 2026): "Acknowledge mistakes. Correct them promptly and prominently." "Explain corrections and clarifications carefully and clearly." "Explain ethical choices and processes to audiences." — https://www.spj.org/spj-code-of-ethics/ (2026-11-06; the older `/ethicscode.asp` address now returns 404)
- **IFCN Code of Principles.**
  - Principle 5: "Signatories publish their corrections policy and follow it scrupulously … correct clearly and transparently … seeking so far as possible to ensure that readers see the corrected version."
  - Principle 2: readers should "be able to verify findings themselves".
  - Principle 4: explain how they "select, research, write, edit, publish and correct".
  - Source: https://ifcncodeofprinciples.poynter.org/the-commitments (2026-11-06)
- **C2PA 2.2 (May 2025).**
  - A claim is "a digitally signed and tamper-evident data structure", "signed by the claim generator on behalf of the signer".
  - "Each time an asset is changed, the existing provenance of the asset is preserved." Prior manifests become ingredients.
  - Hard bindings are content hashes.
  - RFC 3161 time-stamps let a manifest stay valid after its credential is revoked.
  - Source: https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html (2026-11-06)
- **VC Data Integrity**: proof sets and proof chains, and `proofPurpose` (see (a)). — https://www.w3.org/TR/vc-data-integrity/ (2026-11-06)

### Where Civicsmith follows

- **Content-addressed, signed publication that a stranger can verify without the instance.** — `build/requirements/publication.md:11`. The hard-binding idea appears in the edition's SHA-pinned members and `doc_sha`. — `bio-plane/src/sshsig.mjs:344`; `build/requirements/signatures.md:29`.
- **Corrections move forward and are explained.**
  - A correction is a new edition. — `build/requirements/publication.md:207`
  - Each new edition carries a "What changed in this edition, and why" statement, which is also placed on the docket automatically. — `build/requirements/docket.md:81`, `:136`; `docs/architecture/BIO_Publication_v0_1.md:312`
  - This matches SPJ's "explain corrections" and IFCN's "readers see the corrected version". The docket's `last_entry` and the citing copies' notices carry it to readers. — `build/requirements/docket.md:119`; `docs/architecture/BIO_Publication_v0_1.md:374`
- **Retraction (withdrawal) is distinct from correction, public, reasoned and permanent.** — `docs/architecture/BIO_Publication_v0_1.md:372`.
- **The group trims nothing in others' submissions; it declines instead.** — `build/requirements/docket.md:75`; `docs/architecture/BIO_Publication_v0_1.md:360`.
- **Readers can check for themselves.** The case document includes "How to check this case yourself", in plain language. — `build/requirements/case-grammar.md:91`.

### Where it departs or is silent

- **No published corrections policy as a document.** IFCN Principle 5 asks for a published policy. The product encodes the policy in behaviour, but I found no requirement that a group publish its corrections and withdrawal policy on its public side **[searched docket, publication and ratification requirements only]**.
- **Prominence of a correction on older editions.** An old edition "answers forever". — `build/requirements/publication.md:207`. Withdrawal stamps it. — `docs/architecture/BIO_Publication_v0_1.md:372`. Nothing I read says an older, superseded but not withdrawn edition shows "a newer edition exists" as prominently as SPJ asks **[may be in the public-read or screens requirements; not checked]**.
- **No trusted time on corrections and docket entries** (see (a)). C2PA treats a time-stamp as what keeps provenance valid after revocation.

---

## (e) Accessibility and plain language in civic publication

### The practice

- **WCAG 2.2** (W3C Recommendation, 12 Dec 2024):
  - 1.1.1 Non-text Content: "All non-text content … has a text alternative".
  - 1.4.3 Contrast (Minimum): at least 4.5:1.
  - 2.4.6 Headings and Labels: "describe topic or purpose".
  - 3.3.2 Labels or Instructions: "provided when content requires user input".
  - 3.3.4 Error Prevention (Legal, Financial, Data): submissions that cause legal commitments must be "reversible", "checked", or "confirmed" (a review step before finalising).
  - 3.3.7 Redundant Entry (A).
  - 3.3.8 Accessible Authentication (Minimum) (AA): no cognitive function test "such as remembering a password" unless an alternative or aid is offered.
  - 3.1.5 Reading Level (AAA): text above lower-secondary level needs a simpler version or supplement.
  - Source: https://www.w3.org/TR/WCAG22/ (2026-11-06)
- **Plain Writing Act of 2010** (P.L. 111-274):
  - Plain writing is "clear, concise, well-organized, and follows other best practices appropriate to the subject or field and intended audience".
  - It covers federal documents about benefits, services and compliance, but not regulations. It applies to federal agencies only.
  - Source: https://www.govinfo.gov/content/pkg/PLAW-111publ274/html/PLAW-111publ274.htm (2026-11-06)
- **Federal plain language guidance** now lives on Digital.gov: write for your audience ("the first rule of plain language"), organise, use active voice, use lists, use tables. The PlainLanguage.gov content is archived on GitHub. — https://digital.gov/guides/plain-language and https://digital.gov/guides/plain-language/principles (2026-11-06)

### Where Civicsmith follows

- WCAG 2.2 AA in both themes is the design stream's stated floor. — `docs/development/ux-substrate/layouts.html:42`. It also specifies 1.4.13 dismissible content and 2.5.8 target size. — `docs/development/ux-substrate/layouts.html:544`, `:557`, `:997`.
- There is keyboard reachability and visible focus. — `build/requirements/interface-shell.md:64`.
- **Confirmed before an irreversible act** (WCAG 3.3.4 "confirmed"):
  - The docket requires `acknowledged: true` against an outward-act warning that says the public will see the entry and it can be taken back "but never unsaid". — `build/requirements/docket.md:57-58`
  - Publication's pre-flight shows every blocker before the first screen. — `docs/architecture/BIO_Publication_v0_1.md:305-306`
- **Plain words.** Refusals carry a translation, and every sentence a reader sees is read by key from the words file. — `build/requirements/docket.md:113`; `build/requirements/signatures.md:148`. The bar is "set in plain letters". — `docs/architecture/BIO_Publication_v0_1.md:680`.

### Where it departs or is silent

- **Signing is by passphrase or device unlock.** — `docs/architecture/BIO_Publication_v0_1.md:309`. A passphrase is a cognitive function test under WCAG 3.3.8 unless a mechanism such as a password manager or paste is supported. I did not check whether the signer allows that **[not checked]**.
- **Reading level.** No requirement I read sets a reading-level target (WCAG 3.1.5 AAA) for the public page, the docket summaries (up to 600 characters each, `build/requirements/docket.md:55`) or the "what changed" statement.
- **Accessibility of the signed artefact itself.** Nothing I read says whether the complete edition, a "self-contained file" (`docs/architecture/BIO_Publication_v0_1.md:346`), and the Atom feed meet WCAG or PDF/UA. CPUC requires PDF/A for e-filing, for archival reasons rather than accessibility.

---

## Implications for a second signature over a docket statement

The current statement is `bio-docket <case> <seq> <sha256(entry JSON)>\n` in namespace `bio-docket`. One manager key signs it, and it is verified against keys registered to `by`. — `bio-plane/src/sshsig.mjs:409-416`; `build/requirements/docket.md:57-58`. Below are options, not a decision.

**1. A co-signature: a second SSHSIG over the same statement bytes, in the same namespace (a DSSE-style or VC "proof set").**
- For: no new statement grammar. Stock `ssh-keygen` verifies each signature. An import verifies each signature as it does today (`build/requirements/case-import.md:139`).
- Against:
  - The two signatures are unordered, so neither says "I ratify *that* signature".
  - The same bytes in the same namespace means a ratifier's signature is indistinguishable from a second manager signature. The meaning lives only in the key's role, which is outside the format (PROTOCOL.sshsig is silent on who signed).
  - Counting needs TUF's distinct-key rule.

**2. A countersignature: a new statement that names the first signature, in its own namespace (a VC "proof chain", the C2SP `cosignature/v1` pattern).**
- Shape: for example a new namespace (say `bio-docket-ratify`) over `bio-docket-ratify <case> <seq> <entry sha> <sha256(first armored signature)>\n`.
- For:
  - It binds the ratification to a specific first signature and states an order.
  - The separate namespace follows R1 (`build/requirements/signatures.md:16`) and the sshsig namespace intent.
  - A countersign over the signature, and not only the entry, stops the second signature from transferring if the first is re-made.
- Against:
  - It adds a namespace that browser signers must be configured for. The reason given for reusing `bio-ratify` at `bio-plane/src/sshsig.mjs:340-343` applies.
  - The SSHSIG signature bytes are deterministic for Ed25519 (`build/requirements/signatures.md:86`), but the armor is not canonical across tools. So "hash of the signature" must name the raw blob, not the armor.
  - A missing first signature, or one taken back, needs a defined meaning.

**3. A group approval recorded inside the signed entry (today's case approval pattern, `build/requirements/case-grammar.md:144`).**
- Shape: approvers approve an approval digest, and the manager's one signature carries their `{by, at}`.
- For: it reuses `review` R30/R31 and keeps one signature on the docket.
- Against:
  - Approvals are not independently verifiable.
  - Docket entries must name no member (`build/requirements/docket.md:68`), so `{by}` cannot be published as it is in a case document. It would need key ids or roles instead.
  - RONR would not treat gathered approvals as a board act without bylaw authority.

**4. A k-of-n threshold of independent signatures (TUF, in-toto, DSSE).**
- For: it matches organisational quorum and survives one unavailable or compromised key.
- Against:
  - The group's key list and threshold must themselves be signed and versioned, which is TUF's root problem, and no such object exists today.
  - Readers need the threshold that was in force at the entry's time.

**5. A FROST threshold that yields one ordinary Ed25519 signature under a group key (RFC 9591).**
- For:
  - Verifiers and the public answer are unchanged in shape. `ssh-keygen` would verify against a group key.
  - No member identity is revealed, which fits `build/requirements/docket.md:68` and `:164`.
- Against:
  - The protocol is interactive and in several rounds, in the browser.
  - It is Informational with few mature JS implementations **[maturity unverified]**.
  - It hides who approved, which may be the opposite of what ratification should show.
  - Key generation and resharing on membership change are hard.

**Cross-cutting choices for any option**
- **Trusted time.** Whether to add an RFC 3161 token (the product already has `tsa.mjs`, `build/requirements/signatures.md:50-72`) to the first signature, the second, or both. Without one, key revocation cannot separate signatures made before compromise from those made after (C2PA §10.3.2.5.1; Git valid-before).
- **Which key list verifies the second signer.** It could be the same `attestingKeys` (`build/requirements/credentials.md:31`), a role-restricted list, or the published `groupKeysPublic` (`build/requirements/network-notices.md:134`). Using allowed_signers `namespaces=` per role is the OpenSSH-native way to say "this key may ratify but not post".
- **Public answer shape.** `docket` R24 fixes the wire form that citing copies depend on (`build/requirements/docket.md:123-131`). A second signature must be additive. The handling of unknown signatures in C2SP signed-note ("MUST ignore signatures from unknown keys") is a model for old readers.
- **Chain and log.** If the second signature arrives later, is it a new docket entry with its own `seq` and `previous` link, which keeps R16's never-altered invariant (`build/requirements/docket.md:160`)? Or is it an attachment to the existing entry, which would alter what R24 answers for that `seq`, and which an import's `differs: true` check (`build/requirements/case-import.md:142`) would read as a fork?

## Open questions

1. What does the second signature assert? That the group endorses the manager's entry (ratification, as in RONR §39), or that a second person witnessed it (a cosignature, as in C2SP)? The two lead to different statement bytes and namespaces.
2. Must the docket name no member even for ratifiers (`build/requirements/docket.md:68`)? If so, can ratifiers be shown only as key fingerprints or roles?
3. Is ratification needed for every public entry kind, or only for withdrawal, court-order and standing kinds, the acts with the gravest effect (`build/requirements/docket.md:92`, `:95`, `:87`)?
4. Can an entry be live before ratification? If yes, what does a reader see in the gap, and what happens if ratification is refused? A take-back?
5. Should the group's threshold and approver list be a signed, versioned object (a TUF root) so a stranger can tell what was in force at an entry's time?
6. Should docket entries carry an RFC 3161 timestamp, so key revocation is meaningful for past entries?
7. Does a group need bylaw text authorising asynchronous electronic approval (RONR FAQ Q19)? Should Civicsmith prompt for or state that?
8. Should `bio-ratify` (shared by three statements, `bio-plane/src/sshsig.mjs:340-343`, `:431-434`) be the namespace for docket ratification too, or should docket ratification get its own namespace?
9. Peer imports detect forks (`build/requirements/case-import.md:142`). Should they publish a cosignature, so a docket gains public witnesses?

### Not verified in this pass
- The 12th edition (2020) RONR text on Ratify: only the 1915 text and secondary sources were read.
- RFC 9162's status category.
- That Git signs in namespace `git`.
- NIST SP 800-57's compromise-recovery text.
- The current DDH correction-citation wording.
- The CPUC errata ruling and Rules 1.13–1.14 text.
- Whether regulations.gov comments are reviewed before posting (primary source).
- State petition rules beyond Utah.
- The maturity of FROST implementations in JS.
