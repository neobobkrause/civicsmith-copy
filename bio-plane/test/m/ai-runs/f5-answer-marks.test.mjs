/* ai-runs F5 (CR2-8; IV-8, BD-14 Q9.5): the answer key's contrary marks, carried to Gate 1. An answer key marks each passage
   of each conclusion as cutting against it (contrary, exculpatory included) or supporting it; `answerKeyMarks` reads the
   counts; a team's test investigation whose marks are malformed is refused AI_GROUP_TEST_INVALID naming the field, nothing
   added; `groupTestResults` says how many of a part's matters carry contrary marks; a Gate 1 record carrying `recall` is
   written as given when its figures are counts as IV-8 states them, else refused AI_TEST_BAR_UNFIT naming `recall`.
   Control: a record with no `recall` is written as before, and a key with no marks is added as before. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, INQ, ENTRIES } from "./world.mjs";
import { answerKeyMarks, ANSWER_MARKS } from "../../../src/ai-runs/index.mjs";

const KEY = { conclusions: [
  { conclusion: "the fee rise was not noticed", passages: [{ passage: "doc1#p3", cuts: "for" }, { passage: "doc2#p1", cuts: "against" }] },
  { conclusion: "the vote was late", passages: [{ passage: "doc1#p9", cuts: "for" }] },
] };

test("F5 (IV-8): answerKeyMarks counts the contrary and supporting marks; a key with none is unmarked; a malformed mark names its field", () => {
  assert.deepEqual(ANSWER_MARKS, ["against", "for"]);
  assert.deepEqual(answerKeyMarks(KEY), { marked: true, contrary: 1, supporting: 2 });
  assert.deepEqual(answerKeyMarks({ conclusions: [{ conclusion: "c", passages: [{ passage: "p", cuts: "for" }] }] }),
    { marked: false, contrary: 0, supporting: 1 }, "no contrary mark: contributes to neither figure");
  for (const a of ["written answers", { findings: "x" }, null])
    assert.deepEqual(answerKeyMarks(a), { marked: false, contrary: 0, supporting: 0 });
  for (const [bad, field] of [[{ conclusions: "x" }, "conclusions"], [{ conclusions: [{ passages: [] }] }, "conclusion"],
                              [{ conclusions: [{ conclusion: "c" }] }, "passages"],
                              [{ conclusions: [{ conclusion: "c", passages: [{ cuts: "for" }] }] }, "passage"],
                              [{ conclusions: [{ conclusion: "c", passages: [{ passage: "p", cuts: "maybe" }] }] }, "cuts"]])
    assert.deepEqual(answerKeyMarks(bad), { field }, JSON.stringify(bad));
});

test("F5 (IV-8): a team's test investigation carries its contrary marks; a malformed mark is refused naming the field with nothing added; the results say how many matters are marked; control: an unmarked key is added as before", async () => {
  const w = world({ bars: [] });
  await w.group("ann"); w.bundle(INQ);
  const bad = w.runs.groupTestSet({ part: "check", matter: "fee rise", by: "member:ann",
    answers: { conclusions: [{ conclusion: "c", passages: [{ passage: "p", cuts: "sideways" }] }] } });
  assert.deepEqual([bad.ok, bad.code, bad.field], [false, "AI_GROUP_TEST_INVALID", "cuts"]);
  assert.equal(w.count("ai_group_tests"), 0, "nothing added");
  assert.equal(w.runs.groupTestSet({ part: "check", matter: "fee rise", answers: KEY, by: "member:ann" }).ok, true);
  assert.equal(w.runs.groupTestSet({ part: "check", matter: "late vote", answers: "plain written answers", by: "member:ann" }).ok, true);
  const shown = w.runs.groupTestResults({ part: "check", viewer: "member:ann" });
  assert.deepEqual([shown.matters, shown.matters_marked], [2, 1]);
  assert.deepEqual(w.runs.groupTestResults({ part: "check", viewer: "member:nobody" }).matters_marked, 0, "withheld from a non-member");
});

test("F5 (IV-8): a Gate 1 record's contrary and supporting recall are written as given and read back unchanged; unfit figures are refused AI_TEST_BAR_UNFIT naming recall, nothing written; control: a record with no recall is written as before", async () => {
  const w = world({ bars: [] });
  await w.group("ann"); w.bundle(INQ);
  const recall = { contrary: { proposed: 3, marked: 4 }, supporting: { proposed: 9, marked: 10 }, matters_marked: 2, matters_unmarked: 1 };
  for (const r of [{ ...recall, contrary: { proposed: 5, marked: 4 } }, { ...recall, matters_marked: -1 }, { ...recall, supporting: null },
                   { ...recall, contrary: { proposed: 0.5, marked: 1 } }, "high", null]) {
    const x = w.runs.gateVerdictRecord({ ...w.gate("check", ENTRIES.a), recall: r });
    assert.deepEqual([x.ok, x.code, x.field], [false, "AI_TEST_BAR_UNFIT", "recall"], JSON.stringify(r));
  }
  assert.equal(w.count("ai_gate_records"), 0, "nothing written on a refusal");
  const good = { ...w.gate("check", ENTRIES.a), recall };
  assert.equal(w.runs.gateVerdictRecord(good).ok, true);
  assert.deepEqual(w.runs.gateVerdictRecords({ entry_id: ENTRIES.a }), [good], "kept as given, recall included");
  const plain = w.gate("check", ENTRIES.b);
  assert.equal(w.runs.gateVerdictRecord(plain).ok, true, "a record with no recall is written as before");
  assert.deepEqual(w.runs.gateVerdictRecords({ entry_id: ENTRIES.b }), [plain]);
});
