/* The notice of `strength` PR 176 (its R46, R47; DEC-464), answered here. strength's grading facts of a leg on a typed
   passage now say `typed: {checked}` (R47), and its grading method has a new version, `bio-grading/5`, naming the
   typed-passage rule. This module signs the facts in R17's `grading_facts:` block and prints the method in R14's item 8,
   so: (1) a row carries `typed` through the block and back, and a row without it keeps its bytes (adapted, `./facts.mjs`
   `GRADING_FACT_TYPED_FIELD`); (2) an edition graded at the new version prints its rule, an earlier one does not
   (confirmed, no code change). Driven over strength's real code, composed on leg-earning's published world as strength's
   own typed test composes it (`../leg-earning/fixture.mjs`), never a hand-built answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { strengthOf, gradingMethodText, GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS } from "../../../src/strength/index.mjs";
import { migrateObservationLog } from "../../../src/observation-log/schema.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { migrateInquiry } from "../../../src/inquiry/schema.mjs";
import { world as earningWorld, V, inquiryMd } from "../leg-earning/fixture.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { doc } from "./helpers.mjs";

const AT = "2026-09-27T00:00:00Z";
const fmOf = (text) => { const p = parseFrontmatter(text); assert.deepEqual(p.findings, [], "the grammar reads every line"); return p.data; };

function world() {
  const w = earningWorld();
  w.member("ruth"); w.member("sam");
  migrateObservationLog(w.st.sql);
  migrateInquiry(w.st.sql);
  const retrieval = retrievalOf(w.host, { record: w.record, membership: w.membership });
  if (typeof retrieval.migrate === "function") retrieval.migrate();
  w.s = strengthOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion });
  return w;
}

/* strength's real grading facts of a question resting on a typed passage and on a plain document, before and after a
   second member checks the typing */
function facts() {
  const w = world();
  const DOC = "INFO-2026-6406-typed", PLAIN = "INFO-2026-6407-plain";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  w.doc(PLAIN, ["publisher-typed"], { chain: null });
  const tx = w.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "ruth", viewer: V("ruth"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  const id = "INQ-2026-6401-t";
  const r = w.promoteInquiry(id, inquiryMd(id, { refs: [{ target: DOC }, { target: PLAIN }], extra: ["basis:",
    `  - target: ${DOC}`, "    role: supports", `    content_id: "${tx.content_id}"`,
    `  - target: ${PLAIN}`, "    role: supports", `    grade: ${EARNED_CAPTURE_CEILING}`, "    grade_axis: capture", "    grade_source: capture"] }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const read = () => { const f = w.s.gradingFacts({ inquiry: id, viewer: "admin" }); assert.equal(f.ok, true); return f; };
  const unchecked = read();
  const at = w.content.transcriptionAttest({ contentId: tx.content_id, attestor: "sam", viewer: V("sam"), at: "2026-09-27T01:00:00Z",
                                             note: "The typing matches the page." });
  assert.equal(at.ok, true, JSON.stringify(at).slice(0, 300));
  return { id, DOC, PLAIN, unchecked, checked: read() };
}
const rowsOf = (id, f) => f.legs.map((l, i) => ({ finding: id, ord: i + 1, ...l }));

test("notice strength:176 (R47): a typed leg's grading facts carry typed {checked} through the grading_facts block and back; a plain leg's row is written as before", () => {
  const { id, DOC, PLAIN, unchecked, checked } = facts();
  for (const [f, want] of [[unchecked, false], [checked, true]]) {
    const rows = rowsOf(id, f);
    const lines = CG.gradingFactsLines(rows);
    const back = CG.gradingFactsOf(fmOf(doc(CG.CASE_DOCUMENT_FORMAT, lines)))[id];
    assert.deepEqual(back.find((r) => r.target === DOC).typed, { checked: want }, `typed, checked ${want}`);
    assert.equal("typed" in back.find((r) => r.target === PLAIN), false, "a plain leg states no typed");
    /* the plain leg's row is exactly the row written before the field: every field of R17, no more */
    const plain = rows.find((r) => r.target === PLAIN);
    assert.deepEqual(CG.gradingFactsLines([plain]), CG.gradingFactsLines([{ ...plain, typed: undefined }]));
    assert.equal(CG.gradingFactsLines([plain]).some((l) => l.includes("typed:")), false);
    assert.equal(JSON.stringify(lines).includes("ruth") || JSON.stringify(lines).includes("sam"), false, "no names");
  }
  assert.equal(CG.GRADING_FACT_TYPED_FIELD, "typed");
  assert.equal(CG.GRADING_FACT_FIELDS.includes("typed"), false, "R17's field list is unchanged");
});

test("notice strength:176 (R47): an edition graded at strength's new method version prints its typed-passage rule in item 8; an edition at the version before does not", () => {
  const V7 = JSON.parse(readFileSync(new URL("./complete-v7-golden.json", import.meta.url), "utf8"));
  const at = (version) => CG.completeEditionOf({ ...V7.input, files: V7.input.files.map((f) => (f.path === "case.md"
    ? { ...f, content: f.content.replace(/\nformat: bio-case-document\/7\n/, `\nformat: ${CG.CASE_DOCUMENT_FORMAT}\n`)
        .replace(/\n {2}grading: "[^"]*"\n/, `\n  grading: "${version}"\n`) } : f)) });
  const rule = gradingMethodText(GRADING_METHOD_VERSION, "Civicsmith").split("\n").find((l) => /^\s*12\. Typed passages\./.test(l));
  assert.ok(rule, "the new version names the rule");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  assert.ok(at(GRADING_METHOD_VERSION).includes(esc(rule.trim())), "item 8 prints it");
  const before = GRADING_METHOD_VERSIONS[GRADING_METHOD_VERSIONS.indexOf(GRADING_METHOD_VERSION) - 1];
  assert.equal(at(before).includes(esc(rule.trim())), false, "the version before has no such rule");
});
