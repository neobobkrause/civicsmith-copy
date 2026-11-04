/* registers' tables (requirements: `build/requirements/registers.md`, R21, R22, R41). The cells of a row version live once
 * per sight scope in `register_cells`; `register_rows` is the search index over them, derived and rebuildable; each import
 * keeps one descriptor row per row it read (`register_import_rows`: which version stood at which place), so two imports can
 * be compared and a row read as an old import saw it without storing a version twice. Rows, cells and keys are never
 * exported (R41); descriptors, interests, proposals, own definitions and tombstones are.
 * A scope key is `team` or `project:<id>` (R19). */

export const REGISTERS_SCHEMA = `
-- R6: a proposal for a register not on the list. Withdrawn is a state; the row stays.
CREATE TABLE IF NOT EXISTS register_proposals (
  proposal_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  url_norm    TEXT NOT NULL,
  publisher   TEXT NOT NULL,
  note        TEXT,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL,
  state       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS register_proposals_url ON register_proposals(url_norm);
-- R7: a team's own definition; every revision is kept, the latest stands.
CREATE TABLE IF NOT EXISTS register_definitions (
  def_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL,
  version     INTEGER NOT NULL,
  definition  TEXT NOT NULL,   -- JSON
  terms       TEXT NOT NULL,   -- the member's own statement, verbatim
  proposal_id INTEGER,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS register_definitions_key ON register_definitions(key, version);
-- R11-R14: an import, queued, run in slices, read into the index.
CREATE TABLE IF NOT EXISTS register_imports (
  import_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  register      TEXT NOT NULL,
  filter        TEXT NOT NULL,   -- JSON
  filter_fp     TEXT NOT NULL,
  scope         TEXT NOT NULL,   -- project | team
  scope_key     TEXT NOT NULL,
  project       TEXT,
  kind          TEXT NOT NULL,   -- import | refresh
  state         TEXT NOT NULL,
  reason        TEXT,
  retries       INTEGER NOT NULL DEFAULT 0,
  author        TEXT NOT NULL,
  on_behalf     TEXT,
  interest_id   INTEGER,
  previous      INTEGER,         -- the import a refresh is compared with
  holes         TEXT,            -- JSON
  pieces        TEXT NOT NULL,   -- JSON: [{piece, state, ...}] (R13, R14)
  cursor        TEXT,            -- JSON: where fetching and reading stand
  queued_at     TEXT NOT NULL,
  started_at    TEXT,
  finished_at   TEXT,
  imported_at   TEXT,
  source_date   TEXT,
  took_ms       INTEGER,
  bytes_in      INTEGER NOT NULL DEFAULT 0,
  rows_in       INTEGER,
  rows_out      INTEGER,
  rows_undetermined INTEGER,
  rows_new      INTEGER NOT NULL DEFAULT 0,
  rows_unchanged INTEGER NOT NULL DEFAULT 0,
  rows_tombstoned INTEGER NOT NULL DEFAULT 0,
  reduction     TEXT,            -- JSON (R15): names and counts only
  probe         TEXT,            -- JSON: the validators at the last look (R33)
  complete      INTEGER NOT NULL DEFAULT 0,   -- 1 once the source was read to its end
  due_ms        INTEGER NOT NULL DEFAULT 0,
  epoch         TEXT,
  paused_reason TEXT,
  project_vis   TEXT
);
CREATE INDEX IF NOT EXISTS register_imports_state ON register_imports(state);
CREATE INDEX IF NOT EXISTS register_imports_reg ON register_imports(register, scope_key, filter_fp);
-- R14, R22: a segment of an import: its capture, the original's fingerprint and the dates
CREATE TABLE IF NOT EXISTS register_segments (
  import_id    INTEGER NOT NULL,
  piece        TEXT NOT NULL,
  n            INTEGER NOT NULL,
  sha256       TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  rows         INTEGER NOT NULL,
  final        INTEGER NOT NULL,
  project      TEXT,
  address      TEXT,
  retrieved_at TEXT,
  source_date  TEXT,
  original_sha256 TEXT,
  original_bytes INTEGER,
  covers       TEXT,
  bundle_id    TEXT,
  PRIMARY KEY (import_id, piece, n)
);
CREATE INDEX IF NOT EXISTS register_segments_sha ON register_segments(sha256);
-- R21: which version stood at which place of an import (a descriptor, no cell)
CREATE TABLE IF NOT EXISTS register_import_rows (
  import_id    INTEGER NOT NULL,
  register     TEXT NOT NULL,
  piece        TEXT NOT NULL,
  seg_n        INTEGER NOT NULL,
  row_no       INTEGER NOT NULL,
  row_key      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  src_row      INTEGER NOT NULL,
  project      TEXT,
  PRIMARY KEY (import_id, piece, seg_n, row_no)
);
CREATE INDEX IF NOT EXISTS register_import_rows_key ON register_import_rows(import_id, row_key);
CREATE INDEX IF NOT EXISTS register_import_rows_reg ON register_import_rows(register, row_key);
-- R21: a row version's cells, once per sight scope
CREATE TABLE IF NOT EXISTS register_cells (
  scope_key    TEXT NOT NULL,
  register     TEXT NOT NULL,
  row_key      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  project      TEXT,
  first_import INTEGER NOT NULL,
  segment_sha  TEXT NOT NULL,
  seg_row      INTEGER,         -- the pointer into the segment that first held it: row number (header 0) and byte range
  byte_at      INTEGER,
  byte_len     INTEGER,
  src_row      INTEGER NOT NULL,
  cells        TEXT NOT NULL,   -- JSON: the kept cells
  PRIMARY KEY (scope_key, register, row_key, content_hash)
);
CREATE INDEX IF NOT EXISTS register_cells_key ON register_cells(register, row_key);
CREATE INDEX IF NOT EXISTS register_cells_seg ON register_cells(segment_sha);
-- R22: the search index, derived from the cells and rebuildable
CREATE TABLE IF NOT EXISTS register_rows (
  scope_key    TEXT NOT NULL,
  register     TEXT NOT NULL,
  row_key      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  project      TEXT,
  name_tokens  TEXT NOT NULL,
  org_tokens   TEXT NOT NULL,
  amount_micro INTEGER,
  date         TEXT,
  filer_id     TEXT,
  form         TEXT,
  licence_no   TEXT,
  docket_no    TEXT,
  company_no   TEXT,
  city         TEXT,
  state        TEXT,
  zip5         TEXT,
  undetermined TEXT NOT NULL,
  PRIMARY KEY (scope_key, register, row_key, content_hash)
);
CREATE INDEX IF NOT EXISTS register_rows_date ON register_rows(register, scope_key, date);
-- R23: a number criterion reads its rows already in the search order (date descending, none last, then key), so a page
-- takes its first rows and never sorts every match: its time does not grow with the rows held
CREATE INDEX IF NOT EXISTS register_rows_filer_o ON register_rows(register, filer_id, (date IS NULL), date DESC, row_key, content_hash, scope_key) WHERE filer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS register_rows_form_o ON register_rows(register, form, (date IS NULL), date DESC, row_key, content_hash, scope_key) WHERE form IS NOT NULL;
CREATE INDEX IF NOT EXISTS register_rows_licence_o ON register_rows(register, licence_no, (date IS NULL), date DESC, row_key, content_hash, scope_key) WHERE licence_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS register_rows_docket_o ON register_rows(register, docket_no, (date IS NULL), date DESC, row_key, content_hash, scope_key) WHERE docket_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS register_rows_amount ON register_rows(register, amount_micro);
-- R23: the name and organization tokens of each index row, so a name criterion is an index read, not a scan (derived, rebuildable)
CREATE TABLE IF NOT EXISTS register_tokens (
  kind         TEXT NOT NULL,   -- n (name) | o (organization)
  token        TEXT NOT NULL,
  scope_key    TEXT NOT NULL,
  register     TEXT NOT NULL,
  row_key      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  project      TEXT,
  PRIMARY KEY (kind, token, scope_key, register, row_key, content_hash)
);
-- R32: a project's interest in a register; every version is kept
CREATE TABLE IF NOT EXISTS register_interests (
  interest_id INTEGER NOT NULL,
  version     INTEGER NOT NULL,
  register    TEXT NOT NULL,
  project     TEXT NOT NULL,
  filter      TEXT NOT NULL,
  filter_fp   TEXT NOT NULL,
  watch       INTEGER NOT NULL,
  ended       INTEGER NOT NULL DEFAULT 0,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (interest_id, version)
);
CREATE INDEX IF NOT EXISTS register_interests_project ON register_interests(project, register);
-- R33, R34: what a refresh changed, as counts
CREATE TABLE IF NOT EXISTS register_changes (
  change_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id   INTEGER NOT NULL,
  previous    INTEGER NOT NULL,
  interest_id INTEGER,
  project     TEXT,
  register    TEXT NOT NULL,
  at          TEXT NOT NULL,
  added       INTEGER NOT NULL,
  changed     INTEGER NOT NULL,
  removed     INTEGER NOT NULL,
  possibly_removed INTEGER NOT NULL
);
-- R28: a row cited as a labelled extract
CREATE TABLE IF NOT EXISTS register_cites (
  register     TEXT NOT NULL,
  row_key      TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  import_id    INTEGER NOT NULL,
  content_id   TEXT NOT NULL,
  project      TEXT,
  by           TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (register, row_key, content_hash, import_id)
);
-- R30, R31: a removed row key; a re-import skips it
CREATE TABLE IF NOT EXISTS register_removed (
  register TEXT NOT NULL,
  row_key  TEXT NOT NULL,
  PRIMARY KEY (register, row_key)
);
-- R46: the lookup's use count, unattributed
CREATE TABLE IF NOT EXISTS register_lookup_use (
  day   TEXT PRIMARY KEY,
  count INTEGER NOT NULL
);
`;

const base = { purge: "clear", expunge: "none", export: "yes", sight: "group", derive: "stored", version_chain: false };
const projectKeyed = { keys: ["project"], sight: "source" };

/** R22: the declarations, each with its classes (record-core R21). The index's `rebuild` is the module's (`rebuildOf`). */
export function registersTables(rebuildOf, rebuildTokensOf = () => []) {
  return Object.freeze([
    { ...base, name: "register_proposals", version_chain: true },
    { ...base, name: "register_definitions", version_chain: true },
    { ...base, ...projectKeyed, name: "register_imports", version_chain: true },
    { ...base, ...projectKeyed, name: "register_segments" },
    /* R30: the removal's tombstone is recorded over the descriptors (the cells and the index are the port's to remove) */
    { ...base, ...projectKeyed, name: "register_import_rows", export: "never", expunge: "tombstone" },
    { ...base, ...projectKeyed, name: "register_cells", export: "never", expunge: "tombstone" },
    { ...base, ...projectKeyed, name: "register_rows", export: "never", expunge: "tombstone", derive: "derived-rebuildable",
      key: ["scope_key", "register", "row_key", "content_hash"], from: ["register_cells"], rebuild: (scope) => rebuildOf(scope) },
    { ...base, ...projectKeyed, name: "register_tokens", export: "never", expunge: "tombstone", derive: "derived-rebuildable",
      key: ["kind", "token", "scope_key", "register", "row_key", "content_hash"], from: ["register_cells"], rebuild: (scope) => rebuildTokensOf(scope) },
    { ...base, ...projectKeyed, name: "register_interests", version_chain: true },
    { ...base, ...projectKeyed, name: "register_changes" },
    { ...base, export: "yes", name: "register_removed" },
    { ...base, ...projectKeyed, export: "never", name: "register_cites" },
    { ...base, name: "register_lookup_use" },
  ]);
}

export function migrateRegisters(sql) {
  const bare = REGISTERS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";")) if (s.trim()) sql.exec(s);
}
