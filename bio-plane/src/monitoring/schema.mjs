/* monitoring's tables (requirements: `build/requirements/monitoring.md`, R21, R13, R41, R52, R71; K4). The first three moved
 * from `schema.mjs` (legacy-store) with their comments; they are DERIVED and declared to record-core's purge (K23, R41):
 * `monitor_fired` by `subject`; `monitor_tick_epoch` and `monitor_address_type` only by a whole-store purge, an
 * address outliving any one version. `monitor_address_frequency` (R52, K1019) holds members' acts, append-only, and is
 * declared to purge only by a whole-store purge for the same reason; so is `monitor_address_end` (R71, T45), an address's
 * end dates, append-only. `monitor_gathering_run` (R28, K1096), the record of
 * every attempt at a named request, is declared to purge by the bundle that carries the request. T24 (N506, K1159): the
 * link sweep's `sweep_runs` and `sweep_filed` left with the sweep for `link-sweep`, which creates and declares them. */

export const MONITORING_SCHEMA = `
-- REC-26 / MACHINE-PROCESSES.md risk 2: the IDEMPOTENCE KEY for the two periodic
-- consumers that FIRE something (CAP-3's archive-monitor and REC-26's
-- monitor-cadence). It exists because a retry is not free here: an archive
-- fallback that succeeds calls recordCapturedLocator, which on conflict does
-- observations = observations + 1, and a run of observations across an interval
-- is the PRIMARY contemporaneity route (LINK-FIDELITY.md). So an alarm retry
-- that re-fires an address that already succeeded MANUFACTURES CORROBORATION —
-- three retries of one observation produce three observations. That is the
-- standing rule "an equality or an outcome that costs nothing to produce is not
-- evidence" landing in a table, not an optimisation.
--
-- One row per (consumer, subject) fired within one TICK EPOCH. The row is written
-- BEFORE the expensive act — taskEnqueue's producer-first dedup pattern — so a
-- subject that was fired and then lost to a throw is still recorded as fired.
CREATE TABLE IF NOT EXISTS monitor_fired (
  consumer  TEXT    NOT NULL,
  subject   TEXT    NOT NULL,
  epoch     INTEGER NOT NULL,
  fired_at  TEXT    NOT NULL,
  PRIMARY KEY (consumer, subject, epoch)
);
CREATE INDEX IF NOT EXISTS monitor_fired_epoch ON monitor_fired(consumer, epoch);

-- The OPEN tick per consumer, and it is the half that makes the key above work
-- across an alarm retry. A retry arrives with a NEW Date.now(), so now cannot
-- identify the tick; the epoch has to be remembered. A row here means "a tick
-- started and did not finish cleanly", so the next tick REUSES its epoch and is
-- that tick's retry rather than a fresh one. It is deleted when a tick ACCOUNTS
-- FOR EVERY ELIGIBLE SUBJECT ITSELF -- nothing failed AND nothing was skipped --
-- which is what lets the NEXT cadence really re-check.
-- D-518, 2026-09-24: the second half of that condition is a CORRECTION. This line
-- read "when a tick completes with nothing failed", and so did the code, which
-- deleted the row on a tick that fired nothing and only SKIPPED subjects an
-- earlier unfinished tick had claimed. That tick learned nothing, and dropping the
-- row let the next wake mint a fresh epoch and re-fire an address that already
-- succeeded, inflating captured_locators.observations -- corroboration nobody
-- produced. The release is now the spent-epoch rule alone, one whole cadence on.
CREATE TABLE IF NOT EXISTS monitor_tick_epoch (
  consumer   TEXT PRIMARY KEY,
  epoch      INTEGER NOT NULL,
  opened_at  TEXT NOT NULL
);

-- REC-191: THE CONTENT TYPE A MONITOR TICK LAST READ AT AN ADDRESS, which is what
-- the cadence plan falls back on when no version authored a frequency (the
-- contract sets the check frequency, BIO_Content_Framework section 6, and
-- CONTRACT_FREQUENCY gives it an interval). op=monitor determines the type on
-- every tick and, until this table, told only its caller -- so a document
-- stating no frequency read UNSCHEDULED in the plan though the tick had answered
-- it by its contract (D-65's worker finding a).
-- Keyed on the NORMALISED address, which is the key captured_locators and the
-- version chain use, so every version at one address shares one reading. The raw
-- address is kept beside it because a bundle with no captured address is matched
-- on its own source.locator, which is raw.
-- A row is replaced only by a tick that DETERMINED a contract, or when none is
-- held: an unreachable source says nothing about what the document is, so it
-- must not erase what an earlier tick read. content_type and contract NULL is a
-- tick that read the address and could not say, with basis saying why.
-- DERIVED from ticks over the corpus: a whole-store purge clears it. A per-bundle
-- purge does not, because an address outlives any one of its versions, the same
-- reasoning as source_reachability.
CREATE TABLE IF NOT EXISTS monitor_address_type (
  address_norm  TEXT PRIMARY KEY,
  address       TEXT NOT NULL,   -- the locator as the ticked document states it
  content_type  TEXT,            -- the doctype key, NULL when undetermined or a shell
  confidence    TEXT,
  contract      TEXT,            -- substance, membership or unmonitorable, NULL when undetermined
  basis         TEXT,            -- why no type was read, when none was
  read_at       TEXT NOT NULL,
  unchanged_run INTEGER NOT NULL DEFAULT 0,  -- R18: checks in a row that found the substance unchanged
  run_since     TEXT             -- R18: the first check of that run, NULL when the run is 0
);
CREATE INDEX IF NOT EXISTS monitor_address_type_raw ON monitor_address_type(address);

-- R52 (K1019): AN ADDRESS'S OWN FREQUENCY, set by a member owning a project that holds a
-- monitored document there, with a canned or custom reason. APPEND-ONLY: a setting is never
-- edited, a later one replaces it (the highest seq at the address governs, R17), and every
-- one stays readable as the address's history. frequency NULL returns the address to R14's
-- rule. Keyed on the NORMALISED address, as monitor_address_type and captured_locators are.
-- Declared to purge only by a whole-store purge: an address outlives any one version.
CREATE TABLE IF NOT EXISTS monitor_address_frequency (
  address_norm  TEXT    NOT NULL,
  seq           INTEGER NOT NULL,  -- 1, 2, ... per address, in the order set
  address       TEXT    NOT NULL,  -- the address as the member named it
  frequency     TEXT,              -- a MONITOR_FREQ word, or NULL (R14's rule)
  reason        TEXT    NOT NULL,  -- a canned key, or 'custom'
  reason_text   TEXT,              -- the member's words, for 'custom' only
  author        TEXT    NOT NULL,
  at            TEXT    NOT NULL,
  PRIMARY KEY (address_norm, seq)
);

-- R71 (T45; N855; Actions D6d): AN ADDRESS'S END DATE, the day from which it is no longer
-- watched, set by a member's act through following R25. APPEND-ONLY as R52's settings are: a
-- setting is never edited, the highest seq at the address governs, and every one stays readable.
-- until NULL clears it (the address returns to R14-R16). Keyed on the NORMALISED address.
-- Declared to purge only by a whole-store purge: an address outlives any one version.
CREATE TABLE IF NOT EXISTS monitor_address_end (
  address_norm  TEXT    NOT NULL,
  seq           INTEGER NOT NULL,  -- 1, 2, ... per address, in the order set
  address       TEXT    NOT NULL,  -- the address as named
  until         TEXT,              -- a calendar day YYYY-MM-DD, or NULL (no end)
  set_by        TEXT    NOT NULL,
  at            TEXT    NOT NULL,
  PRIMARY KEY (address_norm, seq)
);

-- R4, R32 (K5148): AN ADDRESS'S LAST LOOK WHEN IT WAS NOT SIMPLY ANSWERED: one row per address, replaced by every look
-- and deleted by a look the source answered at the address itself. outcome is unconfirmed_removal (a first 404 or
-- 410), removed (one that a look 24 hours or more after absent_since confirmed), moved (a redirect ended at
-- final_address) or refused (any other non-success, its reason in reason). absent_since is the instant of the first
-- 404 or 410 of the run that is still unanswered; the window of R4 is counted from it. Keyed on the NORMALISED address;
-- declared to purge only by a whole-store purge, an address outliving any one version.
CREATE TABLE IF NOT EXISTS monitor_address_look (
  address_norm  TEXT PRIMARY KEY,
  outcome       TEXT NOT NULL,
  at            TEXT NOT NULL,
  absent_since  TEXT,
  final_address TEXT,
  reason        TEXT
);

-- R28 (K1096): THE RECORD OF EVERY ATTEMPT AT A NAMED REQUEST of a bundle's
-- data/gathering.json, one row per attempt, never edited. A request is due by R14's interval
-- from its last attempt (a governed attempt is our pacing and is not one); outcome is
-- captured (new bytes, landed as an Information bundle at collected: landed), held (bytes
-- the record already holds: nothing new lands), failed (no locator filed: tried says each
-- locator's answer) or governed. Declared to purge by the bundle that carries the request.
CREATE TABLE IF NOT EXISTS monitor_gathering_run (
  bundle_id    TEXT    NOT NULL,   -- the bundle whose data/gathering.json carries the request
  request_id   TEXT    NOT NULL,   -- the request's GATH id
  seq          INTEGER NOT NULL,   -- 1, 2, ... per request
  at           TEXT    NOT NULL,
  outcome      TEXT    NOT NULL,   -- captured, held, failed or governed
  locator      TEXT,               -- the locator that filed, when one did
  tried        TEXT    NOT NULL,   -- JSON: [{locator, outcome, status, reason}] in the order tried
  capture_sha  TEXT,
  grade        TEXT,
  landed       TEXT,               -- the Information bundle the new bytes landed as, when promoted
  detail       TEXT,               -- why nothing landed, when bytes were filed and nothing was promoted
  PRIMARY KEY (bundle_id, request_id, seq)
);
`;

/* R18: the columns `monitor_address_type` gained after it was first created, added to a table that predates them. */
const ADDED_COLUMNS = Object.freeze([
  ["monitor_address_type", "unchanged_run", "INTEGER NOT NULL DEFAULT 0"],
  ["monitor_address_type", "run_since", "TEXT"],
]);

/** R41: this module's tables, as record-core's purge declaration names them. */
export const MONITORING_TABLES = Object.freeze([
  { name: "monitor_fired", keys: ["subject"] },
  { name: "monitor_tick_epoch", keys: [] },
  { name: "monitor_address_type", keys: [] },
  { name: "monitor_address_frequency", keys: [] },
  { name: "monitor_address_end", keys: [] },
  { name: "monitor_address_look", keys: [] },
  { name: "monitor_gathering_run", keys: ["bundle_id"] },
]);

/** Which purge declaration names one of this module's tables (record-core R21). */
export function monitoringOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return MONITORING_TABLES.some((x) => x.name === name);
}

export function migrateMonitoring(sql) {
  const bare = MONITORING_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  for (const [table, column, type] of ADDED_COLUMNS) {
    const has = [...sql.exec(`PRAGMA table_info(${table})`)].some((c) => c.name === column);
    if (!has) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
