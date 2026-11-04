/* ratification R62 (T53; DEC-461): a signed statement of ungraded passages must be true, and a true one is never
   refused. `op=caseratify` (R2), the pre-flight (R18) and the scheduled publisher (R42) refuse, by the case gate's
   C-41.18 (`case-catalogue` R7, run by R8's registration), a /10 document whose `ungraded_passages:` block disagrees with
   its own `passages:` and `grading_facts:`; a document whose statement is true signs, however many passages are
   ungraded; a document of an earlier format is not asked. Driven at the module's interface over its own case, signature
   and gate. R63: the edition records the statement from the signed bytes (`publication` R80's commit, through R42). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { passagesWorld, refusedAlike, signs, ungraded, gateChecks, keyOf, P1, P2, Q1, CASE } from "./passages-world.mjs";

const ONE_UNGRADED = [{ finding: Q1, ord: 1, grade: null }, { finding: Q1, ord: 2, grade: "B" }];
const ALL_GRADED = [{ finding: Q1, ord: 1, grade: "C" }, { finding: Q1, ord: 2, grade: "B" }];

test("R62: a /10 document with one ungraded passage and a statement naming it signs; the same with the statement removed, or naming a graded passage, is refused GATE_REFUSED naming C-41.18 by the act and the pre-flight alike; prepared again with a true statement it signs", async () => {
  await signs(await passagesWorld({ facts: ONE_UNGRADED, lines: ungraded(P1) }), "a true statement");
  const removed = await passagesWorld({ facts: ONE_UNGRADED, lines: [] });
  await refusedAlike(removed, ["C-41.18"], "the statement removed");
  await refusedAlike(await passagesWorld({ facts: ONE_UNGRADED, lines: ungraded(P1, P2) }), ["C-41.18"], "a graded passage named");
  await refusedAlike(await passagesWorld({ facts: ALL_GRADED, lines: ungraded(P2) }), ["C-41.18"], "only a graded passage named");
  /* preparing again (new bytes stating the truth), never grading, mends it */
  await signs(await removed.prepare(ungraded(P1)), "the refused edition, prepared again");
});

test("R62: the scheduled publisher stops a waiting edition whose statement disagrees with its passages, SCHEDULED_CHECK_REFUSED with the gate's C-41.18, committing nothing; one whose statement is true publishes", async () => {
  const bad = await passagesWorld({ facts: ONE_UNGRADED, lines: [] });
  const refused = await bad.publishAt();
  assert.deepEqual([refused.status, refused.body.reason], [409, "GATE_REFUSED"], "op=publishat refuses it before it waits");
  assert.deepEqual(gateChecks(refused.body), ["C-41.18"]);
  /* a waiting entry over those bytes all the same (signed before this check existed): stopped at its time */
  const out = await bad.scheduled();
  const gate = (out.stopped || []).find((x) => x.cause && x.cause.code === "GATE_REFUSED");
  assert.ok(gate, JSON.stringify(out).slice(0, 600));
  assert.equal(gate.code, "SCHEDULED_CHECK_REFUSED");
  assert.deepEqual(gateChecks(gate.cause), ["C-41.18"]);
  assert.notEqual(out.published, true);
  assert.equal(bad.w.count("published_cases"), 0, "nothing committed");
  const good = await passagesWorld({ facts: ONE_UNGRADED, lines: ungraded(P1) });
  const held = await good.publishAt();
  assert.equal(held.status, 200, JSON.stringify(held.body).slice(0, 400));
  const ok = await good.scheduled(good.queued[0].checked);
  assert.equal(ok.published, true, JSON.stringify(ok).slice(0, 600));
});

test("R62 controls: all graded with no statement signs; two ungraded, both stated, sign (no case is refused for being ungraded alone); a pre-format document signs unasked", async () => {
  await signs(await passagesWorld({ facts: ALL_GRADED, lines: [] }), "all graded, no statement");
  await signs(await passagesWorld({ facts: [{ finding: Q1, ord: 1, grade: null }, { finding: Q1, ord: 2, grade: null }],
                                    lines: ungraded(P1, P2) }), "every passage ungraded, stated");
  await signs(await passagesWorld({ format: null, passages: null }), "the fixture's /6 document");
});

test("R63: an edition signed at a set time with two passages ungraded publishes, at its time, with the two as signed; a pre-format edition records them as not stated (predates), never as none", async () => {
  const facts = [{ finding: Q1, ord: 1, grade: null }, { finding: Q1, ord: 2, grade: null }];
  const s = await passagesWorld({ facts, lines: ungraded(P1, P2) });
  assert.equal((await s.publishAt()).status, 200);
  /* whatever is graded in the meantime, the waiting edition's bytes and its checks are the signing's (R41) */
  const out = await s.scheduled(s.queued[0].checked);
  assert.equal(out.published, true, JSON.stringify(out).slice(0, 400));
  const st = s.w.publication.caseEditionState(CASE, 1, null);
  assert.deepEqual([st.ungraded_passages.state, st.ungraded_passages.rows], ["stated", [keyOf(P1), keyOf(P2)]]);
  const pre = await passagesWorld({ format: null, passages: null });
  assert.equal((await pre.publishAt()).status, 200);
  assert.equal((await pre.scheduled(pre.queued[0].checked)).published, true);
  const ps = pre.w.publication.caseEditionState(CASE, 1, null);
  assert.deepEqual([ps.ungraded_passages.state, ps.ungraded_passages.rows], ["predates", null]);
  assert.notDeepEqual(ps.ungraded_passages.rows, [], "not stated is not none");
});
