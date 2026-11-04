/* case-authoring: notice strength:176 (T53; strength R46, R47; DEC-464). The grading method has a new version, naming
   the typed-passage rule. A case states the version it is signed under in its `method:` block (R14, R55: `case-disclosures`
   R5 reads strength's `GRADING_METHOD_VERSION` at the act), so this module needs no change: the document it prepares now
   names the new version, and the method's words at that version carry the typed-passage rule. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { methodOf } from "../../../src/case-grammar/index.mjs";
import { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS, gradingMethodText } from "../../../src/strength/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;

test("notice strength:176 (R14, R55): a prepared case is signed under bio-grading/5, strength's newest method, whose words name the typed-passage rule; the earlier versions stay published", () => {
  const w = world(); w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const method = methodOf(w.fm(docOf(w, r)));
  assert.deepEqual([method.grading, GRADING_METHOD_VERSION], ["bio-grading/5", "bio-grading/5"]);
  assert.equal(GRADING_METHOD_VERSIONS.at(-1), method.grading);
  assert.match(String(gradingMethodText(method.grading)), /[Tt]yped passage/);
  /* control: the version before 176 is still published and its words carry no typed-passage rule */
  assert.equal(GRADING_METHOD_VERSIONS.includes("bio-grading/4"), true);
  assert.doesNotMatch(String(gradingMethodText("bio-grading/4")), /[Tt]yped passage/);
});
