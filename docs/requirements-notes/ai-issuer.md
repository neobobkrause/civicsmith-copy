# ai-issuer: notes from its first job (T53, layer 11)

For BOB and the next job on `ai-issuer`. What the job decided where `build/requirements/ai-issuer.md` left a choice,
and what it found that is not this module's to fix.

## Choices made here

- **Shape.** One Worker (`ai-issuer/src/index.mjs`), one SQLite-backed Durable Object `IssuerStore` (`store.mjs`)
  reached by RPC, and two R2 buckets: `DOCS` (the public documents, served by the Worker without the store, R1, R20)
  and `BLOBS` (sealed payloads, opaque). A document's row, its bytes and the rebuilt index are written together; a
  failure after the row takes the row back (R3's atomicity).
- **Refusal rows.** This module's family is C-158 (answer-envelope R19 names it the next free one). The five codes
  ai-catalogue owns answer with ai-catalogue's C-156 rows; signatures' reasons (`BAD_SIGNATURE`, `UNKNOWN_KEY`,
  `MALFORMED`, `NAMESPACE`) pass through without a row. The issuer is not in the plane, so C-158 is not registered in
  answer-envelope's `CHECK_FAMILY_FILES`.
- **Manifest schema (R12, R14).** ai-gate's `MANIFEST_KEYS` plus the two consent fields R14 names, `agree_named` and
  `declared_team`. A field outside it is `rejected`, `BUNDLE_UNREADABLE`, naming the field. The sealed payload's hash
  is checked through the run signature (signatures' `runBundleStatement` covers it); the manifest itself carries no
  sealed-payload hash.
- **Which failures are kept.** `rejected` (not stored): too large, unreadable, unknown nonce, reused nonce, a field
  outside the schema. `unverified` (kept for the operator, no result): expired nonce, digest mismatch, bad signature,
  another run key.
- **R7's decision mapping.** A narrowing advisory with reason `other`, or any widening `clear`, needs the target's
  latest decision to be the matching act (`watch` → `hold`, `lapse` → `lapse`, `retire` → `retire`, `clear` →
  `clear`) and to name the same ruling as the advisory's `ruling_ref`.
- **Health's daily cap (R26).** Counted on one aggregate row per report day (`entry_id` `*`, `reports` only), so no
  row per report exists.
- **Name withdrawal (R17).** `withdrawName` removes the name from the stored manifest itself, so nothing of it stays.
- **Parameters.** `NONCE_OUTSTANDING_MAX` 200, `NONCE_DAILY_MAX` 100, `BUNDLE_MAX_BYTES` 32 MiB and
  `HEALTH_DAILY_MAX` 20,000 are starting figures, not the first runs' (the file says "set at START from the first
  runs"); each can be set per deployment as a plain variable of the same name.
- **Operator credential.** Held only as its SHA-256, the secret `OPERATOR_CREDENTIAL_SHA256`; presented as a bearer.
- **Request logs.** `observability` is off in `wrangler.jsonc`, so a public GET or a result lookup leaves no log
  record either (R2, R25).

## Found, not this module's

- **The index address differs.** `ai-catalogue`'s `CATALOGUE_ADDRESS` is
  `https://ai-issuer.believeinoakland.workers.dev/catalogue/index.json`; R1 here serves `/ai/index.json`, with payloads
  at `/ai/catalogue/<seq>.json`. A copy pulling from today's address gets 404. One of the two files changes; the
  index's relative paths (`catalogue/<seq>.json`) work under `/ai/` as R1 states them.
- **Health's error classes.** R26 sums "each error class" of `ai-use` R33's report, but `ai-use` is not among this
  module's uses in `build/modules.json`, so its `HEALTH_ERROR_CLASSES` and `HEALTH_DAYS_MAX` are not imported:
  classes are accepted as lower-case words (at most 32) and `HEALTH_DAYS_MAX` is held as 7. Adding the edge would let
  both be read from `ai-use`.
- **Bucket and Worker names** (`ai-issuer`, `ai-issuer-documents`, `ai-issuer-bundles`) are not `p3dev-` names; the
  deploy is BOB's, with Bob's approval, and may rename them.
- **Bundle size.** The Worker bundles to about 5.6 MB (1.2 MB gzipped), mostly the word table reached through
  ai-gate's `bundle.mjs` and `verdict.mjs`.
