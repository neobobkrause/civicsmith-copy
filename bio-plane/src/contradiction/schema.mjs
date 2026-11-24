/* contradiction's tables (layers.md ruling 3: each module owns its tables; R15, R17, R22, R42, R47), the first moved
   from `schema.mjs`. `migrate` runs it at every boot, idempotent, and adds the columns `CONTRADICTION_COLUMNS` names to
   a table created before them. */
export const CONTRADICTION_SCHEMA = `
-- REC-147 / IC-318 (CONTRADICTION-IDENTIFY-DESIGN.md section 8): THE CONTRADICTION CANDIDATE. One row per
-- PROPOSED conflict between two referents the pairing FORMED (op=contradictionpairs), written as labelled
-- MACHINE work through ONE append site (Contradiction #append) and never updated in place.
-- APPEND-ONLY AND KEYED BY WHAT WAS COMPARED: candidate is a digest of the key and both referents AT THEIR
-- VERSIONS, order-free, so a re-run over unchanged referents collides and writes nothing (section 8), while a
-- changed side is a new row and the old one stays with its versions. A claim side is the inquiry and the reading
-- it is held on, versioned by the sha256 of the claim text as compared. An extent side is its content row (or the
-- capture where none is named), versioned by the capture, whose bytes never change.
-- state is always 'proposed': what a candidate is now is derived at the read from its acts (R26, R42), never
-- written here. origin is always 'machine' (DEC-24: a proposal, labelled). a_bundle_id and b_bundle_id are the
-- bundles each side lives in, so a purge of either end takes the row (D-113), as connections do.
CREATE TABLE IF NOT EXISTS contradiction_candidates (
  candidate    TEXT PRIMARY KEY,
  key          TEXT NOT NULL,
  a_kind       TEXT NOT NULL,
  a_ref        TEXT NOT NULL,
  a_version    TEXT NOT NULL,
  a_bundle_id  TEXT,
  b_kind       TEXT NOT NULL,
  b_ref        TEXT NOT NULL,
  b_version    TEXT NOT NULL,
  b_bundle_id  TEXT,
  run          TEXT NOT NULL,
  proposed_by  TEXT NOT NULL,
  label        TEXT NOT NULL,
  reason       TEXT NOT NULL,
  state        TEXT NOT NULL DEFAULT 'proposed',
  origin       TEXT NOT NULL DEFAULT 'machine',
  at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contradiction_candidates_run ON contradiction_candidates(run);

-- N345 (R42, R47): WHAT MEMBERS AND THE MACHINE DID ABOUT A CANDIDATE, append-only, each row keyed to both sides'
-- bundles so a purge of either end takes it (K23). A candidate's state, weight and marks are DERIVED at the read from
-- the candidate, these rows and its inquiry's document (R24, R26, R27): nothing here is a copy that could disagree.
-- contradiction_acts: one row per member's act (R30): dismiss, clarify (its choice), take_up, resolve. JSON columns
-- hold lists as the act named them.
CREATE TABLE IF NOT EXISTS contradiction_acts (
  act_id       TEXT PRIMARY KEY,
  candidate    TEXT NOT NULL,
  act          TEXT NOT NULL,
  choice       TEXT,
  author       TEXT NOT NULL,
  at           TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  reason       TEXT,
  words        TEXT,
  coordinates  TEXT,
  explanation  TEXT,
  evidence     TEXT,
  wrong_side   TEXT,
  wrong_reason TEXT,
  qualifiers   TEXT,
  acceptance   TEXT,
  standing     TEXT,
  inquiry      TEXT,
  kind         TEXT,
  a_bundle_id  TEXT,
  b_bundle_id  TEXT
);
CREATE INDEX IF NOT EXISTS contradiction_acts_candidate ON contradiction_acts(candidate, seq);
-- contradiction_recommendations: the machine's one act (R37), one row per (run, candidate, coordinate).
CREATE TABLE IF NOT EXISTS contradiction_recommendations (
  recommendation TEXT PRIMARY KEY,
  candidate      TEXT NOT NULL,
  run            TEXT NOT NULL,
  coordinate     TEXT NOT NULL,
  proposed_by    TEXT NOT NULL,
  reason         TEXT NOT NULL,
  origin         TEXT NOT NULL DEFAULT 'machine',
  at             TEXT NOT NULL,
  seq            INTEGER NOT NULL,
  a_bundle_id    TEXT,
  b_bundle_id    TEXT
);
CREATE INDEX IF NOT EXISTS contradiction_recommendations_candidate ON contradiction_recommendations(candidate, seq);
-- contradiction_optins: a project's opt-in (R51) and, in the same table, the one revealed row the last opt-in appends
-- (R52), which names the parties at that instant.
CREATE TABLE IF NOT EXISTS contradiction_optins (
  optin        TEXT PRIMARY KEY,
  candidate    TEXT NOT NULL,
  kind         TEXT NOT NULL,
  project_id   TEXT,
  author       TEXT,
  at           TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  words        TEXT,
  parties      TEXT,
  a_bundle_id  TEXT,
  b_bundle_id  TEXT
);
CREATE INDEX IF NOT EXISTS contradiction_optins_candidate ON contradiction_optins(candidate, seq);
-- contradiction_responses: a member's response to a notice (R53), with only the disclosures they chose.
CREATE TABLE IF NOT EXISTS contradiction_responses (
  response     TEXT PRIMARY KEY,
  candidate    TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  author       TEXT NOT NULL,
  at           TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  text         TEXT NOT NULL,
  cover        TEXT,
  email        TEXT,
  a_bundle_id  TEXT,
  b_bundle_id  TEXT
);
CREATE INDEX IF NOT EXISTS contradiction_responses_candidate ON contradiction_responses(candidate, seq);
`;

/* Columns added to a table after it was first created: `migrate` adds each one a held table lacks. `a_side` and
   `b_side` are each side as the plane formed it (JSON), so a candidate is read back with its sides verbatim (R15, R25)
   and a leg side keeps the inquiry it belongs to. `seq` ranks candidates in the order they were written. */
export const CONTRADICTION_COLUMNS = Object.freeze([
  ["contradiction_candidates", "a_side", "TEXT"],
  ["contradiction_candidates", "b_side", "TEXT"],
  ["contradiction_candidates", "seq", "INTEGER"],
]);
