/* ai-use's tables (R7): the DDL this module owns. `AiUse#migrate` runs it at the module's first construction, idempotent.
 * SQL comments are `--` lines, dropped before the statements run. Every table is declared through record-core's
 * `declareTable` (its R21) as `AI_USE_TABLES` states: `export: "admin-only"`, `sight: "group"`, cleared by the
 * whole-store purge only, except that a project's limits, their history and its exploring asks are also deleted with
 * the project (keyed by `project_id`, record-core R46). */
export const AI_USE_SCHEMA = `
-- R1 (was ai-runs R48, R49; B8): THE USE COUNTER, one row per paying account ('owner': 'group', 'project:<id>',
-- 'member:<id>', or 'not recorded' for a row counted before T40), member, local day (civil-time's localDay in the
-- group's zone), kind of use ('use', an ai-accounts USE_KINDS entry) and mode: the sums of each model call's figures
-- and a count of calls. It holds no question, answer, address or content. Cost is summed in millionths of a dollar so
-- the sum is exact. A figure not stated adds nothing and is counted in 'tokens_unstated' / 'cost_unstated', never as 0.
CREATE TABLE IF NOT EXISTS ai_usage (
  owner                        TEXT NOT NULL,
  member                       TEXT NOT NULL,
  day                          TEXT NOT NULL,
  use                          TEXT NOT NULL,
  mode                         TEXT NOT NULL,
  calls                        INTEGER NOT NULL DEFAULT 0,
  input_tokens                 INTEGER NOT NULL DEFAULT 0,
  output_tokens                INTEGER NOT NULL DEFAULT 0,
  cache_read_input_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_creation_input_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_micro_usd               INTEGER NOT NULL DEFAULT 0,
  tokens_unstated              INTEGER NOT NULL DEFAULT 0,
  cost_unstated                INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner, member, day, use, mode)
);
CREATE INDEX IF NOT EXISTS ai_usage_owner_day ON ai_usage(owner, day);

-- R10, R11 (D12): ONE ROW PER MEASURED ACT (a run, or an ask's or a draft's own act id), its sums as the counter's,
-- so a range can be estimated from an account's measured acts and an act's actual cost answered after. Numbers only;
-- its models and efforts are in ai_use_act_models (R15).
CREATE TABLE IF NOT EXISTS ai_use_acts (
  owner                        TEXT NOT NULL,
  act                          TEXT NOT NULL,
  use                          TEXT NOT NULL,
  mode                         TEXT NOT NULL,
  calls                        INTEGER NOT NULL DEFAULT 0,
  tokens                       INTEGER NOT NULL DEFAULT 0,
  cost_micro_usd               INTEGER NOT NULL DEFAULT 0,
  tokens_unstated              INTEGER NOT NULL DEFAULT 0,
  cost_unstated                INTEGER NOT NULL DEFAULT 0,
  first_at                     TEXT NOT NULL,
  last_at                      TEXT NOT NULL,
  PRIMARY KEY (owner, act)
);
CREATE INDEX IF NOT EXISTS ai_use_acts_measure ON ai_use_acts(owner, use, mode, last_at);

-- R15 (T50; N1168): THE MODELS AND EFFORTS OF EACH MEASURED ACT, one row per model and effort its conversations ran at
-- ('' where none was stated, read back as null), with their calls. 'seq' gives first-seen order. Names only, no content.
CREATE TABLE IF NOT EXISTS ai_use_act_models (
  seq      INTEGER PRIMARY KEY AUTOINCREMENT,
  owner    TEXT NOT NULL,
  act      TEXT NOT NULL,
  model    TEXT NOT NULL,
  effort   TEXT NOT NULL,
  calls    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (owner, act, model, effort)
);

-- R2 (D39; B4): THE LIMITS, at most one per owner, scope, unit and period. 'amount' is whole cents for 'usd', whole
-- tokens or calls otherwise. 'inclusive' is 1 or 0 for a use scope, NULL for 'overall' and 'per_member'. 'project_id'
-- names the project of a 'project:<id>' owner, so the project's purge deletes its limits (R7).
CREATE TABLE IF NOT EXISTS ai_limits (
  owner       TEXT NOT NULL,
  scope       TEXT NOT NULL,
  unit        TEXT NOT NULL,
  period      TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  inclusive   INTEGER,
  project_id  TEXT,
  set_by      TEXT NOT NULL,
  set_at      TEXT NOT NULL,
  PRIMARY KEY (owner, scope, unit, period)
);

-- R2, R12: EVERY SET, appended, never replaced: 'change' is 'set' (a new limit), 'changed' or 'removed'.
CREATE TABLE IF NOT EXISTS ai_limit_history (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner       TEXT NOT NULL,
  scope       TEXT NOT NULL,
  unit        TEXT NOT NULL,
  period      TEXT NOT NULL,
  change      TEXT NOT NULL,
  amount      INTEGER,
  inclusive   INTEGER,
  project_id  TEXT,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_limit_history_owner ON ai_limit_history(owner, seq);

-- R5 (B7): THE FIRST TIME EACH LIMIT WAS REACHED IN EACH OF ITS PERIODS, written when a count (R1) or a set (R2) finds
-- it reached, once, so owners are told once per account, limit and period.
CREATE TABLE IF NOT EXISTS ai_limit_reached (
  owner         TEXT NOT NULL,
  scope         TEXT NOT NULL,
  unit          TEXT NOT NULL,
  period        TEXT NOT NULL,
  period_start  TEXT NOT NULL,
  reached_at    TEXT NOT NULL,
  project_id    TEXT,
  PRIMARY KEY (owner, scope, unit, period, period_start)
);

-- R9 (A5, K2350): AT MOST ONE EXPLORING ASK AN OWNER AND LOCAL DAY, and its approval; silence means no.
CREATE TABLE IF NOT EXISTS ai_explore_asks (
  owner        TEXT NOT NULL,
  day          TEXT NOT NULL,
  what         TEXT,
  asked_at     TEXT,
  approved_by  TEXT,
  approved_at  TEXT,
  project_id   TEXT,
  PRIMARY KEY (owner, day)
);

-- R1, R21 (T53; BR22): THE MONEY OF THE COUNTER, kept apart from ai_usage per unit: what the provider (or the gateway
-- log) reported and what the catalogue's price estimated, in millionths of the unit, never added together; with the calls
-- that carried each, so a sum says how many were priced. A unit other than 'usd' is summed only with its own unit.
CREATE TABLE IF NOT EXISTS ai_usage_money (
  owner            TEXT NOT NULL,
  member           TEXT NOT NULL,
  day              TEXT NOT NULL,
  use              TEXT NOT NULL,
  mode             TEXT NOT NULL,
  unit             TEXT NOT NULL,
  reported_micro   INTEGER NOT NULL DEFAULT 0,
  reported_calls   INTEGER NOT NULL DEFAULT 0,
  estimated_micro  INTEGER NOT NULL DEFAULT 0,
  estimated_calls  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner, member, day, use, mode, unit)
);
CREATE INDEX IF NOT EXISTS ai_usage_money_owner_day ON ai_usage_money(owner, day);

-- R28 (T53): THE USE OF EACH ENTRY BY EACH OWNER AND LOCAL DAY, in money and calls, for the monthly re-test caps
-- (scope 'retest:<entry_id>'). Numbers only.
CREATE TABLE IF NOT EXISTS ai_usage_entries (
  owner            TEXT NOT NULL,
  day              TEXT NOT NULL,
  entry_id         TEXT NOT NULL,
  mode             TEXT NOT NULL,
  calls            INTEGER NOT NULL DEFAULT 0,
  reported_micro   INTEGER NOT NULL DEFAULT 0,
  estimated_micro  INTEGER NOT NULL DEFAULT 0,
  unpriced_calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (owner, day, entry_id, mode)
);

-- R11, R15 (T53): EACH MEASURED ACT'S CONVERSATIONS, one row per entry and label (provider, host, model version,
-- effort, account level, owner; '' where not stated, read back as null), with their calls, 'seq' first-seen order.
CREATE TABLE IF NOT EXISTS ai_use_act_entries (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner          TEXT NOT NULL,
  act            TEXT NOT NULL,
  entry_id       TEXT NOT NULL,
  provider       TEXT NOT NULL,
  host           TEXT NOT NULL,
  model_version  TEXT NOT NULL,
  effort         TEXT NOT NULL,
  account_level  TEXT NOT NULL,
  label_owner    TEXT NOT NULL,
  calls          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (owner, act, entry_id, provider, host, model_version, effort, account_level, label_owner)
);

-- R18 (T53; BR23): THE PROVIDER LIMITS agent-model returned as a 'limit' outcome, one row per account, entry ('' for an
-- account-wide limit), kind and resets_at ('' when the provider gave none). 'recorded_at' is the latest recording. No
-- provider message is kept.
CREATE TABLE IF NOT EXISTS ai_provider_limits (
  owner        TEXT NOT NULL,
  account_id   TEXT NOT NULL,
  entry_id     TEXT NOT NULL,
  kind         TEXT NOT NULL,
  scope        TEXT NOT NULL,
  resets_at    TEXT NOT NULL,
  recorded_at  TEXT NOT NULL,
  project_id   TEXT,
  PRIMARY KEY (account_id, entry_id, kind, resets_at)
);

-- R23, R24 (T53; BR24): THE ALERT THRESHOLDS, several per owner, scope, unit and period; 'level' a percent of the matching
-- limit or an amount in the unit (whole cents for usd); their history appended; each first crossing in a period noted once.
CREATE TABLE IF NOT EXISTS ai_thresholds (
  owner       TEXT NOT NULL,
  scope       TEXT NOT NULL,
  unit        TEXT NOT NULL,
  period      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  level       INTEGER NOT NULL,
  project_id  TEXT,
  set_by      TEXT NOT NULL,
  set_at      TEXT NOT NULL,
  PRIMARY KEY (owner, scope, unit, period, kind, level)
);
CREATE TABLE IF NOT EXISTS ai_threshold_history (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner       TEXT NOT NULL,
  scope       TEXT NOT NULL,
  unit        TEXT NOT NULL,
  period      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  level       INTEGER,
  change      TEXT NOT NULL,
  project_id  TEXT,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_threshold_crossed (
  owner         TEXT NOT NULL,
  scope         TEXT NOT NULL,
  unit          TEXT NOT NULL,
  period        TEXT NOT NULL,
  kind          TEXT NOT NULL,
  level         INTEGER NOT NULL,
  period_start  TEXT NOT NULL,
  crossed_at    TEXT NOT NULL,
  basis         TEXT,
  project_id    TEXT,
  PRIMARY KEY (owner, scope, unit, period, kind, level, period_start)
);

-- R25 (T53): A RECONCILIATION GAP outside RECONCILE_TOLERANCE, recorded in the account's history with who and when.
CREATE TABLE IF NOT EXISTS ai_reconcile_gaps (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner       TEXT NOT NULL,
  period      TEXT NOT NULL,
  figure      TEXT NOT NULL,
  ours        REAL,
  theirs      REAL,
  unit        TEXT,
  source      TEXT NOT NULL,
  project_id  TEXT,
  by          TEXT NOT NULL,
  at          TEXT NOT NULL
);

-- R28, R29 (T53; K5480): EACH PAYING ACCOUNT'S RE-TEST SWITCH, on until turned off, with who turned it off and when.
CREATE TABLE IF NOT EXISTS ai_retest (
  owner           TEXT PRIMARY KEY,
  on_             INTEGER NOT NULL DEFAULT 1,
  changed_by      TEXT,
  changed_at      TEXT,
  turned_off_by   TEXT,
  turned_off_at   TEXT,
  project_id      TEXT
);

-- R31 (T53; AD38; K5487): THE HEALTH COUNTS per entry, personal flag and UTC day: calls, refusals, silences and one count
-- per agent-model error class (a JSON object of class to count). No owner, account, member, run, content or message.
CREATE TABLE IF NOT EXISTS ai_health (
  entry_id  TEXT NOT NULL,
  personal  INTEGER NOT NULL,
  day       TEXT NOT NULL,
  calls     INTEGER NOT NULL DEFAULT 0,
  refused   INTEGER NOT NULL DEFAULT 0,
  silent    INTEGER NOT NULL DEFAULT 0,
  errors    TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (entry_id, personal, day)
);

-- R32, R33 (T53): THE TEAM'S HEALTH-SHARING SWITCH, every set appended (the latest is the state), and the days sent.
CREATE TABLE IF NOT EXISTS ai_health_switch (
  seq  INTEGER PRIMARY KEY AUTOINCREMENT,
  on_  INTEGER NOT NULL,
  by   TEXT NOT NULL,
  at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_health_sent (
  day      TEXT PRIMARY KEY,
  sent_at  TEXT NOT NULL
);

-- R1, R2: the migrations this module has carried out, each once (today: the pre-T40 ceilings, B4).
CREATE TABLE IF NOT EXISTS ai_use_migrations (
  name  TEXT PRIMARY KEY,
  at    TEXT NOT NULL
);
`;

/* R1, R10, R22 (T53): columns added to tables a running store already holds, each added once by `migrate` when absent. */
export const AI_USE_ADDED_COLUMNS = Object.freeze([
  ["ai_usage", "reasoning_tokens", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_usage", "unpriced_calls", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_usage", "unstated", "TEXT NOT NULL DEFAULT '[]'"],
  ["ai_use_acts", "member", "TEXT"],
  ["ai_use_acts", "last_input_tokens", "INTEGER"],
  ["ai_use_acts", "unpriced_calls", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_use_acts", "reported_micro", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_use_acts", "reported_calls", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_use_acts", "estimated_micro", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_use_acts", "estimated_calls", "INTEGER NOT NULL DEFAULT 0"],
  ["ai_use_acts", "money_unit", "TEXT"],
]);

const CLASSES = Object.freeze({ purge: "clear", expunge: "none", export: "admin-only", sight: "group", derive: "stored",
  version_chain: false });

/* R7: each table's declaration. `keys: []` is cleared by the whole-store purge only; `keys: ["project_id"]` also by the
   purge of the project the row names. */
export const AI_USE_TABLES = Object.freeze([
  { name: "ai_usage", keys: [] },
  { name: "ai_use_acts", keys: [] },
  { name: "ai_use_act_models", keys: [] },
  { name: "ai_use_migrations", keys: [] },
  { name: "ai_limits", keys: ["project_id"] },
  { name: "ai_limit_history", keys: ["project_id"] },
  { name: "ai_limit_reached", keys: ["project_id"] },
  { name: "ai_explore_asks", keys: ["project_id"] },
  { name: "ai_usage_money", keys: [] },
  { name: "ai_usage_entries", keys: [] },
  { name: "ai_use_act_entries", keys: [] },
  { name: "ai_provider_limits", keys: ["project_id"] },
  { name: "ai_thresholds", keys: ["project_id"] },
  { name: "ai_threshold_history", keys: ["project_id"] },
  { name: "ai_threshold_crossed", keys: ["project_id"] },
  { name: "ai_reconcile_gaps", keys: ["project_id"] },
  { name: "ai_retest", keys: ["project_id"] },
  { name: "ai_health", keys: [] },
  { name: "ai_health_switch", keys: [] },
  { name: "ai_health_sent", keys: [] },
].map((t) => Object.freeze({ ...t, keys: Object.freeze([...t.keys]), ...CLASSES })));
