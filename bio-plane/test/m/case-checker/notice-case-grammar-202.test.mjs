/* case-checker: provider notice case-grammar:202 (its R1, R35–R39). Every new case document is `bio-case-document/10`,
   which states what `/9` states plus the ungraded- and typed-passages blocks (R36, R37), and a grading-facts row may
   carry `typed` (R17 as amended). This module reads the document through case-grammar's readers (R1–R11). Confirmed with
   no code change: a case at the current format, with and without the new blocks, recreates; earlier formats read as before. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as CG from "../../../src/case-grammar/index.mjs";
import { checkCaseFile } from "../../../src/case-checker/index.mjs";
import { caseFile, gradingFacts, A } from "./fixture.mjs";

test("notice case-grammar:202 (R1, R7, R11): a case at the format case-grammar now writes (bio-case-document/10) recreates every finding, its publication checks clean", async () => {
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  const a = await checkCaseFile({ parts: caseFile({ format: CG.CASE_DOCUMENT_FORMAT }).parts });
  assert.deepEqual(a.publication_checks.findings.filter((x) => x.severity === "error"), []);
  assert.ok(a.findings.every((f) => f.result === "recreated"));
});

test("notice case-grammar:202 (R1, R5): a /10 grading_facts row carrying typed (case-grammar's GRADING_FACT_TYPED_FIELD) is read; the case recreates", async () => {
  const facts = gradingFacts();
  facts[A].legs[0] = { ...facts[A].legs[0], grade: "C", [CG.GRADING_FACT_TYPED_FIELD]: { checked: true } };
  const cf = caseFile({ format: CG.CASE_DOCUMENT_FORMAT, facts, bar: { declared: true, capture: "C", connection: "C" } });
  assert.ok(cf.bytesOf.get(CG.caseFilePath("case_document")).toString("utf8").includes(`${CG.GRADING_FACT_TYPED_FIELD}:`));
  const a = await checkCaseFile({ parts: cf.parts });
  assert.ok(a.findings.every((f) => f.result === "recreated"));
});

test("notice case-grammar:202 (R1): earlier formats stay accepted and read as written: /9, /8 and /6 cases recreate", async () => {
  for (const format of ["bio-case-document/9", "bio-case-document/8", "bio-case-document/6"]) {
    const a = await checkCaseFile({ parts: caseFile({ format }).parts });
    assert.ok(a.findings.every((f) => f.result === "recreated"), format);
  }
});
