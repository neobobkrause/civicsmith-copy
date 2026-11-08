/* hypotheses F1 (layer 12, CR2-31; BD-17; IV-H2 "Evidence found while exploring"; steps R31): a rival lists the legs
   the steps opened from it produced, each with its grades and its role, against the real steps. Over inquiry's real
   module and its published world (its `fixture.mjs`), with steps' real module (`stepsOf`) and hypotheses made over the
   same host and handed to each other as the plane's assembly hands them (`deps.steps`; store-assembly CR2-30). Each with
   a negative control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../inquiry/fixture.mjs";
import { stepsOf } from "../../../src/steps/index.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";

const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r";
const D1 = "INFO-2026-0001-a", D2 = "INFO-2026-0002-b", D3 = "INFO-2026-0003-c", D4 = "INFO-2026-0004-d";
const ANN = "member:ann", BEA = "member:bea";
const graded = { grade: "B", grade_axis: "capture", grade_source: "capture" };

/* inquiry's world with a question whose basis is D1 (supports), D2 (cuts against, graded B on capture) and D3, a
   second question on D1, and steps and hypotheses over the same host, steps handed in as the plane hands it */
function setup() {
  const w = world();
  for (const d of [D1, D2, D3, D4]) w.doc(d);
  w.inquiry(Q, { legs: [{ target: D1 }, { target: D2, role: "cuts_against", ...graded }, { target: D3 }] });
  w.inquiry(Q2, { legs: [{ target: D1 }] });
  w.member("ann"); w.member("bea");
  const steps = stepsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, legEarning: w.k.legEarning });
  const h = hypothesesOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, inquiry: w.k, steps });
  const hold = (inquiry, statement) => {
    const r = h.hold({ inquiry, kind: "other", statement, about: [D1], by: ANN });
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.hypothesis_id;
  };
  const A = hold(Q, "A budget shortfall."), B = hold(Q, "The deck was unsafe."), C = hold(Q, "Too few used it.");
  assert.equal(h.hypothesisRivals({ inquiry: Q, rivals: [A, B], by: ANN }).ok, true);
  const open = (rival, work, question = Q) => {
    const r = steps.stepCreate({ place: { questions: [question] }, work, ...(rival ? { rival } : {}), by: ANN });
    assert.equal(r.ok, true, JSON.stringify(r));
    return r.step;
  };
  const produce = (step, record) => assert.equal(steps.stepProduct({ step, record, by: ANN }).ok, true);
  return { w, h, steps, A, B, C, open, produce };
}
const rival = (h, id, viewer = ANN) => h.rivalsOf({ inquiry: Q, viewer }).rivals.find((r) => r.rival === id);

test("F1 IV-H2 (steps R31) over steps' real module: a step opened from a rival records it, and the rival lists the question's legs whose target a step opened from it produced, each with its grades and its role, in the basis's order", () => {
  const { h, A, B, open, produce } = setup();
  const s1 = open(A, "Find the vendor's filing");
  const s2 = open(A, "Read the council minutes");
  produce(s1, D3);      /* produced first, listed after: the basis's order */
  produce(s2, D2);
  const a = rival(h, A);
  assert.equal(a.legs_read, true);
  assert.deepEqual(a.legs, [
    { ord: 1, target: D2, target_type: "information", role: "cuts_against", grade: "B", grade_axis: "capture", grade_source: "capture", step: s2 },
    { ord: 2, target: D3, target_type: "information", role: "supports", grade: null, grade_axis: null, grade_source: null, step: s1 },
  ]);
  /* the rival itself is still a hypothesis with no grade, whatever its legs carry */
  assert.deepEqual([a.label, a.fact, a.grade], ["hypothesis", false, null]);
  /* control: the other rival, from which no step was opened, lists none and says it read them */
  assert.deepEqual([rival(h, B).legs, rival(h, B).legs_read], [[], true]);
});

test("F1 IV-H2 (steps R31) a leg on another product, a product that is no leg, a step on another rival, a step from no rival and a step on another question list nothing on the rival", () => {
  const { h, A, B, open, produce } = setup();
  const sb = open(B, "Ask the engineer");
  produce(sb, D2);                              /* B's step: listed on B, never on A */
  produce(open(A, "Search the archive"), D4);   /* a product that is no leg of the question */
  produce(open(null, "Read the contract"), D3); /* a step from no rival */
  produce(open(null, "Look on the other question", Q2), D1);
  assert.deepEqual([rival(h, A).legs, rival(h, A).legs_read], [[], true]);
  assert.deepEqual(rival(h, B).legs.map((l) => [l.target, l.step]), [[D2, sb]]);
});

test("F1 IV-H2 a held hypothesis that is not a rival cannot open a step (steps refuses STEP_NOT_A_RIVAL through this module's registration), and a mark writes no leg: the basis, its grades and every rival's legs are unchanged by it", () => {
  const { w, h, steps, A, B, C, open, produce } = setup();
  const notRival = steps.stepCreate({ place: { questions: [Q] }, work: "x", rival: C, by: ANN });
  assert.equal(notRival.code, "STEP_NOT_A_RIVAL");
  produce(open(A, "Find the vendor's filing"), D2);
  const basis = JSON.stringify(w.k.basisFor(Q));
  const before = JSON.stringify(h.rivalsOf({ inquiry: Q, viewer: ANN }).rivals.map((r) => [r.rival, r.legs]));
  assert.equal(h.exploreNext({ inquiry: Q, rival: B, by: BEA }).ok, true);
  assert.equal(h.exploreNext({ inquiry: Q, rival: B, by: ANN }).ok, true);
  assert.equal(JSON.stringify(w.k.basisFor(Q)), basis, "a mark writes no leg and moves no grade");
  const after = h.rivalsOf({ inquiry: Q, viewer: ANN }).rivals;
  assert.deepEqual(after.map((r) => r.rival), [B, A], "the marks set the order of exploring, nothing else");
  assert.equal(JSON.stringify([...after].reverse().map((r) => [r.rival, r.legs])), before);
});
