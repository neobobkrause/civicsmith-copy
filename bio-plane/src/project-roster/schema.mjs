/* project-roster's tables (requirements: `build/requirements/project-roster.md`): the DDL this module owns, copied
 * from membership's schema at the split (T38, N783; K624: copy, then delete), each table and index unchanged, so a store
 * written before the split is read as it is. `ProjectRoster#migrate` runs it. SQL comments are `--` lines, dropped
 * before the statements run. Every table is keyed by `project_id`, a bundle id, and cleared with the project (R18). */
export const PROJECT_ROSTER_SCHEMA = `
-- R10-R16 (Membership Architecture v2 section 7, item 7.14, "The request to join"): a member outside a DISCOVERABLE
-- project asks to be added. ONE ROW PER REQUEST, and the record is APPEND-ONLY AT THE FIELD (R13): the asking fields
-- (project, member, the name the member was shown, the comment, the date) are written once at the ask and never
-- touched, and the closing fields (state, closed_by, closed_comment, closed_at) are written ONCE, by the one statement
-- that moves an OPEN row to a terminal state -- every closing UPDATE carries WHERE state = 'open', so a closed row is
-- never rewritten and nothing is ever deleted but by purge.
-- project_name is the name AS SHOWN when the member asked: after a project goes HIDDEN the requester keeps sight of
-- their own request, which names only what they already saw, so it must not read the live title.
-- AT MOST ONE OPEN REQUEST PER MEMBER PER PROJECT is the partial unique index below, held by the schema and asked
-- again by the act (which refuses by name before the index would).
CREATE TABLE IF NOT EXISTS project_join_requests (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     TEXT NOT NULL,
  member_id      TEXT NOT NULL,
  project_name   TEXT,
  comment        TEXT,
  asked_at       TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state IN ('open','withdrawn','granted','declined','lapsed')),
  closed_by      TEXT,
  closed_comment TEXT,
  closed_at      TEXT
);
CREATE INDEX IF NOT EXISTS project_join_requests_project ON project_join_requests(project_id, seq);
CREATE INDEX IF NOT EXISTS project_join_requests_member ON project_join_requests(member_id, project_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS project_join_requests_one_open
  ON project_join_requests(project_id, member_id) WHERE state = 'open';

-- Section 7.10 owner governance: the OPEN votes, one row per voter per proposal. Separate from membership's
-- admin_votes because the arithmetic differs at two and sharing the table would invite sharing the tally. A carried
-- decision's votes are copied into project_owner_decisions (R6) and then cleared, so a later proposal about the same
-- member starts from no votes.
CREATE TABLE IF NOT EXISTS project_owner_votes (
  project_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  target     TEXT NOT NULL,
  voter      TEXT NOT NULL,
  reason     TEXT,
  created    TEXT NOT NULL,
  PRIMARY KEY (project_id, kind, target, voter)
);

-- R6 (sections 7.10, 7.13): EVERY OWNERSHIP DECISION, KEPT. One row per carried addition, removal or rescue, naming
-- its deciders and their reasons (JSON arrays), append-only; every participant of the project reads it.
CREATE TABLE IF NOT EXISTS project_owner_decisions (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('add','remove','rescue')),
  target     TEXT NOT NULL,
  deciders   TEXT NOT NULL,
  reasons    TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_owner_decisions_project ON project_owner_decisions(project_id, seq);

-- R21 (T45; v0.2 rule 15): A PROJECT'S SCOPE, one row per act, append-only. The latest row is the scope; a project
-- with none is 'none'. Every participant reads the history (R6's form).
CREATE TABLE IF NOT EXISTS project_scopes (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  scope      TEXT NOT NULL CHECK (scope IN ('counsel_matter','own','none')),
  reason     TEXT NOT NULL,
  set_by     TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_scopes_project ON project_scopes(project_id, seq);

-- R24 (T45; v0.2 rule 20): WHICH ACTS NEED A SECOND MEMBER'S APPROVAL, one row per setting, append-only. needs is
-- the JSON list of entries; the latest row governs; '[]' is the default (one member approves).
CREATE TABLE IF NOT EXISTS project_approval_settings (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  needs      TEXT NOT NULL,
  reason     TEXT NOT NULL,
  set_by     TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_approval_settings_project ON project_approval_settings(project_id, seq);
 
-- R31 (T50; N933): THE PROJECT'S DECLARED STAKE, one row per act, append-only. The latest row is the stake; a null
-- stake clears it; a project with no row has none. Every participant reads the history through R32.
CREATE TABLE IF NOT EXISTS project_stakes (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  stake      TEXT,
  set_by     TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_stakes_project ON project_stakes(project_id, seq);
`;

/* R18: the tables keyed by project and cleared with it, the scope records and approval settings among them (T45) and the stake records (T50).
   None is exempt. */
export const PROJECT_ROSTER_TABLES = Object.freeze(["project_join_requests", "project_owner_votes",
  "project_owner_decisions", "project_scopes", "project_approval_settings", "project_stakes"]);
