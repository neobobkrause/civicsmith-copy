Length: 79 lines. Last section: "Suggestions".

# leg-earning: requirements

Next number: 18

**Size (P6).** About 600–800 lines move (the earned registry, `store.mjs` 26364–26744 at extraction, the reads 31123–31191 and 35552–35759, now in `inquiry/index.mjs`), taking `inquiry` (3,903) well under 4,000.

## Public

### Purpose

What the record can earn for a leg of an inquiry's basis, and which questions rest on a given target: the earned registry (the connection grade, the capture ceiling and testimony a target earns, and the cap a stated grade meets), the inquiry's earned basis as a viewer may read it, the projected legs and the legs resting on a target, the one walk that finds a cycle through inquiry legs, and the projects drawing on a question. It writes no basis and grades no conclusion: those are `inquiry`'s and `strength`'s.

### Provides

Terms. A **leg**, **registry**, **grade**, **axis** and **source** are as `inquiry` defines them (its Provides, Terms). A **viewer** is the control plane's stamp, read through `membership`. Every refusal names a `reason`.

**earned(subjectEntity, targetIds, contentIds?), earnedForDoc(fm, legs), legCapped(stated, earned, targetId)**
- **R1** [met] (was inquiry R13) `earned` answers, per target, the connection grade earned (the strongest A–C resolution of its captures to the subject, by `entities.strongestByCapture`; a D resolution earns nothing), the capture ceiling (`EARNED_CAPTURE_CEILING`, bounded by `text-chain.captureBound` over machine transcriptions, undetermined when every transcription is unmeasured), and for a member's authored observation the testimony grade D with its capture axis stated as not applicable. Each carries a `why`. With content ids it adds each row's standing (`content.standings`, `connections.portionGrades`); without, the answer is unchanged. `earnedForDoc(fm, legs)` answers `earned` for the subject the document's front matter declares (`subject_entity`, else none) over its legs' targets.
- **R2** [met] (was inquiry R14) `legCapped` answers null when the stated grade is within what the target earns, else the earned grade and why; an undetermined ceiling answers null grade with the reason.

**earnedBasis({id, targets, viewer})** (`op=earnedbasis`)
- **R3** [met] (was inquiry R15) `NO_ID`; an absent or invisible inquiry is `NO_SUCH_BUNDLE`; `NOT_AN_INQUIRY`; at most 200 targets; targets and legs the viewer cannot see are left out and the answer says so; a leg on an imported finding (`inquiry-grammar` R11) is part of the inquiry's own document, so it is listed, earns nothing here (its grades are the edition's, `strength` R33) and states its null case as `IMPORTED_TARGET`, never out of view and never `INQUIRY_TARGET` (K1304); each document leg carries its content row (backfilled, at most `LEG_BACKFILL_MAX` per read, the rest `NOT_YET_RESOLVED`) and which capture it rests on: `pinned`, `only_capture`, or `undetermined` with the count held (REC-220).

**basisFor(id, {limit?}), restingOn(targetId), restsOnLive(id), cyclePath(id, targets), projectsDrawingOn(id)**
- **R4** [met] (was inquiry R16) `basisFor(id, {limit?})` answers the projected legs in order; with a positive integer `limit`, at most that many, the first by ord, bounded in the read, with `limit` and `truncated`; without it, the whole basis. `restingOn` answers every leg naming the target, each `confirmed` or `severed` by the citer's own record (`connections.edgeSevered`). Neither is gated; both are for in-process callers only.
- **R5** [met] (was inquiry R17) `restsOnLive` answers the live legs resting on an id: a divided citer is skipped, a severed one is `severed`, a case member's (the registered fact `caseMember`) is `frozen`, the rest `confirmed`.
- **R6** [met] (was the walk of inquiry R11's `BASIS_CYCLE` and R29) `cyclePath(id, targets)` answers whether legs from `id` to each of `targets` would close a cycle through inquiry legs of the projected basis: the whole cycle path `[id, target, …, id]` for the first that would, else null. It is the one cycle walk; `inquiry` and `basis-versions` call it.
- **R7** [met] (was inquiry R39's reading) `projectsDrawingOn(id)` answers the projects whose document holds a `cites` reference to `id` not marked severed (`connections.edgeSevered`), counted over every project whatever any viewer sees, at most 32, the first by id, with `truncated` when more exist; a severed citer takes no slot, so the bound never decides whether more than one project draws on it.

**Earning for the new leg targets** (K1447)
- **R8** [met] For a target that is a held standard (`STD-`, K1447 (iii)), `earned` answers the capture ceiling of the capture holding that standard's text at the version the leg cites (`standards`), with no connection grade and its axis stated; a standard holding no captured text at that version answers undetermined with `STANDARD_NO_TEXT`'s reason, and R2 caps any stated capture grade to it.
- **R9** [met] For a target that is a duty occurrence (K1447 (i)), `earned` answers its derivation as `duties.occurrencesOf` states it (the source in force, the trigger date, the due date and the level searched) and no grade of its own: the occurrence leg's grade is derived by `strength` (T33-47), and R2 answers null against it. An occurrence `duties` answers undetermined is earned as undetermined with the reason.

**The basis table** (K1505 (2); K1601)
- **R12** [met] `leg-earning` holds `inquiry_basis` with its columns, indexes, names, types and meanings unchanged from `inquiry` (R12, R29, R40 there), as a read contract later modules may join. Its one write, `writeBasis(bundleId, legs)`, replaces an inquiry's legs whole (`target_type` derived from the target's prefix), and R3's backfill sets a leg's `content_id`; nothing else writes it. It is declared explicitly to `record-core` (`declareTable`) with the classes it has today (purge clear, keyed by `bundle_id`; expunge none; export admin-only; sight bundle; stored).

**Projects drawing on a question, and the AI transcription's ceiling** (T41-14)
- **R13** [met] (D36, D29) `projectsDrawingOnPaged({id, after, limit})`: every project drawing on `id` (R7's test, over every project), paged, `limit` at most 500, with `cursor`; in-process only. R7's 32-bound stays for its callers.
- **R14** [met] (H38, D64) `projectsShownOn({id, viewer})` answers a viewer who may see the question the projects drawing on it that are not hidden (`membership` R85), each `{id, name}` as `membership` R44 lets her see it, at most 200, with `truncated`; a hidden project is never answered, named or counted, and the answer is the same whether or not one draws.
- **R15** [met] (D21; D4) `earned`'s capture ceiling for a passage of an AI transcription (`text-chain` R104) is undetermined, except at an extent a member attested against the page (`content.attestText`), where it is the capture's own grade.
- **R16** [met] (K538; K2457, K2472) When no capture of a document came by a route that measures a capture grade, `earned` states its legs as authored (`stated_as: "authored"`, `route_basis` the routes, sorted) with a `why` naming each route in words: a doorbell's receipt (`CAPTURE_RECEIVED_NOT_FETCHED`, its receipt's `via` the doorbell) "received through the doorbell"; a member's upload (`via: "upload"`, `provenance` R63) "uploaded by a member"; no route recorded "no fetch route recorded"; the letter its author gave stays, under the ceiling, never stated as measured.
- **R17** [met] (T52 R1; T52-105; W11, C-K5; `citation` R25; K5357; amends R4, R5) **A leg is severed or live of its own.** On an inquiry, `restingOn` (R4) answers each leg's own status, `severed` or `confirmed`, as `citation` R25 records it per passage (the leg's `status: "severed"`; absent, live; K5407), and `restsOnLive` (R5) skips a severed passage while another passage of the same document still rests on the target live. A project's citer is read as today, by its document edge. Test: an inquiry citing one document in two passages, one severed: `restingOn` answers one `severed` and one `confirmed` leg, `restsOnLive` answers the live one; control: both severed, none live; a project's severed edge reads as before.

## Private

### Uses

- `provenance`: `captureGrade` (R1, R8), `DOORBELL_VIA`, `UPLOAD_VIA` (R16) (LEG-EARNING #4 J2, K2485).
- `inquiry-grammar`: the leg vocabulary and the imported-finding reference (R3).
- `accepted-work`: whether an imported finding's edition is accepted (R3).
- `record-core`: the `bundles` read contract (R3, R7).
- `membership`: `viewerPredicate`, `inSight` (R3).
- `promotion`: the fact `caseMember` (R5).
- `content`: `standings`, the citation rows (R1, R3).
- `connections`: `portionGrades`, `edgeSevered`, the `refs` read contract (R1, R4, R5, R7).
- `entities`: `strongestByCapture` (R1).
- `text-chain`: `captureBound`, `isTranscribed` (R1).
- `standards`: a standard's version and its captured text (R8).
- `duties`: `occurrencesOf` (R9).
- The projected basis `inquiry_basis`: see Suggestions (the seam).

### Invariants

- **R10** [met] (copied from inquiry R32) Nothing here gives a leg a grade the record did not earn or a member did not author; an ungraded leg is inert and always named (DEC-18, DEC-24).
- **R11** [met] (copied from inquiry R33) Every read naming an inquiry or project the viewer may not see answers exactly as an absent one.

### Satisfies

- As `inquiry` for R13–R17 and R39: `docs/architecture/BIO_Case_Making_v0_1.md` R1–R3; `docs/development/MEMBER-KNOWLEDGE-DESIGN.md` §3; `docs/architecture/BIO_Content_Framework_v0_10.md` Part II §14.4 (REC-220); DEC-18, DEC-21, DEC-112 (6).
- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2 LAW ("`standards` moves whole to layer 5 now", the inquiry legs) and §3 (the occurrence as a leg); BOB's K1447 (i), (iii).
- K617 (split for size, no change of meaning).

### Suggestions

- **The seam (for the START).** Every read here reads the projected basis, `inquiry_basis`, which `inquiry` (after this module) writes in its projection (inquiry R12, R29) and states as a read contract (R40) for later modules. An earlier module cannot use a later one (P4). Proposed: the table, its declaration, its read contract and its one write move here with no change of meaning, and `inquiry`'s projection calls that write; `inquiry` R12, R29, R36 and R40 are re-pointed by its job (T33-45). R3's backfill of a leg's content row is the same write.
- `inquiry` R52 (2), the leg-grade resolver for `retrieval`, is built over R1–R2 and may stay in `inquiry` calling them; it is not moved here.
- **Tests.** The moved tests move with their requirements unchanged; R8 a standard with and without captured text; R9 an undetermined occurrence.
