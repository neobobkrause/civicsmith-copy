/* law-relations' tables (requirements: `build/requirements/law-relations.md`, R13, R15, R16). Split from `standards`
 * (K1961): the five tables `standards/schema.mjs` created for its law relations, with their names, columns and indexes
 * unchanged, so a store created before the split needs no migration. Every row is written once and never updated or
 * removed (R15): a relation, link or treatment is withdrawn in `law_withdrawals`, kept with who, when and why. Each
 * table is declared to `record-core` under `law-relations` (R15), keyed for a single-bundle purge by the standard ids
 * its rows name. R9 (T35) adds one nullable column, `law_relations.edition`, added where absent and never filled for a
 * row recorded before it. */

export const LAW_SCHEMA = `
-- R1, R2: a law relation from one standard (or a portion of it) to another, recorded by a member's act. 'class' keeps
-- temporal and referential apart (D192); a temporal relation's effective date, or its enactment event and edge, bounds
-- the version it amends (R10). Withdrawn in law_withdrawals, never edited or deleted (R15).
CREATE TABLE IF NOT EXISTS law_relations (
  relation_id     TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  class           TEXT NOT NULL,
  from_standard   TEXT NOT NULL,
  from_portion    TEXT,
  to_standard     TEXT NOT NULL,
  to_portion      TEXT,
  citation        TEXT NOT NULL,
  effective_date  TEXT,
  effective_event TEXT,
  effective_edge  TEXT,
  proposal_id     TEXT,
  reason          TEXT NOT NULL,
  author          TEXT NOT NULL,
  at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS law_relations_from ON law_relations(from_standard, relation_id);
CREATE INDEX IF NOT EXISTS law_relations_to ON law_relations(to_standard, relation_id);
-- R5, R8: a court link from an extent of a court standard's text to a portion of a held statute, regulation,
-- ordinance or policy.
CREATE TABLE IF NOT EXISTS court_links (
  link_id        TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  from_standard  TEXT NOT NULL,
  to_standard    TEXT NOT NULL,
  to_portion     TEXT,
  citation       TEXT NOT NULL,
  proposal_id    TEXT,
  reason         TEXT NOT NULL,
  author         TEXT NOT NULL,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS court_links_from ON court_links(from_standard, link_id);
CREATE INDEX IF NOT EXISTS court_links_to ON court_links(to_standard, link_id);
-- R6: a treatment row: a later decision's treatment of a held decision, citing the later decision's extent.
CREATE TABLE IF NOT EXISTS court_treatments (
  treatment_id   TEXT PRIMARY KEY,
  decision       TEXT NOT NULL,
  treatment      TEXT NOT NULL,
  by_decision    TEXT NOT NULL,
  citation       TEXT NOT NULL,
  proposal_id    TEXT,
  reason         TEXT NOT NULL,
  author         TEXT NOT NULL,
  at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS court_treatments_decision ON court_treatments(decision, treatment_id);
-- R2, R15: a relation, link or treatment withdrawn, once, with who, when and why; the row it withdraws stays.
CREATE TABLE IF NOT EXISTS law_withdrawals (
  item_id        TEXT PRIMARY KEY,
  reason         TEXT NOT NULL,
  withdrawn_by   TEXT NOT NULL,
  withdrawn_at   TEXT NOT NULL
);
-- R2, R5, R6, R14: a machine's (or a member's) suggestion of a relation, link or treatment, stored apart and never
-- moving an answer; the adoption is the recorded row naming it (proposal_id).
CREATE TABLE IF NOT EXISTS law_proposals (
  proposal_id    TEXT PRIMARY KEY,
  what           TEXT NOT NULL,
  fields_json    TEXT NOT NULL,
  why            TEXT NOT NULL,
  proposed_by    TEXT NOT NULL,
  proposed_at    TEXT NOT NULL
);
`;

/* R15 (plan T33, Rules (6)): every table declared explicitly through `record-core.declareTable`, append-only
   (`version_chain: true`), group-wide (`sight: "group"`), the other classes as `declarePurge`'s default form gives them,
   keyed for a single-bundle purge by the standard ids each row names, as before the split. */
const CLASSES = Object.freeze({ purge: "clear", expunge: "none", export: "admin-only", sight: "group", derive: "stored",
                                version_chain: true });
export const LAW_TABLES = Object.freeze([
  { name: "law_relations", keys: ["from_standard", "to_standard"] },
  { name: "court_links", keys: ["from_standard", "to_standard"] },
  { name: "court_treatments", keys: ["decision", "by_decision"] },
  { name: "law_withdrawals", keys: [] },
  { name: "law_proposals", keys: [] },
].map((t) => Object.freeze({ ...t, keys: Object.freeze([...t.keys]), ...CLASSES })));

/** Creates the five tables where absent (R16), and adds R9's `edition` column to a `law_relations` table created before
 *  it, never filling it. Idempotent; writes no row. */
export function migrateLaw(sql) {
  const bare = LAW_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  const cols = [...sql.exec(`PRAGMA table_info(law_relations)`)].map((c) => c.name);
  if (!cols.includes("edition")) sql.exec(`ALTER TABLE law_relations ADD COLUMN edition TEXT`);
}
