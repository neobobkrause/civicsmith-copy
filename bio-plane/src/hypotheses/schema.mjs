/* hypotheses: the two tables this module owns (R10). A hypothesis is never edited in place (R2): `hypotheses` holds
   its current statement and nodes for the reads and the hunch hops, and `hypothesis_revisions` every act on it, in
   order, with who, when and why. Both are keyed by the inquiry's `bundle_id`, so a purge of the inquiry takes them. */
export const HYPOTHESES_SCHEMA = `
CREATE TABLE IF NOT EXISTS hypotheses (
  hypothesis_id TEXT PRIMARY KEY,
  bundle_id     TEXT NOT NULL,      -- the inquiry holding it; its sight is the inquiry's
  kind          TEXT NOT NULL,      -- cause | identity | relation | flow | other
  statement     TEXT NOT NULL,      -- the current statement, the last revision's
  about_json    TEXT NOT NULL,      -- the current nodes: {from, to} or a list of ids
  from_node     TEXT,               -- the hunch hop's ends, when the nodes are {from, to}
  to_node       TEXT,
  held_by       TEXT NOT NULL,
  held_at       TEXT NOT NULL,
  withdrawn     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS hypotheses_bundle ON hypotheses (bundle_id);
CREATE INDEX IF NOT EXISTS hypotheses_from ON hypotheses (from_node, bundle_id);
CREATE INDEX IF NOT EXISTS hypotheses_to ON hypotheses (to_node, bundle_id);
CREATE TABLE IF NOT EXISTS hypothesis_revisions (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  hypothesis_id TEXT NOT NULL,
  bundle_id     TEXT NOT NULL,
  act           TEXT NOT NULL,      -- hold | revise | withdraw
  statement     TEXT,
  about_json    TEXT,
  reason        TEXT,
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hypothesis_revisions_of ON hypothesis_revisions (hypothesis_id, seq);
CREATE INDEX IF NOT EXISTS hypothesis_revisions_bundle ON hypothesis_revisions (bundle_id);
`;

export const HYPOTHESES_TABLES = Object.freeze(["hypotheses", "hypothesis_revisions"]);

/* The system's proposals (R16–R18; D33, D46 A, K1473): stored apart from what members hold, keyed by the inquiry's
   `bundle_id` like the hypotheses (purged with it, sight the inquiry's). A proposal is `open` until one member takes it
   up (R17: `taken_as` the hypothesis her act held, `acceptance` record-grammar R52's record) or sets it aside (R18: with
   her reason, kept readable). */
export const PROPOSALS_SCHEMA = `
CREATE TABLE IF NOT EXISTS hypothesis_proposals (
  proposal_id      TEXT PRIMARY KEY,  -- a HYP- id, so every leg check refuses it as it refuses a hypothesis (R5)
  bundle_id        TEXT NOT NULL,     -- the inquiry it is proposed in; its sight is the inquiry's
  kind             TEXT NOT NULL,
  statement        TEXT NOT NULL,
  about_json       TEXT NOT NULL,
  how              TEXT NOT NULL,     -- how the system worked it out
  false_alarm_rate REAL NOT NULL,     -- its measured false-alarm rate, 0…1
  run              TEXT NOT NULL,     -- the run that proposed it
  proposed_at      TEXT NOT NULL,
  state            TEXT NOT NULL DEFAULT 'open',  -- open | taken_up | set_aside
  acted_by         TEXT,
  acted_at         TEXT,
  reason           TEXT,              -- a setting aside's reason
  acceptance_json  TEXT,              -- a taking up's acceptance record (record-grammar R52)
  taken_as         TEXT               -- the hypothesis the taking up held
);
CREATE INDEX IF NOT EXISTS hypothesis_proposals_bundle ON hypothesis_proposals (bundle_id, proposed_at);
CREATE INDEX IF NOT EXISTS hypothesis_proposals_taken ON hypothesis_proposals (taken_as);
`;
export const PROPOSALS_TABLE = "hypothesis_proposals";

/* A note shared with a project (R19–R21; D18): a copy of the note's words as they were at the act, keyed by the
   project's id (purged with it, sight the project's), never exported. It holds no note number, so a later deletion of
   the private note leaves no sign of the note here (R14). Withdrawn (R20), its words and warning are emptied and the
   row stays as the project's record that she shared a note on that date and withdrew it on that date. */
export const SHARES_SCHEMA = `
CREATE TABLE IF NOT EXISTS narrative_shares (
  share_id      TEXT PRIMARY KEY,     -- opaque, never a record id
  project_id    TEXT NOT NULL,
  member        TEXT NOT NULL,        -- the author who shared it
  text          TEXT,                 -- the words as shared; null once withdrawn
  warning_json  TEXT,                 -- inquiry R59's warning at the act, or null
  shared_at     TEXT NOT NULL,
  withdrawn_at  TEXT
);
CREATE INDEX IF NOT EXISTS narrative_shares_project ON narrative_shares (project_id, shared_at);
`;
export const SHARES_TABLE = "narrative_shares";

/* A member's own notes (R11–R15; DEC-136 (2), (3)). A note is keyed by a number of its own (`note_id`), never a record
   id, so no leg, reference, citation, connection, search or count names one (R14). The number is the member's own
   (T36; N727): `member_notes` is keyed by `(member, note_id)`, and each member's next number is drawn from that member's
   high-water mark in `member_note_numbers`, never from a sequence shared across members, so a member's numbers, their
   order and their gaps depend only on that member's own notes. The mark, not the largest number held, keeps a deleted
   note's number from ever being taken again (R13, R14), and it holds no text and no count of anyone else's notes.
   `member_notes` holds the words as last kept: a revision overwrites them in place, keeping no earlier text (R11, R15);
   `member_note_turns` each turn of a note into an observation, a hunch or a question, appended; `member_note_told` the
   one time a member was answered the court statement (R11). A deletion removes the note's row and its turns in one act.
   Each is its author's alone. */
export const NOTES_SCHEMA = `
CREATE TABLE IF NOT EXISTS member_notes (
  member        TEXT NOT NULL,      -- the member who kept it; the only one answered it
  note_id       INTEGER NOT NULL,   -- the member's own number for it, from that member's mark
  text          TEXT NOT NULL,      -- the member's words, as last kept
  at            TEXT NOT NULL,
  revised       TEXT,               -- the instant of its last revision, or null
  PRIMARY KEY (member, note_id)
);
CREATE TABLE IF NOT EXISTS member_note_numbers (
  member        TEXT PRIMARY KEY,
  last          INTEGER NOT NULL    -- the last number this member's notes took
);
CREATE TABLE IF NOT EXISTS member_note_turns (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id       INTEGER NOT NULL,
  member        TEXT NOT NULL,
  turned_into   TEXT NOT NULL,      -- observation | hunch | question
  made_id       TEXT NOT NULL,      -- the id the member's act answered
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS member_note_turns_member ON member_note_turns (member, note_id, seq);
CREATE TABLE IF NOT EXISTS member_note_told (
  member        TEXT PRIMARY KEY,
  at            TEXT NOT NULL
);
`;

/* Columns added to a notes table after its first release, each added at boot where an older copy lacks it. */
export const NOTES_ADDED_COLUMNS = Object.freeze([Object.freeze(["member_notes", "revised", "TEXT"])]);

export const NOTES_TABLES = Object.freeze(["member_notes", "member_note_turns", "member_note_told"]);
/* R14 (T36): each member's high-water mark, exempt from purge as `record-core`'s id counter is (its R23), so a number
   once taken is never taken again, purged store or not. */
export const NOTE_NUMBERS_TABLE = "member_note_numbers";

/* Rival explanations (F1; BD-17; IV-H1, IV-H2 of the investigation lane's redraft rev 7). A question (an inquiry) holds
   2 to 6 rivals, each a hypothesis held in it (R1) or a proposal of the system's in it (R16), keyed by the inquiry's
   `bundle_id` (purged with it, sight the inquiry's). `hypothesis_rival_marks` holds each member's one current
   "Explore this next" mark in an inquiry; a new mark replaces the member's own earlier one. `hypothesis_rival_history`
   keeps every change to the set and every mark, with who and when, appended. A mark orders the exploring and nothing
   else: no column here is read by a grade, a strength, a leg or a conclusion. */
export const RIVALS_SCHEMA = `
CREATE TABLE IF NOT EXISTS hypothesis_rivals (
  bundle_id     TEXT NOT NULL,      -- the inquiry (question) holding the set
  rival_id      TEXT NOT NULL,      -- a HYP- id: a held hypothesis, or a proposal of the system's
  source        TEXT NOT NULL,      -- member | system
  added_by      TEXT NOT NULL,
  added_at      TEXT NOT NULL,
  added_seq     INTEGER NOT NULL,   -- the history row of its adding; breaks ties in the order
  PRIMARY KEY (bundle_id, rival_id)
);
CREATE TABLE IF NOT EXISTS hypothesis_rival_marks (
  bundle_id     TEXT NOT NULL,
  member        TEXT NOT NULL,
  rival_id      TEXT NOT NULL,
  at            TEXT NOT NULL,
  PRIMARY KEY (bundle_id, member)
);
CREATE TABLE IF NOT EXISTS hypothesis_rival_history (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id     TEXT NOT NULL,
  rival_id      TEXT NOT NULL,
  act           TEXT NOT NULL,      -- add | remove | mark
  by_actor      TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hypothesis_rival_history_bundle ON hypothesis_rival_history (bundle_id, seq);
`;
export const RIVALS_TABLES = Object.freeze(["hypothesis_rivals", "hypothesis_rival_marks", "hypothesis_rival_history"]);
