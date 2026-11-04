/* action-clocks' tables (requirements: `build/requirements/action-clocks.md`, R2, R4–R6, R9, R13; K4, K617, K624).
 * `action_clock_proposals` is copied from `actions`' schema with its comment (R2 was `actions` R32); `actions`' copy is
 * gone (K914), so this module alone creates it and declares it. `action_reminders` is new (R4–R6, K624 (3)). Each is
 * keyed by the action's `bundle_id` and declared to record-core with its classes (`declareTable`, its R21; plan T33
 * Rules (6)). T33-74 adds the proposal's trace and its adoption (R2, R13), as columns a held table gains in place. */

export const ACTION_CLOCKS_SCHEMA = `
-- R2: A CLOCK ENTRY COMPUTED FROM A PROFILE DEADLINE, STORED APART FROM
-- clock[]. A proposer's restatement of the same rule replaces its own row.
-- date is NULL when the computation is undetermined, and why says why. A
-- member states a clock entry by a revision of the action; nothing here is one.
CREATE TABLE IF NOT EXISTS action_clock_proposals (
  bundle_id   TEXT NOT NULL,   -- the action
  proposed_by TEXT NOT NULL,   -- the control plane's stamp
  rule        TEXT NOT NULL,   -- the profile deadline's rule
  date        TEXT,            -- YYYY-MM-DD, or NULL when undetermined
  basis       TEXT NOT NULL,   -- the rule's citation and its profile basis
  entry_json  TEXT NOT NULL,   -- the proposed {text, description, date, basis, status}
  why         TEXT,            -- why the date is undetermined, when it is
  proposed_at TEXT NOT NULL,
  trace_json  TEXT,            -- R2: civil-time's trace, with the candidates, extension and observed practice
  adopted_by  TEXT,            -- R13: the member who adopted it into clock[], and when, at which position
  adopted_at  TEXT,
  adopted_ord INTEGER,
  layer       TEXT,            -- R28 (T53): the layer whose rule it is, its rule then stored <layer id>:<rule>; NULL before, or in a view of no layers
  PRIMARY KEY (bundle_id, proposed_by, rule)
);

-- R4-R6 (DEC-94, K624 (3)): A MEMBER'S REQUEST TO BE REMINDED of one dated
-- clock entry of an action on one day. The member's own record, never a field
-- or a revision of the action's document. A row is never deleted by an act: a
-- change or a removal stamps removed_at (and a change adds the new day's row),
-- an answer stamps answered_at. Standing = neither stamped.
CREATE TABLE IF NOT EXISTS action_reminders (
  rid         INTEGER PRIMARY KEY,
  bundle_id   TEXT NOT NULL,   -- the action
  entry       INTEGER NOT NULL,-- the clock entry's position in clock[]
  day         TEXT NOT NULL,   -- YYYY-MM-DD, the day the member asked for
  set_by      TEXT NOT NULL,   -- the member, as the control plane stamps them
  set_at      TEXT NOT NULL,
  answered_at TEXT,            -- when the member answered it (R6)
  removed_at  TEXT             -- when the member changed or removed it (R4)
);
CREATE INDEX IF NOT EXISTS action_reminders_due ON action_reminders(day, bundle_id, entry);
CREATE INDEX IF NOT EXISTS action_reminders_action ON action_reminders(bundle_id, entry, day, set_by);
`;

/** The tables, each keyed to the action by `bundle_id` (record-core R21, R46). */
export const ACTION_CLOCKS_TABLES = Object.freeze(["action_clock_proposals", "action_reminders"]);

/** R9 (plan T33 Rules (6)): each table's classes as `record-core.declareTable` takes them (its R21): cleared by a purge,
 *  never expunged row by row, exported to an administrator only, seen as the action is, stored, never a version chain. */
export const ACTION_CLOCKS_TABLE_CLASSES = Object.freeze(ACTION_CLOCKS_TABLES.map((name) => Object.freeze({
  name, purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false })));

/* The columns a table created before T33-74 gains in place (CREATE TABLE IF NOT EXISTS leaves a held table as it was). */
const ADDED_COLUMNS = [["action_clock_proposals", "trace_json", "TEXT"], ["action_clock_proposals", "adopted_by", "TEXT"],
                       ["action_clock_proposals", "adopted_at", "TEXT"], ["action_clock_proposals", "adopted_ord", "INTEGER"],
                       ["action_clock_proposals", "layer", "TEXT"]];

/** Creates the tables, and adds the columns a held table lacks; idempotent. */
export function migrateActionClocks(sql) {
  const bare = ACTION_CLOCKS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--"))
    .map((l) => l.replace(/\s--.*$/, "")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  for (const [t, c, type] of ADDED_COLUMNS) {
    const held = [...sql.exec(`PRAGMA table_info(${t})`)].some((r) => r.name === c);
    if (!held) sql.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`);
  }
}
