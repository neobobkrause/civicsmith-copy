/* member-roster's tables (R21, R22, R46, R66, R67): the DDL this module owns, split by copy from `membership`'s schema
 * (T51-145; K624, K3946), and the additive columns an older store gains at boot. `Members#migrate` runs it. SQL comments are
 * `--` lines, dropped before the statements run. The project tables (participation, visibility, sight, removals) stay
 * `membership`'s. The comments cite the requirement ids `membership` held when they were written. */
export const MEMBER_SCHEMA = `
-- Members. Each member signs in with their own password, which is the credentials module's
-- (under role 'member:<member_id>'; T19, K637). invite_hash is the SHA-256 of a
-- one-time enrollment code; it is cleared the moment the member enrolls, so
-- a leaked invite cannot re-enroll an active member.
CREATE TABLE IF NOT EXISTS members (
  member_id   TEXT PRIMARY KEY,
  -- A COVER, not a name. It is the label an administrator uses to tell
  -- participants apart, and it is explicitly NOT a claim about who someone is
  -- in the world. The word matters: a field called "name" invites an
  -- administrator to type a legal name, and the cover-and-handle split exists
  -- precisely so that a roster seized or subpoenaed does not deanonymise the
  -- group. See docs/architecture/BIO_Membership_Architecture_v2.md section 3.
  cover       TEXT NOT NULL,
  -- The HANDLE the member chooses at enrolment, what the RECORD shows; unique (members_handle).
  handle      TEXT,
  role        TEXT NOT NULL DEFAULT 'member',
  status      TEXT NOT NULL DEFAULT 'invited',
  invite_hash TEXT,
  -- Capabilities, section 5: a JSON array of CAPABILITIES words; administer is never one of them.
  capabilities TEXT,
  created     TEXT NOT NULL,
  updated     TEXT NOT NULL,
  -- R58: the actor whose act caused the latest status transition; NULL reads 'not recorded', never back-filled.
  status_by   TEXT,
  status_at   TEXT,
  -- D-134: who invited the member (server-stamped); NULL reads 'not recorded'.
  invited_by  TEXT,
  -- R19 (section 3, "Pairing"): whether this member's cover-and-handle pairing is published, the member's or an
  -- administrator's per-member decision. 0 until one of them publishes it.
  pairing_published INTEGER NOT NULL DEFAULT 0,
  -- R97, R105 (DEC-133): when the invitation stops working (NULL: made before invitations expired, or none yet),
  -- the days chosen for one not yet made (a proposed administrator's, R6), when an administrator withdrew it (R98),
  -- the door it came through ('administrator', 'website', 'join link'; NULL reads 'administrator') and the name the
  -- website reported as approving (R101). Never a usable invitation: only its hash is held (invite_hash).
  invite_expires   TEXT,
  invite_days      INTEGER,
  invite_withdrawn TEXT,
  door             TEXT,
  approved_by      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS members_handle ON members(handle) WHERE handle IS NOT NULL;

-- Section 1.3, declared expertise and confirmed licenses. An EVENT LOG, not a status column, because withdrawal
-- supersedes rather than overwrites (R23). It gates nothing (R24). The v1.4 members.expertise column it
-- replaced is dropped (K57).
CREATE TABLE IF NOT EXISTS member_expertise (
  seq       INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  label     TEXT NOT NULL,
  event     TEXT NOT NULL,
  actor     TEXT NOT NULL,
  created   TEXT NOT NULL,
  -- R79: the reason an administrator gave for a withdrawal; NULL on every other entry.
  reason    TEXT
);
CREATE INDEX IF NOT EXISTS mx_member ON member_expertise(member_id, label);

-- Administrator governance, section 4.7. Every vote is a row, so the record of WHO decided and WHY survives the
-- decision; a spent proposal keeps its votes.
--   kind  'add'     an endorsement; addition needs the consensus of every existing administrator
--         'remove'  a vote to eject; removal needs a majority of ALL administrators, the target counted
CREATE TABLE IF NOT EXISTS admin_votes (
  kind      TEXT NOT NULL,
  target    TEXT NOT NULL,
  voter     TEXT NOT NULL,
  reason    TEXT,
  created   TEXT NOT NULL,
  PRIMARY KEY (kind, target, voter)
);

-- R11 (section 4.8): WHO HOLDS HOSTING ACCESS, as the group recorded it when asked. Append-only; the latest row
-- is the current answer. Exempt from purge with the members' family.
CREATE TABLE IF NOT EXISTS hosting_access (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  holders     TEXT NOT NULL,
  note        TEXT,
  recorded_by TEXT NOT NULL,
  at          TEXT NOT NULL
);

-- R99-R104 (DEC-133): THE GROUP'S TWO DOORS, the website key and the join link, as one APPEND-ONLY log: every
-- creation, change, revocation, enabling, replacement and switching off is a row with who did it and when, and none is
-- overwritten (R100, R103). A door's state is its LATEST row: live unless that row is a 'revoke' or an 'off'. The
-- secret is held only as its hash (R111), so a copy of the store opens no door. Exempt from purge with the members.
CREATE TABLE IF NOT EXISTS join_doors (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,
  door          TEXT NOT NULL CHECK (door IN ('website','join link')),
  door_id       TEXT NOT NULL,
  event         TEXT NOT NULL CHECK (event IN ('create','set','revoke','enable','replace','off')),
  secret_hash   TEXT,
  capabilities  TEXT NOT NULL,
  daily_cap     INTEGER NOT NULL,
  expires_days  INTEGER NOT NULL,
  set_by        TEXT NOT NULL,
  at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS join_doors_door ON join_doors(door, seq);

-- R109, R110 (DEC-132): THE GROUP'S OWN DESCRIPTION, optional, one WHOLE record per administrator's act, append-only;
-- the latest is the description. Exempt from purge (R111).
CREATE TABLE IF NOT EXISTS group_description (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  kinds       TEXT NOT NULL,
  other_kind  TEXT,
  focus       TEXT,
  purpose     TEXT,
  visibility  TEXT NOT NULL CHECK (visibility IN ('members','public')),
  set_by      TEXT NOT NULL,
  at          TEXT NOT NULL
);

-- (was R124's; DEC-186 (1)-(3)) EVERY CHANGE A MEMBER MADE TO THEIR OWN HANDLE, append-only: never deleted or
-- rewritten (R57). Since T46 no handle is changed (DEC-197, R129), so nothing appends a row; the rows changes made
-- before then left stand, and a handle a member held before (from_handle) stays taken for every other member (R16).
-- Exempt from purge with the members (R115).
CREATE TABLE IF NOT EXISTS handle_history (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   TEXT NOT NULL,
  from_handle TEXT NOT NULL,
  to_handle   TEXT NOT NULL,
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS handle_history_member ON handle_history(member_id, seq);
CREATE INDEX IF NOT EXISTS handle_history_from ON handle_history(from_handle);

-- R123 (K1881): THE HANDLE CHECK'S WINDOW, a two-bucket count of checks per 10-minute window, keyed by the
-- invitation's hash or the member's id (never a usable invitation). Only the current and previous windows are kept.
CREATE TABLE IF NOT EXISTS handle_check_window (
  key   TEXT NOT NULL,
  win   INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, win)
);

-- R143 (T48; N1036; DEC-218, K3146, K3189): WHEN A MEMBER LAST LOOKED AT HOME, one row per member (an active member, or
-- the founder as 'admin'), its instant replaced at each look. It holds the member and the instant and nothing else;
-- declared through record-core's declareTable with export never and sight owner, exempt from purge as members are.
CREATE TABLE IF NOT EXISTS home_looks (
  member_id TEXT PRIMARY KEY,
  at        TEXT NOT NULL
);

-- R144 (T49; N1072; Bob's K3265): THE FOUNDER'S OWN HANDLE, at most one row (id is always 1), chosen once and never
-- changed (a second set is refused HANDLE_FIXED). The founder has no members row, so her handle is held here; her member id
-- stays 'admin'. Exempt from purge as the members are (R115).
CREATE TABLE IF NOT EXISTS founder_handle (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  handle TEXT NOT NULL,
  at     TEXT NOT NULL
);

-- R107 (DEC-136 (1)): WHETHER MEMBERS ARE TOLD WHAT A COURT CAN REACH, an administrator's choice, append-only; the
-- latest row is the setting and no row means nobody has chosen (nothing preselected). Exempt from purge (R111).
CREATE TABLE IF NOT EXISTS court_notice (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  choice  TEXT NOT NULL CHECK (choice IN ('tell','dont')),
  set_by  TEXT NOT NULL,
  at      TEXT NOT NULL
);
`;

/* Columns a store written before they existed gains at boot: additive and nullable, never back-filled (D-85).
   `members.cover` was `members.name` before 2026-07-24 and is renamed first. */
export const MEMBER_ADDITIVE_COLUMNS = [
  ["members", "handle", "TEXT"],
  ["members", "capabilities", "TEXT"],
  ["members", "status_by", "TEXT"],
  ["members", "status_at", "TEXT"],
  ["members", "invited_by", "TEXT"],
  ["members", "pairing_published", "INTEGER NOT NULL DEFAULT 0"],
  ["members", "invite_expires", "TEXT"],
  ["members", "invite_days", "INTEGER"],
  ["members", "invite_withdrawn", "TEXT"],
  ["members", "door", "TEXT"],
  ["members", "approved_by", "TEXT"],
  ["member_expertise", "reason", "TEXT"],
];

/* R66, R46: the tables purge never clears (identity, governance and the group's own settings). The credential tables
   (credentials, sessions, bootstrap, signers, ai_credentials) are `credentials`', exempt by its R18. */
export const MEMBER_EXEMPT_TABLES = ["members", "member_expertise", "admin_votes", "hosting_access",
  /* R46 (T34): the doors, the group's description and the court-notice setting. */
  "join_doors", "group_description", "court_notice",
  /* R21, R13 (was R124's, T40) and R50: the handle history and the handle check's window. */
  "handle_history", "handle_check_window",
  /* R58 (T48): the members' Home marks. */
  "home_looks",
  /* R59 (T49): the founder's own handle. */
  "founder_handle"];
/* R55 (T46; K2928): the tables declared through record-core's `declareTable` (its R21) with classes of their own rather
   than its default form. `join_doors` holds each door's `secret_hash`, so it is `export: never`: no export, an
   administrator's included, carries a door's secret or its hash (R54's read is the only way its settings and history
   leave); its other classes are the ones the default form gives it (exempt from purge, R46; keyed to no bundle, so
   `sight: group`). It stays in MEMBER_EXEMPT_TABLES, the list of what purge keeps, and is left out of the default
   form's declaration. During the copy window the declaration is `membership`'s, under the name "membership". */
export const MEMBER_DECLARED_TABLES = Object.freeze([
  Object.freeze({ name: "join_doors", purge: "exempt", expunge: "none", export: "never", sight: "group", derive: "stored",
                  version_chain: false }),
  /* R143 (T48; N1036): a member's Home mark is theirs alone (`sight: owner`), never exported, and kept by purge as the
     members are (R115). */
  Object.freeze({ name: "home_looks", purge: "exempt", expunge: "none", export: "never", sight: "owner", derive: "stored",
                  version_chain: false }),
]);
