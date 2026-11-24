/* inquiry's tables (requirements: `build/requirements/inquiry.md`, R36). Moved out of the legacy `schema.mjs` at this
 * module's extraction (layers.md ruling 3, "each module owns its tables"): `inquiry_exclusions` and
 * `inquiry_migration_replays` (and, since T10, `inquiry_member_agents`; since T15, `inquiry_contradiction_links`; since
 * T18, `inquiry_bundle_facts`, which gained the subject entity in T19; since T33, `inquiry_dated_waits`; since T50, `inquiry_ground_changes`), with the comments that record why each is shaped as it is. Each carries `bundle_id`
 * and is declared to record-core's purge by this module (K23). `migrateInquiry` brings a store created under an
 * earlier shape to this one. `inquiry_basis` is `leg-earning`'s since T33 (K1505 (2)), which creates and declares it. */

export const INQUIRY_SCHEMA = `

-- R12, R29, R40 (T33-45; K1505 (2)): the INQUIRY BASIS, inquiry_basis, its comments, columns and indexes, is
-- leg-earning's (its R12), which creates and declares it; this module's projection writes it only through
-- leg-earning's writeBasis.
-- REC-14 / C-9: what a published case says it does NOT cover. A projection of
-- the completeness_excluded[] block in bundle.md, exactly as inquiry_basis is
-- of basis[] -- the BYTES make the assertion storable and signable, and only
-- this INDEXED projection makes it AUDITABLE. "Which published cases excluded
-- this document" is invariant 7's only mechanical enforcement point at the
-- case level, and without the index on target_id it cannot be asked at all.
--
-- target_id is NULLABLE and every row carries target_id OR prose, NEVER
-- NEITHER (RECONCILED C-9, the capture-or-testify structure REC-24 uses for
-- correspondence). An exclusion may legitimately name something that is not in
-- the record -- "a records request to the City Clerk is still outstanding" is
-- a real exclusion with no id to point at -- so a NOT NULL target would force
-- the member to either invent a referent or say nothing. description and
-- reason are both NOT NULL: WHAT was left out and WHY are two different
-- statements and one does not stand in for the other.
--
-- edition is the edition of the document this projection was taken from, so an
-- auditor reading a row knows which assertion it is. It is NOT in the key: the
-- bytes hold every edition's assertion forever, and this table holds the LIVE
-- document's, re-projected whole on every promotion like every other
-- projection here. Cleared in BOTH purge arms (D-113).
CREATE TABLE IF NOT EXISTS inquiry_exclusions (
  bundle_id   TEXT NOT NULL,
  ord         INTEGER NOT NULL,
  edition     INTEGER,
  target_id   TEXT,
  description TEXT NOT NULL,
  reason      TEXT NOT NULL,
  author      TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (bundle_id, ord)
);
CREATE INDEX IF NOT EXISTS inquiry_exclusions_target ON inquiry_exclusions(target_id);

-- REC-173 (INVESTIGATIVE-SESSION.md section 11 item 5, A MIGRATION IS A REPLAY, NOT A SURFACING, BOB #30,
-- 2026-09-23): the inquiries whose CREATION was a server-verified MIGRATION REPLAY. The control plane admits one
-- only for the ADMIN class and only when the drive-provenance capture it names is registered, held, and lists this
-- bundle id and this bundle.md SHA-256. Such a question was surfaced in the Drive era, not on this plane, so no run
-- is recorded for it and its read says so in words (not recorded, migrated from the Drive era) rather than guessing.
-- An INSTANCE row, never a line in the question's bytes, which are the Drive era's verbatim. capture_sha is the
-- provenance capture, promotion_key the preserved Drive promotion whose record listed the bytes. One row per
-- inquiry, written in the creation's own transaction. Named bundle_id so it rides purge's TABLES list and clears in
-- BOTH arms (D-113). NO index beyond the key: the one reader asks by the inquiry.
CREATE TABLE IF NOT EXISTS inquiry_migration_replays (
  bundle_id      TEXT PRIMARY KEY,
  capture_sha    TEXT NOT NULL,
  promotion_key  TEXT,
  at             TEXT NOT NULL
);

-- R44 (N149, SOURCE-ACCESS's amendment, DEC-47): the member-browser agent recorded when the inquiry was created, the
-- control plane's memberUserAgent stamp on the creating promotion (the User-Agent of the member's own browser, never
-- a caller's claim). Written once, at the creation, and never by a revision; a division's children carry their
-- parent's. An INSTANCE row, not a line in the question's bytes, which the member wrote. One row per inquiry.
CREATE TABLE IF NOT EXISTS inquiry_member_agents (
  bundle_id   TEXT PRIMARY KEY,
  user_agent  TEXT NOT NULL,
  at          TEXT NOT NULL
);

-- R48 (N345): the contradiction link R47's grammar judges, as the inquiry's latest promotion projected it. A projection
-- of the document's own 'contradiction', 'resolution' and 'explores' blocks, re-derived whole at every promotion (D-21),
-- one row per inquiry that carries a link or an 'explores' block and none for a plain inquiry. candidate is the
-- contradiction candidate's id (contradiction R15), NULL for a sub-inquiry that only explores. resolution is the logical
-- resolution as JSON, written only while the document is concluded (R47: kept, never read, at any other state), so a
-- reopened inquiry answers NULL with no edit. explores is the logical block as JSON, or NULL. The candidate index is the
-- one lookup R11's one-candidate rule (C-2.17) and inquiryOfCandidate ask. Keyed by bundle_id and declared to purge (R36).
CREATE TABLE IF NOT EXISTS inquiry_contradiction_links (
  bundle_id   TEXT PRIMARY KEY,
  candidate   TEXT,
  resolution  TEXT,
  explores    TEXT,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiry_contradiction_links_candidate ON inquiry_contradiction_links(candidate);

-- R36 (N136, K649 (6)): the two per-bundle facts this module alone writes, moved off record-core's bundles (T18).
-- inquiry_basis_count is the leg count R12 records from inquiry_basis in the same promotion (query-language's legs:
-- field reads it through retrieval's registration, its R62). inquiry_superseded_by is REC-17's reverse of a supersedes
-- edge, so R7's obligation is a lookup and not a graph walk: the superseding ids, comma-joined and sorted, NULL when
-- nothing supersedes the bundle (supersededByOf is its one parser). The column names are the ones they had on bundles,
-- so every reader reads the same name. One row per bundle (retrieval R62: its registered table holds at most one row per
-- key); a bundle with no row reads as NULL for both, as a column never written did. Unindexed beyond the key: both are
-- read by bundle_id. inquiry_subject_entity (N136's rest, T19) is the subject entity R12 records from the document,
-- NULL for none, under R40's read contract: contradiction joins it here (its pairing and its ladder), by the name it had
-- on bundles.
CREATE TABLE IF NOT EXISTS inquiry_bundle_facts (
  bundle_id              TEXT PRIMARY KEY,
  inquiry_basis_count    INTEGER,
  inquiry_superseded_by  TEXT,
  inquiry_subject_entity TEXT
);

-- R53 (A9, bias R40): a question's FINDING, its conclusion, and the project lens in force when it was made, so a change
-- of that lens raises a bias debt on it (bias R33-R38). Written by R12's projection when a document that states its
-- project (promotion R53) enters 'concluded'; a re-conclusion replaces the row. lens_state is 'recorded' (lens_sha the
-- lens's statements_sha), 'none' (no lens was in force for the project: the finding was not made under one), or
-- 'unreadable' (the lens could not be read, or a replay wrote the conclusion): only 'recorded' offers a lens, the rest
-- are undetermined and never filled in. principal is the concluding member's id, NULL for a machine or an unreadable
-- author. Keyed by bundle_id and declared to purge with project_id (R36).
CREATE TABLE IF NOT EXISTS inquiry_findings (
  bundle_id   TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  lens_state  TEXT NOT NULL,
  lens_sha    TEXT,
  principal   TEXT,
  at          TEXT NOT NULL
);

-- R54-R57 (T33-45; ladders section 4.5 "Dated waits on an inquiry", DEC-98, Choices 23): a DATED WAIT is a recheck
-- trigger of an inquiry that carries a date, what the member who set it is waiting for, from whom, and by when. A
-- projection of the document's recheck_triggers[], re-derived at each promotion (R12, R54), one row per wait: a wait
-- keeps set_by and set_at while its text and date are unchanged (matched by both, idx its current position); a trigger
-- re-dated or removed by a later revision ENDS the wait it was ('redated' or 'removed', with who and when) and is kept,
-- never deleted, so what the member was waiting for stays on the record. looked_* is the setter's own look (R56);
-- marked_day the local day the scheduler's tick marked it due (R57), once. Told to its setter alone: declared
-- sight 'owner' (R36). Keyed by bundle_id and cleared with its inquiry.
CREATE TABLE IF NOT EXISTS inquiry_dated_waits (
  wait_id      INTEGER PRIMARY KEY,
  bundle_id    TEXT NOT NULL,
  idx          INTEGER,
  text         TEXT NOT NULL,
  description  TEXT NOT NULL,
  date         TEXT NOT NULL,
  set_by       TEXT,
  set_at       TEXT NOT NULL,
  set_in       TEXT,
  ended        TEXT,
  ended_by     TEXT,
  ended_at     TEXT,
  looked_by    TEXT,
  looked_at    TEXT,
  look_note    TEXT,
  marked_day   TEXT,
  marked_at    TEXT
);
CREATE INDEX IF NOT EXISTS inquiry_dated_waits_bundle ON inquiry_dated_waits(bundle_id);
CREATE INDEX IF NOT EXISTS inquiry_dated_waits_setter ON inquiry_dated_waits(set_by, date);

-- R59 (T41; D13; K2480): the warning a promotion of a question carried for naming a person in no public role, one row
-- per promotion that carried it, with the persons named (JSON [{entity_id, label}]) and her choice: 'went_on' (she saw it
-- before the act and went on), 'warned_at_act' (told by the act's answer), 'pending' (a machine's proposal, told to the
-- member who takes it up), and that member's row once she has. Nothing is refused. Keyed by bundle_id and cleared with
-- its inquiry.
CREATE TABLE IF NOT EXISTS inquiry_person_warnings (
  warning_id   INTEGER PRIMARY KEY,
  bundle_id    TEXT NOT NULL,
  at           TEXT NOT NULL,
  by           TEXT,
  persons      TEXT NOT NULL,
  choice       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inquiry_person_warnings_bundle ON inquiry_person_warnings(bundle_id, choice);

-- R65 (T50; N1124; DEC-32 clause 6): the ground acts recorded for a question, one row per act, oldest first (change_id).
-- The document's Session Log keeps the act's reason and the strength pair BEFORE it, but cannot hold the pair AFTER (the
-- log is part of the bytes the act promotes, and the pair after is read once they have landed), so the act records both
-- pairs here in its own transaction, with the groups as it left them. strength_before and strength_after are the pairs as
-- JSON, NULL where no module answered strength (the act's answer said so). A question grouped before this table has no
-- row: partitionOf reads such an act from the Session Log, with only the pair before. Keyed by bundle_id and cleared
-- with its inquiry.
CREATE TABLE IF NOT EXISTS inquiry_ground_changes (
  change_id        INTEGER PRIMARY KEY,
  bundle_id        TEXT NOT NULL,
  at               TEXT NOT NULL,
  by               TEXT NOT NULL,
  act              TEXT NOT NULL,
  reason           TEXT,
  groups           TEXT NOT NULL,
  strength_before  TEXT,
  strength_after   TEXT
);
CREATE INDEX IF NOT EXISTS inquiry_ground_changes_bundle ON inquiry_ground_changes(bundle_id, change_id);
`;

/** R36: the tables this module declares to purge, each keyed to a bundle by its `bundle_id`. */
export const INQUIRY_TABLES = ["inquiry_exclusions", "inquiry_migration_replays", "inquiry_member_agents",
                              "inquiry_contradiction_links", "inquiry_bundle_facts", "inquiry_findings",
                              "inquiry_dated_waits", "inquiry_person_warnings", "inquiry_ground_changes"];
/** R36 (plan T33, Rules (6)): every table declared explicitly through `record-core.declareTable` (its R21), with the
 *  classes `declarePurge`'s default form gives (purge `clear`, expunge `none`, export `admin-only`, derive `stored`, no
 *  version chain), each with the sight of the bundle it names; `inquiry_findings` also keyed by the project its lens
 *  was read for (R53); the dated waits told to their setter alone, `sight: "owner"` (R54, R55). */
const CLASSES = Object.freeze({ purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored",
                                version_chain: false });
export const INQUIRY_DECLARATIONS = Object.freeze(INQUIRY_TABLES.map((name) => Object.freeze({
  name, ...CLASSES,
  ...(name === "inquiry_findings" ? { keys: ["bundle_id", "project_id"] } : {}),
  ...(name === "inquiry_dated_waits" ? { sight: "owner" } : {}) })));

/** R36 (N136): the table holding the leg count and the superseded-by index, and the relation `legs` is read through
 *  (retrieval R62). */
export const BUNDLE_FACTS = "inquiry_bundle_facts";
export const LEGS_RELATION = Object.freeze({ table: BUNDLE_FACTS, key: "bundle_id", col: "inquiry_basis_count" });
/** R36: the two columns this module held on `bundles` before T18, moved once by `moveBundleFacts`. */
const MOVED = ["inquiry_basis_count", "inquiry_superseded_by"];
/** R36, R40 (N136's rest): the subject entity, held on `bundles` until T19, moved once by `moveSubjectEntity`. */
export const SUBJECT_COLUMN = "inquiry_subject_entity";

/* R54 (T41): `set_in`, the project the promoting act named, added to a dated-waits table created before T41. */
const ADDITIVE = [[BUNDLE_FACTS, SUBJECT_COLUMN, "TEXT"], ["inquiry_dated_waits", "set_in", "TEXT"]];

/** Create the tables, then add a column an earlier shape lacks (an absent table has no columns and was just created
 *  whole). Idempotent: every boot. The subject entity is moved off `bundles` on the boot that gives this module's table
 *  its column (the table created, or the column added), and never again. */
export function migrateInquiry(sql) {
  const bare = INQUIRY_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const subjectHeld = [...sql.exec(`PRAGMA table_info(${BUNDLE_FACTS})`)].some((r) => r.name === SUBJECT_COLUMN);
  for (const [table, column, decl] of ADDITIVE) {
    const have = [...sql.exec(`PRAGMA table_info(${table})`)].map((r) => r.name);
    if (have.length && !have.includes(column)) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
  for (const s of bare.split(";")) { const t = s.trim(); if (t) sql.exec(t); }
  moveBundleFacts(sql);
  if (!subjectHeld) moveSubjectEntity(sql);
}

/** R36 (N136): the leg count and the superseded-by index a store written before T18 holds on `bundles`, copied into
 *  this module's table once. Idempotent: a bundle that already has a row keeps it (every write since goes there), and
 *  a store whose `bundles` never had the columns, or holds no value in them, copies nothing. The columns are left on
 *  such a store's `bundles`, inert: nothing writes or reads them after the move, and dropping a column of record-core's
 *  table is not this module's to do. */
export function moveBundleFacts(sql) {
  const have = new Set([...sql.exec(`PRAGMA table_info(bundles)`)].map((r) => r.name));
  const cols = MOVED.filter((c) => have.has(c));
  if (!cols.length) return 0;
  const [{ n }] = [...sql.exec(`SELECT COUNT(*) AS n FROM ${BUNDLE_FACTS}`)];
  if (n) return 0;
  sql.exec(`INSERT INTO ${BUNDLE_FACTS} (bundle_id, ${cols.join(", ")})
            SELECT bundle_id, ${cols.join(", ")} FROM bundles WHERE ${cols.map((c) => `${c} IS NOT NULL`).join(" OR ")}
            ON CONFLICT(bundle_id) DO NOTHING`);
  const [{ m }] = [...sql.exec(`SELECT COUNT(*) AS m FROM ${BUNDLE_FACTS}`)];
  return m;
}

/** R36, R40 (N136's rest): the subject entity a store written before T19 holds on `bundles`, copied into this module's
 *  table. `migrateInquiry` calls it once, on the boot that gives the table its column, so a value a later revision
 *  cleared is never brought back from the inert copy left on `bundles`; called again it copies the same values onto the
 *  same rows. A bundle that already has a row keeps its other facts. A store whose `bundles` never had the column copies
 *  nothing. The column is left on such a store's `bundles`, inert: nothing writes or reads it after the move, and
 *  dropping a column of record-core's table is not this module's to do. Answers the number of values copied. */
export function moveSubjectEntity(sql) {
  const have = [...sql.exec(`PRAGMA table_info(bundles)`)].some((r) => r.name === SUBJECT_COLUMN);
  if (!have) return 0;
  const [{ n }] = [...sql.exec(`SELECT COUNT(*) AS n FROM bundles WHERE ${SUBJECT_COLUMN} IS NOT NULL AND ${SUBJECT_COLUMN} <> ''`)];
  if (!n) return 0;
  sql.exec(`INSERT INTO ${BUNDLE_FACTS} (bundle_id, ${SUBJECT_COLUMN})
            SELECT bundle_id, ${SUBJECT_COLUMN} FROM bundles WHERE ${SUBJECT_COLUMN} IS NOT NULL AND ${SUBJECT_COLUMN} <> ''
            ON CONFLICT(bundle_id) DO UPDATE SET ${SUBJECT_COLUMN}=excluded.${SUBJECT_COLUMN}`);
  return n;
}
