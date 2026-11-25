/* provenance's tables (requirements: `build/requirements/provenance.md`, R41, R48). Moved out of the legacy
 * `schema.mjs` at this module's extraction (layers.md ruling 3, "each module owns its tables"; K72 (3)'s pattern):
 * the register and the acquisition receipts (`captured_locators`), with the comments that record why each is shaped
 * as it is; and the tables this module added, the declared origins (R29) and the authority decisions (R65). `register` and `captured_locators` are a
 * stated read contract (R48): later modules may join their capture digest, `bundle_id`, path, locator columns; every
 * write to them is this module's (R41). `provenance_route_marks` is `provenance-routes`' (its R12), and
 * `receipt_keys` and `signed_receipts` are `attestation`'s (its R10), each created and written by that module alone
 * under the same name (N512), so a deployed instance keeps their rows. */

export const PROVENANCE_SCHEMA = `
-- The register: the trust root. capture_sha is the only thing that proves bytes.
CREATE TABLE IF NOT EXISTS register (
  capture_sha TEXT PRIMARY KEY,
  bundle_id   TEXT NOT NULL,
  path        TEXT NOT NULL,
  encoding    TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  -- R1, R48 (T48; N1009, K3065): the instant the capture was FIRST registered, this module's clock, never moved by
  -- a re-registration under the same bundle, so a reader asking which capture was first registered reads it here.
  registered  TEXT NOT NULL,
  -- The instant of the LATEST register write, this module's clock; equal to registered after the first. NULL only
  -- for an instant: a row written before the column existed is given its registered at migration, below.
  last_registered TEXT,
  -- MK-1 / D-184 / IC-134 (MEMBER-KNOWLEDGE-DESIGN.md section 2). 1 when these
  -- bytes are a MEMBER'S OWN WORDS authored through op=testify, never a capture
  -- of something published. ONLY the testimony path writes 1, and promote's
  -- fence (C-53.8) refuses the flag on any document it did not write, so a
  -- caller cannot set it and cannot clear it. 0 is the true value for every row
  -- that existed before this column did, because no authored bundle could.
  authored    INTEGER NOT NULL DEFAULT 0,
  -- The member who authored the words, STAMPED by the plane from the session
  -- and never taken from the caller. NULL on every row that is not authored.
  author      TEXT,
  -- When the member says they OBSERVED it, which is THEIR statement. The
  -- record's own time of writing is registered above, and the two are kept
  -- apart as correspondence keeps them. NULL on every row that is not authored.
  observed_at TEXT,
  -- R72 (fix round 4b, F3; K4487): 1 on the row that gives a capture held in parts its identity under the whole's sha:
  -- the document stated 'parts' beside capture.sha256, and the promotion registered the parts' own rows as it always
  -- did. The row has no file of its own (its path is the file the document names for the whole, which the bundle does
  -- not hold); 0 on every other row, the true value for every row written before the column existed.
  whole       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS register_bundle ON register(bundle_id);

-- R74, R75 (fix round 9, G127a; K4833, K4837): THE PARTS OF A CAPTURE HELD IN PARTS. The register's key is the digest of a
-- WHOLE; a multipart capture's parts (the 8 MiB cuts the store keeps it as) are rows here, one per part, in the child
-- table of the bundle that holds the whole, and never rows of register. A part is a function of the whole's bytes, so two
-- documents (or two bundles) may share a byte-equal part and name its digest in rows of their own: part_sha is no key
-- and no home, and a promotion writes, replaces or removes only its own bundle's rows.
CREATE TABLE IF NOT EXISTS register_parts (
  bundle_id TEXT    NOT NULL, -- the bundle that holds the whole
  whole_sha TEXT    NOT NULL, -- the register row of the whole this is a part of
  idx       INTEGER NOT NULL, -- the part's place in order, from 0
  part_sha  TEXT    NOT NULL, -- the part's digest: never a register.capture_sha, unless it is also a whole's
  bytes     INTEGER NOT NULL,
  path      TEXT    NOT NULL, -- the file the bundle holds the part as (snapshots/<name>.partNNN)
  PRIMARY KEY (bundle_id, whole_sha, idx)
);
CREATE INDEX IF NOT EXISTS register_parts_whole ON register_parts(whole_sha);
CREATE INDEX IF NOT EXISTS register_parts_part ON register_parts(part_sha);

-- Which ADDRESSES the record has captured, and when. The register is keyed by
-- capture hash and carries no locator, so nothing could answer "does the store
-- hold a capture of https://..." without this. One row per (address, capture),
-- because the point is precisely that an address is captured repeatedly over
-- time and the versions are what a contemporaneity verdict compares.
-- One row per (address, DISTINCT BYTES), carrying the INTERVAL over which those
-- bytes were seen served rather than a single date. That interval is the whole
-- point: identical bytes observed on both sides of another document's retrieval
-- prove the target did not change across it, which settles contemporaneity
-- outright and needs no timestamp from the source that anyone has to trust. A
-- first draft keyed rows by (address, sha) and kept only the earliest date,
-- which threw away exactly the evidence the verdict is built on.
-- D-96: via names the SOURCE of an observation, because once an alternative
-- source counts as a re-fetch for monitoring (RULED, AUTHORITY-AND-TRUST.md),
-- archive bytes and live bytes must never be compared as one observation
-- stream. Two sources agreeing is STRONGER evidence than one source repeating;
-- two sources disagreeing is not evidence of change at all. The bracket arm
-- cannot tell those apart without knowing which is which, so via is part of
-- the KEY: an archive observation of the same bytes is a different fact from a
-- direct one, not a repeat of it.
--
-- The address columns carry the DOCUMENT ADDRESS, the address the record
-- reasons about; retrieval_locator carries what was actually fetched. For an
-- archive capture the document address is the CDX original field through our own
-- normaliser and the retrieval locator is the archive's replay address, and
-- conflating them is how a provenance difference gets reported as a change.
--
-- CORRECTED 2026-09-14 BY CAP-8, AND THE OLD SENTENCE IS SAID RATHER THAN
-- DELETED. This read "For a direct capture they are the same string", and that
-- was true of every capture the plane could make until Bob ruled that a link to
-- a Google Drive file KEEPS THE LINK while the harvest is the OpenDocument
-- export. A Drive capture is via 'direct' -- we asked Google and Google answered
-- us, with nobody in between -- and its two addresses differ anyway: the address
-- columns hold the Drive link the source page carried, and retrieval_locator
-- holds the export address the plane composed from the file id and the kind.
-- So via no longer tells a reader whether the two are equal, and a reader that
-- wants the document address must read it here rather than infer it. IC-85.
CREATE TABLE IF NOT EXISTS captured_locators (
  address_norm      TEXT NOT NULL,
  address           TEXT NOT NULL,
  capture_sha       TEXT NOT NULL,
  via               TEXT NOT NULL DEFAULT 'direct',
  retrieval_locator TEXT,
  first_retrieved   TEXT NOT NULL,
  last_retrieved    TEXT NOT NULL,
  observations      INTEGER NOT NULL DEFAULT 1,
  -- R61 (N714; K2087): the address's web reputation as acquisition R44 recorded it for this fetch, the object
  -- exactly as given ({tool, listed, categories, checked_at, unanswered?}), as JSON; NULL when none was given. It
  -- changes no other field, grade or chain. Not part of R48's read contract: R16 and R60 answer it.
  reputation        TEXT,
  -- R63 (K2449): on a receipt of route 'upload' only, each sighting's uploading member and her statement of where the
  -- file came from, as a JSON array [{by, statement, at}], one entry per upload in the order written, so a second
  -- sighting by another member keeps her own statement; NULL on every other receipt. Not part of R48's read contract:
  -- R16 and R60 answer it.
  uploads           TEXT,
  PRIMARY KEY (address_norm, capture_sha, via)
);
CREATE INDEX IF NOT EXISTS captured_locators_addr ON captured_locators(address_norm, first_retrieved);
-- CAP-13: the page count in siteAssets and siteChrome joins on capture_sha.
CREATE INDEX IF NOT EXISTS captured_locators_sha ON captured_locators(capture_sha);
-- N730 (K1993 (4)): capture-requests R49 asks a retrieval locator after its indexed reads miss; this keeps it a seek.
CREATE INDEX IF NOT EXISTS captured_locators_locator ON captured_locators(retrieval_locator);

-- REC-225 (Content Framework v0.10 section 8.3; R29, R30): A MEMBER'S DECLARATION OF THE SYSTEM A
-- DOCUMENT CAME FROM. A host serves many offices, so a host is not an origin: the office a document
-- came from is a member's attributed statement, per document, dated, append-only; the row with the
-- highest seq for a bundle is the standing declaration, and the ones before it stay readable.
CREATE TABLE IF NOT EXISTS origin_declarations (
  bundle_id TEXT    NOT NULL,
  seq       INTEGER NOT NULL, -- MAX+1 per bundle. The highest is the standing declaration
  system    TEXT    NOT NULL, -- the system the member says the document came from
  by        TEXT    NOT NULL, -- the member who declared it. Never a machine
  at        TEXT    NOT NULL, -- this module's clock at the declaration
  PRIMARY KEY (bundle_id, seq)
);

-- K4169 (C62; R65, R66): A MEMBER'S DECISION ON A CAPTURED DOCUMENT'S CONTENT AUTHORITY (who issued it), per document,
-- dated, append-only; the row with the highest seq for a (bundle, capture) is the standing decision and the ones before it
-- stay readable. The register's own acquisition-time value is the first entry of the history but is not stored here: it is
-- read from the bundle's data/provenance.json. A machine never writes one (R67).
CREATE TABLE IF NOT EXISTS authority_decisions (
  bundle_id   TEXT    NOT NULL,
  capture_sha TEXT    NOT NULL,
  seq         INTEGER NOT NULL, -- MAX+1 per (bundle, capture). The highest is the standing decision
  outcome     TEXT    NOT NULL, -- determined | undetermined_after_review
  authority   TEXT,             -- the issuing party, NULL for undetermined_after_review (no issuer is invented)
  basis       TEXT    NOT NULL, -- how the member knows, or what they tried
  by          TEXT    NOT NULL, -- the deciding member. Never a machine
  at          TEXT    NOT NULL, -- this module's clock at the decision
  PRIMARY KEY (bundle_id, capture_sha, seq)
);
`;

/* The columns added after stores were first written. The register's (MK-1 / D-184 / IC-134): the default IS the true
   value for every row that can exist before the column did, since no route could author a bundle until
   op=testify existed; `author` and `observed_at` are NULL on every row that is not authored. A receipt's
   `reputation` (R61): NULL on every receipt written before acquisition asked one, which is the truth about it. A
   receipt's `uploads` (R63): NULL on every receipt written before the upload route existed, none of which is one.
   The register's `last_registered` (R1, R48; T48): a row written before it existed keeps the `registered` it holds
   and takes that as its `last_registered` (`backfillLastRegistered`), the one instant the row knows it was written. */
export const REGISTER_ADDITIVE = [
  ["register", "authored", "INTEGER NOT NULL DEFAULT 0"],
  ["register", "author", "TEXT"],
  ["register", "observed_at", "TEXT"],
  ["captured_locators", "reputation", "TEXT"],
  ["captured_locators", "uploads", "TEXT"],
  ["register", "last_registered", "TEXT"],
  ["register", "whole", "INTEGER NOT NULL DEFAULT 0"],
];

/* Creates this module's tables on `sql` (the Durable Object's storage). Idempotent, run at every boot.
   `captured_locators` gained `via` (D-96) when observation SOURCE became part of the key: an archive observation
   of the same bytes at the same address is a different fact from a direct one, and rows keyed without via had
   already merged them. It was derived then (re-derivable from the captures and the provenance documents, holding
   nothing a member wrote), so a table without the column is dropped and rebuilt rather than altered. Only such a
   table, written before `via` existed, is ever dropped; an upload's statements (R63) live only in tables that have it. */
export function migrateProvenance(sql) {
  const cols = (t) => [...sql.exec(`PRAGMA table_info(${t})`)].map((r) => r.name);
  const cl = cols("captured_locators");
  if (cl.length && !cl.includes("via")) sql.exec(`DROP TABLE captured_locators`);
  for (const [t, c, decl] of REGISTER_ADDITIVE) {
    const have = cols(t);
    if (have.length && !have.includes(c)) sql.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${decl}`);
  }
  const bare = PROVENANCE_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const s of bare.split(";")) { const t = s.trim(); if (t) sql.exec(t); }
  respellReceiptInstants(sql);
  backfillLastRegistered(sql);
}

/* R1 (T48; N1009, K3065): a register row written before `last_registered` existed takes its `registered` as its
   `last_registered`; nothing else about it moves. Idempotent: only a row with none is touched, and every write since
   the column existed states one. */
function backfillLastRegistered(sql) {
  sql.exec(`UPDATE register SET last_registered = registered WHERE last_registered IS NULL`);
}

/* R48 (N133): `first_retrieved` and `last_retrieved` are spelled whole-second UTC, `YYYY-MM-DDTHH:MM:SSZ`, on every
   row, so a later module compares them as text. Receipts written before the spelling was stated may carry a fraction
   of a second (or another readable ISO spelling); each is re-spelled to its whole second, the fraction dropped, and
   nothing else about the row moves. A stored value that names no instant is left as it is: it is not this module's
   to invent one. Idempotent: a row already spelled whole-second (its value is its own whole-second spelling) is not
   touched. No LIKE or GLOB pattern: workerd refuses one longer than 50 bytes, and this runs at every boot. */
const WHOLE_SECOND = "strftime('%Y-%m-%dT%H:%M:%SZ', ?)";
function respellReceiptInstants(sql) {
  for (const col of ["first_retrieved", "last_retrieved"]) {
    const spelled = WHOLE_SECOND.replace("?", col);
    sql.exec(`UPDATE captured_locators SET ${col} = ${spelled} WHERE ${spelled} IS NOT NULL AND ${spelled} <> ${col}`);
  }
}
