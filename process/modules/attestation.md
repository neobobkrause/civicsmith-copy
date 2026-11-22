Length: 81 lines. Last section: "Suggestions".

# attestation: requirements

Next number: 11

| old (`provenance`) | new | |
|---|---|---|
| R31 | R1 | `attest`: the capture asked about |
| R32 | R2 | the RFC 3161 token |
| R33 | R3 | the co-archive |
| R34 | R4 | the instance's signed receipt |
| R56 | R5 | `instanceStatement`, `instanceSign`, `instanceKeys` |
| R57 | R6 | `instanceKeyBound` (met at T24) |
| R49 | R7 | `attestationsOf` |
| R39 | R8 | invariant: the only network calls |
| R40 | R9 | invariant: no place (a copy; `provenance` keeps R40) |
| — | R10 | invariant: owns `receipt_keys`, `signed_receipts` (new wording, BOB's) |

**Size (P6).** About 421 lines of `provenance`'s code move here (`build/plan/draft-T25-splits.md` P-2): from `index.mjs`, `attest` and `attestStatus` with their header (674–825), `RECEIPT_KIND`, `STATEMENT_KIND`, `instanceStatement` and `noKey` (850–870), `attestationsOf` (1318–1373), and the R34/R56 block (`receiptStatement`, `#key`, `#signWith`, `signReceipt`, `instanceSign`, `instanceKeyBound`, `instanceKeys`, `signedReceipts`, and the `signingKey` constructor option; 1566–1671); C-89 `ATTEST_CHECKS` from `checks.mjs` (146–168); `receipt_keys` and `signed_receipts` from `schema.mjs` (197–215); `attestOp` from `ops.mjs` (84–115). The tests are `test/m/provenance/attest.test.mjs` (240), `instance-key.test.mjs` (159) and the R31/R32 case of `ops.test.mjs` (53–98). Well under 4,000.

## Public

### Purpose

Co-attestation and the instance's own key. It asks the timestamp authorities `signatures` names for a trusted timestamp over a capture's hash, and on request a co-archive of its locator. It answers every attestation the record holds for a capture. It holds the instance's signing key, which signs this instance's receipt for an archive-sourced capture and the statements later modules ask it to sign. A timestamp proves that the bytes existed at an instant. It never proves where they came from, and never the credibility of their content.

### Provides

Terms. A **capture**, its **home** and the **register** are `provenance`'s (its Provides, Terms; R1, R4). Every refusal names a `reason`; a refusal with a catalogue row also carries its `check` id and `translation`.

**attest({sha256, archive, locator}, {head, put, fetch}) → `{ok, attempts, archive?, attestation?, held?, note}` or refusal**
- **R1** [met] `sha256` must be 64 hex (`BAD_SHA`). When no object is held under it: an acquisition receipt naming it lets the attestation proceed, answering `held: {form: "parts", on: "acquisition_receipt"}`; a register row alone is refused `CAPTURE_HELD_IN_PARTS` (C-89.1), which does not call the bytes missing; neither is `NO_SUCH_CAPTURE`, saying what was asked, and whether the store could be asked.
- **R2** [met] Asks the timestamp authorities in `signatures.TSA_ENDPOINTS` order, each with a fresh RFC 3161 request over the digest, and stops at the first response `parseTimestampResponse` accepts as bound to it. The token is stored in the evidence store under its own SHA-256 and named `snapshots/timestamp-<first 12 hex>.tsr`, `kind: "rfc3161"`, `over` the capture. Every attempt, failed or not, is in `attempts` with its service, instant and outcome. No token answers `ok: false`, `reason: "NO_ATTESTATION"`. The token's signature is not verified here, and the answer says so.
- **R3** [met] With `archive: true` and a public https `locator`, also asks the co-archive (`signatures.ARCHIVE_SAVE_BASE`) and records the archived locator from `archiveLocatorFrom`, or the failed attempt. Without it, no archive is asked.
- **R4** [met] When this instance files an archive-sourced capture, it signs its own receipt: that on this date it fetched these bytes from this retrieval locator and they hashed to this value. The signing key is the instance's own, one per instance, held as a secret and replaceable by the operator; a receipt signed before a replacement stays verifiable against the public key it was signed with (Bob, K59).
- Errors: never throws for a well-formed call; an authority or archive failure is an attempt, never a throw.

**instanceStatement(kind, sha), instanceSign(statement), instanceKeys(), instanceKeyBound()** (the instance key of R4, for later modules: `network-notices` R1, R13, R21)
- **R5** [met] (DEC-111, K1031 (2)) The instance key of R4 also signs statements for later modules. - `instanceStatement(kind, sha)` returns exactly `` `${kind}\nsha256: ${sha}\n` ``. It throws when `kind` is `bio-receipt/1`, or is not of the form `^[a-z][a-z0-9-]*/[0-9]+$`, so no statement can be read as a receipt. - `instanceSign(statement)` answers `{ok, signature, key_id, public_key}`, or `RECEIPT_NO_KEY` when no key is bound. It records the key in `receipt_keys`. - `instanceKeys()` answers every key that has signed anything, each with its `first_used`, never the private part.
- **R6** [met] (N504) `instanceKeyBound()` answers `true` when an instance key is bound (so `instanceSign` would sign), and `false` otherwise, a key that cannot be read included. It signs nothing and writes nothing: `receipt_keys`, and every key's `first_used`, are unchanged by it. Never throws.

**attestationsOf(captureSha) → `{sha256, registered, attestations: [{kind, service?, locator?, at?, file?, token_sha?, bundle, path}], undetermined?, note}` or refusal**
- **R7** [met] Answers every attestation recorded for the capture, from each document entry that registers it (the register, provenance R48), in the entry's order: its `timestamp` (daemon era), each `attestations[]` entry of kind `rfc3161` (R2's token, as `op=attest`'s answer is recorded: `kind: "rfc3161"`, its service, the token's file and SHA-256), and its `co_archive` (R3's archived locator, a string or `{service, locator}`, `kind: "co_archive"`), as the entry states them (C-18), each naming the bundle and path it is recorded in; `at` is the matching attempt's instant where one is recorded. The answer also states `registered`, and `undetermined` with why when no register row names the capture under an existing bundle (a capture registered only by its parts) or the home's register cannot be read; `attestations: []` alone means none is recorded. A read over what `attest` and promotion already write: it asks no authority and verifies no token's signature, and its `note` says so. `BAD_SHA` for a digest not 64 hex. It is the read `filings` R9's exhibits use. (N688; K1852 (1)) A capture cut out of a captured archive (one whose register entry's document states `capture.method: "unpacked"` with a `container` block, `provenance` R42) also answers the archive's attestations: this read applied to `container.archive_sha256`, recursively when that archive is itself cut out of another, through at most `ARCHIVE_DEPTH_MAX` archives (`ooxml` R30). Each is answered as the archive's entry states it, with `inherited: {from, through}`: `from` the digest of the archive whose entry records it, and `through` the entry indexes (`container.index`) from that archive down to this capture, outermost first. The capture's own attestations, if any, carry no `inherited`, and an attestation is never answered without saying whose it is. A chain past the bound, or an archive whose home's register cannot be read, is stated in `undetermined` beside whatever was read. `note` also says that an inherited token proves the archive existed at its instant, and so every byte cut out of it.

## Private

### Uses

- `record-grammar`: `isPublicHttpsLocator` (R3).
- `signatures`: `timestampRequest`, `parseTimestampResponse`, `TSA_ENDPOINTS`, `TSA_CONTENT_TYPE`, `TSA_ACCEPT` (R2), `ARCHIVE_SAVE_BASE`, `ARCHIVE_SERVICE`, `archiveLocatorFrom` (R3).
- `record-core`: the evidence store (`head`, `put` by digest with integrity; its R38) for R1 and R2; `readFile` (its R13; the home's `data/provenance.json`, R7); `declarePurge` (`receipt_keys`, purge-exempt, and `signed_receipts`, keyless, as `provenance` declared them).
- `provenance`: `registerHolds` (its R5; R1's receipt and register question); `homeOf` (its R4) and the register's read contract (its R48), for R7; the C-103 rows `RECEIPT_MALFORMED` (C-103.6) and `RECEIPT_NO_KEY` (C-103.7) through `PROVENANCE_ACT_CHECKS` (its R58, the seam), for R4 and R5.
- `ooxml`: `ARCHIVE_DEPTH_MAX` (its R30), the bound on R7's inheritance (N688; a `modules.json` edge, BOB's, at T35-19's START).
- `membership`, `credentials`, `promotion`, `test-support`: only the test world (`provenance`'s fixture, which this module's tests share), no service.

### Invariants

- **R8** [met] Network calls are made only by `attest`, only to the compiled endpoints `signatures` names.
- **R9** [met] No place is named in this module's behaviour or outward text (`layers.md`, "No jurisdiction in the product").
- **R10** [met] This module owns `receipt_keys` and `signed_receipts`; no other module writes them. (K1218: BOB's wording)

### Satisfies

- `docs/architecture/BIO_Intake_Doctrine_v1_1.md` §3 (co-attestation by trusted timestamp and co-archive), §3b (SHA-256, RFC 3161, plain JSON), §8 (what attest may claim; a capture held in parts).
- `docs/architecture/BIO_State_Rules_Consistency_v1_5.md` §4.1 (the daemon-era anatomy of `timestamp` and `co_archive`, read by R7).
- `docs/development/ARCHIVE-FALLBACK.md` §Shape on the capture (the instance's signed receipt, R4).
- Rulings: K59 (the instance key), K171 (`attestationsOf` for `filings`), DEC-111 and K1031 (statements for later modules), D-530 (a whole-hash miss is not absence, R1).
- `docs/architecture/BIO_Intake_Doctrine_v1_1.md` §3, "Members of a captured archive" (K1852 (1): a file carries its archive's co-attestation unchanged; R7).

(Copied from `provenance`'s Satisfies: the share R1–R8 serve. `provenance` keeps its own lines.)

### Suggestions

- **Checks carried here.** C-89.1 (`ATTEST_CHECKS`) moves with this module, its `where` re-pointed to this module's file (the census pins `where`, so its row is `awaiting stamp` until T26's L2, accepted red 6). C-103.6 and C-103.7 stay in `provenance`'s `PROVENANCE_ACT_CHECKS` and are imported, with only their `where` re-pointed, so one family is not split between two files (`draft-T25-splits.md` P-2 risks; decision 6, BOB's).
- **The key.** The `signingKey` constructor option moves with R4: the composition root hands it in from `env.RECEIPT_SIGNING_KEY` (`plane/store.mjs`:99 today, plane's L11 job). `signReceipt`, `receiptStatement` and `signedReceipts` are R4's services. `acquisition` reaches `signReceipt` through the instance the composition hands it in `cap` (`acquisition/index.mjs`:1025).
- **`attestOp`** (the `op=attest` arm, `ops.mjs` 84–115) moves here. `attest` takes `holds(sha)` beside `head`, `put` and `fetch`, answered by `provenance.registerHolds`.
- **Private helpers.** `hexOf`, `b64`, `unb64`, `bareSha`, `safeJson` and `isObj` are one-liners: copy them, or take them from `record-grammar` where it exports an equivalent.
- **Option B (BOB #100's review 1, as K1220 reads it).** Until each importer re-points, `provenance` keeps a pure copy of `instanceStatement` (network-notices, L8), and no copy of `ATTEST_CHECKS` (K1225), deleted in `provenance`'s T26 job (N516). No stateful method is kept: `attest`, `attestOp`, `signReceipt`, `instanceSign`, `instanceKeys`, `instanceKeyBound` and `attestationsOf` are this module's alone from T25's L3 merge, and it owns `receipt_keys` and `signed_receipts` and every write to them (R10; K1220). Their callers' reds stand (accepted red 7).
- Tests: `attest.test.mjs`, `instance-key.test.mjs` and the R31/R32 case of `ops.test.mjs` move to `test/m/attestation/`. Their R-id citations are re-pointed by the map above, and their assertions do not change.
- **T35 (T35-19).** R7's inheritance reads only what the register already holds (each member's `container` block, `provenance` R42); it asks no authority, and `attest` (R1) is never called for a cut-out file, since the archive's token already covers it (`acquisition` R20, as amended). R7's existing answer for a capture with no `unpacked` document is unchanged. The entry's nine DEC-149 strings (`checks.mjs`:26, :27, :29 (C-89.1); `index.mjs`:107, :117, :124, :201, :239; `ops.mjs`:28) are applied with a test naming each (plan rule 4; `build/plan/draft-T35-dec149-l1-l7.md`), and change no requirement.
