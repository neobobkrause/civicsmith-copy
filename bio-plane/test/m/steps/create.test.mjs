/* steps R1–R4, R21: creating a step, who sees it, the doer and the project it was taken in, and the reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, ANN, BOB, CAT, DAN, OUT, BOSS, AI, P1, P2, PH, PD, Q, Q2, QP1, QH } from "./fixture.mjs";

test("R1: stepCreate records a step at planned, answering {ok, step, place, at}; the refusals in order, each writing nothing", () => {
  const w = world();
  const r = w.s.stepCreate({ place: { questions: [Q, Q2] }, work: "  Read the minutes  ", byWhen: { date: "2026-11-01", basis: "law", source: "Gov. Code" }, project: P1, by: ANN });
  assert.equal(r.ok, true);
  assert.match(r.step, /^STP-2026-[a-z0-9]{16}$/);
  assert.deepEqual(r.place, { questions: [Q, Q2] });
  assert.equal(typeof r.at, "string");
  const v = w.s.step({ step: r.step, viewer: ANN });
  assert.equal(v.state, "planned");
  assert.equal(v.work, "Read the minutes");
  assert.deepEqual({ date: v.byWhen.date, basis: v.byWhen.basis, source: v.byWhen.source }, { date: "2026-11-01", basis: "law", source: "Gov. Code" });
  assert.deepEqual(v.taken_in, { id: P1, name: "Project One" });
  /* no purpose, method or parent field is held */
  assert.equal("purpose" in v || "method" in v || "parent" in v, false);

  const before = w.snapshot();
  const code = (a) => w.s.stepCreate({ place: { questions: [Q] }, work: "w", by: ANN, ...a }).code;
  assert.equal(code({ work: "" }), "STEP_NO_WORK");
  assert.equal(code({ work: "x".repeat(501) }), "STEP_NO_WORK");
  assert.equal(code({ work: "", place: null }), "STEP_NO_WORK", "work is asked before the place");
  assert.equal(code({ place: null }), "STEP_BAD_PLACE");
  assert.equal(code({ place: { questions: [Q], group: true } }), "STEP_BAD_PLACE");
  assert.equal(code({ place: { questions: [] } }), "STEP_BAD_PLACE");
  assert.equal(code({ place: { questions: ["INQ-2026-0099-none"] } }), "NO_SUCH_BUNDLE");
  assert.equal(code({ place: { questions: [QH] } }), "NO_SUCH_BUNDLE", "a question the caller may not see is answered as absent");
  assert.equal(code({ place: { questions: [P1] } }), "NO_SUCH_BUNDLE", "not an inquiry is answered as absent");
  assert.equal(code({ place: { project: P2 } }), "PROJECT_SEEN_NOT_A_PARTICIPANT", "a discoverable project Ann is not in: EXISTENCE");
  assert.equal(code({ place: { project: PH } }), "NO_SUCH_PROJECT", "a hidden project: NONE, as absent");
  assert.equal(code({ project: PD }), "PROJECT_SEEN_NOT_A_PARTICIPANT");
  w.participant(P2, "ann", { state: "invited" });
  assert.equal(code({ place: { project: P2 } }), "PROJECT_ACT_NOT_A_PARTICIPANT", "invited, not joined");
  assert.equal(code({ byWhen: { date: "2026-02-31", basis: "law" } }), "STEP_BAD_BY_WHEN");
  assert.equal(code({ byWhen: { date: "2026-03-01", basis: "whim" } }), "STEP_BAD_BY_WHEN");
  assert.equal(w.snapshot(), before);
  /* every refusal carries its row */
  const ref = w.s.stepCreate({ place: null, work: "w", by: ANN });
  assert.match(ref.check, /^C-142\.\d+$/);
  assert.equal(typeof ref.translation, "string");
});

test("R1: a machine credential creates a step only for a run it holds, doer system with that run's enabled_by", () => {
  const w = world();
  const before = w.snapshot();
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "Fetch the agenda", by: AI, run: "RUN-1" }).code, "STEP_NOT_YOUR_RUN", "no run holder registered");
  w.runs();
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "Fetch the agenda", by: AI, run: "RUN-9" }).code, "STEP_NOT_YOUR_RUN");
  assert.equal(w.s.stepCreate({ place: { questions: [Q] }, work: "Fetch the agenda", by: AI }).code, "STEP_NOT_YOUR_RUN");
  assert.equal(w.snapshot(), before);
  const r = w.s.stepCreate({ place: { questions: [Q] }, work: "Fetch the agenda", by: AI, run: "RUN-1" });
  assert.equal(r.ok, true);
  const v = w.s.step({ step: r.step, viewer: ANN });
  assert.equal(v.doer, "system");
  assert.equal(v.enabled_by, "ann-h's assistant");
  /* the machine sees as its principal: a question Ann cannot see is absent to it */
  assert.equal(w.s.stepCreate({ place: { questions: [QH] }, work: "Fetch", by: AI, run: "RUN-1" }).code, "NO_SUCH_BUNDLE");
});

test("R2: who sees a step: question-placed through a referring question, project-placed at FULL sight, group-placed every active member; any other as absent", () => {
  const w = world();
  const sq = w.step({ place: { questions: [QP1] } });                 /* QP1 lies in P1: Ann and Bob see it */
  const sp = w.step({ place: { project: P1 } });
  const sg = w.step({ place: { group: true } });
  const sees = (id, v) => w.s.step({ step: id, viewer: v }).ok === true;
  assert.equal(sees(sq, BOB), true);
  assert.equal(sees(sq, DAN), false, "Dan sees no referring question");
  assert.equal(sees(sp, BOB), true);
  assert.equal(sees(sp, DAN), false, "Dan is at EXISTENCE of P1, not FULL");
  assert.equal(sees(sp, BOSS), true, "an administrator is at FULL of a discoverable project");
  assert.equal(sees(sg, OUT), true);
  w.st.sql.exec(`UPDATE members SET status = 'revoked' WHERE member_id = 'out'`);
  assert.equal(sees(sg, OUT), false, "a revoked member is not an active member");
  assert.equal(sees(sq, null), false, "an absent viewer fails closed");
  /* answered exactly as one that does not exist */
  const hidden = w.s.step({ step: sq, viewer: DAN });
  const none = w.s.step({ step: "STP-2026-aaaaaaaaaaaaaaaa", viewer: DAN });
  assert.deepEqual({ ...hidden, step: null }, { ...none, step: null });
  /* and counted nowhere */
  assert.equal(w.s.stepsOfGroup({ viewer: DAN }).steps.some((s) => s.step === sq || s.step === sp), false);
  assert.equal(w.s.stepsLike({ work: "Ask the clerk for the 2025 contract file", viewer: DAN }).steps.length, 1, "only the group step");
});

test("R3: a question-placed step names its doer by handle, and its project only while not hidden; hidden and none answer alike", () => {
  const w = world();
  w.participant(PH, "ann");                               /* Ann joined the hidden project */
  const inHidden = w.step({ project: PH });
  const inNone = w.step();
  const inShown = w.step({ project: P1 });
  const v = (id, viewer) => w.s.step({ step: id, viewer });
  assert.equal(v(inShown, BOB).doer, "ann-h");
  assert.deepEqual(v(inShown, DAN).taken_in, { id: P1, name: "Project One" }, "a discoverable project's name is seen at EXISTENCE");
  assert.equal(v(inHidden, ANN).taken_in, null, "never named while hidden, even to its participants");
  assert.equal(v(inHidden, CAT).taken_in, null);
  const strip = (x) => ({ ...x, step: null, at: null });
  assert.deepEqual(strip(v(inHidden, DAN)), strip(v(inNone, DAN)), "a step taken in a hidden project reads as one taken in none");
  /* the negative control: a project made discoverable is named again */
  w.st.sql.exec(`UPDATE project_sight SET setting = 'discoverable' WHERE project_id = ?`, PH);
  assert.deepEqual(v(inHidden, DAN).taken_in, { id: PH, name: "Hidden Project" });
});

test("R4: the reads answer the step's fields, stepsOn's header the question's projects; bounded with truncated and next; never throw", () => {
  const w = world();
  w.draw(Q, P1, PH);
  for (let i = 0; i < 5; i++) w.step({ work: `step number ${i} alpha` });
  const page = w.s.stepsOn({ question: Q, viewer: ANN, limit: 2 });
  assert.equal(page.ok, true);
  assert.deepEqual(page.projects, { projects: [{ id: P1, name: "Project One" }], truncated: false }, "a hidden drawing project is never answered");
  assert.equal(page.steps.length, 2);
  assert.equal(page.truncated, true);
  const next = w.s.stepsOn({ question: Q, viewer: ANN, limit: 2, after: page.next.after });
  assert.equal(next.steps[0].step > page.steps[1].step, true);
  assert.deepEqual(Object.keys(page.steps[0]).sort(),
    ["at", "byWhen", "by_when_held", "cost", "doer", "learned", "later_found", "outcomes", "place", "rival", "state", "step", "taken_in", "waits", "work"].sort());
  assert.equal(w.s.stepsOn({ question: Q, viewer: ANN }).limit, 200, "default 200");
  assert.equal(w.s.stepsOn({ question: Q, viewer: ANN, limit: 5000 }).limit, 1000, "at most 1,000");
  assert.equal(w.s.stepsOn({ question: QH, viewer: ANN }).code, "NO_SUCH_BUNDLE");
  /* stepsIn and stepsOfGroup */
  const sp = w.step({ place: { project: P1 } });
  assert.deepEqual(w.s.stepsIn({ project: P1, viewer: BOB }).steps.map((s) => s.step), [sp]);
  assert.equal(w.s.stepsIn({ project: P1, viewer: DAN }).code, "PROJECT_SEEN_NOT_A_PARTICIPANT");
  assert.equal(w.s.stepsIn({ project: PH, viewer: DAN }).code, "NO_SUCH_PROJECT");
  const sg = w.step({ place: { group: true } });
  assert.deepEqual(w.s.stepsOfGroup({ viewer: OUT }).steps.map((s) => s.step), [sg]);
  /* a state filter */
  assert.equal(w.s.stepsOn({ question: Q, viewer: ANN, state: "underway" }).steps.length, 0);
  /* never throws, whatever it is handed; leg-earning absent answers the header undetermined */
  const bare = world({ legEarning: {} });
  bare.step();
  assert.equal(bare.s.stepsOn({ question: Q, viewer: ANN }).projects.undetermined, true);
  for (const bad of [undefined, null, 5, {}, { question: {} }]) assert.doesNotThrow(() => w.s.stepsOn(bad ?? undefined));
  assert.doesNotThrow(() => w.s.step({ step: { x: 1 }, viewer: [] }));
});

test("R21: a step holds no step: no place names a step, and nothing nests one step in another", () => {
  const w = world();
  const a = w.step();
  assert.equal(w.s.stepCreate({ place: { step: a }, work: "inner", by: ANN }).code, "STEP_BAD_PLACE");
  assert.equal(w.s.stepCreate({ place: { questions: [a] }, work: "inner", by: ANN }).code, "NO_SUCH_BUNDLE");
  /* the negative control: a wait on another step is not nesting, and both stay top-level */
  const b = w.step({ work: "second" });
  assert.equal(w.s.stepWait({ step: b, on: { step: a }, by: ANN }).ok, true);
  assert.deepEqual(w.s.step({ step: b, viewer: ANN }).place, { questions: [Q] });
});
