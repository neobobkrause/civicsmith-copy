Length: 138 lines. Last section: "Suggestions".

# signatures: requirements

Next number: 49

## Public

### Purpose

Builds and verifies the signed and timestamped statements the plane and the installer exchange: OpenSSH detached signatures (SSHSIG) over a release, a release notice, a fleet manifest, a bundle ratification or a case ratification; an RFC 3161 timestamp request and response, and the public-archive locator an opt-in co-archive returns; and the release signer's tool. The in-interface signer (`interface-shell` R40, R41) is a maker of R1's statements, unchanged in format. It holds no record, no stored private key and no clock, and makes no network call itself — every network call is the caller's. Its one signing service (the release signer) runs on an operator's machine with a seed the caller passes, and never ships in the plane or the installer.

### Provides

**Signatures (`sshsig.mjs`)**

`NS_RELEASE`, `NS_RATIFY`, `NS_FLEET`, `NS_NOTICE`, `NS_DOCKET` → strings (`"bio-release"`, `"bio-ratify"`, `"bio-release-fleet"`, `"bio-working-on"`, `"bio-docket"`).
- **R1** [met] Five distinct compiled constants: `NS_RELEASE`, `NS_RATIFY`, `NS_FLEET`, `NS_NOTICE` and `NS_DOCKET`. No two are equal, so a signature that verifies in one namespace never verifies in another. (Amended at T23's opening from "Three": DEC-111, K1019, K1031; from "Four" by N520: DEC-116.) (T48; N1047) Six: `NS_RELEASE_NOTICE` joins them (R46), distinct from every other.
- **R37** [met] `NS_NOTICE` is `"bio-working-on"`, a compiled constant distinct from every other namespace (R1's rule). The browser signer signs in it (DEC-111, K1019, K1031).
- **R39** [met] `NS_DOCKET` is `"bio-docket"`, a compiled constant distinct from every other namespace (R1's rule). The browser signer signs in it. (DEC-116 item 6; N520)

`verifySshsig(armored, message, expectNamespace, allowedKeys) → Promise<{ok:true, keyB64, namespace} | {ok:false, reason, ...}>`
- **R2** [met] `ok:true` only when: `armored` dearmors to a version-1 SSHSIG blob whose key and signature are both `ssh-ed25519` (32-byte key, 64-byte signature); its `namespace` equals `expectNamespace`; its signing key's wire base64 (`keyB64`) is in `allowedKeys`, after normalising each entry (a bare base64 field, a full `"ssh-ed25519 AAAA… comment"` line, or a principal-prefixed allowed_signers line all name the same key); and the signature verifies over `SSHSIG | namespace | reserved | hashAlg | H(message)`, hashed with the blob's own declared `hashAlg` (`sha256` or `sha512`), against the exact bytes of `message`.
- **R3** [met] `ok:false` gives a `reason`: `MALFORMED` (bad armor, magic, version, key/signature type or length, or a hash algorithm other than `sha256`/`sha512`); `NAMESPACE` (with `expected` and `got`) when the namespace does not match; `UNKNOWN_KEY` (with `keyB64`) when the signing key normalises to nothing in `allowedKeys`; `BAD_SIGNATURE` (with `keyB64`) when the signature does not verify over exactly `message`; `CRYPTO_UNAVAILABLE` when the runtime refuses to import the key.
- **R4** [met] Never throws.

`ratifyStatement(bundleId, bundleSha) → Uint8Array`
- **R5** [met] Returns the ASCII bytes `` `bio-ratify ${bundleId} ${bundleSha}\n` ``, exactly. Same inputs always give byte-identical output.

`caseRatifyStatement(caseId, edition, docSha) → Uint8Array`
- **R6** [met] Returns the ASCII bytes `` `bio-ratify-case ${caseId} ${edition} ${docSha}\n` ``, exactly.
- **R7** [met] Its leading token (`bio-ratify-case`) differs from `ratifyStatement`'s (`bio-ratify`), so no bundle ratification and no case ratification can ever be the same signed bytes.

`noticeStatement(noticeId, revision, sha) → Uint8Array`
- **R38** [met] Returns exactly `` `bio-working-on ${noticeId} ${revision} ${sha}\n` ``. It throws when `noticeId` is not an opaque id (`^[A-Z]+-\d{4}-\d{4,}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$`, any prefix, the tail optional; K1115), `revision` is not a whole number of at least 1, or `sha` is not 64 lowercase hex characters (DEC-111, K1019, K1031). The counter is `record-grammar`'s sequential form (its R46: four digits or more, so the 10,000th id is accepted and every id accepted before T33 still is), read from `record-grammar`, never a copy held here (S0-13; K1470).

`docketStatement(caseId, seq, sha) → Uint8Array`
- **R40** [met] Returns exactly `` `bio-docket ${caseId} ${seq} ${sha}\n` ``. It throws when `caseId` is not an opaque id (R38's shape, its counter `record-grammar`'s, as R38 states), `seq` is not a whole number of at least 1, or `sha` is not 64 lowercase hex characters. Its leading token differs from every other statement's, so no docket entry and no other signed statement can be the same signed bytes. (DEC-116 item 6; N520)

`captureAccountStatement(captureSha, text) → Uint8Array`
- **R41** [met] Returns exactly `` `bio-capture-account ${captureSha}\n${text}` `` (each argument as `String(…)`), the text unchanged after the first newline. `CAPTURE_ACCOUNT_TOKEN` is `"bio-capture-account"`. Its leading token differs from every other statement's (R5, R6, R38, R40), so no capture account and no other signed statement can be the same signed bytes. It is signed in `NS_RATIFY`. Same inputs always give byte-identical output. (DEC-81 item 3(c); `capture` R69, `case-checker` R3; N530, K1317 (3))

`fleetStatement({version, plane, members}) → string`
- **R8** [met] Renders `` `bio-release-fleet/2\nversion ${version}\nplane ${plane.sha256} ${plane.bytes} ${plane.asset}\n` ``, then one line per entry of `members`, then a trailing `\n`.
- **R9** [met] Member lines are sorted by `member` name, ascending, regardless of input order: the same set of members always renders the same bytes.
- **R10** [met] Each member line is `` `member ${member} ${sha256} ${bytes} ${asset} compat=${date}+${flags} services=${services} parts=${parts}` ``, where: `flags` is the member's `compat.flags`, sorted and comma-joined, or `-` when the list is empty (an empty list is stated, never omitted); `services` is each `{binding, service}` rendered `binding:service`, sorted and comma-joined (may be the empty string, but the `services=` key is always present); `parts` is each `{path, type, sha256, bytes}` rendered `path:type:sha256:bytes`, sorted and comma-joined (may be the empty string, but the `parts=` key is always present).
- **R11** [met] Throws `Error` reading `REFUSED [MEMBER_COMPAT_UNSTATED]: …` when a member's `compat.date` is not a non-empty string.
- **R12** [met] Throws `Error` reading `REFUSED [MEMBER_FLAGS_UNSTATED]: …` when a member's `compat.flags` is not an array.
- **R13** [met] Throws `Error` reading `REFUSED [PART_TYPE_UNSTATED]: …` when a part's `type` is not a non-empty string.
- **R14** [met] Deterministic: the same `{version, plane, members}` (members in any order) always renders the same string, and never partially — a throw from R11–R13 happens before any byte of a member's line is emitted for that member.

**Trusted timestamps and the co-archive (`tsa.mjs`)**

`timestampRequest(sha256Hex, nonceBytes?) → {der, nonce}`
- **R15** [met] `der` is a DER-encoded RFC 3161 `TimeStampReq`, version 1, over the SHA-256 digest `sha256Hex`, with `certReq` true and the nonce present — byte-identical to what `openssl ts -query -sha256 -cert` builds for the same digest and nonce.
- **R16** [met] `nonceBytes`, when given, is used verbatim and returned as `nonce`; when omitted, `nonce` is 8 fresh random bytes.

`parseTimestampResponse(bytes, expectDigestHex) → {ok, reason?, status?, token?}`
- **R17** [met] `ok:true` only when `bytes` is a well-formed `TimeStampResp` whose status is 0 ("granted") or 1 ("granted with modifications") and whose token's bytes contain `expectDigestHex`'s raw bytes somewhere inside it (the binding check); `token` is then the token's raw DER bytes.
- **R18** [met] `ok:false` gives a `reason`: `MALFORMED` for bytes that do not parse as the expected shape; `REJECTED` (with `status`) for any other status; `NO_TOKEN` (with `status`) for a granted status carrying no token; `NOT_BOUND` (with `status`) for a token whose bytes do not contain `expectDigestHex`.
- **R19** [met] Never throws.

`TSA_ENDPOINTS → string[]`
- **R20** [met] A compiled constant naming the timestamp authorities to ask, in order (today: DigiCert, Sectigo, `rfc3161.ai.moda`); never read from a call's arguments. A caller must not accept an endpoint named by anything other than this list.

`TSA_CONTENT_TYPE`, `TSA_ACCEPT → strings`
- **R21** [met] The request and accepted response media types for the RFC 3161 exchange (`"application/timestamp-query"`, `"application/timestamp-reply"`).

`ARCHIVE_SAVE_BASE`, `ARCHIVE_SERVICE → strings`
- **R22** [met] `ARCHIVE_SAVE_BASE` is the one compiled URL a locator may be appended to for a save request (`https://web.archive.org/save/`); `ARCHIVE_SERVICE` names the service for the record. Neither is settable by a caller.

`archiveLocatorFrom(res, requested) → string | null`
- **R23** [met] Returns the archived locator (`https://web.archive.org/web/<timestamp>/…`), read in order from `res`'s `content-location` header, its `location` header, or (last) `res.url` itself; `null` when none of the three names one.
- **R24** [met] Never throws.

**The offline signer page (retired)** — the page (`sign-release.html`, `signpage.mjs`, `embed-signpage.mjs`) leaves this module (T51-124; K3807, K3814); BOB moves its files to `control-plane`'s paths at the merge and control-plane's job deletes them with the `/sign` route. Its ids stay retired, never reused:

**The release signer (`bio-plane/scripts/sign-sshsig.mjs`, moved from `tools/` in T19; BOB-5)** — run only on an operator's machine by the release assembler (bundler R23), never imported by the plane or the installer.

`signSshsig(envelope, message, namespace) → string`
- **R33** [met] Returns an armored OpenSSH signature (`-----BEGIN SSH SIGNATURE-----`, base64 wrapped at 70 columns, `-----END SSH SIGNATURE-----` and a newline): a version-1 SSHSIG blob with an `ssh-ed25519` key and signature, `namespace`, an empty reserved field and hash algorithm `sha512`, signing the exact bytes of `message` with the key the envelope's seed gives. Same inputs give the same output (Ed25519 is deterministic). Stock `ssh-keygen -Y verify` and `verifySshsig` (R2) both accept it for that namespace and the key of R35.

`seedFromEnvelope(envelope) → {label, seed}`
- **R34** [met] Accepts exactly `BIOKEY-RAW1.<label>.<base64 of 32 bytes>` (surrounding whitespace ignored), the envelope a release key is held in, and returns the label and the 32-byte seed. Throws `Error` reading `release seed is not a BIOKEY-RAW1 envelope` for any other shape and `release seed is <n> bytes, expected 32` for a seed of another length; `signSshsig` and `signerPublicLine` throw the same.

`signerPublicLine(envelope, comment = "bio-release") → string`, `keyFromSeed(seed)`, `publicFromKey(key)`
- **R35** [met] `signerPublicLine` returns `ssh-ed25519 <base64 wire public key> <comment>`, the line an allowed-signers list or `RELEASE.json`'s `signer` carries for the envelope's key; `keyFromSeed` gives the Ed25519 private key of a 32-byte seed and `publicFromKey` its 32 raw public bytes.
- **R36** [met] Never prints, writes or returns the seed or the private key; the only outputs are the signature and the public line.

**Release keys and the release notice** (T48-3; N1047; K3158; `build/plan/draft-updates.md` §1–2)

`RELEASE_KEYS → string[]`
- **R45** [met] (T48; N1047; K3158) A frozen list, the one place the keys that sign a Civicsmith release are held: the public lines (R35's form, `ssh-ed25519 <base64> <comment>`) of the release key and the recovery key, exactly the two lines the installer's `ARMED_SIGNERS` holds at T48's opening (`installer` R43). A release, a fleet statement and a release notice are each verified against this list: the installer's `ARMED_SIGNERS` and every plane module that verifies one read it from here and hold no copy. Adding or removing a key is a requirement change made in this module alone. Test: each line normalises as R2 reads an allowed key, the two keys differ, and the list is frozen.

`NS_RELEASE_NOTICE → string`
- **R46** [met] (T48; N1047; amends R1) `NS_RELEASE_NOTICE` is `"bio-release-notice"`, a compiled constant distinct from every other namespace (R1's rule), so a signature over a release, a fleet statement or anything else never verifies as a release notice, nor a notice's as any of them.

`releaseNoticeStatement({version, date, manifest, security, notes}) → Uint8Array`
- **R47** [met] (T48; N1047; draft-updates §1) Returns the exact bytes a release notice is signed over: `` `bio-release-notice/1\nversion ${version}\ndate ${date}\nmanifest ${manifest}\nsecurity ${security ? "yes" : "no"}\nnotes ${canonicalJson(notes)}\n` `` (UTF-8; `canonicalJson` is `record-grammar`'s, its R12), so the notes are inside what is signed. `version` is `<n>.<n>.<n>` (each part digits, no leading zero but `0`); `date` a `YYYY-MM-DD` that exists; `manifest` the release manifest's SHA-256, 64 lowercase hex; `security` a boolean; `notes` exactly `{members, administrators, must_do}`, each a string of at most `RELEASE_NOTES_MAX` (8,000) characters, `members` and `administrators` non-empty and `must_do` possibly empty. Anything else throws `Error` reading `REFUSED [NOTICE_FIELD]: <field>` before any byte is built. Same inputs always give byte-identical output; changing any field, a character of the notes included, changes the bytes.

`verifyReleaseNotice(notice, armored, running, allowedKeys = RELEASE_KEYS) → Promise<{ok:true, notice} | {ok:false, reason, ...}>`
- **R48** [met] (T48; N1047; draft-updates §2) `notice` is `{version, date, manifest, security, notes}` as published beside a release; `running` the version the caller runs, R47's form. `ok:true` only when the notice is well formed (R47), `armored` verifies by R2 in `NS_RELEASE_NOTICE` over `releaseNoticeStatement(notice)` against `allowedKeys`, and `notice.version` is higher than `running`, compared part by part as numbers. `notice` in the answer is a frozen copy holding only R47's fields. Otherwise `ok:false` with `reason`: `MALFORMED` (with `field`) for a notice R47 refuses or a `running` not of its form; R3's `NAMESPACE`, `UNKNOWN_KEY`, `BAD_SIGNATURE` or `CRYPTO_UNAVAILABLE`, as `verifySshsig` names them; `NOT_NEWER` (with `version` and `running`) for a correctly signed notice of the running version or an older one, so neither a downgrade nor the replay of an old notice is accepted. The signature is judged before the version. Never throws. Test: a notice signed with a throwaway key in `allowedKeys` is accepted; controls: the same notice with one character of its notes changed is `BAD_SIGNATURE`; an older version correctly signed is `NOT_NEWER`; the same bytes signed in `NS_RELEASE` are `NAMESPACE`; a key outside `allowedKeys` is `UNKNOWN_KEY`.

### Errors

Stated per service above. `verifySshsig`, `verifyReleaseNotice`, `parseTimestampResponse` and `archiveLocatorFrom` never throw and always name a `reason` for a "no". `fleetStatement` throws (never partially renders) on an unstated compat date, flags list or part type; every other service throws only on malformed input it cannot make sense of (`verifySshsig`'s inner parse failures are caught and returned as `MALFORMED`, never thrown).

## Private

### Uses

- `record-grammar`: the id grammar (`ID_TABLE`, `idPattern`; its R46, R47) for R38 and R40 (T33-7; a new edge, P4 holding: `record-grammar` is first in layer 1); `canonicalJson` (its R12) for R47 (T48).

Otherwise every export is built from Web platform primitives (`crypto.subtle`, `atob`/`btoa`, `TextEncoder`/`TextDecoder`) and literal data. The release signer (R33–R36) alone uses Node's `node:crypto`, which is why it never ships in the plane or the installer.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R26** [met] Pure and offline: no store, no network fetch, no clock. `verifySshsig`, `timestampRequest` and `parseTimestampResponse` make no request themselves; the endpoints they hand a caller (R20, R22) are compiled constants a caller cannot override from a request body, and `archiveLocatorFrom` only reads a `Response` the caller already fetched.
- **R27** [met] No place is named in this module: no jurisdiction, city or county appears in any string it exports. Its tests need no jurisdiction profile.
- **R28** [met] A signature verified for one namespace (R1) or over one message (R2, R5–R7, R41) never verifies for a different namespace or a different message; a tampered message or signature is always `BAD_SIGNATURE`, never silently accepted.
- **R29** [met] Every "no" this module returns names which kind of no (`reason` in R3, R18; `null` with no reason only where the interface documents `null` as the whole answer, R23).

### Satisfies

- `BIO_Distribution_v0_1.md` §3 ("The release") and §4 ("The fleet") — the release object, its two-key/three-namespace scheme, and the fleet statement one signature must cover as a set.
- `BIO_Intake_Doctrine_v1_1.md` §3 — trusted timestamps as the co-attestation a group cannot fabricate for itself, and the public archive as the opt-in second kind of co-attestation.
- `BIO_Publication_v0_1.md` §5D ("Who acts, and signing": the manager signs a public docket entry with their registered key; R39, R40; DEC-116).
- `build/layers.md`, "No jurisdiction in the product" (R27).
- Bob's K3158 and `build/plan/draft-updates.md` §1–2: a signed release notice whose notes are inside what is signed, verified against the keys the running version carries, with no downgrade or replay (R45–R48).

### Suggestions

- **Checks.** Check C-18.8 (the gate's release-signature check, `bio-checks.mjs` "Release-signature primitives") still holds a second, hand-written SSHSIG/Ed25519 verifier. K10 (entry N8) replaces it with a call to `verifySshsig`: the Apps Script runtime that justified it is decommissioned. This module takes on no check-derived invariant.
- **For callers.** `verifySshsig`'s `allowedKeys` and SSHSIG's own embedded key together are the only source of truth for who signed; a caller must supply the actual `ARMED_SIGNERS`/registry list, never a caller-asserted one. `fleetStatement`'s per-member `services` and `parts` fields are signed as the caller supplies them (R10); nothing in this module checks them against reality — that a member's declared parts match what was actually uploaded is the caller's obligation.
- **Release notices (T48).** `instance-setup`'s daily check (T48-62) calls `verifyReleaseNotice` with no `allowedKeys`, so `RELEASE_KEYS` decides; the installer re-points `ARMED_SIGNERS` to `RELEASE_KEYS` in its own job (T48-79), and `bundler` writes the notice through R47 (T48-4). Text-only rendering and the notes' cap on display are the caller's; R47's cap bounds what is signed. A key rotation (Distribution §10) edits R45's list.
- **The signing page leaves (T51-124; K3814).** The job removes the page's tests' imports of `signpage.mjs` and `sign-release.html` from `signatures.test.mjs`, `release-signer.test.mjs` and `signer-keys.test.mjs` (they mix the page's tests with `sshsig`'s), and keeps every test of `sshsig.mjs`, `tsa.mjs` and `sign-sshsig.mjs`; it edits none of the page's files. R34's envelope format `BIOKEY-RAW1.` is the release signer's input, whoever mints it.
- **The release signer (BOB-5).** The job moves `tools/sign-sshsig.mjs` beside `sshsig.mjs` (a script directory, not `src/`, so no bundle reaches it), re-points the assembler's import (bundler's file, `uses`), and re-points `sshsig.mjs`:229's note naming `tools/release-assemble.mjs`. R33's test signs with a throwaway seed and verifies with `verifySshsig` and, where present, stock `ssh-keygen`.
