/* case-import R36 (T53; DEC-461; invariant): the source's ungrading is not this group's. A `/10` edition whose document
   states a passage it published without a grade is imported through the real case-import and its finding accepted; this
   group's own finding rests on that accepted finding beside a passage of its own left ungraded. The real
   case-disclosures (its R35, `findingFacts`) lists only the own passage, never the source's. The statement also changes
   no result, acceptance, flag or re-evaluation cause: the same edition without the block answers the same.
   The world is case-disclosures' own (real record-core, membership, content, inquiry, strength and accepted-work on one
   host) with the real case-import composed on it; the case file is case-checker's fixture's, the `/10` document's block
   written by case-grammar's writer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, sha } from "../case-disclosures/fixture.mjs";
import { caseFile, gradingFacts, A, GROUP, CASE, MINUTES } from "../case-checker/fixture.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";

const TEN = "bio-case-document/10";
const ED = 2;                          // the edition case-checker's fixture writes
const D1 = "INFO-2026-0101-own";
const Q = "INQ-2026-0101-own";
const PAIR = { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } };
const page = (n) => JSON.stringify({ kind: "pdf-page", page: n });
const cited = (cid) => `"${cid}"`;

/* The source's passage on the minutes, A's first leg, as the fixture's `passages:` file carries it. */
const sourceCid = () => JSON.parse(caseFile({ format: TEN }).bytesOf.get(CG.caseFilePath("passages", A)).toString())[0].content_id;
/* A `/10` case file whose finding A's minutes leg is published ungraded; `listed` writes its `ungraded_passages:` block. */
function sourceFile(listed) {
  const facts = gradingFacts();
  facts[A].legs[0] = { ...facts[A].legs[0], grade: null };
  return caseFile({ format: TEN, facts,
                    docLines: listed ? CG.ungradedPassagesLines([{ finding: A, ord: 0, content_id: sourceCid() }]) : [] });
}

/* Alice imports the source's edition and accepts A; Q rests on A's reference and on an own passage, graded or not. */
async function rested({ listed = true, ownGraded = false } = {}) {
  const w = world({ realImports: true });
  for (const m of ["alice", "bob"]) w.member(m);
  Object.assign(w.checks, { group: GROUP, case: CASE, edition: ED, findings: [{ finding: A, pair: PAIR }] });
  const imp = await w.imports.importCaseFile({ parts: sourceFile(listed).parts, by: V("alice"), viewer: V("alice") });
  assert.equal(imp.ok, true, JSON.stringify(imp).slice(0, 300));
  const acc = w.imports.acceptImported({ import: imp.import, edition: ED, findings: [A], checked: "the minutes",
                                         reason: "We recreated it and read it.", by: V("alice"), viewer: V("alice") });
  assert.equal(acc.ok, true, JSON.stringify(acc).slice(0, 300));
  const edition = w.imports.importedCase({ import: imp.import, edition: ED, viewer: V("alice") }).edition;
  const ref = edition.findings.find((f) => f.finding === A).ref;
  const cap = w.doc(D1, {}, { receipt: true });
  w.content(sha("own-p0"), cap, D1, "own-p0", page(0));
  w.finding(Q, [{ target: ref, target_edition: ED },
                { target: D1, content_id: cited(sha("own-p0")),
                  ...(ownGraded ? { grade: "B", grade_axis: "capture", grade_source: "capture" } : {}) }]);
  return { w, imp: imp.import, ref, edition, facts: w.cd.findingFacts([{ id: Q }], V("alice")) };
}

test("R36 (T53; DEC-461): an own case resting on an accepted finding whose source listed a passage ungraded lists none of the source's passages; the source's statement stands in the import as the source's", async () => {
  const { facts, edition } = await rested();
  /* the source did list it: the import holds its statement (R34, R35), so its absence below is the invariant's */
  assert.deepEqual(edition.ungraded_passages.rows.map((r) => [r.finding, r.ord, r.content_id]), [[A, 0, sourceCid()]]);
  assert.deepEqual(facts.unread, [], "the own finding is read");
  assert.equal(facts.grading.length, 2, "both legs, the accepted finding's and the own passage's, are read");
  assert.equal(facts.ungraded.some((u) => u.content_id === sourceCid()), false, "the source's ungraded passage is not listed");
  assert.equal(facts.ungraded.some((u) => u.ord === 0), false, "the leg on the accepted finding adds no ungraded entry");
  assert.deepEqual(facts.ungraded.map((u) => [u.finding, u.ord, u.content_id]), [[Q, 1, sha("own-p0")]],
                   "only this group's own ungraded passage");
});

test("R36 (control): the own passage ungraded is listed and graded is not, with the source's listing unchanged; the source's statement changes no result, acceptance, flag or re-evaluation cause", async () => {
  const listed = await rested();
  const graded = await rested({ ownGraded: true });
  assert.deepEqual(graded.facts.ungraded, [], "the own passage graded: nothing listed, the source's listing notwithstanding");
  assert.equal(listed.facts.ungraded.length, 1, "the own ungraded passage is listed");
  /* the same edition without the block: every result, acceptance, flag and move reads alike */
  const plain = await rested({ listed: false });
  assert.equal(plain.edition.ungraded_passages.count, 0);
  const view = (x) => {
    const ci = x.w.imports;
    const fl = ci.flagImported({ import: x.imp, edition: ED, finding: A, issue: "page 2 is misread", by: V("bob"), viewer: V("bob") });
    assert.equal(fl.ok, true, JSON.stringify(fl).slice(0, 300));
    const e = ci.importedCase({ import: x.imp, edition: ED, viewer: V("alice") }).edition;
    const acc = ci.acceptanceOf({ import: x.imp, edition: ED, finding: A });
    return {
      results: e.findings.map((f) => [f.finding, f.result, f.missing, f.differs, f.pair]),
      acceptance: acc && [acc.by, acc.reason, acc.checked, acc.gaps],
      flags: ci.openFlagsOn({ import: x.imp, edition: ED }).flags.map((f) => [f.finding ?? null, f.issue]),
      moves: ci.moves({ after: null, limit: 200 }),
      graded: x.facts.grading.map((g) => [g.ord, g.grade, g.grade_axis, g.grade_source]),
      ungraded: x.facts.ungraded,
    };
  };
  const a = view(listed), b = view(plain);
  assert.equal(a.flags.length, 1, "the flag is open");
  assert.notEqual(a.acceptance, null, "the acceptance is in force");
  assert.deepEqual(a, b);
});
