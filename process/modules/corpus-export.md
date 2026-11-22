Length: 72 lines. Last section: "Suggestions".

# corpus-export: requirements

Next number: 14

## Public

### Purpose

A group that cannot leave can be held. This module exports the working corpus verifiably, records every export in an append-only log that every administrator can read, and verifies an import of an export, trusting nothing the export asserts (Membership v2 §8.1).

### Provides

#### Verified export (Membership v2 §8)

- **R1** [met] (was `publication` R18) `exportManifest({note})` (`op=export`) answers: - every bundle with its files (path, SHA-256, bytes, blob digest, inline); - its promotions in write order, its snapshots and its references; - the register; - every table a module has declared (R7), by its export class, the entities tables among them; - the counts.

  In the same act it appends one `export_log` row: the instant, scope `working-corpus`, the counts, and the note cut at 280 characters. The answer says it was logged and how to verify it.
- **R2** [met] (was `publication` R19) `exportLog({limit})` (`op=exportlog`) answers the newest rows first, `limit` clamped to [1, 1000], 200 by default, with `truncated`.
- **R6** [met] (N483; K1122) The module publishes `corpusExportOps(ce, q)`, an object of route arms keyed by op name, each a function of no arguments: `export` answers R1 with `q("note")`, `exportlog` answers R2 with `q("limit")` (publication's former arms, `publication/index.mjs`:2702–2703, moved with today's behaviour). Which credential reaches each op is `op-declarations`' and `control-plane`'s; the plane spreads the map (its composition). (T33-61, K1632) Two more arms: `exportpage` answers R8's one page (`exportPage({table, index})`, its rows and canonical bytes, bounded at 256 KiB and 1,000 rows), with `export`'s credential; `exportrender` answers R10 with `q("format")` and the stamped viewer.

#### Every declared table, by class (S0-15, B0.13; DEC-112 (3), K1489, K1493)

- **R7** [met] The export carries every table `record-core.declaredTables()` answers, each under its owner and with its classes. A table declared `export: "yes"` travels with its rows; one declared `admin-only` travels with its rows and is marked `admin-only` in the manifest; one declared `never` (member ties and the source↔person link among them, K1489, K1490) travels with no row and is named in the manifest with its owner and class, never omitted silently. A table declared `derive: "derived-rebuildable"` travels as its rule (its owner and the stored tables it is rebuilt from, record-core R77), never as its rows. A table declared after an export was taken is named by the next. (N593, K1632) The stored tables a `derived-rebuildable` table's rule names are its `from` exactly as `record-core.declaredTables()` answers it on that table's entry (record-core R77): a list given at declaration travels as given, and a `from: null` (not stated at declaration) travels as `null`, stated as not stated, never as an empty list and never filled by this module.
- **R8** [met] Each table's rows travel in pages in the table's key order, each page at most a bound the module states, with its index, its row count and the SHA-256 of its canonical bytes in the manifest, so a page can be fetched, checked and resumed alone; the export of the largest declared table stays within the plane's CPU and memory bounds.
- **R9** [met] (K1493) A row removed under `record-core`'s expunge (its R79) is not carried, and each tombstone `record-core.tombstones` lists for an exported table is carried in its place (table, key, ground, instant; none of the removed content), so a removal reaches every later export and an import shows where it was.

#### Renderings in open standards (scope §1 EVENTS, PEOPLE, MONEY; B §(d))

- **R10** [met] `exportRendering({format, viewer})` answers, from the rows R7 would carry to that viewer and no others, one rendering: `ftm-event` (FollowTheMoney `Event` entities from `events`), `ocel2` (OCEL 2.0 events and objects from `events`), `popolo` (persons, organizations and memberships from `entities`, `lines` and `people`), `ftm-people` (FollowTheMoney `Person` and its relations from `people` and `lines`), `ftm` (FollowTheMoney entities and `Payment`s from `money`), `ocds` (OCDS releases from `money`) or `fdp` (a Fiscal Data Package from `money`). Every item carries the record id it renders and its citation; a field the record does not hold is omitted, never filled; a `never` table and a row the viewer may not see are never rendered; home addresses and phone numbers are never rendered (K1485). An unknown format is refused `EXPORT_FORMAT_UNKNOWN`. A rendering adds no fact and writes nothing, except one `export_log` row naming the format, as R1's. (T51 fix round 6, G22; K4571; amends R10) A rendering larger than one part is continued by R14.

- **R13** [met] (fix round 4b, F3 verification; K4508; provenance R72, R73) **A capture held in parts verifies by its parts.** `exportManifest` and `verifyCorpusExport` treat a whole's row (provenance R73's `whole`) as an identity, verified by the concatenation of its parts' bytes, never as a file whose bytes must be handed apart; `render.mjs` likewise. Test: the bytes an exporter holds for a bundle held in parts verify, as they did before provenance R72. The manifest's row of a whole travels `whole: 1` with `parts` (the parts' digests in order, or `null` when the record names none); other rows unchanged. A whole's row verifies by its parts' concatenated SHA-256 and size (incremental), unless the concatenation is handed too; a missing part is `BYTES_MISSING`, a wrong digest, order or size `CAPTURE_HASH_MISMATCH` or `CAPTURE_SIZE_MISMATCH`.

## Private

### Uses

- `record-grammar`: `createSha256`, for R3's re-derivation.
- `record-core`: `recordOf(ctx)` and `declarePurge` (R4); its R37 read contract (R1; N484): `bundles`' `bundle_id`, `object_type`, `title`, `current_state`, `bundle_sha`, `row_version`, `created` and `last_updated`; `files`' `path`, `sha256`, `bytes`, `blob_sha` and `content` (whether set); `manifest`'s `snap_key`, `kind`, `base`, `author`, `created`, `writer`, `operation` and `rowid`; `history`'s `snap_key`, `path`, `sha256` and `created`.
- `provenance`: its R48 read contract (R1; N484): `register`'s `bundle_id`, `path`, `capture_sha` and `bytes`.
- `connections`: the `refs` read (R1).
- `record-core` (T33-61): `declaredTables` (its R21; since T34 with R77's `from` on a derived-rebuildable entry, for R7's rule) and `tombstones` (its R79), for R7–R9; each table's rows through its owner's stated read contract.
- `entities`, `events`, `lines`, `money`, `people` (T33-61): their rows and read contracts, for R10's renderings.

### Invariants

- **R3** [met] (was `publication` R32) An import of an export: - re-derives every file's hash; - re-derives every bundle's history chain and base links; - byte-compares every registered capture; - trusts nothing the manifest asserts (Membership v2 §8, "What verified must mean"); - re-derives every table page's SHA-256 (R8), and refuses by name a page whose bytes differ, a page missing from a table's sequence, or a declared table the manifest neither carries nor names (R7).

  The verifying import belongs to this module: `verifyCorpusExport({manifest, bytes})`, which writes nothing, never throws and has no op (K1058).
- **R4** [met] (was `publication` R31, its `export_log` clause) `export_log` is exempt from purge.
- **R5** [met] (was `publication` R34, copied) No place is named in this module's behaviour or outward text.

### Satisfies

- `docs/architecture/BIO_Membership_Architecture_v2.md` §8.1 (full working-corpus export), and §8's "What verified must mean" (R3).

### Suggestions

- **Factory.** `corpusExportOf(host, deps)` answers the one instance per Durable Object storage (K61). At creation it:
  - creates `export_log` (the same DDL, `CREATE TABLE IF NOT EXISTS`, so a store's existing rows stay);
  - declares it to `record-core`'s purge as exempt (R4).

  `publication`'s `export` and `exportlog` delegates are retired (T23 L8, N483); the plane's op map spreads `corpusExportOps` since T23 L11 (K1122).
- **For callers.** (was `publication`'s Suggestions, "For callers", its export half) The control plane admits only the root-of-trust credential to `op=export` (`ROOT_OF_TRUST_REQUIRED`) and in-app administrators to `op=exportlog`.
- **R3's scope** (P17, a detail, for the START). The service is handed R1's manifest and the bytes it names, which the manifest itself does not carry. It answers verified, or each failure by name, and writes nothing. Writing a verified corpus into a receiving store is not stated here.
- **T33-61 (open technical details, BOB's).** R8's page bound (rows or bytes) is set from the paging cost the job measures on a large fixture within 30 s CPU and 128 MB, and reported in its COMPLETE. Whether R10 is one op (`op=exportrender`) or a member of `export`, and which credential reaches it, are `op-declarations`' and the job's. Which version of each standard is rendered (FtM's schema release, OCDS 1.1, OCEL 2.0 JSON, Popolo, FDP v1) is pinned in the job. Whether `admin-only` tables also reach an in-app administrator through a narrower op than the root-of-trust export is open (S0-15 reads "`yes` goes to every administrator").
- **Tests.**
  - R1 and R2 move from `test/m/publication/export.test.mjs` with their assertions, renamed.
  - R3: every hash, chain and base link re-derived; a tampered manifest (a file's hash, a broken base link, a capture's bytes) refused by name, with a negative control.
  - R4: the whole-store purge leaves `export_log` byte-identical.
  - The fixture builds on earlier modules only (`test/m/connections/fixture.mjs`, or record-core, provenance and connections), never publication's.
