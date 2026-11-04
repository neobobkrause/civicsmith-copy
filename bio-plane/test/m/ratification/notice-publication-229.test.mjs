/* ratification against publication PR 229 (notice publication:229; its R58, R80, R81, R82): `commitCaseEdition` now
   refuses a document of a format before /6 with CASE_FORMAT_SUPERSEDED (R58) and records the ungraded and typed
   passages from the signed bytes (R80, R82); `caseEditionState` answers both (R81, R82). This module's commit
   (`#commitPlan`) hands publication the case and edition whose stored, signed bytes it reads, and its edition read
   (`#editionState`) answers publication's own, so it needs no change: a /10 edition signed by `op=caseratify` holds
   both blocks as signed, a /6 one holds them as predating the format, and a /5 one is refused, nothing signed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { passagesWorld, signs, ungraded, typedRow, keyOf, TYPED, P1, P2, Q1, CASE } from "./passages-world.mjs";

test("notice publication:229 (R80-R82): an edition op=caseratify commits records its ungraded and typed passages as the signed bytes state them, and the edition read answers them", async () => {
  const s = await passagesWorld({ passages: [P2, TYPED], facts: [{ finding: Q1, ord: 2, grade: null }, { finding: Q1, ord: 1, grade: "D", typed: { checked: false } }],
                                  lines: [...ungraded(P2), ...typedRow(TYPED)] });
  await signs(s, "/10 with one ungraded and one typed passage");
  const st = s.w.publication.caseEditionState(CASE, 1, null);
  assert.deepEqual([st.ungraded_passages.state, st.ungraded_passages.rows], ["stated", [keyOf(P2)]], JSON.stringify(st.ungraded_passages));
  assert.equal(st.typed_passages.state, "stated");
  assert.deepEqual(st.typed_passages.rows.map(keyOf), [keyOf(TYPED)]);
});

test("notice publication:229 (R58): a /5 document is refused by the commit CASE_FORMAT_SUPERSEDED and nothing is signed; the fixture's /6 commits with both statements as predating the format", async () => {
  const old = await passagesWorld({ format: "bio-case-document/5", passages: null });
  const r = await old.act();
  assert.equal(r.body.reason, "CASE_FORMAT_SUPERSEDED", JSON.stringify(r.body).slice(0, 400));
  assert.equal(old.signed(), null, "nothing signed");
  assert.equal(old.w.count("published_cases"), 0);
  const six = await passagesWorld({ format: null, passages: null });
  await signs(six, "/6");
  const st = six.w.publication.caseEditionState(CASE, 1, null);
  assert.deepEqual([st.ungraded_passages.state, st.ungraded_passages.rows], ["predates", null]);
  assert.deepEqual([st.typed_passages.state, st.typed_passages.rows], ["predates", null]);
});
