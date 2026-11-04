/* case-import R34, R35 (T53; DEC-461): an edition of the new case-document format imports as an earlier one, and the
   source's statement of the passages it published without a grade (`case-grammar` R36's `ungraded_passages:` block) is
   recorded with it once and answered to a member, labeled the source's, never this group's grade. Driven over the real
   case-checker, with case files built by its fixture (a `/10` document, and the `/6` its fixture writes by default). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, V } from "./fixture.mjs";
import { caseFile, gradingFacts, A, C, MINUTES } from "../case-checker/fixture.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { UNGRADED_LABEL_KEY, UNGRADED_NOT_STATED_KEY } from "../../../src/case-import/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const TEN = "bio-case-document/10";
const TITLE = "Board minutes, March 2024";
/* A's passage on the minutes, as the fixture's `passages:` file carries it. */
const minutesCid = () => JSON.parse(caseFile({ format: TEN }).bytesOf.get(CG.caseFilePath("passages", A)).toString())[0].content_id;
/* A `/10` case whose finding A's minutes leg is published without a grade, its `ungraded_passages:` block stating `rows`. */
function ungradedFile(rows) {
  const facts = gradingFacts();
  facts[A].legs[0] = { ...facts[A].legs[0], grade: null };
  return caseFile({ format: TEN, facts, docLines: rows === null ? [] : CG.ungradedPassagesLines(rows),
                    materialRows: (m) => m.map((r) => (r.ref === MINUTES ? { ...r, title: TITLE } : r)) });
}
const imp = (w, cf, who = "alice") => w.ci.importCaseFile({ parts: cf.parts, by: V(who), viewer: V(who) });
const stored = (w, r) => [...w.st.sql.exec(`SELECT stated, rows FROM case_import_ungraded WHERE import_id=? AND edition=?`, r.import, r.edition)];

test("R34: a /10 case file imports as an earlier one, and its stated ungraded passages are recorded with the edition, two rows as two; a re-import is existed: true and writes nothing", async () => {
  const cid = minutesCid();
  const two = [{ finding: A, ord: 0, content_id: cid }, { finding: C, ord: 0, content_id: "c".repeat(64) }];
  const w = seeded({ realChecker: true });
  const r = await imp(w, ungradedFile(two));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(r.existed, false);
  const held = stored(w, r);
  assert.equal(held.length, 1);
  assert.equal(Number(held[0].stated), 1);
  assert.deepEqual(JSON.parse(held[0].rows), two, "the source's rows, as its document states them");
  const e = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition;
  assert.equal(e.ungraded_passages.stated, true);
  assert.equal(e.ungraded_passages.count, 2);
  /* the block never makes the edition differ: the same bytes again are the same edition */
  const again = await imp(w, ungradedFile(two));
  assert.deepEqual([again.ok, again.existed, again.wrote], [true, true, false]);
  assert.equal(stored(w, r).length, 1, "recorded once");
});

test("R34: an earlier format records stated: false; a /10 document with no block is stated: true with no rows, not stated: false (control)", async () => {
  const w = seeded({ realChecker: true });
  const old = await imp(w, caseFile());
  assert.equal(old.ok, true, JSON.stringify(old).slice(0, 300));
  assert.equal(Number(stored(w, old)[0].stated), 0);
  const w2 = seeded({ realChecker: true });
  const none = await imp(w2, caseFile({ format: TEN }));
  assert.equal(none.ok, true, JSON.stringify(none).slice(0, 300));
  const h = stored(w2, none)[0];
  assert.deepEqual([Number(h.stated), JSON.parse(h.rows)], [1, []]);
  const e = w2.ci.importedCase({ import: none.import, viewer: V("bob") }).edition;
  assert.deepEqual([e.ungraded_passages.stated, e.ungraded_passages.count, e.ungraded_passages.rows], [true, 0, []]);
});

test("R35: a member reads per edition what the source published ungraded and per finding its rows {ord, content_id, title}, labeled the source's; the list carries ungraded_count, null for an earlier format", async () => {
  const cid = minutesCid();
  const w = seeded({ realChecker: true });
  const r = await imp(w, ungradedFile([{ finding: A, ord: 0, content_id: cid }]));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const e = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition;
  assert.equal(e.ungraded_passages.stated, true);
  assert.equal(e.ungraded_passages.count, 1);
  assert.equal(e.ungraded_passages.whose, "source");
  assert.equal(e.ungraded_passages.label_key, UNGRADED_LABEL_KEY);
  assert.deepEqual(e.ungraded_passages.rows, [{ finding: A, ord: 0, content_id: cid, title: TITLE }]);
  const byF = Object.fromEntries(e.findings.map((f) => [f.finding, f]));
  assert.deepEqual(byF[A].ungraded_passages, [{ ord: 0, content_id: cid, title: TITLE }]);
  assert.deepEqual(byF[C].ungraded_passages, []);
  /* accepted-work's `finding` read carries them */
  const facts = w.acceptedWork.acceptedFinding({ ref: importedFindingRef(r.import, A), edition: r.edition, viewer: V("bob") });
  assert.deepEqual(facts.ungraded_passages, [{ ord: 0, content_id: cid, title: TITLE }]);
  /* an earlier-format edition: the count is null, the rows null, and it says by key that the source does not say */
  const w2 = seeded({ realChecker: true });
  const old = await imp(w2, caseFile());
  const oe = w2.ci.importedCase({ import: old.import, viewer: V("bob") }).edition;
  assert.deepEqual([oe.ungraded_passages.stated, oe.ungraded_passages.count, oe.ungraded_passages.rows], [false, null, null]);
  assert.equal(oe.ungraded_passages.note_key, UNGRADED_NOT_STATED_KEY);
  if (hasWord(UNGRADED_NOT_STATED_KEY)) assert.equal(oe.ungraded_passages.note, word(UNGRADED_NOT_STATED_KEY));
  assert.ok(oe.findings.every((f) => f.ungraded_passages === null), "never an empty list for a source that does not say");
  /* the list: 1 for the /10 edition, null for the earlier one */
  assert.equal(w.ci.importedCases({ viewer: V("bob") }).imports[0].editions[0].ungraded_count, 1);
  assert.equal(w2.ci.importedCases({ viewer: V("bob") }).imports[0].editions[0].ungraded_count, null);
});

test("R35 (controls): a non-member reads the bytes of an instance with no import; accepting a finding with a listed passage succeeds and changes no grade, bar reading or result", async () => {
  const cid = minutesCid();
  const w = seeded({ realChecker: true });
  const empty = seeded({ realChecker: true });
  const r = await imp(w, ungradedFile([{ finding: A, ord: 0, content_id: cid }]));
  for (const v of [V("carol"), V("dave")]) {
    assert.equal(JSON.stringify(w.ci.importedCases({ viewer: v })), JSON.stringify(empty.ci.importedCases({ viewer: V("bob") })));
    assert.equal(JSON.stringify(w.ci.importedCase({ import: r.import, viewer: v })),
                 JSON.stringify(empty.ci.importedCase({ import: r.import, viewer: V("bob") })));
  }
  const before = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition.findings.find((f) => f.finding === A);
  const a = w.ci.acceptImported({ import: r.import, edition: r.edition, findings: [A], checked: "the minutes", reason: "it recreated",
                                  by: V("alice"), viewer: V("alice") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const after = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition.findings.find((f) => f.finding === A);
  assert.deepEqual([after.result, after.pair, after.against_own_bar, after.ungraded_passages],
                   [before.result, before.pair, before.against_own_bar, before.ungraded_passages]);
  assert.notEqual(after.origin.acceptance, null);
  /* no composed strength (R10): neither the block nor a finding carries one */
  const e = w.ci.importedCase({ import: r.import, viewer: V("bob") }).edition;
  assert.doesNotMatch(JSON.stringify(e.ungraded_passages), /strength|trust|score/i);
});
