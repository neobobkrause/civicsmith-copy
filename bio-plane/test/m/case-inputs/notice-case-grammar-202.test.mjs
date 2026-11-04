/* case-inputs, the provider notice case-grammar:202 (its R1, R35–R39, T53): the format in force is `bio-case-document/10`,
   which states R36's `ungraded_passages:`, R37's `typed_passages:` and, on a cited register row, R38's and R39's
   `extract_*` fields; `/9`, `/8` and earlier stay accepted as written. This module reads a case document in two places:
   R2 re-authors an unsigned document's acknowledgement list (case-grammar R3's `SECTIONS.acknowledgements`), and R9 reads
   a ratified document's `outcomes:` block (case-grammar R29's `outcomesOf`) to know an outcome is carried. Confirmed with
   no code change: on a `/10` document carrying every new block, written by case-grammar's own writers, the acknowledgement
   re-authors only its list and leaves each new block's bytes and readings as they were, and the outcome a ratified `/10`
   edition holds is carried, as for a `/9` and a `/8` one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { world, V, WORDS } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8, caseDocumentStatesUngradedAndTyped,
         ungradedPassagesLines, ungradedPassagesOf, typedPassagesLines, typedPassagesOf, registerExtractRow, materialsLines,
         materialsOf, outcomesOf } from "../../../src/case-grammar/index.mjs";

const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const FINDING = "INQ-2026-0001-lease";
const PASSAGE = { finding: FINDING, ord: 1, content_id: sha("a passage") };
const TYPED = { ...PASSAGE, ord: 2, typed_at: "2026-10-02T10:00:00Z", typist_level: "group", typist_shown: null,
                checkers: [{ level: "name", shown: "Birch Ames", at: "2026-10-03T09:00:00Z" }] };
const EXTRACT = { ref: sha("content of the cited row"), origin: "https://www.fec.gov/data/", rests_under: "load_bearing",
  title: "Receipts", register: "fec-receipts", file: "indiv24.zip", reduced_sha256: sha("the reduced segment"),
  original_sha256: sha("the original piece"), original_covers: "contributions received in the 2023-2024 cycle",
  source_date: "2026-09-01", imported_at: "2026-10-12T14:00:00Z", src_row: 1442, kept_columns: ["NAME", "CITY"],
  roles: ["name", "place"], dropped_columns: ["EMPLOYER"], header: ["NAME", "CITY"], row: ["SMITH, JO", "O'Fallon, IL"],
  use_limit: { key: "fec-sale-use", citation: "52 U.S.C. 30111(a)(4)", text_key: "register.use_limit.fec" } };

/* Every block /10 adds, each by case-grammar's own writer. */
function v10Blocks() {
  const extract = registerExtractRow(EXTRACT);
  assert.equal(extract.ok, true, JSON.stringify(extract));
  return [...ungradedPassagesLines([PASSAGE]), ...typedPassagesLines([TYPED]), ...materialsLines([extract.row])];
}
/* The front-matter lines above the acknowledgement list's run (case-grammar R3: `  statement_sha: ` up to
   `completeness_excluded:`), where every /10 block is written. */
const outsideAckRun = (text) => {
  const lines = text.split("\n");
  const f0 = lines.findIndex((l) => l.startsWith("  statement_sha: "));
  return lines.slice(0, f0);
};

function setup() {
  const w = world();
  for (const m of ["alice", "bo", "cy"]) w.member(m);
  const P = w.project("Team", "alice");
  w.join(P, "bo");
  w.join(P, "cy");
  return { w, P };
}

test("notice case-grammar:202 (R2): on a /10 document carrying ungraded_passages, typed_passages and a cited register row's extract, an acknowledgement re-authors only its list; every new block's bytes and readings are as they were; control: a /9 and a /8 document are re-authored the same way", () => {
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10", "the format in force is /10 (case-grammar R35)");
  const { w, P } = setup();
  for (const format of [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8]) {
    const blocks = v10Blocks();
    const pub = w.prepare(P, "alice", { format, blocks });
    const before = w.docOf(pub.caseId, 1).text;
    assert.ok(before.includes(`format: ${format}`));
    for (const [n, viewer] of [[1, "bo"], [2, "cy"]]) {
      const r = w.ci.acknowledgeStatement({ reason: WORDS, viewer: V(viewer), caseId: pub.caseId, edition: 1 });
      assert.equal(r.ok, true, `${format}: ${JSON.stringify(r).slice(0, 300)}`);
      assert.equal(r.case_documents[0].reauthored, true, format);
      const after = w.docOf(pub.caseId, 1).text;
      assert.notEqual(after, before, `${format}: the list moved`);
      assert.deepEqual(outsideAckRun(after), outsideAckRun(before), `${format}: every line above the list, the new blocks included, unchanged`);
      for (const line of blocks) assert.ok(after.split("\n").includes(line), `${format}: ${line}`);
      const fm = w.fm(after);
      assert.equal(Number(fm.completeness?.acknowledged), n, `${format}: the list states ${n}`);
      assert.deepEqual(fm.completeness_acknowledgements.map((a) => a.by), ["bo", "cy"].slice(0, n), `${format}: the list names them`);
      if (format === CASE_DOCUMENT_FORMAT) {
        assert.equal(caseDocumentStatesUngradedAndTyped(fm), true);
        assert.deepEqual(ungradedPassagesOf(fm).rows, [PASSAGE], "the ungraded passage reads back");
        assert.deepEqual(typedPassagesOf(fm).rows.map((t) => [t.ord, t.checked, t.checkers.length]), [[2, true, 1]], "the typed passage reads back");
        const m = materialsOf(fm).materials[0];
        assert.deepEqual([m.included, m.extract.register, m.extract.use_limit], [false, "fec-receipts", EXTRACT.use_limit], "the extract reads back");
      } else {
        assert.equal(ungradedPassagesOf(fm).state, "predates", `${format}: a block in a document before /10 is never read`);
      }
    }
  }
});

test("notice case-grammar:202 (R9): an outcome a ratified /10 edition holds, beside every block /10 adds, is carried and pending no longer; control: the same for a /9 and a /8 edition, and an unsigned /10 preparation leaves it pending", () => {
  const { w, P } = setup();
  for (const format of [CASE_DOCUMENT_FORMAT, CASE_DOCUMENT_FORMAT_V9, CASE_DOCUMENT_FORMAT_V8]) {
    const caseId = w.ratifiedCase(P, "alice");
    const carried = w.ci.carryOutcome({ case: caseId, kind: "success", text: "The council published the amended minutes.",
                                        cites: [{ kind: "finding", ref: FINDING }], on: "2026-09-20", by: "alice" });
    assert.equal(carried.ok, true, JSON.stringify(carried).slice(0, 300));
    const next = w.prepare(P, "alice", { caseId, edition: 2, format, blocks: v10Blocks(),
                                         statement: `It does not cover the later amendments, ${format}.`,
                                         outcomes: w.ci.pendingOutcomes(caseId) });
    assert.deepEqual(outcomesOf(w.fm(w.docOf(caseId, 2).text)).map((o) => o.outcome), [carried.outcome], `${format}: the document holds it`);
    assert.deepEqual(w.ci.pendingOutcomes(caseId).map((o) => o.outcome), [carried.outcome], `${format}: unsigned, still pending`);
    w.ratify(next, P);
    assert.deepEqual(w.ci.pendingOutcomes(caseId), [], `${format}: carried, not pending`);
    const listed = w.ci.carriedOutcomesOf({ case: caseId, viewer: V("alice") }).outcomes;
    assert.deepEqual([listed[0].state, listed[0].edition], ["carried", 2], format);
  }
});
