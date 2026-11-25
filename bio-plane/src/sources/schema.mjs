/* sources' tables (requirements: `build/requirements/sources.md`; K509 (1): new, nothing moved). A source's history is
 * append-only: an entry, a consent, a withdrawal and a read are each a row written once and never updated or removed
 * (DEC-78 item 5: a dated, attributed history, never one overwritten field). Every table is declared to record-core's
 * purge as exempt (R13), each with its classes (R19): a source's history outlives any purge of the record. A value is held only in
 * `source_entries.value`, read only by the members `source_sight` lists (R5). The knocker secret is never held; only
 * the digest and pseudonym the doorbell answers (doorbell R14). */

export const SOURCES_SCHEMA = `
-- R1: one row per source: one per pseudonym (knocker_digest and pseudonym set), one per knock sent without a secret
-- (both null, first_knock naming it). Minted on first read and kept.
CREATE TABLE IF NOT EXISTS sources (
  source_id      TEXT PRIMARY KEY,
  pseudonym      TEXT UNIQUE,
  knocker_digest TEXT,
  first_knock    TEXT NOT NULL,
  minted_at      TEXT NOT NULL
);
-- R1: each pulled knock a source stands behind, with the receipt the capture's own source names.
CREATE TABLE IF NOT EXISTS source_knocks (
  knock_id       TEXT PRIMARY KEY,
  source_id      TEXT NOT NULL,
  capture_sha    TEXT NOT NULL,
  bytes          INTEGER NOT NULL,
  received       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS source_knocks_capture ON source_knocks(capture_sha, received, knock_id);
-- R2–R4, R6: one disclosure, appended once. value is null for recorded = 0 (R4) and for a link (R6).
CREATE TABLE IF NOT EXISTS source_entries (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id       TEXT NOT NULL UNIQUE,
  source_id      TEXT NOT NULL,
  kind           TEXT NOT NULL,
  attribute      TEXT,
  value          TEXT,
  recorded       INTEGER NOT NULL,
  how            TEXT NOT NULL,
  known_to       TEXT NOT NULL,
  evidence_json  TEXT NOT NULL,
  claimed_by     TEXT,
  claimed_at     TEXT,
  confirms       TEXT,
  link_to        TEXT,
  basis          TEXT,
  by             TEXT NOT NULL,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS source_entries_source ON source_entries(source_id, seq);
CREATE INDEX IF NOT EXISTS source_entries_link ON source_entries(link_to, seq);
-- R5: who may read a stored value.
CREATE TABLE IF NOT EXISTS source_sight (
  entry_id       TEXT NOT NULL,
  member_id      TEXT NOT NULL,
  PRIMARY KEY (entry_id, member_id)
);
-- R7, R11: consents and withdrawals, in order. via is 'member' (R7) or 'secret' (R11).
CREATE TABLE IF NOT EXISTS source_consents (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id      TEXT NOT NULL,
  entry_id       TEXT NOT NULL,
  act            TEXT NOT NULL,
  audience       TEXT NOT NULL,
  evidence_json  TEXT,
  via            TEXT NOT NULL,
  by             TEXT,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS source_consents_entry ON source_consents(entry_id, seq);
-- R5: each read that answered a value.
CREATE TABLE IF NOT EXISTS source_reads (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id      TEXT NOT NULL,
  entry_id       TEXT NOT NULL,
  reader         TEXT NOT NULL,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS source_reads_source ON source_reads(source_id, seq);
-- R16: a capture marked as a member-keyed result, by the member who captured it. Appended once, never edited or removed;
-- the latest mark of a capture is the one read (R17). It holds the vendor and the terms as stated, never a query, a
-- search term or a result the member did not capture (R18).
CREATE TABLE IF NOT EXISTS source_keyed_marks (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_sha    TEXT NOT NULL,
  service        TEXT NOT NULL,
  terms          TEXT,
  by             TEXT NOT NULL,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS source_keyed_marks_capture ON source_keyed_marks(capture_sha, seq);
`;

/** R13, R19: every table, declared explicitly through record-core's `declareTable` (its R21), each exempt from purge
 *  (R13) and never expunged. What names or describes a person (a source's digest, its disclosures and stored values,
 *  who may read them, the reads, the consents' evidence, the keyed marks) is never exported (K1489); the knock
 *  receipts, which hold no value (R15), go to administrators only. A table that only appends is a version chain. */
const CLASSES = (exportClass, sight, versionChain) =>
  ({ purge: "exempt", expunge: "none", export: exportClass, sight, derive: "stored", version_chain: versionChain });
export const SOURCES_TABLE_CLASSES = Object.freeze([
  { name: "sources", ...CLASSES("never", "group", false) },
  { name: "source_knocks", ...CLASSES("admin-only", "group", false) },
  { name: "source_entries", ...CLASSES("never", "source", true) },
  { name: "source_sight", ...CLASSES("never", "source", false) },
  { name: "source_consents", ...CLASSES("never", "source", true) },
  { name: "source_reads", ...CLASSES("never", "source", false) },
  { name: "source_keyed_marks", ...CLASSES("never", "source", true) },
].map((e) => Object.freeze(e)));
export const SOURCES_TABLES = Object.freeze(SOURCES_TABLE_CLASSES.map((e) => e.name));

export function migrateSources(sql) {
  const bare = SOURCES_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
}
