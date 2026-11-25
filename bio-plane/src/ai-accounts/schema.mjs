/* ai-accounts' tables (R28): the DDL this module owns, copied whole from `credentials/schema.mjs` at the split (T48-10;
 * N996, K624, K3101; split map §2), with the table names and columns unchanged so a running store keeps its rows, and
 * the additive columns an older store gains at boot. `AiAccounts#migrate` runs it. SQL comments are `--` lines,
 * dropped before the statements run. */
/** @type {string} the tables and indexes, each created if absent, as `;`-separated statements */
export const AI_ACCOUNTS_SCHEMA = `
-- R1-R4 (T33-20; K1502): each member's own Claude account reference, one row per member, held only by that
-- member's own act. THE SECRET IS STORED ONLY SEALED (R2): 'sealed' is AES-256-GCM ciphertext under a key derived
-- (HKDF-SHA-256) from the Worker's seal secret with the member id as salt, so the key is never stored beside the row
-- and no other member's act reaches it; 'iv' is its nonce. No digest of the secret is kept. 'suggestions' and
-- 'standing' are the member's own switches (R4), off by default; removing the row turns both off. 'member_id' is a
-- member's id and nothing else: the group's key is its own table (R5). Never exported (R28).
CREATE TABLE IF NOT EXISTS account_references (
  member_id   TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  sealed      TEXT NOT NULL,
  iv          TEXT NOT NULL,
  set_at      TEXT NOT NULL,
  suggestions INTEGER NOT NULL DEFAULT 0,
  standing    INTEGER NOT NULL DEFAULT 0,
  -- R14 (T40): the reference's switch for each other kind of use (on by default; explore 'no', 'ask' or 'yes')
  use_ask     INTEGER NOT NULL DEFAULT 1,
  use_draft   INTEGER NOT NULL DEFAULT 1,
  use_run     INTEGER NOT NULL DEFAULT 1,
  explore     TEXT NOT NULL DEFAULT 'no',
  -- R14 (T41; D2, D19, D21, D56): the four kinds T41 adds, on by default as ask, draft and run
  use_enquire    INTEGER NOT NULL DEFAULT 1,
  use_read       INTEGER NOT NULL DEFAULT 1,
  use_transcribe INTEGER NOT NULL DEFAULT 1,
  use_account    INTEGER NOT NULL DEFAULT 1
);

-- R5, R6, R9 (K1755, K1757): the group's one Anthropic API key, one row (id=1), set, switched and removed only by
-- an active administrator. Sealed as a reference is (R2), under the copy rather than a member: 'sealed' is AES-256-GCM
-- ciphertext under a key derived from the Worker's seal secret with 'group-key:anthropic' as salt; no digest is kept.
-- 'is_on' is off when the key is first set and off by default; 'suggestions' and 'standing' are the group key's own
-- switches (R9), off by default, both turned off when the key is removed. 'set_by' and 'set_at' name the act that set
-- the key held now. Never exported (R28, R6).
CREATE TABLE IF NOT EXISTS group_key (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  sealed      TEXT,
  iv          TEXT,
  is_on       INTEGER NOT NULL DEFAULT 0,
  set_by      TEXT,
  set_at      TEXT,
  suggestions INTEGER NOT NULL DEFAULT 0,
  standing    INTEGER NOT NULL DEFAULT 0,
  -- R14 (T40): the group key's switch for each other kind of use (on by default; explore 'no', 'ask' or 'yes'); all
  -- off once the key is removed (R9)
  use_ask     INTEGER NOT NULL DEFAULT 1,
  use_draft   INTEGER NOT NULL DEFAULT 1,
  use_run     INTEGER NOT NULL DEFAULT 1,
  explore     TEXT NOT NULL DEFAULT 'no',
  -- R14 (T41; D2, D19, D21, D56): the four kinds T41 adds, on by default as ask, draft and run
  use_enquire    INTEGER NOT NULL DEFAULT 1,
  use_read       INTEGER NOT NULL DEFAULT 1,
  use_transcribe INTEGER NOT NULL DEFAULT 1,
  use_account    INTEGER NOT NULL DEFAULT 1
);

-- R5: each act on the group key, recorded with its administrator and instant, never the key: 'act' is 'set',
-- 'remove', 'switch' (detail 'on' or 'off') or 'switch:<name>' (R9; detail 'on' or 'off'). Never exported.
CREATE TABLE IF NOT EXISTS group_key_acts (
  seq    INTEGER PRIMARY KEY AUTOINCREMENT,
  act    TEXT NOT NULL,
  detail TEXT,
  actor  TEXT NOT NULL,
  at     TEXT NOT NULL
);

-- R8: the members who have read the group key's notice, each by their own act, with its instant. Seen by its member
-- alone; never exported.
CREATE TABLE IF NOT EXISTS group_key_notices (
  member_id TEXT PRIMARY KEY,
  seen_at   TEXT NOT NULL
);

-- R20, R21 (DEC-172; K1957): the group's setting that keeps its material away from every assistant. Each set is
-- appended, never replacing an earlier one: 'is_on', the administrator's 'reason' in their own words (NULL when none
-- was given), who set it ('set_by', the administrator's id) and when. The latest row is the setting; with none it is
-- off. Read by every active member (R21); never a secret, so exported to administrators only, as 'bootstrap' is.
CREATE TABLE IF NOT EXISTS ai_keep_away (
  seq    INTEGER PRIMARY KEY AUTOINCREMENT,
  is_on  INTEGER NOT NULL,
  reason TEXT,
  set_by TEXT NOT NULL,
  set_at TEXT NOT NULL,
  -- R22 (T40): the JSON list of USE_KINDS the limit covers; NULL for every use
  uses   TEXT
);

-- R18 (DEC-156; K1819): that a member is connected through their own Claude subscription, and since when. Seen by its
-- member alone. (T47; R19, K3060 D10, K3061 D10, replacing K1819's "never holds a token") 'sealed' and 'iv' hold the
-- sign-in's token, sealed as a reference is (R2) under 'member:<id>', kind 'signin'; no digest is kept. A row with no
-- token (every connection made before T47) answers not connected. 'valid_until' is the instant the binary stated the
-- token lasts to, NULL when it stated none; 'refused_at' the instant Anthropic refused it (the token then dropped).
CREATE TABLE IF NOT EXISTS subscription_connections (
  member_id TEXT PRIMARY KEY,
  since     TEXT NOT NULL,
  -- R14 (T40; N812): the sign-in's own switch for each kind of use, as an account's (use_ask, use_draft, use_run on and
  -- standing, suggestions off by default; explore 'no', 'ask' or 'yes'). Cleared with the row.
  use_ask     INTEGER NOT NULL DEFAULT 1,
  use_draft   INTEGER NOT NULL DEFAULT 1,
  use_run     INTEGER NOT NULL DEFAULT 1,
  standing    INTEGER NOT NULL DEFAULT 0,
  suggestions INTEGER NOT NULL DEFAULT 0,
  explore     TEXT NOT NULL DEFAULT 'no',
  -- R14 (T41; D2, D19, D21, D56): the four kinds T41 adds, on by default as ask, draft and run
  use_enquire    INTEGER NOT NULL DEFAULT 1,
  use_read       INTEGER NOT NULL DEFAULT 1,
  use_transcribe INTEGER NOT NULL DEFAULT 1,
  use_account    INTEGER NOT NULL DEFAULT 1,
  sealed         TEXT,
  iv             TEXT,
  valid_until    TEXT,
  refused_at     TEXT
);

-- R10 (T40; N812, D34, K2353): a project's one AI account, set by one of its owners: an Anthropic API key ('apikey',
-- sealed as the group key is, under 'project:<id>'; no digest) or the acting owner's own sign-in ('signin', holding
-- only 'member_id', no secret), serving only while that member is the project's only participant. Off when first
-- set ('is_on'); R14's switches as an account's. 'set_by' and 'set_at' name the act that set it. Never exported, and
-- deleted with its project (R28: cleared by a purge of the project, keyed by 'project_id'); a sign-in account is
-- cleared when its member's sign-in is (R18, R27).
CREATE TABLE IF NOT EXISTS project_accounts (
  project_id  TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  sealed      TEXT,
  iv          TEXT,
  member_id   TEXT,
  is_on       INTEGER NOT NULL DEFAULT 0,
  set_by      TEXT NOT NULL,
  set_at      TEXT NOT NULL,
  use_ask     INTEGER NOT NULL DEFAULT 1,
  use_draft   INTEGER NOT NULL DEFAULT 1,
  use_run     INTEGER NOT NULL DEFAULT 1,
  standing    INTEGER NOT NULL DEFAULT 0,
  suggestions INTEGER NOT NULL DEFAULT 0,
  explore     TEXT NOT NULL DEFAULT 'no',
  -- R14 (T41; D2, D19, D21, D56): the four kinds T41 adds, on by default as ask, draft and run
  use_enquire    INTEGER NOT NULL DEFAULT 1,
  use_read       INTEGER NOT NULL DEFAULT 1,
  use_transcribe INTEGER NOT NULL DEFAULT 1,
  use_account    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS project_accounts_member ON project_accounts(member_id);

-- R10: each act on a project's account, with its owner and instant, never the key: 'act' is 'setkey', 'setsignin',
-- 'remove', 'switch' (detail 'on' or 'off') or 'uses:<switch>' (R14; detail its value). Deleted with its project.
CREATE TABLE IF NOT EXISTS project_account_acts (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  act        TEXT NOT NULL,
  detail     TEXT,
  actor      TEXT NOT NULL,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_account_acts_project ON project_account_acts(project_id, seq);

-- R12 (D311, K1478 (i)): the members who have read a project key's notice, each by their own act, per project.
-- Deleted with its project.
CREATE TABLE IF NOT EXISTS project_key_notices (
  member_id  TEXT NOT NULL,
  project_id TEXT NOT NULL,
  seen_at    TEXT NOT NULL,
  PRIMARY KEY (member_id, project_id)
);

-- R22 (D38 C; B3): a project's material limits, appended as R20's are, the latest the setting: 'uses' the JSON list
-- of USE_KINDS it covers, NULL for all. Deleted with its project.
CREATE TABLE IF NOT EXISTS project_keep_away (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  is_on      INTEGER NOT NULL,
  uses       TEXT,
  reason     TEXT,
  set_by     TEXT NOT NULL,
  set_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_keep_away_project ON project_keep_away(project_id, seq);

-- R16 (T41; DEC-188 (1)): every change to an account's settings, in the order made, with who made it and when, never
-- the key or a digest of it. 'owner' is spelled as R14's ('group', 'project:<id>', 'member:<id>'); 'project_id' the
-- project's id for a project's account, else NULL, so a project's rows are deleted with it and no other's are (R28).
-- 'change' is 'key_set' (a key or a reference set or replaced), 'signin_set' (a sign-in made the account, or connected,
-- R18), 'switched' (the account on or off), 'removed' (a key, reference or sign-in removed or disconnected), 'use_set'
-- (one R14 switch) or 'limit_set' (a material limit, R20, R22); 'detail' is a JSON object of what it set. 'origin'
-- names the earlier record a row was carried from (R5's 'group_key_acts', R10's 'project_account_acts', R20's
-- 'ai_keep_away' and R22's 'project_keep_away', each '<table>:<seq>'), or the record written beside it in the same act,
-- so a record is never carried twice; NULL for a change recorded here alone. Never exported.
CREATE TABLE IF NOT EXISTS account_changes (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  owner      TEXT NOT NULL,
  project_id TEXT,
  at         TEXT NOT NULL,
  by         TEXT,
  change     TEXT NOT NULL,
  detail     TEXT,
  origin     TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS account_changes_owner ON account_changes(owner, seq);
CREATE INDEX IF NOT EXISTS account_changes_project ON account_changes(project_id);
`;

/* Columns a store written before they existed gains at boot: additive and nullable, never back-filled (D-85). */
/** @type {Array<[string, string, string]>} each `[table, column, declaration]` an older store gains at boot */
export const AI_ACCOUNTS_ADDITIVE_COLUMNS = [
  /* R19 (T47): a sign-in's held token, sealed, and what is known of its life */
  ["subscription_connections", "sealed", "TEXT"],
  ["subscription_connections", "iv", "TEXT"],
  ["subscription_connections", "valid_until", "TEXT"],
  ["subscription_connections", "refused_at", "TEXT"],
  /* R14 (T40; N812): every account's switch for each kind of use. The defaults keep today's behaviour (ask, draft and
     run on; explore 'no'); `standing` and `suggestions` keep their stored values (R4, R9). */
  ["account_references", "use_ask", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "use_draft", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "use_run", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "explore", "TEXT NOT NULL DEFAULT 'no'"],
  ["group_key", "use_ask", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_draft", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_run", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "explore", "TEXT NOT NULL DEFAULT 'no'"],
  ["subscription_connections", "use_ask", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_draft", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_run", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "standing", "INTEGER NOT NULL DEFAULT 0"],
  ["subscription_connections", "suggestions", "INTEGER NOT NULL DEFAULT 0"],
  ["subscription_connections", "explore", "TEXT NOT NULL DEFAULT 'no'"],
  /* R22: the uses a group's material limit covers (JSON), NULL for every use, as a limit set before T40 */
  ["ai_keep_away", "uses", "TEXT"],
  /* R14 (T41; D2, D19, D21, D56): the four kinds T41 adds, on by default, so an account held before T41 reads them at
     their defaults (R14) */
  ["account_references", "use_enquire", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "use_read", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "use_transcribe", "INTEGER NOT NULL DEFAULT 1"],
  ["account_references", "use_account", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_enquire", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_read", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_transcribe", "INTEGER NOT NULL DEFAULT 1"],
  ["group_key", "use_account", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_enquire", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_read", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_transcribe", "INTEGER NOT NULL DEFAULT 1"],
  ["subscription_connections", "use_account", "INTEGER NOT NULL DEFAULT 1"],
  ["project_accounts", "use_enquire", "INTEGER NOT NULL DEFAULT 1"],
  ["project_accounts", "use_read", "INTEGER NOT NULL DEFAULT 1"],
  ["project_accounts", "use_transcribe", "INTEGER NOT NULL DEFAULT 1"],
  ["project_accounts", "use_account", "INTEGER NOT NULL DEFAULT 1"],
];

/* R28, R29 (plan T33, Rules (6)): each table's classes for record-core's `declareTable` (its R21), declared explicitly,
   as credentials declared them before the split. The group's and members' tables are purge-exempt (R29) and never
   expunged. Account references, the group key with its acts and its notices, and a member's connected subscription
   are never exported; account references, a member's notice and a member's subscription are seen by their owner
   alone. The group key's tables are `sight: "group"`: record-core's R21 offers no administrator sight, and no read
   answers the key whatever its sight; `groupKeyState` answers its state to administrators alone (R6; K1760). The
   keep-away setting (R20, R21) is the group's, read by every member, and exported to administrators only. */
/**
 * @typedef {Object} TableDeclaration one table's classes for record-core's `declareTable` (its R21; R28)
 * @property {string} name
 * @property {readonly string[]} [keys] the columns that key a row to its project's bundle
 * @property {string} [whole] the rows the whole-store purge clears
 * @property {string} purge
 * @property {string} expunge
 * @property {string} derive
 * @property {boolean} version_chain
 * @property {string} export
 * @property {string} sight
 */
const CLASSES = { purge: "exempt", expunge: "none", derive: "stored", version_chain: false };
/** @type {readonly Readonly<TableDeclaration>[]} R28, R29: the group's and members' tables, exempt from purge */
export const AI_ACCOUNTS_TABLES = Object.freeze([
  ["account_references", "never", "owner"], ["group_key", "never", "group"], ["group_key_acts", "never", "group"],
  ["group_key_notices", "never", "owner"], ["subscription_connections", "never", "owner"],
  ["ai_keep_away", "admin-only", "group"],
].map(([name, exp, sight]) => Object.freeze({ name, ...CLASSES, export: exp, sight })));

/* R28, R16 (T41): the change history of every account, one table keyed by `owner` (the requirements' T41
   suggestion): exempt from purge for the group's and members' accounts, a project's rows deleted with their project
   (`purge: "clear"` keyed by `project_id`, and the whole-store purge clearing only rows that name a project, `whole`).
   Never exported; read only through R16's service, to the account's owners. */
/** @type {Readonly<TableDeclaration & {keys: readonly string[], whole: string}>} R16, R28: every account's change history, `account_changes` */
export const AI_ACCOUNTS_HISTORY_TABLE = Object.freeze({ name: "account_changes", keys: Object.freeze(["project_id"]),
  whole: "project_id IS NOT NULL", purge: "clear", expunge: "none", derive: "stored", version_chain: false,
  export: "never", sight: "group" });

/* R28 (T40; N812): the tables of a project's account, its notices and its material limits, declared the same way
   except that each is deleted with its project: `purge: "clear"` keyed to the project's bundle by `project_id` (record-
   core R46), so a purge of the project, or the whole-store purge that removes every project, deletes them and nothing
   else does (K2404's reading (3)). Never exported, read only through R10's and R22's services; the material limits
   exported to administrators only, as R20's. */
/** @type {readonly Readonly<TableDeclaration & {keys: readonly string[]}>[]} R28: a project's account, notices and limits, cleared with the project */
export const AI_ACCOUNTS_PROJECT_TABLES = Object.freeze([
  ["project_accounts", "never"], ["project_account_acts", "never"], ["project_key_notices", "never"],
  ["project_keep_away", "admin-only"],
].map(([name, exp]) => Object.freeze({ name, keys: Object.freeze(["project_id"]), ...CLASSES, purge: "clear", export: exp,
  sight: "group" })));
