/* reading-guides' tables (requirements: `build/requirements/reading-guides.md` R9, R3, R7, R12, R13). A group's guides, the
 * history of every act on each (appended, never updated or removed: nothing is deleted, R7), and the machine
 * proposals, kept apart (R12). No table names a bundle, so record-core's single-bundle purge leaves them and the
 * whole-store purge clears them (R9, K23). Civicsmith's guides are frozen data and in no table (R1). */

export const READING_GUIDES_SCHEMA = `
-- R2, R3, R6, R7: one row per group guide, its current state. items_json is the items as R4 passed them (canonical
-- JSON). based_on is a guide's or proposal's id, or an adopted offer's digest (sha256:<hex>); offered_by the
-- offering group's slug for an adopted guide, else NULL. reviewed_by the member whose review approved it, else NULL.
-- purpose (R13) is reading or procedure; a procedure guide's kind is an action kind of the active profiles' view.
-- layer (R18) the active layer whose procedure guide a group guide was drafted from, else NULL (the team's guide for the
-- kind in every layer). review_opt_json (R20) a sole member's opt-out of review, {member, at}, else NULL; reviews_json
-- (R20) the professional reviews recorded at R3's approval, as jurisdictions R40 shapes them, else NULL.
CREATE TABLE IF NOT EXISTS reading_guides (
  guide_id     TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  purpose      TEXT NOT NULL DEFAULT 'reading',
  origin       TEXT NOT NULL,
  items_json   TEXT NOT NULL,
  state        TEXT NOT NULL,
  author       TEXT NOT NULL,
  reviewed_by  TEXT,
  based_on     TEXT,
  offered_by   TEXT,
  layer        TEXT,
  review_opt_json TEXT,
  reviews_json TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reading_guides_kind ON reading_guides(kind, state, updated_at);
-- R3, R7: every act on a guide (draft, adopt, approve, refuse, retire), in the order written (seq), with the state it
-- left and its reason.
CREATE TABLE IF NOT EXISTS reading_guide_history (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  guide_id     TEXT NOT NULL,
  act          TEXT NOT NULL,
  state        TEXT NOT NULL,
  by_member    TEXT NOT NULL,
  reason       TEXT,
  at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reading_guide_history_guide ON reading_guide_history(guide_id, seq);
-- R12: a machine's proposed guide, apart from the guides; only a member's R2 act naming it makes a guide.
CREATE TABLE IF NOT EXISTS reading_guide_proposals (
  proposal_id  TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  purpose      TEXT NOT NULL DEFAULT 'reading',
  items_json   TEXT NOT NULL,
  run          TEXT NOT NULL,
  proposed_by  TEXT NOT NULL,
  at           TEXT NOT NULL
);
`;

/** R9 (record-core R21): the tables, declared explicitly. A group guide's sight is the group's (`sight: "group"`); the
 *  history is appended, never overwritten (`version_chain`). */
const entry = (name, version_chain) => Object.freeze({
  name, keys: Object.freeze([]), purge: "clear", expunge: "none", export: "admin-only", sight: "group",
  derive: "stored", version_chain,
});
export const READING_GUIDES_TABLE_CLASSES = Object.freeze([
  entry("reading_guides", false), entry("reading_guide_history", true), entry("reading_guide_proposals", false),
]);
export const READING_GUIDES_TABLES = Object.freeze(READING_GUIDES_TABLE_CLASSES.map((e) => e.name));

/** Creates the tables where absent, and adds R13's `purpose` to a store made before it (every guide there a reading
 *  guide), and R18's `layer` and R20's `review_opt_json` and `reviews_json`, empty, to one made before T53. Idempotent. */
export function migrateReadingGuides(sql) {
  const bare = READING_GUIDES_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  for (const t of ["reading_guides", "reading_guide_proposals"]) {
    const cols = [...sql.exec(`PRAGMA table_info(${t})`)].map((c) => c.name);
    if (!cols.includes("purpose")) sql.exec(`ALTER TABLE ${t} ADD COLUMN purpose TEXT NOT NULL DEFAULT 'reading'`);
  }
  const cols = [...sql.exec(`PRAGMA table_info(reading_guides)`)].map((c) => c.name);
  for (const c of ["layer", "review_opt_json", "reviews_json"]) if (!cols.includes(c)) sql.exec(`ALTER TABLE reading_guides ADD COLUMN ${c} TEXT`);
}
