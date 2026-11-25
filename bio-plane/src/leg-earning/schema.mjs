/* leg-earning's table (requirements: `build/requirements/leg-earning.md`, R12): `inquiry_basis`, the projected basis of
 * every inquiry, copied from `inquiry`'s `schema.mjs` at the split (K617, K1505 (2)) with its columns, indexes, names,
 * types and meanings unchanged, and the comments that record why it is shaped as it is. `inquiry`'s projection writes it
 * only through this module's one write (`writeBasis`). `migrateLegEarning` brings a store created under an earlier shape
 * to this one (the `ground` and `content_id` columns REC-42 and REC-82 added). */

export const LEG_EARNING_SCHEMA = `

-- REC-11 / DATA-MODEL D4: the INQUIRY BASIS -- the legs an inquiry rests on,
-- and invariant 7's storage: a leg whose role is cuts_against is a ROW, so a
-- rendering cannot quietly drop the evidence that argues the other way.
--
-- DERIVED from bundle.md's basis[] frontmatter, written whole at op=promote in
-- the SAME transaction as refs by the same delete-then-insert discipline, so it
-- is a projection of the document and never a second place to state it (D-21).
-- A separate table rather than columns on refs, and that is D4's ruling, not
-- taste: refs' PK has no ordinal, so one document could not be cited for two
-- legs, and a nullable grade on the universal edge projection would create a
-- place to put a grade on edges that must not carry one -- the category error
-- entity_relations refuses structurally above.
--
-- target_id is an INFO- bundle OR another inquiry (INQ-, or a legacy PROB-/
-- FOCUS- id) -- the self-reference IS basis recursion and needs no other
-- mechanism. The basis graph over inquiry-typed legs is a DAG, enforced at the
-- WRITE: op=promote refuses a write whose target would close a cycle, naming
-- the path (before REC-11 the record's only acyclicity protection was a side
-- effect of op=cite refusing non-information members).
--
-- grade is NULLABLE and NULL means undetermined and STATED -- never invented
-- to pass a gate. grade_axis is the axis the grade is ON (capture,
-- connection or testimony -- GRADE_AXES in record-grammar (grades.mjs) is the
-- authority, and testimony joined it with MK-2 / IC-142, a leg on a member's
-- authored bundle, graded at TESTIMONY_GRADE and no other letter), recorded
-- on the leg because it is NOT derivable from
-- target_type: a connection grade legitimately sits on an INFO- leg. One
-- column, not two grade columns, because a leg asserts ONE grade for ONE
-- reason (RECONCILED R2). grade_source is resolution (earned, REC-18's path),
-- testimony (a member's signed grade-D account), or hunch (DEC-15): an
-- authored connection grade, the ONLY authored grade permitted above D,
-- requiring an author and a date in the document, visible as a hunch from the
-- moment it is made, and HUNCH DEBT until cleared (BIO_Declared_Bias_v0_1.md).
-- D-188 / DEC-46 (d): HUNCH DEBT, not "bias debt". A hunch is the ONE kind of
-- declared bias that DISQUALIFIES publication (DEC-20); ordinary bias debt is
-- DISCLOSED and travels with the published case. Calling this "bias debt" is
-- what made Bob re-read his own ruling as a contradiction on 2026-08-04.
--
-- inquiry_basis_target is the reverse index: "which inquiries rest on this
-- document" (E2, and REC-17's re-evaluation obligation) is ONE indexed lookup.
-- Cleared in BOTH purge arms by this module's declaration (D-113); R12's test
-- (test/m/leg-earning/table.test.mjs) holds the declaration against the table
-- this schema creates.
--
-- REC-42 / DEC-32: the ground column IS THE RELATIONSHIP BETWEEN LEGS, one
-- nullable column rather than a table because a leg belongs to exactly ONE
-- ground and the leg row is already keyed (bundle_id, ord). Legs sharing a
-- ground are AND-related (the basis is no stronger than the weakest of them);
-- the grounds themselves are OR-related (the basis is as strong as its
-- STRONGEST ground). NULL IS THE IMPLICIT SINGLE GROUND and it is the DEFAULT
-- ON PURPOSE: every leg written before this column existed reads NULL, lands in
-- one ground, and derives exactly the weakest-leg answer it derived before.
-- Bob's ruling (DEC-32): "sometimes the weakest is the claim's strength, and
-- other times it's not. The difference is really whether the relationship
-- between legs is AND or OR."
--
-- THE ATTRIBUTION IS NOT PROJECTED HERE, and that is the deliberate half. A
-- ground's claim to be INDEPENDENTLY SUFFICIENT is asserted per ground, by a
-- named member, in bundle.md's grounds[] block -- one row per label carrying
-- asserted_by and at. It is per (bundle_id, ground), so a column here would
-- state it once per LEG: a second place for one fact to be written, which is
-- what D-21 forbids and what the ordinal above exists to avoid. It is not a
-- second TABLE either, because nothing asks the record a question keyed on it:
-- the assertion is enforced at BOTH gates by one catalog function
-- (checkInquiryBasis, REC-11's precedent) and frozen into the ratified bytes at
-- publication, which is where a reader checks it. If a query ever needs "which
-- grounds did this member assert", THAT is when the table is earned.
CREATE TABLE IF NOT EXISTS inquiry_basis (
  bundle_id    TEXT NOT NULL,   -- the inquiry
  ord          INTEGER NOT NULL,-- position in basis[], so a leg is addressable
  target_id    TEXT NOT NULL,   -- an INFO- or an INQ-/PROB-/FOCUS- bundle
  target_type  TEXT NOT NULL,   -- 'information' | 'inquiry', denormalised for the walk
  role         TEXT NOT NULL,   -- 'supports' | 'cuts_against'
  grade        TEXT,            -- A|B|C|D, NULL = undetermined and STATED as such
  grade_axis   TEXT,            -- 'capture' | 'connection' | 'testimony': the axis the grade is on
                                -- GRADE_AXES in record-grammar (grades.mjs) is the authority (MK-2 / IC-142)
                                -- this line named only the first two until 2026-09-23, D-423
  grade_source TEXT,            -- 'resolution' | 'testimony' | 'hunch' | 'inherited' | 'capture'
                                -- GRADE_SOURCES in record-grammar (grades.mjs) is the authority (DEC-15)
                                -- this line named only the first three until 2026-08-08, REC-68
                                -- the last two arrived with REC-31/DEC-21 and were never added here
  note         TEXT,
  at           TEXT,
  ground       TEXT,            -- REC-42: the OR branch this leg belongs to. NULL = the implicit single ground (AND)
  -- REC-82 / IC-83 / DEC-23: WHAT PART OF THE DOCUMENT THIS LEG RESTS ON. The
  -- content row is the leg's REFERENT and the bundle its CONTAINER, so
  -- target_id above does NOT move -- the compiler still joins through
  -- bundle_id as it does everywhere (D-222 rule). NULLABLE while I5 is
  -- CHANGING at 1.11.0, and NOT NULL is the IC's own SETTLED condition rather
  -- than this landing's: a leg promoted before REC-82 existed named no extent,
  -- and it is BACKFILLED to its document-extent row on first read rather than
  -- migrated, because the id is a hash and the row is therefore derivable at
  -- any time from the capture it cites (no allocator, so no backfill pass).
  content_id   TEXT,
  PRIMARY KEY (bundle_id, ord)
);
CREATE INDEX IF NOT EXISTS inquiry_basis_target ON inquiry_basis(target_id);
CREATE INDEX IF NOT EXISTS inquiry_basis_bundle ON inquiry_basis(bundle_id);
-- D-223 / PL-8: the index the HUNCH DEBT question reads. leg:hunch compiles to
-- SELECT bundle_id FROM inquiry_basis WHERE grade_source = ?, and bundle_id is in the
-- index so the seek is COVERING -- it never touches the table. It is the RARE-VALUE
-- case an index is for: a hunch is debt, so a corpus where hunches were common is a
-- corpus nobody would publish from, and a scan pays the whole basis to find the few.
-- MEASURED 2026-08-07 (test/meaning-index-probe.mjs, node:sqlite, the statements DRIVEN
-- out of compile() and the OTHER indexes DRIVEN out of schema.mjs AND store.mjs rather
-- than typed -- the first version of that probe hand-wrote them, missed bundles_fts_id
-- because it was created in store.mjs's migration, and reported a 97% saving from an
-- index the product has had for months):
--   leg:hunch  0.241 ms -> 0.145 ms at 20,000 bundles  (-39.8%)
--              0.969 ms -> 0.440 ms at 100,000 bundles (-54.6%)
-- The proportion GROWS with the corpus, which is the property being bought: the seek is
-- O(matching legs) and the scan is O(all legs).
-- NO INDEX ON role, and that is the recorded answer rather than an omission: the same
-- probe measured inquiry_basis(role, bundle_id) as a candidate at -9.1% / -10.1%, which
-- is a write cost on every leg of every promote for a read saving inside the noise.
-- role has two values, so the seek reads half the table and the scan reads all of it --
-- an index is worth least exactly where the value is commonest. If a member's question
-- ever makes cuts_against legs the hot path, re-measure (that probe has since been deleted).
CREATE INDEX IF NOT EXISTS inquiry_basis_grade_source ON inquiry_basis(grade_source, bundle_id);
-- REC-90 -- THE content:cited PREDICATE'S OWN INDEX, AND THIS ONE IS NOT A TUNING
-- CHOICE. content:cited and content:uncited ask whether ANY leg rests on a content
-- row, which is an EXISTS over this column for every candidate row -- O(content
-- rows x legs) without it. MEASURED 2026-09-15 (M-23, test/content-index-probe.mjs)
-- at 20,000 bundles / 40,002 content rows / 31,200 legs, 9 reps:
--   content:uncited  31,614.512 ms -> 9.028 ms  (-100.0%)
--   content:cited    27,292.571 ms -> 11.881 ms (-100.0%)
-- A THIRTY-ONE-SECOND read behind a surface any member can call, against a measured
-- noise floor of 20.5%. That is REC-66 / D-227's amplification class arriving at a
-- new door, not a percentage worth weighing: without these two indexes the op does
-- not answer, it times out. The version-leg table gets the same index for the same
-- predicate, because content:cited asks BOTH tables -- a version leg cites content
-- exactly as a live leg does, and asking only the live one would report a passage
-- as uncited while a recorded version of a basis rests on it.
CREATE INDEX IF NOT EXISTS inquiry_basis_content ON inquiry_basis(content_id);
`;

/** R12: the table this module holds, its declaration to record-core (R21), in the classes `declarePurge`'s default form
 *  gave it while `inquiry` held it (no change of meaning): cleared with its bundle, keyed by `bundle_id`. */
export const LEG_EARNING_TABLES = Object.freeze([
  Object.freeze({ name: "inquiry_basis", keys: Object.freeze(["bundle_id"]), purge: "clear", expunge: "none",
                  export: "admin-only", sight: "bundle", derive: "stored", version_chain: false }),
]);

const ADDITIVE = [["inquiry_basis", "ground", "TEXT"], ["inquiry_basis", "content_id", "TEXT"]];

/** Create the table and its indexes, then add a column an earlier shape lacks (an absent table has no columns and was
 *  just created whole). Idempotent: every boot. */
export function migrateLegEarning(sql) {
  const bare = LEG_EARNING_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const [table, column, decl] of ADDITIVE) {
    const have = [...sql.exec(`PRAGMA table_info(${table})`)].map((r) => r.name);
    if (have.length && !have.includes(column)) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
  for (const s of bare.split(";")) { const t = s.trim(); if (t) sql.exec(t); }
}
