/* ratification against case-grammar PR 202 (notice case-grammar:202; its R1, R35–R39): the format becomes
   `bio-case-document/10`, stating `ungraded_passages:` and `typed_passages:` (R36, R37), every earlier format still
   accepted as written; the material extract fields (R38, R39) are new. This module signs whatever bytes publication
   stored, reading the case document only through the case gate (R8), the approvals block (`approvalSubjectSha`,
   `approvalsOf`) and the scheduled publisher's blocks (`caseDocumentBlocks`, `acceptedWorkOf`, `peopleOf`,
   `memberTiesOf`), none of which changed, so it needs no change: a /10 document signs, stating its blocks or none, and
   a /9 document signs unasked, as before. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMATS_ACCEPTED } from "../../../src/case-grammar/index.mjs";
import { passagesWorld, signs, ungraded, P1, Q1 } from "./passages-world.mjs";

test("notice case-grammar:202 (R35): a /10 document signs with its blocks and with none; a /9 document, and the fixture's /6, sign as written", async () => {
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  assert.ok(CASE_DOCUMENT_FORMATS_ACCEPTED.includes(CASE_DOCUMENT_FORMAT_V9));
  const facts = [{ finding: Q1, ord: 1, grade: null }, { finding: Q1, ord: 2, grade: "B" }];
  await signs(await passagesWorld({ facts, lines: ungraded(P1) }), "/10, stating one ungraded passage");
  await signs(await passagesWorld({ facts: [{ finding: Q1, ord: 1, grade: "C" }, { finding: Q1, ord: 2, grade: "B" }] }), "/10, stating none");
  await signs(await passagesWorld({ format: CASE_DOCUMENT_FORMAT_V9, facts }), "/9 with an ungraded passage, unasked");
  await signs(await passagesWorld({ format: null, passages: null }), "the fixture's /6");
});
