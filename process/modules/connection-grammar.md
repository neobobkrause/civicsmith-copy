Length: 80 lines. Last section: "Suggestions".

# connection-grammar: requirements

Next number: 22

**Size (P6).** About 400–700 lines (entries B §(c)).

## Public

### Purpose

The one shape every relationship the record holds is presented in, the registry of who owns each kind of relationship and what members call it, and the bounds and rules of walking them. Every owner at any layer registers its kinds and its `neighbours` read here, so `explore` walks one registry. It holds no relationship and walks nothing itself.

### Provides

**The shape.** A *connection* is `{id, from, to, kind, owner, valid: {from, to, precision, zone}, evidence, grade: {assertion, ends: [from_grade, to_grade]}, derived}`. `from` and `to` are record ids of `record-grammar`'s id grammar. `valid` is `civil-time`'s validity value. Grades are letters of `record-grammar`'s `BASIS_GRADES`.

**checkConnection(c) → `{ok}` or `{ok: false, errors}`**
- **R1** [met] Accepts a connection only when every field above is present and well formed, `kind` is registered to `owner` (R4), and: an `evidentiary` kind carries `evidence` naming at least one cited source; a `derived` kind carries `derived: {method, inputs}` and an `id` equal to `derivedId` (R11); a `declared` kind carries the label "declared, not evidenced" and `grade.assertion` the lowest grade; a `hunch` kind carries the label `hunch` and no grade. Each error names the field. Never throws.

**isRecordId(v) → boolean**
- **R21** [met] (T47; N948) `true` exactly when `v` is a string that is a record id of `record-grammar`'s id grammar, as `checkConnection` reads `from` and `to` (R1): an id core of its prefix in that prefix's `ID_TABLE` form (`record-grammar`'s `idPattern`, its R47; a legacy form included), alone or followed by `-` and a slug of one or more `-`-joined runs of `[a-z0-9]`. A prefix `ID_TABLE` does not hold, an empty or malformed slug, any other text and a non-string are `false`. Never throws.

**registerOwner({owner, kinds, neighbours})**. `kinds` is a list of `{kind, word, class}`; `neighbours` is the owner's read (R6).
- **R2** [met] Registers an owner once. `class` is one of `evidentiary`, `derived`, `declared`, `hunch`. `word` is the members' word for the kind (K1486), non-empty. Refused, nothing registered: `OWNER_DUPLICATE` (the owner is registered), `KIND_TAKEN` (a kind another owner holds, naming it), `CLASS_UNKNOWN`, `WORD_MISSING`, `NEIGHBOURS_MISSING`.
- **R3** [met] A `word` containing "knows", "network", "conflict", "suspicious" or "most connected" (any case) is refused `WORD_FORBIDDEN` (K1486).

**owners() → `[{owner, kinds}]`; kindOf(kind) → `{owner, word, class}` or `null`**
- **R4** [met] `owners` lists every registered owner and its kinds, in registration order; `kindOf` answers the registered entry for a kind, or `null` for one no owner holds. Neither throws.
- **R5** [met] The registry is per instance of the registry (`createRegistry()`), plus one default the plane wires; registering in one never changes another, so tests run in isolation.

**The `neighbours` contract** an owner registers: `neighbours({node, kinds, at, page, viewer, scope}) → {items, next?, truncated?, hub?, unread?}`. `viewer` is the member reading; `scope` is the working inquiry the walk runs in, or `null`. A caller of the registry passes both to every owner unchanged.
- **R6** [met] `items` are connections in R1's shape, of the owner's own kinds within `kinds`, with `node` at one end; each is evaluated at `at` by `civil-time.validAt`, and one `out` at `at` is not returned, one `undetermined` is returned marked so, its `why` exactly as `civil-time` answers it (`{key, vars}`, civil-time R30; K3958), never re-worded or turned into a string here; the owner-conformance battery judges such a `why` as a key the word table holds (or a `localize` id) with a `vars` object. At most `BOUNDS.fanout` items per page; `next` continues; a node whose set of one kind exceeds that kind's bound (`BOUNDS.hub_by_kind`, R10) is answered `hub: {set_size, why}` with no items, never a partial set shown as whole. The read writes nothing and records no one's reading (D68).
- **R7** [met] Sight: an item is returned only when `viewer` may see it under the owner's own visibility (K1489: a hidden project's testimony, identity claims, interest checks and hypotheses fenced; member ties and the source↔person link at their own narrowest visibility); an item `viewer` may not see is neither returned nor counted in `hub.set_size`, `truncated` or paging, so its existence does not show. A `viewer` absent is refused `VIEWER_MISSING`, never read as an administrator or as public.
- **R8** [met] Scope: a `hunch` item is returned only when `scope` names the working inquiry that holds it; with `scope` `null` no hunch item is returned. Items of other classes do not depend on `scope` (K1467, K1487).
- **R20** [met] (N560; explore R8) An owner may add to its answer `unread: [{what, why}]`: what it holds for `node` as a table and did not read (`what` and `why` non-empty strings), so a walk lists it and states no absence beyond the record's reach. It is optional; an answer without it states nothing unread. A caller of the registry carries it unchanged (R19).

**ownerConformance({owner, neighbours, kinds, fixture, declares?}) → `{ok, failures: [{check, why}], inapplicable: [{check, why}]}`**. The fixture names two viewers (one who may see a fenced item, one who may not) and, for an owner of hunch kinds, a working inquiry.
- **R9** [met] The battery each owner runs in its own job (B §(b) option (ii)): over the owner's fixture it checks R1's shape on every item, kinds limited to the owner's, the `at` rule of R6 (one connection in, one out, one undetermined), R7's sight (the fenced item returned to one viewer, absent and uncounted for the other, a missing viewer refused), R8's scope (a hunch item only within its inquiry), paging stable and complete (pages joined equal the unpaged set), the fan-out and hub rules, `derivedId` on every derived item, the `declared` and `hunch` labels, and that two identical calls give identical answers. (N560; K1563 (2)) It also takes the owner's declaration `declares: {undated?, group_wide?}`: `undated: true`, that its kinds state no `valid`, so R6's `at` rule cannot be shown; `group_wide: true`, that it holds no fenced item, so R7's fenced item cannot be shown. A declared check is answered in `inapplicable: [{check, why}]`, never in `failures`, and `ok` is `true` when `failures` is empty; a missing viewer is still refused and checked (R7), and every other check runs as above. Without a declaration nothing is inapplicable, and the answer carries no `inapplicable` key: it reads `{ok, failures}` as before (K1733).

**BOUNDS**
- **R10** [met] `BOUNDS` is frozen: `depth_default` 8, `depth_max` 10, `fanout` 1,000 per hop, `nodes` 5,000 visited, `hub` 1,000 members, `hub_by_kind`, and `time_budget_ms`, a default every walk may lower (K1470; legistar-events §6). (N566; K1566, K1726, K2063) `hub_by_kind` is the hub bound per kind, frozen: `event_voted` (`events`' kind for a member's vote) 4,000 members; every other kind `hub`'s 1,000, as before (a protective limit, K1881). `depthOf(requested)` answers 8 for none, the requested depth from 1 to 10, and refuses `DEPTH_OVER_MAX` above 10. `hubBoundOf(kind)` answers that kind's hub bound (T36-40).

**derivedId({kind, from, to, as_of, method}) → 64 hex characters**
- **R11** [met] The SHA-256 of the canonical JSON of the five fields; the same five give the same id, so a leg can cite a derived connection and a checker re-derive it (K1447).

**Walk semantics**, as pure reads over a path (a list of connections from start to end):
- **R12** [met] `chainGrade(path)` is the weakest `grade.assertion` and the weakest end grade over the path's hops; a declared hop gives the lowest grade; the weakest hop governs, never an average or a score (K1442).
- **R13** [met] `chainLabel(path)` is `lead` when any hop is `declared` or `hunch`, naming those hops; otherwise `evidenced`. A `lead` is never a basis for a finding (K1467, K1487).
- **R14** [met] `orderPaths(paths, {by?})` orders by hop count, then by the earliest `valid.from` (compared by `civil-time.compare`, undetermined last), then by the hops' ids; with `by`, a stated numeric quantity carried on the path, descending, ties in that order. No other order or score is offered (K1471).
- **R15** [met] `exhausted({visited, reason})` answers `{truncated: true, undetermined: true, why, visited}`, `reason` one of `depth`, `nodes`, `fanout`, `hub`, `time`; a walk that stops at a bound answers this shape and never a partial path presented as complete (K1442, K1470).

## Private

### Uses

- `record-grammar`: the id grammar (`ID_TABLE`, `idPattern`, T33-1) for `from` and `to`; `BASIS_GRADES` for grades.
- `civil-time`: `validAt` (R6, R9), `compare` (R14).
- `setup-words`: `word`, `localize` (the words rule: a sentence people read is read by key; K3930, K3943, K3949).

### Invariants

- **R16** [met] Pure: no store, no network, no clock; the registry is in memory. No walker and no stored path exists in this module (ladders §2 CONNECTIONS).
- **R17** [met] No kind, class, word or bound offers a measure of how connected a node is, a centrality, or a score across mixed kinds (K1471, K1473).
- **R18** [met] Every refusal and every undetermined answer says which kind of no and why.
- **R19** [met] `neighbours({owner, node, kinds, at, page, viewer, scope})` reaches a registered owner's read: it refuses `VIEWER_MISSING` before calling any owner, passes every argument unchanged, and refuses a non-conforming answer whole as `OWNER_NONCONFORMING`, naming the failed check (R1 shape; the owner's kinds within `kinds`; `node` at one end; at most `fanout` items; a hub, by R6's per-kind bound, answered with no items), never trimming it. A pass-through, not a walker (R16). Owners answer synchronously; a thenable answer is non-conforming (K1513).

### Satisfies

- `docs/architecture/BIO_Capability_Ladders_v0_1.md` §2, CONNECTIONS (one shape; owners' `neighbours`; derived ids; bounds and hubs; what a walk passes through), §2 "Cross-cutting rulings", Exploration; §5A.5 (hubs named by measured set size).
- Rulings K1442, K1447, K1467, K1469, K1470, K1486, K1487, K1489 (BOB #114: the contract carries `viewer` and `scope`).

### Suggestions

- **For each owner** (lines, events, money, duties, people, connections, standards, progressions, entities, contradiction, hypotheses): register at load, run R9 in its own job over its own fixture, and index both ends with validity (ladders §2 CONNECTIONS). Those obligations belong in each owner's requirements.
- **For `explore`**: the walk, its time budget against the instance's one thread, and the absence level from `observation-log` are its; it builds on R10–R15 and adds no second semantics.
- `time_budget_ms`: 10,000 as the default is a starting value; explore's synthetic test (M-X1a) sets it, and M-X1b tunes it after the first populated deploy.
- The hub threshold 1,000 and a warn band of 250–1,000 are legistar-events §6's initial proposal; the co-mention hub (more than 32 documents, X110) is `connections`' own.
- SHA-256 computed synchronously in-module, as in `calc-grammar`.
