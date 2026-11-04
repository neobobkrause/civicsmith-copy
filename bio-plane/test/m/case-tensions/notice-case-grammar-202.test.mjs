/* case-tensions — notice case-grammar:202 (its R1, R35–R39: the format in force is now `bio-case-document/10`).
   R5's act re-authors an unsigned document's attribution section through case-grammar R2's one spelling; since the
   format in force moved, the body must be spelled in the words of the document's OWN format (case-grammar R33), so a
   `/7` draft prepared before keeps its `group` words, while a `/9` or `/10` draft says `team`. Driven at the module's
   interface; the expected lines come from case-grammar's own spelling, never copied here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, attributionBodyLines, attributionFrontmatterLines, caseWordsOf }
  from "../../../src/case-grammar/index.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001";

function attributeAt(format) {
  const w = world();
  w.member("olive"); w.member("ann");
  const proj = w.project("PROJ-1", ["olive"]);
  const obs = w.observe("ann");
  const pin = w.finding(F);
  w.reach.set(F, { self: [obs], via: [] });
  w.prepare(CASE, 1, { project: proj, format, roles: [{ target: F, version_sha: pin }], attributions: [{ observation: obs }] });
  const r = w.op("attribute", { by: "ann" }, { caseId: CASE, edition: 1, observation: obs, level: "project",
                                              reason: "the project speaks for these words" });
  assert.equal(r.ok, true);
  assert.equal(r.case_document.reauthored, true);
  const rows = [{ observation: obs, level: "project", shown: proj, chosen_at_edition: 1 }];
  return { text: w.pub.get(CASE, 1).text, rows };
}

test("R5 notice case-grammar:202: an unsigned document's attribution body is re-authored in its own format's words, not the format in force's", () => {
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10", "the provider's format in force, as the notice states");
  for (const [format, words] of [["bio-case-document/7", "group"], ["bio-case-document/9", "team"],
                                 ["bio-case-document/10", "team"]]) {
    assert.equal(caseWordsOf({ format }), words);
    const { text, rows } = attributeAt(format);
    assert.ok(text.includes(attributionFrontmatterLines(rows).join("\n")), `${format}: the run is the one spelling`);
    assert.ok(text.includes(attributionBodyLines(rows, format).join("\n")), `${format}: the body is in its own words`);
    if (words === "group")
      assert.ok(!text.includes(attributionBodyLines(rows).join("\n")), `${format}: never in the format in force's words`);
  }
});
