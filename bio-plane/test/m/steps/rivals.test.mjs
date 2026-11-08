/* steps R31 (CR2-18; BD-17; hypotheses F1, IV-H2 "Evidence found while exploring"): a step opened from a rival records
   that rival, and the rival's steps are read back with what they produced, so the rival lists the legs they found. The
   rival source is the registration `hypotheses` makes at start; here a function the test registers stands for it, as
   R9's product sight is tested. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RIVAL_CODES } from "../../../src/steps/index.mjs";
import { world, ANN, BOB, DAN, AI, Q, Q2, QP1 } from "./fixture.mjs";

const HYP = "HYP-2026-0001", HYP2 = "HYP-2026-0002", OTHER = "HYP-2026-0099";
/* HYP and HYP2 are rivals on Q; HYP is also a rival on QP1. */
const rivalsOn = { [Q]: [HYP, HYP2], [QP1]: [HYP] };
const source = ({ question, rival }) => (rivalsOn[question] ?? []).includes(rival);

test("R31: a step opened from a rival records that rival with its question; every read answers it", () => {
  const w = world();
  assert.equal(w.s.registerRivalSource("hypotheses", source).ok, true);
  assert.equal(w.s.registerRivalSource("other", source).code, "LISTENER_DECLARED", "one registration");
  const r = w.s.stepCreate({ place: { questions: [Q] }, work: "Find the vendor's filing", rival: HYP, by: ANN });
  assert.equal(r.ok, true);
  assert.deepEqual(r.rival, { question: Q, rival: HYP });
  assert.deepEqual(w.s.step({ step: r.step, viewer: BOB }).rival, { question: Q, rival: HYP });
  assert.deepEqual(w.s.stepsOn({ question: Q, viewer: ANN }).steps.find((s) => s.step === r.step).rival, { question: Q, rival: HYP });
  /* control: a step opened from no rival answers none */
  const plain = w.step({ work: "Read the minutes" });
  assert.equal(w.s.step({ step: plain, viewer: ANN }).rival, null);
  /* a machine through a run it holds opens one the same way */
  w.runs();
  const m = w.s.stepCreate({ place: { questions: [Q] }, work: "Search the archive", rival: HYP2, by: AI, run: "RUN-1" });
  assert.deepEqual(m.rival, { question: Q, rival: HYP2 });
});

test("R31: of several questions, the rival is recorded on the first (in id order) whose rival it is", () => {
  const w = world();
  w.s.registerRivalSource("hypotheses", source);
  const r = w.s.stepCreate({ place: { questions: [Q2, QP1] }, work: "Ask the clerk", rival: HYP, by: ANN });
  assert.deepEqual(r.rival, { question: QP1, rival: HYP }, "Q2 holds no such rival");
  assert.equal(w.s.step({ step: r.step, viewer: ANN }).rival.question, QP1);
});

test("R31: an id that is not a rival of the step's questions is refused STEP_NOT_A_RIVAL, writing nothing", () => {
  const w = world();
  assert.deepEqual([...RIVAL_CODES], ["STEP_NOT_A_RIVAL"]);
  const before = w.snapshot();
  /* no source registered: no id is a rival */
  const none = w.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: HYP, by: ANN });
  assert.equal(none.code, "STEP_NOT_A_RIVAL");
  assert.equal(none.check, null);
  assert.equal(typeof none.translation, "string");
  w.s.registerRivalSource("hypotheses", source);
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: OTHER, by: ANN }).code, "STEP_NOT_A_RIVAL");
  assert.equal(w.s.stepCreate({ place: { questions: [Q2] }, work: "x", rival: HYP, by: ANN }).code, "STEP_NOT_A_RIVAL", "a rival of another question");
  assert.equal(w.s.stepCreate({ place: { group: true }, work: "x", rival: HYP, by: ANN }).code, "STEP_NOT_A_RIVAL", "a team step is opened from no rival");
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: "  ", by: ANN }).code, "STEP_NOT_A_RIVAL");
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: 7, by: ANN }).code, "STEP_NOT_A_RIVAL");
  assert.equal(w.snapshot(), before, "nothing was written");
  /* a source that throws is read as not a rival */
  const w2 = world();
  w2.s.registerRivalSource("hypotheses", () => { throw new Error("boom"); });
  assert.equal(w2.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: HYP, by: ANN }).code, "STEP_NOT_A_RIVAL");
  /* control: the same act on a rival passes */
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "x", rival: HYP, by: ANN }).ok, true);
});

test("R31: stepsOfRival answers the rival's steps the viewer sees, each with what it produced, so the rival lists the legs they found", () => {
  const w = world();
  w.s.registerRivalSource("hypotheses", source);
  w.bundle("INFO-2026-0001-doc", { type: "information" });
  const a = w.s.stepCreate({ place: { questions: [Q] }, work: "Find the filing", rival: HYP, by: ANN }).step;
  const b = w.s.stepCreate({ place: { questions: [Q] }, work: "Read the contract", rival: HYP2, by: ANN }).step;
  const p = w.s.stepCreate({ place: { questions: [QP1] }, work: "Ask inside P1", rival: HYP, by: ANN }).step;
  w.step({ work: "Not from a rival" });
  assert.equal(w.s.stepProduct({ step: a, record: "INFO-2026-0001-doc", by: ANN }).ok, true);
  const r = w.s.stepsOfRival({ question: Q, rival: HYP, viewer: BOB });
  assert.equal(r.ok, true);
  assert.deepEqual(r.steps.map((s) => s.step), [a], "only HYP's steps on Q");
  assert.deepEqual(r.steps[0].products.map((x) => x.id), ["INFO-2026-0001-doc"]);
  assert.deepEqual(r.steps[0].rival, { question: Q, rival: HYP });
  assert.equal(r.truncated, false);
  assert.deepEqual(w.s.stepsOfRival({ question: Q, rival: HYP2, viewer: BOB }).steps.map((s) => s.step), [b]);
  assert.deepEqual(w.s.stepsOfRival({ question: QP1, rival: HYP, viewer: ANN }).steps.map((s) => s.step), [p]);
  /* a question the viewer may not see answers as absent; a rival no step was opened from answers none */
  assert.equal(w.s.stepsOfRival({ question: QP1, rival: HYP, viewer: DAN }).code, "NO_SUCH_BUNDLE");
  assert.deepEqual(w.s.stepsOfRival({ question: Q, rival: OTHER, viewer: BOB }).steps, []);
  assert.deepEqual(w.s.stepsOfRival({ question: Q, rival: null, viewer: BOB }).steps, []);
});

test("R31: the rival goes with the step and with its question's reference", () => {
  const w = world();
  w.s.registerRivalSource("hypotheses", source);
  const a = w.s.stepCreate({ place: { questions: [Q, QP1] }, work: "Shared", rival: HYP, by: ANN }).step;
  /* the step stays on QP1 once Q's reference is removed; the rival recorded on Q goes with that reference */
  assert.equal(w.s.stepDelete({ step: a, question: Q, by: ANN }).ok, true);
  assert.equal(w.s.step({ step: a, viewer: ANN }).rival, null);
  assert.deepEqual(w.s.stepsOfRival({ question: Q, rival: HYP, viewer: ANN }).steps, []);
  const b = w.s.stepCreate({ place: { questions: [Q] }, work: "Alone", rival: HYP, by: ANN }).step;
  assert.equal(w.s.stepDelete({ step: b, by: ANN }).ok, true);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM step_rivals`)[0].n, 0, "a deleted step leaves no row");
});
