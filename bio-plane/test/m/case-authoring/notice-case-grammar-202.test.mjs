/* case-authoring: notice case-grammar:202 (T53; case-grammar R1, R35–R39). case-grammar's format in force is now
   `bio-case-document/10`, and `caseDocumentFormatFor` answers it always (it answered `/9` for an attestation `sha`, else
   `/8`). This module writes the format only through that helper (R14), so no code here names a format: the document
   `op=publish` prepares declares `/10`, with and without an attestation `sha`, and case-grammar's new readers read it as
   a document that states its ungraded and typed passages, never as one that predates them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V8, CASE_DOCUMENT_FORMATS_ACCEPTED, caseDocumentStatesUngradedAndTyped,
         ungradedPassagesOf, typedPassagesOf } from "../../../src/case-grammar/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;

test("notice case-grammar:202 (R14): a prepared case declares bio-case-document/10, the format in force, though no attestation row carries a sha; case-grammar's readers take it as stating its ungraded and typed passages", () => {
  const w = world(); w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const fm = w.fm(docOf(w, r));
  assert.equal((fm.material_attestations || []).some((a) => a && a.sha), false, "no attestation sha: before 202 this was /8");
  assert.deepEqual([fm.format, CASE_DOCUMENT_FORMAT], ["bio-case-document/10", "bio-case-document/10"]);
  assert.equal(caseDocumentStatesUngradedAndTyped(fm), true);
  assert.equal(ungradedPassagesOf(fm).state, "stated");
  assert.equal(typedPassagesOf(fm).state, "stated");
  /* control: /8, the format this module declared before, stays accepted as written and predates both blocks */
  assert.equal(CASE_DOCUMENT_FORMATS_ACCEPTED.includes(CASE_DOCUMENT_FORMAT_V8), true);
  assert.equal(ungradedPassagesOf({ ...fm, format: CASE_DOCUMENT_FORMAT_V8 }).state, "predates");
});
