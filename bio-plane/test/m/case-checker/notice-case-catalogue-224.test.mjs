/* case-checker: provider notice case-catalogue:224 (its R1, R4, R7, R8). `checkCaseDocument` now answers C-41.18
   (UNGRADED_PASSAGES_MISMATCH) and C-41.19 (TYPED_PASSAGES_MISMATCH). R7 here carries every finding it answers into
   `publication_checks.findings`, and a refusal (severity error) is a `differs` entry for the case, so R11 answers every
   finding `did_not_recreate`. Confirmed with no code change: these tests drive whole case files through `checkCaseFile`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCaseFile } from "../../../src/case-checker/index.mjs";
import { contentIdFor } from "../../../src/content/extent.mjs";
import { caseFile, A, MINUTES_SHA } from "./fixture.mjs";

const CID = contentIdFor(MINUTES_SHA, { kind: "pdf-page", page: 0 }, null);   /* A's one relied-on passage, graded B */
const V10 = "bio-case-document/10", V9 = "bio-case-document/9";
const ungradedRow = ["ungraded_passages:", `  - finding: "${A}"`, "    ord: 0", `    content_id: "${CID}"`];
const typedRow = ["typed_passages:", `  - finding: "${A}"`, "    ord: 0", `    content_id: "${CID}"`, "    checked: false",
  "    typed_at: null", "    typist_level: null", "    typist_shown: null", "    checkers: []"];

const run = async (opts) => checkCaseFile({ parts: caseFile(opts).parts });
const checksOf = (a) => a.publication_checks.findings.filter((x) => x && x.severity === "error").map((x) => x.check);
const caseDiffers = (a) => a.findings.every((f) => f.differs.some((e) => e.check === "publication"));

test("notice case-catalogue:224 (R7, R11): a /10 case whose every passage is graded and which states neither block recreates every finding; C-41.18 and C-41.19 find nothing", async () => {
  const a = await run({ format: V10 });
  assert.deepEqual(checksOf(a), []);
  assert.deepEqual(a.findings.map((f) => f.result), a.findings.map(() => "recreated"));
});

test("notice case-catalogue:224 (R7, R11): a /10 case listing a graded passage under ungraded_passages answers C-41.18 in publication_checks, a differs entry for the case, and no finding recreated", async () => {
  const a = await run({ format: V10, docLines: ungradedRow });
  assert.deepEqual(checksOf(a), ["C-41.18"]);
  assert.ok(caseDiffers(a));
  assert.ok(a.findings.every((f) => f.result === "did_not_recreate"));
});

test("notice case-catalogue:224 (R7): a /9 case carrying an ungraded_passages key is found (C-41.18); the same /9 case without it recreates", async () => {
  const found = await run({ format: V9, docLines: ["ungraded_passages: []"] });
  assert.deepEqual(checksOf(found), ["C-41.18"]);
  assert.ok(found.findings.every((f) => f.result === "did_not_recreate"));
  const control = await run({ format: V9 });
  assert.deepEqual(checksOf(control), []);
  assert.ok(control.findings.every((f) => f.result === "recreated"));
});

test("notice case-catalogue:224 (R7, R11): a /10 case listing an untyped passage under typed_passages answers C-41.19, a differs entry for the case, and no finding recreated", async () => {
  const a = await run({ format: V10, docLines: typedRow });
  assert.deepEqual(checksOf(a), ["C-41.19"]);
  assert.ok(caseDiffers(a));
  assert.ok(a.findings.every((f) => f.result === "did_not_recreate"));
});
