# corpus-export — requirements

**Status** · In force: approved under K102 (carved from `publication`'s approved requirements) by K617 and K1024, meaning unchanged: R1–R4 name their `publication` ids, retired there; R5 a copy of `publication` R34, holding here as there. Last changed T34 (T34-42: R7); every requirement met (K1832). Fix round 6 (T51): R14 new, a rendering past its bound is continued by part and says so in its own body (G22); R15 new, `exportrender` declared; R10 amended.

## Public

### Purpose

A group that cannot leave can be held. This module exports the working corpus verifiably, records every export in an append-only log that every administrator can read, and verifies an import of an export, trusting nothing the export asserts (Membership v2 §8.1).

### Provides

#### Verified export (Membership v2 §8)

- **R1** (was `publication` R18) `exportManifest({note})` (`op=export`) answers:
  - every bundle with its files (path, SHA-256, bytes, blob digest, inline);
  - its promotions in write order, its snapshots and its references;
  - the register;
  - every table a module has declared (R7), by its export class, the entities tables among them;
  - the counts.

  In the same act it appends one `export_log` row: the instant, scope `working-corpus`, the counts, and the note cut at 280 characters. The answer says it was logged and how to verify it.
- **R2** (was `publication` R19) `exportLog({limit})` (`op=exportlog`) answers the newest rows first, `limit` clamped to [1, 1000], 200 by default, with `truncated`.
- **R6** (N483; K1122) The module publishes `corpusExportOps(ce, q)`, an object of route arms keyed by op name, each a function of no arguments: `export` answers R1 with `q("note")`, `exportlog` answers R2 with `q("limit")` (publication's former arms, `publication/index.mjs`:2702–2703, moved with today's behaviour). Which credential reaches each op is `op-declarations`' and `control-plane`'s; the plane spreads the map (its composition). (T33-61, K1632) Two more arms: `exportpage` answers R8's one page (`exportPage({table, index})`, its rows and canonical bytes, bounded at 256 KiB and 1,000 rows), with `export`'s credential; `exportrender` answers R10 with `q("format")` and the stamped viewer.

#### Every declared table, by class (S0-15, B0.13; DEC-112 (3), K1489, K1493)

- **R7** The export carries every table `record-core.declaredTables()` answers, each under its owner and with its classes. A table declared `export: "yes"` travels with its rows; one declared `admin-only` travels with its rows and is marked `admin-only` in the manifest; one declared `never` (member ties and the source↔person link among them, K1489, K1490) travels with no row and is named in the manifest with its owner and class, never omitted silently. A table declared `derive: "derived-rebuildable"` travels as its rule (its owner and the stored tables it is rebuilt from, record-core R77), never as its rows. A table declared after an export was taken is named by the next. (N593, K1632) The stored tables a `derived-rebuildable` table's rule names are its `from` exactly as `record-core.declaredTables()` answers it on that table's entry (record-core R77): a list given at declaration travels as given, and a `from: null` (not stated at declaration) travels as `null`, stated as not stated, never as an empty list and never filled by this module.
- **R8** Each table's rows travel in pages in the table's key order, each page at most a bound the module states, with its index, its row count and the SHA-256 of its canonical bytes in the manifest, so a page can be fetched, checked and resumed alone; the export of the largest declared table stays within the plane's CPU and memory bounds.
- **R9** (K1493) A row removed under `record-core`'s expunge (its R79) is not carried, and each tombstone `record-core.tombstones` lists for an exported table is carried in its place (table, key, ground, instant; none of the removed content), so a removal reaches every later export and an import shows where it was.

#### Renderings in open standards (scope §1 EVENTS, PEOPLE, MONEY; B §(d))

- **R10** `exportRendering({format, viewer})` answers, from the rows R7 would carry to that viewer and no others, one rendering: `ftm-event` (FollowTheMoney `Event` entities from `events`), `ocel2` (OCEL 2.0 events and objects from `events`), `popolo` (persons, organizations and memberships from `entities`, `lines` and `people`), `ftm-people` (FollowTheMoney `Person` and its relations from `people` and `lines`), `ftm` (FollowTheMoney entities and `Payment`s from `money`), `ocds` (OCDS releases from `money`) or `fdp` (a Fiscal Data Package from `money`). Every item carries the record id it renders and its citation; a field the record does not hold is omitted, never filled; a `never` table and a row the viewer may not see are never rendered; home addresses and phone numbers are never rendered (K1485). An unknown format is refused `EXPORT_FORMAT_UNKNOWN`. A rendering adds no fact and writes nothing, except one `export_log` row naming the format, as R1's. (T51 fix round 6, G22; K4571; amends R10) A rendering larger than one part is continued by R14.

- **R13** (fix round 4b, F3 verification; K4508; provenance R72, R73) **A capture held in parts verifies by its parts.** `exportManifest` and `verifyCorpusExport` treat a whole's row (provenance R73's `whole`) as an identity, verified by the concatenation of its parts' bytes, never as a file whose bytes must be handed apart; `render.mjs` likewise. Test: the bytes an exporter holds for a bundle held in parts verify, as they did before provenance R72. The manifest's row of a whole travels `whole: 1` with `parts` (the parts' digests in order, or `null` when the record names none); other rows unchanged. A whole's row verifies by its parts' concatenated SHA-256 and size (incremental), unless the concatenation is handed too; a missing part is `BYTES_MISSING`, a wrong digest, order or size `CAPTURE_HASH_MISMATCH` or `CAPTURE_SIZE_MISMATCH`.

#### T53 additions

- **R16** (T53; N1259; K4403 (2), (3); K1493; amends R9) **A register is exported as its descriptors and tombstones, never as rows; a limited register's rows in no form.** For each import the export carries `{register, scope, filter, filter_fingerprint, source, source_date, imported_at, counts, segment_shas, original_fingerprints, reduction}` and each tombstone `registers` lists (table, key, ground, instant; none of the removed content); it carries no cell, no index row, no segment and no row of a register with a `use_limit`, and the export log records it. `corpus-export` R7 already carries a table declared `export: never` with no row, named in the manifest, and a `derived-rebuildable` one as its rule, so the descriptors are `registers`' `export: yes` tables and the cells and index rows need no code here. What R7 does not cover is the segments: a reduced segment is filed as a capture in a bundle (`acquisition`'s `streamRegister`, `registers` R14), and R1 lists every bundle's files and R13 treats every registered capture, so a segment would travel as rows. This line therefore adds: R1 and R13 skip a capture whose provenance document states `origin: register_import` and the manifest names only its SHA-256, in the descriptor's `segment_shas` (UNVERIFIED: where the segments' bundle lives; and whether R3's byte-compare of every registered capture on import needs the same exemption). An import of an export re-creates the descriptors and shows "rows not carried: bring them in again from the source" and where a removal was; it restores no row and never a tombstoned key. Test: an export of a fixture instance with two imports holds two descriptors, one tombstone and no cell (a scan for the fixture's cells finds none); importing it shows both descriptors and the tombstone and no row; a limited register's descriptor holds no cell either. Control: other exported tables are carried as declared.
- **R17** (T53; K5441, K5443; PLATFORM PL50, `platform/whole-record-move-draft.md` §2) **A whole-record manifest.** `exportWhole({note})` (`op=exportwhole`, administrator only, as `export`) answers a **whole-record manifest**: R1's content, plus every stored file as an entry (path, SHA-256, bytes, kind) whether held inline or in R2, plus the copy's region, jurisdiction and generation as `placement`, plus the counts; in the same act it appends one `export_log` row with scope `whole-record`. Test: a seeded copy's manifest lists every held file; the log row's scope is `whole-record`; a member is refused. *(not yet met: T53)*
- **R18** (T53; K5441, K5443; PLATFORM PL51) **A whole-record export is read by parts and is resumable.** The files travel as a list of parts of at most a stated size (not above the plane's per-call memory, `PLATFORM_FIGURES`), each with index, byte count and SHA-256 in the manifest, fetchable and checkable alone, so an interrupted move continues from the last verified part and never restarts; no call holds more than one part. Test: an export of a record larger than the part bound lists more than one part; a part fetched alone verifies; a lost part is refetched, the others untouched; memory held by the export is at most one part (byte-ledger). *(not yet met: T53)*
- **R19** (T53; K5441, K5443; K1489, K1490; PLATFORM PL52) **The export names what it does not carry.** Each table class R7 withholds is listed in the manifest as `not_carried` with its owner and the reason (never, derived, expunged), and the export says in plain words that members' sign-in material is not carried. Test: the manifest of a copy with member ties names them `not_carried`.
- **R20** (T53; K5441, K5443; PLATFORM PL53) **The export is a read.** It changes no record and holds no lock beyond a part; the copy keeps working while it runs, and the manifest states the instant it was taken so a later import can say what changed after it. Test: a write during the export does not change the manifest's counts; the instant is stated.

## Private

### Uses

- `record-grammar`: `createSha256`, for R3's re-derivation.
- `record-core`: `recordOf(ctx)` and `declarePurge` (R4); its R37 read contract (R1; N484): `bundles`' `bundle_id`, `object_type`, `title`, `current_state`, `bundle_sha`, `row_version`, `created` and `last_updated`; `files`' `path`, `sha256`, `bytes`, `blob_sha` and `content` (whether set); `manifest`'s `snap_key`, `kind`, `base`, `author`, `created`, `writer`, `operation` and `rowid`; `history`'s `snap_key`, `path`, `sha256` and `created`.
- `provenance`: its R48 read contract (R1; N484): `register`'s `bundle_id`, `path`, `capture_sha` and `bytes`.
- `connections`: the `refs` read (R1).
- `record-core` (T33-61): `declaredTables` (its R21; since T34 with R77's `from` on a derived-rebuildable entry, for R7's rule) and `tombstones` (its R79), for R7–R9; each table's rows through its owner's stated read contract.
- `entities`, `events`, `lines`, `money`, `people` (T33-61): their rows and read contracts, for R10's renderings.
- `registers` (T53; N1259): its `export: yes` descriptor tables and its tombstones (its R30), carried by R7 and R9 as any declared table; the segments' exemption (R16) is this module's own act.

### Invariants

- **R3** (was `publication` R32) An import of an export:
  - re-derives every file's hash;
  - re-derives every bundle's history chain and base links;
  - byte-compares every registered capture;
  - trusts nothing the manifest asserts (Membership v2 §8, "What verified must mean");
  - re-derives every table page's SHA-256 (R8), and refuses by name a page whose bytes differ, a page missing from a table's sequence, or a declared table the manifest neither carries nor names (R7).

  The verifying import belongs to this module: `verifyCorpusExport({manifest, bytes})`, which writes nothing, never throws and has no op (K1058).
- **R4** (was `publication` R31, its `export_log` clause) `export_log` is exempt from purge.
- **R5** (was `publication` R34, copied) No place is named in this module's behaviour or outward text.

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

## Old ids (`publication` → this file)

`publication` R18 → R1; R19 → R2; R32 → R3; R31's `export_log` clause → R4; R34 copied as R5. `publication`'s R18, R19 and R32 are retired there as moved (K617, K1024; J10).

- **R11** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `export`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).

- **R12** (T51; K4168; the T51 declaration pass; op-declarations R80, R81; op-grades R49, R50; test-support R15) **The module declares the ops it serves that the screens send.** `DECLARED_OPS` is exported beside the ops map: a frozen object keyed by the op's door name, each row `{classes, machineClasses?, mutating, weight, description, fields: {accepts, requires}}`, its class, weight and description copied from the op's existing rows and its fields read from the arm whole (the stamps and the shell's `reason` are not accepts unless the arm reads a `reason` of its own): `exportlog`. Test: `declaredOpHolds` for each, with only its requires, without each, and with a field outside its accepts (`declared-ops.test.mjs`).

- **R14** (fix round 6, G22; K4571; amends R10) **A rendering past its bound is continued by part and says so in its own body.** `exportRendering({format, viewer, part})` (`op=exportrender`, key `part`) reads at most RENDER_MAX (5,000) records of each source in a part: part n (1-based, default 1) holds that source's records 5,000(n-1)+1 to 5,000n in id order. The answer carries `part`, `next` (the following part; null on the last) and `truncated` (true when `next` is set). A part that is not the whole rendering (any part after the first, or a first part with `next`) states it in the body an outside party receives, naming the part and the next, in its standard's own field: `description` for a Fiscal Data Package, a top-level `note` for every other envelope; a rendering that fits in one part carries no note. An item that refers to a record held in another part refers to it by id and keeps every field derived from it; a record an item names may also be rendered in the parts that name it (one id, one entity). Person facts are read whole for the persons of the part. A `part` that is not a whole number from 1 is refused `EXPORT_PART_MALFORMED`, rendering and logging nothing. Test: 5,001 records of a source, each format: part 1 states it is part 1 and names part 2; part 2 holds the 5,001st; a membership across parts keeps its post and organization.

- **R15** (T51; K4168, K4208; `op-declarations` R80, R81; `op-grades` R49, R50; `test-support` R15) **The module declares `exportrender`.** `DECLARED_OPS` holds `exportrender`: `{classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate", description (the hand row's sentence), fields: {accepts: ["format","part"], requires: ["format"]}}`. Test: `declaredOpHolds` (`declared-ops.test.mjs`).
