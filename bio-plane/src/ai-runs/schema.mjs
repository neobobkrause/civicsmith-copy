/* ai-runs' tables (R38, R49, R50, R53; Bob's ruling 3, "each module owns its tables"), moved from `schema.mjs` at the
 * module's extraction (T40-8, K624: the use counter and the ceilings moved to `ai-use`, which declares and migrates them, its R7). `lens_at_open`, `rerun_of` and `plan` (R46) are additive columns of the store's migration; they are part of the
 * table here, and `migrate` adds them to a table created before them. */
export const AI_RUNS_TABLES = Object.freeze(["ai_runs", "ai_run_bounds", "inquiry_run_surfacings",
  "ai_mode_verifications", "ai_run_looks", "ai_test_bar", "ai_group_tests", "ai_run_segments", "ai_run_producers", "ai_gate_records"]);
/* T41 (T41-23): `step` and `origin` (R73), and `own_step` ('1' when `step` is the run's own system step, made by this
   module after the open, R73, R74) are additive columns, added by `migrate` to a table created before them. A run's
   cost is not kept here: its figures are `ai-use`'s, one store (R76, K2482). */
export const AI_RUNS_ADDED_COLUMNS = Object.freeze(["lens_at_open", "rerun_of", "plan", "step", "origin", "own_step",
  /* R77 (T45): a re-examination run's response, stored verbatim; NULL for every other run */
  "response",
  /* R78 (T46): the test-instance exception's label a run was admitted under, JSON; NULL for a run the bar admitted */
  "untested",
  /* R89 (T50): the project a run was opened in, recorded at the open and never changed; NULL for a run opened with none */
  "project",
  /* R93-R96, R105 (T53): what holds a run that is not failed (a pause, a hop offered to its member, a recipient's notice,
     a wait), JSON; NULL while nothing holds it */
  "hold",
  /* R105 (T53): the member's "wait a set time, then switch" choice, {run, member, wait, from, at}, JSON; NULL when none */
  "wait_choice"]);

/* R75 (T53): additive columns of other tables, `{table: [column]}`, added by `migrate` to a table created before them. */
export const AI_RUNS_ADDED_TABLE_COLUMNS = Object.freeze({ ai_test_bar: Object.freeze(["entry_id"]) });

export const AI_RUNS_SCHEMA = `

-- IS-6 / INVESTIGATIVE-SESSION.md §11: THE RUN IS AN OBJECT, and it is built on
-- the capture_sessions shape (capture's table) rather than on a new one — "SCRATCH, not
-- record… a work list with an expiry": ticks, an expiry, opaque state,
-- resumable across invocations. Every column beyond that shape is one §11 or
-- §14b.6 names, and each is here because a version is only interpretable
-- against the conditions it was formed under.
--
-- THE LEASE IS THE HEARTBEAT AND 'expires' IS IT. A run extends it on every
-- tick. A run that is KILLED extends nothing, so the lease lapses and the
-- ai-run-reap scheduler consumer terminates it — which is how the observation
-- log gets its terminal entry for a run that never ran its own exit path. That
-- is the whole of §14b.6's guarantee and the reason this column is not merely a
-- TTL for tidiness.
--
-- TWO PRINCIPALS, NEVER ONE (§14a, DEC-27(b), DEC-55.4). 'principal_plane' is
-- the plane credential as the control plane stamps it ('member:<id>' for a
-- member, '/<tokenId>' added for a member's AI credential; 'class:<cls>' for a
-- machine, '/<tokenId>' added for an AI credential); 'principal_ai' is
-- the owner of the AI account that pays ('member:<id>', 'project:<id>' or 'group'), and
-- 'principal_ai_ref' the member whose act the run is (R9, R52, T53). They are two different
-- principals and an act must say both. NEITHER IS EVER A TOKEN VALUE, and nothing in the
-- plane writes a credential here.
--
-- NO TRANSCRIPT COLUMN, AND THAT IS DEC-61 (Bob, 2026-08-06). The model's
-- reasoning is DEVICE-LOCAL, TTL'd and deleted at publication, and never in the
-- record store. 'state' is the run's resumable SCRATCH — its work list — and
-- the observation log (observation-log's table, the run's rows under authority
-- 'run') is a structured account of where the search went.
-- Neither is a transcript, and there is no column here one could be put in.
CREATE TABLE IF NOT EXISTS ai_runs (
  run                   TEXT PRIMARY KEY,
  status                TEXT NOT NULL DEFAULT 'running',
  label                 TEXT,
  mode                  TEXT,
  context_type          TEXT NOT NULL,
  context_id            TEXT NOT NULL,
  principal_plane       TEXT NOT NULL,
  principal_ai          TEXT NOT NULL,
  principal_ai_ref      TEXT,
  skill_version         TEXT,
  bias_manifest         TEXT,
  standard_pair         TEXT,
  created               TEXT NOT NULL,
  updated               TEXT NOT NULL,
  expires               TEXT NOT NULL,
  ticks                 INTEGER NOT NULL DEFAULT 1,
  state                 TEXT NOT NULL,
  stopped_bound         TEXT,
  stopped_condition     TEXT,
  stopped_at            TEXT,
  lens_at_open          TEXT,
  rerun_of              TEXT,
  -- R46 (K660): the plan a run in mode 'plan' works on, stored verbatim; NULL for every other run.
  plan                  TEXT,
  step                  TEXT,
  origin                TEXT,
  own_step              TEXT,
  -- R77 (T45): the recorded response a re-examination run re-examines its plan after, verbatim; NULL otherwise.
  response              TEXT,
  -- R78 (T46): the 'untested' label (run-rules R29's untestedLabel) a run admitted on the test-instance exception
  -- carries, recorded at the open and never derived later (R32); NULL for a run the bar admitted.
  untested              TEXT,
  -- R89 (T50; N1186): the project the run was opened in (for a project context, that project), fixed at the open and
  -- never changed; the segment credential of a member's dispatch carries it (credentials R79). NULL when none.
  project               TEXT
);
CREATE INDEX IF NOT EXISTS ai_runs_expires ON ai_runs(status, expires);
CREATE INDEX IF NOT EXISTS ai_runs_context ON ai_runs(context_id);

-- §14b.6's budget, ONE ROW PER BOUND, with its live consumption beside it.
-- Rows rather than columns because F11 (§19, carried by UI-38) requires the
-- surface to render the budget and its consumption while the run is live, and
-- its renderers are field-name-blind — they walk what the record published. A
-- bound added later is a row, and nothing on any surface moves.
--
-- BOTH NUMBERS ARE STORED. UI-38 derives nothing and its suite fails any
-- arithmetic in the rendered output, so the record must publish 'allowed' and
-- 'consumed' separately; a percentage or a remainder computed here would only
-- move the same defect one layer down.
CREATE TABLE IF NOT EXISTS ai_run_bounds (
  run       TEXT NOT NULL,
  bound     TEXT NOT NULL,
  allowed   INTEGER NOT NULL,
  consumed  INTEGER NOT NULL DEFAULT 0,
  unit      TEXT,
  PRIMARY KEY (run, bound)
);

-- D-85 (INVESTIGATIVE-SESSION.md section 11 item 5, rule 2, BOB #25, 2026-09-21): AN ASSISTANT OPENS A
-- QUESTION ONLY INSIDE A RUN. When an 'ai' credential creates an inquiry it names a RUNNING run whose
-- principal it is, and the plane records the link HERE, keyed by the new inquiry. It is an INSTANCE row and
-- never a line in the inquiry's signed bytes: the run is scratch and is never published, and a pointer in
-- published bytes that no reader can resolve is not provenance. One row per inquiry (an inquiry is created
-- once). Its principal is the control plane's stamp for the credential that created it, never a field it sent.
-- The column is named bundle_id so the row rides purge's TABLES list and clears in BOTH arms (D-113).
-- NO index beyond the key: every reader asks by the inquiry.
CREATE TABLE IF NOT EXISTS inquiry_run_surfacings (
  bundle_id  TEXT PRIMARY KEY,
  run        TEXT NOT NULL,
  principal  TEXT NOT NULL,
  at         TEXT NOT NULL
);

-- K1606 (run-rules R19; VF-4): THE ACT THAT RECORDS A MODE'S FIRST LIVE RUN VERIFIED, by a member, with what they saw.
-- Append-only: the chain that lets the next mode deploy is read from these rows, never from a parameter.
-- R73: a step-run's looks are the step's rows of the observation log (authority kind step); each is tied to the run that
-- made it here, so the run's log (R24) and its rollup (R14) read its own looks and no other run's.
CREATE TABLE IF NOT EXISTS ai_run_looks (
  seq  INTEGER PRIMARY KEY,
  run  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_run_looks_run ON ai_run_looks(run, seq);
-- R75: an AI part's result on a test set (Civicsmith's frozen set, or a group's own), written by the harness; figures only,
-- never a transcript.
CREATE TABLE IF NOT EXISTS ai_test_bar (
  seq               INTEGER PRIMARY KEY AUTOINCREMENT,
  part              TEXT NOT NULL,
  set_name          TEXT NOT NULL,
  set_version       TEXT NOT NULL,
  false_alarm_rate  REAL NOT NULL,
  passed            INTEGER NOT NULL,
  graded_by         TEXT NOT NULL,
  at                TEXT NOT NULL,
  -- R75 (T53; AD13, N1258): the entry the result measured, so the standing measure is kept per entry; NULL for a
  -- result recorded before T53, which measured no entry and withdraws none.
  entry_id          TEXT
);
-- R75 (T53; coordinator ruling 5 Nov 03:50): the Gate 1 records ai-gate builds (its R37 gateRecord), written here as
-- given, judged by run-rules' checkGateRecord; append-only, read per (entry, part) by R78's partAdmitted.
CREATE TABLE IF NOT EXISTS ai_gate_records (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id  TEXT NOT NULL,
  part      TEXT NOT NULL,
  verdict   TEXT NOT NULL,
  at        TEXT NOT NULL,
  record    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_gate_records_entry ON ai_gate_records(entry_id, part, seq);
-- R75: a group's own test investigations, each a matter with the answers its members wrote.
CREATE TABLE IF NOT EXISTS ai_group_tests (
  part     TEXT NOT NULL,
  matter   TEXT NOT NULL,
  answers  TEXT NOT NULL,
  by       TEXT NOT NULL,
  at       TEXT NOT NULL,
  PRIMARY KEY (part, matter)
);
-- R91, R92, R101, R102 (T53; AIR25, BR19, DEC-466 U2): A RUN'S SEGMENTS, one row per segment dispatched, numbered from 1:
-- the account it ran on (never a secret: its id, level, owner, provider, plan and means), the entry it was served on, the
-- entries and labels its conversations used (from the ticks' usage), the first conversation's label, the paying owner and
-- the member, its instants, how it ended (segment_end, as end_state), the hop that began it (hop_in, null for the first and
-- for a resume on the same account) and the member's refusal to go on from it (end_refusal). Purged with the run (R38).
CREATE TABLE IF NOT EXISTS ai_run_segments (
  run           TEXT NOT NULL,
  n             INTEGER NOT NULL,
  account_id    TEXT,
  account       TEXT,
  level         TEXT,
  owner         TEXT,
  provider      TEXT,
  plan          TEXT,
  means         TEXT,
  entry_id      TEXT,
  entries_used  TEXT NOT NULL DEFAULT '[]',
  labels        TEXT NOT NULL DEFAULT '[]',
  label         TEXT,
  payer_owner   TEXT,
  member        TEXT,
  started       TEXT NOT NULL,
  ended         TEXT,
  end_state     TEXT,
  hop_in        TEXT,
  end_refusal   TEXT,
  PRIMARY KEY (run, n)
);
-- R107 (T53; AIR25, BR29; agent-steps R56): who produced a log entry's machine result, the deduplicated list of the labels
-- of the conversations that produced it, keyed by the entry's own seq and stored with it; served by op=airunlog.
CREATE TABLE IF NOT EXISTS ai_run_producers (
  seq          INTEGER PRIMARY KEY,
  run          TEXT NOT NULL,
  produced_by  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_mode_verifications (
  mode         TEXT NOT NULL,
  run          TEXT NOT NULL,
  verified_by  TEXT NOT NULL,
  at           TEXT NOT NULL,
  evidence     TEXT NOT NULL,
  PRIMARY KEY (mode, run)
);
`;
