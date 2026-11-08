/* steps: the tables this module owns (R22). A step's row holds its place, work, doer, state and date; every act on it
   is a row of its own, appended, so nothing it did is overwritten (R5, R10, R13). Purge follows the step's place:
   `steps` is keyed by `project_id` (a project-placed step goes with its project), `step_refs` by `question_id` (a
   question's reference goes with the question), and the triggers below take a question-placed step with its last
   reference, and every row a step holds with the step, so no row outlives the step it belongs to. The follows are
   their member's own (`sight: "owner"`), keyed by the question. No table names a place. */
export const STEPS_SCHEMA = `
CREATE TABLE IF NOT EXISTS steps (
  step_id       TEXT PRIMARY KEY,
  place_kind    TEXT NOT NULL,      -- questions | project | group
  project_id    TEXT,               -- the project a project-placed step is placed in; null otherwise
  work          TEXT NOT NULL,      -- the doer's words on what the work is
  work_norm     TEXT NOT NULL,      -- the work folded for the duplicate search (R7, R8)
  doer_member   TEXT,               -- the member who does it; null for the system
  enabled_by    TEXT,               -- the system's doer: the run's enabling label (ai-use R6)
  run           TEXT,               -- the run a machine created it for
  created_by    TEXT NOT NULL,      -- the act's stamp
  taken_in      TEXT,               -- the project the creating act named, or null
  state         TEXT NOT NULL,      -- planned | underway | ended | set_aside
  started       INTEGER NOT NULL DEFAULT 0,
  by_when_json  TEXT,               -- {date, basis, source?}
  by_when_by    TEXT,               -- the member who set the date
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS steps_project ON steps (project_id);
CREATE INDEX IF NOT EXISTS steps_place ON steps (place_kind, step_id);
CREATE INDEX IF NOT EXISTS steps_due ON steps (by_when_by);
CREATE TABLE IF NOT EXISTS step_refs (
  step_id       TEXT NOT NULL,
  question_id   TEXT NOT NULL,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL,
  PRIMARY KEY (step_id, question_id)
);
CREATE INDEX IF NOT EXISTS step_refs_question ON step_refs (question_id, step_id);
CREATE TABLE IF NOT EXISTS step_events (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  act           TEXT NOT NULL,      -- create | start | reopen | end | refer | by_when
  from_state    TEXT,
  to_state      TEXT,
  reason        TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS step_events_step ON step_events (step_id, seq);
CREATE TABLE IF NOT EXISTS step_outcomes (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  question_id   TEXT NOT NULL,      -- '' for a project- or group-placed step's one outcome
  outcome       TEXT NOT NULL,      -- helped | dead_end | undetermined
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS step_outcomes_step ON step_outcomes (step_id, question_id, seq);
CREATE TABLE IF NOT EXISTS step_products (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- record | capture | content | lead | connection
  ref           TEXT NOT NULL,
  derivation    TEXT,               -- a derived connection's derivation, as JSON
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL,
  UNIQUE (step_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS step_products_ref ON step_products (kind, ref);
CREATE TABLE IF NOT EXISTS step_learned (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  writer        TEXT NOT NULL,      -- the member who wrote it
  text          TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS step_learned_step ON step_learned (step_id, writer, seq);
CREATE TABLE IF NOT EXISTS step_waits (
  wait_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  on_kind       TEXT NOT NULL,      -- step | arrival | date
  on_step       TEXT,
  arrival_kind  TEXT,
  arrival_id    TEXT,
  on_date       TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL,
  removed_by    TEXT,
  removed_at    TEXT
);
CREATE INDEX IF NOT EXISTS step_waits_step ON step_waits (step_id);
CREATE INDEX IF NOT EXISTS step_waits_on ON step_waits (on_step);
CREATE TABLE IF NOT EXISTS step_reminders (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  member        TEXT NOT NULL,
  day           TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS step_reminders_member ON step_reminders (member, day);
CREATE TABLE IF NOT EXISTS step_costs (
  cost_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,      -- fee | purchase
  amount        TEXT NOT NULL,      -- an exact decimal, as written
  currency      TEXT NOT NULL,
  what          TEXT NOT NULL,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL,
  removed_by    TEXT,
  removed_at    TEXT
);
CREATE INDEX IF NOT EXISTS step_costs_step ON step_costs (step_id);
CREATE TABLE IF NOT EXISTS step_later_found (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  look_seq      INTEGER NOT NULL,   -- the earlier look, as the log holds it
  observation_seq INTEGER NOT NULL, -- what arrived
  at            TEXT NOT NULL,      -- the instant what arrived was logged (the observation's at)
  looked_at     TEXT,               -- the instant of the look (its at); added T44, older rows filled at start
  UNIQUE (step_id, look_seq, observation_seq)
);
CREATE TABLE IF NOT EXISTS step_cost_messages (
  message_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id       TEXT NOT NULL,
  text          TEXT NOT NULL,
  writer        TEXT NOT NULL,      -- the member who wrote it
  at            TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS step_cost_message_to (
  message_id    INTEGER NOT NULL,
  member        TEXT NOT NULL,
  PRIMARY KEY (message_id, member)
);
CREATE INDEX IF NOT EXISTS step_cost_message_to_member ON step_cost_message_to (member, message_id);
CREATE TABLE IF NOT EXISTS question_follows (
  member        TEXT NOT NULL,
  question_id   TEXT NOT NULL,
  on_flag       INTEGER NOT NULL,
  at            TEXT NOT NULL,
  PRIMARY KEY (member, question_id)
);
CREATE INDEX IF NOT EXISTS question_follows_question ON question_follows (question_id, member);
CREATE TABLE IF NOT EXISTS step_proposals (
  proposal_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  place_kind    TEXT NOT NULL,
  project_id    TEXT,
  work          TEXT NOT NULL,
  why           TEXT NOT NULL,
  run           TEXT NOT NULL,
  by_actor      TEXT NOT NULL,
  label_state   TEXT NOT NULL,
  at            TEXT NOT NULL,
  status        TEXT NOT NULL,      -- proposed | accepted | set_aside
  form          TEXT,               -- record-grammar R52's form, once accepted
  step_id       TEXT,               -- the step the acceptance created
  reason        TEXT,               -- her reason, for own_instead
  decided_by    TEXT,
  decided_at    TEXT
);
CREATE INDEX IF NOT EXISTS step_proposals_project ON step_proposals (project_id);
CREATE TABLE IF NOT EXISTS step_proposal_refs (
  proposal_id   INTEGER NOT NULL,
  question_id   TEXT NOT NULL,
  PRIMARY KEY (proposal_id, question_id)
);
CREATE INDEX IF NOT EXISTS step_proposal_refs_question ON step_proposal_refs (question_id);
CREATE TRIGGER IF NOT EXISTS step_refs_last AFTER DELETE ON step_refs BEGIN
  DELETE FROM step_outcomes WHERE step_id = OLD.step_id AND question_id = OLD.question_id;
  DELETE FROM steps WHERE step_id = OLD.step_id AND place_kind = 'questions'
    AND NOT EXISTS (SELECT 1 FROM step_refs r WHERE r.step_id = OLD.step_id);
END;
CREATE TRIGGER IF NOT EXISTS steps_gone AFTER DELETE ON steps BEGIN
  DELETE FROM step_refs WHERE step_id = OLD.step_id;
  DELETE FROM step_events WHERE step_id = OLD.step_id;
  DELETE FROM step_outcomes WHERE step_id = OLD.step_id;
  DELETE FROM step_products WHERE step_id = OLD.step_id;
  DELETE FROM step_learned WHERE step_id = OLD.step_id;
  DELETE FROM step_waits WHERE step_id = OLD.step_id OR on_step = OLD.step_id;
  DELETE FROM step_reminders WHERE step_id = OLD.step_id;
  DELETE FROM step_costs WHERE step_id = OLD.step_id;
  DELETE FROM step_later_found WHERE step_id = OLD.step_id;
  DELETE FROM step_cost_message_to WHERE message_id IN (SELECT message_id FROM step_cost_messages WHERE step_id = OLD.step_id);
  DELETE FROM step_cost_messages WHERE step_id = OLD.step_id;
END;
CREATE TRIGGER IF NOT EXISTS step_proposal_refs_last AFTER DELETE ON step_proposal_refs BEGIN
  DELETE FROM step_proposals WHERE proposal_id = OLD.proposal_id AND place_kind = 'questions'
    AND NOT EXISTS (SELECT 1 FROM step_proposal_refs r WHERE r.proposal_id = OLD.proposal_id);
END;
-- a decided proposal never names a step that has gone (T42, K2655); its own trigger, so a store whose steps_gone
-- predates it gains it, and the update after it clears what such a store already left
CREATE TRIGGER IF NOT EXISTS steps_gone_proposals AFTER DELETE ON steps BEGIN
  UPDATE step_proposals SET step_id = NULL WHERE step_id = OLD.step_id;
END;
UPDATE step_proposals SET step_id = NULL WHERE step_id IS NOT NULL AND step_id NOT IN (SELECT step_id FROM steps);
-- R31 (CR2-18, BD-17): the rival a step was opened from, fixed at creation; one row a step at most, keyed by the
-- question whose rival it is, so it goes with that question's reference, and with the step
CREATE TABLE IF NOT EXISTS step_rivals (
  step_id       TEXT PRIMARY KEY,
  question_id   TEXT NOT NULL,      -- the referring question whose rival it is
  rival_id      TEXT NOT NULL,      -- the rival's id, as hypotheses holds it
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS step_rivals_rival ON step_rivals (question_id, rival_id, step_id);
CREATE TRIGGER IF NOT EXISTS steps_gone_rivals AFTER DELETE ON steps BEGIN
  DELETE FROM step_rivals WHERE step_id = OLD.step_id;
END;
CREATE TRIGGER IF NOT EXISTS step_refs_gone_rivals AFTER DELETE ON step_refs BEGIN
  DELETE FROM step_rivals WHERE step_id = OLD.step_id AND question_id = OLD.question_id;
END;
`;

/* R22: each table with how a purge reaches it. `keys` names the column that ties its rows to a bundle; `[]` is reached
   only by the whole-store purge and by the triggers above. */
export const STEPS_TABLES = Object.freeze([
  Object.freeze({ name: "step_refs", keys: ["question_id"] }),
  Object.freeze({ name: "steps", keys: ["project_id"] }),
  ...["step_events", "step_outcomes", "step_products", "step_learned", "step_waits", "step_reminders", "step_costs",
      "step_later_found", "step_cost_messages", "step_cost_message_to"].map((name) => Object.freeze({ name, keys: [] })),
  Object.freeze({ name: "step_proposal_refs", keys: ["question_id"] }),
  Object.freeze({ name: "step_proposals", keys: ["project_id"] }),
  Object.freeze({ name: "step_rivals", keys: ["question_id"] }),
]);
/* R16, R22: a member's follows, hers alone. */
export const FOLLOWS_TABLE = "question_follows";
