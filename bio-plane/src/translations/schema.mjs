/* translations' tables (K4; R9, R12): the DDL `instance-setup` created them by, copied unchanged (`CREATE TABLE IF NOT
 * EXISTS`), so a running store's grants, drafts and adoptions are kept as they are, with no data move
 * (`build/extraction/translations.md` §1.1). `Translations#migrate` runs it at the instance's creation. SQL comments are
 * `--` lines, dropped before the statements run. */

/* R9: the seven tables, in the order they are created. */
export const TRANSLATION_TABLES = Object.freeze(["translation_grants", "translation_drafts", "translation_adoptions",
  "translation_confirmations", "translation_undos", "translation_marks", "translation_readings"]);

/* R9 (DEC-127 (4)): the group's translation work is the group's settings' class, exempt from purge in both forms
   (record-core R21, R23, R25); none of it leaves your team's Civicsmith, so none is exported; each table is append-only,
   so each keeps every version. */
export const TRANSLATION_TABLE_DECLARATIONS = Object.freeze(TRANSLATION_TABLES.map((name) => Object.freeze({
  name, purge: "exempt", expunge: "none", sight: "group", derive: "stored", export: "never", version_chain: true })));

export const TRANSLATIONS_SCHEMA = `
-- R1-R9 (T37; N669; DEC-127, DEC-157, DEC-179): THE GROUP'S TRANSLATION OF THE INTERFACE. Every table is
-- append-only: no statement updates or deletes a row. Each name is held by value (the handle) beside the member id.
-- 'language' is the tag as jurisdictions' isLocale accepts it, in its canonical form.
-- R3: a grant or a revocation (act 'grant' or 'revoke') of a member's right to translate one language.
CREATE TABLE IF NOT EXISTS translation_grants (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  member     TEXT NOT NULL,
  member_name TEXT,
  language   TEXT NOT NULL,
  act        TEXT NOT NULL CHECK (act IN ('grant','revoke')),
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
-- R1: each word the assistant drafted, as it drafted it, labeled machine work; never the group's wording.
CREATE TABLE IF NOT EXISTS translation_drafts (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  en         TEXT NOT NULL,
  text       TEXT NOT NULL,
  label      TEXT NOT NULL,
  asked_by   TEXT NOT NULL,
  asked_name TEXT,
  at         TEXT NOT NULL
);
-- R4: each kept translation. 'act_n' numbers the word's adoptions and undos in one sequence per language and key;
-- 'prev' is the adoption it replaced (NULL: the English); 'state' is what it was kept as ('shown' or 'awaiting').
CREATE TABLE IF NOT EXISTS translation_adoptions (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  act_n      INTEGER NOT NULL,
  text       TEXT NOT NULL,
  en         TEXT NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('shown','awaiting')),
  draft      INTEGER,
  prev       INTEGER,
  replaced   TEXT,
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
-- R5: a confirmation of an awaiting adoption, beside it.
CREATE TABLE IF NOT EXISTS translation_confirmations (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  adoption   INTEGER NOT NULL,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  read_back  INTEGER,
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
-- R6: an undo, naming what it undoes (an adoption or an undo) and the adoptions it moves the word from and to.
CREATE TABLE IF NOT EXISTS translation_undos (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  act_n      INTEGER NOT NULL,
  undoes     TEXT NOT NULL CHECK (undoes IN ('adoption','undo')),
  undoes_seq INTEGER NOT NULL,
  from_adoption INTEGER,
  to_adoption   INTEGER,
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
-- R7: "this translation looks wrong", open while the word's latest act is still 'act_n'.
CREATE TABLE IF NOT EXISTS translation_marks (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  act_n      INTEGER NOT NULL,
  note       TEXT,
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
-- R1's to_english (K2216): the fact of a reading back into English, no text: the SHA-256 of the kept text it read.
CREATE TABLE IF NOT EXISTS translation_readings (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  language   TEXT NOT NULL,
  key        TEXT NOT NULL,
  text_sha256 TEXT NOT NULL,
  by_member  TEXT NOT NULL,
  by_name    TEXT,
  at         TEXT NOT NULL
);
`;
