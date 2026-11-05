/* capture-requests' table (requirements: `build/requirements/capture-requests.md`, R35; K4, K23). Moved out of the
 * legacy `schema.mjs` at this module's extraction, with the comments that record why it is shaped as it is:
 * `capture_requests` and its indexes, and R46's `capture_request_platforms`. Its three additive columns (`lead_inquiry`, `run_woken_at`, `render`)
 * are in the table as created and are added to a store that predates them by `migrateCaptureRequests`, with R40's
 * `source_reason`, R45's `sweep`, R50's `co_archive` (T35), R55's `step` (T41), and T53's R60 `idem`, R62 `produced_by` and R61's
 * `needs_person`, `asked_at`, `brought_by`, `brought_at`; R51's `records_requests` (T35) is its own table; R56 (T47) makes `run`, `target` and `principal_claude` nullable, rebuilding a
 * table that predates it. The table is keyed to a bundle by `target` for purge (R35). */

export const CAPTURE_REQUESTS_SCHEMA = `
-- PL-4 / IS-4 / SWEEP section 4b.1: THE CAPTURE-REQUEST DOOR.
--
-- THE AI DOES NOT CAPTURE. IT REQUESTS, AND THE DAEMON CAPTURES. That is the
-- structural gate DEC-47 kept when it withdrew the authorisation gate, and this
-- table IS the gate: a row here is an ASK, it carries no bytes, no sha and no
-- provenance, and nothing that writes it can fetch anything. The daemon drains
-- it, and DEC-47's conduct rules are enforced at that drain and nowhere else.
--
-- WHY A TABLE RATHER THAN A CONTROL-PLANE ENQUEUE. The op declarations
-- (op-declarations) deliberately omit taskenqueue from the OPS table, with the reasoning written into the table
-- itself: no control-plane route may put an event in the queue on its own
-- account. A scoped enqueue op would have crossed that. The table keeps the door
-- the OPS comment closed still closed, keeps the daemon the sole fetcher, and
-- gives DEC-47's conduct ONE enforcement point.
--
-- SCRATCH-CLASS, in capture_sessions' and ai_runs' family and NOT record. It
-- holds no member act, nothing derived from one, and nothing a case is built on:
-- it is a work list with an expiry. The CAPTURE it produces is record and lands
-- exactly where the daemon's captures always have, at collected and never
-- higher.
--
-- BOTH PRINCIPALS ARE COLUMNS (DEC-27(b), DEC-55.4). R56 (T47) made run,
-- target and principal_claude nullable for ONE kind of row: a member's own
-- request ("Ask for this later"), which no run made and no cascade paid for,
-- so its plane principal (her session stamp) is its whole attribution. Every
-- run's request still carries both; the drain still refuses one that cannot.
-- They are RECORDED AT THE REQUEST rather than resolved at the drain (the plane
-- principal is the caller's stamp, REC-168; the Claude principal is the run's),
-- because a run is scratch with an expiry and the attribution must survive it:
-- an act attributable only while the run that asked is still alive is an act
-- nobody can account for afterwards. A record naming ONE of the two is the
-- defect DEC-27(b) names, so the drain refuses to compose an attribution that
-- cannot state both.
--
-- host IS DERIVED AT THE WRITE and stored, so the drain's rate rule reads one
-- column instead of re-parsing a locator inside the enforcement point. A URL
-- this plane cannot parse never becomes a row at all.
--
-- state IS THE FENCE AS WELL AS THE LIFECYCLE. requested -> draining -> captured
-- is the only route to bytes, and draining is set by the drain alone, inside the
-- tick that then fetches through capture's in-process arm (K58), which nothing
-- outside the drain can reach: op=acquire refuses via capture-request from any
-- caller, so the AI capturing directly rather than requesting is refused by
-- construction and not by a class list.
CREATE TABLE IF NOT EXISTS capture_requests (
  request           TEXT PRIMARY KEY,
  run               TEXT,             -- the run that asked. NO FOREIGN KEY, section 14b.7's rule for versions applied one level down. NULL only on a member's own request (R56, T47)
  target            TEXT,             -- the inquiry the run is working under: a bundle id, which is what purge's per-bundle arm can find. NULL only on a member's own request that names none (R56)
  address           TEXT NOT NULL,    -- the public https locator asked for
  host              TEXT NOT NULL,    -- derived at the write from address
  purpose           TEXT NOT NULL,    -- the user-agent purpose token this fetch will carry
  ua_mode           TEXT NOT NULL,    -- civicsmith (civicos before T31, read as civicsmith: R14, DEC-124), or member-browser (BOB-3, permitted for public documents)
  principal_plane   TEXT NOT NULL,    -- the caller's stamp (REC-168): whose scope the writes ran under
  principal_claude  TEXT,             -- the run's: WHICH LEVEL of the cascade paid. NULL only on a member's own request (R56): no run, no cascade
  state             TEXT NOT NULL,    -- requested | draining | captured | refused | expired (D-523, a C-83 render hold released UNDETERMINED at expires)
  code              TEXT,             -- the DEC-49 wire code, when the drain refused or held this row
  detail            TEXT,             -- what the drain said, so a held row explains itself without a second call
  capture_sha       TEXT,             -- what the daemon captured. WRITTEN BY THE DRAIN ONLY
  attempts          INTEGER NOT NULL DEFAULT 0,
  requested_at      TEXT NOT NULL,
  updated           TEXT NOT NULL,
  expires           TEXT NOT NULL,
  captured_at       TEXT,
  -- PL-15 / D-213: THE OTHER QUESTION. NULL on every ordinary request, and NULL
  -- is the honest answer there rather than a default -- a capture asked for
  -- under the question the run is working bears on that question and on nothing
  -- else until somebody says otherwise.
  --
  -- WHEN IT IS SET it names a DIFFERENT inquiry from 'target': the run met
  -- evidence for question B while working question A, and this column is the
  -- observation. 'target' stays A, because the request is still accountable to
  -- the question it was made under, while THIS column names what the evidence
  -- is ABOUT. The two may never be equal, and the door refuses that rather than
  -- storing a lead that leads back where it started.
  --
  -- IT IS A SECOND BUNDLE ID ON THIS ROW, which is why purge's PER-BUNDLE arm
  -- gained a predicate for it in the same turn. The whole-store arm already
  -- clears the table, while the per-bundle arm matched 'target' only, so purging
  -- inquiry B would have left a lead standing that points at a question no
  -- longer in the store -- D-113's class arriving through a column instead of
  -- through a table, and invisible to hygiene's structural check for exactly
  -- that reason.
  lead_inquiry      TEXT,
  -- FL-4 / IS-9 / section 14b.3: WHEN THE RUN WAS WOKEN FOR THIS COMPLETION,
  -- and NULL means the daemon has answered and the run has not been told yet.
  --
  -- IT IS ON THE REQUEST AND NOT ON THE RUN, because the thing that completes is
  -- a request and a run may be waiting on several. A flag on the run would make
  -- "this run has been woken" true while a second request was still owed an
  -- answer, and the wake would be consumed by the first completion to land.
  --
  -- AN INSTANT RATHER THAN A FLAG, on the same reasoning captured_at carries:
  -- the record can then say WHEN the run was told, which is what makes a lease
  -- extension accountable to something rather than an unexplained clock move.
  --
  -- NULL IS THE HONEST DEFAULT AND IT INVENTS NOTHING. A row written before this
  -- column existed was never woken -- nothing existed to wake it -- and the
  -- consumer's own predicate requires the run to still be running, so a request
  -- belonging to a run that has already ended is never woken retroactively.
  run_woken_at      TEXT,
  -- D-491 / IC-276 / CLIENT-RENDERED.md, BOB #32 item 3: DOES THIS REQUEST ASK
  -- FOR THE PAGE AS A VISITOR SAW IT. 0 is the served document, captured exactly
  -- as every request before this column was. 1 asks the drain for the rendered
  -- pair, and BOB #32 item 3 is what makes that askable at all -- an unattended
  -- sweep MAY render, within the allowance and through the host governor.
  --
  -- NOT NULL DEFAULT 0, AND THAT IS THE HONEST DEFAULT HERE WHERE IT WOULD NOT
  -- BE ON THE TWO COLUMNS ABOVE. lead_inquiry and run_woken_at are nullable
  -- because a legacy row had an unstated value that a default would invent. This
  -- column has no unstated value to invent: a request written before it existed
  -- could not ask for a render, because no door read the flag and no drain could
  -- have honoured one, so 0 states what was true of it rather than guessing.
  --
  -- IT IS THE ROW AND NOT THE CALL THAT CARRIES IT, for the reason address,
  -- purpose and ua_mode are on the row: capture's in-process arm is handed it by
  -- the drain from the row it judged, so what this instance renders is what
  -- the drain judged.
  --
  -- WHEN THE RENDER CANNOT HAPPEN THE ROW IS HELD, never captured: capture's arm
  -- answers a named C-83 refusal before anything is fetched, the drain records
  -- that code and leaves the row in requested, and the served shell is NEVER
  -- filed as though it were the content. That sentence is the whole of C-83 and
  -- the reason this column cannot be read as advisory.
  render            INTEGER NOT NULL DEFAULT 0,
  -- K103 (3), capture-requests R40: WHY THE SOURCE TURNED THIS REQUEST AWAY, when
  -- it did: login, paywall, user-agent or other. NULL when nothing the source
  -- said decided the row (conduct, pacing, a render this instance could not do),
  -- so a reason is never invented for a refusal that was ours.
  source_reason     TEXT,
  -- R45 (T23; Intake Doctrine §4): THE SWEEP THIS REQUEST ASKS TO BE FILED
  -- UNDER, as its full name "<bundle>#<id>", or NULL for an ordinary request.
  -- NULL is the honest value on every row written before it: no door read a
  -- sweep then, so none was asked. The drain files a request naming one under
  -- that sweep only when link-sweep's scope check admits it, and refuses it
  -- C-28.19 otherwise; it is never quietly filed as an ordinary request.
  sweep             TEXT,
  -- R50 (T35; K1888 (4)): THE MEMBER'S CO-ARCHIVE CHOICE for this capture: 1
  -- (ask the co-archive), 0 (ask none), or NULL (the group's setting decides
  -- at the fetch, acquisition's R43). NULL is the honest value on every row
  -- written before it: no member chose then. Passed to the fetch unchanged.
  co_archive        INTEGER,
  -- R55 (T41-25; N820): THE STEP THIS REQUEST IS WORK FOR, a steps id the
  -- run's principal sees at the door, or NULL for a request made for no step.
  -- NULL is the honest value on every row written before it: no door read a
  -- step then. On completion the drain ties the capture to it
  -- (steps.recordProduct), and the step's arrival wait reads this row.
  step              TEXT,
  -- R60 (T53; K5571 (6)): THE AGENT'S IDEMPOTENCE KEY for this write,
  -- <run>:<pass>:<step>:<n>, identical when its step re-runs after a stop; a
  -- second request of the run carrying it answers this row (repeated: true).
  -- NULL on a request that sent none, and on every row written before it.
  idem              TEXT,
  -- R62 (T53; AIR25, BR29): THE LABELS OF THE CONVERSATIONS THAT PRODUCED the
  -- candidate, a JSON list as agent-model answered each, deduplicated in order;
  -- NULL when none was sent (a member's request, a script's).
  produced_by       TEXT,
  -- R61 (T53; K5574, K5575): THE SITE ASKED FOR A PERSON. 1 once a drain fetch
  -- was answered SITE_ASKS_FOR_PERSON (acquisition R140): the row waits for the
  -- member, the drain never selects it again, and it stays 1 once her file
  -- completes it, as the record that the site asked. asked_at is that instant.
  needs_person      INTEGER NOT NULL DEFAULT 0,
  asked_at          TEXT,
  -- R61: who brought the file from the address, on her word, and when.
  brought_by        TEXT,
  brought_at        TEXT
);
CREATE INDEX IF NOT EXISTS capture_requests_state ON capture_requests(state, requested_at);
CREATE INDEX IF NOT EXISTS capture_requests_target ON capture_requests(target);
CREATE INDEX IF NOT EXISTS capture_requests_run ON capture_requests(run);
-- D-581, R26-R27: the queue's producers read captured rows by completion and
-- held renders by their last update, each bounded; these let a bounded read
-- stop at its limit instead of sorting every terminal row the table holds.
CREATE INDEX IF NOT EXISTS capture_requests_completed ON capture_requests(state, captured_at, request);
CREATE INDEX IF NOT EXISTS capture_requests_renders ON capture_requests(render, state, updated, request);
-- R39 (N262): the drain finds the capture this table holds of an address (and
-- render flag) to fetch conditionally on, by one indexed read per fired row.
CREATE INDEX IF NOT EXISTS capture_requests_address ON capture_requests(address, render, state, captured_at);
-- R48 (N587; DEC-141): capture's held list asks, per document, which requests
-- filed one of its capture digests (the captured-for reader), so that read is
-- one indexed lookup per digest rather than a walk of every request.
CREATE INDEX IF NOT EXISTS capture_requests_sha ON capture_requests(capture_sha, state);
-- R60: a run's idem is one lookup; R61: the rows waiting for a person.
CREATE INDEX IF NOT EXISTS capture_requests_idem ON capture_requests(run, idem);
CREATE INDEX IF NOT EXISTS capture_requests_person ON capture_requests(needs_person, state, address);
-- R46 (T33-51; K1492 (2), (4)): THE HOSTS A MEMBER HAS MARKED A LOGIN-GATED
-- PLATFORM, R41's scope record for a platform (kind 'platform'). A page on such
-- a host is captured only by a member's own act in their own browser: the drain
-- never sends a supplied login to a marked host, and a source asking a login
-- there is refused MEMBER_CAPTURE_ONLY and routed to the members, never retried
-- with a login. A mark is GROUP-WIDE (a platform is a platform for every
-- request) and holds NO SECRET: the host, who marked it and when. Withdrawn, the
-- row stays with who withdrew it and when, so the record says why a request
-- was routed while the mark stood. At most one standing mark per host.
CREATE TABLE IF NOT EXISTS capture_request_platforms (
  mark              TEXT PRIMARY KEY, -- PLM-<instant>-<random>, minted here
  host              TEXT NOT NULL,    -- exact, lower-cased: never a parent domain or another subdomain
  kind              TEXT NOT NULL,    -- 'platform'
  scope             TEXT NOT NULL,    -- 'group'
  marked_by         TEXT NOT NULL,    -- the member (or 'admin') who marked it
  marked_at         TEXT NOT NULL,
  withdrawn_at      TEXT,
  withdrawn_by      TEXT
);
CREATE INDEX IF NOT EXISTS capture_request_platforms_host ON capture_request_platforms(host, withdrawn_at);
-- R51-R53 (T35; N646, POLICIES L2 PO3; K1724, K1740): A RECORDS REQUEST FOR A
-- POLICY KNOWN ONLY BY CITATION. The group's own record that it asked the
-- policy's issuer for its text, and of the answer, by members' acts. It is a
-- table apart from capture_requests: it carries no address, is never drained
-- and fetches nothing, and nothing here sends it to anyone. RECORD, not
-- scratch: the request and its answer are the search a "not found" entry
-- holds (K1724), so it is purged with the standard it names, by that key.
CREATE TABLE IF NOT EXISTS records_requests (
  request           TEXT PRIMARY KEY, -- RR-<instant>-<random>, minted here
  standard          TEXT NOT NULL,    -- the standard (a bundle id) held 'cited'
  citation          TEXT NOT NULL,    -- JSON: {cite, cited_by}, copied from the standard at the open
  addressee         TEXT NOT NULL,    -- JSON: the standard's issuer, as standards holds it
  opened_by         TEXT NOT NULL,    -- the member who opened it
  opened_at         TEXT NOT NULL,
  state             TEXT NOT NULL,    -- open | answered
  answer            TEXT,             -- produced | none_exists | withheld | no_answer
  answer_capture    TEXT,             -- the capture the issuer produced (produced only)
  answer_note       TEXT,             -- the stated ground (withheld only)
  answered_by       TEXT,
  answered_at       TEXT
);
CREATE INDEX IF NOT EXISTS records_requests_standard ON records_requests(standard, state);
`;

/** The columns added after the table was first created, each added to a store that predates it. A legacy row's value
 *  is the honest one each comment gives: NULL for an unstated lead, wake, source reason or sweep, 0 for a render nobody
 *  could have asked for. */
export const CAPTURE_REQUESTS_ADDITIVE = Object.freeze([
  ["lead_inquiry", "TEXT"],
  ["run_woken_at", "TEXT"],
  ["render", "INTEGER NOT NULL DEFAULT 0"],
  ["source_reason", "TEXT"],
  ["sweep", "TEXT"],
  ["co_archive", "INTEGER"],
  ["step", "TEXT"],
  ["idem", "TEXT"],
  ["produced_by", "TEXT"],
  ["needs_person", "INTEGER NOT NULL DEFAULT 0"],
  ["asked_at", "TEXT"],
  ["brought_by", "TEXT"],
  ["brought_at", "TEXT"],
]);

/** R56 (T47): the columns a member's own request leaves NULL, made nullable in a store whose table predates it. */
export const CAPTURE_REQUESTS_NULLABLE = Object.freeze(["run", "target", "principal_claude"]);
const PRE_T47 = "capture_requests_pre_t47";

export function migrateCaptureRequests(sql) {
  const info = [...sql.exec(`PRAGMA table_info(capture_requests)`)];
  const have = info.map((r) => r.name);
  if (have.length)
    for (const [column, decl] of CAPTURE_REQUESTS_ADDITIVE)
      if (!have.includes(column)) sql.exec(`ALTER TABLE capture_requests ADD COLUMN ${column} ${decl}`);
  const bare = CAPTURE_REQUESTS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  /* R56: SQLite cannot drop NOT NULL in place, so a table created before T47 is rebuilt once: renamed aside, its
     indexes dropped (they keep their names across a rename and would stop the schema re-creating them), the table
     created as it now stands, every row copied, and the old one dropped. Within one synchronous call, so the Durable
     Object commits it whole. */
  const strict = info.some((r) => CAPTURE_REQUESTS_NULLABLE.includes(r.name) && Number(r.notnull) === 1);
  if (strict) {
    sql.exec(`ALTER TABLE capture_requests RENAME TO ${PRE_T47}`);
    for (const ix of [...sql.exec(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL`, PRE_T47)])
      sql.exec(`DROP INDEX IF EXISTS "${ix.name}"`);
  }
  for (const stmt of bare.split(";")) if (stmt.trim()) sql.exec(stmt);
  if (strict) {
    const cols = [...sql.exec(`PRAGMA table_info(${PRE_T47})`)].map((r) => r.name).map((c) => `"${c}"`).join(", ");
    sql.exec(`INSERT INTO capture_requests (${cols}) SELECT ${cols} FROM ${PRE_T47}`);
    sql.exec(`DROP TABLE ${PRE_T47}`);
  }
}
