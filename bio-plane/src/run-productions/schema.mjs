/* run-productions' tables (requirements: `build/requirements/run-productions.md`, R2, R11, R17, R21–R24; K4, K23).
 * Moved out of the legacy `schema.mjs` at this module's extraction, with the comments that record why each is shaped
 * as it is: `suggest_refusals` (R2's memo of a refused submission, keyed by its target) and `proposed_readings` (R11's
 * productions, keyed by their bundle). T41-24 adds four (R21–R24): `proposed_connections`, `proposal_acceptances`,
 * `bearing_notes` and `run_pages_read`. Every one is declared to record-core's purge (R17). */

import { sha256HexSync, canonicalJson } from "../record-grammar/index.mjs";

export const RUN_PRODUCTIONS_SCHEMA = `
-- PL-3 / IS-4 / F10 -- THE REFUSED SUBMISSION, KEPT SO A VERBATIM RESUBMIT IS A
-- STRUCTURAL NO-OP. F10 rules that the design says how the plane REFUSES and
-- never how a run must RESPOND, so a retry loop that resends the identical
-- submission would otherwise be caught only by the budget -- and the budget is
-- the backstop, not the mechanism. This table makes the second submission
-- change nothing at all: no re-evaluation, no write, no tick.
--
-- THE KEY IS THE SUBMISSION ITSELF, BYTE FOR BYTE, AND NOT A HASH. That is
-- PL-1's own reasoning transplanted: a hand-rolled synchronous hash would put a
-- collision argument underneath a mechanism that decides whether a caller is
-- told the truth about its own submission, and the composition is bounded
-- already because the endpoint caps a version's legs.
--
-- base_sha IS PART OF THE IDENTITY, and it is what stops the key going stale
-- into a false refusal. "Verbatim resubmit" means NOTHING HAS CHANGED --
-- neither the submission nor the document it would be written into. The moment
-- the inquiry moves, the same submission is a different question and is
-- evaluated again.
--
-- SCRATCH-CLASS, in capture_sessions' and ai_runs' family and NOT record: it
-- holds no member act, nothing derived from one, and nothing a case is built
-- on. Its name deliberately carries no "version" substring -- PL-1 pinned the
-- tables carrying versions of a basis at exactly two, and this carries
-- refusals.
CREATE TABLE IF NOT EXISTS suggest_refusals (
  target      TEXT NOT NULL,      -- the inquiry the submission was aimed at
  submission  TEXT NOT NULL,      -- the canonical submission, compared BYTE FOR BYTE
  base_sha    TEXT NOT NULL,      -- the inquiry's bundle_sha when the refusal was made
  code        TEXT NOT NULL,      -- the DEC-49 wire code that was returned
  payload     TEXT NOT NULL,      -- the refusal, verbatim, so the resubmit answers identically
  first_at    TEXT NOT NULL,
  last_at     TEXT NOT NULL,
  repeats     INTEGER NOT NULL DEFAULT 0,  -- how many verbatim resubmits this refusal has absorbed
  PRIMARY KEY (target, base_sha, submission)
);
CREATE INDEX IF NOT EXISTS suggest_refusals_target ON suggest_refusals(target);

-- SK-8 / EXTRACTION-BREADTH-DESIGN.md section 4's THIRD production row, placed by
-- BIO_Assistant_and_AI_Roles_v0_1.md section 7.3: A PROPOSED READING -- entities
-- and facts the registered readers did not find, proposed by an EXTRACT run
-- inside DEC-62's run object, carrying the ai(function, version) step this
-- record designed at CPDF-10 and nothing emitted until now.
--
-- WHY IT IS NOT readings / reading_refs, AND THE REASON IS STRUCTURAL RATHER
-- THAN TIDINESS. Section 7.3 (6): an uncited machine-minted row is a PROPOSAL,
-- "never counted as extraction coverage". Those three tables ARE the extraction
-- coverage -- op=readingref, op=readingname, the recogniser and every earned
-- connection tier read them -- so a machine's proposal written there would count
-- as coverage BY CONSTRUCTION, and no label on top could undo a count that was
-- already wrong. The separation is the mechanism, not a convention somebody has
-- to remember. The corollary is the same reasoning inverted and it is in
-- extractrun.mjs's header: the ai step is NOT on a minted content row's chain,
-- because the content id is hash(capture, extent, chain) and changing it is
-- exactly how a member's later citation would stop FINDING the machine's row.
--
-- chain IS THE PROPOSAL'S OWN CHAIN: the capture's chain with one ai step
-- appended through textchain's appendStep, so rule 2 (every derivation weakens)
-- is enforced by the module that owns it and TEXT_CHAIN_STRENGTHENS is the
-- refusal a caller earns. cap is the chain's computed derivation cap and NULL
-- means UNDETERMINED and STATED -- no calibration of any propose-reading
-- function exists, so the honest step carries no letter.
--
-- earned is B or C and is COMPUTED from what the reference NAMES, never
-- offered by the caller (DEC-24 rule 3 -- a caller that offers one is refused by
-- name at the door). There is no route to A: A is what a reference the SOURCE
-- assigned is worth, and a machine that read a string out of prose did not get
-- one.
--
-- The three position columns are reading_refs' own, in IC-1's vocabulary and no
-- other, moving together exactly as they do there: a row has all three or none,
-- and NULL means THIS PROPOSAL CANNOT SAY WHERE rather than that the whole
-- document was meant.
--
-- content_id is the passage this proposal made citable, present exactly when
-- the run minted one through SK-7's door (op=contentmint's store half) -- which
-- needs a readable position, since a passage with no extent is the whole
-- document and minting that per reference would manufacture nothing useful.
-- NULL is the ordinary case and is not a failure.
--
-- DERIVED-BUT-AUTHORED, and purge treats it as instance-scoped state: a
-- per-bundle purge clears this document's proposals and a whole-store purge
-- clears them all (D-113), because a proposal that outlived the document it
-- points at would resolve to nothing.
CREATE TABLE IF NOT EXISTS proposed_readings (
  run          TEXT NOT NULL,     -- the ai_runs row this was produced inside. The bound lives there
  capture_sha  TEXT NOT NULL,     -- the text that was read
  bundle_id    TEXT NOT NULL,     -- purge, and the D-15 viewer join
  ref          TEXT NOT NULL,     -- the reference AS IT APPEARS, reading_refs' own key
  ref_kind     TEXT,              -- the source-assigned kind, when the proposal names an identifier
  ref_key      TEXT,              -- and its key. Both present is what earns B
  label        TEXT,              -- the name, when that is all the proposal has. Earns C
  fn           TEXT NOT NULL,     -- the ai step's function: EXTRACT_FUNCTIONS' key, carried in step.engine
  fn_version   TEXT NOT NULL,     -- and its version. A proposal nobody can re-run is one nobody can check
  chain        TEXT NOT NULL,     -- the capture's chain with the ai step appended, canonical JSON
  cap          TEXT,              -- the chain's derivation cap. NULL = undetermined, STATED
  earned       TEXT,              -- COMPUTED: B or C from what the reference names, or (T41, D4) the capture's own
                                  -- ceiling for a verified quote, which may be weaker or NULL (undetermined, STATED
                                  -- in why). Never A
  pos_kind     TEXT,              -- IC-1's discriminator: pdf-page | sheet-cell | slide-shape | doc-para
  pos          TEXT,              -- the per-arm fields as canonical JSON, key-ordered
  pos_ref      TEXT,              -- IC-1's REQUIRED human form, produced by the container that knows it
  content_id   TEXT,              -- the passage this made citable, when one was minted. NULL is ordinary
  proposed_by  TEXT NOT NULL,     -- the machine credential, stamped server-side. Never a caller's word
  at           TEXT NOT NULL,
  id           TEXT,              -- T41-24 (R22): the proposal's own name, 'prp:' + sha256 of (run, capture, ref)
  quote        TEXT,              -- R21: the exact words the proposal rests on, as the proposer sent them
  verified     INTEGER NOT NULL DEFAULT 0,  -- 1 when the quote passed extraction R42's byte-exact check
  figures      TEXT,              -- R42's quoteFigures over a verified quote (JSON), for the member to check
  why          TEXT,              -- the grade's sentence, composed with its letter
  step         TEXT,              -- R21: the step the run's work served (steps R9), or NULL
  PRIMARY KEY (run, capture_sha, ref)
);
-- By BUNDLE: purge's per-bundle arm and the read a member asks of a document.
-- By RUN: the run's own productions, which is what the bound is a bound ON.
CREATE INDEX IF NOT EXISTS proposed_readings_bundle ON proposed_readings(bundle_id);
CREATE INDEX IF NOT EXISTS proposed_readings_run ON proposed_readings(run);

-- T41-24 (R21; Investigation section 5, AI Roles section 3 rule 3; D2, D4) -- A PROPOSED CONNECTION: what a run
-- reading inside a held document says the passage connects to (a public body, a person in a public role, another
-- document, a question), tied to its exact quote at its place. APART FROM proposed_readings for the same reason that
-- table is apart from reading_refs: it is not a connection of the record (connections' tables are what the record
-- holds as connected) until a member takes it up (R22), so it cannot be counted as one by construction.
-- earned is COMPUTED from how the link is established (A the source's own link, B a shared identifier, C a name or
-- a date) and NULL, stated in why, when the quote is not the capture's own text; never D, never offered.
CREATE TABLE IF NOT EXISTS proposed_connections (
  id           TEXT PRIMARY KEY,  -- 'prc:' + sha256 of (run, capture, kind, target, quote, place)
  run          TEXT NOT NULL,
  capture_sha  TEXT NOT NULL,
  bundle_id    TEXT NOT NULL,     -- the document read: purge, and the viewer join
  to_kind      TEXT NOT NULL,     -- body | person | document | question
  to_id        TEXT NOT NULL,     -- an ENT- id (body, person) or a bundle id (document, question)
  role         TEXT,              -- a person's public role, as the quote shows it
  how          TEXT NOT NULL,     -- source_link | shared_identifier | name | date
  grounds      TEXT,              -- the reference, identifier, name or date the link rests on
  quote        TEXT NOT NULL,
  pos_kind     TEXT NOT NULL,
  pos          TEXT NOT NULL,
  pos_ref      TEXT,
  verified     INTEGER NOT NULL,
  figures      TEXT NOT NULL,
  earned       TEXT,
  why          TEXT NOT NULL,
  step         TEXT,
  proposed_by  TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS proposed_connections_bundle ON proposed_connections(bundle_id);
CREATE INDEX IF NOT EXISTS proposed_connections_run ON proposed_connections(run);

-- T41-24 (R22; record-grammar R52; D3) -- THE MEMBER'S ONE ACCEPTING ACT on a proposed passage or connection, one
-- per member per proposal: the form, and the meaning recorded (the proposal's own, or her words).
CREATE TABLE IF NOT EXISTS proposal_acceptances (
  proposal     TEXT NOT NULL,
  kind         TEXT NOT NULL,     -- passage | connection
  bundle_id    TEXT NOT NULL,     -- the document the proposal was read from: purge, and the viewer join
  form         TEXT NOT NULL,     -- as_proposed | edited | own_instead
  accepted_by  TEXT NOT NULL,
  at           TEXT NOT NULL,
  meaning      TEXT NOT NULL,
  meaning_of   TEXT NOT NULL,     -- 'proposal' (as proposed) or 'member' (her words)
  PRIMARY KEY (proposal, accepted_by)
);

-- T41-24 (R23; D22) -- A BEARING NOTE: what a document says about a question and what it does not, each sentence
-- kept only when tied to the capture's own words. NEVER CONTENT: it is held here, never in content's tables, has no
-- id a leg accepts, and is read only beside its source.
CREATE TABLE IF NOT EXISTS bearing_notes (
  id           TEXT PRIMARY KEY,  -- 'brn:' + sha256 of (run, capture, question, sentences)
  capture_sha  TEXT NOT NULL,
  bundle_id    TEXT NOT NULL,
  question     TEXT NOT NULL,
  run          TEXT,              -- NULL when a member drafted it interactively (run-rules R25, K2482)
  sentences    TEXT NOT NULL,     -- JSON: [{text, quote, position, figures}], the tied ones in the order given
  left_out     INTEGER NOT NULL,  -- how many sentences could not be tied
  written_by   TEXT NOT NULL,     -- the run's caller, or the member who drafted it, stamped
  at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS bearing_notes_bundle ON bearing_notes(bundle_id);
CREATE INDEX IF NOT EXISTS bearing_notes_question ON bearing_notes(question);

-- T53 (R28, R29; agent-steps R54, R56) -- EVERY SUGGESTION THIS MODULE WROTE, one row per version, keyed by the
-- question and the version's name. It holds what basis-versions' document does not: the conversations that produced
-- the candidate (produced_by, the labels as agent-model answered them, canonical JSON, NULL for a reading no AI
-- produced) and, when the call carried one, its idem (<run>:<pass>:<step>:<n>) with the answer the first call gave, so
-- a step re-run after a stop is answered that answer verbatim and writes nothing a second time. Written in the same
-- transaction as the version; never updated but for the answer it is given once the read-back is assembled.
CREATE TABLE IF NOT EXISTS suggest_writes (
  target       TEXT NOT NULL,      -- the question the version was written on
  version      TEXT NOT NULL,      -- the version's name, as the document holds it
  run          TEXT NOT NULL,
  idem         TEXT,               -- the call's idem, NULL when it carried none
  produced_by  TEXT,               -- canonical JSON of the label list, NULL when none
  answer       TEXT,               -- the first call's answer, verbatim (R28)
  at           TEXT NOT NULL,
  PRIMARY KEY (target, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS suggest_writes_idem ON suggest_writes(run, idem) WHERE idem IS NOT NULL;

-- T41-24 (R24; run-rules R26; D2) -- WHAT A RUN HAS READ: one row per page of a capture a run read, so a page is
-- charged to the 'pages' bound once and a run stopping at the bound says how far it read.
CREATE TABLE IF NOT EXISTS run_pages_read (
  run          TEXT NOT NULL,
  capture_sha  TEXT NOT NULL,
  bundle_id    TEXT NOT NULL,
  page         INTEGER NOT NULL,
  at           TEXT NOT NULL,
  PRIMARY KEY (run, capture_sha, page)
);
CREATE INDEX IF NOT EXISTS run_pages_read_bundle ON run_pages_read(bundle_id);
`;

/** The declaration to record-core's purge (its R21, R46; R17): the proposals by their bundle, the refusals by their
 *  target. */
export const RUN_PRODUCTIONS_TABLES = Object.freeze([
  "proposed_readings",
  { name: "suggest_refusals", keys: ["target"] },
  /* T41-24: each by the document it was read from; a bearing note also by its question. */
  "proposed_connections",
  "proposal_acceptances",
  { name: "bearing_notes", keys: ["bundle_id", "question"] },
  "run_pages_read",
  /* T53 (R28, R29): each written suggestion by its question. */
  { name: "suggest_writes", keys: ["target"] },
]);

const OWNED = new Set(["proposed_readings", "suggest_refusals", "proposed_connections", "proposal_acceptances",
                       "bearing_notes", "run_pages_read", "suggest_writes"]);

/** Which of the legacy declarations this module now owns (the legacy store filters them out of its own list). */
export function runProductionsOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return OWNED.has(name);
}

/** A passage proposal's name (R22): 'prp:' and the SHA-256 of its key, the run, the capture and the reference. */
export const passageProposalId = (run, captureSha, ref) =>
  `prp:${sha256HexSync(canonicalJson(["passage", String(run), String(captureSha), String(ref)]))}`;

/** The module's tables, created where absent. The statements are the schema text above, run one by one. A store whose
 *  `proposed_readings` predates T41-24 (no `id`; `earned` NOT NULL) is rebuilt once in the new shape, every row kept
 *  and named, since a NOT NULL cannot be dropped in place. */
export function migrateRunProductions(sql) {
  const cols = [...sql.exec(`PRAGMA table_info(proposed_readings)`)];
  if (cols.length && !cols.some((c) => c.name === "id")) {
    sql.exec(`ALTER TABLE proposed_readings RENAME TO proposed_readings__t40`);
    sql.exec(`DROP INDEX IF EXISTS proposed_readings_bundle`);
    sql.exec(`DROP INDEX IF EXISTS proposed_readings_run`);
  }
  const bare = RUN_PRODUCTIONS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const stmt of bare.split(";")) if (stmt.trim()) sql.exec(stmt);
  if (cols.length && !cols.some((c) => c.name === "id")) {
    const old = "run, capture_sha, bundle_id, ref, ref_kind, ref_key, label, fn, fn_version, chain, cap, earned, pos_kind, "
      + "pos, pos_ref, content_id, proposed_by, at";
    sql.exec(`INSERT INTO proposed_readings (${old}) SELECT ${old} FROM proposed_readings__t40`);
    sql.exec(`DROP TABLE proposed_readings__t40`);
  }
  for (const r of [...sql.exec(`SELECT run, capture_sha, ref FROM proposed_readings WHERE id IS NULL`)])
    sql.exec(`UPDATE proposed_readings SET id=? WHERE run=? AND capture_sha=? AND ref=?`,
             passageProposalId(r.run, r.capture_sha, r.ref), r.run, r.capture_sha, r.ref);
}
