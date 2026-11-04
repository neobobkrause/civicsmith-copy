/* case-checker: provider notice strength:176 (its R46, R47). A leg on a typed passage counts at its typist's word, one
   step more once checked, and the grading method has a new version, `bio-grading/5`. This module recomputes each pair
   by `strength.recomputePair` at the version the document states (R5) from each leg's recorded grade, and holds every
   version `strength` publishes. Confirmed with no code change: a typed leg's recorded grade recomputes and recreates. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCaseFile, CHECKER_VERSIONS } from "../../../src/case-checker/index.mjs";
import { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS, recomputePair } from "../../../src/strength/method.mjs";
import { caseFile, gradingFacts, byId, A } from "./fixture.mjs";

/* A's minutes leg as a typed passage, checked by a second member: recorded C (strength R46), its facts saying typed and checked (R47). */
const typedFacts = (checked, grade) => {
  const facts = gradingFacts();
  facts[A].legs[0] = { ...facts[A].legs[0], grade, typed: { checked } };
  return facts;
};

test("notice strength:176 (R5): the checker holds every grading version strength publishes, bio-grading/5 included, and names them in its answer", async () => {
  assert.equal(GRADING_METHOD_VERSION, "bio-grading/5");
  assert.deepEqual(CHECKER_VERSIONS.grading_versions, [...GRADING_METHOD_VERSIONS]);
  const a = await checkCaseFile({ parts: caseFile({ format: "bio-case-document/10" }).parts });
  assert.ok(a.checker.grading_versions.includes("bio-grading/5"));
  assert.ok(a.findings.every((f) => f.result === "recreated"));
});

test("notice strength:176 (R5, R11): a /10 case whose load-bearing finding rests on a checked typed passage (recorded C) recomputes the same pair and recreates; an unchecked one (recorded D) likewise", async () => {
  for (const [checked, grade] of [[true, "C"], [false, "D"]]) {
    const facts = typedFacts(checked, grade);
    const cf = caseFile({ format: "bio-case-document/10", facts, bar: { declared: true, capture: grade, connection: "C" } });
    const a = byId(await checkCaseFile({ parts: cf.parts }));
    assert.equal(a[A].result, "recreated", `typed ${checked}`);
    assert.deepEqual(a[A].differs, []);
    assert.equal(a[A].pair.capture.grade, recomputePair({ legs: cf.facts[A].legs, version: GRADING_METHOD_VERSION }).capture.grade);
    assert.equal(a[A].pair.capture.grade, grade, "the capture axis counts at the typed leg's grade");
  }
});

test("notice strength:176 (R5): a typed leg's case whose recorded capture grade differs from what its facts recompute is a differs entry naming the grade (control)", async () => {
  const facts = typedFacts(false, "D");
  const cf = caseFile({ format: "bio-case-document/10", facts, bar: { declared: true, capture: "D", connection: "C" },
    recorded: (p) => ({ ...p, [A]: { ...p[A], capture: { state: "graded", grade: p[A].capture.grade === "A" ? "B" : "A" } } }) });
  const a = byId(await checkCaseFile({ parts: cf.parts }));
  assert.equal(a[A].result, "did_not_recreate");
  assert.ok(a[A].differs.some((e) => e.check === "grade"));
});
