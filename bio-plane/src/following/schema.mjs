/* following's tables (requirements: `build/requirements/following.md`; R17, record-core R21). Each is declared with its
 * classes at start (`FOLLOWING_TABLES`). A follow is a member's act and is never edited: it is ended by another act
 * (R1's `unfollow`), and the per-meeting link is a chain whose last row governs. */

export const FOLLOWING_SCHEMA = `
-- G21 (K4571): body_cursor is a followed body's read in progress (JSON; where the next tick goes on), or its finished read's count.
-- R1, R7, R9, R10, R20: ONE ROW PER FOLLOW. subject is JSON ({kind, ...}); home the bundle whose project the follow
-- lives in and its captures land in (null: group-wide); gated JSON for R8 (null: public). A policy watch (R20) has
-- author '' (none: the group's standing watch, K1727).
CREATE TABLE IF NOT EXISTS follows (
  follow_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  home        TEXT,
  author      TEXT NOT NULL,
  from_day    TEXT,
  until_day   TEXT,
  cadence     TEXT NOT NULL,
  gated       TEXT,
  at          TEXT NOT NULL,
  ended_at    TEXT,
  ended_by    TEXT,
  last_read   TEXT,
  last_outcome TEXT,
  ended_reason TEXT,
  body_cursor TEXT,
  held_until  TEXT,
  alert_state TEXT
);

-- R22: a follow's end date, set at the follow, changed by followEnd or R25's answer; appended with who and when and
-- never edited, the latest governing (ends null: none set).
CREATE TABLE IF NOT EXISTS follow_ends (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  follow_id   INTEGER NOT NULL,
  ends        TEXT,
  by          TEXT,
  at          TEXT NOT NULL
);

-- R23: one row per link of a watch to the plan that set it running, append-only (a second link of the same watch to
-- the same plan is answered with the first). watch_kind one of follow, address, duty, question; matters JSON (null:
-- all the plan's matters); home the plan's project, its sight.
CREATE TABLE IF NOT EXISTS watch_links (
  link_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  plan        TEXT NOT NULL,
  matters     TEXT,
  watch_kind  TEXT NOT NULL,
  watch_id    TEXT NOT NULL,
  home        TEXT,
  author      TEXT NOT NULL,
  at          TEXT NOT NULL,
  UNIQUE (plan, watch_kind, watch_id)
);

-- R25: the one answer to a link's once-only question; never edited.
CREATE TABLE IF NOT EXISTS watch_answers (
  link_id     INTEGER PRIMARY KEY,
  answer      TEXT NOT NULL,
  until_day   TEXT,
  cause       TEXT NOT NULL,
  author      TEXT NOT NULL,
  home        TEXT,
  at          TEXT NOT NULL
);

-- R2, R3, R7–R10: the last capture taken at each address a follow reads (a read with the same bytes lands nothing).
CREATE TABLE IF NOT EXISTS follow_reads (
  follow_id   INTEGER NOT NULL,
  address     TEXT NOT NULL,
  capture_sha TEXT NOT NULL,
  bundle_id   TEXT,
  facts       TEXT,
  at          TEXT NOT NULL,
  PRIMARY KEY (follow_id, address)
);

-- R4, R5: the per-meeting link of a watched address (K1505 (15)); a later row replaces an earlier, none is edited.
CREATE TABLE IF NOT EXISTS per_meeting_links (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  address     TEXT NOT NULL,
  bundle_id   TEXT NOT NULL,
  body        TEXT,
  notice      TEXT,
  author      TEXT NOT NULL,
  at          TEXT NOT NULL
);

-- R4, R6: each per-meeting capture taken, keyed by the meeting's start instant, with the alarm's lateness.
CREATE TABLE IF NOT EXISTS per_meeting_captures (
  address     TEXT NOT NULL,
  meeting     TEXT NOT NULL,
  bundle_id   TEXT NOT NULL,
  due_at      TEXT NOT NULL,
  taken_at    TEXT NOT NULL,
  lateness_ms INTEGER NOT NULL,
  outcome     TEXT NOT NULL,
  PRIMARY KEY (address, meeting)
);

-- R10, R11: each portal snapshot, a vintage valid at its capture instant; rows the dataset's answer as read.
CREATE TABLE IF NOT EXISTS portal_snapshots (
  follow_id   INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  capture_sha TEXT NOT NULL,
  bundle_id   TEXT,
  at          TEXT NOT NULL,
  rows        TEXT,
  why         TEXT,
  PRIMARY KEY (follow_id, seq)
);

-- R10, R17 (G46): a snapshot whose rows JSON is over PORTAL_ROWS_INLINE_MAX holds a marker in portal_snapshots.rows and its
-- text here in chunks, in order by part; written with its snapshot row in one transaction.
CREATE TABLE IF NOT EXISTS portal_snapshot_parts (
  follow_id   INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  part        INTEGER NOT NULL,
  bundle_id   TEXT,
  chunk       TEXT NOT NULL,
  PRIMARY KEY (follow_id, seq, part)
);

-- R20, R21: every version a policy watch has seen at its address, in the order seen: the policy's own text capture
-- first (seq 1, its receipt's first retrieval), then each read whose bytes differed from the one before. Never
-- edited or removed: a later version is a new row beside the earlier ones.
CREATE TABLE IF NOT EXISTS policy_versions (
  change_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  follow_id   INTEGER NOT NULL,
  seq         INTEGER NOT NULL,
  capture_sha TEXT NOT NULL,
  bundle_id   TEXT,
  at          TEXT NOT NULL,
  UNIQUE (follow_id, seq)
);

-- R32: a member's watch marks, one row per setting or taking off, never edited; the latest row of an (item, member)
-- governs. member is the setter's identity (member:<id>, or admin); bundle_id the item's bundle, null for an entity.
CREATE TABLE IF NOT EXISTS watch_marks (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  item        TEXT NOT NULL,
  bundle_id   TEXT,
  member      TEXT NOT NULL,
  on_mark     INTEGER NOT NULL,
  at          TEXT NOT NULL
);

-- R38, R43, R46 (T53): each change in what a followed number's answer says, recorded once per read pair (the capture before and
-- the capture after), with its counts when a content type's assess read it (JSON {added, changed, removed, possibly_removed}),
-- else null; basis how it was told (assess, normalised, volatility_unknown). Never a meaning. home the follow's.
CREATE TABLE IF NOT EXISTS register_query_changes (
  change_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  follow_id   INTEGER NOT NULL,
  before_sha  TEXT NOT NULL,
  after_sha   TEXT NOT NULL,
  home        TEXT,
  at          TEXT NOT NULL,
  counts      TEXT,
  basis       TEXT NOT NULL
);

-- R40 (T53): a member's last look at a register watch's changes; the latest governs (changes_since_looked counts after it).
CREATE TABLE IF NOT EXISTS register_looks (
  follow_id   INTEGER NOT NULL,
  member      TEXT NOT NULL,
  at          TEXT NOT NULL,
  PRIMARY KEY (follow_id, member)
);

-- R33: the team's second-look flags, one row per flag; a flag is cleared once, by a field of the same row, and stays.
-- raised_by and cleared_by are identities (member:<id>, or admin), answered as handles (membership), never as these.
CREATE TABLE IF NOT EXISTS second_looks (
  flag_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  item        TEXT NOT NULL,
  bundle_id   TEXT,
  raised_by   TEXT NOT NULL,
  note        TEXT NOT NULL,
  at          TEXT NOT NULL,
  cleared_by  TEXT,
  cleared_at  TEXT
);`;

const t = (name, cls) => ({ name, purge: "clear", expunge: "none", export: "admin-only", derive: "stored", version_chain: false, ...cls });

/** R17: every table with its classes. A follow is seen as its home bundle is (`bundle`), the narrowest sight of its
 *  author's project; what a tick read is seen as the capture it cites (`source`). */
export const FOLLOWING_TABLES = Object.freeze([
  t("follows", { keys: ["home"], sight: "bundle", version_chain: true }),
  t("follow_reads", { keys: ["bundle_id"], sight: "source" }),
  t("per_meeting_links", { keys: ["bundle_id"], sight: "bundle", version_chain: true }),
  t("per_meeting_captures", { keys: ["bundle_id"], sight: "bundle" }),
  t("portal_snapshots", { keys: ["bundle_id"], sight: "source" }),
  t("portal_snapshot_parts", { keys: ["bundle_id"], sight: "source" }),
  t("policy_versions", { keys: ["bundle_id"], sight: "source" }),
  t("follow_ends", { keys: [], sight: "group" }),
  t("watch_links", { keys: ["home"], sight: "bundle" }),
  t("watch_answers", { keys: ["home"], sight: "bundle" }),
  /* R32: read back only to the member who set it (the standing question's classes, `answers`): no export carries it */
  t("watch_marks", { keys: ["bundle_id"], sight: "owner", export: "never" }),
  /* R33: seen by every member who may see the item */
  t("second_looks", { keys: ["bundle_id"], sight: "bundle" }),
  /* R46: a register watch's changes are seen as its follow is, through its project (R17) */
  t("register_query_changes", { keys: ["home"], sight: "bundle" }),
  /* R40: a member's own look, read back to her alone */
  t("register_looks", { keys: [], sight: "owner", export: "never" }),
]);

export function migrateFollowing(sql) {
  const bare = FOLLOWING_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";").map((x) => x.trim()).filter(Boolean)) sql.exec(s);
  /* R14, R22: a follows table made before T45 gains its ending's reason */
  if (![...sql.exec(`PRAGMA table_info(follows)`)].some((r) => r.name === "ended_reason")) sql.exec(`ALTER TABLE follows ADD COLUMN ended_reason TEXT`);
  /* G21: a follows table made before the cursor gains it; a body read before it starts its next pass whole */
  if (![...sql.exec(`PRAGMA table_info(follows)`)].some((r) => r.name === "body_cursor")) sql.exec(`ALTER TABLE follows ADD COLUMN body_cursor TEXT`);
  /* R42 (T53): a follow held back by a keyed service's limits is next due at held_until */
  if (![...sql.exec(`PRAGMA table_info(follows)`)].some((r) => r.name === "held_until")) sql.exec(`ALTER TABLE follows ADD COLUMN held_until TEXT`);
  /* R40, R41 (T53): whether a docket's alert was served on its last read ("on") or its page read instead ("off") */
  if (![...sql.exec(`PRAGMA table_info(follows)`)].some((r) => r.name === "alert_state")) sql.exec(`ALTER TABLE follows ADD COLUMN alert_state TEXT`);
}
