/* case-authoring F2 (case-grammar R35–R37; case-catalogue C-41.18, C-41.19): a `/10` case document the real op=publish
   prepares states its `ungraded_passages:` (and `typed_passages:`) blocks, so caseratify's gate finds no
   UNGRADED_PASSAGES_MISMATCH. Before, the document declared `/10` and wrote neither block, and every real publish whose
   findings rest on a passage no one graded was refused at the gate. These tests prepare through the real `publishCase`
   and run ratification's real `caseRatifyPreflight` (the gate op=caseratify answers through) over the stored bytes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { ungradedPassagesOf, typedPassagesOf, passagesOf, gradingFactsOf } from "../../../src/case-grammar/index.mjs";

const DOC = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";

const prepared = (legs) => {
  const w = world(); w.member("alice");
  w.doc(DOC);
  w.finding(Q, legs);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q], { tieAttested: true });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const text = w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
  return { w, r, text, fm: w.fm(text) };
};
const gateChecks = (w, text) => {
  const g = w.ratification.caseRatifyPreflight({ text, signer: "alice", viewer: "member:alice" });
  return (g.refusals || []).flatMap((x) => [x.check, ...((x.findings || x.body?.findings || []).map((f) => f.check))]);
};

test("F2 (case-grammar R36; C-41.18): a case resting on a passage no one graded, prepared by the real publish, lists that passage in ungraded_passages, and caseratify's gate finds no UNGRADED_PASSAGES_MISMATCH", () => {
  const { w, text, fm } = prepared([{ target: DOC }]);
  const passages = Object.values(passagesOf(fm) || {}).flat();
  assert.ok(passages.length >= 1, "the finding relies on a passage");
  const facts = Object.values(gradingFactsOf(fm) || {}).flat();
  const want = passages.filter((p) => { const g = facts.find((x) => x.finding === p.finding && x.ord === p.ord);
    return g && (g.grade === null || g.grade === undefined); })
    .map((p) => ({ finding: p.finding, ord: p.ord, content_id: p.content_id }));
  assert.ok(want.length >= 1, "the passage's leg shows no grade");
  const u = ungradedPassagesOf(fm);
  assert.equal(u.state, "stated");
  assert.deepEqual(u.rows, want, "exactly the passages with no grade, by finding, ord and content id");
  assert.deepEqual(typedPassagesOf(fm), { state: "stated", rows: [], detail: null }, "no typed passage, no typed rows");
  const checks = gateChecks(w, text);
  assert.ok(!checks.includes("C-41.18"), `the gate's checks: ${JSON.stringify(checks)}`);
  assert.ok(!checks.includes("C-41.19"), `the gate's checks: ${JSON.stringify(checks)}`);
});

test("F2 (control): a document with the ungraded_passages block taken out is refused C-41.18 by the same gate, so the gate is the one that reads the block", () => {
  const { w, text, fm } = prepared([{ target: DOC }]);
  assert.ok(ungradedPassagesOf(fm).rows.length >= 1);
  const stripped = text.split("\n").filter((l, i, a) => {
    const start = a.findIndex((x) => x.startsWith("ungraded_passages:"));
    if (start < 0 || i < start) return true;
    const end = a.findIndex((x, j) => j > start && !/^\s/.test(x));
    return i >= end;
  }).join("\n");
  assert.notEqual(stripped, text);
  assert.ok(gateChecks(w, stripped).includes("C-41.18"));
});
