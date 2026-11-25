/* lines: the three tables this module owns (R17, R19). `lines` and `line_bound_cache` are a stated read contract
   (R17); `line_withdrawals` holds who withdrew a line, when and why (R8). Every write to them is this module's. */
export const LINES_SCHEMA = `
CREATE TABLE IF NOT EXISTS lines (
  line_id      TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  from_entity  TEXT NOT NULL,
  to_entity    TEXT NOT NULL,
  role         TEXT,
  capacity     TEXT,
  title        TEXT,              -- holds only: the post's title as the basis words it, kept as written (T34, N573)
  valid_json   TEXT NOT NULL,     -- the validity as given: {from, to, precision, zone}
  from_event   TEXT,              -- an event bound's event, so R6 finds the lines it bounds
  to_event     TEXT,
  basis_form   TEXT NOT NULL,     -- passage | rule | testimony
  basis_json   TEXT NOT NULL,
  capture_sha  TEXT,              -- the capture the basis cites, when it cites one
  sight_bundle TEXT,              -- R19: the bundle whose sight the line follows; NULL is group-wide
  recorded_at  TEXT,              -- R5: a register row's own record instant
  asserted_by  TEXT NOT NULL,
  assertion    TEXT NOT NULL,
  end_from     TEXT NOT NULL,
  end_to       TEXT NOT NULL,
  at           TEXT NOT NULL,
  withdrawn    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lines_from ON lines (from_entity, kind);
CREATE INDEX IF NOT EXISTS lines_to ON lines (to_entity, kind);
CREATE INDEX IF NOT EXISTS lines_from_event ON lines (from_event);
CREATE INDEX IF NOT EXISTS lines_to_event ON lines (to_event);
CREATE TABLE IF NOT EXISTS line_bound_cache (
  line_id        TEXT PRIMARY KEY,
  from_instant   TEXT,
  to_instant     TEXT,
  precision      TEXT,
  zone           TEXT,
  from_precision TEXT,
  to_precision   TEXT,
  from_zone      TEXT,
  to_zone        TEXT
);
CREATE TABLE IF NOT EXISTS line_current_through (   -- R21: "current as of" statements on an open-ended holds line
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,      -- the order recorded: a later one supersedes, the earlier kept
  line_id      TEXT NOT NULL,
  day          TEXT NOT NULL,
  basis_form   TEXT NOT NULL,
  basis_json   TEXT NOT NULL,
  capture_sha  TEXT,
  sight_bundle TEXT,
  by_actor     TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS line_current_through_line ON line_current_through (line_id, seq);
CREATE TABLE IF NOT EXISTS line_withdrawals (
  line_id  TEXT PRIMARY KEY,
  reason   TEXT NOT NULL,
  by_actor TEXT NOT NULL,
  at       TEXT NOT NULL
);
`;

/* Columns added to a table after its first release, each `[table, column, declaration]`: a store made before them gains
   them at boot (`migrate`), so a store migrated forward and a fresh one present the same table. */
export const LINES_ADDITIVE_COLUMNS = Object.freeze([["lines", "title", "TEXT"]]);

export const LINES_TABLES = Object.freeze(["lines", "line_bound_cache", "line_withdrawals", "line_current_through"]);
