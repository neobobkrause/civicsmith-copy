/* question-explorer's tables (requirements: `build/requirements/question-explorer.md`, R1–R14). Every row names the
 * question it serves, so a purge of the question clears it; a find also names the document it rests on, so a purge of
 * that document clears the find. No table holds a score: a gauge is a bearing and its account, never a grade (R4). */

export const QUESTION_EXPLORER_SCHEMA = `
-- R1, R3, R8, R12: each exploring run this module opened, one row a run. owner is the paying account (ai-use R1's
-- spelling); step the system step it serves (steps R1); day the group's local day it was opened on (one run a
-- question a day); seen the count of captures resolving to the question's subject entity at the open (R2's test);
-- estimate and actual (R12) answered only to the paying account's owners; ended and reason R8's; close_refused R17's.
CREATE TABLE IF NOT EXISTS explore_runs (
  run        TEXT PRIMARY KEY,
  question   TEXT NOT NULL,
  owner      TEXT NOT NULL,
  step       TEXT NOT NULL,
  day        TEXT NOT NULL,
  seen       INTEGER NOT NULL DEFAULT 0,
  estimate   TEXT,
  opened_at  TEXT NOT NULL,
  ended      TEXT,              -- null while running, then 'ended' or 'set_aside'
  reason     TEXT,
  closed_at  TEXT,
  actual     TEXT,
  close_refused TEXT,          -- null, or the plane's code when ai-runs did not accept the run close (R17)
  entry      TEXT              -- F1: the catalogue entry the gate was judged on at the open, or null (none named)
);
CREATE INDEX IF NOT EXISTS explore_runs_question ON explore_runs(question, opened_at);

-- R10: the distinct persons a run gathered about.
CREATE TABLE IF NOT EXISTS explore_persons (
  run       TEXT NOT NULL,
  question  TEXT NOT NULL,
  entity    TEXT NOT NULL,
  at        TEXT NOT NULL,
  PRIMARY KEY (run, entity)
);

-- R9, R10: the looks refused inside a run, recorded on the run.
CREATE TABLE IF NOT EXISTS explore_refusals (
  run       TEXT NOT NULL,
  question  TEXT NOT NULL,
  code      TEXT NOT NULL,
  entity    TEXT,
  aim       TEXT,
  at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS explore_refusals_run ON explore_refusals(run);

-- R4, R5: a find, gauged. kind capture | content | connection, or page (an address the record does not hold, named to
-- the members, R3). bundle_id and bundle_b are the documents it rests on (sight, purge). bearing and how are the run's
-- gauge; false_alarm_rate and gold_set the gate's record it was gauged under (R7); against the live basis it was
-- gauged against (each drawing project's CURRENT version, or the question's projected legs). untested the label the
-- gate opened under on the test-instance exception (R16, run-rules R29's untestedLabel, canonical JSON), recorded
-- at the find and never removed by a later bar; null when the bar was held. No score column.
CREATE TABLE IF NOT EXISTS explore_finds (
  find             TEXT PRIMARY KEY,
  run              TEXT NOT NULL,
  question         TEXT NOT NULL,
  kind             TEXT NOT NULL,
  ref              TEXT NOT NULL,
  bundle_id        TEXT,
  bundle_b         TEXT,
  bearing          TEXT,
  how              TEXT,
  false_alarm_rate REAL,
  gold_set         TEXT,
  against          TEXT,
  untested         TEXT,
  owner            TEXT NOT NULL,
  at               TEXT NOT NULL,
  UNIQUE (run, kind, ref)
);
CREATE INDEX IF NOT EXISTS explore_finds_question ON explore_finds(question, at);

-- R1: a question considered by a tick on a local day, per owner, and what came of it ('opened', 'ask', 'refused'),
-- so a day explores a question at most once and a pending Ask is looked at again only after an hour.
CREATE TABLE IF NOT EXISTS explore_considered (
  question  TEXT NOT NULL,
  owner     TEXT NOT NULL,
  day       TEXT NOT NULL,
  outcome   TEXT NOT NULL,
  at        TEXT NOT NULL,
  PRIMARY KEY (question, owner, day)
);

-- R6: a member's own doors on a find: muted (a follower outside every drawing project) or accepted (record-grammar
-- R52's record). One row per find, question and member.
CREATE TABLE IF NOT EXISTS explore_doors (
  find      TEXT NOT NULL,
  question  TEXT NOT NULL,
  member    TEXT NOT NULL,
  door      TEXT NOT NULL,      -- 'muted' or 'accepted'
  record    TEXT,               -- the acceptance record, canonical JSON
  at        TEXT NOT NULL,
  PRIMARY KEY (find, question, member)
);

-- F1 (K5821): exploring off for an owner (group, project:<id>, member:<id>) after a run was refused because the member
-- who turned it on is gone or no longer allowed: the refusal as given (its code, check, translation and sentence), and
-- the turning-on it carried (enabled_key), so it stays off until a member turns exploring on again. project names a
-- project owner's bundle (purge).
CREATE TABLE IF NOT EXISTS explore_off (
  owner       TEXT PRIMARY KEY,
  project     TEXT,
  account_id  TEXT,
  enabled_by  TEXT,
  enabled_key TEXT,
  code        TEXT NOT NULL,
  check_id    TEXT,
  translation TEXT,
  detail      TEXT,
  at          TEXT NOT NULL
);
`;

/** The declaration to record-core's purge (its R21, R46): every table by the question it serves; a find also by the
 *  documents it rests on. */
export const QUESTION_EXPLORER_TABLES = Object.freeze([
  { name: "explore_runs", keys: ["question"] },
  { name: "explore_persons", keys: ["question"] },
  { name: "explore_refusals", keys: ["question"] },
  { name: "explore_finds", keys: ["question", "bundle_id", "bundle_b"] },
  { name: "explore_doors", keys: ["question"] },
  { name: "explore_considered", keys: ["question"] },
  { name: "explore_off", keys: ["project"] },
]);

/** The module's tables, created where absent. */
export function migrateQuestionExplorer(sql) {
  const bare = QUESTION_EXPLORER_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const stmt of bare.split(";")) if (stmt.trim()) sql.exec(stmt);
  /* R16 (T46): a store made before the column gains it. */
  const cols = [...sql.exec(`PRAGMA table_info(explore_finds)`)].map((c) => c.name);
  if (!cols.includes("untested")) sql.exec(`ALTER TABLE explore_finds ADD COLUMN untested TEXT`);
  /* R17 (T50): a store made before the column gains it. */
  const runCols = [...sql.exec(`PRAGMA table_info(explore_runs)`)].map((c) => c.name);
  if (!runCols.includes("close_refused")) sql.exec(`ALTER TABLE explore_runs ADD COLUMN close_refused TEXT`);
  if (!runCols.includes("entry")) sql.exec(`ALTER TABLE explore_runs ADD COLUMN entry TEXT`);
}
