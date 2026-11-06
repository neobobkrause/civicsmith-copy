/* action-records' tables (requirements: `build/requirements/action-records.md`, R1–R6, R11, R15, R17; K4). Copied from
 * `actions`' `schema.mjs` with their comments (K624; split map `build/extraction/actions-split.md` §2), each with the DDL
 * `actions` created it by, so a running store's rows are kept with no data move: the three proposals stored apart (was
 * `actions` R19, R28, R73) and the members' side records (was R80, R87, R88). Each is keyed by the action's `bundle_id`
 * and declared to record-core's purge (R11; K23), so a purge of that action clears its rows. A requirement id in a copied
 * comment is `actions`' as it was written there. */

export const ACTION_RECORDS_SCHEMA = `
-- REC-195 (D-149's remaining half, BIO_Case_Making_v0_1.md §2): A MACHINE'S
-- PROPOSAL OF THE LAWS GOVERNING AN ACTION, STORED APART FROM THE MEMBER'S LIST.
--
-- D-149: *the machine may propose the list from the counterparty, labelled as
-- machine work, and never sets it*. THE WHOLE POINT OF THIS TABLE IS THE WORD
-- APART. The member's list lives in the action's own frontmatter
-- (governing_laws[], set by op=actionlaws and by nothing else, C-73.1), and a
-- proposal that shared that home would BE the list the moment anything read the
-- document -- the overclaim this row exists to refuse. So a proposal is not a
-- projection of the bytes, nothing writes it into them, and no read composes the
-- two: op=projection's action block serves governing_laws and
-- governing_laws_proposals as two separate answers, each saying whose it is.
--
-- KEYED (bundle_id, proposed_by, ord): ONE STANDING PROPOSAL PER PROPOSER, its
-- citations ordered as proposed. A proposer restating replaces its own rows and
-- nobody else's, which is themes' hunch discipline one construct over: the
-- record keeps who proposed what, and two machines proposing different lists is
-- two proposals rather than one overwriting the other.
--
-- NOTHING HERE IS DERIVED FROM THE COUNTERPARTY BY THIS PLANE. The proposer
-- supplies the citations and the levels, and the plane stores them under that
-- proposer's name and encodes no law's rules (D-149), which is why there is no
-- column mapping an agency to a law.
--
-- Carries bundle_id, so it clears in BOTH purge arms through the TABLES list
-- (D-113), and the module test of R11 (here; R36 in actions) holds that list against this file. A proposal
-- outliving the action it was made against would attach itself to whatever
-- bundle was next allocated that id -- somebody else's request wearing a
-- machine's citations.
CREATE TABLE IF NOT EXISTS action_law_proposals (
  bundle_id   TEXT NOT NULL,   -- the action
  proposed_by TEXT NOT NULL,   -- the control plane's stamp: class:<cls>, class:ai/<tokenId>, or a member handle
  ord         INTEGER NOT NULL,-- position in the proposed list
  level       TEXT NOT NULL,   -- one of LAW_LEVELS, judged before the write
  citation    TEXT NOT NULL,   -- as the proposer wrote it, and never parsed for a rule
  standard    TEXT,            -- R64: the held standard (STD-) the proposer names with it, or NULL
  proposed_at TEXT NOT NULL,
  layer       TEXT,            -- R21 (T53): the layer that gave the law, as the proposer named it, NULL when none was named
  ambiguous   INTEGER,         -- R21: 1 when no layer was named and two active layers give the citation, NULL before R21
  PRIMARY KEY (bundle_id, proposed_by, ord)
);

-- R28 (REC-215): A PROPOSED RISK TIER, STORED APART FROM THE MEMBER'S. Any
-- credential may propose; a proposer's restatement replaces its own row and
-- nobody else's (keyed bundle_id, proposed_by). Nothing here is the tier: the
-- tier is the action's own risk_tier, set by a member's act (R23-R24), and no
-- read composes the two.
CREATE TABLE IF NOT EXISTS action_risk_proposals (
  bundle_id   TEXT NOT NULL,   -- the action
  proposed_by TEXT NOT NULL,   -- the control plane's stamp
  tier        INTEGER NOT NULL,-- 1, 2 or 3
  basis       TEXT NOT NULL,   -- what the proposer read the tier from, as written
  proposed_at TEXT NOT NULL,
  PRIMARY KEY (bundle_id, proposed_by)
);

-- R73 (K2561): A PROPOSAL OF WHAT A RECORDS REQUEST SEEKS, stored apart from the
-- action's own seeks (a member's statement, R70, R72) and labelled by who
-- proposed it. One proposer's restatement replaces that proposer's rows only.
CREATE TABLE IF NOT EXISTS action_seeks_proposals (
  bundle_id    TEXT NOT NULL,    -- the action
  proposed_by  TEXT NOT NULL,    -- the stamped proposer (any credential)
  ord          INTEGER NOT NULL, -- the item's place in the proposal
  progression  TEXT NOT NULL,
  entity       TEXT NOT NULL,
  stage        TEXT NOT NULL,
  proposed_at  TEXT NOT NULL,
  PRIMARY KEY (bundle_id, proposed_by, ord)
);

-- R80 (T45; S1 §C 9): RECEIPT OR SERVICE OF A SENT ENTRY, a member's record that
-- the addressee received it (or a party was served), how and when, held as a
-- capture or her account. Its own table: the ledger entry is never rewritten
-- (R34). A second record of the same entry appends; the latest is read first.
CREATE TABLE IF NOT EXISTS action_receipts (
  bundle_id    TEXT NOT NULL,    -- the action
  ord          INTEGER NOT NULL, -- the sent correspondence entry
  seq          INTEGER NOT NULL, -- the record's place among that entry's, from 1
  kind         TEXT NOT NULL,    -- receipt | service
  at           TEXT NOT NULL,    -- a date or a local date-time, as stated
  how          TEXT NOT NULL,
  party        TEXT,             -- service: the party served
  artifact_sha TEXT,             -- the capture, XOR account
  account      TEXT,
  author       TEXT NOT NULL,
  recorded_at  TEXT NOT NULL,
  PRIMARY KEY (bundle_id, ord, seq)
);

-- R87 (T45; Actions D4): THE CONFIDENTIAL SCOPE, each member's statement
-- appended; the latest is the action's scope.
CREATE TABLE IF NOT EXISTS action_scopes (
  bundle_id    TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  confidential INTEGER NOT NULL, -- 1 set, 0 removed
  reason       TEXT NOT NULL,
  by           TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (bundle_id, seq)
);

-- R88 (T45; Actions D4): PROMISES THE GROUP MADE TO PEOPLE, notes on the action
-- every participant sees, appended and never edited; one may end an earlier one.
CREATE TABLE IF NOT EXISTS action_promises (
  bundle_id    TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  kind         TEXT NOT NULL,    -- of action-grammar's PROMISE_KINDS
  text         TEXT NOT NULL,
  ends         INTEGER,          -- the seq of the promise this one ends
  by           TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (bundle_id, seq)
);

-- R17 (T50; N933): THE ACTION'S OWN STAKE, each statement appended with who made it and when; the latest is the stake,
-- NULL clears it and the action then falls back to its project's. by is the member's id; a reader names her by handle.
CREATE TABLE IF NOT EXISTS action_stakes (
  bundle_id    TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  stake        TEXT,             -- 1 to 1,000 characters on one line, or NULL (cleared)
  by           TEXT NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (bundle_id, seq)
);
`;

/** R11: the tables, each keyed to the action by `bundle_id` (record-core R21, R46). */
export const ACTION_RECORDS_TABLES = Object.freeze(["action_law_proposals", "action_risk_proposals",
  "action_seeks_proposals", "action_receipts", "action_scopes", "action_promises", "action_stakes"]);

/** R15, R21: creates the tables (idempotent) and adds `action_law_proposals`' `standard`, `layer` and `ambiguous` columns where a table created before
 *  it had the column lacks it (`actions`' `migrate()` did the same), so a running store's rows are kept. */
export function migrateActionRecords(sql) {
  const bare = ACTION_RECORDS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  /* R64, R19 (actions'; R1, R9 here): a proposed law's held standard, on a table created before it had the column. */
  const cols = [...sql.exec(`PRAGMA table_info(action_law_proposals)`)].map((r) => r.name);
  if (!cols.includes("standard")) sql.exec(`ALTER TABLE action_law_proposals ADD COLUMN standard TEXT`);
  /* R21 (T53; N1257, K5458): a proposed law's layer, and whether it was named over two layers giving it; empty (NULL) for
     rows written before, which are answered as they were. */
  if (!cols.includes("layer")) sql.exec(`ALTER TABLE action_law_proposals ADD COLUMN layer TEXT`);
  if (!cols.includes("ambiguous")) sql.exec(`ALTER TABLE action_law_proposals ADD COLUMN ambiguous INTEGER`);
}
