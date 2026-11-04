# signatures — requirements

**Status** · In force: written by BOB #37 (T6), a helper module, its requirements BOB's (K20); the release signer joined at T19's fold (K648, K653). Last changed T36 (T36-1: R43, R44 new, the passphrase at Generate and the recovery key; K1936); every requirement met (SIGNATURES #11, K2079). Last changed T48 (T48-3: R45–R48 new, the release keys in one place, the release notice's namespace, statement and verify; R1 amended (six namespaces); N1047; K3158, K3189, K3195); marked not yet met (T48). Last changed T51 (T51-124: R25, R30, R31, R32, R42, R43, R44 retired, the signing page leaves this module; R1, R34, R37, R39 reworded; K3807, K3814). Last changed T53 (R49–R56 new: the AI catalogue's two namespaces and a third for a test container's run key, `CATALOGUE_KEYS`, the payload, advisory and seal-key statements and their verifiers, the run-key check; K5457, K5471); marked not yet met (T53). Last changed in T53's completion round (T53-592: R58 new, `CATALOGUE_KEYS` holds Bob's two catalogue keys; K5751).

## Public

### Purpose

Builds and verifies the signed and timestamped statements the plane and the installer exchange: OpenSSH detached signatures (SSHSIG) over a release, a release notice, a fleet manifest, a bundle ratification or a case ratification; an RFC 3161 timestamp request and response, and the public-archive locator an opt-in co-archive returns; and the release signer's tool. The in-interface signer (`interface-shell` R40, R41) is a maker of R1's statements, unchanged in format. It holds no record, no stored private key and no clock, and makes no network call itself — every network call is the caller's. Its one signing service (the release signer) runs on an operator's machine with a seed the caller passes, and never ships in the plane or the installer.

### Provides

**Signatures (`sshsig.mjs`)**

`NS_RELEASE`, `NS_RATIFY`, `NS_FLEET`, `NS_NOTICE`, `NS_DOCKET` → strings (`"bio-release"`, `"bio-ratify"`, `"bio-release-fleet"`, `"bio-working-on"`, `"bio-docket"`).
- **R1** Five distinct compiled constants: `NS_RELEASE`, `NS_RATIFY`, `NS_FLEET`, `NS_NOTICE` and `NS_DOCKET`. No two are equal, so a signature that verifies in one namespace never verifies in another. (Amended at T23's opening from "Three": DEC-111, K1019, K1031; from "Four" by N520: DEC-116.) (T48; N1047) Six: `NS_RELEASE_NOTICE` joins them (R46), distinct from every other.
- **R37** `NS_NOTICE` is `"bio-working-on"`, a compiled constant distinct from every other namespace (R1's rule). The browser signer signs in it (DEC-111, K1019, K1031).
- **R39** `NS_DOCKET` is `"bio-docket"`, a compiled constant distinct from every other namespace (R1's rule). The browser signer signs in it. (DEC-116 item 6; N520)

`verifySshsig(armored, message, expectNamespace, allowedKeys) → Promise<{ok:true, keyB64, namespace} | {ok:false, reason, ...}>`
- **R2** `ok:true` only when: `armored` dearmors to a version-1 SSHSIG blob whose key and signature are both `ssh-ed25519` (32-byte key, 64-byte signature); its `namespace` equals `expectNamespace`; its signing key's wire base64 (`keyB64`) is in `allowedKeys`, after normalising each entry (a bare base64 field, a full `"ssh-ed25519 AAAA… comment"` line, or a principal-prefixed allowed_signers line all name the same key); and the signature verifies over `SSHSIG | namespace | reserved | hashAlg | H(message)`, hashed with the blob's own declared `hashAlg` (`sha256` or `sha512`), against the exact bytes of `message`.
- **R3** `ok:false` gives a `reason`: `MALFORMED` (bad armor, magic, version, key/signature type or length, or a hash algorithm other than `sha256`/`sha512`); `NAMESPACE` (with `expected` and `got`) when the namespace does not match; `UNKNOWN_KEY` (with `keyB64`) when the signing key normalises to nothing in `allowedKeys`; `BAD_SIGNATURE` (with `keyB64`) when the signature does not verify over exactly `message`; `CRYPTO_UNAVAILABLE` when the runtime refuses to import the key.
- **R4** Never throws.

`ratifyStatement(bundleId, bundleSha) → Uint8Array`
- **R5** Returns the ASCII bytes `` `bio-ratify ${bundleId} ${bundleSha}\n` ``, exactly. Same inputs always give byte-identical output.

`caseRatifyStatement(caseId, edition, docSha) → Uint8Array`
- **R6** Returns the ASCII bytes `` `bio-ratify-case ${caseId} ${edition} ${docSha}\n` ``, exactly.
- **R7** Its leading token (`bio-ratify-case`) differs from `ratifyStatement`'s (`bio-ratify`), so no bundle ratification and no case ratification can ever be the same signed bytes.

`noticeStatement(noticeId, revision, sha) → Uint8Array`
- **R38** Returns exactly `` `bio-working-on ${noticeId} ${revision} ${sha}\n` ``. It throws when `noticeId` is not an opaque id (`^[A-Z]+-\d{4}-\d{4,}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$`, any prefix, the tail optional; K1115), `revision` is not a whole number of at least 1, or `sha` is not 64 lowercase hex characters (DEC-111, K1019, K1031). The counter is `record-grammar`'s sequential form (its R46: four digits or more, so the 10,000th id is accepted and every id accepted before T33 still is), read from `record-grammar`, never a copy held here (S0-13; K1470).

`docketStatement(caseId, seq, sha) → Uint8Array`
- **R40** Returns exactly `` `bio-docket ${caseId} ${seq} ${sha}\n` ``. It throws when `caseId` is not an opaque id (R38's shape, its counter `record-grammar`'s, as R38 states), `seq` is not a whole number of at least 1, or `sha` is not 64 lowercase hex characters. Its leading token differs from every other statement's, so no docket entry and no other signed statement can be the same signed bytes. (DEC-116 item 6; N520)

`captureAccountStatement(captureSha, text) → Uint8Array`
- **R41** Returns exactly `` `bio-capture-account ${captureSha}\n${text}` `` (each argument as `String(…)`), the text unchanged after the first newline. `CAPTURE_ACCOUNT_TOKEN` is `"bio-capture-account"`. Its leading token differs from every other statement's (R5, R6, R38, R40), so no capture account and no other signed statement can be the same signed bytes. It is signed in `NS_RATIFY`. Same inputs always give byte-identical output. (DEC-81 item 3(c); `capture` R69, `case-checker` R3; N530, K1317 (3))

`fleetStatement({version, plane, members}) → string`
- **R8** Renders `` `bio-release-fleet/2\nversion ${version}\nplane ${plane.sha256} ${plane.bytes} ${plane.asset}\n` ``, then one line per entry of `members`, then a trailing `\n`.
- **R9** Member lines are sorted by `member` name, ascending, regardless of input order: the same set of members always renders the same bytes.
- **R10** Each member line is `` `member ${member} ${sha256} ${bytes} ${asset} compat=${date}+${flags} services=${services} parts=${parts}` ``, where: `flags` is the member's `compat.flags`, sorted and comma-joined, or `-` when the list is empty (an empty list is stated, never omitted); `services` is each `{binding, service}` rendered `binding:service`, sorted and comma-joined (may be the empty string, but the `services=` key is always present); `parts` is each `{path, type, sha256, bytes}` rendered `path:type:sha256:bytes`, sorted and comma-joined (may be the empty string, but the `parts=` key is always present).
- **R11** Throws `Error` reading `REFUSED [MEMBER_COMPAT_UNSTATED]: …` when a member's `compat.date` is not a non-empty string.
- **R12** Throws `Error` reading `REFUSED [MEMBER_FLAGS_UNSTATED]: …` when a member's `compat.flags` is not an array.
- **R13** Throws `Error` reading `REFUSED [PART_TYPE_UNSTATED]: …` when a part's `type` is not a non-empty string.
- **R14** Deterministic: the same `{version, plane, members}` (members in any order) always renders the same string, and never partially — a throw from R11–R13 happens before any byte of a member's line is emitted for that member.

**Trusted timestamps and the co-archive (`tsa.mjs`)**

`timestampRequest(sha256Hex, nonceBytes?) → {der, nonce}`
- **R15** `der` is a DER-encoded RFC 3161 `TimeStampReq`, version 1, over the SHA-256 digest `sha256Hex`, with `certReq` true and the nonce present — byte-identical to what `openssl ts -query -sha256 -cert` builds for the same digest and nonce.
- **R16** `nonceBytes`, when given, is used verbatim and returned as `nonce`; when omitted, `nonce` is 8 fresh random bytes.

`parseTimestampResponse(bytes, expectDigestHex) → {ok, reason?, status?, token?}`
- **R17** `ok:true` only when `bytes` is a well-formed `TimeStampResp` whose status is 0 ("granted") or 1 ("granted with modifications") and whose token's bytes contain `expectDigestHex`'s raw bytes somewhere inside it (the binding check); `token` is then the token's raw DER bytes.
- **R18** `ok:false` gives a `reason`: `MALFORMED` for bytes that do not parse as the expected shape; `REJECTED` (with `status`) for any other status; `NO_TOKEN` (with `status`) for a granted status carrying no token; `NOT_BOUND` (with `status`) for a token whose bytes do not contain `expectDigestHex`.
- **R19** Never throws.

`TSA_ENDPOINTS → string[]`
- **R20** A compiled constant naming the timestamp authorities to ask, in order (today: DigiCert, Sectigo, `rfc3161.ai.moda`); never read from a call's arguments. A caller must not accept an endpoint named by anything other than this list.

`TSA_CONTENT_TYPE`, `TSA_ACCEPT → strings`
- **R21** The request and accepted response media types for the RFC 3161 exchange (`"application/timestamp-query"`, `"application/timestamp-reply"`).

`ARCHIVE_SAVE_BASE`, `ARCHIVE_SERVICE → strings`
- **R22** `ARCHIVE_SAVE_BASE` is the one compiled URL a locator may be appended to for a save request (`https://web.archive.org/save/`); `ARCHIVE_SERVICE` names the service for the record. Neither is settable by a caller.

`archiveLocatorFrom(res, requested) → string | null`
- **R23** Returns the archived locator (`https://web.archive.org/web/<timestamp>/…`), read in order from `res`'s `content-location` header, its `location` header, or (last) `res.url` itself; `null` when none of the three names one.
- **R24** Never throws.

**The offline signer page (retired)** — the page (`sign-release.html`, `signpage.mjs`, `embed-signpage.mjs`) leaves this module (T51-124; K3807, K3814); BOB moves its files to `control-plane`'s paths at the merge and control-plane's job deletes them with the `/sign` route. Its ids stay retired, never reused:
- **R25** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R30** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R31** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R32** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R42** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R43** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*
- **R44** *(retired: T51, K3814; moved to control-plane, deleted, K3807)*

**The release signer (`bio-plane/scripts/sign-sshsig.mjs`, moved from `tools/` in T19; BOB-5)** — run only on an operator's machine by the release assembler (bundler R23), never imported by the plane or the installer.

`signSshsig(envelope, message, namespace) → string`
- **R33** Returns an armored OpenSSH signature (`-----BEGIN SSH SIGNATURE-----`, base64 wrapped at 70 columns, `-----END SSH SIGNATURE-----` and a newline): a version-1 SSHSIG blob with an `ssh-ed25519` key and signature, `namespace`, an empty reserved field and hash algorithm `sha512`, signing the exact bytes of `message` with the key the envelope's seed gives. Same inputs give the same output (Ed25519 is deterministic). Stock `ssh-keygen -Y verify` and `verifySshsig` (R2) both accept it for that namespace and the key of R35.

`seedFromEnvelope(envelope) → {label, seed}`
- **R34** Accepts exactly `BIOKEY-RAW1.<label>.<base64 of 32 bytes>` (surrounding whitespace ignored), the envelope a release key is held in, and returns the label and the 32-byte seed. Throws `Error` reading `release seed is not a BIOKEY-RAW1 envelope` for any other shape and `release seed is <n> bytes, expected 32` for a seed of another length; `signSshsig` and `signerPublicLine` throw the same.

`signerPublicLine(envelope, comment = "bio-release") → string`, `keyFromSeed(seed)`, `publicFromKey(key)`
- **R35** `signerPublicLine` returns `ssh-ed25519 <base64 wire public key> <comment>`, the line an allowed-signers list or `RELEASE.json`'s `signer` carries for the envelope's key; `keyFromSeed` gives the Ed25519 private key of a 32-byte seed and `publicFromKey` its 32 raw public bytes.
- **R36** Never prints, writes or returns the seed or the private key; the only outputs are the signature and the public line.

**Release keys and the release notice** (T48-3; N1047; K3158; `build/plan/draft-updates.md` §1–2)

`RELEASE_KEYS → string[]`
- **R45** (T48; N1047; K3158) A frozen list, the one place the keys that sign a Civicsmith release are held: the public lines (R35's form, `ssh-ed25519 <base64> <comment>`) of the release key and the recovery key, exactly the two lines the installer's `ARMED_SIGNERS` holds at T48's opening (`installer` R43). A release, a fleet statement and a release notice are each verified against this list: the installer's `ARMED_SIGNERS` and every plane module that verifies one read it from here and hold no copy. Adding or removing a key is a requirement change made in this module alone. Test: each line normalises as R2 reads an allowed key, the two keys differ, and the list is frozen.

`NS_RELEASE_NOTICE → string`
- **R46** (T48; N1047; amends R1) `NS_RELEASE_NOTICE` is `"bio-release-notice"`, a compiled constant distinct from every other namespace (R1's rule), so a signature over a release, a fleet statement or anything else never verifies as a release notice, nor a notice's as any of them.

`releaseNoticeStatement({version, date, manifest, security, notes}) → Uint8Array`
- **R47** (T48; N1047; draft-updates §1) Returns the exact bytes a release notice is signed over: `` `bio-release-notice/1\nversion ${version}\ndate ${date}\nmanifest ${manifest}\nsecurity ${security ? "yes" : "no"}\nnotes ${canonicalJson(notes)}\n` `` (UTF-8; `canonicalJson` is `record-grammar`'s, its R12), so the notes are inside what is signed. `version` is `<n>.<n>.<n>` (each part digits, no leading zero but `0`); `date` a `YYYY-MM-DD` that exists; `manifest` the release manifest's SHA-256, 64 lowercase hex; `security` a boolean; `notes` exactly `{members, administrators, must_do}`, each a string of at most `RELEASE_NOTES_MAX` (8,000) characters, `members` and `administrators` non-empty and `must_do` possibly empty. Anything else throws `Error` reading `REFUSED [NOTICE_FIELD]: <field>` before any byte is built. Same inputs always give byte-identical output; changing any field, a character of the notes included, changes the bytes.

`verifyReleaseNotice(notice, armored, running, allowedKeys = RELEASE_KEYS) → Promise<{ok:true, notice} | {ok:false, reason, ...}>`
- **R48** (T48; N1047; draft-updates §2) `notice` is `{version, date, manifest, security, notes}` as published beside a release; `running` the version the caller runs, R47's form. `ok:true` only when the notice is well formed (R47), `armored` verifies by R2 in `NS_RELEASE_NOTICE` over `releaseNoticeStatement(notice)` against `allowedKeys`, and `notice.version` is higher than `running`, compared part by part as numbers. `notice` in the answer is a frozen copy holding only R47's fields. Otherwise `ok:false` with `reason`: `MALFORMED` (with `field`) for a notice R47 refuses or a `running` not of its form; R3's `NAMESPACE`, `UNKNOWN_KEY`, `BAD_SIGNATURE` or `CRYPTO_UNAVAILABLE`, as `verifySshsig` names them; `NOT_NEWER` (with `version` and `running`) for a correctly signed notice of the running version or an older one, so neither a downgrade nor the replay of an old notice is accepted. The signature is judged before the version. Never throws. Test: a notice signed with a throwaway key in `allowedKeys` is accepted; controls: the same notice with one character of its notes changed is `BAD_SIGNATURE`; an older version correctly signed is `NOT_NEWER`; the same bytes signed in `NS_RELEASE` are `NAMESPACE`; a key outside `allowedKeys` is `UNKNOWN_KEY`.

**The AI catalogue's signed statements** (T53; K5457, K5471; `build/plan/lane-ai-design/draft-signatures.md`; for `ai-catalogue` and `ai-issuer`)

`NS_AI_CATALOGUE`, `NS_AI_ADVISORY` → strings
- **R49** (T53; K5457; AIR33, AD25, SR84; amends R1) `NS_AI_CATALOGUE` is `"bio-ai-catalogue"` and `NS_AI_ADVISORY` `"bio-ai-advisory"`, compiled constants, each distinct from every other namespace (R1's rule, R46), so a signature over a release, a release notice, a fleet statement or anything else never verifies as a catalogue payload or an advisory, nor a catalogue's as any of them. R1's count becomes nine with R55. Test: all namespace constants are pairwise unequal and a signature made in `NS_RELEASE` over a catalogue statement's bytes is `NAMESPACE` through R53; control: the same bytes signed in `NS_AI_CATALOGUE` verify.

`CATALOGUE_KEYS` → string[]
- **R50** (T53; K5457; AIR33, AD25, SR84) A frozen list, the one place the keys that sign the AI catalogue, its advisories and its seal key are held: public lines (R35's form) of the catalogue signing key and the catalogue recovery key, **a list of its own, separate from `RELEASE_KEYS` (R45)**: no line of one is a line of the other, so a release key cannot sign the catalogue nor a catalogue key a release. `ai-catalogue`, `ai-issuer` and the test container verify against this list and hold no copy. Adding or removing a key is a requirement change made in this module alone, after the catalogue key ceremony (BOB's act). Test: each line normalises as R2 reads an allowed key, the lines differ, none equals a `RELEASE_KEYS` line after normalisation, and the list is frozen; control: a list holding a `RELEASE_KEYS` line fails the test, and a signature by a release key over a catalogue statement is `UNKNOWN_KEY` through R53.
- **R58** (T53; K5751, the catalogue key ceremony's sitting 1, 2026-10-28; K5625, K5577 (5); amends R50) **`CATALOGUE_KEYS` holds exactly Bob's two catalogue keys.** Its lines are, in this order and nothing else: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICzjuXnpqLaVYtDu31PbDKjswFWytmmhkU2SsgdkY50J bio-ai-catalogue` (the signing key; SHA256:RpBqiKYcBfY0ZXvLJVJIazLH8TCAgUMTSwbLF6x0qLM) and `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMcDvL37Gr543+bDycYk53h83ZVfCxmIquuIlV+Ptn9c bio-ai-catalogue-recovery` (the recovery key; SHA256:34muQ7LZW9VVCrllKQqOfhHpTkTKJUSugGbQ67J3Klg). No test key is in the list; a test signs with its own throwaway key and passes it as `allowedKeys` (R53, R54, R56), never by adding it to the list. Test: the list equals these two lines (normalised as R2 reads them), each differs from every `RELEASE_KEYS` line, and a statement signed by a throwaway key fails against the default list and verifies with that key passed as `allowedKeys`. Control: a statement signed by a release key fails against `CATALOGUE_KEYS`.

`aiCatalogueStatement({seq, schema_version, issued_at, sha256, bytes})` → Uint8Array
- **R51** (T53; K5457; AIR33, AD25) Returns exactly `` `bio-ai-catalogue/1\nseq ${seq}\nschema ${schema_version}\nissued ${issued_at}\nsha256 ${sha256}\nbytes ${bytes}\n` `` (UTF-8). It throws `Error` reading `REFUSED [AI_STATEMENT_FIELD]: <field>` before any byte is built when `seq`, `schema_version` or `bytes` is not a whole number of at least 1, `issued_at` is not an existing UTC instant `YYYY-MM-DDTHH:MM:SSZ`, or `sha256` is not 64 lowercase hex. Its leading token differs from every other statement's (R5, R6, R38, R40, R41, R47), so no catalogue payload and no other signed statement can be the same signed bytes. Same inputs always give byte-identical output; changing any field changes the bytes. Test: the exact bytes for a fixture; control: `seq: 0` and an uppercase `sha256` are each refused naming the field, and one changed field changes the bytes.

`aiAdvisoryStatement(advisory)` → Uint8Array
- **R52** (T53; K5457; AIR24, AIR33) `advisory` is `{seq, target, kind, reason, effective_at, issued_at}` with `target` exactly `{entry_id}` or `{plan_id}`. Returns exactly `` `bio-ai-advisory/1\nseq ${seq}\ntarget ${entry|plan} ${id}\nkind ${kind}\nreason ${reason}\neffective ${effective_at}\nissued ${issued_at}\n` ``, so every field is signed. It throws `REFUSED [AI_STATEMENT_FIELD]: <field>` when `seq` is not a whole number of at least 1, `target` is neither shape or its id is not a lowercase `[a-z0-9._:-]` token, `kind` or `reason` is not a lowercase `[a-z_]` token, or an instant is not R51's form. The closed lists of kinds and reasons are `ai-catalogue`'s (its R26, `ADVISORY_REASONS`); this module checks the shape only, being in a lower layer. Leading token distinct as R51's. Test: exact bytes for a fixture with an `entry_id` target and with a `plan_id` target; control: a target holding both ids is refused, and changing `reason` changes the bytes.

`verifyAiCatalogue(statement, armored, heldSeq, allowedKeys = CATALOGUE_KEYS)`, `verifyAiAdvisory(advisory, armored, heldSeq, allowedKeys = CATALOGUE_KEYS)` → Promise
- **R53** (T53; K5457; AIR33, AD25) `ok:true` only when the fields are well formed (R51, R52), `armored` verifies by R2 in `NS_AI_CATALOGUE` (payload) or `NS_AI_ADVISORY` (advisory) over the statement's bytes against `allowedKeys`, and `seq` is higher than `heldSeq` (a whole number of at least 0; 0 when none is held). The answer's `statement` is a frozen copy of the fields. Otherwise `ok:false` with `reason`: `MALFORMED` (with `field`), R3's `NAMESPACE`, `UNKNOWN_KEY`, `BAD_SIGNATURE`, `CRYPTO_UNAVAILABLE` as `verifySshsig` names them, or `NOT_NEWER` (with `seq` and `heldSeq`) for a correctly signed statement at or below `heldSeq`, so a replayed old payload or advisory is not accepted. The signature is judged before `seq`. Never throws. Test: a payload statement and an advisory each signed with a throwaway key in `allowedKeys` are accepted; controls: one changed digit of `sha256` is `BAD_SIGNATURE`; the same bytes signed in `NS_RELEASE`, or in the other of the two new namespaces, are `NAMESPACE`; a key outside `allowedKeys` is `UNKNOWN_KEY`; `seq` equal to `heldSeq` is `NOT_NEWER`.

`aiSealKeyStatement({key_id, public_key, not_before, not_after, seq})` → Uint8Array, `verifyAiSealKey(doc, armored, allowedKeys = CATALOGUE_KEYS)`
- **R54** (T53; K5457; SR62, SR84) The seal-key document of `ai-issuer` R8 is signed in `NS_AI_CATALOGUE` over exactly `` `bio-ai-seal-key/1\nkey_id ${key_id}\npublic ${public_key}\nnot_before ${not_before}\nnot_after ${not_after}\nseq ${seq}\n` `` (`key_id` a lowercase `[a-z0-9._:-]` token; `public_key` the base64 of a 32-byte public key; instants R51's form; `seq` a whole number of at least 1; else `REFUSED [AI_STATEMENT_FIELD]: <field>`). Its leading token differs from R51's and R52's, so a payload and a seal key are never the same signed bytes. `verifyAiSealKey` answers `ok:true` with a frozen copy when well formed and verified by R2 against `allowedKeys`, else `ok:false` with R53's reasons except `NOT_NEWER`; validity at an instant is the caller's. A container verifies the key it seals to with this, so an address swapped by an attacker is `UNKNOWN_KEY`. Never throws. Test: a seal-key document signed by a throwaway key in the list is accepted; control: a changed `public_key` is `BAD_SIGNATURE`, a payload's signature over the same fields is `BAD_SIGNATURE`, and a key outside the list is `UNKNOWN_KEY`.

`NS_AI_RUN` → string, `runBundleStatement(manifestBytes, payloadSha256)` → Uint8Array (the test container's run key)
- **R55** (T53; K5457; SR60, SR61, AD8; amends R1) `NS_AI_RUN` is `"bio-ai-run"`, a compiled constant distinct from every other namespace (R1's rule; R49). `runBundleStatement` returns exactly `` `bio-ai-run/1\nmanifest ${H(manifestBytes)}\npayload ${payloadSha256}\n` `` where `H` is SHA-256 in lowercase hex of the exact manifest bytes and `payloadSha256` is 64 lowercase hex (else `REFUSED [AI_STATEMENT_FIELD]: payloadSha256`; `manifestBytes` a `Uint8Array` else `REFUSED [AI_STATEMENT_FIELD]: manifestBytes`). A manifest or payload changed by one byte changes the statement. Test: exact bytes for a fixture; control: the same manifest with one character changed gives different bytes, and `payloadSha256` in uppercase is refused.

`verifyRunBundle({manifestBytes, payloadSha256, armored, runPublicKey})` → Promise
- **R56** (T53; K5457; SR60, SR61, AD8) The check `ai-issuer` R12 makes of a test container's bundle. `ok:true` only when `armored` verifies by R2 in `NS_AI_RUN` over `runBundleStatement(manifestBytes, payloadSha256)` against `[runPublicKey]`, the one public key (R35's form, or bare base64) the challenge was issued against; so only the container that holds the matching private run key can have signed. Otherwise `ok:false` with R3's `MALFORMED`, `NAMESPACE`, `UNKNOWN_KEY` (a different run key signed), `BAD_SIGNATURE` or `CRYPTO_UNAVAILABLE`; a malformed `runPublicKey` is `MALFORMED` with `field`. It holds no key and no record. Never throws. Test: a bundle signed with a throwaway run key verifies against that key; controls: one changed manifest character is `BAD_SIGNATURE`, a second throwaway key signing is `UNKNOWN_KEY`, the same bytes signed in `NS_AI_CATALOGUE` are `NAMESPACE`.

### Errors

Stated per service above. `verifySshsig`, `verifyReleaseNotice`, `parseTimestampResponse` and `archiveLocatorFrom` never throw and always name a `reason` for a "no". `fleetStatement` throws (never partially renders) on an unstated compat date, flags list or part type; every other service throws only on malformed input it cannot make sense of (`verifySshsig`'s inner parse failures are caught and returned as `MALFORMED`, never thrown).

## Private

### Uses

- `record-grammar`: the id grammar (`ID_TABLE`, `idPattern`; its R46, R47) for R38 and R40 (T33-7; a new edge, P4 holding: `record-grammar` is first in layer 1); `canonicalJson` (its R12) for R47 (T48).

Otherwise every export is built from Web platform primitives (`crypto.subtle`, `atob`/`btoa`, `TextEncoder`/`TextDecoder`) and literal data. The release signer (R33–R36) alone uses Node's `node:crypto`, which is why it never ships in the plane or the installer.
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R26** Pure and offline: no store, no network fetch, no clock. `verifySshsig`, `timestampRequest` and `parseTimestampResponse` make no request themselves; the endpoints they hand a caller (R20, R22) are compiled constants a caller cannot override from a request body, and `archiveLocatorFrom` only reads a `Response` the caller already fetched.
- **R27** No place is named in this module: no jurisdiction, city or county appears in any string it exports. Its tests need no jurisdiction profile.
- **R28** A signature verified for one namespace (R1) or over one message (R2, R5–R7, R41) never verifies for a different namespace or a different message; a tampered message or signature is always `BAD_SIGNATURE`, never silently accepted.
- **R29** Every "no" this module returns names which kind of no (`reason` in R3, R18; `null` with no reason only where the interface documents `null` as the whole answer, R23).
- (T53; K5457) R26–R29 hold for R49–R56 unchanged: pure and offline, no place named, a signature never verifies in another namespace or over another message, every "no" names its kind. No new dependency: `record-grammar` and Web platform primitives as above.

### Satisfies

- `BIO_Distribution_v0_1.md` §3 ("The release") and §4 ("The fleet") — the release object, its two-key/three-namespace scheme, and the fleet statement one signature must cover as a set.
- `BIO_Intake_Doctrine_v1_1.md` §3 — trusted timestamps as the co-attestation a group cannot fabricate for itself, and the public archive as the opt-in second kind of co-attestation.
- `BIO_Publication_v0_1.md` §5D ("Who acts, and signing": the manager signs a public docket entry with their registered key; R39, R40; DEC-116).
- `build/layers.md`, "No jurisdiction in the product" (R27).
- Bob's K3158 and `build/plan/draft-updates.md` §1–2: a signed release notice whose notes are inside what is signed, verified against the keys the running version carries, with no downgrade or replay (R45–R48).
- K5457, K5471 (AI-DESIGN, AIR33, AD25, SR60–SR62, SR84, AD8; `draft-ai-catalogue.md` R33, R35, R39; `draft-ai-issuer.md` R3, R4, R8, R12): the AI catalogue, its advisories and its seal key are signed with a key list of their own, and a test container's bundle is signed with its run key (R49–R56).

### Suggestions

- **Checks.** Check C-18.8 (the gate's release-signature check, `bio-checks.mjs` "Release-signature primitives") still holds a second, hand-written SSHSIG/Ed25519 verifier. K10 (entry N8) replaces it with a call to `verifySshsig`: the Apps Script runtime that justified it is decommissioned. This module takes on no check-derived invariant.
- **For callers.** `verifySshsig`'s `allowedKeys` and SSHSIG's own embedded key together are the only source of truth for who signed; a caller must supply the actual `ARMED_SIGNERS`/registry list, never a caller-asserted one. `fleetStatement`'s per-member `services` and `parts` fields are signed as the caller supplies them (R10); nothing in this module checks them against reality — that a member's declared parts match what was actually uploaded is the caller's obligation.
- **Release notices (T48).** `instance-setup`'s daily check (T48-62) calls `verifyReleaseNotice` with no `allowedKeys`, so `RELEASE_KEYS` decides; the installer re-points `ARMED_SIGNERS` to `RELEASE_KEYS` in its own job (T48-79), and `bundler` writes the notice through R47 (T48-4). Text-only rendering and the notes' cap on display are the caller's; R47's cap bounds what is signed. A key rotation (Distribution §10) edits R45's list.
- **The signing page leaves (T51-124; K3814).** The job removes the page's tests' imports of `signpage.mjs` and `sign-release.html` from `signatures.test.mjs`, `release-signer.test.mjs` and `signer-keys.test.mjs` (they mix the page's tests with `sshsig`'s), and keeps every test of `sshsig.mjs`, `tsa.mjs` and `sign-sshsig.mjs`; it edits none of the page's files. R34's envelope format `BIOKEY-RAW1.` is the release signer's input, whoever mints it.
- **The release signer (BOB-5).** The job moves `tools/sign-sshsig.mjs` beside `sshsig.mjs` (a script directory, not `src/`, so no bundle reaches it), re-points the assembler's import (bundler's file, `uses`), and re-points `sshsig.mjs`:229's note naming `tools/release-assemble.mjs`. R33's test signs with a throwaway seed and verifies with `verifySshsig` and, where present, stock `ssh-keygen`.
- **Callers (R49–R56).** `ai-catalogue` calls R53 with `heldSeq` the highest it holds; `ai-issuer` calls R53 with its highest published `seq`, R54 when it publishes the seal key, R56 on every bundle (the nonce lookup gives `runPublicKey`); the test container calls R54 before sealing. None holds a key list of its own. Tests use throwaway keys only, one negative control per line, as R48's test does. `CATALOGUE_KEYS` lines were written at the catalogue key ceremony's sitting 1 (K5751) and hold Bob's two keys (R58); no test depends on them.
- **R57** (T53; K5625; K2922, K2277, K5457, K5577 (5); Distribution §10) `catalogue-keys.html`, one self-contained offline page Bob opens from a downloaded file, never served by the plane (control-plane R109): it calls no network API; with WebCrypto Ed25519 it makes the catalogue signing key and the catalogue recovery key (labels `bio-ai-catalogue` and `bio-ai-catalogue-recovery`), each shown in R34's passphrase-protected form with its R35 public line; it loads a saved key with its passphrase and shows that key's public line; it copies the two public lines together; and it signs an R51 statement only, in `NS_AI_CATALOGUE`, after showing its fields in words. Tests at its interface: keys it makes load by R34 and their lines read by R35; a seed signature it makes verifies by R53 against its line and by the stock `ssh-keygen -Y verify`; a text that is not an R51 statement is refused; the page never calls `fetch`, `XMLHttpRequest`, `WebSocket` or `navigator.sendBeacon`.
