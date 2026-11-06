/* investigation: the tables this module owns (R10). Every row is a project's working material: keyed by `project_id`, so
   a project's purge takes every row it holds, and declared to `record-core` as never carried in any export to the
   public (the group's own administrators may export it). Every act is a row of its own, appended (R1's history); a kept
   report and a kept interview are never edited after (R7, R12: the triggers below refuse an update). No table names a
   place. */
export const INVESTIGATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS inv_milestones (
  milestone_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  date          TEXT NOT NULL,      -- a calendar day, the group's own (R5)
  removed_by    TEXT,
  removed_at    TEXT,
  removed_reason TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_milestones_project ON inv_milestones (project_id, milestone_id);
CREATE TABLE IF NOT EXISTS inv_milestone_items (
  item_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id  INTEGER NOT NULL,
  project_id    TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- question | step
  ref           TEXT NOT NULL,
  removed_by    TEXT,
  removed_at    TEXT,
  removed_reason TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_milestone_items_m ON inv_milestone_items (milestone_id, item_id);
CREATE TABLE IF NOT EXISTS inv_milestone_history (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id  INTEGER NOT NULL,
  project_id    TEXT NOT NULL,
  act           TEXT NOT NULL,      -- set | revise | remove | item_remove
  detail_json   TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_milestone_history_m ON inv_milestone_history (milestone_id, seq);
CREATE TABLE IF NOT EXISTS inv_milestone_reminders (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  milestone_id  INTEGER NOT NULL,
  project_id    TEXT NOT NULL,
  member        TEXT NOT NULL,
  day           TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_milestone_reminders_member ON inv_milestone_reminders (member, day);
CREATE TABLE IF NOT EXISTS inv_reports (
  report_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  question_id   TEXT,               -- null for a report on the project
  text          TEXT NOT NULL,
  since         TEXT NOT NULL,
  corrects      INTEGER,            -- an earlier report this one corrects (R7)
  steps_json    TEXT NOT NULL,      -- the steps' states the report was kept against, so the next draft says what ended since
  author        TEXT NOT NULL,      -- the member who kept it
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_reports_project ON inv_reports (project_id, report_id);
CREATE TABLE IF NOT EXISTS inv_interviews (
  interview_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  step_id       TEXT NOT NULL,      -- the project-placed step it is the product of (steps R1)
  answers_json  TEXT NOT NULL,      -- [{question, answer, kind: "narrative", began_as_draft, kept}]
  acceptance_json TEXT,             -- record-grammar R52's record, when it began as the assistant's draft
  run           TEXT,
  warning_json  TEXT,               -- inquiry R59's warning, when one was given (R22)
  author        TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_interviews_project ON inv_interviews (project_id, interview_id);
CREATE INDEX IF NOT EXISTS inv_interviews_step ON inv_interviews (step_id);
CREATE TABLE IF NOT EXISTS inv_claims (
  claim_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  source_json   TEXT NOT NULL,      -- {interview, answer} | {own: true}
  text          TEXT NOT NULL,
  about         TEXT,
  find_step     TEXT,
  find_proposal INTEGER,
  found_record  TEXT,
  found_by      TEXT,
  found_at      TEXT,
  warning_json  TEXT,
  author        TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_claims_project ON inv_claims (project_id, claim_id);
CREATE TABLE IF NOT EXISTS inv_plan_proposals (
  proposal_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- question | step
  text          TEXT NOT NULL,
  question_id   TEXT,
  run           TEXT NOT NULL,
  by_actor      TEXT NOT NULL,
  label_state   TEXT NOT NULL,
  status        TEXT NOT NULL,      -- proposed | accepted | set_aside
  form          TEXT,
  acceptance_json TEXT,
  made          TEXT,               -- the question or step her act made
  reason        TEXT,
  decided_by    TEXT,
  decided_at    TEXT,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_plan_proposals_project ON inv_plan_proposals (project_id, proposal_id);
CREATE TABLE IF NOT EXISTS inv_quiet_spells (
  spell_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  began_at      TEXT NOT NULL,
  ended_at      TEXT
);
CREATE INDEX IF NOT EXISTS inv_quiet_spells_project ON inv_quiet_spells (project_id, spell_id);
CREATE TABLE IF NOT EXISTS inv_quiet_acts (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  spell_id      INTEGER,
  act           TEXT NOT NULL,      -- watch | close
  closed_reason TEXT,
  note          TEXT,
  gaps_json     TEXT,               -- intent.gaps as read at the act, kept beside the close (R18)
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_quiet_acts_project ON inv_quiet_acts (project_id, seq);
CREATE TABLE IF NOT EXISTS inv_watch_arrivals (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  source        TEXT NOT NULL,      -- what monitoring watched that brought something new
  arrived_at    TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_watch_arrivals_project ON inv_watch_arrivals (project_id, seq);
CREATE TABLE IF NOT EXISTS inv_part_refusals (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  proposal_id   TEXT NOT NULL,      -- R28: a proposal a member said is not for this investigation
  capture_sha   TEXT NOT NULL,
  part_json     TEXT NOT NULL,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_part_refusals_project ON inv_part_refusals (project_id, proposal_id);
CREATE TABLE IF NOT EXISTS inv_proposal_acts (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT NOT NULL,
  proposal_id   TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- R29: the file kind the proposal was of
  outcome       TEXT NOT NULL,      -- accepted | chosen_unaided | chose_otherwise
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inv_proposal_acts_kind ON inv_proposal_acts (kind, seq);
CREATE TRIGGER IF NOT EXISTS inv_reports_kept BEFORE UPDATE ON inv_reports BEGIN
  SELECT RAISE(ABORT, 'a kept report is never edited');
END;
CREATE TRIGGER IF NOT EXISTS inv_interviews_kept BEFORE UPDATE ON inv_interviews BEGIN
  SELECT RAISE(ABORT, 'a kept interview is never edited');
END;
`;

/* R10: each table, keyed by the project it belongs to, so a project's purge takes it. */
export const INVESTIGATION_TABLES = Object.freeze([
  "inv_milestones", "inv_milestone_items", "inv_milestone_history", "inv_milestone_reminders", "inv_reports",
  "inv_interviews", "inv_claims", "inv_plan_proposals", "inv_quiet_spells", "inv_quiet_acts", "inv_watch_arrivals", "inv_part_refusals",
  "inv_proposal_acts",
].map((name) => Object.freeze({ name, keys: Object.freeze(["project_id"]) })));
