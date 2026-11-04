/* case-import's tables (requirements: `build/requirements/case-import.md` R1–R9 (R4's group fields, T46), R12, R13, R17, R18, R21, R29, R30).
 *
 * APPEND-ONLY (R12): no act of this module updates or deletes a row. An import, an edition, its files, each recreation
 * (one `case_import_checks` row and its results and calculations per run: the import's, then each completion's), each acceptance,
 * withdrawal, flag and clear, each watch, its end, each docket read and each entry it saw is a row of its own, and what is "in force" or "open" is read from the rows that follow it.
 *
 * THE BYTES (R1, R13). Every part of a case file, and every document a completion supplies, is held by its SHA-256 in
 * `case_import_blobs`, cut into chunks of at most `BLOB_CHUNK` bytes (a row's value is bounded on the plane's storage).
 * A file of the case file is held by its SHA-256 in `case_import_files`, its bytes those of the part that carries it,
 * read back by the one reader of the format (`case-checker` R19), so nothing is stored twice. The bytes live in this module's tables, so record-core's
 * purge clears them with the import (R13); no object store is needed, and none could be purged.
 *
 * Every table is declared to record-core's purge as the import's own record, with no bundle key: an import is no bundle
 * (R2), so only the whole-store purge clears it, the bytes with it. */

export const BLOB_CHUNK = 1024 * 1024;

export const CASE_IMPORT_SCHEMA = `
-- An import: one per source group, case and lens (its id is the SHA-256 of canonical {group, case, lens}).
CREATE TABLE IF NOT EXISTS case_imports (
  import_id     TEXT PRIMARY KEY,
  source_group  TEXT NOT NULL,
  case_id       TEXT NOT NULL,
  lens          TEXT,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
-- An imported edition, side by side with the import's others; never replaced.
CREATE TABLE IF NOT EXISTS case_import_editions (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  manifest_sha  TEXT NOT NULL,
  format        TEXT,
  case_doc_sha  TEXT,
  source_bar    TEXT,
  imported_by   TEXT NOT NULL,
  imported_at   TEXT NOT NULL,
  PRIMARY KEY (import_id, edition)
);
-- Each part of the edition's case file, in order, by SHA-256.
CREATE TABLE IF NOT EXISTS case_import_parts (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  idx           INTEGER NOT NULL,
  sha           TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  PRIMARY KEY (import_id, edition, idx)
);
-- Each file of the case file, by the SHA-256 of the bytes the parts carry, and the part the manifest places it in.
CREATE TABLE IF NOT EXISTS case_import_files (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  path          TEXT NOT NULL,
  kind          TEXT,
  sha           TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  part          INTEGER NOT NULL,
  PRIMARY KEY (import_id, edition, path)
);
CREATE INDEX IF NOT EXISTS case_import_files_sha ON case_import_files (sha);
-- Bytes by SHA-256, in chunks.
CREATE TABLE IF NOT EXISTS case_import_blobs (
  sha           TEXT NOT NULL,
  chunk         INTEGER NOT NULL,
  data          BLOB NOT NULL,
  PRIMARY KEY (sha, chunk)
);
-- R3: one recreation of an edition: at its import, and again at each completion (R5).
CREATE TABLE IF NOT EXISTS case_import_checks (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  cause         TEXT NOT NULL,
  document_sha  TEXT,
  checker       TEXT NOT NULL,
  answer        TEXT NOT NULL,
  checked_by    TEXT NOT NULL,
  checked_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_checks_edition ON case_import_checks (import_id, edition, rn);
-- R3: each finding's result at one recreation.
CREATE TABLE IF NOT EXISTS case_import_results (
  check_rn      INTEGER NOT NULL,
  ord           INTEGER NOT NULL,
  finding       TEXT NOT NULL,
  role          TEXT,
  result        TEXT NOT NULL,
  missing       TEXT NOT NULL,
  differs       TEXT NOT NULL,
  pair          TEXT,
  published     TEXT,
  PRIMARY KEY (check_rn, ord)
);
-- R3, R21: each calculation the edition carries, as recreated at one recreation: its result (recreated, differs,
-- not_recreated), what is missing and what differs, the recomputed values, the source's statement beside them (held
-- only as the source's, never as a record row), and case-checker's own answer for it (its R20).
CREATE TABLE IF NOT EXISTS case_import_calculations (
  check_rn      INTEGER NOT NULL,
  ord           INTEGER NOT NULL,
  calc          TEXT NOT NULL,
  result        TEXT NOT NULL,
  missing       TEXT NOT NULL,
  differs       TEXT NOT NULL,
  recomputed    TEXT,
  stated        TEXT NOT NULL,
  checker       TEXT,
  PRIMARY KEY (check_rn, ord)
);
-- R5: a document a member supplied that completes a missing material.
CREATE TABLE IF NOT EXISTS case_import_documents (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  sha           TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL,
  PRIMARY KEY (import_id, edition, sha)
);
-- R6: an acceptance of one edition for named findings.
CREATE TABLE IF NOT EXISTS case_import_acceptances (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  findings      TEXT NOT NULL,
  checked       TEXT NOT NULL,
  reason        TEXT NOT NULL,
  gaps          TEXT NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_acceptances_edition ON case_import_acceptances (import_id, edition, rn);
-- R7: a withdrawal of every acceptance of one edition then in force.
CREATE TABLE IF NOT EXISTS case_import_withdrawals (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  acceptances   TEXT NOT NULL,
  refs          TEXT NOT NULL,
  reason        TEXT NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
-- R8: a flag on an edition, or on one of its findings.
CREATE TABLE IF NOT EXISTS case_import_flags (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  finding       TEXT,
  issue         TEXT NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_flags_edition ON case_import_flags (import_id, edition, rn);
-- R8: a flag cleared, once.
CREATE TABLE IF NOT EXISTS case_import_clears (
  flag_rn       INTEGER PRIMARY KEY,
  reason        TEXT NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
-- R1, R18: the signing keys each edition's manifest lists (wire base64), one row per edition, written at its import.
CREATE TABLE IF NOT EXISTS case_import_edition_keys (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  keys          TEXT NOT NULL,
  PRIMARY KEY (import_id, edition)
);
-- R4 (T46; N903): the source group's public identity and declared stake (public-read R34's group_fields) as the
-- caller read them at read_at, recorded with the edition when it was first imported, only when they are in R34's shape
-- and name the manifest's group; the source's statement, unsigned, never this group's. At most one row per edition.
CREATE TABLE IF NOT EXISTS case_import_group_fields (
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  fields        TEXT NOT NULL,
  read_at       TEXT NOT NULL,
  PRIMARY KEY (import_id, edition)
);
-- R17: a watch of the publisher's docket. The latest watch of an import is in force unless it has ended; a later one
-- replaces an earlier.
-- R34 (T53; DEC-461): the source's statement of the passages it published without a grade, as the edition's case
-- document states it (case-grammar R36), recorded once with the edition: stated 1 with its rows (a list, empty when the
-- document carries no block), or stated 0 for a format that predates the statement (unreadable 1 when the key is
-- present and not a list). Never recomputed or filled; append-only (R12).
CREATE TABLE IF NOT EXISTS case_import_ungraded (
  import_id TEXT NOT NULL,
  edition INTEGER NOT NULL,
  stated INTEGER NOT NULL,
  unreadable INTEGER NOT NULL DEFAULT 0,
  rows TEXT,
  PRIMARY KEY (import_id, edition)
);
CREATE TABLE IF NOT EXISTS case_import_watches (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  publisher     TEXT NOT NULL,
  docket        TEXT NOT NULL,
  set_by        TEXT NOT NULL,
  set_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_watches_import ON case_import_watches (import_id, rn);
-- R17: a watch ended, once.
CREATE TABLE IF NOT EXISTS case_import_watch_ends (
  watch_rn      INTEGER PRIMARY KEY,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
-- R18: one docket read, under the watch in force.
CREATE TABLE IF NOT EXISTS case_import_docket_reads (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  watch_rn      INTEGER NOT NULL,
  docket        TEXT NOT NULL,
  at            TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  reason        TEXT,
  entries_seen  INTEGER NOT NULL,
  last_entry    TEXT,
  recorded_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_docket_reads_watch ON case_import_docket_reads (watch_rn, rn);
-- R18: one public docket entry seen, verified or refused.
CREATE TABLE IF NOT EXISTS case_import_docket_entries (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id     TEXT NOT NULL,
  read_rn       INTEGER NOT NULL,
  seq           INTEGER,
  digest        TEXT,
  json          TEXT,
  signature     TEXT,
  published_at  TEXT,
  status        TEXT NOT NULL,
  failed        TEXT,
  detail        TEXT,
  held_digest   TEXT,
  kind          TEXT,
  edition       TEXT,
  date          TEXT,
  key_b64       TEXT,
  key_listed    INTEGER,
  chain         TEXT,
  recorded_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_docket_entries_import ON case_import_docket_entries (import_id, seq, rn);
-- R29 (T51; K4169): a project of this group declared a rerun of an imported edition. Never edited; one per project and edition.
CREATE TABLE IF NOT EXISTS case_import_reruns (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  project       TEXT NOT NULL,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_reruns_project ON case_import_reruns (project, import_id, edition);
-- R30 (T51; K4169): a member's pairing of one source finding with one of the project's own, or its withdrawal. Append-only;
-- the latest entry for a pair stands.
CREATE TABLE IF NOT EXISTS case_import_rerun_pairs (
  rn            INTEGER PRIMARY KEY AUTOINCREMENT,
  project       TEXT NOT NULL,
  import_id     TEXT NOT NULL,
  edition       INTEGER NOT NULL,
  source_finding TEXT NOT NULL,
  own_finding   TEXT NOT NULL,
  withdrawn     INTEGER NOT NULL,
  by_member     TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS case_import_rerun_pairs_project ON case_import_rerun_pairs (project, import_id, edition, rn);
`;

/** The tables, every one cleared by the whole-store purge only (R13). */
export const CASE_IMPORT_TABLES = Object.freeze(["case_imports", "case_import_editions", "case_import_parts",
  "case_import_files", "case_import_blobs", "case_import_checks", "case_import_results", "case_import_calculations",
  "case_import_documents",
  "case_import_acceptances", "case_import_withdrawals", "case_import_flags", "case_import_clears",
  "case_import_edition_keys", "case_import_group_fields", "case_import_watches", "case_import_watch_ends", "case_import_docket_reads",
  "case_import_docket_entries", "case_import_reruns", "case_import_rerun_pairs", "case_import_ungraded"]);

/** Creates the tables; idempotent. */
export function migrateCaseImport(sql) {
  const bare = CASE_IMPORT_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
}
