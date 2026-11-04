/* ratification against case-catalogue PR 224 (notice case-catalogue:224; its R1, R4, R7, R8; DEC-461, DEC-464):
   `checkCaseDocument` now answers C-41.18 UNGRADED_PASSAGES_MISMATCH and C-41.19 TYPED_PASSAGES_MISMATCH over a /10
   document, and the catalogue exports `legUngraded`. This module registers `checkCaseDocument` with `promotion` as the
   case gate's catalogue (R8; `index.mjs` `ratificationOf`) and re-exports the catalogue (`checks.mjs`'s `export *`), so
   no code changes: both findings now refuse `op=caseratify` and the pre-flight as GATE_REFUSED, alike, and
   `legUngraded` is re-exported as the catalogue's own. C-41.18 through the three gates is R62's
   (`r62-ungraded-statement.test.mjs`); C-41.19 has no requirement of this module's naming it (R8 and R14 list
   C-41.1–C-41.17), so this test confirms only that the registration runs it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../../../src/case-catalogue/checks.mjs";
import * as RC from "../../../src/ratification/checks.mjs";
import * as RI from "../../../src/ratification/index.mjs";
import { passagesWorld, refusedAlike, signs, typedRow, ungraded, TYPED, P1, Q1 } from "./passages-world.mjs";

const TYPED_FACT = [{ finding: Q1, ord: 1, grade: "D", typed: { checked: false } }];

test("notice case-catalogue:224: legUngraded and the two new rows are re-exported as the catalogue's own", () => {
  assert.equal(RC.legUngraded, C.legUngraded);
  assert.equal(RC.checkCaseDocument, C.checkCaseDocument);
  assert.equal(RI.checkCaseDocument, C.checkCaseDocument);
  const checks = Object.values(RC.CASE_DOCUMENT_FAMILY).map((r) => r.check);
  for (const id of ["C-41.18", "C-41.19"]) assert.ok(checks.includes(id), id);
});

test("notice case-catalogue:224 (R8): C-41.19 — a typed passage the document does not list, or lists checked with no checker, is refused GATE_REFUSED naming C-41.19 by the act and the pre-flight alike; listed correctly it signs", async () => {
  await refusedAlike(await passagesWorld({ passages: [TYPED], facts: TYPED_FACT, lines: [] }), ["C-41.19"], "a typed passage not listed");
  const lying = typedRow(TYPED).map((l) => l.replace("checked: false", "checked: true"));
  assert.notDeepEqual(lying, typedRow(TYPED), "the row was changed");
  await refusedAlike(await passagesWorld({ passages: [TYPED], facts: TYPED_FACT, lines: lying }), ["C-41.19"], "checked with no checker");
  await signs(await passagesWorld({ passages: [TYPED], facts: TYPED_FACT, lines: typedRow(TYPED) }), "listed correctly");
});

test("notice case-catalogue:224 (R8, R62): C-41.18 runs through the same registration — an ungraded passage left out is refused naming C-41.18, listed it signs", async () => {
  const facts = [{ finding: Q1, ord: 1, grade: null }, { finding: Q1, ord: 2, grade: "B" }];
  await refusedAlike(await passagesWorld({ facts, lines: [] }), ["C-41.18"], "left out");
  await signs(await passagesWorld({ facts, lines: ungraded(P1) }), "listed");
});
