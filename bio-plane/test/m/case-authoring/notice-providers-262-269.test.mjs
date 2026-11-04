/* case-authoring: notices case-tensions:262 and case-disclosures:269 (T53).
   case-tensions:262: its re-authoring of an unsigned document's attribution section now spells the body in the words of
   the document's own format (case-grammar R33, R35). This module writes that section through the same one spelling
   with the format it declares (R14), so a document prepared here and re-authored there carry the same words: confirmed,
   no code changed.
   case-disclosures:269: `findingFacts` answers `ungraded` (its R35) and `ungradedLines` writes it (its R36). The
   document op=publish prepares writes its `ungraded_passages:` block from exactly those entries, through that renderer
   (F2; K1333: imported, never copied). `subjectNaming` (its R46) is a judgment for the public case page's caller; this
   module calls nothing of it: confirmed, nothing to adapt. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { caseDocumentText, searchedSection } from "../../../src/case-authoring/index.mjs";
import { CASE_DOCUMENT_FORMAT, attributionBodyLines, attributionFrontmatterLines, caseWordsOf, ungradedPassagesOf }
  from "../../../src/case-grammar/index.mjs";
import { ungradedLines } from "../../../src/case-disclosures/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q", P = "PROJ-2026-0001";

test("notice case-tensions:262 (R14; case-grammar R33): the attribution section a prepared document carries is spelled in its own format's words, the same lines case-tensions' re-authoring writes for that format", () => {
  const rows = [{ observation: "OBS-2026-0001", level: "project", shown: P, chosen_at_edition: 1 }];
  const text = caseDocumentText({ caseId: "CASE-2026-0001", edition: 1, project: P, scope: "s", bias: "b", bar: {},
    roster: [Q], roles: [{ target: Q, role: "load_bearing" }], pins: new Map([[Q, "p"]]), statement: "st",
    position: "not_sought", justification: "j", excluded: [], author: "alice", at: "t",
    searched: searchedSection({ at: "t", subjectSource: "case_basis", levels: [] }), frozen: new Map(),
    attributions: rows });
  assert.ok(text.includes(`format: ${CASE_DOCUMENT_FORMAT}`));
  assert.equal(caseWordsOf({ format: CASE_DOCUMENT_FORMAT }), "team");
  assert.ok(text.includes(attributionFrontmatterLines(rows).join("\n")), "the run is the one spelling");
  assert.ok(text.includes(attributionBodyLines(rows, CASE_DOCUMENT_FORMAT).join("\n")), "the body in its own format's words");
  assert.ok(!text.includes(attributionBodyLines(rows, "bio-case-document/7").join("\n")), "never an earlier format's words");
});

test("notice case-disclosures:269 (its R35, R36; F2): the ungraded_passages block op=publish writes is case-disclosures' findingFacts entries, written by its ungradedLines", () => {
  const w = world(); w.member("alice");
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q], { tieAttested: true });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
  const { ungraded } = w.ca.disclosures.findingFacts([{ id: Q }], V("alice"));
  assert.ok(ungraded.length >= 1, "the provider lists the passage no one graded");
  assert.ok(text.includes(ungradedLines(ungraded).join("\n")), "written by the provider's renderer");
  assert.deepEqual(ungradedPassagesOf(w.fm(text)).rows,
                   ungraded.map(({ finding, ord, content_id }) => ({ finding, ord, content_id })));
});
