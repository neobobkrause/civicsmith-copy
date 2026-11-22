Length: 110 lines. Last section: "Suggestions".

# provenance-routes: requirements

Next number: 14

For R8, the words "part of it on the same terms" are spelled out as those terms, because "it" (the register's contract) stays in `provenance`. R13 is a copy of `provenance` R40, stated in both modules. `provenance` retires R19–R23, R36 and R54 as moved, never reusing them, and re-words R37, R41, R48, R53 and R55. Every moved requirement was met in `provenance`; each is marked not yet met (T25) here, the move itself being T25's L3 job (accepted red 3). The route side moves whole in T25 (K1220, superseding decision 1 of BOB's review of these drafts): this module provides R1–R13 in T25 and owns `provenance_route_marks` and every write to it, the three route arms (R9), `routeMarks` (R10), R11 and R12; `provenance` keeps only pure copies of the names a later layer imports by name until each importer re-points (option B as K1220 reads it). Layer 3, directly after `attestation` and before `capture-sources` (provenance, attestation, provenance-routes). For BOB's review and Bob's approval (a product module, P17); the text is the text Bob's rulings (DEC-19, DEC-56, REC-158, K509 (3)) and BOB's (K763, K671) already settled.

| old (`provenance`) | new | |
|---|---|---|
| R19 | R1 | `chainFromEvidence` |
| R20 | R2 | `provenanceChainRebuild` |
| R21 | R3 | a named member's act |
| R22 | R4 | `provenanceRouteAssess` |
| R23 | R5 | `routeFinding`, `provenanceRoutesMarked` |
| R54 | R6 | the audit's `route` finding (record-core R68) |
| R36 | R7 | invariant: no hop from a request (moved whole; confirm at the job, splits draft) |
| R48, last sentence | R8 | `provenance_route_marks`' read contract |
| R53, three of nine arms | R9 | `provenanceRouteOps` |
| R55, `routeMarks` | R10 | the figure |
| R37, "a route that cannot be shown" | R11 | invariant |
| R41, `provenance_route_marks` | R12 | invariant |
| R40 | R13 | invariant: no place (a copy; `provenance` keeps R40) |

**Size (P6).** About 1,053 lines of `provenance`'s code move here (`build/plan/draft-T25-splits.md` P-1):
- from `index.mjs`: `OBSERVATION_MEANS` and `FINDING_MEANS` (69–87); the chain and route-finding section (126–429); `rowUnlessStated` (532–543); and the methods `provenanceChainRebuild`, `#latestRouteMark`, `routeOf`, `routeTally`, `provenanceRouteAssess` and `provenanceRoutesMarked` (1835–2013, 2027–2387);
- C-34 `ROUTE_MARK_CHECKS` from `checks.mjs` (73–145);
- `provenance_route_marks` from `schema.mjs` (87–183);
- three arms of `ops.mjs` (54–61).

The tests are `chain-route.test.mjs` (282) and `convert-chain-marker.test.mjs` (263), together with:
- the R54 cases of `audit-figures.test.mjs`, the `routeMarks` half of its R55 case and its R48 route-marks case;
- the case at `ops.test.mjs`:154.

Well under 4,000.

## Public

### Purpose

Each document's chain of hops, reconstructed only from fields the record already holds. A member's assessment of whether an information bundle's route can be shown (the route marker), with its finding on the audit, its figure, and its ops. A hop attests bytes, address and time, never the credibility of the content.

### Provides

Terms. A **capture**, its **home** and the **register** are `provenance`'s (its Provides, Terms). A **viewer** and **sight** are `membership`'s (R43, R44). Every refusal names a `reason`; a refusal with a catalogue row also carries its `check` id and `translation`.

**chainFromEvidence(doc, {instanceName, at}) → `{ok: true, hops}` | `{ok: false, missing}`**
- **R1** [met] Pure. Reconstructs a provenance document's chain from fields it already holds, never from anything else: a document received through the doorbell (`origin.kind` `doorbell`, provenance R51) is never a fetched route; its one hop, when its chain is missing, is read from the knock's receipt it states (`source.receipt`: "these bytes were received for knock:<knock_id> at <received>", `via: "doorbell"`), else it is `undetermined` with `source.receipt` missing. A document brought in by an upload (`origin.kind` `upload`, provenance R63) is never a fetched route either; its one hop, when its chain is missing, is read from the upload's receipt it states (`source.receipt`: "these bytes were received for upload:<sha256> at <received>", `via: "upload"`), else it is `undetermined` with `source.receipt` missing; the member's `origin_statement` is never read into a hop (K2459). Otherwise a fetched route (non-empty `locator` other than `in hand`, `retrieved`, `capture.method`) gives one hop by this instance, asserting "these bytes were served for <locator> at <retrieved>", `via: "direct"`; otherwise a named custodian (`custody.holder`, `custody.obtained`) gives one hop by that member, `via: "member"`. Every hop is `bound: false` and carries `reconstructed: {at, by, basis, from}` naming the fields it was read from. A recorded RFC 3161 timestamp is cited as evidence for the bytes and the instant, never as binding the address. Otherwise `missing` lists each absent field.
- Errors: never throws.

**provenanceChainRebuild({bundleId, apply, author, viewer}) → report or refusal**
- **R2** [met] For a bundle the viewer may see, reports per register document `already_recorded`, `reconstructed` (R1) or `undetermined` with what is missing. With any `undetermined` document it writes nothing and answers `EVIDENCE_INSUFFICIENT` with the bundle's route finding (R4). With `apply` and at least one reconstruction, it promotes the bundle once with only `data/provenance.json` changed (every other file carried byte for byte, the bundle's type, group, state, dates and criticality unchanged, a document's own stated values never relabelled from the row) and answers `applied: true`. Refusals: `NO_AUTHOR`, `NO_BUNDLE`, `NO_SUCH_BUNDLE` (absent and unseen answer alike), `NO_REGISTER`, `UNPARSABLE_REGISTER`, `NO_DOCUMENTS`; a promotion's refusal is returned as it came.
- **R3** [met] Reconstructing a chain is a named member's act: an author that is a machine identity (`isMachineIdentity`) is refused by name before anything is read.
- Errors: never throws.

**provenanceRouteAssess({bundleId, author, viewer}) → `{ok, bundleId, appended, route, documents, detail}` or refusal; routeFinding(objectType, mark) → finding; provenanceRoutesMarked({after, limit, viewer}) → page**
- **R4** [met] A member's assessment of whether an information bundle's route can be shown. Refusals: `ROUTE_MARK_NO_AUTHOR` (C-34.1; REC-158 as R3), `ROUTE_MARK_NO_BUNDLE` (C-34.2), `ROUTE_MARK_NO_SUCH_BUNDLE` (C-34.3, absent and unseen alike), `ROUTE_MARK_NOT_A_DOCUMENT` (C-34.4). The register's state (`readable`, `absent`, `unparsable`, `no_documents`, `empty`) is recorded, never refused. Each document is `recorded`, `derivable` (R1) or `undetermined`; the finding is `LOOKED_INDETERMINATE` when the register is not readable or any document is undetermined, else `PRESENT`. A mark is appended (next `seq`, by, at, the bundle's state at that moment) only when it differs from the latest; the bundle's state and bytes never move.
- **R5** [met] `routeFinding` reads the latest mark: `NEVER_LOOKED` when there is none, stated as the question never asked, never as a finding; not applicable to a bundle that is not information. `provenanceRoutesMarked` pages the bundles whose standing mark is `LOOKED_INDETERMINATE`, in id order after `after`, `limit` default 50, at most 200, `truncated` from reading one past the page, `cursor` the last id read; bundles the viewer may not see are withheld and counted nowhere. It adds a census over the visible information bundles (`documents_visible`, `assessed`, `never_assessed`, `standing` by finding, `marked`), `complete` exactly when none is never assessed, and when the page is empty a `cause` of `no_documents_visible`, `never_assessed`, `none_standing` or `page_exhausted`.
- Errors: never throws.

**The route marks' read contract** (K72)
- **R8** [met] The table `provenance_route_marks` (its `bundle_id`, `seq`, `at`, `by`, `finding`, `state_at`, `register_state`, `undetermined` and `documents_n` columns; per bundle the row with the highest `seq` is the standing mark, R4, R5) is a stated read contract, on the terms `provenance` R48 states for the register's: a later module may join it in its own SQL, and this module changes none of those columns' names or meaning without a change to this requirement; every write to it stays this module's. It is for `retrieval`'s `op=list` (its R63), which joins the standing mark in its own statement and reads it through `routeFinding` (R5).

**The route ops map** (`build/extraction/legacy-store.md` §4.2 (6); N512)
- **R9** [met] The module publishes `provenanceRouteOps(routes, url, body)`, an object of route arms keyed by op name, each a function of no arguments that answers what the named service answers, reading its parameters from `url`'s query (the control plane's stamps among them, never the body's). It holds three ops, each with today's behaviour (`store.mjs`' explicit arms), no meaning changed: `provenancechain`, `provenanceChainRebuild({bundleId, apply, viewer, author})`, `apply` true exactly when the query's `apply` is `1` (R2, R3); `provenanceroute`, `provenanceRouteAssess({bundleId, viewer, author})` (R4); `provenanceroutes`, `provenanceRoutesMarked({after, limit, viewer})` (R5). `viewer` and `author` are the control plane's stamps. Which credential reaches each op is `op-declarations`' and `control-plane`'s, never this map's. Until N512 they were three of the arms of `provenance`'s `provenanceOps` (its R53), which replaced the legacy store's explicit arms with one spread of the map (K671). (T51 K4266) `provenanceroutes` answers `provenanceRouteOf({bundleId, viewer})` (R15) when the query's `bundleId` is non-empty, else `provenanceRoutesMarked` (R5); a body's fields are never read.

**The route-marker tally on the audit** (`build/extraction/legacy-store.md` §4.2 (1); record-core R68)
- **R6** [met] This module registers, once at start, record-core's audit finding (its R68) under the key `route`. For each audit page it reads the standing mark (R5) of each bundle the page names, over the page's own id range (after its `after`, up to its last id) and kept only for the page's ids, so no other bundle's mark rides on the answer and the read never scans every mark; and answers `{tally, marked, markedTotal, markedShown, means, note}`: `tally` counts the page's bundles by `routeFinding` (R5) as `{LOOKED_INDETERMINATE, PRESENT, NEVER_LOOKED, notApplicable}` (`notApplicable` for a bundle the marker does not apply to), always present with every key, `NEVER_LOOKED` included; `marked` the first 20 marked bundles in page order, each `{bundleId, state, ...routeFinding}`, `markedTotal` how many the page holds and `markedShown` how many `marked` lists; `means` `OBSERVATION_STATES`; `note` the fixed sentence that these are stated doubts, not conformance errors, counted in neither `tally` nor `withErrors`, each naming a document whose route cannot be shown, and that `NEVER_LOOKED` means no assessment has run. The finding never moves `ok`, `clean`, `withErrors`, `tally` or `offenders` (record-core R68; DEC-56).

**Its figures** (`build/extraction/legacy-store.md` §4.2 (2))
- **R10** [met] This module's figures for `op=stats` and purge's proof, `routeMarks` (the `provenance_route_marks` rows, keyed on `bundle_id`), registered once at start through `record-core`'s `registerCounts` (its R63), answering for `hid` (the bundles the caller may not see, or null for a whole count) each figure as `store.mjs`' `#counts` takes it today, no meaning changed: a figure keyed on a bundle column leaves out the rows whose column names a bundle in `hid`, a row whose column is null naming none and so counted; a figure with no such column counts every row. Synchronous, writes nothing. The legacy store's own lines for these figures were deleted with it (`build/extraction/legacy-store.md` §4.2 (2)).

## Private

### Uses

- `record-grammar`: `isMachineIdentity` (R3, R4).
- `record-core`: `readImage` and `bundleInfo` (R2, R4); `transact`; the `bundles` read contract (its R37; R5's census); `declarePurge` (`provenance_route_marks`); `registerAuditFinding` (its R68) for R6; `registerCounts` (its R63) for R10. The instance name for R1's hop by this instance is handed in by the composition root (`deps.instanceName`), as `provenance` took it (K1227).
- `membership`: `viewerPredicate` and `sight` (R2, R4, R5).
- `promotion`: `promote` (R2).
- `provenance`: the doorbell's and the upload's origin kinds as it exports them (`DOORBELL_ORIGIN`, its R51; `UPLOAD_ORIGIN`, its R63; R1); the C-103 row `NO_BUNDLE` (C-103.3) through `PROVENANCE_ACT_CHECKS` (its R58, the seam), for R2.
- `credentials`, `test-support`: only the test world (`provenance`'s fixture), no service.
- `observation-log`'s `OBSERVATION_STATES` (R6's `means`) sits in a later module (layer 5), which this module cannot import (P4). Its five meanings are held here as `OBSERVATION_MEANS`, unchanged, the copy `provenance` reported (PROVENANCE #9), and they move with this code.

### Invariants

- **R7** [met] A hop a caller can hand in is a hop a caller can invent: every hop this module writes is derived from fields the record already held (R1) or from a fetch this instance made; none is read from a request.
- **R11** [met] Undetermined is stated, never rounded: a route that cannot be shown is reported as undetermined with the reason, and never counted as sound, present or absent (R4).
- **R12** [met] This module owns `provenance_route_marks`; no other module writes it (K49).
- **R13** [met] No place is named in this module's behaviour or outward text (`layers.md`, "No jurisdiction in the product").

### Satisfies

- `docs/architecture/BIO_System_Design.md` §3, construct 2 (the chain of hops).
- `docs/architecture/BIO_Intake_Doctrine_v1_1.md` §2 (provenance per document), §2a (the doorbell: its material received, not fetched, K509 (3); R1).
- `docs/development/AUTHORITY-AND-TRUST.md`, RULED: transitive trust with disclosure (the chain).
- Rulings: DEC-19, DEC-56 (the route marker), REC-158 (R3, R4).

(Copied from `provenance`'s Satisfies: the share R1–R7 serve. `provenance` keeps its own lines.)

### Suggestions

- **Checks carried here.** C-34.1–C-34.4 (`ROUTE_MARK_CHECKS`) move with this module, their `where` re-pointed to this module's file (accepted red 6). C-103.3 (`NO_BUNDLE`) stays in `provenance`'s `PROVENANCE_ACT_CHECKS`. Its sentence is true at both sites, and it is imported (`draft-T25-splits.md` P-1).
- **The seam is clean** (`draft-T25-splits.md` P-1). This code reads `bundles` and `provenance_route_marks` and nothing else, never `register` or `captured_locators`, and nothing else in `provenance` calls it. `record-core` reaches it back only through the registrations (R6, R10).
- **`op=stats`' order.** The figure keys are flat and unique. This module registers after `provenance` (and `attestation`, which registers no figure), so `routeMarks` stays after `register`. Pin that in the job's test.
- **Table.** `CREATE TABLE IF NOT EXISTS` under the same name keeps a deployed instance's rows with no data migration. `declarePurge` for `provenance_route_marks` moves to this module's declaration.
- **Private helpers.** `isObj` and `secondOf` are one-liners: copy them, or take them from `record-grammar` where it exports an equivalent.
- **R7.** Only R2 writes hops, so R36 moves whole. Confirm at the job whether `provenance`'s C-18.9 arm (its R46) needs R36's words too (splits draft).
- **Option B (BOB #100's review 1, as K1220 reads it).** Until each importer re-points, `provenance` keeps a pure copy of `routeFinding` (retrieval, L5), and no copy of `ROUTE_MARK_CHECKS` (K1225), deleted in `provenance`'s T26 job (N516). The three route arms and every write to `provenance_route_marks` are this module's from its L3 merge (R9, R12); `provenance` keeps no stateful method, so the table has one writer (P7).
- Tests: `chain-route.test.mjs`, `convert-chain-marker.test.mjs` (check its R41 and R46 arms at the job), the R54, `routeMarks` and R48 route-marks cases of `audit-figures.test.mjs`, and `ops.test.mjs`:154 move to `test/m/provenance-routes/`, with the share of `fixture.mjs` they need. Their R-id citations are re-pointed by the map above, and their assertions do not change.
