/* case-import: provider notice strength:176 (strength R46, R47; DEC-464). A leg on a typed passage counts at its typist's
   word (D), one step more once a second member checked it (C), and the grading method has a new version, `bio-grading/5`.
   This module recreates an imported edition through `case-checker` (R3), which recomputes each pair from the leg's
   recorded grade at the version the document states, records the checker's grading versions, and reads each finding
   against this group's own bar (`strength.strengthBarOf`, R4). Confirmed with no code change: an imported `/10` edition
   whose load-bearing finding rests on a typed passage recreates, its recorded pair counts at the typed grade, and R4's
   reading against this group's bar follows it. Driven over the real case-checker and case files built by its fixture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, V } from "./fixture.mjs";
import { caseFile, gradingFacts, A } from "../case-checker/fixture.mjs";
import { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS } from "../../../src/strength/index.mjs";

/* A's minutes leg as a typed passage: recorded C once checked, D unchecked (strength R46), its facts saying so (R47). */
const typedFile = (checked) => {
  const grade = checked ? "C" : "D";
  const facts = gradingFacts();
  facts[A].legs[0] = { ...facts[A].legs[0], grade, typed: { checked } };
  return caseFile({ format: "bio-case-document/10", facts, bar: { declared: true, capture: grade, connection: "C" } });
};

test("notice strength:176 (R3, R4): an imported /10 edition whose load-bearing finding rests on a typed passage recreates under bio-grading/5; its pair counts at the typed grade, and this group's own bar reads it so", async () => {
  assert.equal(GRADING_METHOD_VERSION, "bio-grading/5");
  for (const checked of [true, false]) {
    const w = seeded({ realChecker: true });
    w.bar({ capture: "C", connection: "C" });
    const r = await w.ci.importCaseFile({ parts: typedFile(checked).parts, by: V("alice"), viewer: V("alice") });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    assert.ok(r.recreation.checker.grading_versions.includes("bio-grading/5"), "the recorded checker holds the new version");
    const f = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition.findings.find((x) => x.finding === A);
    assert.equal(f.result, "recreated", `typed, checked ${checked}`);
    assert.equal(f.pair.capture.grade, checked ? "C" : "D", "the capture axis counts at the typed passage's grade, never the bytes' B");
    /* this group's bar asks C on capture: a checked typing reaches it, an unchecked one does not */
    assert.equal(f.against_own_bar.meets, checked, JSON.stringify(f.against_own_bar));
  }
});

test("notice strength:176 (R3; control): the earlier grading versions stay held, so an edition signed under one still recreates as before", async () => {
  assert.ok(GRADING_METHOD_VERSIONS.includes("bio-grading/4"));
  const w = seeded({ realChecker: true });
  const r = await w.ci.importCaseFile({ parts: caseFile().parts, by: V("alice"), viewer: V("alice") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.recreation.checker.grading_versions, [...GRADING_METHOD_VERSIONS]);
  for (const f of r.recreation.findings) assert.equal(f.result, "recreated", f.finding);
  assert.equal(r.recreation.findings.find((x) => x.finding === A).pair.capture.grade, "B", "an untyped leg keeps its byte grade");
});
