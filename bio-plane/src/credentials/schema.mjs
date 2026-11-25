/* credentials' tables (R18): the DDL this module owns, copied from `membership/schema.mjs` at the split (K617, K637),
 * and the additive columns an older store gains at boot. `Credentials#migrate` runs it. SQL comments are `--` lines,
 * dropped before the statements run. */
export const CREDENTIALS_SCHEMA = `
-- Credentials live here rather than in Worker secrets, because a Worker cannot
-- rewrite its own secret. ADMIN_TOKEN is a bootstrap credential used once; the
-- real password is chosen by the operator and only its hash is stored. Losing
-- it is recoverable by overwriting ADMIN_TOKEN in the dashboard, which returns
-- the instance to an unclaimed state. A member's password is stored under the
-- role 'member:<member_id>'.
CREATE TABLE IF NOT EXISTS credentials (
  role       TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  hash       TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  updated    TEXT NOT NULL
);

-- Sessions are DO-backed so a password login can be exchanged for a bearer
-- token without the password travelling on every later request.
-- R40 (F13): a session is held only as the SHA-256 of its token, 'token_sha';
-- the token itself is answered once, by login, and stored nowhere. A store
-- whose sessions were held as tokens is carried over as their digests at boot
-- (Credentials#migrate), so they stay live and no token stays stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_sha    TEXT PRIMARY KEY,
  role         TEXT NOT NULL,
  expires      INTEGER NOT NULL,
  created      TEXT NOT NULL,
  device       TEXT,
  last_active  INTEGER,
  reauth_until INTEGER
);
-- R65 (T47; K3061 D3): 'device' is 'own' or 'shared' (NULL, a session made before the column, reads 'shared');
-- 'last_active' the instant (ms) of its last request not marked background, NULL read as the boot that carried it;
-- R66: 'reauth_until' the end (ms) of the window the password asked again opens, NULL for none.
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
CREATE INDEX IF NOT EXISTS sessions_role ON sessions(role);

-- One row, id=1. Records that the bootstrap credential has been spent.
CREATE TABLE IF NOT EXISTS bootstrap (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  consumed_at TEXT,
  token_fp    TEXT
);

-- Registered signing keys, the plane's projection of the member key
-- registry. key_b64 is the bare base64 of the OpenSSH wire public key, the
-- exact bytes an SSHSIG embeds, so matching is byte equality. member_id names
-- a member of membership's roster, read through its services (R8, R11).
CREATE TABLE IF NOT EXISTS signers (
  key_b64   TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  comment   TEXT,
  status    TEXT NOT NULL DEFAULT 'active',
  added     TEXT NOT NULL,
  -- REC-159: the actor whose act last set the key's status; NULL reads 'not recorded'.
  status_by TEXT,
  -- R8 (N364, DEC-80 item 4): how the key was registered, 'admin' by an administrator (R6) or 'self' by its own
  -- member from a signed-in session (R9), and who registered it. A row written before these columns was
  -- registered by R6, the only door there was, so a NULL origin reads 'admin'; NULL registered_by reads
  -- 'not recorded'. Neither is back-filled. attests never reads origin (R19).
  origin    TEXT,
  registered_by TEXT,
  -- R21 (N505): the instant the key's status last changed: set at first registration (R6, R9) and at each act that
  -- changes it (R6's re-activation, R7, R10, R16), never by one that leaves it as it was. A row written before this
  -- column existed has NULL, read as not recorded: it may have changed status after it was registered, so 'added'
  -- would state a false instant for it. Never back-filled.
  status_at TEXT,
  -- R83 (T51 fix round 10; K5303): the administrator who said they know about this self-registered key, and when
  -- ('I know about this key'). NULL for a key no administrator has said it of, and for every earlier key. Written once,
  -- never changed, never back-filled.
  known_by  TEXT,
  known_at  TEXT
);
CREATE INDEX IF NOT EXISTS signers_member ON signers(member_id);

-- PL-11 / IS-5 / D-199: THE ai CREDENTIAL'S DECLARED TASK SCOPE, AND THE
-- WHOLE REASON IT IS A TABLE RATHER THAN A BINDING.
--
-- The four token classes -- admin, member, probe, daemon -- are ENV BINDINGS:
-- an operator sets a value in the hosting dashboard and the plane compares
-- against it, a settings row by another name, which D-199 (2) rules out for
-- this one class (DEC-17's reasoning: a settings row "would be a way to change
-- the standard with nothing to read afterwards"). A presented ai token resolves
-- HERE, against a row a member wrote: who minted it, when, for whom, and what
-- it may do. Amending the reach is another row with a name against it.
--
-- THE VALUE IS NEVER STORED. 'token_id' is the IDENTITY, a short public name
-- the record can print, an act can cite and a member can revoke; 'secret_sha'
-- is the SHA-256 of the presented value, which a lookup compares.
--
-- BOTH PRINCIPAL KINDS ARE LEGITIMATE AND CARRY DIFFERENT ACCOUNTABILITY, which
-- is why 'principal_kind' is not nullable (D-199 (4), DEC-55 det 4): an
-- ORGANISATION-scoped key acts for the group, a MEMBER-scoped key is
-- attributable to that member. 'principal' IS THE VIEWER the plane stamps on
-- this credential's reads, so who is behind it and what it may read are one
-- string.
--
-- 'scope_writes' is a JSON array of op names, arriving already judged at the
-- mint edge (the control plane's ops table is the only thing that knows which
-- ops a member reaches); the declared writes narrow that floor, never widen it.
--
-- NOT PURGED (R18): this is identity, and a whole-store purge that cleared it
-- would revoke every agent's authority as a side effect of resetting the corpus.
CREATE TABLE IF NOT EXISTS ai_credentials (
  token_id        TEXT PRIMARY KEY, -- the public IDENTITY of the credential. NEVER its value
  secret_sha      TEXT NOT NULL,    -- SHA-256 of the presented value. NEVER its value
  principal_kind  TEXT NOT NULL,    -- organisation | member. D-199 (4): an act says which
  principal       TEXT NOT NULL,    -- the stamped viewer: class:ai for an org key, member:<id> for a member key
  task_scope      TEXT NOT NULL,    -- the declared scope name, e.g. investigative
  scope_writes    TEXT NOT NULL,    -- JSON array of op names this scope may MUTATE. reads are the floor
  scope_note      TEXT NOT NULL,    -- what the authoring member said this credential is for
  minted_by       TEXT NOT NULL,    -- the MEMBER who minted it. D-199 (3): never a machine
  minted_at       TEXT NOT NULL,
  revoked_at      TEXT,
  revoked_by      TEXT,
  -- D-463: the namespace this credential is confined to for its whole life ('scratch'), or NULL for one that is
  -- not confined. It arrives already judged at the mint edge (the control plane owns the namespaces). NULLABLE AND
  -- NEVER BACK-FILLED: a credential minted before this column existed was minted unconfined, and NULL is that fact.
  confined_to     TEXT,
  -- R42 (F15): the instant the credential expires, whole days after it was minted (1 to 365, 90 by default). A
  -- credential minted before this column existed is given 90 days after the migration that adds it (K1934 (5)).
  expires_at      TEXT,
  -- R63 (T47; N955): the run a segment's credential is bound to, minted by the plane at the member's act
  -- (aiRunCredentialMint); NULL for every credential R12 mints. Never back-filled.
  run             TEXT,
  -- R79 (T50; N1186): the project a run's credential was minted in (aiRunCredentialMint's optional \`project\`), the
  -- project that fences the viewer the credential makes; NULL for a credential minted with none, and for every
  -- earlier one. Never changes after minting; never back-filled.
  project         TEXT
);
CREATE INDEX IF NOT EXISTS ai_credentials_secret ON ai_credentials(secret_sha);
CREATE INDEX IF NOT EXISTS ai_credentials_run ON ai_credentials(run);
CREATE INDEX IF NOT EXISTS ai_credentials_principal ON ai_credentials(principal_kind, principal);

-- R29 (K1449): the group's own key for one keyed outside service, set by an administrator, stored only sealed
-- (AES-256-GCM under a key derived from the Worker's seal secret, salt 'group:<service>'; through ai-accounts' R24
-- since T48, byte-identical), off by default and off while no key is held. Never exported (R30).
-- (T36; K1946 T1) 'service' is 'courtlistener' or 'security:<tool_id>', each outside security tool's credentials
-- (file-safety R28). 'form' is 'key' for one key, or 'fields' for a set of named fields held as one value (sealed as
-- its JSON, under the kind 'fields'); a row written before the column has NULL, read as 'key' (the only form there
-- was), never back-filled. A set with no key deletes the row: the key is gone and the service off (file-safety R30).
CREATE TABLE IF NOT EXISTS keyed_services (
  service TEXT PRIMARY KEY,
  sealed  TEXT,
  iv      TEXT,
  is_on   INTEGER NOT NULL DEFAULT 0,
  set_by  TEXT,
  set_at  TEXT,
  form    TEXT
);

-- R27 (Q1-3; K1450): the short-lived, read-only ask grant. Only the SHA-256 of the token is kept, with its member,
-- the session it was minted under (the grant ends with it; R40: the session's digest, never its token) and its expiry. It is no run row, no observation row and
-- no read log. Never exported (R30).
-- R32 (N580; K1481, K1609): a standing question's grant is held here too, 'kind' 'standing' and 'session' empty: the
-- scheduler acts with no session, so it ends at its time, or at once when its member is revoked (R16) or removes
-- their reference (ai-accounts R1, told through R73). An ask's grant is 'kind' 'ask'; a row written before the column existed has NULL, read as
-- an ask's (the only kind there was), never back-filled.
CREATE TABLE IF NOT EXISTS ai_grants (
  grant_sha TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  session   TEXT NOT NULL,
  expires   INTEGER NOT NULL,
  kind      TEXT,
  -- R79 (T50; N1186): the project an ask's grant was minted in (R27's optional \`project\`), which fences the viewer it
  -- makes; NULL for a grant minted with none, a standing question's, and every earlier one. Never changes after minting.
  project   TEXT
);
CREATE INDEX IF NOT EXISTS ai_grants_member ON ai_grants(member_id);

-- R38 (F3; K1881): the sign-in window. Refused sign-ins, claims and recoveries, counted per source and per role in
-- 10-minute windows ('win' the window's number since the epoch), the current window and the one before it kept for
-- the two-bucket estimate. 'kind' is 'source' or 'role'; 'key' is a keyed digest (R44's key) of the caller's source
-- fingerprint or of the role asked, so no row names an address or a role. Never exported (R30).
CREATE TABLE IF NOT EXISTS signin_window (
  kind  TEXT NOT NULL,
  key   TEXT NOT NULL,
  win   INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (kind, key, win)
);

-- R44 (N703; DEC-165, DEC-166): the security tally. COUNTS ONLY: a kind, an hour (whole hours since the epoch, UTC)
-- and Cloudflare's two-letter country label ('' when none or not yet placed), and how many. No address,
-- fingerprint, handle, role, op, path, time within the hour or content. Counts older than 90 days are dropped.
CREATE TABLE IF NOT EXISTS security_counts (
  kind    TEXT NOT NULL,
  hour    INTEGER NOT NULL,
  country TEXT NOT NULL,
  count   INTEGER NOT NULL,
  PRIMARY KEY (kind, hour, country)
);

-- R44 (DEC-166's place rule): a refused sign-in, claim or recovery this module counts is counted at once without a
-- place; its country waits here, named only by a keyed digest of its role, until an hour has passed with no
-- successful sign-in or recovery under that role (then it is placed and the row dropped) or one follows within the
-- hour (then the row is dropped and the count is never placed). A pause (R38's 'rate') waiting here is also what
-- makes a success within the hour a 'through'.
CREATE TABLE IF NOT EXISTS security_pending (
  seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  kind    TEXT NOT NULL,
  hour    INTEGER NOT NULL,
  country TEXT,
  role    TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS security_pending_role ON security_pending(role);
CREATE INDEX IF NOT EXISTS security_pending_at ON security_pending(at);

-- R38, R44: the key the window's and the tally's digests are made under (HMAC-SHA-256), 256 random bits generated
-- once, answered by no op, never exported, exempt from purge (capture R56's pattern, a key of this module's own).
CREATE TABLE IF NOT EXISTS security_key (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  key_hex TEXT NOT NULL,
  created TEXT NOT NULL
);

-- R46 (K1888): administrators' one-time recovery codes. Only each code's SHA-256 is kept, with the role it recovers,
-- when it was issued and when it was spent (by a recovery, a new issue, or the member's revocation).
CREATE TABLE IF NOT EXISTS recovery_codes (
  code_sha  TEXT PRIMARY KEY,
  role      TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  spent_at  TEXT
);
CREATE INDEX IF NOT EXISTS recovery_codes_role ON recovery_codes(role);

-- R47: each recovery, with its role and instant; never the code.
CREATE TABLE IF NOT EXISTS recoveries (
  seq  INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  at   TEXT NOT NULL
);

-- R69 (T47; K3060 D4): an administrator's one-time password reset link for a member. Only the link's SHA-256 is kept,
-- never the link: who it is for, who made it and when, when it expires (7 days), and when it was spent (a reset) or
-- ended (a newer link, or the member's revocation). At most one is live per member. Never exported.
CREATE TABLE IF NOT EXISTS password_reset_links (
  link_sha   TEXT PRIMARY KEY,
  member_id  TEXT NOT NULL,
  made_by    TEXT NOT NULL,
  made_at    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  spent_at   TEXT,
  ended_at   TEXT
);
CREATE INDEX IF NOT EXISTS password_reset_links_member ON password_reset_links(member_id);

`;

/* Columns a store written before they existed gains at boot: additive and nullable, never back-filled (D-85). */
export const CREDENTIALS_ADDITIVE_COLUMNS = [
  ["signers", "status_by", "TEXT"],
  ["signers", "origin", "TEXT"],
  ["signers", "registered_by", "TEXT"],
  ["signers", "status_at", "TEXT"],
  /* R83 (T51): who said they know about a self-registered key, and when; NULL for every earlier key */
  ["signers", "known_by", "TEXT"],
  ["signers", "known_at", "TEXT"],
  ["ai_credentials", "confined_to", "TEXT"],
  ["ai_grants", "kind", "TEXT"],
  ["ai_credentials", "expires_at", "TEXT"],
  ["keyed_services", "form", "TEXT"],
  /* R63 (T47): the run a segment's credential is bound to; NULL for every earlier credential */
  ["ai_credentials", "run", "TEXT"],
  /* R79 (T50): the project a grant or a run's credential was minted in; NULL for every earlier one */
  ["ai_credentials", "project", "TEXT"],
  ["ai_grants", "project", "TEXT"],
  /* R65, R66 (T47): a session's device, its last activity and its re-ask window */
  ["sessions", "device", "TEXT"],
  ["sessions", "last_active", "INTEGER"],
  ["sessions", "reauth_until", "INTEGER"],
];

/* R18: every table this module owns, declared exempt from purge (identity and credentials outlive a reset corpus).
   (T48; K3101) Its own fourteen; the AI accounts' are `ai-accounts`' (its R29). */
export const CREDENTIALS_EXEMPT_TABLES = ["credentials", "sessions", "bootstrap", "signers", "ai_credentials",
  "keyed_services", "ai_grants", "signin_window", "security_counts", "security_pending", "security_key",
  "recovery_codes", "recoveries", "password_reset_links"];

/* R30 (plan T33, Rules (6)): each table's classes for record-core's `declareTable` (its R21), declared explicitly.
   Every table is purge-exempt (R18) and never expunged. Keyed-service keys, password hashes, sessions, AI credentials
   and ask grants are never exported. Signer keys are public halves the group already publishes (`groupkeyspublic`), so
   they export; the bootstrap row is an administrator's fact. T35's tables (R30) are declared the same way, never
   exported: the sign-in window, the tally with its waiting places and its key, and the recovery codes and recoveries
   are the group's (the tally's reading is administrators' alone, R45's own). (T48; K3101) Its own fourteen tables
   only: the AI accounts' eleven (account references, the group key's three, the material limits' two, connected
   subscriptions, a project's account's three and the change history) are declared by `ai-accounts` (its R28). */
const CLASSES = { purge: "exempt", expunge: "none", derive: "stored", version_chain: false };
export const CREDENTIALS_TABLES = Object.freeze([
  ["credentials", "never", "group"], ["sessions", "never", "group"], ["bootstrap", "admin-only", "group"],
  ["signers", "yes", "group"], ["ai_credentials", "never", "group"], ["keyed_services", "never", "group"],
  ["ai_grants", "never", "group"], ["signin_window", "never", "group"], ["security_counts", "never", "group"],
  ["security_pending", "never", "group"], ["security_key", "never", "group"], ["recovery_codes", "never", "group"],
  ["recoveries", "never", "group"],
  /* R69 (T47): the reset links, as the recovery codes are */
  ["password_reset_links", "never", "group"],
].map(([name, exp, sight]) => Object.freeze({ name, ...CLASSES, export: exp, sight })));
